# T17 · End-to-end verification · 6 escenarios

**Fecha:** 2026-04-27
**Tarea:** TAREA 17 · sub-tarea 17.6
**Predecesores:** PR #1156 (17.1) · #1157 (17.2) · #1158 (17.3) · #1159 (17.4) · #1160 (17.5)
**DB version:** 65 · 40 stores · sin cambios

Esta guía documenta cómo verificar manualmente el flujo end-to-end de importación de extractos. Los 6 escenarios cubren los caminos críticos del pipeline `bankProfileMatcher → bankParser → matchBatch → suggestForUnmatched → confirmDecisions`. Para cada escenario hay pasos click por click, qué stores deberían tener qué, y qué inspeccionar en DevTools.

> **Cómo abrir DevTools en Chrome/Edge**
> `F12` → pestaña **Application** → sección **IndexedDB** → base de datos **AtlasHorizonDB** → expandir el store que toca cada escenario.

---

## Escenario 1 · Sabadell con 14 movimientos · 11 match · 3 sin-match

**Objetivo:** validar el camino feliz · matching contra `treasuryEvents` previstos + sugerencias para los sin-match.

**Pre-requisitos:**
- Tener una cuenta Sabadell creada en `/cuenta/cuentas`.
- Tener `treasuryEvents` previstos para abril 2026 (ej. rentas de inquilinos generadas desde `contracts`).

**Pasos:**
1. Ir a `/tesoreria` · click "Subir extracto" en la cabecera.
2. La página `/tesoreria/importar` aparece con el formulario.
3. Selector "Cuenta destino" · elegir "Sabadell · Rentas · ···0842".
4. Selector "Formato" · dejar en "Detectar automáticamente".
5. Período · dejar vacío.
6. Arrastrar un fichero Sabadell real (XLSX o CSV) con 14 movimientos · mix de rentas + suministros + 1 cargo Amazon.
7. La pantalla pasa a estado **loading** (spinner · "Detectando perfil bancario…").
8. Tras unos segundos aparece la card "Matching · 14 movimientos encontrados".

**Qué verificar en pantalla:**
- Subtítulo: "11 emparejados con previsiones · 3 sin match · 0 duplicados omitidos".
- Sección "Matches automáticos (11)" · 11 filas · cada una con checkbox marcado por defecto · pill de score (≥ 70) a la derecha.
- Sección "Sin match (3)" · cada fila lista una sugerencia con botón "Aplicar" · una de ellas ofrece "Ignorar".

**Qué verificar en DevTools:**
- Store **`movements`** · 14 nuevos rows · todos con `unifiedStatus: "no_planificado"` y `importBatch: "import_..."`.
- Store **`importBatches`** · 1 nuevo row · `accountId` correcto · `origenBanco: "Sabadell"`.
- Stores **`treasuryEvents`** y **`movementLearningRules`** · **sin cambios** (la mutación todavía no ha ocurrido).

**Acción de aprobación:**
9. Click "Aprobar 11 matches".
10. Toast "11 matches aprobados".

**Verificación post-aprobación en DevTools:**
- Store **`treasuryEvents`** · los 11 eventos correspondientes han pasado de `status: "predicted"` a `"executed"` y tienen `executedMovementId` apuntando al movement correcto y `executedAt: <ISO timestamp>`.
- Store **`movements`** · los 11 movements correspondientes ahora tienen `unifiedStatus: "conciliado"` y `statusConciliacion: "match_manual"`.
- Store **`movementLearningRules`** · entre 0 y 11 reglas nuevas (depende de si los `treasuryEvents` traían `categoryKey`/`categoryLabel` poblado).
- La pantalla vuelve a estado idle.

**Acción de aplicar sugerencias:**
11. Volver a subir el mismo extracto (los 11 ya conciliados se reconocerán como duplicados — ver escenario 3 — pero los 3 sin-match se reinsertarán).
12. Para cada uno de los 3 sin-match · click "Aplicar" en la sugerencia que se considere correcta.

**Verificación final:**
- Cada "Aplicar" crea un row nuevo en `treasuryEvents` con `status: "executed"` + `executedMovementId` correcto.
- El movement correspondiente queda en `unifiedStatus: "conciliado"`.

**Resultado esperado:** los 14 movimientos quedan en `conciliado` tras dos pasadas (aprobación masiva + aplicación de 3 sugerencias).

---

## Escenario 2 · Unicaja CSB43 con cuotas hipoteca

**Objetivo:** validar el flujo con formato Norma 43 (CSB43) · matching contra eventos de tipo `prestamo`/`hipoteca`.

**Pre-requisitos:**
- Cuenta Unicaja creada en `/cuenta/cuentas` con IBAN real.
- Préstamo hipotecario activo en `/financiacion/prestamos` con cuenta de cargo asignada a la cuenta Unicaja.
- `treasuryEvents` con `sourceType: "prestamo"` (o `"hipoteca"`) generados por `prestamosService` para los meses del extracto.

**Pasos:**
1. `/tesoreria` → "Subir extracto" → `/tesoreria/importar`.
2. Cuenta destino · "Unicaja · Hipotecas · ···4437".
3. Formato · seleccionar **"Norma 43 (CSB43)"** explícitamente (forzar el formato evita la ambigüedad de auto-detección sobre `.txt`).
4. Subir un fichero CSB43 real con cuotas de hipoteca.

**Qué verificar:**
- El parser maneja correctamente los decimales (recordatorio: bug histórico de Unicaja decimal a 1/10 — si reaparece, **PARAR · marcar TODO para TAREA 18 · NO arreglar aquí**).
- Las cuotas matchean contra `treasuryEvents` con `sourceType: "prestamo"` y `prestamoId` correcto.
- Score esperado: 95–100 (fecha + importe + cuenta · sin descripcion_proveedor porque préstamos no rellenan `providerName`).

**Qué verificar en DevTools tras "Aprobar":**
- `treasuryEvents` · cuotas con `status: "executed"` y `prestamoId` preservado.
- `movements` · `unifiedStatus: "conciliado"`.
- En `/financiacion/prestamos/<id>` · la sección "Cuotas pagadas" debe reflejar las cuotas confirmadas.

---

## Escenario 3 · Doble subida · deduplicación

**Objetivo:** validar que subir dos veces el mismo extracto NO crea duplicados.

**Pasos:**
1. Subir un extracto cualquiera con N movimientos · "Aprobar matches" si quieres (no es necesario).
2. **Sin descartar el batch · sin actualizar el navegador**, volver a `/tesoreria/importar` y subir el **mismo fichero exacto** otra vez.

**Qué verificar en pantalla:**
- Card de resultados con subtítulo: **"0 emparejados con previsiones · 0 sin match · N duplicados omitidos"**.
- No hay filas en ninguna de las tres secciones (Matches / Multi / Sin-match).

**Qué verificar en DevTools:**
- Store **`movements`** · sigue teniendo N rows nuevos · **NO** hay 2N (el hash `{accountId|date|cents|description}` reconoció todos como duplicados).
- Store **`importBatches`** · ahora hay 2 rows (uno por cada subida) · ambos del mismo `accountId` · pero los movements solo apuntan al primero.

**Caso edge:** si modificas un movement (por ejemplo cambias la descripción manualmente), la siguiente subida lo trataría como NUEVO (porque la firma del hash cambió). Esto es el comportamiento esperado · documentado para TAREA 18 si surge ruido.

---

## Escenario 4 · Coexistencia punteo manual + extracto

**Objetivo:** validar que si has punteado manualmente un evento ANTES de subir el extracto, la importación posterior NO duplica.

**Pasos:**
1. Ir a `/conciliacion` y puntear manualmente la renta del 22/04 (un `treasuryEvent` previsto). El servicio `treasuryConfirmationService.confirmTreasuryEvent` crea un movement espejo + flipa el evento a `executed`.
2. **Verificar en DevTools** que existe el movement espejo: `unifiedStatus: "conciliado"`, `accountId` correcto, `date: "2026-04-22"`, `amount: 380`.
3. Ir a `/tesoreria/importar` y subir el extracto de Sabadell que **incluye** esa misma renta del 22/04.

**Qué verificar:**
- En la card de resultados, la renta del 22/04 aparece como **duplicado** (en `duplicatesSkipped`) porque el hash `{accountId|date|cents|description}` matchea con el movement espejo creado por el punteo manual.
- **No** hay match propuesto contra el `treasuryEvent` ya `executed` (el matching service solo considera `status === 'predicted'`).
- El resto de movimientos del extracto se procesan normalmente.

**Caso edge:** si la descripción del movement espejo difiere del texto que viene del banco (por ejemplo si el punteo manual usó "Renta abril" pero el banco trae "TRANSFERENCIA INQUILINO PEREZ"), el extracto SÍ insertará un movement nuevo para esa fecha+importe pero como `no_planificado`. La regla de invariante "1 evento → 1 movement" sigue satisfecha (el evento ya está executed, no se vuelve a tocar).

---

## Escenario 5 · Learning rule · auto-aplicación

**Objetivo:** validar que aplicar una sugerencia heurística una vez crea una `movementLearningRule`, y que la siguiente importación con un movement de la misma "firma" sugerirá automáticamente esa regla con confidence ≥ 70.

**Pasos · primera ronda:**
1. Asegurar que `movementLearningRules` está vacío para esta firma · DevTools → store · filtro por `learnKey`.
2. Subir un extracto que contenga "BIZUM A FUENTES" para el mes M.
3. En la card de resultados, ese movement aparece en "Sin match" con sugerencia heurística vía C: `assign_to_contract` (confidence 50).
4. Click "Aplicar" · seleccionar el contrato de alquiler relevante en el desplegable de la UI (cuando 17.4 lo cablee — hoy se aplica como evento contract sin contractId, suficiente para alimentar learning).
5. Toast "Sugerencia aplicada".

**Qué verificar en DevTools tras la primera aplicación:**
- Store **`movementLearningRules`** · 1 row nuevo con:
  - `learnKey` · hash derivado de "BIZUM A FUENTES"
  - `categoria` · derivada de la action (en este caso, derivada del contrato seleccionado o `null` si la action es `assign_to_contract` puro · revisar `deriveCategoryFromAction`)
  - `appliedCount: 1`
  - `history[0].action: "CREATE_RULE"`

**Pasos · segunda ronda (mes M+1):**
6. Esperar al mes siguiente (o simular un extracto del mes M+1 con "BIZUM A FUENTES" en una fecha diferente).
7. Subir el extracto.
8. En la card de resultados, ese movement debería aparecer ahora con sugerencia vía B (learning_rule) · confidence ≥ 70 (la fórmula es `70 + min(15, log10(appliedCount + 1) * 5)` → con `appliedCount=1` la confidence es **72**).
9. Como el cortocircuito está en confidence ≥ 60, la sugerencia heurística vía C **no aparece** en el array (escenario 2 del spec §3.2 cubierto).
10. Click "Aplicar" · toast.

**Qué verificar tras la segunda aplicación:**
- La regla del store sube a `appliedCount: 2`.
- `history[]` tiene 2 entries (`CREATE_RULE` + `APPLY_RULE`).

**Caso edge:** si la regla nunca llega a `appliedCount > 0` (porque nadie aplica nunca la sugerencia inicial), seguirá emitiéndose con confidence 50 · vía B no cortocircuita y vía C también propone su heurística · ambas aparecerán en el array (escenario 5 del spec §3.2).

---

## Escenario 6 · Banco no detectado

**Objetivo:** validar el camino de error cuando `bankProfileMatcher` no detecta el banco (confidence < 60) y el usuario no ha pasado un hint.

**Pasos:**
1. Construir o renombrar un fichero CSV con cabeceras genéricas (sin nombres de bancos en el filename) y subirlo con formato "Detectar automáticamente".
2. La pantalla pasa a **loading** brevemente y luego a **error**.

**Qué verificar en pantalla:**
- Banner de error rojo (token `var(--grey-700)`, sin rojo manual): "No se pudo detectar el banco automáticamente. Elige el banco manualmente y vuelve a intentarlo. Tip: usa el selector 'Formato' para forzar CSV / XLSX / Norma 43."
- La card de resultados **no aparece**.

**Qué verificar en DevTools:**
- Store **`movements`** · sin nuevos rows.
- Store **`importBatches`** · sin nuevos rows.
- En la consola, el `BankProfileNotDetectedError` queda registrado.

**Acción de recuperación:**
3. Cambiar el selector "Formato" a **"CSV genérico"** (o el formato real del fichero).
4. Volver a subir el mismo fichero.
5. Como `formatHint` ya no es `"auto"` y se interpreta como el hint de banco para el orquestador (`options.bankProfileHint` actúa de bypass), el parser corre sobre el formato forzado y la importación procede.

> **TODO TAREA 18:** la UI debería mostrar también un selector "Banco" para forzar `bankProfileHint` directamente (más explícito que el actual workaround vía `formatHint`). Documentado en docs/AUDIT-T16 y en el spec §11.

**Caso edge:** si el fichero realmente no es un extracto bancario (por ejemplo es un PDF o un XLSX con estructura no reconocible), el parser fallará en `parseFile` y el error que se muestra al usuario será el del parser, no el del orquestador. Esto sigue siendo el comportamiento correcto.

---

## Resumen · qué se valida con cada escenario

| Escenario | Capa(s) validada(s) | Stores tocados |
|---|---|---|
| 1. Sabadell 14 movs · 11 match · 3 sin-match | parser · matcher · suggestion · confirmDecisions | movements · treasuryEvents · importBatches · movementLearningRules |
| 2. Unicaja CSB43 cuotas hipoteca | parser CSB43 · matching contra `prestamo` | movements · treasuryEvents (`sourceType: "prestamo"`) |
| 3. Doble subida · dedup | hash dedup `{accountId\|date\|cents\|description}` | movements (sin crecimiento) · importBatches (2 rows) |
| 4. Punteo manual + extracto | invariante "1 evento → 1 movement" · dedup | movements (espejo del punteo + nuevos del extracto) |
| 5. Learning auto-aplicación | vía B `learning_rules` · cortocircuito ≥ 60 · `appliedCount` log10 bonus | movementLearningRules · treasuryEvents (executed) |
| 6. Banco no detectado | `bankProfileMatcher.match` < 60 sin hint · `BankProfileNotDetectedError` | sin escritura |

---

## Lo que esta verificación NO cubre

- ❌ Calibración exacta de los 10 perfiles bancarios contra archivos reales · TAREA 18.
- ❌ IA Claude como fallback cuando regex falla · TAREA 19.
- ❌ Bootstrap automático de `compromisosRecurrentes` desde histórico (vía A del suggestion service) · TAREA 9.
- ❌ Parsers OFX y QIF · sus placeholders siguen devolviendo error.
- ❌ Extractos en PDF (los bancos que solo dan PDF requieren OCR · TAREA 19).

---

## Si algo falla

1. **Capturar el escenario** que falla con DevTools abierto en la pestaña Application + Console.
2. **No bypassear ni mutar manualmente la DB** desde el inspector — los datos del usuario en producción no se tocan.
3. Abrir un issue en el repo con la captura, el escenario y el comportamiento esperado vs. observado.
4. Si el bug es de un perfil bancario concreto (regex no captura cabeceras, decimales mal interpretados, fechas en formato raro), añadirlo a la pila de TAREA 18.
5. Si el bug es del orquestador, matcher o suggestion service, abrir un PR de fix-forward — la base mergeada de T17 ya cubre los 6 caminos críticos.

---

**Fin del documento de verificación · TAREA 17 cierra con los 5 PRs mergeados (#1156-#1160) + este commit final.**
