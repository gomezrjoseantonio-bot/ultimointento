# AUDIT · FIX onboarding · PUNTO 7 · bloque inversiones

> Commit 1 · `chore(audit)` · solo grep · cero código. Verificación §1 de la tarea (PUNTO 7).

## Qué hace cada vía hoy

| Vía | Acción actual · path:líneas | Veredicto |
|---|---|---|
| Plantilla (lote) | `InversionesBloque.tsx:58` → toggle `mostrarPlantilla` · `ImportarPlantillaWizard` inline (`:71-82`). Al crear llama `onCreated → refresh()` y muestra resumen inline. **NO saca del flujo.** | OK de base · pero `refresh()` NO marcaba `inversiones` (ver P2). |
| Una a una | `InversionesBloque.tsx:67` → `navigate('/inversiones')` (galería completa · sin `from`). | **P1 confirmado** · aterriza en `/inversiones` sin selector, sin marcar, sin volver. |
| Importadores broker | `SelectorNuevaPosicion.tsx:86-96` → `navigate('/inversiones/importar-indexa')` / `'/inversiones/importar-aportaciones')`. Wrappers (`ImportarIndexaCapitalPage.tsx` · `ImportarAportacionesPage.tsx`) vuelven SIEMPRE a `/inversiones`. | **P1 confirmado** · no conocen `from=empezar`. |

## ¿El modal "Nueva posición" es embebible o acoplado?

**Acoplado a `/inversiones`.** El selector de 6 familias (`SelectorNuevaPosicion.tsx`) y los 6 modales de alta (`AltaPlanWizard`, `AltaFondoModal`, `AltaAccionModal`, `AltaPrestamoModal`, `AltaDepositoModal`, `AltaCryptoModal`) se montan DENTRO de `InversionesGaleria.tsx` (`:273-305`), que es una página completa con migraciones (`migrateInversionesToNewModel` `:90`), carga de cartera y `CintaResumen` montada desde `MainLayout`. Reescribir como embebido = no trivial. → Aplica el patrón `?from=empezar` (preferencia confirmada por acoplamiento · igual que PUNTO 2 inmuebles). **El modal NO se reescribe · solo aprende a volver al flujo.**

## P2 · progreso del bloque

`onboardingProgressService.ts:32,75` declara el bloque `inversiones` (resto · peso 1). **Pero `onboardingSyncService.syncNucleoFromData` NO lo marca** (`:14-37` solo persona/inmuebles/contratos/cuentas). `refresh()` (OnboardingContext `:36`) llama a ese sync → **crear posiciones nunca marca el bloque ni sube el %.** Raíz de P2 (afecta a AMBAS vías, incluida la plantilla).

## P3 · plantilla vs modal

- **Plantilla actual** (binario `public/templates/plantilla-inversiones-atlas.xlsx` · verificado): **7 columnas** · `Tipo (fondo/accion/etf/crypto/plan_pensiones/deposito/otro) · Entidad · Producto · Unidades · Coste adquisición € · Fecha compra · Valor de hoy €`. Fecha = celda serial Excel con display `10/03/2022` → **DD/MM/AAAA ya correcto** (lo arregló PUNTO 2 vía el generador compartido). El parser (`inversionesTemplateParserService.ts`) lee por ÍNDICE fijo (7 cols).
- **Modal** = 6 familias (`SelectorNuevaPosicion.tsx:41-78`): plan_pensiones (PPI·PPE·PPES·PPA) · fondo · acción/ETF/REIT · préstamo (P2P·empresa) · depósito/cuenta · crypto. Campos propios detectados: **ISIN/ticker** (`AltaFondoModal:129` · `AltaAccionModal:185,198`), **% atribución** (participaciones CB/sociedades · card `InversionesBloque:65`), **TAE/TIN + plazo (meses)** (`AltaDepositoModal:222,237` · `AltaPrestamoModal:264,278`).
- **Veredicto P3**: la plantilla NO es espejo · faltan familias (plan_pensiones · prestamo_activo · deposito_cuenta) y campos propios (ISIN · % atribución · TAE · plazo). Fecha es-ES ya OK · resto pendiente. → §2.2.

## P4 · préstamo-activo vs préstamo-deuda · veredicto

**SEPARADOS · sin cruce.** El "Préstamo · P2P o a empresa" del modal de inversiones (`AltaPrestamoModal.tsx:146`) guarda `tipo: 'prestamo_p2p'` vía `onSave → handleSavePosicion → inversionesService.createPosicion` → store **`inversiones`**. La deuda (lo que el usuario DEBE) vive en store **`prestamos`** (`db.ts:2362` · keyPath `id` · V63). No hay ruta del onboarding que mande un préstamo-activo al store `prestamos` ni que genere pendiente de vinculación de inmueble para estos. → Solo verificar y no agravar (§2.4). El arreglo de fondo del módulo (si lo hubiera) queda fuera de alcance.

## Veredicto de STOP

**No procede STOP.** El selector/modal está acoplado a su ruta (caso para el que la spec autoriza el fallback `?from=empezar`) y P4 ya está bien separado de base. No hay decisión que requiera a Jose · la spec fija el enfoque. Procedo a commits 2-3.
