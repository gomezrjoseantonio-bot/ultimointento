/**
 * Bloque 1 · Perfil fiscal · LECTURA + link a Ajustes general.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { personalDataService } from '../../../../services/personalDataService';
import type { PersonalData } from '../../../../types/personal';
import styles from '../FiscalAccionesPage.module.css';

const PerfilFiscalSection: React.FC = () => {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<PersonalData | null>(null);

  useEffect(() => {
    personalDataService.getPersonalData().then((d) => setPersonal(d ?? null)).catch(() => setPersonal(null));
  }, []);

  const situacionPersonal = (() => {
    if (!personal) return '—';
    const partes: string[] = [];
    const tributacion = (personal as any).tributacion;
    partes.push(tributacion === 'conjunta' ? 'Tributación conjunta' : 'Tributación individual');
    const desc = (personal as any).descendientes ?? [];
    if (Array.isArray(desc) && desc.length > 0) partes.push(`${desc.length} descendiente${desc.length === 1 ? '' : 's'}`);
    else partes.push('sin descendientes');
    const asc = (personal as any).ascendientes ?? [];
    if (Array.isArray(asc) && asc.length > 0) partes.push(`${asc.length} ascendiente${asc.length === 1 ? '' : 's'}`);
    return partes.join(' · ');
  })();

  const ccaa = (() => {
    if (!personal) return '—';
    const region = (personal as any).comunidadAutonoma ?? (personal as any).codigoCCAA ?? null;
    return region ?? '—';
  })();

  const situacionLaboral = (() => {
    if (!personal) return '—';
    const sl = (personal as any).situacionLaboral;
    if (typeof sl === 'string') return sl;
    if (Array.isArray(sl)) return sl.join(' + ');
    return '—';
  })();

  const modelosActivos = (() => {
    if (!personal) return '100';
    const sl = String((personal as any).situacionLaboral ?? '').toLowerCase();
    const modelos = ['100'];
    if (sl.includes('autonomo')) {
      modelos.push('130');
      modelos.push('303');
    }
    // Modelo 184 (entidades en atribución) · siempre se asume potencial
    modelos.push('184');
    return modelos.join(' · ');
  })();

  return (
    <>
      <div className={styles.perfilGrid}>
        <div>
          <div className={styles.perfilLab}>Situación personal</div>
          <div className={styles.perfilVal}>{situacionPersonal}</div>
        </div>
        <div>
          <div className={styles.perfilLab}>Comunidad autónoma</div>
          <div className={styles.perfilVal}>{ccaa}</div>
        </div>
        <div>
          <div className={styles.perfilLab}>Situación laboral</div>
          <div className={styles.perfilVal}>{situacionLaboral}</div>
        </div>
        <div>
          <div className={styles.perfilLab}>Modelos activos</div>
          <div className={styles.perfilVal}>{modelosActivos}</div>
        </div>
      </div>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => navigate('/ajustes/fiscal')}
      >
        Editar perfil →
      </button>
    </>
  );
};

export default PerfilFiscalSection;
