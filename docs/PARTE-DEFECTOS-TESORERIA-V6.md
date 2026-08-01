# PARTE DE DEFECTOS · TESORERÍA V6 en producción

**Fecha:** 1 agosto 2026 · revisión sobre `ultimointentohoy.netlify.app/tesoreria`
**Referencia:** mockups `atlas-tesoreria-v6-escritorio.html` / `-movil.html` + `TAREA-CC-TESORERIA-V5.md` + adendas 01–03

> Orden de arreglo: **A antes que B antes que C**. Los de bloque A no son estética: rompen lo que
> la pantalla promete.

---

## A · CONCEPTO · lo que está mal pensado, no mal pintado

### A1 · "Pendientes · 252" mezcla pasado y futuro · **el más grave**

El drawer de cuenta lista como pendientes movimientos de **diciembre y noviembre** estando a
**1 de agosto**. Eso no son pendientes: son previsiones futuras que aún no han ocurrido.

- **Pendiente = lo que ya debería haber pasado y no has confirmado.** Es una bandeja que se vacía.
- Lo que ocurrirá en diciembre **no es trabajo de hoy**: vive en el calendario y en el cierre del mes,
  no en la bandeja.
- Un contador de **252** consigue justo lo contrario del objetivo: abruma en vez de tranquilizar.

**Corrección:** Pendientes muestra **solo previstos con fecha ≤ hoy** que sigan sin confirmar,
ordenados por fecha descendente. El futuro no entra. El contador cuenta eso y solo eso.

### A2 · La desviación siempre da 0 €

"Acabarás **0 €** mejor de lo previsto · habías previsto pagar 3.006,48 € y has pagado 3.006,48 €".

Está comparando lo confirmado **contra sí mismo**, así que el resultado será 0 € siempre. El dato
que aporta es otro: lo que **habías previsto** para esos mismos conceptos frente a lo que **realmente
costaron**. Si un recibo se presupuestó en 120 € y vino de 96 €, la desviación es +24 €.

**Corrección:** por cada movimiento confirmado, comparar `importe previsto original` vs
`importe real confirmado`. La suma de esas diferencias es la desviación. Si un movimiento no
guarda su previsto original, **para y reporta**: sin ese dato el bloque no puede existir y hay que
decidir dónde se persiste.

### A3 · El Neto en negativo miente

Neto real **−1.048,98 €** sobre previsto **−821,15 €** se pinta como **128 %** de barra dorada llena.
Visualmente "más lleno = mejor", cuando aquí significa **peor**: se ha gastado más de lo previsto.

**Corrección:** con magnitudes que pueden ser negativas, el porcentaje de avance no sirve. Para el
Neto: mostrar **real vs previsto y la diferencia con su signo**, y si el real es peor que el previsto,
la nota va en `--warn`. Nada de barra de progreso sobre un número negativo.

### A4 · El círculo abre un formulario en vez de confirmar

Al pulsar el círculo se despliega un editor inline (*Fecha real · Importe real · Cuenta real ·
Confirmar / No pasó este mes / Cancelar*). Eso son cinco decisiones para decir "sí, esto pasó".

Lo cerrado es: **un toque en el círculo = confirmado**, con el importe previsto, y Deshacer en el
toast. Si el importe real difiere, **para eso está el lápiz**, que abre la ficha (§4.5).

**Corrección:**
- Círculo → confirma directo. Sin formulario, sin pasos.
- Lápiz → ficha de movimiento para importe real, fecha, reclasificar.
- ✕ en la fila → descartar ("no pasó").
- **Se elimina el editor inline**: duplica la ficha y mete fricción en la acción más repetida.

---

## B · COLOR · la regla que más costó cerrar, rota en tres sitios

**Regla vigente:** los importes van **siempre en `--ink`**. El signo `+`/`−` dice la dirección.
El **ámbar es la única nota de color** y solo cuando hay que actuar. El oro, solo para la cifra-veredicto.

| Dónde | Qué pasa | Corrección |
|---|---|---|
| B1 · Drawer de día y de cuenta | Importes en **verde y rojo** por todas partes, incluidos los subtotales de cabecera | Todos a `--ink` |
| B2 · Círculo de "previsto" | Se pinta **ámbar punteado** | Círculo **gris** vacío. El ámbar queda libre para el aviso real |
| B3 · Rejilla del calendario mensual | **Punto ámbar en casi todos los días**, incluso sin movimientos | El punto solo aparece en días que **dejan una cuenta corta**. Si no, nada |

Cuando el ámbar está en todas partes, deja de significar "mira aquí".

---

## C · MAQUETACIÓN

### C1 · Desbordamiento horizontal en la página · **visible de entrada**

Con la barra lateral abierta, el contenido se sale del contenedor: los títulos se cortan por la
**izquierda** ("SALDO ACTUAL EN MIS CUENTAS" / "entra en una cuenta…") y por la **derecha** se pierden
"Añadir cuenta", el rango "1–5 de 10" y la quinta tarjeta, sin flecha para pasar.

**Corrección:** el `main` no puede desbordar. Revisar el ancho del carrusel y el `min-width:0` de las
columnas del grid; las flechas superpuestas deben quedar dentro del área visible, no fuera.

### C2 · "Todo {mes}" es una tabla, no lo acordado

Aparece con cabeceras de columna **CONCEPTO / ORIGEN / IMPORTE** y con el **recuento pegado al
importe** ("INMUEBLE 1 · 1 · −98,44"), que es exactamente lo que quitamos por confuso.

**Corrección:** tarjetas de grupo plegadas, cabecera con **nombre + subtotal** y nada más. Sin
cabeceras de columna, sin recuento junto al dinero.

### C3 · Ejes de agrupación como texto plano

Fecha / Inmueble / Qué es se ven como texto. Deben ser **chips**, como en el mockup, con el activo
en navy.

### C4 · Drawers demasiado anchos y con aire muerto

El drawer del calendario ocupa más de media pantalla y el del día deja un espacio vertical enorme
entre filas. Ajustar al ancho del mockup y compactar el interlineado de filas.

### C5 · Ruido en la fila

- Chips "Recurrente" / "Financiación" en la columna origen: no estaban y compiten con el concepto.
  Si el origen aporta, va como subtítulo en gris, sin chip.
- Subtítulos con guion suelto ("Inmueble 1 · —") y "Personal" repetido en todas las filas: si no
  aporta, **no se pinta**.

---

## D · FUNCIONALIDAD

| # | Defecto | Corrección |
|---|---|---|
| D1 | **Color del punto**: fila de círculos predefinidos, no el selector tipo paleta acordado | Paleta con rejilla + estándar + **Sin color** + "del banco" por defecto |
| D2 | **Vista previa del alta no reacciona**: el campo dice 30.000 € y la previsión sigue en 0,00 € | La vista previa refleja alias, banco, color y saldo inicial en vivo |
| D3 | **Falta el enlace a documento** en la ficha (D6a de la adenda 02) | Enlace discreto que reutiliza `DocumentPickerPopover` para vincular un documento del Archivo |
| D4 | **Familia "Sin clasificar"** en un movimiento que es cuota de préstamo | Un movimiento de financiación no se clasifica por familia: se muestra su préstamo asociado y el selector no aplica |
| D5 | **Fecha 30/06/2028** en un movimiento listado bajo "viernes 30 de junio" | Verificar de dónde sale el año; si es dato sembrado, aislarlo del informe |
| D6 | Subtítulo del calendario perdió "concilia lo previsto contra lo real" | Restaurar el texto del mockup |

---

## Entrega

Un PR por bloque (A, luego B+C, luego D), sin merge, para poder validar por partes.
**Bloque A primero**: mientras la bandeja mezcle futuro y la desviación dé siempre 0, la pantalla
no cumple su función aunque se vea bien.

**Sigue vigente: cualquier contradicción → para y reporta.**
