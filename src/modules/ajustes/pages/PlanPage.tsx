import React from 'react';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import SetRow from '../components/SetRow';
import containerStyles from '../AjustesPage.module.css';
import styles from './PlanPage.module.css';

interface FacturaRow {
  fecha: string;
  concepto: string;
  conceptoSub: string;
  importe: string;
  estado: 'paid' | 'next';
  estadoLabel: string;
}

const facturas: FacturaRow[] = [
  { fecha: '18/05/2026', concepto: 'Plan Pro · mayo 2026', conceptoSub: 'cargo automático', importe: '29,00 €', estado: 'next', estadoLabel: 'Próxima' },
  { fecha: '18/04/2026', concepto: 'Plan Pro · abril 2026', conceptoSub: 'Visa ···· 4821', importe: '29,00 €', estado: 'paid', estadoLabel: 'Pagada' },
  { fecha: '18/03/2026', concepto: 'Plan Pro · marzo 2026', conceptoSub: 'Visa ···· 4821', importe: '29,00 €', estado: 'paid', estadoLabel: 'Pagada' },
  { fecha: '18/02/2026', concepto: 'Plan Pro · febrero 2026', conceptoSub: 'Visa ···· 4821', importe: '29,00 €', estado: 'paid', estadoLabel: 'Pagada' },
  { fecha: '18/01/2026', concepto: 'Plan Pro · enero 2026', conceptoSub: 'Visa ···· 4821', importe: '29,00 €', estado: 'paid', estadoLabel: 'Pagada' },
];

const features: string[] = [
  'Hasta 15 inmuebles en cartera',
  'Integración bancaria ilimitada',
  'Declaración fiscal automática',
  'Simulador libertad financiera',
  'Snowball de amortización',
  'Soporte prioritario',
];

const PlanPage: React.FC = () => {
  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Plan &amp; facturación</h1>
          <div className={containerStyles.contentSub}>
            tu suscripción · método de pago · historial de facturas
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
          onClick={() => showToastV5('Cambiar plan · Pro anual · Pro familia · Business')}
        >
          <Icons.ExternalLink size={14} strokeWidth={1.8} />
          Cambiar plan
        </button>
      </div>

      <div className={styles.heroPlan}>
        <div className={styles.heroBody}>
          <div>
            <div className={styles.heroTag}>
              <Icons.Retos size={12} strokeWidth={2} />
              Plan Pro · mensual
            </div>
            <div className={styles.heroName}>Plan Pro</div>
            <div className={styles.heroDesc}>
              gestión completa de patrimonio inmobiliario · hasta 15 inmuebles · integración con 3 bancos
              · declaración fiscal automática · simulador de escenarios · soporte prioritario
            </div>
          </div>
          <div className={styles.priceBlock}>
            <div className={styles.amount}>29 €</div>
            <div className={styles.cycle}>/ mes · IVA incluido</div>
            <div className={styles.nextCharge}>
              próximo cargo · <strong>18 mayo 2026</strong>
            </div>
          </div>
        </div>
        <div className={styles.feats}>
          {features.map((feat) => (
            <div key={feat} className={styles.feat}>
              <span className={styles.featCheck}>
                <Icons.Check size={12} strokeWidth={2.5} />
              </span>
              {feat}
            </div>
          ))}
        </div>
      </div>

      <SetSection
        title="Método de pago"
        sub="tarjeta o cuenta que se cargará cada mes"
      >
        <SetRow
          label="Tarjeta predeterminada"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar tarjeta')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>Visa · ···· ···· ···· 4821</SetRow.ValueMono>
          <SetRow.Sub>caduca 09/2028 · titular José Antonio Gómez</SetRow.Sub>
        </SetRow>
        <SetRow
          label="Dirección de facturación"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Editar dirección')}>
              Editar
            </SetRow.Link>
          }
        >
          <SetRow.Value>Calle Bravo Murillo, 124 · 28020 Madrid</SetRow.Value>
          <SetRow.Sub>usado en facturas emitidas</SetRow.Sub>
        </SetRow>
        <SetRow
          label="CIF/NIF facturación"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Editar datos fiscales')}>
              Editar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>12345678A</SetRow.ValueMono>
        </SetRow>
      </SetSection>

      <div className={styles.facturaCard}>
        <div className={styles.facturaHead}>
          <div>
            <div className={styles.facturaHeadTitle}>Historial de facturas</div>
            <div className={styles.facturaHeadSub}>últimos 6 meses · descargables en PDF</div>
          </div>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => showToastV5('Descargar todas · ZIP con PDFs')}
          >
            <Icons.Download size={13} strokeWidth={1.8} />
            Descargar todas
          </button>
        </div>
        <div className={`${styles.facturaRow} ${styles.header}`}>
          <div>Fecha</div>
          <div>Concepto</div>
          <div className={styles.headRight}>Importe</div>
          <div style={{ textAlign: 'center' }}>Estado</div>
          <div style={{ textAlign: 'center' }}>Factura</div>
          <div></div>
        </div>
        {facturas.map((row) => (
          <div
            key={row.fecha}
            className={styles.facturaRow}
            onClick={() => showToastV5(`Ver factura · ${row.fecha} · ${row.importe}`)}
            role="button"
            tabIndex={0}
          >
            <span className={styles.facturaFecha}>{row.fecha}</span>
            <div>
              <div className={styles.facturaConcepto}>{row.concepto}</div>
              <div className={styles.facturaConceptoSub}>{row.conceptoSub}</div>
            </div>
            <div className={styles.facturaAmount}>{row.importe}</div>
            <Pill variant={row.estado === 'paid' ? 'pos' : 'gold'} asTag>
              {row.estadoLabel}
            </Pill>
            {row.estado === 'paid' ? (
              <button
                type="button"
                className={styles.facturaDl}
                onClick={(e) => {
                  e.stopPropagation();
                  showToastV5(`Descargar factura · ${row.fecha} · PDF`);
                }}
              >
                PDF
              </button>
            ) : (
              <span className={`${styles.facturaDl} ${styles.muted}`}>—</span>
            )}
            <span className={styles.facturaArrow}>
              <Icons.ChevronRight size={14} strokeWidth={2} />
            </span>
          </div>
        ))}
      </div>

      <SetSection title="Gestión de la suscripción">
        <SetRow
          label="Cambiar a facturación anual"
          trailing={
            <button
              type="button"
              className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
              style={{ padding: '7px 12px', fontSize: 12 }}
              onClick={() => showToastV5('Cambiar a anual · 290 €/año')}
            >
              Cambiar a anual
            </button>
          }
        >
          <SetRow.Sub>
            ahorras 58 € al año · equivalente a 2 meses gratis
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Pausar suscripción"
          trailing={
            <button
              type="button"
              className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
              style={{ padding: '7px 12px', fontSize: 12 }}
              onClick={() => showToastV5('Pausar suscripción · sin cargos')}
            >
              Pausar
            </button>
          }
        >
          <SetRow.Sub>
            conserva tus datos · no facturamos hasta reactivar · máx 3 meses
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Cancelar suscripción"
          labelTone="danger"
          trailing={
            <button
              type="button"
              className={`${containerStyles.btn} ${containerStyles.btnNeg}`}
              style={{ padding: '7px 12px', fontSize: 12 }}
              onClick={() => showToastV5('Cancelar suscripción · requiere confirmación', 'warn')}
            >
              Cancelar plan
            </button>
          }
        >
          <SetRow.Sub>
            acceso hasta fin del período pagado · tus datos se conservan 90 días
          </SetRow.Sub>
        </SetRow>
      </SetSection>
    </>
  );
};

export default PlanPage;
