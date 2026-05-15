/**
 * InmuebleFiscalHeader · breadcrumb + título + pill + meta-line.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.2.
 */

import React from 'react';
import type { Property } from '../../../services/db';
import type { DatosFiscalesEjercicio } from '../../../services/fiscalResolverService';
import styles from './FiscalEjercicioPage.module.css';

export interface InmuebleFiscalHeaderProps {
  property: Property;
  año: number;
  estadoEjercicio: DatosFiscalesEjercicio['estado'];
  diasArrendado: number;
  diasDisposicion: number;
  numHabitaciones?: number;
  numContratos?: number;
  esPrescrito?: boolean;
  onBack: () => void;
  onGoDashboard: () => void;
  onGoEjercicio: () => void;
}

function pillFor(
  estado: DatosFiscalesEjercicio['estado'],
  esPrescrito?: boolean,
): { label: string; cls: string } {
  if (esPrescrito) return { label: 'Prescrito', cls: styles.pillPrescrito };
  if (estado === 'en_curso') return { label: 'En curso', cls: styles.pillCurso };
  if (estado === 'pendiente') return { label: 'Pendiente declarar', cls: styles.pillPendiente };
  return { label: 'Declarado', cls: styles.pillDeclarado };
}

const InmuebleFiscalHeader: React.FC<InmuebleFiscalHeaderProps> = ({
  property,
  año,
  estadoEjercicio,
  diasArrendado,
  diasDisposicion,
  numHabitaciones,
  numContratos,
  esPrescrito,
  onBack,
  onGoDashboard,
  onGoEjercicio,
}) => {
  const pill = pillFor(estadoEjercicio, esPrescrito);
  const titulo = `${property.alias}${property.address ? ` · ${property.address}` : ''} · ${año}`;
  const rc = property.cadastralReference ?? '';
  const habitaciones = property.bedrooms ?? numHabitaciones;
  const diasInfo: string[] = [];
  if (diasArrendado > 0) diasInfo.push(`${diasArrendado} días arrendado`);
  if (diasDisposicion > 0) diasInfo.push(`${diasDisposicion} días disposición`);
  const contratos = numContratos && numContratos > 0
    ? `${numContratos} contrato${numContratos === 1 ? '' : 's'}`
    : null;

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ‹ Volver al ejercicio
        </button>
        <button type="button" onClick={onGoDashboard}>Fiscal</button>
        <span className={styles.breadcrumbSep}>›</span>
        <button type="button" onClick={onGoEjercicio}>{año}</button>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>{property.alias}</span>
      </nav>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageHeadTitle}>
            {titulo}
            <span className={`${styles.pill} ${pill.cls}`}>{pill.label}</span>
          </h1>
          <div className={styles.metaLine}>
            {rc && (
              <span className={styles.mono}>RC {rc}</span>
            )}
            {diasInfo.length > 0 && (
              <>
                {rc && <span className={styles.metaDot} />}
                <span>
                  <strong>{diasArrendado} días</strong>{' '}
                  {diasArrendado === diasArrendado + diasDisposicion || diasDisposicion === 0
                    ? 'arrendado'
                    : 'arrendado'}
                  {contratos && ` · ${contratos}`}
                </span>
              </>
            )}
            {typeof habitaciones === 'number' && habitaciones > 0 && (
              <>
                <span className={styles.metaDot} />
                <span>{habitaciones} habitaciones</span>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default InmuebleFiscalHeader;
