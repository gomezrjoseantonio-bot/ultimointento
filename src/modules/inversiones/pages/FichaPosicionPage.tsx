// T23.3 · `<FichaPosicionPage>` dispatcher por grupo de tipo (§ 4.2 spec).
//
// Carga la posición desde el store y delega el render a la ficha
// correspondiente según `clasificarTipo(posicion.tipo)`. Reusa los
// modales existentes (`ActualizarValorDialog` · `AportacionFormDialog` ·
// `PosicionFormDialog`) para no duplicar formularios. Cero migración ·
// cero cambios al modelo de datos.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToastV5 } from '../../../design-system/v5';
import { inversionesService } from '../../../services/inversionesService';
import { rendimientosService } from '../../../services/rendimientosService';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import ActualizarValorDialog from '../components/ActualizarValorDialog';
import AportacionFormDialog from '../components/AportacionFormDialog';
import PosicionFormDialog from '../components/PosicionFormDialog';
import FichaValoracionSimple from '../components/FichaValoracionSimple';
import FichaRendimientoPeriodico from '../components/FichaRendimientoPeriodico';
import FichaDividendos from '../components/FichaDividendos';
import FichaGenerica from '../components/FichaGenerica';
import { clasificarTipo } from '../helpers';
import styles from './FichaPosicion.module.css';

const FichaPosicionPage: React.FC = () => {
  const { posicionId } = useParams();
  const navigate = useNavigate();
  const [posicion, setPosicion] = useState<PosicionInversion | null | undefined>(
    undefined,
  );

  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [showAportar, setShowAportar] = useState(false);
  const [showEditar, setShowEditar] = useState(false);

  const idNumber = Number(posicionId);

  const reload = useCallback(async () => {
    if (!Number.isFinite(idNumber)) {
      setPosicion(null);
      return;
    }
    try {
      const p = await inversionesService.getPosicion(idNumber);
      setPosicion(p ?? null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] ficha · cargar posición', err);
      setPosicion(null);
    }
  }, [idNumber]);

  useEffect(() => {
    let cancelled = false;
    setPosicion(undefined);
    (async () => {
      if (!Number.isFinite(idNumber)) {
        if (!cancelled) setPosicion(null);
        return;
      }
      try {
        const p = await inversionesService.getPosicion(idNumber);
        if (!cancelled) setPosicion(p ?? null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[inversiones] ficha · cargar posición', err);
        if (!cancelled) setPosicion(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idNumber]);

  const handleBack = () => navigate('/inversiones');

  const handleSaveValor = async (nuevoValor: number, fechaValoracionISO: string) => {
    if (!posicion) return;
    try {
      await inversionesService.updatePosicion(posicion.id, {
        valor_actual: nuevoValor,
        fecha_valoracion: fechaValoracionISO,
      });
      showToastV5('Valor actualizado.');
      setShowActualizarValor(false);
      await reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] actualizar valor', err);
      showToastV5('Error al actualizar el valor.');
      throw err;
    }
  };

  const handleSaveAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!posicion) return;
    try {
      await inversionesService.addAportacion(posicion.id, aportacion);
      showToastV5(
        aportacion.tipo === 'dividendo'
          ? 'Cobro registrado.'
          : aportacion.tipo === 'reembolso'
            ? 'Reembolso registrado.'
            : 'Aportación añadida.',
      );
      setShowAportar(false);
      await rendimientosService.generarRendimientosPendientes();
      await reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] aportacion', err);
      showToastV5('Error al guardar el movimiento.');
      throw err;
    }
  };

  const handleSavePosicion = async (
    data: Partial<PosicionInversion> & { importe_inicial?: number },
  ) => {
    if (!posicion) return;
    try {
      await inversionesService.updatePosicion(posicion.id, data);
      showToastV5('Posición actualizada.');
      setShowEditar(false);
      await reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] save', err);
      showToastV5('Error al guardar la posición.');
      throw err;
    }
  };

  // El form de aportaciones existente sólo soporta `aportacion`/`reembolso` ·
  // los cobros/dividendos se introducen seleccionando el tipo dentro del
  // form (sin pre-fill desde aquí). Cuando 23.3+ amplíe el form a
  // dividendos podremos pre-rellenar el tipo según el botón.
  const openAportar = () => setShowAportar(true);

  if (posicion === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando posición…</div>
      </div>
    );
  }

  if (posicion === null) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <div>No se ha encontrado la posición solicitada.</div>
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            Volver a Inversiones
          </button>
        </div>
      </div>
    );
  }

  const grupo = clasificarTipo(posicion.tipo);

  let ficha: React.ReactNode;
  switch (grupo) {
    case 'valoracion_simple':
      ficha = (
        <FichaValoracionSimple
          posicion={posicion}
          onBack={handleBack}
          onActualizarValor={() => setShowActualizarValor(true)}
          onAportar={() => openAportar()}
          onEditar={() => setShowEditar(true)}
        />
      );
      break;
    case 'rendimiento_periodico':
      ficha = (
        <FichaRendimientoPeriodico
          posicion={posicion}
          onBack={handleBack}
          onRegistrarCobro={() => openAportar()}
          onEditar={() => setShowEditar(true)}
        />
      );
      break;
    case 'dividendos':
      ficha = (
        <FichaDividendos
          posicion={posicion}
          onBack={handleBack}
          onRegistrarDividendo={() => openAportar()}
          onComprarVender={() => openAportar()}
          onActualizarValor={() => setShowActualizarValor(true)}
        />
      );
      break;
    default:
      ficha = (
        <FichaGenerica
          posicion={posicion}
          onBack={handleBack}
          onActualizarValor={() => setShowActualizarValor(true)}
          onAportar={() => openAportar()}
          onEditar={() => setShowEditar(true)}
        />
      );
  }

  return (
    <>
      {ficha}

      {showActualizarValor && (
        <ActualizarValorDialog
          posicionNombre={posicion.nombre || posicion.entidad || `Posición #${posicion.id}`}
          valorActual={posicion.valor_actual}
          onSave={handleSaveValor}
          onClose={() => setShowActualizarValor(false)}
        />
      )}

      {showAportar && (
        <AportacionFormDialog
          posicionNombre={posicion.nombre || posicion.entidad || `Posición #${posicion.id}`}
          posicion={posicion}
          onSave={handleSaveAportacion}
          onClose={() => setShowAportar(false)}
        />
      )}

      {showEditar && (
        <PosicionFormDialog
          posicion={posicion}
          onSave={handleSavePosicion}
          onClose={() => setShowEditar(false)}
        />
      )}
    </>
  );
};

export default FichaPosicionPage;
