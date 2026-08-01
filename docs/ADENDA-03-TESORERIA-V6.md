# ADENDA 03 · TESORERÍA V6 · normalización de `hashLinea`, D6b y D3

**Fecha:** 1 agosto 2026
**Complementa a:** `ADENDA-02`. El resto sigue vigente.

> El hallazgo del hash vacío queda anotado como incidente de datos, no solo como bug corregido:
> mientras estuvo activo, la idempotencia por fichero no existía. Jose revisa sus datos reales.

---

## D1 · `hashLinea` → **opción 3** · normalizador de `duplicateDetection`, solo para el hash

**Corrijo lo que escribí en la adenda 02.** Allí dije que el hash de línea debía usar "la misma
función de normalización que use el emparejamiento". Estaba mal planteado: **identidad de línea y
emparejamiento son dos problemas distintos**.

| | Pregunta que responde | Familia |
|---|---|---|
| Emparejamiento | ¿esta línea del banco se corresponde con este previsto? | difuso · importe/fecha/referencia |
| `hashLinea` | ¿esta línea es la misma que ya vi antes? | identidad · determinista |

`hashLinea` pertenece a la familia de la deduplicación, no a la del matching. Por tanto la opción 3
**no es un apaño, es la correcta**: reutilizar el normalizador de `duplicateDetection`.

Descartadas:
- **Opción 1** — tocar el normalizador compartido cambia el emparejamiento en producción. Cambiar el
  motor vivo para resolver un campo nuevo es desproporcionado y arriesgado. No.
- **Opción 2** — `toLowerCase()` pelado. Tú mismo lo desaconsejas y con razón: cualquier variación de
  espacios, acentos o formato del banco rompe la identidad. No.

### Condiciones

1. **Reutilizar, no copiar.** El normalizador se importa de `duplicateDetection`; no se duplica en
   `batchHashUtils`. Si no está exportado como función independiente, extráelo allí y que
   `duplicateDetection` lo consuma — sin cambiar su comportamiento.
2. **Versionar el hash.** Prefijo de versión en el valor almacenado, p. ej. `v1:{hash}`. Motivo: si
   algún día cambia el normalizador, los `hashLinea` guardados dejarían de casar y las líneas
   ignoradas reaparecerían en silencio. Con prefijo, ese caso es detectable y tratable en vez de un
   fallo mudo.
3. **Dejar escrito en el código** (comentario en `catalogo`/`batchHashUtils` o donde corresponda) que
   `hashLinea` es identidad de línea y **no** criterio de emparejamiento, para que nadie los una
   "por coherencia" dentro de seis meses.
4. La unificación de normalizadores, si algún día procede, es **tarea aparte**. Aquí no.

---

## D6b · Confirmado: **la V6 sale sin botón y sin cascada** · deuda documentada

Confirmado tal cual. La V6 no lleva botón de regenerar y **no construye la cascada**.

- `regenerateMonthForecast()` se queda sin llamador de usuario. No se borra.
- La deuda se documenta **aislada y explícita**: hoy el producto no reacciona automáticamente a los
  cambios que afectan a las previsiones. Es un hueco real de arquitectura, no un detalle de UI.
- En el PR, deja escrito con precisión: qué disparadores harían falta (contratos, préstamos, gastos
  recurrentes, altas/bajas), qué garantía es innegociable (**solo toca `predicted`**, jamás
  confirmados, conciliados ni descartados) y qué alcance debería tener el recálculo (periodo
  afectado, no histórico).
- Esa tarea es la **siguiente prioridad** después de la V6.

---

## D3 · Los 13 → **siguen pendientes de Jose. No los escribas.**

Las traducciones de la adenda 02 son **propuesta mía, no decisión tomada**. Afectan a `categoryKey`,
que alimenta el tratamiento fiscal, y esas las valida Jose una a una. Hasta entonces:

- **No escribas ninguna de las 13** en la tabla de mapeo.
- Se quedan como `PENDIENTE-JOSE` con `categoryKey: null` y el candado del test activo. Está bien
  como lo dejaste.
- Tampoco apliques todavía el cambio estructural propuesto (partir "Reparación y conservación" en
  dos familias y desdoblar `ropa_cama_lavanderia`): arrastra cinco de las 13 y depende de la misma
  validación.
- `comunidad:derrama` tienes razón en que probablemente **no sea una entrada de tabla**: la propuesta
  es que se pregunte por movimiento (conservación → deducible · mejora → `mejorasInmueble`,
  amortizable). Si esa pregunta no cabe en el alcance de la V6, se saca a tarea propia y la derrama
  se queda en `null`.

Nada de esto bloquea §4: la ficha muestra presentación y guarda `categoryKey` cuando existe; para las
pendientes, el test ya impide inventarse una.

---

## Arranque

Con D1 respondida, cierra el flujo de ignorar y sigue con las cinco fricciones aprobadas de
`PunteoList` y el resto de §4, en rama nueva desde el main actual.

**Sigue vigente: cualquier contradicción nueva → para y reporta.**
