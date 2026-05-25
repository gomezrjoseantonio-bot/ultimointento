/**
 * Smoke test · el componente canónico `<EmptyState />` NO contiene NINGÚN
 * emoji pictográfico en su salida renderizada. Cumple regla §5.1 del spec.
 *
 * Solo iconos Lucide (svg). Cero glifos del bloque Unicode de emojis.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { Building2 } from 'lucide-react';
import { EmptyState } from '../EmptyState';

describe('EmptyState · smoke cero emojis', () => {
  it('no contiene ningún emoji pictográfico en el texto renderizado', () => {
    const { container } = render(
      <EmptyState
        icon={Building2}
        title="Sin inmuebles aún"
        subtitle="Añade tu primer inmueble para empezar a ver tu cartera consolidada."
        cta={{ label: 'Añadir inmueble', onClick: () => undefined }}
      />,
    );
    const emojiRegex = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u;
    expect(container.textContent ?? '').not.toMatch(emojiRegex);
  });
});
