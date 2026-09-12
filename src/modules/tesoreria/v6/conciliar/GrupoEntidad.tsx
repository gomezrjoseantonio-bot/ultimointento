// El envoltorio de una ENTIDAD · la misma tarjeta en «Confirma el destino»
// (borde oro) y en «Colocado en su sitio» (borde navy). Cabecera plegable con
// icono, nombre, renglón pequeño, nº de movimientos e importe EN TINTA (guía V5
// §2.2.1: nunca se colorea un importe); las acciones de cada zona van al lado,
// fuera del botón de plegar, y el detalle cuelga debajo cuando está abierta.

import React from 'react';
import { Icons, MoneyValue, Pill } from '../../../../design-system/v5';
import type { Entidad, IconoEntidad } from './agruparPorEntidad';
import styles from './PanelConciliar.module.css';

export interface GrupoEntidadProps {
  entidad: Entidad;
  variante: 'confirmar' | 'colocado';
  /** El chip en oro junto al nombre · «Confirmar piso», «¿Qué es?». */
  chip?: string;
  abierta: boolean;
  onAbrir: () => void;
  /** Lo que se puede hacer con la entidad · botones fuera del botón de plegar. */
  acciones?: React.ReactNode;
  /** Lo que va entre la cabecera y el detalle, siempre visible · la pregunta. */
  banda?: React.ReactNode;
  /** El detalle al abrir · sus movimientos, cada uno en su fecha. */
  children?: React.ReactNode;
  className?: string;
}

function IconoDe({ icono }: { icono: IconoEntidad }) {
  const size = 17;
  switch (icono) {
    case 'suministro': return <Icons.Zap size={size} />;
    case 'inmueble': return <Icons.Inmuebles size={size} />;
    case 'prestamo': return <Icons.Financiacion size={size} />;
    case 'inversion': return <Icons.Inversiones size={size} />;
    case 'persona': return <Icons.Personal size={size} />;
    case 'traspaso': return <Icons.Libertad size={size} />;
    default: return <Icons.Fiscal size={size} />;
  }
}

/** «24 recibos» · «17 cobros» · «76 bizums» · «237 traspasos» · la unidad que el usuario diría. */
export function unidadDe(e: Entidad): string {
  const n = e.cuantas;
  const c = e.clasificacion;
  const plural = (uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  if (e.interno) return plural('traspaso', 'traspasos');
  if (c?.metodo === 'bizum') return plural('bizum', 'bizums');
  if (c?.familia === 'prestamo_hipoteca' || c?.familia === 'inversion') return plural('cuota', 'cuotas');
  if (e.total > 0) return plural('cobro', 'cobros');
  if (c?.metodo === 'domiciliacion' || c?.familia === 'suministro' || c?.familia === 'comunidad') return plural('recibo', 'recibos');
  return plural('movimiento', 'movimientos');
}

const GrupoEntidad: React.FC<GrupoEntidadProps> = ({
  entidad: e,
  variante,
  chip,
  abierta,
  onAbrir,
  acciones,
  banda,
  children,
  className,
}) => (
  <div
    className={`${styles.ent} ${variante === 'confirmar' ? styles.entConfirmar : ''} ${className ?? ''}`}
    data-entidad={e.clave}
    data-testid="entidad"
  >
    <div className={styles.entCab}>
      <button type="button" className={styles.entToggle} onClick={onAbrir} aria-expanded={abierta}>
        <span className={styles.entIco} aria-hidden="true">
          <IconoDe icono={e.icono} />
        </span>
        <span className={styles.entInfo}>
          <span className={styles.entNom}>
            {e.nombre}
            {chip && (
              <Pill variant="gold" asTag className={styles.entChip}>
                {chip}
              </Pill>
            )}
          </span>
          <span className={styles.entSub}>
            {variante === 'colocado' ? [e.destino, e.sub].filter(Boolean).join(' · ') : e.sub || e.destino}
          </span>
        </span>
        <Pill variant="gris" className={styles.entCount}>
          {unidadDe(e)}
        </Pill>
        <span className={styles.entMonto}>
          {e.interno ? (
            <span className={styles.entNeutro}>neutro</span>
          ) : (
            <MoneyValue value={e.total} showSign tone="ink" />
          )}
        </span>
        <span className={styles.chev} aria-hidden="true">
          <Icons.ChevronDown size={16} />
        </span>
      </button>
      {acciones && <div className={styles.entAccion}>{acciones}</div>}
    </div>
    {banda}
    {abierta && <div className={styles.entDet}>{children}</div>}
  </div>
);

export default GrupoEntidad;
