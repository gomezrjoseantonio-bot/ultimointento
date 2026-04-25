# ATLAS-mapa-54-stores · 9 abril 2026 · HISTÓRICO

> **NOTA DE PRESERVACIÓN** — Este documento es el registro histórico del estado de los stores de IndexedDB de AtlasHorizon DB tal y como existía aproximadamente el 9 de abril de 2026, según la descripción del briefing de auditoría del 25 de abril de 2026.
>
> El fichero original `ATLAS-mapa-54-stores.md` **no se encontró en el repositorio** en el momento de la auditoría (25 abril 2026). Este documento histórico ha sido reconstruido a partir de:
> - La descripción del briefing (`TAREA CC · Auditoría completa de stores · pre-reset v3`)
> - Los comentarios de versión en `src/services/db.ts`
> - El historial de git disponible (rama con shallow clone de 2 commits)
>
> **Estado de fiabilidad**: El número exacto de stores a 9 abril no se puede verificar con certeza. El briefing menciona "54 stores" y el título del mapa. La DB actual (25 abril) tiene DB_VERSION = 53 (V5.3) con 56 stores activos más 12 stores eliminados.

---

## Lo que se sabe del estado al 9 abril 2026

### Contexto de versión DB

Basado en los comentarios de versión en `src/services/db.ts`:

- **V5.3** (DB_VERSION = 53) es la versión actual a 25 abril 2026 e introdujo:
  - `compromisosRecurrentes` — unificación de `opexRules + patronGastosPersonales`
  - `viviendaHabitual` — nuevo store para módulo Personal
- **V5.2** introdujo `traspasosPlanes`
- **V4.3** introdujo `patronGastosPersonales` y `gastosPersonalesReal`

Por tanto, el 9 de abril (anterior a V5.3) el estado presumible era:
- `compromisosRecurrentes` — **NO EXISTÍA**
- `viviendaHabitual` — **NO EXISTÍA**
- `traspasosPlanes` — posiblemente existía (V5.2)
- Total estimado: ~54 stores (56 actuales - 2 nuevos de V5.3)

---

## Refactors en curso documentados en el briefing (al 9 abril)

### Refactor `gastosInmueble` fases A-F
- **Estado al 9 abril**: En curso o recién completado
- 4 stores fragmentados: `operacionesFiscales`, `expensesH5`, `gastos`, `fiscalSummaries`
- Meta: single source of truth en `gastosInmueble`
- **Según auditoría 25 abril**: COMPLETADO — los 4 stores fueron eliminados en V4.2

### Unificación `opexRules + compromisosRecurrentes` (G-01)
- **Estado al 9 abril**: Planificado, no ejecutado
- Plan: unificar en un store con discriminador `ambito: 'personal' | 'inmueble'`
- **Según auditoría 25 abril**: PARCIALMENTE completado en V5.3 — opexRules persiste como legacy

### Tesorería restructure
- **Estado al 9 abril**: En proceso
- Plan: eliminar `historicalTreasuryService`, `treasuryEvents` solo presente/futuro, `movements` deprecado
- **Según auditoría 25 abril**: COMPLETADO — `historicalTreasuryService.ts` no existe

### Investment form field fixes
- **Estado al 9 abril**: En revisión
- **Según auditoría 25 abril**: ACTIVO — `inversiones` store con `PosicionInversion` bien estructurado

---

## Bugs y GAPs documentados al 9 abril (del briefing)

| Issue | Descripción original |
|---|---|
| BUG-07 | `rentaMensual` proyección renta presente/futuro |
| BUG-08 | `ejerciciosFiscales` lifecycle vs `ejerciciosFiscalesCoord` |
| GAP-D1 | Plan pensiones → `ejecutarOnboardingPersonal` pasa `{} as any` |
| GAP-D2 | Préstamos detectados → `prestamos` solo esqueleto |
| GAP-D6 | Cuota líquida estatal/autonómica → `ejerciciosFiscalesCoord` resumen siempre 0 |
| GAP-P1 | Ventas inmuebles, acciones, fondos, crypto → `otrasTransmisiones: []` hardcoded |
| GAP-P2 | Entidades atribución (CB) → no existe función de extracción |
| GAP-P3 | Capital mobiliario → bug guardia nodo |
| GAP-P6 | Pérdidas base general, arrastres → solo extrae tipo 'ahorro' |

---

## Referencia para diff

Para el diff completo contra el estado al 25 abril 2026, ver:

`ATLAS-mapa-stores-VIGENTE.md` — Sección 3: Diff contra 9 abril

---

*Documento generado el 25 abril 2026 como parte de la auditoría de stores pre-reset v3.*
*Fuente primaria: briefing `TAREA CC · Auditoría completa de stores · pre-reset v3`*
