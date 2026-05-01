# T23 · Verificación end-to-end · Inversiones · galería + fichas

> **Sub-tarea 23.5** · TAREA 23 cierre · § 6.1 spec.
>
> Documento de verificación manual con 9 escenarios. Cubre el flujo
> completo de la galería v2 (sustituye los 4 tabs T20) · wizard de
> nueva posición · aportar a posición existente · fichas detalle por
> grupo de tipo · vista expandida de "Posiciones cerradas" con
> narrativa de inversor (NO fiscal).

---

## Pre-condiciones

- DB local en versión 65 (`AtlasHorizonDB`) · sin cambios de schema entre
  T22.* y T23.*
- Al menos 1 `PosicionInversion` en el store · idealmente las dos del
  usuario actual (`ORANGE ESPAGNE SA` · `Plan de pensiones`)
- (Opcional) 1 ejercicio fiscal con `aeat.declaracionCompleta.gananciasPerdidas`
  importado para poblar la vista de cerradas con datos del XML AEAT

---

## Escenario 1 · Galería principal

**Flujo · UI productiva**

1. Abrir `/inversiones`
2. La galería renderiza con page-head canónico
3. Cards heterogéneas en grid 3 cols · `ORANGE ESPAGNE SA` (acción) y
   `Plan de pensiones` (plan) · ordenadas por valor desc
4. Última card · "Añadir posición" (dashed border)

**Validación**

- [ ] Page-head muestra 2 botones · `[+ Aportar]` (ghost) y `[+ Nueva posición]` (gold)
- [ ] NO aparecen los botones legacy `[Importar IndexaCapital]` y `[Importar aportaciones]`
- [ ] NO aparecen las 4 tabs (Resumen · Cartera · Rendimientos · Individual)
- [ ] Cada carta tiene · logo + chip tipo + nombre + valor mono + delta + footer
- [ ] Carta con `aportaciones.length < 2` muestra placeholder "datos insuficientes para gráfico"
- [ ] Carta `Plan de pensiones` (tipo `plan_pensiones`) tiene border-top brand
- [ ] Carta `ORANGE ESPAGNE SA` (tipo `accion`) tiene border-top pos
- [ ] Hover en carta · border-color gold + translateY -2px + shadow + footer-cta visible

---

## Escenario 2 · Click en carta · ficha valoración simple (Plan PP)

**Flujo**

1. Click en la carta `Plan de pensiones`
2. Navega a `/inversiones/{id}` · ruta dinámica
3. Renderiza `<FichaValoracionSimple>` (dispatcher T23.3)

**Validación**

- [ ] URL es `/inversiones/{id}` con el ID real
- [ ] Header · botón `Volver a Inversiones` · título · chip tipo (`Plan PP`)
- [ ] 4 KPIs · Aportado · Valor actual · Rentabilidad · CAGR
- [ ] CAGR=0 muestra `+0.00%` (no "—") · valor=aportado caso común
- [ ] Sparkline gigante O placeholder coherente "Datos insuficientes"
- [ ] Panel composición · placeholder TODO ("Aún no hay datos de composición")
- [ ] Tabla aportaciones · vacía si `aportaciones.length === 0` con CTA
- [ ] Botones acción · `[Actualizar valor]` · `[Aportar]` · `[Editar posición]`
- [ ] Click `[Volver a Inversiones]` regresa a `/inversiones`

---

## Escenario 3 · Click en carta · ficha dividendos (acción)

**Flujo**

1. Click en la carta `ORANGE ESPAGNE SA`
2. Navega a `/inversiones/{id}`
3. Renderiza `<FichaDividendos>`

**Validación**

- [ ] Chip tipo `Acción`
- [ ] 4 KPIs · Capital invertido · Valor actual · Dividendos cobrados · Yield medio
- [ ] Yield medio · `—` si histórico < 1 mes (alineado con comentario T23.3 fix)
- [ ] Sparkline gigante O placeholder
- [ ] 2 tablas · Dividendos · Operaciones (compras/ventas)
- [ ] Botones · `[Registrar dividendo]` · `[Comprar / Vender]` · `[Actualizar valor]`

---

## Escenario 4 · Click en carta · ficha rendimiento periódico

**Flujo · solo si el usuario tiene una posición de tipo `prestamo_p2p` ·
`cuenta_remunerada` · `deposito_plazo`. Si no, escenario opcional.**

1. Click en la carta correspondiente
2. Renderiza `<FichaRendimientoPeriodico>`

**Validación**

- [ ] 4 KPIs · Capital invertido · Interés generado · TIN · Próximo cobro
- [ ] Próximo cobro se calcula desde `frecuencia_cobro` (T23.3 fix #6) · NO
  desde `plan_aportaciones`. Si no hay frecuencia · "—"
- [ ] Matriz cobros · 36 cuadritos (3 años) con header de meses + leyenda
- [ ] Tabla cobros · botón `Exportar CSV` (sanitizado · T23.3 fix #7)
- [ ] Botones · `[Registrar cobro]` · `[Editar posición]`
- [ ] Click `[Registrar cobro]` abre `<RegistrarCobroDialog>` (mini-form
  dedicado · NO `AportacionFormDialog`)
- [ ] Tras guardar el cobro · matriz refleja un cuadrito verde en el mes
  correspondiente · KPI "Interés generado" aumenta

---

## Escenario 5 · Botón Aportar (page-head)

**Flujo**

1. En `/inversiones` · click `[+ Aportar]`
2. Si hay >1 posición activa · abre `<DialogAportar>` paso 1 (selector)
3. Si solo hay 1 posición activa · abre `<AportacionFormDialog>` directo
4. Cumplimentar form · guardar
5. Galería refresca · valor de la posición actualizado

**Validación**

- [ ] Selector lista posiciones activas con nombre + tipo + valor mono
- [ ] Click en una posición avanza al form
- [ ] Cancelar el form · si veníamos del selector vuelve al paso 1 · si era
  modo directo cierra el diálogo (T23.2 fix #6 · `openedDirectRef` estable)
- [ ] Foco trapped en el modal · Escape cierra (T23.2 fixes accesibilidad)
- [ ] Tras guardar · toast "Aportación añadida" · galería refresca

---

## Escenario 6 · Botón Nueva posición · wizard 3 caminos

**Flujo**

1. En `/inversiones` · click `[+ Nueva posición]`
2. Abre `<WizardNuevaPosicion>` paso 1 con 3 tarjetas
3. Probar cada camino

**Validación · camino "Alta manual"**

- [ ] Click en "Alta manual" · render `<PosicionFormDialog>`
- [ ] Cumplimentar form · guardar
- [ ] Toast "Posición creada" · galería refresca con la nueva carta
- [ ] Si el guardado falla · wizard mantiene el form abierto (T23.2 fix
  · `onSavePosicion` lanza · wizard solo cierra al éxito)

**Validación · camino "Desde IndexaCapital"**

- [ ] Click en la tarjeta · navega a `/inversiones/importar-indexa`
- [ ] Pantalla T20 intacta · funcionalidad preservada
- [ ] Botón "Volver" desde el importer regresa a `/inversiones`

**Validación · camino "Desde aportaciones"**

- [ ] Click en la tarjeta · navega a `/inversiones/importar-aportaciones`
- [ ] Pantalla T20 intacta

---

## Escenario 7 · Posiciones cerradas · entry-point + vista expandida

**Pre-condición · al menos 1 posición cerrada (`activo === false` en
store) o 1 ejercicio fiscal con `gananciasPerdidas` importado.**

**Flujo**

1. En `/inversiones` · scroll bajo la grid
2. Sección "POSICIONES CERRADAS" muestra entry-point colapsable
3. Click navega a `/inversiones/cerradas`
4. Vista expandida con KPIs · sub-stats · filtros · cartas

**Validación · entry-point**

- [ ] Card "Lo que ya cerraste" + count + texto "tu trayectoria como inversor"
- [ ] Sin etiqueta "HISTÓRICO FISCAL" / "desde XML IRPF" / "ganancia neta declarada"
- [ ] Resultado neto con color por signo
- [ ] Texto "resultado neto histórico" (sin "ganancia declarada")
- [ ] Cuenta y rango de años se calculan sobre la unión XML+store (adaptador T23.4)

**Validación · vista expandida `/inversiones/cerradas`**

- [ ] 4 KPIs principales · Total invertido · Resultado neto · Mejor cierre · Peor cierre
- [ ] 3 sub-stats · Tasa de acierto · Rentabilidad media (CAGR ponderado) · Tiempo medio
- [ ] Filtros · Tipo · Resultado · Broker · Orden · TODOS narrativa inversor
- [ ] NINGÚN filtro fiscal · sin "Año fiscal" · sin "Estado declaración" · sin "Casillas" · sin "Prescritas"
- [ ] Cartas con border-left por signo (verde · rojo · gris)
- [ ] Botón "Ver detalles fiscales" · solo si la posición tiene
  `referenciaFiscal` (vino del XML AEAT) · navega a `/fiscal/ejercicio/{año}`
- [ ] `e.stopPropagation()` impide que el click del botón dispare el click de la carta
- [ ] Estado vacío "Aún no tienes posiciones cerradas" si la lista está vacía

---

## Escenario 8 · Responsive · 3/2/1 cols

**Flujo**

1. En `/inversiones` · redimensionar el viewport
2. Validar que la grid colapsa progresivamente

**Validación**

- [ ] >1100px · 3 columnas
- [ ] 700-1100px · 2 columnas
- [ ] <700px · 1 columna · padding página `18px 16px 40px` (vs `22px 32px 48px` desktop)
- [ ] Modales · `width: min(640px, calc(100% - 32px))` (T23.2 fix · sin overflow horizontal en 360-390px)

---

## Escenario 9 · Cero hex hardcoded · grep limpio

**Flujo**

```bash
grep -rnE "#[0-9A-Fa-f]{3,8}" src/modules/inversiones/ | grep -v "^Binary"
```

**Resultado esperado** · 10 coincidencias EXACTAS · todas listadas
literalmente en § Z.3 spec o legacy de T20 (POSITION_COLORS dead-code en
`helpers.ts` que se conserva por § 2.9 spec):

| Archivo | Línea | Hex | Justificación |
|---|---|---|---|
| `helpers.ts:14-18` | 5× | `#0E2A47 #5B8DB8 #1DA0BA #A8C4DE #C8D0DC` | `POSITION_COLORS` legacy (paleta gráficos T20 · dead-code conservado por § 2.9 spec) |
| `helpers.ts:524` | 1× | `#6E5BC7` | Cripto · color literal § Z.3 (no token v5) |
| `InversionesGaleria.module.css:108` | 1× | `#6E5BC7` | `.carta.cripto` border-top · § Z.3 |
| `InversionesGaleria.module.css:145` | 2× | `#FF8200 #C8530A` | Logo MyInvestor gradient · § Z.3 |
| `InversionesGaleria.module.css:160` | 2× | `#C59A47 #B88A3E` | Logo Unihouser gradient · § Z.3 |
| `InversionesGaleria.module.css:206` | 2× | `#EFE9FE #6E5BC7` | `.cartaTipo.cripto` chip · § Z.3 |

**Total · 13 hex matches en 10 líneas · todos justificados.**

---

## Cero lenguaje fiscal en UI · grep limpio

**Flujo**

```bash
grep -rniE "casilla|paralela|prescribe|IRPF" src/modules/inversiones/
```

**Resultado esperado** · solo coincidencias en comentarios JSDoc del
adaptador que listan EXPLÍCITAMENTE qué NO usar:

```
src/modules/inversiones/adapters/posicionesCerradas.ts:255: * KPIs agregados · narrativa inversor (sin "casilla" · sin "ejercicio" ·
src/modules/inversiones/adapters/posicionesCerradas.ts:256: * sin "paralela"). Si la lista está vacía devuelve un objeto con todos
```

NINGUNA coincidencia en strings visibles del usuario.

---

## tsc + build verde

```bash
npx tsc --noEmit --ignoreDeprecations 6.0    # exit 0
CI=true npm run build                          # "Compiled successfully."
```

---

## Datos del usuario intactos

- `DB_VERSION = 65` (sin cambios entre T22.* y T23.*)
- Store `inversiones` · solo lecturas + altas/updates desde la UI
- Parser XML AEAT · no tocado
- Módulo Fiscal · no tocado (solo lectura via botón puente opcional en
  `<CartaCerrada>`)
- Cero migración · cero borrado de registros existentes
