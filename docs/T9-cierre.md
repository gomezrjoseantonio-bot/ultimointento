# T9 · Cierre · bootstrap compromisos recurrentes

> **Sub-tarea 9.4** · TAREA 9 cerrada formalmente.
>
> Documento canónico de cierre · resumen del trabajo, métricas observables,
> decisión sobre re-detección automática, TODOs documentados y referencias
> cruzadas a docs canónicos del repo.

---

## 1 · Resumen ejecutivo

TAREA 9 ha implementado el **bootstrap del store `compromisosRecurrentes`**
desde el histórico de `movements` del usuario. Cuatro sub-tareas en orden con
STOP-AND-WAIT:

| Sub-tarea | PR | Alcance | Tests |
|---|---|---|---|
| **T9.1** | #1195 | `compromisoDetectionService` · algoritmo 5 fases · audit doc · página DEV `/dev/compromiso-detection` | 10 |
| **T9.2** | #1196 | `compromisoCreationService` · idempotente · validación canónica · activación end-to-end vía A | 7 + 1 e2e |
| **T9.3** | #1197 | UI productiva `/personal/gastos/detectar-compromisos` · revisión + edición + aprobación + bulk | (UI) |
| **T9.4** | #1200 | Cierre · docs canónicos · verificación e2e · decisión re-detección automática | (docs) |

**Estado** · TAREA 9 ✅ **CERRADA**.

---

## 2 · Algoritmo de detección · resumen 5 fases

Implementado en `src/services/compromisoDetectionService.ts`. Defaults · `minOcurrencias=3` · `maxAntiguedadMeses=18` · `toleranciaImportePercent=5` (reservada) · `toleranciaDiaMes=3` (reservada).

| Fase | Operación | Output |
|---|---|---|
| 1 · Carga + normalización | `getAll('movements')` · filtra `amount<0` · `state!=='ignored'` · ventana temporal · normaliza descripción (uppercase + strip números + 3 primeras palabras significativas) | `NormalizedMovement[]` |
| 2 · Clustering | Agrupa por `concepto + accountId` · descarta clusters < `minOcurrencias` | `clusters[][]` |
| 3 · Patrón temporal | Inferencia contra las **8 variantes** de `PatronRecurrente` (mensualDiaFijo · cadaNMeses 2/3/6 · anualMesesConcretos) · si no encaja, descarta el cluster con warning | `PatronRecurrente \| null` |
| 4 · Importe | Inferencia contra **3 de 4 modos** de `ImporteEvento` (fijo cv<0.5%, variable cv<5%, diferenciadoPorMes cv<20% con patrón mensual). Modo `porPago` queda fuera de scope (requiere input usuario) | `ImporteEvento \| null` |
| 5 · Filtrado + scoring | Descarta candidatos por: vivienda habitual (cuentaCargo + tokens semánticos) · inmuebles inversión (alias/dirección/refCatastral) · compromiso existente · score < 60. Score base 50 + bonus ocurrencias (cap +20) + estabilidad (+15) + fijo (+10) + proveedor reconocido (+5) · cap 100 | `CandidatoCompromiso[]` |

---

## 3 · Servicios nuevos

### 3.1 · `src/services/compromisoDetectionService.ts` (T9.1)

API pública:

- `detectCompromisos(options?: DetectionOptions): Promise<DetectionReport>` · solo lectura · jamás escribe en DB
- Tipos exportados · `CandidatoCompromiso` · `DetectionOptions` · `DetectionReport`

### 3.2 · `src/services/compromisoCreationService.ts` (T9.2)

API pública:

- `createCompromisosFromCandidatos(candidatos, options?): Promise<CreationResult>` · idempotente · valida + persiste + regenera `treasuryEvents`
- `detectAndPreview(options?): Promise<DetectionReport>` · proxy a `detectCompromisos` · útil para refresh desde UI sin importar 2 servicios
- Tipos exportados · `CreationOptions` · `CreationResult`

### 3.3 · No se modificó

- `src/services/personal/compromisosRecurrentesService.ts` · solo se reusan exports existentes (`crearCompromiso` · `puedeCrearCompromiso` · `listarCompromisos`)
- `src/services/movementSuggestionService.ts` · vía A ya estaba implementada en T17 · se "activa sola" en cuanto el store deja de estar vacío

---

## 4 · UI

### 4.1 · Página DEV · `/dev/compromiso-detection` (T9.1)

`src/pages/dev/CompromisoDetection.tsx` + `.module.css`.

DEV-only (gated por `REACT_APP_ENABLE_DEV_PAGES=1` o `NODE_ENV=development`). Permite inspeccionar el `DetectionReport` completo · estadísticas globales · tabla de candidatos · botones expandir ocurrencias y ver propuesta JSON. Sin botones de aprobar.

### 4.2 · Página productiva · `/personal/gastos/detectar-compromisos` (T9.3)

`src/modules/personal/pages/DetectarCompromisosPage.tsx`.

Sub-página de Personal/Gastos · navegable desde el botón "Detectar desde histórico" en `GastosPage` o desde el `EmptyState` cuando el catálogo está vacío. Estructura canónica v5 · PageHead con breadcrumb · 3 cards (configuración · resultados con filtro por tipo · acciones bulk sticky) · modal de edición con focus trap + Escape close · idempotencia heredada de `createCompromisosFromCandidatos`.

---

## 5 · Vía A activada · `movementSuggestionService`

Verificado en `src/services/__tests__/compromisoCreationViaA.e2e.test.ts` (T9.2). La integración end-to-end es:

```
Usuario aprueba candidato Iberdrola en T9.3 UI
  → compromisoCreationService.createCompromisosFromCandidatos
  → compromisosRecurrentesService.crearCompromiso
  → db.add('compromisosRecurrentes', ...)
  → regenerarEventosCompromiso (treasuryEvents predicted)

Usuario importa extracto bancario después
  → movementSuggestionService.suggestForUnmatched(movementIds)
  → loadActiveCompromisos · ahora retorna ≥1 compromiso (estaba vacío pre-T9)
  → suggestFromCompromiso · matching cuenta + importe ± 5%
  → MovementSuggestion { via: 'compromiso_recurrente', confidence: 70-90 }
```

Pre-T9, vía A devolvía `[]` siempre porque el store estaba vacío y la cascada caía a vía B (learning rules) o vía C (heurísticas). Post-T9, vía A es la primera línea de matching para gastos recurrentes y corta-circuita las otras dos cuando confidence ≥ 60.

---

## 6 · Métricas

### 6.1 · Métricas observables sobre tu DB

Las métricas concretas se obtienen ejecutando la detección sobre la DB local del usuario · NO se incluyen aquí porque dependen del histórico real. Para capturarlas:

1. Abrir deploy preview · `/dev/compromiso-detection`
2. Pulsar "Analizar movimientos" con defaults
3. La página muestra:
   - `movementsEnDB` · total bruto en el store
   - `movementsAnalizados` · post-filtro fase 1
   - `movementsAgrupados` · entraron en clusters ≥ 3 ocurrencias
   - `clustersTotales`
   - `candidatosPropuestos`
   - `candidatosFiltrados` · desglose por motivo (vivienda habitual · inmueble inversión · compromiso existente · score < 60)
   - Lista top de candidatos con `confidence` · `razonesScore` · `avisos`

### 6.2 · Diff de calidad · sugerencias T17 antes/después

Antes de T9 · `movementSuggestionService` ofrecía:
- vía A · vacía siempre (store sin contenido)
- vía B · solo si había learning rules persistidas (cero al inicio · crece con uso)
- vía C · heurísticas genéricas sobre tokens (suministros · IBI · BIZUM · etc.)

Después de T9 (con N compromisos aprobados) ·
- vía A · matching directo por cuenta + importe + proveedor · confidence 70-90 · corta-circuita
- Para movements recurrentes confirmados, la sugerencia es precisa al céntimo en vez de heurística genérica
- vía C sigue cubriendo gastos no recurrentes y proveedores no catalogados

**Cuantificar el delta** · medir % de movements no conciliados en una importación post-T9 que reciben sugerencia vía A vs vía C. Esto requiere instrumentación adicional fuera del scope T9 · queda como TODO de observabilidad para T17 sub-tarea futura.

---

## 7 · Decisión · re-detección automática post-import

### 7.1 · Análisis

**Opción A · Re-detección automática tras cada import**

Cada vez que llega un extracto nuevo a Tesorería, re-correr `detectCompromisos` y mostrar un badge en `/personal/gastos` con "N nuevos compromisos posibles".

Pro · descubrimiento proactivo · usuario no tiene que recordar volver a `/personal/gastos/detectar-compromisos` periódicamente.

Contra ·
1. **Coste · cada import añade overhead**. La detección actual sobre 18 meses de DB local es ~200-800 ms · aceptable como 1-shot pero molesto si se ejecuta tras cada extracto (que pueden ser N en una sesión de import).
2. **Ruido · cada import añade pocos movements nuevos**. La detección clusteriza por cuenta + concepto · 1 ocurrencia más raramente cambia el resultado a < 6 meses de uso. La señal/ruido del badge sería baja.
3. **Falsa urgencia** · un badge persistente induce ansiedad ("tengo X cosas pendientes"). Si la detección manual ya es 1 click + 1 segundo, el coste-beneficio del badge automático no compensa.
4. **Re-correr cuando llega 1 movement** · si Jose ya aprobó los compromisos relevantes, los nuevos candidatos serán raros. Si no aprobó nada, el badge no añade nada que el flujo manual ya cubra.

**Opción B · Solo manual desde la UI**

El usuario va a `/personal/gastos/detectar-compromisos` cuando quiera (botón en el header de Gastos · CTA en EmptyState · entrada explícita).

Pro · simplicidad · sin background jobs · sin badges parpadeantes · Jose decide cuándo invertir 30 segundos en revisar candidatos.

Contra · si Jose nunca vuelve a la página, los nuevos compromisos quedan sin descubrir.

### 7.2 · Recomendación · **Opción B** · solo manual

Razonamiento ·

1. **El catálogo se estabiliza rápido** · los suministros · suscripciones · seguros · cuotas básicas se descubren en la primera ejecución de detección sobre 12-18 meses de histórico. Las altas/bajas (cambio de operador, nueva suscripción) son eventos poco frecuentes que el usuario percibe en su vida (no necesita un badge).

2. **El bucle T17 no depende de re-detección** · una vez que los compromisos están en el store, la vía A los aplica automáticamente sobre cada import. Si el usuario añade un compromiso nuevo manualmente desde la UI futura (que no es scope T9), también funciona.

3. **El coste de oportunidad es bajo** · si Jose detecta un patrón nuevo en sus extractos, puede ir a `/personal/gastos/detectar-compromisos` o crearlo manualmente cuando llegue T9.5 (formulario manual · ver §8).

4. **Simplicidad arquitectónica** · evita coupling entre `compromisoDetectionService` y el flujo de import (`bankStatementOrchestrator`). Mantiene capas separadas.

### 7.3 · Cierre

NO se implementa re-detección automática post-import en T9. La opción A queda **descartada** salvo que feedback de uso real revele que Jose se olvida de revisar candidatos · en cuyo caso se reabre como T9.5 con badge no-blocante (no toast · no modal · solo badge sutil en sidebar de Personal).

---

## 8 · TODOs documentados · futuras sub-tareas

### 8.1 · Creación manual de compromiso (T9.5 candidato)

Formulario para dar de alta un compromiso sin pasar por detección desde histórico (ej · contrato nuevo recién firmado · subscripción mensual). Hoy el usuario no puede crear compromisos sin movements previos. Posible ubicación · botón "+ nuevo compromiso" en el header de `GastosPage` que abre un wizard.

### 8.2 · Edición de compromisos existentes (T9.6 candidato)

T9.3 solo permite editar la propuesta antes de aprobar. Una vez creado, el compromiso solo se puede editar via `compromisosRecurrentesService.actualizarCompromiso` (sin UI). Pendiente · pantalla de edición desde la tabla de `GastosPage` (click en fila → modal editar).

### 8.3 · Soporte de ámbito 'inmueble' en detección

Hoy el detector siempre propone `ambito='personal'` · si Jose aprueba un compromiso que en realidad pertenece a un inmueble de inversión, debe ajustar manualmente desde la UI futura de edición. Cuando se implemente §8.2, se añadirá toggle "ámbito" · `personal | inmueble` con selector de inmueble.

### 8.4 · `tolerancia*` options enforced

`toleranciaImportePercent` y `toleranciaDiaMes` están en `DetectionOptions` con defaults pero hoy NO se enforcement (umbrales fijos en fases 3 y 4). Si feedback de uso muestra que los umbrales rígidos producen falsos negativos, ampliar para que estos parámetros controlen los thresholds.

### 8.5 · Modo `porPago` no inferido

`fase4_inferImporte` solo emite 3 de los 4 modos de `ImporteEvento`. `porPago` (mapping mes→importe explícito) requiere input usuario · si feedback muestra compromisos reales con este modo (ej · IBI dividido en plazos no estándar), añadir UI para configurarlo manualmente desde edición.

### 8.6 · Refinamiento del algoritmo con datos reales

Posibles ajustes según uso ·
- Threshold score (60 actual) · puede ser muy permisivo o demasiado conservador según feedback Jose
- Lista de proveedores reconocidos · ampliar con marcas locales (cooperativas energéticas · empresas regionales)
- Detección de patrones bimensuales/trimestrales no fiscales · si aparecen warnings recurrentes, ampliar las 8 variantes de `PatronRecurrente` (no en T9 · spec lo prohíbe explícitamente)

### 8.7 · Observabilidad · diff de calidad sugerencias T17

Instrumentar `movementSuggestionService` para registrar % de movements con sugerencia vía A vs B vs C en cada import · expone evidencia cuantitativa del impacto de T9.

---

## 9 · Documentos canónicos actualizados

- ✅ `docs/STORES-V60-ACTIVOS.md` · sección `compromisosRecurrentes` actualizada · ya no es "vacío válido" · marca el bootstrap T9 + las fuentes de creación
- ✅ `docs/T9-end-to-end-verification.md` · 5 escenarios manuales paso-a-paso
- ✅ `docs/T9-cierre.md` · este documento
- ✅ `docs/AUDIT-T9-bootstrap.md` (T9.1) · auditoría inicial
- ✅ `docs/TAREA-9-bootstrap-compromisos-recurrentes.md` · spec original (no se modifica)

---

## 10 · Tareas que se descongelan al cerrar T9

Per spec global ·

1. **T8** · refactor schemas restantes · activar campos cache T7 sub-1
2. **T10** (tras cerrar T8) · cierre TODOs T7 sub-tareas 3-5
3. Tras los 5 saneamientos cerrados (T15 · T14 · T9 · T8 · T10), valorar T21 (Phase 4 parte 2 horizon) o features nuevas
4. **Validación pendiente desde T14** · revisar cálculo IRPF post-GAPs cerrados contra declaración real Jose 2024/2025

---

**Fin T9 · 4 sub-tareas mergeadas · 17 tests verdes · 3 servicios + 2 páginas + 4 docs · vía A del `movementSuggestionService` activada · DB_VERSION sigue en 65 · datos del usuario intactos.**
