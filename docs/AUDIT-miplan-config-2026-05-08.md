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
| 2 | Pestañas /ajustes/* | ✅ 7 pestañas · todas funcionales | NO existe pestaña ni sub-card para `libertadConfig` · `gastosVidaLibertadMensual` · `modoVivienda` · `estrategia` (todo el bloque "escenario libertad" es invisible para el usuario) | Alta |
| 3 | Entidad escenario libertad | 🟡 Backend completo · UI inexistente | Tipo `Escenario` (singleton) + tipo `LibertadConfig` + servicio + función pura + hook → todo cableado · pero NO existe pantalla de edición humana (sólo defaults `ESCENARIO_DEFAULTS` aplicados ciegamente) | Media |
| 4 | Personal · Mi vivienda | 🟠 Pantalla informativa con 5 redirects · 1 ghost | Comentario header dice "El store `viviendaHabitual` se creará en sub-tarea follow-up" · pero el store **YA existe** desde V60+ con servicio completo `viviendaHabitualService` · la página no lo usa · documentación rota | Alta |
| 5 | Horizonte temporal / meta libertad | 🟡 Existe como parámetro `horizonteAnios` (default 25) | Sin UI de edición · no existe campo "fechaJubilacion" / "targetDate" · el cruce libertad se descubre, no se fija | Baja |
| 6 | Cálculo "113 % cobertura" | ✅ Real · NO ghost | Función pura `proyectarRentaPasivaLibertad` · serie mensual con inflación · cruce real · pctCobertura = renta neta contratos / gastosVida (default 2 500 €) | OK · sin acción |

> **Conclusión 30 s** · el backend de libertad (T27.4.1+T27.4.2) está construido y funciona. Lo que falta es **la UI de configuración**: el botón "Configurar escenario" del header sigue siendo toast, Ajustes no expone ninguno de los campos de `Escenario` ni `LibertadConfig`, y la pestaña Personal · Mi vivienda no aprovecha el store `viviendaHabitual` existente. La incoherencia "landing 113 % vs Libertad financiera 'Sin escenario configurado'" se explica en §7: ambos leen del mismo singleton, pero el `EmptyState` de LibertadPage dispara cuando `escenario === null` (singleton no creado todavía en DB), mientras que la landing usa el wrapper `proyectarLibertadDesdeRepo` que rellena con `ESCENARIO_DEFAULTS` y nunca devuelve null.

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

`src/App.tsx:1235-1276` cuelga `/ajustes/*` con index → `/ajustes/perfil`. `src/modules/ajustes/AjustesPage.tsx:14-22` declara la sidebar con 7 ítems:

| # | Key | Label | Path | Componente | Archivo | Funcional |
|---|---|---|---|---|---|---|
| 1 | `perfil` | Perfil | `/ajustes/perfil` | `AjustesPerfil` | `src/modules/ajustes/pages/PerfilPage.tsx` | ✅ Datos personales · preferencias regionales · preferencias UI |
| 2 | `plan` | Plan & facturación | `/ajustes/plan` | `AjustesPlan` | `src/modules/ajustes/pages/PlanPage.tsx` | ✅ Método de pago · gestión suscripción (incluye literal "Simulador libertad financiera" entre features del plan, l. 29 — pero como item de la lista de servicios contratables, no como UI configurable) |
| 3 | `integraciones` | Integraciones | `/ajustes/integraciones` | `AjustesIntegraciones` | `src/modules/ajustes/pages/IntegracionesPage.tsx` | ✅ Bancos · proveedores · APIs |
| 4 | `notificaciones` | Notificaciones | `/ajustes/notificaciones` | `AjustesNotificaciones` | `src/modules/ajustes/pages/NotificacionesPage.tsx` | ✅ Canales activos · tesorería · contratos · fiscal |
| 5 | `plantillas` | Plantillas | `/ajustes/plantillas` | `AjustesPlantillas` | `src/modules/ajustes/pages/PlantillasPage.tsx` | ✅ Plantillas contratos alquiler · correos inquilino · fórmulas fiscales (incluye plantilla `'vivienda'` y "Vivienda habitual · 5 años · IPC", refs. l. 42-45 · son plantillas de **contrato** de alquiler para inmuebles, NO configuración de "mi vivienda" del hogar) |
| 6 | `fiscal` | Perfil fiscal y convivencia | `/ajustes/fiscal` | `AjustesPerfilFiscal` | `src/modules/ajustes/pages/PerfilFiscalPage.tsx` | ✅ Titular · pareja · personas a cargo · CCAA · implicaciones cruzadas |
| 7 | `seguridad` | Seguridad y datos | `/ajustes/seguridad` | `AjustesSeguridad` | `src/modules/ajustes/pages/SeguridadPage.tsx` | ✅ Acceso · sesiones · datos · zona peligrosa |

Redirects legacy `cuenta/*` → `ajustes/*` confirmados en `App.tsx:1288-1310`.

### 3.2 · ¿Alguna pestaña toca "modo vivienda" / "gastos vida" / "estrategia libertad" / "escenario libertad"?

`grep -rn 'libertad|vivienda|gastos vida|escenario|modoVivienda' src/modules/ajustes/`:

- **0 ocurrencias relevantes para configurar el escenario libertad.** Las matches encontradas son ·
  - `PerfilFiscalPage.tsx:20` · texto informativo sobre deducción IRPF arrendamiento vivienda habitual.
  - `PlanPage.tsx:29,64` · "Simulador libertad financiera" como bullet de features del plan PRO (no UI funcional).
  - `PlantillasPage.tsx:42,45,113` · plantillas contractuales alquiler vivienda (no configuración del hogar).

- ❌ **NO existe** sub-pestaña / sub-card / drawer en `/ajustes/*` que escriba `gastosVidaLibertadMensual`, `modoVivienda`, `estrategia`, `rentaPasivaObjetivo`, `cajaMinima`, `dtiMaximo`, `ltvMaximo`, `yieldMinimaCartera`, `tasaAhorroMinima`, ni `libertadConfig`.
- `grep -rn 'libertadConfig|saveEscenarioActivo|setLibertadConfig' src/modules/ajustes/` · **0 resultados**.

### 3.3 · Cable suelto · C-2

> **C-2 · Sub-pestaña "Escenario libertad" inexistente en Ajustes.** Toda la copy del producto (EmptyState `LibertadPage`, ADR canónico §"La UI de Ajustes para exponer estos parámetros se construye a demanda") promete que la configuración vive en Ajustes. La pestaña no existe. El usuario que pulsa el botón header solo ve un toast.

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

`grep -rn 'saveEscenarioActivo' src/` ·

```
src/services/escenariosService.ts:56:export async function saveEscenarioActivo(...)
src/services/escenariosService.ts:93:  await saveEscenarioActivo({ hitos: ... });
src/services/escenariosService.ts:108: await saveEscenarioActivo({ hitos: newHitos });
src/services/escenariosService.ts:117: await saveEscenarioActivo({ hitos: newHitos });
```

**Cero callers fuera del propio servicio.** El singleton solo se escribe si el código (no la UI) llama internamente a `addHito/updateHito/removeHito`, y esos métodos tampoco se invocan desde ningún `src/modules/`.

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
3. **PR-C · Construir C-2 + C-3 (Ajustes · sub-página "Escenario libertad")** · 6-10 h CC · añade sidebar item 8ª en `AjustesPage.tsx` (`/ajustes/escenario`) · formulario que escribe `gastosVidaLibertadMensual`, `modoVivienda`, `estrategia`, `rentaPasivaObjetivo` (+ KPIs macro opcionales) · invoca `saveEscenarioActivo`. Mantén `LibertadConfig` (alcance · regla · horizonte) en sub-card "Avanzado". **Cubre C-1 (botón header navega a `/ajustes/escenario`) y C-3 (CRUD del singleton).**
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

**Total `12-19 h CC` para cerrar el escenario libertad **a nivel UI + Mi vivienda**.** Resto del paquete T27.4 es trabajo separado.

---

## 10 · Reglas inviolables · cumplimiento

- ✅ DB_VERSION sin cambios · sigue 69 · 40 stores intactos.
- ✅ NO modifica código · NO crea PR de código.
- ✅ 1 entrega · este documento markdown único `docs/AUDIT-miplan-config-2026-05-08.md`.
- ✅ Cada hallazgo con archivo:línea verificable.
- ✅ Stop-and-wait · espera autorización Jose para próximos pasos.
- ✅ Scope cerrado a las 6 áreas · cables fuera del alcance documentados pero NO investigados.

---

Generated by Claude Code · audit T-MIPLAN-CONFIG-AUDIT · 2026-05-08
