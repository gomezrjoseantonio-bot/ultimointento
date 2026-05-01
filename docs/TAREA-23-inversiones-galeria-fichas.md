# TAREA CC · TAREA 23 · Reconstrucción Inversiones · galería + fichas dedicadas · v1

> **Tipo** · refactor de UI viva · sustituye la implementación actual (4 tabs genéricas) por la arquitectura del mockup (galería heterogénea + fichas dedicadas por tipo)
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · cada sub-tarea desde `main` actualizado tras la anterior · NO rama madre · NO acumular
>
> **Alcance global** · llevar la UI implementada de Inversiones al estado del mockup `atlas-inversiones-v2.html` aprobado · galería 3 columnas con cartas heterogéneas (visualización contextual por tipo) · fichas detalle dedicadas como sub-páginas · sección "Posiciones Cerradas" colapsable con narrativa inversor (NO fiscal) · re-ubicar importadores (IndexaCapital · Aportaciones) dentro del wizard de nueva posición en lugar de botones de page-head · datos del XML AEAT como esqueleto · usuario enriquece manualmente para llegar al detalle del mockup
>
> **Tiempo estimado total** · 14-22h Copilot · 6-9h revisión Jose
>
> **Prioridad** · ALTA · módulo crítico · datos del usuario reales (IRPF · planes pensiones · acciones)
>
> **Predecesores cerrados** · T15 ✅ · T14 ✅ · T9 ✅
>
> **Tareas paralelas permitidas** · T22 (Dashboard) · módulos distintos · sin colisión
>
> **DB** · NO se toca schema · DB_VERSION sigue en 65 · 40 stores
>
> **Stores tocados** · `inversiones` (lectura · enriquecimiento manual escritura · sin migración masiva)

---

## 0 · Reglas inviolables (idénticas T17 / T20 / T15 / T14 / T9 / T22)

### 0.1 · STOP-AND-WAIT estricto entre sub-tareas

### 0.2 · NO inventar
Si CC encuentra ambigüedad · PARAR · esperar input. Si campo no disponible · placeholder coherente · NO inventar valor.

### 0.3 · Datos del usuario intactos
T23 NO migra ni borra registros existentes en `inversiones`. Solo añade UI. Las posiciones del XML AEAT (`ORANGE ESPAGNE SA` · `Plan de pensiones` · etc) son datos reales del usuario · respetar.

### 0.4 · Mockup + guía v5 son ley
- Mockup vigente · `docs/audit-inputs/atlas-inversiones-v2.html` (1994 líneas validado)
- Guía vigente · `GUIA-DISENO-V5-atlas.md`
- Si conflicto · prevalece guía v5

### 0.5 · Cero hex hardcoded · tokens § Z obligatorios

### 0.6 · Aprovechar biblioteca v5 (T20.0 + T22.1)
Tokens en `src/design-system/v5/tokens.css` · componentes existentes · iconos en `src/design-system/v5/icons.ts`. Sidebar y topbar T22.1 ya integrados.

---

## 1 · Datos verificados del repo (auditoría inicial Claude)

### 1.1 · Tipo `PosicionInversion` (src/types/inversiones.ts)

11 tipos soportados:
- **Rendimiento periódico** · `cuenta_remunerada` · `prestamo_p2p` · `deposito_plazo`
- **Dividendos** · `accion` · `etf` · `reit`
- **Valoración simple** · `fondo_inversion` · `plan_pensiones` · `plan_empleo` · `crypto` · `otro`
- **Legacy** · `deposito`

Campos comunes · `id` · `nombre` · `tipo` · `entidad` · `isin` · `ticker` · `valor_actual` · `fecha_valoracion` · `aportaciones[]` · `total_aportado` · `rentabilidad_euros` · `rentabilidad_porcentaje` · planes (aportaciones periódicas · liquidación) · campos extendidos (rendimiento periódico · dividendos · valoración).

### 1.2 · Estado actual implementado

`src/modules/inversiones/`:
- `InversionesPage.tsx` · contenedor 4 tabs
- `pages/ResumenPage.tsx` · KPIs agregados
- `pages/CarteraPage.tsx` · tabla plana
- `pages/RendimientosPage.tsx` · 4 gráficos genéricos
- `pages/IndividualPage.tsx` · selector + ficha estándar
- `components/PosicionFormDialog.tsx` · alta posición (modal)
- `components/AportacionFormDialog.tsx` · alta aportación (modal)
- `components/ActualizarValorDialog.tsx` · actualizar valor
- `components/PosicionDetailDialog.tsx` · detalle (modal)
- `import/ImportarIndexaCapitalPage.tsx` · importador IndexaCapital
- `import/ImportarAportacionesPage.tsx` · importador aportaciones

T23 reemplaza las 4 sub-páginas tabs por · galería + fichas dedicadas. Componentes modales y de import se mantienen · solo cambia su disparador.

### 1.3 · Datos reales del usuario Jose

Identificados en pantallazos:
- `ORANGE ESPAGNE SA` · 36.500 € · tipo probable `accion` (RSU · empresa Jose) · capital aportado 0 € (típico RSU porque vienen como compensación · no se "compran")
- `Plan de pensiones` · 0 € · sin datos detallados (tipo `plan_pensiones` desde XML genérico)

CC debe verificar al inicio de 23.1 · cuántas posiciones reales tiene · qué `tipo` tienen · qué campos están vacíos · esto guía la priorización de fichas en 23.3.

### 1.4 · Mockup ejemplos hardcoded

Las cartas del mockup son ejemplos de diseño (Indexado SP500 · SmartFlip · Plan Orange BBVA · Unihouser · Acciones Orange RSU). NO son datos reales. T23 los toma como **referencia visual** del diseño · pero usa los datos reales del usuario para poblar las cartas. Si los datos reales son más pobres que los del mockup · cartas se renderizan con placeholders coherentes.

---

## Z · Tokens y dimensiones canónicas (CITAS LITERALES DEL MOCKUP)

Esta sección es fuente de verdad. Valores citados del CSS del mockup `atlas-inversiones-v2.html`. CC usa EXACTAMENTE estos valores.

### Z.1 · Tokens · idénticos al panel mockup
Ver `TAREA-22-dashboard-sidebar-topbar.md` § Z.1 · misma paleta · `--atlas-v5-*` con prefijo.

### Z.2 · Layout galería (mockup §87)

```css
.gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
```

Responsive · CC define media-queries · sugerido · 3 cols >1100px · 2 cols 700-1100 · 1 col <700px.

### Z.3 · Carta base (mockup §90-150 · resumen)

```css
.carta { background: var(--card); border: 1px solid var(--line); border-radius: 14px;
         padding: 22px; cursor: pointer; transition: all .14s; position: relative; overflow: hidden;
         display: flex; flex-direction: column; gap: 16px; min-height: 280px; }
.carta:hover { border-color: var(--gold); transform: translateY(-2px); 
               box-shadow: 0 6px 16px rgba(14,20,35,0.06); }

/* Borde top color por tipo */
.carta.plan { border-top: 3px solid var(--brand); }
.carta.prestamo { border-top: 3px solid var(--gold); }
.carta.accion { border-top: 3px solid var(--pos); }
.carta.cripto { border-top: 3px solid #6E5BC7; }    /* purpura especial · cripto */
.carta.deposito { border-top: 3px solid var(--ink-3); }
.carta.fondo { border-top: 3px solid var(--brand-2); }

.carta-top { display: flex; justify-content: space-between; align-items: flex-start; }
.carta-marca { display: flex; align-items: center; gap: 12px; }
.carta-logo { width: 38px; height: 38px; border-radius: 9px; 
              display: flex; align-items: center; justify-content: center;
              font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px;
              background: var(--bg); color: var(--ink-2); border: 1px solid var(--line); }
.carta-logo.myi { background: linear-gradient(135deg, #FF8200, #C8530A); color: #fff; border: none; }
.carta-logo.smartflip { background: var(--brand); color: #fff; border: none; }
.carta-logo.bbva { background: #004481; color: #fff; border: none; }
.carta-logo.uni { background: linear-gradient(135deg, #C59A47, #B88A3E); color: #fff; border: none; }
.carta-logo.orange { background: #FF6900; color: #fff; border: none; }

.carta-entidad-lab { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em;
                     color: var(--ink-4); font-weight: 600; }
.carta-entidad-nom { font-size: 13px; font-weight: 600; color: var(--ink); margin-top: 1px; }

.carta-tipo { font-size: 10px; padding: 3px 9px; border-radius: 4px;
              text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
.carta-tipo.plan { background: var(--brand-wash); color: var(--brand); }
.carta-tipo.prestamo { background: var(--gold-wash); color: var(--gold-ink); }
.carta-tipo.accion { background: var(--pos-wash); color: var(--pos); }
.carta-tipo.cripto { background: #EFE9FE; color: #6E5BC7; }
.carta-tipo.deposito { background: var(--bg); color: var(--ink-3); }
.carta-tipo.fondo { background: var(--brand-wash); color: var(--brand-2); }

.carta-nom { font-size: 18px; font-weight: 700; color: var(--ink);
             letter-spacing: -0.018em; line-height: 1.2; }

.carta-valor { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 700;
               color: var(--ink); letter-spacing: -0.025em; line-height: 1; 
               font-variant-numeric: tabular-nums; }
.carta-valor-sub { font-size: 11.5px; color: var(--ink-4); margin-top: 4px;
                   font-family: 'JetBrains Mono', monospace; }
.delta.pos { color: var(--pos); font-weight: 700; }
.delta.neg { color: var(--neg); font-weight: 700; }
.delta.gold { color: var(--gold); font-weight: 700; }
.delta.muted { color: var(--ink-4); font-weight: 500; }

.carta-viz { flex: 1; display: flex; align-items: flex-end; min-height: 60px; }
.carta-viz-sparkline { width: 100%; height: 56px; }

.carta-footer { display: flex; justify-content: space-between; align-items: center;
                padding-top: 14px; border-top: 1px solid var(--line-2); }
.carta-footer-meta { font-size: 11px; color: var(--ink-4); 
                     font-family: 'JetBrains Mono', monospace; }
.carta-footer-cta { font-size: 11px; color: var(--gold); font-weight: 700; opacity: 0;
                    transition: opacity .14s; }
.carta:hover .carta-footer-cta { opacity: 1; }
```

### Z.4 · Visualización contextual por tipo de carta

Cada tipo de carta tiene una "viz" diferente en `.carta-viz` (mockup §150-260). CC implementa según tipo de posición:

| Tipo posición | Visualización |
|---|---|
| `plan_pensiones` · `plan_empleo` · `fondo_inversion` | Sparkline SVG · línea evolución valor histórico desde primera aportación |
| `prestamo_p2p` · `cuenta_remunerada` · `deposito_plazo` | Matriz cobros mensuales · 12 cuadritos (E F M A M J J A S O N D) · color por estado (cobrado · pendiente · futuro) |
| `accion` · `etf` · `reit` | Sparkline SVG (precio + dividendos opcionales · puntos de cobro) |
| `crypto` | Sparkline SVG · línea volátil · escala adaptada |
| `otro` · `deposito` (legacy) | Visualización mínima · solo valor + delta |

Si no hay datos suficientes para sparkline (< 2 aportaciones) · placeholder visual · línea horizontal punteada con texto "datos insuficientes para gráfico" en `var(--ink-4)`.

### Z.5 · Carta "Añadir posición" (mockup §739-748)

```css
.carta.add { border: 2px dashed var(--line); background: var(--bg);
             display: flex; flex-direction: column; align-items: center; justify-content: center;
             gap: 12px; cursor: pointer; min-height: 280px;
             color: var(--ink-4); transition: all .14s; }
.carta.add:hover { border-color: var(--gold); color: var(--gold); background: var(--gold-wash); }
.carta-add-title { font-size: 16px; font-weight: 700; color: inherit; }
.carta-add-sub { font-size: 11.5px; color: var(--ink-4); text-align: center;
                 padding: 0 20px; line-height: 1.5; }
```

### Z.6 · Posiciones Cerradas · sección colapsable entry-point (mockup §752-777 · narrativa adaptada)

CSS reutiliza el del mockup · solo cambia narrativa textual (ver §5.2 para textos · sin lenguaje fiscal). Color `--cerradas-total-val` · puede ser `var(--pos)` si resultado neto positivo · `var(--neg)` si negativo (NO siempre verde · narrativa honesta).

```css
.cerradas-sec { background: var(--card-alt); border: 1px solid var(--line);
                border-radius: 11px; padding: 18px 22px; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center;
                transition: all .14s; }
.cerradas-sec:hover { border-color: var(--ink-5); background: var(--card); }
.cerradas-sec-left { display: flex; align-items: center; gap: 14px; }
.cerradas-icon { width: 38px; height: 38px; border-radius: 9px;
                 background: var(--bg); border: 1px solid var(--line);
                 display: flex; align-items: center; justify-content: center;
                 color: var(--ink-3); }
.cerradas-title { font-size: 14px; font-weight: 700; color: var(--ink); }
.cerradas-count { font-size: 11px; padding: 2px 8px; border-radius: 4px;
                  background: var(--brand-wash); color: var(--brand);
                  font-weight: 700; margin-left: 8px; }
.cerradas-sub { font-size: 12px; color: var(--ink-4); margin-top: 3px; }
.cerradas-right { display: flex; align-items: center; gap: 16px; }
.cerradas-total-val { font-family: 'JetBrains Mono', monospace; font-size: 16px;
                      font-weight: 700; }
.cerradas-total-val.pos { color: var(--pos); }
.cerradas-total-val.neg { color: var(--neg); }
.cerradas-total-lab { font-size: 10.5px; color: var(--ink-4);
                      text-transform: uppercase; letter-spacing: 0.1em; }
.cerradas-arrow { color: var(--ink-4); }
```

**Textos a usar:**
- Sección title (sobre el entry-point) · `POSICIONES CERRADAS · {N} posiciones · {rangoAños}`
- Card title interno · `Lo que ya cerraste`
- Card count · `{N} posiciones`
- Card sub · `tu trayectoria como inversor`
- Card total label · `resultado neto histórico`
- NO usar · "Histórico fiscal" · "desde XML IRPF" · "ganancia neta declarada"

### Z.7 · Fichas detalle · estructura genérica (mockup §785-1407)

Cada ficha de detalle tiene estructura común:

```css
.detail-head { margin-bottom: 24px; }
.back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
            border-radius: 6px; font-size: 12px; color: var(--ink-3); 
            background: var(--card); border: 1px solid var(--line); }
.back-btn:hover { color: var(--ink); border-color: var(--ink-5); }
.detail-title { font-size: 24px; font-weight: 700; color: var(--ink);
                margin-top: 14px; letter-spacing: -0.02em; }
.detail-sub { font-size: 13px; color: var(--ink-4); margin-top: 4px;
              font-family: 'JetBrains Mono', monospace; }

/* Layout detalle · 1 col KPIs arriba · 2 cols contenido específico debajo */
.detail-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
               margin-bottom: 22px; }
.detail-kpi { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
              padding: 16px 18px; }
.detail-kpi-lab { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em;
                  color: var(--ink-4); font-weight: 600; }
.detail-kpi-val { font-family: 'JetBrains Mono', monospace; font-size: 20px;
                  font-weight: 700; color: var(--ink); margin-top: 4px;
                  letter-spacing: -0.018em; }
.detail-kpi-val.pos { color: var(--pos); }
.detail-kpi-val.neg { color: var(--neg); }
.detail-kpi-sub { font-size: 11px; color: var(--ink-4); margin-top: 3px;
                  font-family: 'JetBrains Mono', monospace; }

.detail-cols { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
```

Cada ficha detalle adapta el contenido de `detail-cols` según el tipo (sparkline gigante · tabla cobros · panel composición · etc).

### Z.8 · Page-head Inversiones (mockup §512-527)

Misma estructura que otros módulos · h1 "Inversiones" + subtítulo "tus posiciones activas · click en cualquier carta para ver su detalle" + 2 botones derecha:
- `[+ Aportar]` (btn-ghost) · NO importador legacy · es para añadir aportación a posición existente
- `[+ Nueva posición]` (btn-gold primary) · abre wizard que en su step 1 ofrece "alta manual" o "importar IndexaCapital"

```css
.btn-gold { background: linear-gradient(135deg, var(--gold-2), var(--gold)); 
            color: #fff; border: none; }
.btn-gold:hover { background: linear-gradient(135deg, var(--gold), var(--gold-ink)); }
```

---

## AA · Mapeo SVG mockup → Lucide-react

### AA.1 · Iconos botones page-head

| Concepto | Lucide |
|---|---|
| Aportar (botón ghost) | `Plus` (alt · si Plus es muy genérico · `PlusCircle`) |
| Nueva posición (botón gold) | `PlusSquare` (alt · `TrendingUp` enfático) · CC elige y documenta |

### AA.2 · Iconos cartas

| Concepto | Lucide |
|---|---|
| Tag tipo "Plan PP" | `PiggyBank` (opcional · puede no llevar icono · solo text-tag) |
| Tag tipo "Préstamo P2P" | `HandCoins` (alt · `Banknote`) |
| Tag tipo "Acción" | `TrendingUp` |
| Tag tipo "Crypto" | `Bitcoin` (alt · `Coins`) |
| Tag tipo "Depósito" | `Lock` (alt · `Vault`) |
| Tag tipo "Fondo" | `LineChart` |
| Carta "Añadir" + grande | `PlusCircle` (40x40) |
| CTA "Ver detalle →" | `ArrowRight` (10x10 stroke 2.5) |

### AA.3 · Posiciones Cerradas

| Concepto | Lucide |
|---|---|
| Icono entry-point galería (caja cerrada) | `Package` (alt · `Archive` · CC decide · NO `FileText` ni `Receipt` que sugieren documento fiscal) |
| Flecha derecha entry-point | `ChevronRight` |
| Botón "Ver detalles fiscales" en carta cerrada (footer · puente al módulo Fiscal) | `ChevronRight` (size 11) |

### AA.4 · Ficha detalle

| Concepto | Lucide |
|---|---|
| Botón volver | `ChevronLeft` |
| Iconos KPIs · según contexto | CC elige Lucide más representativo y documenta |

---

## 2 · SUB-TAREA 23.1 · Audit + galería principal sin fichas detalle

### 2.1 · Alcance
Sustituir 4 tabs actuales por galería principal con cartas heterogéneas. NO implementar fichas detalle todavía (eso es 23.3+). Click en carta · navega a ruta `/inversiones/{id}` con placeholder "Ficha detalle pendiente" · 23.3 lo construye.

### 2.2 · Auditoría inicial · `docs/AUDIT-T23-inversiones.md`

CC verifica al inicio:

1. **Posiciones reales del usuario** · cuántas hay en store `inversiones` · qué `tipo` tienen · qué campos están vacíos (sin nombre detallado · sin entidad · sin ISIN · etc) · ejemplo · `ORANGE ESPAGNE SA` y `Plan de pensiones`
2. **Posiciones desde XML AEAT** · identificar las que vienen del XML (`fuente='xml'` en aportaciones) vs las manuales
3. **Aportaciones por posición** · cuántas tiene cada una · suficiente para sparkline?
4. **Posiciones cerradas del usuario** · operaciones de venta/cierre que aparezcan en alguna fuente del repo (probablemente del XML IRPF · `operacionFiscalService` o similar) · CC localiza dónde viven los datos · adaptador en 23.4 los expondrá con narrativa inversor (sin lenguaje fiscal)

### 2.3 · Componente `<InversionesGaleria>`

Reemplaza `InversionesPage.tsx` actual con:

```tsx
function InversionesPage() {
  const { posiciones, loading } = useInversiones();
  const activas = posiciones.filter(p => !esCerrada(p));
  const posicionesCerradas = usePosicionesCerradas();   // adaptador 23.4 · narrativa inversor
  
  return (
    <div className="inversiones-page">
      <div className="page-head">
        <div>
          <h1>Inversiones</h1>
          <div className="page-sub">tus posiciones activas · click en cualquier carta para ver su detalle</div>
        </div>
        <div className="tb-actions">
          <button className="btn btn-ghost" onClick={openAportar}>
            <Plus size={14} strokeWidth={1.8} /> Aportar
          </button>
          <button className="btn btn-gold" onClick={openWizardNueva}>
            <PlusSquare size={14} strokeWidth={1.8} /> Nueva posición
          </button>
        </div>
      </div>
      
      <div className="gallery-hd">
        <div className="gallery-title">Posiciones activas</div>
        <div className="gallery-count">{activas.length} activas · ordenadas por valor</div>
      </div>
      
      <div className="gallery-grid">
        {activas
          .sort((a, b) => b.valor_actual - a.valor_actual)
          .map(p => <CartaPosicion key={p.id} posicion={p} />)}
        <CartaAddPosicion onClick={openWizardNueva} />
      </div>
      
      {posicionesCerradas.length > 0 && (
        <>
          <div className="gallery-hd" style={{marginTop: 18}}>
            <div className="gallery-title">Posiciones cerradas</div>
            <div className="gallery-count">{posicionesCerradas.length} posiciones · {rangoAños}</div>
          </div>
          <div className="cerradas-sec" onClick={() => navigate('/inversiones/cerradas')}>
            {/* render según Z.6 · textos narrativa inversor · sin lenguaje fiscal */}
          </div>
        </>
      )}
    </div>
  );
}
```

### 2.4 · Componente `<CartaPosicion>`

```tsx
function CartaPosicion({ posicion }) {
  const tipo = mapTipoToCardClass(posicion.tipo);   // 'plan' | 'prestamo' | 'accion' | 'cripto' | ...
  const navigate = useNavigate();
  
  return (
    <div className={`carta ${tipo}`} onClick={() => navigate(`/inversiones/${posicion.id}`)}>
      <div className="carta-top">
        <div className="carta-marca">
          <div className={`carta-logo ${getLogoClass(posicion.entidad)}`}>
            {getLogoText(posicion.entidad)}
          </div>
          <div>
            <div className="carta-entidad-lab">{getTipoLabel(posicion.tipo)}</div>
            <div className="carta-entidad-nom">{posicion.entidad || '—'}</div>
          </div>
        </div>
        <span className={`carta-tipo ${tipo}`}>{getTipoTagLabel(posicion.tipo)}</span>
      </div>
      
      <div className="carta-nom">{posicion.nombre || posicion.entidad || 'Sin nombre'}</div>
      
      <div>
        <div className="carta-valor">{formatMoney(posicion.valor_actual)}</div>
        <div className="carta-valor-sub">
          aportado {formatMoney(posicion.total_aportado)} · 
          <span className={`delta ${signClass(posicion.rentabilidad_euros)}`}>
            {formatDelta(posicion.rentabilidad_euros)} · {formatPercent(posicion.rentabilidad_porcentaje)}
          </span>
        </div>
      </div>
      
      <div className="carta-viz">
        <CartaVisualizacion posicion={posicion} />
      </div>
      
      <div className="carta-footer">
        <span className="carta-footer-meta">{getFooterMeta(posicion)}</span>
        <span className="carta-footer-cta">Ver detalle <ArrowRight size={10} strokeWidth={2.5} /></span>
      </div>
    </div>
  );
}
```

### 2.5 · Componente `<CartaVisualizacion>` · render contextual

```tsx
function CartaVisualizacion({ posicion }) {
  const grupo = clasificarTipo(posicion.tipo);
  
  if (grupo === 'rendimiento_periodico') {
    // matriz cobros mensuales 12 meses · color por estado
    return <MatrizCobrosMensuales posicion={posicion} />;
  }
  if (grupo === 'valoracion_simple' || grupo === 'dividendos') {
    // sparkline desde primera aportación a hoy
    if (posicion.aportaciones.length < 2) {
      return <PlaceholderViz mensaje="datos insuficientes para gráfico" />;
    }
    return <Sparkline data={construirSerieValor(posicion)} color={getColorByTipo(posicion.tipo)} />;
  }
  return <PlaceholderViz mensaje="—" />;
}
```

### 2.6 · Helpers necesarios

```typescript
// src/modules/inversiones/helpers.ts (ampliar el existente)

export function clasificarTipo(t: TipoPosicion): 'rendimiento_periodico' | 'dividendos' | 'valoracion_simple' | 'otro';
export function mapTipoToCardClass(t: TipoPosicion): 'plan' | 'prestamo' | 'accion' | 'cripto' | 'fondo' | 'deposito';
export function getTipoLabel(t: TipoPosicion): string;          // "Plan pensiones" · "Préstamo P2P" · etc.
export function getTipoTagLabel(t: TipoPosicion): string;       // "Plan PP" · "P2P" · "Acción" · etc.
export function getLogoClass(entidad: string): string;          // según marca conocida · 'myi' · 'bbva' · etc · default ''
export function getLogoText(entidad: string): string;           // primeras 2-3 letras o iniciales
export function getFooterMeta(posicion: PosicionInversion): string;
                  // según tipo · "CAGR +X%" · "TIN X% · {N} cobros" · "{n} ops · ITP X%" · etc.
export function construirSerieValor(p: PosicionInversion): Array<{x: number, y: number}>;
export function esCerrada(p: PosicionInversion): boolean;       // si plan_liquidacion ejecutado o todas aportaciones reembolsadas
```

### 2.7 · Re-ubicación de importadores

Botón `[+ Nueva posición]` abre wizard (modal o sub-página · CC decide). El wizard tiene 3 caminos:
- **Alta manual** · formulario tradicional (reusa `PosicionFormDialog` actual con UI v5)
- **Importar IndexaCapital** · navega a `/inversiones/importar-indexa` (existe ya · solo se rutea desde wizard)
- **Importar aportaciones** · navega a `/inversiones/importar-aportaciones` (existe ya · solo se rutea desde wizard)

**Eliminar** los botones `[Importar IndexaCapital]` y `[Importar aportaciones]` del page-head actual · su funcionalidad sigue viva pero accesible desde el wizard.

Las rutas `/inversiones/importar-indexa` y `/inversiones/importar-aportaciones` siguen existiendo · solo cambia su disparador. NO se borra código.

### 2.8 · Cambios en App.tsx

```typescript
// Antes
<Route path="/inversiones" element={<InversionesPage />}>
  <Route index element={<Navigate to="resumen" replace />} />
  <Route path="resumen" element={<ResumenPage />} />
  <Route path="cartera" element={<CarteraPage />} />
  <Route path="rendimientos" element={<RendimientosPage />} />
  <Route path="individual" element={<IndividualPage />} />
</Route>

// Después
<Route path="/inversiones" element={<InversionesGaleria />} />
<Route path="/inversiones/cerradas" element={<PosicionesCerradasPage />} />
<Route path="/inversiones/:posicionId" element={<FichaPosicionPage />} />   // 23.3 lo desarrolla
<Route path="/inversiones/importar-indexa" element={<ImportarIndexaCapitalPage />} />   // intacta
<Route path="/inversiones/importar-aportaciones" element={<ImportarAportacionesPage />} />   // intacta
```

### 2.9 · ELIMINAR archivos antiguos
- `src/modules/inversiones/pages/ResumenPage.tsx`
- `src/modules/inversiones/pages/CarteraPage.tsx`
- `src/modules/inversiones/pages/RendimientosPage.tsx`
- `src/modules/inversiones/pages/IndividualPage.tsx`

Conservar:
- `src/modules/inversiones/components/ActualizarValorDialog.tsx` (reusable desde ficha detalle 23.3)
- `src/modules/inversiones/components/AportacionFormDialog.tsx` (idem)
- `src/modules/inversiones/components/PosicionFormDialog.tsx` (alta manual desde wizard)
- `src/modules/inversiones/components/PosicionDetailDialog.tsx` (puede deprecarse cuando 23.3 cierre · marcar como deprecated · NO eliminar en 23.1)
- `src/modules/inversiones/import/ImportarIndexaCapitalPage.tsx` (intacto)
- `src/modules/inversiones/import/ImportarAportacionesPage.tsx` (intacto)
- `src/modules/inversiones/InversionesContext.ts`
- `src/modules/inversiones/helpers.ts` (ampliar)
- `src/modules/inversiones/types.ts`

### 2.10 · Verificación 23.1

- [ ] tsc + build pasa
- [ ] App arranca · sidebar muestra "Inversiones" navega a `/inversiones`
- [ ] Galería renderiza · 1 carta por posición real del usuario · ordenadas por valor descendente
- [ ] Carta `Añadir posición` aparece como última
- [ ] Click en carta · navega a `/inversiones/{id}` (placeholder OK · 23.3 construye)
- [ ] Sección "Posiciones cerradas" aparece SOLO si hay posiciones cerradas · narrativa inversor · sin lenguaje fiscal
- [ ] Botones `[Aportar]` y `[Nueva posición]` funcionan (Aportar → modal existente · Nueva posición → wizard placeholder · 23.2 construye)
- [ ] Importadores legacy NO aparecen en page-head
- [ ] Rutas `/inversiones/importar-indexa` y `/inversiones/importar-aportaciones` siguen accesibles
- [ ] Datos del usuario intactos · cero borrado · cero migración
- [ ] Cero hex hardcoded · todo via tokens § Z
- [ ] Cero ruptura otros módulos

### 2.11 · PR 23.1

Título · `feat(inversiones): T23.1 · galería v2 + helpers contextuales · sustituir 4 tabs`

Descripción · audit posiciones reales · estructura nueva · archivos eliminados · ficha placeholder TODO · screenshots galería con datos reales.

**STOP-AND-WAIT** · Jose valida en deploy preview · NO arrancar 23.2 hasta merge.

---

## 3 · SUB-TAREA 23.2 · Wizard nueva posición + flujo aportar

### 3.1 · Alcance
Construir wizard que abre el botón `[+ Nueva posición]` · 3 caminos · alta manual · importar IndexaCapital · importar aportaciones. Refinar flujo `[+ Aportar]` para añadir aportación a posición existente.

### 3.2 · Componente `<WizardNuevaPosicion>`

Modal o sub-página · 3 pasos:

**Paso 1 · ¿Cómo quieres añadir la posición?**

Tres tarjetas seleccionables:
- **Alta manual** · "Crear posición desde cero · indica tipo · entidad · valor"
- **Desde IndexaCapital** · "Importar tu cartera Indexa con un click · OAuth o API key"
- **Desde aportaciones** · "Importar histórico de aportaciones desde Excel · CSV · PDF"

**Paso 2A · Alta manual** · si Paso 1 = manual · render `<PosicionFormDialog>` adaptado · al guardar · cierra wizard y refresca galería.

**Paso 2B · IndexaCapital** · navega a `/inversiones/importar-indexa` (mismo componente que existe).

**Paso 2C · Aportaciones** · navega a `/inversiones/importar-aportaciones`.

**Paso 3 · NO existe** · el wizard cierra al completar 2.

### 3.3 · Componente `<DialogAportar>`

Refinar el botón `[+ Aportar]` del page-head:
- Click · abre dialog
- Step 1 · selector de posición existente · dropdown con `posiciones.filter(activa)`
- Step 2 · `<AportacionFormDialog>` adaptado para la posición seleccionada
- Al guardar · cierra dialog · refresca galería

### 3.4 · Verificación 23.2

- [ ] Wizard nueva posición funciona · 3 caminos disparados correctamente
- [ ] Alta manual crea posición · aparece en galería al cerrar wizard
- [ ] IndexaCapital · navega correctamente · pantalla T20 intacta
- [ ] Aportaciones · navega correctamente · pantalla T20 intacta
- [ ] Botón `[Aportar]` abre dialog · selector + form · crea aportación correctamente
- [ ] tsc + build pasa
- [ ] Datos del usuario intactos

### 3.5 · PR 23.2

Título · `feat(inversiones): T23.2 · wizard nueva posición + flujo aportar`

**STOP-AND-WAIT**

---

## 4 · SUB-TAREA 23.3 · Fichas detalle por tipo · primera tanda

### 4.1 · Alcance
Construir fichas detalle dedicadas para los **tipos de posición que el usuario tiene** (priorizar por uso real). Esquema · cada ficha = ruta `/inversiones/:id` que carga el tipo correspondiente y renderiza la UI específica.

### 4.2 · Componente `<FichaPosicionPage>` · dispatcher

```tsx
function FichaPosicionPage() {
  const { posicionId } = useParams();
  const posicion = usePosicion(posicionId);
  
  if (!posicion) return <NotFound />;
  
  const grupo = clasificarTipo(posicion.tipo);
  switch (grupo) {
    case 'valoracion_simple':  return <FichaValoracionSimple posicion={posicion} />;
    case 'rendimiento_periodico': return <FichaRendimientoPeriodico posicion={posicion} />;
    case 'dividendos': return <FichaDividendos posicion={posicion} />;
    default: return <FichaGenerica posicion={posicion} />;
  }
}
```

### 4.3 · Tres fichas a construir en 23.3

#### `<FichaValoracionSimple>` · planes pensiones · planes empleo · fondos · crypto

Estructura mockup §945-1150:
- `detail-head` · botón volver · título · subtítulo (entidad)
- 4 KPIs `detail-kpis` · "Aportado" · "Valor actual" · "Rentabilidad" · "CAGR"
- Sparkline gigante · evolución valor histórico
- Panel composición · si plan PP indexado · "qué hay dentro" (bonos · acciones · etc · si datos disponibles · si no · placeholder)
- Tabla aportaciones · todas las aportaciones del usuario
- Botones acción · `[Actualizar valor]` · `[Aportar]` · `[Editar posición]`

#### `<FichaRendimientoPeriodico>` · préstamos P2P · cuentas remuneradas · depósitos plazo

Estructura mockup §785-944:
- `detail-head`
- 4 KPIs · "Capital invertido" · "Interés generado" · "TIN" · "Próximo cobro"
- Matriz cobros mensuales gigante · 36 cuadritos (3 años) · color por estado
- Tabla cobros · todos los cobros recibidos · CSV exportable
- Botones · `[Registrar cobro]` · `[Editar posición]`

#### `<FichaDividendos>` · acciones · ETFs · REITs

Estructura mockup §1152-1408:
- `detail-head`
- 4 KPIs · "Capital invertido" · "Valor actual" · "Dividendos cobrados" · "Yield medio"
- Sparkline precio + puntos cobro dividendo
- Tabla dividendos · histórico cobros
- Tabla operaciones · compras/ventas
- Botones · `[Registrar dividendo]` · `[Comprar/Vender]` · `[Actualizar valor]`

### 4.4 · Verificación 23.3

- [ ] Click en carta navega a ficha correspondiente al tipo
- [ ] 3 fichas funcionan con datos reales
- [ ] Sparklines renderizan · matrices cobros renderizan
- [ ] Botones acción operativos · disparan modales existentes
- [ ] Botón volver navega a `/inversiones`
- [ ] tsc + build pasa
- [ ] Cero hex hardcoded

### 4.5 · PR 23.3

Título · `feat(inversiones): T23.3 · fichas detalle · 3 grupos de tipo`

**STOP-AND-WAIT**

---

## 5 · SUB-TAREA 23.4 · Posiciones Cerradas · perspectiva inversor

### 5.1 · Alcance
Construir vista `/inversiones/cerradas` · posiciones que el usuario ya cerró · narrativa de inversor · NO de fiscal. La vista responde "cuánto gané · cuánto duraron · qué tasa de acierto tengo · cuál fue mi mejor jugada" · NO "qué casilla · qué ejercicio · qué paralela". Las referencias fiscales viven en el módulo Fiscal · NO se duplican aquí.

### 5.2 · Filosofía · sustitución del entry-point del mockup

El mockup tiene un entry-point en la galería principal etiquetado "HISTÓRICO FISCAL · desde XML IRPF · 2020-2024" con texto "ganancia neta declarada" · todo lenguaje fiscal. **CC sustituye ese entry-point por uno con narrativa de inversor:**

```
POSICIONES CERRADAS                                  {N} posiciones · {rangoAños}

  📦  Lo que ya cerraste            {N} posiciones                +X.XXX €
      tu trayectoria como inversor                         resultado neto histórico  →
```

Sin "IRPF" · sin "declarada" · sin "casilla" · sin "ejercicio" · sin "paralela". Solo balance histórico de inversor.

### 5.3 · Estructura vista expandida `/inversiones/cerradas`

#### Cabecera
- `detail-head` con botón volver
- Título · "Posiciones cerradas"
- Subtítulo · "tu trayectoria como inversor · {N} posiciones cerradas en {rangoAños}"

#### KPIs principales · 4 cards · narrativa inversor

```
TOTAL INVERTIDO     RESULTADO NETO        MEJOR CIERRE              PEOR CIERRE
12.000 €            +4.820 €              ETF Vanguard +3.120 €     ETF VWCE -100 €
en {N} cierres      tasa acierto X%       en 4 años · CAGR 14,9%    en 11 meses
```

- "Total invertido" · suma `aportado` de todas las posiciones cerradas · neutral
- "Resultado neto" · suma resultados · color por signo
- "Mejor cierre" · posición con mayor ganancia absoluta · nombre + valor + duración + CAGR
- "Peor cierre" · posición con mayor pérdida absoluta · nombre + valor + duración

#### Sub-stats · franja secundaria · narrativa inversor

```
TASA DE ACIERTO          RENTABILIDAD MEDIA          TIEMPO MEDIO EN CARTERA
67%                      CAGR +9,2%                  2 años 4 meses
2 de 3 con ganancia      ponderada por capital       desde apertura a cierre
```

- "Tasa de acierto" · `% posiciones cerradas con resultado > 0`
- "Rentabilidad media" · CAGR ponderado por capital invertido
- "Tiempo medio en cartera" · duración media en días/meses/años · auto-formato

#### Filtros · NARRATIVA INVERSOR · NO FISCAL

Permitidos:
- **Tipo de activo** · Acciones · Fondos · ETFs · Crypto · etc · todas · usar `clasificarTipo` de helpers
- **Resultado** · Todas · Solo ganancias · Solo pérdidas
- **Broker / entidad** · listado dinámico de entidades únicas
- **Ordenación** · Más reciente · Mayor ganancia · Mayor pérdida · Mayor duración · CAGR descendente

PROHIBIDOS:
- ❌ Filtro por año fiscal
- ❌ Filtro por estado de declaración
- ❌ Filtro por casilla
- ❌ Filtro "prescritas/no prescritas"

#### Listado · cartas posición cerrada

Estilo visualmente diferenciado de cartas activas (son del pasado · no son acción presente):

```css
.carta-cerrada { background: var(--card-alt); border: 1px solid var(--line);
                 border-radius: 11px; padding: 18px 22px; cursor: pointer;
                 transition: all .14s; opacity: 0.92; }
.carta-cerrada:hover { border-color: var(--ink-5); opacity: 1; background: var(--card); }
.carta-cerrada.ganancia { border-left: 3px solid var(--pos); }
.carta-cerrada.perdida { border-left: 3px solid var(--neg); }
.carta-cerrada.empate { border-left: 3px solid var(--ink-3); }
```

Estructura de cada carta:

```tsx
<div className={`carta-cerrada ${signClass(pos.resultado)}`}>
  <div className="cc-head">
    <div className="cc-marca">
      <CartaLogo entidad={pos.entidad} />
      <div>
        <div className="cc-nom">{pos.nombre}</div>
        <div className="cc-meta">{pos.unidades} {pos.unidadesLabel} · {pos.entidad}</div>
      </div>
    </div>
    <div className="cc-resultado">
      <span className={`delta ${signClass(pos.resultado)}`}>
        {formatDelta(pos.resultado)}
      </span>
      <span className="cc-resultado-pct">
        {formatPercent(pos.resultadoPercent)} en {formatDuracion(pos.duracionDias)}
      </span>
    </div>
  </div>
  
  <div className="cc-fechas">
    <span className="cc-fecha-item">
      <span className="lab">Apertura</span>
      <span className="val">{formatDate(pos.fechaApertura)}</span>
    </span>
    <span className="cc-fecha-item">
      <span className="lab">Cierre</span>
      <span className="val">{formatDate(pos.fechaCierre)}</span>
    </span>
    <span className="cc-fecha-item">
      <span className="lab">CAGR</span>
      <span className="val cagr">{pos.cagr ? formatPercent(pos.cagr) : '—'}</span>
    </span>
  </div>
  
  <div className="cc-cifras">
    <span className="cc-cifra-item">
      <span className="lab">Aportado</span>
      <span className="val">{formatMoney(pos.aportado)}</span>
    </span>
    <span className="cc-cifra-item">
      <span className="lab">Vendido</span>
      <span className="val">{formatMoney(pos.vendido)}</span>
    </span>
  </div>
  
  {/* Footer · puente al módulo Fiscal · opcional */}
  {pos.referenciaFiscal && (
    <div className="cc-footer">
      <button className="cc-link-fiscal" onClick={(e) => {
        e.stopPropagation();
        navigate(`/fiscal/operaciones/${pos.referenciaFiscal}`);
      }}>
        Ver detalles fiscales <ChevronRight size={11} strokeWidth={2} />
      </button>
    </div>
  )}
</div>
```

#### Estilos cartas cerradas (additional § Z)

```css
.cc-head { display: flex; justify-content: space-between; align-items: flex-start;
           margin-bottom: 14px; }
.cc-marca { display: flex; align-items: center; gap: 12px; }
.cc-nom { font-size: 14px; font-weight: 700; color: var(--ink);
          letter-spacing: -0.01em; }
.cc-meta { font-size: 11.5px; color: var(--ink-4); margin-top: 2px;
           font-family: 'JetBrains Mono', monospace; }
.cc-resultado { text-align: right; font-family: 'JetBrains Mono', monospace; }
.cc-resultado .delta { font-size: 16px; font-weight: 700; }
.cc-resultado-pct { display: block; font-size: 10.5px; color: var(--ink-4);
                    margin-top: 2px; font-weight: 500; }
.cc-fechas { display: flex; gap: 24px; padding-top: 12px;
             border-top: 1px solid var(--line-2); }
.cc-fecha-item { display: flex; flex-direction: column; gap: 2px; }
.cc-fecha-item .lab { font-size: 9.5px; text-transform: uppercase;
                       letter-spacing: 0.1em; color: var(--ink-4); font-weight: 600; }
.cc-fecha-item .val { font-size: 12px; font-weight: 600; color: var(--ink);
                       font-family: 'JetBrains Mono', monospace; }
.cc-fecha-item .val.cagr { color: var(--gold-ink); }
.cc-cifras { display: flex; gap: 24px; margin-top: 10px; }
.cc-cifra-item { display: flex; flex-direction: column; gap: 2px; }
.cc-footer { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line-2);
             text-align: right; }
.cc-link-fiscal { font-size: 11px; color: var(--ink-3); font-weight: 500;
                  display: inline-flex; align-items: center; gap: 4px;
                  background: none; border: none; cursor: pointer; }
.cc-link-fiscal:hover { color: var(--gold-ink); }
```

### 5.4 · Modelo `PosicionCerrada` y adaptador

CC NO añade store nuevo · construye adaptador que convierte fuente real (operaciones del XML IRPF · `operacionFiscalService` · `arrastresFiscalesService` · u otra · CC localiza al inicio) en estructura limpia para inversor:

```typescript
export interface PosicionCerrada {
  id: string;                       // ID estable · puede ser `${año}-${casilla}-${idx}` o similar · CC define
  nombre: string;                   // "Bankinter Eurostoxx · FI" · "BBVA · acciones ordinarias"
  tipo: TipoPosicion;               // mismo enum que PosicionInversion · permite reutilizar helpers
  entidad: string;                  // "BNP Paribas" · "MyInvestor" · etc
  unidades?: number;                // 400 (acciones · participaciones)
  unidadesLabel?: string;           // "acciones" · "participaciones"
  
  // Datos inversor
  fechaApertura?: string;           // ISO · si disponible · si no · null + warning
  fechaCierre: string;              // ISO · siempre disponible (se necesita para cerrar)
  duracionDias?: number;            // calculada si fechaApertura disponible
  aportado: number;                 // capital invertido · siempre positivo
  vendido: number;                  // valor de venta · siempre positivo
  resultado: number;                // vendido - aportado (puede ser negativo)
  resultadoPercent: number;         // (resultado / aportado) * 100
  cagr?: number;                    // null si fechaApertura no disponible
  
  // Puente al módulo Fiscal (opcional · presente solo si la operación viene del XML AEAT)
  referenciaFiscal?: string;        // ID en operacionFiscalService u otro · permite navegar a /fiscal/operaciones/X
}

// Adaptador en src/modules/inversiones/adapters/
export async function getPosicionesCerradas(): Promise<PosicionCerrada[]>;
export function calcularKpisCerradas(cerradas: PosicionCerrada[]): {
  totalInvertido: number;
  resultadoNeto: number;
  mejor: PosicionCerrada | null;
  peor: PosicionCerrada | null;
  tasaAcierto: number;        // 0-100
  cagrMedio: number;
  duracionMediaDias: number;
};
```

#### Reglas adaptador

- Si fuente da `fechaVenta` pero no `fechaApertura` (común en XML AEAT) · `fechaApertura = undefined` · `duracionDias = undefined` · `cagr = undefined` · UI muestra "—"
- Si fuente da `precioAdquisicion` y `precioVenta` pero no unidades · `unidades = undefined` · `unidadesLabel = undefined` · UI omite ese bloque
- Idempotente · llamar N veces da mismo resultado (datos no cambian salvo nuevo XML importado)
- NO inventa datos · NO completa con valores promedio · NO infiere fechas

### 5.5 · Botón "Ver detalles fiscales" · puente OPCIONAL

Cada carta cerrada · si la posición tiene `referenciaFiscal` · muestra footer con link discreto al módulo Fiscal:

- Click · navega a `/fiscal/operaciones/{referenciaFiscal}` (o ruta análoga · CC verifica)
- `e.stopPropagation()` para no disparar el click de la carta
- Texto · "Ver detalles fiscales" + chevron pequeño · color `--ink-3` (discreto · no es la acción principal)
- Si `referenciaFiscal` ausente (posición cerrada manualmente · sin XML) · NO mostrar el footer

### 5.6 · Verificación 23.4

- [ ] Vista renderiza con datos reales del usuario
- [ ] 4 KPIs principales · narrativa inversor · NO fiscal
- [ ] 3 sub-stats · narrativa inversor
- [ ] Filtros funcionan · todos perspectiva inversor · NINGUNO fiscal
- [ ] Cartas cerradas · color border-left por resultado (verde/rojo/gris)
- [ ] Botón "Ver detalles fiscales" · solo si `referenciaFiscal` presente · navega correctamente
- [ ] Cero referencia a "casillas" · "ejercicios" · "paralelas" · "prescripciones" · "declaraciones" en la UI
- [ ] tsc + build pasa
- [ ] Cero hex hardcoded

### 5.7 · PR 23.4

Título · `feat(inversiones): T23.4 · posiciones cerradas · perspectiva inversor (NO fiscal)`

**STOP-AND-WAIT**

---

## 6 · SUB-TAREA 23.5 · Cierre · validación e2e + docs

### 6.1 · Verificación e2e (`docs/T23-end-to-end-verification.md`)

Escenarios:
1. `/inversiones` · galería renderiza posiciones reales del usuario
2. Click en carta plan_pensiones · navega a `<FichaValoracionSimple>` · sparkline OK
3. Click en carta accion · navega a `<FichaDividendos>` · datos OK
4. Click en carta prestamo_p2p · navega a `<FichaRendimientoPeriodico>` · matriz OK
5. Botón Aportar · dialog · añade aportación · galería refresca
6. Botón Nueva posición · wizard · 3 caminos funcionan
7. Sección "Posiciones cerradas" · click navega a `/inversiones/cerradas` · vista renderiza con narrativa inversor
8. Resize · responsive 3/2/1 cols
9. grep cero hex hardcoded

### 6.2 · Checklist v5
Sección 17 punto por punto.

### 6.3 · Documentación
- `docs/T23-cierre.md` · resumen · diff visual antes/después · TODOs documentados (datos faltantes · enriquecimiento futuro)
- Actualizar `docs/TAREA-20-pendientes.md` · marcar Inversiones como cerrado por T23

### 6.4 · PR 23.5
Título · `chore(inversiones): T23.5 · cierre + docs + e2e · TAREA 23 ✅`

---

## 7 · Criterios de aceptación globales T23

- [ ] 5 sub-tareas mergeadas con stop-and-wait
- [ ] DB_VERSION en 65
- [ ] Galería 3 cols con cartas heterogéneas
- [ ] 3 fichas detalle por grupo de tipo
- [ ] Posiciones cerradas accesibles · narrativa inversor · sin referencias fiscales en UI
- [ ] Wizard nueva posición · 3 caminos
- [ ] Datos del usuario intactos · cero migración
- [ ] Cero hex hardcoded · tokens § Z
- [ ] Iconografía § AA
- [ ] Importadores re-ubicados desde page-head a wizard

---

## 8 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Datos del XML AEAT pobres · cartas con muchos placeholders | Alta | Placeholders coherentes documentados · TODO enriquecimiento manual · NO inventar |
| Tipos de posición sin ficha dedicada (cripto · otro) | Media | `<FichaGenerica>` fallback · TODO documentado |
| Eliminar 4 tabs rompe links externos guardados (`/inversiones/cartera`) | Baja | Redirects en App.tsx · `/inversiones/cartera` → `/inversiones` · `/inversiones/individual?id=X` → `/inversiones/X` |
| Sparkline con < 2 aportaciones · no renderiza | Alta | Placeholder visual · "datos insuficientes para gráfico" |
| Wizard duplica funcionalidad existente | Baja | Reusa `PosicionFormDialog` y rutas import existentes · solo nuevo disparador |
| Posiciones cerradas · datos no agregados al final | Media | Adaptador en 23.4 · si fuente no disponible · TODO documentado · placeholder coherente · NO inventar |
| CC introduce lenguaje fiscal en la UI de Inversiones por inercia (casillas · ejercicios · paralelas) | Alta | Spec §5 explícita · prohibido · revisión Jose en deploy preview verifica · puente al módulo Fiscal solo via botón discreto opcional |

---

## 9 · Lo que esta tarea NO hace

- ❌ NO modifica datos del usuario · solo presentación
- ❌ NO toca parser XML AEAT · datos como vienen
- ❌ NO añade features nuevas · solo presenta
- ❌ NO sube DB_VERSION
- ❌ NO toca módulo Fiscal · solo lo lee para histórico
- ❌ NO refactoriza modales existentes · los reusa
- ❌ NO migra ficha de Acciones RSU como caso especial · usa `<FichaDividendos>` genérica con datos reales
- ❌ NO implementa OAuth IndexaCapital · solo lo rutea desde wizard
- ❌ NO crea tipo nuevo de posición · usa los 11 existentes

---

## 10 · Después de T23

1. T22 puede seguir corriendo paralelo · cuando cierre · validación IRPF
2. T8 · refactor schemas restantes · descongelable
3. T10 · TODOs T7 residuales · descongelable
4. Patrón T23 (mockup vs realidad) aplicable a Inmuebles · Mi Plan · Personal si aparecen sombras
5. Enriquecimiento posiciones · feature posterior · permitir al usuario rellenar campos vacíos de posiciones XML (nombre detallado · ISIN · CAGR objetivo · etc) · NO scope T23

---

**Fin de spec T23 v1 · 5 sub-tareas con stop-and-wait estricto · cada una autocontenida · cada una en PR contra `main` directo · tokens canónicos § Z · iconografía § AA · paralelo permitido a T22.**
