# Plan de implementación — Dashboard ejecutivo v4

> Para ejecutar con Claude Code sobre el repo ATLAS
> Referencia visual: `atlas-dashboard-v4.jsx` (artifact aprobado)

---

## Contexto

El dashboard actual (`HorizonVisualPanel.tsx` + `horizonExecutiveDashboard.css`) se reemplaza por completo. El nuevo diseño está validado en el artifact `atlas-dashboard-v4.jsx` con datos mock. Este plan conecta ese diseño con los servicios reales.

---

## 1. Archivos a CREAR

### `src/modules/horizon/panel/components/ExecutiveDashboard.tsx`
- Componente principal. Copia la estructura de `atlas-dashboard-v4.jsx`.
- TypeScript estricto, interfaces para todos los props.
- Los tokens de color NO van como constantes JS — usa `var(--blue)`, `var(--c1)`, etc. del CSS existente en `horizonExecutiveDashboard.css`.
- Importa datos de `dashboardService` (ver sección 4).

### `src/modules/horizon/panel/components/DashboardGauge.tsx`
- Componente `Gauge` extraído. Props: `value`, `max`, `chartColor` (string CSS var), `icon` (LucideIcon), `label`, `unit`.
- SVG circular con `strokeDashoffset`. Sin badge, sin threshold.

### `src/modules/horizon/panel/components/DashboardKpiCompact.tsx`
- Componente `KpiCompact` extraído. Props: `icon`, `value` (string formateado), `label`, `context?`, `chartColor`.
- Icono en caja `var(--n-100)`, número en mono.

### `src/modules/horizon/panel/components/DashboardFlujoProgress.tsx`
- Componente `FlujoProgress` extraído. Props: `icon`, `label`, `actual`, `previsto`, `chartColor`, `sub`, `isLast?`.
- Barra de progreso = actual/previsto. Porcentaje alineado derecha.

---

## 2. Archivos a MODIFICAR

### `src/modules/horizon/panel/components/HorizonVisualPanel.tsx`
- **Vaciar** el componente actual.
- Reemplazar por: importar y renderizar `<ExecutiveDashboard />`.
- Mantener la carga de datos con `dashboardService` (ya existe el patrón `loadDashboardData`).
- Mantener el drawer `ActualizacionValoresDrawer` (ya funciona).

### `src/modules/horizon/panel/components/horizonExecutiveDashboard.css`
- **Conservar** las variables CSS `:root` (ya tienen los tokens v3 correctos).
- **Eliminar** todas las clases del dashboard antiguo: `.patrimonio-hero`, `.pulso-bar`, `.pulso-chip`, `.flujo-card`, `.tbl-tesoreria`, `.exec-alert`, `.exec-hero`, etc.
- **Añadir** las clases mínimas del nuevo dashboard:

```css
/* Dashboard v4 */
.dash-card {
  background: var(--white);
  border: 1px solid var(--n-200);
  border-radius: 12px;
  transition: box-shadow 150ms ease;
}
.dash-card:hover {
  box-shadow: 0 2px 12px rgba(4,44,94,.05);
}
.dash-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--n-500);
}
.dash-mono {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
```

---

## 3. Archivos a NO TOCAR

- `src/modules/horizon/panel/Panel.tsx` — ya importa `HorizonVisualPanel`, no cambia.
- `src/pages/PanelPage.tsx` — ya importa `Panel`, no cambia.
- `src/services/dashboardService.ts` — la API no cambia, solo se consume.
- `src/components/dashboard/ActualizacionValoresDrawer.tsx` — se sigue usando igual.

---

## 4. Mapeo de datos mock → datos reales

### Patrimonio (donut)

```
Mock                          → dashboardService.getPatrimonioNeto()
─────────────────────────────────────────────────────────────────
PATRIMONIO_TOTAL = 842917     → patrimonio.total
desglose.Inmuebles = 975000   → patrimonio.desglose.inmuebles
desglose.Inversiones = 225725 → patrimonio.desglose.inversiones
desglose.Cuentas = 38192      → patrimonio.desglose.cuentas
desglose.Deuda = -396000      → patrimonio.desglose.deuda
variación mensual             → patrimonio.variacionPorcentaje
```

El donut recibe `Math.abs()` de cada valor para que la deuda se vea como segmento.
La leyenda muestra el valor con signo real (negativo para deuda).

### KPIs (2×2 grid)

```
Colchón 19 m        → salud.colchonMeses (redondear a entero con Math.round)
                       max = 24 (hardcoded, representa 2 años)

Ocupación 72.2%     → flujosCaja.inmuebles.ocupacion
                       max = 100

Comprometido -7923  → liquidez.comprometido30d
                       Sin context (solo el número)

Tasa cobro 83%      → NUEVO: calcular desde contratos/ingresos
                       Opción A: crear método en dashboardService
                       Opción B: hardcodear temporalmente hasta que
                       el módulo de contratos lo alimente
```

### Flujos de caja (3 barras + neto)

```
Economía familiar:
  actual  → flujosCaja.trabajo.netoMensual (redondeado)
  previsto → NUEVO: necesita presupuesto mensual o media histórica
             Opción temporal: usar netoMensual * 1.0 (100% = sin previsión)

Inmuebles:
  actual  → flujosCaja.inmuebles.cashflow (redondeado)
  previsto → NUEVO: suma de rentas esperadas - gastos recurrentes
             Opción temporal: usar cashflow * 1.08 (simular target)

Inversiones:
  actual  → flujosCaja.inversiones.rendimientoMes + dividendosMes
  previsto → NUEVO: rendimiento esperado mensual
             Opción temporal: usar mismo valor (100% cumplimiento)

Neto total:
  actual  → suma de los 3 actual
  previsto → suma de los 3 previsto
```

> NOTA: Los "previsto" son el punto débil actual. Hasta que el módulo de
> presupuesto (T4 del plan de acción) esté implementado, las barras
> mostrarán cumplimiento plano. Esto es CORRECTO — mejor mostrar 100%
> real que inventar un target falso. Documentar con un TODO en el código.

### Tesorería (8 cuentas)

```
CUENTAS[].banco → tesoreria.filas[].banco
CUENTAS[].hoy   → tesoreria.filas[].hoy
CUENTAS[].fin   → tesoreria.filas[].proyeccion
Total hoy        → tesoreria.totales.hoy
Total fin        → tesoreria.totales.proyeccion
```

La barra inline por fila: `width = (fila.hoy / maxHoy) * 100%`, color `var(--c1)` al 45% opacidad.
Sin paginación — las 8 cuentas caben.

### Alertas

```
ALERTAS[]       → dashboardService.getAlertas()
alerta.icon     → mapear por alerta.tipo:
                   'contrato' → CalendarDays
                   'cobro'    → Wallet
                   'documento' → FileText
                   default    → Bell
alerta.titulo   → alerta.titulo
alerta.desc     → alerta.descripcion
alerta.dias     → alerta.diasVencimiento
alerta.importe  → alerta.importe (puede ser undefined)
```

Cada alerta es clicable → navegar según `alerta.tipo`:
- `contrato` → `/alquileres`
- `cobro` → `/tesoreria`
- `documento` → `/documentacion`

---

## 5. Reglas de diseño (recordatorio para Claude Code)

- **Colores**: NUNCA hardcodear hex. Usar `var(--blue)`, `var(--c1)`, `var(--n-500)`, etc.
- **Iconos**: SOLO `lucide-react`. Tamaño 14-18 en dashboard, `strokeWidth={1.5}`.
- **Tipografía**: `IBM Plex Sans` (UI) + `IBM Plex Mono` (números). Clase `.dash-mono`.
- **Semánticos**: `var(--s-pos)` / `var(--s-neg)` / `var(--s-warn)` SOLO en alertas (estado real validado). Los KPIs y datos usan paleta de gráficos `c1-c6`.
- **Fondos iconos**: `var(--n-100)`. Nunca fondos semánticos en datos.
- **Fin de mes tesorería**: color `var(--n-700)`. No es rojo — no es un estado negativo.
- **Formato**: `es-ES`, euros sin decimales en dashboard, `font-variant-numeric: tabular-nums`.

---

## 6. Orden de ejecución

```
1. Crear los 4 componentes nuevos (Gauge, KpiCompact, FlujoProgress, ExecutiveDashboard)
2. Limpiar horizonExecutiveDashboard.css (eliminar clases viejas, añadir .dash-*)
3. Modificar HorizonVisualPanel.tsx para renderizar ExecutiveDashboard
4. Conectar datos reales del dashboardService
5. Verificar que el build compila sin errores
6. Verificar visualmente contra el artifact aprobado
```

---

## 7. Componentes que se pueden ELIMINAR después

Estos componentes del directorio `src/modules/horizon/panel/components/` ya no se usan en el nuevo dashboard. No eliminar hasta confirmar que ninguna otra ruta los importa:

- `AccountsCompactSection.tsx`
- `AccountsSection.tsx`
- `AlertsSection.tsx`
- `CompactAlertsSection.tsx`
- `ExpensesCompactSection.tsx`
- `ExpensesSection.tsx`
- `IncomeExpensesSection.tsx`
- `RentsCompactSection.tsx`
- `RentsSection.tsx`
- `RiskRunwaySection.tsx`
- `TimelineSection.tsx`

Verificar con `grep -r "import.*AccountsSection\|import.*AlertsSection\|..." src/` antes de borrar.

---

## 8. Test de aceptación

- [ ] El dashboard carga sin spinner infinito
- [ ] El donut muestra 4 segmentos (inmuebles, inversiones, cuentas, deuda)
- [ ] Colchón muestra número entero (no decimal)
- [ ] Ocupación muestra porcentaje con 1 decimal
- [ ] Comprometido 30d muestra número sin contexto debajo
- [ ] Las 3 barras de flujos muestran actual/previsto con porcentaje
- [ ] La barra neto tiene fondo `n-50` y usa el mismo componente
- [ ] La tabla de tesorería muestra 8 cuentas sin paginación
- [ ] Cada fila tiene mini barra inline proporcional
- [ ] Fin de mes NO es rojo
- [ ] Cero emojis en la UI
- [ ] Cero colores hardcodeados (hex) en los componentes
- [ ] Alertas clicables navegan al destino correcto
- [ ] El botón "Actualizar valores" abre el drawer existente
