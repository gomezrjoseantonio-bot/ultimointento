# AUDITORÍA · Los 46 stores frente al motor de matcheo del fichero

**Fecha:** 2026-08-30 · **Base:** `main` @ `55b39e491` · **DB_VERSION:** 90 · **Solo lectura.**

---

## 0 · El hallazgo, antes que el inventario

Toda la cadena que procesa un extracto —emparejar, sugerir, aprender, orquestar— lee
**7 stores de los 46**:

| fichero | stores que toca |
|---|---|
| `movementMatchingService.ts` | `movements`, `treasuryEvents` |
| `movementSuggestionService.ts` | `movements`, `compromisosRecurrentes`, `contracts`, `movementLearningRules` |
| `movementLearningService.ts` | `movementLearningRules` |
| `bankStatementOrchestrator.ts` | `movements`, `treasuryEvents`, `accounts`, `importBatches` |

**39 stores no existen para el matcheo.** Entre ellos, y por orden de daño:

| store | lo que contiene y no se mira |
|---|---|
| `prestamos` | **185 rutas de campo**, incluido `planPagos.periodos[]` con `fechaCargo` + `cuota` + `interes` + `amortizacion` por periodo. Un calendario determinista completo |
| `property_sales` | la venta con `saleDate`, `salePrice`, `loanSettlement.payoffAmount` y `loanSettlement.cancellationFee` — el caso que citas |
| `inversiones` | los pagos de rendimiento ya generados, con bruto/retención/neto |
| `proveedores` | el catálogo por NIF · **nunca se ha leído desde el matcheo** |
| `tarjetas` | qué tarjeta liquida en qué cuenta y qué día |
| `properties` | alias, dirección, referencia catastral del inmueble |
| `gastosInmueble` | 3.504 filas de gasto ya registrado — para no duplicar |
| `vinculosAccesorio` | qué trastero/garaje cuelga de qué piso |

La regla que pones —«el % solo puede bajar por dato que NO existe»— hoy se incumple
por arquitectura, no por casos sueltos: el motor **no tiene acceso** a casi ningún store.

### Lo segundo: el marcador no puede con lo que sí ve

Documentado en `AUDIT-extracto-cuadre-y-corte-por-fecha-2026-08-29.md` y sigue vigente.
Aunque conectáramos los 39 stores, el marcador tiene techo 55–60 puntos contra umbral 70
para un recibo de importe variable. **Conectar datos sin tocar el marcador no sube el
acierto.** Van juntos.

---

## 1 · Alcance · qué he podido determinar y qué no

**Determinado contra el código real** (no contra documentación):
esquema completo con rutas anidadas, keyPath, índices, escritores y lectores de los 46
stores, y las seis preguntas de matcheo. El aplanado es mecánico (2.078 rutas de campo),
no transcrito a mano.

**NO determinado · y lo que falta para determinarlo:**

| lo que pides | por qué no puedo | qué haría falta |
|---|---|---|
| «cuántos registros tiene hoy» | Los datos viven en el IndexedDB de **tu navegador**. No hay snapshot en el repo ni acceso remoto | Ejecutar la sonda del anexo A y pegarme su salida |
| «ejemplo real de 1 registro» | Igual | Igual |

Uso los recuentos que das en el encargo (45 compromisos, 10 préstamos, 3.504 gastos…)
**atribuidos a ti**, no medidos por mí. Los marco `[tu dato]`.

### Un aviso sobre el método, porque me pasó a mí

Al montar el extractor cogí `Prestamo` de `src/types/loans.ts` en vez de
`src/types/prestamos.ts` —hay **dos tipos con el mismo nombre**— y llegué a escribir que
`planPagos.periodos[]` no existía. Existe, y es exactamente donde dices.

Es el fallo que esta auditoría persigue, cometido dentro de la propia auditoría. El
extractor quedó anclado a los ficheros que importa `db.ts`, y por eso los esquemas de
abajo son fiables. **Cualquiera que busque un campo por nombre en este repo se llevará el
mismo golpe**: es un riesgo del código, no un descuido puntual.


---

## 2 · Inventario · los 46 stores

Orden: primero los que deciden el matcheo, después el resto. Los 46 están.
Las rutas con `[]` son elementos de array: `planPagos.periodos[].cuota` es un campo.

## 2.1 · Los que el motor YA mira (7)


### `compromisosRecurrentes`

**keyPath:** `id` (autoIncrement) · **índices:** ambito · categoria · cuentaCargo · estado · fechaInicio · inmuebleId · personalDataId · tipo · **registros:** 45 `[tu dato]`

El catálogo de lo que se repite. Es el store con MÁS señal de identificación de la base, y el motor usa una parte pequeña.

**Esquema · 50 rutas de campo (anidados incluidos)**

```
id? : number
ambito : 'personal' | 'inmueble'
inmuebleId? : number
personalDataId? : number
alias : string
tipo : TipoCompromiso
subtipo? : string
proveedor : { nombre: string; nif?: string; referencia?: string; // legacy · CUPS/póliza/cliente mezcl
  proveedor.nombre : string
  proveedor.nif? : string
  proveedor.referencia? : string
cups? : string
numeroContrato? : string
patron : PatronRecurrente
  patron.tipo : 'mensualDiaFijo'
  patron.dia : number
diaCargoIncierto? : boolean
margenGraciaDias? : number
familiaFiscalManual? : FamiliaFiscal
importe : ImporteEvento
  importe.modo : 'fijo'
  importe.importe : number
variacion? : PatronVariacion
  variacion.tipo : 'sinVariacion'
cuentaCargo : number
conceptoBancario : string
metodoPago : MetodoPagoCompromiso
tarjetaId? : number
concepto? : string
categoria : string
esViviendaHabitual? : boolean
bolsaPresupuesto : BolsaPresupuesto
tipoFamilia? : string
responsable : ResponsableCompromiso
porcentajeTitular? : number
reparto? : RepartoInmueble[]
  reparto[].inmuebleId : number
  reparto[].porcentaje? : number
  reparto[].importe? : number
fechaInicio : string
fechaFin? : string
estado : EstadoCompromiso
motivoBaja? : MotivoBaja
derivadoDe? : OrigenCompromiso
  derivadoDe.fuente : 'viviendaHabitual' | 'manual' | 'importeCSV' | 'opexRule'
  derivadoDe.refId? : string | number
  derivadoDe.bloqueado? : boolean
createdAt : string
updatedAt : string
notas? : string
```

**Escriben:** `src/services/migrations/cleanupCategoriasT34T35fix2.ts:114`, `src/services/migrations/v68-tipoFamilia.ts:301`

**Leen:** `src/modules/mi-plan/services/budgetProjection.ts:245`, `src/modules/panel/PanelPage.tsx:194`, `src/modules/personal/PersonalPage.tsx:61`, `src/services/__buscarApunteAudit.ts:238`, `src/services/__buscarApunteAudit.ts:358`, `src/services/__buscarApunteAudit.ts:502`, `src/services/altaMovimientoService.ts:572`, `src/services/bonificaciones/movimientosQuePrueban.ts:61`, `src/services/compromisoDetectionService.ts:795`, `src/services/conceptos/conceptosUsuarioService.ts:187`, `src/services/db/post-open.ts:390`, `src/services/db/post-open.ts:436`

| | |
|---|---|
| **A · identificar línea** | Sí, el mejor. `conceptoBancario` es literalmente *«texto que aparece en extracto»* y es OBLIGATORIO. Además `proveedor.nombre`, `proveedor.nif`, `cups`, `numeroContrato`, `importe.importe`, `patron.dia`, `cuentaCargo`. **El marcador lee `providerName ?? counterparty`: con proveedor relleno NUNCA consulta `conceptoBancario`.** `cups` y `numeroContrato` ni se copian al `TreasuryEvent`. |
| **B · atribuir inmueble** | Sí · `inmuebleId` directo, y `reparto[].inmuebleId` + `reparto[].porcentaje` cuando un recibo se parte entre varios pisos. Fiabilidad alta: lo declaró el usuario. **`reparto[]` no lo mira nadie al cuadrar.** |
| **C · atribuir ámbito** | Sí · `ambito`, `esViviendaHabitual`, `bolsaPresupuesto`, `categoria`, `familiaFiscalManual`. |
| **D · calendario esperado** | Derivable · `patron` + `importe` + `fechaInicio`/`fechaFin` generan el calendario (`generarEventosDesdeCompromiso`). Materializado no está aquí: vive en `treasuryEvents`. |
| **E · extraordinarios** | No · un compromiso es lo ordinario por definición. |
| **F · campo vacío/ausente** | `margenGraciaDias` existe, comentado como *«tolerancia al cuadrar el cargo real contra la fecha prevista»*, y **el conciliador usa una constante fija de 5 días: no lo lee jamás** (solo lo leen los contratos). `diaCargoIncierto` tampoco se usa al cuadrar. |

### `prestamos`

**keyPath:** `id` (uuid string) · **índices:** createdAt · inmuebleId · tipo · **registros:** 10 `[tu dato]`

**El store con más señal desaprovechada.** 185 rutas y un calendario de cuotas con fecha e importe exactos. El matcheo no lo abre nunca.

**Esquema · 185 rutas de campo (anidados incluidos)**

```
id : string
ambito : 'PERSONAL' | 'INMUEBLE'
destinos? : DestinoCapital[]
  destinos[].id : string
  destinos[].tipo : 'ADQUISICION' // comprar un inmueble
  destinos[].inmuebleId? : string
  destinos[].inversionId? : string
  destinos[].prestamoIdCancelado? : string
  destinos[].importe : number
  destinos[].porcentaje? : number
  destinos[].descripcion? : string
garantias? : Garantia[]
  garantias[].tipo : 'HIPOTECARIA' // un inmueble responde
  garantias[].inmuebleId? : string
  garantias[].inversionId? : string
  garantias[].descripcion? : string
inmuebleId? : string
afectacionesInmueble? : AfectacionInmueblePrestamo[]
  afectacionesInmueble[].inmuebleId : string
  afectacionesInmueble[].porcentaje : number
  afectacionesInmueble[].tipoRelacion? : 'GARANTIA' | 'DESTINO_CAPITAL' | 'MIXTA'
finalidad? : 'ADQUISICION' | 'REFORMA' | 'INVERSION' | 'PERSONAL' | 'OTRA'
nombre : string
principalInicial : number
principalVivo : number
fechaFirma : string
fechaPrimerCargo : string
plazoMesesTotal : number
diaCargoMes : number
esquemaPrimerRecibo : 'NORMAL' | 'SOLO_INTERESES' | 'PRORRATA'
tipo : 'FIJO' | 'VARIABLE' | 'MIXTO'
sistema : 'FRANCES'
baseCalculoIntereses? : BaseCalculoIntereses
baseDiasSueltos? : BaseCalculoIntereses
diasSueltosDelArranque? : DiasSueltosDelArranque
tipoNominalAnualFijo? : number
indice? : 'EURIBOR' | 'OTRO'
valorIndiceActual? : number
diferencial? : number
indiceDesfaseMeses? : number
periodoRevisionMeses? : number
fechaProximaRevision? : string
revisionesDeTipo? : RevisionDelIndice[]
  revisionesDeTipo[].desde : string
  revisionesDeTipo[].valorIndice : number
tramoFijoMeses? : number
tipoNominalAnualMixtoFijo? : number
carencia : 'NINGUNA' | 'CAPITAL' | 'TOTAL'
carenciaMeses? : number
diferirPrimeraCuotaMeses? : number
prorratearPrimerPeriodo? : boolean
cobroMesVencido? : boolean
cuentaCargoId : string
comisionApertura? : number
comisionMantenimiento? : number
tasacion? : number
segurosVinculados? : SeguroVinculado[]
  segurosVinculados[].concepto : string
  segurosVinculados[].primaAnual : number
  segurosVinculados[].exigidoParaElTipo? : boolean
  segurosVinculados[].naturaleza : NaturalezaFiscal
comisionAmortizacionAnticipada? : number
comisionCancelacionTotal? : number
comisionReembolsoParcial? : ComisionPactada
  comisionReembolsoParcial.tramos : TramoDeComision[]
    comisionReembolsoParcial.tramos[].hastaMes? : number
    comisionReembolsoParcial.tramos[].porcentaje : number
  comisionReembolsoParcial.origen : OrigenDeLaComision
comisionReembolsoTotal? : ComisionPactada
  comisionReembolsoTotal.tramos : TramoDeComision[]
    comisionReembolsoTotal.tramos[].hastaMes? : number
    comisionReembolsoTotal.tramos[].porcentaje : number
  comisionReembolsoTotal.origen : OrigenDeLaComision
gastosFijosOperacion? : number
bonificaciones? : Bonificacion[]
  bonificaciones[].id : string
  bonificaciones[].tipo : 'NOMINA'|'RECIBOS'|'SEGURO_HOGAR'|'SEGURO_VIDA'|'TARJETA'|'PENSIONES'|'FONDOS'|'CERTIFICAD
  bonificaciones[].nombre : string
  bonificaciones[].orden? : number
  bonificaciones[].sublimitePP? : number
  bonificaciones[].rebajaPorTramos? : TramoDeRebaja[]
    bonificaciones[].rebajaPorTramos[].desde : number
    bonificaciones[].rebajaPorTramos[].pp : number
  bonificaciones[].reduccionPuntosPorcentuales : number
  bonificaciones[].impacto : { puntos: number }
    bonificaciones[].impacto.puntos : number
  bonificaciones[].lookbackMeses : number
  bonificaciones[].regla : ReglaBonificacion
    bonificaciones[].regla.tipo : 'NOMINA'
    bonificaciones[].regla.minimoMensual : number
    bonificaciones[].regla.minimoAnualRecurrente? : number
  bonificaciones[].costeAnualEstimado? : number
  bonificaciones[].cuentaExigidaId? : string
  bonificaciones[].tarjetaExigidaId? : number
  bonificaciones[].seleccionado? : boolean
  bonificaciones[].estado : 'INACTIVO'|'SELECCIONADO'|'ACTIVO_POR_GRACIA'|'ACTIVO_POR_CUMPLIMIENTO'|'PENDIENTE'|'EN_RI
  bonificaciones[].progreso? : { descripcion: string; // "Llevas 2/4 meses de nómina ≥ 1.200€" faltante?: string; // "Fal
    bonificaciones[].progreso.descripcion : string
    bonificaciones[].progreso.faltante? : string
maximoBonificacionPorcentaje? : number
modoBonificaciones? : ModoBonificaciones
periodoRevisionBonificacionMeses? : number
proximaRevisionBonificaciones? : string
ultimaRevisionBonificacionesConfirmada? : string
graciaMesesBonificaciones? : number
bonificacionesDesde? : 'FIRMA' | 'TRAMO_VARIABLE'
fechaFinMaximaBonificacion? : string
topeBonificacionesTotal? : number
tinMin? : number
diferencialMin? : number
fechaFinPeriodo? : string
fechaEvaluacion? : string
offsetEvaluacionDias? : number
cuotasPagadas : number
fechaUltimaCuotaPagada? : string
estado? : 'vivo' | 'cancelado' | 'pendiente_cancelacion_venta' | 'pendiente_completar'
fechaCancelacion? : string
cancelacionPendienteVenta? : boolean
fechaSolicitudCancelacionVenta? : string
interesesAnualesDeclarados? : Record<number
tipoPrestamoV2? : 'hipotecario' | 'personal' | 'linea_credito' | 'otro'
banco? : string
numeroContrato? : string
interesDemoraPct? : number
comisionModificacionCondiciones? : number
gastoReclamacionImpago? : number
carenciaTecnica? : { dias: number; fechaLiquidacion: string; // ISO date intereses: number; // € } | null
  carenciaTecnica.dias : number
  carenciaTecnica.fechaLiquidacion : string
  carenciaTecnica.intereses : number
origenCreacion : 'MANUAL' | 'FEIN' | 'IMPORTACION'
cuotasPagadasAlImportar? : number
capitalVivoAlImportar? : number
documentoFEIN? : string
liquidacion? : unknown | null
planPagos? : PlanPagos
  planPagos.prestamoId : string
  planPagos.fechaGeneracion : string
  planPagos.periodos : PeriodoPago[]
    planPagos.periodos[].periodo : number
    planPagos.periodos[].devengoDesde : string
    planPagos.periodos[].devengoHasta : string
    planPagos.periodos[].fechaCargo : string
    planPagos.periodos[].cuota : number
    planPagos.periodos[].interes : number
    planPagos.periodos[].amortizacion : number
    planPagos.periodos[].principalFinal : number
    planPagos.periodos[].esProrrateado? : boolean
    planPagos.periodos[].esSoloIntereses? : boolean
    planPagos.periodos[].diasDevengo? : number
    planPagos.periodos[].pagado : boolean
    planPagos.periodos[].fechaPagoReal? : string
    planPagos.periodos[].movimientoTesoreriaId? : string
    planPagos.periodos[].esAdelantoDeCapital? : boolean
  planPagos.resumen : { totalIntereses: number; totalCuotas: number; fechaFinalizacion: string; }
    planPagos.resumen.totalIntereses : number
    planPagos.resumen.totalCuotas : number
    planPagos.resumen.fechaFinalizacion : string
  planPagos.metadata? : { source?: 'generated' | 'property_sale' | 'loan_settlement' | 'wizard_v2_generated'; oper
    planPagos.metadata.source? : 'generated' | 'property_sale' | 'loan_settlement' | 'wizard_v2_generated'
    planPagos.metadata.operationType? : 'TOTAL' | 'PARTIAL'
    planPagos.metadata.operationDate? : string
    planPagos.metadata.partialMode? : 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'
planDeAmortizaciones? : PlanDeAmortizaciones
  planDeAmortizaciones.reglas : ReglaDeAdelanto[]
    planDeAmortizaciones.reglas[].id : string
    planDeAmortizaciones.reglas[].cadencia : Cadencia
    planDeAmortizaciones.reglas[].importe : number
    planDeAmortizaciones.reglas[].desde : string
    planDeAmortizaciones.reglas[].hasta? : string
    planDeAmortizaciones.reglas[].veces? : number
    planDeAmortizaciones.reglas[].cadaMeses? : number
    planDeAmortizaciones.reglas[].mes? : number
    planDeAmortizaciones.reglas[].crecimientoAnual? : number
  planDeAmortizaciones.modo : 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'
  planDeAmortizaciones.limiteAnualExento? : LimiteAnualExento | null
    planDeAmortizaciones.limiteAnualExento.base : 'ANIO_NATURAL' | 'ANUALIDAD'
    planDeAmortizaciones.limiteAnualExento.importe? : number
    planDeAmortizaciones.limiteAnualExento.porcentajeDelCapitalInicial? : number
  planDeAmortizaciones.gastosFijosPorOperacion? : number
  planDeAmortizaciones.generaPrevisiones : boolean
  planDeAmortizaciones.actualizadoEn : string
activo : boolean
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/migrations/migrateFinanciacionV2.ts:108`, `src/services/migrations/migrateKeyvalPlanpagosToPrestamos.ts:176`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:347`, `src/services/prestamosService.ts:311`, `src/services/prestamosService.ts:323`, `src/services/prestamosService.ts:700`, `src/services/treasuryConfirmationService.ts:561`, `src/services/treasuryConfirmationService.ts:761`

**Leen:** `src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx:165`, `src/modules/panel/PanelPage.tsx:187`, `src/services/db/post-open.ts:498`, `src/services/declaracionOnboardingService.ts:1329`, `src/services/fiscalCacheService.ts:81`, `src/services/loanSettlementService.ts:683`, `src/services/loanSettlementService.ts:701`, `src/services/migrations/migrateFinanciacionV2.ts:45`, `src/services/migrations/migrateKeyvalPlanpagosToPrestamos.ts:74`, `src/services/migrations/migrateKeyvalPlanpagosToPrestamos.ts:84`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:341`, `src/services/objetivosService.ts:41`

| | |
|---|---|
| **A · identificar línea** | Sí, y determinista: `planPagos.periodos[].fechaCargo` + `planPagos.periodos[].cuota` dan fecha e importe exactos de cada recibo. Más `entidad`, la cuenta de cargo y el número de contrato. Un cargo que coincide con un periodo es match seguro, no heurístico. |
| **B · atribuir inmueble** | Sí · `inmuebleId`, y `destinos[].inmuebleId` con `destinos[].tipo` (ADQUISICION/REFORMA/…) cuando financia varios. **`destinos[]` no lo mira nadie.** |
| **C · atribuir ámbito** | Sí · `ambito` PERSONAL/INMUEBLE. |
| **D · calendario esperado** | **SÍ · el mejor de la base.** `planPagos.periodos[]` con `periodo`, `devengoDesde`, `devengoHasta`, `fechaCargo`, `cuota`, `interes`, `amortizacion`, `principalFinal`, `pagado`, `fechaPagoReal`. El fichero solo tendría que confirmar. Hoy el matcheo llega de rebote, vía los `treasuryEvents` que alguien generó, y solo si se generaron. |
| **E · extraordinarios** | Sí · `planDeAmortizaciones` (amortización anticipada), `liquidacion` (cancelación), `comisionAmortizacionAnticipada`. Con esto una cancelación deja de caer en «revisar». |
| **F · campo vacío/ausente** | Si el préstamo se dio de alta sin generar `planPagos`, el calendario no existe. **Distinguir «no hay campo» de «campo vacío» exige mirar tus 10 préstamos** · sonda del anexo A. |

### `contracts`

**keyPath:** `id` (autoIncrement) · **índices:** propertyId · **registros:** 1 `[tu dato]`

El contrato de alquiler. Lo lee `movementSuggestionService`, pero solo lo básico.

**Esquema · 126 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
unidadTipo : 'vivienda' | 'habitacion'
habitacionId? : string
modalidad : SubtipoAlquiler
inquilino : { nombre: string; apellidos: string; dni: string; telefono: string; email: string; /** * V
  inquilino.nombre : string
  inquilino.apellidos : string
  inquilino.dni : string
  inquilino.telefono : string
  inquilino.email : string
  inquilino.cotitulares? : string[]
fechaInicio : string
fechaFin : string
primerCobro? : PrimerCobroContrato
  primerCobro.modo : ModoPrimerCobro
  primerCobro.importe : number
rentaMensual : number
diaPago : number
margenGraciaDias : number
indexacion : 'none' | 'ipc' | 'irav' | 'otros'
indexOtros? : { formula: string; // Formula or percentage for 'otros' frecuencia: string; // Frequency (
  indexOtros.formula : string
  indexOtros.frecuencia : string
  indexOtros.nota? : string
historicoIndexaciones : Array<{ fecha: string; // Date when indexation was applied indice: string; // Index used (
  historicoIndexaciones[].fecha : string
  historicoIndexaciones[].indice : string
  historicoIndexaciones[].porcentajeAplicado : number
  historicoIndexaciones[].rentaResultante : number
historicoRentas? : HistoricoRenta[]
  historicoRentas[].fechaDesde : string
  historicoRentas[].importe : number
  historicoRentas[].origen : 'firma_inicial' | 'indexacion' | 'renegociacion' | 'manual'
  historicoRentas[].nota? : string
  historicoRentas[].indexacionFecha? : string
fianzaMeses : number
fianzaImporte : number
fianzaEstado : 'retenida' | 'devuelta_parcial' | 'devuelta_total'
fechasFianza? : { cobro?: string; // Date when deposit was collected devolucion?: string; // Date when dep
  fechasFianza.cobro? : string
  fechasFianza.devolucion? : string
cuentaCobroId : number
estadoContrato : 'activo' | 'rescindido' | 'finalizado' | 'sin_identificar' | 'sin_firmar'
origenImportacion? : 'rentila' | 'plantilla_atlas'
   … (81 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/alquileresV3FixService.ts:121`, `src/services/alquileresV3FixService.ts:165`, `src/services/contractService.ts:142`, `src/services/contractService.ts:199`, `src/services/contractService.ts:233`, `src/services/documentIngestionService.ts:334`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:330`

**Leen:** `src/modules/fiscal/v2/helpers/amortizacionAcumuladaService.ts:114`, `src/modules/horizon/herramientas/exporters/atlasExportService.ts:529`, `src/modules/horizon/herramientas/exporters/atlasExportService.ts:78`, `src/modules/inmuebles/InmueblesPage.tsx:24`, `src/modules/mi-plan/services/budgetProjection.ts:246`, `src/modules/onboarding/empezar/FirstRunRedirect.tsx:41`, `src/modules/panel/PanelPage.tsx:193`, `src/pages/GestionInmuebles/VentaWizard.tsx:76`, `src/services/aeatAmortizationService.ts:329`, `src/services/alquileresV3FixService.ts:103`, `src/services/alquileresV3FixService.ts:151`, `src/services/boteAnualService.ts:240`

| | |
|---|---|
| **A · identificar línea** | Sí · nombre del inquilino, importe de renta, día de cobro y `margenGraciaDias` (aquí SÍ se usa · `estadoCobroContratoService.ts:97`). |
| **B · atribuir inmueble** | Sí · `propertyId`. Fiabilidad total. |
| **C · atribuir ámbito** | Sí · un cobro de contrato es renta de inmueble. |
| **D · calendario esperado** | Derivable · renta + día de pago. |
| **E · extraordinarios** | Sí · fianza, actualizaciones de renta, fin de contrato. |
| **F · campo vacío/ausente** | La devolución de fianza no tiene campo propio («devuelta el día X por importe Y»), así que ese movimiento cae en «revisar». |

### `movementLearningRules`

**keyPath:** `id` (autoIncrement) · **índices:** ambito · appliedCount · categoria · createdAt · learnKey (único) · **registros:** 12 `[tu dato]`

Lo que ATLAS aprende de tus confirmaciones. El único store que mejora solo.

**Esquema · 15 rutas de campo (anidados incluidos)**

```
id? : number
learnKey : string
counterpartyPattern : string
descriptionPattern : string
amountSign : 'positive' | 'negative'
categoria : string
ambito : 'PERSONAL' | 'INMUEBLE'
inmuebleId? : string
source : 'IMPLICIT'
createdAt : string
updatedAt : string
appliedCount : number
lastAppliedAt? : string
aliasContraparte? : string
contraparteCanonica? : string
```

**Escriben:** `src/services/movementLearningService.ts:294`, `src/services/movementLearningService.ts:316`, `src/services/movementLearningService.ts:390`, `src/services/movementLearningService.ts:444`

**Leen:** `src/services/movementLearningService.ts:195`, `src/services/movementLearningService.ts:261`, `src/services/movementLearningService.ts:342`, `src/services/movementLearningService.ts:434`, `src/services/movementSuggestionService.ts:238`

| | |
|---|---|
| **A · identificar línea** | Sí · `learnKey` (huella del texto del banco) → categoría, y desde V85 `aliasContraparte`/`contraparteCanonica`: qué nombre del banco es qué persona. Resuelve lo que ninguna heurística alcanza. |
| **B · atribuir inmueble** | Parcial · solo si la regla guardó inmueble. |
| **C · atribuir ámbito** | Sí · `ambito`. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Con 12 reglas el aprendizaje está sin arrancar. No falta el campo: falta volumen, y el volumen sale de confirmar líneas — justo lo que el corte por fecha impide. |

### `accounts`

**keyPath:** `id` (autoIncrement) · **índices:** bank · destination · isActive · **registros:** 11 `[tu dato]`

Las cuentas. El import las usa para saber dónde mete el fichero y para la frontera de apertura.

**Esquema · 51 rutas de campo (anidados incluidos)**

```
id? : number
alias? : string
iban : string
ibanMasked? : string
banco? : { code?: string; // código entidad (4 dígitos IBAN ES, posiciones 5–8) name?: string; // n
  banco.code? : string
  banco.name? : string
  banco.brand? : { logoUrl?: string; color?: string; } // logo/color corporativo si disponible
    banco.brand.logoUrl? : string
    banco.brand.color? : string
logoUser? : string
tipo? : 'CORRIENTE' | 'EFECTIVO'
moneda? : 'EUR'
titular? : { nombre?: string; nif?: string; }
  titular.nombre? : string
  titular.nif? : string
status : AccountStatus
deactivatedAt? : string
activa : boolean
isDefault? : boolean
createdAt : string
updatedAt : string
name? : string
bank? : string
destination? : AccountDestination
balance? : number
openingBalance? : number
openingBalanceDate? : string
includeInConsolidated? : boolean
currency? : string
isActive? : boolean
deleted_at? : string
minimumBalance? : number
isAtRisk? : boolean
usage_scope? : AccountUsageScope
logo_url? : string
esRemunerada? : boolean
remuneracion? : { tinAnual: number; frecuenciaPagos: 'mensual' | 'trimestral' | 'semestral' | 'anual'; bas
  remuneracion.tinAnual : number
  remuneracion.frecuenciaPagos : 'mensual' | 'trimestral' | 'semestral' | 'anual'
  remuneracion.base : 'saldo' | 'fijo'
  remuneracion.importeFijo? : number
  remuneracion.retencionFiscal : number
  remuneracion.fechaInicio : string
colorPunto? : string
bizum? : boolean
bic? : string
taeAnual? : number
frecuenciaLiquidacion? : 'mensual' | 'trimestral' | 'semestral' | 'anual'
cuentaDestinoIntereses? : number
ultimosCuatro? : string
```

**Escriben:** `src/services/accountBalanceService.ts:182`, `src/services/cuentasService.ts:222`, `src/services/cuentasService.ts:233`, `src/services/cuentasService.ts:745`, `src/services/cuentasService.ts:932`, `src/services/demoDataCleanupService.ts:189`, `src/services/migrations/v88-borrarCuentasDeTarjeta.ts:187`, `src/services/treasuryApiService.ts:129`, `src/services/treasuryApiService.ts:177`, `src/services/treasuryApiService.ts:232`, `src/services/treasuryApiService.ts:318`, `src/services/treasuryApiService.ts:412`

**Leen:** `src/components/inmuebles/OpexRuleForm.tsx:87`, `src/modules/financiacion/wizards/PrestamoPageV2.tsx:790`, `src/modules/horizon/financiacion/components/LoanSettlementModal.tsx:64`, `src/modules/horizon/herramientas/exporters/atlasExportService.ts:499`, `src/modules/horizon/herramientas/exporters/atlasExportService.ts:531`, `src/modules/horizon/herramientas/exporters/atlasExportService.ts:600`, `src/modules/horizon/herramientas/exporters/atlasExportService.ts:670`, `src/modules/horizon/informes/generators/generateTesoreria.ts:26`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:270`, `src/modules/mi-plan/services/presupuestoAnualService.ts:568`, `src/modules/mi-plan/services/presupuestoAnualService.ts:593`, `src/modules/onboarding/empezar/FirstRunRedirect.tsx:40`

| | |
|---|---|
| **A · identificar línea** | Sí · `iban` identifica la cuenta destino (`detectarCuenta`) y `banco.name` da el perfil de banco. **`openingBalanceDate` es además la frontera que impide previsiones anteriores a la apertura** (#1824). |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Sí · el saldo inicial explica el primer apunte de una cuenta recién dada de alta. |
| **F · campo vacío/ausente** | Ninguno relevante para el matcheo. |

### `movements`

**keyPath:** `id` (autoIncrement) · **índices:** accountId · date · duplicate-key · importBatch · status · **registros:** —

La realidad bancaria. Es el LADO IZQUIERDO del matcheo: lo que hay que clasificar.

**Esquema · 73 rutas de campo (anidados incluidos)**

```
id? : number
accountId : number
date : string
valueDate? : string
amount : number
description : string
descripcionPrevision? : string
counterparty? : string
providerName? : string
providerNif? : string
invoiceNumber? : string
paymentMethod? : MetodoDePago
reference? : string
status : MovementStatus
bank_ref? : string
iban_detected? : string
unifiedStatus : UnifiedMovementStatus
source : MovementSource
plan_match_id? : string
property_id? : string
category : { // hierarchical category tipo: string; // e.g., "Suministros" subtipo?: string; // e.g.,
  category.tipo : string
  category.subtipo? : string
is_transfer? : boolean
transfer_group_id? : string
invoice_id? : string
state? : TransactionState
sourceBank? : string
currency? : string
balance? : number
saldo? : number
id_import? : string
linked_registro? : { type: 'ingreso' | 'gasto' | 'mejora'; id: number; }
  linked_registro.type : 'ingreso' | 'gasto' | 'mejora'
  linked_registro.id : number
expenseIds? : number[]
documentIds? : number[]
reconciliationNotes? : string
importBatch? : string
csvRowIndex? : number
type : MovementType
origin : MovementOrigin
movementState : MovementState
tags? : string[]
transferGroupId? : string
attachedDocumentId? : number
appliedRuleId? : number
isAutoTagged? : boolean
lastModifiedBy? : string
changeReason? : 'user_ok' | 'inline_edit_amount' | 'inline_edit_date' | 'bulk_ok' | 'manual_edit'
categoria? : string
ambito : 'PERSONAL' | 'INMUEBLE'
inmuebleId? : string
inmuebleAlias? : string
tarjetaId? : number
gastoTarjetaCredito? : boolean
statusConciliacion : 'sin_match' | 'match_automatico' | 'match_manual'
learnKey? : string
isOpeningBalance? : boolean
facturaId? : number
facturaNoAplica? : boolean
justificanteId? : number
justificanteNoAplica? : boolean
categoryKey? : string
subtypeKey? : string
conceptoId? : string
transferMetadata? : { targetAccountId: number; pairEventId?: number; /** * La OTRA pata, cuando el traspaso se
  transferMetadata.targetAccountId : number
  transferMetadata.pairEventId? : number
  transferMetadata.pairMovementId? : number
  transferMetadata.esAmortizacionParcial? : boolean
createdAt : string
updatedAt : string
```

**Escriben:** `src/modules/inversiones/pages/FichaPlanPensiones.tsx:852`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:439`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:955`, `src/services/altaMovimientoService.ts:187`, `src/services/altaMovimientoService.ts:224`, `src/services/altaMovimientoService.ts:337`, `src/services/altaMovimientoService.ts:366`, `src/services/altaMovimientoService.ts:458`, `src/services/bankStatementOrchestrator.ts:366`, `src/services/bankStatementOrchestrator.ts:430`, `src/services/bankStatementOrchestrator.ts:445`, `src/services/bankStatementOrchestrator.ts:624`

**Leen:** `src/modules/horizon/herramientas/exporters/atlasExportService.ts:669`, `src/modules/horizon/informes/generators/generateTesoreria.ts:25`, `src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts:203`, `src/modules/mi-plan/services/presupuestoAnualService.ts:360`, `src/modules/mi-plan/wizards/utils/getCurrentSaldoCuenta.ts:40`, `src/modules/panel/PanelPage.tsx:192`, `src/modules/tesoreria/v6/DrawerExtracto.tsx:163`, `src/modules/tesoreria/v6/TesoreriaV6Page.tsx:218`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:129`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:130`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:953`, `src/services/__buscarApunteAudit.ts:271`

| | |
|---|---|
| **A · identificar línea** | Es el objeto a identificar, no la fuente. Sus campos `description`, `counterparty`, `paymentMethod`, `amount`, `date`, `valueDate` son la entrada del marcador. |
| **B · atribuir inmueble** | Lo recibe, no lo aporta (`inmuebleId` se escribe al clasificar). |
| **C · atribuir ámbito** | Lo recibe (`ambito`). |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | El histórico ya clasificado es la mejor fuente para DETECTAR recurrentes (entregable 4). |
| **F · campo vacío/ausente** | `counterparty` a menudo viene vacío según el banco: el parser no siempre lo separa del churro de `description`. |

### `treasuryEvents`

**keyPath:** `id` (autoIncrement) · **índices:** accountId · ambito · año · certeza · generadoPor · inmuebleId · predictedDate · sourceId · sourceType · status · type · **registros:** —

Las previsiones. Es el LADO DERECHO del matcheo: contra esto se cuadra.

**Esquema · 57 rutas de campo (anidados incluidos)**

```
id? : number
type : 'income' | 'expense' | 'financing'
amount : number
predictedDate : string
description : string
sourceType : 'document' | 'contract' | 'manual' | 'ingreso' | 'gasto' | 'opex_rule' | 'gasto_recurrente
sourceId? : number | string
mes? : number
certeza? : 'declarado' | 'calculado' | 'atlas_nativo' | 'estimado' | 'manual'
fuenteHistorica? : 'xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual'
ejercicioFiscalOrigen? : number
generadoPor? : 'historicalTreasuryService' | 'treasurySyncService' | 'user'
actualizadoPorDeclaracion? : boolean
inmuebleId? : number
inmuebleAlias? : string
unidadInmueble? : string
contratoId? : number
tarjetaId? : number
conciliadoExtracto? : boolean
accountId? : number
paymentMethod? : MetodoDePago
iban? : string
status : 'predicted' | 'confirmed' | 'executed'
descartado? : boolean
descartadoAt? : string
motivoDescarte? : string
actualDate? : string
actualAmount? : number
movementId? : number
bolsaPresupuesto? : BolsaPresupuesto
prestamoId? : string
numeroCuota? : number
ambito? : 'PERSONAL' | 'INMUEBLE'
proveedor? : string
categoryLabel? : string
categoryKey? : string
subtypeKey? : string
conceptoId? : string
tipoFamilia? : string
isEsporadico? : boolean
transferMetadata? : { targetAccountId: number; pairEventId?: number; esAmortizacionParcial?: boolean; }
  transferMetadata.targetAccountId : number
  transferMetadata.pairEventId? : number
  transferMetadata.esAmortizacionParcial? : boolean
counterparty? : string
providerName? : string
providerNif? : string
invoiceNumber? : string
notes? : string
executedMovementId? : number
executedAt? : string
facturaId? : number
facturaNoAplica? : boolean
justificanteId? : number
justificanteNoAplica? : boolean
createdAt : string
updatedAt : string
```

**Escriben:** `src/modules/financiacion/wizards/PrestamoPageV2.tsx:1624`, `src/modules/financiacion/wizards/PrestamoPageV2.tsx:1646`, `src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx:474`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:249`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:260`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:613`, `src/modules/inversiones/pages/FichaPlanPensiones.tsx:864`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:428`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:899`, `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:925`, `src/services/bankStatementOrchestrator.ts:348`, `src/services/bankStatementOrchestrator.ts:647`

**Leen:** `src/modules/financiacion/wizards/PrestamoPageV2.tsx:1609`, `src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts:202`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:1168`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:197`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:224`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:551`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:896`, `src/modules/inmuebles/components/contratos/DrawerFichaContrato.tsx:212`, `src/modules/inmuebles/components/contratos/TabAnalisis.tsx:64`, `src/modules/inmuebles/utils/cargarIngresosCobrados.ts:15`, `src/modules/mi-plan/services/presupuestoAnualService.ts:359`, `src/modules/mi-plan/services/presupuestoAnualService.ts:594`

| | |
|---|---|
| **A · identificar línea** | Sí · `amount`, `predictedDate`, `providerName`, `counterparty`, `accountId`, `categoryKey`. **Es el ÚNICO store contra el que cuadra `matchBatch`**, así que todo lo que no esté aquí, no existe para el emparejador. |
| **B · atribuir inmueble** | Sí · `inmuebleId`. |
| **C · atribuir ámbito** | Sí · `ambito`. |
| **D · calendario esperado** | Sí, pero derivado: los previstos que alguien generó. Si el generador no corrió, no hay calendario. |
| **E · extraordinarios** | Solo si alguien creó el previsto. |
| **F · campo vacío/ausente** | `cups` y `numeroContrato` del compromiso **no se copian aquí**, así que la identificación por CUPS es imposible aunque el dato exista en el compromiso. |

### `importBatches`

**keyPath:** `id` · **índices:** accountId · createdAt · **registros:** —

Contabilidad del import: qué fichero, cuándo, y qué líneas ignoró el usuario.

**Esquema · 28 rutas de campo (anidados incluidos)**

```
id? : string
filename : string
accountId : number
totalRows : number
importedRows : number
skippedRows : number
duplicatedRows : number
errorRows : number
origenBanco : string
formatoDetectado : 'CSV' | 'XLS' | 'XLSX'
cuentaIban? : string
rangoFechas : { min: string; // ISO date format yyyy-mm-dd max: string; // ISO date format yyyy-mm-dd }
  rangoFechas.min : string
  rangoFechas.max : string
timestampImport : string
hashLote : string
lineasIgnoradas? : Array<{ hashLinea: string; ignoradaAt: string; }>
  lineasIgnoradas[].hashLinea : string
  lineasIgnoradas[].ignoradaAt : string
consolidadoAt? : string
lineasPendientes? : Array<{ hashLinea: string; fecha: string; importe: number; concepto: string; }>
  lineasPendientes[].hashLinea : string
  lineasPendientes[].fecha : string
  lineasPendientes[].importe : number
  lineasPendientes[].concepto : string
usuario? : string
inboxItemId? : number
createdAt : string
```

**Escriben:** `src/services/bankStatementOrchestrator.ts:448`, `src/services/bankStatementOrchestrator.ts:520`, `src/services/bankStatementOrchestrator.ts:542`, `src/services/migrations/v88-borrarCuentasDeTarjeta.ts:180`, `src/services/statementIgnoredLinesService.ts:118`, `src/services/statementIgnoredLinesService.ts:96`, `src/services/statementSessionService.ts:110`, `src/services/treasuryApiService.ts:740`

**Leen:** `src/services/bankStatementOrchestrator.ts:113`, `src/services/bankStatementOrchestrator.ts:540`, `src/services/statementIgnoredLinesService.ts:42`, `src/services/statementIgnoredLinesService.ts:44`, `src/services/statementIgnoredLinesService.ts:90`, `src/services/statementSessionService.ts:129`, `src/services/statementSessionService.ts:38`, `src/services/statementSessionService.ts:89`, `src/utils/batchHashUtils.ts:180`

| | |
|---|---|
| **A · identificar línea** | No identifica el gasto, pero `lineasIgnoradas[]` guarda lo que ya dijiste que no querías: evita volver a preguntar. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Ninguno · cumple su función. |

---

## 2.2 · Los que tienen señal y el motor NO mira (12)

Éstos son la respuesta a tu pregunta. En todos, el dato existe.


### `property_sales`

**keyPath:** `id` (autoIncrement) · **índices:** property-status · propertyId · saleDate · status · **registros:** 2 `[tu dato]`

**El caso que citas.** La venta está registrada con fecha, precio y la cancelación del préstamo, y el matcheo no lo abre.

**Esquema · 34 rutas de campo (anidados incluidos)**

```
id? : number
propertyId : number
saleDate : string
salePrice : number
saleCosts : { agencyCommission: number; municipalTax: number; saleNotaryCosts: number; otherCosts: num
  saleCosts.agencyCommission : number
  saleCosts.municipalTax : number
  saleCosts.saleNotaryCosts : number
  saleCosts.otherCosts : number
loanSettlement : { payoffAmount: number; cancellationFee: number; total: number; }
  loanSettlement.payoffAmount : number
  loanSettlement.cancellationFee : number
  loanSettlement.total : number
grossProceeds : number
netProceeds : number
status : 'draft' | 'confirmed' | 'reverted'
source : 'cartera' | 'detalle' | 'analisis' | 'wizard'
notes? : string
createdAt : string
updatedAt : string
fiscalSnapshot? : { precioAdquisicion: number; gastosAdquisicion: number; mejorasCapexAcumuladas: number; am
  fiscalSnapshot.precioAdquisicion : number
  fiscalSnapshot.gastosAdquisicion : number
  fiscalSnapshot.mejorasCapexAcumuladas : number
  fiscalSnapshot.amortizacionAcumuladaDeclarada : number
  fiscalSnapshot.amortizacionAcumuladaAtlas : number
  fiscalSnapshot.costeFiscalAdquisicion : number
  fiscalSnapshot.gastosVenta : number
  fiscalSnapshot.valorNetoTransmision : number
  fiscalSnapshot.gananciaPatrimonial : number
  fiscalSnapshot.irpfEstimado : number
  fiscalSnapshot.anosDeclaradosXml : number[]
  fiscalSnapshot.anosCalculadosAtlas : number[]
  fiscalSnapshot.calculatedAt : string
```

**Escriben:** _nadie_

**Leen:** `src/modules/fiscal/v2/helpers/ejercicioDocumentosService.ts:79`, `src/modules/fiscal/v2/helpers/ventaCalculoService.ts:409`, `src/modules/mi-plan/services/presupuestoAnualService.ts:289`, `src/pages/GestionInmuebles/GestionInmueblesList.tsx:64`, `src/pages/GestionInmuebles/tabs/FichaTab.tsx:63`, `src/services/propertySaleService.ts:1085`, `src/services/propertySaleService.ts:1327`

| | |
|---|---|
| **A · identificar línea** | Sí y determinista · `saleDate` + `salePrice` (el ingreso grande), `loanSettlement.payoffAmount` + `loanSettlement.cancellationFee` (el cargo de cancelación), `saleCosts.agencyCommission` / `municipalTax` / `saleNotaryCosts` (los gastos asociados). Cinco movimientos extraordinarios con fecha e importe exactos. |
| **B · atribuir inmueble** | Sí · `propertyId`. Total. |
| **C · atribuir ámbito** | Sí · una venta es del inmueble. |
| **D · calendario esperado** | Sí · es un calendario de una sola fecha, pero exacto. |
| **E · extraordinarios** | **Es literalmente el store de lo extraordinario.** Venta, cancelación de préstamo, comisión de agencia, plusvalía municipal, notaría. |
| **F · campo vacío/ausente** | Ninguno para esto: el dato está completo. Lo que falta es que alguien lo lea. |

### `proveedores`

**keyPath:** `nif` · **índices:** _ninguno_ · **registros:** 13 `[tu dato]`

El catálogo de proveedores por NIF. **Nunca se ha leído desde el matcheo**, como dices.

**Esquema · 6 rutas de campo (anidados incluidos)**

```
nif : string
nombre? : string
tipos : string[]
sinNombre? : boolean
createdAt : string
updatedAt : string
```

**Escriben:** `src/modules/inmuebles/wizards/agenciaGestionService.ts:32`, `src/services/declaracionDistributorService.ts:2097`, `src/services/declaracionDistributorService.ts:2101`

**Leen:** `src/modules/inmuebles/wizards/agenciaGestionService.ts:19`, `src/services/declaracionDistributorService.ts:2092`

| | |
|---|---|
| **A · identificar línea** | Sí · `nif` y `nombre`. Un extracto que trae el NIF en el concepto —lo hacen muchos recibos— identificaría al proveedor sin heurística. Y `tipos[]` dice de qué es proveedor. |
| **B · atribuir inmueble** | No directamente. |
| **C · atribuir ámbito** | Parcial · vía `tipos[]`. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Solo lo escriben `agenciaGestionService` y `declaracionDistributorService`. **Los proveedores de tus 45 compromisos no están aquí**, así que el catálogo está incompleto además de sin usar. |

### `inversiones`

**keyPath:** `id` (autoIncrement) · **índices:** activo · entidad · tipo · **registros:** 5 `[tu dato]`

Las posiciones. Ojo: el store se declara como `PosicionInversion`, pero los registros reales llevan la forma EXTENDIDA con `rendimiento.pagos_generados[]`, que ese tipo no incluye.

**Esquema · 58 rutas de campo (anidados incluidos)**

```
id : number
nombre : string
tipo : TipoPosicion
entidad : string
isin? : string
ticker? : string
valor_actual : number
fecha_valoracion : string
aportaciones : Aportacion[]
  aportaciones[].id : number
  aportaciones[].fecha : string
  aportaciones[].importe : number
  aportaciones[].tipo : 'aportacion' | 'reembolso' | 'dividendo'
  aportaciones[].notas? : string
  aportaciones[].cuenta_cargo_id? : number
  aportaciones[].unidades? : number
  aportaciones[].unidades_vendidas? : number
  aportaciones[].precioUnitario? : number
  aportaciones[].coste_adquisicion_fifo? : number
  aportaciones[].ganancia_perdida? : number
  aportaciones[].fuente? : string
total_aportado : number
rentabilidad_euros : number
rentabilidad_porcentaje : number
fecha_compra? : string
cuenta_cargo_id? : number
plan_aportaciones? : PlanAportaciones
  plan_aportaciones.activo : boolean
  plan_aportaciones.importe : number
  plan_aportaciones.frecuencia : 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  plan_aportaciones.meses : number[]
  plan_aportaciones.dia_cargo : number
  plan_aportaciones.cuenta_cargo_id : number
  plan_aportaciones.fecha_inicio : string
  plan_aportaciones.fecha_fin? : string
plan_liquidacion? : PlanLiquidacion
  plan_liquidacion.activo : boolean
  plan_liquidacion.tipo_liquidacion : 'vencimiento' | 'venta' | 'rescate'
  plan_liquidacion.fecha_estimada : string
  plan_liquidacion.liquidacion_total : boolean
  plan_liquidacion.importe_estimado : number
  plan_liquidacion.cuenta_destino_id : number
numero_participaciones? : number
precio_medio_compra? : number
cuenta_cobro_id? : number
duracion_meses? : number
subtipo_prestamo? : SubtipoPrestamo
modalidad_devolucion? : 'solo_intereses' | 'capital_e_intereses' | 'al_vencimiento'
frecuencia_cobro? : 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'al_vencimiento'
liquidacion_intereses? : 'al_vencimiento' | 'mensual' | 'trimestral' | 'anual'
retencion_fiscal? : number
rendimiento? : { tasa_interes_anual?: number }
  rendimiento.tasa_interes_anual? : number
dividendo_anual_estimado? : number
notas? : string
activo : boolean
created_at : string
updated_at : string
```

**Escriben:** `src/services/declaracionDistributorService.ts:1593`, `src/services/financialValuesService.ts:228`, `src/services/indexaCapitalImportService.ts:446`, `src/services/inversionesService.ts:184`, `src/services/inversionesService.ts:199`, `src/services/inversionesService.ts:309`, `src/services/migrations/migrateInversiones.ts:37`, `src/services/valoracionesService.ts:820`, `src/services/valoracionesService.ts:998`

**Leen:** `src/modules/inmuebles/import/ImportarValoraciones.tsx:210`, `src/modules/inmuebles/import/ImportarValoraciones.tsx:328`, `src/modules/inmuebles/import/ImportarValoraciones.tsx:343`, `src/modules/inversiones/adapters/posicionesCerradas.ts:224`, `src/services/bonificaciones/movimientosQuePrueban.ts:62`, `src/services/declaracionDistributorService.ts:1582`, `src/services/financialValuesService.ts:226`, `src/services/fiscalCacheService.ts:86`, `src/services/indexaCapitalImportService.ts:473`, `src/services/inversionesFiscalService.ts:83`, `src/services/inversionesService.ts:107`, `src/services/inversionesService.ts:125`

| | |
|---|---|
| **A · identificar línea** | Sí · `plan_aportaciones` (importe, frecuencia, `dia_cargo`, `cuenta_cargo_id`) identifica la aportación periódica. Y `rendimiento.pagos_generados[]` identifica cada cobro. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí · una inversión es ámbito personal/ahorro. |
| **D · calendario esperado** | **SÍ, y con el desglose fiscal completo:** `pagos_generados[]` lleva `fecha_pago`, `importe_bruto`, `retencion_fiscal`, `importe_neto`, `estado`, `movimiento_id`. El banco ingresa el NETO; sin este store es imposible saber que hubo retención. También `plan_liquidacion` (fecha e importe estimado del vencimiento). |
| **E · extraordinarios** | Sí · `plan_liquidacion` explica un ingreso grande por vencimiento o rescate. |
| **F · campo vacío/ausente** | **El tipo del store miente**: `PosicionInversion` (`types/inversiones.ts:72`) solo declara `rendimiento: { tasa_interes_anual? }`. La forma real vive en `PosicionInversionExtendida` (`types/inversiones-extended.ts`). Quien lea el esquema del store concluirá que `pagos_generados` no existe. |

### `properties`

**keyPath:** `id` (autoIncrement) · **índices:** address · alias · **registros:** 8 `[tu dato]`

Los inmuebles. Solo lo lee el matcheo de rebote (para pintar alias).

**Esquema · 101 rutas de campo (anidados incluidos)**

```
id? : number
alias : string
globalAlias? : string
address : string
postalCode : string
province : string
municipality : string
ccaa : string
purchaseDate : string
cadastralReference? : string
squareMeters : number
bedrooms : number
bathrooms? : number
transmissionRegime : 'usada' | 'obra-nueva'
state : 'activo' | 'vendido' | 'baja'
notes? : string
porcentajePropiedad? : number
titularidad? : 'yo' | 'pareja' | 'ambos'
porcentajePropiedadPareja? : number
esUrbana? : boolean
certificadoEnergetico? : 'NO' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
acquisitionCosts : { price: number; itp?: number; itpIsManual?: boolean; iva?: number; ivaIsManual?: boolean;
  acquisitionCosts.price : number
  acquisitionCosts.itp? : number
  acquisitionCosts.itpIsManual? : boolean
  acquisitionCosts.iva? : number
  acquisitionCosts.ivaIsManual? : boolean
  acquisitionCosts.ajd? : number
  acquisitionCosts.ajdIsManual? : boolean
  acquisitionCosts.notary? : number
  acquisitionCosts.registry? : number
  acquisitionCosts.management? : number
  acquisitionCosts.psi? : number
  acquisitionCosts.realEstate? : number
  acquisitionCosts.other? : Array<{ concept: string; amount: number; }>
    acquisitionCosts.other[].concept : string
    acquisitionCosts.other[].amount : number
estructuraCompra? : { aportacionPropia?: number; // lo que el usuario puso de su bolsillo importeFinanciado?: 
  estructuraCompra.aportacionPropia? : number
  estructuraCompra.importeFinanciado? : number
  estructuraCompra.prestamoVinculadoId? : string
documents : number[]
fiscalData? : { cadastralValue?: number; constructionCadastralValue?: number; constructionPercentage?: n
  fiscalData.cadastralValue? : number
  fiscalData.constructionCadastralValue? : number
  fiscalData.constructionPercentage? : number
  fiscalData.cadastralRevised? : boolean
  fiscalData.acquisitionDate? : string
  fiscalData.housingReduction? : boolean
  fiscalData.isAccessory? : boolean
  fiscalData.mainPropertyId? : number
  fiscalData.accessoryData? : { cadastralReference: string; acquisitionDate: string; cadastralValue: number; constructio
    fiscalData.accessoryData.cadastralReference : string
    fiscalData.accessoryData.acquisitionDate : string
    fiscalData.accessoryData.cadastralValue : number
    fiscalData.accessoryData.constructionCadastralValue : number
  fiscalData.baseAmortizacion? : number
  fiscalData.amortizacionAnualInmueble? : number
tipoActivo? : TipoActivo
subtipoVivienda? : 'piso' | 'casa' | 'chalet' | 'estudio' | 'edificio' | 'otro'
foto? : string
valorReferencia? : number
anexos? : { tieneParking: boolean; tieneTrastero: boolean; /** V77 · wizard import XML V2 (pilar 1) 
  anexos.tieneParking : boolean
  anexos.tieneTrastero : boolean
  anexos.plazasParking? : number
  anexos.tieneTerraza? : boolean
  anexos.tieneAscensor? : boolean
usoTipo? : SubtipoAlquiler | 'mixto' | 'vivienda_habitual' | 'disponible'
alquilerPorHabitaciones? : { activo: boolean; numeroHabitaciones?: number; }
  alquilerPorHabitaciones.activo : boolean
  alquilerPorHabitaciones.numeroHabitaciones? : number
explotacion? : { estadoOperativo?: 'operativo' | 'en_reforma' | 'vacante' | 'uso_propio'; unidadesArrenda
  explotacion.estadoOperativo? : 'operativo' | 'en_reforma' | 'vacante' | 'uso_propio'
  explotacion.unidadesArrendables? : number
modoExplotacion? : 'piso_completo' | 'por_habitaciones' | 'mixto'
aeatAmortization? : { // Acquisition type and dates acquisitionType: 'onerosa' | 'lucrativa' | 'mixta'; firstA
  aeatAmortization.acquisitionType : 'onerosa' | 'lucrativa' | 'mixta'
  aeatAmortization.firstAcquisitionDate : string
  aeatAmortization.transmissionDate? : string
  aeatAmortization.cadastralValue : number
  aeatAmortization.constructionCadastralValue : number
  aeatAmortization.constructionPercentage : number
  aeatAmortization.onerosoAcquisition? : { acquisitionAmount: number; // importe de adquisición acquisitionExpenses: number; // gas
    aeatAmortization.onerosoAcquisition.acquisitionAmount : number
    aeatAmortization.onerosoAcquisition.acquisitionExpenses : number
  aeatAmortization.lucrativoAcquisition? : { isdValue: number; // valor ISD (sin exceder valor de mercado) isdTax: number; // impuest
    aeatAmortization.lucrativoAcquisition.isdValue : number
    aeatAmortization.lucrativoAcquisition.isdTax : number
    aeatAmortization.lucrativoAcquisition.inherentExpenses : number
  aeatAmortization.baseAmortizacion? : number
  aeatAmortization.mejorasAnteriores? : number
  aeatAmortization.amortizacionAnualInmueble? : number
  aeatAmortization.specialCase? : { type: 'usufructo-temporal' | 'usufructo-vitalicio' | 'diferenciado' | 'parcial-alquiler'
    aeatAmortization.specialCase.type : 'usufructo-temporal' | 'usufructo-vitalicio' | 'diferenciado' | 'parcial-alquiler' |
    aeatAmortization.specialCase.usufructoDuration? : number
    aeatAmortization.specialCase.maxDeductibleIncome? : number
    aeatAmortization.specialCase.rentedPercentage? : number
    aeatAmortization.specialCase.estimatedLandPercentage? : number
    aeatAmortization.specialCase.customPercentage? : number
    aeatAmortization.specialCase.manualAmount? : number
```

**Escriben:** `src/modules/inmuebles/import/ImportarInmuebles.tsx:326`, `src/modules/inmuebles/import/ImportarInmuebles.tsx:330`, `src/pages/inmuebles/InmueblePage.tsx:445`, `src/pages/inmuebles/InmueblePage.tsx:448`, `src/services/contractImportCreationService.ts:303`, `src/services/contractImportCreationService.ts:83`, `src/services/db/post-open.ts:141`, `src/services/declaracionDistributorService.ts:1026`, `src/services/declaracionDistributorService.ts:1267`, `src/services/declaracionDistributorService.ts:1392`, `src/services/declaracionDistributorService.ts:239`, `src/services/declaracionDistributorService.ts:372`

**Leen:** `src/components/inbox/InboxV3ExtractedPanel.tsx:168`, `src/components/kpi/KpiBuilder.tsx:162`, `src/components/onboarding/import-declaracion/useInmueblesDetectados.ts:114`, `src/components/tax/taxHydrationMapper.ts:175`, `src/modules/archivo/ArchivoPage.tsx:110`, `src/modules/fiscal/v2/FiscalInmueblePage.tsx:135`, `src/modules/fiscal/v2/FiscalInmueblePage.tsx:15`, `src/modules/fiscal/v2/acciones/ArrastresManualesSection.tsx:35`, `src/modules/fiscal/v2/helpers/amortizacionAcumuladaService.ts:75`, `src/modules/fiscal/v2/helpers/ejercicioDocumentosService.ts:86`, `src/modules/fiscal/v2/helpers/ventaCalculoService.ts:411`, `src/modules/horizon/analisis-cartera/AnalisisCartera.tsx:30`

| | |
|---|---|
| **A · identificar línea** | Parcial · `alias` y `address` aparecen a veces en el concepto del banco («COM PROP C/ MAYOR 3»). `referenciaCatastral` casi nunca. |
| **B · atribuir inmueble** | **Es la tabla de destino de la atribución.** Da el nombre, no la asignación. |
| **C · atribuir ámbito** | Sí · `usoTipo` distingue vivienda habitual (no deducible) de arrendada (deducible). |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Parcial · `estructuraCompra` explica la aportación propia y lo financiado en la compra. |
| **F · campo vacío/ausente** | `alias`/`address` no están normalizados para comparar contra el churro del banco. |

### `tarjetas`

**keyPath:** `id` (autoIncrement) · **índices:** activa · cuentaLiquidacionId · origen · **registros:** —

Las tarjetas. Qué tarjeta liquida en qué cuenta y con qué ciclo.

**Esquema · 14 rutas de campo (anidados incluidos)**

```
id? : number
alias : string
emisora? : string
origen : OrigenTarjeta
modalidad : ModalidadTarjeta
cuentaLiquidacionId : number
ciclo? : CicloTarjeta
  ciclo.periodicidad : PeriodicidadCiclo
  ciclo.corte : number
  ciclo.diaCargo : number
  ciclo.periodosHastaElCargo : number
activa : boolean
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/migrations/v87-tarjetas.ts:89`, `src/services/tarjetasService.ts:112`, `src/services/tarjetasService.ts:121`, `src/services/tarjetasService.ts:86`

**Leen:** `src/services/__tarjetaDiagnostico.ts:77`, `src/services/migrations/v87-tarjetas.ts:57`, `src/services/tarjetasService.ts:104`, `src/services/tarjetasService.ts:62`, `src/services/tarjetasService.ts:68`

| | |
|---|---|
| **A · identificar línea** | Sí · `cuentaLiquidacionId` + el ciclo (`corte`, `diaCargo`) predicen el recibo mensual de la tarjeta, que es de los cargos más grandes y más confusos del extracto. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | Sí · el ciclo genera el recibo previsto (`regenerarRecibosDeTarjeta`). |
| **E · extraordinarios** | Explica por qué una compra concreta NO aparece en la cuenta: salió dentro del recibo agregado. |
| **F · campo vacío/ausente** | Ninguno · el problema es que el matcheo no lo consulta al ver un «ADEUDO MENSUAL DE TARJETA». |

### `gastosInmueble`

**keyPath:** `id` (autoIncrement) · **índices:** casillaAEAT · ejercicio · estado · inmueble-ejercicio · inmuebleId · movimientoId · origen · origen-origenId · treasuryEventId · **registros:** 3.504 `[tu dato]`

Los gastos ya registrados y declarados. El store más grande de la base.

**Esquema · 29 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
ejercicio : number
fecha : string
fechaValor? : string
concepto : string
categoria : GastoCategoria
casillaAEAT : AEATBox
importe : number
importeBruto? : number
origen : GastoOrigen
origenId? : string
estado : GastoEstadoNuevo
proveedorNombre? : string
proveedorNIF? : string
invoiceNumber? : string
cuentaBancaria? : string
documentId? : number
movimientoId? : string
estadoTesoreria? : 'predicted' | 'confirmed'
treasuryEventId? : number
facturaId? : number
facturaNoAplica? : boolean
justificanteId? : number
justificanteNoAplica? : boolean
categoryKey? : string
subtypeKey? : string
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:85`, `src/services/altaMovimientoService.ts:506`, `src/services/altaMovimientoService.ts:530`, `src/services/cierreLineaInmueble.ts:218`, `src/services/cierreLineaInmueble.ts:264`, `src/services/gastosInmuebleService.ts:31`, `src/services/gastosInmuebleService.ts:41`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:127`

**Leen:** `src/services/__buscarApunteAudit.ts:289`, `src/services/__lineasFiscalesAudit.ts:82`, `src/services/altaMovimientoService.ts:497`, `src/services/cierreLineaInmueble.ts:194`, `src/services/cierreLineaInmueble.ts:206`, `src/services/cierreLineaInmueble.ts:247`, `src/services/fiscalCacheService.ts:82`, `src/services/fiscalCacheService.ts:88`, `src/services/gananciaPatrimonialService.ts:57`, `src/services/gastosInmuebleService.ts:28`, `src/services/gastosInmuebleService.ts:57`, `src/services/gastosInmuebleService.ts:62`

| | |
|---|---|
| **A · identificar línea** | Sí · `proveedorNombre`, `proveedorNIF`, `importe`, `fecha`, `concepto`. **3.504 filas son el mejor corpus de entrenamiento de la base** y nadie las usa para reconocer un proveedor. |
| **B · atribuir inmueble** | Sí · `inmuebleId`. Total. |
| **C · atribuir ámbito** | Sí · si está aquí, es de inmueble y deducible. |
| **D · calendario esperado** | No · es el pasado, no lo esperado. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | **Su uso crítico es el negativo: evitar duplicar.** `movimientoId` y `origen-origenId` permiten saber si un cargo YA está registrado. El conciliador no lo comprueba (es B19). |

---

## 2.3 · Señal indirecta o nula (32)

Formato compacto: los 32 restantes con su esquema (recortado a 25 rutas cuando es muy largo;
completo en el anexo B), quién los toca y las seis preguntas. Ninguno es un olvido: se dice
para qué serviría si tuviera datos.


### `documents`

**keyPath:** `id` (autoIncrement) · **índices:** entityId · entityType · type · **registros:** —

Facturas y justificantes guardados, con su OCR.

**Esquema · 120 rutas de campo (anidados incluidos)**

```
id? : number
filename : string
type : string
size : number
lastModified : number
content : Blob
metadata : { title?: string; description?: string; tags?: string[]; entityType?: 'property' | 'contra
  metadata.title? : string
  metadata.description? : string
  metadata.tags? : string[]
  metadata.entityType? : 'property' | 'contract' | 'expense' | 'personal'
  metadata.entityId? : number
  metadata.ocr? : OCRResult
    metadata.ocr.engine : string
    metadata.ocr.timestamp : string
    metadata.ocr.confidenceGlobal : number
    metadata.ocr.fields : OCRField[]
      metadata.ocr.fields[].name : string
      metadata.ocr.fields[].value : string
      metadata.ocr.fields[].confidence : number
      metadata.ocr.fields[].raw? : string
      metadata.ocr.fields[].page? : number
    metadata.ocr.data? : { proveedor?: string; numero_factura?: string; fecha?: string; base_imponible?: string | n
      metadata.ocr.data.proveedor? : string
      metadata.ocr.data.numero_factura? : string
   … (95 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/components/inbox/EditDocumentMetadataModal.tsx:3`, `src/components/inbox/EditDocumentMetadataModal.tsx:80`, `src/components/inbox/InboxV3ExtractedPanel.tsx:347`, `src/services/db/documents.ts:81`, `src/services/db/documents.ts:84`, `src/services/db/documents.ts:96`, `src/services/declaracionDistributorService.ts:935`, `src/services/documentAutoClassifyService.ts:528`, `src/services/documentIngestionService.ts:241`, `src/services/documentMatchingService.ts:336`, `src/services/emailIngestService.ts:242`

**Leen:** `src/components/inbox/InboxV3ExtractedPanel.tsx:344`, `src/modules/archivo/ArchivoPage.tsx:109`, `src/modules/fiscal/v2/helpers/ejercicioDocumentosService.ts:36`, `src/modules/inmuebles/components/DocumentosInmueble.tsx:25`, `src/pages/GestionInmuebles/tabs/FacturaSelectorModal.tsx:63`, `src/pages/InboxPage.tsx:141`, `src/services/db/documents.ts:14`, `src/services/declaracionDistributorService.ts:919`, `src/services/documentAutoClassifyService.ts:507`, `src/services/documentIngestionService.ts:234`, `src/services/documentMatchingService.ts:308`, `src/services/emailIngestService.ts:448`

| | |
|---|---|
| **A · identificar línea** | Sí, y muy fuerte si hay OCR: el documento trae proveedor, NIF, nº de factura, importe y fecha. `documentAutoClassifyService` ya cruza CUPS/NIF/contrato contra compromisos — **pero para facturas, nunca para movimientos.** |
| **B · atribuir inmueble** | Sí · `metadata.entityId` cuando el documento cuelga de un inmueble. |
| **C · atribuir ámbito** | Parcial. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Sí · una factura de obra explica una derrama. |
| **F · campo vacío/ausente** | El puente factura↔movimiento no existe: son dos mundos con el mismo dato. |

### `mejorasInmueble`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicio · inmueble-ejercicio · inmuebleId · movimientoId · treasuryEventId · **registros:** —

Las mejoras capitalizadas (se amortizan, no se deducen).

**Esquema · 21 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
ejercicio : number
descripcion : string
tipo : 'mejora' | 'ampliacion' | 'reparacion'
importe : number
fecha : string
proveedorNIF? : string
proveedorNombre? : string
invoiceNumber? : string
documentId? : number
movimientoId? : string
estadoTesoreria? : 'predicted' | 'confirmed'
treasuryEventId? : number
facturaId? : number
facturaNoAplica? : boolean
justificanteId? : number
justificanteNoAplica? : boolean
categoryKey? : string
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:91`, `src/services/altaMovimientoService.ts:250`, `src/services/altaMovimientoService.ts:272`, `src/services/mejorasInmuebleService.ts:12`, `src/services/migrations/fixReparacionesDuplicadas.ts:15`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:295`

**Leen:** `src/services/documentMatchingService.ts:118`, `src/services/documentMatchingService.ts:224`, `src/services/gananciaPatrimonialService.ts:66`, `src/services/mejorasInmuebleService.ts:27`, `src/services/mejorasInmuebleService.ts:33`, `src/services/migrations/fixReparacionesDuplicadas.ts:12`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:290`

| | |
|---|---|
| **A · identificar línea** | Sí · `descripcion`, `importe`, `fecha`, `proveedorNombre`, `proveedorNIF`. |
| **B · atribuir inmueble** | Sí · `inmuebleId`. |
| **C · atribuir ámbito** | Sí · inmueble, pero vía amortización. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Sí · una reforma grande es un cargo extraordinario que este store explica. |
| **F · campo vacío/ausente** | Como en gastos, sirve para NO duplicar: `movimientoId` dice si ese cargo ya está registrado. |

### `mueblesInmueble`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicio · inmueble-ejercicio · inmuebleId · movimientoId · treasuryEventId · **registros:** —

Mobiliario amortizable.

**Esquema · 23 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
ejercicio : number
descripcion : string
fechaAlta : string
importe : number
vidaUtil : number
activo : boolean
fechaBaja? : string
proveedorNIF? : string
proveedorNombre? : string
invoiceNumber? : string
documentId? : number
movimientoId? : string
estadoTesoreria? : 'predicted' | 'confirmed'
treasuryEventId? : number
facturaId? : number
facturaNoAplica? : boolean
justificanteId? : number
justificanteNoAplica? : boolean
categoryKey? : string
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:97`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:311`, `src/services/mueblesInmuebleService.ts:14`

**Leen:** `src/services/documentAutoClassifyService.ts:401`, `src/services/documentMatchingService.ts:119`, `src/services/documentMatchingService.ts:247`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:306`, `src/services/mueblesInmuebleService.ts:29`, `src/services/mueblesInmuebleService.ts:35`

| | |
|---|---|
| **A · identificar línea** | Sí · concepto, importe, fecha, proveedor. |
| **B · atribuir inmueble** | Sí · `inmuebleId`. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Sí · la compra de mobiliario al amueblar un piso. |
| **F · campo vacío/ausente** | Igual que mejoras: evitar duplicado. |

### `baseAmortizableEjercicio`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicio · inmueble-ejercicio (único) · inmuebleId · origen · **registros:** —

La base amortizable por inmueble y ejercicio, con procedencia.

**Esquema · 60 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
ejercicio : number
base : number
origen : BaseAmortizableOrigen
  origen.id? : number
  origen.inmuebleId : number
  origen.ejercicio : number
  origen.base : number
  origen.origen : BaseAmortizableOrigen
    origen.origen.id? : number
    origen.origen.inmuebleId : number
    origen.origen.ejercicio : number
    origen.origen.base : number
    origen.origen.origen : BaseAmortizableOrigen
      origen.origen.origen.id? : number
      origen.origen.origen.inmuebleId : number
      origen.origen.origen.ejercicio : number
      origen.origen.origen.base : number
      origen.origen.origen.origen : BaseAmortizableOrigen
        origen.origen.origen.origen.id? : number
        origen.origen.origen.origen.inmuebleId : number
        origen.origen.origen.origen.ejercicio : number
        origen.origen.origen.origen.base : number
        origen.origen.origen.origen.origen : BaseAmortizableOrigen
   … (35 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/baseAmortizableEjercicioService.ts:108`, `src/services/baseAmortizableEjercicioService.ts:124`, `src/services/baseAmortizableEjercicioService.ts:156`, `src/services/baseAmortizableEjercicioService.ts:159`, `src/services/baseAmortizableEjercicioService.ts:279`

**Leen:** `src/services/baseAmortizableEjercicioService.ts:260`, `src/services/baseAmortizableEjercicioService.ts:59`, `src/services/baseAmortizableEjercicioService.ts:68`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | Sí, pero es un dato de cálculo, no de identificación. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Nada que aportar al matcheo · es fiscalidad pura. |

### `vinculosAccesorio`

**keyPath:** `id` (autoIncrement) · **índices:** inmuebleAccesorioId · inmueblePrincipalId · principal-accesorio-ejercicio (único) · **registros:** —

Qué trastero o garaje cuelga de qué piso, por ejercicio.

**Esquema · 10 rutas de campo (anidados incluidos)**

```
id? : number
inmueblePrincipalId : number
inmuebleAccesorioId : number
ejercicio : number
fechaInicio : string
fechaFin? : string
estado : 'activo' | 'inactivo'
origenCreacion : 'XML' | 'manual'
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:76`, `src/services/declaracionDistributorService.ts:1533`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:365`, `src/services/vinculoAccesorioService.ts:52`, `src/services/vinculoAccesorioService.ts:67`

**Leen:** `src/modules/mi-plan/services/presupuestoAnualService.ts:290`, `src/services/contractDraftService.ts:614`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:358`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | **Sí, y es el que evita un error caro:** un recibo de comunidad del garaje debe imputarse al piso principal. Sin esto, o se atribuye mal o cae en «revisar». |
| **C · atribuir ámbito** | Sí, por herencia del principal. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Ninguno · pero solo sirve si el matcheo lo consulta al atribuir inmueble, y no lo hace. |

### `explotacionAlquiler`

**keyPath:** `id` (autoIncrement) · **índices:** inmuebleId (único) · **registros:** —

Si un inmueble está puesto en alquiler y cómo (completo/habitaciones/turístico).

**Esquema · 12 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
modo : ModoExplotacionAlquiler
estado : EstadoExplotacion
habitaciones? : HabitacionAlquiler[]
  habitaciones[].id : string
  habitaciones[].nombre : string
  habitaciones[].rentaObjetivo? : number
  habitaciones[].estado? : EstadoExplotacion
cuentaCobroPorDefectoId? : number
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/explotacionAlquilerService.ts:185`, `src/services/explotacionAlquilerService.ts:198`, `src/services/explotacionAlquilerService.ts:215`, `src/services/explotacionAlquilerService.ts:223`, `src/services/migrations/v90-explotacionAlquiler.ts:52`

**Leen:** `src/services/explotacionAlquilerService.ts:115`, `src/services/explotacionAlquilerService.ts:127`, `src/services/migrations/v90-explotacionAlquiler.ts:43`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No · lo recibe. |
| **C · atribuir ámbito** | **Sí, y es determinante:** lo NO marcado es uso propio, o sea NO deducible. Distingue el gasto de un piso alquilado del de tu casa. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Sí · un cambio a `en_reforma` explica una racha de gastos de obra. |
| **F · campo vacío/ausente** | Ninguno · falta que se consulte. |

### `viviendaHabitual`

**keyPath:** `id` (autoIncrement) · **índices:** activa · personalDataId · vigenciaDesde · **registros:** —

Cuál es tu vivienda habitual y desde cuándo.

**Esquema · 9 rutas de campo (anidados incluidos)**

```
id? : number
personalDataId : number
data : ViviendaHabitualData
vigenciaDesde : string
vigenciaHasta? : string
activa : boolean
createdAt : string
updatedAt : string
notas? : string
```

**Escriben:** _nadie_

**Leen:** `src/services/__fiscalContextAudit.ts:207`, `src/services/compromisoDetectionService.ts:793`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | Sí · señala el inmueble. |
| **C · atribuir ámbito** | **Sí · el gasto de la vivienda habitual NO es deducible.** Es la frontera personal/inmueble más importante. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Ninguno · falta que se consulte. |

### `propertyDays`

**keyPath:** `id` (autoIncrement) · **índices:** property-year · propertyId · taxYear · **registros:** —

Días de alquiler y de disponibilidad por inmueble y año.

**Esquema · 10 rutas de campo (anidados incluidos)**

```
id? : number
propertyId : number
taxYear : number
daysRented : number
daysAvailable : number
daysUnderRenovation? : number
manualOverride? : boolean
notes? : string
createdAt : string
updatedAt : string
```

**Escriben:** _nadie_

**Leen:** `src/services/aeatAmortizationService.ts:317`, `src/services/imputacionRentaService.ts:130`, `src/services/irpfCalculationService.ts:725`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | Sí. |
| **C · atribuir ámbito** | Sí · prorratea lo deducible. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Nada para identificar · sirve al cálculo, no al matcheo. |

### `aeatCarryForwards`

**keyPath:** `id` (autoIncrement) · **índices:** expirationYear · propertyId · taxYear · **registros:** —

Gastos pendientes de deducir que se arrastran a años siguientes.

**Esquema · 13 rutas de campo (anidados incluidos)**

```
id? : number
propertyId : number
taxYear : number
totalIncome : number
financingAndRepair : number
limitApplied : number
excessAmount : number
expirationYear : number
remainingAmount : number
appliedInYear? : number
carryForwardType? : 'excess_0105' | 'excess_0106' | 'excess_mixed'
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:64`, `src/services/carryForwardService.ts:125`, `src/services/carryForwardService.ts:160`, `src/services/carryForwardService.ts:162`, `src/services/carryForwardService.ts:189`, `src/services/carryForwardService.ts:64`, `src/services/carryForwardService.ts:75`, `src/services/fiscalSummaryService.ts:269`, `src/services/fiscalSummaryService.ts:271`, `src/services/fiscalSummaryService.ts:275`

**Leen:** `src/modules/fiscal/v2/helpers/arrastresVivosService.ts:47`, `src/services/alertasFiscalesService.ts:62`, `src/services/carryForwardService.ts:103`, `src/services/carryForwardService.ts:143`, `src/services/fiscalResolverService.ts:623`, `src/services/fiscalSummaryService.ts:246`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | Sí. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Fiscalidad · sin señal de matcheo. |

### `botesAnualesSinIdentificar`

**keyPath:** `id` (autoIncrement) · **índices:** estado · inmuebleId · inmuebleId-año (único) · **registros:** —

Importes declarados a la AEAT que no se han podido desglosar en gastos concretos.

**Esquema · 13 rutas de campo (anidados incluidos)**

```
id? : number
inmuebleId : number
importeDeclarado : number
nifsDetectados : string[]
tiposArrendamientoOriginales : ('vivienda' | 'no_vivienda' | string)[]
importeAsignado : number
saldoPendiente : number
estado : 'pendiente_total' | 'parcial' | 'cerrado' | 'sobre_asignado'
contractsVinculados : BoteContractLink[]
  contractsVinculados[].contractId : number
  contractsVinculados[].importeAsignado : number
  contractsVinculados[].origen : 'sugerencia_atlas' | 'manual_usuario'
fuente : 'xml_aeat'
```

**Escriben:** `src/services/alquileresV3FixService.ts:72`, `src/services/boteAnualService.ts:117`, `src/services/boteAnualService.ts:136`, `src/services/boteAnualService.ts:200`, `src/services/boteAnualService.ts:216`, `src/services/boteAnualService.ts:281`

**Leen:** `src/services/alquileresV3FixService.ts:61`, `src/services/boteAnualService.ts:144`, `src/services/boteAnualService.ts:152`, `src/services/boteAnualService.ts:157`, `src/services/boteAnualService.ts:181`, `src/services/boteAnualService.ts:207`, `src/services/boteAnualService.ts:232`

| | |
|---|---|
| **A · identificar línea** | Parcial · un bote de X € en un inmueble y año dice que existió ese gasto, sin decir cuál. |
| **B · atribuir inmueble** | Sí · `inmuebleId`. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | **Aquí sí hay hueco real:** el bote dice «hubo 1.200 € de algo» y el extracto podría desglosarlo. Nadie cruza las dos cosas. |

### `ejerciciosFiscalesCoord`

**keyPath:** `año` · **índices:** estado · **registros:** 7 `[tu dato]`

El coordinador fiscal por ejercicio. 542 rutas de campo: el store más ancho de la base, con las declaraciones y sus gastos por inmueble.

**Esquema · 542 rutas de campo (anidados incluidos)**

```
estado : 'en_curso' | 'pendiente' | 'declarado' | 'prescrito' | 'cerrado'
declaradoAt? : string
cierreAtlasMetadata? : { fechaCierre: string; fuenteDatos: ('xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativ
  cierreAtlasMetadata.fechaCierre : string
  cierreAtlasMetadata.fuenteDatos : ('xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual')[]
  cierreAtlasMetadata.confirmadoPorUsuario : boolean
  cierreAtlasMetadata.fechaConfirmacion? : string
  cierreAtlasMetadata.gastosPersonalesEstimados : number
  cierreAtlasMetadata.gastosPersonalesAjustadosPorUsuario : boolean
  cierreAtlasMetadata.totalIngresos : number
  cierreAtlasMetadata.totalGastos : number
  cierreAtlasMetadata.cashflowNeto : number
fechaPrescripcion? : string
aeat? : { snapshot: Record<string, number>; // casillas: { '0435': 112096.62, ... } resumen: Resum
  aeat.snapshot : Record<string
  aeat.resumen : ResumenFiscal
    aeat.resumen.total : number
    aeat.resumen.fechasImposibles : number
    aeat.resumen.ejerciciosFuturos : number
    aeat.resumen.duplicadosExactos : number
    aeat.resumen.ejercicioMaximo : number | null
    aeat.resumen.porEjercicio : Array<{ ejercicio: number; lineas: number }>
      aeat.resumen.porEjercicio[].ejercicio : number
      aeat.resumen.porEjercicio[].lineas : number
    aeat.resumen.muestra : LineaFiscalAnomala[]
   … (517 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:25`, `src/services/declaracionDistributorService.ts:501`, `src/services/declaracionDistributorService.ts:856`, `src/services/declaracionDistributorService.ts:861`, `src/services/ejercicioFiscalService.ts:127`, `src/services/ejercicioFiscalService.ts:158`, `src/services/ejercicioFiscalService.ts:203`, `src/services/ejercicioResolverService.ts:323`, `src/services/ejercicioResolverService.ts:335`, `src/services/ejercicioResolverService.ts:387`, `src/services/ejercicioResolverService.ts:421`, `src/services/ejercicioResolverService.ts:521`

**Leen:** `src/modules/fiscal/v2/acciones/AplicarParalelaSection.tsx:53`, `src/modules/fiscal/v2/acciones/ExportarTodoSection.tsx:101`, `src/modules/fiscal/v2/acciones/ExportarTodoSection.tsx:69`, `src/modules/fiscal/v2/acciones/HistoricoDeclaracionesSection.tsx:36`, `src/modules/fiscal/v2/acciones/ImportarDeclaracionSection.tsx:47`, `src/modules/fiscal/v2/acciones/ReImportarExportarSection.tsx:32`, `src/modules/fiscal/v2/helpers/arrastresVivosService.ts:157`, `src/modules/fiscal/v2/helpers/arrastresVivosService.ts:172`, `src/modules/inmuebles/adapters/rentasDeclaradasInmueble.ts:42`, `src/modules/inversiones/adapters/posicionesCerradas.ts:210`, `src/services/accountMigrationService.ts:90`, `src/services/alquileresV3FixService.ts:30`

| | |
|---|---|
| **A · identificar línea** | Parcial · lo declarado en años anteriores dice qué proveedores y qué importes son habituales en cada inmueble. Es un corpus histórico, no un identificador. |
| **B · atribuir inmueble** | Sí · las líneas declaradas van por inmueble. |
| **C · atribuir ámbito** | Sí · lo declarado es por definición deducible. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No · registra el resultado, no el suceso. |
| **F · campo vacío/ausente** | `estado` (`en_curso`/`pendiente`/`declarado`/`prescrito`/`cerrado`) es lo que protege un año ya presentado. Para el matcheo, no se consulta. |

### `personalData`

**keyPath:** `id` (autoIncrement) · **índices:** dni (único) · fechaActualizacion · **registros:** —

Tus datos personales y los de tu unidad familiar.

**Esquema · 29 rutas de campo (anidados incluidos)**

```
id? : number
nombre : string
apellidos : string
dni : string
direccion : string
situacionPersonal : 'soltero' | 'casado' | 'pareja-hecho' | 'divorciado'
situacionLaboral : SituacionLaboral[]
situacionLaboralConyugue? : SituacionLaboral[]
employmentStatus? : EmploymentStatus
maritalStatus? : MaritalStatus
spouseName? : string
housingType? : HousingType
hasVehicle? : boolean
hasChildren? : boolean | number
comunidadAutonoma? : string
descendientes? : Descendiente[]
  descendientes[].id : string
  descendientes[].fechaNacimiento : string
  descendientes[].discapacidad : NivelDiscapacidad
ascendientes? : Ascendiente[]
  ascendientes[].id : string
  ascendientes[].edad : number
  ascendientes[].convive : boolean
  ascendientes[].discapacidad : NivelDiscapacidad
discapacidad? : NivelDiscapacidad
   … (4 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/personalOnboardingService.ts:209`, `src/services/personalOnboardingService.ts:244`

**Leen:** `src/services/__fiscalContextAudit.ts:121`, `src/services/compromisoDetectionService.ts:796`, `src/services/declaracionDistributorService.ts:1557`, `src/services/declaracionOnboardingService.ts:1400`, `src/services/personalOnboardingService.ts:307`

| | |
|---|---|
| **A · identificar línea** | Parcial · tu propio nombre y DNI aparecen en transferencias entre cuentas tuyas. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí · marca la frontera de lo personal. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | El nombre del titular NO se usa para reconocer un traspaso entre cuentas propias, que es un caso muy común. |

### `personalModuleConfig`

**keyPath:** `personalDataId` · **índices:** fechaActualizacion · **registros:** —

Config del módulo personal.

**Esquema · 10 rutas de campo (anidados incluidos)**

```
personalDataId : number
seccionesActivas : { nomina: boolean; autonomo: boolean; pensionesInversiones: boolean; otrosIngresos: boolea
  seccionesActivas.nomina : boolean
  seccionesActivas.autonomo : boolean
  seccionesActivas.pensionesInversiones : boolean
  seccionesActivas.otrosIngresos : boolean
integracionTesoreria : boolean
integracionProyecciones : boolean
integracionFiscalidad : boolean
fechaActualizacion : string
```

**Escriben:** _nadie_

**Leen:** `src/services/__fiscalContextAudit.ts:165`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Parcial. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Sin señal de matcheo. |

### `ingresos`

**keyPath:** `id` (autoIncrement) · **índices:** fechaActualizacion · personalDataId · tipo · **registros:** 4 `[tu dato]`

**Tus ingresos (nóminas, pensiones…). Ojo: el store está tipado como `unknown` en `AtlasHorizonDB`**, así que no hay esquema que auditar desde el tipo.

**Esquema · 0 rutas de campo (anidados incluidos)**

```
```

**Escriben:** `src/services/migrations/v70-nomina-historial.ts:118`, `src/services/treasuryCreationService.ts:176`, `src/services/treasuryCreationService.ts:249`, `src/services/treasuryCreationService.ts:641`, `src/services/treasuryCreationService.ts:70`

**Leen:** `src/modules/mi-plan/services/budgetProjection.ts:244`, `src/services/declaracionOnboardingService.ts:1387`, `src/services/fiscalConciliationService.ts:390`, `src/services/fiscalConciliationService.ts:450`, `src/services/fiscalPaymentsService.ts:185`, `src/services/fiscalSummaryService.ts:400`, `src/services/irpfCalculationService.ts:504`, `src/services/limitesFiscalesPlanesService.ts:70`, `src/services/migrations/v70-nomina-historial.ts:77`, `src/services/treasuryCreationService.ts:244`, `src/services/treasuryCreationService.ts:303`, `src/services/treasuryCreationService.ts:636`

| | |
|---|---|
| **A · identificar línea** | Sí en la práctica · una nómina tiene pagador, importe y día fijos, y es de los cargos más reconocibles. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí · personal. |
| **D · calendario esperado** | Sí · la nómina es mensual y predecible. |
| **E · extraordinarios** | Sí · pagas extra, atrasos, finiquito. |
| **F · campo vacío/ausente** | **El propio tipo:** `ingresos: { value: unknown }`. Sin tipo, ningún consumidor puede leerlo con seguridad y el matcheo no lo intenta. Es un agujero de esquema, no de datos. |

### `planesPensiones`

**keyPath:** `id` · **índices:** estado · personalDataId · tipoAdministrativo · titular · **registros:** —

Planes de pensiones.

**Esquema · 27 rutas de campo (anidados incluidos)**

```
id : string
nombre : string
titular : 'yo' | 'pareja'
personalDataId : number
tipoAdministrativo : TipoAdministrativo
subtipoPPE? : SubtipoPPE
subtipoPPES? : SubtipoPPES
garantizado? : boolean
politicaInversion? : PoliticaInversion
porcentajeRentaVariable? : number
modalidadAportacion? : ModalidadAportacion
gestoraActual : string
isinActual? : string
fechaUltimaValoracion? : string
valorActual? : number
fechaContratacion : string
importeInicial? : number
empresaPagadora? : { cif: string; nombre: string; ingresoIdVinculado?: string; }
  empresaPagadora.cif : string
  empresaPagadora.nombre : string
  empresaPagadora.ingresoIdVinculado? : string
participeConDiscapacidad? : boolean
terOverride? : number
estado : EstadoPlan
fechaCreacion : string
   … (2 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/aeatPlanesPensionesImportService.ts:499`, `src/services/planesPensionesService.ts:117`, `src/services/planesPensionesService.ts:134`, `src/services/planesPensionesService.ts:196`, `src/services/traspasosPlanPensionesService.ts:97`, `src/services/valoracionesService.ts:811`, `src/services/valoracionesService.ts:989`

**Leen:** `src/modules/inmuebles/import/ImportarValoraciones.tsx:211`, `src/modules/inmuebles/import/ImportarValoraciones.tsx:327`, `src/services/inversionesService.ts:325`, `src/services/limitesFiscalesPlanesService.ts:185`, `src/services/limitesFiscalesPlanesService.ts:263`, `src/services/migrations/auditV74_PR6.ts:96`, `src/services/migrations/seedV74_PR4.ts:159`, `src/services/migrations/seedV74_PR4.ts:178`, `src/services/onboardingSyncService.ts:29`, `src/services/personal/nominaAportacionHook.ts:153`, `src/services/personal/nominaAportacionHook.ts:68`, `src/services/planesPensionesService.ts:126`

| | |
|---|---|
| **A · identificar línea** | Parcial · la entidad y la aportación periódica. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí · personal/ahorro. |
| **D · calendario esperado** | Sí · la aportación periódica tiene importe y frecuencia. |
| **E · extraordinarios** | Sí · rescate. |
| **F · campo vacío/ausente** | Falta que se consulte. |

### `aportacionesPlan`

**keyPath:** `id` · **índices:** ejercicioFiscal · ingresoIdNomina · origen · planId · planId+ejercicioFiscal · **registros:** —

Cada aportación a un plan.

**Esquema · 16 rutas de campo (anidados incluidos)**

```
id : string
planId : string
fecha : string
ejercicioFiscal : number
importeTitular : number
importeEmpresa : number
importeConyuge? : number
origen : OrigenAportacion
ingresoIdNomina? : string
movementId? : string
granularidad : GranularidadAportacion
mesesCubiertos? : number
casillaAEAT? : string
notas? : string
fechaCreacion : string
fechaActualizacion : string
```

**Escriben:** `src/services/aeatPlanesPensionesImportService.ts:480`, `src/services/aeatPlanesPensionesImportService.ts:482`, `src/services/aportacionesPlanService.ts:133`, `src/services/aportacionesPlanService.ts:162`, `src/services/aportacionesPlanService.ts:24`, `src/services/indexaCapitalImportService.ts:380`, `src/services/indexaCapitalImportService.ts:387`, `src/services/inversionesAportacionesImportService.ts:534`, `src/services/inversionesAportacionesImportService.ts:674`, `src/services/personal/nominaAportacionHook.ts:100`, `src/services/planesPensionesService.ts:178`

**Leen:** `src/services/aportacionesPlanService.ts:109`, `src/services/aportacionesPlanService.ts:122`, `src/services/aportacionesPlanService.ts:30`, `src/services/aportacionesPlanService.ts:36`, `src/services/indexaCapitalImportService.ts:372`, `src/services/personal/nominaAportacionHook.ts:166`, `src/services/personal/nominaAportacionHook.ts:90`, `src/services/planesPensionesService.ts:175`, `src/services/planesPensionesService.ts:206`

| | |
|---|---|
| **A · identificar línea** | Sí · importe y fecha exactos de cada aportación. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | Sí · es el registro de lo ocurrido y lo previsto. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Match determinista posible y sin usar. |

### `traspasosPlanPensiones`

**keyPath:** `id` (autoIncrement) · **índices:** activoId · fechaEjecucion · planId · **registros:** —

Traspasos entre planes/fondos, fiscalmente neutros.

**Esquema · 25 rutas de campo (anidados incluidos)**

```
id? : number
planId : string
planIdDestino? : string
activoId? : string
tipoActivo? : 'plan_pensiones' | 'fondo_inversion'
fechaSolicitud? : string
fechaEjecucion : string
gestoraOrigen : string
gestoraDestino : string
isinOrigen? : string
isinDestino? : string
valorTraspaso? : number
importeTraspasado : number
esTotal : boolean
aportacionesAcumuladasMomento? : number
cambioTipoAdministrativo? : boolean
tipoAdministrativoOrigen? : TipoAdministrativo
tipoAdministrativoDestino? : TipoAdministrativo
nuevoTipoAdministrativo? : TipoAdministrativo
politicaInversionOrigen? : PoliticaInversion
politicaInversionDestino? : PoliticaInversion
nuevaPoliticaInversion? : PoliticaInversion
notas? : string
fechaCreacion : string
fechaActualizacion : string
```

**Escriben:** `src/services/aeatPlanesPensionesImportService.ts:497`, `src/services/planesPensionesService.ts:185`, `src/services/traspasosPlanPensionesService.ts:194`, `src/services/traspasosPlanPensionesService.ts:71`

**Leen:** `src/services/aeatPlanesPensionesImportService.ts:495`, `src/services/planesPensionesService.ts:182`, `src/services/traspasosPlanPensionesService.ts:122`, `src/services/traspasosPlanPensionesService.ts:164`, `src/services/traspasosPlanPensionesService.ts:186`

| | |
|---|---|
| **A · identificar línea** | Sí · fecha e importe. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | Sí. |
| **E · extraordinarios** | **Sí · un traspaso no es ingreso ni gasto.** Sin esto, un movimiento grande entre entidades parece renta. |
| **F · campo vacío/ausente** | Falta que se consulte. |

### `valoracionesActivos`

**keyPath:** `id` (autoIncrement) · **índices:** idx_activo · idx_activo_fecha · idx_anchor_fiscal · idx_fecha · idx_tipo · idx_tipo_subtipo · **registros:** —

Valoraciones de activos en el tiempo.

**Esquema · 15 rutas de campo (anidados incluidos)**

```
id : number
activoId : string
tipoActivo : TipoActivoValoracion
subtipoInversion? : SubtipoInversion
fecha : string
valor : number
divisaOriginal? : string
valorDivisaOriginal? : number
origen : OrigenValoracion
notas? : string
archivoOrigenId? : number
esAnchorFiscal? : boolean
createdAt : string
updatedAt : string
deletedAt? : string | null
```

**Escriben:** _nadie_

**Leen:** `src/services/migrations/auditV74_PR6.ts:97`, `src/services/migrations/seedV74_PR4.ts:117`, `src/services/migrations/seedV74_PR5.ts:137`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Parcial. |
| **D · calendario esperado** | No · es valor, no flujo. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Sin señal de flujo bancario. |

### `keyval`

**keyPath:** _sin keyPath_ · **índices:** _ninguno_ · **registros:** —

Cajón de sastre: flags de migración, orden de cuentas, cierres de mes, recibos de borrado. **Tipado `unknown`.**

**Esquema · 0 rutas de campo (anidados incluidos)**

```
```

**Escriben:** `src/modules/mi-plan/services/presupuestoAnualService.ts:573`, `src/modules/tesoreria/v6/ordenCuentas.ts:27`, `src/services/accountProfileService.ts:30`, `src/services/cierreDeMes.ts:236`, `src/services/cierreDeMes.ts:270`, `src/services/conceptos/conceptosUsuarioService.ts:80`, `src/services/dashboardService.ts:366`, `src/services/db/post-open.ts:118`, `src/services/db/post-open.ts:148`, `src/services/db/post-open.ts:263`, `src/services/db/post-open.ts:281`, `src/services/db/post-open.ts:298`

**Leen:** `src/modules/mi-plan/services/presupuestoAnualService.ts:562`, `src/modules/tesoreria/v6/ordenCuentas.ts:17`, `src/services/__fiscalContextAudit.ts:274`, `src/services/__keyvalAudit.ts:172`, `src/services/__keyvalAudit.ts:230`, `src/services/accountProfileService.ts:21`, `src/services/cierreDeMes.ts:84`, `src/services/conceptos/conceptosUsuarioService.ts:64`, `src/services/dashboardService.ts:329`, `src/services/db/post-open.ts:133`, `src/services/db/post-open.ts:164`, `src/services/db/post-open.ts:278`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | **Aquí vive `cierresDeMes`**, la clave que decide qué líneas del extracto se apartan como «mes cerrado». Y `cerrarMes` no tiene ni un llamante en toda la app: ver §5. |

### `resultadosEjercicio`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicio · ejercicio-estado · estadoEjercicio · origen · **registros:** —

Resultado fiscal congelado por ejercicio.

**Esquema · 40 rutas de campo (anidados incluidos)**

```
id? : number
ejercicio : number
origen : 'cierre' | 'importacion_manual' | 'mixto'
estadoEjercicio : EstadoEjercicio
fechaGeneracion : string
fechaCierre? : string
fechaPresentacion? : string
moneda : 'EUR'
resumen : { ingresosIntegros: number; gastosDeducibles: number; amortizacion: number; reducciones: n
  resumen.ingresosIntegros : number
  resumen.gastosDeducibles : number
  resumen.amortizacion : number
  resumen.reducciones : number
  resumen.baseImponibleGeneral : number
  resumen.baseImponibleAhorro : number
  resumen.cuotaIntegra : number
  resumen.cuotaLiquida : number
  resumen.deducciones : number
  resumen.retencionesYPagosCuenta : number
  resumen.resultado : number
  resumen.tipoEfectivo : number
arrastres : { generados: Array<{ arrastreId?: number; tipo: TipoArrastre; importe: number; ejercicioCa
  arrastres.generados : Array<{ arrastreId?: number; tipo: TipoArrastre; importe: number; ejercicioCaducidad?: num
    arrastres.generados[].arrastreId? : number
    arrastres.generados[].tipo : TipoArrastre
   … (15 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:31`

**Leen:** _nadie_

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | Parcial. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Fiscalidad · sin señal. |

### `arrastresIRPF`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicioCaducidad · ejercicioOrigen · ejercicioOrigen-tipo · estado · inmuebleId · origen · tipo · **registros:** —

Arrastres de IRPF entre ejercicios.

**Esquema · 15 rutas de campo (anidados incluidos)**

```
id? : number
ejercicioOrigen : number
tipo : TipoArrastre
importeOriginal : number
importePendiente : number
ejercicioCaducidad? : number
inmuebleId? : number
origen? : 'manual' | 'aeat' | 'calculado'
aplicaciones : { // Historial FIFO de consumos ejercicio: number; importe: number; fecha: string; // ISO 
  aplicaciones[].ejercicio : number
  aplicaciones[].importe : number
  aplicaciones[].fecha : string
estado : 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado'
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:40`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:398`

**Leen:** `src/services/compensacionAhorroService.ts:140`, `src/services/compensacionAhorroService.ts:443`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:391`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | Sí · `inmuebleId`. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Fiscalidad · sin señal. |

### `perdidasPatrimonialesAhorro`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicioCaducidad · ejercicioOrigen · estado · **registros:** —

Pérdidas patrimoniales de la base del ahorro.

**Esquema · 14 rutas de campo (anidados incluidos)**

```
id? : number
ejercicioOrigen : number
ejercicioCaducidad : number
importeOriginal : number
importeAplicado : number
importePendiente : number
tipoOrigen : 'crypto' | 'inmueble' | 'importado' | 'manual' | 'mixto'
estado : 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado'
aplicaciones : Array<{ ejercicioDestino: number; importe: number; fecha: string; }>
  aplicaciones[].ejercicioDestino : number
  aplicaciones[].importe : number
  aplicaciones[].fecha : string
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:46`, `src/services/compensacionAhorroService.ts:268`, `src/services/compensacionAhorroService.ts:278`, `src/services/compensacionAhorroService.ts:291`, `src/services/compensacionAhorroService.ts:393`, `src/services/compensacionAhorroService.ts:394`, `src/services/compensacionAhorroService.ts:423`, `src/services/compensacionAhorroService.ts:449`

**Leen:** `src/modules/fiscal/v2/helpers/arrastresVivosService.ts:191`, `src/modules/fiscal/v2/helpers/arrastresVivosService.ts:76`, `src/services/compensacionAhorroService.ts:356`, `src/services/compensacionAhorroService.ts:402`, `src/services/compensacionAhorroService.ts:408`, `src/services/compensacionAhorroService.ts:97`, `src/services/fiscalResolverService.ts:635`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Parcial · una pérdida viene de una venta. |
| **F · campo vacío/ausente** | Sin señal directa. |

### `snapshotsDeclaracion`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicio · fechaSnapshot · origen · **registros:** —

Declaraciones congeladas. **El corte que protege un año ya presentado.**

**Esquema · 16 rutas de campo (anidados incluidos)**

```
id? : number
ejercicio : number
fechaSnapshot : string
datos : { baseGeneral: any; // BaseGeneral completa del motor IRPF baseAhorro: any; // BaseAhorro 
  datos.baseGeneral : any
  datos.baseAhorro : any
  datos.reducciones : any
  datos.minimosPersonales : any
  datos.liquidacion : any
  datos.arrastresGenerados : number[]
  datos.arrastresAplicados : number[]
  datos.declaracionCompleta? : any
casillasAEAT? : Record<string
origen : 'cierre_automatico' | 'importacion_manual'
hash? : string
createdAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:52`

**Leen:** `src/services/declaracionResolverService.ts:19`, `src/services/fiscalResolverService.ts:382`

| | |
|---|---|
| **A · identificar línea** | Parcial · corpus histórico. |
| **B · atribuir inmueble** | Sí. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Su papel en el matcheo es defensivo: impide degradar un año declarado. |

### `entidadesAtribucion`

**keyPath:** `id` (autoIncrement) · **índices:** nif · tipoRenta · **registros:** —

Entidades en atribución de rentas (comunidades de bienes, etc.).

**Esquema · 15 rutas de campo (anidados incluidos)**

```
id? : number
nif : string
nombre : string
tipoEntidad : 'CB' | 'SC' | 'HY' | 'otra'
porcentajeParticipacion : number
tipoRenta : 'capital_inmobiliario' | 'actividad_economica' | 'capital_mobiliario'
ejercicios : EntidadEjercicio[]
  ejercicios[].ejercicio : number
  ejercicios[].rendimientosAtribuidos : number
  ejercicios[].retencionesAtribuidas : number
  ejercicios[].ingresosIntegros? : number
  ejercicios[].gastosDeducibles? : number
  ejercicios[].amortizacion? : number
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:58`, `src/services/entidadAtribucionService.ts:14`, `src/services/entidadAtribucionService.ts:42`, `src/services/entidadAtribucionService.ts:62`, `src/services/entidadAtribucionService.ts:76`

**Leen:** `src/services/entidadAtribucionService.ts:20`, `src/services/entidadAtribucionService.ts:26`, `src/services/entidadAtribucionService.ts:35`, `src/services/entidadAtribucionService.ts:54`

| | |
|---|---|
| **A · identificar línea** | **Sí · `nif` y el nombre.** Un ingreso de una CB se identifica por aquí. |
| **B · atribuir inmueble** | Parcial. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | Sí · repartos. |
| **F · campo vacío/ausente** | Otro catálogo de NIF sin usar, como `proveedores`. |

### `deudasFiscales`

**keyPath:** `id` (autoIncrement) · **índices:** ejercicio · estado · modelo · notificada · **registros:** —

Deudas con la AEAT (modelos 100/303/130/184).

**Esquema · 17 rutas de campo (anidados incluidos)**

```
id? : number
modelo : '100' | '303' | '130' | '184'
ejercicio : number
periodo : '1T' | '2T' | '3T' | '4T' | 'anual'
principal : number
recargoImporte : number
interesesDemora? : number
total : number
estado : 'voluntario' | 'ejecutivo' | 'apremio' | 'embargo' | 'pagada' | 'aplazada'
notificada? : string
ventanaPlazo? : string
claveLiquidacion? : string
documentIds? : number[]
pagadaEl? : string
notas? : string
createdAt : string
updatedAt : string
```

**Escriben:** `src/services/__typeguards__/dbschema-valores.ts:70`, `src/services/deudasFiscalesService.ts:105`, `src/services/deudasFiscalesService.ts:71`, `src/services/deudasFiscalesService.ts:87`

**Leen:** `src/modules/fiscal/v2/acciones/HistoricoDeclaracionesSection.tsx:37`, `src/services/deudasFiscalesService.ts:37`, `src/services/deudasFiscalesService.ts:43`, `src/services/deudasFiscalesService.ts:52`, `src/services/deudasFiscalesService.ts:77`, `src/services/deudasFiscalesService.ts:96`

| | |
|---|---|
| **A · identificar línea** | **Sí · importe y modelo.** Un cargo de la AEAT es de los más reconocibles y hoy cae en «revisar». |
| **B · atribuir inmueble** | Parcial. |
| **C · atribuir ámbito** | Sí. |
| **D · calendario esperado** | Sí · tiene fecha e importe. |
| **E · extraordinarios** | Sí · un pago a Hacienda es extraordinario. |
| **F · campo vacío/ausente** | Falta que se consulte. Con esto, «ADEUDO AEAT 130» deja de ser un misterio. |

### `escenarios`

**keyPath:** `id` · **índices:** _ninguno_ · **registros:** —

Singleton del escenario de libertad financiera (Mi Plan).

**Esquema · 26 rutas de campo (anidados incluidos)**

```
id : number
modoVivienda : ModoVivienda
gastosVidaLibertadMensual : number
estrategia : Estrategia
hitos : Hito[]
  hitos[].id : string
  hitos[].fecha : string
  hitos[].tipo : 'compra' | 'venta' | 'revisionRenta' | 'amortizacionExtraordinaria' | 'cambioGastosVida'
  hitos[].impactoMensual : number
  hitos[].descripcion : string
rentaPasivaObjetivo? : number
patrimonioNetoObjetivo? : number
cajaMinima? : number
dtiMaximo? : number
ltvMaximo? : number
yieldMinimaCartera? : number
tasaAhorroMinima? : number
libertadConfig? : LibertadConfig
  libertadConfig.alcanceRentaPasiva : 'alquiler-neto' | 'alquiler-neto-mas-cupon' | 'alquiler-neto-mas-swr'
  libertadConfig.reglaCruce : 'simple' | 'sostenido' | 'con-margen'
  libertadConfig.mantenimientoMinMeses? : number
  libertadConfig.colchonPctSobreGastos? : number
  libertadConfig.horizonteAnios : number
edadObjetivoRescate? : number
supuestos? : Partial<SupuestosProyeccion>
   … (1 rutas más · fichero completo en el anexo B)
```

**Escriben:** `src/services/escenariosService.ts:119`, `src/services/escenariosService.ts:72`

**Leen:** `src/modules/panel/PanelPage.tsx:195`, `src/services/escenariosService.ts:44`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No · proyecta, no registra. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Herramienta de simulación · sin señal bancaria. |

### `objetivos`

**keyPath:** `id` · **índices:** estado · fondoId · prestamoId · tipo · **registros:** —

Objetivos de Mi Plan (acumular · amortizar · comprar · reducir).

**Esquema · 4 rutas de campo (anidados incluidos)**

```
tipo : 'acumular'
metaCantidad : number
fondoId : string
unidad? : AcumularUnidad
```

**Escriben:** `src/services/fondosService.ts:138`, `src/services/fondosService.ts:150`, `src/services/objetivosService.ts:112`, `src/services/objetivosService.ts:155`, `src/services/objetivosService.ts:210`, `src/services/objetivosService.ts:252`

**Leen:** `src/modules/mi-plan/MiPlanPage.tsx:62`, `src/modules/mi-plan/wizards/WizardNuevoFondo.tsx:117`, `src/modules/mi-plan/wizards/WizardNuevoObjetivo.tsx:108`, `src/services/fondosService.ts:110`, `src/services/fondosService.ts:144`, `src/services/objetivosService.ts:108`, `src/services/objetivosService.ts:172`, `src/services/objetivosService.ts:182`, `src/services/objetivosService.ts:199`, `src/services/objetivosService.ts:260`, `src/services/objetivosService.ts:263`, `src/services/objetivosService.ts:275`

| | |
|---|---|
| **A · identificar línea** | Parcial · un objetivo de amortizar préstamo anticipa un cargo extraordinario. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Parcial. |
| **D · calendario esperado** | No · es intención, no calendario. |
| **E · extraordinarios** | Parcial · explicaría una amortización anticipada si se cumpliera. |
| **F · campo vacío/ausente** | No hay fecha ni importe comprometidos: es una meta, no un plan de pagos. |

### `fondos_ahorro`

**keyPath:** `id` · **índices:** activo · tipo · **registros:** —

Fondos de ahorro con etiqueta de propósito.

**Esquema · 16 rutas de campo (anidados incluidos)**

```
id : string
tipo : FondoTipo
nombre : string
descripcion? : string
cuentasAsignadas : CuentaAsignada[]
  cuentasAsignadas[].cuentaId : number
  cuentasAsignadas[].modo : 'completo'
metaImporte? : number
metaMeses? : number
activo : boolean
createdAt : string
updatedAt : string
objetivoVinculadoId? : string
prioridad? : FondoPrioridad
fechaObjetivo? : string
colchonGastoMensual? : number
```

**Escriben:** `src/services/fondosService.ts:123`, `src/services/fondosService.ts:168`, `src/services/fondosService.ts:233`, `src/services/fondosService.ts:282`, `src/services/objetivosService.ts:120`, `src/services/objetivosService.ts:135`

**Leen:** `src/modules/mi-plan/MiPlanPage.tsx:63`, `src/modules/mi-plan/wizards/WizardNuevoFondo.tsx:116`, `src/modules/mi-plan/wizards/WizardNuevoObjetivo.tsx:105`, `src/modules/mi-plan/wizards/WizardNuevoObjetivo.tsx:436`, `src/services/fondosService.ts:117`, `src/services/fondosService.ts:184`, `src/services/fondosService.ts:192`, `src/services/fondosService.ts:202`, `src/services/fondosService.ts:219`, `src/services/fondosService.ts:55`, `src/services/objetivosService.ts:101`, `src/services/objetivosService.ts:131`

| | |
|---|---|
| **A · identificar línea** | Parcial · un traspaso a un fondo de ahorro es un movimiento entre cuentas propias. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Sí · personal. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | **Sí · explicaría los traspasos a «Ahorros» que hoy caen sin clasificar.** |
| **F · campo vacío/ausente** | Falta el enlace fondo↔cuenta bancaria real, si no lo tiene. |

### `retos`

**keyPath:** `id` · **índices:** estado · mes (único) · tipo · **registros:** —

Retos mensuales de ahorro (1 activo por mes).

**Esquema · 17 rutas de campo (anidados incluidos)**

```
id : string
tipo : RetoTipo
mes : string
titulo : string
descripcion? : string
metaCantidad? : number
metaBinaria? : boolean
estado : RetoEstado
vinculadoA? : { objetivoId?: string; fondoId?: string; prestamoId?: string; categoriaGasto?: string; }
  vinculadoA.objetivoId? : string
  vinculadoA.fondoId? : string
  vinculadoA.prestamoId? : string
  vinculadoA.categoriaGasto? : string
origenSugerencia? : OrigenSugerencia
notasCierre? : string
createdAt : string
updatedAt : string
```

**Escriben:** _nadie_

**Leen:** `src/modules/mi-plan/MiPlanPage.tsx:64`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | Parcial. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Gamificación · sin señal bancaria. |

### `benchmarksReferencia`

**keyPath:** `id` · **índices:** codigo (único) · tipo · ultimaActualizacion · **registros:** —

Índices de referencia (MSCI, S&P, IPC).

**Esquema · 12 rutas de campo (anidados incluidos)**

```
id : string
codigo : string
nombre : string
tipo : TipoBenchmark
divisa : string
descripcion : string
valoresAnuales : Record<number
fuenteUrl? : string
notaInterna? : string
ultimaActualizacion : string | null
fechaCreacion : string
fechaModificacion : string
```

**Escriben:** `src/services/benchmarksReferenciaService.ts:100`, `src/services/benchmarksReferenciaService.ts:144`, `src/services/benchmarksReferenciaService.ts:169`, `src/services/benchmarksReferenciaService.ts:189`, `src/services/benchmarksReferenciaService.ts:195`, `src/services/benchmarksReferenciaService.ts:263`, `src/services/benchmarksReferenciaService.ts:270`

**Leen:** `src/services/benchmarksReferenciaService.ts:119`, `src/services/benchmarksReferenciaService.ts:160`, `src/services/benchmarksReferenciaService.ts:178`, `src/services/benchmarksReferenciaService.ts:260`, `src/services/benchmarksReferenciaService.ts:34`, `src/services/benchmarksReferenciaService.ts:44`, `src/services/benchmarksReferenciaService.ts:51`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Datos de mercado · sin relación con el extracto. |

### `avisosUsuario`

**keyPath:** `avisoId` · **índices:** _ninguno_ · **registros:** —

Qué banners ha cerrado el usuario.

**Esquema · 4 rutas de campo (anidados incluidos)**

```
avisoId : string
fechaCierre : string
ubicacionContexto? : string
etiqueta? : string
```

**Escriben:** `src/services/avisosUsuarioService.ts:29`, `src/services/avisosUsuarioService.ts:51`

**Leen:** `src/services/avisosUsuarioService.ts:41`, `src/services/avisosUsuarioService.ts:63`, `src/services/avisosUsuarioService.ts:77`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | UI pura. |

### `objetivosVitales`

**keyPath:** `id` · **índices:** fechaEstimada · planFinancieroAsociado · tipo · **registros:** —

Hitos vitales (jubilación, salida de empresa).

**Esquema · 8 rutas de campo (anidados incluidos)**

```
id : string
nombre : string
fechaEstimada : string
descripcion? : string
planFinancieroAsociado : string | null
tipo : TipoObjetivoVital
fechaCreacion : string
fechaModificacion : string
```

**Escriben:** `src/services/objetivosVitalesService.ts:137`, `src/services/objetivosVitalesService.ts:143`, `src/services/objetivosVitalesService.ts:92`

**Leen:** `src/services/objetivosVitalesService.ts:111`, `src/services/objetivosVitalesService.ts:33`, `src/services/objetivosVitalesService.ts:40`

| | |
|---|---|
| **A · identificar línea** | No. |
| **B · atribuir inmueble** | No. |
| **C · atribuir ámbito** | No. |
| **D · calendario esperado** | No · fechas estimadas a años vista. |
| **E · extraordinarios** | No. |
| **F · campo vacío/ausente** | Planificación a largo · sin señal de extracto. |

---

# ENTREGABLE 2 · Mapa de señales

**Para resolver X, mirar store Y campo Z.** Ordenado por fiabilidad dentro de cada bloque.
La columna «hoy» dice si el motor lo mira.

## Identificar al proveedor de un cargo

| # | store · campo | por qué manda | hoy |
|---|---|---|---|
| 1 | `compromisosRecurrentes.conceptoBancario` | Es literalmente *«texto que aparece en extracto»*, escrito por el usuario. Ninguna heurística gana a esto | ❌ tapado por `providerName` |
| 2 | `compromisosRecurrentes.cups` / `.numeroContrato` | Identificador único. Si aparece en el concepto, no es parecido: es identidad | ❌ ni llega al evento |
| 3 | `proveedores.nif` + `.nombre` | El NIF en el concepto identifica sin ambigüedad | ❌ nunca leído |
| 4 | `entidadesAtribucion.nif` | Igual, para comunidades de bienes | ❌ |
| 5 | `gastosInmueble.proveedorNombre` (3.504 filas) | El mayor corpus histórico de la base | ❌ |
| 6 | `movementLearningRules.learnKey` | Lo que el usuario ya confirmó. Un dato, no una conjetura | ✅ |
| 7 | `compromisosRecurrentes.proveedor.nombre` | Nombre comercial · `includes` crudo | ✅ (único que se usa) |

## Atribuir inmueble

| # | store · campo | fiabilidad | hoy |
|---|---|---|---|
| 1 | `compromisosRecurrentes.inmuebleId` | Total · lo declaró el usuario | ✅ |
| 2 | `compromisosRecurrentes.reparto[].inmuebleId` + `.porcentaje` | Total · un recibo partido entre varios pisos | ❌ |
| 3 | `contracts.propertyId` | Total | ✅ |
| 4 | `prestamos.inmuebleId` y `destinos[].inmuebleId` | Total | ❌ |
| 5 | `vinculosAccesorio.inmueblePrincipalId` | **Evita imputar al garaje lo que va al piso** | ❌ |
| 6 | `property_sales.propertyId` | Total | ❌ |
| 7 | `properties.alias` / `.address` | Bajo · texto sin normalizar | ❌ |

## Distinguir deducible / personal

| # | store · campo | qué decide | hoy |
|---|---|---|---|
| 1 | `viviendaHabitual` (activa) | **El gasto de tu casa NO es deducible** | ❌ |
| 2 | `explotacionAlquiler.inmuebleId` | Lo no marcado es uso propio | ❌ |
| 3 | `compromisosRecurrentes.ambito` + `.esViviendaHabitual` | Declarado | ✅ parcial |
| 4 | `properties.usoTipo` | Vivienda habitual vs arrendada | ❌ |
| 5 | `movementLearningRules.ambito` | Aprendido | ✅ |

## Reconocer una cuota de préstamo

| # | store · campo | por qué | hoy |
|---|---|---|---|
| 1 | **`prestamos.planPagos.periodos[].fechaCargo` + `.cuota`** | **Match determinista: fecha e importe exactos.** El fichero solo confirma | ❌ |
| 2 | `prestamos.planPagos.periodos[].interes` / `.amortizacion` | Desglose para el asiento fiscal | ❌ |
| 3 | `prestamos.planPagos.periodos[].pagado` / `.fechaPagoReal` | Qué cuotas ya constan · evita duplicar | ❌ |
| 4 | `treasuryEvents` con `sourceType: 'prestamo_cuota'` | De rebote, y solo si alguien generó el previsto | ✅ |

## Reconocer un rendimiento de inversión (con su bruto y retención)

| # | store · campo | por qué | hoy |
|---|---|---|---|
| 1 | **`inversiones.rendimiento.pagos_generados[].importe_neto`** | **El banco ingresa el NETO.** Sin esto no cuadra nunca contra el bruto | ❌ |
| 2 | `…pagos_generados[].importe_bruto` + `.retencion_fiscal` | El desglose fiscal que el extracto no trae | ❌ |
| 3 | `…pagos_generados[].fecha_pago` + `.estado` | Calendario y qué falta cobrar | ❌ |
| 4 | `inversiones.plan_liquidacion` | El ingreso grande del vencimiento | ❌ |

## Reconocer la renta de un inquilino

| # | store · campo | hoy |
|---|---|---|
| 1 | `contracts` · inquilino + renta + día de cobro | ✅ |
| 2 | `contracts.margenGraciaDias` | ✅ (aquí sí se usa) |
| 3 | `movementLearningRules.aliasContraparte` · «BIZUM DE X» = inquilino Y | ✅ |

## Reconocer un traspaso entre cuentas propias

| # | store · campo | hoy |
|---|---|---|
| 1 | `accounts.iban` de todas tus cuentas · el IBAN destino en el concepto | ❌ |
| 2 | `personalData` · tu nombre como ordenante/beneficiario | ❌ |
| 3 | `fondos_ahorro` · destino de los traspasos a «Ahorros» | ❌ |
| 4 | `traspasosPlanPensiones` · traspaso fiscalmente neutro | ❌ |
| 5 | `tarjetas.cuentaLiquidacionId` · el recibo de tarjeta | ❌ |

## Reconocer venta / cancelación / disposición

| # | store · campo | qué explica | hoy |
|---|---|---|---|
| 1 | `property_sales.saleDate` + `.salePrice` | El ingreso grande de la venta | ❌ |
| 2 | `property_sales.loanSettlement.payoffAmount` + `.cancellationFee` | **La cancelación del préstamo · tu caso** | ❌ |
| 3 | `property_sales.saleCosts.*` | Comisión de agencia, plusvalía, notaría | ❌ |
| 4 | `prestamos.liquidacion` / `planDeAmortizaciones` | Amortización anticipada | ❌ |
| 5 | `deudasFiscales` · modelo + importe | El cargo de la AEAT | ❌ |

## Evitar duplicar un gasto ya registrado

| # | store · campo | hoy |
|---|---|---|
| 1 | `gastosInmueble.movimientoId` | ❌ |
| 2 | `gastosInmueble` índice `origen-origenId` (la fila del recurrente) | ⚠️ solo desde #1825 |
| 3 | `gastosInmueble.treasuryEventId` | ⚠️ parcial · es B19 |
| 4 | `mejorasInmueble.movimientoId` / `mueblesInmueble.movimientoId` | ❌ |
| 5 | `importBatches.lineasIgnoradas[]` | ✅ |

---

# ENTREGABLE 3 · Lo que NO existe en ningún store

La única razón admisible para no llegar al 100 %. Ocho huecos reales, separados de los
40 casos de «existe y no se mira».

| # | Qué dato falta | Qué resolvería | Dónde debería vivir |
|---|---|---|---|
| 1 | **El IBAN o los últimos 4 de la contrapartida** de una transferencia | Distinguir un traspaso entre cuentas propias de una transferencia a un tercero. Hoy solo hay texto libre | `Movement.contrapartidaIban` · lo extrae el parser cuando el banco lo da |
| 2 | **El alias/patrón que el usuario reconoce**, distinto del nombre comercial | «CCPP» ↔ «Comunidad de Propietarios». `conceptoBancario` es UN texto; hace falta una lista | `CompromisoRecurrente.aliasBancarios[]` |
| 3 | **La devolución de fianza** con fecha e importe | Un ingreso o pago al terminar un contrato cae en «revisar» | `Contract.fianza.devuelta{fecha, importe}` |
| 4 | **La derrama aprobada** de la comunidad | Un cargo extraordinario de comunidad es indistinguible de un error | Un `CompromisoRecurrente` de pago único, o campo propio en el inmueble |
| 5 | **El puente factura ↔ movimiento** | `documents` tiene OCR con proveedor, NIF, nº factura e importe; `movements` tiene el cargo. Nadie los cruza | `Document.movimientoId` (y su inverso) |
| 6 | **El enlace fondo de ahorro ↔ cuenta bancaria** | Los traspasos a «Ahorros» quedan sin clasificar | `FondoAhorro.cuentaId` |
| 7 | **El tipo de `ingresos`** | El store existe, tiene 4 registros `[tu dato]`, y está declarado `value: unknown`. Sin tipo nadie lo consume: **la nómina, que es el ingreso más predecible del extracto, es invisible** | `AtlasHorizonDB.ingresos.value` |
| 8 | **`pagos_generados` en el tipo del store de inversiones** | El dato SÍ está en los registros reales, pero `PosicionInversion` no lo declara: quien lea el esquema concluirá que no existe | `types/inversiones.ts` debe reflejar la forma real |

Los huecos 7 y 8 son de **esquema**, no de datos: el dato está y el tipo lo niega. Son los
más baratos de cerrar y los que más engañan a quien viene detrás.

---

# ENTREGABLE 4 · Crear recurrentes desde el fichero

## El código YA existe

| pieza | fichero | qué hace |
|---|---|---|
| Detector | `compromisoDetectionService.ts:737` `detectCompromisos()` | Agrupa movimientos por concepto normalizado, infiere patrón, importe y variación, y puntúa confianza |
| Creador | `compromisoCreationService.ts:142` `createCompromisosFromCandidatos()` | Persiste idempotente, con deduplicación contra los existentes |
| Vista previa | `compromisoCreationService.ts:211` `detectAndPreview()` | Detecta y enseña antes de crear |
| Pantalla | `modules/personal/pages/DetectarCompromisosPage.tsx` | Ruta cargada en `App.tsx:206` |
| Onboarding | `onboardingDetectionService.ts:270` | Lo llama en el alta |

`CandidatoCompromiso` ya trae `patronInferido`, `importeInferido`, `variacionInferida`,
`confidence`, `razonesScore`, `avisos` y una `propuesta` completa lista para guardar.

**No hay que construirlo. Hay que llamarlo desde el drawer del extracto**, que es donde el
usuario acaba de meter los datos y donde tiene el contexto en la cabeza.

## Campos que exige un compromiso válido

Obligatorios: `ambito`, `alias`, `tipo`, `proveedor.nombre`, `patron`, `importe`,
`cuentaCargo`, `conceptoBancario`, `metodoPago`, `categoria`, `bolsaPresupuesto`,
`responsable`, `fechaInicio`, `estado`.

| se deduce del fichero | NO se deduce · lo tiene que decir el usuario |
|---|---|
| `conceptoBancario` (el texto del banco, literal) | `inmuebleId` — el banco no sabe de qué piso es |
| `proveedor.nombre` (del concepto) | `ambito` — personal vs inmueble |
| `importe` + `variacion` (de la serie de cargos) | `categoria` — de ella sale la casilla AEAT |
| `patron` + día (de los intervalos) | `bolsaPresupuesto`, `responsable` |
| `cuentaCargo` (la cuenta del extracto) | `cups` / `numeroContrato` |
| `fechaInicio` (el primer cargo visto) | `esViviendaHabitual` |

La columna derecha es exactamente lo que el usuario ya está eligiendo al resolver la línea.
**Detectar el recurrente en ese mismo gesto no le pide nada nuevo**: le pide una vez lo que
hoy le va a pedir doce veces.

## El orden correcto

1. **Primero conectar los stores al matcheo** (entregable 2). Si el motor no acierta, el
   detector propone recurrentes sobre líneas mal clasificadas.
2. **Después arreglar el marcador** (auditoría del 29/8). Sin esto, el acierto no sube
   aunque haya datos.
3. **Y entonces enganchar el detector** al final del import. Es lo más barato de los tres
   y el único que se ve.

Hacerlo al revés da un «wow» que propone basura.

---

# 5 · Dos cosas que aparecieron auditando y no puedo callar

**`cerrarMes` no tiene ni un llamante.** `grep -rn "cerrarMes" src/` sin tests devuelve su
propia definición y un comentario. La clave `cierresDeMes` de `keyval` solo aparece en su
módulo. **No existe forma de cerrar un mes en la app** — y sin embargo el drawer del
extracto aparta 66 de 77 líneas como «de meses cerrados» y `lineasPendientes` las manda a
borrar al Guardar. Hay una contradicción entre lo que el código puede producir y lo que la
pantalla muestra, y destruye movimientos reales del banco.

**El aviso de banco usa un umbral que no existe.** `bankProfileMatcher.match` devuelve el
perfil que más puntúe *sea cual sea su puntuación* (`:76`). El aviso de
`bankStatementOrchestrator.ts:179-183` contradice la cuenta que el usuario eligió **sin
mirar la confianza**, mientras dos líneas más arriba el mismo fichero exige 60 puntos
(`PROFILE_CONFIDENCE_THRESHOLD`) para creerse una detección propia. Para decidir pide 60;
para desautorizar al usuario le vale con 1.

---

# Anexo A · La sonda que falta

Los recuentos y los ejemplos reales necesitan tu base. Esto es solo lectura y saca, por
cada uno de los 46 stores, cuántos registros hay y un ejemplo anonimizado:

```js
(async () => {
  const db = await new Promise(ok => { const r = indexedDB.open('AtlasHorizonDB'); r.onsuccess = () => ok(r.result); });
  const L = [];
  for (const s of [...db.objectStoreNames]) {
    const n = await new Promise(ok => { const r = db.transaction(s,'readonly').objectStore(s).count(); r.onsuccess = () => ok(r.result); });
    L.push(`${String(n).padStart(6)}  ${s}`);
  }
  console.log(L.sort((a,b)=>parseInt(b)-parseInt(a)).join('\n'));
})();
```

Con esa salida se cierran los dos puntos del inventario que hoy van marcados `[tu dato]`, y
se puede distinguir «el campo no existe» de «el campo existe y está vacío» —el punto F— en
los stores donde hoy solo puedo decir qué haría falta para saberlo: `prestamos` (¿tienen
`planPagos` generado?), `inversiones` (¿tienen `pagos_generados`?) y `proveedores` (¿están
los proveedores de los 45 compromisos?).

# Anexo B · Material en bruto

Generado mecánicamente contra el código, no transcrito:

- **2.078 rutas de campo** de los 46 stores, anidados incluidos.
- Escritores y lectores por store.
- Extractor anclado a los ficheros que importa `db.ts` — sin eso se cogen tipos homónimos
  (`types/loans.ts` vs `types/prestamos.ts`) y se concluye que un campo no existe cuando sí.
