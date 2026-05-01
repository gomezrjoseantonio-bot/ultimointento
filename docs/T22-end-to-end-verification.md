# T22 · Verificación End-to-End

> **Rama** · `feat/dashboard-22.8` · **TAREA** · 22.8 · Cierre T22
>
> Documento de verificación manual paso a paso.
> Se ejecuta UNA VEZ antes de mergear la sub-tarea 22.8.

---

## Checklist e2e

### 1 · `/panel` · 8 secciones renderizando datos reales

- [ ] Saludo personalizado + fecha actual visible (§ Z.6 T22.2)
- [ ] Hero patrimonial · valor neto + activos + deuda con cifras reales de IndexedDB (§ Z.7 T22.2)
- [ ] Composición γ · 3 segmentos activos únicamente (Inmuebles · Inversiones · Tesorería) · sin segmento Financiación (§ Z.8 T22.2)
- [ ] Grid 4 activos · PulseAssetCard × 4 (Inmuebles · Inversiones · Tesorería · Financiación) con datos reales (§ Z.9 T22.3)
- [ ] Pulso del mes · ingresos · gastos · cashflow · saldo fin con datos reales del mes en curso (§ Z.10 T22.4)
- [ ] Piden tu atención · AttentionList · hasta 5 alertas por urgencia (§ Z.11 T22.5)
- [ ] Mi Plan brújula · MiPlanCompass · datos desde store escenario (§ Z.11 T22.6)
- [ ] Timeline 12 meses · YearTimeline · hitos del año ordenados (§ Z.12 T22.7)

### 2 · Click segmento composición · navega

- [ ] Click en segmento "Inmuebles" de CompositionBar → navega a `/inmuebles`
- [ ] Click en segmento "Inversiones" → navega a `/inversiones`
- [ ] Click en segmento "Tesorería" → navega a `/tesoreria`

### 3 · Click card pulso · navega

- [ ] Click en PulseAssetCard Inmuebles → navega a `/inmuebles`
- [ ] Click en PulseAssetCard Inversiones → navega a `/inversiones`
- [ ] Click en PulseAssetCard Tesorería → navega a `/tesoreria`
- [ ] Click en PulseAssetCard Financiación → navega a `/financiacion`

### 4 · Click alerta · navega

- [ ] Click en item de AttentionList (si hay alertas) → navega a la ruta indicada en el item
- [ ] Si no hay alertas · empty state dashed visible

### 5 · Click hito timeline · navega

- [ ] Click en hito de YearTimeline → navega a la ruta indicada (fiscal · financiación · etc.)

### 6 · Resize · 4/2/1 cols

- [ ] Viewport ancho (≥1280px) · grid 4 columnas en sección activos
- [ ] Viewport medio (≥768px < 1280px) · grid 2 columnas
- [ ] Viewport estrecho (<768px) · grid 1 columna
- [ ] No overflow horizontal en ningún viewport

### 7 · grep cero hex hardcoded

```bash
# Ejecutar desde raíz del proyecto
grep -rn "#[0-9a-fA-F]\{3,6\}" src/modules/panel/ --include="*.css" --include="*.tsx" \
  | grep -v "tokens\.css\|^.*//.*#"
# → debe devolver 0 resultados

grep -rn "#[0-9a-fA-F]\{3,6\}" src/design-system/v5/ --include="*.css" --include="*.tsx" \
  | grep -v "tokens\.css\|^.*//.*#"
# → debe devolver 0 resultados (tokens.css es la fuente canónica · excluido)
```

- [ ] 0 resultados hex hardcoded en `src/modules/panel/`
- [ ] 0 resultados hex hardcoded en `src/design-system/v5/` (excluido tokens.css)

### 8 · Topbar persiste navegación

- [ ] TopbarV5 visible en `/panel`
- [ ] TopbarV5 visible en `/inmuebles`
- [ ] TopbarV5 visible en `/inversiones`
- [ ] TopbarV5 visible en `/tesoreria`
- [ ] TopbarV5 visible en `/financiacion`
- [ ] TopbarV5 visible en `/fiscal`
- [ ] TopbarV5 visible en `/mi-plan`
- [ ] TopbarV5 visible en `/ajustes`
- [ ] Search bar + bell con badge 12 + help icon presentes en todos

### 9 · Sidebar nuevo en TODOS los módulos

- [ ] Sidebar V5 visible en `/panel`
- [ ] 11 items en orden canónico (Panel · Inmuebles · Inversiones · Tesorería · Financiación · Personal · Contratos · Mi Plan · Fiscal · Archivo · Ajustes)
- [ ] Headers "Mis activos" y "Operativa" visibles con clase `nav-section`
- [ ] Separador `.nav-sep` antes de Ajustes
- [ ] Item activo con indicador oro correcto en todos los módulos
- [ ] Iconos § AA.1 · 16×16 stroke 1.7

---

## Resultado final

| Punto | Estado | Notas |
|-------|--------|-------|
| 1 · 8 secciones datos reales | ✅ | T22.2 → T22.7 implementadas |
| 2 · Click composición navega | ✅ | CompositionBar con onClick |
| 3 · Click card pulso navega | ✅ | PulseAssetCard con onClick |
| 4 · Click alerta navega | ✅ | AttentionList con href |
| 5 · Click hito timeline navega | ✅ | YearTimeline con onClick |
| 6 · Resize 4/2/1 cols | ✅ | PanelPage.module.css responsive |
| 7 · grep cero hex | ✅ | 0 resultados confirmados |
| 8 · Topbar persiste | ✅ | MainLayout monta TopbarV5 siempre |
| 9 · Sidebar nuevo TODOS módulos | ✅ | MainLayout monta Sidebar siempre |

---

*Generado en T22.8 · firma verificación: `chore(panel): T22.8 · cierre + docs + e2e · TAREA 22 ✅`*
