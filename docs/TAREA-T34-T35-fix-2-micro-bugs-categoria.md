# TAREA CC · T34/T35-fix-2 · Micro-bugs `categoria` en compromisos · v1

> **Tipo** · 1 sub-tarea única · 1 PR contra `main` · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **DB** · NO se toca · DB_VERSION sigue **69**
> **Esfuerzo** · 30-60 min CC real · 2h total con revisión Jose
> **Prioridad** · BAJA · saneamiento · NO bloqueante
> **Predecesores** · T34 · T35 · T34-fix · T35-fix · T34.b · T35.b · T38 (todas mergeadas)

---

## 0 · Reglas inviolables

### 0.1 · DB_VERSION sin cambios
Sigue en 69 · 40 stores · NO migración · este fix solo corrige clasificación de **datos existentes** y la lógica de **inferencia futura**.

### 0.2 · NO inventar
Las 2 reglas a cambiar están **explícitamente documentadas** en HANDOFF-V7-atlas.md sección "T34/T35-fix-2 · Micro-bugs categoria". CC se ciñe al alcance · no interpreta otras categorías.

### 0.3 · Auditoría preflight obligatoria
Antes de codear · CC verifica:
- `compromisosRecurrentes` schema actual · localizar dónde se calcula `categoria` desde `tipo` + `subtipo`
- Buscar registros existentes con `categoria='otros.otros'` y `tipo='dia_a_dia'` · contar cuántos
- Buscar registros existentes con `categoria='otros.seguro_otros'` y `tipo='seguros_cuotas'` · contar cuántos
- Reportar conteo en PR antes de migrar

### 0.4 · Idempotencia migración
La migración de datos existentes debe ser idempotente · ejecutable N veces sin doble corrección. Usar flag `cleanup_T34_T35_fix2_categorias` en `keyval` igual que el patrón T14.5.

### 0.5 · Stop-and-wait
1 PR único contra `main` · NO mergear sin autorización Jose.

---

## 1 · Contexto · qué pasó

T38 (mapeo familias + coherencia categoria) cerró el problema grande de `tipo` aplastado a "otros". Pero al validar producción Jose detectó **2 micro-casos donde la inferencia del `categoria` es incorrecta**:

| # | Caso | `tipo`/`subtipo` | `categoria` actual (BUG) | `categoria` correcta |
|---|---|---|---|---|
| 1 | Día a día · Otros | `tipo: 'dia_a_dia'` · `subtipo: 'otros'` | `otros.otros` | `dia_a_dia.otros` |
| 2 | Seguros y cuotas · Seguro otros | `tipo: 'seguros_cuotas'` · `subtipo: 'seguro_otros'` (ej · "Segurcaixa") | `otros.seguro_otros` | `seguros_cuotas.seguro_otros` |

Ambos son fallos de la misma raíz · cuando `subtipo` empieza por `'otros'` o contiene `'_otros'` · el constructor de `categoria` está priorizando `'otros'` como familia en lugar del `tipo` real.

---

## 2 · Alcance

### 2.1 · Corregir lógica de inferencia categoria

Localizar el helper `buildCategoria(tipo, subtipo)` o equivalente (probablemente en `src/services/compromisosRecurrentes.ts` o helper `tipoSubtipoCategoria.ts` · CC localiza).

Lógica actual (presunta) genera `categoria = '{tipo}.{subtipo}'` pero con un fallback que aplasta a `otros.X` cuando subtipo contiene "otros". Eliminar el fallback · regla siempre `'{tipo}.{subtipo}'` literal.

```typescript
// CORRECTO (regla simple sin fallback)
function buildCategoria(tipo: string, subtipo: string): string {
  return `${tipo}.${subtipo}`;
}
```

Si la lógica actual tiene casos especiales que se pierden con esta simplificación · CC documenta y reporta antes de cambiar.

### 2.2 · Migración datos existentes

Crear `src/services/migrations/cleanupCategoriasT34T35fix2.ts` · idempotente · al arranque de App tras `initDB()`.

Pseudocódigo:
```typescript
async function cleanupCategoriasT34T35fix2() {
  const flag = await keyval.get('cleanup_T34_T35_fix2_categorias');
  if (flag === 'completed') return;
  
  const compromisos = await db.compromisosRecurrentes.toArray();
  let corregidos = 0;
  
  for (const c of compromisos) {
    const categoriaCorrecta = `${c.tipo}.${c.subtipo}`;
    if (c.categoria !== categoriaCorrecta) {
      // Solo corregir si match con los 2 patrones detectados
      const esCaso1 = c.categoria === 'otros.otros' && c.tipo === 'dia_a_dia';
      const esCaso2 = c.categoria === 'otros.seguro_otros' && c.tipo === 'seguros_cuotas';
      
      if (esCaso1 || esCaso2) {
        await db.compromisosRecurrentes.update(c.id, { categoria: categoriaCorrecta });
        corregidos++;
      }
    }
  }
  
  await keyval.set('cleanup_T34_T35_fix2_categorias', 'completed');
  console.info(`[T34/T35-fix-2] Categorías corregidas: ${corregidos}`);
}
```

**Importante** · NO corregir TODAS las categorías incoherentes · solo los 2 patrones documentados. Otras incoherencias podrían tener causa distinta · TAREA aparte.

### 2.3 · Tests obligatorios

- Test 1 · `buildCategoria('dia_a_dia', 'otros')` → `'dia_a_dia.otros'` (NO `'otros.otros'`)
- Test 2 · `buildCategoria('seguros_cuotas', 'seguro_otros')` → `'seguros_cuotas.seguro_otros'` (NO `'otros.seguro_otros'`)
- Test 3 · `buildCategoria('vivienda', 'suministros')` → `'vivienda.suministros'` (sin regresión)
- Test 4 · cleanup migra registros con categoría `'otros.otros'` y tipo `'dia_a_dia'` a `'dia_a_dia.otros'`
- Test 5 · cleanup es idempotente (segunda ejecución no toca nada · flag completed)
- Test 6 · cleanup NO toca registros con categoría coherente (ej · `vivienda.suministros` se queda como está)

---

## 3 · Verificación post-deploy preview (Jose validará)

1. DB_VERSION = 69 · 40 stores · sin cambios
2. Tests pasan
3. Listado Personal · compromiso "Día a día · Otros" muestra categoría `dia_a_dia.otros`
4. Listado Personal · compromiso "Segurcaixa" o equivalente muestra categoría `seguros_cuotas.seguro_otros`
5. Resto de compromisos sin cambios
6. Crear NUEVO compromiso "Día a día · Otros" desde wizard · al guardar · `categoria='dia_a_dia.otros'` (no `'otros.otros'`)
7. DevTools · `keyval['cleanup_T34_T35_fix2_categorias'] === 'completed'`
8. App arranca sin errores · cleanup ejecutado primer arranque · skip silencioso siguientes arranques

---

## 4 · Cómo lanzar a CC

```
@CC ejecuta T34/T35-fix-2 · Micro-bugs categoría compromisos
Spec · docs/TAREA-T34-T35-fix-2-micro-bugs-categoria.md

PUNTO DE PARTIDA · auditoría preflight
- DB_VERSION = 69 · 40 stores
- T38 mergeada · 14 compromisos personales en producción Jose
- Localizar helper buildCategoria (o equivalente) en src/services/
- Reportar en PR · cuántos registros con categoria='otros.otros' y tipo='dia_a_dia' · cuántos con categoria='otros.seguro_otros' y tipo='seguros_cuotas'

ALCANCE
1. Corregir helper buildCategoria · regla simple `{tipo}.{subtipo}` · sin fallback que aplaste a 'otros'
2. Crear src/services/migrations/cleanupCategoriasT34T35fix2.ts · idempotente · solo 2 patrones documentados
3. Invocar cleanup desde App tras initDB() (igual patrón que T14.5)
4. Tests §2.3 (6 casos)

REGLAS
- DB_VERSION sin cambios
- NO corregir otras incoherencias · solo los 2 patrones documentados
- NO inventar reglas adicionales · si CC encuentra caso 3 sospechoso · reportar · NO arreglar
- 1 PR único contra main · stop-and-wait
- NO mergear sin autorización Jose

VERIFICACIÓN
- 6 tests pasan · tsc --noEmit pasa · App arranca
- Cleanup ejecuta primer arranque · skip silencioso siguientes (verificar en DevTools)
- Crear nuevo compromiso "Día a día · Otros" · categoría correcta
- Listado producción Jose · 14 compromisos · solo los 2 patrones detectados se corrigen · resto intacto

TIEMPO ESTIMADO CC real · 30-60 min
```

---

**Fin spec T34/T35-fix-2 · saneamiento limpio · 2 micro-bugs · 1 PR · stop-and-wait.**
