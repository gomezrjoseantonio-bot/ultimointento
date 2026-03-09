# Propuesta inicial — Botón “Vender activo inmobiliario” y alcance end‑to‑end

## 1) Situación actual observada

- Ya existe una acción **“🔴 Vender”** dentro del módulo de análisis, pero su efecto actual es local al estado del componente y no persiste en DB ni orquesta procesos dependientes.
- La cartera y múltiples servicios filtran por `property.state === 'activo'`, por lo que vender un inmueble impacta en KPIs, dashboards, fiscalidad, proyecciones y conciliación.
- El modelo de datos actual tiene `state: 'activo' | 'vendido' | 'baja'`, pero no existe todavía una **transacción de venta** formal con trazabilidad financiera/fiscal completa.

---

## 2) Objetivo funcional

Implementar un flujo robusto de “venta de inmueble” que:

1. Permita iniciar la venta desde puntos de entrada clave (Cartera, Detalle, Análisis).
2. Capture todos los datos relevantes de la operación (precio, fecha, costes, cancelación de deuda, impuestos, etc.).
3. Persista una entidad de venta auditable y cambie el estado del activo de forma consistente.
4. Recalcule/propague impactos en módulos downstream (tesorería, fiscal, panel, proyecciones, valoraciones, contratos).
5. Evite inconsistencias (contratos activos, hipotecas vivas sin cerrar, eventos duplicados).

---

## 3) Alcance propuesto (MVP+)

## 3.1 UX / Producto

### Nuevos puntos de entrada

- **Cartera (tabla):** añadir acción “Vender” por fila para inmuebles activos.
- **Detalle del inmueble:** CTA principal secundaria “Vender inmueble”.
- **Análisis:** reutilizar la acción existente, pero conectarla al mismo flujo transaccional.

### Modal / wizard de venta (común)

Campos mínimos MVP:
- Fecha de firma / transmisión.
- Precio de venta.
- Gastos de venta:
  - Comisión agencia.
  - Plusvalía municipal (estimada o real).
  - Notaría/gestoría venta.
  - Otros gastos.
- Hipoteca/préstamos vinculados:
  - Selección de préstamos a cancelar.
  - Importe pendiente y comisión de cancelación.
- Configuración fiscal:
  - Base para cálculo de ganancia patrimonial.
  - Retenciones/ajustes manuales (si aplica).
- Destino de liquidez neta:
  - Cuenta bancaria de entrada.
  - Fecha valor del movimiento.

Validaciones de negocio:
- No permitir confirmar sin fecha + precio.
- Si existen contratos activos, forzar resolución previa o cierre automático guiado.
- Si hay deuda vinculada, confirmar explícitamente estrategia (cancelar total/parcial).

## 3.2 Dominio / Datos

### Nueva entidad sugerida: `property_sales`

Registrar una venta inmutable con:
- `id`, `propertyId`, `saleDate`, `salePrice`.
- `saleCosts` desglosados.
- `loanSettlement` (pendiente, comisión, total cancelación).
- `grossProceeds`, `taxEstimate`, `netProceeds`.
- `createdAt`, `createdBy`, `source` (cartera/detalle/analisis).
- `status` (`draft`, `confirmed`, `reverted`).

### Cambios en `properties`

- Al confirmar:
  - `state = 'vendido'`.
  - `notes`/metadatos de cierre.
  - Enlazar `lastSaleId` (opcional recomendado).

### Integridad referencial funcional

- Contratos del inmueble: transición a finalizado/rescindido (según política).
- Préstamos vinculados: registrar evento de cancelación/regularización.
- Valoraciones: cortar serie histórica activa o marcar cierre.

## 3.3 Servicios / Orquestación

### Servicio nuevo recomendado: `propertySaleService`

Responsabilidades:
1. Pre-validación (contratos, deudas, datos mínimos).
2. Simulación previa (resumen económico/fiscal).
3. Confirmación transaccional (persistencia + side effects).
4. Reversión controlada (si se habilita).

### Flujo transaccional sugerido

1. Crear `property_sales` en `draft`.
2. Ejecutar validaciones cruzadas.
3. Crear movimientos de tesorería (entrada neta, salida cancelación deuda, gastos).
4. Actualizar contratos/préstamos.
5. Actualizar `properties.state` a `vendido`.
6. Marcar `property_sales` como `confirmed`.
7. Emitir evento de dominio (`PROPERTY_SOLD`).

---

## 4) Impacto módulo por módulo (revisión exhaustiva)

## 4.1 Inmuebles / Cartera

- Botón “Vender” visible solo si `state='activo'`.
- Badge y filtros por estado deben reflejar venta inmediatamente.
- En inmueble vendido:
  - Bloquear creación de nuevos contratos salvo reactivación explícita.
  - Mostrar bloque “Resumen de venta”.

## 4.2 Análisis de inmuebles

- La decisión “VENDER” debe pasar de estado local a persistencia real.
- Reusar datos de simulación como precarga del wizard de venta.
- Mantener trazabilidad entre recomendación automática y ejecución real.

## 4.3 Contratos / Ingresos

- Contratos activos del inmueble deben resolverse al vender:
  - opción asistida de finalización en fecha de venta.
- Evitar que ingresos futuros sigan computando en inmueble vendido.

## 4.4 Préstamos / Financiación

- Si `prestamo.inmuebleId` apunta al activo vendido:
  - registrar cancelación total/parcial.
  - reflejar comisión de cancelación en salida de caja.
- Ajustar alertas y estados para no marcar riesgo de un préstamo ya liquidado por venta.

## 4.5 Tesorería / Cuentas

- Generar automáticamente movimientos conciliables:
  - entrada por venta.
  - salidas por gastos de venta.
  - salida por cancelación de deuda.
- Etiquetar movimientos con `propertyId` + `saleId` para trazabilidad.

## 4.6 Fiscalidad (IRPF + amortización + arrastres)

- Cerrar ciclo de amortización del inmueble en fecha de venta.
- Calcular ganancia/pérdida patrimonial considerando:
  - valor adquisición + mejoras/capex amortizable,
  - gastos e impuestos de compra y venta,
  - amortización acumulada fiscalmente deducida.
- Reflejar impacto en resumen fiscal del ejercicio y arrastres si aplica.

## 4.7 Panel / KPIs / Dashboard

- Servicios que hoy filtran por `state='activo'` deben recomputar automáticamente.
- Riesgo de descuadre si no se reprocesan métricas históricas vs snapshot del ejercicio.

## 4.8 Proyección / Planificación

- Si existe decisión de venta programada (fecha futura):
  - trasladarla al plan base como evento futuro.
- Si venta confirmada (pasado/presente):
  - eliminar flujos futuros del inmueble en escenarios.

## 4.9 Documentación / auditoría

- Asociar escritura de compraventa y justificantes a `saleId`.
- Log de auditoría de usuario/fecha/valores antes-después.

---

## 5) Riesgos y mitigaciones

- **Riesgo 1: doble contabilización de liquidez** (simulación + movimiento real).
  - Mitigación: separar claramente `simulado` vs `confirmado`.
- **Riesgo 2: ingresos residuales de contratos activos**.
  - Mitigación: bloqueo duro de confirmación sin resolver contratos.
- **Riesgo 3: métricas inconsistentes en dashboard**.
  - Mitigación: evento `PROPERTY_SOLD` + recálculo dirigido por módulos.
- **Riesgo 4: fiscalidad incompleta por falta de datos históricos**.
  - Mitigación: check de completitud fiscal y fallback explícito “estimado”.

---

## 6) Roadmap de implementación sugerido

### Fase 1 — Base funcional (rápida)
- CTA “Vender” en Cartera + Detalle + Análisis.
- Wizard único de venta.
- Persistencia de venta + cambio de estado.
- Bloqueos mínimos (fecha/precio/contratos activos).

### Fase 2 — Integración financiera completa
- Movimientos de tesorería automáticos.
- Cancelación de préstamos vinculados.
- Recomputo dashboard/KPIs.

### Fase 3 — Cierre fiscal y proyección
- Ganancia patrimonial completa y arrastres.
- Integración con planificación/proyecciones.
- Auditoría y reversión controlada.

---

## 7) Criterios de aceptación (Definition of Done)

1. Desde cualquier punto de entrada se puede vender un inmueble activo con el mismo flujo.
2. Al confirmar venta:
   - existe registro `property_sales` confirmado,
   - el inmueble pasa a `vendido`,
   - no quedan contratos activos incoherentes,
   - se generan movimientos de tesorería esperados,
   - panel/KPIs reflejan el cambio.
3. El cálculo fiscal muestra impacto de venta en el ejercicio.
4. La operación queda auditada y trazable extremo a extremo.

---

## 8) Primera propuesta de implementación técnica concreta

- Crear `src/services/propertySaleService.ts` con API:
  - `prepareSale(propertyId)`
  - `simulateSale(payload)`
  - `confirmSale(payload)`
  - `getSaleById(id)`
- Añadir store IndexedDB `property_sales` en `db.ts` (migración de versión).
- Implementar componente reutilizable `PropertySaleModal` en módulo de inmuebles.
- Conectar botones:
  - `Cartera.tsx` (acción por fila)
  - `PropertyDetail.tsx` (CTA en header)
  - `Analisis.tsx` (en `handleDecision` cuando `VENDER`).
- Introducir evento de dominio simple (bus interno) para invalidación de caché local y recálculo.

Con esto conseguimos un primer release sólido, extensible y sin “deuda oculta” para fases fiscales y de planificación.
