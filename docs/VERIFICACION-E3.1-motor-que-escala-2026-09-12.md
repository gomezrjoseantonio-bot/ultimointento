# E3.1 · EL MOTOR QUE ESCALA · preflight + verificación

**Fecha:** 12 sep 2026 · **Base:** `AUDITORIA-motor-clasificacion` §7 (§7.1 + §7.2 + §7.3)
**Corpus de medida:** `atlas-snapshot-actual-5sep.json` (1.341 líneas de extracto reales,
9 cuentas, 45 recurrentes, 10 préstamos, 13 proveedores). **NO** se ha medido en frío.

---

## 0 · El número, primero

Medido con `scripts/medir-motor.mjs` sobre las 1.341 líneas reales, con el contexto real
del usuario (sus cuentas, su nombre, sus préstamos, sus recurrentes, su catálogo):

| | antes (HEAD `5d79651`) | después (E3.1) |
|---|---|---|
| **SIN reglas duras · SOLO cruce + identificador + catálogo** | **21,5 %** (288/1.341) | **32,0 %** (429/1.341) |
| Sin reglas duras · + préstamos y recurrentes (lo que ATLAS ya sabía) | 22,8 % (306/1.341) | 32,0 % (429/1.341) |
| CON reglas duras · el motor entero | 57,9 % (776/1.341) | **63,0 %** (845/1.341) |

La primera fila es la de §7 y es la que cuenta: nada de reglas de texto y nada de
los libros del usuario. La segunda está por honestidad — la primera medida que
hice mezclaba las dos cosas (lo pilló la revisión de Copilot) y el guion ahora
las separa. La conclusión no cambia; el punto de partida era medio punto más bajo.

**El objetivo de la tarea era >60 % sin reglas duras. No se alcanza: se llega al 32,0 %.**
No lo tapo. Las razones están medidas, no supuestas, y son tres (§6).

Dos correcciones a la auditoría, con la medida delante:

- **El «0 % de cruce» de la auditoría estaba viciado**, como decías. Medido contra el
  snapshot real, HEAD **ya reconocía 288 traspasos propios** (21,5 %) por el nombre del
  titular. El 0 % era de medir con contexto vacío.
- **El «58 % de keywords» sí era exacto**: 57,9 % medido.

---

## 1 · PREFLIGHT · los 6 greps, con fichero:línea

| # | Qué | Dónde | Veredicto |
|---|---|---|---|
| 1 | §P1.a · las líneas que casan con previsión pierden pasos 1-2 | `bankStatementOrchestrator.ts:329-351` | **CONFIRMADO** · `suggestForLineas(sinCasar)` y `reconocerDeterministasDeLineas(sinCasar)` corrían solo sobre lo NO casado, y `clasificarLineas(entran, …)` recibía TODAS. Las 11 de 14 que cuadraban llegaban al motor sin su señal más fuerte. **Arreglado**: los dos pasos corren sobre `entran`. |
| 2 | Dónde añadir mandato Sabadell/Unicaja/BBVA y guiones | `identificadoresDelConcepto.ts:146-185` (`CONTRATO_ETIQUETADO`, `PREFIJO_NUMERO`, `numeroTrasEtiqueta`) | Ahí mismo. `PREFIJO_NUMERO` no admitía `-` y `vale` exigía `^[A-Z0-9]{3,}$`, así que `PRESTAMO 2103-7003-…` se caía. |
| 3 | Dónde crear el catálogo y cómo cruzarlo | el store que YA existe, `proveedores` (keyPath `nif`) + `services/catalogoNacional/` · se cruza en `clasificarLinea.identificador()` (paso 2) | Primero creé un store aparte (`catalogoProveedores`, V95) y **estaba de más**: lo retira V96. `proveedores` ya está indexado por NIF, que es justo la clave del catálogo. |
| 4 | Dónde añadir el cruce de patas | `traspasosPropios.ts` · `espejoDe()` ya existía pero **solo se usaba para nombrar la cuenta contraria**, no para reconocer | El reconocimiento exigía IBAN o nombre del titular. |
| 5 | Esquema de `proveedores` | `types-inmuebles.ts:588` | Confirmado · solo `nif`, `nombre?`, `tipos[]` (AEAT). Gana `familia?`/`subtipo?`. |
| 6 | Los 3 `console.warn` silenciosos | `bankStatementOrchestrator.ts:338`, `:355`, `clasificarLote.ts:41` | **CONFIRMADO** · los tres degradaban a «sin clasificar» sin decirlo. |

---

## 2 · PASO 1 · Cruce entre cuentas propias (§7.1)

**Deduplicar al importar** · `lineasExtractoService.huellaFuerteDeFila()` + `bankStatementOrchestrator.insertLineas()`.
`hashMovement` lleva el CONCEPTO dentro, así que el mismo movimiento reexportado con un
espacio distinto entraba dos veces. Se añade una segunda huella, la FUERTE:
`cuenta + Nº mov` (Unicaja) o, si no lo trae, `cuenta + fecha + importe + SALDO`. Una línea
es duplicada si la reconoce cualquiera de las dos. Dos cargos idénticos el mismo día (la
comunidad de dos pisos) **siguen siendo dos**: el saldo corrido los separa.

**Cruce de patas** · `traspasosPropios.cruzarPatas()`. Salida en A ↔ entrada en B a ±3 días,
mismo importe, pareja ÚNICA. Dos guardas que no son opcionales:
- una de las dos patas tiene que **oler** a traspaso (titular / ahorro / traspaso / «enviado por»);
- **nunca** sobre `RECIBO|ADEUDO|DOMICILIACION|CAJERO|REINTEGRO|ALQUILER|RENTA|NOMINA|COMPRA|TARJETA|PRESTAMO`.

Se marcan **las dos** patas y cada una **nombra la cuenta pareja**. `cuentasQueFaltan()`
propone (no crea) las cuentas que aparecen al otro lado y no están de alta.

**La «nómina» del banco no decide sola** · `esNominaDelPropioTitular()`. Sube del paso 3
(regla dura) al paso 2 (determinista) y baja el listón a 2 palabras del nombre **detrás de
la etiqueta**: «Abono de nómina Gomez Ramirez» era un ingreso inventado de 1.500 €.
El título lo dice en cristiano: *«el banco lo llama nómina, pero el ordenante eres tú»*.

## 3 · PASO 2 · El mandato como identificador universal (§7.2)

Tipos nuevos: **`mandato`** y **`acreedor`**. Cuatro patrones, todos contra texto real:

| Banco | Lo que llega | Lo que sale |
|---|---|---|
| Unicaja | `FCC AQUALI447497 874010012213` (16 chars de emisor + 12 cifras) | `mandato:874010012213` + `acreedor:FCCAQUALI` |
| BBVA | `N 2025224000484178 BIP   DRIVE, S.A.` | `acreedor:BIPDRIVESA` · el nº (año+día juliano) **se tira** |
| Santander | `Recibo Segurcaixa… Ref. Mandato 07085234611` | `mandato:07085234611` + `acreedor:SEGURCAIXA…` |
| Sabadell | «Referencia 2» desnuda: `SLMP023352742`, `236136614000` | `mandato:…` · el NIF con sufijo SEPA (`B67686782001`) NO se cuenta dos veces |

Guiones: `PREFIJO_NUMERO` admite `-`, y `vale` admite guiones DENTRO del número. Una fecha
con guiones (`31-08-25`) sigue fuera.

**Persistido (§9.5)**: `LineaExtractoPersistida.identificadores` se escribe UNA vez al
importar; `agruparPorEntidad` lo LEE en vez de re-extraerlo del texto.

### ⚠️ HALLAZGO · E2.1 leyó al revés las doce cifras de Unicaja

`identificadoresDelConcepto.test.ts` afirmaba: *«el 0063… cambia cada mes (…1100, …1000,
…0900 en el mismo fichero)»* → `toEqual([])`. **El fichero real dice lo contrario:**

```
2025-08-28  CCPP CL TE0146B7 006300001100  -176,44
2025-08-28  CCPP CL TE0146B7 006300001000  -139,86
2025-08-28  CCPP CL TE0146B7 006300000900  -139,86
```

Los tres salen el **MISMO día**: son **tres acreedores distintos** (las tres comunidades),
no uno cambiando. Y `…0900` reaparece tal cual en otra fecha en
`__fixtures__/unicaja-fixture.csv`, o sea que es **estable**. Es exactamente el dato que
resuelve «¿cuál de mis 3 comunidades?». Test corregido con la evidencia dentro.

## 4 · PASO 3 · Catálogo nacional (§7.3 · E2.6)

**Se CARGA el fichero de Jose**, no se reconstruye: `catalogo-nacional-proveedores.json`,
**308 entidades reales** (68 luz, 67 financieras, 49 agua, 44 telefonía, 34 gas, 46
seguros) con marca, grupo, CIF y «ancla de reconocimiento». El catálogo pasa de 22 NIF ·
146 alias a **47 NIF · 381 alias**.

Traducir al catálogo único tiene **tres decisiones que no son mecánicas**, y las tres
tienen test:

1. **Un BANCO no es un préstamo.** En `FINANCIERAS · BANCO` están Santander, Sabadell,
   Unicaja, BBVA e ING — los bancos del propio Jose. Mapearlos a «crédito al consumo»
   convertiría cada comisión y cada liquidación de intereses de su cuenta en la cuota de
   un préstamo. Un BANCO entra en el catálogo pero **no propone familia**; las excepciones
   son las *monoline* de consumo (WiZink, Oney), en una lista corta y auditable.
2. **Una entidad de pago tampoco.** PayPal y Wise son el tubo, no el destino. Sin familia.
3. **Un CIF en dos categorías pierde el subtipo.** Endesa es el mismo CIF en LUZ y GAS;
   Mapfre, en coche, hogar y decesos. Se conserva la familia y se deja el subtipo vacío.

**211 de las 308 se traducen**; las 97 restantes (bancos, entidades de pago, gestoras) se
quedan fuera a propósito: estar en el fichero no es saber qué es un cargo suyo.

**⚠️ Seis CIF del fichero no pasan el dígito de control** (Octopus Energy España
`B88290798`, Repsol Comercializadora `B86374213`, Banco Mediolanum `A58469946`, ING Bank
España `W0037985G`, Renta 4 `A78260960` ×2). Esas filas entran **solo por nombre**: cruzar
por un CIF mal copiado ataría un recibo a quien no es.

**⚠️ Iberdrola son DOS sociedades, no una.** El fichero trae `A95758389` (Iberdrola
Clientes); los recibos reales de Sabadell traen `A95554630` en «Referencia 1», y su
concepto dice «IBERDROLA COMERCIALIZACION DE U» — el Comercializador de Último Recurso.
Los dos son CIF válidos y **están los dos**: sin el segundo, el catálogo no casaría ni uno
de los recibos de Jose. El que traía `providerDirectoryService` (`A95075578`) no es ninguno.

- **El complemento** (`entidadesNacionales.ts`): lo que las 308 no traen y el corpus sí
  necesita — Wekiwi y Visalia con su CIF sacado del propio extracto, Tuio, Bip&Drive,
  Ayvens, Feebbo, MetLife, Finutive; los **alias recortados** que escribe cada banco
  («FCC AQUALI447497», «DIGI SPAIN400245», «BIP   DRIVE, S.A.»), que ningún registro
  oficial recoge; y los **patrones** («Comunitat de Propietaris», «Ajuntament de…») que
  absorben las listas de `reglasDuras`.
- **Lo aprendido en la base** · **E3.1b · UN SOLO STORE** (decisión de Jose, 12 sep).
  El store `catalogoProveedores` nació en V95 y se retira en V96: dejaba
  `familia`/`subtipo` en DOS sitios para la misma pregunta —«¿quién cobra y qué es?»—
  sin dar nada que `proveedores` no pudiera dar, y `proveedores` ya está indexado por
  NIF, que es justo la clave del catálogo. Ahora todo vive ahí, con `alias[]`,
  `confirmaciones` y `origen` (`'cliente'` | `'nacional'`). `origen: 'nacional'` marca lo
  ÚNICO compartible el día que esto viaje a un servidor, y solo se pone sobre un **CIF de
  EMPRESA**: el DNI del fontanero de un cliente no sale de su navegador. Aprender NO pisa
  los `tipos` AEAT ni una familia que el usuario hubiera puesto a mano.
- **Los proveedores del IRPF** entran por NIF, con `familia` derivada de `tipos` AEAT.
- **NIF de Iberdrola CORREGIDO**: `providerDirectoryService` decía `A95075578`; el real,
  el que Sabadell escribe en «Referencia 1», es **`A95554630`**. Con test contra el fixture.
- **El orden arreglado**: el catálogo va en el **paso 2**, `reglasDuras` sigue en el 3. Un
  recibo de Financiera Carrefour / WiZink / Cetelem / Bankinter Consumer Finance va a
  `prestamo_hipoteca · credito_consumo` y **no** a Supermercado. Con test.
- `prestamo_hipoteca` gana subtipos `hipoteca` / `credito_consumo` (opcionales, sin migración).

**Extra que apareció midiendo** (§7.2, cruce): el nº de contrato del fichero contra
`prestamos[].numeroContrato` dice «esto es un préstamo» aunque el cuadro no cuadre. En el
corpus había 72 «Liquidacion Periodica Prestamo 0049 0052 143 …» sin familia; quedan 34
(las de dos contratos que no están dados de alta).

## 5 · §P1.d · los avisos dejan de ser silenciosos

`OrchestratorResult.avisos: string[]`, volcado además en `warnings` (que la pantalla ya
enseña). Un fallo de lectura deja líneas «sin clasificar» y eso era **indistinguible** de
que el motor no supiera. Ahora se distingue.

---

## 6 · Por qué el 32 % y no el 60 % · las tres razones, medidas

**a) El 31 % del corpus es §7.4, que está fuera de alcance.**
276 «Bizum a favor de ‹persona›» + 35 «Transferencia inmediata a favor de ‹persona›» +
33 PayPal + ~70 transferencias de personas ≈ **414 líneas (31 %)**. Son contrapartes con
nombre propio: eso es *aprendizaje por contraparte* (§7.4, la tarea siguiente), no
identificador ni catálogo. Ninguna tabla nacional va a saber quién es «Emilio Carrera».

**b) 182 líneas (13,6 %) son «Compra Revolut**0940*» y hay un HUECO DE DATO.**
El motor ya sabe resolverlas (regla 6: tarjeta propia → traspaso), pero **las dos `Tarjeta`
del snapshot no tienen `ultimosCuatro`**, así que no hay contra qué cruzar el `0940`.
No es un fallo del motor: es un campo vacío. Rellenar los 4 dígitos de las dos tarjetas
mueve 13,6 puntos sin tocar una línea de código.

**c) El corpus NO puede ejercitar dos de los tres pasos.**
Las 1.341 líneas son de **una sola cuenta** (Santander, `accountId: 1`) y **ninguna trae
columna `referencia`**. Por tanto:
- el **cruce de patas** (§7.1) no puede disparar ni una vez — necesita ≥2 cuentas con movimientos;
- los patrones de mandato de **Sabadell / Unicaja / BBVA** (§7.2) tienen **cero datos** aquí.

Los tres se verifican por test contra el texto real de los ficheros de esos bancos
(`mandatoYAcreedor.test.ts`, `cruceDePatas.test.ts`), pero **no cuentan en el porcentaje**.
El 98,8 % de la auditoría se calculó sobre el corpus multibanco de los 9 ficheros, no sobre
este snapshot de una cuenta. **Son dos poblaciones distintas y no se pueden comparar.**

**d) Cargar las 308 no mueve ESTE corpus, y eso es exactamente lo esperable.**
El catálogo pasa de 22 a 47 NIF y de 146 a 381 alias, y el porcentaje se queda **igual, en
32,0 %**. No es un fallo de carga (verificado: WiZink → crédito al consumo, Endesa → CIF
compartido sin subtipo, Santander → no propone nada). Es que **Jose no es cliente de esas
300 empresas**: las suyas —Segurcaixa, Aqualia, la comunidad, el ayuntamiento, Ayvens—
ya estaban cubiertas. Las 308 no están para mover el corpus de Jose: están para que el
cliente 2, que tiene Naturgy y Holaluz y Cofidis, **no tenga que enseñar nada**. Ese es
el valor y no se ve en este número.

**Qué haría falta para medir de verdad el 60 %:** un snapshot con las líneas de las 9
cuentas, no de una. Con eso, (a) sigue siendo §7.4, pero (c) deja de ser un cero.

---

## 7 · Verificación · lo que la tarea pedía, uno a uno

| Pedido | Estado | Dónde |
|---|---|---|
| % sin reglas duras, antes y después | ✅ 22,8 % → 32,0 % (objetivo 60 % **NO** alcanzado · §6) | `npm run medir:motor` |
| Cargar el catálogo de 308, no reconstruirlo | ✅ 211 traducidas · 47 NIF · 381 alias | `desdeCatalogoNacional.ts` |
| Financiera Carrefour / WiZink / Cetelem / BCF → `prestamo_hipoteca·credito_consumo` | ✅ | `catalogoNacional.test.ts` |
| Dos Iberdrola de dos pisos → cada uno por su mandato | ✅ | `mandatoYAcreedor.test.ts` |
| Traspaso entre dos cuentas → ambas patas, cuenta pareja nombrada | ✅ | `cruceDePatas.test.ts` |
| «Nómina» con ordenante = titular → traspaso | ✅ | `cruceDePatas.test.ts` |
| NIF de Iberdrola corregido casa con el fixture real | ✅ | `catalogoNacional.test.ts` |
| Compila · trinquete igual · suite sin rojas nuevas | ✅ `tsc` limpio · 24 suites / 100 tests rojos **idénticos** a HEAD | — |

**Fuera de alcance, como marcaba la tarea:** §7.4 (contraparte), §7.5 (limpiar reglas
duras), §7.6 (familias que faltan).

---

## 8 · §9.1 · DATOS BANCARIOS REALES VERSIONADOS · urgente

Seis ficheros, **todos añadidos en el mismo commit `55b39e4` (30 ago 2026)**:

| Fichero | Qué lleva dentro |
|---|---|
| `03092025_2706_0003239635 (1).xlsx` | IBAN `ES47 0081 2706 1500 0323 9635` · titular `JOSE ANTONIO*GOMEZ RAMIREZ` · NIF de acreedores · 26 movimientos |
| `Movimientos_Cuenta_4437_…xlsx` | IBAN `ES60 2103 7003 5200 3008 4437` · 23 movimientos · mandatos SEPA |
| `export202593 (1).xlsx` | IBAN `ES6100490052632210412715` · saldo 53.512,05 € · **nombres de inquilinos** (`Jesus Escudero Santiuste`, `Victor Lada Horrillo`, `Concepcion…`) · nº de préstamo |
| `movements-392025.csv` / `.xlsx` | Cuenta ING `1465 0100 9917 13720331` · titular · nóminas con importe |
| `profiles-input/BBVA.xlsx` | Contrato `0182-5322-27-0830842450` · **dos nº de tarjeta completos** (`4940121100236701`, `4552232391590141`) · nóminas |

Y además `docs/audit-inputs/atlas-snapshot-20260426-10.json` (NIF de 11 proveedores reales).

**Hecho en esta PR:** reglas en `.gitignore` (`/*.xlsx`, `/*.xls`, `/*.csv`,
`/profiles-input/*.xls[x]`, `/profiles-input/*.csv`) para que **no entre ninguno más**.

**NO hecho, y es decisión tuya · te lo pongo con el coste delante:**

1. **Borrar los ficheros del árbol** (`git rm`). Cuesta: **dos tests los leen de disco** y
   se caerían — `aperturaDerivada.ficheroReal.test.ts` (`export202593 (1).xlsx`) y
   `bankParser.fechaDeCargo.test.ts` (`03092025_…xlsx`). Habría que anonimizarlos primero a
   `src/**/__fixtures__/` (IBAN y nombres inventados, filas y formato intactos) y
   reapuntar los dos tests. Es media hora, pero es un cambio aparte: no lo meto en una PR
   de motor sin que lo digas.
2. **Borrar el histórico** (`git filter-repo` + force-push). Es **irreversible**, reescribe
   todos los SHA y obliga a reclonar a cualquiera que tenga el repo. Y, seamos claros:
   **si el repo ha sido público en algún momento desde el 30 de agosto, esos datos ya
   están fuera** y el borrado no los recupera — lo que toca entonces es asumir que el IBAN
   y los dos números de tarjeta están expuestos. Los números de tarjeta son lo más serio de
   la lista.

Mi recomendación, en orden: (1) anonimizar y borrar del árbol ya; (2) decidir sobre el
histórico sabiendo que no deshace la exposición; (3) revisar si esas dos tarjetas siguen
vivas.

---

## 9 · Lo que NO he tocado

- No he migrado datos (regla A): el store nuevo nace bajo `contains()`, los campos nuevos
  son opcionales, no hay post-open.
- No he tocado `reglasDuras` salvo para dejar que el catálogo le gane el turno (§7.5 es otra tarea).
- No he reescrito el orquestador: el arreglo de §P1.a son dos argumentos.
