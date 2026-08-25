# AUDITORÍA (SOLO LECTURA) · Módulo Contratos · Ciclo de vida

> Fecha: 25 ago 2026 · Rama `claude/new-session-zgfg6q` · HEAD `36ba050` · árbol limpio.
> Auditoría **de solo lectura**: no se ha tocado código ni abierto PR. Este documento es el único entregable.
> Regla: cada afirmación con evidencia `archivo:línea`. Lo que no existe se declara explícitamente con el grep hecho.

---

## A. Versión y esquema

### A1 · `DB_VERSION` real

**`DB_VERSION = 90`** · `src/services/db.ts:57`.

Ni 53 ni 75. El 53 viene de `ATLAS-mapa-stores-VIGENTE.md:3` (25 abril 2026), que está **37 versiones desfasado**. El 75 no corresponde a ningún estado del código actual. El comentario en línea de `db.ts:57` documenta el changelog V78→V90 completo.

- V90 (última): nuevo store `explotacionAlquiler` (`db.ts:97`), migración post-open `migration_v90_explotacion_alquiler_v1`.
- Test de estructura vigente: `src/services/__tests__/db.structure.v79.test.ts:78` (`expect(db.version).toBe(dbModule.DB_VERSION)`).

### A2 · Stores existentes hoy

**46 stores declarados** en `interface AtlasHorizonDB` (`src/services/db.ts:90`–`db.ts:~360`), coincidente con el conteo del comentario de V90 ("46 stores"). Recuento mecánico sobre las claves `^  clave: {` de la interfaz:

| # | Store | Línea (db.ts) | Versión de alta documentada |
|---|---|---|---|
| 1 | `properties` | 91 | pre-V50 (base) |
| 2 | `property_sales` | 92 | pre-V50 |
| 3 | `documents` | 94 | pre-V50 |
| 4 | **`contracts`** | **95** | **pre-V50 (base)** |
| 5 | `botesAnualesSinIdentificar` | 96 | V78 |
| 6 | `explotacionAlquiler` | 97 | **V90** |
| 7 | `aeatCarryForwards` | 100 | H5 |
| 8 | `propertyDays` | 101 | H5 |
| 9 | `proveedores` | 102 | V3.8 |
| 10 | `accounts` | 105 | H8 |
| 11 | `movements` | 106 | H8 |
| 12 | `importBatches` | 107 | H8 |
| 13 | `treasuryEvents` | 108 | H9 |
| 14 | `tarjetas` | 112 | V87 |
| 15 | `movementLearningRules` | 113 | V1.1 |
| 16 | `inversiones` | 115 | V1.3 |
| 17 | `personalData` | ~128 | V1.2 |
| 18 | `personalModuleConfig` | ~139 | V1.2 |
| 19 | `ingresos` | ~157 | V61 |
| 20 | `planesPensiones` | ~162 | V65 |
| 21 | `aportacionesPlan` | ~163 | V65 |
| 22 | `traspasosPlanPensiones` | ~164 | V65 (+ índice `activoId` en V88-físico) |
| 23 | `prestamos` | ~172 | Financiación (+`liquidacion` en V63) |
| 24 | `valoracionesActivos` | ~190 | V74 (rename de `valoraciones_historicas`) |
| 25 | `keyval` | 313 | base |
| 26 | `resultadosEjercicio` | ~318 | V2.9 |
| 27 | `arrastresIRPF` | ~319 | V2.7 |
| 28 | `perdidasPatrimonialesAhorro` | ~320 | V3.4 |
| 29 | `snapshotsDeclaracion` | ~321 | V2.7 |
| 30 | `entidadesAtribucion` | ~322 | V3.4 |
| 31 | `ejerciciosFiscalesCoord` | ~323 | V3.7 |
| 32 | `vinculosAccesorio` | ~324 | V3.9 |
| 33 | `compromisosRecurrentes` | ~326 | V5.3 |
| 34 | `viviendaHabitual` | ~340 | V5.3 |
| 35 | `escenarios` | ~342 | V5.4 |
| 36 | `objetivos` | ~343 | V5.5 |
| 37 | `fondos_ahorro` | ~344 | V5.6 |
| 38 | `retos` | ~345 | V5.7 |
| 39 | `deudasFiscales` | ~346 | V71 |
| 40 | `benchmarksReferencia` | ~347 | V72 |
| 41 | `avisosUsuario` | 350 | V73 |
| 42 | `objetivosVitales` | ~351 | V73 |
| 43 | `gastosInmueble` | ~353 | físico previo · declarado en Fase 0 |
| 44 | `mejorasInmueble` | ~354 | ídem |
| 45 | `baseAmortizableEjercicio` | ~355 | V82 |
| 46 | `mueblesInmueble` | ~356 | ídem |

Creación física: `src/services/db/upgrade-a.ts` (44 `createObjectStore`) + `src/services/db/upgrade-b.ts` (Mi Plan + planes). **Todas las creaciones van bajo guard `contains()` sin gate de `oldVersion`**, así que la "versión de alta" es documental, no aplicada por código.

**Store `rentaMensual`: NO EXISTE.** Eliminado en V62 (`db.ts:99`: `// rentaMensual: ELIMINADO en V62 (sub-tarea 3) — deprecated V5.6 · 0 registros`). Ver sección C.

---

## B. Store `contracts`

### B3 · Interface `Contract` completa

`src/services/db/types-contratos.ts:158-379`. Índice único del store: **`propertyId` (legacy)** — `src/services/db/upgrade-a.ts:48-49`; declarado en `db.ts:95`. Los wizards modernos escriben `inmuebleId`, no `propertyId`, así que `getContractsByProperty` hace `getAll` + filtro en memoria (`src/services/contractService.ts:194-198`).

```ts
export interface Contract {                                   // types-contratos.ts:158
  id?: number;                                                // :159
  // Inmueble / unidad
  inmuebleId: number;                                         // :162
  unidadTipo: 'vivienda' | 'habitacion';                      // :163
  habitacionId?: string;                                      // :164
  // Modalidad
  modalidad: 'habitual' | 'temporada' | 'vacacional';         // :167
  // Inquilino
  inquilino: {                                                // :170
    nombre: string; apellidos: string; dni: string;
    telefono: string; email: string;
    cotitulares?: string[];                                   // :183  (V78 · NIFs adicionales)
  };
  // Fechas
  fechaInicio: string;                                        // :187
  fechaFin: string;                                           // :188  (siempre requerida; +5y auto en habitual)
  // Económico
  rentaMensual: number;                                       // :191
  diaPago: number;                                            // :192
  margenGraciaDias: number;                                   // :193  (default 5)
  // Indexación
  indexacion: 'none' | 'ipc' | 'irav' | 'otros';              // :196
  indexOtros?: { formula: string; frecuencia: string; nota?: string };  // :197-201
  historicoIndexaciones: Array<{                              // :204-209
    fecha: string; indice: string;
    porcentajeAplicado: number; rentaResultante: number }>;
  historicoRentas?: HistoricoRenta[];                         // :219  (absorbe el store rentaMensual)
  // Fianza
  fianzaMeses: number;                                        // :222
  fianzaImporte: number;                                      // :223
  fianzaEstado: 'retenida'|'devuelta_parcial'|'devuelta_total'; // :224
  fechasFianza?: { cobro?: string; devolucion?: string };      // :225-228
  // Cobro
  cuentaCobroId: number;                                      // :231
  // Estado
  estadoContrato: 'activo'|'rescindido'|'finalizado'|'sin_identificar'|'sin_firmar'; // :236
  origenImportacion?: 'rentila' | 'plantilla_atlas';          // :239
  documentoFirmado?: boolean;                                 // :253
  // Documento / firma
  documentoContrato?: { plantilla: 'habitual'|'temporada'|'vacacional'|'habitacion';
    incluirInventario?: boolean; incluirCertificadoEnergetico?: boolean;
    clausulasAdicionales?: string };                          // :256-261
  firma?: { metodo:'digital'|'manual'; proveedor?:'signaturit'|'docusign'|'adobesign'|'otro';
    emails?: string[]; enviarCopiaPropietario?: boolean; emailPropietario?: string;
    estado?: 'borrador'|'preparado'|'enviado'|'firmado'|'rechazado';
    fechaEnvio?: string; fechaFirma?: string };               // :264-273
  // Fiscal (Ley 12/2023)
  reduccion?: { activa: boolean; porcentaje: number;
    motivo?: 'transitorio_pre_2023'|'general_post_2023'|'rehabilitacion'
           |'zona_tensionada_joven'|'zona_tensionada_rebaja' };// :276-280
  ejerciciosFiscales?: Record<number, EjercicioFiscalContrato>;// :283
  fechaFirmaContrato?: string;                                // :286
  zonaTensionada?: boolean;                                   // :287
  rebajaRenta5pct?: boolean;                                  // :288
  inquilinoJoven?: boolean;                                   // :289
  rehabilitacion?: boolean;                                   // :290
  // Rescisión
  rescision?: { fecha: string; motivo: string };              // :293-296
  // T6 · histórico de salida (V76)
  motivoFin?: MotivoFin;                                      // :300  (types-contratos.ts:48-54)
  detalleMotivoFin?: string;                                  // :302
  valoracion?: 1|2|3|4|5;                                     // :304
  volveriaAAlquilar?: VolveriaAAlquilar;                      // :306
  fianzaDevuelta?: number;                                    // :308
  notasCasero?: string;                                       // :310
  fechaCierre?: string;                                       // :312
  // Gestión delegada (V1 · sin bump)
  gestion?: GestionDelegada;                                  // :320  (iface :121-155)
  gestionPadreId?: number;                                    // :327
  // ── LEGACY ───────────────────────────────────────────────
  propertyId?: number;                                        // :330
  scope?: 'full-property' | 'units';                          // :331
  selectedUnits?: string[];                                   // :332
  type?: 'vivienda' | 'habitacion';                           // :333
  startDate?: string; endDate?: string;                       // :336-337
  isIndefinite?: boolean;                                     // :338
  noticePeriodDays?: number;                                  // :339
  monthlyRent?: number; paymentDay?: number;                  // :342-343
  periodicity?: 'monthly';                                    // :344
  rentUpdate?: { type:'none'|'fixed-percentage'|'ipc';
    fixedPercentage?: number; ipcPercentage?: number };       // :347-351
  deposit?: { months: number; amount: number };               // :354-357
  additionalGuarantees?: number;                              // :358
  includedServices?: { electricity?, water?, gas?, internet?,
    cleaning?: boolean; [k:string]: boolean|undefined };      // :361-368
  privateNotes?: string;                                      // :371
  // Documentos + metadata
  documents: number[];                                        // :374
  createdAt: string; updatedAt: string;                       // :377-378
}
```

Tipos auxiliares en el mismo fichero: `HistoricoRenta` (`:29-43`), `MotivoFin` (`:48-54`), `VolveriaAAlquilar` (`:59`), `GestionDelegada` (`:121-155`), `HonorarioAgencia` (`:102-112`), `EjercicioFiscalContrato` (`:5-12`), `BoteAnualSinIdentificar` (`:72-87`).

### B4 · Catálogo del ciclo de vida · existe / no existe

| Bloque del catálogo | ¿Existe? | Dónde / evidencia |
|---|---|---|
| **Partes · arrendatario (inquilino)** | **SÍ** (parcial) | `types-contratos.ts:170-184` — nombre, apellidos, dni, teléfono, email, `cotitulares[]`. |
| **Partes · arrendador** | **NO** | Grep `arrendador` en `services/db/`, `services/contract*.ts`, `modules/inmuebles/wizards/` → **0 hits**. El arrendador es implícito (= el titular de la app, `personalData`). |
| **Partes · avalista / garante** | **NO** | Grep `avalista` → 1 hit y es un **placeholder de UI**: `NuevoContratoWizard.tsx:519` (`{ key: 'aval', label: 'Aval · si lo hay' }`, botón que solo lanza un toast). Grep `garante` → 0 hits. |
| **Partes · empresa (inquilino persona jurídica)** | **NO** para el inquilino | Sí existe la **agencia** como contraparte en gestión delegada (`GestionDelegada.agenciaNif` → `Proveedor`, `types-contratos.ts:123`), pero no hay campo de "inquilino empresa"/CIF. |
| **Tipo de ID (DNI/NIE/pasaporte)** | **NO** | `inquilino.dni: string` es texto plano (`:172`). No hay discriminador de tipo de documento. La UI solo etiqueta "NIF / NIE" (`NuevoContratoWizard.tsx:399`); grep `pasaporte` → 0 hits. |
| **País / nacionalidad** | **NO** | Grep `nacionalidad` → 0 hits en todo `src/`. |
| **Régimen/uso · temporada / habitual / vacacional** | **SÍ** | `Contract.modalidad` (`:167`). |
| **Régimen/uso · turístico** | **PARCIAL** | `modalidad: 'vacacional'` cubre el caso; el vocabulario "turístico" vive en `ExplotacionAlquiler.modo` (`types-inmuebles.ts:243`) y en `Property.fiscalData.contractUse` (`types-inmuebles.ts:80`). Tres vocabularios distintos para lo mismo (ver §H). |
| **Régimen/uso · uso distinto de vivienda (local)** | **NO** | `modalidad` no lo contempla. La UI del paso 5 ofrece una tarjeta "Local comercial" pero es **decorativa** (`NuevoContratoWizard.tsx:610-614`: `onClick` → `showToastV5(... follow-up persistencia)`). |
| **Índice de actualización (IPC / IRAV / fija)** | **SÍ el campo, NO el motor** | Campo `indexacion` (`:196`) + `indexOtros` (`:197-201`) + `historicoIndexaciones` (`:204-209`). Sugerencia automática por fecha: `contractService.ts:19-24` (`suggestIndexation`, corte 2023-05-25). **`historicoIndexaciones` no tiene ningún escritor**: los 6 sitios que lo tocan lo inicializan a `[]` (`contratoWizardPayload.ts:66,102`, `gestionGarantizadaPayload.ts:133`, `anexarSubcontratoPayload.ts:67`, `contractImportCreationService.ts:136`, `declaracionOnboardingService.ts:1024,1188`, `contractService.ts:117`). Ver §E. |
| **Fechas · inicio / fin** | **SÍ** | `:187-188`. Cálculo LAU +5 años: `contractService.ts:27-31` (`calculateHabitualEndDate`) y `:46-52` (`calcularFechaFinLAUImport`, con sentinel indefinido `'2099-12-31'` en `:34`). |
| **Fechas · prórrogas** | **NO como entidad** | No hay campo de prórroga. Lo más cercano: `renovarContrato` (`contractLifecycleService.ts:140`) que simplemente **pisa `fechaFin`** y apenda al histórico de rentas si cambia el importe. No hay traza de "esta es la prórroga n.º 2". |
| **Fechas · preavisos** | **NO** | Grep `preaviso` en `src/` → **0 hits**. Solo existe el legacy muerto `noticePeriodDays?: number` (`:339`), sin escritor ni lector (grep). Grep `desistimiento` → 3 hits, todos en préstamos (`services/prestamos/topesLegales.ts:31,91,93`). |
| **Económico · renta mensual** | **SÍ** | `:191` + histórico `historicoRentas` (`:219`, iface `:29-43`). |
| **Económico · primer mes prorrateo** | **CALCULADO PERO MUERTO** | `contractService.ts:391-444` (`calculateRentPeriodsNew`) prorratea primer y último mes por días. Su único consumidor es `treasuryForecastService.ts:501` dentro de `regenerateRentalsForecast`, que solo se llama desde `regenerateMonthForecast` (`treasuryForecastService.ts:715`) — **y `regenerateMonthForecast` no tiene ningún llamante en todo el repo** (grep en `src/`: 1 hit, la propia definición). El generador vivo (`treasurySyncService.ts:334`) usa `contract.rentaMensual` a pelo, **sin prorrateo**. |
| **Económico · fianza** | **SÍ** | `fianzaMeses` / `fianzaImporte` / `fianzaEstado` / `fechasFianza` (`:222-228`) + `fianzaDevuelta` (`:308`). |
| **Económico · garantía adicional** | **SOLO LEGACY** | `additionalGuarantees?: number` (`:358`). Ningún wizard lo escribe (no aparece en `contratoWizardPayload.ts` ni en `contractImportCreationService.ts`). |
| **Económico · cuenta de cobro** | **SÍ** | `cuentaCobroId: number` (`:231`), obligatoria en el alta (`contratoWizardPayload.ts:49-51`). Sugerencia por inmueble: `ExplotacionAlquiler.cuentaCobroPorDefectoId` (`types-inmuebles.ts:248`). |
| **Económico · suministros incluidos** | **SOLO LEGACY** | `includedServices` (`:361-368`), sin escritor en los flujos actuales. |
| **Objeto · vivienda / habitación** | **SÍ** | `unidadTipo` (`:163`) + `habitacionId` (`:164`). Habitaciones del inmueble en `ExplotacionAlquiler.habitaciones[]` (`types-inmuebles.ts:246`). |
| **Objeto · local / garaje / trastero** | **NO como objeto del contrato** | `unidadTipo` solo admite `'vivienda' \| 'habitacion'`. Un garaje/trastero **con RC propia** se declara como **accesorio** vinculado: `CampoAccesorioContrato.tsx` → `vincularAccesorioDesdeContrato` (`services/vinculoAccesorioService.ts:77`, llamado desde `NuevoContratoWizard.tsx:194`), que escribe el store `vinculosAccesorio`, **no** el contrato. Los anexos sin RC propia viven en `Property.anexos` (`types-inmuebles.ts:~114`), no en el contrato. |
| **Relación con unidad / referencia catastral** | **INDIRECTA** | El contrato apunta a `inmuebleId` (`:162`) y opcionalmente a `habitacionId` (`:164`). **No guarda referencia catastral**; la RC vive en `Property`. La plantilla de import sí acepta "Inmueble (nombre o ref. catastral)" para **resolver** el inmueble (`atlasTemplateParserService.ts:59`), pero no la persiste en el contrato. |

---

## C. Store `rentaMensual` y BUG-07

### C5 · Shape, índices, lectores y escritores

**El store `rentaMensual` NO EXISTE.** Fue eliminado en **V62** y su interfaz `RentaMensual` retirada en "Fase G":

- `src/services/db.ts:99` — `// rentaMensual: ELIMINADO en V62 (sub-tarea 3) — deprecated V5.6 · 0 registros`
- `src/services/db/types-contratos.ts:381-383` — `// NOTE: RentCalendar y RentPayment se retiraron en V4.5; el store 'rentaMensual' se eliminó en V62 (0 registros) y su interfaz 'RentaMensual' en Fase G. El importe vigente vive en 'Contract.rentaMensual' + 'Contract.historicoRentas'.`
- No aparece en `upgrade-a.ts` ni en `upgrade-b.ts` (grep `createObjectStore` → 0 hits para `rentaMensual`).

Lo que hoy se llama `rentaMensual` es **un campo escalar del contrato** (`types-contratos.ts:191`), con histórico embebido en `Contract.historicoRentas[]` (`types-contratos.ts:219`, iface `:29-43`).

**Escritores del campo `rentaMensual` / `historicoRentas`:**
- `contractService.ts:104-131` (`saveContract`) — alta.
- `contractService.ts:133-186` (`updateContract`) — y en `:162-184` **auto-apenda** una entrada `origen:'manual'` a `historicoRentas` si cambia el importe y el llamante no gestiona el histórico él mismo.
- `contractLifecycleService.ts:103-120` (`cambiarRentaContrato`, origen configurable).
- `contractLifecycleService.ts:140-163` (`renovarContrato`, origen `'renegociacion'`).
- Importadores: `contractImportCreationService.ts:131`, `declaracionOnboardingService.ts:1024,1188`, `alquileresV3FixService.ts:121,165`.

**Lectores del campo:**
- Tesorería (previsiones): `treasurySyncService.ts:334`.
- Proyección: `rentasContratosEngine.ts:68` (`contract.rentaMensual ?? 0`).
- Prorrateo (muerto): `contractService.ts:404,410,418`.
- UI: `DrawerFichaContrato.tsx`, `TablaActivos.tsx`, `AccionContratoModal.tsx:52`, `TabProximos.tsx`, `CarteraHero.tsx`, `ResumenCockpitInmueble.tsx`, `PropiedadCards.tsx`.
- Informes/export: `generateCartera.ts`, `generatePatrimonio.ts`, `generateSolvencia.ts`, `herramientas/exporters/mappers.ts`.

**Índices:** ninguno (era un store; ya no existe). El store `contracts` solo tiene el índice legacy `propertyId`.

### C6 · Estado REAL de BUG-07

**BUG-07 está OBSOLETO, no "abierto".** Ya no puede existir: el store del que hablaba se borró en V62, dos años de versiones atrás del documento que lo reporta.

- Lo que decía el doc: `ATLAS-mapa-stores-VIGENTE.md:38` y `:955-963` — *"`rentaMensual` no es consumida por el motor de proyección mensual. La proyección usa `presupuestoLineas` y `treasuryEvents`."*
- **`presupuestoLineas` tampoco existe**: eliminado en **V80** junto con `presupuestos` (`db.ts:109`: *"presupuestos + presupuestoLineas: ELIMINADOS en V80 … sistema de presupuesto persistido retirado · wizard inalcanzable · 0 registros"*).

**Lo que sí ocurre hoy (confirmado con grep):**

1. **Proyección mensual** lee **directamente los contratos**, no `treasuryEvents`:
   `modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts:862-866` carga `contracts`, y `:893` llama a `buildRentaPorMes(...)` de `rentasContratosEngine.ts:57`, que lee `contract.rentaMensual` en `rentasContratosEngine.ts:68`. Ese motor sí modela ciclo de vida a futuro (indexación anual compuesta, renovación al llegar `fechaFin`, vacancia) — `rentasContratosEngine.ts:1-24`.
2. **Tesorería** (previsión de caja del mes) lee `contracts` y **escribe** `treasuryEvents`:
   `treasurySyncService.ts:299` (`getAllContracts`) → `:334` (`contract.rentaMensual`) → `insertEvent` con `sourceType:'contrato'` (`:347`).
3. Son **dos motores independientes** que leen la misma fuente (`contracts`) y no se hablan: la proyección **no** consume los `treasuryEvents` que produce tesorería.

---

## D. `contractService.ts` · superficie completa

`src/services/contractService.ts` (667 líneas). Export por export:

| Símbolo | Línea | Qué hace |
|---|---|---|
| `suggestIndexation(fechaInicio)` | 19 | IPC si < 2023-05-25, IRAV si ≥. |
| `calculateHabitualEndDate(fechaInicio)` | 27 | inicio + 5 años (LAU). |
| `FECHA_FIN_INDEFINIDO` | 34 | `'2099-12-31'` (sentinel de "indefinido"). |
| `calcularFechaFinLAUImport(fechaInicio, hoy?)` | 46 | +5y solo si cae en futuro; si no, sentinel. |
| `calculateDuration(ini, fin)` | 55 | string `"Xm Yd"`. |
| *(privada)* `normaliseDocumentMetadata` | 68 | deriva `documentoContrato.plantilla` de `unidadTipo`/`modalidad`. |
| *(privada)* `normaliseSignatureMetadata` | 82 | defaults de `firma` (método manual, estado borrador…). |
| **`saveContract(contract)`** | **104** | **ALTA.** Defaults (`documents:[]`, `margenGraciaDias:5`, `historicoIndexaciones:[]`, `fianzaEstado:'retenida'`), sintetiza `documentoContrato`+`firma`, `db.add('contracts')` (`:129`). **No toca tesorería, ni `documents`, ni genera rentas.** |
| **`updateContract(id, updates)`** | **133** | **EDICIÓN.** Merge + `db.put` (`:186`). Auto-apenda a `historicoRentas` si cambia `rentaMensual` y el llamante no trae `historicoRentas` (`:162-184`). **No propaga a tesorería.** |
| `getContract(id)` | 189 | `db.get`. |
| `getContractsByProperty(inmuebleId)` | 194 | `getAll` + filtro (el índice es `propertyId`, legacy). |
| `getAllContracts()` | 200 | `getAll` con fallback a `[]`. |
| `deleteContract(id)` | 218 | borrado seco. |
| `DeleteContractCascadeReport` | 223 | tipo del informe de cascada. |
| `previewDeleteContractCascade(id)` | 234 | cuenta `treasuryEvents` afectados. |
| **`deleteContractWithCascade(id)`** | **266** | Transacción única: borra los `treasuryEvents` `predicted` con ese `contratoId`, **conserva** `confirmed`/`executed` desvinculándolos (`delete updated.contratoId`), y borra el contrato. |
| **`rescindContract(id, fecha, motivo)`** | **306** | Fija `fechaFin=fechaRescision`, `estadoContrato='rescindido'`, `rescision{fecha,motivo}`. **No liquida fianza, no genera nada.** |
| `SignatureStatus` | 325 | tipo. |
| `updateSignatureStatus(...)` | 327 | mueve `firma.estado`. |
| `sendContractForSignature(id, emails?)` | 352 | marca `estado:'enviado'` + `fechaEnvio`. **No envía nada** (no hay integración). |
| `markContractAsSigned(id, fechaFirma?)` | 375 | marca `'firmado'`. |
| `RentPeriodNew` | 382 | tipo del período de renta. |
| **`calculateRentPeriodsNew(contract)`** | **391** | **PRORRATEO.** Recorre mes a mes de `fechaInicio` a `fechaFin`; prorratea primer mes si `getDate() > 1` (`:407-416`) y último mes si no acaba en fin de mes (`:418-427`). |
| `calculateRentPeriodsFromContract(contract)` | 447 | wrapper. **Único consumidor: `treasuryForecastService.ts:501` — código muerto (ver §B4).** |
| `getContractStatus(contract)` | 459 | `'active'\|'upcoming'\|'terminated'` por fechas + `estadoContrato`. |
| `validateContract(contract)` | 482 | validaciones de alta (incluye `documentoContrato.plantilla` en `:521`). |
| `validateOccupancy(contract)` | 579 | solapes de ocupación de la unidad. |
| `terminateContract` | 667 | alias de `rescindContract`. |

**`contractLifecycleService.ts`** (163 líneas) — la capa de ciclo de vida real:
- `finalizarContrato(id, opts)` `:36` — fija `fechaFin=fechaCierre`, registra `motivoFin`/`valoracion`/`fianzaDevuelta`/`notasCasero`. Libera la unidad **por fechas**, sin borrar nada (`:31-35`).
- `reactivarContrato(id, opts)` `:69`.
- `cambiarRentaContrato(id, opts)` `:103` — apenda a `historicoRentas` y sincroniza `rentaMensual`.
- `renovarContrato(id, opts)` `:140` — extiende `fechaFin` (+ `'renegociacion'` si cambia renta).

**Ninguna de estas cuatro funciones toca tesorería, documentos ni fiscalidad.** (grep: `contractLifecycleService.ts` no importa nada de `treasury*`).

**Otros servicios de contratos:**
- `contractDraftService.ts` (719 líneas) — normalización de import Rentila/plantilla ATLAS, fuzzy-match de inmueble (`sugerirInmueble` `:306`), detección de duplicados (`:401`), cotitulares (`:140`).
- `contractImportCreationService.ts` (314) — `construirPayload` `:108` crea contratos `estadoContrato:'sin_firmar'`, `cuentaCobroId: 0` (pendiente), `documentoFirmado:false`.
- `contractImportDetectService.ts` (94) — autodetección de formato por cabecera.
- `services/db/types-contratos.ts` (592) — tipos.
- `utils/contractDisplay.ts`, `modules/inmuebles/utils/*` (estado efectivo, estado de cobro, KPIs, análisis).

**Cálculo de actualización de renta (IPC/IRAV): NO EXISTE.** No hay ninguna función que aplique un porcentaje a `rentaMensual` ni que escriba `historicoIndexaciones`. La sugerencia de índice (`suggestIndexation`) solo elige la etiqueta al dar de alta.

---

## E. Infraestructura de eventos / avisos

**Resultado del grep (todo `src/`, excluyendo tests):**

| Término | Hits relevantes |
|---|---|
| `burofax` | **0** |
| `preaviso` | **0** |
| `desistimiento` | 3, todos en préstamos (`services/prestamos/topesLegales.ts:31,91,93`) |
| `cumpleaños` | **0** (los hits de `cumplea*` son `cumpleAscendiente`/`cumpleFamiliaNumerosa` en deducciones autonómicas) |
| `vencimiento` | sin entidad de dominio; solo etiquetas de UI (`vence-30d` en `DrawerFichaContrato.tsx:69`) |
| `recordatorio` | 4 ficheros, **todos mockup**: `NotificacionesPage.tsx`, `PlantillasPage.tsx:71`, `EmailEntrante.tsx`, `services/fiscal/tipos.ts` |
| `notific` | `modules/ajustes/pages/NotificacionesPage.tsx` (mockup) + `services/toastService.tsx` (toasts efímeros) + `services/alertasFiscalesService.ts` |
| `alerta` | `services/alertasFiscalesService.ts` (calendario fiscal AEAT, derivado en runtime), `PuedesEstarTranquilo.tsx`, etc. |
| `evento` | **`treasuryEvents`** es la única entidad de "evento" persistida — y es un evento de DINERO (`types-movimientos.ts:232`), no de ciclo de vida |
| `IPC` / `IRAV` | series de índices oficiales (ver abajo) |
| `actualizacion` | `porcentajeDeActualizacion` en el servicio de índices |

### ¿Hay cola/entidad de eventos o notificaciones?

**NO.** Lo más parecido que existe:

1. **`treasuryEvents`** (`db.ts:108`, iface `types-movimientos.ts:232-...`) — cola de **previsiones de dinero** con `status: 'predicted'|'confirmed'|'executed'` (`:291`), `descartado` (`:303`), `sourceType` de 29 valores (`:239`, incluye `'contrato'` y `'contract'`). Es la única cola persistida orientada a fechas futuras. **No modela avisos, documentos ni acciones contractuales.**
2. **`avisosUsuario`** (`db.ts:350`, `types/avisosUsuario.ts:7-27`) — **NO es una cola de avisos**: solo guarda qué banners ha CERRADO el usuario (`avisoId` + `fechaCierre`). Dueño: `services/avisosUsuarioService.ts`; UI de restauración: `modules/ajustes/pages/AvisosPage.tsx`.
3. **`services/alertasFiscalesService.ts`** — alertas del calendario fiscal AEAT **derivadas en runtime**, no persistidas como entidad.
4. **`modules/ajustes/pages/NotificacionesPage.tsx`** — pantalla completa de preferencias de notificación (email/push/in-app, modo concentración, resumen semanal/diario, horario de silencio) **100 % mockup**: todo es `useState` local (`:9-11`) y el botón "Guardar preferencias" solo hace `showToastV5('Preferencias guardadas', 'success')` (`:25`). No hay store, ni servicio, ni persistencia.

### ¿Hay algún job por fecha?

**NO.** Grep `setInterval|cron|scheduler|requestIdleCallback` en `src/services/` y `src/App.tsx` → 0 hits de scheduler.

El diseño vigente es explícitamente **"estado por fechas, sin job nocturno"**:
- `modules/inmuebles/utils/estadoEfectivoService.ts:1-14` — el estado vigente/próximo/finalizado se **calcula en cada render** desde `fechaInicio`/`fechaFin` (cacheado en un `WeakMap` invalidado al cambiar de día, `:55`). `estadoContrato` persistido **no** decide la pestaña.
- `TabProximos.tsx:1-5` — *"Pasan a Vigentes solos al llegar la fecha de inicio (estado por fechas, sin job nocturno)."*

**Regeneración de previsiones**: sí existe, pero **es imperativa y no la dispara nada de contratos**:
- `services/treasuryBootstrapService.ts:115` (`regenerateForecastsForward`) recorre `horizonteMeses` (default 24, `:33`) llamando a `generateMonthlyForecasts` (`treasurySyncService.ts:156`).
- Sus **únicos llamantes** (grep, sin tests): `modules/personal/pages/GastosPage.tsx:18`, `modules/inmuebles/pages/DetallePage.tsx:156` (al **borrar un gasto**), `services/inversionesTesoreriaSync.ts:30`, `services/onboardingRevealService.ts:11`, y dos componentes de la lista de gastos.
- **Ninguno es un flujo de contratos.** Crear, editar, renovar o finalizar un contrato **no regenera nada** (`NuevoContratoWizard.tsx:135-199` no importa tesorería; `contractLifecycleService.ts` tampoco).
- Contradicción documentada en el propio código: `treasuryBootstrapService.ts:18-22` declara *"Fuera de scope T31: Contratos / alquileres (T31.no)"*, pero la función que invoca (`generateMonthlyForecasts`) **sí** procesa contratos en `treasurySyncService.ts:298-406`.

### Datos oficiales IPC / IRAV: **existen y están descargados**

- `src/services/indices/seriesIndicesService.ts` — `IdSerie = 'euribor-12m' | 'ipc' | 'irav' | 'ipv-segunda-mano'` (`types/seriesIndices.ts:13`).
- `cargarSerie(id)` `:82` — fetch de `/data/indices/{id}.json` con cache en `keyval['serieIndice:{id}']` (`:26,59,69`).
- **`porcentajeDeActualizacion(serie, periodo)` `:132`** — *"El porcentaje que aplicaría a una actualización de renta de ese mes"*: IRAV tal cual (ya es tasa), IPC vía `variacionInteranual` (`:117`).
- Ficheros de datos reales en el repo: `public/data/indices/ipc.json`, `public/data/indices/irav.json` (fuente `INE · API Tempus3`, serie `IRAV001`, `actualizadoEn: 2026-08-22`).
- **Consumidor único hoy**: `services/valoracion/revalorizacionService.ts:12` (y la UI `modules/panel/components/IndicadorOficial.tsx` / `ActualizarValoresModal.tsx:371`). **Ningún contrato lo usa.**

> Conclusión de E: la **pieza de datos** para la actualización de renta ya está hecha y probada. Lo que falta es el **motor que la aplique al contrato** y la cola de eventos que lo dispare.

---

## F. UI de contratos hoy

### F9 · Componentes reales

**Ruta y shell:** `/contratos` monta `InmueblesPage` + `ContratosListPage` (`src/App.tsx:1306`, lazy en `:105`). Alias `/alquileres/*` → `/contratos/*` (`App.tsx:1334`). Redirecciones legacy `inmuebles/contratos` → `/contratos` (`App.tsx:884`).

**Cockpit de alquileres · `modules/inmuebles/pages/ContratosListPage.tsx` (379 líneas)** — 6 pestañas (`:35`): `disponibilidad | vigentes | proximos | historico | analisis | conciliar`, con alias de URLs antiguas (`:45-50`). Lee `properties` y `contracts` del outlet context (`:66`, `InmueblesContext`). Componentes de pestaña:

| Componente | Líneas | Lee |
|---|---|---|
| `ContratosTopHero.tsx` | 79 | contratos (KPIs) |
| `TabDisponibilidad.tsx` | 725 | `properties` + `explotacionAlquiler` + `contracts` |
| `TabActivos.tsx` / `TablaActivos.tsx` | 110 / 220 | `contracts` (agrupa subcontratos por padre) |
| `TabProximos.tsx` | 130 | `contracts` (estado efectivo `proximo`) |
| `TabAnalisis.tsx` | 279 | `contracts` (`analisisContratosService`) |
| `TabPorConciliar.tsx` | 147 | **`botesAnualesSinIdentificar`** (`boteAnualService`) |
| `historico/TabHistorico.tsx` + `DrawerExContrato.tsx` | — | `contracts` finalizados |
| `DrawerConciliarBote.tsx` | 379 | botes ↔ contratos |
| `PanelGestionDelegada.tsx` | 145 | `contracts` con `gestion`/`gestionPadreId` |
| `SembrarOpexModal.tsx` | 228 | `compromisosRecurrentes` |

**Drawer de contrato · `DrawerFichaContrato.tsx` (667 líneas)** — 3 variantes según estado efectivo (`DRAWER_LABEL`, `:80-84`). Lee:
- `contracts` (el contrato),
- **`treasuryEvents`** vía `estadoCobroContratoService` (`:21`) para el estado de cobro,
- muestra `reduccion` (`:168-172`), `indexacion` (`:558`).

Acciones del footer (`accionPrincipalPorEstado`, `:96`): **todas son toasts stub**:
- `:272` → `showToastV5('${accion.label} próximamente · ${accion.toastSuffix}')` — cubre *Renovar*, *Proponer renovación*, ***Reclamar cobro***, *Enviar a firma*, *Reactivar contrato* (`:67-74`, `:96-...`).
- `:400` → `'Descarga PDF próximamente · T3.7'`
- `:574` → `'Generación de anexos próximamente · T3.3'`
- `:588` → `'Subir documento próximamente · T3.7'`

**Acciones que SÍ escriben:** `AccionContratoModal.tsx` (194 líneas) — modos `renovar` / `finalizar`, escribe vía `contractLifecycleService` (`:13-16`). Es el único camino real de cambio de estado desde la UI.

### F10 · ¿El wizard de nuevo contrato está implementado?

**SÍ, está implementado en código** (no es un mockup HTML), pero **los pasos 4 y 5 son decorativos**.

- Selector Paso 0: `modules/inmuebles/wizards/NuevoContrato.tsx` (64 líneas) — "Alquiler directo" vs "Gestión delegada". Ruta `/contratos/nuevo` (`App.tsx:1317-1321`).
- **`NuevoContratoWizard.tsx` (799 líneas)** — 5 pasos (`:113`): `donde` (`:297`) · `inquilino` (`:371`) · `economico` (`:429`) · `documentos` (`:497`) · `firma` (`:578`).
  - Estado local `FormState` de **15 campos** (`contratoWizardHelpers.ts:11-27`).
  - Guardado real: `handleCrearContrato` (`:150-199`) → `construirPayloadCompleto` (`contratoWizardPayload.ts:29`) → `saveContract` (`:186`) → verificación de relectura (`:188`) → `vincularAccesorioDesdeContrato` (`:194`).
  - Borrador: `construirPayloadBorrador` (`contratoWizardPayload.ts:83`) → `estadoContrato:'sin_firmar'`.
  - Edición: `updateContract` con **whitelist de 12 campos** (`:164-179`), que preserva estado/firma/cuenta/margen.
  - **Paso 4 "Documentos" es un mockup**: 4 tarjetas (`dni`, `contrato`, `ingresos`, `aval`) cuyo `onClick` solo lanza `showToastV5('Subir … · sub-tarea follow-up …')` (`:524-528`). Texto explícito en `:501-506`: *"la subida real llega en sub-tarea follow-up"*.
  - **Paso 5 "Plantilla y firma" es un mockup**: 3 tarjetas de plantilla (`lau-vivienda`, `lau-temporada`, `local`) con `onClick` → `showToastV5('Plantilla … · selección registrada (follow-up persistencia)')` (`:615-617`). **La selección no se persiste.** Aviso literal en `:656-660`: *"La generación de PDF y la firma electrónica con FactorID/Docusign llegan en sub-tarea follow-up."*
- `NuevoContratoGestionWizard.tsx` (426 líneas) — rama de gestión delegada, escribe el mismo store vía `saveContract`.
- `AnexarSubcontratoForm.tsx` — subcontratos de inquilino colgando de un padre de gestión (`/contratos/gestion/anexar`).
- **Importador real**: `modules/inmuebles/import/ImportarContratosWizard.tsx` (387 líneas) + `PasoRevision.tsx` — 3 pasos, multi-fichero, autodetección Rentila / plantilla ATLAS. Este sí es funcional de punta a punta.

### ¿Hay render de documento/plantilla en algún sitio?

**NO para contratos.** Ver §I.

---

## G. Enganche con tesorería (disparo por dinero)

### G11 · Flujo real `contracts` → `treasuryEvents` → calendario/proyección

**Hay DOS generadores de rentas, uno vivo y uno muerto.**

**(1) VIVO · `modules/horizon/tesoreria/services/treasurySyncService.ts`**

```
generateMonthlyForecasts(year, month)              treasurySyncService.ts:156
  └─ bloque 3 · CONTRATOS ACTIVOS                              :297-406
       getAllContracts()                                       :299
       planificarGestionMes(...)   (gestión delegada)          :305
       for each contract:
         isContractActiveInMonth(c, year, month)               :107 / :318
         isDuplicate('contrato', contract.id)  → dedupe        :322
         amount = plan.importePorContrato ?? contract.rentaMensual ?? 0   :334
         insertEvent({ type:'income',
                       predictedDate: buildDate(year, month, contract.diaPago ?? 1),  :339,347
                       sourceType:'contrato', sourceId: contract.id,     :347-348
                       counterparty: nombre del inquilino,              :345
                       accountId: resolveAccountId(cuentaCobroId),      :349
                       inmuebleId, unidadInmueble: habitacionId,        :357,:371
                       status:'predicted' })                            :374
  └─ bloque 3b · COMISIÓN AGENCIA (flujo propietario_bruto)     :383-402
```

Disparo: **solo** `treasuryBootstrapService.regenerateForecastsForward()` (`:115`, horizonte 24 meses, `:176`). Llamantes de esa función (grep, sin tests): `GastosPage.tsx:18`, `DetallePage.tsx:156`, `inversionesTesoreriaSync.ts:30`, `onboardingRevealService.ts:11`, `ExpenseRow.tsx`, `RowForm.tsx`. **Ninguno es un flujo de contratos** → dar de alta un contrato hoy **no crea sus cobros previstos** hasta que algo ajeno (borrar un gasto, el onboarding…) fuerce una regeneración.

**(2) MUERTO · `services/treasuryForecastService.ts`**

```
regenerateMonthForecast({year, month})   :715   ← SIN LLAMANTES en todo el repo
  └─ regenerateRentalsForecast(...)      :485
       contracts.filter(estadoContrato==='activo')            :495
       calculateRentPeriodsFromContract(contract)  ← PRORRATEO :501
       key = `contract:${id}:${monthKey}`                      :507
       sourceType:'contract'  (¡singular, distinto del vivo!)  :523
```

Dos diferencias importantes respecto al vivo: **aplica prorrateo** y usa `sourceType:'contract'` en vez de `'contrato'`. Si alguna vez se conectan los dos, **duplicarían rentas** (el dedupe de cada uno usa una clave distinta).

**(3) Consumo aguas abajo · detección de impago**

`modules/inmuebles/utils/estadoCobroContratoService.ts` — **ya implementa exactamente lo que pide la tarea**:
- `esRentaDeContrato(e, contractId)` `:26` — empareja por `contratoId` o por `sourceType ∈ {'contract','contrato'}` + `sourceId` (`:20`, tolera los dos generadores).
- `estaCobrado(e)` `:47` — `status ∈ {'confirmed','executed'}`.
- **`calcularEstadoCobroContrato(contract, events, hoy)` `:73`** — devuelve:
  - `'impago'` · hay una renta vencida **más allá de `contract.margenGraciaDias`** y no cobrada (`:97`),
  - `'pendiente'` · vencida pero dentro del margen (`:98`),
  - `'al_dia'` · todo lo vencido está cobrado,
  - `'sin_datos'` · el contrato no tiene eventos de renta (**no se inventa nada**, `:81`).
- Consumido por `DrawerFichaContrato.tsx:235-245` (chip del hero) y `resumenOperativoContrato.ts`.

**Pero el impago es solo un estado de presentación**: la acción "Reclamar cobro" es un toast (`DrawerFichaContrato.tsx:272`). No hay evento, ni recordatorio, ni escalado.

**(4) Proyección** (`modules/horizon/proyeccion/mensual/`) **NO pasa por `treasuryEvents`**: lee `contracts` directamente (`proyeccionMensualService.ts:862-866,893` → `rentasContratosEngine.ts:57`). Ese motor sí simula indexación anual compuesta, renovación al vencer y vacancia (`rentasContratosEngine.ts:8-23`), con coherencia fiscal vía `contratosSimuladosParaEjercicio` (`:126`).

**Borrado en cascada** (único punto donde contrato y tesorería sí se hablan): `contractService.ts:266-304`.

---

## H. Régimen / uso / reducción · dónde vive

**Hoy el régimen vive en TRES sitios con TRES vocabularios distintos.**

| Nivel | Campo | Valores | Evidencia | Quién lo escribe / lee |
|---|---|---|---|---|
| **CONTRATO** | `Contract.modalidad` | `'habitual' \| 'temporada' \| 'vacacional'` | `types-contratos.ts:167` | Escribe: wizard (`contratoWizardPayload.ts:60`), importador. Lee: fiscal (`irpfCalculationService.ts:329`), tesorería, UI. |
| **CONTRATO** | `Contract.reduccion` + flags | `{activa, porcentaje 0/50/60/70/90, motivo}` + `zonaTensionada`, `rebajaRenta5pct`, `inquilinoJoven`, `rehabilitacion`, `fechaFirmaContrato` | `types-contratos.ts:276-290` | Escribe: **solo importadores** (`contractImportCreationService.ts:139`, `declaracionOnboardingService.ts:1030`). **El wizard NO lo escribe.** Lee: `irpfCalculationService.ts:337`, `DrawerFichaContrato.tsx:168-172`. |
| **INMUEBLE** | `Property.fiscalData.contractUse` | `'vivienda-habitual' \| 'turistico' \| 'otros'` | `types-inmuebles.ts:80` | Escribe: `declaracionOnboardingService.ts:804`. Lee: **solo** `modules/horizon/herramientas/exporters/mappers.ts:178`. |
| **INMUEBLE** | `Property.fiscalData.housingReduction` | `boolean` | `types-inmuebles.ts:81` | Escribe: `declaracionOnboardingService.ts:805`, `reconciliacionService.ts:549`. |
| **INMUEBLE** | `Property.usoTipo` | `'vivienda_habitual'\|'disponible'\|'turistico'\|…` | `types-inmuebles.ts:124` | Marcado **legacy de solo lectura** por V90 (`types-inmuebles.ts:216`). |
| **INMUEBLE** | `Property.fiscalData.isAccessory` / `mainPropertyId` / `accessoryData` | — | `types-inmuebles.ts:82-89` | Coexisten con el store **`vinculosAccesorio`** (V3.9, `db.ts:~324`), que es el mecanismo moderno y temporal (por ejercicio). |
| **EXPLOTACIÓN** | `ExplotacionAlquiler.modo` / `.estado` | `'completo'\|'habitaciones'\|'turistico'` / `'operativo'\|'vacante'\|'en_reforma'` | `types-inmuebles.ts:240-251` | Nuevo en **V90**. Es "cómo se explota el inmueble", no "qué régimen tiene el contrato". |

### ¿Se duplica? ¿Dónde debe vivir?

**El régimen fiscal por contrato YA vive a nivel de CONTRATO y funciona.** `services/irpfCalculationService.ts:328-366` (`calcularPorcentajeReduccionContrato`) resuelve el porcentaje **enteramente desde el contrato**, con esta cascada:
1. `modalidad ∈ {temporada, vacacional, turistico}` → **0 %** (`:332-334`);
2. override explícito `contract.reduccion.activa && porcentaje > 0` → ese % (`:337-339`);
3. fecha de firma (`fechaFirmaContrato ?? firma.fechaFirma ?? fechaInicio ?? startDate`, `:342-345`) contra el corte **2023-05-26** → pre-ley: 60 % si habitual (`:356-358`);
4. post-ley graduado: `zonaTensionada && rebajaRenta5pct` → 90; `zonaTensionada && inquilinoJoven` → 70; `rehabilitacion` → 60; general habitual → 50 (`:361-365`).

**`Property.fiscalData.contractUse` y `housingReduction` son residuos del importador de declaraciones**, con un único lector (un exportador) y ningún consumidor fiscal. **No compiten** con el modelo de contrato — están muertos de facto.

**Recomendación de la auditoría** (a decidir por Jose): el régimen del contrato debe seguir viviendo en `Contract` (`modalidad` + `reduccion` + flags), **y el wizard debe empezar a escribirlo** (hoy solo lo escriben los importadores). `Property.fiscalData.contractUse`/`housingReduction` son candidatos a retirada.

---

## I. Plantillas / generación de documentos

**NO existe motor de render de documentos de contrato. Es todo mockup.**

Grep de `plantilla|template|pdf|docx|render|mapea|placeholder|merge`:

| Hallazgo | Evidencia | Veredicto |
|---|---|---|
| **`modules/ajustes/pages/PlantillasPage.tsx` (179 líneas)** — "Contratos de alquiler" (3 plantillas), "Correos al inquilino" (4: *Recordatorio de pago cordial*, *Aviso revisión IPC*, *Notificación de no renovación*…), "Fórmulas fiscales" (3) | Arrays **hardcodeados** `:40-66`, `:69-96`, `:98-131`. Cada fila: `onClick → showToastV5(`Editar plantilla · …`)` `:34`. Botón "Nueva plantilla" → `showToastV5('Crear nueva plantilla')` `:143` | **100 % mockup**, sin store ni servicio |
| `Contract.documentoContrato.plantilla` | `types-contratos.ts:256-261` | Campo persistido, pero **solo lo sintetiza** `contractService.ts:68-80` derivándolo de `unidadTipo`/`modalidad`. La selección del paso 5 del wizard **no lo escribe** (`NuevoContratoWizard.tsx:615-617` es un toast). |
| Wizard · paso 5 "Plantilla y firma" | `NuevoContratoWizard.tsx:578-671` | Decorativo (§F10) |
| Drawer · "Descarga PDF" / "Generación de anexos" | `DrawerFichaContrato.tsx:400,574` | Toasts `T3.7` / `T3.3` |
| **`jspdf` / `jspdf-autotable` / `pdf-lib` / `pdfjs-dist` / `react-pdf`** en `package.json:27-38` | Usados **solo** en `modules/horizon/informes/generators/*` (9 ficheros: `generateCartera`, `generateFiscal`, `generateTesoreria`, `generatePatrimonio`, `pdfHelpers.ts`…) y en `comparativaService.ts` + OCR de FEIN | **Existe capacidad PDF, no aplicada a contratos** |
| `docx` / `handlebars` / `mustache` | **0** dependencias (`package.json:5-48`) | No hay motor de merge documental |
| `public/templates/*.xlsx` (`plantilla-contratos-atlas.xlsx`, inmuebles, inversiones, préstamos) | 4 ficheros | Son **plantillas de IMPORT Excel**, no de generación de documentos. Parser: `services/atlasTemplateParserService.ts` (columnas en `:59-70`, opcionales en `:77-82`) |
| `services/*TemplateParserService.ts` (inmuebles, préstamos, inversiones, atlas) | — | Todos son **parsers de entrada**, ninguno genera |
| Firma electrónica | `Contract.firma.proveedor: 'signaturit'\|'docusign'\|'adobesign'\|'otro'` (`types-contratos.ts:266`) | Solo metadatos. `sendContractForSignature` (`contractService.ts:352`) **solo cambia el estado**; no hay ninguna llamada de red a ningún proveedor (grep `signaturit`/`docusign` → solo el tipo). |

---

## J. Preferencias de la app

**No existe un store ni un servicio de "preferencias de la aplicación".** La configuración está repartida en tres sitios:

1. **`keyval`** (`db.ts:313`) — store genérico con **catálogo canónico documentado y cerrado** en `db.ts:~205-312`. Claves vivas autorizadas hoy:
   - `'matchingConfig'` (dueño `budgetMatchingService`),
   - `'dashboardConfiguration'` (dueño `DashboardService`, `dashboardService.ts:329,366`),
   - `'base-assumptions'` (proyección),
   - flags de migración D1 (`migration_*`, `cleanup_*`),
   - + `serieIndice:{id}` (cache de índices, `seriesIndicesService.ts:26`), `accountProfile` (`accountProfileService.ts:21,30`), `cierreDeMes` (`cierreDeMes.ts:84,236`), `conceptosUsuario` (`conceptosUsuarioService.ts:25`, con nota explícita de *"un store propio pediría subir DB_VERSION para nada"*), `financialValues` (`financialValuesService.ts:29,39`).
   - **Hay un protocolo escrito para añadir claves** (`db.ts:~287-302`: 4 pasos) y una lista de **claves PROHIBIDAS** (`db.ts:~265-285`).
2. **`personalData` / `personalModuleConfig`** (`db.ts:~128,~139`) — perfil fiscal del titular y flags de secciones activas. No es configuración de app.
3. **`localStorage`** — solo flags de migración one-shot, explícitamente **fuera** de `keyval` (`db.ts:~302-312`): `atlas_account_migration_version`, `atlas_iban_backfill_version`, `atlas_migration_gastos_v1`, etc.

**Pantallas de Ajustes** (`modules/ajustes/pages/`): 12 páginas. Persisten de verdad: `AvisosPage` (store `avisosUsuario`), `ConceptosPage` (keyval), `PerfilFiscalPage`/`PerfilPage` (`personalData`), `CopiaSeguridad` (`db/snapshot.ts`), `DatosPage` (borrado). **Son mockup sin persistencia**: `NotificacionesPage`, `PlantillasPage`, y parcialmente `IntegracionesPage`.

**Para los "modos de automatización por tipo de evento" que pide el proyecto: no hay dónde guardarlos hoy.** Las dos opciones limpias son (a) una clave nueva en `keyval` siguiendo el protocolo de `db.ts:~287-302`, o (b) un store dedicado con bump de `DB_VERSION` — que es lo que el propio comentario de `conceptosUsuarioService.ts:25` desaconseja para configuración pequeña.

---

# RESUMEN

## 1 · Tabla "campo del catálogo → existe / no existe / dónde"

| Campo del catálogo | Estado | Dónde vive hoy |
|---|---|---|
| Arrendatario (nombre, apellidos, DNI, tel, email) | ✅ | `Contract.inquilino` · `types-contratos.ts:170-184` |
| Cotitulares (N NIFs) | ✅ | `Contract.inquilino.cotitulares[]` · `:183` |
| Arrendador | ❌ | — (implícito = `personalData`) |
| Avalista / garante | ❌ | solo un botón-toast · `NuevoContratoWizard.tsx:519` |
| Inquilino persona jurídica (CIF) | ❌ | — (sí existe agencia: `GestionDelegada.agenciaNif` `:123`) |
| Tipo de documento (DNI/NIE/pasaporte) | ❌ | `dni: string` plano · `:172` |
| País / nacionalidad | ❌ | 0 hits en `src/` |
| Modalidad habitual / temporada / vacacional | ✅ | `Contract.modalidad` · `:167` |
| Uso turístico | ⚠️ triple vocabulario | `modalidad:'vacacional'` · `ExplotacionAlquiler.modo:'turistico'` · `fiscalData.contractUse:'turistico'` |
| Uso distinto de vivienda (local) | ❌ | tarjeta decorativa · `NuevoContratoWizard.tsx:610` |
| Índice IPC / IRAV / fija | ✅ campo · ❌ motor | `Contract.indexacion` `:196` · `suggestIndexation` `contractService.ts:19` |
| Histórico de indexaciones | ⚠️ campo sin escritor | `Contract.historicoIndexaciones` `:204` — 8 sitios lo inicializan a `[]`, ninguno lo llena |
| Datos oficiales IPC / IRAV | ✅ | `services/indices/seriesIndicesService.ts:132` + `public/data/indices/{ipc,irav}.json` |
| Fecha inicio / fin | ✅ | `:187-188` · `calculateHabitualEndDate` `contractService.ts:27` |
| Prórrogas | ❌ como entidad | `renovarContrato` pisa `fechaFin` · `contractLifecycleService.ts:140` |
| Preavisos | ❌ | 0 hits · legacy muerto `noticePeriodDays` `:339` |
| Renta mensual | ✅ | `Contract.rentaMensual` `:191` |
| Histórico de rentas | ✅ | `Contract.historicoRentas[]` `:219` (absorbió el store V62) |
| Primer mes prorrateado | ⚠️ calculado pero muerto | `calculateRentPeriodsNew` `contractService.ts:391` → único consumidor sin llamantes |
| Fianza (meses, importe, estado, fechas) | ✅ | `:222-228`, `fianzaDevuelta` `:308` |
| Garantía adicional | ⚠️ solo legacy | `additionalGuarantees` `:358`, sin escritor |
| Cuenta de cobro | ✅ | `cuentaCobroId` `:231` · default por inmueble `ExplotacionAlquiler.cuentaCobroPorDefectoId` |
| Suministros incluidos | ⚠️ solo legacy | `includedServices` `:361-368`, sin escritor |
| Objeto vivienda / habitación | ✅ | `unidadTipo` `:163` + `habitacionId` `:164` |
| Objeto local / garaje / trastero | ❌ | accesorio vía store `vinculosAccesorio` (`vinculoAccesorioService.ts:77`), no en el contrato |
| Referencia catastral en el contrato | ❌ | solo `inmuebleId`; la RC vive en `Property` |
| Reducción fiscal por contrato | ✅ | `Contract.reduccion` + flags `:276-290` · motor `irpfCalculationService.ts:328` |
| Estado del contrato | ✅ (doble) | persistido `estadoContrato` `:236` + **efectivo por fechas** `estadoEfectivoService.ts` |
| Motivo de fin / valoración inquilino | ✅ | T6 `:300-312` |
| Rescisión | ✅ básico | `Contract.rescision` `:293` · `rescindContract` `contractService.ts:306` |
| Documento firmado (flag) | ✅ | `documentoFirmado` `:253` |
| Plantilla de contrato | ⚠️ campo sintetizado | `documentoContrato.plantilla` `:256`, derivado, no elegido |
| Firma electrónica | ⚠️ solo metadatos | `Contract.firma` `:264-273`, sin integración real |
| Gestión delegada / agencia | ✅ | `Contract.gestion` `:320` + `gestionPadreId` `:327` |

## 2 · Qué falta para el ciclo de vida

**Alta**
- El wizard **no escribe** el bloque fiscal (`reduccion`, `zonaTensionada`, `inquilinoJoven`, `rehabilitacion`, `fechaFirmaContrato`) — hoy solo lo escriben los importadores.
- Faltan partes (arrendador explícito, avalista, inquilino-empresa) y tipado de documento de identidad.
- Falta objeto ≠ vivienda/habitación (local, garaje/trastero como objeto principal).
- **El alta no dispara nada**: ni previsiones de cobro, ni documento, ni tesorería (`NuevoContratoWizard.tsx:150-199`).

**Vigencia · actualización de renta**
- Existe el **dato** (IPC/IRAV descargados, `porcentajeDeActualizacion` probado) y existe el **contenedor** (`historicoIndexaciones`, `historicoRentas`, `cambiarRentaContrato`).
- Falta la **bisagra**: una función que, dado un contrato y una fecha de aniversario, lea la serie, calcule el %, escriba `historicoIndexaciones` + `historicoRentas` y regenere las previsiones futuras. Hoy `historicoIndexaciones` no tiene escritor.
- Falta el **disparador por fecha** (aniversario de `fechaInicio`) — no hay job ni cola.

**Incidencia · impago**
- La **detección ya está hecha y es correcta** (`estadoCobroContratoService.ts:73`, con margen de gracia por contrato).
- Falta todo lo que va después: no hay entidad de aviso/recordatorio, no hay `burofax` (0 hits), no hay plantillas de correo reales (`PlantillasPage.tsx` es hardcode), no hay escalado. La acción "Reclamar cobro" es un toast (`DrawerFichaContrato.tsx:272`).

**Baja · rescisión / liquidación**
- `finalizarContrato` / `rescindContract` cierran el contrato por fechas y guardan motivo.
- Falta la **liquidación**: devolución de fianza (`fianzaDevuelta` existe como campo pero ningún flujo lo calcula ni genera el movimiento), prorrateo del último mes (calculado en código muerto), cierre/descarte de las previsiones futuras (solo ocurre en el **borrado**, `contractService.ts:266`, no en la finalización), y liquidación de suministros.
- Falta **preaviso y no renovación**: 0 hits de `preaviso` en todo `src/`.

**Transversal · lo que no existe y hace falta para el motor de eventos**
1. **Una entidad/cola de eventos de ciclo de vida**. `treasuryEvents` es de dinero; `avisosUsuario` es "banners cerrados". No hay tercera cosa.
2. **Un disparador por fecha**. El diseño actual es deliberadamente "estado por fechas, sin job" (`estadoEfectivoService.ts:1-14`) — sirve para pintar pestañas, no para *hacer* algo el día 3 de retraso.
3. **Un motor de render documental**. Hay `jspdf`/`pdf-lib` en el proyecto y `informes/generators/*` demuestra que funciona, pero nada de eso llega a contratos.
4. **Un sitio donde guardar las preferencias de automatización por tipo de evento** (§J).
5. **Recalcular previsiones al cambiar un contrato**. Hoy crear/renovar/finalizar no llama a `regenerateForecastsForward` (grep: sus 6 llamantes son todos de gastos/inversiones/onboarding).

## 3 · Discrepancias con los docs internos

| # | Doc interno dice | Realidad en código | Evidencia |
|---|---|---|---|
| 1 | `DB_VERSION = 53` · 56 stores | **`DB_VERSION = 90` · 46 stores** | `ATLAS-mapa-stores-VIGENTE.md:3,19` vs `db.ts:57` + recuento de la interfaz `db.ts:90-356` |
| 2 | Existe el store **`rentaMensual`** (Store 14) | **Eliminado en V62** · sustituido por `Contract.rentaMensual` + `Contract.historicoRentas[]` | `ATLAS-mapa-stores-VIGENTE.md:326` vs `db.ts:99` + `types-contratos.ts:381-383` |
| 3 | **BUG-07 ABIERTO**: la proyección usa `presupuestoLineas` y `treasuryEvents` en vez de `rentaMensual` | **Obsoleto por partida doble**: el store `rentaMensual` no existe (V62) **y** `presupuestoLineas`/`presupuestos` tampoco (V80). La proyección lee `contracts` directamente | `ATLAS-mapa-stores-VIGENTE.md:38,955-963` vs `db.ts:99`, `db.ts:109`, `proyeccionMensualService.ts:862-866,893` |
| 4 | `Contract` = "id, propertyId, tenantName, tenantDNI, rentaMensual, startDate, endDate, estado, fianza, depositDays, contractType, incrementoAnual" | Ninguno de esos nombres existe hoy salvo los legacy. El modelo real es `inmuebleId`/`inquilino{}`/`modalidad`/`estadoContrato`/`indexacion` | `ATLAS-mapa-stores-VIGENTE.md:319` vs `types-contratos.ts:158-379` |
| 5 | `importSnapshot` solo restaura 3 stores de 56 | Debe re-verificarse contra `services/db/snapshot.ts` (445 líneas, reescrito desde entonces) — **no auditado en esta pasada** | `ATLAS-mapa-stores-VIGENTE.md:42,1175` |
| 6 | Store `opexRules` con dual-write abierto | **Eliminado en V62** (`// opexRules: ELIMINADO en V62 … ya migrado a compromisosRecurrentes`) | `db.ts:~316` |
| 7 | `docs/AUDITORIA-NUEVO-CONTRATO-actual.md:11` dice `DB_VERSION = 89` | Ahora **90** (V90 subió con `explotacionAlquiler`). El resto de ese doc (19 ago 2026) **sigue siendo exacto** y es la mejor referencia previa del wizard | `AUDITORIA-NUEVO-CONTRATO-actual.md:11` vs `db.ts:57` |
| 8 | `treasuryBootstrapService.ts:18-22` declara *"Fuera de scope T31: Contratos / alquileres"* | La función que invoca (`generateMonthlyForecasts`) **sí** procesa contratos | `treasuryBootstrapService.ts:18-22` vs `treasurySyncService.ts:298-406` |

### Contradicciones internas del propio código (no de los docs)

- **Dos `sourceType` para lo mismo**: `'contrato'` (generador vivo, `treasurySyncService.ts:347`) y `'contract'` (generador muerto, `treasuryForecastService.ts:523`). El lector de impago tolera ambos (`estadoCobroContratoService.ts:20`), pero si se activasen los dos generadores se duplicarían las rentas (claves de dedupe distintas: `'contrato':id:mes` vs `contract:id:mes`).
- **Código muerto con lógica valiosa**: `regenerateMonthForecast` / `regenerateRentalsForecast` / `calculateRentPeriodsNew` — el **único prorrateo del repo** vive ahí y no lo ejecuta nadie.
- **El índice del store `contracts` es `propertyId`** (legacy) mientras los wizards escriben `inmuebleId` → todas las consultas por inmueble son `getAll` + filtro (`contractService.ts:194-198`).
