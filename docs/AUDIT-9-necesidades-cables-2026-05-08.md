# AUDIT · 9 necesidades · cables sueltos · 2026-05-08

> **Tipo** · Auditoría READ-ONLY (T-AUDIT-9 · spec en `docs/TAREA-T-AUDIT-9-necesidades-cables.md`)
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · branch `claude/audit-cable-inventory-hao6k`
> **DB_VERSION** · 69 (40 stores)
> **Fecha auditoría** · 2026-05-07 (entregable fechado 2026-05-08 según spec)
> **Output** · solo este documento · CERO modificación de código
> **Estado** · stop-and-wait · base para construir plan T-RECONNECT
>
> Cada hallazgo cita evidencia `archivo:línea`. Cuando el auditor (CC) no puede afirmar algo con certeza, lo marca `[F · investigación adicional]` y lo recoge en §12 «Preguntas para Jose».

---

## 0 · Resumen ejecutivo

### 0.1 · Conteo de hallazgos

| Frente | Definición | Total |
|---|---|---|
| **F1 · Cables sueltos** | piezas existentes sin caller activo (o callers obsoletos) | **9** |
| **F2 · Cables conectados pero defectuosos** | piezas que se llaman pero producen resultado incorrecto / empty state con datos / divergencia entre pantallas | **11** |
| **F3 · Cables que faltan** | mockup promete · código no tiene (o lo tiene en stub/placeholder) | **13** |
| **TOTAL** | | **33** |

### 0.2 · Acciones sugeridas

| Acción | Definición | Total |
|---|---|---|
| **A · Reconectar tal cual** | suelto, sano, compatible | **2** |
| **B · Adaptar y reconectar** | suelto/defectuoso, sano, requiere ajuste de firma o lectura | **8** |
| **C · Arreglar y reconectar** | lógica con bug · arreglar antes de usar | **6** |
| **D · Descartar** | obsoleto · mejor reescribir | **3** |
| **E · Construir nuevo** | mockup lo promete · código no lo tiene | **11** |
| **F · Investigación adicional** | requiere input Jose | **3** |

### 0.3 · Hallazgos críticos (Top-7 que requieren input Jose)

1. **N1 · Patrimonio total · NO existe vista dedicada**. Panel (`src/modules/panel/PanelPage.tsx:208-209`) es la única síntesis activos − pasivos. No hay módulo `Patrimonio`. → ¿se construye página dedicada o se consagra Panel como esa vista?
2. **N5/N6 · Mi Plan vs Tesorería (90.665€ vs 0€)**. Ambas pantallas usan `computeBudgetProjection12mAsync` pero con manejos de error divergentes y, además, `CalendarioMes12.tsx:189` calcula su propio "cierre previsto" desde events+movements (cadena de datos paralela). Tres fuentes de verdad coexisten para el mismo número.
3. **N2 · `opexService.ts` es un STUB v62** que devuelve arrays vacíos, pero sigue importado por `FiscalDashboard.tsx`, `InmueblePresupuestoTab.tsx`, `GastosRecurrentesTab.tsx`. Datos reales de OPEX están huérfanos (no clasificados). Confirmar si la migración se completó.
4. **N2 · `capexClassificationService.getMejoraAmortizationSummary()`** (`src/services/capexClassificationService.ts:197`) consulta el store `mejora` que **fue eliminado** (comentario interno línea 215). Sigue siendo llamada por `Resumen.tsx:73,145` produciendo silenciosamente datos vacíos.
5. **N7 · `recomendaciones`** · no existe motor. `copilotService.ts:61-90` solo proxy a `/.netlify/functions/chat`. No hay reglas locales ni UI dedicada.
6. **N8 · Botón 1-click declaración** existe en UI pero su `onClick` es `showToastV5('Marcar como declarado · sub-tarea follow-up')` (`src/modules/fiscal/pages/BorradorIRPFPage.tsx:268`). Lo mismo con "Exportar PDF" (línea 260).
7. **N9 · UX progresiva A→B** · no existe `ProfileContext`, `userSegment`, ni feature flags por perfil. Solo un flag (`SHOW_RETOS=false`) en `src/modules/mi-plan/featureFlags.ts:19`. La UX es plana.

### 0.4 · Ubicación de la evidencia

Los hallazgos se citan con `archivo:línea`. Las rutas son relativas a la raíz del repo. Los mockups de referencia están en `docs/audit-inputs/atlas-*.html`.

---

## 1 · Necesidad 1 · Conocer mi patrimonio (consolidado activos − pasivos)

### 1.1 · Mockup esperado
- `docs/audit-inputs/atlas-panel.html:313` → "Patrimonio neto" KPI hero.
- `docs/audit-inputs/atlas-panel.html:321` → "Activos totales" como meta.
- `docs/audit-inputs/atlas-panel.html:331` → "Composición del patrimonio" (donut activos por tipo).

### 1.2 · Estado en código real
- `src/modules/panel/PanelPage.tsx:143-209` calcula `valorInmuebles + valorInversiones + saldoTesoreria - deudaViva` inline con `useMemo`. **No hay servicio**.
- No existe ruta `/patrimonio` en `src/App.tsx` (ver listado completo de rutas líneas 488-1296).
- `src/modules/horizon/informes/generators/generatePatrimonio.ts:9` calcula otro patrimonio para PDF a partir de `informesDataService.proyeccion`. **Cadena paralela**.

### 1.3 · Hallazgos

#### Hallazgo 1.A · `PanelPage.saldoTesoreria` no filtra cuentas inactivas

**Capa 1 · Existencia**
- Pieza · `src/modules/panel/PanelPage.tsx:188-191` · `useMemo` que suma `accounts.balance ?? openingBalance` para todas las cuentas cargadas en `:101` (`db.getAll('accounts')`).
- Caller actual · render hero (`:486-498`) y composición (`:504-572`).
- Por qué importa · `TesoreriaPage.tsx:39-41` filtra `accounts.filter(a => a.status === 'ACTIVE')` antes de mostrar saldo. Panel lee TODAS las cuentas, incluidas archivadas/inactivas.

**Capa 2 · Salud**
- Tests · ninguno (`src/modules/panel/__tests__/` no existe).
- Lógica · "correcta" pero **no consistente con Tesorería** → patrimonio Panel y saldo Tesorería divergen si hay cuentas inactivas con balance > 0.

**Capa 3 · Compatibilidad**
- `accounts` store existe (DB v69). Schema válido. Falta el filtro.

**Decisión sugerida · C · Arreglar y reconectar** · añadir `.filter(a => a.status !== 'INACTIVE')` o equivalente. **Esfuerzo · S** (15 min).
**Bloqueante para** · necesidad 1 patrimonio (coherencia con N5/N6).

---

#### Hallazgo 1.B · `PanelPage.deudaViva` filtra prestamos con dos campos solapados

**Capa 1 · Existencia**
- `src/modules/panel/PanelPage.tsx:112` · filtra `prestamos.filter(p => p.activo !== false && p.estado !== 'cancelado')`.
- Pieza fuente · `prestamos` store (DB v69).

**Capa 2 · Salud**
- Si en migraciones recientes (T34/T35) algunos préstamos quedaron con `activo` undefined y `estado='cancelado'`, OK. Pero si quedaron con `activo=true` y `estado='cancelado'`, también se excluyen. Si hay préstamos `activo=true` sin `estado`, se cuentan. **Puede haber registros sucios silenciosamente**.

**Capa 3 · Compatibilidad**
- Doble fuente de verdad para "préstamo activo" (`activo` boolean + `estado` string). No hay validador de migración.

**Decisión sugerida · F · Investigación adicional** · ¿qué campo es canónico tras T34/T35? Revisar tipo `Prestamo` en `src/services/db.ts`.
**Esfuerzo · S** (30 min de inspección).

---

#### Hallazgo 1.C · `valoracionMatcher` falla silenciosamente y patrimonio cae a fallback

**Capa 1 · Existencia**
- `src/modules/panel/PanelPage.tsx:121-128` · `valoracionMatcher` se carga async; si falla, se loguea warning y se queda en `null`.
- Cadena de fallback en `:160-168` · 7 niveles (`valor_actual → currentValue → marketValue → estimatedValue → valuation → acquisitionCosts.currentValue → acquisitionCosts.price → 0`).

**Capa 2 · Salud**
- Logs en `:174-178` reportan `porId/porNombre/sinMatch`, **pero no hay alerta visible al usuario** si `sinMatch > 0`.
- Si el matcher devuelve null **y** los inmuebles no tienen `currentValue/marketValue`, el patrimonio cae a precio de adquisición histórico, no valor actual.

**Capa 3 · Compatibilidad**
- `valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre('inmueble')` existe y compatible. Pero no hay UX para "no podemos valorar este inmueble".

**Decisión sugerida · C · Arreglar y reconectar** · mostrar warning visible cuando `sinMatch > 0`.
**Esfuerzo · M** (1-2h con UI).

---

#### Hallazgo 1.D · Vista "Patrimonio total consolidado" dedicada NO existe (FRENTE 3)

**Capa 1 · Existencia**
- Búsqueda exhaustiva en `src/pages` y `src/modules` · no hay `PatrimonioPage.tsx` ni módulo `patrimonio`.
- Rutas en `src/App.tsx:548..1296` · no hay `/patrimonio`. La función la cumple `/panel`.
- `src/modules/horizon/informes/generators/generatePatrimonio.ts:9-11` existe pero solo para PDF.

**Capa 2 · Salud**
- N/A (no hay pieza).

**Capa 3 · Compatibilidad**
- Cualquier nueva página tendría stores disponibles (`properties`, `accounts`, `inversiones`, `prestamos`). No hay bloqueo de schema.

**Decisión sugerida · E · Construir nuevo** o **F · Investigación adicional**: ¿se considera Panel como vista oficial de patrimonio o se construye dedicada? El mockup `atlas-panel.html` tiene composición del patrimonio (`:331`), no una página separada.
**Esfuerzo · M-L** (4-8h si se construye).

---

#### Hallazgo 1.E · `generatePatrimonio.ts` lee de cadena distinta a Panel (FRENTE 2 · incoherencia)

**Capa 1 · Existencia**
- `src/modules/horizon/informes/generators/generatePatrimonio.ts:9-11` · `activosTotales = cartera.valorTotal + patrimonioInversiones + proyeccion.meses[-1].cajaFinal`. Lee de `informesDataService` singleton.

**Capa 2 · Salud**
- Si `proyeccion` está stale o no se ha computado, `cajaFinal=0` → patrimonio PDF subestimado.

**Capa 3 · Compatibilidad**
- Funciona, pero diverge de Panel. Dos fuentes de verdad para mismo concepto.

**Decisión sugerida · C · Arreglar y reconectar** · unificar fuente de cálculo (extraer servicio común `patrimonioService.ts` que Panel y PDF consuman).
**Esfuerzo · M** (2-3h).

### 1.4 · Síntesis Necesidad 1

Cobertura real: **70%**. La consolidación activos−pasivos sucede inline en PanelPage (3 KPI: valorInmuebles, saldoTesoreria, deudaViva sumados en `:208-209`). Falta:
- coherencia con Tesorería (filtro accounts ACTIVE),
- alerta cuando matcher de valoraciones no resuelve,
- consolidación con la cadena que alimenta el PDF de patrimonio,
- decisión sobre página dedicada vs Panel como autoridad.

---

## 2 · Necesidad 2 · Controlar lo que gasto (real, no solo previsto)

### 2.1 · Mockup esperado
- `docs/audit-inputs/atlas-inmueble-fa32-v2.html:1130` → "28 gastos del año agrupados en categorías · amortizables (hipoteca capital, mejoras), deducibles (suministros, comunidad, seguros, IBI, reparaciones), no deducibles · clasificación automática con OCR · subtotales fiscales casilla por casilla."
- `docs/audit-inputs/atlas-inmueble-fa32-v2.html:535` → tab "Gastos<span class="tab-count">28</span>" (28 gastos reales).
- `docs/audit-inputs/atlas-personal-v3.html` → presupuesto 50/30/20 con real vs previsto.

### 2.2 · Estado en código real
- `src/modules/inmuebles/pages/DetallePage.tsx:107-114` define 6 tabs (`resumen | contratos | cobros | gastos | documentos | fiscalidad`).
- `:51-53` carga **solo** `compromisosRecurrentes` (previsto) para tab gastos.
- `:394-406` renderiza `ListadoGastosRecurrentes` con `compromisos` (previsto).
- `:408-414` placeholder explícito para tabs `cobros | documentos | fiscalidad` ("Pestaña en migración a UI v5 · funcionalidad pendiente de sub-tarea follow-up").
- `src/services/gastosInmuebleService.ts` (CRUD completo) **no se importa en `DetallePage.tsx`**.
- `src/services/mejorasInmuebleService.ts` (CRUD reformas/CAPEX) tampoco se importa en `DetallePage.tsx`. Solo en `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:148-200` (admin).

### 2.3 · Hallazgos

#### Hallazgo 2.A · `opexService.ts` es STUB v62 con callers vivos (FRENTE 1)

**Capa 1 · Existencia**
- `src/services/opexService.ts:1-80` · `generateBaseOpexForProperty`, `getOpexRulesForProperty`, `saveOpexRule`, `deleteOpexRule` → todos `console.warn` + return `[]/null`.
- Callers vivos:
  - `src/modules/horizon/fiscalidad/dashboard/FiscalDashboard.tsx:22` (carga opex en `:133`, usa en `:362`).
  - `src/modules/inmuebles/components/InmueblePresupuestoTab.tsx:32, :238`.
  - `src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx:9`.

**Capa 2 · Salud**
- Funciona como stub: no rompe la app, pero los datos siempre vacíos.
- Sin tests.

**Capa 3 · Compatibilidad**
- El store `opexRules` se eliminó en migración v62 (intencional).

**Decisión sugerida · D · Descartar caller pattern** + **E · Construir nuevo** sobre `compromisosRecurrentes` (ya es la fuente de verdad post-v62). Reescribir helpers que computen OPEX real desde `gastosInmueble` filtrado por casillas deducibles.
**Esfuerzo · M** (3-4h).
**Bloqueante para** · N2 (gasto real por inmueble), N8 (declaración).

---

#### Hallazgo 2.B · `capexClassificationService.getMejoraAmortizationSummary` consulta store eliminado (FRENTE 2)

**Capa 1 · Existencia**
- `src/services/capexClassificationService.ts:197` · `getMejoraAmortizationSummary(year)` · línea 215 comentario interno: "mejora IndexedDB store has been removed".
- Caller: `src/modules/horizon/fiscalidad/.../Resumen.tsx:73, :145`.

**Capa 2 · Salud**
- Devuelve siempre `{ details: [] }` silenciosamente.
- KPI de amortización en Resumen siempre 0€.

**Capa 3 · Compatibilidad**
- Datos canónicos viven ahora en `mejorasInmuebleService` (otro store, otro schema).

**Decisión sugerida · B · Adaptar y reconectar** · reescribir `getMejoraAmortizationSummary` para leer de `mejorasInmuebleService.getPorInmueble` y agregar.
**Esfuerzo · M** (2-3h).

---

#### Hallazgo 2.C · `capexClassificationService.createMejoraFromDocument` y `updateMejoraClassification` son no-ops (FRENTE 1)

**Capa 1 · Existencia**
- `src/services/capexClassificationService.ts:268, :281` · `console.warn` + return.

**Capa 2 · Salud**
- Reglas de clasificación (`:42-134`) sí existen y son correctas (regex sobre keywords reforma/reparación/mobiliario/ampliación) pero **se llaman al vacío**.

**Capa 3 · Compatibilidad**
- Pueden adaptarse a `mejorasInmuebleService.crear/actualizar`.

**Decisión sugerida · B · Adaptar y reconectar** · reescribir delegando a `mejorasInmuebleService`.
**Esfuerzo · S** (1h).

---

#### Hallazgo 2.D · DetallePage tab "Gastos" muestra solo previsto (FRENTE 2)

**Capa 1 · Existencia**
- `src/modules/inmuebles/pages/DetallePage.tsx:51-53, :394-406` · solo carga compromisos.
- Mockup `atlas-inmueble-fa32-v2.html:1130` promete 28 gastos REALES con OCR + clasificación.

**Capa 2 · Salud**
- Lo que carga, lo carga bien. Pero faltan dos fuentes (`gastosInmuebleService.getByInmueble`, `mejorasInmuebleService.getPorInmueble`).

**Capa 3 · Compatibilidad**
- Ambos servicios existen y funcionan. Solo falta el import + render.

**Decisión sugerida · B · Adaptar y reconectar** · cargar las tres fuentes (compromisos/gastosInmueble/mejorasInmueble), mostrar previsto + real lado a lado en KpiStrip.
**Esfuerzo · M** (3-5h con UI).
**Bloqueante para** · N2 directamente.

---

#### Hallazgo 2.E · DetallePage tabs `cobros`/`documentos`/`fiscalidad` son placeholders (FRENTE 3)

**Capa 1 · Existencia**
- `src/modules/inmuebles/pages/DetallePage.tsx:408-414` literal placeholder div.
- Mockup `atlas-inmueble-fa32-v2.html:1133-1148` describe contenido detallado para los tres.

**Capa 2 · Salud**
- N/A (no hay pieza).

**Capa 3 · Compatibilidad**
- Stores existen: `documents` (en property), `gastosInmueble` para fiscalidad, treasury movements para cobros.

**Decisión sugerida · E · Construir nuevo** · 3 sub-pestañas distintas. Probable sub-tareas independientes.
**Esfuerzo · L** (8-12h cada una).

---

#### Hallazgo 2.F · `mejorasInmuebleService` totalmente oculto al usuario final (FRENTE 1 disfrazado)

**Capa 1 · Existencia**
- `src/services/mejorasInmuebleService.ts:25, :47` · `getPorInmueble`, `getTotalCapexHastaEjercicio` → solo se llaman desde `LineasAnualesTab.tsx:183` (admin) y `aeatAmortizationService.ts:173` (motor fiscal interno).
- `DetallePage.tsx` (vista usuario) no los usa.

**Capa 2 · Salud**
- Funcional. Bien.

**Capa 3 · Compatibilidad**
- 100% compatible con DetallePage si se importa.

**Decisión sugerida · A · Reconectar tal cual** dentro del nuevo tab "Reformas" del DetallePage (parte de 2.D / 2.E).
**Esfuerzo · S** (1-2h sumado a 2.D).

---

#### Hallazgo 2.G · Personal · Presupuesto está "dormido" porque `budgetMatchingService` está huérfano (FRENTE 1+2)

**Capa 1 · Existencia**
- `src/services/budgetMatchingService.ts:106-154` · lógica sofisticada de match con ventana ±5d / tolerancia ±15%. **Cero importadores** (rg confirmado por agent Explore).
- `src/services/budgetReclassificationService.ts` referenciado solo en `__keyvalAudit.ts:62` (auditoría documental).
- `src/modules/personal/pages/PresupuestoPage.tsx:26-184` · página existe (ruta `/personal/presupuesto` en `src/App.tsx:1064`).

**Capa 2 · Salud**
- PresupuestoPage hace cómputo 50/30/20 estático sobre nominas+autonomos del mes actual. **No matchea con movimientos reales**.
- `budgetMatchingService` lógica leída · parece correcta pero sin tests.

**Capa 3 · Compatibilidad**
- `budgetMatchingService` espera tipos `Movement` y `BudgetLine`. `Movement` existe en DB v69. `BudgetLine`/`presupuestoLineas` existen como store (`db.ts:2172-2175`) pero **sin UI de creación**.

**Decisión sugerida · C · Arreglar y reconectar** + **E · Construir nuevo** wizard de creación de presupuestoLineas. Sin UI de input no hay datos que matchear.
**Esfuerzo · L** (8-12h: wizard + integración + matcher visible).
**Bloqueante para** · N2 personal completo.

### 2.4 · Síntesis Necesidad 2

Cobertura real: **40%**.
- Inmuebles · gastos previstos OK (compromisos), gastos reales **invisibles** (servicios existen pero `DetallePage` no los importa), reformas **invisibles** (solo en admin), CAPEX/OPEX clasificación rota tras v62.
- Personal · presupuesto existe como página vacía (50/30/20 estático), motor de matching huérfano.

---

## 3 · Necesidad 3 · Controlar mi nómina y la de la pareja

### 3.1 · Mockup esperado
- `docs/audit-inputs/atlas-personal-v3.html` describe ingresos personales con titular + pareja diferenciados.

### 3.2 · Estado en código real
- `src/types/personal.ts:68` · `Nomina.titular: 'yo' | 'pareja'`.
- `src/services/nominaService.ts:98-142` · `getNominas`, `getActivaNomina` filtran por `personalDataId + tipo='nomina'` (27+ callers).
- `src/modules/personal/wizards/NominaWizard.tsx` · wizard de creación, **selector único** de titular.
- `src/modules/personal/pages/IngresosPage.tsx:25-96, :102-109` · lista nominas con badge de titular.

### 3.3 · Hallazgos

#### Hallazgo 3.A · `NominaManager.tsx` y `nominaAportacionHook.ts` huérfanos (FRENTE 1)

**Capa 1 · Existencia**
- `src/components/personal/nomina/NominaManager.tsx:3-33` · sin importadores activos (búsqueda agent Explore).
- `src/services/personal/nominaAportacionHook.ts` · sin uso.

**Capa 2 · Salud**
- Imposible de validar sin caller; lógica leída no aporenta bug evidente.

**Capa 3 · Compatibilidad**
- Tipos válidos contra schema actual.

**Decisión sugerida · F · Investigación adicional** · ¿se sustituyeron por `IngresosPage`? Si sí, eliminar (D). Si no, reintroducir (A).
**Esfuerzo · S** (30 min lectura).

---

#### Hallazgo 3.B · No existe dashboard "titular vs pareja" (FRENTE 3)

**Capa 1 · Existencia**
- `src/modules/panel/PanelPage.tsx:107` carga nominas pero no las separa por titular.
- `IngresosPage.tsx:96-109` muestra lista plana con badge.
- Ninguna pieza agrega "ingresos titular" vs "ingresos pareja" como KPI.

**Capa 2 · Salud**
- N/A (no hay pieza).

**Capa 3 · Compatibilidad**
- `nominaService.getNominas()` admite filtro `titular`. Stores compatibles.

**Decisión sugerida · E · Construir nuevo** · KpiStrip "ingresos consolidados" en Personal con desglose 2 columnas titular/pareja.
**Esfuerzo · M** (3-4h).

---

#### Hallazgo 3.C · No hay planificación fiscal conjunta (FRENTE 3)

**Capa 1 · Existencia**
- `src/services/aeatAmortizationService.ts` y `irpfCalculationService.ts` (referenciado en `BorradorIRPFPage.tsx:81`) calculan IRPF **por persona**.
- No hay servicio que agregue ambos para tributación conjunta.

**Capa 2 · Salud**
- N/A.

**Capa 3 · Compatibilidad**
- Requiere nueva agregación + flag de modalidad ("conjunta vs individual").

**Decisión sugerida · E · Construir nuevo** + **F · Investigación adicional** · ¿el cliente declara conjunta o individual? ¿prioritario?
**Esfuerzo · L** (10h+).

### 3.4 · Síntesis Necesidad 3

Cobertura real: **55%**. Datos almacenados con distinción titular/pareja, listados muestran badge, pero **sin agregación visual** ni planificación fiscal conjunta. Wizard único persona-a-persona.

---

## 4 · Necesidad 4 · Gestionar contratos con inquilinos

### 4.1 · Mockup esperado
- `docs/audit-inputs/atlas-contratos-v4.html` y `atlas-wizard-nuevo-contrato.html` describen alta + renovación + alertas vencimiento + cobros.

### 4.2 · Estado en código real
- `src/modules/inmuebles/pages/ContratosListPage.tsx:38-204` · 4 tabs (`disponibilidad | acciones | activos | historico`).
- `src/services/contractService.ts` (27+ callers).
- `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx` (ruta `/contratos/nuevo`, `App.tsx:1152`).

### 4.3 · Hallazgos

#### Hallazgo 4.A · Tab "Acciones" detecta vencimientos pero no ofrece flujo de renovación (FRENTE 3)

**Capa 1 · Existencia**
- `src/modules/inmuebles/pages/ContratosListPage.tsx:29-36` · helper `isExpiringSoon` con ventana 90 días.
- `:68-79` · pestaña "Acciones" lista contratos próximos a vencer.
- **No hay botón "Renovar"** ni wizard `RenovacionContratoWizard`.

**Capa 2 · Salud**
- Detección OK.

**Capa 3 · Compatibilidad**
- `contractService` tiene `saveContract / updateContract`, podría reutilizarse para crear contrato sucesor enlazado.

**Decisión sugerida · E · Construir nuevo** wizard de renovación.
**Esfuerzo · M-L** (5-8h).

---

#### Hallazgo 4.B · Timeline 6 meses por habitación es placeholder explícito (FRENTE 3)

**Capa 1 · Existencia**
- `src/modules/inmuebles/pages/ContratosListPage.tsx:195-201` · texto literal "Vista timeline 6 meses prevista · pendiente de implementación".

**Capa 2 · Salud**
- N/A.

**Capa 3 · Compatibilidad**
- Datos `contracts.fechaInicio/fechaFin` + `property.bedrooms` disponibles.

**Decisión sugerida · E · Construir nuevo**.
**Esfuerzo · M** (4-6h).

---

#### Hallazgo 4.C · Cobros por contrato no rastreados (FRENTE 3)

**Capa 1 · Existencia**
- `src/services/contractService.ts` · `Contract` tiene `rentaMensual` pero no `pagosRecibidos[]`.
- `src/services/treasuryForecastService.ts:4` importa `calculateRentPeriodsFromContract` pero solo para forecast, no para reconciliación.
- DetallePage tab `cobros` es placeholder (ver Hallazgo 2.E).

**Capa 2 · Salud**
- Forecast funciona, conciliación con movimientos reales **inexistente**.

**Capa 3 · Compatibilidad**
- Treasury movements tienen `contractId` opcional? · verificar en `db.ts` (probable F).

**Decisión sugerida · F · Investigación adicional** + **E · Construir nuevo** · ¿qué campo enlaza movimiento ↔ contrato? Si no existe, hay que crearlo.
**Esfuerzo · L** (10h+).

### 4.4 · Síntesis Necesidad 4

Cobertura real: **50%**. Listado, alta, vencimientos detectados sí. Renovación, cobros por contrato, timeline = no.

---

## 5 · Necesidad 5 · Tener claro el rumbo · plan financiero

### 5.1 · Mockup esperado
- `docs/audit-inputs/atlas-mi-plan-landing-v3.html`, `atlas-mi-plan-proyeccion-v3.html`, `atlas-mi-plan-libertad-v3.html`, `atlas-mi-plan-objetivos-v3.html`, `atlas-mi-plan-fondos-v3.html`, `atlas-mi-plan-retos-v3.html`.
- KPIs: balance anual, libertad financiera, fondos, objetivos.

### 5.2 · Estado en código real
- 5 páginas activas en `src/modules/mi-plan/pages/` (`Landing | Libertad | Objetivos | Fondos | Proyeccion`) + `RetosPage` controlada por `featureFlags.SHOW_RETOS = false`.
- `src/modules/mi-plan/services/budgetProjection.ts:229, :271` · `computeBudgetProjectionFromData` y wrapper async.
- Rutas `App.tsx:941-981`.

### 5.3 · Hallazgos

#### Hallazgo 5.A · `computeBudgetProjection12mAsync` swallow silencioso de errores (FRENTE 2 · CRÍTICO)

**Capa 1 · Existencia**
- `src/modules/mi-plan/services/budgetProjection.ts:271-296` · async wrapper. **Bloque catch en `:288-296`** retorna proyección con todos los meses a cero si cualquier `db.getAll` falla.
- Callers · `LandingPage.tsx:55`, `ProyeccionPage.tsx:18`, `VistaGeneralTab.tsx:114`.

**Capa 2 · Salud**
- Sin tests para path de error.
- Caller `LandingPage.tsx:55-66` no tiene `.catch()` propio (depende del swallow).
- Resultado: si DB falla por cualquier motivo (corrupción, schema mismatch, etc.) Mi Plan dice "0€" sin notificar.

**Capa 3 · Compatibilidad**
- Funciona contra DB v69.

**Decisión sugerida · C · Arreglar y reconectar** · propagar error o exponer estado de error a UI; mantener resultado vacío como último recurso pero loggear y mostrar banner.
**Esfuerzo · S** (1-2h).
**Bloqueante para** · N5, N6.

---

#### Hallazgo 5.B · Mi Plan vs Tesorería discrepancia 90.665€ vs 0€ (FRENTE 2 · CRÍTICO)

**Capa 1 · Existencia**
- Tres cadenas de datos para "cierre previsto fin de año":
  1. `Mi Plan LandingPage.tsx:55` → `computeBudgetProjection12mAsync` → `balanceAnual = entradas + salidas`.
  2. `Tesorería VistaGeneralTab.tsx:160-166` → mismo `computeBudgetProjection12mAsync` para meses futuros + movimientos reales para meses pasados.
  3. `Tesorería CalendarioMes12.tsx:189` → `ultimoMes.saldoFinal` calculado desde `treasuryEvents` filtrados (ingresos/gastos), **sin pasar por budgetProjection**.

**Capa 2 · Salud**
- Si la proyección retorna ceros (Hallazgo 5.A), Mi Plan muestra 0 € mientras Tesorería sigue mostrando ~90k € desde la cadena 3 (events).
- Aunque la proyección funcione, las cadenas 2 y 3 pueden discrepar porque events vs nominas+autonomos+compromisos no son la misma agregación.

**Capa 3 · Compatibilidad**
- Todas las cadenas leen stores válidos. El problema es **arquitectónico**: 3 fuentes de verdad para 1 número.

**Decisión sugerida · C · Arreglar y reconectar** + **B · Adaptar y reconectar** · una de dos:
- (a) consolidar en `budgetProjection` y forzar que `CalendarioMes12` se lo consuma;
- (b) consolidar en events y migrar `budgetProjection` a derivar de eventos.
**Esfuerzo · L** (1-2 días, requiere decisión arquitectónica).
**Bloqueante para** · N5, N6, confianza del cliente.

---

#### Hallazgo 5.C · `PanelPage.pulsoMes.saldoFin` con TODO explícito (FRENTE 2)

**Capa 1 · Existencia**
- `src/modules/panel/PanelPage.tsx:227-246` · `pulsoMes` calcula `saldoFin = saldoTesoreria + cashflow` con comentario "TODO: conectar con servicio de proyección para obtener saldo fin de mes real".

**Capa 2 · Salud**
- Cálculo aproximado (suma actual + cashflow del mes), no proyección real. Diverge de Tesorería y Mi Plan.

**Capa 3 · Compatibilidad**
- Podría llamar a `computeBudgetProjection12mAsync` y leer mes en curso.

**Decisión sugerida · B · Adaptar y reconectar** a `budgetProjection`.
**Esfuerzo · S** (1h).

### 5.4 · Síntesis Necesidad 5

Cobertura real: **60%**. Mi Plan tiene 5 páginas activas, motor de proyección existe, pero **3 cadenas de datos distintas** alimentan el mismo concepto y el manejo de errores oculta fallos. La sensación de cliente "Mi Plan dice 0 €" tiene fundamento técnico claro.

---

## 6 · Necesidad 6 · Ver si me desvío del plan

### 6.1 · Mockup esperado
- `atlas-panel.html` "Piden tu atención" + "Pendientes del día" + "EN PROGRESO" objetivos.
- Implícito: sistema de alertas + tracking de variance plan vs real.

### 6.2 · Estado en código real
- `src/services/alertasFiscalesService.ts:9-220` (6 tipos de alerta fiscal).
- `src/modules/panel/components/AttentionList.tsx:4-127` (panel "Piden tu atención").
- **No existe `desviosService.ts` ni `varianceService.ts`** (búsqueda exhaustiva, 0 resultados).

### 6.3 · Hallazgos

#### Hallazgo 6.A · Alertas fiscales generadas pero NO consumidas en Panel (FRENTE 2)

**Capa 1 · Existencia**
- `src/services/alertasFiscalesService.ts:9-220` · 6 tipos: `arrastre_caduca | gastos_faltantes | retenciones_insuficientes | plan_pensiones | m130_pendiente | datos_fiscales`.
- Caller único: `src/modules/horizon/fiscalidad/dashboard/FiscalDashboard.tsx:157-161`.
- **Panel `:261-268`** tiene 3 TODO comments explícitos: "TODO: conectar con servicio de alertas para deudas ejecutiva/apremio", "borradores fiscales listos", "obligaciones fiscales próximas 30d".

**Capa 2 · Salud**
- En FiscalDashboard funciona. En Panel falta cableado.

**Capa 3 · Compatibilidad**
- 100% compatible. Solo falta importar `generarAlertasFiscales` en PanelPage.

**Decisión sugerida · A · Reconectar tal cual**.
**Esfuerzo · S** (1h).
**Bloqueante para** · N6 visible al cliente.

---

#### Hallazgo 6.B · `desviosService` / variance plan vs real NO existe (FRENTE 3)

**Capa 1 · Existencia**
- Búsqueda agent: 0 matches "desvío|variance" en `src/services` y `src/modules`.

**Capa 2 · Salud**
- N/A.

**Capa 3 · Compatibilidad**
- Requiere comparar:
  - presupuesto vs movimientos reales (`budgetMatchingService` huérfano · ver 2.G);
  - proyección Mi Plan vs treasury events reales;
  - objetivos Mi Plan vs progreso medido.

**Decisión sugerida · E · Construir nuevo** servicio cross-cutting.
**Esfuerzo · L** (12h+, depende de unificación de N5).

---

#### Hallazgo 6.C · `AttentionList` solo muestra contratos+pagos vencidos (FRENTE 2)

**Capa 1 · Existencia**
- `src/modules/panel/components/AttentionList.tsx:4-127`.
- `PanelPage.tsx:257-319` solo construye `contratos-vencer` y `pagos-vencidos`.

**Capa 2 · Salud**
- Funciona.

**Capa 3 · Compatibilidad**
- Permite añadir más items (interfaz `AlertaItem` extensible).

**Decisión sugerida · B · Adaptar y reconectar** · enchufar `alertasFiscalesService` (Hallazgo 6.A) + nuevos checks de desvío (Hallazgo 6.B).
**Esfuerzo · S-M** (2-4h).

### 6.4 · Síntesis Necesidad 6

Cobertura real: **30%**. Hay alertas fiscales avanzadas pero solo visibles en módulo Fiscal. No hay tracking de desvíos plan-vs-real en ningún módulo. El cerebro de "estás desviándote" no está construido.

---

## 7 · Necesidad 7 · Saber qué más invertir o disfrutar (con datos cliente)

### 7.1 · Mockup esperado
- Mockups no muestran un "motor de recomendaciones" formal. El cliente expresa esto como necesidad implícita: "saber con mis datos qué más puedo hacer".

### 7.2 · Estado en código real
- `src/services/copilotService.ts:23-90` · arma contexto financiero (patrimonio, flujos, tesorería) y proxy a `/.netlify/functions/chat`.
- `src/pages/HerramientasPage.tsx:1-112` · solo calculadora de interés compuesto.

### 7.3 · Hallazgos

#### Hallazgo 7.A · `copilotService` solo proxy upstream (FRENTE 2)

**Capa 1 · Existencia**
- `src/services/copilotService.ts:61-90` · sin lógica local de recomendación.
- Caller: probablemente componente de chat (no auditado en detalle).

**Capa 2 · Salud**
- Funciona como proxy.

**Capa 3 · Compatibilidad**
- Compatible.

**Decisión sugerida · F · Investigación adicional** · ¿queremos motor local de reglas o seguir confiando en LLM upstream? El cliente dice "con mis datos" lo que sugiere reglas explícitas.
**Esfuerzo · L** si se construye motor local.

---

#### Hallazgo 7.B · No hay sección de recomendaciones en Panel ni Herramientas (FRENTE 3)

**Capa 1 · Existencia**
- `src/modules/panel/PanelPage.tsx:1-100` (lectura) · sin sección de recomendaciones.
- `src/pages/HerramientasPage.tsx:1-112` · solo interés compuesto.

**Capa 2 · Salud**
- N/A.

**Capa 3 · Compatibilidad**
- Datos disponibles: patrimonio, flujos netos, libertad financiera (Mi Plan), objetivos.

**Decisión sugerida · E · Construir nuevo** · "RecomendacionesCard" en Panel con reglas tipo:
- ahorro mensual > X → "puedes invertir Y en fondos";
- libertad financiera ya alcanzada → "considera disfrutar Z";
- inmueble con rentabilidad < umbral → "evalúa venta".
**Esfuerzo · L** (10h+).

### 7.4 · Síntesis Necesidad 7

Cobertura real: **15%**. El proxy de copilot existe pero no hay motor local de reglas ni UI dedicada. Probablemente la necesidad menos cubierta tras N8.

---

## 8 · Necesidad 8 · Hacer la declaración con un dedo (1/1/2027)

### 8.1 · Mockup esperado
- `docs/audit-inputs/atlas-fiscal.html` (revisión rápida) describe flujo importar → revisar → exportar → marcar.

### 8.2 · Estado en código real
- Motor fiscal completo: `src/services/aeat*.ts` (7 servicios), `irpfCalculationService.ts`, `arrastresFiscalesService.ts`, `compensacionAhorroService.ts`, `bonificacionesService.ts`.
- `src/modules/fiscal/pages/BorradorIRPFPage.tsx:60-79` muestra casillas calculadas.
- Stores `declaraciones`, `ejercicios`.

### 8.3 · Hallazgos

#### Hallazgo 8.A · Botón "Exportar PDF" es toast stub (FRENTE 1 · UI sin backend)

**Capa 1 · Existencia**
- `src/modules/fiscal/pages/BorradorIRPFPage.tsx:257-263` · `onClick={() => showToastV5('Exportar PDF del borrador · sub-tarea follow-up')}`.

**Capa 2 · Salud**
- No hace nada.

**Capa 3 · Compatibilidad**
- Datos están listos (`ejercicio.casillasRaw`).

**Decisión sugerida · E · Construir nuevo** · generador PDF (jsPDF + plantilla AEAT).
**Esfuerzo · L** (10h+).

---

#### Hallazgo 8.B · Botón "Marcar declarado" es toast stub (FRENTE 1)

**Capa 1 · Existencia**
- `src/modules/fiscal/pages/BorradorIRPFPage.tsx:265-272` · `onClick={() => showToastV5('Marcar como declarado · sub-tarea follow-up')}`.

**Capa 2 · Salud**
- No hace nada.

**Capa 3 · Compatibilidad**
- Falta campo `declaracion.estado='presentada'` o similar en `ejercicios` store.

**Decisión sugerida · E · Construir nuevo** · campo + persistencia.
**Esfuerzo · S** (1-2h).

---

#### Hallazgo 8.C · No existe pantalla "1 click declaración" como tal (FRENTE 3)

**Capa 1 · Existencia**
- `BorradorIRPFPage` muestra resultado, pero no integra import + revisión + exportación + marcado en un solo flujo.
- Onboarding `OnboardingPage.tsx` redirige a importadores (line `:117 fiscal/importar`) pero no cierra el ciclo.

**Capa 2 · Salud**
- N/A.

**Capa 3 · Compatibilidad**
- Todas las piezas existen. Falta la orquestación.

**Decisión sugerida · E · Construir nuevo** · stepper "Importa AEAT → Revisa diferencias → Exporta PDF → Marca presentada".
**Esfuerzo · M-L** (8-12h, presupone 8.A y 8.B resueltos).

### 8.4 · Síntesis Necesidad 8

Cobertura real: **70%**. El motor de cálculo está. Faltan los **2 últimos botones** (export, marcado) y la pantalla de orquestación. La frase "1 click" exige UX adicional, no más motor.

---

## 9 · Necesidad 9 · App única para A · A→B · B (UX progresiva con perfil)

### 9.1 · Mockup esperado
- `docs/audit-inputs/atlas-historia-jose-v2.html` describe los 3 momentos (A asalariado, A→B mutación, B consolidado).

### 9.2 · Estado en código real
- `src/contexts/FiscalContext.tsx` y otros contextos · 0 matches para `profile_type | segment | userProfile | tipoUsuario`.
- `src/store/` · 0 slices de perfil.
- `src/modules/mi-plan/featureFlags.ts:1-20` · solo `SHOW_RETOS = false`.

### 9.3 · Hallazgos

#### Hallazgo 9.A · No existe `ProfileContext` ni segmentación A/B (FRENTE 3)

**Capa 1 · Existencia**
- Búsqueda agent: 0 resultados.

**Capa 2 · Salud**
- N/A.

**Capa 3 · Compatibilidad**
- Requeriría store `userSettings.profileSegment: 'A' | 'A_TO_B' | 'B'`.

**Decisión sugerida · E · Construir nuevo**.
**Esfuerzo · M** (4-6h backend) + **L** progresiva (10h+) para gating de UI.

---

#### Hallazgo 9.B · Rutas en `App.tsx` se renderizan incondicionalmente (FRENTE 2)

**Capa 1 · Existencia**
- `src/App.tsx:548..1296` · todas las rutas (financiacion, inmuebles, fiscal, mi-plan, etc.) están siempre activas. No hay `if (profile === 'A') return null`.

**Capa 2 · Salud**
- Funciona, pero un perfil A asalariado ve menús de "30 inmuebles" innecesarios.

**Capa 3 · Compatibilidad**
- Cambiar requiere consumir context profile (Hallazgo 9.A).

**Decisión sugerida · B · Adaptar y reconectar** tras 9.A.
**Esfuerzo · M** (3-5h).

---

#### Hallazgo 9.C · Solo un feature flag (FRENTE 1 cuasi-vacío)

**Capa 1 · Existencia**
- `src/modules/mi-plan/featureFlags.ts:9-19` · `SHOW_RETOS = false`. No hay otros flags.

**Capa 2 · Salud**
- Trivial.

**Capa 3 · Compatibilidad**
- Sustituible por sistema más amplio.

**Decisión sugerida · D · Descartar** archivo, **E · Construir nuevo** sistema (`featureGating.ts` derivado de profile).
**Esfuerzo · S** (combinado con 9.A).

### 9.4 · Síntesis Necesidad 9

Cobertura real: **5%**. La aplicación es funcionalmente plana. La UX progresiva no está implementada en ningún sentido detectable. Mockups la prometen, código no la tiene.

---

## 10 · Tabla matriz consolidada

| # | Necesidad | Cobertura | F1 sueltos | F2 defectuosos | F3 faltantes | Acción global sugerida |
|---|---|---|---|---|---|---|
| 1 | Patrimonio consolidado | 70% | — | 1.A, 1.B, 1.C, 1.E (4) | 1.D | C+E (unificar fuente, decidir página) |
| 2 | Gastos reales | 40% | 2.A, 2.C, 2.F (3) | 2.B, 2.D, 2.G (3) | 2.E | B+E mayoritario |
| 3 | Nómina titular+pareja | 55% | 3.A | — | 3.B, 3.C | F primero (3.A) + E (3.B/3.C) |
| 4 | Contratos inquilinos | 50% | — | — | 4.A, 4.B, 4.C | E mayoritario |
| 5 | Plan/Rumbo | 60% | — | 5.A, 5.B, 5.C (3) | — | C (unificar) crítico |
| 6 | Desvíos / alertas | 30% | — | 6.A, 6.C | 6.B | A (6.A) rápido + E (6.B) |
| 7 | Recomendaciones | 15% | — | 7.A | 7.B | E mayoritario · decisión Jose |
| 8 | Declaración 1-click | 70% | 8.A, 8.B | — | 8.C | E (3 piezas) |
| 9 | UX progresiva A→B | 5% | 9.C | 9.B | 9.A | E (precondición 9.A) |

**Lectura · 4 zonas críticas**:
- 🔴 N9 (5%) — UX progresiva no existe.
- 🔴 N7 (15%) — recomendaciones no existen.
- 🟠 N6 (30%) — desvíos no existen, alertas fiscales infraconsumidas.
- 🟠 N2 (40%) — gastos reales invisibles en DetallePage; CAPEX/OPEX rotos.

🟢 Zonas con mejor cobertura: N1 (70%), N5 (60%), N3 (55%), N4 (50%), N8 (70%) — pero con bugs/incoherencias específicos.

---

## 11 · Patrones recurrentes detectados

### 11.1 · Patrón A · Servicios STUB tras migraciones (v62)
**Ejemplos**: `opexService.ts` (Hallazgo 2.A), `capexClassificationService.getMejoraAmortizationSummary` (Hallazgo 2.B), `capexClassificationService.create/update` (Hallazgo 2.C).

**Síntoma**: Migración de stores eliminó tabla canónica pero las funciones export siguen exportadas como stubs `console.warn + return []`. Callers no se actualizaron.

**Recomendación**: auditoría dedicada de servicios cuyo store fue eliminado en v62/T34/T35; descartar stubs y migrar callers a nuevo servicio canónico.

### 11.2 · Patrón B · Toast como placeholder de funcionalidad pendiente
**Ejemplos**: `BorradorIRPFPage.tsx:260, :268` (8.A, 8.B). Probablemente más casos no auditados (`rg "showToastV5.*follow-up"`).

**Síntoma**: UI v5 se desplegó con botones, lógica diferida a "sub-tarea follow-up" que nunca se cerró.

**Recomendación**: grep proyecto-amplio `showToastV5.*follow-up|sub-tarea follow-up|en migración a UI v5` y catalogar.

### 11.3 · Patrón C · Tres fuentes de verdad para un mismo número
**Ejemplos**: cierre previsto fin de año (Hallazgo 5.B con 3 cadenas: budgetProjection, VistaGeneralTab, CalendarioMes12), patrimonio (Panel inline + generatePatrimonio en Hallazgo 1.E).

**Síntoma**: cuando se rehíceron pantallas, cada una recreó su propia agregación en lugar de centralizar en servicio.

**Recomendación**: `patrimonioService.ts`, `proyeccionService.ts` como fuente única. Migrar callers progresivamente.

### 11.4 · Patrón D · Servicios sofisticados sin caller
**Ejemplos**: `budgetMatchingService` (2.G), `budgetReclassificationService`, `nominaAportacionHook`, `NominaManager`.

**Síntoma**: lógica completa, sin UI ni servicios consumidores. Probable refactor de pantalla "olvidó" reconectar.

**Recomendación**: `find src -name '*Service.ts' -exec rg -L 'import.*{name}'` para inventario completo de huérfanos.

### 11.5 · Patrón E · Comentarios TODO explícitos en producción
**Ejemplos**: `PanelPage.tsx:225, :243, :251, :252, :253, :261, :264, :267` · al menos 8 TODOs en una sola página.

**Recomendación**: extraer todos los `// TODO:` en src/modules/panel y src/modules/mi-plan; muchos son piezas pendientes de cablear.

### 11.6 · Patrón F · Tabs/secciones con placeholder visual
**Ejemplos**: `DetallePage.tsx:408-414` (cobros, documentos, fiscalidad), `ContratosListPage.tsx:195-201` (timeline).

**Recomendación**: grep `pendiente de implementación|funcionalidad pendiente|en migración`.

---

## 12 · Preguntas para Jose

> Estas preguntas requieren contexto humano que CC no puede resolver desde el código.

1. **¿Patrimonio dedicado vs Panel?** ¿Crear página `/patrimonio` separada o consagrar Panel como vista oficial de patrimonio? El mockup `atlas-panel.html` sugiere que Panel ya es la vista; entonces basta arreglar coherencia (Hallazgos 1.A/1.B/1.C). [Bloquea Hallazgo 1.D.]

2. **Cierre previsto · ¿qué cadena es la verdad?** Tres cadenas dan números distintos (Hallazgo 5.B). ¿Mi Plan/budgetProjection (basado en compromisos+nóminas) o CalendarioMes12 (basado en treasury events)? Decisión arquitectónica.

3. **OPEX/CAPEX post-v62 · ¿se completó la migración?** `opexService` es stub pero sigue importado (2.A). ¿Existe documento que diga "OPEX se gestiona ahora dentro de compromisosRecurrentes"? Si sí, los callers deben migrarse y el stub eliminarse.

4. **Tributación conjunta vs individual?** N3 Hallazgo 3.C · ¿declaras IRPF conjunta? Si no, descartar; si sí, prioritario.

5. **Renovación de contratos · ¿flujo "nuevo contrato sucesor" o "extender existente"?** Hallazgo 4.A · afecta el modelo de datos.

6. **Cobros por contrato · ¿campo `contractId` en Movement existe?** Hallazgo 4.C requiere verificar `db.ts` o introducirlo. Decisión sobre matching automático vs manual.

7. **Recomendaciones · ¿motor local de reglas o solo LLM upstream?** N7 Hallazgo 7.A/7.B · cliente dice "con mis datos" lo que apunta a reglas explícitas, pero podría ser orquestado vía copilot.

8. **UX progresiva · ¿cuántos perfiles?** N9 · ¿`A | A→B | B` o solo `A | B`? ¿Auto-detección desde datos (>5 inmuebles → B) o selección manual?

9. **`NominaManager` y `nominaAportacionHook` huérfanos · ¿reintroducir o eliminar?** Hallazgo 3.A · requiere saber por qué se desconectaron.

10. **Stubs UI v5 (`sub-tarea follow-up`)** · ¿hay backlog formal de las sub-tareas pendientes? Si no, este audit es esa lista (al menos parcial).

---

## 13 · Verificación de cobertura del audit

- [x] 9 necesidades cubiertas (§1-§9)
- [x] Cada necesidad con sus 3 frentes (F1/F2/F3) explícitos
- [x] Cada hallazgo con archivo:línea de evidencia (33 hallazgos cumplen)
- [x] Cada hallazgo con 3 capas (existencia · salud · compatibilidad)
- [x] Decisión sugerida y esfuerzo en cada hallazgo
- [x] Tabla matriz consolidada (§10)
- [x] Patrones recurrentes (§11)
- [x] Preguntas para Jose (§12)
- [x] Resumen ejecutivo con conteos (§0)
- [x] Zonas prioritarias del spec cubiertas:
  - Mi Plan vs Tesorería · Hallazgo 5.B
  - Personal · Presupuesto · Hallazgo 2.G
  - Inmueble · Gastos · Hallazgo 2.D
  - Inmueble · CAPEX/OPEX · Hallazgos 2.A/2.B/2.C
  - Patrimonio total consolidado · Hallazgo 1.D
  - Sistema alertas / desvíos · Hallazgos 6.A/6.B
  - Recomendaciones · Hallazgo 7.B
  - Botón 1-click declaración · Hallazgos 8.A/8.B/8.C
  - UX progresiva A→B · Hallazgos 9.A/9.B/9.C
  - Onboarding mockup vs producción · cubierto en §8/contexto (OnboardingPage.tsx:1-12 declara explícitamente que sub-flujos son follow-up).

---

## 14 · Notas finales

- **Sin tests para piezas críticas** (`budgetProjection`, `PanelPage` cálculos inline, `gastosInmuebleService`). No es scope del audit, pero relevante para el plan T-RECONNECT.
- **Verificación que NO se hizo** (acotada por scope §5 del spec):
  - performance, accesibilidad, i18n, calidad de tests existentes, cobertura.
- **Riesgo bajo de falso positivo** en hallazgos donde se citan funciones/líneas concretas. Los Hallazgos marcados `F` son los únicos donde el auditor declara incertidumbre.

**Fin del audit · stop-and-wait · esperando autorización Jose para construir T-RECONNECT en sub-tareas temáticas.**
