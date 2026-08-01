# TAREA-CC · FIX TESORERÍA V6 · plan único y ordenado

**Fecha:** 1 agosto 2026
**Sustituye como documento operativo a:** `P0-DUPLICACION-GASTO-RECURRENTE.md`,
`PARTE-DEFECTOS-TESORERIA-V6.md`, `PARTE-2-DISENO-MAQUETACION-V6.md`,
`PARTE-3-DIFF-MOCKUP-PRODUCCION.md` — que se conservan como detalle.
**Referencia visual:** `atlas-tesoreria-v6-escritorio.html` / `-movil.html`

> Un PR por fase, sin merge. No se empieza una fase sin cerrar la anterior.
> El orden importa: validar diseño sobre datos duplicados es perder el tiempo dos veces.

---

## ACLARACIÓN PREVIA · culpa del mockup, no tuya

En el mockup, la lista de **Pendientes no lleva chip de estado** y las de **"Todo {mes}" y día sí**.
Esa asimetría no estaba explicada y de ahí salió el círculo ámbar punteado. La regla, ahora escrita:

| Vista | ¿Chip de estado? | Círculo |
|---|---|---|
| **Pendientes** | **No.** Todo es `previsto` por definición; repetirlo 250 veces es ruido | **Gris vacío**, pulsable |
| **Todo {mes}** | **Sí**, conviven los tres estados | Gris pulsable si `confirmado`; tick gris informativo si `conciliado` |
| **Drawer de día** | **Sí**, conviven | Igual que arriba |

**El ámbar no participa nunca en el estado.** Ámbar = solo aviso (cuenta que se queda corta).

---

## FASE 0 · DUPLICACIÓN DE RECURRENTES · corrupción de datos

Editar un gasto recurrente lo duplica. Es acumulativo e inutiliza todas las cifras de la pantalla:
cierres, saldos finales, "Pendiente salir" y "Cómo va {mes}" beben de las previsiones.

**Sospecha a comprobar:** los **252 pendientes** y los **29 movimientos de agosto** pueden ser en
buena parte duplicados, no trabajo real.

### Principio de arreglo · innegociable
Regenerar una previsión es **idempotente**: una vez o cinco, mismo resultado.

1. Toda previsión automática lleva **clave de origen** (`sourceType` + `sourceId` + periodo + cuenta).
2. Al regenerar: **primero se retiran las `predicted` vivas de esa clave**, luego se emiten las
   nuevas. Nunca solo añadir.
3. **Solo se tocan las `predicted`.** Confirmadas, conciliadas y descartadas, intocables.
4. Si dos caminos generan la misma previsión, uno sobra: identificarlo y retirarlo.

### Limpieza · no la hace el arreglo
1. **Contar** duplicados (misma clave, periodo, cuenta e importe) y cuánto distorsionan los cierres.
2. **Reportar a Jose antes de borrar nada.**
3. Limpiar **solo `predicted`**. Los duplicados ya confirmados o conciliados **no se borran**: pueden
   ser cargos reales repetidos. Se listan aparte para revisión manual.
4. Dejar el conteo reproducible para verificar que no vuelve a crecer.

**Criterio de salida:** editar un recurrente diez veces deja exactamente las mismas previsiones que
editarlo una.

---

## FASE 1 · CONCEPTO

### 1.1 · Pendientes mezcla pasado y futuro
Estando a 1 de agosto lista pendientes de noviembre y diciembre.
**Pendiente = lo que ya debería haber ocurrido y sigue sin confirmar.** Es una bandeja que se vacía.
→ Solo previstos con **fecha ≤ hoy**. El futuro vive en el calendario, no en la bandeja. El contador
cuenta eso.

### 1.2 · La desviación siempre da 0 €
"Habías previsto pagar 3.006,48 € y has pagado 3.006,48 €" compara lo confirmado consigo mismo.
→ Comparar, por movimiento confirmado, **el importe previsto original** contra **el real**. La suma
de diferencias es la desviación. **Si el previsto original no se persiste hoy, para y reporta**: sin
ese dato el bloque no puede existir.

### 1.3 · El Neto en negativo miente
−1.048,98 € sobre −821,15 € se pinta como 128 % de barra llena: "más lleno = mejor" cuando significa
peor.
→ Con magnitudes que pueden ser negativas, no hay barra de progreso. Mostrar **real, previsto y la
diferencia con su signo**; si el real es peor, la nota en `--warn`.

### 1.4 · Confirmar son cinco decisiones
El círculo abre un editor inline (fecha real, importe real, cuenta real, tres botones).
→ **Círculo = confirma directo** con el importe previsto, y Deshacer en el toast.
→ **Lápiz** = ficha para importe real, fecha, reclasificar.
→ **✕** en la fila = descartar.
→ **Se elimina el editor inline.**

---

## FASE 2 · LO QUE FALTA

### 2.1 · Las habitaciones, anidadas a su piso · **lo esencial**

Hoy las rentas salen planas, una detrás de otra:

```
Renta 2026-08 · ALISSER REAL ESTATE      Inmueble 1        +1.350,00
Renta 2026-08 · ADNAN PARWEZ             Inmueble 3          +395,00
Renta 2026-08 · CONCEPCION RAMIREZ       Inmueble 6          +330,00
```

Tiene que verse así — cada habitación colgando de su piso, y el piso con su total:

```
Tenderina 64 · 4D                                          +1.900,00
    Lucía Fernández          Habitación 3                     +475,00
    Marc Vidal               Habitación 4                     +475,00
    …
Gijón · Poniente                                           +2.100,00
    …
```

El piso se pliega y se despliega. Nada más.

Usar `agruparHijas` de `PunteoList`, que ya existe para esto.

### 2.2 · La ventana temporal · Tesorería mira hacia delante

Hoy la pantalla principal enseña **6 meses de futuro**, pero al abrir un mes se puede **navegar hacia
atrás sin límite** (2024 incluido). Son dos ideas distintas del módulo en la misma pantalla.

**Tesorería es la caja de hoy y la de lo que viene. El histórico no es su trabajo** — eso es Archivo
y Fiscal.

**Regla:**
- **Hacia delante:** mes en curso + 5 siguientes. Ya está bien.
- **Hacia atrás:** solo hasta el **mes del pendiente sin confirmar más antiguo**. Si no hay ninguno,
  no se retrocede del mes en curso. Nunca más allá.
- Cuando no se puede retroceder más, la flecha `‹` **se desactiva** (invisible, como las del
  carrusel), no lleva a meses vacíos.

**Motivo de dejar algo de pasado:** los pendientes son "fecha ≤ hoy"; si el usuario lleva semanas sin
entrar, tendrá cosas del mes anterior por confirmar y debe poder verlas en su día. Nada más que eso.

### 2.3 · Meses sin datos: no se inventa un cierre

Aparecen meses en los que no hay tesorería y aun así muestran un cierre proyectado. Eso es un número
inventado.

- Un mes **anterior a la fecha del saldo inicial** de las cuentas **no existe** para Tesorería: no se
  muestra ni se navega.
- Un mes **futuro sin ningún movimiento previsto** sí se muestra (el cierre es el del mes anterior),
  pero **sin flechas de entra/sale a cero**: se indica que no hay movimientos previstos.

### 2.4 · Los puntos del calendario

Todos los días de la rejilla llevan punto ámbar, incluso los que no tienen nada.
→ El punto **solo aparece en días que dejan una cuenta corta**. Si el día no tiene movimientos, la
celda va limpia; si los tiene y todo cuadra, tampoco lleva punto.

### 2.5 · Chip de estado
Restaurar donde corresponde (ver tabla de la aclaración previa). Con el chip puesto, el círculo
vuelve a gris y el ámbar queda libre.

### 2.6 · Otras ausencias
- **"Anotar movimiento" en el drawer de día** (hoy solo "Confirmar el día").
- **Buscador a la izquierda, chips de eje a la derecha** (están invertidos).
- **"Hoy" con filo dorado** en el calendario.
- **Mes en curso:** "queda entrar" / "queda salir"; meses futuros: "entra" / "sale". No es lo mismo.
- Cabeceras de día `Lun · Mar · Mié…`, no `L · M · X`.

---

## FASE 3 · COLOR Y MAQUETACIÓN

### 3.1 · Color
- **Importes siempre `--ink`.** Fuera verde y rojo de filas y subtotales. El signo dice la dirección.
- **Círculo de previsto: gris vacío.**
- El color de estado vive **en el chip**, no en el importe ni en el círculo.

### 3.2 · Desbordamiento horizontal
Con la barra lateral abierta el contenido se sale por los dos lados: se cortan títulos por la
izquierda y "Añadir cuenta", el rango y media tarjeta por la derecha.
→ `min-width:0` en las columnas del grid y en `.main`; flechas superpuestas **dentro** del área
visible.

### 3.3 · Listas
- Grupos como **tarjetas** con borde: nombre + **subtotal**. Sin recuento pegado al importe
  ("INMUEBLE 1 · 1 · −98,44").
- Fuera las cabeceras de columna CONCEPTO / ORIGEN / IMPORTE.
- Ejes de agrupación como **chips**, activo en navy.
- **Círculo a la izquierda**, antes del concepto. Hoy está tras el importe.
- Compactar interlineado: caben cinco filas donde deberían caber nueve.
- Chips "Recurrente" / "Financiación": fuera. Si el origen aporta, va como subtítulo gris.
- **Subtítulos: si no aportan, no se pintan.** Nada de "Personal" repetido ni guiones de relleno
  ("Inmueble 3 · —").

### 3.4 · Drawer de día
- La fecha aparece **dos veces seguidas**: dejar una.
- Totales sin etiqueta, sin € y sin separador ("+2682,50") junto a otros bien formateados: **un
  único formateador en toda la app**.
- Celdas del calendario más cuadradas; el detalle del día empieza justo bajo la rejilla.

### 3.5 · Ficha de cuenta
- Es un wizard a pantalla completa; debe ser **formulario plano**: tipo de cuenta como tres botones
  de texto, sin tarjetas con icono.
- **La columna de vista previa sobra** (y además no reacciona: el campo dice 30.000 € y muestra
  0,00 €; y pinta la cuenta con un cuadrado de iniciales que no es como se ve en Tesorería).
- "MOVIMIENTOS VINCULADOS · 0" en un alta siempre dirá 0: fuera.
- El marcador del alias dice "Cuenta principal" y al lado hay un interruptor con ese mismo nombre.
- **Selector de color: paleta** (rejilla + estándar + "del banco" + Sin color), no doce círculos con
  tres rojos casi iguales.
- Al crear la **segunda cuenta del mismo banco**, proponer un color distinto: hoy Santander Nómina y
  Santander Alquileres comparten punto, y Sabadell y BBVA dos azules casi idénticos.

### 3.6 · Ficha de movimiento
- **Dos campos distintos llamados "Concepto"**: el libre pasa a **"Descripción"**.
- El título dice "Movimiento": debe llevar el concepto real.
- Lápiz y ✕ se pintan **debajo** de la fila y la desplazan: van inline, apareciendo por opacidad.
- Falta el **enlace a documento del Archivo** (adenda 02 · D6a).

### 3.7 · Varios
- Hero dice "9 cuentas", el carrusel "1–5 de 10": un solo origen.
- Mismo importe escrito de dos formas: `−4.424,99 €` en el hero y `↓ 4.424,99 €` en la tarjeta de
  mes. Un solo criterio.
- Subtítulo del calendario amputado: falta "concilia lo previsto contra lo real".
- Mayúsculas en etiquetas de formulario: sentence case.
- Reparto vertical invertido: todo apretado arriba y un tercio de pantalla vacío abajo.

---

## CRITERIOS DE ACEPTACIÓN

- [ ] Editar un recurrente N veces deja las mismas previsiones que editarlo una
- [ ] Recuento de duplicados reportado y limpieza aplicada solo sobre `predicted`
- [ ] Pendientes solo muestra fecha ≤ hoy; el contador cuadra
- [ ] La desviación refleja previsto original vs real (o está reportado por qué no puede)
- [ ] Confirmar es **un toque**, con Deshacer
- [ ] Las habitaciones cuelgan de su piso, con el piso plegable y su total
- [ ] No se puede navegar a meses anteriores al pendiente más antiguo; nunca a ejercicios cerrados
- [ ] Ningún mes sin datos muestra un cierre inventado
- [ ] El punto ámbar del calendario solo aparece en días que dejan una cuenta corta
- [ ] Cero importes en verde o rojo; ámbar solo en avisos reales
- [ ] Sin desbordamiento horizontal a 1440×900 con sidebar abierta
- [ ] Un único formateador de importes en toda la pantalla
- [ ] Checklist sección 17 de la guía pasado

**Sigue vigente: cualquier contradicción → para y reporta.**
