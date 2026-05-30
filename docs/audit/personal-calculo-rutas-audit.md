# Auditoría · Consolidación módulo Personal · cálculo único + deprecar `/gestion/personal`

> Commit 1 · `chore(audit)` · NO se toca código.
> Resultado del grep obligatorio (§ 0.2) y reporte de hallazgos (§ 0.3).
> **Stop-and-wait** · esperar confirmación de Jose antes de continuar (commit 2+).

---

## 0 · Resumen ejecutivo (lo importante)

El bug de "números que mienten" tiene una causa raíz clara y **más amplia de lo
que la spec anticipaba**:

**Existen 2 motores de cálculo de nómina distintos:**

| Motor | Fichero | Quién lo usa | ¿Correcto? |
|---|---|---|---|
| `calcularNomina(input)` | `src/services/nominaCalculatorService.ts` | **SOLO** el preview del wizard (`NominaPage.tsx`) | ✅ SÍ (el que ve Jose: 4.007,99 €) |
| `nominaService.calculateSalary(nomina, year)` | `src/services/nominaService.ts:517` | **TODO LO DEMÁS** (cards, panel, Tesorería, Mi Plan, Proyección Mensual) | ❌ produce las cifras mentirosas (5.801 €) |

El wizard (la verdad) es el ÚNICO que NO usa `calculateSalary`. Todas las demás
vistas consumen `calculateSalary` (directamente o vía helpers). Por eso el wizard
acierta y todo lo demás miente.

**Para autónomo hay 3 motores distintos** (peor todavía):

| Motor | Fichero | Definición de "neto" | Quién lo usa |
|---|---|---|---|
| `getMonthlyDistribution` | `autonomoService.ts:449` | `ingresos − gastos − cuotaRETA` (SIN IRPF) | cards, panel, presupuesto (vía helpers) |
| `calculateEstimatedAnnualForAutonomos` | `autonomoService.ts:416` | `facturación − gastos` (SIN cuota, SIN IRPF) `/12` | dashboard Horizon |
| preview inline del wizard | `AutonomoWizard.tsx:584` | `ingreso − retenciónIRPF − cuotaRETA` | SOLO el wizard de autónomo |

Las 3 definiciones de "neto" de autónomo son distintas → cada vista enseña un número distinto.

---

## 1 · Tabla de verificación (§ 0.3)

| Verificación | Resultado | Acción |
|---|---|---|
| Funciones distintas que calculan "neto mensual" de nómina | **2 motores** (`calculateSalary` vía 5 helpers + `calcularNomina`) | Unificar en 1 |
| Funciones distintas que calculan "neto anual" de nómina | **2** (`calculateSalary.totalAnualNeto` / `calcularNomina.netoAnual`) | Unificar en 1 |
| Funciones distintas de autónomo (cuotaRETA + retenciones) | **3 motores** (ver arriba) | Unificar en 1 |
| Componente que sirve `/gestion/personal` | `src/pages/GestionPersonal/GestionPersonalPage.tsx` (+ `components/Tab*`, `Header`) | Eliminar |
| Quién hace el redirect post-save de nómina | `NominaPage.tsx:533` → `navigate('/gestion/personal')` | Cambiar a `/personal/ingresos` |
| Quién hace el redirect post-save de autónomo | `AutonomoWizard.tsx:332` → `navigate('/gestion/personal')` | Cambiar a `/personal/ingresos` |
| ¿Hay `Link`/`NavLink` hacia `/gestion/personal`? | **0** (sólo `navigate(...)`) — confirmado lo que decía Jose | Cambiar los `navigate` |
| ¿Tesorería / Mi Plan leen del cálculo legacy? | **SÍ, ambos** + Proyección Mensual (no previsto en spec) | Migrar los 3 al service único |

---

## 2 · Inventario de funciones de cálculo

### 2.1 · Nómina

**Motor canónico (correcto):**
- `nominaCalculatorService.calcularNomina(input)` — `src/services/nominaCalculatorService.ts:106`
  - Función pura. Input plano (estado del formulario), output desglose 12 meses + totales.
  - Pagas extra configurables (`mesesPagaExtra`), variables/bonus por mes, SS con tope, IRPF, PP empleado, cuota solidaridad.

**Motor legacy (mentiroso):**
- `nominaService.calculateSalary(nomina, year)` — `src/services/nominaService.ts:517`
  - Mismo esqueleto pero: paga extra **hardcodeada a meses 6 y 12** si `distribucion.tipo==='catorce'`, resolución por snapshots históricos (`applySnapshot`), variables vía `distribucionMeses[].porcentaje`, deducciones adicionales.
  - **Aquí está la divergencia que produce 5.801 € en vez de 4.007,99 €.** (causa raíz exacta a confirmar en commit 2 al portar los casos de Jose a tests).

**Wrappers helper (todos delegan en `calculateSalary`):** `src/modules/personal/helpers.ts`
- `computeNominaNetoEnMes` (124) · `computeNominaNetoPorMes` (143) · `computeNominaNetoAnual` (161)
- `computeNominaBrutoEnMes` (43) · `computeNominaBrutoAnual` (63)

### 2.2 · Autónomo
- `autonomoService.getMonthlyDistribution` / `...ForAutonomos` — `autonomoService.ts:449/453`
- `autonomoService.calculateEstimatedAnnual` / `...ForAutonomos` — `autonomoService.ts:412/416`
- preview inline en `AutonomoWizard.tsx` (≈ línea 580-585)
- Wrappers helper: `computeAutonomoNetoEnMes` (182) · `computeAutonomoNetoPorMes` (198) · `computeAutonomoNetoAnual` (213) · `computeAutonomoIngreso*`

---

## 3 · Inventario de componentes/servicios que muestran cifras

| Vista / servicio | Fichero | Motor que usa hoy | Acción |
|---|---|---|---|
| Card Ingresos (Neto anual / Neto mes) | `modules/personal/pages/IngresosPage.tsx` | `computeNomina*` + `computeAutonomo*` (legacy) | Migrar a service único |
| Panel · INGRESOS DEL MES + gráfico 12m | `modules/personal/pages/PanelPage.tsx` | `computeNominaNetoPorMes` + `computeAutonomoNetoPorMes` | Migrar |
| Presupuesto Personal | `modules/personal/pages/PresupuestoPage.tsx` | `computeNominaNetoEnMes` + `computeAutonomoNetoEnMes` | Migrar |
| Tesorería · cobros previstos | `modules/horizon/tesoreria/services/treasurySyncService.ts:447` | `calculateSalary` | Migrar |
| Mi Plan · proyección | `modules/mi-plan/services/budgetProjection.ts:102` | `calculateSalary` | Migrar |
| Proyección Mensual *(no previsto en spec)* | `modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts:706` | `calculateSalary` | Migrar |
| Dashboard Horizon `trabajo` *(autónomo)* | `services/dashboardService.ts:984` | `calculateEstimatedAnnualForAutonomos` | Apunte (ver § 5) |
| **Vista antigua a borrar** | `pages/GestionPersonal/GestionPersonalPage.tsx` + `components/TabIngresos.tsx`, `TabGastos.tsx`, `GestionPersonalHeader.tsx`, `SourceCard.tsx`, `GastoRow.tsx` | — | Eliminar |
| Wizard nómina (canónico) | `pages/GestionPersonal/wizards/NominaPage.tsx` | `calcularNomina` | Mover ruta + usar service |
| Wizard autónomo | `pages/GestionPersonal/wizards/AutonomoWizard.tsx` | preview inline | Mover ruta + usar service |

---

## 4 · Rutas (Problema B)

**Definición actual** — `src/App.tsx`:
- `1274` `gestion/personal` → `GestionPersonalPage` (DEPRECAR)
- `1279` `gestion/personal/nueva-nomina` → `NominaWizardPage` (MOVER a `/personal/nomina/:id/editar` y `/personal/nomina/nueva`)
- `1284` `gestion/personal/nuevo-autonomo` → `AutonomoWizardPage` (MOVER a `/personal/autonomo/:id/editar` y `/personal/autonomo/nuevo`)
- `1289` `gestion/personal/otros-ingresos` → `OtrosIngresosWizardPage` (no está en la spec — ver § 5)

**`navigate('/gestion/personal*')` a actualizar:**
- `PanelPage.tsx:168` · `IngresosPage.tsx:40,50,58,66,102,181,265,289`
- `TabIngresos.tsx:101,140,185,234,253,333,373` (en la vista que se borra)
- `OtrosIngresosWizard.tsx:191,388` · `AutonomoWizard.tsx:332,651` · `NominaPage.tsx:533`

**No hay `Link`/`NavLink`** hacia `/gestion/personal` → confirmado. Solo `navigate()`.

---

## 5 · Hallazgos NO previstos en la spec (requieren decisión de Jose)

1. **Proyección Mensual** (`proyeccionMensualService.ts`) también usa el motor legacy
   `calculateSalary`. La spec sólo mencionaba Tesorería y Mi Plan. ¿Se migra también? (recomendado: sí).
2. **Dashboard Horizon** (`dashboardService.ts`) usa un **tercer** motor de autónomo
   (`calculateEstimatedAnnualForAutonomos`). La nómina en dashboard está muerta (`ingresos = []`,
   store borrado en V44). ¿Migrar el autónomo del dashboard al service único o dejarlo como apunte?
3. **Wizard "Otros ingresos"** (`OtrosIngresosWizard`) vive bajo `/gestion/personal/otros-ingresos`
   y la spec NO dice qué hacer con él. Al borrar `/gestion/personal` hay que decidir su nueva ruta
   (propuesta: `/personal/otros-ingresos/*`).
4. El motor legacy `calculateSalary` está **muy acoplado** al modelo `Nomina` (snapshots históricos
   `applySnapshot`, `distribucionMeses`, `deduccionesAdicionales`) que el wizard NO usa. La función
   canónica `calcularNetoMesNomina(nomina, mes, año)` tendrá que mapear `Nomina → CalcularNominaInput`
   y reproducir el snapshot por mes. Hay que confirmar que ese mapeo no pierde el historial de cambios.

---

## 6 · Plan propuesto (commits 2-5) — pendiente de OK de Jose

- **Commit 2** · crear `nominaCalculoService.ts` + `autonomoCalculoService.ts` (funciones únicas que
  envuelven la lógica del wizard sobre un `Nomina`/`Autonomo`), con tests del caso real de Jose.
- **Commit 3** · migrar cards/panel/presupuesto a los services únicos; eliminar helpers legacy.
- **Commit 4** · mover wizards a `/personal/nomina/*` y `/personal/autonomo/*`, redirects → `/personal/ingresos`,
  migrar Tesorería + Mi Plan (+ Proyección Mensual si Jose confirma).
- **Commit 5** · eliminar `/gestion/personal`, limpiar legacy + docs.
