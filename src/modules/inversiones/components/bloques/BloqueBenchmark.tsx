// BloqueBenchmark · P2 ficha plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.3).
// PR 4 · cableado · lee benchmarks · selecciona por política · barras horizontales
// + banner análisis cerrable (`benchmark-orange-loss`).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeTwrRolling5y,
  type TipoActivoProyectable,
} from '../../../../services/proyeccionActivoService';
import { listBenchmarks } from '../../../../services/benchmarksReferenciaService';
import type { BenchmarkReferencia } from '../../../../types/benchmarksReferencia';
import { useAvisoCerrable } from './useAvisoCerrable';
import styles from './bloques.module.css';

export interface BloqueBenchmarkProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Nombre del activo · para el copy del banner. */
  nombrePosicion: string;
  /** TWR histórico del activo (decimal). null si <2 años. */
  twrHistorico: number | null;
  /** Política de inversión · selecciona benchmarks relevantes. */
  politicaInversion?: string;
  /** ID del aviso cerrable · spec §9.1. */
  avisoId?: string;
}

interface BarraComparativa {
  codigo: string;
  nombre: string;
  twrPct: number;
  esActivo?: boolean;
  esInflacion?: boolean;
}

function seleccionarBenchmarksRelevantes(
  benchmarks: BenchmarkReferencia[],
  politica?: string,
): BenchmarkReferencia[] {
  const byCodigo = (cod: string) =>
    benchmarks.find((b) => b.codigo === cod && Object.keys(b.valoresAnuales).length > 0);
  const cpi = byCodigo('CPI_ES');
  switch (politica) {
    case 'renta_variable':
      return [cpi, byCodigo('MSCI_WORLD_EUR'), byCodigo('SP500_EUR')].filter(
        Boolean,
      ) as BenchmarkReferencia[];
    case 'renta_fija_corto':
    case 'renta_fija_largo':
      return [cpi, byCodigo('BONDS_AGG_EUR')].filter(Boolean) as BenchmarkReferencia[];
    case 'renta_mixta':
    case 'ciclo_vida':
      return [cpi, byCodigo('BONDS_AGG_EUR'), byCodigo('MSCI_WORLD_EUR')].filter(
        Boolean,
      ) as BenchmarkReferencia[];
    default:
      return [cpi, byCodigo('MSCI_WORLD_EUR')].filter(Boolean) as BenchmarkReferencia[];
  }
}

const BloqueBenchmark = ({
  posicionId,
  tipoActivo,
  nombrePosicion,
  twrHistorico,
  politicaInversion,
  avisoId = 'benchmark-orange-loss',
}: BloqueBenchmarkProps) => {
  const navigate = useNavigate();
  const [benchmarks, setBenchmarks] = useState<BenchmarkReferencia[]>([]);
  const { visible: bannerVisible, cerrar } = useAvisoCerrable(avisoId, {
    ubicacionContexto: `/inversiones/${posicionId}`,
    etiqueta: 'Análisis benchmark vs activo',
  });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const lista = await listBenchmarks();
        if (!cancelado) setBenchmarks(lista);
      } catch {
        // Sin benchmarks · render degradado.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const barras: BarraComparativa[] = useMemo(() => {
    const relevantes = seleccionarBenchmarksRelevantes(benchmarks, politicaInversion);
    const inflacion = relevantes.find((b) => b.tipo === 'inflacion');
    const out: BarraComparativa[] = [];
    if (twrHistorico != null) {
      out.push({
        codigo: 'TU_PLAN',
        nombre: nombrePosicion,
        twrPct: twrHistorico * 100,
        esActivo: true,
      });
    }
    for (const b of relevantes) {
      const cagr = computeTwrRolling5y(b);
      if (cagr == null) continue;
      out.push({
        codigo: b.codigo,
        nombre: b.nombre,
        twrPct: cagr * 100,
        esInflacion: b.tipo === 'inflacion' || b.codigo === inflacion?.codigo,
      });
    }
    return out;
  }, [benchmarks, politicaInversion, twrHistorico, nombrePosicion]);

  const analisisCopy = useMemo(() => {
    if (twrHistorico == null) {
      return 'Aún no tenemos suficiente histórico · revisa en un par de años.';
    }
    const inflacion = barras.find((b) => b.esInflacion);
    if (inflacion && twrHistorico * 100 < inflacion.twrPct) {
      const delta = (inflacion.twrPct - twrHistorico * 100).toFixed(1);
      return `Tu ${nombrePosicion} pierde contra la inflación · ${delta} puntos reales perdidos al año.`;
    }
    const competidor = barras.find((b) => !b.esActivo && !b.esInflacion);
    if (competidor && twrHistorico * 100 < competidor.twrPct) {
      const delta = (competidor.twrPct - twrHistorico * 100).toFixed(1);
      return `Tu ${nombrePosicion} rinde ${delta} pp menos que su benchmark de referencia (${competidor.nombre}).`;
    }
    return `Tu ${nombrePosicion} está batiendo a su benchmark de referencia · sigue así.`;
  }, [barras, twrHistorico, nombrePosicion]);

  // Escala automática · centra en 0 · rango +/- max absoluto.
  const maxAbs = Math.max(...barras.map((b) => Math.abs(b.twrPct)), 5);

  return (
    <section
      className={styles.bloque}
      data-bloque="P2"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-politica={politicaInversion ?? ''}
      aria-label="Benchmark"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Benchmark</div>
          <div className={styles.bloqueMensaje}>Comparativa con índices de referencia</div>
          <div className={styles.bloqueSub}>
            CAGR rolling 5 años · datos de mercado editables desde Ajustes.
          </div>
          <div className={styles.srcChips}>
            <button
              type="button"
              className={styles.srcChip}
              onClick={() => navigate('/ajustes/datos-mercado')}
              aria-label="Configurar datos de mercado en Ajustes"
            >
              Fuente · Ajustes ↗
            </button>
          </div>
        </div>
      </div>

      {barras.length === 0 ? (
        <div className={styles.bloquePlaceholder}>
          Configura tus benchmarks en Ajustes → Datos de mercado para ver esta comparativa.
        </div>
      ) : (
        <div className={styles.bloqueBody}>
          <div className={styles.barras}>
            {barras.map((b) => {
              const ancho = (Math.abs(b.twrPct) / maxAbs) * 50; // 50 % a cada lado del cero.
              const positivo = b.twrPct >= 0;
              return (
                <div key={b.codigo} className={styles.barraRow}>
                  <div className={styles.barraLab}>
                    <span className={b.esActivo ? styles.barraLabActivo : ''}>{b.nombre}</span>
                    <span className={`${styles.barraVal} mono`}>
                      {b.twrPct >= 0 ? '+' : ''}
                      {b.twrPct.toFixed(1)} %
                    </span>
                  </div>
                  <div className={styles.barraTrack}>
                    <div className={styles.barraEje} />
                    <div
                      className={`${styles.barraFill} ${positivo ? styles.barraPos : styles.barraNeg} ${b.esActivo ? styles.barraActivo : ''}`}
                      style={{
                        width: `${ancho}%`,
                        left: positivo ? '50%' : `${50 - ancho}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {bannerVisible && (
            <div className={`${styles.banner} ${styles.bannerWarn}`} role="status">
              <div className={styles.bannerBody}>{analisisCopy}</div>
              <button
                type="button"
                className={styles.bannerClose}
                onClick={cerrar}
                aria-label="Cerrar aviso de análisis benchmark"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default BloqueBenchmark;
