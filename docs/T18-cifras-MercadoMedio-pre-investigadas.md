# T18.2 · Cifras BOE pre-investigadas · Mercado medio

> **Documento de apoyo para CC al ejecutar T18.2.** Cifras extraídas del Manual Práctico AEAT 2025 + webs autonómicas oficiales. Cada cifra tiene fuente citada con URL.
>
> **Uso por CC:** auditar y verificar cada cifra contra la URL oficial. Si coincide · `verified: true`. Si discrepa · usar fuente y marcar verified con razón. Si fuente no accesible o discrepa · `verified: false` con TODO concreto. **NUNCA inventar.**
>
> **Fecha de pre-investigación:** 2026-05-06 · Manual práctico Renta 2025
>
> **CCAA cubiertas:** Galicia · Aragón · Asturias · Murcia · Cantabria
>
> **Hallazgo destacado:** Aragón es la única CCAA de régimen común SIN deducción general arrendamiento vivienda habitual. ATLAS al detectar contrato arrendamiento en Aragón debe responder NO ELEGIBLE con motivo claro.

---

## 1 · GALICIA

### 1.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 1/2011 (Texto Refundido tributos cedidos Galicia) si tiene cifras propias o adopta estatales.

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-galicia.html`

Ref legal · web Atriga · `https://www.atriga.gal/es_ES/informacion-tributaria/tributos/imposto-sobre-a-renda-das-persoas-fisicas/`

### 1.2 · Escala autonómica

Tipo marginal mínimo y máximo · TODO CC verificar tramos contra Atriga / web Xunta.

### 1.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por alquiler de vivienda habitual** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje base | **10%** de cantidades satisfechas |
| Tope base | **300 €** por contrato y año (individual o conjunta) |
| Porcentaje incrementado | **20%** si tiene 2 o más hijos menores |
| Tope incrementado | **600 €** por contrato y año |
| Doble si discapacidad | Las cuantías se duplican si arrendatario discapacidad ≥33% (600 €/1.200 €) |
| Edad | **≤ 35 años** en fecha devengo (31/12) |
| BI máx (general - mínimo personal y familiar) | **22.000 €** |
| Vivienda | Habitual del contribuyente |
| Otros | Depósito fianza Instituto Galego Vivenda y Solo (IGVS) o copia denuncia |
| Casilla | Trasladado a Anexo B.11 |
| Fuente | Art. 5.Siete Decreto Legislativo 1/2011 · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-galicia/alquiler-vivienda-habitual.html` |

**Implementación CC** · `verified: true` · cifras BOE/AEAT al 100%.

**B · Por adecuación de inmueble destinado al arrendamiento como vivienda habitual** (deducción del arrendador · útil para clientes ATLAS propietarios)

| Concepto | Valor |
|---|---|
| Porcentaje | **15%** cantidades obras conservación/reparación + gasto necesario para arrendar (incluye certificado eficiencia energética + formalización contrato) |
| Base máxima | **9.000 €** por vivienda |
| Fuente | Decreto Legislativo 1/2011 + Atriga |

**C · Por inversión en instalaciones de climatización y/o agua caliente con energías renovables en vivienda habitual**

| Concepto | Valor |
|---|---|
| Porcentaje | **5%** sobre cantidades satisfechas |
| Tope | **280 €** |
| Otros | Vivienda habitual · uso autoconsumo |
| Fuente | Atriga |

**Otras deducciones detectadas relevantes** · vivienda vacía propietario que arrenda (500 €/vivienda primer periodo) · rehabilitación centros históricos 15% (9.000 €) · contribuyentes discapacidad ≥65 años con ayuda terceros (10%/600 €) · alta y cuota nueva conexión a internet 30% (100 €)

### 1.4 · TODOs concretos para CC

- [ ] Verificar si Galicia tiene mínimos propios distintos a estatales
- [ ] Localizar tramos exactos escala autonómica
- [ ] `verified: true` para arrendamiento (cifras BOE/AEAT 100%)
- [ ] Implementar TOP-3 con motor evaluarElegibilidad estricto

---

## 2 · ARAGÓN

### 2.1 · ⚠️ HALLAZGO CRÍTICO · NO tiene deducción general arrendamiento

**Aragón es la ÚNICA CCAA de régimen común que NO tiene deducción general por alquiler de vivienda habitual para inquilinos.**

Solo dispone de modalidades específicas:
- Arrendamiento vivienda habitual vinculado a operaciones de **dación en pago** (caso muy nicho · cliente que perdió su vivienda)
- Arrendamiento vivienda social (deducción del **arrendador**, NO del inquilino)

Cliente Aragón inquilino general · `evaluarElegibilidad` debe devolver:
```
ELEGIBLE: false
motivos: ["Aragón no tiene deducción general arrendamiento vivienda habitual · solo casos específicos · dación en pago / vivienda social"]
```

### 2.2 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 1/2005 Aragón (Texto Refundido tributos cedidos) o Ley aragonesa.

### 2.3 · Escala autonómica · 9 tramos · 9,5% min · 25,5% max

**TODO CC:** localizar tramos exactos.

### 2.4 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Arrendamiento vivienda habitual vinculado a dación en pago** (caso nicho)
- TODO CC · verificar porcentaje · tope · requisitos contra Manual AEAT 2025 Aragón

**B · Arrendamiento vivienda social** (deducción del arrendador)
- TODO CC · verificar porcentaje · tope · requisitos

**C · Otras deducciones aragonesas** · familias numerosas · descendientes · adquisición vivienda jóvenes · obras de mejora eficiencia energética (TODO CC investigar)

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-aragon.html` (URL probable · CC verifica)

### 2.5 · TODOs concretos para CC

- [ ] Crear `aragon.ts` con FLAG explícito · NO incluye `arrendamiento-vivienda-habitual` general
- [ ] Implementar deducción "arrendamiento dación en pago" como `requiereDacionEnPago: true`
- [ ] Implementar deducción "arrendamiento social arrendador" con motor evaluarElegibilidad
- [ ] Test específico Aragón · cliente inquilino general → NO ELEGIBLE con motivo claro

---

## 3 · ASTURIAS · Principado de Asturias

### 3.1 · Mínimos personales y familiares autonómicos · NOVEDAD 2025

⚠️ **Asturias estableció mínimos autonómicos PROPIOS por primera vez en 2025.**

Pre-investigación NO localizó cifras concretas verified al 100%.

**TODO CC:** localizar contra BOPA (Boletín Oficial del Principado de Asturias) o Manual AEAT 2025 Asturias. Cifras esperadas según fuentes secundarias · base contribuyente 6.105 € · bono >65 1.265 € · bono >75 1.540 € (PENDIENTE VERIFICACIÓN OFICIAL).

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-asturias.html` (URL probable)

### 3.2 · Escala autonómica · 8 tramos · 10% min · 25,5% max

**TODO CC:** localizar tramos exactos.

### 3.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual** ★ confirmada parcial

| Concepto | Valor |
|---|---|
| Porcentaje base | **10%** · tope **500 €** anuales |
| Porcentaje incrementado | **30%** · tope **1.500 €** anuales |
| Edad/perfil incrementado | Jóvenes ≤35 años · familia numerosa · familia monoparental · víctimas violencia género |
| Modalidad reforzada despoblación | 30% · tope **1.500 €** · para concejos asturianos en riesgo despoblamiento o crisis demográfica |
| BI máx individual | **35.000 €** |
| BI máx conjunta | **45.000 €** |
| Otros requisitos | NIF arrendador en autoliquidación · prorrateo entre titulares si varios |
| Fuente | Manual AEAT 2025 Asturias |

**Implementación CC** · `verified: true` para porcentajes · topes · BI. Verificar normativa exacta del concejo despoblamiento contra lista oficial Asturias.

**B · Adquisición o adecuación vivienda habitual personas con discapacidad** (TODO CC · verificar)

**C · Familia numerosa o monoparental** (TODO CC · verificar)

### 3.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios Asturias 2025 contra BOPA
- [ ] Localizar 8 tramos exactos escala autonómica
- [ ] `verified: true` para arrendamiento (cifras BOE/AEAT 100%)
- [ ] Implementar 3 modalidades arrendamiento (general 10%/500 · jóvenes 30%/1.500 · despoblación 30%/1.500)
- [ ] Localizar lista oficial concejos riesgo despoblamiento Asturias

---

## 4 · MURCIA · Región de Murcia

### 4.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 1/2010 Murcia.

### 4.2 · Escala autonómica · 5 tramos

**TODO CC:** localizar tramos exactos.

### 4.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual** ★ confirmada con todas las cifras

| Concepto | Valor |
|---|---|
| Porcentaje | **10%** de cantidades NO subvencionadas |
| Tope | **300 €** anuales por contrato |
| BI máx (general - mínimo personal y familiar) | **40.000 €** (★ subido de 24.380 € por Ley 3/2025 con efectos 1/1/2025 · vigencia indefinida) |
| BI ahorro máx | **1.800 €** |
| Vivienda | Situada en Murcia · habitual del contribuyente |
| Contrato | Modelo ITP y AJD presentado |
| Pagos | Trazables (transferencia · tarjeta · cheque · ingreso cuenta) · NO efectivo |
| Titularidad | NI contribuyente NI miembros UF titulares >50% otra vivienda |
| Incompatibilidad | NO tener derecho a deducción inversión vivienda mismo periodo |
| Casilla | Anexo B.11 |
| Prorrateo | Si 2 contribuyentes con derecho · 300 € se prorratea por partes iguales |
| Fuente | Art. 1.Trece Decreto Legislativo 1/2010 modificado por Ley 3/2025 · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-region-murcia/arrendamiento-vivienda-habitual.html` |

**Implementación CC** · `verified: true` · cifras BOE/AEAT al 100% incluyendo cambio Ley 3/2025.

**Nota CRÍTICA CC** · el límite BI subió de 24.380 a 40.000 € a partir de 2025 · CC debe usar 40.000 € · NO citar fuentes anteriores que mantienen 24.380 €.

**B · Por inversión en vivienda habitual por jóvenes ≤40 años** (régimen transitorio)

**TODO CC:** verificar porcentaje · tope · requisitos. Pre-investigación localizó porcentajes 5% pero requiere validación contra Manual AEAT 2025.

**C · Por adquisición de nueva vivienda habitual o ampliación por familias numerosas**

**TODO CC:** verificar porcentaje · tope · requisitos.

**Otras deducciones detectadas relevantes** · instalaciones autoconsumo / energías renovables · subvenciones zonas afectadas emergencia · descendientes accidente laboral · gastos ELA · vehículo eléctrico (Ley 3/2025 · hasta 7.000 €) · puntos recarga (4.000 €) · gimnasio (30%/100 €) · óptica (30%/100 €) · enfermedades raras (300 €)

### 4.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios Murcia contra Decreto Legislativo 1/2010
- [ ] Localizar 5 tramos exactos escala autonómica
- [ ] `verified: true` para arrendamiento con BI 40.000 € (Ley 3/2025)
- [ ] Implementar requisito ITP/AJD presentado · prorrateo entre titulares · pagos trazables
- [ ] Localizar y verificar deducción jóvenes ≤40 inversión vivienda

---

## 5 · CANTABRIA

### 5.1 · Mínimos personales y familiares autonómicos

**TODO CC:** verificar contra Decreto Legislativo 62/2008 Cantabria o normativa actualizada.

### 5.2 · Escala autonómica · 6 tramos · 8,5% min · 24,5% max

**TODO CC:** localizar tramos exactos. Cantabria modificó escala con efectos 1/1/2024 · CC verifica vigencia 2025.

### 5.3 · TOP-3 deducciones aplicables a clientes ATLAS

**A · Por arrendamiento de vivienda habitual** ★ confirmada parcial

| Concepto | Valor |
|---|---|
| Porcentaje | **10%** de cantidades satisfechas |
| Tope individual | **300 €** anuales |
| Tope conjunta | **600 €** anuales (siempre que al menos uno cumpla los demás requisitos) |
| Edad | ≤35 años · ≥65 años · víctima violencia doméstica/terrorismo (TODO CC verificar exact requirements) |
| BI máx | **TODO CC verificar** · pre-investigación NO localizó tope BI exacto |
| Incompatibilidad | Con específica por arrendamiento en municipios riesgo despoblamiento Cantabria (cuando se refiere a misma vivienda) |
| Fuente | Manual AEAT 2025 Cantabria |

**Implementación CC** · `verified: false` hasta confirmar BI máx contra Manual AEAT 2025 + Decreto Cantabria.

**B · Por arrendamiento en municipios riesgo despoblamiento Cantabria** (modalidad reforzada)

**TODO CC:** localizar porcentaje · tope · lista de municipios oficial.

**C · Adquisición/Rehabilitación vivienda habitual** (TODO CC verificar)

Fuente · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cantabria.html` (URL probable)

### 5.4 · TODOs concretos para CC

- [ ] Verificar mínimos propios Cantabria
- [ ] Localizar 6 tramos exactos escala autonómica (vigencia 2025)
- [ ] **CRÍTICO** · localizar BI máx para deducción arrendamiento general (no localizado en pre-investigación)
- [ ] Localizar lista oficial municipios riesgo despoblamiento Cantabria
- [ ] Implementar incompatibilidad entre arrendamiento general y municipio despoblado · misma vivienda

---

## 6 · Hallazgos transversales · útiles para todas las CCAA

### 6.1 · CCAA con/sin deducción general arrendamiento

| CCAA | Tiene deducción general |
|---|---|
| Galicia | ✅ Sí · 10/20% · 300/600€ · ≤35 · BI 22.000€ |
| **Aragón** | ❌ **NO** · solo dación en pago + vivienda social |
| Asturias | ✅ Sí · 10/30% · 500/1.500€ · BI 35k/45k |
| Murcia | ✅ Sí · 10% · 300€ · BI **40.000 €** (Ley 3/2025) |
| Cantabria | ✅ Sí · 10% · 300/600€ · TODO BI |

### 6.2 · Patrones comunes de evaluarElegibilidad

| Requisito | Galicia | Asturias | Murcia | Cantabria |
|---|---|---|---|---|
| Edad límite | ≤35 | ≤35 (incremento) | sin edad explícita | ≤35 (probablemente) |
| BI máx individual | 22.000 | 35.000 | 40.000 | TODO |
| Pagos trazables | sí (fianza IGVS) | TODO | sí (NO efectivo) | TODO |
| NIF arrendador | sí | sí | sí | sí (común a todas) |
| Vivienda en CCAA | sí | sí | sí | sí |
| ITP/AJD presentado | no | no | **sí** | TODO |
| Incompatibilidad otras | no | no | inversión vivienda | despoblación misma vivienda |

### 6.3 · Casillas AEAT por CCAA

Todas las deducciones de arrendamiento de las 5 CCAA se trasladan a Anexo B.11 unificado AEAT. Casillas específicas dentro del Anexo · TODO CC verificar.

### 6.4 · CCAA donde Ley 2025 modificó cifras

| CCAA | Ley 2025 modificó | Efecto |
|---|---|---|
| Murcia | Ley 3/2025 (23 julio) | BI máx subió 24.380 → **40.000 €** desde 1/1/2025 |
| Asturias | (mínimos propios primer año) | Cifras nuevas verificar BOPA |
| Andalucía | Ley 8/2025 (22 diciembre) | Nueva deducción enfermedad celíaca (T18.1) |

CC al implementar debe usar fuentes vigentes 2025 · NO 2024.

---

## 7 · Resumen para CC al ejecutar T18.2

### 7.1 · Lo que ya está pre-investigado al 100% · CC solo verifica

- **Galicia** · arrendamiento (10/20% · 300/600€ · ≤35 · BI 22k · Decreto 1/2011)
- **Aragón** · NO tiene deducción general · solo dación en pago + arrendador social
- **Asturias** · arrendamiento (10/30% · 500/1.500€ · BI 35k/45k · 3 modalidades)
- **Murcia** · arrendamiento (10% · 300€ · BI 40.000€ · Ley 3/2025 · ITP/AJD presentado)
- **Cantabria** · arrendamiento (10% · 300/600€ ind/conj · incompatible con despoblación)

### 7.2 · Lo que CC debe completar al ejecutar

- 5 escalas autonómicas exactas (tramo por tramo) · pre-investigación localizó número de tramos y rango
- Mínimos autonómicos donde aplica (especialmente Asturias · novedad 2025)
- Cantabria · BI máx exact para deducción arrendamiento (pre-investigación NO localizó)
- Listas oficiales · municipios riesgo despoblamiento Asturias y Cantabria
- Verificar Aragón · porcentajes específicos dación en pago / arrendador vivienda social
- Verificar URLs Manual AEAT 2025 (algunas pre-investigación inferidas)
- Mapear casillas exactas Anexo B.11

### 7.3 · Reglas operativas (recordatorio)

1. **NUNCA inventar** · cada cifra con fuente oficial citada
2. **Si fuente no confirma** · `verified: false` con TODO concreto
3. **Motor evaluarElegibilidad SAGRADO** · requisitos antes de aplicar
4. **Aragón es caso especial** · NO crear deducción general arrendamiento · debe responder NO ELEGIBLE con motivo claro
5. **Murcia · usar Ley 3/2025** · BI máx 40.000 € (NO 24.380 € de fuentes antiguas)
6. **Asturias · 3 modalidades arrendamiento** · general · jóvenes/familia/violencia · despoblación

---

**Fin de pre-investigación T18.2 · cifras Mercado medio · Galicia · Aragón · Asturias · Murcia · Cantabria · listo para que CC ejecute con base sólida y solo verifique/complete los TODOs marcados.**
