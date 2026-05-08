# T-PROYECCION-AUDIT · sistémico módulo Proyección · cifras reales antes de Q1-Q10

> **Tarea de auditoría** · NO modifica `src/` · entrega informe markdown en `docs/audits/T-PROYECCION-AUDIT-INFORME.md` · stop-and-wait · NO mergear · esperar autorización Jose.
>
> **Análoga metodológica a** · `docs/audits/T-PERSONAL-AUDIT-sistemico-patron-vs-real-INFORME.md` (449 líneas · 6 hallazgos sorpresa · cifras reales C1-C5 · cero asunciones).
>
> **Predecesor lógico** · audit Personal entregó cifras reales de cables sistémico C1-C5. Este audit hace lo mismo para el módulo Proyección + simulador Libertad + Mi Plan + Panel patrimonio · cruzando con el modelo conceptual cerrado T-PROYECCION-LARGO-PLAZO Q1-Q10.

---

## 1 · Contexto

Tras T-PERSONAL-AUDIT descubrimos 6 hallazgos sorpresa (catálogo Personal 1 categoría no 14 · dos hubs Personal coexisten · `nominaAportacionHook` confirmado G-07 moderno · etc.). Ese audit evitó redactar PR-C1 con asunciones equivocadas.

Ahora cerramos el modelo conceptual T-PROYECCION-LARGO-PLAZO completo (Q1-Q10) y queremos redactar specs de implementación. Antes de redactar **ningún spec largo de proyección** necesitamos cifras reales del estado actual del módulo Proyección + simulador Libertad + componentes Mi Plan + KPIs Panel patrimonio.

Sin este audit caeremos en los mismos errores · asumir tamaño de cables · asumir piezas que no existen · ignorar piezas que ya están al 80% construidas.

---

## 2 · Objetivo

Producir un informe único en `docs/audits/T-PROYECCION-AUDIT-INFORME.md` que responda con cifras reales y reproducibles ·

1. Qué archivos componen hoy el módulo Proyección + simulador Libertad + Mi Plan + KPIs patrimonio del Panel
2. Qué stores escriben/leen esos archivos (qué datos tienen disponibles)
3. Para cada una de las 10 dimensiones Q1-Q10 del modelo cerrado · qué está construido (✅) · qué está parcial (🟡) · qué no existe (❌)
4. Para cada una de las 3 palancas únicas (snapshot 1 enero · capa fiscal proyectada · sugerencias macro automáticas) · estado real
5. Qué piezas son reusables y qué piezas hay que construir desde cero
6. Tamaños T-shirt y dependencias · igual formato que el audit Personal

El audit es **descriptivo · no prescriptivo**. CC informa · NO propone specs · NO modifica código.

---

## 3 · Referencias del modelo cerrado (input · NO interpretar · solo cruzar)

### 3.1 · 10 decisiones Q1-Q10 cerradas

| Q | Decisión |
|---|---|
| Q1 | **D · narrativa unificada multi-fase** · libertad + patrimonio + escenarios + eventos · multi-vista integrada |
| Q2 | **D · stocks + flujos + fiscalidad agregada** · capa fiscal ligera con supuestos visibles · NO casillas modelo 100 |
| Q3 | **D · anual + categoría expandible a entidad** · motor interno mensual · display anual |
| Q4 | **E · híbrido base + sensibilidades macro + escenarios usuario** · 3 capas de incertidumbre |
| Q5 | **D · supuestos macro a 2 niveles** · default por categoría editable + override por activo individual |
| Q6 | **C · eventos vitales · catálogo predefinido (~10 tipos) + evento custom** · transformaciones T64 / Santa Catalina van en custom |
| Q7 | **E · plan vs realidad generalizado a todas las dimensiones + histórico visual + sugerencias macro automáticas con confirmación** |
| Q8 | **A · vive dentro de Mi Plan como pestaña** · KPIs señaleros en Panel · NO módulo aparte |
| Q9 | **E · cadencia híbrida + snapshot anual el 1 enero** · diferenciador único · proyección como memoria |
| Q10 | **F · output híbrido jerárquico** · cabecera KPIs + gráfico multi-dim + tabla expandible + cajones escenarios y supuestos |

### 3.2 · 3 palancas únicas

1. **Snapshot anual 1 enero** · proyección como memoria · "tu proyección de hace 3 años decía X · realidad es Y"
2. **Capa fiscal proyectada** · cruza norte 1/1/2027 con norte 20 años · plusvalías futuras · amortizaciones AEAT que decaen · deducciones planes pensiones
3. **Sugerencias macro basadas en histórico** · ATLAS aporta inteligencia · "tu CPI personal últimos 3 años fue 3,4% · ¿usar?" · respeta P8.2 (sugerir · cliente decide)

### 3.3 · Mockup vigente del módulo

`atlas-mi-plan-v2.html` (en `/mnt/project/`) contiene el mockup Mi Plan visual vigente · estructura observada ·

- `page-head-landing` · página principal con hero libertad + lifeline patrimonio 2020-fecha + 4 submódulos clicables
- `page-head-objetivos` · sub-página objetivos
- `page-head-retos` · sub-página retos
- `page-head-fondos` · sub-página fondos de ahorro
- `page-head-proyeccion` · sub-página "Proyección de caja"
- `page-head-libertad` · sub-página "Libertad financiera" · simulador con curva renta pasiva escenarios

Dato clave · el mockup tiene **5 sub-páginas** (objetivos · retos · fondos · proyección · libertad) · pero las memorias del proyecto mencionan **5 tabs distintos** (Objetivos · Libertad · Fondos · Mi presupuesto · Retos · sin proyección · con presupuesto). Esta diferencia se documenta en sección 7 del audit.

### 3.4 · Hallazgos previos del audit Personal aplicables

- `ProyeccionComparativa.tsx` · esqueleto reusable · forecast = `Math.random` placeholder · sin ámbito Personal · NO usa `compromisosRecurrentes` ni `ingresos`
- `fiscalConciliationService.conciliarNominas` · calcula desviación patrón vs real por mes (cálculo OK · falta UI)
- Panel V5 NO tiene KPI coherencia (0 hits grep "coherencia/alineamiento")
- 2 hubs Personal coexistiendo (`/personal/*` + `/gestion/personal`)

CC debe verificar si estos hallazgos siguen vigentes (commit puede haber cambiado algo) y si aparecen patrones similares en Proyección.

---

## 4 · Stop-and-wait obligatorio

CC ejecuta este audit · entrega el informe · **NO modifica nada en `src/`** · **NO abre PR de código** · **NO redacta specs de implementación**.

CC abre **un solo PR** que añade el archivo `docs/audits/T-PROYECCION-AUDIT-INFORME.md` y nada más. **NO mergear.** Esperar autorización Jose tras revisión del informe.

---

## 5 · Regla canónica grep duro · obligatoria en todo el audit

Ningún archivo se marca como "funcional" / "real" / "construido" sin esta verificación reproducible ·

```bash
grep -nE "import.*services?/|initDB|db\.(put|add|delete|update)|service\.(save|create|delete|update)" <archivo>
grep -cE "showToastV5\(|alert\(|console\.log" <archivo>
```

| Caso | Veredicto |
|---|---|
| `imports=0` + `toasts>5` | MOCKUP ❌ |
| `imports>0` + `0 awaits save` | LECTURA PURA 🟡 |
| `imports>0` + `≥1 await save` | REAL ✅ |

**Prohibiciones explícitas** ·

- NO marcar funcional sin grep reproducible
- NO confiar en headers de archivo (pueden mentir)
- NO confiar en docs/handoffs sin verificar contra código actual
- NO confiar en análisis estático para detectar imports (dynamic `await import()` se escapa · usar grep duro)
- NO inventar tamaños T-shirt sin contar líneas reales

Cada veredicto del audit incluye el grep ejecutado y el output literal · de modo que Jose pueda reproducirlo en local.

---

## 6 · Sección preflight obligatoria

Antes de entrar a las 11 secciones del informe · CC ejecuta y deja registrado en el informe ·

### 6.1 · Versión real del DB

```bash
grep -nE "DB_VERSION\s*=|const DB_VERSION" src/services/db.ts src/services/database/db.ts 2>/dev/null
```

Confirmar que sigue en 69 (handoff V9). Si no · documentar discrepancia.

### 6.2 · Listado de stores activos

```bash
grep -nE "objectStoreNames\.contains\(|createObjectStore\(" src/services/db.ts src/services/database/db.ts 2>/dev/null | sort -u
```

Confirmar que son 40. Si no · documentar discrepancia.

### 6.3 · Existencia archivos clave mencionados en HANDOFF V9

Para cada uno · `ls -la <ruta>` y reportar exists/no-exists ·

- `src/pages/proyeccion/ProyeccionPage.tsx`
- `src/pages/proyeccion/ProyeccionComparativa.tsx`
- `src/services/fiscalConciliationService.ts`
- `src/pages/mi-plan/` (carpeta · listar contenido)
- `src/pages/panel/` o `src/pages/dashboard/` (carpeta · listar contenido)

Si alguna no existe · documentarlo y buscar la ruta real con `find src/ -iname "*proyeccion*"` etc.

---

## 7 · Sección 1 del informe · Inventario archivos módulo Proyección

CC ejecuta y reporta literal ·

```bash
find src/ -iname "*proyeccion*" -type f 2>/dev/null
find src/ -iname "*libertad*" -type f 2>/dev/null
find src/ -iname "*mi-plan*" -o -iname "*miplan*" -type f 2>/dev/null
find src/ -iname "*patrimonio*" -type f 2>/dev/null
find src/ -iname "*escenario*" -type f 2>/dev/null
find src/ -iname "*simulador*" -type f 2>/dev/null
find src/ -iname "*horizon*" -type f 2>/dev/null
find src/ -iname "*pulse*" -type f 2>/dev/null
```

Para cada archivo encontrado · línea final del listado debe indicar ·

| Archivo | Líneas | Tipo (page/component/service/hook) | Imports servicios | `await ...save\|create\|update\|put\|add` count | Veredicto grep duro |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | MOCKUP / LECTURA / REAL |

Tabla **completa** · ningún archivo omitido. Si una categoría (`*horizon*`) no devuelve nada · escribir literal "0 archivos" · es información válida (HORIZON eliminado por design system v4 según memorias).

---

## 8 · Sección 2 del informe · Inventario stores con datos relevantes

Para cada archivo de la sección 1 con veredicto REAL o LECTURA ·

```bash
grep -nE "db\.(get|put|add|delete|getAll|count)\(['\"]([^'\"]+)" <archivo>
```

Extraer nombres de stores · agregarlos en tabla ·

| Store | Archivos que lo escriben | Archivos que lo leen | Relevancia para Q1-Q10 |
|---|---|---|---|
| `treasuryEvents` | ... | ... | Q3 motor mensual / display anual · Q9 historial real |
| `properties` | ... | ... | Q1 patrimonio · Q2 stock activos |
| `ejerciciosFiscales` | ... | ... | Q2 capa fiscal · palanca 2 |
| ... | ... | ... | ... |

**Stores que CC debe verificar específicamente** (lista no exhaustiva · CC añade los que encuentre) ·

- `treasuryEvents` · `properties` · `loans` · `gastosInmueble` · `contracts` · `rentaMensual`
- `ejerciciosFiscales` · `ingresos` · `nominas` · `compromisosRecurrentes` · `opexRules`
- `pensionPlans` · `inversiones` · `cuentas` · `movements`
- Cualquier store que mencione `patrimonio` · `escenario` · `proyeccion` · `forecast` · `snapshot` (probablemente NO existen · confirmar)

---

## 9 · Sección 3 del informe · Auditoría 10 dimensiones Q1-Q10

Una sub-sección por Q. Cada sub-sección tiene formato fijo ·

```
### Q{N} · {decisión cerrada en una línea}

**Estado actual** · ✅ construido / 🟡 parcial / ❌ no existe

**Piezas reusables** ·
- archivo:línea · qué hace · cuán cerca de Q{N}

**Piezas a construir** ·
- descripción · dónde iría · qué necesita

**Grep que lo demuestra** ·
\`\`\`bash
{comando}
\`\`\`
output literal ·
\`\`\`
{output}
\`\`\`
```

CC cubre las 10 · sin saltar ninguna. Para cada Q · CC define su propia heurística de búsqueda · pero debe quedar reproducible.

Pista para CC ·

- **Q1 narrativa unificada** · buscar páginas que combinan libertad + patrimonio + escenarios + eventos en una vista · probablemente NO existe (mockup la dibuja · código no)
- **Q2 capa fiscal proyectada** · buscar uso de `ejerciciosFiscales` desde archivos de proyección · si 0 hits → palanca 2 confirmada NO existe
- **Q3 anual + categoría expandible** · revisar `ProyeccionComparativa.tsx` · ya hace agrupación temporal? a qué granularidad?
- **Q4 base + sensibilidades + escenarios** · buscar concepto "escenario" como entidad persistida · grep `escenario` en stores
- **Q5 supuestos macro 2 niveles** · buscar concepto "supuesto" / "assumption" / "macro" · probablemente NO existe
- **Q6 catálogo eventos vitales** · buscar `evento` / `event` como entidad de proyección (NO `treasuryEvent` que es otra cosa)
- **Q7 plan vs real generalizado** · grep "comparativa" · listar todas las pantallas con vista comparativa
- **Q8 vive dentro de Mi Plan** · buscar pestañas de Mi Plan · ¿existe ya pestaña proyección?
- **Q9 snapshot anual 1 enero** · grep "snapshot" en stores · probablemente 0 hits
- **Q10 output jerárquico** · buscar componentes "cabecera KPIs" + "gráfico multi-dim" + "tabla expandible" en mismo árbol

---

## 10 · Sección 4 del informe · Auditoría 3 palancas únicas

Tabla resumen ·

| Palanca | Estado | Piezas existentes | Piezas a construir | Grep que lo demuestra |
|---|---|---|---|---|
| Snapshot anual 1 enero | ❌ / 🟡 / ✅ | ... | ... | ... |
| Capa fiscal proyectada | ❌ / 🟡 / ✅ | ... | ... | ... |
| Sugerencias macro automáticas | ❌ / 🟡 / ✅ | ... | ... | ... |

Para cada palanca · adjuntar grep duro reproducible y output literal.

---

## 11 · Sección 5 del informe · Cruce con norte 1/1/2027

El modelo Q2 dice "stocks + flujos + fiscalidad agregada · capa fiscal ligera". El norte 1/1/2027 dice "declaración prerrellenada con cada renta · cada gasto · cada amortización · cada inspección corregida · cada fee".

CC verifica qué piezas del cierre fiscal anual ya alimentan o pueden alimentar la proyección 20 años ·

- `ejerciciosFiscales` (keyPath año · 4 estados · versionado por inspección) · ¿accesible desde proyección?
- `ejercicioResolverService` (puerta única a fiscal) · ¿usado por algún archivo de proyección?
- Amortizaciones AEAT que decaen año a año · ¿proyección las modela?
- Plusvalías futuras (vendrá de `properties.valorActual` proyectado) · ¿fórmula cerrada?
- Deducciones planes pensiones (G-07 `nominaAportacionHook`) · ¿impactan proyección?

Resultado · tabla de piezas fiscales reusables y huecos.

---

## 12 · Sección 6 del informe · Cruce con Mi Plan v5

Q8 dice "vive dentro de Mi Plan como pestaña + KPIs señaleros en Panel". CC verifica ·

### 12.1 · Estado actual de Mi Plan v5

```bash
find src/ -path "*mi-plan*" -type f 2>/dev/null
find src/ -path "*pages/plan*" -type f 2>/dev/null
```

Listar páginas · contar pestañas · identificar cuál de las 5 sub-páginas del mockup está implementada y cuál es solo dibujo.

### 12.2 · Existencia pestaña Proyección

¿Existe ya una pestaña/sub-página llamada "proyeccion" / "Proyección" dentro de Mi Plan? Si sí · ¿qué contiene? Si no · ¿dónde habría que añadirla?

### 12.3 · Existencia pestaña Presupuesto

Las memorias mencionan "Mi presupuesto" como una de las 5 pestañas del rediseño. El mockup `atlas-mi-plan-v2.html` NO la tiene como sub-página. ¿Está en código? ¿Está en otro mockup más reciente? · documentar discrepancia.

### 12.4 · Hero patrimonio + lifeline

El mockup tiene hero libertad + lifeline patrimonio 2020-actual con punto estimado libertad financiera. ¿Está implementado en el código? · grep `lifeline` · `hero-libertad` · `hero-patrimonio`.

---

## 13 · Sección 7 del informe · Discrepancias mockup vs código real

Misma metodología que descubrió "1 categoría no 14" en T-PERSONAL-AUDIT. CC compara ·

| Elemento del mockup `atlas-mi-plan-v2.html` | Estado en código | Discrepancia |
|---|---|---|
| Sub-página landing con hero libertad | ... | ... |
| Sub-página objetivos | ... | ... |
| Sub-página retos | ... | ... |
| Sub-página fondos | ... | ... |
| Sub-página proyeccion | ... | ... |
| Sub-página libertad simulador | ... | ... |
| Curva renta pasiva escenarios | ... | ... |
| 4 escenarios biblioteca (Plan actual / Agresivo / Optimista / Conservador) | ... | ... |
| Reto destacado en landing | ... | ... |

CC documenta cada discrepancia · NO propone arreglarla · NO sugiere camino. Sólo informa.

---

## 14 · Sección 8 del informe · KPIs señaleros en Panel patrimonio

Q8 segunda mitad · "KPIs señaleros en Panel". CC verifica ·

```bash
find src/ -path "*panel*" -o -path "*dashboard*" -type f 2>/dev/null | head -50
grep -nE "kpi|KPI" src/pages/panel/*.tsx 2>/dev/null
grep -nE "coherencia|alineamiento|deriva" src/pages/panel/*.tsx 2>/dev/null
```

¿Hay KPIs patrimoniales en Panel hoy? ¿Cuáles? ¿Hay KPI de coherencia patrón vs real (T-PERSONAL-AUDIT dijo 0 hits · confirmar)? ¿Existe pieza reusable para "KPI señalero proyección"?

---

## 15 · Sección 9 del informe · Hallazgos sorpresa

Sección abierta · CC reporta cualquier descubrimiento no anticipado durante el audit. T-PERSONAL-AUDIT entregó 6 hallazgos sorpresa · este audit puede entregar similar volumen.

Ejemplos de hallazgos esperables (CC valida o desmiente) ·

- ¿Hay un módulo "Horizon" / "Pulse" residual aún en código pese a que design system v4 los eliminó del UI?
- ¿`ProyeccionPage.tsx` y `ProyeccionComparativa.tsx` están en distintas rutas con código duplicado?
- ¿Hay archivos llamados `proyeccion-legacy` o `proyeccion-v2`?
- ¿El simulador libertad escribe escenarios en algún store o son in-memory?
- ¿Hay un archivo de tipos `Escenario` / `Snapshot` / `Supuesto` ya declarado pero no usado?

---

## 16 · Sección 10 del informe · Cables / piezas a construir

Mapa final · análogo a C-1/C-5 del audit Personal. Definir cables específicos del módulo Proyección ·

| Cable | Descripción | Bloquea a | Piezas reusables | Tamaño T-shirt |
|---|---|---|---|---|
| C-PROY-1 | ... | ... | ... | XS/S/M/L/XL |
| C-PROY-2 | ... | ... | ... | XS/S/M/L/XL |
| ... | ... | ... | ... | ... |

CC define los cables que vea naturalmente · sin forzar paralelismo con C-1/C-5 sistémico Personal. Estos son cables del dominio Proyección · pueden ser pocos (3-4) o muchos (8-10) · CC decide.

Cada cable lleva ·

- **Estado** · ❌ no existe · 🟡 parcial · 🟢 ~X% construido
- **Bloqueado por** · qué otros cables debe haber primero
- **Bloquea a** · qué cables siguientes lo necesitan
- **Tiempo estimado CC** · en horas · igual formato que audit Personal

---

## 17 · Sección 11 del informe · Tamaños T-shirt + orden recomendado

Recomendación de CC · ¿en qué orden empezar la implementación de Q1-Q10?

Justificación basada en ·

- Valor inmediato (cables al 80% se cierran rápido)
- Dependencias técnicas (DB upgrade · stores nuevos · etc.)
- Cobertura del modelo (qué Q quedan cubiertas con cada cable)
- Paralelismo posible

CC NO propone specs · sólo orden recomendado.

---

## 18 · Sección 12 del informe · Lo que NO debe hacer CC en la implementación posterior

Sección preventiva · misma idea que "Errores que el Claude anterior cometió" en handoffs. CC reporta riesgos detectados ·

- ¿Hay archivos que aparentan ser proyección y son legacy?
- ¿Hay piezas marcadas TODO / FIXME / HACK relacionadas con proyección?
- ¿Hay servicios proyección que escriben directamente sin pasar por el resolver fiscal?
- ¿Hay forecasts que usan `Math.random` (handoff V9 lo señala explícitamente · confirmar y mapear todos los hits)?

```bash
grep -rnE "Math\.random|TODO|FIXME|HACK" src/pages/proyeccion src/components/proyeccion src/services/proyeccion 2>/dev/null
```

---

## 19 · Validaciones del informe (CC se las aplica antes de entregar)

CC verifica ·

- [ ] Cada veredicto ✅/🟡/❌ tiene grep reproducible adjunto
- [ ] Cada output de grep está copiado literal (no parafraseado)
- [ ] DB_VERSION confirmado vía grep · número exacto reportado
- [ ] Cantidad stores activos confirmada vía grep · número exacto reportado
- [ ] Las 10 dimensiones Q1-Q10 tienen sub-sección propia · ninguna saltada
- [ ] Las 3 palancas tienen tabla con grep duro
- [ ] Sección discrepancias mockup vs código tiene al menos las 9 filas listadas en sección 7 de este spec
- [ ] Sección hallazgos sorpresa tiene al menos 1 hallazgo (vacía sólo si CC lo justifica)
- [ ] Cables C-PROY-N están todos numerados · cada uno con estado · bloqueos · tiempo
- [ ] CC NO ha modificado ningún archivo de `src/` (sólo añade `docs/audits/T-PROYECCION-AUDIT-INFORME.md`)
- [ ] Informe firma fecha + commit base + DB_VERSION + nº stores

---

## 20 · Criterios de aceptación

Jose acepta el informe si ·

1. Puede ejecutar 100% de los greps en local y obtener el mismo output
2. Cada Q1-Q10 tiene veredicto claro · sin ambigüedad
3. Cada palanca tiene veredicto claro · sin ambigüedad
4. La discrepancia entre mockup `atlas-mi-plan-v2.html` y código real está documentada (sea cual sea)
5. Los cables C-PROY-N están dimensionados de forma comparable a C-1/C-5 sistémico Personal (mismo formato T-shirt + dependencias + tiempo)
6. CC NO ha modificado código fuera de `docs/audits/`

Si alguno falla · Jose pide corrección · CC corrige · NO se mergea.

---

## 21 · Qué NO debe hacer CC

- ❌ Modificar archivos en `src/`
- ❌ Redactar specs de implementación de Q1-Q10
- ❌ Proponer arquitectura nueva
- ❌ Sugerir refactorings
- ❌ Mergear el PR sin autorización Jose
- ❌ Marcar piezas funcional sin grep reproducible
- ❌ Confiar en headers/comentarios sin verificar
- ❌ Resumir greps · siempre output literal
- ❌ Asumir que algo existe porque "tendría sentido que existiera"
- ❌ Asumir que algo no existe porque no lo encuentra al primer grep · probar 2-3 búsquedas alternativas antes de declarar ❌

---

## 22 · Cuándo parar

CC se detiene y abre PR cuando ·

1. Las 12 secciones del informe están completas (preflight + 11 secciones del informe)
2. Cada sección tiene al menos un grep reproducible
3. Las validaciones del punto 19 están todas marcadas
4. El archivo `docs/audits/T-PROYECCION-AUDIT-INFORME.md` está en el repo
5. Ningún archivo de `src/` ha sido tocado

CC abre PR titulado `docs: T-PROYECCION-AUDIT informe sistémico módulo Proyección` · descripción "audit análogo a T-PERSONAL-AUDIT · sólo añade informe en docs/audits · NO modifica src" · **espera autorización Jose**.

---

## 23 · Entregable

Un único archivo nuevo ·

```
docs/audits/T-PROYECCION-AUDIT-INFORME.md
```

Tamaño esperado · 400-600 líneas (T-PERSONAL-AUDIT fue 449 · este puede ser similar o algo mayor por las 10 dimensiones Q).

Estructura del informe · igual que las secciones 1-12 numeradas en este spec (preflight + secciones 1-11 + bonus 12).

---

## 24 · Apéndice · referencias para consulta de CC

- Mockup vigente Mi Plan · `atlas-mi-plan-v2.html` (Jose lo tiene en project context)
- Audit predecesor metodológico · `docs/audits/T-PERSONAL-AUDIT-sistemico-patron-vs-real-INFORME.md`
- Handoff V9 (Claude lo redactó · resume estado a 2026-05-08)
- Modelo cerrado T-PROYECCION-LARGO-PLAZO Q1-Q10 (ver sección 3 de este spec)

---

**Fin spec T-PROYECCION-AUDIT.**
**CC ejecuta · entrega informe · NO mergea · espera Jose.**
