import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { n } from '../../../store/taxSlice';

const ResultBlock: React.FC = () => {
  const tax = useSelector((s: RootState) => s.tax);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rows: { label: string; value: number; indent?: boolean; bold?: boolean; sign?: boolean }[] = [
    { label: 'Rendimiento neto trabajo', value: n(tax.workIncome.dinerarias) + n(tax.workIncome.especieValoracion) + n(tax.workIncome.contribucionEmpresarialPP) - n(tax.workIncome.cotizacionSS) - n(tax.workIncome.otrosGastosDeducibles), indent: true },
    { label: 'Rendimientos netos reducidos inmuebles', value: tax.inmuebles.reduce((a, i) => a + n(i.rendimientoNetoReducido), 0), indent: true },
    { label: 'Imputaciones de rentas inmobiliarias', value: tax.inmuebles.reduce((a, i) => a + n(i.rentaImputada), 0), indent: true },
    { label: 'Rendimiento neto actividades económicas', value: tax.actividades.reduce((a, act) => a + n(act.rendimientoNeto), 0), indent: true },
    { label: 'Saldo neto G/P base general', value: tax.ganancias.filter(g => g.base === 'general').reduce((a, g) => a + n(g.resultado), 0), indent: true },
    { label: 'Base imponible general', value: tax.baseImponibleGeneral, bold: true },
    { label: '(−) Reducción previsión social', value: -n(tax.previsionSocial.importeAplicado), indent: true },
    { label: 'Base liquidable general', value: tax.baseLiquidableGeneral, bold: true },
    { label: 'Base liquidable del ahorro', value: tax.baseLiquidableAhorro, bold: true },
    { label: 'Cuota íntegra (estatal + autonómica)', value: tax.cuotaIntegra, bold: true },
    { label: 'Cuota líquida', value: tax.cuotaLiquida, bold: true },
    { label: '(−) Retenciones trabajo', value: -n(tax.workIncome.retencion), indent: true },
    { label: '(−) Retenciones capital mobiliario', value: -n(tax.capitalMobiliario.retencion), indent: true },
    { label: '(−) Retenciones actividades', value: -tax.actividades.reduce((a, act) => a + n(act.retencion), 0), indent: true },
    { label: '(−) Total retenciones y pagos a cuenta', value: -tax.totalRetenciones, bold: true },
    { label: 'CUOTA DIFERENCIAL', value: tax.cuotaDiferencial, bold: true, sign: true },
  ];

  return (
    <div className="block-root">
      <h3 className="block-title">Resultado de la declaración</h3>
      <div className="result-table">
        {rows.map(({ label, value, indent, bold, sign }) => (
          <div key={label} className={`result-row ${bold ? 'result-row--bold' : ''} ${indent ? 'result-row--indent' : ''}`}>
            <span className="result-label">{label}</span>
            <span className={`result-value ${sign ? (value > 0 ? 'color-neg' : 'color-pos') : ''}`}>
              {fmt(value)} €
            </span>
          </div>
        ))}
      </div>
      <p className="result-disclaimer">
        Estimación orientativa. Para la declaración oficial usa el programa Renta Web de la AEAT.
      </p>
    </div>
  );
};

export default ResultBlock;
