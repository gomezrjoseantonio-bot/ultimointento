/**
 * Pantalla 05 · Bloque financiero · doble vía (combinables cuenta a cuenta).
 * Vía A · subir extractos (importador universal) → Atlas deduce (sugerencias).
 * Vía B · declarar a mano · enlaces a las altas existentes.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import styles from '../empezar.module.css';

const FinanzasBloque: React.FC = () => {
  const navigate = useNavigate();
  return (
    <DobleViaLayout
      kick="Tu vida financiera · recurrentes · préstamos · nómina"
      title="¿Cómo quieres contárselo a Atlas?"
      subtitle="Dos vías · combinables cuenta a cuenta. Sube extractos de las cuentas que quieras y declara a mano el resto."
    >
      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge="Acelerador"
          Icon={Icons.Zap}
          title="Sube extractos · Atlas deduce"
          desc="De las cuentas que elijas · Atlas detecta recurrentes · cuotas de préstamo y nómina · y te los propone para confirmar."
          items={[
            'Empieza por tus 2-3 cuentas principales',
            'Saldo real de cada cuenta · solo',
            'Nunca crea nada sin tu confirmación',
          ]}
          time="5 min por cuenta · te ahorra ~25 min de tecleo"
          onClick={() => navigate('/empezar/sugerencias')}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Declarar a mano"
          desc="Sin ficheros · das de alta tus recurrentes · préstamos y nómina con los formularios de siempre."
          items={[
            'Ideal si tienes muchas cuentas y pocos cargos',
            'Cuentas declaradas con saldo de hoy a mano',
            'Los extractos podrás subirlos cuando quieras',
          ]}
          time="15-30 min según tu caso"
          onClick={() => {
            showToastV5('Elige el bloque · préstamos · nómina · o cuentas', 'info');
            navigate('/empezar/hub');
          }}
        />
      </div>

      <button
        type="button"
        className={styles.btnGhost}
        style={{ marginTop: 16 }}
        onClick={() => navigate('/tesoreria/importar')}
      >
        <Icons.Upload size={14} strokeWidth={2} /> Subir extractos bancarios
      </button>

      <div className={styles.sugEmptyNote} style={{ marginTop: 16 }}>
        ¿Tienes 10 cuentas? No hace falta subirlas todas hoy · cada cuenta queda marcada en el semáforo como
        "con extracto" o "declarada a mano" · y puedes mejorarla después.
      </div>
    </DobleViaLayout>
  );
};

export default FinanzasBloque;
