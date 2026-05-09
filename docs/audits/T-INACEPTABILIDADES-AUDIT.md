# T-INACEPTABILIDADES-AUDIT · panorámico · con lente duplicidades

> **Tipo** · Auditoría · CERO código · CERO migraciones · solo informe
>
> **Tiempo estimado** · 1.5-2h CC
>
> **Output** · 1 archivo nuevo · `docs/audits/T-INACEPTABILIDADES-AUDIT-INFORME.md`
>
> **Cierra** · regla §1-bis del HANDOFF-V11 + lente nueva V11.3 (ver §0 abajo)
>
> **Bloqueado por** · T-WIPE-AUDIT mergeado primero · respeto regla 1 sub-task por PR · NO parallel
>
> **Bloquea** · cualquier spec de implementación sobre · backup · export · edición de datos importados · reset · porque sin este audit cualquier spec sería contra suposiciones

---

## §0 · LENTE NUEVA · diagnóstico Jose 2026-05-09

> **Lección Jose** · "las auditorías son focos de problemas pq cuentan verdades a medias · cuando dicen que existen cosas · sí existen · pero hay tanta cosa usada duplicada dejada de usar vuelta a crear algo similar"

Los audits previos (T-PERSONAL-AUDIT · T-PROYECCION-AUDIT · T-MIPLAN-CONFIG-AUDIT · T-AUDIT-9) verifican **¿X existe?** y **¿X funciona?**. NO verifican **¿X es la única vía?** · **¿hay duplicados?** · **¿hay legacy paralelo?**.

**Resultado** · audits dan luz verde a "X existe · funciona" cuando la realidad es "X existe · funciona · pero hay otras 2 versiones similares dejadas de usar · 1 más reciente sin terminar · y 1 mock que parece real". El próximo Claude lee el audit · cree que X es canónico · construye encima · arrastra duplicidades.

**Ejemplos del propio repo:**
- `escenarioService` (mock) vs `escenariosService` (real · plural · singleton id=1) · 822 líneas mock dieron luz verde como "servicio escenarios" hasta C-PROY-1 V10
- `ProjectionChart` huérfano vs `ProjectionChart` vivo · mismo nombre · uno dead code
- `ProyeccionComparativa` singular vs `ProyeccionComparativas` plural · uno cableado · otro mockup
- `inversiones[tipo='plan_pensiones']` vs `planesPensionInversion` · doble escritura · audit T7-bis no lo cazó hasta TAREA 13
- `learningLogs` absorbido por `movementLearningRules.history[]` en T7 · TAREA 16 sigue sin confirmar si `history[]` realmente se escribe
- 11 subdirectorios horizon vivos junto a v5 nuevo · T20 Phase 4 quedó como "parte 1" · parte 2 nunca se ejecutó

### Regla canónica nueva V11.3 · OBLIGATORIA en este audit y todos los futuros

Para cualquier pieza/concepto/funcionalidad que se vaya a auditar · CC responde **5 preguntas** · NO 2 ·

1. **¿Existe en código?** (sí · no · parcialmente)
2. **¿Cuántas implementaciones distintas hay?** (1 = canónica · 2+ = duplicidad · 0 = falta)
3. **Para cada implementación · ¿está viva?** (grep duro de imports · uso real · botones que la disparan · regla canónica V8)
4. **Si hay 2+ · ¿cuál es la canónica · cuáles son legacy a eliminar?** (criterios · más reciente · más usada · más documentada · más cableada a UI vista)
5. **¿Hay dead code residual o módulos horizon/v5 paralelos?** (T20 parte 2 deuda · subdirectorios huérfanos)

**Si CC marca "X existe · funciona" sin haber respondido las 5 preguntas · audit DEFECTUOSO · rehacer.**

---

## 1 · Contexto

Jose detectó (sesión V11 · 2026-05-09) un patrón sistémico de "inaceptabilidades" del mismo nivel que la falta de wipe · todas bloquean uso normal · todas pueden tener duplicidades ocultas tras audits superficiales previos.

Las inaceptabilidades a auditar ·

| Letra | Inaceptabilidad | Por qué importa |
|---|---|---|
| **A** | Importaciones no funcionan bien | XML AEAT · Rentila · extractos bancarios · OCR · FEIN · si fallan · datos malformados al entrar · sin recovery |
| **B** | No poder exportar todos los datos | Sin backup · si DB se corrompe Jose pierde meses dogfooding · cliente final no compra SaaS sin export |
| **C** | No poder reimportar/restaurar desde un export | Sin restore · backup no sirve · es función simétrica obligatoria de B |
| **D** | Datos importados no se pueden eliminar/editar/corregir | Contratos · movimientos · documentos · préstamos · inversiones · planes pensión · si se importó mal · datos atrapados |

NO se incluye en este audit · wipe (TAREA 11 · cubierto por T-WIPE-AUDIT en curso).

---

## 2 · Pre-flight obligatorio · CC ejecuta y pega output literal

### 2.1 · Inventario de importaciones existentes hoy

```bash
# Servicios/parsers de importación
find src/ -type f -name "*[Ii]mport*" -o -name "*[Pp]arser*" -o -name "*[Oo]cr*" 2>/dev/null | head -50
```

```bash
# Botones/rutas que disparan importaciones
grep -rnE "Importar|Subir.*archivo|Cargar.*XML|Cargar.*PDF|importBatches" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -50
```

```bash
# Stores donde se persiste lo importado
grep -rnE "snapshotsDeclaracion|importBatches|movements.*importedFrom|documents.*ocr" src/services/db.ts src/database/initDB.ts 2>/dev/null
```

### 2.2 · Búsqueda de export/download/backup

```bash
# Servicios o utilidades de export
grep -rnE "export[A-Z]|downloadCSV|downloadJSON|backup|toFile|saveToFile|blob.*download" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -50
```

```bash
# Botones UI tipo "Exportar" "Descargar"
grep -rnE ">.{0,3}Exportar|>.{0,3}Descargar|>.{0,3}Download|>.{0,3}Backup" src/ --include="*.tsx" 2>/dev/null | head -30
```

### 2.3 · Búsqueda de restore/import-from-backup

```bash
grep -rnE "restore|loadBackup|importBackup|fromBackup|restoreFromFile|loadJSON" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -30
```

### 2.4 · UI edición/eliminación de entidades importadas

Por cada entidad principal · ¿hay UI/servicio que permita editar y eliminar?

```bash
# Contratos
grep -rnE "deleteContract|removeContract|editContract|updateContract" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Movements
grep -rnE "deleteMovement|removeMovement|editMovement|updateMovement|reclasifyMovement" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Documents
grep -rnE "deleteDocument|removeDocument|editDocument|reprocessOCR" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Préstamos
grep -rnE "deletePrestamo|removePrestamo|editPrestamo|updatePrestamo" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Inversiones
grep -rnE "deleteInversion|removeInversion|editInversion|updateInversion" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Planes pensión
grep -rnE "deletePlanPension|removePlan|editPlan|updatePlan" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
```

### 2.5 · LENTE NUEVA · búsqueda de duplicidades por naming similar

```bash
# Servicios con nombres similares · candidato a duplicidad
ls src/services/ 2>/dev/null | sort | uniq -c | sort -rn | head -30
```

```bash
# Misma búsqueda en módulos horizon/v5
find src/modules/horizon/ src/modules/v5/ -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs basename -a 2>/dev/null | sort | uniq -c | sort -rn | head -30
```

```bash
# Servicios con sufijos típicos de duplicidad · v2 · old · legacy · new · backup
grep -rnE "service.*v2\b|service.*old\b|service.*legacy\b|service.*new\b|service.*backup\b" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -30
```

```bash
# Imports cruzados horizon ↔ v5 · indicador legacy paralelo
grep -rnE "from.*horizon/" src/modules/v5/ 2>/dev/null | head -30
grep -rnE "from.*v5/" src/modules/horizon/ 2>/dev/null | head -10
```

### 2.6 · Verificación dead code post-T20 Phase 4 parte 1

```bash
# Subdirectorios horizon vivos · cuántos
ls -la src/modules/horizon/ 2>/dev/null
```

```bash
# TODOs heredados
grep -rnE "TODO.*[Tt]20|TODO.*[Pp]hase 4|TODO.*legacy|TODO.*horizon" src/ 2>/dev/null | head -30
```

---

## 3 · Output esperado · estructura informe

CC crea `docs/audits/T-INACEPTABILIDADES-AUDIT-INFORME.md` con esta estructura ·

### §A · Inaceptabilidad A · Importaciones · matriz 5 preguntas

Tabla por cada tipo de importación detectado (XML AEAT · Rentila · OCR factura · FEIN · extracto bancario · cualquier otro descubierto en grep) ·

| Importación | ¿Existe? | ¿Cuántas implementaciones? | Para cada · ¿viva? | Canónica · legacy a eliminar | Dead code residual |
|---|---|---|---|---|---|

Mínimo 5 frases justificando por importación.

### §B · Inaceptabilidad B · Export/Backup · matriz 5 preguntas

¿Existe export hoy? Mismo formato matriz 5 preguntas. Si NO existe · señalarlo claro · es construir desde cero.

### §C · Inaceptabilidad C · Restore/Import desde backup · matriz 5 preguntas

¿Existe restore? Mismo formato. Probablemente NO · pero verificar duplicidades de "loadFromFile" · "importFromJSON" · etc.

### §D · Inaceptabilidad D · Edición/Eliminación de datos importados · matriz por entidad

Tabla por cada entidad principal · 5 preguntas en columnas ·

| Entidad | ¿Existe edición? | ¿Existe eliminación? | ¿Cuántas implementaciones? | Canónica · legacy | Dead code |
|---|---|---|---|---|---|
| Contratos | | | | | |
| Movements | | | | | |
| Documents | | | | | |
| Préstamos | | | | | |
| Inversiones | | | | | |
| Planes pensión | | | | | |
| Otros descubiertos | | | | | |

### §E · Mapa de duplicidades sistémicas detectadas

Lista cerrada de duplicidades + legacy + dead code que NO entran en A/B/C/D pero sí son patrón sistémico ·

| Duplicidad | Ubicaciones | Canónica propuesta | Acción · eliminar / fusionar / mantener |
|---|---|---|---|

Ejemplo · si se descubre que hay 2 servicios de OCR (`ocr-fein.ts` + `ocr-fein-bg.ts` + restos de `ocr-fein-old.ts`) · listar.

### §F · Veredicto final · cuál atacar primero

CC propone orden de prioridad considerando ·

1. Cuál es más urgente para Jose dogfooder (uso real)
2. Cuál tiene más duplicidades a limpiar (oportunidad de saneamiento)
3. Cuál tiene más dependencias entre sí (B y C son simétricas · atacar juntas)
4. Cuál se puede atacar sin construir desde cero (reaprovechar lo existente)

Veredicto · una de estas cinco rutas ·

- **R1** · Atacar A primero (importaciones) · saneando duplicidades en OCR/parsers
- **R2** · Atacar B+C juntas (export+restore) · construyendo desde cero si no existe
- **R3** · Atacar D primero (edición) · porque más urgente para Jose dogfooder hoy
- **R4** · Mezcla · primero D (edición · porque es lo que Jose detectó hoy) + B+C en paralelo
- **R5** · Otra propuesta razonada por CC

---

## 4 · Reglas de ejecución

1. **CERO código modificado** · solo informe en `docs/audits/`
2. **Pegar output LITERAL de comandos del §2** · NO resumir
3. **Aplicar regla 5 preguntas (§0) literal** · si CC marca "X existe · funciona" sin las 5 · audit defectuoso
4. **Stop-and-wait** · CC abre PR · NO mergea · espera Jose
5. **Si surge inconsistencia grave** · DETENERSE y reportar
6. **Tiempo estimado** · 1.5-2h CC · si pasa de 3h · DETENERSE y reportar
7. **Si encuentras una duplicidad NO contemplada** · documentarla en §E · NO inventar criterio para "qué eliminar" · solo proponer · decisión es de Jose

---

## 5 · Criterios de aceptación

- [ ] Pre-flight §2 ejecutado · output pegado literal en informe
- [ ] §A · matriz importaciones · mínimo 4 tipos auditados con 5 preguntas
- [ ] §B · matriz export/backup con 5 preguntas
- [ ] §C · matriz restore con 5 preguntas
- [ ] §D · matriz edición/eliminación · 6+ entidades con 5 preguntas
- [ ] §E · lista cerrada de duplicidades sistémicas
- [ ] §F · veredicto · ruta R1/R2/R3/R4/R5 · justificada
- [ ] PR contra `main` con UN solo archivo · `docs/audits/T-INACEPTABILIDADES-AUDIT-INFORME.md`
- [ ] PR description con resumen ejecutivo · 5 líneas

---

## 6 · Tras merge de este audit

| Veredicto | Acción Jose+Claude |
|---|---|
| R1 importaciones | Claude redacta spec saneamiento importaciones · 2-4h CC |
| R2 backup+restore | Claude redacta spec backup/restore desde cero · 6-10h CC |
| R3 edición datos | Claude redacta spec edición/eliminación de N entidades · 8-15h CC |
| R4 D + (B+C) paralelo | 2 specs · más sesiones |
| R5 otra | Según propuesta CC |

En cualquier caso · cada spec posterior debe aplicar la regla 5 preguntas para evitar repetir el patrón.

---

## 7 · Nota para HANDOFF V11

Este audit valida la **regla canónica nueva V11.3** · 5 preguntas obligatorias en cada audit. Si funciona bien · incorporarla a §1-bis del V11 como regla permanente para próximos Claudes.

Propuesta literal para añadir a V11 §1-bis ·

```
REGLA V11.3 · OBLIGATORIA en TODOS los audits futuros · 5 preguntas, NO 2 ·

1. ¿Existe en código?
2. ¿Cuántas implementaciones distintas hay? (1 canónica · 2+ duplicidad · 0 falta)
3. Para cada implementación · ¿está viva? (regla canónica grep duro V8)
4. Si hay 2+ · ¿cuál es la canónica · cuáles son legacy a eliminar?
5. ¿Hay dead code residual o módulos horizon/v5 paralelos?

Si CC marca "X existe · funciona" sin responder las 5 · audit DEFECTUOSO · rehacer.

Razón · audits previos contaron "verdades a medias" · daban luz verde sin verificar 
duplicidades · resultado · construcción sobre código duplicado · ejemplos · escenarioService 
mock vs real · ProjectionChart huérfano vs vivo · 11 subdirectorios horizon vs v5 · etc.
```

---

**Fin del spec.**
**Listo para entregar a CC tras merge T-WIPE-AUDIT.**
