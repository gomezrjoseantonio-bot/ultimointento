// T23.3 · `<FichaPosicionPage>` dispatcher por grupo de tipo (§ 4.2 spec).
//
// Carga la posición desde el store y delega el render a la ficha
// correspondiente según `clasificarTipo(posicion.tipo)`. Reusa los
// modales existentes (`ActualizarValorDialog` · `AportacionFormDialog` ·
// `PosicionFormDialog`) y añade `<RegistrarCobroDialog>` para los flujos
// de cobro / dividendo (que el form de aportaciones existente no
// soporta). Cero migración · cero cambios al modelo de datos.
//
// T23.6.1 · dispatcher ampliado: si `posicionId` es un UUID (no entero) ·
// se trata de un plan de pensiones del store `planesPensiones` · muestra
// placeholder TODO hasta que T23.6.4 implemente la ficha completa.
//
// T23.6.2 · CintaResumenInversiones sticky añadida en la parte superior.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToastV5 } from '../../../design-system/v5';
import { inversionesService } from '../../../services/inversionesService';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import AportarModal from '../components/modal/AportarModal';
import ActualizarValoracionModal from '../components/modal/ActualizarValoracionModal';
import EditarPosicionModal from '../components/modal/EditarPosicionModal';
import VenderModal from '../components/modal/VenderModal';
import RegistrarCobroDialog from '../components/RegistrarCobroDialog';
import FichaValoracionSimple from '../components/FichaValoracionSimple';
import FichaRendimientoPeriodico from '../components/FichaRendimientoPeriodico';
import FichaDividendos from '../components/FichaDividendos';
import FichaGenerica from '../components/FichaGenerica';
import FichaPlanPensiones from './FichaPlanPensiones';
import { clasificarTipo } from '../helpers';
import { inversionToCartaItem } from '../types/cartaItem';
import styles from './FichaPosicion.module.css';

type CobroVariant = 'cobro' | 'dividendo';

const FichaPosicionPage: React.FC = () => {
  const { posicionId } = useParams();
  const navigate = useNavigate();
  const [posicion, setPosicion] = useState<PosicionInversion | null | undefined>(
    undefined,
  );

  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [showAportar, setShowAportar] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [showVender, setShowVender] = useState(false);
  const [showCobro, setShowCobro] = useState<CobroVariant | null>(null);

  const idNumber = Number(posicionId);
  // T23.6.1 · UUID detection: a valid inversiones ID is a positive integer string.
  // UUIDs from planesPensiones are non-numeric strings (e.g. "abc-xyz-...").
  // Using strict round-trip check: !NaN + positive + String(parsed) === original.
  const isNumericId =
    !Number.isNaN(idNumber) && idNumber > 0 && String(idNumber) === posicionId;
  const esPlanPensiones = posicionId != null && posicionId !== '' && !isNumericId;

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
    // No cargar posición de inversiones si es un plan de pensiones (UUID)
    if (esPlanPensiones) return;
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
  }, [idNumber, esPlanPensiones]);

  const handleBack = () => navigate('/inversiones');

  // T23.6.4 · Ficha completa de plan de pensiones · reemplaza placeholder T23.6.1
  if (esPlanPensiones) {
    return <FichaPlanPensiones planId={posicionId!} onBack={handleBack} />;
  }

  const handleSaveValor = async (nuevoValor: number, fechaISO: string) => {
    if (!posicion) return;
    try {
      await inversionesService.updatePosicion(posicion.id, {
        valor_actual: nuevoValor,
        fecha_valoracion: `${fechaISO}T12:00:00.000Z`,
      });
      showToastV5('Valor actualizado.');
      setShowActualizarValor(false);
      await reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] actualizar valor', err);
      showToastV5('Error al actualizar el valor.');
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
      setShowCobro(null);
      // Nota · NO disparamos `rendimientosService.generarRendimientosPendientes()`
      // aquí · es un side-effect global (recorre todas las posiciones · puede
      // generar movimientos de tesorería). La galería ya lo ejecuta al cargar
      // si hay rendimientos pendientes; aquí basta con refrescar la posición.
      await reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] aportacion', err);
      showToastV5('Error al guardar el movimiento.');
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
      // Relanzamos para que el wizard/form mantenga el dialog abierto · su
      // contrato (ver `WizardNuevaPosicion`) sí maneja la promesa.
      throw err;
    }
  };

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

  const cartaItem = useMemo(() => inversionToCartaItem(posicion), [posicion]);
  const grupo = clasificarTipo(posicion.tipo);

  let ficha: React.ReactNode;
  switch (grupo) {
    case 'valoracion_simple':
      ficha = (
        <FichaValoracionSimple
          posicion={posicion}
          onBack={handleBack}
          onActualizarValor={() => setShowActualizarValor(true)}
          onAportar={() => setShowAportar(true)}
          onEditar={() => setShowEditar(true)}
        />
      );
      break;
    case 'rendimiento_periodico':
      ficha = (
        <FichaRendimientoPeriodico
          posicion={posicion}
          onBack={handleBack}
          onRegistrarCobro={() => setShowCobro('cobro')}
          onEditar={() => setShowEditar(true)}
        />
      );
      break;
    case 'dividendos':
      ficha = (
        <FichaDividendos
          posicion={posicion}
          onBack={handleBack}
          onRegistrarDividendo={() => setShowCobro('dividendo')}
          // PR 4 · "comprar/vender" abre `VenderModal` (flujo de venta con
          // FIFO en vivo). El alta de compra adicional sigue por Aportar.
          onComprarVender={() => setShowVender(true)}
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
          onAportar={() => setShowAportar(true)}
          onEditar={() => setShowEditar(true)}
        />
      );
  }

  const nombrePosicion = posicion.nombre || posicion.entidad || `Posición #${posicion.id}`;

  return (
    <>
      {ficha}

      {showActualizarValor && (
        <ActualizarValoracionModal
          posicion={cartaItem}
          onSave={handleSaveValor}
          onClose={() => setShowActualizarValor(false)}
        />
      )}

      {showAportar && (
        <AportarModal
          posicion={cartaItem}
          onSaveInversion={async (_pos, aportacion) => handleSaveAportacion(aportacion)}
          onClose={() => setShowAportar(false)}
        />
      )}

      {showVender && (
        <VenderModal
          posicion={posicion}
          onSave={handleSaveAportacion}
          onClose={() => setShowVender(false)}
        />
      )}

      {showCobro && (
        <RegistrarCobroDialog
          posicionNombre={nombrePosicion}
          variante={showCobro}
          onSave={handleSaveAportacion}
          onClose={() => setShowCobro(null)}
        />
      )}

      {showEditar && (
        <EditarPosicionModal
          posicion={cartaItem}
          onSave={async ({ nombre, entidad, notas }) => {
            await handleSavePosicion({ nombre, entidad, notas });
          }}
          onDelete={async () => {
            try {
              await inversionesService.deletePosicion(posicion.id);
              showToastV5('Posición eliminada.');
              navigate('/inversiones');
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[inversiones] eliminar', err);
              showToastV5('Error al eliminar la posición.');
            }
          }}
          onClose={() => setShowEditar(false)}
        />
      )}
    </>
  );
};

export default FichaPosicionPage;
