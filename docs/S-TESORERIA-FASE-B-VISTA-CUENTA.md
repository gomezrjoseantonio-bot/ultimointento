# S-TESORERIA-FASE-B-VISTA-CUENTA · página nueva `/tesoreria/cuenta/:id`

> **Tipo** · Página nueva completa · 5 sub-tareas
> **Tiempo estimado total** · 8-12h CC
> **Cierra** · Fase B Tesorería · página de cuenta individual · co-diseño Jose+Claude 2026-05-09 · validado mockup v8
> **Referencia visual única** · `docs/mockups/atlas-tesoreria-v8-completo.html` (vista cuenta simulada con onclick · CC abre el archivo desde el repo)
> **Reglas aplicadas** · idénticas a specs previos · V11.6 + V11.7
> **Patrón ejecución** · encadenar sub-tareas en una rama · commit por sub-tarea · 1 PR final único

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en cada sub-tarea** · grep duro EN EL MOMENTO
2. **Si pre-flight revela funcionalidad ya implementada** · STOP · marcar N/A
3. **NO MIGRAR paleta verde/rojo a navy/teal** · decisión Jose · "punto a trabajar futuro · no se prioriza ahora"
4. **NO TOCAR drawer Movimiento previsto existente** · solo apuntar al click desde filas
5. **REUTILIZAR componentes existentes** donde tenga sentido · NO duplicar lógica de filtros · tabla · drawer · bulk
6. **Mockup v8 es la referencia visual** · CC abre `docs/mockups/atlas-tesoreria-v8-completo.html` (en el repo) · ve estructura
7. **Encadenar sub-tareas en una rama** · 1 PR final · NO mergear · esperar Jose
8. **NO arreglar 43 tests failing pre-existing**
9. **DB sigue v70** · NO upgrade

---

## §1 · Contexto

Hoy · click en card cuenta del carrusel Tesorería → pantalla Conciliación filtrada por esa cuenta. Funciona pero ·
- Mezcla cabecera global de Conciliación (no específica de la cuenta)
- No permite navegar entre cuentas sin volver a Tesorería
- Acciones importar extracto / añadir movimiento manual están en cabecera global · no en contexto de cuenta

Jose decidió en co-diseño 2026-05-09 · arquitectura cuenta-céntrica · cada cuenta su propia página `/tesoreria/cuenta/:id` con su banner · sus KPIs · sus filtros · su tabla · y navegación rápida entre cuentas.

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

### Sub-tarea 1 · Crear ruta + página VistaCuenta + banner navy con pager + sidebar click vuelve

**Origen** · mockup v8 · ruta nueva
**Tiempo** · 2-3h CC

#### Pre-flight obligatorio
```bash
# Localizar router de la app
find src/ -type f \( -name "App.tsx" -o -name "Routes.tsx" -o -name "routes.ts" \) 2>/dev/null | head -5

# Localizar rutas Tesorería actuales
grep -rnE "/tesoreria|TesoreriaPage|TreasuryPage" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -15

# Localizar servicio de cuentas (para hidratar banco · IBAN · saldo)
find src/ -type f \( -name "account*.ts" -o -name "Account*.ts" \) 2>/dev/null | head -10
grep -rnE "getAccountById|accounts.*find\(" src/services/ 2>/dev/null | head -10

# Localizar sidebar y nav-item Tesorería
grep -rnE "Tesorería|nav-item.*tesoreria" src/components/ src/layouts/ 2>/dev/null | head -10
```

#### Plan
1. Crear ruta `/tesoreria/cuenta/:accountId` apuntando a nueva página `VistaCuentaPage` (o nombre coherente con la app)
2. La página recibe `accountId` por URL params
3. Hidratar datos de cuenta · banco · IBAN · saldo actual (servicio existente)
4. Calcular KPIs (mismos cálculos que vista general pero filtrados por accountId) ·
   - Saldo hoy
   - Pendiente entrar mes (movements del mes con tipo='ingreso' · status='pendiente' · accountId match)
   - Pendiente salir mes (movements del mes con tipo='gasto' · status='pendiente' · accountId match)
   - Saldo final mes (saldo + pendiente entrar + pendiente salir)
5. Banner navy según mockup v8 · 5 columnas en una fila ·
   - Logo banco + Nombre + IBAN + flechas pager ‹ › inline + counter "{N} de {total}"
   - 4 KPIs con label + value + sub
6. Pager funcional · click ‹ → cuenta anterior en orden de carrusel · click › → siguiente · circular o stop en extremos (decidir lo más natural · Jose probó orden simple)
7. Sidebar nav-item "Tesorería" cuando estás en `/tesoreria/cuenta/:id` · sigue marcado como activo · onClick navega a `/tesoreria` (vista general)
8. Lista de cuentas para el pager · misma del carrusel (`accounts.filter(a => a.activa)` o equivalente · orden actual)

#### Caso N/A parcial
Si la ruta ya existe · marcar partes como N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Ruta `/tesoreria/cuenta/:accountId` accesible
- [ ] Banner navy con logo + banco + IBAN + pager + 4 KPIs según mockup v8
- [ ] Pager navega a anterior/siguiente cuenta
- [ ] Sidebar Tesorería click → vuelve a vista general
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 2 · Toolbar acciones · Subir extracto + Nuevo movimiento (gold)

**Origen** · mockup v8 · zona blanca arriba de filtros
**Tiempo** · 1-1.5h CC

#### Pre-flight obligatorio
```bash
# Localizar modal/flujo "Subir extracto" actual (probablemente en Conciliación o ImportarMovimientos)
grep -rnE "Subir extracto|ImportarExtracto|UploadExtracto" src/modules/tesoreria/ 2>/dev/null | head -10

# Localizar modal "Nuevo movimiento" / "Añadir movimiento manual"
grep -rnE "Añadir movimiento|Nuevo movimiento|movimiento.*manual" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Localizar btn-primary token (gold)
grep -nE "btn-primary|btn-gold" src/styles/ 2>/dev/null | head -5
```

#### Plan
1. En la zona blanca arriba de filtros · alineados a la derecha ·
   - Botón "Subir extracto" · estilo `btn-ghost` (sobrio · borde · sin gold)
   - Botón "Nuevo movimiento" · estilo `btn-primary` (gold · coherente con "Nueva inversión · Nuevo inmueble · Nueva nómina" en otras páginas)
2. **Subir extracto** · onClick · ABRE modal/flujo de import existente · pre-rellenando accountId (el de la cuenta actual · no preguntar al usuario qué cuenta · la sabe por contexto)
3. **Nuevo movimiento** · onClick · ABRE modal de añadir movimiento manual existente · pre-rellenando accountId
4. **NO REIMPLEMENTAR** estos modales · solo invocar los existentes con accountId pre-rellenado
5. Si los modales existentes no aceptan accountId pre-rellenado · CC añade prop opcional `defaultAccountId` y usa en form

#### Caso N/A parcial
Si los botones ya existen y los modales aceptan accountId · marcar N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] 2 botones visibles · gold para Nuevo movimiento · ghost para Subir extracto
- [ ] Click invoca modales existentes con accountId pre-rellenado
- [ ] NO re-implementación de los modales
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 3 · Filtros 3 ejes · Periodo + Tipo + Estado + Búsqueda · default Hoy+Pendientes

**Origen** · mockup v8 · toolbar 2 filas
**Tiempo** · 1.5-2.5h CC

#### Pre-flight obligatorio
```bash
# Localizar toolbar de filtros existente en Conciliación
grep -rnE "Periodo|7 días|15 días|chip.*hoy" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -15

# Localizar pill Estado (Pendientes · Conciliados)
grep -rnE "Pendientes.*Conciliados|statusFilter|estadoFilter" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Verificar servicio que filtra movements
grep -rnE "filterMovements|movements.*filter\(" src/services/ 2>/dev/null | head -10
```

#### Plan
Toolbar 2 filas · según mockup v8 ·

**Fila 1**
- Label "Periodo" + chip group · `Hoy` (default activo) · `7 días` · `15 días` · `30 días` · `Este mes` · `Año` · `Todo`
- Label "Tipo" + pill group (alineado derecha) · `Todos` (default activo) · `Ingresos` · `Gastos`

**Fila 2**
- Buscador (input) · "Buscar por concepto · contraparte · NIF · importe..."
- Label "Estado" + pill group (alineado derecha) · `Todos {count}` · `Pendientes {count}` (default activo) · `Conciliados {count}`

#### Defaults importantes
- Periodo · **Hoy**
- Tipo · **Todos**
- Estado · **Pendientes**

#### Lógica filtros
- Reusar el servicio de filtrado de movements existente (Conciliación ya filtra) · añadir parámetros si faltan (tipo)
- Búsqueda · debounce 300ms · busca en concepto · contraparte (nombre + NIF) · importe (acepta "1234" o "12,34")
- Counts en pills Estado · contadores reales · refrescan según los demás filtros aplicados

#### Caso N/A parcial
Si los filtros Periodo y Estado ya existen · solo añadir Tipo + ajustar defaults.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] 3 ejes filtros visibles · Periodo + Tipo + Estado + Búsqueda
- [ ] Defaults · Hoy + Todos + Pendientes
- [ ] Counts en pills Estado actualizados al cambiar filtros
- [ ] Búsqueda funcional con debounce
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 4 · Tabla 5 columnas · día agrupador con iconos · click fila → drawer Movimiento previsto

**Origen** · mockup v8 · tabla movimientos
**Tiempo** · 2.5-3.5h CC

#### Pre-flight obligatorio
```bash
# Localizar tabla movimientos en Conciliación
grep -rnE "MovimientoRow|MovementRow|conciliacion.*table" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Localizar drawer Movimiento previsto existente
grep -rnE "MovimientoPrevistoDrawer|MovementDrawer|movimiento.*drawer" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10
```

#### Plan
Tabla 5 columnas según mockup v8 · grid `32px minmax(0, 2fr) minmax(0, 1.4fr) 110px 110px` ·

**Header**
- checkbox (selectall) · Concepto · Contraparte · Importe (right) · Estado

**Día separador (gris)**
- Izquierda · "{Día semana} · {DD} {mes} {año}" mono
- Derecha · pareja de stats con iconos ·
  - ↑ (chevron up) + total entradas del día (color in · navy)
  - ↓ (chevron down) + total salidas del día (color out · teal)
- **NO** texto "Entradas / Salidas" · solo icons + importes (más compacto · co-diseño Jose)

**Fila movimiento**
- checkbox individual
- Concepto · línea principal (font-weight 600) · línea sub (tag categoría + detalle pequeño · ej "Ingreso · Alquiler · FA32 · Hab 1")
- Contraparte · solo nombre (NO fecha redundante · ya está en agrupador de día)
- Importe · mono · negrita · color in/out (navy/teal)
- Estado · pill (Pendiente amber · Conciliado navy)

**SIN columna fecha** · redundante con agrupador de día.

**Click en fila**
- Abre drawer Movimiento previsto existente (NO tocar · solo invocar pasando movementId)

**Footer tabla**
- Izquierda · "Mostrando N de {total} {periodo}" + Entradas + Salidas (totales del scope filtrado)
- Derecha · paginación · "‹ Anterior · 1/N · Siguiente ›"

#### Reusar
- Filas · si Conciliación tiene componente fila reutilizable · reusar y adaptar
- Drawer Movimiento previsto · invocar · pasar movementId

#### Caso N/A parcial
Si la tabla ya está agrupada por día con iconos · si filas ya tienen 5 cols sin fecha · marcar N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Tabla 5 columnas · header + filas + día separador
- [ ] Día separador con icons ↑↓ + totales del día
- [ ] SIN columna fecha redundante
- [ ] Click en fila → drawer Movimiento previsto existente
- [ ] Footer con totales scope + paginación
- [ ] Tests · suites failing ≤ 43

---

### Sub-tarea 5 · Bulk action bar · Conciliar seleccionados + Eliminar · sobrio

**Origen** · mockup v8 · barra que aparece al seleccionar
**Tiempo** · 1-1.5h CC

#### Pre-flight obligatorio
```bash
# Localizar bulk action bar existente en Conciliación
grep -rnE "BulkBar|bulk.*selected|movimientos.*seleccionados" src/modules/tesoreria/ --include="*.tsx" 2>/dev/null | head -10

# Verificar acción conciliar masiva existente
grep -rnE "conciliarMasivo|bulkConciliar|reconcileMultiple" src/services/ 2>/dev/null | head -10
```

#### Plan
Bulk action bar · aparece cuando hay ≥1 fila seleccionada · oculto si 0 seleccionadas. Estilo según mockup v8 ·

**Fondo** · `bg-soft` (NO navy oscuro · NO gold saturado · sobrio cream con borde)
**Layout** · "{N} movimientos seleccionados" izquierda · botones derecha

**Botones**
- "Eliminar" · ghost (borde · sin relleno) · solo elimina movements en estado pendiente (los conciliados NO se eliminan desde aquí · CC valida)
- "Conciliar seleccionados" · navy primary (NO gold horripilante · co-diseño Jose) · solo se aplica a pendientes seleccionados

**NO incluir** · Asignar contrato · Cambiar categoría · Ignorar (estos pertenecen al flujo de importación de extracto · cuando se co-diseñe en pieza separada)

**Confirmación**
- Eliminar · modal de confirmación con count
- Conciliar seleccionados · sin modal (acción reversible · feedback toast)

#### Reusar
- Servicio de conciliación masiva si existe · si no · CC implementa loop sobre movementIds · servicio individual ya existe

#### Caso N/A parcial
Si bulk bar ya existe con estos 2 botones · marcar N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Bulk bar visible solo con ≥1 selección
- [ ] 2 botones · Eliminar (ghost) + Conciliar seleccionados (navy primary)
- [ ] Eliminar valida que solo afecta a pendientes
- [ ] Conciliar seleccionados aplica solo a pendientes
- [ ] NO botones Asignar contrato · Cambiar categoría · Ignorar
- [ ] Tests · suites failing ≤ 43

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | Ruta + página + banner navy + pager + sidebar vuelve | 2-3h |
| 2 | Toolbar acciones · Subir extracto + Nuevo movimiento gold | 1-1.5h |
| 3 | Filtros 3 ejes · Periodo + Tipo + Estado + Búsqueda · defaults | 1.5-2.5h |
| 4 | Tabla 5 columnas + día agrupador iconos + click fila → drawer | 2.5-3.5h |
| 5 | Bulk action bar · Conciliar seleccionados + Eliminar | 1-1.5h |

**Total** · 8-12h CC. Si hay 2-3 N/As · 5-8h CC.

---

## §4 · Reglas globales

1. CC arranca por sub-tarea 1 · sigue orden
2. Pre-flight pegado en commit message
3. Encadenar en una rama · 1 PR final único
4. NO mergear · esperar Jose
5. **Mockup v8 es referencia visual única** · `docs/mockups/atlas-tesoreria-v8-completo.html` (en el repo)
6. NO migrar paleta · usar la actual de la app
7. **NO TOCAR drawer Movimiento previsto existente** · solo invocarlo
8. **REUTILIZAR componentes y servicios existentes** · NO duplicar lógica · si hace falta extender · añadir prop opcional
9. Subir extracto y Nuevo movimiento · invocan modales existentes con accountId pre-rellenado
10. Bulk · solo Eliminar + Conciliar seleccionados · las otras acciones (asignar contrato · cambiar categoría · ignorar) se quedan para flujo de importación · pieza separada
11. NO arreglar 43 tests failing pre-existing
12. DB sigue v70 · NO upgrade

---

## §5 · Criterios de aceptación globales

- [ ] 5 sub-tareas ejecutadas o marcadas N/A con justificación
- [ ] 1 PR final con commits por sub-tarea
- [ ] PR description con tabla resumen estado
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Vista cuenta de Tesorería se ve como mockup v8** · verificable visualmente
- [ ] Click en card cuenta del carrusel (vista general) → llega a la cuenta correcta
- [ ] Pager funciona · sidebar Tesorería vuelve a vista general

---

## §6 · Tras merge · validación manual Jose

1. Vista general Tesorería · click en card cuenta del carrusel → llega a `/tesoreria/cuenta/:id`
2. Verificar banner navy compacto · misma altura que vista general · 5 columnas
3. Pager · ‹ › navega entre cuentas · counter "1 de 9" actualiza
4. Sidebar · click en "Tesorería" · vuelve a vista general (no se pierde nav state)
5. Botones · Subir extracto (ghost) · Nuevo movimiento (gold) · ambos abren modales existentes
6. Filtros · default es "Hoy + Todos + Pendientes" · cambiar a otros funciona · counts pills se actualizan
7. Tabla · 5 columnas · sin fecha · día agrupador con iconos ↑↓ y totales del día
8. Click en fila · abre drawer Movimiento previsto existente
9. Seleccionar 2 filas · aparece bulk bar sobrio · Conciliar seleccionados · funciona
10. Eliminar bulk · pide confirmación · valida que solo afecta a pendientes

---

## §7 · Cierre Fase B

Tras merge de este spec · Fase B Tesorería cerrada ·
- ✅ Vista general transformada (S-TESORERIA-FASE-B-VISTA-GENERAL)
- ✅ Vista cuenta nueva creada (este spec)
- ✅ Buscador global solo en Panel (S-APP-QUITAR-BUSCADOR-GLOBAL)

Pendientes futuros · NO en Fase B ·
- Modal "Subir extracto" con matching automático y "sugerir crear" · pieza separada
- Heurística "este se parece a 11 más" · futuro
- Reglas indicador problema en cards mes
- Mover Pendientes del día al Panel · cuando toquemos Panel
- Migración paleta v4 estricta a toda la app · futuro

---

**Fin del spec.**
**Listo para entregar a CC tras merge S-TESORERIA-FASE-B-VISTA-GENERAL.**
