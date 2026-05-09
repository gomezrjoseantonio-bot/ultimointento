# T-COMPROMISOS-AUDIT · pieza compromisos recurrentes · estado real

> **Tipo** · Auditoría dedicada · CERO código modificado · CERO migraciones · solo informe
>
> **Tiempo estimado** · 30-60 min CC · si pasa de 90 min · DETENERSE
>
> **Output** · 1 archivo nuevo · `docs/audits/T-COMPROMISOS-AUDIT-INFORME.md`
>
> **Cierra** · regla V11.7 · cada funcionalidad sospechada de tener verdad superficial requiere audit dedicado
>
> **Bloquea** · cualquier spec sobre compromisos recurrentes · catálogo · materialización · detección · sin este audit cualquier spec sería contra suposiciones

---

## §0 · Lente del audit · aplicación literal V11.7

> **Lección Jose 2026-05-09 V11** · "la UI para crear gastos recurrentes existe tanto para personal como para inmuebles · pero falta catálogo · falta verificar confirmación al store · falta que los gastos materializados se vean en vista inmueble/personal · creo que merece revisión exhaustiva no hacer algo sin saber"

Audit T-CRUD-AUDIT (mergeado V11) marcó sub-tarea 5 D-CRUD-ALTA "compromisos UI existe · N/A" porque encontró `ListadoGastosRecurrentes` + `EditDrawer` con servicios `actualizarCompromiso` + `eliminarCompromiso`. **Pero solo verificó UI de edición/eliminación · NO ·**

- ¿Existe catálogo de plantillas estándar (IBI · comunidad · seguros · suministros · etc)?
- ¿Confirmación de un compromiso "sugerido" lo persiste correctamente?
- ¿Los cargos materializados (gastos reales que se generan al ejecutar el patrón) aparecen en alguna vista?
- ¿El botón "Detectar" (visible en personal · NO en inmueble · imagen 2 Jose) qué hace?

Es exactamente "verdades a medias" del audit panorámico. Este audit cierra ese hueco.

**Regla operativa** · NO asumir que el audit T-CRUD anterior es la verdad completa. Verificar EN GREP DURO cada uno de los 4 ejes con datos reales. Aplicar V11.3 (5 preguntas) en cada eje.

---

## §1 · Contexto

Pantallazos Jose 2026-05-09 muestran UI compromisos en producción ·

| Vista | Elementos visibles |
|---|---|
| Inmueble Fuertes Acevedo · pestaña Gastos | KPIs (-902€/mes · -10.829€/año · próximo cargo 29 may) · botón "Nuevo gasto recurrente" · 8 patrones activos · filtros por categoría · lista expandible · "ACTIVO" como estado · acciones edit/delete por fila |
| Personal · pestaña Gastos | KPIs (-3515€/mes · -42.184€/año · próximo cargo 10 may) · botón "Nuevo gasto recurrente" · botón "Importar" · botón "Detectar" · 16 patrones activos · filtros · lista por categoría con sumatorios |

**Asimetría detectada** · botón "Detectar" e "Importar" SOLO en personal · NO en inmueble. Audit debe explicar.

DB v70 · 40 stores · sin upgrade en este audit.

---

## §2 · Pre-flight obligatorio · CC ejecuta y pega output literal

### §2.1 · Eje 1 · Catálogo de plantillas

```bash
# ¿Existe store/servicio de plantillas estándar para gastos recurrentes?
grep -rnE "plantillaGasto|gastoTemplate|catalogoGastos|templateRecurrente|catalogo.*compromiso" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Constantes con plantillas
grep -rnE "IBI.*Anual|comunidad.*Mensual|seguro.*Anual" src/services/ src/constants/ 2>/dev/null | head -20

# UI "Nuevo gasto recurrente" · ¿tiene paso "elegir plantilla"?
find src/ -type f -name "*[Nn]uevo*[Gg]asto*" -o -name "*[Cc]ompromiso*[Ww]izard*" -o -name "*[Cc]rear*[Gg]asto*" 2>/dev/null | head -10

# Wizard inicial · qué campos pide
grep -rnE "wizardSteps|stepCatalogo|elegirPlantilla|plantilla[A-Z]" src/modules/ 2>/dev/null | head -15
```

### §2.2 · Eje 2 · Confirmación al store

```bash
# Servicio compromisos · qué métodos expone hoy
grep -nE "^export" src/services/compromisosRecurrentesService.ts 2>/dev/null

# Estados del compromiso · sugerido · confirmado · activo · inactivo
grep -rnE "estado.*compromiso|compromiso.*estado|'sugerido'|'confirmado'|'activo'.*compromiso" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Flujo creación · ¿qué store toca?
grep -rnE "db\.put\('compromisosRecurrentes'|db\.add\('compromisosRecurrentes'" src/ 2>/dev/null

# Flujo modificación
grep -rnE "actualizarCompromiso|updateCompromiso" src/services/ 2>/dev/null

# Verificar EditDrawer real · ¿qué hace al guardar?
find src/ -type f -name "*EditDrawer*" -path "*[Cc]ompromiso*" 2>/dev/null
```

### §2.3 · Eje 3 · Materialización · gastos generados desde el patrón

```bash
# Servicio de materialización · genera treasuryEvents desde patrón
grep -rnE "materializar|generarCargo|ejecutarCompromiso|generateRecurrentEvents|expandPattern" src/services/ --include="*.ts" 2>/dev/null | head -20

# Cargos del patrón vistos como gastos reales
grep -rnE "cargosCompromiso|cargosMaterializados|cargoEjecutado|patronCargo" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Vista personal/inmueble · ¿muestra gastos materializados?
grep -rnE "gastosMaterializados|cargosEjecutados" src/modules/ 2>/dev/null | head -10

# treasuryEvents asociados a un compromiso
grep -rnE "compromisoId|patronId" src/services/treasury* 2>/dev/null | head -20
```

### §2.4 · Eje 4 · Botón "Detectar" · qué hace

```bash
# UI botón Detectar
grep -rnE ">.{0,3}Detectar" src/ --include="*.tsx" 2>/dev/null | head -10

# Servicio detección · qué hace
grep -rnE "detectarCompromisos|detectarRecurrentes|detectPatterns|patternDetection" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Fuente de detección · movements · gastosInmueble · etc
grep -rnE "from.*movements|from.*gastosInmueble" src/services/*Detect*.ts 2>/dev/null | head -10

# Asimetría inmueble vs personal · botón Detectar solo personal según pantallazo Jose
grep -rnE "Detectar.*personal|Detectar.*inmueble" src/modules/ 2>/dev/null | head -10
```

### §2.5 · Lente extra · Asimetría inmueble vs personal

```bash
# Comparar UI de las 2 vistas
find src/ -type f \( -name "*Gastos*Page*" -o -name "*Gastos*Personal*" -o -name "*Gastos*Inmueble*" \) 2>/dev/null | head -10
```

### §2.6 · Lente extra · Comparativa patrón vs real

Cruzar con modelo cerrado V8/V9 P8.2 · "ATLAS aprende anual · resumen + cliente decide · NO modifica patrón sin permiso". ¿Está implementado?

```bash
grep -rnE "patron.*real|comparativaCompromiso|aprenderPatron" src/services/ 2>/dev/null | head -15
```

---

## §3 · Output esperado · estructura informe

CC crea `docs/audits/T-COMPROMISOS-AUDIT-INFORME.md` con esta estructura ·

### §A · Eje 1 · Catálogo de plantillas · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe en código? | Sí · No · Parcial · ruta + líneas |
| 2 · ¿Cuántas implementaciones? | 1 · 2+ · 0 |
| 3 · ¿Está viva? | Imports productivos · UI cableada |
| 4 · Si 2+ · canónica vs legacy | Cuál mantener |
| 5 · Dead code residual | Existe · no existe |

Y respuesta concreta · ¿hay catálogo de plantillas estándar (IBI · comunidad · seguros · suministros · gestión · ...) o el wizard "Nuevo gasto recurrente" empieza desde 0?

Si NO existe · §F propondrá construirlo. Si existe · documentar dónde y cómo se accede.

### §B · Eje 2 · Confirmación al store · matriz V11.3

Mismo formato · responder ·

- ¿Qué stores toca al crear · al modificar · al confirmar · al desactivar un compromiso?
- ¿El servicio `actualizarCompromiso` realmente persiste o solo emite evento UI?
- ¿Hay estados (sugerido · confirmado · activo · inactivo) implementados o todos son `activo` por defecto?

Si hay gap (servicio existe pero no persiste · estados no implementados) · documentar para spec posterior.

### §C · Eje 3 · Materialización · matriz V11.3

Mismo formato · responder ·

- ¿Existe servicio que genere cargos reales desde el patrón? (cron · al abrir app · al cambiar mes · manual?)
- ¿Esos cargos se persisten en `treasuryEvents` · en `gastosInmueble` · en otro store · en ninguno?
- ¿Las vistas inmueble/personal muestran los cargos materializados junto al patrón?
- ¿El "próximo cargo · 29 may · -25€" del KPI es cálculo runtime o registro persistido?

Esta sección es la más importante · si NO hay materialización real · los KPIs de la cabecera son proyección teórica · NO realidad operativa.

### §D · Eje 4 · Botón "Detectar" · matriz V11.3

Mismo formato · responder ·

- ¿Qué hace el botón en personal? (fuente · output · efecto secundario)
- ¿Por qué NO está en inmueble? · deuda · intencional · imposible
- ¿Detección es ML · heurística simple · regex · plantillas?
- ¿Crea compromisos directamente o sugiere para que cliente confirme?

### §E · Asimetría inmueble vs personal · mapa de diferencias

Tabla con TODAS las diferencias UI/funcionalidad detectadas entre las 2 vistas ·

| Diferencia | Personal | Inmueble | Veredicto · deuda · intencional |
|---|---|---|---|

Mínimo · botón Detectar · botón Importar · cualquier otra detectada en grep.

### §F · Veredicto · alcance del trabajo necesario

CC propone tabla con todos los gaps detectados · 3 columnas ·

| # | Gap | Tiempo estimado | Bloquea otros |
|---|---|---|---|

Y resumen ejecutivo · 1 de estas opciones ·

- **R1** · pieza está bien · solo falta catálogo · spec corto 2-3h CC
- **R2** · pieza tiene catálogo OK · falta materialización · spec medio 4-6h CC
- **R3** · pieza tiene UI bonita pero arquitectura sin completar · spec grande 8-12h CC con varios sub-frentes
- **R4** · pieza tiene 2+ duplicidades arquitectónicas · requiere saneamiento previo

CC propone · decisión Jose tras leer informe.

---

## §4 · Reglas de ejecución

1. **CERO código modificado** · solo informe en `docs/audits/`
2. **Pegar output LITERAL de comandos del §2** · NO resumir · puede ser largo
3. **Aplicar regla 5 preguntas V11.3 literal** en cada eje · si CC marca "X existe · funciona" sin las 5 · audit defectuoso
4. **NO confiar en T-CRUD-AUDIT anterior** · es punto de partida · NO veredicto
5. **Stop-and-wait** · CC abre PR · NO mergea · espera Jose
6. **Si surge inconsistencia grave** (ej · servicios sin clasificar · stores que no encajan) · DETENERSE y reportar
7. **Tiempo estimado** · 30-60 min CC · si pasa de 90 min · DETENERSE y reportar
8. **Si encuentras duplicidades NO contempladas** · documentar en §F · NO inventar criterio · solo proponer · decisión Jose

---

## §5 · Criterios de aceptación

- [ ] Pre-flight §2 ejecutado · output pegado literal en informe
- [ ] §A · catálogo plantillas con matriz V11.3
- [ ] §B · confirmación al store con matriz V11.3
- [ ] §C · materialización con matriz V11.3 · sección crítica
- [ ] §D · botón Detectar con matriz V11.3
- [ ] §E · asimetría inmueble vs personal con tabla de diferencias
- [ ] §F · veredicto · ruta R1/R2/R3/R4 · justificada
- [ ] PR contra `main` con UN solo archivo
- [ ] PR description con resumen ejecutivo · 5 líneas

---

## §6 · Tras merge

| Veredicto | Acción Jose+Claude |
|---|---|
| R1 catálogo solo | Spec catálogo plantillas · 2-3h CC |
| R2 catálogo + materialización | 2 specs separados · 6-8h CC total |
| R3 alcance grande | Spec multi-sub-tarea tipo D-CRUD-ALTA · 8-12h CC |
| R4 duplicidades primero | Audit dedicado por duplicidad antes · regla V11.7 |

---

**Fin del spec.**
**Listo para entregar a CC tras merge B-TODOS-RUNTIME.**
