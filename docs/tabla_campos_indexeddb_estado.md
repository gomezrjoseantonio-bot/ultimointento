# Tabla resumen de campos (IndexedDB + estado derivado)

> Alcance: campos persistidos en IndexedDB y variables de estado derivadas que se usan en paneles de **ingresos, gastos, cashflow, patrimonio, tesorería e inmuebles**.

| Variable interna | Etiqueta en app | Qué es realmente / cómo se calcula | Ejemplo de valor real |
|---|---|---|---|
| `ingreso.contraparte` | Contraparte | Pagador del ingreso en `ingresos` (alta manual/automatizada). | `Inquilino Piso Centro` |
| `ingreso.origen` | Origen | Procedencia del ingreso (`contrato_id`, `nomina_id`, `doc_id`). | `contrato_id` |
| `ingreso.fecha_emision` | Fecha Emisión | Fecha del documento/registro del ingreso. | `2026-03-12` |
| `ingreso.fecha_prevista_cobro` | Fecha Prevista Cobro | Fecha esperada de entrada de caja para el ingreso. | `2026-03-15` |
| `ingreso.importe` | Importe | Importe bruto del ingreso en moneda de registro. | `200.00` |
| `ingreso.destino` | Destino | Ámbito del ingreso: `personal` o `inmueble_id`. | `inmueble_id` |
| `ingreso.destino_id` | Destino (inmueble) | ID del inmueble asociado cuando `destino = inmueble_id`. | `1` |
| `ingreso.estado` | Estado | Estado funcional del ingreso (`previsto`, `cobrado`, `incompleto`). | `previsto` |
| `gasto.contraparte_nombre` | Contraparte | Proveedor/beneficiario del pago en `gastos`. | `Comunidad Edificio Sol` |
| `gasto.fecha_emision` | Fecha Emisión | Fecha del documento o apunte de gasto. | `2026-03-05` |
| `gasto.fecha_pago_prevista` | Fecha Pago Prevista | Fecha estimada de salida de caja del gasto. | `2026-03-21` |
| `gasto.total` | Importe | Total del gasto (normalmente `base + iva` cuando aplica). | `300.00` |
| `gasto.base` | Base | Base imponible almacenada para fiscalidad/reporte. | `247.93` |
| `gasto.iva` | IVA | Cuota IVA almacenada para desglose fiscal. | `52.07` |
| `gasto.categoria_AEAT` | Categoría AEAT | Clasificación fiscal del gasto (p.ej. suministros). | `suministros` |
| `gasto.destino` | Destino | Ámbito del gasto: `personal` o `inmueble_id`. | `personal` |
| `gasto.estado` | Estado | Estado funcional del gasto (`completo`, `incompleto`, `pagado`). | `completo` |
| `capex.inmueble_id` | Inmueble | Inmueble al que se imputa la inversión CAPEX. | `1` |
| `capex.total` | Total Invertido | Importe invertido en mejora/ampliación/mobiliario. | `18000` |
| `capex.tipo` | Tipo | Tipo CAPEX (`mejora`, `ampliacion`, `mobiliario`). | `mejora` |
| `capex.anos_amortizacion` | Amortización (años) | Horizonte anual de amortización contable del CAPEX. | `15` |
| `account.balance` | HOY / Disponible hoy | Saldo de cuenta importado/manual; base de liquidez y tesorería. | `"1.200,50"` |
| `account.alias` | BANCO | Nombre visible de la cuenta en panel de tesorería. | `Banco Principal` |
| `movement.amount` | (movimiento bancario) | Importe de movimiento bancario conciliable en `movements`. | `-1240` |
| `treasuryEvent.type` | (no etiqueta única, afecta Por Cobrar/Por Pagar) | Tipo de evento previsto/real (`income`, `expense`, `financing`). | `expense` |
| `treasuryEvent.status` | Estado (motor tesorería) | Si es forecast o real; afecta `hoy` vs proyección (`predicted`, `pending`, `confirmed`, etc.). | `pending` |
| `treasuryEvent.amount` | Por Cobrar / Por Pagar | Importe de evento de tesorería para cálculo de columnas del panel. | `315` |
| `property.alias` | Inmueble | Alias del activo inmobiliario mostrado en cartera/paneles. | `Piso Centro` |
| `property.state` | (filtro interno activos) | Estado del inmueble; solo activos entran en ciertos KPIs. | `activo` |
| `property.acquisitionCosts.price` | (fallback valoración) | Precio de compra usado como fallback de valoración patrimonial. | `100000` |
| `property.currentValue` | (valor inmueble en patrimonio) | Valor actual del inmueble priorizado en patrimonio neto cuando existe. | `155000` |
| `prestamo.principalVivo` | Deuda | Principal pendiente que resta en patrimonio neto. | `98000` |
| `prestamo.cuotaMensual` | (impacta cashflow inmuebles) | Cuota mensual de préstamo de ámbito `INMUEBLE` usada como salida de caja. | `300` |
| `inversion.valor_actual` | Inversiones | Valor actual de cada posición para patrimonio neto. | `24000` |
| `patrimonioSnapshot.total` | Patrimonio neto (histórico) | Snapshot mensual del total patrimonial para variación intermensual. | `215000` |
| `patrimonioSnapshot.fecha` | (mes snapshot) | Clave mensual `YYYY-MM` para comparar variaciones. | `2026-03` |
| `liquidez.disponibleHoy` | Disponible hoy | `sum(balance de cuentas activas)` en fecha actual. | `1500.5` |
| `liquidez.comprometido30d` | Comprometido 30d | `expenses(30d) + treasuryEvents(expense/financing forecast 30d)`. | `615` |
| `liquidez.ingresos30d` | Ingresos 30d | `rentPayments(30d) + ingresos(30d) + treasuryEvents(income forecast 30d)`. | `650` |
| `liquidez.proyeccion30d` | Proyección 30d | `disponibleHoy + ingresos30d - comprometido30d`. | `1535.5` |
| `tesoreriaFila.inicioMes` | INICIO MES | `balance actual - delta de movements del mes hasta hoy`. | `1000` |
| `tesoreriaFila.hoy` | HOY | `balance actual + delta de treasuryEvents reales del mes`. | `600` |
| `tesoreriaFila.porCobrar` | POR COBRAR | Suma de eventos forecast de tipo `income` hasta fin de mes. | `500` |
| `tesoreriaFila.porPagar` | POR PAGAR | Suma de eventos forecast de tipo `expense` + `financing`. | `475` |
| `tesoreriaFila.proyeccion` | PROYECCIÓN | `hoy + porCobrar - porPagar`. | `625` |
| `flujos.inmuebles.cashflow` | Cashflow (Inmuebles) | `rentas cobradas o fallback contratos - gastos inmuebles - cuotas hipoteca`. | `450` |
| `flujos.inmuebles.ocupacion` | ocupación | % ocupación calculado sobre unidades activas (vivienda/habitaciones). | `100` |
| `patrimonio.total` | PATRIMONIO NETO | `inmuebles + inversiones + cuentas - deuda`. | `155000` |
| `patrimonio.desglose.inmuebles` | Inmuebles (desglose) | Suma de valoración por inmueble activo (histórica o fallback). | `155000` |
| `patrimonio.desglose.cuentas` | Cuentas (desglose) | Total `HOY` de tesorería reutilizado como fuente única. | `5666` |
| `patrimonio.desglose.deuda` | Deuda (desglose) | Suma de principal pendiente de préstamos activos. | `98000` |

## Notas rápidas
- Los ejemplos numéricos (`1500.5`, `615`, `650`, `1535.5`, `625`, `5666`, `155000`) salen de tests de métricas financieras y representan casos reales del código de negocio.
- En varias rutas legacy se aceptan nombres alternativos de campos (`importe`, `total`, `amount`; `fecha`, `fecha_emision`, etc.) y se normalizan en servicios.
