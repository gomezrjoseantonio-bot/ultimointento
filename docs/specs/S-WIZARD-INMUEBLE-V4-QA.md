# QA · S-WIZARD-INMUEBLE-V4 · sub-tarea 5

Validación tras implementación. Build green · type check green ·
43 test suites failing (igual a baseline pre-existente · ningún
nuevo fallo introducido).

## Cero hex hardcoded
```
$ grep -nE "#[0-9a-fA-F]{3,8}\b" src/pages/inmuebles/InmueblePage.module.css src/pages/inmuebles/InmueblePage.tsx
(sin coincidencias)
```
Todos los colores vienen de `--atlas-v5-*` (design system v5 cargado en
`src/index.tsx`). `rgba(...)` se usa sólo para overlay translúcido, sombras
de modal y focus rings · acordes a tokens (componentes brand-ink y gold).

## Sentence case
Sin MAYÚSCULAS innecesarias en copy visible · "Tipo de activo", "Identificación",
"Compra y coste", "Características físicas", "Datos fiscales", "Uso y alquiler",
"Mejoras previas", "Mobiliario", "Foto del inmueble". Header de bloque en
uppercase con `letter-spacing: 0.5px` · estilo `.blockHdTitle` (no copy).

## Accesibilidad
- `role="dialog"` + `aria-modal="true"` + `aria-label={headerTitle}` en el
  overlay
- `Esc` cierra el modal (handler global con `keydown`)
- Botón cerrar con `aria-label="Cerrar"`
- Tarjetas de tipo y uso con `aria-pressed={selected}`
- Toggles de bloques con `aria-pressed={on}` y `aria-label` dinámico
- Botones eliminar de mejoras/muebles con `aria-label`
- Inputs asociados a `<label>` con texto visible + opcional `*` (req)
- Tab order coherente (form → footer)

## Visibilidad condicional
Verificada por tabla §3 del spec ·
| Tipo | hab/baños | anexos | Uso | "vivienda habitual" |
|---|---|---|---|---|
| piso | sí | sí | sí (6 cards) | sí |
| parking | NO | NO | NO | NO |
| trastero | NO | NO | NO | NO |
| local | NO | NO | sí (4 cards) | NO |
| otro | NO | NO | sí (4 cards) | NO |

Implementado en `handleTipoChange` · normaliza estado al cambiar tipo
(habitaciones/baños a 0, anexos a false, alquiler por habitaciones a inactivo).

## Preview live
Recalcula vía `useMemo` sobre `form` cada vez que cambia cualquier campo
numérico. `calcularInmuebleResumen()` es función pura · cero efectos · 6
tests unitarios cubren caso del mockup, mejoras vs reparaciones, fallback
V.cat, prorrateo, casos vacíos.

## Tests pre-existentes
43 suites failing · IGUAL a baseline. NO se han arreglado (regla §0.7 del
spec). 144 tests failing son pre-existentes · 1227 tests passing.

## Caso del mockup · Piso Centro Madrid
Input · precio 245.000 € · formalización 3.050 € · impuestos 14.700 € ·
V.cat total 89.500 € · V.cat construcción 53.700 € · 365 días arrendado.

Output · coste base 262.750,00 € · % construcción 60,00 % · base
amortizable 157.650,00 € · amortización 4.729,50 €. **Coincide al céntimo
con el mockup**. Test unitario `caso del mockup · Piso Centro Madrid ·
coincide al céntimo` lo verifica automáticamente.

## DB_VERSION
Sigue v70 · sin cambio · IndexedDB es schema-less en campos. Schema TS de
Property extendido con campos opcionales: `valorReferencia`, `anexos`,
`usoTipo`, `alquilerPorHabitaciones`. Sin migración necesaria.
