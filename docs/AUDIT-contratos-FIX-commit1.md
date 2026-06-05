# AUDIT · PR FIX Contratos · Commit 1 · verificación grep + reporte

> Correctivo post-merge del PR REORG · 8 problemas detectados en producción 03-06-26.
> Commit 1 NO toca código · solo localiza el estado actual y prepara los commits 2-6.
> Mockup vinculante · `docs/mockups/atlas-contratos-reorg-v5.html`.
> Guía · `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` (sección 17 checklist).

## Tabla de verificación (§ 0.3)

| Verificación | Resultado | Implicación |
|---|---|---|
| `persistent-bar` existe en src · path · clase exacta | **NO existe**. La banda navy está implementada como `ContratosTopHero` con clases `bannerNavy`/`bannerRow`/`kpi` en `src/modules/inmuebles/components/contratos/ContratosTopHero.module.css` | Adoptar el patrón canónico `persistent-bar`. No existe en src → adaptar de `atlas-tesoreria-v8-completo.html` / `atlas-inversiones-*`. Refactor en **commit 2**. |
| Componente actual de header Contratos · path | `src/modules/inmuebles/pages/ContratosListPage.tsx:206-227` renderiza `<ContratosTopHero>` y debajo `<PageHead>`. El `ContratosTopHero` vive en `src/modules/inmuebles/components/contratos/ContratosTopHero.tsx` | Aquí se aplica el refactor `.main-container` + `.persistent-bar` sticky arriba (commit 2). |
| Chips TIPO/ESTADO · path + líneas | `src/modules/inmuebles/components/contratos/BarraFiltros.tsx:55-127` (grupo Tipo: Todos/Larga/Corta; grupo Estado: Todos/Al día/Vence 30d/Impago/Sin firmar) + botón "Más filtros" `:129-136` | Eliminar BarraFiltros completa, dejar solo searchbox + select Inmueble (commit 2 § 1.2). |
| Botones Exportar/Imprimir/Columnas · path + líneas | `src/modules/inmuebles/components/contratos/ToolbarTabla.tsx:34-54` (Exportar Excel `:34-40` · Imprimir `:41-47` · Columnas `:48-54`) + línea-resumen duplicada `:13-32` | Eliminar ToolbarTabla completo (commit 2 § 1.2). |
| Tabla Vigentes · columnas actuales en orden | `src/modules/inmuebles/components/contratos/TablaActivos.tsx:72-91` → **12 columnas**: ① checkbox · ② Inquilino · ③ Inmueble · ④ Habitación · ⑤ Tipo · ⑥ Renta · ⑦ Desde · ⑧ Vence · ⑨ Días · ⑩ Estado · ⑪ Último cobro · ⑫ Acción | Spec pide **7**: Inquilino · Inmueble · Inicio · Fin · Renta mensual · **Renta anual (nueva)** · Acción. Eliminar checkbox, Habitación (se fusiona en sub-meta Inmueble), Tipo, Días, Estado, Último cobro. Añadir Renta anual. (commit 2). |
| Componente Avatar · lógica firmado · path | `src/modules/inmuebles/utils/inquilinoUtils.ts:34-37` `colorAvatarPorContrato` usa hash de **id de contrato** (no nombre) y **no** distingue firmado/sin firmar. Render en `TablaActivos.tsx:140-146`. `Contract.documentoFirmado` SÍ existe (`src/services/db.ts:847`, backfill suave ya aplicado) | Refactor avatar: clase `unsigned` (dashed gris) cuando `!documentoFirmado`; hash determinista por **nombre** para firmados. (commit 2 § 1.2). |
| Mapa de calor actual · path · estructura | `src/modules/inmuebles/components/contratos/TabAnalisis.tsx:68-90` bloque "Ocupación · {año}" → **12 meses del año actual** (`monthStrip`), marca `now` solo barra del mes actual, **sin pasado/futuro real**, sin 24 meses | Reemplazar por mapa temporal **24 meses** (12 atrás + hoy + 11 adelante) con marca HOY dorada. (commit 5 § 1.6 bloque 1). |
| "Resumen anual abstracto" · path | `TabAnalisis.tsx:94-121` card "Resumen anual" con 4 filas de números abstractos (Contratos vigentes · Renta mensual · Renta anualizada · Ingresos perdidos) | Reemplazar por **gráfico SVG de líneas** 2024/2025/2026 + caja proyección. (commit 5 § 1.6 bloque 2). |
| Cálculo "X unidades libres" · path · fórmula actual | `src/modules/inmuebles/utils/calcularLibresAhora.ts:46-103`. Fórmula: por cada Property `totalUnidades = max(1, p.bedrooms)`; `activos = contratosInmueble.filter(isContratoActivo)`; `libres = totalUnidades − activos.length`. Consumido por `analisisContratosService.ts:81-90` (alarma "N unidades libres ahora") | **Bug P7**: cuenta `activos.length` sin deduplicar por `habitacionId`, y `isContratoActivo` usa `estadoContrato` persistido (no estado efectivo). De ahí "23" en vez de 17, y nombra inmuebles ocupados (Carles Buigas). Corregir cálculo + sacarlo de alarmas. (commit 5 § 1.6 bloque 4). |
| Importador Rentila · path + función que mapea nombre piso → habitación | **NO existe**. `src/services/rentilaParserService.ts` lee la columna `propiedad` (que trae el sufijo HX, ej. `4-ACEVEDO-H2`) pero **nunca parsea el sufijo**. `src/services/contractsImportService.ts:135,149-150` toma `row.habitacionId` (no derivado de Rentila) y cae a `'H1'` por defecto | Crear `parseHabitacionFromRentila(nombre): number \| null` (regex § 1.3) y aplicarlo en el flujo de importación. (commit 3). |
| Property `modoExplotacion` · se copia al Contract? | **NO**. `Property.modoExplotacion` existe (`src/services/db.ts:167`, con migración V78/V78.1 self-heal), pero **no se propaga** al Contract. La tabla decide "Piso completo" con `c.unidadTipo === 'vivienda'` (`TablaActivos.tsx:106,163`) | **Bug P8**: todos los Rentila caen a `vivienda` → "Piso completo" aunque FA32 sea por habitaciones. Propagar `modoExplotacion` (derivado en render desde el Property) + parsear HX. (commit 3 § 1.3 problema 2). |
| Histórico · filtro actual · ¿incluye contratos sin nombre real? | **SÍ los incluye**. `ContratosListPage.tsx:155-158` filtra histórico solo por `getEstadoEfectivo(c) === 'finalizado'`; `TabHistorico.tsx` no filtra por nombre. `getInquilinoNombre` (`inquilinoUtils.ts:12-15`) devuelve `'—'` si falta nombre | Excluir contratos sin nombre real / origen AEAT sin identificar. Van solo a Por conciliar. (commit 4 § 1.4). |

## Mapeo de los 8 problemas → ubicación → commit

| # | Problema | Ubicación raíz | Commit |
|---|---|---|---|
| P1 | Banda navy a mitad de pantalla | `ContratosListPage.tsx:206-227` (orden TopHero→PageHead, sin `.main-container`) + `ContratosTopHero.module.css` (padding 22/26, val 30px, sin border-left, gap en vez de separadores) | 2 |
| P2 | Chips TIPO/ESTADO siguen ahí | `BarraFiltros.tsx:55-136` | 2 |
| P3 | Botones Exportar/Imprimir/Columnas | `ToolbarTabla.tsx:33-55` | 2 |
| P4 | Columna ÚLTIMO COBRO + ESTADO, falta Renta anual | `TablaActivos.tsx:88-89,188-195` | 2 |
| P5 | Avatar no distingue firmado/sin firmar | `inquilinoUtils.ts:34-37` + `TablaActivos.tsx:140-146` | 2 |
| P6 | Mapa de calor solo 12 meses año actual, sin HOY/pasado/futuro | `TabAnalisis.tsx:68-90` + `calcularDatosAnuales` | 5 |
| P7 | "23 unidades libres" mal calculado, nombra ocupados | `calcularLibresAhora.ts:46-103` + `analisisContratosService.ts:74-138` | 5 |
| P8 | "Piso completo" para todos los FA32 (por habitaciones) | `TablaActivos.tsx:106,163` + falta parseo HX en `rentilaParserService.ts` + no propaga `modoExplotacion` | 3 |

## Notas de bloqueo (§ 6)
- `persistent-bar` no existe en src → se adapta desde mockups sin reorganizar otras páginas (el refactor se contiene en `ContratosListPage` + su CSS). **No es bloqueo.**
- `documentoFirmado` existe y está backfilled (`db.ts:847` + `migration_documentoFirmado_v1`). **No requiere re-migración.**
- `modoExplotacion` existe y está self-healed (V78.1). **No requiere bump DB.**
- El componente Análisis (`TabAnalisis.tsx`) está aislado por bloques → se puede refactor bloque a bloque. **No es bloqueo.**

**Sin cambios de código en este commit. A la espera de autorización de Jose para proceder con el commit 2.**
