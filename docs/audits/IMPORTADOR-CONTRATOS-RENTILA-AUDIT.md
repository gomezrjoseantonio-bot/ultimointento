# Auditoría · Importador de contratos Rentila + plantilla ATLAS · Commit 1

> Verificación grep previa (§ 0.4 del spec) · reporte obligatorio (§ 0.5).
> Commit de auditoría · NO toca código de aplicación.

## Reporte de verificación (§ 0.5)

| Verificación | Resultado | Implicación |
|---|---|---|
| Pantalla `/inmuebles/importar-contratos` localizada | `src/modules/inmuebles/import/ImportarContratos.tsx` (montada en `App.tsx:821`) | Aquí se rehace el wizard de 4 pasos |
| Bug IBAN raro · línea exacta | `ImportarContratos.tsx:234-243` (`<select>` cuenta de cobro, label cae a `account.iban` en L241; también L156) | El literal `ES6100490052632210412715` **no está en código**: lo pinta el `<select>` desde los datos de cuentas del usuario. Es el selector "cuenta de cobro" residual junto al título. Eliminar en commit 2 |
| `saveContract` para creación programática | `saveContract(contract: Omit<Contract,'id'\|'createdAt'\|'updatedAt'>): Promise<number>` · `contractService.ts:93` | Reutilizable en commit 6/7 |
| `vincularContractABote` · firma actual | **No existe con ese nombre.** Existe `boteAnualService.vincularContract(boteId, contractId, importe, origen)` (manual) y `boteAnualService.sugerirContracts(boteId): Promise<SugerenciaVinculacion[]>` | Reutilizable como base; ver Blocker B |
| ¿Fuzzy match de inmuebles? | **Parcial.** `findPropertyByName` (substring bidireccional) en `contractsImportService.ts:90`. Levenshtein disponible en `autoDestinationService.ts:189`. No hay `sugerirInmueble` con confianza | Implementar `sugerirInmueble` con score en commit 4 |
| `Contract.inquilino.cotitulares` en schema | **Sí** · `db.ts:777` (V78) · `cotitulares?: string[]` | Confirmado |
| Estado `sin_firmar` en enum | **NO existe.** Enum = `'activo' \| 'rescindido' \| 'finalizado' \| 'sin_identificar'` (`db.ts:828`). Tampoco existe `pendiente` | **Blocker A** · decisión Jose: añadir `sin_firmar` al enum |
| Librería xlsx | **Sí** · `^0.18.5` (`package.json:47`), ya usada en 5+ módulos | Listo |
| ¿Parser Rentila previo? | **Sí, formato distinto.** `importContractsFromRentilaRows` + `RentilaImportRow` (`contractsImportService.ts`) y parser inline en la pantalla. Esperan plantilla custom (`Banco de cobro`, `Habitación`, `Comentarios`), **no las 12 columnas reales** de Rentila | Se aprovecha la lógica de mapeo; el parser de 12 columnas es nuevo (commit 3) |

## Extras detectados

- Mockup `docs/mockups/atlas-importer-contratos-v4.html` existe · docs decisiones/servicios existen.
- `public/templates/` **no existe** → se crea en commit 8.
- **No hay fixtures `.xlsx` reales** de Rentila en el repo → los tests construyen fixtures sintéticos en código.
- Pestaña "Por conciliar" existe (`TabPorConciliar.tsx`); la tab key actual es `conciliar` en `ContratosListPage`. El spec pide redirigir a `/contratos?tab=por-conciliar` → target exacto del botón paso 4 se confirma en commit 8.

## Blockers § 8 · resueltos con Jose

- **Blocker A — `sin_firmar` no está en el enum.** Decisión: **añadir `'sin_firmar'`** a la union `estadoContrato` (cambio type-only, sin bump de `DB_VERSION`) y asegurar que la lógica de estado lo trata como no-activo y totalmente editable. Reutilizar `sin_identificar` queda descartado (la migración V78 borra Contracts huérfanos con ese estado).
- **Blocker B — `postContractCreated` no existe.** Decisión: **construir `postContractCreated` nuevo** en commit 7. Tras crear cada Contract, busca botes del mismo inmueble/año y genera sugerencias vía `sugerirContracts` (NO auto-vincula). El paso 4 cuenta esas sugerencias.

## Plan de commits (stop-and-wait entre cada uno)

1. `chore(audit)` · este reporte (sin código de app). ← **estás aquí**
2. `fix(importer)` · eliminar selector IBAN/cuenta residual + preparar estructura wizard.
3. `feat(parsers)` · `rentilaParserService` (12 col) + `atlasTemplateParserService` (11 col).
4. `feat(normalizer)` · `ContractDraft` + mapeos + `sugerirInmueble` + cotitulares + duplicados.
5. `feat(ui)` · wizard pasos 1 (origen) y 2 (subida multi-fichero).
6. `feat(ui)` · paso 3 · 3 secciones con acciones por bloque.
7. `feat(creation)` · `crearContractsDesdeDrafts` + `postContractCreated` (nuevo) + `sin_firmar`.
8. `feat(ui)` · paso 4 + plantilla ATLAS estática + docs.
