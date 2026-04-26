# MAPEO DATOS · MI PLAN · LANDING v3 · DEFINITIVO

> **TAREA 5 · paso 1 de N**
>
> Documento que sustituye al borrador `MAPEO-DATOS-mi-plan-landing.md` (que se construyó sobre asunciones de stores · pre-auditoría).
>
> **Fuente de verdad** · snapshot real DB Jose · 26 abril 2026 · DB_VERSION 59 · 59 stores · `atlas-snapshot-20260426-10.json` (1.4 MB).
>
> **Objetivo** · para cada elemento visual del mockup `atlas-mi-plan-landing-v3.html` · documentar el origen exacto del dato que CC tiene que conectar al implementarlo.

---

## 1 · Cambios respecto al borrador inicial

3 cosas eran erróneas en el borrador y se corrigen aquí:

1. **`gastosInmueble` schema real** · `inmuebleId` (no `propertyId`) · `ejercicio` (no `año`) · `categoria` enum (`'intereses'|'comunidad'|'ibi'|'seguro'|'reparacion'|'suministro'|'gestion'|'otro'`)
2. **`prestamos.id` es STRING UUID** (`prestamo_<timestamp>_<rand>`) · NO number
3. **`contracts.rentaMensual` es campo escalar** del contrato · NO viene del store `rentaMensual` (que está deprecado · 0 registros tras BUG-07 cerrado opción A)

Y 2 hallazgos del snapshot que afectan al landing:

- **`compromisosRecurrentes` está VACÍO** · 0 registros tras unificación G-01. Los gastos recurrentes históricos viven en `gastosInmueble` con `categoria != 'otro'` y `origen='xml_aeat'`. Para proyectar opex futuro · el landing tiene que **derivar de gastosInmueble histórico** o esperar a que el usuario alimente `compromisosRecurrentes`.
- **`treasuryEvents` solo tiene 13 entradas tipo 'financing' predicted** · NO hay rentas ni opex proyectados. La card "Proyección" del landing leerá esencialmente vacío hasta que alguien (usuario o motor) genere los eventos.

---

## 2 · Stores referenciados por el Landing

### 2.1 · Lectura

| Store | Para qué | Estado en snapshot Jose |
|---|---|---|
| `accounts` | Saldo total tesorería (L26) | 8 registros · saldos `balance: 0` (¡vacíos!) · solo `openingBalance` |
| `contracts` | Renta mensual activa (L12 · 3.1) | 6 contratos · todos `estadoContrato: 'sin_identificar'` |
| `gastosInmueble` | Opex anual (L12 · 3.1) | 109 registros · 2022-2024 |
| `inversiones` | Intereses mensuales (L12 · 3.1) | 12 registros · 4 con `activo: true` |
| `treasuryEvents` | Resultado caja anual/mensual (L14-L17) | 13 registros · solo cuotas préstamo predicted |
| `prestamos` | (No directo · solo para referencia FK) | 13 registros · todos `estado: 'vivo'` (con drift) |
| `escenarios` | Estrategia · gastosVidaLibertad · modoVivienda (L08 · L10) | **VACÍO** · falta UI para alimentar |
| `objetivos` | Conteos por estado (L21-L25) | **VACÍO** · falta UI |
| `fondos_ahorro` | Conteo activos · nombres (L27-L28) | **VACÍO** · falta UI |
| `retos` | Reto activo del mes (L30-L35) | **VACÍO** · falta UI |

### 2.2 · ⚠ Stores a NO leer

| Store | Por qué NO |
|---|---|
| `rentaMensual` | DEPRECATED · BUG-07 opción A · 0 registros · NO leer · usar `contracts.rentaMensual` |
| `objetivos_financieros` | ELIMINADO en V59 · sustituido por `escenarios` |
| `compromisosRecurrentes` | Vacío en producción actual · si en algún momento se puebla · usar como sumando opex; mientras tanto · derivar de `gastosInmueble` |
| `opexRules` | DEPRECATED post G-01 · 0 registros · NO leer |

---

## 3 · Cálculos derivados · 8 fórmulas centrales

Cada elemento visual depende de máximo 1-2 de estas fórmulas. Se calculan al renderizar.

### 3.1 · Renta pasiva neta operativa actual (€/mes)

```typescript
async function calcularRentaPasivaNetaOperativa(): Promise<number> {
  // 1. Rentas activas
  const contracts = await db.getAll('contracts');
  const rentasActivas = contracts
    .filter(c => 
      c.estadoContrato !== 'archivado' && 
      c.estadoContrato !== 'finalizado' &&
      // 'sin_identificar' SÍ cuenta · es contrato del XML que está activo aunque sin inquilino conocido
      esFechaActiva(c.fechaInicio, c.fechaFin)
    )
    .reduce((sum, c) => sum + (c.rentaMensual ?? 0), 0);

  // 2. Intereses inversiones mensuales
  const inversiones = await db.getAll('inversiones');
  const interesesInversiones = inversiones
    .filter(i => i.activo === true)
    .reduce((sum, i) => sum + estimarRentaMensual(i), 0);
  // estimarRentaMensual depende del tipo:
  //   prestamo_p2p → leer rentabilidad_porcentaje · aplicar a valor_actual / 12
  //   plan_pensiones → 0 (no genera renta operativa hasta jubilación)
  //   crypto · fondo_inversion → 0 (revalorización · no operativa)

  // 3. Opex mensual inmuebles
  const gastos = await db.getAll('gastosInmueble');
  const añoActual = new Date().getFullYear();
  const añoAnterior = añoActual - 1;
  const opexAnualPasado = gastos
    .filter(g => g.ejercicio === añoAnterior && g.categoria !== 'intereses') 
    // intereses NO es opex operativo · es coste financiero
    .reduce((sum, g) => sum + (g.importe ?? 0), 0);
  const opexMensual = opexAnualPasado / 12;

  return rentasActivas + interesesInversiones - opexMensual;
}
```

**Notas:**
- **Intereses hipoteca NO se restan aquí** · son coste financiero · separados (decisión Mi Plan)
- **Estado `sin_identificar` SÍ cuenta como activo** (axioma de Mi Plan v3 · ver memoria)
- **Año actual o año anterior para opex** · decisión a validar · mi voto **año anterior** · el año en curso aún no tiene cierre fiscal

### 3.2 · Gastos vida libertad (€/mes)

```typescript
async function getGastosVidaLibertad(): Promise<number> {
  const escenarios = await db.getAll('escenarios');
  if (escenarios.length === 0) return 2500; // default conservador
  return escenarios[0].gastosVidaLibertadMensual ?? 2500;
}
```

### 3.3 · Tasa libertad (%)

```typescript
async function getTasaLibertad(): Promise<number> {
  const renta = await calcularRentaPasivaNetaOperativa();
  const gastos = await getGastosVidaLibertad();
  if (gastos === 0) return 0;
  return Math.round((renta / gastos) * 100);
}
```

### 3.4 · Gap mensual (€/mes)

```typescript
async function getGapMensual(): Promise<number> {
  const renta = await calcularRentaPasivaNetaOperativa();
  const gastos = await getGastosVidaLibertad();
  return gastos - renta; // positivo = falta · negativo = sobrepasa
}
```

### 3.5 · Año libertad estimado

```typescript
async function getAñoLibertadEstimado(): Promise<{ año: number; mes: number }> {
  const escenario = (await db.getAll('escenarios'))[0];
  const estrategia = escenario?.estrategia ?? 'hibrido';
  const hitos = escenario?.hitos ?? [];

  let rentaPasiva = await calcularRentaPasivaNetaOperativa();
  let gastosVida = await getGastosVidaLibertad();

  const añoActual = new Date().getFullYear();
  const inflacion = estrategia === 'agresivo' ? 0.025 : 
                    estrategia === 'conservador' ? 0.030 : 0.028;
  const crecimientoBaseRenta = estrategia === 'agresivo' ? 0.04 : 
                                estrategia === 'conservador' ? 0.02 : 0.03;

  for (let año = añoActual; año < añoActual + 50; año++) {
    // Aplicar hitos del año
    const hitosAño = hitos.filter(h => new Date(h.fecha).getFullYear() === año);
    const impactoHitos = hitosAño.reduce((sum, h) => sum + h.impactoMensual, 0);
    rentaPasiva = rentaPasiva * (1 + crecimientoBaseRenta) + impactoHitos;
    gastosVida = gastosVida * (1 + inflacion);

    if (rentaPasiva >= gastosVida) {
      return { año, mes: 9 }; // mes default · refinable interpolando
    }
  }
  return { año: añoActual + 50, mes: 12 }; // tope
}
```

⚠ **Esta fórmula es heurística · no auditada por Jose**. Para v1 está bien · en TAREA 7 (motor de proyección) se afina. Lo importante en TAREA 5 es **que el modelo de cálculo está documentado** y CC tiene un punto de partida.

### 3.6 · Tesorería total líquida (€)

```typescript
async function getTesoreriaTotal(): Promise<number> {
  const accounts = await db.getAll('accounts');
  return accounts
    .filter(a => a.isActive === true || a.activa === true)
    .reduce((sum, a) => sum + (a.balance ?? 0), 0);
  // ⚠ En snapshot actual balance=0 en todas · necesita reconciliación movimientos
  // Si balance=0 universalmente · fallback: usar openingBalance + suma de movements desde openingBalanceDate
}
```

### 3.7 · Euros sin propósito (€)

```typescript
async function getSinProposito(): Promise<number> {
  const tesoreria = await getTesoreriaTotal();
  const fondos = await db.getAll('fondos_ahorro');
  const asignadoTotal = await fondos
    .filter(f => f.activo)
    .reduce(async (sumPromise, f) => {
      const sum = await sumPromise;
      return sum + await getSaldoActualFondo(f.id); // de fondosService
    }, Promise.resolve(0));
  return tesoreria - asignadoTotal;
}
```

### 3.8 · Resultado caja anual / mensual

```typescript
async function getResultadoCajaAño(año: number): Promise<number> {
  const events = await db.getAll('treasuryEvents');
  const eventsAño = events.filter(e => 
    new Date(e.predictedDate).getFullYear() === año
  );
  return eventsAño.reduce((sum, e) => sum + signoSegunTipo(e), 0);
}
// signoSegunTipo · type='income' suma · type='expense'/'financing' resta
```

⚠ **En el snapshot actual hay solo 13 events tipo 'financing'** · resultado caja sale negativo solo. Para que esto funcione bien · hace falta motor de generación de events tipo 'income' (rentas) y 'expense' (opex). **Eso es FUERA de TAREA 5** · se asume.

---

## 4 · Tabla maestra · component-to-data

### Notación

| Símbolo | Significado |
|---|---|
| ✅ EXISTE | Lectura directa de un store con datos · listo |
| 🔧 DERIVADO | Existe el origen · cálculo según §3 |
| 🆕 STORE NUEVO | Lee `objetivos` · `fondos_ahorro` · `retos` · `escenarios` · estos stores existen pero pueden estar vacíos · UI debe manejar empty-state |
| 📊 CONFIG | Viene de `escenarios` · 1 registro singleton |
| ⚠ DEUDA | Lectura posible pero datos incompletos en producción · documentar empty-state |

### Tabla L01 · L35

| ID | Componente | Texto en mockup | Tipo | Origen real |
|---|---|---|---|---|
| **L01** | Page head sub | "datos al cierre de **abril 2026**" | 🔧 | `formatMonth(new Date())` · texto en español "abril" |
| **L02** | Page head sub | "revisado **hoy**" | 🔧 | `formatRelative(now)` · "hoy" / "hace 2 días" |
| **L03** | Banda alerta | "**17.600 €**" | 🔧 | fórmula 3.7 · `getSinProposito()` · si `fondos_ahorro` vacío → `tesoreriaTotal` |
| **L04** | Banda alerta | "**49%** del total" | 🔧 | `(sinProposito / tesoreriaTotal) * 100` |
| **L05** | Hero título | "septiembre de **2040**" | 🔧 | fórmula 3.5 · `getAñoLibertadEstimado()` · formato "<mes> de <año>" |
| **L06** | Hero sub | "faltan **14 años y 5 meses**" | 🔧 | `formatDistance(añoLibertad - now)` |
| **L07** | Hero sub | "cubre **49%**" | 🔧 | fórmula 3.3 · `getTasaLibertad()` |
| **L08** | Hero sub | "gap de **1.793 €/mes**" | 🔧 | fórmula 3.4 · `getGapMensual()` |
| **L09** | Hero stat 1 valor | "2040" | 🔧 | mismo que L05 (solo año) |
| **L10** | Hero stat 1 sub | "en 14 años · **plan híbrido**" | 📊 | `escenarios[0].estrategia` · default 'hibrido' |
| **L11** | Hero stat 2 valor | "49%" | 🔧 | mismo que L07 |
| **L12** | Hero stat 3 valor | "1.707 €" | 🔧 | fórmula 3.1 · `calcularRentaPasivaNetaOperativa()` |
| **L13** | Hero stat 4 valor | "-1.793 €" | 🔧 | mismo que L08 (negativo) |
| **L14** | Card Proyección valor | "+31.214 €" | 🔧 ⚠ | fórmula 3.8 · `getResultadoCajaAño(añoActual)` · ⚠ snapshot solo tiene financing predicted · vacío de rentas |
| **L15** | Card Proyección sub | "**10** meses positivos" | 🔧 ⚠ | `count(meses con resultado > 0)` |
| **L16** | Card Proyección sub | "**1** mes en pérdida (**NOV**)" | 🔧 ⚠ | `meses con resultado < 0 · ordenar y formatear` |
| **L17** | Card Proyección footer | "+1.703 € · ABR" | 🔧 ⚠ | fórmula 3.8 mes actual |
| **L18** | Card Libertad valor | "49%" | 🔧 | mismo que L07 |
| **L19** | Card Libertad sub | "serás libre **sep 2040**" | 🔧 | mismo que L05 (formato corto) |
| **L20** | Card Libertad pill | "2040 · en 14 años" | 🔧 | combinación |
| **L21** | Card Objetivos valor | "**4**" | 🆕 | `count(objetivos[estado != 'archivado'])` · vacío hoy → "0" + empty-state |
| **L22** | Card Objetivos sub | "**2 en riesgo**" | 🆕 | `count(objetivos[estado == 'en-riesgo'])` |
| **L23** | Card Objetivos sub | "1 en pausa · 1 en progreso" | 🆕 | counts agregados |
| **L24** | Card Objetivos sub | "próxima fecha **30 jun**" | 🆕 | `min(objetivos.fechaCierre WHERE estado IN ('en-progreso','en-riesgo'))` |
| **L25** | Card Objetivos foot | "colchón · piso" | 🆕 | `objetivos[en-riesgo].nombre.join(' · ')` truncar a 2 |
| **L26** | Card Fondos valor | "**36.000 €**" | 🔧 | fórmula 3.6 · `getTesoreriaTotal()` |
| **L27** | Card Fondos sub | "**4 fondos** activos" | 🆕 | `count(fondos_ahorro[activo == true])` |
| **L28** | Card Fondos sub | "colchón · piso · reforma · impuestos" | 🆕 | `fondos_ahorro[activo].nombre.join(' · ')` truncar a 4 |
| **L29** | Card Fondos foot | "**17.600 €** · 49%" | 🔧 | mismo que L03 + L04 |
| **L30** | Card Retos valor | "**40%**" | 🆕 | `(retos.activo.aportadoActual / retos.activo.metaCantidad) * 100` |
| **L31** | Card Retos sub | "**Primer paso colchón**" | 🆕 | `retos.activo.titulo` |
| **L32** | Card Retos sub | "ahorrado **1.650 €** de **4.120 €**" | 🆕 | `aportadoActual` y `metaCantidad` · solo si tipo 'ahorro' o 'ejecucion' |
| **L33** | Card Retos sub | "quedan **12 días**" | 🔧 | `daysUntil(endOfMonth(retos.activo.mes))` |
| **L34** | Card Retos barra | width 40% | 🆕 | mismo que L30 |
| **L35** | Card Retos foot | "**206 €/día**" | 🔧 | `(metaCantidad - aportadoActual) / diasRestantes` |

---

## 5 · Manejo de empty-states · CRÍTICO para producción real

El snapshot real demuestra que en el primer arranque del usuario **muchos stores estarán vacíos**. El landing tiene que manejar grácilmente:

### 5.1 · Si `escenarios` está vacío
- L05 · L09 · L19 · L20 → mostrar "Sin estimación · configura tu escenario" + CTA
- L08 · L13 → "—"
- L10 → "configura tu plan"

### 5.2 · Si `objetivos` está vacío
- L21 → "0"
- L22-L25 → empty-state "Crea tu primer objetivo" + CTA a tab Objetivos
- Card sigue siendo clickable

### 5.3 · Si `fondos_ahorro` está vacío
- L26 sigue mostrando tesorería (no depende de fondos)
- L27 → "Sin fondos creados"
- L28 → empty-state
- L29 → "todo sin propósito · 100%"

### 5.4 · Si `retos` está vacío
- L30 · L34 → 0% · barra vacía
- L31 → "Sin reto activo este mes"
- L32-L33 · L35 → "—"
- CTA grande "Crear reto del mes"

### 5.5 · Si `treasuryEvents` está vacío o incompleto
- L14-L17 → "—" + texto "datos insuficientes para proyectar"
- Card Proyección clickable lleva a tab que explica cómo se generan los events

### 5.6 · Si `accounts.balance = 0` universalmente (caso snapshot Jose)
- Fallback · usar `openingBalance + sum(movements desde openingBalanceDate)`
- Si tampoco hay movements · usar `openingBalance` como aproximación · marcar el dato como "estimado"

---

## 6 · Hallazgos del snapshot que BLOQUEAN o LIMITAN el landing

### 6.1 · `accounts.balance = 0` en todas

Las 8 cuentas reportan balance 0 · solo `openingBalance`. Esto significa que el tracking de saldo en vivo no está implementado o no se está actualizando.

**Implicación landing** · L26 (Tesorería 36.000 €) saldrá 0 hoy · independiente de cuántos fondos tenga. Bug crítico.

**No es responsabilidad de TAREA 5 · documentar y derivar a backlog** · "fix: account.balance debe actualizarse al añadir movements".

### 6.2 · `treasuryEvents` solo cuotas préstamo predicted

13 events · todos `type: 'financing'` · `status: 'predicted'`. NO hay rentas (income) · NO hay opex (expense) · NO hay status confirmed.

**Implicación landing** · L14-L17 saldrán negativos siempre (solo costes · sin ingresos). La card Proyección será inservible hasta que el motor de eventos genere income y expense.

**No es responsabilidad de TAREA 5** · derivar · "feat: motor de generación treasury events para income (rentas) y expense (opex) anuales".

### 6.3 · `compromisosRecurrentes` vacío

Tras la unificación G-01 · este store debería contener IBI · comunidad · seguros · suministros como plantillas recurrentes. Tiene 0.

**Implicación landing** · ninguna directa (el landing no lo lee). Pero indirecta · sin compromisos · el cálculo de opex futuro (parte de L12) tiene que **derivar de gastosInmueble histórico** lo que añade ruido.

**No es responsabilidad de TAREA 5** · derivar · "feat: generar compromisosRecurrentes desde gastosInmueble histórico al primer arranque del usuario".

### 6.4 · Préstamos liquidados marcados como `vivo`

Drift de datos · cuando un préstamo se cancela · `estado` debería pasar a `'liquidado'` y `principalVivo` a 0. En el snapshot todos están `'vivo'`.

**Implicación landing** · ninguna directa (el landing no muestra préstamos). Indirecta · el cálculo de `principalViveTotal` para Patrimonio o Mi Plan trayectoria saldrá inflado.

**No es responsabilidad de TAREA 5** · derivar · "feat: detección/marcado de préstamos liquidados · sea manual o automático cuando cuotasPagadas == plazoMesesTotal".

---

## 7 · Resumen ejecutivo

### Estado del landing tras TAREA 4

| Bloque | Sin escenario configurado | Con escenario completo (post UI Mi Plan) |
|---|---|---|
| Page head | Funciona | Funciona |
| Banda alerta | Necesita fondos para calcular % asignado | Funciona si `accounts.balance` está correcto |
| Hero libertad | Empty-state "configura tu plan" | Funciona |
| 5 cards grid | 4 funcionan parcialmente · 1 (Proyección) bloqueada por treasuryEvents vacío | Funciona |

### Prerequisitos antes de implementar el landing

**Mínimos para que el landing arranque sin errores** · ya cumplidos por TAREA 2 + 4 + corrección:
- ✅ 4 stores nuevos creados
- ✅ Migraciones limpias
- ✅ Schemas estables

**Mínimos para que el landing muestre datos reales:**
- ⏳ UI de creación/edición de `escenarios` (tab Libertad financiera + onboarding)
- ⏳ UI de CRUD de `objetivos` · `fondos_ahorro` · `retos` (sus 3 tabs)
- ⏳ Fix `account.balance` actualizándose con movements
- ⏳ Motor de generación `treasuryEvents` income/expense

**Mínimos para que el landing sea CORRECTO:**
- ⏳ Marcado correcto de préstamos liquidados
- ⏳ `compromisosRecurrentes` poblado desde gastosInmueble o por usuario

### Qué puede entregar TAREA 5 (mapeo) ahora mismo

✅ Este documento (mapeo del landing) está LISTO para CC. CC puede empezar a implementar el landing real **con empty-states activos** y conectar las fórmulas según §3.

⚠ Las 4 cards "Proyección · Libertad · Fondos · Tesorería" funcionarán al ~50% hasta que se cierren las 4 prerequisitos de "datos reales".

❌ NO se entrega motor de proyección · NO se entrega UI de tabs · NO se entrega fix de balance.

---

## 8 · Próximo paso · seguir mapeo de las 5 tabs Mi Plan

Este es 1/6 documentos. Quedan:
- `MAPEO-DATOS-mi-plan-proyeccion.md` (waterfall · gantt · plurianual)
- `MAPEO-DATOS-mi-plan-libertad.md` (KPIs estrella · trayectoria · simulador)
- `MAPEO-DATOS-mi-plan-objetivos.md` (4 cards · ruta sí/no)
- `MAPEO-DATOS-mi-plan-fondos.md` (distribución · cards · movimientos)
- `MAPEO-DATOS-mi-plan-retos.md` (hero reto · KPIs · timeline · sugerencias)

Tras los 6 · vienen los demás módulos del producto (12-15 mockups en total).

---

**Fin del mapeo Landing · próxima acción · Proyección o seguir con otro módulo.**
