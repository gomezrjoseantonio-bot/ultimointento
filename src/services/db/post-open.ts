// Frente C · troceo de initDB · migraciones POST-open (idempotentes, con transacciones
// readwrite normales fuera de la versionchange). Extraídas LITERALMENTE de db.ts; el
// cuerpo de los .then es idéntico. db.ts hace `dbPromise = runPostOpenMigrations(dbPromise)`.
import type { IDBPDatabase } from 'idb';
import type { AtlasHorizonDB } from '../db';
import type { BoteAnualSinIdentificar,Contract,Property,TreasuryEvent } from './types';
import { repoblarNifsBotesDesdeArchivo, recalcularFechaFinContratosAEAT, backfillDocumentoFirmado } from '../alquileresV3FixService';

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
  return dbPromise;
}
