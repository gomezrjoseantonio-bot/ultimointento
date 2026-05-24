import React, { useEffect } from 'react';
import { Icons, showToastV5 } from '../../../../../design-system/v5';
import type { Contract, VolveriaAAlquilar } from '../../../../../services/db';
import {
  CSS_COLOR_HABITACION,
  habitacionNumeroDe,
  resolverColorHabitacion,
} from '../../../utils/timelineColores';
import { mapearTipoContrato } from '../../../utils/mapearTipoContrato';
import { generarIniciales, getInquilinoNombre } from '../../../utils/inquilinoUtils';
import {
  calcularDiasDesdeSalida,
  calcularDuracionMeses,
  fechaCierreEfectiva,
  obtenerStatsPagos,
  textoCortoSalida,
  textoFianzaDevuelta,
} from '../../../utils/historico/calculos';
import { formatEuros, formatearFechaCorta } from '../../../utils/historico/formato';
import type { MotivoFinKey } from '../../../utils/historico/tipos';
import { CONFIG_MOTIVO_BOX } from './motivoConfig';
import { Estrellas } from './TablaExInquilinos';
import styles from './DrawerExContrato.module.css';

const toastProximamente = (msg: string): void => showToastV5(msg);

export interface DrawerExContratoProps {
  contrato: Contract;
  inmuebleAlias?: string;
  open: boolean;
  onClose: () => void;
}

const DrawerExContrato: React.FC<DrawerExContratoProps> = ({
  contrato,
  inmuebleAlias,
  open,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const nombre = getInquilinoNombre(contrato);
  const colorHab = resolverColorHabitacion(contrato);
  const duracion = Math.round(calcularDuracionMeses(contrato));

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Ex-contrato · ${nombre}`}
        className={styles.drawer}
      >
        <Hero
          contrato={contrato}
          nombre={nombre}
          inmuebleAlias={inmuebleAlias}
          duracion={duracion}
          onClose={onClose}
        />

        <div className={styles.body}>
          <SeccionExInquilino contrato={contrato} colorHab={colorHab} nombre={nombre} />
          <SeccionResumenContrato contrato={contrato} duracion={duracion} />
          <SeccionMotivoSalida contrato={contrato} />
          <SeccionHistorialPagos contrato={contrato} />
          <SeccionNotasCasero contrato={contrato} />
        </div>

        <Footer onClose={onClose} />
      </aside>
    </>
  );
};

interface HeroProps {
  contrato: Contract;
  nombre: string;
  inmuebleAlias?: string;
  duracion: number;
  onClose: () => void;
}

const Hero: React.FC<HeroProps> = ({ contrato, nombre, inmuebleAlias, duracion, onClose }) => {
  const diasSalida = calcularDiasDesdeSalida(contrato);
  const habNum = habitacionNumeroDe(contrato);
  return (
    <div className={styles.hero}>
      <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
        <Icons.Close size={16} strokeWidth={1.8} />
      </button>
      <div className={styles.heroLabel}>Ex-inquilino · contrato finalizado</div>
      <h2 className={styles.heroTitle}>{nombre}</h2>
      <p className={styles.heroSub}>
        {inmuebleAlias ?? `Inmueble #${contrato.inmuebleId}`}
        {contrato.unidadTipo === 'habitacion'
          ? ` · Hab ${habNum ?? '—'}`
          : ' · piso completo'}
      </p>
      <div className={styles.heroStats}>
        <Stat label="Duró" value={`${duracion} m`} />
        <Stat label="Salió" value={textoCortoSalida(diasSalida, contrato)} />
        <Stat label="Valoración" value={<Estrellas n={contrato.valoracion ?? null} />} />
      </div>
    </div>
  );
};

interface StatProps {
  label: string;
  value: React.ReactNode;
}
const Stat: React.FC<StatProps> = ({ label, value }) => (
  <div className={styles.heroStat}>
    <div className={styles.heroStatLabel}>{label}</div>
    <div className={styles.heroStatValue}>{value}</div>
  </div>
);

interface SeccionExInquilinoProps {
  contrato: Contract;
  colorHab: keyof typeof CSS_COLOR_HABITACION;
  nombre: string;
}
const SeccionExInquilino: React.FC<SeccionExInquilinoProps> = ({ contrato, colorHab, nombre }) => {
  const inq = contrato.inquilino;
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Ex-inquilino</h3>
      <div className={styles.tenant}>
        <div
          className={styles.tenantAvatar}
          style={{ background: CSS_COLOR_HABITACION[colorHab] }}
          aria-hidden
        >
          {generarIniciales(nombre)}
        </div>
        <div className={styles.tenantInfo}>
          <div className={styles.tenantName}>{nombre}</div>
          <div className={styles.tenantMeta}>
            {inq?.dni ? `DNI ${inq.dni}` : 'Sin DNI'}
          </div>
          <div className={styles.tenantActions}>
            {inq?.email && (
              <a href={`mailto:${inq.email}`} className={styles.tBtn}>
                <Icons.Mail size={11} strokeWidth={1.8} /> Email
              </a>
            )}
            {inq?.telefono && (
              <a
                href={`https://wa.me/${inq.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.tBtn}
              >
                <Icons.ExternalLink size={11} strokeWidth={1.8} /> WhatsApp
              </a>
            )}
            <button
              type="button"
              className={`${styles.tBtn} ${styles.tBtnInvitar}`}
              onClick={() => toastProximamente('Invitar a volver próximamente')}
            >
              <Icons.Star size={11} strokeWidth={1.8} /> Invitar a volver
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

interface SeccionResumenProps {
  contrato: Contract;
  duracion: number;
}
const SeccionResumenContrato: React.FC<SeccionResumenProps> = ({ contrato, duracion }) => {
  const tipo = mapearTipoContrato(contrato);
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Resumen del contrato</h3>
      <div className={styles.fieldsGrid}>
        <Field label="Desde" value={formatearFechaCorta(contrato.fechaInicio)} />
        <Field label="Hasta" value={formatearFechaCorta(fechaCierreEfectiva(contrato))} />
        <Field label="Duración real" value={`${duracion} meses`} />
        <Field label="Tipo" value={tipo === 'corta' ? 'Corta estancia' : 'Larga estancia'} />
        <Field label="Renta pagada" value={`${formatEuros(contrato.rentaMensual)} €/mes`} />
        <Field label="Fianza devuelta" value={textoFianzaDevuelta(contrato)} />
      </div>

      <div className={styles.volveria}>
        <div className={styles.volveriaHead}>
          <span className={styles.volveriaLab}>¿Volverías a alquilarle?</span>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => toastProximamente('Edición de respuesta próximamente · T6.3')}
          >
            <Icons.Edit size={11} strokeWidth={1.8} /> Editar
          </button>
        </div>
        <VolveriaPills value={contrato.volveriaAAlquilar ?? null} />
      </div>
    </section>
  );
};

interface FieldProps {
  label: string;
  value: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ label, value }) => (
  <div>
    <div className={styles.fldLab}>{label}</div>
    <div className={styles.fldVal}>{value}</div>
  </div>
);

interface VolveriaPillsProps {
  value: VolveriaAAlquilar | null;
}
export const VolveriaPills: React.FC<VolveriaPillsProps> = ({ value }) => {
  if (value === null) {
    return <div className={styles.volveriaEmpty}>— sin respuesta</div>;
  }
  return (
    <div className={styles.volveriaPills}>
      <PillVolveria activo={value === 'si'} tono="ok" texto="Sí, sin dudarlo" />
      <PillVolveria activo={value === 'con_reservas'} tono="warn" texto="Con reservas" />
      <PillVolveria activo={value === 'no'} tono="neg" texto="No" />
    </div>
  );
};

interface PillVolveriaProps {
  activo: boolean;
  tono: 'ok' | 'warn' | 'neg';
  texto: string;
}
const PillVolveria: React.FC<PillVolveriaProps> = ({ activo, tono, texto }) => {
  const cls = [
    styles.pillVolveria,
    styles[`pillVolveria_${tono}` as const],
    activo ? styles.pillVolveriaActiva : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls}>
      {activo && <Icons.Check size={10} strokeWidth={2.2} />} {texto}
    </span>
  );
};

interface MotivoProps {
  contrato: Contract;
}
const SeccionMotivoSalida: React.FC<MotivoProps> = ({ contrato }) => {
  const motivo: MotivoFinKey = contrato.motivoFin ?? 'sin_clasificar';
  const cfg = CONFIG_MOTIVO_BOX[motivo];
  const IconoMotivo = cfg.icon;
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Motivo de salida</h3>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => toastProximamente('Edición de motivo próximamente · T6.1')}
        >
          <Icons.Edit size={11} strokeWidth={1.8} /> Editar
        </button>
      </div>
      <div className={`${styles.reasonBox} ${styles[`reasonBox_${cfg.tono}` as const]}`}>
        <div className={styles.reasonIcon}>
          <IconoMotivo size={18} strokeWidth={1.8} />
        </div>
        <div>
          <div className={styles.reasonTitle}>{cfg.titulo}</div>
          <div className={styles.reasonDetail}>
            {contrato.detalleMotivoFin ?? cfg.detalleDefault}
          </div>
        </div>
      </div>
    </section>
  );
};

const SeccionHistorialPagos: React.FC<MotivoProps> = ({ contrato }) => {
  const stats = obtenerStatsPagos(contrato);
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Historial de pagos</h3>
      <div className={styles.paySummary}>
        <div className={styles.payItem}>
          <div className={`${styles.payVal} ${stats.alDia !== null ? styles.payValPos : ''}`}>
            {stats.alDia ?? '—'}
          </div>
          <div className={styles.payLab}>Mensualidades al día</div>
        </div>
        <div className={styles.payItem}>
          <div className={`${styles.payVal} ${stats.conRetraso !== null ? styles.payValWarn : ''}`}>
            {stats.conRetraso ?? '—'}
          </div>
          <div className={styles.payLab}>Con retraso ({'<10d'})</div>
        </div>
        <div className={styles.payItem}>
          <div className={`${styles.payVal} ${stats.impagos !== null ? styles.payValNeg : ''}`}>
            {stats.impagos ?? '—'}
          </div>
          <div className={styles.payLab}>Impagos</div>
        </div>
      </div>
      {stats.alDia === null && (
        <div className={styles.emptyMini}>
          Información de pagos próximamente · pendiente integración del módulo de cobros.
        </div>
      )}
    </section>
  );
};

const SeccionNotasCasero: React.FC<MotivoProps> = ({ contrato }) => {
  const notas = contrato.notasCasero ?? '';
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Notas del casero</h3>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => toastProximamente('Edición de notas próximamente · T6.2')}
        >
          <Icons.Edit size={11} strokeWidth={1.8} /> Editar
        </button>
      </div>
      <div className={styles.notes}>
        {notas || <em className={styles.emptyText}>Sin notas registradas para este inquilino.</em>}
      </div>
    </section>
  );
};

interface FooterProps {
  onClose: () => void;
}
const Footer: React.FC<FooterProps> = ({ onClose }) => (
  <div className={styles.footer}>
    <button type="button" className={styles.btnGhost} onClick={onClose}>
      Cerrar
    </button>
    <button
      type="button"
      className={styles.btnGhost}
      onClick={() => toastProximamente('Descarga de contrato próximamente')}
    >
      <Icons.Download size={12} strokeWidth={1.8} /> Descargar contrato
    </button>
    <button
      type="button"
      className={styles.btnPrimary}
      onClick={() => toastProximamente('Reactivar contrato próximamente · T6.6')}
    >
      <Icons.Refresh size={12} strokeWidth={1.8} /> Reactivar contrato
    </button>
  </div>
);

export default DrawerExContrato;
export { DrawerExContrato };
