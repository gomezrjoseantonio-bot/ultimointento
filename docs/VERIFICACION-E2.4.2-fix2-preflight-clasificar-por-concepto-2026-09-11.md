# Preflight · E2.4.2-fix2 · clasificar contra el propio fichero (no agrupar por texto)

**Fecha:** 2026-09-11 · **Base:** `main` en `9108016` (#1868) · **Sin código todavía.** Todo verificado contra el código (Regla C) · fichero:línea.

## 0 · Lo esencial en seis líneas

1. **El motor SÍ clasifica por concepto cada línea al importar** (`bankStatementOrchestrator.ts:351` → `clasificarLineas` → escribe `lineasExtracto.clasificacion` con los 4 ejes y su origen). **Y nadie lo lee después.** La sesión de pantalla (`LineaExtracto`, `extractoSesion.ts:256`) no lleva `clasificacion`; los montones (`bucketDeLinea`) no la miran; Guardar no la usa; el agrupador de «resueltas» tampoco.
2. **«Resuelta sola» hoy son tres máquinas y ninguna es el concepto**: casó con un previsto (`cuadra`), la reconoció un libro (`reconocidas` · deterministas) o la resolvió una regla aprendida con confianza (`autoResueltas` · E2.2). `conciliarBuckets.ts:70-95`. Lo demás → «te necesitan». Por eso TGSS/AUTONOMOS/COTIZACION/AHORRO (que el concepto resuelve) piden ayuda.
3. **Los «5 montones» no son un parche del motor: son la columna derecha titulando por el texto del banco.** `agruparResueltas.ts:60-62` titula con `previsto.descripcion || confirmado.descripcion || textoBanco`; sin previsto (regla o libro) queda el churro, y `claveDeGrupo` quita números y puntuación pero no plurales → «AHORRO» y «AHORROS» en dos filas. Sin ejes porque la línea de sesión no los tiene.
4. **Las 20 UNIHOUSER en un saco**: la hipótesis más probable es una **regla aprendida** (clave = texto + signo; las 20 son positivas y comparten texto → una regla, `resuelveSola` a las 3 aplicaciones). Y las 15 cuotas **no pueden casar** contra `inversiones` hoy: `rendimientosDeInversion.ts:47-52` exige el **mismo día** y el **importe neto del interés** (`rendimientosService.ts:60-66` genera `importe_neto = interés bruto − retención`, sin capital). Una cuota de ~530 € nunca iguala eso.
5. **Apertura**: `extremosConSaldo` (`aperturaDerivada.ts:147`) solo funciona si las filas traen `saldo`; sin perfil de Abanca (no existe: `bankProfileMatcher.ts` solo lo cita como ejemplo de bloque de metadatos), la columna depende de que la cabecera del CSV diga alguna de las palabras de `bankParser.ts:43-45`. **Sin el fichero no puedo afirmarlo.**
6. **No hay fixture de Abanca en el repo.** El «97 %» no se puede medir sin el fichero (anonimizado).

---

## 1 · Preflight punto por punto

### P1 · Dónde se decide «resuelta sola» y por qué agrupa por texto sin ejes

| Qué | Dónde | Qué hace |
|---|---|---|
| El bucket | `tesoreria/v6/conciliarBuckets.ts:52-95` | `resueltas` ⇐ `cuadra` · `reconocidas` · `autoResueltas`. **No lee `clasificacion`.** Todo lo demás → `te_necesitan` (o `personal` si una regla/recurrente lo dice) |
| Quién alimenta `reconocidas` | `DrawerExtracto.tsx:210` ← `resultado.reconocido.origenes` (deterministas: préstamo, venta, inversión, nómina, recurrente, renta, traspaso propio) | igualdad exacta contra un libro |
| Quién alimenta `autoResueltas` | `resueltasPorRegla.ts:31-48` ← sugerencia `learning_rule` con `resuelveSola` | regla aprendida ≥ 3 aplicaciones (E2.2) |
| El montón de la derecha | `conciliar/agruparResueltas.ts:60-62, 95-115` | título = descripción del previsto/confirmado **o el texto del banco**; clave = `claveDeGrupo(título)` (quita dígitos y puntuación) |
| Lo que pinta | `conciliar/ColumnaResto.tsx:78-142` | título, cuántas, suma, líneas con «No es esto». Sin ejes: `LineaExtracto` no los tiene |

**Conclusión:** no hay un «parche que agrupa en vez de clasificar». Hay una **clasificación calculada y guardada que no llega a la pantalla**, y una columna que, a falta de ejes, titula por el texto. El «resuelto» falso viene de las reglas aprendidas (E2.2) que resuelven por texto+signo sin enseñar qué son.

### P2 · ¿Están las reglas de concepto? ¿Por qué no se aplican a estas líneas?

**Están y se aplican.** `clasificarLote.ts:56-80` corre `clasificarLinea` (aprendida → identificador → concepto → recurrencia → defecto) sobre toda línea que entra al matcheo, con las señales del sugeridor y de los deterministas, y `guardarClasificacionEnLineas` lo persiste. Lo que no existe es el **consumidor**: ni el bucket, ni la sesión, ni Guardar, ni la columna derecha.

**Y hay huecos de cobertura para los textos de Abanca** (`reglasDuras.ts`):

| Texto de Abanca | Hoy | Falta |
|---|---|---|
| AHORRO / AHORROS | ninguna lista | regla → `movimiento_interno · traspaso · a_ahorro` (el subtipo **existe**: `catalogoUnico.ts` traspaso → `a_ahorro`). Una sola categoría para las dos grafías por definición |
| TGSS / T.G.S.S. / COTIZACION / AUTONOMOS | `TGSS = ['TGSS','TESORERIA GENERAL','TESORERIA GRAL','REGIMEN ESPECIAL AUTONOMOS','CUOTA AUTONOMOS','RETA']` (#1868) | `COTIZACION`, `AUTONOMOS` sueltos, y que `T.G.S.S.` normalice a `TGSS` (ver cómo normaliza `tienePalabra`) |
| INTERESES CTA | `RENDIMIENTO_INTERES` tiene `INTERESES` → `ingreso · rendimiento · interes` ✓ | nada |
| FINUTIVE | `GESTION_GESTORIA = ['GESTORIA']` | es un **nombre propio**, no una palabra del catálogo · **D3** |
| IMP:303 / IMPTO SOBRE EL VALOR AÑADIDO | ninguna lista (`IMPUESTOS` tiene AEAT/HACIENDA, no IVA) | familia/naturaleza · **D4** |
| GOMEZ RAMIREZ / TRANSFER | `traspasosPropios.ts` reconoce por IBAN propio o por el nombre del titular (`personalData`) | depende de que `personalData` tenga el nombre; a confirmar con el fichero |
| UNIHOUSER (5 gordas) | ninguna | `ingreso · autonomo` no sale del concepto (nombre propio) · **D3/D5** |

### P3 · `inversiones` en el cruce · por qué las 15 UNIHOUSER no casan

- **Sí está en las fuentes**: `matcheoDeterminista.ts:66-75` lee `inversiones` y llama a `rendimientosQueCuadran`.
- **No pueden casar**, por dos motivos y los dos son de diseño, no de datos:
  1. `rendimientosDeInversion.ts:47-52` exige `mismoDia` (día exacto) y `mismoImporte(pago.importe_neto, m.amount)` (céntimo exacto).
  2. `rendimientosService.ts:60-66` genera cada pago como **interés** (`importe_bruto` por tasa y frecuencia, `importe_neto = bruto − retención`). **Sin capital.** Una cuota francesa (capital + interés) de ~530 € no es ningún `importe_neto`.
- El alta del préstamo P2P (`AltaPrestamoModal.tsx:207-273`) **calcula el cuadro francés** (periodos con capital e interés, `cuota`, retención) desde capital/TIN/plazo/frecuencia/modalidad, «la misma fuente que la ficha y la previsión de tesorería» (l.231), pero **no lo persiste**: se recalcula de la posición. Ese cuadro es contra lo que hay que casar.

**Propuesta:** fuente determinista nueva `cuotasDePrestamoDeSocio` (espejo de `cuotasDePrestamo.ts`): recalcula el cuadro de cada posición `prestamo_p2p` con modalidad `capital_e_intereses`, casa por importe exacto (cuota neta de retención) a **±5 días** (`MARGEN_DIAS_CUOTA`), y desglosa: capital → `movimiento_interno` (devolución de préstamo concedido) · interés → `ingreso · rendimiento · interes`, como la cuota inversa de §32.33. **D5.**

### P4 · La apertura en Abanca

`propuestaDeApertura` → `extremosConSaldo(filas)` (`aperturaDerivada.ts:147-177`) necesita filas con `saldo` numérico; la columna la detecta el parser genérico por cabecera (`bankParser.ts:43-45`: saldo, saldo disponible, balance…). Abanca no tiene perfil. Si su cabecera no dice ninguna de esas palabras, o el saldo viene en el bloque de metadatos y no por fila, `extremosConSaldo` devuelve `null` y la pantalla pide la apertura a mano. Que ATLAS calcule −2.997 con el banco en 581,33 es coherente con **apertura no derivada** (arranca de 0) — pero es hipótesis hasta ver el fichero. **No se toca en este PR sin el fichero.**

---

## 2 · Lo que se propone hacer

**A · La clasificación llega a la pantalla.** `LineaExtracto` gana `clasificacion?` (se mapea en `extractoSesion.ts:256` desde la fila persistida). Sin bump, sin migración: la fila ya lo tiene.

**B · «Resuelto = tiene sus 4 ejes puestos».** `bucketDeLinea` gana un cuarto resolutor, `clasificadas` (por `lineaId`), detrás de `reconocidas` y `autoResueltas` y delante de `personal`. Entra una línea cuya `clasificacion` tenga **familia con origen `concepto`/`identificador`/`aprendida`**, o naturaleza `movimiento_interno` con origen distinto de `defecto`. Lo que solo tenga `defecto` → `te_necesitan`, honesto («dímelo tú»). **D1.** «No es esto» ya devuelve cualquier resuelta a «te necesitan» (`desemparejados`): sirve tal cual.

**C · Guardar materializa lo clasificado.** `confirmDecisions` gana `resueltasPorConcepto: lineaId[]` (paso 5 bis, después de las reglas): `materializarLinea(base, lineaId, now, 'motor')` — el movimiento **ya hereda** los 4 ejes de la línea (`lineaComoMovimiento.ts:78-88`). Un traspaso por concepto sin pata conocida se queda «sin pata al otro lado», como ya admite `traspasosPropios`. **D2.**

**D · La columna derecha titula por lo que ATLAS sabe.** `agruparResueltas`: clave y título por `labelClasificacion(familia, subtipo)` (+ naturaleza) cuando hay `clasificacion`; el texto del banco solo si no la hay. AHORRO + AHORROS → una fila «Traspaso · A ahorro · 20». Cada línea del grupo enseña sus ejes.

**E · Reglas de concepto que faltan** (`reglasDuras.ts`): AHORRO/AHORROS → traspaso·a_ahorro; TGSS += COTIZACION, AUTONOMOS, T.G.S.S.; FINUTIVE (D3); IVA (D4).

**F · Préstamo de socio** contra `inversiones` (D5).

**G · Fixture de Abanca** anonimizada en `src/features/inbox/importers/__fixtures__/` y test «~97 % con 4 ejes» en `fixturesBancos.e242.test.ts`. **Necesita el fichero.**

### Lo que NO se toca
El emparejador de previstos (`analizarLineas`), las reglas aprendidas (E2.2), el catálogo (salvo D4), la apertura (P4 · sin fichero), el IVA como previsión, E2.5.

---

## 3 · PARA · decisiones antes de codificar

- **D1 · Qué cuenta como «clasificada»**: familia con origen `concepto`/`identificador`/`aprendida`, o interno con origen no-defecto. Un ingreso «por el signo» sin familia (transferencia de una persona) **no** es resuelto: va a «te necesitan». ¿OK?
- **D2 · Las clasificadas se materializan al Guardar** como movimiento con sus ejes, reversibles después desde Tesorería (como las de regla). La alternativa —dejarlas como líneas clasificadas sin movimiento— no cuadra con «resuelto». ¿OK?
- **D3 · FINUTIVE y UNIHOUSER son nombres propios.** Meterlos en las listas de concepto funciona para ti y para nadie más (el catálogo nacional de proveedores es E2.6). Propuesta: **sí** a `FINUTIVE` en `GESTION_GESTORIA` como pide el enunciado, marcado como proveedor conocido; `UNIHOUSER` NO por concepto — las 15 cuotas por el préstamo del store (D5) y las 5 facturas quedan honestas en «te necesitan» (son 5 de 104) hasta que las confirmes una vez y la regla aprendida las coja. ¿O prefieres `UNIHOUSER` en positivo grande → `ingreso · autonomo` por concepto?
- **D4 · IVA (IMP:303 / IMPTO SOBRE EL VALOR AÑADIDO).** Mínimo para no dejarlo en «te necesitan»: `gasto · impuestos_tasas · otros_tributos` en negativo y su devolución (§7) en positivo, con el motivo «IVA · provisional hasta la fase de autónomo». Un subtipo nuevo `iva` sería más claro pero es catálogo. ¿Provisional en `otros_tributos`, o subtipo `iva`?
- **D5 · Préstamo de socio.** Fuente determinista nueva que recalcula el cuadro del P2P (capital + interés, neto de retención, ±5 días). Necesito confirmar que la posición Unihouser está en `inversiones` como `prestamo_p2p` · `capital_e_intereses` con TIN, plazo y primer cobro (si no, no hay cuadro que recalcular). Si el cuadro no cuadra con lo que el banco ingresa (redondeos, retención distinta), las 15 caen a «te necesitan» honestas, no a un saco. ¿OK, y me confirmas los datos de la posición?
- **D6 · El fichero de Abanca** (CSV/XLSX, anonimizado: IBAN y nombres cambiados, importes y textos reales). Sin él: no hay fixture, no hay 97 % medible, y no puedo confirmar ni la apertura (P4) ni los formatos exactos («T.G.S.S.», «TRANSFER»). ¿Lo subes?

## 4 · Verificación prevista
Con el fichero: fixture + test «Abanca · N líneas · ≥ 97 % con 4 ejes · las 3 ambiguas en te necesitan» · tests de bucket (clasificada → resueltas; solo-defecto → te necesitan; «No es esto» la devuelve) · test de `agruparResueltas` (AHORRO+AHORROS = 1 grupo con etiqueta) · test de Guardar (`resueltasPorConcepto` materializa con ejes) · test de `cuotasDePrestamoDeSocio` · suite con las mismas rojas que `main` · build · trinquete · `DB_VERSION` 94.

**Stop-and-wait.** Espero D1-D6 y el fichero antes de tocar código.
