// ============================================================================
// Tesorería V9 · héroe navy de GESTIÓN
// ============================================================================
//
// Mockup: `atlas-tesoreria-v9.html` (héroe). Patrón de la casa para un héroe
// navy con inset de gráfico: `inmuebles/components/CarteraHero` — el
// `HeroBanner` del DS es blanco (§8 · variantes de tarjeta) y la guía prohíbe
// el héroe blanco en pantallas GESTIÓN, así que el contenedor es de módulo y
// lo que sí es del DS se reutiliza de verdad: `KPIStrip`+`KPI`, `MoneyValue`
// e `Icons`, con los tokens remapeados a la rampa `--atlas-v5-on-navy-*`
// dentro del ámbito navy (ver el CSS · cero hex, solo tokens).
// ============================================================================

import React from 'react';
import { Icons, KPI, KPIStrip, MoneyValue } from '../../../design-system/v5';
import type { KpisHero } from '../../../services/tesoreriaV6Metrics';
import { fechaLarga, importeConSigno, importeSaldo } from './formatoV6';
import styles from './HeroTesoreria.module.css';

interface Props {
  kpis: KpisHero;
  hoy: string;
  /** Nombre del mes en curso · minúscula (formatoV6.nombreMes). */
  mesActual: string;
  onSubirExtracto: () => void;
  /** El inset derecho · el gráfico "Lo que viene · próximos 30 días". */
  grafico?: React.ReactNode;
}

const plural = (n: number, uno: string, varios: string): string =>
  `${n} ${n === 1 ? uno : varios}`;

const HeroTesoreria: React.FC<Props> = ({ kpis, hoy, mesActual, onSubirExtracto, grafico }) => (
  <section className={styles.hero}>
    <div className={styles.grid}>
      <div className={styles.izq}>
        <div className={styles.topbar}>
          <div className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.lab}>Mi tesorería</span>
            <span className={styles.fecha}>· {fechaLarga(hoy)}</span>
          </div>
          <button type="button" className={styles.btnExtracto} onClick={onSubirExtracto}>
            <Icons.Upload size={14} strokeWidth={1.9} /> Subir extracto
          </button>
        </div>

        <div className={styles.saldo}>
          <div className={styles.saldoLab}>Saldo hoy · consolidado</div>
          <MoneyValue value={kpis.saldo} size="kpiStar" tone="ink" className={styles.saldoGrande} />
          <div className={styles.saldoSub}>{plural(kpis.numCuentas, 'cuenta', 'cuentas')}</div>
        </div>

        <KPIStrip columns={3} className={styles.kpisNavy}>
          <KPI
            label="Queda entrar"
            value={importeConSigno(kpis.pendienteEntrar)}
            sub={plural(kpis.movimientosEntrar, 'cobro pendiente', 'cobros pendientes')}
          />
          <KPI
            label="Queda salir"
            value={importeConSigno(kpis.pendienteSalir)}
            sub={plural(kpis.movimientosSalir, 'pago pendiente', 'pagos pendientes')}
          />
          {/* El cierre es un SALDO · sin signo positivo (§5 formatoV6). */}
          <KPI label={`Cierre ${mesActual}`} value={importeSaldo(kpis.cierre)} sub="proyectado" tone="gold" />
        </KPIStrip>
      </div>

      <div className={styles.der}>
        <div className={styles.insetHd}>
          <span className={styles.insetTitle}>Lo que viene · próximos 30 días</span>
          <span className={styles.insetHint}>pasa el ratón por la línea</span>
        </div>
        <div className={styles.insetBody}>{grafico}</div>
      </div>
    </div>
  </section>
);

export default HeroTesoreria;
