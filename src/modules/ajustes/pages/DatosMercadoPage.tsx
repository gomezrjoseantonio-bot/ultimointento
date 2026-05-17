// Ajustes → Datos de mercado · UI tabla benchmarks editable.
// T-INVERSIONES-DETALLE-PP-v1 · PR 2 · §7.1 + §8 (precarga vacía).
//
// Patrón Ajustes · usa containerStyles.contentHead + grid editable inline.
// Banner "datos pendientes" si todos los benchmarks tienen valoresAnuales vacío.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import containerStyles from '../AjustesPage.module.css';
import styles from './DatosMercadoPage.module.css';
import {
  createBenchmark,
  deleteValorAnual,
  listBenchmarks,
  restaurarSeedV72,
  runMigration_v72,
  setValorAnual,
  todosVacios,
  updateBenchmark,
} from '../../../services/benchmarksReferenciaService';
import type { BenchmarkReferencia, TipoBenchmark } from '../../../types/benchmarksReferencia';

const TIPO_LABEL: Record<TipoBenchmark, string> = {
  indice_equity: 'Índice equity',
  indice_renta_fija: 'Índice renta fija',
  inflacion: 'Inflación',
  etf_referencia: 'ETF referencia',
};

const TIPO_OPTIONS: TipoBenchmark[] = [
  'indice_equity',
  'indice_renta_fija',
  'inflacion',
  'etf_referencia',
];

function valorUltimoAno(b: BenchmarkReferencia): { ano: number; pct: number } | null {
  const anos = Object.keys(b.valoresAnuales).map(Number).sort((a, b) => b - a);
  if (anos.length === 0) return null;
  return { ano: anos[0], pct: b.valoresAnuales[anos[0]] };
}

const DatosMercadoPage = () => {
  const [items, setItems] = useState<BenchmarkReferencia[]>([]);
  const [vacios, setVacios] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const recargar = useCallback(async () => {
    const lista = await listBenchmarks();
    setItems(lista);
    setVacios(await todosVacios());
  }, []);

  useEffect(() => {
    (async () => {
      await runMigration_v72();
      await recargar();
    })();
  }, [recargar]);

  const onRestaurar = async () => {
    if (
      !window.confirm(
        'Restaurar precarga · sobrescribirá los 6 benchmarks por defecto (MSCI World · S&P 500 · EUROSTOXX 50 · Bonds AGG · IPC ES · HICP EUR) con valores vacíos. Tus benchmarks adicionales no se tocan. ¿Continuar?',
      )
    )
      return;
    const escritos = await restaurarSeedV72();
    showToastV5(`Restaurada precarga · ${escritos} benchmarks`, 'success');
    await recargar();
  };

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Datos de mercado</h1>
          <div className={containerStyles.contentSub}>
            benchmarks de referencia · usados por la proyección de inversiones · edición manual
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
            onClick={onRestaurar}
          >
            <Icons.Refresh size={14} strokeWidth={1.8} />
            Restaurar precarga
          </button>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnGold}`}
            onClick={() => setShowAddForm(true)}
          >
            <Icons.Check size={14} strokeWidth={1.8} />
            Añadir benchmark
          </button>
        </div>
      </div>

      {vacios && (
        <div className={styles.banner} role="status" aria-live="polite">
          <Icons.Warning size={18} strokeWidth={1.8} className={styles.bannerIcon} />
          <div className={styles.bannerBody}>
            <strong>Datos pendientes</strong> · los benchmarks vienen precargados con metadata
            pero sin valores anuales. Introduce los porcentajes manualmente desde la fuente
            oficial de cada índice para que la proyección de tus inversiones tenga referencia.
          </div>
        </div>
      )}

      <AddBenchmarkForm
        visible={showAddForm}
        onCancel={() => setShowAddForm(false)}
        onCreated={async () => {
          setShowAddForm(false);
          await recargar();
        }}
      />

      {items.length === 0 ? (
        <div className={styles.empty}>
          No hay benchmarks. Pulsa "Restaurar precarga" para insertar los 6 por defecto.
        </div>
      ) : (
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th style={{ width: '14%' }}>Código</th>
              <th style={{ width: '28%' }}>Nombre</th>
              <th style={{ width: '14%' }}>Tipo</th>
              <th style={{ width: '18%', textAlign: 'right' }}>Último año</th>
              <th style={{ width: '14%' }}>Actualizado</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => {
              const ultimo = valorUltimoAno(b);
              const isExpanded = expandedId === b.id;
              return (
                <BenchmarkRow
                  key={b.id}
                  benchmark={b}
                  ultimo={ultimo}
                  expanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : b.id)}
                  onChanged={recargar}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
};

// ── Row + panel edición inline ──────────────────────────────────────────────

interface BenchmarkRowProps {
  benchmark: BenchmarkReferencia;
  ultimo: { ano: number; pct: number } | null;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void>;
}

const BenchmarkRow = ({ benchmark, ultimo, expanded, onToggle, onChanged }: BenchmarkRowProps) => {
  return (
    <>
      <tr
        className={`${styles.row} ${expanded ? styles.expanded : ''}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <td className={styles.codigo}>{benchmark.codigo}</td>
        <td className={styles.nombre}>{benchmark.nombre}</td>
        <td className={styles.tipoCell}>{TIPO_LABEL[benchmark.tipo]}</td>
        <td
          className={`${styles.valorUltimoAno} ${ultimo ? '' : styles.empty}`}
        >
          {ultimo ? `${ultimo.pct.toFixed(1)} % · ${ultimo.ano}` : 'sin datos'}
        </td>
        <td className={styles.fechaCell}>{benchmark.ultimaActualizacion ?? '—'}</td>
        <td style={{ textAlign: 'right' }}>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={expanded ? 'Cerrar edición' : 'Editar'}
          >
            {expanded ? 'Cerrar' : 'Editar'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <EditarPanel benchmark={benchmark} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
};

interface EditarPanelProps {
  benchmark: BenchmarkReferencia;
  onChanged: () => Promise<void>;
}

const EditarPanel = ({ benchmark, onChanged }: EditarPanelProps) => {
  const [nombre, setNombre] = useState(benchmark.nombre);
  const [descripcion, setDescripcion] = useState(benchmark.descripcion ?? '');
  const [fuenteUrl, setFuenteUrl] = useState(benchmark.fuenteUrl ?? '');
  const [notaInterna, setNotaInterna] = useState(benchmark.notaInterna ?? '');
  const [divisa, setDivisa] = useState(benchmark.divisa);
  const [anoNuevo, setAnoNuevo] = useState<string>('');
  const [valorNuevo, setValorNuevo] = useState<string>('');

  const anosOrdenados = useMemo(
    () => Object.keys(benchmark.valoresAnuales).map(Number).sort((a, b) => b - a),
    [benchmark.valoresAnuales],
  );

  const onGuardarMetadata = async () => {
    try {
      await updateBenchmark(benchmark.id, {
        nombre,
        descripcion,
        fuenteUrl,
        notaInterna,
        divisa,
      });
      showToastV5('Cambios guardados', 'success');
      await onChanged();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  const onAddValor = async () => {
    const ano = Number(anoNuevo);
    const valor = Number(valorNuevo);
    if (!Number.isFinite(ano) || !Number.isFinite(valor)) {
      showToastV5('Año y valor deben ser numéricos', 'error');
      return;
    }
    try {
      await setValorAnual(benchmark.id, ano, valor);
      setAnoNuevo('');
      setValorNuevo('');
      await onChanged();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  const onBorrarValor = async (ano: number) => {
    try {
      await deleteValorAnual(benchmark.id, ano);
      await onChanged();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  return (
    <div className={styles.editPanel}>
      <div className={styles.editGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nombre</label>
          <input className={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Divisa</label>
          <input
            className={`${styles.input} ${styles.mono}`}
            value={divisa}
            onChange={(e) => setDivisa(e.target.value)}
            maxLength={4}
          />
        </div>
        <div className={styles.field} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Descripción</label>
          <input
            className={styles.input}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Fuente (URL)</label>
          <input
            className={styles.input}
            type="url"
            value={fuenteUrl}
            onChange={(e) => setFuenteUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nota interna</label>
          <input
            className={styles.input}
            value={notaInterna}
            onChange={(e) => setNotaInterna(e.target.value)}
            placeholder="ej. actualizado desde factsheet diciembre"
          />
        </div>
      </div>

      <div className={styles.subhd}>Valores anuales (%)</div>
      {anosOrdenados.length === 0 ? (
        <div className={containerStyles.contentSub} style={{ marginBottom: 12 }}>
          Sin valores · añade el primer año desde el formulario inferior.
        </div>
      ) : (
        <table className={styles.tablaAnual}>
          <thead>
            <tr>
              <th>Año</th>
              <th style={{ textAlign: 'right' }}>Valor (%)</th>
              <th style={{ width: 60, textAlign: 'right' }} />
            </tr>
          </thead>
          <tbody>
            {anosOrdenados.map((ano) => (
              <tr key={ano}>
                <td className={styles.codigo}>{ano}</td>
                <td className={styles.valorUltimoAno}>{benchmark.valoresAnuales[ano].toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
                    onClick={() => onBorrarValor(ano)}
                    aria-label={`Borrar valor del año ${ano}`}
                  >
                    <Icons.Delete size={14} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.formAddAno}>
        <input
          className={`${styles.input} ${styles.mono} ${styles.year}`}
          type="number"
          inputMode="numeric"
          placeholder="2024"
          value={anoNuevo}
          onChange={(e) => setAnoNuevo(e.target.value)}
          aria-label="Año a añadir"
        />
        <input
          className={`${styles.input} ${styles.mono} ${styles.value}`}
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="18.7"
          value={valorNuevo}
          onChange={(e) => setValorNuevo(e.target.value)}
          aria-label="Porcentaje a añadir"
        />
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
          onClick={onAddValor}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Añadir año
        </button>
      </div>

      <div className={styles.actions}>
        <div className={styles.spacer} />
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGold}`}
          onClick={onGuardarMetadata}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Guardar metadata
        </button>
      </div>
    </div>
  );
};

// ── Form para añadir benchmark nuevo ─────────────────────────────────────────

interface AddBenchmarkFormProps {
  visible: boolean;
  onCancel: () => void;
  onCreated: () => Promise<void>;
}

const AddBenchmarkForm = ({ visible, onCancel, onCreated }: AddBenchmarkFormProps) => {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoBenchmark>('indice_equity');
  const [divisa, setDivisa] = useState('EUR');

  if (!visible) return null;

  const onCrear = async () => {
    if (!codigo.trim() || !nombre.trim()) {
      showToastV5('Código y nombre son obligatorios', 'error');
      return;
    }
    try {
      await createBenchmark({ codigo, nombre, tipo, divisa });
      showToastV5(`Benchmark ${codigo} creado`, 'success');
      setCodigo('');
      setNombre('');
      setTipo('indice_equity');
      setDivisa('EUR');
      await onCreated();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  return (
    <div className={styles.editPanel} style={{ marginBottom: 14, borderRadius: 12, border: '1px solid var(--atlas-v5-line)' }}>
      <div className={styles.subhd}>Nuevo benchmark</div>
      <div className={styles.editGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Código</label>
          <input
            className={`${styles.input} ${styles.mono}`}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="MSCI_EM_EUR"
            maxLength={32}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nombre</label>
          <input
            className={styles.input}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="MSCI Emerging Markets EUR"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tipo</label>
          <select
            className={styles.input}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoBenchmark)}
          >
            {TIPO_OPTIONS.map((t) => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Divisa</label>
          <input
            className={`${styles.input} ${styles.mono}`}
            value={divisa}
            onChange={(e) => setDivisa(e.target.value.toUpperCase())}
            maxLength={4}
          />
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.spacer} />
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGold}`}
          onClick={onCrear}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Crear benchmark
        </button>
      </div>
    </div>
  );
};

export default DatosMercadoPage;
