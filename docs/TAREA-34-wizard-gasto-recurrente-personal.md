# TAREA CC · T34 · Wizard "Nuevo gasto recurrente personal" · UI funcional

> **Tipo** · feature UI · 1 PR único · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama madre `main`
> **Predecesor** · auditoría `docs/AUDIT-gastos-pre-T34-2026-05-03.md` mergeada
> **Tiempo estimado** · 6-8h CC · 1h revisión Jose
> **DB** · NO se sube DB_VERSION · usa `compromisosRecurrentes` que YA existe
> **Riesgo** · medio · feature aditiva · NO modifica datos existentes
> **Output** · 1 PR contra `main` con UI nueva accesible desde Personal · escribe en `compromisosRecurrentes` · invoca `regenerateForecastsForward({ force: true })` al guardar

---

## 0 · Contexto · por qué esta tarea existe

Auditoría AUDIT-gastos-pre-T34 reveló · `compromisosRecurrentes` está cableado y funcional como store · `compromisosRecurrentesService.regenerarEventosCompromiso()` proyecta eventos en Tesorería correctamente · `regenerateForecastsForward` (T31) ya invoca al servicio. **Lo único que falta es la UI manual** para crear compromisos desde cero.

Hoy en producción · el único flujo UI es `DetectarCompromisosPage` (detección automática desde movimientos históricos). El usuario NO puede dar de alta un gasto recurrente desde una pantalla en blanco. Sin esta UI · el sistema no puede ejecutar el ciclo básico que un usuario nuevo necesita.

T34 cierra esta brecha · construyendo el wizard "Nuevo gasto recurrente personal" siguiendo el mockup de referencia.

---

## 1 · INSTRUCCIONES INVIOLABLES

### 1.1 · Scope estricto

CC trabaja **solo** en:

1. Crear página/componente `NuevoGastoRecurrentePage.tsx` (o nombre equivalente al patrón del repo)
2. Crear formulario en 4 secciones siguiendo el mockup de referencia
3. Cablear submit que invoca `compromisosRecurrentesService.crearCompromiso()` (o equivalente · usar el servicio existente · NO crear uno nuevo)
4. Tras crear · invocar `regenerateForecastsForward({ force: true })` · forzar regeneración de eventos
5. Toast de éxito · redirección a página listado de compromisos
6. Botón de acceso al wizard desde donde corresponda en Personal · ver §4.1

NADA más.

### 1.2 · CC tiene PROHIBIDO

❌ Modificar el schema de `compromisosRecurrentes` o cualquier otro store
❌ Subir DB_VERSION
❌ Modificar `compromisosRecurrentesService.ts` salvo añadir un método si es estrictamente necesario y NO existe equivalente
❌ Modificar `treasuryBootstrapService.ts` (T31) · solo invocar `regenerateForecastsForward`
❌ Construir vistas de listado · edición · borrado de compromisos (eso es T34.b · separado)
❌ Construir wizard de gastos de inmueble (eso es T35 · separado)
❌ Construir vista de gastos personales (movimientos categorizados) (eso es T36 · separado)
❌ Tocar el flujo `DetectarCompromisosPage` · queda intacto · es complementario
❌ Implementar selección/carga de "catálogo típico de hogar" (queda como botón placeholder · ver §4.6)
❌ Hacer fix del bug `ambito` mayúsculas/minúsculas (H-06 auditoría · es tarea separada)
❌ Cambiar valores del enum `BolsaPresupuesto` (alinear nombres es schema task aparte)
❌ Tocar componentes de gastos legacy (`GastosRecurrentesTab.tsx`)

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

### A.1 · Confirmar `compromisosRecurrentesService` API

```bash
grep -n "export" src/services/personal/compromisosRecurrentesService.ts | head -30
grep -n "interface CompromisoRecurrente\|type CompromisoRecurrente" src/services/db.ts src/types/*.ts
```

CC reporta:

- Funciones públicas exactas · firmas · return types
- Schema completo del tipo `CompromisoRecurrente` con todos sus campos
- Confirmar que `regenerarEventosCompromiso(c)` es invocable por compromiso individual

### A.2 · Confirmar `compromisoCreationService` (mencionado en auditoría)

```bash
find src -name "compromisoCreationService*" 2>/dev/null
grep -rn "compromisoCreationService" src/ | head -10
```

CC reporta:

- Si el servicio existe · API expuesta
- Si NO existe · documentar que se usará directamente `compromisosRecurrentesService` con `db.put()`

### A.3 · Confirmar enum `BolsaPresupuesto` valores reales

```bash
grep -rn "BolsaPresupuesto\|bolsaPresupuesto" src/types/ src/services/ | head -20
```

CC reporta:

- Valores exactos del enum · `'necesidades' | 'deseos' | 'ahorroInversion' | 'obligaciones' | 'inmueble'` o lo que sea
- Cómo se usa en `PresupuestoPage` · referencia para cómo el wizard debe escribir el campo

### A.4 · Confirmar tipos de patrón de calendario soportados

```bash
grep -n "expandirPatron\|TipoPatron\|patronCalendario" src/services/personal/compromisosRecurrentesService.ts src/types/*.ts | head -20
```

CC reporta:

- Lista exacta de patrones soportados por `expandirPatron`
- Si el wizard tiene que limitarse a los soportados o cubrir más

### A.5 · Localizar página/sección Personal donde añadir entrada

```bash
find src -path "*personal*" -name "*.tsx" | xargs grep -l "tab\|Tab\|gastos\|compromiso" 2>/dev/null | head -10
```

CC reporta:

- Path del componente raíz Personal
- Path de pestaña Gastos si existe · o lugar equivalente
- Dónde colocar el botón "Nuevo gasto recurrente"

### A.6 · Localizar `regenerateForecastsForward`

Confirmar firma · debe estar en `src/services/treasuryBootstrapService.ts` tras T31.

### A.7 · Toast / sistema de notificaciones del repo

Identificar el sistema de toasts usado · `react-hot-toast` · `sonner` · `react-toastify` · custom · etc · y usar el patrón existente.

---

## 3 · Etapa B · estructura archivos

### B.1 · Archivos a crear

```
src/modules/personal/wizards/NuevoGastoRecurrentePage.tsx       (componente principal)
src/modules/personal/wizards/NuevoGastoRecurrentePage.module.css (estilos · si el repo usa CSS modules)
src/modules/personal/wizards/components/                         (sub-componentes)
  - SeccionTipoGasto.tsx
  - SeccionCalendario.tsx
  - SeccionImporte.tsx
  - SeccionCuentaBolsa.tsx
  - ResumenLateral.tsx
src/modules/personal/wizards/utils/
  - tiposDeGasto.ts        (lista cerrada · ver §4.2)
  - patronesCalendario.ts  (mapping a los soportados por el servicio)
  - inferirBolsa.ts        (mapping Tipo → bolsa · ver §4.7)
```

CC adapta paths/estructura al patrón del repo.

### B.2 · Archivos a modificar

```
[archivo de routing del módulo Personal] · añadir ruta /personal/gastos/nuevo
[componente Personal Gastos · pestaña] · añadir botón "Nuevo gasto recurrente"
```

CC localiza paths exactos en A.5.

### B.3 · Archivos que NO se tocan

❌ `src/services/personal/compromisosRecurrentesService.ts` (solo invocar)
❌ `src/services/treasuryBootstrapService.ts` (solo invocar `regenerateForecastsForward`)
❌ `src/services/db.ts` · DB_VERSION intacto
❌ Tipos
❌ `DetectarCompromisosPage.tsx` (queda igual · es complementario)

---

## 4 · Etapa C · UI y comportamiento

### 4.1 · Acceso al wizard

Botón "Nuevo gasto recurrente" visible en pestaña Personal > Gastos (o path equivalente). Al pulsarlo · navega a `/personal/gastos/nuevo` (o path adaptado al repo).

### 4.2 · Sección 1 · Qué gasto es

**Campos:**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Tipo de gasto | select agrupado por optgroup | sí | Lista cerrada · ver más abajo |
| Subtipo | select | sí (si Tipo lo tiene) | Cambia según Tipo |
| Proveedor | input texto | NO · opcional | Pill "opcional · ayuda al matching" |
| CIF / NIF | input texto | NO · opcional | Pill "opcional" |
| Referencia / contrato | input texto | NO · opcional | Pill "opcional" · helper "Si tu factura tiene un nº de cuenta o contrato · ATLAS lo usará para conciliar mejor" |

**Tipos de gasto · 10 tipos en 3 optgroups:**

```
Vivienda:
  - Alquiler vivienda          (sin subtipo · único)
  - IBI                         (sin subtipo · único)
  - Comunidad                   (sin subtipo · único)
  - Seguro hogar                (sin subtipo · único)

Gastos del día a día:
  - Suministro                  (subtipos: Luz · Gas · Agua · Internet · Móvil · Otros)
  - Suscripción digital         (subtipos: Streaming · Prensa · Software · Música · Cloud · Otros)

Otros:
  - Seguro                      (subtipos: Salud · Coche · Vida · Inquilino · Mascotas · Otros)
  - Cuota / membresía           (subtipos: Gimnasio · Colegio · Universidad · Profesional · ONG · Otros)
  - Impuesto / tasa             (subtipos: Tasas municipales · Multas · Otros)
  - Otros pagos recurrentes     (sin subtipo · único · campo libre en alias)
```

**IMPORTANTE** · Hipoteca NO está en esta lista · vive en módulo Financiación.

**IMPORTANTE** · NO hay campo Ámbito visible · siempre = `'PERSONAL'` (uppercase · según schema real `movements`/`compromisosRecurrentes`). CC verifica el valor exacto en A.3.

**IMPORTANTE** · NO hay campo Inmueble · porque ámbito es Personal. T35 cubrirá Inmueble (separado).

### 4.3 · Sección 2 · Cuándo se cobra

**Campos:**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Patrón de calendario | select | sí · default "Mensual día fijo" | Solo patrones soportados por `expandirPatron` |
| (Subform que cambia según patrón) | varios | depende | Ver más abajo |

**Patrones a ofrecer en el select** (si CC en A.4 detecta más patrones soportados · documentar y pedir decisión):

- Mensual · día fijo · ej. cada día 6
- Mensual · día relativo · último hábil · primer hábil
- Cada 2 meses · bimestral con anclaje
- Cada 3 meses · trimestral con anclaje
- Anual · 1 pago en mes concreto
- Anual · 2 pagos en meses concretos · ej. IBI junio + nov

**Subform "Mensual día fijo"** (3 campos en una fila):

- Día del mes · input numérico 1-31 · obligatorio
- Mes inicio · select · default "Mayo 2026 · este mes" · listado de últimos 12 meses + próximos 12
- Mes fin · select · default "— Indefinido —" · listado de meses futuros

**Subform "Cada 2 meses · bimestral con anclaje"**:

- Día del mes · obligatorio
- Mes ancla · obligatorio · ej. Febrero → cargos feb/abr/jun/ago/oct/dic
- Mes fin · opcional

**Subform "Anual · 2 pagos"**:

- Día del mes · obligatorio
- Mes 1 · obligatorio
- Mes 2 · obligatorio
- Repartir igual o personalizado · select

CC implementa el resto siguiendo el mismo patrón. Mockup muestra "Mensual día fijo" como ejemplo · CC implementa los demás según `expandirPatron` admita.

### 4.4 · Sección 3 · Cuánto se cobra

**Campos:**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Modo de importe | select | sí · default "Fijo" | 3 opciones |
| (Subform según modo) | varios | depende | |

**3 modos:**

- **Fijo** · subform = 1 input numérico "Importe €/cargo"
- **Variable medio** · subform = 1 input numérico "Importe medio €/cargo" + helper "ATLAS reflejará este importe en cada proyección · al confirmar el cargo real podrás ajustar"
- **Estacional** · subform = grid 6×2 (12 inputs · ENE-DIC) · debajo resumen automático "Total anual · Media · Pico · Valle"

**Resumen estacional · cálculos:**

- Total anual · suma de los 12
- Media · total / 12
- Pico · max + nombre del mes
- Valle · min + nombre del mes

### 4.5 · Sección 4 · Dónde se carga y en qué bolsa

**Campos:**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| Cuenta de cargo | select | sí | Lista de cuentas de `accounts` con saldo · "Sabadell · ···· 9635 · 2.156 €" |
| Bolsa de presupuesto · 50/30/20 | pills 3 opciones | sí · pre-seleccionada | Necesidades · Deseos · Ahorro |

**Bolsa pre-seleccionada según Tipo** · función `inferirBolsa(tipo, subtipo)`:

| Tipo de gasto | Bolsa por defecto |
|---|---|
| Alquiler vivienda · IBI · Comunidad · Seguro hogar | Necesidades |
| Suministro (todos) | Necesidades |
| Seguro · Salud | Necesidades |
| Seguro · Coche · Vida · Inquilino · Mascotas | Necesidades |
| Cuota · Colegio · Universidad · Profesional | Necesidades |
| Cuota · Gimnasio · ONG | Deseos |
| Suscripción digital (todos) | Deseos |
| Impuesto / tasa | Necesidades |
| Otros pagos recurrentes | (sin pre-selección · usuario decide) |

**Nombre exacto del enum** · CC usa los valores reales del enum `BolsaPresupuesto` localizados en A.3 · NO los nombres del modelo canónico mío. Si los valores son `'necesidades' | 'deseos' | 'ahorroInversion'` · esos son los que se guardan.

### 4.6 · Catálogo típico (placeholder · NO funcional en T34)

En la cabecera del formulario · banner punteado dorado · "¿Quieres ir más rápido? Cargar catálogo típico de un hogar" + link "Cargar catálogo →".

**En T34 · este link es PLACEHOLDER**. Al pulsar · muestra toast "Próximamente · catálogo de hogar". La carga real del catálogo es T34.c (separado).

### 4.7 · Resumen lateral · sticky

Aside de 280px · sticky · siempre visible · se actualiza en vivo según el usuario rellena el formulario. 6 líneas:

- Tipo · ej "Suministro · luz"
- Proveedor · ej "Iberdrola"
- Calendario · ej "Mensual · día 6"
- Modo importe · ej "Estacional"
- Cuenta · ej "Sabadell ···· 9635"
- Bolsa · con color semántico ej "Necesidades" en navy

Bloque KPI grande al final:

- Label · "Coste anual previsto"
- Valor mono grande · ej "−1.176 €" · color neg
- Subtítulo · "media 98 € / mes · 12 cargos"

**Cálculo del coste anual previsto:**
- Modo Fijo · importe × número de cargos al año (según patrón)
- Modo Variable medio · importe medio × número de cargos
- Modo Estacional · suma de los 12 valores

### 4.8 · Footer · acciones

**Helper a la izquierda** · icono info dorado + texto "Al guardar · ATLAS proyectará 24 cargos previstos en Tesorería"

**Botones a la derecha:**

- "Cancelar" · ghost · vuelve a Personal > Gastos
- "Guardar y proyectar" · botón dorado primario · ejecuta el submit

### 4.9 · Submit · comportamiento exacto

1. Validación cliente
   - Tipo · obligatorio
   - Subtipo · obligatorio si Tipo lo tiene
   - Patrón calendario · obligatorio
   - Día del mes · obligatorio
   - Mes inicio · obligatorio (default = mes en curso)
   - Modo importe · obligatorio
   - Importe(s) · obligatorio según modo · valores numéricos > 0
   - Cuenta · obligatoria
   - Bolsa · obligatoria
2. Si validación falla · mostrar campo en error · NO submit
3. Construir objeto `CompromisoRecurrente` según schema real del store
4. Idempotencia · disabled del botón mientras submit en curso · evitar doble click
5. Invocar `compromisosRecurrentesService.crearCompromiso(c)` o equivalente · `db.put()` directo si no hay método
6. Tras éxito · invocar `regenerateForecastsForward({ force: true })` · esperar resultado
7. Toast éxito · "Gasto recurrente creado · X cargos proyectados en Tesorería"
8. Redirigir a Personal > Gastos
9. Si error en cualquier paso · toast error · log consola · NO redirigir

### 4.10 · Estilos · referencia obligatoria

CC sigue el mockup `atlas-personal-wizard-gasto-recurrente-v1.html` (incluido en outputs de la sesión) literalmente. Adapta a tokens del proyecto.

**Reglas duras de estilo:**

- Card principal · `border-top: 4px solid var(--gold)` · sombra sutil
- Números de sección · círculo dorado con fondo `var(--gold-wash)` y texto `var(--gold-ink)`
- Botón principal · dorado (`var(--gold)`)
- Subforms de patrón · fondo `var(--gold-wash-2)` con borde `var(--gold-wash)`
- Bolsa "Necesidades" activa · color navy
- Bolsa "Deseos" activa · color oro
- Bolsa "Ahorro" activa · color positivo (verde)
- NO usar rojo salvo en estados de error explícito (validación)
- NO usar pills/cards grandes para el modo de importe · usar select estándar

---

## 5 · Etapa D · verificación

### Build
- [ ] `tsc --noEmit` · 0 errores nuevos
- [ ] `npm run build` · pasa
- [ ] `npm test` · pasa

### Funcional · alta
- [ ] Botón "Nuevo gasto recurrente" visible en Personal > Gastos
- [ ] Click navega al wizard
- [ ] 4 secciones renderizadas correctamente
- [ ] Validación cliente bloquea submit con campos obligatorios vacíos
- [ ] Resumen lateral se actualiza en vivo
- [ ] KPI "coste anual previsto" calcula correctamente para los 3 modos

### Funcional · persistencia
- [ ] Al guardar · `compromisosRecurrentes` recibe nuevo registro con campos correctos
- [ ] `ambito='PERSONAL'` (uppercase · valor real del schema)
- [ ] `bolsaPresupuesto` con valor correcto del enum real
- [ ] `cuentaCargoId` apunta a `accounts.id` válido
- [ ] Idempotencia · doble click NO crea 2 registros

### Funcional · regeneración Tesorería
- [ ] Tras crear · `regenerateForecastsForward({ force: true })` se invoca
- [ ] Tesorería muestra cargos previstos del nuevo compromiso
- [ ] Calendario rolling 24m incluye los nuevos cargos

### Funcional · UI
- [ ] Tipos de gasto · 10 tipos en 3 optgroups
- [ ] Subtipos cambian según Tipo elegido
- [ ] Patrones de calendario · subform cambia según patrón
- [ ] Modo importe · subform cambia según modo
- [ ] Estacional · grid 6×2 · resumen automático funcional
- [ ] Bolsa pre-seleccionada según Tipo
- [ ] Toast éxito tras guardar
- [ ] Redirige a Personal > Gastos

### Funcional · catálogo placeholder
- [ ] Banner dorado visible
- [ ] Click en "Cargar catálogo" muestra toast "Próximamente"
- [ ] NO ejecuta carga real

### Tipado
- [ ] Cero `any` · cero `as any` nuevos
- [ ] Tipo `FormState` exportado y completo
- [ ] Validación tipada

### CSS / tokens
- [ ] `grep -E "#[0-9A-Fa-f]{6}" [archivos creados]` · 0 hex nuevos
- [ ] Tokens v5 respetados

### Reglas de scope
- [ ] CERO modificación de `compromisosRecurrentesService.ts` (solo invocar)
- [ ] CERO modificación de `treasuryBootstrapService.ts`
- [ ] CERO cambios DB
- [ ] CERO cambios tipos
- [ ] CERO modificación de `DetectarCompromisosPage.tsx`
- [ ] DB_VERSION intacto

---

## 6 · PR

**Rama** · `claude/t34-wizard-gasto-recurrente`

**Título PR** · `feat(personal): T34 wizard "Nuevo gasto recurrente personal" + acceso desde Personal>Gastos`

**Body PR**:

```
## Resumen

Auditoría AUDIT-gastos-pre-T34 reveló · `compromisosRecurrentes` cableado y
funcional · pero SIN UI manual de creación. Solo había DetectarCompromisosPage
(detección automática). T34 cierra esta brecha construyendo el wizard
"Nuevo gasto recurrente personal".

## Cambios

### Archivos nuevos
- ✨ `NuevoGastoRecurrentePage.tsx` · wizard 4 secciones
- ✨ Sub-componentes · SeccionTipoGasto · SeccionCalendario · SeccionImporte · SeccionCuentaBolsa · ResumenLateral
- ✨ Utils · tiposDeGasto · patronesCalendario · inferirBolsa
- ✨ Estilos · CSS modules siguiendo tokens v5 + énfasis oro

### Modificados
- ✏️ Routing Personal · añade ruta `/personal/gastos/nuevo`
- ✏️ Pestaña Personal>Gastos · añade botón "Nuevo gasto recurrente"

## Comportamiento

### Flujo creación
1. Usuario en Personal>Gastos pulsa botón "Nuevo gasto recurrente"
2. Wizard 4 secciones · Tipo + Calendario + Importe + Cuenta/Bolsa
3. Resumen lateral sticky se actualiza en vivo + KPI coste anual
4. Submit · validación · escribe `compromisosRecurrentes` · invoca regenerateForecastsForward
5. Toast éxito · redirige a Personal>Gastos

### Tipos soportados (10 tipos · 3 optgroups)
- Vivienda · alquiler · IBI · comunidad · seguro hogar
- Día a día · suministro · suscripción digital
- Otros · seguro · cuota · impuesto · otros recurrentes
- Hipoteca NO incluida (vive en Financiación)

### Patrones soportados
- Mensual día fijo · mensual día relativo · bimestral con anclaje
- Trimestral con anclaje · anual 1 pago · anual 2 pagos
- Solo los patrones soportados por `expandirPatron`

### Modos de importe
- Fijo · variable medio · estacional (12 valores)

### Catálogo típico
- Placeholder en T34 · al pulsar muestra toast "Próximamente"
- Carga real es T34.c (separado)

## NO toca

- ❌ Schema · DB_VERSION intacto
- ❌ `compromisosRecurrentesService.ts` (solo invocar)
- ❌ `treasuryBootstrapService.ts` (solo invocar)
- ❌ Tipos
- ❌ DetectarCompromisosPage (queda como flujo complementario)
- ❌ Listado / edición / borrado de compromisos (T34.b separado)
- ❌ Wizard inmueble (T35 separado)
- ❌ Vista gastos personales con movimientos (T36 separado)
- ❌ Carga real catálogo típico (T34.c separado)

## Cambios respecto al spec

(CC documenta desviaciones · si no hay · "Cero · implementación literal")

## Verificación

- [x] tsc --noEmit · 0 errores
- [x] npm run build · pasa
- [x] Wizard accesible desde Personal>Gastos
- [x] Validación cliente bloquea campos obligatorios
- [x] Submit crea registro `compromisosRecurrentes` con datos correctos
- [x] regenerateForecastsForward invocado · cargos visibles en Tesorería
- [x] 10 tipos en 3 optgroups
- [x] Bolsa pre-seleccionada según Tipo
- [x] Idempotencia submit
- [x] Toast éxito + redirección
- [x] Catálogo placeholder con toast "Próximamente"
- [x] Tokens v5 respetados · cero hex hardcoded
- [x] DB_VERSION intacto

**STOP-AND-WAIT** · Jose valida en deploy preview y mergea cuando OK.

Tras merge · siguientes:
- T34.b · listado / edición / borrado de compromisos (vista de catálogo activo)
- T34.c · carga catálogo típico de hogar
- T35 · wizard gasto recurrente inmueble
- T36 · vista gastos personales sobre movements categorizados (requiere schema task previa)
```

**NO mergear.** Esperar Jose.

---

## 7 · Si CC encuentra bloqueo

1. **`compromisosRecurrentesService` no expone método de creación directo** → usar `db.put('compromisosRecurrentes', objeto)` · documentar
2. **Schema `CompromisoRecurrente` distinto al asumido en spec** → adaptar formulario al schema real · documentar
3. **Algún patrón del select NO está soportado por `expandirPatron`** → quitar del select · documentar
4. **Enum `BolsaPresupuesto` tiene valores distintos a los esperados** → usar los reales · ajustar mapping · documentar
5. **`regenerateForecastsForward` falla al invocar** → log consola · toast warn al usuario · NO bloquear creación
6. **No hay sistema de toast del repo** → usar `alert()` o equivalente simple · documentar como deuda
7. **Componente Personal raíz no encontrado** → PARAR · preguntar a Jose
8. **Mockup HTML no llega a CC** → CC pide a Jose el path del mockup · NO improvisar diseño

**En ningún caso CC modifica schema · servicios o stores · NO implementa funcionalidades fuera de scope · NO mergea sin autorización.**

---

## 8 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- DB_VERSION 67 · estable
- `docs/MODELO-4-PAGINAS-atlas.md` · ancla conceptual
- `docs/AUDIT-gastos-pre-T34-2026-05-03.md` · auditoría que motiva T34
- `docs/AUDIT-treasury-generators-2026-05-02.md` · diagnóstico generadores
- Mockup HTML de referencia · `atlas-personal-wizard-gasto-recurrente-v1.html` (Jose lo facilita en outputs de la sesión · CC sigue literal)

---

## 9 · Resumen ejecutivo del spec

> Construye página `NuevoGastoRecurrentePage.tsx` siguiendo mockup HTML de referencia. 4 secciones · Tipo + Calendario + Importe + Cuenta/Bolsa. 10 tipos en 3 optgroups · vivienda incluida · sin hipoteca. Sin campo Ámbito visible (siempre PERSONAL). Submit invoca servicio existente · regenera forecasts · toast · redirige. NO toca schema · NO toca servicios · NO modifica DB. 1 PR · stop-and-wait · 6-8h CC.

---

**Fin spec T34 · 1 PR · stop-and-wait · 6-8h CC · UI funcional sobre stores existentes.**
