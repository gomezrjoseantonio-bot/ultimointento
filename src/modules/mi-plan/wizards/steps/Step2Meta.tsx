import React from 'react';
import styles from '../WizardNuevoObjetivo.module.css';
import type { ObjetivoDraft, ReducirCategoria, AcumularUnidad, ComprarMetric } from '../types';
import type { Prestamo } from '../../../../types/prestamos';

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

interface Props {
  draft: ObjetivoDraft;
  prestamos: Prestamo[];
  inmueblesCount: number;
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
}

const Step2Meta: React.FC<Props> = ({ draft, prestamos, inmueblesCount, onPatch }) => {
  const tipo = draft.tipo;

  const renderIdentificacion = (
    nombrePlaceholder: string,
    descPlaceholder: string,
  ): React.ReactElement => (
    <div className={styles.formSection}>
      <div className={styles.formSectionTit}>Identificación</div>
      <div className={`${styles.formRow} ${styles.formRowSingle}`}>
        <div className={styles.formField}>
          <label className={styles.formLab} htmlFor="obj-nombre">
            Nombre del objetivo
          </label>
          <input
            id="obj-nombre"
            className={styles.formInput}
            type="text"
            value={draft.nombre}
            placeholder={nombrePlaceholder}
            maxLength={120}
            onChange={(e) => onPatch({ nombre: e.target.value })}
          />
        </div>
      </div>
      <div className={`${styles.formRow} ${styles.formRowSingle}`}>
        <div className={styles.formField}>
          <label className={styles.formLab} htmlFor="obj-desc">
            Descripción contextual
            <span className={styles.formLabOpt}>· opcional</span>
          </label>
          <input
            id="obj-desc"
            className={styles.formInput}
            type="text"
            value={draft.descripcion}
            placeholder={descPlaceholder}
            maxLength={200}
            onChange={(e) => onPatch({ descripcion: e.target.value })}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>02</span> Define la meta
      </div>
      <div className={styles.stepSubText}>
        {tipo === 'acumular' &&
          'Para un objetivo de tipo Acumular, dale un nombre claro e indica el importe a reunir y desde dónde partes.'}
        {tipo === 'amortizar' &&
          'Selecciona el préstamo que quieres amortizar. El valor meta será 0 € · cancelación total.'}
        {tipo === 'comprar' &&
          'Indica si quieres medir tu objetivo por número de inmuebles en cartera o por valor total invertido.'}
        {tipo === 'reducir' &&
          'Elige la categoría de gasto a reducir e indica el importe mensual objetivo.'}
      </div>

      {tipo === 'acumular' && <VarianteAcumular draft={draft} onPatch={onPatch} renderIdentificacion={renderIdentificacion} />}
      {tipo === 'amortizar' && <VarianteAmortizar draft={draft} prestamos={prestamos} onPatch={onPatch} />}
      {tipo === 'comprar' && (
        <VarianteComprar
          draft={draft}
          inmueblesCount={inmueblesCount}
          onPatch={onPatch}
          renderIdentificacion={renderIdentificacion}
        />
      )}
      {tipo === 'reducir' && (
        <VarianteReducir draft={draft} onPatch={onPatch} renderIdentificacion={renderIdentificacion} />
      )}
    </div>
  );
};

// ── Variante · acumular ─────────────────────────────────────────────────────

const VarianteAcumular: React.FC<{
  draft: ObjetivoDraft;
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
  renderIdentificacion: (n: string, d: string) => React.ReactElement;
}> = ({ draft, onPatch, renderIdentificacion }) => {
  const sufijo = draft.acumularUnidad === 'meses' ? 'meses' : '€';
  const setUnidad = (u: AcumularUnidad) => onPatch({ acumularUnidad: u });

  return (
    <>
      {renderIdentificacion('Describe la meta en una línea', 'ej · entrada + gastos · 2027')}

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Importe meta</div>

        <div className={styles.formRow}>
          <div className={styles.formField}>
            <span className={styles.formLab}>Unidad de medida</span>
            <div className={styles.formRadioGroup} role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={draft.acumularUnidad === 'eur'}
                className={`${styles.formRadio} ${draft.acumularUnidad === 'eur' ? styles.selected : ''}`}
                onClick={() => setUnidad('eur')}
              >
                <span className={styles.formRadioTit}>Importe en €</span>
                <span className={styles.formRadioSub}>cantidad fija de dinero</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={draft.acumularUnidad === 'meses'}
                className={`${styles.formRadio} ${draft.acumularUnidad === 'meses' ? styles.selected : ''}`}
                onClick={() => setUnidad('meses')}
              >
                <span className={styles.formRadioTit}>Meses de tesorería</span>
                <span className={styles.formRadioSub}>colchón emergencia</span>
              </button>
            </div>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-meta-acumular">
              Valor meta
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="obj-meta-acumular"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.acumularValorMeta}
                placeholder="0"
                onChange={(e) => onPatch({ acumularValorMeta: e.target.value })}
              />
              <span className={styles.formInputSuf}>{sufijo}</span>
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-actual-acumular">
              Valor actual
              <span className={styles.formLabOpt}>· auto desde fondo si lo vinculas</span>
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="obj-actual-acumular"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.acumularValorActual}
                placeholder="0"
                onChange={(e) => onPatch({ acumularValorActual: e.target.value })}
              />
              <span className={styles.formInputSuf}>{sufijo}</span>
            </div>
          </div>
        </div>

        <div className={styles.formHelp}>
          Valor actual se actualiza automáticamente con los movimientos del fondo vinculado en
          el paso <strong>Vínculos</strong>. Si no vinculas ningún fondo, lo introduces a mano y
          lo actualizas manualmente.
        </div>
      </div>
    </>
  );
};

// ── Variante · amortizar ────────────────────────────────────────────────────

const VarianteAmortizar: React.FC<{
  draft: ObjetivoDraft;
  prestamos: Prestamo[];
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
}> = ({ draft, prestamos, onPatch }) => {
  const activos = prestamos.filter((p) => p.estado !== 'cancelado');
  const seleccionar = (p: Prestamo) => {
    const nombreAuto = draft.nombre || `Cancelar ${p.nombre}`;
    onPatch({
      prestamoId: p.id,
      nombre: nombreAuto,
      descripcion: draft.descripcion || 'amortización anticipada',
    });
  };

  return (
    <>
      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Identificación</div>
        <div className={`${styles.formRow} ${styles.formRowSingle}`}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-nombre-am">
              Nombre del objetivo
              <span className={styles.formLabOpt}>· se autocompleta al elegir préstamo</span>
            </label>
            <input
              id="obj-nombre-am"
              className={styles.formInput}
              type="text"
              value={draft.nombre}
              placeholder="ej · cancelar hipoteca CB15"
              maxLength={120}
              onChange={(e) => onPatch({ nombre: e.target.value })}
            />
          </div>
        </div>
        <div className={`${styles.formRow} ${styles.formRowSingle}`}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-desc-am">
              Descripción contextual
              <span className={styles.formLabOpt}>· opcional</span>
            </label>
            <input
              id="obj-desc-am"
              className={styles.formInput}
              type="text"
              value={draft.descripcion}
              placeholder="amortización anticipada"
              maxLength={200}
              onChange={(e) => onPatch({ descripcion: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Préstamo a amortizar</div>
        {activos.length === 0 ? (
          <div className={styles.emptyState}>
            No tienes préstamos activos. Da de alta uno en{' '}
            <strong>Financiación</strong> primero.
          </div>
        ) : (
          <div className={styles.itemList}>
            {activos.map((p) => {
              const isSel = draft.prestamoId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.item} ${isSel ? styles.itemSelectedBrand : ''}`}
                  onClick={() => seleccionar(p)}
                  aria-pressed={isSel}
                >
                  <span className={styles.radioDot} aria-hidden />
                  <div>
                    <div className={styles.itemTit}>{p.nombre}</div>
                    <div className={styles.itemSub}>
                      {p.tipo} · firma {p.fechaFirma}
                    </div>
                  </div>
                  <div>
                    <div className={styles.itemRightBrand}>{fmtEur(p.principalVivo)}</div>
                    <div className={styles.itemRightLab}>pendiente</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

// ── Variante · comprar ──────────────────────────────────────────────────────

const VarianteComprar: React.FC<{
  draft: ObjetivoDraft;
  inmueblesCount: number;
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
  renderIdentificacion: (n: string, d: string) => React.ReactElement;
}> = ({ draft, inmueblesCount, onPatch, renderIdentificacion }) => {
  const setMetric = (m: ComprarMetric) => onPatch({ comprarMetric: m });
  const sufijo = draft.comprarMetric === 'unidades' ? 'inmuebles' : '€';

  return (
    <>
      {renderIdentificacion('ej · 10 pisos en cartera para 2030', 'opcional · matiza la meta')}

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Tipo de meta</div>
        <div className={styles.formRadioGroup} role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={draft.comprarMetric === 'unidades'}
            className={`${styles.formRadio} ${draft.comprarMetric === 'unidades' ? styles.selected : ''}`}
            onClick={() => setMetric('unidades')}
          >
            <span className={styles.formRadioTit}>Por número de inmuebles</span>
            <span className={styles.formRadioSub}>ej · 10 pisos en cartera</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={draft.comprarMetric === 'valor'}
            className={`${styles.formRadio} ${draft.comprarMetric === 'valor' ? styles.selected : ''}`}
            onClick={() => setMetric('valor')}
          >
            <span className={styles.formRadioTit}>Por valor total cartera</span>
            <span className={styles.formRadioSub}>ej · 1.500.000 € invertidos</span>
          </button>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Valor</div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-meta-comprar">
              Valor meta
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="obj-meta-comprar"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.comprarValorMeta}
                placeholder="0"
                onChange={(e) => onPatch({ comprarValorMeta: e.target.value })}
              />
              <span className={styles.formInputSuf}>{sufijo}</span>
            </div>
          </div>
          <div className={styles.formField}>
            <span className={styles.formLab}>
              Valor actual
              <span className={styles.formLabOpt}>· auto desde tu cartera</span>
            </span>
            <div className={styles.formInputGroup}>
              <input
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                value={
                  draft.comprarMetric === 'unidades' ? String(inmueblesCount) : '—'
                }
                disabled
                readOnly
              />
              <span className={styles.formInputSuf}>{sufijo}</span>
            </div>
          </div>
        </div>
        {draft.comprarMetric === 'valor' && (
          <div className={styles.formHelp}>
            El valor total actual se calculará desde las valoraciones registradas en tus
            inmuebles cuando estén disponibles.
          </div>
        )}
      </div>
    </>
  );
};

// ── Variante · reducir ──────────────────────────────────────────────────────

const REDUCIR_OPTIONS: { value: ReducirCategoria; label: string }[] = [
  { value: 'gastos_personales', label: 'Gastos personales' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'suscripciones', label: 'Suscripciones' },
  { value: 'otro', label: 'Otro · texto libre' },
];

const VarianteReducir: React.FC<{
  draft: ObjetivoDraft;
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
  renderIdentificacion: (n: string, d: string) => React.ReactElement;
}> = ({ draft, onPatch, renderIdentificacion }) => {
  return (
    <>
      {renderIdentificacion(
        'ej · reducir suscripciones a 50 €/mes',
        'opcional · contexto del recorte',
      )}

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Métrica a reducir</div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-reducir-cat">
              Categoría de gasto
            </label>
            <select
              id="obj-reducir-cat"
              className={styles.formSelect}
              value={draft.reducirCategoria}
              onChange={(e) =>
                onPatch({ reducirCategoria: e.target.value as ReducirCategoria })
              }
            >
              {REDUCIR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-reducir-meta">
              Meta mensual
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="obj-reducir-meta"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.reducirMetaMensual}
                placeholder="0"
                onChange={(e) => onPatch({ reducirMetaMensual: e.target.value })}
              />
              <span className={styles.formInputSuf}>€/mes</span>
            </div>
          </div>
        </div>

        {draft.reducirCategoria === 'otro' && (
          <div className={`${styles.formRow} ${styles.formRowSingle}`}>
            <div className={styles.formField}>
              <label className={styles.formLab} htmlFor="obj-reducir-libre">
                Categoría libre
              </label>
              <input
                id="obj-reducir-libre"
                className={styles.formInput}
                type="text"
                value={draft.reducirCategoriaLibre}
                placeholder="ej · ocio mensual"
                maxLength={60}
                onChange={(e) => onPatch({ reducirCategoriaLibre: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className={styles.formHelp}>
          Indica el importe mensual al que quieres bajar este gasto. ATLAS comparará tus
          movimientos categorizados con esta meta para indicar el progreso.
        </div>
      </div>
    </>
  );
};

export default Step2Meta;
