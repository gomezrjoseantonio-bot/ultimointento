<!-- Texto de Jose (MODELO §32.29-32.40 · 5 sep 2026) · subido tal cual en E2.4.2. Es el RAZONAMIENTO detrás de cada
     decisión del catálogo; la fuente normativa es docs/ATLAS-CATALOGO-clasificacion-DEFINITIVO.md: si difieren, manda el
     DEFINITIVO (instrucción de Jose · 5 sep 2026). El código es src/services/catalogo/catalogoUnico.ts. -->

# ATLAS · MODELO §32.29-32.40 · decisiones del catálogo de clasificación
### 32.29 · CATÁLOGO ÚNICO de conceptos · SIN fiscalidad dentro (decisión de fondo · 5 sep)
Es UN solo catálogo (no "árbol de creación" vs "árbol de etiquetado" — eso es el bug). El mismo sirve para: crear recurrentes, etiquetar movimientos, reclasificar errores del matcheo, y clasificar automático. Todos los módulos (nómina, inversiones, matcheo, usuario) escriben en el MISMO catálogo; lo que cambia es QUIÉN pone la etiqueta, no de dónde sale.

**Forma:** TABLA/CATÁLOGO de conceptos (fila = concepto, columnas = propiedades), presentado como árbol agrupado por familia solo para la UI. Cada concepto: nombre · naturaleza (ingreso/gasto/neutro) · familia · subtipo · ámbito(s) aplicables (personal/inmueble/ambos). = evolución del catálogo C existente.

**DECISIÓN CLAVE (Jose, convence — corrige error que chirriaba todas las sesiones): la FISCALIDAD NO va dentro del concepto.**
- El catálogo define QUÉ ES un movimiento (naturaleza/familia/subtipo/ámbito). NADA de casilla AEAT ni deducibilidad dentro.
- **Prueba irrefutable:** "la luz de 50€ de Tenderina 64 4-izq ¿es deducible?" → DEPENDE del contexto fiscal del periodo: piso alquilado o no, días alquilados, quién la pagó, régimen. El MISMO gasto (luz Tenderina) es deducible un año y no otro, o parcial. La deducibilidad NO es propiedad del gasto — es una LENTE que lo lee en su ejercicio.
- Por tanto: **quitar el enganche categoría→casillaAEAT del código (A `categoryCatalog`)** — es conceptualmente erróneo y ya causó bugs (casilla 0108/0112, auditoría). La casilla/deducibilidad/cuantía/% por días → capa FISCAL, que lee el gasto en contexto.
- Es el principio rector aplicado (dato en su store, lentes que leen): el gasto es un HECHO; su fiscalidad es una LENTE. El catálogo es el hecho; la declaración es la lente.

### 32.30 · Los EVENTOS patrimoniales NO son categorías del catálogo (venta · 5 sep)
Prueba con la venta real de Sant Joan/Manresa (property_sales id 1, 17/03/2026): precio 130.000, comisión 7.200, cancelación hipoteca 66.502, neto 55.247, ganancia patrimonial 38.508. **En el banco NO hay "una venta"** — hay TROZOS repartidos entre bancos y fechas: sobrante cancelación (+403), honorarios (−2.117), regularización (−81), certificado energético (−100), y el traspaso del neto. 
- Yo clasifiqué los TROZOS bancarios (§32.21): honorarios→coste venta, sobrante→cancelación préstamo, etc. NUNCA clasifiqué "una venta".
- **La venta es un EVENTO patrimonial que vive en `property_sales`** (con precio/costes/cancelación/ganancia/fiscalidad), NO una familia del catálogo de ingresos.
- **Generaliza (tesis de Jose):** casi todo lo "grande" es un EVENTO que se DERIVA y vive en su store — nómina (módulo nómina), alquiler (contratos), venta (property_sales), dividendo (inversiones). El catálogo NO tiene "venta" ni "nómina de X" como categoría; tiene el RASTRO DE CAJA que esos eventos producen + los gastos/ingresos sueltos.
- → RETIRAR "Venta de vivienda" de las familias de ingreso. Es evento, no categoría. El catálogo de ingresos se queda con ingresos etiquetables de caja (renta suelta, rendimiento, bonificación, otros); los grandes se autoetiquetan desde su evento/módulo (§32.29: todos escriben en el mismo catálogo, unos automático desde su evento).

### 32.31 · CORRECCIÓN/matiz a §32.30 · el NETO de la venta SÍ se etiqueta (Jose aclara · 5 sep)
Aclaración de Jose que corrige mi exceso en §32.30: en la venta de Manresa, el notario NETEA — del precio (135.000) se descuenta la hipoteca y gastos EN LA NOTARÍA, y **en la cuenta del usuario entra SOLO EL NETO (~55.000)**. Ese ingreso neto **aparece sí o sí en el banco y HAY que etiquetarlo.**
- Dos caras, sin contradicción: **el EVENTO** (precio 135.000, hipoteca cancelada, gastos, ganancia patrimonial, fiscalidad) vive en `property_sales`. **El MOVIMIENTO** de caja (el neto ~55.000 que entra en la cuenta) SÍ es un ingreso etiquetable → categoría **"Venta de inmueble"**, enganchado al evento.
- **NO hay doble conteo** porque el notario netea: en el banco NO entran los 135.000 ni salen la hipoteca/gastos por la cuenta del usuario — solo entra el neto. (Distinto del caso teórico A donde entra el precio entero y salen las patas; aquí es el caso B: llega neteado.)
- → "Venta de inmueble" SÍ es categoría de ingreso del catálogo (Jose tenía razón desde el principio; §32.30 se matiza: el evento no es categoría, PERO el movimiento neto que produce SÍ). El catálogo la tiene para que el matcheo la ponga, el usuario reclasifique, y se enganche a property_sales.
- Ojo caso A (raro): si un banco recibiera el precio entero y las cancelaciones salieran por la cuenta, entonces el neto NO se etiqueta (se etiquetan las patas, y el neto es cálculo) — evitar doble conteo. La regla depende de CÓMO entra el dinero (neteado por notario = etiquetar neto; bruto+patas = etiquetar patas). El usuario/estructura lo dirime.

### 32.32 · CATÁLOGO ÚNICO · FAMILIAS DE INGRESO (cerrado con Jose · 5 sep)
Naturaleza = INGRESO. 7 familias, con subtipo solo donde aporta:
1. **Nómina** — sin subtipo (se autoetiqueta desde módulo nómina; si hay 2 empleos, 2 registros, no subtipos).
2. **Pensión** — sin subtipo (jubilación/viudedad/incapacidad; la UI de ING ya la agrupaba como "Nómina o Pensión").
3. **Autónomo / actividad** — sin subtipo (Unihouser, facturación; cada actividad un registro).
4. **Alquiler (renta)** — sin subtipo. El TIPO (larga/corta/habitación/turístico) vive en el CONTRATO, no en el catálogo.
5. **Rendimiento** — subtipo: **interés (cuenta) / dividendo / rendimiento inversión**. Es la caja que da un activo MIENTRAS lo tienes.
6. **Venta** — subtipo por ACTIVO: **inmueble / acciones / fondos / criptomonedas** (+ los tipos de activo que maneje `inversiones`). Es la caja que da un activo cuando lo DESHACES. **El subtipo NO se inventa: sale de los tipos de activo de `inversiones` + inmueble** (un solo sitio define los tipos de activo; Venta los reutiliza — evita árboles duplicados). El EVENTO (precio/costes/ganancia/fiscalidad) vive en property_sales/inversiones; el MOVIMIENTO neto que entra en cuenta se etiqueta "Venta › [activo]" (§32.31).
7. **Otros ingresos** — plano (cajón: bonificación banco, devolución/reembolso, puntual).

**Simetría del modelo (bonita y coherente):**
- Cada activo da caja de DOS formas: **Rendimiento** (mientras lo tienes) + **Venta** (cuando lo deshaces). Vale para piso (renta/venta) y para inversión (dividendo/venta).
- Ingresos de trabajo/prestación: **Nómina, Pensión, Autónomo**.
- Los "grandes" se autoetiquetan desde su evento/módulo (§32.29-32.31); el catálogo tiene la etiqueta para reclasificar. Sin fiscalidad dentro (§32.29).

### 32.33 · Préstamo/hipoteca = familia de gasto (el banco NO separa interés/capital · 5 sep)
En el fichero del banco la cuota es UN SOLO cargo ("Liquidación Periódica Préstamo −454,66", "PRESTAMOS ADEUDO CUOTA −304,25"). El banco NO desglosa interés/capital. → 
- **"Préstamo / hipoteca" SÍ es familia de gasto del catálogo** — se etiqueta el cargo ENTERO. NO se parte el movimiento.
- **El desglose interés (gasto real) / capital (neutro)** vive en el EVENTO `prestamos.planPagos` (que ya lo tiene calculado por cuota). Es una LENTE que lee el cuadro cuando se necesita (fiscal: interés deducible; cashflow; amortización acumulada). El movimiento no se toca.
- Mismo principio que venta (§32.31): el evento tiene el detalle, el movimiento es el cargo entero que se etiqueta. Coherente con "el banco da uno, la lente lo interpreta".

### 32.34 · CATÁLOGO ÚNICO · FAMILIAS DE GASTO · primer nivel (cerrado con Jose · 5 sep)
Naturaleza = GASTO. Familias por lo que SON (sin fiscalidad dentro — §32.29). Base = el árbol de la UI (catálogo C) + ajustes:

**Techo (inmueble propio/alquilado o vivienda):**
1. Comunidad
2. Suministro
3. Seguro
4. Impuestos y tasas
5. **Mantenimiento** (preventivo/periódico)
6. **Reparación** (correctivo/avería)
7. **Reforma / Mejora** (transformar/mejorar — familia propia, NO es reparar; el "por qué" es que son acciones distintas, sin invocar fiscalidad)
8. Alquiler que pago (Pozuelo)
9. Gestión (solo inmueble)
10. Limpieza (solo inmueble)
11. Alarma
12. Mobiliario y enseres
13. **Préstamo / hipoteca** (cargo entero; interés/capital lo da el cuadro del evento, §32.33)

**Día a día personal:**
14. Supermercado / alimentación
15. Restauración
16. Transporte
17. Salud / farmacia
18. Suscripciones
19. Ocio
20. Viaje
21. Ropa y calzado
22. Cuidado personal

23. **Otros** (cajón)

- Mantenimiento/Reparación/Reforma = TRES familias por lo que son (preventivo/correctivo/transformar), NO por fiscalidad.
- El ÁMBITO (personal/inmueble) es columna aparte — Gestión/Limpieza aplican solo a inmueble; el resto puede ser personal o inmueble según el caso.
- PENDIENTE: bajar a SUBTIPOS de cada familia (ej. Suministro › luz/agua/gas/internet/teléfono; Seguro › hogar/vida/coche/salud...). Revisar familia por familia.

### 32.35 · CATÁLOGO ÚNICO · FAMILIAS DE GASTO · DEPURADAS (cerrado con Jose · 5 sep)
Depuración de las 23 iniciales → 20 familias. Cambios de Jose:
- Reparación + Mantenimiento → UNA "Reparación y mantenimiento".
- Seguro + Alarma → "Seguros y alarmas" (alarma = subtipo, deja de ser familia suelta).
- Ocio absorbe Viaje y Restaurante → "Ocio" con subtipos (viajes/restaurante/+).
- Salud+farmacia + Ropa/calzado + Peluquería → "Cuidado personal" (subtipos: ropa/calzado/peluquería/farmacia/médico).
- Alquiler + Renting → "Alquiler y renting" (subtipos: vivienda/vehículo). El renting del coche sale de Transporte.
- **Multas** sale de Impuestos → familia propia (sanción ≠ tributo).
- **Gestión** NO es solo-inmueble ni va con Limpieza: puede ser PERSONAL (abogado/asesor de Jose) o inmueble. Gestión y Limpieza son familias SEPARADAS.
- Añadidas: **Educación y formación**, **Gastos financieros** (SOLO comisiones bancarias).
- **INTERÉS del préstamo: NO es familia ni cargo suelto.** Va DENTRO de la cuota (§32.33). El banco hace UN cargo (la cuota); no existe un cargo "intereses". Gastos financieros = solo comisiones. (Cerrado definitivamente — se habló 5 veces.)

**FAMILIAS (20):**
Techo/inmueble: 1 Comunidad · 2 Suministro · 3 Seguros y alarmas · 4 Impuestos y tasas · 5 Reparación y mantenimiento · 6 Reforma/Mejora · 7 Alquiler y renting (vivienda/vehículo) · 8 Gestión · 9 Limpieza · 10 Mobiliario y enseres · 11 Préstamo/hipoteca
Día a día/persona: 12 Supermercado/alimentación · 13 Ocio (viajes/restaurante/+) · 14 Transporte · 15 Cuidado personal (ropa/calzado/peluquería/farmacia/médico) · 16 Suscripciones · 17 Educación y formación
Otras: 18 Gastos financieros (comisiones) · 19 Multas · 20 Otros

ÁMBITO (personal/inmueble) = columna aparte, no familia. Fiscalidad = lente aparte (§32.29).

### 32.36 · CORRECCIÓN a §32.35 · las familias NO se agrupan por ámbito (error que lía · 5 sep)
Error mío en §32.35: agrupé las familias en "Techo/inmueble" vs "Día a día/persona". **MAL — eso mete el ÁMBITO dentro de la FAMILIA**, justo lo que separamos en §32.1 (dos ejes independientes). Jose lo detecta: "el 70% de mis préstamos son personales" — poner Préstamo bajo "inmueble" es falso y CONFUNDE al usuario (creería que su préstamo personal no cabe).
- **La familia NO tiene ámbito fijo.** Préstamo, Suministro, Seguro, Reforma… TODAS pueden ser personal o inmueble según el movimiento concreto.
- El **ámbito (personal/inmueble) es columna aparte**, se decide EN CADA MOVIMIENTO, no en la familia.
- → Las 20 familias son una LISTA PLANA, sin grupos por ámbito. (Se pueden ordenar por afinidad temática o alfabética, pero NUNCA por ámbito.)
- Es el mismo principio de fondo repetido: familia = qué ES; ámbito = de quién/qué es; fiscalidad = cómo tributa. TRES ejes independientes, nunca uno dentro de otro.

### 32.37 · CATÁLOGO ÚNICO · SUBTIPOS DE GASTO (cerrado con Jose · 5 sep)
Regla: TODAS las familias tienen subtipo, PERO el 2º nivel NO es obligatorio (el usuario puede etiquetar solo la familia sin bajar al subtipo). Excepción: Reforma/Mejora va SIN subtipo.
1 Comunidad → ordinaria / derrama / otros
2 Suministro → luz / agua / gas / internet / telefonía / otros
3 Seguros y alarmas → hogar / vida / decesos / vehículo / salud / impago / alarma / otros
4 Impuestos y tasas → IBI / basuras / circulación / licencia turística / otros tributos
5 Reparación y mantenimiento → caldera / electrodomésticos / vehículo / ITV / integral / otros
6 Reforma / Mejora → SIN subtipo
7 Alquiler y renting → vivienda / vehículo
8 Gestión → gestoría / asesoría / abogado / comisión plataformas / otros
9 Limpieza → zonas comunes / integral / por estancia / lavandería / otros
10 Mobiliario y enseres → muebles / ropa de cama-enseres / electrodomésticos / otros
11 Préstamo / hipoteca → SIN subtipo (detalle en cuadro del evento)
12 Supermercado / alimentación → (solo familia)
13 Ocio → viajes / restaurante / cine-planes / otros (SIN lotería — cae en Ocio›otros)
14 Transporte → combustible / parking / peajes / transporte público / taxi-VTC / otros
15 Cuidado personal → ropa / calzado / peluquería / farmacia / médico
16 Suscripciones → streaming / música / software / cloud / prensa / gimnasio / ONG / otros
17 Educación y formación → colegio / universidad / cursos / formación profesional / otros
18 Gastos financieros → comisión mantenimiento / transferencia / otros
19 Multas → tráfico / otras
20 Otros → SIN subtipo (cajón; vigilar que quede residual — si se llena, falta una familia)

→ CATÁLOGO DE GASTOS CERRADO (20 familias + subtipos opcionales). Lista PLANA (§32.36, sin grupos de ámbito). Sin fiscalidad dentro (§32.29).

### 32.38 · Correcciones finales catálogo GASTOS (Jose · 5 sep)
- Comunidad → **"cuota mensual"** (no "ordinaria" — es jerga que nadie entiende) / derrama / otros.
- Reparación → quitar "integral" (no significa nada claro): caldera / electrodomésticos / vehículo / ITV / otros.
- Familia 12 → **"Supermercado"** a secas (sin "/alimentación", sin subtipo).
- Familia 18 → renombrar "Gastos financieros" a **"Comisiones bancarias"** (más claro para el usuario) — subtipos: mantenimiento / transferencia / otros.
- **NUEVA familia: "Compra online"** → recoge compras por internet donde el banco solo da el comercio bazar (Amazon/Shein/AliExpress) y no se sabe QUÉ se compró. Mismo principio que Revolut (§32.19): si el dato no está, no inventar; el usuario reclasifica si quiere. OJO: tiendas específicas (Leroy=bricolaje, IKEA=hogar, Decathlon=deporte) van a SU familia, no a compra online — solo los bazares opacos van aquí.

**CATÁLOGO GASTOS FINAL = 21 familias** (20 + Compra online). Lista plana, subtipos opcionales, sin fiscalidad, sin agrupar por ámbito.

### 32.39 · CATÁLOGO ÚNICO · MOVIMIENTO INTERNO (3ª naturaleza · cerrado con Jose · 5 sep)
**Aclaración conceptual clave de Jose:** la 3ª naturaleza NO es "sin movimiento". Un traspaso/recarga/efectivo SÍ es una salida/entrada de dinero REAL (afecta al SALDO de la cuenta, plano CAJA). Lo que es neutro es el efecto sobre el PATRIMONIO (el dinero sigue siendo tuyo, solo cambia de sitio). → Nombre: **"Movimiento interno"** (no "neutro", que sugiere que no pasa nada). Naturaleza de un movimiento = Ingreso / Gasto / **Movimiento interno**.
- **Consecuencia práctica:** en vista de CUENTA/tesorería el movimiento interno cuenta para el saldo (real); en vista de PATRIMONIO / "cuánto gané-gasté" NO cuenta (ni gasto ni ingreso). Por eso no puede ir en gastos (inflaría) ni ingresos.

**FAMILIAS DE MOVIMIENTO INTERNO (4):**
1. **Traspaso** → subtipos: a otra cuenta / a tarjeta (recarga, ej. Revolut) / a efectivo (cajero) / a ahorro. (§32.24: efectivo/cajero es interno, no gasto.)
2. **Aportación** → a plan de pensiones / a inversión / a fondo. Mover CASH a tu producto de inversión-ahorro (el dinero sigue tuyo como aportado). Comprar el activo concreto = evento (store inversiones); rendimiento/venta = INGRESO (§32.32). La aportación es solo el traslado de cash.
3. **Disposición de préstamo** → cuando te ENTRA el capital del préstamo (dinero entra contra deuda → patrimonio no sube).
4. **Fianza** → entra / se custodia / se devuelve. Dinero del inquilino que custodias, NO es tuyo → ni ingreso ni gasto (§17).

**CUOTA de préstamo NO está aquí** — se etiqueta entera como "Préstamo/hipoteca" (GASTO), el cuadro del evento hace el desglose interés/capital (§32.33). "Dejar la cuota en paz" (Jose, 6ª vez).

→ **CATÁLOGO ÚNICO COMPLETO: Ingresos (7 fam §32.32) + Gastos (21 fam §32.37-38) + Movimiento interno (4 fam).** Tres naturalezas. Lista plana, subtipos opcionales, sin fiscalidad dentro, ámbito como eje aparte.

### 32.40 · Método de pago ≠ categoría (confirmado por Jose · cierra los ejes · 5 sep)
Transferencia y Bizum (y domiciliación, tarjeta, efectivo, cheque) NO son categoría — son **MÉTODO de pago** (el "cómo se movió", no el "qué es"). Una transferencia puede ser gasto·reforma, ingreso·alquiler o interno·traspaso: mismo método, distinta categoría.
- Al etiquetar/crear un movimiento se rellenan EJES INDEPENDIENTES: **naturaleza** (ingreso/gasto/interno) · **categoría** (familia+subtipo, qué es) · **método de pago** (cómo) · **ámbito** (personal/inmueble). Los 4 independientes.
- El MÉTODO normalmente lo detecta ATLAS del concepto del banco (transferencia/bizum/recibo…); el usuario solo lo marca al crear a mano (sin fichero), y siempre editable. Vive en SU columna, separado de la categoría.
- Confirma y cierra §32.1 (los ejes no se mezclan): confundir "bizum" con una categoría era el lío del inicio. Bizum = método, siempre.
