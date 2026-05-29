# Wizard de importación XML AEAT V2 · arquitectura

> Implementado en la PR "feat(import-xml): wizard de importación V2 · 10 pasos · DB v77".
> Referencia visual vinculante: `docs/mockups/atlas-wizard-import-mockup-completo-v1.html`
> y `docs/mockups/MOCKUP-wizard-import-paso2-v3.html`.

## 1 · Visión general

El wizard guía la importación de una o varias declaraciones IRPF (XML Modelo 100)
en 10 pasos. Puebla automáticamente toda la verdad fiscal del XML (Fase A) y solo
pregunta lo que el cliente tiene fresco (opt-in de Fase B). Los datos del XML son
verdad consumada: ATLAS no recalcula ni juzga.

## 2 · Componentes

`src/components/onboarding/import-declaracion/`

| Fichero | Rol |
|---|---|
| `WizardImportarDeclaracion.tsx` | Componente raíz · modal fullscreen o embebido · header + stepper de 10 píldoras + body + footer + aside navy. |
| `WizardImportarDeclaracion.module.css` | Estilos · réplica del mockup · mapea nombres del mockup a tokens `--atlas-v5-*` (Oxford Gold). Cero hex de marca hardcoded. |
| `useWizardImportState.ts` | Estado compartido · declaraciones multi-ejercicio, paso actual, `OpcionesDistribucion`, validaciones · aplicabilidad condicional de pasos · `importar()` multi-año. |
| `useInmueblesDetectados.ts` | Clasifica inmuebles del XML en nuevos/existentes/accesorios (cruza con `properties`) + sugerencias de pre-relleno V77. |
| `deteccion.ts` | Helpers puros · `detectarProveedores`, `detectarPlanesXml`. |
| `prefill.ts` | Sugerencias + builders de payloads válidos (`construirNominaPrefill`, `construirAutonomoPrefill`). |
| `AsideResumen.tsx` | Aside navy con resumen vivo · contenido por paso. |
| `pasos/Paso*.tsx` | Un componente por paso (1-10). |

`src/constants/retaTramos.ts` · tabla RETA 2024 (15 tramos) + `sugerirTramoReta`.
⚠️ Cifras **best-effort**, pendientes de verificación contra la tabla oficial.

## 3 · Los 10 pasos

| # | Paso | Condicional | Output a opciones |
|---|---|---|---|
| 1 | Fuente | siempre | parsea XMLs → `declaraciones` |
| 2 | Inmuebles | si hay inmuebles | `inmueblesPrefill` (mapeo V77) |
| 3 | IBAN | si hay cuenta | `ibanAcciones` |
| 4 | Proveedores | si hay NIFs en gastos | — (informativo) |
| 5 | Planes pensiones | si hay aportaciones | — (+ fusión 1-click) |
| 6 | Nómina | si `RdtoTrabajo > 0` | `crearNominaActiva` + `nominaPrefill` |
| 7 | Autónomos | si hay actividad | `crearActividadAutonoma` + `autonomoPrefill` |
| 8 | Ventas | si hay transmisión inmueble | `ventasConfirmadas` |
| 9 | Personales | siempre | `conyugeAnadirPersonal` |
| 10 | Confirmar | siempre | invoca `distribuirDeclaracion` |

Los pasos no aplicables se muestran en el stepper en estado `skipped` (dashed) y la
navegación los salta automáticamente.

## 4 · Distribuidor · Fase A / Fase B

`src/services/declaracionDistributorService.ts`

`distribuirDeclaracion(decl, opciones = OPCIONES_DEFAULT)`:

- **Fase A · siempre**: ejercicio fiscal, inmuebles (+ `inmueblesPrefill`), contratos
  `sin_identificar`, FiscalSummaries, mejoras, proveedores (placeholder `sinNombre`),
  mobiliario, IBAN (`ibanAcciones`; vacío = legacy), vínculos accesorio, personalData,
  plan de pensiones.
- **Fase B · opt-in**: nómina (`nominaService.saveNomina`), autónomo
  (`autonomoService.saveAutonomo`), ventas (`confirmPropertySale`), cónyuge. El
  `personalDataId` se resuelve en Fase B (el prefill lo deja a 0).

`OPCIONES_DEFAULT` preserva el comportamiento legacy: `distribuirDeclaracion(decl)`
produce el mismo resultado que antes (sin `faseB` en el informe).

### Contrato UI ↔ distribuidor

`src/types/opcionesDistribucion.ts` define `OpcionesDistribucion` y los `*Prefill`,
que **son los payloads de los servicios destino** (la UI los construye, el
distribuidor delega). Así el distribuidor no inventa mapeos de campos.

## 5 · Multi-ejercicio

`planificarImportacion(declaraciones, opciones)` (en `useWizardImportState.ts`):
orden cronológico ascendente (el reciente gana al pisar), Fase A por cada año, y los
opt-in que crean entidades únicas (nómina/autónomo/ventas/cónyuge) **solo en la
última llamada**; IBAN y prefill de inmuebles se aplican en todas (idempotentes).

## 6 · Schema V77

`Property` (mapeo sobre campos existentes, no duplicación):
- `subtipoVivienda?` · tipología que `tipoActivo` no captura.
- `anexos.plazasParking?` · nº plazas (antes solo bool).
- `explotacion?.{estadoOperativo, unidadesArrendables}` · únicos conceptos nuevos
  (`modoExplotacion` → `alquilerPorHabitaciones`, `tipoAlquilerDominante` → `usoTipo`,
  `esAlquilable` derivable de `usoTipo`).

`Proveedor.sinNombre?` · placeholder sin nombre (badge UI). Migración suave · sin
cambios de stores/índices. Los 5 stores fiscales (`snapshotsDeclaracion`,
`resultadosEjercicio`, `arrastresIRPF`, `aeatCarryForwards`,
`perdidasPatrimonialesAhorro`) **NO se eliminan**: tienen lectores/escritores vivos.

## 7 · Enrutado

El wizard V2 reemplaza el path **XML** del importador legacy
(`ImportarDeclaracionWizard`):
- `src/modules/fiscal/import/ImportarFiscalPage.tsx` (ruta `/fiscal/importar/:anio`).
- Rama `xml` de `src/modules/horizon/fiscalidad/historial/ImportarDatosWizard.tsx`.

El legacy se conserva para **PDF / manual / capturas** (pilar 11 · foco aparte).
Props de integración: `embedded`, `initialFiles`, `onBack`, `onImported`.

## 8 · Apuntes pendientes (foco aparte / fix de Jose)

- Tabla RETA 2024 · verificar cifras oficiales.
- `planesPensionesService.eliminarPlan` lee store inexistente `valoraciones_historicas`
  (bug latente · `fusionarDuplicados` lo evita borrando directamente).
- Cónyuge · `DeclaracionCompleta.declarante` no expone identidad del cónyuge.
- Paso 8 Ventas · transmisión de inmueble no expuesta a nivel de inmueble
  (vive en `gananciasPerdidas`) · detección fina diferida.
- IBAN `vincular` · best-effort (`UpdateAccountData` no expone `iban`).
- Pilar 6 Alquileres y pilar 11 Datos fiscales (capturas) · NO tocados.
