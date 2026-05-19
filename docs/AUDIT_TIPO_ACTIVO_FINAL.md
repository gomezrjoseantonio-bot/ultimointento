# AUDIT_TIPO_ACTIVO_FINAL

**PR0 · TAREA-CC-T-VALORACIONES · v1**
**Fecha** · 2026-05-19
**HEAD auditado** · `624f190` (branch `claude/polymorphic-valuations-store-wVfsr`)
**Propósito** · cardinalidad real de `TipoActivo` para PR3 (wizards) y PR4-6 (migraciones).

---

## 1 · Cardinalidad asumida por el spec

El spec define:

```typescript
export type TipoActivo =
  | 'plan_pensiones'
  | 'fondo'
  | 'accion_etf'
  | 'crypto'
  | 'inmueble'
  | 'deposito'
  | 'otro';
```

**7 tipos** · uno por tipo de activo invertible.

---

## 2 · Cardinalidad real en código hoy

### 2.1 · En el store polimórfico actual `valoraciones_historicas`

`src/types/valoraciones.ts:6`:
```typescript
tipo_activo: 'inmueble' | 'inversion' | 'plan_pensiones';
```

**3 tipos** · todos los activos financieros no-inmobiliarios y no-pensión están bajo el único bucket `inversion`.

### 2.2 · Stores de activo existentes (`db.ts`)

| Store | ¿Existe? | Modela | Tipo activo correspondiente |
|---|---|---|---|
| `properties` | ✅ | Inmuebles | `inmueble` |
| `planesPensiones` | ✅ | Planes de pensiones | `plan_pensiones` |
| `inversiones` | ✅ | Fondos + Acciones + ETFs + Crypto (sin distinguir) | `inversion` (hoy lumped) |
| `fondos_ahorro` | ✅ | Metas de ahorro (mi-plan) | **NO es activo invertible** · meta |
| `objetivos` | ✅ | Objetivos financieros (mi-plan) | NO es activo invertible |
| `aportacionesPlan` | ✅ | Movimientos a planes (no es activo · es transacción) | NO toca |
| `traspasosPlanPensiones` | ✅ | Traspasos PP | NO toca |
| `viviendaHabitual` | ✅ | Datos de la vivienda habitual (fiscal) | NO migra |
| `depositos` | ❌ | No existe store de depósitos | **GAP** |
| `crypto` | ❌ | No existe store específico | **GAP** |
| `accionesEtfs` | ❌ | No existe store específico | **GAP** |
| `fondosInversion` | ❌ | No existe store específico | **GAP** |

### 2.3 · `TipoActivo` en módulo Inmuebles (sin relación al refactor)

`src/modules/inmuebles/pages/ListadoPage.tsx:13,29,34,269`:
```typescript
type TipoFilter = 'todos' | TipoActivo;
```

Este `TipoActivo` es del **submodelo de inmuebles** (vivienda, garaje, trastero, local, etc.) · **NO** es la misma noción que el `TipoActivo` polimórfico de valoraciones. Aliasing terminológico — cuando se cree el type nuevo, hay que evitar colisión.

### 2.4 · `TipoActivoProyectable` en módulo Inversiones

`src/modules/inversiones/components/bloques/BloqueProyeccion.tsx:13`, `BloqueBenchmark.tsx:9`:
```typescript
type TipoActivoProyectable
```

Otra entidad diferente al `TipoActivo` polimórfico · subtipo dentro del módulo Inversiones para la lógica de proyección. **Cuidado al nombrar** el nuevo type del store.

---

## 3 · 3 rutas posibles para PR1

### 3.1 · Ruta A · Cardinalidad 7 (la del spec) · MÁXIMA GRANULARIDAD
Implica:
- Migrar registros existentes en `valoraciones_historicas` con `tipo_activo='inversion'` a uno de los 4 sub-tipos (`fondo|accion_etf|crypto|deposito`) — pero **no hay metadata en el registro de valoración** para decidir cuál es (sólo `activo_id`).
- Inferir el sub-tipo del store `inversiones` (campo `tipo` o similar) → **requiere auditar `src/types/inversiones.ts`**.
- Si `inversiones.tipo` no distingue (fondo / accion / crypto), entonces es **ambiguo** y la migración no es automatizable sin intervención manual.
- Crear stores nuevos (`depositos`, etc.) para los tipos que hoy no existen, **fuera de scope** T-VALORACIONES.

**Preflight obligatorio antes de adoptar Ruta A** · auditar `src/types/inversiones.ts` y `src/services/inversionesService.ts` para verificar si el campo `tipo` ya distingue (fondo / accion / etf / crypto). Si NO distingue, Ruta A no es viable sin PR previo de "separar inversiones por tipo" (otro refactor grande).

### 3.2 · Ruta B · Cardinalidad 4 (compromiso) · sub-tipo de `inversion` opcional
Tipos:
```typescript
type TipoActivo = 'inmueble' | 'inversion' | 'plan_pensiones' | 'deposito' | 'otro';
```
Añadir campo opcional `subtipo?: 'fondo' | 'accion' | 'etf' | 'crypto' | 'deposito'` en `ValoracionActivo`.

**Pros** · evita explosión de tipos, no rompe migraciones, permite refinamiento progresivo.
**Contras** · KPIs por sub-tipo requieren filtrar por `subtipo`.

### 3.3 · Ruta C · Cardinalidad 3 (status quo) · solo enriquecer schema
Mantener `tipo_activo` con 3 valores (`inmueble | inversion | plan_pensiones`), enriquecer registros con `divisaOriginal`, `esAnchorFiscal`, `archivoOrigenId`, `deletedAt`, granularidad diaria.

**Pros** · refactor mínimo, cero migración de datos, cero ambigüedad.
**Contras** · no resuelve completamente las gráficas KPI desglosadas por tipo (fondo vs acción).

---

## 4 · Lista cerrada propuesta (recomendación CC)

**Recomendación · Ruta B** (cardinalidad 4 + subtipo opcional). Permite:
- Reusar 100% de los registros existentes con `tipo_activo='inversion'` (no se rompe nada).
- Añadir `subtipo` solo donde aporta (nuevos altas, importaciones futuras).
- Crear el tipo `deposito` aunque hoy no haya store · si en el futuro hay altas manuales de depósitos, ya están preparadas.

```typescript
export type TipoActivo =
  | 'inmueble'
  | 'inversion'
  | 'plan_pensiones'
  | 'deposito'
  | 'otro';

export type SubtipoInversion =
  | 'fondo'
  | 'accion'
  | 'etf'
  | 'crypto';

export interface ValoracionActivo {
  id: number;
  activoId: number | string;          // dual (Inmuebles=number, PP=UUID string)
  tipoActivo: TipoActivo;
  subtipoInversion?: SubtipoInversion; // solo si tipoActivo === 'inversion'
  // ... resto del spec
}
```

### 4.1 · Tipos que tendrán wizard de importación (PR3)
- `inmueble` · usar `ImportarValoraciones.tsx` existente (ya soporta este tipo)
- `inversion` · usar `ImportarValoraciones.tsx` (ya soporta) + `ImportarIndexaCapitalPage.tsx` para Indexa específicamente
- `plan_pensiones` · usar wizard existente
- `deposito` · solo manual (sin wizard CSV en V1)
- `otro` · solo manual

### 4.2 · Tipos que aparecerán en migración seed (PR4-6)
- PR4 · `plan_pensiones` (seed desde `planesPensiones.valorActual`) + `inversion` (seed desde `inversiones.valorActual` o `inversiones.cotizacion`)
- PR5 · `inmueble` (seed desde `properties.valor_actual` / fallback `tasacion` con flag esAnchorFiscal)
- PR6 · `deposito`, `otro` · vacíos (no hay stores actualmente · no seeds)

---

## 5 · Decisiones pendientes para Jose

| # | Pregunta | Opciones |
|---|---|---|
| Q1 | ¿Cardinalidad final? | **A** (7 tipos) · **B** (4+subtipo · recomendada) · **C** (3 status quo) |
| Q2 | ¿Tratar `accounts` (cash) como activo? | NO (recomendado) · sí (entrar como `tipoActivo:'otro'`) |
| Q3 | ¿Tratar `fondos_ahorro` (metas) como activo? | NO (recomendado · son metas mi-plan, no activo invertible) · sí |
| Q4 | ¿Granularidad fecha? | **YYYY-MM-DD** (recomendado · permite gráfica curva) · YYYY-MM (status quo) |
| Q5 | ¿Refactor en sitio (Opción ALPHA) vs store paralelo (BETA) vs solo enriquecer (GAMMA)? | Ver §8 de `AUDIT_VALORACIONES_USAGES.md` |
| Q6 | ¿Mantener `activo_id` como union `number\|string` o forzar `string`? | Recomendado **`string`** (UUID interno) · normalizar con seed |
| Q7 | ¿Naming snake_case (status quo) o camelCase (spec)? | Recomendado **camelCase** (alinea spec) · con migración upgrade |
| Q8 | ¿Librería de gráficas para PR8/PR9? | **recharts** (recomendado · ya en uso) · chart.js |

---

## 6 · Implicaciones para los PRs siguientes (resumen accionable)

- **PR1** · NO se trata de crear un store nuevo desde cero. Es **bump DB v73 → v74 + ALTER del store existente** (`valoraciones_historicas` → `valoracionesActivos` con migración de schema dentro del upgrade). Posiblemente más complejo que el spec original.
- **PR2** · NO se trata de "crear servicio". Es **refactor del `valoracionesService` existente** para añadir las APIs del spec (`upsertByDate`, `getValorAFecha`, `getPatrimonioTotal`, `getPatrimonioPorTipo`, `softDelete`, `restore`, `deleteAllByActivo`) y mantener compatibilidad con los call-sites existentes (>20 paths).
- **PR3** · NO hay servicio huérfano. Es **integración del wizard existente** (`ImportarValoraciones.tsx`) desde las fichas detalle de Inversiones (hoy solo accesible desde menú Inmuebles).
- **PR4-6** · seed razonable; ajustar nombres reales de stores (`properties`, `inversiones`, `planesPensiones`).
- **PR7** · DB version bump v74 → v75 + purge de campos legacy + refactor de ~50 paths lectores. **Recomendable dividir en PR7a + PR7b**.
- **PR8** · gráfica `GraficaEvolucionValor` con recharts.
- **PR9** · `GraficaPatrimonioTotal` con recharts.

---

## FIN AUDIT_TIPO_ACTIVO_FINAL
