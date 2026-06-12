/**
 * Pantalla 08 · Bloque nómina/autónomo · dos entradas honestas.
 *
 * FIX onboarding punto 6 · se elimina la doble vía falsa: antes "Completar lo
 * detectado" y "Desde cero" abrían EL MISMO wizard (sin aceleración real) y
 * salían del flujo a `/personal/nomina/nueva`. Ahora hay dos entradas REALES y
 * distintas · Nómina y Autónomo · y cada una abre su wizard real EMBEBIDO sobre
 * el onboarding (P1 + P2). La de nómina sale pre-rellenada si la detección de
 * extractos encontró un abono periódico (P3) · si no, en blanco · mismo form.
 * Al guardar se cierra el bucle (P4): se marca el bloque, sube el % y se
 * enciende el IRPF estimado (derivado · al haber renta de trabajo/actividad la
 * estimación en curso deja de mostrar "—"). Autónomo = rendimiento + M130 · NO
 * IVA. El wizard queda intacto · solo aprende a abrirse embebido y volver.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import { useOnboarding } from '../OnboardingContext';
import NominaPage from '../../../../pages/GestionPersonal/wizards/NominaPage';
import AutonomoWizard from '../../../../pages/GestionPersonal/wizards/AutonomoWizard';
import {
  detectarSugerencias,
  type Sugerencia,
  type NominaPrefill,
} from '../../../../services/onboardingDetectionService';
import styles from '../empezar.module.css';

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type Modo = 'elegir' | 'nomina' | 'autonomo';

const NominaBloque: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setBloque, refresh } = useOnboarding();
  const [modo, setModo] = useState<Modo>('elegir');
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

  // P4 · cierre del bucle · guardar (nómina o autónomo) marca el bloque, sube
  // el % y enciende el IRPF estimado (derivado · al haber renta de trabajo o
  // actividad la estimación en curso deja de estar apagada) y vuelve al flujo.
  const cerrarBloque = async () => {
    await setBloque('nomina', 'completado');
    await refresh();
    navigate('/empezar/hub');
  };

  const volverAElegir = () => setModo('elegir');

  if (modo === 'nomina') {
    return (
      <NominaPage
        prefill={
          prefill
            ? { neto: prefill.neto, dia: prefill.dia, cuentaId: prefill.cuentaId, empresa: prefill.pagador }
            : undefined
        }
        onSaved={cerrarBloque}
        onCancel={volverAElegir}
      />
    );
  }

  if (modo === 'autonomo') {
    return <AutonomoWizard onSaved={cerrarBloque} onCancel={volverAElegir} />;
  }

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
          Icon={Icons.Banknote}
          title="Nómina"
          desc={
            prefill ? (
              <>
                Atlas vio un abono periódico "{prefill.pagador}" · <span className={styles.mono}>{eur(prefill.neto)}</span>{' '}
                netos el día {prefill.dia}. El wizard sale pre-rellenado · tú añades bruto · pagas · retención.
              </>
            ) : (
              'Bruto · nº de pagas · retención · pagas extra · variables · plan de pensiones y especie. Con tu recibo de nómina delante son unos minutos.'
            )
          }
          items={['Vista previa mes a mes con el neto en tu cuenta', 'Si aportas a plan de pensiones · se vincula aquí']}
          time={prefill ? '5 min · enciende el IRPF estimado' : '10 min · enciende el IRPF estimado'}
          onClick={() => setModo('nomina')}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Autónomo"
          desc="Tu actividad por cuenta propia · Atlas solo necesita tu rendimiento y tus pagos a cuenta (M130) porque alimentan tu declaración de la renta."
          items={['Rendimiento estimado y pagos M130', 'Cuota de autónomos · gastos deducibles']}
          time="10 min · enciende el IRPF estimado"
          onClick={() => setModo('autonomo')}
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
