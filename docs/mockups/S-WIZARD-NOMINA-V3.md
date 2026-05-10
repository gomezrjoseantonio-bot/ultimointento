# S-WIZARD-NOMINA-V3 · pantalla única · estilo ATLAS v8

> **Tipo** · Reemplazo completo del wizard de nómina · 5 sub-tareas · 1 PR único
> **Tiempo estimado** · 6-10h CC
> **Cierra** · primer wizard reescrito en estilo ATLAS v8 · sienta patrón para los demás (autónomo · gasto recurrente · plan pensión · contrato · etc)
> **Reglas aplicadas** · regla canónica grep duro · stop-and-wait · NO reutilizar código del wizard actual · pre-flight obligatorio · 1 PR contra `main` sin mergear hasta autorización Jose
> **DB** · no sube versión · v70 sigue · cambios de UI + cableado de stores existentes
> **Predecesor** · TAREA 13 v4 mergeada · TAREA 7 cerrada · DB v70 · 40 stores
> **Sucesor** · spec análoga para wizard autónomo · gasto recurrente · etc.

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en sub-tarea 1** · grep duro sobre el repo real · NO confiar en supuestos · NO confiar en este spec
2. **Si pre-flight revela contradicciones** con el spec · STOP · documentar · esperar Jose
3. **NO reutilizar NADA del wizard actual** · `/gestion/personal/nueva-nomina` (3 pasos) · se elimina entero
4. **NO TOCAR DB** · DB sigue v70 · este lote es UI + lectura/escritura sobre stores existentes
5. **Encadenar sub-tareas en una rama** · 1 PR final único contra `main`
6. **NO mergear** · esperar Jose
7. **NO arreglar 43 tests failing pre-existing**
8. **NO arreglar bug fecha nacimiento hardcodeada en Ajustes/Fiscal** · es tarea aparte
9. **Mockup v3 es la guía visual literal** · paleta · espaciados · densidad · colores · tipografía
10. **Sentence case mandatory** · cero MAYÚSCULAS innecesarias en UI · solo títulos de bloque en uppercase letter-spacing alto

---

## §1 · Contexto · qué reemplaza esta tarea

### 1.1 · Wizard actual · estado · qué falla

URL · `/gestion/personal/nueva-nomina?id=X` (editar) y `/gestion/personal/nueva-nomina` (crear)

3 pasos divididos artificialmente ·
- Paso 1 · Empresa y sueldo · datos empleador + bruto + IRPF + SS
- Paso 2 · Variables y extras · variables · plan pensiones · beneficios especie
- Paso 3 · Confirmación · grid 12 meses + resumen anual + cómo registrar

Problemas detectados ·
- Pasos artificiales · todo cabe en una pantalla
- Densidad pobre · campos sobreespaciados
- Texto cortado en inputs (`% sobre l...`)
- Lenguaje técnico filtrado a UI · "Treasury Events" · "Snapshot" · "(migración V70)"
- Datos hardcodeados ignorando `personalData` (caso CCAA · IRPF estimado teórico erróneo)
- Subtítulos descriptivos redundantes
- Selección con navy en algunos sitios · oro en otros · incoherente

### 1.2 · Wizard nuevo · objetivo

1 sola pantalla · modal full-screen · 2 columnas (form izquierda · preview live derecha) · 6 bloques en form · sin pasos · sin scroll innecesario · estilo ATLAS v8 estricto · datos leídos de fuentes correctas · sin lenguaje técnico.

### 1.3 · Caso real Jose como dogfood

- Empresa · Orange Espagne SAU · CIF A82009812
- Bruto fijo anual 2026 · 95.178,16 €
- Nº pagas · 14 (junio + diciembre)
- Variable 60% · marzo · 14,28% sobre bruto · 13.591,44 €
- Variable 40% · junio · 9,52% sobre bruto · 9.060,96 €
- IRPF · valor que el usuario meta · NUNCA estimación teórica
- IRPF efectivo certificado 2025 · 34,45% (40.990,88 / 118.981,06)
- SS empleado total · 6,50% (SS 4,70 + Desempleo 1,55 + FP 0,10 + MEI 0,15)
- Cuota solidaridad · 91,80 €/año
- Plan pensiones · PPC DE OSP Y OSFI · BBVA · 122,76 €/mes tuyo + 163,68 €/mes empresa
- Beneficios especie · 6 conceptos por 468,93 €/mes (vida + médico + vehículo + teléfono + cheque restaurante + conciliación)
- Cuenta destino · Santander 2715
- CCAA · Comunidad de Madrid (lectura `personalData.comunidadAutonoma`)

---

## §1.5 · Prerequisito Jose · subir mockup al repo

Antes de lanzar este spec · Jose sube `atlas-wizard-nomina-v3.html` al repo en ·

```
docs/mockups/atlas-wizard-nomina-v3.html
```

CC verifica con `ls docs/mockups/atlas-wizard-nomina-v3.html` en sub-tarea 1. Si no existe · STOP.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Pre-flight · localizar arquitectura actual

**Tiempo** · 30-45 min CC

#### Pre-flight obligatorio

```bash
# Verificar mockup subido
ls -la docs/mockups/atlas-wizard-nomina-v3.html

# Localizar wizard actual (3 pasos)
grep -rnE "nueva-nomina|NominaWizard|NuevaNomina" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
find src/ -type f \( -name "Nomina*" -o -name "NuevaNomina*" -o -name "WizardNomina*" \) 2>/dev/null

# Localizar la ruta /gestion/personal/nueva-nomina
grep -rnE "/gestion/personal/nueva-nomina|gestion/personal/nueva-nomina" src/ --include="*.tsx" 2>/dev/null

# Localizar componentes del wizard actual (steps)
grep -rnE "Empresa y sueldo|Variables y extras|Confirmación.*nomina|Paso [123] de 3" src/ --include="*.tsx" 2>/dev/null

# Localizar servicio de nóminas / ingresos
find src/services -type f \( -name "nomina*" -o -name "ingreso*" -o -name "ingresos*" -o -name "nominas*" \) 2>/dev/null
grep -rnE "nominasService|ingresosService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Localizar store de nóminas/ingresos (esquema DB)
grep -rnE "objectStore.*\"(nominas|ingresos|nomina)\"|createObjectStore.*(nomina|ingreso)" src/ --include="*.ts" 2>/dev/null

# Verificar lectura de personalData
grep -rnE "personalDataService|personalData\.(comunidadAutonoma|nombre|dni)" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Verificar certificado AEAT (% IRPF efectivo año anterior)
grep -rnE "certificado.*AEAT|certificadoRetenciones|certificadoIRPF|retenciones.*ingresos.*cuenta" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
find src/ -type f -name "certificado*" 2>/dev/null

# Verificar lectura de personalModuleConfig (incoherencia conocida · TAREA 14)
grep -rnE "personalModuleConfig" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar planes pensiones disponibles (V65 mergeado)
grep -rnE "planesPensionesService|listPlanesPensiones" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar cuentas de tesorería disponibles
grep -rnE "cuentasService|listCuentas|cuentasBancariasService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar generación treasuryEvents desde nómina
grep -rnE "treasuryEvents.*nomina|nomina.*treasuryEvent|generarEventos.*nomina" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar vínculo nómina ↔ plan pensiones (memoria #2 dice ya implementado)
grep -rnE "aportacionPlanPensiones|nomina.*aportacion.*plan|metadata.*nomina.*aportacion" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

#### Resultado esperado en commit
CC reporta en commit message ·
- Path exacto de wizard actual · todos los componentes asociados (steps · forms · drawers)
- Path del servicio de nóminas/ingresos
- Nombre real del store en IndexedDB · estructura del schema actual
- Path donde se lee `personalData` · funciones disponibles
- Si existe certificado AEAT · path · estructura · cómo se accede al % IRPF efectivo
- Si existe `personalModuleConfig` · qué campos tiene actualmente (probablemente vacío)
- API de cuentas de tesorería · cómo listar
- API de planes pensiones V65 · cómo listar filtrando por titular y tipo PPE/PPES
- Si existe ya integración nómina → treasuryEvents · cómo funciona

#### Caso STOP
Si el wizard actual escribe en stores no esperados · si la ruta es distinta · si NO hay servicio de ingresos · si la integración Treasury es muy distinta de lo asumido · STOP · documentar · esperar Jose.

---

### Sub-tarea 2 · Eliminación completa del wizard actual

**Tiempo** · 30-45 min CC

#### Plan
1. Eliminar TODOS los componentes del wizard actual identificados en sub-tarea 1 ·
   - `NuevaNominaPage.tsx` (o como se llame)
   - Componentes de los 3 pasos (Step1Empresa · Step2Variables · Step3Confirmacion · o similar)
   - Componentes auxiliares solo usados por este wizard
   - Hooks específicos del wizard actual
   - Tipos TypeScript propios del wizard actual (si los hay y solo se usan aquí)
2. **NO eliminar** ·
   - El servicio de nóminas/ingresos (lo reusamos)
   - El store de IndexedDB (lo reusamos)
   - Tipos TypeScript globales `Nomina` `Ingreso` etc.
   - Generación treasuryEvents
3. Mantener temporalmente la ruta `/gestion/personal/nueva-nomina` para que el siguiente paso la apunte al wizard nuevo

#### Caso N/A
Si el wizard actual está más entrelazado de lo previsto y eliminarlo en bloque rompe otras pantallas · STOP · listar los componentes con dudas · esperar Jose.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit message
- [ ] Todos los componentes del wizard actual eliminados
- [ ] Servicios + tipos globales + stores intactos
- [ ] App compila · build pasa · type check pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 3 · Implementación nueva pantalla única

**Tiempo** · 4-6h CC

#### Plan
Crear · `src/pages/gestion/personal/NominaPage.tsx` (o ruta equivalente identificada en sub-tarea 1).

Se conecta a la misma ruta `/gestion/personal/nueva-nomina` y `/gestion/personal/nueva-nomina?id=X`.

**Layout estructural**

Ver mockup `docs/mockups/atlas-wizard-nomina-v3.html` como guía visual literal · CC reproduce · ningún cambio sin justificación.

```
┌─ MODAL full-screen overlay ─────────────────────────────────────┐
│                                                                  │
│ ┌─ HEADER navy compacto ──────────────────────────────────────┐ │
│ │ [icono] Editar nómina · Orange      [X cerrar]              │ │
│ │         Jose Antonio Gómez Ramírez · vigente desde ene 2026 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ COL FORM (1.25fr) ──────┬─ COL PREVIEW (1fr · bg-soft) ──┐ │
│ │                           │                                 │ │
│ │ [Bloque 1 · Empresa]      │  KPI principal navy             │ │
│ │ [Bloque 2 · Sueldo]       │  Desglose mini                  │ │
│ │ [Bloque 3 · Variables]    │  Mini-grid 12 meses             │ │
│ │ [Bloque 4 · PP]           │  Mes normal + histórico         │ │
│ │ [Bloque 5 · Especie]      │                                 │ │
│ │ [Bloque 6 · Cómo registr] │                                 │ │
│ │                           │                                 │ │
│ └───────────────────────────┴─────────────────────────────────┘ │
│                                                                  │
│ ┌─ FOOTER ────────────────────────────────────────────────────┐ │
│ │ Cambios sin guardar · al guardar...   [Cancelar] [Guardar]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Bloques del form · uno a uno**

#### Bloque 1 · Empresa y vigencia
1 fila · 4 campos ·
- Empresa (input texto · `Orange Espagne SAU`)
- Cuenta destino (select · lee de `cuentasService` · muestra "Banco · ···· últimos 4 dígitos")
- Vigente desde (input month)
- Día cobro (input numérico · 1-31 · 31 = último hábil · hint en label)

#### Bloque 2 · Sueldo y retenciones
1 fila · 5 campos ·
- Bruto anual fijo (input numérico mono · sufijo "€")
- Nº pagas (select · valores `12 · 14 · 15 · 16` · sin descripción)
- % IRPF (input numérico mono · sufijo "%")
  - **Badge a la derecha del label** · solo si hay certificado AEAT importado del año anterior · `Efectivo {AÑO}: {%}`
  - 1 click en el badge · aplica ese valor al campo
  - **NUNCA mostrar estimación teórica** · ni `ATLAS estima X%` · ni nada similar
- % SS empleado (input mono · sufijo "%")
- Cuota solidaridad (input mono · sufijo "€/año")

Sub-bloque condicional · `Pagas extras en` · solo visible si nº pagas ≥ 14 ·
- Lista chips de los 12 meses (Ene · Feb · ... · Dic)
- Click toggle selección · estilo `selected = oro` (gold-bg + gold border + navy text)
- Validación · debe haber tantos meses seleccionados como `nº pagas - 12`
  - Nº pagas 14 · 2 meses
  - Nº pagas 15 · 3 meses
  - Nº pagas 16 · 4 meses

Hint debajo · cálculo live ·
> **Paga normal** {valor} € · **Base SS/mes** {valor} € · **IRPF/mes** {valor} € · SS 4,70% + Desempleo 1,55% + FP 0,10% + MEI 0,15%

#### Bloque 3 · Variables y bonus
Lista compacta · row-item con 6 columnas ·
- Concepto (input texto · "Variable 60%")
- Tipo (select · "% bruto" / "Importe fijo")
- Valor (input numérico mono · sufijo "%" o "€" según tipo)
- Cálculo live (texto · `= 13.591,44 €` · color teal · solo lectura)
- Mes de cobro (select 12 meses)
- Botón eliminar (icono trash)

Botón "+ Añadir variable / bonus" al final · estilo dashed border.

Header del bloque incluye contador · `Variables y bonus · 2 configurados`.

#### Bloque 4 · Plan de pensiones
Toggle ON/OFF en header.

Si ON · 1 fila · 3 campos ·
- Plan vinculado (select · lee de `planesPensionesService` filtrado por `titular` y `tipoAdministrativo IN ('PPE', 'PPES')` · opción "+ Vincular plan nuevo" al final)
- Tu aportación / mes (input mono · sufijo "€")
- Empresa / mes (input mono · sufijo "€")

Hint debajo ·
> Total anual al plan · **{aportación tuya × pagas + aportación empresa × pagas}** ({tuya total} tuyos + {empresa total} empresa) · dentro del límite {LÍMITE} € {TIPO_PLAN}

Donde LÍMITE viene de `limitesFiscalesPlanesService` (servicio TAREA 13 · ya mergeado).

#### Bloque 5 · Beneficios en especie
Toggle ON/OFF en header.

Si ON ·
- Catálogo de chips clickables (Seguro vida · Seguro médico · Vehículo · Teléfono · Cheque restaurante · Guardería · Otro). Click añade fila.
- Lista de filas con 4 columnas · concepto editable · importe mes · tipo (select · Exento IRPF / Suma IRPF) · botón eliminar
- Hint debajo · "La especie suma a tu base IRPF pero **NO llega a tu cuenta**"

Header incluye contador · `Beneficios en especie · 6 configurados · 468,93 €/mes`.

#### Bloque 6 · ¿Cómo registramos este cambio?
Solo visible si se está editando una nómina existente (modo edit).

2 radio cards en fila ·
- Rectificación · "Sustituye los datos vigentes. Recalcula meses anteriores."
- Cambio desde fecha · "Mantiene el histórico anterior. Aplica desde la fecha indicada."

Default · Rectificación seleccionada.

**Columna preview · live · siempre visible**

KPI principal navy ·
- Label · "Neto anual a tu cuenta · {AÑO}"
- Valor · neto anual calculado (font JetBrains Mono · 28px · bold)
- Sub · "+ {valor} € en plan de pensiones (tuyo + empresa)" si plan ON

Desglose mini · 6 filas + total ·
- Bruto fijo
- + Variables / bonus
- − IRPF retenido (X%)
- − SS empleado + solidaridad
- − Tu aportación PP (si plan ON)
- = **Total neto en cuenta** (color teal · bold)

Mini-grid 12 meses (4×3) · cada celda ·
- Mes (Ene · Feb · ... · Dic)
- Valor neto del mes (mono bold)
- Tag si aplica · "Variable X%" / "Paga extra" / "Paga extra + Var Y%"
- "PP +{valor}" si plan ON
- Estilos · normal (white) · bonus (gold-bg + gold border) · extra (white + navy border)

Mes normal + histórico al final ·
- "Mes normal sin variables · {valor} €"
- "Histórico · {primera fecha} · configuración inicial" (si modo create) o lista de cambios (si edit)

**Footer**

- Texto izquierda · "Cambios sin guardar · al guardar se actualizan los pagos previstos del año en Tesorería" · solo si hay cambios pendientes
- Botones derecha · "Cancelar" (ghost) + "Guardar nómina" (primary gold + check icon)

**Reglas de cálculo · función pura**

Crear `src/services/nominaCalculatorService.ts` (o equivalente · si no existe · CC verifica en sub-tarea 1).

```ts
function calcularNomina(input: NominaInput): NominaCalculada {
  // input · bruto fijo · nº pagas · meses extras · variables · % IRPF · % SS · solidaridad · PP · especie
  // output · 12 valores netos mes · totales anuales · desglose
  // CERO consultas a stores · CERO efectos · pura
}
```

Esta función se reusa para preview live + para generación de treasuryEvents al guardar.

**Cableado a fuentes correctas**

- `personalData.comunidadAutonoma` · usar para detección Madrid/foral/etc · NO `personalModuleConfig`
- `personalData.nombre` + `apellidos` · header del wizard
- `certificadoAEAT[añoAnterior]` · si existe · calcular `% efectivo = retenciones / dinerario` · mostrar en badge del campo % IRPF
- `cuentasService.listAll()` · select Cuenta destino
- `planesPensionesService.list({ titular, tipos: ['PPE', 'PPES'] })` · select Plan vinculado
- `limitesFiscalesPlanesService.getLimite(tipoPlan)` · hint del bloque PP

**Paleta v8 estricta · cero hardcoded hex**

- Tokens CSS desde el design system existente · NO inventar colores
- Selección = oro (gold-bg + gold border) · en TODOS los elementos seleccionables (chips meses · radio cards · etc)
- Números en JetBrains Mono · títulos en Inter
- Cero verde / rojo / amarillo / morado saturados · solo paleta beige + navy + oro + teal + grises
- Sentence case en TODO el copy · solo títulos de bloque en uppercase con letter-spacing

#### Criterios aceptación sub-tarea 3
- [ ] Mockup `docs/mockups/atlas-wizard-nomina-v3.html` reproducido fielmente
- [ ] 6 bloques implementados según spec
- [ ] Preview live actualizado en tiempo real con cada cambio
- [ ] Función pura `calcularNomina()` con tests unitarios
- [ ] Cero hex hardcoded · 100% tokens CSS
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 4 · Cableado fuentes y guardado

**Tiempo** · 1-2h CC

#### Plan
1. **Lectura · al abrir el wizard** ·
   - Si `?id=X` · cargar nómina existente desde el servicio
   - `personalData` · CCAA + nombre + DNI
   - `certificadoAEATService.getUltimo({ tipo: 'retenciones_trabajo' })` · si existe del año anterior · calcular % efectivo
   - `cuentasService.listAll()` · poblar select cuenta destino
   - `planesPensionesService.list({ titular: personalData.id, tipos: ['PPE', 'PPES'] })` · poblar select plan
2. **Guardado · al pulsar "Guardar nómina"** ·
   - Validar campos obligatorios · errores claros en UI
   - Validar suma de meses extras = nº pagas - 12
   - Llamar al servicio de nóminas existente · `nominasService.upsert(...)` o equivalente
   - Si modo edit + opción "Cambio desde fecha" · pasar `vigenciaDesde` (campo añadido en PR-C4 · cable C-4 sistémico Personal · DB v70 mergeado)
   - Si modo edit + opción "Rectificación" · pasar flag de sobreescritura
3. **Generación treasuryEvents** ·
   - Si la integración nómina → treasuryEvents ya existe (verificado en sub-tarea 1) · llamarla post-guardado
   - Si NO existe · STOP · documentar · esperar Jose (no inventar integración)

#### Caso STOP
Si la integración nómina → treasuryEvents no existe o no es como se asume · STOP · NO inventar · documentar · esperar Jose.

#### Criterios aceptación sub-tarea 4
- [ ] Lectura desde `personalData` (NO `personalModuleConfig`)
- [ ] Badge IRPF efectivo aparece SOLO si hay certificado AEAT del año anterior · NUNCA estimación teórica
- [ ] Validaciones · campos obligatorios · suma meses extras correcta
- [ ] Guardado funcional · datos persistidos
- [ ] `vigenciaDesde` correctamente aplicado en modo "Cambio desde fecha"
- [ ] treasuryEvents generados al guardar (si integración existe)

---

### Sub-tarea 5 · QA visual + accesibilidad mínima

**Tiempo** · 30-45 min CC

#### Plan
1. Verificar visualmente contra mockup en producción
2. Tab order coherente (de arriba a abajo · izquierda a derecha)
3. Labels asociados a inputs (`<label for>`)
4. Botón cerrar accesible con teclado
5. Footer fijo · no se solapa con contenido
6. Modal escapable con tecla `Esc`
7. Validación visual de paleta · 0 hex hardcoded · grep `#[0-9a-fA-F]{3,6}` solo debe encontrar tokens del design system

#### Criterios aceptación sub-tarea 5
- [ ] Cero hex hardcoded en componentes nuevos
- [ ] Tab order verificado
- [ ] Labels correctos
- [ ] Esc cierra modal
- [ ] Comparativa visual screenshot vs mockup pegada en commit

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | Pre-flight | 30-45 min |
| 2 | Eliminación wizard actual | 30-45 min |
| 3 | Implementación pantalla única | 4-6h |
| 4 | Cableado fuentes + guardado | 1-2h |
| 5 | QA visual + accesibilidad | 30-45 min |

**Total** · 6-10h CC.

---

## §4 · Reglas inviolables

1. NO reutilizar código del wizard actual · eliminación completa
2. NO leer de `personalModuleConfig` para CCAA · usar `personalData.comunidadAutonoma`
3. NO mostrar estimación teórica de IRPF · solo certificado AEAT efectivo o input manual sin sugerencia
4. NO usar lenguaje técnico en UI · "Treasury Events" / "Snapshot" / "(migración VXX)" / nombres de stores prohibidos
5. NO subir DB_VERSION · sigue v70
6. NO mergear · stop-and-wait
7. NO arreglar 43 tests failing pre-existing
8. NO arreglar bug fecha hardcodeada en Ajustes/Fiscal · tarea aparte
9. Selección visual = oro (gold-bg + gold border) · en TODOS los elementos seleccionables
10. Mockup `docs/mockups/atlas-wizard-nomina-v3.html` es la referencia visual literal · cualquier desviación se justifica en commit
11. Cero hex hardcoded · 100% tokens CSS del design system
12. Función `calcularNomina()` pura · sin efectos · con tests unitarios

---

## §5 · Criterios de aceptación globales

- [ ] 5 sub-tareas ejecutadas en orden
- [ ] Pre-flight pegado en commit message de sub-tarea 1
- [ ] 1 PR final único contra `main` con commits separados por sub-tarea
- [ ] PR description con tabla resumen + screenshots vs mockup
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Usuario abre `/gestion/personal/nueva-nomina` · ve el wizard nuevo · 1 sola pantalla · sin pasos · puede crear y editar · datos persisten · Tesorería actualiza**

---

## §6 · Validación manual Jose tras merge

1. Abrir `/gestion/personal/nueva-nomina` (modo create)
2. Verificar layout · 2 columnas · header navy · footer fijo · sin scroll innecesario
3. Verificar campos · 4 en bloque empresa · 5 en bloque sueldo · etc
4. Cambiar nº pagas a 14 · verificar que aparece sub-bloque chips meses · seleccionar Junio + Diciembre
5. Si hay certificado AEAT 2025 importado · verificar badge "Efectivo 2025: 34,45%" · click en badge aplica el valor
6. Si NO hay certificado · verificar que NO aparece badge · solo input vacío
7. Añadir variable 60% · marzo · 14,28% · verificar cálculo live = 13.591,44 €
8. Activar plan pensiones · seleccionar plan existente · meter aportaciones · verificar hint con total anual + límite
9. Activar especie · añadir varios conceptos · verificar contador en header
10. Verificar preview live · 12 meses · marzo en bonus (oro) · diciembre en extra (navy border) · resumen anual cuadra
11. Guardar
12. Verificar nómina aparece en lista de gestión personal
13. Verificar treasuryEvents generados en Tesorería para el año
14. Reabrir nómina (modo edit) · verificar bloque 6 visible · cambiar valores · seleccionar "Cambio desde fecha" · guardar · verificar que `vigenciaDesde` aplicado correctamente

---

## §7 · Lo que NO entra en este lote

- Wizard autónomo (siguiente spec análoga)
- Wizard gasto recurrente (spec análoga)
- Wizard plan pensiones (spec análoga)
- Wizard contrato (spec análoga · más compleja)
- Bug fecha nacimiento hardcodeada en Ajustes/Fiscal (tarea aparte mínima)
- TAREA 14 · configuración fiscal sitio único (consolidación dispersión · separado)
- Importación certificado AEAT (si NO existe servicio · spec aparte para crear el flujo de importación)
- Cálculo teórico IRPF desde tablas oficiales (descartado · usamos efectivo histórico)

---

## §8 · Patrón sentado para wizards siguientes

Tras este wizard mergeado · queda definido el patrón ATLAS v8 para reescribir los demás ·

| Patrón | Aplica en |
|---|---|
| 1 sola pantalla · modal full-screen · sin pasos | TODOS los wizards |
| 2 columnas · form izquierda + preview live derecha | Wizards con cálculos (autónomo · gasto · contrato · plan · préstamo) |
| 1 columna ancha · sin preview | Wizards sin cálculo (transferencia · adjuntar documento · etc.) |
| Bloques compactos · 4-5 campos en 1 fila · sin subtítulos | TODOS |
| Selección = oro · paleta v8 estricta | TODOS |
| Lectura desde fuente correcta · NO desde stores zombies | TODOS |
| Cero lenguaje técnico en UI | TODOS |

---

**Fin del spec.**
**Listo para entregar a CC tras Jose subir el mockup a `docs/mockups/atlas-wizard-nomina-v3.html`.**
