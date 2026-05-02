# ATLAS · Arquitectura canónica · módulo FINANCIACIÓN

> **Tipo** · documento de arquitectura · restricción dura para todo trabajo futuro en el módulo Financiación
>
> **Fecha** · 2026-05-02
>
> **Estado** · canónico · cualquier especificación futura sobre Financiación debe respetar este documento
>
> **Versión** · 1.0
>
> **Ámbito** · ÚNICAMENTE módulo Financiación (préstamos · cuadros de amortización · cuotas · liquidaciones · imputación fiscal de intereses). Otros módulos (Rentas · Aportaciones · Gastos recurrentes · etc.) tendrán sus propios documentos análogos · NO se infieran reglas de aquí a otros módulos.
>
> **Aplica a** · CC (specs) · Claude (chat) · cualquier instancia futura que toque persistencia o lógica de Financiación

---

## 0 · Por qué existe este documento

Las sesiones de trabajo sobre Financiación han tendido a reabrir decisiones cerradas · proponer flujos eliminados · y mezclar verdad operacional con verdad fiscal. Este documento congela la decisión arquitectónica acumulada en una referencia única.

Toda spec o auditoría sobre Financiación arranca consultando este documento. Si un caso no encaja · NO se inventa · se actualiza el documento con justificación expresa de Jose y solo entonces se procede.

---

## 1 · Vías de entrada de un préstamo en ATLAS

Un préstamo entra al sistema por **4 vías legítimas** · ni más ni menos.

### 1.1 · Wizard manual

`PrestamosWizard.tsx` · usuario rellena campos · `prestamosService.createPrestamo()` genera plan vía `prestamosCalculationService.generatePaymentSchedule()` · marca cuotas pasadas como `pagado=true` · persiste.

Caso de uso · préstamo nuevo recién firmado o préstamo histórico que el usuario carga manualmente porque tiene la documentación.

### 1.2 · Importación FEIN

OCR de la oferta vinculante · prerellena campos del wizard · usuario completa · `createPrestamo` igual que vía manual.

Caso de uso · simplificar entrada de préstamos nuevos a partir del documento bancario.

### 1.3 · Importación masiva (onboarding)

Carga de varios préstamos al inicio · vía manual estructurada (no XML AEAT). Internamente termina llamando `createPrestamo` por cada préstamo.

Caso de uso · cliente nuevo con cartera de varios préstamos antiguos · lo carga todo de golpe.

### 1.4 · NUNCA · desde XML AEAT

**El préstamo NO se crea desde XML AEAT.** Decisión cerrada. Esta vía estuvo planteada en algún momento y fue eliminada.

Lo que el XML AEAT sí aporta sobre préstamos es **información fiscal del año declarado** · concretamente el campo `properties.interesesFinanciacion[año]` (intereses ya declarados como deducibles ese año). Esa información se vincula al **inmueble** · no genera el préstamo.

Si en una sesión futura alguien propone "vamos a crear préstamos desde XML" · es regresión arquitectónica · se rechaza.

---

## 2 · Plan de pagos · única fuente de verdad operacional del préstamo

### 2.1 · Dónde vive

Embebido en `prestamo.planPagos.periodos[]` dentro del documento `prestamo` en el store `prestamos`. NO existe store separado de cuotas · NO existe `cuadroAmortizacion` · NO existe tabla de relación.

Tipo `PeriodoPago` (`src/types/prestamos.ts`) · cada cuota lleva `periodo` · `fechaCargo` · `cuota` · `interes` · `amortizacion` · `principalFinal` · `pagado: boolean` · `fechaPagoReal?` · `movimientoTesoreriaId?`.

### 2.2 · Cómo se genera

Solo por `prestamosCalculationService.generatePaymentSchedule(prestamo)`. **Función pura · sin DB.** Sistema francés · soporta prorrata · solo-intereses · día clamped.

Llamada desde `createPrestamo` al alta y desde `updatePrestamo` cuando los parámetros cambian (`hasAmortizationParametersChanged()` lo detecta).

### 2.3 · Cuándo se regenera

- Al crear préstamo · siempre
- Al editar préstamo · solo si cambian parámetros (TIN · plazo · principal · sistema · día cargo · etc.)
- Al aplicar liquidación / amortización anticipada · regenera cuotas posteriores · preserva las anteriores ya pagadas
- NUNCA se regenera para reflejar pagos · `pagado=true` se aplica sobre el plan existente · no regenera

### 2.4 · Ningún componente puede recalcular el cuadro

Existe deuda técnica detectada en auditoría · `CuadroAmortizacion.tsx` (componente legacy en `src/modules/horizon/financiacion/components/`) tiene su propio cálculo francés inline simplificado (sin prorrata · sin solo-intereses) que se activa cuando no recibe `periodos` precalculados.

**Regla** · este componente debe migrarse a presentación pura. Si no recibe `periodos` · muestra estado vacío · NO recalcula.

Único cálculo válido · `prestamosCalculationService.generatePaymentSchedule()`. Cualquier otro recálculo es regresión.

---

## 3 · Estado de cada cuota · 3 valores derivados · 1 valor persistido

### 3.1 · Lo persistido

Solo `PeriodoPago.pagado: boolean`.

### 3.2 · Lo derivado en runtime · Pagada · En curso · Pendiente

```
si pagado === true                                              → "Pagada"
si pagado === false y fechaCargo en mes y año actuales          → "En curso"
si pagado === false y fechaCargo en futuro                      → "Pendiente"
```

Patrón implementado correctamente en `src/modules/financiacion/pages/DetallePage.tsx`. **NO se consulta `movements` para determinar el estado.** Se lee solo el flag persistido del plan + comparación con fecha actual.

### 3.3 · Vías por las que `pagado` pasa de `false` a `true`

3 vías · y solo 3:

**Vía A · auto-marcado al crear préstamo**
`createPrestamo` recorre `planPagos.periodos[]` · si `fechaCargo <= today` y `!pagado` · marca `pagado=true` y `fechaPagoReal=fechaCargo`. Aplica solo al alta.

**Vía B · click manual en calendario**
Usuario abre detalle del préstamo · pestaña Cuadro de amortización · click en una fila · `marcarCuotaManual` actualiza `pagado=true` y recalcula campos agregados (`cuotasPagadas` · `principalVivo`).

**Vía C · conciliación de movimiento bancario**
Movimiento bancario llega a una cuenta · matching busca candidatos en cuotas no pagadas · usuario confirma o automatismo confirma según score · `marcarCuotaManual` con `movimientoTesoreriaId` enlaza ambos · actualiza `pagado=true`.

NO existe vía D. Si una sesión futura propone una cuarta · es para revisar.

---

## 4 · Matching movimiento bancario ↔ cuota · regla bidireccional

### 4.1 · La regla

Matching automático entre `movements` y `prestamo.planPagos[].periodos[]` · disparado por **dos eventos** · sin solapamiento · sin duplicación.

**Evento 1 · llega un movimiento bancario nuevo**
Por importación de extracto o entrada manual de movement. Se ejecuta el matcher contra todos los préstamos vivos · se buscan cuotas no pagadas con importe + fecha + concepto compatibles (lógica `buscarCandidatosConciliacion` ya existente · score por importe ±tolerancia · fecha ±días · keywords). Si match · se confirma (auto o manual según score) · `pagado=true` + `movimientoTesoreriaId` enlazado.

**Evento 2 · se crea un préstamo nuevo**
Se ejecuta el matcher contra todos los `movements` ya existentes · se buscan los que sean cargo recurrente compatible con cuotas del nuevo plan · se enlazan los que matcheen.

**Importante** · cuando se ejecuta el evento 2 · las cuotas ya están marcadas `pagado=true` por el auto-marcado de §3.3 vía A. El matching del evento 2 lo que hace es **enlazar el movement existente con la cuota correspondiente** · poblar `movimientoTesoreriaId` · sin alterar el flag `pagado` (ya estaba en true).

### 4.2 · Por qué no hay "movements huérfanos"

Si llega un cargo bancario que es claramente una cuota pero no encuentra préstamo vivo que case · el movement queda en su store sin enlace. Cuando el usuario cree el préstamo correspondiente · el evento 2 lo capturará. No es huérfano · es "esperando".

Si en cambio nunca se crea el préstamo · el movement vive como movement bancario sin más · que es lo correcto · no inventamos préstamos.

### 4.3 · Por qué NO se crean `movements` al alta del préstamo

Decisión cerrada y confirmada. Razones:

- Si el usuario nunca importa el extracto bancario · `movements` reflejaría cargos imaginarios · contradice "fuente de verdad transaccional"
- Si el usuario importa el extracto después · habría duplicación · cada cuota pasada estaría dos veces
- El plan ya marca `pagado=true` para reflejar que la cuota se pagó · esa información va al cuadro de amortización · al cálculo de KPIs derivados · y al cálculo de intereses · sin necesitar un `movement` paralelo

Si en una sesión futura alguien propone "vamos a crear movements al alta de préstamo" · es regresión · se rechaza.

### 4.4 · Por qué NO se crean `treasuryEvents` para cuotas pasadas

Mismo razonamiento. `treasuryEvents` es para presente y futuro conciliable · no para histórico. Una cuota pagada no necesita evento previsional · ya está marcada en el plan.

`treasuryEvents` con `prestamoId` y `numeroCuota` se generan solo para mes actual y futuros · vía `generateMonthlyForecasts` · cuando ese mes se solicita y la cuota correspondiente sigue `!pagado`.

---

## 5 · KPIs agregados · siempre derivados · nunca solo cacheados

### 5.1 · Lista de KPIs

- `cuotasPagadas` · número de periodos con `pagado=true`
- `principalVivo` · `principalFinal` de la última cuota pagada · si no hay ninguna · igual a `principalInicial`
- `porcentajeAmortizado` · `(principalInicial − principalVivo) / principalInicial × 100`
- `interesesAcumulados` · suma de `interes` de cuotas pagadas (para vista anual · filtrar por año)
- `proximaCuotaFecha` · primera cuota con `pagado=false`
- `proximaCuotaImporte` · `cuota` de esa primera no pagada

### 5.2 · Regla universal

Todos los KPIs se calculan por una función pura sobre `prestamo.planPagos[]`. **Pueden cachearse** en el documento `prestamo` para acceso rápido en listados · pero **el cache NUNCA es la verdad** · es proyección de la función.

### 5.3 · Cache · cuándo se actualiza

El cache (`prestamo.cuotasPagadas` · `prestamo.principalVivo`) se actualiza en cada operación que toca el flag `pagado`:

- `autoMarcarCuotasPagadas` al alta · debe recalcular SIEMPRE el cache · independientemente de si el flag cambió en esa llamada concreta
- `marcarCuotaManual` recalcula correctamente
- Conciliación que termina llamando `marcarCuotaManual` recalcula correctamente

Bug detectado · `autoMarcarCuotasPagadas` (`src/services/prestamosService.ts:649`) tiene `if (!changed) return` que salta la actualización del cache si todos los flags ya estaban en `true` antes de la llamada (caso típico tras `createPrestamo`). **Pendiente fix en T28.1.**

### 5.4 · Si listado o panel muestra cifra rara

Primer reflejo · NO es bug del cálculo · es bug de cache desactualizado. La función pura debe ser source of truth · si el listado lee del cache · validar que el cache se está poblando.

---

## 6 · Imputación fiscal de intereses · separación de verdades

### 6.1 · Dos verdades paralelas · operacional y fiscal

ATLAS mantiene dos perspectivas de los intereses de un préstamo · sin que una contamine la otra.

**Verdad operacional · `prestamo.planPagos[].interes`**
Calculado por la fórmula del cuadro de amortización. Es lo que el banco cobró cada mes. Vive en el plan.

**Verdad fiscal · `properties.interesesFinanciacion[año]`**
Para años declarados · viene del XML AEAT (declaración IRPF presentada). Es lo que se declaró fiscalmente. Vive en el inmueble.

Si difieren · NO es colisión arquitectónica · son perspectivas distintas. La verdad operacional puede tener cuotas extra (comisiones · seguros vinculados al préstamo) que no son intereses. La verdad fiscal puede agrupar varios préstamos del mismo inmueble. Cada una vive en su sitio.

### 6.2 · Cuál usa cada vista

| Vista | Fuente |
|---|---|
| Cuadro de amortización en detalle · interés cuota a cuota | Plan operacional |
| Total de intereses pagados año X (años declarados) | XML AEAT vía `properties.interesesFinanciacion[X]` |
| Total de intereses pagados año X (años NO declarados o sin XML) | Cálculo runtime sobre el plan |
| Intereses deducibles fiscalmente | `interesesTotalDeducible(prestamo, totalAño)` aplica fracción según destinos · sobre cualquiera de las dos fuentes |
| "Intereses deducibles 2026 +1.643 €" en listado | Runtime · `principalVivo × TIN efectivo × fracciónDeducible` · es proxy aproximado |

### 6.3 · `gastosInmueble` y préstamos · NO existe imputación automática

A día de hoy · los intereses de préstamo NO crean registros en `gastosInmueble`. Son cálculos puros runtime.

Si en el futuro se decide imputar automáticamente · es feature nueva (no bugfix) · se redacta como tarea separada · y debe respetar:

- Solo años NO declarados (los declarados ya tienen su verdad fiscal en XML)
- Solo cuotas con `pagado=true`
- Solo la fracción deducible · no el interés bruto
- Trigger · al ejecutarse vía A/B/C de §3.3 · no al alta del préstamo

Por ahora · cero registros en `gastosInmueble` desde Financiación. Decisión cerrada hasta nueva orden.

---

## 7 · Anti-patrones · prohibidos en specs y código futuro

Lista cerrada. Si una propuesta cae en cualquiera · se rechaza sin discusión.

| Anti-patrón | Por qué |
|---|---|
| Crear préstamo desde XML AEAT | §1.4 · decisión cerrada |
| Crear `movements` automáticos al alta del préstamo | §4.3 · duplicaría con importación posterior |
| Crear `treasuryEvents` para cuotas con `fechaCargo < mes actual` | §4.4 · `treasuryEvents` no es vista histórica |
| Confiar en cache de `cuotasPagadas` o `principalVivo` sin función pura derivada | §5.2 · siempre derivar primero · cache es proyección |
| Recalcular cuadro de amortización fuera de `prestamosCalculationService` | §2.4 · única fuente válida |
| Resucitar `historicalTreasuryService` para historial de cuotas | Eliminado intencionalmente · es vista derivada del plan |
| Imputar automáticamente intereses a `gastosInmueble` al alta | §6.3 · feature nueva separada · no automático hoy |
| Modificar plan de un año declarado fiscalmente sin pasar por `CorreccionWizard` | Año declarado es verdad consumida · cambia solo vía paralela formal |
| Asumir que `principalVivo` cacheado es correcto en una vista nueva sin verificar que viene de la función pura | Bug T28.1 actual · no replicar el patrón |
| Generar movements desde el plan al ejecutar `marcarCuotaManual` o conciliación | El movement debe llegar del banco · no inventarse |

---

## 8 · Checklist universal · antes de cualquier spec sobre Financiación

Antes de redactar spec CC que toque Financiación · responder por escrito en el spec:

1. **¿La feature crea préstamos?** · si sí · ¿por cuál de las 4 vías de §1?
2. **¿La feature toca el plan de pagos?** · si sí · ¿usa exclusivamente `prestamosCalculationService.generatePaymentSchedule`?
3. **¿La feature lee KPIs agregados?** · si sí · ¿lee de la función pura derivada · o del cache?
4. **¿La feature actualiza el flag `pagado`?** · si sí · ¿por cuál de las 3 vías de §3.3?
5. **¿La feature crea `movements` o `treasuryEvents`?** · si sí · ¿respeta §4.3 y §4.4?
6. **¿La feature toca `properties.interesesFinanciacion`?** · si sí · ¿solo lee · o intenta sobrescribir? (sobrescribir XML AEAT es regresión)
7. **¿La feature imputa intereses a `gastosInmueble`?** · si sí · es feature nueva · necesita decisión expresa de Jose
8. **¿La feature toca años declarados?** · si sí · solo es válida vía `CorreccionWizard` o lectura
9. **¿La feature cae en algún anti-patrón de §7?**

Si los 9 checks salen verdes · proceder. Si alguno rojo · parar y consultar a Jose.

---

## 9 · Backlog conocido · deuda técnica catalogada

Inventario de problemas detectados en auditoría 2026-05-02 · cada uno asociado a una sub-tarea futura. NO se trabajan aquí · se citan para que cualquier spec futuro sepa qué está abierto.

| Problema | Severidad | Sub-tarea propuesta |
|---|---|---|
| `autoMarcarCuotasPagadas` retorna early sin actualizar cache cuando flags ya estaban en true | Alta · listado y Panel muestran 0 amortizado | T28.1 · bugfix · 30min-1h |
| Componente `CuadroAmortizacion.tsx` con cálculo francés inline simplificado | Media · puede mostrar números inconsistentes | T28.4 · convertir a presentación pura · 1h |
| Hook `useAutoMarcarCuotas` existe pero no se usa en ningún componente | Baja · zombie | T28.4 · eliminar o cablear · decisión Jose |
| Tipo legacy `CuotaPrestamo` en `src/types/loans.ts` no usado | Baja · zombie | T10 limpieza |
| Tab "Movimientos" en detalle préstamo · stub | Media · feature anunciada no entregada | T28.5 separada |
| Tab "Documentos" en detalle préstamo · stub | Media · feature anunciada no entregada | T28.5 separada |
| `LoanSettlementModal.tsx` existe pero conexión incompleta · liquidación parcial/total | Media · feature parcial | T28.6 separada |
| Panel V5 lee `principalVivo` cacheado directamente · uno de los 32 TODOs del Panel | Alta · se arregla con T28.1 al actualizar el cache · pero el Panel debería leer función pura | Cubierto por T28.1 si el bugfix incluye cablear `FinanciacionPage.load()` para datos pre-fix |
| Comisiones (apertura · mantenimiento) en modelo pero no imputadas como deducibles | Baja · feature fiscal pendiente | T28.7 separada · decisión Jose |
| Inconsistencia · 2 lógicas de cálculo francés (servicio + componente legacy) | Media · cubierta por T28.4 |  |

---

## 10 · Decisiones cerradas que este documento consolida

Histórico de decisiones consolidadas aquí · referencia a sesiones previas:

- "El préstamo no se crea desde XML AEAT" · cerrada · vía 3 eliminada en su momento (Jose · 2026-05-02)
- "createPrestamo no genera movements ni treasuryEvents" · auditoría 2026-05-02 confirma comportamiento como correcto · NO bug
- "Matching movement ↔ cuota es bidireccional automático" · sin movements huérfanos prolongados · cubierto por `buscarCandidatosConciliacion` ya existente
- "Plan operacional y verdad fiscal son perspectivas paralelas · no se contaminan" · `prestamo.planPagos[].interes` ≠ `properties.interesesFinanciacion[año]`
- "treasuryEvents solo para mes actual y futuro" · `historicalTreasuryService` eliminado · pre-V60
- "KPIs siempre derivados · cache es proyección de función pura"
- Único calculador de cuadro · `prestamosCalculationService.generatePaymentSchedule` · pre-T7

---

## 11 · Procedimiento si surge un caso no cubierto

Si una nueva propuesta plantea un flujo en Financiación que este documento no recoge · NO improvisar.

Procedimiento:

1. CC (o Claude chat) documenta el caso nuevo en formato de §1 · §3 · §4 (vías de entrada · vías de marcado · matching) o §6 (imputación fiscal)
2. Justifica respetando reglas existentes · cita anti-patrones que evita
3. Plantea a Jose · espera confirmación expresa
4. Solo entonces · este documento se actualiza con el caso nuevo y se procede

Modificaciones a este documento son **mayores** · requieren commit explícito a `docs/ARQUITECTURA-financiacion.md` con justificación en cuerpo del PR.

---

## 12 · Otros módulos con decisiones análogas pendientes

Este documento es **solo Financiación**. Los siguientes módulos tienen reglas análogas pero con sus propias aristas que requieren auditoría y decisión separadas · NO se infieran reglas de aquí a esos módulos:

- **Rentas de alquiler** · documento separado · pendiente · trata XML AEAT histórico · `contracts` · `rentaMensual` · `sin_identificar` · estados fiscales
- **Aportaciones plan de pensiones** · documento separado · pendiente · `aportacionesPlan` · roles aportante · límites fiscales por tipo plan · reconciliación XML
- **Gastos recurrentes inmueble** · documento separado · pendiente · `compromisosRecurrentes` · `gastosInmueble` · OPEX · CAPEX · imputación temporal
- **Gastos personales** · documento separado · pendiente · única excepción documentada al "treasuryEvents = solo presente/futuro" · gastos pasados estimados sin XML

Cada uno de estos módulos tiene vías de entrada propias · colisiones propias · y decisiones cerradas propias. Tratar de unificar todo en un solo documento · como intenté antes · contamina · pierde precisión · y provoca decisiones erróneas por extrapolación.

Estos documentos se redactan por separado cuando llegue el momento de auditar cada módulo.

---

**Fin documento canónico Financiación · v1.0 · 2026-05-02 · referencia obligatoria a partir de aquí para cualquier trabajo en módulo Financiación.**
