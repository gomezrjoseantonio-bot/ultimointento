// T23.6.2 · Cinta resumen Inversiones sticky (§Z.1 + §2.2 spec).
// Solo visible en módulo Inversiones (galería + fichas).
// Agrega datos de los 2 stores vía getAllCartaItems() + rendimientosService.

import React, { useEffect, useMemo, useState } from 'react';
import { getAllCartaItems } from '../adapters/galeriaAdapter';
import { rendimientosService } from '../../../services/rendimientosService';
import type { CartaItem } from '../types/cartaItem';
import type { PagoRendimiento } from '../../../types/inversiones-extended';
import { formatCurrency, formatDelta, signClass } from '../helpers';
import styles from './CintaResumenInversiones.module.css';

// ── Hooks de datos ──────────────────────────────────────────────────────────

interface CobrosMesResult {
  total: number;
  fuentePrincipal: string | null;
}

interface PrevistoAñoResult {
  total: number;
  descripcion: string | null;
}

/** Suma de cobros (estado === 'pagado') del mes en curso. */
function useCobrosMesActual(): CobrosMesResult {
  const [result, setResult] = useState<CobrosMesResult>({ total: 0, fuentePrincipal: null });

  useEffect(() => {
    let cancelled = false;
    rendimientosService.getAllRendimientos().then((pagos) => {
      if (cancelled) return;
      const now = new Date();
      const año = now.getFullYear();
      const mes = now.getMonth();
      let total = 0;
      let fuentePrincipal: string | null = null;
      let maxImporte = 0;
      for (const pago of pagos) {
        const d = new Date((pago as PagoRendimiento & { fecha_pago: string }).fecha_pago);
        if (
          d.getFullYear() === año &&
          d.getMonth() === mes &&
          (pago as PagoRendimiento).estado === 'pagado'
        ) {
          total += (pago as PagoRendimiento & { importe_neto: number }).importe_neto;
          const nombre = (pago as PagoRendimiento & { posicion_nombre?: string }).posicion_nombre;
          if (nombre && (pago as PagoRendimiento & { importe_neto: number }).importe_neto > maxImporte) {
            maxImporte = (pago as PagoRendimiento & { importe_neto: number }).importe_neto;
            fuentePrincipal = nombre;
          }
        }
      }
      setResult({ total, fuentePrincipal });
    }).catch(() => {/* silenciar errores · cinta muestra '—' si no hay datos */});
    return () => { cancelled = true; };
  }, []);

  return result;
}

/** Suma prevista de rendimientos para el año en curso (pagados + pendientes). */
function usePrevistoAñoActual(): PrevistoAñoResult {
  const [result, setResult] = useState<PrevistoAñoResult>({ total: 0, descripcion: null });

  useEffect(() => {
    let cancelled = false;
    rendimientosService.getAllRendimientos().then((pagos) => {
      if (cancelled) return;
      const año = new Date().getFullYear();
      let total = 0;
      const fuentes = new Set<string>();
      for (const pago of pagos) {
        const d = new Date((pago as PagoRendimiento & { fecha_pago: string }).fecha_pago);
        if (d.getFullYear() === año) {
          total += (pago as PagoRendimiento & { importe_neto: number }).importe_neto;
          const nombre = (pago as PagoRendimiento & { posicion_nombre?: string }).posicion_nombre;
          if (nombre) fuentes.add(nombre);
        }
      }
      const descripcion = fuentes.size > 0 ? `intereses P2P y depósitos` : null;
      setResult({ total, descripcion });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return result;
}

// ── CintaResumenInversiones ─────────────────────────────────────────────────

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const CintaResumenInversiones: React.FC = () => {
  const [items, setItems] = useState<CartaItem[]>([]);
  const cobrosMes = useCobrosMesActual();
  const previstoAño = usePrevistoAñoActual();

  useEffect(() => {
    let cancelled = false;
    getAllCartaItems().then((result) => {
      if (!cancelled) setItems(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const valorTotal = useMemo(() => items.reduce((s, i) => s + i.valor_actual, 0), [items]);
  const aportadoTotal = useMemo(() => items.reduce((s, i) => s + i.total_aportado, 0), [items]);
  const latente = valorTotal - aportadoTotal;
  const rentabilidadPct = aportadoTotal > 0 ? (latente / aportadoTotal) * 100 : 0;

  const mesLabel = MESES_ES[new Date().getMonth()].toUpperCase();

  const rentClass = signClass(latente);

  return (
    <div className={styles.invCinta} role="banner" aria-label="Resumen cartera de inversiones">
      {/* Header: MI CARTERA */}
      <div className={styles.invCintaHd}>
        <div className={styles.invCintaHdDot} aria-hidden="true" />
        <div className={styles.invCintaHdText}>MI CARTERA DE INVERSIONES</div>
      </div>

      {/* KPIs */}
      <div className={styles.invCintaStats}>
        {/* Valor total */}
        <div className={styles.invCintaStat}>
          <div className={styles.invCintaStatLab}>VALOR TOTAL</div>
          <div className={styles.invCintaStatVal}>
            {items.length > 0 ? formatCurrency(valorTotal) : '—'}
          </div>
        </div>

        {/* Rentabilidad */}
        <div className={styles.invCintaStat}>
          <div className={styles.invCintaStatLab}>RENTABILIDAD</div>
          <div className={`${styles.invCintaStatVal} ${styles[rentClass]}`}>
            {aportadoTotal > 0
              ? `${rentabilidadPct > 0 ? '+' : ''}${rentabilidadPct.toFixed(1)}%`
              : '—'}
          </div>
          {aportadoTotal > 0 && (
            <div className={styles.invCintaStatSub}>{formatDelta(latente)} latente</div>
          )}
        </div>

        {/* Cobrado mes */}
        <div className={styles.invCintaStat}>
          <div className={styles.invCintaStatLab}>COBRADO {mesLabel}</div>
          <div className={`${styles.invCintaStatVal} ${styles.pos}`}>
            {cobrosMes.total > 0 ? formatDelta(cobrosMes.total) : '—'}
          </div>
          {cobrosMes.fuentePrincipal && (
            <div className={styles.invCintaStatSub}>{cobrosMes.fuentePrincipal}</div>
          )}
        </div>

        {/* Previsto año */}
        <div className={styles.invCintaStat}>
          <div className={styles.invCintaStatLab}>PREVISTO AÑO</div>
          <div className={`${styles.invCintaStatVal} ${styles.gold}`}>
            {previstoAño.total > 0 ? formatDelta(previstoAño.total) : '—'}
          </div>
          {previstoAño.descripcion && (
            <div className={styles.invCintaStatSub}>{previstoAño.descripcion}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CintaResumenInversiones;
