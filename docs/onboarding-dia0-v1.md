# Onboarding día 0 · alta guiada de la foto actual (hueco 5.1)

> Estado · implementado (PR `feat(onboarding): día 0`). Mockup vinculante ·
> `docs/mockups/atlas-onboarding-dia0-v4.html` (11 pantallas). Canónico ·
> `docs/ATLAS-PRESENTE-FUTURO-v1.md`. Audit C1 · `docs/AUDIT-onboarding-dia0-C1-2026-06-07.md`.

## Qué es

La puerta de entrada presente-futuro: el cliente cuenta su **foto actual** (lo que
tiene hoy · quién le paga hoy · qué debe hoy) y ATLAS genera su año previsto. Solo
PRESENTE · NO pregunta por arrastres ni amortización acumulada (frutos del pasado).

Ruta nueva `/empezar` · a pantalla completa (sin `MainLayout`) · reentrante · el
progreso vive en `keyval` y sobrevive a salir/volver y a recargar. Coexiste con el
`/onboarding` legacy (decisión Jose D2).

## Arquitectura

### Modelo (V79)
- `Property.estructuraCompra?` · campo RAÍZ nuevo (decisión Jose D1/D-estructura) ·
  `{ aportacionPropia?, importeFinanciado?, prestamoVinculadoId?: string }`. NO se
  anida en `aeatAmortization` (objeto fiscal del pasado · §1). El precio/gastos
  siguen en `acquisitionCosts`.
- Estado en `keyval['onboarding_v1']` (progreso por bloque) y
  `keyval['onboarding_v1_descartes']` (decisiones). Sin store nuevo.

### Servicios (`src/services/`)
| Servicio | Rol |
|---|---|
| `onboardingProgressService` | Estado + progreso (% con núcleo ponderado doble) + descartes |
| `onboardingSyncService` | Marca núcleo completado desde la realidad de los stores (reentrante) |
| `onboardingDetectionService` | Motor v1 · orquesta `compromisoDetectionService` (recurrentes) + detectores NUEVOS de préstamo y nómina |
| `onboardingRevealService` | Datos del reveal (bootstrap + agregación + IRPF + SVG) |
| `{inmuebles,prestamos,inversiones}TemplateParserService` | Parsers de las 3 plantillas Excel nuevas |
| `{inmuebles,prestamos,inversiones}ImportCreationService` | Creación con revisión antes de crear |

### UI (`src/modules/onboarding/empezar/`)
- `EmpezarApp` · router interno (welcome · hub · sugerencias · reveal · `:bloqueId`).
- `OnboardingContext` · estado + progreso compartidos.
- Pantallas 01-11 fieles al mockup · CSS portado con tokens `--atlas-v5-*`.
- Widget Panel · `src/modules/panel/components/FotoActualWidget`.

## Reutilización (orquestar lo que existe · §0.1.6)
- Contratos · `ImportarContratosWizard` + `NuevoContratoWizard` (sin cambios).
- Cuentas · `/tesoreria` · Persona · `/ajustes/perfil`.
- Recurrentes · `compromisoDetectionService` + `createCompromisosFromCandidatos`.
- Previsiones · `treasuryBootstrapService` (NO los deprecados `*TreasuryCreationService`).
- IRPF · `estimacionFiscalEnCursoService`. Préstamos · `prestamosService`.
  Inversiones · `inversionesService` + `valoracionesService.upsertByDate`.

## Plantillas Excel
Generadas por `scripts/generate-onboarding-templates.cjs` →
`public/templates/plantilla-{inmuebles,prestamos,inversiones}-atlas.xlsx`. Patrón
idéntico al de contratos (header + ejemplo · parser + revisión + multi-fila).

## Decisiones de Jose registradas
- **D1** · `prestamoVinculadoId` es `string` (uuid · `Prestamo.id`), no number.
- **D2** · `/onboarding` legacy y `/empezar` coexisten.
- **Estructura de compra** · campo raíz `Property.estructuraCompra` (no en `aeatAmortization`).
- **D4** · pre-relleno nómina/préstamo · el banner muestra los valores detectados y
  "Completar" abre el wizard existente con el prefill en route-state · sin tocar los
  wizards de forma no trivial.

## Reglas inviolables cumplidas
- Día 0 SOLO presente · cero preguntas de arrastres/amortización acumulada.
- La detección NUNCA crea sola · siempre propone → el usuario confirma/descarta.
- Doble vía en cada bloque (manual + importación/aceleración · combinables).
- Reentrante · semáforo permanente en Panel hasta el 100%.
- Cero stores nuevos · cero servicios deprecados · cero toques al pasado.

## Tests
`onboardingProgressService`, `dbV79OnboardingMigration`, `fondosServiceSaldoCuenta`
(fix openingBalance), `inmueblesTemplate`, `onboardingDetectionService`,
`prestamosTemplate`, `inversionesTemplate`, `onboardingRevealService`,
`onboardingFlow.e2e`.
