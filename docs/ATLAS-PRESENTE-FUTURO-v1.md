# ATLAS · PRESENTE-FUTURO · documento canónico v1

> **Fecha** · 2026-06-07
> **Rango** · VINCULANTE · mismo nivel que `GUIA-DISENO-V5-atlas.md` · toda spec futura DEBE referenciarlo
> **Base** · modelo cerrado con Jose (sesión 07-06-2026) + `AUDIT-pipeline-presente-futuro-2026-06-07.md` (código real · rama main · HEAD e74741b · DB_VERSION 78)
> **Decisión estratégica** · TODO el trabajo se concentra en PRESENTE-FUTURO. El PASADO (backfill · imports retrospectivos · conciliación histórica) queda CONGELADO · ni se arregla ni se amplía · hasta que el presente-futuro funcione sin fisuras. Lo ya mergeado del pasado se queda como está.

---

## 1 · Los tres ejes de la arquitectura

Todo dato de ATLAS tiene tres coordenadas. Toda vista debe saber cuáles pinta.

| Eje | Valores | Codificación real |
|---|---|---|
| **1 · Espacio temporal** | pasado (ocurrido) · presente (año corriendo) · futuro (previsión) | Campos de estado · `treasuryEvents.status` (`predicted`→`executed/confirmed`) · `gastosInmueble.estado` |
| **2 · Estado de declaración** | en_curso · pendiente · declarado (v1·v2 paralela) · prescrito | `ejerciciosFiscalesCoord[año].estado` + `ejercicioResolverService` (puerta única) |
| **3 · Incorporación del cliente** | antes del inicio elegido (no existe) · backfill (importado · CONGELADO) · vida en directo (registrado) | `origen` de cada registro |

Los ejes 1 y 2 NO son lo mismo · 2025 es "pasado" en el eje 1 y "pendiente" en el eje 2.

---

## 2 · El modelo del año 0 · funcionamiento canónico

Cliente llega el 1 de enero · alta de su **foto actual** · vive el año hacia adelante.

### 2.1 · Día 0 · la foto actual · SOLO presente

| Bloque | Contenido | Nota |
|---|---|---|
| Persona | CCAA · estado civil · situación laboral | Configura el motor IRPF |
| Inmuebles | Dirección · RC · modo explotación · **fecha y coste de adquisición + valor catastral construcción** | Coste/fecha de adquisición = ATRIBUTO de la foto del activo (decisión cerrada) · habilita amortización 3% del año en curso |
| Contratos vigentes | Inquilino · renta · fechas · tipo · reducción aplicable | Motor de rentas previstas |
| Préstamos | Cuota · TIN · plazo | Cuotas previstas + intereses deducibles |
| Cuentas | Saldo actual | Hecho presente · no historia |
| Ingresos | Nómina · autónomo | Autónomo = input a la renta (M130/rendimiento) · ATLAS NO gestiona IVA |
| Recurrentes | IBI · comunidad · seguros · suministros | Previsión de gastos |
| Inversiones | Posiciones con **fecha + coste de adquisición** (FIFO) | Sin coste de origen no hay ganancia calculable al vender |

**PROHIBIDO en el día 0** · preguntar por arrastres o amortización acumulada. Son frutos del pasado · los calculará el trabajo del pasado y los inyectará al presente (§2.7). El año 0 calcula su IRPF sin arrastres y es honesto así.

### 2.2 · El bucle del año

```
PREVISTO → llega el extracto o el usuario puntea → CONFIRMADO → ACUMULA en el ejercicio en curso
```

- Cada mes lo previsto se convierte en real · con su desviación.
- Cada factura → gasto del inmueble acumulando para declarar.
- Visible SIEMPRE · caja real vs prevista · IRPF del año acumulándose en vivo · rentabilidad post-impuestos por inmueble.

### 2.3 · Eventos vitales · todos por el mismo carril

| Evento | Cascada |
|---|---|
| Nuevo contrato | Previsiones de renta regeneradas · Disponibilidad actualizada |
| Fin de contrato | Hueco en Disponibilidad · motivo de salida default "fin de contrato" |
| **Venta de inmueble** | Inmueble → vendido (prorrateo del año) · contratos finalizados · previsiones post-venta canceladas · cobro + gastos de venta a tesorería · préstamo liquidado · ganancia/pérdida a base del ahorro del ejercicio en curso · sale de la proyección |
| **Venta de activo financiero** | Posición reduce/cierra · ganancia FIFO a base del ahorro · efectivo a tesorería · pérdidas compensan y arrastran |
| Particularidades España | Traspaso entre fondos NO tributa (diferimiento · conserva coste y antigüedad) · rescate de plan de pensiones = rendimiento del trabajo · NO ganancia |
| Obra/mejora | Mejora amortizable · base de adquisición revisada |
| Nómina confirmada | Aportación automática al plan de pensiones (G-07) |

### 2.4 · Corte 1 enero

- Snapshot inmutable del patrimonio (palanca de T-PROYECCION).
- Ejercicio N pasa de **en_curso → pendiente**. Nace N+1 **en_curso** con sus 12 meses previstos.

### 2.5 · Validación y campaña

- Marzo · Datos Fiscales AEAT = **contraste** de lo acumulado · no construcción.
- Abril-junio · botón pre-declaración compone el ejercicio · bases general (trabajo + autónomo + inmobiliario + atribución) y ahorro (mobiliario + ganancias/pérdidas) · en idioma del cliente.
- Presentar → ejercicio **declarado y congelado** · arrastresOut alimentan el siguiente.
- El objetivo fiscal de ATLAS es ÚNICO · la declaración de la renta. IVA solo como deuda a vigilar en tesorería.

### 2.6 · Las DOS capas de previsión · nunca mezclarlas

| | Capa operativa | Capa patrimonial (T-PROYECCION) |
|---|---|---|
| Horizonte | 12-24 meses | 20 años |
| Grano | Evento a evento · conciliable contra banco | Modelo · anual con motor mensual por categoría |
| Alimentación | Contratos · préstamos · recurrentes | Snapshot 1 enero + estado de TODO + hipótesis (escenarios · sensibilidades · catálogo de eventos · default categoría + override activo) |
| Pregunta que responde | ¿Qué me llega y qué me sale estos meses? | ¿Cuándo alcanzo la libertad financiera y qué IRPF pagaré por el camino? |

El primer año de la proyección coincide con la operativa · de ahí hacia afuera manda el modelo. Cada 1 de enero · plan vs realidad y recalibración. 3 palancas únicas · snapshot 1 enero · capa fiscal proyectada · sugerencias macro.

### 2.7 · El enchufe del pasado

`ejerciciosFiscalesCoord[año].arrastresIn` · definido · vacío (`fuente: 'ninguno'`). Cuando se trabaje el pasado · su entregable será calcular arrastres y amortización acumulada verificados e **inyectarlos** por este enchufe. El presente no sabe cómo se calcularon · solo los recibe.

---

## 3 · Dueño canónico por pieza · paths reales (del audit 07-06-2026)

| Pieza | DUEÑO CANÓNICO | Estado |
|---|---|---|
| Generación de previsiones | `src/modules/horizon/tesoreria/services/treasurySyncService.ts` (motor) + `src/services/treasuryBootstrapService.ts` (orquestador forward-only 24m idempotente) | 🟢 Vivo |
| Confirmación extractos | `src/services/universalBankImporter/` + `bankStatementOrchestrator.ts` + `BankStatementUploadPage.tsx` | 🟢 Vivo |
| Conciliación + punteo | `src/services/treasuryConfirmationService.ts` + `ConciliacionPageV2.tsx` + `TreasuryReconciliationView.tsx` | 🟢 Vivo |
| Estimación IRPF en vivo | `src/services/estimacionFiscalEnCursoService.ts` (T23) · lee treasuryEvents + movements + gastosInmueble + contracts + properties | 🟢 Vivo |
| Venta inmueble | `src/services/propertySaleService.ts` (prepare/confirm/simulate + cascada) + `gananciaPatrimonialService.ts` | 🟢 Vivo |
| Venta activo financiero | `VenderModal.tsx` + `src/services/inversionesFiscalService.ts` (FIFO + arrastres minusvalías) | 🟢 Vivo |
| Nuevo contrato | `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx` | 🟢 Vivo |
| Mejoras | `src/services/mejorasInmuebleService.ts` + `LineasAnualesTab.tsx` | 🟢 Vivo |
| PP automática | `src/services/personal/nominaAportacionHook.ts` (`onNominaConfirmada`) | 🟢 Vivo |
| Pre-declaración | `src/services/preDeclaracionService.ts` + `PreDeclaracionView.tsx` · motor `irpfCalculationService.ts` | 🟢 Vivo |
| Cierre/snapshot | `snapshotDeclaracionService.ts` + UNO de los dos lifecycle (§4.2 · pendiente sentencia) | 🟡 Manual |
| Valoraciones inversiones | `src/services/valoracionesService.ts` (getValorActual/getSerie/getPatrimonioTotal/upsertByDate) | 🟢 Vivo |
| Estados fiscales | `src/services/ejercicioResolverService.ts` · puerta única | 🟢 Vivo |

**Corrección documental obligada** · la cabecera de `treasuryBootstrapService.ts:16-19` dice "contratos FUERA DE SCOPE" pero `generateMonthlyForecasts` SÍ los procesa (sección 3 · `sourceType: 'contrato'`). La cabecera miente · corregir comentario en la primera tarea que toque el fichero.

---

## 4 · DEPRECADOS · sentenciados (no usar en código nuevo)

| # | Deprecado | Sustituto canónico | Acción |
|---|---|---|---|
| 4.1 | `treasuryCreationService.ts` (legacy) y `enhancedTreasuryCreationService.ts` (Inbox) | `treasurySyncService` + `treasuryBootstrapService` | Ninguna spec nueva los usa · migración de consumidores (treasuryApiService · DocumentClassificationPanel · AccountSelectionModal · DocumentCorrectionWorkflow · enhancedAutoSaveService) en tarea propia futura |
| 4.2 | `fiscalLifecycleService.ts` O `fiscalYearLifecycleService.ts` | UNO solo · pendiente auditar cuál está más completo antes de sentenciar | Sentencia en la tarea de rollover (§5.2) |
| 4.3 | `proyeccionMensualService.ts` O `budgetProjection.ts` (dos proyecciones 12m) | UNA sola · sentencia en la tarea del motor patrimonial (§5.3) | Idem |
| 4.4 | `createObjectStore` repetidos en db.ts (escenarios · planesPensiones · aportacionesPlan · traspasosPlanPensiones) | Presumible fresh-vs-migración · benigno | Solo verificar y documentar · sin refactor |

**Hallazgo lateral registrado** · `getCurrentSaldoCuenta.ts:2-6` documenta que `openingBalance` "está mal" · entra en el alcance del hueco día 0 (§5.1).

---

## 5 · HUECOS · lo único que falta construir del presente-futuro

| # | Hueco | Qué es |
|---|---|---|
| 5.1 | **Onboarding día 0** | Alta guiada de la foto actual (§2.1) · hoy solo existen altas sueltas por módulo · incluye arreglar `openingBalance` |
| 5.2 | **Rollover 1 enero** | Corte automático · snapshot + en_curso→pendiente + nace año nuevo previsto · hoy el cierre es manual · incluye sentencia 4.2 |
| 5.3 | **Motor patrimonial 20 años** | T-PROYECCION (diseño Q1-Q10 cerrado) · hoy solo 12m operativa ×2 + libertadService capado · incluye sentencia 4.3 |

Orden de ataque · lo decide Jose tarea a tarea · workflow mockup-first → spec → CC → stop-and-wait.

---

## 6 · Regla obligatoria para TODA spec futura

Toda spec a CC incluye una sección **"Declaración de ejes"** ·

> Por cada vista/servicio tocado · qué espacio(s) temporal(es) pinta · qué estado(s) de declaración respeta · de qué store lee CADA coordenada · y si mezcla fuentes · decirlo explícitamente.

Sin esa sección · la spec no se lanza. Prohibido leer `treasuryEvents` para datos del pasado declarado (eso vive en stores fuente). Prohibido usar deprecados de §4 en código nuevo.

---

**Fin v1 · subir a `docs/ATLAS-PRESENTE-FUTURO-v1.md` · referencia obligatoria junto a GUIA-DISENO-V5.**
