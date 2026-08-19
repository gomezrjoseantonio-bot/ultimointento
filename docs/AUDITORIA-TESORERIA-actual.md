# AUDITORÍA · Módulo Tesorería · foto actual (2026-08-19)

> Informe de solo lectura leído del código vivo. Sustituye, para Tesorería, a los docs de auditoría antiguos (`ATLAS-mapa-stores-VIGENTE.md`, `AUDIT-39-stores-V60.md`, `LAS-40-stores-detalle.md`, `STORES-V60-ACTIVOS.md`), que están en una foto v59–v64 con ~39-40 stores y ya no valen.
>
> Toda afirmación lleva evidencia `archivo:línea`. Lo que no existe se declara con los greps hechos (0 hits o hits irrelevantes).

---

## Preflight

1. **`DB_VERSION = 89`** · `src/services/db.ts:56`. Nombre de BD `AtlasHorizonDB` (`src/services/db.ts:55`). El bump v89 es no-op físico (solo campos opcionales); el último cambio físico real fue V88 (índice `activoId` en `traspasosPlanPensiones`).
2. **Rama y commit auditados:** rama `claude/new-session-hgfunj`, último commit `2bf8084594b35bc0161419c3d6ecc8fcaaabf6c8` (2026-08-19, «fix(import): no colapsar dos cargos idénticos del mismo extracto (#1752)»). Árbol de trabajo limpio en el momento de la auditoría.
3. **Mockup de referencia:** `atlas-tesoreria-v9.html` NO está en el repo ni llegó adjunto a esta tarea; lo más cercano en el repo es `docs/mockups/atlas-tesoreria-v8-completo.html`. La auditoría mapea los elementos enumerados en la propia tarea.

### Stores declarados hoy (45 físicos en v89)

Fuente: `createObjectStore` en `src/services/db/upgrade-a.ts` (41 stores) y `src/services/db/upgrade-b.ts` (4 stores: `escenarios`, `objetivos`, `fondos_ahorro`, `retos`), contrastado con `interface AtlasHorizonDB` (`src/services/db.ts:89-355`, 45 claves, 0 fantasmas) y con `EXPECTED_STORES` del test de estructura (`src/services/__tests__/db.structure.v79.test.ts:19-66`). Único `deleteObjectStore` vivo: `presupuestos` + `presupuestoLineas` en V80 (`upgrade-a.ts:248-256`), no-op en BD fresca.

**⭐ = store de Tesorería** (7 propios).

| # | Store | keyPath | autoInc | Índices | Evidencia (upgrade-a.ts salvo nota) |
|---|---|---|---|---|---|
| 1 ⭐ | `accounts` | `id` | sí | `destination`, `bank`, `isActive` | :185-188 |
| 2 ⭐ | `movements` | `id` | sí | `accountId`, `date`, `status`, `importBatch`, `duplicate-key` (compuesto `[accountId,date,amount,description]`) | :193-199 |
| 3 ⭐ | `importBatches` | `id` | no | `accountId`, `createdAt` | :204-206 |
| 4 ⭐ | `treasuryEvents` | `id` | sí | `type`, `predictedDate`, `accountId`, `status`, `sourceType`, `sourceId`, `año`, `generadoPor`, `certeza`, `ambito`, `inmuebleId` | :211-224 (espejo :227-233) |
| 5 ⭐ | `tarjetas` | `id` | sí | `cuentaLiquidacionId`, `origen`, `activa` | :159-162 |
| 6 ⭐ | `movementLearningRules` | `id` | sí | `learnKey` (**unique**), `categoria`, `ambito`, `createdAt`, `appliedCount` | :264-269 |
| 7 ⭐ | `compromisosRecurrentes` | `id` | sí | `ambito`, `personalDataId`, `inmuebleId`, `tipo`, `categoria`, `cuentaCargo`, `estado`, `fechaInicio` | :536-547 |
| 8 | `properties` | `id` | sí | `alias`, `address` | :17-19 |
| 9 | `property_sales` | `id` | sí | `propertyId`, `saleDate`, `status`, `property-status` | :23-27 |
| 10 | `contracts` | `id` | sí | `propertyId` | :48-49 |
| 11 | `botesAnualesSinIdentificar` | `id` | sí | `inmuebleId`, `inmuebleId-año` (**unique**), `estado` | :67-70 |
| 12 | `propertyDays` | `id` | sí | `propertyId`, `taxYear`, `property-year` (**unique**) | :94-97 |
| 13 | `aeatCarryForwards` | `id` | sí | `propertyId`, `taxYear`, `expirationYear` | :86-89 |
| 14 | `proveedores` | `nif` | no | — | :104 |
| 15 | `gastosInmueble` † | `id` | sí | `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `casillaAEAT`, `origen`, `estado`, `origen-origenId`, `movimientoId`, `treasuryEventId` | :111-125 |
| 16 | `mejorasInmueble` † | `id` | sí | `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `movimientoId`, `treasuryEventId` | :130-139 |
| 17 | `mueblesInmueble` † | `id` | sí | `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `movimientoId`, `treasuryEventId` | :167-176 |
| 18 | `baseAmortizableEjercicio` | `id` | sí | `inmuebleId`, `ejercicio`, `inmueble-ejercicio` (**unique**), `origen` | :146-150 |
| 19 | `vinculosAccesorio` | `id` | sí | `inmueblePrincipalId`, `inmuebleAccesorioId`, `principal-accesorio-ejercicio` (**unique**) | :443-446 |
| 20 | `viviendaHabitual` | `id` | sí | `personalDataId`, `activa`, `vigenciaDesde` | :551-557 |
| 21 | `resultadosEjercicio` | `id` | sí | `ejercicio`, `estadoEjercicio`, `origen`, `ejercicio-estado` | :395-399 |
| 22 | `arrastresIRPF` | `id` | sí | `ejercicioOrigen`, `tipo`, `estado`, `ejercicioCaducidad`, `inmuebleId`, `ejercicioOrigen-tipo` + `origen` (upgrade-b.ts:118) | :404-410 |
| 23 | `perdidasPatrimonialesAhorro` | `id` | sí | `ejercicioOrigen`, `estado`, `ejercicioCaducidad` | :414-417 |
| 24 | `snapshotsDeclaracion` | `id` | sí | `ejercicio`, `origen`, `fechaSnapshot` | :422-425, :503-509 |
| 25 | `entidadesAtribucion` | `id` | sí | `nif`, `tipoRenta` | :429-431 |
| 26 | `ejerciciosFiscalesCoord` | `año` | no | `estado` | :437-438 |
| 27 | `deudasFiscales` | `id` | sí | `modelo`, `ejercicio`, `estado`, `notificada` | :452-459 |
| 28 | `documents` | `id` | sí | `type`, `entityType`, `entityId` | :40-43 |
| 29 | `prestamos` | `id` | no | `inmuebleId`, `tipo`, `createdAt` | :355-358 |
| 30 | `personalData` | `id` | sí | `dni` (**unique**), `fechaActualizacion` | :276-278 |
| 31 | `personalModuleConfig` | `personalDataId` | no | `fechaActualizacion` | :282-283 |
| 32 | `ingresos` | `id` | sí | `personalDataId`, `tipo`, `fechaActualizacion` | :293-296 |
| 33 | `planesPensiones` | `id` | no | `personalDataId`, `tipoAdministrativo`, `estado`, `titular` | :304-308 |
| 34 | `aportacionesPlan` | `id` | no | `planId`, `ejercicioFiscal`, `planId+ejercicioFiscal`, `origen`, `ingresoIdNomina` | :312-317 |
| 35 | `traspasosPlanPensiones` | `id` | sí | `planId`, `fechaEjecucion`, `activoId` (V88) | :321-333 |
| 36 | `inversiones` | `id` | sí | `tipo`, `activo`, `entidad` | :340-343 |
| 37 | `valoracionesActivos` | `id` | sí | `idx_activo`, `idx_activo_fecha`, `idx_tipo`, `idx_fecha`, `idx_anchor_fiscal`, `idx_tipo_subtipo` | :370-379 |
| 38 | `benchmarksReferencia` | `id` | no | `codigo` (**unique**), `tipo`, `ultimaActualizacion` | :471-478 |
| 39 | `escenarios` | `id` | no | — | upgrade-b.ts:11 |
| 40 | `objetivos` | `id` | no | `tipo`, `estado`, `fondoId`, `prestamoId` | upgrade-b.ts:44-48 |
| 41 | `fondos_ahorro` | `id` | no | `tipo`, `activo` | upgrade-b.ts:59-61 |
| 42 | `retos` | `id` | no | `mes` (**unique**), `estado`, `tipo` | upgrade-b.ts:72-75 |
| 43 | `objetivosVitales` | `id` | no | `tipo`, `planFinancieroAsociado`, `fechaEstimada` | :494-499 |
| 44 | `avisosUsuario` | `avisoId` | no | — | :486 |
| 45 | `keyval` | (out-of-line) | no | — | :350 |

† Adyacentes a Tesorería: llevan índices `movimientoId`/`treasuryEventId` para el revert de `treasuryConfirmationService`. `prestamos` también es adyacente (emite `treasuryEvents` previstos). `keyval` es config compartida, pero guarda claves de Tesorería: `cierresDeMes` (§2), `v88_recibo_de_borrado`, flags `migration_v86/v87/v88_*`, `matchingConfig`.

Notas de fragilidad detectadas (informativas, no bloquean):
- `traspasosPlanPensiones` tiene un camino de creación duplicado en `upgrade-b.ts:179-181` **sin** el índice `activoId` (hoy es código muerto porque upgrade-a corre antes).
- `escenarios`/`objetivos`/`fondos_ahorro`/`retos` se crean bajo guards `oldVersion < 55/56/57/58` en vez de `!contains()` (upgrade-b.ts:11-75).
- El bloque `oldVersion < 65` de upgrade-b hace `return` de una IIFE async (upgrade-b.ts:185) que cortocircuita los bloques 66+ en BD fresca — reconocido en código y sin efecto sobre stores (upgrade-a.ts:62-65, upgrade-b.ts:305-313).

---

## 0 · Página/módulo actual de Tesorería

**Rutas** (todas en `src/App.tsx`):

| Ruta | Renderiza | Evidencia |
|---|---|---|
| `/tesoreria` | `TesoreriaV6Page` (lazy, `App.tsx:131`) | `App.tsx:935-939` |
| `/tesoreria/cuenta/:accountId` | la misma página, abre drawer de cuenta | `App.tsx:944-948` |
| `/tesoreria/movimientos` | redirect a `/tesoreria` | `App.tsx:942` |
| `/tesoreria/importar` | redirect a `/tesoreria?extracto=1` | `App.tsx:950` |
| `/tesoreria/importar-cuentas` | `ImportarCuentasPage` | `App.tsx:951-958` |
| `/conciliacion` | redirect a `/tesoreria?extracto=1` (pantalla retirada) | `App.tsx:966` |
| `/bancos-cuentas`, `/cuentas` | redirect a `/tesoreria` | `App.tsx:1394,1395,1504` |

Entrada de menú: `src/config/navigation.ts:60`. Paleta de comandos: `src/components/common/CommandPalette.tsx:64`.

**Componente principal:** `src/modules/tesoreria/v6/TesoreriaV6Page.tsx` (1454 líneas; componente en `:99`). Es deliberadamente **una sola pantalla** — las antiguas `Tesoreria.tsx`, `TesoreriaSupervisionPage.tsx` y `/conciliacion` fueron absorbidas; todo lo demás son drawers sobre la misma página (`App.tsx:127-132, 927-929, 960-965`). No hay pestañas de página; las únicas pestañas reales están dentro de `DrawerCuenta` (`pendientes | confirmados | todo`, `DrawerCuenta.tsx:104,265-336`).

**Árbol de componentes:**

```
TesoreriaV6Page (v6/TesoreriaV6Page.tsx:99)
├─ TesoreriaMovil (rama móvil, :729-778; gated por useEsMovil :108)
├─ Kpi ×4 — héroe (:792-812; def local :1180)
├─ TarjetaCuenta ×N — carrusel cuentas (:890; def :1188) └─ EstadoTarjeta (:1255)
├─ TarjetaMes ×6 — rejilla meses previstos (:1002; def :1271)
├─ BloqueRealidad — «Cómo va {mes}» (:1019; def :1343)
├─ CerrarElMes (:1029)
├─ DrawerCuenta (:1032) · DrawerTarjeta (:1055) · DrawerCalendario (:1084)
├─ FichaMovimiento (:1115) · CuentaWizard (:1140) · TarjetaWizard (:1151)
└─ DrawerExtracto (:1164)
```

**Servicios/hooks que llama la página** (imports `TesoreriaV6Page.tsx:15-74`; sitios de llamada): `initDB` y lectura directa de `accounts`/`treasuryEvents`/`movements`/`properties` (:186-192) · `calculateAccountBalanceAtDate`/`corteParaSaldoVivo` (`accountBalanceService`, :331,:336) · `calcularKpisHero`/`calcularRealidad`/`estadoDeCuenta`/`proyectarMeses` (`tesoreriaV6Metrics`, :351,:356,:361,:893) · `cuentasEnUso` (:304) · `listarTarjetas` (:229) · `regenerarRecibosDeTarjeta` (:182) · `confirmarPieza`/`despuntearPieza`/`descartarPieza` (`puntearPieza`, :674-682) · `gastoDeMovimientos`/`gastoPorTarjeta`/`gastoAbiertoPorTarjeta` (:239-241,:269) · `confirmTreasuryEvent`/`revertTreasuryConfirmation`/`updateTreasuryEventFields` (:433,:472,:521,:640,:645) · `descartarPrevisto` (:499,:601) · `editarTraspasoInterno`/`eliminarTraspasoInterno` (:487,:562) · `altaMovimiento`/`editarMovimiento`/`eliminarMovimiento` (:495,:578,:616) · `batchesEnBorrador`/`sinBorradores` (:194,:202) · diagnósticos de consola (:286-288) · `invalidateCachedStores` (:406).

Dependencias de los hijos: `DrawerCuenta` usa `PunteoList` compartido + `punteoAdapter` + `tesoreriaV6Metrics` (`DrawerCuenta.tsx:28-40`); `DrawerCalendario` usa `calendarioDias` (`construirDias`, `resumirMes`, `saldoAlEmpezarElDia`) (`DrawerCalendario.tsx:21-35`); `DrawerExtracto` usa `bankStatementOrchestrator`, `statementSessionService`, `cierreDeMes`, `extractoSesion` (`DrawerExtracto.tsx:8-51`); `FichaMovimiento` usa el catálogo de conceptos (`FichaMovimiento.tsx:10-29`).

**Código muerto detectado:** `src/modules/tesoreria/components/BankAccountCard.module.css` y `MonthGrid.module.css` son huérfanos (grep repo-wide de `BankAccountCard` y `MonthGrid` en `.ts/.tsx` → 0 referencias; sus `.tsx` ya no existen).

---

## 1 · Store de tarjetas

**EXISTE.** Store `tarjetas` creado en V87: `keyPath: 'id'`, `autoIncrement: true` (`upgrade-a.ts:159`), índices `cuentaLiquidacionId` (:160), `origen` (:161), `activa` (:162), guard `contains()` en :158.

**Interfaz** `Tarjeta` (`src/types/tarjetas.ts:63-91`): `id?` (:64) · `alias` (:65) · `emisora?` texto libre (:71) · `origen: 'banco'|'externa'` (:74, tipo :28) · `modalidad: 'debito'|'credito'` (:75, tipo :20) · `cuentaLiquidacionId: number` **FK a `accounts.id`** (:85) · `ciclo?: CicloTarjeta` solo crédito (:87) · `activa` (:88) · `createdAt`/`updatedAt` (:89-90). `CicloTarjeta` (:38-61): `periodicidad: 'mensual'|'semanal'` (:39), `corte` (día de corte, 31 = último; :46), `diaCargo` (:53), `periodosHastaElCargo` (:60). **No hay** `limiteCredito`/`deudaActual`/`diaCierre` en `Tarjeta` — se retiraron de `Account` en V88 (changelog `db.ts:56`; greps `creditLimit` → 0, `limiteCredito` y `diaCierre` → solo 1 hit cada uno dentro del comentario histórico de `db.ts:56`).

**Servicio CRUD:** `src/services/tarjetasService.ts` — `listarTarjetas()` (:60, `getAll` sin filtrar `activa`), `tarjetasDeLaCuenta(cuentaId)` (:66, usa índice `cuentaLiquidacionId`), `crearTarjeta` (:72), `actualizarTarjeta` (:99), `eliminarTarjeta` (:119, **hard delete sin limpieza referencial**), validador `comprobar()` (:47-58). Reglas puras en `src/services/tarjetasReglas.ts`: `cuentasQuePuedenLiquidar` (:22), `bonificaHipoteca` (:33), `necesitaCiclo` (:49), `corteQueLeToca` (:96), `cuandoSeCobra` (:121). **Único escritor UI:** `TarjetaWizard` (`src/components/tarjeta/TarjetaWizard.tsx:29-33`); la migración V87 escribe directo (`src/services/migrations/v87-tarjetas.ts:89`). Lectores de `listarTarjetas`: `TesoreriaV6Page.tsx:41` (:229), `compromisosRecurrentesService.ts:24`, `recibosDeTarjetaPrevistos.ts:26`, `compromisosConTarjeta.ts:21`, `bonificaciones/movimientosQuePrueban.ts:18`, `PrestamoPageV2.tsx:84`, `ListadoGastos/components/RowForm.tsx:29`.

**Consumo del ciclo (crédito) — EXISTE, derivado, no almacenado.** Pipeline: (1) matemática de ciclo en `tarjetasReglas.corteQueLeToca`/`cuandoSeCobra`; (2) agrupación en recibos `recibosDeTarjeta(tarjeta, compras)` (`src/services/reciboDeTarjeta.ts:54`, shape :33-43); (3) partición previsto/suelto en `previsionDeTarjetas` (`src/services/previsionDeTarjetas.ts:45`; clave estable `tarjeta-<id>-<YYYY-MM-DD>` :86); (4) materialización a `treasuryEvents` con `sourceType:'tarjeta_recibo'` (`src/services/personal/recibosDeTarjetaPrevistos.ts:309,323,402`), orquestada por `regenerarRecibosDeTarjeta()` (`compromisosRecurrentesService.ts:762`, llamada desde `TesoreriaV6Page.tsx:182`); (5) lectura del gasto en `src/services/gastoPorTarjeta.ts`: `gastoPorTarjeta` (:80, regex de clave :50), `gastoAbiertoPorTarjeta` (:189, «llevas X este periodo»), `gastoDeMovimientosCredito` (:225); (6) UI en `TesoreriaV6Page.tsx:239-250,269-272` → `DrawerTarjeta` `totalPeriodo` (:1065) → «Recibo de este periodo» (`DrawerTarjeta.tsx:205`).

**Gastado del mes (débito) — NO EXISTE como agregado mensual.** `gastoDeMovimientos` (`gastoPorTarjeta.ts:134`) emite un periodo POR MOVIMIENTO, siempre `estado:'cerrado'` (:156, justificado en :130-132), y `gastoAbiertoPorTarjeta` solo suma `'abierto'` (:195,:205) → **el consumo de una tarjeta de débito en la página es estructuralmente 0**, y `DrawerTarjeta.periodoActual` devuelve `undefined` para `modalidad !== 'credito'` (`DrawerTarjeta.tsx:91`) → **el drawer de una débito está siempre vacío**. Greps a 0: `gastadoEnElMes`, `consumoDelCiclo`, `consumoCiclo`, `consumoTarjeta`, `gastoDelCiclo`, `cierreCiclo`, `creditLimit`, `"ciclo actual"` (`gastoDelMes` → 2 hits de una variable local sin relación en `src/modules/personal/pages/PanelPage.tsx:233,236`).

**Relación con `accounts`/`movements`:** `Tarjeta.cuentaLiquidacionId` es el único vínculo (la tarjeta no tiene saldo). `Movement.tarjetaId?` (`src/services/db/types-movimientos.ts:133`, declarado por el usuario, nunca importado del extracto :131), `Movement.gastoTarjetaCredito?` (:141, compra de crédito que NO mueve saldo), `TreasuryEvent.tarjetaId?` (:275, solo piezas `sourceType:'gasto_tarjeta'`, que nacen sin `accountId` :273). Exclusiones de saldo: `accountBalanceService.ts:90,109`, `cierreDeMes.ts:75`, `tesoreriaV6Metrics.ts:70`, `conciliacionConfirmados.ts:58`, `DrawerCuenta.tsx:198,217`. Resolución de cuenta pagadora: `cuentasPorMetodoPago.ts:172-178`. Ingesta de extracto de tarjeta (PDF): `personal/extractoTarjeta.ts:107` + `personal/conciliarExtractoTarjeta.ts:40,130,154,219`.

**Migraciones V87/V88 (post-open):** V87 (`post-open.ts:654-668`, flag `migration_v87_tarjetas_v1`) crea una `Tarjeta` de crédito por cada cuenta `TARJETA_CREDITO` viva, con `corte: 31` hardcoded (`v87-tarjetas.ts:81`, dato real nunca almacenado). V88 (`post-open.ts:678-698`, flag `migration_v88_cuentas_tarjeta_v1`) **borra** las cuentas `TARJETA_CREDITO` con sus movimientos, lotes y eventos (`v88-borrarCuentasDeTarjeta.ts:145-187`), conserva las que algo vivo usa (:101-131), desenlaza eventos apuntando a movimientos borrados (:209-230) y deja recibo en `keyval['v88_recibo_de_borrado']` (`post-open.ts:685`).

**UI de tarjetas:** vive entera dentro de Tesorería — no hay ruta `/tarjetas`. Sección «Mis tarjetas» `TesoreriaV6Page.tsx:930-978`; `DrawerTarjeta.tsx` (drawer por tarjeta, KPIs :204-208, pestañas :211-237); `TarjetaWizard.tsx` (alta/edición/baja, componente :94); `PanelExtractoTarjeta.tsx` (extracto de tarjeta en el import); `textoTarjeta.ts:22`; selector en `ListadoGastos/RowForm.tsx:26-29` y en `PrestamoPageV2.tsx:83-85` (bonificación hipoteca); diagnóstico consola `__tarjetaDiagnostico.ts:75,242`.

**Gaps detectados:** G1 débito siempre 0 y drawer vacío (arriba) · G2 índice `activa` sin consultas; solo `cuentasPorMetodoPago.ts:132-134` filtra inactivas; la lista «Mis tarjetas» (:960) pinta inactivas igual · G3 `eliminarTarjeta` no comprueba `movements.tarjetaId`/`treasuryEvents.tarjetaId`/`compromisosRecurrentes.tarjetaId` (`types/compromisosRecurrentes.ts:254`) · G4 identidad del ciclo codificada en clave string leída con regex (`previsionDeTarjetas.ts:87` / `gastoPorTarjeta.ts:50`); los eventos `tarjeta_recibo` no rellenan `TreasuryEvent.tarjetaId` · G5 ciclos migrados por V87 con `corte:31` incorrecto hasta corrección manual · G6 `tarjetasDeLaCuenta` sin llamador de producción.

---

## 2 · Cierre de mes / snapshot de tesorería

**EXISTE, completo y con la semántica exacta del mockup** («lo no confirmado se da por no ocurrido, no se borra, reabrible»). Implementado por decisión de Jose (4-5 ago 2026, citada en cabeceras).

**Servicio:** `src/services/cierreDeMes.ts` (272 líneas, cabecera «Cerrar el mes · VOCABULARIO §6 quater»):
- Registro de meses cerrados: clave `keyval['cierresDeMes']` con `CierreDeMes[]` = `{mes, cerradoAt, descartados: number[]}` (`cierreDeMes.ts:32`; lectura :82-86, escritura :236 y :270). **No hay store dedicado.**
- `estaCerrado(mes)` :89 · `loQueQuedaAbierto(mes)` :118 (vista previa read-only con `totalEntra`/`totalSale`) · `mesesParaCerrar` :100 / `mesesCerrables(hoy, cuantos=6)` :155 · **`cerrarMes(mes, hoy)`** :202 — una transacción readwrite (:213-222) que escribe `{descartado:true, descartadoAt, motivoDescarte:'Cierre de <mes>'}` sobre todo evento aún abierto del mes; rechaza mes en curso/futuro (:204), idempotente (:206-207), re-lectura race-safe (:229-236) · **`reabrirMes(mes)`** :246 — restaura solo los ids que ese cierre descartó, salta los que pasaron a `executed` (:258), borra las tres marcas en vez de ponerlas a false (:262) y elimina el registro (:270).
- Predicado «sigue abierto»: `status !== 'executed' && descartado !== true && sourceType !== 'gasto_tarjeta'` (:70-79).

**UI:** `src/modules/tesoreria/v6/CerrarElMes.tsx` (tira de meses, modal de confirmación con desglose, botón Reabrir), montado en `TesoreriaV6Page.tsx:1029`.

**Consumidores del mes cerrado:** bonificaciones bancarias (`bonificaciones/movimientosQuePrueban.ts:19,60,95` → `verificarBonificaciones.ts:382,414,480`) y el import de extractos: las líneas que caen en mes cerrado se apartan y no se importan (`DrawerExtracto.tsx:25,157,165-166,394-397,738-743`; veredicto `'mes_cerrado'` en `extractoSesion.ts:20,109,179-180,340-347`).

**Base V84:** campos `descartado`/`descartadoAt`/`motivoDescarte` en `TreasuryEvent` (`types-movimientos.ts:287-300`). Escritores por evento: `treasuryDiscardService.ts:20` (`descartarPrevisto`) y :46 (`recuperarPrevisto`), llamados desde `TesoreriaV6Page.tsx:499,601` y `puntearPieza.ts:79`. Escritor masivo: solo `cierreDeMes.ts:215-220`.

**Tests:** `src/services/__tests__/cierreDeMes.test.ts` (~225 líneas: cerrar no borra, reabrir no resucita, descartes manuales sobreviven al reabrir :190-202, cierres concurrentes :130-138, guard de ejecutados :205-212) y `v6/__tests__/CerrarElMes.test.tsx`.

**Greps sin hallazgo tesorería** (case-insensitive en `src/`): `closeMonth`, `monthlyClose`, `monthClose`, `mesCerrado` (singular), `cierre_mes` → 0 · `freeze/frozen/congelar` → 0 · `lock/unlock` → solo iconos Lucide (`design-system/v5/icons.ts:79,190`) · `snapshot` → 93 ficheros, todos fiscales (`snapshotDeclaracionService.ts`, `resultadosEjercicio`) o backup ZIP (`db/snapshot.ts`); `cierreDeMes.ts` no importa nada de ellos. Falso amigo: `mesesCerrados` en `mi-plan/services/presupuestoAnualService.ts:77,843` es del presupuesto anual, no lee `cierresDeMes`.

**Gaps menores:** ventana de cierre limitada a 6 meses atrás desde la UI (`cierreDeMes.ts:100,155`; `CerrarElMes.tsx:57`) · la sección desaparece sin estado vacío (`CerrarElMes.tsx:110`) · errores solo a `console.error` (`CerrarElMes.tsx:61,74,87,102`).

---

## 3 · Saldos y consolidado

**Saldo hoy por cuenta — recalculado en vivo, NO desde `accounts.balance`.** Servicio canónico `src/services/accountBalanceService.ts`:
- `corteParaSaldoVivo(hoy)` :44 — devuelve mañana (el filtro es `< cutoffDate` estricto); existe para que Tesorería y Panel usen el mismo corte.
- `calculateAccountBalanceAtDate({account, cutoffDate, treasuryEvents, movements, incluirRealesFuturos?})` :50 — pura y síncrona. Fórmula (:139): `openingBalance + eventsDelta + movementsDelta`; cuenta eventos `null|'confirmed'|'executed'` (:24) excluyendo `gasto_tarjeta` (:90); movimientos excluyen `gastoTarjetaCredito`, `isOpeningBalance` y los ya conciliados a un evento contado (:98-117), más dedupe difuso por `accountId|date|signedAmount` (:119-134).
- `calculateTotalInitialCash(cutoffDate)` :142 — consolidado async, pero **no** lo usa la UI de Tesorería (lo usan `presupuestoAnualService.ts:491` y `proyeccionMensualService.ts:996`).
- `rollForwardAccountBalancesToMonth(year, month)` :162 — único escritor de `Account.balance` en este fichero (:174-187).

**`Account.balance` es caché derivada** (foto a día 1 del mes), no fuente de verdad. Escritores: `rollForwardAccountBalancesToMonth` (llamado desde `dashboardService.ts:1405` y `treasurySyncService.ts:170`) · el **legacy** `recalculateAccountBalance` (`treasuryEventsService.ts:55-111`, solo movimientos, ignora eventos; llamado en `treasuryEventsService.ts:207,215` y `treasuryConfirmationService.ts:48` fire-and-forget) · `cuentasService.ts:195,452,583` (alta/edición). **Conviven dos implementaciones que no coinciden.** Lectores restantes de la caché: `dashboardService.ts:1312,1435,1523`, `treasuryForecastService.ts:243-244,291`, `treasuryEventsService.ts:169`, `presupuestoAnualService.ts:598`.

**Cómo lo obtiene la pantalla:** `TesoreriaV6Page.tsx:312-327` bucketiza eventos/movimientos por cuenta; :329-348 construye `saldoPorCuenta: Map<accountId, number>` llamando `calculateAccountBalanceAtDate` por cuenta con `cutoffDate: corteParaSaldoVivo(hoy)` e `incluirRealesFuturos: true`; cuentas desde `cuentasEnUso` (`src/services/cuentasEnUso.ts:56`). El **consolidado** es `KpisHero.saldo`, sumado en `tesoreriaV6Metrics.ts:101-102` sobre cuentas `status !== 'DELETED'`, y se pinta en `TesoreriaV6Page.tsx:792-796`. El Panel duplica el mismo pipeline a propósito (`modules/panel/PanelPage.tsx:333-372`; comentario :325-330 «no leer `account.balance`»).

---

## 4 · Previsión del mes (queda entrar / queda salir / cierre)

**Servicio canónico:** `src/services/tesoreriaV6Metrics.ts` (funciones puras, sin BD):
- `esPendiente(e)` :64 — `!descartado && sourceType !== 'gasto_tarjeta' && (status === 'predicted' || status === 'confirmed')`. Ojo: **no** es solo `predicted`; `confirmed` también cuenta como pendiente.
- `importeConSigno(e)` :53 · `esTraspasoInterno(r)` :27 (traspasos internos excluidos de los KPIs, :114) · `rangoDelMes(year, month0)` :40.
- **`calcularKpisHero({cuentas, saldoPorCuenta, eventos, year, month0}): KpisHero`** :91 — el agregador. `KpisHero` :79 = `{saldo, numCuentas, pendienteEntrar, movimientosEntrar, pendienteSalir (negativo), movimientosSalir, cierre, ultimoDia}`. Filtro :109-124: `esPendiente` + no traspaso + `predictedDate` dentro del mes natural completo (**sin** suelo `>= hoy`: lo vencido sin confirmar sigue contando).

**Cierre de mes proyectado:**
- **Consolidado — EXISTE:** `KpisHero.cierre = saldo + pendienteEntrar + pendienteSalir` (`tesoreriaV6Metrics.ts:133`). Encadenado multi-mes: `proyectarMeses({saldoHoy, eventos, year, month0, hoy?, meses=6}): MesProyectado[]` :235 (shape :215-223 `{year, month0, cierre, entra, sale, enCurso}`; encadenado :285).
- **Por cuenta — NO EXISTE como servicio.** Greps a 0: `cierreProyectado`, `projectedClose`, `proyeccionCierre`, `finDeMes`, `monthEndBalance` (`endOfMonth` → solo variables locales `dashboardService.ts:1408,1430,1439`; `saldoFinMes` → solo presupuesto anual de mi-plan; `saldoProyectado` → solo `movilAgrupacion.ts`). Se recalcula inline en 3 sitios con reglas distintas: `DrawerCuenta.tsx:114-126` (`final = saldoHoy + entrar + salir`, **sin** excluir traspasos internos), `movilAgrupacion.ts:83-90` (ídem) y `calendarioDias.resumirMes` (`calendarioDias.ts:222-247`, tampoco excluye traspasos) — **la cabecera del calendario puede discrepar del héroe** cuando hay traspasos en el mes.

**UI que muestra estos KPIs hoy:** héroe desktop `TesoreriaV6Page.tsx:792-812` («Saldo», «Queda entrar», «Queda salir», «Cierre · {mes}») · móvil `TesoreriaMovil.tsx:67-94` · cabecera calendario `DrawerCalendario.tsx:312-330` (:118-121) · cabecera drawer cuenta `DrawerCuenta.tsx:254-257` · rejilla 6 meses `TesoreriaV6Page.tsx:1285-1287` (:355-358) · Panel «Cómo va el mes» `ComoVaElMes.tsx:85-129` alimentado por `PanelPage.tsx:421-451` (mismo `calcularKpisHero`).

**Agregadores legacy paralelos (no los usa la pantalla):** `dashboardService.getTesoreriaPanel()` (`dashboardService.ts:1384-1487`, usa caché `account.balance`; consumidores: `informesDataService.ts:526`, `copilotService.ts:28`) y `treasuryForecastService.getTreasuryProjections` (ver §5).

---

## 5 · Gráfico de 30 días

**NO EXISTE ni la serie diaria ni el gráfico.** Greps: `descubierto` → 0 hits en `src/` (solo docs) · `overdraft` → 0 · `serieDiaria`/`dailySeries` → 0 · `sparkline`/`LineChart`/`AreaChart`/`polyline`/`<svg` bajo `src/modules/tesoreria/` → 0 componentes.

Lo que sí hay, y no es una serie diaria:
- `treasuryForecastService.getTreasuryProjections(days, accountIds?)` (`src/services/treasuryForecastService.ts:199-208`) devuelve **escalares fin-de-horizonte** por cuenta (`{current, projected}` :242-246, más `totalInflow/totalOutflow/netFlow`), filtra `>= hoy` (:215-219) descartando lo vencido, y **ningún componente UI lo importa** (solo `treasuryEventsService.ts:132-168`).
- `proyectarMeses` (`tesoreriaV6Metrics.ts:235-297`) — granularidad **mes**, no día.
- `calendarioDias.construirDias` (`v6/calendarioDias.ts:64-176`) — diario pero de **un mes natural** y su `DiaCalendario` (:18-31) lleva `neto` del día, no saldo acumulado; el acumulador interno por cuenta (:132-161) se tira y solo queda el booleano `dejaCuentaCorta`. `saldoAlEmpezarElDia` (:190-219) es consulta puntual de un día, `null` para pasado.

**Detección de descubierto:** existe con otro nombre y solo hasta fin del mes en curso — `estadoDeCuenta` → `{tipo:'se-queda-corta', minimo, dia}` (`tesoreriaV6Metrics.ts:153-179`): camina los eventos por venir de UNA cuenta acumulando desde `saldoHoy` y devuelve el primer día en que cruza 0 (umbral fijo 0, no `minimumBalance`). **Atribuido a cuenta** porque el llamador pasa los eventos de esa cuenta (`TesoreriaV6Page.tsx:891-900`). En el calendario el flag por día descarta la cuenta (`calendarioDias.ts:133,159`); en móvil `saldoProyectado < 0` sin día (`movilAgrupacion.ts:83-91`). Legacy sin UI: `isAtRisk` (`treasuryEventsService.ts:157-197`, umbral `minimumBalance || 200`).

**Gráficos en el repo:** `chart.js` y `recharts` instalados con exactamente un consumidor cada uno (`AnalisisCartera.tsx:3`, `horizon/proyeccion/base/components/ProjectionChart.tsx:2` — anual, no tesorería). El patrón de la casa para gráficos es SVG a mano (guía §14) + `useChartColors` (`design-system/v5/useChartColors.ts:1-8`).

**Para construirlo:** el bucle acumulador diario por cuenta ya existe dos veces (`tesoreriaV6Metrics.ts:173-179`, `calendarioDias.ts:136-160`) pero ambos descartan la serie; nada está acotado a 30 días rodantes (todo va por mes natural); el punto de partida correcto es el mapa `saldoPorCuenta` de `TesoreriaV6Page.tsx:335-346`.

---

## 6 · Estados por cuenta y confirmación (punteo)

**Estado por cuenta — EXISTE** con vocabulario propio (greps `estadoCuenta`, `por_confirmar`, `alDia` → 0; el canónico es kebab-case):

```ts
// src/services/tesoreriaV6Metrics.ts:140-143
export type EstadoCuenta =
  | { tipo: 'al-dia' }
  | { tipo: 'por-confirmar'; n: number }
  | { tipo: 'se-queda-corta'; minimo: number; dia: string };
```

Derivación en `estadoDeCuenta({saldoHoy, eventos, year, month0, hoy})` (:153-211), prioridad explícita se-queda-corta > por-confirmar > al-dia (:148-152). **Definición de «por confirmar»** (:197-208): `esPendiente(e) && status === 'predicted' && predictedDate <= hoy` (comparación string `YYYY-MM-DD`, hoy inclusive; `confirmed` excluido a propósito :198-203; **sin cota inferior de mes** — un recibo de hace dos meses sin confirmar sigue contando :194-195). Render en `EstadoTarjeta` (`TesoreriaV6Page.tsx:1255-1268`): «se queda en {importe} el {día}» / «{n} por confirmar» / «al día». **Riesgo de deriva:** el Panel re-implementa el predicado inline (`panel/PanelPage.tsx:558-570`, documentado :551-557 como copia que debe coincidir) en vez de llamar al servicio.

**Servicio de confirmación:** `src/services/treasuryConfirmationService.ts` (1464 líneas; modelo en cabecera :1-24: eventos = lo previsto, movimientos = lo confirmado). API: `confirmTreasuryEvent(eventId, overrides?)` :313 · `revertTreasuryConfirmation(movementId)` :603 · `deleteTreasuryEventCompletely` :837 · `updateConfirmedMovement` :912 · adjuntos :1238-1270 · `updateTreasuryEventFields` :1311 · bulk :1375-1433.

**Qué escribe al confirmar** (una transacción, :354): (1) crea `Movement` (`buildMovementPayload` :236-306) con `status:'conciliado'`, `unifiedStatus:'conciliado'`, `source:'manual'`, tags `['treasury_confirmation']` y el back-link **`reference: 'treasury_event:<id>'`** (:283; único enlace que usa el revert :616); lanza si el evento no tiene `accountId` (:257-261); (2) opcionalmente crea/reutiliza línea en `gastosInmueble`/`mejorasInmueble`/`mueblesInmueble` (:366-495); (3) transición **`predicted` → `executed`** (:497-513) con `executedMovementId`, `executedAt`, `actualDate`, `actualAmount`, `movementId`. **Matiz importante:** `'confirmed'` NO es el estado post-punteo — es un tercer estado del enum (`types-movimientos.ts:286`) para lo decidido pendiente de banco (venta, liquidación de préstamo). El revert (:603-763) borra el movimiento, degrada la línea de inmueble a `estadoTesoreria:'predicted'`, revierte el evento a `predicted` y cascada a la pata espejo de un traspaso interno (:735-755).

**Enlace con «Previsión · meses y días»:** el literal no existe en el código (grep → 0); la funcionalidad es el par rejilla de meses → calendario diario. Nivel 1: cards de mes bajo el heading «Movimientos bancarios previstos» (`TesoreriaV6Page.tsx:983-1008`, heading :992, datos de `proyectarMeses` :355-357, click :1005). Nivel 2: `DrawerCalendario.tsx` (grid vía `construirDias` :112-116, resumen vía `resumirMes` :118-121), que **no llama** al servicio de confirmación: renderiza el `PunteoList` compartido (`DrawerCalendario.tsx:23`) sobre items de `punteoAdapter` (:24) y sube callbacks (`onConfirmar`/`onDescartar`/`onConfirmarDia`… :56-84, cableados en `TesoreriaV6Page.tsx:1101-1111`); es la página quien llama `confirmTreasuryEvent` (:433) y `revertTreasuryConfirmation` (:472). Vocabulario compartido: `EstadoPunteo = 'previsto'|'confirmado'|'conciliado'` (`punteo/punteoModel.ts:29`, mapeos :51,:60). Nota de diseño `DrawerCalendario.tsx:14-18`: «En el día NO se concilia» (la conciliación contra extracto es el flujo aparte del §4.7).

---

## 7 · Catálogo Familia→Concepto

**EXISTE como módulo de servicio** (constantes TS + funciones de consulta con overlay de usuario en memoria), no como store ni contexto React:
- Lógica/tipos/consultas: `src/services/conceptos/catalogoConceptos.ts` (341 líneas) · datos puros: `src/services/conceptos/conceptosBase.ts` («Los 60 conceptos del catálogo unificado · SÓLO DATOS», :1; `CONCEPTOS_BASE` :15).
- 13 familias, 60 conceptos, un id por concepto (`catalogoConceptos.ts:12,119`). La pertenencia a un ámbito (`'personal' | 'inmueble'`) es una **proyección** (`Concepto.personal?`/`Concepto.inmueble?`, :96-127) y se deriva, no se declara (:74-78, :278-281). Overlay de usuario (renombrar/ocultar/propios) síncrono en memoria vía `registrarConceptosDeUsuario` (:172-173, :219-239), persistido por `conceptosUsuarioService.ts` (:68,:138,:186,:210) y cargado al arranque en `App.tsx:19,335`.
- Exports clave: `FAMILIAS` :79, `CONCEPTOS` :141, `familiasDeAmbito` :278, `conceptosDe` :284, `proyectar` :297, `conceptoDesdeClasificacion` :329, `conceptoPorId` :249.
- Capas alrededor: persistencia/casilla AEAT en `categoryCatalog.ts` (`:114,:143,:291,:378,:429,:500`; lo fiscal deliberadamente NO está en el catálogo, `catalogoConceptos.ts:27-30`); puente presentación↔persistencia `catalogoPresentacionPersistencia.ts` (`TRADUCCION_INMUEBLE` :57, `TRADUCCION_PERSONAL` :179, `traducirInmueble` :198, `keyPersonalDeFamilia` :224); migración legacy `conceptos/mapaLegacy.ts` (:182,:203).

**Consumidores Tesorería:** `v6/FichaMovimiento.tsx:13-19` (selects Familia :678-695 y Concepto :712; persiste vía `traducirInmueble`/`keyPersonalDeFamilia` :291,:361) · `v6/fichaDesdeItem.ts:11` (camino inverso) · `punteoAdapter.ts:15`, `tesoreriaV6Metrics.ts:20`, `treasuryConfirmationService.ts:32` (lado persistencia). **Consumidores inmueble:** `inmuebles/utils/clasificacionGastoVisual.ts:7,38-39,111-112` · `inmuebles/pages/DetallePage.tsx:670`. **Costura compartida:** `modules/shared/components/ListadoGastos/utils/catalogoTipoGasto.ts:64` («Puente ÚNICO catálogo unificado → árbol de presentación»), consumido en `ListadoGastosRecurrentes.tsx:65-68` con `ambitoCatalogo = mode === 'inmueble' ? 'inmueble' : 'personal'`. Editor de usuario: `ajustes/pages/ConceptosPage.tsx:22-27,105-109`.

---

## 8 · «Cómo va el mes»

**EXISTE dos veces**, con reparto claro:

1. **`ComoVaElMes`** — `src/modules/panel/components/ComoVaElMes.tsx` (143 líneas, export :143). Props (:16-25): `mesNombre`, `hayDatos`, `mes: MesVM`, `flujos: FlujosMes`, `saldoActual`, `onIrTesoreria` (`MesVM` en `panel/components/types.ts:20-36`; `FlujosMes` :84-89). Renderiza 5 celdas (:74-128): **Ha entrado / Queda por entrar / Ha salido / Queda por salir / Saldo a fin de mes** — el eje es ejecutado vs pendiente por lado, no ingresos/gastos/neto (el cierre hace de neto); celda de cierre con guard `saldoFinFiable` (imprime «—» si faltan recurrentes por generar, :107-127). Las 4 celdas de flujo abren `DetalleFlujoModal` (:131-138). **Puramente presentacional**: cero servicios, cero BD, cero routing (:11-14; intención declarada en `PanelPage.tsx:18-20`). Un único punto de montaje: `panel/PanelPage.tsx:62,682-689`. **Reutilizable en Tesorería con matices:** el componente sí; el ensamblado de `mes`/`flujos` (~110 líneas, `PanelPage.tsx:403-514`) está inline en PanelPage y habría que extraerlo; sus números pendientes/cierre ya salen de `calcularKpisHero` (`PanelPage.tsx:422-424`), el mismo motor del héroe de Tesorería, así que no necesitaría fuente nueva; acoplamiento cosmético a tokens del Panel (`ComoVaElMes.tsx:4`).

2. **`BloqueRealidad`** — la versión que Tesorería ya tiene dentro: sección «Cómo va {mes}» en `TesoreriaV6Page.tsx:1007-1020` (componente local :1343), alimentada por `calcularRealidad` (`tesoreriaV6Metrics`, llamada :356) con el eje confirmado vs previsto.

---

## 9 · Componentes UI y diseño reutilizables

**Sistema de diseño:** `src/design-system/v5/` con barrel único `index.ts` («importar desde aquí y NO desde rutas internas»). Relevante para la pantalla: `HeroBanner` (4 variantes `'compact'|'toggle'|'progress'|'chart'`, `HeroBanner.tsx:4`) · `KPIStrip` (2-5 cols, `index.ts:28`) + `KPI` · `CardV5` (+Head/Body/Foot, acentos brand/gold/pos/neg/warn) · `PageHead` · `TabsUnderline` · `Pill` · `MoneyValue` · `DateLabel` · `IconButton` · `EmptyState` · `Toast`/`showToastV5` · `CompositionBar` · `WizardStepper` · `Icons` (Lucide, 1 icono por concepto) · `tokens.css` («Cero hex hardcoded fuera de este archivo», `tokens.css:5`). Showcase vivo: `src/pages/dev/ComponentsShowcase.tsx`.

**No existe** tabla del design system (ni paginación: grep `pageSize|paginat` en `design-system` y `components/common` → 0; el legacy `components/common/DataTable.tsx` es ordenable :27-29 pero sin paginación, tipado `any` y con 1 solo consumidor) **ni** componente de gráfico (solo el puente `useChartColors`, `v5/useChartColors.ts:1-8`; el patrón de la casa es SVG a mano, guía §14 líneas 986-1077). `src/components/common` es legacy pre-v5 con uso casi nulo (`SubTabs` 0, `Tooltip` 0, `DataTable` 1…). Compartidos reales fuera del DS que Tesorería ya usa: `modules/shared/components/Punteo/` (PunteoList/PunteoPiezas) y `modules/shared/components/ListadoGastos/`.

**Guía vinculante — confirmada, con corrección de ruta:** vive en **`docs/audit-inputs/GUIA-DISENO-V5-atlas.md`** (1258 líneas), no en `docs/`. Vinculación explícita: `docs/TAREA-UNICA-TESORERIA-V6.md:7` («checklist sección 17 obligatorio antes del PR») y `docs/HANDOFF-V7-atlas.md:345` («LEER antes de cualquier UI»). Reglas de cabecera: 6 inviolables (§1 líneas 37-44: solo paleta Oxford Gold navy+gold, cero hex hardcoded, IBM Plex Sans + JetBrains Mono, HORIZON/PULSE eliminados, no repetir color en texto, lucide-react); prohibiciones (líneas 46-56: sin emojis, héroe navy con KPIs en pantallas GESTIÓN / blanco en SUPERVISIÓN, `·` como separador); tokens `--atlas-v5-*` (§2.1 líneas 62-130); KPI strip CRÍTICO (§7 líneas 483-534); héroe (§8 líneas 535-615).

**¿La sigue el módulo actual?** — **Cumple tokens, incumple reutilización.** Cero hex hardcoded en los 10 `.tsx` y 7 `.module.css` de `v6/` (verificado por regex); 111 referencias `var(--atlas-v5-*)` solo en `TesoreriaV6Page.module.css`; colores de banco correctamente tokenizados (`bancoColores.ts:1-9`); héroe navy de GESTIÓN correcto (`TesoreriaV6Page.module.css:36-38`). PERO el único import del DS es `Icons` (verificado en los 10 componentes; `TesoreriaV6Page.tsx:17` etc.): re-implementa a mano héroe y KPI strip (`TesoreriaV6Page.module.css:34-118`, re-derivando literalmente las 4 reglas de §7.3: `min-height:92px` :88, `line-height:1.15` :110, `margin-top:auto` :117). El resto de módulos (fiscal, mi-plan, financiación, personal, inmuebles, inversiones) sí usa `PageHead`/`KPIStrip`/`CardV5`/`HeroBanner` (30+ ficheros) — **Tesorería es el outlier**. Deriva latente: dos vocabularios de tinta sobre navy (`--atlas-v5-on-navy-1..7`, `tokens.css:68-74` documentado en guía, vs `--atlas-v5-on-brand*`, `tokens.css:281-286`, que la guía no describe y es el que usa Tesorería).

---

## 10 · Deuda técnica / bugs conocidos

**Recalculación en cascada (sin botón «regenerar») — PARCIAL: 2 de 4 fuentes cableadas.** El doc `docs/DEUDA-cascada-recalculo-previsiones.md` («No. `regenerateMonthForecast()` tenía un solo llamador: el botón») está **desfasado**; estado real:
- ✅ **Compromisos recurrentes** — cascada completa: `regenerarEventosCompromiso` en alta (:97), edición (:130), cambio de estado (:337), reactivación (:389) y barrido (:791) de `compromisosRecurrentesService.ts`; knock-on a recibos de tarjeta si paga con crédito diferido (:745-748).
- ✅ **Préstamos** — cascada, pero la orquestación vive en un componente UI: `PrestamoPageV2.tsx:1567-1574` (`cambiaElCuadro` → `regenerarTreasuryEvents` :1588-1646). `prestamos/previsionesDelPlan.ts:11-16` lo dice explícito: las previsiones de préstamo NO nacen en `treasuryForecastService` (su `regenerateLoansForecast` no lo llama nadie), nacen al guardar en `PrestamoPageV2`.
- ✅ Inversiones (`inversionesTesoreriaSync.ts:32`), onboarding (`onboardingRevealService.ts:24`) y borrado de gasto (`GastosPage.tsx:18`, `DetallePage.tsx:156`) llaman `regenerateForecastsForward`.
- ❌ **Contratos/rentas — SIN disparador.** `NuevoContratoWizard.tsx:151/173/212` y `AnexarSubcontratoForm.tsx:158/171` guardan y paran (grep `Forecast|regener|treasury` en esos wizards → 0); `contractService.ts` solo toca eventos en el borrado en cascada (:243-250,:262-263,:282-295). Las rentas solo se regeneran cuando otra cosa dispara `regenerateForecastsForward` → `generateMonthlyForecasts` rama `'contrato'` (`treasurySyncService.ts:314-361`).
- ❌ **`treasuryForecastService.ts` es código muerto peligroso:** `regenerateMonthForecast` (:715) con 0 llamadores; arrastra un desajuste índice/filtro sin arreglar (`:462` construye por `predictedDate`, `:701` filtra por `actualDate ?? predictedDate`) y riesgo de doble emisor de eventos de préstamo si alguien lo revive (`previsionesDelPlan.ts:11-16`).
- **Botón «regenerar»: no existe.** Grep de botones `Regenerar` en `.tsx` → 1 hit sin relación (`EmailEntrante.tsx:387`, alias de email); `ConciliacionPageV2.tsx` (donde vivía) ya no existe; `/conciliacion` redirige (`App.tsx:966`). Racional en `DEUDA-cascada-recalculo-previsiones.md`: retirarlo «no crea el hueco: lo deja a la vista».

**Bug de duplicación al editar un recurrente — ARREGLADO.** Spec del bug: `docs/TAREA-UNICA-TESORERIA-V6.md:20-45` (§1 FASE 0, criterio de salida :44: «editar diez veces = editar una»). Causa raíz documentada en código (`ListadoGastos/components/ExpenseRow.tsx:114-131` y `RowForm.tsx:314-317`): se encadenaban dos generadores con rangos distintos en un mismo guardado; el barrido global se retiró de ambos caminos de edición. Hoy la regeneración es **delete-then-recreate con clave de idempotencia**, no append: módulo puro `personal/previsionesIdempotencia.ts` (contrato :1-19; clave `sourceType|sourceId|YYYY-MM|accountId` :42-51 con normalización `opex_rule`→`gasto_recurrente` :29-31; intocables `status!=='predicted' || executedMovementId!=null || descartado===true` :59-65); borrado `borrarEventosFuturosCompromiso` (`compromisosRecurrentesService.ts:663-676`); emisión saltando claves ocupadas + dedupe intra-lote (:685-709); orquestación `regenerarEventosCompromiso` (:720-750, «ejecutarlo una vez o cinco deja exactamente el mismo resultado»). Mismo patrón en préstamos (`prestamoEventosPlan.ts:105-129`) y en el barrido global (`treasuryBootstrapService.ts:115,128-165`, que preserva confirmados/ejecutados **y descartados** :139-142). Capa upsert-by-key en `treasurySyncService.insertEvent` (:193-221, guard `isReconciled` :174-178). Excepción deliberada a la clave por mes: `prestamo:<id>:amort:<fecha>` para amortizaciones anticipadas (changelog `db.ts:56` V89). Test de regresión: `compromisosRecurrentesService.idempotencia.test.ts`; idempotencia del bootstrap en `treasuryBootstrapService.test.ts:164-168`. Herramientas de limpieza del residuo histórico (diagnóstico, sin borrar por defecto): `duplicadosPrevisionService.ts` (:1-17,:41-60, cableado a consola en `TesoreriaV6Page.tsx:67`), `__previsionesDuplicadasAudit.ts` (:31-38, dry-run), UI dev `pages/dev/PrevisionesDuplicadas.tsx` (ruta `App.tsx:711`, guard dev :275-277).

---

## Tabla resumen · elemento del mockup → fuente de datos actual

| Elemento del mockup | Fuente de datos hoy | Estado |
|---|---|---|
| Héroe · Saldo hoy consolidado | `calculateAccountBalanceAtDate` por cuenta + suma en `calcularKpisHero` → `KpisHero.saldo` (`tesoreriaV6Metrics.ts:101-102`) | **EXISTE** |
| Héroe · «N cuentas» | `KpisHero.numCuentas` (`tesoreriaV6Metrics.ts:79,101`) | **EXISTE** |
| Héroe · Queda entrar / Queda salir | `KpisHero.pendienteEntrar/pendienteSalir` (`tesoreriaV6Metrics.ts:109-124`) | **EXISTE** |
| Héroe · Cierre agosto (consolidado) | `KpisHero.cierre = saldo + entra − sale` (`tesoreriaV6Metrics.ts:133`) | **EXISTE** |
| Gráfico «Lo que viene · próximos 30 días» (serie diaria consolidada) | Ninguna — no hay serie diaria ni gráfico en Tesorería; acumuladores diarios existen pero descartan la serie (`tesoreriaV6Metrics.ts:173-179`, `calendarioDias.ts:132-161`) | **NO EXISTE** |
| Marcado del día en descubierto en el gráfico | `estadoDeCuenta` da primer día en negativo por cuenta hasta fin de mes (`tesoreriaV6Metrics.ts:153-179`); consolidado por día no existe; la palabra `descubierto` no existe en `src/` | **PARCIAL** |
| Tabla «Mis cuentas» · logo/banco, nº, saldo hoy | Carrusel `TarjetaCuenta` (`TesoreriaV6Page.tsx:845-928`) + `bancoColores.ts`; no es tabla | **PARCIAL** |
| «Mis cuentas» · Queda entrar / Queda salir por cuenta | Solo dentro del drawer (`DrawerCuenta.tsx:114-126`), no en la lista de cuentas | **PARCIAL** |
| «Mis cuentas» · Cierre agosto por cuenta | Sin servicio; 3 cálculos inline con reglas que discrepan en traspasos internos (`DrawerCuenta.tsx:114-126`, `movilAgrupacion.ts:83-90`, `calendarioDias.ts:222-247`) | **PARCIAL** |
| «Mis cuentas» · Estado (al día / por confirmar / descubierto) | `estadoDeCuenta` → `al-dia \| por-confirmar \| se-queda-corta` (`tesoreriaV6Metrics.ts:140-211`) | **EXISTE** |
| «Mis cuentas» · Fila Total | `KpisHero.saldo` en el héroe; sin fila total en la sección de cuentas | **PARCIAL** |
| «Mis cuentas» · Orden por cabecera + paginación | Carrusel con orden manual drag (`ordenCuentas.ts` vía `TesoreriaV6Page.tsx:31,304,393`) y paginado de carrusel; sin tabla ordenable por columnas (ni componente DS de tabla) | **PARCIAL** |
| Mis tarjetas · nombre, tipo | Store `tarjetas` + `listarTarjetas` + sección `TesoreriaV6Page.tsx:930-978` | **EXISTE** |
| Mis tarjetas · consumo crédito (ciclo) | `gastoPorTarjeta.ts` + eventos `tarjeta_recibo` (`gastoAbiertoPorTarjeta` :189) | **EXISTE** |
| Mis tarjetas · consumo débito (gastado en el mes) | Ninguna — sin agregado mensual; débito rinde 0 estructural (`gastoPorTarjeta.ts:134-156,189-205`; `DrawerTarjeta.tsx:91`) | **NO EXISTE** |
| Mis tarjetas · ordenable y paginable | Lista simple sin orden ni paginación (`TesoreriaV6Page.tsx:960-968`) | **NO EXISTE** |
| Cerrar el mes (no confirmado = no ocurrido, no se borra, reabrible) | `cierreDeMes.ts` (:202 `cerrarMes`, :246 `reabrirMes`) + `CerrarElMes.tsx`, keyval `cierresDeMes` | **EXISTE** |
| Cómo va agosto (confirmado vs previsto) | `BloqueRealidad` + `calcularRealidad` en la propia página (`TesoreriaV6Page.tsx:1007-1020`); variante Panel `ComoVaElMes.tsx` | **EXISTE** |

---

## Decisiones que faltan por cerrar con Jose antes de implementar

1. **Consumo de débito:** definir el agregado («gastado en el mes» = ¿suma de `movements` con `tarjetaId` de esa tarjeta en el mes natural?) — hoy no existe función ni dato, y el drawer de débito está vacío por diseño (`DrawerTarjeta.tsx:91`).
2. **Serie diaria de 30 días:** construir el servicio nuevo (no hay nada reutilizable tal cual). Decidir: ¿30 días rodantes o mes natural?, ¿umbral de descubierto 0 fijo o `minimumBalance`?, ¿el día en descubierto se atribuye a la primera cuenta que cruza 0 (como `estadoDeCuenta`) o al consolidado?
3. **Cierre por cuenta:** ¿se promociona a `tesoreriaV6Metrics` una función única de cierre proyectado por cuenta? Hoy hay 3 cálculos inline que discrepan en si excluyen traspasos internos — hay que decidir la regla canónica (el héroe los excluye; drawer/calendario/móvil no).
4. **Tabla «Mis cuentas»:** no existe componente de tabla ordenable/paginable en el design system — decidir si se crea uno en `design-system/v5` o la tabla es local al módulo. Ídem para el gráfico (patrón de la casa: SVG a mano + `useChartColors`; los dos chart libs instalados tienen 1 consumidor cada uno).
5. **Adopción del design system:** la pantalla actual es token-compliant pero re-implementa a mano héroe/KPIs/cards; ¿el rediseño migra a `HeroBanner`/`KPIStrip`/`CardV5`/`Pill`/`MoneyValue` (como el resto de módulos) o mantiene CSS propio? Además, unificar los dos vocabularios de tinta sobre navy (`--atlas-v5-on-navy-*` vs `--atlas-v5-on-brand*`).
6. **Cascada de contratos/rentas:** el hueco vivo del motor — alta/edición de contrato no regenera previsiones de renta. ¿Entra en el alcance del rediseño o es tarea aparte?
7. **`treasuryForecastService.ts` muerto:** decidir retirarlo (o al menos su mitad `regenerate*`) antes de que el rediseño lo revigorice por error (riesgo documentado de doble emisor en `previsionesDelPlan.ts:11-16`).
8. **Tarjetas · datos incompletos:** ciclos migrados por V87 con `corte:31` inventado; `eliminarTarjeta` sin limpieza referencial; campo `activa` sin efecto en la UI. Decidir si el rediseño exige sanear esto primero.
9. **Semántica «por confirmar» en la tabla de cuentas:** hoy no tiene cota inferior (cuenta atrasos de meses anteriores) y excluye `status:'confirmed'`; confirmar que es la definición deseada para el chip de estado del mockup.
10. **Mockup v9:** subir `atlas-tesoreria-v9.html` al repo (solo está v8 en `docs/mockups/` y `docs/audit-inputs/`) para que el spec del rediseño referencie la versión correcta.
