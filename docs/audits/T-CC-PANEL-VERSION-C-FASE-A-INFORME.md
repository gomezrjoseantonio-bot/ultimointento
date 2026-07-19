# T-CC-PANEL · versión C · FASE A · Verificación de fuentes de datos

> **Tarea** · `TAREA-CC-PANEL-VERSION-C.md` · referencia visual `atlas-panel-v3-version-c.html`
> **Alcance de esta entrega** · FASE A · **cero código** · solo informe · STOP
> **Método** · para cada dato del mockup: (1) **existe** y de dónde sale · (2) **calculable** con qué fórmula · (3) **no existe** y qué haría falta · todo con `path:línea`
> **Panel actual de referencia** · `src/modules/panel/PanelPage.tsx` (v5) — ya cablea la mayoría de estas fuentes

---

## 0 · Resumen ejecutivo

- **La mitad "curva" del héroe está confirmada como NO IMPLEMENTABLE hoy.** La curva de patrimonio neto proyectado a 20 años y su punto de libertad dependen del **motor C-PROY-5**, que **no existe** (`docs/audits/T-PROYECCION-AUDIT-INFORME.md:696,718` · estado 🟡 "motor 1 año cubierto · 19 años faltan" · L 16-24 h). Debe ir a **estado vacío** (FASE C).
- **El *año* de libertad (el "2041") sí existe** vía `libertadService` — pero es proyección de **cobertura de renta pasiva**, no de patrimonio. No sirve para dibujar la curva de patrimonio.
- **La variación a 12 meses del patrimonio no existe y no es reconstruible con honestidad** (se eliminaron los snapshots históricos en V62; no hay histórico de saldos de cuentas ni de deuda viva). → estado vacío.
- **"Cómo va el mes" es implementable** con el split real cobrado/pendiente vía `TreasuryEvent.status`, salvo el **saldo a fin de mes real** (solo hay aproximación).
- **"Puedes estar tranquilo"**: 2 de 4 con fuente sólida (colchón, impuesto acumulado); **"sin cobrar" es calculable pero no existe hoy**; **"próximos 30 días" solo cubre contratos** — seguros e IBI/calendario fiscal general **no existen**.
- **Las 4 acciones rápidas tienen destino real.**
- Hallazgos colaterales relevantes (bug de signo, formula del colchón, default 2500, rampa on-navy inexistente) en §5 "Para la lista".

Leyenda: 🟢 existe · 🟡 calculable / parcial · 🔴 no existe

---

## 1 · HÉROE

| Dato | Veredicto | Fuente `path:línea` | Fórmula / qué falta |
|---|---|---|---|
| **Patrimonio neto** | 🟢 existe | `src/modules/panel/PanelPage.tsx:295-296` | `activosTotales − deudaViva` |
| **Composición · Inmuebles** | 🟢 existe | `PanelPage.tsx:230-268` | Σ `properties` vía `valoracionMatcher.getByIdOrNombre` (`:242,256`) + cadena de fallback `:247-255` |
| **Composición · Tesorería** | 🟢 existe | `PanelPage.tsx:275-278` | Σ `accounts.balance ?? openingBalance` |
| **Composición · Inversiones** | 🟢 existe | `PanelPage.tsx:270-273` | Σ `cartaItems.valor_actual` |
| **Activos totales** | 🟢 existe | `PanelPage.tsx:295` | `inmuebles + inversiones + tesorería` |
| **Deuda viva** | 🟢 existe | `PanelPage.tsx:280-283` | Σ `prestamos.principalVivo` |
| **Cuota mensual** | 🟢 existe (calculada) | `PanelPage.tsx:285-293` | Amortización francesa `C·i / (1−(1+i)^−n)` · `i=effectiveTIN/1200` · `n=plazoMesesTotal−cuotasPagadas` |
| **Variación 12 meses** | 🔴 **no existe / no reconstruible** | `PanelPage.tsx:142-146` (delta hardcoded `null`) · `db.ts:2307` (`patrimonioSnapshots` ELIMINADO V62) · `dashboardService.ts:709-710` (getter no-op) · `valoracionesService.ts:35,377` | Ver §2.1 |
| **Anillo · % de libertad** | 🟡 calculable / parcial | rentaPasiva `PanelPage.tsx:426-428` · pct `:436` o `libertadData.pctCoberturaActual` `:674-677` | Ver §2.2 (el **objetivo de gasto** es el punto débil) |
| **Anillo · año objetivo (2041)** | 🟢 existe | `libertadService.ts:90-91,130` · consumido `PanelPage.tsx:684-685` | `cruceLibertad.anio` de `proyectarLibertadDesdeRepo`. **OJO**: cobertura de renta pasiva, no patrimonio |
| **Curva 20 años (patrimonio proyectado)** | 🔴 **no existe · bloqueado C-PROY-5** | `docs/audits/T-PROYECCION-AUDIT-INFORME.md:696,718` · `proyeccionActivoService.ts:1-9` (solo activos sueltos) | Ver §2.3 |
| **Punto de libertad *sobre la curva*** | 🔴 no existe | idem C-PROY-5 | La marca "2041" sobre la curva necesita la serie de patrimonio; el *año* existe pero no el punto (x,y) del patrimonio |

### 2.1 · Variación 12 meses — por qué no es reconstruible

`patrimonioNeto` = `activos − deudaViva`, y `activos` incluye `saldoTesoreria` (de `accounts.balance`) y `deudaViva` (de `prestamos.principalVivo`). **Ni las cuentas ni los préstamos tienen serie histórica** — solo valor actual. Los snapshots que lo permitían se borraron en V62:
- `src/services/db.ts:2307` — `patrimonioSnapshots: ELIMINADO en V62`
- `src/services/db.ts:2382,2864` · `src/services/__tests__/dbV62Migration.test.ts:32,61` — confirman eliminación de `patrimonioSnapshots` y `valoraciones_historicas`
- `src/services/dashboardService.ts:709-710` — getter convertido en no-op

El único histórico vivo es `valoracionesActivos` (`valoracionesService.ts:33`), y solo cubre `inmueble | inversion | plan_pensiones` (`valoracionesService.ts:35`). `getPatrimonioTotal(fechaPasada)` (`:377`) **omitiría tesorería y deuda por completo**. El comentario del panel (`PanelPage.tsx:142-146`) es **exacto**. → El "+12.480 € en 12 meses" del mockup **no tiene fuente**; va a **estado vacío**.
**Qué haría falta**: snapshot histórico de saldos de cuentas + `principalVivo` (la amortización de préstamo *podría* recomputarse, pero los saldos de cuentas no).

### 2.2 · Anillo % libertad — el objetivo de gasto es el eslabón débil

- **Renta pasiva (numerador)** 🟢: `PanelPage.tsx:426-428` — Σ `rentaMensual` de contratos activos.
- **Objetivo de gasto de vida (denominador)** 🟡: `escenario.gastosVidaLibertadMensual` (tipo `src/types/miPlan.ts:27`), leído del singleton `escenarios` (`PanelPage.tsx:174-175`).
  - Es un **objetivo que el usuario introduce en "Mi Plan"**. Responde a la pregunta del brief: **el objetivo sale de Mi Plan** (store `escenarios`).
  - Default cuando el usuario no lo fija: **2500** (`escenariosService.ts:22`, aplicado por `getEscenarioActivo` `:45-49`).
  - **Inconsistencia**: el panel lee `escenarios[0]` **crudo** (`PanelPage.tsx:174`), **no** llama a `getEscenarioActivo`, así que si el store está vacío cae a `pulsoMes.gastos` (gasto real del mes), **no** al default 2500. → El "2.526 €" del anillo es un objetivo real **solo si el usuario configuró Mi Plan**; si no, es ruido del mes en curso.
- **Año (2041)** 🟢: `libertadService.ts:90-91` (primer mes en que la renta cubre el gasto), vía `proyectarLibertadDesdeRepo` (`:142`).

### 2.3 · Curva 20 años — confirmación del bloqueo C-PROY-5

El mockup dibuja **"Patrimonio neto proyectado"** subiendo ~77 k → 1,2 M en 20 años. Eso exige un motor de acumulación de patrimonio año a año (amortización hipoteca + revalorización inmuebles + ahorro + crecimiento inversiones). Ese motor es **C-PROY-5** y **no está construido**:
- `docs/audits/T-PROYECCION-AUDIT-INFORME.md:696` — *"C-PROY-5 · Motor proyección a 20 años … 🟡 motor 1 año cubierto al 100% · 19 años faltan … L · 16-24 h"*
- `:718` — *"es el motor a 20 años. Bloqueante crítico … sin él no hay proyección multianual"*
- Lo único que existe hoy es una **curva 1-D** de renta pasiva vs gastos (no patrimonio) en `mi-plan/pages/LibertadPage.tsx` (informe `:463`).
- `proyeccionActivoService.ts` proyecta **un activo suelto** `{año, valor}` (`:1-9`), no el patrimonio consolidado.

**Conclusión**: la mitad derecha del héroe (curva + banner "PUNTO DE LIBERTAD" + ejes) va a **estado vacío** hasta que exista C-PROY-5 → **FASE C**. Confirmado el punto 0 de la tarea.

---

## 2 · CÓMO VA EL MES

Modelo de datos clave — `TreasuryEvent` (`src/services/db.ts:1330-1374`):
- `type: 'income' | 'expense' | 'financing'` (`:1332`) — **dirección del flujo**
- `amount: number` (`:1333`) — guardado como **magnitud positiva** (la dirección va en `type`)
- `predictedDate` (`:1334`) · `status: 'predicted' | 'confirmed' | 'executed'` (`:1357`) ← **discriminador cobrado/pendiente**
- `actualDate?` (`:1358`) · `actualAmount?` (`:1359`) · `movementId?` (`:1360`) — poblados solo al conciliar (`treasuryForecastService.ts:307-311`)

| Dato | Veredicto | Fuente / filtro | Nota |
|---|---|---|---|
| **Ha entrado** | 🟡 calculable | `type==='income' && status==='executed'` en mes; sumar `actualAmount ?? amount` | El panel actual NO usa el split (`PanelPage.tsx:314-333`) |
| **Queda por entrar** | 🟡 calculable | `type==='income' && status!=='executed' && predictedDate` en mes | **Sí existen** ingresos previstos no cobrados. Precedente: `treasuryForecastService.ts:204` |
| **Ha salido** | 🟡 calculable | `type∈{expense,financing} && status==='executed'` en mes | |
| **Queda por salir** | 🟡 calculable | `type∈{expense,financing} && status!=='executed' && predictedDate` futuro-en-mes | IBI generado como `categoryKey:'ibi_inmueble'`, `status:'predicted'` (`treasuryForecastService.ts:598-608,562`). **Aviso**: reglas opex hoy stub vacío (`:578`) → los eventos opex podrían no regenerarse |
| **Saldo a fin de mes** | 🟡 **parcial** | ver abajo | "hoy tienes X" existe; la proyección de fin de mes **real** no existe como tal |

**Saldo a fin de mes**:
- *"Hoy tienes X"* 🟢 — `saldoTesoreria` (`PanelPage.tsx:275-278`); también `getTreasuryProjections` expone `current: account.balance` (`treasuryForecastService.ts:229`).
- *Proyección a fin de mes* 🔴 como tal — el único proyector es `getTreasuryProjections(days)` sobre ventana **N-días** (`treasuryForecastService.ts:185-244`); no hay función a "último día del mes". Aproximable con `days = últimoDíaDelMes − hoy`, pero **esa llamada no existe**.
- El panel usa hoy `saldoFin = saldoTesoreria + cashflow` (naive, marcado TODO en `PanelPage.tsx:312,330-331` y `PulsoDelMes.tsx:11-12`).

---

## 3 · PUEDES ESTAR TRANQUILO

| Dato | Veredicto | Fuente `path:línea` | Fórmula / qué falta |
|---|---|---|---|
| **Colchón en meses** | 🟡 calculable (fórmula B viva) | `PanelPage.tsx:275-278` (saldo) · `:285-293` (cuota, sin cablear) · `:431-439` (gastoVida + `floor`) | Código = `floor(saldoTesoreria ÷ gastoVida)`. **Mockup dice "Tesorería ÷ cuota mensual"** (fórmula A). Ambos inputs existen. **Decisión de Jose**: A o B (y `floor` vs decimal "11,9") |
| **Sin cobrar** | 🔴 no existe como tal · 🟡 calculable | `PanelPage.tsx:381-400` (solo outflows) · filtro renta `estimacionFiscalEnCursoService.ts:90-100` | No hay store de recibos/cobros ni campo `cobrado/impagado`. Espejo de `pagosVencidos` para income: `type==='income' && (sourceType==='contrato' ∥ categoryKey∈renta) && status!=='executed' && movementId==null && fecha<hoy`. **De cualquier periodo** (no solo el mes) — el filtro no debe acotar por mes |
| **Próximos 30 días · contratos** | 🟢 existe (ventana 60d) | `PanelPage.tsx:356-378` | Filtra `fechaFin ?? endDate` en `hoy…hoy+60d`. **Mockup pide 30d**, código usa 60d |
| **Próximos 30 días · seguros** | 🔴 **no existe** | no hay store de seguros/pólizas en `db.ts`; "seguro" solo es categoría de gasto (`db.ts:368,995,1731`) | **El item concreto del mockup ("seguro de FA32 vence el 12 de agosto") no tiene fuente.** Haría falta store `{inmuebleId, aseguradora, fechaRenovacion, prima}` |
| **Próximos 30 días · calendario fiscal** | 🟡 parcial (solo M130) | `alertasFiscalesService.ts:175-205` (M130 hardcoded, 30d, gated a autónomo) | No hay calendario de IBI ni de otros modelos. Confirma la sospecha del brief |
| **Impuesto acumulado (IRPF devengado)** | 🟢 existe | `estimacionFiscalEnCursoService.ts:191-258` (`cuotaLiquida` `:234`) · motor `irpfCalculationService.calcularDeclaracionIRPF` | Año en curso por defecto (`:194`). Separa acumulado vs proyectado (`:212-227`). Confianza por meses con datos (`:41-45`). **No cableado al panel aún** |

---

## 4 · ACCIONES RÁPIDAS — las 4 tienen destino real

| Acción | Ruta | Componente `path:línea` | Nota |
|---|---|---|---|
| **Subir una factura** | `/inbox` | `App.tsx:725-729` → `InboxPage` (`:82`) | Inbox OCR |
| **Anotar un gasto** | `/personal/gastos/nuevo` | `App.tsx:1229-1233` → `PersonalNuevoGastoRecurrente` (`:203`) | Es wizard de gasto **recurrente**, no un quick-add puro; lista en `/personal/gastos` (`:1224`) |
| **Conciliar banco** | `/conciliacion` | `App.tsx:957-963` → `ConciliacionPage` (`:142`) | |
| **Registrar una mejora** | `/gestion/inmuebles/:id` | `App.tsx:1301-1305` · `mejorasInmuebleService.crear` (`:8`) · store `mejorasInmueble` real | **Requiere `:id`**: no hay entrada sin inmueble seleccionado. La ficha `/inmuebles/:id` (`App.tsx:788-790`) NO tiene UI de mejora |

---

## 5 · Para la lista (descubierto · NO tocado)

1. **Bug de convención de signo en `pulsoMes`.** Los importes se guardan como magnitud **positiva** con la dirección en `type` (`treasuryForecastService.ts:27-28,94-97,142-144,495-496,600-604,652-655`), pero `PanelPage.tsx:324,327` filtra por `ev.amount>0 / <0`. Con importes positivos, los gastos nunca son `<0` → `gastos` computaría 0 y los gastos se colarían en `ingresos`. **Cualquier implementación de "cómo va el mes" debe partir por `type`, no por el signo de `amount`.**
2. **Fórmula del colchón divergente.** Mockup (÷ cuota mensual) ≠ código (÷ gastoVida). Necesita decisión explícita de Jose.
3. **Objetivo de gasto inconsistente.** Default 2500 vive en `getEscenarioActivo` (`escenariosService.ts:22,45-49`) pero el panel lee `escenarios[0]` crudo (`PanelPage.tsx:174`) y no llama a `getEscenarioActivo`; el objetivo del anillo puede acabar siendo el gasto del mes en vez del objetivo real.
4. **Ventana de contratos 60d (código) vs 30d (mockup).**
5. **BUG-07 abierto**: el store `rentaMensual` (historial de cobros por periodo) **no alimenta** la proyección (`ATLAS-mapa-stores-VIGENTE.md:38,960,1147`). Relevante si "sin cobrar" quisiera basarse en cobros esperados por contrato en vez de en `treasuryEvents`.
6. **Reglas opex en stub** (`treasuryForecastService.ts:578` · `rules: OpexRule[] = []`, migrado a `compromisosRecurrentes`) → eventos IBI/opex podrían no estar regenerándose ahora mismo.
7. **Riesgo de duplicar importes (regla B.5).** La cuota mensual aparecería en el héroe (deuda/cuota) **y** en "queda por salir" (hipoteca) **y** en la card Financiación. Hay que decidir un único sitio canónico por importe.
8. **Rampa `on-navy` inexistente en V5.** El propio mockup lo admite en su CSS (`atlas-panel-v3-version-c.html:20`: *"rampa de tinta SOBRE navy · no existe en la V5 · propuesta"*). La regla §27 exige tokens `--atlas-v5-on-navy-1..7` para todo lo que va sobre el héroe navy → **hay que pedir/crear esos tokens antes de FASE B** (regla 3: no se inventa alias privado).

---

## 6 · Propuesta de reparto FASE B / FASE C (decide Jose)

> No es una decisión mía. Con la tabla delante, sugiero:

**Entra limpio en FASE B (fuente sólida):**
- Héroe: patrimonio, composición (3 segmentos), activos, deuda viva, cuota mensual, anillo % + año de libertad.
- Cómo va el mes: los 4 cuadros de flujo (ha entrado / queda por entrar / ha salido / queda por salir) con el split por `status` y **partiendo por `type`** (arregla el bug §5.1).
- Puedes estar tranquilo: colchón (tras decidir fórmula), impuesto acumulado (cablear `estimacionFiscalEnCursoService`).
- Acciones rápidas: las 4.

**FASE B con estado vacío honesto (falta fuente):**
- Variación 12 meses → "histórico no disponible" (ya es el comportamiento actual).
- Saldo a fin de mes → o estado vacío, o etiquetarlo claramente como estimación (no proyección real).
- Sin cobrar → implementable por espejo, pero si Jose prefiere store de recibos, va a vacío.
- Próximos 30 días → mostrar solo contratos (ajustando a 30d); seguros e IBI en vacío con enlace a donde se resolverían.

**FASE C (bloqueado C-PROY-5):**
- Curva 20 años de patrimonio + punto de libertad sobre la curva → estado vacío explicando que la proyección aún no está disponible.

**Antes de tocar código en FASE B**: pedir los tokens `--atlas-v5-on-navy-1..7` (§5.8).

---

**STOP.** Jose decide qué entra en FASE B con esta tabla delante.
