// BloqueHitos · P4 ficha plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.5).
// PR 4 · cableado · combina hitos sistema (+10/+15 años · jubilación) +
// `objetivosVitales` filtrados por planFinancieroAsociado · banner cerrable
// `hitos-info`.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import { getHitosVitalesParaPosicion } from '../../../../services/objetivosVitalesService';
import { getEscenarioActivo } from '../../../../services/escenariosService';
import { personalDataService } from '../../../../services/personalDataService';
import type { ObjetivoVital } from '../../../../types/objetivosVitales';
import { useAvisoCerrable } from './useAvisoCerrable';
import styles from './bloques.module.css';

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

interface HitoItem {
  id: string;
  fecha: string; // ISO yyyy-mm-dd
  titulo: string;
  origen: 'sistema' | 'objetivo';
  urgencia: 'urgente' | 'normal' | 'futuro';
}

function urgenciaPara(fechaISO: string, hoy: Date): HitoItem['urgencia'] {
  const t = new Date(fechaISO).getTime() - hoy.getTime();
  const anios = t / MS_PER_YEAR;
  if (anios < 1) return 'urgente';
  if (anios < 5) return 'normal';
  return 'futuro';
}

export interface BloqueHitosProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Fecha de apertura del activo · ISO. */
  fechaApertura: string;
  /** Aviso cerrable · spec §9.1. */
  avisoId?: string;
}

const BloqueHitos = ({
  posicionId,
  tipoActivo,
  fechaApertura,
  avisoId = 'hitos-info',
}: BloqueHitosProps) => {
  const navigate = useNavigate();
  const [vitales, setVitales] = useState<ObjetivoVital[]>([]);
  const [edadRescate, setEdadRescate] = useState<number>(65);
  const [fechaNacimiento, setFechaNacimiento] = useState<string | null>(null);
  const { visible: bannerVisible, cerrar } = useAvisoCerrable(avisoId, {
    ubicacionContexto: `/inversiones/${posicionId}`,
    etiqueta: 'Hitos vitales · explicación',
  });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [hits, esc, personal] = await Promise.all([
          getHitosVitalesParaPosicion(posicionId).catch(() => [] as ObjetivoVital[]),
          getEscenarioActivo(),
          personalDataService.getPersonalData().catch(() => null),
        ]);
        if (cancelado) return;
        setVitales(hits);
        setEdadRescate(esc.edadObjetivoRescate ?? 65);
        setFechaNacimiento(personal?.fechaNacimiento ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [posicionId]);

  const hitos = useMemo<HitoItem[]>(() => {
    const hoy = new Date();
    const out: HitoItem[] = [];
    if (fechaApertura) {
      const fAp = new Date(fechaApertura);
      if (!Number.isNaN(fAp.getTime())) {
        const f10 = new Date(fAp);
        f10.setFullYear(f10.getFullYear() + 10);
        if (f10 > hoy) {
          out.push({
            id: 'sys-10',
            fecha: f10.toISOString().slice(0, 10),
            titulo: 'Rescatable libremente · RD-Ley 1/2015',
            origen: 'sistema',
            urgencia: urgenciaPara(f10.toISOString(), hoy),
          });
        }
        const f15 = new Date(fAp);
        f15.setFullYear(f15.getFullYear() + 15);
        if (f15 > hoy) {
          out.push({
            id: 'sys-15',
            fecha: f15.toISOString().slice(0, 10),
            titulo: 'Antigüedad media · revisa rendimiento',
            origen: 'sistema',
            urgencia: urgenciaPara(f15.toISOString(), hoy),
          });
        }
      }
    }
    if (fechaNacimiento) {
      const fN = new Date(fechaNacimiento);
      if (!Number.isNaN(fN.getTime())) {
        const fJub = new Date(fN);
        fJub.setFullYear(fJub.getFullYear() + edadRescate);
        if (fJub > hoy) {
          out.push({
            id: 'sys-jub',
            fecha: fJub.toISOString().slice(0, 10),
            titulo: `Jubilación · ventana fiscal óptima (${edadRescate} años)`,
            origen: 'sistema',
            urgencia: urgenciaPara(fJub.toISOString(), hoy),
          });
        }
      }
    }
    for (const v of vitales) {
      out.push({
        id: v.id,
        fecha: v.fechaEstimada,
        titulo: v.nombre,
        origen: 'objetivo',
        urgencia: urgenciaPara(v.fechaEstimada, hoy),
      });
    }
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);
  }, [fechaApertura, fechaNacimiento, edadRescate, vitales]);

  return (
    <section
      className={styles.bloque}
      data-bloque="P4"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      aria-label="Hitos"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Hitos vivos</div>
          <div className={styles.bloqueMensaje}>Eventos relevantes hasta el rescate</div>
          <div className={styles.bloqueSub}>
            sistema + objetivos vitales · ordenados por fecha · máximo 6
          </div>
          <div className={styles.srcChips}>
            <button
              type="button"
              className={styles.srcChip}
              onClick={() => navigate('/mi-plan/hitos-vitales')}
              aria-label="Editar objetivos vitales en Mi Plan"
            >
              Objetivos vitales · Mi Plan ↗
            </button>
          </div>
        </div>
      </div>
      <div className={styles.bloqueBody}>
        {hitos.length === 0 ? (
          <div className={styles.bloquePlaceholder}>
            Sin hitos · añade objetivos vitales en Mi Plan para verlos aquí.
          </div>
        ) : (
          <ol className={styles.timeline}>
            {hitos.map((h) => (
              <li key={h.id} className={`${styles.timelineItem} ${styles[`urg-${h.urgencia}`] ?? ''}`}>
                <div className={styles.timelineDot} />
                <div className={styles.timelineBody}>
                  <div className={`${styles.timelineFecha} mono`}>{h.fecha}</div>
                  <div className={styles.timelineTitulo}>{h.titulo}</div>
                  <div className={styles.timelineOrigen}>
                    {h.origen === 'sistema' ? 'derivado del plan' : 'desde Mi Plan'}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {bannerVisible && vitales.length === 0 && (
          <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
            <div className={styles.bannerBody}>
              No tienes objetivos vitales en Mi Plan · sólo verás los hitos del sistema.
              Añade los tuyos (jubilación, salida empresa, compra vivienda) en{' '}
              <strong>Mi Plan → Hitos vitales</strong>.
            </div>
            <button
              type="button"
              className={styles.bannerClose}
              onClick={cerrar}
              aria-label="Cerrar aviso de hitos"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default BloqueHitos;
