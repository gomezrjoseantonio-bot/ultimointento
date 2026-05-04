# TAREA CC · T38 · Mapeo familias nuevas + coherencia `categoria` + migración suave

> **Tipo** · schema task + fix · 1 PR único · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama madre `main`
> **Predecesores** · T34 + T35 + T34-fix + T35-fix + T34.b + T35.b · todos mergeados
> **Tiempo estimado** · 8-10h CC · 1h revisión Jose
> **DB** · **SÍ se sube DB_VERSION** · 67 → 68 · campo nuevo opcional + migración no destructiva
> **Riesgo** · medio · feature aditiva con migración · datos antiguos compatibles
> **Output** · 1 PR contra `main` con schema migrado · 2 wizards ajustados · listado leyendo campo nuevo

---

## 0 · Contexto · qué problema resuelve

Tras mergear T34-fix + T35-fix · validación visual de Jose en producción detectó que **los compromisos creados con el catálogo nuevo de 6 familias se almacenan inconsistentemente** en el store `compromisosRecurrentes`:

### Estado real verificado (DevTools en producción)

**Compromiso "Suministros · Luz · Visalia" (creado con T34 viejo · personal id=1):**
```
ambito: "personal"
bolsaPresupuesto: "necesidades"
categoria: "vivienda.suministros"     ← legacy coherente
tipo: "suministro"                     ← legacy
subtipo: "luz"                         ← OK
```

**Compromiso "Renting Peugeot 3008" (creado con T34-fix · familia "Otros · Personalizado"):**
```
ambito: "personal"
bolsaPresupuesto: "deseos"
categoria: "personal"                  ← genérico · NO refleja familia
tipo: "otros"                          ← mapeado al legacy más cercano
subtipo: "personalizado"               ← OK · ID subtipo nuevo
alias: "Renting Peugeot 3008"          ← nombre personalizado
```

**Compromiso "Día a día · Salud · farmacia · médicos" (creado con T34-fix · familia "Día a día"):**
```
tipo: "otros"                          ← perdió info · "Día a día" no existe en enum legacy
subtipo: "salud"
categoria: "salud"                     ← inconsistente · debería ser "dia_a_dia.salud"
```

**Compromiso "Vivienda · Alquiler" (creado con T34-fix · familia "Vivienda"):**
```
tipo: "otros"                          ← perdió info · "Vivienda" no existe en enum legacy
subtipo: "alquiler"
categoria: "vivienda.alquiler"         ← coherente
```

### Diagnóstico

El campo `tipo` es un **enum legacy de 4 valores** (`suministro` · `seguro` · `suscripcion` · `impuesto` · `otros` · etc · pendiente de verificar el conjunto exacto). Las **6 familias nuevas** introducidas por T34-fix (`vivienda` · `suministros` · `dia_a_dia` · `suscripciones` · `seguros_cuotas` · `otros`) NO existen en ese enum.

T34-fix mapea cada familia al enum legacy más cercano:
- Vivienda → `otros` (NO existe `vivienda` en legacy)
- Suministros → `suministro`
- Día a día → `otros`
- Suscripciones → `suscripcion`
- Seguros y cuotas → `otros`
- Otros → `otros`

**Resultado** · 4 de las 6 familias se aplastan a `tipo='otros'`. La info de la familia real **se pierde** salvo en el `alias` (texto libre) y a veces en `categoria` (inconsistente · a veces "familia.subfamilia" · a veces solo "subfamilia" · a veces genérico "personal").

### Consecuencias

1. La columna "Tipo" del listado Personal es inútil (mucho "otros")
2. Filtros del listado son los 4 valores legacy · NO las 6 familias nuevas
3. Cualquier análisis posterior que agrupe por familia (vista 50/30/20 · vista fiscal · gráficas) **dará resultados erróneos**
4. T36 (vista gastos personales sobre movements) hereda el problema si llega antes de la fix
5. T39 (listado redesign) NO puede empezar hasta tener datos coherentes

T38 cierra esta brecha **enriqueciendo el modelo de datos sin romper nada existente**.

---

## 1 · Solución · campo nuevo `tipoFamilia` + coherencia `categoria` + migración suave

### 1.1 · Modelo conceptual

**Antes** (estado actual):
- `tipo` → enum legacy de 4-6 valores · acepta solo lo que el enum permite
- `categoria` → string libre · inconsistente
- Familias nuevas pierden info al guardar

**Después** (T38):
- `tipoFamilia` → **campo NUEVO opcional** · contiene la familia real (`'vivienda'` · `'suministros'` · `'dia_a_dia'` · `'suscripciones'` · `'seguros_cuotas'` · `'otros'`)
- `tipo` → mantenido por compatibilidad · CC lo escribe con el legacy mapeado
- `categoria` → **normalizado** a `'familia.subfamilia'` · ej. `'dia_a_dia.salud'` · `'vivienda.alquiler'` · `'seguros_cuotas.gimnasio'`
- `subtipo` → sin cambios · ya funciona

### 1.2 · Mapping completo Personal · 6 familias × subtipos × categoria normalizada × tipo legacy

CC codifica este mapping en `src/modules/personal/wizards/utils/familyMapping.ts`:

```typescript
// Mapping familia → tipo legacy (para compatibilidad hacia atrás)
export const FAMILIA_TO_TIPO_LEGACY_PERSONAL: Record<string, string> = {
  vivienda:        'otros',         // legacy no tiene "vivienda"
  suministros:     'suministro',
  dia_a_dia:       'otros',         // legacy no tiene "dia_a_dia"
  suscripciones:   'suscripcion',
  seguros_cuotas:  'otros',         // legacy no tiene "seguros_cuotas"
  otros:           'otros',
};

// Función · construye categoria normalizada "familia.subfamilia"
export function buildCategoriaPersonal(familiaId: string, subtipoId: string): string {
  return `${familiaId}.${subtipoId}`;
}
```

**Ejemplos de qué se guarda:**

| Wizard input | tipoFamilia | tipo (legacy) | subtipo | categoria |
|---|---|---|---|---|
| Vivienda · Alquiler | `vivienda` | `otros` | `alquiler` | `vivienda.alquiler` |
| Vivienda · IBI | `vivienda` | `otros` | `ibi` | `vivienda.ibi` |
| Suministros · Luz | `suministros` | `suministro` | `luz` | `suministros.luz` |
| Día a día · Supermercado | `dia_a_dia` | `otros` | `supermercado` | `dia_a_dia.supermercado` |
| Día a día · Salud | `dia_a_dia` | `otros` | `salud` | `dia_a_dia.salud` |
| Suscripciones · Streaming | `suscripciones` | `suscripcion` | `streaming` | `suscripciones.streaming` |
| Seguros y cuotas · Gimnasio | `seguros_cuotas` | `otros` | `gimnasio` | `seguros_cuotas.gimnasio` |
| Seguros y cuotas · Seguro coche | `seguros_cuotas` | `otros` | `seguro_coche` | `seguros_cuotas.seguro_coche` |
| Otros · Mantenimiento coche | `otros` | `otros` | `mantenimiento_coche` | `otros.mantenimiento_coche` |
| Otros · Personalizado · "Renting Peugeot 3008" | `otros` | `otros` | `personalizado` | `otros.personalizado` |

### 1.3 · Mapping completo Inmueble · 7 familias

CC codifica en `src/modules/inmuebles/wizards/utils/familyMappingInmueble.ts`:

```typescript
export const FAMILIA_TO_TIPO_LEGACY_INMUEBLE: Record<string, string> = {
  tributos:    'impuesto',          // verificar si "impuesto" existe en legacy
  comunidad:   'otros',             // legacy no tiene "comunidad"
  suministros: 'suministro',
  seguros:     'seguro',            // verificar si "seguro" existe en legacy
  gestion:     'otros',             // legacy no tiene "gestion"
  reparacion:  'otros',             // legacy no tiene "reparacion"
  otros:       'otros',
};

export function buildCategoriaInmueble(familiaId: string, subtipoId: string): string {
  return `inmueble.${familiaId}.${subtipoId}`;
}
```

**Nota** · CC verifica en A.2 los valores reales del enum legacy y ajusta el mapping. Si `'impuesto'` o `'seguro'` NO existen · cae en `'otros'`.

**Ejemplos:**

| Wizard input | tipoFamilia | tipo (legacy) | subtipo | categoria |
|---|---|---|---|---|
| Tributos · IBI | `tributos` | `impuesto` (o `otros`) | `ibi` | `inmueble.tributos.ibi` |
| Comunidad · Cuota ordinaria | `comunidad` | `otros` | `cuota_ordinaria` | `inmueble.comunidad.cuota_ordinaria` |
| Suministros · Internet | `suministros` | `suministro` | `internet` | `inmueble.suministros.internet` |
| Seguros · Hogar | `seguros` | `seguro` (o `otros`) | `hogar` | `inmueble.seguros.hogar` |
| Gestión · Honorarios agencia | `gestion` | `otros` | `honorarios_agencia` | `inmueble.gestion.honorarios_agencia` |
| Reparación · Mantenimiento caldera | `reparacion` | `otros` | `mantenimiento_caldera` | `inmueble.reparacion.mantenimiento_caldera` |
| Otros · Personalizado | `otros` | `otros` | `personalizado` | `inmueble.otros.personalizado` |

---

## 2 · INSTRUCCIONES INVIOLABLES

### 2.1 · Scope estricto

CC trabaja **solo** en:

1. **Schema task** · subir DB_VERSION 67 → 68 · añadir campo `tipoFamilia?: string` a interface `CompromisoRecurrente` · campo opcional · NO obligatorio
2. **Migración no destructiva** · al abrir DB v68 · script que infiere `tipoFamilia` para todos los registros existentes · escribe `tipoFamilia` y normaliza `categoria` cuando se pueda · datos antiguos siguen funcionando
3. **Mappings** · crear archivos `familyMapping.ts` (Personal) y `familyMappingInmueble.ts` (Inmueble) con tablas exactas de §1.2 y §1.3
4. **Ajustar T34-fix wizard Personal** · al guardar · escribir `tipoFamilia` + `categoria` normalizada + `tipo` legacy + `subtipo` + `alias`
5. **Ajustar T35-fix wizard Inmueble** · al guardar · idem con catálogo inmueble
6. **Ajustar listado Personal (T34.b)** · columna Tipo lee `tipoFamilia` (con fallback a `tipo` legacy si null) · filtros pasan a las 6 familias nuevas
7. **Ajustar listado Inmueble (T35.b)** · columna Tipo lee `tipoFamilia` · filtros 7 familias nuevas
8. **Auditoría reportada en PR** · cuántos registros se migraron · cuántos quedaron sin `tipoFamilia` por imposibilidad de inferencia

NADA más.

### 2.2 · CC tiene PROHIBIDO

❌ Eliminar campos existentes (`tipo`, `categoria`, `responsable`, etc) · solo añadir y normalizar
❌ Cambiar el enum del campo `tipo` · sigue siendo legacy
❌ Modificar `compromisosRecurrentesService.ts` salvo añadir helper para construir el objeto a guardar
❌ Modificar `treasuryBootstrapService.ts` · no relacionado
❌ Migrar registros con riesgo de pérdida de datos · si la inferencia falla · `tipoFamilia` queda `undefined` y el registro sigue funcionando
❌ Hacer rediseño visual del listado · solo cambiar la fuente del dato (de `tipo` a `tipoFamilia`) y los valores de los filtros · el rediseño completo es T39 separado
❌ Tocar otros stores · `movements` · `treasuryEvents` · `gastosInmueble` · `mejorasInmueble` · etc
❌ Implementar T39 (listado redesign) ni T36 (vista gastos sobre movements) ni T37 (multi-asignación)
❌ Eliminar el campo `responsable` hardcoded "titular" · es deuda separada · no toca aquí

### 2.3 · Reglas técnicas duras

- TypeScript estricto · cero `any` · cero `as any`
- Tokens v5 · cero hex hardcoded
- Migración idempotente · si se ejecuta 2 veces no rompe ni duplica
- Migración silenciosa · NO bloquea UI · usuario no se entera
- Logs de migración · CC añade `console.info` con resumen · cuántos registros migrados · cuántos sin inferencia
- Idempotencia en submit · sigue garantizada (T34-fix ya la tenía)

### 2.4 · Stop-and-wait

CC abre PR · publica · **DETIENE** · espera revisión Jose · NO mergea hasta autorización.

---

## 3 · Etapa A · auditoría inicial · OBLIGATORIA antes de codear

### A.1 · Reportar schema actual `CompromisoRecurrente`

```bash
grep -rn "interface CompromisoRecurrente\|type CompromisoRecurrente" src/types/ src/services/db.ts
cat src/services/db.ts | head -200
```

CC reporta:
- Path exacto de la interface/type
- Lista completa de campos · tipos · opcionales
- DB_VERSION actual confirmado · 67

### A.2 · Reportar enum real `tipo` en `compromisosRecurrentes`

```bash
grep -rn "TipoCompromiso\|tipoCompromiso\|type Tipo" src/types/ src/services/personal/
```

CC reporta:
- Valores exactos del enum legacy del campo `tipo`
- Confirmar si `'impuesto'`, `'seguro'`, `'suministro'`, `'suscripcion'`, `'otros'` existen
- Si algún valor del mapping de §1.3 NO existe · ajustar a `'otros'` y documentar

### A.3 · Reportar uso actual del campo `categoria`

```bash
grep -rn "\.categoria" src/modules/ src/services/ | head -30
```

CC reporta:
- Quién LEE el campo `categoria` (PresupuestoPage · listados · gráficas · etc)
- Quién ESCRIBE el campo `categoria` (wizards · servicios · imports XML)
- Formato esperado · ¿siempre "familia.subfamilia"? ¿a veces solo "subfamilia"?

### A.4 · Conteo de registros existentes en producción

```javascript
// Console DevTools en producción
const req = indexedDB.open('atlas', 67);
req.onsuccess = () => {
  const tx = req.result.transaction('compromisosRecurrentes', 'readonly');
  const all = tx.objectStore('compromisosRecurrentes').getAll();
  all.onsuccess = () => {
    console.log('Total:', all.result.length);
    console.log('Por tipo:', all.result.reduce((acc, c) => {
      acc[c.tipo] = (acc[c.tipo] || 0) + 1;
      return acc;
    }, {}));
    console.log('Sin categoria:', all.result.filter(c => !c.categoria).length);
    console.log('Categoria con punto:', all.result.filter(c => c.categoria?.includes('.')).length);
    console.log('Categoria sin punto:', all.result.filter(c => c.categoria && !c.categoria.includes('.')).length);
  };
};
```

CC documenta el resultado en el PR · sirve de baseline para verificar la migración.

CC NO empieza a codear hasta documentar A.1 · A.2 · A.3 · A.4.

---

## 4 · Etapa B · estructura archivos

### B.1 · Archivos a crear

```
src/modules/personal/wizards/utils/
  - familyMapping.ts                 (mapping Personal · §1.2)

src/modules/inmuebles/wizards/utils/
  - familyMappingInmueble.ts         (mapping Inmueble · §1.3)

src/services/migrations/
  - v68-tipoFamilia.ts               (migración · infiere tipoFamilia para registros existentes)
```

### B.2 · Archivos a modificar

```
src/services/db.ts
  · subir DB_VERSION 67 → 68
  · añadir campo `tipoFamilia?: string` a interface CompromisoRecurrente
  · registrar migración v68 en el upgrade callback de IndexedDB

src/modules/personal/wizards/NuevoGastoRecurrentePage.tsx
  · al construir objeto a guardar · añadir tipoFamilia + categoria normalizada
  · usar familyMapping.ts

src/modules/inmuebles/wizards/NuevoGastoRecurrenteInmueblePage.tsx
  · idem con familyMappingInmueble.ts

src/modules/personal/wizards/EditarGastoRecurrentePage.tsx (si existe tras T34.b)
  · al actualizar · escribir tipoFamilia + categoria normalizada

src/modules/inmuebles/wizards/EditarGastoRecurrenteInmueblePage.tsx (si existe tras T35.b)
  · idem

src/modules/personal/pages/GastosPage.tsx (o equivalente · listado T34.b)
  · columna Tipo lee tipoFamilia (fallback a tipo legacy si null)
  · botones de filtro pasan a las 6 familias nuevas
  · NO redesign visual completo

src/modules/inmuebles/pages/GastosTab.tsx (o equivalente · listado T35.b)
  · idem con 7 familias inmueble
```

### B.3 · Archivos que NO se tocan

❌ `src/services/personal/compromisosRecurrentesService.ts` (salvo helper si CC lo justifica)
❌ `src/services/treasuryBootstrapService.ts`
❌ Otros stores
❌ Otros wizards (Calendario · Importe · Cuenta · Bolsa · etc · sus secciones)
❌ Componente `<TipoGastoSelector />` ya construido en T34-fix · queda igual
❌ DetectarCompromisosPage · queda igual

---

## 5 · Etapa C · migración v68 · estrategia exacta

### 5.1 · Cuándo se ejecuta

Al abrir IndexedDB con `version: 68` · el callback `upgradeneeded` detecta `oldVersion < 68` y ejecuta la migración.

### 5.2 · Qué hace la migración

Para cada registro existente en `compromisosRecurrentes`:

**Paso 1 · si ya tiene `tipoFamilia` definido · skip** (idempotencia)

**Paso 2 · inferir `tipoFamilia` por orden de preferencia:**

a) **Desde `categoria` legacy si tiene formato "familia.subfamilia"**
   - `vivienda.suministros` → revisar subtipo · si subtipo está en lista de Suministros nuevos (luz/gas/agua/internet/movil) → `tipoFamilia = 'suministros'`
   - `vivienda.X` → `tipoFamilia = 'vivienda'`
   - `inmueble.suministros` → `tipoFamilia = 'suministros'` (si ámbito inmueble)
   - `inmueble.X` → infiere por subtipo · ver tabla de mapping inverso
   - `obligaciones.multas` → `tipoFamilia = 'otros'` (cae en familia residual)
   - `salud` · `alimentacion` → `tipoFamilia = 'dia_a_dia'`
   - `personal` (genérico) → si tipo legacy es `suscripcion` → `tipoFamilia = 'suscripciones'` · si no → `tipoFamilia = 'otros'`

b) **Desde `tipo` legacy + `subtipo`** (si `categoria` está vacío o no es inferible):
   - `tipo='suministro'` → `tipoFamilia='suministros'`
   - `tipo='suscripcion'` → `tipoFamilia='suscripciones'`
   - `tipo='seguro'` → si ámbito personal → `tipoFamilia='seguros_cuotas'` · si inmueble → `tipoFamilia='seguros'`
   - `tipo='impuesto'` → si ámbito personal → `tipoFamilia='otros'` (impuestos personales caen en residual) · si inmueble → `tipoFamilia='tributos'`
   - `tipo='otros'` → revisar `subtipo`:
     - subtipo en {alquiler · ibi · comunidad · seguro_hogar} → `tipoFamilia='vivienda'` (personal)
     - subtipo en {supermercado · transporte · restaurantes · ocio · salud · ropa · cuidado_personal} → `tipoFamilia='dia_a_dia'`
     - subtipo en {gimnasio · educacion · profesional · ong} → `tipoFamilia='seguros_cuotas'`
     - subtipo `personalizado` → `tipoFamilia='otros'`
     - default → `tipoFamilia='otros'`

c) **Si nada se puede inferir** · `tipoFamilia` queda `undefined` · registro sigue funcionando · listado lo muestra como "Sin clasificar"

**Paso 3 · normalizar `categoria` cuando ya se infiere `tipoFamilia`:**
- Si `categoria` está en formato "familia.subfamilia" coherente con `tipoFamilia` inferido · dejar igual
- Si `categoria` es genérico (`personal` · `salud`) · sobrescribir a `tipoFamilia.subtipo`
- Si `categoria` está vacío · escribir `tipoFamilia.subtipo`

**Paso 4 · log de migración:**
```typescript
console.info('[T38 migration v68]', {
  total: registros.length,
  migrados: migrados,
  sinClasificar: sinClasificar,
  inferidosDesdeCategoria: desdeCategoria,
  inferidosDesdeTipoSubtipo: desdeTipoSubtipo,
});
```

### 5.3 · Idempotencia y reversibilidad

- Si la migración se ejecuta 2 veces (paso 1 protege) · no duplica ni rompe
- Si CC quiere revertir · no necesita undo · `tipoFamilia` es campo nuevo opcional · ignorarlo equivale a estado pre-T38

### 5.4 · Rendimiento

Si hay >1.000 registros · CC procesa en lotes de 100 · NO bloquea UI. (En producción Jose tiene ~30-50 registros · no problema.)

---

## 6 · Etapa D · ajustes en wizards y listados

### 6.1 · Wizard Personal (T34-fix · NuevoGastoRecurrentePage)

Al construir el objeto compromiso a guardar:

```typescript
import { FAMILIA_TO_TIPO_LEGACY_PERSONAL, buildCategoriaPersonal } from './utils/familyMapping';

const compromiso = {
  // ... campos existentes
  tipoFamilia: form.tipoFamiliaId,                                   // ← NUEVO
  tipo: FAMILIA_TO_TIPO_LEGACY_PERSONAL[form.tipoFamiliaId],         // ← legacy mapeado
  subtipo: form.subtipoId,                                            // ← ya funciona
  categoria: buildCategoriaPersonal(form.tipoFamiliaId, form.subtipoId),  // ← normalizado
  alias: form.nombrePersonalizado || generateAlias(...),
  // resto sin cambios
};
```

### 6.2 · Wizard Inmueble (T35-fix · NuevoGastoRecurrenteInmueblePage)

```typescript
import { FAMILIA_TO_TIPO_LEGACY_INMUEBLE, buildCategoriaInmueble } from './utils/familyMappingInmueble';

const compromiso = {
  // ... campos existentes
  tipoFamilia: form.tipoFamiliaId,
  tipo: FAMILIA_TO_TIPO_LEGACY_INMUEBLE[form.tipoFamiliaId],
  subtipo: form.subtipoId,
  categoria: buildCategoriaInmueble(form.tipoFamiliaId, form.subtipoId),
  // resto sin cambios
};
```

### 6.3 · Listado Personal (T34.b · GastosPage)

Cambios mínimos · NO redesign:

**Columna Tipo** · lee `tipoFamilia` con fallback:

```typescript
// Función render de la columna
function renderTipo(c: CompromisoRecurrente) {
  const familia = c.tipoFamilia || inferFamiliaFallback(c.tipo, c.subtipo) || 'sin_clasificar';
  return FAMILIA_LABELS_PERSONAL[familia] || 'Sin clasificar';
}

const FAMILIA_LABELS_PERSONAL = {
  vivienda:        'Vivienda',
  suministros:     'Suministros',
  dia_a_dia:       'Día a día',
  suscripciones:   'Suscripciones',
  seguros_cuotas:  'Seguros y cuotas',
  otros:           'Otros',
  sin_clasificar:  'Sin clasificar',
};
```

**Filtros** · cambiar de los 4 valores legacy a las 6 familias nuevas + opción "Todos":

```typescript
const FILTROS_PERSONAL = [
  { id: 'todos',          label: 'Todos · N' },     // N = total
  { id: 'vivienda',       label: 'Vivienda' },
  { id: 'suministros',    label: 'Suministros' },
  { id: 'dia_a_dia',      label: 'Día a día' },
  { id: 'suscripciones',  label: 'Suscripciones' },
  { id: 'seguros_cuotas', label: 'Seguros y cuotas' },
  { id: 'otros',          label: 'Otros' },
];
```

Filtrado · `c.tipoFamilia === filtroSeleccionado` (con fallback a inferencia para registros antiguos).

### 6.4 · Listado Inmueble (T35.b · GastosTab)

Idem con 7 familias del catálogo inmueble.

---

## 7 · Etapa E · verificación

### Build
- [ ] `tsc --noEmit` · 0 errores nuevos
- [ ] `npm run build` · pasa
- [ ] `npm test` · pasa
- [ ] DB_VERSION subido a 68

### Funcional · migración
- [ ] Al abrir DB v68 por primera vez · migración se ejecuta
- [ ] Registros antiguos con `categoria='vivienda.suministros'` reciben `tipoFamilia='suministros'`
- [ ] Registros antiguos con `categoria='inmueble.suministros'` reciben `tipoFamilia='suministros'`
- [ ] Registros antiguos con `tipo='suministro'` y subtipo `'luz'` reciben `tipoFamilia='suministros'`
- [ ] Registros antiguos con subtipo `'alquiler'` reciben `tipoFamilia='vivienda'`
- [ ] Registros antiguos con subtipo `'supermercado'` reciben `tipoFamilia='dia_a_dia'`
- [ ] Registros antiguos con subtipo `'personalizado'` reciben `tipoFamilia='otros'`
- [ ] Migración idempotente · ejecutar 2 veces NO rompe
- [ ] Log consola muestra resumen · total · migrados · sin_clasificar
- [ ] Datos antiguos NO modificados destructivamente · `tipo` legacy se mantiene · `categoria` se normaliza solo si tenía sentido

### Funcional · alta nueva
- [ ] Crear "Vivienda · Alquiler" en wizard Personal → guarda `tipoFamilia='vivienda'`, `tipo='otros'`, `subtipo='alquiler'`, `categoria='vivienda.alquiler'`
- [ ] Crear "Día a día · Supermercado" → guarda `tipoFamilia='dia_a_dia'`, `tipo='otros'`, `subtipo='supermercado'`, `categoria='dia_a_dia.supermercado'`
- [ ] Crear "Otros · Personalizado · Renting" → guarda `tipoFamilia='otros'`, `tipo='otros'`, `subtipo='personalizado'`, `alias='Renting'`, `categoria='otros.personalizado'`
- [ ] Crear "Tributos · IBI" en wizard Inmueble → guarda `tipoFamilia='tributos'`, `tipo='impuesto'` (o `otros`), `categoria='inmueble.tributos.ibi'`
- [ ] Crear "Reparación · Mantenimiento caldera" → guarda `tipoFamilia='reparacion'`, `categoria='inmueble.reparacion.mantenimiento_caldera'`

### Funcional · listado Personal
- [ ] Columna Tipo muestra "Vivienda" · "Suministros" · "Día a día" · "Suscripciones" · "Seguros y cuotas" · "Otros"
- [ ] Filtros muestran las 6 familias nuevas + Todos
- [ ] Click en "Día a día" filtra solo registros con `tipoFamilia='dia_a_dia'`
- [ ] Registros antiguos sin migrar bien aparecen como "Sin clasificar"
- [ ] Edición de un compromiso antiguo lo actualiza con `tipoFamilia` correcta tras guardar

### Funcional · listado Inmueble
- [ ] Columna Tipo muestra "Tributos" · "Comunidad" · "Suministros" · "Seguros" · "Gestión" · "Reparación" · "Otros"
- [ ] Filtros muestran las 7 familias nuevas + Todos
- [ ] Filtrado correcto

### Funcional · compatibilidad hacia atrás
- [ ] Compromisos creados antes de T38 siguen mostrándose en listado
- [ ] Tesorería sigue proyectando cargos correctamente
- [ ] Edición de un compromiso antiguo no rompe sus datos
- [ ] PresupuestoPage (que lee `bolsaPresupuesto`) sigue funcionando

### Tipado
- [ ] Cero `any` · cero `as any` nuevos
- [ ] Interface `CompromisoRecurrente` actualizada con `tipoFamilia?: string`
- [ ] Mapping tipado correctamente

### CSS / tokens
- [ ] Cero hex hardcoded en cambios
- [ ] Tokens v5 respetados

### Reglas de scope
- [ ] CERO modificación de servicios salvo helpers necesarios
- [ ] CERO modificación de otros stores
- [ ] CERO redesign visual del listado (solo cambio fuente de datos + filtros)
- [ ] CERO eliminación de campos legacy
- [ ] DB_VERSION subido a 68 · migración no destructiva

---

## 8 · PR

**Rama** · `claude/t38-tipoFamilia-coherencia-categoria`

**Título PR** · `feat(model): T38 · campo tipoFamilia + coherencia categoria + migración v68 sin pérdida`

**Body PR**:

```
## Resumen

T34-fix introdujo 6 familias nuevas en el catálogo de gastos (Vivienda · Suministros ·
Día a día · Suscripciones · Seguros y cuotas · Otros). Pero el campo `tipo` del store
es enum legacy de 4 valores · 4 de las 6 familias nuevas se aplastan a `tipo='otros'` ·
la info real se pierde · listado y filtros quedan inútiles.

T38 añade el campo `tipoFamilia` al store · normaliza `categoria` a "familia.subfamilia" ·
ajusta wizards y listados para usarlo · migra los registros existentes inferiendo
la familia desde `categoria` legacy o `tipo+subtipo`.

Datos antiguos NO se rompen · NO se elimina ningún campo · evolución limpia.

## Auditoría · estado pre-T38

[CC documenta · enum legacy real · cuántos registros sin clasificar · etc]

## Cambios

### Schema
- ✏️ DB_VERSION 67 → 68
- ✏️ Interface `CompromisoRecurrente` · campo nuevo `tipoFamilia?: string` opcional
- ✨ Migración v68 · infiere `tipoFamilia` para registros existentes · idempotente

### Archivos nuevos
- ✨ `familyMapping.ts` (Personal · 6 familias)
- ✨ `familyMappingInmueble.ts` (Inmueble · 7 familias)
- ✨ `v68-tipoFamilia.ts` (migración)

### Modificados
- ✏️ Wizard Personal · escribe tipoFamilia + categoria normalizada al guardar
- ✏️ Wizard Inmueble · idem con catálogo inmueble
- ✏️ Listado Personal · columna Tipo lee tipoFamilia · filtros 6 familias
- ✏️ Listado Inmueble · idem con 7 familias
- ✏️ Edición · idem (si EditarGastoRecurrentePage existe)

## Comportamiento

### Antes (post T34-fix · pre T38)
- Vivienda · Alquiler → tipo='otros', subtipo='alquiler', categoria='vivienda.alquiler'
- Día a día · Supermercado → tipo='otros', subtipo='supermercado', categoria='salud' (incoherente)
- Renting Peugeot → tipo='otros', subtipo='personalizado', categoria='personal'
- Listado · columna Tipo dice "otros" en 4 de 6 familias · filtros inútiles

### Después (T38)
- Vivienda · Alquiler → tipoFamilia='vivienda', tipo='otros', subtipo='alquiler', categoria='vivienda.alquiler'
- Día a día · Supermercado → tipoFamilia='dia_a_dia', tipo='otros', subtipo='supermercado', categoria='dia_a_dia.supermercado'
- Renting Peugeot → tipoFamilia='otros', tipo='otros', subtipo='personalizado', categoria='otros.personalizado', alias='Renting Peugeot'
- Listado · columna Tipo muestra familia real · filtros operativos

### Migración
- Registros con `categoria='vivienda.suministros'` → tipoFamilia inferido='suministros'
- Registros con `tipo='suministro'` y `subtipo='luz'` → tipoFamilia='suministros'
- Registros con `subtipo='alquiler'` → tipoFamilia='vivienda'
- Registros con `subtipo='supermercado'` → tipoFamilia='dia_a_dia'
- Registros con `subtipo='personalizado'` → tipoFamilia='otros'
- Si nada se puede inferir → tipoFamilia=undefined · listado muestra "Sin clasificar"

### Resumen migración (CC documenta tras ejecutar)
- Total registros: X
- Migrados con éxito: Y
- Sin clasificar: Z
- Inferidos desde categoria: A
- Inferidos desde tipo+subtipo: B

## Reusabilidad

Mappings exportados desde utils · futuros wizards · features de análisis fiscal (T36) ·
multi-asignación (T37) · listado redesign (T39) · todos pueden usarlos.

## NO toca

- ❌ Servicios principales (compromisosRecurrentesService · treasuryBootstrapService)
- ❌ Otros stores (movements · treasuryEvents · gastosInmueble · etc)
- ❌ Componente <TipoGastoSelector />  (queda igual)
- ❌ DetectarCompromisosPage (queda igual)
- ❌ Redesign visual del listado (T39 separado)
- ❌ Eliminación de campos legacy (`tipo` · `responsable`)
- ❌ T36 (vista gastos sobre movements) · T37 (multi-asignación) · T39 (listado redesign)

## Cambios respecto al spec

[CC documenta desviaciones · si no hay · "Cero · implementación literal"]

## Verificación

- [x] tsc · 0 errores
- [x] build · pasa
- [x] DB_VERSION 68
- [x] Migración idempotente · log consola con resumen
- [x] Wizard Personal escribe tipoFamilia + categoria coherente
- [x] Wizard Inmueble idem
- [x] Listado Personal · 6 filtros · columna Tipo correcta
- [x] Listado Inmueble · 7 filtros · columna Tipo correcta
- [x] Compromisos antiguos siguen visibles · sin pérdida de datos
- [x] Tesorería · proyecciones intactas
- [x] PresupuestoPage · sin regresión

**STOP-AND-WAIT** · Jose valida en deploy preview y mergea cuando OK.

Tras merge · siguientes:
- T39 · listado redesign · ahora con datos coherentes
- T36 · vista gastos personales sobre movements (50/30/20 sobre cargos reales)
- T37 · compromisos multi-asignación (Santander · Unicaja · DIGI)
```

**NO mergear.** Esperar Jose.

---

## 9 · Si CC encuentra bloqueo

1. **Enum `tipo` no es lo asumido** → CC ajusta el mapping `FAMILIA_TO_TIPO_LEGACY_*` con valores reales · documenta
2. **Campo `categoria` tiene formato distinto al esperado** → CC adapta inferencia · documenta
3. **PresupuestoPage rompe al cambiar `categoria`** → PARAR · NO modificar `categoria` para registros que ya tenían formato coherente · solo escribir para nuevos · documentar
4. **Migración tarda demasiado en producción** → procesar en lotes · ya previsto
5. **Algún registro antiguo con datos anómalos** → CC log warn · sigue · NO bloquea

**En ningún caso CC elimina campos · cambia el enum legacy `tipo` · ni mergea sin autorización.**

---

## 10 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- DB_VERSION 67 actual · sube a 68
- T34-fix + T35-fix + T34.b + T35.b mergeados
- `docs/AUDIT-gastos-pre-T34-2026-05-03.md` · auditoría que confirmó el enum BolsaPresupuesto
- Mockup HTML referencias previas

---

## 11 · Resumen ejecutivo del spec

> Añade campo `tipoFamilia?` al store · DB_VERSION 67 → 68 · migración no destructiva que infiere familia para registros existentes desde `categoria` legacy o `tipo+subtipo`. Wizards Personal e Inmueble escriben `tipoFamilia` + `categoria` normalizada al guardar. Listados leen `tipoFamilia` para columna Tipo y filtros · 6 familias Personal · 7 familias Inmueble. Datos antiguos compatibles · NO se elimina nada · NO redesign visual. 1 PR · stop-and-wait · 8-10h CC.

---

**Fin spec T38 · 1 PR · stop-and-wait · 8-10h CC · datos coherentes para análisis posterior.**
