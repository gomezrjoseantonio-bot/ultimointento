# Estimación · convertir `AtlasHorizonDB` a un `DBSchema` real

> Encargo de Jose (bloque 2.5, diferido): **solo estimación, sin tocar código.**
> Contexto: el bloque 2.5 pedía "tipar 3 stores y que TypeScript valide ~40 usos".
> Se descubrió que **no puede funcionar**: la interfaz `AtlasHorizonDB` NO extiende
> `DBSchema`, así que `StoreNames` colapsa a `string` y `StoreValue` a `any`. El
> compilador no valida hoy **ningún** nombre de store ni forma de registro.
> Verificado empíricamente: asignar `'__no_existe__'` a `StoreNames<AtlasHorizonDB>`
> compila; quitar 7 claves de la interfaz dio 0 errores de `tsc`.

Este documento estima el coste de convertirla a un `DBSchema` de verdad, que es lo
único que daría seguridad real y destaparía las incoherencias que el bloque 2.5
buscaba.

---

## Qué exige un `DBSchema` real

Hoy cada clave es un tipo de dominio plano:

```ts
interface AtlasHorizonDB {
  accounts: Account;              // ← valor = tipo de dominio
  ...
}
```

Un `DBSchema` de idb exige que **cada valor** tenga la forma `{ key; value; indexes }`:

```ts
interface AtlasHorizonDB extends DBSchema {
  accounts: {
    key: number;                  // tipo del keyPath (autoIncrement → number)
    value: Account;               // el registro
    indexes: { 'alias': string; 'address': string };  // nombre → tipo de la clave del índice
  };
  ...
}
```

Solo cuando **las 45 claves** tienen esa forma, `AtlasHorizonDB extends DBSchema`
se cumple y `StoreNames`/`StoreValue`/`IndexNames` pasan a ser reales.

---

## 1 · Cuántos valores hay que reformar

| Concepto | Nº |
|---|---:|
| Stores a reformar (42 en la interfaz + 3 sin tipar) | **45** |
| Índices a declarar (`createIndex` en `db.ts`) | **154** |
| `keyPath` a mapear a tipo de clave (30 con `autoIncrement`=number, resto string/compuesto) | **~45** |

Reformar = por cada store, envolver el tipo de dominio en `{ key; value; indexes }`,
deduciendo el tipo de `key` del `keyPath`/`autoIncrement` y listando sus índices con
el tipo de la clave de cada uno (algunos son compuestos, p. ej. `['propertyId','status']`
→ `[string, string]`).

**Trabajo mecánico pero no trivial**: 45 stores × (1 key + 1 value + N índices) con
154 índices repartidos. Los índices compuestos y los `keyPath` string-vs-number son
donde se cometen errores al declarar.

## 2 · Cuántos errores estimo que salen

No es medible sin ejecutar la conversión; doy un rango razonado con su método.

**Superficie afectada (medida hoy):**
- **1.159** call-sites `db.get/getAll/put/add/delete/count/…/transaction` en `src` (sin tests).
- **31** de esos call-sites llevan `as any` / `as unknown as` **en la misma línea** —
  fudge de forma explícito: existen *porque* los tipos no cuadran. Son sitios de
  error casi garantizados al tipar.
- **559** `as any`/`as unknown as` totales en `src` (sin tests) como proxy amplio.

**Estimación por fases (ver §4):**
- **Fase 0** (reformar todo a `value: any`): activa la validación de **nombres** de
  store e índice, no de valores. Errores esperados: **bajos (0–15)** — typos y
  referencias obsoletas a stores ya renombrados/eliminados. *Precedente real: hoy
  ya encontré uno de este tipo* (`planesPensionesService.eliminarPlan` leía
  `valoraciones_historicas`, store inexistente → `NotFoundError`; corregido en bloque 2.4).
  Es plausible que haya más de ese patrón.
- **Fases 1+** (endurecer `value: any` → tipo real, por store): el grueso.
  - Piso duro: **~31** (los casts de misma línea).
  - Techo razonable: **~120–150**, si la tasa de desajuste en los 1.159 call-sites
    ronda el 10 %. Se concentran en put/add con objetos incompletos y en
    `getAllFromIndex` con claves compuestas mal tipadas.
  - **Banda de trabajo: ~40–150 errores reales**, la mayoría en los ~15 servicios
    de más densidad (ver §3).

**Cada error es un hallazgo** (un sitio que escribe algo distinto de lo que otro lee),
exactamente lo que el bloque 2.5 quería destapar. El número exacto solo se sabe
haciendo la Fase 0 + endurecer **un** store representativo y extrapolar; ofrezco
hacer eso como primera sub-tarea cuando se autorice.

## 3 · Qué servicios se ven afectados

**241 archivos** (sin tests) tocan la DB. La conversión no rompe los 241 a la vez si
se hace por fases, pero el arreglo de errores se concentra en los de más densidad:

| Archivo | call-sites |
|---|---:|
| `db.ts` (interno) | 32 |
| `treasuryApiService.ts` | 31 |
| `declaracionDistributorService.ts` | 25 |
| `treasuryForecastService.ts` | 24 |
| `migrations/migrateOrphanedInmuebleIds.ts` | 22 |
| `bankStatementOrchestrator.ts` | 21 |
| `cuentasService.ts` | 20 |
| `objetivosService.ts` (4 casts) | 18 |
| `fondosService.ts` | 18 |
| `treasuryConfirmationService.ts` | 17 |
| `boteAnualService.ts` | 16 |
| `presupuestoService.ts` | 16 |
| `benchmarksReferenciaService.ts` | 15 |
| `propertySaleService.ts` | 14 |
| `fiscalSummaryService.ts` | 14 |

Los stores con más lectores/escritores (tesorería: `movements`/`accounts`/`treasuryEvents`;
fiscal: `documents`/`ingresos`/`gastosInmueble`; financiación: `prestamos`) son los que
más errores concentrarán al endurecerse.

## 4 · ¿Por tandas o todo o nada?

**Se puede por tandas**, con un truco estructural:

- El `extends DBSchema` es **atómico**: no se cumple hasta que **las 45** claves tienen
  forma `{ key; value; indexes }`. No se puede convertir "media interfaz".
- PERO `value` puede ser `any` y seguir siendo un `DBSchemaValue` válido. Entonces:

  - **Fase 0 · atómica, ~0 errores de valor**: reformar las 45 claves a
    `{ key; value: any; indexes }`. Con esto `extends DBSchema` ya se cumple y se
    activa la validación de **nombres** de store e índice en los 1.159 call-sites,
    sin tocar los valores. Aquí afloran los typos/stores-fantasma (banda 0–15).
  - **Fases 1..N · por grupo de stores**: cambiar `value: any` → tipo de dominio
    real, un grupo por PR (p. ej. tesorería / fiscal / inmuebles / planes /
    inversiones / resto), resolviendo solo los errores de ESE grupo. Totalmente
    escalonable y revisable.

Es decir: **la reforma de la interfaz es atómica (Fase 0, un PR), el endurecimiento
de tipos es por tandas (N PRs por grupo funcional).** Nada de un big-bang de 150
errores a la vez.

**Coste de arranque mínimo**: Fase 0 sola ya elimina la mentira estructural (los
nombres pasan a validarse) y es de bajo riesgo. Recomendaría empezar por ahí y medir
los errores reales del primer grupo antes de comprometer el resto.

---

## Prerrequisitos / riesgos

- **DB_VERSION no cambia**: es tipado, no esquema. Nada de esto toca la base física.
- No confundir con "trocear `db.ts`": esto reforma la **interfaz** de tipos, no
  reorganiza el monolito de upgrade.
- Los `keyPath` string-vs-number y los índices compuestos son la fuente principal de
  errores *de declaración* (distintos de los hallazgos de datos). Conviene una tabla
  keyPath↔tipo antes de empezar.
- El número real de errores solo se conoce ejecutando Fase 0 + un grupo. La banda
  ~40–150 es una estimación con método, no una medición.
