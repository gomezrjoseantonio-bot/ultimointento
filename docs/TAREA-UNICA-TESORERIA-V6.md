# TAREA ÚNICA · TESORERÍA V6 · mockup ↔ producción, elemento a elemento

**Fecha:** 1 agosto 2026
**Sustituye a TODOS los partes anteriores** (P0, PARTE-DEFECTOS, PARTE-2, PARTE-3 y la versión previa
de TAREA-CC-FIX). Este es el único documento operativo.
**Referencia visual:** `atlas-tesoreria-v6-escritorio.html` / `-movil.html`
**Guía:** `GUIA-DISENO-V5-atlas.md` · checklist sección 17 obligatorio antes del PR.

---

## CÓMO USAR ESTE DOCUMENTO

Cada bloque es una zona de la pantalla. Cada tabla: **qué dice el mockup · qué hay en producción ·
qué hacer**. Si una fila dice "= correcto", **no se toca**: está bien y romperla es una regresión.

Orden de PRs: **§1 → §2 → §3 → §4-11**. No se empieza uno sin cerrar el anterior.

---

## §1 · FASE 0 · DUPLICACIÓN AL EDITAR UN RECURRENTE · corrupción de datos

Editar un gasto recurrente **lo duplica**. Es acumulativo y contamina todas las cifras: cierres,
saldos finales, "Pendiente salir" y "Cómo va {mes}" beben de las previsiones.

**Sospecha a comprobar:** los **252 / 248 pendientes** por cuenta pueden ser en buena parte
duplicados y no trabajo real.

**Principio · innegociable:** regenerar una previsión es **idempotente**. Una vez o cinco, mismo
resultado.

1. Toda previsión automática lleva **clave de origen**: `sourceType` + `sourceId` + periodo + cuenta.
2. Al regenerar: **primero se retiran las `predicted` vivas de esa clave**, después se emiten las
   nuevas. Nunca solo añadir.
3. **Solo se tocan las `predicted`.** Confirmadas, conciliadas y descartadas, intocables.
4. Si dos caminos generan la misma previsión, uno sobra: identificarlo y retirarlo.

**Limpieza · el arreglo no la hace:**
1. Contar duplicados (misma clave, periodo, cuenta e importe) y cuánto distorsionan los cierres.
2. **Reportar a Jose antes de borrar nada.**
3. Limpiar **solo `predicted`**. Los duplicados ya confirmados o conciliados **no se borran**: pueden
   ser cargos reales repetidos. Se listan aparte para revisión manual.
4. Dejar el conteo reproducible para verificar que no vuelve a crecer.

**Criterio de salida:** editar un recurrente diez veces deja exactamente las mismas previsiones que
editarlo una vez.

---

## §1-BIS · GLOSARIO CERRADO · una palabra por concepto

Hoy conviven **cinco palabras para lo mismo** — "pendiente", "previsión", "por confirmar",
"pendiente de entrar", "todo agosto" — y estaban también en mi mockup: era culpa de la referencia.
**Ya está corregido en `atlas-tesoreria-v6-escritorio.html` y `-movil.html`; descárgalos de nuevo.**

| Concepto | **Única palabra válida** | Dónde se usa |
|---|---|---|
| Estado: aún no ha ocurrido / no lo has afirmado | **previsto** | chip de estado, toasts |
| Estado: tú afirmas que ocurrió | **confirmado** | chip de estado |
| Estado: lo afirma el banco vía extracto | **conciliado** | chip de estado |
| El **trabajo**: previstos vencidos sin confirmar | **por confirmar** | pestaña, contador, pie de la tarjeta de cuenta, estado vacío |
| Dinero que **falta por entrar/salir** en el mes | **queda entrar / queda salir** | KPIs del hero, del drawer de cuenta y del drawer de mes |
| Saldo proyectado a fin de mes | **cierre** | hero, tarjetas de mes, drawer de mes |
| La otra pestaña de la cuenta (todos los estados) | **Movimientos** | pestaña |

### Sustituciones obligatorias

| Prohibido | Correcto |
|---|---|
| "Pendiente entrar" · "Pendiente salir" | **Queda entrar** · **Queda salir** |
| "Pendientes · 248" | **Por confirmar · 248** |
| "Todo agosto" / "Todo julio" | **Movimientos** |
| "Nada pendiente" | **Nada por confirmar** |
| "Devuelto a pendientes" | **Vuelve a previsto** |
| "Saldo a fin de mes" · "Cierre proyectado" · "Fin de mes" | **Cierre** |

**Por qué "Movimientos" y no "Todo agosto":** "todo agosto" no le dice nada a un lector — ni qué
contiene ni en qué se diferencia de la otra pestaña. La distinción real es: en una **trabajas**
(por confirmar), en la otra **consultas** (todos los movimientos del mes, en cualquier estado). El
mes ya lo dice el rango que va junto al buscador; no hace falta en el nombre de la pestaña.

**Regla general:** un concepto, una palabra, en todas las pantallas y en todos los toasts. Si aparece
un sinónimo nuevo, es un defecto.

## §2 · REGLAS TRANSVERSALES · afectan a todas las pantallas

### 2.1 · Color

| Regla | Producción | Acción |
|---|---|---|
| Importes **siempre `--ink`**; el signo da la dirección | Verde y rojo en filas, subtotales y cabeceras de día | Todos a `--ink` |
| El estado se dice con el **chip**, no con el color del importe ni del círculo | No hay chip; el estado se intenta decir con el color del círculo | Restaurar chip (§6.4) |
| Círculo de `previsto` = **gris vacío** | Ámbar punteado | A gris |
| **Ámbar = solo aviso** (cuenta que se queda corta) | Ámbar en círculos y en casi todos los días del calendario | Liberar el ámbar |
| Cifra-veredicto en `--gold` | ✓ correcto en KPIs | = no tocar |

### 2.2 · Vocabulario y formato

| Regla | Producción | Acción |
|---|---|---|
| **Un solo formateador**: miles con punto, 2 decimales solo si los hay, `€` siempre | `+2682,50` sin miles ni € junto a `+1.350,00 €` | Formateador único en toda la pantalla |
| El mismo importe se escribe igual en toda la app | Hero `−4.424,99 €` · tarjeta de mes `↓ 4.424,99 €` | Un solo criterio (recomendado: mantener el signo también con flecha) |
| **Ningún identificador interno visible** | "Inmueble 2", "Inmueble 3", "Inmueble 6" | Siempre el nombre real del inmueble |
| Sentence case salvo rótulos de sección | Etiquetas de formulario en mayúsculas ("FECHA REAL") | Corregir |
| Sin texto truncado | "Cuota Hipoteca – Hipoteca Un…" | Dar ancho o partir en dos líneas |

### 2.3 · La ventana temporal · Tesorería mira hacia delante

La pantalla principal enseña 6 meses de futuro, pero el drawer de mes permite retroceder sin límite.
**El histórico no es trabajo de Tesorería** (eso es Archivo y Fiscal).

- **Adelante:** mes en curso + 5. = correcto, no tocar.
- **Atrás:** solo hasta el mes del **pendiente sin confirmar más antiguo**. Si no hay ninguno, no se
  retrocede del mes en curso.
- Al llegar al tope, la flecha `‹` **se desactiva** (invisible), no lleva a meses vacíos.
- Meses **anteriores a la fecha del saldo inicial** de las cuentas no existen: ni se muestran ni se
  navegan.
- Un mes futuro **sin movimientos previstos** se muestra (cierre = el del mes anterior) pero sin
  pintar flechas a cero: se indica que no hay nada previsto.

### 2.4 · Acciones en móvil

**En móvil no hay hover.** Hoy el lápiz y la ✕ solo aparecen al pasar el ratón: desde el teléfono
**no se puede editar ni descartar**, que es justo donde se puntea.

- Escritorio: al hover.
- Móvil: **siempre accesibles**, en la fila o por deslizamiento.

---

## §3 · CONCEPTO · lo que está mal pensado

### 3.1 · "Por confirmar" mezcla pasado y futuro
Estando a 1 de agosto lista pendientes de **noviembre y diciembre**.
→ **Pendiente = previsto con fecha ≤ hoy sin confirmar.** Es una bandeja que se vacía. El futuro vive
en el calendario.

### 3.2 · El contador no cuadra con los KPIs de la cuenta
Unicaja: cabecera "Pendiente salir **−857,15 €**" y pestaña "Pendientes · **248**". 248 movimientos
no suman 857 €: la pestaña cuenta todos los periodos y el KPI solo el mes.
→ Ambos sobre el mismo conjunto (fecha ≤ hoy sin confirmar, o el mes; pero **el mismo**).

### 3.3 · La desviación siempre da 0 €
"habías previsto pagar 3.006,48 € y has pagado 3.006,48 €" compara lo confirmado consigo mismo.
→ Comparar, por movimiento confirmado, **importe previsto original vs importe real**. La suma de
diferencias es la desviación. **Si el previsto original no se persiste, para y reporta.**

### 3.4 · El Neto en negativo miente
−1.048,98 € sobre −821,15 € pintado como **128 % de barra llena**: "más lleno = mejor" cuando
significa peor.
→ Con magnitudes negativas no hay barra de progreso: mostrar real, previsto y **la diferencia con su
signo**; si el real es peor, la nota en `--warn`.

### 3.5 · Confirmar son cinco decisiones
El círculo abre un editor inline (fecha real, importe real, cuenta real, tres botones).
→ **Círculo = confirma directo** con el importe previsto + **Deshacer** en el toast.
→ **Lápiz** = ficha con fecha e importe **prefijados con el previsto**, para el caso en que difieran.
→ **✕** = descartar.
→ **Se elimina el editor inline.**

---

## §4 · PANTALLA PRINCIPAL

### 4.1 · Hero

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Banda navy + filo oro 3px | ✓ | ✓ | = |
| "Mi tesorería" + fecha larga | ✓ | ✓ | = |
| Saldo · **Queda entrar** · **Queda salir** · Cierre · {mes} | ✓ (glosario) | "Pendiente entrar/salir" | Renombrar |
| Cierre en `--gold-soft` | ✓ | ✓ | = |
| Botón "Subir extracto" | ✓ | ✓ | = |
| Recuento de cuentas | "10 cuentas · hoy" | "9 cuentas" y el carrusel dice "1–5 de 10" | Un solo origen |

*El cálculo es correcto (60.316,35 + 4.652,82 − 4.424,99 = 60.544,18). No tocar la fórmula.*

### 4.2 · Desbordamiento horizontal · se ve en cada carga
Con la barra lateral abierta el contenido se sale por los dos lados: se cortan los títulos de sección
por la izquierda y "Añadir cuenta", el rango y media tarjeta por la derecha, sin flecha visible.
→ `min-width:0` en `.main` y en las columnas del grid; flechas superpuestas **dentro** del área
visible.

### 4.3 · Sección "Movimientos bancarios"

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Título + rango inline | "Movimientos bancarios · próximos 6 meses" + "jul – dic 2026" | ✓ | = |
| Subtítulo | "**concilia lo previsto contra lo real** · toca un mes para ver los días" | solo la segunda mitad | Restaurar |
| Tarjeta de mes: nombre, chip "en curso", label "Cierre", saldo | ✓ | ✓ | = |
| Pie con ↑/↓ e importes | **con signo** | sin signo | Unificar (§2.2) |
| Mes en curso: "queda entrar / queda salir" | solo como `title` (tooltip) | no aparece | Hacerlo **texto visible** en el mes en curso: no es lo mismo lo que entra que lo que **queda** por entrar |

### 4.4 · Bloque "Cómo va {mes}"

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Título + "cuánto llevas de lo previsto para {mes}" | ✓ | ✓ | = |
| Filas Ingresos / Gastos / Neto | ✓ | ✓ | = |
| Barra escalada contra **su propio** previsto | ✓ | ✓ (30 % / 40 % correctos) | = |
| % **fuera** de la barra | ✓ | ✓ | = |
| Neto separado, en oro | ✓ | ✓ | = |
| Veredicto = desviación | ✓ | siempre 0 € | §3.3 |
| Neto negativo | — | 128 % de barra llena | §3.4 |
| Ancho de la columna | cabe | importes cortados por la derecha | Ancho mínimo o apilar bajo 1180px |

### 4.5 · Reparto vertical
Todo apretado arriba y un tercio de pantalla vacío abajo.
→ Repartir el aire hacia arriba (hero → cuentas → meses).

---

## §5 · TARJETAS DE CUENTA

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Punto de banco + nombre + `···· mask` | ✓ | ✓ | = |
| Saldo grande **en `--ink`** | ✓ | ✓ | = |
| Estado "al día" gris | ✓ | ✓ | = |
| Estado "N por confirmar" **sin chip de fondo** | ✓ | ✓ | = |
| Aviso: punto ámbar + "se queda en −X € el {día}" | ✓ | ✓ | = |
| Filo superior ámbar en cuenta con aviso | ✓ | ✓ | = |
| 5 tarjetas ≥1240px | ✓ | 5 pero desbordando | §4.2 |
| Lápiz al hover para editar | ✓ | verificar que existe | Si falta, añadir |
| Línea separadora bajo el saldo | tenue | marcada, parte la tarjeta | Atenuar o quitar |
| Dos cuentas del mismo banco | color de punto editable | Santander Nómina y Alquileres comparten rojo; Sabadell y BBVA dos azules casi iguales | Al crear la segunda cuenta de un banco, **proponer color distinto** |

---

## §6 · DRAWER DE CUENTA

### 6.1 · Cabecera

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Navy + filo oro, punto + nombre + mask | ✓ | ✓ | = |
| 4 KPIs: Saldo hoy · **Queda entrar** · **Queda salir** · **Saldo final** (oro) | ✓ (glosario) | "Pendiente entrar/salir" | Renombrar |
| Cálculo | correcto | correcto (17.330,77 − 857,15 = 16.473,62) | = |

### 6.2 · Fila de pestañas y acciones

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| "Por confirmar · N" / "Movimientos" + "Anotar" + "Subir extracto" en **una fila** | ✓ | ✓ | = |
| Contador | del conjunto pendiente | 248/252, incoherente con los KPIs | §3.2 |

### 6.3 · Pestaña "Por confirmar"

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Agrupado en **tarjetas por día** con subtotal en cabecera | tarjeta con borde | cabecera suelta en mayúsculas sobre lista plana | A tarjetas |
| **Habitaciones anidadas a su piso** | día → **piso (+ total)** → habitación | rentas planas, una detrás de otra | `agruparHijas` de `PunteoList` |
| Título de fila = **lo que dice el banco** | "Mapfre", "Lucía Fernández" | "Seguro hogar", "Comunidad" (idioma ATLAS) | Invertir |
| Subtítulo = traducción de ATLAS | "Tenderina 64 · 4D · seguro hogar" | "Inmueble 2", "Personal" | Nombre real, y **si no aporta, no se pinta** |
| Chip de origen | no existe | "Recurrente" ocho veces seguidas ocupando el centro | Quitar |
| Círculo de acción | **a la izquierda**, antes del concepto | a la derecha, tras el importe | Mover |
| Lápiz y ✕ | al hover, inline | se pintan **debajo** y desplazan la fila | Inline, por opacidad · y §2.4 |
| Interlineado | compacto | doble del necesario: caben 5 donde deberían caber 9 | Compactar |

**Prueba de aceptación de la fila:** dos filas "Seguro hogar" de **−40,29 €** y **−40,23 €** (Inmueble
2 e Inmueble 3). Con la fila delante y el móvil del banco en la mano, **debe poder identificarse cuál
es cuál sin abrir nada**. Hoy es imposible.

### 6.4 · Pestaña "Movimientos"

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Buscador pequeño **a la izquierda**, chips de eje a la derecha | ✓ | invertido | Corregir |
| Ejes como **chips** (activo navy) | ✓ | texto plano con recuadro gris | A chips |
| Grupos = **tarjetas plegadas** con chevron | ✓ | lista plana con cabecera en mayúsculas | A tarjetas |
| Cabecera de grupo = **nombre + subtotal** | ✓ | "INMUEBLE 1 · **1** · −98,44" | Quitar el recuento pegado al importe |
| Cabeceras de columna | no existen | "CONCEPTO / ORIGEN / IMPORTE ✓" | Quitar |
| **Chip de estado** `previsto·confirmado·conciliado` | ✓ | **no existe** | Restaurar |
| `conciliado` = tick gris informativo, no botón | ✓ | círculo ámbar igual que el resto | Corregir |
| Orden por fecha desc dentro de cada grupo | ✓ | ✓ (corregido por Copilot) | = |

**Regla del chip, que faltaba por escrito:**

| Vista | ¿Chip? | Círculo |
|---|---|---|
| **Por confirmar** | **No** — todo es `previsto`, repetirlo 250 veces es ruido | Gris vacío, pulsable |
| **Movimientos** y **día** | **Sí** — conviven los tres estados | Gris pulsable si `confirmado`; tick gris si `conciliado` |

---

## §7 · FICHA DE MOVIMIENTO

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Formulario plano, etiqueta + campo | ✓ | ✓ | = |
| Kick + título = **el concepto real** | "Editar previsión" + "Comunidad · Tenderina 4D" | "EDITAR" + "Movimiento" | Poner el concepto |
| Campo de texto libre | "Concepto" | "Concepto" | Renombrar a **"Descripción"** |
| Campo de catálogo | "Concepto" (dentro de Familia) | "Concepto" | Colisión: dos campos con el mismo nombre |
| Familia + Concepto encadenados | ✓ | ✓ ("Elige antes la familia") | = |
| Familia **prefijada** por clasificación automática | ✓ | "Sin clasificar" | Prefijar |
| Importe real + hint "previsto X" | ✓ | ✓ | = |
| Fecha | prefijada con la prevista | ✓ | = |
| Cuenta | "Cuenta de cargo o abono" | "Cuenta" | Menor, unificar |
| Inmueble | "Sin inmueble (personal)" | "Sin inmueble · personal" | Menor, unificar |
| Tipo Gasto/Ingreso/**Transferencia** en alta | ✓ | verificar | Si falta, añadir |
| **Enlace a documento del Archivo** | adenda 02 · D6a | no está | Añadir (enlace discreto, no dropzone) |
| Footer Eliminar / Cancelar / Guardar | ✓ | ✓ | = |
| Movimiento de financiación | no lleva familia: muestra su préstamo | pide familia y sale "Sin clasificar" | El selector no aplica; mostrar el préstamo asociado |

---

## §8 · DRAWER DE MES

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| ‹ mes año › + ✕ | ✓ | ✓ | = |
| Resumen: queda entrar · queda salir · Cierre | con iconos ↑/↓ en las etiquetas | sin iconos | Añadir |
| Cabeceras de día | "Lun Mar Mié Jue Vie Sáb Dom" | "L M X J V S D" | A formato largo |
| Celda: número + **neto del día** | ✓ | ✓ | = |
| **Punto ámbar** | solo días que dejan una cuenta corta | en **casi todos**, incluso sin movimientos | Corregir |
| **Hoy** con filo dorado | ✓ | no se distingue del resto | Añadir |
| Proporción de celdas | cuadradas | anchas y bajas, mitad inferior vacía | Ajustar |
| Detalle del día justo bajo la rejilla | ✓ | vacío enorme entre medias | Ajustar |
| Navegación hacia atrás | limitada | ilimitada (2024) | §2.3 |
| Ancho del drawer | del mockup | más de media pantalla | Ajustar |

---

## §9 · DRAWER DE DÍA

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| Cabecera del día + "N movimientos" | una vez | **dos veces seguidas** ("sábado · 1 ago 2026" y "SÁBADO, 1 DE AGOSTO") | Dejar una |
| Totales del día | con icono ↑/↓ y formateados | "+2682,50 −3086,80" sin etiqueta, sin € y sin miles | Formatear y etiquetar, o sustituir por el **neto** |
| Fila: **punto de banco** | ✓ | no está | Añadir |
| Fila: chip de estado | ✓ | no está | §6.4 |
| Círculo a la izquierda | ✓ | a la derecha del importe | Mover |
| Lápiz + ✕ (en previstos) | ✓ | no visibles | Añadir · §2.4 |
| Acciones: "Confirmar el día" **y "Anotar movimiento"** | ✓ | solo la primera | Añadir "Anotar movimiento" |
| Importes | `--ink` | verde y rojo | §2.1 |
| Interlineado | compacto | huecos enormes entre filas | Compactar |
| En el día **no se concilia** | ✓ | ✓ | = |

---

## §10 · FICHA DE CUENTA

| Elemento | Mockup | Producción | Acción |
|---|---|---|---|
| **Formulario plano** | etiqueta + campo | wizard a pantalla completa con tarjetas-icono | Aplanar; tipo de cuenta como botones de texto, sin iconos |
| Tipo | Cuenta / Tarjeta de crédito | Corriente / Ahorro / Tarjeta crédito | 3 tipos es correcto si el modelo los tiene: **mantener**, solo quitar los iconos |
| Nombre | "Nombre" | "Alias" con marcador "Cuenta principal", **y al lado un interruptor llamado "Cuenta principal"** | Marcador → "Ej. Santander Alquileres" |
| Saldo inicial + A fecha de | ✓ + hint | ✓ + hint más largo | = (unificar redacción con el mockup) |
| Tarjeta: cuenta de liquidación, día de cargo, límite | ✓ | verificar que aparece al elegir Tarjeta | Si falta, añadir |
| Tarjeta: **sin selector de banco** (lo hereda) | ✓ | verificar | Corregir si lo pide |
| **Color del punto: paleta** (rejilla + estándar + "del banco" + Sin color) | ✓ | 12 círculos fijos con tres rojos y tres azules casi iguales | Sustituir por la paleta |
| Columna de vista previa | **no existe** | media pantalla, **no reacciona** (campo 30.000 € → muestra 0,00 €) y pinta la cuenta con un **cuadrado de iniciales "BA"** que no es como se ve en Tesorería | **Eliminar** la columna; si se conserva, que reproduzca la tarjeta real y reaccione en vivo |
| "MOVIMIENTOS VINCULADOS · 0" | no existe | en el alta siempre dirá 0 | Quitar del alta |
| Cabecera | "Nueva cuenta" / "Cuenta bancaria" | "Nueva cuenta" + "Cuenta nueva · pendiente guardar" | Redundante |
| Baja bloqueada si hay pendientes | ✓ | verificar | Mantener |

---

## §11 · EXTRACTO Y MÓVIL · aún no verificables

No se han podido revisar en producción. Se entregan según lo cerrado:

- **Extracto (§4.7):** dropzone → resumen "N líneas · N cuadran · N a resolver · N ignoradas" → por
  línea: texto literal del banco + fecha + importe, y debajo el veredicto; sin cuadre:
  **Asignar / Crear / Ignorar** (reversible con "recuperar"); **un solo botón Guardar** al pie que
  consolida; el aspa sale sin guardar; el fichero se archiva en el **Archivo**.
- **Móvil (§4.11):** mini-hero (Saldo hoy + Cierre en oro), pendientes **agrupados por cuenta**,
  confirmación con el pulgar y saldo vivo, "Subir extracto" a ancho completo, y §2.4 (editar y
  descartar sin hover).

---

## §12 · LO QUE ESTÁ BIEN · no tocar

- Hero: estructura, KPIs, orden, cierre en oro y **el cálculo**.
- Tarjetas de cuenta: anatomía, estados, aviso ámbar con "se queda en −X € el {día}", filo superior.
- Cabecera del drawer de cuenta: 4 KPIs y su cálculo.
- Fila de pestañas + acciones en una sola línea.
- "Cómo va {mes}": barras contra su propio previsto, % fuera de la barra, neto separado en oro.
- Rejilla de 6 meses y su navegación hacia delante.
- Orden por fecha descendente dentro de los grupos.
- Ficha de movimiento: formulario plano y encadenado Familia → Concepto.

---

## CRITERIOS DE ACEPTACIÓN

- [ ] Editar un recurrente N veces deja las mismas previsiones que editarlo una
- [ ] Recuento de duplicados reportado; limpieza solo sobre `predicted`
- [ ] "Por confirmar" = fecha ≤ hoy sin confirmar; el contador cuadra con los KPIs de la cuenta
- [ ] La desviación compara previsto original vs real (o está reportado por qué no puede)
- [ ] El Neto negativo no se representa con barra de progreso
- [ ] Confirmar es **un toque**, con Deshacer; el editor inline ha desaparecido
- [ ] Editar y descartar accesibles **en móvil**, sin hover
- [ ] Las habitaciones cuelgan de su piso, plegable y con total
- [ ] Chip de estado presente en "Movimientos" y día; ausente en "Por confirmar"; círculo gris
- [ ] Prueba de la fila: los dos seguros de 40,29 € y 40,23 € quedan distinguibles sin abrir nada
- [ ] Ningún identificador interno visible ("Inmueble 2")
- [ ] Cero importes en verde o rojo; ámbar solo en avisos reales
- [ ] Punto del calendario solo en días que dejan una cuenta corta; hoy con filo dorado
- [ ] Sin desbordamiento horizontal a 1440×900 con sidebar abierta
- [ ] Un único formateador de importes en toda la pantalla
- [ ] No se navega a meses anteriores al pendiente más antiguo; ningún mes sin datos inventa cierre
- [ ] Ficha de cuenta plana, con paleta de color y sin columna de vista previa que mienta
- [ ] Glosario aplicado: cero apariciones de "Pendiente entrar/salir", "Pendientes", "Todo {mes}", "Nada pendiente"
- [ ] Checklist sección 17 pasado
- [ ] Sin regresión en §12

**Sigue vigente: cualquier contradicción → para y reporta.**
