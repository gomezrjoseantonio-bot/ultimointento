/**
 * FIX onboarding · PUNTO 2 · P6 · la definición de "rentabilidad" no está
 * decidida por producto · no debe aparecer en NINGUNA pantalla del onboarding.
 * Test de contenido sobre los .tsx de `modules/onboarding/empezar`.
 */
import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

it('ninguna pantalla del onboarding menciona "rentabilidad"', () => {
  const dir = path.join(process.cwd(), 'src', 'modules', 'onboarding', 'empezar');
  const ofensores = walk(dir).filter((f) => /rentabilidad/i.test(fs.readFileSync(f, 'utf8')));
  expect(ofensores).toEqual([]);
});
