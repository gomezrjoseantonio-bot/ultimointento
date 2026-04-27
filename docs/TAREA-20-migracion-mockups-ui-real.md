# TAREA CC · TAREA 20 · Migración masiva mockups → UI real · v1

> **Tipo** · programa de trabajo a varias semanas · 4 fases con sub-tareas autocontenidas
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama madre** · crear `feature/migration-v5` desde `main` · cada sub-tarea hace PR contra esta rama madre · al cerrar las 4 fases · merge `feature/migration-v5` → `main`
>
> **Alcance** · sustituir la UI vieja del repo por la UI definida en los 16 mockups del proyecto · paleta v5 (Oxford Gold) · biblioteca de componentes consolidada · 1 sustitución directa por módulo
>
> **Tiempo estimado total** · 110-180h Copilot · 50-80h revisión Jose
>
> **Prioridad** · ALTA · pieza estratégica que desbloquea testing y dogfooding
>
> **Predecesores cerrados** · T7 · T13 · T16 · T17
>
> **Tareas congeladas durante T20** · T8 · T9 · T10 · T14 · T15 · se reactivan cuando T20 cierre
>
> **Tarea paralela permitida** · T18 calibración perfiles bancarios · ortogonal a UI · no toca componentes
>
> **DB** · NO se toca schema · NO se sube DB_VERSION · sigue en 65 · 40 stores

---

## 0 · Filosofía y reglas inviolables de T20

### 0.1 · 1 PR = 1 sub-tarea = 1 commit con stop-and-wait

CC abre PR · publica · **DETIENE LA EJECUCIÓN** · espera revisión Jose en deploy preview · NO empieza la siguiente sub-tarea hasta que Jose mergee y autorice. Esta regla es exactamente la misma que T17 §6 · cumplida exitosamente en los 6 PRs de T17 · se replica aquí.

Si CC encuentra ambigüedad o bloqueo · PARAR · comentar en PR · esperar input · NO inventar · NO continuar.

### 0.2 · Sustitución directa de cada módulo

Cuando un módulo migra · su versión vieja se elimina del repo en el mismo PR. NO doble ruta `/xxx-v5`. NO feature flag. La razón · simplicidad de mantenimiento · cero divergencia · cero código zombi.

Mitigación de riesgo · Fase 0 valida la biblioteca antes de tocar módulos · Fase 1 valida la biblioteca con un módulo pequeño (Ajustes) antes de tocar Tesorería · etapas tempranas detectan defectos arquitectónicos sin coste catastrófico.

### 0.3 · La guía v5 es ley

`GUIA-DISENO-V5-atlas.md` es de aplicación obligatoria. Cualquier divergencia entre mockup y guía v5 · prevalece la guía. Si el mockup tiene algo que la guía no contempla · CC debe documentarlo en comentario del PR antes de implementarlo · Jose decide si actualizar la guía o ajustar el mockup.

### 0.4 · Cero hex hardcoded

Todos los colores · espaciados · tipografías · vienen de tokens CSS de la guía v5 sección 2. CC nunca escribe `#1A2B3C` · siempre `var(--blue)`. Excepción única · el archivo de tokens en sí.

### 0.5 · Lucide-react + IBM Plex Sans + JetBrains Mono · ya son las únicas

Iconografía · solo Lucide-react · 1 icono fijo por concepto según diccionario guía v5 sección 13. Tipografía · IBM Plex Sans (texto UI) · IBM Plex Mono (referencias técnicas como CRC, IBAN) · JetBrains Mono Bold (números prominentes en KPIs y dashboards). Cualquier otra fuente · prohibida.

### 0.6 · Sustitución directa pero con red de seguridad

Si tras una sub-tarea Jose detecta regresión grave en deploy preview · `git revert` del PR · análisis · re-lanzar sub-tarea corregida. NO se mergea contra `main` hasta cerrar las 4 fases · `feature/migration-v5` actúa como rama de integración aislada del usuario en producción durante todo T20.

### 0.7 · Datos del usuario intactos

T20 NO toca DB · NO toca servicios · NO toca lógica de negocio. Solo sustituye componentes UI que consumen los servicios existentes. Los datos del usuario (planes pensiones · inmuebles · contratos · movements · etc.) deben permanecer accesibles en cada fase. Si una sub-tarea rompe acceso a datos · es BUG · revertir.

### 0.8 · Mockups disponibles · inventario completo

Los siguientes 16 archivos HTML viven en `docs/mockups/` (CC debe copiarlos del proyecto al inicio de Fase 0 si no están ya en el repo · si están · referenciar):

```
atlas-ajustes-v2.html              · módulo Ajustes
atlas-archivo.html                  · módulo Archivo  
atlas-contratos-v4.html             · módulo Contratos (sub-módulo de Inmuebles?)
atlas-correccion.html               · flujo Corrección por inspección
atlas-financiacion-v2.html          · módulo Financiación
atlas-fiscal.html                    · módulo Fiscal/Impuestos
atlas-historia-jose-v2.html         · documento narrativo · NO migrar a UI · referencia
atlas-inmueble-fa32-v2.html         · ficha detalle inmueble
atlas-inmuebles-v3.html             · listado inmuebles
atlas-inversiones-v2.html           · módulo Inversiones (gestión + supervisión)
atlas-mi-plan-v2.html               · módulo Mi Plan (compass financial freedom)
atlas-onboarding.html                · flujo Onboarding inicial
atlas-panel.html                     · Dashboard de Supervisión
atlas-personal-v3.html              · módulo Personal
atlas-tesoreria-v8.html             · módulo Tesorería
atlas-wizard-nuevo-contrato.html    · wizard alta de contrato
```

CC debe leer cada mockup completo antes de migrarlo · NO partir solo del título.

---

## 1 · FASE 0 · Biblioteca de componentes v5 + tokens globales

> **Sub-tarea** · 20.0 · una única sub-tarea · 1 PR · stop-and-wait al cerrar
>
> **Tiempo estimado** · 15-25h Copilot · 6-10h revisión Jose
>
> **Output** · biblioteca `src/design-system/v5/` con tokens y componentes base · página `/dev/components` para validación visual · NO toca módulos productivos

### 1.1 · Tokens globales

Crear `src/design-system/v5/tokens.css` con TODOS los tokens de la guía v5 sección 2:

- Paleta · `--blue`, `--gold`, `--gold-soft`, `--gold-deep`, los `--n-*` (neutros), los `--s-*` (semánticos), `--c1` a `--c6` (categorías)
- Tipografía · `--font-ui`, `--font-mono-tech`, `--font-mono-num`, escala de tamaños `--fs-*`, weights `--fw-*`, line-heights `--lh-*`
- Espaciado · escala `--sp-1` a `--sp-12` siguiendo guía
- Sombras · `--shadow-card`, `--shadow-card-hover`, `--shadow-modal`
- Radios · `--radius-sm`, `--radius-md`, `--radius-lg`
- Z-index · `--z-modal`, `--z-toast`, `--z-dropdown`

Importar en el entrypoint global de la app (`index.css` o `main.tsx` según estructura existente).

### 1.2 · Componentes base obligatorios

Crear cada uno en su archivo `.tsx` con tipos TypeScript · props con defaults · sin lógica de negocio · puramente presentacionales:

| Componente | Archivo | Variantes |
|---|---|---|
| `<PageHead>` | `src/design-system/v5/PageHead.tsx` | con/sin botón derecha · con/sin tabs · con/sin breadcrumb |
| `<TabsUnderline>` | `src/design-system/v5/TabsUnderline.tsx` | tabs subyacentes guía v5 sección 5 |
| `<CardV5>` | `src/design-system/v5/CardV5.tsx` | accent navy · accent gold · accent neutral · sin accent |
| `<KPIStrip>` | `src/design-system/v5/KPIStrip.tsx` | 2/3/4/5 KPIs · guía v5 sección 7 |
| `<KPI>` | `src/design-system/v5/KPI.tsx` | unidad child de KPIStrip |
| `<HeroBanner>` | `src/design-system/v5/HeroBanner.tsx` | 4 variantes guía v5 sección 8 |
| `<UploadZone>` | `src/design-system/v5/UploadZone.tsx` | drag-drop con borde dashed gold |
| `<EmptyState>` | `src/design-system/v5/EmptyState.tsx` | icono + título + sub + CTA opcional |
| `<Toast>` | `src/design-system/v5/Toast.tsx` | success · warn · error · info |
| `<Pill>` | `src/design-system/v5/Pill.tsx` | estado · color por dominio según guía v5 sección 11 |
| `<MoneyValue>` | `src/design-system/v5/MoneyValue.tsx` | importe formateado JetBrains Mono · color según signo |
| `<DateLabel>` | `src/design-system/v5/DateLabel.tsx` | fecha formato ATLAS estándar |
| `<IconButton>` | `src/design-system/v5/IconButton.tsx` | Lucide icon · variantes ghost/primary/danger |

Cada componente debe:
- Tener todas sus props tipadas
- Usar exclusivamente tokens v5 · cero hex hardcoded
- Soportar `className` extra para casos puntuales
- Tener export default + export nombrado
- Documentar props con JSDoc breve

### 1.3 · Página validación visual `/dev/components`

Crear `src/pages/dev/ComponentsShowcase.tsx` accesible en ruta `/dev/components` (solo en desarrollo · `import.meta.env.DEV` flag · NO en producción).

Estructura:
- 1 sección por componente
- Para cada componente · todas sus variantes lado a lado
- Etiqueta encima de cada variante con el nombre `<PageHead variant="with-tabs">` etc.
- Texto + datos dummy realistas (no "Lorem ipsum" · usar nombres tipo "Inmueble FA32" · "Préstamo 510280492" · etc.)

Esta página es la herramienta principal de validación de Fase 0 · Jose la abre en deploy preview y verifica que cada componente respeta los mockups y la guía v5.

### 1.4 · Diccionario de iconos Lucide

Crear `src/design-system/v5/icons.ts` exportando 1 constante por concepto según guía v5 sección 13 · ej:

```typescript
import { Home, FileText, Banknote, ... } from 'lucide-react';

export const Icons = {
  inmueble: Home,
  contrato: FileText,
  tesoreria: Banknote,
  // ... 1 entrada por concepto del diccionario v5
};
```

Razón · cualquier developer (incluido CC en sub-tareas posteriores) usa `Icons.inmueble` · evita confusión sobre qué icono representa qué.

### 1.5 · Verificación Fase 0

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Ruta `/dev/components` muestra todos los componentes con todas sus variantes
- [ ] Inspección DevTools · cero hex hardcoded en `src/design-system/v5/`
- [ ] Visual coincide con mockups de referencia (Jose verifica en deploy preview)
- [ ] Ningún módulo productivo se ha tocado · `App.tsx` solo tiene 1 ruta nueva `/dev/components` · todo lo demás intacto

### 1.6 · PR Fase 0

Título · `feat(design-system): biblioteca v5 · tokens + 13 componentes base + showcase`

Descripción:
- Lista archivos creados (separados por categoría · tokens · componentes · showcase · iconos)
- Confirmación checklist 1.5 punto por punto
- Screenshots del showcase con cada componente
- TODOs creados (si CC encuentra divergencias entre mockup y guía v5)

**STOP-AND-WAIT** · Jose verifica showcase en deploy preview · si visual y arquitectura OK · merge · Fase 1 arranca.

---

## 2 · FASE 1 · Migrar Ajustes v2 (validación de biblioteca con módulo pequeño)

> **Sub-tarea** · 20.1 · una única sub-tarea · 1 PR · stop-and-wait al cerrar
>
> **Tiempo estimado** · 8-12h Copilot · 4-6h revisión Jose
>
> **Output** · módulo Ajustes vivo según mockup `atlas-ajustes-v2.html` · módulo Ajustes viejo eliminado · biblioteca v5 validada en caso real
>
> **Predecesor** · Fase 0 mergeada en `feature/migration-v5`

### 2.1 · Lectura previa obligatoria

CC lee íntegro `docs/mockups/atlas-ajustes-v2.html` (1797 líneas según ls del proyecto) · identifica:
- Pestañas y subpáginas (Perfil · Plan & Facturación · Configuración · Exportación · Migración · Seguridad · etc.)
- Componentes que consume (PageHead · TabsUnderline · CardV5 · etc.)
- Componentes específicos NO genéricos (formularios concretos · listas de configuración · etc.) → estos sí van en `src/modules/ajustes/`
- Datos que muestra · qué stores lee · qué stores escribe

### 2.2 · Estructura del módulo nuevo

```
src/modules/ajustes/
├── AjustesPage.tsx                  · contenedor con tabs
├── tabs/
│   ├── PerfilTab.tsx
│   ├── PlanFacturacionTab.tsx
│   ├── ConfiguracionTab.tsx
│   ├── ExportacionTab.tsx
│   ├── MigracionTab.tsx
│   └── SeguridadTab.tsx
├── components/                       · componentes específicos del módulo
│   └── ...
└── styles.css
```

Si la estructura del mockup difiere · CC adapta · documentar en PR.

### 2.3 · Sustitución del módulo viejo

- Identificar componentes Ajustes viejos (probablemente `src/modules/cuenta/...` o similar · usar grep "Ajustes" + grep rutas `/cuenta/...` y `/ajustes/...`)
- ELIMINAR archivos viejos · grep limpio post-eliminación
- Actualizar `App.tsx` · ruta `/ajustes` (o `/cuenta` según convención actual) apunta al nuevo `AjustesPage`
- Verificar sidebar · entrada "Ajustes" navega correctamente

### 2.4 · Caso especial · sub-pestaña "Importar movimientos bancarios"

T17 sub-tarea 17.4 puso `BankStatementUploadPage` en `Cuenta → Migración → Importar movimientos bancarios`. En la migración a v5:
- Si Ajustes v2 mockup tiene "Migración de Datos" como pestaña · mantener el item "Importar movimientos bancarios" allí · seguir apuntando a la ruta `/tesoreria/importar` (o ruta donde viva ahora) · NO duplicar la pantalla
- Si Ajustes v2 mockup NO tiene esa pestaña · documentar en PR · Jose decide si la añadimos a la guía o si la pantalla migra a otro sitio

### 2.5 · Verificación Fase 1

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Sidebar entrada "Ajustes" funciona · navegación entre tabs funciona
- [ ] Cada tab muestra contenido coherente con el mockup
- [ ] Datos del usuario visibles correctamente (perfil · datos personales · etc.)
- [ ] Cero referencias al código viejo de Ajustes (grep limpio)
- [ ] Cero hex hardcoded en `src/modules/ajustes/`
- [ ] Checklist v5 sección 17 pasada item por item
- [ ] Visual coincide con mockup (Jose verifica en deploy preview)

### 2.6 · PR Fase 1

Título · `feat(ajustes): migrate Ajustes module to v5 · sustituir UI vieja`

Descripción:
- Lista archivos creados (módulo nuevo)
- Lista archivos eliminados (módulo viejo)
- Cambios en `App.tsx` (rutas)
- Confirmación checklist 2.5 punto por punto
- Screenshots del antes/después (Jose puede pedirlas si quiere)
- Decisión sobre item "Importar movimientos bancarios" (§2.4)

**STOP-AND-WAIT** · Jose valida Ajustes v2 en deploy preview · si visual y funcional OK · merge · Fase 2 arranca.

---

## 3 · FASE 2 · Migrar Tesorería v8 (módulo crítico · desbloquea testing)

> **Sub-tarea** · 20.2 · puede partirse en 20.2a + 20.2b si Tesorería v8 es muy grande · CC decide al leer mockup
>
> **Tiempo estimado** · 20-30h Copilot · 10-15h revisión Jose
>
> **Output** · módulo Tesorería vivo según mockup `atlas-tesoreria-v8.html` · viejo eliminado · botón "Subir extracto" en page-head Tesorería navega a `/tesoreria/importar`
>
> **Predecesor** · Fase 1 mergeada en `feature/migration-v5`

### 3.1 · Lectura previa

CC lee íntegro `docs/mockups/atlas-tesoreria-v8.html` (~2000 líneas) · identifica todas las sub-pantallas y componentes específicos. Tesorería tiene · Evolución (gráfico cashflow) · Balances bancarios · Movimientos · Subir extracto (existe ya en T17) · Reglas de matching · etc. CC decide si parte la sub-tarea en 20.2a (Evolución + Balances) y 20.2b (Movimientos + integración con T17) · si parte · sigue stop-and-wait entre ambas.

### 3.2 · Estructura del módulo nuevo

```
src/modules/tesoreria/
├── TesoreriaPage.tsx                 · contenedor con tabs underline
├── tabs/
│   ├── EvolucionTab.tsx
│   ├── BalancesTab.tsx
│   └── MovimientosTab.tsx
├── components/
│   ├── CashflowChart.tsx
│   ├── BankAccountCard.tsx
│   ├── MovementsList.tsx
│   └── ...
└── styles.css
```

### 3.3 · Re-rutado de "Subir extracto"

Tras Fase 2:
- Page-head de Tesorería tiene botón "Subir extracto" (icono Lucide `Upload`) que navega a `/tesoreria/importar`
- Mantener `BankStatementUploadPage` que ya existe (T17 17.4) · no se reescribe · solo se añade entrada desde page-head Tesorería
- Si en Fase 1 la entrada "Importar movimientos bancarios" en Ajustes Migración seguía existiendo · ahora puede eliminarse · Tesorería es el sitio natural de esa pantalla

### 3.4 · Sustitución del módulo viejo

- Identificar componentes Tesorería viejos (probablemente `src/modules/horizon/tesoreria/...` salvo `import/` que es de T17 y se mantiene)
- ELIMINAR archivos viejos · grep limpio post-eliminación
- Actualizar `App.tsx` con rutas nuevas
- Verificar que `/conciliacion` (ConciliacionPageV2) sigue funcionando · NO se toca en esta fase salvo que esté integrada en Tesorería v8 según el mockup · si lo está · CC documenta en PR antes de migrarla

### 3.5 · Caso crítico · ConciliacionPageV2

ConciliacionPageV2 es la pantalla de punteo manual existente · funciona · no está en mockup separado · CC tiene 2 opciones según lo que vea en el mockup Tesorería v8:
- (a) Si Tesorería v8 absorbe punteo manual dentro de una de sus pestañas · migrar también ConciliacionPageV2 a v5 dentro del módulo Tesorería · ELIMINAR la ruta `/conciliacion` del sidebar
- (b) Si Tesorería v8 NO contempla punteo manual · mantener `/conciliacion` y ConciliacionPageV2 intactos por ahora · documentar en PR como TODO para fase posterior

CC decide tras leer el mockup · documenta decisión en PR · Jose valida.

### 3.6 · Verificación Fase 2

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Sidebar entrada "Tesorería" funciona · navegación entre tabs funciona
- [ ] Botón "Subir extracto" en page-head navega correctamente a `/tesoreria/importar`
- [ ] La pantalla de subir extracto (de T17) sigue funcionando 100%
- [ ] Cashflow chart muestra datos reales del usuario
- [ ] Balances bancarios muestran cuentas reales
- [ ] Lista de movimientos muestra datos reales
- [ ] Cero referencias al código viejo de Tesorería (grep limpio · excepto `import/` de T17)
- [ ] Cero hex hardcoded en `src/modules/tesoreria/`
- [ ] Checklist v5 sección 17 pasada item por item
- [ ] Visual coincide con mockup
- [ ] Si ConciliacionPageV2 se ha migrado · funciona · si NO · `/conciliacion` sigue accesible

### 3.7 · PR Fase 2

Título · `feat(tesoreria): migrate Tesorería module to v8 · cashflow + balances + movements`

Descripción:
- Lista archivos creados
- Lista archivos eliminados
- Cambios en `App.tsx` (rutas)
- Decisión sobre ConciliacionPageV2 (§3.5)
- Confirmación checklist 3.6 punto por punto
- Screenshots clave (page-head con botón Subir · cashflow chart · lista movements)

**STOP-AND-WAIT** · Jose valida Tesorería v8 en deploy preview · revisa que el flujo de subir extracto sigue funcionando · que punteo manual funciona (en su nueva ubicación o la antigua) · merge · Fase 3 arranca.

---

## 4 · FASE 3 · Migrar el resto en cascada (7 módulos)

> **Sub-tareas** · 20.3a a 20.3g · una sub-tarea por módulo · 1 PR cada una · stop-and-wait entre cada una
>
> **Tiempo estimado total Fase 3** · 56-105h Copilot · 28-50h revisión Jose
>
> **Output** · módulos restantes migrados · UI vieja eliminada por completo
>
> **Predecesor** · Fase 2 mergeada en `feature/migration-v5`

### 4.1 · Orden propuesto de las 7 sub-tareas

CC ataca las sub-tareas en este orden estricto · NO paralelizar · stop-and-wait entre cada una:

| Sub-tarea | Módulo | Mockup primario | Mockups complementarios |
|---|---|---|---|
| 20.3a | Inmuebles | `atlas-inmuebles-v3.html` | `atlas-inmueble-fa32-v2.html` (ficha detalle) · `atlas-contratos-v4.html` (sub-módulo contratos) · `atlas-wizard-nuevo-contrato.html` |
| 20.3b | Personal | `atlas-personal-v3.html` | `ATLAS-Personal-modelo-datos-v1.md` (referencia datos) |
| 20.3c | Mi Plan | `atlas-mi-plan-v2.html` | — |
| 20.3d | Inversiones | `atlas-inversiones-v2.html` | — (ojo · ya hay módulo planes pensiones de T13 dentro · NO tocar lógica · solo UI envolvente) |
| 20.3e | Financiación | `atlas-financiacion-v2.html` | — |
| 20.3f | Fiscal/Impuestos + Corrección | `atlas-fiscal.html` | `atlas-correccion.html` (flujo corrección por inspección) |
| 20.3g | Archivo + Onboarding + Dashboard | `atlas-archivo.html` · `atlas-onboarding.html` · `atlas-panel.html` | — |

Justificación del orden:
- Inmuebles primero porque es el módulo central · resto depende de inmuebles para contexto (asignación de gastos · contratos · etc.)
- Personal antes que Mi Plan porque Mi Plan lee datos personales (objetivos · ingresos)
- Mi Plan antes que Inversiones porque Mi Plan referencia inversiones agregadas
- Inversiones antes que Financiación porque Financiación tiene sub-relación con préstamos sobre inversiones
- Fiscal al final del bloque productivo porque consume datos de TODOS los anteriores
- Archivo + Onboarding + Dashboard al final porque son meta-módulos · Dashboard agrega los demás

### 4.2 · Plantilla común para cada sub-tarea Fase 3

Cada sub-tarea sigue esta estructura idéntica:

#### Lectura previa
CC lee íntegro el/los mockup(s) primario y complementarios · identifica componentes consumidos de la biblioteca v5 · componentes específicos del módulo · datos consumidos · stores accedidos.

#### Estructura del módulo nuevo
```
src/modules/{nombre-modulo}/
├── {Nombre}Page.tsx
├── tabs/  o  pages/   según estructura del mockup
├── components/
└── styles.css
```

#### Sustitución del módulo viejo
- Localizar archivos viejos del módulo (`grep` por nombres · rutas)
- ELIMINAR · grep limpio
- Actualizar `App.tsx` · sidebar · breadcrumbs

#### Verificación
- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Sidebar entrada del módulo funciona · navegación funciona
- [ ] Datos del usuario visibles correctamente
- [ ] Cero referencias al código viejo del módulo (grep limpio)
- [ ] Cero hex hardcoded en `src/modules/{nombre}/`
- [ ] Checklist v5 sección 17 pasada item por item
- [ ] Visual coincide con mockup
- [ ] Wizards y flujos secundarios funcionan (si aplica)

#### PR
Título · `feat({modulo}): migrate {Modulo} module to v{N} · sustituir UI vieja`

Descripción · análoga a Fases 1 y 2.

**STOP-AND-WAIT** entre cada sub-tarea Fase 3 · Jose valida en deploy preview · merge · siguiente sub-tarea arranca.

### 4.3 · Notas específicas por sub-tarea

#### 20.3a · Inmuebles · 3 mockups complementarios

- Listado · ficha detalle · contratos · wizard nuevo contrato · todo en mismo PR salvo que CC justifique partir
- Wizard nuevo contrato · usar componente `<WizardStepper>` que probablemente CC necesite añadir a la biblioteca v5 (Fase 0 lo tenía como fuera de alcance) · si lo necesita · añadirlo al PR de 20.3a y documentar
- T13 · si Inmuebles enseña planes de pensiones del usuario en algún sitio · NO tocar lógica · solo presentación

#### 20.3b · Personal

- Atender al documento `ATLAS-Personal-modelo-datos-v1.md` que define el modelo de datos del módulo · CC respeta el modelo · NO inventa campos
- Datos personales son sensibles · validar que no se exponen indebidamente

#### 20.3c · Mi Plan

- Compass financial freedom es complejo · gráficos · simulador · objetivos
- Lee datos de Inmuebles · Inversiones · Personal · si alguno aún no migrado · debe seguir leyendo de las versiones viejas correctamente · validar
- Si el simulador requiere componentes de gráficos (Recharts? Visx?) · CC documenta dependencia en PR

#### 20.3d · Inversiones (incluye planes de pensiones de T13)

- T13 dejó el wizard de 5 pasos para crear plan PP · NO tocar lógica · solo envolver con UI v5
- Otros activos · acciones · fondos · crypto · depósitos · todos según mockup
- Comprobar que la entrada "Nueva posición" sigue funcionando

#### 20.3e · Financiación

- Spec previa `SPEC-financiacion-destino-garantia-v2.md` · si CC encuentra divergencia entre spec y mockup · documentar en PR antes de implementar

#### 20.3f · Fiscal + Corrección

- Mockup `atlas-correccion.html` define el flujo "corrección por inspección" · NO existe lógica de cascade aún · esta sub-tarea solo construye UI · la lógica de cascade es tarea futura
- Documentar TODO en el PR · "UI corrección lista pero motor de cascade pendiente · próxima tarea"

#### 20.3g · Archivo + Onboarding + Dashboard

- Más ligeros que el resto · agruparlos en una sub-tarea
- Onboarding crítico para nuevos usuarios · validar el flujo end-to-end con DB vacía
- Dashboard agrega KPIs de los demás módulos · si algún módulo viejo aún convive (no debería · todos los anteriores ya migrados) · debe leer correctamente

### 4.4 · Si una sub-tarea Fase 3 detecta defecto en biblioteca v5

Si CC al migrar un módulo descubre que la biblioteca v5 (Fase 0) tiene un componente faltante o defectuoso · 2 opciones:
- (a) Si el componente es genérico y se usará en módulos posteriores · añadir/corregir en biblioteca v5 dentro del mismo PR · documentar en sección "Cambios en biblioteca v5" del PR
- (b) Si el componente es específico de este módulo · ponerlo en `src/modules/{modulo}/components/` · NO contaminar la biblioteca

Jose valida la decisión en revisión.

---

## 5 · FASE 4 · Limpieza final + merge a `main`

> **Sub-tareas** · 20.4 (limpieza) + 20.5 (merge `feature/migration-v5` → `main`)
>
> **Tiempo estimado** · 4-6h Copilot · 2-4h revisión Jose
>
> **Predecesor** · Fase 3 íntegra mergeada en `feature/migration-v5`

### 5.1 · Sub-tarea 20.4 · Limpieza

#### Auditoría exhaustiva

- `grep` global por nombres de archivos viejos eliminados (referencias residuales)
- `grep` por hex hardcoded en `src/` (excepto `src/design-system/v5/tokens.css`)
- `grep` por imports de fuentes obsoletas (Inter · Roboto · etc.) · si quedan referencias · purgar
- `grep` por iconos no-Lucide · si quedan · sustituir
- Eliminar carpetas vacías
- Eliminar archivos `.backup` huérfanos (incluido `BankStatementModal.tsx.backup`)
- Verificar que ningún componente de v3/v4 sigue importándose

#### Documentación final

- Crear `docs/DESIGN-SYSTEM-V5.md` con referencia rápida a la biblioteca · qué componente usar para qué caso · ejemplos de código
- Actualizar `README.md` del repo con sección "Sistema de diseño" apuntando a la biblioteca v5
- Marcar `GUIA-DISENO-V5-atlas.md` como CONSOLIDADA (ya implementada)
- Eliminar `GUIA_DISENO_DEFINITIVA_V4.md` si todavía existe (la v5 la sustituye)

#### Verificación 20.4

- [ ] `tsc --noEmit` pasa
- [ ] Build pasa
- [ ] App arranca sin errores
- [ ] Bundle size · medido antes/después · esperar reducción significativa por eliminación de código viejo
- [ ] grep `#[0-9A-Fa-f]{6}` en `src/` (excepto tokens.css) · 0 resultados
- [ ] Todos los módulos de la app funcionan · navegación completa OK
- [ ] Documentación creada y enlazada

#### PR 20.4

Título · `chore(migration-v5): cleanup final · purge legacy components + docs`

**STOP-AND-WAIT**

### 5.2 · Sub-tarea 20.5 · Merge final

Cuando 20.4 está mergeada · Jose merge `feature/migration-v5` → `main` (manual · NO automatizado) · deploy a producción · Jose verifica que todo funciona en producción real · si OK · T20 cerrada.

Si en producción aparece bug · `git revert` de la branch entera (es 1 merge commit grande) · análisis · sub-tarea de fix en `feature/migration-v5` · re-merge.

---

## 6 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Sustitución directa rompe módulo · usuario no puede acceder a datos | Media | Trabajo en branch `feature/migration-v5` · si Jose detecta regresión en deploy preview antes de merge a main · revertir PR · sin afectar a producción |
| Biblioteca v5 incompleta · falta componente al llegar a Fase 3 | Alta | (a) Fase 1 valida biblioteca con módulo pequeño antes de tocar Tesorería · (b) cada Fase 3 sub-tarea puede añadir componentes a biblioteca y documentar |
| Mockup tiene patrón no contemplado en guía v5 | Media | CC documenta divergencia en PR · Jose decide si actualizar guía o ajustar mockup · NO inventar |
| 16 mockups + 1 guía · CC se pierde con tanto contexto | Media | Plantilla común §4.2 estandariza el flujo · cada sub-tarea CC lee solo el mockup primario y complementarios · NO los 16 a la vez |
| Sub-tarea grande (Tesorería v8) excede capacidad de 1 PR limpio | Media | CC autorizado a partir 20.2 en 20.2a + 20.2b · stop-and-wait entre ambas |
| Datos de prueba inconsistentes entre módulos durante migración | Media | T20 NO toca DB · datos del usuario intactos · cualquier inconsistencia es BUG · revertir |
| Tiempo total subestimado (puede ser 200h+) | Alta | El estimado 110-180h es horquilla · Jose puede pausar entre fases si necesita aire · stop-and-wait permite pausas naturales |
| Dependencia entre módulos rompe migración aislada (Mi Plan lee de Inmuebles · si Mi Plan migra antes que Inmuebles · roto) | Alta | Orden §4.1 elegido para minimizar dependencias hacia atrás · Inmuebles primero · resto depende de él · si CC ve dependencia hacia delante · documentar |
| ConciliacionPageV2 queda huérfana entre fases | Media | §3.5 · CC decide migración o mantenimiento al ver mockup Tesorería v8 · si mantiene · documentar TODO para sub-tarea futura |
| Bundle size crece en lugar de bajar | Baja | Auditoría 20.4 mide antes/después · si crece > 5% · investigar antes de merge a main |

---

## 7 · Plan B · si T20 se atasca

Si una fase completa falla persistentemente:

1. Pausar T20 · `feature/migration-v5` se queda como está sin merge a main
2. Producción sigue con UI vieja · sin perjuicio para usuario
3. Análisis del bloqueo · puede ser técnico (componente complejo) o arquitectónico (decisión incorrecta de Fase 0)
4. Si arquitectónico · revertir hasta Fase 0 · re-planificar biblioteca · re-arrancar
5. Si técnico de un módulo · saltar ese módulo · cerrar T20 con ese módulo en TODO · abrir T20-bis para él específicamente

---

## 8 · Lo que T20 NO hace

- ❌ NO toca DB · NO toca schema · NO sube DB_VERSION
- ❌ NO toca servicios de negocio · solo UI consumidora
- ❌ NO añade features nuevas · solo migra UI a v5
- ❌ NO mejora performance de servicios · solo de bundle UI
- ❌ NO reescribe lógica de matching · learning · suggestion (T17)
- ❌ NO migra ATLAS-historia-jose-v2.html (es documento narrativo · no UI)
- ❌ NO calibra perfiles bancarios (T18 corre en paralelo · separada)
- ❌ NO añade IA Claude (T19 · post-T18)
- ❌ NO bootstrap compromisosRecurrentes (T9 · descongelar tras T20)
- ❌ NO atiende saneamientos T8 · T10 · T14 · T15 · congelados durante T20

---

## 9 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main` (post-T17 cerrada)
- DB_VERSION 65 · 40 stores · estable
- 16 mockups HTML en `docs/mockups/` (CC los copia desde el proyecto en Fase 0 si no están)
- `GUIA-DISENO-V5-atlas.md` · 1198 líneas · 17 secciones · LEY
- `GUIA_DISENO_DEFINITIVA_V4.md` · obsoleto · se elimina en Fase 4
- Datos del usuario reales · 10 cuentas bancarias · 5 inmuebles · contratos activos · etc.

---

## 10 · Criterios de aceptación globales T20

- [ ] 4 fases cerradas en orden · 11 sub-tareas en total (1 + 1 + 1 + 7 + 1)
- [ ] Cada sub-tarea con stop-and-wait respetado
- [ ] DB_VERSION sigue en 65 al final · sin cambios de schema
- [ ] Build limpio · `tsc --noEmit` limpio · tests pasan
- [ ] App arranca sin errores en producción tras merge final
- [ ] Visual coincide con los 16 mockups (excepto historia-jose que no es UI)
- [ ] Sidebar y navegación coherentes
- [ ] Datos del usuario accesibles en todos los módulos
- [ ] Cero hex hardcoded fuera de tokens.css
- [ ] Cero referencias a componentes legacy
- [ ] Bundle size estable o reducido
- [ ] Documentación final en `docs/DESIGN-SYSTEM-V5.md`

---

## 11 · Después de T20

1. Descongelar tareas · T8 · T9 · T10 · T14 · T15 · ya pueden trabajarse sobre UI v5 estable
2. Cerrar T18 calibración bancos si aún corre
3. Decidir T19 IA fallback parsing según resultados de T18
4. Abrir TAREA 21 · features nuevas que solo tienen sentido sobre UI v5 (ej · proactive fiscal calendar · "corrección por inspección" motor de cascade · transformación de inmueble por división horizontal · etc.)
5. ATLAS está finalmente en condiciones de salir a usuarios reales del target (cursos · Zona 3 · Libertad Inmobiliaria · Unihouser)

---

**Fin de la spec maestra T20 v1 · 11 sub-tareas con stop-and-wait estricto · cada una autocontenida.**
