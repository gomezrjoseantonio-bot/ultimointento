# ATLAS · Auditoría · pensiones + fondos + traspasos + vínculo nómina-plan · V1

> **Modo** · solo lectura · 0 archivos modificados · 0 commits.
>
> **Origen** · TAREA CC AUDITORÍA · prerrequisito de TAREA 13 v4 (módulo planes de pensiones).
>
> **Rama auditada** · `claude/audit-pension-funds-2UPgv` (idéntica a `main` post-V71).
>
> **DB_VERSION en repo** · 71 · 41 stores totales (`src/services/db.ts:28`).
>
> **DB_VERSION productiva de Jose** · v70 (declarada en spec). Los stores y migración de planes (V65) son anteriores · ambos coinciden a efectos de la auditoría.
>
> **No hay acceso a datos productivos en este entorno** · los conteos por store solicitados en §3.1 columna "Datos productivos Jose" se marcan como `N/A (entorno aislado)`. La auditoría puede inspeccionar shape, escritores y lectores, pero no la cardinalidad real en producción.

---

## 0 · Resumen ejecutivo

La realidad confirmada **coincide con la hipótesis del spec de auditoría**:

1. **El módulo de planes de pensiones existe entero** · stores · servicios · migración V65 · UI legacy en 2 rutas paralelas + UI v5 unificada en galería · cálculo de rentabilidad (TWR/MWR/bloque) · idempotencia · fix B6 cruzado mergeado.
2. **Importación XML AEAT al store nuevo está cableada** · vía `declaracionDistributorService.persistirPlanPensiones` (`src/services/declaracionDistributorService.ts:1014-1100`). Existe además un servicio paralelo `aeatPlanesPensionesImportService` que NO tiene consumidores en producción (solo tests).
3. **Vínculo nómina-plan está implementado y funciona** · `NominaPage` filtra PPE/PPES y persiste UUID · `nominaAportacionHook` escribe en `aportacionesPlan` al confirmar el evento. Existe fallback dual `UUID || legacy numeric ingresoIdVinculado`.
4. **Fondos de inversión están modelados de forma plana** dentro de `inversiones[tipo='fondo_inversion']` · NO existe entidad de traspaso entre fondos · cada transmisión de fondo declarada en IRPF crea una `PosicionInversion` cerrada (`activo:false`) sin identidad estable a través de gestoras. El régimen de diferimiento del art. 94 LIRPF NO está modelado.
5. **Hay duplicación masiva de UI de planes** · existen 4 componentes para gestionar planes: `PlanesManager.tsx`, `MisPlanesPensiones.tsx`, `PlanForm.tsx`, `PlanFormV5.tsx`, además de los dialogs v5 (`AportacionPlanDialog`, `ActualizarValorPlanDialog`, `TraspasoPlanDialog`) y la ficha `FichaPlanPensiones`. **`PlanesManager.tsx` y `MisPlanesPensiones.tsx` no son importados por nadie** (zombies de UI).
6. **TAREA 13 (spec v2 y v3) está al ≥90 % cerrada**. Lo que falta es decisión arquitectónica de cara a fondos · limpieza de UI zombie · y decisiones D1-D5 documentadas en §3.8.

---

## 1 · Mapa de rutas activas relacionadas

| Ruta | Componente | Origen del listado de planes | Acciones |
|---|---|---|---|
| `/inversiones` | `InversionesGaleria.tsx` (`src/modules/inversiones/InversionesGaleria.tsx:40`) | `getAllCartaItems()` unifica `inversiones` + `planesPensiones` con dedup por nombre+gestora+fecha | Wizard nuevo (4 grupos · planes/equity/RF/otros) · ficha detalle |
| `/inversiones/:posicionId` | `FichaPosicionPage.tsx:29` → `FichaPlanPensiones.tsx:217` (si id es UUID) o `FichaGenerica` (si numérico) | `planesPensionesService.getPlan(uuid)` | Aportar · actualizar valor · traspasar · editar |
| `/gestion/inversiones` | `GestionInversionesPage.tsx:379` | `planesInversionService.getPlanes(personalDataId)` (wrapper → `planesPensionesService.getAllPlanes`) | Usa `PlanForm.tsx` y `TraspasoForm.tsx` (legacy V65) |
| `/personal/nueva-nomina` | `NominaPage.tsx:38` | `planesPensionesService.getAllPlanes({titular})` filtrado a PPE+PPES | Selector "¿a qué plan va la aportación?" |

**No hay ruta `/personal/planes`** · `PlanesManager.tsx` y `MisPlanesPensiones.tsx` están definidos pero no enchufados.

---

## 2 · Stores relacionados · catálogo (§3.1)

### 2.1 · `planesPensiones` (vivo · canónico desde V65)

| Campo | Detalle |
|---|---|
| Propósito declarado | Entidad estable de un plan de pensiones (UUID) · sobrevive traspasos entre gestoras. |
| Schema | `interface PlanPensiones` en `src/types/planesPensiones.ts:33-72` · keyPath `id: string` · 4 índices (`personalDataId`, `tipoAdministrativo`, `estado`, `titular`) · `src/services/db.ts:2792-2797`. |
| Escritores | `planesPensionesService.createPlan/updatePlan` (`src/services/planesPensionesService.ts:40-70`) · `declaracionDistributorService.persistirPlanPensiones` (`declaracionDistributorService.ts:1014-1070`) · `aeatPlanesPensionesImportService.asegurarPlanStub` (`aeatPlanesPensionesImportService.ts:126`) · migración V65 (`db.ts:3976`, `4033`) · `traspasosPlanPensionesService.registrarTraspaso` (efectos secundarios · actualiza plan tras traspaso total · `traspasosPlanPensionesService.ts:97`). |
| Lectores | `planesPensionesService` (todos los métodos) · `aportacionesPlanService.getMapaAportacionesAcumuladas` (`aportacionesPlanService.ts:88`) · `galeriaAdapter.getAllCartaItems` (`adapters/galeriaAdapter.ts:44`) · `inversionesService.getResumenCartera` (`inversionesService.ts:269`) · `NominaPage` (`NominaPage.tsx:191-201`) · `FichaPlanPensiones` (`FichaPlanPensiones.tsx:240`) · `rentabilidadPlanService` · `planesInversionService` (wrapper) · `MisPlanesPensiones` (zombie). |
| Datos productivos Jose | N/A (entorno aislado) · spec menciona "PPE Orange CIF A82009812" · grep en código no encuentra valores hardcodeados que validen la presencia. |
| Estado | **Vivo · canónico.** Es el destino único de los planes de pensiones · todos los escritores escriben aquí post-V65. |

### 2.2 · `aportacionesPlan` (vivo · canónico desde V65)

| Campo | Detalle |
|---|---|
| Propósito | Eventos de aportación a un plan (titular · empresa · cónyuge · UUID y FK `planId: string`). |
| Schema | `interface AportacionPlan` en `src/types/planesPensiones.ts:74-99` · keyPath `id: string` · 5 índices (`planId`, `ejercicioFiscal`, `planId+ejercicioFiscal` compuesto, `origen`, `ingresoIdNomina`) · `src/services/db.ts:2799-2806`. |
| Escritores | `aportacionesPlanService.crearAportacion/mensualizarAnual/eliminarAportacion` · `nominaAportacionHook.onNominaConfirmada` (`src/services/personal/nominaAportacionHook.ts:100`) · `declaracionDistributorService.persistirPlanPensiones` (`declaracionDistributorService.ts:1085`) · `aeatPlanesPensionesImportService.importarAportacionesAEAT` (sin consumidor productivo) · `migrations/fixAportacionesPlanCruceB6.ts` (swap titular↔empresa) · migración V65 (`db.ts:4000`, `4061`). |
| Lectores | `aportacionesPlanService` (todos) · `planesPensionesService.eliminarPlan` (cascade · `planesPensionesService.ts:105`) · `planesPensionesService.getAportacionesAcumuladasTotal` · `rentabilidadPlanService.getRentabilidadTotal/PorBloque` · `FichaPlanPensiones.tsx:245` · `NominaPage` no lee directo, lee vía `aportacionesAcumuladasEjercicio` para validar tope (`nominaAportacionHook.ts:148-181`). |
| Datos productivos Jose | N/A (entorno aislado). |
| Estado | **Vivo · canónico.** Único store de aportaciones a planes post-V65. |

### 2.3 · `traspasosPlanPensiones` (vivo · V65)

| Campo | Detalle |
|---|---|
| Propósito | Eventos de traspaso de un plan entre gestoras · fiscalmente neutros (art. 8.8 LRPFP). |
| Schema | `interface TraspasoPlanPensiones` en `src/types/planesPensiones.ts:101-150` · keyPath `id` autoIncrement (numérico · NO UUID · documentado en spec v3 §2.3 como divergencia menor) · 2 índices (`planId`, `fechaEjecucion`) · `src/services/db.ts:2808-2812`. |
| Escritores | `traspasosPlanPensionesService.registrarTraspaso` (`traspasosPlanPensionesService.ts:54-130`) · migración V65 (`db.ts:4081`). |
| Lectores | `traspasosPlanPensionesService.getTraspasosPorPlan/getTraspasosPorPersonalData/getTrayectoriaCompleta` · `rentabilidadPlanService.getRentabilidadPorBloque` (`rentabilidadPlanService.ts:411`) · `GestionInversionesPage.tsx:434, 456` · `PlanesManager.tsx:49` (zombie) · `FichaPlanPensiones.tsx`. |
| Datos productivos Jose | N/A. |
| Estado | **Vivo · canónico.** El campo `valorTraspaso` (clave para rentabilidad por bloque) está presente y normalizado vía `valorTraspasoNormalizado()` (`traspasosPlanPensionesService.ts:22-28`) que aplica fallback `valorTraspaso ?? (esTotal ? importeTraspasado : null)`. |

### 2.4 · `planesPensionInversion` (eliminado en V65)

| Campo | Detalle |
|---|---|
| Propósito | Legacy V63 · store dedicado de planes vía import XML. |
| Estado | **Eliminado.** El `deleteObjectStore` está en `src/services/db.ts:4104-4106`. La interfaz TypeScript ya NO lo declara (comentario explicativo en `db.ts:2197`). Para DBs frescas a partir de V65 ya no se crea (`db.ts:2767-2774` solo lo crea si `oldVersion > 0 && oldVersion < 65` para poder migrarlo). |

### 2.5 · `traspasosPlanes` (eliminado en V65 · tipo TS aún declarado)

| Campo | Detalle |
|---|---|
| Propósito | Legacy V5.2 · traspasos pre-V65 con FK numérica a `planesPensionInversion`. |
| Estado | **Eliminado en runtime** (`db.ts:4107-4109`). La interfaz TS sigue declarada como `traspasosPlanes: TraspasoPlan` (`db.ts:2212`) **únicamente** porque la migración V65→V70 todavía llama `db.deleteObjectStore('traspasosPlanes')` idempotente para DBs antiguas. Comentario explicativo en `db.ts:2202-2211`. Eliminable solo en el siguiente bump de DB_VERSION cuando se confirme que ninguna DB en producción está por debajo de V65. |
| Tipo TS | `TraspasoPlan` en `src/types/personal.ts:522-543` · solo importado en `db.ts:8`. |

### 2.6 · `inversiones` (vivo · canónico para fondos/acciones/etc.)

| Campo | Detalle |
|---|---|
| Propósito | Posiciones de inversión NO-pensión (fondos · ETFs · acciones · cripto · préstamos · depósitos). |
| Schema | `interface PosicionInversion` en `src/types/inversiones.ts:59-109` · keyPath `id` autoIncrement · 3 índices (`tipo`, `activo`, `entidad`) · `db.ts:2817-2822`. |
| Tipos plan filtrados OUT | `inversionesService.getPosiciones` (`inversionesService.ts:54`) y `getAllPosiciones` (`inversionesService.ts:66`) **excluyen** `plan_pensiones`/`plan-pensiones`/`plan_empleo`. Sin embargo el resumen de cartera (`inversionesService.getResumenCartera`) sí los suma leyendo de `planesPensiones` (`inversionesService.ts:269`). |
| Lectores fondos | `galeriaAdapter` · `posicionesCerradas` (incluye traspasos externos cosméticos en label · `posicionesCerradas.ts:281`). |
| Datos productivos Jose | N/A. |
| Estado | **Vivo.** Pero fondos están modelados de forma plana · sin identidad estable a través de gestoras (cada traspaso AEAT crea posición cerrada nueva con nombre derivado · ver §5). |

### 2.7 · `valoraciones_historicas` (vivo · mixto)

| Campo | Detalle |
|---|---|
| Propósito | Histórico mensual de valor por activo · `tipo_activo: 'inmueble' \| 'inversion' \| 'plan_pensiones'` (3 valores · NO 4 · NO existe `fondo`). |
| Schema | `db.ts:2840-2852` · 4 índices · destacar el compuesto `tipo-activo-fecha` (V60) y el 2-key `tipo-activo` (V69 · `db.ts:2851`). |
| Escritores planes | `traspasosPlanPensionesService.registrarTraspaso` cuando `esTotal=true` (`traspasosPlanPensionesService.ts:103-124`) escribe entrada con `valor: valorTraspaso` para que `rentabilidadPlanService` cierre el bloque. Manual desde `ActualizarValorPlanDialog`. |
| Lectores planes | `rentabilidadPlanService.getRentabilidadPorBloque` · `FichaPlanPensiones` (gráfica). |
| Estado | **Vivo.** Para fondos NO se usa este store · los fondos guardan valoración en `inversiones[].valor_actual` plano. |

---

## 3 · Servicios CRUD relacionados (§3.2)

| Servicio | Archivo | Métodos públicos | Stores que toca | Consumidores |
|---|---|---|---|---|
| `planesPensionesService` | `src/services/planesPensionesService.ts` (155 líneas) | `createPlan` · `updatePlan` · `getPlan` · `getAllPlanes` · `getPlanesPorTipo` · `eliminarPlan` cascade · `getValorActualConsolidado` · `getAportacionesAcumuladasTotal` · `cambiarTipoAdministrativo` · `getAll` (alias) | `planesPensiones` · `aportacionesPlan` (cascade) · `traspasosPlanPensiones` (cascade) · `valoraciones_historicas` (cascade) | NominaPage · PlanesManager · MisPlanesPensiones · FichaPlanPensiones · galeriaAdapter · WizardNuevaPosicion · PlanFormV5 · `aeatPlanesPensionesImportService` · `planesInversionService` (wrapper) |
| `aportacionesPlanService` | `src/services/aportacionesPlanService.ts` (165 líneas) | `crearAportacion` · `getAportacionesPorPlan` · `getAportacionesPorAño` · `getTotalesPorAño` · `sumaAportaciones` · `getTotalAportadoPorPlan` (vía índice) · `getMapaAportacionesAcumuladas` · `mensualizarAnual` · `eliminarAportacion` | `aportacionesPlan` | nominaAportacionHook · galeriaAdapter · posicionesCerradas · PlanesManager · FichaPlanPensiones · AportacionPlanDialog · rentabilidadPlanService · aeatPlanesPensionesImportService |
| `traspasosPlanPensionesService` | `src/services/traspasosPlanPensionesService.ts` (174 líneas) | `registrarTraspaso` (con side-effects al plan y `valoraciones_historicas` si esTotal) · `getTraspasosPorPlan` · `getTraspasosPorPersonalData` · `getTrayectoriaCompleta` · `eliminarTraspaso` · helper `valorTraspasoNormalizado` | `traspasosPlanPensiones` · `planesPensiones` (UPDATE post-traspaso total) · `valoraciones_historicas` (INSERT/UPDATE post-traspaso total) | GestionInversionesPage · PlanesManager · TraspasoForm · TraspasoPlanDialog · FichaPlanPensiones · rentabilidadPlanService |
| `limitesFiscalesPlanesService` | `src/services/limitesFiscalesPlanesService.ts` (428 líneas) | `getLimitesPorTipo` · `validarAportacionDeducible` · `calcularReduccionBaseImponible` · `validarAportacionConyuge` · `getCasillaAEAT` | `planesPensiones` (lectura) · `aportacionesPlan` (lectura) · `ingresos` (tope 30 % rendimientos) | NominaPage (hint fiscal) · FichaPlanPensiones (sección Ventaja fiscal) |
| `rentabilidadPlanService` | `src/services/rentabilidadPlanService.ts` (638 líneas) | `calcularTWRSimple` · `calcularMWR` (Newton-Raphson) · `getRentabilidadTotal` · `getRentabilidadPorBloque` · `getRentabilidadComparativaBloques` | `planesPensiones` · `aportacionesPlan` · `traspasosPlanPensiones` · `valoraciones_historicas` (todas lectura) | PlanesManager (KPIs por card) · FichaPlanPensiones (hero + timeline por bloque) |
| `aeatPlanesPensionesImportService` | `src/services/aeatPlanesPensionesImportService.ts` (278 líneas) | `importarAportacionesAEAT` · `inferirTipoDesdeCasilla` (PPI/PPE/PPES/PPA por casilla 0469/0470/0471/0472/0474) | `planesPensiones` (CRUD vía service) · `aportacionesPlan` (vía service) | **NINGUNO en producción** · solo tests (`__tests__/aeatPlanesPensionesImportService.test.ts`) |
| `declaracionDistributorService` | `src/services/declaracionDistributorService.ts` (1626 líneas) · función `persistirPlanPensiones` (líneas 1014-1100) | Persiste plan tras parsear XML/PDF IRPF · upsert por `nifEmpleador` o nombre · crea aportación anual con `casillaAEAT='RSUMAD'` (no la oficial 0426/0427) | `planesPensiones` · `aportacionesPlan` · `inversiones` (fondos) | Importador XML/PDF AEAT (orquestador principal) |
| `planesInversionService` | `src/services/planesInversionService.ts` (118 líneas) | Wrapper compat · delega todo a `planesPensionesService` · re-exporta tipo · expone `calculatePortfolioSummary`, `getTaxImplications`, `getNextContributionDate` (stubs) | `planesPensiones` (vía service) | GestionInversionesPage (todavía importa este wrapper · `GestionInversionesPage.tsx:433`) |
| `valoracionesService` | `src/services/valoracionesService.ts` (762 líneas) | `getUltimaValoracion` · `getEvolucionActivo` · `addValoracion` · etc. con `tipo_activo: 'inmueble' \| 'inversion' \| 'plan_pensiones'` | `valoraciones_historicas` · `planesPensiones` (para sincronizar valorActual cuando se añade valoración) | FichaPlanPensiones · ActualizarValorPlanDialog · TraspasoPlanDialog (vía side-effect del traspaso) |

---

## 4 · Componentes UI relacionados (§3.3)

| Componente | Archivo | Tipo | Estado | Qué muestra | Stores/servicios | Calidad |
|---|---|---|---|---|---|---|
| `InversionesGaleria` | `src/modules/inversiones/InversionesGaleria.tsx` | Pantalla principal | **Funciona** | Galería unificada cartas heterogéneas · planes + fondos + cripto + etc. con dedup contra `inversiones[tipo='plan_*']`. | `inversionesService` · `planesPensionesService` · `aportacionesPlanService` · `galeriaAdapter` | Bien · es la entrada canónica del usuario tras T23.6. |
| `FichaPlanPensiones` | `src/modules/inversiones/pages/FichaPlanPensiones.tsx` (897 líneas) | Ficha detalle | **Funciona** · 5 de 6 secciones spec | Hero · sparkline · ventaja fiscal · trayectoria rentabilidad por bloque · tabla aportaciones · gráfica valor vs aportado. | `planesPensionesService` · `aportacionesPlanService` · `valoracionesService` · `rentabilidadPlanService` · `limitesFiscalesPlanesService` | Medio-alto · falta sección formal "Datos fiscales" (desglose por tipo · exceso arrastrable · fecha mínima rescate) — está parcialmente cubierto por "Ventaja fiscal". |
| `WizardNuevaPosicion` | `src/modules/inversiones/components/WizardNuevaPosicion.tsx` | Wizard 1+1 pasos | **Funciona** | Paso 1 selector de tipo (4 grupos · 12 tipos) → Paso 2 form específico (`PlanFormV5` o `PosicionFormV5`). | `planesPensionesService` (vía PlanFormV5) · `inversionesService` (vía PosicionFormV5) | Medio · NO es el wizard 5 pasos del spec v2 §8.3 (tipo + empresa + datos + estado + aportación inicial). Cumple funcionalmente al nivel mínimo. |
| `PlanFormV5` | `src/modules/inversiones/components/wizard/PlanFormV5.tsx` | Form embebido en wizard | **Funciona** | Datos básicos plan · titular · gestora · tipo · valor inicial / valor actual. | `planesPensionesService` | Medio · NO captura subtipos PPE/PPES · politicaInversion · porcentajeRentaVariable · participeConDiscapacidad · empresaPagadora vinculada a nómina. Crea planes en shape mínimo. |
| `AportacionPlanDialog` | `src/modules/inversiones/components/AportacionPlanDialog.tsx` | Dialog v5 (1 paso) | **Funciona** | Aportar al plan · importe titular + empresa · cuenta cargo opcional (genera movement + treasuryEvent). | `aportacionesPlanService` · `initDB` (treasury) | Bien. |
| `ActualizarValorPlanDialog` | `src/modules/inversiones/components/ActualizarValorPlanDialog.tsx` | Dialog v5 | **Funciona** | Actualizar `valorActual` y crear entrada en `valoraciones_historicas`. | `planesPensionesService` · `valoracionesService` | Bien. |
| `TraspasoPlanDialog` | `src/modules/inversiones/components/TraspasoPlanDialog.tsx` | Dialog v5 (1 paso) | **Funciona** | Traspaso · gestora destino texto libre · ISIN · valorTraspaso · importeTraspasado · esTotal · fechas. | `traspasosPlanPensionesService.registrarTraspaso` | Bien · cumple §8.4 spec v2 (1 paso). |
| `NominaPage` (NominaWizard) | `src/pages/GestionPersonal/wizards/NominaPage.tsx` | Wizard nómina | **Funciona** · vínculo cableado | Selector "¿a qué plan va?" filtrado a PPE+PPES del titular · hint fiscal en vivo del límite del plan. | `planesPensionesService.getAllPlanes({titular})` · `limitesFiscalesPlanesService` | Bien · usa UUID del plan correctamente (`NominaPage.tsx:282`). |
| `GestionInversionesPage` | `src/pages/GestionInversiones/GestionInversionesPage.tsx` (1239 líneas) | Pantalla legacy en `/gestion/inversiones` | **Funciona** (parcial) · UI paralela a InversionesGaleria | Listado planes · botones añadir/editar/aportar/traspasar/historial. Importa `PlanForm` y `TraspasoForm` legacy. | `planesInversionService` (wrapper) · `traspasosPlanPensionesService` · `inversionesService` | Medio-bajo · UI duplicada con `InversionesGaleria` · invocada solo desde menú "Gestión". Convive con la galería v5 sin sincronización explícita de estado. |
| `PlanForm` | `src/components/personal/planes/PlanForm.tsx` (269 líneas) | Modal 1 paso | **Funciona** | Form completo de alta/edición de plan · todos los campos en 1 modal. | `planesPensionesService` | Medio · más completo que `PlanFormV5` pero sigue sin subtipos PPE/PPES · politicaInversion · etc. Solo invocado desde `GestionInversionesPage`. |
| `TraspasoForm` | `src/components/personal/planes/TraspasoForm.tsx` (301 líneas) | Modal 1 paso | **Funciona** | Traspaso entre planes internos o a gestora externa. Captura `valorTraspaso`. Solo invocado desde `GestionInversionesPage` y `PlanesManager` (zombie). | `planesPensionesService` · `traspasosPlanPensionesService` | Bien · ya migrado al servicio v65. |
| `TraspasosHistorial` | `src/components/personal/planes/TraspasosHistorial.tsx` | Sección tabla | Funciona · solo se renderiza desde `GestionInversionesPage` y `PlanesManager` (zombie). | Tabla histórico de traspasos. | recibe `traspasos` por prop | Bien. |
| `PlanesManager` | `src/components/personal/planes/PlanesManager.tsx` (386 líneas) | Pantalla "Mis planes" · KPIs por card + historial agregado | **ZOMBIE** · no importado en ningún sitio | Listado de planes con KPIs (aportado · TWR · plusvalía) + sección traspasos. | `planesPensionesService` · `aportacionesPlanService` · `traspasosPlanPensionesService` · `rentabilidadPlanService` · `getFiscalContextSafe` | Mal montado por estar muerto · si se reactiva conviene revisar duplicación con `MisPlanesPensiones`. |
| `MisPlanesPensiones` | `src/pages/GestionPersonal/MisPlanesPensiones.tsx` (243 líneas) | Pantalla "Mis Planes de Pensiones" · 3 filtros (titular/tipo/estado) + resumen fiscal año + lista cards | **ZOMBIE** · no importado en ningún sitio | Listado de planes + filtros · resumen fiscal mock (límite PPI hardcodeado 1.500 €). | `planesPensionesService` | Mal · contiene 2 `TODO: abrir wizard` no resueltos · resumen fiscal sin `limitesFiscalesPlanesService` · estilo Tailwind directo (no design-system v5). Duplica funcionalidad de `PlanesManager`. |
| `FichaPosicionPage` | `src/modules/inversiones/pages/FichaPosicionPage.tsx` | Router de ficha por id | Funciona | Si id es UUID → renderiza `FichaPlanPensiones` · si numérico → ficha genérica de inversión. | `useCartaItemById` | Bien · gating limpio numeric/UUID. |

---

## 5 · Hallazgos sobre fondos de inversión (§3.5)

### 5.1 · Modelado actual

Los fondos viven en `inversiones` con `tipo='fondo_inversion'` (uno de 11 tipos de `TipoPosicion` en `src/types/inversiones.ts:4-20`). Cada fondo es una `PosicionInversion` con un array `aportaciones: Aportacion[]` (`types/inversiones.ts:22-35`) donde cada aportación puede tener `tipo: 'aportacion' | 'reembolso' | 'dividendo'`.

- **Coste FIFO**: cuando se registra una `aportacion` de tipo `reembolso`, `inversionesService.addAportacion` (`inversionesService.ts:154-178`) llama a `calcularGananciaPerdidaFIFO` y rellena `coste_adquisicion_fifo` y `ganancia_perdida`. Esto es realización · no diferimiento.
- **Identidad estable**: NO existe. Si Jose traspasa fondo Indexa → MyInvestor, hoy el sistema lo modela como **2 posiciones distintas** (una cerrada con valoración, otra nueva). No hay UUID compartido entre las dos.
- **Régimen art. 94 LIRPF (diferimiento entre fondos)**: NO modelado. El sistema asume realización completa al cerrar la posición.

### 5.2 · Conteo + ejemplo

Conteo en producción **N/A** (entorno aislado). Único punto donde el código crea fondos automáticamente: `declaracionDistributorService.persistirInversionesDeclaradas` (`declaracionDistributorService.ts:1118-1142`) crea una `PosicionInversion` cerrada (`activo: false`) por cada transmisión declarada en IRPF. Forma del registro generado:

```typescript
{
  nombre: `Fondo ${fondo.nifFondo || 'desconocido'} (${año})`,
  tipo: 'fondo_inversion',
  entidad: fondo.nifFondo || 'AEAT',
  isin: fondo.nifFondo || undefined,
  valor_actual: fondo.valorTransmision ?? 0,
  fecha_valoracion: hoy,
  aportaciones: [],   // vacío · no se reconstruye FIFO desde XML
  total_aportado: fondo.valorAdquisicion ?? 0,
  rentabilidad_euros: fondo.ganancia ?? 0,
  notas: `Transmisión declarada IRPF ${año}. Retención: ${fondo.retencion ?? 0} €`,
  activo: false,
  ...
}
```

Dedup por nombre exacto · si el usuario importa varias declaraciones del mismo año NO se reduplica · si re-importa años distintos sí se crean varios fondos con el mismo NIF.

### 5.3 · Traspasos entre gestoras de fondos

**No existe entidad ni store de traspasos de fondos.** Búsquedas:

- `grep -rn "traspasoFondo|traspasosFondos|movimientoFondo" src` → 0 resultados.
- `tipo_activo` en `valoraciones_historicas` admite solo 3 valores: `'inmueble' | 'inversion' | 'plan_pensiones'` (`valoracionesService.ts:8`) · no hay `'fondo_inversion'` separado · los fondos comparten el bucket `'inversion'`.

Único concepto relacionado: `posicionesCerradas.ts:281` etiqueta cosméticamente `: 'traspaso externo'` cuando una posición cerrada lo refleja en notas · es solo presentación, no datos.

### 5.4 · Duplicación · UI manual vs XML AEAT

**No detectado el patrón "pensiones" en fondos.** El único escritor automático de fondos (XML) crea directamente en `inversiones` con `activo: false`. La UI manual (`PosicionFormV5` desde wizard) también escribe en `inversiones`. NO hay store paralelo zombi como `planesPensionInversion`.

### 5.5 · Diferimiento fiscal

No se distingue diferimiento art. 94 LIRPF vs realización en el modelado de datos. `inversionesFiscalService.calcularGananciaPerdidaFIFO` siempre calcula `ganancia_perdida` al cerrar. La consecuencia fiscal del traspaso entre gestoras NO está representada como evento neutro · simplemente se "cierra una posición" (que es semánticamente lo opuesto del régimen real).

---

## 6 · Vínculo nómina-plan · análisis dedicado (§3.4)

### 6.1 · Selector en el wizard

**Existe** y está cableado. `NominaPage.tsx:193` carga `planesPensionesService.getAllPlanes({ titular })` y filtra a `PPE | PPES` (`NominaPage.tsx:198-201`). El estado del form tiene `planActivo` (bool), `planVinculadoId` (string UUID), `planAportTuya` (string €), `planAportEmpresa` (string €) y se persiste a `Nomina.planPensiones` con shape `PlanPensionesNomina` (`src/types/personal.ts:248-270`):

```typescript
{
  productoDestinoId?: number | string;   // UUID string post-V65 (NominaPage.tsx:282)
  productoDestinoNombre?: string;
  aportacionEmpresa: { tipo, valor, salarioBaseObjetivo? },
  aportacionEmpleado: { tipo, valor, salarioBaseObjetivo? },
}
```

### 6.2 · Efecto al confirmar la nómina

`treasuryConfirmationService` (no leído en detalle aquí) dispara `procesarConfirmacionEvento(evento)` en `nominaAportacionHook.ts:119`, que delega a `onNominaConfirmada(evento, nomina)`. El hook:

1. Resuelve el plan por UUID primero (`planesNuevos.find(p => p.id === String(productoId))` · `nominaAportacionHook.ts:74`).
2. Fallback `empresaPagadora.ingresoIdVinculado === String(productoId)` para registros legacy (`nominaAportacionHook.ts:76-78`).
3. Idempotencia por `(planId, ingresoIdNomina)` (`nominaAportacionHook.ts:90-97`).
4. Crea `AportacionPlan` con `origen: 'nomina_vinculada'`, `granularidad: 'mensual'`, `ingresoIdNomina = String(sourceId ?? id)`, fecha = primer día del mes del evento, ejercicioFiscal = año del evento (`nominaAportacionHook.ts:99-112`).

### 6.3 · ¿`aportacionesPlan` es la única vía? ¿Coherencia?

Sí · `aportacionesPlan` es destino canónico. Tres orígenes escriben aquí:

| Origen | Servicio | `aportacionesPlan.origen` |
|---|---|---|
| Nómina vinculada | `nominaAportacionHook.onNominaConfirmada` | `'nomina_vinculada'` |
| XML AEAT | `declaracionDistributorService.persistirPlanPensiones` | `'xml_aeat'` |
| XML AEAT alternativo (sin consumidor) | `aeatPlanesPensionesImportService.importarAportacionesAEAT` | `'xml_aeat'` |
| Manual UI | `AportacionPlanDialog` (v5) y `aportacionesPlanService.crearAportacion` directo | `'manual'` |
| Migración v65 (legacy → v65) | upgrade callback `db.ts:4000`, `4061` | `'migrado_v60'` (o `'xml_aeat'` si `fuente==='xml_aeat'` en el record viejo) |

### 6.4 · Caso real Jose · PPE Orange CIF A82009812

No es verificable desde código en esta auditoría (no acceso a DB productiva). La spec menciona que está hidratado · revisable en consola Indexed-DB de Jose con:
```js
indexedDB.open('atlas-horizon-db').onsuccess = e => {
  const db = e.target.result;
  db.transaction('planesPensiones').objectStore('planesPensiones').getAll().onsuccess =
    ev => console.table(ev.target.result.filter(p => p.empresaPagadora?.cif === 'A82009812'));
};
```

---

## 7 · Gap spec v2 TAREA 13 vs realidad (§3.6)

| Spec v2 propone | Símbolo | Estado real | Acción real recomendada |
|---|---|---|---|
| Crear store `planesPensiones` | ✅ | Existe desde V65 (`db.ts:2792`) · vivo · canónico. | NINGUNA · ya hecho. |
| Crear store `aportacionesPlan` | ✅ | Existe desde V65 (`db.ts:2799`) · 5 índices · vivo. | NINGUNA. |
| Crear store `traspasosPlanPensiones` | ✅ | Existe desde V65 (`db.ts:2808`) · 2 índices. | NINGUNA. |
| Crear `limitesFiscalesPlanesService` | ✅ | Existe (`limitesFiscalesPlanesService.ts`) · 8/9 constantes spec presentes · falta tope 8.000 € base imp. cónyuge aportante. | Añadir validación del tope conjunto cónyuge si se prioriza. |
| Tabla `LIMITES_2026_TERRITORIO_COMUN` | ✅ | Implícita en constantes del servicio (`LIMITE_PPI_PPA = 1500` · etc.). | Refactor cosmético a tabla por año si se quiere actualizar fácil. |
| Pantalla "Mis Planes de Pensiones" | 🟡 | **Dos zombis** (`PlanesManager` y `MisPlanesPensiones`) + canónica viva = `InversionesGaleria` (galería unificada · planes mostrados ahí) + `GestionInversionesPage` (UI paralela vía `/gestion/inversiones`). | Decidir D4 (§9). Si se prefiere pantalla dedicada → enchufar uno de los zombis y eliminar el otro. |
| Wizard alta 5 pasos | 🟡 | Hay 2 forms (`PlanForm` legacy 1 modal · `PlanFormV5` 1 form embebido en wizard). Ninguno es 5 pasos. Captura mínima (no subtipos PPE/PPES, no politicaInversion, no participeConDiscapacidad). | Decidir si MVP suficiente (campos básicos) o reescribir a wizard 5 pasos. Spec v3 lo marca como "no bloqueante". |
| Detalle 6 secciones (Resumen / Trayectoria / Aportaciones / Valoraciones / Traspasos / Datos fiscales) | 🟡 | `FichaPlanPensiones` implementa Resumen (Hero + CAGR/TWR) · Aportaciones tabla · Valoraciones gráfica sparkline · Traspasos + rentab. por bloque · Ventaja fiscal del año en curso. Falta: sección "Trayectoria timeline" formal y sección "Datos fiscales" con desglose por tipo + exceso arrastrable + fecha mínima rescate. | Ampliar `FichaPlanPensiones` con las 2 secciones faltantes (estimación 1-2 h). |
| Wizard traspaso 1 paso | ✅ | `TraspasoPlanDialog` (v5) y `TraspasoForm` (legacy V65) cumplen. Capturan `valorTraspaso` + idempotencia + side-effects al plan. | NINGUNA. |
| `NominaWizard` selector cableado | ✅ | `NominaPage.tsx:191-201, 280-287` · usa `planesPensionesService` · UUID string · hint fiscal en vivo. | NINGUNA. |
| Sección Cartera Inversiones leyendo de `planesPensiones` | ✅ | `InversionesGaleria` vía `getAllCartaItems` (`galeriaAdapter.ts:44-81`) · dedup contra `inversiones[tipo='plan_*']` · `inversionesService.getResumenCartera` (`inversionesService.ts:269`) suma valor de planes. | NINGUNA. |
| Importador XML AEAT escribiendo `tipoAdministrativo` correcto | 🟡 | `declaracionDistributorService.persistirPlanPensiones` infiere `tipoAdm = nifEmpleador ? 'PPE' : 'PPI'` (no consulta casilla). El servicio alternativo `aeatPlanesPensionesImportService.inferirTipoDesdeCasilla` (sí mapea casilla 0469/0470/0471/0472/0474) **no se invoca en producción**. | Decidir entre (a) ampliar `persistirPlanPensiones` para mirar casilla · (b) cablear `aeatPlanesPensionesImportService` en el orquestador. Estado fiscal del fix B6 ya cerrado (`fixAportacionesPlanCruceB6.ts`). |
| Migración v64 → v65 con datos preservados | ✅ | `db.ts:3927-4110` · migra `planesPensionInversion → planesPensiones + aportacionesPlan` (PPI/PPE por presencia de `empresaNif`) y `traspasosPlanes → traspasosPlanPensiones` · luego elimina los stores legacy. Tests en `dbV65Migration.test.ts`. | NINGUNA. |
| Eliminación de `planesPensionInversion` | ✅ | Store eliminado en V65 (`db.ts:4104-4106`). Tipo TS y `traspasosPlanes` (`db.ts:2212`) aún declarados solo por el `deleteObjectStore` idempotente para DBs antiguas. | Eliminar tipo TS y referencia en el upgrade callback solo cuando se confirme que no hay DBs < V65 en producción · siguiente bump DB. |
| Renombrado `traspasosPlanes` → `traspasosPlanPensiones` | ✅ | Hecho en V65 · store legacy eliminado · migración de datos cubierta. | NINGUNA. |

Leyenda · ✅ ya existe correcto · 🟡 existe parcial o mal montado · ❌ no existe (sin entradas).

---

## 8 · Bugs conocidos y deuda técnica detectada (§3.7)

| # | Severidad | Descripción | `file:línea` | Afecta T13? | Acción propuesta |
|---|---|---|---|---|---|
| B6 | **cerrado** | Cruce `importeTitular ↔ importeEmpresa` en registros AEAT antiguos. Parser arreglado en origen · migración one-shot voltea registros existentes · flag idempotente `migration_b6_aportacionesPlan_v1` en `keyval`. | `src/services/migrations/fixAportacionesPlanCruceB6.ts` · `services/__tests__/...` | No (ya fixado) | Ninguna. Mantener flag. |
| Z1 | medio | `PlanesManager.tsx` (386 líneas con KPIs + rentabilidad) **no está enchufado** a ninguna ruta · ningún consumer. | `src/components/personal/planes/PlanesManager.tsx:22` | Sí (decisión D4) | Eliminar o cablear a `/personal/planes`. |
| Z2 | medio | `MisPlanesPensiones.tsx` (243 líneas con filtros titular/tipo/estado + resumen fiscal) **no está enchufado** a ninguna ruta · ningún consumer · contiene `TODO: abrir wizard` no resueltos. Duplica funcionalidad parcial de `PlanesManager`. | `src/pages/GestionPersonal/MisPlanesPensiones.tsx:30` | Sí (decisión D4) | Eliminar o cablear. Si se cablea, elegir entre Z1 y Z2 · no ambos. |
| D1 | medio | UI doble para gestionar planes · `InversionesGaleria` (v5 canónica) + `GestionInversionesPage` (UI paralela). Estado entre ellas no se sincroniza (cada una recarga al montar). | `src/pages/GestionInversiones/GestionInversionesPage.tsx:379` vs `src/modules/inversiones/InversionesGaleria.tsx:40` | Sí (decisión D4) | Decidir cuál es canónica · sunset de la otra. |
| D2 | medio | `aeatPlanesPensionesImportService.importarAportacionesAEAT` está implementado y testado · 0 consumidores en producción. Spec v3 §5.2 lo marca como pendiente · `declaracionDistributorService.persistirPlanPensiones` ya cumple la función parcialmente (sin inferencia por casilla AEAT). | `src/services/aeatPlanesPensionesImportService.ts:163` | Sí | Decidir: integrar este servicio en el orquestador o ampliar `persistirPlanPensiones`. Elegir uno y borrar el otro. |
| D3 | bajo | `traspasosPlanes` tipo TS sigue declarado en `AtlasHorizonDB` interface (`db.ts:2212`) solo para soportar `deleteObjectStore` idempotente · no eliminable hasta siguiente DB bump. | `src/services/db.ts:2212` | No | Eliminar en próximo bump cuando se confirme cero DBs < V65 en producción. |
| D4 | bajo | `planesInversionService` (`118 líneas`) es wrapper compat que delega a `planesPensionesService` · stubs `calculatePortfolioSummary` y `getTaxImplications` devuelven valores hardcodeados (`1500 €`). Aún importado por `GestionInversionesPage`. | `src/services/planesInversionService.ts` | No | Cuando se decida la canónica de UI (D4 architectural) → eliminar wrapper si nadie lo importa. |
| D5 | bajo | `casillaAEAT` del registro creado por `declaracionDistributorService` es `'RSUMAD'` (clave interna del XML) en vez de las casillas oficiales 0426/0427. | `src/services/declaracionDistributorService.ts:1094` | Sí | Mapear a 0426 (titular) / 0427 (empresa) según `aportacionesTrabajador` / `contribucionesEmpresa` · alineado con el TODO marcado en `limitesFiscalesPlanesService.getCasillaAEAT`. |
| F1 | medio | Fondos no tienen identidad estable a través de traspasos entre gestoras · cada transmisión declarada crea posición cerrada nueva. Régimen art. 94 LIRPF no modelado. | `src/services/declaracionDistributorService.ts:1118-1142` · `src/services/inversionesService.ts` · arquitectura general | No (fuera T13 actual) | Decisión D5 (§9). Si se modela, replicar patrón pensiones: UUID estable + store `traspasosFondos` (o uno genérico polimórfico). |
| F2 | bajo | `valoraciones_historicas` no admite `tipo_activo='fondo'` · los fondos comparten bucket `'inversion'`. | `src/services/valoracionesService.ts:8` | No | Si se modela traspaso de fondos · plantear si se desagrega. |
| W1 | cosmético | `MisPlanesPensiones` no usa `design-system/v5` · tailwind directo. | `src/pages/GestionPersonal/MisPlanesPensiones.tsx` | No | Solo relevante si se cablea (Z2). |
| W2 | cosmético | `MisPlanesPensiones` muestra "Límite deducción PPI/PPA · 1.500 €" hardcodeado en lugar de consultar `limitesFiscalesPlanesService.getLimitesPorTipo`. | `src/pages/GestionPersonal/MisPlanesPensiones.tsx:135-137` | No | Idem W1. |

---

## 9 · Decisiones arquitectónicas pendientes (§3.8)

Las decisiones siguen abiertas · CC NO las cierra. Las decide Jose con Claude tras revisar este informe.

- **D1 · Store de traspasos genérico vs específico por tipo de activo.**
  - Opción A · genérico `traspasos { tipoActivo: 'plan_pension' | 'fondo_inversion', activoOrigenId, activoDestinoId, ... }` con FK polimórfica.
  - Opción B · específico · mantener `traspasosPlanPensiones` y crear nuevo `traspasosFondos` espejo si y solo si se modela el régimen art. 94.
  - Trade-off · A reutiliza más código pero acopla pensiones y fondos en un store · B respeta separación de dominios pero duplica.
  - Recomendación CC · diferir hasta D5 · si se decide modelar fondos con identidad, entonces decidir A vs B en función del tamaño del esquema (planes tienen `cambioTipoAdministrativo`, `politicaInversion`, etc. que NO aplican a fondos · sugiere B).

- **D2 · Migración o reescritura de datos existentes.**
  - Realidad · la migración V65 ya migró `inversiones[tipo IN ('plan_pensiones','plan-pensiones','plan_empleo')] → planesPensiones`. Los registros que quedan en `inversiones` con esos tipos NO se leen como inversión (`inversionesService.ts:54, 66`).
  - Pregunta abierta · ¿Eliminar físicamente los registros migrados de `inversiones` (cleanup one-shot), o dejar como sombra histórica?

- **D3 · Eliminación de `planesPensionInversion` definitiva.**
  - Realidad · ya eliminado en V65 (`db.ts:4104-4106`). Solo queda residuo en la interfaz TS (`db.ts:2212` para `traspasosPlanes`, no para `planesPensionInversion`). 
  - Pregunta · ¿Limpiar declaración TS de `traspasosPlanes` y la rama `oldVersion > 0 && oldVersion < 65` de creación legacy (`db.ts:2767-2785`) en el siguiente bump?

- **D4 · Alcance UI · 4 pantallas que cubren lo mismo.**
  - Realidad · `InversionesGaleria` + `GestionInversionesPage` + `PlanesManager` (zombie) + `MisPlanesPensiones` (zombie).
  - Pregunta · ¿UI canónica es la galería v5 (cards heterogéneas)? Si sí · eliminar `GestionInversionesPage`, `PlanesManager.tsx`, `MisPlanesPensiones.tsx`, `PlanForm.tsx` legacy. Si no · cablear una de las zombies y eliminar las otras dos.
  - Recomendación CC · galería v5 es la canónica (es la que ve el usuario en `/inversiones`, está más pulida, integra fondos+planes en una sola vista). Eliminar las otras 3.

- **D5 · Fondos en T13 o en T13-bis.**
  - Realidad · TAREA 13 v2 no menciona fondos · TAREA 13 v3 tampoco. Los fondos NO tienen identidad estable hoy.
  - Pregunta · ¿Modelar traspasos entre fondos ahora (extensión del scope T13) o tarea separada (T13-bis)?
  - Recomendación CC · separar (T13-bis). T13 está al 90 % cerrada · meterle fondos abre arquitectura nueva (identidad estable + régimen art. 94 + valoraciones tipo `fondo` separado de `inversion`) que merece su propio spec.

- **D6 · XML AEAT · `declaracionDistributorService` vs `aeatPlanesPensionesImportService`.**
  - Realidad · ambos existen · solo el primero se invoca · el segundo es código + tests sin consumidor.
  - Pregunta · ¿Mantener el primero y enriquecerlo con inferencia por casilla (mapping del segundo), o cablear el segundo y deprecar el `persistirPlanPensiones` parcial del primero? El segundo es más completo en mapeo (PPI/PPA/PPE/PPES por casilla) y tiene `casillaAEAT` correcto.

---

## 10 · Salida esperada · próximos pasos sugeridos

Tras esta auditoría:

1. **Cerrar la spec v2/v3 de TAREA 13** con el conocimiento real · trabajo restante real estimado:
   - Eliminación de UI zombie (Z1, Z2, D1) · 1-2 h.
   - Cierre D6 (cablear inferencia por casilla en XML AEAT) · 1-2 h.
   - Sección Datos fiscales formal en `FichaPlanPensiones` · 1-2 h.
   - Ampliar `validarAportacionDeducible` con tope 30 % rendimientos y mejorar firma de `calcularReduccionBaseImponible` · 1-2 h (ya documentado en `DELTA-T13-V65-vs-spec-v3.md`).
2. **Decidir D1-D6** sobre datos concretos.
3. **Bugs no documentados detectados aquí** (Z1, Z2, D5, F1, F2, W1, W2) entran en backlog · no se arreglan en T13.

---

## 11 · Fuera de alcance

- Implementación · ninguna · auditoría de solo lectura.
- Fixes de bugs detectados · se listan, no se arreglan.
- EPSV y mutualidades profesionales · fuera de proyecto.
- TAREA 13 propiamente dicha · siguiente paso tras revisar este informe.

---

**Fin del informe.** Esperar revisión de Jose antes de proponer plan de implementación.
