# AUDIT · FIX onboarding · PUNTO 3 · bloque contratos · Commit 1/3

> Solo grep + lectura · CERO código. Reporte §1 de la tarea.
> Conclusión: los 5 problemas son ciertos y el fix es viable sin tocar el parser
> Rentila ni la lógica de revisión/mapeo. Los wizards aceptan retorno con cambio
> trivial (`?from=empezar` + lectura de `useSearchParams`). NO requiere STOP.

## Tabla de los 5 problemas

| # | Problema | path:líneas | Causa exacta |
|---|----------|-------------|--------------|
| P1 | Las dos vías sacan del flujo sin vuelta | `ContratosBloque.tsx:34` → `navigate('/inmuebles/importar-contratos')` · `ContratosBloque.tsx:43` → `navigate('/contratos/nuevo')` | Navegan a las rutas completas sin `from`/`returnTo`. El importador termina en `ImportarContratosWizard.tsx:484` `navigate('/contratos?tab=conciliar')` y el manual en `NuevoContratoWizard.tsx:197` `navigate('/contratos?tab=activos')`. Cancelar: importador `onBack`=`window.history.back()` (`App.tsx:844`), manual `navigate(-1)` (`NuevoContratoWizard.tsx:222`). Ninguno conoce el origen onboarding. |
| P2 | Cierre del bucle inexistente | `onboardingSyncService.ts:31-33` marca `contratos` completado si `contracts.length>0`, pero solo se ejecuta en `OnboardingContext.refresh()` (`OnboardingContext.tsx:33-40`) | Como las vías abandonan `/empezar` y nunca vuelven, `refresh()`/`syncNucleoFromData()` no se reejecuta en el contexto de onboarding → el bloque no se marca ni el % sube al terminar. La API existe: `setBloqueEstado('contratos','completado')` (`onboardingProgressService.ts:183`). |
| P3 | Off-by-one de fechas (1 día menos) | `DateLabel.tsx:68` `new Date(value)` · usado en `NuevoContratoWizard.tsx:691` (Inicio) y `:697` (Fin) | `form.fechaInicio` es date-only `"2026-06-08"` (del `<input type="date">`). `new Date("2026-06-08")` se parsea como **medianoche UTC**; luego `Intl.DateTimeFormat('es-ES',…).format()` (`DateLabel.tsx:31-36`) formatea en la **TZ local** → en zonas detrás de UTC muestra el día anterior ("7 jun 2026"). El `<input type="date">` interpreta el mismo string como fecha **local**, por eso muestra "08/06/2026". Discrepancia campo↔resumen. `DateLabel` es global → fix **dentro del wizard** (pasar `Date` local). |
| P4 | Plantilla ATLAS no es espejo del wizard | `atlasTemplateParserService.ts:49-61` (11 columnas) vs `NuevoContratoWizard.tsx:19-34` (FormState) | Ver inventario abajo. Faltan como columnas: **Día de pago** y **Indexación** (campos reales del FormState) y los campos de modelo **Reducción IRPF** (`Contract.reduccion`, `db.ts:879`) y **Cotitulares** (`Contract.inquilino.cotitulares`, `db.ts`). En import, `contractImportCreationService.ts:125,127` hardcodea `diaPago:1` / `indexacion:'none'`. |
| P5 | Paso "Origen" innecesario + "Otro Excel" muerto | `ImportarContratosWizard.tsx:55` (`origen` state) · `:211-263` (`renderPaso1`) · `:235-240` (card "Otro Excel" deshabilitada) | El paso pide declarar el formato a mano. Los reconocedores por cabecera YA existen: `validateRentilaHeader` (`rentilaParserService.ts:93`) y `validateAtlasTemplateHeader` (`atlasTemplateParserService.ts:66`), ambos lanzan error si el header no encaja. NO hay función combinada de detección → se añade un reconocedor que las antepone. |

## ¿Los wizards aceptan retorno?

- **Importador** (`ImportarContratosWizard.tsx`): recibe `onBack`/`onComplete` por props desde `App.tsx:840-847` (`onComplete=noop`, `onBack=history.back`). El `navigate` final está hardcodeado dentro (`:484`). Aprende a volver leyendo `useSearchParams().get('from')` y bifurcando el destino. **Trivial.**
- **Manual** (`NuevoContratoWizard.tsx`): ya usa `useSearchParams` (`:56`) para `?inmueble=`. Añadir `?from=empezar` y bifurcar `navigate` final (`:197`) y cancelar (`:222`) es **trivial**.

→ No se requiere STOP. Se procede con `?from=empezar`.

## Inventario · campos del wizard manual (FormState) vs 11 columnas plantilla ATLAS

| Campo wizard (FormState) | Obligatorio | Columna ATLAS actual | Estado |
|--------------------------|-------------|----------------------|--------|
| inmuebleId | sí | 1 Inmueble | ✓ |
| habitacionId | no | 2 Habitación | ✓ |
| modalidad (habitual/temporada/vacacional) | sí | 3 Tipo de contrato | ✓ |
| fechaInicio | sí | 4 Fecha inicio | ✓ |
| fechaFin | no (auto LAU) | 5 Fecha fin | ✓ |
| inquilinoNombre + inquilinoApellidos | sí | 6 Inquilino nombre completo | ✓ |
| inquilinoNif | sí | 7 DNI/NIF | ✓ |
| inquilinoEmail | sí | 8 Email | ✓ |
| inquilinoTelefono | sí | 9 Teléfono | ✓ |
| rentaMensual | sí | 10 Renta mensual € | ✓ |
| fianzaMensualidades | no | 11 Fianza € (importe) | ✓ (unidad distinta; cubierto) |
| **diaPago** | sí | — | **FALTA** → añadir opcional |
| **indexacion** (none/ipc/irav/otros) | no | — | **FALTA** → añadir opcional |
| **reducción IRPF** (`Contract.reduccion.porcentaje`) | — (modelo) | — | **FALTA** → añadir opcional |
| **cotitulares** (`inquilino.cotitulares`) | — (modelo) | — | **FALTA** → añadir opcional |

Columnas nuevas OPCIONALES a añadir (retrocompatible · obligatorias siguen siendo solo las mínimas): **Día de pago**, **Indexación**, **Reducción IRPF %**, **Cotitulares (NIFs)**.

## Decisiones de alcance

- Formato Rentila y su parser: **intactos** (prohibido).
- Lógica interna de revisión/mapeo (`PasoRevision`, `agruparPorSeccion`, fuzzy match): **intacta**.
- Formatos es-ES de número/fecha de plantillas: cubiertos por P7 del punto 2 → no se duplican.
- P3 se corrige **dentro del wizard** (sin tocar `DateLabel` global).
