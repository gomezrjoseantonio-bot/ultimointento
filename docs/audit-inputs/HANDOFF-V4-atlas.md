# HANDOFF · ATLAS · V4 · estado al cierre del 25 abril 2026 · post-Mi-Plan-v3

> Este documento traspasa el contexto necesario para continuar la construcción de ATLAS en un nuevo chat. Léelo entero antes de actuar.
>
> Sustituye a `HANDOFF-V3-atlas.md`.

---

## 1 · Plan global · 4 fases · DÓNDE ESTAMOS

ATLAS no se está construyendo en código directamente. Está en una fase previa de **diseño exhaustivo de mockups HTML** que actuarán como nueva guía de estilo para CC. El plan es:

1. **FASE 1 · cerrar TODOS los mockups HTML** · ✅ **COMPLETADA**
2. **FASE 2 · guía de estilo consolidada** · ✅ **COMPLETADA** (`GUIA-DISENO-V5-atlas.md`)
3. **FASE 3 · mapeo de datos** · stores → componentes · ⏳ **SIGUIENTE**
4. **FASE 4 · reset layout actual + migración a v3** · sólo entonces ir a CC

**Regla absoluta** · Jose dirá explícitamente cuándo ir a CC. NUNCA proponer ir a CC antes. NUNCA proponer MVPs ni iteración rápida. Cerrar las cosas bien desde el principio.

---

## 2 · Lo cerrado en esta sesión · Mi Plan v3

Mi Plan v3 era el último mockup pendiente de Fase 1. Se descartó el `atlas-mi-plan-v2.html` (3.295 líneas · "horripilante" según Jose) y se rehicieron los 6 mockups de cero · uno por cada vista.

### 6 mockups entregados (`/mnt/user-data/outputs/`)

```
atlas-mi-plan-landing-v3.html       28 KB · 416 líneas
atlas-mi-plan-proyeccion-v3.html    79 KB · 1.170 líneas
atlas-mi-plan-libertad-v3.html      50 KB · 766 líneas
atlas-mi-plan-objetivos-v3.html     40 KB · 605 líneas
atlas-mi-plan-fondos-v3.html        51 KB · 786 líneas
atlas-mi-plan-retos-v3.html         42 KB · 574 líneas
─────────────────────────────────────────────────────
TOTAL                              290 KB · 4.317 líneas
```

### Scope cerrado de Mi Plan

Mi Plan es **la brújula del usuario**. Responde a UNA pregunta · "¿voy bien hacia donde quiero ir?"

**5 vistas + 1 landing:**
- **Landing** · resumen + alerta del momento + grid 5 cards
- **Proyección** · cashflow estructural mes a mes 2026 (waterfall · pulso · tabla · plurianual 18 años)
- **Libertad financiera** · pregunta-meta · trayectoria 18 años · simulador con sliders
- **Objetivos** · metas concretas con fecha
- **Fondos de ahorro** · etiqueta de propósito sobre euros de Tesorería
- **Retos** · acción mensual concreta

**4 entidades propias** (única tab que edita y borra):
- `objetivos`
- `fondos_ahorro`
- `retos`
- `escenarios`

**Mi Plan LEE de todo · NUNCA recalcula · NUNCA escribe en stores ajenos.**

---

## 3 · Decisiones cerradas · Mi Plan v3

### 3.1 · Definición operativa de libertad financiera

**Renta pasiva neta operativa** = rentas alquiler + intereses inversión − gastos operativos inmuebles.

**No se resta cuota hipoteca** (la deuda mengua · al final desaparece). **No se resta IRPF** (también pagarás cuando seas libre · ya está en gastos vida).

**Caso Jose 2026 validado:**
- Renta pasiva neta operativa · **1.707 €/mes**
- Gastos vida libertad estimados · **3.500 €/mes** (escenario casa propia)
- Tasa libertad · **49%**
- Gap mensual · **−1.793 €/mes**
- Año libertad estimado · **2040** (en 14 años · plan híbrido con 6º inmueble 2032 + 7º inmueble 2040)

### 3.2 · Tipologías cerradas

**Objetivos · 4 tipos** · sin "libertad" (es vista) · sin "puntual" (es calendario operativo):
- `acumular` · vinculado a fondo (ej. colchón 12 meses)
- `amortizar` · vinculado a préstamo (ej. liquidar pignora antes 2030)
- `comprar` · vinculado a fondo + capacidad endeudamiento (ej. próximo piso)
- `reducir` · vinculado a categoría gasto (ej. bajar suscripciones a 80 €/mes)

**Fondos · 5 tipos predefinidos + custom:**
- `colchon` · seguridad imprevistos · meta = N meses gasto vida
- `compra` · piso · coche · obra mayor · meta importe + costes
- `reforma` · CAPEX en inmueble · meta importe presupuesto
- `impuestos` · provisión IRPF · IVA · M130
- `capricho` · vacaciones · ocio fuerte
- `custom` · libre

**Retos · 4 tipos:**
- `ahorro` · "Aportar X € al fondo Y" · medible vía saldo del fondo
- `ejecucion` · "Cancelar 3 suscripciones" · binario o numérico
- `disciplina` · "Mantener gasto vida bajo X €" · medible al cierre del mes
- `revision` · "Revisar y actualizar mis 4 préstamos" · binario

### 3.3 · Modelos validados

- **Fondos · híbrido cuenta dedicada por defecto + parcial cuando haga falta** · una cuenta puede etiquetar parte de su saldo a fondo X y el resto sin asignar.
- **Fondo y Objetivo son entidades SEPARADAS pero vinculadas** · el fondo existe siempre (tienes el dinero o no) · el objetivo es opcional (te has comprometido a llegar a X para fecha Y). Si borras el objetivo · el fondo sigue.
- **Libertad financiera · escenario "alquiler vs casa propia" como toggle** · refleja la situación real de Jose (paga alquiler 1.350 €/mes · no es propietario de su vivienda habitual).
- **Crecimiento renta pasiva en simulador · híbrido** · ATLAS estima base + tú añades hitos manuales (compras · revisiones).
- **Retos · 1 al mes · binario · ATLAS sugiere y tú aceptas/modificas/creas custom**.

### 3.4 · Componentes nuevos del módulo

- **Hero waterfall** mensual con toggle Cashflow ↔ Pulso (Proyección)
- **Hero gantt timeline** 6 filas para vista Pulso (Proyección)
- **Hero plurianual 18 años** con escalones reales por vencimientos (Proyección)
- **Hero compacto landing** · 1 línea narrativa + 4 mini stats horizontales
- **Hero gráfico trayectoria** · 2 líneas SVG cruzándose en punto libertad (Libertad financiera)
- **Hero reto activo** · grande · con barra progreso + countdown + acciones
- **Distribución por propósito** · barra horizontal stacked (Fondos)
- **Timeline 12 sellos circulares** · histórico de retos
- **Simulador con sliders** · resultado en panel navy (Libertad)
- **Cards con borde superior por tipo** · pattern coherente entre Objetivos · Fondos · Retos · Landing

### 3.5 · Cross-references entre vistas

Cada vista enlaza a las demás cuando hay relaciones:
- Objetivo `acumular` → Fondo destino
- Fondo → Objetivo asociado (si existe) · botón "Crear objetivo" si no
- Reto activo → Objetivo + Fondo vinculados
- Libertad → composición lee de Inmuebles · Inversiones · Personal
- Landing → 5 cards entran en cada tab

---

## 4 · Modelo de datos Personal v1.1 · sigue vigente

Documento maestro · `/home/claude/ATLAS-Personal-modelo-datos-v1.md` (45 KB · 822 líneas) · sin cambios en esta sesión.

**14 axiomas inviolables** · reproducidos íntegros en `HANDOFF-V3-atlas.md` sección 2.

**Ampliación post-Mi-Plan:**
- Mi Plan refuerza el axioma 11 · "lee de Tesorería · no recalcula"
- Confirmado · `ahorro.cajaLiquida` (categoría 50/30/20) coexiste con `fondos_ahorro` · son cosas distintas. Caja líquida es categoría de presupuesto · fondo es etiqueta de propósito sobre euros físicos.
- Confirmado · objetivo `acumular Colchón` y fondo `Colchón emergencia` son entidades separadas (NO la misma).

---

## 5 · Sistema de diseño v5 · referencia obligatoria

Documento maestro · `GUIA-DISENO-V5-atlas.md` (en outputs).

Sustituye a `GUIA_DISENO_DEFINITIVA_V4.md`. Incorpora todo lo aprendido en Mi Plan v3:
- Patrones de cards con borde superior por tipo
- KPIs strip con flex column + `margin-top: auto` (lección aprendida · alineación crítica)
- Pattern de bloque "ruta" con título block + texto inline
- Pattern SVG con coordenadas Y correctas (lección aprendida · `Y = max - (val/range × height)`)
- Patrones de hero × 4 variantes
- Tipologías de borde + estados visuales por dominio

Aplicar checklist completo antes de entregar cualquier mockup nuevo o tarea CC.

---

## 6 · Pendientes acumulados · NO bloquean Fase 3 · pero a apuntar

### 6.1 · Personal v3 · retoque puntual

**Eliminar el KPI "punto libertad financiera 67%"** del panel asalariado y del panel pareja.

Razón · ese KPI ahora es exclusivo de Mi Plan (decisión de zona gris validada con Jose). Personal v3 está cerrado · pero este cambio queda apuntado para aplicar antes de migración o como tarea CC menor.

Archivo · `atlas-personal-v3.html` (288 KB · 4.008 líneas) · buscar "punto libertad" o "67%" en los paneles asalariado y pareja.

### 6.2 · Proyección v3 · alineación de KPIs (consistencia visual)

**Aplicar el fix de KPIs** que apliqué en Objetivos · para que los subtítulos queden alineados al ras inferior cuando alguno rompe a 2 líneas.

CSS a copiar · `GUIA-DISENO-V5-atlas.md` sección "KPIs strip".

```css
.kpi-cell { display: flex; flex-direction: column; min-height: 92px; }
.kpi-val { line-height: 1.15; }
.kpi-sub { margin-top: auto; padding-top: 6px; }
```

### 6.3 · Datos para gráficos plurianuales

Los gráficos de Proyección plurianual y Libertad trayectoria usan datos sintéticos (escalones de compra · revisiones rentas). En Fase 4 (CC) habrá que decidir si:
- A) ATLAS calcula automáticamente con `Financiacion.calendarioPlurianual` + `inmuebles.contratos.revisiones`
- B) Usuario añade hitos manuales a través del simulador
- C) Híbrido (decisión validada · pero la lógica de cálculo no está spec'd aún)

---

## 7 · Plan de la siguiente sesión · ya pedido por Jose

> Cita textual · "El siguiente punto es revisar los storage de donde salgan los datos a implementar y ver como hacemos el reset del actual layout de la app y vamos con el nuevo"

### 7.1 · Revisión de storage · Fase 3

Documentos de partida (en `/mnt/project/`):
- `ATLAS-mapa-54-stores.md` · inventario actual de IndexedDB stores
- `ATLAS-mapa-datos-por-fuente.md` · de qué stores vienen los datos por módulo
- `atlas_mapa_datos.pdf` · referencia visual

**Tarea concreta para abrir:**
Mapear cada componente visual de los 6 mockups de Mi Plan a los stores que lo alimentan:
- Mi Plan · Landing → ¿qué stores leen los KPIs · alerta · grid de cards?
- Mi Plan · Proyección → ¿`treasuryEvents` · `gastosInmueble` · `contracts` · `rentaMensual` · `nominas`?
- Mi Plan · Libertad → ¿lee de TODO · qué transformaciones aplica?
- Mi Plan · Objetivos → store nuevo `objetivos`
- Mi Plan · Fondos → store nuevo `fondos_ahorro` + lectura `cuentas` de Tesorería
- Mi Plan · Retos → store nuevo `retos`

Hay que decidir:
- 4 stores nuevos a crear · `objetivos` · `fondos_ahorro` · `retos` · `escenarios`
- Esquema de cada uno (campos · keyPath · índices)
- Relaciones entre ellos y con stores existentes

### 7.2 · Reset del layout actual + migración · Fase 4

El plan según handoff v3 era · "cuando todo cierre · reset total y migración".

Ahora que Fase 1 y 2 están cerradas · el reset es viable. Tareas previsibles:
1. Auditoría · qué del layout actual (`ultimointentohoy.netlify.app`) sobrevive y qué se borra
2. Plan de migración por módulos · orden recomendado · Personal → Tesorería → Inmuebles → Financiación → Inversiones → Mi Plan → Fiscal → Archivo
3. Tarea CC con scope completo (no MVPs) · cerrar todo el reset en una pasada

**Importante** · Jose tiene canal de venta pre-construido (Zona 3 · Libertad Inmobiliaria · Unihouser). El reset no es para "salir al mercado rápido" · es para que el dogfooding suyo (5 inmuebles · 3 bancos · datos reales) valide TODO antes de venderlo. Cerrar bien · no cerrar deprisa.

---

## 8 · Estructura de archivos clave (actualizada)

```
/home/claude/atlas/
├── atlas-mi-plan-landing-v3.html
├── atlas-mi-plan-proyeccion-v3.html
├── atlas-mi-plan-libertad-v3.html
├── atlas-mi-plan-objetivos-v3.html
├── atlas-mi-plan-fondos-v3.html
└── atlas-mi-plan-retos-v3.html

/mnt/user-data/outputs/
├── atlas-mi-plan-landing-v3.html              ← LANDING
├── atlas-mi-plan-proyeccion-v3.html           ← PROYECCIÓN
├── atlas-mi-plan-libertad-v3.html             ← LIBERTAD
├── atlas-mi-plan-objetivos-v3.html            ← OBJETIVOS
├── atlas-mi-plan-fondos-v3.html               ← FONDOS
├── atlas-mi-plan-retos-v3.html                ← RETOS
├── HANDOFF-V4-atlas.md                        ← ESTE DOCUMENTO
└── GUIA-DISENO-V5-atlas.md                    ← SISTEMA DE DISEÑO

/mnt/project/
├── ATLAS-Personal-modelo-datos-v1.md          ← MODELO DE DATOS · sigue vigente
├── ATLAS-mapa-54-stores.md                    ← inventario stores · partida Fase 3
├── ATLAS-mapa-datos-por-fuente.md             ← partida Fase 3
├── atlas_mapa_datos.pdf                       ← referencia visual stores
├── HANDOFF-V3-atlas.md                        ← previo · referencia histórica
├── HANDOFF-V2-atlas.md                        ← previo · referencia histórica
├── GUIA_DISENO_DEFINITIVA_V4.md               ← previo · sustituido por V5
│
│   MOCKUPS PREVIOS · cerrados antes de Mi Plan v3
├── atlas-panel.html
├── atlas-personal-v3.html                     ← PENDIENTE retoque (KPI libertad)
├── atlas-financiacion-v2.html
├── atlas-inversiones-v2.html
├── atlas-ajustes-v2.html
├── atlas-fiscal.html
├── atlas-archivo.html
├── atlas-onboarding.html (18 pantallas)
├── atlas-correccion.html (7 pantallas)
├── atlas-historia-jose-v2.html
├── atlas-contratos-v4.html
├── atlas-inmuebles-v3.html
├── atlas-inmueble-fa32-v2.html
├── atlas-tesoreria-v8.html
├── atlas-wizard-nuevo-contrato.html
└── atlas-mi-plan-v2.html                      ← OBSOLETO · sustituido por los 6 v3
```

---

## 9 · Cómo seguir en el nuevo chat

### Si el usuario pide "vamos con storage" / "Fase 3"
1. Lee `ATLAS-mapa-54-stores.md` y `ATLAS-mapa-datos-por-fuente.md`
2. Lee este handoff sección 3 (decisiones de Mi Plan) y sección 7.1 (tarea de mapeo)
3. Abre los 6 mockups de Mi Plan en `/mnt/user-data/outputs/`
4. Pregunta a Jose por dónde empezar · sugiero módulo a módulo siguiendo orden Mi Plan
5. Para cada componente visual identifica · store origen + campo + transformación

### Si el usuario pide "reset del layout" / "Fase 4"
1. Lee este handoff sección 7.2
2. Necesita una auditoría del estado actual del repo `gomezrjoseantonio-bot/ultimointento`
3. Plan de orden de migración por módulo
4. Eventualmente · spec exhaustiva para CC

### Si el usuario pide validar / pulir un mockup de Mi Plan
1. Lee este handoff sección 2 y 3
2. Lee `GUIA-DISENO-V5-atlas.md`
3. Aplica checklist sección 18 antes de cerrar
4. Abre el mockup desde `/mnt/user-data/outputs/atlas-mi-plan-{tab}-v3.html`

### Reglas de oro de trabajo con Jose (sin cambios)
- Jose NO programa · solo saca productos para pequeños inversores
- Trabaja en mockups HTML · CC programa luego cuando él diga
- Jose es exhaustivo · valida en su propia vida (5 propiedades · 3 bancos · mixed model) antes de mercado
- Si propones MVPs o iteración rápida · es bug · cerrar bien desde el principio
- Si dudas si algo está deployado · él te dirá · no preguntes
- Antes de pedir clarificación · revisa contexto previo
- Verifica comportamiento real del codebase antes de escribir specs
- Jose usa "·" como separador · no emojis · responde corto · valora brevedad
- Jose cuestiona armonía visual · alineaciones · redundancias

### Datos personales reales de Jose para mockups (sin cambios)
- Empresa Orange España S.A.U. · CIF A82009812
- N. Empleado 34011380 · NIF 53069494F · IBAN ES61 0049 0052 6322 1041 2715 (Santander 2715)
- Salario base 6.474,71 €/mes · 14 pagas + 2 extras · variable 12.000 €/año (mar) · bonus 6.000 €/año (ene)
- IRPF 32-35% real · 47.913 €/año · SS 318,14 €/mes
- Cuentas · Santander 2715 · Sabadell 9421 · Unicaja 4437

**Préstamos del listado en Financiación (datos reales coherentes):**
- Unicaja · Hipoteca T64 · 142.800 € · 1.240 €/mes · 2,15% · vence 2044
- ING · Hipoteca T48 · 116.450 € · 1.480 €/mes · 3,20% · vence 2039
- Sabadell · Personal Cangas · 18.420 € · 485 €/mes · 4,75% · vence sep 2029
- Unicaja · Pignoraticia PP Orange · 13.300 € · 240 €/mes · 3,40% · vence 2031

Total cuota mensual hogar 3.445 € · liberación escalonada 2029 → 2031 → 2039 → 2044.

**Inmuebles de Jose (5 activos · 1 vendido):**
- Carles Buigas 15 · Sant Fruitós · alquiler completo · renta 850 €/mes
- Tenderina 64-4D · Oviedo · 5 hab long-stay · renta 450 €/mes habitación principal
- Tenderina 64-4IZ · Oviedo · 5 hab long-stay
- Fuertes Acevedo 32 · Oviedo · 5 hab mixed (3 short + 2 long)
- Manresa · alquiler completo familiar
- Tenderina 48 · vendido nov 2025

**Pendientes de transformación (edge cases):**
- Trastero T64 5·01 (RC 0654104TP7005S0011AA) · convertir en 2 viviendas
- Santa Catalina CB · división horizontal · 7 RCs → 100 RCs (los 100 reales)

**Inversiones reales:**
- Smartflip · préstamo participativo · 750 €/mes intereses
- Unihouser · investor base · 420 €/mes
- Plan Pensiones BBVA Orange · vinculado a aportación trabajador

---

## 10 · Stack técnico (cuando llegue Fase 4)

- React 18 · TypeScript · Vite · Redux · IndexedDB · Netlify
- Repo · `gomezrjoseantonio-bot/ultimointento`
- Deploy · `ultimointentohoy.netlify.app`
- AI coding assistant · "CC" (Claude Code) implementa
- Esta instancia de Claude · arquitectura · diagnosis · specs
- Mockups en HTML estático · paleta + componentes definidos en `GUIA-DISENO-V5-atlas.md`

---

**Fin del handoff · próxima acción esperada · "vamos con Fase 3 · storage" o "vamos con reset del layout"**

Mi Plan v3 cierra Fase 1 y 2 completas. Ya solo queda mapear datos (Fase 3) y resetear layout actual (Fase 4) antes de ir a CC.
