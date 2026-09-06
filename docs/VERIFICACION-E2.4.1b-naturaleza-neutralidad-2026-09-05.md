# VERIFICACIÓN · E2.4.1b · NATURALEZA Y NEUTRALIDAD · un solo vocabulario de «qué es este dinero»

**Fecha:** 2026-09-05 · **Base:** `main` @ `4b02841` (tras #1861) · **DB_VERSION:** 92 → **93** ·
**Rama:** `claude/audit-categories-types-scopes-p5966s` · Decisiones de Jose (5 sep 2026) aplicadas.

Objetivo: que `Movement` y `TreasuryEvent` lleven la **naturaleza** del catálogo único (eje 1) y que la
neutralidad de un traspaso, una aportación o una fianza se diga UNA vez (`movimiento_interno`), retirando los tres
vocabularios que la codificaban (`Movement.type`, `TreasuryEvent.type`, `categoryKey` `traspaso_*`).

**Cómo leer las marcas:** VERIFICADO = leído/ejecutado · DEDUCIDO = inferido por grep.

---

## 0 · Lo esencial en diez líneas

1. **`Movement.type`** (`Ingreso | Gasto | Transferencia | Ajuste`) y **`TreasuryEvent.type`** (`income | expense |
   financing`) **desaparecen**. Las dos entidades llevan `naturaleza: Naturaleza` y, como eje 2, `familia?` y
   `subtipo?` del catálogo. `MovementType` de `categoryCatalog.ts` desaparece también (el modal de alta tiene su
   `TipoAlta`, que es un flujo de pantalla, no un vocabulario de dominio).
2. **`financing` se reparte según la decisión:** la cuota, la amortización anticipada y la cancelación de un préstamo
   son `gasto · prestamo_hipoteca` (cargo entero; interés/capital los da el cuadro). La disposición es
   `movimiento_interno · disposicion_prestamo` (entra) — hoy ningún generador la emite.
3. **Neutralidad = naturaleza.** `TRANSFER_KEYS`/`isTransferKey` retirados de `categoryCatalog.ts`; las dos patas de
   un traspaso son `movimiento_interno · traspaso`. Un previsto interno lleva `sentido: 'sale' | 'entra'` (su
   `amount` es magnitud); en el movimiento lo dice el signo. `sentidoDe()` / `conSigno()` en el catálogo son el
   ÚNICO sitio donde se decide el signo — sustituyen a ~12 ternarios `type === 'income' ? +x : -x` repartidos.
4. **Un solo origen → clasificación:** `catalogo/clasificacionDeOrigen.ts` dice qué naturaleza/familia/subtipo le
   toca a un previsto por su `sourceType` (nómina → `ingreso · nomina`, contrato → `ingreso · alquiler`, hipoteca →
   `gasto · prestamo_hipoteca`, inversión → `movimiento_interno · aportacion`, IRPF → `gasto · impuestos_tasas`…).
   `treasurySyncService` lo esparce en sus 18 escrituras en vez de escribir `type` a mano.
5. **Aportaciones a planes/fondos e inversiones pasan a movimiento interno** (`FichaPlanPensiones`,
   `treasurySyncService` `inversion_compra` / `inversion_aportacion`). Es lo que dice el DEFINITIVO; antes contaban
   como gasto. Cambio de comportamiento en «cuánto gasté» · señalado en §3.
6. **DB_VERSION 93:** `treasuryEvents` retira el índice físico `type` y gana `naturaleza` (`upgrade-a.ts`, guard
   `oldVersion < 93` para bases existentes + creación en bases nuevas). `movements` no tenía índice sobre `type`.
   Regla A: sin migración de datos.
7. **Transferencia EXTERNA** ya no es un «tipo»: es ingreso/gasto por el signo con `paymentMethod: 'transferencia'`
   (`altaMovimientoService`, `punteoAdapter.origenDeMovimiento`).
8. Test nuevo `catalogo/__tests__/naturalezaYNeutralidad.test.ts`: un interno NO cuenta en KPIs de gasto/ingreso ni
   en «pagado real» pero SÍ mueve el saldo de la cuenta; la cuota de préstamo es `gasto · prestamo_hipoteca`.
9. `tsc` limpio · trinquete local `todos_totales` 230 (= `main`) · `test:deadcode` OK · suite vs baseline en §4.
10. Queda para **E2.4.1c**: los árboles A/C/D/E y sus traductores, la bolsa 50/30/20 fuera, los 4 ejes en
    `CompromisoRecurrente` y `GastoInmueble`, la lente fiscal. `categoryKey`/`subtypeKey`/`conceptoId`/`categoria`
    siguen en las entidades hasta entonces (son el árbol A/C, no la naturaleza).

---

## 1 · Qué cambia en las entidades (VERIFICADO)

| Entidad | Antes | Ahora |
|---|---|---|
| `Movement` | `type: 'Ingreso' \| 'Gasto' \| 'Transferencia' \| 'Ajuste'` | `naturaleza: Naturaleza` · `familia?: FamiliaId` · `subtipo?: string` · dirección = signo de `amount` |
| `TreasuryEvent` | `type: 'income' \| 'expense' \| 'financing'` (indexado) | `naturaleza` · `sentido?: 'entra' \| 'sale'` (solo interno) · `familia?` · `subtipo?` · índice `naturaleza` |
| `SuggestionAction.create_treasury_event` | `type: TreasuryEvent['type']` | `naturaleza: Naturaleza` |
| `categoryCatalog.ts` | `MovementType`, `TRANSFER_KEYS`, `isTransferKey` | retirados · `CategoryDef.tipo: Exclude<Naturaleza,'movimiento_interno'>` |
| `catalogoUnico.ts` | — | `Sentido`, `esNaturaleza`, `sentidoDe`, `conSigno` |
| `catalogo/clasificacionDeOrigen.ts` | — | tabla `sourceType → {naturaleza, sentido?, familia?, subtipo?}` |

## 2 · Preflight · lo que se repuntó (grep real · VERIFICADO)

| Qué | Prod | Test | Cómo |
|---|---|---|---|
| Escritores de `TreasuryEvent.type` | 43 líneas · 18 ficheros | 69 ficheros | `treasurySyncService` ×18 → `...clasificacionDeOrigen(sourceType)`; el resto a mano (venta → `ingreso · venta · inmueble`, IRPF → `impuestos_tasas`, traspaso → interno + sentido) |
| Lectores de `TreasuryEvent.type` | ~60 líneas · 30 ficheros | 11 líneas | agregados de ingreso → `naturaleza === 'ingreso'`; de gasto (`expense \|\| financing`) → `naturaleza === 'gasto'`; signo → `conSigno`/`sentidoDe`; `financing` como marca de préstamo → `familia === 'prestamo_hipoteca'` (`extractoSesion:530`, `propertySaleService:1411`) |
| Escritores de `Movement.type` | 10 líneas · 8 ficheros | 22 ficheros | `naturalezaPorSigno(importe)`; traspaso → interno + `familia: 'traspaso'`; cancelación de préstamo → `gasto · prestamo_hipoteca` |
| Lectores de `Movement.type` | 3 (`punteoAdapter`) | — | naturaleza + `paymentMethod === 'transferencia'` para la externa |
| `TRANSFER_KEYS` / `isTransferKey` | 15 usos · 10 ficheros | 6 ficheros | `naturaleza === 'movimiento_interno'` (+ `familia === 'traspaso'` donde importa el par) · dirección por `sentido`/signo |
| `MovementType` (catálogo A) | 3 ficheros | 0 | `TipoAlta` local en `AddMovementModal`; `getCategoriesForModal(naturaleza)` |
| Índice `treasuryEvents.type` | `db.ts:110` · `upgrade-a.ts:256` · tests de estructura v79/v92 | — | V93 |

Lo que **no** se toca en 1b (es 1c): `categoryKey`, `subtypeKey`, `conceptoId`, `categoryLabel`, `categoria`,
`category{tipo,subtipo}`, `tipoFamilia`, `bolsaPresupuesto`, `MovementLearningRule.categoria` (una regla de traspaso
guarda ahora `categoria: 'traspaso'` en vez de `traspaso_salida`).

## 3 · Cambios de comportamiento (VERIFICADO · para que nadie los descubra por sorpresa)

- **Aportaciones e inversiones dejan de ser gasto.** `inversion_compra` → `movimiento_interno · aportacion ·
  inversion`; `inversion_aportacion` → `… · fondo`; la aportación a plan de pensiones (`FichaPlanPensiones`) →
  `… · plan_pensiones`. Salen del «cuánto gasté» y de los KPIs de pendiente salir; siguen moviendo el saldo.
- **Liquidaciones de inversión** → `ingreso · venta` (naturaleza como antes; ahora con familia).
- **La cuota de préstamo sigue contando como gasto** (antes `financing` ya sumaba en gasto en `dashboardService`,
  `PanelPage`, `movementMatchingService`): sin cambio de cifra, sí de vocabulario. La amortización anticipada y la
  cancelación también son `gasto · prestamo_hipoteca` (decisión: cargo entero; el cuadro sabe que es capital).
- **Cierre de mes / previsión por cuenta** (`cierreDeMes`, `treasuryForecastService`) miran el **sentido** (entra/sale):
  un traspaso interno sigue contando como dinero que entra o sale de ESA cuenta, que es lo que esas vistas miden.
- **`signMatchesType`** (emparejador): un previsto de préstamo ya no «vale para los dos signos»; su sentido lo fija la
  naturaleza. La disposición (entra) tendrá sentido propio cuando exista un generador.

## 4 · Verificación

- `tsc --noEmit`: limpio.
- Trinquete local (`node scripts/health.mjs`): `todos_totales` 230 = `main` · `servicios_muertos` 0 · `test:deadcode` OK.
- Suite completa vs baseline de `main` (28 suites / 108 tests en rojo, pre-existentes): **28 / 108 · la misma lista
  exacta de tests** (diff vacío en los dos sentidos) · 6.624 verdes (+16 tests nuevos/actualizados).
- **Lectores tipados `any` que `tsc` no podía ver** y se cazaron a grep: `dashboardService.ts` (8 filtros
  `event.type`), `fiscalConciliationService.ts:412`, `estimacionFiscalEnCursoService.ts:97`. Sin ese grep, el
  dashboard habría quedado a cero en silencio. Es un argumento más para retirar los `as any[]` en 1c.
- Tests nuevos: `catalogo/__tests__/naturalezaYNeutralidad.test.ts` (6) sobre `calcularKpisHero`, `calcularRealidad`,
  `calculateAccountBalanceAtDate`, `clasificacionDeOrigen`, `sentidoDe`/`conSigno`.
- Greps a cero en `src/`: `MovementType` · `TRANSFER_KEYS` · `isTransferKey` · `type: 'income'|'expense'|'financing'` ·
  `type: 'Ingreso'|'Gasto'|'Transferencia'|'Ajuste'` · `traspaso_salida`/`traspaso_entrada` (queda el `fuente` de
  `types/personal.ts:492`, que es una etiqueta de procedencia, no una categoría).

## 5 · DB_VERSION

92 → **93**. `treasuryEvents`: `deleteIndex('type')` bajo guard `indexNames.contains` + `ensureIndex('naturaleza')`
para bases existentes; `createIndex('naturaleza')` en bases nuevas. Sin post-open, sin migración de datos (Regla A:
los registros con `type` viejo se recargan de cero). Tests de estructura (`db.structure.v79`, `dbV92DuplicateKey`)
actualizados al esquema v93.
