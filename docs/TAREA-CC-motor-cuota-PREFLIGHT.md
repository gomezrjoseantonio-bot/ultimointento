# TAREA-CC · Motor central de cuota y capital vivo · PREFLIGHT

Resultado del §3 de la tarea, ejecutado **antes de escribir una línea de
implementación**. Los anclajes de la tarea vienen de documentación del
proyecto que estaba stale; aquí está lo que hay de verdad en el repo, medido.

Hay **tres cosas que no coinciden** y una de ellas es la verificación numérica
obligatoria del §6.4. Por eso esto es un **alto y reporte**, no un preámbulo.

---

## 1 · Lo que la tarea supone y no es así

| Anclaje de la tarea | Lo que hay | |
|---|---|---|
| `DB_VERSION` 53 / 64 / 70 / 84 | **87** (`src/services/db.ts:56`), con una migración post-open V88 | stale |
| `prestamo.plazoMeses` | `plazoMesesTotal` | stale |
| `prestamo.diaCobro` | `diaCargoMes` | stale |
| `prestamo.tin` | `tipoNominalAnualFijo` / `tipoNominalAnualMixtoFijo` / `indice`+`diferencial` | stale |
| `keyval['planpagos_${id}']` como caché | migrado a `prestamos.planPagos` en T15.3 (`src/App.tsx:334`) | ya no existe |
| «crear `loanScheduleService`» | ya existe un motor único en `src/services/prestamos/` | ver §3 |

Ninguna de estas rompe nada: son nombres. Las apunto para que la tarea no se
lea como un contrato con el modelo real.

## 2 · El punto crítico del §3 · **sí, el modelo ya lo representa**

La pregunta era si `Prestamo` sabe de tramos y de bonificaciones
estructuradas. Sí, las dos:

- **Tramos** · `tramoFijoMeses`, `tipoNominalAnualMixtoFijo`, `indice`,
  `diferencial`, `valorIndiceActual`, `revisionesDeTipo[]`,
  `baseCalculoIntereses`.
- **Bonificaciones** · `bonificaciones[]` con `reduccionPuntosPorcentuales`
  (en **puntos**, `1.0` = −1,00 p.p.), `regla` declarativa, `estado`;
  más `topeBonificacionesTotal`, `graciaMesesBonificaciones` y
  `bonificacionesDesde: 'FIRMA' | 'TRAMO_VARIABLE'`.

Así que **no hay que parar por aquí** y esta tarea no depende del asistente.

## 3 · No hay dos motores · hay un motor y una capa que lo esquiva

Esto cambia la decisión de arquitectura del §4 de la tarea.

`src/services/prestamos/` **ya es** el motor único y ya hace lo que la tarea
pide construir:

```
cuadro.ts            generarCuadro(prestamo) -> { plan, resumen }
tramosDeTipo.ts      tramosDeTipo(p) · tramoVigente(p, dia)
tinDelTramo.ts       tinDelTramo(p, tramo) · aplica bonificaciones y tope
cuotaFrancesa.ts     LA fórmula, una sola vez
cuadroPorTramos.ts   recalcularDesde(plan, revision)
baseDeCalculo.ts     30/360 · ACT/360 · ACT/365
carencia.ts · comisiones.ts · amortizarAnticipado.ts · tae.ts · topesLegales.ts
```

Y `prestamosCalculationService.generatePaymentSchedule` **ya delega** en él
(`src/services/prestamosCalculationService.ts:334` → `generarCuadro(p).plan`).
O sea que el servicio viejo que la tarea propone extender ya es una fachada
del motor nuevo.

**El problema real está un piso más arriba.** `src/modules/financiacion/helpers.ts`
es una **segunda implementación** que no pasa por el motor:

| `helpers.ts` | qué hace | por qué está mal |
|---|---|---|
| `cuotaMensualConTin` :98 | reescribe la anualidad francesa | segunda copia de la fórmula |
| `cuotaMensualAprox` :110 | cuota sobre `principalVivo` y plazo restante **a un solo tipo** | un mixto se proyecta entero al tipo de hoy |
| `fechaVencimiento` :116 | `fechaFirma + plazoMesesTotal` | ignora carencia, días sueltos y amortizaciones |
| `cuotasDelAnio` :329 | si no hay plan, **doce meses de cuota plana** | inventa un cuadro |
| `upcomingCuotasFromPlanes` :289 | mismo fallback | idem |
| `bancoFromNombre` :127 | saca el banco de la **primera palabra del nombre** | `Prestamo.banco` existe (`types/prestamos.ts:346`) y no se lee |

De ahí salen los defectos del §5 de la tarea, y son todos **el mismo defecto**:

- **D1** (la cuota cambia según la pantalla) · el asistente usa `generarCuadro`
  (`PrestamoPageV2.tsx:983`), Listado/Dashboard/Snowball usan
  `cuotaMensualAprox`. Dos números para una cuota.
- **D2** (mixto congelado) · `cuotaMensualAprox` usa `effectiveTIN`, que es el
  del tramo de **hoy**, aplicado a **todo** el plazo restante.
- **D3** (el variable ignora bonificaciones) · no es cierto ya:
  `tinDelTramo` las aplica. Lo que falla es que la cuota que se enseña no sale
  del cuadro.
- **D4** (orden del snowball, «libre en enero 2037») · `SnowballPage.tsx:44`
  ordena por `intDeducibles`, y el vencimiento sale de `fechaVencimiento`
  aproximada.
- **D6** («9 entidades») · `DashboardPage.tsx:69` cuenta
  `new Set(rows.map(r => r.banco))`, y `r.banco` es la primera palabra del
  nombre libre. Si los nombres no llevan separador, cada préstamo es su
  propia entidad.

**Propuesta de arquitectura** (distinta de las dos opciones de la tarea):
no crear un tercer servicio. Vaciar `helpers.ts` contra el motor que ya existe
y exponer el API del §4 (`getCuota`, `getCapitalVivo`, `getDesgloseCuota`,
`getTinVigente`, `getFechaVencimiento`, `getInteresDeducible`) como funciones
que leen del `Cuadro`. Es menos código nuevo y mata la copia en vez de
añadirle una tercera.

## 4 · La verificación numérica del §6.4 · **falla una, y explica todas**

Medido con `generarCuadro` sobre la Unicaja real (85.000 €, 240 m, 2,600 %
los primeros 36, después euríbor 4,149 + 1,750, bonificación −1,00, ACT/365):

| | Tarea | Motor | |
|---|---|---|---|
| Cuota tramo fijo | **454,66 €** | **454,57 €** | ✗ **−0,09** |
| Capital tras 36 cuotas | ≈74.888 € | 74.893,66 € | ~ |
| TIN bonificado | 4,90 % | 4,899 % | ✓ |
| Cuota variable bonificada | ≈542 € | 541,69 € | ✓ |
| Cuota variable teórica | ≈582 € | 582,30 € | ✓ |
| Sabadell 24.500 € / 96 m / 4,49 % | ≈304 € | 304,25 € | ✓ |

Los 0,09 € son **el aviso de Jose de ayer** («la cuota no son 454,57 son
454,66»), y ya sé de dónde salen.

`cuotaFrancesa` calcula la anualidad clásica con `i = TIN/12`, **sea cual sea
la base de cálculo**. Pero la escritura de Unicaja liquida en **ACT/365**, y
el banco resuelve la cuota constante que amortiza a cero **contando los días
reales del calendario 25→25**. Esa cuota es:

```
i = TIN · días_del_periodo / 365, calendario real desde 2023-08-25
cuota constante que deja saldo 0 en la cuota 240  ->  454,6599 €
la misma cuenta en 30/360                         ->  454,5698 €
```

**454,66 al céntimo.** No es un redondeo del banco ni una comisión escondida:
es que **la base de cálculo también mueve la cuota**, no solo el desglose.

Y eso convierte en falso el comentario que encabeza `baseDeCalculo.ts`:

> «La cuota de un préstamo francés se calcula siempre igual, con el tipo entre
> doce. Pero el interés que el banco liquida cada mes no sale de ahí.»

La primera frase no se sostiene contra la escritura. Es la misma enfermedad de
siempre: un comentario que afirma algo que nada comprueba. (El pie del
formulario dice lo mismo con otras palabras y también hay que corregirlo.)

Nota de coherencia: los ≈74.888 € que la tarea da como capital tras 36 cuotas
**solo salen si la cuota es 454,66**; con 454,57 el motor da 74.893,66. O sea
que las cifras del §6.4 son consistentes entre sí y el motor es el que se
desvía, en un único sitio.

### Consecuencia hoy

Un préstamo ACT/365 o ACT/360 **no cierra en cero**: el cuadro acumula la
deriva y la última cuota la absorbe. En la Unicaja son ~21 € al final del
plazo. Nadie lo ha visto porque nadie mira la cuota 240.

## 5 · Lo que hace falta decidir antes de seguir

1. **La anualidad con base de cálculo.** Resolver la cuota contando días
   reales cuando la base es ACT/365 o ACT/360, y dejar la fórmula clásica
   cuando es 30/360 (donde coinciden). Toca `cuotaFrancesa`, que es LA
   fórmula, así que **mueve el cuadro de todo préstamo que tenga base ACT**.
   Los de 30/360 —el defecto— no se mueven ni un céntimo.
2. **La arquitectura del §3** de este documento: vaciar `helpers.ts` en vez de
   crear un tercer servicio.
3. **D6**: leer `Prestamo.banco` y dejar de adivinarlo del nombre. Los
   préstamos ya guardados pueden tenerlo vacío.

Sin bump de `DB_VERSION` en ningún caso: no hace falta store ni índice nuevo.
