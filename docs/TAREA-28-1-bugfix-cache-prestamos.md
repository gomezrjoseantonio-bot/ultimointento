# TAREA CC · TAREA 28.1 · Bugfix `autoMarcarCuotasPagadas` + commit documento arquitectura Financiación

> **Tipo** · bugfix corto + commit doc · 1 PR único · stop-and-wait al cerrar
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama madre `main`
>
> **Predecesor** · auditoría 2026-05-02 (`docs/AUDIT-financiacion-cuotas-2026-05-02.md` · si está mergeada · si no · ya no la necesitamos · este PR la sustituye con resultados)
>
> **Tiempo estimado** · 1-1.5h CC · 30min revisión Jose
>
> **DB** · NO se toca schema · NO se sube DB_VERSION · sigue en 65 · 40 stores
>
> **Riesgo** · bajo · bugfix puntual con verificación clara · sin cambio arquitectónico · sin migración
>
> **Output** · 1 PR contra `main` con · 1 doc nuevo (`docs/ARQUITECTURA-financiacion.md`) + bugfix en `prestamosService.ts` + cableado en `FinanciacionPage.load()` para datos pre-fix + tests

---

## 0 · INSTRUCCIONES INVIOLABLES · LEER ANTES DE EMPEZAR

### 0.1 · El documento de arquitectura es LEY

Jose adjunta `ARQUITECTURA-financiacion.md` al prompt. Ese documento define las reglas duras del módulo Financiación. **Cualquier código que CC escriba o modifique en T28.1 debe respetar estas reglas:**

- §1.4 · NO crear préstamos desde XML AEAT (no aplica aquí · solo para futuro)
- §4.3 · **NO crear `movements` al alta del préstamo** · si CC siente la tentación de "arreglar el bug propagando cuotas a movements" · ESO NO ES T28.1 · es regresión
- §4.4 · **NO crear `treasuryEvents` para cuotas pasadas** · misma regla
- §5.2 · KPIs siempre derivados · cache es proyección · esta es exactamente la regla que T28.1 está haciendo cumplir

### 0.2 · Alcance de T28.1 · qué SÍ y qué NO

CC trabaja **solo** en:

✅ Bugfix de `autoMarcarCuotasPagadas` · función pura derivada que actualiza cache `cuotasPagadas` y `principalVivo` independientemente de si los flags cambiaron
✅ Llamar la función al cargar la lista en `FinanciacionPage.load()` para que datos creados antes del fix se actualicen al primer render
✅ Tests unitarios mínimos sobre el caso del bug (todos los flags ya en true · cache desactualizado · tras fix · cache correcto)
✅ Commit del documento `docs/ARQUITECTURA-financiacion.md`

CC tiene **PROHIBIDO**:

❌ Crear `movements` para cuotas pasadas
❌ Crear `treasuryEvents` para cuotas pasadas
❌ Imputar intereses a `gastosInmueble` automáticamente
❌ Reescribir `CuadroAmortizacion.tsx` legacy (ese es T28.4 separado)
❌ Eliminar el hook zombie `useAutoMarcarCuotas` (eso es T28.4 separado)
❌ Tocar el cálculo francés en `prestamosCalculationService` (no es bug ahí)
❌ Tocar `LoanSettlementModal` (T28.6 separado)
❌ Refactor colateral en otros módulos
❌ Migración de schema · subir DB_VERSION

### 0.3 · Reglas técnicas duras

- TypeScript estricto · cero `any` · cero `as any` nuevos
- Servicios canónicos · escribir en stores SOLO vía servicio dedicado
- NO Tailwind · seguir convención CSS del repo
- Tests · usar el framework que el repo tenga (vitest o jest · verificar)

### 0.4 · Stop-and-wait

CC abre PR · publica · **DETIENE** · espera revisión Jose en deploy preview · NO empieza ninguna tarea posterior. Si CC encuentra ambigüedad · PARAR · comentar en PR · esperar input · NO inventar.

### 0.5 · Doctrina de bloqueo

- Contradicción mayor entre spec y código real → PARAR · reporte estructurado en PR
- Desviación menor → adaptar · documentar en sección "Cambios respecto al spec" del PR
- "Cambios respecto al spec" debe ser exhaustivo · cero desviaciones silenciosas

---

## 1 · Etapa A · verificación previa de contexto

Antes de escribir código · CC ejecuta y reporta:

### A.1 · Verificar el bug

```bash
# Ver el código actual de autoMarcarCuotasPagadas
sed -n '640,690p' src/services/prestamosService.ts
```

CC reporta:

- Confirmar que existe el `if (!changed) return prestamo` (o equivalente) que salta la actualización del cache
- Confirmar que la lógica que actualiza `prestamo.cuotasPagadas` y `prestamo.principalVivo` está DESPUÉS del `if (!changed) return`
- Si el código real difiere de lo descrito en la auditoría · documentar la diferencia

### A.2 · Verificar consumidores del cache

```bash
# ListadoPage que pinta "X/Y cuotas"
grep -n "cuotasPagadas\|principalVivo" src/modules/financiacion/pages/ListadoPage.tsx
grep -n "cuotasPagadas\|principalVivo" src/modules/financiacion/helpers.ts

# Panel V5 card Financiación
grep -n "principalVivo\|cuotasPagadas" src/modules/panel/PanelPage.tsx

# FinanciacionPage que carga la lista
cat src/modules/financiacion/FinanciacionPage.tsx | head -100
```

CC reporta:

- Path exacto donde `loanRowFromPrestamo` lee `cuotasPagadas` y `principalVivo`
- Cómo `FinanciacionPage.load()` carga los préstamos · función que llama al service
- Si existe un punto natural para llamar `autoMarcarCuotasPagadas` (o función equivalente que recalcule cache) durante la carga del listado

### A.3 · Verificar tests existentes

```bash
# Tests sobre prestamosService
find src -name "*.test.ts" -o -name "*.spec.ts" | xargs grep -l "prestamosService\|autoMarcarCuotasPagadas" 2>/dev/null
ls src/services/__tests__/ 2>/dev/null | grep -i prestamo
```

CC reporta:

- Si hay tests de `autoMarcarCuotasPagadas` actualmente · path
- Framework de tests del repo (vitest o jest)

### A.4 · Confirmar el documento adjunto

CC abre `ARQUITECTURA-financiacion.md` (Jose lo adjunta · si no está · pedirlo) y confirma que:

- [ ] Documento tiene 12 secciones desde "Por qué existe este documento" hasta "Otros módulos con decisiones análogas pendientes"
- [ ] §5 trata KPIs derivados vs cache · es la sección que justifica este bugfix
- [ ] §9 lista el bug del cache como T28.1 · 30min-1h
- [ ] §7 lista anti-patrones que CC debe respetar

Si alguno NO está · PARAR · pedir el documento correcto.

---

## 2 · Etapa B · estructura archivos

### B.1 · Archivos a crear

```
docs/ARQUITECTURA-financiacion.md                                   (documento canónico · contenido pegado tal cual del adjunto Jose · sin recortar)
src/services/__tests__/autoMarcarCuotasPagadas.test.ts              (tests unitarios mínimos del bugfix · si el repo usa otro path para tests · adaptar)
```

### B.2 · Archivos a modificar

```
src/services/prestamosService.ts                                     (bugfix · función autoMarcarCuotasPagadas)
src/modules/financiacion/FinanciacionPage.tsx                        (cableado · llamar al cargar lista para datos pre-fix)
```

### B.3 · Archivos que NO se tocan

❌ Cualquier archivo fuera de los 4 listados arriba
❌ `src/services/db.ts` · DB intacta
❌ `src/services/prestamosCalculationService.ts` · cálculo francés correcto · no se toca
❌ `src/modules/financiacion/pages/ListadoPage.tsx` · solo lee cache · al arreglarse el cache se arreglan los KPIs
❌ `src/modules/panel/PanelPage.tsx` · misma razón · al arreglarse el cache se arreglan los KPIs
❌ `src/modules/financiacion/helpers.ts` · `loanRowFromPrestamo` lee cache · se arreglará solo
❌ `CuadroAmortizacion.tsx` legacy · T28.4 separado
❌ Hook `useAutoMarcarCuotas` zombie · T28.4 separado

---

## 3 · Etapa C · commit del documento de arquitectura

### C.1 · Crear `docs/ARQUITECTURA-financiacion.md`

Pegar contenido EXACTO del archivo adjunto por Jose. CC NO modifica nada · solo pega.

**Verificación etapa C** · archivo creado en ruta exacta · contenido idéntico al adjunto · sin recortar · sin reformatear · sin "TODO completar" en ninguna parte. Tabla de §9 backlog presente.

---

## 4 · Etapa D · bugfix `autoMarcarCuotasPagadas`

### D.1 · Diagnóstico (de la auditoría)

Comportamiento actual aproximado:

```typescript
// src/services/prestamosService.ts:649 (aprox)
async autoMarcarCuotasPagadas(prestamoId: string): Promise<Prestamo> {
  const prestamo = await this.getPrestamo(prestamoId);
  if (!prestamo) throw new Error('Prestamo no encontrado');

  const plan = await this.getPaymentPlan(prestamoId);
  if (!plan) return prestamo;

  const today = new Date();
  let changed = false;

  for (const periodo of plan.periodos) {
    if (!periodo.pagado && new Date(periodo.fechaCargo) <= today) {
      periodo.pagado = true;
      periodo.fechaPagoReal = periodo.fechaCargo;
      changed = true;
    }
  }

  if (!changed) return prestamo;   // ← BUG · salta actualización del cache

  // ↓ código que actualiza cuotasPagadas y principalVivo
  await this.savePaymentPlan(prestamoId, plan);
  prestamo.cuotasPagadas = plan.periodos.filter(p => p.pagado).length;
  // ... última cuota pagada → principalVivo
  await this.savePrestamo(prestamo);
  return prestamo;
}
```

**Causa del bug** · cuando `createPrestamo` ya marcó periodos pasados como `pagado=true` antes de llamar a `autoMarcarCuotasPagadas` · el bucle no encuentra nada que cambiar · `changed=false` · retorna sin actualizar cache. Cache queda en `cuotasPagadas=0` · `principalVivo=principalInicial` indefinidamente.

### D.2 · Fix

CC modifica la función para **separar el marcado del recálculo del cache**. Pseudo:

```typescript
async autoMarcarCuotasPagadas(prestamoId: string): Promise<Prestamo> {
  const prestamo = await this.getPrestamo(prestamoId);
  if (!prestamo) throw new Error('Prestamo no encontrado');

  const plan = await this.getPaymentPlan(prestamoId);
  if (!plan) return prestamo;

  const today = new Date();
  let planChanged = false;

  // Paso 1 · marcar cuotas pasadas como pagadas si no lo están
  for (const periodo of plan.periodos) {
    if (!periodo.pagado && new Date(periodo.fechaCargo) <= today) {
      periodo.pagado = true;
      periodo.fechaPagoReal = periodo.fechaCargo;
      planChanged = true;
    }
  }

  if (planChanged) {
    await this.savePaymentPlan(prestamoId, plan);
  }

  // Paso 2 · recalcular cache SIEMPRE · independientemente de si el plan cambió
  // (cumple §5.2 del documento de arquitectura · cache es proyección de función pura)
  const nuevoCache = derivarCachePrestamo(plan, prestamo.principalInicial);
  
  const cacheChanged =
    prestamo.cuotasPagadas !== nuevoCache.cuotasPagadas ||
    prestamo.principalVivo !== nuevoCache.principalVivo ||
    prestamo.fechaUltimaCuotaPagada !== nuevoCache.fechaUltimaCuotaPagada;

  if (cacheChanged) {
    prestamo.cuotasPagadas = nuevoCache.cuotasPagadas;
    prestamo.principalVivo = nuevoCache.principalVivo;
    prestamo.fechaUltimaCuotaPagada = nuevoCache.fechaUltimaCuotaPagada;
    prestamo.updatedAt = new Date().toISOString();
    await this.savePrestamo(prestamo);
  }

  return prestamo;
}
```

CC adapta firma exacta de `getPrestamo` · `getPaymentPlan` · `savePaymentPlan` · `savePrestamo` a lo que exista en el repo (verificar A.1 / A.2). Nombres de campos según el `Prestamo` real.

### D.3 · Función pura derivada · `derivarCachePrestamo`

CC extrae la lógica de cálculo del cache a función pura · ubicada en el mismo `prestamosService.ts` o en un util adyacente. Firma:

```typescript
interface CachePrestamoDerivado {
  cuotasPagadas: number;
  principalVivo: number;
  fechaUltimaCuotaPagada?: string;
}

function derivarCachePrestamo(
  plan: PlanPagos,
  principalInicial: number
): CachePrestamoDerivado {
  const pagadas = plan.periodos.filter(p => p.pagado);
  const cuotasPagadas = pagadas.length;

  // principalVivo = principalFinal de la última cuota pagada · si no hay ninguna · principalInicial
  let principalVivo = principalInicial;
  let fechaUltimaCuotaPagada: string | undefined;
  if (pagadas.length > 0) {
    const ultima = pagadas[pagadas.length - 1];
    principalVivo = ultima.principalFinal;
    fechaUltimaCuotaPagada = ultima.fechaPagoReal ?? ultima.fechaCargo;
  }

  return { cuotasPagadas, principalVivo, fechaUltimaCuotaPagada };
}
```

Esta función pura es lo que §5.2 del documento llama "función derivada source of truth". Cualquier vista futura puede usarla directamente sobre el plan · sin depender del cache.

**Importante** · si el repo ya tiene una función similar con otro nombre · CC la reutiliza. NO duplicar.

### D.4 · Verificación etapa D

- [ ] `tsc --noEmit` · 0 errores nuevos
- [ ] Búsqueda manual · `if (!changed) return` o equivalente eliminado de `autoMarcarCuotasPagadas`
- [ ] Función `derivarCachePrestamo` (o nombre adoptado) extraída · pura · sin acceso DB
- [ ] `marcarCuotaManual` · si tenía lógica duplicada de cálculo de cache · refactorizar para usar `derivarCachePrestamo` · si no la tenía · dejar como está

---

## 5 · Etapa E · cableado en `FinanciacionPage.load()`

### E.1 · Razón

Datos creados antes del fix tienen el cache desactualizado en IndexedDB. Si solo arreglamos la función · los préstamos antiguos siguen mal hasta que el usuario los edite. Hay que llamar a `autoMarcarCuotasPagadas` al cargar el listado · una vez · de forma que el cache se sincronice automáticamente.

### E.2 · Implementación

`src/modules/financiacion/FinanciacionPage.tsx` · función `load()` (línea aproximada según A.2). CC añade tras cargar la lista de préstamos · un bucle que llama `prestamosService.autoMarcarCuotasPagadas(p.id)` para cada préstamo activo. Espera resultados · usa los préstamos retornados para el estado local en lugar de los originales.

Pseudo:

```typescript
async function load() {
  const list = await prestamosService.listPrestamos();
  
  // Sincronizar cache de cada préstamo con su plan (ver doc arquitectura §5.2)
  // Necesario para corregir datos creados antes del fix de T28.1
  const sincronizados = await Promise.all(
    list.map(p => prestamosService.autoMarcarCuotasPagadas(p.id))
  );
  
  setPrestamos(sincronizados);
  
  const planEntries = await Promise.all(
    sincronizados.map(async (p) => {
      const plan = await prestamosService.getPaymentPlan(p.id);
      return [p.id, plan] as const;
    }),
  );
  setPlanes(new Map(planEntries));
}
```

**Importante** · si el listado es grande (10+ préstamos) y `autoMarcarCuotasPagadas` hace IO · esto puede tardar. Si CC ve que es problema de performance · reportar y dejar sin paralelización agresiva. Pero para ≤10 préstamos no debería notarse.

### E.3 · Verificación etapa E

- [ ] `FinanciacionPage.load()` llama a `autoMarcarCuotasPagadas` por préstamo
- [ ] Estado local se actualiza con los préstamos sincronizados
- [ ] No se rompen consumidores del estado local

---

## 6 · Etapa F · tests

### F.1 · Tests mínimos requeridos

CC crea `src/services/__tests__/autoMarcarCuotasPagadas.test.ts` (o ruta equivalente · adaptar a convención del repo) con al menos 3 tests:

**Test 1 · escenario del bug · todos los flags ya en true**

- Setup · préstamo con plan · todos los periodos pasados con `pagado=true` (simulando estado tras `createPrestamo`)
- Cache inicial · `cuotasPagadas=0` · `principalVivo=principalInicial` (estado roto)
- Acción · llamar `autoMarcarCuotasPagadas`
- Verificación · `prestamo.cuotasPagadas === N pagadas` · `prestamo.principalVivo === planFinal[N-1].principalFinal`
- **Este test fallaría con el bug actual y debe pasar tras el fix**

**Test 2 · escenario normal · flag cambia · cache se actualiza**

- Setup · préstamo con plan · una cuota pasada con `pagado=false`
- Cache inicial · sincronizado con flags actuales
- Acción · llamar `autoMarcarCuotasPagadas`
- Verificación · cuota marcada `pagado=true` · cache actualizado correctamente

**Test 3 · escenario sin cambios · ningún periodo pasado · cache correcto · no se modifica**

- Setup · préstamo recién firmado · primera cuota futura
- Cache · `cuotasPagadas=0` · `principalVivo=principalInicial` (correcto)
- Acción · llamar `autoMarcarCuotasPagadas`
- Verificación · cache permanece igual · no se llama `savePrestamo` innecesariamente (opcional · pero útil para validar que no escribe sin razón)

### F.2 · Test 4 (opcional · si tiempo) · función pura derivada

Test directo a `derivarCachePrestamo` · sin DB · verifica:
- Plan vacío · cache = principal inicial · cuotasPagadas=0
- Plan con 5 pagadas · cache = principalFinal de la 5ª pagada · cuotasPagadas=5
- Plan con cuotas pagadas no consecutivas (caso edge) · cuotasPagadas = total pagadas independiente del orden · principalVivo = principalFinal de la última pagada por índice

### F.3 · Verificación etapa F

- [ ] Tests creados con framework del repo (vitest o jest según A.3)
- [ ] Tests pasan en local · CC ejecuta y reporta resultado
- [ ] Cobertura · al menos los 3 tests críticos · 4 si tiempo permite

---

## 7 · Verificación final completa T28.1

CC ejecuta y reporta:

### Build
- [ ] `tsc --noEmit` · 0 errores nuevos
- [ ] `npm run build` · pasa
- [ ] Tests unitarios · todos verdes
- [ ] App arranca en deploy preview sin errores en consola

### Funcional
- [ ] Listado Financiación · préstamos con cuotas pasadas muestran `Amortizado · X/300 cuotas` con X correcto (no 0)
- [ ] Listado Financiación · `% amortizado` correcto
- [ ] Listado Financiación · `Capital vivo` correcto · NO igual a `principalInicial` cuando hay cuotas pagadas
- [ ] Panel V5 · card Financiación · `DEUDA VIVA` muestra cifra real (no suma de capitales iniciales)
- [ ] Panel V5 · `Cuota mes` y otros KPIs derivados se ven coherentes
- [ ] Detalle préstamo · cuadro de amortización sigue pintando estados Pagada/En curso/Pendiente correctamente (no debería cambiar · solo verificación)

### Datos en producción · Jose
Tras merge y deploy · Jose abre el listado de Financiación. Espera ver:
- FA32 · ~14% amortizado · ~41 cuotas pagadas · capital vivo ~47.000 €
- Tenderina 48 · proporcional según firma
- Resto de préstamos · cifras coherentes con sus planes

### Reglas de scope
- [ ] CERO archivos modificados fuera de los 4 listados en B.2
- [ ] CERO `movements` creados automáticamente (§4.3 documento arquitectura)
- [ ] CERO `treasuryEvents` para cuotas pasadas (§4.4 documento arquitectura)
- [ ] CERO imputación a `gastosInmueble` (§6.3 documento arquitectura)
- [ ] DB_VERSION 65 intacto

---

## 8 · PR

**Rama** · `claude/t28-1-bugfix-cache-prestamos`

**Título PR** · `fix(financiacion): T28.1 cache cuotasPagadas/principalVivo siempre derivado del plan + doc arquitectura módulo`

**Body PR**:

```
## Resumen

T28.1 corrige el bug de cache en `autoMarcarCuotasPagadas` que dejaba el listado y el Panel mostrando 0 cuotas pagadas y capital vivo igual al inicial. Causa raíz · la función retornaba early cuando los flags ya estaban en true (caso post-`createPrestamo`) sin actualizar el cache.

Adicionalmente · commitea el documento canónico de arquitectura del módulo Financiación que cierra decisiones dispersas y establece reglas duras para trabajo futuro.

## Cambios

### Documento canónico
- ✨ `docs/ARQUITECTURA-financiacion.md` · vías de entrada · matching bidireccional · KPIs derivados · separación verdad operacional/fiscal · anti-patrones · backlog

### Bugfix
- 🐛 `src/services/prestamosService.ts` · `autoMarcarCuotasPagadas` · cache se recalcula SIEMPRE · independientemente de si los flags cambiaron en esa llamada · cumple §5.2 del documento de arquitectura
- ✨ Función pura `derivarCachePrestamo(plan, principalInicial)` extraída · source of truth para cualquier vista futura

### Cableado retroactivo
- ✏️ `src/modules/financiacion/FinanciacionPage.tsx` · `load()` llama `autoMarcarCuotasPagadas` por préstamo · sincroniza cache de datos creados antes del fix

### Tests
- ✨ `src/services/__tests__/autoMarcarCuotasPagadas.test.ts` · 3-4 tests · escenario bug · escenario normal · escenario sin cambios · función pura

## NO toca

- ❌ DB schema (V65 intacto)
- ❌ `movements` (§4.3 doc arquitectura)
- ❌ `treasuryEvents` (§4.4 doc arquitectura)
- ❌ `gastosInmueble` (§6.3 doc arquitectura)
- ❌ Cuadro de amortización ni `prestamosCalculationService` (cálculo francés correcto)
- ❌ `CuadroAmortizacion.tsx` legacy · T28.4 separado
- ❌ Hook zombie `useAutoMarcarCuotas` · T28.4 separado
- ❌ `LoanSettlementModal` · T28.6 separado

## Cambios respecto al spec

(CC documenta aquí cualquier desviación · si no hay · "Cero · implementación literal del spec")

## Verificación

- [x] tsc --noEmit · 0 errores
- [x] npm run build · pasa
- [x] Tests verdes (X/X)
- [x] Listado Financiación muestra cuotas pagadas correctas
- [x] Panel V5 · DEUDA VIVA correcta
- [x] CERO movements/treasuryEvents creados
- [x] DB_VERSION 65 intacto

**STOP-AND-WAIT** · Jose valida en deploy preview y mergea cuando OK.

## Validación esperada por Jose tras merge

Ver en producción:
- FA32 · ~14% amortizado · ~41 cuotas pagadas · capital vivo ~47.000 €
- Resto de préstamos · cifras coherentes con sus planes
- Panel · DEUDA VIVA inferior a la suma de capitales iniciales
```

**NO mergear.** Esperar Jose.

---

## 9 · Si CC encuentra bloqueo

Casos previstos:

1. **El código real de `autoMarcarCuotasPagadas` difiere significativamente del descrito en auditoría** → CC PARA · documenta diferencias · Jose decide si el fix sigue siendo válido o cambia.

2. **`derivarCachePrestamo` ya existe como función pura en otro sitio** → CC reutiliza · NO duplica · documenta path.

3. **`FinanciacionPage.load()` no existe o tiene otro nombre** → CC busca el equivalente · path real · documenta.

4. **`marcarCuotaManual` también tiene bug similar de cache** → CC reporta · NO arregla aquí · puede ir en T28.1bis si Jose autoriza.

5. **Los tests del repo usan otro framework distinto a vitest/jest** → CC adapta · usa lo que el repo tenga.

6. **Build falla por razón ajena al fix** → PARAR · NO arreglar build legacy · documentar.

7. **Performance del bucle en `load()` es problema con muchos préstamos** → CC reporta · puede dejar sin paralelización agresiva · Jose decide optimización.

**En ningún caso CC inventa código fuera del scope · NO crea movements · NO crea treasuryEvents · NO mergea sin autorización Jose.**

---

## 10 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- DB_VERSION 65 · 40 stores · estable
- **Documento adjunto · `ARQUITECTURA-financiacion.md`** · LEY ARQUITECTÓNICA del módulo
- `docs/AUDIT-financiacion-cuotas-2026-05-02.md` (si está mergeado · referencia diagnóstica)
- `docs/HANDOFF-V8-atlas.md`
- 3 capturas adjuntas en sesión anterior (Panel · Listado · Detalle préstamo FA32)

---

## 11 · Resumen ejecutivo

> Arregla el bug del cache de `autoMarcarCuotasPagadas`. Cache siempre derivado · independiente de si los flags cambiaron. Llama la función al cargar el listado para datos pre-fix. Tests mínimos. Commit del documento de arquitectura adjunto. NO crees movements. NO crees treasuryEvents. NO toques `gastosInmueble`. NO refactoríces nada más. 1 PR · stop-and-wait. Cuando lo abras · lo reviso en deploy preview.

---

**Fin spec T28.1 · 1 PR · stop-and-wait · 1-1.5h CC.**
