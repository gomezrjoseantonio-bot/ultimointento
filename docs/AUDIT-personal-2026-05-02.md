# AUDITORÍA · Módulo Personal · estado real

> Fecha · 2026-05-02
> Repo · `gomezrjoseantonio-bot/ultimointento` · branch `main` · DB_VERSION 67 (post-T27.3)
> Tipo · auditoría de lectura · NO modifica código · NO crea features
> Spec contraste · `docs/audit-inputs/ATLAS-Personal-modelo-datos-v1.md` (v1.1 · 25 abril 2026 · 864 líneas)

---

## 0 · Síntomas observados

Reportados por Jose en producción (`https://ultimointentohoy.netlify.app/personal`):

- **NO se ven datos** del usuario · pese a haber introducido información en sesiones anteriores
- **Wizards antiguos persisten** · UI no respeta el modelo de datos v1.1 cerrado
- **Dispersión histórica conocida** · `personalData` · `personalModuleConfig` · `viviendaHabitual` · `escenarios` · `keyval` con info fragmentada
- HANDOFF V8 §8.7 · "Personal · estado parcial · no validado en producción"
- TAREA 14 pendiente sobre dispersión fiscal `personalData/personalModuleConfig/viviendaHabitual/escenarios`

---

## 1 · Modelo de datos vs spec v1.1

### 1.1 · Materialización de stores y tipos

| Entidad spec v1.1 | ¿Existe? | DB version | Tipo (path) | Servicio (path) | Notas |
|---|---|---|---|---|---|
| `personalData` | ✅ | V1.2 | `src/types/personal.ts:33–58` | `src/services/personalDataService.ts` | Activo. Ampliado con CCAA, descendientes, ascendientes, tributación |
| `personalModuleConfig` | ✅ | V1.2 | `src/types/personal.ts:556–568` | `src/services/db.ts:2075` | Activo |
| `ingresos` (unión `nomina\|autonomo\|pension\|otro`) | ✅ | V61 | `src/types/personal.ts:402` (union) | `src/services/db.ts:2093` + adaptadores | **Store unificado** post-T7. Adaptadores: `nominaService`, `autonomoService`, `otrosIngresosService`, `pensionService` filtran por `tipo` |
| `nominas` (legacy) | ❌ ELIMINADO V63 | — | tipo aún declarado en `src/types/personal.ts:63–128` | leído sólo vía `ingresos` con `tipo='nomina'` | `db.ts:3703` borra el store |
| `autonomos` (legacy) | ❌ ELIMINADO V63 | — | `src/types/personal.ts:274–298` | leído vía `ingresos` con `tipo='autonomo'` | `db.ts:3704` |
| `pensiones` (legacy) | ❌ ELIMINADO V63 | — | `src/types/personal.ts:323–336` | leído vía `ingresos` con `tipo='pension'` | `db.ts:3705` |
| `otrosIngresos` (legacy) | ❌ ELIMINADO V63 | — | `src/types/personal.ts:480–495` | leído vía `ingresos` con `tipo='otro'` | `db.ts:3706` |
| `viviendaHabitual` | ✅ | V5.3 | `src/types/viviendaHabitual.ts:134–147` | `src/services/personal/viviendaHabitualService.ts` | Discriminado 3-vías (`inquilino` / `propietarioSinHipoteca` / `propietarioConHipoteca`) |
| `compromisosRecurrentes` | ✅ | V5.3 | `src/types/compromisosRecurrentes.ts:139–191` | `src/services/personal/compromisosRecurrentesService.ts` | Store unificado con `ambito: 'personal' \| 'inmueble'` (G-01) |
| `opexRules` | ❌ ELIMINADO V62 | — | — | migrado a `compromisosRecurrentes` con `ambito='inmueble'` | `db.ts:2234` (0 registros) |
| `presupuestoPersonal` | ❌ NUNCA SE CREÓ | — | — | — | Spec v1.1 lo asume; existe en cambio `presupuestos` (H9) + `presupuestoLineas`, sin enlace claro a Personal |
| `patronGastosPersonales` | ❌ ELIMINADO V62 | — | — | `src/services/patronGastosPersonalesService.ts` (stub no-op) | Spec lo marca DEPRECAR ✅ cumplido |
| `gastosPersonalesReal` | ❌ ELIMINADO V62 | — | — | — | Spec lo marca ELIMINAR ✅ cumplido |
| `planesPensiones` | ✅ | V65 | `src/types/planesPensiones.ts` | `src/services/planesPensionesService.ts` | Módulo independiente (T13) |
| `aportacionesPlan` | ✅ | V65 | `src/types/planesPensiones.ts` | `src/services/planesPensionesService.ts` | Destino G-07 |
| `treasuryEvents` | ✅ | V9+ | `src/types/db.ts` | `src/services/db.ts:2062` | Destino único de eventos generados |

### 1.2 · Reglas duras del spec v1.1 · cumplimiento

| Regla | Estado | Evidencia |
|---|---|---|
| A · Rentas alquiler NO viven en `otrosIngresos` (deben vivir en `contracts` + `rentaMensual`) | ✅ Se cumple | `IngresoOtro` no incluye `'alquiler'` como subtipo (`src/types/personal.ts:362–400`); `contracts.rentaMensual` en `src/services/db.ts:660,688` |
| B · `hipoteca` y `alquilerVivienda` NO son `TipoCompromiso` | ✅ Se cumple (compile-time) | `TipoCompromiso` en `src/types/compromisosRecurrentes.ts:59–66` sólo enumera `suministro\|suscripcion\|seguro\|cuota\|comunidad\|impuesto\|otros` |
| C · `viviendaHabitual` genera eventos directos en `treasuryEvents` sin pasar por `compromisosRecurrentes` | ✅ Se cumple | `generarEventosVivienda()` en `src/services/personal/viviendaHabitualService.ts:113–142`; eventos con `sourceType: 'contrato' \| 'gasto_recurrente'` sin intermediario; `regenerarEventosVivienda()` invocado al guardar (línea 95) |
| D · `opexRules` y `compromisosRecurrentes` unificados con `ambito` | ✅ Se cumple | `src/types/compromisosRecurrentes.ts:142–145`; comentario migración en `src/services/db.ts:2234` |
| E · Variable/bonus se proyectan al 100% (sin `factorRealizacion`) | ✅ Se cumple | `NominaVariableObjetivo` en `src/types/personal.ts:167–171` sin campo factor; grep en repo no encuentra `factorRealizacion` |
| F · Beneficios en especie NO generan `treasuryEvents` (G-03) | 🟡 Parcial | Por diseño (`beneficiosSociales` no entra en pipeline de eventos). NO hay guard explícito; comentario en `src/services/personal/nominaAportacionHook.ts:15–16` documenta la regla |
| G · Aportación plan pensiones automática al confirmar payroll en Tesorería (G-07) | 🟠 **HOOK NO CABLEADO** | Hook `onNominaConfirmada()` implementado en `src/services/personal/nominaAportacionHook.ts:43–111` y exportado desde `src/services/personal/index.ts:21`. **PERO `confirmTreasuryEvent()` en `src/services/treasuryConfirmationService.ts:289–538` NO lo invoca.** Función queda código muerto |
| H · Ahorro a `cajaLiquida` cuenta para target 20% del presupuesto | ❌ No se ha podido verificar | Categoría `'ahorro.cajaLiquida'` definida en `src/types/compromisosRecurrentes.ts:100,122–123`. NO existe `presupuestoPersonal`; cálculo presunto en `presupuestos`/`presupuestoLineas` (H9), sin enlace localizado al módulo Personal |

---

## 2 · Componentes UI · página y wizards

Coexisten **DOS implementaciones de "Personal"**:

### 2.1 · V5 · `src/modules/personal/` · ACTIVA en producción

- **Entry**: `src/modules/personal/PersonalPage.tsx`
- **Ruta**: `/personal` (App.tsx:978–1023)
- **Sidebar**: `config/navigation.ts:74–79`
- **Sub-páginas (5 tabs + 2 anidadas)**:
  - `pages/PanelPage.tsx` · tab "Panel"
  - `pages/IngresosPage.tsx` · tab "Ingresos"
  - `pages/GastosPage.tsx` · tab "Gastos"
  - `pages/ViviendaPage.tsx` · tab "Mi vivienda"
  - `pages/PresupuestoPage.tsx` · tab "Presupuesto"
  - `pages/DetectarCompromisosPage.tsx` · `/personal/gastos/detectar-compromisos`
  - `import/ImportarNominas.tsx` · `/personal/importar-nominas`
- **Wizards propios**: NINGUNO (delega en hub legacy)

### 2.2 · Legacy · `src/pages/GestionPersonal/` · ACTIVA como hub de wizards

- **Entry**: `src/pages/GestionPersonal/GestionPersonalPage.tsx`
- **Ruta**: `/gestion/personal` (App.tsx:1057–1076) · NO en sidebar · accesible vía CTAs desde V5
- **Tabs**: `TabIngresos.tsx`, `TabGastos.tsx`
- **Wizards (3)**:
  - `wizards/NominaWizard.tsx` · `/gestion/personal/nueva-nomina` · ✅ funcional · cubre v1.1 (empresa, contrato, distribucion, variables, especies, SS) · falta `variableObjetivo` explícito según spec G-02
  - `wizards/AutonomoWizard.tsx` · `/gestion/personal/nuevo-autonomo` · ✅ funcional · tramos SS 2026 hardcoded
  - `wizards/OtrosIngresosWizard.tsx` · `/gestion/personal/otros-ingresos` · ✅ funcional · 8 tipos · ⚠️ incluye `'alquiler'` y `'dividendo'` como tipos · choca con regla A del spec
- **Plus**: `MisPlanesPensiones.tsx` · UI vinculada a planes de pensiones (T13)

### 2.3 · UI específicas v1.1 esperadas

| Pieza esperada | ¿Implementada? | Path | Notas |
|---|---|---|---|
| UI creación/edición `viviendaHabitual` | 🟡 Sólo CTAs | `src/modules/personal/pages/ViviendaPage.tsx` | Renderiza tarjetas con CTAs hacia otros módulos · NO formulario propio · servicio `viviendaHabitualService` listo pero sin UI |
| UI configurar beneficios en especie | 🟡 Embebido en NominaWizard | `wizards/NominaWizard.tsx` (via `BeneficioSocial`) | No hay sección dedicada |
| UI presupuesto personal (50/30/20) | ✅ | `pages/PresupuestoPage.tsx` | Solo método 50/30/20; zero-base no implementado |

---

## 3 · Pestañas / sub-secciones del módulo (V5 producción)

| Sección esperada (mockup `atlas-personal-v3.html`) | Implementada | Path | Estado |
|---|---|---|---|
| Datos personales (CCAA · tributación · descendientes · ascendientes) | ❌ | — | No hay tab; campos viven en `personalData` y se editan desde `/ajustes/fiscal` |
| Vivienda habitual | 🟡 Placeholder | `pages/ViviendaPage.tsx` | Sólo CTAs · sin formulario de alta vivienda |
| Ingresos (nómina · variable · bonus · especies · pensión · autónomo · otros) | ✅ | `pages/IngresosPage.tsx` + wizards en hub | Funcional |
| Gastos recurrentes (compromisosRecurrentes ámbito personal) | ✅ | `pages/GastosPage.tsx` + `DetectarCompromisosPage.tsx` | Funcional |
| Presupuesto (50/30/20) | ✅ | `pages/PresupuestoPage.tsx` | Sólo 50/30/20 |
| Presupuesto zero-base | ❌ | — | No implementado |
| Ahorro (tab dedicado) | 🟡 Derivado | computado en `PresupuestoPage.tsx` | No hay tab independiente |
| Aportaciones plan pensiones (cruce con T13) | ❌ | — | No hay tab; vista existente en `src/pages/GestionPersonal/MisPlanesPensiones.tsx` no se enlaza desde V5 |

---

## 4 · Acceso al módulo y experiencia inicial

- **Path real**: `/personal` (sidebar "Personal" · `mis-activos`)
- **Carga de datos en `PersonalPage.tsx:46–63`**:
  ```ts
  const [n, a, o, c] = await Promise.all([
    db.getAll('nominas'),       // ❌ store eliminado V63
    db.getAll('autonomos'),     // ❌ store eliminado V63
    db.getAll('otrosIngresos'), // ❌ store eliminado V63
    db.getAll('compromisosRecurrentes'),
  ]);
  ```
  El `try/catch` envuelve todo el `Promise.all`. **Si cualquier `getAll` rompe (porque V63 borró el store), `setNominas/Autonomos/OtrosIngresos` quedan en su estado inicial `[]`.** Los datos reales viven en `ingresos`.
- **Empty states**: cada sub-página renderiza `EmptyState` cuando los arrays están vacíos (ej. `IngresosPage.tsx:21` → "Sin fuentes de ingreso" + CTA a `/gestion/personal`).
- **Onboarding**: `personalOnboardingService.ts` SÍ existe (312 LOC) · pero sólo lo invoca `declaracionDistributorService.ts:33` y `declaracionOnboardingService.ts:15` (rama Fiscal, no Personal). NO hay disparo automático desde `/personal` la primera vez.

---

## 5 · Generación de eventos a Tesorería

| Origen | Servicio | Estado |
|---|---|---|
| Nómina (vía store `ingresos.tipo='nomina'`) | `treasurySyncService.generateMonthlyForecasts()` (`src/modules/horizon/tesoreria/services/treasurySyncService.ts:432–467`) | ✅ Wired · genera eventos mensuales con `sourceType: 'nomina'`, `status: 'predicted'`, control duplicados |
| Vivienda habitual | `generarEventosVivienda()` + casos `inquilino`/`propietarioSinHipoteca`/`propietarioConHipoteca` (`viviendaHabitualService.ts:113–142, 144–435`) | ✅ Wired · directo a `treasuryEvents` sin intermediario · `regenerarEventosVivienda()` invocado al guardar (línea 95) |
| Compromiso recurrente (ámbito personal e inmueble) | `generarEventosDesdeCompromiso()` + `regenerarEventosCompromiso()` (`compromisosRecurrentesService.ts:259–410`) | ✅ Wired · expande con `expandirPatron()` (`patronCalendario.ts:121+`, 8 patrones) · invocado en `crearCompromiso()` (línea 78) y `actualizarCompromiso()` (línea 111) |
| Autónomo (cuotas RETA, M130, M303) | NO localizado en módulo Personal · spec v1.1 §2.1 patrón D dice que vive en Fiscal | ❌ Verificación fuera de alcance Personal |
| Otros ingresos | NO localizado generador específico | ❌ No localizado |

---

## 6 · Presupuesto personal · estado actual

- **Entidad `presupuestoPersonal`** · NO existe como store. Spec v1.1 la nombra implícitamente; código tiene `presupuestos` (H9) + `presupuestoLineas` en `src/services/db.ts:2066–2067` · sin enlace localizado a Personal.
- **UI**: `src/modules/personal/pages/PresupuestoPage.tsx` (no inspeccionada en detalle, pero presente y referenciada como funcional por la auditoría UI)
- **Cálculo tasa de ahorro vs target**: no se ha podido verificar enlace con `cajaLiquida`.
- **Cruce con `cajaLiquida` para 20% objetivo**: sólo categoría declarada (`compromisosRecurrentes.ts:100,122–123`), sin lógica localizada.
- **Modo zero-base**: ❌ no implementado.

---

## 7 · TODOs y FIXMEs activos

Búsqueda en `src/modules/personal/`, `src/pages/GestionPersonal/`, `src/services/personal/` y servicios `personal*Service.ts`, `nominaService.ts`, `autonomoService.ts`, `otrosIngresosService.ts`:

- `src/services/limitesFiscalesPlanesService.ts:161` · `// TODO: verificar casillas exactas en modelo IRPF vigente` · informativo, no bloqueante.

**No se encontraron TODOs/FIXMEs accionables en módulos Personal.**

---

## 8 · Cruce con planes de pensiones (T13)

- **Servicios**: `src/services/planesPensionesService.ts`, `src/services/limitesFiscalesPlanesService.ts`, `src/services/traspasosPlanesService.ts` (T13 cerrado).
- **Stores V65**: `planesPensiones`, `aportacionesPlan` (declarados en `db.ts:2097–2098`).
- **Hook G-07**: `src/services/personal/nominaAportacionHook.ts`
  - `onNominaConfirmada(evento, nomina)` (líneas 43–111) · calcula aportación titular + empresa, escribe en `aportacionesPlan` con `origen: 'nomina_vinculada'`, idempotente (verifica duplicado líneas 86–95).
  - Wrapper `procesarConfirmacionEvento(evento)` (líneas 117–127) · filtra por `sourceType === 'nomina'` y `status === 'confirmed' \| 'executed'`.
  - **Exportado** desde `src/services/personal/index.ts:21`.
- **🟠 Hallazgo crítico** · `confirmTreasuryEvent()` en `src/services/treasuryConfirmationService.ts:289–538` **NO importa ni llama** a `procesarConfirmacionEvento()` ni a `onNominaConfirmada()`. El único `dynamic import` (líneas 525–531) es para `finalizePropertySaleLoanCancellationFromTreasuryEvent`. **G-07 está implementado pero NUNCA se ejecuta**.
- **MisPlanesPensiones.tsx** existe en `src/pages/GestionPersonal/` pero no se enlaza desde V5 `/personal`.

---

## 9 · Hallazgos laterales · bugs detectados (NO arreglados)

### B1 · 🔴 PersonalPage.tsx lee de stores eliminados (CAUSA RAÍZ "no se ven datos")
- `src/modules/personal/PersonalPage.tsx:48–63` hace `db.getAll('nominas')`, `db.getAll('autonomos')`, `db.getAll('otrosIngresos')`.
- Esos stores fueron **borrados** en V63 (`db.ts:3702–3717`).
- IndexedDB lanzará `NotFoundError` al abrir la transacción · el `catch` general sólo logea por consola y deja los `useState` en `[]`.
- Servicios canónicos (ej. `nominaService.getNominas()` en `nominaService.ts:98–112`) leen correctamente de `ingresos` filtrando por `tipo`. La página NO los usa.
- **Síntoma directo**: aunque haya nóminas/autónomos/otros ingresos en `ingresos`, la página los muestra vacíos.

### B2 · 🟠 G-07 hook implementado pero no invocado (cruce nómina ⇆ aportación)
- Ver §8. `nominaAportacionHook.ts` es código muerto.

### B3 · 🟠 OtrosIngresosWizard incluye tipos `'alquiler'` y `'dividendo'`
- `src/pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx:15–24` ofrece esos tipos en el selector.
- Spec v1.1 §1.1 (Regla de alcance): **alquileres → `contracts/rentaMensual`** · **dividendos → `inversiones`**. Permitir alta como "otros ingresos" contradice la regla A.

### B4 · 🟡 ViviendaPage placeholder
- `pages/ViviendaPage.tsx` sólo presenta tarjetas CTA · NO formulario de alta `viviendaHabitual`. El servicio `viviendaHabitualService` está listo pero queda sin consumidor UI propio.

### B5 · 🟡 Tipos legacy `Nomina`, `Autonomo`, `PensionIngreso`, `OtrosIngresos` siguen exportados en `src/types/personal.ts`
- Stores fueron borrados V63, pero los tipos siguen vivos para que adaptadores los usen como forma de la unión `Ingreso`. Aceptable, pero invita a usos legacy (ver B1).

### B6 · 🟡 `personalOnboardingService` (312 LOC) sólo se llama desde el flujo de declaración fiscal
- `declaracionDistributorService.ts:33` y `declaracionOnboardingService.ts:15` son los únicos consumidores. La página `/personal` NO dispara onboarding al primer acceso.

### B7 · 🟡 Doble entrada `Personal` (V5) y `Gestión Personal` (legacy hub)
- V5 usa el hub legacy para wizards · acoplamiento sin documentar; no se navega de vuelta limpio entre rutas `/personal/*` y `/gestion/personal/*`.

### B8 · ❌ Tab "Datos personales" inexistente en V5
- Spec v1.1 §1.1 + mockup la esperan como sección Personal. Hoy esos campos se editan desde `/ajustes/fiscal`.

### B9 · ❌ `presupuestoPersonal` nunca materializado
- Spec asume la entidad. Existe `presupuestos` H9 sin enlace a Personal. Cálculo del 50/30/20 cumplimiento (regla H) no localizado.

### B10 · ⚠️ Beneficios en especie (G-03) sin guard explícito
- Por diseño no entran al pipeline de `treasuryEvents`, pero no hay test/aserción que blinde la regla. Riesgo bajo · documentar.

---

## 10 · Diagnóstico (8 preguntas)

1. **¿El módulo Personal en producción muestra datos cuando los hay?**
   🟠 **NO · bug de wiring**. `PersonalPage.tsx:48–63` lee stores `nominas/autonomos/otrosIngresos` borrados en V63; los datos reales viven en `ingresos`. Ver B1.

2. **¿El modelo v1.1 está implementado · parcial · ausente?**
   ✅ **Implementado en alto grado**. 8 de 8 reglas duras: 6 ✅, 1 🟡 (F especies), 1 🟠 (G hook no cableado), 1 ❌ (H presupuesto). Stores legacy migrados (V61–V63), nuevos creados (V5.3 · V65).

4. **¿Cuántos wizards activos hay y cuántos son legacy?**
   3 wizards (Nomina, Autonomo, OtrosIngresos) · todos en hub `/gestion/personal/*` · funcionales pero arquitectónicamente legacy (no hay v5 propios). NominaWizard cubre v1.1 con gaps (`variableObjetivo` no explícito); OtrosIngresosWizard viola regla A (B3).

5. **¿Qué pestañas del mockup están funcionales · cuáles placeholder · cuáles ausentes?**
   - Funcionales: Panel · Ingresos · Gastos · Presupuesto (sólo 50/30/20)
   - Placeholder: Mi vivienda (sólo CTAs · sin formulario)
   - Ausentes: Datos personales · Aportaciones plan pensiones · Ahorro standalone · Presupuesto zero-base

6. **¿La generación de eventos a Tesorería desde Personal funciona?**
   ✅ Sí para los tres cauces principales: nómina (`treasurySyncService.generateMonthlyForecasts`), vivienda habitual (`generarEventosVivienda`), compromisos recurrentes (`generarEventosDesdeCompromiso`).

7. **¿El presupuesto personal está implementado?**
   🟡 Parcial · sólo método 50/30/20 en UI; entidad `presupuestoPersonal` no existe como store; no se localiza enlace con cálculo de cumplimiento ni con `cajaLiquida` (regla H).

8. **¿La dispersión fiscal (TAREA 14) sigue presente?**
   🟡 Parcial · stores legacy ya consolidados (V61–V63), pero los datos fiscales del titular siguen viviendo dispersos entre `personalData` (situación, CCAA, descendientes), `personalModuleConfig` (UI), `viviendaHabitual` (datos catastrales que afectan IRPF) y `escenarios` (no auditado en este pase). La consolidación que la spec v1.1 supone (G-09) está hecha en stores nuevos, pero los datos preexistentes podrían no haberse migrado.

9. **¿El cruce nómina ⇆ aportación plan pensiones está cableado?**
   🟠 **NO**. Hook `onNominaConfirmada` implementado pero `confirmTreasuryEvent()` no lo invoca (B2).

---

## 11 · Tabla síntoma → causa raíz

| Síntoma | Causa raíz | Severidad | Archivo principal |
|---|---|---|---|
| No se ven datos en Personal | `PersonalPage.tsx` lee stores `nominas/autonomos/otrosIngresos` eliminados en V63 (datos viven en `ingresos`) | 🔴 Alta | `src/modules/personal/PersonalPage.tsx:48–63` |
| Wizards antiguos persisten | V5 no tiene wizards propios · delega en hub legacy `/gestion/personal/*` (3 wizards) | 🟡 Media | `src/pages/GestionPersonal/wizards/*` + ruteo en `App.tsx:1057–1076` |
| Dispersión fiscal personalData/etc | Stores nuevos consolidados pero datos preexistentes en `personalData`, `personalModuleConfig`, `viviendaHabitual`, `escenarios` no validados; tab "Datos personales" inexistente · campos editables sólo desde `/ajustes/fiscal` | 🟡 Media | `src/types/personal.ts:33–58`, `src/types/viviendaHabitual.ts` |
| Pestañas placeholder | `ViviendaPage.tsx` sólo CTAs sin formulario; tabs Datos personales · Aportaciones plan · Ahorro · Presupuesto zero-base ausentes | 🟡 Media | `src/modules/personal/pages/ViviendaPage.tsx`, `src/modules/personal/PersonalPage.tsx:18–35` |
| Eventos a Tesorería ausentes/incorrectos | Funcionan los 3 cauces principales (nómina, vivienda, compromisos). NO localizado generador para autónomos (cuotas RETA · M130 · M303) ni `otrosIngresos` | 🟡 Media | `treasurySyncService.ts:432`, `viviendaHabitualService.ts:113`, `compromisosRecurrentesService.ts:259` |
| Presupuesto sin UI | `PresupuestoPage.tsx` sólo cubre 50/30/20; entidad `presupuestoPersonal` nunca materializada; no se localiza enlace con `cajaLiquida` y target 20% | 🟡 Media | `src/modules/personal/pages/PresupuestoPage.tsx`, `src/services/db.ts:2066–2067` |
| Cruce nómina-aportación ausente | Hook `onNominaConfirmada` implementado pero `confirmTreasuryEvent()` no lo invoca (función queda código muerto) | 🟠 Alta | `src/services/personal/nominaAportacionHook.ts:43–127`, `src/services/treasuryConfirmationService.ts:289–538` |

---

## 12 · Recomendación de descomposición de T30

| Sub | Qué cubriría | Esfuerzo CC | Bloqueante para mercado |
|---|---|---|---|
| T30.1 | **Hotfix wiring `PersonalPage.tsx`** · sustituir `db.getAll('nominas'/'autonomos'/'otrosIngresos')` por `nominaService.getAllActiveNominas()` + `autonomoService.getAll()` + `otrosIngresosService.getAll()` (todos leen de `ingresos`). Resolver B1 | 1–2h | **Sí** (la página está rota en producción) |
| T30.2 | **Wire G-07 hook** · invocar `procesarConfirmacionEvento(evento)` desde `confirmTreasuryEvent()` cuando `sourceType === 'nomina'` y status pasa a `confirmed/executed`. Resolver B2 | 1–2h | Alta (decisión cerrada G-07 sin efecto real) |
| T30.3 | **Tab "Datos personales" en V5** · formulario con `personalData` completo (CCAA · tributación · descendientes · ascendientes · discapacidad). Reemplaza dependencia de `/ajustes/fiscal`. Resolver B8 | 4–6h | No (actualmente accesible vía Ajustes) |
| T30.4 | **UI vivienda habitual** · formulario completo con casos `inquilino`/`propietarioSinHipoteca`/`propietarioConHipoteca`. Servicio backend listo. Resolver B4 | 6–10h | Media |
| T30.5 | **Sanea OtrosIngresosWizard** · quitar tipos `alquiler` y `dividendo`, redirigir a Inmuebles/Inversiones; añadir subtipos canónicos del spec (`premio`, `indemnizacion`, `beca`, `regalo`, `otro`). Resolver B3 | 2–3h | Sí (viola regla A) |
| T30.6 | **Tab Aportaciones plan pensiones en V5** · enlazar `MisPlanesPensiones.tsx` (T13) o reescribir bajo `/personal/aportaciones-plan`. Resolver gap mockup | 3–5h | No (T13 cerrado, sólo falta surface) |
| T30.7 | **Materializar `presupuestoPersonal` o enlazar con H9** · UI 50/30/20 + cálculo cumplimiento incluyendo `cajaLiquida`; opcional zero-base. Resolver B9 + regla H | 8–12h | No (UI parcial existe) |
| T30.8 | **Generación eventos autónomo / otros ingresos** · servicios análogos a `nominaService` para proyectar a `treasuryEvents` (cuotas RETA · trimestres fiscales · ingresos otrosIngresos recurrentes) | 6–10h | Media |
| T30.9 | **Migrar wizards al árbol V5** · eliminar dependencia de `/gestion/personal` o dejar sólo como ruta interna. Resolver B7 | 4–6h | No (cosmético/arquitectónico) |
| T30.10 | **Auditar consolidación fiscal de datos preexistentes** (T14 retomada) · script de saneamiento `personalData` · `personalModuleConfig` · `viviendaHabitual` · `escenarios` para detectar duplicados/orfandades. Resolver T14 + B5 | 4–6h | No |

**Recomendación de orden** · T30.1 (hotfix de producción) → T30.2 (G-07) → T30.5 (regla A violada) → T30.3/T30.4 (cubrir mockup) → resto.

---

Generated by Claude Code (auditoría Personal-pre · 2026-05-02)
