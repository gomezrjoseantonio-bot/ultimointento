# Preflight · tres respuestas de Jose · lotería · tope al arrastre · la regla tiene que seguir encajando

**Fecha:** 2026-09-11 · **Base:** `main` en `230e396` (#1866 mergeado) · **Sin código todavía.**

Jose contestó a las tres cuestiones que dejó abiertas #1866:

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | El premio de lotería/apuestas restaba de `ocio` en vez de contar como ingreso | **«poner como otros ingresos»** |
| 2 | ¿Pedir confirmación cuando UNA línea resolvería más de un puñado de hermanas? | **sí** |
| 3 | ¿Comprobar que el texto guardado en la regla aprendida sigue encajando antes de aplicarla? | **sí** |

Van los tres en un PR, tres commits, porque la rama de trabajo es una sola. Ninguno toca `DB_VERSION` (94) ni migra nada (Regla A). Todo lo de abajo está verificado contra el código de `main` hoy (Regla C).

---

## 1 · Premio de lotería o apuestas → `ingreso · otros_ingresos`

### Dónde está hoy

`src/services/clasificacion/reglasDuras.ts`:

- l.91 · `OCIO_APUESTAS = ['BOTEMANIA', 'LOTERIA', 'LOTERIAS', 'APUESTAS', 'CODERE', 'BET365', 'SPORTIUM', 'ONCE']`
- l.262 · `porComercio(m, OCIO_APUESTAS, 'ocio', 'otros')` · desde #1866 `porComercio` dispara **en los dos signos**, así que un premio en positivo sale como devolución de `ocio`.

`ALQUILER` tenía el mismo problema y se resolvió poniendo su regla de ingreso **antes** que la de comercio (l.238-244), con test que lo fija. Lotería es el segundo caso de la misma familia de problema: una lista que en positivo NO es la vuelta de un gasto.

### Cambio (una regla, en el mismo sitio)

```ts
// Un premio es dinero nuevo, no la vuelta de una apuesta · va ANTES que su comercio.
(m) => (entra(m) && tieneAlguna(texto(m), OCIO_APUESTAS)
  ? { naturaleza: 'ingreso', familia: 'otros_ingresos', motivo: 'premio de lotería o apuestas · dinero nuevo' }
  : undefined),
(m) => porComercio(m, OCIO_APUESTAS, 'ocio', 'otros'),
```

El comentario de `porComercio` (l.128-130) pasa a nombrar las **dos** listas que significan cosas distintas según el signo.

### Test

`reglasDuras.test.ts` · bloque «un ingreso de verdad no se lee como devolución» (l.101): `PREMIO LOTERIAS Y APUESTAS DEL ESTADO` +50 → `ingreso · otros_ingresos`; `BOTEMANIA` +120 → ingreso; y el negativo sigue igual: `LOTERIAS Y APUESTAS` −6 → `gasto · ocio · otros`.

**Sin decisión pendiente.**

---

## 2 · Tope al arrastre automático dentro del lote

### Dónde está hoy

Clasificar UNA línea con la ficha (`DrawerExtracto.crearDesdeFicha`, l.482-545) llama a `aplicarAprendizajeALasHermanas` (`aprendizajeEnSesion.ts`, 66 líneas), que resuelve **todas** las hermanas (`hermanasDeAprendizaje` · misma clave, mismo signo, aún en «te necesitan») sin límite y sin avisar. Desde #1866 la clave ya no es un cajón común, así que las hermanas son de verdad las suyas — pero siguen pudiendo ser 28 Bizum de golpe.

### Propuesta

- **Hasta N hermanas: como hoy**, automático y en silencio.
- **Más de N: no se toca nada y se pregunta**, en el panel, junto a los avisos (`PanelConciliar` l.225):

  > Hay **7 líneas más** como «RECIBO GAS NATURAL…» pendientes. ¿Clasificarlas también como *Suministro · gas*?  **[Sí, las 7]** **[No, solo esta]**

- Al decir «sí» se **recalcula** quién sigue pendiente: si entre medias el usuario ignoró o asignó una de las siete, esa no se pisa.
- Cerrar la ficha de otra línea, guardar o cerrar el extracto **descarta** la pregunta sin hacer nada.
- En bloque (`clasificarLasElegidas`) no cambia nada: ahí ya no hay arrastre desde #1866.

### Dónde cambia

| Archivo | Cambio |
|---|---|
| `tesoreria/v6/aprendizajeEnSesion.ts` | `TOPE_SIN_PREGUNTAR`, `hermanasQueAprenderian(a)` (lo que hoy está dentro de `aplicar…`), `hayQuePreguntar(n)`, y el hook `useArrastreConTope()` con `proponer / pendiente / confirmar / descartar` |
| `tesoreria/v6/AvisoArrastre.tsx` · **nuevo** | La pregunta, con sus dos botones · estilo `styles.aviso` del panel |
| `tesoreria/v6/conciliar/PanelConciliar.tsx` (474) | prop `pregunta?: React.ReactNode`, pintada junto a `avisos` |
| `tesoreria/v6/DrawerExtracto.tsx` (**794/800**) | el bloque de l.532-541 pasa a `arrastre.proponer({...})`; se pasa `pregunta` al panel |

**Hazard · trinquete `archivos_800`.** El drawer está a 794. El hook y el componente van fuera precisamente por eso; el neto previsto en el drawer es ≈ +3. Si aun así pasa de 800, el plan B es sacar `fichaDeCreacion` (l.618-661, 44 líneas de JSX) a su propio componente. No se toca nada más del drawer.

### Tests

- `aprendizajeEnSesion.test.ts` · **nuevo**: `hayQuePreguntar(N)` falso / `hayQuePreguntar(N+1)` cierto; `hermanasQueAprenderian` respeta `sinDecidir`; `aplicarAprendizajeALasHermanas` sobre una lista dada toca solo esa lista (mocks con funciones planas · `resetMocks`).
- `AvisoArrastre.test.tsx` · **nuevo**: pinta el número y la familia; «Sí» y «No» llaman a lo suyo.

### Decisiones

- **D1 · N = 3.** «Un puñado». Un extracto mensual trae un recibo por concepto; uno trimestral, tres. Cuatro o más iguales ya es «muchos Bizum» o «muchas compras del súper», y ahí conviene mirar. Se cambia con un número.
- **D2 · La pregunta no bloquea.** Se puede seguir trabajando con ella a la vista; solo desaparece al contestar, al abrir otra ficha o al guardar. La alternativa (modal) corta el flujo justo cuando el usuario está clasificando en serie.

---

## 3 · La regla aprendida tiene que seguir encajando

### Dónde está hoy

La regla se encuentra **solo por clave**:

- `movementSuggestionService.loadLearningRulesIndex` (l.250-286) carga las reglas por `learnKey` y `reglaDelMovimiento` (l.297-310) devuelve la que casa con la clave v2 del movimiento o, si no, con la v1.
- La regla **guarda** el texto del que nació (`createOrUpdateRule` l.372-384 y 452-456): `counterpartyPattern`, `descriptionPattern`, `amountSign`, `identificadores`. Nadie lo lee al aplicar; solo lo enseña la pantalla de reglas.

### Propuesta · comparar las piezas, no el hash

La clave es un hash de unas **piezas** (`v1|signo|ngramA|ngramB|ngramC` o `v2|signo|…|id=…`). Las piezas de un movimiento salen de su texto; las piezas de una regla se pueden **reconstruir de su texto guardado** con exactamente las mismas funciones (`textoParaLaClave`, `ngramsDelMovimiento`), sin escribir una segunda limpieza (Regla B).

`reglaEncaja(movimiento, regla)` = las piezas del movimiento y las piezas reconstruidas de la regla son **idénticas** (v2 con v2, v1 con v1). Se comprueba en `reglaDelMovimiento`, justo antes de devolver la regla.

Por qué piezas y no volver a hashear: si dos textos distintos colisionaran en el hash, el hash de la regla seguiría siendo «coherente» consigo mismo. Comparando las piezas, la colisión no pasa.

### Qué rechaza y qué no

| Caso | Hoy | Con el candado |
|---|---|---|
| Regla nacida de un recibo de marzo · llega el de abril (mismo texto, otro nº de recibo) | aplica | **aplica** · las piezas son las mismas, lo volátil ya estaba fuera |
| Bizum a Víctor · «Concepto Cena» vs «Concepto Regalo» (la cola es texto libre) | aplica | **aplica** · los tres n-gram del principio son los mismos |
| Regla del **cajón común** anterior a #1866 (su texto ya no da clave) | inalcanzable | inalcanzable, y **ahora también rechazada** si alguna clave coincidiera |
| Regla **sin texto guardado** (patrón vacío · las de antes de B2, creadas sin movimiento) | aplica | **no aplica** (D3) · hasta la siguiente confirmación, que B2 ya rellena |
| Colisión del hash entre dos textos distintos | aplica | **no aplica** |

Se prueba con reglas creadas por el `createOrUpdateRule` de verdad (fake db), no con reglas inventadas: para un corpus de conceptos reales, la regla que nace de A encaja con B del mismo comercio y no con C de otro.

### Hallazgos

- **`applyAllRulesOnImport` (`movementLearningService.ts` l.540-610) no tiene ningún llamador en todo `src`, ni en tests.** Es la vía de importación de antes de E2; también busca la regla solo por clave, así que se saltaría el candado. → **D4.**
- **Tests que siembran reglas a mano.** Nueve suites tocan reglas y hoy están **todas en verde (196 tests)**. Tres siembran reglas que en producción no pueden existir: `movementSuggestionService.test.ts` con claves inventadas (`'hash:bizum-fuentes'`), y `caracterizacionMatcheo.test.ts` / `matcheoPorLinea.equivalencia.test.ts` con clave real pero **sin texto guardado**. Con el candado dejan de encajar. Se arreglan sembrando el texto que tendrían de verdad (o, en la de sugerencias, que ya finge `buildLearnKey`, fingiendo también `reglaEncaja` con una función plana · convención `resetMocks`). Ninguna prueba cambia de intención.

### Decisiones

- **D3 · Estricto: sin texto guardado no se aplica.** Una regla que no se puede verificar es justo lo que el candado existe para parar. Coste real: solo las reglas anteriores a B2 creadas sin movimiento, que se curan solas en la siguiente confirmación. `onboardingDetectionService` (l.327-336) pasa siempre el movimiento cuando lo tiene, y sin él usa una clave `onboarding:…` que nunca se busca por hash.
- **D4 · `applyAllRulesOnImport` se quita.** Cero llamadores, cero tests, y un camino que aplica reglas sin candado. Si prefieres conservarlo, se le pone el mismo `reglaEncaja` (una línea) y se queda.

### Queda fuera

- Enseñar en la pantalla de reglas (`AutomatizacionesReglas.tsx`) cuáles **ya no encajan** con su propio texto · sería útil para limpiar, pero es otra tarea.
- Borrar las reglas del cajón común anterior a #1866 · no hacen daño (inalcanzables y ahora rechazadas) y borrar es migración (Regla A).

---

## Verificación prevista (sobre el último commit)

`tsc --noEmit` limpio · `build` con `CI=true` limpio · suite completa con las **mismas** rojas que `main` (24 suites / 100 tests) y las nueve suites afectadas en verde · `node scripts/health.mjs` sin empeorar (`archivos_800` = 37, `todos_totales` ≤ 230) · `DB_VERSION` 94.

**Stop-and-wait.** Espero tu OK a D1-D4 antes de tocar código. Si algo de lo de arriba no es lo que querías decir, dilo y lo cambio antes.
