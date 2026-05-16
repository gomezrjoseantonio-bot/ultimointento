# TAREA CC · T-INVERSIONES-V5 · rediseño completo módulo Inversiones

> **Tipo** · refactor UI exhaustivo · NO toca modelo de datos · NO toca DB.
> **Decisiones cerradas con Jose** · A1 sustituye T13v4 · B1 absorbe 8 issues pulido · C1 una sola tarea exhaustiva.
> **Estimación** · 20-30h CC · 5 PRs secuenciales con stop-and-wait.
> **Mockup de referencia** · `atlas-inversiones-v3.html` · 8 páginas + 12 modales · revisado y aprobado por Jose.
> **Regla absoluta** · si CC encuentra cualquier divergencia entre esta spec y el código real durante el pre-flight · DETENER y reportar a Jose · NO improvisar.

---

## 0 · Pre-flight obligatorio · NO empezar a tocar código sin completar esto

### 0.1 · Auditoría componentes UI actuales

CC debe inventariar y reportar a Jose en un comentario del primer PR · antes de tocar nada · los siguientes archivos · con conteo de líneas y consumidores:

| Componente | Ruta esperada | Acción tras pre-flight |
|---|---|---|
| `InversionesGaleria.tsx` | `src/modules/inversiones/InversionesGaleria.tsx` | Sustitución completa |
| `WizardNuevaPosicion.tsx` | `src/modules/inversiones/components/wizard/` | Sustitución |
| `PosicionFormV5.tsx` (T13 v4) | `src/modules/inversiones/components/wizard/` | Sustitución parcial · ver §3 |
| `FichaPosicionPage.tsx` | `src/modules/inversiones/pages/` | Reestructuración · ver §4 |
| `FichaValoracionSimple.tsx` | `src/modules/inversiones/components/` | Sustitución |
| `FichaPlanPensiones.tsx` (T13 v4) | `src/modules/inversiones/components/` | **PRESERVAR 2 secciones T13v4 · ver §4.2** |
| `FichaDividendos.tsx` | `src/modules/inversiones/components/` | Sustitución |
| `AportacionFormDialog.tsx` | `src/modules/inversiones/components/` | Sustitución |
| `ActualizarValorPlanDialog.tsx` | `src/modules/inversiones/components/` | Sustitución |
| `CintaResumenInversiones.tsx` | `src/modules/inversiones/components/` | Preservar · solo actualizar números |
| `PosicionesCerradasPage.tsx` | `src/modules/inversiones/pages/` | Renombrar UI · ver §5 |
| `galeriaAdapter.ts` | `src/modules/inversiones/adapters/` | Ampliar · tags por tipo |
| `helpers.ts` | `src/modules/inversiones/` | Revisar agrupación tipos |
| `cartaItem.ts` | `src/modules/inversiones/types/` | Ampliar con tag por tipo |

### 0.2 · Stores que NO se tocan en esta tarea

```
inversiones · planesPensiones · aportacionesPlan · traspasosPlanPensiones
valoraciones_historicas · ejercicioFiscalCoord · cuentas · contracts
```

Esta tarea es UI puro · NO bump DB · NO modificar shape de stores · NO añadir nuevos campos a stores existentes salvo los 3 issues pulido datos (§7.6 · §7.7 · §7.8) que SÍ modifican datos pero NO schema.

### 0.3 · 5 zombis ya eliminados por T13 v4 D4 · confirmar 0 referencias

```
GestionInversionesPage · PlanesManager · MisPlanesPensiones
PlanForm · TraspasoForm
```

Si CC encuentra cualquier import residual a estos archivos · reportar antes de seguir.

### 0.4 · Lo que CC entrega antes del primer PR de código

Un comentario en el issue de GitHub Copilot Workspace con:

1. Inventario §0.1 con conteo de líneas y conteo de consumidores (`grep -r 'import.*ComponentName'` por cada uno).
2. Confirmación de §0.2 · ninguno de esos stores aparece en archivos a modificar.
3. Confirmación de §0.3 · 0 referencias a los 5 zombis.
4. Lista de tests existentes en `src/modules/inversiones/__tests__/` y `src/modules/inversiones/**/__tests__/` · 43 baseline pre-existentes · NO romper.
5. Pregunta abierta a Jose si encuentra algo que la spec no contempla.

**Stop-and-wait obligatorio** · Jose responde OK al pre-flight · CC abre el primer PR de código.

---

## 1 · Alcance · qué entra y qué NO entra

### 1.1 · Entra en esta tarea

- Sustitución completa de la UI del módulo `/inversiones` siguiendo el mockup `atlas-inversiones-v3.html`.
- 8 páginas · galería · 6 fichas tipadas · posiciones cerradas · ficha genérica para depósitos.
- 12 modales con estilo ATLAS unificado (header navy + panel preview lateral en vivo).
- Sustitución del wizard alta plan T13v4 por el del mockup · preservando lógica (CIF + nombre empresa + check discapacidad + secciones condicionales PPE/PPES).
- Absorción de los 8 issues pulido (§7).
- Renombrado "Histórico fiscal" → "Posiciones cerradas" en galería + h1 página.
- Eliminación de card "Añadir posición" de la galería (queda solo el botón en page-head).
- Selector "Nueva posición" reducido a 6 familias (no 12 tipos).
- Tags por tipo diferenciados en cards · PPI · PPE · PPES · PPA · Fondo · ETF · REIT · Acción · P2P · Préstamo · Depósito · Crypto · Otro.
- Filtros galería por categoría · Todas · Planes pensiones · Equity / fondos · Renta fija · Otros.

### 1.2 · NO entra · diferido a otras tareas

- **Modelo de datos fondos** · diferido a T13-bis (Jose decidió aparcar).
- **Régimen art. 94 LIRPF** · diferido a T13-bis2 cuando Jose haga su primer traspaso.
- **Borrado zombie `InversionesPage` horizon** · sigue en backlog limpieza.
- **Sparkline real desde valoraciones mensuales** · sigue sintética desde aportaciones + valor actual (decisión Q5 MVP).
- **Cualquier cambio en pensiones que NO sea UI** · servicio fiscal · stores · migraciones · queda como está post-T13v4.

### 1.3 · Lo que se PRESERVA intacto

- Los 2 servicios fiscales cerrados por T13v4 · `limitesFiscalesPlanesService.ts` · `aeatPlanesPensionesImportService.ts`.
- Las 2 secciones nuevas T13v4 en la ficha de plan · datos fiscales hogar + trayectoria de aportaciones por ejercicio.
- El wrapper `planesInversionService` (decisión D2 diferida).
- Los 43 tests pre-existentes en rojo · baseline · no se tocan.

---

## 2 · Decisiones de producto cerradas con Jose

| Código | Decisión | Implicación |
|---|---|---|
| A1 | Sustituye T13v4 wizard plan | CC retira `PosicionFormV5` del flujo de alta plan y lo reemplaza por el nuevo wizard del mockup |
| B1 | 8 issues pulido absorbidos | `TAREA-CC-T13v4-pulido-ficha-wizard-v1.md` queda obsoleta · CC la elimina del repo |
| C1 | Una sola tarea exhaustiva | Esta spec cubre todo · pero la entrega es 5 PRs secuenciales con stop-and-wait entre cada uno · ver §10 |
| Q3 | 0 traspasos fondo→fondo históricos | NO se modela traspaso fondo en esta tarea |
| Q5 | Sparkline sintética MVP | NO se cablea D4 valoraciones_historicas con tipo `'fondo'` |

---

## 3 · Mockup de referencia · armado del rediseño

### 3.1 · Archivo

`atlas-inversiones-v3.html` · 4414 líneas · 228 KB · entregado por Jose en outputs.
CC debe descargar este HTML como referencia visual binding. La spec describe el qué · el mockup demuestra el cómo.

### 3.2 · 8 páginas

| ID en mockup | Descripción | Equivalente en código actual |
|---|---|---|
| `galeria` | Vista cartera · 6 cards activas + sección "Posiciones cerradas" colapsable | `InversionesGaleria.tsx` |
| `plan-orange` | Ficha plan pensiones (PPI/PPE/PPES/PPA) | `FichaPlanPensiones.tsx` T13v4 (preservar 2 secciones) |
| `sp500` | Ficha fondo de inversión | `FichaValoracionSimple.tsx` para tipo fondo |
| `acciones` | Ficha acción / ETF / REIT (RSU Orange) | `FichaValoracionSimple.tsx` para tipo acción |
| `smartflip` | Ficha préstamo P2P | nuevo · grupo "rendimientos periódicos" |
| `unihouser` | Ficha préstamo a empresa | nuevo · idem |
| `generica` | Ficha depósito BBVA 24M · plantilla para depósito · cuenta · crypto · otros | nueva · plantilla genérica |
| `cerradas` | Posiciones cerradas · vendido o liquidado | `PosicionesCerradasPage.tsx` (renombrada) |

### 3.3 · 12 modales · patrón ATLAS unificado

Todos con esta estructura (CSS y HTML en mockup CSS sección "MODAL ATLAS"):

```
+--------------------------------------------------+
| HEADER NAVY · icono cuadrado + título + close X  |
+--------------------------------------------------+
|                              |                    |
|  FORM IZQUIERDA              | PREVIEW DERECHA   |
|  (atlas-section-title +      | (atlas-preview-hd |
|   atlas-selector-h cards +   |  + atlas-preview- |
|   atlas-row campos)          |  card-dark + rows)|
|                              | EN VIVO           |
+--------------------------------------------------+
| FOOTER · info izq + Cancelar/Guardar oro derecha |
+--------------------------------------------------+
```

Lista de modales:

| ID modal | Wizard | Preview en vivo |
|---|---|---|
| `nueva-posicion` | Selector 6 familias | sin preview · solo selector |
| `alta-plan` | Wizard alta plan PPI/PPE/PPES/PPA | CÁLCULO FISCAL · límite deducible dinámico |
| `alta-fondo` | Wizard alta fondo | RÉGIMEN ART. 94 · diferimiento (informativo, no realista hasta T13-bis) |
| `alta-accion` | Wizard alta acción / ETF / REIT | TRAMOS BASE AHORRO · 19→28 % |
| `alta-prestamo` | Wizard préstamo P2P / a empresa | CÁLCULO FINANCIERO · cobros netos previstos |
| `alta-deposito` | Wizard depósito / cuenta remunerada | VISTA PREVIA · liquidación + FGD |
| `alta-crypto` | Wizard crypto / otro | OBLIGACIONES FISCALES · Modelo 721 umbral |
| `aportar` | Aportación a posición existente | IMPACTO FISCAL · ahorro estimado IRPF |
| `traspaso` | Traspaso entre gestoras (solo planes en esta tarea) | PLAN ORIGEN · régimen sin tributación |
| `actualizar-valoracion` | Valoración mensual manual | sin preview · narrow |
| `vender` | Venta / rescate / reembolso | CÁLCULO FIFO · neto previsto tras retención |
| `editar` | Editar campos administrativos | sin preview · zona peligrosa al pie |

---

## 4 · Arquitectura UI · qué se crea · qué se sustituye · qué se preserva

### 4.1 · Componentes nuevos

```
src/modules/inversiones/components/modal/
├── ModalAtlas.tsx                    // shell común header+body+preview+footer
├── ModalAtlasHeader.tsx              // navy + icono cuadrado + título + close
├── ModalAtlasFooter.tsx              // info izq + cancelar/guardar oro
├── ModalAtlasPreview.tsx             // panel derecha · card dark + rows + banners
├── SelectorNuevaPosicion.tsx         // 6 familias · NO 12 tipos
├── AltaFondoModal.tsx                // wizard fondo · NUEVO · spec mínima MVP
├── AltaAccionModal.tsx               // wizard acción/ETF/REIT · NUEVO
├── AltaPrestamoModal.tsx             // wizard préstamo P2P/empresa · NUEVO
├── AltaDepositoModal.tsx             // wizard depósito/cuenta · NUEVO
├── AltaCryptoModal.tsx               // wizard crypto/otro · NUEVO
├── AportarModal.tsx                  // sustituye AportacionFormDialog
├── TraspasoModal.tsx                 // wizard traspaso planes (solo planes)
├── ActualizarValoracionModal.tsx     // sustituye ActualizarValorPlanDialog
├── VenderModal.tsx                   // wizard venta/rescate · NUEVO
└── EditarPosicionModal.tsx           // edit administrativo · NUEVO

src/modules/inversiones/components/ficha/
├── FichaShell.tsx                    // hero compacto + barra acciones + grid 2 cols
├── FichaHero.tsx                     // .detail-hero · 4 KPIs estrella
├── FichaActionBar.tsx                // botones Actualizar · Aportar · Traspasar · Rescatar · Editar
├── FichaPlanPensiones.tsx            // PRESERVA 2 secciones T13v4 + nueva cabecera + acciones
├── FichaFondo.tsx                    // tipada · sustituye FichaValoracionSimple para fondos
├── FichaAccion.tsx                   // tipada · sustituye FichaValoracionSimple para acciones/ETF/REIT
├── FichaPrestamo.tsx                 // NUEVA · préstamos P2P / a empresa
├── FichaDeposito.tsx                 // NUEVA · depósito · cuenta remunerada
└── FichaGenerica.tsx                 // fallback · crypto · otro

src/modules/inversiones/components/galeria/
├── GaleriaHeader.tsx                 // page-head con 2 botones
├── GaleriaFiltros.tsx                // filtros por categoría + orden
├── GaleriaCard.tsx                   // card unificada con tag por tipo
└── PosicionesCerradasSection.tsx     // sección colapsable al pie

src/modules/inversiones/wizard/
└── AltaPlanWizard.tsx                // NUEVO · sustituye PosicionFormV5 para tipo plan
```

### 4.2 · Ficha plan · PRESERVAR 2 secciones T13v4

La nueva `FichaPlanPensiones.tsx` mantiene **identicas en lógica y datos** las 2 secciones que T13 v4 cerró ayer:

1. **Sección "Datos fiscales por plan + hogar"** · muestra · límite anual · aportaciones del ejercicio · margen restante · marginal IRPF aplicado · ahorro estimado en cuota. Lee de `ejercicioFiscalCoord` y `aportacionesPlan`. Lógica intacta · solo cambia la presentación (cabecera negra → cabecera nueva ATLAS).
2. **Sección "Trayectoria de aportaciones"** · tabla histórica de aportaciones por ejercicio · agrupada por año fiscal · sortable. Lee de `aportacionesPlan` con índice `ejercicioFiscal`. Lógica intacta.

CC NO toca · solo recoloca dentro del nuevo layout de ficha y aplica tokens nuevos.

### 4.3 · Componentes a retirar

```
PosicionFormV5.tsx  → sustituido por AltaPlanWizard + AltaFondoModal + …
WizardNuevaPosicion.tsx → sustituido por SelectorNuevaPosicion
FichaValoracionSimple.tsx → sustituido por FichaFondo + FichaAccion + FichaGenerica
FichaDividendos.tsx → absorbido por FichaAccion (sección dividendos integrada)
AportacionFormDialog.tsx → sustituido por AportarModal
ActualizarValorPlanDialog.tsx → sustituido por ActualizarValoracionModal
```

CC retira estos archivos **al final del último PR** · no antes · para no romper imports intermedios. Comprobar 0 referencias antes del delete con `grep`.

### 4.4 · Componentes preservados intactos

```
CintaResumenInversiones.tsx
galeriaAdapter.ts (solo ampliación de tags)
helpers.ts (solo revisión de groupTipo)
posicionesCerradas.ts adapter
inversionesService.ts (servicio · NO se toca)
planesPensionesService.ts (servicio · NO se toca)
inversionesFiscalService.ts (servicio · NO se toca)
```

---

## 5 · Cambios de UX · resumen

### 5.1 · Galería

- **Card "Añadir posición" eliminada** · solo queda botón "Nueva posición" en page-head.
- **Filtros nuevos** · pills horizontales · Todas (6) · Planes pensiones (2) · Equity / fondos (2) · Renta fija (2) · Otros (0).
- **Tag por tipo en cada card** · PPI · PPE · PPES · PPA · Fondo · ETF · REIT · Acción · P2P · Préstamo · Depósito · Crypto · Otro. Estilo Mono uppercase pequeño · color según paleta (ver §6.4 mockup).
- **Sección "Posiciones cerradas" colapsable al pie** · sustituye al título "Histórico fiscal".
- **Cinta resumen arriba (CintaResumenInversiones)** · 4 KPIs · Valor total · Rentabilidad · Cobrado mes · Previsto año. Preservar.

### 5.2 · Selector "Nueva posición"

6 cards en grid · NO 12 · ordenadas en grupos visuales · Planes · Equity y fondos · Renta fija · Otros.

| Card | Acción |
|---|---|
| Plan de pensiones | Abre `AltaPlanWizard` con tipo neutro · el wizard pide tipo PPI/PPE/PPES/PPA dentro |
| Fondo de inversión | Abre `AltaFondoModal` |
| Acción / ETF / REIT | Abre `AltaAccionModal` con tipo elegible dentro |
| Préstamo | Abre `AltaPrestamoModal` con modalidad P2P/empresa elegible dentro |
| Depósito o cuenta | Abre `AltaDepositoModal` con tipo elegible dentro |
| Crypto u otros | Abre `AltaCryptoModal` con tipo elegible dentro |

Footer del selector · 2 hints discretos · "Indexa Capital · planes de pensiones" + "Aportaciones · CSV" (toast por ahora · cuelgan de importers existentes).

### 5.3 · Fichas · barra de acciones unificada

5 botones consistentes en todas las fichas · puede haber variaciones de copy según tipo:

```
[Actualizar valor]  [Aportar]  [Traspasar]  [Rescatar]   ───────  [Editar]
ghost              ghost      ghost        ghost rojo            gold
```

Variaciones por tipo:
- **Plan pensiones** · 5 botones completos.
- **Fondo** · 5 botones completos.
- **Acción/ETF/REIT** · `Aportar` → `Comprar más` · `Traspasar` desaparece · `Rescatar` → `Vender`.
- **Préstamo** · `Actualizar valor` desaparece · `Aportar` → `Ampliar` (opcional) · `Traspasar` desaparece · `Rescatar` → `Cancelar préstamo` · `Editar` queda.
- **Depósito** · solo `Editar` + `Cobrar al vencimiento` (sustituye `Rescatar`).
- **Crypto/otro** · 4 botones · sin `Traspasar`.

### 5.4 · Renombrado · "Histórico fiscal" → "Posiciones cerradas"

- Galería sección bottom · header `Posiciones cerradas` · subtítulo "activos que ya has vendido o liquidado".
- Página interna `/inversiones/cerradas` · h1 `Posiciones cerradas` · sub "activos que ya has vendido o liquidado · importados de tus declaraciones IRPF 2020-2024".
- Componente · `PosicionesCerradasPage` queda con ese nombre (ya es correcto).

---

## 6 · Patrón Modal ATLAS · detalle obligatorio

### 6.1 · CSS tokens (extraer al CSS módulo)

```css
.modal-atlas { max-width: 1020px; max-height: calc(100vh - 60px); border-radius: 14px; }
.modal-atlas.no-preview { max-width: 720px; }
.modal-atlas.narrow { max-width: 560px; }

.modal-atlas-hd { background: var(--brand-ink); color: #fff; padding: 18px 24px; }
.modal-atlas-hd-icon { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--gold); width: 42px; height: 42px; border-radius: 9px; }
.modal-atlas-hd-title { font-size: 17px; font-weight: 700; }
.modal-atlas-hd-sub { font-size: 12px; color: rgba(255,255,255,0.55); }

.modal-atlas-body { display: grid; grid-template-columns: 1fr 340px; }
.modal-atlas.no-preview .modal-atlas-body { grid-template-columns: 1fr; }
.modal-atlas-form { padding: 22px 26px; overflow-y: auto; }
.modal-atlas-preview { background: var(--card-alt); border-left: 1px solid var(--line-2); padding: 22px; }

.atlas-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-3); margin-bottom: 12px; }
.atlas-selector-h { display: grid; gap: 8px; }
.atlas-tab { padding: 14px 10px 12px; display: flex; flex-direction: column; align-items: center; gap: 7px; border: 1px solid var(--line); border-radius: 10px; }
.atlas-tab.active { background: var(--gold-wash); border: 1.5px solid var(--gold); }

.atlas-preview-card-dark { background: var(--brand-ink); color: #fff; border-radius: 10px; padding: 18px 20px; }
.atlas-preview-card-dark .val { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 700; }
.atlas-preview-card-dark .val.gold { color: #E8D9AE; }
.atlas-preview-card-dark .val.pos { color: #6FD48A; }
.atlas-preview-card-dark .val.neg { color: #F5A199; }
```

Ver mockup CSS completo `modal-atlas-*` (líneas ~350-540 del archivo).

### 6.2 · Preview en vivo · cómputo

Cada wizard con preview tiene **al menos un valor que cambia en vivo** según inputs del form:
- Alta plan · `limiteDeducible` cambia con tipo + check discapacidad. Ver §7.1.
- Alta préstamo · `cobrosNetosPrevistos` se recalcula al introducir capital + TIN + duración + retención.
- Alta depósito · `cobroVencimiento` recalcula con capital × (1 + TAE)^plazo × (1 - retención).
- Aportar · `ahorroEstimado` recalcula importe × marginal (45% por defecto · configurable en Personal).
- Vender plan · `netoPrevisto` recalcula importe × (1 - marginal) + reducción40%.

Los demás cuadros del preview son informativos (texto fijo · banners).

### 6.3 · Pre-rellenado de datos (cuando aplica)

- **Aportar** desde ficha · pre-rellena `posicionId` con el contexto actual.
- **Traspasar** desde ficha plan · pre-rellena origen · `valorPlan` con valor actual conocido.
- **Vender** desde ficha · pre-rellena `posicionId` · `valorActual`.
- **Editar** · pre-rellena TODOS los campos administrativos.
- **Actualizar valoración** desde ficha · pre-rellena `posicionId`.

---

## 7 · 8 issues pulido absorbidos · detalle

### 7.1 · Copy fiscal dinámico · 🔴 ALTA · YA HECHO EN MOCKUP

Wizard alta plan · preview panel derecha cambia con tipo + check discapacidad:

```
Si discapacidad ≥ 33% → 24.250 € · art. 52.1.c LIRPF
Si tipo = PPI → 1.500 € · art. 51.6 LIRPF · sin contribución empresa
Si tipo = PPA → 1.500 € · art. 51.6 LIRPF · sin contribución empresa
Si tipo = PPE → 10.000 € (1.500 € titular + 8.500 € empresa) · art. 51.7 LIRPF
Si tipo = PPES (autónomo) → 5.750 € (1.500 € + 4.250 € adicionales) · art. 51.8 LIRPF
```

CC implementa la función `calcularLimiteDeducible(tipo, hasDiscapacidad)` en el wizard. Ver función `refreshTipoPlanUI(tipo)` del mockup como referencia.

### 7.2 · `fechaContratacion` · 🟠 MEDIA

Wizard alta plan ya captura `fechaApertura` como campo required. Para planes legacy creados antes del fix · migración retro idempotente:

```typescript
// src/migrations/v71/backfillFechaContratacionPlanes.ts
// Flag: migration_v71_backfillFechaContratacionPlanes_v1
// Solo planes con fechaContratacion === null || undefined
// Si tiene aportaciones · fechaContratacion = fecha primera aportación
// Si no tiene aportaciones · fechaContratacion = createdAt del plan
```

Sin bump DB · solo escribe el campo si está vacío. Idempotente vía flag en `keyval` store.

### 7.3 · TWR "NaN%" / "-936.5%" · 🟡 BAJA

Función `calcularTWR(aportaciones, valorActual)` en `inversionesService` o helper:
- Si `aportaciones.length === 0` → return `null`.
- Si `total_aportado === 0` → return `null`.
- Si `Math.abs(twr) > 500` → return `null` (outlier · datos sospechosos).
- En UI · si `twr === null` → renderiza `—` en lugar de número.

Aplica a · ficha plan · ficha fondo · galería cards.

### 7.4 · Rentabilidad cabecera "-100,0% / -23.632€ latente" → "Sin valoración" · 🟡 BAJA

En `FichaHero` · si `valor_actual === 0 && total_aportado > 0` (plan sin valoración cargada) · NO mostrar % ni € · mostrar literal "Sin valoración" en gris `--ink-4` en el slot del KPI "Rentabilidad".

### 7.5 · Backfill notas aportaciones legacy · 🟡 BAJA

Aportaciones importadas vía XML AEAT antes de B6 pueden tener `notas: undefined` o vacío. Migración retro:

```typescript
// src/migrations/v71/backfillNotasAportaciones.ts
// Flag: migration_v71_backfillNotasAportaciones_v1
// Para cada aportación con fuente === 'xml' && (!notas || notas === '')
// Si plan PPI/PPA → notas = 'Importada desde IRPF · titular'
// Si plan PPE/PPES → notas = `Importada desde IRPF · empresa CIF ${planCif || 'desconocido'}`
```

### 7.6 · Primera aportación · agregado por ejercicio · 🟡 BAJA

En la sección "Trayectoria" de ficha plan (T13v4) · el campo "Primera aportación" debe agregarse por ejercicio · NO mostrar fecha individual de cada movimiento. Lógica:

```typescript
const primeraPorEjercicio = aportaciones
  .filter(a => a.tipo === 'aportacion')
  .reduce((acc, a) => {
    const y = a.ejercicioFiscal;
    if (!acc[y] || new Date(a.fecha) < new Date(acc[y])) acc[y] = a.fecha;
    return acc;
  }, {} as Record<number, string>);
```

Render · "primera aportación del ejercicio · DD/MM/YYYY" en cabecera de cada fila de año.

### 7.7 · Normalizar "ORANGE ESPAGNE SA" → "Orange España S.A.U." · ⚪ OPCIONAL

Migración retro por CIF (matchea por NIF empresa):

```typescript
// src/migrations/v71/normalizarNombresEmpresas.ts
// Flag: migration_v71_normalizarNombresEmpresas_v1
// Tabla mínima de mapeo:
const NOMBRES_NORMALIZADOS = {
  'A82009812': 'Orange España S.A.U.',
  // … futuras entradas
};
// Para cada plan con cif en la tabla · normalizar nombreEmpresa
```

### 7.8 · Aportes 3.259€ en Rentabilidad por bloque · ⚪ OPCIONAL

En ficha plan · sección "Rentabilidad por bloque" (gestora actual + gestoras previas si hubo traspasos) · añadir línea "Aportado en este bloque · X €" debajo del valor actual del bloque. Lectura · sumar aportaciones cuyo `traspasoOrigenId === null` (bloque inicial) o `traspasoDestinoId === bloqueActual.id` (bloques siguientes). Funcionalidad nice-to-have · si el modelo de bloques no está cerrado del todo · diferir.

---

## 8 · Datos · qué se lee · qué se escribe

### 8.1 · Stores leídos (sin escritura nueva)

| Store | Componente lector | Campos clave |
|---|---|---|
| `inversiones` | `GaleriaCard`, `FichaFondo`, etc. | tipo, nombre, entidad, valor_actual, total_aportado |
| `planesPensiones` | `FichaPlanPensiones`, galería | tipoAdministrativo, gestoraActual, valorActual |
| `aportacionesPlan` | Ficha plan trayectoria | planId, fecha, importe, ejercicioFiscal, tipo |
| `traspasosPlanPensiones` | Bloques en ficha plan | planOrigenId, planDestinoId, valorTraspaso |
| `ejercicioFiscalCoord` | Preview fiscal en modales · datos hogar | declaracionCompleta.planPensiones |
| `cuentas` | Selectores cuenta cargo/abono | id, alias, banco |
| `valoraciones_historicas` | Solo para sparkline si tipo='plan_pensiones' | activo_id, fecha, valor |

### 8.2 · Stores escritos (a través de servicios EXISTENTES · no se toca el servicio)

| Acción | Servicio invocado | Store afectado |
|---|---|---|
| Crear plan | `planesPensionesService.createPlan` | `planesPensiones` |
| Crear fondo/acción/préstamo/depósito/crypto | `inversionesService.createPosicion` | `inversiones` |
| Aportar a plan | `aportacionesPlanService.addAportacion` | `aportacionesPlan` |
| Aportar a otro tipo | `inversionesService.addAportacion` | `inversiones.aportaciones` (embebido) |
| Traspaso plan | `traspasosPlanPensionesService.registrarTraspaso` | `traspasosPlanPensiones` |
| Actualizar valoración plan | `valoracionesService.guardarValoracionActivo` con tipo plan_pensiones | `valoraciones_historicas` + `planesPensiones.valorActual` |
| Actualizar valoración otro | `inversionesService.updatePosicion` (cambia valor_actual) | `inversiones` |
| Editar plan | `planesPensionesService.updatePlan` | `planesPensiones` |
| Eliminar (soft) | `*Service.deletePosicion` (existente) | activo=false |

CC NO crea servicios nuevos · solo cambia las vistas que los invocan.

### 8.3 · 3 migraciones retro idempotentes (issues 7.2, 7.5, 7.7)

Las 3 viven en `src/migrations/v71/*.ts` y se ejecutan en `db.ts` justo antes del open (o en un `runMigrationsLazy` al cargar `/inversiones`). Flag por migración en `keyval` con valor `'completed' | 'in_progress' | 'failed'`.

CC NO bumpea DB_VERSION para estas migraciones · son backfills de datos existentes · no cambian schema.

---

## 9 · CSS · módulo y tokens

### 9.1 · Archivo

Nuevo módulo CSS · `src/modules/inversiones/styles/atlas-inversiones.module.css` · con todos los selectores `.modal-atlas-*`, `.atlas-tab`, `.atlas-preview-*`, `.tag-tipo`, etc. CC puede extraer directo del mockup (líneas ~350-540 para modales, ~870-950 para tags).

### 9.2 · Tokens · usar SIEMPRE los de v5

NO inventar variables. Lista completa autorizada en GUIA-DISENO-V5-atlas.md sección 2.1. Si CC necesita un color que no está · STOP y reportar a Jose.

Tabular nums obligatorio en cualquier número:

```css
.mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
```

### 9.3 · No hex hardcoded

Si CC encuentra durante la migración cualquier hex hardcoded · sustituir por var · documentar en comentario del PR.

---

## 10 · Entrega · 5 PRs secuenciales con stop-and-wait

C1 = una sola tarea exhaustiva = una sola spec = un solo ticket en GitHub Copilot Workspace. PERO la implementación se entrega en 5 PRs secuenciales · stop-and-wait obligatorio · Jose valida cada uno en producción Netlify antes de pasar al siguiente.

| PR | Alcance | Validación Jose |
|---|---|---|
| **PR 1 · Pre-flight + estructura** | Comentario auditoría §0 + creación archivos shell ModalAtlas / FichaShell / tokens CSS módulo + smoke tests | `/inversiones` carga igual que antes · 0 cambios visibles |
| **PR 2 · Galería + selector** | Galería rediseñada · filtros · tags por tipo · sección posiciones cerradas colapsable · SelectorNuevaPosicion 6 familias · botones page-head | Card "Añadir" desaparece · filtros funcionan · click en familia abre modal correcto · selector visualmente OK |
| **PR 3 · Modales de alta** | 6 modales alta · AltaPlanWizard · AltaFondoModal · AltaAccionModal · AltaPrestamoModal · AltaDepositoModal · AltaCryptoModal · todos con preview panel · estilo ATLAS unificado · sustituye PosicionFormV5/WizardNuevaPosicion. Aplicar issue 7.1 copy fiscal dinámico | Alta de un plan PPE de prueba → funciona end-to-end · 5 tipos cubiertos · preview en vivo cambia |
| **PR 4 · Modales de gestión** | 6 modales restantes · AportarModal · TraspasoModal · ActualizarValoracionModal · VenderModal · EditarPosicionModal · Sustituye AportacionFormDialog y ActualizarValorPlanDialog | Aportar 1.500 € a un plan PPI → registrado · preview ahorro = 675 € · 6 modales accesibles desde fichas |
| **PR 5 · Fichas tipadas + cleanup + migraciones** | 6 fichas tipadas (Plan preservando T13v4 · Fondo · Acción · Préstamo · Depósito · Genérica) · barra acciones unificada · renombrado "Histórico fiscal" → "Posiciones cerradas" · retirar archivos sustituidos (§4.3) · 3 migraciones retro (§7.2 · §7.5 · §7.7) · issues 7.3/7.4/7.6 aplicados · 7.8 si modelo de bloques permite | Ficha de cada tipo coherente · 2 secciones T13v4 intactas en plan-orange · 43 tests baseline rojos NO empeoran · build limpio sin warnings nuevos |

**Reglas inviolables entre PRs:**
1. CC NO abre PR N+1 sin OK explícito de Jose al PR N en Netlify deploy review.
2. Tests pre-existentes 43 baseline rojos · CC NO los toca · solo añade smoke tests nuevos.
3. Si un PR rompe algún test verde existente · revert y reportar.
4. Cada PR es revert-able sin tocar los anteriores.
5. CC NO retira componentes legacy hasta PR 5 · evita romper imports intermedios.

---

## 11 · Tests · smoke nuevos · baseline preservada

### 11.1 · Tests a añadir (por PR)

| PR | Test | Cobertura mínima |
|---|---|---|
| 1 | `ModalAtlas.test.tsx` | render shell · close al click backdrop · close al Escape |
| 1 | `FichaShell.test.tsx` | render hero + actionbar · sin crash |
| 2 | `GaleriaFiltros.test.tsx` | click en pill activa filtro · contador correcto |
| 2 | `SelectorNuevaPosicion.test.tsx` | render 6 cards · click cada una llama openModal correcto |
| 3 | `AltaPlanWizard.test.tsx` | render PPE por defecto · cambiar a PPI muestra art. 51.6 · check discapacidad muestra 24.250 |
| 3 | `AltaFondoModal.test.tsx` | render · preview muestra "Régimen art. 94" |
| 4 | `AportarModal.test.tsx` | importe 1.500 → preview ahorro 675 € con marginal 45% |
| 4 | `VenderModal.test.tsx` | preview FIFO con datos mock |
| 5 | `FichaPlanPensiones.test.tsx` | 2 secciones T13v4 siguen renderizando · datos correctos |
| 5 | `posicionesCerradas.test.tsx` | renombrado correcto · datos siguen llegando |

### 11.2 · Tests a NO TOCAR

Los 43 tests baseline en rojo pre-existentes · CC los deja exactamente como están. Si por motivo de refactor uno empieza a pasar · perfecto · pero NO se modifica el test. Si uno empieza a fallar nuevo · CC debe revertir el cambio responsable.

---

## 12 · Checklist obligatorio · sección 17 de GUIA-DISENO-V5-atlas.md

CC corre este checklist ANTES de marcar cada PR como ready-for-review. Si algo falla · NO se entrega.

### Tokens
- [ ] No hex hardcoded · todo vía variables
- [ ] Solo paleta Oxford Gold
- [ ] Inter + JetBrains Mono solo
- [ ] `font-variant-numeric: tabular-nums` en todo `.mono`

### Layout
- [ ] Sidebar 11 items orden canónico · solo `Inversiones` activo
- [ ] Topbar search + 2 icon-buttons
- [ ] Main padding 22px 32px 60px · max-width 1520px

### Page head
- [ ] H1 sin icono · "Inversiones"
- [ ] Sub con contexto · sin frase decorativa
- [ ] 2 botones max · `Aportar` ghost + `Nueva posición` gold

### KPIs strip (CintaResumenInversiones)
- [ ] `.kpi { display: flex; flex-direction: column; min-height: 92px; }`
- [ ] `.kpi-val { line-height: 1.15; }`
- [ ] `.kpi-sub { margin-top: auto; padding-top: 6px; }`

### Cards
- [ ] Border-top color por tipo (paleta)
- [ ] Estados visuales del set canónico
- [ ] `event.stopPropagation()` en botones internos de card clickable

### Iconos
- [ ] Lucide-react · 1 icono por concepto · stroke 1.7-2.5
- [ ] Sin icono junto al H1

### Texto
- [ ] Separador `·` siempre
- [ ] Cero emojis
- [ ] Color comunica · texto NO repite
- [ ] Sub en `--ink-4`

### Toast
- [ ] Función `showToast(msg)` definida y reusable
- [ ] Acciones que no navegan disparan toast

### Modales
- [ ] Header navy en TODOS los 12 modales
- [ ] Panel preview derecha SOLO cuando aplica · `no-preview` clase si no
- [ ] Footer con info izq + cancelar/gold derecha
- [ ] Selector horizontal con icono ARRIBA + label + sub centrados

### Issues pulido (B1)
- [ ] 7.1 copy fiscal dinámico funciona en wizard plan (PPI/PPE/PPES/PPA + discapacidad)
- [ ] 7.2 migración fechaContratacion ejecutada con flag idempotente
- [ ] 7.3 TWR NaN → `—` en UI
- [ ] 7.4 "-100%" en hero sin valoración → "Sin valoración"
- [ ] 7.5 backfill notas legacy ejecutado
- [ ] 7.6 "primera aportación" agregado por ejercicio
- [ ] 7.7 normalización CIF → nombre legal
- [ ] 7.8 aportes en rentabilidad por bloque (si modelo permite · opcional)

### Preservación T13 v4
- [ ] Las 2 secciones T13v4 siguen renderizando intactas en ficha plan
- [ ] `limitesFiscalesPlanesService.ts` NO se toca
- [ ] `aeatPlanesPensionesImportService.ts` NO se toca
- [ ] `planesInversionService.ts` wrapper NO se retira

### Cleanup
- [ ] 0 referencias a los 5 zombis (D4)
- [ ] Componentes sustituidos retirados solo en PR 5
- [ ] `grep -r` de cada archivo retirado = 0 hits antes del delete

---

## 13 · Riesgos identificados · mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| CC se salta el pre-flight §0 | Alta · pasó en T13v3 y T14v1 | Stop-and-wait obligatorio antes del primer PR de código · Jose NO da OK sin ver el comentario auditoría |
| Sustitución del wizard plan rompe T13v4 datos | Media | PR 3 explícitamente preserva la lógica · tests smoke obligatorios · validación Jose en Netlify |
| Modales nuevos rompen flujos de datos existentes | Media | NO se tocan servicios · solo se cambian las views que invocan. Servicios iguales · transacciones idénticas. |
| Tabular-nums olvidado | Baja | Checklist §12 obligatorio · revisión Jose visual |
| 3 migraciones retro crean inconsistencias | Media | Flags idempotentes por keyval · ejecución una sola vez · tests unitarios mínimos |
| Galería con muchos filtros se ralentiza | Baja | Filter es client-side sobre array < 100 items normalmente |
| Modal preview en vivo provoca re-renders | Baja | `useMemo` en cálculos pesados · debounce en inputs si se ve lag |

---

## 14 · Fuera de alcance · explícito

- Toda la rama "fondos como entidad de primera clase" · diferida a T13-bis.
- Régimen art. 94 LIRPF · diferido.
- Sparkline desde valoraciones reales mensuales · diferido.
- Importer Indexa Capital fondos · diferido.
- Borrado zombie `InversionesPage` horizon · backlog limpieza.
- Borrado wrapper `planesInversionService` · diferido (D2 de T13 v4).
- Modal Crypto · Modelo 721 con cálculo real · solo informativo en preview por ahora.
- Modal Acciones · dividendos cobrados como evento · queda en `FichaAccion` con sección informativa · NO se construye flujo de registro nuevo (lo hace `FichaDividendos` que se absorbe).
- Modificar `inversionesAportacionesImportService` · diferido (D6 de T13-bis).
- 5 issues 7.3/7.4/7.6 pueden quedar parcialmente en PR 5 · si CC encuentra que requieren más cambios que los descritos · STOP y reportar.

---

## 15 · Documentos relacionados · CC debe leerlos antes

1. **`atlas-inversiones-v3.html`** · mockup vinculante · referencia visual exhaustiva.
2. **`GUIA-DISENO-V5-atlas.md`** · paleta · tokens · checklist §17.
3. **Auditoría de pensiones+fondos previa** · `ATLAS-auditoria-pensiones-fondos-V1.md` (entregada por CC en sesión anterior) · contexto del trabajo T13v4.
4. **Auditoría de fondos** · `ATLAS-auditoria-fondos-V1.md` · contexto de lo que NO entra (T13-bis).
5. **HANDOFF V16** · estado tras cierre fiscal sub-4.

---

## 16 · Resumen ejecutivo para Jose · una pasada

- ✅ Rediseño completo módulo `/inversiones` siguiendo mockup atlas-inversiones-v3.html.
- ✅ Selector "Nueva posición" reducido a 6 familias.
- ✅ Card "Añadir posición" eliminada.
- ✅ "Histórico fiscal" → "Posiciones cerradas".
- ✅ Modales con header navy + panel preview en vivo (estilo ATLAS producción).
- ✅ Sustituye wizard plan T13v4 preservando 2 secciones nuevas + lógica fiscal.
- ✅ Absorbe los 8 issues pulido (BACKLOG T13v4 obsoleto tras esta tarea).
- ✅ 5 PRs secuenciales con stop-and-wait · validación Jose entre cada uno.
- ✅ 0 cambios DB · 0 cambios servicios · 0 cambios stores.
- ❌ Fondos como entidad · diferido a T13-bis.
- ❌ Art. 94 LIRPF · diferido.
- ❌ Valoraciones mensuales reales · diferido.

---

**Fin de spec.** CC arranca por el §0 pre-flight obligatorio. Una vez OK de Jose · PR 1.
