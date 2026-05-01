# T9 · Verificación end-to-end · bootstrap compromisos recurrentes

> **Sub-tarea 9.4** · TAREA 9 cierre.
>
> Documento de verificación manual con 5 escenarios paso-a-paso. Cubre el
> flujo completo desde detección sobre histórico → aprobación selectiva →
> activación de la vía A del `movementSuggestionService` con datos reales.

---

## Pre-condiciones

- DB local en versión 65 (`AtlasHorizonDB`) · sin cambios de schema
- Al menos 6 meses de `movements` importados en Tesorería para que el clustering tenga material
- 1 `personalData` activo con `id=1`
- (Opcional) `viviendaHabitual` activa · `properties` activos · para validar filtros fase 5

---

## Escenario 1 · Detección inicial

**Flujo · UI productiva**

1. Abrir `/personal/gastos`
2. Click "Detectar desde histórico" en el header (o botón CTA si el catálogo está vacío)
3. Se navega a `/personal/gastos/detectar-compromisos`
4. Auto-detección al entrar (loading ~200-800 ms según volumen de movements)
5. Card "Configuración detección" muestra defaults · mínimo ocurrencias `3` · antigüedad `18m`
6. Card "Resultados" aparece con:
   - Estadística cabecera · `N candidatos · M descartados · K ya existentes`
   - Filtro por tipo · `Todos | Suministros | Suscripciones | Seguros | Cuotas | Comunidad | Impuesto | Otros`
   - Lista de candidatos · cada uno como tarjeta con score visual

**Validación**

- [ ] La página carga sin errores en consola
- [ ] El número de candidatos coincide con la expectativa para tu DB (suministros típicos · suscripciones · seguros · cuotas)
- [ ] Cada candidato muestra: alias propuesto + tipo (pill) + score + proveedor + cuenta + patrón legible (`mensual día 5`) + importe (`-65,50 €`)
- [ ] Las razones de score son legibles (`12 ocurrencias · patrón temporal estable · importe fijo · proveedor reconocido`)
- [ ] Los avisos (si los hay) aparecen como pills warn (`importe sube progresivamente`)

**Score esperado**

| Tipo de candidato | Score esperado | Razones típicas |
|---|---|---|
| Suministro 12 ocurrencias importe fijo proveedor reconocido (Iberdrola/Naturgy/Movistar) | 90-100 | base 50 + 20 ocurrencias (cap) + 15 estable + 10 fijo + 5 proveedor |
| Suscripción 6 ocurrencias importe fijo proveedor reconocido (Netflix/Spotify) | 80-95 | base 50 + 15 ocurrencias + 15 estable + 10 fijo + 5 proveedor |
| Seguro anual (Mapfre/Mutua) 3-4 ocurrencias importe fijo | 75-85 | base 50 + 5-10 ocurrencias + 15 estable + 10 fijo + 5 proveedor |
| Cuota gimnasio 6 ocurrencias importe fijo proveedor desconocido | 75-85 | base 50 + 15 ocurrencias + 15 estable + 10 fijo |
| Otros sin proveedor reconocido importe variable suave | 60-70 | base 50 + 5-10 ocurrencias |

---

## Escenario 2 · Aprobación selectiva

**Flujo**

1. Tras escenario 1, seleccionar 5 candidatos variados:
   - 1 suministro (ej · Iberdrola)
   - 1 suscripción (ej · Netflix)
   - 1 seguro (ej · Mapfre)
   - 1 cuota (ej · Gimnasio)
   - 1 otros (importe fijo · score ≥ 70)
2. Click "Aprobar seleccionados (5)" en sticky bottom
3. Toast: `5 compromisos creados`
4. Re-detección automática · los 5 aprobados desaparecen del listado (filtro `porCompromisoExistente`)
5. La estadística cabecera ahora muestra `K' = K + 5` ya existentes

**Validación · DevTools**

1. Abrir DevTools → Application → IndexedDB → AtlasHorizonDB → compromisosRecurrentes
2. Verificar que aparecen los 5 nuevos registros con:
   - `id` autoincrement asignado
   - `ambito='personal'`
   - `personalDataId=1`
   - `estado='activo'`
   - `derivadoDe = { fuente: 'manual', refId: 'T9-detection' }`
   - `createdAt` y `updatedAt` con la fecha actual
3. Abrir `treasuryEvents` · verificar que aparecen eventos `predicted` con `sourceType='gasto_recurrente'` y `sourceId` apuntando a los 5 nuevos compromisos (regla de oro #1 · cada compromiso genera N eventos)

**Validación · UI**

- [ ] Volver a `/personal/gastos`
- [ ] Los 5 compromisos aparecen en la tabla del catálogo
- [ ] Cada uno con su alias · tipo · categoría · estimación mensual · estado activo

---

## Escenario 3 · Importar extracto · vía A activada

Esta es la prueba clave de que `movementSuggestionService` vía A está activa.

**Flujo**

1. Ir a Tesorería · subir un extracto bancario reciente (ej · Sabadell último mes)
2. Tras parseo · UI muestra movements no conciliados · `BankStatementUploadPage` (T17)
3. Para movements que matchean los 5 compromisos creados (mismo `cuentaCargo` · importe ± 5%):
   - El movement aparece con sugerencia `via='compromiso_recurrente'`
   - Confidence 70-90 (base 70 + 10 céntimo exacto + 10 proveedor en descripción)
   - Descripción tipo · `Coincide con compromiso "Iberdrola" (IBERDROLA)`

**Validación**

- [ ] Al menos 1 movement del extracto matchea uno de los 5 compromisos
- [ ] La sugerencia vía A aparece arriba de las heurísticas (vía C)
- [ ] El score visual muestra ≥ 70
- [ ] Aceptar la sugerencia genera el `treasuryEvent` confirmado correcto

**Si NO aparecen sugerencias vía A** (debugging)

- Verificar en DevTools que `compromisosRecurrentes` no está vacío
- Verificar `cuentaCargo` del compromiso vs `accountId` del movement (deben coincidir)
- Verificar diferencia de importe < 5% (`COMPROMISO_AMOUNT_TOLERANCE_PERCENT` en `movementSuggestionService.ts:65`)
- Verificar que `compromiso.estado === 'activo'`

---

## Escenario 4 · Re-detección · idempotencia

**Flujo**

1. Volver a `/personal/gastos/detectar-compromisos`
2. Click "Analizar movimientos" (re-detección)
3. La estadística cabecera muestra ahora `K + 5 ya existentes` (los 5 aprobados en escenario 2)
4. La lista de candidatos NO contiene los 5 aprobados

**Validación**

- [ ] Los 5 candidatos aprobados en escenario 2 NO aparecen en el listado
- [ ] El contador `porCompromisoExistente` aumentó en 5 respecto al escenario 1
- [ ] Sí aparecen otros candidatos nuevos si los hay (no se filtran por error)

**Verificación de idempotencia (DevTools)**

- Si por alguna vía se intenta aprobar de nuevo el mismo compromiso (ej · vía API directa), `createCompromisosFromCandidatos` devuelve ese candidato en `duplicadosOmitidos[]` · NO crea duplicado en el store.

---

## Escenario 5 · Edición pre-aprobación

**Flujo**

1. Volver a `/personal/gastos/detectar-compromisos`
2. Sobre un candidato (ej · "Naturgy"), click "Editar"
3. Modal abierto con foco atrapado · cierre con `Escape` · click fuera cierra
4. Cambiar:
   - `alias` · de `Naturgy` a `Mi Gas Natural`
   - `categoria` · de `vivienda.suministros` a `vivienda.suministros` (o cambiar a otra)
   - `responsable` · de `titular` a `pareja`
5. Click "Guardar cambios" · modal cierra
6. La tarjeta del candidato refleja los cambios (alias y proveedor)
7. Marcar el checkbox del candidato editado · click "Aprobar seleccionados"
8. Toast `1 compromiso creado`

**Validación · DevTools**

- Localizar el nuevo compromiso en `compromisosRecurrentes`
- Verificar que se persisten los cambios:
  - `alias === 'Mi Gas Natural'`
  - `responsable === 'pareja'`
  - El resto de campos (proveedor.nif · patrón · importe · cuentaCargo · conceptoBancario) inalterados respecto a la propuesta original

---

## Verificación rápida (smoke test)

Ejecutar al menos esto antes de cada release:

- [ ] `/dev/compromiso-detection` accesible en deploy preview · estadísticas no rotas
- [ ] `/personal/gastos/detectar-compromisos` accesible · auto-detección al entrar funciona
- [ ] Aprobar 1 candidato · toast OK · refresh · candidato desaparece (idempotencia)
- [ ] DevTools muestra el registro creado en `compromisosRecurrentes` con `derivadoDe.refId='T9-detection'`
- [ ] Importar 1 extracto · al menos 1 sugerencia `via='compromiso_recurrente'` aparece

---

**Fin verificación end-to-end T9 · cubre los 5 escenarios obligatorios del §5.2.**
