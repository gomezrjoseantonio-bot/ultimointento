# DELTA · TAREA 13 · estado actual (post-V65) vs spec v3

> **Modo**: auditoría · 0 commits · 0 archivos modificados.
>
> **Hipótesis confirmada**: la mayor parte del trabajo del spec v3 fue ejecutada en la migración **V65** (commit anterior a esta rama). Quedan piezas incompletas concretas y un módulo entero (rentabilidad) sin implementar.
>
> **DB_VERSION actual** = 68 · **stores activos** ≈ 40 (la spec describe v68→v69, pero los stores de planes ya viven desde v65; bumpear a v69 sin cambios de schema reales sería gratuito y rompería instalaciones existentes).
>
> **Rama auditada**: `claude/pension-plans-module-v3-H1Shy` (igual a `main` post-T39, sin cambios locales).

---

## 0 · Resumen ejecutivo

| Sub-tarea spec v3 | Estado real | Acción requerida |
|---|---|---|
| 13.1 schema + stores DB v69 | ✅ ya hecho en V65 (db.ts:2661-2682, 3783-3801) | NINGUNA · NO bumpear DB_VERSION |
| 13.2 servicios CRUD | ✅ existen los 3 con cobertura completa | Pulir traspasosPlanPensionesService (falta `valorTraspaso`) |
| 13.3 servicio fiscal | ⚠️ existe pero parcial vs §3.3 | Ampliar `calcularReduccionBaseImponible` y validador 30% |
| 13.4 migración datos | ✅ ya ejecutada en V65 (db.ts:3811-3964) | NINGUNA |
| 13.5 UI (pantalla + 6 secciones + wizards) | ⚠️ pantalla y ficha sí · wizards incompletos · 2 secciones faltan | Ampliar PlanForm a wizard 5 pasos · añadir sección Traspasos+rentab. y sección Datos fiscales en ficha |
| 13.6 consumidores (nómina, XML, NominaWizard, cartera) | ⚠️ nómina ✅ · cartera ✅ · NominaWizard ❌ · XML AEAT ❌ | Migrar NominaWizard a `planesPensionesService` · cablear `aeatXmlParserService` para crear planes/aportaciones |
| 13.7 rentabilidad TWR/MWR/bloques | ❌ NO existe `rentabilidadPlanService.ts` · solo CAGR simple en ficha | IMPLEMENTAR completo (servicio + UI cabecera + timeline + tabla traspasos + card) |

**Tres bloques de trabajo real** quedan tras V65:

1. **Rentabilidad** (nuevo · ★ sub-tarea 13.7 v3) — todo por hacer.
2. **Cierre de gaps** en types/servicios fiscal/UI ficha (pequeños diffs documentados abajo).
3. **Consumidores rezagados** — `NominaWizard.tsx` y `aeatXmlParserService.ts` no escriben en el módulo nuevo.

---

## 1 · Tipos · `src/types/planesPensiones.ts` vs §2 spec

### 1.1 · `PlanPensiones` (§2.1)

| Campo spec | Presente en código | Notas |
|---|---|---|
| `id: string` UUID estable | ✅ | |
| `nombre: string` | ✅ | |
| `titular: 'yo' \| 'pareja'` | ✅ | |
| `personalDataId: number` | ✅ | |
| `tipoAdministrativo` | ✅ | |
| `subtipoPPE?` | ✅ | |
| `subtipoPPES?` | ✅ | |
| `garantizado?` | ✅ | |
| `politicaInversion?` | ✅ | |
| `porcentajeRentaVariable?` | ✅ | |
| `modalidadAportacion?` | ✅ | |
| `gestoraActual: string` | ✅ | |
| `isinActual?` | ✅ | |
| `fechaUltimaValoracion?` | ✅ | |
| `valorActual?` | ✅ | |
| `fechaContratacion: string` | ✅ | |
| `importeInicial?` | ✅ | |
| `empresaPagadora.{cif,nombre,ingresoIdVinculado}` | ✅ | |
| `partícipeConDiscapacidad?` | ✅ (sin tilde: `participeConDiscapacidad`) | Nombre normalizado, comportamiento idéntico. **NO action.** |
| `estado` | ✅ | |
| `fechaCreacion` / `fechaActualizacion` | ✅ | |
| `origen: 'manual' \| 'xml_aeat' \| 'migrado_v60'` | ✅ | |

**Conclusión**: 100 % paridad. Solo cambio cosmético en el nombre del campo discapacidad (sin tilde) — irrelevante.

### 1.2 · `AportacionPlan` (§2.2)

| Campo spec | Presente | Notas |
|---|---|---|
| `id`, `planId`, `fecha`, `ejercicioFiscal` | ✅ | |
| `importeTitular`, `importeEmpresa`, `importeConyuge?` | ✅ | |
| `origen` (manual/xml_aeat/nomina_vinculada/migrado_v60) | ✅ | |
| `ingresoIdNomina?`, `movementId?` | ✅ | |
| `granularidad`, `mesesCubrios?` | ✅ (`mesesCubiertos`, ortografía corregida) | spec tiene typo · código correcto |
| `casillaAEAT?`, `notas?` | ✅ | |
| `fechaCreacion` / `fechaActualizacion` | ✅ | |

**Conclusión**: 100 % paridad.

### 1.3 · `TraspasoPlanPensiones` (§2.3) — ⚠️ DIVERGENCIA RELEVANTE

| Campo spec | Presente | Notas |
|---|---|---|
| `id: string` | ❌ | Código: `id?: number` (autoIncrement). El store fue creado con `autoIncrement: true` (db.ts:2679, 3799), no UUID. |
| `planId: string` | ✅ | |
| `fechaSolicitud: string` | ❌ | falta en código |
| `fechaEjecucion: string` | ✅ | |
| `gestoraOrigen` / `gestoraDestino` | ✅ | |
| `isinOrigen?` / `isinDestino?` | ✅ | |
| `tipoAdministrativoOrigen?` / `tipoAdministrativoDestino?` | ❌ → solo `cambioTipoAdministrativo: boolean` + `nuevoTipoAdministrativo?` | semánticamente similar pero perdemos el origen explícito |
| `politicaInversionOrigen?` / `politicaInversionDestino?` | ❌ → solo `nuevaPoliticaInversion?` | falta política origen |
| **`valorTraspaso: number`** ⚠️ CRÍTICO | ❌ → existe `importeTraspasado: number` | nombre distinto · semántica idéntica si traspaso es total · **REVISAR** si en parciales el `importeTraspasado` representa lo enviado o el valor del bloque al cerrarse |
| `aportacionesAcumuladasMomento?` | ❌ | falta · útil para reconciliación rentabilidad |
| `esTotal: boolean` | ✅ (extra del código, no en spec) | |
| `notas?`, `fechaCreacion`/`fechaActualizacion` | ✅ | |
| `planIdDestino?` | ✅ (extra del código) | soporta traspaso entre planes del propio sistema |

**Implicaciones**:
- `valorTraspaso` (renombrado a `importeTraspasado`) es el campo CRÍTICO para cálculo de rentabilidad por bloque (§4). Hay que confirmar semántica antes de usarlo en TWR.
- La ausencia de `fechaSolicitud` y `aportacionesAcumuladasMomento` puede asumirse como aceptable; si la sub-tarea 13.7 los necesita, hay que añadirlos.
- `id: number` autoIncrement vs `id: string` UUID — divergencia menor; UI ya lo trata como `number`.

### 1.4 · Tipos auxiliares (`LimitesFiscalesPlan`, `ResultadoValidacionAportacion`)

Existen en código (líneas 128-140 de types) **NO descritos en spec** pero alineados con §3. Forma simplificada del retorno descrito en §3.2 (`importeDeducible`, `excesoNoDeducible`, `motivo?`, `limiteAplicable`, `totalAportadoEjercicio`):

- Código devuelve `{ deducible, exceso, limiteAplicable, totalAportado }`.
- Faltan en código: `motivo?: string` y la separación entre "deducible" (lo que cuenta) y "esDeducible: boolean".

---

## 2 · Servicios CRUD vs §7.1

### 2.1 · `planesPensionesService.ts` (154 líneas)

| Método spec §7.1 | Código | Notas |
|---|---|---|
| `createPlan(data)` | ✅ `createPlan` | UUID generado vía `crypto.randomUUID` con fallback |
| `updatePlan(id, data)` | ✅ | |
| `getPlan(id)` | ✅ | |
| `getAllPlanes(filtros?)` | ✅ con `FiltrosPlanes` (personalDataId, titular, tipoAdministrativo, estado) | |
| `getPlanesPorTipo(tipo)` | ✅ | |
| `eliminarPlan(id)` cascade | ✅ borra aportaciones + traspasos + valoraciones histórico de plan | cumple §7.1 |
| `getValorActualConsolidado(id)` | ✅ | trivial · devuelve `valorActual ?? 0` |
| `getAportacionesAcumuladasTotal(id)` | ✅ devuelve `{titular, empresa, total}` | NO incluye conyuge en el total · revisar si es by-design |
| `cambiarTipoAdministrativo(id, nuevoTipo)` | ✅ | thin wrapper de `updatePlan` |
| `getAll()` extra | ✅ alias `getAllPlanes()` sin filtros (T23.6.1) | |

**Conclusión**: cumple. Único gap menor: `getAportacionesAcumuladasTotal` no devuelve `conyuge` en el objeto retornado.

### 2.2 · `aportacionesPlanService.ts` (164 líneas)

| Método spec §7.1 | Código | Notas |
|---|---|---|
| `crearAportacion(data)` | ✅ | |
| `getAportacionesPorPlan(planId)` | ✅ ordenado fecha desc | |
| `getAportacionesPorAño(planId, ejercicio)` | ✅ | |
| `getTotalesPorAño(planId, ejercicio)` | ✅ devuelve `{titular, empresa, conyuge, total}` | |
| `mensualizarAnual(aportacionId)` | ✅ borra anual y crea 12 mensuales | preserva `casillaAEAT`, `ingresoIdNomina`, `movementId` |
| `eliminarAportacion(id)` | ✅ | |
| **Extras útiles** | `sumaAportaciones`, `getTotalAportadoPorPlan` (vía índice `planId`), `getMapaAportacionesAcumuladas(planIds?)` | optimizaciones |

**Conclusión**: cumple con creces.

### 2.3 · `traspasosPlanPensionesService.ts` (39 líneas)

| Método spec §7.1 | Código | Notas |
|---|---|---|
| `registrarTraspaso(data)` | ✅ | escribe el traspaso pero **NO** actualiza `planesPensiones.gestoraActual/isinActual` (§5.8 paso 4) — esto sí lo hace `traspasosPlanesService.ts` legacy |
| `getTraspasosPorPlan(planId)` | ✅ filtra por planId u origen y destino | |
| `getTrayectoriaCompleta(planId)` | ✅ devuelve `{plan, traspasos[]}` | |

**Gap real**:
1. El servicio nuevo no encadena los efectos del traspaso (actualizar gestora actual del plan, crear valoración histórica con el valor del momento, etc.). Esa lógica vive en `traspasosPlanesService.ts` (legacy).
2. La UI sigue usando `traspasosPlanesService` legacy, no este nuevo. La transición está a medio hacer.
3. Nada crea entradas en `valoraciones_historicas` con el valor del traspaso (necesario para sub-tarea 13.7).

---

## 3 · Servicio fiscal · `limitesFiscalesPlanesService.ts` vs §3

### 3.1 · Tabla de límites 2026 (§3.1)

| Constante spec | Código | OK |
|---|---|---|
| PPI/PPA · 1.500 € · 30 % | `LIMITE_PPI_PPA = 1_500` · `PORCENTAJE_RENDIMIENTOS = 0.30` | ✅ |
| PPE empresa · 8.500 € | `LIMITE_PPE_EMPRESA = 8_500` | ✅ |
| PPE conjunto · 10.000 € | `LIMITE_PPE_CONJUNTO = 10_000` | ✅ |
| PPES autónomos adicional · 4.250 € (total 5.750) | `LIMITE_PPES_AUTONOMOS_ADICIONAL = 4_250` · `LIMITE_PPES_AUTONOMOS_TOTAL = 5_750` | ✅ |
| PPES sectorial/público/cooperativas · 10.000 € | `LIMITE_PPES_OTROS = 10_000` | ✅ |
| Cónyuge sin rentas · 1.000 € | `LIMITE_CONYUGE = 1_000` | ✅ |
| Cónyuge · base imp. máx. 8.000 € | ❌ no validado en código | falta |
| Discapacidad · 24.250 € | `LIMITE_DISCAPACIDAD = 24_250` | ✅ |

**Resultado**: 8/9 constantes presentes. Falta validar el techo de 8.000 € de base imponible del cónyuge aportante.

### 3.2 · `validarAportacionDeducible` (§3.2)

Código existente:
```ts
validarAportacionDeducible(planId, importe, ejercicio, rolAportante)
  → { deducible, exceso, limiteAplicable, totalAportado }
```

Spec exige:
```ts
{ esDeducible, importeDeducible, excesoNoDeducible, motivo?, limiteAplicable, totalAportadoEjercicio }
```

| Campo spec | Código | Notas |
|---|---|---|
| `esDeducible: boolean` | ❌ derivable por consumidor (`exceso === 0`) | mejor explícito |
| `importeDeducible` | ✅ (`deducible`) | renombrar |
| `excesoNoDeducible` | ✅ (`exceso`) | renombrar |
| `motivo?: string` | ❌ | falta texto explicativo |
| `limiteAplicable` | ✅ | |
| `totalAportadoEjercicio` | ✅ (`totalAportado`) | renombrar |

**Lógica del cálculo**:
- Spec §3.2 paso 4: "el menor entre · límite € y 30% rendimientos netos". Código **NO aplica** el factor 30 % de rendimientos del trabajo + actividades · solo aplica el límite económico. **Gap real**.
- Para que el 30% funcione hay que leer rendimientos del trabajador (vía `ingresos.tipo='nomina'/'autonomo'`). Implica nuevo helper.

### 3.3 · `calcularReduccionBaseImponible` (§3.3)

Código devuelve `Promise<number>` (suma simple).

Spec exige objeto rico:
```ts
{
  totalAportadoTitular, totalAportadoEmpresa, totalAportadoConyuge,
  desgloseDeduciblesPorTipo: { PPI, PPA, PPE, PPES_autonomos, PPES_sectorial, PPES_publico, PPES_cooperativas },
  totalDeducibleAplicado, excesoArrastrable, alertas?
}
```

**Gap masivo**. Hay que reescribir el método.

### 3.4 · Casillas AEAT (§3.4)

Código tiene mapeo:
```ts
PPI → '0470', PPA → '0472', PPE titular → '0470', PPE empresa → '0471',
PPES → '0474', conyuge → '0469'
```
Con `// TODO: verificar casillas exactas en modelo IRPF vigente` (línea 161).

Spec dice "TODO si CC tiene duda" — cumple. **No bloquea.** Pero conviene verificar contra documentación AEAT antes del despliegue público.

---

## 4 · UI vs §8

### 4.1 · Pantalla principal "Mis Planes de Pensiones" (§8.1)

`src/components/personal/planes/PlanesManager.tsx` (285 líneas):

| Spec | Código | Nota |
|---|---|---|
| Lista de planes con card por plan | ✅ | |
| Badge tipo (PPI/PPE/PPES/PPA) | ✅ línea 211 | |
| Titular (yo / pareja) | ✅ línea 213-216 | |
| Empresa si PPE/PPES | ❌ no mostrado en card | |
| Valor actual | ✅ línea 226-230 | |
| Aportado total | ❌ no mostrado en card | |
| **Rentabilidad acumulada / TWR/año** ★ | ❌ | bloqueado por sub-tarea 13.7 |
| Botón "+ Nuevo plan" | ✅ línea 117-122 | |
| Filtros titular | ❌ solo filtros estado (todos/activos/rescatados) | |
| Filtro tipoAdministrativo | ❌ | |
| Filtro estado | ✅ parcial | |
| Resumen fiscal del año (base reducida acum.) | ❌ | |

**Hay también** una experiencia paralela en `src/modules/inversiones/InversionesGaleria.tsx` (galería unificada) que ya muestra planes vía `galeriaAdapter` con `aportacionesPlanService.getMapaAportacionesAcumuladas`. Esto cumple §1.5 punto 4 pero compite con `PlanesManager`. **Decisión necesaria de Jose**: ¿cuál es la pantalla canónica? Probablemente `InversionesGaleria` para galería unificada y `PlanesManager` para Personal → Planes.

### 4.2 · Detalle del plan · 6 secciones (§8.2)

`src/modules/inversiones/pages/FichaPlanPensiones.tsx` (729 líneas) implementa:

| Sección spec | Código | Estado |
|---|---|---|
| 1 · Resumen (datos básicos + valor actual + aportado + plusvalía + rentab. anualizada + periodo + gestora/ISIN) | ✅ Hero con stats: Valor actual, Aportado, Ganancia, **CAGR** | ⚠️ falta TWR/MWR · solo CAGR simple |
| 2 · Trayectoria timeline | ❌ | falta completo |
| 3 · Aportaciones (tabla histórica) | ✅ líneas 657-697 | tabla simple, sin filtros por año, sin "Mensualizar año X", sin indicador exceso |
| 4 · Valoraciones (gráfica + actualizar) | ✅ vía SparklineDoble (valor vs aportado) | falta marcar puntos de traspaso en gráfica |
| 5 · Traspasos + tabla rentabilidad por bloque | ❌ | falta completo (clave para 13.7) |
| 6 · Datos fiscales (reducción acumulada · desglose · exceso arrastrable · estimación rescate · iliquidez) | ⚠️ "Ventaja fiscal" (limitada al ejercicio en curso · líneas 539-606) | falta sección formal: desglose por tipo, exceso arrastrable a 5 años, estimación tributación rescate, fecha mínima rescate |

### 4.3 · Wizard alta (§8.3) — ❌ NO ES WIZARD DE 5 PASOS

`PlanForm.tsx` (269 líneas) es un **modal de un solo paso** con todos los campos visibles. Faltan:

| Paso spec | Código |
|---|---|
| 1 · Tipo administrativo (selector visual + subtipos PPE/PPES) | parcial · selector de tipo principal sí, **subtipos NO** |
| 2 · Empresa (CIF + nombre, pre-rellenable de nóminas) | ❌ |
| 3 · Datos básicos | ✅ campos presentes en el mismo modal |
| 4 · Estado actual (valor actual) | ✅ |
| 5 · Aportación inicial (vincular a nómina si PPE/PPES) | ❌ |

Asimismo el form **no captura**: `subtipoPPE`, `subtipoPPES`, `garantizado` (auto-deducible si tipo=PPA), `politicaInversion`, `porcentajeRentaVariable`, `modalidadAportacion`, `empresaPagadora.{cif,nombre}`, `participeConDiscapacidad`, `fechaUltimaValoracion`. Crea planes con shape mínimo.

### 4.4 · Wizard traspaso (§8.4) — 1 paso ✅ pero LEGACY

`TraspasoForm.tsx` (301 líneas) es un modal de 1 paso (parcial/total + importe + fecha + notas). PERO:

- Usa `traspasosPlanesService` (legacy, V62) en vez de `traspasosPlanPensionesService` (V65).
- Lee orígenes/destinos mezclando `planesInversionService` y `inversiones[tipo IN (PLAN_PENSIONES_TIPOS_INVERSION)]` — esto último ya no debería existir tras V65.
- **No captura** `valorTraspaso` (valor del plan en el momento del traspaso), que es CRÍTICO para sub-tarea 13.7.
- No registra `fechaSolicitud`, no actualiza `gestoraActual`/`isinActual` del plan, no crea entrada en `valoraciones_historicas`.

---

## 5 · Consumidores externos vs §7.2

### 5.1 · `nominaService` / `nominaAportacionHook.ts` (§7.2 + §5.6)

Ubicación: `src/services/personal/nominaAportacionHook.ts` (181 líneas).

| Requisito spec | Código | Estado |
|---|---|---|
| Al confirmar nómina → crea entrada en `aportacionesPlan` | ✅ líneas 100-112 | |
| `granularidad: 'mensual'` | ✅ | |
| `origen: 'nomina_vinculada'` | ✅ | |
| `ingresoIdNomina` y `movementId` | ✅ `ingresoIdNomina` (sourceId/id del evento) — ❓ `movementId` no se rellena explícitamente | revisar si tras conciliación queda enlazado |
| Idempotencia | ✅ líneas 88-97 | OK |
| `importeTitular` + `importeEmpresa` | ✅ | |

**Conclusión**: ✅ cumple. Mejora menor: rellenar `movementId` cuando esté disponible.

### 5.2 · `aeatXmlParserService.ts` / `aeatParserService.ts` (§5.5 + §7.2) — ❌ INCOMPLETO

Búsqueda en `aeatXmlParserService.ts`:
```
aportacionesIndividuales = getNum(innerDoc, 'RGAP') || getNum(innerDoc, 'V01PP2ORGEA');
```

Solo extrae **el número agregado** (importe total de aportaciones individuales). **NO**:
- Crea o busca planes en `planesPensiones`.
- Crea entradas en `aportacionesPlan` con `origen: 'xml_aeat'`.
- Mapea casilla AEAT → `tipoAdministrativo`.
- Distingue PPI/PPE/PPES/PPA por casilla.

**Implicación**: la importación XML AEAT SIGUE SIN funcionar como destino real al módulo nuevo. Esto es exactamente lo que describe §1.1 como "bug detectado en TAREA 7-bis". V65 migró los datos existentes de stores legacy, pero la **vía de entrada XML AEAT no fue reconectada**.

### 5.3 · `inversionesService.ts` (§7.2) — ✅ filtra OUT planes

Líneas 65 y 269 confirman que `inversiones[tipo='plan_pensiones']` ya no se lee como inversión; se delega en `planesPensiones`. ✅.

### 5.4 · `NominaWizard.tsx` (§8.5) — ❌ USA SERVICIO LEGACY

`src/pages/GestionPersonal/wizards/NominaWizard.tsx` línea 7 importa `planesInversionService`, no `planesPensionesService`. Línea 230:
```ts
planesInversionService.getPlanes(perfil.id)
```

El listado de planes para vincular a la nómina viene del módulo **legacy** de planes de inversión, NO de `planesPensiones` (V65). Cuando el usuario selecciona un plan en el wizard:
- `productoDestinoId: number | null` — usa numérico (legacy id) en vez de UUID string.
- El hook `nominaAportacionHook.ts` luego intenta resolver ese id contra `planesPensiones.id` (string) → fallback `empresaPagadora.ingresoIdVinculado === String(productoId)`. Funciona POR SUERTE para planes migrados que conservan referencia.

**Acción requerida**: migrar selector a `planesPensionesService.getAllPlanes({ titular, tipoAdministrativo: 'PPE'|'PPES', estado: 'activo' })`.

### 5.5 · `cartera de inversiones` / `InversionesGaleria.tsx`

`galeriaAdapter.ts` y `posicionesCerradas.ts` ya consumen `aportacionesPlanService.getMapaAportacionesAcumuladas(...)`. ✅ alineado.

---

## 6 · Rentabilidad · §4 (sub-tarea 13.7) — ❌ NO IMPLEMENTADO

### 6.1 · Servicio

```bash
$ ls src/services/ | grep -i rentab
rentabilidadInmuebleService.ts
```

**No existe `rentabilidadPlanService.ts`.** No hay funciones `getRentabilidadTotal`, `getRentabilidadPorBloque`, `getRentabilidadComparativaBloques`. No hay implementaciones de TWR ni MWR/IRR.

Búsqueda exhaustiva:
```bash
$ grep -rn "TWR\|Time-Weighted\|Money-Weighted\|MWR\|IRR" src/ --include="*.ts" --include="*.tsx" \
   | grep -v test
(sin resultados)
```

### 6.2 · UI

- `FichaPlanPensiones.tsx` muestra **CAGR simple** (`(valorActual / aportadoTotal)^(1/años) - 1`, líneas 92-104). Esto **NO es TWR ni MWR**. Es una aproximación gruesa que ignora el momento de las aportaciones.
- No hay sección "Trayectoria timeline" con cierre de bloque por traspaso.
- No hay sección "Traspasos" con tabla de rentabilidad por bloque + semáforo neutro.
- La pantalla "Mis Planes" no muestra rentabilidad/año por card.

**Conclusión**: 13.7 está al 100 % por hacer.

---

## 7 · Resumen de gaps reales que sí requieren código

| # | Bloque | Esfuerzo | Crítico | Acción |
|---|---|---|---|---|
| **A** | Sub-tarea 13.7 completa · `rentabilidadPlanService.ts` + UI (cabecera + timeline + tabla por bloque + card mis planes) | 2-4 h | sí | NUEVO |
| **B** | `TraspasoPlanPensiones` · añadir `valorTraspaso` (o renombrar `importeTraspasado` y aclarar semántica) + opcionalmente `fechaSolicitud`, `aportacionesAcumuladasMomento`, `politicaInversionOrigen`, `tipoAdministrativoOrigen` | 30 min | sí (bloquea A) | tipo + service |
| **C** | `traspasosPlanPensionesService.registrarTraspaso` · al guardar, actualizar `planesPensiones.gestoraActual/isinActual` y crear entrada en `valoraciones_historicas` con `fechaEjecucion + valorTraspaso` | 30 min | sí (bloquea A) | service |
| **D** | `TraspasoForm.tsx` · migrar a `planesPensionesService` + `traspasosPlanPensionesService` (dejar de usar legacy) + capturar `valorTraspaso` | 45 min | sí | UI |
| **E** | `NominaWizard.tsx` · selector lee de `planesPensionesService.getAllPlanes({titular, tipoAdministrativo IN [PPE,PPES], estado:'activo'})` y usa `id: string` UUID | 30 min | medio | UI |
| **F** | `aeatXmlParserService.ts` · al importar XML AEAT, crear/actualizar planes en `planesPensiones` y registrar `aportacionesPlan` con `origen: 'xml_aeat'` y `casillaAEAT` mapeado a tipo | 1.5-2 h | medio | service |
| **G** | `limitesFiscalesPlanesService.calcularReduccionBaseImponible` · devolver objeto rico (§3.3) con desglose por tipo + exceso arrastrable + alertas | 45 min | medio | service |
| **H** | `limitesFiscalesPlanesService.validarAportacionDeducible` · aplicar tope 30 % rendimientos del trabajo (lectura desde `ingresos.tipo='nomina'/'autonomo'`) | 1 h | bajo | service |
| **I** | `PlanForm.tsx` · evolucionar a wizard 5 pasos · capturar subtipos PPE/PPES + empresaPagadora + politicaInversion + discapacidad + vinculación nómina | 2-3 h | bajo | UI |
| **J** | `FichaPlanPensiones.tsx` · sección 2 (timeline) y sección 5 (traspasos+rentab) y sección 6 (datos fiscales formal) | 2 h | bajo | UI |
| **K** | `PlanesManager.tsx` · filtros titular + tipoAdministrativo · resumen fiscal anual · empresa en card · aportado en card · TWR/año (depende de A) | 1 h | bajo | UI |

**Total estimado** si se hace todo: 12-16 h. Para el MVP del v3 (solo lo bloqueante = A+B+C+D+E+F): 6-9 h, exactamente el rango original del spec.

---

## 8 · Recomendación · alcance del PR siguiente

Sugerencia (sujeta a aprobación Jose):

**TAREA 13 v4 · alcance reducido a 1 PR · sin DB bump**

- Commit 1 (B+C) · `feat(planes): valorTraspaso + side-effects al registrar traspaso`
- Commit 2 (D) · `refactor(ui): TraspasoForm usa servicios v65 + captura valorTraspaso`
- Commit 3 (E) · `refactor(ui): NominaWizard lee de planesPensionesService`
- Commit 4 (F) · `feat(aeat): importación XML crea planes y aportaciones tipadas`
- Commit 5 (G+H) · `feat(fiscal): cálculo reducción rico + tope 30% rendimientos`
- Commit 6 (A) · `feat(rentabilidad): rentabilidadPlanService TWR + MWR + por bloque`
- Commit 7 (A-UI) · `feat(ui): rentabilidad enchufada en cabecera + timeline + tabla traspasos + card mis planes`

Estimación: 6.5-9 h CC + 4-5 h revisión Jose, igual que el spec original — pero ahora sobre el estado real del repo.

**Excluido del PR (defer a tarea futura)**:
- I (PlanForm wizard 5 pasos) — funcionalmente cubierto a nivel mínimo.
- K (filtros adicionales en PlanesManager) — cosmética.

---

## 9 · Verificaciones propuestas tras implementación

Más allá de las del spec original (§11), añadir:

- ✅ Confirmación: el PR **no toca DB_VERSION** (sigue en 68).
- ✅ Confirmación: el PR **no recrea stores** que ya existen.
- ✅ Tests: traspaso registrado actualiza plan + crea valoración histórica con `fechaEjecucion + valorTraspaso`.
- ✅ Tests: `getRentabilidadPorBloque` con caso Jose ING/Indexa/MyInvestor (datos sintéticos del §1.2 del spec) coincide con cálculo externo ±0.1 pp.
- ✅ Tests: importación XML AEAT crea planes con tipoAdministrativo inferido de la casilla.
- ✅ Tests: NominaWizard guarda `productoDestinoId` como string (UUID) tras la migración.

---

**Fin del informe.** Esperar autorización Jose para elegir alcance (A-K total · A-F mínimo · otra combinación).
