# PARTE 2 · DISEÑO Y MAQUETACIÓN · TESORERÍA V6

**Fecha:** 1 agosto 2026 · revisión pantalla a pantalla sobre producción
**Complementa a:** `PARTE-DEFECTOS-TESORERIA-V6.md` (bloques A–D)
**Referencia:** mockups `atlas-tesoreria-v6-*` + `GUIA-DISENO-V5-atlas.md`

> Este parte es solo diseño y maquetación. Nada de lo de aquí cambia lógica.
> Está ordenado por pantalla para poder ir tachando.

---

## 1 · PÁGINA PRINCIPAL

### 1.1 · Desbordamiento horizontal · lo primero que se ve
El contenido se sale del contenedor por los dos lados: por la izquierda se cortan los títulos de
sección ("SALDO ACTUAL EN MIS CUENTAS" y su subtítulo), por la derecha se pierden "Añadir cuenta",
el rango "1–5 de 10" y media tarjeta, sin flecha visible para pasar.
**Fix:** `min-width:0` en las columnas del grid y en `.main`; el carrusel no puede exceder el ancho
útil; las flechas superpuestas deben caer **dentro** del área visible (`left:8px` / `right:8px`,
no negativos que se salgan).

### 1.2 · El mismo importe con dos formatos en la misma pantalla
Hero: `−4.424,99 €`. Tarjeta de agosto: `↓ 4.424,99 €` (sin signo). Es la misma cifra.
**Fix:** un solo criterio. Como la flecha ya dice la dirección en las tarjetas de mes, **quitar el
signo también en el hero** o ponerlo en ambos. Mi recomendación: **flecha + importe sin signo** en
las tarjetas de mes (donde hay icono) y **signo** en el hero (donde no lo hay), pero entonces la
flecha y el signo nunca conviven. Lo que no puede ser es que el mismo número se escriba de dos
formas a 30 cm de distancia.

### 1.3 · Subtítulos amputados
"MOVIMIENTOS BANCARIOS · PRÓXIMOS 6 MESES" perdió la mitad del subtítulo: quedó "toca un mes para
ver los días" y falta "concilia lo previsto contra lo real", que es lo que explica para qué sirve
el bloque.
**Fix:** restaurar el texto del mockup.

### 1.4 · Bloque "Cómo va agosto" apretado y desbordado
La columna derecha va estrecha: los importes tocan el borde y "de 6.610,32 € previsto" se corta.
**Fix:** la columna necesita ancho mínimo; si no cabe a ese ancho de ventana, que apile bajo el
calendario (el breakpoint de 1180px ya estaba previsto, revisar que se aplique).

### 1.5 · Vacío inferior
Bajo los meses y bajo "Cómo va" queda un tercio de pantalla en blanco mientras arriba todo va
apretado. El reparto está invertido.
**Fix:** repartir ese aire hacia arriba (más respiro entre hero → cuentas → meses) en vez de
acumularlo al final.

### 1.6 · Cuenta de cuentas inconsistente
El hero dice "9 cuentas · hoy" y el carrusel "1–5 de 10".
**Fix:** un solo origen para ese número.

---

## 2 · TARJETAS DE CUENTA

### 2.1 · El punto de banco no distingue
Santander Nómina y Santander Alquileres comparten el mismo rojo, y Sabadell y BBVA dos azules casi
idénticos. Con diez cuentas, el punto deja de identificar.
**Fix:** es justo para lo que existe el color de punto editable (D1 del parte anterior). Al crear la
segunda cuenta del mismo banco, **proponer un color distinto** por defecto en vez de repetir.

### 2.2 · La línea separadora sobra
Hay una regla horizontal entre el saldo y el pie que no aporta y parte la tarjeta en dos.
**Fix:** quitarla o dejar el borde superior del pie mucho más tenue (`--line-3`).

---

## 3 · FICHA DE CUENTA (alta) · la que más se aleja del acuerdo

### 3.1 · No es un formulario plano, es un wizard a pantalla completa
Ocupa casi toda la ventana, con tarjetas grandes con icono para el tipo de cuenta y una columna
entera de vista previa. Lo acordado era **etiqueta y campo**.
**Fix:** el tipo de cuenta pasa a tres botones de texto en una fila (como el toggle Gasto/Ingreso/
Transferencia de la ficha de movimiento). Sin iconos.

### 3.2 · La columna de vista previa no aporta y encima miente
Ocupa la mitad del modal para mostrar tres cosas, y **no reacciona**: el campo dice 30.000,00 € y la
previsión sigue en `0,00 €`. Además muestra la cuenta con un **cuadrado de iniciales "BA"**, que no
es como se ve realmente la cuenta en Tesorería (ahí es un punto de color).
**Fix:** o se elimina la columna entera (mi recomendación: sobra), o se reduce a una **fila** que
reproduce **exactamente** la tarjeta real, y reacciona en vivo.

### 3.3 · "MOVIMIENTOS VINCULADOS · 0"
En un alta siempre será 0. Es un campo que solo puede decir una cosa.
**Fix:** fuera en el alta; en edición, sí tiene sentido.

### 3.4 · Colisión de nombres
El campo "Alias" tiene de marcador "Cuenta principal" y justo al lado hay un interruptor llamado
"Cuenta principal". Dos cosas distintas con el mismo nombre a diez centímetros.
**Fix:** marcador del alias → "Ej. Santander Alquileres".

### 3.5 · Paleta de color pobre y con duplicados
Doce círculos fijos, con tres rojos casi iguales y tres azules casi iguales. No es el selector
acordado.
**Fix:** paleta con rejilla + estándar + "del banco" + **Sin color** (D1 del parte anterior).

### 3.6 · Cabecera redundante
"Nueva cuenta" arriba y "Cuenta nueva · pendiente guardar" debajo dicen lo mismo dos veces.

---

## 4 · DRAWER DE CUENTA

### 4.1 · Los grupos no son tarjetas
Los días aparecen como cabeceras sueltas en mayúsculas sobre una lista plana. Lo cerrado eran
**tarjetas de grupo** con borde, nombre a la izquierda y **subtotal** a la derecha.

### 4.2 · Vuelve el recuento pegado al dinero
"INMUEBLE 1 · 1 · −98,44" y "PERSONAL · 10 · −28,30". El recuento junto al importe fue justo lo que
quitamos por confundir.
**Fix:** cabecera de grupo = nombre + subtotal. Nada más.

### 4.3 · Cabeceras de columna que no estaban
"CONCEPTO / ORIGEN / IMPORTE ✓" convierte la lista en una tabla de contabilidad.
**Fix:** fuera. La fila se explica sola.

### 4.4 · Los ejes no son chips
Fecha / Inmueble / Qué es se ven como texto plano con un recuadro gris en el activo.
**Fix:** chips redondeados, activo en navy sobre blanco, como el mockup.

### 4.5 · Interlineado desperdiciado
Entre filas hay el doble de aire del necesario: caben cinco movimientos donde deberían caber nueve.
En una bandeja de trabajo, cada scroll de más es fricción.
**Fix:** compactar al ritmo del mockup.

### 4.6 · El círculo de acción está al final
El círculo de confirmar aparece **a la derecha del importe**. Es la acción principal de la pantalla
y está en el sitio donde menos se mira.
**Fix:** a la izquierda, antes del concepto, como quedó cerrado.

### 4.7 · Chips de origen compitiendo
"Recurrente" y "Financiación" con icono, en el medio de la fila, pesan más que el concepto.
**Fix:** si el origen aporta, va como subtítulo gris. Sin chip, sin icono.

### 4.8 · Subtítulos que no dicen nada
"Personal" repetido en cada fila, guiones sueltos ("Inmueble 3 · —"), y una cuenta como subtítulo de
un gasto de salud ("Personal · Carrefour").
**Fix:** la regla ya escrita — **si no aporta algo que la fila no diga, no se pinta**. Y nunca un
guion como relleno de un dato vacío.

---

## 5 · DRAWER DE DÍA

### 5.1 · La fecha, dos veces seguidas
"sábado · 1 ago 2026" y justo debajo "SÁBADO, 1 DE AGOSTO".
**Fix:** una sola vez.

### 5.2 · Dos totales sin etiqueta
"+2682,50 −3086,80" juntos, sin decir qué son ni separación.
**Fix:** o llevan su icono ↑/↓ como en las tarjetas de mes, o se sustituyen por el **neto del día**,
que es lo que se mira.

### 5.3 · Formato roto en los totales
"+2682,50" sin separador de miles y sin €, cuando dos líneas más abajo se escribe "+1.350,00 €".
**Fix:** el formateador único, también aquí.

### 5.4 · La rejilla de días desaprovecha el espacio
Celdas anchas y bajas, con la mitad inferior vacía, y debajo un vacío enorme antes del detalle.
**Fix:** celdas más cuadradas y detalle del día empezando justo bajo la rejilla.

### 5.5 · Hoy no se distingue
El día 1 (hoy) se ve igual que el 2. El filo dorado de "hoy" no llega.

---

## 6 · FICHA DE MOVIMIENTO

### 6.1 · Dos campos distintos llamados "Concepto"
El primero es el texto libre; el segundo es la clasificación dentro de la familia. Mismo nombre,
mismo formulario.
**Fix:** el libre pasa a **"Descripción"**; el de catálogo se queda como "Concepto".

### 6.2 · El título no dice qué estás editando
Pone "Movimiento" genérico, cuando debería llevar el concepto real, como hacía el mockup.

### 6.3 · Las acciones de fila se pintan debajo, no dentro
Al pasar el ratón, el lápiz y la ✕ aparecen en una línea **bajo** la fila, desplazándola.
**Fix:** inline, al final de la fila, apareciendo por opacidad sin mover nada.

---

## 7 · CONFIRMACIÓN INLINE (además de eliminarse, ver bloque A4)

Mientras exista, dos defectos de forma: el bloque gris a todo lo ancho rompe el ritmo de la lista, y
las etiquetas en mayúsculas ("FECHA REAL", "CUENTA REAL") contradicen el *sentence case* de la guía.
Con la corrección A4 desaparece entero.

---

## 8 · TRANSVERSALES

| # | Defecto | Fix |
|---|---|---|
| 8.1 | Importes en **verde y rojo** en drawers y subtotales | Todos a `--ink`. Regla vigente |
| 8.2 | **Mayúsculas** en etiquetas de formulario y cabeceras de grupo | Sentence case salvo los rótulos de sección de la guía |
| 8.3 | Separador de miles ausente en varios sitios | Un único formateador en toda la app |
| 8.4 | Drawers demasiado anchos (más de media pantalla) | Ancho del mockup |
| 8.5 | Iconos decorativos reintroducidos (tipo de cuenta, chips de origen, edificio en subtítulos) | Lucide solo cuando el icono **sustituye** a una palabra, no cuando la acompaña |

---

## Orden sugerido

1. **1.1** desbordamiento — se ve en cada carga.
2. **8.1** color de importes — es la regla más visible y la más rota.
3. **4.x** drawer de cuenta (tarjetas de grupo, chips, círculo a la izquierda, compactar).
4. **3.x** ficha de cuenta.
5. El resto.
