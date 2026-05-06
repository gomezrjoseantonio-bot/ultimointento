# T18.1 · Cifras BOE pre-investigadas · Top 5 mercado inversor

> **Documento de apoyo para CC al ejecutar T18.1.** Cifras extraídas del Manual Práctico AEAT 2025 + webs autonómicas oficiales. Cada cifra tiene fuente citada con URL.
>
> **Uso por CC:** auditar y verificar cada cifra contra la URL oficial. Si la cifra coincide con la fuente · marca `verified: true`. Si la cifra discrepa · usa la fuente y marca verified con razón. Si la fuente no es accesible o el documento dice algo distinto · marca `verified: false` con TODO concreto. **NUNCA inventar.**
>
> **Fecha de pre-investigación:** 2026-05-06 · Manual práctico Renta 2025 (declaración a presentar abril-junio 2026)
>
> **CCAA cubiertas en este documento:** Cataluña · Andalucía · Comunidad Valenciana · Baleares · Castilla y León
>
> **CCAA pendientes para T18.2 y T18.3:** Galicia · Aragón · Asturias · Murcia · Cantabria · Canarias · Castilla-La Mancha · Extremadura · La Rioja · Madrid (ya en T18.0)
>
> **CCAA fuera de T18:** País Vasco (3 territorios forales) · Navarra · régimen IRPF propio · TAREA futura

---

## 0 · Patrón general · qué fuentes usa este documento

| Tipo de fuente | URL pattern |
|---|---|
| Manual Práctico AEAT 2025 deducciones autonómicas (oficial) | `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-{ccaa}.html` |
| Manual Práctico AEAT 2025 cumplimentación (oficial) | `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/10-cumplimentacion-irpf-deducciones-autonomicas/10_X-{ccaa}/` |
| Web autonómica oficial | varía por CCAA (Hisenda Generalitat Valenciana · Tributos JCYL · ATC Generalitat Cataluña · etc.) |

CC al ejecutar debe leer los URLs oficiales (no fuentes secundarias tipo TaxDown · Bankinter · etc.). Las fuentes secundarias se usaron en pre-investigación para localizar cifras pero NO se citan como fuente final.

---

## 1 · CATALUÑA

> Para cliente residente fiscal en Cataluña

### 1.1 · Mínimos personales y familiares autonómicos

**Cataluña adopta IDÉNTICAS cifras que las estatales** · NO modifica los importes del Art. 56-61 Ley IRPF.

Fuente · Manual Práctico AEAT 2025 · *"Las Comunidades Autónomas de Castilla y León y Cataluña han fijado importes para el mínimo personal y familiar de idéntica cuantía a los establecidos en la Ley del IRPF"*. URL oficial · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/`

**Implementación CC** · `minimoPersonalFamiliar` de Cataluña = mismo objeto que `_base_estatal.ts`. Marcar `verified: true` con cita.

### 1.2 · Escala autonómica · 9 tramos

| # | Hasta | Tipo marginal |
|---|---|---|
| 1 | 12.450 € | 10,50% |
| 2 | 17.707 € | 12,00% |
| 3 | 20.200 € | 14,00% |
| 4 | 21.000 € | 14,00% |
| 5 | 33.007 € | 15,00% |
| 6 | ... | ... |
| 9 | >175.000 € (aprox) | 25,50% |

**TODO CC:** la pre-investigación localizó solo los primeros 5 tramos con certeza. Los tramos 6-9 deben verificarse contra el Decret legislatiu de la Generalitat de Catalunya. URL oficial · `https://atc.gencat.cat/es/tributs/irpf/`. Marcar `verified: false` hasta confirmar 9 tramos completos.

Tipo marginal mínimo · 9,5%. Tipo marginal máximo · 25,5%. (Esto SÍ está confirmado por múltiples fuentes secundarias · solo falta el desglose exacto por tramo)

### 1.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Tramo autonómico inversión vivienda habitual (régimen transitorio · adquirida antes 01/01/2013)**

- Deducción · porcentaje variable según régimen transitorio estatal
- Aplicable solo a contribuyentes que ya venían aplicando deducción inversión vivienda habitual antes del 1/1/2013
- Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna.html`

**B · Por alquiler vivienda habitual de víctimas de violencia machista**

- Caso muy específico · NO es deducción general arrendamiento
- Fuente · misma URL anterior

**C · Cataluña NO tiene deducción general de arrendamiento vivienda habitual para inquilinos**

⚠️ **HALLAZGO IMPORTANTE** · Cataluña es de las CCAA que **NO tienen deducción general de arrendamiento** para inquilinos jóvenes. La única deducción de alquiler es para víctimas de violencia machista. Para 2026 (a declarar 2027) se han aprobado deducciones rurales pero NO para 2025.

Fuente · web Agencia Tributaria de Catalunya · `https://atc.gencat.cat/es/tributs/irpf/`

**Implementación CC** · en `cataluna.ts` · NO incluir `arrendamiento-vivienda-habitual` general. Solo casos especiales con `requiereVictimaViolencia: true`. Cliente que pregunte por deducción general en Cataluña verá "ELEGIBLE: false · motivo: Cataluña no tiene deducción general arrendamiento vivienda habitual para inquilinos".

### 1.4 · TODOs concretos para CC

- [ ] Verificar 9 tramos completos de escala autonómica Cataluña (web ATC Generalitat)
- [ ] Verificar `verified=true` para mínimos = estatales (citar AEAT manual)
- [ ] Implementar deducción "arrendamiento vivienda víctimas violencia" como nicho · NO general

---

## 2 · ANDALUCÍA

### 2.1 · Mínimos personales y familiares autonómicos

Andalucía aprobó importes propios. CC debe leer Art. de la Ley 5/2021 de Tributos Cedidos de Andalucía + actualizaciones Ley 8/2025 (de 22 de diciembre).

**TODO CC:** comparar importes Andalucía vs estatales. Pre-investigación NO localizó cifras concretas distintas a estatales · provisional `verified: false` hasta verificar contra Ley 5/2021.

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-andalucia.html`

### 2.2 · Escala autonómica · 5 tramos · 9,5% min · 22,5% max

**TODO CC:** localizar los 5 tramos exactos contra Ley 5/2021 Andalucía o web Hacienda Junta de Andalucía. Pre-investigación confirmó número de tramos y rango pero no valores exactos por tramo.

### 2.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por cantidades invertidas en alquiler vivienda habitual** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje | **15%** de cantidades satisfechas |
| Tope general | **1.200 €** anuales |
| Tope si discapacidad | **1.500 €** anuales |
| Edad | **Menor de 35 años** o **mayor de 65 años** o víctima violencia/terrorismo |
| BI máx individual | **25.000 €** |
| BI máx conjunta | **30.000 €** |
| Otros requisitos | NIF arrendador en autoliquidación |
| Fuente | `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/10-cumplimentacion-irpf-deducciones-autonomicas/10_1-andalucia/10_1_3-cantidades-invertidas-alquiler-vivienda-habitual.html` |

**Implementación CC** · `verified: true` · cifras están en BOE/manual AEAT 2025.

**B · Por inversión en vivienda habitual protegida** (vivienda protegida según normativa CCAA)

| Concepto | Valor |
|---|---|
| Porcentaje | **2%** general |
| Porcentaje incrementado | **6%** si menor 35 años |
| Requisito edad | Comprador menor 35 años a 31/12/2025 (para 6%) |
| Requisito vivienda | Calificación protegida en fecha devengo |
| Requisito ingresos | No exceder 2,5×IPREM (16.135,07 €) régimen especial / 3,5×IPREM (22.589,10 €) general / 5,5×IPREM (35.497,56 €) |
| Inicio adquisición | Posterior a 1/1/2003 |
| Fuente | Ley 5/2021 Tributos Cedidos Andalucía + manual AEAT |

**C · Por nacimiento, adopción, familia monoparental** · cantidades variables

**Otras deducciones detectadas pero fuera de TOP-3** · gastos defensa jurídica laboral · gastos veterinarios · enseñanza idiomas/informática descendientes · gimnasio/deporte · enfermedad celíaca

### 2.4 · TODOs concretos para CC

- [ ] Verificar mínimos personales y familiares autonómicos de Andalucía contra Ley 5/2021
- [ ] Localizar 5 tramos exactos de escala autonómica
- [ ] `verified: true` para deducción arrendamiento (cifras BOE/AEAT al 100%)
- [ ] Implementar TOP-3 con motor de elegibilidad estricto

---

## 3 · COMUNIDAD VALENCIANA

### 3.1 · Mínimos personales y familiares autonómicos

Comunidad Valenciana aprobó importes propios.

**TODO CC:** verificar importes Valencia contra Ley 13/1997 de la Generalitat Valenciana (texto refundido tributos cedidos) + actualizaciones. Pre-investigación NO localizó cifras concretas distintas a estatales.

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana.html`

### 3.2 · Escala autonómica · 9-tramos · 10% min · 29,5% max ★ tipo más alto de España

**TODO CC:** localizar los tramos exactos. Pre-investigación confirmó rango y número de tramos pero no valores por tramo.

Fuente alternativa · `https://hisenda.gva.es/es/web/tributos/beneficis-fiscals-2025`

### 3.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento o pago por cesión en uso de vivienda habitual** ★ una de las más generosas de España

| Concepto | Valor |
|---|---|
| Porcentaje base | **20%** · tope **800 €** |
| Porcentaje incrementado 1 | **25%** · tope **950 €** si reúne **1** condición |
| Porcentaje incrementado 2 | **30%** · tope **1.100 €** si reúne **2 o más** condiciones |
| Condiciones | Edad ≤35 años · grado discapacidad física/sensorial ≥65% o psíquica ≥33% · víctima violencia género |
| Requisitos contrato | Posterior a 23/04/1998 · duración ≥1 año · pago bancario/tarjeta/cheque |
| Requisito titularidad | NO ser propietario otra vivienda <50 km |
| BI máx individual | **30.000 €** |
| BI máx conjunta | **47.000 €** |
| Casilla | 1095 |
| Fuente | Art. 4.1.n Ley 13/1997 GV + `https://hisenda.gva.es/es/web/tributos/beneficis-fiscals-2025` |

**Implementación CC** · `verified: true` · cifras BOE/AEAT al 100%. Importante · base imponible deducción reduce con fórmula progresiva entre 27.000 y 30.000 individual / 44.000 y 47.000 conjunta. CC debe implementar la fórmula de reducción progresiva · NO solo el corte binario.

**B · Por primera adquisición de vivienda habitual · contribuyentes ≤35 años**

| Concepto | Valor |
|---|---|
| Porcentaje | **5%** sobre cantidades satisfechas (excluye intereses) |
| Edad | ≤35 años a 31/12/2025 |
| Primera vivienda | NO haber sido propietario antes |
| BI máx individual | 27.000 € (íntegro) · reducción progresiva hasta 44.000 € |
| BI máx conjunta | 44.000 € (íntegro) · reducción progresiva hasta 47.000 € |
| Patrimonio | Debe aumentar al menos en cuantía invertida |
| Pagos | Trazables (transferencia · tarjeta · cheque) |
| Casilla | 1083 |
| Fuente | Ley 13/1997 GV |

**C · Por contribuyentes con 2+ descendientes**

| Concepto | Valor |
|---|---|
| Porcentaje | **10%** del importe de la cuota íntegra autonómica una vez deducidas minoraciones |
| BI máx | 30.000 € (suma de bases imponibles individuales si es declaración conjunta) |
| Fuente | Art. 4.1.t Ley 13/1997 GV |

**Otras deducciones detectadas relevantes pero fuera de TOP-3** · arrendamiento vivienda por actividad laboral en distinto municipio (10%, max 224 €) · obras conservación/mejora vivienda habitual (20%, base máx 5.500 €) · incremento intereses hipoteca 2025 vs 2024 (50%, máx 100 €) · autoconsumo eléctrico (40%, base máx 8.800 €)

### 3.4 · TODOs concretos para CC

- [ ] Verificar importes mínimos personales y familiares autonómicos contra Ley 13/1997
- [ ] Localizar 9 tramos exactos escala autonómica Valencia
- [ ] **CRÍTICO** · implementar fórmula de reducción progresiva BI 27k-30k / 44k-47k para deducción arrendamiento (no es corte binario)
- [ ] `verified: true` para arrendamiento (cifras BOE/AEAT al 100%)

---

## 4 · BALEARES

### 4.1 · Mínimos personales y familiares autonómicos

Baleares aprobó importes propios.

**TODO CC:** verificar importes Baleares. Pre-investigación NO localizó cifras concretas distintas a estatales.

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/illes-balears.html` (URL probable · verificar exacta)

### 4.2 · Escala autonómica · 9 tramos · 9% min · 24,75% max

Baleares aplicó desde 2024 reducción de 0,5 puntos en marginales para BI ≤30.000 €, y 0,25 puntos para BI >30.000 €.

**TODO CC:** localizar 9 tramos exactos.

### 4.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje base | **15%** · tope **530 €** anuales |
| Porcentaje incrementado | **20%** · tope **650 €** anuales |
| Requisitos base (15%/530€) | Menor 36 años o mayor 65 años SIN actividad laboral/profesional |
| Requisitos incrementado (20%/650€) | Una de · menor 30 años · discapacidad ≥33% · derecho mínimo discapacidad ascendiente o descendiente · familia numerosa · familia monoparental con 2+ hijos · autónomo dado de alta ≥183 días |
| Duración mínima contrato | 1 año |
| Requisito titularidad | Ni contribuyente ni miembros UF titulares de otra vivienda <70 km (excepción · fuera Baleares · otra isla · genera rendimientos capital inmobiliario) |
| BI máx individual | **33.000 €** |
| BI máx conjunta | **52.800 €** |
| BI máx familia numerosa general | 39.600 / 63.360 € |
| Fuente | `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2024/10-cumplimentacion-irpf-deducciones-autonomicas/10_4-illes-balears/10_4_12-arrendamiento-vivienda-habitual.html` |

**Nota CC** · URL es ejercicio 2024 · CC debe verificar URL 2025 equivalente. Cifras suelen mantenerse pero verificar tope BI familia numerosa.

**Implementación CC** · `verified: true` (cifras AEAT confirmadas con detalle).

**B · Para arrendador de bienes inmuebles destinados a vivienda permanente** (deducción del arrendador · aplicable a clientes ATLAS que sean propietarios)

**TODO CC:** localizar porcentaje · tope · requisitos · fuente Manual AEAT 2025 Baleares.

**C · Por adquisición primera vivienda · familias numerosas o monoparentales**

**TODO CC:** localizar porcentaje · tope · requisitos.

**Otras deducciones detectadas relevantes** · acogimiento mayores 65 o discapacidad · inversión vivienda protegida · rehabilitación bienes inmuebles centros históricos · descendientes/acogidos <6 años (conciliación) · cambio residencia entre islas (laboral)

### 4.4 · TODOs concretos para CC

- [ ] Verificar mínimos personales y familiares autonómicos contra Decret legislatiu Baleares
- [ ] Localizar 9 tramos exactos escala autonómica
- [ ] Verificar URL Manual AEAT 2025 Baleares (no 2024)
- [ ] Verificar tope BI familia numerosa en deducción arrendamiento
- [ ] Implementar TOP-3 (arrendatario · arrendador · adquisición)

---

## 5 · CASTILLA Y LEÓN

### 5.1 · Mínimos personales y familiares autonómicos

**Castilla y León adopta IDÉNTICAS cifras que las estatales** · NO modifica los importes del Art. 56-61 Ley IRPF.

Fuente · Manual Práctico AEAT 2025 · *"Las Comunidades Autónomas de Castilla y León y Cataluña han fijado importes para el mínimo personal y familiar de idéntica cuantía a los establecidos en la Ley del IRPF"*. URL oficial · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/`

**Implementación CC** · `minimoPersonalFamiliar` de CyL = mismo objeto que `_base_estatal.ts`. Marcar `verified: true` con cita.

### 5.2 · Escala autonómica · 5 tramos · 9% min · 21,5% max

**TODO CC:** localizar los 5 tramos exactos contra Decreto Legislativo 1/2013 CyL o web `https://tributos.jcyl.es`.

### 5.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual por jóvenes** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje base | **20%** · tope **459 €** anuales |
| Porcentaje rural | **25%** · tope **612 €** anuales |
| Edad | **Menor de 36 años** |
| Requisito vivienda rural (para 25%/612€) | Municipio o entidad local menor que NO exceda 10.000 habitantes (o 3.000 si dista >30 km de capital de provincia) |
| Residencia fiscal | Castilla y León |
| Contrato | En vigor para vivienda habitual |
| BI máx individual (BI total - mínimo personal y familiar) | **18.900 €** |
| BI máx conjunta | **31.500 €** |
| Casilla | 975 |
| Fuente | Arts. 7.4, 7.5 y 10 Decreto Legislativo 1/2013 CyL · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-castilla-leon/arrendamiento-vivienda-habitual-jovenes.html` |

**Nota especial CC** · CyL deduce del límite las ayudas públicas de bono alquiler joven · CC debe implementar resta antes de aplicar tope.

**Implementación CC** · `verified: true` (cifras Decreto Legislativo + manual AEAT).

**B · Por adquisición de vivienda habitual de nueva construcción**

| Concepto | Valor |
|---|---|
| Porcentaje | **7,5%** sobre cantidades satisfechas |
| Requisitos | Vivienda nueva construcción · primera vivienda · ubicada en CyL · residencia fiscal CyL |
| Base máxima anual | 9.040 € |
| Fuente | Decreto Legislativo 1/2013 CyL |

**C · Por nacimiento o adopción de hijos**

| Concepto | Valor |
|---|---|
| 1er hijo | 1.010 € (1.420 € si municipio <5.000 habitantes) |
| 2º hijo | 1.475 € (2.070 € si municipio <5.000) |
| 3er hijo o más | 2.351 € (3.300 € si municipio <5.000) |
| Si discapacidad ≥33% | Cantidades se duplican |
| Fuente | Decreto Legislativo 1/2013 CyL |

**Otras deducciones detectadas relevantes** · adopción (784 €) · rehabilitación vivienda subvencionada (15%) · adquisición/rehabilitación rural por jóvenes ≤36 años · familias numerosas (60+ €) · cuotas SS empleado hogar (15%) · I+D+i (15%)

### 5.4 · TODOs concretos para CC

- [ ] Verificar 5 tramos exactos escala autonómica CyL
- [ ] `verified: true` para mínimos = estatales
- [ ] `verified: true` para arrendamiento jóvenes (cifras Decreto Legislativo + manual AEAT)
- [ ] Implementar resta de ayudas bono alquiler joven antes del tope
- [ ] Implementar TOP-3 con motor de elegibilidad estricto

---

## 6 · Hallazgos transversales · útiles para todas las CCAA

### 6.1 · CCAA con mínimos = estatales · ahorra trabajo

| CCAA | Mínimos = estatales |
|---|---|
| Cataluña | ✅ idénticos |
| Castilla y León | ✅ idénticos |
| Madrid | ❌ tiene cifras propias (verified en T18.0) |
| Andalucía | ❓ verificar · puede tener propios |
| Valencia | ❓ verificar |
| Baleares | ❓ verificar |

CC al implementar Cataluña y CyL · puede importar `_base_estatal.minimoPersonalFamiliar` directamente · `verified: true` por cita Manual AEAT.

### 6.2 · CCAA SIN deducción general arrendamiento vivienda habitual

| CCAA | Tiene deducción general arrendamiento |
|---|---|
| Madrid | ✅ Sí (verified T18.0) |
| Cataluña | ❌ NO (solo víctimas violencia) |
| Andalucía | ✅ Sí · 15% / 1.200 € |
| Valencia | ✅ Sí · 20-30% / 800-1.100 € (la más generosa) |
| Baleares | ✅ Sí · 15-20% / 530-650 € |
| Castilla y León | ✅ Sí · 20-25% / 459-612 € |
| Aragón | ❌ NO (solo casos específicos) (T18.2) |
| País Vasco / Navarra | régimen foral · no entra T18 |

CC al implementar Cataluña · NO crear `arrendamiento-vivienda-habitual` general · solo el nicho de violencia. Cliente que viva en Cataluña verá "ELEGIBLE: false" con motivo claro.

### 6.3 · Patrón común de evaluación elegibilidad

Para deducción arrendamiento vivienda habitual · el patrón de evaluarElegibilidad casi siempre incluye:

```typescript
// Condiciones que se evalúan en la mayoría de CCAA
- ctx.edadActual <= EDAD_LIMITE_CCAA (35 / 36 / etc)
- BI individual ≤ TECHO_INDIVIDUAL
- BI conjunta ≤ TECHO_CONJUNTA
- contratoArrendamiento.duracion >= 1 año
- contratoArrendamiento.tipoVivienda === 'habitual'
- !ctx.tieneVivienda<DistanciaKM>
- ctx.comunidadAutonoma === ESTA_CCAA
- ctx.tienePagosTrazables (transferencia/tarjeta/cheque)
```

CC puede crear helper genérico `evaluarRequisitosArrendamientoBase(ctx, requisitos)` y cada CCAA solo aporta sus parámetros específicos.

### 6.4 · Casillas AEAT por CCAA · útiles para mapeo

| CCAA | Casilla arrendamiento |
|---|---|
| Madrid | 1043 |
| Andalucía | (verificar · suele estar en 10_1_3) |
| Valencia | 1095 |
| Baleares | (verificar) |
| Castilla y León | 975 |

---

## 7 · Resumen para CC al ejecutar T18.1

### 7.1 · Lo que ya está pre-investigado al 100%

- **Andalucía** · arrendamiento vivienda habitual (todas las cifras BOE)
- **Valencia** · arrendamiento vivienda habitual (todas las cifras BOE) · primera adquisición ≤35 (todas las cifras)
- **Baleares** · arrendamiento vivienda habitual (todas las cifras BOE)
- **Castilla y León** · mínimos = estatales · arrendamiento jóvenes (todas las cifras BOE)
- **Cataluña** · mínimos = estatales · NO tiene deducción general arrendamiento

### 7.2 · Lo que CC debe completar al ejecutar

- Las 5 escalas autonómicas exactas (tramos por tramo) · pre-investigación localizó número de tramos y rango pero NO valores intermedios
- Verificar mínimos autonómicos Andalucía · Valencia · Baleares (no confirmado si propios o estatales)
- Implementar fórmulas de reducción progresiva (Valencia 27k-30k / 44k-47k es CRÍTICO)
- Verificar URLs 2025 vigentes (algunas pre-investigación citó 2024)
- Implementar TOP-3 deducciones por CCAA con motor evaluarElegibilidad estricto
- Mapear casillas AEAT exactas

### 7.3 · Reglas operativas (recordatorio)

1. **NUNCA inventar** · cada cifra con fuente oficial citada
2. **Si fuente no confirma** · `verified: false` con TODO concreto
3. **Madrid es referencia** · ya está implementada en T18.0 · misma estructura
4. **Motor evaluarElegibilidad sagrado** · ATLAS NUNCA aplica deducción sin verificar TODOS los requisitos primero

---

**Fin de pre-investigación T18.1 · cifras Top 5 mercado · Cataluña · Andalucía · Valencia · Baleares · Castilla y León · listo para que CC ejecute con base sólida y solo verifique/complete los TODOs marcados.**
