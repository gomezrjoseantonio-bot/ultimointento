# T-TESORERIA-AUDIT · pieza Tesorería · 5 problemas concretos detectados por Jose

> **Tipo** · Auditoría dedicada · CERO código modificado · CERO migraciones · solo informe
>
> **Tiempo estimado** · 30-60 min CC · si pasa de 90 min · DETENERSE
>
> **Output** · 1 archivo nuevo · `docs/audits/T-TESORERIA-AUDIT-INFORME.md`
>
> **Cierra** · regla V11.7 · cada funcionalidad sospechosa requiere audit dedicado · y V11.6 · pantallazos Jose son verdad · audit verifica
>
> **Bloquea** · cualquier spec sobre Tesorería · saldos · conciliación · matching · heurísticas · sin este audit cualquier spec sería contra suposiciones

---

## §0 · Lente del audit

> **Lección Jose 2026-05-09 sesión V11** · 5 problemas concretos detectados al usar Tesorería como dogfooder ·
>
> 1. Saldos cuentas NO se actualizan aunque valides un movimiento
> 2. Filtrado conciliación nefasto · feo · ruido innecesario · NO aparecen todas las cuentas (faltan Bankinter · Carrefour · Revolut según pantallazos)
> 3. Movimientos validan manual u opción 2 subir fichero · "está raro montado"
> 4. Detección y recomendación raras · heurísticas tipo "Sin patrón reconocible · ignorar o clasificar manual" no orientan
> 5. "Todo eso me agobia"

Audit verifica los 5 con grep duro y aplica regla V11.3 (5 preguntas) por problema. NO ASUMIR que un problema sea "solo UI" o "solo bug" sin verificar arquitectura real detrás.

DB v70 · 40 stores · sin upgrade en este audit.

---

## §1 · Contexto · pantallazos Jose

| Pantallazo | Lo que muestra |
|---|---|
| Imagen 1 · Vista general | 9 cuentas · saldo consolidado 15.518€ · cards Santander · BBVA · Unicaja · Sabadell · ING · botones Regenerar previsiones / Subir extracto |
| Imagen 2 · Calendario | Flujo caja anual 12 meses · pendientes del día con check confirmar |
| Imagen 3 · Drawer día | Saldo proyectado por cuenta · 9 cuentas listadas · saldo inicio/fin día |
| Imagen 4 · Drawer mes | Calendario mensual con eventos · ingresos previstos |
| Imagen 5 · Conciliación 1298 mov | Filtros Todos · Pendientes · Conciliados · cuentas (Santander · BBVA · Unicaja · Sabadell · ING · Abanca) · botón Nuevo movimiento |
| Imagen 6 · Subir extracto | Matching automático · sin match (18) con heurísticas + acciones Aplicar/Ignorar |

**Asimetría detectada en pantallazos Jose** · imagen 4 muestra 9 cuentas con saldo (Santander · BBVA · Unicaja · Sabadell · ING · Abanca · Bankinter · Revolut · Carrefour) · imagen 5 filtros conciliación solo lista 6 (faltan Bankinter · Revolut · Carrefour). Audit debe explicar.

---

## §2 · Pre-flight obligatorio · CC ejecuta y pega output literal

### §2.1 · Problema 1 · Saldos cuentas no se actualizan al validar movimiento

```bash
# Servicio que valida/confirma un movement
grep -rnE "confirmMovement|validateMovement|conciliarMovement|aprobarMovement|markAsConciliated" src/services/ --include="*.ts" 2>/dev/null | head -15

# Servicio que actualiza saldo cuenta
grep -rnE "updateAccountBalance|recalcularSaldo|recalcularBalance|updateBalance" src/services/ --include="*.ts" 2>/dev/null | head -15

# ¿Se invoca actualización saldo tras validar?
# Buscar trigger en flujo conciliación
grep -rnE "after.*confirm|onConfirm|onValidate|trigger.*balance" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar accounts.balance
grep -rnE "accounts.*balance|\.balance\s*=|\.balance\s*\+=" src/services/account*.ts src/services/treasury* 2>/dev/null | head -20
```

### §2.2 · Problema 2 · Filtros conciliación · cuentas faltantes

```bash
# Componente filtros conciliación · cómo lista las cuentas
grep -rnE "Conciliacion|conciliacion.*filter|ConciliacionBancaria" src/modules/ --include="*.tsx" 2>/dev/null | head -10

# Origen de la lista de cuentas en filtros
grep -rnE "cuentas.*filter|filterCuentas|getAccountsForFilter" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# ¿Lista hardcoded o derivada de db.getAll('accounts')?
grep -rnE "Santander.*BBVA.*Unicaja|hardcodedAccounts|defaultAccounts" src/ --include="*.tsx" 2>/dev/null | head -10

# Verificar accounts store · todas las cuentas registradas
grep -nE "createObjectStore.*accounts" src/services/db.ts 2>/dev/null
```

### §2.3 · Problema 3 · Validación manual + subir fichero · ¿flujos paralelos o uno solo?

```bash
# Botón "Nuevo movimiento" manual
grep -rnE ">.{0,3}Nuevo movimiento|crear.*movement|addMovement" src/modules/ --include="*.tsx" 2>/dev/null | head -10

# Botón "Subir extracto"
grep -rnE ">.{0,3}Subir extracto|importExtracto|uploadExtracto" src/modules/ --include="*.tsx" 2>/dev/null | head -10

# Servicios de matching extracto
grep -rnE "matchingService|matchExtracto|importMatching" src/services/ --include="*.ts" 2>/dev/null | head -10

# ¿Comparten lógica de creación movement o son paralelos?
grep -rnE "db\.put\('movements'|db\.add\('movements'" src/services/ --include="*.ts" 2>/dev/null | head -15

# Botón "Aprobar matches"
grep -rnE "aprobarMatch|approveMatch|aplicarMatch" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

### §2.4 · Problema 4 · Detección y recomendación · heurísticas

```bash
# Servicio heurísticas · de dónde salen
grep -rnE "heuristica|heuristicService|patternMatch|sugerencia.*Movement|recomendar" src/services/ --include="*.ts" 2>/dev/null | head -15

# Tipos de heurísticas hardcoded
grep -rnE "Sin patrón reconocible|Posible suministro|Bizum.*alquiler|proponer.*crear" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -15

# ¿Se relacionan con movementLearningRules?
grep -rnE "learningRules.*heuristica|heuristica.*learning|aplicarRegla" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Acciones · Aplicar · Ignorar · qué hacen
grep -rnE "onAplicar|onIgnorar|aplicarHeuristica|ignorarHeuristica" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -10
```

### §2.5 · Problema 5 · UX · agobio · densidad visual

CC NO necesita pantallazos para verificar UX · pero sí puede medir ·

```bash
# Cuántos componentes/widgets se renderizan en TesoreriaPage
find src/modules/ -name "Tesoreria*" -type f 2>/dev/null
wc -l src/modules/horizon/tesoreria/*.tsx src/modules/v5/tesoreria/*.tsx 2>/dev/null | head -20

# Tooltips · helpers · descripciones inline
grep -nE "Tooltip|InfoIcon|HelpCircle|description.*tooltip" src/modules/horizon/tesoreria/ src/modules/v5/tesoreria/ -r 2>/dev/null | head -10

# Filtros y controles UI · cuántos hay simultáneos
grep -rnE "Filter|filterBy|toggle" src/modules/horizon/tesoreria/ --include="*.tsx" 2>/dev/null | head -15
```

---

## §3 · Output esperado · estructura informe

CC crea `docs/audits/T-TESORERIA-AUDIT-INFORME.md` con esta estructura ·

### §A · Problema 1 · Saldos · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe servicio que actualiza saldo cuando se valida un movement? | Sí · No · Parcial · ruta + líneas |
| 2 · ¿Cuántas implementaciones distintas? | 1 · 2+ · 0 |
| 3 · ¿Está viva? | Imports · callers reales |
| 4 · Si 2+ · canónica vs legacy | |
| 5 · Dead code residual | |

Y diagnóstico · ¿es bug real (servicio existe pero no se llama) · es feature inexistente (servicio no existe) · es bug parcial (se llama pero no recalcula bien)?

Si es bug real · estimar tiempo de fix.

### §B · Problema 2 · Filtros conciliación · matriz V11.3

Mismo formato. Verificar ·

- ¿La lista de cuentas en filtro es derivada de `db.getAll('accounts')` o hardcoded?
- ¿Por qué faltan Bankinter · Revolut · Carrefour según pantallazo Jose?
- ¿Hay filtro/condición que excluye cuentas (ej · solo cuentas con movements pendientes)?

### §C · Problema 3 · Validación manual + extracto · matriz V11.3

Mismo formato. Verificar ·

- ¿"Nuevo movimiento" y "Aprobar match" y "Subir extracto" comparten servicio o son 3 caminos paralelos?
- ¿Hay duplicidad en `db.put('movements')`?
- ¿Cuál es la canónica · cuál legacy?
- ¿Cómo está documentada la diferencia para el usuario?

### §D · Problema 4 · Heurísticas · matriz V11.3

Mismo formato. Verificar ·

- ¿De dónde salen las heurísticas · hardcoded · learning · reglas?
- ¿Se relacionan con `movementLearningRules`?
- ¿"Aplicar" qué hace exactamente?
- ¿"Ignorar" qué hace exactamente?
- ¿Hay heurísticas inútiles (siempre devuelven "sin patrón")?

### §E · Problema 5 · UX agobio · análisis cualitativo

NO regla V11.3 · análisis distinto ·

- Densidad de información en pantalla principal · ¿cuántos KPIs · widgets · listas?
- Cuántos clicks para conciliar 1 movement
- Cuántos clicks para conciliar 50 movements (¿hay batch?)
- Texto de heurísticas · ¿orienta a la acción o solo describe?
- Color · jerarquía visual · ¿hay foco claro o todo compite?

Output · 5 sugerencias UX concretas · NO implementación · solo identificar.

### §F · Asimetría inmueble vs personal en Tesorería · si aplica

Pantallazos Jose mostraron asimetría en compromisos (botón Detectar solo personal). ¿Pasa lo mismo en Tesorería? Verificar.

### §G · Veredicto · ranking de fix

CC propone tabla con los 5 problemas + cualquier hallazgo extra · 4 columnas ·

| # | Problema | Tipo (bug · UI · arquitectura · ux) | Tiempo fix | Prioridad para Jose dogfooder |
|---|---|---|---|---|

Resumen ejecutivo · una de estas opciones ·

- **R1** · 1 bug obvio (saldos) · resto UI · empezar por bug · 1-2h CC · luego UI por separado
- **R2** · arquitectura paralela (validación manual vs extracto duplicada) · saneamiento previo necesario
- **R3** · todo es UX/ruido · no bugs reales · spec rediseño UI · 6-10h CC
- **R4** · mezcla · varios fixes pequeños + 1 saneamiento + 1 rediseño parcial

CC propone · decisión Jose tras leer informe.

---

## §4 · Reglas de ejecución

1. **CERO código modificado** · solo informe
2. **Pegar output LITERAL** de comandos del §2
3. **Aplicar regla V11.3** en §A/§B/§C/§D · §E es análisis distinto sin V11.3
4. **NO confiar en informes audit anteriores** (T-INACEPTABILIDADES marcó conciliación funcional · puede ser superficial)
5. **Stop-and-wait** · CC abre PR · NO mergea · espera Jose
6. **Si surge inconsistencia grave** · DETENERSE y reportar
7. **Tiempo estimado** · 30-60 min CC · si pasa de 90 min · DETENERSE
8. **Si encuentras duplicidades NO contempladas** · documentar en §F · proponer · decisión Jose

---

## §5 · Criterios de aceptación

- [ ] Pre-flight §2 ejecutado · output pegado literal
- [ ] §A · saldos con matriz V11.3 + diagnóstico
- [ ] §B · filtros con matriz V11.3 + cuentas faltantes explicadas
- [ ] §C · validación manual + extracto con matriz V11.3
- [ ] §D · heurísticas con matriz V11.3 + Aplicar/Ignorar explicado
- [ ] §E · UX agobio · 5 sugerencias concretas
- [ ] §F · asimetría inmueble/personal si aplica
- [ ] §G · veredicto · ruta R1/R2/R3/R4 · justificada
- [ ] PR contra `main` con UN solo archivo
- [ ] PR description con resumen ejecutivo · 5 líneas

---

## §6 · Tras merge

| Veredicto | Acción Jose+Claude |
|---|---|
| R1 · bug obvio + UI separado | Spec corto fix saldos · 1-2h CC · luego UI por separado · 4-6h CC |
| R2 · saneamiento arquitectura previo | Spec saneamiento · 4-6h CC · luego specs encima · variable |
| R3 · todo UX | Spec rediseño UI Tesorería · 6-10h CC |
| R4 · mezcla | Múltiples specs encadenados · empezar por bug saldos · ranking según G |

---

**Fin del spec.**
**Listo para entregar a CC.**
