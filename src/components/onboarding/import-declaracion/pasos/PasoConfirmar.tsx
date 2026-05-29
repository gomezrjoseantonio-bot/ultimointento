/**
 * PasoConfirmar.tsx · Wizard import XML V2 · paso 10 (§ 4.13).
 * Resumen final con contadores + "Importar todo" → s.importar() (multi-ejercicio,
 * Fase A por año + Fase B opt-in en la última llamada). Loader + toast + cierre.
 */

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Lightbulb, X, Check, Loader } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { useInmueblesDetectados } from '../useInmueblesDetectados';
import { detectarProveedores, detectarPlanesXml } from '../deteccion';
import styles from '../WizardImportarDeclaracion.module.css';

interface Props {
  s: WizardImportState;
  onClose: () => void;
  onImported?: () => void;
}

const ResCard: React.FC<{ lab: string; val: React.ReactNode; sub: string; variant?: 'brand' | 'soft' }> = ({
  lab,
  val,
  sub,
  variant,
}) => (
  <div className={`${styles.resumenCard} ${variant ? styles[variant] : ''}`}>
    <div className={styles.resLab}>{lab}</div>
    <div className={styles.resVal}>{val}</div>
    <div className={styles.resSub}>{sub}</div>
  </div>
);

const PasoConfirmar: React.FC<Props> = ({ s, onClose, onImported }) => {
  const [smartCerrado, setSmartCerrado] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const det = useInmueblesDetectados(s.declaraciones);

  const provs = useMemo(() => detectarProveedores(s.declaraciones), [s.declaraciones]);
  const planes = useMemo(() => detectarPlanesXml(s.declaraciones), [s.declaraciones]);
  const ibanesCrear = (s.opciones.ibanAcciones ?? []).filter((a) => a.accion !== 'ignorar').length;
  const totalArrend = det.totalArrendamientos;

  const onImportar = async () => {
    setErrores([]);
    const r = await s.importar();
    if (r.errores.length === 0) {
      toast.success(`Importación completada · ${r.informes.length} ejercicio(s)`);
      onImported?.();
      onClose();
    } else {
      setErrores(r.errores);
      toast.error('Importación con incidencias · revisa el detalle');
    }
  };

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>10</span> Confirmar importación
      </div>
      <div className={styles.stepSub}>
        Revisa lo que se va a crear y actualizar · al confirmar, ATLAS aplicará los cambios de los{' '}
        {s.declaraciones.length} ejercicio(s) cronológicamente.
      </div>

      <div className={styles.secTitle}>
        Datos personales y laborales <span className={styles.count}>a crear</span>
      </div>
      <div className={styles.resumenGrid}>
        <ResCard lab="Titular" val={s.declaracionPrincipal ? 1 : 0} sub={s.declaracionPrincipal?.declarante.nombreCompleto ?? '—'} variant="brand" />
        <ResCard lab="Nómina activa" val={s.opciones.crearNominaActiva ? 1 : 0} sub={s.opciones.crearNominaActiva ? 'Se creará en Personal' : 'No se creará'} />
        <ResCard lab="Actividad autónoma" val={s.opciones.crearActividadAutonoma ? 1 : 0} sub={s.opciones.crearActividadAutonoma ? 'Se creará en Personal' : 'No se creará'} />
      </div>

      <div className={styles.secTitle}>
        Patrimonio inmobiliario <span className={styles.count}>a crear / enriquecer</span>
      </div>
      <div className={styles.resumenGrid}>
        <ResCard lab="Inmuebles nuevos" val={det.nuevos.length} sub="Se crean con perfil del paso 2" />
        <ResCard lab="Inmuebles enriquecidos" val={det.existentes.length} sub="Se actualizan los existentes" variant="brand" />
        <ResCard lab="Accesorios vinculados" val={det.accesorios.length} sub="Parking / trastero" variant="soft" />
      </div>

      <div className={styles.secTitle}>
        Ingresos y proveedores <span className={styles.count}>silenciosamente</span>
      </div>
      <div className={styles.resumenGrid}>
        <ResCard lab="Cuentas IBAN" val={ibanesCrear} sub="Según tu decisión del paso 3" />
        <ResCard lab="Proveedores placeholder" val={provs.length} sub="NIF crudo · sin nombre" />
        <ResCard lab="Plan de pensiones" val={planes.length} sub="Por NIF empleador" variant="brand" />
      </div>

      <div className={styles.secTitle}>
        Datos fiscales por ejercicio <span className={styles.count}>{s.declaraciones.length} años</span>
      </div>
      <div className={styles.resumenGrid}>
        <ResCard lab="Ejercicios" val={s.declaraciones.length} sub="Cargados en Fiscal" />
        <ResCard lab="Arrendamientos" val={totalArrend} sub="Distribuidos por año" />
        <ResCard lab="Inmuebles totales" val={det.inmuebles.length} sub="En tu cartera" />
      </div>

      {errores.length > 0 && (
        <div className={styles.smart} style={{ background: 'var(--neg-wash)', borderColor: 'var(--neg)', color: 'var(--neg)' }}>
          <X className={styles.smartIcon} size={15} style={{ color: 'var(--neg)' }} />
          <div>
            <strong>Incidencias durante la importación:</strong>
            <ul style={{ margin: '4px 0 0 16px' }}>
              {errores.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!smartCerrado && (
        <div className={styles.smart} style={{ marginTop: 16 }}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>Otros datos fiscales se registran silenciosamente · </strong>
            revísalos en cada módulo cuando lo necesites · están todos los arrendamientos declarados
            por inmueble, gastos e históricos por año.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* CTA principal del paso final (el footer del wizard no lo cubre). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPos}`}
          style={{ padding: '9px 22px' }}
          disabled={s.importando || s.declaraciones.length === 0}
          onClick={onImportar}
        >
          {s.importando ? (
            <>
              <Loader size={14} /> Importando…
            </>
          ) : (
            <>
              Importar todo <Check size={14} strokeWidth={2.2} />
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default PasoConfirmar;
