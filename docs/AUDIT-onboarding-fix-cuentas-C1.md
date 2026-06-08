# AUDIT · onboarding FIX · PUNTO 4 · bloque cuentas (fusión con extractos) · C1

> Commit 1 · `chore(audit)` · SOLO grep/lectura · CERO código.
> Alcance · únicamente el bloque cuentas/vida-financiera de `/empezar`.
> Veredicto global · **VERDE · sin sorpresas · sin DB bump · sin refactor no trivial**.
> El modal de cuenta y la pantalla de sugerencias son recolocables tal cual.

## Tabla de hallazgos (los 7 greps de §2)

| # | Qué | Path:líneas | Hallazgo |
|---|-----|-------------|----------|
| 1 · P1 | Página-puente actual | `src/modules/onboarding/empezar/bloques/CuentasBloque.tsx:8-17` | `CuentasBloque` es un `EnlaceBloque` con `ctaTo="/tesoreria"` · te suelta en Tesorería sin volver ni marcar el bloque. Es el puente a eliminar. |
| 2 · P2 | Bloque vida-financiera + sugerencias | `src/modules/onboarding/empezar/bloques/FinanzasBloque.tsx` (pantalla doble vía) · `src/modules/onboarding/empezar/SugerenciasScreen.tsx` (pantalla de sugerencias) · ruta `sugerencias` en `EmpezarApp.tsx:38` · tarjeta en `bloquesConfig.tsx:57-64` · id `finanzas` en `onboardingProgressService.ts:27,64,73` | Bloque `finanzas` (no-núcleo, peso 1) + su pantalla de sugerencias. La sugerencias está intacta y es **recolocable sin rehacer** (componente de pantalla completa que ya vive dentro de `/empezar` y usa `useOnboarding`). |
| 3 · modal embebible | `<CuentaWizard>` | `src/components/cuenta/CuentaWizard.tsx:306-318` · ya montado en `TesoreriaV4.tsx:1423`, `tesoreria/tabs/VistaGeneralTab.tsx:314`, `configuracion/cuentas/components/AtlasBancosManagement.tsx:438` | **Modal autocontenido** (`open/onClose/onSuccess/editingAccount`). Sólo depende de `cuentasService`, `nominaService`, `initDB` y tokens v5 · **CERO acoplamiento a rutas de `/tesoreria`**. Se monta sobre el flujo sin refactor. |
| 4 · P3 fechas | Formateo saldo inicial vs default "A fecha" | `CuentaWizard.tsx:151-156` (`fmtFechaCorta`) · `:119` (`todayISO`) · `:244` (default `fechaSaldo: todayISO()`) · preview `:629` | `fmtFechaCorta` hace `new Date(iso)` con `iso = "YYYY-MM-DD"` → se parsea como **medianoche UTC** y al leer `getDate()/getMonth()` en TZ local cae al día anterior (off-by-one: campo "08/06/2026" vs preview "7 jun 2026"). El default de "A fecha" YA es HOY (`todayISO()`). **Mismo bug que P3** · reutilizar `toLocalDate` del fix de contratos (`NuevoContratoWizard.tsx`). |
| 5 · P4 openingBalance | Estado del bug | `src/modules/mi-plan/wizards/utils/getCurrentSaldoCuenta.ts:2-7` (comentario) · `src/services/fondosService.ts:26-46` (`getSaldoCuenta`) · `src/services/cuentasService.ts:386-411` (movimiento de apertura) | **VEREDICTO P4 · ARREGLADO (muerto).** `fondosService.getSaldoCuenta:31-42` ya NO devuelve `openingBalance` crudo · usa `calculateAccountBalanceAtDate` (cutoff = mañana). `cuentasService.create` crea el movimiento de apertura con el saldo guardado. El comentario `getCurrentSaldoCuenta.ts:2-7` ("está mal · no se arregla aquí") es **stale** · refleja el estado pre-deploy. Acción C2: actualizar el comentario + test de regresión (saldo guardado = saldo leído). |
| 6 · P5 progreso | % del bloque cuentas y los 8 bloques | `src/services/onboardingProgressService.ts:64-86` (`BLOQUES_ORDEN`, `PESO_TOTAL` derivado) · sync en `src/services/onboardingSyncService.ts:34-36` | El % es **derivado, no hardcodeado**: `PESO_TOTAL = Σ pesoBloque`. Hoy 8 bloques (4 núcleo×2 + 4 resto×1 = 12). Quitar `finanzas` (resto, peso 1) de `BLOQUES_ORDEN` → 7 bloques, total 11, **recalcula solo**. `cuentas` se marca `completado` en cuanto hay ≥1 cuenta (`onboardingSyncService.ts:34`). |
| 7 · subidor por cuenta | Invocación con `accountId` | `src/modules/horizon/tesoreria/import/BankStatementUploadPage.tsx:73-123,457-473` · orquestador `src/services/bankStatementOrchestrator.ts:31,110,311,382` | El subidor YA acepta `?accountId=N` (`preselectAccountId`, `:74-79,103-112`) y asocia movimientos a esa cuenta (`bankStatementOrchestrator` propaga `accountId` a `insertMovements:110` y a cada movimiento `:382`). El selector "Cuenta destino" (`:457-473`) muestra "No hay cuentas activas" sólo con 0 cuentas (P7). Falta: **prefijar Y bloquear** el selector cuando llega `?accountId` (hoy lo preselecciona pero deja editable). |

## Detalle por problema

- **P1 (puente):** `CuentasBloque` → reemplazar por una pantalla de gestión real (lista + modal sobre el flujo + acciones por cuenta). El `ctaTo="/tesoreria"` desaparece.
- **P2 (fusión):** borrar `FinanzasBloque.tsx`; quitar `finanzas` de `BLOQUES_ORDEN`, `NUCLEO_BLOQUES` (no está), `BloqueId`, `BLOQUES_META`. La pantalla de sugerencias (`SugerenciasScreen`) se recoloca como sección dentro del bloque cuentas (o se enlaza desde él) · contenido intacto.
- **P3 (fechas):** `toLocalDate` (regex `^(\d{4})-(\d{2})-(\d{2})$` → `new Date(y, m-1, d)`) ya existe en `NuevoContratoWizard.tsx` (fix P3). Replicar en `CuentaWizard.fmtFechaCorta`. Default "A fecha" ya es hoy.
- **P4 (openingBalance):** ya arreglado en runtime · sólo limpiar comentario stale + regresión.
- **P5 (cierre del bucle):** `syncNucleoFromData` marca `cuentas` con ≥1 cuenta. El nuevo bloque llama `refresh()` tras crear/editar para recalcular el %.
- **P6/P8/P9 (puentes fuera del flujo):** `FinanzasBloque` lleva a `/tesoreria/importar` (P6) y `/empezar/sugerencias` (huérfana, P9); "Declarar a mano" sólo hace toast + vuelve al hub (P8, vía fantasma). Todo eliminado en la fusión · la vía manual real será "saldo a mano" (modal) + "añadir recurrente a mano" (`/personal/gastos/nuevo?from=empezar`, ver abajo).
- **P7 (callejón sin salida):** muerto por construcción · "Subir extracto" nace de una fila de cuenta → `?accountId=N` siempre presente → selector prefijado y bloqueado.

## Piezas reutilizables confirmadas (sin refactor no trivial)

- `<CuentaWizard open onClose onSuccess editingAccount>` · modal alta/edición de cuenta · embebible.
- `BankStatementUploadPage` vía `/tesoreria/importar?accountId=N` · subidor por cuenta · sólo falta bloquear el selector + retorno `?from=empezar`.
- `SugerenciasScreen` · pantalla de sugerencias · ya dentro de `/empezar` · contenido intacto.
- Alta recurrente a mano · `NuevoGastoRecurrentePage` en ruta `/personal/gastos/nuevo` (`App.tsx:1229`) · crea `CompromisoRecurrente` · se enlazará con `?from=empezar` (patrón de contratos · `App.tsx` nested bajo `PersonalPage`).
- `toLocalDate` · utilidad de fecha del fix de PUNTO 3 (`NuevoContratoWizard.tsx`) · a replicar local en `CuentaWizard`.

## DB bump

**NO previsto y NO necesario.** No se crean stores ni campos. El estado del onboarding ya vive en `keyval` y `OnboardingState.cuentas` ya soporta la vía por cuenta (`onboardingProgressService.ts:32,42,194`).

## Veredicto

VERDE para C2. Sin sorpresas, sin DB bump, sin refactor no trivial. El modal de cuenta y la pantalla de sugerencias son recolocables tal cual.
