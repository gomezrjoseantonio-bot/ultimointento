# T23 · Cierre · Inversiones · galería + fichas dedicadas

> **Sub-tarea 23.5** · TAREA 23 ✅
>
> Resumen de la migración completa del módulo Inversiones del patrón
> Outlet+4 tabs (T20 Fase 3d) al patrón galería 3 cols + fichas detalle
> dedicadas + vista expandida de cerradas con narrativa inversor (NO
> fiscal). 5 sub-tareas · 5 PRs · stop-and-wait estricto.

---

## 1 · Diff visual antes/después

### Antes (T20 Fase 3d)

```
/inversiones
├── tabs · Resumen · Cartera · Rendimientos · Individual
├── page-head · [Importar IndexaCapital] [Importar aportaciones] [Nueva posición]
└── 4 sub-páginas con métricas genéricas
    ├── ResumenPage · KPIs agregados
    ├── CarteraPage · tabla plana
    ├── RendimientosPage · 4 gráficos
    └── IndividualPage · selector + ficha estándar
```

### Después (T23)

```
/inversiones                           · galería 3 cols · cartas heterogéneas
├── page-head · [+ Aportar] [+ Nueva posición]
├── grid · cartas con visualización contextual por tipo
│   ├── valoracion_simple → sparkline
│   ├── rendimiento_periodico → matriz cobros 12m
│   ├── dividendos → sparkline
│   └── otro → placeholder
├── carta "Añadir posición" (dashed)
└── entry-point colapsable "Posiciones cerradas" · narrativa inversor

/inversiones/:posicionId               · ficha detalle (dispatcher T23.3)
├── valoracion_simple → <FichaValoracionSimple>
├── rendimiento_periodico → <FichaRendimientoPeriodico>
├── dividendos → <FichaDividendos>
└── default → <FichaGenerica>

/inversiones/cerradas                  · vista expandida (T23.4)
├── 4 KPIs principales · narrativa inversor
├── 3 sub-stats · narrativa inversor
├── filtros · TODOS perspectiva inversor · NINGUNO fiscal
└── listado <CartaCerrada> con puente OPCIONAL al módulo Fiscal

/inversiones/importar-indexa           · INTACTO · ahora se invoca desde wizard
/inversiones/importar-aportaciones     · INTACTO · ahora se invoca desde wizard
```

---

## 2 · Sub-tareas y PRs (stop-and-wait)

| Sub | Título | PR | Cierre |
|---|---|---|---|
| 23.1 | galería v2 + helpers contextuales · sustituir 4 tabs | #1205 | ✅ merge |
| 23.2 | wizard nueva posición + flujo aportar | #1207 | ✅ merge |
| 23.3 | fichas detalle · 3 grupos de tipo | #1209 | ✅ merge |
| 23.4 | posiciones cerradas · perspectiva inversor (NO fiscal) | #1210 | ✅ merge |
| 23.5 | cierre · docs + e2e verification | (este PR) | en revisión |

---

## 3 · Filosofía cumplida (§ 5.2 spec)

> **Inversiones es módulo de INVERSOR · NO de fiscal.**

Consecuencias aplicadas en toda la UI:

- ❌ NINGUNA mención a "casilla" · "paralela" · "prescribe" · "IRPF" en strings visibles
- ❌ "ejercicio" / "declaración" reservadas para la UI Fiscal · solo aparecen en JSDoc del adaptador `posicionesCerradas.ts` listando explícitamente qué NO usar
- ✅ Narrativa "cuánto invertí · cuánto vale · cuánto gané · qué CAGR · qué duración"
- ✅ El entry-point original del mockup `"HISTÓRICO FISCAL · desde XML IRPF · ganancia neta declarada"` se sustituyó por `"Lo que ya cerraste · tu trayectoria como inversor · resultado neto histórico"`
- ✅ Filtros de la vista expandida son TODOS perspectiva inversor (tipo de activo · resultado · broker · ordenación CAGR/duración)
- ✅ Puente al módulo Fiscal · botón discreto OPCIONAL "Ver detalles fiscales" · solo si la posición tiene `referenciaFiscal` · navega a `/fiscal/ejercicio/{año}` (ruta análoga real del repo)
- ✅ El adaptador `getPosicionesCerradas()` OCULTA el lenguaje fiscal · no expone `valorAdquisicion` · `valorTransmision` · `nifFondo` · `retencion` en el modelo público · solo `aportado` · `vendido` · `resultado` · `cagr` · `duracionDias`

---

## 4 · Datos del usuario · cero migración

- `DB_VERSION = 65` · sin cambios de schema entre T22.* y T23.*
- Store `inversiones` · solo lecturas + altas/updates desde la UI productiva
- Parser XML AEAT · no tocado
- Módulo Fiscal · no tocado (solo lectura via botón puente opcional)
- Posiciones cerradas del usuario · vienen del XML AEAT
  (`ejerciciosFiscalesCoord[].aeat.declaracionCompleta.gananciasPerdidas` ·
  `OperacionFondo[]` · `OperacionCripto[]` · `OperacionTransmision[]`) ·
  expuestas con narrativa de inversor sin tocar la fuente

---

## 5 · Tokens § Z + Iconos § AA aplicados

### Tokens canónicos (§ Z spec)

- Layout galería · `repeat(3, 1fr)` · gap 16 · margin-bottom 40
- Carta · `border-radius: 14px` · `padding: 22px` · `min-height: 280px`
- Card detalle · `border-radius: var(--atlas-v5-radius-md)` · `padding: 16-22px`
- Borde top color por tipo · `--atlas-v5-brand` (plan) · `--atlas-v5-gold` (prestamo)
  · `--atlas-v5-pos` (accion) · `#6E5BC7` (cripto · literal § Z.3) ·
  `--atlas-v5-ink-3` (deposito) · `--atlas-v5-brand-2` (fondo)
- Fonts · `var(--atlas-v5-font-mono-num)` para valores · `var(--atlas-v5-font-ui)` para texto
- Border-left semántico en `.cartaCerrada` · pos / neg / muted

### Hex hardcoded · grep auditado

13 matches en 10 líneas · todos justificados en `T23-end-to-end-verification.md` § Cero hex hardcoded:
- 5 × `POSITION_COLORS` (helpers.ts) · dead-code legacy T20 conservado por § 2.9 spec
- 1 × `#6E5BC7` (helpers.ts:524) · cripto literal § Z.3
- 7 × en CSS · `#6E5BC7` cripto · gradients MyInvestor (`#FF8200`/`#C8530A`) · gradients Unihouser (`#C59A47`/`#B88A3E`) · cripto wash (`#EFE9FE`) · todos literales § Z.3

### Iconos § AA

- `Plus` (Aportar · 14px stroke 1.8)
- `PlusSquare` (Nueva posición · 14px stroke 1.8)
- `PlusCircle` (carta Añadir · 40px stroke 1.5)
- `ArrowRight` (CTA "Ver detalle →" · 10px stroke 2.5)
- `Fondos` (Package · entry-point cerradas · 18px stroke 1.8)
- `ChevronRight` (flecha entry-point · 16px · footer link fiscal · 11px)
- `ChevronLeft` (botón volver via PageHead)
- `Refresh` (Actualizar valor)
- `Edit` (Editar posición)
- `ArrowUpRight` (Comprar/Vender)
- `Download` (Exportar CSV)
- `Inbox` (estado vacío en `/inversiones/cerradas`)
- Iconos añadidos a `src/design-system/v5/icons.ts` · `PlusSquare` ·
  `PlusCircle` · `PiggyBank` · `HandCoins` · `Bitcoin` (estos 3 últimos
  reservados para fichas futuras · disponibles aunque no se usen en T23)

---

## 6 · TODOs documentados (no scope T23)

- Panel "Composición" en `<FichaValoracionSimple>` · placeholder hasta que
  el modelo de datos exponga el desglose por categoría (renta variable /
  fija / liquidez · % por categoría). Pendiente de feature posterior de
  enriquecimiento manual del usuario.
- `AportacionFormDialog` · no soporta `tipo: 'dividendo'`. T23.3 introduce
  `<RegistrarCobroDialog>` dedicado como solución. Si en el futuro se
  amplía el form base a dividendos, se puede deprecar el mini-dialog.
- Heurística "Próximo cobro" en `<FichaRendimientoPeriodico>` · solo
  soporta frecuencias `mensual/trimestral/semestral/anual`. La frecuencia
  `al_vencimiento` queda como `null`. Si se necesita un cálculo más
  rico (cuándo vence el depósito), se puede añadir.
- Yield medio en `<FichaDividendos>` · estimado · devuelve `null` si el
  histórico cubre menos de 1 mes (T23.3 review fix #9).
- Adaptador `posicionesCerradas` · si el XML AEAT no expone `fechaApertura`
  (común para posiciones declaradas) · `cagr` y `duracionDias` quedan
  `undefined` y la UI muestra "—". El usuario puede enriquecer las
  cartas cerradas nativas (store `inversiones` con `activo === false`)
  con `fecha_compra` para que el cálculo sea preciso.

---

## 7 · Riesgos previstos · estado al cierre

| Riesgo (§ 8 spec) | Estado |
|---|---|
| Datos del XML AEAT pobres · cartas con muchos placeholders | ✅ Placeholders coherentes documentados · NO se inventa |
| Tipos de posición sin ficha dedicada (cripto · otro) | ✅ `<FichaGenerica>` fallback construido |
| Eliminar 4 tabs rompe links externos guardados | ✅ Redirects en App.tsx · `/cartera|resumen|rendimientos|individual` → `/inversiones` |
| Sparkline con < 2 aportaciones · no renderiza | ✅ Placeholder visual "datos insuficientes para gráfico" |
| Wizard duplica funcionalidad existente | ✅ Reusa `PosicionFormDialog` y rutas import existentes · solo nuevo disparador |
| Posiciones cerradas · datos no agregados al final | ✅ Adaptador 23.4 conecta XML AEAT · si vacío · estado vacío coherente |
| CC introduce lenguaje fiscal en UI por inercia | ✅ Cero match en strings visibles · review Jose validó en cada PR |

---

## 8 · Compromiso post-T23 (§ 10 spec)

- ✅ T22 puede seguir corriendo paralelo · sin conflicto detectado
- 📋 T8 · refactor schemas restantes · descongelable
- 📋 T10 · TODOs T7 residuales · descongelable
- 📋 Patrón T23 (mockup vs realidad) aplicable a Inmuebles · Mi Plan ·
  Personal si aparecen sombras en revisión visual posterior
- 📋 Enriquecimiento de posiciones · feature posterior · permitir al
  usuario rellenar campos vacíos de posiciones XML (nombre detallado ·
  ISIN · CAGR objetivo · etc) · NO scope T23

---

**TAREA 23 ✅ · 5 sub-tareas mergeadas · stop-and-wait cumplido en cada
una · datos del usuario intactos · DB en 65 · narrativa de inversor
mantenida en toda la UI · puente discreto opcional al módulo Fiscal.**
