// T23.3 · Ficha detalle · grupo `rendimiento_periodico`
// (préstamos P2P · cuentas remuneradas · depósitos a plazo).
// § 4.3 spec · 4 KPIs · matriz cobros 36 meses (3 años) · tabla cobros.

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import {
  formatCurrency,
  formatPercent,
  getTipoLabel,
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
import FichaShell from './FichaShell';
import styles from '../pages/FichaPosicion.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
  onRegistrarCobro: () => void;
  onEditar: () => void;
}

const MESES_ABBR = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MES_NOMBRE = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Construye una matriz [year][month] con `true` si hubo cobro. */
function calcularCobros(
  aportaciones: Aportacion[],
  yearsBack: number,
): { years: number[]; map: Record<number, boolean[]> } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = currentYear - (yearsBack - 1);
  const years: number[] = [];
  const map: Record<number, boolean[]> = {};
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y);
    map[y] = new Array(12).fill(false);
  }
  for (const ap of aportaciones || []) {
    if (ap.tipo !== 'dividendo' || !ap.fecha) continue;
    const d = new Date(ap.fecha);
    const y = d.getFullYear();
    if (y in map) map[y][d.getMonth()] = true;
  }
  return { years, map };
}

const FichaRendimientoPeriodico: React.FC<Props> = ({
  posicion,
  onBack,
  onRegistrarCobro,
  onEditar,
}) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const cobros = useMemo(
    () =>
      (posicion.aportaciones || [])
        .filter((a) => a.tipo === 'dividendo')
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [posicion.aportaciones],
  );
  const interesGenerado = useMemo(
    () => cobros.reduce((s, c) => s + Number(c.importe ?? 0), 0),
    [cobros],
  );
  const tin = Number(posicion.rendimiento?.tasa_interes_anual ?? NaN);
  const proximoCobro = useMemo(() => {
    // Para posiciones de rendimiento periódico, el calendario de cobros se
    // deriva de `frecuencia_cobro` (semánticamente · "cuándo me pagan los
    // intereses"). NO confundir con `plan_aportaciones`, que representa
    // cargos del usuario. Si no tenemos frecuencia o el último cobro no
    // está informado, devolvemos `null` y la UI muestra "—".
    const frec = posicion.frecuencia_cobro;
    if (!frec || frec === 'al_vencimiento') return null;
    const mesesPorFrecuencia: Record<'mensual' | 'trimestral' | 'semestral' | 'anual', number> = {
      mensual: 1,
      trimestral: 3,
      semestral: 6,
      anual: 12,
    };
    const incremento = mesesPorFrecuencia[frec];
    if (!incremento) return null;
    // Siguiente cobro · último cobro registrado + N meses · si no hay
    // cobros, siguiente = primera fecha de aportación + N meses · si
    // tampoco hay aportaciones, devolvemos `null`.
    const aps = posicion.aportaciones || [];
    const ultimoCobro = aps
      .filter((a) => a.tipo === 'dividendo' && a.fecha)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
    const refIso = ultimoCobro?.fecha
      ?? aps.find((a) => a.tipo === 'aportacion' && a.fecha)?.fecha
      ?? null;
    if (!refIso) return null;
    const ref = new Date(refIso);
    if (Number.isNaN(ref.getTime())) return null;
    const next = new Date(ref);
    next.setMonth(next.getMonth() + incremento);
    return next.toISOString();
  }, [posicion.frecuencia_cobro, posicion.aportaciones]);

  const { years, map } = useMemo(() => calcularCobros(posicion.aportaciones || [], 3), [
    posicion.aportaciones,
  ]);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const sanitizeCSVTextCell = (value: string | null | undefined): string => {
    // Mitiga CSV/Formula injection (Excel ejecuta como fórmula valores que
    // empiezan por `=`, `+`, `-`, `@`). Prefijamos con apóstrofe para
    // forzar tratamiento literal · y reemplazamos `;` por `,` para no
    // romper el separador.
    const normalized = String(value ?? '').replace(/;/g, ',');
    return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  };

  const exportarCSV = () => {
    const filas = [
      ['Fecha', 'Importe (€)', 'Notas'].join(';'),
      ...cobros.map((c) =>
        [c.fecha, String(Number(c.importe ?? 0).toFixed(2)), sanitizeCSVTextCell(c.notas)].join(';'),
      ),
    ].join('\n');
    const blob = new Blob([filas], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobros-${posicion.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const logoCfg = getEntidadLogoConfig(posicion.entidad);
  const heroBadge = `${getTipoLabel(posicion.tipo)} · ${
    posicion.frecuencia_cobro ?? 'cobro periódico'
  }${posicion.duracion_meses ? ' · ' + posicion.duracion_meses + ' meses' : ''}`;

  return (
    <FichaShell
      hero={{
        variant: 'prestamo',
        badge: heroBadge,
        logo: {
          text: logoCfg.text,
          bg: logoCfg.gradient ?? logoCfg.bg ?? 'var(--atlas-v5-bg)',
          color: logoCfg.color,
        },
        title: `${posicion.nombre || 'Posición'}${posicion.entidad ? ` · ${posicion.entidad}` : ''}`,
        meta: (
          <>
            {posicion.fecha_compra && (
              <>firmado <strong>{formatDate(posicion.fecha_compra)}</strong></>
            )}
            {Number.isFinite(tin) && (
              <>
                {posicion.fecha_compra && <span className={styles.detailHeroSep}>·</span>}
                TIN <strong>{formatPercent(tin)}</strong>
              </>
            )}
            {posicion.frecuencia_cobro && (
              <>
                <span className={styles.detailHeroSep}>·</span>
                cobro <strong>{posicion.frecuencia_cobro}</strong>
              </>
            )}
          </>
        ),
        stats: [
          { lab: 'Capital', val: formatCurrency(aportado) },
          { lab: 'Interés generado', val: formatCurrency(interesGenerado), valVariant: 'gold' },
          {
            lab: `Cobrado ${currentYear}`,
            val: formatCurrency(
              cobros.filter((c) => new Date(c.fecha).getFullYear() === currentYear)
                .reduce((s, c) => s + Number(c.importe ?? 0), 0),
            ),
            valVariant: 'pos',
          },
          {
            lab: 'Próximo cobro',
            val: proximoCobro ? formatDate(proximoCobro) : '—',
            small: true,
          },
        ],
      }}
      onBack={onBack}
      actions={[
        {
          label: 'Registrar cobro',
          variant: 'ghost',
          icon: <Icons.Plus size={14} strokeWidth={1.8} />,
          onClick: onRegistrarCobro,
        },
        {
          label: 'Editar posición',
          variant: 'gold',
          icon: <Icons.Edit size={14} strokeWidth={1.8} />,
          onClick: onEditar,
        },
      ]}
    >

      <div className={styles.detailCard}>
        <div className={styles.detailCardTit}>Calendario de cobros · año {currentYear}</div>
        <div className={styles.calGrid}>
          {MES_NOMBRE.map((mesLabel, i) => {
            const cobrado = map[currentYear]?.[i];
            let cls = styles.calMes;
            let imp: string;
            if (cobrado) {
              cls += ' ' + styles.cobrado;
              const cobrosMes = cobros.filter(
                (c) => new Date(c.fecha).getFullYear() === currentYear && new Date(c.fecha).getMonth() === i,
              );
              const totalMes = cobrosMes.reduce((s, c) => s + Number(c.importe ?? 0), 0);
              imp = '+' + formatCurrency(totalMes);
            } else if (i < currentMonth) {
              cls += ' ' + styles.pendiente;
              imp = '—';
            } else if (i === currentMonth) {
              cls += ' ' + styles.pendiente;
              imp = '—';
            } else {
              cls += ' ' + styles.futuro;
              imp = '—';
            }
            return (
              <div key={i} className={cls}>
                <div className={styles.calMesNom}>{mesLabel}</div>
                <div className={styles.calMesImp}>{imp}</div>
              </div>
            );
          })}
        </div>
        {years.length > 1 && (
          <div className={styles.detailCardTit} style={{ marginTop: 22, marginBottom: 8 }}>
            Histórico · {years[0]}–{years[years.length - 2]}
          </div>
        )}
        {years.length > 1 && (
          <div>
            <div className={styles.matrizMesesHeader}>
              <div />
              {MESES_ABBR.map((m, i) => (
                <div key={i} className={styles.matrizMesLab}>{m}</div>
              ))}
            </div>
            {years.slice(0, -1).map((y) => (
              <div key={y} className={styles.matrizGrande}>
                <div className={styles.matrizYearLab}>{y}</div>
                {MESES_ABBR.map((_, i) => {
                  let cls = styles.matrizCell;
                  if (map[y][i]) cls += ' ' + styles.cobrado;
                  else cls += ' ' + styles.pendiente;
                  return <div key={i} className={cls} title={`${MESES_ABBR[i]} ${y}`} />;
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.detailCard} style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div className={styles.detailCardTit} style={{ marginBottom: 0 }}>Cobros · histórico</div>
          {cobros.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={exportarCSV}>
              <Icons.Download size={11} strokeWidth={2} /> Exportar CSV
            </button>
          )}
        </div>
        {cobros.length === 0 ? (
          <div className={styles.tablaEmpty}>
            Aún no has registrado ningún cobro. Usa el botón "Registrar cobro" para añadir uno.
          </div>
        ) : (
          <div className={styles.tablaWrap}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.fecha)}</td>
                    <td className={`${styles.num} ${styles.pos}`}>
                      {formatCurrency(Number(c.importe ?? 0))}
                    </td>
                    <td className={styles.txt}>{c.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FichaShell>
  );
};

export default FichaRendimientoPeriodico;
