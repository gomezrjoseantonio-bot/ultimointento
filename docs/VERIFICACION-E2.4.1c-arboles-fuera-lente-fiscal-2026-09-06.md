# VERIFICACIÓN · E2.4.1c · LOS CINCO ÁRBOLES FUERA · un solo catálogo y una lente fiscal encima

**Fecha:** 2026-09-06 · **Base:** `main` @ `6680ddc` (tras #1862) · **DB_VERSION:** 93 → **94** ·
**Rama:** `claude/audit-categories-types-scopes-p5966s` · Decisiones de Jose (5 sep 2026) aplicadas.

Objetivo: que sólo quede UN catálogo de clasificación (`catalogo/catalogoUnico.ts` · 4 ejes) y que la fiscalidad sea
una **lente** que se pone encima (`fiscal/lenteFiscal.ts`), retirando los árboles A (`categoryCatalog`), C
(`conceptos/`), D (`tiposDeGastoPersonal`) y E (`GastoCategoria`), sus traductores, y la bolsa 50/30/20. Cierra la
tríada E2.4.1 → 1b → 1c que Jose pidió antes de lanzar E2.4.2.

**Cómo leer las marcas:** VERIFICADO = leído/ejecutado · DEDUCIDO = inferido por grep.

---

## 0 · Lo esencial en diez líneas

1. **Un solo vocabulario de «qué es».** `CompromisoRecurrente`, `GastoInmueble`, `Movement`, `TreasuryEvent`,
   `MovementLearningRule`, `OpexRule`, `ItemPunteo` y `Document.metadata` llevan `familia?: FamiliaId` + `subtipo?:
   string` del catálogo único. Desaparecen `categoryKey`, `subtypeKey`, `categoryLabel`, `conceptoId` (árbol C),
   `categoria`, `tipo`, `tipoFamilia`, `familiaFiscalManual`, `bolsaPresupuesto` de las entidades.
2. **La lente fiscal existe** (`src/services/fiscal/lenteFiscal.ts` · 12 tests): `casillaDe(familia, subtipo, ámbito)`
   → casilla de gasto del Modelo 100 **sólo en ámbito inmueble**; `tratamientoDe` (directo · 3 % · 10 % · nada);
   `storeDestinoDe` (gasto · mejora · mueble); `fiscalidadDe` (la frase de la ficha); `clasificacionDeCasilla`
   (camino inverso para lo que entra por casilla). Sustituye a las cuatro tablas que no se ponían de acuerdo
   (`categoryCatalog.casillaAEAT`, `CATEGORIA_A_CASILLA`, `resolveCasillaAEAT`, `mapCasillaToCategoria`) y a
   `GASTOS_DECL.categoria`. El catálogo no la importa: la dependencia va fiscal → catálogo, nunca al revés.
3. **La casilla no se guarda por catálogo: la pone la lente al escribir una línea de inmueble.** `GastoInmueble.casillaAEAT?`
   es opcional (decisión Jose · §3.3 del preflight); `gastoDeducible` y el distribuidor saltan las líneas sin casilla.
   Un gasto de inmueble con familia sin casilla (`reforma_mejora`, `prestamo_hipoteca`, `otros`) nace sin ella, a
   propósito.
4. **Bolsa 50/30/20 fuera** (decisión Jose · ELIMINAR): `BolsaPresupuesto`, `bolsaPresupuesto`, `bolsaForCategoria` y
   la pantalla `PresupuestoPage` desaparecen; la ruta `/personal/presupuesto` redirige a `/mi-plan/proyeccion`. El
   presupuesto anual pierde el grupo «Deseos» (queda «Gastos personales»). Sin sustituto.
5. **Conceptos propios del usuario fuera** (§3.4 del preflight): `conceptosUsuarioService` y
   `catalogoPresentacionPersistencia` desaparecen; Ajustes → Conceptos pasa a ser una vista de sólo lectura de las 32
   familias del catálogo agrupadas por naturaleza.
6. **La derrama deja de preguntar.** Que un gasto de inmueble sea mejora es elegir la familia `reforma_mejora`
   (`FichaMovimiento`, `EditarRegistroInmuebleModal`); la lente lo manda a `mejorasInmueble`. La derrama de comunidad es
   `comunidad · derrama` = gasto (conservación).
7. **`financing`/préstamo:** el interés deducible (0105) sigue viniendo del cuadro; `prestamo_hipoteca` no tiene casilla
   en la lente (cargo entero · principio 6). El seguro de vida en inmueble → 0105 (financiación); la alarma → 0112.
8. **OPEX:** `OpexRule` conserva su fachada de 7 `OpexCategory` traducida desde la familia
   (`familiaDeOpexCategoria`/`opexCategoriaDeFamilia`); la siembra turística pasa de 16 a **15** conceptos (los
   «consumibles de bienvenida» caen en `gestion · otros`, que ya estaba).
9. **DB_VERSION 94:** `compromisosRecurrentes` retira los índices `tipo` y `categoria` y gana `familia`;
   `movementLearningRules` retira `categoria` y gana `familia`. Regla A: sin migración de datos; los tres scripts de
   migración de conceptos (`migrarConceptoUnificado`, `v68-tipoFamilia`, `cleanupCategoriasT34T35fix2`) se retiran.
10. `tsc` limpio · trinquete `todos_totales` 230 (= `main`) · `test:deadcode` OK · suite vs baseline en §4 · greps a
    cero en §2. Neto: **−7.150 líneas** (176 ficheros · 22 borrados).

---

## 1 · Qué cambia en las entidades (VERIFICADO)

| Entidad | Antes | Ahora |
|---|---|---|
| `CompromisoRecurrente` | `tipo: TipoCompromiso` · `categoria: CategoriaGastoCompromiso` · `concepto` · `bolsaPresupuesto` · `tipoFamilia` · `familiaFiscalManual` | `familia?: FamiliaId` · `subtipo?: string` (+ `metodoPago: MetodoPago`, `ambito` de 1/1b) |
| `GastoInmueble` | `categoria: GastoCategoria` · `casillaAEAT: AEATBox` · `categoryKey/subtypeKey` | `familia?` · `subtipo?` · `casillaAEAT?: AEATBox` (la pone la lente) |
| `MejoraInmueble` / `MuebleInmueble` | `categoryKey/subtypeKey` | sin clasificación de gasto (la tabla ya dice qué son) |
| `Movement` | `category`, `categoria`, `categoryKey`, `subtypeKey`, `conceptoId` | `familia?` · `subtipo?` (de 1b) |
| `TreasuryEvent` | `bolsaPresupuesto`, `categoryLabel`, `categoryKey`, `subtypeKey`, `conceptoId`, `tipoFamilia` | `familia?` · `subtipo?` |
| `MovementLearningRule` | `categoria: string` (indexado) | `familia?: FamiliaId` (indexado) · `subtipo?` |
| `OpexRule` | `categoria: OpexCategory` | + `familia?` · `subtipo?` (la fachada de 7 se traduce) |
| `Document.metadata` | `categoryKey/subtypeKey` | `familia?` · `subtipo?` |
| `ItemPunteo` | `categoryKey/subtypeKey` | `familia?` · `subtipo?` |
| `DocumentClassification` | `conceptoId` (árbol C) | `familia?` · `subtipo?` · `conceptoId?` = `familia[:subtipo]` (id de opción del selector, no un catálogo) |

## 2 · Preflight · lo que se repuntó (grep real · VERIFICADO)

| Qué | Prod | Cómo |
|---|---|---|
| Árbol A `categoryCatalog.ts` (`categoryKey`/`subtypeKey`/`categoryLabel`/`getCategoriesForModal`/`casillaAEAT`) | 0 | fichero borrado · lectores a `familia`/`subtipo` · casilla → `casillaDe` |
| Árbol C `conceptos/` (`catalogoConceptos`, `conceptosBase`, `conceptosUsuarioService`, `mapaLegacy`, `conceptoId`) | 0 (queda `conceptoId` como id `familia[:subtipo]` en `documentAutoClassifyService`/`InboxV3ExtractedPanel`/`InboxPage`: valor de un `<select>`, no un árbol) | carpeta borrada · `clasificacionDeId`/`idDeClasificacion` |
| Árbol D `tiposDeGastoPersonal.ts` · `familyMapping.ts` · `fiscalidadConcepto.ts` · `catalogoPresentacionPersistencia.ts` | 0 | borrados · `catalogoTipoGasto(ambito)` se reconstruye desde `familiasSugeridas('gasto', ámbito)` |
| Árbol E `GastoCategoria` · `CATEGORIA_A_CASILLA` · `resolveGastoCategoria` · `resolveCasillaAEAT` · `mapCasillaToCategoria` | 0 | `casillaDe` · `clasificacionDeCasilla` |
| Árbol B `TipoCompromiso` · `CategoriaGastoCompromiso` · `FamiliaFiscal` · `familiaFiscalManual` · `tipoFamilia` | 0 | `familia`/`subtipo` · la frase fiscal la da `fiscalidadDe` |
| Bolsa `BolsaPresupuesto` · `bolsaPresupuesto` · `bolsaForCategoria` · `PresupuestoPage` | 0 | retirados · redirección |
| Migraciones `migrarConceptoUnificado` · `v68-tipoFamilia` · `cleanupCategoriasT34T35fix2` | 0 | borradas (Regla A) |
| Índices `compromisosRecurrentes.tipo/categoria` · `movementLearningRules.categoria` | — | V94 |

(«0» = cero líneas de producción fuera de comentarios en `src/`, con `grep -w`.)

## 3 · Cambios de comportamiento (VERIFICADO · para que nadie los descubra por sorpresa)

- **Ajustes → Conceptos es de sólo lectura.** Los conceptos propios del usuario (crear/renombrar/ocultar) desaparecen
  con el árbol C. Se enseñan las 32 familias del catálogo con sus subtipos, agrupadas por naturaleza.
- **Presupuesto 50/30/20 desaparece.** `/personal/presupuesto` → `/mi-plan/proyeccion`. El presupuesto anual agrupa
  «Gastos personales» donde antes separaba «Hogar» y «Deseos» por bolsa.
- **Un gasto de inmueble puede nacer sin casilla.** Antes el catálogo la imponía; ahora la lente la calcula al escribir
  (`treasuryConfirmationService`, `altaMovimientoService`, `recurrentes`, `reglaResuelveSola`,
  `EditarRegistroInmuebleModal`, `documentAutoClassifyService`). Las familias sin casilla (`reforma_mejora` → tabla de
  mejoras · `prestamo_hipoteca` → cuadro · `otros`/personales → nada) no se restan. `gastoDeducible` y el distribuidor
  de la declaración **saltan** las líneas sin casilla en vez de fallar.
- **La derrama ya no pregunta «¿conservación o mejora?».** Mejora = familia `reforma_mejora` en un inmueble. Una
  derrama de comunidad es gasto.
- **Siembra OPEX turística: 15 en vez de 16.** «Consumibles de bienvenida» no es familia del catálogo único; cae en
  `gestion · otros`, que la siembra ya incluía.
- **La regla de aprendizaje guarda familia + subtipo**, no una `categoria` string; una regla vieja (Regla A) sin
  `familia` no se aplica, no se traduce.
- **El detector de compromisos** propone `familia`/`subtipo` (o nada: «sin clasificar»), no una categoría adivinada.
- **Las etiquetas del catálogo cambian** donde se enseñaban las viejas (p. ej. «Suministros» → «Suministro», «Tributos» →
  «Impuestos y tasas», «Seguros» → «Seguros y alarmas»). Es el DEFINITIVO; manda sobre lo anterior.

## 4 · Verificación

- `tsc --noEmit`: limpio.
- Trinquete local (`node scripts/health.mjs`): `todos_totales` 230 = `main` · `servicios_muertos` 0 ·
  `test:deadcode` OK (`dead 0`).
- Suite completa vs baseline de `main` (28 suites / 108 tests en rojo, pre-existentes): **24 suites /
  100 tests en rojo · ningún test nuevo en rojo · 4 suites · 9 tests del baseline pasan a verde** (`AddMovementModal`,
  `RowForm.concepto`, `FichaMovimiento`, `punteoAdapter`, ya rotos en `main` por el árbol B).
- Tests nuevos/reescritos: `fiscal/__tests__/lenteFiscal.test.ts` (12) · `RowForm.concepto` · `FichaMovimiento` ·
  `AddMovementModal` · `EditarRegistroInmuebleModal` · `groupByCatalog` · `groupingBlocks` · `conceptosASembrar` ·
  `sembrarOpexInmueble` · `catalogoModalidadInmueble` · `catalogoOpexUnaSolaVia` · `documentAutoClassifyService` ·
  `db.structure.v79` / `dbV92DuplicateKey` (esquema v94) · 60 ficheros de test más adaptados por barrido a
  `familia`/`subtipo`.
- **Lectores tipados `any` que `tsc` no veía** y se cazaron a grep: `estimacionFiscalEnCursoService.ts`
  (`evt?.categoryKey` → `evt?.familia`). Sigue siendo el argumento para retirar los `as any[]`.
- Greps a cero en `src/` (prod, fuera de comentarios): los 26 nombres de la tabla §2.

## 5 · DB_VERSION

93 → **94**. `compromisosRecurrentes`: `deleteIndex('tipo')` y `deleteIndex('categoria')` bajo guard
`indexNames.contains` + `ensureIndex('familia')`; `movementLearningRules`: `deleteIndex('categoria')` +
`ensureIndex('familia')`; en bases nuevas `createIndex('familia')` directo. Sin post-open, sin migración de datos
(Regla A). 47 stores igual que v93.

## 6 · Lo que queda fuera de 1c (para que nadie lo busque aquí)

- **MODELO §32.29–32.40**: no está en el repo; Jose lo manda cuando lo tenga. No se inventa.
- **`as any[]` en los servicios de dashboard/fiscal**: siguen; la lente los hace menos peligrosos (ya no hay campo viejo
  que leer en silencio), pero retirarlos es otra tarea.
- **`OpexRule.categoria` (fachada de 7)**: se conserva porque `OpexRuleForm` y el motor de proyección la consumen; la
  verdad es `familia`. Retirar la fachada es cosa de E2.4.2 si Jose lo pide.
