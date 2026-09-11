# AUDITORÍA · DESIGN SYSTEM · fijar UNA fuente de verdad y eliminar las divergentes

> Fecha · 2026-09-11 · Solo lectura · **NO se ha eliminado nada**.
> Mismo patrón que la auditoría del catálogo único: hay varias fuentes de estilo compitiendo, se fija LA vigente y se lista qué borrar con los greps que lo prueban.
> Reglas de oro aplicadas · A no migrar · B grepear antes de eliminar · C verificar contra código real · D cimientos bien.
> **Stop-and-wait** · este documento es la entrega. La eliminación va en tarea aparte con OK de Jose.

---

## 0 · Resumen en 8 líneas

1. **La fuente de verdad única es `src/design-system/v5/tokens.css`** (paleta Oxford Gold) con su documento normativo `docs/audit-inputs/GUIA-DISENO-V5-atlas.md`. Lo consumen 271 ficheros (10.209 líneas `--atlas-v5-*`), incluidas TODAS las pantallas reales: Tesorería V6/V9, Inversiones, Conciliación (dentro de Tesorería), Panel, Sidebar y Topbar.
2. **`design-bible/` es fósil**. Sus valores (`#042C5E`, `#28A745`, `#DC3545`, `#FFC107`) tienen **0 usos** en `src/`. Sus nombres (`--atlas-blue`, `--ok`, `--error`) sobreviven solo como alias en `src/index.css`, y ese alias ya apunta a la paleta V5. Nadie del código vivo lee `design-bible/`; solo lo enlaza una página rota (`DesignBiblePage.tsx`) y auditorías de 2024-2026-03.
3. **`src/index.css` y `tailwind.config.js` NO son fuentes de verdad rivales: son capa de compatibilidad** ya "repuntada" a V5. Se quedan (regla A · no migrar), pero se rotulan como alias y se les quitan sus 10 hex propios.
4. **CSS fósiles con 0 imports**: `treasury-v4.css`, `tax-view.css`, `ejercicio-selector.css`, `fiscal-tokens.css` (vacío). Se borran.
5. **Regla real de importes (Tesorería, vinculante)**: los números van **siempre en tinta**; el **oro** solo para la cifra-veredicto; el **ámbar** solo donde hay que actuar. **Verde/rojo nunca colorean un importe en Tesorería**; solo marcan estado (cuadre OK / descuadre / error de validación). Otros módulos (Panel, Inversiones, Personal) sí colorean deltas y rentabilidades por signo: hay que decidir si eso se mantiene (§3.4).
6. **No existe ningún "fondo amarillo"** en la paleta. El único ámbar de fondo es `--atlas-v5-warn-wash #F5ECD6`, reservado a bandas de aviso.
7. El "verde/rojo" de los mockups recientes viene de `docs/audit-inputs/atlas-tesoreria-v8.html` (48 usos de `--pos`, 31 de `--neg`), un mockup **superado** por `docs/mockups/atlas-tesoreria-v8-completo.html` (0 usos). Hay 8 mockups HTML con tokens fuera de paleta.
8. Deuda secundaria detectada (no bloquea): dos tipografías UI cargadas (Inter y IBM Plex Sans), `toastService.tsx` usa variables que **no existen** en ningún CSS, y `tokens.css` cita secciones de guía que no existen en la V5.

---

## 1 · Pregunta 1 · ¿Cuál es la fuente de verdad única y vigente?

**Respuesta: `src/design-system/v5/tokens.css`** (382 líneas, prefijo `--atlas-v5-*`), documentada por `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` (1.258 líneas).

### 1.1 · Evidencia de carga

| Evidencia | Fichero:línea |
|---|---|
| Se importa en el arranque de la app | `src/index.tsx:15` `import './design-system/v5/tokens.css'` |
| Se declara "única autorizada · cero hex fuera de este archivo" | `src/design-system/v5/tokens.css:1-5` |
| Cita a la guía como su fuente | `src/design-system/v5/tokens.css:4` (`GUIA-DISENO-V5-atlas.md §2.1-2.7`) |
| La guía declara nombres idénticos al código | `docs/audit-inputs/GUIA-DISENO-V5-atlas.md:62-66` |
| Barrel del DS · "punto único de entrada para los módulos productivos" | `src/design-system/v5/index.ts:1-10` |
| Handoff vigente la señala como guía a leer antes de cualquier UI | `docs/HANDOFF-V7-atlas.md:345`, `docs/HANDOFF-V8-atlas.md:298-299` |
| Programa T20 fija "paleta v5 (Oxford Gold)" como alcance de toda la UI | `docs/TAREA-20-migracion-mockups-ui-real.md:9,45` |

### 1.2 · Evidencia de consumo por las pantallas reales (imports verificados)

| Pantalla real | Ruta | Fichero que la sirve | Cómo consume V5 |
|---|---|---|---|
| Tesorería V6/V9 | `/tesoreria` (`src/App.tsx:905`, import `:128`) | `src/modules/tesoreria/v6/TesoreriaV6Page.tsx` | Hero: `import { Icons, KPI, KPIStrip, MoneyValue } from '../../../design-system/v5'` (`HeroTesoreria.tsx:15`). Todo el CSS de `v6/` usa `--atlas-v5-*`; **0 hex, 0 alias legacy** (grep §7.1) |
| Conciliación | `/conciliacion` → redirige a `/tesoreria?extracto=1` (`src/App.tsx:936`) | `src/modules/tesoreria/v6/conciliar/PanelConciliar.tsx`, `CuadreBanco.tsx` | CSS 100 % `--atlas-v5-*` (`PanelConciliar.module.css`, `CuadreBanco.module.css`) |
| Inversiones | `/inversiones` (`src/App.tsx:866`, import `:110`) | `src/modules/inversiones/InversionesGaleria.tsx` | `galeriaV5.module.css`, `fichaDetalleV5.module.css`, `CintaResumenInversiones.module.css` · tokens V5 |
| Panel | `/` (`src/App.tsx:703-710` → `src/pages/PanelPage.tsx:2`) | `src/modules/panel/PanelPage.tsx` | `HeroPatrimonio.module.css`, `ComoVaElMes.module.css` · tokens V5 · 0 hex |
| Sidebar + Topbar (todas las pantallas) | layout | `src/layouts/MainLayout.tsx:3-4` | `components/navigation/Sidebar.tsx` (27 usos V5, 0 legacy) · `design-system/v5/TopbarV5.tsx` (35 usos V5, 0 legacy) |

Recuento global: `grep -rl 'atlas-v5-' src` → **271 ficheros · 10.209 líneas**.

### 1.3 · Dónde vive la guía · aviso

La guía V5 está en `docs/audit-inputs/`, carpeta que su propio README describe como inputs de la "TAREA 6 · arquitectura de stores" (`docs/audit-inputs/README.md:1-9`). No es sitio para el documento normativo del design system. Propuesta post-OK: mover a `docs/GUIA-DISENO-V5-atlas.md` (solo cambio de ruta; actualizar `tokens.css:4` y los handoffs).

---

## 2 · Tabla de TODAS las fuentes de estilo

| # | Fuente | Tamaño | Estado | Quién la consume (evidencia) | Veredicto |
|---|---|---|---|---|---|
| A | `src/design-system/v5/tokens.css` | 382 líneas | **VIVA · única** | `src/index.tsx:15` · 271 ficheros | **Se queda. Fuente de verdad.** |
| B | `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` | 1.258 líneas | **VIVA · normativa de A** | `tokens.css:4`, `HANDOFF-V7:345`, `HANDOFF-V8:298`, `TAREA-20`, `TAREA-CC-TESORERIA-V5.md:275` | Se queda. Mover de carpeta (§1.3). Corregir deriva con tokens (§8.3) |
| C | `src/index.css` | 647 líneas | **VIVA · capa de alias v4→v5** | `src/index.tsx:14`. Define `--navy-*`, `--grey-*`, `--blue`, `--teal`, `--ok/--warn/--error`, `--hz-*`, `--atlas-blue`… **todos apuntando a `--atlas-v5-*`** (`index.css:13-36`, `:176-201`). 53 ficheros / 1.076 líneas la usan (pantallas legacy: `horizon/*`, `pulse/*`, `inbox`, importadores) | **Se queda como alias** (regla A). Rotular "NO es fuente de verdad". Quitar sus 10 hex propios (§7.2) |
| D | `tailwind.config.js` | 178 líneas | **VIVA · capa de alias** | Colores Tailwind (`navy`, `primary`, `success`, `error`, `gray`…) → `var(--atlas-v5-*)` (`tailwind.config.js:11-161`). 36 ficheros tsx / 545 líneas usan `bg-navy-N`, `text-gray-N`… | Se queda como alias. Repuntar `atlas-teal`/`brand-teal` `#1DA0BA` (`:15`, `:41`) a token |
| E | `src/styles/fiscal-tokens.css` | 1 línea (vacío) | **FÓSIL** | `src/index.tsx:1` lo importa; contenido: "intentionally empty" | **Borrar** + quitar import |
| F | `design-bible/` (15 ficheros) | 4.913 líneas | **FÓSIL como guía** | Nadie en `src/` (solo `DesignBiblePage.tsx`, rota). Docs raíz 2024-2026-03 (§6.2) | **Borrar** (salvo 3 docs fiscales · §6.1) |
| G | `src/pages/DesignBiblePage.tsx` + ruta | 1 página | **FÓSIL · apunta a la vieja** | `src/App.tsx:272` (lazy) · `:761-764` (ruta `design-bible`). Muestra "v3.0.0" (`:131`), abre `/design-bible/<sección>/README.md` (`:106`, `:316`) que **no existe en `public/`** → 404. Usa clases viejas `bg-atlas-blue`, `text-ok`, `atlas-btn-secondary` (`:117,130,135`) | **Borrar** página + ruta + lazy import |
| H | `src/components/treasury/treasury-v4.css` | 373 líneas | **FÓSIL** | 0 imports (grep `treasury-v4.css` en src → 0). Sus clases (`.btn-navy-primary`, `.badge-teal-mini`, `.btn-ghost-small`…) → 0 usos en tsx | **Borrar** |
| H' | `src/components/treasury/push-treasury-v3.sh` · `MovementStatusChip.tsx` · `src/__tests__/colorCodedMovementDisplay.test.tsx` | — | **FÓSIL** | Script de push v3 con token por argumento (`push-treasury-v3.sh:1-5`). `MovementStatusChip` solo lo importa el test, que fija el semáforo viejo (`bg-error-500` = rojo · `test.tsx:24`) | **Borrar** los tres |
| I | `src/components/tax/tax-view.css` | 277 líneas | **FÓSIL** | 0 imports. Clases (`.banner-devolver`, `.block-root`…) → 0 usos. 76 vars legacy, 0 V5 | **Borrar** |
| J | `src/components/fiscal/ejercicio-selector.css` | 79 líneas | **FÓSIL** | 0 imports. El componente `EjercicioSelector` ya no existe (`ls src/components/fiscal` → solo `RotuloReduccion`) | **Borrar** |
| K | `src/modules/horizon/conciliacion/v2/conciliacion-v2.css` | 971 líneas | VIVA · **no es la conciliación real** | Importado por `conciliacion/v2/components/AddMovementModal.tsx:16` y `src/pages/GestionInmuebles/tabs/sections/EjecucionesRecurrentesSection.tsx:19` (GestionInmuebles enrutado, `App.tsx:1231`). 204 usos V5 · 0 hex · 0 legacy | **No borrar.** Es conforme a V5. Es deuda de módulo (dos conciliaciones), fuera del alcance de estilo |
| L | `src/modules/mi-plan/pages/PresupuestoAnual.css` | 154 líneas | VIVA | `ProyeccionPage.tsx:21`. 62 usos V5 · 0 hex | No borrar. Convertir a `.module.css` cuando se toque |
| M | `src/components/common/EmptyState.css` | 148 líneas | VIVA · duplica DS | `components/common/EmptyState.tsx:29`. 10 usos V5. Duplica `design-system/v5/EmptyState` | No borrar ahora (regla A). Deuda menor |
| N | Alias locales `--bg/--ink/--pos…` en `WizardImportarDeclaracion.module.css:47-77` | bloque | VIVA · conforme | Alias "mockup → v5" dentro del módulo, todos → `--atlas-v5-*` | Se queda. Patrón correcto |
| O | Mockups HTML · `docs/mockups/` (15) + `docs/audit-inputs/` (23) | 38 ficheros | Mixto | 30 declaran los tokens V5 exactos. **8 declaran valores fuera de paleta** (§8.1) | Marcar los 8 como superados o corregir su `:root` |
| P | Docs raíz de auditoría 2024-2026-03 que citan guía V3/design-bible | 10 ficheros | FÓSIL documental | `AUDITORIA_CUMPLIMIENTO_GUIA_ESTILO_V3_2026-03-08.md:4` ("contra `design-bible/GUIA_DISENO_DEFINITIVA_V3.md`", fichero que ya no existe), `ATLAS_QUICK_REFERENCE.md:7-9` ("Última auditoría: Diciembre 2024"), `AUDITORIA_ATLAS_COMPLETA.md`, `AUDITORIA_UX_*.md`, `ATLAS_ACCESSIBILITY_*.md`, `INVESTOR_DASHBOARD_IMPLEMENTATION.md`, `GUIA_USO_SENCILLO.md`, `TRASPASO-LANZAMIENTO.md:66` | Archivar en `docs/archive/` o borrar (decisión Jose) |
| Q | Scripts v3 · `scripts/atlas-lint.js` (`npm run lint:atlas`, `build:atlas`), `scripts/migrate-to-atlas.js`, `scripts/migrate-buttons-to-atlas.js` (`migrate:atlas`, `migrate:buttons`) | 51 + 273 líneas + lint | **FÓSIL** | El lint exige IBM Plex (`atlas-lint.js:65-66`), prohíbe `#09182E` (`:44`) y remite a `/design-bible/` (`:461`). Los migradores reescriben Tailwind a `text-ok`, `text-error`, `text-atlas-blue` (`migrate-to-atlas.js:6-11`), es decir, a los nombres VIEJOS. No corren en CI (`.github/workflows` no los invoca) | **Borrar** los dos migradores y sus scripts npm. `atlas-lint.js`: borrar o reescribir contra V5 (decisión Jose) |

---

## 3 · Pregunta 2 · ¿Se usan el verde `--pos` y el rojo `--neg` en los importes?

### 3.1 · Lo que hace el componente del DS

`MoneyValue` colorea por signo **por defecto**: `tone = 'auto'` → negativo = `neg`, positivo = `pos` (`src/design-system/v5/MoneyValue.tsx:42, 51-58`; `MoneyValue.module.css:10-11`).

### 3.2 · Lo que hace Tesorería de verdad (la captura que vio Jose)

Tesorería V6/V9 **no usa ese default**. Evidencia:

| Qué | Fichero:línea |
|---|---|
| El único `MoneyValue` de Tesorería lleva `tone="ink"` (saldo grande del hero) | `src/modules/tesoreria/v6/HeroTesoreria.tsx:50` |
| Los demás importes se formatean con `importeSaldo` / `importeConSigno` (signo tipográfico `−`, sin color) | `src/modules/tesoreria/v6/formatoV6.ts:29-44` |
| …y se pintan con clases de tinta u oro: `.fuerte` (tinta) · `.oro` (oro) · `.mudo` (gris) | `ListaTarjetas.tsx:207,222,298` · `TablaBanco.module.css:104-113` |
| Cierre del mes = "cifra-veredicto" en oro | `HeroTesoreria.tsx:66` (`tone="gold"`) · `TesoreriaMovil.module.css:77-84` ("única cifra que no va en tinta") |
| Importes de movimientos en móvil: tinta | `TesoreriaMovil.module.css:184-190` (`.importe { color: var(--atlas-v5-ink) }`) |
| Neto del calendario en tinta "como todos los números: el color solo marca acción" | `DrawerCalendario.module.css:90` |
| Retraso de recibo = ámbar, "no rojo" | `DrawerCalendario.module.css:228` |
| Regla escrita en el CSS de la página | `TesoreriaV6Page.module.css:5-8` |
| Regla vinculante en la spec | `docs/TAREA-CC-TESORERIA-V5.md:157` ("**Los números nunca se colorean**") y `:269-271` |
| Override sobre navy: `gold-ink` se lee marrón → se remapea a `gold-2` | `HeroTesoreria.module.css:157-160` |

En Tesorería `--neg` y `--pos` aparecen **solo para estado**, nunca para importes:

- `--neg` → descuadre del extracto (`PanelConciliar.module.css:164-171`, comentario: "esto sí es una alerta, y `--neg` es exactamente para eso"), errores de validación de formulario (`FichaMovimiento.module.css:150-153`, `DrawerExtracto.module.css:92,240-243`).
- `--pos` → banco cuadra (`CuadreBanco.module.css:17-20`), icono de conciliado (`PanelConciliar.module.css:322,336-337`), icono de "nada pendiente" (`DrawerV6.module.css:199-200`).

Los únicos ficheros de Tesorería que colorean importes por signo son huérfanos: `tesoreria/components/MonthGrid.module.css:71-72` y `BankAccountCard.module.css:85-86` → **0 importadores** (grep `components/MonthGrid|components/BankAccountCard` → 0).

### 3.3 · Lo que hacen otros módulos (aquí está la duda)

Fuera de Tesorería sí se colorean cifras por signo:

| Módulo | Qué colorea | Fichero:línea |
|---|---|---|
| Panel | valor mensual `.mval.pos/.neg` (Cómo va el mes) | `src/modules/panel/components/ComoVaElMes.module.css:123-129` · `DetalleFlujoModal.module.css:47-51` |
| Inversiones | rentabilidad / ganancia-pérdida | `fichaDetalleV5.module.css:129-132` (sobre navy: `pos-bright` / `neg-wash`) y `:503-506` · `CintaResumenInversiones.module.css:97-101` |
| Personal | `tone="pos"` ×3 · `tone="neg"` ×4 · `tone="auto"` ×2 | `src/modules/personal/**` (grep `<MoneyValue`) |
| Mi Plan | `tone="auto"` ×3 | `src/modules/mi-plan/**` |
| Fiscal | `tone="auto"` ×2 · `tone="neg"` ×2 | `src/modules/fiscal/**` |
| Inmuebles | mayoritariamente `tone="ink"` (28) · 1 `tone={diffTone}` | `src/modules/inmuebles/**` |

### 3.4 · La REGLA REAL, documentada

**Regla vigente en el buque insignia (Tesorería), vinculante y coherente con las capturas:**

> Los importes van **siempre en tinta** (`--atlas-v5-ink`). El **oro** (`--atlas-v5-gold`, nunca `gold-ink` en cifras) se reserva a la cifra-veredicto (cierre, total). El **ámbar** (`--atlas-v5-warn`) aparece solo donde hay que actuar. **Verde y rojo no colorean importes**: marcan estado (cuadre OK, descuadre, error de validación, conciliado).

**Lo que la guía V5 §2.2 permite** (`GUIA-DISENO-V5-atlas.md:135-140`): `--pos` = "ingreso · ganancia · completado", `--neg` = "pérdida · alerta · fallado". Es decir, la guía **sí admite** verde/rojo para *ganancia/pérdida* (rentabilidad de Inversiones, delta del Panel), pero NO para saldos ni movimientos, que van en `--brand`/tinta (§2.2: "saldos" bajo `--brand`).

**Decisión que necesita Jose (dos opciones):**

- **Opción 1 (recomendada · cuesta menos y respeta lo construido):** dejar la regla en dos niveles y escribirla explícitamente en la guía §2.2: *importes y saldos en tinta/oro (regla Tesorería); verde/rojo únicamente para deltas de rentabilidad (Inversiones, Panel) y para estados*. Cambio de código necesario: que `MoneyValue` deje de colorear por defecto (`tone` por defecto `'ink'` en vez de `'auto'`, `MoneyValue.tsx:42`), para que un mockup nuevo no herede el semáforo sin pedirlo.
- **Opción 2 (más estricta):** verde/rojo nunca sobre un número, en ningún módulo. Implica repintar Panel, Inversiones, Personal, Mi Plan y Fiscal (líneas de §3.3). Es migración → regla A, tarea aparte.

### 3.5 · Fondo amarillo

No existe. Tokens con tinte cálido: `--atlas-v5-gold-wash #F3EAD6` (chips oro), `--atlas-v5-gold-wash-2 #FAF3E1` (hover de fila), `--atlas-v5-warn-wash #F5ECD6` (banda de aviso). Ninguno es amarillo ni sirve de fondo de card (`tokens.css:46-47, 91`). El "fondo amarillo" de los mockups fallidos no tiene token al que apuntar → es bug por definición (`GUIA V5:39`, regla 1).

---

## 4 · Acentos realmente permitidos y cuándo (§2.2 verificado contra uso real)

| Token | Guía §2.2 | Uso real verificado (fichero:línea) | Regla resultante |
|---|---|---|---|
| `--atlas-v5-brand` (navy) | identidad · seguridad · lectura · saldos | Hero navy Tesorería (`HeroTesoreria.module.css`), `Pill.brand` (`Pill.module.css:16-18`), `KPI tone="brand"` | Identidad, chips informativos, fondos hero de GESTIÓN |
| `--atlas-v5-gold` | pregunta-meta · acento principal · CTA | Cierre del mes `tone="gold"` (`HeroTesoreria.tsx:66`), `.oro` totales (`TablaBanco.module.css:110-113`), botón principal (`FichaMovimiento.module.css:231-237`), punto del kicker (`HeroTesoreria.module.css:79`) | La cifra-veredicto y la acción principal. **Nunca `gold-ink` en cifras** (`TesoreriaV6Page.module.css:7`) |
| `--atlas-v5-gold-soft` | secundario · planificación | Gradiente hero, bordes sutiles (`HeroTesoreria.module.css:34`, `DrawerExtracto.module.css:54`) | Variante suave, bordes |
| `--atlas-v5-pos` (verde) | ingreso · ganancia · completado | Cuadre OK (`CuadreBanco.module.css:17-20`), conciliado (`PanelConciliar.module.css:322`), rentabilidad positiva (`fichaDetalleV5.module.css:503`) | **Estado "completado/cuadra"** y ganancia (según decisión §3.4). Nunca "ingreso" en Tesorería |
| `--atlas-v5-neg` (rojo) | pérdida · alerta · fallado | Descuadre (`PanelConciliar.module.css:165-171`), error de validación (`FichaMovimiento.module.css:150-153`), pérdida (`fichaDetalleV5.module.css:506`) | **Alerta real y error**. Nunca "gasto" ni importe negativo en Tesorería |
| `--atlas-v5-warn` (ámbar) | riesgo · atención · parcial | Recibo retrasado "ámbar, no rojo" (`DrawerCalendario.module.css:228`), "N por confirmar" (`TesoreriaMovil.module.css:193-199`) | Todo lo que pide acción pero no es fallo |
| `*-wash` (brand/gold/pos/neg/warn) | fondos de chip | `Pill.module.css:16-38`, bandas de aviso (`DrawerCalendario.module.css:248,307`) | Solo fondos de chip/banda. No fondos de card (`GUIA V5:52` "No cards con saturated brand-wash") |
| Rampa `--atlas-v5-on-navy-1..7` | tinta sobre navy | Hero Tesorería, PanelConciliar (`:160`) | Datos informativos ≥ `on-navy-4`; 5-7 solo decoración (`GUIA V5:120-124`) |

**Excepciones aceptadas** (identidad, no semántica): colores de marca de banco (`tokens.css:98-109, 362-373`; guía §12.5 `:875-890`), color de punto de cuenta elegido por el usuario (`tokens.css:299-360`), púrpura cripto (`tokens.css:94-96`), colores de habitación (`:111-118`).

---

## 5 · Pregunta 4 · Hex hardcodeados fuera de `tokens.css` en pantallas vivas

Grep `#RRGGBB` en css/tsx/ts, excluyendo `tokens.css`, `bancoColores`, `entidadLogo` y tests:

| Zona | Resultado | Detalle |
|---|---|---|
| `src/modules/tesoreria/` | **0 hex** | Limpio |
| `src/modules/panel/` | **0 hex** | Limpio |
| `src/modules/horizon/conciliacion/` | **0 hex** | Limpio |
| `src/modules/inversiones/` | 3 + 3 + 26 | `helpers.ts:17-19` (`#5B8DB8 #1DA0BA #A8C4DE` = paleta de gráficos v4, igual a `index.css:73-75`) · `InversionesGaleria.module.css:162,172,182` (logos MyInvestor/BBVA/BNP; `#004481` ya existe como `--atlas-v5-brand-bbva` `tokens.css:105`) · `utils/entidadLogo.ts:44-165` (marcas · aceptadas por §12.5, pero duplican la lista de `tokens.css:362-373`) |
| `src/modules/inmuebles/` | 6 | `contratos/historico/PanelAnalitico.module.css:136-140` (rampa de mapa de calor `#EAF1EB #EFD9A8 #E8BE84 #DC9A7A #5C2718`) → **violación real**, no hay token |
| `src/design-system/v5/` | 4 | `useChartColors.ts:20-24` (fallback SSR que duplica `tokens.css:272-276`) → aceptable, pero mejor leer sin fallback |
| `src/index.css` | 10 | `:21-22` teal, `:37` white, `:72-77` paleta chart v4 (`#042C5E`…), `:85` focus ring rgba(4,44,94), `:382` box-shadow rgba(4,44,94) → **repuntar a tokens V5** |
| Pantallas legacy (no V5) | 22 + 8 + 6 + 4 + 2 | `financiacion/helpers.ts` (22), `horizon/proyeccion/base/components/ProjectionChart.tsx` (8), `utils/accountHelpers.ts` (6), `horizon/analisis-cartera/AnalisisCartera.tsx` (4), `horizon/fiscalidad/historico/ImportarDeclaracionWizard.tsx` (2) |
| Páginas dev | 38 | `pages/dev/KeyvalAudit.module.css` (21), `FiscalContextAudit.module.css` (17) · solo desarrollo |

Además: `InversionesGaleria.module.css:167` usa `--atlas-v5-pos` (semántico) como color de marca de SmartFlip. Debería ser token de marca, no de estado.

---

## 6 · Pregunta 3 · Qué ELIMINAR (con los greps que prueban 0 usos vivos)

### 6.1 · `design-bible/` completo · salvo 3 documentos que NO son de diseño

Greps ejecutados sobre `src/` (ts, tsx, css):

```
#28A745 (verde --ok viejo)      → 0 líneas / 0 ficheros
#DC3545 (rojo --error viejo)    → 0 líneas / 0 ficheros
#FFC107 (amarillo --warn viejo) → 0 líneas / 0 ficheros
#042C5E (--atlas-blue viejo)    → 4 líneas / 4 ficheros · todas en index.css (--c1 chart) y helpers legacy, NO como --atlas-blue
var(--atlas-blue                → 100 líneas / 12 ficheros · valor real = var(--atlas-v5-brand) vía index.css:176→40→13
var(--ok) / var(--error) / var(--warn) → 22 líneas · valor real = navy / gris / gris (index.css:189-191)
var(--atlas-teal                → 1 línea
var(--hz-                       → 144 líneas / 21 ficheros · valor real = V5 (index.css:192-199)
PULSE / HORIZON                 → 59 líneas · todas rutas de carpeta (`modules/horizon/`), comentarios "ATLAS HORIZON:" de importadores y la constante `PROY_HORIZONTE_AÑOS`. Ningún token ni componente
import ... design-bible         → 0 (solo DesignBiblePage.tsx construye la URL en :106 y :316)
```

Conclusión: **ningún valor** del design-bible vive en el código; solo sobreviven **nombres** como alias en `index.css`, ya apuntados a V5. El documento no lo consume nadie. `design-bible/README.md:7` enlaza además a `GUIA_DISENO_DEFINITIVA_V3.md`, fichero que **no existe** en el repo.

**Excepción · NO borrar sin mover antes** (rescate a `docs/`): `design-bible/foundations/SPEC-modelo-datos-fiscal-4-regimenes.md`, `design-bible/foundations/TAREA-CC-fase0-ejerciciosFiscales.md` (citado en `docs/audit-inputs/HANDOFF-V3-atlas.md`), `design-bible/foundations/modelo-fiscal-atlas.md`. Son documentos del modelo fiscal, no de diseño. `design-bible/atlas-dashboard-v4.jsx` lo cita `PLAN-dashboard-v4-implementacion.md` (plan viejo) → cae con el plan.

### 6.2 · Lista completa de borrado (post-OK)

| # | Qué | Prueba de 0 usos vivos |
|---|---|---|
| 1 | `design-bible/` (12 ficheros de diseño; los 3 fiscales se mueven a `docs/`) | §6.1 |
| 2 | `src/pages/DesignBiblePage.tsx` + `src/App.tsx:272` (lazy) + `src/App.tsx:761-764` (ruta) | Apunta a "v3.0.0" y a rutas 404. Ningún enlace de UI lleva a `/design-bible` (grep `design-bible` en `src/**/*.tsx` → solo la propia página y la ruta) |
| 3 | `src/components/treasury/treasury-v4.css` | grep `treasury-v4.css` en src → 0 imports; clases → 0 usos |
| 4 | `src/components/treasury/push-treasury-v3.sh` | script de push manual v3 · no lo invoca `package.json` |
| 5 | `src/components/treasury/MovementStatusChip.tsx` + `src/__tests__/colorCodedMovementDisplay.test.tsx` | El chip solo lo importa ese test (grep → 1 importador = el test). El test fija el semáforo rojo/verde v3 (`bg-error-500`) |
| 6 | `src/components/tax/tax-view.css` | 0 imports · clases 0 usos |
| 7 | `src/components/fiscal/ejercicio-selector.css` | 0 imports · componente inexistente |
| 8 | `src/styles/fiscal-tokens.css` + `src/index.tsx:1` | Fichero vacío por diseño |
| 9 | `scripts/migrate-to-atlas.js`, `scripts/migrate-buttons-to-atlas.js` + `package.json:68,72` | Reescriben hacia nombres v3 (`text-ok`, `text-error`, `text-atlas-blue`) · no corren en CI |
| 10 | `scripts/atlas-lint.js` + `package.json:65-66` (`lint:atlas`, `build:atlas`) | Exige IBM Plex y remite a `/design-bible/` (`:461`). No corre en CI. **Decisión Jose**: borrar o reescribir contra V5 (cero hex fuera de `tokens.css`) |
| 11 | Docs raíz fósiles (§2 fila P) · 10 ficheros | Citan guía V3 / design-bible / "Diciembre 2024". **Decisión Jose**: `docs/archive/` o borrar. `TRASPASO-LANZAMIENTO.md:66` solo necesita editar la cita |
| 12 | Mockups con tokens fuera de paleta (§8.1) · 8 ficheros HTML | Marcar como superados en su cabecera o corregir su `:root` a los valores de `tokens.css` |

### 6.3 · Lo que NO se borra y por qué

- `src/index.css` y `tailwind.config.js`: 53 + 36 ficheros de pantallas legacy dependen de ellos (`horizon/*`, `pulse/*`, `InboxPage`, `account/migracion`, importadores, `services/confirmationService.tsx`, `services/toastService.tsx`). Borrarlos es migrar → regla A. Se rotulan como **capa de compatibilidad** y se les quitan los hex propios (§5).
- `conciliacion-v2.css`, `PresupuestoAnual.css`, `EmptyState.css`: importados y conformes a V5.
- Los módulos `src/modules/horizon/` y `src/modules/pulse/` (enrutados: `App.tsx:217-219`, `:1304-1339`): la guía declara HORIZON/PULSE eliminados como *conceptos* de marca, pero son carpetas con código vivo. Fuera del alcance de estilo.

---

## 7 · Greps de verificación (reproducibles)

### 7.1 · Tesorería V6 es 100 % V5

```
grep -rnoE '#[0-9a-fA-F]{6}\b' src/modules/tesoreria/v6 --include=*.css --include=*.tsx  → 0
grep -rcE 'var\(--(navy|grey|blue|n-|hz-|atlas-blue)' src/modules/tesoreria/v6/*.css      → 0 en todos
grep -rn 'atlas-v5-pos' src/modules/tesoreria/v6 → 5 líneas · todas estado (CuadreBanco:18-20 · PanelConciliar:322,336-337 · DrawerV6:200)
grep -rn 'atlas-v5-neg' src/modules/tesoreria/v6 → 13 líneas · todas alerta/validación
```

### 7.2 · Hex propios de la capa de alias (a repuntar, no a borrar)

```
src/index.css:21  --teal-600: #1DA0BA;   → var(--atlas-v5-chart-accent)
src/index.css:22  --teal-100: #E6F7FA;   → sin token · decidir (solo badge-teal / btn-accent legacy)
src/index.css:37  --white: #FFFFFF;      → var(--atlas-v5-white)
src/index.css:72-77 --c1..--c6 (#042C5E #1DA0BA #5B8DB8 #A8C4DE #C8D0DC #303A4C) → var(--atlas-v5-c1..c6)
src/index.css:85  --focus-ring: rgba(4,44,94,.12) → var(--atlas-v5-focus-ring-neutral)
src/index.css:382 box-shadow rgba(4,44,94,.12)    → var(--atlas-v5-focus-ring-neutral)
tailwind.config.js:15,41 '#1DA0BA'       → 'var(--atlas-v5-chart-accent)'
```

### 7.3 · Variables usadas que NO existen en ningún CSS (bug real)

```
grep -rnE '^\s*--(hz-success|hz-warning|hz-error|hz-info|brand-navy|brand-teal)\s*:' src --include=*.css → 0 definiciones
src/services/toastService.tsx:20-25 las usa (var(--brand-navy), var(--hz-success), …)
```

Esos nombres existen solo como **colores Tailwind** (`tailwind.config.js:40-51`), no como variables CSS. El navegador descarta el valor → esos toasts salen sin color de borde/icono. Lo usan 2 ficheros. Arreglo trivial post-OK: apuntar a `--atlas-v5-*`.

---

## 8 · Hallazgos secundarios (no bloquean · para la tarea de limpieza)

### 8.1 · Mockups con tokens fuera de paleta

Unos 30 mockups declaran exactamente `--brand #1E2954 · --gold #B88A3E · --pos #1E6B3A · --neg #A43328 · --warn #8A6213 · --ink #141B2E · --bg #F5F4F1` (los de `tokens.css`). Estos 8 no:

```
docs/audit-inputs/atlas-tesoreria-v8.html   (--bg #F8F6F1 · 48 usos --pos · 31 --neg)  ← origen del "verde/rojo"
docs/audit-inputs/atlas-fiscal-v3.html
docs/mockups/atlas-tesoreria-v8-completo.html (--gold #c8a04a)
docs/mockups/atlas-bancos-grafico-v5.html
docs/mockups/atlas-wizard-cuenta-v3.html
docs/mockups/atlas-wizard-inmueble-v4.html
docs/mockups/atlas-wizard-nomina-v3.html
docs/mockups/atlas-wizard-prestamo-v2.html
```

Valores ajenos encontrados: `--gold #c8a04a` (×5), `#b08a3e`, `#C59A47`; `--bg #F8F6F1`, `#f5f1e8`; `--ink #0E1423`, `#1a2332`; `--pos #2d6855`; `--neg #a8423a`; `--warn #b67a2a`.

### 8.2 · Dos tipografías UI cargadas

- Guía §1 regla 3: "IBM Plex Sans (UI) + JetBrains Mono + Inter fallback" (`GUIA V5:41`).
- `tokens.css:160`: `--atlas-v5-font-ui: 'Inter'` (244 usos). Comentario `:8-15` dice que solo se self-hostean Inter y JetBrains.
- `src/index.tsx:2-3` carga además `@fontsource/ibm-plex-sans` y `ibm-plex-mono`; `index.css:131` define `--font-base: 'IBM Plex Sans'` y `:209-210` lo aplica a `html, body` (25 usos); `tailwind.config.js:164` `sans: ['IBM Plex Sans', 'Inter', …]`.
- Resultado: las pantallas V5 van en Inter y el resto en Plex. **Decisión Jose**: una sola fuente UI. (Recomendación: Inter, que es la que usan las pantallas reales y los 30 mockups conformes.)

### 8.3 · Deriva entre `tokens.css` y la guía V5

`tokens.css` cita secciones que no existen en `GUIA-DISENO-V5-atlas.md` (grep → 0): "§Z.2.1" (`:94`), "§10 · punto de cuenta" (`:299`), "§B.4" (`index.css:642`), "§5.1 charts" (`:268`; el §5 de la guía son tabs). Tokens presentes en `tokens.css` y ausentes de la guía §2.1: `gold-wash-2`, `gold-light`, `pos-bright`, `pos-border`, `pos-dark`, `navy-text-*`, `warn-border`, `cripto*`, `room-*`, `equity-*`, `cartera-*`, `chart-*`, `punto-*`, `bank-*`, `on-brand-*`. La guía va por detrás del código. Post-OK: actualizar §2.1 de la guía desde `tokens.css` (el código manda, como fija la propia guía en `:62-66`).

### 8.4 · Duplicados dentro de V5 (ya anotados en el propio fichero)

`tokens.css:66-67`: `on-navy-1` = `white`; `navy-text-2` / `navy-text-disabled` solapan con `on-navy-4` / `on-navy-7` · "pendiente de consolidar (A.2)". `tokens.css:102-109` (`brand-*`) y `:362-373` (`bank-*`) repiten Santander/Sabadell/BBVA/ING/CaixaBank/Unicaja.

---

## 9 · Plan para DESPUÉS del OK (tarea aparte · 1 PR · stop-and-wait)

1. Mover los 3 docs fiscales de `design-bible/foundations/` a `docs/`. Borrar `design-bible/`.
2. Borrar `DesignBiblePage.tsx`, su lazy import y su ruta.
3. Borrar `treasury-v4.css`, `push-treasury-v3.sh`, `MovementStatusChip.tsx` + su test, `tax-view.css`, `ejercicio-selector.css`, `fiscal-tokens.css` (+ import), los dos scripts `migrate-*` (+ scripts npm). `atlas-lint.js` según decisión.
4. Cabecera en `src/index.css` y `tailwind.config.js`: "CAPA DE COMPATIBILIDAD · no es fuente de verdad · todo apunta a `src/design-system/v5/tokens.css`". Repuntar los 10 hex (§7.2). Arreglar `toastService.tsx:20-25` (§7.3).
5. Mover `GUIA-DISENO-V5-atlas.md` a `docs/`; actualizar `tokens.css:4` y handoffs. Añadir en §2.2 la **regla de importes** (§3.4, opción elegida) y sincronizar §2.1 con `tokens.css` (§8.3).
6. `MoneyValue`: `tone` por defecto `'ink'` si se elige la opción 1 de §3.4.
7. Marcar los 8 mockups de §8.1 como superados (o corregir su `:root`).
8. Archivar/borrar los 10 docs raíz fósiles (§2 fila P) según decisión.
9. Verificación: `npm run build` + `npm test` + grep `design-bible` en `src/` → 0, grep `treasury-v4|tax-view|ejercicio-selector|fiscal-tokens` → 0.

Con eso queda **UNA** fuente (`src/design-system/v5/`), y el mockup de conciliación se rehace sobre ella sin dudas: tinta para números, oro para la cifra-veredicto, ámbar para acción, verde/rojo solo para cuadre/descuadre.
