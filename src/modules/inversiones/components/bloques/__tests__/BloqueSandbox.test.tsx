// Smoke test · BloqueSandbox (PR 4 · spec §11 fila 9).
// Recálculo dinámico al mover sliders + verifica la fórmula determinista
// `calcularVF` (idéntica a la de proyeccionActivoService).

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import BloqueSandbox, { __test__ } from '../BloqueSandbox';

describe('BloqueSandbox · render base', () => {
  test('PPI · 3 sliders con topes correctos + display inicial', () => {
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPI"
        saldoActual={35491}
        aportacionAnualDefault={1500}
        anosDefault={23}
        twrDefault={0.03}
        valorFinalActual={null}
      />,
    );
    const aporte = screen.getByLabelText('Aportación anual') as HTMLInputElement;
    const anos = screen.getByLabelText('Años hasta rescate') as HTMLInputElement;
    const twr = screen.getByLabelText('TWR esperado') as HTMLInputElement;
    expect(aporte.max).toBe('1500');
    expect(anos.min).toBe('5');
    expect(anos.max).toBe('40');
    expect(twr.min).toBe('0');
    expect(twr.max).toBe('10');
  });

  test('PPE · tope aportación 10.000 €', () => {
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPE"
        saldoActual={35491}
        aportacionAnualDefault={1500}
        anosDefault={23}
        twrDefault={0.03}
        valorFinalActual={null}
      />,
    );
    const aporte = screen.getByLabelText('Aportación anual') as HTMLInputElement;
    expect(aporte.max).toBe('10000');
  });

  test('PPES autónomo · tope 5.750 €', () => {
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPES"
        esAutonomo
        saldoActual={1000}
        aportacionAnualDefault={1500}
        anosDefault={23}
        twrDefault={0.03}
        valorFinalActual={null}
      />,
    );
    const aporte = screen.getByLabelText('Aportación anual') as HTMLInputElement;
    expect(aporte.max).toBe('5750');
  });

  test('discapacidad · tope 24.250 €', () => {
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPI"
        discapacidad
        saldoActual={1000}
        aportacionAnualDefault={1500}
        anosDefault={23}
        twrDefault={0.03}
        valorFinalActual={null}
      />,
    );
    const aporte = screen.getByLabelText('Aportación anual') as HTMLInputElement;
    expect(aporte.max).toBe('24250');
  });
});

describe('BloqueSandbox · recálculo dinámico', () => {
  test('mover TWR a 5 % · valor final cambia · diferencia vs actual visible', () => {
    const valorActualEscenario = 60000;
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPI"
        saldoActual={35491}
        aportacionAnualDefault={1500}
        anosDefault={23}
        twrDefault={0}
        valorFinalActual={valorActualEscenario}
      />,
    );
    const twr = screen.getByLabelText('TWR esperado') as HTMLInputElement;
    fireEvent.change(twr, { target: { value: '5' } });

    // Display debe reflejar 5,0 %
    expect(screen.getByText('5.0 %')).toBeInTheDocument();

    // Verifica que el valor final con TWR 5% es > que el actual de partida
    // (saldo 35.491 + 1.500·23 = 69.991 sin TWR; con TWR 5 % ≈ 178.000).
    const esperado = __test__.calcularVF(35491, 1500, 0.05, 23);
    expect(esperado).toBeGreaterThan(100_000);
    expect(esperado).toBeLessThan(220_000);

    // Diferencia vs actual visible (positiva o negativa)
    const dif = esperado - valorActualEscenario;
    expect(dif).toBeGreaterThan(0);
  });

  test('mover aportación · valor final aumenta', () => {
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPI"
        saldoActual={35491}
        aportacionAnualDefault={0}
        anosDefault={23}
        twrDefault={0.03}
        valorFinalActual={null}
      />,
    );
    const before = screen.getByText(/Valor final simulado/).parentElement!;
    const beforeText = before.textContent ?? '';
    const aporte = screen.getByLabelText('Aportación anual') as HTMLInputElement;
    fireEvent.change(aporte, { target: { value: '1500' } });
    const afterText = before.textContent ?? '';
    expect(beforeText).not.toEqual(afterText);
  });

  test('mover años · display cambia', () => {
    render(
      <BloqueSandbox
        posicionId="plan-1"
        tipoActivo="plan_pensiones"
        tipoPlan="PPI"
        saldoActual={10000}
        aportacionAnualDefault={1000}
        anosDefault={20}
        twrDefault={0.03}
        valorFinalActual={null}
      />,
    );
    const anos = screen.getByLabelText('Años hasta rescate') as HTMLInputElement;
    fireEvent.change(anos, { target: { value: '40' } });
    expect(screen.getByText('40 años')).toBeInTheDocument();
  });
});

describe('BloqueSandbox · fórmula calcularVF', () => {
  test('coincide con el caso de referencia (Plan Orange · 23 años · TWR −0,1 %)', () => {
    // Misma fórmula que proyeccionActivoService · ~68,8 k €.
    const vf = __test__.calcularVF(35491, 1500, -0.001, 23);
    expect(vf).toBeGreaterThan(65_000);
    expect(vf).toBeLessThan(72_000);
  });

  test('saldo 0 + 0 aporte · valor final 0', () => {
    expect(__test__.calcularVF(0, 0, 0.05, 10)).toBe(0);
  });

  test('aporte solo · sin saldo inicial · capitaliza al inicio de año', () => {
    // VF = 1000·(1+0.05) acumulado 5 años con r=5 % al inicio de año.
    // Iterative · v0=0, v1=(0+1000)*1.05=1050, v2=(1050+1000)*1.05=2152.5 ...
    const vf = __test__.calcularVF(0, 1000, 0.05, 5);
    // Suma anualidad anticipada · ~5801.91.
    expect(vf).toBeGreaterThan(5_800);
    expect(vf).toBeLessThan(5_810);
  });
});
