# Racionalización real del módulo Inmuebles (propuesta v3)

> Objetivo: **menos pantallas, menos pestañas y menos duplicidades** sin rehacer todo el producto.

## 1) Problema real (lo que está molestando hoy)

La fricción no es “visual”, es de **arquitectura funcional**:

1. Se entra por **Inmuebles/Cartera**, pero para operar hay que saltar entre:
   - Ficha del inmueble
   - Contratos/Cobros globales
   - Apartado específico de **Alquileres** (alta y gestión de contratos)
   - Presupuesto y fiscal en bloques largos

2. Hay mezcla de niveles:
   - Nivel cartera (global)
   - Nivel inmueble (detalle)
   - Nivel operación (contrato/cobro/gasto)

3. La misma tarea puede iniciarse en más de un sitio.

**Resultado:** carga cognitiva alta, dudas de “dónde se hace” y navegación innecesaria.

---

## 2) Decisión de producto (clara)

Tomar una decisión explícita de gobierno UX:

- **La ficha del inmueble será el centro operativo por inmueble.**
- **Alquileres** será el centro de **alta/gestión transversal de contratos** (visión multi-inmueble).
- Las vistas globales de contratos/cobros se mantienen para control masivo y reporting.

Esto evita conflicto entre “operar un inmueble” vs “administrar todos los contratos”.

---

## 3) Arquitectura objetivo (2 superficies + 1 transversal)

## Superficie A — Cartera (visión global + priorización)
Tabla/lista única con:
- Estado ocupación
- Renta mensual
- Yield
- Alertas (sin contrato, fiscal incompleto, cuentas sin asignar)
- CTA por fila: **Abrir ficha**

## Superficie B — Ficha de inmueble (operación del activo)
Solo 3 pestañas:

1. **Operación**
   - Contrato activo
   - Próximos cobros
   - Estado ocupación
   - CTA contextual: renovar/finalizar contrato
   - CTA secundario: “Gestionar en Alquileres”

2. **Números**
   - Coste adquisición
   - Gastos por tipología (ver taxonomía)
   - KPI anual neto por inmueble

3. **Fiscal**
   - Datos fiscales auxiliares
   - Ocupación anual fiscal
   - Estado “listo para cierre”

## Superficie transversal — Alquileres (alta y gestión multi-inmueble)
- Alta de contratos nuevos
- Gestión masiva (lista, calendario, cobros)
- Filtros por estado/modalidad/inmueble
- Acceso rápido a ficha del inmueble asociado

### Eliminaciones/Fusiones directas
- “Contratos / Ingresos” dentro de ficha se simplifica y queda en **Operación**.
- “Presupuesto OPEX/CAPEX” se renombra y se integra en **Números**.
- “Atajos” sale del cuerpo principal y pasa a cabecera contextual.

---

## 4) Taxonomía de gastos (completa y clara)

Para evitar ambigüedad, en **Números** se muestran 4 bloques diferenciados:

1. **Gastos recurrentes**
   - Comunidad, IBI, seguros, suministros, servicios periódicos.

2. **Reparación y conservación**
   - Gastos de mantenimiento que **no** incrementan valor estructural.
   - Impacto fiscal como gasto del ejercicio (según regla fiscal aplicable).

3. **Mejoras (CAPEX)**
   - Actuaciones que incrementan valor/base amortizable.
   - Seguimiento de amortización y trazabilidad.

4. **Mobiliario y equipamiento**
   - Compra de mobiliario, electrodomésticos y equipamiento.
   - Separado de mejoras para tratamiento contable/fiscal más claro.

> Regla UX: no mezclar “reparación y conservación” con “mejoras”, y no ocultar mobiliario dentro de “otros”.

---

## 5) Flujo ideal (máximo 3 clics en tareas frecuentes)

## Tarea 1: alta de contrato nuevo
Inmuebles/Cartera o ficha → **Alquileres** → Nuevo contrato → vincular inmueble.

## Tarea 2: renovar contrato de un inmueble
Cartera → abrir ficha → Operación → Renovar (o abrir en Alquileres si requiere edición avanzada).

## Tarea 3: registrar gasto (reparación/mejora/mobiliario)
Cartera → abrir ficha → Números → seleccionar tipología → guardar.

## Tarea 4: preparar cierre fiscal de un inmueble
Cartera → abrir ficha → Fiscal → completar pendientes.

Regla: si una tarea frecuente necesita más de 3 pasos, está mal diseñada.

---

## 6) Plan de implementación (sin big-bang)

## Sprint 1 (simplificación visible)
1. Reordenar ficha a: Operación / Números / Fiscal.
2. Mover atajos a cabecera contextual.
3. Añadir bloque “Pendientes de este inmueble”.

## Sprint 2 (alineación con Alquileres)
1. Añadir CTA en Operación: “Gestionar en Alquileres”.
2. En Alquileres, reforzar alta de contrato y link de vuelta a ficha.
3. Unificar naming entre ficha y Alquileres (estado, modalidad, cobros).

## Sprint 3 (modelo económico completo)
1. Implementar las 4 tipologías de gasto en Números.
2. Etiquetas fiscales por tipología (recurrente, reparación, mejora, mobiliario).
3. Filtro en Cartera: “Requiere acción”.

---

## 7) Criterio de aceptación

La racionalización será válida solo si se cumple:

1. Ficha con máximo 3 pestañas.
2. Alta de contrato claramente anclada en **Alquileres**.
3. Operación por inmueble claramente anclada en **Ficha**.
4. Gasto siempre clasificado en una de 4 tipologías (sin “cajón desastre”).
5. Usuario identifica pendientes del inmueble en <10 segundos.

---

## 8) Métricas que sí importan

- Tiempo medio de alta de contrato (en Alquileres).
- Tiempo medio de renovación desde ficha.
- % gastos correctamente clasificados en 4 tipologías.
- % inmuebles “listo para cierre fiscal”.
- Nº de saltos entre pantallas por tarea.

---

## 9) Validación rápida (sin big design)

Test con 5 usuarios internos, 4 tareas:
1. Dar de alta un contrato nuevo desde Alquileres.
2. Renovar contrato desde ficha.
3. Registrar una reparación y una compra de mobiliario.
4. Dejar inmueble listo para fiscal.

Éxito si:
- ≥80% completan sin ayuda.
- Tiempo total <8 minutos.
- Confusión de navegación <2 incidencias por usuario.

Si falla, iterar arquitectura de navegación antes que estilos visuales.
