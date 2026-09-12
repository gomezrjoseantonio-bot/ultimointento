# Rediseño de la pantalla de CONCILIACIÓN · 3 zonas · agrupar por ENTIDAD · VERIFICACIÓN

PR #1872 · preflight: `docs/VERIFICACION-conciliar-rediseno-preflight-2026-09-12.md` · decisiones de Jose P1-P4 (12 sep).

## 1 · Qué se ha hecho

| Pieza | Fichero | Qué |
|---|---|---|
| Agrupar por entidad | `conciliar/agruparPorEntidad.ts` (nuevo, puro) | `claveDeEntidad`: 1 identificador fuerte (`cups:` · `contrato:` · `nif:` · `iban:` · `tarjeta:`) derivado con `identificadoresDeMovimiento` (el mismo del motor) · 2 el previsto/confirmado con el que casó · 3 la contraparte (columna, o el concepto sin referencias) + familia · 4 los internos → una entidad por subtipo («Traspasos entre tus cuentas», «Ahorro · lo que apartas»…). `agruparPorEntidad` da nombre, renglón pequeño, destino (piso si lo sabe), icono, nº, total y las líneas. `resumenDelFlujo` da el hero (entró / salió por familia, internos aparte, rango real). |
| Zona 1 · Hero | `conciliar/HeroConciliar.tsx` + `.module.css` (nuevos) | patrón `HeroTesoreria` (navy de módulo, rampa `on-navy`, cero hex) · cuenta en blanco · «desde el D/M/AAAA a D/M/AAAA · N movimientos» · saldo del último día = `PropuestaDeApertura.saldoBanco` a `fecha` (sin calcular nada; sin saldo, «el fichero no trae saldo») · Entró / Salió con 3 familias gordas · `MoneyValue` en tinta · «Otro fichero». |
| Envoltorio de entidad | `conciliar/GrupoEntidad.tsx` (nuevo) | cabecera plegable (icono · nombre + chip `Pill` oro · sub · nº en su unidad · importe en TINTA o «neutro») · acciones fuera del botón de plegar · detalle debajo. |
| Zona 2 · Confirma el destino | `conciliar/TarjetaAccion.tsx` (reorientada a entidad) · `PanelConciliar.tsx` | borde oro · banda de propuesta (tono, titular, ayuda, «se recordará») · «lo aplico a los N» · botones: **Clasificar los N como…** (oro · ficha una vez) · **botones de piso** (P1 · ficha prerrellenada con familia/subtipo del motor + ese piso) · **Es personal** · **Ignorar los N** · **Son traspaso a** (solo cargos) · buscador + atajos + casilla por entidad + barra en bloque (lo que ya existía) · dentro, el `LineaExtractoItem` de siempre. |
| Zona 3 · Colocado en su sitio | `conciliar/ZonaColocado.tsx` (nuevo · sustituye a `ColumnaResto.tsx`) | borde navy · barra «ATLAS colocó N movimientos en M entidades · Está todo bien · confirmar» (oro) · **OK** por entidad (oro, no verde) · las dadas por buenas se retiran y quedan plegadas con «deshacer» · detalle con fecha, texto del banco, etiqueta de ejes, «No es esto» por línea y «Reasignar los N» · internos «no cuenta como gasto ni ingreso» · Ignorados con «reactivar» · «La próxima vez, sola». **P2: nada de esto escribe**; solo «Guardar extracto» escribe, y se destaca cuando ya no queda nada por confirmar. |
| Ficha | `prerrellenoDeFicha.ts` · `clasificarVariasEnSesion.ts` (hook puro, nuevo) · `DrawerExtracto.tsx` | la ficha recibe familia/subtipo que el motor ya sabía y el piso elegido (`null` = personal) · el drawer solo pasa `inmuebles` y los dos gestos · `DrawerExtracto.tsx` se queda en 798 líneas. |
| CSS | `conciliar/PanelConciliar.module.css` | cabeza nueva (una columna con scroll, sección, entidad, botones oro/fantasma, barra de visto bueno, OK) · se conservan la banda de propuesta, bloques, filas, buscador, barra en bloque y pie · fuera la cabecera de 4 KPI y la barra de reparto. |

**Sin cambio:** `conciliarBuckets.ts` (quién va a qué montón), `confirmarDecisiones`, `LineaExtractoItem`, `FichaMovimiento`, el cálculo de saldo/apertura, el motor. `YaEstaban` y `CuadreConElBanco` intactos (P4). Sin `DB_VERSION` (94), sin migración.

## 2 · Con los fixtures

**Abanca (49 líneas, fichero real anonimizado)** · `agruparPorEntidad.test.ts`: **11 entidades**, ninguna línea perdida.

| Entidad | Nº | Destino |
|---|---|---|
| Ahorro · lo que apartas (AHORRO / AHORROS / AHORRO JULIO…) | 8 | interno · no cuenta como gasto ni ingreso |
| GC re FINUTIVE · gestoría | 8 | Gasto · Gestión · Gestoría |
| INTERESES CTA. · interés | 8 | Ingreso · Rendimiento · Interés |
| UNIHOUSER S.L. (facturas) | 5 | sin clasificar · pide decisión |
| Traspasos entre tus cuentas (el titular) | 5 | interno |
| TGSS (3 variantes de texto) | 4 + 4 + 1 | Gasto · Cuota RETA |
| IMP · NIF (IVA 303) | 3 | sin clasificar (D4) |
| UNIHOUSER S.L. · préstamo p2p (las 2 cuotas del store) | 2 | Ingreso · Inversión · Préstamo P2P |
| JUNIO | 1 | sin clasificar |

Hero de Abanca: 49 movimientos · 13/01/25 a 29/08/25 · 13 entre tus cuentas · Entró: Inversión, Cuota RETA (la devolución), Rendimiento · Salió: Cuota RETA, Gestión.

**Santander / Sabadell / …** · el resto de fixtures pasan por el mismo camino (`corregirYEnBloque.test.tsx`: cinco líneas del Sabadell → cinco entidades, buscar «bizum», elegir las 3, ignorar / clasificar / traspasar en bloque).

## 3 · Verificación

| Qué | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npx eslint` sobre lo tocado (componentes, drawer, hooks, tests nuevos y adaptados) | limpio · los 45 avisos de `jest/no-conditional-expect` que salen al lintar la carpeta entera ya están en `main` (tests antiguos) |
| `CI=true npx react-scripts build` | `Compiled successfully` · 0 avisos |
| Carpeta `tesoreria/v6` | 40 suites · 547 tests en verde (+43 nuevos/adaptados) |
| Suite completa | 24 suites / 100 tests rojos · **el mismo conjunto que `main`** · 6.542 en verde |
| Trinquete `--base-main` | OK · todos 230 · archivos_800 37 · no_v5 106 · servicios_muertos 0 |
| Colores (guía V5 §2.2.1) | `grep tone="auto|pos|neg"` en `conciliar/` = **0** · hex en los CSS nuevos = 0 · `--pos`/`--neg` solo en estado (icono de bloque, pie «No cuadra», aviso de error) · fondo oro-wash solo en la barra de visto bueno · cero amarillos |
| `DB_VERSION` | 94 · sin migración |

## 4 · Hallazgos y lo que queda fuera

- **El identificador de entidad no se persiste** (preflight §2): se deriva al agrupar. Si algún día se quiere buscar «todas las líneas de este CUPS» fuera de la sesión, habrá que guardarlo en la fila; hoy no hace falta.
- **La TGSS sale en tres entidades** en Abanca (el banco escribe «052107081079 T.G.S.S.-R.E. AUTONOMOS», «TGSS. COTIZACION 005 R.E.AUTONOMOS» y «DDPP de la TGSS de ALICANTE»): el nº de afiliación de 12 dígitos no es un identificador que el extractor reconozca. Las tres van a «Colocado en su sitio» con su familia; es cosmético. Si Jose quiere una sola, se añade `afiliacion_ss` al extractor de identificadores en su propia tarea.
- **El saldo/apertura** no se toca (debe aparte). **Proponer recurrentes** (E2.5) y el catálogo nacional (E2.6) quedan donde estaban.
