// Lo que se confirma en el bloque fiscal tiene que llegar a la declaración.
//
// El agujero que cierra esta tarea: el alta a mano nunca capturaba las
// condiciones del art. 23.2, así que un contrato dado de alta en ATLAS se
// quedaba SIEMPRE en el 50 % general (o el 60 % transitorio por fecha) y no
// alcanzaba el 70 %, el 90 % ni el 60 % por rehabilitación aunque los cumpliera.
//
// Se prueba el camino entero: lo que el bloque emite → el payload que se guarda
// → lo que devuelve el lector fiscal, que es el número que acaba en la
// declaración.

import { construirPayloadCompleto, construirPayloadBorrador } from '../contratoWizardPayload';
import { emptyForm, type FormState } from '../contratoWizardHelpers';
import { calcularPorcentajeReduccionContrato } from '../../../../services/irpfCalculationService';
import type { DatosFiscalesContrato } from '../BloqueFiscalContrato';

const form = (extra?: Partial<FormState>): FormState => ({
  ...emptyForm,
  inmuebleId: 1,
  fechaInicio: '2026-08-15',
  fechaFin: '2031-08-14',
  inquilinoNombre: 'Adnan',
  inquilinoApellidos: 'Parwez Khan',
  inquilinoNif: '53069494F',
  inquilinoEmail: 'adnan@example.com',
  inquilinoTelefono: '600000000',
  rentaMensual: '500',
  diaPago: '1',
  fianzaMensualidades: '1',
  cuentaCobroId: '1',
  ...extra,
});

/** Lo que emite el bloque cuando el usuario confirma la propuesta. */
const confirmado = (
  porcentaje: number,
  motivo: NonNullable<DatosFiscalesContrato['reduccion']['motivo']>,
  condiciones: Partial<DatosFiscalesContrato> = {},
): DatosFiscalesContrato => ({
  reduccion: { activa: true, porcentaje, motivo },
  fechaFirmaContrato: '2026-08-15',
  primeraVez: false,
  zonaTensionada: false,
  inquilinoJoven: false,
  rebajaRenta5pct: false,
  rehabilitacion: false,
  ...condiciones,
});

const reduccionDelAlta = (extra?: Partial<FormState>): number => {
  const res = construirPayloadCompleto(form(extra));
  if (!res.ok) throw new Error(res.error);
  return calcularPorcentajeReduccionContrato(res.payload);
};

describe('el alta a mano ya llega a los tramos altos', () => {
  it('sin tocar el bloque se queda en el general · el techo de antes', () => {
    expect(reduccionDelAlta()).toBe(50);
  });

  it('primera vez + zona tensionada + inquilino joven → 70 %, no 50 %', () => {
    const pct = reduccionDelAlta({
      datosFiscales: confirmado(70, 'zona_tensionada_joven', {
        primeraVez: true,
        zonaTensionada: true,
        inquilinoJoven: true,
      }),
    });
    expect(pct).toBe(70);
  });

  it('había contrato anterior + tensionada + rebaja de más del 5 % → 90 %', () => {
    const pct = reduccionDelAlta({
      datosFiscales: confirmado(90, 'zona_tensionada_rebaja', {
        zonaTensionada: true,
        rebajaRenta5pct: true,
      }),
    });
    expect(pct).toBe(90);
  });

  it('rehabilitada en los 2 años previos → 60 %', () => {
    const pct = reduccionDelAlta({
      datosFiscales: confirmado(60, 'rehabilitacion', { rehabilitacion: true }),
    });
    expect(pct).toBe(60);
  });

  it('temporada → sin reducción, tributa por todo', () => {
    const pct = reduccionDelAlta({
      modalidad: 'media_estancia',
      datosFiscales: confirmado(0, 'sin_reduccion'),
    });
    expect(pct).toBe(0);
  });
});

describe('las condiciones viajan con el contrato, no solo el número', () => {
  it('el payload guarda qué justifica el porcentaje', () => {
    const res = construirPayloadCompleto(
      form({
        datosFiscales: confirmado(70, 'zona_tensionada_joven', {
          primeraVez: true,
          zonaTensionada: true,
          inquilinoJoven: true,
        }),
      }),
    );

    expect(res.ok).toBe(true);
    const p = res.ok ? (res.payload as Record<string, unknown>) : {};
    expect(p.reduccion).toEqual({
      activa: true,
      porcentaje: 70,
      motivo: 'zona_tensionada_joven',
    });
    expect(p.primeraVez).toBe(true);
    expect(p.zonaTensionada).toBe(true);
    expect(p.inquilinoJoven).toBe(true);
    expect(p.fechaFirmaContrato).toBe('2026-08-15');
  });

  it('un porcentaje fijado a mano queda marcado como tal', () => {
    // Ante una inspección importa saber si el número lo calculó ATLAS o lo puso
    // el arrendador.
    const res = construirPayloadCompleto(
      form({
        datosFiscales: {
          ...confirmado(60, 'general_post_2023'),
          reduccion: { activa: true, porcentaje: 60, motivo: 'general_post_2023', manual: true },
        },
      }),
    );

    const p = res.ok ? (res.payload as Record<string, unknown>) : {};
    expect((p.reduccion as { manual?: boolean }).manual).toBe(true);
    expect(calcularPorcentajeReduccionContrato(p)).toBe(60);
  });

  it('el borrador también lo conserva, para poder retomarlo', () => {
    const p = construirPayloadBorrador(
      form({
        datosFiscales: confirmado(90, 'zona_tensionada_rebaja', {
          zonaTensionada: true,
          rebajaRenta5pct: true,
        }),
      }),
    ) as Record<string, unknown>;

    expect(p.reduccion).toMatchObject({ activa: true, porcentaje: 90 });
    expect(p.zonaTensionada).toBe(true);
  });

  it('sin tocar el bloque no se inventa ningún campo fiscal', () => {
    const res = construirPayloadCompleto(form());
    const p = res.ok ? (res.payload as Record<string, unknown>) : {};
    expect(p.reduccion).toBeUndefined();
    expect(p.zonaTensionada).toBeUndefined();
    expect(p.primeraVez).toBeUndefined();
  });
});
