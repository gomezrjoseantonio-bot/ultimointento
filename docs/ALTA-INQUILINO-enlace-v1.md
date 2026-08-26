# Alta del inquilino por enlace · v1 (diseño)

**El casero manda un enlace · el inquilino rellena su alta y sube DNI y nómina ·
el casero revisa y confirma** · agosto de 2026

Documento de diseño. Aquí NO hay código todavía: hay el problema, por qué esta
función rompe una regla que el resto de ATLAS respeta, cómo se monta sin romperla
del todo, y qué decisiones tuyas faltan antes de escribir una línea.

---

## 1. El problema

Hoy, dar de alta a un inquilino es teclear. El casero tiene el DNI en una foto de
WhatsApp, la nómina en un PDF que le mandaron por correo, el nombre y el IBAN en
una servilleta, y lo pasa todo a mano al contrato. Es lento, se cometen erratas
—un número de DNI mal copiado invalida un contrato—, y los documentos acaban
dispersos en tres apps distintas.

El competidor `gestionhabitaciones.es` resuelve esto con un enlace: el casero se
lo manda al inquilino, el inquilino abre una página, rellena **sus** datos y sube
**sus** documentos, y al casero le llega el alta hecha. El inquilino no se instala
nada.

Eso es lo que se diseña aquí.

## 2. Por qué esta función es distinta de todo lo demás de ATLAS

Todo ATLAS vive en **el dispositivo del casero**. La base de datos es IndexedDB,
en su navegador. Él abre la app, él teclea, el dato se queda ahí. No hay servidor
con los datos: hay ficheros estáticos (los índices) y funciones sin estado (OCR).

Un inquilino, en **su** móvil, abriendo un enlace, **no puede escribir en la
IndexedDB del casero**. Son dos navegadores que no se tocan. Esta es la primera
función de ATLAS en la que un tercero —alguien que no es el dueño de los datos—
tiene que **meter** información en el sistema.

Eso obliga a algo que ninguna otra parte de ATLAS necesita: un **buzón en el
servidor**. Un sitio, fuera del dispositivo del casero, donde el inquilino deja lo
suyo y de donde el casero lo recoge.

```
  Inquilino (su móvil)                    Casero (su navegador)
  ─────────────────────                   ─────────────────────
  abre /alta/<token>                      abre ATLAS
  rellena datos                           «¿altas pendientes?» ──┐
  sube DNI + nómina                                              │
        │                                                        │
        └──────────►  BUZÓN (Netlify Blobs)  ◄───────────────────┘
                      cifrado · con caducidad        importa a IndexedDB
                                                     el casero REVISA y confirma
```

El buzón es el único sitio nuevo. Todo lo demás ya existe.

## 3. La buena noticia: media pieza ya está construida

No se parte de cero. Verificado en el repo:

| Lo que hace falta | Lo que ya hay | Dónde |
|---|---|---|
| Almacén en servidor | **Netlify Blobs** (`getStore`) | `functions/ocr-fein-bg.ts:7` — ya guarda trabajos de OCR en background |
| Leer el DNI y la nómina | OCR de documentos | `functions/ocr-documentai.ts`, cadena `ocr-fein-*` |
| El destino del alta | `Contract` con `unidadTipo:'habitacion'`, `habitacionId`, inquilino, cotitulares | `src/services/db/types-contratos.ts` |
| Servir páginas públicas sin login | funciones Netlify + SPA | ya desplegado |

Lo genuinamente nuevo es: **el enlace con token**, **la página de formulario
pública**, **el buzón cifrado**, y **el flujo de recogida y confirmación**.

## 4. Las piezas

```
functions/alta-crear.ts        el casero pide un enlace → devuelve token + URL
functions/alta-form.ts         sirve la página pública del formulario (GET /alta/<token>)
functions/alta-enviar.ts       recibe datos + ficheros del inquilino → los guarda cifrados
functions/alta-pendientes.ts   el casero pregunta «¿qué altas hay para mí?»
functions/alta-descargar.ts    el casero se trae una alta concreta para importarla
src/services/altaInquilino/*   cliente: crear enlace, sondear, importar a IndexedDB
src/modules/alquileres/...     UI: botón «enviar alta», bandeja de pendientes, revisión
```

## 5. El dato: un alta pendiente NO es un inquilino

Lo que el inquilino manda **no entra como inquilino**. Entra como un objeto aparte,
`AltaPendiente`, que vive en el buzón y —cuando el casero lo trae— en un store
propio de IndexedDB. Solo se convierte en `Contract`/inquilino cuando **el casero
lo confirma**.

```ts
interface AltaPendiente {
  esquema: 1;
  token: string;              // el mismo del enlace · identifica el buzón
  inmuebleId: number;         // a qué piso pertenece · lo fija el casero al crear
  habitacionId?: string;      // a qué habitación, si ya se sabe
  estado: 'esperando' | 'recibida' | 'importada' | 'caducada';
  enviadoEn: string | null;   // cuándo rellenó el inquilino · null si aún no
  datos: {
    nombre?: string;
    nif?: string;
    email?: string;
    telefono?: string;
    iban?: string;
    // … lo que el inquilino teclea. TODO opcional: un alta a medias es válida
    //    como borrador · lo que no vale es que entre sola sin que el casero mire.
  };
  documentos: DocumentoAdjunto[]; // DNI, nómina · referencias a los ficheros del buzón
  ocr?: {                          // lo que la máquina leyó de los documentos
    nifLeido?: string;             // para CONTRASTAR con lo que tecleó el inquilino,
    nombreLeido?: string;          // no para sustituirlo · si difieren, se avisa
  };
}
```

Dos decisiones de fondo, las mismas que gobiernan el resto de ATLAS:

- **El silencio no es una respuesta.** Si el OCR lee un DNI distinto del que tecleó
  el inquilino, no se elige uno callando: se enseñan los dos y el casero decide.
  Un alta que llega a medias se dice que está a medias; no se rellena el hueco con
  lo que «probablemente» sea.
- **Lo automático no pisa lo manual.** El OCR **propone**; quien confirma es el
  casero. Nada se convierte en un inquilino real —con su contrato, su fianza, su
  renta— sin ese gesto suyo. Igual que los índices proponen y no rellenan la
  casilla del euríbor que puso él a mano.

## 6. El pero grande: esto maneja el dato más sensible de la app

Un DNI y una nómina de **otra persona** son categoría especial. Esto sube el listón
de golpe, y el diseño tiene que cargar con ello desde el principio, no parchearlo
después:

- **Base legal (RGPD).** El casero es el responsable del tratamiento; ATLAS/Netlify,
  el encargado. Hace falta decir para qué se piden estos datos (formalizar el
  arrendamiento) y no usarlos para otra cosa. La página del formulario lleva su
  aviso de privacidad y el inquilino consiente antes de subir nada.
- **Minimización.** Se pide lo que el contrato necesita y nada más. La nómina, si se
  pide, es para acreditar solvencia; si no hace falta, no se pide.
- **Cifrado en reposo.** Lo que se guarda en el buzón va cifrado. La clave no vive
  en el buzón.
- **Caducidad y borrado.** El buzón no es un archivo. Un alta caduca (p. ej. 30
  días) y, sobre todo, **se borra del servidor en cuanto el casero la importa**: el
  destino final del dato es el dispositivo del casero, no el buzón. El buzón es un
  tránsito, no una residencia.
- **El casero confirma.** Ver §5. Ningún dato sensible entra en la vida real de la
  app sin que un humano lo mire.

Esto **no** es «lo monto esta tarde». Es un diseño con su documento —este— igual
que los índices.

## 7. El token: el enlace tiene que ser una llave, no una dirección

El enlace es lo único que separa a un inquilino legítimo de cualquiera. Reglas:

- **Imposible de adivinar.** Token largo y aleatorio, no un número correlativo.
  `/alta/7` sería una invitación a fisgar las altas ajenas; `/alta/9f3a…` no.
- **Acotado a un piso.** Un token sirve para **una** alta de **un** inmueble. No es
  una llave maestra del casero.
- **Caduca.** Pasado su plazo, el enlace deja de aceptar envíos.
- **Revocable.** El casero puede anular un enlace que mandó por error, y el que lo
  reciba después se encuentra la puerta cerrada.
- **Un envío, no muchos.** Tras recibir el alta, el enlace se cierra: no es un
  formulario público permanente.

## 8. Qué hace y qué no hace el OCR aquí

Hace: leer el DNI y la nómina para **contrastar** con lo que tecleó el inquilino y
avisar de discrepancias, y para ahorrarle teclear si el inquilino no rellenó algo.

No hace: decidir. Si el OCR y el inquilino no coinciden, gana la revisión del
casero. El OCR nunca marca un alta como «buena»; eso solo lo hace un humano.

## 9. Cómo se comporta cuando algo falla

- **El inquilino sube una foto ilegible** → se le dice en el momento («no se lee el
  DNI, vuelve a hacer la foto»), no se acepta en silencio un documento inútil.
- **El buzón no responde** → el inquilino ve un error claro y puede reintentar; no
  se queda con la duda de si se envió o no.
- **El casero importa y falla a mitad** → el alta sigue en el buzón marcada como no
  importada; no desaparece por un fallo de red.
- **Dos altas para la misma habitación** → se enseñan las dos; no se pisa una con la
  otra.

## 10. Qué NO entra en la v1

- **Firma digital del contrato en el mismo enlace.** Encaja aquí (ya hay
  `functions/pandadoc-test.ts` tanteando PandaDoc), pero suma un proveedor externo
  y más superficie sensible. Es la **v2**, sobre esta base.
- **Portal permanente del inquilino** (que entre cuando quiera a ver su estado). Esto
  es un alta puntual, no una cuenta. Otro producto.
- **Notificación automática de reparto de gastos al inquilino.** Es la otra idea
  buena del competidor, pero es un camino distinto (salida de correo recurrente);
  se diseña aparte.

## 11. Decisiones tuyas antes de escribir código

1. **¿La nómina es obligatoria u opcional?** Cambia qué se pide y qué se cifra.
2. **¿Cuánto vive un enlace?** 7 días, 30, hasta que se use.
3. **¿El inquilino ve el contrato antes de firmar (v2) o esta v1 es solo recoger
   datos?** Marca la frontera v1/v2.
4. **¿Quién es el responsable RGPD cara al inquilino: tú como casero, o la marca
   ATLAS?** Decide de quién es el aviso de privacidad de la página pública.
5. **¿Netlify Blobs es suficiente para guardar ficheros con DNI/nómina, o quieres
   un almacén con cifrado gestionado?** Afecta al coste y a la letra pequeña.

Con esas cinco respuestas, el siguiente paso es el mismo patrón que los índices:
las piezas de §4, una a una, con tests, sin tocar nada de lo que ya funciona.
