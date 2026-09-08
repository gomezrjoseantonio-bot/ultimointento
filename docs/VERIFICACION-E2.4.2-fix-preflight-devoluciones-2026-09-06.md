# VERIFICACIÓN · E2.4.2-fix · preflight · devoluciones y reembolsos

**Fecha:** 2026-09-06 · **Rama:** `claude/audit-categories-types-scopes-p5966s` (desde `a32725f`, main con E2.4.2) · **Estado:** PREFLIGHT · sin código · stop-and-wait.

Regla que se implementa (Opción A · Jose · §7 del DEFINITIVO): una devolución/reembolso es un movimiento de la **misma familia que el gasto, con signo positivo**, atado al mismo proveedor / punto (CUPS, póliza) / piso. **Resta** del gasto de esa familia; no suma en ingresos. Un ingreso real (renta, nómina, venta) sigue siendo `ingreso`.

Todo lo de abajo está verificado contra el código de `a32725f` (fichero:línea).

---

## 1 · Dónde E2.4.2 mandó las devoluciones a `otros_ingresos` (lo que se corrige)

| Dónde | Qué hace hoy | Qué tiene que hacer |
|---|---|---|
| `src/services/clasificacion/reglasDuras.ts:139-140` | «entra + comercializadora (IBERDROLA, CURENERGIA, ENDESA, HOLALUZ, gas, agua…)» → `ingreso · otros_ingresos` · motivo «abono de la comercializadora · devolución de un suministro» | → `gasto · suministro · luz/gas/agua` en positivo · motivo «devolución de la comercializadora». **Es el punto del enunciado.** |
| `reglasDuras.ts:136-137` | «entra + ABONO POR DOMICILIACION / DEVOLUCION RECIBO / BONIFICACION» → `ingreso · otros_ingresos` | Ver decisión **D2**: separar la devolución de un recibo (gasto) de la bonificación (ingreso real). |
| `reglasDuras.ts:117-122` `porComercio()` | `if (!sale(m)) return undefined` · las 20 listas de proveedores de gasto (seguros, reparación, comunidad, telefonía…) **sólo disparan en negativo** | Disparar también en positivo → misma familia, motivo «devolución». Así «ABONO MAPFRE» o «TRANSFERENCIA MUTUA MADRILEÑA» en positivo caen en `seguros_alarmas`. |
| `reglasDuras.ts:150-151` | «entra + AEAT / HACIENDA / DEVOLUCION RENTA» → `ingreso · otros_ingresos` | **Se queda.** Hacienda no es un gasto de familia: es un ingreso real (§32.32). |
| `src/services/clasificacion/clasificarLinea.ts:68-79` `compatibleConSigno()` / `aplicar()` | Cualquier parcial (aprendida, identificador, concepto, recurrencia) con `naturaleza: gasto` o familia de gasto sobre un importe positivo **se descarta** | Admitir gasto en positivo (= devolución). Mantener el bloqueo simétrico (`ingreso` en negativo), que no es de este fix. |
| `clasificarLinea.ts:253` defecto | `naturaleza: naturalezaPorSigno(m.amount)` | **Se queda.** Un positivo sin proveedor de gasto reconocido sigue siendo ingreso. |
| `src/services/movementSuggestionService.ts:174-180` `respetandoElSigno()` + `src/services/sugerencias/signoDelMovimiento.ts:57-77` | La sugerencia por compromiso recurrente (vía A, incluida la **por identidad CUPS/contrato**, `:217-242`) y la regla aprendida se **anulan** si dicen «gasto» sobre un positivo | Es lo que impide atar la devolución de Curenergía **al CUPS y al piso** del compromiso. Hay que dejar pasar «gasto en positivo» como devolución (mismo criterio que `compatibleConSigno`). |
| `src/services/movementLearningService.ts:142-144, 155, 181` | La clave de aprendizaje lleva el **signo** | **Neutral · no se toca.** La regla aprendida del recibo (negativo) no dispara sobre el abono (positivo); una devolución confirmada aprende su propia regla. |
| `src/services/clasificacion/__tests__/reglasDuras.test.ts:39-49` | Los dos tests de «regla 2» fijan el comportamiento incorrecto (`otros_ingresos`) | Se reescriben con la regla nueva. |
| `docs/VERIFICACION-E2.4.2-motor-clasificacion-2026-09-06.md:67` | Documenta el matiz «`ingreso · otros_ingresos` porque el catálogo no admite…» | Se corrige apuntando a este fix. |

## 2 · Cómo se marca «devolución» sin cambiar la familia

**Hallazgo clave: el catálogo ya lo admite · no hace falta cambiar el esquema de familia.**

- `src/services/catalogo/catalogoUnico.ts:585-603` `motivosInvalidos()` exige que la familia sea de la naturaleza dicha y que el subtipo sea de esa familia. **No mira el signo del importe.** `{ naturaleza: 'gasto', familia: 'suministro', subtipo: 'luz' }` con `amount: +31.20` es una clasificación VÁLIDA hoy.
- Lo que hoy lo impide no es el catálogo sino tres filtros de **signo** (`compatibleConSigno`, `respetandoElSigno`, `porComercio`) y los escritores que fijan `naturaleza` por signo: `clasificarLinea.ts:253`, `src/services/lineaComoMovimiento.ts:106` (luego el motor la pisa con `...delMotor`, `:81`), `src/services/altaMovimientoService.ts:152-154, 169` (alta manual) y `:357-359, 370` (edición manual).
- No hay `esDevolucion`, `devolucion` ni nada parecido en `Movement`, `TreasuryEvent`, `LineaExtractoPersistida` ni en el catálogo (grep a cero). No hay dato heredado en juego: V93 (`db.ts:58`) retiró `Movement.type` sin migración y todos los escritores ponen `naturaleza` por signo, así que hoy **no existe ningún movimiento `gasto` en positivo**: el primero nacerá con este fix, con significado único.

**Mecanismo mínimo propuesto (D1 · recomendado): la marca es derivada, no un campo nuevo.**

```
esDevolucion(m) = m.naturaleza === 'gasto' && m.amount > 0
```

Un helper en `catalogoUnico.ts` junto a `naturalezaPorSigno`, y nada más: ni campo en `Movement`, ni índice, ni bump de `DB_VERSION`, ni migración (Regla A). Es exactamente la regla de Jose («el signo dice si pagas o te devuelven; la familia + punto atan el neto»), y no puede desincronizarse (un flag `esDevolucion: true` sobre un importe negativo sería una contradicción que habría que vigilar en cada escritor). El motor deja el **motivo** en la línea («devolución de la comercializadora») y la ficha puede enseñar «Devolución» leyendo el helper.

Alternativa (no recomendada): campo opcional `Movement.esDevolucion?: true`. Misma ausencia de bump, pero un segundo sitio donde puede mentir y una casilla más en cada ficha que escribe movimientos.

`sentidoDe`/`conSigno` (`catalogoUnico.ts:76-86`: `gasto` → siempre `sale`) no se tocan: se usan sobre `TreasuryEvent` (`tesoreriaV6Metrics.ts:53 importeConSigno`), que guarda magnitud. Una **previsión** de devolución (regularización futura) queda fuera de este fix.

## 3 · Agregados donde un gasto en positivo tiene que RESTAR

| Agregado | Fichero:línea | Hoy | Con el fix |
|---|---|---|---|
| KPI «cuánto gané / cuánto gasté» (Realidad) | `src/services/tesoreriaV6Metrics.ts:649-655` `calcularRealidad` | Por **signo** del `Movement`: `amount > 0` → `realIngresos`; si no `realGastos += Math.abs` | Devolución → `realGastos -= amount` (neto), nunca a `realIngresos`. |
| «pagado de lo confirmado» | `tesoreriaV6Metrics.ts:636-645` | `Math.abs(m.amount)` sin mirar signo | Excluir la devolución (no es un pago) o restarla · se decide al ver el uso en la implementación; se documenta. |
| Serie de caja por cuenta y día (entrada/salida confirmada) | `tesoreriaV6Metrics.ts:774-787` | Por signo: `entradaConf` / `salidaConf` | Ver **D3**. Recomendación: **se queda por signo**. Es la caja de la cuenta, y el dinero de la devolución entra de verdad; lo que se netea es el gasto por familia, no la caja. |
| **Fila fiscal / coste del piso** (`gastosInmueble`) | `src/services/altaMovimientoService.ts:452` `gastoDesdeMovimiento` → `src/services/cierreLineaInmueble.ts:196-206` `camposDeCierre` · `importe: Math.abs(movimiento.amount)` («el signo vive en el movimiento») | Una devolución de ámbito inmueble nacería como una fila de gasto de +31,20 → **suma en costes del piso y DEDUCE en IRPF** | `importe` con signo negativo cuando `esDevolucion` (magnitud negativa). Con eso restan solos: `src/services/gastoDeducible.ts:73-95` `sumaDeducidaPorCasilla` (suma `g.importe` tal cual) y `src/modules/inmuebles/components/CostesInmueble.tsx:101-112, 175` (suma `importeReal`). Los cuatro que llaman a `gastoDesdeMovimiento` (`aprendizajeEnSesion.ts:47`, `DrawerExtracto.tsx:511`, `confirmarDecisiones.ts:276`, `cierrePorDefinicion.ts:72`) ya pasan el importe con signo → **un solo punto de cambio**. En la implementación se repasan los demás lectores de `gastosInmueble.importe` (`propertyExpenses`, `rentabilidadInmuebleAdapter.ts:171`, `fiscalCacheService`, `estimacionFiscalEnCursoService`) por si alguno hace `Math.abs` o filtra `> 0`. |
| Previsiones (dashboard, panel, proyección) | `src/services/dashboardService.ts:1333, 1463-1466, 1565, 1607` · `src/modules/panel/PanelPage.tsx:95-100` | Suman `TreasuryEvent` por `naturaleza` (magnitudes) | **No se tocan**: son previsiones, y una devolución prevista está fuera de alcance. |

**Hallazgo inesperado (D4) · la devolución cerraría la cuota del mes.** `origenIdRecurrenteDelGasto(inmuebleId, familia, fecha)` (`altaMovimientoService.ts:609-`) busca el compromiso por **piso + familia**, y `gastoDesdeMovimiento` (`:540-560`) con ese `origenIdRecurrente` **cierra la fila `recurrente-<compromiso>-<año>-<mes>`** sobrescribiendo su importe. Una devolución de Curenergía de septiembre (suministro · piso 3) pisaría la fila de la cuota de septiembre con −31,20 y la cuota real de −48 desaparecería del coste. Propuesta: cuando `esDevolucion`, **no se pasa `origenIdRecurrente`** → la devolución es siempre una fila propia de la misma familia y piso, y el neto sale de la suma (cuota −48 + devolución +31,20 → 16,80 de luz ese mes). Es lo que dice el enunciado (§4: basta familia + proveedor + piso, sin enlazar la factura exacta).

**Alta y edición manual** (`altaMovimientoService.ts:152-154, 169` y `:357-370`): el signo lo fija `tipo` (`ingreso` → +) y la naturaleza se pone por signo. Si el usuario anota a mano una devolución (tipo ingreso + familia `suministro`), hoy sale `naturaleza: ingreso` con familia de gasto = clasificación **inválida** por catálogo. Mínimo: `naturaleza = familia ? naturalezaDe(familia) : naturalezaPorSigno(importe)` en esos dos puntos (la familia manda, como ya hace `reclasificar()` en `catalogoUnico.ts:614-624`).

## 4 · Los ingresos reales no cambian

- Las reglas de ingreso real siguen siendo explícitas y **van antes** que las de proveedor de gasto en `REGLAS`: disposición `:128`, nómina `:147`, Hacienda `:150`, pensión `:153`, fianza `:158`, efectivo `:164`, recarga `:169`, dividendo/interés `:180-183`, alquiler `:214`. `reglasDuras.ts:261` acumula «la primera naturaleza gana», así que abrir `porComercio` al positivo no las pisa.
- El **defecto** sigue siendo por signo (`clasificarLinea.ts:253`): «ABONO TRANSFERENCIA DE NOMBRE APELLIDO +400» (fixture Sabadell línea 8) sigue siendo `ingreso` sin familia; «BIZUM DE ALGUIEN +50» sigue siendo `ingreso`.
- El único caso que cambia de naturaleza es un positivo con **proveedor de gasto reconocido en el texto** (comercializadora, aseguradora, reparador, comunidad…) o con **compromiso de gasto por identidad** (CUPS/contrato). Es exactamente el conjunto que Jose ha definido como devolución.
- Riesgo asumido y documentado: un inquilino que transfiere «LUZ AGOSTO +45» caerá en `suministro · luz` positivo. En el modelo de Jose eso **es** una devolución del gasto del piso (resta de la luz), así que es el resultado deseado, no un fallo.

## 5 · Decisiones que necesito de Jose antes de tocar código

- **D1 · Marca de devolución = derivada** (`naturaleza gasto` + importe positivo, helper `esDevolucion`), sin campo nuevo ni bump. Alternativa: campo `esDevolucion?: true`. **Recomiendo derivada.**
- **D2 · «ABONO POR DOMICILIACIÓN» / «DEVOLUCIÓN RECIBO» sin proveedor reconocible.** (a) `gasto` **sin familia** en positivo → queda «sin clasificar», el usuario elige de qué gasto es (la familia se aprende y la siguiente cae sola); «BONIFICACIÓN» se separa y sigue siendo `ingreso · otros_ingresos` (es dinero nuevo del banco, no la vuelta de un recibo). (b) dejarlo todo como hoy en `otros_ingresos`. **Recomiendo (a).**
- **D3 · Serie de caja por cuenta y día** (`entradaConf/salidaConf`): (a) por signo, la devolución es una entrada de caja (recomendado); (b) restarla de la salida del día.
- **D4 · La devolución nunca cierra la fila mensual del compromiso** (`origenIdRecurrente` no se pasa cuando es devolución): fila propia, misma familia y piso, y el neto sale de la suma. **Recomiendo sí.**

## 6 · Alcance de código previsto (si D1-D4 van como se recomienda)

Sin bump de `DB_VERSION`, sin migración, sin campo nuevo, sin cambio de esquema del catálogo.

1. `catalogoUnico.ts` · helper `esDevolucion()`.
2. `clasificarLinea.ts` · `compatibleConSigno` admite gasto en positivo (ingreso en negativo sigue bloqueado).
3. `reglasDuras.ts` · `porComercio` en ambos signos con motivo «devolución» en positivo; regla `:139` a `suministro` con subtipo; regla `:136` partida según D2.
4. `movementSuggestionService.ts` / `signoDelMovimiento.ts` · una propuesta de gasto sobre un positivo no se anula (devolución).
5. `cierreLineaInmueble.ts` `camposDeCierre` · importe negativo cuando es devolución; `altaMovimientoService.ts` · no cerrar la fila recurrente (D4) y naturaleza desde la familia en alta/edición manual.
6. `tesoreriaV6Metrics.ts` `calcularRealidad` · la devolución resta de `realGastos`.
7. Tests: `reglasDuras.test.ts` (Curenergía positivo → `suministro · luz` + devolución; «ABONO POR DOMICILIACIÓN»; renta positiva NO es devolución), test de neto (`calcularRealidad` y `sumaDeducidaPorCasilla`: cuotas − devolución), test de `gastoDesdeMovimiento` con devolución (fila propia, importe negativo, no cierra la cuota). Fixture: ninguno de los cinco CSV lleva Curenergía (sólo Iberdrola/Visalia en negativo en Sabadell); se añade una línea «TRANSFERENCIA CURENERGIA SAU +31,20» al fixture Sabadell para el test de extremo a extremo.
8. Docs: este preflight + `VERIFICACION-E2.4.2-fix-devoluciones` con lo hecho; corregir el matiz de `VERIFICACION-E2.4.2-motor-clasificacion` §3.

Verificación de salida: `tsc` limpio · trinquete igual que main (todos ≤ 230, ficheros ≥ 800 líneas = 37) · suite sin rojas nuevas respecto a la base (24 suites / 100 tests en rojo heredadas).
