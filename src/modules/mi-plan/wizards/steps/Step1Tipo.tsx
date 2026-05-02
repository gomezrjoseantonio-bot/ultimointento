import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoObjetivo.module.css';
import type { ObjetivoTipo } from '../../../../types/miPlan';

interface TipoDef {
  tipo: ObjetivoTipo;
  cardClass: string;
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  titulo: string;
  desc: string;
  ejemplo: React.ReactNode;
}

const TIPOS: TipoDef[] = [
  {
    tipo: 'acumular',
    cardClass: styles.tipoCardAcumular,
    Icon: Icons.Acumular,
    titulo: 'Acumular',
    desc: 'Reunir un importe en una cuenta o fondo · meta medible en € o meses de tesorería.',
    ejemplo: (
      <>
        Ej · <strong>colchón emergencia 24 meses</strong> ·{' '}
        <strong>ahorrar 80.000 € para próximo piso</strong>
      </>
    ),
  },
  {
    tipo: 'amortizar',
    cardClass: styles.tipoCardAmortizar,
    Icon: Icons.Amortizar,
    titulo: 'Amortizar',
    desc: 'Pagar un préstamo o hipoteca antes del plazo original · valor meta es 0 €.',
    ejemplo: (
      <>
        Ej · <strong>cancelar hipoteca CB15</strong> ·{' '}
        <strong>amortizar 50% préstamo SmartFlip</strong>
      </>
    ),
  },
  {
    tipo: 'comprar',
    cardClass: styles.tipoCardComprar,
    Icon: Icons.Comprar,
    titulo: 'Comprar',
    desc: 'Crecer cartera · medir por número de inmuebles o por valor total.',
    ejemplo: (
      <>
        Ej · <strong>10 pisos en cartera para 2030</strong> ·{' '}
        <strong>1 piso adicional zona Madrid</strong>
      </>
    ),
  },
  {
    tipo: 'reducir',
    cardClass: styles.tipoCardReducir,
    Icon: Icons.Reducir,
    titulo: 'Reducir',
    desc: 'Bajar un gasto · una métrica negativa · un ratio.',
    ejemplo: (
      <>
        Ej · <strong>bajar gastos personales mensuales un 15%</strong> ·{' '}
        <strong>reducir suscripciones a 50 €/mes</strong>
      </>
    ),
  },
];

interface Props {
  selected: ObjetivoTipo | undefined;
  onSelect: (tipo: ObjetivoTipo) => void;
}

const Step1Tipo: React.FC<Props> = ({ selected, onSelect }) => {
  const navigate = useNavigate();

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>01</span> ¿Qué tipo de objetivo es?
      </div>
      <div className={styles.stepSubText}>
        Selecciona el tipo que mejor describe tu meta. ATLAS calculará el progreso
        automáticamente desde tus inmuebles, contratos y cuentas.
      </div>

      <div className={styles.tipoGrid}>
        {TIPOS.map((t) => {
          const isSel = selected === t.tipo;
          const cls = [
            styles.tipoCard,
            t.cardClass,
            isSel ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={t.tipo}
              type="button"
              className={cls}
              onClick={() => onSelect(t.tipo)}
              aria-pressed={isSel}
            >
              <div className={styles.tipoCardCheck}>
                <Icons.Check size={10} strokeWidth={3} />
              </div>
              <div className={styles.tipoCardHd}>
                <div className={styles.tipoCardIcon}>
                  <t.Icon size={18} strokeWidth={1.8} />
                </div>
                <div className={styles.tipoCardTit}>{t.titulo}</div>
              </div>
              <div className={styles.tipoCardDesc}>{t.desc}</div>
              <div className={styles.tipoCardEg}>{t.ejemplo}</div>
            </button>
          );
        })}
      </div>

      <div className={styles.helpBox}>
        <strong>¿No encaja ningún tipo?</strong> Puedes usar <strong>Acumular</strong> con
        campo libre y describir la meta en el siguiente paso. Si la meta es Libertad
        financiera (renta pasiva cubre gastos), usa la pestaña{' '}
        <button
          type="button"
          className={styles.helpBoxLink}
          onClick={() => navigate('/mi-plan/libertad')}
        >
          Libertad financiera
        </button>{' '}
        · es un objetivo único del módulo y se gestiona aparte.
      </div>
    </div>
  );
};

export default Step1Tipo;
