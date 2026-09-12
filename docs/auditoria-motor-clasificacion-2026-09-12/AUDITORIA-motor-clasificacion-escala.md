# AUDITORÍA · ¿el motor de clasificación ESCALA o depende de reglas duras?

**Fecha:** 12 sep 2026 · **Rama:** `claude/magical-heisenberg-76joc9` · **HEAD auditado:** `602a9b6` · **Solo lectura: no se ha tocado código de la app.**

**Corpus real:** los 9 ficheros que entregó Jose (Santander PDF · Unicaja PDF ×2 · Unicaja XLS ×2 · Sabadell XLS ×2 · ING XLS · BBVA XLSX) = **2.415 líneas · 1.205 movimientos únicos · 5 cuentas**. Todos parseados con el saldo encadenado línea a línea sin un solo hueco (0 roturas de saldo en los 9).

**Entregables en esta carpeta:**

| fichero | qué es |
|---|---|
| `AUDITORIA-motor-clasificacion-escala.md` | este informe |
| `clasificacion-9-ficheros.xlsx` | la clasificación del 100 % de las líneas · una hoja por fichero + RESUMEN, REGLAS, CATALOGO_NACIONAL, PENDIENTES, ENTIDADES, INMUEBLES, CUENTAS |
| `clasificacion.csv` | lo mismo, plano, para grep |
| `motor-propuesto.py` | el motor de reglas con el que se ha clasificado (reproducible: `python3 parse.py && python3 motor-propuesto.py`) |
| `parse.py` | el parseo de los 9 ficheros a `movimientos.csv` |
| `medicion-Q2/` | los tests temporales y la salida de jest con los que se midió el motor actual (pregunta 2) |

---

## 0 · VEREDICTO EN DIEZ LÍNEAS

1. **El motor actual NO escala.** Medido sobre 1.078 líneas reales (4 ficheros): **con reglas duras clasifica el 58,4 %; sin reglas duras, el 0,0 %**. El 100 % de lo que clasifica sale de `reglasDuras.ts` (323 keywords a medida de los ficheros de Jose). Lo que «escala» (identificador + stores + aprendizaje) aporta **cero** en una instalación sin stores cargados.
2. El cruce con stores **existe y está cableado** (no llega vacío por construcción), pero solo aporta cuando el usuario ya ha dado de alta cuentas, préstamos, contratos y recurrentes. Con stores simulados sube a 71,4 %, y casi todo ese salto son **traspasos propios** (tener las cuentas dadas de alta), no préstamos ni recurrentes.
3. **El catálogo nacional de proveedores NO existe** (E2.6 pendiente). Hay 6 listas hardcodeadas desconectadas; la única con NIF tiene 7 entradas en `localStorage` y el NIF de Iberdrola **mal** para el fichero real de Jose (`A95075578` vs `A95554630`).
4. El store `proveedores` existe, tiene clave NIF y se nutre del IRPF, pero **nadie lo lee desde clasificación**. El extractor ya saca `nif:A95554630` de la Referencia 1 de Sabadell. **Falta literalmente un eslabón: cruzar ese NIF con una tabla.**
5. El aprendizaje funciona y está bien hecho, pero **no aprende conceptos de una sola palabra**, **no aprende si no hay familia**, y es **global** (la app es mono-usuario: no hay id de cliente en ningún store).
6. El extractor de identificadores es bueno (7/10) pero **pierde la Referencia 2 de Sabadell** (el mandato que dice de qué piso es el recibo), **rompe con guiones tras etiqueta**, y no reconoce el patrón Unicaja `EMISOR123456-987654321098`.
7. **Con un motor en capas (propuesto aquí), sin una sola keyword de comercio, el mismo corpus se clasifica al 98,8 %**: 62,5 % solo con lo que trae el fichero + cruce entre cuentas; 35,5 % necesitó un catálogo NIF/nombre → proveedor; 1,7 % conocimiento externo; **1,2 % (14 líneas) solo lo sabe el usuario**.
8. **145 entidades distintas cubren los 1.205 movimientos: 11 entidades = 50 %, 35 = 80 %, 57 = 90 %.** Ese es el coste real del aprendizaje: con ~60 decisiones del cliente se cubre el 90 % de dos años de 5 cuentas. Eso sí escala; una lista de keywords no.
9. **Faltan datos que ningún motor puede inventar:** hay una **segunda cuenta Santander no aportada** (recibe los 61 «Traspaso:» y ninguno tiene pareja) y una **cuenta de ahorro destino** de 20 «Ahorros…» de Unicaja (Unicaja no exporta el beneficiario).
10. El plan no es parchear `reglasDuras.ts`: es **(1) catálogo nacional por NIF/nombre, (2) cruce entre cuentas propias, (3) mandato SEPA como identificador universal, (4) aprendizaje por contraparte, (5) reglas duras solo para palabras del PROPIO BANCO** (préstamo, cajero, comisión, traspaso), nunca de comercios.

---

## 1 · LOS 9 FICHEROS · qué son y qué sobra

| # | fichero | banco · cuenta | periodo | líneas | veredicto |
|---|---|---|---|---|---|
| 1 | `transactions_2026-09-05T19_04_20.514Z_1.pdf` | Santander · ES54 0049 0052 6221 1043 8676 | 01/25 → 09/26 | 255 | cuenta de **cobro de alquileres** · se barre a 0 tras cada cobro |
| 2 | `listado_movimiento_7.pdf` | Unicaja · ES60 2103 7003 5200 3008 4437 | 01/25 → 09/26 | 387 | cuenta de **recibos de Oviedo** (comunidad, agua, préstamos, seguros, ayuntamiento) |
| 3 | `listado_movimiento_6.pdf` | Unicaja · misma cuenta | 01/25 → 09/26 | 387 | **DUPLICADO EXACTO** de #2 (387/387 líneas idénticas) |
| 4 | `Movimientos_Cuenta_4437_01_01_2025_05___09___2026.xls` | Unicaja · misma cuenta | 01/25 → 09/26 | 387 | **DUPLICADO** de #2 (mismos nº de movimiento) |
| 5 | `Movimientos_Cuenta_4437_01_01_2026_05___09___2026.xls` | Unicaja · misma cuenta | 01/26 → 09/26 | 144 | **SUBCONJUNTO** de #2 (144/144 están en el PDF) |
| 6 | `05092026_2706_0003239635_1.xls` | Sabadell · ES47 0081 2706 1500 0323 9635 | 01/25 → 09/26 | 292 | cuenta de **suministros** (luz/gas de varios pisos) + 2 préstamos + Smartflip · trae **Referencia 1 = NIF del acreedor** y **Referencia 2 = mandato** |
| 7 | `05092026_2706_0003239635.xls` | Sabadell · misma cuenta | 01/25 → 09/26 | 292 | **DUPLICADO EXACTO** de #6 (descargado 18 h antes) |
| 8 | `movements-592026.xls` | ING · 1465 0100 9917 1372 0331 | 06/26 → 09/26 | 51 | hipoteca ING + IBI Sant Fruitós + recargas Revolut · **trae la categoría del propio banco** |
| 9 | `2026Y-09M-05D-01_55_46-_ltimos_movimientos.xlsx` | BBVA · **sin IBAN en el fichero** | 01/25 → 09/26 | 220 | tarjeta 4940…6701, préstamo 0182-5322-27-0830842450, BCF, agua Madrid, efectivo |

**Consecuencia para la app:** 4 de los 9 ficheros son duplicados. El importador tiene que **deduplicar por cuenta + nº de movimiento (Unicaja) o cuenta + fecha + importe + saldo** antes de clasificar nada. En este corpus, sin deduplicar, se contarían 1.210 movimientos dos veces.

### 1.1 · Lo que NO está y hace falta

| falta | evidencia | efecto |
|---|---|---|
| **2ª cuenta Santander** | los 61 «Traspaso:» de Santander (≈ 100 % de los cobros de alquiler) no tienen pareja en NINGUNA de las otras 4 cuentas · los «Abono de nómina · Enviado por banco santander» de BBVA (9) no salen de la cuenta Santander aportada | 70 movimientos se quedan en «traspaso a cuenta propia desconocida» |
| **cuenta de ahorro destino** | 20 de 24 «Ahorro…» de Unicaja (5.000 + 5.000 + 3.650 + 5.000 + 5.000 en ago/sep-26) sin pareja · Unicaja **no exporta el beneficiario** de una transferencia emitida (solo el concepto tecleado) | 24 movimientos en «traspaso a ahorro» sin destino |
| **extractos de tarjeta** | 38 `REC.MCARD` + 14 `ENTREGA CUENTA CRED. TARJ.` (Unicaja) · 26 `Adeudo mensual de tarjeta` + 13 `Traspaso a tarjeta` (BBVA) · 24 `Pago en Revolut**9527*` (ING) | 115 movimientos (9,5 %) son la liquidación de una tarjeta: el gasto real está en otro sitio |

---

## 2 · LA CLASIFICACIÓN DEL 100 % · resultado

Hoja `RESUMEN` del Excel. Sobre los **1.205 movimientos únicos**:

| estado | movimientos | % |
|---|---|---|
| CLASIFICADO (naturaleza + familia, sin nada pendiente) | 250 | 20,7 % |
| CLASIFICADO · con pendiente (familia sí; falta el piso / el préstamo / la póliza concreta, que vive en un store) | 941 | 78,1 % |
| **NO CLASIFICABLE** (solo lo sabe el usuario) | **14** | **1,2 %** |

### 2.1 · Qué se resolvió SOLO con el fichero y qué hubo que ir a buscar fuera

Esto es lo que pedía Jose. Cada línea del Excel lleva su columna `fuente`:

| fuente | movimientos | % | qué significa |
|---|---|---|---|
| **FICHERO** | 400 | 33,2 % | solo con lo que trae el fichero: palabras del propio banco (PRÉSTAMO, CAJERO, TRASPASO, COMISIÓN, NÓMINA…), el signo, el nombre del titular como contraparte, el texto libre (alquiler, fianza, arras, honorarios) |
| **FICHERO + IDENTIFICADOR** | 120 | 10,0 % | idem, más un nº de préstamo / tarjeta / mandato que trae el fichero (la familia sale del fichero; «cuál de los míos» necesita un store) |
| **IDENTIFICADOR** | 83 | 6,9 % | el nº de préstamo lo dice todo (`PRESTAMO 2103-4257-0500106068`, `N.8078782349`, `0182-5322-27-0830842450`) |
| **CRUCE_CUENTAS** (solo o con FICHERO) | 69 | 5,7 % | una salida en una cuenta y la misma entrada en otra de las 9 (±3 días) = traspaso propio, con la cuenta pareja nombrada |
| **FICHERO → STORE:contratos** (la familia sale del texto; el piso necesita el contrato) | 73 | 6,1 % | alquiler de habitación con «alquiler/rent/affitto» pero sin dirección en el texto |
| **RECURRENCIA** | 8 | 0,7 % | el mismo pagador que en otras líneas dice «alquiler» y aquí no dice nada |
| **Subtotal: lo que escala sin catálogo ni conocimiento externo** | **753** | **62,5 %** | |
| **CATÁLOGO_NACIONAL** (solo o combinado) | 428 | 35,5 % | hubo que saber QUÉ ES la entidad: NIF `A95554630` = Iberdrola, `B67686782` = Wekiwi, `B99340564` = Visalia, «Simyo», «Digi», «FCC Aqualia», «Canal Isabel II», «Bip&Drive», «Tuio», «Bankinter Consumer Finance», «Cetelem», «Caser», «NN», «Plan Uni Seguro», «Apple», «PayPal», «Revolut», «Feebbo/Medux», «Smartflip», «abrdn»… **Hoy la app no tiene esto. Lo aporté yo (hoja CATALOGO_NACIONAL: 37 entidades).** |
| **EXTERNO** | 20 | 1,7 % | conocimiento de fuera del fichero y de fuera de un catálogo: que Smart Yield es un préstamo P2P a promotores, que un pago al Ajuntament de Manresa 2 semanas después de vender es la plusvalía, que Sant Joan d'en Coll está en Manresa, que «SOBRANTE CAN PTMO» es lo que sobra al cancelar un préstamo, que «Instant Money» es una retirada sin tarjeta |
| **USUARIO** | 14 | 1,2 % | nadie más que el usuario puede saberlo (§2.4) |

Por fichero: Santander 254/255 (99,6 %) · Unicaja 382/387 (98,7 %) · Sabadell 289/292 (99,0 %) · ING 51/51 (100 %) · BBVA 215/220 (97,7 %).

### 2.2 · Qué se pudo ENTENDER solo con los ficheros (sin ningún store)

Cruzando los 9 ficheros entre sí y leyendo el texto, sin la app, se reconstruye la operativa entera de Jose. Hoja `INMUEBLES (del texto)` y `CUENTAS`:

- **7 inmuebles** deducidos del texto: C/ Tenderina 48 (vendido nov-25), Tenderina 64 4ºD, Tenderina 64 4ºI, Fuertes Acevedo 32 (habitaciones hasta mar-26, Alisser desde abr-26), Pl. La Pau 4 Manresa (vendido 17/03/26), Sant Fruitós de Bages (hipoteca ING), un inmueble en Madrid (agua Canal Isabel II desde BBVA, no identificado).
- **2 ventas** completas, cada una con su cadena: **Tenderina 48**: arras 18.000 (12/11/25) → última cuota préstamo Unicaja 0500230959 (24/11) → cheque 73.251,66 en BBVA (28/11) → honorarios intermediación 2.117,50 (01/12) → sobrante cancelación 403,11 (02/12) → certificado energético, provisión gestoría 121 y su devolución. **Manresa**: reserva 1.000 (Finques Candal, 16/03/26) → arras 5.750 (05/02) → precio 64.005,37 + 62.901,31 (17/03) → cancelación préstamo Santander 0004821 103 por 63.980,04 el mismo día → honoraris 7.260 → plusvalía 1.038,57 al Ajuntament (31/03).
- **8 préstamos** por su nº: Unicaja 0500230959 (407,49 hasta nov-25) y 0500106068 (454,66), Sabadell 8078716546 (304,26; disposición 24.500 el 04/07/25) y 8078782349 (204,91; disposición 16.500 el 15/09/25), BBVA 0182-5322-27-0830842450 (285,40), hipoteca ING (329,97), Bankinter Consumer Finance (351,43 hasta abr-26; cancelado desde Santander el 13/05/26 con 15.000 + 9.750), Cetelem contrato 40070968660905 (cancelado 05/08/26 con 3.255,74).
- **Una posible COMPRA** en jul-25: disposición Sabadell 24.500 el 04/07 → 15.000 a «Manuel Fernández» el mismo día → 2.359,50 a «4A Avenida Servicios Inmobiliarios» el 16/07. El catálogo de la app **no tiene familia para «compra de inmueble»** (es un activo, no un gasto) → NO CLASIFICABLE (§2.4).
- **Una inversión**: 4 × 15.000 a Smartflip (30/12/25 → 05/01/26, una de ellas sin beneficiario en el fichero Sabadell) → 607,50/mes «Pago Intereses Prestamo Smart Yield» desde ene-26 = 12,15 % anual sobre 60.000.
- **25 inquilinos** distintos por nombre, en 4 idiomas (alquiler · rent · affitto · mensualidad), con habitación en el texto en 39 de 132 líneas de alquiler/fianza. Para las otras 93 hace falta el contrato (nombre → habitación).
- **La etiqueta «nómina» de los bancos es mentira en 3 de 4 casos:** BBVA «Abono de nómina · Gomez ramirez jose antonio», Sabadell «NOMINA DE Gomez Ramirez Jose Antonio», Santander «A favor de Jose Antonio Gomez Ramirez Concepto: Nomina» son **el propio titular** moviendo dinero. Solo ING «Nomina recibida» (600/900, sin ordenante) queda en duda. Un motor que confíe en la palabra NÓMINA se equivoca aquí 21 veces.

### 2.3 · Lo que quedó PARCIAL (familia sí, piso/préstamo/póliza no) y qué hace falta

Hoja `PENDIENTES`. Los 941 «con pendiente» se reparten así (un movimiento puede tener uno):

| qué falta | movs | qué hay que construir |
|---|---|---|
| **STORE:cuentas** | 216 | dar de alta TODAS las cuentas propias (incl. la 2ª Santander y la de ahorro). Con ellas, T2/T3/T4 pasan de «cuenta propia desconocida» a «traspaso a X» |
| **STORE:inmuebles/recurrentes** (mandato → piso) | 177 | los recurrentes de cada piso con su **mandato SEPA** (5 mandatos Iberdrola, 6 Wekiwi, 6 Visalia, 3 CCPP, 2 Aqualia). El mandato viene en el fichero (Ref 2 Sabadell, los 12 dígitos de Unicaja) y es el identificador universal del recibo |
| **STORE:tarjetas** + extracto de tarjeta | 115 | las 4 tarjetas (4940…6701, 5402…7016, ****827754, Revolut 9527) para que su liquidación sea «traspaso a tarjeta» |
| **STORE:contratos** (inquilino → habitación) | 111 | un contrato por inquilino. El nombre del ordenante → contrato → piso |
| **STORE:prestamos** (nº → piso, cuadro) | 104 | los 8 préstamos por su nº |
| **STORE:inmuebles** (mandato comunidad/IBI → unidad) | 71 | los 3 CCPP …0900/…1000/…1100 son 3 unidades de C/ Tenderina; 2 emisores de ayuntamiento |
| **FACTURA/CUPS** (Iberdrola luz o gas) | 58 | el banco pone «ELECTRICIDAD» pero la remesa dice «IBERDROLA GAS 10x»; 5 mandatos = 5 contratos. Lo dice la factura, no el extracto |
| STORE:seguros | 42 | 6 pólizas (Plan Uni ×2, NN, «prima seguro» ING, Tuio, Caser) → tipo y piso |
| STORE:inversiones | 13 | Smart Yield (60.000) y abrdn SICAV |
| STORE:ventas | 13 | las 2 ventas para colgar arras + precio + cancelación + plusvalía + honorarios |
| **DESGLOSE** | 8 | «Fianza + 1 mes» en un solo importe = dos hechos en una línea. Hace falta partir líneas |
| USUARIO / extracto PayPal | 7 | el comercio real de PayPal no viene en el banco |
| FICHERO INSUFICIENTE | 6 | Unicaja/Sabadell no exportan el beneficiario de una transferencia emitida |

### 2.4 · Los 14 NO CLASIFICABLES · por qué y qué haría falta

| banco · fecha · importe | concepto | por qué no | qué haría falta |
|---|---|---|---|
| Sabadell 04/07/25 −15.000 | TRANSFERENCIA A Manuel Fernandez | mismo día que la disposición de 24.500 del préstamo; 12 días después, 2.359,50 a una agencia inmobiliaria → huele a **compra de inmueble**, y el catálogo **no tiene familia** para eso | USUARIO + alta de la compra en STORE:inmuebles + una familia «adquisición de activo» en la taxonomía |
| Santander 06/08/26 −5.485,53 | A favor de Concepción Ramirez Guerrero · sin concepto | particular con el mismo apellido, sin concepto | USUARIO (¿familiar? ¿deuda?) → aprender por contraparte |
| Sabadell 22/01/26 −1.490 | TRANSFERENCIA A CB Santa Catalina | «CB» = comunidad de bienes; sin concepto | USUARIO |
| Sabadell −500 · BBVA −1.000 | Eloy Gomez Ramirez | mismos apellidos, sin concepto | USUARIO |
| BBVA 2026 −760 | Luis Eduardo Montes Chalarca | 760 = 2 × 380 (¿devolución de fianza hab 2/3 Fuertes Acevedo?) pero el texto no lo dice | STORE:contratos (si Luis Eduardo fue inquilino, es fianza · devuelve) |
| BBVA −62,35 | Rosa Diaz Zapico | particular, sin concepto | USUARIO |
| BBVA +2.000 | Transferencia recibida · Edu | ¿Eduardo? ¿Eloy? sin concepto | USUARIO |
| BBVA +107,50 | Transferencia recibida · 392673073 | el fichero BBVA solo trae una referencia numérica | fichero insuficiente · detalle de la transferencia |
| Unicaja 25/06/26 +413,09 | FRANCISCO JAVIER RAMOS CALLES | ¿inquilino nuevo? ¿devolución? | STORE:contratos |
| Unicaja 27/05/25 −600 | Regularizaciones | concepto tecleado por el usuario; Unicaja **no exporta el beneficiario** | detalle de la transferencia / IBAN destino |
| Unicaja 17/11/25 −518,75 | Reserva casa | idem · ¿reserva de vivienda? ¿viaje? | idem |
| Unicaja 18/05/26 −800 | Planchas y | idem · ¿reforma? ¿mobiliario? | idem |
| Unicaja 29/12/25 −81,96 | Regularización Tenderina 48 | el piso sí (Tenderina 48, recién vendido); la familia no (¿liquidación con Alisser? ¿suministro?) | detalle de la transferencia |
| Sabadell 31/12/25 −15.000 | TRANSFERENCIA 212128856 | Sabadell no trae el beneficiario. Está entre las 3 de Smartflip (30/12, 02/01, 05/01) y 4 × 15.000 cuadran con el 12,15 % · clasificado como «aportación · inversión (probable)» con confianza BAJA | USUARIO confirmar |

**Patrón común:** 13 de 14 son **transferencias a/de particulares o sin beneficiario**. Ningún catálogo ni keyword las resolverá jamás. Lo único que escala es que la app **pregunte una vez por contraparte** («¿qué es Eloy Gómez Ramírez?») y lo **aprenda por contraparte** (no por texto normalizado, que aquí es vacío).

---

## 3 · LAS REGLAS DE CLASIFICACIÓN PROPUESTAS · un motor en capas

Hoja `REGLAS`. Principio: **de lo más universal a lo más dependiente del cliente, y nunca una keyword de comercio.** Las reglas de texto solo miran palabras que escribe **el propio banco** (préstamo, cajero, traspaso, comisión, remuneración, adeudo, recibo) o **el propio usuario** (alquiler, fianza, arras, ahorro). Qué es Iberdrola, Wekiwi o WiZink lo dice un **catálogo**, no una regla.

| capa | reglas | qué mira | fuente | movs |
|---|---|---|---|---|
| **1 · Traspasos propios** | T1 cruce entre cuentas · T2 «Traspaso» del banco · T3 contraparte = titular · T4 «Ahorro» del usuario · T5 «Enviado por Banco Santander» · N1 nómina | el nombre del titular en todas sus grafías; salida = entrada en otra cuenta ±3 días (nunca sobre cajeros/recibos/alquileres); la palabra del banco | FICHERO / CRUCE | 300 |
| **2 · Efectivo y tarjetas propias** | E1 cajero · E2 comisión cajero · E3 liquidación/recarga de tarjeta | palabras del banco + nº de tarjeta | FICHERO + ID | 141 |
| **3 · Préstamos** | P1 disposición · P2 sobrante cancelación · P3 cancelación anticipada · P4 comisión · P5 cuota por nº · P6 financiera por catálogo | PRÉSTAMO/HIPOTECA + nº; ABONO DISPOSICIÓN; la financiera en el catálogo | ID / CATÁLOGO | 105 |
| **4 · Proveedor por catálogo** | C1 | NIF (Ref 1 Sabadell) o nombre del acreedor (Unicaja `Simyo 633782-…`, BBVA `N <nº> <NOMBRE>`) → catálogo → familia/subtipo; el **mandato** distingue contratos del mismo proveedor | CATÁLOGO + ID | 379 |
| **5 · Palabras del propio banco** | B0-B5 | remuneración, intereses/comisiones, bonificación, liquidación de contrato, céntimos de verificación, «cargo prima seguro» | FICHERO | 47 |
| **6 · Comunidad y ayuntamiento** | K1 · K2 | CCPP/CDAD/CP + mandato · AYUNTAMIEN/Ajuntament/AJ. | FICHERO + ID | 71 |
| **7 · Inmobiliario por texto** | I0-I4 fianzas · V1-V2 venta · G1 gestión · A1-A5 alquiler | fianza/depósito/cauzionale/deposit · arras/reserva/precio · honorarios/abogado/certificado · alquiler/rent/affitto/mensualidad/mes/habitación/piso · recurrencia del pagador | FICHERO (+STORE:contratos para el piso) | 141 |
| **8 · Inversiones** | X1-X4 | Smartflip, abrdn, aportación de capital, Feebbo | CATÁLOGO + EXTERNO | 19 |
| **9 · Resto** | Z1 | transferencia a/de particular sin concepto útil o sin beneficiario | USUARIO | 14 |

**Reglas de signo** (heredadas de la app, correctas): una familia de gasto en positivo es la devolución de esa familia (FCC Aqualia +1.562,88 = devolución de agua · Curenergía +242,15 = devolución de luz · Caser +234,17 = extorno de seguro · Unicaja Tramitaciones +121 = devolución de gestoría · «INTERESES Y/O COMISIONES» +231,20 = extorno de la comisión del 24/03).

**Lo que este motor NO hace y la app tampoco debería:** no tiene «CARREFOUR», «MERCADONA», «IBERDROLA» como keywords. Iberdrola entra por su NIF `A95554630` (Ref 1) o por su nombre en el catálogo; si mañana un cliente tiene Endesa, entra igual por su NIF sin tocar código.

---

## 4 · EL CATÁLOGO NACIONAL QUE HIZO FALTA (y que no existe)

Hoja `CATALOGO_NACIONAL`: **37 entidades**, cada una con: NIF (si el fichero lo traía) o patrón de nombre, proveedor, familia, subtipo, ámbito sugerido, y **qué tuve que saber que no estaba en el fichero**. Extracto:

| clave en el fichero | proveedor | familia · subtipo | movs | de dónde lo sé |
|---|---|---|---|---|
| NIF `A95554630` (Ref 1) | Iberdrola Comercialización de Último Recurso | suministro · luz (media: la remesa dice «GAS») | 58 | catálogo NIF |
| NIF `B67686782` | Wekiwi SL | suministro · luz | 71 | catálogo NIF |
| NIF `B99340564` | Doméstica Energía (Visalia) | suministro · gas | 41 | catálogo NIF |
| NIF `B98717457` | Gana Energía | suministro · luz/gas (lo dice el texto) | 9 | catálogo NIF |
| NIF `A65067332` | Comercializadora Regulada Gas & Power | suministro · gas | 4 | catálogo NIF |
| `Simyo 633782-…` · `Adeudo simyo` | Simyo | suministro · telefonía | 57 | catálogo nombre |
| `DIGI SPAIN400245-…` | Digi | suministro · internet | 18 | catálogo nombre |
| `FCC AQUALI447497-…` | FCC Aqualia (agua Oviedo) | suministro · agua | 21 | catálogo nombre |
| `Adeudo de canal isabel ii` | Canal de Isabel II | suministro · agua (Madrid) | 11 | catálogo nombre |
| `Adeudo bip drive` | Bip&Drive | transporte · peajes | 12 | catálogo nombre |
| `Adeudo gc re tuio` | Tuio | seguros · hogar | 14 | catálogo nombre |
| `Adeudo bankinter consumer finance` | Bankinter Consumer Finance | préstamo (consumo) | 19 | catálogo nombre · **hoy la app no la conoce** |
| `Banco Cetelem … Contrato 40070968660905` | Cetelem | préstamo (consumo) | 1 | catálogo nombre · **idem** |
| `CUOTA <MES> PLAN UNI SEGUR` | Unicaja Plan Uni Seguro | seguros | 31 | catálogo nombre |
| `Smartflip … Smart Yield` | Smartflip (P2P promotores) | rendimiento · interés / aportación · inversión | 12 | catálogo + externo |
| `FEEBBO … PAGO MEDUX` | Feebbo (panel Medux) | otros ingresos | 4 | catálogo + externo |

Esto es E2.6. **Con esta tabla y sin tocar `reglasDuras.ts`, 428 movimientos (35,5 %) se resuelven**, y la tabla vale para los 1.000 clientes: el NIF de Wekiwi es el mismo para todos.

---

## 5 · LAS 5 PREGUNTAS · con fichero:línea

Todo verificado leyendo el código real de `602a9b6` (tres agentes de auditoría en paralelo; medición ejecutada con jest sobre el corpus).

### P1 · ¿El cruce con STORES funciona de verdad, o llega vacío?

**Quién construye el `ContextoClasificacion`:** hay **un solo call-site** de producción, y **no es `montarSesion.ts`**.

| fichero:línea | qué hace |
|---|---|
| `src/services/clasificacion/clasificarLinea.ts:276` | el motor puro `clasificarLinea(m, ctx)` |
| `src/services/clasificacion/clasificarLote.ts:72` | **único llamador** · monta el ctx por línea |
| `src/services/bankStatementOrchestrator.ts:351` | **único llamador** de `clasificarLineas`, dentro de `analizarLineas` |
| `src/services/bankStatementOrchestrator.ts:291` · `src/services/reabrirLote.ts:39` | import de fichero / retomar lote → `analizarLineas` |
| `src/modules/tesoreria/v6/DrawerExtracto.tsx:291` · `:324` | la pantalla de conciliar |
| `src/modules/tesoreria/v6/montarSesion.ts:111` | **no construye contexto ni llama al motor**: lee la clasificación ya persistida en `lineasExtracto.clasificacion` |

**Qué stores entran:** el contexto directo (`clasificarLinea.ts:51-64`) solo lleva `cuentas`, `tarjetas`, `nombresTitular`, leídos en `clasificarLote.ts:45-50` de `accounts`, `tarjetas`, `personalData`. **Préstamos, contratos, recurrentes e inversiones NO van ahí**: entran ya digeridos por `sugerencias`/`origen`/`atribucion`, que calcula antes `analizarLineas` (`bankStatementOrchestrator.ts:329-341`) llamando a `suggestForLineas` (`movementSuggestionService.ts:113`, lee `compromisosRecurrentes` `:189`, `movementLearningRules` `:269-276`, `contracts` `:201`) y `reconocerDeterministasDeLineas` (`matcheoDeterminista.ts:134` → `:71-83` lee 10 stores: `prestamos`, `property_sales`, `inversiones`, `ingresos`, `ejerciciosFiscalesCoord`, `properties`, `compromisosRecurrentes`, `contracts`, `accounts`, `personalData`).

**Veredicto: no llega vacío por construcción. Está cableado. Pero:**

- **(a) Las líneas que casan con una previsión pierden los pasos 1 y 2.** `bankStatementOrchestrator.ts:329-351`: `suggestForLineas` y `reconocerDeterministasDeLineas` se llaman solo sobre `sinCasar` (`:333`, `:336`) pero `clasificarLineas` sobre `entran` (`:351`). Para una línea que casó, `clasificarLote.ts:73-75` mete `sugerencias/origen/atribucion = undefined` → `aprendida()` (`clasificarLinea.ts:159-162`) e `identificador()` (`:240-250`) devuelven vacío.
- **(b) El store `proveedores` no lo cruza nadie.** Existe (`src/services/db/upgrade-a.ts:115-116`, keyPath `nif`; `db.ts:103`) y solo lo leen `proveedorService.ts:19`, `declaracionDistributorService.ts:2093-2114`, `agenciaGestionService.ts:19`. **Cero lecturas desde clasificación.** El NIF solo se cruza contra `compromisosRecurrentes.proveedor.nif` (`reconocerRecurrente.ts:97`).
- **(c) Sin stores del cliente, todo cae a `reglasDuras`.** Si no hay recurrentes activos, ni contratos, ni préstamos, ni reglas aprendidas, los pasos 1, 2 y 4 devuelven vacío y solo clasifica el paso 3 (`clasificarLinea.ts:295` → `porConcepto`). **Esa es la situación real de una instalación nueva y de un banco nuevo.**
- **(d) Silencio en los fallos:** `clasificarLote.ts:37-44` y `matcheoDeterminista.ts:62-69` devuelven `[]` con `console.warn`; `analizarLineas:354-357` captura todo y devuelve `new Map()`.

**¿Cruzan por identificador o solo contra previsiones del mes?** Por identificador, de verdad: `reconocerRecurrente.ts:78-100` compara CUPS (`:89-90`), nº contrato (`:93-94`) y NIF (`:97`) normalizados; `deterministas/recurrentes.ts:96-127` lo aplica sobre todo el histórico sin previsión; `deterministas/cuotasDePrestamo.ts:27-35` casa el nº de contrato con el cuadro (±5 días, `:33`); `deterministas/rentas.ts:39-56` casa contra el contrato. `matcheoDeterminista.ts:7-12`: *«Ninguna depende de que exista una previsión»*. La premisa «solo contra previsiones» es **falsa**. **No es código muerto**: `bankStatementOrchestrator.ts:38-39` importa y `:333`/`:336` llama a ambos; el resultado llega a la pantalla nueva (`extractoSesion.ts:273` → `conciliar/agruparPorEntidad.ts:108-131` → `PanelConciliar.tsx:145`).

### P2 · ¿Qué % clasifica SIN reglas duras? · **0,0 %**

Medido con jest sobre 1.078 líneas reales (Santander PDF, Sabadell XLS, Unicaja PDF, Unicaja XLS), criterio `estaClasificada()` de `clasificada.ts:23`. No hay flag para desactivar reglas duras (`clasificarLinea.ts:45` importa `porConcepto` en duro); se anuló con `jest.mock`.

| pasada | clasificadas | % |
|---|---|---|
| (a) con todo · contexto vacío (= producción sin stores, verificado con fake-indexeddb sin sembrar: mismo número) | 630 / 1.078 | **58,4 %** |
| (b) **sin reglas duras** · contexto vacío | **0 / 1.078** | **0,0 %** |
| (c) solo `porConcepto()` | 630 / 1.078 | 58,4 % (= a: el 100 % de lo clasificado sale de reglas duras) |
| (d1) stores: 3 cuentas + titular | 770 / 1.078 | 71,4 % (+140, casi todo `traspasosPropios.ts:178`) |
| (d2) d1 + 1 préstamo (0500106068, cuadro) + 1 recurrente (Iberdrola por NIF) | 770 / 1.078 | 71,4 % (**+0**: las cuotas y los Iberdrola ya los cogía la regla dura; solo cambia el `origen` a identificador y añade `inmuebleId`) |

Por fichero (a): Santander 40,4 % · Sabadell 83,6 % · Unicaja PDF 52,2 % · Unicaja XLS 56,3 %.

**Errores de acierto vistos en (a)** (la métrica anterior es cobertura, no acierto): 58 × Iberdrola → `suministro/gas` (la lista `SUMINISTRO_GAS` con la palabra suelta `GAS`, `reglasDuras.ts:91`, se evalúa antes que luz, `:266` vs `:267`) · «TRANSFERENCIA A CB Santa Catalina» → `seguros_alarmas/decesos` (prefijo ≥5 letras: «SANTA» casa «SANTALUCIA», `deterministas/texto.ts:44-48`) · la venta de Manresa +62.901,31 → `gasto/comunidad` por «FINCAS» y método `tarjeta` por «COMPRAVENTA» ≈ «COMPRA» · reserva de la venta +1.000 → devolución de comunidad. **El enfoque está invertido: 58 % keywords, 0 % cruce.**

### P3 · ¿Existe el CATÁLOGO NACIONAL? · **NO**

No existe `catalogoProveedores`, `catalogoNacional` ni `proveedoresConocidos`. El propio repo lo reconoce como deuda: `docs/VERIFICACION-E2-preflight-estado-motor-2026-09-05.md:468` («E2.6 · catálogo nacional … absorba las 5 listas»), `docs/AUDIT-stores-motor-matcheo-2026-08-30.md:849` («Nunca se ha leído desde el matcheo»), `reglasDuras.ts:117-119` («hasta que exista el catálogo de proveedores (E2.6)»).

Lo que hay son **6 listas desconectadas**:

| fichero:línea | qué | ¿NIF? | ¿la usa clasificación? |
|---|---|---|---|
| `src/services/clasificacion/reglasDuras.ts:50-129` | 57 listas · **323 keywords** · 63 reglas (`:163-313`) | no | **SÍ** (el motor) |
| `src/services/compromisoDetectionService.ts:41-79` | 37 marcas | no | no |
| `src/services/aeatClassificationService.ts:30-55` | 18 marcas | no | no |
| `src/services/documentAutoClassifyService.ts:73-105` | 20 regex | no | no |
| `src/services/providerDirectoryService.ts:118-154` | **7 proveedores con NIF** en `localStorage` (`:17,:42,:67,:79`) | sí | no (solo `ocrService.ts:252`) |
| `src/services/ocrService.ts:43-51` | 7 alias | no | no |

**El único NIF de Iberdrola en el código está mal para el fichero real:** `providerDirectoryService.ts:151` dice `A95075578`; el extracto de Sabadell trae `A95554630` (`src/features/inbox/importers/__fixtures__/sabadell-fixture.csv:6`). Nunca casarían. `B99340564` (Visalia) solo existe en el fixture. WiZink, Cetelem, BCF no están en ninguna lista.

**El store `proveedores`:** esquema en `src/services/db/types-inmuebles.ts:588-600` (`nif`, `nombre?`, `tipos: string[]` = categorías AEAT, `sinNombre?`). **No tiene `familia` ni `subtipo`.** Lo escribe la importación del IRPF (`declaracionDistributorService.ts:2093-2114`, placeholders `sinNombre:true`), el alta de agencia (`agenciaGestionService.ts:32`) y la pantalla `ProveedoresPage.tsx:198`. Las facturas OCR **no** escriben en él (`saveProvider` de `providerDirectoryService` no se llama desde ningún sitio). **Nadie lo lee desde `clasificarLinea.ts` (imports en `:31-46`).**

**La taxonomía SÍ está bien:** `src/services/catalogo/catalogoUnico.ts:210-540`, 34 familias / 89 subtipos, 4 ejes independientes, fiscalidad fuera. No existe «subfamilia» en el código (0 resultados): el término del producto es **familia + subtipo**. Es el activo más sólido de esta zona.

### P4 · ¿El APRENDIZAJE cierra el hueco? · **en parte**

**Se guarda:** clasificar en la ficha → `DrawerExtracto.tsx:537` → `altaMovimientoService.ts:512-520` `feedLearningRule` (sobre el texto original del banco, bien) → `aplicarSugerencia.ts:69-94` → `movementLearningService.ts:390-518` `createOrUpdateRule` → store `movementLearningRules` (`:488` / `:514`).

**Se lee en el siguiente extracto:** paso 1 del motor (`clasificarLinea.ts:159-162`) consume `via === 'learning_rule'`, que produce `movementSuggestionService.ts:250-289` (índice por `learnKey`) → `:314-362`. Tres candados: clave exacta, `reglaEncaja` (`movementLearningService.ts:280-294`), `respetandoElSigno` (`movementSuggestionService.ts:174-180`).

**Intra-lote:** sí, `clasificacion/aprendizajeEnLote.ts:60-77` + `tesoreria/v6/aprendizajeEnSesion.ts:63-96`, con **tope de 3** (`:45`) y pregunta por encima (`AvisoArrastre.tsx`). Disparo en `DrawerExtracto.tsx:558`.

**Lo que NO cierra:**
1. **Un concepto de una sola palabra no se aprende nunca**, en silencio: `extractNGrams` (`movementLearningService.ts:82`) necesita dos palabras; `buildLearnKey` (`:215-218`) devuelve `null`; `aplicarSugerencia.ts:81` aborta sin avisar. «WIZINK 12345» → `wizink` → sin clave → **no se crea regla**. Con «RECIBO WIZINK 12345» sí (el número se va como volátil, `:60`).
2. **Sin familia no se aprende** (`altaMovimientoService.ts:512`): marcar solo ámbito o piso no enseña nada.
3. **La regla es global a la instalación.** Grep de `clienteId|clientId|tenantId|userId` en `db.ts` y `db/`: **0 resultados**. La app es mono-usuario; «por cliente» y «global» son lo mismo hoy. Si algún día hay varios clientes en una base, todas las claves colisionan.
4. Las líneas que casaron con previsión no pasan por el sugeridor (P1.a): la regla aprendida no les llega.
5. **La clave es por texto normalizado, no por contraparte.** Por eso 13 de los 14 no clasificables de §2.4 (transferencias a particulares sin concepto) **no se aprenderían nunca**: su texto normalizado es solo el nombre.

### P5 · ¿El extractor de IDENTIFICADORES es bueno? · **7/10, cojea donde más importa**

`src/services/identificadoresDelConcepto.ts` (283 líneas): CUPS `:112`, IBAN `:115` (mód-97 `:89-98`), NIF/CIF/NIE `:121` (letra DNI `:58-66`, control CIF `:69-86`, sufijo SEPA `(?:\d{3})?`), contrato tras etiqueta `:131-163`, contrato forma-cuenta `:170`, tarjeta `:173`. Enmascarado progresivo (`tapar`, `:176-178`). Lee `description + counterparty + reference` (`:272-283`); `bankParser.ts:585-592` y `:747-751` concatenan Referencia 1/2/3 con « · »; `columnaDeReferencia.ts:41-44` tiene los alias. **Esa parte está bien.**

Traza sobre los conceptos reales de estos ficheros:

| concepto | resultado |
|---|---|
| `PRESTAMO 2103-7003-0500230959` | ✅ contrato, **por accidente**: la etiqueta falla (el guion no está en `^[A-Z0-9]{3,}$`, `:145`) y lo salva `CONTRATO_FORMA_CUENTA` (`:170`) |
| `FCC AQUALI447497-874010012213` · `Simyo 633782-822070552003` · `CP TENDERI016B9V-004300001200` | ❌ **nada**. El patrón Unicaja `EMISOR123456-MANDATO12dígitos` (**131 movimientos de este corpus**) no da ancla |
| `PRESTAMOS ADEUDO CUOTA N.8078782349 31/08/26` | ✅ contrato |
| `Cetelem … 43508951n - Contrato 40070968660905` | ✅ contrato + ⚠️ `nif:43508951N` = **el DNI del propio pagador**, que `buildLearnKey` (`movementLearningService.ts:236-243`) usa como ancla de agrupación |
| `Bankinter … H3498890 - 53069494f - Cancelación Préstamo (1)` | ⚠️ solo el DNI del pagador; `H3498890` se pierde (solo mira hacia delante desde la etiqueta, `:132`) |
| Sabadell Ref 1 `A95554630001` · Ref 2 `207136614000` | ⚠️ solo `nif:A95554630`. **La Ref 2 (el mandato que dice de qué piso es el recibo) se pierde**: 12 dígitos desnudos no casan con nada. El propio código lo prometía (`columnaDeReferencia.ts:41-43`). Con 5 mandatos de Iberdrola en este corpus, es justo el dato que distingue los pisos |

Tests: `src/services/__tests__/identificadoresDelConcepto.test.ts` (21 casos, buenos, de ficheros reales) — **ninguno con guion tras etiqueta ni con la Ref 2 real**. Fixtures: 6 en `src/features/inbox/importers/__fixtures__/` (Abanca ~48, Sabadell 10, Santander ~9, Unicaja ~8, ING ~5, Revolut 5); **no hay fixture de Bankinter**.

---

## 6 · EL VEREDICTO HONESTO

**NO escala.** Con números:

- Motor actual sin stores: **58,4 % por keywords, 0 % por cruce**. El «castillo de keywords» de la pregunta es exactamente lo que hay.
- El cruce con stores funciona técnicamente, pero **depende de que el cliente haya dado de alta antes** cuentas, préstamos, contratos y recurrentes con su identificador. Un banco nuevo, un cliente nuevo o un mes nuevo con un proveedor nuevo → `reglasDuras` o «¿qué es?».
- Lo universal que **sí trae el fichero** (NIF en Sabadell, mandato SEPA en Sabadell/Unicaja/BBVA, nº de préstamo, nº de tarjeta, nombre del acreedor) **se extrae a medias y no se cruza con ningún catálogo**.
- El aprendizaje es por texto, no por contraparte: no resuelve ni las transferencias a particulares ni los conceptos de una palabra.

**Lo que sí escala (demostrado sobre este corpus):** un motor en capas sin keywords de comercio clasifica el **98,8 %**, del que el **62,5 % sale solo del fichero + cruce entre cuentas**, y el **35,5 % de un catálogo NIF/nombre → proveedor** que vale para todos los clientes. **145 entidades** cubren los 1.205 movimientos; **57 decisiones del cliente cubren el 90 %**.

---

## 7 · EL PLAN PARA QUE ESCALE · arquitectura, en orden

No son parches. Es cambiar en qué se apoya el motor. Cada punto dice qué construir y qué % del corpus mueve.

### 7.1 · Deduplicar y cruzar cuentas propias (mueve 300 movs · 25 %)
- Deduplicar al importar por cuenta + nº mov (Unicaja) o cuenta + fecha + importe + saldo. Hoy 4 de 9 ficheros son duplicados.
- **Cruce entre cuentas propias**: salida = entrada en otra cuenta ±3 días con una de las dos «oliendo» a traspaso (titular, ahorro, traspaso, enviado por) y nunca sobre recibos/cajeros/alquileres. Hoy `traspasosPropios.ts` solo mira el nombre del titular; con el cruce, además se **nombra la cuenta pareja** y se detectan **las cuentas que faltan** (aquí: la 2ª Santander y la de ahorro).
- La etiqueta «nómina» del banco **nunca** decide sola: si el ordenante es el titular, es traspaso (21 casos en este corpus).

### 7.2 · El mandato SEPA como identificador universal (mueve 250 movs · 21 %)
- Extraer en `identificadoresDelConcepto.ts`: (a) la Referencia 2 de Sabadell aunque sean 12 dígitos desnudos; (b) el patrón Unicaja `EMISOR######-############` → emisor + mandato; (c) el `N 2026176000297555` de BBVA como nº de adeudo (volátil) + el nombre del acreedor que va detrás; (d) permitir guiones tras etiqueta (`:145`).
- Un recurrente = un mandato. Con el mandato, **dos pisos con Iberdrola se distinguen solos** (5 mandatos aquí), y «cuál de mis 3 comunidades» también.

### 7.3 · El catálogo nacional NIF/nombre → proveedor → familia (mueve 428 movs · 36 %)
- Una tabla compartida (no por cliente), clave NIF y alias de nombre, valor familia + subtipo + ámbito sugerido. Semilla: la hoja `CATALOGO_NACIONAL` de este entregable (37 entidades) + las 6 listas actuales absorbidas + los 7 NIF de `providerDirectoryService` corregidos.
- Se cruza en el paso 2 del motor (identificador) **antes** que cualquier regla de texto: el NIF `A95554630` de la Ref 1, o el nombre del acreedor extraído del recibo.
- Que crezca sola: cada vez que un cliente clasifica un NIF/nombre desconocido, la respuesta va al catálogo (con recuento de confirmaciones). WiZink lo enseña el primer cliente que lo tenga y lo heredan los 999 restantes. **Eso es lo que hace que «nadie tenga que añadir WIZINK a una lista».**
- Leer también `proveedores` (IRPF) por NIF; añadirle `familia`/`subtipo`.

### 7.4 · Aprendizaje por CONTRAPARTE, no solo por texto (mueve los 14 no clasificables + 111 de contratos)
- Clave alternativa: **contraparte normalizada** (nombre del ordenante/beneficiario, o IBAN si el banco lo da). «Eloy Gómez Ramírez» = X se aprende una vez aunque el concepto esté vacío o sea de una palabra.
- Un inquilino = una contraparte = un contrato: el nombre → contrato → habitación → piso. Aquí 93 de 132 líneas de alquiler/fianza necesitan eso.
- Aprender también sin familia (solo ámbito/piso) y avisar cuando no se puede crear clave (`aplicarSugerencia.ts:81` hoy calla).
- Preparar la clave para multi-cliente (un `clienteId` en `movementLearningRules`) aunque hoy sea una sola instalación.

### 7.5 · Reglas duras SOLO de palabras del propio banco (queda ~10 %)
- Dejar en `reglasDuras.ts` únicamente lo que escribe el banco y es universal: PRÉSTAMO/HIPOTECA + nº, ABONO DISPOSICIÓN, CAJERO/RETIRADA/REINTEGRO, TRASPASO, COMISIÓN, REMUNERACIÓN, LIQUIDACIÓN DE TARJETA, ADEUDO/RECIBO (método), y lo que escribe el usuario en inmobiliario (ALQUILER/RENT/AFFITTO, FIANZA/DEPÓSITO, ARRAS, HONORARIOS, CCPP/CDAD/COMUNIDAD, AYUNTAMIENTO/AJUNTAMENT).
- **Sacar** los comercios (MERCADONA, CARREFOUR, IBERDROLA…) al catálogo. Arreglar de paso: `GAS` suelto antes que luz (`:91`, `:266-267`), «SANTA» ≈ «SANTALUCIA» (prefijo ≥5), «COMPRAVENTA» ≈ «COMPRA», «FINCAS» → comunidad.

### 7.6 · Desglose de líneas y familias que faltan (queda residual)
- Poder partir una línea en dos hechos (fianza + mes: 8 casos).
- Taxonomía: **no hay «adquisición de activo»** (compra de inmueble, compra de vehículo): Minoautos 12.240 y el posible piso de jul-25 no caben. Son activos, no gastos.
- ING trae categoría del banco: usarla como **pista** de baja prioridad, nunca como decisión (ING dice «Otros gastos · Transferencias» para las 24 recargas de Revolut).

**Orden:** 7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6. Los tres primeros no necesitan nada del cliente y ya mueven el 82 % de este corpus.

---

## 8 · EL CASO BANKINTER · «RECIB FINANCIERA CARREFOUR» y WiZink, sin que nadie añada «WIZINK» a una lista

**Por qué FINANCIERA CARREFOUR fue a Supermercado:** `reglasDuras.ts:107` tiene `CARREFOUR` en `SUPERMERCADO` y la regla `:295` casa por palabra entera. No hay ningún paso anterior que sepa qué es «Financiera Carrefour» (no está en `providerDirectoryService`, no hay catálogo, no hay recurrente con su NIF porque es la primera vez). El texto ganó porque no había nada más.

**Por qué no se resolvió por identificador/store/proveedor:** (1) el extracto de Bankinter no trae el NIF en una columna (no es Sabadell); (2) aunque lo trajera, no hay tabla NIF → proveedor donde mirar; (3) el store `proveedores` no se lee; (4) no había recurrente dado de alta con ese acreedor; (5) la primera vez, no hay regla aprendida.

**Qué haría falta para que CUALQUIER cliente lo resuelva sin tocar código:**
1. Extraer el **nombre del acreedor** del recibo (en Bankinter: «RECIB FINANCIERA CARREFOUR» → «FINANCIERA CARREFOUR»; en BBVA: `N 2026007000428401 BANKINTER CONSUMER FINANCE` → el nombre tras el nº) y, cuando haya, el NIF/mandato.
2. Cruzar nombre/NIF contra el **catálogo nacional** (7.3): «Financiera Carrefour» → Servicios Financieros Carrefour EFC → `prestamo_hipoteca` (consumo). «WiZink» → WiZink Bank → idem. «Cetelem» → Banco Cetelem → idem. «Bankinter Consumer Finance» → idem. (Los NIF se cargan en el catálogo desde el registro oficial; no los pongo de memoria.)
3. Si el catálogo no lo conoce: **preguntar UNA vez** y guardar la respuesta (a) como regla aprendida **por contraparte** para ese cliente y (b) como propuesta al catálogo compartido. El segundo cliente con WiZink ya no pregunta.
4. `reglasDuras` no debe poder decidir «Supermercado» sobre un **recibo domiciliado de una financiera**: el método (RECIB = domiciliación) y la forma (acreedor con «FINANCIERA»/«BANK»/«FINANCE»/«CREDIT») son señales universales que van antes que un nombre de comercio.

En este corpus, exactamente eso resuelve los 19 de Bankinter Consumer Finance y el de Cetelem (**hoy: 0 reconocidos por identidad; con reglas duras: BCF cae en `prestamo_hipoteca` solo porque el texto dice «Cancelación Préstamo» en 2 de 19**).

---

## 9 · HALLAZGOS COLATERALES (no pedidos, relevantes)

1. 🔴 **Datos bancarios personales reales versionados en la raíz del repo:** `03092025_2706_0003239635 (1).xlsx`, `Movimientos_Cuenta_4437_03 _ 08 _ 2025_03 _ 09 _ 2025 (1).xlsx`, `export202593 (1).xlsx`, `movements-392025.xlsx`, `movements-392025.csv` (nombre completo, IBAN, inquilinos). Decisión de Jose; conviene saberlo. Este entregable también contiene datos reales por petición expresa.
2. 🟠 `BANK_PROFILES.md` desactualizado: solo Santander con 5 columnas; no documenta Referencia 1/2 ni `reference2/3`.
3. 🟠 `providerDirectoryService` vive en `localStorage`: no entra en backup ni migración.
4. 🟡 Los tres `console.warn` silenciosos (P1.d): una base a medias degrada a «sin clasificar» sin decirlo.
5. 🟡 El motor extrae el identificador (`clasificarLinea.ts:206`) pero no lo persiste; `agruparPorEntidad.ts:63-70` lo vuelve a extraer del texto. Trabajo duplicado.
6. 🟡 BBVA no exporta el IBAN en «Últimos movimientos»; la cuenta hay que identificarla por la tarjeta/préstamo o pedirla al usuario.

---

## 10 · CÓMO SE HA HECHO (para reproducir)

- Parseo: `parse.py` (pdfplumber para los PDF, xlrd/openpyxl para XLS/XLSX). Validación: el saldo de cada línea = saldo anterior + importe, en los 9 ficheros, 0 roturas.
- Motor propuesto: `motor-propuesto.py` → `clasificacion.csv` → `clasificacion-9-ficheros.xlsx`.
- Medición del motor actual: `medicion-Q2/` (tests jest temporales, ejecutados con `npm ci` en el repo y borrados; `run.log` con la salida literal; `resultado_*.json` por pasada).
- Auditoría de código: tres lecturas independientes del repo en `602a9b6` (contexto/aprendizaje · catálogo/identificadores · medición), cruzadas entre sí.
