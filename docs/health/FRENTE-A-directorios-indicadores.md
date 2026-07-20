# FRENTE A · Directorios en los 16 indicadores

> **Qué** · para cada indicador de `scripts/health.mjs`, qué rutas escanea y a
> qué se amplía. Motivación: `servicios_muertos` estuvo a punto de borrar dos
> servicios vivos por no mirar `functions/` ni `scripts/`. Se audita si algún
> otro indicador escanea **de menos**.
> **Regla** · ampliar es libre por gobernanza. Si el número sube, es deuda que
> aflora (nuevo baseline), no regresión. Baselines nuevos congelados.

## Tabla de los 16

Áreas de código del repo: `src/` · `functions/` (serverless Netlify) · `scripts/`
(tooling/build) · `docs/` · raíz.

| # | Indicador | Qué mide | Rutas ANTES | Rutas DESPUÉS | nº antes | nº después |
|--:|---|---|---|---|--:|--:|
| 1 | stores_fantasma | claves de interfaz sin `createObjectStore` | `src/services/db.ts` | = (fichero único) | 0 | 0 |
| 2 | stores_no_tipados | stores con `value: any` | `src/services/db.ts` | = (fichero único) | 35 | 35 |
| 3 | lecturas_store_inexistente | lecturas a store fantasma sin guarda | `src/` .ts/.tsx | = (IndexedDB solo en front) | 0 | 0 |
| 4 | servicios_muertos | módulos inalcanzables (grafo) | `src/`+`functions/`+`scripts/` | = (**ya cubría las 3** · referencia) | 0 | 0 |
| 5 | rutas_huerfanas | rutas sin destino de nav | `src/` (App.tsx + nav) | = (router solo en src) | 19 | 19 |
| 6 | enlaces_rotos | destinos sin ruta | `src/` (App.tsx + nav) | = (nav cliente solo en src) | 0 | 0 |
| 7 | **hex_hardcoded** | color hardcoded (`#hex`/`rgb`/`hsl`) | `src/` .ts/.tsx/.css + `tailwind.config.js` | **+ `functions/`** .ts/.tsx/.css | 546 | 546 |
| 8 | **emojis_ui** | emojis en UI de producción | `src/` .tsx | **+ cadenas `src/` .ts con señal de entrega a UI** (`toast(`/`message:`/`title:`/…) | 64 | **71** |
| 9 | iconos_no_lucide | imports de icon-libs ≠ lucide | `src/` .ts/.tsx | = (iconos solo en UI) | 0 | 0 |
| 10 | **kpis_hardcoded** | placeholders `TODO: conectar` vivos | `src/` **.tsx** | **`src/` .ts + .tsx** (el docstring ya decía "sin restricción por archivo") | 9 | 9 |
| 11 | **todos_totales** | marcadores TODO/FIXME/HACK/XXX | `src/` .ts/.tsx/.css/.js/.cjs/.mjs | **+ `functions/` + `scripts/`** | 250 | 263 |
| 12 | **archivos_800** | ficheros > 800 líneas | `src/` .ts/.tsx/.css/.js | **+ `functions/` + `scripts/` + .mjs/.cjs** | 43 | 44 |
| 13 | ficheros_no_v5 | `.tsx` que AÚN NO consumen v5 (baja · sustituye a `pct_v5`) | `src/` .tsx/.module.css | conteo descendente (antes % ascendente) | — | 147 |
| 14 | prs_abiertos | PRs abiertos | GitHub API | = (estado externo · sin rutas) | — | — |
| 15 | tests_rojos | suites en rojo | runner de tests | = (CI · sin rutas) | — | — |
| 16 | ccaa_no_verificadas | reglas CCAA `verified:false` | `src/services/fiscal/ccaaRules` | = (dir de datos específico) | 18 | 18 |

**Los 4 ampliados (7, 10, 11, 12)** están marcados en negrita. Los otros 12 ya
escanean todo lo que les corresponde (esquema de fichero único, métricas de
front solo-src, el grafo de alcanzabilidad que ya cubre las 3 áreas, el dir de
datos CCAA, o indicadores git/CI sin ámbito de directorio).

## Cambios de número (deuda que aflora)

- **todos_totales 250 → 263** (+13 vs baseline · +14 vs árbol): 1 en `functions/`,
  ~13 en `scripts/` (marcadores de deuda reales en tooling).
- **archivos_800 43 → 44** (+1): `scripts/health.mjs` (1342 líneas · candidato a
  trocear — ver "para la lista").
- **hex_hardcoded 546 → 546**: `functions/` aporta 0 hoy; se amplía el ámbito por
  corrección, no por número.
- **kpis_hardcoded 9 → 9**: `src/.ts` aporta 0 hoy; se corrige el ámbito para
  honrar el propio docstring del indicador.

Exenciones AMPLIACIONES congeladas (se desactivan solas cuando `main` absorba el
número): `todos_totales {antes:250}`, `archivos_800 {antes:43}`. Baseline JSON
regenerado (`HEALTH-2026-07-19.json`) — de paso refresca `hex_hardcoded` (baseline
committeado seguía en 914 pre-muro; el árbol real ya era 546).

## Decisión · por qué `scripts/` NO entra en hex_hardcoded

`scripts/` tiene 30 ocurrencias de hex, pero **23 están en
`replace-hardcoded-colors.js`** (un mapa de migración de color · dato de tooling,
no paleta de producto) y 6 en el propio `health.mjs` (regex/ejemplos). Contar eso
como "color hardcoded a tokenizar" corrompería el indicador. `functions/` sí entra
(serverless puede renderizar HTML/email con color); hoy da 0.

---

## Para la lista (hallazgos · no tocados · gobernanza)

1. **`scripts/replace-hardcoded-colors.js`** (23 hex) · script de migración de
   color de una sola pasada; posible **muerto** (ya ejecutado). Candidato a borrar.
2. **`scripts/health.mjs`** (1342 líneas) · supera 800; candidato a trocear
   (irónicamente, el propio marcador lo destapa ahora).
3. **`scripts/` con 16 marcadores TODO/FIXME** · deuda de tooling que antes no
   se veía.
4. **hex baseline committeado estaba stale** (914 vs 546 real) · esta ampliación
   lo refresca; conviene regenerar el baseline JSON tras cada campaña que baje
   mucho un indicador, aunque el trinquete no lo exija (down-movers siempre pasan).
5. **17 emojis de UI devueltos desde servicios** (`ocrService`,
   `propertyAnalysisUtils`, `treasuryCreationService`, `generateLibertad`) · no es
   deuda de medición sino de arquitectura: la capa de servicio devuelve
   presentación en vez de estado · se resuelve cambiando el contrato, no el
   escáner. Por eso `emojis_ui` NO los cuenta (no son mecanizables sin falsos
   positivos); sí cuenta los 6 con señal de entrega a UI (`toast(`/`message:`),
   recalibración 64→71.
