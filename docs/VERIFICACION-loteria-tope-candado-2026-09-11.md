# Verificación · lotería como ingreso · tope al arrastre · la regla tiene que seguir encajando

**Fecha:** 2026-09-11 · **PR:** #1867 · **Preflight:** `VERIFICACION-preflight-loteria-tope-candado-2026-09-11.md` · **Decisiones:** D1-D4 aprobadas por Jose («ok»).

Cinco commits sobre `main` en `230e396`. Sin bump de `DB_VERSION` (94), sin migración (Regla A).

| Commit | Qué |
|---|---|
| `c4789b0` | **1 · Lotería** · el premio es `ingreso · otros_ingresos`; la regla de ingreso va ANTES que la de comercio, como `ALQUILER` |
| `1503607` | **2 · Tope al arrastre** · hasta 3 hermanas solas; más, se pregunta en el panel |
| `a835634` | **3 · La regla tiene que encajar** · `reglaEncaja` compara las piezas de la clave del movimiento con las del texto guardado en la regla; fuera `applyAllRulesOnImport` (D4) |
| `3117990` | El prerrelleno de la ficha pasa a `prerrellenoDeFicha.ts` (el trinquete `ficheros_no_v5` no admite un `.tsx` envoltorio sin UI) |
| `cd0987a` | **Devoluciones (Abanca)** · tests de la devolución de gestoría por concepto y por NIF; la SS queda reportada |

---

## 1 · Lotería

Tal como decía el preflight: una regla, en `reglasDuras.ts`, delante de `porComercio(m, OCIO_APUESTAS, 'ocio', 'otros')`. En negativo nada cambia (`ocio · otros`). Test en `reglasDuras.test.ts`: `PREMIO LOTERIAS Y APUESTAS DEL ESTADO` +50 y `ABONO BOTEMANIA` +120 → ingreso; `LOTERIAS Y APUESTAS` −6 → gasto.

## 2 · Tope al arrastre

- `aprendizajeEnSesion.ts` · `TOPE_SIN_PREGUNTAR = 3` (D1), `hayQuePreguntar`, `hermanasQueAprenderian` (sacado de `aplicarAprendizajeALasHermanas`, que ahora admite la lista) y el hook `useArrastreConTope` con `proponer / pendiente / confirmar / descartar`.
- `conciliar/AvisoArrastre.tsx` · la pregunta, junto a los avisos del panel (`PanelConciliar` gana la prop `pregunta`). No bloquea (D2).
- `confirmar` recibe `sinDecidir` y `onResuelta` **frescos** del render: se recalcula quién sigue en «te necesitan» en el momento del sí, así que una hermana que el usuario ignoró entre la pregunta y el sí no se pisa. Fijado en test.
- `descartar` lo llama `reiniciar` (cerrar/guardar) y `proponer` (otra línea clasificada después sustituye la pregunta).
- En bloque (`clasificarLasElegidas`) nada cambia.

**Hazard del preflight, cumplido de otra forma.** El drawer estaba a 794/800. El plan B era sacar `fichaDeCreacion` a un componente, y así se hizo (`FichaDeCreacion.tsx`)… y el trinquete subió `ficheros_no_v5` 108→109: un `.tsx` que no pinta nada no consume el design-system. Importar v5 para contentar al contador habría sido esconder. Lo honesto: la regla del prerrelleno (una línea, o la primera de varias) es una función pura y va a un `.ts` (`prerrellenoDeFicha.ts`, con test); `<FichaMovimiento>` vuelve al drawer. **Drawer: 791 líneas.**

## 3 · La regla tiene que seguir encajando

`movementLearningService.ts`:

- `piezasV1` / `piezasV2` · lo que se hashea, antes de hashearlo. `buildLearnKey` y `buildLearnKeyV1` las usan (misma clave que antes, ningún hash cambia).
- `patronesDeRegla(movement)` · la ÚNICA derivación del texto que se guarda (`counterpartyPattern`, `descriptionPattern`, `amountSign`, `identificadores`). `createOrUpdateRule` la usa; los tests que siembran reglas también.
- `reglaEncaja(movement, rule)` · piezas del movimiento == piezas reconstruidas del texto guardado (v2 con v2 si los dos traen identificador; si no, v1 con v1).

`movementSuggestionService.reglaDelMovimiento` · la clave encuentra la regla, `reglaEncaja` la confirma; si no encaja es como si no estuviera (y se prueba la v1).

Qué rechaza, fijado en `claveDeAprendizaje.test.ts`: una regla sin texto guardado (D3), una regla del cajón común anterior a #1866, una regla con la clave de un texto y el texto de otro (la colisión), y el signo contrario. Qué sigue encajando: el recibo de abril con la regla de marzo, el Bizum con cola libre, el mismo CUPS (y no otro).

**D4 · `applyAllRulesOnImport` fuera**, con su alias `applyLearningRulesToNewMovements` y `generateLearnKey` (solo lo usaba él). El paquete `learningService` conserva `createOrUpdateRule`, que es lo único que se leía.

**Tests que sembraban reglas imposibles**, arreglados sin cambiar lo que prueban: `movementSuggestionService.test.ts` finge `reglaEncaja` (sus claves son inventadas; función plana por `resetMocks`); `caracterizacionMatcheo`, `matcheoPorLinea.equivalencia` y `bucleAprendizaje` siembran con `patronesDeRegla` del movimiento real. `bucleAprendizaje` tenía una regla con el texto de la comunidad sobre una línea del cajero: justo lo que el candado rechaza.

## 4 · Devoluciones · los casos de Abanca (mensaje de Jose)

El mecanismo de E2.4.2-fix es por **familia + signo**, y un abono se convierte en devolución por dos caminos, y solo por dos: el **concepto** (listas de comercios, en los dos signos) y el **identificador** (un compromiso reconocido por NIF/CUPS · la vía A deja pasar un gasto conocido sobre un abono, y con identidad tolera que el importe no cuadre). Ni una regla aprendida ni la ficha a mano lo hacen (#1866, a propósito).

| Caso | ¿Lo cubre? | Test |
|---|---|---|
| Gestoría · «GESTORIA» en el texto | **Sí** · `porComercio(GESTION_GESTORIA)` → `gestion · gestoria` en positivo | `reglasDuras.test.ts` |
| Gestoría · Finutive por su NIF (compromiso recurrente) | **Sí** · vía identificador → `gestion · gestoria` | `clasificarLinea.test.ts` |
| Gestoría · «FINUTIVE SL» sin compromiso y sin la palabra | **No** · el motor no conoce el nombre; cae al defecto (ingreso) | — |
| Seguridad Social · devolución de la TGSS (RETA) | **No** · ver abajo | — |
| IVA · modelo 303 a devolver | Fuera a propósito · movimiento con Hacienda, no un gasto que vuelve (Jose) | — |

### Hallazgo · la SS necesita catálogo · PARA

1. **No hay familia para la cuota RETA.** `FamiliaGastoId` no tiene «seguridad social»; `autonomo` existe pero es familia de **ingreso**. Sin familia del gasto no hay «misma familia en positivo».
2. **«SEGURIDAD SOCIAL» está en la lista `PENSION`** (`reglasDuras.ts` l.59), que dispara en positivo → un abono de la TGSS («TESORERIA GENERAL DE LA SEGURIDAD SOCIAL» +283,03) se lee hoy como **`ingreso · pension`**.

Mínimo cambio, para tu confirmación (es esquema del catálogo · no lo toco sin tu OK):

- **Familia**: o un subtipo `seguridad_social` dentro de `impuestos_tasas`, o una familia de gasto nueva `seguridad_social`. Recomiendo la **familia nueva**: la cuota de autónomos no es un impuesto y tendrá su propio sitio en la fase de autónomo/previsión que viene después.
- **Regla**: lista `TGSS = ['TGSS', 'TESORERIA GENERAL', 'TESORERIA GRAL', 'REGIMEN ESPECIAL AUTONOMOS', 'RETA']` en los dos signos, **antes** que `PENSION`; y quitar «SEGURIDAD SOCIAL» de `PENSION` (queda `PENSION`, `INSS`), porque «Seguridad Social» a secas es la cobradora, no la pagadora.
- Test con tus dos importes reales (+283,03 y +1.488,72).

## 5 · Verificación (sobre `cd0987a`)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | limpio |
| ESLint (archivos tocados, `--max-warnings=0`) | limpio · los 4 avisos de `movementSuggestionService.test.ts` son de antes, en líneas no tocadas, y el build no lintea tests |
| `build` (`CI=true`, como Netlify) | limpio · `Compiled successfully`, 0 avisos |
| Suite completa | **24 suites / 100 tests en rojo · los mismos números que `main`** · ninguna de las 18 suites tocadas está entre ellas · 6.484 en verde |
| Suites tocadas | 18 · todas en verde (271 + 60 + 58 tests) |
| Trinquete | ✓ `todos_totales` 230 · `archivos_800` 37 · `ficheros_no_v5` 108 · nada empeora |
| `DB_VERSION` | 94 · sin bump, sin migración |

## 6 · Queda fuera

- Enseñar en la pantalla de reglas cuáles ya no encajan con su texto.
- Borrar las reglas del cajón común anterior a #1866 (inalcanzables y ahora rechazadas · borrar es migración).
- La SS (§4) · esperando decisión de catálogo.
- El IVA del 303 · fase de autónomo/previsión.
