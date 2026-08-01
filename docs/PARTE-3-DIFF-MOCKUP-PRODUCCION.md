# PARTE 3 · DIFF MOCKUP ↔ PRODUCCIÓN · lo que directamente NO está

**Fecha:** 1 agosto 2026
**Método:** comparación elemento a elemento del mockup cerrado contra las capturas de producción.
**Complementa a:** `PARTE-DEFECTOS-TESORERIA-V6.md` y `PARTE-2-DISENO-MAQUETACION-V6.md`

> Los partes anteriores señalaban cosas **mal hechas**. Este señala cosas **que no se han hecho**.
> Son piezas del mockup que sencillamente no aparecen en pantalla.

---

## AUSENCIA 1 · El chip de estado no existe · **causa raíz de medio parte anterior**

En el mockup, **toda fila lleva su estado escrito**: `previsto` · `confirmado` · `conciliado`, en un
chip pequeño entre el concepto y el importe. Es el vocabulario del módulo, el que costó cerrar y el
que hace legible el modelo de tres estados.

**En producción no hay ningún chip.** El estado se intenta comunicar **solo con el círculo**, y de
ahí sale el resto del desaguisado:

- Como el círculo tiene que decir "previsto", lo pintan de **ámbar punteado** → se carga la regla de
  que el ámbar es solo aviso.
- Como el círculo tiene que decir "confirmado", lo rellenan de navy → indistinguible de "conciliado".
- El usuario **nunca lee las palabras** previsto / confirmado / conciliado en ninguna parte.

**Fix:** restaurar el chip de estado en la fila (`.dd-chip` con sus tres variantes: gris para
previsto, verde para confirmado, navy para conciliado — **el color va en el chip, no en el importe
ni en el círculo**). Con el chip puesto, el círculo vuelve a ser gris vacío y el ámbar queda libre.

---

## AUSENCIA 2 · El anidamiento piso → habitación no está

Fue de lo que más insististe ("LOS PISOS POR HABITACIONES LAS RENTAS DEBEN ESTAR ANIDADAS"). En el
mockup, dentro de un día, las rentas se agrupan bajo una **subcabecera de piso** y las habitaciones
cuelgan de ella:

```
Miércoles 1 jul
  Tenderina 64 · 4D
      Lucía Fernández        Habitación 3        +475,00 €
  Gijón · Poniente
      Marc Vidal             Habitación 3        +525,00 €
```

**En producción las rentas salen planas**, una detrás de otra, sin piso que las agrupe:
"Renta 2026-08 · ALISSER REAL ESTATE / Inmueble 1", "Renta 2026-08 · ADNAN PARWEZ / Inmueble 3"…

**Fix:** implementar `agruparHijas` de `PunteoList` en la pestaña Pendientes: día → piso → habitación.

---

## AUSENCIA 3 · El grupo de rentas conciliadas no está · **la respuesta a las 30 habitaciones**

El mockup resuelve tu pregunta de "300 movimientos, 30 habitaciones el día 1, ¿lo hago a ojo?" con
una fila-grupo plegable:

```
▸ Rentas · 1 jul     30 habitaciones · 7 pisos     ✓ 28 conciliadas   2 por revisar   +14.800 €
```

Se despliega a los 7 pisos y cada piso a sus habitaciones, y **solo miras las 2 que fallan**.

**En producción no existe.** No hay agrupación de rentas, ni contador de "conciliadas vs por
revisar", ni pliegue. Con lo cual el problema que originó todo el rediseño **sigue sin resolverse**:
252 líneas planas.

**Fix:** es la pieza de más valor del módulo. Debe entrar sí o sí.

---

## AUSENCIA 4 · "Anotar movimiento" desapareció del drawer de día

El mockup tiene dos acciones al pie del día: **Confirmar el día** y **Anotar movimiento**.
Producción solo trae la primera. Es decir: si estás mirando un día y te falta un gasto que pagaste,
no puedes añadirlo desde ahí.

---

## AUSENCIA 5 · El buscador y los ejes están invertidos

Mockup: **buscador pequeño a la izquierda**, chips de agrupación a la derecha.
Producción: chips a la izquierda, buscador a la derecha.

Menor, pero rompe la lectura acordada (primero filtro, luego eje) y descuadra con el resto.

---

## AUSENCIA 6 · Cabeceras de día en formato largo

Mockup: `Lun · Mar · Mié · Jue · Vie · Sáb · Dom`.
Producción: `L · M · X · J · V · S · D`.

Con celdas tan anchas como las de producción, la abreviatura de una letra no ahorra nada y se lee
peor.

---

## AUSENCIA 7 · "Hoy" no está marcado en el calendario

El mockup marca el día de hoy con **filo dorado**. En producción el 1 de agosto se ve igual que el
2. Y como los puntos ámbar están en todos los días, no hay ninguna referencia visual de dónde estás.

---

## AUSENCIA 8 · El mes en curso no distingue "queda" de "entra"

Mockup: en el mes en curso las etiquetas son **"queda entrar" / "queda salir"** (lo que falta por
pasar); en los meses futuros, "entra" / "sale" (el total del mes). Producción usa el mismo rótulo
para todos.

Es un matiz que importa: en agosto, 4.652,82 € no es lo que entra en agosto, es lo que **queda** por
entrar.

---

## Resumen de prioridad

| | Ausencia | Por qué importa |
|---|---|---|
| 1 | **Chip de estado** | Sin él, el modelo de tres estados es invisible y el color se descontrola |
| 2 | **Grupo de rentas plegable** | Es la razón por la que se rediseñó el módulo |
| 3 | **Anidamiento piso → habitación** | Decisión explícita y repetida |
| 4 | Anotar en el día | Función perdida |
| 5–8 | Buscador, cabeceras, hoy, "queda" | Coherencia con lo cerrado |

Las tres primeras no son acabado: son el módulo.
