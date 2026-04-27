import React from 'react';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import containerStyles from '../AjustesPage.module.css';
import styles from './IntegracionesPage.module.css';

type EstadoIntegracion = 'pos' | 'warn' | 'gris';

interface IntegracionCard {
  key: string;
  initials: string;
  name: string;
  sub: string;
  body: React.ReactNode;
  foot: string;
  cta: string;
  estado: EstadoIntegracion;
  estadoLabel: string;
  /** Color del logo · marca de banco. */
  logoColor: string;
  logoText?: boolean;
  icon?: React.ReactNode;
  toast: string;
}

const bancos: IntegracionCard[] = [
  {
    key: 'santander',
    initials: 'SA',
    name: 'Santander',
    sub: '1 cuenta vinculada',
    body: (
      <>
        <strong>ES12 0049 ···· ···· 2715</strong> · cuenta principal · saldo actualizado hace 2 horas ·
        sincronización automática de movimientos
      </>
    ),
    foot: 'Conectado · 12/09/2025',
    cta: 'Gestionar →',
    estado: 'pos',
    estadoLabel: 'Activo',
    logoColor: 'var(--atlas-v5-brand-santander)',
    logoText: true,
    toast: 'Gestionar conexión Santander',
  },
  {
    key: 'sabadell',
    initials: 'SB',
    name: 'Sabadell',
    sub: '2 cuentas vinculadas',
    body: (
      <>
        <strong>ES45 0081 ···· ···· 0842</strong> · inmuebles ·{' '}
        <strong>ES45 0081 ···· ···· 5530</strong> · inversión · ambas al día
      </>
    ),
    foot: 'Conectado · 03/11/2025',
    cta: 'Gestionar →',
    estado: 'pos',
    estadoLabel: 'Activo',
    logoColor: 'var(--atlas-v5-brand-sabadell)',
    logoText: true,
    toast: 'Gestionar conexión Sabadell',
  },
  {
    key: 'unicaja',
    initials: 'UN',
    name: 'Unicaja',
    sub: '1 cuenta vinculada',
    body: (
      <>
        <strong>ES80 2103 ···· ···· 4437</strong> · cuenta colchón · último movimiento hace 5 días ·
        importación CSB43
      </>
    ),
    foot: 'Conectado · 18/01/2026',
    cta: 'Gestionar →',
    estado: 'pos',
    estadoLabel: 'Activo',
    logoColor: 'var(--atlas-v5-brand-unicaja)',
    logoText: true,
    toast: 'Gestionar conexión Unicaja',
  },
];

const servicios: IntegracionCard[] = [
  {
    key: 'aeat',
    initials: '',
    name: 'AEAT · Agencia Tributaria',
    sub: 'descarga automática XMLs IRPF',
    body: (
      <>
        conecta con <strong>certificado digital</strong> para descargar tus datos fiscales de años
        anteriores · ATLAS nunca presenta por ti · solo lee
      </>
    ),
    foot: 'Requiere certificado digital',
    cta: 'Conectar →',
    estado: 'warn',
    estadoLabel: 'Por conectar',
    logoColor: 'var(--atlas-v5-brand)',
    icon: <Icons.Lock size={22} strokeWidth={1.8} />,
    toast: 'Gestionar conexión AEAT',
  },
  {
    key: 'gdrive',
    initials: '',
    name: 'Google Drive',
    sub: 'archivo en la nube',
    body: (
      <>
        carpeta <strong>ATLAS/Archivo</strong> sincronizada · <strong>247 documentos</strong> · 1,2 GB ·
        última sincronización hace 12 minutos
      </>
    ),
    foot: 'Conectado · 24/04/2025',
    cta: 'Gestionar →',
    estado: 'pos',
    estadoLabel: 'Activo',
    logoColor: 'var(--atlas-v5-brand-gdrive)',
    icon: <Icons.Archivo size={22} strokeWidth={1.8} />,
    toast: 'Gestionar Google Drive',
  },
  {
    key: 'gmail',
    initials: '',
    name: 'Gmail',
    sub: 'importación de facturas',
    body: (
      <>
        <strong>opcional</strong> · ATLAS busca facturas recibidas por email de proveedores
        conocidos y las propone para imputar · nunca toca correos personales
      </>
    ),
    foot: 'No conectado',
    cta: 'Conectar →',
    estado: 'gris',
    estadoLabel: 'Inactivo',
    logoColor: 'var(--atlas-v5-brand-gmail)',
    icon: <Icons.Mail size={22} strokeWidth={1.8} />,
    toast: 'Conectar Gmail',
  },
];

const IntegracionCardCmp: React.FC<{ data: IntegracionCard }> = ({ data }) => (
  <button
    type="button"
    className={styles.card}
    onClick={() => showToastV5(data.toast)}
  >
    <div className={styles.head}>
      <div className={styles.logo} style={{ background: data.logoColor }} aria-hidden>
        {data.logoText ? data.initials : data.icon}
      </div>
      <div>
        <div className={styles.nom}>{data.name}</div>
        <div className={styles.sub}>{data.sub}</div>
      </div>
      <Pill variant={data.estado}>{data.estadoLabel}</Pill>
    </div>
    <div className={styles.body}>{data.body}</div>
    <div className={styles.foot}>
      <span className={styles.footMeta}>{data.foot}</span>
      <span className={styles.cta}>{data.cta}</span>
    </div>
  </button>
);

const IntegracionesPage: React.FC = () => (
  <>
    <div className={containerStyles.contentHead}>
      <div>
        <h1 className={containerStyles.contentTitle}>Integraciones</h1>
        <div className={containerStyles.contentSub}>
          conecta tus bancos · AEAT · Google · automatiza la captura de datos
        </div>
      </div>
      <button
        type="button"
        className={`${containerStyles.btn} ${containerStyles.btnGold}`}
        onClick={() => showToastV5('Añadir nueva integración')}
      >
        <Icons.Plus size={14} strokeWidth={1.8} />
        Nueva integración
      </button>
    </div>

    <div className={`${styles.sectionLabel} ${styles.first}`}>Bancos conectados</div>
    <div className={styles.grid}>
      {bancos.map((b) => (
        <IntegracionCardCmp key={b.key} data={b} />
      ))}
      <button
        type="button"
        className={`${styles.card} ${styles.placeholder}`}
        onClick={() => showToastV5('Añadir nuevo banco · 180+ disponibles')}
      >
        <div className={styles.placeholderInner}>
          <Icons.Plus size={34} strokeWidth={1.5} style={{ opacity: 0.5 }} />
          <div className={styles.placeholderTitle}>Conectar otro banco</div>
          <div className={styles.placeholderSub}>
            BBVA · CaixaBank · Kutxabank · Openbank · ING · y 180 más
          </div>
        </div>
      </button>
    </div>

    <div className={styles.sectionLabel}>Fiscal y servicios externos</div>
    <div className={styles.grid}>
      {servicios.map((s) => (
        <IntegracionCardCmp key={s.key} data={s} />
      ))}
      <button
        type="button"
        className={`${styles.card} ${styles.placeholder}`}
        onClick={() => showToastV5('Próximas · Unihouser · Idealista · Fotocasa · Stripe')}
      >
        <div className={styles.placeholderInner}>
          <Icons.Clock size={34} strokeWidth={1.5} style={{ opacity: 0.5 }} />
          <div className={styles.placeholderTitle}>Próximas integraciones</div>
          <div className={styles.placeholderSub}>
            Unihouser · Idealista · Fotocasa · Stripe · BBDD catastrales
          </div>
        </div>
      </button>
    </div>
  </>
);

export default IntegracionesPage;
