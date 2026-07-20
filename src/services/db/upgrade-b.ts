// Frente C · troceo de initDB · SEGUNDA mitad del callback `upgrade` (migraciones
// por versión oldVersion<55…75), extraída LITERALMENTE de db.ts. Se ejecuta tras
// applyUpgradeA en el mismo upgrade() (orden preservado).
import type { Escenario } from '../../types/miPlan';
import { ensureIndex } from './ensure-index';
import type { UpgradeDB, UpgradeTx } from './upgrade-a';

export function applyUpgradeB(db: UpgradeDB, oldVersion: number, transaction: UpgradeTx): void | Promise<void> {
        if (oldVersion < 55) {
          if (!db.objectStoreNames.contains('escenarios')) {
            db.createObjectStore('escenarios', { keyPath: 'id' });
          }

          const defaultEscenario = {
            id: 1,
            modoVivienda: 'alquiler',
            gastosVidaLibertadMensual: 2500,
            estrategia: 'hibrido',
            hitos: [],
            rentaPasivaObjetivo: 3000,
            patrimonioNetoObjetivo: 600000,
            cajaMinima: 10000,
            dtiMaximo: 35,
            ltvMaximo: 50,
            yieldMinimaCartera: 8,
            tasaAhorroMinima: 15,
            updatedAt: new Date().toISOString(),
          };

          // Copia de datos objetivos_financieros → escenarios ELIMINADA (bloque 3 ·
          // commit final B). La DB única en v79 ya tiene sus KPIs macro en `escenarios`;
          // una base nueva (oldVersion<55) nunca tuvo `objetivos_financieros`. Se crea el
          // singleton `escenarios` con defaults, que es el único camino que queda.
          transaction.objectStore('escenarios').put(defaultEscenario as unknown as Escenario);
        }

        // ═══════════════════════════════════════════════════
        // V5.6 — Mi Plan v3 · objetivos (lista)
        //   Store nuevo para los 4 tipos de objetivo:
        //   acumular · amortizar · comprar · reducir.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 56) {
          if (!db.objectStoreNames.contains('objetivos')) {
            const objetivosStore = db.createObjectStore('objetivos', { keyPath: 'id' });
            objetivosStore.createIndex('tipo', 'tipo', { unique: false });
            objetivosStore.createIndex('estado', 'estado', { unique: false });
            objetivosStore.createIndex('fondoId', 'fondoId', { unique: false });
            objetivosStore.createIndex('prestamoId', 'prestamoId', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.7 — Mi Plan v3 · fondos_ahorro
        //   Store nuevo para etiquetas de propósito sobre euros de tesorería.
        //   6 tipos: colchon · compra · reforma · impuestos · capricho · custom.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 57) {
          if (!db.objectStoreNames.contains('fondos_ahorro')) {
            const fondosStore = db.createObjectStore('fondos_ahorro', { keyPath: 'id' });
            fondosStore.createIndex('tipo', 'tipo', { unique: false });
            fondosStore.createIndex('activo', 'activo', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.8 — Mi Plan v3 · retos
        //   Store nuevo para retos mensuales.
        //   El índice 'mes' es UNIQUE: fuerza 1 reto por mes.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 58) {
          if (!db.objectStoreNames.contains('retos')) {
            const retosStore = db.createObjectStore('retos', { keyPath: 'id' });
            retosStore.createIndex('mes', 'mes', { unique: true });
            retosStore.createIndex('estado', 'estado', { unique: false });
            retosStore.createIndex('tipo', 'tipo', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.9 — Cierre forzoso de migración V5.5 (objetivos_financieros → escenarios):
        //   ELIMINADO (bloque 3 · commit final B). Solo borraba `objetivos_financieros`
        //   en DBs oldVersion<59 que aún lo tuvieran; la DB única en v79 no lo tiene.
        // ═══════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════
        // V60 — TAREA 7 sub-tarea 1: Schema extensions on surviving stores
        //   Cambios NO destructivos · sólo añade campos opcionales,
        //   índices y backfill no rompedor sobre stores que SOBREVIVEN
        //   en V60. Las eliminaciones de los 19 stores se hacen en
        //   sub-tareas 3-8. El rename `nominas → ingresos` lo cubre
        //   sub-tarea 2 (bloque V61 más abajo).
        //
        //   Stores afectados:
        //     1. arrastresIRPF       · añadir índice 'origen' + backfill
        //                              de 'aeat' para registros existentes.
        //     2. documents           · sólo TS (unión metadata.tipo
        //                              ampliada) · sin cambio runtime.
        //     3. prestamos           · sólo TS (campo opcional
        //                              `liquidacion`) · sin cambio runtime.
        //     4. contracts           · sólo TS (campo opcional
        //                              `historicoRentas[]`) · sin cambio
        //                              runtime.
        //     5. movementLearningRules · sólo TS (campo opcional
        //                              `history[]`) · sin cambio runtime.
        //     6. accounts            · sólo JSDoc sobre `balance`.
        //     7. keyval              · sólo JSDoc sobre claves estándar.
        //     8. valoraciones_historicas · sólo JSDoc · usa índice
        //                              compuesto existente para queries
        //                              mensuales.
        //
        //   Contrato: cualquier registro pre-V60 sigue siendo legible con
        //   el nuevo schema (todos los campos nuevos son opcionales).
        // ═══════════════════════════════════════════════════
        if (oldVersion < 60) {
          // 1. arrastresIRPF · índice 'origen' + backfill 'aeat'
          if (db.objectStoreNames.contains('arrastresIRPF')) {
            const arrastresStore = transaction.objectStore('arrastresIRPF');
            ensureIndex(arrastresStore, 'origen', 'origen', { unique: false });

            // Backfill: cada registro pre-V60 sin `origen` recibe 'aeat'.
            // El `transaction` que entrega idb es un IDBPTransaction · sus
            // cursores se consumen vía promesas (no IDBRequest.onsuccess).
            // Iteramos con while + await cursor.continue() · mismo patrón
            // que la migración V5.4 (opexRules → compromisosRecurrentes).
            arrastresStore.openCursor().then(async function backfillArrastres(cursor) {
              while (cursor) {
                // cursor.value ya es ArrastreIRPF (store tipado); `origen` es
                // opcional, así que los registros pre-V60 lo traen ausente.
                const value = cursor.value;
                if (!value.origen) {
                  await cursor.update({ ...value, origen: 'aeat' });
                }
                cursor = await cursor.continue();
              }
            }).catch((err) => {
              console.warn('[DB V60] backfill arrastresIRPF.origen falló:', err);
            });
          }

          // 2-8. Resto de stores: cambios sólo en TS · IDB es schema-less
          // por registro y trata los nuevos campos opcionales como
          // `undefined` al leer registros pre-V60. No requieren acción
          // en runtime de migración.
        }

        // ═══════════════════════════════════════════════════
        // V61 — TAREA 7 sub-tarea 2: rename `nominas → ingresos`
        //   Crea el store unificado `ingresos` (unión discriminada
        //   `Ingreso = IngresoNomina | IngresoAutonomo | IngresoPension`)
        //   y copia los registros existentes de `nominas` añadiendo
        //   `tipo='nomina'`. Cambio NO destructivo: el store `nominas`
        //   se mantiene intacto · los consumidores siguen usándolo hasta
        //   sub-tarea 6 (cambio de consumidores). `autonomos` y
        //   `pensiones` se absorberán en sub-tareas posteriores con su
        //   propio mapeo de campos a la unión `Ingreso`.
        //
        //   Idempotencia:
        //   - El bloque de creación de stores ya garantiza que `ingresos`
        //     existe antes de entrar aquí.
        //   - El backfill sólo añade registros si `ingresos` está vacío,
        //     evitando duplicados si la migración se ejecutase dos veces
        //     (p.ej. tras una recuperación de error).
        // ═══════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════
        if (oldVersion < 65) {
          // ── V65 (TAREA 13): módulo planes de pensiones ──────────────────────
          // 1. Crear nuevos stores si no existen
          if (!db.objectStoreNames.contains('planesPensiones')) {
            const planesStore = db.createObjectStore('planesPensiones', { keyPath: 'id' });
            planesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
            planesStore.createIndex('tipoAdministrativo', 'tipoAdministrativo', { unique: false });
            planesStore.createIndex('estado', 'estado', { unique: false });
            planesStore.createIndex('titular', 'titular', { unique: false });
          }
          if (!db.objectStoreNames.contains('aportacionesPlan')) {
            const aportacionesStore = db.createObjectStore('aportacionesPlan', { keyPath: 'id' });
            aportacionesStore.createIndex('planId', 'planId', { unique: false });
            aportacionesStore.createIndex('ejercicioFiscal', 'ejercicioFiscal', { unique: false });
            aportacionesStore.createIndex('planId+ejercicioFiscal', ['planId', 'ejercicioFiscal'], { unique: false });
            aportacionesStore.createIndex('origen', 'origen', { unique: false });
            aportacionesStore.createIndex('ingresoIdNomina', 'ingresoIdNomina', { unique: false });
          }
          if (!db.objectStoreNames.contains('traspasosPlanPensiones')) {
            const traspasosNuevoStore = db.createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true });
            traspasosNuevoStore.createIndex('planId', 'planId', { unique: false });
            traspasosNuevoStore.createIndex('fechaEjecucion', 'fechaEjecucion', { unique: false });
          }

          // 2. Migrar datos (async dentro de la transacción)
          return (async () => {
            const genUUID = (): string =>
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2) + Date.now().toString(36);

            const ahora = new Date().toISOString();

            // 2b. Migrar inversiones con tipo='plan_pensiones' o tipo='plan-pensiones'
            if (db.objectStoreNames.contains('inversiones')) {
              try {
                const invStore = transaction.objectStore('inversiones');
                const dstPlanes = transaction.objectStore('planesPensiones');
                const dstAportaciones = transaction.objectStore('aportacionesPlan');
                // Migración V60: los registros almacenados son la forma PRE-V60
                // (campos snake_case legacy: valor_actual, fecha_compra, empresaNif…),
                // que no coinciden con PosicionInversion. Se leen como registros
                // sueltos vía `unknown` intermedio (no es silenciar una incoherencia:
                // el dato histórico realmente no es del tipo actual).
                const rawInversiones: unknown = await invStore.getAll();
                const inversiones = rawInversiones as Array<Record<string, unknown>>;
                const PLAN_TIPOS = new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);
                for (const inv of inversiones) {
                  if (!PLAN_TIPOS.has(String(inv.tipo ?? ''))) continue;
                  const tipoAdm = (inv.empresaNif || inv.entidad?.toString().toLowerCase().includes('emp')) ? 'PPE' : 'PPI';
                  const newId = genUUID();
                  const nuevoPlan: Record<string, unknown> = {
                    id: newId,
                    nombre: inv.nombre ?? 'Plan de pensiones',
                    titular: 'yo' as const,
                    personalDataId: inv.personalDataId ?? 0,
                    tipoAdministrativo: tipoAdm,
                    gestoraActual: String(inv.entidad ?? ''),
                    valorActual: Number(inv.valor_actual ?? 0),
                    fechaContratacion: String(inv.fecha_compra ?? inv.fecha_valoracion ?? ahora.slice(0, 10)),
                    estado: 'activo' as const,
                    origen: 'migrado_v60' as const,
                    fechaCreacion: String(inv.created_at ?? ahora),
                    fechaActualizacion: ahora,
                  };
                  try { await dstPlanes.add(nuevoPlan as any); } catch { /* skip */ }

                  // Migrar aportaciones
                  for (const ap of (inv.aportaciones as any[] ?? [])) {
                    if (!ap.fecha) continue;
                    const añoNum = parseInt(String(ap.fecha).slice(0, 4), 10);
                    const aportacion: Record<string, unknown> = {
                      id: genUUID(),
                      planId: newId,
                      fecha: ap.fecha,
                      ejercicioFiscal: añoNum,
                      importeTitular: Number(ap.importe ?? 0),
                      importeEmpresa: 0,
                      origen: 'migrado_v60' as const,
                      granularidad: 'puntual' as const,
                      fechaCreacion: ahora,
                      fechaActualizacion: ahora,
                    };
                    try { await dstAportaciones.add(aportacion as any); } catch { /* skip */ }
                  }
                  // Eliminar de inversiones
                  try { await invStore.delete(inv.id as number); } catch { /* skip */ }
                }
              } catch (err) {
                console.warn('[DB V65] migración inversiones plan_pensiones→planesPensiones falló:', err);
              }
            }

          })();
        }

        if (oldVersion < 66) {
          // ── V66 (T27.1): wizard nuevo objetivo ──────────────────────────────
          // Solo añade campos OPCIONALES al shape `Objetivo`:
          //   - tipo='acumular' → unidad?: 'eur' | 'meses'
          //   - tipo='comprar'  → metric?: 'valor' | 'unidades'
          // No requiere migración real · IndexedDB no tiene schema rígido para
          // los valores · los registros existentes simplemente carecen del
          // campo · lo lee el código como `undefined` y aplica default 'eur'
          // / 'valor' al renderizar (compatibilidad retroactiva).
        }

        if (oldVersion < 67) {
          // ── V67 (T27.3): wizard nuevo fondo de ahorro ───────────────────────
          // Solo añade campos OPCIONALES al shape `FondoAhorro`:
          //   - objetivoVinculadoId?: string  (vinculación bidireccional con objetivos)
          //   - prioridad?: 'alta' | 'normal' (cascada en computeAcumuladoFondo · default 'normal')
          //   - fechaObjetivo?: string        (caja ritmo en step 3 · ISO YYYY-MM-DD)
          //   - colchonGastoMensual?: number  (reconstruir cálculo meta = meses × gasto en colchón)
          // El campo existente `metaMeses?` se reutiliza como "colchón meses".
          // Sin migración de datos · campos opcionales · IndexedDB sin schema
          // rígido · registros V66 sin campos siguen válidos (default
          // retroactivo · prioridad 'normal' · sin vinculación).
        }

        if (oldVersion < 68) {
          // ── V68 (T38): campo tipoFamilia en compromisosRecurrentes ──────────
          // Añade campo opcional `tipoFamilia?: string` para identificar la
          // familia real del gasto (vivienda · suministros · dia_a_dia ·
          // suscripciones · seguros_cuotas · otros · tributos · comunidad ·
          // seguros · gestion · reparacion).
          // Sin cambios de schema IndexedDB (campo opcional sin índice nuevo).
          // La migración de datos (inferir tipoFamilia para registros
          // existentes) se ejecuta de forma asíncrona POST-upgrade en
          // App.tsx via `runV68TipoFamiliaMigration` (idempotente · keyval).
        }

        if (oldVersion < 70) {
          // ── V70 (PR-C4 · sistémico patrón vs real) ──
          // Añade `historial?: NominaHistorialEntry[]` al patrón Nomina
          // (registros con `tipo='nomina'` en store `ingresos`).
          //
          // Solo bump de version · sin cambio de schema (el campo es
          // opcional sobre el store `ingresos` existente). El backfill
          // de datos lo hace `runV70NominaHistorialMigration` desde
          // `App.tsx` la primera vez que arranca la app tras el upgrade
          // (idempotente vía keyval flag · ver `migrations/v70-nomina-historial.ts`).
        }

        if (oldVersion < 71) {
          // ── V71 (SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 1 hueco 4) ──
          // Marker para upgrades incrementales V70→V71. La creación real del
          // store `deudasFiscales` está en el bloque unconditional al inicio
          // del callback (junto a `vinculosAccesorio`) para que se ejecute
          // también en migraciones acumulativas que toman el camino IIFE de
          // V65 (donde el `return` del IIFE corta la ejecución de bloques
          // posteriores). El store empieza vacío · sin migración de datos
          // (Jose lo poblará manualmente desde la UI F6).
        }

        if (oldVersion < 75) {
          // ── V75 (T-VALORACIONES PR7b · cierre del refactor) ──
          //
          // 1. Pre-purge sync · para cada activo con un valor legacy > 0
          //    (`valor_actual` en `properties`/`inversiones` o `valorActual`
          //    en `planesPensiones`) que NO tenga aún entrada en
          //    `valoracionesActivos`, crea una valoración con today.
          //    Esto cubre el edge case de activos creados después de los
          //    seeds PR4/PR5 que solo poblaron campo legacy.
          //
          // 2. Purga · elimina los campos legacy de cada record:
          //    - properties · valor_actual, valorActual, valorMercado,
          //      currentValue, marketValue, estimatedValue, valuation,
          //      compra.valor_actual, acquisitionCosts.currentValue
          //    - inversiones · valor_actual, valorActual, cotizacion,
          //      precioUnitario
          //    - planesPensiones · valorActual, valorConsolidado, saldoActual
          //
          // Campos fiscales NO se purgan · valorCatastral, valorAdquisicion,
          // precioCompra, valorCompra, tasacion (puede usarse anchor fiscal),
          // acquisitionCosts.price, compra.precio_compra · son datos
          // históricos de adquisición que viven separados del flujo de
          // valoración temporal.
          //
          // Snapshot pre-purge en localStorage para recuperación manual
          // si algo va mal. La transacción versionchange aborta atómicamente
          // si lanza · DB queda en v74 íntegra.

          return (async () => {
            const NEW_STORE = 'valoracionesActivos';
            const today = new Date().toISOString().split('T')[0];

            // ── Snapshot pre-purge ────────────────────────────────────
            try {
              const propertiesSnap = await (transaction as any).objectStore('properties').getAll();
              const inversionesSnap = await (transaction as any).objectStore('inversiones').getAll();
              const planesSnap = await (transaction as any).objectStore('planesPensiones').getAll();
              localStorage.setItem(
                'atlas_db_snapshot_pre_v75',
                JSON.stringify({
                  version: 74,
                  timestamp: new Date().toISOString(),
                  propertiesCount: propertiesSnap.length,
                  inversionesCount: inversionesSnap.length,
                  planesCount: planesSnap.length,
                }),
              );
            } catch (err) {
              console.warn('[DB V75] Snapshot localStorage falló (cuota?):', err);
            }

            // ── 1. Pre-purge sync · crear valoraciones para activos con
            //       valor legacy sin entrada en valoracionesActivos ─────
            const valStore = (transaction as any).objectStore(NEW_STORE);
            const allValoraciones = (await valStore.getAll()) as Array<{
              activoId: string;
              tipoActivo: string;
              deletedAt?: string | null;
            }>;
            const conValoracion = new Set<string>();
            for (const v of allValoraciones) {
              if (v?.deletedAt) continue;
              if (
                v?.tipoActivo === 'inmueble' ||
                v?.tipoActivo === 'inversion' ||
                v?.tipoActivo === 'plan_pensiones' ||
                v?.tipoActivo === 'deposito' ||
                v?.tipoActivo === 'otro'
              ) {
                conValoracion.add(`${String(v.activoId)}|${v.tipoActivo}`);
              }
            }

            const now = new Date().toISOString();
            let syncCreados = 0;

            // properties
            const propStore = (transaction as any).objectStore('properties');
            const propertiesAll = (await propStore.getAll()) as any[];
            for (const p of propertiesAll) {
              if (p?.id == null || p.state !== 'activo') continue;
              const id = String(p.id);
              if (conValoracion.has(`${id}|inmueble`)) continue;
              const valor =
                (typeof p.valor_actual === 'number' && p.valor_actual > 0 && p.valor_actual) ||
                (typeof p.valorActual === 'number' && p.valorActual > 0 && p.valorActual) ||
                (typeof p.currentValue === 'number' && p.currentValue > 0 && p.currentValue) ||
                (typeof p.marketValue === 'number' && p.marketValue > 0 && p.marketValue) ||
                (typeof p.estimatedValue === 'number' && p.estimatedValue > 0 && p.estimatedValue) ||
                (typeof p.valuation === 'number' && p.valuation > 0 && p.valuation) ||
                (typeof p.compra?.valor_actual === 'number' && p.compra.valor_actual > 0 && p.compra.valor_actual) ||
                (typeof p.acquisitionCosts?.currentValue === 'number' && p.acquisitionCosts.currentValue > 0 && p.acquisitionCosts.currentValue) ||
                null;
              if (valor) {
                await valStore.add({
                  activoId: id,
                  tipoActivo: 'inmueble',
                  fecha: today,
                  valor,
                  origen: 'seed_legacy_field_v74',
                  divisaOriginal: 'EUR',
                  notas: `Sync pre-purge v75 · valor rescatado de properties.${id}`,
                  esAnchorFiscal: false,
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                });
                syncCreados++;
              }
            }

            // inversiones · tipoActivo inferido del campo `tipo`
            const TIPO_PLAN_LEGACY = new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);
            const TIPO_DEPOSITO = new Set(['deposito', 'deposito_plazo']);
            const invStore = (transaction as any).objectStore('inversiones');
            const inversionesAll = (await invStore.getAll()) as any[];
            for (const inv of inversionesAll) {
              if (inv?.id == null || inv?.activo === false) continue;
              const id = String(inv.id);
              const tipoCrudo = String(inv.tipo ?? '');
              const tipoActivo: 'plan_pensiones' | 'inversion' | 'deposito' | 'otro' =
                TIPO_PLAN_LEGACY.has(tipoCrudo)
                  ? 'plan_pensiones'
                  : TIPO_DEPOSITO.has(tipoCrudo)
                    ? 'deposito'
                    : tipoCrudo === 'otro'
                      ? 'otro'
                      : 'inversion';
              if (conValoracion.has(`${id}|${tipoActivo}`)) continue;
              const valor =
                (typeof inv.valor_actual === 'number' && inv.valor_actual > 0 && inv.valor_actual) ||
                (typeof inv.valorActual === 'number' && inv.valorActual > 0 && inv.valorActual) ||
                null;
              if (valor) {
                await valStore.add({
                  activoId: id,
                  tipoActivo,
                  fecha: today,
                  valor,
                  origen: 'seed_legacy_field_v74',
                  divisaOriginal: 'EUR',
                  notas: `Sync pre-purge v75 · valor rescatado de inversiones.${id} (tipo "${tipoCrudo}")`,
                  esAnchorFiscal: false,
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                });
                syncCreados++;
              }
            }

            // planesPensiones
            const planStore = (transaction as any).objectStore('planesPensiones');
            const planesAll = (await planStore.getAll()) as any[];
            for (const plan of planesAll) {
              if (plan?.id == null || plan?.estado === 'rescatado_total') continue;
              const id = String(plan.id);
              if (conValoracion.has(`${id}|plan_pensiones`)) continue;
              const valor =
                (typeof plan.valorActual === 'number' && plan.valorActual > 0 && plan.valorActual) ||
                (typeof plan.valorConsolidado === 'number' && plan.valorConsolidado > 0 && plan.valorConsolidado) ||
                null;
              if (valor) {
                await valStore.add({
                  activoId: id,
                  tipoActivo: 'plan_pensiones',
                  fecha: today,
                  valor,
                  origen: 'seed_legacy_field_v74',
                  divisaOriginal: 'EUR',
                  notas: `Sync pre-purge v75 · valor rescatado de planesPensiones.${id}`,
                  esAnchorFiscal: false,
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                });
                syncCreados++;
              }
            }

            // ── 2. Purga · borrar campos legacy de cada store ────────
            const purgar = (record: any, fields: string[], nested?: Record<string, string[]>): { changed: boolean; newRecord: any } => {
              let changed = false;
              const newRecord = { ...record };
              for (const f of fields) {
                if (f in newRecord) {
                  delete newRecord[f];
                  changed = true;
                }
              }
              if (nested) {
                for (const [subKey, subFields] of Object.entries(nested)) {
                  if (newRecord[subKey] && typeof newRecord[subKey] === 'object') {
                    const subCopy = { ...newRecord[subKey] };
                    let subChanged = false;
                    for (const f of subFields) {
                      if (f in subCopy) {
                        delete subCopy[f];
                        subChanged = true;
                      }
                    }
                    if (subChanged) {
                      newRecord[subKey] = subCopy;
                      changed = true;
                    }
                  }
                }
              }
              return { changed, newRecord };
            };

            let purgados = 0;

            // properties · purgar valoración (NO valorCatastral · NO compra.precio_compra · NO acquisitionCosts.price · esos son fiscales)
            for (const p of propertiesAll) {
              const { changed, newRecord } = purgar(
                p,
                ['valor_actual', 'valorActual', 'valorMercado', 'currentValue', 'marketValue', 'estimatedValue', 'valuation'],
                { compra: ['valor_actual'], acquisitionCosts: ['currentValue'] },
              );
              if (changed) {
                await propStore.put(newRecord);
                purgados++;
              }
            }
            // inversiones
            for (const inv of inversionesAll) {
              const { changed, newRecord } = purgar(inv, ['valor_actual', 'valorActual', 'cotizacion', 'precioUnitario']);
              if (changed) {
                await invStore.put(newRecord);
                purgados++;
              }
            }
            // planesPensiones · valorActual purgado · valorConsolidado y saldoActual también
            for (const plan of planesAll) {
              const { changed, newRecord } = purgar(plan, ['valorActual', 'valorConsolidado', 'saldoActual']);
              if (changed) {
                await planStore.put(newRecord);
                purgados++;
              }
            }

            console.log(
              `[DB V75] T-VALORACIONES PR7b · ${syncCreados} valoraciones pre-purge sync · ${purgados} records purgados de campos legacy`,
            );
          })();
        }
}
