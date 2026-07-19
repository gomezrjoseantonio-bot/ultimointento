# EL MURO · FASE B · tabla de mapeo

> **Estado** · propuesta · **STOP** · Jose valida antes de que se toque una línea de componente (spec B.5).
> **Alcance** · hex **sólido** en `.ts`/`.tsx`/`.module.css` de `pages`/`components`/`modules` · **excluye** `rgba()` (289, fase aparte), `tailwind.config.js` (114, fase final) y `src/pages/dev` (~40).
> **Medición** · 749 ocurrencias de hex sólido · **138 valores distintos** · ordenada por frecuencia (spec B.4).

## Cobertura (spec B.4)

| Corte | Ocurrencias | % del total |
|---|--:|--:|
| top **20** filas | 548 | **73%** |
| top **40** filas | 623 | **83%** |
| tabla entera (138) | 749 | 100% |

## Correcciones de la 2ª pasada (review Jose)

1. **`#059669`** reclasificado `d·entidad` → **`semantic · --pos`**. Es emerald de éxito (ImportValoracionesWizard); el "SmartFlip" del mockup era el verde-placeholder, no identidad.
2. **`#b88a3e`** reclasificado `d·entidad` → **`exacto · --atlas-v5-gold`** (es EXACTAMENTE el oro de marca; "Unihouser"/fallback eran el oro-placeholder).
3. **`#ffffff`** (195 occ) ya no es un solo `--white`: **contextual** → `--atlas-v5-card` (fondo tarjeta) · `--atlas-v5-on-navy-1` (texto sobre navy) · `--atlas-v5-white` (resto). Se separa por ocurrencia en FASE C.
4. **`#1a1a1a` / `#aab3c4`** movidos de `c·tw-gray` → **`b·casi`** (no son grises de Tailwind; la categoría ahora dice la verdad).
5. **InversionesGaleria** = **`identidad-cat` PENDIENTE** (no semántica). Ver auditoría abajo.

**Auditoría de las 24 filas `d·entidad`** (una a una · la categoría exenta no debe atraer polizones): **22 confirmadas** identidad de tercero identificable (bancos/brokers/crypto, verificado en `entidadLogo.ts`/`accountHelpers.ts`/`financiacion/helpers.ts` con nombre de entidad). **2 expulsadas** (`#b88a3e`, `#059669`, arriba). Los logos de entidad en `InversionesGaleria` (`#7c3aed` MyInvestor, `#004481` BBVA, `#00915a` BNP) siguen siendo identidad (se consolidan al catálogo).

**§11 de la guía**: define color por tipología SOLO para Objetivos/Fondos/Retos/Landing (todos con tokens de paleta). **NO** define colores por tipo de inversión → los 14 tags de `InversionesGaleria` (`--atlas-tag-{ppe,ppes,ppa,fondo,etf,reit,crypto}`) **no tienen destino** → diseño de paleta, **lo decides tú** (`identidad-cat` PENDIENTE, sin tocar).

## Decisiones de Jose aplicadas

1. **Azul info · NO familia nueva.** Lavados → `--brand-wash`, sólidos → `--brand`. En ATLAS el azul es la marca; un azul info aparte es el problema con otro nombre. (`#5b8db8`/`#a8c4de` **salieron** de aquí → son serie de gráfico v3, categoría `chart`.)
2. **Marcas de terceros · excepción, no 20 tokens.** Los ~24 colores de identidad se consolidan en `entidadLogo.ts` (retirándolos de `accountHelpers.ts` y `financiacion/helpers.ts`), y **ese único fichero se excluye de `hex_hardcoded`** con definición estrecha (solo identidad de terceros, solo ahí, registrado como recalibración). Es trabajo de FASE C; aquí van marcados categoría `d·entidad`.
3. **Teal fuera de la UI.** Teales de interfaz (`#00a7b5`, `#4ac8e0`, `#0d6868`, wash `#e6f7fa`/`#e0f7f9`) → `--brand`/`--brand-wash`. El `chart-accent` es aparte (ver reporte abajo).
4. **Consolidar vocabulario suelto.** `navy-text-2`/`navy-text-disabled` → niveles 4/7 de la rampa on-navy (FASE C). Verdes→`--pos`, rojos/rosas→`--neg`/`--neg-wash`, beiges→`--bg`/`--card-alt`, púrpuras→`--cripto`: **aprobado**.

## Reporte teal · `--atlas-v5-chart-accent` `#1DA0BA` (lo que pediste)

**Dónde se usa** (dos mundos distintos):
- **Infra de gráficos**: `useChartColors.ts` (`accent`), `ProjectionChart.tsx` (como `c3`, fallback `#1DA0BA`), `AnalisisCartera.tsx`, `src/index.css` (`--c2`, `--teal-600`).
- **UI (badges/acento)**: `CuentaWizard.module.css`, `InmueblePage.module.css`, `AutonomoWizard.tsx`, `EjecucionesRecurrentesSection.tsx` (vía `--teal-600`).

**¿Convive con `c1..c6` en el mismo gráfico?** **SÍ.** En `AnalisisCartera.tsx:83` el dataset es `['#042C5E', '#5B8DB8', '#1DA0BA', '#A8C4DE']` — el teal es una **serie de datos** junto a los otros. Por tanto **no puede ir a `--gold`** (colisionaría con `--atlas-v5-c2` de v5, que es oro), como advertiste.

**Propuesta (no la ejecuto sin tu OK):** separar los dos usos —
- los **teales de UI** ya van a `--brand`/`--brand-wash` (decisión 3, en la tabla);
- el **teal de gráfico** (chart-accent + serie en ProjectionChart/AnalisisCartera + `src/index.css --c1..c6`/`--teal`) **queda fuera de esta campaña**: es reconciliación de la **paleta de gráficos v3 (`src/index.css`) vs los tokens chart v5 (`tokens.css --atlas-v5-c1..c6`, que son OTROS colores)**, un frente propio. Lo marco `teal/chart` y NO lo toco en FASE C hasta que decidas ese frente.

> **Aviso clave (review Copilot):** `src/index.css --c1..c6` (navy/teal/azules/gris) y `tokens.css --atlas-v5-c1..c6` (brand/gold/**pos**/**warn**/gold-soft/ink-3) son **paletas distintas con el mismo nombre**. Por eso las series de gráfico v3 (`#5b8db8`, `#a8c4de`) **no** mapean a `--atlas-v5-cN` — quedan `PENDIENTE` al frente de gráficos.

## Puntos que llevo a la tabla como PROPUESTA (no decido solo · spec)

- **Infra de gráfico** (`chart-ink #0E2A47`, `chart-axis #6C757D`, `chart-border #C8D0DC`): reutilizan grises legacy. `#6c757d` (39 occ) en **UI** → `--ink-3`; el token `chart-axis` que reusa ese valor se reconcilia en el frente de gráficos. Marcado con nota.
- **`#042c5e` / `#c8d0dc` · contextuales**: en UI → `--brand`/`--ink-5`; en gráfico → `#042c5e` queda `PENDIENTE` (frente gráficos v3) y `#c8d0dc` → token EXACTO `--atlas-v5-chart-border`. La tanda por fichero aplica el correcto (los ficheros de gráfico están señalados).
- **`oro/ámbar`** (`a·gold`): `--gold` si es acento, `--warn` si transmite estado. Se decide por fichero en FASE C (categoría, no valor).
- **`InversionesGaleria` · 14 tags de tipología** (`--atlas-tag-*`): **RESUELTO** como `identidad-cat` PENDIENTE (decisión 5) · §11 no los define → esperan tu diseño de paleta · NO se tocan en FASE C.

## Plan de tandas propuesto (FASE C · por densidad de fichero · spec C.1)

72 ficheros, 749 hex sólido. Los 20 primeros cubren **72%**. Orden propuesto (un commit por tanda, CI verde antes de seguir):

| # | Fichero | Occ | Acum% | Notas para preview (C.2) |
|--:|---|--:|--:|---|
| 1 | `components/treasury/treasury-reconciliation.css` | 140 | 19% | pantalla `/tesoreria` conciliación · muchos grises tw + info-azul |
| 2 | `pages/GestionPersonal/wizards/AutonomoWizard.tsx` | 59 | 27% | wizard autónomo · teal UI → brand · contraste badges |
| 3 | `pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx` | 43 | 32% | wizard ingresos |
| 4 | `components/treasury/TreasuryReconciliationView.tsx` | 26 | 36% | idem tesorería |
| 5 | `modules/inversiones/utils/entidadLogo.ts` | 26 | 39% | **catálogo entidades** · consolidar aquí + excluir de hex_hardcoded (decisión 2) |
| 6 | `src/index.css` | 24 | 42% | **contiene la paleta chart v3 `--c1..c6`/`--teal`** · tocar con cuidado (frente gráficos) |
| 7 | `modules/financiacion/wizards/PrestamoPageV2.module.css` | 24 | 46% | wizard préstamo · gold/beige/rojo |
| 8 | `pages/GestionPersonal/wizards/NominaPage.module.css` | 24 | 49% | wizard nómina |
| 9 | `modules/financiacion/helpers.ts` | 22 | 52% | colores banco → migrar a catálogo entidades (decisión 2) |
| 10 | `modules/inversiones/InversionesGaleria.module.css` | 19 | 54% | cluster categorías inversión (ver punto abierto) |
| … | (62 ficheros restantes) | 356 | →100% | cola larga · 1-15 occ/fichero |

**Recomendación de arranque**: tanda 1 = `treasury-reconciliation.css` (140→0, un fichero, 19% del muro, sin contexto de gráfico → mapeo limpio a·legacy/c·tw-gray/UI-info). Es el mejor primer commit para fijar el patrón y la verificación visual.

---

## Tabla de mapeo completa (138 valores · por frecuencia)

Categorías: `exacto` (ya es token · swap literal→var) · `exacto·ctx` (`#ffffff` · separar por contexto) · `a·legacy` (deriva v3/v4 → snap) · `c·tw-gray` (gris Tailwind → snap) · `b·casi`/`b·beige` (casi-idéntico · snap) · `d·entidad` (catálogo excepción · 22 valores) · `identidad-cat` (tipología inversión · PENDIENTE Jose) · `UI-info`/`UI-teal` (decisiones 1 y 3) · `semantic` (pos/neg/cripto) · `chart`/`chart/UI`/`teal/chart` (frente de gráficos · PENDIENTE).

| # | Valor | Occ | Cat | Destino | Justificación | Ficheros (muestra) |
|--:|---|--:|---|---|---|---|
| 1 | `#ffffff` | 195 | exacto·ctx | `var(--atlas-v5-card) [fondo tarjeta] · var(--atlas-v5-on-navy-1) [texto sobre navy] · var(--atlas-v5-white) [resto]` | blanco · SEPARAR por contexto en FASE C · un --white genérico no es cambiable (corrección 3) | components/shared/PageHeader.tsx · components/treasury/TreasuryReconciliationView.tsx +49 |
| 2 | `#042c5e` | 74 | chart/UI | `var(--atlas-v5-brand) [UI] · PENDIENTE frente-gráficos [chart]` | v3 --c1 · en UI → brand · en gráfico (src/index.css --c1) queda al frente gráficos v3↔v5 | components/shared/PageHeader.tsx · components/treasury/TreasuryReconciliationView.tsx +17 |
| 3 | `#6c757d` | 39 | a·legacy | `var(--atlas-v5-ink-3)` | deriva design-bible v3/v4 (spec B.3) · nota: --atlas-v5-chart-axis reusa este valor (reconciliar infra-chart) | components/shared/PageHeader.tsx · components/treasury/TreasuryReconciliationView.tsx +16 |
| 4 | `#dde3ec` | 31 | a·legacy | `var(--atlas-v5-line)` | deriva design-bible v3/v4 (spec B.3) | components/shared/PageHeader.tsx · components/treasury/TreasuryReconciliationView.tsx +14 |
| 5 | `#303a4c` | 25 | a·legacy | `var(--atlas-v5-ink-2)` | deriva design-bible v3/v4 (spec B.3) | components/shared/PageHeader.tsx · components/treasury/TreasuryReconciliationView.tsx +15 |
| 6 | `#c8d0dc` | 21 | chart/UI | `var(--atlas-v5-chart-border) [chart] · var(--atlas-v5-ink-5) [UI]` | v3 --c5 · en gráfico → token EXACTO chart-border (#C8D0DC) · en UI (borde) → ink-5 | components/shared/PageHeader.tsx · design-system/v5/useChartColors.ts +14 |
| 7 | `#1a2332` | 19 | a·legacy | `var(--atlas-v5-ink)` | deriva design-bible v3/v4 (spec B.3) | components/shared/PageHeader.tsx · components/treasury/TreasuryReconciliationView.tsx +12 |
| 8 | `#f3f4f6` | 16 | c·tw-gray | `var(--atlas-v5-line-3)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css |
| 9 | `#9ca3af` | 16 | c·tw-gray | `var(--atlas-v5-ink-4)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css · index.css +4 |
| 10 | `#eef1f5` | 16 | a·legacy | `var(--atlas-v5-line-2)` | deriva design-bible v3/v4 (spec B.3) | components/treasury/treasury-reconciliation.css · index.css +8 |
| 11 | `#f9fafb` | 15 | c·tw-gray | `var(--atlas-v5-card-alt)` | gris de Tailwind (spec B.3) | components/inbox/EditDocumentMetadataModal.tsx · components/treasury/treasury-reconciliation.css +6 |
| 12 | `#f8f9fa` | 14 | a·legacy | `var(--atlas-v5-bg)` | deriva design-bible v3/v4 (spec B.3) | components/treasury/treasury-reconciliation.css · index.css +11 |
| 13 | `#6b7280` | 12 | c·tw-gray | `var(--atlas-v5-ink-3)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css · modules/financiacion/wizards/PrestamoPageV2.module.css +2 |
| 14 | `#1da0ba` | 11 | teal/chart | `PENDIENTE · frente-gráficos (reporte teal)` | v3 --c2/--teal-600 · chart-accent vivo · UI badge → brand · en gráfico convive con serie (AnalisisCartera) · NO forzar a --atlas-v5-c2 (=oro) | design-system/v5/useChartColors.ts · index.css +7 |
| 15 | `#e5e7eb` | 9 | c·tw-gray | `var(--atlas-v5-line)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css · components/valoraciones/ImportValoracionesWizard.tsx |
| 16 | `#00a7b5` | 9 | UI-teal | `var(--atlas-v5-brand)` | teal de UI · resto identidad v3 → brand (decisión Jose 3) | pages/GestionInmuebles/GestionInmueblesList.tsx · pages/GestionInmuebles/tabs/FacturaSelectorModal.tsx +4 |
| 17 | `#ebf3ff` | 9 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | pages/account/migracion/ImportarAportaciones.tsx · pages/account/migracion/ImportarIndexaCapital.tsx +1 |
| 18 | `#d1d5db` | 6 | c·tw-gray | `var(--atlas-v5-ink-5)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css · components/valoraciones/ImportValoracionesWizard.tsx |
| 19 | `#e8eff7` | 6 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | components/treasury/treasury-reconciliation.css · index.css +1 |
| 20 | `#374151` | 5 | c·tw-gray | `var(--atlas-v5-ink-2)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css |
| 21 | `#1f2937` | 5 | c·tw-gray | `var(--atlas-v5-ink)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css |
| 22 | `#b45309` | 5 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | components/valoraciones/ImportValoracionesWizard.tsx · modules/horizon/conciliacion/v2/components/AddMovementModal.tsx |
| 23 | `#4ac8e0` | 5 | UI-teal | `var(--atlas-v5-brand)` | teal de UI · resto identidad v3 → brand (decisión Jose 3) | pages/GestionPersonal/wizards/AutonomoWizard.tsx · pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx |
| 24 | `#ec0000` | 4 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | components/treasury/MesDetalleDrawer.tsx · modules/financiacion/helpers.ts +2 |
| 25 | `#4b5563` | 4 | c·tw-gray | `var(--atlas-v5-ink-2)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css · modules/horizon/conciliacion/v2/conciliacion-v2.css +1 |
| 26 | `#e6f7fa` | 4 | teal-wash | `var(--atlas-v5-brand-wash)` | v3 --teal-100 · lavado teal · UI → brand-wash | index.css · modules/horizon/conciliacion/v2/conciliacion-v2.css +2 |
| 27 | `#5b8db8` | 4 | chart | `PENDIENTE · frente-gráficos (v3 --c3 · src/index.css)` | serie azul · OJO: --atlas-v5-c3 = pos (verde) ≠ este azul · NO mapear a c-token v5 | index.css · modules/horizon/analisis-cartera/AnalisisCartera.tsx +2 |
| 28 | `#004481` | 4 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts · modules/inversiones/InversionesGaleria.module.css +2 |
| 29 | `#f5f1e8` | 4 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 30 | `#fdf4dc` | 4 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 31 | `#0a1f3d` | 4 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 32 | `#b91c1c` | 4 | semantic | `var(--atlas-v5-neg)` | rojo → neg (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · modules/financiacion/wizards/PrestamoPageV2.tsx +2 |
| 33 | `#111827` | 3 | c·tw-gray | `var(--atlas-v5-ink)` | gris de Tailwind (spec B.3) | components/treasury/treasury-reconciliation.css |
| 34 | `#059669` | 3 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | components/valoraciones/ImportValoracionesWizard.tsx · modules/inversiones/InversionesGaleria.module.css +1 |
| 35 | `#f0f4fa` | 3 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | index.css · modules/horizon/conciliacion/v2/conciliacion-v2.css +1 |
| 36 | `#a8c4de` | 3 | chart | `PENDIENTE · frente-gráficos (v3 --c4 · src/index.css)` | serie azul claro · OJO: --atlas-v5-c4 = warn (ámbar) ≠ este azul · NO mapear a c-token v5 | index.css · modules/horizon/analisis-cartera/AnalisisCartera.tsx +1 |
| 37 | `#b88a3e` | 3 | exacto | `var(--atlas-v5-gold)` | es EXACTAMENTE --atlas-v5-gold · usos "entidad" (Unihouser/fallback) son el oro-placeholder, no identidad (corrección 2) | modules/financiacion/helpers.ts · modules/inversiones/InversionesGaleria.module.css +1 |
| 38 | `#faf8f3` | 3 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · modules/onboarding/empezar/empezar.module.css +1 |
| 39 | `#ff8e83` | 3 | semantic | `var(--atlas-v5-neg-wash)` | rojo/rosa lavado → neg-wash (aprobado) | modules/tesoreria/TesoreriaPage.module.css · modules/tesoreria/pages/VistaCuentaPage.module.css |
| 40 | `#f8fafc` | 3 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | pages/GestionPersonal/wizards/AutonomoWizard.tsx · pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx |
| 41 | `#ef4444` | 3 | a·legacy | `var(--atlas-v5-neg)` | deriva design-bible v3/v4 (spec B.3) | pages/account/migracion/ImportarAportaciones.tsx · pages/account/migracion/ImportarIndexaCapital.tsx |
| 42 | `#063672` | 2 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | components/treasury/treasury-reconciliation.css |
| 43 | `#0e2a47` | 2 | exacto | `var(--atlas-v5-chart-ink)` | ya es token --atlas-v5-chart-ink · swap literal→var | design-system/v5/useChartColors.ts · modules/inversiones/helpers.ts |
| 44 | `#0a3a72` | 2 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | index.css · modules/horizon/conciliacion/v2/conciliacion-v2.css |
| 45 | `#ff6200` | 2 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts · modules/inversiones/utils/entidadLogo.ts |
| 46 | `#f0ebde` | 2 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 47 | `#14294f` | 2 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 48 | `#1a1a1a` | 2 | b·casi | `var(--atlas-v5-ink)` | casi-idéntico a un token (NO es gris de Tailwind · corrección 4) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 49 | `#aab3c4` | 2 | b·casi | `var(--atlas-v5-ink-5)` | casi-idéntico a un token (NO es gris de Tailwind · corrección 4) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 50 | `#c8a04a` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 51 | `#e0c479` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 52 | `#0d6868` | 2 | UI-teal | `var(--atlas-v5-brand)` | teal de UI · resto identidad v3 → brand (decisión Jose 3) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 53 | `#fef4e0` | 2 | semantic | `var(--atlas-v5-neg-wash)` | rojo/rosa lavado → neg-wash (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 54 | `#8a5a00` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 55 | `#f5d99e` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 56 | `#e5dfd0` | 2 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 57 | `#d4cdb8` | 2 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 58 | `#f0b3ad` | 2 | semantic | `var(--atlas-v5-neg-wash)` | rojo/rosa lavado → neg-wash (aprobado) | modules/financiacion/wizards/PrestamoPageV2.module.css · pages/GestionPersonal/wizards/NominaPage.module.css |
| 59 | `#7c3aed` | 2 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/InversionesGaleria.module.css · modules/inversiones/utils/entidadLogo.ts |
| 60 | `#00915a` | 2 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/InversionesGaleria.module.css · modules/inversiones/utils/entidadLogo.ts |
| 61 | `#b07e2a` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/inversiones/pages/FichaPlanPensiones.tsx |
| 62 | `#f5a199` | 2 | semantic | `var(--atlas-v5-neg-wash)` | rojo/rosa lavado → neg-wash (aprobado) | modules/inversiones/styles/atlas-inversiones.module.css |
| 63 | `#f5a623` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/tesoreria/tabs/MovimientosTab.module.css |
| 64 | `#e6a000` | 2 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/tesoreria/tabs/MovimientosTab.module.css |
| 65 | `#e0f7f9` | 2 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | pages/GestionInmuebles/tabs/LineasAnualesTab.tsx · pages/GestionInmuebles/venta/wizardStyles.ts |
| 66 | `#4a5568` | 2 | c·tw-gray | `var(--atlas-v5-ink-2)` | gris/tinta neutra | pages/GestionPersonal/wizards/AutonomoWizard.tsx · pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx |
| 67 | `#16a34a` | 2 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | pages/account/migracion/ImportarAportaciones.tsx |
| 68 | `#024ea5` | 1 | exacto | `var(--atlas-v5-brand-sabadell)` | ya es token --atlas-v5-brand-sabadell · swap literal→var | components/treasury/MesDetalleDrawer.tsx |
| 69 | `#009639` | 1 | exacto | `var(--atlas-v5-brand-unicaja)` | ya es token --atlas-v5-brand-unicaja · swap literal→var | components/treasury/MesDetalleDrawer.tsx |
| 70 | `#6e5bc7` | 1 | exacto | `var(--atlas-v5-cripto)` | ya es token --atlas-v5-cripto · swap literal→var | components/treasury/MesDetalleDrawer.tsx |
| 71 | `#072146` | 1 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | components/treasury/MesDetalleDrawer.tsx |
| 72 | `#0f0f0f` | 1 | c·tw-gray | `var(--atlas-v5-ink)` | gris/tinta neutra | components/treasury/MesDetalleDrawer.tsx |
| 73 | `#fefce8` | 1 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | components/treasury/treasury-reconciliation.css |
| 74 | `#fafbfc` | 1 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | components/treasury/treasury-reconciliation.css |
| 75 | `#eff6ff` | 1 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | components/treasury/treasury-reconciliation.css |
| 76 | `#1d4ed8` | 1 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | components/treasury/treasury-reconciliation.css |
| 77 | `#f0f7ff` | 1 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | components/treasury/treasury-reconciliation.css |
| 78 | `#e5f0ff` | 1 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | components/treasury/treasury-reconciliation.css |
| 79 | `#f0fdf4` | 1 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | components/treasury/treasury-reconciliation.css |
| 80 | `#eef2ff` | 1 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | components/valoraciones/ImportValoracionesWizard.tsx |
| 81 | `#fef3c7` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | components/valoraciones/ImportValoracionesWizard.tsx |
| 82 | `#142c50` | 1 | a·legacy | `var(--atlas-v5-brand)` | deriva design-bible v3/v4 (spec B.3) | index.css |
| 83 | `#1e3a5f` | 1 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | index.css |
| 84 | `#0f4fa0` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 85 | `#0e4f8c` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 86 | `#00509d` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 87 | `#ff6900` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 88 | `#003b71` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 89 | `#005eab` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 90 | `#e2231a` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/financiacion/helpers.ts |
| 91 | `#e0f2fe` | 1 | UI-info | `var(--atlas-v5-brand-wash)` | azul info · en ATLAS el azul es la marca (decisión Jose 1) | modules/horizon/fiscalidad/historico/ImportarDeclaracionWizard.tsx |
| 92 | `#0369a1` | 1 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | modules/horizon/fiscalidad/historico/ImportarDeclaracionWizard.tsx |
| 93 | `#031f47` | 1 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx |
| 94 | `#5b6474` | 1 | exacto | `var(--atlas-v5-ink-3)` | ya es token --atlas-v5-ink-3 · swap literal→var | modules/inmuebles/components/contratos/historico/DrawerExContrato.module.css |
| 95 | `#2c3547` | 1 | exacto | `var(--atlas-v5-ink-2)` | ya es token --atlas-v5-ink-2 · swap literal→var | modules/inmuebles/components/contratos/historico/DrawerExContrato.module.css |
| 96 | `#eaf1eb` | 1 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | modules/inmuebles/components/contratos/historico/PanelAnalitico.module.css |
| 97 | `#f3ead6` | 1 | exacto | `var(--atlas-v5-gold-wash)` | ya es token --atlas-v5-gold-wash · swap literal→var | modules/inmuebles/components/contratos/historico/PanelAnalitico.module.css |
| 98 | `#efd9a8` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/inmuebles/components/contratos/historico/PanelAnalitico.module.css |
| 99 | `#e8be84` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/inmuebles/components/contratos/historico/PanelAnalitico.module.css |
| 100 | `#dc9a7a` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/inmuebles/components/contratos/historico/PanelAnalitico.module.css |
| 101 | `#5c2718` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/inmuebles/components/contratos/historico/PanelAnalitico.module.css |
| 102 | `#dce7f5` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 103 | `#1f4e8b` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 104 | `#e0e8e0` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 105 | `#2d5b3a` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 106 | `#f0e4e0` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 107 | `#8b5c42` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 108 | `#eee3f5` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 109 | `#6b3fae` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 110 | `#e8f0f5` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 111 | `#2c6a8e` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 112 | `#f5e8e0` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 113 | `#8b4a1f` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 114 | `#f5e0e8` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 115 | `#9e2a5f` | 1 | identidad-cat | `PENDIENTE · decide Jose` | tag de tipología de inversión (InversionesGaleria) · §11 NO lo define · identidad, NO semántica · no mapear a pos/neg/cripto | modules/inversiones/InversionesGaleria.module.css |
| 116 | `#1f7a4d` | 1 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | modules/inversiones/pages/FichaPlanPensiones.tsx |
| 117 | `#b23a48` | 1 | semantic | `var(--atlas-v5-neg)` | rojo → neg (aprobado) | modules/inversiones/pages/FichaPlanPensiones.tsx |
| 118 | `#4a3a00` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/inversiones/pages/FichaPosicion.module.css |
| 119 | `#007faa` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/utils/entidadLogo.ts |
| 120 | `#00497a` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/utils/entidadLogo.ts |
| 121 | `#007f3d` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/utils/entidadLogo.ts |
| 122 | `#2d9cdb` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/utils/entidadLogo.ts |
| 123 | `#0052ff` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/utils/entidadLogo.ts |
| 124 | `#f0b90b` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | modules/inversiones/utils/entidadLogo.ts |
| 125 | `#e8d9ae` | 1 | exacto | `var(--atlas-v5-gold-bright)` | ya es token --atlas-v5-gold-bright · swap literal→var | modules/onboarding/OnboardingPage.module.css |
| 126 | `#fffbf0` | 1 | b·beige | `var(--atlas-v5-bg) / var(--atlas-v5-card-alt)` | beige cálido → bg/card-alt según uso (aprobado) | modules/tesoreria/tabs/MovimientosTab.module.css |
| 127 | `#b8860b` | 1 | a·gold | `var(--atlas-v5-gold) / var(--atlas-v5-warn)` | oro/ámbar → gold o warn según si es acento o estado | modules/tesoreria/tabs/MovimientosTab.module.css |
| 128 | `#fff0f0` | 1 | semantic | `var(--atlas-v5-neg-wash)` | rojo/rosa lavado → neg-wash (aprobado) | modules/tesoreria/tabs/MovimientosTab.module.css |
| 129 | `#0a3f7a` | 1 | UI-info | `var(--atlas-v5-brand)` | azul info sólido → brand (decisión Jose 1) | pages/GestionInmuebles/venta/wizardStyles.ts |
| 130 | `#22c55e` | 1 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | pages/account/migracion/ImportarAportaciones.tsx |
| 131 | `#fff9f9` | 1 | semantic | `var(--atlas-v5-neg-wash)` | rojo/rosa lavado → neg-wash (aprobado) | pages/account/migracion/ImportarAportaciones.tsx |
| 132 | `#e8f5e9` | 1 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | pages/account/migracion/ImportarPrestamos.tsx |
| 133 | `#2e7d32` | 1 | semantic | `var(--atlas-v5-pos)` | verde → pos (aprobado) | pages/account/migracion/ImportarPrestamos.tsx |
| 134 | `#441144` | 1 | semantic | `var(--atlas-v5-cripto)` | púrpura → cripto (aprobado) | services/fiscalConciliationService.ts |
| 135 | `#0066cc` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | utils/accountHelpers.ts |
| 136 | `#0063b2` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | utils/accountHelpers.ts |
| 137 | `#ff6600` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | utils/accountHelpers.ts |
| 138 | `#00a000` | 1 | d·entidad | `catálogo entidadLogo.ts (excepción §12.5)` | identidad de tercero identificable · no paleta · se consolida y el fichero se excluye de hex_hardcoded | utils/accountHelpers.ts |
