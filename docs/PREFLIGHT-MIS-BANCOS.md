# PREFLIGHT · TAREA CC "Mis Bancos" (switch + gráfico diario + limpieza)

> **Tipo** · Solo lectura · cero cambios de código · cero cambios de `DB_VERSION`
> **Base auditada** · `main` @ `e85dfcc` ("fix(tesorería): P7 · pasada retroactiva de clasificación a apuntes conciliados" · PR #1757)
> **Rama** · `claude/mis-bancos-preflight`
> **Fecha** · 2026-08-20

Este documento responde a los 7 puntos del preflight (sección 1 del spec) y **reporta 3 desajustes** con lo que el spec da por supuesto. Según la regla del propio spec ("Si algo de 1–7 no cuadra con este spec, CC para aquí y lo reporta"), **no se ha tocado código y la Fase 1 no ha comenzado**.

---

## ⚠️ DESAJUSTES · hay que resolverlos antes de la Fase 1

### D1 · El mockup de referencia NO ha llegado (bloquea la Fase 3, condiciona la 1)

El spec cita `atlas-bancos-grafico-v5.html` como "**Mockup de referencia visual y de interacción**" y lo marca como "(adjunto)". **No está adjunto** (el único fichero recibido es el `.md` de la tarea) y **no existe en el repo**:

```
$ find . -name "atlas-bancos-grafico*" -not -path "./node_modules/*"
(0 resultados)

$ ls docs/mockups/ | grep -i banco
(0 resultados)
```

Lo que sí hay en `docs/mockups/` es el linaje anterior: `atlas-tesoreria-v6-escritorio.html`, `atlas-tesoreria-v6-movil.html`, `atlas-tesoreria-v8-completo.html` — ninguno contiene la pieza "Mis Bancos" ni el gráfico diario por cuenta.

**Impacto**: la Fase 3 depende del mockup para proporciones del gráfico, alturas, tira fina y estados de la fila navy. El spec da los tokens de color y la estructura de series, pero no las medidas ni el layout exacto. La Fase 1 (switch + "+ Añadir" contextual) es reconstruible del texto, pero el switch quedaría a mi criterio visual.

**Qué necesito**: el HTML del mockup (adjuntarlo o dejarlo en `docs/mockups/`). Si prefieres que tire solo del texto del spec + guía V5, dilo explícitamente y lo hago, asumiendo que el resultado visual puede no coincidir con lo que tienes en la cabeza.

### D2 · Las dos auditorías que el spec cita no están donde dice (una ni siquiera en `main`)

El spec se apoya en `docs/audit-inputs/AUDITORIA-TESORERIA-actual.md` y `docs/audit-inputs/AUDITORIA-DRAWER-CUENTA-actual.md`. Realidad:

| Documento | Dónde está de verdad |
|---|---|
| `AUDITORIA-TESORERIA-actual.md` | En **`docs/`**, no en `docs/audit-inputs/` |
| `AUDITORIA-DRAWER-CUENTA-actual.md` | **No está en `main`** · vive en el PR **#1756**, abierto y sin mergear, y también en `docs/` |

No bloquea: he trabajado con el contenido real de ambas (la del drawer la escribí yo en #1756). Pero conviene saber que **#1756 sigue pendiente de tu revisión y merge**, y que ninguna ruta `docs/audit-inputs/AUDITORIA-*` existe hoy.

### D3 · La base ha avanzado: el spec dice #1755, `main` va por #1757

El spec fija como base "producción actual de `/tesoreria` (V9, PR #1755 ya en main)". `main` está dos commits por delante:

- `3bebcf2` — Modelo de tesorería + arreglos de flujo, clasificación, hipoteca y extractos largos (#1753)
- `e85dfcc` — P7 · pasada retroactiva de clasificación a apuntes conciliados (#1757)

**No afecta al alcance**: el diff `d3daaae..e85dfcc` sobre `src/modules/tesoreria/v6/` toca `DrawerExtracto.tsx`, `extractoSesion.ts`, `fichaDesdeItem.ts` y añade `LineaExtractoItem.tsx`; `TesoreriaV6Page.tsx` solo suma 5 líneas y **`TablaCuentas.tsx`, `TarjetasCard.tsx`, `CerrarElMes.tsx` y `tesoreriaV6Metrics.ts` no cambian**. He auditado sobre `e85dfcc`, que es lo vigente.

---

## 1 · `DB_VERSION`

`export const DB_VERSION = 89` · `src/services/db.ts:56` (`DB_NAME = 'AtlasHorizonDB'` · `src/services/db.ts:55`).

**Esta tarea NO lo cambia**: las tres fases son UI más una agregación pura derivada de `treasuryEvents`. Sin stores nuevos, sin índices, sin migración.

## 2 · Componentes reales de la zona de cuentas y tarjetas

| Pieza en pantalla | Componente · ruta | Se monta en |
|---|---|---|
| Página (escritorio) | `TesoreriaV6Page` · `src/modules/tesoreria/v6/TesoreriaV6Page.tsx:101` | ruta `/tesoreria` (`src/App.tsx`) |
| Héroe + línea 30 días | `HeroTesoreria` + `GraficoTreintaDias` · `HeroTesoreria.tsx`, `GraficoTreintaDias.tsx:63` | `TesoreriaV6Page.tsx:855-861` |
| **Tabla "Mis cuentas"** | `TablaCuentas` · `TablaCuentas.tsx:58` (título literal en `:136`) | `TesoreriaV6Page.tsx:885-894` |
| **Card "Mis tarjetas"** | `TarjetasCard` · `TarjetasCard.tsx:44` | `TesoreriaV6Page.tsx:902-908` |
| **Card "Cerrar el mes"** | `CerrarElMes` · `CerrarElMes.tsx:50` | `TesoreriaV6Page.tsx:913` |
| **Card "Cómo va {mes}"** | `CardV5` + `BloqueRealidad` (subcomponente local) · `TesoreriaV6Page.tsx:916-922` y `:1128` | `TesoreriaV6Page.tsx:916-922` |
| Fila de 3 cards inferior | `div.row3` · `TesoreriaV6Page.tsx:900` (estilos `TesoreriaV6Page.module.css`) | — |

Las tres cards inferiores viven en el mismo contenedor `styles.row3`: al retirar dos (Fase 2) y mover tarjetas arriba (Fase 1), **ese contenedor se queda vacío** y desaparece también.

## 3 · Cómo se abre hoy el drawer de cuenta

**Por los dos caminos**, y ambos llaman al mismo handler:

1. **Click (o Enter/Espacio) en la fila** → `onClick={() => onAbrir(f.cuenta)}` · `TablaCuentas.tsx:166` (teclado en `:167-172`).
2. **Menú ⋯ → "Confirmar movimientos"** → `onAbrir(f.cuenta)` · `TablaCuentas.tsx:224`.

La página cablea `onAbrir={(c) => abrirCuenta(c.id!)}` (`TesoreriaV6Page.tsx:889`), y `abrirCuenta` **navega**: `navigate('/tesoreria/cuenta/${id}')` (`TesoreriaV6Page.tsx:133`). El estado abierto/cerrado del drawer **vive en la URL**, no en un `useState` (`TesoreriaV6Page.tsx:129-141`; ruta en `src/App.tsx:944`).

El kebab **no comparte trigger** con el click de fila: su botón hace `e.stopPropagation()` (`TablaCuentas.tsx:215-218`) y el contenedor del menú también (`:223`). Es decir, **la Fase 3.1 es viable sin desenredar nada**: basta cambiar el `onClick` de `<tr>` para que seleccione en vez de navegar, y dejar el ítem del kebab llamando a `onAbrir` como hoy.

⚠️ **Consecuencia a decidir en F3**: al separar *seleccionar* de *abrir*, aparecen **dos estados distintos** — "qué cuenta está seleccionada" (nuevo, local, pinta el gráfico) y "qué cuenta tiene el drawer abierto" (la URL). El deep-link `/tesoreria/cuenta/:id` seguirá abriendo el drawer; queda por decidir si además **selecciona** esa cuenta en la tabla. Mi recomendación: que sí, para que al cerrar el drawer el gráfico visible sea el de la cuenta que se estaba tocando.

## 4 · El menú ⋯ por fila — confirmado, ya existe con los tres ítems

`TablaCuentas.tsx:211-239`:

- Botón kebab · `:212-220` (`aria-label="Acciones de {nombre}"`, con `stopPropagation`)
- **"Confirmar movimientos"** → `onAbrir(f.cuenta)` · `:224-226`
- **"Editar cuenta"** → `onEditar(f.cuenta)` · `:227-229`
- separador `:230` + **"Eliminar cuenta"** → `onEliminar(f.cuenta)` · `:231-237`

Cableado en `TesoreriaV6Page.tsx:889-891`: editar abre `CuentaWizard` (`setFichaCuenta`), eliminar abre la confirmación de baja (`setBajaCuenta` → `darDeBajaCuenta`).

## 5 · `treasuryEvents` · de dónde sale la serie diaria por cuenta

**Campos disponibles** (`src/services/db/types-movimientos.ts`):

| Necesidad | Campo | Evidencia |
|---|---|---|
| Cuenta | `accountId?: number` | `types-movimientos.ts:282` |
| Fecha prevista | `predictedDate` | usado en toda la capa (`tesoreriaV6Metrics.ts:87`) |
| Fecha real | `actualDate` | `types-movimientos.ts:301` |
| Importe + dirección | `amount` + `type` (`income`/`expense`/…) | magnitud por `Math.abs`, signo por `type` · `tesoreriaV6Metrics.ts:53-56` |
| Importe real al confirmar | `actualAmount` | `types-movimientos.ts:302` |
| Estado | `status: 'predicted' \| 'confirmed' \| 'executed'` | `types-movimientos.ts:286` |
| Descartado | `descartado?: boolean` (+ `descartadoAt`, `motivoDescarte`) · desde V84 | `types-movimientos.ts:287-300` |

**De dónde salen HOY los KPIs por cuenta** (Saldo hoy · Queda entrar · Queda salir · Cierre) — es la fuente a reutilizar:

- Reparto de eventos y movimientos por cuenta: `porCuenta` · `TesoreriaV6Page.tsx:311-326`.
- **Saldo hoy**: `calculateAccountBalanceAtDate({ ..., cutoffDate: corteParaSaldoVivo(hoy), incluirRealesFuturos: true })` · `TesoreriaV6Page.tsx:328-347` (`src/services/accountBalanceService.ts`).
- **Queda entrar / Queda salir / Cierre**: `cierrePorCuenta({ saldoHoy, eventos, year, month0 })` · `src/services/tesoreriaV6Metrics.ts:331-354`, invocado en `TesoreriaV6Page.tsx:404`.
- El filtro canónico de "pendiente que cuenta": `pendienteDelMes` = `esPendiente(e)` **&&** no traspaso interno **&&** fecha dentro del mes · `tesoreriaV6Metrics.ts:86-87`. Y `esPendiente` ya excluye **descartados** y las piezas `gasto_tarjeta`, y acepta `predicted|confirmed` · `tesoreriaV6Metrics.ts:64-72`.

**Conclusión para `serieDiariaCuenta(cuentaId, año, mes)`**: se puede escribir como función **pura** en `tesoreriaV6Metrics.ts`, junto a `cierrePorCuenta`, reutilizando `rangoDelMes`, `esPendiente`, `esTraspasoInterno` e `importeConSigno`. Sin store nuevo. Dos matices que hay que cerrar contigo antes de codificar la F3:

1. **"Confirmado" en el gráfico ≠ `status === 'confirmed'`.** En este modelo, un evento `confirmed` es "decidido pero aún no ocurrido" (espera al banco), y lo que de verdad ya pasó es `status === 'executed'`, que genera un `Movement` (`treasuryConfirmationService.ts:497-513`). El dinero realmente ingresado/pagado del mes está en **`movements`**, no en los eventos. Si el gráfico debe decir "Ingresado / Pagado" (dinero que ya se movió), la serie tiene que leer **`treasuryEvents` para lo pendiente + `movements` para lo confirmado/conciliado** — que es exactamente lo que ya hace la card "Cómo va {mes}" (`calcularRealidad`, `tesoreriaV6Metrics.ts:535`). El spec dice "lee los `treasuryEvents` de esa cuenta en el mes"; con solo eventos, las barras sólidas saldrían casi siempre vacías. **Necesito tu confirmación** de cuál de las dos lecturas quieres.
2. **Traspasos internos**: los KPIs de la fila los excluyen (`pendienteDelMes`), pero sí mueven la cuenta de verdad. Si el gráfico los incluye, no cuadrará con la fila; si los excluye, un traspaso grande no se verá. Recomiendo **excluirlos**, para que gráfico y fila cuenten lo mismo, y decirlo en la leyenda.

## 6 · `cierreDeMes` y "Cómo va {mes}" · qué es UI muerta y qué NO se puede tocar

### `cierreDeMes` — la lógica **NO** es exclusiva de la card. No se toca.

```
$ grep -rn "cierreDeMes\|CerrarElMes" --include=*.ts --include=*.tsx src/ | grep -v __tests__
```

| Consumidor | Evidencia | ¿Se puede retirar? |
|---|---|---|
| `CerrarElMes.tsx` (la card + su modal) | `CerrarElMes.tsx:31` importa del servicio | **Sí** · es la UI que la Fase 2 retira |
| **`DrawerExtracto.tsx`** | `DrawerExtracto.tsx:24` → `import { cierres } from '../../../services/cierreDeMes'` | **NO** · el extracto usa los cierres para bloquear cargos de meses cerrados |
| **`services/bonificaciones/movimientosQuePrueban.ts`** | `:19` → `import { cierres } from '../cierreDeMes'` | **NO** · lógica de bonificaciones |

→ **`src/services/cierreDeMes.ts` se queda intacto.** Lo único retirable es `CerrarElMes.tsx` + `CerrarElMes.module.css` + su import y uso (`TesoreriaV6Page.tsx:40` y `:913`), más su test `__tests__/CerrarElMes.test.tsx`.

⚠️ **Efecto colateral a decidir**: `DrawerExtracto.tsx:723` le dice al usuario, en texto, *"Para cargarlos, reabre el mes en «Cerrar el mes»."* — si la card desaparece, esa frase remite a un sitio que ya no existe. Hay que reescribirla o dejar otra puerta al modal. **Pendiente de tu decisión** (no lo cambio por mi cuenta: es texto de producto).

### "Cómo va {mes}" — la lógica **tampoco** es exclusiva, pero el consumidor externo es solo un comentario

- La card es JSX inline (`TesoreriaV6Page.tsx:916-922`) + el subcomponente local `BloqueRealidad` (`:1128`) + dos helpers exportados con test propio, `importeCabeEnLaBarra` (`:1111`) y `posicionImporteFuera` (`:1120`), + los estilos `.comoVa*`/`.rv*` del módulo CSS.
- `calcularRealidad` (`tesoreriaV6Metrics.ts:535`) **solo se invoca desde esta card** (`TesoreriaV6Page.tsx:355`). En `PanelPage.tsx:410` aparece únicamente **dentro de un comentario**, no como llamada (`PanelPage.tsx:40` importa otras funciones del mismo módulo).
- Tests que caen con la card: `TesoreriaV6Page.test.tsx:503` (`describe('la barra de "Cómo va {mes}"')`) y el guard de móvil `TesoreriaMovil.test.tsx:155` (que ya comprueba que **no** aparece en móvil — ese sigue pasando).

→ Propuesta para la Fase 2: retirar la card, `BloqueRealidad`, los dos helpers, sus estilos y sus tests; **conservar `calcularRealidad` en el servicio** (queda sin llamantes, pero es capa de dominio pura y testeada; borrarla es una decisión de motor, no de UI, y el spec dice "ante la duda, se deja"). Lo marco en el PR con su grep.

## 7 · Design system · primitivos disponibles

`src/design-system/v5/` exporta (barrel `index.ts`): `PageHead`, `TabsUnderline`, `CardV5` (+`CardHead/Body/Foot/Title/Subtitle`), `KPIStrip`, `KPI`, `HeroBanner`, `UploadZone`, `EmptyState`, `Toast`/`ToastHost`/`showToastV5`, `Pill`, `MoneyValue`, `IconButton`, `CompositionBar`, `DateLabel`, `WizardStepper`, `TopbarV5`, `Icons`, `useChartColors`, `tokens.css`.

- **Switch segmentado (F1)**: **no existe como primitivo suelto**. Lo más parecido es `HeroToggle` (variante de `HeroBanner` · `HeroBanner.tsx:29-39`), que está atado al héroe navy y no sirve dentro de una card clara. `TabsUnderline` es subrayado, no segmentado. → Habrá que **construirlo** en el módulo de tesorería con tokens del DS (como ya hacen `.tab`/`.tabOn` del drawer, `DrawerV6.module.css:137-152`). Lo digo porque el spec asume "el DS tiene los primitivos": para el switch, **no**.
- **Gráfico (F3)**: no hay primitivo de chart en el DS. El precedente es `GraficoTreintaDias` (`GraficoTreintaDias.tsx:63`), **SVG a mano** con `useChartColors`. El gráfico diario por cuenta seguirá ese patrón (SVG propio + tokens), no una librería.
- **Checklist sección 17**: existe · `docs/audit-inputs/GUIA-DISENO-V5-atlas.md:1168` ("Checklist obligatorio antes de cerrar un mockup"), con los bloques Tokens / Layout / Page head / Tabs / KPIs strip / Cards / Bloques especiales / SVG / Animaciones / Iconos / Texto / Toast. Aplicable en cada fase. Nota: la guía exige **IBM Plex Sans + JetBrains Mono**; el mockup citado usa Inter — prevalece el DS, como dice el spec.
- **Colores de banco a retirar (F1)**: el punto de color de la fila es `<span className={styles.logo} style={{ background: f.color }}>` · `TablaCuentas.tsx:176`, alimentado por `FilaCuenta.color` (`TablaCuentas.tsx:24-25`) desde `colorDeBanco(c)` (`TesoreriaV6Page.tsx:407`). **`bancoColores.ts` NO se puede borrar**: lo siguen usando `DrawerCuenta.tsx:238`, `DrawerExtracto.tsx:477`, `TesoreriaMovil.tsx:105`, `DrawerCalendario.tsx:263` y las filas de tarjetas (`TesoreriaV6Page.tsx:382`). La F1 solo deja de pintarlo **en la fila de cuenta**.

---

## Resumen · qué necesito de ti para arrancar

| # | Asunto | Estado |
|---|---|---|
| D1 | **Mockup `atlas-bancos-grafico-v5.html`** — no llegó | **Bloquea F3**; F1 saldría a mi criterio visual |
| 5.1 | **Fuente del "confirmado" del gráfico**: ¿solo `treasuryEvents` (como dice el spec) o `events` + `movements` (lo que refleja el dinero ya movido)? | **Bloquea F3** |
| 5.2 | Traspasos internos en el gráfico: recomiendo excluirlos, como los KPIs de la fila | Confirmar |
| 6 | Texto de `DrawerExtracto.tsx:723` que remite a «Cerrar el mes» tras retirar la card | Decisión de producto |
| 3 | ¿El deep-link `/tesoreria/cuenta/:id` debe además **seleccionar** esa cuenta en la tabla? | Recomiendo que sí |
| D2/D3 | Rutas de las auditorías y base en #1757 (no #1755) | Informativo · sin bloqueo |

Todo lo demás del preflight **cuadra con el spec**: el kebab ya existe con sus tres ítems y no comparte trigger con la fila, `cierreDeMes` tiene consumidores externos (se conserva), `calcularRealidad` es exclusivo de la card, y la serie diaria es derivable sin tocar la base de datos.

---

*Preflight de solo lectura · ningún componente, servicio, store ni CSS modificado · `DB_VERSION = 89` sin cambios · Fase 1 no iniciada.*
