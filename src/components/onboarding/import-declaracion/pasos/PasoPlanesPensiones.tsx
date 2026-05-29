/**
 * PasoPlanesPensiones.tsx · Wizard import XML V2 · paso 5 (§ 4.8 · § 7.4).
 * Muestra los planes detectados en el XML (PPE por NIF empleador) y, si hay
 * planes duplicados en data existente, un banner de fusión 1-click conectado a
 * aeatPlanesPensionesImportService.fusionarDuplicados.
 *
 * Las aportaciones se importan en Fase A (aeatPlanesPensionesImportService) ·
 * este paso no añade decisiones a `opciones`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Lightbulb, X, AlertTriangle, ChevronDown } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { detectarPlanesXml } from '../deteccion';
import {
  detectarDuplicadosPorEmpleador,
  fusionarDuplicados,
  type GrupoDuplicadoPlan,
} from '../../../../services/aeatPlanesPensionesImportService';
import styles from '../WizardImportarDeclaracion.module.css';

function fmtEuro(n: number): string {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const PasoPlanesPensiones: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const [smartCerrado, setSmartCerrado] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<GrupoDuplicadoPlan[]>([]);
  const [fusionando, setFusionando] = useState<string | null>(null);

  const planes = useMemo(() => detectarPlanesXml(s.declaraciones), [s.declaraciones]);

  // Detectar duplicados en data existente que coincidan con un empleador del XML.
  const cifsXml = useMemo(
    () => new Set(planes.map((p) => (p.nifEmpleador ?? '').toUpperCase()).filter(Boolean)),
    [planes],
  );

  const refrescarDuplicados = useCallback(async () => {
    try {
      const grupos = await detectarDuplicadosPorEmpleador();
      setDuplicados(grupos.filter((g) => cifsXml.size === 0 || cifsXml.has(g.cif.toUpperCase())));
    } catch {
      setDuplicados([]);
    }
  }, [cifsXml]);

  useEffect(() => {
    void refrescarDuplicados();
  }, [refrescarDuplicados]);

  useEffect(() => {
    if (expandido === null && planes.length > 0) {
      setExpandido(planes[0].nifEmpleador ?? '__sin_cif__');
    }
  }, [planes, expandido]);

  const onFusionar = async (g: GrupoDuplicadoPlan) => {
    setFusionando(g.cif);
    try {
      const r = await fusionarDuplicados(g.cif);
      toast.success(`${r.fusionados + 1} planes fusionados en 1 · empleador ${g.cif}`);
      await refrescarDuplicados();
    } catch {
      toast.error('No se pudo fusionar · inténtalo desde Inversiones');
    } finally {
      setFusionando(null);
    }
  };

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>05</span> Planes de pensiones detectados
      </div>
      <div className={styles.stepSub}>
        Estas aportaciones a planes de pensiones aparecen en los XMLs · se importan automáticamente y
        se unifican por NIF empleador.
      </div>

      {duplicados.map((g) => (
        <div key={g.cif} className={styles.ppFusionBanner}>
          <AlertTriangle size={20} />
          <div className={styles.ppFusionText}>
            <strong>
              Detectamos {g.total} planes con mismo empleador {g.cif} en tu ATLAS ·{' '}
            </strong>
            parecen ser el mismo plan con matching frágil entre años.
            <button
              type="button"
              className={`${styles.btn} ${styles.btnMini} ${styles.btnPos}`}
              style={{ marginLeft: 6 }}
              disabled={fusionando === g.cif}
              onClick={() => onFusionar(g)}
            >
              {fusionando === g.cif ? 'Fusionando…' : 'Fusionar ahora'}
            </button>
          </div>
        </div>
      ))}

      {planes.length > 0 ? (
        planes.map((p) => {
          const key = p.nifEmpleador ?? '__sin_cif__';
          const abierto = expandido === key;
          return (
            <div key={key} className={`${styles.inmCard} ${abierto ? styles.expanded : ''}`} style={{ marginBottom: 14 }}>
              <div
                className={styles.inmHead}
                onClick={() => setExpandido(abierto ? null : key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setExpandido(abierto ? null : key);
                }}
              >
                <div className={styles.inmId}>
                  <div className={styles.inmAlias}>
                    {p.nombreEmpleador ? `PPE ${p.nombreEmpleador}` : 'Plan de empleo (PPE)'}
                  </div>
                  <div className={styles.inmRc}>
                    {p.nifEmpleador ? `NIF empleador ${p.nifEmpleador}` : 'sin NIF empleador en XML'}
                  </div>
                </div>
                <div className={styles.inmBadges}>
                  <span className={`${styles.badge} ${styles.badgeNuevo}`}>Detectado</span>
                  <span className={`${styles.badge} ${styles.badgeEnriquecer}`}>Enriquecer</span>
                </div>
                <div className={styles.inmChevron}>
                  <ChevronDown size={14} />
                </div>
              </div>

              {abierto && (
                <div className={styles.inmBody}>
                  <div className={styles.inmSubSection}>
                    <div className={styles.inmSubTitle}>Aportaciones detectadas por año</div>
                    <div className={styles.fldGrid2}>
                      {p.porAnio.map((a) => (
                        <React.Fragment key={a.ejercicio}>
                          <div className={styles.fld}>
                            <label className={styles.fldLab}>{a.ejercicio} · Trabajador</label>
                            <input className={`${styles.inp} ${styles.mono}`} value={fmtEuro(a.trabajador)} readOnly />
                          </div>
                          <div className={styles.fld}>
                            <label className={styles.fldLab}>{a.ejercicio} · Empresa</label>
                            <input className={`${styles.inp} ${styles.mono}`} value={fmtEuro(a.empresa)} readOnly />
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div className={styles.inmSubSection}>
                    <div className={styles.inmSubTitle}>Matching por NIF empleador estable</div>
                    <p className={styles.ppNote}>
                      ATLAS unifica todas las aportaciones a este plan usando el NIF empleador como
                      clave única. Cuando importes un ejercicio futuro con mismo NIF, se sumará al
                      mismo plan automáticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>No se detectaron planes de pensiones en los XMLs</div>
          <div className={styles.skipSub}>Puedes crearlos manualmente en Inversiones cuando quieras.</div>
        </div>
      )}

      {!smartCerrado && (
        <div className={styles.smart}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>¿Tienes un plan individual (PPI) que no aparece aquí? </strong>
            Los PPI durmientes (sin aportaciones recientes) no aparecen en el XML · puedes crearlos
            manualmente en <strong>Inversiones</strong> · cuando vuelvas a aportar se vincularán
            automáticamente.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
};

export default PasoPlanesPensiones;
