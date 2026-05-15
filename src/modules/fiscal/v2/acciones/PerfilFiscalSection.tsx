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
    partes.push(personal.tributacion === 'conjunta' ? 'Tributación conjunta' : 'Tributación individual');
    const desc = personal.descendientes ?? [];
    if (desc.length > 0) partes.push(`${desc.length} descendiente${desc.length === 1 ? '' : 's'}`);
    else partes.push('sin descendientes');
    const asc = personal.ascendientes ?? [];
    if (asc.length > 0) partes.push(`${asc.length} ascendiente${asc.length === 1 ? '' : 's'}`);
    return partes.join(' · ');
  })();

  const ccaa = personal?.comunidadAutonoma ?? '—';

  // `situacionLaboral` es `SituacionLaboral[]` según types/personal.ts ·
  // mantenemos guarda runtime por si datos legacy llegan como string.
  const situacionLaboralArr = (() => {
    if (!personal) return [];
    const sl: unknown = personal.situacionLaboral;
    if (Array.isArray(sl)) return sl.map((s) => String(s));
    if (typeof sl === 'string' && sl.length > 0) return [sl];
    return [];
  })();

  const situacionLaboral = situacionLaboralArr.length > 0
    ? situacionLaboralArr.join(' + ')
    : '—';

  const modelosActivos = (() => {
    if (!personal) return '100';
    const labels = situacionLaboralArr.map((s) => s.toLowerCase()).join(' ');
    const modelos = ['100'];
    if (labels.includes('autonomo')) {
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
