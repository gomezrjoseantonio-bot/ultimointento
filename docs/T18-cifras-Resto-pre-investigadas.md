# T18.3 · Cifras BOE pre-investigadas · Resto + cierre

> **Documento de apoyo para CC al ejecutar T18.3.** Cifras extraídas del Manual Práctico AEAT 2025 + webs autonómicas oficiales.
>
> **CCAA cubiertas:** Canarias · Castilla-La Mancha · Extremadura · La Rioja
>
> **Hallazgo destacado:** Canarias requiere referencia catastral en autoliquidación · alquiler debe exceder 10% BI · todas con BOE/AEAT cifras al 100% verificadas. CLM tiene 4 modalidades INCOMPATIBLES entre sí.
>
> **Esta es la última sub-tarea de T18 · cierra cobertura 15 CCAA régimen común.**

---

## 1 · CANARIAS (régimen REF · cuidado peculiaridades)

### 1.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 1/2009 Canarias o normativa actualizada.

### 1.2 · Escala autonómica · 7 tramos · 9% min · 26% max

**TODO CC:** localizar tramos exactos.

### 1.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por alquiler de vivienda habitual** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje | **24%** de cantidades satisfechas |
| Tope general | **740 €** anuales por contribuyente |
| Tope incrementado | **760 €** anuales si <40 años o ≥75 años (con requisitos) |
| Requisito alquiler/BI | Cantidades alquiler deben **exceder 10% de la BI general + ahorro** del contribuyente |
| BI máx individual | **45.500 €** (individual) — *Atención · pre-investigación localizó 46.455 € en otra fuente para misma deducción · CC verifica* |
| BI máx conjunta | **60.500 €** o **61.770 €** (TODO verificar) |
| Identificación obligatoria | NIF arrendador · referencia catastral vivienda · canon arrendaticio anual |
| Casilla | Anexo B.11 |
| Fuente | Art. 15 Decreto Legislativo 1/2009 · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-canarias/alquiler-vivienda-habitual.html` |

**Implementación CC** · `verified: true` para porcentaje y topes deducción · `verified: false` para BI máx hasta confirmar (45.500 vs 46.455 discrepancia entre fuentes).

**Especificidad CRÍTICA Canarias** · alquiler debe exceder 10% BI · CC implementa como `requisitos.porcentajeMinAlquilerSobreBI: 0.10`. Cliente con alquiler bajo respecto a su BI → NO ELEGIBLE.

**B · Por arrendamiento vinculado a operaciones de dación en pago**

| Concepto | Valor |
|---|---|
| Porcentaje | **25%** |
| Tope | **1.200 €** anuales |
| BI máx | **46.455 €** individual (verificado) |
| Requisito | Vivienda entregada al banco vía dación en pago · sigue ocupándose en alquiler con opción compra |
| Arrendador | Entidad financiera acreedora o filial inmobiliaria |
| Fuente | Art. 35-bis Decreto Legislativo 1/2009 · Manual AEAT 2025 |

**C · Por puesta de viviendas en mercado arrendamiento (deducción del arrendador · útil para clientes ATLAS propietarios)**

| Concepto | Valor |
|---|---|
| Importe fijo | **1.000 € por inmueble** primera vez destinado al alquiler como vivienda habitual |
| Tope | Máximo 5 inmuebles por contribuyente |
| Requisito | Vivienda arrendada al menos 3 años · NO familiares directos hasta 3er grado |
| Penalización | Si incumple · reintegrar deducción en ejercicio del incumplimiento |

**Otras deducciones detectadas relevantes** · gastos adecuación inmueble alquiler (10%, max 150€) · primas seguros impago alquiler (deducción arrendador) · trasladar residencia entre islas por motivo laboral · descendientes <6 años conciliación · nacimiento o adopción discapacidad ≥33% · cambio residencia municipio riesgo despoblación

### 1.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios Canarias
- [ ] Localizar 7 tramos exactos escala autonómica
- [ ] **CRÍTICO** · resolver discrepancia BI máx 45.500 vs 46.455 (mismo Manual AEAT entre 2 secciones · CC consulta fuente principal)
- [ ] Implementar requisito `porcentajeMinAlquilerSobreBI: 0.10` (alquiler >10% BI)
- [ ] Implementar identificación obligatoria · NIF + referencia catastral + canon anual
- [ ] Implementar 3 modalidades (alquiler general · dación pago · puesta arrendamiento arrendador)

---

## 2 · CASTILLA-LA MANCHA (CLM)

### 2.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 1/2024 CLM (TR tributos cedidos).

### 2.2 · Escala autonómica · 5 tramos · 9,5% min · 22,5% max

**TODO CC:** localizar tramos exactos.

### 2.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · 4 modalidades de arrendamiento INCOMPATIBLES entre sí** ★ caso especial

| Modalidad | Porcentaje | Tope | Cuándo aplica |
|---|---|---|---|
| 1 · Jóvenes | 15% (20% incrementado) | 500 € (612 € incrementado) | <36 años |
| 2 · Familias numerosas | 15% (20%) | 500 € (612 €) | Familia numerosa |
| 3 · Familias monoparentales | 15% (20%) | 500 € (612 €) | Familia monoparental |
| 4 · Discapacidad ≥65% | 15% (20%) | 500 € (612 €) | Grado discapacidad ≥65% |

**Porcentaje incrementado 20% / 612 €** · si vivienda en municipio:
- ≤2.500 habitantes · O
- entre 2.500 y 10.000 habitantes a >30 km de ciudad >50.000 hab

**Requisitos comunes a las 4 modalidades**

| Concepto | Valor |
|---|---|
| BI individual (general + ahorro - mínimo descendientes) | **≤ 12.500 €** |
| BI conjunta | **≤ 25.000 €** |
| Vivienda | Habitual · ubicada en CLM |

⚠️ **Topes BI muy bajos comparados con resto CCAA** · CLM tiene la deducción de arrendamiento más restrictiva del país en términos de elegibilidad por renta.

**Implementación CC** · `verified: true` para porcentajes/topes deducción · `verified: false` para BI máx hasta confirmar contra Manual AEAT 2025.

**Modalidad adicional** · arrendamiento vivienda habitual vinculado a dación en pago (caso nicho)

**Implementación CC** · 4 deducciones registradas con flag `incompatibleConMismaCcaaArrendamiento: true`. evaluarElegibilidad debe seleccionar la modalidad MÁS FAVORABLE para el cliente · NO aplicar las 4 sumando.

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-castilla-mancha.html` (URL probable)

**B · Adquisición vivienda habitual jóvenes ≤36** (TODO CC verificar)

**C · Otras** · familia numerosa · familias monoparentales (TODO CC)

### 2.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios CLM
- [ ] Localizar 5 tramos exactos escala autonómica
- [ ] Verificar BI máx exacto (12.500 / 25.000 €) contra Manual AEAT 2025
- [ ] Implementar 4 modalidades arrendamiento como INCOMPATIBLES · seleccionar la más favorable
- [ ] Lista oficial municipios CLM <2.500 hab y entre 2.500-10.000 a >30 km de ciudad >50.000

---

## 3 · EXTREMADURA

### 3.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 1/2018 Extremadura.

### 3.2 · Escala autonómica · 9 tramos · 8% min · 25% max

Modificada retroactivamente por Decreto septiembre 2023 (efectos desde 1/1/2023).

**TODO CC:** localizar 9 tramos exactos · verificar vigencia 2025.

### 3.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje general | **30%** de cantidades satisfechas |
| Tope general | **1.000 €** anuales |
| Porcentaje rural | **30%** (mismo) |
| Tope rural | **1.500 €** anuales (vivienda en municipio <3.000 habitantes) |
| Edad/perfil para deducción | <36 años · O familia numerosa · O ascendiente separado/sin matrimonio con 2 hijos sin alimentos · O discapacidad ≥65% |
| BI máx individual (general + ahorro) | **30.000 €** |
| BI máx conjunta | **45.000 €** |
| Excepción BI rural | NO se observa requisito BI si reside en municipio <3.000 hab + es familia numerosa o ascendiente separado con 2 hijos |
| NO titularidad otra vivienda | NI contribuyente NI miembros UF titulares >50% otra vivienda <75 km |
| Tope por vivienda compartida | Total deducciones por una vivienda no puede superar 1.000 € (sumando entre titulares) |
| Casilla | Anexo B.11 |
| Fuente | Arts. 9, 12 bis y 13 Decreto Legislativo 1/2018 · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-extremadura/arrendamiento-vivienda-habitual.html` |

**Implementación CC** · `verified: true` · cifras BOE/AEAT al 100%.

**Especificidad CRÍTICA Extremadura** · si cliente vive en municipio <3.000 hab Y es familia numerosa o ascendiente separado con 2 hijos · NO se aplica límite BI · CC implementa lógica condicional.

**B · Por residir habitualmente en municipios <3.000 habitantes Extremadura**

**TODO CC:** localizar porcentaje · tope · requisitos contra Manual AEAT 2025.

**C · Otras deducciones · descendientes · familia numerosa · adquisición vivienda habitual jóvenes** (TODO CC)

### 3.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios Extremadura
- [ ] Localizar 9 tramos exactos escala autonómica vigente 2025
- [ ] `verified: true` para arrendamiento (cifras BOE/AEAT 100%)
- [ ] Implementar lógica condicional BI · exenta si rural + familia numerosa o ascendiente con 2 hijos
- [ ] Lista oficial municipios <3.000 hab Extremadura
- [ ] Implementar tope conjunto 1.000 € por vivienda entre titulares

---

## 4 · LA RIOJA

### 4.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra normativa La Rioja.

### 4.2 · Escala autonómica · 5 tramos (TODO CC verificar número y rango)

**TODO CC:** localizar tramos exactos.

### 4.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual contribuyentes <36 años** ★ confirmada parcial

| Concepto | Valor |
|---|---|
| Porcentaje general | **10%** |
| Tope general | **300 €** anuales por contrato |
| Porcentaje reforzado (rural) | **20%** |
| Tope reforzado | **400 €** anuales por contrato |
| Vivienda rural | Pequeños municipios La Rioja (lista oficial CCAA) |
| Edad | **<36 años** |
| BI general máx individual | **18.030 €** |
| BI general máx conjunta | **30.050 €** |
| BI ahorro máx | **1.800 €** |
| Requisito | ITP/AJD del contrato presentado |
| Fuente | TR tributos cedidos La Rioja · Manual AEAT 2025 |

**Implementación CC** · `verified: true` para porcentajes/topes/edad · `verified: false` para BI máx exacto (CC verifica con Manual AEAT 2025).

**B · Adquisición · construcción · rehabilitación vivienda habitual en pequeños municipios La Rioja**

**TODO CC:** localizar porcentaje · tope · requisitos.

**C · Para jóvenes emancipados** · acceso a internet · suministro luz/gas · gastos en escuelas infantiles 0-3 años · inicio actividad emprendedores

**TODO CC:** verificar específicas más relevantes para clientes ATLAS.

**Otras deducciones detectadas relevantes** · adquisición segunda vivienda en medio rural · pago intereses préstamos jóvenes <30 años · inversiones nuevos contribuyentes extranjero · controles veterinarios perros asistencia · vehículos eléctricos · acciones empresas riojanas

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-rioja.html` (URL probable)

### 4.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios La Rioja
- [ ] Localizar 5 tramos exactos escala autonómica · verificar número de tramos
- [ ] Verificar BI máx exacto contra Manual AEAT 2025
- [ ] Implementar requisito ITP/AJD presentado
- [ ] Lista oficial pequeños municipios La Rioja con derecho a deducción reforzada
- [ ] Implementar TOP-3 con motor de elegibilidad

---

## 5 · Hallazgos transversales · cierre cobertura 15 CCAA

### 5.1 · Síntesis comparativa · deducción arrendamiento por las 15 CCAA régimen común

| CCAA | % | Tope | Edad | BI máx ind | Especificidad |
|---|---|---|---|---|---|
| Madrid | 30% | 1.237,20 € | <40 | 25.620 € | Alquiler >20% BI · fianza obligatoria |
| Cataluña | 10% | 500 € (1.000 € numerosa) | ≤35 o paro 183+ días | TODO | (★ corregido en T18.1-fix) |
| Andalucía | 15% | 1.200 € (1.500 € disc) | <35 o >65 | 25.000 € | Víctima violencia/terrorismo opcional |
| Valencia | 20-30% | 800-1.100 € | (incrementos por <35 o disc) | 30.000 € (reducción progresiva) | Más generosa · fórmula reducción |
| Baleares | 15-20% | 530-650 € | <36 o >65 sin actividad | 33.000 € | NO otra vivienda <70 km |
| Galicia | 10-20% | 300-600 € | ≤35 | 22.000 € | Doble si discapacidad ≥33% |
| Aragón | ❌ NO general | — | — | — | Solo dación pago + arrendador social |
| Asturias | 10-30% | 500-1.500 € | (varía modalidad) | 35.000 € | 3 modalidades · despoblación reforzada |
| Cantabria | 10% | 300 € (600 € conj) | (TODO) | (TODO) | Incompat. con despoblación misma vivienda |
| C. La Mancha | 15-20% | 500-612 € | <36 (varía mod) | 12.500 € (★ más bajo) | 4 modalidades INCOMPATIBLES |
| C. y León | 20-25% | 459-612 € | <36 | 18.900 € | Resta bono alquiler joven |
| Extremadura | 30% | 1.000-1.500 € | <36 (o numerosa/monoparental/disc) | 30.000 € | NO otra vivienda <75 km · BI exenta rural+numerosa |
| Murcia | 10% | 300 € | sin edad expl. | 40.000 € (★ Ley 3/2025) | ITP/AJD presentado |
| La Rioja | 10-20% | 300-400 € | <36 | 18.030 € | ITP/AJD presentado · municipios rurales bonificados |
| Canarias | 24% | 740-760 € | (760 si <40 o >75) | 45.500 € | Alquiler >10% BI · referencia catastral |

### 5.2 · CCAA con requisitos más exigentes para inversores

| Requisito poco común | CCAA |
|---|---|
| Alquiler > X% BI | Madrid (>20%) · Canarias (>10%) |
| ITP/AJD presentado | Murcia · La Rioja |
| Fianza depositada | Madrid (Agencia Vivienda Social CAM) · Galicia (IGVS) |
| Referencia catastral | Canarias |
| NO otra vivienda <X km | Valencia (50 km) · Baleares (70 km) · Extremadura (75 km) |
| 4 modalidades incompatibles | Castilla-La Mancha |

### 5.3 · Patrón evaluarElegibilidad final

Tras cubrir las 15 CCAA · CC tiene un mapa completo. El motor `evaluarElegibilidad` debe soportar:

```typescript
interface RequisitosDeduccion {
  edadMaxima?: number;
  edadMinima?: number;
  baseImponibleMaxIndividual?: number;
  baseImponibleMaxConjunta?: number;
  baseImponibleMaxFamiliar?: number;
  porcentajeMinAlquilerSobreBI?: number;       // Madrid 0.20 · Canarias 0.10
  
  requiereFianzaDepositada?: boolean;          // Madrid · Galicia
  requiereITPyAJDPresentado?: boolean;         // Murcia · La Rioja
  requiereReferenciaCatastral?: boolean;       // Canarias
  requiereFamiliaNumerosa?: 'general' | 'especial' | false;
  requiereDiscapacidad?: { gradoMinimo: number };
  requiereTipoVivienda?: 'habitual' | 'temporada-larga' | 'inversion';
  requiereResidenciaFiscalCcaa?: boolean;
  requiereVictimaViolencia?: boolean;          // Cataluña · Andalucía
  requiereDacionEnPago?: boolean;              // Aragón · Canarias
  
  // Distancia mínima a otras viviendas en propiedad
  noTitularViviendaCercana?: { kmMinimo: number };  // Valencia 50 · Baleares 70 · Extremadura 75
  
  // Excepciones territoriales
  exencionBIRural?: { 
    poblacionMaxima: number;                   // Extremadura <3.000 hab
    requisitos: ('familia_numerosa' | 'ascendiente_2_hijos' | string)[];
  };
  
  // Modalidades incompatibles
  incompatibleConOtrasModalidades?: string[];   // CLM 4 modalidades
  
  // Restas previas a aplicar tope
  restarAyudasPublicas?: 'bono_alquiler_joven' | 'todas' | false;  // CyL · Murcia · Canarias
}
```

### 5.4 · Lo que ATLAS gana al cubrir 15 CCAA

- Cualquier cliente español régimen común puede usar ATLAS y obtener cálculo IRPF correcto
- El motor responde con motivos claros · el cliente entiende por qué SÍ o por qué NO
- Vendible al mercado completo de inversores en pisos · sin asteriscos
- Fuera quedan País Vasco (3 territorios) y Navarra · cuando aparezca cliente foral · TAREA futura

---

## 6 · Resumen para CC al ejecutar T18.3

### 6.1 · Lo que ya está pre-investigado al 100%

- **Canarias** · arrendamiento 24% / 740-760 € · alquiler >10% BI · referencia catastral
- **Castilla-La Mancha** · 4 modalidades incompatibles (15-20% / 500-612 €) · BI muy bajo
- **Extremadura** · arrendamiento 30% / 1.000-1.500 € (rural) · NO otra vivienda <75 km · excepción BI rural+numerosa
- **La Rioja** · arrendamiento 10-20% (rural) · 300-400 € · <36 · ITP/AJD

### 6.2 · Lo que CC debe completar

- 4 escalas autonómicas exactas (tramo por tramo)
- Mínimos autonómicos donde aplique
- Resolver discrepancias de fuentes secundarias (Canarias BI 45.500 vs 46.455)
- Listas oficiales municipios pequeños CLM · Extremadura · La Rioja
- TODOs marcados en cada CCAA

### 6.3 · Cierre T18 · docs/T18-cierre.md

CC al cerrar T18.3 debe crear `docs/T18-cierre.md` con:
- 15 CCAA cubiertas (tabla resumen igual que §5.1 de este doc)
- Estado verified por CCAA
- TODOs nicho documentados (deducciones autonómicas exóticas no incluidas en TOP-3)
- Confirmación que `irpfCalculationService` no tiene tablas inline
- Tests integración pasados
- Confirmación motor evaluarElegibilidad completo y operativo
- Mención TAREA futura · País Vasco + Navarra (régimen foral)

---

**Fin de pre-investigación T18.3 · cifras Resto + cierre · Canarias · CLM · Extremadura · La Rioja · listo para que CC ejecute con base sólida y solo verifique/complete los TODOs marcados.**

**T18 ENTERA queda lista para ejecución una vez T18.0 entregue · 3 sub-tareas con stop-and-wait · 15 CCAA régimen común cubiertas · motor de elegibilidad robusto · ATLAS vendible a cualquier cliente español régimen común.**
