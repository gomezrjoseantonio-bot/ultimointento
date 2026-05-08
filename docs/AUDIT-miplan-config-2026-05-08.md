# T-MIPLAN-CONFIG-AUDIT · Mini-auditoría Mi Plan · escenario libertad · botón Configurar · pestaña Mi vivienda

> Fecha · 2026-05-08
> Repo · `gomezrjoseantonio-bot/ultimointento` · branch `claude/audit-miplan-config-hJgyS`
> Tipo · Solo lectura · NO modifica código · NO toca DB (DB_VERSION=69, 40 stores)
> Predecesor · T-NOMINAS-CLEANUP mergeada (PR #1285)
> Predecesores documentales relevantes ·
>   - `docs/AUDIT-mi-plan-landing-libertad-2026-05-02.md` (auditoría hermana, contexto T27.4-pre)
>   - `docs/ADR-libertad-financiera-parametrizable.md` (regla canónica STANDARD + parametrización)
>   - `docs/STORES-MI-PLAN-v3.md` (modelo singleton `escenarios`)
>   - `docs/audit-inputs/atlas-mi-plan-v2*.html` (mockup)

---

## 0 · Preflight

- ✅ Branch `claude/audit-miplan-config-hJgyS` activo · árbol limpio.
- ✅ DB_VERSION sin cambios · no se toca código.
- ✅ Predecesor `AUDIT-mi-plan-landing-libertad-2026-05-02.md` revisado · esta mini-audit es **complementaria** (foco distinto · botón Configurar header + Ajustes + Mi vivienda + cálculo 113 % en landing) y NO entra en colisión con su recomendación de descomposición T27.4.x.
- ⚠️ Cambios materiales desde `2026-05-02` · sí han ocurrido. La función pura `proyectarRentaPasivaLibertad` (T27.4.1) y el wrapper `proyectarLibertadDesdeRepo` con su hook `useProyeccionLibertad` (T27.4.2) **ya existen y están conectados** a la card libertad de la landing y al MiPlanCompass del Panel V5. Este audit lo refleja en §6.

---

## 1 · Resumen ejecutivo · tabla de hallazgos por área

| # | Área | Estado global | Cable suelto principal | Severidad |
|---|---|---|---|---|
| 1 | Botón "Configurar escenario" header Mi Plan | ❌ Ghost (toast only) | `MiPlanPage.tsx:127` y `LibertadPage.tsx:29` disparan `showToastV5('… sub-tarea follow-up')` · no hay drawer/wizard | Alta |
| 2 | Pestañas /ajustes/* | ❌ 7 pestañas · **mockup high-fidelity · cero persistencia** | Toda la sección Ajustes es UI estática · 0 imports de servicios · 0 `db.put` · ~60 handlers disparan `showToastV5` · toggles con `useState` local que se pierden al navegar. NO existe pestaña ni sub-card para `libertadConfig` · `gastosVidaLibertadMensual` · `modoVivienda` · `estrategia` | **Crítica** |
| 3 | Entidad escenario libertad | 🟡 Backend completo · UI inexistente | Tipo `Escenario` (singleton) + tipo `LibertadConfig` + servicio + función pura + hook → todo cableado · pero NO existe pantalla de edición humana (sólo defaults `ESCENARIO_DEFAULTS` aplicados ciegamente) | Media |
| 4 | Personal · Mi vivienda | 🟠 Pantalla informativa con 5 redirects · 1 ghost | Comentario header dice "El store `viviendaHabitual` se creará en sub-tarea follow-up" · pero el store **YA existe** desde V60+ con servicio completo `viviendaHabitualService` · la página no lo usa · documentación rota | Alta |
| 5 | Horizonte temporal / meta libertad | 🟡 Existe como parámetro `horizonteAnios` (default 25) | Sin UI de edición · no existe campo "fechaJubilacion" / "targetDate" · el cruce libertad se descubre, no se fija | Baja |
| 6 | Cálculo "113 % cobertura" | ✅ Real · NO ghost | Función pura `proyectarRentaPasivaLibertad` · serie mensual con inflación · cruce real · pctCobertura = renta neta contratos / gastosVida (default 2 500 €) | OK · sin acción |

> **Conclusión 30 s · post re-auditoría exhaustiva (§11)** · el backend de libertad (T27.4.1+T27.4.2) está construido y funciona. Lo que falta es **la UI de configuración** y, sorpresivamente, **mucho más mockup del esperado**:
> - Sección `/ajustes/*` COMPLETA es mockup high-fidelity (§3, §11.A excluido) · 0 persistencia · ~60 botones-toast.
> - Wizard manual `NuevoContratoWizard.tsx` también es mockup (§11.A · §11.D) · única vía persistente para crear contratos es el importador Rentila · esto impacta directamente al input principal del cálculo 113 %.
> - Singleton `Escenario` sin escritura UI · ni macro (modoVivienda · gastosVida · estrategia) ni hitos (`addHito` con tests pero cero callers UI).
> - Pestaña Personal · Mi vivienda no aprovecha el store `viviendaHabitual` existente (comentario header obsoleto).
> 
> Lo que sí persiste real · wizards de Préstamos, Gastos personales/inmueble, Objetivos, Fondos. Lectura de DB · landing Mi Plan, Panel V5, todas las páginas de visualización del módulo Mi Plan.
> 
> La incoherencia "landing 113 % vs Libertad financiera 'Sin escenario configurado'" se explica en §7: ambos leen del mismo singleton, pero el `EmptyState` de LibertadPage dispara cuando `escenario === null` (singleton no creado todavía en DB), mientras que la landing usa el wrapper `proyectarLibertadDesdeRepo` que rellena con `ESCENARIO_DEFAULTS` y nunca devuelve null.

---

## 2 · Área 1 · Botón "Configurar escenario" del header Mi Plan

### 2.1 · Localización

| Punto de entrada | Archivo · línea | onClick | Destino real |
|---|---|---|---|
| Header global de Mi Plan (PageHead `actions`) | `src/modules/mi-plan/MiPlanPage.tsx:124-131` | `() => showToastV5('Editar escenario · sub-tarea follow-up')` | ❌ Ninguno · toast |
| EmptyState de la pestaña Libertad financiera (cuando `escenario === null`) | `src/modules/mi-plan/pages/LibertadPage.tsx:24-30` (CTA `ctaLabel="Configurar escenario"`) | `onCtaClick={() => showToastV5('Editar escenario · sub-tarea follow-up')}` | ❌ Ninguno · toast |

### 2.2 · Comportamiento real

```ts
// src/modules/mi-plan/MiPlanPage.tsx:124-131
actions={[
  {
    label: 'Configurar escenario',
    variant: 'ghost',
    icon: <Icons.Ajustes size={14} strokeWidth={1.8} />,
    onClick: () => showToastV5('Editar escenario · sub-tarea follow-up'),
  },
]}
```

```ts
// src/modules/mi-plan/pages/LibertadPage.tsx:24-30
<EmptyState
  icon={<Icons.Libertad size={20} />}
  title="Sin escenario configurado"
  sub="Configura tu escenario de libertad financiera (modo vivienda · gastos vida · estrategia) en Ajustes para activar la trayectoria."
  ctaLabel="Configurar escenario"
  onCtaClick={() => showToastV5('Editar escenario · sub-tarea follow-up')}
/>
```

### 2.3 · Veredicto

- ❌ **Ghost button** · ambos puntos de entrada hacen exactamente lo mismo: muestran un toast con el texto literal *"sub-tarea follow-up"*. No navegan, no abren drawer, no hay ruta destino.
- El sub-text del EmptyState **promete** *"Configura tu escenario de libertad financiera (modo vivienda · gastos vida · estrategia) en Ajustes"* · pero el destino esperado **NO existe**: ver §3 (Ajustes no tiene esa pestaña).
- **Ghost route detectada · doble** · el copy menciona "Ajustes" pero el handler no navega ahí, y aunque navegase no hay sección que reciba al usuario.
- Idéntico al hallazgo §10 fila "Botón Configurar escenario" del audit `2026-05-02` · ese audit lo proponía cubrir en sub-tarea T27.4.6. **A 6 días vista, sigue sin ejecutarse.**

---

## 3 · Área 2 · Pestañas de Ajustes en producción

### 3.1 · Estructura de routing

`src/App.tsx:1235-1276` cuelga `/ajustes/*` con index → `/ajustes/perfil`. `src/modules/ajustes/AjustesPage.tsx:14-22` declara la sidebar con 7 ítems.

> **Corrección · CRÍTICA.** En primera lectura marqué las 7 páginas como "✅ funcional" tras leer sólo los headers (`PageHead`, `SetSection`, `SetRow`). Verificación profunda posterior demuestra que **toda la sección Ajustes es un mockup high-fidelity sin persistencia**.

### 3.2 · Verificación de persistencia · grep duro

```bash
grep -rn "import.*service\|from.*services\|initDB\|db\.put\|db\.get" \
     src/modules/ajustes/pages/*.tsx src/modules/ajustes/AjustesPage.tsx
# → 0 resultados
```

**Cero imports de servicios o DB en TODA la sección Ajustes.** El único `import` de no-design-system es de `react`. La sidebar y todas las sub-páginas son 100 % UI estática.

### 3.3 · Inventario página por página

| # | Path | Archivo · líneas | useState locales | Llamadas DB/servicio | Handlers reales | Botones-toast | Veredicto |
|---|---|---|---|---|---|---|---|
| 1 | `/ajustes/perfil` | `PerfilPage.tsx` (218) | 3 (`agrupado`, `tutoriales`, `resumenSemanal`) | 0 | 0 | ~10 (`'Cambiar foto'`, `'Cambiar idioma'`, `'Cambiar zona horaria'`, …, `'Cambios del perfil guardados'`) | ❌ Mockup |
| 2 | `/ajustes/plan` | `PlanPage.tsx` (245) | 0 | 0 | 0 | ~10 (`'Cambiar tarjeta'`, `'Editar dirección'`, `'Cambiar plan'`, `'Pausar suscripción'`, `'Cancelar suscripción'`, …) | ❌ Mockup puro |
| 3 | `/ajustes/integraciones` | `IntegracionesPage.tsx` (230) | 0 | 0 | 0 | 4 (cada card pulsada → `data.toast`; "Añadir nueva integración"; "Añadir nuevo banco"; "Próximas · Unihouser · Idealista …") | ❌ Mockup puro |
| 4 | `/ajustes/notificaciones` | `NotificacionesPage.tsx` (292) | 3 (`concentracion`, `resumenSemanal`, `resumenDiario`) | 0 | 0 | ~17 (cada `SetRow.Link` y el botón "Guardar" disparan toast) | ❌ Mockup |
| 5 | `/ajustes/plantillas` | `PlantillasPage.tsx` (179) | 0 | 0 | 0 | 2 (`'Editar plantilla · …'`, `'Crear nueva plantilla'`) + `tpl` arrays hardcoded | ❌ Mockup puro |
| 6 | `/ajustes/fiscal` | `PerfilFiscalPage.tsx` (186) | 1 (`parejaActiva`) | 0 | 0 | ~7 (`'Cambiar nombre'`, `'Cambiar fecha'`, `'Cambiar estado civil'`, `'Cambiar CCAA'`, `'Datos guardados · recalculando IRPF previsto'`, …) | ❌ Mockup |
| 7 | `/ajustes/seguridad` | `SeguridadPage.tsx` (227) | 2 (`twoFa`, `biometria`) | 0 | 0 | ~10 (`'Cambiar contraseña'`, `'Generar nuevos códigos'`, `'Cerrar sesión · {device}'` con sesiones hardcoded, `'Solicitar exportación'`, `'Iniciar proceso eliminación'`) | ❌ Mockup |

- **Toggles** · cada `Switch` cambia un `useState` local que vive en el componente · **al navegar a otra sub-pestaña y volver, el estado se resetea al default**.
- **Botones "Guardar"** · disparan `showToastV5('Cambios guardados', 'success')` sin escribir nada en DB. Texto literal en `PerfilPage.tsx:44`, `PerfilFiscalPage.tsx:39`, `NotificacionesPage.tsx:25`.
- **Sesiones activas en SeguridadPage** · array `sessions` hardcoded en el propio componente (no lee de DB).
- **Histórico facturas en PlanPage** · array hardcoded.
- **Plantillas en PlantillasPage** · array hardcoded.

### 3.4 · Lo único que SÍ funciona

- ✅ **Sidebar de 7 ítems** · navegación entre sub-pestañas (`AjustesPage.tsx:24-69`).
- ✅ **Routing y redirects legacy** `/cuenta/*` → `/ajustes/*` (`App.tsx:1288-1310`).

Eso es todo. La capa de chrome (PageHead, sidebar, layout) está construida; el contenido es mockup.

### 3.5 · ¿Alguna pestaña toca "escenario libertad"?

`grep -rn 'libertad|vivienda|gastos vida|escenario|modoVivienda' src/modules/ajustes/`:

- **0 ocurrencias relevantes para escenario libertad.** Las matches encontradas son ·
  - `PerfilFiscalPage.tsx:20` · texto informativo sobre deducción IRPF arrendamiento vivienda habitual (mockup).
  - `PlanPage.tsx:29,64` · "Simulador libertad financiera" como bullet de features del plan PRO (mockup).
  - `PlantillasPage.tsx:42,45,113` · plantillas contractuales alquiler vivienda (mockup).

`grep -rn 'libertadConfig|saveEscenarioActivo|setLibertadConfig' src/modules/ajustes/` · **0 resultados**.

### 3.6 · Cables sueltos

> **C-2 · Sub-pestaña "Escenario libertad" inexistente en Ajustes.** No es solo que falte la pestaña 8ª — el problema es estructural: la sección entera es mockup, así que no existe ni un patrón de referencia "página Ajustes que persiste" a copiar.

> **C-2b · Sección Ajustes completa es mockup sin persistencia.** Las 7 sub-páginas existentes son UI estática · 0 imports de servicios · 0 escrituras a DB · ~60 botones disparan `showToastV5`. Los `useState` locales (~9 totales) cambian estado volátil que se pierde al navegar. Botones "Guardar" mienten · disparan toast `'Cambios guardados'` sin guardar nada. Esto era invisible en mi audit inicial porque solo verifiqué que los componentes renderizaran headers; la regla operativa correcta es **grep `db.put|service.` antes de marcar "✅ funcional"**.

---

## 4 · Área 3 · Entidad de datos "escenario libertad"

### 4.1 · Tipos · existe y bien estructurado

| Archivo | Líneas | Contenido |
|---|---|---|
| `src/types/miPlan.ts:22-44` | Interface `Escenario` (singleton id=1) | `modoVivienda`, `gastosVidaLibertadMensual`, `estrategia`, `hitos[]`, `rentaPasivaObjetivo?`, `patrimonioNetoObjetivo?`, `cajaMinima?`, `dtiMaximo?`, `ltvMaximo?`, `yieldMinimaCartera?`, `tasaAhorroMinima?`, **`libertadConfig?: LibertadConfig`** (T27.4.1), `updatedAt` |
| `src/types/miPlan.ts:14-20` | Interface `Hito` | `id`, `fecha`, `tipo` (`compra`/`venta`/`revisionRenta`/`amortizacionExtraordinaria`/`cambioGastosVida`), `impactoMensual`, `descripcion` |
| `src/types/libertad.ts:11-50` | Interface `LibertadConfig` | `alcanceRentaPasiva`, `reglaCruce`, `mantenimientoMinMeses?`, `colchonPctSobreGastos?`, `horizonteAnios` |
| `src/types/libertad.ts:55-59` | Constante `STANDARD_LIBERTAD_CONFIG` | `{ alcanceRentaPasiva: 'alquiler-neto', reglaCruce: 'simple', horizonteAnios: 25 }` |
| `src/types/libertad.ts:65-77` | Interface `DatosRealesLibertad` | `rentaPasivaActualMensual`, `gastosVidaMensual`, `hitos`, `mesReferencia` |
| `src/types/libertad.ts:90-104` | Interface `SupuestosLibertad` + `SUPUESTOS_NEUTROS_LIBERTAD` | `inflacionAnualPct`, `subidaAnualRentasPct`, `subidaAnualGastosVidaPct?` |
| `src/types/libertad.ts:109-132` | Interface `ResultadoLibertad` + `PuntoSerieLibertad` | `cruceLibertad`, `serie`, `pctCoberturaActual`, `faltaMensualActual`, `faltanTexto` |

### 4.2 · Store en DB

- `escenarios` · singleton (`keyPath: 'id'` siempre = 1) · creado en V5.5 según comentario del audit predecesor.
- `src/services/db.ts:2304` declara `viviendaHabitual: ViviendaHabitual` como otro store relevante (ver Área 4).
- DB_VERSION actual = **69**, 40 stores · sin cambios respecto a la spec.

### 4.3 · Servicio de acceso

| Archivo · línea | Símbolo | Estado |
|---|---|---|
| `src/services/escenariosService.ts:18-33` | `ESCENARIO_DEFAULTS` (constante) | ✅ Defaults razonables · **`gastosVidaLibertadMensual: 2500`**, `rentaPasivaObjetivo: 3_000`, `dtiMaximo: 35`, `ltvMaximo: 50`, `yieldMinimaCartera: 8`, `tasaAhorroMinima: 15` |
| `src/services/escenariosService.ts:37-52` | `getEscenarioActivo()` | ✅ Lee de DB · si no existe singleton, devuelve `ESCENARIO_DEFAULTS` (no persiste) |
| `src/services/escenariosService.ts:56-70` | `saveEscenarioActivo(partial)` | ✅ Merge + put · pero **no es invocado desde UI ninguna** (ver §4.5) |
| `src/services/escenariosService.ts:74-83` | `resetEscenario()` | ✅ Funcional · sin caller UI |
| `src/services/escenariosService.ts:87-118` | `addHito` / `updateHito` / `removeHito` | ✅ Funcionales · sin caller UI |

### 4.4 · Función pura + hook React

| Archivo · línea | Símbolo | Estado |
|---|---|---|
| `src/services/libertadService.ts:28-136` | `proyectarRentaPasivaLibertad(datos, supuestos, config)` | ✅ Función pura · serie mensual · cruce libertad · pctCobertura · faltanTexto · 100 % testable · tests en `src/services/__tests__/libertadService.test.ts` (8 casos) |
| `src/services/libertadService.ts:142-176` | `proyectarLibertadDesdeRepo(supuestos?, configOverride?)` | ✅ Wrapper · carga `escenario`, calcula `rentaPasivaActualMensual` desde contratos+inmuebles+préstamos, llama a la función pura |
| `src/services/libertadService.ts:192-239` | `calcularRentaPasivaActual()` | ✅ Suma rentas brutas contratos activos − OPEX confirmados/declarados · 12 − cuota francesa de préstamos vinculados a inmuebles activos |
| `src/hooks/useProyeccionLibertad.ts` | `useProyeccionLibertad(options)` | ✅ Hook React · acepta `supuestos`, `configOverride`, `enabled` · expone `{data, loading, error}` |

### 4.5 · Conectividad UI

| Consumidor | Archivo · línea | Lectura | Escritura |
|---|---|---|---|
| Card "Libertad financiera" landing Mi Plan | `src/modules/mi-plan/pages/LandingPage.tsx:14,49,121-149` | ✅ `useProyeccionLibertad()` | ❌ |
| MiPlanCompass del Panel V5 | `src/modules/panel/PanelPage.tsx:35,107` | ✅ `useProyeccionLibertad()` | ❌ |
| Página `/mi-plan/libertad` (KPIStrip + gráfica + hitos) | `LibertadPage.tsx:18-19,34-37` | 🟡 Lee `escenario` del outlet context (singleton) · NO usa el hook ni la función pura · gráfica reconstruye trayectoria inline con `rentaActual = 0` hardcoded (l. 132) | ❌ |
| **Cualquier pantalla de escritura** | — | — | ❌ **NINGUNA** · `saveEscenarioActivo` no tiene caller en `src/modules/` |

`grep -rn 'saveEscenarioActivo|addHito|updateHito|removeHito' src/ --exclude-dir=__tests__` ·

```
src/services/escenariosService.ts:56:export async function saveEscenarioActivo(...)
src/services/escenariosService.ts:87:export async function addHito(...)
src/services/escenariosService.ts:93:  await saveEscenarioActivo({ hitos: ... });
src/services/escenariosService.ts:99:export async function updateHito(...)
src/services/escenariosService.ts:108: await saveEscenarioActivo({ hitos: newHitos });
src/services/escenariosService.ts:114:export async function removeHito(...)
src/services/escenariosService.ts:117: await saveEscenarioActivo({ hitos: newHitos });
```

**Cero callers en código de producción/UI** (`src/modules/`, `src/hooks/`, `src/pages/`, etc.). Sí existen llamadas desde tests · `src/__tests__/escenariosService.test.ts:19-23,106,120,146,172,193` · que cubren los 4 métodos del servicio. Conclusión · el servicio está cubierto por tests pero ningún componente UI lo invoca · el singleton vive de los defaults aplicados por `getEscenarioActivo()`.

### 4.6 · Veredicto

- ✅ **Backend completo y bien diseñado** · sigue al pie de la letra el ADR `libertad-financiera-parametrizable` (STANDARD + parametrización + función pura + tests).
- ❌ **Cero UI de escritura** · todo el set de campos de `Escenario` (10+) y `LibertadConfig` (5) es invisible para el usuario. Sólo viven los `ESCENARIO_DEFAULTS` aplicados ciegamente.
- 🟡 La pestaña Libertad financiera **no usa** la función pura ni el hook · sigue con la SVG inline + `rentaActual = 0` hardcoded del audit predecesor (T27.4.3 sin ejecutar).

### 4.7 · Cable suelto · C-3

> **C-3 · Singleton `escenarios` huérfano de UI de escritura.** El backend está construido siguiendo el ADR canónico, pero ningún componente de `src/modules/` invoca `saveEscenarioActivo` ni `addHito/updateHito/removeHito`. El usuario no puede personalizar ni un solo campo · el singleton vive de los defaults.

---

## 5 · Área 4 · Pestaña Personal · Mi vivienda

### 5.1 · Localización y routing

- Componente · `src/modules/personal/pages/ViviendaPage.tsx` (196 líneas)
- Routing · `src/App.tsx:1057-1061` lo cuelga en `/personal/vivienda`
- Tab declarada en `src/modules/personal/PersonalPage.tsx:38` · `{ key: 'vivienda', label: 'Mi vivienda', path: '/personal/vivienda' }`

### 5.2 · Lógica · informativa con redirects

`ViviendaPage.tsx:33-82` declara una constante `CATEGORIAS` con 5 cards-botón. **NO** lee el store `viviendaHabitual` · **NO** persiste nada · **NO** lee el `escenario` · es 100 % UI estática + 4 navegaciones a otras rutas y 1 toast.

Comentario header (`ViviendaPage.tsx:6-22`) indica:

```
* El store `viviendaHabitual` se creará en sub-tarea follow-up cuando
* se amplíe DB (regla §0.7 · esta sub-tarea NO toca DB). …
* Cuando el store esté disponible, la página persistirá los datos
* (tipo régimen · dirección · ref. catastral) y derivará los
* compromisos automáticamente.
```

⚠️ **Documentación rota** · el store `viviendaHabitual` **YA EXISTE** ·
- `src/services/db.ts:2304` declara `viviendaHabitual: ViviendaHabitual`.
- `src/services/db.ts:2925-2926` lo crea en el upgrade.
- `src/types/viviendaHabitual.ts` define `ViviendaHabitual`.
- `src/services/personal/viviendaHabitualService.ts` exporta `obtenerViviendaActiva`, `listarViviendas`, `guardarVivienda`, `eliminarVivienda`, `generarEventosVivienda`, `borrarEventosFuturosVivienda`, `regenerarEventosVivienda` (l. 37-437).
- `src/services/treasuryBootstrapService.ts:29-33` ya consume el store para regenerar eventos.

La página fue construida cuando el store no existía y nunca se actualizó. El comentario sigue refiriéndose a "sub-tarea follow-up" · cable suelto C-4.

### 5.3 · Botones · destino real

| # | key | CTA copy | onClick (línea) | Destino real | Funcional |
|---|---|---|---|---|---|
| 1 | `regimen` | "Configurar (próximamente)" | `ViviendaPage.tsx:41-44` · `showToastV5('Configuración del régimen de vivienda · sub-tarea follow-up cuando exista el store viviendaHabitual.')` | ❌ Toast · "próximamente" | ❌ Ghost · contradice realidad (store sí existe) |
| 2 | `alquiler` | "Ir a Contratos →" | `ViviendaPage.tsx:53` · `nav('/contratos')` | ✅ `/contratos` (ruta válida) | ✅ Sí |
| 3 | `hipoteca` | "Ir a Financiación →" | `ViviendaPage.tsx:62` · `nav('/financiacion')` | ✅ `/financiacion` (ruta válida) | ✅ Sí |
| 4 | `ibi` | "Crear gasto IBI →" | `ViviendaPage.tsx:71` · `nav('/personal/gastos')` | 🟡 `/personal/gastos` (existe) · pero el copy dice "crear gasto IBI" · la ruta destino lleva al **listado** de gastos, no al wizard pre-rellenado con tipo IBI | 🟡 Aterriza en la tab correcta pero requiere el usuario pulsar "+" + elegir IBI |
| 5 | `comunidad` | "Crear gasto recurrente →" | `ViviendaPage.tsx:80` · `nav('/personal/gastos')` | 🟡 Idem fila 4 · listado, no wizard | 🟡 Igual |

**Resumen** · 5 botones · 1 ghost (toast) · 2 redirects válidos · 2 redirects parcialmente útiles (no preconfiguran tipo de gasto).

### 5.4 · Veredicto

- 🟠 **Pantalla informativa con redirects** · sin lógica propia. No existe estado, no escribe, no lee el store.
- ❌ El botón "Configurar (próximamente)" es ghost.
- 🟡 Los 2 botones de "Crear gasto …" funcionan a medias (no preconfiguran).
- ⚠️ Comentario header del componente está obsoleto (afirma que el store no existe cuando sí existe).

### 5.5 · Cable suelto · C-4

> **C-4 · ViviendaPage no consume `viviendaHabitualService`.** El store `viviendaHabitual` y su servicio existen y son usados por `treasuryBootstrapService` para generar eventos. La pantalla del usuario, sin embargo, no expone la ficha · no permite crear ni editar régimen, dirección, ref. catastral. El comentario header del componente afirma falsamente que el store no existe.

### 5.6 · Cable suelto · C-4b

> **C-4b · Botones "Crear gasto IBI / recurrente" no preconfiguran el wizard.** Aterrizan en `/personal/gastos` (listado) · el copy promete "crear" · expectativa rota.

---

## 6 · Área 5 · Concepto "horizonte temporal" / "meta libertad"

### 6.1 · Búsqueda exhaustiva

`grep -rn 'horizonteAnios|horizonteMeses|targetDate|fechaLibertad|fechaJubilacion|metaLibertad' src/`:

| Hit | Archivo · línea | Significado |
|---|---|---|
| `horizonteAnios: number` | `src/types/libertad.ts:49` (campo de `LibertadConfig`) | ✅ Parámetro de proyección · default 25 · no es "fecha objetivo personal" sino "ventana temporal del cálculo" |
| `horizonteAnios: 25` | `src/types/libertad.ts:58` (`STANDARD_LIBERTAD_CONFIG`) | Default |
| `horizonteMeses` | `src/services/treasuryBootstrapService.ts:42-164` | Concepto distinto · ventana de regeneración de eventos en tesorería (default 24 meses) |

**`fechaLibertad`** · 0 hits.
**`fechaJubilacion`** · 0 hits.
**`targetDate`** · 0 hits relevantes.
**`metaLibertad`** · 0 hits.

### 6.2 · Modelo conceptual

- ❌ **No existe** entidad configurable "fecha objetivo de libertad" que el usuario fije.
- ✅ **Sí existe** un parámetro `horizonteAnios` que define **cuán lejos proyecta el cálculo**, no cuándo el usuario quiere llegar. La función pura busca el primer mes en que `renta ≥ gastos` dentro de esa ventana.
- ✅ La cifra "tiempo estimado" del card libertad de la landing (`LandingPage.tsx:144-147`) viene de `libertad.faltanTexto` (calculada en `libertadService.ts:114-126` a partir del cruce real).

### 6.3 · "mayo 2026" del prompt · explicación

El prompt menciona "Mi Plan · Libertad financiera muestra mayo 2026 como tiempo estimado · ¿de dónde viene ese cálculo?".

- En `LandingPage.tsx:130-132` se renderiza `formatMesAnio(libertad.cruceLibertad.isoYM)` cuando hay cruce.
- `cruceLibertad.isoYM` se rellena en `libertadService.ts:91` con `${yIter}-${String(mIter).padStart(2,'0')}` el primer mes del loop en que `rentaActual >= gastosActuales`.
- Si la cifra observada es "mayo 2026", significa que en la base de datos del usuario la `rentaPasivaActualMensual` calculada (rentas netas contratos − OPEX − cuota préstamo) ya cubre `gastosVidaLibertadMensual` (default 2 500 €) **en el mes 0** del loop (mes de referencia = mes actual). En `mesReferencia = '2026-05'`, esto produce `cruceLibertad.isoYM = '2026-05'` → "mayo 2026".
- **No es placeholder** · es un valor derivado real. La aparente coincidencia con la fecha actual (2026-05-08) es exactamente lo que sugiere el sistema: "ya estás en libertad, según los datos cargados".

### 6.4 · Veredicto

- 🟡 **Existe parámetro de horizonte** (`horizonteAnios`) · sin UI editable.
- ❌ **No existe entidad "meta libertad / fecha objetivo"** que el usuario pueda fijar como ancla. El cruce se descubre, no se planea.
- Si el producto quiere ofrecer "fija una fecha objetivo" como input del usuario, **es una entidad nueva por construir** (no existe campo, no existe persistencia, no existe UI).

### 6.5 · Cable suelto · C-5

> **C-5 · No hay "meta libertad" / "fecha objetivo" como entidad configurable.** Solo existe `horizonteAnios` (default 25) como ventana de cálculo. Si el roadmap del producto incluye "el usuario fija cuándo quiere ser libre", hay que construir la entidad de cero (campo en `Escenario` o `LibertadConfig`, UI, tests).

---

## 7 · Área 6 · Cálculo "cubres el 113 % de tus gastos con renta pasiva"

### 7.1 · Localización del KPI en UI

| Origen render | Archivo · línea | Texto literal |
|---|---|---|
| Card "Libertad financiera" landing Mi Plan | `src/modules/mi-plan/pages/LandingPage.tsx:142` | `cubres el ${Math.round(libertad.pctCoberturaActual)}% de tus gastos con renta pasiva` |

### 7.2 · Pipeline del cálculo

```
LandingPage.tsx:49           const { data: libertad } = useProyeccionLibertad();
  ↓
useProyeccionLibertad.ts:59  proyectarLibertadDesdeRepo(supuestos, configOverride)
  ↓
libertadService.ts:142-176   proyectarLibertadDesdeRepo
                             ├── getEscenarioActivo()                     // singleton o ESCENARIO_DEFAULTS
                             ├── calcularRentaPasivaActual()              // libertadService.ts:192-239
                             │     ├── getAllContracts()                  // contratos.estadoContrato==='activo'
                             │     ├── prestamosService.getAllPrestamos()
                             │     ├── gastosInmuebleService.getByInmuebleYEjercicio(id, año)
                             │     │       (estado ∈ {confirmado, declarado})
                             │     └── return max(0, rentaBruta − opexMensual − cuotaPrestamosFrances)
                             └── proyectarRentaPasivaLibertad(datos, supuestos, config)   // función pura
                                   ↓
                                   ResultadoLibertad.pctCoberturaActual = (rentaPasivaActualMensual / gastosVidaMensual) × 100
                                                                                  ^                       ^
                                                                                  │                       └── singleton.gastosVidaLibertadMensual
                                                                                  │                            (default 2500)
                                                                                  └── salida de calcularRentaPasivaActual()
```

### 7.3 · Inputs del cálculo

| Input | Fuente | Stores leídos |
|---|---|---|
| `rentaPasivaActualMensual` (numerador) | `calcularRentaPasivaActual()` | `contracts` · `prestamos` · `gastosInmueble` |
| `gastosVidaMensual` (denominador) | `escenario.gastosVidaLibertadMensual` (singleton, default 2 500) | `escenarios` |
| `hitos[]` (afectan serie futura, no `pctCoberturaActual` actual) | `escenario.hitos` | `escenarios` |
| `supuestos` (inflación / subida rentas) | Props del hook · default `SUPUESTOS_NEUTROS_LIBERTAD` (cero) | — |
| `config.alcanceRentaPasiva` | `escenario.libertadConfig` o `STANDARD_LIBERTAD_CONFIG` | `escenarios` |

### 7.4 · ¿Ghost o real?

- ✅ **Real.** `pctCoberturaActual` se computa en `libertadService.ts:105-108`:

```ts
const pctCoberturaActual =
  datos.gastosVidaMensual > 0
    ? (datos.rentaPasivaActualMensual / datos.gastosVidaMensual) * 100
    : 0;
```

- ✅ Tests unitarios en `src/services/__tests__/libertadService.test.ts` (8 casos · 1 línea importa `proyectarRentaPasivaLibertad`).
- ✅ Si rentaPasivaActual ≈ 2 825 € y gastosVida = 2 500 € (default), el resultado redondeado es 113 % · numerología correcta.
- ✅ La función NO devuelve un placeholder fijo · tampoco "113 %" hardcoded en ningún sitio (`grep '113'` en `src/modules/mi-plan/` y `src/services/libertadService.ts` · 0 hits).

### 7.5 · Incoherencia "landing 113 % vs Libertad financiera 'Sin escenario configurado'"

> El prompt pregunta: si la pestaña Libertad financiera dice "Sin escenario configurado", ¿cómo es que el card Libertad del Mi Plan landing muestra 113 %? Explicar la incoherencia.

**Causa** · son **dos rutas distintas** al mismo singleton:

| Pantalla | Lectura | Comportamiento si singleton no existe en DB |
|---|---|---|
| Landing card libertad | `useProyeccionLibertad()` → `proyectarLibertadDesdeRepo()` → `getEscenarioActivo()` (`escenariosService.ts:37-52`) | **Devuelve `ESCENARIO_DEFAULTS`** (incluye `gastosVidaLibertadMensual: 2500`) → la función pura calcula con esos defaults → pctCobertura ≠ null |
| Pestaña `/mi-plan/libertad` | `const { escenario } = useOutletContext<MiPlanOutletContext>()` que en `MiPlanPage.tsx:53,58` ejecuta `db.get('escenarios', 1)` directo · si retorna `undefined`, `setEscenario(esc ?? null)` (l. 60) | `escenario === null` → renderiza `<EmptyState title="Sin escenario configurado" />` (`LibertadPage.tsx:22-32`) |

**Diferencia clave** · `getEscenarioActivo()` aplica fallback a defaults; `MiPlanPage.load` no. Resultado: el mismo usuario, sin haber tocado nada, **ve dos verdades**: la landing afirma "cubres el 113 % de tus gastos con renta pasiva", y un click después la pestaña Libertad le dice "Sin escenario configurado · configura tu escenario en Ajustes". Ninguna de las dos miente, pero la fricción cognitiva es alta.

### 7.6 · Veredicto

- ✅ **Cálculo real, robusto, testeado.**
- 🟠 **Incoherencia visible al usuario** · landing muestra cifra; pestaña dedicada dice "sin escenario". Causa raíz · doble pipeline de carga del singleton (con/sin fallback).

### 7.7 · Cable suelto · C-6

> **C-6 · Doble pipeline de carga del singleton `escenarios`.** `escenariosService.getEscenarioActivo()` aplica `ESCENARIO_DEFAULTS` cuando el singleton no existe; `MiPlanPage.load` lo lee directo (`db.get`) sin fallback. Resultado: la landing muestra 113 % pero la pestaña Libertad aparece vacía. Unificar: o bien `MiPlanPage` consume el servicio · o bien la pestaña Libertad deja de pintar EmptyState mientras el singleton retorna defaults.

---

## 8 · Tabla de cables sueltos identificados · acción sugerida

| Código | Cable suelto | Severidad | Acción sugerida |
|---|---|---|---|
| **C-1** | Botón "Configurar escenario" header de Mi Plan + EmptyState Libertad disparan toast `"sub-tarea follow-up"` (2 puntos de entrada) | Alta | **Construir** drawer/wizard (ya catalogado como T27.4.6 en audit predecesor §11) |
| **C-2** | Sub-pestaña "Escenario libertad" inexistente en `/ajustes/*` · copy del producto promete que la configuración vive en Ajustes | Alta | **Construir** sub-página Ajustes que escriba `Escenario` (modoVivienda · gastosVida · estrategia · KPIs macro) y `LibertadConfig` (alcance · regla · horizonte). Decidir si es una pestaña 8ª o sub-card dentro de Perfil. **Sigue el ADR canónico**: backend ya construido, solo falta UI |
| **C-2b** | **Sección Ajustes completa es mockup high-fidelity sin persistencia.** 7 páginas · 0 imports de servicios · 0 `db.put` · ~60 handlers disparan `showToastV5` · `useState` locales que se pierden al navegar · botones "Guardar" mienten | **Crítica** | **Decisión arquitectónica con producto** · ¿estado consciente (mockup demo) o deuda técnica? Si lo segundo, requiere cablear cada página a su servicio (perfilService · planService · notificacionesService · plantillasService · perfilFiscalService · seguridadService · `viviendaHabitualService` ya existe). Esfuerzo grande · NO es scope de T-MIPLAN-CONFIG · pero **bloquea cualquier UI de configuración** que se quiera añadir aquí (incluida C-2) hasta que se decida el patrón |
| **C-7** | `NuevoContratoWizard.tsx` no persiste · botones `showToastV5('selección registrada (follow-up persistencia)')` · única vía persistente es el importador masivo Rentila | Alta | **Investigar más** · fuera del scope original · pero impacta directamente al input principal del cálculo 113 % |
| **C-8** | Sin wizard de Hitos del escenario libertad · `addHito/updateHito/removeHito` con tests pero cero callers UI · mientras Objetivos y Fondos sí tienen wizards funcionales | Media | **Construir** wizard de Hitos · puede colgarse de la pestaña `/mi-plan/libertad` (CTA "Añadir hito" en la card de tabla de hitos) o de la sub-página de Ajustes (PR-C) |
| **C-3** | Singleton `escenarios` huérfano de UI de escritura · `saveEscenarioActivo`/`addHito`/`updateHito`/`removeHito` sin caller en `src/modules/` | Media | **Adaptar** · resolver C-1 + C-2 cubre este punto. Adicionalmente exponer CRUD de hitos desde la propia pestaña Libertad financiera (parte de T27.4.3) |
| **C-4** | `ViviendaPage` no consume `viviendaHabitualService` · documentación header miente afirmando que el store no existe | Alta | **Construir** la ficha vivienda habitual encima del store existente (campos régimen · dirección · ref. catastral). Limpiar comentario header. **No requiere DB nueva.** |
| **C-4b** | Botones "Crear gasto IBI / Crear gasto recurrente" en Mi vivienda aterrizan en listado, no preconfiguran tipo de gasto | Baja | **Adaptar** · pasar parámetros (`?tipo=ibi`) o navegar directo al wizard `/personal/gastos/nuevo?tipo=ibi`. Inversión 30-60 min |
| **C-5** | No existe entidad "meta libertad / fecha objetivo" configurable por el usuario · sólo hay `horizonteAnios` como ventana del cálculo | Baja (depende del roadmap) | **Investigar más** · validar con producto si "fecha objetivo del usuario" es feature confirmada. Si sí, construir campo en `LibertadConfig` o `Escenario` (decisión arquitectónica) + UI en Ajustes (cubierto por C-2) |
| **C-6** | Doble pipeline de carga del singleton · landing muestra 113 % vía servicio con fallback a defaults · pestaña Libertad pinta EmptyState vía `db.get` sin fallback | Media | **Adaptar** · `MiPlanPage.load` debe usar `getEscenarioActivo()` para que la pestaña Libertad muestre la trayectoria con defaults igual que la landing. Cambio quirúrgico (3-4 líneas) |
| **(lateral) C-X1** | Pestaña Libertad financiera no usa la función pura `proyectarRentaPasivaLibertad` · sigue con SVG inline + `rentaActual = 0` hardcoded | Alta | Ya catalogado en audit `2026-05-02` §10 como T27.4.3 · pendiente |

> **NB · cables ya catalogados en audit predecesor `2026-05-02` que siguen vigentes** · C-1 (= §10 fila "Configurar escenario") · C-X1 (= T27.4.3) · todos los hallazgos laterales §12 del audit predecesor. **No se duplican** en esta tabla salvo cuando aportan acción nueva.

---

## 9 · Recomendación de orden para próximos PRs

> Sólo recomendación · NO se ejecuta sin autorización Jose · stop-and-wait.

### Orden propuesto · 5 PRs secuenciales

1. **PR-A · Fix C-6 (incoherencia landing vs pestaña Libertad)** · 1-2 h CC · cambia `MiPlanPage.load` para usar `getEscenarioActivo()` (siempre devuelve singleton, nunca null). La pestaña Libertad pasa a mostrar trayectoria coherente con la landing. **No requiere UI nueva.**
2. **PR-B · Fix C-4 (ficha vivienda habitual)** · 4-6 h CC · ViviendaPage consume `viviendaHabitualService` · sustituye la card "Configurar (próximamente)" por formulario real (régimen · dirección · ref. catastral). Cierra ghost button C-1 parcial (solo el botón de Mi vivienda) y limpia documentación rota. **No toca DB.**
3. **PR-C · Construir C-2 + C-3 (Ajustes · sub-página "Escenario libertad")** · 6-10 h CC · añade sidebar item 8ª en `AjustesPage.tsx` (`/ajustes/escenario`) · formulario que escribe `gastosVidaLibertadMensual`, `modoVivienda`, `estrategia`, `rentaPasivaObjetivo` (+ KPIs macro opcionales) · invoca `saveEscenarioActivo`. Mantén `LibertadConfig` (alcance · regla · horizonte) en sub-card "Avanzado". **Cubre C-1 (botón header navega a `/ajustes/escenario`) y C-3 (CRUD del singleton).** ⚠️ **Será la primera página de Ajustes con persistencia real** (ver C-2b). Conviene establecer aquí el patrón canónico (hook + servicio + `setLastSavedAt`) que el resto de Ajustes adoptará en limpieza posterior.
4. **PR-D · Adaptar C-4b** · 1 h CC · `Crear gasto IBI / recurrente` navegan a `/personal/gastos/nuevo?tipo=ibi|recurrente` con preselección.
5. **PR-E (opcional, depende de roadmap)** · Construir C-5 (entidad "fecha objetivo libertad") · solo si producto lo confirma. Sigue el patrón del ADR · campo nuevo en `LibertadConfig`, UI en sub-página de Ajustes (PR-C).

### Lo que NO se cubre aquí

- T27.4.3 (sliders simulador, gráfica con `rentaActual` real, persistencia toggle alquiler/propia, escenarios guardados) · queda como bloque grande aparte (audit `2026-05-02` §11).
- T27.4.4 (store `escenarios_guardados`) · idem.
- T27.4.5 (limpieza zombie `src/modules/horizon/proyeccion/escenarios/`) · idem.
- Hallazgos laterales §12 del audit predecesor.

### Esfuerzo total estimado mini-bundle

- PR-A · 1-2 h
- PR-B · 4-6 h
- PR-C · 6-10 h
- PR-D · 1 h
- PR-E · 3-5 h (opcional)

**Total estimado · 12-19 h CC** para cerrar el escenario libertad a nivel UI + Mi vivienda. Resto del paquete T27.4 es trabajo separado.

---

## 10 · Reglas inviolables · cumplimiento

- ✅ DB_VERSION sin cambios · sigue 69 · 40 stores intactos.
- ✅ NO modifica código · NO crea PR de código.
- ✅ 1 entrega · este documento markdown único `docs/AUDIT-miplan-config-2026-05-08.md`.
- ✅ Cada hallazgo con archivo:línea verificable.
- ✅ Stop-and-wait · espera autorización Jose para próximos pasos.
- ✅ Scope cerrado a las 6 áreas · cables fuera del alcance documentados pero NO investigados.

---

## 11 · Re-auditoría exhaustiva post-feedback Jose

> El audit original marcó como "✅ funcional" varias páginas/rutas tras leer sólo headers/imports superficiales. Tras el descubrimiento de que `/ajustes/*` es mockup completo (§3), Jose pidió aplicar el mismo rigor al resto del scope. Esta sección verifica con grep duro **persistencia real** (`db.put|db.add|service.save|service.create|service.delete`) en cada ruta tocada por el audit.

### 11.A · Rutas destino del Mi vivienda (botones de §5.3)

| Botón → Ruta | Página destino | Persistencia | Veredicto |
|---|---|---|---|
| "Ir a Contratos" → `/contratos` | Hub contratos · `src/modules/inmuebles/` (área Inmuebles · contrato vive ahí) | `NuevoContratoWizard.tsx` formulario · botones disparan `showToastV5('selección registrada (follow-up persistencia)')` · **NO escribe `contracts`** | 🟠 **MIXTO crítico** · única vía persistente es importador masivo `src/modules/inmuebles/import/ImportarContratos.tsx` → `contractsImportService.importContractsFromRentilaRows` → `saveContract` (`contractService.ts:72,100`) |
| "Ir a Financiación" → `/financiacion` | Hub financiación · wizard nuevo préstamo | `WizardCreatePage.tsx` + `PrestamosWizard.tsx:255,260` · `prestamosService.createPrestamo()` · `prestamosService.updatePrestamo()` | ✅ **REAL** · crea préstamo persistente |
| "Crear gasto IBI" → `/personal/gastos` | Listado gastos personales | `GastosPage.tsx:18,19` · `eliminarCompromiso()` + `regenerateForecastsForward()` · borra real · creación vía sub-ruta `/personal/gastos/nuevo` | ✅ **REAL** (con caveat C-4b · no preconfigura tipo) |
| "Crear gasto recurrente" → `/personal/gastos` | Idem | Creación funcional vía `NuevoGastoRecurrentePage.tsx:520,522` · `crearCompromiso()` + `actualizarCompromiso()` + `regenerateForecastsForward()` | ✅ **REAL** |

**Veredicto §11.A** · 3 de 4 destinos persisten real. **El destino "Contratos" es el roto** · el wizard manual de UI normal (`NuevoContratoWizard.tsx`) NO persiste · solo importador masivo. Esto cambia la severidad del cable C-4b: el botón "Ir a Contratos" lleva a un wizard mockup salvo que el usuario sepa usar el importador Rentila.

### 11.B · Submódulos Mi Plan (consumidores de `escenario` y otros)

`grep -nE "import.*service|db\.put|db\.add|service\.save|service\.create|service\.delete" src/modules/mi-plan/pages/*.tsx`:

| Página | Lecturas DB | Escrituras DB | Botones reales vs toasts | Veredicto |
|---|---|---|---|---|
| `LandingPage.tsx` | ✅ `useProyeccionLibertad` + `computeBudgetProjection12mAsync` + outlet context | ❌ 0 | Cards click → `navigate(...)` · sin toast | ✅ Lectura funcional |
| `LibertadPage.tsx` | ✅ outlet context (`escenario`) | ❌ 0 | EmptyState CTA → toast `'follow-up'` · toggle → `useState` local sin persist | 🟠 **Lectura · sin escritura · toggle inerte** |
| `ProyeccionPage.tsx` | ✅ outlet context | ❌ 0 | Sin handlers · render puro de tabla | ✅ Lectura funcional · sin necesidad de escritura |
| `ObjetivosPage.tsx` | ✅ outlet context (`objetivos`) | ❌ 0 directo · pero dispara `WizardNuevoObjetivo.tsx:324` `createObjetivo()` | "Crear objetivo" → wizard real | ✅ **Lectura + creación funcional vía wizard** |
| `FondosPage.tsx` | ✅ outlet context (`fondos`) | ❌ 0 directo · pero dispara `WizardNuevoFondo.tsx:306` `createFondo()` | "Crear fondo" → wizard real | ✅ **Lectura + creación funcional vía wizard** |
| `RetosPage.tsx` | ✅ outlet context (`retos`) | ❌ 0 (oculto si `SHOW_RETOS=false`) | — | 🟡 Página existe · feature flag controla visibilidad |
| `MiPlanPage.tsx` (header) | ✅ `db.get('escenarios')` + `db.getAll('objetivos'/'fondos_ahorro'/'retos')` (l. 56-59) | ❌ 0 · botón "Configurar escenario" → toast | — | 🟠 Lee real · pero header acción es toast |

**Veredicto §11.B** · El patrón es consistente: páginas de visualización **leen del outletContext** (que carga el singleton + colecciones) y **delegan creación a wizards dedicados**. Los wizards de Objetivos y Fondos sí persisten real. **No existe wizard equivalente para Hitos del Escenario** · `addHito/updateHito/removeHito` siguen sin caller UI (solo tests). Cable suelto **C-3** confirmado y agravado: no es solo "saveEscenarioActivo sin caller UI" sino que **la familia entera de mutaciones del escenario singleton (incluidos los hitos) carece de wizard**.

### 11.C · Tabs de Personal (mencionados en §1, §5)

| Tab | Archivo · líneas | Lecturas DB | Escrituras DB | Veredicto |
|---|---|---|---|---|
| Panel | `PanelPage.tsx` | outlet context | ❌ 0 | 🟡 Dashboard read-only |
| Ingresos | `IngresosPage.tsx` | outlet context (`nominas`, `autonomos`, `otrosIngresos`) | ❌ 0 directo · creación delegada a wizards `nominaService`/`autonomoService`/`otrosIngresosService` (no verificados aquí · fuera de scope) | 🟢 Lectura + delega creación |
| Gastos | `GastosPage.tsx` | outlet context | ✅ `eliminarCompromiso()` + `regenerateForecastsForward()` directos · creación delegada a `NuevoGastoRecurrentePage.tsx` (real) | ✅ Lectura + borrado + creación real |
| Mi vivienda | `ViviendaPage.tsx` | ❌ 0 (no usa context · no usa servicio) | ❌ 0 | ❌ **Pura UI estática** · cable C-4 |
| Presupuesto | `PresupuestoPage.tsx` | outlet context (cálculo derivado) | ❌ 0 | 🟡 Dashboard read-only |

**Veredicto §11.C** · La tab problemática **es la de Mi vivienda** (cable C-4 ya documentado) · el resto leen y, en Ingresos/Gastos, delegan creación a wizards reales.

### 11.D · Inputs del cálculo 113 % · ¿se pueden crear desde UI?

El cálculo `calcularRentaPasivaActual` (libertadService.ts:192-239) lee tres stores:

| Store | UI de creación | Persistencia | Veredicto |
|---|---|---|---|
| `contracts` (rentaMensual) | `NuevoContratoWizard.tsx` mockup ("follow-up persistencia") · **importador** `ImportarContratos.tsx` + `contractsImportService:187` `saveContract()` | ✅ Sólo vía importador · ❌ wizard manual mockup | 🟠 **MIXTO crítico** · UI manual rota, importador OK |
| `prestamos` | `WizardCreatePage.tsx` → `PrestamosWizard.tsx` · `prestamosService.createPrestamo()` | ✅ | ✅ Real |
| `gastosInmueble` | `NuevoGastoRecurrenteInmueblePage.tsx:515,517` · `crearCompromiso()` + `actualizarCompromiso()` | ✅ | ✅ Real |

`grep -rln 'saveContract|updateContract' src/` confirma que los únicos callers fuera del propio servicio son · `contractsImportService.ts`, `vinculacionFiscalService.ts`, `declaracionOnboardingService.ts`. **Cero callers UI directos** (ningún archivo en `src/modules/`).

**Veredicto §11.D · CRÍTICO** · el cálculo 113 % **funciona si los datos están** · pero la única vía persistente para que un usuario nuevo cree contratos es el importador Rentila o el flujo onboarding fiscal/declaración. Si la cifra "113 %" se observa en producción, los contratos vinieron de uno de esos caminos · **no del wizard manual de "Nuevo contrato"** que es mockup.

### 11.E · Cables sueltos nuevos · derivados de la re-auditoría

> **C-7 · `NuevoContratoWizard.tsx` no persiste.** Botones disparan `showToastV5('selección registrada (follow-up persistencia)')`. Única vía persistente para crear contratos es el importador masivo Rentila/Excel (`ImportarContratos.tsx`). Severidad **alta** · fuera del scope original de T-MIPLAN-CONFIG pero impacta directamente al cálculo 113 % (§7).

> **C-8 · Familia entera de mutaciones del singleton `Escenario` sin UI.** No es solo `saveEscenarioActivo`; también `addHito/updateHito/removeHito` (los 3 con tests pero cero callers UI). Mientras Objetivos y Fondos tienen wizard funcional, los Hitos del escenario libertad no tienen punto de creación. Cubierto parcialmente por C-3, pero distingue el problema: **falta wizard de Hitos** además del wizard de configuración macro del escenario.

### 11.F · Tabla actualizada de severidades por área

| Área | Veredicto inicial (commit 1) | Veredicto post-revisión (este commit) | Razón del cambio |
|---|---|---|---|
| 1 · Botón Configurar | ❌ Ghost | ❌ Ghost | Sin cambios · era correcto |
| 2 · Pestañas Ajustes | ✅ Funcional | ❌ Mockup completo | Verificación grep duro · feedback Jose |
| 3 · Entidad escenario | 🟡 Backend OK · UI inexistente | 🟡 Backend OK · UI escritura inexistente · **agrava**: ni wizard de Hitos | Re-auditoría exhaustiva confirma + agrava |
| 4 · Mi vivienda | 🟠 Informativa con redirects | 🟠 Idem · pero **uno de los redirects (Contratos) lleva a wizard mockup** | Cable C-7 nuevo |
| 5 · Horizonte temporal | 🟡 Existe parámetro · sin UI | 🟡 Idem | Sin cambios |
| 6 · Cálculo 113 % | ✅ Real | ✅ Real **pero** input `contracts` solo vía importador | Cable C-7 afecta cadena de datos |

### 11.G · Lección operativa

El audit original incurrió en **"creencias" no verificadas** · marcar `✅ funcional` tras leer sólo el header de un componente o confirmar la existencia de la ruta. La regla canónica honesta para futuros audits es:

```bash
# Verificación de persistencia · ejecutar antes de marcar "funcional"
grep -nE "import.*services?/|initDB|db\.(put|add|delete|update)|service\.(save|create|delete|update)" \
     <archivo>
grep -cE "showToastV5\(|alert\(|console\.log" <archivo>
# Si imports = 0 y toasts > 5 → MOCKUP
# Si imports > 0 pero `await ...save|create|put` = 0 → LECTURA PURA (no necesariamente mockup)
# Si imports > 0 y al menos un await ...save|create → REAL
```

Aplicar esta regla a las 6 áreas reveló:
- **§3 Ajustes** · 7 páginas · 0 imports servicios · ~60 toasts → **MOCKUP completo**.
- **§5.3 Mi vivienda · botón "Ir a Contratos"** · destino con wizard mockup → **MIXTO crítico**.
- **§7 Cálculo 113 %** · pipeline correcto pero data-entry de contracts cojea → **REAL con caveat**.

---

Generated by Claude Code · audit T-MIPLAN-CONFIG-AUDIT · 2026-05-08
