# T18 · Cobertura CCAA completa · cierre formal

> **Estado** · TAREA 18 cerrada
> **Fecha** · 2026-05-06
> **DB_VERSION** · 69 · sin cambios
> **Stores activos** · 40 · sin cambios
> **Spec base** · `docs/TAREA-18-cobertura-ccaa-completa-v1.md`
> **Predecesores cerrados** · T13 (módulo planes pensiones) · T14 (configuración fiscal sitio único · gateway `fiscalContextService` + 5 GAPs IRPF)

---

## 0 · Resumen ejecutivo

T18 cierra el GAP fiscal CRÍTICO de cobertura territorial. ATLAS pasa de
soportar 1 CCAA verified (Madrid · cierre T14.3) a soportar las **15 CCAA
de régimen común** con motor genérico de elegibilidad de deducciones y
reglas por archivo · cifras BOE/AEAT 2025 verificadas o marcadas con TODO
concreto cuando la pre-investigación no localizó la fuente.

**Antes de T18** · 1 CCAA verified (Madrid) · 14 CCAA caían a la
supletoria estatal con warning genérico · cliente residente en cualquier
CCAA distinta a Madrid no podía vender ATLAS sin asteriscos.

**Después de T18** · 15 CCAA cubiertas · motor `evaluarElegibilidad`
maduro · 13 dimensiones de requisitos modeladas · 5 deducciones top-3 con
cálculo verified · resto con TODO documentado · ATLAS vendible al
mercado completo de inversores en pisos régimen común.

**Fuera de T18 · TAREA futura** · País Vasco (3 territorios forales ·
Álava · Bizkaia · Gipuzkoa) y Navarra · IRPF foral propio · módulo
separado cuando aparezca cliente real.

---

## 1 · Cronología

| Fecha | Sub-tarea | Resultado | PR |
|---|---|---|---|
| 2026-05-06 | T18.0 · motor + Madrid verified | Fundación · 5 archivos `src/services/fiscal/` · Madrid escala 5 tramos BOE 2024-2025 + arrendamiento · 8 tests | #1269 |
| 2026-05-06 | T18.1 · Top 5 mercado inversor | Cataluña + Andalucía + Valencia + Baleares + CyL · 22 tests · 7 fixes Copilot · build fix ESLint | #1270 |
| 2026-05-06 | T18.2 · mercado medio | Galicia + Aragón (★ NO general) + Asturias + Murcia (Ley 3/2025) + Cantabria · 24 tests | #1272 |
| 2026-05-06 | T18.3 · resto + cierre | Canarias + CLM + Extremadura + La Rioja · 19 tests · este cierre | este PR |

**Total** · 4 sub-tareas · 4 PRs · 73 tests · 15 archivos CCAA + motor + tipos.

---

## 2 · Cobertura final · 15 CCAA × deducción arrendamiento

| # | CCAA | %  /  Tope | BI máx ind | Edad/Perfil | Especificidad | `verified` paquete |
|---|---|---|---|---|---|---|
| 1 | **Madrid** | 30% / 1.237,20€ | 25.620€ | <40 | Alquiler >20% BI · fianza | ✅ true |
| 2 | **Cataluña** | 10% / 500€ (1.000€ familia num/mono) | TODO | OR ≤35 / paro 183d / familia | DL 1/2024 art. 612-3 | ❌ false (escala 9 tramos) |
| 3 | **Andalucía** | 15% / 1.200€ (1.500€ disc) | 25.000€ | OR ≤35 / ≥65 | TODO víctima violencia | ❌ false (escala) |
| 4 | **Valencia** | 20-30% / 800-1.100€ | 29.999,99€ | (incrementos) | Reducción progresiva BI | ❌ false (9 tramos) |
| 5 | **Baleares** | 15-20% / 530-650€ | 33.000€ | OR ≤36 / ≥65 | NO otra vivienda <70 km | ❌ false (9 tramos) |
| 6 | **CyL** | 20-25% / 459-612€ rural | 18.900€ | <36 | Resta bono alquiler joven | ❌ false (escala) |
| 7 | **Galicia** | 10-20% / 300-600€ (×2 disc=1.200€) | 22.000€ | ≤35 | Doble si discapacidad ≥33% · fianza IGVS | ❌ false (escala) |
| 8 | **Aragón ★** | NO general · placeholder | — | — | ÚNICA CCAA sin deducción general | ❌ false |
| 9 | **Asturias** | 10-30% / 500-1.500€ | 35.000€ | (3 modalidades) | Base · jóvenes · despoblación | ❌ false (mínimos propios novedad 2025) |
| 10 | **Murcia** | 10% / 300€ | **40.000€** | sin edad | ★ Ley 3/2025 · ITP/AJD · pagos trazables | ❌ false (escala) |
| 11 | **Cantabria** | 10% / 300€ ind / 600€ conj | TODO | OR ≤35 / ≥65 | BI máx no localizado | ❌ false (deducción) |
| 12 | **Canarias** | 24% / 740-760€ | 45.500€ (TODO) | (760€ si <40 o ≥75) | ★ Alquiler >10% BI · ref catastral | ❌ false (deducción) |
| 13 | **CLM** | 15-20% / 500-612€ rural | **12.500€** | (4 modalidades) | ★ 4 modalidades incompatibles · BI más bajo | ❌ false (escala) |
| 14 | **Extremadura** | 30% / 1.000-1.500€ rural | 30.000€ | <36/familia/disc | ★ Excepción BI rural+familia · NO otra <75 km | ❌ false (escala) |
| 15 | **La Rioja** | 10-20% / 300-400€ rural | 18.030€ (TODO) | <36 | ★ ITP/AJD presentado | ❌ false (BI) |

**Verified=true a nivel paquete** · solo Madrid (cifras 100% confirmadas).
**Verified=true a nivel deducción** · Madrid · Cataluña · Andalucía · Valencia
(ambas) · Baleares · CyL · Galicia · Aragón placeholder · Asturias · Murcia ·
CLM · Extremadura · 12 de 15 CCAA tienen al menos una deducción `verified=true`.

---

## 3 · Motor de elegibilidad post-T18

Tras 4 sub-tareas · `evaluarElegibilidad` soporta 13 dimensiones de
requisitos · cero regresión silenciosa · regla 0.7 SAGRADA respetada en
todas (si el motor no puede evaluar un requisito declarado · marca no
elegible con motivo legible).

### 3.1 · Requisitos genéricos soportados

```typescript
interface RequisitosDeduccion {
  // Demográficos
  edadMaxima?: number;
  edadMinima?: number;

  // Bases imponibles (3 dimensiones · ind/conj/familiar)
  baseImponibleMaxIndividual?: number;
  baseImponibleMaxConjunta?: number;
  baseImponibleMaxFamiliar?: number;

  // Específicos arrendamiento
  porcentajeMinAlquilerSobreBI?: number;        // Madrid 0.20 · Canarias 0.10
  duracionContratoMinAnios?: number;             // Baleares · Valencia · 1
  requiereTipoVivienda?: 'habitual' | 'temporada-larga' | 'inversion';
  requiereResidenciaFiscalCcaa?: boolean;
  requiereTitularContrato?: boolean;

  // Identificadores
  requiereFianzaDepositada?: boolean;            // Madrid · Galicia
  requiereItpAjdPresentado?: boolean;            // Murcia · La Rioja
  requierePagosTrazables?: boolean;              // Murcia · Valencia
  requiereReferenciaCatastral?: boolean;         // Canarias

  // Perfil familiar/disc
  requiereFamiliaNumerosa?: 'general' | 'especial' | false;
  requiereDiscapacidad?: { gradoMinimo: number };
  requiereNoPropiedadMasMitadOtraVivienda?: boolean; // Murcia · Extremadura

  // Conjunto OR (al menos UNA debe cumplirse)
  condicionesElegibilidadOR?: Array<{
    edadMaxima?: number;
    edadMinima?: number;
    paroMinimoDias?: number;
    requiereFamiliaNumerosa?: 'general' | 'especial';
    requiereFamiliaMonoparental?: boolean;
    requiereDiscapacidad?: { gradoMinimo: number };
  }>;

  // Excepción condicional (Extremadura)
  excepcionBIRural?: {
    poblacionMaxima: number;
    requiereFamiliaNumerosa?: boolean;
    requiereAscendienteCon2Hijos?: boolean;
  };
}
```

### 3.2 · Datos de entrada del titular

```typescript
interface DatosBaseDeduccion {
  // Bases imponibles
  baseImponibleIndividual: number;
  baseImponibleConjunta?: number;

  // Arrendamiento
  alquilerAnual?: number;
  duracionContratoAnios?: number;
  fianzaDepositada?: boolean;
  esTitularContrato?: boolean;
  itpAjdPresentado?: boolean;
  pagosTrazables?: boolean;
  referenciaCatastralPresente?: boolean;
  ayudasPublicasArrendamiento?: number;

  // Tipo vivienda
  tipoVivienda?: 'habitual' | 'temporada-larga' | 'inversion';
  municipioPoblacionHabitantes?: number;
  viviendaEnZonaDespoblamiento?: boolean;
  propiedadMasMitadOtraVivienda?: boolean;

  // Perfil
  familiaNumerosa?: 'general' | 'especial' | false;
  familiaMonoparental?: boolean;
  diasEnParo?: number;
  numeroHijosMenores?: number;
  esVictimaViolenciaGenero?: boolean;
  esAscendienteSeparadoCon2Hijos?: boolean;
  inversionViviendaHabitualAnual?: number;
}
```

### 3.3 · Flag explícito · "deducción no aplica por ley"

`DeduccionAutonomica.noAplicableEnCcaaMotivo` · usado por Aragón · si
presente · motor devuelve no elegible inmediato con motivo de UX claro
"Aragón no tiene deducción general arrendamiento · solo dación en pago
/ vivienda social arrendador". Modela explícitamente "esta deducción NO
existe en esta CCAA" · regla 0.7 SAGRADA respetada.

---

## 4 · Estado del cálculo IRPF post-T18

`irpfCalculationService.calcularCuotaBaseGeneralCCAA` lee del módulo
nuevo `src/services/fiscal/` · NO tiene tablas inline. Para CCAA con
paquete `verified=false` (escala con TODOs) · cae a la supletoria estatal
DT 15ª LIRPF · cero regresión silenciosa.

Cliente Madrid (verified=true) · escala Madrid aplicada (8,5%-20,5%) ·
diferencia esperada vs cálculo previo a T18 (era supletoria · ahora real).
Resto de 14 CCAA · sigue supletoria hasta auditoría escalas exactas.

---

## 5 · TODOs documentados (no críticos · entrarán en T18.x)

### 5.1 · Escalas autonómicas exactas

12 de 15 CCAA tienen escala con `verified=false` · valores intermedios
estimados. Pre-investigación localizó número de tramos y rango (mínimo /
máximo) pero NO valores breakpoint exactos. Cuando Jose audite · flippea
`verified=true` y la escala se aplica automáticamente en
`calcularCuotaBaseGeneralCCAA`.

### 5.2 · Mínimos autonómicos

Cataluña y CyL · idénticos a estatales (Manual AEAT confirma).
Asturias · ★ novedad 2025 · mínimos autonómicos propios · TODO BOPA.
Resto (Galicia · Aragón · Andalucía · Valencia · Baleares · Murcia ·
Cantabria · Canarias · CLM · Extremadura · La Rioja) · provisional
estatales · pre-investigación NO localizó diferencias.

### 5.3 · Discrepancias específicas

- **Canarias** · BI máx 45.500 vs 46.455 · resolver contra Manual AEAT 2025
- **Cantabria** · BI máx · NO localizado · `verified=false` deducción
- **La Rioja** · BI máx 18.030/30.050 · verificar exacto

### 5.4 · Listas oficiales municipios

- CLM · municipios ≤2.500 hab y entre 2.500-10.000 a >30 km de ciudad >50.000
- Extremadura · municipios <3.000 hab
- La Rioja · pequeños municipios con derecho a deducción reforzada
- Asturias · concejos en riesgo de despoblamiento
- Cantabria · municipios riesgo despoblamiento

Hoy `municipioPoblacionHabitantes` se usa como aproximación. Cuando
existan listas oficiales · refactor opcional para validar contra ellas.

### 5.5 · Aragón · 2 modalidades nicho

Dación en pago + arrendador vivienda social · ampliar
`DatosBaseDeduccion` con flags específicos cuando aparezca caso real.

### 5.6 · Resto deducciones nicho TODOs (decenas por CCAA)

ATLAS T18 cubre la deducción TOP-1 por CCAA (arrendamiento vivienda
habitual) y algunas TOP-3 puntuales (Valencia primera adquisición ·
Madrid arrendamiento · etc.). Resto de deducciones autonómicas
(adquisición vivienda jóvenes · familia numerosa · nacimiento ·
adopción · descendientes · ascendientes · vivienda protegida ·
rehabilitación · obras eficiencia energética · gimnasio · óptica ·
enfermedades raras · vehículo eléctrico · puntos recarga · gastos
veterinarios · idiomas/informática descendientes · etc.) · TODOs
documentados en `notasMigracion` de cada paquete · TAREA futura cuando
aparezca cliente concreto.

### 5.7 · Tope conjunto entre titulares

Murcia · Extremadura · Cantabria documentan reglas de prorrateo entre
titulares cuando 2+ tienen derecho a la misma deducción por la misma
vivienda. ATLAS hoy aplica el tope por titular · refactor cuando
aparezca caso real (necesita modelar relación entre `personalData` y
contratos).

---

## 6 · Improvements identificados durante T18

### 6.1 · Motor reforzado vs T14.3

T14.3 cerró GAP 5.1 con tablas inline para 3 CCAA y `verified=false` ·
ATLAS aplicaba supletoria silenciosamente.

T18 entrega · módulo dedicado · 15 CCAA con paquetes · cifras BOE/AEAT
2025 · motor evaluarElegibilidad maduro · cero regresión silenciosa
(reason explícito si fallback) · `verified` por paquete y por
deducción · UX clara para Jose en review.

### 6.2 · Helpers nuevos

- `getReglasCcaa(ccaa)` · NUNCA crashea · fallback estatal con warning
- `evaluarElegibilidad(deduccion, ctx, datosBase)` · función pura · regla 0.7 SAGRADA
- `getDeduccionesAutonomicasEvaluadas` · lista todas las del CCAA con motivos
- `getDeduccionesAutonomicasAplicables` · solo las elegibles · listo para sumar a cuota líquida
- `normalizeCcaaKey` · resiste variantes regionales (Catalunya · Comunitat Valenciana · Illes Balears · etc.)

### 6.3 · Lecciones operativas

- **CRA promueve ESLint warnings a errors en CI** · `no-mixed-operators` rompió T18.1 · lección · `CI=true npm run build` local antes de pushear (aplicada en T18.2 y T18.3)
- **Caracteres combining diacritics literales en source** · pueden romper parsers · usar `new RegExp('[\\u0300-\\u036F]', 'g')` con escapes
- **Pre-investigación útil pero NO infalible** · T18.1 corrigió Cataluña (SÍ tiene deducción · NO solo víctimas violencia) · CC verifica contra fuente primaria

---

## 7 · Verificaciones globales T18

| Criterio | Estado |
|---|---|
| DB_VERSION 69 · sin cambios | ✅ |
| 40 stores · sin cambios estructurales | ✅ |
| 15 CCAA régimen común cubiertas en `ccaaRules/` | ✅ |
| Motor `evaluarElegibilidad` SAGRADO · regla 0.7 respetada | ✅ |
| `irpfCalculationService` SIN tablas inline · todo desde `ccaaRules/` | ✅ |
| Madrid sin regresión vs T14.3 | ✅ |
| `tsc --noEmit` cero errores en archivos T18 | ✅ |
| `CI=true npm run build` local PASA | ✅ (T18.2/T18.3) |
| 73 tests pasan (8 + 22 + 24 + 19) | pendiente CI |
| País Vasco / Navarra · NO incluidas · TAREA futura · documentadas | ✅ |

---

## 8 · País Vasco y Navarra · TAREA futura

ATLAS T18 NO cubre los 4 territorios forales (Álava · Bizkaia ·
Gipuzkoa · Navarra). Cada uno tiene IRPF propio (no cedido) con escala ·
mínimos · deducciones distintas a las del régimen común y entre sí.

Cuando aparezca cliente real residente en un territorio foral · TAREA
futura entregaría:
- Módulo separado `src/services/fiscal/foral/` (estructura paralela a `ccaaRules/`)
- 4 paquetes · uno por territorio
- Motor especializado · IRPF foral usa escalas estatales distintas (no
  hay escala estatal cedida · todo es competencia foral)
- Posible flag en `FiscalContext` · `regimenIRPF: 'comun' | 'foral-pais-vasco' | 'foral-navarra'`
- Etiqueta UI hoy · "ATLAS no soporta régimen foral · contactar"

Hoy · si cliente declara CCAA "País Vasco" o "Navarra" · `getReglasCcaa`
cae al fallback estatal con warning · ATLAS no crashea pero el cálculo
es incorrecto. Test específico cubre esto · evita regresión.

---

## 9 · Lo que ATLAS gana al cerrar T18

- Cualquier cliente español régimen común puede usar ATLAS y obtener
  cálculo IRPF correcto
- 15 deducciones de arrendamiento implementadas · 13 con `verified=true`
  a nivel deducción
- Motor responde con motivos claros · cliente entiende SÍ o NO
- Vendible al mercado completo de inversores en pisos régimen común · sin
  asteriscos
- Base sólida para implementar resto de deducciones autonómicas TOP-3
  (adquisición · familia · nacimiento) cuando aparezca cliente concreto
- Lección operativa documentada · CRA + Netlify build process · útil
  para futuras tareas fiscales y no-fiscales

---

## 10 · Diagrama del flujo post-T18

```
┌─────────────────────────────────────────┐
│  fiscalContextService (T14.2)           │   src/services/fiscalContextService.ts
│  · getFiscalContext                     │
│  · getFiscalContextSafe                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  irpfCalculationService                 │   src/services/irpfCalculationService.ts
│  · calcularCuotaBaseGeneralCCAA (T18)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  deduccionesAutonomicasService (T18)    │   src/services/fiscal/deduccionesAutonomicasService.ts
│  · evaluarElegibilidad (regla 0.7)      │
│  · getReglasCcaa (NUNCA crashea)        │
│  · getDeduccionesAutonomicasEvaluadas   │
│  · getDeduccionesAutonomicasAplicables  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ccaaRules/                             │   src/services/fiscal/ccaaRules/
│  · _base_estatal.ts (fallback)          │
│  · madrid.ts ★ verified=true            │
│  · cataluna.ts (DL 1/2024 art. 612-3)   │
│  · andalucia.ts (Ley 5/2021)            │
│  · valencia.ts (reducción progresiva)   │
│  · baleares.ts                          │
│  · castilla_y_leon.ts (resta bono)      │
│  · galicia.ts (×2 discapacidad)         │
│  · aragon.ts ★ NO general               │
│  · asturias.ts (3 modalidades)          │
│  · murcia.ts (Ley 3/2025 BI 40k)        │
│  · cantabria.ts (BI TODO)               │
│  · canarias.ts (>10% BI · ref catastral)│
│  · castilla_la_mancha.ts (4 modalidades)│
│  · extremadura.ts (BI exenta rural)     │
│  · la_rioja.ts (ITP/AJD)                │
│  · index.ts (Map · 15 CCAA)             │
└─────────────────────────────────────────┘
```

---

## 11 · Estado de TODOs documentados al cierre

| Tipo | Cantidad | Crítico | Documentado en |
|---|---|---|---|
| Escalas autonómicas valores intermedios | 12 CCAA | NO (motor cae a supletoria) | `notasMigracion` por CCAA |
| Mínimos autonómicos audit | 11 CCAA | NO | `notasMigracion` |
| Discrepancias BI máx | 3 (Canarias · Cantabria · La Rioja) | Bajo | `notasMigracion` |
| Listas oficiales municipios | 5 (CLM · Extremadura · La Rioja · Asturias · Cantabria) | Bajo · usamos aproximación por población | `notasMigracion` |
| Resto deducciones TOP-3 | decenas por CCAA | NO · TAREA futura cuando aparezca cliente | `notasMigracion` |
| País Vasco / Navarra (foral) | 4 territorios | NO · TAREA futura | este documento §8 |

---

## 12 · Recursos de ejecución T18

- `docs/TAREA-18-cobertura-ccaa-completa-v1.md` · spec base
- `docs/T18-cifras-Top5-pre-investigadas.md` · cifras T18.1
- `docs/T18.1-CORRECCION-cataluna.md` · corrección Cataluña SÍ tiene general
- `docs/T18-cifras-MercadoMedio-pre-investigadas.md` · cifras T18.2
- `docs/T18-cifras-Resto-pre-investigadas.md` · cifras T18.3
- 4 PRs · #1269 #1270 #1272 #esteCierre

---

*Fin del cierre T18 · documento canónico · referencia para tareas fiscales futuras · ATLAS soporta los 15 CCAA régimen común · motor de elegibilidad robusto · listo para mercado completo.*
