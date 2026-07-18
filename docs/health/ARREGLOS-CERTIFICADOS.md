# ARREGLOS CERTIFICADOS · ATLAS

> **Rango** · VINCULANTE (PROTOCOLO DE GARANTÍA §3)
> **Qué es** · el test de regresión del proyecto. Cada bug arreglado añade una
> fila con un **comando de verificación** y el **valor exacto** que debe
> devolver. `npm run health:regresion` re-ejecuta TODOS los comandos de golpe:
> si alguno deja de dar lo esperado, un arreglo antiguo se ha roto.
>
> **Un arreglo ya no es un recuerdo — es un comando que se puede volver a
> lanzar en cualquier momento, incluso dentro de un año.**

## Cómo añadir una fila

1. Arregla el bug en un PR.
2. Escribe un comando de terminal que DEMUESTRE el arreglo y que devuelva un
   valor estable y exacto (idealmente un número: `… | wc -l` → `0`).
3. Añade la fila abajo. El comando va entre `` ` `` y el esperado entre `` ` ``.
4. Verifica con `npm run health:regresion` que la fila pasa antes de mergear.

Reglas del formato (las parsea `scripts/health.mjs --regresion`):

- El comando debe imprimir EXACTAMENTE el texto esperado (sin líneas extra).
- Prefiere comandos deterministas y de una sola línea de salida.
- El esperado se compara tras `trim()` (se ignoran espacios al principio/fin).

## Registro

| Fecha | Qué se arregló | Comando de verificación | Esperado |
|---|---|---|---|
