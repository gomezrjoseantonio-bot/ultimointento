# TAREA CC · T35 · Wizard "Nuevo gasto recurrente · inmueble" · UI funcional

> **Tipo** · feature UI · 1 PR único · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama madre `main`
> **Predecesor** · auditoría `docs/AUDIT-gastos-pre-T34-2026-05-03.md` · spec `TAREA-34-wizard-gasto-recurrente-personal.md` (ambos relacionados · pueden ir en paralelo)
> **Tiempo estimado** · 5-7h CC · 1h revisión Jose
> **DB** · NO se sube DB_VERSION · usa `compromisosRecurrentes` que YA existe
> **Riesgo** · medio · feature aditiva · NO modifica datos existentes
> **Output** · 1 PR contra `main` con UI nueva accesible desde la pestaña "Gastos" de la ficha de inmueble · escribe en `compromisosRecurrentes` con `ambito='INMUEBLE'` · invoca `regenerateForecastsForward({ force: true })` al guardar

---

## 0 · Contexto · por qué esta tarea existe

Auditoría AUDIT-gastos-pre-T34 reveló · `compromisosRecurrentes` está cableado y funcional como store · cubre tanto ámbito personal como inmueble (campo `ambito` discriminador). T34 cubre el wizard PERSONAL. T35 cubre el wizard INMUEBLE.

Hoy en producción · la pestaña "Gastos" de la ficha de inmueble es un placeholder vacío (`src/modules/inmuebles/pages/DetallePage.tsx:365`). El usuario NO puede dar de alta un gasto recurrente del inmueble desde la pantalla en blanco. Sin esta UI · el sistema no puede ejecutar el ciclo básico que un usuario con propiedades en alquiler necesita.

T35 cierra esta brecha construyendo el wizard "Nuevo gasto recurrente · inmueble" siguiendo el mockup de referencia.

**Importante** · T35 NO construye la pestaña Gastos completa de la ficha de inmueble (eso es T34.b separado). Solo construye el wizard de alta y un acceso desde la pestaña Gastos. La pestaña como tal sigue siendo placeholder o tiene mínimo botón "Nuevo gasto recurrente" + listado simple si CC lo considera oportuno.

---

## 1 · INSTRUCCIONES INVIOLABLES

### 1.1 · Scope estricto

CC trabaja **solo** en:

1. Crear página/componente `NuevoGastoRecurrenteInmueblePage.tsx` (o nombre equivalente al patrón del repo)
2. Crear formulario en 4 secciones siguiendo el mockup de referencia
3. Cablear submit que invoca `compromisosRecurrentesService` (servicio EXISTENTE · NO crear uno nuevo) con `ambito='INMUEBLE'` e `inmuebleId` del contexto
4. Tras crear · invocar `regenerateForecastsForward({ force: true })` · forzar regeneración
5. Toast de éxito · redirección a pestaña Gastos del inmueble
6. Botón de acceso al wizard desde la pestaña Gastos del inmueble · ver §4.1

NADA más.

### 1.2 · CC tiene PROHIBIDO

❌ Modificar el schema de `compromisosRecurrentes` o cualquier otro store
❌ Subir DB_VERSION
❌ Modificar `compromisosRecurrentesService.ts` salvo añadir un método si NO existe equivalente y es estrictamente necesario
❌ Modificar `treasuryBootstrapService.ts` (T31) · solo invocar `regenerateForecastsForward`
❌ Construir vistas completas de listado · edición · borrado de compromisos del inmueble (eso es T35.b · separado)
❌ Construir wizard de mejoras o muebles (eso es T35.c · separado · son altas puntuales · NO patrones recurrentes)
❌ Tocar el flujo `DetectarCompromisosPage` · queda intacto
❌ Implementar selección/carga de "catálogo típico de inmueble en alquiler" (placeholder · ver §4.6)
❌ Hacer fix del bug `ambito` mayúsculas/minúsculas (H-06 auditoría · es tarea separada)
❌ Tocar componentes legacy (`GastosRecurrentesTab.tsx` en `src/pages/GestionInmuebles/`)
❌ Modificar la lógica de `gastosInmueble` (NO se escribe nada en este store al crear el patrón · solo `compromisosRecurrentes`)

### 1.3 · Reglas técnicas duras

- TypeScript estricto · cero `any` · cero `as any`
- Tokens v5 · cero hex hardcoded · usar variables CSS del proyecto
- Lucide-react · única librería iconos · si el repo usa otra · adaptar
- Validación cliente antes de submit · no enviar datos incompletos
- Idempotencia · si el usuario pulsa Guardar 2 veces · NO crea 2 compromisos
- Si CC ve necesidad de tocar archivo fuera del scope · PARA · documenta · pregunta

### 1.4 · Stop-and-wait

CC abre PR · publica · **DETIENE** · espera revisión Jose · NO mergea hasta autorización.

### 1.5 · Doctrina de bloqueo

- Contradicción mayor → PARAR · reporte estructurado en PR
- Desviación menor → adaptar · documentar en sección "Cambios respecto al spec" del PR

---

## 2 · Etapa A · verificación previa

CC ejecuta y reporta antes de tocar código:

### A.1 · Confirmar `compromisosRecurrentesService` API · valor `ambito` real

```bash
grep -n "export" src/services/personal/compromisosRecurrentesService.ts | head -30
grep -rn "ambito.*INMUEBLE\|ambito.*inmueble" src/types/ src/services/ | head -20
```

CC reporta:

- Funciones públicas exactas
- Confirmar valor exacto del enum `ambito` para inmueble · `'INMUEBLE'` (uppercase) o `'inmueble'` (lowercase) · según schema real
- Auditoría detectó H-06 · discordancia entre stores · CC usa el valor que `compromisosRecurrentes` espera · documenta cuál es

### A.2 · Confirmar campo `inmuebleId` en `CompromisoRecurrente`

```bash
grep -n "interface CompromisoRecurrente\|type CompromisoRecurrente" src/services/db.ts src/types/*.ts
```

CC reporta:

- Tipo de `inmuebleId` · `string`, `number`, opcional, etc.
- Si el campo es obligatorio cuando `ambito='INMUEBLE'`

### A.3 · Localizar pestaña "Gastos" del inmueble

```bash
grep -rn "gastos placeholder\|Pestaña en migración" src/modules/inmuebles/ | head -10
sed -n '355,395p' src/modules/inmuebles/pages/DetallePage.tsx
```

CC reporta:

- Path exacto del componente que renderiza el placeholder
- Estructura de tabs del DetallePage (qué tabs hay · cómo se renderizan)
- Dónde colocar el botón "Nuevo gasto recurrente"

### A.4 · Confirmar que `regenerateForecastsForward` procesa compromisos de inmueble

```bash
grep -n "regenerarEventosCompromiso\|ambito" src/services/treasuryBootstrapService.ts
```

CC reporta:

- Confirmar que el bootstrap procesa todos los compromisos activos · independiente de ámbito
- Si solo procesa personales · documentar y pedir decisión a Jose (sería bug · pero es info útil)

### A.5 · Localizar lista de inmuebles del usuario · cómo obtener datos del inmueble actual

```bash
grep -rn "useInmueble\|useProperty\|getInmuebleById" src/ | head -10
```

CC reporta:

- Hook o función para obtener datos del inmueble por ID en el contexto de la ficha
- Para mostrar "FA32 · Oviedo" en el badge del header

### A.6 · Localizar lista de cuentas con saldo

Mismo que T34 · CC reutiliza el patrón ya implementado en T34 si está en producción. Si T34 aún no mergeada · CC localiza el hook independientemente.

### A.7 · Sistema de toast del repo

Mismo que T34 · CC reutiliza el patrón.

---

## 3 · Etapa B · estructura archivos

### B.1 · Archivos a crear

```
src/modules/inmuebles/wizards/NuevoGastoRecurrenteInmueblePage.tsx       (componente principal)
src/modules/inmuebles/wizards/NuevoGastoRecurrenteInmueblePage.module.css (estilos · si el repo usa CSS modules)
src/modules/inmuebles/wizards/components/                                  (sub-componentes)
  - SeccionTipoGastoInmueble.tsx
  - SeccionCalendario.tsx       (puede reutilizar el de T34 si está mergeada · valorar componente compartido)
  - SeccionImporte.tsx          (idem · candidato a compartir)
  - SeccionCuentaInmueble.tsx   (sin bolsa · solo cuenta)
  - ResumenLateralInmueble.tsx  (con línea Inmueble · sin línea Bolsa)
  - PropertyBadge.tsx           (badge inmueble del header)
src/modules/inmuebles/wizards/utils/
  - tiposDeGastoInmueble.ts     (lista cerrada · ver §4.2)
  - patronesCalendarioInmueble.ts (mapping a soportados)
```

CC adapta paths/estructura al patrón del repo.

**Componentes compartibles con T34:**

Si T34 ya está mergeada · CC valora extraer `SeccionCalendario` y `SeccionImporte` a `src/modules/shared/wizards/` para reutilizar. Si T34 NO está mergeada · CC duplica componentes y los unifica en T35.bis cuando ambos existan. Decisión técnica de CC · documentar en PR.

### B.2 · Archivos a modificar

```
src/modules/inmuebles/pages/DetallePage.tsx       (pestaña "Gastos" · añade botón "Nuevo gasto recurrente" · ver §4.1)
[archivo de routing del módulo Inmuebles]         (añade ruta /inmuebles/:id/gastos/nuevo)
```

CC localiza paths exactos en A.3.

### B.3 · Archivos que NO se tocan

❌ `src/services/personal/compromisosRecurrentesService.ts` (solo invocar)
❌ `src/services/treasuryBootstrapService.ts` (solo invocar)
❌ `src/services/db.ts` · DB_VERSION intacto
❌ Tipos
❌ `gastosInmuebleService.ts` (NO se rellena al crear el patrón)
❌ `mejorasInmuebleService.ts` (T35.c separado)
❌ `mueblesInmuebleService.ts` (T35.c separado)
❌ `DetectarCompromisosPage.tsx`
❌ `GastosRecurrentesTab.tsx` legacy

---

## 4 · Etapa C · UI y comportamiento

### 4.1 · Acceso al wizard

**Desde la pestaña "Gastos" de la ficha de inmueble**:

- Si la pestaña sigue siendo placeholder · CC añade un layout mínimo con header tipo "Gastos del inmueble · próximamente vista completa" + botón **"+ Nuevo gasto recurrente"**
- Al pulsarlo · navega a `/inmuebles/:id/gastos/nuevo` (path adaptado al routing del repo)
- Importante · NO construir la vista completa de gastos (T34.b separado) · solo botón funcional

### 4.2 · Sección 1 · Qué gasto es

**Campos:**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Tipo de gasto | select plano · 7 opciones | sí | Sin optgroups |
| Subtipo | select · cambia según Tipo | sí (si Tipo lo tiene) | Algunos Tipos no tienen subtipo |
| Proveedor | input texto | NO · opcional | Pill "opcional · ayuda al matching" |
| CIF / NIF | input texto | NO · opcional | Pill "opcional" |
| Referencia / contrato | input texto | NO · opcional | Helper "Si tu factura tiene un nº de cuenta o contrato · ATLAS lo usará para conciliar mejor" |

**Tipos de gasto · 7 tipos · sin optgroup:**

```typescript
// utils/tiposDeGastoInmueble.ts
export const TIPOS_GASTO_INMUEBLE = [
  { id: 'ibi',              label: 'IBI',                             subtipos: null },
  { id: 'comunidad',        label: 'Comunidad',                       subtipos: null },
  { id: 'seguro_inmueble',  label: 'Seguro inmueble',                 subtipos: ['Hogar', 'Impago', 'Otros'] },
  { id: 'suministro',       label: 'Suministro',                      subtipos: ['Luz', 'Gas', 'Agua', 'Internet', 'Otros'] },
  { id: 'gestion',          label: 'Gestión',                         subtipos: ['Honorarios agencia', 'Gestoría', 'Asesoría', 'Otros'] },
  { id: 'reparacion',       label: 'Reparación y conservación',       subtipos: ['Mantenimiento caldera', 'Mantenimiento integral', 'Limpieza', 'Otros'] },
  { id: 'otros',            label: 'Otros operativos',                subtipos: null },
];
```

**IMPORTANTE** · NO incluye Hipoteca · Vivienda · Mejoras · Muebles · Suscripciones · Cuotas. Lista cerrada · solo gastos OPERATIVOS RECURRENTES del inmueble en alquiler.

**IMPORTANTE** · NO hay campo Ámbito visible · siempre = `'INMUEBLE'` (valor real verificado en A.1).

**IMPORTANTE** · NO hay campo Inmueble visible · siempre = `inmuebleId` del contexto (de la ficha donde se accedió al wizard).

### 4.3 · Sección 2 · Cuándo se cobra

**Campos · IDÉNTICOS a T34** (componente reutilizable si T34 mergeada):

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Patrón de calendario | select | sí · default "Mensual día fijo" | Solo patrones soportados por `expandirPatron` |
| Día del mes | input numérico 1-31 | sí (si patrón lo requiere) | |
| Mes inicio | select · default "este mes" | sí | Listado de meses |
| Mes fin | select · default "— Indefinido —" | NO · opcional | Listado de meses futuros |

**Patrones a ofrecer** (si CC en A.4 detecta más patrones · documentar):

- Mensual · día fijo
- Mensual · día relativo · último/primer hábil
- Cada 2 meses · bimestral con anclaje
- Cada 3 meses · trimestral con anclaje
- Anual · 1 pago en mes concreto
- Anual · 2 pagos en meses concretos (típico IBI · ej. junio + nov)

**Subform "Mensual día fijo"** (3 campos en una fila · alineados):

- Día del mes
- Mes inicio
- Mes fin

CC implementa los subforms del resto de patrones siguiendo el mismo patrón visual.

### 4.4 · Sección 3 · Cuánto se cobra

**Campos · IDÉNTICOS a T34** (componente reutilizable si T34 mergeada):

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Modo de importe | select · 3 opciones | sí · default "Fijo" | |
| (Subform según modo) | varios | depende | |

**3 modos:**

- **Fijo** · 1 input numérico
- **Variable medio** · 1 input numérico + helper
- **Estacional** · grid 6×2 (12 inputs) · resumen automático Total/Media/Pico/Valle

### 4.5 · Sección 4 · Dónde se carga · SIN BOLSA

**Diferencia clave con T34** · esta sección es más simple. NO hay sección de Bolsa 50/30/20 porque el gasto de inmueble NO entra en presupuesto personal.

**Campos:**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Cuenta de cargo | select | sí | Lista de cuentas con saldo |

Helper · "Cuenta desde la que se domiciliará el cargo · usa preferentemente la cuenta del inmueble"

**NO hay campo de bolsa.** NO hay pills 50/30/20. Sección 4 = solo cuenta.

### 4.6 · Catálogo típico (placeholder · NO funcional en T35)

Banner punteado dorado al inicio del formulario · texto adaptado a inmueble:

> "¿Quieres ir más rápido? Carga el **catálogo típico de un inmueble en alquiler** (IBI · comunidad · seguro · suministros) y edita solo los que tengas. **Cargar catálogo →**"

Al pulsar el link · toast "Próximamente · catálogo de inmueble". La carga real es T35.bis (separado).

### 4.7 · Header de la página · con badge del inmueble

**Layout del header:**

- Breadcrumb · "Inmuebles › [Nombre del inmueble] › Gastos › Nuevo gasto recurrente"
- Título grande "Nuevo gasto recurrente"
- Subtítulo "Configura un patrón de gasto del inmueble · ATLAS proyectará los próximos 24 meses en Tesorería automáticamente"
- A la derecha del título · **PropertyBadge** · card pequeña con · foto del inmueble (si existe) · tag "Inmueble · [AST-ID]" · nombre del inmueble · dirección truncada
- Si el inmueble no tiene foto · placeholder gris

**El PropertyBadge sirve como confirmación visual constante** de en qué inmueble se está creando el patrón. Es informativo · NO interactivo · NO permite cambiar de inmueble.

### 4.8 · Resumen lateral · sticky

Aside de 280px · sticky · 6 líneas:

- **Inmueble** · ej "FA32 · Oviedo" · NUEVO vs T34 · primera línea
- Tipo · ej "Suministro · luz"
- Proveedor
- Calendario · ej "Mensual · día 6"
- Modo importe
- Cuenta · ej "Unicaja ···· 4437"

**Sin línea de Bolsa.** A diferencia de T34.

Bloque KPI grande al final:

- Label · "Coste anual previsto"
- Valor mono grande · ej "−593 €"
- Subtítulo · "media 49 € / mes · 12 cargos"

### 4.9 · Footer · acciones

**Helper a la izquierda** · "Al guardar · ATLAS proyectará 24 cargos previstos en Tesorería"

**Botones a la derecha:**

- "Cancelar" · ghost · vuelve a la pestaña Gastos del inmueble
- "Guardar y proyectar" · botón dorado primario

### 4.10 · Submit · comportamiento exacto

1. Validación cliente
   - Tipo · obligatorio
   - Subtipo · obligatorio si Tipo lo tiene
   - Patrón calendario · obligatorio
   - Día del mes · obligatorio si patrón lo requiere
   - Mes inicio · obligatorio (default = mes en curso)
   - Modo importe · obligatorio
   - Importe(s) · obligatorio según modo · valores numéricos > 0
   - Cuenta · obligatoria
2. Si validación falla · mostrar campo en error · NO submit
3. Construir objeto `CompromisoRecurrente` con:
   - `ambito` = valor real para inmueble (de A.1 · ej. `'INMUEBLE'`)
   - `inmuebleId` = ID del inmueble del contexto
   - resto de campos según schema real
4. Idempotencia · disabled del botón mientras submit en curso
5. Invocar `compromisosRecurrentesService` con método existente · `db.put()` directo si no hay método específico
6. Tras éxito · invocar `regenerateForecastsForward({ force: true })` · esperar resultado
7. Toast éxito · "Gasto recurrente del inmueble creado · X cargos proyectados en Tesorería"
8. Redirigir a `/inmuebles/:id` (ficha del inmueble · pestaña Gastos)
9. Si error · toast error · log consola · NO redirigir

### 4.11 · Estilos · referencia obligatoria

CC sigue el mockup `atlas-inmueble-wizard-gasto-recurrente-v1.html` literalmente. Adapta a tokens del proyecto.

**Reglas duras de estilo:**

- Card principal · `border-top: 4px solid var(--gold)` · sombra sutil
- Números de sección · círculo dorado con fondo `var(--gold-wash)` y texto `var(--gold-ink)`
- Botón principal · dorado
- Subforms de patrón · fondo `var(--gold-wash-2)` con borde `var(--gold-wash)`
- PropertyBadge en el header · `border-top: 3px solid var(--gold)` · sombra sutil
- NO usar rojo salvo en estados de error explícito (validación)
- NO incluir sección de bolsa 50/30/20

---

## 5 · Etapa D · verificación

### Build
- [ ] `tsc --noEmit` · 0 errores nuevos
- [ ] `npm run build` · pasa
- [ ] `npm test` · pasa

### Funcional · alta
- [ ] Botón "Nuevo gasto recurrente" visible en pestaña Gastos del inmueble
- [ ] Click navega al wizard · URL incluye `inmuebleId`
- [ ] PropertyBadge muestra datos del inmueble correctos
- [ ] Breadcrumb refleja el inmueble correcto
- [ ] 4 secciones renderizadas
- [ ] Validación cliente bloquea submit con campos obligatorios vacíos
- [ ] Resumen lateral se actualiza en vivo
- [ ] KPI "coste anual previsto" calcula correctamente para los 3 modos

### Funcional · persistencia
- [ ] Al guardar · `compromisosRecurrentes` recibe nuevo registro
- [ ] `ambito` = valor correcto para inmueble (verificado en A.1)
- [ ] `inmuebleId` = ID correcto del contexto
- [ ] Resto de campos correctos según schema real
- [ ] Idempotencia · doble click NO crea 2 registros

### Funcional · regeneración Tesorería
- [ ] Tras crear · `regenerateForecastsForward({ force: true })` se invoca
- [ ] Tesorería muestra cargos previstos del nuevo compromiso
- [ ] Calendario rolling 24m incluye los nuevos cargos
- [ ] Cargos vinculados al inmueble correcto

### Funcional · UI
- [ ] 7 tipos en select (sin optgroup)
- [ ] Subtipos cambian dinámicamente según Tipo elegido
- [ ] Reparación y conservación · 4 subtipos · Mantenimiento caldera · Integral · Limpieza · Otros
- [ ] IBI · Comunidad · Otros operativos · sin subtipo (campo subtipo oculto o disabled)
- [ ] NO hay sección de bolsa 50/30/20
- [ ] PropertyBadge presente en header
- [ ] Resumen lateral · primera línea = "Inmueble"
- [ ] Resumen lateral · NO tiene línea de bolsa
- [ ] Toast éxito tras guardar
- [ ] Redirige a ficha del inmueble · pestaña Gastos

### Funcional · catálogo placeholder
- [ ] Banner dorado visible
- [ ] Click en "Cargar catálogo" muestra toast "Próximamente · catálogo de inmueble"
- [ ] NO ejecuta carga real

### Tipado
- [ ] Cero `any` · cero `as any` nuevos
- [ ] Tipo `FormStateInmueble` exportado y completo
- [ ] Validación tipada

### CSS / tokens
- [ ] Cero hex hardcoded
- [ ] Tokens v5 respetados

### Reglas de scope
- [ ] CERO modificación de `compromisosRecurrentesService.ts`
- [ ] CERO modificación de `treasuryBootstrapService.ts`
- [ ] CERO cambios DB
- [ ] CERO cambios tipos
- [ ] CERO modificación de `gastosInmuebleService` · `mejorasInmuebleService` · `mueblesInmuebleService`
- [ ] CERO modificación de `DetectarCompromisosPage.tsx`
- [ ] CERO construcción de vista completa de gastos del inmueble (solo botón mínimo)
- [ ] DB_VERSION intacto

---

## 6 · PR

**Rama** · `claude/t35-wizard-gasto-recurrente-inmueble`

**Título PR** · `feat(inmuebles): T35 wizard "Nuevo gasto recurrente · inmueble" + acceso desde ficha`

**Body PR**:

```
## Resumen

Auditoría AUDIT-gastos-pre-T34 reveló · `compromisosRecurrentes` cableado y
funcional · cubre tanto ámbito personal como inmueble (campo `ambito`
discriminador). T34 cubre el wizard PERSONAL. T35 cubre el wizard INMUEBLE.

Hoy en producción · la pestaña "Gastos" de la ficha de inmueble es un
placeholder vacío. T35 añade el wizard de alta de patrón de gasto recurrente
del inmueble accesible desde dicha pestaña.

## Cambios

### Archivos nuevos
- ✨ `NuevoGastoRecurrenteInmueblePage.tsx` · wizard 4 secciones
- ✨ Sub-componentes · SeccionTipoGastoInmueble · SeccionCalendario · SeccionImporte · SeccionCuentaInmueble · ResumenLateralInmueble · PropertyBadge
- ✨ Utils · tiposDeGastoInmueble · patronesCalendarioInmueble
- ✨ Estilos · CSS modules siguiendo tokens v5 + énfasis oro

### Modificados
- ✏️ `DetallePage.tsx` · pestaña Gastos · añade botón "+ Nuevo gasto recurrente"
- ✏️ Routing Inmuebles · añade ruta `/inmuebles/:id/gastos/nuevo`

### Componentes compartibles con T34
[CC documenta · si compartió SeccionCalendario y SeccionImporte con T34
en src/modules/shared/wizards/ · o duplicó · razón técnica]

## Comportamiento

### Flujo creación
1. Usuario en ficha inmueble > Gastos pulsa "+ Nuevo gasto recurrente"
2. Wizard 4 secciones · Tipo + Calendario + Importe + Cuenta (sin bolsa)
3. PropertyBadge en header confirma inmueble del contexto
4. Resumen lateral sticky · primera línea = Inmueble · sin línea bolsa
5. Submit · valida · escribe `compromisosRecurrentes` con ambito='INMUEBLE' e inmuebleId
6. Invoca regenerateForecastsForward · toast éxito · redirige a ficha inmueble

### Tipos soportados (7 tipos · sin optgroup)
- IBI · Comunidad · Seguro inmueble
- Suministro · Gestión
- Reparación y conservación (con subtipos · Mantenimiento caldera · Integral · Limpieza · Otros)
- Otros operativos
- Hipoteca NO incluida (vive en Financiación · ATLAS auto-genera intereses al confirmar cuota)
- Mejoras · Muebles · NO incluidos (entradas puntuales · NO recurrentes · T35.c separado)

### Diferencias clave con T34 (Personal)
- Header con PropertyBadge del inmueble del contexto
- Sin sección 50/30/20 · gasto inmueble NO entra en presupuesto personal
- Tipos distintos · operativos del alquiler
- Sin campo Ámbito visible · siempre INMUEBLE
- Sin campo Inmueble visible · viene del contexto

### Catálogo típico
- Placeholder en T35 · al pulsar muestra toast "Próximamente"
- Carga real es T35.bis (separado)

## NO toca

- ❌ Schema · DB_VERSION intacto
- ❌ `compromisosRecurrentesService.ts` (solo invocar)
- ❌ `treasuryBootstrapService.ts` (solo invocar)
- ❌ Tipos
- ❌ `gastosInmuebleService` · `mejorasInmuebleService` · `mueblesInmuebleService`
- ❌ DetectarCompromisosPage
- ❌ GastosRecurrentesTab.tsx legacy
- ❌ Vista completa de la pestaña Gastos del inmueble (T34.b separado)
- ❌ Wizard de mejoras / muebles (T35.c separado · son altas puntuales)
- ❌ Carga real catálogo típico (T35.bis separado)

## Cambios respecto al spec

(CC documenta desviaciones · si no hay · "Cero · implementación literal")

## Verificación

- [x] tsc --noEmit · 0 errores
- [x] npm run build · pasa
- [x] Wizard accesible desde pestaña Gastos del inmueble
- [x] PropertyBadge muestra inmueble del contexto correcto
- [x] Validación cliente bloquea campos obligatorios
- [x] Submit crea registro `compromisosRecurrentes` con ambito INMUEBLE e inmuebleId correcto
- [x] regenerateForecastsForward invocado · cargos visibles en Tesorería del inmueble
- [x] 7 tipos en select sin optgroup
- [x] Subtipos cambian dinámicamente
- [x] Reparación y conservación con 4 subtipos
- [x] Idempotencia submit
- [x] Toast éxito + redirección a ficha inmueble
- [x] Catálogo placeholder con toast "Próximamente"
- [x] Tokens v5 respetados · cero hex hardcoded
- [x] DB_VERSION intacto
- [x] CERO sección 50/30/20 en el formulario

**STOP-AND-WAIT** · Jose valida en deploy preview y mergea cuando OK.

Tras merge · siguientes:
- T34.b · vista completa pestaña Gastos del inmueble (listado + edición + borrado de compromisos)
- T35.bis · carga catálogo típico de inmueble en alquiler
- T35.c · wizards de mejora puntual y mueble puntual
- T36 · vista de gastos personales sobre movements categorizados (requiere schema task previa)
```

**NO mergear.** Esperar Jose.

---

## 7 · Si CC encuentra bloqueo

1. **Valor exacto del enum `ambito` para inmueble no claro** → usar el que detecte en A.1 · documentar
2. **Schema `CompromisoRecurrente` distinto al asumido** → adaptar formulario al schema real · documentar
3. **Pestaña Gastos del DetallePage no localizada o estructura distinta** → PARAR · preguntar a Jose
4. **`regenerateForecastsForward` no procesa compromisos de inmueble** → log warn · NO bloquear creación · documentar como hallazgo
5. **Algún patrón del select NO está soportado por `expandirPatron`** → quitar del select · documentar
6. **Inmueble no se obtiene del contexto correctamente** → usar fallback · select de inmuebles si no hay contexto · documentar
7. **Mockup HTML no llega a CC** → CC pide a Jose el path del mockup · NO improvisar diseño
8. **T34 ya mergeada · componentes compartibles** → extraer a `src/modules/shared/wizards/` · documentar
9. **T34 NO mergeada todavía** → duplicar componentes · documentar como deuda técnica T35.bis

**En ningún caso CC modifica schema · servicios o stores · NO implementa funcionalidades fuera de scope · NO mergea sin autorización.**

---

## 8 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- DB_VERSION 67 · estable
- `docs/MODELO-4-PAGINAS-atlas.md` · ancla conceptual
- `docs/AUDIT-gastos-pre-T34-2026-05-03.md` · auditoría
- `docs/AUDIT-treasury-generators-2026-05-02.md` · diagnóstico generadores
- `TAREA-34-wizard-gasto-recurrente-personal.md` · spec hermana de T34
- Mockup HTML · `atlas-inmueble-wizard-gasto-recurrente-v1.html` (Jose lo facilita en outputs)

---

## 9 · Resumen ejecutivo del spec

> Construye página `NuevoGastoRecurrenteInmueblePage.tsx` siguiendo mockup HTML. 4 secciones · Tipo + Calendario + Importe + Cuenta (SIN bolsa 50/30/20). 7 tipos sin optgroup. Sin Hipoteca · sin Mejoras · sin Muebles. PropertyBadge en header con datos del inmueble. Resumen lateral con línea Inmueble. Submit · `compromisosRecurrentes` con ambito='INMUEBLE' e inmuebleId del contexto · invoca regenerateForecastsForward · toast · redirige. NO toca schema · NO toca servicios · NO modifica DB · NO construye vista completa de pestaña Gastos. 1 PR · stop-and-wait · 5-7h CC.

---

**Fin spec T35 · 1 PR · stop-and-wait · 5-7h CC · UI funcional sobre stores existentes.**
