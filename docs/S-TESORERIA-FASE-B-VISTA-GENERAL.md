# S-TESORERIA-FASE-B-VISTA-GENERAL · transformación de la página principal Tesorería

> **Tipo** · Cambios UI estructurales · 5 sub-tareas
> **Tiempo estimado total** · 6-10h CC
> **Cierra** · Fase B Tesorería · página principal · co-diseño Jose+Claude 2026-05-09 · validado mockup v8
> **Referencia visual única** · `docs/mockups/atlas-tesoreria-v8-completo.html` (vista general · CC abre el archivo desde el repo)
> **Reglas aplicadas** · idénticas a specs previos · V11.6 + V11.7
> **Patrón ejecución** · encadenar sub-tareas en una rama · commit por sub-tarea · 1 PR final único

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en cada sub-tarea** · grep duro EN EL MOMENTO
2. **Si pre-flight revela funcionalidad ya implementada** · STOP · marcar N/A
3. **NO MIGRAR paleta verde/rojo a navy/teal** · decisión Jose · "punto a trabajar futuro · no se prioriza ahora"
4. **NO TOCAR lógica funcional ya mergeada** · S-TESORERIA-FIX-SALDOS · S-TESORERIA-FILTROS-V2 · S-TESORERIA-CALENDARIO-FIXES · solo respetar y construir encima
5. **NO TOCAR drawer Movimiento previsto existente** · solo apuntar al click desde items
6. **NO MOVER Pendientes del día a Panel** · espera a Panel propiamente dicho · quitar drawer derecho de Tesorería pero NO recolocar en Panel ahora
7. **Mockup v8 es la referencia visual** · CC abre `docs/mockups/atlas-tesoreria-v8-completo.html` (en el repo) · ve estructura · NO reinterpreta
8. **Encadenar sub-tareas en una rama** · 1 PR final · NO mergear · esperar Jose
9. **NO arreglar 43 tests failing pre-existing**
10. **DB sigue v70** · NO upgrade

---

## §1 · Contexto

Co-diseño Jose+Claude 2026-05-09 cerró la Fase B de Tesorería · transformación visual completa de la página principal. Lo que cambia ·

| Hoy | Mockup v8 |
|---|---|
| Topbar con buscador global | Sin topbar (buscador sale en spec aparte S-APP-QUITAR-BUSCADOR-GLOBAL) |
| Cabecera blanca "Tesorería · 9 cuentas · saldo consolidado" + 2 botones (Regenerar · Subir extracto) | Banner navy "Mi Tesorería" + 4 KPIs + Subcabecera blanca con h1 + subtítulo (sin botones) |
| 2 tabs · Vista general / Conciliación bancaria | Sin tabs · vista única |
| 3 cards superiores (Saldo · Entradas mes · Salidas mes) + Drawer derecho "Pendientes del día" | KPIs en banner navy · sin drawer derecho |
| Gráfica flujo caja anual + 5 KPIs gráfica | Eliminada · suma redundancia |
| Cards mes con etiquetas (IRPF · PAGA EXTRA · etc) + saldo único | Sin etiquetas · datos nuevos (saldo hoy/cierre · pendientes entrar/salir · indicador problema vacío) |
| Drawer mes · solo "INGRESOS PREVISTOS" | Drawer mes · ingresos + gastos previstos colapsables · contadores conf/pend · mini grid con marcas |
| Drawer día · 9 bancos siempre + saldo proyectado | Drawer día · banco protagonista · solo bancos con movs · cotejo desde ahí |
| Click card cuenta → Conciliación filtrada | Click card cuenta → vista cuenta (ruta nueva `/tesoreria/cuenta/:id` · creada en spec siguiente) |

DB v70 · NO upgrade.

---

## §1.5 · Prerequisito antes de arrancar

```bash
# Verificar que el mockup está en el repo
ls -la docs/mockups/atlas-tesoreria-v8-completo.html
```

Si NO existe · STOP · pedir a Jose que haga push del archivo. Sin mockup en el repo · CC implementa de memoria → divergencia visual asegurada.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Cabecera Tesorería · banner navy + subcabecera blanca + quitar elementos

**Origen** · mockup v8 · cabecera completa
**Tiempo** · 1.5-2.5h CC

#### Pre-flight obligatorio
```bash
# Localizar TesoreriaPage
find src/modules/tesoreria/ -name "TesoreriaPage*" -type f 2>/dev/null
grep -nE "Regenerar previsiones|saldo consolidado" src/modules/tesoreria/TesoreriaPage.tsx 2>/dev/null

# Localizar tabs Vista general / Conciliación
grep -nE "Vista general|Conciliación bancaria|tabs" src/modules/tesoreria/TesoreriaPage.tsx 2>/dev/null

# Localizar gráfica flujo caja anual
grep -rnE "FlujoCaja|cashFlow|flujo.*caja|recharts.*Tesoreria" src/modules/tesoreria/ 2>/dev/null | head -10

# Localizar drawer derecho Pendientes del día
grep -rnE "Pendientes del día|pendientes.*dia.*drawer" src/modules/tesoreria/ 2>/dev/null | head -10
```

#### Plan
1. Reemplazar cabecera blanca actual por estructura del mockup v8 ·
   - Banner navy "Mi Tesorería" · 5 columnas (gold-dot+título · Saldo · Pendiente entrar mes · Pendiente salir mes · Saldo final mes)
   - Subcabecera blanca · h1 "Tesorería" + subtítulo "9 cuentas activas · N movimientos pendientes" (link a Conciliación filtrada por Pendientes · cubierto por S-TESORERIA-CALENDARIO-FIXES sub-tarea 1)
   - SIN botones (Subir extracto y Nuevo movimiento son contextuales a vista cuenta · spec siguiente)
2. Eliminar tabs "Vista general / Conciliación bancaria"
3. Eliminar componente gráfica flujo caja anual + sus KPIs
4. Eliminar botón "Regenerar previsiones"
5. Eliminar drawer derecho "Pendientes del día" · NO se recoloca en Panel ahora · solo se quita de Tesorería
6. Cálculo de KPIs banner navy ·
   - Saldo · suma de saldos de cuentas activas (ya existe · `accountBalanceService` o similar)
   - Pendiente entrar mes · suma de movements del mes con `tipo='ingreso'` y `statusConciliacion='pendiente'`
   - Pendiente salir mes · suma de movements del mes con `tipo='gasto'` y `statusConciliacion='pendiente'`
   - Saldo final mes · saldo + pendiente entrar + pendiente salir (proyección)

#### Caso N/A parcial
Si tabs · gráfica · botón regenerar · o drawer pendientes ya están eliminados · marcar esos puntos como N/A · proceder con el resto.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Banner navy "Mi Tesorería" visible · 4 KPIs correctos
- [ ] Subcabecera blanca · h1 + subtítulo (sin botones)
- [ ] Tabs eliminadas
- [ ] Gráfica flujo caja anual eliminada
- [ ] Botón Regenerar previsiones eliminado
- [ ] Drawer Pendientes del día eliminado
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 2 · Carrusel cuentas · pill gris + click navega a vista cuenta

**Origen** · mockup v8 · sección "Mis cuentas"
**Tiempo** · 30 min - 1h CC

#### Pre-flight obligatorio
```bash
# Localizar componente carrusel cuentas
grep -rnE "Mis cuentas|account.*card|AccountCard|cuenta.*card" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Localizar pill estado "Todo al día"
grep -rnE "Todo al día|al día|aldia" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Localizar onClick actual de la card
grep -B2 -A8 "AccountCard\|account-card" src/modules/tesoreria/components/ -r 2>/dev/null | head -30
```

#### Plan
1. Pill estado "Todo al día" · cambiar de verde a gris muted (paleta v4 · `bg-soft` background · `txt-muted` color · sin tick verde · solo texto "Al día")
2. Pill estado "Pendiente conciliar N" · mantener amber actual
3. Click en card cuenta · cambiar destino · de Conciliación filtrada a `/tesoreria/cuenta/:accountId` (ruta nueva · creada en S-TESORERIA-FASE-B-VISTA-CUENTA · si NO existe aún · da 404 · queda preparado)
4. Lápiz editar · mantener · onClick.stopPropagation para no disparar la navegación

#### Caso N/A parcial
Si pill ya es gris · o click ya navega a vista cuenta · marcar N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Pill "Al día" gris muted · sin verde
- [ ] Click card → navega a `/tesoreria/cuenta/:id`
- [ ] Lápiz editar · stopPropagation correcto
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 3 · Calendario · cabecera + cards mes reformuladas

**Origen** · mockup v8 · sección calendario
**Tiempo** · 2-3h CC

#### Pre-flight obligatorio
```bash
# Localizar calendario y cards mes
grep -rnE "Calendario.*may|month.*card|MonthCard|mes.*card" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Localizar etiquetas contextuales (IRPF · PAGA EXTRA · etc)
grep -rnE "IRPF|PAGA EXTRA|EN CURSO|PREVISTO" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -15

# Verificar estructura datos del calendario
grep -rnE "calendarMonths|getMonths|monthsCalendar" src/modules/tesoreria/ --include="*.ts" 2>/dev/null | head -10
```

#### Plan
1. Cabecera calendario ·
   - Título "Calendario · {mes-actual} {año} - {mes-cierre} {año-cierre}" (ventana rolling 12 meses · empieza por mes en curso)
   - Subtítulo "12 meses · clic en uno para abrir el desglose"
   - "Cierre previsto · {saldo-final-año} €" a la derecha
   - Flechas navegación ‹ › (se mantienen · funcionalidad ya existente)
2. Cards mes · 12 en grid 4×3
3. **Card mes EN CURSO** (mes actual · destacado borde oro) ·
   - Nombre mes + pill "en curso"
   - Saldo HOY (grande · navy)
   - Saldo cierre proyectado (grande · navy)
   - Separador
   - Pendientes entrar (importe · in)
   - Pendientes salir (importe · out)
   - Indicador problema · solo si aplica (sin reglas · campo preparado · siempre vacío por ahora)
4. **Card mes futuro** ·
   - Nombre mes
   - Saldo cierre proyectado (grande · navy)
   - Variación vs mes anterior (muted)
   - Separador
   - Pendientes entrar (importe · in)
   - Pendientes salir (importe · out)
   - Indicador problema · vacío por ahora
5. Eliminar TODAS las etiquetas contextuales (IRPF · PAGA EXTRA · IRPF 2º PLAZO · PREVISTO · etc) de cards mes
6. Click en card mes · sigue abriendo drawer mes (cubierto en sub-tarea 4)

#### Reglas indicador problema · NO se cablean ahora
Hueco visual preparado · pero la regla (saldo bajo · cargo sin fondos · etc) se define en pieza separada · futuro · CC NO inventa reglas · solo deja el slot vacío · quizás con mock visible en una card para ver el formato.

#### Caso N/A parcial
Si etiquetas IRPF ya están fuera · si cards mes ya tienen los datos nuevos · marcar partes como N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Cabecera calendario simplificada (sin redundancias)
- [ ] Cards mes en curso · 4 datos correctos (saldo hoy + cierre + pendientes entrar + salir)
- [ ] Cards mes futuro · 3-4 datos correctos
- [ ] Etiquetas contextuales eliminadas
- [ ] Click en card abre drawer mes
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 4 · Drawer mes · ingresos + gastos colapsables + mini grid con marcas

**Origen** · mockup v8 · drawer mes (click en card mes)
**Tiempo** · 1.5-2h CC

#### Pre-flight obligatorio
```bash
# Localizar drawer mes
find src/modules/tesoreria/ -type f \( -name "*MonthDrawer*" -o -name "*DrawerMes*" -o -name "*MesDrawer*" -o -name "*MesDetail*" \) 2>/dev/null | head -5
grep -rnE "INGRESOS PREVISTOS|GASTOS PREVISTOS|drawerMes" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10
```

#### Plan
1. Estructura del drawer mes según mockup v8 ·
   - Cabecera · "{mes} {año}" · "{N} eventos · clic en un día para ver el detalle"
   - 3 KPIs (Entradas · Salidas · Balance neto)
   - Sección "Día a día · clic para abrir el detalle" · mini calendario grid días
   - Sección "Ingresos previstos · {N} ({conf} confirmados · {pend} pendientes)" · colapsable · suma total
   - Sección "Gastos previstos · {N} ({conf} confirmados · {pend} pendientes)" · colapsable · suma total
2. Mini grid días · cada celda con ·
   - Número del día (mono pequeño)
   - Marca conf (navy dot top-right) o pend (gold dot top-right) si tiene movs · sin marca si no
   - Total mini en mono (in/out con color)
   - Hoy · borde oro 2px
   - Click en día · abre drawer día (sub-tarea 5)
3. Items en secciones colapsables · cada uno con ·
   - Marca individual · ✓ navy (conf) o ⏳ gold (pend) en círculo
   - Concepto + sub (cuenta)
   - Fecha (mono pequeño)
   - Importe (in/out con color)
   - Click → abre drawer Movimiento previsto existente (NO tocar · solo invocar)
4. Sección Gastos previstos · NUEVA · simétrica a ingresos · misma estructura

#### Caso N/A parcial
Si drawer mes ya tiene ingresos + gastos colapsables y mini grid con marcas · marcar parte como N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Sección Gastos previstos añadida · simétrica a Ingresos
- [ ] Ambas secciones colapsables con contadores conf/pend
- [ ] Mini grid días con marcas conf (navy) / pend (gold)
- [ ] Items con marca individual conf/pend
- [ ] Click en item → drawer Movimiento previsto (existente · sin tocar)
- [ ] Click en día del mini grid → drawer día
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 5 · Drawer día · banco protagonista · solo bancos con movs

**Origen** · mockup v8 · drawer día · co-diseño Jose
**Tiempo** · 2-3h CC

#### Pre-flight obligatorio
```bash
# Localizar drawer día (parcialmente cubierto por S-TESORERIA-CALENDARIO-FIXES sub-tareas 3 y 4)
find src/modules/tesoreria/ -type f \( -name "*DayDrawer*" -o -name "*DiaDrawer*" -o -name "*DiaDetail*" \) 2>/dev/null | head -5
grep -rnE "saldo.*proyectado.*cuenta|SALDO INICIO DÍA" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Verificar estado tras S-TESORERIA-CALENDARIO-FIXES (cuenta afectada · conciliar ahí mismo)
grep -rnE "movimientos del día|cuenta afectada|bulk.*conciliar.*día" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10
```

#### Plan
Estructura del drawer día según mockup v8 ·
1. Cabecera · "{día} {mes}" · "desglose por cuenta · solo bancos con movimientos"
2. 3 KPIs (Saldo inicio · Movimientos · Saldo fin)
3. Lista de bancos con movs ese día · cada banco como tarjeta ·
   - Cabecera banco · logo + nombre + IBAN + saldo inicio→fin (mono)
   - Sección movimientos · "Movimientos · N (X conf · Y pend) · {neto}"
   - Items movimientos · checkbox + marca conf/pend + concepto + sub + importe (in/out)
   - Acción · "Conciliar pendientes (N)" · solo si hay pendientes · botón gold primary
4. **Filtro · solo bancos con movs ese día** · si banco NO tiene movs · NO aparece (cambio respecto al actual que muestra los 9 bancos)
5. Estado vacío · si día sin movs en ningún banco · mensaje "Sin movimientos previstos este día"
6. Mantener · alerta amber bajo umbral si saldo proyectado bajo · cuando regla esté definida · UI ya preparada
7. Click en item → drawer Movimiento previsto existente

#### Importante · estado tras S-TESORERIA-CALENDARIO-FIXES
Las sub-tareas 3 y 4 de ese spec ya añadieron · cuenta afectada en cada movement + conciliar desde drawer día. Esta sub-tarea reorganiza la PRESENTACIÓN para que el banco sea protagonista (no lista plana de movs) · pero la lógica funcional ya está.

#### Caso N/A parcial
Si la presentación banco-protagonista ya está · si solo aparecen bancos con movs · marcar N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Drawer día agrupa por banco · cada banco una tarjeta
- [ ] Solo aparecen bancos con movs ese día (no los 9 fijos)
- [ ] Saldo inicio→fin por banco
- [ ] Acción "Conciliar pendientes (N)" por banco
- [ ] Estado vacío si día sin movs
- [ ] Click en item → drawer Movimiento previsto existente
- [ ] Tests · suites failing ≤ 43

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | Cabecera Tesorería · banner navy + subcabecera + eliminar elementos | 1.5-2.5h |
| 2 | Carrusel cuentas · pill gris + click navega a vista cuenta | 30 min - 1h |
| 3 | Calendario · cabecera + cards mes reformuladas | 2-3h |
| 4 | Drawer mes · ingresos + gastos colapsables + mini grid con marcas | 1.5-2h |
| 5 | Drawer día · banco protagonista | 2-3h |

**Total** · 7.5-11.5h CC. Si hay 2-3 N/As · 4-7h CC.

---

## §4 · Reglas globales

1. CC arranca por sub-tarea 1 · sigue orden
2. Pre-flight pegado en commit message
3. Encadenar en una rama · 1 PR final único
4. NO mergear · esperar Jose
5. **Mockup v8 es referencia visual única** · `docs/mockups/atlas-tesoreria-v8-completo.html` (en el repo)
6. NO migrar paleta · usar la actual de la app · navy/teal donde mockup pone navy/teal · pero NO migrar verde/rojo existente en otros sitios de la app
7. NO tocar drawer Movimiento previsto existente · solo invocarlo
8. NO mover Pendientes del día a Panel · solo quitarlo de Tesorería
9. NO arreglar 43 tests failing pre-existing
10. DB sigue v70 · NO upgrade

---

## §5 · Criterios de aceptación globales

- [ ] 5 sub-tareas ejecutadas o marcadas N/A con justificación
- [ ] 1 PR final con commits por sub-tarea
- [ ] PR description con tabla resumen estado
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Vista general de Tesorería se ve como mockup v8** · verificable visualmente

---

## §6 · Tras merge · validación manual Jose

1. Abrir Tesorería · ver banner navy "Mi Tesorería" con 4 KPIs
2. Verificar que NO hay tabs · NO hay gráfica · NO hay botón "Regenerar previsiones"
3. Carrusel cuentas · "Al día" gris (no verde) · click en card → navega a `/tesoreria/cuenta/:id` (puede dar 404 hasta que vista cuenta esté · OK)
4. Calendario · 12 cards mes · sin etiquetas IRPF/PAGA EXTRA · datos nuevos (saldo hoy/cierre · pendientes entrar/salir)
5. Click en card mes · drawer mes con ingresos + gastos previstos colapsables · mini grid con marcas
6. Click en día del mini grid · drawer día con banco protagonista · solo bancos con movs
7. Click en item del drawer · drawer Movimiento previsto existente

---

## §7 · Próximos specs

| # | Spec | Tiempo CC | Cuándo |
|---|---|---|---|
| 3 | S-TESORERIA-FASE-B-VISTA-CUENTA | 8-12h | Tras este merge · ruta `/tesoreria/cuenta/:id` |

---

**Fin del spec.**
**Listo para entregar a CC tras merge S-APP-QUITAR-BUSCADOR-GLOBAL.**
