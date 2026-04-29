import fs from 'fs';
import path from 'path';

/**
 * Design compliance regressions · validan tokens y patrones que NO deben
 * romperse. Los tests de iconos para 'Previsiones' (T20 los eliminó del
 * menú · ver `atlasNavigationAudit.test.ts` v5) fueron retirados.
 *
 * Los 2 tests siguientes validan archivos legacy en `horizon/` que se
 * eliminan en Phase 4 cleanup · entonces se sustituirán por sus
 * equivalentes v5.
 */

describe('Design compliance regressions', () => {
  it('keeps Nomina stacked chart with the 4 payroll concept colors c1..c4', () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/components/personal/nomina/NominaManager.tsx'),
      'utf8',
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

  it('keeps neutral icon background token in Inversiones header (legacy · purga Phase 4)', () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/horizon/inversiones/InversionesPage.tsx'),
      'utf8',
    );

    expect(file).toContain("background: 'var(--n-100)'");
  });
});
