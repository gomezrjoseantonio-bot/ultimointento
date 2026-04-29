import React from 'react';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import SetRow from '../components/SetRow';
import containerStyles from '../AjustesPage.module.css';
import styles from './PlantillasPage.module.css';

type IconKind = 'contrato' | 'email' | 'formula';

interface Plantilla {
  key: string;
  iconKind: IconKind;
  icon: React.ReactNode;
  name: string;
  meta: string;
  badge?: 'default' | 'active';
  badgeLabel?: string;
}

const Row: React.FC<{ tpl: Plantilla }> = ({ tpl }) => (
  <div className={styles.row}>
    <div className={`${styles.icon} ${styles[tpl.iconKind]}`}>{tpl.icon}</div>
    <div className={styles.info}>
      <div className={styles.name}>{tpl.name}</div>
      <div className={styles.meta}>{tpl.meta}</div>
    </div>
    {tpl.badge ? (
      <Pill variant={tpl.badge === 'default' ? 'brand' : 'gold'} asTag>
        {tpl.badgeLabel}
      </Pill>
    ) : (
      <span />
    )}
    <SetRow.Link onClick={() => showToastV5(`Editar plantilla · ${tpl.name}`)}>
      Editar
    </SetRow.Link>
  </div>
);

const contratos: Plantilla[] = [
  {
    key: 'vivienda',
    iconKind: 'contrato',
    icon: <Icons.Contratos size={14} strokeWidth={1.8} />,
    name: 'Vivienda habitual · 5 años · IPC',
    meta:
      '7 cláusulas · LAU 1994 · revisión IPC anual · fianza 2 mensualidades · usado en 4 contratos',
    badge: 'default',
    badgeLabel: 'Por defecto',
  },
  {
    key: 'habitacion',
    iconKind: 'contrato',
    icon: <Icons.Contratos size={14} strokeWidth={1.8} />,
    name: 'Habitación · estudiantes',
    meta:
      '9 cláusulas · 9 meses curso académico · sin IPC · zonas comunes detalladas · usado en 3 contratos',
  },
  {
    key: 'turistico',
    iconKind: 'contrato',
    icon: <Icons.Contratos size={14} strokeWidth={1.8} />,
    name: 'Turístico · corta estancia',
    meta:
      '12 cláusulas · LAU temporada · alta turística autonómica · IBI repercutido · sin uso',
  },
];

const correos: Plantilla[] = [
  {
    key: 'recordatorio',
    iconKind: 'email',
    icon: <Icons.Mail size={14} strokeWidth={1.8} />,
    name: 'Recordatorio de pago · cordial',
    meta:
      'tono educado · primer aviso a los 3 días de retraso · enviado 2 veces este año',
    badge: 'default',
    badgeLabel: 'Por defecto',
  },
  {
    key: 'ipc',
    iconKind: 'email',
    icon: <Icons.Mail size={14} strokeWidth={1.8} />,
    name: 'Aviso revisión IPC',
    meta:
      'comunica subida de renta con detalle del cálculo · 1 mes antes del aniversario · usado 4 veces',
  },
  {
    key: 'no-renov',
    iconKind: 'email',
    icon: <Icons.Mail size={14} strokeWidth={1.8} />,
    name: 'Notificación de no renovación',
    meta:
      'comunica que el contrato no se prorroga · 4 meses antes del vencimiento (LAU) · sin uso',
  },
];

const formulas: Plantilla[] = [
  {
    key: 'prorrateo-ing',
    iconKind: 'formula',
    icon: <Icons.Plus size={14} strokeWidth={1.8} />,
    name: 'Prorrateo destino mixto · ING T48',
    meta:
      '81,6% adquisición Buigas (deducible) · 18,4% cancelación deuda (no deducible) · aplicado 2024-2039',
    badge: 'active',
    badgeLabel: 'Activa',
  },
  {
    key: 'reduccion-60',
    iconKind: 'formula',
    icon: <Icons.Plus size={14} strokeWidth={1.8} />,
    name: 'Reducción 60% arrendamiento vivienda',
    meta:
      'contratos firmados antes 26/05/2023 · aplicada en Buigas · Sant Fruitós y Tenderina',
    badge: 'active',
    badgeLabel: 'Activa',
  },
  {
    key: 'amort-3',
    iconKind: 'formula',
    icon: <Icons.Plus size={14} strokeWidth={1.8} />,
    name: 'Amortización 3% capital construcción',
    meta:
      'cálculo automático sobre coste construcción de adquisición · ajustado tras paralela 2022 a Buigas',
    badge: 'active',
    badgeLabel: 'Activa',
  },
];

const PlantillasPage: React.FC = () => (
  <>
    <div className={containerStyles.contentHead}>
      <div>
        <h1 className={containerStyles.contentTitle}>Plantillas</h1>
        <div className={containerStyles.contentSub}>
          contratos · correos · fórmulas fiscales · evita rehacer lo mismo cada vez
        </div>
      </div>
      <button
        type="button"
        className={`${containerStyles.btn} ${containerStyles.btnGold}`}
        onClick={() => showToastV5('Crear nueva plantilla')}
      >
        <Icons.Plus size={14} strokeWidth={1.8} />
        Nueva plantilla
      </button>
    </div>

    <SetSection
      title="Contratos de alquiler"
      sub="plantillas con cláusulas reusables · se autorrellenan al crear contrato nuevo"
    >
      {contratos.map((tpl) => (
        <Row key={tpl.key} tpl={tpl} />
      ))}
    </SetSection>

    <SetSection
      title="Correos al inquilino"
      sub="se envían desde Contratos · cobros · gestión inquilino"
    >
      {correos.map((tpl) => (
        <Row key={tpl.key} tpl={tpl} />
      ))}
    </SetSection>

    <SetSection
      title="Fórmulas fiscales personalizadas"
      sub="reglas de prorrateo y deducción · se aplican automáticamente · útil para casos complejos"
    >
      {formulas.map((tpl) => (
        <Row key={tpl.key} tpl={tpl} />
      ))}
    </SetSection>
  </>
);

export default PlantillasPage;
