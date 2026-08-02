// Frente C · troceo de initDB · migraciones POST-open (idempotentes, con transacciones
// readwrite normales fuera de la versionchange). Extraídas LITERALMENTE de db.ts; el
// cuerpo de los .then es idéntico. db.ts hace `dbPromise = runPostOpenMigrations(dbPromise)`.
import type { IDBPDatabase } from 'idb';
import type { AtlasHorizonDB } from '../db';
import type { BoteAnualSinIdentificar,Contract,Property,TreasuryEvent } from './types';
import { repoblarNifsBotesDesdeArchivo, recalcularFechaFinContratosAEAT, backfillDocumentoFirmado } from '../alquileresV3FixService';
import { migrarBaseAmortizableEjercicio } from '../baseAmortizableEjercicioService';
import { inmuebleDelPrestamo, idDeInmueble, type PrestamoConDestinos } from '../inmuebleDelPrestamo';

/** Sólo estos orígenes tienen un gasto recurrente detrás del que copiar. */
const ORIGENES_CON_PROVEEDOR = new Set(['gasto_recurrente', 'opex_rule', 'personal_expense']);

/** id de compromiso → nombre del proveedor · los vacíos no entran. */
export function indexarProveedores(
  compromisos: Array<{ id?: number; proveedor?: { nombre?: string } }>,
): Map<number, string> {
  const m = new Map<number, string>();
  for (const c of compromisos) {
    const nombre = c.proveedor?.nombre?.trim();
    if (c.id != null && nombre) m.set(c.id, nombre);
  }
  return m;
}

/**
 * Qué proveedor le toca a una previsión, o `null` si no hay que tocarla.
 *
 * Devuelve `null` —y por tanto no se escribe— cuando ya tiene proveedor (una
 * corrección a mano manda sobre el dato del compromiso), cuando el origen no es
 * un gasto recurrente, o cuando el compromiso no tiene proveedor que dar.
 */
export function proveedorParaEvento(
  ev: { sourceType?: string; sourceId?: number | string; proveedor?: string },
  nombrePorId: Map<number, string>,
): string | null {
  if (ev.proveedor) return null;
  if (!ev.sourceType || !ORIGENES_CON_PROVEEDOR.has(ev.sourceType)) return null;
  if (ev.sourceId == null) return null;
  return nombrePorId.get(Number(ev.sourceId)) ?? null;
}

export function runPostOpenMigrations(
  dbPromise: Promise<IDBPDatabase<AtlasHorizonDB>>,
): Promise<IDBPDatabase<AtlasHorizonDB>> {
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_alquileres';
        const yaHecha = await db.get('keyval', FLAG);
        if (yaHecha === 'completed') return db;

        // Paso B · Property.modoExplotacion desde el boolean legacy
        try {
          const tx = db.transaction(['properties'], 'readwrite');
          const store = tx.objectStore('properties');
          const props = (await store.getAll()) as Property[];
          for (const p of props) {
            if (p?.id == null) continue;
            if (p.modoExplotacion) continue; // ya poblado · idempotente
            const activo = (p as any).alquilerPorHabitaciones?.activo === true;
            p.modoExplotacion = activo ? 'por_habitaciones' : 'piso_completo';
            await store.put(p);
          }
          await tx.done;
        } catch (err) {
          console.warn('[DB V78] Paso B (modoExplotacion) falló:', err);
        }

        // Paso C · inicializar cotitulares=[] en Contracts existentes
        // Paso D · recolectar y eliminar Contracts huérfanos sin_identificar
        const huerfanosIds: number[] = [];
        try {
          const tx = db.transaction(['contracts'], 'readwrite');
          const store = tx.objectStore('contracts');
          const contracts = (await store.getAll()) as Contract[];
          for (const c of contracts) {
            if (c?.id == null) continue;
            if (c.estadoContrato === 'sin_identificar') {
              huerfanosIds.push(c.id);
              await store.delete(c.id);
              continue;
            }
            if (c.inquilino && c.inquilino.cotitulares === undefined) {
              c.inquilino.cotitulares = [];
              await store.put(c);
            }
          }
          await tx.done;
        } catch (err) {
          console.warn('[DB V78] Pasos C/D (cotitulares + borrado huérfanos) falló:', err);
        }

        // Paso D (cascada) · borrar treasuryEvents de los Contracts eliminados
        if (huerfanosIds.length > 0) {
          try {
            const idSet = new Set(huerfanosIds);
            const tx = db.transaction(['treasuryEvents'], 'readwrite');
            const store = tx.objectStore('treasuryEvents');
            const eventos = (await store.getAll()) as TreasuryEvent[];
            for (const ev of eventos) {
              if (ev?.id == null) continue;
              if ((ev as any).sourceType === 'contrato' && idSet.has(Number((ev as any).sourceId))) {
                await store.delete(ev.id);
              }
            }
            await tx.done;
          } catch (err) {
            console.warn('[DB V78] Paso D cascada treasuryEvents falló:', err);
          }
          console.log(`[DB V78] Migración alquileres v3 · ${huerfanosIds.length} Contracts sin_identificar eliminados + treasuryEvents en cascada`);
        }

        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78 post-upgrade] migración alquileres falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy H1) · self-heal de `modoExplotacion` ──
    // El Paso B original iba en el mismo flag que C/D y con un único try/catch (un put
    // que fallara abortaba el resto · y si el flag ya estaba 'completed' no reintentaba).
    // Este paso, con su PROPIO flag y try/catch POR property, rellena cualquier inmueble
    // que siguiera sin `modoExplotacion` en producción (causa raíz de H1). Idempotente.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_modoExplotacion_selfheal_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        let curados = 0;
        const props = (await db.getAll('properties')) as Property[];
        for (const p of props) {
          if (p?.id == null || p.modoExplotacion) continue;
          try {
            const activo = (p as any).alquilerPorHabitaciones?.activo === true;
            p.modoExplotacion = activo ? 'por_habitaciones' : 'piso_completo';
            await db.put('properties', p);
            curados++;
          } catch (errP) {
            console.warn(`[DB V78.1] self-heal modoExplotacion falló en property ${p.id}:`, errP);
          }
        }
        if (curados > 0) console.log(`[DB V78.1] self-heal · ${curados} properties con modoExplotacion poblado`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 self-heal modoExplotacion] falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy H1.4) · limpieza de Contracts huérfanos mal ruteados ──
    // Un Contract creado desde XML AEAT (algún ejercicioFiscal con fuente='xml_aeat') sobre un
    // inmueble que ahora es `por_habitaciones`/`mixto` está mal ruteado (debió ir al bote · caso
    // "Fuertes Acevedo"/FA32). Se ELIMINA el Contract + sus treasuryEvents y se SALVA su importe
    // y sus NIFs (inquilino.dni + cotitulares) al bote del (inmueble·año), de modo que no se
    // pierde dato si el usuario no re-importa. Un re-import posterior REEMPLAZA el bote limpio.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_huerfanos_modo_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;

        const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
        const estadoBote = (decl: number, asig: number): BoteAnualSinIdentificar['estado'] => {
          const EPS = 0.005;
          if (asig <= EPS) return 'pendiente_total';
          if (asig > decl + EPS) return 'sobre_asignado';
          if (asig >= decl - EPS) return 'cerrado';
          return 'parcial';
        };

        const tx = db.transaction(
          ['properties', 'contracts', 'treasuryEvents', 'botesAnualesSinIdentificar'],
          'readwrite',
        );
        const propsStore = tx.objectStore('properties');
        const contractsStore = tx.objectStore('contracts');
        const eventsStore = tx.objectStore('treasuryEvents');
        const botesStore = tx.objectStore('botesAnualesSinIdentificar');

        const allProps = (await propsStore.getAll()) as Property[];
        const modoById = new Map<number, Property['modoExplotacion']>();
        for (const p of allProps) if (p?.id != null) modoById.set(p.id, p.modoExplotacion);

        const allContracts = (await contractsStore.getAll()) as Contract[];
        const orphanIds: number[] = [];

        for (const c of allContracts) {
          if (c?.id == null || c.inmuebleId == null) continue;
          if (c.estadoContrato === 'sin_identificar') continue; // ya tratados en el flag anterior
          const modo = modoById.get(c.inmuebleId);
          if (modo !== 'por_habitaciones' && modo !== 'mixto') continue;
          const ejercicios = c.ejerciciosFiscales ?? {};
          const esXmlAeat = Object.values(ejercicios).some((e: any) => e?.fuente === 'xml_aeat');
          if (!esXmlAeat) continue;

          // NIFs atrapados en el contrato → al bote (recupera H2 para FA32)
          const nifsContrato = [c.inquilino?.dni, ...((c.inquilino as any)?.cotitulares ?? [])]
            .map((n) => (n ?? '').trim())
            .filter((n) => n.length > 0);

          for (const [añoStr, ef] of Object.entries(ejercicios) as Array<[string, any]>) {
            const año = Number(añoStr);
            const importe = Number(ef?.importeDeclarado) || 0;
            if (!año || importe <= 0) continue;
            const dias = Math.min(366, Number(ef?.dias) || 0);
            const ahora = new Date().toISOString();
            const existente = (await botesStore
              .index('inmuebleId-año')
              .get([c.inmuebleId, año])) as BoteAnualSinIdentificar | undefined;

            if (existente) {
              existente.importeDeclarado = round2(existente.importeDeclarado + importe);
              existente.díasDeclarados = Math.min(366, (existente.díasDeclarados || 0) + dias);
              existente.nifsDetectados = Array.from(
                new Set([...(existente.nifsDetectados ?? []), ...nifsContrato]),
              );
              existente.saldoPendiente = round2(existente.importeDeclarado - (existente.importeAsignado || 0));
              existente.estado = estadoBote(existente.importeDeclarado, existente.importeAsignado || 0);
              existente.fechaUltimaModificación = ahora;
              await botesStore.put(existente);
            } else {
              await botesStore.add({
                inmuebleId: c.inmuebleId,
                año,
                importeDeclarado: round2(importe),
                díasDeclarados: dias,
                nifsDetectados: nifsContrato,
                tiposArrendamientoOriginales: [],
                importeAsignado: 0,
                saldoPendiente: round2(importe),
                estado: 'pendiente_total',
                contractsVinculados: [],
                fuente: 'xml_aeat',
                fechaImportación: ahora,
                fechaUltimaModificación: ahora,
              } as BoteAnualSinIdentificar);
            }
          }

          orphanIds.push(c.id);
          await contractsStore.delete(c.id);
        }

        if (orphanIds.length > 0) {
          const idSet = new Set(orphanIds);
          const eventos = (await eventsStore.getAll()) as TreasuryEvent[];
          for (const ev of eventos) {
            if (ev?.id == null) continue;
            if ((ev as any).sourceType === 'contrato' && idSet.has(Number((ev as any).sourceId))) {
              await eventsStore.delete(ev.id);
            }
          }
        }

        await tx.done;
        if (orphanIds.length > 0) {
          console.log(`[DB V78.1] limpieza huérfanos · ${orphanIds.length} Contracts mal ruteados eliminados · importe+NIFs salvados al bote`);
        }
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 limpieza huérfanos] falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy H2) · repoblar nifsDetectados de botes existentes ──
    // Corre DESPUÉS del self-heal de modoExplotacion (lo necesita para acotar a botes de
    // inmuebles por_habitaciones/mixto). Lee la declaración archivada en
    // `ejerciciosFiscalesCoord[año].aeat.declaracionCompleta` y mergea los NIFs que faltaran
    // (Opción B · sin requerir re-import). Idempotente vía flag.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_bote_nifs_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await repoblarNifsBotesDesdeArchivo(db as unknown as IDBPDatabase<any>);
        if (n > 0) console.log(`[DB V78.1] repoblado nifsDetectados en ${n} botes desde la declaración archivada`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 repoblar nifs botes] falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy · Extra 1 LAU 5 años) · recalcular fechaFin de contratos AEAT ──
    // Los contratos habituales importados de AEAT quedaron con fechaFin sentinel (2099). Aplica la
    // prórroga LAU (inicio+5y) SOLO si cae en el futuro y SOLO a contratos con fuente xml_aeat
    // (no toca indefinidos creados a mano). Idempotente vía flag.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_fechafin_lau_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await recalcularFechaFinContratosAEAT(db as unknown as IDBPDatabase<any>);
        if (n > 0) console.log(`[DB V78.1] recalculada fechaFin (LAU +5y) en ${n} contratos AEAT habituales`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 recalcular fechaFin LAU] falló:', err);
      }
      return db;
    });

    // ── REORG Contratos · migración suave de `documentoFirmado` (SIN DB bump) ──
    // Deja el flag documental definido en todos los Contracts existentes: `false`
    // para importados sin firma registrada (sin_firmar / rentila / plantilla_atlas /
    // xml_aeat), `true` para el resto. Idempotente (no pisa valores ya definidos) y
    // gated por flag en keyval.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_documentoFirmado_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await backfillDocumentoFirmado(db as unknown as IDBPDatabase<any>);
        if (n > 0) console.log(`[DB REORG] documentoFirmado backfill · ${n} contratos`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB REORG documentoFirmado backfill] falló:', err);
      }
      return db;
    });

    // ── V81 · TAREA CC · Bloque B.1 · campo único de conciliación ──
    // `estado_conciliacion` (legacy) se retira; la fuente única es `unifiedStatus`.
    // Preserva la señal histórica: si un movimiento estaba conciliado por el campo viejo
    // pero su `unifiedStatus` no lo refleja, lo sube a 'conciliado'. Luego borra la
    // propiedad legacy. Idempotente vía flag en keyval.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v81_conciliacion_unifiedStatus_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const tx = db.transaction(['movements'], 'readwrite');
        const store = tx.objectStore('movements');
        const movs = await store.getAll();
        let migrados = 0;
        for (const m of movs) {
          const legacy = (m as { estado_conciliacion?: string }).estado_conciliacion;
          let cambiado = false;
          if (legacy === 'conciliado' && m.unifiedStatus !== 'conciliado') {
            m.unifiedStatus = 'conciliado';
            cambiado = true;
          }
          if (legacy !== undefined) {
            delete (m as { estado_conciliacion?: string }).estado_conciliacion;
            cambiado = true;
          }
          if (cambiado) {
            await store.put(m);
            migrados += 1;
          }
        }
        await tx.done;
        if (migrados > 0) console.log(`[DB REORG] V81 conciliación · ${migrados} movimientos migrados a unifiedStatus`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB REORG V81 conciliación unifiedStatus] falló:', err);
      }
      return db;
    });

    // ── V82 · TAREA CC · Bloque B · sembrar base amortizable por ejercicio ──
    // Siembra la base de cada año desde su casilla 0130 declarada (origen 'xml') y
    // marca 'conflicto' los años cuyo 0130 difiere del campo único del inmueble
    // (huella de una paralela · caso Carles Buigas 2022: 67.436 vs 57.989). No
    // inventa filas para años sin 0130 (se heredan en lectura). Idempotente vía
    // flag en keyval + guard por (inmueble·ejercicio) dentro de la migración.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v82_base_amortizable_ejercicio_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await migrarBaseAmortizableEjercicio(db);
        if (n > 0) console.log(`[DB V82] base amortizable por ejercicio · ${n} filas sembradas (0130) · conflictos marcados`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V82 base amortizable por ejercicio] falló:', err);
      }
      return db;
    });

    // ── V83 · GASTOS-RECURRENTES · guard del estado `pausado` retirado ──────
    // `EstadoCompromiso` elimina `pausado` (queda activo/preparado/baja). Jose
    // verificó 0 registros en la copia del 26/07, así que no hay nada que
    // migrar. Este guard NO inventa: si encontrara algún compromiso con estado
    // `pausado`, lo deja intacto, lo registra en keyval y avisa fuerte para que
    // se decida a mano (PARA · decisión Jose) en vez de convertirlo a ciegas.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v83_estado_preparado_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const todos = (await db.getAll('compromisosRecurrentes')) as Array<{
          id?: number;
          estado?: string;
        }>;
        const pausados = todos.filter((c) => c.estado === 'pausado');
        if (pausados.length === 0) {
          await db.put('keyval', 'completed', FLAG);
          return db;
        }
        // Hay registros `pausado` inesperados: NO convertir · dejar rastro y
        // avisar. No se marca `completed` para que el aviso persista.
        const ids = pausados.map((c) => c.id).filter((id) => id != null);
        await db.put('keyval', ids, 'migration_v83_pausado_encontrados');
        console.error(
          `[DB V83] ${pausados.length} compromiso(s) con estado 'pausado' (retirado). ` +
            `IDs: ${ids.join(', ')}. NO se han convertido · revisar a mano (activo/preparado/baja).`,
        );
      } catch (err) {
        console.warn('[DB V83 guard estado pausado] falló:', err);
      }
      return db;
    });

    // ── §6.3 · quién cobra, en las previsiones que ya existen ──────────────
    //
    // `TreasuryEvent.proveedor` es nuevo, así que las previsiones ya emitidas
    // no lo llevan: seguirían enseñando la categoría de ATLAS ("Seguro hogar")
    // en vez de quién cobra, y con dos recibos casi idénticos eso no permite
    // saber cuál es cuál. El dato existe —el alta del gasto lo captura— solo
    // que se quedaba en el compromiso.
    //
    // Rellena hacia atrás desde el compromiso de origen. Tres cautelas:
    //
    //  · Solo toca previsiones cuyo `sourceType` es de gasto recurrente: las de
    //    préstamos, contratos y nóminas no tienen proveedor que copiar.
    //  · NO pisa un `proveedor` ya escrito. Si alguien lo corrigió a mano, esa
    //    corrección manda sobre el dato del compromiso.
    //  · Solo escribe los registros que cambian, no los relee todos.
    //
    // Idempotente vía flag; y aunque el flag se perdiera, volver a pasarla no
    // cambiaría nada porque solo rellena huecos.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_proveedor_en_previsiones_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;

        const compromisos = (await db.getAll('compromisosRecurrentes')) as Array<{
          id?: number;
          proveedor?: { nombre?: string };
        }>;
        const nombrePorId = indexarProveedores(compromisos);

        if (nombrePorId.size === 0) {
          await db.put('keyval', 'completed', FLAG);
          return db;
        }

        const tx = db.transaction(['treasuryEvents'], 'readwrite');
        const store = tx.objectStore('treasuryEvents');
        let cursor = await store.openCursor();
        let rellenados = 0;

        while (cursor) {
          const nombre = proveedorParaEvento(cursor.value, nombrePorId);
          if (nombre) {
            await cursor.update({ ...cursor.value, proveedor: nombre });
            rellenados++;
          }
          cursor = await cursor.continue();
        }
        await tx.done;

        if (rellenados > 0) {
          console.log(
            `[DB §6.3] proveedor rellenado en ${rellenados} previsión(es) desde su gasto recurrente`,
          );
        }
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB §6.3 backfill proveedor] falló:', err);
      }
      return db;
    })

    // ── §4.9 · de qué piso es cada cuota de préstamo ────────────────────────
    //
    // El generador nunca copiaba `inmuebleId` al evento, así que la fila de una
    // cuota no podía decir de qué inmueble era por más que se le pasara el
    // resolvedor de alias: no había id que resolver. Ya lo copia, pero solo
    // para los eventos que escriba a partir de ahora — y esa escritura únicamente
    // ocurre al guardar el préstamo. Sin esto, el arreglo no se vería hasta
    // volver a tocar cada préstamo a mano.
    //
    // De PRÉSTAMO y no solo de hipoteca: rellena cualquier evento con
    // `prestamoId` cuyo préstamo tenga destino con inmueble, porque uno
    // personal puede financiar una reforma y esa cuota también quiere decir de
    // qué piso es.
    //
    // Rellena, no corrige: si el evento ya trae inmueble se deja como está.
    .then(async (db) => {
      try {
        // `_v2` · la v1 leía el campo raíz `Prestamo.inmuebleId`, que está
        // `@deprecated` y viene vacío en los préstamos de la ficha actual: se
        // ejecutó, marcó bandera y no rellenó nada. Con el mismo nombre no
        // volvería a correr nunca, así que la bandera sube de versión.
        const FLAG = 'migration_inmueble_en_cuotas_hipoteca_v2';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;

        const prestamos = (await db.getAll('prestamos')) as Array<
          PrestamoConDestinos & { id?: string }
        >;
        // El piso sale de `destinos[]`: el campo raíz está `@deprecated` y en
        // los préstamos creados con la ficha actual viene vacío.
        const inmueblePorPrestamo = new Map<string, number>();
        for (const p of prestamos) {
          if (!p.id) continue;
          const inmueble = inmuebleDelPrestamo(p);
          if (inmueble != null) inmueblePorPrestamo.set(String(p.id), inmueble);
        }
        if (inmueblePorPrestamo.size === 0) {
          await db.put('keyval', 'completed', FLAG);
          return db;
        }

        const tx = db.transaction(['treasuryEvents'], 'readwrite');
        const store = tx.objectStore('treasuryEvents');
        let cursor = await store.openCursor();
        let rellenados = 0;

        while (cursor) {
          const e = cursor.value;
          const inmueble = e.prestamoId ? inmueblePorPrestamo.get(String(e.prestamoId)) : undefined;
          if (inmueble != null && e.inmuebleId == null) {
            await cursor.update({ ...e, inmuebleId: inmueble });
            rellenados++;
          }
          cursor = await cursor.continue();
        }
        await tx.done;

        if (rellenados > 0) {
          console.log(`[DB §4.9] inmueble rellenado en ${rellenados} cuota(s) de préstamo`);
        }
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB §4.9 backfill inmueble en cuotas de préstamo] falló:', err);
      }
      return db;
    })

    // ── §6.3 · de qué piso es cada renta ────────────────────────────────────
    //
    // El mismo hueco que tenían las cuotas de préstamo: el generador no copiaba
    // `inmuebleId` al evento del contrato. Además de dejar la fila sin decir de
    // qué piso cobra, impide lo que de verdad importa en un piso por
    // habitaciones: `punteoAdapter` arma el grupo madre con
    // `inmueble-${inmuebleId}`, así que sin el id cada habitación salía suelta,
    // una detrás de otra, sin que se viera que son el mismo piso.
    //
    // Rellena, no corrige.
    .then(async (db) => {
      try {
        // `_v2` · además del inmueble, la UNIDAD: bajo la madre del piso, "Hab 2"
        // es lo que distingue una fila de otra.
        const FLAG = 'migration_inmueble_en_rentas_v2';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;

        const contratos = (await db.getAll('contracts')) as Array<{
          id?: number;
          inmuebleId?: number;
          unidadTipo?: string;
          habitacionId?: string;
        }>;
        const datosPorContrato = new Map<number, { inmueble: number; unidad?: string }>();
        for (const c of contratos) {
          // `idDeInmueble` filtra el 0 que algunos flujos usan como "aún sin
          // vincular": agruparía rentas bajo una madre que no existe.
          const inmueble = idDeInmueble(c.inmuebleId);
          if (c.id == null || inmueble == null) continue;
          datosPorContrato.set(c.id, {
            inmueble,
            unidad:
              c.unidadTipo === 'habitacion' && c.habitacionId
                ? `Hab ${c.habitacionId}`
                : undefined,
          });
        }
        if (datosPorContrato.size === 0) {
          await db.put('keyval', 'completed', FLAG);
          return db;
        }

        const tx = db.transaction(['treasuryEvents'], 'readwrite');
        const store = tx.objectStore('treasuryEvents');
        let cursor = await store.openCursor();
        let rellenados = 0;

        while (cursor) {
          const e = cursor.value as TreasuryEvent & { contratoId?: number };
          // El contrato viaja en `sourceId` (así lo escribe el generador);
          // `contratoId` solo lo traen algunos, así que se miran los dos.
          const esRenta = e.sourceType === 'contrato' || e.sourceType === 'contract';
          const idContrato = e.contratoId ?? (esRenta ? Number(e.sourceId) : undefined);
          const datos =
            idContrato != null && Number.isFinite(idContrato)
              ? datosPorContrato.get(Number(idContrato))
              : undefined;
          if (esRenta && datos) {
            // Rellena, no corrige · cada campo por separado, que uno ya puesto
            // no tiene por qué implicar el otro.
            const parche: Partial<TreasuryEvent> = {};
            if (e.inmuebleId == null) parche.inmuebleId = datos.inmueble;
            if (e.unidadInmueble == null && datos.unidad) parche.unidadInmueble = datos.unidad;
            if (Object.keys(parche).length > 0) {
              await cursor.update({ ...e, ...parche });
              rellenados++;
            }
          }
          cursor = await cursor.continue();
        }
        await tx.done;

        if (rellenados > 0) {
          console.log(`[DB §6.3 rentas] inmueble/habitación rellenados en ${rellenados} renta(s)`);
        }
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB §6.3 rentas · backfill inmueble/habitación] falló:', err);
      }
      return db;
    });
  return dbPromise;
}
