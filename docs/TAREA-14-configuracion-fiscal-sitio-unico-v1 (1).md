# TAREA CC · TAREA 14 · Configuración fiscal · sitio único · v1

> **Tipo** · auditoría + documentación + refactor menor (solo si aparece duplicación real)
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama** · crear `feature/configuracion-fiscal-sitio-unico` desde `main`
>
> **Tiempo estimado**
> - **CC real** · 10-30 min (la mayoría auditoría + escritura del MD · refactor solo si aparece)
> - **Tu revisión** · 30-45 min
> - **Horas-humanas equivalentes** · 1-2h
>
> **Prioridad** · MEDIA · cierra el bloque fiscal del titular abierto por T13 · base para tareas fiscales futuras
>
> **Predecesor** · TAREA 13 v4 mergeada en `main`
>
> **DB de partida** · DB_VERSION 68 · 40 stores
>
> **DB tras esta tarea** · DB_VERSION 68 · 40 stores · **NO se sube versión** salvo que aparezca duplicación que requiera schema cleanup (en ese caso · CC para y reporta antes de tocar)

---

## 1 · Contexto · qué resuelve esta tarea

Hoy los datos fiscales del titular están repartidos en 5-6 stores. **NO hay duplicación grave** (la auditoría T7-bis lo confirmó) · pero sí hay **confusión sobre dónde mirar** cuando llega cualquier feature fiscal nueva. Tras T13 (que añade `planesPensiones.participeConDiscapacidad`) · esa confusión puede empezar a divergir si nadie blinda las fronteras.

**Objetivo** · convertir ATLAS en un sitio donde **cada dato fiscal del titular tiene UN solo dueño** y queda documentado formalmente · de forma que:
- Cualquier feature fiscal futura sepa exactamente dónde leer y escribir
- Cualquier auditoría posterior pueda verificar que las fronteras se respetan
- El siguiente Claude no caiga en confusión sobre "¿esto va en personalData o en viviendaHabitual?"

---

## 2 · Auditoría obligatoria ANTES de codear

⚠️ **CRÍTICO · NO proceder sin completar esta sección.**

Antes de tocar nada · CC debe verificar:

### 2.1 · Estado real del repo

```bash
# Confirmar versión y stores
grep -n "DB_VERSION" src/services/db.ts | head -5
# Esperado · DB_VERSION = 68

# Confirmar stores activos
grep -n "createObjectStore\|objectStoreNames" src/services/db.ts | wc -l
# Esperado · ~40 stores activos
```

### 2.2 · Mapeo de campos fiscales del titular · grep exhaustivo

Para cada uno de los 6 stores listados en §3 · ejecutar:

```bash
# 1. Ver schema actual del store
grep -n "<storeName>" src/services/db.ts | head -20

# 2. Ver interface TypeScript del store
grep -n "interface .*<StoreCapitalized>" src/types/ src/services/

# 3. Ver escritores activos (servicios que llaman put/add al store)
grep -rn "<storeName>.*put\|<storeName>.*add" src/ --include="*.ts" --include="*.tsx"

# 4. Ver lectores activos (servicios que llaman get/getAll al store)
grep -rn "<storeName>.*get\|<storeName>.*getAll" src/ --include="*.ts" --include="*.tsx"
```

### 2.3 · Reportar antes de codear

Si la auditoría detecta:
- **Duplicación real** (mismo dato fiscal escrito en 2 stores) → PARAR · documentar · esperar input Jose
- **Tipos divergentes** (mismo concepto con tipos distintos en stores distintos) → reportar
- **Campos huérfanos** (escritos pero nunca leídos · o viceversa) → reportar
- **Datos en `keyval` con prefijo fiscal** (`configFiscal`, `taxConfig`, etc.) → reportar destino propuesto

Si NO se detecta nada problemático · proceder a §4 (escritura del documento canónico).

---

## 3 · Stores objeto de auditoría

### 3.1 · `personalData` (singleton · 1 registro en producción)

**Frontera propuesta · sitio único del PERFIL fiscal del titular**

Campos esperados:
- Identificación · DNI/NIF · nombre · apellidos · fecha nacimiento
- Fiscalidad territorial · CCAA · tipo tributación (individual · conjunta · separada)
- Familia · descendientes (ascendientes · número · edades · discapacidad)
- Discapacidad · grado del titular
- Situación laboral (asalariado · autónomo · pensionista · paro · etc.)

**Lo que NO debe estar aquí** · workflow anual fiscal · datos vivienda · KPIs Mi Plan · pestañas UI

### 3.2 · `viviendaHabitual` (vacío en producción)

**Frontera propuesta · sitio único de DATOS DE VIVIENDA fiscal del titular**

Campos esperados:
- Dirección · CCAA · municipio
- Régimen (propiedad · alquiler)
- Si propiedad · datos catastrales · fecha adquisición
- Deducción autonómica vivienda (si aplica)
- Vigencia temporal · desde/hasta

**Lo que NO debe estar aquí** · perfil del titular · workflow fiscal anual

### 3.3 · `ejerciciosFiscalesCoord` (5 registros)

**Frontera propuesta · sitio único del WORKFLOW fiscal anual**

Campos esperados:
- Año
- Estado (en_curso · pendiente · declarado · prescrito)
- Versión (v1 original · v2 corregido por inspección · vN+1)
- Fechas clave · presentación · resolución inspección · prescripción

**Lo que NO debe estar aquí** · perfil del titular · datos de cálculo (eso es derivado)

### 3.4 · `escenarios` (singleton)

**Frontera propuesta · KPIs fiscales OBJETIVO de Mi Plan · NO del titular real**

Campos esperados:
- Hipótesis · ahorro mensual objetivo · rentabilidad esperada · horizonte
- KPIs deseados · patrimonio objetivo · independencia financiera

**Lo que NO debe estar aquí** · datos reales del titular · workflow fiscal · vivienda

### 3.5 · `personalModuleConfig` (1 registro)

**Frontera propuesta · UI · pestañas activas del módulo Personal · NADA fiscal**

**Lo que NO debe estar aquí** · ningún dato fiscal · ningún dato del perfil del titular

### 3.6 · `keyval['configFiscal']` (verificar · debería estar vacío)

Tras T7 sub-tarea 3 · `configuracion_fiscal` se eliminó y se redirigió a `personalData`. La clave `keyval['configFiscal']` NO debería existir.

**Acción** · verificar que NO se escribe en ningún sitio. Si hay escritores activos · reportar como duplicación.

---

## 4 · Output principal · documento canónico

Crear `docs/MAPEO-FISCAL-titular-V68.md` con la siguiente estructura:

### 4.1 · Estructura del documento

```markdown
# MAPEO FISCAL del titular · V68 · sitio único

> Documento canónico · referencia formal para todas las tareas fiscales futuras.
> 
> Cada dato fiscal del titular tiene UN solo dueño. Si encuentras un dato 
> escribiéndose o leyéndose desde un store distinto al documentado aquí · 
> es un BUG.
>
> Generado · YYYY-MM-DD · DB_VERSION 68 · 40 stores

## 1 · Tabla maestra · campo → store responsable

| Categoría | Campo | Store responsable | Escritor único | Lectores |
|---|---|---|---|---|
| Identificación titular | DNI · NIF | personalData | personalDataService | dashboardService · ... |
| Identificación titular | Nombre · apellidos | personalData | personalDataService | ... |
| Fiscalidad territorial | CCAA | personalData | personalDataService | irpfCalculationService · ... |
| ... | ... | ... | ... | ... |

(Tabla completa · todos los campos auditados con referencia archivo:línea)

## 2 · Fronteras formales · qué store es responsable de qué

### personalData
- ✅ Es responsable de · perfil fiscal del titular
- ❌ NO es responsable de · workflow anual · datos vivienda · KPIs Mi Plan · UI

### viviendaHabitual
...

### ejerciciosFiscalesCoord
...

### escenarios
...

### personalModuleConfig
...

### keyval['configFiscal']
- Estado · NO existe · NO se escribe · NO se lee
- Si aparece en producción · es residuo de migración antigua · ELIMINAR

## 3 · Cobertura post-T13

T13 añadió `planesPensiones.participeConDiscapacidad`. Verificación · 
- ¿Solapa con `personalData.discapacidad`? [SÍ/NO · explicación]
- Si SÍ · cuál es la fuente de verdad · cuál es derivado

## 4 · Reglas para futuras tareas

1. Antes de añadir un campo fiscal · verificar en este documento dónde le toca
2. Si un campo no encaja en ninguna frontera · proponer extensión de este documento
3. NUNCA escribir el mismo dato fiscal en 2 stores
4. NUNCA usar keyval para datos fiscales

## 5 · Output del grep · evidencia

(Resultado bruto del grep ejecutado en §2.2 · para trazabilidad)
```

### 4.2 · Actualizar `STORES-V60-ACTIVOS.md`

En cada uno de los 6 stores afectados (§3) · añadir línea con:
```
**Frontera fiscal:** [resumen de §4.1 sección 2 del documento canónico]
```

---

## 5 · Refactor (SOLO si aparece duplicación real)

⚠️ **Si la auditoría §2 NO detecta duplicación · saltar esta sección.**

Si SÍ aparece duplicación:

### 5.1 · Reportar primero
- Documentar la duplicación detectada · campo · stores · escritores · lectores
- Proponer destino único
- Esperar autorización Jose

### 5.2 · Refactor mínimo
- Consolidar el dato al store correcto (según §3)
- Adaptar consumidores
- Eliminar el escritor duplicado
- Tests · verificar lectura única
- Si cambia schema · DB_VERSION sube a 69 (esto requiere autorización Jose explícita · NO automática)

---

## 6 · Reglas inviolables

1. **NO bumpear DB_VERSION** salvo que aparezca duplicación que requiera schema cleanup · y solo con autorización Jose
2. **NO crear stores nuevos**
3. **NO refactorizar fuera del scope** · solo los stores listados en §3
4. **NO tocar `ejerciciosFiscalesCoord`** salvo lectura · su workflow es de otra TAREA
5. **NO tocar `escenarios`** salvo lectura · es dominio Mi Plan
6. **NO tocar lógica de cálculo fiscal** · esta tarea es solo fronteras
7. **Si surge ambigüedad** · PARAR · documentar · esperar input Jose
8. **Si la auditoría detecta que algo del documento STORES-V60-ACTIVOS.md está incorrecto en realidad** · reportar antes de actualizar
9. **Stop-and-wait** · NO mergear · esperar autorización Jose

---

## 7 · Lo que esta tarea NO hace

- ❌ NO toca **lógica de cálculo fiscal** (eso es T13 + tareas futuras)
- ❌ NO toca **UI de "Datos fiscales del titular"** (eso sería otra TAREA)
- ❌ NO crea **stores nuevos**
- ❌ NO toca **`escenarios`** salvo lectura (es dominio Mi Plan · su propia TAREA si hay refactor)
- ❌ NO toca **`ejerciciosFiscalesCoord`** salvo lectura (workflow anual · TAREA futura)
- ❌ NO toca **inspecciones / paralelas** (TAREA futura · "inspección correction cascade")
- ❌ Idealmente NO **sube DB_VERSION**
- ❌ NO consolida **datos vivienda** con perfil titular (son fronteras separadas a propósito)

---

## 8 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main` (post-T13 v4)
- DB_VERSION 68 · 40 stores
- `docs/STORES-V60-ACTIVOS.md` · estado documentado de los 39 stores post-T7
- `docs/AUDIT-39-stores-V60.md` · auditoría profunda T7-bis (si existe)
- Auditoría T7-bis confirmó NO hay duplicación grave hoy · solo confusión

---

## 9 · Verificación post-deploy

### 9.1 · Tests automáticos obligatorios

- DB_VERSION = 68 (sin cambios)
- 40 stores activos (sin cambios)
- `docs/MAPEO-FISCAL-titular-V68.md` existe y tiene la estructura §4.1
- `docs/STORES-V60-ACTIVOS.md` actualizado con frontera fiscal en cada store afectado
- Si hubo refactor (sección 5) · tests de lectura única pasan · sin regresión

### 9.2 · Verificación manual de Jose

**Verificación 1 · Documento canónico**
- Abrir `docs/MAPEO-FISCAL-titular-V68.md` · estructura clara · 5 secciones
- Tabla maestra · al menos los campos básicos cubiertos (DNI · CCAA · tributación · descendientes · discapacidad · CIF empresa empleo · etc.)
- Cada store tiene frontera explícita "es responsable de X" · "NO es responsable de Y"
- Cobertura post-T13 · resuelve la pregunta sobre `planesPensiones.participeConDiscapacidad`

**Verificación 2 · STORES-V60-ACTIVOS.md actualizado**
- Los 6 stores afectados tienen línea "Frontera fiscal" añadida
- Coherente con el documento canónico

**Verificación 3 · keyval limpio**
- DevTools · `keyval['configFiscal']` NO existe
- Si existía · ha sido eliminado y documentado

**Verificación 4 · Si hubo refactor**
- DevTools · datos en el sitio correcto
- App arranca sin errores
- Funcionalidad existente sigue funcionando

---

## 10 · Pull Request

PR único contra `main` · título · `docs(fiscal): mapeo formal titular · sitio único · DB v68`

Si solo hay documentación · 1-2 commits:
- Commit 1 · `docs(fiscal): MAPEO-FISCAL-titular-V68.md · sitio único + auditoría grep`
- Commit 2 (opcional) · `docs(stores): añadir frontera fiscal en STORES-V60-ACTIVOS.md`

Si hubo refactor · commits adicionales · uno por refactor.

Descripción del PR:
- Resumen de auditoría · ¿hubo duplicación real?
- Si NO · solo documentación
- Si SÍ · qué se consolidó
- Tests pasados
- Confirmación · DB_VERSION sin cambios

**STOP-AND-WAIT · NO mergear · esperar autorización Jose tras revisar el documento.**

---

## 11 · Criterios de aceptación

### Globales
- [ ] PR contra `main` · 1-3 commits según haya o no refactor
- [ ] DB_VERSION = 68 (sin cambios)
- [ ] 40 stores activos (sin cambios)
- [ ] `docs/MAPEO-FISCAL-titular-V68.md` creado y estructurado
- [ ] `docs/STORES-V60-ACTIVOS.md` actualizado en los 6 stores afectados
- [ ] Si hubo refactor · tests pasan · funcionalidad preservada
- [ ] tsc --noEmit pasa
- [ ] App arranca sin errores

---

## 12 · Reglas operativas

- **Si la auditoría §2 detecta duplicación o ambigüedad** · PARAR · documentar · esperar input Jose · NO arreglar sin autorización
- **Si los grep no encuentran resultados esperados** (ej. `personalData` sin escritores) · reportar · puede ser señal de bug
- **NO inventar fronteras** · si un campo no encaja claramente en ninguno de los 6 stores · marcarlo en el documento con TODO y esperar input Jose
- **NO refactorizar fuera de los 6 stores listados**
- **El documento canónico es la verdad** · si STORES-V60-ACTIVOS.md está desactualizado · actualizarlo · no al revés
- **Stop-and-wait** · NO mergear · esperar autorización Jose

---

## 13 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Auditoría detecta duplicación grave que requiere refactor mayor | Baja · T7-bis ya descartó | Si aparece · PARAR · reportar · autorizar con Jose |
| Tipos divergentes (CCAA en personalData es 'CAT' · en escenarios es 'Cataluña') | Media | Reportar · proponer normalización · NO normalizar sin autorización |
| Campo huérfano (escrito pero no leído) | Media | Reportar · puede ser código muerto · candidato a eliminar en TAREA futura |
| `keyval['configFiscal']` aún se escribe desde algún sitio | Baja | Reportar · proponer destino · eliminar el escritor |
| Tarea se infla en alcance | Baja · scope acotado a 6 stores | Spec marca cero refactor fuera de scope |

---

## 14 · Si todo falla · plan B

Si tras deploy hay regresión:
1. Si fue solo documentación · `git revert` no es necesario · documentación no rompe
2. Si hubo refactor que rompió algo · `git revert` del PR
3. App vuelve a estado pre-T14
4. Documentar bug · re-planificar

---

## 15 · Después de TAREA 14

1. Jose verifica `MAPEO-FISCAL-titular-V68.md` · coherente con su modelo mental
2. Jose verifica que los 6 stores tienen frontera explícita
3. Jose autoriza merge si todo OK
4. El documento canónico se cita en TODAS las tareas fiscales futuras (T13 v5 si hubiera · T-inspeccion-correction-cascade · T-calendario-fiscal · etc.)
5. Jose decide siguiente TAREA del backlog (T34/T35-fix-2 · T16 · T36 · etc.)

---

## 16 · Cómo lanzar esta TAREA a CC

```
@CC ejecuta el spec de TAREA-14-configuracion-fiscal-sitio-unico-v1.md
Auditoría obligatoria SECCIÓN 2 antes de codear
Verificar DB_VERSION actual = 68 · 40 stores
Predecesor T13 v4 mergeado en main
Si la auditoría detecta duplicación · PARAR y reportar · NO arreglar sin autorización
Si NO hay duplicación · solo escribir documento canónico · 1-2 commits
1 PR único · stop-and-wait · 10-30 min CC
NO mergear · esperar autorización Jose
```

---

**Fin de la spec v1 · esperar PR · verificación Jose post-deploy · cerrar TAREA 14.**
