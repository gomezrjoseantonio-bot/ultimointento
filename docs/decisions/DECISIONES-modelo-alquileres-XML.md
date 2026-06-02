# DECISIONES CERRADAS · modelo de alquileres ATLAS · wizard import XML + módulo Contratos

> **Fecha** · 30 may 2026
> **Estado** · decisiones cerradas · pendiente redactar spec CC
> **Origen** · sesión Jose ↔ Claude tras auditoría de CC (`docs/audit/wizard-import-alquileres-auditoria.md`)
> **Contexto** · ATLAS hoy mete TODO arrendamiento del XML AEAT en un único Contract `sin_identificar` por inmueble · esto genera bugs · datos huérfanos · y no permite conciliar con contratos reales posteriormente. Se rediseña el modelo.

---

## 1 · Modelo · 2 caminos según el bloque XML

El wizard XML AEAT enruta cada bloque `<Arrendamiento>` por inmueble a uno de 2 caminos ·

### Camino 1 · Crear Contract identificado

**Condiciones · TODAS deben cumplirse** ·

1. `tipoArrendamiento = 'vivienda'` (vivienda habitual del inquilino · LAU)
2. 1 solo NIF en el bloque (`TANIFARREND1` presente · `TANIFARREND2` ausente)
3. El inmueble tiene `modoExplotacion = 'piso_completo'` (NO `por_habitaciones` · NO `mixto`)

**Qué crea ATLAS** ·

- 1 Contract identificado
- `inquilino.dni` rellenado con el NIF del XML
- `inquilino.nombre`/`apellidos`/`email`/`telefono` vacíos (XML solo da NIF)
- `tenant.nif` también rellenado por compatibilidad (mientras `tenant` legacy exista)
- `modalidad: 'habitual'`
- `rentaMensual = importeDeclaradoBloque / 12` (estimación inicial · se afina al vincular Rentila)
- `monthlyRent` = mismo valor (legacy)
- `fechaInicio` · primera fecha en que aparece el NIF en los XMLs importados
- `fechaFin` · si el NIF no aparece en años posteriores · se cierra · si sigue · queda `2099-12-31` (placeholder)
- `estadoContrato: 'activo'` (NO se inventa estado nuevo)
- `status: 'active'` (mapeo normal en `saveContract`)
- Genera cobros previstos en Tesorería (24 meses adelante · como cualquier Contract activo)

**Detección de cambio de inquilino entre años** ·

Usar la función existente `crearOActualizarContrato` (`declaracionOnboardingService.ts:931`) · que ya sabe ·

- Buscar si existe Contract con el mismo NIF · si sí · actualizar (sin duplicar)
- Si existe Contract activo con NIF DISTINTO en mismo inmueble · cerrarlo (`fechaFin = ejercicio - 1`12-31`) y abrir uno nuevo con el NIF nuevo

**Caso real validador** · CB Sant Fruitós ·

| Año XML | NIF | Acción |
|---|---|---|
| 2022 | 53639207X (AROA) | Crea Contract AROA · fechaInicio 01/01/2022 · activo |
| 2023 | 53639207X (AROA) | Actualiza Contract AROA · año añadido a histórico |
| 2024 | 43508951N (CONCEPCION) | Cierra Contract AROA con fechaFin 31/12/2023 · abre Contract CONCEPCION con fechaInicio 01/01/2024 |

Resultado · 2 Contracts identificados · cada uno con su historia.

### Camino 2 · Crear/actualizar Bote anual

**Condiciones · cualquiera de estas dispara el camino bote** ·

- El bloque NO tiene NIF (`TANIFARREND1` ausente)
- El bloque tiene N NIFs · N > 1 (significa habitaciones independientes · XML no desglosa cuánto paga cada uno)
- El inmueble tiene `modoExplotacion = 'por_habitaciones'`
- El inmueble tiene `modoExplotacion = 'mixto'`
- `tipoArrendamiento ≠ 'vivienda'` (turístico · temporada · habitaciones · otros)

**Qué crea ATLAS** ·

- 1 registro `BoteAnualSinIdentificar` por (inmuebleId · año)
- Si ya existe el bote para ese inmueble/año · acumula el importe (caso FA32 con TAR1 + TAR2 en el mismo XML 2024)
- `importeDeclarado` = suma de todos los bloques que cumplen las condiciones del Camino 2 para ese inmueble/año
- `díasDeclarados` = suma agregada (cap a 366)
- `nifsDetectados` = todos los NIFs detectados aunque vayan al bote (se guardan como metadata · útil para sugerencias futuras al vincular)
- `tiposArrendamientoOriginales` = array con los `tipoArrendamiento` originales (vivienda · no_vivienda · etc · para auditoría)
- `estado: 'pendiente_total'` (importeAsignado = 0)
- `importeAsignado: 0`
- `saldoPendiente` = importeDeclarado
- `contractsVinculados: []`
- NO genera cobros previstos en Tesorería

**Casos reales validadores** ·

| Inmueble | Año | Por qué bote |
|---|---|---|
| T48 Oviedo | 2022-2024 | Sin NIF en XML AEAT |
| FA32 Oviedo | 2024 | modoExplotacion=mixto · 2 NIFs en TAR1 + 0 NIFs en TAR2 |
| T64-4D | 2024 | modoExplotacion=por_habitaciones |
| T64-4Iz | 2024 | modoExplotacion=por_habitaciones |

## 2 · Entidad nueva · BoteAnualSinIdentificar

### Schema (TS interface)

```typescript
export interface BoteAnualSinIdentificar {
  id?: number;
  inmuebleId: number;
  año: number;                              // ejercicio fiscal
  importeDeclarado: number;                 // del XML AEAT (acumulado si varios bloques)
  díasDeclarados: number;                   // suma · cap 366
  nifsDetectados: string[];                 // todos los NIFs encontrados aunque vayan al bote
  tiposArrendamientoOriginales: string[];   // 'vivienda' | 'no_vivienda' | etc · para auditoría
  importeAsignado: number;                  // suma de lo vinculado · empieza en 0
  saldoPendiente: number;                   // = importeDeclarado - importeAsignado
  estado: 'pendiente_total' | 'parcial' | 'cerrado' | 'sobre_asignado';
  contractsVinculados: BoteContractLink[];  // array de vinculaciones
  fuente: 'xml_aeat';
  fechaImportación: string;                 // ISO
  fechaUltimaModificación: string;          // ISO
}

export interface BoteContractLink {
  contractId: number;                       // FK a Contract
  importeAsignado: number;                  // cuánto del Contract se imputa al bote (puede ser parcial)
  fechaVinculación: string;                 // ISO
  origen: 'sugerencia_atlas' | 'manual_usuario';
}
```

### Store

- Nuevo store IndexedDB · `botesAnualesSinIdentificar`
- Índices · `inmuebleId` · `[inmuebleId, año]` (único · garantiza 1 bote por inmueble/año)
- DB bump · 1 versión (sin tocar Contracts ni otros stores)

### Estados · transiciones

```
pendiente_total ──vincular Contract──> parcial ──vincular más──> cerrado
                                          │
                                          └──asignar más de lo declarado──> sobre_asignado
```

- `pendiente_total` · `importeAsignado === 0`
- `parcial` · `0 < importeAsignado < importeDeclarado`
- `cerrado` · `importeAsignado === importeDeclarado` (tolerancia · ±1€ para redondeos)
- `sobre_asignado` · `importeAsignado > importeDeclarado` (alerta · pide al usuario revisar o desvincular)

## 3 · Vinculación retrospectiva Contract ↔ Bote

### Cuándo se dispara

- Al crear un Contract nuevo (manual · import Rentila · etc)
- ATLAS busca botes activos con `inmuebleId = contract.inmuebleId` cuyos años intersecten con `[contract.fechaInicio, contract.fechaFin]`
- Propone vincular automáticamente · usuario confirma

### Cálculo del importe a vincular por año

Para cada Contract → cada Bote del mismo inmueble/año ·

```
importeContractEnAño = rentaMensual × mesesDelContractEnEseAño
```

Ejemplo · Contract Rentila JOSEPH PALMA H1 FA32 320€/mes desde 04/02/2023 a 03/04/2023 ·

- En 2023 · ~2 meses → 640€ se vincula al Bote(FA32, 2023)

### UI de vinculación

- En `/contratos · pestaña "Sin identificar"` · cada bote pintado como card
- Botón "Vincular contratos" abre drawer · ATLAS sugiere Contracts del mismo inmueble/año
- Usuario marca uno a uno · o "vincular todos los del año"
- Recalculo en tiempo real de `importeAsignado` · `saldoPendiente` · `estado`
- Si llega a `cerrado` · el bote se mueve a vista "Conciliados" (sub-pestaña dentro de "Sin identificar")
- Si llega a `sobre_asignado` · banner rojo · "Has asignado más que lo declarado · revisa"

## 4 · Tesorería

### Reglas

- **Botes NO generan cobros previstos** · son historia fiscal · no proyección
- **Contracts del Camino 1 SÍ generan cobros previstos** · 24 meses adelante · como cualquier Contract activo · 1 cobro/mes con `amount = rentaMensual`
- **Contracts vinculados a un Bote** · si están activos · siguen generando sus propios cobros previstos para meses futuros (la vinculación no los pausa)

### Motor único

- Eliminar el motor contradictorio que excluye `sin_identificar` (`treasuryForecastService.regenerateRentalsForecast`)
- Mantener `treasurySyncService.generateMonthlyForecasts` como motor único
- Modificar `isContractActiveInMonth` para que · además de excluir `rescindido` y `finalizado` · también excluya cualquier Contract con `estadoContrato = 'sin_identificar'` (por si quedara alguno de migraciones · ver § 6)

CC decide el detalle técnico de qué archivo borrar/refactorizar.

## 5 · UX visible

### En el wizard de import XML · paso 10 (Confirmar)

Agregar al resumen final ·

```
PATRIMONIO INMOBILIARIO
  · Inmuebles nuevos · N
  · Inmuebles enriquecidos · N
  · Accesorios vinculados · N

CONTRATOS Y BOTES                             ← SECCIÓN NUEVA
  · Contratos identificados · N
    (LAU vivienda completa con NIF detectado)
  · Botes anuales pendientes · N
    (importes declarados sin contratos identificables · 
     vincúlalos cuando subas tus contratos reales)
```

Mensaje claro al final ·

> Hemos creado N contratos identificados con datos del XML. Los demás importes declarados están en N botes anuales pendientes de identificar. Cuando subas tus contratos físicos (Rentila u otra fuente) · ATLAS los vinculará automáticamente y descontará del bote hasta cerrar la conciliación.

### En `/contratos` · pestañas

```
[Disponibilidad] [Tablero] [Activos] [Histórico] [Sin identificar]
                                                      ↑
                                                  Botes viven aquí
```

**Pestaña "Sin identificar"** ·

- Lista de botes agrupados por inmueble · expandible por año
- Card por bote ·
  - Inmueble + año
  - Importe declarado
  - Importe asignado · saldo pendiente
  - Barra de progreso · % conciliado
  - Estado (chip color · rojo `pendiente_total` · ámbar `parcial` · verde `cerrado` · rojo intenso `sobre_asignado`)
  - Botón "Vincular contratos"
- Sub-pestaña "Conciliados" · botes en estado `cerrado` (historia)

### En detalle de cada inmueble · sección nueva

```
Histórico fiscal declarado
  ──────────────────────────
  Año 2022 · Importe X · Días Y · Estado del bote · NIFs detectados
  Año 2023 · ...
  Año 2024 · ...
```

Muestra los datos fiscales declarados · independientemente de si dispararon Camino 1 (Contract) o Camino 2 (Bote). Es la verdad fiscal del inmueble · año a año.

### Etiqueta `sin_identificar` desaparece de Contracts

- Los Contracts del Camino 1 tienen estados normales (`activo` · `finalizado` · etc)
- Los botes son entidad aparte · NO Contracts
- El estado `sin_identificar` queda solo como histórico/legacy en la migración (§ 6)

## 6 · Migración data existente

### Decisión cerrada · opción "ii" · reimportar limpio

Los 6 Contracts `sin_identificar` que ATLAS creó en producción se **borran** al desplegar el nuevo modelo. El usuario reimporta sus XMLs y el wizard nuevo enruta correctamente.

### Implementación

- Script de migración v77→v78 (o el bump correspondiente)
- Detecta Contracts con `estadoContrato === 'sin_identificar'` creados antes de la migración
- Los elimina (con CASCADE · también los `treasuryEvents` con `sourceType: 'contrato'` y `sourceId = contractId`)
- NO crea botes automáticamente en la migración · el usuario tendrá que volver a importar los XMLs

### Aviso al usuario tras la migración

- Banner en `/contratos` (1 vez) · "ATLAS ha actualizado el modelo de alquileres. Tus N contratos sin identificar anteriores se han limpiado. Reimporta tus declaraciones IRPF para que el nuevo modelo cree contratos identificados y botes correctamente."
- Botón directo a "Importar declaración"

## 7 · Limpieza tenant legacy

### Decisión · NO se retira ahora

- Camino 1 sigue rellenando `tenant.nif` con el NIF (por compatibilidad)
- El código nuevo lee `inquilino` · `tenant` queda como fallback
- Queda apunte para limpieza futura cuando todo el código nuevo solo lea `inquilino`

## 8 · Lo que NO entra en esta tarea

- **Import Rentila xlsx** · la funcionalidad ya existe · se aprovecha tal cual · NO se modifica
- **Refactor de cómo se modela `modoExplotacion` o el Property V3** · ya está cerrado
- **Renaming del estado `sin_identificar`** · se elimina como concepto en Contracts (los Camino 1 son `activo` · los Camino 2 son botes) · NO se renombra
- **KPI raro "25 LIBRES AHORA"** · queda como apunte para limpieza futura · NO se toca aquí
- **`fianzaEstado: retenida` con `fianzaImporte: 0`** · apunte para limpieza · NO se toca aquí
- **Duplicación `inquilino` vs `tenant`** · apunte para limpieza · NO se toca
- **Soporte para 4 tipos Rentila (vivienda · vivienda temporada · habitación larga · habitación temporada)** · queda apunte para sesión propia si se necesita matiz · hoy ATLAS usa solo `modalidad: habitual/vacacional`

---

## 9 · Validación con casos reales Jose

| Inmueble | Año | XML aporta | modoExplotacion | Camino | Resultado |
|---|---|---|---|---|---|
| CB Sant Fruitós | 2022 | NIF AROA · 3.600€ · vivienda | piso_completo | 1 | Contract AROA activo |
| CB Sant Fruitós | 2023 | NIF AROA · 3.600€ · vivienda | piso_completo | 1 | Contract AROA actualizado |
| CB Sant Fruitós | 2024 | NIF CONCEPCION · 3.960€ · vivienda | piso_completo | 1 | Cierra AROA · abre CONCEPCION |
| T48 Oviedo | 2022 | Sin NIF · importe · vivienda | piso_completo | 2 | Bote T48 año 2022 |
| T48 Oviedo | 2023 | Sin NIF · importe · vivienda | piso_completo | 2 | Bote T48 año 2023 |
| T48 Oviedo | 2024 | Sin NIF · 17.710€ · vivienda | piso_completo | 2 | Bote T48 año 2024 (cuando entre Rentila ALISSER se vinculará) |
| FA32 | 2024 TAR1 | 2 NIFs · 8.550€ · vivienda | mixto | 2 | Bote FA32 año 2024 (mixto dispara bote) |
| FA32 | 2024 TAR2 | Sin NIF · 11.125€ · no_vivienda | mixto | 2 | Acumula al Bote FA32 año 2024 (mismo bote) |
| T64-4D | 2024 | Sin NIF · importe · varios | por_habitaciones | 2 | Bote T64-4D año 2024 |
| T64-4Iz | 2024 | Sin NIF · importe · varios | por_habitaciones | 2 | Bote T64-4Iz año 2024 |
| Sant Joan d'En Coll | 2022-2025 | NIF IVAN · 5.160€/año · vivienda | piso_completo | 1 | Contract IVAN activo · cierre cuando deje de aparecer |

Total Contracts esperados desde XML · ~3 (CB AROA · CB CONCEPCION · IVAN)
Total Botes esperados desde XML · ~10 (T48 ×3 años · FA32 ×2 años · T64-4D ×2 años · T64-4Iz ×2 años · y los que correspondan según XMLs reales)

---

## 10 · Próximos pasos

1. **Validación final por Jose** · lee este documento · marca si hay algo a corregir
2. **Redacción spec CC** · una vez validado · escribo la spec completa con commits secuenciales · DB bump · tests · checklist
3. **Auditoría de la spec por CC** · CC verifica grep antes de implementar (commit 1 de audit)
4. **Implementación CC** · commits 2-N · stop-and-wait entre cada uno
5. **Validación post-deploy en producción** · Jose con DevTools confirma el nuevo modelo

---

**Estado · DECISIONES CERRADAS · pendiente redactar spec.**
