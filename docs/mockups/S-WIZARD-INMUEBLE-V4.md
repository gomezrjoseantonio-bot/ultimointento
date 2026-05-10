# S-WIZARD-INMUEBLE-V4 · pantalla única · estilo ATLAS v8

> **Tipo** · Reemplazo completo del formulario crear/editar inmueble · 5 sub-tareas · 1 PR único
> **Tiempo estimado** · 7-12h CC
> **Cierra** · segundo wizard reescrito en estilo ATLAS v8 · refuerza patrón sentado por wizard nómina
> **Reglas aplicadas** · regla canónica grep duro · stop-and-wait · NO reutilizar código del actual · pre-flight obligatorio · 1 PR contra `main` sin mergear hasta autorización Jose
> **DB** · NO sube versión · v70 sigue · solo añade campos a schema TypeScript (IndexedDB es schema-less en campos · sí en índices)
> **Predecesor** · spec wizard nómina v3 (lanzado o en ejecución) · TAREA 13 v4 mergeada · DB v70 · 40 stores
> **Sucesor** · wizard autónomo · gasto recurrente · contrato · plan pensión

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en sub-tarea 1** · grep duro sobre el repo real · NO confiar en supuestos · NO confiar en este spec
2. **Si pre-flight revela contradicciones** con el spec · STOP · documentar · esperar Jose
3. **NO reutilizar NADA del wizard actual** · `/inmuebles/nuevo` · se elimina entero
4. **NO TOCAR DB_VERSION** · sigue v70
5. **Encadenar sub-tareas en una rama** · 1 PR final único contra `main`
6. **NO mergear** · esperar Jose
7. **NO arreglar 43 tests failing pre-existing**
8. **NO arreglar bug fecha hardcodeada en Ajustes/Fiscal** · tarea aparte
9. **Mockup v4 es la guía visual literal** · paleta · espaciados · densidad · colores · tipografía
10. **Sentence case mandatory** · "Nuevo inmueble" no "Nuevo Inmueble" · "Características y fiscal" no "CARACTERÍSTICAS Y FISCAL"
11. **Vender NO entra en este wizard** · es flujo separado (botón "Marcar como vendido" desde la ficha del inmueble · abre wizard de venta · fuera de scope)

---

## §1 · Contexto · qué reemplaza esta tarea

### 1.1 · Wizard actual · estado · qué falla

URL · `/inmuebles/nuevo` (crear) · `/inmuebles/{id}/editar` o equivalente (editar)

Estructura actual · 1 sola pantalla con bloques colapsables (acordeón) ·
- Tipología · selector visual de 5 tipos
- Foto (opcional)
- Identificación · alias · dirección · ref catastral
- Ubicación · CP · Población · Provincia · CCAA
- Compra y coste · fecha · precio · usada/nueva · gastos formalización · impuestos
- Características y fiscal · m² · habitaciones · baños · año · % propiedad · urbana/rústica · valores catastrales · checkbox revisión catastral

Problemas detectados ·
- Selección del tipo Piso usa **navy oscuro** · debe ser **oro** (paleta v8)
- Bloques colapsables innecesarios · todo cabe sin colapsar
- "Total: 0 €" suelto en esquina · debe vivir en preview live
- **Sin preview live** · no hay cálculo de coste base · ni base amortizable · ni amortización · ni % construcción
- **Falta bloque Uso y alquiler** · larga estancia · temporada · turístico · mixto · vivienda habitual · disponible (vendido NO entra · es flujo aparte)
- **Falta CAPEX previo** · mejoras anteriores a entrar en ATLAS · crítico para Jose como dogfood y para clientes que llegan a mitad
- **Falta mobiliario** · amortización 10% · suele venir del XML AEAT
- **Falta valor de referencia** · base de cálculo del ITP desde Ley 11/2021 · auto-rellena con precio · modificable
- **Falta anexos del piso** · checkboxes Parking / Trastero (sin RC propia · si tienen RC propia es otro inmueble)
- **Bloque "Foto"** entre Tipología e Identificación · debe ir al final
- "Características y fiscal" mezcla físicos (m² · baños · año) con fiscales (V.cat · días arrendado)
- Mayúsculas innecesarias en títulos (TIPOLOGÍA · UBICACIÓN · COMPRA Y COSTE)

### 1.2 · Wizard nuevo · objetivo

1 sola pantalla · modal full-screen · 2 columnas (form izquierda · preview live derecha) · 10 bloques en form (varios opcionales con toggle) · estilo ATLAS v8 estricto · cálculos fiscales en tiempo real · adaptación de campos visibles según tipo de activo.

### 1.3 · Caso real Jose como dogfood

Jose puede crear/editar cualquiera de sus inmuebles ·
- Fuertes Acevedo 32 · Piso · Oviedo · 5 habitaciones · alquiler mixto (3 corta + 2 larga)
- Tenderina 64 4D / 4IZ · Piso · Oviedo · larga estancia por habitaciones
- Sant Fruitós (Carles Buigas) · Piso · larga estancia familiar
- Tenderina 48 · Vendido (no entra en wizard alta · ya existe en BBDD)

Caso ficticio del mockup · "Piso Centro · Madrid · 28013" · datos limpios para no liar con historia fiscal de FA32.

---

## §1.5 · Prerequisito Jose · subir mockup al repo

Antes de lanzar este spec a CC · Jose sube `atlas-wizard-inmueble-v4.html` al repo en ·

```
docs/mockups/atlas-wizard-inmueble-v4.html
```

CC verifica con `ls docs/mockups/atlas-wizard-inmueble-v4.html` en sub-tarea 1. Si no existe · STOP.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Pre-flight · localizar arquitectura actual

**Tiempo** · 30-45 min CC

#### Pre-flight obligatorio

```bash
# Verificar mockup subido
ls -la docs/mockups/atlas-wizard-inmueble-v4.html

# Localizar wizard actual
grep -rnE "/inmuebles/nuevo|inmuebles/nuevo|NewPropertyPage|NuevoInmueble|PropertyForm" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
find src/ -type f \( -name "*Property*" -o -name "*Inmueble*" -o -name "Nuevo*Inmueble*" \) 2>/dev/null

# Localizar componentes de bloques actuales
grep -rnE "Tipología|TIPOLOGÍA|Compra y coste|COMPRA Y COSTE|Características y fiscal" src/ --include="*.tsx" 2>/dev/null

# Localizar servicio properties
find src/services -type f \( -name "propert*" -o -name "inmueble*" \) 2>/dev/null
grep -rnE "propertiesService|propertyService|inmueblesService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Schema del store properties
grep -rnE "objectStore.*\"properties\"|createObjectStore.*properties" src/ --include="*.ts" 2>/dev/null
grep -rnE "interface Property|type Property" src/types/ --include="*.ts" 2>/dev/null

# Servicios relacionados
grep -rnE "mejorasInmuebleService|mueblesInmuebleService|vinculosAccesorioService|viviendaHabitualService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Lectura personalData
grep -rnE "personalDataService\.|personalData\.comunidadAutonoma" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Préstamos vinculados a inmueble
grep -rnE "afectacionesInmueble|allocationFactor|prestamosService\.list" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar campo valorReferencia · anexos · usoTipo (probablemente NO existen · CC los añadirá al schema TS)
grep -rnE "valorReferencia|tieneParking|tieneTrastero|usoTipo" src/types/ src/services/ 2>/dev/null | head -10

# Rutas de inmueble (alta · edición · ficha)
grep -rnE "path.*inmuebles|Route.*inmuebles" src/ --include="*.tsx" 2>/dev/null | head -10
```

#### Resultado esperado en commit
CC reporta en commit message ·
- Path exacto del wizard actual · todos los componentes asociados
- Path del servicio `propertiesService`
- Schema TypeScript actual del tipo `Property` · qué campos hay · qué falta
- Path de servicios complementarios · `mejorasInmuebleService` · `mueblesInmuebleService` · `vinculosAccesorioService` · `viviendaHabitualService` · APIs disponibles
- Cómo se accede a `personalData.comunidadAutonoma`
- Cómo listar préstamos con afectación a un inmueble · API exacta
- Si los campos `valorReferencia` · `anexos.tieneParking` · `anexos.tieneTrastero` · `usoTipo` ya existen en schema TS
- Rutas actuales · alta y edición

#### Caso STOP
Si el wizard actual escribe en stores no esperados · si el schema de Property es muy distinto · si NO hay servicio de mejoras / muebles / vínculos · STOP · documentar · esperar Jose.

---

### Sub-tarea 2 · Eliminación completa del wizard actual

**Tiempo** · 30-45 min CC

#### Plan
1. Eliminar TODOS los componentes del wizard actual identificados en sub-tarea 1
2. **NO eliminar** ·
   - `propertiesService` · se reusa
   - Store `properties` · se reusa
   - Tipo TS global `Property` · se extiende (sub-tarea 3)
   - Servicios complementarios · `mejorasInmuebleService` · `mueblesInmuebleService` · etc
3. Mantener la ruta `/inmuebles/nuevo` y `/inmuebles/{id}/editar` para que el wizard nuevo las use

#### Caso STOP
Si la eliminación rompe otras pantallas que reusan componentes del wizard · STOP · listar dependencias · esperar Jose.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit message
- [ ] Componentes del wizard actual eliminados
- [ ] `propertiesService` + servicios complementarios + store + tipo global intactos
- [ ] App compila · build pasa · type check pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 3 · Implementación nueva pantalla única

**Tiempo** · 5-7h CC

#### Plan
Crear · `src/pages/inmuebles/InmueblePage.tsx` (o ruta equivalente identificada en sub-tarea 1).

Conectar a las mismas rutas `/inmuebles/nuevo` y `/inmuebles/{id}/editar`.

**Layout estructural** · ver mockup `docs/mockups/atlas-wizard-inmueble-v4.html` como guía visual literal.

```
┌─ MODAL full-screen overlay ─────────────────────────────────────┐
│ ┌─ HEADER navy compacto ──────────────────────────────────────┐ │
│ │ [icono casa] Editar inmueble · Piso Centro    [X cerrar]    │ │
│ │             Madrid · adquirido 15 jun 2020 · activo         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─ COL FORM (1.35fr) ──────┬─ COL PREVIEW (1fr · bg-soft) ──┐ │
│ │ [B1 · Tipo de activo]     │  KPI Coste base navy            │ │
│ │ [B2 · Identificación]     │  Desglose precio+gastos+imp     │ │
│ │ [B3 · Ubicación]          │  KPI Base amortizable           │ │
│ │ [B4 · Compra y coste]     │  KPI Amortización 3%/año        │ │
│ │ [B5 · Características]    │  KPI % construcción             │ │
│ │ [B6 · Datos fiscales]     │  KPI Días arrendado             │ │
│ │ [B7 · Uso y alquiler]     │  Sección Financiación vinculada │ │
│ │ [B8 · Mejoras previas]    │                                  │ │
│ │ [B9 · Mobiliario]         │                                  │ │
│ │ [B10 · Foto]              │                                  │ │
│ └───────────────────────────┴──────────────────────────────────┘ │
│ ┌─ FOOTER ────────────────────────────────────────────────────┐ │
│ │ Cambios sin guardar · ...     [Cancelar] [Guardar inmueble] │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Bloques · uno a uno**

#### Bloque 1 · Tipo de activo
5 cards horizontales · Piso · Parking · Trastero · Local · Otro · cada una con icono lucide · selección = oro (gold-bg + gold border).

NO mostrar hint sobre campos visibles · la condicionalidad se aplica silenciosamente al cambiar el tipo.

**Visibilidad condicional según tipo** ·

| Tipo seleccionado | Bloques visibles | Bloques ocultos |
|---|---|---|
| **Piso** | Todos los 10 bloques | Ninguno |
| **Parking** | 1, 2, 3, 4, 5 (sin habitaciones/baños), 6, 8, 9, 10 | 7 (uso y alquiler · Parking solo se vincula a contratos) |
| **Trastero** | 1, 2, 3, 4, 5 (sin habitaciones/baños), 6, 8, 9, 10 | 7 (uso y alquiler) |
| **Local** | 1, 2, 3, 4, 5 (sin habitaciones/baños · sí m²), 6, 7 (sin "vivienda habitual"), 8, 9, 10 | — (pero uso adaptado) |
| **Otro** | 1, 2, 3, 4, 5 (sin habitaciones/baños · sí m²), 6, 7 (sin "vivienda habitual"), 8, 9, 10 | — |

Anexos en bloque 5 (Características físicas) **solo si tipo = Piso**.

#### Bloque 2 · Identificación
1 fila · 3 campos ·
- Alias (input texto · obligatorio)
- Dirección (input texto)
- Ref. catastral (input texto · sin botón Catastro · solo input)

#### Bloque 3 · Ubicación
1 fila · 4 campos ·
- CP (input · obligatorio)
- Población (input texto)
- Provincia (input texto)
- Comunidad autónoma (input texto · readonly · auto-rellenado desde Provincia · si no hay coincidencia clara · usa `personalData.comunidadAutonoma`)

#### Bloque 4 · Compra y coste
Fila 1 · 4 campos ·
- Fecha compra (date · obligatorio)
- Precio compra (mono · obligatorio)
- **Valor referencia** (mono · auto-rellena con Precio cuando se introduce · modificable manualmente · base ITP/AJD desde Ley 11/2021)
- Estado · radio inline · Usada / Nueva

Fila 2 · 5 campos ·
- Notaría (mono)
- Registro (mono)
- Gestoría (mono)
- Otros gastos (mono)
- Impuestos · ITP / AJD (mono · hint en label)

Hint debajo · cálculo live ·
> **Coste total** {valor} € · precio + {formalización} formalización + {impuestos} impuestos · usado para cálculo de plusvalía y base amortizable. **Valor referencia** auto-rellenado con el precio · modifícalo si tu valor de referencia catastral es distinto (Ley 11/2021 · ITP desde 2022).

#### Bloque 5 · Características físicas
Visibilidad de campos según tipo · ver tabla §3 · Bloque 1.

Si **Piso** · 1 fila · 6 campos ·
- m² útiles (mono)
- Habitaciones (mono)
- Baños (mono)
- Año construcción (mono)
- Tipo · radio inline · Urbana / Rústica
- % propiedad (mono · sufijo %)

Sub-fila Anexos (solo si tipo = Piso) · bg-soft ·
- Checkboxes simples · Parking · Trastero
- Hint · "Marcar solo si el anexo **comparte RC con el piso**. Si el parking o trastero tiene **RC propia** · se da de alta como inmueble separado y se vincula en el contrato de alquiler."

Si **Parking · Trastero · Local · Otro** · 1 fila · 4 campos ·
- m² útiles (mono)
- Año construcción (mono)
- Tipo · radio inline · Urbana / Rústica
- % propiedad (mono)

#### Bloque 6 · Datos fiscales
1 fila · 4 campos ·
- Valor catastral total (mono)
- V. cat. construcción (mono)
- % construcción (mono · readonly · auto-calculado · `V.cat construcción / V.cat total × 100` · color teal · bg soft)
- Días arrendado año (mono · default 365)

Checkbox debajo · "Valor catastral revisado en el último año (afecta a imputación de rentas)"

#### Bloque 7 · Uso y alquiler
**Solo visible si tipo ≠ Parking · Trastero**

Cards horizontales · `selected = oro` · sin "Vendido" (es flujo aparte) ·

Si **Piso** · 6 cards ·
1. Larga estancia · "Reducción 50-90% según contrato"
2. Temporada · "Sin reducción"
3. Turístico · "Actividad económica · IVA"
4. Mixto · "Larga + temporada · habitaciones"
5. Vivienda habitual · "Tu residencia · no genera renta"
6. Disponible · "Sin uso · imputación rentas"

Si **Local · Otro** · 4 cards (sin Vivienda habitual) ·
1. Larga estancia
2. Temporada
3. Turístico
4. Disponible

Sub-bloque "Alquiler por habitaciones" · solo si tipo = Piso y uso = Larga / Temporada / Turístico / Mixto ·
- Radio inline · No · piso completo / Sí
- Si Sí · input adicional · número de habitaciones

#### Bloque 8 · Mejoras previas (CAPEX)
Toggle ON/OFF en header · contador en title si ON ("· 1 registrada · CAPEX 8.500 €").

Si ON · lista compacta · `capex-row` ·
- Concepto (input texto)
- Fecha (date)
- Importe (mono)
- Tipo · select · "Mejora · amortizable" / "Reparación · gasto"
- Botón eliminar

Botón "+ Añadir mejora previa".

Hint · "Las mejoras suman al coste de adquisición y aumentan la base amortizable. Las reparaciones son gasto deducible del año."

#### Bloque 9 · Mobiliario
Toggle ON/OFF · contador en title si ON.

Si ON · lista compacta similar a CAPEX ·
- Concepto
- Fecha adquisición
- Importe
- Botón eliminar

Hint · "Amortización al 10% anual durante 10 años (casilla 0117 IRPF)."

#### Bloque 10 · Foto del inmueble
Toggle ON/OFF · drag-drop o input file si ON.

**Columna preview · live · siempre visible**

KPI principal navy ·
- Label · "Coste base · adquisición"
- Valor · coste base calculado · `precio + formalización + impuestos`
- Sub · "+ {valor} € de mejoras posteriores · base de cálculo plusvalía" (si hay mejoras)

Desglose mini · 4 filas ·
- Precio compra
- + Notaría · Registro · Gestoría · Otros (suma · 1 línea)
- + Impuestos ITP / AJD
- = **Coste base adquisición** (color teal · bold)

KPIs secundarios · 2×2 grid ·
- Base amortizable (mono · 18px) · sub "Mayor de coste construcción ({% construcción}% del coste) o V.cat construcción"
- Amortización 3 % / año (mono) · sub "Casilla 0115 IRPF · prorrateado por días arrendado"
- % construcción (mono) · sub "{V.cat construcción} de {V.cat total} catastral"
- Días arrendado (mono · "365 / 365") · sub "{%} ocupación · {sin/con} imputación de rentas"

Sección "Financiación vinculada" · solo si hay préstamos con `afectacionesInmueble` apuntando a este inmueble ·
- Por cada préstamo · "{Banco} · ···· {últimos 4}" · principal vivo
- "% afectación a este inmueble"
- "Intereses año previstos · casilla 0105"

**Footer**

- Texto izquierda (solo si hay cambios pendientes) · "Cambios sin guardar · al guardar se recalculan amortización y arrastres del ejercicio actual"
- Botones derecha · "Cancelar" (ghost) + "Guardar inmueble" (primary gold + check icon)

**Función pura `calcularInmuebleResumen()`**

Crear `src/services/inmuebleCalculatorService.ts` ·

```ts
interface InmuebleInput {
  precio: number;
  valorReferencia: number;
  formalizacion: { notaria: number; registro: number; gestoria: number; otros: number };
  impuestos: number;
  valorCatastralTotal: number;
  valorCatastralConstruccion: number;
  diasArrendado: number;
  mejorasPosteriores: { importe: number; tipo: 'mejora' | 'reparacion' }[];
}

interface InmuebleResumen {
  costeTotalFormalizacion: number;
  costeBaseAdquisicion: number;        // precio + formalización + impuestos
  costeMejorasPosteriores: number;     // suma de mejoras (no reparaciones)
  porcentajeConstruccion: number;      // V.cat construcción / V.cat total
  costeConstruccion: number;           // costeBase × % construcción
  baseAmortizable: number;             // max(costeConstruccion, V.cat construcción)
  amortizacionAnual: number;           // baseAmortizable × 0,03
  amortizacionProrrateada: number;     // amortizacionAnual × diasArrendado / 365
  porcentajeOcupacion: number;
}

function calcularInmuebleResumen(input: InmuebleInput): InmuebleResumen {
  // CERO consultas a stores · CERO efectos · pura
}
```

Esta función se reusa para preview live + para validación al guardar.

**Cableado a fuentes correctas**

- `personalData.comunidadAutonoma` · fallback de CCAA si la provincia introducida no resuelve · NO `personalModuleConfig`
- `prestamosService.list({ inmuebleId })` · sección Financiación vinculada del preview
- `mejorasInmuebleService.list({ inmuebleId })` · cargar mejoras existentes (modo edit)
- `mueblesInmuebleService.list({ inmuebleId })` · cargar muebles existentes (modo edit)

**Paleta v8 estricta · cero hardcoded hex**

- Tokens CSS desde el design system existente · NO inventar colores
- Selección = oro · en TODOS los elementos seleccionables (cards tipo · cards uso · checkboxes · radios · toggles)
- Números en JetBrains Mono · títulos en Inter
- Cero verde / rojo / amarillo / morado saturados
- Sentence case en TODO el copy · solo títulos de bloque en uppercase con letter-spacing alto

#### Criterios aceptación sub-tarea 3
- [ ] Mockup `docs/mockups/atlas-wizard-inmueble-v4.html` reproducido fielmente
- [ ] 10 bloques implementados según spec
- [ ] Visibilidad condicional por tipo aplicada correctamente
- [ ] Preview live actualizado en tiempo real
- [ ] Función pura `calcularInmuebleResumen()` con tests unitarios
- [ ] Cero hex hardcoded · 100% tokens CSS
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 4 · Cableado fuentes y guardado

**Tiempo** · 1-2h CC

#### Plan
1. **Lectura · al abrir el wizard** ·
   - Si `/{id}/editar` · cargar inmueble desde `propertiesService.get(id)`
   - Cargar mejoras `mejorasInmuebleService.list({ inmuebleId: id })`
   - Cargar muebles `mueblesInmuebleService.list({ inmuebleId: id })`
   - Cargar préstamos vinculados `prestamosService.list({ inmuebleId: id })` · solo lectura para preview
   - `personalData.comunidadAutonoma` · fallback CCAA
2. **Extender schema TypeScript de `Property`** · añadir si no existen ·
   ```ts
   valorReferencia?: number;
   anexos?: { tieneParking: boolean; tieneTrastero: boolean };
   usoTipo?: 'larga_estancia' | 'temporada' | 'turistico' | 'mixto' | 'vivienda_habitual' | 'disponible';
   alquilerPorHabitaciones?: { activo: boolean; numeroHabitaciones?: number };
   ```
3. **Guardado · al pulsar "Guardar inmueble"** ·
   - Validar campos obligatorios · errores claros en UI
   - Auto-rellenar `valorReferencia` con `precio` si NO se modificó
   - Llamar `propertiesService.upsert(...)` con todos los campos
   - Si hay mejoras nuevas/editadas · `mejorasInmuebleService.bulkUpsert(...)` con `inmuebleId`
   - Si hay muebles · `mueblesInmuebleService.bulkUpsert(...)` con `inmuebleId`
   - **NO escribir** en `viviendaHabitualService` · `prestamosService` · `contractsService` · son flujos separados
4. **Si uso = vivienda_habitual** ·
   - Solo escribir `usoTipo: 'vivienda_habitual'` en `properties`
   - NO sincronizar con `viviendaHabitualService` · esa coordinación es tarea aparte

#### Caso STOP
Si las APIs de `mejorasInmuebleService` o `mueblesInmuebleService` no soportan `bulkUpsert` · STOP · documentar · esperar Jose (puede que CC implemente bulkUpsert · pero confirmar antes).

#### Criterios aceptación sub-tarea 4
- [ ] Lectura desde `personalData.comunidadAutonoma` (NO `personalModuleConfig`)
- [ ] Schema TypeScript de `Property` extendido con campos nuevos
- [ ] Validaciones · campos obligatorios · auto-relleno valor referencia
- [ ] Guardado funcional · datos persistidos en `properties` · `mejorasInmueble` · `mueblesInmueble`
- [ ] Préstamos vinculados solo lectura · NO escritura desde aquí

---

### Sub-tarea 5 · QA visual + accesibilidad mínima

**Tiempo** · 30-45 min CC

#### Plan
1. Verificar visualmente contra mockup en producción
2. Tab order coherente
3. Labels asociados a inputs
4. Botón cerrar accesible con teclado
5. Modal escapable con `Esc`
6. Validación visual de paleta · 0 hex hardcoded · grep solo tokens del design system
7. Comprobar visibilidad condicional por tipo · cambiar entre los 5 tipos · verificar bloques aparecen/desaparecen correctamente
8. Comprobar que el preview se recalcula en tiempo real al cambiar cualquier campo numérico

#### Criterios aceptación sub-tarea 5
- [ ] Cero hex hardcoded en componentes nuevos
- [ ] Tab order verificado
- [ ] Labels correctos
- [ ] Esc cierra modal
- [ ] Visibilidad condicional verificada para los 5 tipos
- [ ] Preview live se recalcula correctamente
- [ ] Comparativa visual screenshot vs mockup pegada en commit

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | Pre-flight | 30-45 min |
| 2 | Eliminación wizard actual | 30-45 min |
| 3 | Implementación pantalla única | 5-7h |
| 4 | Cableado fuentes + guardado | 1-2h |
| 5 | QA visual + accesibilidad | 30-45 min |

**Total** · 7-12h CC.

---

## §4 · Reglas inviolables

1. NO reutilizar código del wizard actual · eliminación completa
2. NO subir DB_VERSION · sigue v70
3. NO escribir en `viviendaHabitualService` desde este wizard · solo `properties.usoTipo`
4. NO escribir en `prestamosService` ni `contractsService` desde este wizard · son flujos aparte
5. NO incluir flujo de venta · "Marcar como vendido" vive aparte
6. NO leer de `personalModuleConfig` · usar `personalData`
7. NO mostrar hint sobre campos visibles según tipo · la condicionalidad se aplica silenciosamente
8. NO mergear · stop-and-wait
9. NO arreglar 43 tests failing pre-existing
10. Selección visual = oro en TODOS los elementos seleccionables
11. Mockup `docs/mockups/atlas-wizard-inmueble-v4.html` es referencia visual literal
12. Cero hex hardcoded · 100% tokens CSS del design system
13. Función `calcularInmuebleResumen()` pura · sin efectos · con tests unitarios
14. Sentence case · cero MAYÚSCULAS innecesarias

---

## §5 · Criterios de aceptación globales

- [ ] 5 sub-tareas ejecutadas en orden
- [ ] Pre-flight pegado en commit message de sub-tarea 1
- [ ] 1 PR final único contra `main` con commits separados por sub-tarea
- [ ] PR description con tabla resumen + screenshots vs mockup para cada uno de los 5 tipos
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Usuario abre `/inmuebles/nuevo` · ve wizard nuevo · 1 sola pantalla · puede crear y editar · datos persisten · cálculos en tiempo real**

---

## §6 · Validación manual Jose tras merge

1. Abrir `/inmuebles/nuevo` (modo create)
2. Verificar layout · 2 columnas · header navy · footer fijo · sin scroll innecesario
3. Cambiar tipo entre Piso · Parking · Trastero · Local · Otro · verificar que bloques aparecen/desaparecen correctamente sin parpadeos
4. Volver a Piso · introducir datos completos del Piso Centro Madrid del mockup
5. Verificar valor referencia · auto-rellena con precio al introducirlo · modificar manualmente y verificar que persiste
6. Marcar anexo Parking · verificar que aparece sin input de RC
7. Activar mejoras previas · añadir 1 reforma cocina 8.500 € · marcar como amortizable
8. Cambiar uso a Larga estancia · verificar que aparece sub-bloque "alquiler por habitaciones"
9. Verificar preview live · coste base 262.750 € · base amortizable 157.650 € · amortización 4.729,50 € · % construcción 60%
10. Guardar
11. Volver a `/inmuebles/{id}/editar` · verificar que todos los datos persisten correctamente
12. Editar precio · verificar que valor referencia NO se sobrescribe automáticamente (ya tiene valor manual)
13. Cambiar tipo a Parking · verificar que el bloque uso desaparece y los datos físicos se simplifican

---

## §7 · Lo que NO entra en este lote

- Wizard de venta (botón "Marcar como vendido" · spec aparte)
- Wizard de transformación de inmueble (T64 5·01 trastero → 2 viviendas · Santa Catalina CB 7→100 RC · spec aparte)
- Coordinación con `viviendaHabitualService` (si uso = vivienda habitual · solo escribe `usoTipo` · sincronización es tarea aparte)
- Flujo "buscar en Catastro" (input solo texto · sin lookup automático)
- Wizards siguientes (autónomo · gasto recurrente · contrato · plan pensión · préstamo)
- Bug fecha hardcodeada en Ajustes/Fiscal (tarea aparte mínima)
- TAREA 14 · configuración fiscal sitio único (separado)

---

## §8 · Patrón sentado · refuerza el del wizard nómina

Tras este wizard mergeado · queda confirmado el patrón ATLAS v8 ·

| Patrón | Aplica en |
|---|---|
| 1 sola pantalla · modal full-screen · sin pasos | Todos los wizards |
| 2 columnas · form izquierda + preview live derecha | Wizards con cálculos (nómina · inmueble · autónomo · gasto · contrato · plan · préstamo) |
| Bloques compactos · 4-5 campos en 1 fila · sin subtítulos | Todos |
| Selección = oro · paleta v8 estricta | Todos |
| Lectura desde fuente correcta · NO desde stores zombies | Todos |
| Cero lenguaje técnico en UI | Todos |
| Visibilidad condicional silenciosa según selectores | Wizards con sub-tipos (este es el primero · sienta patrón) |

---

**Fin del spec.**
**Listo para entregar a CC tras Jose subir `atlas-wizard-inmueble-v4.html` a `docs/mockups/`.**
