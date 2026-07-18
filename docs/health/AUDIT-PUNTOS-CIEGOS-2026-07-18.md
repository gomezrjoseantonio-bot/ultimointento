# AUDITORÍA DE PUNTOS CIEGOS · las 16 definiciones

> **Momento** · antes del bloque 2
> **Origen** · el descubrimiento de que `enlaces_rotos` no veía `onNavigate(`. Si un indicador tenía un punto ciego, los demás probablemente también.
> **Regla eje** · ampliar una definición siempre está permitido. Si al ampliar el número sube, **ese es el nuevo baseline, no una regresión.**

Todo número "antes" es el baseline en `main` (`c321dd8`). "después" es tras la ampliación. Las subidas por ampliación quedan **eximidas del trinquete solo en la transición** (`AMPLIACIONES` en `scripts/health.mjs`): la exención se auto-desactiva cuando `main` incorpora el nuevo número, así que **no oculta subidas futuras**.

## Resumen

| # | indicador | antes | después | acción |
|---|---|---:|---:|---|
| 1 | stores_fantasma | 4 | 4 | sin punto ciego real |
| 2 | stores_no_tipados | 3 | 3 | sin punto ciego real |
| 3 | lecturas_store_inexistente | 0 | 0 | ampliado (transaction/objectStore) · 0 impacto |
| 4 | servicios_muertos | 33 | 33 | **reporta** · mejorar detección bajaría → requiere tu autorización |
| 5 | rutas_huerfanas | 20 | 19 | ampliado (nav) · −1 falso huérfano |
| 6 | enlaces_rotos | 0 | **1** | **ampliado** (onNavigate/window.location) |
| 7 | hex_hardcoded | 974 | **1689** | **ampliado** (3díg, rgb/hsl, tailwind, config) |
| 8 | emojis_ui | 124 | 124 | **no ampliado** (ruido en .ts) |
| 9 | iconos_no_lucide | 0 | 0 | **reporta** (27 SVG inline sin medir) |
| 10 | kpis_hardcoded | 9 | 9 | **reporta** (caso peor no mecanizable) |
| 11 | todos_totales | 270 | 270 | ampliado (.js) · 0 impacto |
| 12 | archivos_800 | 49 | **53** | **ampliado** (.css/.js) |
| 13 | pct_v5 | 23.5 | **40.1** | **ampliado** (CSS modules) |
| 14 | prs_abiertos | NO MEDIBLE | medible en CI | **implementado** (API GitHub) |
| 15 | tests_rojos | 44 | 44 | sin punto ciego relevante |
| 16 | ccaa_no_verificadas | 18 | 18 | **reporta** (escalas sin flag) |

---

## Fichas

### 1 · stores_fantasma — 4 → 4
- **Ve**: claves de la interfaz `AtlasHorizonDB` sin `createObjectStore('literal')`, excluyendo `deleteObjectStore` y `@deprecated/@legacy`.
- **No veía**: `createObjectStore(VARIABLE)` o bajo guard de versión (el aviso de la auditoría con `valoracionesActivos`).
- **Ampliación**: ninguna necesaria. Verificado: **0** `createObjectStore` no-literales en `db.ts`. El guard de versión no afecta (el literal se ve igual). **Residuo documentado**: si algún día se crea un store con nombre en variable, no se vería.

### 2 · stores_no_tipados — 3 → 3
- Mismo caso que #1: `createObjectStore` es siempre literal → sin punto ciego en la práctica. Residuo idéntico.

### 3 · lecturas_store_inexistente — 0 → 0
- **Ve**: `get/getAll/getAllFromIndex/getFromIndex/count('X')` sobre store fantasma sin guard `contains('X')`.
- **No veía**: accesos vía `transaction('X')` / `objectStore('X')`.
- **Ampliado**: ahora también cuenta `transaction`/`objectStore` sobre fantasma (abrir tx sobre store inexistente también lanza `NotFoundError`). **Impacto 0** (los aparentes matches eran `gastosInmueble`, store real). **Residuo**: nombre de store en variable (`const S='…'; db.getAll(S)`).

### 4 · servicios_muertos — 33 → 33 · REPORTA, no toco
- **Ve**: `services/*.ts` cuyo basename no aparece en ningún `from/import '…/basename'`.
- **No ve bien**: `import()` dinámico (sí, por el `\(?`), re-export por barrel (sí, por `from`), pero un servicio re-exportado por un barrel que **nadie consume** cuenta como "vivo" (falso vivo); y un importador por **alias de path** raro podría no verse.
- **Dirección del arreglo**: mi cifra (33) es **mayor** que la manual de la auditoría (30) → tengo ~3 **falsos muertos** (servicios que marco muertos pero que sí se usan por un patrón que no veo). Mejorar la detección **bajaría** el número → eso es **estrechar** → por gobernanza **requiere tu autorización explícita**. **Reporto y no lo aplico.** Hallazgo para decidir.

### 5 · rutas_huerfanas — 20 → 19
- Comparte `navDestinations()` con `enlaces_rotos`. Al ampliar la detección de enlaces (`onNavigate`, `window.location`), una ruta que **sí estaba enlazada** por `onNavigate` deja de marcarse huérfana. −1 = corrección de un falso huérfano (exactamente lo que §2 anticipó). No es estrechar la definición ("ruta sin enlace entrante" sigue igual), es ver más enlaces.

### 6 · enlaces_rotos — 0 → 1 · AMPLIADO
- **No veía**: `onNavigate(` (N mayúscula, invisible al regex `navigate\(`), `window.location.href=/assign/replace`. (`Link/NavLink to=` ya los cubría `to=`.)
- **Ampliado** a esos patrones. Nuevo destino roto visible: **`TaxBlock:53 → /fiscalidad/estado`** (ruta inexistente · componente muerto · pendiente bloque 3). Nuevo baseline **1**. **Residuo**: `navigate(variable)`/`onNavigate(variable)` con la ruta en constante sigue sin verse.

### 7 · hex_hardcoded — 974 → 1689 · AMPLIADO
- **No veía**: `#RGB` (3 díg), `rgb()/rgba()/hsl()/hsla()`, arbitrarios de tailwind `[#…]`, y **`tailwind.config.js`** (fuente de la paleta v4 legacy que la auditoría ya señaló).
- **Ampliado** a todo eso. +715 (3díg ~208 · rgb/hsl ~391 · tailwind `[#]` ~2 · config ~111). El 974 daba una falsa sensación de control: el color hardcoded real es **~1,7×** mayor.

### 8 · emojis_ui — 124 → 124 · NO AMPLIADO (decisión)
- **No ve**: `.ts` (solo `.tsx`), `content:` en CSS, `\uXXXX` escapado.
- **Decisión**: los `.ts` tienen 122 caracteres de rango emoji, pero **concentrados en SERVICIOS** (logs/comentarios/constantes de `treasuryCreationService`, `ocrService`, `config/envFlags`…), **no en UI de pantalla**. Ampliar a todo `.ts` haría **derivar el significado** e introduciría ruido. Distinguir "string de UI" dentro de un servicio no es mecanizable limpio → **se deja como hallazgo, no se amplía**. Residuo: `content:` CSS y `\uXXXX`.

### 9 · iconos_no_lucide — 0 → 0 · REPORTA
- **Ve**: `import` de librerías de iconos ajenas (heroicons, mui, fontawesome…). Correctamente **0**.
- **No ve**: **SVG inline escrito a mano (27 ocurrencias)**, icon-fonts, iconos como PNG.
- **Por qué no amplío el mismo indicador**: un `<svg>` inline **no es una librería ajena** — contarlo aquí mezclaría dos conceptos y el `0` (limpio de librerías) es correcto. **Hallazgo**: hay 27 SVG inline sin vigilar; si quieres medirlos es un **check nuevo** (¿"iconos_inline"?), tu decisión, no una ampliación de este.

### 10 · kpis_hardcoded — 9 → 9 · REPORTA (el que más preocupaba)
- **Ve**: líneas `TODO conectar` (placeholders vivos A+B).
- **No ve el caso peor**: un número fijo **sin comentario** (`1.284 €` clavado en una tarjeta). Es invisible y es exactamente el peor caso (nadie sabrá que está inventado).
- **Intento de regla**: buscar literales con formato de importe/porcentaje en componentes de KPI sin origen en props/estado. **No es mecanizable limpio**: el ruido es enorme (fechas, cálculos, config, ejemplos, IDs). Una regla así **enseñaría a ignorar el número**.
- **Alternativa propuesta** (no forzar regex): (a) revisión manual de las tarjetas KPI del Panel como checklist de bloque; o (b) una regla de lint acotada a los ~4 componentes de tarjeta KPI que exija que el valor venga de una prop/hook. **No amplío con una regla ruidosa.**

### 11 · todos_totales — 270 → 270
- Ampliado a `.js/.cjs/.mjs`. Impacto **0** (no hay marcadores en JS suelto de `src`). Robustez.

### 12 · archivos_800 — 49 → 53 · AMPLIADO
- **No veía**: `.css` y `.js` (solo `.ts/.tsx`). **Ampliado** → +4 CSS grandes >800 líneas.

### 13 · pct_v5 — 23.5 → 40.1 · AMPLIADO (sube · bueno)
- **No veía**: consumo **indirecto** de v5 vía `.module.css` que usa tokens `var(--atlas-v5-*)` (prefijo canónico de `tokens.css`). Muchos componentes estilan por CSS module, no por el barrel TS.
- **Ampliado** → la adopción real es **40,1 %**, no 23,5 %. Señal fiable (prefijo de token exacto). Nuevo baseline (sube).

### 14 · prs_abiertos — NO MEDIBLE → medible en CI · IMPLEMENTADO
- **Implementado modo CI**: con `GITHUB_TOKEN` + `GITHUB_REPOSITORY` (los pone Actions) cuenta PRs `state=open` vía API, paginando. El token **no se interpola** en la cadena (se expande en el shell). Workflow actualizado con `permissions: pull-requests: read`.
- **Nota honesta**: es **estado externo y variable en el tiempo** (no código). Como indicador de trinquete es atípico: "no debe subir" = "no abrir PRs". Su baseline **no se congela** desde una medición de repo (cambia solo). Recomendación: tratarlo **informativo** (no gating) o gestionar su baseline aparte. Tu decisión.

### 15 · tests_rojos — 44 → 44
- Corre `react-scripts test` y cuenta `Test Suites: X failed`. Sin punto ciego relevante. Determinista en 44 (verificado en Fase 1).

### 16 · ccaa_no_verificadas — 18 → 18 · REPORTA
- **Ve**: `verified:\s*false` (el `\s*` ya cubre "sin espacio"). El único archivo sin la palabra `verified` es `index.ts` (barrel, no una escala).
- **No ve**: una **escala que OMITA el flag** por completo (un objeto de escala sin `verified` es peor que uno con `false`, y sería invisible). Detectarlo requiere **parsear los objetos de escala**, no un grep — no mecanizado aquí. **Hallazgo/residuo**: si una escala no declara `verified`, hoy no cuenta.

---

## Indicador propuesto · `componentes_muertos` · DESCARTADO

La auditoría encontró 5 componentes de dashboard muertos que ningún indicador vigila (`servicios_muertos` solo mira `services/`). Propuesta: `.tsx` no importados ni renderizados.

**Medición**: detección JSX-aware (importado por ruta **o** usado como `<Base` **o** re-exportado), excluyendo `.stories.tsx`/`examples/`: **140 candidatos**. Es **demasiado ruido** para ser fiable — el uso de componentes es mucho más dinámico que el de servicios (barrels, render condicional, `React.lazy`, registries, mapas de componentes). Un 24 % de "muertos" no es una señal creíble.

**Decisión**: **NO se añade.** Un indicador ruidoso enseña a ignorar los números. Los **5 confirmados** (`TaxBlock`, `FlujosGrid`, `TresBolsillosGrid`, `IncomeExpensesBlock`, `InmueblesAnalisis`) van a **bloque 3** como lista conocida; la lista de 140 candidatos queda como material de revisión manual, no como gate.

---

## Hallazgos nuevos · por bloque

- **Bloque 3 (muertos)**: `TaxBlock:53 → /fiscalidad/estado` (enlace roto + componente muerto, destino desconocido). Los 5 componentes muertos confirmados. La lista ruidosa de 140 candidatos (revisión manual).
- **Diseño / V5**: color hardcoded real ~**1689** (no 974); **`tailwind.config.js`** con ~111 hex de la paleta **v4 legacy** (fuente a retirar); **27 SVG inline** sin vigilancia (¿check nuevo?).
- **servicios_muertos**: ~3 falsos muertos por límites de detección (barrel/dynamic/alias) → **decidir** si autorizas mejorar la detección (bajaría el número = estrechar).
- **kpis_hardcoded**: el caso peor (número clavado sin `TODO`) es invisible y no mecanizable limpio → necesita estrategia no-regex.
- **ccaa**: una escala que omita `verified` sería invisible → conviene un check estructural.

---

## Cierre honesto · de cuáles NO me fío tras ampliar

- **`kpis_hardcoded`** — **no me fío**. Sigue ciego al peor caso (número inventado sin comentario). El `9` mide solo lo que lleva `TODO`.
- **`servicios_muertos`** y el descartado **`componentes_muertos`** — **no me fío del número exacto**. "Muerto" es intrínsecamente frágil de detectar (imports dinámicos, barrels, registries). Es una cota, no una verdad.
- **`iconos_no_lucide`** y **`emojis_ui`** — **fiabilidad parcial**. Miden un subconjunto estrecho a propósito; el SVG inline (27) y los emojis de servicio (122) quedan fuera, conscientemente.
- **`ccaa_no_verificadas`** — **parcial**. No ve escalas que omitan el flag.
- **`prs_abiertos`** — medible en CI, pero **estado externo**; no es congelable ni comparable como los demás.

De los que **sí me fío** tras esta pasada: `stores_fantasma`, `stores_no_tipados`, `lecturas_store_inexistente`, `enlaces_rotos` (tras `onNavigate`), `archivos_800`, `hex_hardcoded` (ahora mucho más completo), `pct_v5` (cota razonable al alza), `todos_totales`, `tests_rojos`. `rutas_huerfanas` es razonable pero hereda los residuos de detección de nav.

Fingir que los 16 son sólidos no ayudaría. Estos cinco son los que vigilaría con desconfianza.
