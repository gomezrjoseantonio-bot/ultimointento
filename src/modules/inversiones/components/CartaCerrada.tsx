// T23.4 · Carta de posición cerrada · § 5.3 spec.
//
// Visualmente diferenciada de las cartas activas (`.cartaCerrada` con
// border-left por signo del resultado). Footer OPCIONAL con puente al
// módulo Fiscal (§ 5.5 · solo si `referenciaFiscal` presente · navega a
// `/fiscal/ejercicio/{año}` que es la ruta análoga real del repo).

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import {
  formatCurrency,
  formatDelta,
  formatPercent,
  getLogoClass,
  getLogoText,
  getTipoLabel,
  signClass,
} from '../helpers';
import {
  formatDuracion,
  type PosicionCerrada,
} from '../adapters/posicionesCerradas';
import styles from '../pages/PosicionesCerradas.module.css';

interface Props {
  posicion: PosicionCerrada;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const claseSigno = (resultado: number): 'ganancia' | 'perdida' | 'empate' => {
  if (Math.abs(resultado) < 0.005) return 'empate';
  return resultado > 0 ? 'ganancia' : 'perdida';
};

const CartaCerrada: React.FC<Props> = ({ posicion }) => {
  const navigate = useNavigate();
  const cls = claseSigno(posicion.resultado);
  const logoCls = getLogoClass(posicion.entidad);

  const verDetallesFiscales = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!posicion.referenciaFiscal) return;
    navigate(`/fiscal/ejercicio/${posicion.referenciaFiscal}`);
  };

  return (
    <div className={`${styles.cartaCerrada} ${styles[cls]}`}>
      <div className={styles.ccHead}>
        <div className={styles.ccMarca}>
          <div
            className={`${styles.ccLogo} ${logoCls ? styles[logoCls] : ''}`}
            aria-hidden
          >
            {getLogoText(posicion.entidad)}
          </div>
          <div className={styles.ccTextos}>
            <div className={styles.ccNom}>{posicion.nombre}</div>
            <div className={styles.ccMeta}>
              {getTipoLabel(posicion.tipo)}
              {posicion.entidad && posicion.entidad !== '—' ? ` · ${posicion.entidad}` : ''}
            </div>
          </div>
        </div>
        <div className={styles.ccResultado}>
          <span className={`delta ${signClass(posicion.resultado)}`}>
            {formatDelta(posicion.resultado)}
          </span>
          <span className={styles.ccResultadoPct}>
            {formatPercent(posicion.resultadoPercent)}
            {posicion.duracionDias != null
              ? ` en ${formatDuracion(posicion.duracionDias)}`
              : ''}
          </span>
        </div>
      </div>

      <div className={styles.ccFechas}>
        <span className={styles.ccItem}>
          <span className="lab">Apertura</span>
          <span className="val">{formatDate(posicion.fechaApertura)}</span>
        </span>
        <span className={styles.ccItem}>
          <span className="lab">Cierre</span>
          <span className="val">{formatDate(posicion.fechaCierre)}</span>
        </span>
        <span className={styles.ccItem}>
          <span className="lab">CAGR</span>
          <span className="val cagr">
            {posicion.cagr != null ? formatPercent(posicion.cagr) : '—'}
          </span>
        </span>
        {posicion.unidades != null && (
          <span className={styles.ccItem}>
            <span className="lab">Unidades</span>
            <span className="val">
              {posicion.unidades.toLocaleString('es-ES')}
              {posicion.unidadesLabel ? ` ${posicion.unidadesLabel}` : ''}
            </span>
          </span>
        )}
      </div>

      <div className={styles.ccCifras}>
        <span className={styles.ccItem}>
          <span className="lab">Aportado</span>
          <span className="val">{formatCurrency(posicion.aportado)}</span>
        </span>
        <span className={styles.ccItem}>
          <span className="lab">Vendido</span>
          <span className="val">{formatCurrency(posicion.vendido)}</span>
        </span>
      </div>

      {posicion.referenciaFiscal && (
        <div className={styles.ccFooter}>
          <button
            type="button"
            className={styles.ccLinkFiscal}
            onClick={verDetallesFiscales}
          >
            Ver detalles fiscales
            <Icons.ChevronRight size={11} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CartaCerrada;
