import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoFondo.module.css';
import type { FondoDraft } from '../typesFondo';
import type { FondoAhorro, Objetivo } from '../../../../types/miPlan';

const fmtFecha = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d
    .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    .replace('.', '');
};

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

interface Props {
  draft: FondoDraft;
  objetivos: Objetivo[];
  fondos: FondoAhorro[];
  /** Si poblado · pre-selecciona ese objetivo · oculta "Crear objetivo nuevo". */
  objetivoVinculadoIdInicial?: string;
  onPatch: (patch: Partial<FondoDraft>) => void;
}

const Step4VinculosFondo: React.FC<Props> = ({
  draft,
  objetivos,
  fondos,
  objetivoVinculadoIdInicial,
  onPatch,
}) => {
  // Solo objetivos compatibles · acumular | comprar · activos
  const compatibles = objetivos.filter(
    (o) => (o.tipo === 'acumular' || o.tipo === 'comprar') &&
      o.estado !== 'archivado' &&
      o.estado !== 'completado',
  );

  // Para cada objetivo · ¿ya tiene fondo distinto al actual?
  const fondoDeObjetivo = new Map<string, FondoAhorro>();
  for (const f of fondos) {
    if (f.activo && f.objetivoVinculadoId) {
      fondoDeObjetivo.set(f.objetivoVinculadoId, f);
    }
  }

  const handleSelect = (objetivoId: string | undefined) => {
    onPatch({
      objetivoVinculadoId: objetivoId,
      vinculoElegido: true,
    });
  };

  const isObjSelected = (objId: string): boolean =>
    draft.vinculoElegido && draft.objetivoVinculadoId === objId;
  const isSinVincularSelected = (): boolean =>
    draft.vinculoElegido && draft.objetivoVinculadoId === undefined;

  const ocultarCrearNuevo = Boolean(objetivoVinculadoIdInicial);

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>04</span> Vincula con un objetivo
      </div>
      <div className={styles.stepSubText}>
        Conecta este fondo a un objetivo de Mi Plan · ATLAS sabrá entonces que el ahorro de
        este fondo financia esa meta. La vinculación es opcional · se puede añadir o cambiar
        después.
      </div>

      <div className={styles.tipoNote}>
        <span className={styles.tipoNoteLab}>Cómo se usa</span>
        Si vinculas · cuando ATLAS calcule el progreso del objetivo lo hará leyendo el
        acumulado de este fondo. Te aparecerá tanto en la card del objetivo como en la del
        fondo.
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>
          Objetivos compatibles
          <span className={styles.formSectionTitNote}>· acumular y comprar</span>
        </div>

        {compatibles.length === 0 && !ocultarCrearNuevo && (
          <div className={styles.emptyState}>
            No tienes objetivos de tipo acumular o comprar activos. Crea uno desde{' '}
            <strong>Mi Plan · Objetivos</strong> · o continúa sin vincular.
          </div>
        )}

        <div className={styles.vincObjList}>
          {compatibles.map((o) => {
            const fondoExistente = fondoDeObjetivo.get(o.id);
            const isSel = isObjSelected(o.id);
            const cls = `${styles.vincObjItem} ${isSel ? styles.selected : ''}`;
            const tagCls =
              o.tipo === 'acumular'
                ? styles.vincObjTagAcumular
                : styles.vincObjTagComprar;
            const iconCls =
              o.tipo === 'acumular'
                ? styles.vincObjIconAcumular
                : styles.vincObjIconComprar;
            const Icon = o.tipo === 'acumular' ? Icons.Acumular : Icons.Comprar;
            const meta =
              o.tipo === 'reducir' ? o.metaCantidadMensual : o.metaCantidad;
            return (
              <button
                key={o.id}
                type="button"
                className={cls}
                onClick={() => handleSelect(o.id)}
                aria-pressed={isSel}
              >
                <span className={styles.vincObjRadio} aria-hidden />
                <div className={`${styles.vincObjIcon} ${iconCls}`}>
                  <Icon size={15} strokeWidth={1.8} />
                </div>
                <div>
                  <div className={styles.vincObjTit}>
                    {o.nombre}
                    <span className={`${styles.vincObjTag} ${tagCls}`}>{o.tipo}</span>
                  </div>
                  <div className={styles.vincObjSub}>
                    meta {fmtEur(meta ?? 0)}
                    {fondoExistente ? (
                      <>
                        {' · '}
                        <span className={styles.vincObjAvisoWarn}>
                          ya vinculado a fondo &quot;{fondoExistente.nombre}&quot;
                        </span>
                      </>
                    ) : (
                      ' · sin fondo aún'
                    )}
                  </div>
                </div>
                <div className={styles.vincObjMeta}>
                  <div className={styles.vincObjMetaProg}>{fmtFecha(o.fechaCierre)}</div>
                  <div className={styles.vincObjMetaLab}>fecha objetivo</div>
                </div>
              </button>
            );
          })}

          {!ocultarCrearNuevo && (
            <button
              type="button"
              className={styles.vincObjItem}
              onClick={() => {
                /* T27.3 · "Crear objetivo nuevo" desde el wizard fondo · pendiente
                   wizard objetivo recursivo (T27.1.1 futuro). Por ahora · cerrar
                   este wizard y abrir el de objetivo manualmente. */
              }}
              disabled
              aria-disabled
            >
              <span className={styles.vincObjRadio} aria-hidden />
              <div className={`${styles.vincObjIcon} ${styles.vincObjIconCrear}`}>
                <Icons.Plus size={15} strokeWidth={1.5} />
              </div>
              <div>
                <div
                  className={styles.vincObjTit}
                  style={{ color: 'var(--atlas-v5-ink-3)', fontWeight: 600 }}
                >
                  Crear objetivo nuevo
                </div>
                <div className={styles.vincObjSub}>
                  pendiente · disponible cuando se permita anidación de wizards
                </div>
              </div>
              <div />
            </button>
          )}

          <button
            type="button"
            className={`${styles.vincObjItem} ${isSinVincularSelected() ? styles.selected : ''}`}
            onClick={() => handleSelect(undefined)}
            aria-pressed={isSinVincularSelected()}
          >
            <span className={styles.vincObjRadio} aria-hidden />
            <div className={`${styles.vincObjIcon} ${styles.vincObjIconNinguno}`}>
              <Icons.Close size={15} strokeWidth={1.8} />
            </div>
            <div>
              <div
                className={styles.vincObjTit}
                style={{ color: 'var(--atlas-v5-ink-3)' }}
              >
                Sin vincular objetivo
              </div>
              <div className={styles.vincObjSub}>
                creo el fondo independiente · puedo asociarlo después
              </div>
            </div>
            <div />
          </button>
        </div>
      </div>

      <div
        style={{
          background: 'var(--atlas-v5-card)',
          border: '1px solid var(--atlas-v5-line)',
          borderRadius: 9,
          padding: '14px 18px',
          marginTop: 14,
          fontSize: 12,
          color: 'var(--atlas-v5-ink-3)',
          lineHeight: 1.5,
        }}
      >
        <strong
          style={{
            color: 'var(--atlas-v5-ink-2)',
            display: 'block',
            marginBottom: 4,
          }}
        >
          Reglas de vinculación
        </strong>
        Solo aparecen objetivos de tipo <strong>acumular</strong> o{' '}
        <strong>comprar</strong> · son los únicos que tiene sentido alimentar con un fondo.
        Los de tipo amortizar y reducir gestionan su progreso de otra forma. Cada fondo se
        vincula a un único objetivo · si quieres dividir un fondo entre varias metas · crea
        fondos separados.
      </div>
    </div>
  );
};

export default Step4VinculosFondo;
