# Verificación · E2.4.2-fix2 · clasificar contra el propio fichero

**Fecha:** 2026-09-11 · **PR:** #1869 · **Preflight:** `VERIFICACION-E2.4.2-fix2-preflight-clasificar-por-concepto-2026-09-11.md` · **Decisiones:** D1-D6 de Jose (11 sep) · **Base:** `main` en `9108016`.

## 0 · Lo que se hizo, en cuatro líneas

1. **La clasificación que el motor ya calculaba se desentierra**: llega a la sesión, decide el montón, titula la columna derecha y se materializa al Guardar. No se reescribió el motor (menos riesgo, como pidió Jose).
2. **El concepto cubre los textos de Abanca**: ahorro = traspaso a ahorro (una categoría), la cuota RETA con «COTIZACION»/«AUTONOMOS»/«T.G.S.S.», FINUTIVE = gestoría (D3), el IVA reconocido y **no** clasificado (D4), y el parser entiende «Fecha ctble».
3. **Medido sobre el fichero real (49 líneas): 38 con sus 4 ejes, 11 honestas sin familia.** No el 97 % del enunciado: con D3 y D4 aplicadas, lo que queda son 7 UNIHOUSER, 3 IVA y 1 «JUNIO 2025» (§3).
4. **El préstamo de socio (D5) se queda en PARA** con el nudo reportado (§4): partir una línea en capital + interés no existe en ningún camino y el catálogo no tiene familia para ese capital que vuelve.

## 1 · Commits

| Commit | Qué |
|---|---|
| `0bf7ce3` | Reglas de concepto (ahorro, TGSS, FINUTIVE, IVA-aviso) · alias «Fecha ctble» · fixture `abanca-fixture.csv` y su test |
| `73851ba` | `LineaExtracto.clasificacion` · `estaClasificada` (D1) · cuarto resolutor del bucket · columna derecha por etiqueta · tarjeta con aviso · `resueltasPorConcepto` al Guardar (D2) |

Sin bump de `DB_VERSION` (94), sin migración: la clasificación ya estaba en la fila.

## 2 · Cómo queda cada pieza

**Sesión** · `extractoSesion.ts` · `LineaExtracto.clasificacion?` se mapea desde `fila.clasificacion` en `construirLineas`. Sirve para importar y para retomar un lote.

**Criterio (D1)** · `services/clasificacion/clasificada.ts` · `estaClasificada`: familia con origen `concepto` / `identificador` / `aprendida`, o `movimiento_interno` con origen distinto de `defecto`. Un ingreso solo por el signo **no**; una familia por `recurrencia` **no** (propone, no resuelve · §13). `etiquetaDeClasificacion` («Traspaso · A ahorro», «Gasto · Gestión · Gestoría») y `avisoDeClasificacion` (el motivo de lo que se queda sin clasificar a propósito).

**Bucket** · `conciliarBuckets.ts` · `bucketDeLinea(…, autoResueltas, clasificadas)`: detrás de libros y reglas (traen más: piso, cuenta, cuadro), delante de «personal». Ignorar y «No es esto» siguen mandando. `cuadre` igual.

**Sesión → Guardar** · `clasificadasPorConcepto.ts` (espejo de `resueltasPorRegla.ts`): `clasificadasDe(lineas)` y `lineasResueltasPorConcepto(...)` — solo las que siguen en `resolver`, no desmentidas, y que no cerró antes un libro o una regla.

**Columna derecha** · `agruparResueltas.nombreDeLineaResuelta`: previsto → confirmado → **etiqueta de la clasificación** → texto del banco. «AHORRO» + «AHORROS JUNIO» = una fila. `ColumnaResto` enseña los ejes junto a la fecha de cada línea.

**Tarjeta** · `propuestaDeLinea(…, aviso)`: sin sugerencia, la ayuda es el aviso del motor si lo hay («movimiento con Hacienda · IVA…») antes que la frase genérica.

**Guardar (D2)** · `confirmarDecisiones.ts` · paso 5 bis, `resolverPorConcepto`: gasto/ingreso por `gastoDesdeMovimiento` (materializa, clasifica, fila fiscal si hay piso); un interno por concepto («AHORROS») por `materializarLinea` — nace movimiento interno **sin pata al otro lado**, como ya admite `traspasosPropios`: sabe qué es, no a dónde. Huella `comoSeResolvio: 'motor'` y `match_automatico`. Idempotente; cualquier gesto del usuario manda.

**Reglas de concepto** · `reglasDuras.ts` · `AHORRO`, `TGSS` ampliada, `FINUTIVE` en gestoría, `HACIENDA_IVA`/`IMP_303` como **aviso** (solo motivo; `aplicar` lo anota sin tocar ejes). **Criterio de la regla 8 revisado**: «Ahorros Septiembre» ya no se deja como gasto sin familia (que inventaba un gasto de 500 €), es un traspaso; lo que no se inventa es a qué cuenta. Tests de regla 8 y del fixture de Unicaja actualizados y explicados.

**Parser** · alias `fecha ctble` / `fecha contable`. Antes Abanca se fechaba por fecha valor y avisaba «no trae fecha de cargo».

## 3 · Los números de Abanca · 49 líneas

| Grupo | Líneas | Resultado | Por |
|---|---|---|---|
| FINUTIVE | 8 | `gasto · gestion · gestoria` | concepto (D3) |
| INTERESES CTA. | 8 | `ingreso · rendimiento · interes` | concepto (ya estaba) |
| AHORRO / AHORROS / … JUNIO / … JULIO / … AGOSTO | 8 | `movimiento_interno · traspaso · a_ahorro` · **una** categoría | concepto |
| T.G.S.S. / TGSS COTIZACION / DDPP de la TGSS | 9 | `gasto · cuota_reta` · la de +283,03 como devolución (§7) | concepto |
| GOMEZ RAMIREZ / TRANSFER. A … | 5 | `movimiento_interno · traspaso` | cuentas propias (`traspasosPropios`, con el titular en `personalData`) |
| **Con sus 4 ejes** | **38 / 49 · 78 %** | | |
| UNIHOUSER S.L. | 7 | sin familia · ingreso por el signo | D3: no por concepto · 2 cuotas por el préstamo (PARA §4) · 5 facturas hasta que las confirmes |
| IMP:303 | 3 | sin familia · con aviso «movimiento con Hacienda · IVA» | D4 |
| JUNIO 2025 | 1 | sin familia | no dice nada |
| **Honestas sin familia** | **11 / 49** | | |

Con las 2 cuotas del préstamo (cuando D5 se cierre): 40/49 · 82 %. El 97 % del enunciado contaba UNIHOUSER como ingreso por concepto y el IVA como Hacienda; D3 y D4 lo cambiaron a propósito.

**Apertura (P4 del preflight)**: el parser sí detecta la columna `Saldo` de Abanca (49 de 49 con saldo) y la fecha contable; `extremosConSaldo` puede derivar la apertura (3.549,67 + 29,04 = 3.578,71 el 13-01-2025). Que la pantalla la pidiera a mano con «−2.997» apunta a un extracto importado antes de este alias de fecha o a una cuenta sin fecha de apertura; no se toca en este PR, y con el fixture ya se puede probar aparte.

## 4 · PARA · el préstamo de socio (D5)

**Lo que hay.** La posición P2P guarda capital, TIN, plazo, frecuencia, modalidad y retención (`AltaPrestamoModal.tsx:290-335`), y `calcularCuadroPrestamo` (`prestamoInversionCuadro.ts:127`) recalcula el cuadro con capital e interés por periodo. Se puede reconocer la cuota a ±5 días e importe exacto (cuota neta de retención sobre el interés), como `cuotasDePrestamo.ts`.

**El nudo.** Jose pidió «capital → interno, interés → rendimiento». Eso son **dos movimientos por una línea**, y no existe ningún camino que parta una línea: `materializarLinea` crea uno; `movimientoCerrado` (`cierreDeterminista.ts:26-40`) cierra UN movimiento con la familia del origen. Y el catálogo no tiene familia interna para «capital de un préstamo concedido que vuelve» (`disposicion_prestamo` es el capital que ENTRA de un préstamo recibido; `aportacion` es lo que sale hacia la inversión).

**Propuesta (para tu decisión, no hecho):** la cuota inversa de §32.33 — **un** movimiento `movimiento_interno` con el desglose (capital/interés/retención) anotado **en el origen** (el pago de la posición), igual que la cuota de un préstamo recibido es un gasto entero y el cuadro desglosa. Hace falta: (a) una familia interna nueva, p. ej. `devolucion_prestamo_concedido` (o reutilizar `aportacion` con sentido `entra`); (b) que la lente fiscal lea el interés del desglose, no del movimiento; (c) tus parámetros del préstamo Unihouser (capital, TIN, plazo, fecha del primer cobro, retención) para fijar en el fixture que 527,92 y 528,16 casan. Es un PR propio (E2.4.2-fix2b).

## 5 · Verificación (sobre `73851ba`)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | limpio |
| ESLint (archivos tocados, `--max-warnings=0`) | limpio |
| `build` (`CI=true`, como Netlify) | limpio · `Compiled successfully`, 0 avisos |
| Suite completa | **24 suites / 100 tests en rojo · el mismo conjunto exacto que `main`** (diff de la lista de rojas vacío) · 6.520 en verde (36 nuevos) |
| Suites tocadas | reglasDuras 60 · fixtures 5 bancos · clasificada 11 · clasificadasPorConcepto 3 · conciliarPantalla 42 · resueltasPorConcepto (base falsa) 6 · resueltasPorRegla, PanelConciliar, extractoSesion, montarSesion en verde |
| Trinquete | ✓ `todos_totales` 230 · `archivos_800` 37 · `ficheros_no_v5` 108 · nada empeora |
| `DB_VERSION` | 94 · sin bump, sin migración |
| `DrawerExtracto.tsx` | 797 líneas (límite 800) |

## 6 · Queda fuera
Préstamo de socio (§4 · PARA) · IVA como previsión (debe de autónomo) · E2.5 · la apertura de Abanca (probable, no confirmada sin la cuenta real).
