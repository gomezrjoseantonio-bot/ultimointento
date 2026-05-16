# PRE-FLIGHT · T-INVERSIONES-V5 · auditoría obligatoria §0

> Entregable §0.4 de `docs/specs/TAREA-CC-T-INVERSIONES-V5-rediseno-modulo-inversiones.md`.
> Stop-and-wait · Jose debe responder OK antes del PR 1 de código.
> Branch · `claude/redesign-investments-module-TuHYY`.

---

## 1 · Inventario §0.1 · 14 componentes UI actuales

**Metodología de conteo:**
- **Líneas** · `wc -l <ruta>` ejecutado sobre HEAD del branch (cuenta saltos de línea, no líneas visibles · GitHub UI puede mostrar n+1 para archivos sin newline final).
- **Consumidores** · sólo imports reales del componente TS/TSX, excluyendo (a) auto-imports en el mismo archivo, (b) imports a `<Nombre>.module.css` (CSS-only, no consumen el código), (c) menciones en comentarios o tests. Incluye `lazyWithPreload(() => import('…'))` y `import('…')` dinámicos.

| # | Componente · ruta real | Líneas (`wc -l`) | Consumidores | Estado | Acción spec |
|---|---|---:|---:|---|---|
| 1 | `src/modules/inversiones/InversionesGaleria.tsx` | 280 | **2** · `App.tsx` (lazy), `services/navigationPerformanceService.ts` (dynamic) | vivo | Sustitución completa |
| 2 | `src/modules/inversiones/components/WizardNuevaPosicion.tsx` | 240 | **1** · `InversionesGaleria.tsx` | vivo | Sustitución (→ `SelectorNuevaPosicion`) |
| 3 | `src/modules/inversiones/components/wizard/PosicionFormV5.tsx` | 1111 | **1** · `WizardNuevaPosicion.tsx` | vivo · zombie tras PR3 | Sustitución parcial (§3) |
| 3b | `src/modules/inversiones/components/wizard/PlanFormV5.tsx` | 612 | **2** · `WizardNuevaPosicion.tsx`, `pages/FichaPlanPensiones.tsx` (+ 1 test) | vivo | Sustitución (A1 · ver Q1) |
| 4 | `src/modules/inversiones/pages/FichaPosicionPage.tsx` | 279 | **2** · `App.tsx`, `services/navigationPerformanceService.ts` | vivo | Reestructuración (§4) |
| 5 | `src/modules/inversiones/components/FichaValoracionSimple.tsx` | 260 | **1** · `pages/FichaPosicionPage.tsx` | vivo | Sustitución (→ `FichaFondo` + `FichaAccion` + `FichaGenerica`) |
| 6 | `src/modules/inversiones/pages/FichaPlanPensiones.tsx` *(spec dice `components/`, real `pages/`)* | 1336 | **1** · `pages/FichaPosicionPage.tsx` (+ 1 test) | vivo | **PRESERVAR 2 secciones T13v4** (§4.2) |
| 7 | `src/modules/inversiones/components/FichaDividendos.tsx` | 323 | **1** · `pages/FichaPosicionPage.tsx` | vivo | Sustitución (absorbido por `FichaAccion`) |
| 8 | `src/modules/inversiones/components/AportacionFormDialog.tsx` | 303 | **2** · `components/DialogAportar.tsx`, `pages/FichaPosicionPage.tsx` | vivo | Sustitución (→ `AportarModal`) |
| 9 | `src/modules/inversiones/components/ActualizarValorPlanDialog.tsx` | 131 | **1** · `pages/FichaPlanPensiones.tsx` | vivo | Sustitución (→ `ActualizarValoracionModal`) |
| 10 | `src/modules/inversiones/components/CintaResumenInversiones.tsx` | 174 | **1** · `layouts/MainLayout.tsx` | vivo | **Preservar** · solo actualizar números |
| 11 | `src/modules/inversiones/pages/PosicionesCerradasPage.tsx` | 313 | **2** · `App.tsx`, `services/navigationPerformanceService.ts` | vivo | Renombrar UI (§5.4) |
| 12 | `src/modules/inversiones/adapters/galeriaAdapter.ts` | 174 | **3** · `InversionesGaleria.tsx`, `components/CintaResumenInversiones.tsx`, `modules/panel/PanelPage.tsx` | vivo | Ampliar · tags por tipo |
| 13 | `src/modules/inversiones/helpers.ts` | 703 | **13** · todo el módulo `inversiones` (galería · adapter · cintaResumen · fichas · diálogos) | vivo | Revisar `groupTipo` |
| 14 | `src/modules/inversiones/types/cartaItem.ts` | 229 | **5** · `InversionesGaleria.tsx`, `helpers.ts`, `components/CintaResumenInversiones.tsx`, `components/CartaPosicion.tsx`, `adapters/galeriaAdapter.ts`, `modules/panel/PanelPage.tsx` | vivo | Ampliar con tag por tipo |

Total · **14 archivos · 6 468 líneas · alcance bien delimitado**.

> Nota sobre líneas · Copilot review observó cifras 281/241/613/1112 etc. La diferencia de 1 es esperable: `wc -l` cuenta saltos de línea y devuelve `n` para un archivo con `n+1` líneas visibles cuando falta el newline final, o `n` líneas visibles cuando termina con newline. Las cifras de esta tabla son `wc -l` directo · método consistente con la spec §0.1 («conteo de líneas (`wc -l`)»).

### Archivos relacionados no listados en §0.1 (descubiertos en pre-flight)

| Archivo | Líneas | Comentario |
|---|---:|---|
| `src/modules/inversiones/components/wizard/PlanFormV5.tsx` | 612 | Componente real del wizard de plan T13v4 · co-usado con `PosicionFormV5.tsx` · cae bajo «sustituye T13v4 wizard plan» (decisión A1). Lo trato como parte de §3 «sustitución del wizard plan». **Confirmar a Jose**. |
| `src/modules/inversiones/components/DialogAportar.tsx` | — | Wrapper sobre `AportacionFormDialog`. Sustituible junto con AportacionFormDialog. |
| `src/modules/inversiones/components/PosicionDetailDialog.tsx` | — | Diálogo legacy · no listado en spec. **Preguntar a Jose** si entra en cleanup PR5. |
| `src/modules/inversiones/components/ActualizarValorDialog.tsx` | — | Diferente al de Plan · para posiciones no-plan. **Preguntar a Jose** si lo cubre `ActualizarValoracionModal`. |
| `src/modules/inversiones/components/TraspasoPlanDialog.tsx` | — | Componente actual de traspaso plan · será sustituido por `TraspasoModal`. No listado en §0.1. |
| `src/modules/inversiones/components/RegistrarCobroDialog.tsx` | — | Para rendimientos periódicos · usado por `FichaRendimientoPeriodico.tsx`. |
| `src/modules/inversiones/components/FichaRendimientoPeriodico.tsx` | — | Ficha actual P2P/préstamo (precursora de las nuevas `FichaPrestamo`). |
| `src/modules/inversiones/components/FichaGenerica.tsx` | — | Ya existe · convive con la nueva planeada. Posible solape. |
| `src/modules/inversiones/components/FichaShell.tsx` | — | **¡Ya existe!** La spec §4.1 lo lista como «componente nuevo». Posible solape. |
| `src/modules/inversiones/components/CartaPosicion.tsx`, `CartaCerrada.tsx`, `CartaAddPosicion.tsx` | — | Cards actuales · serán sustituidas por `GaleriaCard` + `PosicionesCerradasSection`. |
| `src/modules/inversiones/components/SparklineGigante.tsx` | — | Sparkline sintética actual · §1.2 mantiene sintética en MVP. |

---

## 2 · §0.2 · stores que NO se tocan · confirmación

Verifico que **ningún archivo a modificar escribe directamente** (`db.put` / `db.add` / `db.delete` / `tx.objectStore`) contra los stores protegidos:

```
inversiones · planesPensiones · aportacionesPlan · traspasosPlanPensiones
valoraciones_historicas · ejercicioFiscalCoord · cuentas · contracts
```

`grep -nE "db\.(put|add|delete|clear|transaction)|tx\.objectStore"` sobre los 14 archivos del inventario → **0 hits**.

Toda escritura pasa por servicios existentes (`inversionesService`, `planesPensionesService`, `aportacionesPlanService`, `traspasosPlanPensionesService`, `valoracionesService`, `cuentasService`, `inversionesFiscalService`, `fiscalContextService`, `nominaService`, `rentabilidadPlanService`, `estimacionFiscalEnCursoService`, `limitesFiscalesPlanesService`, `rendimientosService`). CC NO crea servicios nuevos · solo reemplaza vistas que los invocan (§8.2).

Las únicas apariciones de los nombres de store son **etiquetas de origen** (`_origen: 'inversiones' | 'planesPensiones'` en `cartaItem.ts` / `galeriaAdapter.ts` / `InversionesGaleria.tsx`) · lectura no escritura.

✅ §0.2 OK · spec respetada.

---

## 3 · §0.3 · 5 zombis eliminados por T13 v4 D4 · confirmación

```
GestionInversionesPage · PlanesManager · MisPlanesPensiones · PlanForm · TraspasoForm
```

Búsqueda · un comando por zombi, con `\b` para evitar falsos positivos (p.ej. que `PlanForm` no matchee `PlanFormV5`):

```bash
grep -rIn '\bGestionInversionesPage\b' src/
grep -rIn '\bPlanesManager\b'         src/
grep -rIn '\bMisPlanesPensiones\b'    src/
grep -rIn '\bPlanForm\b'              src/ | grep -v PlanFormV5
grep -rIn '\bTraspasoForm\b'          src/
```

Resultado:

| Zombi | Hits totales | Detalle |
|---|---:|---|
| `GestionInversionesPage` | 1 | `src/App.tsx:1213` · **comentario explicativo** (no import) |
| `PlanesManager` | 1 | `src/services/db.ts:2205` · **comentario explicativo** (no import) |
| `MisPlanesPensiones` | 0 | — |
| `PlanForm` (exacto, no `PlanFormV5`) | 0 | — |
| `TraspasoForm` (exacto) | 3 | `TraspasoPlanDialog.tsx:2`, `FichaPlanPensiones.tsx:324`, `db.ts:2205` · **todos comentarios** explicativos |

✅ §0.3 OK · **0 imports residuales · 0 referencias funcionales** a los 5 zombis. Solo quedan comentarios de contexto histórico, sin riesgo.

---

## 4 · §0.4.4 · tests pre-existentes en módulo inversiones

Spec dice «43 baseline pre-existentes». En `src/modules/inversiones/**/__tests__/` encuentro solo **2 archivos**:

```
src/modules/inversiones/components/wizard/__tests__/PlanFormV5.copyLimite.test.ts
src/modules/inversiones/pages/__tests__/FichaPlanPensiones.helpers.test.ts
```

Tests adicionales que tocan stores/servicios de inversiones (no en `modules/inversiones/__tests__/`) son **26 archivos** repartidos en `src/services/__tests__/`, `src/services/migrations/__tests__/`, `src/services/personal/__tests__/`, `src/__tests__/`, `src/tests/`. Estos cubren servicios fiscales / migrations / rendimientos / mesaAtlas / treasurySync — son los que CC NO debe romper.

→ **Q2 abajo** · ¿el «43 baseline» se refiere a este conjunto extendido o a algún otro listado? La cifra exacta no coincide con lo que veo.

---

## 5 · Servicios preservados intactos (§1.3)

Verifico que existen y NO se tocarán:

| Archivo | Estado |
|---|---|
| `src/services/limitesFiscalesPlanesService.ts` | ✅ presente · 16 792 bytes |
| `src/services/aeatPlanesPensionesImportService.ts` | ✅ presente · 12 799 bytes |
| `src/services/planesInversionService.ts` (wrapper · decisión D2 diferida) | ✅ presente · 4 391 bytes |

---

## 6 · Preguntas abiertas a Jose (§0.4.5)

### Q1 · `PlanFormV5.tsx` no aparece en §0.1 pero es el wizard plan T13v4 real

La spec §0.1 lista `PosicionFormV5.tsx (T13 v4)` como wizard plan, pero en el repo el wizard de plan está en **`PlanFormV5.tsx` (612 líneas)** y `PosicionFormV5.tsx` (1111 líneas) es el wizard genérico de posiciones. Ambos se sustituyen, pero conviene que la spec deje claro que ambos caen.

**Propuesta** · tratar `PlanFormV5` como parte de la decisión A1 (sustituye T13v4 wizard plan) y `PosicionFormV5` como wizard legacy genérico que también desaparece. ¿OK?

### Q2 · «43 tests baseline» no se reflejan en `src/modules/inversiones/**/__tests__/`

Solo encuentro **2 tests** dentro del módulo. ¿La cifra 43 viene de algún otro conteo (ej. tests en `src/services/__tests__/` que tocan inversiones)? ¿Cuáles exactamente debo proteger como «no romper»?

### Q3 · `FichaShell.tsx` ya existe en el repo

La spec §4.1 lista `FichaShell.tsx` como **componente nuevo a crear**, pero ya existe en `src/modules/inversiones/components/FichaShell.tsx`. ¿Lo reescribo desde cero según mockup, o lo reutilizo/amplío?

### Q4 · `FichaGenerica.tsx` ya existe

Idem que Q3 · `FichaGenerica.tsx` existe. ¿Reescribir desde mockup o ampliar?

### Q5 · Issues 7.2 y 7.5 (migraciones retro) **ya parecen implementados**

- §7.2 pide `src/migrations/v71/backfillFechaContratacionPlanes.ts` con flag `migration_v71_backfillFechaContratacionPlanes_v1`.
  - **En el repo ya existe** `src/services/migrations/fixFechaContratacionRetroactiva.ts` con flag `migration_fechaContratacion_retro_v1` · cabecera dice «Pulido T13 v4 final · issue 2 · migración data-fix retroactiva para corregir fechaContratacion de planes». Misma intención · diferente path + nombre de flag.

- §7.5 pide `src/migrations/v71/backfillNotasAportaciones.ts` con flag `migration_v71_backfillNotasAportaciones_v1`.
  - **En el repo ya existe** `src/services/migrations/backfillAportacionesNotas.ts` con flag `migration_aportacionesPlan_notas_backfill_v1` · cabecera dice «Pulido T13 v4 final · issue 5 · backfill de notas en aportaciones legacy».

**Esto es divergencia spec ↔ código** · per «REGLA ABSOLUTA» del header de la spec, paro y reporto.

**Propuesta** ·
- a) Confirmar que **NO debo duplicarlas** ni renombrarlas. Mantener las existentes y marcar 7.2/7.5 como «ya implementado en T13v4 final, no requiere PR5».
- b) §7.7 (`normalizarNombresEmpresas`) no encuentro equivalente · esa sí debería implementarse en PR5.

→ Confirmar a/b.

### Q6 · Directorio de migrations · `src/migrations/v71/` vs `src/services/migrations/`

Spec §8.3 dice «viven en `src/migrations/v71/*.ts`». El repo usa convención `src/services/migrations/*.ts`. No existe `src/migrations/`. ¿Sigo la convención del repo (recomendado) o creo la jerarquía nueva que pide spec?

### Q7 · «Card Añadir posición» (`CartaAddPosicion.tsx`)

La spec §5.1 dice eliminar la card. La eliminación cascadea: `CartaAddPosicion.tsx` se borra, e `InversionesGaleria.tsx` deja de importarla. ¿Confirmas que la eliminación es PR5 (con el resto del cleanup)?

### Q8 · `FichaPlanPensiones.tsx` vive en `pages/`, spec dice `components/`

Solo nota · la nueva `FichaPlanPensiones.tsx` (§4.1) según spec va en `components/ficha/`. Mantendré ese path para la nueva (preservando lógica) y eliminaré la antigua de `pages/` en PR5. ¿OK?

---

## 7 · Resumen de cumplimiento §0

| Requisito §0 | Estado |
|---|---|
| 0.1 · Inventario 14 componentes con líneas + consumidores + estado | ✅ §1 arriba |
| 0.2 · 0 escrituras directas a stores protegidos en archivos a modificar | ✅ §2 arriba |
| 0.3 · 0 referencias funcionales a 5 zombis | ✅ §3 arriba (solo comentarios) |
| 0.4.4 · Lista tests existentes | ⚠️ §4 arriba · cifra no coincide con spec · Q2 |
| 0.4.5 · Preguntas abiertas a Jose | ✅ §6 arriba · 8 preguntas |

**Stop-and-wait** · CC espera OK de Jose y respuestas a Q1-Q8 antes de abrir PR 1 de código.

---

## 8 · Respuestas de Jose · OK al pre-flight · ajustes spec

| # | Respuesta de Jose | Ajuste resultante |
|---|---|---|
| Q1 | Sí · A1 sustituye `PlanFormV5` + `PosicionFormV5` por `AltaPlanWizard`. CRÍTICO · el nuevo wizard DEBE invocar `planesPensionesService.createPlan` con los mismos parámetros y preservar las 4 validaciones T13v4 (tipo administrativo · subtipo PPE · CIF+nombre empresa condicional · check discapacidad). | Si encuentro alguna validación T13v4 fuera del mockup · STOP y reporto. |
| Q2 | El baseline son los tests rojos que `npm test` reporta en HEAD pre-commit · sea 42 · 43 · 44. La regla es: **el set rojo no se amplía**. Reportar número exacto en PR 1. | Mediré con `npm test` antes de tocar nada y lo dejo escrito en el comentario de PR 1. |
| Q3 | Reutilizar y extender `FichaShell` existente. Si encuentro mismatch grande · STOP. | §4.1 spec · marcar `FichaShell` como «extender existente». |
| Q4 | Idem `FichaGenerica`. | §4.1 spec · marcar `FichaGenerica` como «extender existente». |
| Q5 | NO duplicar. Si los flags ya están en `keyval` como `completed`, retirar esas migraciones de PR 5. Reportar qué flags existen. | §7.2/§7.5 condicionales a que no exista. §7.7 (`normalizarNombresEmpresas`) sí se implementa en PR 5. |
| Q6 | Convención del repo · `src/services/migrations/`. Patrón de nombre · sin prefijo `v71_`. | §8.3/§9.1 · ruta corregida. |
| Q7 | Sí · `CartaAddPosicion.tsx` se borra en PR 5. PR 2 retira solo el uso. | Antes de borrar · `grep -r CartaAddPosicion src/` debe dar 0 hits. |
| Q8 | Mantener `FichaPlanPensiones.tsx` en `pages/`. Solo refactorizar contenido (usar `FichaShell` + `FichaHero` + secciones T13v4). | §4.1 spec · path correcto es `pages/`. |

**OK al PR 1.** Adelante con estructura shell + tokens CSS módulo + smoke tests + comentario de inventario completo. Recuerda · 0 cambios visibles en `/inversiones` tras PR 1.
