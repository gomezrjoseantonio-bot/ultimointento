/**
 * Dispatcher de bloques · resuelve `:bloqueId` de la ruta a su pantalla.
 * El registro `BLOQUE_SCREENS` se va completando en los commits 4-6; los
 * bloques aún no construidos caen al placeholder.
 */
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BLOQUES_META } from '../bloquesConfig';
import BloquePlaceholder from './BloquePlaceholder';
import PersonaBloque from './PersonaBloque';
import InmueblesBloque from './InmueblesBloque';
import ContratosBloque from './ContratosBloque';
import CuentasBloque from './CuentasBloque';
import FinanzasBloque from './FinanzasBloque';
import type { BloqueId } from '../../../../services/onboardingProgressService';

/** Registro de pantallas reales por bloque. Se rellena en C4-C6. */
const BLOQUE_SCREENS: Partial<Record<BloqueId, React.ComponentType>> = {
  persona: PersonaBloque,
  inmuebles: InmueblesBloque,
  contratos: ContratosBloque,
  cuentas: CuentasBloque,
  finanzas: FinanzasBloque,
};

const BloqueScreen: React.FC = () => {
  const { bloqueId } = useParams<{ bloqueId: string }>();

  if (!bloqueId || !(bloqueId in BLOQUES_META)) {
    return <Navigate to="/empezar/hub" replace />;
  }

  const id = bloqueId as BloqueId;
  const Real = BLOQUE_SCREENS[id];
  return Real ? <Real /> : <BloquePlaceholder bloqueId={id} />;
};

export default BloqueScreen;
