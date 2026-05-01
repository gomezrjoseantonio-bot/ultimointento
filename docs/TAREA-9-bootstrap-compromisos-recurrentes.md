# TAREA CC · TAREA 9 · Bootstrap `compromisosRecurrentes` desde histórico · v1

> **Tipo** · 4 sub-tareas (T9.1 · T9.2 · T9.3 · T9.4) · cada una en su PR con STOP-AND-WAIT
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · cada sub-tarea desde `main` actualizado tras la anterior · NO rama madre · NO acumular
>
> **Alcance global** · construir el sistema que detecta patrones de gasto recurrente analizando movements históricos · permite al usuario aprobar/descartar cada candidato · escribe los aprobados en `compromisosRecurrentes` · activa la **vía A del `movementSuggestionService`** que hoy devuelve `[]` por store vacío
>
> **Tiempo estimado total** · 12-18h Copilot · 5-8h revisión Jose
>
> **Prioridad** · MEDIA-ALTA · cierra el bucle T17 (importación bancaria) · cada extracto futuro se sugerirá con vía A precisa en lugar de heurística
>
> **Predecesores cerrados** · T15 ✅ · T14 ✅
>
> **DB** · NO se toca schema · DB_VERSION sigue en 65 · 40 stores · solo se ESCRIBE en el store existente `compromisosRecurrentes` (vacío hoy)
>
> **Tareas congeladas que se descongelan al cerrar T9** · T8 (refactor schemas) · T10 (TODOs T7)

---

## 0 · Reglas inviolables (idénticas T17 / T20 / T15 / T14)

### 0.1 · STOP-AND-WAIT estricto entre sub-tareas
CC implementa una sub-tarea · publica PR · DETIENE EJECUCIÓN · espera revisión Jose en deploy preview · NO empieza la siguiente hasta merge + autorización. NO acumular en rama madre · cada PR contra `main` directo.

### 0.2 · NO inventar
Si CC encuentra ambigüedad · PARAR · comentar PR · esperar input. Si encuentra bug fuera de scope · documentar TODO · seguir.

### 0.3 · Datos del usuario intactos
T9 no migra ningún dato existente · solo CREA registros nuevos en `compromisosRecurrentes` y solo cuando el usuario los aprueba explícitamente.

### 0.4 · Idempotencia
La detección y la creación deben ser idempotentes · re-correr no duplica candidatos ni compromisos. Si Jose ejecuta detección 5 veces · solo aparecen los compromisos nuevos · los ya aprobados se filtran.

### 0.5 · Cero hex hardcoded en archivos nuevos
Tokens v5 obligatorios. UI cumple guía v5.

### 0.6 · Aprovechar lo existente
- Tipo `CompromisoRecurrente` ya está completo en `src/types/compromisosRecurrentes.ts` (199 líneas) · NO redefinir · NO ampliar sin necesidad
- Servicio `compromisosRecurrentesService.ts` (409 líneas) · NO reescribir · ampliar si hace falta
- Vía A del `movementSuggestionService.ts` ya implementada · solo se activa cuando el store tenga contenido · T9 lo provee
- Modelo `PatronRecurrente` (8 variantes) y `ImporteEvento` (4 modos) son la lengua franca · CC los usa tal cual al crear candidatos

---

## 1 · Datos verificados del repo (auditoría inicial Claude)

### 1.1 · Estado actual del subsistema

- **Store `compromisosRecurrentes`** · activo · keyPath `id` autoincrement · vacío en producción Jose
- **Tipo `CompromisoRecurrente`** · 199 líneas en `src/types/compromisosRecurrentes.ts` · cubre 8 patrones de calendario · 4 modos de importe · 4 patrones de variación · 7 tipos de compromiso · 30+ categorías de gasto
- **Servicio `compromisosRecurrentesService`** · 409 líneas · CRUD completo · validación de duplicados · expansión a treasuryEvents
- **Suggestion service vía A** · ya escrita · `loadActiveCompromisos` en línea 113 · `suggestFromCompromiso` en línea 125 · matching por `cuentaCargo + importe ± tolerancia + proveedor en descripción` · scoring base 70 · +10 si céntimo exacto · +10 si proveedor presente
- **UI lectura existente** · `GastosPage.tsx` en `src/modules/personal/pages/` lee compromisos vía `PersonalContext` · `PersonalPage.tsx` los carga al contexto · sin botón crear · sin detección automática

### 1.2 · Restricción importante del modelo

Comentario explícito en `src/types/compromisosRecurrentes.ts:54-57`:

> "la cuota de hipoteca · renta de alquiler · IBI · comunidad y seguro de la vivienda HABITUAL NO existen como tipos válidos. Esos compromisos se derivan automáticamente de `viviendaHabitual` (regla de oro #2)."

T9 debe respetar esto · al detectar candidatos, **excluir patrones que correspondan a vivienda habitual del usuario** (cuya ficha está en store `viviendaHabitual`). Si el usuario tiene vivienda habitual con `referenciaCatastral=X` · cualquier movement con concepto que sugiera comunidad/IBI/hipoteca de esa vivienda NO se propone como candidato · ATLAS los deriva por otra vía.

Igualmente · alquileres/hipotecas/comunidad/IBI/seguros de inmuebles de inversión (store `inmuebles`) tienen su propio flujo · T9 debe filtrar también esos · solo propone candidatos de tipos válidos según `TipoCompromiso` · `suministro` · `suscripcion` · `seguro` (no vivienda habitual ni inmueble) · `cuota` · y los raros `comunidad`/`impuesto`/`otros` solo si NO hay match con vivienda/inmueble.

### 1.3 · Decisiones consolidadas previas

1. **Fuera de scope T9** · creación manual de compromisos vía formulario UI · esa es feature posterior · T9 solo cubre detección desde histórico + revisión + aprobación
2. **Fuera de scope T9** · edición de compromisos existentes · solo CRUD vía servicio si es necesario para idempotencia
3. **Fuera de scope T9** · re-detección automática tras import · CC decidirá en T9.4 si tiene sentido · si sí · sub-tarea futura
4. **Modelo `PatronRecurrente` no se amplía** · si el algoritmo detecta un patrón que no encaja con las 8 variantes existentes · descarta el candidato · NO inventa variante nueva
5. **Vía A ya espera datos** · ningún cambio en `movementSuggestionService` · T9 solo provee compromisos · T9.4 verifica end-to-end

---

## 2 · SUB-TAREA 9.1 · Audit + servicio de detección

### 2.1 · Alcance

Crear servicio que analiza `movements` históricos del usuario y devuelve candidatos a compromiso · NO escribe nada · solo propone. Página DEV para validación visual.

### 2.2 · Auditoría inicial

CC ejecuta y documenta:

1. **¿Cuántos movements hay en producción de Jose?** · estadística básica · total · por cuenta · rango temporal · distribución mensual
2. **¿Qué `viviendaHabitual` activa tiene Jose?** · referencia catastral · datos para excluir patrones relacionados
3. **¿Qué inmuebles de inversión tiene Jose?** · IDs · referencias catastrales · direcciones · datos para excluir patrones relacionados
4. **¿Hay ya algún `compromisoRecurrente` creado?** · si sí · enumerar (servirá para evitar duplicar en 9.2)

Resultado en `docs/AUDIT-T9-bootstrap.md`.

### 2.3 · Servicio nuevo · `src/services/compromisoDetectionService.ts`

#### Tipos públicos

```typescript
export interface CandidatoCompromiso {
  id: string;                              // UUID local · solo para tracking en UI · NO persiste
  
  // Datos derivados del análisis
  conceptoNormalizado: string;             // ej · "MERCADONA SAU" tras normalización
  cuentaCargo: number;                     // accountId
  ocurrencias: Array<{
    movementId: number;
    fecha: string;                          // ISO
    importe: number;                        // siempre positivo · es expense
    descripcionRaw: string;
  }>;
  
  // Patrón inferido
  patronInferido: PatronRecurrente;
  importeInferido: ImporteEvento;
  variacionInferida: PatronVariacion;
  
  // Scoring de confianza
  confidence: number;                      // 0-100
  razonesScore: string[];                  // ej · ['10 ocurrencias', 'mismo día ±2', 'importe estable ±0.5%']
  
  // Propuesta de compromiso (lo que se creará si Jose aprueba)
  propuesta: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;
  
  // Avisos
  avisos: string[];                        // ej · ['posible solapamiento con vivienda habitual']
}

export interface DetectionOptions {
  minOcurrencias?: number;                 // default 3
  maxAntiguedadMeses?: number;             // default 18 · solo movements de últimos N meses
  excluirYaConfirmados?: boolean;          // default true · filtra patrones que ya tienen compromiso vivo
  toleranciaImportePercent?: number;       // default 5
  toleranciaDiaMes?: number;               // default 3 días
}

export interface DetectionReport {
  candidatos: CandidatoCompromiso[];
  estadisticas: {
    movementsAnalizados: number;
    movementsAgrupados: number;            // los que entraron en algún cluster
    movementsDescartados: number;          // los que no encajan en ningún patrón
    clustersTotales: number;               // grupos formados
    candidatosPropuestos: number;          // clusters que pasaron threshold
    candidatosFiltrados: {
      porViviendaHabitual: number;
      porInmuebleInversion: number;
      porCompromisoExistente: number;
      porScoreInsuficiente: number;
    };
  };
  warnings: string[];
}

export async function detectCompromisos(
  options?: DetectionOptions
): Promise<DetectionReport>;
```

#### Algoritmo de detección · 5 fases

**FASE 1 · Carga y normalización**

```typescript
async function fase1_loadAndNormalize(opts) {
  const movements = await db.getAll('movements');
  const cutoff = subMonths(new Date(), opts.maxAntiguedadMeses ?? 18);
  
  // Filtrar · solo gastos (amount < 0) · dentro de rango temporal · no ignorados
  const candidates = movements.filter(m => 
    m.amount < 0 &&
    new Date(m.date) >= cutoff &&
    m.unifiedStatus !== 'ignorado'
  );
  
  // Normalizar concepto · uppercase · trim · strip números · strip caracteres especiales
  return candidates.map(m => ({
    ...m,
    conceptoNormalizado: normalizeDescription(m.description ?? ''),
  }));
}

function normalizeDescription(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/[0-9]+/g, '')                    // quitar números (refs · IDs)
    .replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, ' ')           // dejar solo letras y espacios
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length >= 3)                // descartar palabras cortas (SA · SL · CB)
    .slice(0, 3)                                // primeras 3 palabras significativas
    .join(' ');
}
```

**FASE 2 · Clustering por concepto + cuenta**

```typescript
function fase2_cluster(normalized) {
  const clusters = new Map<string, NormalizedMovement[]>();
  for (const m of normalized) {
    const key = `${m.conceptoNormalizado}|${m.accountId}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(m);
  }
  // Filtrar clusters con < minOcurrencias
  return Array.from(clusters.entries())
    .filter(([_, list]) => list.length >= (opts.minOcurrencias ?? 3));
}
```

**FASE 3 · Inferencia de patrón temporal**

Para cada cluster · analizar fechas:

```typescript
function fase3_inferTemporalPattern(occurrences) {
  // Calcular intervalos entre fechas consecutivas (en días)
  const intervalos = computeIntervals(occurrences.map(o => o.fecha));
  const mediana = median(intervalos);
  const desviacion = stdDev(intervalos);
  
  // Clasificar
  if (mediana >= 28 && mediana <= 32 && desviacion <= 3) {
    // Mensual día fijo
    const dias = occurrences.map(o => new Date(o.fecha).getDate());
    return {
      tipo: 'mensualDiaFijo',
      dia: roundMode(dias),                    // día más frecuente
    };
  }
  if (mediana >= 58 && mediana <= 62 && desviacion <= 4) {
    return { tipo: 'cadaNMeses', cadaNMeses: 2, ... };
  }
  if (mediana >= 88 && mediana <= 95 && desviacion <= 5) {
    return { tipo: 'cadaNMeses', cadaNMeses: 3, ... };
  }
  if (mediana >= 178 && mediana <= 188 && desviacion <= 8) {
    return { tipo: 'cadaNMeses', cadaNMeses: 6, ... };
  }
  if (mediana >= 358 && mediana <= 372 && desviacion <= 12) {
    return { tipo: 'anualMesesConcretos', mesesPago: ..., diaPago: ... };
  }
  // No matchea ningún patrón conocido · descartar candidato
  return null;
}
```

**FASE 4 · Inferencia de importe**

```typescript
function fase4_inferImporte(occurrences) {
  const importes = occurrences.map(o => Math.abs(o.amount));
  const cv = coefficientOfVariation(importes); // stddev / mean
  
  if (cv < 0.005) {
    // Variación < 0.5% · fijo
    return { modo: 'fijo', importe: round(median(importes), 2) };
  }
  if (cv < 0.05) {
    // Variación < 5% · variable suave
    return { modo: 'variable', importeMedio: round(mean(importes), 2) };
  }
  if (cv < 0.20 && hasMonthlyPattern(occurrences)) {
    // Variación alta pero correlacionada con mes (ej · luz · gas)
    return { modo: 'diferenciadoPorMes', importesPorMes: groupByMonth(occurrences) };
  }
  // Variación alta sin patrón · descartar candidato (no es compromiso · es gasto irregular)
  return null;
}
```

**FASE 5 · Filtrado y scoring**

Para cada candidato sobreviviente:

1. **Filtrar por vivienda habitual** · si la `viviendaHabitual` activa de Jose tiene `referenciaCatastral` o `referenciasIBI` · y el concepto contiene tokens relacionados (`COMUNIDAD` · `IBI` · `HIPOTECA` · `BANCO` con coincidencia de cuenta) · DESCARTAR · marcar contador `porViviendaHabitual`
2. **Filtrar por inmuebles de inversión** · análogo · si el concepto sugiere relación con un inmueble del store `inmuebles` (matching por dirección · referencia · CUPS si aplica) · DESCARTAR · marcar contador `porInmuebleInversion`
3. **Filtrar por compromiso existente** · si ya hay un `CompromisoRecurrente` con `cuentaCargo + conceptoBancario` similar · DESCARTAR · marcar contador `porCompromisoExistente`
4. **Calcular scoring**:
   - Base · 50
   - +5 por cada ocurrencia adicional sobre las 3 mínimas (cap +20)
   - +15 si patrón temporal es estable (desviación baja)
   - +10 si importe es fijo (`modo: 'fijo'`)
   - +5 si proveedor reconocido (lista hardcoded de proveedores comunes españoles · IBERDROLA · ENDESA · NATURGY · MOVISTAR · ORANGE · VODAFONE · NETFLIX · SPOTIFY · etc.)
   - Resultado · 50-105 · cap a 100
5. **Filtrar por score** · solo candidatos con `confidence >= 60` se proponen · resto descartado · marcar contador `porScoreInsuficiente`

#### Construcción de la propuesta

Cada candidato sobreviviente genera `CandidatoCompromiso.propuesta` rellenando:

- `ambito` · 'personal' (siempre · T9 no infiere ámbito inmueble · usuario debe ajustar manualmente si aplica)
- `personalDataId` · del único `personalData` activo
- `alias` · derivado del concepto normalizado (ej · `Suministro Iberdrola`)
- `tipo` · inferir desde concepto · matching contra lista de tokens (`IBERDROLA|ENDESA|NATURGY → suministro`, `NETFLIX|SPOTIFY|HBO → suscripcion`, `MAPFRE|ALLIANZ|MUTUA → seguro`, default `otros`)
- `subtipo` · si `tipo='suministro'` · inferir luz/gas/agua/internet/movil
- `proveedor.nombre` · primera palabra significativa del concepto normalizado (UI permite ajustar)
- `patron` · de fase 3
- `importe` · de fase 4
- `variacion` · `{ tipo: 'sinVariacion' }` por defecto · si `cv >= 0.005 && cv < 0.05` poner `{ tipo: 'manual' }`
- `cuentaCargo` · accountId del cluster
- `conceptoBancario` · primera ocurrencia.descripcionRaw (texto exacto extracto)
- `metodoPago` · `'domiciliacion'` por defecto (heurística · refinable manualmente)
- `categoria` · derivada de `tipo` (ej · `tipo='suministro' → categoria='vivienda.suministros'`)
- `bolsaPresupuesto` · derivada de categoría (ej · `vivienda.* → necesidades`)
- `responsable` · `'titular'` por defecto
- `fechaInicio` · fecha de la primera ocurrencia
- `estado` · `'activo'`
- `derivadoDe` · `{ fuente: 'manual', refId: 'T9-detection' }` (NO se marca como bloqueado)

### 2.4 · Tests · `src/services/__tests__/compromisoDetectionService.test.ts`

- Test 1 · 12 movements de IBERDROLA mensuales · 1 candidato · patrón mensualDiaFijo · importe fijo · confidence ≥80
- Test 2 · 4 movements de NETFLIX mensuales pero importe varía 12.99 → 14.99 (subida) · 1 candidato · variacion='manual' · warning sobre cambio de importe
- Test 3 · 12 movements pero solo 2 en últimos 6 meses · descarta por `minOcurrencias=3` no cumplido en ventana
- Test 4 · 6 movements MERCADONA con día e importe muy variables · descarta por importe sin patrón
- Test 5 · 4 movements COMUNIDAD VECINOS con referencia catastral coincide con `viviendaHabitual` · descartado · contador `porViviendaHabitual=1`
- Test 6 · 4 movements de IBI de inmueble inversión · descartado · contador `porInmuebleInversion=1`
- Test 7 · 6 movements GIMNASIO con compromiso existente activo · descartado · `porCompromisoExistente=1`
- Test 8 · 12 movements pero score = 55 (sin proveedor reconocido + variación moderada) · descartado · `porScoreInsuficiente=1`
- Test 9 · idempotente · 2 ejecuciones devuelven mismos candidatos
- Test 10 · 0 movements · report vacío · sin error

### 2.5 · Página DEV · `/dev/compromiso-detection`

Análoga a `/dev/keyval-audit` · DEV-only · invoca `detectCompromisos()` · muestra report:

- Estadísticas globales (movements analizados · clusters · candidatos · descartados por motivo)
- Tabla de candidatos · uno por fila · concepto + cuenta + ocurrencias + patrón inferido + importe inferido + score + razones + avisos
- Botón "Mostrar ocurrencias" expande lista de movements del cluster
- Botón "Mostrar propuesta" muestra el JSON de `CandidatoCompromiso.propuesta`

NO permite aprobar candidatos · solo inspección · la aprobación es 9.3.

### 2.6 · Verificación 9.1

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa con `CI=true`
- [ ] App arranca sin errores
- [ ] 10 tests verdes
- [ ] Página `/dev/compromiso-detection` accesible en DEV · muestra report sobre datos reales del usuario
- [ ] `compromisosRecurrentesService` y `movementSuggestionService` intactos · solo nuevo archivo + página DEV
- [ ] DB_VERSION sigue en 65
- [ ] Cero hex hardcoded en archivos nuevos

### 2.7 · PR 9.1

Título · `feat(compromisos): T9.1 · compromisoDetectionService + audit + DEV showcase`

Descripción · algoritmo de 5 fases · estadísticas del primer run sobre DB real · candidatos detectados con sus scores · TODOs si CC encuentra patrones que no encajan en las 8 variantes de `PatronRecurrente`.

**STOP-AND-WAIT** · Jose abre `/dev/compromiso-detection` · valida en deploy preview que los candidatos detectados tienen sentido · NO arrancar 9.2 hasta merge + autorización.

---

## 3 · SUB-TAREA 9.2 · Servicio de creación + integración con suggestion vía A

### 3.1 · Alcance

Servicio que toma una lista de `CandidatoCompromiso` aprobados y los persiste en `compromisosRecurrentes` · idempotente · valida invariantes del modelo · verifica integración end-to-end con suggestion vía A.

### 3.2 · Servicio nuevo · `src/services/compromisoCreationService.ts`

#### API

```typescript
export interface CreationOptions {
  ajustesPorCandidato?: Map<string, Partial<CompromisoRecurrente>>;
  // Map<candidatoId, overrides> · UI permite editar la propuesta antes de crear
}

export interface CreationResult {
  creados: CompromisoRecurrente[];          // los que entraron al store
  duplicadosOmitidos: string[];              // candidatoIds que coincidían con uno existente
  erroresValidacion: Array<{
    candidatoId: string;
    motivo: string;
  }>;
}

export async function createCompromisosFromCandidatos(
  candidatos: CandidatoCompromiso[],
  options?: CreationOptions
): Promise<CreationResult>;

export async function detectAndPreview(
  options?: DetectionOptions
): Promise<DetectionReport>;  // proxy a detectCompromisos · útil para refresh desde UI
```

#### Lógica

1. Para cada candidato:
   - Aplicar overrides de `ajustesPorCandidato` si existen
   - Validar invariantes del modelo (función ya existe en `compromisosRecurrentesService` · reutilizar)
   - Verificar duplicado · buscar en store `compromisosRecurrentes` por `cuentaCargo + conceptoBancario` similar · si encontrado · skip + añadir a `duplicadosOmitidos`
   - Si pasa · `db.add('compromisosRecurrentes', ...)`
2. Devolver report

### 3.3 · Tests · `src/services/__tests__/compromisoCreationService.test.ts`

- Test 1 · 3 candidatos sin duplicados · 3 creados · 0 omitidos
- Test 2 · 2 candidatos · 1 ya existe en store · 1 creado · 1 omitido
- Test 3 · candidato con override de `alias` · se persiste con el alias modificado
- Test 4 · candidato con override de `categoria` · respetado
- Test 5 · candidato con propuesta inválida (ej · `cuentaCargo=0`) · error de validación · NO crea
- Test 6 · idempotente · 2 ejecuciones con mismos candidatos · 2ª no crea nada · todos omitidos
- Test 7 · creación + lectura via `compromisosRecurrentesService.getActive()` · devuelve los nuevos

### 3.4 · Verificación end-to-end con vía A

CC ejecuta manualmente:
1. Crear 1 compromiso con `createCompromisosFromCandidatos`
2. Llamar `movementSuggestionService.suggestForUnmatched([movementId])` con un movement que matchea ese compromiso
3. Verificar que devuelve sugerencia con `via='compromiso_recurrente'` y `confidence ≥70`

Documentar en PR · esta es la prueba de que la vía A se activa cuando el store tiene contenido.

### 3.5 · Verificación 9.2

- [ ] tsc + build + tests verdes
- [ ] 7 tests verdes
- [ ] Verificación end-to-end documentada · vía A activada
- [ ] DB_VERSION sigue en 65
- [ ] App arranca · página `/dev/compromiso-detection` sigue funcionando

### 3.6 · PR 9.2

Título · `feat(compromisos): T9.2 · creation service + idempotent + vía A activated`

**STOP-AND-WAIT** · Jose valida · NO arrancar 9.3 hasta merge.

---

## 4 · SUB-TAREA 9.3 · UI revisión y aprobación

### 4.1 · Alcance

Pantalla nueva en la app productiva (NO DEV) · permite ejecutar detección · ver candidatos · ajustar campos clave · aprobar/descartar individuales · bulk approve · resultado escrito en `compromisosRecurrentes` vía servicio 9.2.

### 4.2 · Decisión de ubicación UI · CC decide tras leer mockups y código

Antes de implementar, CC lee:
- `docs/audit-inputs/atlas-personal-v3.html` · módulo Personal mockup
- `docs/audit-inputs/atlas-tesoreria-v8.html` · módulo Tesorería mockup
- `docs/audit-inputs/atlas-inmuebles-v3.html` · módulo Inmuebles mockup
- Estado actual de `src/modules/personal/pages/GastosPage.tsx` (lectura existente de compromisos)

Y propone una de estas 3 ubicaciones razonadas:

**Opción A · Sub-página dentro de Personal · `/personal/gastos/detectar-compromisos`**
- Pro · `GastosPage` ya muestra lista de compromisos · añadir botón "Detectar desde histórico" en el header
- Pro · semántica · gastos personales son el ámbito principal de los compromisos
- Contra · oculta para descubrir si el usuario no entra a Personal

**Opción B · Sub-página dentro de Tesorería · `/tesoreria/compromisos-detectar`**
- Pro · Tesorería ya es donde el usuario importa extractos · es el flujo natural · "subo extracto → detecto compromisos"
- Pro · cercano al `BankStatementUploadPage` de T17
- Contra · los compromisos no son de Tesorería estrictamente · son del usuario

**Opción C · Módulo independiente · `/compromisos-recurrentes`**
- Pro · visibilidad explícita · entrada en sidebar
- Contra · más superficie a mantener · sidebar más cargado

CC propone una con justificación basada en mockups. Jose puede pedir cambio en review PR.

### 4.3 · Componente principal · `CompromisoDetectionPage`

Estructura:

**Cabecera** · canónica v5 · icono Lucide `Scan` o `Sparkles` · H1 "Detectar compromisos recurrentes" · subtítulo "ATLAS analiza tus movimientos y propone compromisos · revisa · aprueba · ATLAS los usará para clasificar futuros extractos automáticamente"

**Card 1 · Configuración detección**
- Slider o select · "Mínimo ocurrencias" (default 3 · rango 3-12)
- Select · "Antigüedad analizada" (12m · 18m · 24m · default 18m)
- Botón · "Analizar movimientos"
- Estado · cuántos movements totales tiene · cuántos compromisos ya activos

**Card 2 · Resultados** (aparece tras detección)
- Estadística cabecera · "N candidatos detectados · M descartados · K ya existentes"
- Filtro por tipo · `Todos | Suministros | Suscripciones | Seguros | Cuotas | Otros`
- Lista de candidatos · cada uno como `CardV5`:
  - Header · alias propuesto + score visual (barra) + tipo (pill)
  - Body · proveedor · cuenta · patrón temporal en lenguaje natural ("mensual día 5") · importe (fijo X€ o variable medio Y€)
  - Sub-body expandible · ocurrencias detectadas (lista compacta de fechas + importes)
  - Acciones · checkbox aprobar · botón "Editar" (modal con form para ajustar alias · tipo · categoría · proveedor · responsable) · botón "Descartar"
- Avisos por candidato · si tiene `avisos[]` · mostrar pills warning

**Card 3 · Acciones bulk** (sticky bottom)
- Contador · "{X} de {Y} candidatos seleccionados"
- Botón "Aprobar seleccionados" (gold primary · disabled si X=0)
- Botón "Descartar todos los demás" (ghost)

**Modal · Editar candidato**
- Form con campos · alias · tipo · subtipo · categoria · responsable · `cuentaCargo` · `conceptoBancario` (no editable · es match exacto contra extracto)
- Botón "Guardar cambios"
- Botón "Cancelar"

**Estados de la página**
- Inicial · solo Card 1 · "Aún no has analizado"
- Loading · Card 1 + spinner durante detección
- Detectado · Cards 1+2+3 visibles
- Aprobando · spinner sobre "Aprobar seleccionados" mientras corre `createCompromisosFromCandidatos`
- Completado · toast "X compromisos creados" · refresca lista (los aprobados desaparecen porque ya son `porCompromisoExistente`)
- Vacío · si tras detección 0 candidatos · empty state amable

### 4.4 · Verificación 9.3

- [ ] tsc + build pasa
- [ ] App arranca · ruta nueva accesible
- [ ] Detección funciona · candidatos visibles
- [ ] Aprobar individual · crea 1 registro · toast OK
- [ ] Aprobar bulk N · crea N registros · toast OK
- [ ] Descartar · candidato desaparece de pantalla (no persiste descarte · si vuelve a detectar reaparece · es comportamiento esperado para 9.3 · refinamiento posible en futuro)
- [ ] Editar · modal funciona · cambios persisten al aprobar
- [ ] Cero hex hardcoded · cumple guía v5 · checklist sección 17 pasada
- [ ] Vía A se activa · próxima importación de extracto sugiere con vía A los compromisos creados (verificar manualmente)

### 4.5 · PR 9.3

Título · `feat(compromisos): T9.3 · UI detección + revisión + aprobación`

Descripción · ubicación elegida con justificación · screenshots · checklist v5 · verificación end-to-end vía A.

**STOP-AND-WAIT** · Jose valida en deploy preview · prueba detección con datos reales · aprueba algunos compromisos · verifica que aparecen en `compromisosRecurrentes` (DevTools) · NO arrancar 9.4 hasta merge.

---

## 5 · SUB-TAREA 9.4 · Cierre · integración + docs + decisión re-detección

### 5.1 · Alcance

Última sub-tarea · validación end-to-end · documentación canónica · decisión sobre re-detección periódica.

### 5.2 · Verificación end-to-end documentada

Test integración manual · `docs/T9-end-to-end-verification.md` con escenarios paso a paso:

1. **Detección inicial** · ejecutar detección sobre DB real · documentar candidatos detectados · score esperado
2. **Aprobación selectiva** · aprobar 5 compromisos variados · verificar en DevTools store
3. **Importar extracto nuevo** · subir extracto Sabadell mensual · verificar que vía A aplica matchear contra los 5 compromisos · sugerencias `via='compromiso_recurrente'` aparecen en pantalla T17
4. **Re-detección** · ejecutar detección 2ª vez · candidatos ya aprobados NO aparecen (filtrado por compromiso existente)
5. **Edición pre-aprobación** · cambiar alias y categoría de un candidato · aprobar · verificar en DB que se persiste con cambios

### 5.3 · Decisión re-detección periódica

CC analiza:
- ¿Tiene sentido detección automática post-import? · (a) sí · cada vez que llega extracto nuevo · re-correr detección y mostrar badge "N nuevos compromisos posibles" · (b) no · solo manual desde la UI

Recomendación de CC con razonamiento. Si (a) · documentar como sub-tarea futura T9.5 (no implementar en este PR · solo proponer). Si (b) · cerrar puerta · documento explica por qué.

### 5.4 · Documentación canónica

#### Actualizar `docs/STORES-V60-ACTIVOS.md`
- Sección `compromisosRecurrentes` · marcar como ACTIVO con bootstrap T9 · fuentes de creación · vía DEV detection · vía UI detección · TODO manual creation form post-T9

#### Actualizar JSDoc en `db.ts` si aplica · sección `compromisosRecurrentes`

#### Crear `docs/T9-cierre.md`
- Resumen · algoritmo 5 fases · 3 servicios nuevos (detection · creation · proxy) · 1 página DEV + 1 pantalla productiva · vía A activada
- Métricas · candidatos detectados sobre tu DB · % aprobados por categoría · diff de calidad sugerencias T17 antes/después
- TODOs documentados · creación manual via formulario · re-detección automática (si decisión b) · refinos de algoritmo en futuro · soporte ámbito 'inmueble' en detección

### 5.5 · Verificación 9.4

- [ ] Documento end-to-end publicado
- [ ] STORES-V60-ACTIVOS actualizado
- [ ] T9-cierre.md publicado
- [ ] Decisión re-detección documentada con razonamiento
- [ ] tsc + build pasa
- [ ] DB_VERSION sigue en 65

### 5.6 · PR 9.4

Título · `chore(compromisos): T9.4 · cierre + docs + e2e verification · TAREA 9 ✅`

**Mergear PR · TAREA 9 cerrada formalmente.**

---

## 6 · Criterios de aceptación globales T9

- [ ] 4 sub-tareas mergeadas en orden con stop-and-wait respetado
- [ ] DB_VERSION sigue en 65 · sin cambios de schema
- [ ] 40 stores activos · sin cambios estructurales
- [ ] Servicio detección funcional · 10 tests verdes
- [ ] Servicio creación funcional · 7 tests verdes · idempotente
- [ ] UI productiva accesible · validada checklist v5
- [ ] Vía A del `movementSuggestionService` activada · verificada con datos reales
- [ ] Documentación canónica actualizada · `T9-cierre.md` publicado
- [ ] Datos del usuario intactos · solo se añaden registros nuevos en `compromisosRecurrentes` con aprobación explícita

---

## 7 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Algoritmo detecta falsos positivos · usuario aprueba basura | Media | Score conservador (threshold 60) · review manual obligatoria · NO se crea sin aprobación · idempotente · si crea mal · borrar manualmente y refinar parámetros |
| Algoritmo descarta verdaderos compromisos | Media | Tolerancias configurables vía `DetectionOptions` · UI permite ajustar · 9.4 documenta tunning · refinos posteriores con datos reales |
| Patrón temporal real no encaja en las 8 variantes del modelo | Baja | Spec exige descartar candidato si no matchea · NO inventar variantes · TODO documentado para sub-tarea futura si Jose ve patrón no cubierto |
| Conflicto con `viviendaHabitual` · detecta IBI/comunidad de vivienda habitual | Media | Filtro explícito fase 5 · descarta y contabiliza · página DEV muestra contador para validación |
| Conflicto con inmuebles de inversión · detecta gastos del inmueble | Media | Filtro análogo en fase 5 · matching por dirección · referencia · CUPS · si CC no encuentra heurística clara · documentar TODO · Jose ajusta manualmente tras aprobar |
| UI desbordada con 50+ candidatos | Baja | Filtro por tipo · paginación si lista muy larga · CC añade si necesario |
| Vía A no se activa tras aprobación | Muy baja | T17 ya implementa vía A · solo necesita store no vacío · 9.2 verifica end-to-end |
| Movements históricos insuficientes (< 6 meses) | Media | `minOcurrencias=3` permite detectar con histórico mínimo · si cluster tiene < 3 · descarta · usuario puede importar más extractos y re-correr |

---

## 8 · Lo que esta tarea NO hace

- ❌ NO crea formulario manual de alta de compromiso (feature posterior · puede abrirse como T9.5 si Jose lo pide)
- ❌ NO permite editar compromisos existentes (lectura/modificación general · no scope de bootstrap)
- ❌ NO infiere ámbito 'inmueble' automáticamente · todos los candidatos salen como `ambito='personal'` · usuario ajusta manualmente si aplica
- ❌ NO amplía el modelo `PatronRecurrente` ni `ImporteEvento` · usa los existentes
- ❌ NO toca `viviendaHabitual` ni `inmuebles` · solo lee para filtrar candidatos
- ❌ NO modifica `movementSuggestionService` · vía A ya espera contenido · 9.4 lo verifica
- ❌ NO sube DB_VERSION · NO toca schema
- ❌ NO implementa re-detección automática post-import en este PR · 9.4 decide y documenta

---

## 9 · Después de T9

1. Descongelar **T8** · refactor schemas restantes · activar campos cache T7 sub-1
2. Cuando T8 cierre · descongelar **T10** · cerrar TODOs T7 sub-tareas 3-5
3. Tras los 5 saneamientos cerrados (T15 · T14 · T9 · T8 · T10) · valorar T21 (Phase 4 parte 2 horizon) o features nuevas
4. **Validación pendiente desde T14** · revisar cálculo IRPF post-GAPs cerrados contra declaración real Jose 2024/2025 · bloqueado hoy por bugs UI

---

**Fin de spec T9 v1 · 4 sub-tareas con stop-and-wait estricto · cada una autocontenida · cada una en PR contra `main` directo.**
