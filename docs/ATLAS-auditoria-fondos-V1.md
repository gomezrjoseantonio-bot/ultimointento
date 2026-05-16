# ATLAS · Auditoría · fondos de inversión · V1

> **Modo** · solo lectura · 0 archivos modificados · 0 commits.
>
> **Origen** · TAREA CC AUDITORÍA · prerrequisito de TAREA 13-bis (módulo fondos de inversión + traspasos art. 94 LIRPF).
>
> **Rama auditada** · `claude/audit-investment-funds-FfaRr` (idéntica a `main` post-V71).
>
> **DB_VERSION en repo** · 71 (`src/services/db.ts:28`).
>
> **DB_VERSION productiva de Jose** · v70 declarada en spec. La capa de fondos no cambia entre V65 y V71 (`inversiones` con sus 3 índices vive desde V1.3 y no se ha tocado en V60-V71). La auditoría es válida sin acceso a la DB productiva.
>
> **Datos productivos de Jose** · NO accesibles en este entorno aislado. Conteos por store · `N/A`. La auditoría inspecciona shape · escritores · lectores · pero NO cardinalidad real.
>
> **Continuidad con auditoría anterior** · este informe se apoya en `docs/ATLAS-auditoria-pensiones-fondos-V1.md` y la cierra solo en la parte de fondos (D5 + F1 + F2 + Z3 del anterior).

---

## 0 · Resumen ejecutivo

1. **Modelo plano** · los fondos viven en `inversiones[tipo='fondo_inversion']` (1 de 11 tipos de `TipoPosicion` · `src/types/inversiones.ts:14`). NO hay store dedicado, NO hay entidad estable a través de gestoras.
2. **Aportaciones embebidas** · `PosicionInversion.aportaciones: Aportacion[]` está embebido en el registro (`src/types/inversiones.ts:72`). NO hay store separado `aportacionesFondo`. Cada `Aportacion` discrimina entre `'aportacion' | 'reembolso' | 'dividendo'` · solo `'aportacion'` y `'reembolso'` son semánticamente válidos para fondos.
3. **Régimen art. 94 LIRPF (diferimiento entre fondos) NO modelado** · cada `reembolso` dispara `calcularGananciaPerdidaFIFO` sin distinguir si es rescate (realización fiscal) o traspaso (neutro). `inversionesFiscalService.calcularGananciaPerdidaFIFO` (`src/services/inversionesFiscalService.ts:33`) asume siempre realización.
4. **XML AEAT crea posiciones cerradas por transmisión declarada** · `declaracionDistributorService.persistirInversionesDeclaradas` (`declaracionDistributorService.ts:1043-1078`) crea una `PosicionInversion` cerrada (`activo:false`) por cada fondo en `gananciasPerdidas.fondos`. El único identificador disponible en el XML es `nifFondo` · que viene del campo `G2A_NIF` o `NIFFIN` (`irpfXmlParserService.ts:634`) · que es **NIF de la gestora · NO ISIN del fondo**. Crítico para D5 (backfill).
5. **`valoraciones_historicas` no diferencia fondos** · `tipo_activo` solo admite `'inmueble' | 'inversion' | 'plan_pensiones'` (`src/types/valoraciones.ts:6`). Los fondos comparten bucket `'inversion'` con acciones · ETFs · cripto · etc. Hoy NADIE escribe valoraciones de fondos en este store · el `valor_actual` vive plano en el registro `inversiones`.
6. **Lectores UI limpios** · `InversionesGaleria` (`/inversiones`) + `FichaPosicionPage` → `FichaValoracionSimple` (los fondos caen en el grupo `valoracion_simple` · `src/modules/inversiones/helpers.ts:287`). La UI legacy `/gestion/inversiones` fue eliminada con redirect en T13 v4 (`src/App.tsx:1215`). La ruta horizon `InversionesPage.tsx` está exportada pero NO routeada · zombie.
7. **Acciones requeridas que T13-bis debe cerrar** · 6 decisiones arquitectónicas (D1-D6 §8). La principal · D1 (entidad estable de fondo) vs mantener modelo plano + traspasos como evento sobre `PosicionInversion`.

---

## 1 · Modelado actual de fondos (§ requisito 1)

### 1.1 · Shape `PosicionInversion` para `tipo='fondo_inversion'`

Definición canónica · `src/types/inversiones.ts:59-109`. Campos efectivamente usados por fondos hoy:

| Campo | Tipo | Uso en fondos | Origen |
|---|---|---|---|
| `id` | `number` | autoIncrement | `db.ts:2827` |
| `nombre` | `string` | Texto libre · UI: ej. "Indexa Cartera 10" · XML: `"Fondo {nifGestora} ({año})"` | UI form / XML |
| `tipo` | `'fondo_inversion'` | Discriminador | hard-coded |
| `entidad` | `string` | UI: gestora (texto libre) · XML: `nifFondo` o `'AEAT'` | UI / XML |
| `isin` | `string?` | UI: ISIN opcional. **XML mete aquí el NIF gestora · NO ISIN real** | `decl…:1066` |
| `valor_actual` | `number` | Saldo actual · XML cerradas: `valorTransmision` | UI / XML |
| `fecha_valoracion` | `string` ISO | XML: `today` · UI: hoy o fecha form | UI / XML |
| `aportaciones` | `Aportacion[]` | Embebido · ver §1.2 | UI |
| `total_aportado` | `number` | Calculado · `sum(aportacion) - sum(reembolso)` · XML: `valorAdquisicion` | service / XML |
| `rentabilidad_euros` | `number` | `valor_actual - total_aportado` | service |
| `rentabilidad_porcentaje` | `number` | derivada | service |
| `fecha_compra` | `string?` | Opcional · capturado en `PosicionFormV5` (validado required en alta `PosicionFormV5.tsx:251`) | UI |
| `cuenta_cargo_id` | `number?` | Cuenta de cargo · obligatorio en alta UI | UI |
| `cuenta_cobro_id` | `number?` | Cuenta destino de rescates · obligatorio en alta UI | UI |
| `notas` | `string?` | Texto · XML: `"Transmisión declarada IRPF {año}. Retención: {ret} €"` | UI / XML |
| `activo` | `boolean` | `true` UI alta · `false` XML (todas cerradas) | UI / XML |
| `created_at` · `updated_at` | `string` | timestamps | service |

**Campos NO usados en fondos** (definidos en `PosicionInversion` pero solo aplican a otros tipos) ·

- `ticker`, `numero_participaciones`, `precio_medio_compra` → acciones / ETF / REIT / crypto.
- `duracion_meses`, `modalidad_devolucion`, `frecuencia_cobro`, `liquidacion_intereses`, `rendimiento`, `dividendo_anual_estimado` → préstamos / depósitos / cuenta remunerada / acciones.
- `retencion_fiscal` → préstamos / depósitos.
- `plan_aportaciones` (Bloque ①), `plan_liquidacion` (Bloque ③) → sin uso real en fondos hoy.

### 1.2 · Shape `Aportacion` embebido

Definición · `src/types/inversiones.ts:22-35` ·

```typescript
interface Aportacion {
  id: number;
  fecha: string;
  importe: number;
  tipo: 'aportacion' | 'reembolso' | 'dividendo';
  notas?: string;
  cuenta_cargo_id?: number;
  unidades?: number;
  unidades_vendidas?: number;
  precioUnitario?: number;
  coste_adquisicion_fifo?: number;   // solo en reembolsos
  ganancia_perdida?: number;          // solo en reembolsos
  fuente?: string;                    // 'manual' | 'xml' | 'excel' | 'indexa' | …
}
```

**Tipos efectivos para fondos** · `'aportacion'` (compra) · `'reembolso'` (venta/rescate). El tipo `'dividendo'` no aplica a fondos (es para acciones/ETF/REIT · `RegistrarCobroDialog` solo se invoca desde `FichaDividendos` que cubre el grupo `'dividendos'` y NO incluye fondos · `helpers.ts:285`).

### 1.3 · Ejemplo de registro fondo creado por XML AEAT (`activo:false`)

Generado en `declaracionDistributorService.ts:1054-1077` · ejemplo sintetizado a partir del código (NO leído de DB real) ·

```typescript
{
  id: <autoIncrement>,
  nombre: `Fondo B83002767 (2022)`,
  tipo: 'fondo_inversion',
  entidad: 'B83002767',          // NIF gestora · NO nombre legible
  isin: 'B83002767',             // ⚠ es el NIF gestora · NO ISIN
  valor_actual: 12500.00,         // = valorTransmision
  fecha_valoracion: '2026-05-16', // hoy de importación
  aportaciones: [],               // ⚠ FIFO no se reconstruye desde XML
  total_aportado: 10000.00,       // = valorAdquisicion
  rentabilidad_euros: 2500.00,    // = ganancia
  rentabilidad_porcentaje: 25.00,
  notas: 'Transmisión declarada IRPF 2022. Retención: 525 €',
  activo: false,                  // cerrada
  created_at: '…',
  updated_at: '…',
}
```

**Observaciones clave** ·

- `nombre` está **derivado del NIF gestora + año** · NO del nombre real del fondo · NO del ISIN. Dos transmisiones del mismo fondo en años distintos crean 2 posiciones con nombres distintos. Dos transmisiones del mismo fondo en el mismo año tampoco se agregan (dedup por nombre exacto en `declaracionDistributorService.ts:1051,1056` · el XML AEAT puede repetir filas si hay rescates parciales).
- `entidad === isin === nifFondo` por error de mapeo · `isin` es campo opcional documentado como "Para fondos/ETFs" (`inversiones.ts:64`) pero el importador mete ahí el NIF gestora.
- `aportaciones: []` · NO se reconstruye historial · no hay FIFO recalculable a partir del XML. La ganancia/pérdida ya viene calculada por la AEAT.

---

## 2 · Escritores actuales de fondos (§ requisito 2)

Todos los `add('inversiones', …)` / `put('inversiones', …)` del repo · `src/services/db.ts:2826-2831` define el store.

### 2.1 · Tabla maestra de escritores

| Escritor | Archivo · línea | Crea fondos | Tipo de operación | Estado |
|---|---|---|---|---|
| `declaracionDistributorService.persistirInversionesDeclaradas` | `declaracionDistributorService.ts:1043-1105` | **SÍ** · `tipo:'fondo_inversion'` (l. 1064) | Crea `PosicionInversion` cerrada (`activo:false`) por cada `OperacionFondo` en `gananciasPerdidas.fondos` | Vivo · canónico desde T11 |
| `inversionesService.createPosicion` | `inversionesService.ts:82-127` | **SÍ** (cualquier `TipoPosicion`) · llamado por wizard UI con `tipoUI='fondo_inversion'` | Crea posición activa · genera aportación inicial automática (l. 87-94) | Vivo · canónico vía UI |
| `inversionesService.updatePosicion` | `inversionesService.ts:130-142` | **SÍ** (UPDATE) | Edita campos · recalcula derivados vía `normalizePosicion` | Vivo |
| `inversionesService.addAportacion` | `inversionesService.ts:145-179` | **SÍ** (añade aportación o reembolso) | Si `tipo:'reembolso'` invoca FIFO (l. 156) · si reembolso total descuenta `numero_participaciones` (no aplica a fondos · solo acciones · l. 168) | Vivo |
| `inversionesService.updateAportacion` | `inversionesService.ts:181-205` | UPDATE aportación · recalcula FIFO si tipo='reembolso' | Vivo |
| `inversionesService.deleteAportacion` | `inversionesService.ts:207-214` | DELETE aportación · recalcula derivados | Vivo |
| `inversionesService.deletePosicion` | `inversionesService.ts:217-219` | Soft delete · `activo:false` | Vivo |
| `inversionesService.purgarPosicion` | `inversionesService.ts:222-254` | Hard delete + cascade (treasuryEvents · valoraciones_historicas) | **0 consumidores en producción** · zombie de service |
| `inversionesAportacionesImportService.importarAportacionesHistoricasMasivas` | `inversionesAportacionesImportService.ts:419-523` | NO crea posiciones · solo añade aportaciones a fondos existentes vía `inversionesService.addAportacion` (l. 492) | Vivo |
| `inversionesAportacionesImportService.importarFilasCorregidas` | `inversionesAportacionesImportService.ts:585-663` | Idem · solo aportaciones · `inversionesService.addAportacion` (l. 594) | Vivo |
| `valoracionesService.guardarValoracionesMensuales` | `valoracionesService.ts:486-496` | UPDATE `valor_actual` cuando se carga una valoración mensual con `tipo_activo:'inversion'` | Vivo · puede tocar fondos indirectamente |
| `rendimientosService.generarPago` (`updatePosicion` indirecto) | `rendimientosService.ts:117` (vía `inversionesService.updatePosicion`) | UPDATE para pagos recurrentes · **NO aplica a fondos** (solo cuenta_remunerada · prestamo · deposito) | Vivo · no toca fondos |
| `indexaCapitalImportService.importarIndexaCapital` (rama `inversiones`) | `indexaCapitalImportService.ts:405-446` | UPDATE de una posición `tipo:'plan_pensiones'/'plan-pensiones'` legacy en `inversiones` · **NO crea ni toca fondos** | Vivo · solo planes legacy |
| `migrateInversionesToNewModel` | `migrations/migrateInversiones.ts:12-42` | One-shot · backfilla `rentabilidad_euros` / `rentabilidad_porcentaje` en posiciones viejas · idempotente | Vivo · se ejecuta al cargar `/inversiones` |

### 2.2 · Persistir fondos · función completa (§ requisito 2 · ítem 1)

`declaracionDistributorService.persistirInversionesDeclaradas` · `src/services/declaracionDistributorService.ts:1038-1105` ·

```typescript
async function persistirInversionesDeclaradas(db, decl, año) {
  const gp = decl.gananciasPerdidas;
  if (!gp) return;

  const ahora = new Date().toISOString();
  const hoy = ahora.slice(0, 10);

  const existentes = await db.getAll('inversiones');
  const nombresExistentes = new Set(existentes.map(i => i.nombre));

  // Fondos
  for (const fondo of gp.fondos ?? []) {
    const nombre = `Fondo ${fondo.nifFondo || 'desconocido'} (${año})`;
    if (nombresExistentes.has(nombre)) continue;          // dedup por nombre

    const totalAportado = fondo.valorAdquisicion ?? 0;
    const valorActual = fondo.valorTransmision ?? 0;
    const ganancia = fondo.ganancia ?? 0;

    await db.add('inversiones', {
      nombre,
      tipo: 'fondo_inversion',
      entidad: fondo.nifFondo || 'AEAT',
      isin: fondo.nifFondo || undefined,                   // ⚠ NIF gestora · no ISIN
      valor_actual: valorActual,
      fecha_valoracion: hoy,
      aportaciones: [],
      total_aportado: totalAportado,
      rentabilidad_euros: ganancia,
      rentabilidad_porcentaje: totalAportado > 0
        ? Math.round((ganancia / totalAportado) * 10000) / 100
        : 0,
      notas: `Transmisión declarada IRPF ${año}. Retención: ${fondo.retencion ?? 0} €`,
      activo: false,
      created_at: ahora,
      updated_at: ahora,
    });
  }

  // … criptomonedas (mismo patrón)
}
```

**Crítico para T13-bis (D5 backfill)** ·

- Dedup `O(n)` por nombre completo. Si Jose re-importa el mismo año dos veces · no crea duplicados. Si importa 2020 y 2021 con el mismo fondo · sí crea 2 posiciones (esperado).
- `OperacionFondo.nifFondo` viene del XML como `G2A_NIF` o `NIFFIN` (`irpfXmlParserService.ts:634`) · es el **NIF de la gestora** · NO el ISIN del fondo. Por tanto · varios fondos distintos de la misma gestora declarados en el mismo año colisionan en la misma fila (la AEAT puede agregar por gestora) · NO se distinguen.

### 2.3 · UI manual de alta · `PosicionFormV5` (`tipoUI='fondo_inversion'`)

Form en `src/modules/inversiones/components/wizard/PosicionFormV5.tsx:322-330` · genera `Partial<PosicionInversion>` con · `nombre` · `entidad` · `importe_inicial` · `valor_actual` · `isin` (opcional) · `fecha_compra` · `cuenta_cargo_id` · `cuenta_cobro_id`. Validaciones · `PosicionFormV5.tsx:248-253`. Se delega a `inversionesService.createPosicion` vía `WizardNuevaPosicion → InversionesGaleria` (`InversionesGaleria.tsx:123`). La aportación inicial se genera automáticamente en `inversionesService.createPosicion:87-95`.

### 2.4 · Importador Excel de aportaciones · `inversionesAportacionesImportService`

`src/services/inversionesAportacionesImportService.ts` · NO crea fondos · solo añade `Aportacion` (tipo `'aportacion'`) a fondos preexistentes que coincidan por `posicion_id` exacto o por `posicion_nombre + entidad` (`mapRowsToAportaciones:200-291` · `findPosicionOrPlan:299-346`). Plantilla descargable en `descargarPlantillaImportacionAportaciones:665-688`.

Comportamiento para fondos · ·

- Si la fila NO es un plan de pensiones (detectado por tipo · `inversionesAportacionesImportService.ts:229-240`) · se trata como aportación a posición de inversiones (incluido fondo). Solo soporta tipo `'aportacion'` (l. 289) · NO `'reembolso'` ni `'dividendo'`. **Limitación** · un fondo importado vía Excel solo recibe compras · los rescates hay que registrarlos manualmente desde la UI.
- NO crea posiciones nuevas · si no encuentra match dispara error en preview (`previsualizarImportacionAportaciones:369-388`).

---

## 3 · Lectores actuales de fondos (§ requisito 3)

| Lector | Archivo · línea | Qué muestra de fondos | Estado |
|---|---|---|---|
| `InversionesGaleria` | `src/modules/inversiones/InversionesGaleria.tsx:40` (ruta `/inversiones`) | Galería unificada · carta heterogénea por fondo (vía `getAllCartaItems` · `galeriaAdapter.ts:44`). Fondos caen como `inversionToCartaItem` (`types/cartaItem.ts:137`). | **Vivo · canónico** |
| `CintaResumenInversiones` | `src/modules/inversiones/components/CintaResumenInversiones.tsx:6` | Resumen agregado de cartera · incluye fondos vía `getAllCartaItems` | Vivo |
| `FichaPosicionPage` → `FichaValoracionSimple` | `pages/FichaPosicionPage.tsx:35` (ruta `/inversiones/:posicionId` con id numérico) → `components/FichaValoracionSimple.tsx:45` (los fondos caen en grupo `valoracion_simple` · `helpers.ts:287-291`) | Hero + sparkline + 4 KPIs + tabla aportaciones (con `tipo` chip) + botones acción | Vivo · canónico |
| `posicionesCerradas.getPosicionesCerradas` | `src/modules/inversiones/adapters/posicionesCerradas.ts:208-300` | Lee desde 3 fuentes · ① XML AEAT (`gananciasPerdidas.fondos` · `mapearFondo` l. 115-135) · ② store `inversiones[activo:false]` (l. 237-256) · ③ planes cerrados (l. 261-296). Devuelve `PosicionCerrada` con narrativa de inversor (aportado/vendido/resultado/cagr/duracionDias) | Vivo |
| `PosicionesCerradasPage` | `src/modules/inversiones/pages/PosicionesCerradasPage.tsx` (ruta `/inversiones/cerradas`) | Lista de posiciones cerradas + KPIs agregados · consume `posicionesCerradas.ts` | Vivo |
| `galeriaAdapter.getAllCartaItems` | `src/modules/inversiones/adapters/galeriaAdapter.ts:44-81` | Unifica `inversiones` (activas + no-plan) + `planesPensiones` (activos) · dedup planes · ordena por `valor_actual` desc | Vivo · canónico |
| `inversionesService.getResumenCartera` | `inversionesService.ts:257-296` | Agregado total + por tipo · incluye fondos | Vivo |
| `inversionesFiscalService.calcularGananciasPerdidasEjercicio` | `inversionesFiscalService.ts:79-118` | Recorre `inversiones[activo]` y suma reembolsos del ejercicio (incluye fondos) · ver §4 | Vivo · usado por compensación ahorro |
| `ImportarValoraciones` (UI inmuebles) | `src/modules/inmuebles/import/ImportarValoraciones.tsx:110` | Pantalla para subir valoraciones · soporta `tipo_activo='inversion'` (incluye fondos) | Vivo |
| `valoracionesService.importarHistorico` | `valoracionesService.ts:530-580` | Asocia valoración por nombre vía `matchPlanByNombre` (l. 555) · si match en `inversiones` con tipo plan_pensiones → store inversiones · si no → planesPensiones · **fondos**: NO se asocian explícitamente · caerían en el bucket genérico vía `r.tipo_activo==='inversion'` | Vivo · parcial |
| `InversionesPage` (horizon legacy) | `src/modules/horizon/inversiones/InversionesPage.tsx:28` | Lista tabs Resumen/Cartera/Rendimientos/Individual · **NO routeada** (exportada en `index.ts:4` pero no importada por `App.tsx`) | **Zombie** |
| `TabCartera` etc. (horizon) | `src/modules/horizon/inversiones/components/tabs/*` | Sub-tabs de `InversionesPage` zombie | Zombie (transitivo) |

**Resumen** · ruta canónica `/inversiones` → galería + ficha → ambos vivos · ruta legacy `/gestion/inversiones` ya eliminada con redirect en T13 v4 (`src/App.tsx:1215`). Resta UI horizon (`modules/horizon/inversiones/*`) sin routear · candidato a borrado en backlog limpieza.

---

## 4 · `inversionesFiscalService.calcularGananciaPerdidaFIFO` (§ requisito 4)

### 4.1 · Firma y comportamiento

`src/services/inversionesFiscalService.ts:33-77` ·

```typescript
export function calcularGananciaPerdidaFIFO(
  posicion: PosicionInversion,
  reembolso: Aportacion,
): { costeAdquisicion: number; gananciaOPerdida: number }
```

Algoritmo ·

1. Ordena `posicion.aportaciones` filtradas a `tipo==='aportacion'` por fecha ascendente (l. 37-39).
2. Si `reembolso.unidades_vendidas > 0` (acciones/ETF/cripto) → recorre aportaciones consumiendo unidades (FIFO por unidades · l. 44-59). Fallback a coste medio si quedan unidades sin cubrir (l. 56-59).
3. Si NO hay `unidades_vendidas` (fondos típicos · venta en importe) → recorre aportaciones consumiendo importe euro a euro (FIFO por importe · l. 60-72). Si el reembolso excede el total aportado · imputa el resto como coste directo (l. 69-71 · esto puede subestimar la plusvalía cuando hay revalorización).
4. Devuelve `{ costeAdquisicion, gananciaOPerdida: importe_reembolso - costeAdquisicion }`.

### 4.2 · Invocadores

| Invocador | Archivo · línea | Cuándo se llama |
|---|---|---|
| `inversionesService.addAportacion` | `inversionesService.ts:156` | Al añadir aportación con `tipo:'reembolso'` |
| `inversionesService.updateAportacion` | `inversionesService.ts:191` | Al editar aportación que pasa a `tipo:'reembolso'` o ya lo era |
| `inversionesFiscalService.calcularGananciasPerdidasEjercicio` | `inversionesFiscalService.ts:96` | Loop anual sobre todas las posiciones activas para calcular plusvalías/minusvalías del ejercicio (consumido por `compensacionAhorroService.ejecutarCompensacionAhorro` · `compensacionAhorroService.ts:188`) |
| `AportacionForm` (horizon legacy) | `modules/horizon/inversiones/components/AportacionForm.tsx:54` | Preview en tiempo real (zombie · UI no routeada) |
| `AportacionFormDialog` (v5) | `modules/inversiones/components/AportacionFormDialog.tsx:62` | Preview en tiempo real en el dialog que dispara `inversionesService.addAportacion` |

### 4.3 · Casos cubiertos · rescate vs traspaso

**Confirmado** · NO distingue rescate (realización) de traspaso (neutro · art. 94 LIRPF). Cualquier aportación con `tipo:'reembolso'` dispara FIFO y materializa ganancia/pérdida fiscal. Implicaciones ·

- Si Jose traspasa fondo Indexa → MyInvestor · hoy hay 2 maneras de modelarlo en la UI · ① abrir ficha · pulsar Aportar/Reembolso por el importe traspasado · queda registrado como reembolso con ganancia (incorrecto fiscalmente) · ② marcar la posición como cerrada manualmente y dar de alta una nueva en MyInvestor (también incorrecto · no preserva identidad). NO hay un flujo correcto.
- `calcularGananciasPerdidasEjercicio` (`inversionesFiscalService.ts:79-118`) suma todas estas "ventas" al ejercicio · si Jose marcó traspasos como reembolsos · aparecen como plusvalías/minusvalías que se compensan en el saldo neto del ahorro (`compensacionAhorroService.ejecutarCompensacionAhorro`). Falso fiscalmente.
- Rescate parcial vs total · NO se distingue · ambos son `tipo:'reembolso'` · el "total" solo se infiere si el importe agotó todo lo aportado (sin marca explícita).

**Conclusión § 4** · la firma actual está bien para rescates puros · es insuficiente para traspasos (faltaría flag `esTraspaso: boolean` o tipo `'traspaso_salida'` separado · y entidad destino para emparejar la entrada).

---

## 5 · `valoraciones_historicas` para fondos (§ requisito 5)

### 5.1 · `tipo_activo` admitido

`src/types/valoraciones.ts:6,32` · `src/services/valoracionesService.ts:8`:

```typescript
tipo_activo: 'inmueble' | 'inversion' | 'plan_pensiones'
```

Solo 3 valores · **NO existe `'fondo_inversion'` ni `'fondo'`**. Los fondos comparten el bucket `'inversion'` con acciones · ETFs · REIT · crypto · préstamos · depósitos · etc.

### 5.2 · Escritores actuales · ¿alguno toca fondos?

| Escritor | Archivo · línea | tipo_activo escrito | ¿Toca fondos? |
|---|---|---|---|
| `valoracionesService.guardarValoracionActivo` | `valoracionesService.ts:393-410` | Cualquiera de los 3 · pasado por parámetro | Si llaman con `'inversion'` y `activo_id` apuntando a un fondo · sí (no hay nada que lo distinga de otra inversión) |
| `valoracionesService.guardarValoracionesMensuales` | `valoracionesService.ts:399-510` | Cualquiera · si `tipo_activo === 'inversion'` actualiza también `inversiones.valor_actual` (l. 486-495) | Sí indirectamente · NO hay UI que invoque con fondos hoy |
| `valoracionesService.importarHistorico` | `valoracionesService.ts:530-580` | Acepta fila `tipo_activo:'inversion'` y matchea por nombre contra `inversiones` (l. 574: `{ id: inv.id, store: 'inversiones' }`) | Sí · si Jose sube Excel con fila `tipo_activo:inversion, activo_nombre:"Indexa Cartera 10"` y existe un fondo así nombrado · se asocia. NO usado en flujos productivos hoy. |
| `traspasosPlanPensionesService.registrarTraspaso` | `traspasosPlanPensionesService.ts:103-124` | `'plan_pensiones'` | NO toca fondos |
| `indexaCapitalImportService.importarIndexaCapital` | `indexaCapitalImportService.ts:347-358` | `'plan_pensiones'` (l. 349) | NO toca fondos · solo planes Indexa |
| `ActualizarValorPlanDialog` (vía service) | `modules/inversiones/components/ActualizarValorPlanDialog.tsx` | `'plan_pensiones'` | NO toca fondos |

**Conclusión § 5** · hoy **NADIE escribe valoraciones de fondos en `valoraciones_historicas`** en flujos productivos. La sparkline de fondos en `FichaValoracionSimple` se construye desde `posicion.aportaciones` + `valor_actual` actual · NO desde histórico. El histórico mensual de un fondo simplemente NO existe en el modelo.

### 5.3 · Implicaciones para T13-bis

Si T13-bis quiere mostrar evolución mensual de un fondo (como hace `FichaPlanPensiones` para planes) · necesita ① decidir si añade `'fondo'` (o `'fondo_inversion'`) como cuarto `tipo_activo` (D4) · ② cablear escritura desde algún sitio (UI manual · importador Excel · scrape gestora) · ③ actualizar el índice compuesto `tipo-activo` (V69 · `db.ts:2851`) y posiblemente `tipo-activo-fecha` (V60 · `db.ts:2854`). Bump de DB_VERSION obligatorio.

---

## 6 · Datos productivos Jose (§ requisito 6)

**N/A · entorno aislado.** Conteo de `inversiones[tipo='fondo_inversion'][activo=true|false]` no es verificable desde código. Para Jose, ejecutar en consola DevTools en la app productiva ·

```javascript
indexedDB.open('atlas-horizon-db').onsuccess = e => {
  const db = e.target.result;
  db.transaction('inversiones').objectStore('inversiones').getAll().onsuccess =
    ev => {
      const fondos = ev.target.result.filter(p => p.tipo === 'fondo_inversion');
      console.log('Activos:', fondos.filter(f => f.activo).length);
      console.log('Cerrados:', fondos.filter(f => !f.activo).length);
      console.table(fondos.map(f => ({
        id: f.id, nombre: f.nombre, entidad: f.entidad, isin: f.isin,
        activo: f.activo, valor: f.valor_actual, aportaciones: f.aportaciones?.length
      })));
    };
};
```

**Hipótesis basada en código** · si Jose ha importado XMLs AEAT 2020-2024 (5 años) y declaró transmisiones de fondos en alguno · habrá tantos registros con `activo:false` como combinaciones `(NIF gestora, año)` distintas. Si declaró el mismo fondo en 2 años · serán 2 registros separados. Si tiene fondos activos actuales · habrán llegado por UI manual (wizard `/inversiones`) · NO por XML AEAT (el XML solo trae transmisiones cerradas).

---

## 7 · Aportaciones embebidas vs store separado (§ requisito 7)

### 7.1 · Estado actual · embebido

`PosicionInversion.aportaciones: Aportacion[]` vive **embebido** en el registro de inversión (`src/types/inversiones.ts:72`). Cada operación recalcula derivadas y hace `db.put('inversiones', …)` con el array completo (`inversionesService.addAportacion:165-177`).

### 7.2 · Patrón de planes · store separado

Pensiones eligió store separado · `aportacionesPlan` (`db.ts:2799-2806`) con 5 índices · FK `planId: string` · documentado en `ATLAS-auditoria-pensiones-fondos-V1.md §2.2`.

### 7.3 · Razones técnicas del modelo embebido (actuales)

- **FIFO necesita el orden**. El cálculo `calcularGananciaPerdidaFIFO` solo lee aportaciones de UNA posición · no necesita índice cross-posición. Un array embebido es trivialmente ordenable en memoria.
- **Atomicidad gratis**. `db.put('inversiones', …)` con el array completo es una transacción IDB de un solo store. Migrar a store separado obliga a transacciones multi-store (`inversiones` + `aportacionesFondo`) con rollback manual si una falla.
- **Cardinalidad baja**. Un fondo típico tiene < 100 aportaciones a lo largo de su vida. No hay incentivo de rendimiento para sacar a store separado (la lectura de la posición ya carga todas las aportaciones en una operación).

### 7.4 · Implicaciones de migrar a store separado

| Aspecto | Embebido (actual) | Separado (`aportacionesFondo`) |
|---|---|---|
| Atomicidad escritura | Trivial · 1 op IDB | Requiere transacción multi-store |
| FIFO | `posicion.aportaciones` directo · O(n) sort en memoria | Query por FK + sort · 2 ops IDB |
| Idempotencia importadores | Hash sobre todo el array | Hash por aportación individual (más limpio) |
| Cascade delete | Automático (eliminar registro elimina aportaciones) | Manual · loop sobre store secundario |
| Origen / trazabilidad | Campo `fuente` en cada aportación · sin índice | Indexable por `origen` (igual que `aportacionesPlan`) |
| Cross-posición queries | Imposible sin escanear todo · `calcularGananciasPerdidasEjercicio` ya lo hace (`inversionesFiscalService.ts:89-110`) | Index `ejercicioFiscal` (igual que planes) · O(log n) |
| Migración desde modelo actual | N/A | Backfill leyendo todas las posiciones · mapear array · escribir store nuevo. One-shot migration en upgrade callback. |
| UUID vs autoIncrement | autoIncrement embebido (l. 23) | UUID externo (igual que `aportacionesPlan`) |

**Recomendación CC (no decisión)** · si T13-bis introduce traspasos entre fondos como evento de primera clase · el store separado tiene sentido (consistencia con pensiones · queries cross-posición por ejercicio fiscal). Si T13-bis solo añade flag `esTraspaso` al modelo plano · mantener embebido.

---

## 8 · Decisiones arquitectónicas pendientes (§ requisito 8)

CC enumera · NO cierra. Las decide Jose con Claude tras revisar este informe.

### D1 · Entidad estable de fondo · ¿store nuevo `fondosInversion` o ampliar `inversiones`?

- **Opción A** · `fondosInversion { id (UUID) · nombreFondo · isin · gestoraActual · politicaInversion · participeNif · estado · valorActual · fechaContratacion · … }` · `inversiones` queda solo para posiciones puntuales por gestora (ya no fondos). Espejo del patrón `planesPensiones`.
- **Opción B** · ampliar `PosicionInversion` con `fondoMaestroId: string?` opcional que apunta a un store ligero `fondosMaestros { id, isin, nombreOficial, gestoraActual }`. La posición sigue siendo por gestora · el `fondoMaestroId` agrupa.
- **Opción C** · mantener modelo plano · NO entidad estable · solo añadir flag `traspaso_origen_id` al reembolso para emparejar entrada/salida (modelo más simple · menos rico).
- **Trade-off** · A es coherente con pensiones pero duplica concepto · B preserva el modelo actual y añade un join · C es el cambio mínimo pero NO da identidad real al fondo (sigue habiendo N posiciones por fondo si pasa por N gestoras).

### D2 · `aportaciones` embebido vs store separado

Ver §7. Atado a D1 · si se elige A · tiene sentido sacar a `aportacionesFondo` para coherencia · si se elige B o C · embebido es suficiente.

### D3 · Store de traspasos · genérico vs específico

- **Opción A** · `traspasosFondos` espejo de `traspasosPlanPensiones` · keyPath autoIncrement · campos `{fondoOrigenId, fondoDestinoId, fechaEjecucion, importeTraspasado, valorTraspaso, esTotal}`.
- **Opción B** · `traspasos` genérico polimórfico · `{tipoActivo: 'plan_pensiones'|'fondo_inversion', activoOrigenId, activoDestinoId, …}`.
- **Trade-off** · A respeta dominio (pensiones y fondos tienen reglas fiscales distintas · art. 8.8 LRPFP vs art. 94 LIRPF) · B reutiliza queries. CC sugiere A (consistencia con la decisión que se tomó para planes en V65).

### D4 · `tipo_activo='fondo'` en `valoraciones_historicas`

- **Opción A** · añadir 4º valor `'fondo'` · separar fondos del bucket genérico `'inversion'`. Requiere bump DB · regenerar índices `tipo-activo` y `tipo-activo-fecha`. Backfill puede mover registros existentes de `'inversion'` a `'fondo'` filtrando por `inversiones.tipo === 'fondo_inversion'`.
- **Opción B** · mantener bucket `'inversion'` · diferenciar consumiendo el campo `tipo` del registro en `inversiones`. Sin bump DB · queries más complejas.
- **Trade-off** · A es limpio pero costoso · B es pragmático. Decisión depende de cuántos fondos prevé Jose hidratar con histórico mensual.

### D5 · Backfill de posiciones cerradas en `inversiones[activo:false]`

Realidad · cada XML AEAT crea 1 registro por `(nifFondo, año)`. Si Jose tiene `N` registros · NO se puede agrupar por ISIN (no existe · `isin` actual = NIF gestora). Solo se puede agrupar por NIF gestora.

- **Sub-decisión D5a · agrupación**
  - Por NIF gestora pura → todos los fondos de Indexa se unifican en una sola entidad (incorrecto · son fondos distintos).
  - Por NIF gestora + año → conserva separación pero NO ofrece identidad estable a través de años.
  - **No es posible agrupar por ISIN porque no hay ISIN.** Necesario · pedir a Jose que enriquezca cada posición cerrada con el nombre real del fondo + ISIN · manualmente o vía importador adicional.
- **Sub-decisión D5b · colisiones de ISIN tras fusiones de fondos**
  - Si Jose pega ISIN A en un fondo que tras fusión heredó ISIN B en 2023 · ¿se considera el mismo fondo o uno nuevo? Recomendación CC · mismo fondo · campo `isinesHistoricos: string[]` opcional. Spec T13-bis lo cierra.
- **Sub-decisión D5c · qué hacer con registros cerrados sin ISIN limpio**
  - Mantener como están (zombies fiscales sin identidad)? · marcar como `estado: 'desvinculado'`? · permitir vincular manualmente desde UI?
  - Recomendación CC · permitir vincular desde la futura ficha del fondo maestro.
- **Sub-decisión D5d · tasa de colisiones esperada en datos Jose 2020-2024**
  - NO verificable sin DB productiva. Cota superior · si Jose declaró fondos en cada uno de los 5 años · y todos los XML AEAT agregaron por gestora · tendrá `5 × G` registros donde `G` es número de gestoras distintas. Cota inferior · si solo declaró transmisiones en 1-2 años · `G` registros. CC recomienda · revisar conteo real con Jose ANTES de diseñar el backfill.

### D6 · `inversionesAportacionesImportService` · ¿modificar o dejar como está?

- Realidad · el servicio acepta filas tipo aportación pura (`'aportacion'`) · NO reembolsos · NO traspasos. Identifica destino por `posicion_id` o `posicion_nombre + entidad`.
- **Opción A** · modificar para que reconozca · ① columna `tipo` con valores `aportacion|reembolso|traspaso_entrada|traspaso_salida` · ② columna `traspaso_pair_id` para emparejar entrada y salida del mismo traspaso. Migración menor.
- **Opción B** · dejar como está · T13-bis introduce un importador nuevo solo para traspasos.
- **Trade-off** · A simplifica la onboarding del usuario · B mantiene la separación de responsabilidades. CC neutral.

---

## 9 · Incógnitas no resueltas (§ requisito 9)

Preguntas que la auditoría NO ha podido cerrar leyendo el código · requieren a Jose · ambigüedades que la spec T13-bis tiene que resolver explícitamente.

| # | Pregunta | Por qué importa | Propuesta de cierre |
|---|---|---|---|
| Q1 | ¿Cuántos fondos activos tiene Jose hoy? ¿Cuántos cerrados? ¿Cuántas gestoras distintas? | Dimensiona D5 (backfill) · si son 5 fondos · backfill manual · si son 50 · automático | Jose ejecuta script consola §6 y reporta |
| Q2 | ¿Los fondos activos tienen ISIN bueno (UI manual) o son XML legacy con `isin=NIF gestora`? | Determina si el backfill puede agrupar automáticamente o necesita UI de revinculación | Jose revisa muestra |
| Q3 | ¿Ha Jose hecho algún traspaso fondo → fondo en los últimos 5 años? ¿Cuántos? | Si 0 → T13-bis solo necesita modelar fondos · NO traspasos. Si N>0 → traspasos son requisito | Decisión funcional |
| Q4 | ¿Quiere histórico mensual de valoración por fondo (sparkline gigante real · no estimada)? | Determina D4 y la necesidad de bump DB + escritores nuevos (importador valoraciones · scrape) | Decisión funcional · puede ser MVP sin (`FichaValoracionSimple` ya muestra sparkline estimada desde aportaciones) |
| Q5 | ¿El régimen art. 94 LIRPF debe modelarse como "operación neutra" (no cierra posición · solo cambia gestora) o como "cierre + apertura" con flag de diferimiento? | Impacto en datos · impacto fiscal · impacto en UI (cómo se muestra en posiciones cerradas) | Recomendación CC · operación neutra · NO se cierra la posición · cambia `gestoraActual` y se registra entrada en store `traspasosFondos` |
| Q6 | ¿Está el alta UI actual (`PosicionFormV5` para fondos) suficiente como input? | Captura mínima · no ISIN obligatorio · no fondo maestro · faltaría `politicaInversion`, `participeConDiscapacidad`, etc. (campos análogos a `PlanFormV5`) | Decisión depende de D1 |
| Q7 | ¿`inversionesService.purgarPosicion` (hard delete) hay que cablearlo? Hoy 0 consumidores en producción. | Decidir si T13-bis aprovecha para limpiar posiciones cerradas duplicadas tras backfill (D5) | Decisión cosmética |
| Q8 | ¿Borrar el zombie `modules/horizon/inversiones/InversionesPage` y submódulos? | Higiene · NO bloquea T13-bis | Recomendación CC · borrar al final · backlog |
| Q9 | ¿Cómo se onboarding la posición histórica completa? ¿Se acepta que las posiciones cerradas vía XML (`activo:false`) tienen `aportaciones: []` y solo `total_aportado` + `valor_actual` sintetizados? | Limita la reconstrucción de FIFO histórica · pero la AEAT ya da ganancia/pérdida calculada | Probable aceptar · documentar en T13-bis |
| Q10 | ¿La pérdida fiscal de un traspaso vacío (cuando hay minusvalía latente) debe materializarse o quedar diferida? | Cambia la interpretación legal del art. 94 · CC NO interpreta normativa | Pregunta a asesor fiscal o aceptar interpretación conservadora · diferimiento total |

---

## 10 · Fuera de alcance · explicitar

- Cualquier modificación de código · 0 archivos tocados.
- Eliminación de zombies (`InversionesPage` horizon · `purgarPosicion`).
- Implementación de T13-bis · siguiente paso tras revisar este informe.
- EPSV y mutualidades · fuera de proyecto · idem auditoría pensiones.
- Acciones / ETF / REIT / cripto · fuera de alcance · si bien comparten el store `inversiones` · el régimen fiscal y operativo es distinto. T13-bis se centra en fondos.

---

**Fin del informe.** Esperar revisión de Jose · responder Q1-Q10 · decidir D1-D6 · y CC propondrá el plan de implementación T13-bis sobre esa base.
