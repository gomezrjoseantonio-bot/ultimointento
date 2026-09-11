// §4.5 prerrellenada · la ficha con la que NACE un movimiento desde el extracto:
// desde una línea sin cuadre («Crear movimiento») o desde varias elegidas
// («Clasificar las N como…»). Sacada del drawer para que no pase de 800 líneas
// (trinquete): aquí solo vive el prerrellenado; guardar y cerrar los decide él.

import React from 'react';
import type { Account } from '../../../services/db';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import type { LineaExtracto } from './extractoSesion';

interface FichaDeCreacionProps {
  /** Línea para la que se ha abierto la ficha con "Crear movimiento". */
  creando: LineaExtracto | null;
  /** Las elegidas que se van a clasificar de un gesto · la ficha se abre UNA vez. */
  clasificandoVarias: LineaExtracto[] | null;
  cuentaActiva: Account | null;
  cuentas: Account[];
  inmuebles: Array<{ id: number; alias: string }>;
  tarjetas: Array<{ id: number; alias: string }>;
  onCerrar: () => void;
  onGuardar: (v: GuardadoFicha) => void | Promise<void>;
}

const FichaDeCreacion: React.FC<FichaDeCreacionProps> = ({
  creando,
  clasificandoVarias,
  cuentaActiva,
  cuentas,
  inmuebles,
  tarjetas,
  onCerrar,
  onGuardar,
}) => (
  <FichaMovimiento
    abierta={creando != null || clasificandoVarias != null}
    esEdicion={false}
    inicial={
      creando
        ? {
            tipo: creando.importe >= 0 ? 'ingreso' : 'gasto',
            concepto: creando.textoBanco,
            importe: creando.importe,
            fecha: creando.fecha,
            cuentaId: cuentaActiva?.id ?? null,
          }
        : clasificandoVarias?.length
          ? {
              // Se prellena con la primera para que el formulario no salga en
              // blanco; el importe y la fecha de cada una los pone
              // `valoresPorLinea` al guardar, no éstos.
              tipo: clasificandoVarias[0].importe >= 0 ? 'ingreso' : 'gasto',
              concepto: clasificandoVarias[0].textoBanco,
              importe: clasificandoVarias[0].importe,
              fecha: clasificandoVarias[0].fecha,
              cuentaId: cuentaActiva?.id ?? null,
            }
          : undefined
    }
    cuentas={cuentaActiva ? [cuentaActiva] : cuentas}
    inmuebles={inmuebles}
    tarjetas={tarjetas}
    onCerrar={onCerrar}
    onGuardar={onGuardar}
  />
);

export default FichaDeCreacion;
