# VERIFICACIÓN · E2.4.2-fix · devoluciones y reembolsos

**Fecha:** 2026-09-08 · **Base:** `56cd4f7` (main, con el preflight de este fix) · **Regla A:** sin migración · **DB_VERSION:** 94, sin tocar.

Preflight previo: `VERIFICACION-E2.4.2-fix-preflight-devoluciones-2026-09-06.md` (PR #1865, ya en main).

## Qué se arregla

Curenergía cobra una cuota fija todos los meses y cada seis regulariza, devolviendo lo que sobró. E2.4.2 mandaba ese abono a `ingreso · otros_ingresos`, y eso descuadraba el neto del piso por los dos lados a la vez: la luz seguía costando los 48 € enteros y los ingresos subían 31,20 € que nadie había ganado.

La regla que se implementa (Opción A · Jose · §7 del DEFINITIVO): **una devolución es un movimiento de la misma familia que el gasto, con signo positivo**, atado al mismo proveedor / punto / piso. Resta de esa familia. No suma en ingresos. Generaliza al seguro que reintegra y a la reparación reembolsada.

## Las cuatro decisiones, tal como se han implementado

Se implementaron las opciones recomendadas en el preflight. Ninguna necesitó tocar el esquema de familia del catálogo.

- **D1 · La marca es derivada, no un campo.** `esDevolucion(x)` = naturaleza `gasto` con importe positivo (`catalogoUnico.ts`). Sin campo nuevo en `Movement`, sin índice, sin bump, sin migración. Un flag aparte podría contradecir al importe; la pareja naturaleza+signo no puede.
- **D2 · «Recibo devuelto» y «bonificación» se separan.** La bonificación es dinero nuevo del banco y sigue siendo `ingreso · otros_ingresos`. El recibo devuelto pasa a ser una devolución **sin familia**: vuelve dinero de un gasto, pero el concepto no dice de cuál. Si el proveedor aparece en el texto, la familia la pone la regla de comercio.
- **D3 · La caja diaria por cuenta sigue por signo.** La devolución entra de verdad en la cuenta; lo que se netea es el gasto por familia, no la caja.
- **D4 · La devolución nunca cierra la fila mensual del compromiso.** Es fila propia, misma familia y piso, y el neto sale de la suma.

## Lo que se ha tocado

| Fichero | Cambio |
|---|---|
| `catalogo/catalogoUnico.ts` | Nuevo `esDevolucion()`, junto a `naturalezaPorSigno`. |
| `clasificacion/clasificarLinea.ts` | `compatibleConSigno` admite gasto en positivo. El bloqueo simétrico (ingreso en negativo) se queda. Una regla **aprendida** no puede convertir un abono en devolución. |
| `clasificacion/reglasDuras.ts` | `porComercio` dispara en los dos signos, con motivo «devolución de ese gasto» en positivo. `ABONO_DOMICILIACION` se parte en `BONIFICACION` (ingreso) y `DEVOLUCION_RECIBO` (devolución sin familia). Fuera la regla que mandaba el abono de la comercializadora a `otros_ingresos`. La regla de ingreso del **alquiler** sube por encima de su regla de comercio. |
| `sugerencias/signoDelMovimiento.ts` | Una propuesta de **compromiso reconocido** (`create_treasury_event` de gasto) ya no se anula sobre un abono: es lo que ata la devolución al CUPS y al piso. Traspaso, renta y regla aprendida siguen bloqueados. |
| `tesoreriaV6Metrics.ts` | `calcularRealidad`: la devolución resta del gasto y no suma en ingresos. |
| `cierreLineaInmueble.ts` | `camposDeCierre` gana un tercer argumento, `elImporteTraeSigno`. Con él, un abono nace como línea negativa. |
| `altaMovimientoService.ts` | `gastoDesdeMovimiento` pasa ese argumento (su importe viene con signo) y no cierra la fila del compromiso cuando es devolución. |

## El orden de las reglas, que es donde estaba la trampa

Abrir los comercios a los dos signos tiene un efecto que no se ve leyendo la regla sola: `ALQUILER` es la única lista que significa **cosas distintas según el signo** —en negativo es un alquiler que pagas, en positivo es la renta que cobras— y su regla de comercio estaba escrita **antes** que su regla de ingreso. Sin moverla, la renta de un piso habría pasado a leerse como la devolución de un alquiler pagado: el ingreso más importante del negocio, restando de un gasto. Ahora la de ingreso va primero, y hay un test que lo fija.

Las demás listas de ingreso real (nómina, Hacienda, pensión, dividendo, interés, fianza, efectivo) ya estaban por encima de los comercios y no hizo falta tocarlas.

## Dos cosas que el preflight dejaba abiertas y se han resuelto solas

**«Pagado de lo confirmado» no necesitaba cambio.** Ese bucle ya se salta los importes positivos (`if (m.amount >= 0) continue`), así que una devolución nunca se cuenta como un pago imprevisto.

**`camposDeCierre` no podía deducir el signo.** Aquí apareció el segundo hallazgo, y es el que habría hecho daño de verdad: los dos caminos que llaman a esa función **no pasan lo mismo**. La conciliación pasa el `Movement` del banco, que lleva su signo; `treasuryConfirmationService` pasa el importe del **evento**, que es una magnitud (el sentido lo lleva la naturaleza, no el número). Deducir la devolución del signo convertía **cada recibo confirmado desde una previsión** en una devolución de su propio importe. Por eso el signo no se adivina: lo declara quien llama.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npx react-scripts build` (CI=true, como Netlify) | limpio, sin warnings que rompan |
| Suite completa | **24 suites / 100 tests en rojo · exactamente los mismos que main**, ninguno nuevo |
| Trinquete (`node scripts/health.mjs`) | ✓ ningún indicador empeoró (`archivos_800` sigue en 37) |
| `DB_VERSION` | 94 · sin bump, sin migración |

Tests nuevos (`catalogo/__tests__/devoluciones.test.ts`, 9 casos) y reescritos (`clasificacion/__tests__/reglasDuras.test.ts`, `fixturesBancos.e242.test.ts`, `conciliacionDatosReales.test.ts`):

- Curenergía en positivo → `gasto · suministro · luz` con motivo de devolución, y el recibo de Iberdrola en negativo sin cambios.
- El neto: dos cuotas de 48 € y una devolución de 31,20 € dan **64,80 € de gasto y 0 € de ingreso**.
- El IRPF: la misma resta en `sumaDeducidaPorCasilla`, prorrateo incluido cuando el piso solo estuvo alquilado parte del año.
- La renta positiva, la nómina y la devolución de Hacienda siguen siendo ingreso.
- «ABONO NOMINA» de 1.840 € con una regla aprendida de gasto **no** se convierte en devolución.
- El fixture de Sabadell lleva ahora la regularización de Curenergía y se clasifica de punta a punta.

Los números honestos del fixture Sabadell pasan a 9 líneas, 6 con familia, 3 sin ella. `conFamilia` no sube con la línea nueva a propósito: Curenergía gana familia y el abono de domiciliación pierde la que tenía, porque `otros_ingresos` era mentira.

## Lo que queda fuera, dicho

- **El reembolso cruzado** (el seguro que paga una reparación concreta) sigue siendo enlace manual, como pedía el encargo.
- **Anotar una devolución a mano.** El preflight proponía que la familia mandase sobre el signo en el alta y la edición manuales. Se probó y se retiró: ahí el «tipo» que elige el usuario dice la dirección, y hacerlo cambiaba lo que ya significa corregir un apunte (pasar un gasto a ingreso dejaba de funcionar). La devolución que importa —la del banco— entra clasificada por el motor. Queda pendiente decidir cómo se anota una a mano, cuando haga falta.
- **Las previsiones de devolución.** Una regularización futura sigue sin poder preverse: los `TreasuryEvent` guardan magnitud y el sentido lo pone la naturaleza. Fuera de este fix.
- **Un caso que conviene mirar:** un premio de lotería o de apuestas cae ahora en `ocio` en positivo, o sea que resta de lo gastado en apuestas en vez de contar como ingreso. Es coherente con la regla («cuánto me dejo en esto, neto»), pero es una decisión que no estaba en el encargo. Si prefieres que sea ingreso, es sacar `OCIO_APUESTAS` de los comercios de doble signo.
