// Tres anclas de una declaración de IRPF REAL (ejercicio 2024).
//
// Los 24 tests de `reduccionAlquiler.test.ts` son sintéticos: comprueban que el
// motor hace lo que dice el manual, pero los escribí a la vez que el motor, así
// que si hubiera entendido mal una regla, test y código estarían mal de la misma
// manera. Estos tres casos vienen de fuera: son contratos cuya reducción ya se
// declaró y se contrastó contra los importes presentados.
//
// PRIVACIDAD · aquí no hay ni un dato personal. Los XML de IRPF llevan NIF,
// direcciones, NIFs de inquilinos y cuentas bancarias, y NO se comitean. Lo que
// queda es el perfil de entrada —régimen, fecha, condiciones— y el porcentaje
// esperado; los alias son los del inmueble, no de nadie.
//
// Si alguno de estos fallara, el fallo es del MOTOR y no del test: son números
// ya presentados a Hacienda. No se ajusta la expectativa para que pase.

import { proponerReduccion, type CondicionesReduccion } from '../reduccionAlquiler';

interface Ancla {
  alias: string;
  condiciones: CondicionesReduccion;
  esperado: number;
  porque: string;
}

const ANCLAS: Ancla[] = [
  {
    alias: 'FA32 larga estancia',
    condiciones: { regimen: 'larga_estancia', fechaFirma: '2023-05-01' },
    esperado: 60,
    porque: 'firmado 25 días antes de la Ley de Vivienda · régimen transitorio',
  },
  {
    alias: 'Sant Joan',
    condiciones: { regimen: 'larga_estancia', fechaFirma: '2022-01-01' },
    esperado: 60,
    porque: 'muy anterior a la Ley · mismo transitorio',
  },
  {
    alias: 'Carles Buigas',
    condiciones: { regimen: 'larga_estancia', fechaFirma: '2024-01-01', rehabilitada2a: true },
    esperado: 60,
    porque: 'ya bajo la Ley, pero rehabilitada en los 2 años previos · art. 23.2.c)',
  },
];

describe('anclas reales · IRPF 2024', () => {
  it.each(ANCLAS)('$alias → $esperado % · $porque', ({ condiciones, esperado }) => {
    expect(proponerReduccion(condiciones).porcentaje).toBe(esperado);
  });

  // El de Carles Buigas es el que más vale: la rama de rehabilitación no la
  // ejecutaba nadie hasta que el alta empezó a capturar la condición. Sin el
  // interruptor, ese contrato caería al 50 % general y se declararía de más.
  it('Carles Buigas sin la rehabilitación caería al 50 % · es la rama la que sube al 60', () => {
    const { rehabilitada2a, ...sinRehabilitar } = ANCLAS[2].condiciones;
    expect(rehabilitada2a).toBe(true);
    expect(proponerReduccion(sinRehabilitar).porcentaje).toBe(50);
    expect(proponerReduccion(ANCLAS[2].condiciones).porcentaje).toBe(60);
  });

  it('las tres coinciden en el 60 % por caminos distintos', () => {
    // Dos por la fecha y una por la obra: el mismo número, tres motivos.
    const motivos = ANCLAS.map((a) => proponerReduccion(a.condiciones).motivo);
    expect(motivos).toEqual([
      'transitorio_pre_2023',
      'transitorio_pre_2023',
      'rehabilitacion',
    ]);
  });
});
