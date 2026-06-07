/**
 * Pantalla 08 · Bloque nómina/autónomo · doble vía.
 * "Completar lo detectado" (wizard pre-rellenado desde la detección) vs
 * "Desde cero" (wizards existentes). Autónomo = rendimiento + M130 · NO IVA.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import {
  detectarSugerencias,
  type Sugerencia,
  type NominaPrefill,
} from '../../../../services/onboardingDetectionService';
import styles from '../empezar.module.css';

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const NominaBloque: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [detectada, setDetectada] = useState<Sugerencia | null>(
    (location.state as { prefill?: Sugerencia } | null)?.prefill ?? null,
  );

  useEffect(() => {
    if (detectada) return;
    let alive = true;
    void detectarSugerencias().then((sugs) => {
      const nomina = sugs.find((s) => s.tipo === 'nomina');
      if (alive && nomina) setDetectada(nomina);
    });
    return () => {
      alive = false;
    };
  }, [detectada]);

  const prefill = detectada?.prefill as NominaPrefill | undefined;

  return (
    <DobleViaLayout
      kick="Bloque · quién te paga a ti"
      title="Tu nómina o tu actividad"
      subtitle="Es lo que enciende tu IRPF estimado · sin esto Atlas no puede decirte cuánto te saldrá la declaración."
    >
      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge={detectada ? 'Detectado en tus extractos' : 'Recomendado'}
          Icon={Icons.Zap}
          title="Completar lo detectado"
          desc={
            prefill ? (
              <>
                Atlas vio un abono periódico "{prefill.pagador}" · <span className={styles.mono}>{eur(prefill.neto)}</span>{' '}
                netos el día {prefill.dia}. El wizard sale pre-rellenado · tú añades lo que el extracto no sabe.
              </>
            ) : (
              'Sube extractos en el bloque financiero · Atlas detectará tu nómina y pre-rellenará el wizard.'
            )
          }
          items={['Te falta · bruto anual · nº de pagas · retención', 'Si aportas a plan de pensiones · se vincula aquí']}
          time="5 min · enciende el IRPF estimado"
          onClick={() => navigate('/personal/nomina/nueva', detectada ? { state: { prefill: detectada } } : undefined)}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Desde cero · nómina o autónomo"
          desc="Sin extractos · los asistentes de siempre · con tu recibo de nómina delante son 10 minutos."
          items={['Nómina · bruto · pagas · retención · especies', 'Autónomo · rendimiento estimado y pagos M130']}
          time="10 min"
          onClick={() => navigate('/personal/nomina/nueva')}
        />
      </div>

      <div className={styles.sugEmptyNote} style={{ marginTop: 16 }}>
        ¿Autónomo? Atlas solo necesita tu rendimiento y tus pagos a cuenta (M130) porque alimentan tu declaración de
        la renta. Atlas no gestiona IVA ni otros modelos.
      </div>
    </DobleViaLayout>
  );
};

export default NominaBloque;
