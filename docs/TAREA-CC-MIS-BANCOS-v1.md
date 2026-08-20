# TAREA CC · Tesorería → "Mis Bancos" (switch + gráfico diario + limpieza)

Reconfiguración de la zona de cuentas de Tesorería. **UI + una agregación de solo lectura. Sin cambio de esquema, sin `DB_VERSION`.**

Base: `main` @ `e85dfcc` (PR #1757; el preflight confirma que `TablaCuentas.tsx`, `TarjetasCard.tsx`, `CerrarElMes.tsx` y `tesoreriaV6Metrics.ts` no cambian respecto a la base auditada) + las dos auditorías previas: `docs/AUDITORIA-TESORERIA-actual.md` y `docs/AUDITORIA-DRAWER-CUENTA-actual.md` (esta última vive en el PR #1756, pendiente de merge).
Mockup de referencia visual y de interacción: **`atlas-bancos-grafico-v5.html` (adjunto a esta tarea · déjalo en `docs/mockups/`)**. Es la versión cerrada: define fila navy legible, tira fina del resto, proporciones del gráfico y estados.

> **Preflight ya ejecutado** (`PREFLIGHT-MIS-BANCOS.md`, rama `claude/mis-bancos-preflight`, sobre `e85dfcc`). Todos los desajustes están resueltos abajo. La sección 1 de preflight queda cubierta; se puede arrancar la Fase 1.

---

## 0 · Qué NO se toca (crítico)
- **El drawer de cuenta (punteo)**: cabecera navy 4 KPIs + pestañas Por confirmar/Confirmados/Movimientos + ejes Fecha/Ámbito/Tipo + acciones (confirmar/despuntear/editar/descartar). Se queda **tal cual, lateral (vertical)**. NO se convierte a horizontal. Solo cambia **quién lo abre** (ver F3).
- **`DrawerV6.module.css`** (chasis compartido con otros drawers): no se edita.
- **El deep-link `/tesoreria/cuenta/:id`**: se mantiene.
- **El héroe** (saldo hoy + KPIs + línea 30 días): no se toca.
- **La página móvil de Tesorería**: fuera de alcance. Todo esto es **solo escritorio**.
- **El motor de cierre** (`cierreDeMes` y su lógica): ver F2 — se retira la *card*, NO la lógica, salvo que grep demuestre que es exclusiva de la card.

## Reglas transversales
- **Stop-and-wait**: cada fase = un commit + PR. CC **no mergea**. Jose valida en preview y mergea.
- **Preflight obligatorio** (sección 1) **antes de tocar código**. Si la realidad no coincide con lo que asume este spec → **CC para y reporta**, no improvisa.
- **Sin `DB_VERSION`**. Sin stores nuevos. La serie diaria se **deriva** de `treasuryEvents` existentes.
- Design system y `GUIA-DISENO-V5-atlas.md`. **Checklist obligatorio sección 17** antes de entregar cada fase.
- Tipografía y tokens del design system real (no del mockup: el mockup usa Inter; producción usa la fuente del DS). Cero hex hardcoded.
- Nada de rojo/verde en cifras; el signo y el eje transmiten dirección. Paleta Oxford Gold.

---

## 1 · Decisiones cerradas (salidas del preflight)
El preflight resolvió las dudas. Vinculante para la implementación:

- **D-DB** · `DB_VERSION = 89` (`src/services/db.ts:56`). **No cambia.** Sin stores ni migración.
- **D-COMP** · Piezas reales: página `TesoreriaV6Page` (`TesoreriaV6Page.tsx:101`); tabla `TablaCuentas` (`TablaCuentas.tsx:58`, título en `:136`); tarjetas `TarjetasCard` (`TarjetasCard.tsx:44`); card "Cerrar el mes" `CerrarElMes` (`CerrarElMes.tsx:50`, montada en `TesoreriaV6Page.tsx:913`); card "Cómo va {mes}" = JSX inline + `BloqueRealidad` (`TesoreriaV6Page.tsx:916-922`, `:1128`). Las tres cards inferiores viven en `div.row3` (`TesoreriaV6Page.tsx:900`): al vaciarse, **ese contenedor también desaparece**.
- **D-TRIGGER** · El drawer se abre hoy por **dos** caminos que llaman a `onAbrir(f.cuenta)` → `abrirCuenta(id)` → `navigate('/tesoreria/cuenta/:id')` (estado en la URL): click de fila (`TablaCuentas.tsx:166`) y ⋯ "Confirmar movimientos" (`:224`). El kebab **no comparte trigger** con la fila (`stopPropagation` en `:215-218` y `:223`). En F3 se cambia **solo** el `onClick` del `<tr>`; el ⋯ sigue igual.
- **D-SELECCIÓN-vs-URL** · Aparecen dos estados: *cuenta seleccionada* (nuevo, local, pinta el gráfico) y *cuenta con drawer abierto* (URL). **El deep-link `/tesoreria/cuenta/:id` además selecciona esa cuenta en la tabla**, para que al cerrar el drawer el gráfico visible sea el de la cuenta que se tocaba.
- **D-FUENTE-GRÁFICO** (crítico) · En el motor `status:'confirmed'` = "decidido, aún no ocurrido"; lo que **ya se movió** es `executed` y vive en **`movements`**. Por tanto la serie **NO** se construye solo con `treasuryEvents` (las barras sólidas saldrían vacías). Se lee, como ya hace `calcularRealidad` (`tesoreriaV6Metrics.ts:535`): **confirmado/ingresado/pagado desde `movements`** + **pendiente/por cobrar/por pagar desde `treasuryEvents`** (`esPendiente`, excluye descartados y `gasto_tarjeta`).
- **D-TRASPASOS** · La serie **excluye traspasos internos** (`esTraspasoInterno`), igual que los KPIs de la fila, para que gráfico y fila cuenten lo mismo.
- **D-CIERRE** · `src/services/cierreDeMes.ts` **se conserva** (lo usan `DrawerExtracto.tsx:24` y `services/bonificaciones/movimientosQuePrueban.ts:19`). Solo se retira la UI (ver F2).
- **D-REALIDAD** · `calcularRealidad` se **conserva** en el servicio aunque quede sin llamantes tras F2 (dominio puro y testeado; el gráfico de F3 leerá el mismo tipo de fuente).
- **D-BANCO-COLOR** · `bancoColores.ts` **no se borra** (lo usan drawers, móvil, calendario y filas de tarjeta). F1 solo deja de pintar el punto de color **en la fila de cuenta** (`TablaCuentas.tsx:176`).
- **D-SWITCH** · No hay primitivo de switch segmentado en el DS. Se **construye** en el módulo tesorería con tokens del DS (patrón de `.tab/.tabOn` de `DrawerV6.module.css:137-152`). El gráfico sigue el patrón SVG-a-mano de `GraficoTreintaDias` + `useChartColors` (no hay primitivo de chart).

---

## FASE 1 · "Mis Bancos" + switch Cuentas/Tarjetas + añadir contextual
Objetivo: fusionar la tabla de cuentas y la card de tarjetas en **una sola pieza con switch**, liberando el espacio de abajo.

- Renombrar el título de la sección **"Mis cuentas" → "Mis Bancos"**.
- Añadir un **switch segmentado `Cuentas · Tarjetas`** junto al título. Ambas vistas **comparten el mismo espacio** (una u otra).
  - `Cuentas` → la tabla de cuentas actual.
  - `Tarjetas` → el contenido de la card "Mis tarjetas" actual (consumo del ciclo, orden, paginación) **movido aquí dentro**. La card suelta de tarjetas desaparece como bloque independiente.
- **"+ Añadir" contextual**: en `Cuentas` = "+ Añadir cuenta"; en `Tarjetas` = "+ Añadir tarjeta". Un solo botón que cambia de etiqueta y acción según el switch.
- Se mantiene el botón **"Previsión · meses y días"** (abre el calendario existente, sin cambios).
- **Quitar los logos/colores de banco** de las filas de cuenta: solo **nombre + número** (sin cuadrado ni punto de color). Jose: "los colores ensucian y no aportan".

Commit → PR → **stop**.

---

## FASE 2 · Retirar "Cerrar el mes" y "Cómo va agosto"
Objetivo: eliminar las dos cards inferiores que no aportan (decisión de producto: Tesorería mira al futuro; "cerrar mes" no es una ceremonía necesaria y "cómo va" da ruido).

- Eliminar la **card "Cerrar el mes"** y la **card "Cómo va agosto"** de la pantalla.
- Eliminar **solo el código de UI que quede muerto** al quitarlas (componentes, estilos, handlers exclusivos), **con evidencia grep** de que no se usa en otro sitio.
- **Conservar** `src/services/cierreDeMes.ts` y `calcularRealidad` (ver D-CIERRE / D-REALIDAD). Solo retirar UI: `CerrarElMes.tsx` + `.module.css` + su import/uso (`TesoreriaV6Page.tsx:40`, `:913`) + su test; y la card "Cómo va {mes}" (JSX `:916-922`, `BloqueRealidad` `:1128`, helpers `importeCabeEnLaBarra` `:1111` / `posicionImporteFuera` `:1120`, estilos `.comoVa*`/`.rv*`, y sus tests `TesoreriaV6Page.test.tsx:503`). Reportar cada retirada con `archivo:línea`.
- **Reescribir el aviso de `DrawerExtracto.tsx:723`** que hoy dice *"Para cargarlos, reabre el mes en «Cerrar el mes»"* — al desaparecer esa card, remite a la nada. Nuevo texto, en lenguaje llano y sin depender de la ceremonía de cierre, del tipo: *"Este cargo cae en un mes ya conciliado. Puedes anotarlo o revisarlo desde el punteo de la cuenta."* (ajústalo al tono real de esa pantalla). El bloqueo funcional que impone `cierreDeMes` **no cambia**; solo el texto y, si procede, que apunte al punteo en vez de a la card eliminada.
- No revivir `treasuryForecastService.regenerate*` (código muerto conocido / doble emisor).

Commit → PR → **stop**.

---

## FASE 3 · Selección de cuenta = fila navy + gráfico diario inline (nuevo)
Objetivo: al seleccionar una cuenta, verla en navy con su **gráfico diario** desplegado debajo, **sin scroll de página**. Separar *mirar* (seleccionar) de *tocar* (⋯ → punteo).

### 3.1 · Comportamiento de fila
- **Click en una fila de cuenta = SELECCIONAR** (ya no abre el drawer).
  - La fila seleccionada pasa a **navy** (fondo `--brand`), con **todos los importes en blanco** y el cierre en `--gold-2`; barra dorada a la izquierda; chevron girado.
  - **Justo debajo** de esa fila se despliega, inline, el **gráfico diario** de esa cuenta (3.2).
  - **El resto de cuentas se colapsan a "tira fina"** (una línea, atenuada) para que el conjunto **quepa en un viewport** (regla no-scroll de la guía). Al deseleccionar, la tabla vuelve entera.
  - Selección por defecto al entrar: **la primera cuenta** (así el espacio no queda vacío y el patrón es evidente).
- **El menú ⋯ de cada fila** (existente) es quien **abre el punteo**: ítem **"Confirmar movimientos" → abre el drawer de cuenta actual (lateral, sin cambios)**. "Editar cuenta" y "Eliminar cuenta" como hoy. Reconfirmar que el ⋯ ya NO comparte el trigger con el click de fila.

### 3.2 · Gráfico diario por cuenta (componente nuevo, escritorio)
- **Barras diarias del mes en curso**, dos series por día:
  - **Entradas** por encima del cero, **salidas** por debajo.
  - Cada serie partida en **confirmado** (sólido) y **pendiente/previsto** (relleno tenue con contorno):
    entradas confirmadas `--brand` sólido · por cobrar `--brand-wash`+borde `--brand-2`;
    salidas confirmadas `--gold` sólido · por pagar `--gold-wash`+borde `--gold-soft`.
  - Barras redondeadas. Marcador vertical de **hoy**. Eje cero. Etiquetas de día cada 5.
  - **Sin rojo/verde**: dirección por eje/signo. Fondo claro (`--card-alt`), NO navy.
  - **Sin título redundante** encima (el nombre ya está en la fila navy): solo eyebrow discreto "Día a día de {mes}" + leyenda (Ingresado · Por cobrar · Pagado · Por pagar).
  - **Altura fija**: el gráfico no empuja la página ni genera scroll. Tooltip por día (ingresado/por cobrar/pagado/por pagar) al pasar el ratón.
- **Fuente de datos (derivada, FUENTE DOBLE, sin store nuevo)** — ver D-FUENTE-GRÁFICO. Agregación pura tipo `serieDiariaCuenta(cuentaId, año, mes)` en `tesoreriaV6Metrics.ts` (junto a `cierrePorCuenta`), que devuelve por día `{ entradaConf, entradaPrev, salidaConf, salidaPrev }`:
  - **Confirmado (barras sólidas · Ingresado/Pagado)** = `movements` de esa cuenta en el mes (dinero que ya se movió), como hace `calcularRealidad`. NO `status:'confirmed'` de eventos.
  - **Pendiente (barras tenues · Por cobrar/Por pagar)** = `treasuryEvents` con `esPendiente` (excluye `descartado` y `gasto_tarjeta`).
  - entrada/salida por **signo** (`importeConSigno`/`type`); **excluir traspasos internos** (`esTraspasoInterno`) en ambas fuentes (D-TRASPASOS).
  - Reutilizar `rangoDelMes`/`esPendiente`/`esTraspasoInterno`/`importeConSigno` y la lectura de `movements` que ya usa `calcularRealidad`. **No** crear stores ni duplicar motor. Documentar en el PR de qué servicio/campo sale cada término.

### 3.3 · Tarjetas
- En la vista `Tarjetas`, la selección de una tarjeta **no** abre el gráfico diario de cuenta; mantiene su comportamiento actual (consumo del ciclo). El gráfico diario es solo para `Cuentas`. (Si hoy no hay detalle de tarjeta, no se inventa aquí.)

Commit → PR → **stop**.

---

## Criterios de aceptación
- `/tesoreria` (escritorio) muestra **"Mis Bancos"** con switch Cuentas/Tarjetas compartiendo espacio y "+ Añadir" contextual.
- **No** existen ya las cards "Cerrar el mes" ni "Cómo va agosto"; el código muerto retirado con evidencia; la lógica de motor no exclusiva de las cards, intacta.
- Click en fila = selección **navy legible** + **gráfico diario inline** debajo + resto **colapsado**; **la página no hace scroll** (todo un viewport).
- El **⋯ → Confirmar movimientos** abre el **drawer lateral existente sin cambios**; deep-link (que además **selecciona** la cuenta) y chasis intactos.
- Filas de cuenta **sin colores/logos de banco** (pero `bancoColores.ts` conservado).
- El gráfico usa **fuente doble** (movements confirmado + eventos pendiente), excluye traspasos internos, y sus barras sólidas **no salen vacías**.
- El aviso de `DrawerExtracto.tsx:723` **ya no remite** a la card eliminada.
- Sin `DB_VERSION`, sin stores nuevos.
- **Checklist sección 17** pasado en cada fase. Móvil intacto. Sin merges (stop-and-wait).

## Entrega
- Un PR por fase (1, 2, 3), cada uno con su resumen de cambios y `archivo:línea` de lo retirado/añadido.
- Preflight ya entregado (`PREFLIGHT-MIS-BANCOS.md`); las decisiones cerradas están en la sección 1. Arrancar por Fase 1.
- Adjuntar el mockup `atlas-bancos-grafico-v5.html` a `docs/mockups/` como referencia de F1/F3.
