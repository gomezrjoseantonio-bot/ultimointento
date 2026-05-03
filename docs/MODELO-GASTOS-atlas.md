# ATLAS · Modelo de Gastos · documento canónico

> **Tipo** · ancla conceptual única para todo lo relacionado con gastos · compromisos recurrentes · presupuesto 50/30/20 · etiquetado de movimientos · gastos de inmueble
>
> **Fecha de cierre** · 2026-05-03
>
> **Sustituye** · cualquier discusión previa sobre dónde viven los gastos · cómo se etiquetan · cómo se generan previsiones · cómo se calcula presupuesto
>
> **Complementa** · `docs/MODELO-4-PAGINAS-atlas.md` (modelo de 4 páginas) y `docs/AUDIT-flujos-ingresos-gastos-financiacion-2026-05-02.md` (mapa de flujos)
>
> **Referencias** · `docs/STORES-V60-ACTIVOS.md` (stores) y `docs/ATLAS-Personal-modelo-datos-v1.md` (modelo Personal v1.1)

---

## 0 · Por qué existe este documento

Mockup-up de pestaña "Gastos" de inmueble vacío en producción · pero con 109 registros en `gastosInmueble` reales. Sin vista para crear compromisos recurrentes. Sin modelo cerrado de cómo se etiquetan gastos personales para 50/30/20.

Este documento cierra todas las decisiones conceptuales sobre gastos · sin ambigüedad · para que cualquier sesión futura tenga ancla clara.

---

## 1 · Principio fundacional

> **Un gasto entrado una vez alimenta TODOS los módulos · jamás silado.**

Un cargo de luz de FA32 entra una vez · se ve en Tesorería (movement confirmado) · en ficha FA32 > Gastos (gastoInmueble linkado) · en Mi Plan > Proyección (suma anual de gastos) · en Fiscal (casillaAEAT al cierre del año).

Tres stores · tres roles distintos · sin solapamiento.

---

## 2 · Arquitectura de tres capas

```
                   compromisosRecurrentes
                  (patrón configurado · ámbito + categoría + cuenta)
                              │
                              │ genera N eventos
                              ▼
                       treasuryEvents
                       (predicted · futuros · status='predicted')
                              │
                              │ llega cargo bancario
                              │ se concilia
                              ▼
                         movements
                       (executed · realidad · ámbito + categoría)
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ámbito='personal'           ámbito='inmueble'
                │                           │
                ▼                           ▼
        movements con              ¿qué tipo es?
        categoriaPresupuesto:               │
        'necesidad'                ┌────────┼────────┬──────────┐
        'deseo'                    │        │        │          │
        'ahorro_inversion'         ▼        ▼        ▼          ▼
                              mejora    muebles  operativo   suministro
                              (CAPEX)  (10%amort)  + intereses + gastos
                                  │        │           │           │
                                  ▼        ▼           ▼           ▼
                          mejorasInm. mueblesInm.  gastosInmueble
                                                  con categoria AEAT
```

### Capa 1 · `compromisosRecurrentes` · patrones generadores

Schema (ya existe · vacío en producción):

```
ambito: 'personal' | 'inmueble'
inmuebleId: string | null  (solo si ambito='inmueble')
tipo: string               (luz, comunidad, IBI, gym, streaming...)
categoria: string          (mapea a categoría operativa)
importe: number
cuentaCargo: string        (cuenta donde se cobra)
fechaInicio: ISO date
periodicidad: 'mensual' | 'bimestral' | 'trimestral' | 'anual'
estado: 'activo' | 'pausado'
```

**Función** · cuando el usuario configura "luz FA32 · 80€/mes · cuenta Sabadell" → 1 click crea registro · y `regenerateForecastsForward` genera los 24 eventos previstos.

**Quién lo lee** · `treasuryBootstrapService` (T31) · `compromisosRecurrentesService` para CRUD.

### Capa 2 · `treasuryEvents` · realidad prevista o confirmada

Schema (ya existe · poblado tras T31):

```
type: 'income' | 'expense' | 'financing'
amount: number
predictedDate: ISO date
ambito: 'personal' | 'inmueble'
inmuebleId: string | null
status: 'predicted' | 'confirmed' | 'executed' | 'cancelled'
sourceType: 'compromiso' | 'nomina' | 'prestamo' | 'vivienda' | 'manual'
sourceId: string
accountId: string
```

**Función** · representa "qué va a pasar" o "qué pasó". Es la fuente única para la vista calendario de Tesorería.

### Capa 3 · `movements` · cargos bancarios reales

Schema (ya existe · cubre solo saldos iniciales hoy):

```
accountId: string
date: ISO date
amount: number
description: string
ambito: 'personal' | 'inmueble'                          ← AÑADIR si no existe
inmuebleId: string | null                                ← AÑADIR si no existe
categoriaPresupuesto: 'necesidad' | 'deseo' | 'ahorro_inversion' | null  ← AÑADIR
categoria: string  (suministro, IBI, comunidad, etc · solo si ambito='inmueble')
treasuryEventId: string | null  (si vino de conciliar evento previsto)
```

**Función** · cargo bancario real · capa de "lo que pasó". Cuando se concilia con `treasuryEvents` · el evento pasa a `executed` y el movement queda como verdad final.

---

## 3 · Etiquetado · gastos personales · 3 categorías 50/30/20

Solo se aplica a `movements` con `ambito='personal'`. Campo `categoriaPresupuesto`:

| Etiqueta | % objetivo | Ejemplos |
|---|---|---|
| **necesidad** | 50% | Hipoteca/alquiler vivienda · suministros casa · supermercado · transporte trabajo · seguro salud · cuotas obligatorias |
| **deseo** | 30% | Ocio · restaurantes · viajes · streaming · ropa no básica · gimnasio · Amazon |
| **ahorro_inversion** | 20% | Aportaciones plan pensiones individuales · transferencias a fondos · compra de acciones · amortización extra hipoteca · transferencias a `cajaLiquida` |

**Cómo se etiqueta:**

- **Auto** · `movementLearningRules` (store ya existe) memoriza categorizaciones previas · sugiere
- **Manual** · usuario sobreescribe en cualquier momento

---

## 4 · Etiquetado · gastos de inmueble · 4 categorías operativas

Cada gasto operativo se descompone en su destino correcto:

### 4.1 · Mejora (CAPEX · amortizable)

- **Va a** · `mejorasInmueble` (NO a `gastosInmueble`)
- **Tratamiento fiscal** · NO deducible directo · se amortiza al 3% anual sobre el coste de construcción
- **Ejemplos** · reforma cocina · cambio de instalación eléctrica completa · ampliación · obra estructural

### 4.2 · Muebles (amortizable)

- **Va a** · `mueblesInmueble` (NO a `gastosInmueble`)
- **Tratamiento fiscal** · casilla AEAT 0117 · amortización 10% anual
- **Ejemplos** · sofá · electrodomésticos · cama · mesa · armarios independientes

### 4.3 · Reparación y conservación (deducible directo)

- **Va a** · `gastosInmueble` con `categoria='reparacion'`
- **Tratamiento fiscal** · casilla AEAT 0107 · deducible directo en el ejercicio
- **Ejemplos** · pintura · arreglo de fontanería · sustituir grifo · reparar caldera

### 4.4 · Operativos + suministros + intereses (deducibles directos)

- **Va a** · `gastosInmueble` con `categoria` específica
- Tipos:

| Categoría operativa | Casilla AEAT | Origen típico |
|---|---|---|
| `ibi` | 0103 | Anual · ayuntamiento |
| `comunidad` | 0103 | Mensual · administrador |
| `gestion` | 0104 | Honorarios gestoría · agente inmobiliario |
| `seguro` | 0109 | Anual · seguro hogar/impago |
| `suministro` | 0113 | Mensual · luz · agua · gas · internet (deducible si arrendado) |
| `intereses` | 0105 | Mensual · auto-generado por sistema · NO usuario · viene de `prestamos` |
| `otro` | 0114 | Cualquier gasto operativo no categorizado |

---

## 5 · Caso especial · plan de pensiones de empleo

### Contexto

Las aportaciones a Plan de Empleo (PPE) y Plan de Pensiones de Empleo Simplificado (PPES) NO pasan por la cuenta corriente del trabajador. Se descuentan del bruto de la nómina antes del IRPF · y la empresa además aporta una cantidad adicional que tampoco pasa por la cuenta del trabajador.

Caso concreto Jose · Orange España · aporta él vía nómina + aporta Orange como empresa · neto recibido en cuenta = 6.798 €/mes.

### Modelo de disparo

```
1. Llega cargo bancario por NETO (6.798 €) en cuenta corriente
   → movement confirmed con amount = 6.798 €

2. Usuario CONFIRMA en Tesorería que ese movement es la nómina del mes
   (concilia movement con treasuryEvent previsto de tipo 'nomina')

3. Al confirmar la conciliación · ATLAS lee el detalle de la nómina en `ingresos`:
   - bruto: 9.819 €
   - IRPF retenido: 2.141 €
   - SS trabajador: 480 €
   - aportacionTrabajador (al plan empleo): 200 €
   - aportacionEmpresa (al plan empleo): 300 €
   - neto: 6.798 €

4. ATLAS dispara EN PARALELO:

   a) En cuenta corriente · NO añade nada
      (el movement de 6.798 € ya está · es todo el dinero que vio tu cuenta)

   b) En el plan de pensiones empleo:
      → aportacionesPlan ← inserta registro:
         - planId: id del plan empleo del usuario
         - importe: aportacionTrabajador + aportacionEmpresa = 500 €
         - fecha: fecha de confirmación de la nómina
         - sourceType: 'nomina'
         - sourceId: id del registro en `ingresos`
         - desglose: { trabajador: 200, empresa: 300 }

5. Resultado · plan crece 500 €/mes · cuenta corriente refleja solo neto · cero duplicación
```

### Decisión sobre 50/30/20 · NETO PURO

**Las aportaciones al plan de empleo NO entran en el cálculo 50/30/20.** El cálculo se hace 100% sobre el neto recibido en cuenta corriente.

```
ingresos_50_30_20 = suma(movements ambito='personal' tipo='income' del mes)
gastos_necesidad = suma(movements ambito='personal' categoriaPresupuesto='necesidad' del mes)
gastos_deseo = suma(movements ambito='personal' categoriaPresupuesto='deseo' del mes)
ahorro = ingresos_50_30_20 - gastos_necesidad - gastos_deseo
% necesidad = gastos_necesidad / ingresos_50_30_20
% deseo = gastos_deseo / ingresos_50_30_20
% ahorro = ahorro / ingresos_50_30_20
```

**Razonamiento de la decisión:**

1. Tesorería ve solo neto · Presupuesto debe ser coherente
2. Las aportaciones al plan empleo (~125-500 €/mes en caso Jose) son ahorro patrimonial real · pero no son disciplina visible del 50/30/20
3. El usuario que cumple 50/30/20 sobre neto es **conservador en su métrica** · su ahorro real es mayor del que muestra · nunca subestima el riesgo
4. Modelo simple · trazable · sin enmarañar con descuentos brutos · IRPF · SS

**Las aportaciones al plan de empleo se ven en módulo Inversiones · NO en Presupuesto.**

### Caja · ¿qué pasa si el usuario aporta voluntariamente desde su cuenta corriente?

Caso · usuario hace transferencia 200 € de Sabadell a su PPI individual.

```
1. movement confirmed en Sabadell · amount = -200 €
2. Usuario etiqueta · ambito='personal' · categoriaPresupuesto='ahorro_inversion'
3. Esa transferencia SÍ entra en 50/30/20 como ahorro · porque pasó por su cuenta
4. Adicionalmente · si el destino es PPI · aportacionesPlan recibe registro
   con sourceType='manual' · sourceId=id del movement
```

Esta vía SÍ pasa por Tesorería · SÍ se cuenta en 50/30/20 · NO contradice nada.

---

## 6 · Las 4 vistas UI a construir (T-futuro)

### Vista A · Personal > Compromisos recurrentes

CRUD de patrones personales (tipo gym · streaming · cuotas voluntarias).

- Lista de compromisos activos con · tipo · importe · cuenta · próximo cobro
- Botón "Nuevo compromiso" · wizard simple
- Editar · pausar · eliminar

Al crear/editar/eliminar · invocar `regenerateForecastsForward({ force: true })` para regenerar previsiones.

### Vista B · Personal > Gastos (NUEVA · no existe)

Listado de movements personales del mes en curso · etiquetados 50/30/20.

- Filtros · categoría · cuenta · rango fechas
- Cada gasto editable · puede recategorizarse manualmente
- Vista calendario opcional

### Vista C · Inmueble > Gastos (HOY VACÍA · placeholder)

Esta es la pestaña que motivó el documento. Se construye así:

- Header con KPIs del año fiscal seleccionado · total gastos · total deducible · total CAPEX
- 4 secciones agrupadas:
  1. **Mejoras** · listado de `mejorasInmueble` filtrado por `inmuebleId`
  2. **Muebles** · listado de `mueblesInmueble`
  3. **Reparación y conservación** · listado de `gastosInmueble` con `categoria='reparacion'`
  4. **Operativos + suministros + intereses** · `gastosInmueble` con resto de categorías · agrupadas por categoría con sub-totales
- Cada gasto editable · puede cambiar categoría manualmente
- Botón "Nuevo gasto" · wizard simple

### Vista D · Inmueble > Compromisos recurrentes

CRUD de patrones del inmueble (luz · IBI · comunidad · seguro).

- Filtrado por `inmuebleId` actual
- Mismo patrón que Vista A
- Botón "Nuevo compromiso" · pre-rellena `inmuebleId` actual

---

## 7 · Reglas duras · NO violar

### NO duplicación

❌ Un gasto NO se registra en 2 stores. Mejora va a `mejorasInmueble` · NO también a `gastosInmueble`. Mueble va a `mueblesInmueble` · NO también a `gastosInmueble`.

### Categorización personal solo afecta a `ambito='personal'`

❌ NO se etiqueta 50/30/20 a movements de inmuebles. Esos llevan `categoria` operativa (suministro · IBI · etc) · no `categoriaPresupuesto`.

### Aportaciones plan empleo NO crean movement adicional

❌ Cuando se confirma nómina y se dispara aportación al plan · NO se inserta movement de 500 € adicional en cuenta corriente. Solo `aportacionesPlan`.

### `gastosInmueble` jamás contiene ingresos

❌ Renta cobrada de un inquilino NO va a `gastosInmueble`. Va a `contracts.historicoRentas` o `treasuryEvents` con type='income'.

### Categoría `intereses` la genera el sistema · NO el usuario

❌ El usuario NO crea manualmente un gasto categoría 'intereses'. Lo dispara el sistema desde `prestamos` con cuotas mensuales. El usuario solo configura el préstamo · ATLAS genera los gastos de intereses.

### Datos del año declarado son INTOCABLES

❌ Si `ejerciciosFiscales[2024].estado='declarado'` · no se pueden modificar `gastosInmueble` · `mejorasInmueble` · `mueblesInmueble` de 2024 sin pasar por el flujo de "corrección por inspección" (futuro).

---

## 8 · Cómo entran los gastos al sistema · 4 vías

### Vía 1 · Importación bancaria (CSB43)

Llega extracto · cada línea genera un `movement`. Usuario o sistema categoriza:
- Si Iberdrola en cuenta vinculada a FA32 · ATLAS sugiere `inmueble FA32 · suministro`
- Si supermercado en cuenta personal · ATLAS sugiere `personal · necesidad`

### Vía 2 · Conciliación de evento previsto

Llega cargo bancario · matching con `treasuryEvent` previsto:
- `treasuryEvent` pasa a `status='executed'`
- `movement` se crea con `treasuryEventId` apuntando al evento
- Categorización del evento (compromiso recurrente) se hereda al movement

### Vía 3 · Manual desde UI

Usuario crea gasto sin extracto:
- Por ejemplo · paga 600 € en efectivo al fontanero
- Se crea `gastosInmueble` con `origen='manual'` · sin `movimientoId` (no hay movement asociado)
- Importante para casos de pagos en efectivo o sin trazabilidad bancaria

### Vía 4 · Importación XML AEAT

Importación masiva al hacer onboarding o al subir declaración:
- `aeatParserService` rellena `gastosInmueble` · `mejorasInmueble` · `mueblesInmueble` con todo el histórico declarado
- Marca `origen='aeat'` · trazable

**Hoy en producción · los 109 registros en `gastosInmueble` vienen mayoritariamente de Vía 4 (XML AEAT 2024).** Las Vías 1 · 2 · 3 están parcialmente implementadas y son objeto de tareas futuras.

---

## 9 · Mapeo · qué store guarda qué cosa

| Store | Para qué sirve | Cuándo se rellena |
|---|---|---|
| `compromisosRecurrentes` | Patrones que generan eventos previstos · personal e inmueble | UI de compromisos · Vista A y D |
| `treasuryEvents` | Eventos previstos y confirmados · base del calendario Tesorería | Generadores · conciliación |
| `movements` | Cargos bancarios reales · ámbito + categoría | CSB43 · conciliación · manual |
| `movementLearningRules` | Reglas de auto-categorización aprendidas | Cada vez que usuario etiqueta manualmente |
| `gastosInmueble` | Gastos deducibles directos · operativos · suministros · intereses · reparación | Conciliación con ámbito='inmueble' · manual · XML AEAT |
| `mejorasInmueble` | CAPEX amortizable · obras y mejoras | Manual · XML AEAT |
| `mueblesInmueble` | Mobiliario amortizable 10% · casilla 0117 | Manual · XML AEAT |
| `aportacionesPlan` | Aportaciones a planes pensiones · trabajador y empresa | Confirmación nómina · transferencia voluntaria |
| `ingresos` | Detalle de nóminas · autónomos · pensiones · otros | Wizards de Personal |
| `contracts.historicoRentas` | Renta cobrada por contrato · año a año | Conciliación de cobros · XML AEAT |

---

## 10 · Procedimiento si surge una pregunta nueva

Si en sesión futura aparece una pregunta tipo:

- "¿Dónde guardamos los gastos compartidos entre 2 inmuebles?"
- "¿Cómo se modela un gasto puntual no recurrente?"
- "¿Y si el usuario tiene 2 nóminas?"

**Procedimiento:**

1. Buscar en este doc primero · ¿está cubierto?
2. Buscar en `MODELO-4-PAGINAS-atlas.md` · ¿toca alguna página?
3. Si no está cubierto · proponer modelo · validar con Jose · actualizar este doc
4. NO empezar a escribir spec sin haber actualizado este doc primero

---

## 11 · Decisiones cerradas · NO reabrir

1. **Plan empleo no pasa por Tesorería** · solo dispara `aportacionesPlan` · neto cuenta para 50/30/20
2. **50/30/20 sobre NETO puro** · sin meter bruto · IRPF · SS
3. **Aportaciones empresa NO se cuentan en 50/30/20** · solo se ven en Inversiones
4. **`gastosInmueble` NO contiene mejoras ni muebles** · cada uno en su store
5. **`compromisosRecurrentes` cubre personal e inmueble** · discriminador `ambito`
6. **Renta NO va a `gastosInmueble`** · va a `contracts` y `treasuryEvents`
7. **Categoría `intereses` la genera sistema** · NO usuario · viene de `prestamos`

---

**Fin documento canónico · ancla conceptual cerrada · MODELO-GASTOS-atlas.**
