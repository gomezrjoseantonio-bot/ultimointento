# FASE 0 · Reconciliación (Módulo Contratos) — Informe

> Tarea: `TAREA CC · FASE 0 — Reconciliación (Módulo Contratos) v1`
> Base: `docs/AUDIT-contratos-ciclo-vida-2026-08-25.md` · Rama `claude/new-session-zgfg6q` · PR [#1795](https://github.com/gomezrjoseantonio-bot/ultimointento/pull/1795)
> **Resultado: Sub-tarea A NO se aplica — STOP por hallazgo material. Sub-tareas B y C entregadas.**
> Cero cambios de código en este commit.

---

## PREFLIGHT

| Comprobación | Resultado |
|---|---|
| HEAD de `main` | `36ba050` — **coincide** con la base de la auditoría |
| HEAD de la rama | `af1acad` (solo el doc de auditoría encima de `36ba050`) |
| `DB_VERSION` | **90** (`src/services/db.ts:57`) — **coincide** |
| Árbol | limpio antes de empezar |
| `archivo:línea` citados en la tarea | verificados uno a uno (ver abajo) |

**Verificación de los `archivo:línea` de la tarea:**

| Cita en la tarea | Estado real | Nota |
|---|---|---|
| `treasurySyncService.ts:347` → `sourceType:'contrato'` | ✅ válido | generador vivo |
| `treasuryForecastService.ts:523` → `sourceType:'contract'` | ✅ válido | (la auditoría decía `:525`; se corrigió a `:523` en el propio doc de auditoría antes de commitear) |
| `estadoCobroContratoService.ts:20` → tolera ambos | ✅ válido | `const RENT_SOURCE_TYPES = new Set(['contract', 'contrato'])` |
| `contractService.ts:194-198` → `getAll`+filtro | ✅ válido | |

**Divergencia no material pero reportable:** la tarea pide aplicar el *"Checklist v4 (sección 22 de `GUIA_DISENO_DEFINITIVA_V4.md`)"*. **Ese fichero no existe en el repo.** Búsqueda exhaustiva (`find . -iname "*GUIA*"` fuera de `node_modules`): solo `GUIA_USO_SENCILLO.md`, `AUDITORIA_CUMPLIMIENTO_GUIA_ESTILO_V3_2026-03-08.md` y `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` — este último tiene 17 secciones, no 22, y su checklist es el §17 ("Checklist obligatorio antes de cerrar un mockup"). Como esta entrega no contiene cambios de UI ni de código, el checklist no aplica; se reporta para que la referencia se corrija en las tareas siguientes.

---

# SUB-TAREA A · STOP — no se aplica

## A.1 · La verificación previa NO sale limpia

La tarea condiciona la acción a que `'contract'` no tenga llamantes vivos. **Los tiene.** Además, la premisa de partida —heredada de mi propia auditoría, que fue imprecisa aquí— es incorrecta en dos puntos.

### Hallazgo 1 · `sourceType:'contract'` tiene un ESCRITOR VIVO fuera de `treasuryForecastService`

`src/services/bankStatementOrchestrator.ts:682`:

```ts
case 'assign_to_contract':
  return {
    ...base,                       // status:'executed', executedMovementId, actualDate/actualAmount
    type: movement.amount >= 0 ? 'income' : 'expense',
    sourceType: 'contract',        // ← :682
    sourceId: action.contractId,   // ← :683
    ambito: 'INMUEBLE',
  };
```

**Cadena de llamada completa, toda viva:**

1. `src/services/movementSuggestionService.ts:355-364` — heurística "BIZUM / TRANSFERENCIA RECIBIDA" (confidence 50) que produce `action: { kind: 'assign_to_contract' }`.
2. `src/services/bankStatementOrchestrator.ts:614-634` — `applySuggestion` maneja el caso `'assign_to_contract'`, llama a `buildTreasuryEventFromAction` (`:669`), hace `db.add('treasuryEvents', event)` (`:622`) y marca el movimiento `unifiedStatus:'conciliado'` (`:625-629`).
3. `src/modules/tesoreria/v6/DrawerExtracto.tsx:16` — importa `confirmDecisions` de ese orquestador. **Es la pantalla de importación de extractos, en producción.**

Es decir: `'contract'` **no es un valor muerto**. Borrarlo del tipo, o retirarlo de los lectores tolerantes (`estadoCobroContratoService.ts:20`, `punteoAdapter.ts:284,379`, `ingresosAnualesService.ts:28`, `post-open.ts:589`), **rompería un flujo vivo y dejaría ciegos los eventos ya guardados en la base de cualquier usuario que haya importado un extracto**.

Lo que sí está muerto es el **generador** `regenerateMonthForecast` (ver A.2), que es otra cosa.

### Hallazgo 2 · el riesgo de renta duplicada NO es hipotético: es de HOY, y borrar el generador muerto NO lo arregla

El dedupe del generador vivo filtra **por `sourceType` exacto**:

```ts
// treasurySyncService.ts:183-190
async function isDuplicate(sourceType: string, sourceId: number | string): Promise<boolean> {
  const existing = await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId);
  return existing.some(e =>
    e.sourceType === sourceType &&                    // ← :186
    e.predictedDate.startsWith(monthPrefix) &&
    isReconciled(e),
  );
}
// … y se invoca así:
if (await isDuplicate('contrato', contract.id)) { skipped++; continue; }   // ← :322
```

`insertEvent` (`treasurySyncService.ts:193-217`) hace lo mismo: busca `e.sourceType === sourceType` (`:199`).

**Consecuencia:** un evento de renta escrito por `assign_to_contract` con `sourceType:'contract'` es **invisible** para el dedupe del generador vivo. La renta de ese mes ya cobrada y conciliada contra un movimiento real **no impide** que la siguiente regeneración emita además un `'contrato'` `predicted` por el mismo alquiler. **El mismo dinero aparece dos veces.**

Esto ocurre hoy, con el generador muerto sin tocar. Neutralizar `treasuryForecastService` **no cambia nada** de este escenario.

### Hallazgo 3 · agravante · los eventos `'contract'` nacen HUÉRFANOS

`action.contractId` es opcional (`movementSuggestionService.ts:51`: `{ kind: 'assign_to_contract'; contractId?: number }`) y **nadie lo rellena nunca**: el único productor lo omite (`movementSuggestionService.ts:361`: `action: { kind: 'assign_to_contract' }`) y no hay ninguna UI que lo fije. Grep de `contractId` en `src/modules/tesoreria/v6/`, `bankStatementOrchestrator.ts` y `movementSuggestionService.ts`: **2 hits, ambos la declaración y el consumo, ningún escritor**.

Por tanto estos eventos se guardan con `sourceId: undefined` y sin `contratoId`, así que:
- `estadoCobroContratoService.esRentaDeContrato` (`:26-35`) **nunca** los reconoce (exige `contratoId === id` o `sourceId === id`) → no cuentan para el estado de cobro;
- quedan como ingreso de ámbito INMUEBLE, ejecutado y conciliado, **sin contrato al que pertenecer**;
- y aun así ensucian la caja frente a la renta prevista que sí se emitirá.

### Hallazgo 4 · no son dos generadores de renta, son TRES

La auditoría dijo dos. Hay un tercero, también muerto, que escribe en **otro store**:

| # | Generador | Escribe | `sourceType` / destino | Llamantes vivos |
|---|---|---|---|---|
| 1 | `treasurySyncService.generateMonthlyForecasts` `:156` (bloque contratos `:297-406`) | `treasuryEvents` | `'contrato'` | **SÍ** (`treasuryBootstrapService.ts:176`) |
| 2 | `treasuryForecastService.regenerateMonthForecast` `:715` → `regenerateRentalsForecast` `:487` | `treasuryEvents` | `'contract'` + clave `contract:${id}:${monthKey}` (`:507`) | **NO** — 0, ni en tests |
| 3 | `treasuryCreationService.generateIncomeFromContract` `:32` | store **`ingresos`** | `origen:'contrato_id'`, `destino_id: contract.propertyId` (`:71`) | **NO** — 0 |

El nº 3 además arrastra un bug latente: usa `contract.propertyId` **sin fallback a `inmuebleId`**, así que para cualquier contrato creado por el wizard moderno escribiría `destino_id: undefined` (ver Sub-tarea C).

Verificación de muerte del nº 2 y nº 3 (grep sobre todo `src/`, tests incluidos):

```
regenerateMonthForecast        → 1 hit: la propia definición (treasuryForecastService.ts:715)
regenerateRentalsForecast      → 2 hits: definición :487 + su llamada interna :735
generateIncomeFromContract     → 1 hit: la propia definición (treasuryCreationService.ts:32)
```

## A.2 · Por qué no aplico la acción tal como está redactada

La acción autorizada era *"neutralizar/eliminar el generador muerto `'contract'` y su clave de dedupe, dejando `'contrato'` como único"*. Puedo hacerlo con seguridad —el generador nº 2 está inequívocamente muerto—, **pero hacerlo solo eso sería engañoso**: cerraría el ticket dejando intacto el problema que el ticket dice resolver ("riesgo de renta duplicada"), y el PROYECTO §8 pide explícitamente *"código muerto con lógica buena: reutilizar, no reescribir"* — ese generador es justamente donde vive el único prorrateo enganchado del repo, que la Fase 1 quiere resucitar.

Aplicar en su lugar la corrección que **sí** arregla la duplicación (que el dedupe del generador vivo reconozca ambos `sourceType`) es un cambio de comportamiento sobre el generador de producción que esta tarea no autoriza. Regla absoluta de la tarea: *"si algo no cuadra con la auditoría o con el HEAD actual → PARAR y reportar, nunca inventar solución"*.

**Por eso: STOP. Cero líneas de código.**

## A.3 · Opciones para decidir (Jose)

Las tres son compatibles entre sí; recomiendo **A1 + A2 juntas** como contenido real de la Sub-tarea A.

### Opción A1 · Unificar el dedupe (arregla la duplicación real) — **recomendada**

Que `isDuplicate` e `insertEvent` de `treasurySyncService` traten `'contrato'` y `'contract'` como el mismo origen de renta, reutilizando el conjunto que ya existe y ya está probado en `estadoCobroContratoService.ts:20`.

- **Toca:** `treasurySyncService.ts:183-190` y `:193-217`. Extraer `RENT_SOURCE_TYPES` a un módulo compartido para no duplicar la constante.
- **Riesgo:** bajo. Amplía lo que el dedupe considera "ya emitido" → puede *dejar de emitir* previsiones que hoy sí emite, exactamente cuando ya existe un evento del mismo contrato y mes. Eso es el arreglo, no un efecto colateral.
- **Cuidado:** hoy los eventos `'contract'` no llevan `sourceId`, así que `getAllFromIndex('treasuryEvents','sourceId', id)` no los devuelve. Sin la Opción A2 esta corrección **no tiene efecto sobre los datos ya escritos**. Por eso van juntas.
- **Test:** dado un `treasuryEvent` `sourceType:'contract'` + `sourceId:<contratoId>` conciliado en el mes M, `generateMonthlyForecasts` no debe crear una renta `'contrato'` para ese contrato y mes.

### Opción A2 · Que `assign_to_contract` sepa a qué contrato asigna

Rellenar `contractId` (y `contratoId` en el evento) en el flujo del extracto. Hoy la acción se llama "asignar a un contrato" y no asigna a ninguno.

- **Toca:** `movementSuggestionService.ts:361` (proponer contrato candidato), la UI del drawer (elegirlo) y `bankStatementOrchestrator.ts:678-685` (escribir `sourceId` + `contratoId`).
- **Sin esto**, A1 no puede emparejar nada y el estado de cobro seguirá sin ver estos cobros.
- **Nota de alcance:** esto entra en territorio Tesorería/extracto, no Contratos. Decidir si va en Fase 0 o se abre ticket propio.

### Opción A3 · Retirar el generador muerto nº 2 (y opcionalmente el nº 3)

Es seguro (0 llamantes) y limpia el `contract:${id}:${monthKey}` del enunciado. **No arregla la duplicación.**

- **Conflicto con el PROYECTO §8:** `regenerateRentalsForecast` es el único consumidor de `calculateRentPeriodsFromContract` → borrarlo deja `calculateRentPeriodsNew` (`contractService.ts:391-444`, el prorrateo) sin ningún llamante. El prorrateo en sí **no se pierde** (vive en `contractService`, que se conserva), pero se pierde el ejemplo de cómo se enganchaba.
- **Alternativa conservadora:** en vez de borrar, alinear el generador muerto con el vivo (`sourceType:'contrato'` y misma clave de dedupe) y dejarlo ahí como base de la Fase 1. Elimina el riesgo latente sin tirar la lógica reutilizable.
- **Recomendación:** hacer A3 en su variante conservadora, o posponerla a Fase 1, donde ese código se va a tocar de todas formas.

### Lo que NO se debe hacer en ningún caso

**Purgar el valor `'contract'`** del tipo `TreasuryEvent.sourceType` (`types-movimientos.ts:239`) o de los lectores tolerantes. Rompe `bankStatementOrchestrator` y deja huérfanos los eventos históricos. Los cinco lectores que hoy toleran ambos valores (`estadoCobroContratoService.ts:20`, `punteoAdapter.ts:284,379`, `ingresosAnualesService.ts:28`, `post-open.ts:589`) **están bien como están** y deben quedarse.

---

# SUB-TAREA B · Triple vocabulario "turístico" — mapeo y propuesta

> Auditar y **PROPONER**. Nada modificado.

## B.1 · Corrección de partida: no son tres vocabularios, son CUATRO

La tarea nombra tres. Hay un cuarto, y es el que más pesa fiscalmente.

| # | Dónde | Campo | Valores | Nivel |
|---|---|---|---|---|
| 1 | `Contract` | `modalidad` | `'habitual' \| 'temporada' \| 'vacacional'` | contrato |
| 2 | `ExplotacionAlquiler` | `modo` | `'completo' \| 'habitaciones' \| 'turistico'` | inmueble (V90) |
| 3 | `Property.fiscalData` | `contractUse` | `'vivienda-habitual' \| 'turistico' \| 'otros'` | inmueble |
| **4** | **`Property`** | **`usoTipo`** | **`'larga_estancia' \| 'temporada' \| 'turistico' \| 'mixto' \| 'vivienda_habitual' \| 'disponible'`** | **inmueble** |

Definiciones: `types-contratos.ts:167` · `types-inmuebles.ts:221,243` · `types-inmuebles.ts:80` · `types-inmuebles.ts:124-130`.

## B.2 · Mapeo completo · ESCRITURAS

### 1 · `Contract.modalidad`

| Escritor | Línea | Qué escribe |
|---|---|---|
| `modules/inmuebles/wizards/contratoWizardPayload.ts` | `:58` (completo), `:94` (borrador) | `form.modalidad` (`<select>` en `NuevoContratoWizard.tsx:341-344`) |
| `modules/inmuebles/wizards/anexarSubcontratoPayload.ts` | `:53` (tipo en `:18`) | subcontrato de gestión (`AnexarSubcontratoForm.tsx:248`) |
| `modules/inmuebles/wizards/gestionGarantizadaPayload.ts` | `:125` | contrato de gestión (padre) · **fija `'habitual'` a pelo** |
| `services/contractImportCreationService.ts` | `:119` | `d.modalidadAtlas` (solo `'habitual' \| 'vacacional'`) |
| `services/declaracionOnboardingService.ts` | `:1159` | `tipoArrendamiento === 'no_vivienda' ? 'vacacional' : 'habitual'` |

Normalizador de import: `contractDraftService.ts:82-118` — `MAPEO_TIPO_RENTILA_ATLAS` colapsa `temporada` → `'vacacional'` (`:85-86`), y `mapTipoRentilaToAtlas` `:104-108` / `mapTipoAtlasToModalidad` `:112-116` hacen lo mismo por substring. **Los importadores nunca producen `'temporada'`**: solo el wizard puede.

### 2 · `ExplotacionAlquiler.modo`

| Escritor | Línea |
|---|---|
| `services/explotacionAlquilerService.ts` (`crear`/`actualizar`) | `:185`, `:198`, `:215` |
| `services/migrations/v90-explotacionAlquiler.ts` (siembra V90) | `:52` |
| UI: `modules/inmuebles/components/contratos/TabDisponibilidad.tsx` `<select>` | `:438-452` |

Derivación desde legacy: `explotacionAlquilerService.ts:58-88` (`explotacionDesdeLegacy`) — `modo = 'turistico'` **si y solo si** `p.usoTipo === 'turistico'` (`:69,83-87`). Es decir, el vocabulario 2 **se derivó del 4**.

### 3 · `Property.fiscalData.contractUse`

| Escritor | Línea |
|---|---|
| `services/declaracionOnboardingService.ts` | `:804` — `datos.uso === 'arrendamiento' \|\| 'mixto' ? 'vivienda-habitual' : 'otros'` |

**Único escritor de todo el repo.** Nótese que nunca escribe `'turistico'`: el valor existe en el tipo y **ningún código lo produce**.

### 4 · `Property.usoTipo`

| Escritor | Línea |
|---|---|
| `services/inmueblesImportCreationService.ts` | `:87` |
| `services/inmueblesTemplateParserService.ts` | `:222` (columna "uso" de la plantilla) |
| `components/onboarding/import-declaracion/pasos/PasoInmuebles.tsx` | `:72` |
| Wizard de inmueble (S-WIZARD-INMUEBLE-V4) | ficha del inmueble |

## B.3 · Mapeo completo · LECTURAS (lo que decide dinero)

### Motor fiscal · reducción por contrato

**Lee el vocabulario 1 (`Contract.modalidad`) y solo ese.**

```ts
// services/irpfCalculationService.ts:328-334
export function calcularPorcentajeReduccionContrato(contract: any): number {
  const modalidad = contract.modalidad ?? contract.type;          // :329
  if (modalidad === 'temporada' || modalidad === 'vacacional' || modalidad === 'turistico') {
    return 0;                                                      // :332-334
  }
  …
```

Detalle relevante: la línea `:332` compara contra `'turistico'`, **un valor que `Contract['modalidad']` no admite**. Solo puede entrar por el fallback legacy `contract.type` (`:329`), cuyo tipo declarado es `'vivienda' | 'habitacion'` (`types-contratos.ts:333`). Es una guarda defensiva sin fuente conocida — inofensiva, pero indica que alguien esperaba que el vocabulario de inmueble se colara aquí.

Selección de contratos del inmueble en el motor: `irpfCalculationService.ts:736` — `(c.inmuebleId ?? c.propertyId) !== prop.id` (ver Sub-tarea C).

### Motor fiscal · perfil de declaración (I/II/III/IV/V)

**Lee los vocabularios 1 Y 4, mezclados, en la misma función.**

```ts
// services/fiscalSummaryService.ts:545-580
function perfilDe(property: { usoTipo?: string; … }, …) {
  if (property?.usoTipo === 'vivienda_habitual') return 'IV';                    // :551  ← vocab 4
  …
  const modalidades = new Set(contractsDelAño.map((c) => c.modalidad)…);         // :567  ← vocab 1
  const tieneCorta = modalidades.has('vacacional') || modalidades.has('temporada'); // :568
  const tieneLarga = modalidades.has('habitual');                                // :569
  if (property?.alquilerPorHabitaciones?.activo || habitaciones) return 'III';   // :571
  if (tieneLarga && tieneCorta) return 'III';                                    // :572
  if (tieneCorta && !tieneLarga) return 'V';                                     // :573
  if (tieneLarga && !tieneCorta) { … return 'I' | 'II'; }                        // :574-577
  if (property?.usoTipo === 'mixto') return 'III';                               // :578  ← vocab 4
  if (property?.usoTipo === 'turistico' || property?.usoTipo === 'temporada') return 'V'; // :579
  if (property?.usoTipo === 'larga_estancia') return 'I';                        // :580
}
```

**Los contratos mandan; `usoTipo` es el desempate cuando no hay contratos en el año.** Esta es la única función donde los dos vocabularios coexisten con efecto sobre la declaración.

### Otros lectores

| Lector | Línea | Vocabulario | Efecto |
|---|---|---|---|
| `modules/inmuebles/utils/mapearTipoContrato.ts` | `:14` | 1 | `'corta'` si temporada/vacacional — etiqueta de UI |
| `modules/inmuebles/wizards/utils/catalogoModalidadInmueble.ts` | `:99-105` | 1 | `catalogoKindDeModalidad`: temporada/vacacional → `'turistico'`. Decide qué gastos se sugieren (`sembrarOpexInmueble.ts:50-63`) |
| `modules/horizon/herramientas/exporters/atlasExportService.ts` | `:541-543`, `:568` | 1 | etiqueta de export |
| `modules/horizon/herramientas/exporters/mappers.ts` | `:178` | **3** | **único lector de `contractUse` en todo el repo** |
| `services/explotacionAlquilerService.ts` | `:63-87` | 4 → 2 | deriva la explotación |
| `services/deduccionViviendaHabitualService.ts` | `:194` | 4 | `usoTipo === 'vivienda_habitual'` para la deducción pre-2013 |
| `services/irpfCalculationService.ts` | `:1289` | 4 | excluye la vivienda habitual de la imputación de rentas |
| `services/contractService.ts` | `:71`, `:517`, `:546` | 1 | plantilla derivada + validaciones |
| `modules/inmuebles/components/contratos/TabDisponibilidad.tsx` | `:60`, `:74`, `:438-452` | 2 | UI de disponibilidad |

## B.4 · Diagnóstico

**No hay tres fuentes compitiendo por lo mismo. Hay dos ejes legítimos y dos residuos.**

**Eje 1 · Qué régimen tiene ESTE contrato** → `Contract.modalidad`. Es el que decide la reducción del art. 23.2 LIRPF y el que manda en el perfil de declaración. Correcto ahí: la reducción es del contrato, no del ladrillo; un mismo piso puede tener contratos de régimen distinto en años distintos, y el histórico lo necesita.

**Eje 2 · Cómo se explota ESTE inmueble hoy** → `ExplotacionAlquiler.modo`. Es operativo (¿piso completo, habitaciones, turístico?), no fiscal. V90 lo sacó de `Property` a propósito. Correcto ahí.

**Residuo 1 · `Property.fiscalData.contractUse`.** Un escritor (`declaracionOnboardingService.ts:804`), un lector (un exportador, `mappers.ts:178`), **cero consumidores fiscales**, y su valor `'turistico'` no lo produce nadie. Está muerto de facto.

**Residuo 2 · `Property.usoTipo`.** El propio V90 lo declaró *"legacy de solo lectura hasta que no queden lectores"* (`types-inmuebles.ts:216-217`), **pero le quedan tres lectores vivos y dos son fiscales**: `fiscalSummaryService.ts:551,578-580`, `deduccionViviendaHabitualService.ts:194`, `irpfCalculationService.ts:1289`. **No está listo para retirarse.**

## B.5 · Propuesta

### Fuente única

| Pregunta | Fuente única propuesta | Estado |
|---|---|---|
| ¿Qué régimen tiene este contrato? (→ reducción, perfil) | **`Contract.modalidad`** | ya lo es · no tocar |
| ¿Cómo se explota este inmueble? (→ operativa, catálogo de gastos) | **`ExplotacionAlquiler.modo`** | ya lo es · no tocar |
| ¿Es la vivienda habitual? (→ imputación, deducción pre-2013) | **`Property.usoTipo === 'vivienda_habitual'`** | ya lo es · sigue siendo necesario |

Es decir: **no hay que colapsar nada.** Los dos vocabularios vivos responden a preguntas distintas y ninguno puede derivarse del otro sin pérdida.

### Acciones propuestas, en orden de riesgo

**B-1 · Retirar `fiscalData.contractUse` (riesgo BAJO · impacto fiscal NULO).**
Un escritor, un lector, ningún consumidor fiscal. Migrar `mappers.ts:178` a leer `Contract.modalidad` del contrato vigente (o `ExplotacionAlquiler.modo` si lo que quiere describir es el inmueble — hay que mirar qué exporta esa columna), dejar de escribirlo en `declaracionOnboardingService.ts:804` y marcar el campo `@deprecated`. **No borrar del tipo** hasta que una migración limpie los registros: es un campo opcional, dejarlo declarado no cuesta nada.
*Impacto fiscal: ninguno. Ninguna casilla lo lee.*

**B-2 · Documentar el contrato entre los dos ejes (riesgo NULO).**
Un bloque de comentario en `types-contratos.ts:167` y `types-inmuebles.ts:243` que diga explícitamente: *modalidad = régimen del contrato (fiscal); modo = explotación del inmueble (operativa); no se derivan uno del otro*. Hoy nada lo dice y por eso vuelve la duda cada vez.
*Impacto fiscal: ninguno.*

**B-3 · Decidir qué pasa con `'temporada'` (riesgo MEDIO · impacto fiscal REAL).**
`Contract.modalidad` admite `'temporada'` pero **ningún importador lo produce** (`contractDraftService.ts:85-86` lo colapsa a `'vacacional'`). Solo el wizard puede crearlo. Fiscalmente `'temporada'` y `'vacacional'` hacen exactamente lo mismo (reducción 0 en `irpfCalculationService.ts:332`; perfil V en `fiscalSummaryService.ts:568`). Dos opciones:
- **(a) conservar los tres valores** — el contrato de temporada del art. 3.2 LAU y el turístico del art. 5.e son figuras jurídicas distintas y el documento generado en Fase 3 no puede ser el mismo. **Recomendada** si Fase 3 va a generar contratos de verdad.
- **(b) colapsar a dos** (`habitual` / `corta`) — más simple, pero pierde la distinción justo cuando se va a necesitar para la plantilla.
*Impacto fiscal de (b): ninguno hoy (los dos valores dan el mismo resultado en los dos motores), pero se pierde la capacidad de separarlos si mañana la ley los trata distinto.*

**B-4 · NO tocar `Property.usoTipo` en esta fase (riesgo ALTO si se toca).**
Está marcado como legacy pero tiene tres lectores vivos, dos fiscales. Retirarlo exige antes: mover la señal "vivienda habitual" a su sitio definitivo (¿`ExplotacionAlquiler` ausente = uso propio, como sugiere el comentario de V90?), reescribir `fiscalSummaryService.ts:551,578-580` y `deduccionViviendaHabitualService.ts:194`, y migrar datos. **Es una tarea propia, no un sub-punto de Fase 0.**
*Impacto fiscal si se hace mal: el perfil de declaración cambia (IV↔I/III/V) y la deducción por vivienda habitual pre-2013 puede desaparecer o aparecer donde no toca. Es de las cosas que cambian reducciones en silencio.*

**B-5 · Limpiar la guarda huérfana `modalidad === 'turistico'` (riesgo BAJO).**
`irpfCalculationService.ts:332` compara contra un valor que el tipo no admite y que solo puede llegar por `contract.type` (declarado `'vivienda'|'habitacion'`). O se documenta por qué está, o se retira. Antes de retirarla conviene un conteo sobre datos reales: si algún `Contract` guardado tiene `type: 'turistico'`, quitarla **subiría la reducción de 0 a 50-60 %** en ese contrato. **Verificar antes de tocar.**

---

# SUB-TAREA C · Índice `propertyId` vs `inmuebleId` — mapeo y propuesta

> Auditar y **PROPONER**. Nada migrado, nada bumpeado.

## C.1 · Estado confirmado del índice

```ts
// services/db/upgrade-a.ts:47-50
if (!db.objectStoreNames.contains('contracts')) {
  const contractStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
  contractStore.createIndex('propertyId', 'propertyId', { unique: false });
}
```

Declarado en `db.ts:95`: `contracts: { key; value: Contract; indexes: { 'propertyId' } }` — **un solo índice**.

**El índice no se usa NUNCA.** Grep sobre todo `src/`:
```
getAllFromIndex('contracts', …)  → 0 hits
getFromIndex('contracts', …)     → 0 hits
```
Es un índice que se mantiene en cada escritura y del que no lee nadie.

## C.2 · Los `getAll` + filtro

**41 llamadas a `getAll('contracts')` / `getAllContracts()` repartidas en 36 ficheros** (excluyendo tests). Pero la premisa de la tarea —"las consultas por inmueble son `getAll`+filtro"— solo describe una minoría: **la mayoría de estos sitios necesita TODOS los contratos**, no los de un inmueble.

**Sitios que sí filtran por inmueble (los que un índice ayudaría):**

| Sitio | Línea | Filtro |
|---|---|---|
| `services/contractService.ts` (`getContractsByProperty`) | `:194-198` | `contract.inmuebleId === inmuebleId` |
| `modules/fiscal/v2/helpers/amortizacionAcumuladaService.ts` | `:113-115` | `c.inmuebleId === propertyId \|\| c.propertyId === propertyId` |
| `services/propertySaleService.ts` | `:546,550`, `:704` | ídem |
| `services/gananciaPatrimonialService.ts` | `:168-170` | ídem |
| `services/fiscalSummaryService.ts` | `:166-168`, `:673-675` | ídem |
| `services/rendimientoActivoService.ts` | `:152-154` | `(c.inmuebleId ?? c.propertyId) === propertyId` |
| `services/irpfCalculationService.ts` | `:682`, `:736` | ídem |
| `services/fiscalConciliationService.ts` | `:448`, `:118` | ídem |
| `services/inmuebleDeleteService.ts` | `:73`, `:173` | por inmueble |
| `services/dashboardService.ts` | `:1044`, `:1066` | `c?.inmuebleId ?? c?.inmueble_id ?? c?.propertyId ?? c?.property_id` |
| `pages/GestionInmuebles/VentaWizard.tsx` | `:77` | ídem |
| `services/historicoFiscalInmuebleService.ts` | `:43` | por inmueble |

**Sitios que necesitan todos los contratos (un índice no ayuda):** `treasurySyncService.ts:299`, `proyeccionMensualService.ts:863`, `InmueblesPage.tsx:24` (contexto de la app), `PanelPage.tsx:193`, `informesDataService.ts:533`, `atlasExportService.ts:77,528`, `libertadService.ts:200`, `budgetProjection.ts:246`, `onboardingSyncService.ts:24`, `onboardingDetectionService.ts:285`, `onboardingRevealService.ts:30`, `FirstRunRedirect.tsx:41`, `contractDraftService.ts:596` (dedupe global), `boteAnualService.ts:240`, `alquileresV3FixService.ts:103,151`, migraciones… — **~24 de los 41**.

## C.3 · El problema REAL no es el rendimiento: es el dato

Once sitios vivos escriben el filtro como `c.inmuebleId === X || c.propertyId === X` o `(c.inmuebleId ?? c.propertyId) === X`. **Eso no es paranoia defensiva: los datos están genuinamente partidos.**

| Escritor | ¿Escribe `inmuebleId`? | ¿Escribe `propertyId`? |
|---|---|---|
| Wizard (`contratoWizardPayload.ts:55`, `:91`) | **sí** | **NO** |
| Wizard de gestión / subcontrato | **sí** | **NO** |
| Importador (`contractImportCreationService.ts:119`, `:148`) | sí | sí (espejo legacy) |
| `declaracionOnboardingService.ts` | sí | — |
| `migrateOrphanedInmuebleIds.ts:330` | sí | sí (escribe ambos) |

Y hay al menos un lector vivo que usa **solo `propertyId`, sin fallback**:
`services/treasuryCreationService.ts:71` — `destino_id: contract.propertyId` → `undefined` para todo contrato creado por el wizard. (Mitigado hoy solo porque esa función, `generateIncomeFromContract` `:32`, está muerta — ver Hallazgo 4 de la Sub-tarea A. Si Fase 1 la resucita sin corregirla, escribirá ingresos sin inmueble.)

**Conclusión:** crear un índice `inmuebleId` sobre datos donde algunos registros pueden traer solo `propertyId` daría **resultados incompletos y silenciosos** — peor que el `getAll` actual, que al menos mira los dos campos.

## C.4 · Coste real de migrar

Un índice nuevo en IndexedDB exige `createIndex` dentro de un `versionchange`, luego: **bump `DB_VERSION` 90 → 91**.

| Pieza | Qué implica |
|---|---|
| Bump | `db.ts:57` + comentario de changelog (convención del repo) |
| `createIndex` | `upgrade-a.ts` — patrón ya existente: `ensure-index.ts` (32 líneas) y el precedente V88-físico (`traspasosPlanPensiones` índice `activoId`) |
| **Backfill obligatorio** | recorrer `contracts` y garantizar `inmuebleId = inmuebleId ?? propertyId` en todos. Migración POST-open idempetente con flag propio en `keyval`. **Sin esto el índice miente.** |
| Consultas | reescribir ~12 sitios a `getAllFromIndex('contracts','inmuebleId', id)`; **hay que quitar el `|| c.propertyId` de cada uno**, o el índice no aporta nada |
| Índice viejo | decidir si se conserva `propertyId` (nadie lo lee) o se borra |
| Tests | test de estructura (`db.structure.v79.test.ts` ya valida `db.version === DB_VERSION`) + test de migración al estilo `dbV79OnboardingMigration.test.ts` |

**Beneficio medible: prácticamente nulo.** El volumen es de decenas de contratos (la propia auditoría vieja menciona "60 Rentila"); un `getAll` + `filter` sobre 60 objetos en memoria es del orden de microsegundos. Además, muchos de los 12 sitios ya tienen los contratos cargados en el contexto de React (`InmueblesPage.tsx:24` → `useOutletContext`) y no van a la DB.

## C.5 · Propuesta

**Recomendación: NO migrar. NO bumpear. Consolidar el acceso en su lugar.**

Razones:
1. El beneficio de rendimiento es despreciable al volumen real.
2. El bump arrastra backfill + tocar 12 sitios + tests de migración: coste alto, riesgo de tocar rutas fiscales (`irpfCalculationService`, `fiscalSummaryService`, `gananciaPatrimonialService`) por un problema que no duele.
3. El problema verdadero —el dato partido `inmuebleId`/`propertyId`— **no lo arregla un índice**; lo arregla un backfill, y ese se puede hacer sin bump.

**C-1 · Un solo helper de identidad de inmueble (riesgo BAJO · sin bump) — recomendada.**
Extraer `idInmuebleDeContrato(c) => c.inmuebleId ?? c.propertyId` a un util compartido y sustituir las once variantes de `|| c.propertyId` / `?? c.propertyId` por esa función. Ganancia: una sola definición de "de qué inmueble es este contrato", en vez de once que ya divergen (unas usan `||`, otras `??`, `dashboardService.ts:1044` mira cuatro campos, `treasuryCreationService.ts:71` mira uno).

**C-2 · Backfill de `inmuebleId` (riesgo BAJO · sin bump).**
Migración POST-open idempotente con flag propio en `keyval` (patrón `migration_*_v1` ya establecido, `db.ts` catálogo D1): para todo `Contract` con `inmuebleId` ausente/0 y `propertyId` presente, fijar `inmuebleId = propertyId`. **No requiere `DB_VERSION`**: es dato, no esquema. Deja el terreno listo por si algún día se quiere el índice, y arregla hoy el riesgo de `treasuryCreationService.ts:71`.

**C-3 · Corregir `treasuryCreationService.ts:71` (riesgo NULO hoy).**
`destino_id: contract.propertyId` → usar el helper de C-1. La función está muerta, así que el cambio no altera comportamiento; evita que Fase 1 la resucite con el bug dentro.

**C-4 · Dejar documentado por qué el índice `propertyId` sigue ahí (riesgo NULO).**
Comentario en `upgrade-a.ts:49` diciendo que no lo lee nadie y que se conserva porque borrarlo exigiría un bump que no compensa. Hoy invita a "arreglarlo" cada vez que alguien lo mira.

**Si aun así se decide migrar** (p. ej. porque Fase 2 vaya a consultar contratos por inmueble en un bucle de eventos): el orden obligatorio es **C-2 (backfill) primero, en su propia tarea y verificado sobre datos reales**, y solo después el bump V91 + `createIndex` + reescritura de consultas. Nunca al revés.

---

# RESUMEN PARA DECIDIR

| Sub-tarea | Estado | Qué necesito de Jose |
|---|---|---|
| **A · `sourceType` duplicado** | 🔴 **STOP · 0 líneas** | La premisa era falsa: `'contract'` tiene escritor vivo (`bankStatementOrchestrator.ts:682`), la duplicación de rentas **ya ocurre hoy**, y borrar el generador muerto no la arregla. **Elegir entre A1/A2/A3** (§A.3). Mi recomendación: **A1 + A2**, y A3 en variante conservadora o pospuesta a Fase 1. |
| **B · triple (cuádruple) vocabulario** | ✅ informe entregado | Aprobar **B-1** (retirar `contractUse`, impacto fiscal nulo) y **B-2** (documentar). **Decidir B-3** (¿se conserva `'temporada'`?). **B-4** (`usoTipo`) fuera de Fase 0. **B-5** requiere conteo sobre datos reales antes de tocar. |
| **C · índice `propertyId`** | ✅ informe entregado | Recomiendo **no migrar**. Aprobar **C-1 + C-2 + C-3 + C-4** (sin bump). Si se quiere el índice igualmente: C-2 primero, en tarea aparte. |

**Nada de lo anterior está aplicado.** Este commit contiene solo este documento.

**Bonus fuera de alcance, para no perderlo:** hay un **tercer** generador de rentas muerto (`treasuryCreationService.generateIncomeFromContract:32`) que escribe en el store `ingresos`, no en `treasuryEvents`. No lo llama nadie. Conviene decidir su destino en Fase 1, cuando se toque la generación desde el alta.
