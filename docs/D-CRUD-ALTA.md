# D-CRUD-ALTA · completar edición/eliminación · 10 gaps prioridad alta

> **Tipo** · Feature + UI + saneamiento · 10 sub-tareas independientes
> **Tiempo estimado total** · 9-15h CC repartido en 10 PRs
> **Cierra** · Tabla 1 V11 §3 (4 ítems) + audit T-CRUD §D ranking ALTA (10 ítems)
> **Reglas aplicadas** · V11.3 (5 preguntas) · V11.5 (pantallazos antes de marcar) · V11.6 (NO propagar urgencia basada en comentarios) · canónica grep duro V8

---

## §0 · Reglas operativas obligatorias · CC NO PUEDE saltarse ninguna

### 0.1 · Pre-flight propio en cada sub-tarea · NO confiar en el audit

T-CRUD-AUDIT detectó "GAP 0 URGENTE" basado en un comentario de código que mentía sobre 4 callers UI vivos. Tras pantallazo Jose · resultó dead code sin urgencia. **El audit es pista · NO veredicto.**

Para cada sub-tarea · CC ejecuta su propio pre-flight grep duro EN EL MOMENTO de arrancar · NO confía en lo que diga el audit hace 2 horas. Si el gap ya está cerrado (alguien añadió botón en otra rama) · **STOP · reportar a Jose · marcar sub-tarea como N/A**.

### 0.2 · Si pre-flight revela algo distinto al audit · STOP

Casos en los que CC se DETIENE y reporta a Jose ·

- Audit decía "servicio existe sin caller" · grep encuentra caller productivo · gap ya cerrado
- Audit decía "1 implementación" · grep encuentra 2+ · duplicidad NO contemplada
- Audit decía "servicio existe" · grep no lo encuentra · audit erróneo
- Comentario de código dice URGENTE · pero grep de callers reales no confirma · NO propagar urgencia

### 0.3 · Stop-and-wait estricto · 1 PR por sub-tarea

CC ejecuta 1 sub-tarea · abre PR · NO mergea · espera Jose. Jose mergea o pide ajustes. **CC NO arranca siguiente sub-tarea sin OK explícito de Jose.**

NO parallel. NO empaquetar 2 sub-tareas en 1 PR. NO saltarse el orden si una sub-tarea bloquea las posteriores.

### 0.4 · Cascada · siempre verificar

Cuando se elimina una entidad principal (contrato · inmueble · cuenta · etc) · ¿qué pasa con sus dependencias? CC verifica el comportamiento del servicio existente · si NO cascade · reporta y propone diseño antes de implementar.

### 0.5 · Tests · NO degradar · NO arreglar 43 failing pre-existing

43 test suites fallan en main pre-existing (deuda T-TESTS-SANEAR pendiente). NO tocar esos tests. NO arreglar. Solo verificar que el PR no AÑADE más fallos. Si suite count sube de 43 · reportar y revertir.

---

## §1 · Contexto

T-CRUD-AUDIT (mergeado V11) detectó 31 gaps CRUD. 10 son prioridad ALTA por afectar a entidades que Jose dogfooder usa hoy. Este spec ataca los 10 en orden.

Modelo cerrado V11 · planes pensión viven en `planesPensiones` · aportaciones en `aportacionesPlan` · traspasos en `traspasosPlanPensiones` V65 · todo correcto. El "GAP 0" del audit (traspasos urgente) era falsa alarma · pasa a prioridad MEDIA y se ataca en spec posterior.

DB v70 · 40 stores · sin upgrade en este spec.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Contratos · botón eliminar en `ContratosListPage`

**Tipo** · solo botón falta · 30-60 min CC
**Origen audit** · T-CRUD-AUDIT §D #1

#### Pre-flight obligatorio
```bash
# Confirmar deleteContract sigue sin caller UI productivo
grep -rnE "deleteContract\(" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v test | grep -v __tests__ | grep -v mock | grep -v __mocks__
# Si retorna match en .tsx productivo · gap cerrado · STOP · reportar

# Localizar pantalla ContratosListPage
find src/ -type f -name "ContratosListPage*" 2>/dev/null
grep -nE "ContratosListPage" src/App.tsx

# Verificar UI actual · ¿hay ya kebab MoreVertical · Trash2?
# (sustituir ruta por la encontrada)
grep -nE "Trash2|MoreVertical|Pencil" {ruta-ContratosListPage}
```

#### Plan
1. Añadir columna kebab (MoreVertical · lucide-react) en cada fila de `ContratosListPage`
2. Menu con opciones · "Editar" (cablea wizard existente) · "Eliminar" (confirm modal · llama `deleteContract(id)`)
3. Modal confirmación destructiva · texto "Esta acción no se puede deshacer" · botón rojo "Eliminar"
4. Tras delete · refrescar lista
5. **Verificar cascada** · `deleteContract` ¿borra también `gastosInmueble` asociados · `propertyDays` derivados · valoraciones? Si NO cascade · reportar a Jose antes de implementar el botón · diseñar cascada primero.

#### Criterios aceptación
- [ ] Pre-flight pegado en PR description
- [ ] Botón eliminar visible en cada fila
- [ ] Modal confirmación
- [ ] `deleteContract` invocado · lista refrescada
- [ ] Cascada verificada y documentada
- [ ] Tests · suites failing ≤ 43 (sin regresión)
- [ ] Build pasa · lint pasa
- [ ] PR description con resumen 5 líneas

---

### Sub-tarea 2 · Movements · delete individual en `TesoreriaV4`

**Tipo** · solo botón falta · 1-2h CC
**Origen audit** · T-CRUD-AUDIT §D #2

#### Pre-flight obligatorio
```bash
# Verificar que TesoreriaV4 NO tiene ya botón eliminar movement individual
grep -nE "delete|Trash2|Eliminar" src/components/treasury/TesoreriaV4.tsx | head -20

# Confirmar dónde existe la función delete
grep -rnE "db\.delete\('movements'" src/ --include="*.ts" 2>/dev/null
grep -rnE "deleteMovement|removeMovement" src/services/ --include="*.ts" 2>/dev/null

# Verificar conciliación v2 · ya tiene EditMovementModal · ¿reusable o no?
grep -nE "EditMovementModal" src/modules/horizon/conciliacion/v2/ -r
```

#### Plan
1. Determinar canónica · `db.delete('movements', id)` directo · o crear `deleteMovement(id)` en `treasuryApiService` · CC propone con justificación
2. Añadir botón eliminar en cada fila de TesoreriaV4 (kebab MoreVertical)
3. Modal confirmación
4. **Verificar cascada** · ¿movement borrado afecta a saldo cache de cuenta · a treasuryEvents asociados · a conciliación pendiente? Reportar antes de implementar
5. Si la decisión es crear servicio nuevo · escribir wrapper limpio · NO duplicar lógica de cuentasService

#### Criterios aceptación
- Igual estructura sub-tarea 1

---

### Sub-tarea 3 · Inmuebles · `deleteInmueble` IDB local con cascada

**Tipo** · servicio + UI · construir desde cero · 3-5h CC
**Origen audit** · T-CRUD-AUDIT §D #3 + §B fila inmuebles

#### Pre-flight obligatorio
```bash
# Confirmar inmuebleService.delete actual es HTTP fantasma
grep -nE "inmuebleService" src/services/inmuebleService.ts | head -30
grep -rnE "inmuebleService\.delete" src/ --include="*.tsx" --include="*.ts" 2>/dev/null

# Buscar deleteInmueble local · ¿existe ya o no?
grep -rnE "deleteInmueble|removeInmueble" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

# Verificar cascada potencial
grep -nE "inmuebleId|propertyId" src/services/db.ts | head -20
```

#### Plan
1. **NO TOCAR** `inmuebleService.delete()` HTTP · es código fantasma residual · auditar si tiene callers · si NO · eliminar archivo entero
2. Crear `deleteInmuebleLocal(id)` en service nuevo o existente · CC decide canónica
3. Cascada obligatoria · borrar también ·
   - `contracts` con `propertyId === id`
   - `gastosInmueble` con `inmuebleId === id`
   - `valoraciones_historicas` con `entityType='inmueble' && entityId === id`
   - `propertyDays` con `inmuebleId === id`
   - `mejorasInmueble`/`mueblesInmueble` asociadas
   - `vinculosAccesorio` que lo referencien
   - **NO BORRAR** `property_sales` si existe · son histórico fiscal · marcar inmueble como `eliminado: true` o similar
4. Botón en pantalla detalle inmueble (no en lista · prevenir clicks accidentales)
5. Modal confirmación con resumen de cuántas entidades dependientes se borrarán

#### Criterios aceptación
- Igual estructura · y además ·
- [ ] Cascada documentada en PR description con N afectadas por entidad
- [ ] `inmuebleService.delete()` HTTP fantasma · acción tomada (eliminar o conservar con justificación)
- [ ] Modal lista entidades dependientes antes de confirmar

---

### Sub-tarea 4 · Documents · UI editar metadata + reprocesar OCR

**Tipo** · servicio (reproc OCR) + UI · 2-4h CC
**Origen audit** · T-CRUD-AUDIT §D #4

#### Pre-flight obligatorio
```bash
# Verificar reprocessOCR · ¿existe ya?
grep -rnE "reprocessOCR|reOCR|reProcess" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

# Localizar UI documentos
grep -nE "deleteDocumentAndBlob" src/pages/InboxPage.tsx
find src/ -name "*[Ii]nbox*" -type f 2>/dev/null

# Servicios OCR · ya hay 3 (audit T-INACEPTABILIDADES E1)
ls src/services/ | grep -iE "ocr"
```

#### Plan
1. UI editar metadata (`InboxPage` o `DocumentViewer`) · botón "Editar" · modal con campos editables (`tipo` · `fecha` · `proveedor` · `importe` · `descripcion`)
2. Llama `db.put('documents', updatedDoc)`
3. Función `reprocessOCR(documentId)` · usa servicio canónico (`unifiedOcrService` según audit) · re-procesa · actualiza metadata extraída
4. Botón "Reprocesar OCR" · solo visible si documento tiene blob original · disabled mientras corre · estado loading visible
5. **NO consolidar 3 servicios OCR aquí** · es trabajo separado (S-OCR-SANEAMIENTO posterior)

#### Criterios aceptación
- Igual estructura sub-tareas anteriores

---

### Sub-tarea 5 · Compromisos recurrentes · UI listar/editar/borrar

**Tipo** · construir desde cero · 4-6h CC
**Origen audit** · T-CRUD-AUDIT §D #5

#### Pre-flight obligatorio
```bash
# ¿Existe ya alguna UI de compromisos?
find src/ -type f -name "*[Cc]ompromiso*" 2>/dev/null
grep -rnE "compromisosRecurrentes" src/ --include="*.tsx" 2>/dev/null | head -20

# Servicio actual
grep -nE "compromisosRecurrentes" src/services/db.ts

# Detección automática · ¿qué la dispara? ¿qué la consume?
grep -rnE "compromisos.*detect|detect.*compromisos" src/services/ --include="*.ts" 2>/dev/null
```

#### Plan
1. Crear `ComprommisosRecurrentesPage` (ruta TBD · sugerencia · `/personal/compromisos` o sub-tab en Mi Plan)
2. Lista con · descripción · categoría · ámbito (personal/inmueble) · importe · frecuencia · estado (sugerido/confirmado/activo) · próxima ejecución
3. Acciones por fila · editar · eliminar · cambiar estado
4. Modal edición · campos según schema actual
5. Modal eliminación con confirmación
6. **NO ATACAR** la detección automática (TAREA 9 backlog) · solo CRUD UI sobre lo ya detectado
7. Si la detección no ha creado nada · pantalla vacía con CTA "Crear compromiso manual"

#### Criterios aceptación
- Igual estructura · y además ·
- [ ] Pantalla vacía con CTA si compromisos.length === 0
- [ ] Edición persistente verificada (refresh página · cambios guardados)

---

### Sub-tarea 6 · Valoraciones individuales · rectificar/borrar

**Tipo** · servicio + UI · 1-2h CC
**Origen audit** · T-CRUD-AUDIT §D #6

#### Pre-flight obligatorio
```bash
# Servicio valoraciones actual
grep -rnE "valoracionesService\.|deleteValoracion|updateValoracion" src/services/ 2>/dev/null

# UI Drawer valoraciones
find src/ -name "*[Vv]aloracion*" -type f 2>/dev/null | head -10
```

#### Plan
1. Añadir `deleteValoracion(id)` y `updateValoracion(id, updates)` en service · si no existen
2. UI Drawer valoraciones · cada fila con kebab · editar · eliminar
3. Modal edición · valor · fecha · fuente · notas
4. Modal eliminación

#### Criterios aceptación
- Igual estructura

---

### Sub-tarea 7 · Vivienda habitual · verificar botón "Eliminar vivienda"

**Tipo** · verificación + posible servicio · 30 min - 1h CC
**Origen audit** · T-CRUD-AUDIT §D #7

#### Pre-flight obligatorio · CRÍTICO · APLICAR V11.6
```bash
# El audit dice "el botón posiblemente no funciona o resetea por put con defaults"
# REGLA V11.6 · NO creer al audit · verificar grep duro

# Ver qué hace el onClick del botón
grep -nE "Eliminar vivienda" src/ -r --include="*.tsx" 2>/dev/null
# Sustituir ruta encontrada en el siguiente comando
grep -nE "deleteVivienda|removeVivienda|db\.delete\('viviendaHabitual'" src/ -r --include="*.ts" --include="*.tsx" 2>/dev/null
```

#### Plan según resultado pre-flight
- **Caso A · botón funciona ya (delete o reset real)** · documentar · marcar sub-tarea N/A · cerrar
- **Caso B · botón es mockup (toast solo)** · implementar · servicio + caller real
- **Caso C · botón resetea con put defaults pero no borra** · decidir con Jose · ¿es comportamiento intencional o gap?

CC reporta resultado pre-flight ANTES de implementar.

#### Criterios aceptación
- Igual estructura

---

### Sub-tarea 8 · Mejoras + muebles inmueble · update + delete service + UI

**Tipo** · servicio + UI · 2-3h CC
**Origen audit** · T-CRUD-AUDIT §D #8

#### Pre-flight obligatorio
```bash
# mejorasInmuebleService · ¿qué expone hoy?
grep -nE "export" src/services/mejorasInmuebleService.ts 2>/dev/null

# UI PropertyImprovements · ¿hay botón Editar · que dispara?
grep -nE "Editar|onClick" src/ -r --include="*.tsx" 2>/dev/null | grep -i mejora | head -20

# Mismo para muebles
grep -nE "export" src/services/mueblesInmuebleService.ts 2>/dev/null
```

#### Plan
1. Añadir `updateMejora(id, updates)` y `deleteMejora(id)` si no existen
2. Mismo para muebles
3. UI · cablear botones existentes (audit dice que el "Editar" está en UI pero sin caller)
4. Modal edición + eliminación

#### Criterios aceptación
- Igual estructura

---

### Sub-tarea 9 · Proveedores · UI editar + delete

**Tipo** · servicio + UI · 2-3h CC
**Origen audit** · T-CRUD-AUDIT §D #9

#### Pre-flight obligatorio
```bash
# Servicio proveedores actual
grep -rnE "proveedorService\.|deleteProveedor|updateProveedor" src/services/ 2>/dev/null

# Pantalla proveedores · ¿existe?
find src/ -name "*[Pp]roveedor*" -type f 2>/dev/null | head -10
```

#### Plan
1. Pantalla "Catálogo proveedores" si no existe (ruta TBD · sugerencia `/configuracion/proveedores`)
2. Lista con NIF · nombre · tipo · operaciones asociadas
3. Editar · corregir nombre · NIF (con cuidado · NIF es keyPath · borrar y recrear)
4. Eliminar · solo si no tiene operaciones asociadas · sino bloquear
5. Mensaje claro "Este proveedor tiene N operaciones · no se puede eliminar" si bloqueado

#### Criterios aceptación
- Igual estructura · y además ·
- [ ] Eliminación bloqueada si tiene operaciones · UX clara

---

### Sub-tarea 10 · Property sales · delete vs cancel · decisión arquitectónica

**Tipo** · decisión + posible servicio · 1-2h CC
**Origen audit** · T-CRUD-AUDIT §D #10

#### Pre-flight obligatorio
```bash
# Servicio property sales actual
grep -nE "export" src/services/propertySaleService.ts 2>/dev/null
grep -nE "cancelPropertySale" src/services/propertySaleService.ts

# Buscar deletePropertySale · ¿existe?
grep -rnE "deletePropertySale|removePropertySale" src/ 2>/dev/null
```

#### Decisión a confirmar Jose ANTES de implementar
- ¿`cancelPropertySale` es soft-delete suficiente? (revierte la venta · mantiene registro histórico)
- O ¿hace falta hard-delete (`deletePropertySale`) para casos donde la venta nunca debió registrarse?

CC reporta decisión propuesta · espera Jose ANTES de implementar.

#### Plan según decisión Jose
- **Si soft-delete suficiente** · solo documentar · UI ya tiene "Cancelar venta" · marcar sub-tarea N/A
- **Si hard-delete necesario** · implementar `deletePropertySale` · botón eliminar en lista · modal confirmación

#### Criterios aceptación
- Igual estructura

---

## §3 · Orden de ejecución sugerido (de más rápido a más caro)

| Orden | Sub-tarea | Tiempo | Razón orden |
|---|---|---|---|
| 1 | Sub-tarea 1 · Contratos eliminar | 30-60min | Más rápido · servicio existe · solo botón |
| 2 | Sub-tarea 7 · Vivienda verificar | 30min-1h | Verificación · puede salir N/A |
| 3 | Sub-tarea 6 · Valoraciones | 1-2h | Servicio + UI pequeño |
| 4 | Sub-tarea 10 · Property sales decisión | 1-2h | Decisión Jose primero · puede ser N/A |
| 5 | Sub-tarea 2 · Movements delete | 1-2h | Cascada media |
| 6 | Sub-tarea 8 · Mejoras + muebles | 2-3h | Servicio + UI |
| 7 | Sub-tarea 9 · Proveedores | 2-3h | UI + bloqueo lógico |
| 8 | Sub-tarea 4 · Documents reproc OCR | 2-4h | Servicio nuevo · OCR |
| 9 | Sub-tarea 3 · Inmuebles delete cascada | 3-5h | Cascada compleja |
| 10 | Sub-tarea 5 · Compromisos UI | 4-6h | Construir desde cero |

**Total** · 17-30h CC en escenario máximo · 9-15h en escenario realista (con N/A esperables)

---

## §4 · Reglas de ejecución globales

1. **CC arranca por sub-tarea 1** · no salta orden salvo que Jose lo indique
2. **Pre-flight pegado literal en PR description** · NO resumir
3. **1 PR por sub-tarea** · NO mezclar
4. **Stop-and-wait** · CC NO mergea · espera Jose
5. **NO arrancar siguiente sub-tarea** sin OK explícito Jose post-merge
6. **Si pre-flight revela divergencia con audit** · STOP · reportar
7. **Si encuentras URGENCIA basada en comentario código** · NO propagar · reportar grep duro
8. **NO arreglar 43 tests failing pre-existing** · solo verificar no degradar
9. **NO consolidar duplicidades fuera de scope** (3 OCR · 5 AEAT · etc) · son specs separados
10. **Tiempo de cada sub-tarea > estimación × 2** · DETENERSE y reportar

---

## §5 · Criterios de aceptación globales del spec

- [ ] 10 sub-tareas ejecutadas o marcadas N/A con justificación
- [ ] 10 PRs (o menos si hay N/As)
- [ ] Cada PR pasa criterios de su sub-tarea
- [ ] Tests suites failing ≤ 43 al final
- [ ] Build pasa · lint pasa
- [ ] DB_VERSION sigue en 70 (este spec NO toca DB)
- [ ] Resumen final · tabla con estado de cada sub-tarea (cerrada/N/A/blocked) · enviar a Claude para próximo handoff

---

## §6 · Tras merge de las 10 sub-tareas

| Siguiente | Spec |
|---|---|
| Cerrar prioridad MEDIA del audit (8 gaps · incluye traspasos planes pensión) | D-CRUD-MEDIA · 6-10h CC |
| Sanear duplicidades · 3 OCR · 5 AEAT · planes wrapper · ingresos fragmentado | S-DUPLICIDADES · varios specs · 5-9h CC total |
| Cerrar prioridad BAJA (5 gaps) | D-CRUD-BAJA · opcional · 3-5h CC |

---

**Fin del spec.**
**Listo para entregar a CC · empezar por sub-tarea 1.**
