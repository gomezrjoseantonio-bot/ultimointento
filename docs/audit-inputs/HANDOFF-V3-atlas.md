# HANDOFF · ATLAS · estado al cierre del 25 abril 2026

> Este documento traspasa el contexto necesario para continuar la construcción de ATLAS en un nuevo chat. Léelo entero antes de actuar.

---

## 1 · Plan global · 4 fases · DÓNDE ESTAMOS

ATLAS no se está construyendo en código directamente. Está en una fase previa de **diseño exhaustivo de mockups HTML** que actuarán como nueva guía de estilo. El plan es:

1. **FASE 1 · cerrar TODOS los mockups HTML** ← **ESTAMOS AQUÍ** (en curso · pieza por pieza)
2. **FASE 2 · guía de estilo consolidada** (extraída de los mockups)
3. **FASE 3 · mapeo de datos** (de qué store/campo viene cada elemento)
4. **FASE 4 · sólo entonces ir a CC** con todo cerrado · reset total de la web actual

Los mockups HTML SON la nueva guía en construcción · NO son la web viva. Cuando todo cierre · reset total y migración.

**Regla absoluta** · Jose dirá explícitamente cuándo ir a CC. NUNCA proponer ir a CC antes. NUNCA proponer MVPs ni iteración rápida. Cerrar las cosas bien desde el principio.

---

## 2 · Estado del modelo de datos · Personal v1.1 · CERRADO

Documento maestro · `/home/claude/ATLAS-Personal-modelo-datos-v1.md` (45 KB · 822 líneas).

**4 decisiones de arquitectura validadas:**
1. Perfiles cubiertos · Asalariado + Autónomo + Pareja con/sin ingresos
2. Obligaciones autónomo (M303 · M130 · RETA) viven en Fiscal · Personal solo refleja salida caja
3. Perfil fiscal y convivencia viven en Ajustes (estado global) · Personal solo lee
4. Pareja co-titular · hogar es la unidad · ingresos sumados · gastos compartidos

**14 axiomas inviolables:**
1. Cada compromiso se da de alta UNA vez · genera N eventos automáticos
2. Vivienda habitual genera derivados automáticos (alquilerVivienda · hipoteca · IBI VH · comunidad VH · seguro hogar VH NO existen como tipos de compromiso recurrente)
3. Vivienda inversión NO entra en Personal · va a Inmuebles
4. Calendario REAL no plano · IBI 2 pagos jun/nov · gas bimestral con anclaje
5. Importe puede variar por mes · luz 138 ene → 71 jun
6. Presupuesto 50/30/20 mide cumplimiento · buckets nombrados viven en Mi Plan
7. Nómina española real tiene 12-15 conceptos
8. Variable y bonus al 100% del objetivo (decisión G-02)
9. Tesorería = fuente única de eventos
10. Obligaciones fiscales viven en Fiscal · NO entran en 50/30/20
11. Mi Plan lee de Tesorería · no recalcula
12. Rentas NUNCA en gastosInmueble
13. Confirmar nómina genera aportación automática a plan pensiones del trabajador (decisión G-07)
14. Especies NO generan eventos en Tesorería (decisión G-03)

**10 gaps cerrados · destacan:**
- G-01 · opexRules + compromisosRecurrentes UNIFICADOS con discriminador `ambito: 'personal' | 'inmueble'`
- G-02 · variable/bonus al 100% sin factorRealizacion · realidad ajusta al cobrar
- G-04 · cuota solidaridad la rellena el usuario al alta nómina (no la calcula motor IRPF)
- G-07 · plan pensiones · al confirmar nómina ATLAS aporta automáticamente al productoId vinculado en Inversiones · suma a aportaciones acumuladas anuales · reduce base IRPF

**Categorías de gasto del hogar · 14 categorías mapeadas a 50/30/20:**
- Necesidades (50%) · vivienda.alquiler · vivienda.hipoteca · vivienda.suministros · vivienda.comunidad · vivienda.ibi · vivienda.seguros · alimentacion · transporte · salud · educacion
- Deseos (30%) · ocio · viajes · suscripciones · personal · regalos · tecnologia
- Ahorro+inversión (20%) · ahorro.aporteFondo · ahorro.aportePension · ahorro.amortizacionExtra · ahorro.cuentaTarget · **ahorro.cajaLiquida** (acumulación líquida es ahorro válido)
- Obligaciones (NO 50/30/20) · irpfPagar · irpfFraccionamiento · m130 · reta · cuotasProf · multas · donaciones

**8 patrones de calendario:**
- A · mensualDiaFijo
- B · mensualDiaRelativo (último hábil)
- C · cadaNMeses con anclaje (gas bimestral feb)
- D · trimestralFiscal (M303 · M130)
- E · anualMesesConcretos (IBI 2 pagos jun+nov)
- F · pagasExtra
- G · variable/bonus
- H · puntual

**Stores nuevos / rediseñados:**
- `compromisosRecurrentes` (NUEVO · universal con discriminador ambito)
- `viviendaHabitual` (NUEVO · 3 tipos · genera eventos directos sin compromiso intermedio)
- `nominas` (AMPLIAR a 9 bloques · empresa · contrato · salarioBruto · variable · especies · aportaciones · irpf · ss · cuentaCobro)
- `opexRules` UNIFICADO con compromisosRecurrentes
- `patronGastosPersonales` (DEPRECAR)
- `gastosPersonalesReal` #17 (ELIMINAR)

---

## 3 · Inventario de mockups · estado al cierre

### ✅ Cerrados antes de esta sesión
- atlas-panel.html
- atlas-fiscal.html
- atlas-archivo.html
- atlas-onboarding.html (18 pantallas)
- atlas-correccion.html (7 pantallas)
- atlas-historia-jose-v2.html
- atlas-contratos-v4.html (en proyecto)
- atlas-inmuebles-v3.html (en proyecto)
- atlas-inmueble-fa32-v2.html (en proyecto)
- atlas-wizard-nuevo-contrato.html (en proyecto)
- **atlas-tesoreria-v8.html** · 150 KB · última versión cerrada (iteró v3 → v4 → v5 → v6 → v7 → v8 a lo largo del día) · vista previsión consolidada hogar 30/60/90 días + caja inicial con saldo real + integración eventos desde catálogos

### ✅ Cerrados EN ESTA SESIÓN del 25 abril
- **atlas-personal-v3.html** · 288 KB · 4.008 líneas · 13 pantallas · 1.812 divs balanceados · 0 inconsistencias · 10/10 conceptos del modelo v1.1 reflejados
- **ATLAS-Personal-modelo-datos-v1.md** · 45 KB · 14 axiomas + 10 gaps cerrados
- **atlas-inversiones-v2.html** · 109 KB · esqueletos Plan Orange BBVA y Unihouser rellenados con páginas detalle
- **atlas-financiacion-v2.html** · 145 KB · 5ª pestaña Calendario con 6 bloques (KPIs · toolbar · tabla cuotas · desglose interés/amort · 4 cards escalones cashflow · tabla plurianual)
- **atlas-ajustes-v2.html** · 91 KB · 4 sub-pantallas (Notificaciones · Plantillas · Perfil fiscal y convivencia · Seguridad)

### ⏳ Pendientes Fase 1 · siguiente sesión

**1 · Mi Plan v2 · ÚNICO PENDIENTE de Fase 1**
Existe `atlas-mi-plan-v2.html` (190 KB) pero está incompleto. Hay que rehacerlo siguiendo estas decisiones cerradas:
- Proyección mes-a-mes navegable por años como columna vertebral del módulo
- "Mi presupuesto" SALE de Mi Plan (ya está en Personal v3)
- Tabs de Mi Plan v2 · Proyección + Libertad financiera + Objetivos + Fondos de ahorro + Retos
- Bola de nieve mueve a Financiación
- Mi Plan LEE de Personal · Inmuebles · Financiación · Inversiones · Fiscal · NUNCA recalcula
- Tesorería es la fuente única de eventos · Mi Plan los proyecta a futuro
- Objetivos actualmente está roto · arreglar primero

Una vez cerrado Mi Plan v2 · Fase 1 completa · se puede pasar a Fase 2 (guía de estilo consolidada).

---

## 4 · Cómo seguir en el nuevo chat

### Si el usuario pide "vamos con Mi Plan v2"
1. Lee `ATLAS-Personal-modelo-datos-v1.md` para refrescar el modelo
2. Lee `atlas-mi-plan-v2.html` actual para ver el punto de partida
3. Lee `atlas-personal-v3.html` para ver qué le manda Personal a Mi Plan
4. Lee `atlas-tesoreria-v8.html` para entender la fuente única de eventos que Mi Plan consume
5. Pregunta a Jose si quiere rehacer entero o iterar sobre el actual
6. Aplica `GUIA_DISENO_DEFINITIVA_V4.md` checklist sección 22 antes de cerrar

Mi Plan v2 es el ÚNICO pendiente · una vez cerrado · Fase 1 completa.

### Si el usuario pide validar Personal v3
Está en `/mnt/user-data/outputs/atlas-personal-v3.html`. Validaciones aplicadas:
- 1812/1812 divs balanceados
- 13 IDs de pantalla únicos
- 0/5 inconsistencias del modelo (todos los problemas v2 corregidos)
- 10/10 conceptos clave del modelo v1.1 presentes

### Reglas de oro de trabajo con Jose
- Jose NO programa · solo saca productos para pequeños inversores
- Trabaja en mockups HTML · CC programa luego cuando él diga
- Jose es exhaustivo · valida todo en su propia vida (5 propiedades · 3 bancos · mixed model) antes de sacar al mercado
- Si propones MVPs o iteración rápida · es bug · cerrar bien desde el principio
- Si dudas si algo está deployado · él te dirá · no preguntes
- Antes de pedir clarificación · revisa contexto previo
- Verifica comportamiento real del codebase antes de escribir specs

### Datos personales reales de Jose para los mockups
Cuando los mockups muestren un caso "Asalariado" · usar datos de la nómina real de Jose Orange España (PDFs uploads jun+ago 2025):
- Empresa Orange España S.A.U. · CIF A82009812 · centro La Finca Ed.05
- N. Empleado 34011380 · NIF 53069494F · IBAN ES61 0049 0052 6322 1041 2715 (Santander 2715)
- Salario base 6.474,71 €/mes · 14 pagas + 2 extras · variable 12.000 €/año (mar) · bonus 6.000 €/año (ene)
- IRPF 32-35% real · 47.913 €/año · SS 318,14 €/mes
- Especies · seguro vida 17,91 · médico ex 83,34 · médico noex 5,78 · ay.comida 50 · gasolina 60 · tráf telef 140,20 · PP empresa 155,18
- Aportación trabajador PP propio 116,39/mes · cuota solidaridad 5,47

Cuando los mockups muestren caso "Pareja" · datos ficticios (Carlos Vega + Lucía Martín · BBVA 4823 conjunta · ING 9046 Lucía · hijo Mateo · alquiler Bravo Murillo 1.350 €).

Préstamos del listado en Financiación (datos reales coherentes para Calendario):
- Unicaja · Hipoteca T64 · 142.800 € pendiente · 1.240 €/mes · 2,15% · vence 2044
- ING · Hipoteca T48 + cancelación 81,6/18,4 · 116.450 € · 1.480 €/mes · 3,20% · vence 2039
- Sabadell · Personal Cangas · 18.420 € · 485 €/mes · 4,75% · vence sep 2029
- Unicaja PP · Pignoraticia PP Orange · 13.300 € · 240 €/mes · 3,40% · vence 2031

Total cuota mensual hogar 3.445 € · liberación escalonada 2029 → 2031 → 2039 → 2044.

---

## 5 · Sistema de diseño v4 · invariantes

**Paleta Oxford Gold · única autorizada:**
```
--bg: #F5F4F1   --card: #FFFFFF   --card-alt: #FBFAF6
--line: #E6E3DC   --line-2: #EFECE5
--ink: #141B2E   --ink-2: #2C3547   --ink-3: #5B6474
--brand: #1E2954   --brand-wash: #E8EAF0
--gold: #B88A3E   --gold-wash: #F3EAD6   --gold-ink: #7C5C1F
--pos: #1E6B3A   --pos-wash: #E4F0E8
--neg: #A43328   --neg-wash: #F5E3E0
```

**Sidebar canónico · 11 items siempre en este orden:**
Panel · MIS ACTIVOS (Inmuebles · Inversiones · Tesorería · Financiación · Personal) · OPERATIVA (Contratos · Mi Plan · Fiscal · Archivo) · Ajustes.

**Reglas de oro:**
- Sin icono al H1
- Sin hero navy
- Sin card oro contribución
- Header canónico · H1 + subtitle + tabs underline
- Cards blancas con border-top color solo cuando aporta jerarquía
- Banda KPIs horizontal con separadores
- IBM Plex Sans (texto) + JetBrains Mono bold (números) + IBM Plex Mono (monetario · cadastral)
- Lucide-react icons solo · una fija por concepto según diccionario
- CSS tokens siempre · nunca hex hardcoded
- SUPERVISIÓN screens · header blanco · sin botones · sin navy
- GESTIÓN screens · header navy con KPIs y action buttons
- HORIZON/PULSE · ELIMINADOS de UI
- Cuando color ya transmite significado · NO repetir en texto (y viceversa)
- Urgency color coding (Contratos/Disponibilidad) · disponible AHORA = ROJO · vence <30d = AMBAR · vence 30-90d = GRIS

---

## 6 · Estructura de archivos clave

```
/home/claude/
├── ATLAS-Personal-modelo-datos-v1.md       ← MODELO DE DATOS PERSONAL v1.1 · LEER PRIMERO
├── HANDOFF-V3-atlas.md                     ← ESTE DOCUMENTO
│
│   MOCKUPS HTML CERRADOS · v3/v4
├── atlas-panel.html
├── atlas-personal-v3.html                  ← último cerrado
├── atlas-financiacion-v2.html              ← cerrado en sesión
├── atlas-inversiones-v2.html               ← cerrado en sesión
├── atlas-ajustes-v2.html                   ← cerrado en sesión
├── atlas-fiscal.html
├── atlas-archivo.html
├── atlas-onboarding.html (18 pantallas)
├── atlas-correccion.html (7 pantallas)
├── atlas-historia-jose-v2.html
├── atlas-contratos-v4.html
├── atlas-inmuebles-v3.html
├── atlas-inmueble-fa32-v2.html
├── atlas-tesoreria-v8.html                 ← ÚLTIMA versión cerrada (no v3 · iteró v3→v8)
├── atlas-wizard-nuevo-contrato.html
│
│   PENDIENTES · siguiente sesión
└── atlas-mi-plan-v2.html                   ← REHACER · ÚNICO pendiente de Fase 1

/mnt/project/
├── ATLAS-mapa-54-stores.md                 ← inventario de stores
├── ATLAS-mapa-datos-por-fuente.md
├── GUIA_DISENO_DEFINITIVA_V4.md            ← checklist sección 22 obligatorio
├── HANDOFF-V2-atlas.md                     ← previo a este (referencia histórica)
└── TAREA-CC-fase0-ejerciciosFiscales.md
```

---

## 7 · Stack técnico real (cuando llegue Fase 4)

- React 18 · TypeScript · Vite · Redux · IndexedDB · Netlify
- Repo · `gomezrjoseantonio-bot/ultimointento`
- Deploy · `ultimointentohoy.netlify.app`
- AI coding assistant · "CC" (Claude Code) implementa
- Esta instancia de Claude · arquitectura · diagnosis · specs

---

**Fin del handoff · próxima acción esperada · "vamos con Mi Plan v2" o "valida Personal v3"**

Mi Plan v2 es el ÚNICO mockup pendiente para cerrar Fase 1. Tesorería ya está cerrada en v8.
