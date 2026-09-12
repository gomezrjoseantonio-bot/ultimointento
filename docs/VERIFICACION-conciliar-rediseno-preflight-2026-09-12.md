# Rediseño de la pantalla de CONCILIACIÓN · PREFLIGHT

Tarea: `TAREA-CC-implementar-pantalla-conciliacion.md` · mockup `mockup-conciliacion_11.html` · reforma de `src/modules/tesoreria/v6/conciliar/` (no pantalla nueva). Estado: **para el OK de Jose · sin código**.

## 1 · Cómo agrupa hoy y dónde se cambia

| Qué | Dónde | Hoy |
|---|---|---|
| Columna derecha («el resto») | `conciliar/ColumnaResto.tsx:79` → `agruparResueltas(lineas)` | agrupa por **texto**: `agruparResueltas.ts:82-124`, clave = `claveDeGrupo(nombreDeLineaResuelta(l))` (`:49-56`, quita números y puntuación). Desde fix2 (#1869) el nombre ya es la etiqueta de los ejes cuando el motor clasificó (`:64-68`), pero sigue siendo una clave de texto: dos CUPS distintos de Iberdrola caen juntos y una persona con dos conceptos cae partida. |
| Columna izquierda («te necesitan») | `conciliar/PanelConciliar.tsx:305-325` | **no agrupa**: una `TarjetaAccion` por línea, con el `LineaExtractoItem` del drawer dentro (`renderLinea`). Buscador + casilla + barra en bloque (`:117-156`, `:238-300`). |
| Buckets | `conciliarBuckets.ts:52-73` `bucketDeLinea` | decide en qué montón cae cada línea (cuadra · reconocida · auto por regla · clasificada por concepto · personal · te necesitan). **No se toca**: el rediseño agrupa DENTRO de cada montón, no cambia quién va a cuál. |
| Cabecera | `PanelConciliar.tsx:169-236` | navy propio con barra de reparto y 4 KPI (`.cab`, `.kpis`) · el cuadre de líneas colocadas (`:213-233`). |

**Cambio:** `agruparResueltas.ts` deja de ser «por texto» y pasa a **agrupar por ENTIDAD** (nueva función pura `agruparPorEntidad(lineas)`), y se usa en las DOS columnas (Zona 2 y Zona 3).

## 2 · ¿La línea trae los 4 ejes y el identificador de entidad?

- **Los 4 ejes sí**: `LineaExtracto.clasificacion` (`extractoSesion.ts:89-94`, mapeado en `:273` desde la fila persistida) · `ClasificacionLinea` (`services/clasificacion/tipos.ts`): `naturaleza · familia · subtipo · metodo · ambito · inmuebleId · sentido · origen · motivos`.
- **El identificador de entidad NO** · **hallazgo**: el motor extrae CUPS / nº contrato / IBAN / NIF al clasificar (`clasificarLinea.ts:206` → `identificadoresDeMovimiento`) pero **no lo guarda** en `ClasificacionLinea`; solo deja el motivo en texto. Tampoco se persiste en la línea el origen determinista (id del préstamo, contrato o posición): la línea solo lleva `previsto` / `confirmado` (`{ id, descripcion }`, `extractoSesion.ts:77-83`).
- **Salida sin migración (Regla A)**: derivarlo al agrupar con lo que ya hay y es puro: `identificadoresDeMovimiento({ description: textoBanco, counterparty: contraparte, reference: referencia })` (`identificadoresDelConcepto.ts:272-284`, tipos `cups | iban | nif | contrato | tarjeta`). Es lo mismo que hace el motor; no hay nada nuevo que persistir.

**Clave de entidad (en este orden):**
1. identificador fuerte del concepto · `cups:…` (punto de suministro), `contrato:…` (préstamo/póliza), `iban:…` (cuenta propia o ajena), `nif:…` (persona/empresa);
2. si cuadró con un previsto o confirmado · `previsto:<descripción normalizada>` (el contrato del inquilino, la cuota del préstamo);
3. si no · la contraparte (`contraparte` o el nombre en el concepto, `claveDeGrupo`) + familia/subtipo de la clasificación;
4. los internos (`clasificacion.naturaleza === 'movimiento_interno'`, o marcados traspaso/efectivo en la sesión) → una sola entidad «Traspasos entre tus cuentas» (con subgrupos por subtipo: a otra cuenta · a ahorro · a efectivo).

Así AHORRO/AHORROS = una entidad; las 2 cuotas de Unihouser = una entidad (`previsto`/origen «Cuota n/60 · Préstamo Socio · Unihouser») y las 5 facturas = otra (`nif`/contraparte UNIHOUSER, sin familia) que pide decisión.

## 3 · Qué se reutiliza y qué se reorienta

| Pieza | Qué | Decisión |
|---|---|---|
| `TarjetaAccion.tsx` (78 l.) | envoltorio de propuesta + `renderLinea` | **se reorienta** a tarjeta de ENTIDAD (Zona 2): cabecera (icono · nombre · sub · nº · importe en tinta · chip `gold-wash`) + pregunta + botones en bloque + desplegable con los `LineaExtractoItem` de siempre. El `Propuesta` de la primera línea da tono/titular/ayuda (`propuestaDeLinea.ts:47-58`). |
| `ColumnaResto.tsx` (274 l.) · `Monton` | los montones plegados de resueltas/personal/ignoradas | **se reorienta** a Zona 3 por entidad con ejes, «OK» por entidad, barra de visto bueno y «Reasignar» (= `onNoEsEsto` sobre todas las líneas de la entidad). Las ignoradas siguen plegadas con «recuperar». |
| `YaEstaban.tsx` (49 l.) | las filas del fichero que YA estaban en ATLAS (duplicadas del import) | **se deja como está**: no es «lo autoclasificado», es otra cosa (dedupe). La tarea la nombra por error; lo que hoy enseña «por texto» es `ColumnaResto`. |
| `CuadreConElBanco.tsx` | banco dice X / ATLAS calcula Y · casilla de apertura | **se deja como está**, debajo del hero (debe del saldo aparte). |
| `LineaExtractoItem` (vía `renderLinea`) | asignar · ignorar · traspaso · efectivo · crear | **intacto**: sigue siendo el único camino que escribe. |
| Buscador · barra en bloque (`PanelConciliar.tsx:117-156`, `:238-300`) | buscar y elegir varias | se mantiene en Zona 2, filtrando entidades; las acciones en bloque ya existen (`onClasificarVarias`, `onIgnorarVarias`, `onTraspasarVarias`) y son exactamente «una respuesta coloca todos». |

## 4 · Componentes V5

- **Hero**: `HeroBanner` del DS es blanco (prohibido en GESTIÓN, ver `HeroTesoreria.tsx:5-11`). El patrón de la casa es `HeroTesoreria.tsx` + `HeroTesoreria.module.css:53-58` (contenedor navy de módulo con la rampa `--atlas-v5-on-navy-*` remapeada, cero hex). → **`HeroConciliar.tsx`** nuevo siguiendo ese patrón, con `MoneyValue` (`tone="inherit"` dentro del navy), `Icons`. Sin dot de banco (se quita `colorBanco`).
- **Importes**: `MoneyValue` pinta en tinta por defecto (`MoneyValue.tsx:48`); no se pide `tone="auto"` en ningún sitio de esta pantalla. `importeConSigno`/`importeSaldo` de `formatoV6.ts:32,41` para los textos.
- **Chips**: `Pill` (`variant="gold"` para «Confirmar piso», `"warn"` solo para el nº de «Confirma el destino»).
- **Botón oro**: no hay `btnGold` en el DS; existe `.btnPieOro` en `PanelConciliar.module.css`. → clase `.btnOro` en el CSS del módulo con tokens (`--atlas-v5-gold`, `--atlas-v5-on-gold`), sin verde.
- **Iconos**: `Icons` (Lucide). Cero SVG a mano.
- **Ficheros**: `PanelConciliar.tsx` tiene 478 líneas; con 3 zonas pasaría de 800 (trinquete `archivos_800`). → se parte en `HeroConciliar.tsx`, `ZonaConfirmar.tsx`, `ZonaColocado.tsx`, `GrupoEntidad.tsx` y la pura `agruparPorEntidad.ts`, cada `.tsx` con `design-system/v5` (trinquete `ficheros_no_v5`).

## 5 · El saldo del hero · sin tocar el cálculo

- La fila persistida trae `saldo?` (`types-lineasExtracto.ts:82`), pero la línea de sesión no lo mapea (`extractoSesion.ts:260-274`).
- Lo que ya está calculado y a mano: `PropuestaDeApertura.fecha` + `saldoBanco` (`aperturaDerivada.ts:95-98`) = **el saldo que dice el banco a la línea más reciente**. Es justo «Saldo · último día». El drawer ya lo pasa (`apertura`, `DrawerExtracto.tsx:687`).
- **Decisión**: el hero enseña `apertura.saldoBanco` a `apertura.fecha` si existe; si no (fichero sin saldo) no enseña saldo. No se calcula nada nuevo, no se bloquea nada si no cuadra (eso sigue en `CuadreConElBanco`).
- **Entró / Salió por familia**: suma de `importe` por `clasificacion.familia` de las líneas con `naturaleza` ingreso/gasto (internos fuera), 3 familias gordas por lado, etiqueta `labelClasificacion`. Lo sin familia suma al total pero no sale como familia.

## 6 · Lo que cambia y lo que no

- **Cambia**: `agruparResueltas.ts` → `agruparPorEntidad.ts` (+ tests) · `PanelConciliar.tsx` (3 zonas, sin la barra de 4 KPI) · `TarjetaAccion.tsx` → tarjeta de entidad · `ColumnaResto.tsx` → Zona 3 · CSS del módulo · tests `PanelConciliar.test.tsx` y `conciliarPantalla.test.ts` (los casos que describen la cabecera de 4 montones y el agrupar por texto).
- **No cambia**: `conciliarBuckets.ts`, `DrawerExtracto.tsx` (salvo pasar `inmuebles` y quitar `colorBanco`), `confirmarDecisiones`, `LineaExtractoItem`, `FichaMovimiento`, cálculo de saldo/apertura, motor de clasificación. Sin `DB_VERSION`, sin migración.
- **Guardar** sigue siendo el único botón que escribe; el cuadre de LÍNEAS colocadas (`elCuadre.cuadra`, FASE 1: nada se pierde) sigue en el pie como puerta del Guardar. No es el cuadre del saldo.

## 7 · Preguntas antes de codificar

- **P1 · Botones de piso en «Confirma el destino»** («Fuertes Acevedo 32 · Otro piso · Personal»). Propongo que abran la ficha de siempre UNA vez, prerrellenada con la familia que ya sabe el motor y el piso elegido, y el usuario confirma; la ficha sigue siendo el único camino que escribe (y crea la fila fiscal). La alternativa, escribir directo sin ficha, es un camino nuevo de escritura. ¿Vale la ficha?
- **P2 · «OK» por entidad y «Está todo bien · confirmar»**. Propongo que sean *dar por bueno en pantalla* (la entidad desaparece de la lista, cuenta como vista) y que **Guardar extracto** siga siendo lo único que escribe, como hoy. ¿O quieres que «Está todo bien · confirmar» guarde directamente cuando «Confirma el destino» está vacío?
- **P3 · Entidad sin identificador** (bizums, transferencias de personas): la clave es el nombre de la contraparte. Dos Víctor con dos apellidos distintos serán dos entidades. ¿Vale?
- **P4 · `YaEstaban`** se queda como está (son las filas duplicadas del import, no lo autoclasificado). Lo que se reorienta es `ColumnaResto`. ¿De acuerdo?

## 8 · Verificación prevista

Fixtures de Abanca y Santander: entidades, no montones por texto · AHORRO/AHORROS una entidad · préstamo de socio en la suya · «Confirma el destino» solo con lo que pide decisión · Zona 3 con visto bueno en bloque y por entidad · grep `tone="auto"` en `conciliar/` = 0 · sin fondos amarillos · tsc, build, trinquete igual que `main`, suite sin rojas nuevas.
