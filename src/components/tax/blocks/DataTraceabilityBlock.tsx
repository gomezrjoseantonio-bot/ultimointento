import React from 'react';

interface MappingRow {
  origen: string;
  campoOrigen: string;
  transformacion: string;
  destinoDeclaracion: string;
  destinoUI: string;
  validacion: string;
}

const MAPPING_ROWS: MappingRow[] = [
  {
    origen: 'Nóminas activas (nominaService)',
    campoOrigen: 'distribucionMensual[].bruto, irpfImporte, ssTotal, ppEmpleado',
    transformacion: 'Agregación anual + límites PP (1.500/8.500/10.000)',
    destinoDeclaracion: 'Base General > Rendimientos del trabajo + Retenciones trabajo',
    destinoUI: 'Trabajo > Retribuciones / SS / Retención',
    validacion: 'Conciliación: si hay real de nómina, sustituye salario estimado',
  },
  {
    origen: 'Autónomos (store: autonomos)',
    campoOrigen: 'fuentesIngreso[], gastosRecurrentesActividad[], cuotaAutonomos',
    transformacion: 'Anualización por meses + cálculo M130 = 20% rendimiento neto',
    destinoDeclaracion: 'Base General > Actividad económica + Retenciones M130',
    destinoUI: 'Actividad > Ingresos/Gastos/Retenciones',
    validacion: 'Solo se toma el autónomo activo',
  },
  {
    origen: 'Inmuebles + contratos + fiscal summary',
    campoOrigen: 'contracts.rentaMensual + summary boxes 0105/0106/0109/0112/0113/0114/0115/0117',
    transformacion: 'Prorrateo por días alquilado/vacío/obras + reducción vivienda habitual 60%',
    destinoDeclaracion: 'Base General > Rendimientos inmobiliarios + Imputación de rentas',
    destinoUI: 'Inmuebles > Ingresos, gastos deducibles, amortización y rendimiento neto',
    validacion: 'Límite AEAT art. 23 para 0105+0106 + arrastres FIFO',
  },
  {
    origen: 'Inversiones (store: inversiones + fiscal service)',
    campoOrigen: 'dividendos, plusvalías/minusvalías, planes de pensiones',
    transformacion: 'Compensación de minusvalías pendientes + retención 19% sobre RCM',
    destinoDeclaracion: 'Base Ahorro > Capital mobiliario + Ganancias/Pérdidas',
    destinoUI: 'Ahorro y G/P > Rendimientos y saldos compensables',
    validacion: 'Aplicación secuencial de pendientes hasta agotar plusvalías',
  },
  {
    origen: 'Datos personales (personalDataService)',
    campoOrigen: 'descendientes, ascendientes, discapacidad',
    transformacion: 'Cálculo mínimos personales/familiares por edad y situación',
    destinoDeclaracion: 'Mínimo personal y familiar',
    destinoUI: 'Resultado (impacto en cuota íntegra general)',
    validacion: 'No hay bonus de edad del contribuyente si falta fecha de nacimiento',
  },
  {
    origen: 'Conciliación fiscal opcional',
    campoOrigen: 'conciliacion.lineas (real vs estimado)',
    transformacion: 'Sustitución de importes estimados por reales cuando existen',
    destinoDeclaracion: 'Campos reconciliados de trabajo e inmuebles',
    destinoUI: 'Trazabilidad (columna de validación real/estimado)',
    validacion: 'Fallback automático a estimado si falla la conciliación',
  },
  {
    origen: 'Ejercicio seleccionado',
    campoOrigen: 'año actual o histórico',
    transformacion: 'Año en curso marcado como previsión de presupuesto',
    destinoDeclaracion: 'Contexto temporal del cálculo IRPF',
    destinoUI: 'Selector Ejercicio (etiqueta “en curso · previsión”)',
    validacion: 'Permite comparar forecast del año vivo contra históricos',
  },
];

const DataTraceabilityBlock: React.FC = () => {
  return (
    <div className="block-root">
      <h3 className="block-title">Trazabilidad origen → declaración</h3>
      <p style={{ color: 'var(--n-500)', marginBottom: 20, fontSize: '0.875rem' }}>
        Tabla de control para verificar que cada dato fiscal llega desde su origen real al campo correcto
        del Modelo 100 antes de aceptar la estimación.
      </p>

      <div className="trace-table-wrap">
        <table className="trace-table">
          <thead>
            <tr>
              <th>Origen</th>
              <th>Campo origen</th>
              <th>Transformación</th>
              <th>Destino declaración</th>
              <th>Destino UI</th>
              <th>Validación</th>
            </tr>
          </thead>
          <tbody>
            {MAPPING_ROWS.map((row) => (
              <tr key={`${row.origen}-${row.destinoDeclaracion}`}>
                <td>{row.origen}</td>
                <td>{row.campoOrigen}</td>
                <td>{row.transformacion}</td>
                <td>{row.destinoDeclaracion}</td>
                <td>{row.destinoUI}</td>
                <td>{row.validacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTraceabilityBlock;
