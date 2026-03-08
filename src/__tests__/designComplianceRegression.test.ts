import fs from 'fs';
import path from 'path';
import {
  navigationConfig,
} from '../config/navigation';
import { LineChart, BarChart3, GitBranch, Calculator, TrendingUp } from 'lucide-react';

describe('Design compliance regressions', () => {
  it('uses the expected icon mapping for Previsiones in sidebar and subtabs', () => {
    const previsiones = navigationConfig.find((item) => item.name === 'Previsiones');

    expect(previsiones).toBeDefined();
    expect(previsiones?.icon).toBe(LineChart);

    const subTabs = previsiones?.subTabs ?? [];
    const byName = (name) => subTabs.find((tab) => tab.name === name)?.icon;

    expect(byName('Real vs Previsto')).toBe(BarChart3);
    expect(byName('Escenarios')).toBe(GitBranch);
    expect(byName('Valoraciones')).toBe(Calculator);
  });

  it('does not reuse Inversiones icon for Previsiones top-level item', () => {
    const inversiones = navigationConfig.find((item) => item.name === 'Inversiones');
    const previsiones = navigationConfig.find((item) => item.name === 'Previsiones');

    expect(inversiones?.icon).toBe(TrendingUp);
    expect(previsiones?.icon).not.toBe(inversiones?.icon);
  });

  it('keeps Nomina stacked chart with the 4 payroll concept colors c1..c4', () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/components/personal/nomina/NominaManager.tsx'),
      'utf8'
    );

    expect(file).toContain("backgroundColor: 'var(--c1)'");
    expect(file).toContain("backgroundColor: 'var(--c2)'");
    expect(file).toContain("backgroundColor: 'var(--c3)'");
    expect(file).toContain("backgroundColor: 'var(--c4)'");

    expect(file).toContain('Salario base');
    expect(file).toContain('Pagas extra');
    expect(file).toContain('Variables');
    expect(file).toContain('Bonus');
  });

  it('keeps neutral icon background token in Inversiones header', () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/horizon/inversiones/InversionesPage.tsx'),
      'utf8'
    );

    expect(file).toContain("background: 'var(--n-100)'");
  });
});
