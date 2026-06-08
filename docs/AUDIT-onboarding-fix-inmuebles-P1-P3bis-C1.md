# AUDIT · FIX onboarding · PUNTO 2 · bloque inmuebles (re-validación Jose 07-06)

> Commit 1/3 · `chore(audit)` · solo grep · cero código.
> Contexto: el primer pase (PR #1412) ya está fusionado en la rama. Esta auditoría
> reconcilia el estado REAL con los problemas P1-P7 de la re-validación y acota el
> arreglo a lo que de verdad falta.

## §1 · Verificación por grep

| # | Qué se busca | path:líneas | Hallazgo |
|---|---|---|---|
| 1 | "Uno a uno" / vía manual | `InmueblesBloque.tsx:57-61` | Navega a `/inmuebles/nuevo?from=empezar`. `InmueblePage.tsx:261,764,774` ya reconoce `from=empezar` y vuelve a `/empezar/inmuebles` al guardar/cancelar. **PERO** no añade `?done=`, e `InmueblesBloque` **no tiene** manejador de cierre de bucle (compárese con `ContratosBloque.tsx:24-46`). → **GAP P1**. |
| 2 | Form modal vs acoplado a ruta | `App.tsx:807,1296` · `InmueblePage.tsx` | El form es la página real reutilizada vía ruta con `?from=empezar`; sin acoplamiento que exija refactor. Reutilización limpia, cero duplicación. |
| 3 | Revisión post-plantilla (P2) | `ImportarPlantillaWizard.tsx:47,106-137` · `InmueblesBloque.tsx:65-92` | Paso `revisar` (tabla válidas/incidencias) → `Crear N` antes de tocar nada. **EXISTE**. |
| 4 | Cierre del bucle / marca bloque (P3) | `onboardingSyncService.ts:28-30` · `OnboardingContext.tsx:36` | `syncNucleoFromData` marca `inmuebles` completado cuando hay ≥1 property y recalcula %. `refresh()` lo reejecuta. **EXISTE** (la vía plantilla cierra con `onCreated → refresh`; la vía manual no recala en hub → ver P1). |
| 5 | Pendiente "financiado sin préstamo" (P3.bis) | `onboardingAvisosService.ts:18-37` | Emite **una fila por inmueble**, **siempre** (sin latencia), deep-link a `/empezar/prestamos`. Contradice la corrección Jose (latente + resumido). → **GAP P3.bis**. |
| 6 | Plantilla espejo del form (P5) | `scripts/generate-onboarding-templates.cjs:97-159` · `inmueblesTemplateParserService.ts:58-89` | Plantilla generada con 21 columnas (tipo, m², habitaciones, baños, urbana/rústica, % propiedad, anexos, uso, por habitaciones, VC…), obligatorias solo alias/dirección + tipo, nota de mejoras/mobiliario excluidos. Parser mapea por nombre y tolera la plantilla vieja de 12 col. **HECHO**. |
| 7 | "rentabilidad" en onboarding (P6) | grep en `src/modules/onboarding`, `onboarding*Service`, `FotoActualWidget` | Cero apariciones (salvo el test guardián `sinRentabilidad.test.ts`). Los cálculos de rentabilidad viven en `horizon/informes` e `inversiones` (pre-existentes, **fuera** del onboarding, no se tocan). **HECHO**. |
| 8 | Formato es-ES en plantillas (P7) | `generate-onboarding-templates.cjs:23-44` · `inmueblesTemplateParserService.ts:136-145,232` | Fechas como celda Date real `dd/mm/yyyy`; importes numéricos. Parser acepta celda nativa, `DD/MM/AAAA` e ISO legacy; números con coma decimal y punto de miles. Aplica también a contratos/préstamos/inversiones. **HECHO**. |

## §1.bis · Veredicto P2 / P3

- **P2 (revisión antes de crear):** EXISTE · `ImportarPlantillaWizard` paso `revisar`.
- **P3 (cierre del bucle / marca bloque):** EXISTE · `syncNucleoFromData`; el % sube. El sub-pendiente de vinculación NO cumple aún la corrección Jose (latente + resumido) → P3.bis.

## §2 · Acotación del arreglo (commit 2)

Tras la fusión de #1412, **solo quedan dos deltas reales** de la re-validación:

1. **P1 · la vía manual cierra el bucle.** `InmueblePage` añade `?done=inmueble` al volver
   a `/empezar/inmuebles` tras guardar con éxito (cancelar sigue sin `done`).
   `InmueblesBloque` adopta el patrón de `ContratosBloque`: al detectar `done` →
   `refresh()` (marca bloque + sube %) → toast → vuelve al mapa (`/empezar/hub`).

2. **P3.bis · aviso latente y resumido.** `onboardingAvisosService` deja de emitir una
   fila por inmueble y pasa a una **única línea** "N inmuebles financiados pendientes de
   vincular préstamo" que **solo aparece** cuando hay ≥1 préstamo en el sistema o el
   bloque préstamos está completado. Deep-link a la vista de vinculación (`/empezar/prestamos`).

El resto (P2, P4, P5, P6, P7 y la marca de bloque de P3) ya está cumplido en la rama y
**no se toca**, para mantener el diff sin nada fuera de alcance.
