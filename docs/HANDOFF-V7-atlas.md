# HANDOFF V7 · ATLAS · 2026-05-04 · post-T38 · T39 lista para lanzar

> **Para el próximo Claude** · este documento te da el contexto completo para continuar sin que Jose tenga que repetir nada. Léelo entero antes de responder a Jose.
>
> **Estado actual** · T38 mergeada en producción · datos coherentes · T39 (listado redesign) redactada y lista para lanzar a CC · stop-and-wait.

---

## 1 · Quién es Jose · cómo trabaja · reglas que NUNCA debes romper

**Jose · founder no-programador.** Construye ATLAS para pequeños inversores inmobiliarios (1-10 inmuebles) que persiguen libertad financiera. Él mismo es el caso real más complejo (5-6 propiedades · 3 bancos · mixto larga/corta/turística · inspecciones fiscales reales) y se usa como dogfooding validator.

**Workflow · Claude → CC · stop-and-wait.**

1. Jose y Claude diseñan la arquitectura
2. Claude redacta spec markdown exhaustivo
3. Claude entrega spec a Jose · Jose lo lanza a CC (GitHub Copilot / Claude Code)
4. CC ejecuta · 1 sub-task por PR · NO parallel · stop-and-wait
5. CC abre PR · NO mergea · espera autorización Jose
6. Jose valida en deploy preview con DevTools
7. Jose mergea cuando OK
8. Jose vuelve a Claude para siguiente paso

**Reglas operativas absolutas · jamás las violes:**

- **NO improvisar specs sin auditar arquitectura real** · siempre sección 3 obligatoria de "auditoría antes de codear" en cada spec CC
- **NO MVPs ni iteración rápida** · Jose es exhaustivo · cierra correctamente desde el inicio
- **NO mover a CC sin orden explícita de Jose** · "ok" · "si" · "lanza" · "adelante"
- **Mockup HTML antes que spec siempre que haya UI nueva** · Jose valida visualmente · luego se redacta spec
- **Tablas numeradas con Jose para refinamiento** · evita ambigüedad de campos
- **Migración suave · enriquecer datos · NUNCA destructiva**
- **UI funcional ANTES que visualización/análisis** · "no empezar la casa por el tejado" · regla aprendida en sesión anterior
- **Cita literal Jose · "lo bueno es que todo me pasa a mi · por lo que el 99% de los casos los habremos tratado"** · él valida todo contra su realidad

**Estilo de comunicación que Jose espera:**

- Respuestas largas pero estructuradas con tablas y listas
- Voto razonado tuyo · pero la decisión es suya
- Una pregunta única al final · NO asaltar con varias
- NO emojis salvo Jose los use primero
- Respeta su tipografía sin corregirle errores ortográficos

---

## 2 · Stack técnico · qué hay debajo

| Pieza | Detalle |
|---|---|
| Frontend | React 18 · TypeScript · Vite |
| Estado | Redux + IndexedDB (idb) |
| DB nombre real | **`AtlasHorizonDB`** · NO "atlas" |
| DB versión actual | **68** (subió de 67 en T38) |
| Stores activos | 40 |
| Deploy | Netlify auto-deploy desde GitHub |
| Repo | `gomezrjoseantonio-bot/ultimointento` |
| Deploy URL | `ultimointentohoy.netlify.app` |
| Iconos | lucide-react exclusivamente |
| Tipografía | Inter (UI) + IBM Plex Sans (cuerpo) + JetBrains Mono (números) |
| Diseño | Tokens v5 · paleta navy + gold + grey · NO red/green/yellow para datos · solo urgencia |
| AI tooling | Claude (specs/diseño) + GitHub Copilot Workspace / Claude Code (impl) |

**SmartFlip SL (proyecto paralelo · no toca esta sesión)** · React 18 + TS + Vite + Supabase/PostgreSQL + Resend email + react-pdf + Netlify. Arranca cuando ATLAS esté en otra fase.

---

## 3 · Portfolio real de Jose · contexto que afecta a las features

**Inmuebles activos:**
- **FA32 · Fuertes Acevedo 32 1 02 DR · Oviedo** · 5 hab (3 corta-estancia + 2 larga) · 100m² · 2 baños · "por habitaciones" · mixto
- **T64 · Tenderina 64 5D / 4IZ · Oviedo** · habitaciones · larga estancia
- **Carles Buigas · Sant Fruitós (Manresa)** · larga estancia familia
- **Trastero T5** · independiente
- **Santa Catalina CB · Leitariegos** · 10% participación en comunidad de bienes
- **T48 vendido en nov 2025**

**Transformaciones pendientes:**
- T64 trastero 5·01 → 2 viviendas (permiso pendiente · CRs nuevas)
- Santa Catalina CB · división horizontal · 7 CRs → 100 CRs

**Cuentas bancarias:**
- Sabadell (personal · ···· 9635 visible en pantallazos)
- Unicaja (inmuebles · ···· 4437 visible)
- Sabadell (Unihouser SL · personal investment vehicle)
- (SmartFlip tiene cuentas separadas)

**Trabaja en Orange España.** Objetivo · libertad financiera y dejar Orange en 2027.

**Vive en Madrid como inquilino** · su alquiler es un compromiso recurrente personal de 1.350 €/mes (alias "Vivienda · Alquiler" · casero Carlos · Sabadell).

**Fiscalidad:**
- 14 años de IRPF (2012-2024 · XMLs + PDFs cargados)
- 2 inspecciones resueltas · 2022 (12/01/2024) y 2023 (15/10/2024)
- Inspección 2022 corrigió Carles Buigas · acquisition cost 116.150 → 98.831 € · base amort. 57.989,36 € · anual 1.739,68 €
- Inspección 2023 · refund 5.509,89 € por modelo 130 ausente

**Casos multi-asignación reales (relevante para T37 futura · NO ahora):**
- Santander · 2 pólizas seguro hogar · 1 cargo agregado
- Unicaja · idem
- DIGI · 2 fibras inmueble + 1 móvil personal · 1 cargo de 63 €/mes (multi-ámbito)
- Simyo · resuelto fuera de ATLAS (forzó facturas separadas)

---

## 4 · Lo que pasó en esta sesión · cronología

### Sesión heredada · 2026-05-04 mañana

Sesión anterior cerró con T34 + T35 + T34-fix + T35-fix + T34.b + T35.b mergeadas. Wizards de alta y vistas listado de gastos recurrentes funcionando · pero feos.

### Sesión actual · cronología

**1 · Diagnóstico inicial (5 pantallazos)**

Jose envió pantallazos del listado actual y de DevTools. Problemas detectados:

- Compromisos antiguos · `tipo` correcto · esquema legacy coherente
- Compromisos nuevos creados con T34-fix · `tipo` aplastado a "otros" · `categoria` inconsistente
- Listado feo · "cuajarón infumable de Nombre · Tipo · Categoría · Patrón · poco amigable · feo · sin gracia" (cita literal)

**2 · Profundización en datos**

Jose envió DevTools del registro completo "Renting Peugeot 3008":
```
ambito: "personal"
bolsaPresupuesto: "deseos"
categoria: "personal"
tipo: "otros"
subtipo: "personalizado"
alias: "Renting Peugeot 3008"
+ otros campos legacy (responsable: "titular" hardcoded)
```

Confirmé · campo `tipo` es enum legacy de 4 valores (suministro · suscripcion · impuesto · otros). Las 6 familias nuevas T34-fix se aplastan al legacy.

**3 · Pantallazos adicionales · Suministros · Internet · Simyo**

Jose envió DevTools de un compromiso inmueble nuevo. Confirmé:
- `bolsaPresupuesto` tiene valor "inmueble" para gastos de inmueble (NO null)
- `categoria` formato `"familia.subfamilia"` usado en algunos pero NO todos
- Inferencia posible desde `subtipo` y/o `categoria`

**4 · Decisión · 3 caminos · Jose elige Opción 1**

Propuse 3 caminos:
- Opción 1 · campo nuevo `tipoFamilia` · sin romper antiguos · 8-10h CC
- Opción 2 · reemplazar enum `tipo` legacy · destructivo · 6-8h
- Opción 3 · solo arreglar UX · datos siguen frágiles · 6-8h

Jose dijo "si me encaja" → Opción 1.

**5 · T38 · Mapeo familias + coherencia categoria · redactado y mergeado**

Spec entregada · Jose la lanzó a CC · CC ejecutó · merge ok.

**6 · Validación T38 en producción**

Pantallazos confirman:
- DB en versión 68 ✓
- Listado Personal · 14 compromisos
- Columna Tipo ahora muestra "Vivienda" · "Día a día" · "Suministros" · "Suscripciones" · "Otros" en lugar de solo "otros"
- Categoría coherente · `vivienda.suministros` · `dia_a_dia.salud` · `dia_a_dia.supermercado` · `otros.personalizado` · `suscripciones.otros` · `obligaciones.multas` · `otros.seguro_otros`

**Micro-bugs detectados (NO bloqueantes):**
- "Día a día · Otros" salió con categoria `otros.otros` (debería ser `dia_a_dia.otros`)
- "Seguros y cuotas · Seguro · otros · Segurcaixa" salió como `otros.seguro_otros` (debería ser `seguros_cuotas.seguro_otros`)

Estos 2 micro-bugs se apuntan como T34/T35-fix-2 menores · NO bloquean T39.

**7 · Decisión · arrancar T39 (listado redesign)**

Jose pidió mockup ANTES de spec. Diseñé mockup HTML completo con 2 demos seleccionables (Personal + Inmueble FA32) · paleta atlas v5 · agrupación por familia · iconos Lucide · KPIs · pills filtro · texto humanizado.

**8 · Validación mockup · respuesta literal Jose**

Hice 5 preguntas A/B/C/D/E. Jose respondió:

> **A OK B1 C2 D SI E OK COMO ESTA**

Decisiones cerradas:
- **A** · OK con dirección general (agrupación · iconos · pills · KPI · lenguaje humanizado)
- **B1** · Edición → drawer lateral (NO página completa)
- **C2** · Click en fila → despliega detalle inline (próximos cargos · histórico · docs)
- **D** · Ordenación columnas Importe + Próximo cargo · sí
- **E** · Mockup OK como está · sin cambios

**9 · T39 redactada · ENTREGADA a Jose**

Spec completa creada · `TAREA-39-listado-redesign-personal-inmueble.md`. Jose tiene los 2 archivos (spec + mockup). Pendiente · que Jose la lance a CC.

---

## 5 · Estado en producción · datos reales verificados

**Compromisos personales · 14 (estimación 3.025 €/mes):**

| Nombre | Tipo familia | Categoría real | Patrón | Importe |
|---|---|---|---|---|
| Suministros · Luz · Visalia | Suministros | vivienda.suministros | mensualDiaFijo | -40 € |
| Suministro · Gas · Naturgy | Suministros | vivienda.suministros | cadaNMeses | -23 € |
| Vivienda · Alquiler | Vivienda | vivienda.alquiler | mensualDiaFijo | -1.350 € |
| Día a día · Salud · farmacia · médicos | Día a día | dia_a_dia.salud | mensualDiaFijo | -350 € |
| Día a día · Supermercado · alimentación | Día a día | dia_a_dia.supermercado | mensualDiaFijo | -350 € |
| Renting Peugeot 3008 | Otros | otros.personalizado | mensualDiaFijo | -351 € |
| Día a día · Otros | Otros (★ debería Día a día) | otros.otros (★ debería dia_a_dia.otros) | mensualDiaFijo | -166 € |
| Suscripciones · Otros · Claude | Suscripciones | suscripciones.otros | mensualDiaFijo | -90 € |
| Suscripciones · Otros · Netlify | Suscripciones | suscripciones.otros | mensualDiaFijo | -30 € |
| Suscripciones · Otros · Github | Suscripciones | suscripciones.otros | mensualDiaFijo | -29 € |
| Otros · Impuestos · tasas · Circulación Mazda | Otros | obligaciones.multas | anualMesesConcretos | -144 € |
| Otros · Impuestos · tasas · Circulación Kia | Otros | obligaciones.multas | anualMesesConcretos | -68 € |
| Otros · Impuestos · tasas · AJ.BADALONA | Otros | obligaciones.multas | anualMesesConcretos | -32 € |
| Seguros y cuotas · Seguro · otros · Segurcaixa | Otros (★ debería Seguros y cuotas) | otros.seguro_otros (★ debería seguros_cuotas.seguro_otros) | mensualDiaFijo | -3 € |

★ = micro-bugs detectados · NO bloqueantes · apuntar como T34/T35-fix-2 menor cuando toque

**Compromisos inmueble FA32 · 7 (estimación 882 €/mes):**

| Nombre | Tipo familia | Patrón | Importe |
|---|---|---|---|
| Tributos · IBI · Ayto.Oviedo | Tributos | anualMesesConcretos | -36 € |
| Suministros · Gas · Iberdrola Curenergia | Suministros | mensualDiaFijo | -108 € |
| Comunidad · Cuota ordinaria · Comunidad Propietarios | Comunidad | mensualDiaFijo | -97 € |
| Suministros · Internet · Digi | Suministros | mensualDiaFijo | -25 € |
| Seguros · Hogar · Planeta Seguros | Seguros | mensualDiaFijo | -21 € |
| Suministros · Luz · Visalia | Suministros | mensualDiaFijo | -30 € |
| Gestión · Honorarios agencia · Alisser | Gestión | mensualDiaFijo | -565 € |

---

## 6 · Tareas mergeadas en producción · desde la sesión anterior

| ID | Estado | Qué hace |
|---|---|---|
| T34 | ✅ Merge | Wizard alta gasto recurrente Personal · 4 secciones · 12 campos |
| T35 | ✅ Merge | Wizard alta gasto recurrente Inmueble · simétrico T34 · sin bolsa 50/30/20 |
| T34-fix + T35-fix | ✅ Merge (1 PR) | Selector custom Tipo+Subtipo · 6 familias Personal · 7 inmueble · "Otros·Personalizado" funcional · `<TipoGastoSelector />` reusable |
| T34.b | ✅ Merge | Vista listado/edición/borrado compromisos personales |
| T35.b | ✅ Merge | Vista listado/edición/borrado compromisos inmueble |
| **T38** | ✅ **Merge esta sesión** | Campo `tipoFamilia` + coherencia `categoria` + migración v68 sin pérdida |

---

## 7 · LO QUE TOCA AHORA · T39 lista para lanzar

**Spec entregada** · `/mnt/user-data/outputs/TAREA-39-listado-redesign-personal-inmueble.md`
**Mockup entregado** · `/mnt/user-data/outputs/atlas-listado-gastos-recurrentes-v1.html`

**Resumen ejecutivo T39:**

Sustituye el listado feo de Personal e Inmueble por componente `<ListadoGastosRecurrentes />` reutilizable:

- Agrupación por familia (6 cards Personal · 7 cards Inmueble)
- Iconos Lucide por familia y subtipo
- KPI strip (3 tarjetas · coste mensual · anual · próximo cargo)
- Filter pills (Todos + N familias con contadores)
- Lenguaje humanizado · "Mensual · día 18" · NO "mensualDiaFijo"
- Click en fila · despliega detalle inline (próximos cargos + histórico + docs)
- Lápiz · abre drawer lateral derecho 480px con formulario de edición embebido
- Ordenación NOMBRE + IMPORTE (alterna asc/desc)
- Search debounce 200ms

**Scope estricto:**
- ✓ Crear componente reutilizable + 7 sub-componentes + 5 utils
- ✓ Sustituir listados de Personal y Inmueble
- ✓ Implementar Drawer + RowExpandedDetail
- ❌ NO toca schema · NO toca DB_VERSION · NO toca servicios
- ❌ NO toca wizards de alta · solo reusa secciones dentro del drawer
- ❌ NO toca T36 · T37 · catálogos típicos

**Estimación** · 10-12h CC · stop-and-wait · 1 PR único

**Cómo Jose lanza T39:**

```
@CC ejecuta el spec de TAREA-39-listado-redesign-personal-inmueble.md
Mockup de referencia: atlas-listado-gastos-recurrentes-v1.html
Auditoría obligatoria antes de codear (sección 3 del spec)
1 PR único · ambos listados · stop-and-wait · 10-12h
```

**Cuando CC entregue · checklist post-merge T39:**

Validación post-deploy en producción · 14 puntos:

1. KPI strip muestra coste mensual · anual · próximo cargo correctos
2. Pills · 6 familias Personal + Todos · contadores correctos
3. Pills · 7 familias Inmueble + Todos
4. Solo se muestran familias con compromisos
5. Click pill filtra
6. Grupos colapsables · estado en localStorage
7. Filas · icono Lucide del subtipo · nombre+sub · patrón humanizado · cuenta con dot · importe mono rojo · pill estado · 2 acciones
8. Click en fila despliega detalle inline (próximos cargos · histórico · docs si aplica)
9. Solo una fila expandida a la vez · click misma fila colapsa
10. Click lápiz · drawer lateral derecho 480px · datos precargados · 4 secciones · footer con "Cambios aplicados a futuros cargos"
11. Esc cierra drawer · click fuera cierra drawer · ambos con confirmación si hay cambios
12. Submit drawer · idempotente · doble click NO duplica
13. Click cabecera NOMBRE / IMPORTE alterna asc/desc
14. Search debounce 200ms · alias · proveedor · subtipo · nombrePersonalizado

Si los 14 pasan · merge.

---

## 8 · Backlog post-T39 · cuando T39 esté en producción

Sin orden definido · Jose decide cuál arranca primero:

### T36 · Vista gastos personales sobre movements
- 50/30/20 sobre cargos REALES conciliados (no estimaciones)
- Requiere schema task previa · campo `categoriaPresupuesto` en `movements`
- Cierra el ciclo "patrón → previsto → real → análisis"
- Mi voto · siguiente más cercano al norte (1/1/2027 cierre fiscal automático)

### T37 · Compromisos multi-asignación
- 3 casos reales · Santander seguros · Unicaja seguros · DIGI multi-ámbito
- Modelo nuevo · campo `asignaciones[]` con destino tipado (INMUEBLE/PERSONAL) + importe + ref externa
- Schema task · DB_VERSION up
- Wizard nuevo o modo dentro de existentes
- Lógica matching N a 1 + reparto a stores destino al confirmar
- Estimación · 10-14h CC

### T34.c / T35.c · Catálogos típicos hogar/inmueble
- Hoy el botón "Cargar catálogo típico" es placeholder con toast "Próximamente"
- Pre-cargar 12-15 patrones típicos editables/eliminables
- 1 click crea N compromisos rápido
- Estimación · 4-6h CC

### T34/T35-fix-2 · Micro-bugs categoria
- "Día a día · Otros" → categoria `dia_a_dia.otros` (hoy `otros.otros`)
- "Seguros y cuotas · Seguro · otros · X" → `seguros_cuotas.seguro_otros` (hoy `otros.seguro_otros`)
- NO bloqueantes · cuando convenga · 2-3h CC

### Otros backlog · más adelante
- Mi Plan redesign · ancla "compass libertad financiera" · pestañas Objetivos · LF · Fondos ahorro · Mi presupuesto · Retos
- Inspección correction cascade flow (paralelas como consumed truth)
- Inmueble transformation entity (T64 storage → 2 viviendas · Santa Catalina 7→100 CRs)
- Calendario fiscal con alertas proactivas
- SmartFlip SL management app
- Phase 2 · style guide consolidado + migración full reset

---

## 9 · Documentos canónicos · ubicación

**En `/mnt/project/`:**
- `GUIA-DISENO-V5-atlas.md` · guía diseño v5 · LEER antes de cualquier UI
- `STORES-V60-ACTIVOS.md`
- `AUDIT-39-stores-V60.md`
- `ATLAS-ARQUITECTURA-OBJETIVO-V2.md`
- `ATLAS-mapa-stores-VIGENTE.md`
- `LISTA-59-stores-destino.md`
- `LAS-40-stores-detalle.md`
- `BACKLOG-TAREAS-8-16.md`
- `HANDOFF-V6-atlas.md` · handoff anterior
- `HANDOFF-V7-atlas.md` · ESTE documento
- `SUBTAREA-8-docs-finales-V60.md`
- `TAREA-13-modulo-planes-pensiones-v2.md`
- `TAREA-CC-7-bis-auditoria-39-stores.md`
- `TAREA-CC-7-cleanup-V60.md`
- `TAREA-20-migracion-mockups-ui-real.md`
- `PR-A-PR-tarea-7.md`
- `ATLAS-Personal-modelo-datos-v1.md`

**Mockups HTML en project:**
- `atlas-ajustes-v2.html`
- `atlas-archivo.html`
- `atlas-contratos-v4.html`
- `atlas-correccion.html`
- `atlas-financiacion-v2.html`
- `atlas-fiscal.html`
- `atlas-historia-jose-v2.html`
- `atlas-inmueble-fa32-v2.html`
- `atlas-inmuebles-v3.html`
- `atlas-inversiones-v2.html`
- `atlas-mi-plan-v2.html` · pendiente cierre Phase 1
- `atlas-onboarding.html`
- `atlas-panel.html`
- `atlas-personal-v3.html`
- `atlas-tesoreria-v8.html`
- `atlas-wizard-nuevo-contrato.html`

**En `/mnt/user-data/outputs/` (esta sesión):**
- `TAREA-38-tipoFamilia-coherencia-categoria.md` · MERGEADA
- `TAREA-39-listado-redesign-personal-inmueble.md` · LISTA PARA LANZAR
- `atlas-listado-gastos-recurrentes-v1.html` · mockup T39

**Outputs sesiones anteriores (referencia · pueden estar en project o transcript):**
- `MODELO-4-PAGINAS-atlas.md`
- `AUDIT-gastos-pre-T34-2026-05-03.md`
- `TAREA-31-tesoreria-rolling-24m.md`
- `TAREA-34-wizard-gasto-recurrente-personal.md`
- `TAREA-35-wizard-gasto-recurrente-inmueble.md`
- `TAREA-34-35-fix-selector-tipo-subtipo.md`
- Mockups · `atlas-personal-wizard-gasto-recurrente-v1.html` · `atlas-inmueble-wizard-gasto-recurrente-v1.html` · `atlas-selector-tipo-gasto-v1.html` · `atlas-selector-tipo-subtipo-v2.html`

---

## 10 · Modelo de datos · estado real post-T38

**`compromisosRecurrentes` · campos confirmados (ejemplo · "Renting Peugeot 3008"):**

```typescript
{
  id: 14,
  alias: "Renting Peugeot 3008",
  ambito: "personal",                       // o "inmueble"
  bolsaPresupuesto: "deseos",               // necesidades · deseos · ahorroInversion · obligaciones · inmueble
  categoria: "otros.personalizado",         // formato "familia.subfamilia" · normalizado en T38
  tipoFamilia: "otros",                     // ★ NUEVO en T38 · 6 valores Personal · 7 valores Inmueble
  tipo: "otros",                            // legacy · enum 4-5 valores · mantenido por compatibilidad
  subtipo: "personalizado",                 // ID del subtipo del catálogo
  conceptoBancario: "AYVENS",
  cuentaCargo: 1,                           // FK a accounts
  derivadoDe: { fuente: "manual" },
  estado: "activo",
  fechaInicio: "2026-05-04",
  importe: { modo: "fijo", importe: 351.13 },
  metodoPago: "domiciliacion",
  patron: { tipo: "mensualDiaFijo", dia: 8 },
  personalDataId: 1,                        // FK si ambito=personal
  inmuebleId: 4,                            // FK si ambito=inmueble
  proveedor: { nombre: "Ayvens", nif: undefined, referencia: undefined },
  responsable: "titular",                   // legacy hardcoded · deuda menor
  variacion: { tipo: "sinVariacion" },
  createdAt: "2026-05-03T22:34:41.412Z",
  updatedAt: "2026-05-04T07:49:40.375Z",
}
```

**Catálogos del wizard:**

Personal · 6 familias · 39 subtipos:
- Vivienda (4) · Alquiler · IBI · Comunidad · Seguro hogar
- Suministros (6) · Luz · Gas · Agua · Internet · Móvil · Otros
- Día a día (8) · Supermercado · Transporte · Restaurantes · Ocio · Salud · Ropa · Cuidado personal · Otros
- Suscripciones (6) · Streaming · Música · Software · Cloud · Prensa · Otros
- Seguros y cuotas (9) · Seguro salud · coche · vida · otros · Gimnasio · Educación · Profesional · ONG · Otros
- Otros (4) · Impuestos · Multas · Mantenimiento coche · Personalizado*

Inmueble · 7 familias · 23 subtipos:
- Tributos (3) · IBI · Tasa basuras · Otros
- Comunidad (3) · Cuota ordinaria · Derrama · Otros
- Suministros (5) · Luz · Gas · Agua · Internet · Otros
- Seguros (3) · Hogar · Impago · Otros
- Gestión (4) · Honorarios agencia · Gestoría · Asesoría · Otros
- Reparación y conservación (4) · Mantenimiento caldera · Integral · Limpieza · Otros
- Otros (1) · Personalizado*

*Personalizado activa input "Nombre del gasto" obligatorio

**Reglas absolutas modelo:**

- Rentas/ingresos NUNCA en `gastosInmueble` · van a `contracts` (XML histórico) y `rentaMensual` (mensual proyección)
- Income desde XML con NIF o `sin_identificar` es PAGADO y CONFIRMADO · NO previsto · NO pendiente
- Vistas históricas leen desde XML source stores · NO `treasuryEvents` (eliminado `historicalTreasuryService`)
- `treasuryEvents` solo para · current/future year forecasts + estimated past personal expenses
- Para años con `ejerciciosFiscales[año].estado=declarado` · `rentaMensual` records se tratan como confirmados automáticamente

**Stores principales (40 totales):**
- `compromisosRecurrentes` · patrones · v68 con `tipoFamilia`
- `treasuryEvents` · eventos previstos
- `movements` · movimientos bancarios reales
- `gastosInmueble` · gasto real conciliado por inmueble
- `properties` · inmuebles
- `contracts` · contratos alquiler (XML + manual)
- `rentaMensual` · proyecciones mensuales activas
- `ejerciciosFiscales` (keyPath=año) · estados en_curso · pendiente · declarado · prescrito
- `accounts` · cuentas bancarias
- `mejorasInmueble` · CAPEX
- `mueblesInmueble` · 10% amort
- `aportacionesPlan` · plan de pensiones
- `arrastresIRPF` · cascada años
- ... 27 más

---

## 11 · Diseño · GUIA-DISENO-V5-atlas.md · resumen operativo

**Paleta:**
- Bg · #F5F4F1 (beige cálido)
- Card · #FFFFFF
- Card-alt · #FBFAF6
- Brand-ink · #0C1230 (navy oscuro · sidebar)
- Brand · #1E2954
- Gold · #B88A3E (acento principal · CTAs · hover)
- Gold-wash · #F3EAD6 (fondos sutiles)
- Pos · #1E6B3A (verde solo para "Activo")
- Neg · #A43328 (rojo terracota · solo importes negativos)
- Warn · #8A6213 (amber · solo urgencia)

**Tipografía:**
- UI · Inter (todo)
- Cuerpo prosa · IBM Plex Sans (en mockups recientes Inter cubre todo)
- Números · JetBrains Mono bold con tabular-nums

**Cards:**
- Blanca + `border: 1px solid var(--line)` + `border-radius: 10-12px`
- Border-top accent · 3px sólido en gold/brand/neg según función
- Box-shadow sutil · `0 1px 3px rgba(0,0,0,.03)`
- NUNCA backgrounds hex hardcoded · siempre tokens

**Reglas absolutas:**
- NUNCA hardcodear hex · siempre `var(--token)`
- Todo monetario en `JetBrains Mono` con `font-variant-numeric: tabular-nums`
- Cadastrales/referencias · monospace
- Iconos · ÚNICAMENTE lucide-react
- Positivo · navy-900 (`var(--ink)`) · Negativo · rojo terracota (`var(--neg)`)
- Pestañas (tabs) · NO lleva iconos · solo texto + contador opcional
- Header de página · icono naked 20px + H1 + subtítulo + tabs underline
- NO navy en áreas de Supervisión · navy solo en headers de Gestión

**Estados de urgencia (Contratos · Disponibilidad):**
- Available now · ROJO (`var(--neg)`) · negativo
- Expira <30d · ÁMBAR (`var(--warn)`) · advertencia
- Expira 30-90d · GRIS (`var(--ink-4)`) · neutral

**Regla de redundancia visual:**
- Si hay color significativo · NO repetir la palabra
- Si hay palabra · NO color innecesario

---

## 12 · Cómo arrancar la conversación con Jose

**Si Jose abre con "vamos" o similar:**
- Resumen breve · "T38 mergeada · datos coherentes · T39 redactada y lista para lanzar"
- Pregunta única · "¿Lanzas T39 a CC ahora · o quieres revisar algo antes?"

**Si Jose pregunta por estado:**
- Confirmar T38 ✓ mergeada · datos coherentes verificados (12 de 14 OK · 2 micro-bugs apuntados como T34/35-fix-2 menor)
- T39 · spec + mockup ya entregados · pendiente lanzar a CC

**Si Jose dice "lánzala" / "ok" / "adelante":**
- NO redactes nada nuevo · ya está la spec
- Recuérdale el comando para CC:
  ```
  @CC ejecuta el spec de TAREA-39-listado-redesign-personal-inmueble.md
  Mockup de referencia: atlas-listado-gastos-recurrentes-v1.html
  Auditoría obligatoria antes de codear (sección 3 del spec)
  1 PR único · ambos listados · stop-and-wait · 10-12h
  ```
- Recuérdale el checklist de validación post-merge (14 puntos · sección 7 de este handoff)

**Si Jose pide cambios al mockup o al spec antes de lanzar:**
- Recoge cambios · ajusta spec/mockup · re-entrega
- NO mergees ni lances tú

**Si Jose envía pantallazos sin contexto:**
- Diagnostica primero · NO asumas
- Cita literalmente lo que ves
- Distingue "lo que veo" vs "lo que infiero"

**Si Jose habla de un caso nuevo (multi-asignación · etc):**
- NO tocar T39 con eso
- Apuntarlo en backlog (T37 ya cubre multi-asignación · censo cerrado · 3 casos)
- Mantener foco

**Si Jose pregunta por tareas que YA están mergeadas:**
- Confirmar merge · referenciar este handoff
- NO re-redactar specs

---

## 13 · Errores que el Claude anterior cometió · NO repetir

1. **Redactar specs sin auditar arquitectura real**
   - Mi error en MODELO-GASTOS-atlas.md (sesión anterior · 3 errores por imaginar el modelo)
   - Solución · sección 3 obligatoria de auditoría en cada spec CC

2. **Asumir nombre de DB sin verificar**
   - Esta sesión te di a Jose `indexedDB.open('atlas', 68)` · el nombre real es `AtlasHorizonDB`
   - El error fue benigno (Jose vio el panel Aplicación) pero podría haber sido confuso
   - Solución · siempre confirmar antes nombres reales antes de pasar scripts

3. **Proponer MVPs / iteraciones rápidas**
   - Jose es exhaustivo · NO acepta esto
   - Solución · spec exhaustivo · close correctly desde el inicio

4. **Asaltar con varias preguntas**
   - Jose se pierde
   - Solución · una pregunta única al final · estructura A/B/C/D/E si necesitas varias

5. **No respetar stop-and-wait**
   - CC tiende a mergear sin permiso si no se le dice explícito
   - Solución · TODA spec termina con "STOP-AND-WAIT · NO mergear · esperar Jose"

---

## 14 · Norte estratégico · 1/1/2027

Recordatorio del objetivo final que orienta TODAS las decisiones:

**El 1/1/2027 Jose presiona un botón y tiene una declaración IRPF prerrellenada lista**, porque cada renta cobrada · cada gasto deducible · cada amortización · cada inspección corregida · cada fee · está modelado correctamente en ATLAS durante 2026.

Las features se priorizan por proximidad a esa fecha y al cierre fiscal correcto:

- T39 · listado bonito · UX cierre del módulo gastos
- T36 · vista gastos sobre movements · 50/30/20 real · análisis fiscal
- T37 · multi-asignación · captura de gastos correctamente categorizados fiscalmente
- Mi Plan redesign · ancla psicológica de la libertad financiera

Todo esto lleva al cierre fiscal automático 2027.

---

**Fin handoff V7. Listo para nueva conversación.**
**Siguiente acción · Jose lanza T39 a CC.**
