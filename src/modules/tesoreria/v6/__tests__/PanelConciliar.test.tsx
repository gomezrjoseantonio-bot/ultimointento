// La pantalla, montada de verdad.
//
// Los tests de `conciliarPantalla.test.ts` prueban las piezas puras; esto prueba
// que la pantalla las ENSEÑA. Es la clase de fallo que no da error en ninguna
// parte: una clase de CSS mal escrita deja el `className` en `undefined` y el
// bloque pierde su sitio sin que nada avise, y una prop que no se pasa deja un
// contador a cero que parece un dato.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
            101, // por lineaId (E1.5)
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

const clasificada = (id: number, extra: Partial<LineaExtracto> = {}): LineaExtracto =>
  linea(id, {
    clasificacion: {
      naturaleza: 'gasto', familia: 'comunidad', subtipo: 'cuota_mensual', metodo: 'domiciliacion', ambito: 'inmueble', inmuebleId: 4,
      origen: { naturaleza: 'concepto', familia: 'concepto', subtipo: 'concepto', metodo: 'concepto', ambito: 'concepto' }, motivos: [],
    },
    ...extra,
  });

describe('PanelConciliar · las tres zonas · lo que el usuario ve', () => {
  it('el hero dice la cuenta, el rango real y cuántos movimientos', () => {
    pintar({ necesitan: [linea(1, { fecha: '2026-01-05' }), linea(2, { fecha: '2026-08-30' })] });
    expect(screen.getByText('Santander · ****2715 · 124 líneas')).toBeInTheDocument();
    expect(screen.getByText(/desde el 5\/1\/2026 a 30\/8\/2026 · 2 movimientos/)).toBeInTheDocument();
    expect(screen.getByText('Conciliar extracto')).toBeInTheDocument();
  });

  it('el saldo del hero es el que dice el banco a la línea más reciente · y sin saldo no se inventa', () => {
    pintar({
      apertura: {
        extremos: {} as never, fecha: '2026-08-31', saldoBanco: 12480.55, saldoAtlas: 12480.55, descuadre: 0, cuadra: true,
        modo: 'ajuste', apertura: {} as never, aperturaActual: { saldo: 0, fecha: null }, proponer: false, saldoAtlasTrasAplicar: 0, cuadraTrasAplicar: true,
      } as never,
    });
    expect(screen.getByText('Saldo · 31 ago 2026')).toBeInTheDocument();
    expect(screen.getByText(/12\.480,55/)).toBeInTheDocument();
    pintar();
    expect(screen.getByText('el fichero no trae saldo')).toBeInTheDocument();
  });

  it('«Confirma el destino» cuenta ENTIDADES · y la tarjeta lleva la propuesta encima de la línea del banco', () => {
    pintar();
    expect(screen.getByText('Confirma el destino')).toBeInTheDocument();
    expect(screen.getByText('Parece un gasto de un piso')).toBeInTheDocument();
    expect(screen.getByText('se recordará')).toBeInTheDocument();
    // La línea del banco está DENTRO · plegada hasta que se abre la entidad.
    expect(screen.queryByText('línea 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /GESTIÓ I ADMINISTRACIÓ DE FINQUES/i }));
    expect(screen.getByText('línea 1')).toBeInTheDocument();
  });

  it('sin sugerencia para esa entidad sigue habiendo tarjeta · el chip «¿Qué es?» y nada más', () => {
    pintar({ propuestas: new Map() });
    expect(screen.getByText('¿Qué es?')).toBeInTheDocument();
  });

  it('una respuesta coloca TODOS los movimientos de la entidad · como el mockup: piso probable en oro · «Otro piso» = selector · «Personal»', () => {
    const enPiso = jest.fn();
    // Dos recibos de la misma comunidad · la misma contraparte · una entidad que
    // ya sabe QUÉ es (comunidad) pero no DE QUÉ PISO.
    const comunidad = (id: number, texto: string) =>
      clasificada(id, { textoBanco: texto, clasificacion: { naturaleza: 'gasto', familia: 'comunidad', subtipo: 'cuota_mensual', ambito: 'inmueble', origen: { naturaleza: 'concepto', familia: 'concepto', ambito: 'concepto' }, motivos: [] } });
    pintar({
      necesitan: [comunidad(1, 'GESTIO FINQUES 08/26'), comunidad(2, 'GESTIO FINQUES 09/26')],
      propuestas: new Map([[101, { tono: 'pregunta' as const, titular: 'Parece comunidad de un piso', ayuda: 'en tu declaración de 2025, comunidad es de Tenderina 64', seRecuerda: false, pisoProbable: { id: 4, alias: 'Tenderina 64' } }]]),
      inmuebles: [{ id: 4, alias: 'Tenderina 64' }, { id: 5, alias: 'Sant Joan 3' }, { id: 6, alias: 'Fuertes Acevedo 32' }],
      onClasificarVariasEnPiso: enPiso,
    });
    // UN botón con el piso probable · no uno por cada piso.
    expect(screen.getByRole('button', { name: /Tenderina 64/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sant Joan 3/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fuertes Acevedo 32/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tenderina 64/ }));
    expect(enPiso).toHaveBeenCalledWith([101, 102], 4);
    // «Otro piso» abre el selector y ahí se fija.
    fireEvent.click(screen.getByRole('button', { name: /Otro piso/ }));
    fireEvent.change(screen.getByRole('combobox', { name: /El piso de/ }), { target: { value: '5' } });
    expect(enPiso).toHaveBeenCalledWith([101, 102], 5);
    fireEvent.click(screen.getByRole('button', { name: /^Personal$/ }));
    expect(enPiso).toHaveBeenCalledWith([101, 102], null);
  });

  it('sin saber qué es · «Es personal» en oro, «Elegir categoría» abre la ficha, y nada de párrafos de ayuda', () => {
    const enPiso = jest.fn();
    const clasificar = jest.fn();
    pintar({ propuestas: new Map(), inmuebles: [{ id: 4, alias: 'Tenderina 64' }], onClasificarVariasEnPiso: enPiso, onClasificarVarias: clasificar });
    expect(screen.queryByText(/si subes la factura/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lo aplico a/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No sé qué es/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Es personal/ }));
    expect(enPiso).toHaveBeenCalledWith([101], null);
    fireEvent.click(screen.getByRole('button', { name: /Elegir categoría/ }));
    expect(clasificar).toHaveBeenCalledWith([101]);
  });

  it('ni banda ámbar de saldo ni «cuadra con un previsto» · el cuadre con el banco no se pinta aquí', () => {
    pintar({
      apertura: {
        extremos: {} as never, fecha: '2026-08-31', saldoBanco: 12480.55, saldoAtlas: 11000, descuadre: 1480.55, cuadra: false,
        modo: 'ajuste', apertura: {} as never, aperturaActual: { saldo: 0, fecha: null }, proponer: true, saldoAtlasTrasAplicar: 0, cuadraTrasAplicar: true,
      } as never,
    });
    expect(screen.queryByTestId('cuadre-banco')).not.toBeInTheDocument();
    expect(screen.queryByText(/fijar mi saldo de apertura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cuadra con un previsto/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/Todavía no reconozco nada de esta cuenta/)).toBeInTheDocument();
  });

  it('las ignoradas se pueden reactivar · nada se aparta sin vuelta atrás', () => {
    pintar({ ignoradas: [linea(9)] });
    expect(screen.getByText('reactivar')).toBeInTheDocument();
  });

  it('sin nada que preguntar, lo dice en vez de dejar la zona muerta', () => {
    pintar({ necesitan: [] });
    expect(screen.getByText(/Nada que preguntarte/)).toBeInTheDocument();
  });
});

describe('«Colocado en su sitio» · visto bueno en bloque y por entidad (P2 · no escribe)', () => {
  const colocadas = [
    clasificada(1, { textoBanco: 'COMUNIDAD TENDERINA 08/26', importe: -80.26 }),
    clasificada(2, { textoBanco: 'COMUNIDAD TENDERINA 07/26', importe: -80.26 }),
    clasificada(3, { textoBanco: 'AQUALIA AGUA 3T', importe: -43, clasificacion: { naturaleza: 'gasto', familia: 'suministro', subtipo: 'agua', ambito: 'inmueble', inmuebleId: 4, origen: { naturaleza: 'concepto', familia: 'concepto', ambito: 'concepto' }, motivos: [] } }),
  ];

  it('enseña las entidades con sus ejes y su piso · e importe en tinta', () => {
    pintar({ resueltas: colocadas, inmuebles: [{ id: 4, alias: 'Tenderina 64' }] });
    expect(screen.getByText('Colocado en su sitio')).toBeInTheDocument();
    expect(screen.getByText(/ATLAS colocó/)).toBeInTheDocument();
    expect(screen.getByText(/3 movimientos en 2 entidades/)).toBeInTheDocument();
    expect(screen.getByText('Tenderina 64 · Gasto · Comunidad · Cuota mensual · domiciliación · 01/08/26')).toBeInTheDocument();
    expect(screen.getByText('2 recibos')).toBeInTheDocument();
  });

  it('«OK» retira la entidad de la lista · y se puede deshacer · sin escribir nada', () => {
    const guardar = jest.fn();
    pintar({ resueltas: colocadas, onGuardar: guardar });
    fireEvent.click(screen.getByRole('button', { name: /OK · COMUNIDAD TENDERINA/i }));
    expect(screen.queryByRole('button', { name: /OK · COMUNIDAD TENDERINA/i })).not.toBeInTheDocument();
    expect(screen.getByText(/1 entidad dada por buena/)).toBeInTheDocument();
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }));
    expect(screen.getByRole('button', { name: /OK · COMUNIDAD TENDERINA/i })).toBeInTheDocument();
  });

  it('«Está todo bien · confirmar» las da todas por buenas y destaca Guardar · pero NO guarda solo', () => {
    const guardar = jest.fn();
    pintar({ necesitan: [], resueltas: colocadas, onGuardar: guardar });
    fireEvent.click(screen.getByRole('button', { name: /Está todo bien · confirmar/ }));
    expect(screen.queryByText(/ATLAS colocó/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 entidades dadas por buenas/)).toBeInTheDocument();
    expect(screen.getByText(/Todo confirmado · guarda y esta cuenta queda conciliada/)).toBeInTheDocument();
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Guardar extracto/ }));
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('los internos van en su entidad · «no cuenta como gasto ni ingreso» · sin cifra coloreada', () => {
    const ahorro = clasificada(7, { textoBanco: 'AHORROS', importe: -800, clasificacion: { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', ambito: 'personal', origen: { naturaleza: 'concepto', familia: 'concepto', ambito: 'defecto' }, motivos: [] } });
    pintar({ resueltas: [ahorro] });
    expect(screen.getByText(/movimiento interno · no cuenta como gasto ni ingreso/)).toBeInTheDocument();
    expect(screen.getByText('neutro')).toBeInTheDocument();
  });
});
