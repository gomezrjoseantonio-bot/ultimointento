# STOP-AND-REPORT · TAREA 14 · Configuración fiscal sitio único v1

> **Estado** · auditoría §2 obligatoria detenida · ambigüedad detectada · esperando input Jose
> **Rama** · `claude/audit-fiscal-config-girA9`
> **Fecha** · 2026-05-06
> **Ejecutor** · Claude Code

Per regla §6.7 del spec ("Si surge ambigüedad · PARAR · documentar · esperar input Jose") y regla §12 ("Si los grep no encuentran resultados esperados · reportar · puede ser señal de bug") · NO se ha creado `MAPEO-FISCAL-titular-V68.md` ni se ha tocado código.

---

## 1 · Resumen ejecutivo

La auditoría preflight detecta **5 discrepancias entre las premisas del spec v1 y el estado real del repo**. Ninguna de ellas es "duplicación grave de datos fiscales" (T7-bis sigue siendo correcto en eso) · pero todas afectan a **qué documento canónico procede crear**, **con qué nombre**, y **si solapa con material ya entregado**.

Las 5 discrepancias:

1. **DB_VERSION real ≠ DB_VERSION del spec** · 69 vs 68 esperado.
2. **El audit T14.1 ya existe** · `docs/AUDIT-T14-fiscal-config.md` cubre el 90 % del trabajo de auditoría §2 del spec.
3. **El plan T14.2-14.5 ya existe** · `docs/TAREA-14-2-a-14-5-fiscal-config.md` planifica el gateway con Enfoque C.
4. **Existe servicio + página runtime de auditoría fiscal** · `src/services/__fiscalContextAudit.ts` + `src/pages/dev/FiscalContextAudit.tsx` ruta `/dev/fiscal-context-audit`.
5. **`docs/STORES-V60-ACTIVOS.md` está desactualizado** · habla de DB_VERSION 64-65 y 39 stores · realidad es 69 y 40.

Ninguna duplicación de datos fiscales (objetivo principal de la auditoría) ha sido detectada. La situación es de **redundancia documental**, no de bug en stores.

---

## 2 · Evidencias

### 2.1 · DB_VERSION = 69 (no 68)

```
src/services/db.ts:28
const DB_VERSION = 69; // V69 (TAREA 13 v4 · cierre lote B+C · C4 review Copilot):
añade índice compuesto `tipo-activo` [tipo_activo, activo_id] en
`valoraciones_historicas` · perf · solo schema · sin migración de datos ·
40 stores (sin cambio en número)
```

T13 v4 · que el spec da por mergeado en `main` como predecesor · efectivamente bumpó la DB a 69 (el spec asumía erróneamente que se quedaba en 68). El bump no afecta a ningún store fiscal · es solo un índice compuesto en `valoraciones_historicas`. **El nombre `MAPEO-FISCAL-titular-V68.md` no encaja**.

Rama actual ya posee este commit · verificado en `git log main` (`ba4914c Merge pull request #1228`).

### 2.2 · Stores activos = 40 (coherente con spec)

`grep -E "createObjectStore" src/services/db.ts | grep -oP "createObjectStore\('[^']+'" | sort -u | wc -l` → 43 nombres únicos.

Pero 3 de esos son legacy/condicionales:
- `planesPensionInversion` · creado solo en `oldVersion < 50` (legacy · existe para migración) · 2 lectores activos en código
- `traspasosPlanes` · ídem
- `escenarios` y `planesPensiones`/`aportacionesPlan`/`traspasosPlanPensiones` aparecen en 2 ramas de `if (oldVersion ...)` distintas pero son el mismo store

Stores activos finales · 40 (coincide con la afirmación del spec). El conteo 43 es solo ruido del grep.

### 2.3 · `docs/AUDIT-T14-fiscal-config.md` ya existe

Documento de 401 líneas · auditoría completa T14.1 con:
- Inventario de los 4 sitios (`personalData`, `personalModuleConfig`, `viviendaHabitual`, `keyval['configFiscal']`)
- Tabla de 14 consumidores de `personalData`
- 7 GAPs detectados (5 fiscales accionables · 2 técnicos)
- 3 enfoques propuestos (A · B · C) con C recomendado
- Confirmación · `keyval['configFiscal']` huérfano (sin escritor/lector)
- Confirmación · NO hay duplicación grave de datos

**Solapamiento con §2 del spec actual** · ~90 %. La diferencia está en formato y en que el spec pide tabla maestra "campo → store responsable" canónica · que AUDIT-T14 no tiene en ese formato exacto.

**Discrepancia menor** · AUDIT-T14 dice "DB_VERSION 65" en su cabecera · realidad es 69 (el doc se quedó congelado en su fecha de creación).

### 2.4 · `docs/TAREA-14-2-a-14-5-fiscal-config.md` ya existe

Spec de 4 sub-tareas siguientes (14.2-14.5) que · partiendo del audit anterior · planifican:
- 14.2 · crear `fiscalContextService` gateway
- 14.3 · cerrar 5 GAPs en `irpfCalculationService`
- 14.4 · migrar 13 consumidores al gateway
- 14.5 · borrar `keyval['configFiscal']`

Este plan también dice "DB_VERSION 65" en cabecera (stale).

### 2.5 · Audit runtime ya existe

```
src/services/__fiscalContextAudit.ts                   (servicio · 400+ líneas)
src/pages/dev/FiscalContextAudit.tsx                   (página DEV)
src/App.tsx:496  path="/dev/fiscal-context-audit"      (ruta registrada)
```

Permite a Jose inspeccionar en runtime el estado real de los 4 sitios fiscales en su IndexedDB.

### 2.6 · `docs/STORES-V60-ACTIVOS.md` desactualizado

```
docs/STORES-V60-ACTIVOS.md:3   > DB_VERSION: 64
docs/STORES-V60-ACTIVOS.md:37  Los dominios agrupan los 39 stores activos.
docs/STORES-V60-ACTIVOS.md:897 **DB_VERSION sin cambios** (sigue en 65)
```

El documento que el spec pide actualizar (§4.2) tiene baseline de hace varias DB_VERSIONs. Sin rebaseo previo · la frase "Frontera fiscal" se añade sobre un sustrato incorrecto.

---

## 3 · Sobre la auditoría de duplicación (resultado provisional)

A pesar de la ambigüedad documental · el grep funcional sí se ha ejecutado y confirma · **NO hay duplicación grave de datos fiscales**. Coincide con T7-bis y con AUDIT-T14:

| Riesgo del spec §2.3 | Resultado |
|---|---|
| Duplicación real (mismo dato en 2 stores) | **No detectada** |
| Tipos divergentes | **Pendiente confirmar tras decisión Jose** (si procede ampliar audit · revisar `comunidadAutonoma` string libre vs catálogo) |
| Campos huérfanos | Detectados en AUDIT-T14 GAPs (escritos pero no usados en `irpfCalculationService` · ej. `comunidadAutonoma` para reducciones autonómicas) |
| `keyval['configFiscal']` con escritor activo | **No · está huérfano · confirmado** |
| Variable local `configFiscal` en `treasurySyncService.ts:1016` | Es objeto literal inline · no lee de keyval · no es duplicación |

Por tanto · la rama "si NO hay duplicación · solo escribir documento canónico" del spec aplicaría · **pero el documento canónico colisiona con material ya entregado**.

---

## 4 · Decisiones que necesito de Jose antes de continuar

1. **Versión en el nombre del doc** · ¿`MAPEO-FISCAL-titular-V69.md` (refleja realidad) o mantener `-V68.md` (spec) sabiendo que es inexacto?

2. **Solapamiento con AUDIT-T14** · 3 opciones · 
   - **A** · crear `MAPEO-FISCAL-titular-V69.md` desde cero · formato tabla maestra del spec · referenciar AUDIT-T14 como evidencia · NO duplicar contenido.
   - **B** · renombrar/reformatear `AUDIT-T14-fiscal-config.md` → `MAPEO-FISCAL-titular-V69.md` · añadir sección "Tabla maestra" y "Fronteras formales" del spec · marcar AUDIT-T14 como reemplazado.
   - **C** · cerrar T14 declarando que AUDIT-T14 ya satisface el objetivo · solo añadir tabla maestra como anexo + actualizar STORES-V60-ACTIVOS.md.

3. **Rebaseline de STORES-V60-ACTIVOS.md** · ¿se hace en este PR (cabecera 64→69 · 39→40) o queda fuera de scope · solo se añade "Frontera fiscal" sobre el sustrato actual?

4. **Estado de TAREA-14-2-a-14-5** · ese plan referencia "DB_VERSION 65" y "T14.1 ✅". ¿Sigue vivo? Si sí · ¿se actualiza la cabecera o se considera que su contenido sigue siendo válido pese al stale en cabecera?

---

## 5 · Lo que NO he hecho (esperando autorización)

- ❌ NO he creado `MAPEO-FISCAL-titular-V68.md` ni `-V69.md`
- ❌ NO he tocado `docs/STORES-V60-ACTIVOS.md`
- ❌ NO he tocado código en `src/`
- ❌ NO he bumpeado DB_VERSION (sigue 69)
- ❌ NO he creado PR

---

## 6 · Lo que SÍ he hecho

- ✅ Ejecutada §2.1 del spec · DB_VERSION verificada (69 · no 68)
- ✅ Ejecutada §2.2 del spec · grep de los 6 stores fiscales
- ✅ Localizado material previo (AUDIT-T14 · TAREA-14-2-a-14-5 · runtime page)
- ✅ Verificado · `keyval['configFiscal']` huérfano (coincide con T14.1)
- ✅ Verificado · NO hay duplicación grave (objetivo primario del spec)
- ✅ Este reporte

---

## 7 · Próximo paso esperado

Jose responde con:
- Cuál de las 3 opciones del punto 4.2 prefiere (A · B · C)
- Si renombra el doc a `-V69.md` o mantiene `-V68.md`
- Si rebaseline STORES-V60 entra en este PR o no
- Cualquier otra restricción

Una vez recibida autorización · Claude continúa en esta misma rama y abre PR único · stop-and-wait.

---

*Fin del reporte · STOP-AND-WAIT · NO se ha creado PR.*
