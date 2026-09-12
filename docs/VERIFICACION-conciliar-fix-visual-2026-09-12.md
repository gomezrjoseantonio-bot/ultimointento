# FIX de la pantalla de Conciliación · lo VISUAL/UX · VERIFICACIÓN

PR #1873 · preflight `docs/VERIFICACION-conciliar-fix-visual-preflight-2026-09-12.md` · decisiones de Jose (12 sep): 1 «ni ámbar ni nada, quítalo» · 2 «cíñete al mockup: otro piso → marcas otro piso y ahí se fija» · 3 OK · 4 OK · 5 «las letras del botón oro en blanco» · 6 «top 3 de gastos e ingresos».

## Qué se ha hecho

| # | Qué | Dónde |
|---|---|---|
| 1 | El bloque de saldo/apertura **fuera del todo**. `CuadreConElBanco.tsx` y su test borrados; `PanelConciliar` ya no lo monta ni recibe `aplicarApertura`/`onAplicarApertura`; `CuadreBanco.module.css` se queda solo con `YaEstaban` (0 `warn-wash`, 0 `pos-wash`). El hero sigue enseñando el saldo que dice el banco. El cálculo (`aperturaDerivada.ts`) intacto; el drawer conserva su estado de apertura sin exponerlo (debe aparte). | `conciliar/PanelConciliar.tsx` · `conciliar/CuadreBanco.module.css` · `DrawerExtracto.tsx` |
| 2 | **Como el mockup.** Entidad que sabe QUÉ es pero no de qué piso: **un** botón en oro con el piso probable (el de la declaración, que ahora viaja en `Propuesta.pisoProbable`), «Otro piso» que abre el selector (el mismo `<select>` nativo que la ficha) y ahí se fija, y «Personal». Entidad que no sabe qué es: «Es personal» (oro), «Elegir categoría» (la ficha), «Es de un piso» (selector), «Es un traspaso mío» (selector de cuenta, solo cargos). «Ignorar» pequeño. **Nunca un botón por cada piso** (`grep inmuebles.map` → solo dentro del `<select>`). Elegir piso = la ficha prerrellenada con ese piso (P1 sigue). | `conciliar/TarjetaAccion.tsx` · `conciliar/propuestaDeLinea.ts` |
| 3 | «cuadra con un previsto» **fuera**: con previsto o confirmado real se dice cuál; si no, la clasificación real (`etiquetaDeClasificacion`) o nada. `grep "cuadra con un previsto"` → 0. | `LineaExtractoItem.tsx:145-165` |
| 4 | La banda de propuesta solo cuando ATLAS dice algo real (propone/confirma, «se recordará», aviso del motor); la pregunta abierta es el chip «¿Qué es?» y nada más. La ayuda («sube la factura…», el porqué) en un icono ⓘ con `title`. Fuera «lo aplico a los N» y «No sé qué es · dímelo tú una vez» de la pantalla. El traspaso ya no es un bloque siempre abierto. | `conciliar/TarjetaAccion.tsx` |
| 5 | Importes de dentro (`.dentroN`, `.filaN`) en **tinta**; contador «24 recibos» = `Pill gris` del DS; **botón oro con letras en blanco** (`--atlas-v5-on-navy-1`); el icono del tono «confirma» sin fondo ámbar. `tone="auto|pos|neg"` en `conciliar/` = 0 · hex en CSS = 0 · `pos/neg` solo estado · el único `warn-wash` es el aviso de error. | `conciliar/PanelConciliar.module.css` · `conciliar/GrupoEntidad.tsx` |
| 6 | Hero: **top 3** familias de lo que entró y de lo que salió, siempre; sin «nada todavía» (un lado sin familias enseña «sin clasificar» con su total; un lado a cero, nada). | `conciliar/HeroConciliar.tsx` |

Sin tocar la clasificación de fondo, el cálculo del saldo ni `DB_VERSION` (94).

## Verificación

| Qué | Resultado |
|---|---|
| Sin banda de saldo | `CuadreConElBanco` no existe · `queryByTestId('cuadre-banco')` → null (test) |
| Destino de piso | un botón (piso probable) + «Otro piso» → selector · test `PanelConciliar.test.tsx` |
| `grep "cuadra con un previsto"` en `src` (sin tests) | **0** |
| Textos de ayuda | `grep "si subes la factura|lo aplico a|No sé qué es"` en los `.tsx` de `conciliar/` → 0 (la frase vive solo como `title` del ⓘ) |
| Colores | `.dentroN`/`.filaN` sin `ink-3` · `tone="auto|pos|neg"` = 0 · hex = 0 · `warn-wash` solo en `.aviso` |
| `npx tsc --noEmit` · `eslint` (lo tocado) | limpios |
| Carpeta `tesoreria/v6` | 39 suites · 540 tests en verde |
| Suite completa | 24 suites / 100 tests rojos · **el mismo conjunto que `main`** · 6.535 en verde |
| `CI=true build` | `Compiled successfully` · 0 avisos |
| Trinquete `--base-main` | OK · todos 230 · archivos_800 37 · no_v5 106 · servicios_muertos 0 |

## Fuera de alcance
La clasificación de fondo (CARREFOUR → «¿qué piso?», WIZINK, CANCELAC…) · el cálculo del saldo/apertura · la TGSS en una entidad.
