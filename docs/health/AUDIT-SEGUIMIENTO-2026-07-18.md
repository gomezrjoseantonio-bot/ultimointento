# SEGUIMIENTO auditoría · servicios_muertos · kpis · SVG · CCAA

> Cuatro encargos de Jose tras la auditoría de puntos ciegos. Mide/verifica, no arregla.

## 1 · servicios_muertos · verificación individual · **cero falsos muertos**

Jose autorizó estrechar (mejorar detección) suponiendo ~3 falsos muertos (mi 33 > el 30 manual de la auditoría). **La verificación individual demuestra que no hay ninguno**: el 33 es correcto y el 30 de la auditoría fue un **infra-conteo**.

**Detección endurecida**: se añadió `require(` al patrón de importadores. No cambia el número (nadie usa `require` sobre estos servicios).

**Los 6 que mencionan el basename → solo comentarios/doc-strings (no imports):**

| servicio | referencias | veredicto |
|---|---|---|
| budgetMatchingService | `__keyvalAudit.ts:62` (`reason:` string), `db.ts:2404-2405` (JSDoc `→ Dueño/Lectores`) | muerto |
| fiscalLifecycleService | `declaracionResolverService.ts:18`, `perdidasPatrimonialesService.ts:2`, `ejercicioFiscalService.ts:9` — todos `//` | muerto |
| fiscalYearLifecycleService | `ejercicioFiscalService.ts:9` (`//`) | muerto |
| loanInterestService | `ListadoPage.tsx:185` (`//`) | muerto |
| loanService | `historicalCashflowCalculator.ts:52,131` (`//` "formato antiguo") | muerto |
| transferDetectionService | `__keyvalAudit.ts:62`, `db.ts:2405` (doc) | muerto |

**Los 3 que la auditoría no listaba → 0 referencias (archivos reales):**

| servicio | tamaño | referencias |
|---|---|---|
| documentValidationService | 10 KB | 0 |
| documentaiClient | 8 KB | 0 |
| unicornioInboxProcessor | 28 KB | 0 |

**Conclusión**: los 33 están verificados como **muertos de verdad y seguros de borrar en el bloque 3**. **NO se registra recalibración** — no hubo estrechamiento real (no había falsos muertos que quitar; la premisa "33>30 ⇒ falsos muertos" era incorrecta, el 30 infra-contaba). La precisión que pedías está: ninguno de los 33 es código vivo.

## 2 · kpis_hardcoded · NO ampliado · limitación documentada

Confirmado: el peor caso — un número clavado en una tarjeta **sin** `TODO` (`1.284 €` inventado, sin origen en props/estado) — es invisible y **no mecanizable limpio** (buscar literales de importe/porcentaje = ruido enorme: fechas, cálculos, IDs, ejemplos). **No se amplía.** Queda documentado en el docstring del indicador como **limitación conocida**; se resolverá por **revisión manual de las tarjetas KPI dentro del rediseño del Panel**. El `9` mide solo los placeholders con `TODO`.

## 3 · SVG inline · **DESCARTADO por ruidoso** (mismo criterio que componentes_muertos)

Hay **27 `<svg>` inline** en `.tsx`. El conjunto es genuinamente **mixto** y no distinguible con fiabilidad mecánica:

- **Iconos** (deberían ser Lucide): `EmptyPage` (20×20 `fill=currentColor`), spinner de `ConfirmationModal` (`animate-spin h-4`), `PortfolioMap` (pin 22×30), `FichaShell` (rect/circle/polyline), marcadores de leyenda `FichaPlanPensiones:1031,1035` (`20×3 line`), `BloqueHitos/Benchmark` (14×14).
- **Gráficas / ilustraciones** (SVG inline legítimo, NO son iconos): `SparklineGigante`, `PanelPage` (donut 160×160 `role=img`), `FichaRendimientoPeriodico` (`chartSvg`), `TabAnalisis` (`className=chart`), `BloqueProyeccion`, `RevealScreen` (600×240), `ComponentsShowcase` (1200×320).

No hay señal mecánica fiable (ni viewBox, ni className, ni nº de paths) que separe icono de gráfica sin falsos positivos/negativos relevantes. **No se añade check** — un indicador ruidoso enseña a ignorar los números (tu criterio en `componentes_muertos`, aplicado aquí). Los 27 quedan como **lista de revisión manual del bloque de diseño**; los que sean iconos deberían migrar a Lucide.

## 4 · CCAA · inventario (tabla · sin arreglar nada)

**El número real de escalas autonómicas sin verificar es 18** — y aquí el grep coincide con la realidad (no hay escalas que omitan el flag).

| archivo | verified:true | verified:false | ¿tiene flag? |
|---|---:|---:|---|
| _base_estatal | 1 | 0 | sí |
| andalucia | 1 | 1 | sí |
| aragon | 1 | 1 | sí |
| asturias | 1 | 1 | sí |
| baleares | 1 | 1 | sí |
| canarias | 0 | 2 | sí |
| cantabria | 0 | 2 | sí |
| castilla_la_mancha | 1 | 1 | sí |
| castilla_y_leon | 1 | 1 | sí |
| cataluna | 1 | 1 | sí |
| extremadura | 1 | 1 | sí |
| galicia | 1 | 1 | sí |
| la_rioja | 0 | 2 | sí |
| madrid | 2 | 1 | sí |
| murcia | 1 | 1 | sí |
| valencia | 2 | 1 | sí |
| **TOTAL** | **15** | **18** | **0 sin flag** |

- **16 archivos** de escala (+ `_base_estatal`), **33 entradas de escala** en total.
- **15 verificadas** (`verified: true`) · **18 sin verificar** (`verified: false`) · **0 sin flag**.
- El peor caso que temías (una escala que **omita** el flag → invisible) **no ocurre**: todas las escalas inspeccionadas declaran `verified`. Por eso el `18` del indicador **es el número real**, no una cota.
- Las 3 CCAA con **ninguna** escala verificada: **Canarias, Cantabria, La Rioja** (2 escalas `false` cada una) — candidatas prioritarias para auditar en el bloque fiscal.

## Cambios de código en esta tanda
- `scripts/health.mjs`: `serviciosMuertos` endurece detección con `require(` (número igual, 33) + docstring con la verificación. `kpisHardcoded` docstring con la limitación conocida. **Ningún indicador cambia de valor · sin recalibraciones · `src/` intacto.**
