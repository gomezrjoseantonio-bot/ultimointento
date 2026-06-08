# AUDIT · FIX onboarding · PUNTO 1 · bloque persona + puerta de entrada

> Commit 1 · `chore(audit)` · solo grep · cero código. Resultado de la verificación §1 de `docs/specs/TAREA-CC-onboarding-dia0-v1.md`.

## Tabla de hallazgos

| # | Verificación | Resultado · path:líneas | Causa / implicación |
|---|---|---|---|
| 1 | Componente y store del form **"Perfil fiscal y convivencia"** | `src/modules/ajustes/pages/PerfilFiscalPage.tsx` (186 líneas) | **MOCKUP estático**. Sin import de servicio · sin `initDB` · un único `useState` (toggle pareja). Inputs `SetRow` de solo lectura. "Guardar cambios" → `onClick={() => showToastV5('Datos guardados…')}` · **NO persiste nada**. |
| 2 | Página-puente `/empezar/persona` | `src/modules/onboarding/empezar/bloques/PersonaBloque.tsx:8-17` | Es un `EnlaceBloque` con `ctaTo="/ajustes/perfil"` · saca del flujo (P2 confirmado). |
| 2b | El puente apunta al perfil equivocado | `PersonaBloque.tsx:14` → `/ajustes/perfil` | `/ajustes/perfil` = `PerfilPage` (perfil de **CUENTA**), NO el fiscal (`/ajustes/fiscal`). P3 confirmado. |
| 3 | Redirect primer uso | `src/modules/onboarding/empezar/FirstRunRedirect.tsx` · montado en `App.tsx:705-708` (índice `/`) | **El componente EXISTE y su lógica es correcta** (sin properties/accounts/contracts y sin progreso → `/empezar`). `LoginPage.tsx:23` navega a `/`. Ver "P1 · causa" abajo. |
| 4 | Origen "Usuario Demo" + guardado roto del perfil cuenta | `PerfilPage.tsx:13` (`user?.email ?? 'demo@atlas.com'`) · `mockAuthService.ts:30-36` (`name: 'Usuario Demo'`, `id: 'demo-user-1'`) | `PerfilPage` también es **MOCKUP**: inputs `defaultValue` (no controlados) · "Guardar cambios" → solo toast · nombre/email del usuario mock por defecto. P4 confirmado. |
| 5 | API de completado de bloque | `onboardingProgressService` · `setBloqueEstado(bloque, 'completado')` · `BLOQUES_ORDEN`, `computeProgress`, `getOnboardingState` | OK · firma disponible y ya usada por el resto de bloques. |

## El store REAL de datos fiscales (hallazgo clave)

Existe una capa de persistencia real para los datos del contribuyente, **pero ninguna de las dos páginas de perfil está conectada a ella**:

- Store `personalData` · `db.ts:2942` (keyPath `id`, autoIncrement) + `personalModuleConfig` · `db.ts:2948`.
- Servicio `personalDataService` · `getPersonalData()` (`:22`) · `savePersonalData()` (`:38`).
- Tipo `PersonalData` (`src/types/personal.ts`) · `nombre` · `situacionPersonal` · `comunidadAutonoma` · `descendientes` · `discapacidad`… → exactamente la foto fiscal.
- **Lo leen** ≥12 sitios reales (IRPF estimado, Personal, inmuebles, inversiones…).
- **Lo escribe SOLO** `personalOnboardingService.ejecutarOnboardingPersonal`, invocado únicamente desde el import de la declaración AEAT (`declaracionOnboardingService.ts:744`, `declaracionDistributorService.ts:430`). **No hay NINGÚN formulario interactivo que escriba `personalData`.**

## P1 · por qué el redirect "no funciona"

La maquinaria es correcta. El primer uso no aterriza en `/empezar` no por un bug del redirect sino porque, en la práctica, `FirstRunRedirect` solo corre en el índice `/` y decide `panel` si **ya hay datos o progreso**. Candidatos de causa real (a confirmar con Jose · no investigado a fondo para no salir de scope):
- Datos demo/seed preexistentes (properties/accounts) → `hasData=true` → Panel.
- Entrada a la app por una ruta distinta de `/` (PWA `start_url`, bookmark, `*`→`/panel`).

No requiere reescribir el redirect · a lo sumo endurecer el punto de entrada. **Pendiente de confirmar la causa con Jose antes de tocar.**

## STOP · por qué paro aquí (regla del spec)

La premisa de los commits 2-3 era: *"reutilizar el componente REAL de Perfil fiscal y escribir en el mismo store que ya usa"* (§2.1/§2.2). **Esa premisa es falsa**: el componente "Perfil fiscal y convivencia" es un mockup que no persiste, y no existe ningún formulario real que escriba el store fiscal (`personalData`). Por tanto:

- No hay "componente real reutilizable" que embeber.
- No hay "mismo store que usa Ajustes" porque Ajustes no escribe ningún store.
- Cumplir §2.2 ("una sola fuente · dos puertas coherentes") obliga a decidir si además se arregla la página de Ajustes (fuera del literal "SOLO el bloque persona").

Esto es exactamente el supuesto que el spec marca como **STOP y reportar opciones**. No escribo código de fix hasta que Jose elija enfoque.
