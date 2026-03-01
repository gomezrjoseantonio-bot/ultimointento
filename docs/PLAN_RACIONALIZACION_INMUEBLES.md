# Racionalización real del módulo Inmuebles (propuesta v2)

> Objetivo: **menos pantallas, menos pestañas y menos duplicidades** sin rehacer todo el producto.

## 1) Problema real (lo que está molestando hoy)

La fricción no es “visual”, es de **arquitectura funcional**:

1. Se entra por **Inmuebles/Cartera**, pero para operar hay que saltar entre:
   - Ficha del inmueble
   - Contratos global
   - Cobros global
   - Presupuesto OPEX/CAPEX
   - Bloques fiscales dentro de fichas largas

2. Hay mezcla de niveles:
   - Nivel cartera (global)
   - Nivel inmueble (detalle)
   - Nivel operación (contrato/cobro/regla/mejora)

3. La misma tarea se puede hacer en más de un sitio.

**Resultado:** demasiada carga cognitiva, dudas de “dónde se hace”, y navegación innecesaria.

---

## 2) Decisión de producto (clara)

Tomar una decisión de gobierno UX:

- **La ficha del inmueble será el centro operativo.**
- Las pantallas globales (Contratos/Cobros) pasan a ser de **control masivo**, no de operación diaria.

Si no se toma esta decisión, cualquier rediseño seguirá siendo cosmético.

---

## 3) Qué dejamos en 2 niveles (y nada más)

## Nivel A — Cartera (visión global + priorización)
Una sola tabla/lista con:
- Estado ocupación
- Renta mensual
- Yield
- Alertas (sin contrato, fiscal incompleto, opex sin cuenta)
- CTA por fila: **Abrir ficha**

## Nivel B — Ficha de inmueble (operación)
Solo 3 pestañas:

1. **Operación**
   - Contrato activo
   - Próximos cobros
   - Estado ocupación
   - CTA: Nuevo contrato / Renovar / Finalizar

2. **Números**
   - Coste adquisición
   - Gastos recurrentes (antes OPEX)
   - Mejoras (antes CAPEX)
   - KPI anual neto

3. **Fiscal**
   - Datos fiscales auxiliares
   - Ocupación anual fiscal
   - Mejoras amortizables y trazabilidad
   - Estado “listo para cierre”

### Eliminaciones/Fusiones directas
- Eliminar pestaña separada “Contratos / Ingresos” → pasa a **Operación**.
- Eliminar pestaña separada “Presupuesto OPEX/CAPEX” → pasa a **Números**.
- “Atajos” fuera del cuerpo principal → menú contextual en cabecera.
- “Contratos global” mantiene valor, pero como vista de administración masiva.

---

## 4) Flujo ideal (3 clics máximo en tareas clave)

## Tarea 1: renovar contrato
Cartera → abrir ficha inmueble → Operación → Renovar.

## Tarea 2: registrar gasto/mejora
Cartera → abrir ficha inmueble → Números → Añadir gasto/mejora.

## Tarea 3: preparar cierre fiscal
Cartera → abrir ficha inmueble → Fiscal → Completar campos pendientes.

Regla: si una tarea frecuente necesita más de 3 pasos, está mal diseñada.

---

## 5) Plan de implementación (sin big-bang)

## Sprint 1 (rápido: simplificación visible)
1. Reordenar pestañas en ficha a: Operación / Números / Fiscal.
2. Mover “Atajos” a cabecera contextual.
3. Añadir bloque “Pendientes de este inmueble” arriba de la ficha.

## Sprint 2 (quitar duplicidad)
1. En ficha, incluir mini-vista de cobros de contrato activo.
2. En Contratos global, añadir texto/CTA: “para operar un contrato, abre la ficha del inmueble”.
3. Unificar nomenclatura: “Gastos recurrentes (OPEX)” y “Mejoras (CAPEX)”.

## Sprint 3 (eficiencia operativa)
1. Filtro en Cartera: “Requiere acción”.
2. Indicador por inmueble: Operación ✅ / Números ✅ / Fiscal ✅.
3. KPI de reducción de saltos entre pantallas.

---

## 6) Criterio de aceptación (definición de éxito)

La racionalización será válida solo si se cumple:

1. Menos de 4 pestañas por ficha.
2. Una tarea frecuente = un lugar único.
3. Reducción de saltos entre módulo Inmuebles y Contratos global.
4. Usuario entiende “qué tengo pendiente” en <10 segundos al abrir ficha.

---

## 7) Métricas que sí importan

- Tiempo medio para renovar contrato.
- Tiempo medio para registrar mejora.
- % inmuebles con estado “listo para cierre fiscal”.
- Nº de visitas a pantallas globales para tareas que deberían resolverse en ficha.

---

## 8) Propuesta concreta para validar ya (sin código adicional)

Hacer una prueba guiada con 5 usuarios internos con 3 tareas:
1. Renovar contrato de un inmueble activo.
2. Registrar una mejora.
3. Dejar inmueble listo para fiscal.

Éxito si:
- ≥80% completan sin ayuda.
- Tiempo total <6 minutos entre 3 tareas.
- Confusión de navegación <2 incidencias por usuario.

Si falla, no iterar estilos: iterar arquitectura.
