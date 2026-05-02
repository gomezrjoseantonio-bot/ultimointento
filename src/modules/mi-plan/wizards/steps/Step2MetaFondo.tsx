import React from 'react';
import styles from '../WizardNuevoFondo.module.css';
import type { FondoDraft } from '../typesFondo';
import { calcularMetaColchon } from '../typesFondo';
import type { FondoPrioridad } from '../../../../types/miPlan';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

interface Props {
  draft: FondoDraft;
  onPatch: (patch: Partial<FondoDraft>) => void;
}

const Step2MetaFondo: React.FC<Props> = ({ draft, onPatch }) => {
  const cat = draft.categoria;
  const today = new Date();
  const minYear = today.getFullYear();
  const years: number[] = [];
  for (let y = minYear; y <= minYear + 15; y++) years.push(y);

  const renderIdentificacion = (placeholder: string) => (
    <div className={styles.formSection}>
      <div className={styles.formSectionTit}>Identificación</div>
      <div className={`${styles.formRow} ${styles.formRowSingle}`}>
        <div className={styles.formField}>
          <label className={styles.formLab} htmlFor="fondo-nombre">
            Nombre del fondo
          </label>
          <input
            id="fondo-nombre"
            className={styles.formInput}
            type="text"
            value={draft.nombre}
            placeholder={placeholder}
            maxLength={120}
            onChange={(e) => onPatch({ nombre: e.target.value })}
          />
        </div>
      </div>
    </div>
  );

  const renderFechaPrioridad = () => (
    <div className={styles.formSection}>
      <div className={styles.formSectionTit}>Fecha objetivo</div>
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <span className={styles.formLab}>Mes / año</span>
          <div className={styles.formRow} style={{ margin: 0, gap: 8 }}>
            <select
              className={styles.formSelect}
              value={draft.fechaObjetivoMes}
              onChange={(e) => onPatch({ fechaObjetivoMes: Number(e.target.value) })}
              aria-label="Mes objetivo"
            >
              {MESES.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
            <select
              className={styles.formSelect}
              value={draft.fechaObjetivoAnio}
              onChange={(e) => onPatch({ fechaObjetivoAnio: Number(e.target.value) })}
              aria-label="Año objetivo"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.formField}>
          <span className={styles.formLab}>
            Prioridad
            <span className={styles.formLabOpt}>· cómo lo trata ATLAS</span>
          </span>
          <div className={styles.formRadioGroup} role="radiogroup">
            {(['alta', 'normal'] as FondoPrioridad[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={draft.prioridad === p}
                className={`${styles.formRadio} ${draft.prioridad === p ? styles.selected : ''}`}
                onClick={() => onPatch({ prioridad: p })}
              >
                <span className={styles.formRadioTit}>{p === 'alta' ? 'Alta' : 'Normal'}</span>
                <span className={styles.formRadioSub}>
                  {p === 'alta' ? 'avisa si ralentiza' : 'solo informativo'}
                </span>
              </button>
            ))}
          </div>
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
        Pónle nombre al fondo y di cuánto necesitas reunir y para cuándo.
      </div>

      {cat === 'colchon' && (
        <VarianteColchon
          draft={draft}
          onPatch={onPatch}
          renderIdentificacion={renderIdentificacion}
          renderFechaPrioridad={renderFechaPrioridad}
        />
      )}
      {cat === 'compra' && (
        <VarianteImporteLibre
          draft={draft}
          onPatch={onPatch}
          renderIdentificacion={renderIdentificacion}
          renderFechaPrioridad={renderFechaPrioridad}
          placeholder="Entrada próximo piso"
          ayudaImporte="Importe a reunir · entrada + gastos del próximo inmueble."
        />
      )}
      {cat === 'reforma' && (
        <VarianteImporteLibre
          draft={draft}
          onPatch={onPatch}
          renderIdentificacion={renderIdentificacion}
          renderFechaPrioridad={renderFechaPrioridad}
          placeholder="Reforma "
          ayudaImporte="Importe a reservar para la obra. Define fecha aproximada en la que necesitarás disponer del importe."
        />
      )}
      {cat === 'impuestos' && (
        <VarianteImporteLibre
          draft={draft}
          onPatch={onPatch}
          renderIdentificacion={renderIdentificacion}
          renderFechaPrioridad={renderFechaPrioridad}
          placeholder="Impuestos pendientes"
          ayudaImporte="Introduce manualmente la suma estimada · auto-cálculo desde simulador fiscal en próxima versión."
        />
      )}
    </div>
  );
};

const VarianteColchon: React.FC<{
  draft: FondoDraft;
  onPatch: (p: Partial<FondoDraft>) => void;
  renderIdentificacion: (ph: string) => React.ReactElement;
  renderFechaPrioridad: () => React.ReactElement;
}> = ({ draft, onPatch, renderIdentificacion, renderFechaPrioridad }) => {
  const meta = calcularMetaColchon(draft);
  const meses = draft.colchonMeses || '0';
  const gasto = draft.colchonGastoMensual || '0';

  return (
    <>
      <div className={styles.tipoNote}>
        <span className={styles.tipoNoteLab}>Variante por categoría</span>
        Esta pantalla muestra los campos de <strong>Colchón de emergencia</strong> · meta
        calculada automáticamente desde tus gastos mensuales reales. Próxima compra · reforma
        · impuestos · usan importe libre en €.
      </div>

      {renderIdentificacion('Cubrir 24 meses de gastos')}

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Meta del colchón</div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="colchon-meses">
              Meses de gastos a cubrir
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="colchon-meses"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="number"
                min={1}
                max={60}
                value={draft.colchonMeses}
                onChange={(e) => onPatch({ colchonMeses: e.target.value })}
              />
              <span className={styles.formInputSuf}>meses</span>
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="colchon-gasto">
              Gasto vida mensual
              <span className={styles.formLabOpt}>· auto-cálculo pendiente T8</span>
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="colchon-gasto"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.colchonGastoMensual}
                placeholder="0"
                onChange={(e) => onPatch({ colchonGastoMensual: e.target.value })}
              />
              <span className={styles.formInputSuf}>€/mes</span>
            </div>
            <div className={styles.formHelp}>
              Introduce la media de tus gastos personales mensuales. ATLAS lo calculará
              automáticamente cuando T8 cierre.
            </div>
          </div>
        </div>

        <div className={styles.metaHelper}>
          <strong>Meta calculada · {fmtEur(meta)}</strong> · {meses} meses × {gasto}{' '}
          €/mes. Este es el importe que tu colchón debería tener para considerarse
          completo.
        </div>
      </div>

      {renderFechaPrioridad()}
    </>
  );
};

const VarianteImporteLibre: React.FC<{
  draft: FondoDraft;
  onPatch: (p: Partial<FondoDraft>) => void;
  renderIdentificacion: (ph: string) => React.ReactElement;
  renderFechaPrioridad: () => React.ReactElement;
  placeholder: string;
  ayudaImporte: string;
}> = ({ draft, onPatch, renderIdentificacion, renderFechaPrioridad, placeholder, ayudaImporte }) => {
  return (
    <>
      {renderIdentificacion(placeholder)}

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Importe meta</div>
        <div className={`${styles.formRow} ${styles.formRowSingle}`}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="fondo-meta">
              Importe a reunir
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="fondo-meta"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.metaImporte}
                placeholder="0"
                onChange={(e) => onPatch({ metaImporte: e.target.value })}
              />
              <span className={styles.formInputSuf}>€</span>
            </div>
            <div className={styles.formHelp}>{ayudaImporte}</div>
          </div>
        </div>
      </div>

      {renderFechaPrioridad()}
    </>
  );
};

export default Step2MetaFondo;
