import React, { useEffect, useState } from 'react';
import { Send, RotateCw } from 'lucide-react';
import {
  Icons,
  MoneyValue,
  DateLabel,
  Pill,
  EmptyState,
  showToastV5,
} from '../../../../design-system/v5';
import type { Contract } from '../../../../services/db';
import {
  calcularEstadoChip,
  type EstadoChip,
  estaFirmado,
} from '../../utils/calcularEstadoChip';
import {
  getEstadoEfectivo,
  diasHastaFin,
  type EstadoEfectivo,
} from '../../utils/estadoEfectivoService';
import { parseIsoDateAsUTC } from '../../../../utils/recurrenceDateUtils';
import { formatFechaFinContrato } from '../../utils/formatFechaFin';
import { habitacionNumeroDe } from '../../utils/timelineColores';
import {
  colorAvatarPorContrato,
  generarIniciales,
  getInquilinoNombre,
} from '../../utils/inquilinoUtils';
import styles from './DrawerFichaContrato.module.css';

export interface DrawerFichaContratoProps {
  contrato: Contract & { id: number };
  inmuebleAlias?: string;
  open: boolean;
  onClose: () => void;
}

const PILL_LABEL: Record<EstadoChip, { variant: 'gris' | 'warn' | 'neg' | 'brand'; label: string }> = {
  'al-dia':     { variant: 'gris',  label: 'Al día' },
  'vence-30d':  { variant: 'warn',  label: 'Vence 30 d' },
  impago:       { variant: 'neg',   label: 'Impago' },
  'sin-firmar': { variant: 'brand', label: 'Sin firmar' },
};

const accionPorEstado = (estado: EstadoChip): { label: string; toastSuffix: string } => {
  switch (estado) {
    case 'al-dia':     return { label: 'Renovar',              toastSuffix: 'T4' };
    case 'vence-30d':  return { label: 'Proponer renovación',  toastSuffix: 'T4' };
    case 'impago':     return { label: 'Reclamar cobro',       toastSuffix: 'T4' };
    case 'sin-firmar': return { label: 'Enviar a firma',       toastSuffix: 'T3.8' };
  }
};

// ── Commit 6 · 3 variantes del drawer según estado EFECTIVO (por fechas) ──

/** Etiqueta del hero · cambia el tono según el contrato esté vivo, por empezar
 *  o ya terminado (mockup v5). */
export const DRAWER_LABEL: Record<EstadoEfectivo, string> = {
  vigente: 'Inquilino actual · contrato vigente',
  proximo: 'Próximo inquilino · aún no empieza',
  finalizado: 'Ex-inquilino · contrato finalizado',
};

export type AccionIcon = 'refresh' | 'send' | 'rotate';

export interface AccionPrincipal {
  label: string;
  icon: AccionIcon;
  toastSuffix: string;
}

/**
 * Acción primaria del footer según el estado efectivo:
 *   · finalizado → Reactivar contrato
 *   · proximo    → Enviar a firma (si no firmado) · Editar contrato (si firmado)
 *   · vigente    → según el chip de cobro (Renovar / Proponer / Reclamar / firma)
 */
export function accionPrincipalPorEstado(
  estadoEfectivo: EstadoEfectivo,
  estadoChip: EstadoChip,
  firmado: boolean,
): AccionPrincipal {
  if (estadoEfectivo === 'finalizado') {
    return { label: 'Reactivar contrato', icon: 'rotate', toastSuffix: 'T4' };
  }
  if (estadoEfectivo === 'proximo') {
    return firmado
      ? { label: 'Editar contrato', icon: 'refresh', toastSuffix: 'T3.2' }
      : { label: 'Enviar a firma', icon: 'send', toastSuffix: 'T3.8' };
  }
  const a = accionPorEstado(estadoChip);
  return {
    label: a.label,
    icon: estadoChip === 'sin-firmar' ? 'send' : 'refresh',
    toastSuffix: a.toastSuffix,
  };
}

const MS_DIA = 1000 * 60 * 60 * 24;
const diaUTC = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Días desde hoy hasta `fechaInicio` (ceil, min 0) · usado en variante proximo. */
function diasHastaInicio(c: Contract, hoy: Date = new Date()): number {
  const inicio = parseIsoDateAsUTC(c.fechaInicio);
  if (Number.isNaN(inicio.getTime())) return 0;
  return Math.max(0, Math.ceil((inicio.getTime() - diaUTC(hoy)) / MS_DIA));
}

/** Duración en meses redondeados entre inicio y fin · usado en variante finalizado. */
function duracionMeses(c: Contract): number | null {
  const ini = parseIsoDateAsUTC(c.fechaInicio);
  const fin = parseIsoDateAsUTC(c.fechaFin ?? '');
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return null;
  return Math.max(0, Math.round((fin.getTime() - ini.getTime()) / (MS_DIA * 30.44)));
}

/** Tercer stat del hero · contextual al estado efectivo. */
function statContextual(
  estadoEfectivo: EstadoEfectivo,
  c: Contract,
): { label: string; value: string; dim?: boolean } {
  if (estadoEfectivo === 'proximo') {
    return { label: 'Empieza en', value: `${diasHastaInicio(c)} d` };
  }
  if (estadoEfectivo === 'finalizado') {
    const m = duracionMeses(c);
    return { label: 'Duró', value: m != null ? `${m} m` : '—', dim: m == null };
  }
  const d = diasHastaFin(c);
  return d == null
    ? { label: 'Vence', value: 'Indefinido', dim: true }
    : { label: 'Vence en', value: `${d} d` };
}

const REDUCCION_LABEL: Record<string, string> = {
  transitorio_pre_2023: 'Transitorio (pre-2023)',
  general_post_2023: 'General (post-2023)',
  rehabilitacion: 'Rehabilitación',
  zona_tensionada_joven: 'Zona tensionada · joven',
  zona_tensionada_rebaja: 'Zona tensionada · rebaja',
};

const formatReduccion = (c: Contract): string => {
  if (!c.reduccion?.activa) return 'No aplica';
  const motivo = c.reduccion.motivo ? REDUCCION_LABEL[c.reduccion.motivo] ?? c.reduccion.motivo : '';
  return motivo
    ? `${c.reduccion.porcentaje}% · ${motivo}`
    : `${c.reduccion.porcentaje}%`;
};

const DrawerFichaContrato: React.FC<DrawerFichaContratoProps> = ({
  contrato,
  inmuebleAlias,
  open,
  onClose,
}) => {
  const [tabActivo, setTabActivo] = useState<'ficha' | 'actividad'>('ficha');

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
  const iniciales = generarIniciales(nombre);
  const colorAvatar = colorAvatarPorContrato(contrato);
  const estado = calcularEstadoChip(contrato);
  const pill = PILL_LABEL[estado];
  const firmado = estaFirmado(contrato);
  const estadoEfectivo = getEstadoEfectivo(contrato);
  const accion = accionPrincipalPorEstado(estadoEfectivo, estado, firmado);
  const statCtx = statContextual(estadoEfectivo, contrato);
  const AccionIconCmp = accion.icon === 'send' ? Send : accion.icon === 'rotate' ? RotateCw : Icons.Refresh;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de contrato · ${nombre}`}
        className={styles.drawer}
      >
        <div className={styles.hero}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
          <div className={styles.heroLabel}>{DRAWER_LABEL[estadoEfectivo]}</div>
          <div className={styles.heroNameRow}>
            <div
              className={styles.heroAvatar}
              style={{ background: colorAvatar }}
              aria-hidden
            >
              {iniciales}
            </div>
            <div className={styles.heroNameBox}>
              <h2 className={styles.heroTitle}>{nombre}</h2>
              <p className={styles.heroSub}>
                {inmuebleAlias ?? `Inmueble #${contrato.inmuebleId}`}
                {contrato.unidadTipo === 'vivienda'
                  ? ' · Piso completo'
                  : ` · Hab ${habitacionNumeroDe(contrato) ?? '—'}`}
                {' · '}
                <Pill variant={pill.variant} asTag>{pill.label}</Pill>
              </p>
            </div>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatLabel}>Renta</div>
              <div className={styles.heroStatValue}>
                <MoneyValue value={contrato.rentaMensual ?? 0} decimals={0} tone="ink" />
              </div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatLabel}>Fianza</div>
              <div className={styles.heroStatValue}>
                {contrato.fianzaImporte != null
                  ? <MoneyValue value={contrato.fianzaImporte} decimals={0} tone="ink" />
                  : '—'}
              </div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatLabel}>{statCtx.label}</div>
              <div
                className={styles.heroStatValue}
                style={statCtx.dim ? { opacity: 0.6 } : undefined}
              >
                {statCtx.value}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tabActivo === 'ficha'}
            className={`${styles.tab} ${tabActivo === 'ficha' ? styles.tabActive : ''}`}
            onClick={() => setTabActivo('ficha')}
          >
            <Icons.Contratos size={13} strokeWidth={1.8} /> Ficha
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tabActivo === 'actividad'}
            className={`${styles.tab} ${tabActivo === 'actividad' ? styles.tabActive : ''}`}
            onClick={() => setTabActivo('actividad')}
          >
            <Icons.Activity size={13} strokeWidth={1.8} /> Actividad
          </button>
        </div>

        <div className={styles.body}>
          {tabActivo === 'ficha' ? (
            <PanelFicha
              contrato={contrato}
              firmado={firmado}
              estadoEfectivo={estadoEfectivo}
            />
          ) : (
            <EmptyState
              icon={<Icons.Activity size={20} />}
              title="Registro de actividad próximamente"
              sub="Aquí podrás registrar llamadas, mensajes, visitas y notas con tus inquilinos · y consultar la línea de tiempo completa. Disponible en T3.4."
            />
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => showToastV5('Descarga PDF próximamente · T3.7')}
          >
            <Icons.Download size={12} strokeWidth={1.8} /> Descargar PDF
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => showToastV5(`${accion.label} próximamente · ${accion.toastSuffix}`)}
          >
            <AccionIconCmp size={12} strokeWidth={1.8} /> {accion.label}
          </button>
        </div>
      </aside>
    </>
  );
};

interface PanelFichaProps {
  contrato: Contract & { id: number };
  firmado: boolean;
  estadoEfectivo: EstadoEfectivo;
}

const PanelFicha: React.FC<PanelFichaProps> = ({ contrato, firmado, estadoEfectivo }) => {
  const inq = contrato.inquilino;
  const esSinFirmar = contrato.estadoContrato === 'sin_firmar';
  const esFinalizado = estadoEfectivo === 'finalizado';

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Inquilino</h3>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => showToastV5('Edición de datos próximamente · T3.2')}
          >
            <Icons.Edit size={11} strokeWidth={1.8} /> Editar datos
          </button>
        </div>
        <div className={styles.tenantActions}>
          {inq?.telefono && (
            <a
              href={`tel:${inq.telefono}`}
              className={styles.tBtn}
              onClick={(e) => e.stopPropagation()}
            >
              <Icons.Phone size={11} strokeWidth={1.8} /> Llamar
            </a>
          )}
          {inq?.email && (
            <a
              href={`mailto:${inq.email}`}
              className={styles.tBtn}
              onClick={(e) => e.stopPropagation()}
            >
              <Icons.Mail size={11} strokeWidth={1.8} /> Email
            </a>
          )}
          {inq?.telefono && (
            <a
              href={`https://wa.me/${inq.telefono.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.tBtn}
              onClick={(e) => e.stopPropagation()}
            >
              <Icons.ExternalLink size={11} strokeWidth={1.8} /> WhatsApp
            </a>
          )}
        </div>
        <Field label="DNI" value={inq?.dni || '—'} mono />
        <Field label="Email" value={inq?.email || '—'} />
        <Field label="Teléfono" value={inq?.telefono || '—'} mono />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Términos del contrato</h3>
          {/* V79 · un contrato SIN FIRMAR es editable en su totalidad sin anexo;
              la regla de bloqueo + anexo solo aplica a contratos ya activos. */}
          {esFinalizado ? (
            <span className={styles.lockedBadge}>
              <Icons.Lock size={10} strokeWidth={1.8} /> Finalizado · solo lectura
            </span>
          ) : esSinFirmar ? (
            <span className={styles.editableBadge}>
              <Icons.Edit size={10} strokeWidth={1.8} /> Sin firmar · editable
            </span>
          ) : (
            <span className={styles.lockedBadge}>
              <Icons.Lock size={10} strokeWidth={1.8} /> Bloqueado · requiere anexo
            </span>
          )}
        </div>
        <div className={styles.fieldsGrid}>
          <Field label="Desde" value={<DateLabel value={contrato.fechaInicio} format="short" size="sm" />} />
          <Field label="Hasta" value={formatFechaFinContrato(contrato.fechaFin)} />
          <Field
            label="Renta mensual"
            value={<MoneyValue value={contrato.rentaMensual ?? 0} decimals={0} tone="ink" />}
          />
          <Field
            label="Fianza"
            value={
              contrato.fianzaImporte != null
                ? <MoneyValue value={contrato.fianzaImporte} decimals={0} tone="ink" />
                : '—'
            }
          />
          <Field
            label="Día de pago"
            value={contrato.diaPago ? `${contrato.diaPago} de cada mes` : '—'}
          />
          <Field label="Reducción fiscal" value={formatReduccion(contrato)} />
          <Field label="Estado firma" value={firmado ? 'Firmado' : 'Pendiente'} />
          <Field
            label="Indexación"
            value={contrato.indexacion === 'none' ? 'No aplica' : (contrato.indexacion ?? '—')}
          />
        </div>
        {!esSinFirmar && !esFinalizado && (
          <div className={styles.anexoRow}>
            <div>
              <strong>¿Necesitas cambiar un término económico?</strong>
              <p>
                Modificar renta, fianza o fechas requiere firmar un anexo al
                contrato. ATLAS generará el anexo automáticamente y lo enviará
                al inquilino.
              </p>
            </div>
            <button
              type="button"
              className={styles.anexoBtn}
              onClick={() => showToastV5('Generación de anexos próximamente · T3.3')}
            >
              <Icons.Contratos size={12} strokeWidth={1.8} /> Generar anexo
            </button>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Documentos</h3>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => showToastV5('Subir documento próximamente · T3.7')}
          >
            <Icons.Plus size={11} strokeWidth={1.8} /> Añadir
          </button>
        </div>
        <div className={styles.emptyMini}>
          Integración con módulo Archivo próximamente · T3.7.
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Últimos cobros</h3>
        <div className={styles.emptyMini}>
          Integración con servicio de cobros próximamente · T3.6.
        </div>
      </section>
    </>
  );
};

interface FieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, mono }) => (
  <div className={styles.field}>
    <div className={styles.fieldLabel}>{label}</div>
    <div className={`${styles.fieldValue} ${mono ? styles.fieldValueMono : ''}`}>
      {value}
    </div>
  </div>
);

export default DrawerFichaContrato;
export { DrawerFichaContrato };
