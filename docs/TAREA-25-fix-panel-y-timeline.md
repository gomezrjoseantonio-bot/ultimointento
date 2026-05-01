# TAREA CC · TAREA 25 · Fix Panel (valor inmuebles + nav contratos + tipografía hero) + Timeline filas variables · v1

> **Tipo** · fix incremental sobre Panel · 1 PR único · 3 sub-tareas seguidas (sin stop-and-wait intermedio · usuario autorizado por urgencia)
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama base `main` actualizado tras T24
>
> **Tiempo estimado** · 4-6h CC
>
> **DB** · NO se toca · DB_VERSION en 65

---

## 0 · Reglas inviolables

- NO migrar datos · NO tocar schema
- NO usar hex hardcoded · tokens v5
- tsc + build pasan · cero ruptura de otros módulos
- 1 PR único · las 3 sub-tareas dentro

---

## 1 · BUG 1 · Valor de inmuebles incorrecto en Panel

### 1.1 · Síntoma
Pantallazo del usuario · Panel muestra "Inmuebles 502.831 €" cuando el valor real (suma de valoraciones reales) es ~1.106.000 €. Patrimonio Neto sale negativo (-41.951 €) porque el activo de inmuebles se infraestima.

### 1.2 · Causa raíz verificada
`src/services/dashboardService.ts` línea 567-582 ya usa `valoracionesService.getMapValoracionesMasRecientes('inmueble')` (T24) pero el matching `String(prop.id)` ↔ `String(activo_id)` falla para varias propiedades · y cae al fallback `acquisitionCosts.price` que es el precio de compra (mucho menor que valoración actual).

### 1.3 · Solución · matching robusto con fallback por nombre

Añadir a `valoracionesService` un nuevo método que enriquece el map existente con matching por nombre:

```typescript
// src/services/valoracionesService.ts (añadir después de getMapValoracionesMasRecientes)

async getMapValoracionesMasRecientesConMatchingPorNombre(
  tipo: 'inmueble' | 'inversion' | 'plan_pensiones'
): Promise<Map<string, { valor: number; fecha_valoracion: string; activo_nombre: string }>> {
  const db = await initDB();
  const all: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
  
  // Map indexado por id Y por nombre normalizado
  const byId = new Map<string, { valor: number; fecha_valoracion: string; activo_nombre: string }>();
  const byNombre = new Map<string, { valor: number; fecha_valoracion: string; activo_nombre: string }>();
  
  for (const v of all) {
    if (v.tipo_activo !== tipo) continue;
    const candidato = { 
      valor: v.valor, 
      fecha_valoracion: String(v.fecha_valoracion),
      activo_nombre: String(v.activo_nombre || '')
    };
    
    // Index por id
    const keyId = String(v.activo_id);
    const existingId = byId.get(keyId);
    if (!existingId || candidato.fecha_valoracion > existingId.fecha_valoracion) {
      byId.set(keyId, candidato);
    }
    
    // Index por nombre normalizado (lowercase + trim)
    const keyNombre = candidato.activo_nombre.toLowerCase().trim();
    if (keyNombre) {
      const existingNombre = byNombre.get(keyNombre);
      if (!existingNombre || candidato.fecha_valoracion > existingNombre.fecha_valoracion) {
        byNombre.set(keyNombre, candidato);
      }
    }
  }
  
  // Devolver map con resolución por id ó por nombre
  // El consumidor pasa la key del id · si no matchea · busca por nombre
  return {
    getByIdOrNombre(id: string | number, nombre: string): { valor: number; fecha_valoracion: string; activo_nombre: string } | undefined {
      const byIdResult = byId.get(String(id));
      if (byIdResult) return byIdResult;
      const keyNombre = String(nombre || '').toLowerCase().trim();
      if (!keyNombre) return undefined;
      return byNombre.get(keyNombre);
    },
    size: byId.size + byNombre.size,
  } as any;   // CC tipa correctamente · es un map enriquecido
},
```

CC define interface limpia para el resultado · NO any · NO map plano. Algo tipo:

```typescript
export interface ValoracionMatcher {
  getByIdOrNombre(id: string | number, nombre: string): { valor: number; fecha_valoracion: string; activo_nombre: string } | undefined;
  totalValoraciones: number;
  matchesPorId: number;
  matchesPorNombre: number;
}
```

### 1.4 · Modificar dashboardService

```typescript
// src/services/dashboardService.ts línea 566-582 · sustituir

const matcher = await valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre('inmueble');

const valorInmuebles = activeProperties.reduce((sum: number, prop: any) => {
  const propNombre = prop.alias || prop.address || '';
  const ultimaValoracion = matcher.getByIdOrNombre(prop.id, propNombre)?.valor;
  
  const fallbackValorActual = prop.valor_actual
    ?? prop.currentValue
    ?? prop.marketValue
    ?? prop.estimatedValue
    ?? prop.valuation
    ?? prop.compra?.valor_actual
    ?? prop.acquisitionCosts?.currentValue
    ?? prop.acquisitionCosts?.price
    ?? prop.compra?.precio_compra
    ?? 0;
  return sum + toNumber(ultimaValoracion ?? fallbackValorActual);
}, 0);
```

Aplicar el MISMO patrón en TODOS los consumidores que ya migraron a `valoracionesService` en T24.1 · si dependen de matching por id pueden estar fallando igual · CC verifica:
- `dashboardService.ts` (Panel · ya identificado)
- `informesDataService.ts` 
- `proyeccionMensualService.ts`
- `InmueblesAnalisis.tsx`
- `ListadoPage.tsx` Inmuebles (T24.2 ya hecho · verificar si también necesita el fallback)

Si encuentra otro consumidor con el mismo patrón roto · aplicar la misma solución.

### 1.5 · Verificación
- [ ] `tsc` pasa
- [ ] Patrimonio Neto en Panel debe coincidir con (suma valoraciones reales · 1.106k aprox) - deuda viva (637k aprox)
- [ ] Pulso de los 4 activos · "Inmuebles" debe mostrar la suma de valoraciones reales
- [ ] No regresiones en Inmuebles listado (T24.2)

---

## 2 · BUG 2 · Tipografía hero Patrimonio Neto demasiado pequeña

### 2.1 · Síntoma
Pantallazo · "−41.951 €" se ve mucho más pequeño que el mockup. CSS dice `font-size: 48px` pero `<MoneyValue>` aplica su propio span con `size='inline'` (~14-16px).

### 2.2 · Causa raíz verificada
`PanelPage.tsx` línea 414 · `<MoneyValue value={patrimonioNeto} decimals={0} tone="ink" />` SIN prop `size`. Default es `'inline'`. La clase `.money.inline` del CSS de MoneyValue sobrescribe el `font-size: 48px` del `.heroValor` contenedor.

### 2.3 · Solución
Cambiar la línea 414 a:

```tsx
<MoneyValue value={patrimonioNeto} decimals={0} tone="ink" size="kpiStar" />
```

`kpiStar` es la variante más grande de MoneyValue (verificar en `MoneyValue.module.css` que coincide con ~48px del mockup · si no · ajustar `--atlas-v5-fs-kpi-star`).

### 2.4 · Bug colateral · subtítulo dice texto fijo en lugar de delta
Línea 421 · `activos brutos · sin deuda` y línea 422 `· consolidado` · texto hardcoded.

Mockup correcto · "↗ +15.830 € (+2,4%) · últimos 30 días".

Sustituir por delta calculado real · CC verifica si existe servicio `dashboardService.getDelta30dPatrimonio()` · si no · documentar TODO y mostrar:

```tsx
<div className={`${styles.heroDelta} ${delta30d ? (delta30d.valor >= 0 ? styles.pos : styles.neg) : styles.muted}`}>
  {delta30d ? (
    <>
      {delta30d.valor >= 0 ? <Icons.ArrowUpRight size={14} strokeWidth={2} /> : <Icons.ArrowDownRight size={14} strokeWidth={2} />}
      {formatDelta(delta30d.valor)} ({formatPercent(delta30d.pct)})
      <span className={styles.heroDeltaMeta}>· últimos 30 días</span>
    </>
  ) : (
    <span className={styles.heroDeltaMeta}>histórico no disponible</span>
  )}
</div>
```

Si CC no encuentra servicio que devuelva el delta · construirlo simple · `(patrimonioNeto_hoy - patrimonioNeto_hace_30d) / patrimonioNeto_hace_30d`. Usar `valoracionesService.getValoracionAFecha()` para inmuebles a fecha hace 30 días · si no hay registros a esa fecha · null y muestra "histórico no disponible". NO inventar.

### 2.5 · Verificación
- [ ] Patrimonio Neto en hero se ve grande (tamaño mockup · ~48-52px monospace bold)
- [ ] Bajo el valor · si hay histórico · muestra delta real (no "activos brutos · sin deuda · consolidado")
- [ ] Si NO hay histórico · muestra "histórico no disponible" en gris

---

## 3 · BUG 3 · Click "X contratos vencen pronto" navega a tab incorrecta

### 3.1 · Síntoma
Click en alerta del Panel "6 contratos vencen pronto" → abre `/contratos` que muestra tab "Activos" por defecto. El usuario espera tab "Acciones" donde están los 6 vencimientos.

### 3.2 · Causa raíz verificada
1. `src/modules/panel/PanelPage.tsx` línea 240 · `href: '/contratos'` (sin query)
2. `src/modules/inmuebles/pages/ContratosListPage.tsx` línea 37 · `useState<Tab>('activos')` (default hardcoded · NO lee query param)

### 3.3 · Solución · 2 cambios atómicos

**Cambio 1** · `PanelPage.tsx` línea 240:
```typescript
href: '/contratos?tab=acciones',
```

**Cambio 2** · `ContratosListPage.tsx`:
```typescript
import { useSearchParams } from 'react-router-dom';

// Dentro del componente · sustituir línea 37
const [searchParams, setSearchParams] = useSearchParams();
const initialTab = (searchParams.get('tab') as Tab) || 'activos';
const [tab, setTab] = useState<Tab>(initialTab);

// Validar que el tab del query es válido (no inyección)
useEffect(() => {
  const queryTab = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['disponibilidad', 'acciones', 'activos', 'historico'];
  if (queryTab && validTabs.includes(queryTab) && queryTab !== tab) {
    setTab(queryTab);
  }
}, [searchParams]);

// Cuando el usuario cambia tab · actualizar query param
const handleTabChange = (newTab: Tab) => {
  setTab(newTab);
  setSearchParams({ tab: newTab }, { replace: true });
};

// Cambiar onClick del map de tabs (línea ~118):
// onClick={() => setTab(t.key)}
// →
// onClick={() => handleTabChange(t.key)}
```

CC verifica también el resto de alertas del Panel que naveguen a otros módulos con tabs · si las hay · aplicar mismo patrón.

### 3.4 · Verificación
- [ ] Click "X contratos vencen pronto" · abre /contratos?tab=acciones · tab "Acciones" activa · muestra los X contratos
- [ ] Click manual en otra tab · URL se actualiza
- [ ] Recargar URL `/contratos?tab=acciones` · respeta el tab query
- [ ] URL `/contratos` sin query · default sigue siendo "activos" (no romper nada)

---

## 4 · BUG 4 · Timeline 12 meses · chips solapados ilegibles + texto redundante

### 4.1 · Síntoma
Pantallazo · 6 contratos vencen en mayo-junio · solo se ven 2 carriles · texto cortado tipo "Vto. S..." "Vt..." imposible de leer.

### 4.2 · Causa raíz verificada
`YearTimeline.module.css` solo soporta 2 carriles vía `.stackB` (top + 16px). A partir del 3º evento en mismo mes · se solapan visualmente. Y el label `Vto. ${apellido}` (línea 160 de YearTimeline.tsx) · el "Vto." es redundante con el icono que ya identifica el tipo.

### 4.3 · Solución · 2 cambios

**Cambio A · texto del chip** · sin prefijo "Vto." · `YearTimeline.tsx` línea 160:
```typescript
label: nombreInquilino,
```

(quitar `Vto. `)

**Cambio B · layout del timeline · filas verticales que crecen según número de chips por mes**

Cambio de paradigma · pasar de **chips posicionados por % horizontal absoluto + stacking de 2 carriles** a **grid 12 columnas con celdas que crecen verticalmente**.

Reescribir `YearTimeline.tsx` función render (líneas ~245-280 actual) para:

1. Agrupar eventos por `mes` (0-11 desde mes actual) → `Map<number, EventoTimeline[]>`
2. Render como grid 12 columnas · cada columna ocupa 1/12 del ancho
3. Cada columna renderiza una pila vertical de chips · uno debajo del otro
4. La altura de la fila de eventos = max(chips por mes) × (alto chip + gap)
5. Mantener línea HOY roja vertical absoluta (igual que ahora)
6. Mantener línea horizontal sutil de baseline (igual)

```tsx
// Estructura nueva
<div className={styles.miniTlMonthsRow}>
  {meses.map((m) => <div key={m.idx} className={styles.miniTlMonth}>{m.label}</div>)}
</div>

<div className={styles.miniTlEventsGrid}>
  <div className={styles.miniTlToday} style={{ left: `${posicionHoyPct}%` }}>
    <span className={styles.miniTlTodayLab}>HOY</span>
  </div>
  
  {meses.map((m) => {
    const eventosDelMes = eventosByMes.get(m.idx) || [];
    return (
      <div key={m.idx} className={styles.miniTlMesColumn}>
        {eventosDelMes.map((ev) => (
          <button
            key={ev.id}
            className={`${styles.miniTlEvento} ${styles[ev.categoria]}`}
            onClick={() => navigate(ev.href)}
            title={ev.label}
          >
            {iconByCategoria(ev.categoria)}
            <span className={styles.miniTlEventoLab}>{ev.label}</span>
          </button>
        ))}
      </div>
    );
  })}
</div>
```

```css
/* YearTimeline.module.css · sustituir bloque .miniTlEventsRow */

.miniTlEventsGrid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  padding: 8px 0;
  position: relative;
  min-height: 40px;
  border-top: 1px solid var(--atlas-v5-line-2);
}

.miniTlMesColumn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 4px;
  align-items: stretch;
  min-width: 0;   /* permite truncado interno si hace falta */
}

.miniTlEvento {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-family: var(--atlas-v5-font-mono);
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  border: none;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.miniTlEventoLab {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

/* Categorías · backgrounds (mantener los existentes) */
.miniTlEvento.fiscal { background: var(--atlas-v5-brand); }
.miniTlEvento.contrato { background: var(--atlas-v5-gold); }
.miniTlEvento.deuda { background: var(--atlas-v5-neg); }
.miniTlEvento.devolucion { background: var(--atlas-v5-pos); }

/* ELIMINAR · .miniTlEventsRow .stackB · ya no se usa stacking absoluto */

.miniTlEvento:hover {
  transform: scale(1.03);
  box-shadow: 0 3px 8px rgba(14,20,35,0.15);
  z-index: 10;
}
```

### 4.4 · Posición HOY (línea roja)
Mantener como ahora · `position: absolute` · `left: ${posicionHoyPct}%`. Corre por encima del grid · no afecta layout de columnas.

### 4.5 · Tooltip
Si el texto del chip se trunca por ellipsis · el `title={ev.label}` nativo del browser muestra texto completo en hover. Suficiente · no requiere componente tooltip dedicado.

### 4.6 · Verificación
- [ ] Si 6 contratos vencen en mayo · se ven 6 chips apilados verticalmente en columna mayo · NO solapados
- [ ] Texto chip · "PARWEZ" · "PEREZ" · "CABANEL" · "ORIA" · "MEDINA" · "ESCUDERO" · sin "Vto."
- [ ] Click en chip navega correctamente
- [ ] Línea HOY roja sigue vertical en posición correcta
- [ ] Si un mes no tiene eventos · columna vacía · sin colapsar
- [ ] Si chip es más largo que columna · se trunca con ellipsis · tooltip muestra texto completo
- [ ] Responsive · si el contenedor es estrecho · mes con muchos chips puede crecer verticalmente todo lo que necesite

---

## 5 · Criterios de aceptación globales T25

- [ ] PR único en `main`
- [ ] Patrimonio Neto Panel cuadra con realidad del usuario
- [ ] Cifra Patrimonio Neto en hero tamaño grande (mockup ~48px)
- [ ] Subtítulo hero · delta real o "histórico no disponible"
- [ ] Click en "X contratos vencen pronto" abre /contratos?tab=acciones
- [ ] Tabs de contratos respetan ?tab= en URL (recarga · navegación)
- [ ] Timeline soporta 6+ chips en mismo mes sin solapamiento · texto sin "Vto." · solo apellido
- [ ] Cero hex hardcoded · cero ruptura visual otros módulos
- [ ] DB_VERSION en 65 · cero migración
- [ ] tsc + build pasan

---

## 6 · Lo que NO hace

- ❌ NO migra datos
- ❌ NO toca schema · NO sube DB_VERSION
- ❌ NO refactoriza otros servicios fuera de los identificados
- ❌ NO añade tabs nuevas en contratos · ya existen las 4 (Disponibilidad · Acciones · Activos · Histórico)
- ❌ NO toca módulos Tesorería · Inmuebles · Inversiones · Personal
- ❌ NO crea componente tooltip nuevo (usa title nativo)

---

## 7 · Descripción del PR (instrucciones para CC)

- Lista archivos modificados
- Confirmación · cifra Patrimonio Neto antes/después con datos del usuario · debe cuadrar
- Confirmación · matching por nombre activado · cuántos inmuebles matchean por id · cuántos por nombre (loguearlo en console al inicio)
- Screenshots · Panel hero antes/después · timeline antes/después · click contratos antes/después
- Confirmación · DB_VERSION sigue en 65

---

**Fin spec T25 v1 · 4 sub-bugs en 1 PR · listo para lanzar.**
