// La pantalla, montada de verdad.
//
// Los tests de `conciliarPantalla.test.ts` prueban las piezas puras; esto prueba
// que la pantalla las ENSEÑA. Es la clase de fallo que no da error en ninguna
// parte: una clase de CSS mal escrita deja el `className` en `undefined` y el
// bloque pierde su sitio sin que nada avise, y una prop que no se pasa deja un
// contador a cero que parece un dato.

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PanelConciliar from '../conciliar/PanelConciliar';
import type { LineaExtracto } from '../extractoSesion';
import type { Cuadre } from '../conciliarBuckets';

const linea = (id: number, extra: Partial<LineaExtracto> = {}): LineaExtracto => ({
  lineaId: 100 + id,
  movementId: id,
  hashLinea: `h${id}`,
  textoBanco: `GESTIÓ I ADMINISTRACIÓ DE FINQUES ${id}`,
  fecha: '2026-08-01',
  importe: -605,
  veredicto: 'resolver',
  ...extra,
});

const cuadreDe = (over: Partial<Cuadre> = {}): Cuadre => ({
  delBanco: 124,
  colocadas: 124,
  porBucket: { resueltas: 78, te_necesitan: 6, personal: 32, ignorados: 8 },
  cuadra: true,
  huerfanas: [],
  ...over,
});

function pintar(over: Partial<React.ComponentProps<typeof PanelConciliar>> = {}) {
  return render(
    <PanelConciliar
      titularCuenta="Santander · ****2715 · 124 líneas"
      elCuadre={cuadreDe()}
      necesitan={[linea(1)]}
      resueltas={[]}
      personales={[]}
      ignoradas={[]}
      propuestas={
        new Map([
          [
            1,
            {
              tono: 'propone' as const,
              titular: 'Parece un gasto de un piso',
              ayuda: 'ya me lo dijiste una vez y desde entonces lo reconozco',
              seRecuerda: true,
            },
          ],
        ])
      }
      aprendido={{ nuevas: [], deAntes: 0, total: 0 }}
      avisos={[]}
      error={null}
      guardando={false}
      renderLinea={(l) => <div>línea {l.movementId}</div>}
      onRecuperar={() => undefined}
      onGuardar={() => undefined}
      onOtroFichero={() => undefined}
      {...over}
    />,
  );
}

describe('PanelConciliar · lo que el usuario ve', () => {
  it('canta el cuadre en la cabecera · es la promesa de la pantalla', () => {
    pintar();
    expect(screen.getAllByText('124').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/ninguna se pierde/)).toBeInTheDocument();
  });

  it('enseña los cuatro montones con sus cifras', () => {
    pintar();
    expect(screen.getByText('resueltas solas')).toBeInTheDocument();
    expect(screen.getByText('te necesitan · una vez')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.getByText('ignorados')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
  });

  it('la tarjeta lleva la propuesta encima de la línea del banco', () => {
    pintar();
    expect(screen.getByText('Parece un gasto de un piso')).toBeInTheDocument();
    expect(screen.getByText('se recordará')).toBeInTheDocument();
    expect(screen.getByText('línea 1')).toBeInTheDocument();
  });

  it('sin sugerencia para esa línea sigue habiendo tarjeta · pregunta abierta', () => {
    pintar({ propuestas: new Map() });
    expect(screen.getByText(/No sé qué es/)).toBeInTheDocument();
    expect(screen.getByText('línea 1')).toBeInTheDocument();
  });

  it('cuando NO cuadra, el pie lo dice y no disimula', () => {
    pintar({
      elCuadre: cuadreDe({
        colocadas: 120,
        porBucket: { resueltas: 78, te_necesitan: 2, personal: 32, ignorados: 8 },
        cuadra: false,
      }),
    });
    expect(screen.getByText(/No cuadra/)).toBeInTheDocument();
    expect(screen.getByText(/no se guarda hasta que cuadre/)).toBeInTheDocument();
  });

  it('con la cuenta virgen no presume de saber nada', () => {
    pintar();
    expect(screen.getByText(/todavía no reconoce nada de esta cuenta/)).toBeInTheDocument();
    expect(
      screen.getByText(/Aquí caerá lo que ya me hayas dicho que es tuyo/),
    ).toBeInTheDocument();
  });

  it('dice cuántas cosas reconoce cuando reconoce alguna', () => {
    pintar({ aprendido: { nuevas: [], deAntes: 12, total: 12 } });
    expect(screen.getByText(/ATLAS ya reconoce 12 cosas de esta cuenta/)).toBeInTheDocument();
  });

  it('las ignoradas se pueden reactivar · nada se aparta sin vuelta atrás', () => {
    pintar({ ignoradas: [linea(9)] });
    expect(screen.getByText('reactivar')).toBeInTheDocument();
  });

  it('sin nada que preguntar, lo dice en vez de dejar la columna muerta', () => {
    pintar({ necesitan: [] });
    expect(screen.getByText(/Nada que preguntarte/)).toBeInTheDocument();
  });
});
