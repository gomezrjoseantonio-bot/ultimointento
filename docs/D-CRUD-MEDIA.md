# D-CRUD-MEDIA · completar edición/eliminación · 8 entidades prioridad media

> **Tipo** · Feature + UI + saneamiento · 8 sub-tareas independientes
> **Tiempo estimado total** · 6-10h CC repartido
> **Cierra** · audit T-CRUD §D ranking MEDIA (8 ítems)
> **Reglas aplicadas** · idénticas a D-CRUD-ALTA · V11.3 · V11.5 · V11.6 · grep duro V8
> **Patrón ejecución** · igual que PR #1308 D-CRUD-ALTA · encadenar sub-tareas en una rama · commit por sub-tarea · 1 PR final único

---

## §0 · Reglas operativas obligatorias · IDÉNTICAS A D-CRUD-ALTA

Mismo §0 que D-CRUD-ALTA · resumen ·

1. **Pre-flight propio en cada sub-tarea** · NO confiar en el audit T-CRUD-AUDIT (mergeado V11) · grep duro EN EL MOMENTO de arrancar
2. **Si pre-flight revela gap ya cerrado** · STOP · marcar N/A · NO construir duplicados · regla V11.6 LITERAL
3. **Si pre-flight revela urgencia basada en comentario código** · NO propagar · pedir pantallazo Jose o grep callers reales
4. **Encadenar sub-tareas en una rama** · commit por sub-tarea · 1 PR final · NO mergear · esperar Jose
5. **Cascada · siempre verificar** antes de implementar delete con dependencias
6. **NO arreglar 43 tests failing pre-existing** · solo verificar no degradar
7. **Si pre-flight detecta N/A** · documentar en commit/comentario por qué · justificación clara para próximo Claude

**Antecedente clave de D-CRUD-ALTA** · 4 de 10 sub-tareas salieron N/A (compromisos · vivienda · mejoras · property sales) gracias al pre-flight propio. **Esperar tasa similar de N/As en este spec** · 3-4 de 8 sub-tareas pueden ya estar resueltas.

---

## §1 · Contexto

T-CRUD-AUDIT (mergeado V11) detectó 31 gaps CRUD · 8 son prioridad MEDIA. Este spec ataca los 8 en orden.

DB v70 · 40 stores · sin upgrade en este spec.

Estado al arrancar · D-CRUD-ALTA cerrado en PR #1308 · sin tarea encolada en CC.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Objetivos (Mi Plan v3) · UI editar/eliminar

**Tipo probable** · alta probabilidad N/A · la UI Mi Plan v3 puede tenerlo ya
**Tiempo** · 30min-2h CC

#### Pre-flight obligatorio · ALTA prob N/A
```bash
# UI Objetivos · ¿existe en Mi Plan v3?
grep -rnE "Objetivo|objetivos" src/modules/horizon/proyeccion/libertad/ src/modules/horizon/mi-plan/ src/modules/v5/ 2>/dev/null | head -30

# Servicio
grep -nE "deleteObjetivo|removeObjetivo|updateObjetivo|editObjetivo" src/services/ -r 2>/dev/null

# Botones eliminar/editar visibles
grep -rnE "(Editar|Eliminar|Trash2|Pencil).*[Oo]bjetivo" src/ --include="*.tsx" 2>/dev/null | head -10
```

#### Plan según resultado pre-flight
- **Caso A · UI ya existe completa con CRUD** · marcar N/A · documentar ruta · cerrar
- **Caso B · UI parcial (solo crear/listar)** · añadir editar + eliminar
- **Caso C · UI inexistente** · pantalla nueva en Mi Plan tab Objetivos

---

### Sub-tarea 2 · Retos (Mi Plan v3) · UI editar/eliminar

**Tipo probable** · similar a Objetivos · prob N/A
**Tiempo** · 30min-2h CC

#### Pre-flight
```bash
grep -rnE "[Rr]eto" src/modules/horizon/mi-plan/ src/modules/v5/ 2>/dev/null | head -30
grep -nE "deleteReto|updateReto|removeReto" src/services/ -r 2>/dev/null
```

#### Plan
- Caso A/B/C igual que Objetivos

---

### Sub-tarea 3 · Fondos de ahorro · UI editar/eliminar

**Tipo probable** · prob N/A
**Tiempo** · 30min-2h CC

#### Pre-flight
```bash
grep -rnE "fondo.*ahorro|fondosAhorro|FondosAhorro" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -30
grep -nE "deleteFondo|updateFondo|removeFondo" src/services/ -r 2>/dev/null
```

#### Plan
- Caso A/B/C igual que anteriores

---

### Sub-tarea 4 · Entidades atribución · UI editar/eliminar

**Tipo** · puede ser construir desde cero
**Tiempo** · 2-3h CC

`entidadesAtribucion` · vincula NIF/proveedor con auto-clasificación de movements/documents.

#### Pre-flight
```bash
grep -rnE "entidadesAtribucion|EntidadAtribucion" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -20
grep -nE "deleteEntidad|updateEntidad" src/services/entidadesAtribucionService.ts 2>/dev/null
find src/ -name "*[Ee]ntidades[Aa]tribucion*" -type f 2>/dev/null
```

#### Plan
- Caso A · UI ya existe · N/A
- Caso B · servicios existen · solo falta pantalla · construir UI listar/editar/eliminar
- Caso C · construir desde cero · pantalla bajo `/configuracion/entidades-atribucion` o tab dentro de Proveedores
- **Cascada** · al eliminar · ¿qué pasa con movements/documents que referenciaban esa entidad? Reclasificar como "sin asignar" · NO romper

---

### Sub-tarea 5 · Pérdidas patrimoniales ahorro · UI editar/eliminar

**Tipo** · probablemente UI fiscal existente · prob N/A
**Tiempo** · 30min-2h CC

`perdidasPatrimonialesAhorro` · store fiscal · arrastres y compensaciones.

#### Pre-flight
```bash
grep -rnE "perdidasPatrimoniales" src/modules/horizon/fiscal/ src/services/ 2>/dev/null | head -30
grep -nE "deletePerdida|updatePerdida" src/services/ -r 2>/dev/null
```

#### Plan
- Caso A · módulo fiscal ya tiene UI · N/A
- Caso B · construir UI básica en módulo fiscal

---

### Sub-tarea 6 · Movement learning rules · UI listar/eliminar/desactivar

**Tipo** · servicio existe · UI puede no existir
**Tiempo** · 1-3h CC

Reglas auto-clasificación. Permite al usuario "olvidar" reglas mal aprendidas.

#### Pre-flight
```bash
grep -rnE "movementLearningRules|MovementLearning" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -20
grep -nE "deleteRule|removeLearningRule|disableRule" src/services/ -r 2>/dev/null

# Verificar también dudas TAREA 16 sobre history[]
grep -nE "history\[\]|\.history\b" src/services/movementLearning*.ts 2>/dev/null | head -10
```

#### Plan
1. UI · pantalla en Ajustes o Configuración · "Reglas de clasificación aprendidas"
2. Lista con · patrón aprendido · categoría asignada · count de uso · último uso
3. Acciones · desactivar · eliminar
4. **NO ATACAR TAREA 16** (verificar si `history[]` se escribe) · separado · solo CRUD UI

#### Si N/A
- Documentar dónde está la UI · cerrar

---

### Sub-tarea 7 · Vínculos accesorio · UI editar/eliminar

**Tipo** · servicio + UI · prob construir
**Tiempo** · 1-2h CC

`vinculosAccesorio` · relaciona accesorios (trastero · garaje) con vivienda principal.

#### Pre-flight
```bash
grep -rnE "vinculosAccesorio|VinculosAccesorio" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -20
grep -nE "deleteVinculo|updateVinculo" src/services/ -r 2>/dev/null
```

#### Plan
- Caso A · UI ya existe en pantalla inmueble · N/A
- Caso B · construir UI dentro de DetallePage inmueble · sección "Accesorios vinculados" · listar · vincular · desvincular

---

### Sub-tarea 8 · Traspasos planes pensión · botón crear + UI listar

**Tipo** · UI nueva + limpieza legacy
**Tiempo** · 3-6h CC
**Origen** · GAP 0 falsa alarma audit · re-priorizado MEDIA tras pantallazos Jose V11 (V11.6)

`traspasosPlanPensiones` (V65) · existe · vacío · sin UI para crear traspasos.

#### Pre-flight CRÍTICO · APLICAR V11.6
```bash
# Confirmar que NO hay UI de traspaso ya
grep -rnE "[Tt]raspaso.*[Pp]ension|crear.*traspaso|nuevo.*traspaso" src/ --include="*.tsx" 2>/dev/null | head -20

# Confirmar que traspasosPlanesService legacy es dead code (verificado V11)
grep -rnE "traspasosPlanesService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v test | head -10

# Verificar pantalla plan pensión actual
find src/ -name "*[Pp]lan*[Pp]ension*" -type f 2>/dev/null | head -10
grep -nE "PlanPensionDetalle|PlanesPensionDetalle" src/App.tsx 2>/dev/null
```

#### Plan
1. Botón "Registrar traspaso" en pantalla detalle plan pensión (sección trayectoria)
2. Modal · gestora origen (precargada) · gestora destino · fecha · importe · notas
3. Crear registro en `traspasosPlanPensiones` V65 · NO tocar legacy
4. UI listar traspasos del plan · sección "Traspasos · histórico"
5. Botón eliminar traspaso individual · con confirmación
6. **Limpieza** · eliminar `traspasosPlanesService` legacy + referencias huérfanas (dead code · sin callers reales según verificación V11.6)

#### Cascada
- Eliminar traspaso · ¿afecta a valoraciones · aportaciones? · revisar · probablemente NO afecta · documentar

---

## §3 · Orden de ejecución sugerido (rapidez creciente · N/As primero)

| Orden | Sub-tarea | Tiempo | Razón |
|---|---|---|---|
| 1 | Sub-tarea 5 · Pérdidas patrimoniales | 30min-2h | Posible N/A · módulo fiscal puede tenerlo |
| 2 | Sub-tarea 1 · Objetivos | 30min-2h | Posible N/A · Mi Plan v3 puede tenerlo |
| 3 | Sub-tarea 2 · Retos | 30min-2h | Posible N/A · similar |
| 4 | Sub-tarea 3 · Fondos ahorro | 30min-2h | Posible N/A · similar |
| 5 | Sub-tarea 7 · Vínculos accesorio | 1-2h | UI dentro de DetallePage |
| 6 | Sub-tarea 6 · Learning rules UI | 1-3h | Pantalla nueva |
| 7 | Sub-tarea 4 · Entidades atribución | 2-3h | Construir + cascada |
| 8 | Sub-tarea 8 · Traspasos pensión | 3-6h | Más caro · UI + limpieza legacy |

**Estimación realista** · 3-4 N/As esperables · 4-5 sub-tareas con código · total 6-10h CC.

---

## §4 · Reglas globales · IDÉNTICAS A D-CRUD-ALTA

1. CC arranca por sub-tarea 1 · sigue orden
2. Pre-flight pegado en commit message o PR description final
3. Encadenar sub-tareas en una rama · 1 PR final único
4. NO mergear · esperar Jose
5. Si pre-flight revela divergencia · STOP · reportar en commit
6. NO consolidar duplicidades fuera de scope (saneamientos = otros specs)
7. NO arreglar 43 tests failing pre-existing · solo no degradar
8. DB sigue v70 · NO upgrade

---

## §5 · Criterios de aceptación globales

- [ ] 8 sub-tareas ejecutadas o marcadas N/A con justificación
- [ ] 1 PR final con commits por sub-tarea
- [ ] Cada commit referenciable a su sub-tarea
- [ ] PR description con tabla resumen estado de cada sub-tarea
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa
- [ ] DB_VERSION sigue 70

---

## §6 · Tras merge

| Siguiente | Spec |
|---|---|
| Saneamiento duplicidades · 3 OCR · 5 AEAT · planes wrapper · ingresos fragmentado | S-DUPLICIDADES · varios specs · 5-9h CC total |
| Cerrar BAJA (5 entidades opcionales) | D-CRUD-BAJA · opcional · 3-5h CC |
| TAREAS 8 · 9 · 10 · 12 backlog post-T7 | 4-7h CC · TODOs runtime · activar campos · bootstrap compromisos |
| Volver a estratégico · C-PROY-5 motor 20 años | 16-24h CC |

---

**Fin del spec.**
**Listo para entregar a CC.**
