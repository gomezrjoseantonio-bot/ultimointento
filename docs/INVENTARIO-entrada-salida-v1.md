# Inventario de entrada y salida · v1 (diseño)

**El estado del inmueble el día que entra un inquilino y el día que se va · para
que la fianza se liquide con pruebas, no de memoria** · agosto de 2026

Documento de diseño. Aquí no hay código: hay el problema, por qué esta pieza es la
fácil de las dos que decidió Jose (la otra es el alta por enlace), y cómo se monta
sobre lo que ya existe.

**Supuesto de partida, decisión de Jose:** ATLAS **no lleva la relación con el
inquilino**. El inventario lo hace el casero solo —recorre el piso, fotografía,
anota el estado—. El inquilino no firma aquí ni entra a nada. Si algún día se
quisiera su conformidad, eso usaría la infraestructura del alta por enlace (§6); no
es esta v1.

---

## 1. El problema

La fianza es donde acaban los conflictos. El inquilino se va, y hay que decidir si
se le devuelve entera, en parte, o nada. Hoy el contrato ya sabe **cuánto** es la
fianza y en qué estado está (`fianzaMeses`, `fianzaImporte`,
`fianzaEstado: retenida | devuelta_parcial | devuelta_total`), pero **no sabe por
qué** se retuvo parte. Esa justificación vive en la memoria del casero y en fotos
sueltas del móvil.

Un inventario es la respuesta: una foto del estado **el día de entrada** y otra
**el día de salida**. La diferencia entre las dos es lo que, en su caso, justifica
una retención. Sin eso, retener fianza es la palabra del casero contra la del
inquilino.

## 2. Por qué esta es la fácil

A diferencia del alta por enlace, aquí **nadie de fuera mete datos**. Lo rellena el
casero, en su dispositivo, como todo lo demás de ATLAS. Así que:

- **No hace falta buzón en servidor.** El inventario vive en IndexedDB, local.
- **No hay dato sensible de terceros.** Son fotos de un piso, no el DNI de nadie.
- **No hay token, ni caducidad, ni cifrado en tránsito, ni RGPD de un tercero.**

Es una entidad más de ATLAS, colgada del contrato. Nada nuevo de infraestructura.

## 3. Sobre qué se apoya, que ya existe

| Lo que hace falta | Lo que ya hay | Dónde |
|---|---|---|
| Guardar las fotos | store `documents` con `entityType:'contract'` + `entityId` | `types-inmuebles.ts:669` |
| Saber la fianza y su estado | `Contract.fianzaImporte`, `fianzaEstado`, `fianzaDevuelta` | `types-contratos.ts:222` |
| Comprimir imágenes | ya se hace para `Property.foto` (base64, máx 500 KB) | `types-inmuebles.ts:109` |
| El inmueble y sus habitaciones | `Property`, `Habitacion`, `Contract.habitacionId` | modelo actual |

## 4. El dato

Un inventario es una foto del estado ligada a un contrato y a un momento (entrada o
salida). Por dentro, una lista de elementos con su estado y sus fotos.

```ts
interface Inventario {
  esquema: 1;
  id?: number;
  contratoId: string;         // a qué contrato pertenece
  inmuebleId: number;
  habitacionId?: string;      // si el contrato es de una habitación
  momento: 'entrada' | 'salida';
  fecha: string;              // ISO · el día que se levantó el acta
  elementos: ElementoInventario[];
  notaGeneral?: string;
  cerrado: boolean;           // un acta cerrada no se edita · es una foto del día
}

interface ElementoInventario {
  zona: string;               // 'cocina', 'baño', 'habitación 1'…
  concepto: string;           // 'encimera', 'colchón', 'paredes'…
  estado: 'nuevo' | 'bueno' | 'usado' | 'dañado';
  nota?: string;
  fotos: number[];            // ids en `documents` · las pruebas
}
```

Dos actas por contrato como mucho vivas: una de entrada, una de salida. La de
entrada se levanta al firmar; la de salida, al irse.

## 5. Lo que hace de verdad: comparar, no solo guardar

Guardar fotos no resuelve nada —eso ya lo hace un móvil—. Lo que aporta es
**enfrentar las dos actas**: para cada elemento, su estado de entrada al lado del
de salida. Lo que empeoró salta a la vista, con las dos fotos juntas.

Y de ahí sale la única conexión con el dinero, que es el sentido de todo esto:
cuando el casero liquida la fianza, ATLAS **propone** —no impone— una devolución
razonada. «El colchón pasó de bueno a dañado» es el argumento que acompaña a una
retención; el casero decide el importe y ATLAS lo escribe en `fianzaDevuelta` y
mueve `fianzaEstado`. Las reglas de siempre:

- **Lo automático no decide.** ATLAS enseña qué empeoró; el casero pone el número.
- **El silencio no es una respuesta.** Un elemento sin foto de entrada se dice que
  no se puede comparar, no se asume que estaba bien ni que estaba mal.
- **Un acta cerrada no se reescribe.** Es la prueba de un día; si se pudiera
  cambiar después, no probaría nada.

## 6. Lo que NO entra en la v1

- **La conformidad del inquilino sobre el inventario.** Que el inquilino vea el acta
  y la firme sería útil, pero eso es meter a un tercero —y Jose ha dicho que la
  relación con el inquilino no vive en ATLAS—. Si algún día se quiere, se apoya en
  el enlace del alta (mismo mecanismo, `docs/ALTA-INQUILINO-enlace-v1.md`), no en
  algo nuevo.
- **Inventario de equipamiento con valor/amortización.** Eso es fiscal y ya vive en
  `mueblesInmueble`. El inventario de estado no es una lista de bienes para
  amortizar; es una prueba del estado. Son cosas distintas y no se mezclan.
- **Plantillas de acta por tipo de inmueble.** Útil para no empezar de cero cada
  vez, pero es comodidad, no la esencia. Después.

## 7. Decisiones tuyas antes de escribir código

1. **¿Store propio `inventarios`, o lo cuelgo del contrato?** Un store propio lo
   hace consultable e indexable por contrato/inmueble; colgarlo del contrato es
   menos ligero pero evita un bump de esquema. Me inclino por **store propio** (es
   una entidad con vida y fechas), pero es tu llamada porque cada store físico es un
   bump de versión de la base.
2. **¿Lista de zonas/elementos fija o libre?** Una lista sugerida (cocina, baño,
   salón…) va más rápido; texto libre es más flexible. Se puede empezar sugerida y
   dejar añadir.
3. **¿La liquidación de fianza asistida entra en esta v1, o primero solo levantar
   actas y comparar?** Lo segundo es más pequeño y ya aporta; lo primero cierra el
   círculo con el dinero.

Con eso, el siguiente paso es el patrón de siempre: la entidad, la pantalla de
levantar acta, la de comparar entrada/salida, con tests, sin tocar nada de lo que
ya funciona.
