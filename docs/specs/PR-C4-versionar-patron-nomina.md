# PR-C4 · Cable C-4 · versionar patrón nómina con `vigenciaDesde`
> **Tarea para CC** · 1 PR único contra `main` · stop-and-wait · NO mergear sin autorización Jose
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **Rama** · `pr-c4-versionar-patron-nomina`
> **DB_VERSION** · 69 → **70** · este PR sí sube version (campo nuevo + migración backfill)
> **Tiempo estimado** · 4-6 h
> **Cable que cierra** · C-4 (edición cómoda del patrón nómina · "subida abril" · cliente cambia importe a partir de fecha)
> **Predecesor** · C-1 mergeado (PR #1291 + hotfix #1292) · T-PERSONAL-AUDIT entregado · PR-B mergeado
> **Sucesor** · PR-C5 (atadura nómina real ↔ patrón con prompt confirmación) · BLOQUEADO sin C-4
---
## §0 · REGLA CANÓNICA ANTI-CREENCIAS · OBLIGATORIO
Para cualquier pieza que vayas a clasificar como "funcional" / "cableado" / "escribe en DB" · **DEBES ejecutar grep duro ANTES de afirmarlo:**
```bash
grep -nE "import.*services?/|initDB|db\.(put|add|delete|update)|service\.(save|create|delete|update)" <archivo>
grep -cE "showToastV5\(|alert\(|console\.log" <archivo>
```
| Caso | Veredicto |
|---|---|
| `imports=0` + `toasts>5` | MOCKUP ❌ |
| `imports>0` + `0 awaits save` | LECTURA PURA 🟡 |
| `imports>0` + `≥1 await save` | REAL ✅ |
**Prohibiciones:**
- ❌ No marcar "funcional" tras leer solo headers
- ❌ No confiar en docs / handoffs · pueden estar stale
- ❌ No tocar `nominaAportacionHook.ts` · es G-07 moderno crítico
- ❌ NO romper retrocompatibilidad de `nominaService.calculateSalary` · todas las nóminas históricas siguen calculando igual hasta que el cliente añada explícitamente un cambio en el historial
---
## §1 · CONTEXTO · POR QUÉ ESTE PR
### 1.1 · Hallazgo del audit T-PERSONAL-AUDIT
Verificación con grep duro · `Nomina` (`src/types/personal.ts:63-128`) NO tiene campo `vigenciaDesde` ni historial de cambios. `nominaService.updateNomina(id, updates)` (`src/services/nominaService.ts:196`) hace **overwrite destructivo**: si el cliente sube de 35.000 € a 38.000 € en abril, todo el cálculo del año (incluido enero-marzo) se recalcula a 38.000 €. Resultado: distorsión histórica del patrón.
Servicios que consumen `salarioBrutoAnual` y derivados vía `nominaService.calculateSalary(nomina)`:
- `src/modules/mi-plan/services/budgetProjection.ts:96` (proyección 12m Mi Plan)
- `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts:705` (proyección mensual horizon)
- `src/modules/horizon/tesoreria/services/treasurySyncService.ts:445` (forecast nómina → `treasuryEvents predicted`)
- `src/modules/personal/helpers.ts:46, 65` (helpers UI Personal)
- `src/services/fiscalConciliationService.ts:180-228` (conciliación patrón vs real fiscal)
- `src/services/irpfCalculationService.ts` (cálculo IRPF estimado)
- `src/services/personal/nominaAportacionHook.ts:45` (hook G-07 plan pensiones · solo lectura del importe configurado)
**Todos esperan `Nomina` plano** · si introducimos el historial, hay que mantener compatibilidad pasando una `fecha` opcional para resolver el snapshot vigente.
### 1.2 · Decisiones de modelo cerradas con Jose
| Decisión | Cerrada |
|---|---|
| **Forma del versionado** | Sub-array `historial: NominaHistorialEntry[]` dentro del propio registro `Nomina` · NO nuevo store · NO duplicar registros |
| **Granularidad del cambio** | Snapshot **completo** de los campos retributivos (salarioBrutoAnual + variables + bonus + pagasExtra + variableObjetivo + bonusObjetivo + retribucionEspecieAnual + aportacionEmpresaPlanPensionesAnual + planPensiones.aportacionEmpleado/aportacionEmpresa) · NO deltas parciales · simplifica cálculo y testing |
| **Resolución por mes** | Para mes X · `calculateSalary` busca la entrada del historial con mayor `vigenciaDesde <= primer-día-del-mes-X`. Si no encuentra ninguna · usa los campos top-level de `Nomina` (compatibilidad) |
| **Backfill V70** | Migración crea entrada inicial en `historial` con los valores actuales y `vigenciaDesde = fechaAntiguedad ?? fechaCreacion ?? '1970-01-01'` · idempotente · no destructiva |
| **UI de edición** | Wizard de nómina existente añade un toggle al editar · "¿Es un cambio a partir de cierta fecha?" · si SÍ · pide `vigenciaDesde` · crea entrada nueva en `historial` · NO sobrescribe el último snapshot. Si NO · sigue siendo overwrite top-level (caso rectificación de error) |
### 1.3 · Lo que NO entra en este PR
| Fuera del alcance | Va a |
|---|---|
| Atadura semi-automática movement entrante → patrón con prompt "¿actualizar patrón?" | **PR-C5** |
| Aprendizaje de patrón anual de gastos | **PR-C2** |
| Vista comparativa patrón vs real | **PR-C3** |
| Versionado del patrón de **autónomos / otros ingresos** | NO en este PR · solo `Nomina` (alcance audit) |
| Eliminar `pagasExtra`, `variableObjetivo`, `bonusObjetivo` legacy top-level | NO · permanecen como "snapshot vigente actual" para compatibilidad |
| UI gráfica de timeline del historial (línea temporal con todos los cambios) | NO · solo lista simple en este PR · puede ampliarse después |
| Rectificación / borrado de entradas del historial | NO en este PR · cliente puede crear una nueva entrada que la sustituya · borrar entrada histórica es trabajo separado |
---
## §2 · AUDITORÍA PREFLIGHT OBLIGATORIA
CC documenta hallazgos en la descripción del PR antes de implementar. Si algo contradice este spec · **PARAR** y reportar.
### 2.1 · Verificar el tipo `Nomina` actual
```bash
grep -nE "interface Nomina\b|^export interface Nomina" src/types/personal.ts
sed -n '63,128p' src/types/personal.ts
```
Confirmar:
- [ ] Campos retributivos transcritos · `salarioBrutoAnual` · `variables[]` · `bonus[]` · `pagasExtra?` · `variableObjetivo?` · `bonusObjetivo?` · `retribucionEspecieAnual?` · `aportacionEmpresaPlanPensionesAnual?` · `planPensiones?.aportacionEmpleado/aportacionEmpresa`
- [ ] NO hay ya `historial` ni `vigenciaDesde` en el tipo
- [ ] `fechaActualizacion` existe (la mantenemos · no es lo mismo que `vigenciaDesde`)
### 2.2 · Verificar consumidores de `calculateSalary`
```bash
grep -rn "calculateSalary\b" src/ | grep -v __tests__ | head -20
```
Confirmar:
- [ ] Lista de consumidores · transcribir literal con file:line
- [ ] Identificar cuáles cruzan por mes (proyeccion mensual · treasurySync · fiscalConciliation) · esos necesitan que `calculateSalary(nomina, fecha?)` resuelva snapshot del mes
- [ ] Identificar cuáles operan año completo sin mes (helpers · UI Personal panel) · esos pueden seguir llamando sin `fecha` y deben recibir el snapshot vigente más reciente o el top-level legacy
### 2.3 · Verificar `nominaService.updateNomina` y `saveNomina`
```bash
grep -nE "saveNomina|updateNomina|deleteNomina" src/services/nominaService.ts
sed -n '160,260p' src/services/nominaService.ts
```
Confirmar:
- [ ] `saveNomina` actualmente NO inicializa `historial` · este PR debe hacerlo crear con 1 entrada
- [ ] `updateNomina` actualmente sobrescribe campos · este PR añade modo "cambio con vigencia"
- [ ] `deleteNomina` no afecta a este cable
### 2.4 · Verificar `NominaWizard.tsx`
```bash
find src/pages/GestionPersonal/wizards -name "NominaWizard.tsx"
grep -nE "saveNomina|updateNomina|nominaService\.\b|fechaActualizacion" src/pages/GestionPersonal/wizards/NominaWizard.tsx | head -30
```
Confirmar:
- [ ] El wizard tiene step "Resumen" con CTA "Guardar" · ahí se enchufa la decisión "actualizar vigente" vs "crear cambio con vigencia"
- [ ] Los campos retributivos están en steps específicos · el toggle nuevo va al final · NO en cada paso
- [ ] El wizard tiene `mode='create'|'edit'` (verificar) · el toggle solo aparece en `mode='edit'`
### 2.5 · Verificar pattern de migración existente (V68 tipoFamilia)
```bash
sed -n '1,50p' src/services/migrations/v68-tipoFamilia.ts
grep -nE "MIGRATION_KEY|BATCH_SIZE|migration_v68" src/services/migrations/v68-tipoFamilia.ts | head -10
```
Confirmar:
- [ ] El patrón usa `keyval` flag para idempotencia (`migration_v68_tipoFamilia_v1`)
- [ ] Procesa en lotes de 100 si >1000 registros
- [ ] Solo escribe campos nuevos · NO destructivo
- [ ] Adoptar el mismo patrón para `v70-nomina-historial.ts`
### 2.6 · Verificar que `nominas` no es store legacy
> Audit (T-PERSONAL-AUDIT §2.1) confirmó que el store `nominas` se eliminó en V63 · todos los registros viven en `ingresos` con `tipo='nomina'`. CC valida ANTES de tocar nada:
```bash
grep -nE "STORE.*ingresos|tipo.*['\"]nomina['\"]|getAllFromIndex.*ingresos.*tipo" src/services/nominaService.ts | head -10
grep -rnE "db\.(put|add|delete).*['\"]nominas['\"]" src/ 2>/dev/null
```
Confirmar:
- [ ] `nominaService` opera sobre `ingresos` con filtro `tipo='nomina'` · veredicto REAL
- [ ] Ningún writer activo a un store `nominas` independiente · si lo hay · STOP y reportar
---
## §3 · CAMBIOS CONCRETOS
### 3.1 · Tipo `NominaHistorialEntry`
Añadir a `src/types/personal.ts` cerca de `Nomina`:
```typescript
/**
 * PR-C4 · entrada del historial de cambios retributivos de una `Nomina`.
 *
 * Representa "a partir de `vigenciaDesde` la nómina vale ESTOS campos".
 * El array `Nomina.historial` debe estar ordenado por `vigenciaDesde` ASC.
 *
 * `calculateSalary(nomina, fecha)` busca la entrada con mayor `vigenciaDesde`
 * que sea <= primer día del mes de `fecha`. Si no hay match, cae a los
 * campos top-level de `Nomina` (retrocompatibilidad).
 */
export interface NominaHistorialEntry {
  /** ID corto, único por entrada (uuid o `${nominaId}-${vigenciaDesde}`). */
  id: string;
  /** Fecha ISO YYYY-MM-DD desde la que aplica el snapshot. */
  vigenciaDesde: string;
  /** Etiqueta opcional explicada por el usuario · "Subida abril 2026". */
  motivo?: string;
  /** Snapshot de los campos retributivos en el momento del cambio. */
  snapshot: {
    salarioBrutoAnual: number;
    variables?: Variable[];
    bonus?: Bonus[];
    pagasExtra?: NominaPagasExtra;
    variableObjetivo?: NominaVariableObjetivo;
    bonusObjetivo?: NominaBonusObjetivo;
    retribucionEspecieAnual?: number;
    aportacionEmpresaPlanPensionesAnual?: number;
    planPensiones?: PlanPensionesNomina;
  };
  /** ISO timestamp de creación de la entrada. */
  createdAt: string;
}
```
### 3.2 · Extender `Nomina`
```typescript
export interface Nomina {
  // ... campos existentes ...
  /**
   * PR-C4 · historial de cambios retributivos. Cuando existe, el cálculo
   * mensual usa el snapshot con `vigenciaDesde <= primerDiaDelMes` más
   * reciente. Cuando NO existe (registros pre-V70 sin migrar) o está vacío,
   * el cálculo usa los campos top-level (retrocompatibilidad).
   *
   * Migración V70 · `v70-nomina-historial.ts` crea una entrada inicial
   * para todos los registros existentes con los valores actuales y
   * `vigenciaDesde = fechaAntiguedad ?? fechaCreacion`.
   */
  historial?: NominaHistorialEntry[];
}
```
### 3.3 · DB_VERSION → 70
En `src/services/db.ts`:
```typescript
const DB_VERSION = 70; // V70 (PR-C4): añade `historial?: NominaHistorialEntry[]` al patrón Nomina (registros tipo='nomina' en store `ingresos`). Backfill via migración v70-nomina-historial. 40 stores (sin cambio en número).
```
Caso de migración (en el switch `upgrade`):
```typescript
if (oldVersion < 70) {
  // ── V70 (PR-C4) ─────────────────────────────────────────────
  // Solo bump de version · sin cambio de schema (campo opcional sobre
  // store `ingresos` existente). El backfill de datos lo hace
  // `v70-nomina-historial.ts` desde `appBootstrap` la primera vez que
  // arranca la app tras el upgrade (idempotente vía keyval flag).
}
```
### 3.4 · Migración `v70-nomina-historial.ts`
Nuevo archivo `src/services/migrations/v70-nomina-historial.ts` siguiendo el patrón de `v68-tipoFamilia.ts`:
```typescript
// ============================================================================
// PR-C4 · Migración V70 · historial inicial en Nomina
// ============================================================================
//
// Crea una entrada inicial en `Nomina.historial` para todos los registros
// existentes en `ingresos` con `tipo='nomina'` que NO tengan `historial` o
// lo tengan vacío. La entrada captura los valores retributivos vigentes
// con `vigenciaDesde = fechaAntiguedad ?? fechaCreacion` (fallback
// '1970-01-01' si ambos son null).
//
// Idempotente: keyval 'migration_v70_nomina_historial_v1'.
// No destructiva: campos top-level se mantienen.
// ============================================================================

import { initDB } from '../db';
import type { Nomina, NominaHistorialEntry } from '../../types/personal';

const MIGRATION_KEY = 'migration_v70_nomina_historial_v1';
const BATCH_SIZE = 100;

const genId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export async function runV70NominaHistorialMigration(): Promise<void> {
  const db = await initDB();
  const flag = await db.get('keyval', MIGRATION_KEY).catch(() => null);
  if (flag) return; // ya ejecutada

  const nominas = (await db.getAllFromIndex('ingresos', 'tipo', 'nomina')) as Nomina[];
  let updated = 0;
  for (const nomina of nominas) {
    if (nomina.historial && nomina.historial.length > 0) continue;
    const vigenciaDesde =
      nomina.fechaAntiguedad ??
      nomina.fechaCreacion ??
      '1970-01-01';
    const entrada: NominaHistorialEntry = {
      id: genId(),
      vigenciaDesde: vigenciaDesde.slice(0, 10),
      motivo: 'Snapshot inicial (migración V70)',
      snapshot: {
        salarioBrutoAnual: nomina.salarioBrutoAnual,
        variables: nomina.variables,
        bonus: nomina.bonus,
        pagasExtra: nomina.pagasExtra,
        variableObjetivo: nomina.variableObjetivo,
        bonusObjetivo: nomina.bonusObjetivo,
        retribucionEspecieAnual: nomina.retribucionEspecieAnual,
        aportacionEmpresaPlanPensionesAnual: nomina.aportacionEmpresaPlanPensionesAnual,
        planPensiones: nomina.planPensiones,
      },
      createdAt: new Date().toISOString(),
    };
    await db.put('ingresos', { ...nomina, historial: [entrada] });
    updated++;
  }

  await db.put('keyval', { id: MIGRATION_KEY, value: { runAt: new Date().toISOString(), updated } });
}
```
### 3.5 · Wire de la migración en bootstrap
Localizar el archivo que llama a `runV68TipoFamiliaMigration` (o equivalente) y añadir la llamada a `runV70NominaHistorialMigration` justo después · sin awaits paralelos (orden V68 → V70).
**Ruta probable** (CC verifica con grep): `src/services/appBootstrap.ts` o `src/services/treasuryBootstrapService.ts` o `src/index.tsx` (raíz init).
```typescript
import { runV70NominaHistorialMigration } from './migrations/v70-nomina-historial';
// ...
await runV70NominaHistorialMigration();
```
### 3.6 · Refactor `nominaService.calculateSalary(nomina, fecha?)`
Añadir parámetro opcional `fecha?: string` (ISO YYYY-MM-DD).
```typescript
calculateSalary(nomina: Nomina, fecha?: string): CalculoNominaResult {
  // PR-C4 · resolver snapshot vigente para `fecha`. Si no hay historial o
  // no hay entrada con vigenciaDesde <= fecha, usa los campos top-level
  // (retrocompatibilidad).
  const snapshot = resolveSnapshotVigente(nomina, fecha);
  const efectiva: Nomina = snapshot ? { ...nomina, ...snapshot } : nomina;

  // ... cuerpo actual de calculateSalary, pero leyendo de `efectiva` ...
}

function resolveSnapshotVigente(
  nomina: Nomina,
  fecha?: string,
): NominaHistorialEntry['snapshot'] | null {
  if (!nomina.historial || nomina.historial.length === 0) return null;
  // Si no se pasa fecha, usar el snapshot más reciente.
  const ymd = (fecha ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const ordenado = [...nomina.historial].sort((a, b) =>
    a.vigenciaDesde.localeCompare(b.vigenciaDesde),
  );
  let activo: NominaHistorialEntry | null = null;
  for (const e of ordenado) {
    if (e.vigenciaDesde <= ymd) activo = e;
    else break;
  }
  return activo ? activo.snapshot : null;
}
```
**Adaptar consumidores que cruzan por mes:**
- `proyeccionMensualService.ts:705` · pasar `${año}-${mes}-01`
- `treasurySyncService.ts:445` · pasar la fecha del evento que se está generando
- `fiscalConciliationService.ts:185` · pasar `${ejercicio}-${mes}-01`

Consumidores que NO cruzan por mes siguen llamando sin `fecha` · reciben el snapshot más reciente · comportamiento idéntico a hoy si no hay historial (top-level) o equivalente al "estado actual" si hay historial.
### 3.7 · Nueva API en `nominaService` · `addCambioNomina`
```typescript
/**
 * PR-C4 · añade una entrada al historial de la nómina · NO sobrescribe
 * el último snapshot · NO toca los campos top-level (que reflejan el
 * snapshot vigente más reciente).
 *
 * Si `vigenciaDesde` < última entrada del historial, ordena igualmente y
 * devuelve warning en consola (caso poco común · cliente registra cambio
 * histórico tardío).
 */
async addCambioNomina(
  id: number,
  cambio: Omit<NominaHistorialEntry, 'id' | 'createdAt'>,
): Promise<Nomina> {
  const nomina = await this.getNominaById(id);
  if (!nomina) throw new Error(`Nomina ${id} no encontrada`);

  const entrada: NominaHistorialEntry = {
    id: genId(),
    createdAt: new Date().toISOString(),
    ...cambio,
  };

  const historial = [...(nomina.historial ?? []), entrada].sort(
    (a, b) => a.vigenciaDesde.localeCompare(b.vigenciaDesde),
  );

  // Si es la entrada más reciente, también actualizamos campos top-level
  // para que los lectores legacy sigan viendo el "estado actual".
  const esLaMasReciente =
    historial[historial.length - 1].id === entrada.id;
  const updates: Partial<Nomina> = {
    historial,
    fechaActualizacion: new Date().toISOString(),
  };
  if (esLaMasReciente) {
    Object.assign(updates, entrada.snapshot);
  }

  return this.updateNomina(id, updates);
}
```
### 3.8 · UI · NominaWizard
Añadir al step final (Resumen / Guardar) cuando `mode='edit'`:
```tsx
<div className="cv2-form-section">
  <h3>¿Es un cambio con fecha de inicio?</h3>
  <div className="cv2-radio-group">
    <label>
      <input
        type="radio"
        name="modoEdicion"
        checked={modoEdicion === 'overwrite'}
        onChange={() => setModoEdicion('overwrite')}
      />
      Rectificación · sustituye el snapshot vigente (corregir error)
    </label>
    <label>
      <input
        type="radio"
        name="modoEdicion"
        checked={modoEdicion === 'cambio-con-vigencia'}
        onChange={() => setModoEdicion('cambio-con-vigencia')}
      />
      Cambio a partir de fecha · ej. subida salarial abril 2026
    </label>
  </div>
  {modoEdicion === 'cambio-con-vigencia' && (
    <>
      <div className="cv2-field">
        <label>Vigencia desde</label>
        <input
          type="date"
          value={vigenciaDesde}
          onChange={(e) => setVigenciaDesde(e.target.value)}
          required
        />
      </div>
      <div className="cv2-field">
        <label>Motivo (opcional)</label>
        <input
          type="text"
          placeholder="ej. Subida salarial abril 2026"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
    </>
  )}
</div>
```
Submit:
```typescript
if (modoEdicion === 'cambio-con-vigencia') {
  await nominaService.addCambioNomina(nominaId, {
    vigenciaDesde,
    motivo: motivo || undefined,
    snapshot: extraerSnapshotDelForm(nominaData),
  });
} else {
  await nominaService.updateNomina(nominaId, nominaData);
}
```
### 3.9 · UI · listado historial en wizard step `Resumen`
Pequeño bloque de lectura cuando `mode='edit'` y `nomina.historial?.length > 1`:
```tsx
{nomina.historial && nomina.historial.length > 0 && (
  <div className="cv2-form-section">
    <h3>Historial de cambios ({nomina.historial.length})</h3>
    <ul>
      {nomina.historial.map((e) => (
        <li key={e.id}>
          <strong>{e.vigenciaDesde}</strong> · {e.motivo ?? 'Sin motivo'} ·
          {' '}{formatEuro(e.snapshot.salarioBrutoAnual)} bruto/año
        </li>
      ))}
    </ul>
  </div>
)}
```
NO permitir borrar entradas desde aquí · es solo lectura.
---
## §4 · VALIDACIONES
| Campo | Regla |
|---|---|
| `vigenciaDesde` | Obligatorio si `modoEdicion='cambio-con-vigencia'` · ISO YYYY-MM-DD · NO puede ser futuro mayor a +5 años · puede ser histórico (warning si <= última entrada) |
| `motivo` | Opcional · max 200 chars |
| `snapshot.salarioBrutoAnual` | > 0 |
| Resto de campos del wizard | Sin cambios respecto a comportamiento actual |
---
## §5 · TESTING MANUAL · CHECKLIST OBLIGATORIO
CC adjunta capturas en la descripción del PR.
### Caso 1 · creación nueva crea historial inicial
- [ ] Crear nómina nueva via `/gestion/personal/nueva-nomina` con bruto 35.000 €
- [ ] DevTools · `ingresos` (tipo='nomina') · verificar `historial` con 1 entrada · `vigenciaDesde = fechaAntiguedad` · `snapshot.salarioBrutoAnual = 35000`
### Caso 2 · cambio con vigencia abril
- [ ] Editar la nómina del Caso 1 · cambiar a 38.000 € · seleccionar "Cambio a partir de fecha" · `vigenciaDesde = 2026-04-01`
- [ ] DevTools · `historial` con 2 entradas · 2ª con `vigenciaDesde='2026-04-01'` · `snapshot.salarioBrutoAnual=38000`
- [ ] Top-level `salarioBrutoAnual=38000` (porque es el snapshot más reciente)
### Caso 3 · proyección mensual respeta vigencia
- [ ] Abrir `/proyeccion/mensual` (o cualquier consumidor que cruce mes)
- [ ] Verificar enero-marzo 2026 calculan con bruto 35.000 €
- [ ] Verificar abril-diciembre 2026 calculan con bruto 38.000 €
- [ ] El total anual NO es ni 35.000 ni 38.000 · es la mezcla mensual
### Caso 4 · rectificación overwrite
- [ ] Editar misma nómina · cambiar a 38.500 € · seleccionar "Rectificación · sustituye el snapshot vigente"
- [ ] DevTools · `historial` sigue con 2 entradas · 2ª con `snapshot.salarioBrutoAnual=38500`
- [ ] NO hay 3ª entrada
### Caso 5 · backfill V70
- [ ] (Antes de aplicar el PR) crear una nómina · DevTools · sin `historial`
- [ ] Aplicar el PR · recargar app
- [ ] DevTools · keyval `migration_v70_nomina_historial_v1` presente · nómina ahora tiene `historial[1]`
- [ ] Recargar otra vez · keyval sigue presente · no se duplica entrada
### Caso 6 · retrocompatibilidad
- [ ] DevTools · borrar manualmente `historial` de una nómina
- [ ] `proyeccion mensual` y `mi-plan/proyeccion` siguen calculando con campos top-level
- [ ] Cero errores en consola
### Caso 7 · auto-validación grep duro
```bash
grep -nE "interface NominaHistorialEntry|historial\?:.*NominaHistorialEntry" src/types/personal.ts
grep -nE "DB_VERSION = 70" src/services/db.ts
ls src/services/migrations/v70-nomina-historial.ts
grep -nE "addCambioNomina\b" src/services/nominaService.ts src/pages/GestionPersonal/wizards/NominaWizard.tsx
grep -nE "calculateSalary\(.*,.*\)" src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts src/modules/horizon/tesoreria/services/treasurySyncService.ts src/services/fiscalConciliationService.ts
```
Resultado esperado · todas las greps con hits.
### Caso 8 · build + tests
- [ ] `npx tsc --noEmit` · cero errores nuevos
- [ ] `react-scripts build` · OK
- [ ] `react-scripts test` · 0 nuevos fallos respecto a baseline (`git stash` + run)
---
## §6 · CRITERIOS DE ACEPTACIÓN
1. ✅ Auditoría preflight §2 documentada en descripción del PR
2. ✅ `Nomina.historial?` añadido a `src/types/personal.ts` con tipo `NominaHistorialEntry[]`
3. ✅ DB_VERSION = 70 con migración `v70-nomina-historial.ts` (idempotente vía keyval flag)
4. ✅ `nominaService.calculateSalary(nomina, fecha?)` resuelve snapshot vigente · cae a top-level si no hay historial
5. ✅ `nominaService.addCambioNomina` crea entrada nueva sin sobrescribir
6. ✅ `NominaWizard` en `mode='edit'` ofrece toggle "Rectificación" vs "Cambio con vigencia"
7. ✅ Listado del historial visible en step Resumen (read-only)
8. ✅ Consumidores mensuales (`proyeccionMensual`, `treasurySync`, `fiscalConciliation`) actualizados para pasar `fecha`
9. ✅ Los 8 casos del checklist §5 pasan · capturas adjuntas
10. ✅ Auto-validación grep duro Caso 7 OK
11. ✅ Tests baseline sin nuevos fallos · build OK
12. ✅ Movements/treasuryEvents existentes con `sourceType='nomina'` siguen funcionando
---
## §7 · QUÉ NO HACER
- ❌ NO sobrescribir el snapshot top-level si la entrada del historial NO es la más reciente
- ❌ NO eliminar `pagasExtra`, `variableObjetivo`, `bonusObjetivo` del nivel raíz de `Nomina` · siguen siendo el snapshot vigente para retrocompatibilidad
- ❌ NO crear un store nuevo · todo vive en `ingresos` con `tipo='nomina'`
- ❌ NO migrar agresivamente · si un registro ya tiene `historial` (test data o migración previa), respetar
- ❌ NO tocar `nominaAportacionHook.ts` (G-07 moderno)
- ❌ NO tocar autónomos / otros ingresos · solo `Nomina`
- ❌ NO romper la firma de `calculateSalary(nomina)` sin `fecha` · debe seguir funcionando
- ❌ NO mergear sin autorización Jose
- ❌ NO marcar nada "funcional" sin grep duro
---
## §8 · DUDAS QUE BLOQUEAN · CUÁNDO PARAR
CC para y reporta a Jose si encuentra:
1. `Nomina` ya tiene `historial` o `vigenciaDesde` en alguna parte · contradice el audit · probablemente ya implementado parcialmente
2. `nominaService.calculateSalary` recibe ya un parámetro `fecha` o equivalente · este PR es no-op
3. La migración `v68-tipoFamilia` NO usa keyval flag · el patrón es distinto · CC adapta o pregunta
4. El bootstrap NO ejecuta migraciones secuenciales · ruta del wire desconocida
5. Algún consumidor de `calculateSalary` rompe en compile cuando se añade `fecha?` opcional (no debería pasar por ser opcional)
6. Tests existentes de `nominaService.calculateSalary` rompen tras el refactor · ajustar tests es parte del PR · si rompen >5 tests · STOP y consultar
**Forma de reportar:** issue GitHub "PR-C4 preflight bloqueante · <hallazgo>"
---
## §9 · QUÉ VIENE DESPUÉS
Tras este PR mergeado, queda lista la base para:
| Cable | Spec siguiente | Bloqueado por |
|---|---|---|
| **C-5** · atadura nómina real ↔ patrón con prompt confirmación | PR-C5 · ahora ya puede actualizar el patrón con `vigenciaDesde` sin destruir histórico | C-4 ✅ (este PR) |
| **C-2** · ATLAS aprende patrón anual | PR-C2 | C-1 ✅ + C-5 |
| **C-3** · vista comparativa patrón vs real | PR-C3 (XL) | C-1 ✅ + C-2 + C-4 ✅ + C-5 |
Tras PR-C4 · cliente puede subirse el sueldo en abril sin distorsionar enero-marzo. Es la base para que C-5 pueda detectar "el real de mayo es 38.000 € pero el patrón pre-abril era 35.000 €" y proponer "¿añadir cambio con vigencia abril?".
---
**Fin del spec PR-C4.** Listo para CC. Stop-and-wait · NO mergear hasta autorización Jose.
