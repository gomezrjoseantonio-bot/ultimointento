# Deuda · el alquiler propio no tiene dirección, y por eso la fila dice solo "Alquiler"

**Abierta:** 2 agosto 2026 · vista en Tesorería V6 §4.9 (el día del calendario)
**Estado:** anotada por decisión de Jose · **no se toca hasta resolver el tema de la dirección**

---

## El síntoma

En el día del calendario aparece una fila así:

```
Alquiler                                          −1.350,00 €
```

Sin piso. Al lado, los alquileres que Jose **cobra** dicen `Alquiler · Tenderina 64 4IZ`,
`Alquiler · Carles Buigas 15`… El contraste hace que la fila desnuda parezca un fallo de la
lista.

No lo es. **Es el alquiler que Jose paga**, el de su propia vivienda, y ese gasto no tiene
ningún inmueble al que apuntar.

## Por qué no lo tiene

El alquiler de la vivienda habitual no es un `property`. Los `properties` son los inmuebles
de inversión: los que se alquilan, se amortizan y se declaran. La casa en la que uno vive
—de alquiler— no es ninguna de esas cosas.

Vive como **compromiso recurrente de ámbito personal** con `categoria: 'vivienda.alquiler'`
y el flag `esViviendaHabitual` (`src/types/compromisosRecurrentes.ts:248`), que es lo que
alimenta la deducción autonómica por alquiler
(`src/services/fiscal/alquilerViviendaHabitualService.ts`).

Y un compromiso personal **no lleva dirección**. Lleva `personalDataId`, no `inmuebleId`
(`compromisosRecurrentes.ts:193-195`). La única ficha que tuvo dirección de verdad —
`ViviendaHabitual`, con su `DireccionVivienda` (`src/types/viviendaHabitual.ts:17`) — se
retiró del producto en la Fase 4, y su servicio quedó como lector legacy:

> «La ficha «Mi vivienda» se retiró del producto. El modelo unificado es: Recibos del hogar
> → Personal → Gastos (compromisosRecurrentes · flag `esViviendaHabitual`)»
> — `src/services/personal/viviendaHabitualService.ts:5`

Así que hoy **no hay dónde guardar la dirección de la casa en la que vives**. El dato no se
ha perdido: nunca se le pidió al usuario por esta vía.

## Por qué no se arregla con un `??`

La tentación es rellenar el hueco en la fila: poner "Vivienda habitual", "Mi casa" o el
concepto bancario del recibo. Sería inventar en pantalla un dato que el sistema no tiene
(§2.2), y encima lo escribiría cada vez que aparece la fila, en cuatro vistas distintas.

La fila dice "Alquiler" porque **eso es todo lo que se sabe**. Es la respuesta correcta al
estado actual de los datos. Lo que falta está aguas arriba.

## Lo que habría que decidir (cuando toque)

1. **Dónde vive la dirección de la vivienda habitual.** Es un dato de Personal, no de
   Inmuebles: entra en el IRPF (deducción autonómica, domicilio fiscal) y en el día a día
   (a qué casa pertenece este recibo de luz). Candidato natural: `personalData`, no una
   ficha resucitada.
2. **Si un compromiso personal de vivienda puede apuntar a ella**, para que la fila del
   calendario pueda decir `Alquiler · <la calle>` con el mismo formato que los cobrados.
3. **Qué pasa con los suministros de la vivienda habitual**, que tienen exactamente el
   mismo problema y hoy pasan desapercibidos porque su concepto ya nombra a la compañía.

## Dónde mirar cuando se retome

| Qué | Dónde |
|---|---|
| El compromiso personal y su falta de dirección | `src/types/compromisosRecurrentes.ts:193` |
| El flag de vivienda habitual | `src/types/compromisosRecurrentes.ts:248` |
| La ficha retirada que sí tenía dirección | `src/types/viviendaHabitual.ts:17` · `src/services/personal/viviendaHabitualService.ts` |
| Quien pone el inmueble en la fila | `src/services/punteo/punteoAdapter.ts` · `piezasDeFila` |
| Quien lo pinta | `src/modules/shared/components/Punteo/PunteoList.tsx` |
