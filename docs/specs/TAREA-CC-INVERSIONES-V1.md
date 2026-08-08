# TAREA CC · MÓDULO INVERSIONES · V1

**Objetivo:** aplicar el diseño Oxford-Gold V5 (mockup `atlas-inversiones-v10.html`) al módulo de Inversiones **reutilizando los componentes y stores que ya existen**, más un cambio de modelo acotado (generalizar traspasos a fondos). No se inventa nada: todo mapea a stores reales.

**Filosofía de trabajo (no negociable):**
- **Restyle + wiring**, no lógica nueva salvo lo explícitamente marcado como "CAMBIO DE MODELO".
- **Stop-and-wait:** CC abre PR y **nunca mergea**. Jose valida en deploy preview y mergea. Un PR por fase.
- **grep antes de tocar.** Si el preflight no cuadra con lo que dice esta spec, **PARA y avisa** — no improvises.
- **No cambiar DB_VERSION** salvo donde esta spec lo scoped (Fase 1).

---

## FASE 0 — PREFLIGHT (CC ejecuta y pega el resultado ANTES de escribir código)

```bash
# 0.1 versión de DB y forma de apertura
grep -n "DB_VERSION" src/services/db.ts | head
grep -n "openDB<AtlasHorizonDB>" src/services/db.ts

# 0.2 stores que vamos a tocar (deben existir)
grep -nE "'inversiones'|'planesPensiones'|'traspasosPlanPensiones'|'valoracionesActivos'|'aportacionesPlan'|'prestamos'|'treasuryEvents'" src/services/db.ts

# 0.3 componentes reales del módulo (deben existir)
find src/modules/inversiones -iname "*.tsx" | sort
ls src/modules/inversiones/components/modal/

# 0.4 servicios que consumen traspasos
grep -rn "getTraspasosPorPlan\|traspasosPlanPensionesService" src/services src/modules | grep -v ".test." | head -20

# 0.5 tipos
sed -n '1,60p' src/types/inversiones-extended.ts
grep -n "SubtipoPrestamo\|interface RendimientoPeriodico\|interface DividendoConfig\|interface TraspasoPlanPensiones" src/types/*.ts
```

**Datos verificados (a fecha de esta spec — CC re-confirma en 0.1):**
- `DB_VERSION` **físico = 87**. Existe además una migración **post-open** con flag `migration_v88_cuentas_tarjeta_v1` que corre DESPUÉS de V87 y **no sube la versión física**. ⚠️ Ojo a la colisión de nombre "v88": el índice nuevo de la Fase 1 SÍ necesita un **bump físico real** (ver Fase 1).
- Préstamos P2P viven en `inversiones` (`tipo:'prestamo_p2p'`), **no** en `prestamos` (ese store es de deudas de Financiación).

Si `DB_VERSION` ≠ 87 o falta cualquier store/componente → **PARA y avisa**.

---

## MODELO DE DATOS — MAPEO (referencia para todas las fases)

| En la UI | Store | Campos clave | Notas |
|---|---|---|---|
| Planes (Indexado, BBVA) | `planesPensiones` | `valorActual`, `gestoraActual`, `fechaContratacion`, `estado`, `titular` | |
| Resto (P2P, acciones, fondos, depósitos, crypto) | `inversiones` | `tipo`, `entidad`, `valor_actual`, `total_aportado`, `rentabilidad_euros/_porcentaje`, `numero_participaciones`, `precio_medio_compra`, `isin`, `ticker`, `activo`, `aportaciones[]`, `cuenta_cargo_id` | Índices `activo`/`entidad`/`tipo` |
| Cobros de P2P (renta) | subtipo `InversionRendimientoPeriodico.rendimiento` (`RendimientoPeriodico`) | `tasa_interes_anual`, `frecuencia_pago`, `meses_cobro[]`, `dia_cobro`, `fecha_primer_cobro`, `retencion_porcentaje`, `pagos_generados[]`, `movimiento_id` | **SOLO LECTURA** en Inversiones |
| Dividendos de acciones | subtipo `InversionConDividendos.dividendos` (`DividendoConfig`) | `frecuencia_dividendos`, `meses_cobro[]`, `dividendo_por_accion`, `retencion_porcentaje`, `dividendos_recibidos[]`, `movimiento_id` | **SOLO LECTURA** en Inversiones; se configura en la ficha, no en el alta |
| Curva histórica / valor por fecha | `valoracionesActivos` | `activoId`, `tipoActivo`, `fecha`, `valor` | Índices `idx_activo`, `idx_activo_fecha`, `idx_tipo` |
| Aportaciones del plan | `aportacionesPlan` | `importeTitular`, `importeEmpresa`, `ejercicioFiscal` | Índices `planId`, `ejercicioFiscal` |
| Traspasos (planes y —tras Fase 1— fondos) | `traspasosPlanPensiones` | `planId`, `gestoraOrigen/Destino`, `isinOrigen/Destino`, `fechaEjecucion`, `valorTraspaso`, `esTotal` | Índices `planId`, `fechaEjecucion` |

**Reglas de oro (aplican a todo el módulo):**
1. **Préstamos ≠ Financiación.** El motor de Inversiones lee `inversiones`, NUNCA `prestamos`.
2. **No doble contar planes.** Los planes se leen de `planesPensiones`; el `tipo:'plan_pensiones'` que existe dentro de `inversiones` es legado — la galería NO lo suma.
3. **Cobros y dividendos son de SOLO LECTURA aquí.** Se declaran en el alta y se puntean en Tesorería (existen como eventos con `movimiento_id`). Inversiones los LEE; no registra cobros. La única escritura de ciclo de vida es cerrar/vender/rescatar, traspasar, editar y eliminar.

---

## FASE 1 — CAMBIO DE MODELO: generalizar traspasos a fondos (Opción A, no rompe nada)

Hoy `traspasosPlanPensiones` sólo sirve a planes. Un fondo también se traspasa sin tributar. Generalizamos **sin renombrar el store**, alineándonos al patrón polimórfico que ya existe en `valoracionesActivos` (`activoId` + `tipoActivo`).

**1.1 Tipo `TraspasoPlanPensiones`** — añadir 2 campos OPCIONALES:
```ts
activoId?: string;                               // en planes: activoId === planId
tipoActivo?: 'plan_pensiones' | 'fondo_inversion'; // mismo vocabulario que ValoracionActivo
```
Se **mantienen** `planId` y `planIdDestino` intactos (retro-compat total).

**1.2 Índice nuevo `activoId`** en el store `traspasosPlanPensiones` (aditivo; se conservan `planId` y `fechaEjecucion`).
⚠️ **Esto exige BUMP FÍSICO de DB_VERSION 87 → 88** con `createIndex` en el upgrade callback. La migración post-open de tarjetas (`migration_v88_cuentas_tarjeta_v1`) es INDEPENDIENTE y sigue corriendo. **Renombra el flag de índice para evitar confusión** con esa post-open (p.ej. `migration_traspasos_activoId_idx`). CC confirma en preflight cómo está montado el upgrade y **avisa antes de bumpear**.

**1.3 Backfill idempotente** (post-open, con flag keyval, sin borrar nada): por cada traspaso existente sin `activoId`, fijar `activoId = planId`, `tipoActivo = 'plan_pensiones'`. Deja recibo en keyval.

**1.4 Servicio** — añadir en `traspasosPlanPensionesService` (sin tocar los métodos actuales):
```ts
getTraspasosPorActivo(activoId: string, tipoActivo: 'plan_pensiones'|'fondo_inversion'): Promise<TraspasoPlanPensiones[]>
```
Los consumidores actuales (`getTraspasosPorPlan`, `rentabilidadPlanService`, import AEAT) **no se tocan**.

**PR Fase 1** = tipo + índice + bump + backfill + `getTraspasosPorActivo`. Nada de UI. Stop-and-wait.

---

## FASE 2 — GALERÍA (pantalla principal de Inversiones)

Restyle a V5 según el mockup. **Pantalla de supervisión** con hero navy de gestión (KPIs integrados) — una sola pantalla, **sin scroll**.

**2.1 Localizar** la página lista/dashboard de Inversiones (preflight 0.3). Si no hay una única, CC indica dónde vive el listado y lo consolida.

**2.2 Hero** (navy `--brand`, borde superior oro):
- Izquierda: eyebrow "Mi cartera" + **valor total** (Σ `planesPensiones.valorActual` + Σ `inversiones.valor_actual`, sin doble contar planes).
- **Gauge de rentabilidad** (%) + debajo el **importe ganado en €** (Σ `rentabilidad_euros` + [planes: valorActual − aportado]).
- **3 chips por familia** (Planes de pensión / Préstamos / Acciones): `aportado ▸ hoy · +%/año`. Importe (hoy) en **oro**, `%` en **blanco**. Sin texto de opinión.
- **Línea "Tu renta pasiva"**: renta anual/mensual (Σ intereses de `RendimientoPeriodico` + Σ dividendos de `DividendoConfig`), con barra de reparto **intereses (préstamos) + dividendos (acciones)**.
- Derecha: panel oscuro `--brand-ink` **"Trayectoria a 20 años" por posición** = área apilada (una banda por posición), eje de años + eje de €, **hover** que muestra por año el desglose (color + importe por posición) y el **total**. Los **préstamos terminan en su vencimiento** (su banda desaparece; el capital sale de la gráfica — NO se proyecta reinversión: si se reinvierte será una posición nueva). Los supuestos de la proyección salen del **escenario compartido** (Fase 5), no hardcodeados.

**2.3 Tabla de posiciones** (blanco, filas compactas):
- Columnas: Posición · Desde (año) · Peso en cartera (barra) · Valor · Cómo va.
- "Cómo va" = **solo el dato** (`+165%`, `9.000 €/año`, …), sin "crece/te paga".
- **Cabeceras ordenables** (asc/desc) por Posición, Desde, Peso y Valor.
- Filtros: Todas / Planes / Renta fija / Equity (agrupación por familia derivada de `tipo`).
- Botón **"Nueva posición"** en la cabecera de la página (abre el selector, Fase 4).

**PR Fase 2** = galería. Stop-and-wait.

---

## FASE 3 — DETALLES (plan · préstamo · equity) — restyle de `FichaPlanPensiones` y `FichaPosicionPage`

**Común:** hero navy de detalle; avisos con ✕; **una sola pantalla sin scroll**. Acciones de ciclo de vida = cerrar/vender/rescatar + traspasar (solo plan/fondo) + editar + **eliminar** (confirm destructivo: "solo si la creaste por error; no borra movimientos conciliados").

**3.1 Plan (`FichaPlanPensiones`):**
- Proyección con **2 sliders** (rentabilidad objetivo + inflación) que recalculan **solo el futuro** (el pasado realizado es inmutable). Valores por defecto del **escenario** (Fase 5).
- **Rentabilidad por gestora**: derivar de `traspasosPlanPensiones` + `valoracionesActivos` los tramos por gestora, con el **absoluto generado por periodo** y el **total generado** (= ganancia acumulada). Bandas en la gráfica + tabla. (Cálculo, no store nuevo.)
- Acciones: Traspasar (`TraspasoModal`), Rescatar, Editar, Eliminar.

**3.2 Préstamo (`FichaPosicionPage`, tipo prestamo_p2p):** **SOLO LECTURA de cobros** — muestra cobrado/previsto leyendo `RendimientoPeriodico.pagos_generados[]` y sus `movimiento_id`. **Sin botón "registrar cobro".** Acciones: Cerrar posición, Editar, Eliminar.

**3.3 Equity (`FichaPosicionPage`, tipo accion/etf/reit):** cotización vs precio medio, plusvalía latente, dividendos **leídos** de `DividendoConfig.dividendos_recibidos[]`. Acciones: Vender, Editar, Eliminar.

**PR Fase 3** (puede partirse en plan / posición si conviene). Stop-and-wait.

---

## FASE 4 — ALTA (restyle de los modales existentes a V5)

**No crear modales nuevos.** Restyle de: `SelectorNuevaPosicion`, `AltaPlanWizard`, `AltaPrestamoModal`, `AltaAccionModal`, `AltaFondoModal`, `AltaDepositoModal`, `AltaCryptoModal`.

- **Selector**: 6 familias + **"Importar cartera"** como una opción más dentro del selector (Indexa Capital / CSV → `ImportarIndexaCapitalPage` / `ImportarAportacionesPage`).
- **Plan**: tipo administrativo (PPI/PPE/PPES/PPA) con **panel fiscal en vivo** (límite deducible art. 51.7; PPI 1.500 / PPE 10.000 = 1.500 titular + 8.500 empresa; ahorro al marginal). Escribe `planesPensiones` (+ `aportacionesPlan`).
- **Préstamo**: subtipo **p2p / empresa / familiar** (familiar → retención 0); **forma de devolución** (solo intereses / cuota francesa / al vencimiento); frecuencia, capital, TIN, duración, **fecha de inicio + primer cobro**, **cuenta de cargo del capital** + cuenta de cobro, retención auto por subtipo. Escribe `inversiones` (`RendimientoPeriodico`).
- **Acción/ETF/REIT**: nombre, bróker, ticker, ISIN, participaciones, precio medio, precio actual, fecha, cuentas → preview de valor y plusvalía. El calendario de dividendos se configura en la **ficha**, no en el alta.
- **Depósito**, **Fondo**, **Crypto**: campos reales de cada `Alta*Modal`.

Campos con **ancho proporcional** (numéricos estrechos, textos anchos); modal que **cabe en pantalla** (sin desbordar).

**PR Fase 4** = alta. Stop-and-wait.

---

## FASE 5 — SUPUESTOS DE PROYECCIÓN (escenario compartido)

La rentabilidad objetivo y la inflación de las proyecciones **no se hardcodean**: son **supuestos del escenario** (los mismos que usa Mi Plan / T-PROYECCIÓN), leídos por cada posición y sobreescribibles localmente en la ficha.

**5.1** CC localiza el store/servicio de escenario/supuestos (grep `escenario`, `supuestos`, `Mi Plan`). Si existe, la galería y las fichas leen de ahí. Si no existe todavía, se dejan como constantes con un **TODO explícito** y un único punto de definición, para conectar cuando exista. **PARA y avisa** si no está claro dónde vive.

---

## REGLAS DE DISEÑO V5 (aplican a todas las fases)

- Paleta sólo tokens: navy de contenido `--brand` (#1E2954) para héroes/paneles/modales; `--brand-ink` (#0C1230) solo sidebar y panel oscuro de gráfica; oro sobre navy = `#C59A47` coherente en todo. Nada de hex inventados.
- Verde/rojo reservados a semántica de flujo (ingreso/gasto/pérdida) — prohibidos en cifras de deuda o elementos de gráfica.
- Código de urgencia global: Libres ahora = rojo · Vencen 30d = ámbar/oro · 30–90d = gris.
- Donde hay color con significado, no repetir la palabra; donde hay palabra, no repetir color.
- Supervisión = cabecera blanca sin navy; Gestión = cabecera navy con KPIs y botones. Avisos siempre cerrables con ✕.
- **Ninguna pantalla hace scroll de página.**

---

## CHECKLIST PRE-ENTREGA (CC marca en cada PR)

- [ ] Preflight pegado; `DB_VERSION`=87 confirmado (o avisado).
- [ ] Sin lectura de `prestamos` desde Inversiones; sin doble conteo de planes.
- [ ] Cobros/dividendos SOLO LECTURA; sin "registrar cobro".
- [ ] DB_VERSION solo tocado en Fase 1 (bump 87→88 por índice), con backfill idempotente y flag propio.
- [ ] Métodos de traspaso actuales intactos; añadido `getTraspasosPorActivo`.
- [ ] Ninguna pantalla con scroll; avisos con ✕; paleta solo tokens.
- [ ] PR abierto, **no mergeado**; deploy preview listo para Jose.

---

## ORDEN DE EJECUCIÓN

Fase 1 (modelo) → 2 (galería) → 3 (detalles) → 4 (alta) → 5 (supuestos). **Un PR por fase, stop-and-wait entre cada uno.** No abrir varios frentes a la vez.
