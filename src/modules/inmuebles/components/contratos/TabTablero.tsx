import React, { useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  Icons,
  MoneyValue,
  DateLabel,
  showToastV5,
} from '../../../../design-system/v5';
import type { Contract } from '../../../../services/db';
import {
  clasificarTablero,
  type ClasificacionTablero,
  type ItemTablero,
  type ItemHabitacionLibre,
  type StatsAnaliticos,
} from '../../utils/clasificarTablero';
import {
  colorAvatarPorContrato,
  generarIniciales,
  getInquilinoNombre,
} from '../../utils/inquilinoUtils';
import { formatFechaFinContrato } from '../../utils/formatFechaFin';
import { habitacionNumeroDe } from '../../utils/timelineColores';
import DrawerFichaContrato from './DrawerFichaContrato';
import DrawerLibres from './DrawerLibres';
import { calcularLibresAhora } from '../../utils/calcularLibresAhora';
import type { Property } from '../../../../services/db';
import styles from './TabTablero.module.css';

export interface TabTableroProps {
  contratos: Contract[];
  properties: Property[];
  inmuebleAliasById: Map<number, string>;
  onSwitchTabActivos: () => void;
  onNuevoContrato: (inmuebleId?: number) => void;
}

const toast = (msg: string) => () => showToastV5(msg);

function metaHabInmueble(contrato: Contract, alias: string): string {
  if (contrato.unidadTipo === 'vivienda') return `Piso completo · ${alias}`;
  const habNum = habitacionNumeroDe(contrato);
  return `Hab ${habNum ?? '—'} · ${alias}`;
}

const TabTablero: React.FC<TabTableroProps> = ({
  contratos,
  properties,
  inmuebleAliasById,
  onSwitchTabActivos,
  onNuevoContrato,
}) => {
  const hoy = useMemo(() => new Date(), []);
  const clasificacion = useMemo(
    () => clasificarTablero(contratos, properties, hoy),
    [contratos, properties, hoy],
  );

  const libresAhora = useMemo(
    () => calcularLibresAhora(contratos, properties, hoy),
    [contratos, properties, hoy],
  );

  const [contratoAbierto, setContratoAbierto] = useState<
    (Contract & { id: number }) | null
  >(null);
  const [drawerLibresOpen, setDrawerLibresOpen] = useState(false);
  const [lastFetchedAt] = useState<Date>(() => new Date());

  if (clasificacion.totalCategorias === 0) {
    return (
      <EmptyState
        icon={<Icons.Success size={20} />}
        title="Todo en calma"
        sub="Sin acciones pendientes en tu cartera. Los contratos están firmados, al día y sin vencimientos cercanos."
      />
    );
  }

  return (
    <div className={styles.root}>
      <CabeceraStats clasificacion={clasificacion} lastFetchedAt={lastFetchedAt} />

      {clasificacion.urgenteHoy.total > 0 && (
        <BloqueUrgenteHoy
          data={clasificacion.urgenteHoy}
          onAbrirContrato={setContratoAbierto}
          onAbrirDrawerLibres={() => setDrawerLibresOpen(true)}
          onNuevoContrato={onNuevoContrato}
        />
      )}

      {clasificacion.decisionSemana.total > 0 && (
        <BloqueDecisionSemana
          data={clasificacion.decisionSemana}
          onAbrirContrato={setContratoAbierto}
        />
      )}

      {clasificacion.planificarMes.total > 0 && (
        <BloquePlanificarMes
          data={clasificacion.planificarMes}
          onAbrirContrato={setContratoAbierto}
        />
      )}

      {clasificacion.buenasNoticias.total > 0 && (
        <BloqueBuenasNoticias
          data={clasificacion.buenasNoticias}
          stats={clasificacion.statsAnaliticos}
          onAbrirContrato={setContratoAbierto}
        />
      )}

      {clasificacion.silenciosos.total > 0 && (
        <NotaSilenciosos
          total={clasificacion.silenciosos.total}
          onIrAActivos={onSwitchTabActivos}
        />
      )}

      {contratoAbierto && (
        <DrawerFichaContrato
          contrato={contratoAbierto}
          inmuebleAlias={inmuebleAliasById.get(contratoAbierto.inmuebleId)}
          open
          onClose={() => setContratoAbierto(null)}
        />
      )}

      <DrawerLibres
        open={drawerLibresOpen}
        onClose={() => setDrawerLibresOpen(false)}
        data={libresAhora}
      />
    </div>
  );
};

// ─── CabeceraStats ──────────────────────────────────────────────────────────

interface CabeceraStatsProps {
  clasificacion: ClasificacionTablero;
  lastFetchedAt: Date;
}

const CabeceraStats: React.FC<CabeceraStatsProps> = ({ clasificacion, lastFetchedAt }) => {
  const minutos = useMinutosTranscurridos(lastFetchedAt);
  return (
    <div className={styles.head}>
      <div className={styles.headStats}>
        <HStat
          value={clasificacion.urgenteHoy.total}
          label="Urgente hoy"
          tone="neg"
        />
        <div className={styles.headSep} aria-hidden="true" />
        <HStat
          value={clasificacion.decisionSemana.total}
          label="Decisión esta semana"
          tone="warn"
        />
        <div className={styles.headSep} aria-hidden="true" />
        <HStat
          value={clasificacion.planificarMes.total}
          label="Planificar este mes"
          tone="muted"
        />
        <div className={styles.headSep} aria-hidden="true" />
        <HStat
          value={clasificacion.buenasNoticias.total}
          label="Buenas noticias"
          tone="pos"
        />
      </div>
      <div className={styles.headMeta}>
        <Icons.Clock size={12} strokeWidth={1.8} />
        {minutos === 0
          ? 'actualizado ahora'
          : `actualizado hace ${minutos} min`}
      </div>
    </div>
  );
};

const HStat: React.FC<{
  value: number;
  label: string;
  tone: 'neg' | 'warn' | 'muted' | 'pos';
}> = ({ value, label, tone }) => (
  <div
    className={styles.hstat}
    role="group"
    aria-label={`${value} ${label}`}
  >
    <div className={`${styles.hstatVal} ${styles[`hstatVal-${tone}`]}`}>{value}</div>
    <div className={styles.hstatLab}>{label}</div>
  </div>
);

function useMinutosTranscurridos(date: Date): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((now - date.getTime()) / 60000));
}

// ─── Bloque base ─────────────────────────────────────────────────────────────

interface BloqueProps {
  dot: 'neg' | 'warn' | 'muted' | 'pos';
  titulo: string;
  count: number;
  hint: string;
  isPositive?: boolean;
  children: React.ReactNode;
}

const Bloque: React.FC<BloqueProps> = ({
  dot,
  titulo,
  count,
  hint,
  isPositive,
  children,
}) => (
  <section
    className={[
      styles.block,
      isPositive ? styles.blockPositive : '',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <header className={styles.blockHead}>
      <div className={styles.blockTitleWrap}>
        <span
          className={`${styles.blockDot} ${styles[`blockDot-${dot}`]}`}
          aria-hidden="true"
        />
        <h3 className={styles.blockTitle}>{titulo}</h3>
        <span
          className={`${styles.blockCount} ${styles[`blockCount-${dot}`]}`}
        >
          {count}
        </span>
      </div>
      <div className={styles.blockHint}>{hint}</div>
    </header>
    <div className={styles.blockBody}>{children}</div>
  </section>
);

const Subgrupo: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className={styles.subgroup}>
    <div className={styles.subgroupLab}>{label}</div>
    <div className={styles.subgroupItems}>{children}</div>
  </div>
);

// ─── Card base ──────────────────────────────────────────────────────────────

interface CardProps {
  avatarKind: 'iniciales' | 'empty';
  avatarIniciales?: string;
  avatarColor?: string;
  avatarIcon?: React.ReactNode;
  titulo: string;
  meta: React.ReactNode;
  detailValue: React.ReactNode;
  detailTone: 'neg' | 'warn' | 'plain';
  detailSub: React.ReactNode;
  actions: Array<{
    label: string;
    variant: 'ghost' | 'primary' | 'neg';
    onClick: () => void;
  }>;
  onClick?: () => void;
  ariaLabel?: string;
}

const Card: React.FC<CardProps> = ({
  avatarKind,
  avatarIniciales,
  avatarColor,
  avatarIcon,
  titulo,
  meta,
  detailValue,
  detailTone,
  detailSub,
  actions,
  onClick,
  ariaLabel,
}) => (
  <article
    className={styles.card}
    onClick={onClick}
    onKeyDown={
      onClick
        ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }
        : undefined
    }
    tabIndex={onClick ? 0 : undefined}
    role={onClick ? 'button' : undefined}
    aria-label={ariaLabel}
  >
    <div className={styles.cardLeft}>
      {avatarKind === 'iniciales' ? (
        <div
          className={styles.avatar}
          style={{ background: avatarColor }}
          aria-hidden
        >
          {avatarIniciales}
        </div>
      ) : (
        <div className={styles.avatarEmpty} aria-hidden>
          {avatarIcon ?? <Icons.Inmuebles size={14} />}
        </div>
      )}
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{titulo}</div>
        <div className={styles.cardMeta}>{meta}</div>
      </div>
    </div>
    <div className={styles.cardDetail}>
      <div
        className={`${styles.detailVal} ${styles[`detailVal-${detailTone}`]}`}
      >
        {detailValue}
      </div>
      <div className={styles.detailSub}>{detailSub}</div>
    </div>
    <div
      className={styles.cardActions}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.btn} ${styles[`btn-${a.variant}`]}`}
          onClick={a.onClick}
        >
          {a.label}
        </button>
      ))}
    </div>
  </article>
);

// ─── Bloque 1 · Urgente hoy ──────────────────────────────────────────────────

interface BloqueUrgenteHoyProps {
  data: ClasificacionTablero['urgenteHoy'];
  onAbrirContrato: (c: Contract & { id: number }) => void;
  onAbrirDrawerLibres: () => void;
  onNuevoContrato: (inmuebleId?: number) => void;
}

const BloqueUrgenteHoy: React.FC<BloqueUrgenteHoyProps> = ({
  data,
  onAbrirContrato,
  onAbrirDrawerLibres,
  onNuevoContrato,
}) => (
  <Bloque
    dot="neg"
    titulo="Urgente hoy"
    count={data.total}
    hint="Acción inmediata · no esperan"
  >
    {data.impago.length > 0 && (
      <Subgrupo label="Impago activo">
        {data.impago.map((item) => (
          <Card
            key={item.contrato.id}
            avatarKind="iniciales"
            avatarIniciales={generarIniciales(getInquilinoNombre(item.contrato))}
            avatarColor={colorAvatarPorContrato(item.contrato)}
            titulo={getInquilinoNombre(item.contrato)}
            meta={<span>{metaHabInmueble(item.contrato, item.inmuebleAlias)}</span>}
            detailValue="Impago activo"
            detailTone="neg"
            detailSub={
              <>
                <MoneyValue
                  value={item.contrato.rentaMensual ?? 0}
                  decimals={0}
                  tone="neg"
                /> no cobrados
              </>
            }
            actions={[
              { label: 'Recordar', variant: 'ghost', onClick: toast('Recordatorio de pago próximamente · T4.3') },
              { label: 'Iniciar protocolo', variant: 'neg', onClick: toast('Protocolo de cobros próximamente · T4.3') },
            ]}
            onClick={() => onAbrirContrato(item.contrato)}
            ariaLabel={`Impago · ${getInquilinoNombre(item.contrato)}`}
          />
        ))}
      </Subgrupo>
    )}

    {data.libreSinCandidato.length > 0 && (
      <Subgrupo label="Habitación libre sin candidato">
        {data.libreSinCandidato.map((u, idx) => (
          <CardHabitacionLibre
            key={`${u.inmuebleId}-${idx}`}
            item={u}
            onClick={onAbrirDrawerLibres}
            onNuevoContrato={() => onNuevoContrato(u.inmuebleId)}
          />
        ))}
      </Subgrupo>
    )}

    {data.firmaAtrasada.length > 0 && (
      <Subgrupo label="Firma pendiente > 3 días">
        {data.firmaAtrasada.map((item) => (
          <CardFirma key={item.contrato.id} item={item} tone="warn" onAbrirContrato={onAbrirContrato} />
        ))}
      </Subgrupo>
    )}

    {data.venceMuyProximo.length > 0 && (
      <Subgrupo label="Vencen en menos de 15 días">
        {data.venceMuyProximo.map((item) => (
          <CardVencimiento
            key={item.contrato.id}
            item={item}
            tone="neg"
            onAbrirContrato={onAbrirContrato}
          />
        ))}
      </Subgrupo>
    )}
  </Bloque>
);

const CardHabitacionLibre: React.FC<{
  item: ItemHabitacionLibre;
  onClick: () => void;
  onNuevoContrato: () => void;
}> = ({ item, onClick, onNuevoContrato }) => (
  <Card
    avatarKind="empty"
    avatarIcon={<Icons.Inmuebles size={14} strokeWidth={1.8} />}
    titulo={`${item.inmuebleAlias} · sin inquilino`}
    meta={<span>{item.unidadLabel}</span>}
    detailValue={
      item.diasLibre != null ? `${item.diasLibre} d libre` : 'libre'
    }
    detailTone="neg"
    detailSub={
      item.rentaPerdidaAcumulada != null && item.rentaPerdidaAcumulada > 0 ? (
        <>
          <MoneyValue
            value={-item.rentaPerdidaAcumulada}
            decimals={0}
            tone="neg"
          /> perdidos
        </>
      ) : (
        'sin contrato previo'
      )
    }
    actions={[
      { label: 'Publicar anuncio', variant: 'ghost', onClick: toast('Publicación en portales próximamente · T4.4') },
      { label: '+ Nuevo contrato', variant: 'primary', onClick: onNuevoContrato },
    ]}
    onClick={onClick}
    ariaLabel={`Habitación libre · ${item.inmuebleAlias}`}
  />
);

const CardFirma: React.FC<{
  item: ItemTablero;
  tone: 'neg' | 'warn' | 'plain';
  onAbrirContrato: (c: Contract & { id: number }) => void;
}> = ({ item, tone, onAbrirContrato }) => {
  const nombre = getInquilinoNombre(item.contrato);
  const dias = item.diasSinFirmar ?? 0;
  return (
    <Card
      avatarKind="iniciales"
      avatarIniciales={generarIniciales(nombre)}
      avatarColor={colorAvatarPorContrato(item.contrato)}
      titulo={nombre}
      meta={<span>{metaHabInmueble(item.contrato, item.inmuebleAlias)}</span>}
      detailValue={`${dias} d sin firmar`}
      detailTone={tone}
      detailSub={
        item.fechaEnvioFirma ? (
          <>
            enviado{' '}
            <DateLabel
              value={item.fechaEnvioFirma}
              format="short"
              size="sm"
              tone="muted"
            />
          </>
        ) : (
          'envío sin fecha'
        )
      }
      actions={[
        { label: 'Ver estado', variant: 'ghost', onClick: toast('Estado firma digital próximamente · T4.5') },
        { label: 'Reenviar', variant: 'primary', onClick: toast('Reenvío de firma próximamente · T4.5') },
      ]}
      onClick={() => onAbrirContrato(item.contrato)}
      ariaLabel={`Firma pendiente · ${nombre}`}
    />
  );
};

const CardVencimiento: React.FC<{
  item: ItemTablero;
  tone: 'neg' | 'warn';
  onAbrirContrato: (c: Contract & { id: number }) => void;
}> = ({ item, tone, onAbrirContrato }) => {
  const nombre = getInquilinoNombre(item.contrato);
  return (
    <Card
      avatarKind="iniciales"
      avatarIniciales={generarIniciales(nombre)}
      avatarColor={colorAvatarPorContrato(item.contrato)}
      titulo={nombre}
      meta={<span>{metaHabInmueble(item.contrato, item.inmuebleAlias)}</span>}
      detailValue={`Vence en ${item.diasHastaVencimiento} d`}
      detailTone={tone}
      detailSub={
        <>
          <MoneyValue
            value={item.contrato.rentaMensual ?? 0}
            decimals={0}
            tone="ink"
          /> €/mes · hasta {formatFechaFinContrato(item.contrato.fechaFin)}
        </>
      }
      actions={[
        {
          label: 'Llamar',
          variant: 'ghost',
          onClick: item.contrato.inquilino?.telefono
            ? () => {
                window.location.href = `tel:${item.contrato.inquilino.telefono}`;
              }
            : toast('Sin teléfono registrado'),
        },
        { label: 'Proponer renovación', variant: 'primary', onClick: toast('Flow de renovación próximamente · T4.2') },
      ]}
      onClick={() => onAbrirContrato(item.contrato)}
      ariaLabel={`Vencimiento · ${nombre}`}
    />
  );
};

// ─── Bloque 2 · Decisión esta semana ─────────────────────────────────────────

interface BloqueDecisionSemanaProps {
  data: ClasificacionTablero['decisionSemana'];
  onAbrirContrato: (c: Contract & { id: number }) => void;
}

const BloqueDecisionSemana: React.FC<BloqueDecisionSemanaProps> = ({
  data,
  onAbrirContrato,
}) => (
  <Bloque
    dot="warn"
    titulo="Decisión esta semana"
    count={data.total}
    hint="Vencimientos próximos · firmas frescas"
  >
    {data.vencimientos.length > 0 && (
      <Subgrupo label="Vencimientos próximos 15-30 días">
        {data.vencimientos.map((item) => (
          <CardVencimiento
            key={item.contrato.id}
            item={item}
            tone="warn"
            onAbrirContrato={onAbrirContrato}
          />
        ))}
      </Subgrupo>
    )}

    {data.firmaPendienteCorta.length > 0 && (
      <Subgrupo label="Firma pendiente ≤ 3 días">
        {data.firmaPendienteCorta.map((item) => (
          <CardFirma
            key={item.contrato.id}
            item={item}
            tone="plain"
            onAbrirContrato={onAbrirContrato}
          />
        ))}
      </Subgrupo>
    )}
  </Bloque>
);

// ─── Bloque 3 · Planificar este mes (compacto) ──────────────────────────────

interface BloquePlanificarMesProps {
  data: ClasificacionTablero['planificarMes'];
  onAbrirContrato: (c: Contract & { id: number }) => void;
}

const BloquePlanificarMes: React.FC<BloquePlanificarMesProps> = ({
  data,
  onAbrirContrato,
}) => (
  <Bloque
    dot="muted"
    titulo="Planificar este mes"
    count={data.total}
    hint="Vencen en 30-90 días · momento de sondear intención"
  >
    <div className={styles.compactList}>
      {data.items.map((item) => {
        const nombre = getInquilinoNombre(item.contrato);
        return (
          <div
            key={item.contrato.id}
            className={styles.compactRow}
            onClick={() => onAbrirContrato(item.contrato)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAbrirContrato(item.contrato);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Planificar · ${nombre}`}
          >
            <div className={styles.compactLeft}>
              <div
                className={styles.avatarSm}
                style={{ background: colorAvatarPorContrato(item.contrato) }}
                aria-hidden
              >
                {generarIniciales(nombre)}
              </div>
              <span className={styles.compactName}>{nombre}</span>
              <span className={styles.compactInm}>
                {metaHabInmueble(item.contrato, item.inmuebleAlias)}
              </span>
            </div>
            <div className={styles.compactMid}>
              <MoneyValue
                value={item.contrato.rentaMensual ?? 0}
                decimals={0}
                tone="ink"
              /> €/mes
            </div>
            <div className={styles.compactDays}>
              {item.diasHastaVencimiento} d
            </div>
            <div
              className={styles.compactAction}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`${styles.btn} ${styles['btn-ghost']} ${styles.btnSm}`}
                onClick={toast('Sondeo de renovación próximamente · T4.2')}
              >
                Sondear →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </Bloque>
);

// ─── Bloque 4 · Buenas noticias ──────────────────────────────────────────────

interface BloqueBuenasNoticiasProps {
  data: ClasificacionTablero['buenasNoticias'];
  stats: StatsAnaliticos;
  onAbrirContrato: (c: Contract & { id: number }) => void;
}

const BloqueBuenasNoticias: React.FC<BloqueBuenasNoticiasProps> = ({
  data,
  stats,
  onAbrirContrato,
}) => (
  <Bloque
    dot="pos"
    titulo="Buenas noticias"
    count={data.total}
    hint="Renovaciones recientes · dopamina merecida"
    isPositive
  >
    <div className={styles.positiveGrid}>
      {data.renovaciones.map((item) => {
        const nombre = getInquilinoNombre(item.contrato);
        const ord = item.nVecesRenovado
          ? `${item.nVecesRenovado}ª vez`
          : 'renovación';
        return (
          <article
            key={item.contrato.id}
            className={styles.positiveItem}
            onClick={() => onAbrirContrato(item.contrato)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAbrirContrato(item.contrato);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Renovación · ${nombre}`}
          >
            <div
              className={styles.avatarSm}
              style={{ background: colorAvatarPorContrato(item.contrato) }}
              aria-hidden
            >
              {generarIniciales(nombre)}
            </div>
            <div>
              <div className={styles.positiveName}>{nombre}</div>
              <div className={styles.positiveMeta}>
                renovado · {ord} · hasta {formatFechaFinContrato(item.contrato.fechaFin)}
              </div>
            </div>
          </article>
        );
      })}
    </div>
    <FooterAnalitico stats={stats} />
  </Bloque>
);

const FooterAnalitico: React.FC<{ stats: StatsAnaliticos }> = ({ stats }) => (
  <div className={styles.positiveFoot}>
    <FootStat
      value={
        stats.tasaRenovacionYtd != null
          ? `${Math.round(stats.tasaRenovacionYtd * 100)} %`
          : '—'
      }
      label="Tasa renovación YTD"
      tone="pos"
    />
    <FootStat
      value={
        stats.variacionVsAnoAnteriorPp != null
          ? `${stats.variacionVsAnoAnteriorPp >= 0 ? '▲ +' : '▼ '}${stats.variacionVsAnoAnteriorPp} pp`
          : '—'
      }
      label="vs año anterior"
      tone="pos"
    />
    <FootStat
      value={
        stats.duracionMediaContratosMeses != null
          ? `${stats.duracionMediaContratosMeses} meses`
          : '—'
      }
      label="Duración media contratos"
      tone="plain"
    />
  </div>
);

const FootStat: React.FC<{
  value: string;
  label: string;
  tone: 'pos' | 'plain';
}> = ({ value, label, tone }) => (
  <div className={styles.footStat}>
    <div
      className={`${styles.footStatVal} ${tone === 'pos' ? styles.footStatValPos : ''}`}
    >
      {value}
    </div>
    <div className={styles.footStatLab}>{label}</div>
  </div>
);

// ─── Nota silenciosos ───────────────────────────────────────────────────────

const NotaSilenciosos: React.FC<{ total: number; onIrAActivos: () => void }> = ({
  total,
  onIrAActivos,
}) => (
  <div className={styles.silentNote} role="status">
    <Icons.Info size={14} strokeWidth={1.8} />
    <div>
      <strong>
        {total} {total === 1 ? 'contrato vigente silencioso' : 'contratos vigentes silenciosos'}
      </strong>{' '}
      no aparecen aquí · todo funciona bien y no requieren acción. Los ves en{' '}
      <button
        type="button"
        className={styles.linkInline}
        onClick={onIrAActivos}
      >
        Activos
      </button>
      .
    </div>
  </div>
);

export default TabTablero;
export { TabTablero };
