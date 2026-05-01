# TAREA CC · TAREA 23.6 · Wizard nueva posición v5 + Galería unificada · v1

> **Tipo** · refactor incremental sobre T23.1-T23.5 ya entregadas · NO reset · NO migración de datos
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · `main` actualizado tras T23.5
>
> **Alcance global** · resolver los 4 bugs conceptuales detectados en auditoría AUDITORIA-T23-mockup-vs-realidad.md · sin tocar schema · sin migrar datos · sin tocar T22:
>
> 1. Galería de Inversiones lee de los DOS stores existentes (`inversiones` + `planesPensiones`) y compone vista unificada
> 2. Cinta resumen 4 KPIs sticky encima de galería + fichas (solo en módulo Inversiones)
> 3. Wizard nueva posición v5 cubre los 11 tipos del modelo + dispatcher al form correcto según tipo (form rico de planes pensiones para PP · form genérico para resto)
> 4. Acciones autónomas en ficha · solo "Actualizar valoración" + edición de campos descriptivos · aportar/cobrar/vender entran por Tesorería (con CAMINO DOBLE · también disponible desde la ficha · ambos terminan en `movements` + `treasuryEvents`)
>
> **Tiempo estimado total** · 14-20h Copilot · 6-8h revisión Jose
>
> **Predecesores** · T22.1 ✅ · T23.1-T23.5 ✅ · T15 ✅ · T14 ✅ · T9 ✅ · TAREA 13 v2 ✅ (form rico de planes existente)
>
> **DB** · NO se toca schema · DB_VERSION sigue en 65 · 40 stores intactos
>
> **Stores tocados** · ninguno (lectura unificada de 2 stores existentes · escritura ya cableada en servicios actuales)

---

## 0 · Reglas inviolables (idénticas T15 / T14 / T9 / T22 / T23)

### 0.1 · STOP-AND-WAIT estricto entre sub-tareas
CC implementa una sub-tarea · publica PR · DETIENE EJECUCIÓN · espera revisión Jose. **Esta vez es CRÍTICO** · T23.1-T23.5 se entregaron de una sola vez sin revisión y por eso hay 40 divergencias. T23.6 NO se permite · ejecución secuencial obligatoria.

### 0.2 · NO inventar
Si CC encuentra ambigüedad · PARAR · esperar input.

### 0.3 · NO migrar datos · NO cambiar schema
Los 2 stores `inversiones` y `planesPensiones` permanecen separados. La unificación es **solo de lectura en UI**. DB_VERSION en 65.

### 0.4 · Mockup + guía v5 son ley
- Mockup vigente · `docs/audit-inputs/atlas-inversiones-v2.html` (1994 líneas validado)
- Guía vigente · `docs/audit-inputs/GUIA-DISENO-V5-atlas.md`

### 0.5 · Cero hex hardcoded · tokens v5 obligatorios

### 0.6 · Reusar existente
- Form rico de planes pensiones · `src/components/personal/planes/PlanForm.tsx` (TAREA 13 v2 · 269 líneas) · NO redibujar · solo adaptar a estética v5
- Modales aportación · cobro · valoración existentes · NO reemplazar
- Servicios `inversionesService` · `planesPensionesService` · `rendimientosService` · NO refactorizar

---

## Z · Tokens canónicos

Idénticos a T22 / T23 · ver `TAREA-22-dashboard-sidebar-topbar.md` § Z. La novedad de T23.6 es la **cinta resumen** que sigue el patrón de KPIStrip ya usado en Panel · adaptado a 4 KPIs sticky.

### Z.1 · Cinta resumen Inversiones · sticky (mockup §477-503)

```css
.inv-cinta { position: sticky; top: 0; z-index: 20;
             background: var(--brand-ink); color: #fff;
             padding: 14px 32px; display: flex; align-items: center; gap: 32px;
             border-bottom: 1px solid rgba(255,255,255,.08); }

.inv-cinta-brand { display: flex; align-items: center; gap: 12px; }
.inv-cinta-mark { width: 32px; height: 32px; border-radius: 8px;
                  background: linear-gradient(135deg, #E8D9AE, #B88A3E);
                  color: var(--brand-ink); font-weight: 700; font-size: 15px;
                  display: flex; align-items: center; justify-content: center; }
.inv-cinta-name { font-weight: 700; font-size: 15px; line-height: 1; letter-spacing: -0.01em; }
.inv-cinta-sub { font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase;
                 color: rgba(255,255,255,.45); margin-top: 2px; }

.inv-cinta-hd { display: flex; align-items: center; gap: 8px; flex: 1; padding-left: 24px;
                border-left: 1px solid rgba(255,255,255,.1); }
.inv-cinta-hd-dot { width: 8px; height: 8px; border-radius: 50%;
                    background: var(--gold); flex-shrink: 0; }
.inv-cinta-hd-text { font-size: 11px; text-transform: uppercase; letter-spacing: .14em;
                     color: rgba(255,255,255,.7); font-weight: 600; }

.inv-cinta-stats { display: flex; align-items: center; gap: 28px; }
.inv-cinta-stat { display: flex; flex-direction: column; gap: 2px; min-width: 110px; }
.inv-cinta-stat-lab { font-size: 9.5px; text-transform: uppercase; letter-spacing: .14em;
                      color: rgba(255,255,255,.5); font-weight: 600; }
.inv-cinta-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 17px;
                      font-weight: 700; color: #fff; letter-spacing: -0.015em; line-height: 1;
                      font-variant-numeric: tabular-nums; }
.inv-cinta-stat-val.pos { color: #6BAB87; }
.inv-cinta-stat-val.neg { color: #D67770; }
.inv-cinta-stat-val.gold { color: #E8D9AE; }
.inv-cinta-stat-sub { font-size: 9.5px; color: rgba(255,255,255,.5);
                      font-family: 'JetBrains Mono', monospace; }
```

**Estructura**:
```
[Atlas] [● MI CARTERA DE INVERSIONES] [VALOR TOTAL · 242.352 €] [RENTABILIDAD · +28,7% · +53.996 € latente] [COBRADO {MES} · +750 € · SmartFlip] [PREVISTO AÑO · +11.250 € · intereses P2P]
```

**Datos** · agregados de los DOS stores:
- `valor_total` = `Σ inversiones.valor_actual` + `Σ planesPensiones.valorActual`
- `rentabilidad_pct` = ponderada por capital
- `latente` = `valor_total - capital_total_aportado`
- `cobrado_mes` = `Σ rendimientosService.pagos del mes en curso con estado=cobrado`
- `previsto_año` = `Σ rendimientosService.proyección del año en curso`

Si algún dato no disponible · `—` · NO inventar.

### Z.2 · Cartas heterogéneas por tipo de posición

Spec exhaustiva por tipo (corrige las divergencias detectadas en auditoría):

#### Z.2.1 · Plantilla común carta
```css
.carta { background: var(--card); border: 1px solid var(--line); border-radius: 14px;
         padding: 22px; cursor: pointer; transition: all .14s; position: relative; overflow: hidden;
         display: flex; flex-direction: column; gap: 16px; min-height: 280px; }
.carta:hover { border-color: var(--gold); transform: translateY(-2px); 
               box-shadow: 0 6px 16px rgba(14,20,35,0.06); }
```

Border-top color por **agrupación de tipo** (no por tipo individual):
- `plan_pensiones` · `plan_empleo` → border-top `var(--brand)` (navy · color "plan")
- `prestamo_p2p` · `deposito_plazo` · `cuenta_remunerada` → border-top `var(--gold)` (oro · color "préstamo/depósito")
- `accion` · `etf` · `reit` · `fondo_inversion` → border-top `var(--pos)` (verde · color "equity/fondo")
- `crypto` → border-top `#6E5BC7` (púrpura · color "cripto")
- `otro` → border-top `var(--ink-3)` (gris)

#### Z.2.2 · Bloque superior (común a todas las cartas)
```html
<div class="carta-top">
  <div class="carta-marca">
    <div class="carta-logo {logoClass}">{logoText}</div>
    <div>
      <div class="carta-entidad-lab">{tipoLabel}</div>
      <div class="carta-entidad-nom">{entidad}</div>
    </div>
  </div>
  <span class="carta-tipo {tipoClass}">{tipoTagLabel}</span>
</div>
```

**Tipo labels** (mapping exhaustivo · CORRIGE divergencias detectadas):

| Tipo modelo | tipoLabel (uppercase letterspacing) | tipoTagLabel (chip) | tipoClass |
|---|---|---|---|
| `plan_pensiones` | "PLAN PENSIONES" | "PLAN PP" | plan |
| `plan_empleo` | "PLAN EMPLEO" | "PLAN PPE" | plan |
| `prestamo_p2p` (entidad ≠ "propia") | "PRÉSTAMO P2P" | "P2P" | prestamo |
| `prestamo_p2p` (entidad = "propia" o subtipo "empresa_propia") | "PRÉSTAMO A EMPRESA" | "PRÉSTAMO" | prestamo |
| `deposito_plazo` | "DEPÓSITO A PLAZO" | "DEPÓSITO" | deposito |
| `cuenta_remunerada` | "CUENTA REMUNERADA" | "CUENTA" | deposito |
| `accion` (subtipo "rsu") | "ACCIONES · RSU" | "ACCIÓN" | accion |
| `accion` (sin subtipo) | "ACCIONES" | "ACCIÓN" | accion |
| `etf` | "ETF" | "ETF" | accion |
| `reit` | "REIT" | "REIT" | accion |
| `fondo_inversion` | "FONDO INVERSIÓN" | "FONDO" | fondo |
| `crypto` | "CRYPTO" | "CRYPTO" | cripto |
| `otro` | "OTRO" | "OTRO" | otro |
| `deposito` (legacy) | "DEPÓSITO" | "DEPÓSITO" | deposito |

#### Z.2.3 · Bloque valor + sub (varía por agrupación)

**Para plan_pensiones · plan_empleo · fondo_inversion · accion · etf · reit · crypto · otro** (valoración simple):
```html
<div class="carta-nom">{nombre}</div>
<div>
  <div class="carta-valor">{formatMoney(valor_actual)}</div>
  <div class="carta-valor-sub">
    aportado {formatMoney(total_aportado)} · 
    <span class="delta {signClass(rentabilidad_euros)}">
      {formatDelta(rentabilidad_euros)} · {formatPercent(rentabilidad_porcentaje)}
    </span>
  </div>
</div>
```

**Para prestamo_p2p (en curso · no vencido)** · CORRIGE divergencia auditoría B.3:
```html
<div class="carta-nom">{nombre} · {tin}% TIN</div>   <!-- TIN incluido en título -->
<div>
  <div class="carta-valor">{formatMoney(capital_actual)}</div>
  <div class="carta-valor-sub">
    interés anual <span class="delta gold">{formatMoney(interes_anual)}</span> · {frecuencia_cobro}
  </div>
</div>
```

**Para prestamo_p2p (con amortización · ej Unihouser)** · CORRIGE divergencia auditoría B.4:
```html
<div class="carta-nom">{nombre} · {tin}% TIN</div>
<div>
  <div class="carta-valor">{formatMoney(pendiente_actual)}</div>
  <div class="carta-valor-sub">
    pendiente de {formatMoney(capital_inicial)} · 
    <span class="delta">amortizado {formatPercent(pct_amortizado)}</span>
  </div>
</div>
```

**Para accion (RSU)** · CORRIGE divergencia auditoría B.5:
```html
<div class="carta-nom">{nombre}</div>
<div>
  <div class="carta-valor">{formatMoney(valor_actual)}</div>
  <div class="carta-valor-sub">
    aportado {formatMoney(total_aportado)} · 
    <span class="delta muted">{formatPercent(rentabilidad_porcentaje)} · neutro</span>
  </div>
</div>
```
(RSU típicamente aportado = valor_consolidación a precio mercado · PnL ≈ 0)

#### Z.2.4 · Visualización contextual (varía por agrupación)

**Para plan_pensiones · plan_empleo · fondo_inversion · accion · etf · reit · crypto** · sparkline desde primera aportación con color por tendencia:
```html
<div class="carta-viz">
  <Sparkline serie={construirSerieValor(posicion)} 
             color={cagr_pct >= 0 ? 'var(--brand)' : 'var(--neg)'}
             height={56} />
</div>
```

**Para prestamo_p2p · deposito_plazo · cuenta_remunerada** · matriz cobros 12 meses año en curso:
```html
<div class="carta-viz">
  <MatrizCobros12m posicion={posicion} año={añoActual} />
</div>
```

Estados de cada celda:
- `cobrado` (mes pasado con cobro registrado) · background `var(--pos-wash)` · color `var(--pos)` · letra "+750 €" 
- `pendiente` (mes en curso esperado pero aún sin cobrar) · background `var(--gold-wash)` · color `var(--gold-ink)` · letra "750 €"
- `futuro` (mes posterior al actual) · background `var(--bg)` · color `var(--ink-4)` · letra "750 €"

CORRIGE divergencia auditoría B.3-B.4 · "todos en oro · ninguno verde".

**Para accion (RSU)** · NO sparkline · 3 filas info:
```html
<div class="carta-viz">
  <div class="info-row"><span class="lab">Precio acción</span><span class="val">{precio_actual} €</span></div>
  <div class="info-row"><span class="lab">Número acciones</span><span class="val">{numero_participaciones}</span></div>
  <div class="info-row"><span class="lab">Consolidación RSU</span><span class="val">{pct_consolidacion}% · {año_consolidacion}</span></div>
</div>
```

**Para otro · deposito (legacy)** · placeholder mínimo:
```html
<div class="carta-viz">
  <PlaceholderViz mensaje="—" />
</div>
```

#### Z.2.5 · Footer carta (varía por agrupación)

| Tipo | Footer meta |
|---|---|
| `plan_pensiones` · `plan_empleo` | "CAGR {pct}% · desde {año_inicio}" |
| `fondo_inversion` | "CAGR {pct}% · TER {ter}%" si TER conocido · si no · "CAGR {pct}%" |
| `prestamo_p2p` (en curso) | "vence {mes} {año} · {N} de {total} cobrados" |
| `prestamo_p2p` (con amortización) | "{cuota_mensual}/mes · vence {mes} {año}" |
| `deposito_plazo` | "vence {mes} {año} · TIN {tin}%" |
| `cuenta_remunerada` | "TIN {tin}% · liquidez total" |
| `accion` (RSU) | "disponible · liquidable" si consolidación = 100% · si no · "consolidando · {pct}%" |
| `accion` (no RSU) · `etf` · `reit` | "{n_dividendos} dividendos · yield {yield}%" si datos · si no · "—" |
| `crypto` | "wallet {entidad}" |
| `otro` | "—" |

CORRIGE divergencia auditoría B.3-B.5 · "footer mostraba TIN repetido en lugar de info de vencimiento".

### Z.3 · Logos por entidad (mapping conocido)

| Entidad reconocida | logoClass | logoText | background |
|---|---|---|---|
| MyInvestor | myi | MYI | gradient orange #FF8200 → #C8530A |
| BBVA | bbva | BBV | #004481 |
| Santander | san | SAN | #EC0000 |
| ING | ing | ING | #FF6200 |
| CaixaBank | caixa | CAI | #007FAA |
| Sabadell | sab | SAB | #00497A |
| Unicaja | uni | UNJ | #007F3D |
| BNP Paribas | bnp | BNP | #009657 |
| SmartFlip | smartflip | SF | var(--brand) navy |
| Unihouser | unihouser | UH | gradient #C59A47 → #B88A3E |
| IndexaCapital | indexa | IDX | #2D9CDB |
| Coinbase | coinbase | CB | #0052FF |
| Binance | binance | BIN | #F0B90B |
| Default (entidad no reconocida) | — | primeras 3 letras uppercase | `var(--bg)` con border `var(--line)` color `var(--ink-2)` |

CORRIGE divergencia auditoría B.5 · "logo UPT en lugar de BNP".

---

## 1 · SUB-TAREA 23.6.1 · Galería unificada (lee de los 2 stores)

### 1.1 · Alcance
- `<InversionesGaleria>` lee de **inversionesService.getAllPosiciones()** + **planesPensionesService.getAll()** y compone vista unificada
- Cada item del arreglo unificado lleva campo interno `_origen: 'inversiones' | 'planesPensiones'` y `_idOriginal` (para navegación a ficha y operaciones)
- La galería ordena por `valor_actual` descendente sin importar el origen
- Si una posición está en `inversiones` con tipo `plan_pensiones` Y también está duplicada en `planesPensiones` (caso edge · datos heredados pre-TAREA 13) · prevalece la del store `planesPensiones` (modelo rico)

### 1.2 · Tipo unificado en componente (NO en types/ · es solo helper UI)

```typescript
// src/modules/inversiones/types/cartaItem.ts (nuevo · helper UI · NO entra en stores)

import type { PosicionInversion } from '../../../types/inversiones';
import type { PlanPensiones } from '../../../types/planesPensiones';

export interface CartaItem {
  // Identificación
  _origen: 'inversiones' | 'planesPensiones';
  _idOriginal: number | string;
  
  // Campos comunes para render galería
  nombre: string;
  tipo: TipoCartaUI;          // ver Z.2.2 · más rico que TipoPosicion
  entidad: string;
  valor_actual: number;
  total_aportado: number;
  rentabilidad_euros: number;
  rentabilidad_porcentaje: number;
  fecha_apertura?: string;     // fecha_compra para inversiones · fechaContratacion para planes
  
  // Campos específicos opcionales según tipo
  tin?: number;
  cuota_mensual?: number;
  capital_inicial?: number;
  pct_amortizado?: number;
  interes_anual?: number;
  frecuencia_cobro?: string;
  fecha_vencimiento?: string;
  precio_actual?: number;
  numero_participaciones?: number;
  cagr_pct?: number;
  pct_consolidacion?: number;
  año_consolidacion?: number;
  
  // Original (para navegación · sin parseo)
  _original: PosicionInversion | PlanPensiones;
}

export function inversionToCartaItem(p: PosicionInversion): CartaItem;
export function planPensionToCartaItem(plan: PlanPensiones): CartaItem;
```

### 1.3 · Adaptador unificado

```typescript
// src/modules/inversiones/adapters/galeriaAdapter.ts (nuevo)

export async function getAllCartaItems(): Promise<CartaItem[]> {
  const posiciones = await inversionesService.getAllPosiciones();
  const planes = await planesPensionesService.getAll();   // si no existe getAll · usar el método equivalente
  
  // Convertir
  const itemsInversiones = posiciones
    .filter(p => p.activo)
    .filter(p => !esPlanPensionesYaEnPlanesStore(p, planes))   // dedup
    .map(inversionToCartaItem);
    
  const itemsPlanes = planes
    .filter(plan => plan.estado === 'activo')
    .map(planPensionToCartaItem);
  
  return [...itemsInversiones, ...itemsPlanes].sort((a, b) => b.valor_actual - a.valor_actual);
}
```

### 1.4 · Ficha detalle dispatcher

```typescript
// src/modules/inversiones/pages/FichaPosicionPage.tsx (modificar existente)

function FichaPosicionPage() {
  const { posicionId } = useParams();
  const item = useCartaItemById(posicionId);   // adaptador busca en los 2 stores
  
  if (!item) return <NotFound />;
  
  if (item._origen === 'planesPensiones') {
    return <FichaPlanPensiones plan={item._original as PlanPensiones} />;
  }
  
  // resto despacho según tipo (ya existente)
  const grupo = clasificarTipo(item.tipo);
  switch (grupo) { ... }
}
```

`<FichaPlanPensiones>` es nuevo en T23.6.4 · ahora placeholder TODO.

### 1.5 · Verificación 23.6.1
- [x] tsc + build pasa
- [x] Galería renderiza · si Jose tiene 2 planes en `planesPensiones` y 3 posiciones en `inversiones` · ve 5 cartas
- [x] Click en carta navega a `/inversiones/{id}` · ficha se renderiza correctamente según origen (placeholder TODO si plan)
- [x] Sección "Posiciones cerradas" sigue funcionando · ahora también lee planes con estado `rescatado_*` o `traspasado_externo`
- [x] DB_VERSION en 65 · NO escrituras en migración

### 1.6 · PR 23.6.1
Título · `feat(inversiones): T23.6.1 · galería unificada · lee de inversiones + planesPensiones`

**STOP-AND-WAIT**

---

## 2 · SUB-TAREA 23.6.2 · Cinta resumen sticky + cartas refinadas

### 2.1 · Alcance
- Construir `<CintaResumenInversiones>` según Z.1 · sticky `top: 0` · solo en módulo Inversiones (galería + fichas) · NO global
- Refinar `<CartaPosicion>` aplicando Z.2.2 · Z.2.3 · Z.2.4 · Z.2.5 con render contextual por tipo
- Aplicar Z.3 · mapping de logos conocidos
- Re-cablear datos reales · CORRIGE las 7 divergencias detectadas en auditoría sección B

### 2.2 · `<CintaResumenInversiones>`

```typescript
// src/modules/inversiones/components/CintaResumenInversiones.tsx

function CintaResumenInversiones() {
  const items = useAllCartaItems();
  const cobrosMes = useCobrosMesActual();   // de rendimientosService
  const previstoAño = usePrevistoAñoActual();
  
  const valorTotal = items.reduce((s, i) => s + i.valor_actual, 0);
  const aportadoTotal = items.reduce((s, i) => s + i.total_aportado, 0);
  const latente = valorTotal - aportadoTotal;
  const rentabilidadPct = aportadoTotal > 0 ? (latente / aportadoTotal) * 100 : 0;
  
  return (
    <div className="inv-cinta">
      <div className="inv-cinta-brand">
        <div className="inv-cinta-mark">A</div>
        <div>
          <div className="inv-cinta-name">Atlas</div>
          <div className="inv-cinta-sub">Patrimonio &amp; Renta</div>
        </div>
      </div>
      
      <div className="inv-cinta-hd">
        <div className="inv-cinta-hd-dot"></div>
        <div className="inv-cinta-hd-text">Mi cartera de inversiones</div>
      </div>
      
      <div className="inv-cinta-stats">
        <div className="inv-cinta-stat">
          <div className="inv-cinta-stat-lab">Valor total</div>
          <div className="inv-cinta-stat-val">{formatMoney(valorTotal)}</div>
        </div>
        <div className="inv-cinta-stat">
          <div className="inv-cinta-stat-lab">Rentabilidad</div>
          <div className={`inv-cinta-stat-val ${signClass(latente)}`}>
            {formatPercent(rentabilidadPct, {sign: true})}
          </div>
          <div className="inv-cinta-stat-sub">{formatDelta(latente)} latente</div>
        </div>
        <div className="inv-cinta-stat">
          <div className="inv-cinta-stat-lab">Cobrado {nombreMesAbreviado}</div>
          <div className="inv-cinta-stat-val pos">{formatDelta(cobrosMes.total)}</div>
          <div className="inv-cinta-stat-sub">{cobrosMes.fuentePrincipal || '—'}</div>
        </div>
        <div className="inv-cinta-stat">
          <div className="inv-cinta-stat-lab">Previsto año</div>
          <div className="inv-cinta-stat-val gold">{formatDelta(previstoAño.total)}</div>
          <div className="inv-cinta-stat-sub">{previstoAño.descripcion || 'rendimientos esperados'}</div>
        </div>
      </div>
    </div>
  );
}
```

Renderiza encima de `<InversionesGaleria>` y de `<FichaPosicionPage>` (en el layout del módulo Inversiones).

### 2.3 · `<CartaPosicion>` refinada

Re-implementar según Z.2 · sin modales reglas hardcoded · render contextual:

```typescript
function CartaPosicion({ item }: { item: CartaItem }) {
  return (
    <div className={`carta ${cardClass(item.tipo)}`} onClick={() => navigate(`/inversiones/${item._idOriginal}`)}>
      <CartaTop item={item} />                    {/* Z.2.2 */}
      <CartaNombreYValor item={item} />           {/* Z.2.3 según tipo */}
      <CartaVisualizacion item={item} />          {/* Z.2.4 según tipo */}
      <CartaFooter item={item} />                 {/* Z.2.5 según tipo */}
    </div>
  );
}
```

Cada sub-componente despacha según `item.tipo` y campos disponibles. Si un campo necesario para footer no está disponible · render "—" · NUNCA inventa.

### 2.4 · Verificación 23.6.2
- [x] Cinta resumen sticky en galería · scrolleo y queda fija
- [x] Cinta visible también en fichas detalle (mismo layout module)
- [x] Cinta no aparece en otros módulos (Tesorería · Inmuebles · Panel · etc)
- [x] Datos cinta · valor · rentabilidad · cobrado · previsto · todos reales del usuario o "—"
- [x] Cartas Smartflip · Unihouser · Acciones Orange RSU corregidas según Z.2.3-Z.2.5
- [x] Logos correctos según Z.3 (no más "UPT" en Acciones Orange · sería "BNP")
- [x] Cero hex hardcoded
- [x] Si Jose tiene plan PP en `planesPensiones` (TAREA 13 v2) · aparece carta con border navy · sparkline · footer "CAGR X% · desde {año}"

### 2.5 · PR 23.6.2
Título · `feat(inversiones): T23.6.2 · cinta resumen sticky + cartas refinadas por tipo`

**STOP-AND-WAIT**

---

## 3 · SUB-TAREA 23.6.3 · Wizard nueva posición v5 · 11 tipos + dispatcher

### 3.1 · Alcance
Reemplazar `WizardNuevaPosicion` actual por una versión que:
- Cubre los 11 tipos del modelo (no 6 como ahora)
- Dispatcha al form correcto según tipo · si tipo ∈ {plan_pensiones · plan_empleo} → reusa `<PlanForm>` (TAREA 13 v2 · 269 líneas) adaptado a estética v5 · si otro tipo → reusa `<PosicionFormDialog>` actual ampliado
- Estética v5 sobre tokens canónicos
- Mantiene los 3 caminos del wizard original (alta manual · IndexaCapital · aportaciones)

### 3.2 · Estructura nuevo wizard · 2 pasos

**Paso 1 · ¿Qué tipo de posición quieres añadir?**

Grid de tarjetas seleccionables · agrupadas en 4 columnas:

```
┌─ PLANES PENSIONES ─┐ ┌─ EQUITY / FONDOS ─┐ ┌─ RENTA FIJA / CRÉDITO ─┐ ┌─ OTROS ─┐
│ Plan PP individual │ │ Acciones          │ │ Préstamo P2P          │ │ Crypto  │
│ Plan PP empresa    │ │ ETF                │ │ Préstamo a empresa    │ │ Otro    │
│                    │ │ REIT               │ │ Depósito a plazo      │ │         │
│                    │ │ Fondo inversión    │ │ Cuenta remunerada     │ │         │
└────────────────────┘ └────────────────────┘ └────────────────────────┘ └─────────┘

[Importar IndexaCapital]   [Importar aportaciones]   ← 2 atajos especiales abajo
```

11 tipos · 2 atajos. El usuario hace click en una tarjeta → paso 2.

**Paso 2 · Form específico**

Dispatcher según tipo:
- `plan_pensiones` · `plan_empleo` → render `<PlanFormV5>` (basado en `PlanForm.tsx` actual + estética v5 + el modelo `PlanPensiones` completo · 4 tipos administrativos · subtipos · políticas · 3 roles aportantes · etc · todo lo de TAREA 13 v2)
  - Si usuario eligió "Plan PP individual" en paso 1 · `tipoAdministrativo` pre-seleccionado a `PPI` (puede cambiar)
  - Si eligió "Plan PP empresa" · pre-seleccionado a `PPE` · usuario puede cambiar a `PPES` o `PPA`
- Resto → render `<PosicionFormV5>` (basado en `PosicionFormDialog.tsx` actual · 940 líneas · adaptado a v5 · cubre 9 tipos restantes · cada tipo expone los campos relevantes según el modelo `PosicionInversion`)

### 3.3 · `<PlanFormV5>` · adaptación de PlanForm.tsx existente

NO redibujar desde cero · TOMAR `src/components/personal/planes/PlanForm.tsx` (269 líneas) y:
1. Migrar de `AtlasModal` a layout v5
2. Mantener el modelo completo (`tipoAdministrativo` · subtipos · `politicaInversion` · `modalidadAportacion` · 3 roles aportantes con desglose)
3. Cero hex hardcoded · todo via tokens v5
4. Submit sigue escribiendo en `planesPensionesService` · NO cambia destino

### 3.4 · `<PosicionFormV5>` · adaptación de PosicionFormDialog.tsx existente

NO redibujar desde cero · TOMAR `src/components/inversiones/PosicionFormDialog.tsx` (940 líneas) y:
1. Migrar a layout v5
2. **Ampliar TIPO_MAP de 6 a 9 tipos** (para los no-plan)
   ```typescript
   type TipoUI_NoPlan = 
     | 'accion'
     | 'etf'
     | 'reit'
     | 'fondo_inversion'
     | 'prestamo_p2p'
     | 'prestamo_empresa'      // NUEVO · variante prestamo_p2p con flag entidad="propia"
     | 'deposito_plazo'
     | 'cuenta_remunerada'      // NUEVO
     | 'crypto'
     | 'otro';                  // NUEVO
   ```
3. Cada tipo expone los campos relevantes del modelo `PosicionInversion`:
   - `accion` · `etf` · `reit` · ticker · numero_participaciones · precio_medio_compra · cuenta_cobro_id · dividendo_anual_estimado (opcional) · subtipo "rsu" si accion
   - `fondo_inversion` · isin · numero_participaciones · precio_medio_compra · cuenta_cobro_id
   - `prestamo_p2p` · capital · tin · duracion_meses · modalidad_devolucion · frecuencia_cobro · fecha_inicio · cuenta_cargo_id · cuenta_cobro_id · retencion_fiscal
   - `prestamo_empresa` · igual que P2P · marca interna `entidad="propia"`
   - `deposito_plazo` · capital · tin · duracion_meses · liquidacion_intereses · fecha_inicio · cuenta_cargo_id
   - `cuenta_remunerada` · capital_inicial · tin · entidad · cuenta_cargo_id · liquidacion_intereses
   - `crypto` · ticker · numero_participaciones · precio_medio_compra · entidad (wallet/exchange)
   - `otro` · campos libres · nombre · valor_actual · total_aportado · notas
4. Cero hex hardcoded · todo via tokens v5
5. Submit sigue escribiendo en `inversionesService` · NO cambia destino

### 3.5 · Camino doble para aportaciones (ya existente · solo se cablea entrada desde ficha)

Es el otro punto de tu decisión #2 · "DOBLE camino"·

- Camino 1 (existente · ÚNICO HOY) · usuario apunta movimiento desde Tesorería · `movements` y/o `treasuryEvents` · `rendimientosService` lo asocia a la posición correspondiente vía `cuenta_cargo_id` · `cuenta_cobro_id`
- Camino 2 (NUEVO en T23.6.3) · usuario abre ficha de posición · pulsa botón "Aportar" o "Registrar cobro" · se abre modal que **ESCRIBE en los mismos stores** (`movements` + `treasuryEvents`) y refresca posición. NO escribe en lugar diferente. NO duplica datos. Solo es un atajo de UI.

CC verifica al inicio si los modales actuales `<AportacionFormDialog>` y `<RegistrarCobroDialog>` ya escriben en el destino correcto. Si no · ajustar para que sí · sin cambiar modelo.

### 3.6 · Verificación 23.6.3
- [x] Wizard paso 1 · 11 tipos visibles · agrupados en 4 columnas · 2 atajos abajo
- [x] Click en cada tipo abre form correcto (PlanFormV5 vs PosicionFormV5)
- [x] Plan PP individual abre PlanFormV5 con `tipoAdministrativo='PPI'` pre-seleccionado · usuario puede cambiar
- [x] Plan PP empresa abre PlanFormV5 con `tipoAdministrativo='PPE'` pre-seleccionado
- [x] Form rico de planes muestra tipoAdministrativo · subtipos según selección · políticas · 3 roles aportantes · TODO lo de TAREA 13 v2
- [x] Form genérico cubre los 9 tipos no-plan · cada uno con campos relevantes
- [x] Estética v5 · cero hex hardcoded
- [x] Submit escribe en store correcto según tipo (planesPensiones vs inversiones) · DB_VERSION 65 intacta
- [x] IndexaCapital y aportaciones siguen accesibles desde wizard

### 3.7 · PR 23.6.3
Título · `feat(inversiones): T23.6.3 · wizard v5 · 11 tipos · dispatcher PlanForm vs PosicionForm`

**STOP-AND-WAIT**

---

## 4 · SUB-TAREA 23.6.4 · Ficha plan pensiones detallada

### 4.1 · Alcance
Construir `<FichaPlanPensiones>` según mockup §1615-1802 (Plan Orange BBVA). Estructura:
- Detail-head · botón volver · título "{nombre}" · subtítulo con tipoAdministrativo · gestoraActual · isinActual
- 4 KPIs · Valor actual · Aportado total · Pérdida/ganancia latente · CAGR
- Sparkline gigante · evolución histórica vs aportado acumulado
- Si tipoAdministrativo ∈ {PPE · PPES} · sección "Estructura aportación" con desglose empresa + trabajador
- Sección "Ventaja fiscal · campaña {añoActual}" · reducción base IRPF · ahorrado en cuota
- Si plan tiene política de inversión definida · panel "Composición" placeholder con TODO (datos no disponibles típicamente)
- Tabla aportaciones históricas · todas las aportaciones del plan
- Botones acción · "Actualizar valoración" (única acción autónoma · escribe en `valoraciones_historicas` o equivalente del store) + "Aportar" (camino doble · abre modal que escribe en movements+treasuryEvents) + "Editar plan" (abre PlanFormV5 en modo edición · NO mueve dinero · solo cambia campos descriptivos)

### 4.2 · Verificación 23.6.4
- [x] Click en carta plan_pensiones → ficha renderiza
- [x] 4 KPIs reales del plan
- [x] Sparkline si hay ≥ 2 valoraciones · placeholder si no
- [x] Estructura aportación visible solo para PPE/PPES
- [x] Ventaja fiscal calculada según tipo · límite anual · marginal
- [x] Botones funcionan · Actualizar valoración (autónoma) · Aportar (camino doble · pasa por movements) · Editar (abre form sin mover dinero)
- [x] tsc + build pasa

### 4.3 · PR 23.6.4
Título · `feat(inversiones): T23.6.4 · ficha plan pensiones detallada`

**STOP-AND-WAIT**

---

## 5 · SUB-TAREA 23.6.5 · Cierre + e2e + docs

### 5.1 · Verificación e2e
1. `/inversiones` · cinta sticky + galería con TODAS las posiciones (inversiones + planes)
2. Click en carta P2P · ficha P2P (existente) renderiza con datos correctos
3. Click en carta plan PP · ficha plan PP nueva renderiza con estructura aportación si PPE
4. Botón "Aportar" en ficha · abre modal · escribe en movements · ficha refresca
5. Botón "Actualizar valoración" · escribe en valoraciones · KPI valor actual cambia
6. Wizard nueva posición · 11 tipos · dispatcher correcto
7. Posiciones cerradas · narrativa inversor (ya cerrado en T23.4)

### 5.2 · Documentación
- `docs/T23-6-cierre.md` · resumen · diff antes/después · TODOs documentados
- Actualizar `docs/TAREA-20-pendientes.md` · marcar Inversiones como cerrado tras T23.6

### 5.3 · PR 23.6.5
Título · `chore(inversiones): T23.6.5 · cierre + docs + e2e · TAREA 23.6 ✅`

---

## 6 · Criterios de aceptación globales T23.6

- [x] 5 sub-tareas mergeadas con stop-and-wait estricto (cada PR validado por Jose en deploy preview antes de la siguiente)
- [x] DB_VERSION en 65 · stores intactos · cero migración
- [x] Galería unificada · planes y posiciones en una vista
- [x] Cinta resumen sticky en módulo Inversiones · solo aquí · agrega los 2 stores
- [x] Cartas con render contextual por tipo · 11 tipos cubiertos · logos por entidad · footer correcto
- [x] Wizard v5 con 11 tipos · dispatcher PlanFormV5 vs PosicionFormV5
- [x] Camino doble Tesorería ↔ Ficha funcional · ambos escriben en movements+treasuryEvents
- [x] Cero hex hardcoded · tokens canónicos
- [x] 7 divergencias auditoría sección B corregidas (Smartflip · Unihouser · Acciones Orange RSU · etc)

---

## 7 · Lo que esta tarea NO hace

- ❌ NO migra datos
- ❌ NO cambia schema · NO sube DB_VERSION
- ❌ NO refactoriza servicios (`inversionesService` · `planesPensionesService` · `rendimientosService`)
- ❌ NO redibuja modales aportación · cobro · valoración existentes (solo se cablean entradas desde ficha)
- ❌ NO mueve datos de `inversiones` a `planesPensiones` ni viceversa
- ❌ NO toca módulos Tesorería · Inmuebles · Panel · Personal
- ❌ NO toca T22 (Dashboard)
- ❌ NO replica el bug del mockup donde Personal usa Building2 (T22.1 ya lo arregló con User)

---

## 8 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Adaptador unificación duplica entre stores en caso edge | Media | Función dedup explícita · plan en `planesPensiones` prevalece sobre posición tipo `plan_pensiones` en `inversiones` |
| `planesPensionesService.getAll` no expone método público | Baja | CC verifica al inicio · si falta · añadir método público sin cambiar modelo |
| Cinta sticky choca con topbar T22.1 · doble sticky | Media | Cinta `top: 52px` (debajo de topbar) · validar en deploy preview |
| Wizard plan PP edita y pierde campos avanzados | Alta | PlanFormV5 hereda 100% del PlanForm.tsx existente · solo se reestiliza · ningún campo se quita |
| Refactorizar modales rompe flujos existentes | Alta | NO se refactorizan · solo se cablean entradas desde ficha · ningún cambio de servicio |

---

**Fin de spec T23.6 v1 · 5 sub-tareas con stop-and-wait estricto · listo para lanzar tras revisión.**
