import type { Movement } from '../../../../services/db';
import { formatMovementDescriptionForReport } from './tesoreriaReportFormatting';

describe('generateTesoreria', () => {
  it('sustituye el ID del inmueble por su alias en la descripción del PDF', () => {
    const movement = {
      description: 'Cobro venta inmueble #10',
      inmuebleId: '10',
    } as Movement;

    const description = formatMovementDescriptionForReport(
      movement,
      new Map([['10', 'Piso Sol']]),
    );

    expect(description).toBe('Cobro venta Piso Sol');
  });

  it('mantiene la descripción original cuando no hay alias resuelto', () => {
    const movement = {
      description: 'Cobro venta inmueble #10',
      inmuebleId: '10',
    } as Movement;

    const description = formatMovementDescriptionForReport(movement, new Map());

    expect(description).toBe('Cobro venta inmueble #10');
  });
});
