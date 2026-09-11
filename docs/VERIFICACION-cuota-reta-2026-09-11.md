# Verificación · familia `cuota_reta` · la regularización de la TGSS ya no es una pensión

**Fecha:** 2026-09-11 · **PR:** #1868 · **Commits:** `e8e6608` (cambio) · `5ce5aac` (marcador de salud) · **Base:** `main` en `412825b` (#1867).

## El bug

Un abono de la TGSS —la regularización de la cuota de autónomos · casos reales de Abanca **+283,03** y **+1.488,72**— se clasificaba como `ingreso · pension`. Dos causas: «SEGURIDAD SOCIAL» estaba en la lista `PENSION` (que dispara en positivo) y no había familia de gasto para la cuota RETA (`autonomo` es de ingreso). Reportado en #1867 §4; Jose decidió el 11 sep: familia propia `cuota_reta`, TGSS en los dos signos delante de PENSIÓN, «SEGURIDAD SOCIAL» fuera de PENSIÓN, y al catálogo definitivo §2.

## Qué cambia

| Archivo | Cambio |
|---|---|
| `catalogo/catalogoUnico.ts` | `FamiliaGastoId` + `cuota_reta` · entrada «Cuota RETA» (personal, sin subtipos) · 22 familias de gasto, 33 en total |
| `clasificacion/reglasDuras.ts` | `PENSION = ['PENSION', 'INSS']` · `TGSS = ['TGSS', 'TESORERIA GENERAL', 'TESORERIA GRAL', 'REGIMEN ESPECIAL AUTONOMOS', 'CUOTA AUTONOMOS', 'RETA']` por `porComercio` (los dos signos), **antes** que la regla de pensión |
| `reglasDuras.test.ts` | +283,03 y +1.488,72 → `gasto · cuota_reta` con motivo «devolución»; −300 → `cuota_reta` sin él; «PENSION INSS» y «PENSION SEGURIDAD SOCIAL» siguen siendo pensión |
| `catalogoUnico.test.ts` | lista de familias · 32 → 33 |
| `docs/ATLAS-CATALOGO-clasificacion-DEFINITIVO.md` §2 · `docs/MODELO-seccion32-catalogo-decisiones.md` | fila `cuota_reta` · 21 → 22 con la nota |

Por qué «SEGURIDAD SOCIAL» no pasa a la lista TGSS: «PENSION SEGURIDAD SOCIAL» es una pensión de verdad, y con la palabra en TGSS (que va antes) saldría como cuota devuelta. La TGSS se reconoce por lo que solo es suyo (TGSS, Tesorería General, régimen de autónomos, RETA); la pensión, por «pensión» e INSS.

Sin bump de `DB_VERSION` (94), sin migración: la familia es nueva, nada existente cambia de sitio. Fuera a propósito (fase de previsión): IVA 303, factura con IVA, préstamo de socio.

## Verificación (sobre `5ce5aac`)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | limpio |
| `build` (`CI=true`, como Netlify) | limpio · `Compiled successfully`, 0 avisos |
| Suite completa | **24 suites / 100 tests en rojo · el mismo conjunto exacto que `main`** (diff de la lista de rojas vacío) · 6.486 en verde |
| Suites afectadas | 8 en verde (106 tests) · catálogo, reglas, motor, lente fiscal, fixtures de bancos |
| Trinquete | ✓ `todos_totales` 230 · `archivos_800` 37 · `ficheros_no_v5` 108 |
| `DB_VERSION` | 94 · sin bump, sin migración |
