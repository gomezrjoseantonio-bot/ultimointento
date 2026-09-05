# Deuda · retomar las líneas pendientes de un extracto (§4.7 · D4)

> **RESUELTA (E1.3 · E1.5 · E1.6, sep 2026).** Retomar una sesión a medias existe desde E1.3 (`lotesAMedias` · `reabrirLote`) y se apoya en las líneas persistidas de `lineasExtracto` con su decisión, no en `ImportBatch.lineasPendientes`. Tras el corte (E1.5) consolidar no borra nada, y el campo `lineasPendientes` se retiró del tipo en E1.6 sin que nadie lo escribiera ni leyera. Lo que sigue es el texto original, como registro.


**Abierta en:** Tesorería V6 §4.7 · drawer de extracto
**Dónde vive el dato:** `ImportBatch.lineasPendientes`

## Qué pasa hoy

§4.7 dice que lo no resuelto *"no se mezcla con la lista de la cuenta: **espera en
el extracto**"*, y D4 lo concreta: *"lo que quedó sin resolver **no se
materializa**: sigue pendiente en la sesión de importación hasta que se asigne,
se cree o se ignore"*.

Eso está implementado. Al pulsar Guardar, las líneas que siguen en "a resolver":

1. se **borran** de `movements` — `processFile` las había insertado, y dejarlas
   habría hecho que aparecieran en la lista de la cuenta como conciliadas en
   cuanto la sesión dejase de ser borrador;
2. su identidad (hash, fecha, importe, concepto) queda guardada en
   `ImportBatch.lineasPendientes`.

## Qué falta

**No hay UI para volver a ese extracto y resolverlas.** El dato está guardado y
es suficiente para pintarlas sin releer el fichero, pero nadie lo lee todavía.

Hoy la única forma de recuperarlas es volver a subir el mismo fichero: la
protección por `hashLote` avisa de que ya se importó y "Importar de todas
formas" las trae de vuelta. Funciona, pero es un rodeo que el usuario no tiene
por qué deducir.

## Lo que haría falta

Una entrada a los extractos con líneas pendientes — dentro del propio drawer al
abrirlo sobre una cuenta que tenga alguna, o como aviso en la tarjeta de cuenta.
Al abrirla, reconstruir la sesión desde `lineasPendientes` (no hace falta el
fichero) y ofrecer las mismas tres acciones: asignar, crear o ignorar.

No se hizo en §4.7 porque la sección no la especifica y añadirla a ojo habría
sido inventar pantalla. Conviene decidirlo con el mockup delante.

## Por qué no es urgente

Ninguna cifra sale mal por esto: las líneas pendientes no cuentan en ningún
saldo, que es justo lo que pide la spec. La deuda es de **accesibilidad del
flujo**, no de corrección de datos.
