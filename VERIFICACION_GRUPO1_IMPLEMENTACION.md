# Verificación de implementación — Grupo 1 + cierre de circuito (1.9)

Fecha: 2026-03-01

## Resultado rápido

- **Implementado (completo o muy avanzado):** 1.2, 1.3, 1.4, 1.5, 1.6 (núcleo), 1.7, 1.8, 1.9 (motor/servicio).
- **Parcial:** 1.1 (ocupación por ejercicio), 1.6 (UI de arrastres por detalle legal completo), 1.9 (modelo dual detallado por tipo fiscal en tesorería + UI final comparativa).
- **No encontrado de forma explícita:** un campo/flujo formal en Tesorería llamado `tipoFiscal` + `ejercicioFiscal` persistido en movimientos.

---

## Checklist detallado

## 1.1 Inmuebles: días de ocupación por ejercicio
**Estado: PARCIAL**

✅ Existe persistencia de días por inmueble/año en `propertyDays` (`daysRented`, `daysAvailable`).  
✅ El motor IRPF los usa con fallback a contratos (`db.getAllFromIndex('propertyDays', 'property-year', ...)`).  
⚠️ No se aprecia gestión explícita de **días en obras** en la entidad (`diasEnObras` está hardcoded a 0 en cálculo IRPF).  
⚠️ No se aprecia una UI clara para editar calendario completo (alquilado/vacío/obras) en ficha de inmueble.

## 1.2 Inmuebles: mejoras como entidad primera clase
**Estado: PARCIAL-ALTO**

✅ Existe `PropertyImprovement` en DB y servicio (`add/get/delete`).  
✅ La amortización AEAT incorpora mejoras históricas y mejoras del ejercicio con prorrateo por días (`daysInYear`).  
⚠️ El componente UI `PropertyImprovements` existe pero no se detecta su integración activa en pantallas de inmueble (sin referencias de uso).

## 1.3 Inmuebles accesorios vinculados
**Estado: IMPLEMENTADO (motor) / PARCIAL (alta-edición UI)**

✅ Campos `isAccessory` y `mainPropertyId` existen en modelo.  
✅ El motor separa principales/accesorios y agrega amortización/gastos del accesorio al principal.  
✅ Hay tests dedicados para accesorios y edge-cases.  
⚠️ En UI se ve visualización del vínculo en detalle, pero no se confirma flujo completo de alta/edición con selector "Es accesorio de...".

## 1.4 Financiación: intereses por inmueble/año → box0105
**Estado: IMPLEMENTADO**

✅ Servicio `getInteresesHipotecaByPropertyAndYear(propertyId, ejercicio)` suma intereses desde plan de amortización.  
✅ `calculateFiscalSummary` alimenta `box0105` automáticamente si no hay documentos manuales para evitar doble conteo.  
✅ Test unitario dedicado (`loanInterestService.test.ts`).

## 1.5 Gastos recurrentes con casilla AEAT
**Estado: IMPLEMENTADO**

✅ `OpexRule` incluye `casillaAEAT` override manual.  
✅ Servicio `getGastosRecurrentesFiscales` agrega gastos recurrentes activos por ejercicio (con prorrateo y mapeo a casillas).  
✅ `calculateFiscalSummary` suma esos importes por casilla al resumen fiscal.

## 1.6 Límite 50% (0105+0106) y arrastres
**Estado: IMPLEMENTADO (núcleo)**

✅ Se aplica límite AEAT `0105+0106 <= ingresos íntegros` y se calcula exceso.  
✅ Existe entidad de arrastre persistente (`ArrastreIRPF`) con campos de origen, caducidad y aplicación.  
✅ En IRPF se aplican arrastres previos con criterio FIFO y caducidad (4 años).  
✅ Existen vistas/secciones "Arrastres" en módulo de fiscalidad.

## 1.7 Personal/Nómina: especie + PP empresa
**Estado: IMPLEMENTADO**

✅ Nómina ya contempla beneficios sociales (especie) y plan de pensiones empleado/empresa.  
✅ El motor IRPF suma especie y aplica límites de aportación PP (empleado/empresa/total).

## 1.8 Inversiones: fechas + pérdidas pendientes
**Estado: IMPLEMENTADO (sin antiaplicación 2 meses)**

✅ Operaciones de inversión usan `fecha` y se filtran por ejercicio.  
✅ Cálculo FIFO de ganancia/pérdida por reembolso implementado.  
✅ Gestión de minusvalías pendientes a 4 años implementada.  
⚠️ Hay un TODO explícito para la regla antiaplicación de 2 meses.

## 1.9 Conciliación fiscal (estimado vs real)
**Estado: PARCIAL-ALTO**

✅ Existe `fiscalConciliationService` que construye líneas por concepto/mes con `estimado`, `real`, `desviacion` y fuente (`estimado|real`).  
✅ `irpfCalculationService` ya integra conciliación opcional (`incluirConciliacion`) y adjunta datos en el resultado.  
⚠️ No se observa todavía un esquema explícito en movimientos con `tipoFiscal`/`ejercicioFiscal` tal cual diseño objetivo.  
⚠️ La conciliación usa señales existentes (ingresos/gastos/treasuryEvents), pero no una taxonomía fiscal unificada por movimiento.

---

## Conclusión

El repositorio **sí tiene implementada una parte muy importante del Grupo 1**, incluyendo piezas clave del motor fiscal (intereses automáticos, arrastres, accesorios, gastos recurrentes, inversiones y conciliación base). Sin embargo, **todavía no está “todo” cerrado extremo a extremo** según tu especificación:

1) Falta robustecer **ocupación anual** (obras + UI operativa de calendario).  
2) Falta cerrar del todo la experiencia **UI de mejoras/accesorios** en alta/edición para el flujo de usuario final.  
3) Falta consolidar una **capa fiscal explícita en Tesorería** (tipoFiscal/ejercicioFiscal por movimiento) y una UI de declaración plenamente dual (estimado vs real por línea) como contrato de producto.
