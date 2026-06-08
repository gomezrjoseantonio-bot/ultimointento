# AUDIT · FIX onboarding · PUNTO 2 · bloque inmuebles

> Commit 1 · `chore(audit)` · solo grep · cero código. Verificación §1 de `TAREA-CC-onboarding-dia0-v1.md` (PUNTO 2).

## Tabla de hallazgos

| # | Problema | Resultado · path:líneas | Veredicto |
|---|---|---|---|
| P1 | Vía manual saca del flujo | `InmueblesBloque.tsx:60` → `navigate('/inmuebles/nuevo')`. `InmueblePage` (`pages/inmuebles/InmueblePage.tsx`) es **página acoplada a la ruta** (1686 líneas · solo prop `mode` · al guardar `navigate('/inmuebles?tab=cartera')` `:759/769`). | **Confirmado**. No es modal reutilizable → aplica el fallback `?from=empezar` (§2.1). |
| P2 | Revisión post-plantilla | `ImportarPlantillaWizard.tsx` · pasos `subir → revisar → crear` (`:47,73-74`) · `revisar()` muestra tabla antes de crear. | **EXISTE** · no requiere cambio. |
| P3 | Cierre del bucle | Progreso: `refresh()` (OnboardingContext) llama `syncNucleoFromData()` que marca `inmuebles` completado si hay properties → la plantilla cierra el bucle. La vía manual NO (no vuelve al flujo). **Pendiente "financiado sin préstamo"**: NO existe como ítem del semáforo · solo un aviso transitorio en `inmueblesImportCreationService.ts:14,40` y texto descriptivo en `PrestamosBloque.tsx:148`. | Progreso: OK (al volver al flujo). Pendiente semáforo: **FALTA** → §2.3. |
| P4 | Título tapado por topbar | `OnboardingTopbar` sticky + `.main` de `empezar.module.css`. | Cosmético · arreglar padding/scroll. |
| P5 | Plantilla incompleta | Plantilla = 12 columnas (`InmuebleTemplateRow`). Form = ~30 campos (`InmueblePage` FormState: `tipoActivo, m2, habitaciones, banos, anioConstruccion, esUrbana, porcentajePropiedad, tieneParking, tieneTrastero, diasArrendado, cadastralRevised, usoTipo, alquilerHabActivo, …`). | **Confirmado** → espejo en §2.5. |
| P6 | "Rentabilidad" no decidida | `InmueblesBloque.tsx` caja honestidad: *"Atlas calcula la rentabilidad sobre el dinero que TÚ pusiste · no sobre el precio del piso"*. | **Confirmado** · retirar (solo onboarding). |
| P7 | Formato no español | Generador `scripts/generate-onboarding-templates.cjs` emite ISO: inmuebles `2021-06-15` `:42` · préstamos `2021-07-01` `:75` · inversiones `2022-03-10`. | **Confirmado en las 3 plantillas**. |

## Datos para el arreglo

**Form de inmueble · inventario (P5)** · obligatorios para la plantilla: `alias` o `direccion` + `tipoActivo`. Resto opcional. Excluidos con nota: `mejoras` (`MejoraDraft[]`) y `muebles` (`MuebleDraft[]`) (listas · se editan en la ficha).
- `tipoActivo`: `piso | parking | trastero | local | otro` (`types/tipoActivo.ts:12`).
- `usoTipo`: `larga_estancia | temporada | turistico | mixto | vivienda_habitual | disponible` (`InmueblePage.tsx:152-157`).

**Parser de fechas (P7) · ya es tolerante** · `toIsoDate` (`rentilaParserService.ts`) acepta: celda Excel nativa (number · `SSF.parse_date_code`), ISO `YYYY-MM-DD`, y `DD/MM/YYYY` (split por `/.-`). Las 3 plantillas comparten `toIsoDate`. `toNumber` ya parsea `1.234,56` → `1234.56`. **Solo falta el GENERADOR** (escribir DD/MM/AAAA / celdas de fecha nativas).

**Pendiente "financiado sin préstamo" (P3)** · hay que derivarlo de `Property.estructuraCompra` (`importeFinanciado > 0 && !prestamoVinculadoId`) y surfacearlo en hub + widget con deep-link a `/empezar/prestamos`.

**P6 fuera de scope** · "rentabilidad" pre-existe en módulos de inversiones/inmuebles (`CarteraResumen`, `DetallePage`, `ListadoPage`…). **NO se tocan** · solo la línea del onboarding.

## Veredicto de STOP

**No procede STOP.** El form está acoplado a su ruta (refactor a modal = no trivial sobre 1686 líneas), exactamente el caso para el que §2.1 autoriza el fallback `/inmuebles/nuevo?from=empezar` (cambio quirúrgico de navegación). No hay decisión que requiera a Jose · la spec ya fija el enfoque. Procedo a commits 2-3.
