# TAREA-CC · TESORERÍA V5 · implementación del mockup cerrado

**Fecha:** 1 agosto 2026
**Branch base:** `main`
**Rama:** `feat/tesoreria-v5`
**Tipo:** rediseño completo de módulo + conexión al modelo existente
**Mockups de referencia (fuente de verdad visual y funcional):**
- `atlas-tesoreria.html` — escritorio
- `atlas-tesoreria-movil.html` — móvil

**Guía vinculante:** `GUIA-DISENO-V5-atlas.md` (Oxford Gold V5) · el checklist de la sección 17 es condición de entrega.

---

## 0 · FASE DE VERIFICACIÓN · OBLIGATORIA · STOP-AND-REPORT

> **NO escribas una sola línea de código hasta completar esta fase y reportar.**
> Los documentos de referencia del proyecto están desactualizados (`ATLAS-mapa-stores-VIGENTE.md` documenta DB_VERSION 53; la DB real va por v75+). Todo lo que sigue en esta tarea asume el modelo descrito, pero **la fuente de verdad es el código**.

Ejecuta y reporta en el PR (o antes, si algo no cuadra):

```bash
# 1 · versión real de la DB y stores de tesorería
grep -n "DB_VERSION" src/services/db.ts
grep -n "createObjectStore" src/services/db.ts | grep -iE "accounts|movements|treasuryEvents|importBatches|matchingConfiguration|movementLearningRules"

# 2 · interfaces reales
grep -n "interface Account\b" -A 40 src/services/db.ts
grep -n "interface Movement\b" -A 60 src/services/db.ts
grep -n "interface TreasuryEvent\b" -A 60 src/services/db.ts

# 3 · UI actual de tesorería y sus rutas
grep -rn "TesoreriaV4\|TreasuryReconciliationView\|BalancesBancariosView\|RadarPanel" src/ --include=*.tsx --include=*.ts
grep -rn "path=.*tesoreria\|path=.*conciliacion" src/

# 4 · servicios que escriben/leen treasuryEvents y movements
grep -rln "treasuryEvents" src/services/ src/components/
grep -rln "'movements'" src/services/ src/components/

# 5 · import de extracto ya existente
grep -rn "bankStatementImportService\|BankStatementWizard\|ImportModal" src/

# 6 · catálogo de familia/concepto de gasto (debe ser ÚNICO con inmuebles)
grep -rn "categoria\|familia" src/services/*ompromiso* src/services/*opex* 2>/dev/null | head -20
grep -rln "CATEGORIAS\|CATALOGO" src/
```

**Reporta antes de implementar:**

| Punto | Qué confirmar |
|---|---|
| A | DB_VERSION actual · ¿hace falta bump? (esta tarea **no** debería necesitarlo — ver §2) |
| B | Interfaces reales de `Account`, `Movement`, `TreasuryEvent` · campos disponibles vs. los que pide el mockup |
| C | Rutas actuales (`/tesoreria`, `/conciliacion`) y qué componente sirve cada una |
| D | Dónde vive HOY el catálogo familia→concepto de gastos que usa el alta de gasto recurrente del inmueble |
| E | Si `treasuryEvents` sigue siendo el store de previsión y `movements` el de confirmado (modelo del 19/04/2026) |

**Si algo contradice esta tarea → PARA y reporta. No inventes solución.**

---

## 1 · OBJETIVO

Sustituir la Tesorería actual por el módulo rediseñado y cerrado con Jose. Una sola pantalla, un solo lenguaje visual, y el trabajo operativo (confirmar, conciliar, anotar) resuelto sin salir de ella.

**La pregunta que responde Tesorería** (y que la diferencia del Panel):
> ¿Tengo para pagar lo que viene, cuenta a cuenta, mes a mes?

---

## 2 · MODELO DE DATOS · SIN STORES NUEVOS

Se respeta el modelo cerrado el 19/04/2026. **No se crean stores. No se bumpea DB_VERSION** (salvo que la fase 0 revele que falta un campo imprescindible — en ese caso, PARA y reporta antes).

| Estado UI | Store | Significado | Reversible |
|---|---|---|---|
| `previsto` | `treasuryEvents` (`status: predicted`) | Lo que ATLAS espera que ocurra | — |
| `confirmado` | `movements` | El usuario afirma que ocurrió | **Sí** → vuelve a previsto |
| `conciliado` | `movements` (casado con línea de extracto) | Lo afirma el banco | **No** |

**Reglas absolutas:**

1. Todo nace como `treasuryEvent` con `status: predicted`.
2. Confirmar materializa un `movement` y **mueve el saldo de la cuenta al instante** (ver §4.6).
3. Desconfirmar revierte el `movement` y devuelve el evento a `predicted`.
4. **`conciliado` no se puede deshacer desde la UI** — lo afirmó el banco.
5. Descartar un previsto lo marca como descartado (no ocurrirá); **no toca el saldo**.
6. `gastosInmueble` ABSOLUTE RULE sigue vigente: **el ingreso por alquiler NUNCA se escribe ahí**.

---

## 3 · ALCANCE · QUÉ SE SUSTITUYE

| Componente actual | Acción |
|---|---|
| `TesoreriaV4.tsx` | **SUSTITUIR** por la nueva página |
| `TreasuryReconciliationView.tsx` | **ABSORBER** — su función vive ahora dentro del drawer de cuenta (pestañas Pendientes / Todo) |
| `NewMovementModal` | **SUSTITUIR** por la ficha única de movimiento (§4.5) |
| `ImportModal` / `BankStatementWizard` | **REUTILIZAR el servicio** (`bankStatementImportService`), **sustituir la UI** por el drawer de extracto (§4.7) |
| `BancosManagement` | **ABSORBER** el alta/edición/baja de cuenta (§4.8). Si la ruta `/configuracion/cuentas` sigue existiendo, debe usar el mismo componente de ficha |
| `RadarPanel` / `treasuryRecommendations` | **NO TOCAR** (sin ruta activa) |
| `treasuryForecastService`, `treasurySyncService`, `loanSettlementService`, `propertySaleService`, `inversionesService`, `ejercicioLifecycleService`, `fiscalConciliationService` | **NO TOCAR** — siguen emitiendo `treasuryEvents` como hoy |

**PROHIBIDO:**
- Crear pantallas nuevas fuera de `/tesoreria`. Todo vive en una página + drawers.
- Duplicar el catálogo de familia/concepto. **Debe leerse de la misma fuente que el alta de gasto del inmueble** (verificar en fase 0, punto D).
- Tocar el motor de previsiones.
- Escribir rentas en `gastosInmueble`.

---

## 4 · ESPECIFICACIÓN PANTALLA A PANTALLA

> El mockup `atlas-tesoreria.html` es la referencia exacta de maquetación, tokens, espaciados y textos. Lo que sigue fija el comportamiento.

### 4.1 · Hero (banda navy · `--brand` · filo superior 3px `--gold`)

4 KPIs + acción:

| KPI | Cálculo |
|---|---|
| **Saldo** | Σ saldo actual de todas las cuentas · sub: "N cuentas · hoy" |
| **Pendiente entrar** | Σ previstos positivos del mes en curso · sub: "N movimientos · mes" |
| **Pendiente salir** | Σ previstos negativos del mes en curso |
| **Cierre · {mes}** | Saldo + pendiente entrar + pendiente salir · **en `--gold-soft`** · sub: "proyectado a día {último}" |

- Botón `btn-gold` **Subir extracto** → abre el drawer de extracto en modo global (§4.7).
- Importes en blanco; el signo `+`/`−` indica dirección. **Sin verde/rojo sobre navy.**

### 4.2 · Saldo actual en mis cuentas

- Carrusel de tarjetas · **5 visibles ≥1240px · 4 ≥1000px · 3 por debajo**.
- Flechas circulares **superpuestas sobre los bordes** (`position:absolute`), nunca en el flujo — la tira debe alinearse exactamente con el hero. La flecha deshabilitada es invisible (`opacity:0`), no un hueco gris.
- **Drag & drop para reordenar** (persistir el orden del usuario).
- Tarjeta: punto de banco · nombre · `···· mask` · **saldo siempre en `--ink`** · pie de estado.
- **Estado (uno solo por tarjeta):**
  - al día → texto gris `--ink-4`
  - `N por confirmar` → texto gris, sin chip de fondo
  - se queda corta → punto ámbar + `se queda en −X € el {día}` + filo superior `--warn`
- **Regla de color:** el punto de banco es la única identidad cromática; el ámbar la única nota de aviso. **Los números nunca se colorean.**
- Lápiz al hover (arriba dcha.) → ficha de cuenta (§4.8). Click en la tarjeta → drawer de cuenta (§4.4). `event.stopPropagation()` obligatorio en el lápiz.

### 4.3 · Movimientos bancarios · próximos 6 meses

- Rejilla 3×2. Rango (`jul – dic 2026`) **junto al título**, no suelto a la derecha.
- Tarjeta de mes: nombre · chip `en curso` si aplica · label `Cierre` · **saldo al cierre** · pie con iconos ↑/↓ y los importes de entra/sale (en el mes en curso: *queda* entrar / *queda* salir).
- Vocabulario único: **Cierre** en todo el módulo (nunca "saldo a fin de mes" / "saldo al cierre" mezclados).
- Click en un mes → drawer de calendario diario (§4.9).

### 4.4 · Drawer de cuenta

**Cabecera navy** (`--brand` + filo oro) con punto, nombre, mask y 4 KPIs: Saldo hoy · Pendiente entrar · Pendiente salir · **Saldo final** (oro). Se recalculan en vivo.

**Una sola fila de controles:** pestañas `Pendientes · N` / `Todo {mes}` a la izquierda; en Pendientes, a la derecha `Anotar` (ghost) y `Subir extracto` (gold), compactos.

**Pestaña Pendientes** — es la bandeja de trabajo:
- Agrupada en **tarjetas por día** con subtotal en la cabecera. Dentro, si son rentas: subcabecera de **piso** y debajo la habitación (anidamiento piso → habitación).
- **Filas alineadas** (sin sangría): círculo · concepto · estado · importe · lápiz · ✕.
- **Título = lo que dice el banco** (nombre del inquilino, compañía emisora). **Subtítulo = la traducción de ATLAS** (habitación, inmueble, aviso). El subtítulo solo existe si aporta algo que la fila no dice ya — **nunca repetir importe ni estado**.
- Acciones por fila: **círculo** = confirmar · **lápiz** = editar (§4.5) · **✕** = descartar (no existirá).
- Toda acción destructiva o de estado ofrece **Deshacer** en el toast.
- Estado vacío: "Nada pendiente · el mes está al día en esta cuenta".

**Pestaña Todo {mes}** — consulta:
- **Buscador pequeño** (~150px, discreto) que filtra por concepto, inmueble, familia/concepto e importe.
- **Ejes de agrupación:** Fecha (defecto, desc) · Inmueble · Qué es. Dentro de cada grupo, **orden por fecha descendente** siempre.
- Grupos en **tarjetas plegadas** con recuento y **subtotal** en cabecera; se abren al buscar.
- El check de un `confirmado` es pulsable → devuelve a Pendientes. El de `conciliado` es un **tick gris informativo, no un botón**.

### 4.5 · Ficha de movimiento (editar / anotar) · formulario plano

Modal centrado. **Sin iconos decorativos, sin chips, sin frases de ayuda innecesarias.** Etiqueta + campo.

| Campo | Notas |
|---|---|
| Tipo | `Gasto` / `Ingreso` / `Transferencia` (solo en alta) |
| Concepto | texto |
| Importe real | con hint `previsto −74,09 €` al editar |
| Fecha | |
| Cuenta | |
| **Familia** | **catálogo ÚNICO compartido con el alta de gasto del inmueble** |
| **Concepto** | filtrado por la familia elegida |
| Inmueble | |

- **En edición:** familia y concepto vienen **prefijados por la clasificación automática** de ATLAS (por emisor/patrón/contrato). El usuario solo corrige si se equivocó. **Nunca se le pide elegir "categoría fiscal"** — el mapeo a la casilla de Hacienda es responsabilidad de ATLAS.
- **Transferencia:** oculta Familia/Concepto/Inmueble y muestra **Cuenta destino** (cuentas propias + "Externa"). Si el destino es una cuenta propia, **mueve los dos saldos** y deja apunte espejo en ambas. No es gasto fiscal.
- Guardar en edición → `movement` confirmado con el importe real.
- Alta → entra directamente como **confirmado** (es algo ya pagado/cobrado).
- **NO hay campo de documento.** La factura vive en el **Archivo** y se enlaza desde allí.
- Pie: `Eliminar` (izq., solo en edición) · `Cancelar` · `Guardar`.

### 4.6 · Saldo vivo · REQUISITO FUNCIONAL

Confirmar, editar con importe real, anotar, descartar, transferir o conciliar **actualiza al instante**: KPIs del drawer, tarjeta de la cuenta, hero y bloque "Cómo va {mes}". **Nunca exigir recargar la pantalla.**

### 4.7 · Drawer · Subir extracto

**Dos puertas, un solo flujo:**
- Desde el hero → cabecera: "la cuenta se detecta por el IBAN del fichero".
- Desde una cuenta → cuenta ya fijada.

**Paso 1** · dropzone: "Arrastra aquí el extracto o haz clic para elegir · Norma 43, Excel o CSV". Usar `bankStatementImportService` existente (verificado en fase 0).

**Paso 2** · resultado del emparejamiento automático contra los previstos (por importe, fecha y referencia):
- Resumen: `N líneas` · `N cuadran` · `N a resolver` · `N ignoradas`.
- Cada línea muestra **el texto literal del banco** + fecha + importe, y debajo el veredicto:
  - cuadra → `→ cuadra con {previsto}`
  - sin cuadre → acciones **Asignar a un previsto** · **Crear movimiento** (abre §4.5 prerrellenada) · **Ignorar** (reversible, con enlace "recuperar")
- **Un solo botón `Guardar`** al pie que consolida la sesión: concilia lo que cuadra, aplica lo ignorado, mueve saldos y cierra. El aspa = salir sin guardar. **No hay botón intermedio de conciliar.**
- Lo no resuelto **no se mezcla** con la lista de la cuenta: espera en el extracto.
- El fichero se archiva en el **Archivo**, vinculado a cuenta y periodo.

### 4.8 · Ficha de cuenta (alta / edición / baja)

- Tipo: **Cuenta** / **Tarjeta de crédito**.
- *Cuenta*: banco · nombre · últimos 4 dígitos · **saldo inicial + a fecha de** (desde ahí ATLAS calcula el saldo con los movimientos; **el saldo actual no se teclea**).
- *Tarjeta*: **sin selector de banco** — lo hereda de la cuenta de liquidación · nombre · 4 dígitos · **cuenta donde se liquida** · día de cargo · límite.
- **Color del punto:** selector tipo paleta (rejilla completa + estándar + **Sin color**), con el color del banco como opción por defecto.
- Baja: **bloqueada si la cuenta tiene movimientos pendientes** (mensaje explícito). Si procede, con Deshacer.

### 4.9 · Drawer · calendario diario

- Navegación ‹ › entre meses sin cerrar.
- Resumen del mes: queda entrar · queda salir · **Cierre**.
- Rejilla de días (lunes primero) con **neto real del día**; punto ámbar en los días que dejan una cuenta corta; hoy con filo oro.
- Al elegir día: movimientos con estado, **confirmar** (círculo), **editar** (lápiz), **descartar** (✕ en previstos) y acción `Confirmar el día`.
- **En el día NO se concilia** — conciliar es por cuenta y por fichero.

### 4.10 · Cómo va {mes} · realidad sobre lo previsto

Bloque a la derecha del calendario (2 columnas; apila bajo 1180px).

- Tres líneas: **Ingresos · Gastos · Neto**.
- Cada línea: **barra escalada contra SU PROPIO previsto** (no contra el máximo global) + **porcentaje fuera de la barra**, en su color (navy / oro para el neto). Derecha: `13.800 € / de 16.875 previsto`.
- Colores: barras `--brand`, neto `--gold`, `--warn` solo si algo va corto. **Sin verde.**
- Cierre del bloque: **la desviación**, no el cierre (que ya está en el hero):
  > **Acabarás +365 € mejor de lo previsto**
  > de lo ya confirmado, habías previsto pagar 1.838,42 € y has pagado 1.473,42 €
- La desviación se calcula **comparando iguales**: lo previsto *de lo ya confirmado* contra lo realmente pagado.

### 4.11 · Móvil (`atlas-tesoreria-movil.html`)

- Mini-hero navy: Saldo hoy + Cierre en oro.
- **Pendientes agrupados por cuenta**, confirmables con el pulgar (toque en el círculo → saldo actualizado al instante).
- `Subir extracto` a ancho completo. Tabbar: Panel · Tesorería · Fiscal · Archivo.
- Estado al día: "Nada pendiente · tus N cuentas están al día" + cierre proyectado en oro.

---

## 5 · REGLAS DE DISEÑO · VINCULANTES

- **Tokens Oxford Gold V5 únicamente.** Cero hex hardcoded. Única excepción: colores de marca de banco (identidad, no semántica) y el color de punto elegido por el usuario.
- **Números siempre en `--ink`.** El color solo aparece donde hay que actuar (`--warn`) o en la cifra-veredicto (`--gold`).
- **Nunca `--gold-ink` (#7C5C1F) para cifras** — se lee marrón. Usar `--gold`.
- **Formato de importe único:** miles con punto; dos decimales solo si los hay (`+1.000 €`, `−38,20 €`, `24.465,80 €`).
- Separador `·`. Sentence case. Iconos Lucide, uno por concepto. Sin emojis.
- Cuando el color comunica el estado, **no repetirlo en texto**, y viceversa.
- Toast con id `toast` y helper único; las acciones que no navegan muestran toast con info útil y **Deshacer** cuando aplique.
- **Checklist de la sección 17 de `GUIA-DISENO-V5-atlas.md`: obligatorio antes de abrir el PR.**

---

## 6 · CRITERIOS DE ACEPTACIÓN

- [ ] Fase 0 completada y reportada
- [ ] `/tesoreria` sirve la nueva pantalla; no queda UI antigua accesible ni rutas huérfanas
- [ ] Cero stores nuevos · cero bump de DB_VERSION (o justificado y aprobado)
- [ ] Confirmar / desconfirmar / descartar / anotar / transferir / conciliar mueven saldo **en vivo** en hero, tarjeta, drawer y bloque de realidad
- [ ] `conciliado` no reversible desde UI; `confirmado` sí
- [ ] Catálogo familia→concepto **compartido** con el alta de gasto del inmueble (una sola fuente)
- [ ] Extracto: emparejamiento automático + asignar/crear/ignorar + **un solo Guardar** + archivado en Archivo
- [ ] Alta/edición/baja de cuenta y tarjeta, con bloqueo de baja si hay pendientes
- [ ] 5 tarjetas de cuenta a ≥1240px; tira alineada con el hero; sin scroll horizontal
- [ ] La página entra sin scroll vertical en 1440×900 con sidebar abierta
- [ ] Checklist sección 17 pasado
- [ ] Sin regresión en Panel, Inmuebles, Fiscal ni en el motor de previsiones

---

## 7 · ENTREGA

1. Rama `feat/tesoreria-v5`.
2. **PR abierto, NUNCA merge unilateral.**
3. En la descripción del PR: reporte de la fase 0, decisiones tomadas, y lo que quede fuera de alcance.
4. Si aparece cualquier contradicción entre esta tarea y el código real → **para y reporta**. No improvises una solución intermedia.
