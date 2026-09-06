import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import { familiasSugeridas, subtiposDe, type FamiliaId } from '../../../services/catalogo/catalogoUnico';
import { casillaDe } from '../../../services/fiscal/lenteFiscal';
import styles from './EditarRegistroInmuebleModal.module.css';

/** Los tres tipos de registro operables desde la vista de Gastos → Registrados. */
export type TipoRegistroInmueble = 'real' | 'mejora' | 'mobiliario';

/** Referencia editable · discrimina el tipo de registro y su entidad concreta. */
export type RegistroInmuebleEditable =
  | { tipo: 'real'; registro: GastoInmueble }
  | { tipo: 'mejora'; registro: MejoraInmueble }
  | { tipo: 'mobiliario'; registro: MuebleInmueble };

export interface EditarRegistroInmuebleModalProps {
  /** Registro a editar. Requerido en modo `editar`, ignorado en modo `crear`. */
  registro?: RegistroInmuebleEditable;
  /** Modo del modal · por defecto `editar`. */
  modo?: 'editar' | 'crear';
  /** Tipo a crear · requerido en modo `crear`. */
  tipoCrear?: TipoRegistroInmueble;
  guardando?: boolean;
  onCancel: () => void;
  /** Emite los campos del formulario · el padre los persiste vía servicio. */
  onGuardar: (updates: Record<string, unknown>) => void;
}

// Las familias de GASTO que tienen sentido en un inmueble · catálogo único.
const FAMILIAS_GASTO = familiasSugeridas('gasto', 'inmueble');

const TIPOS_MEJORA: Array<{ value: MejoraInmueble['tipo']; label: string }> = [
  { value: 'mejora', label: 'Mejora' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'reparacion', label: 'Reparación' },
];

const TITULO_EDITAR: Record<TipoRegistroInmueble, string> = {
  real: 'Editar gasto',
  mejora: 'Editar mejora',
  mobiliario: 'Editar mobiliario',
};

const TITULO_CREAR: Record<TipoRegistroInmueble, string> = {
  real: 'Añadir gasto',
  mejora: 'Añadir mejora',
  mobiliario: 'Añadir mobiliario',
};

const anioDeFecha = (fecha: string): number | undefined => {
  const y = Number(fecha?.slice(0, 4));
  return Number.isInteger(y) && y > 0 ? y : undefined;
};

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

const EditarRegistroInmuebleModal: React.FC<EditarRegistroInmuebleModalProps> = ({
  registro,
  modo = 'editar',
  tipoCrear,
  guardando = false,
  onCancel,
  onGuardar,
}) => {
  const esCrear = modo === 'crear';
  const tipo: TipoRegistroInmueble = registro ? registro.tipo : tipoCrear ?? 'real';

  // Estado de formulario · inicializado desde la entidad (editar) o en blanco (crear).
  const inicial = useMemo(() => {
    if (esCrear || !registro) {
      return {
        texto: '',
        familia: 'suministro' as FamiliaId,
        subtipo: '',
        tipoMejora: 'mejora' as MejoraInmueble['tipo'],
        fecha: hoyISO(),
        importe: '',
        vidaUtil: tipo === 'mobiliario' ? '10' : '',
      };
    }
    if (registro.tipo === 'real') {
      const g = registro.registro;
      return {
        texto: g.concepto ?? '',
        familia: (g.familia ?? 'otros') as FamiliaId,
        subtipo: g.subtipo ?? '',
        tipoMejora: 'mejora' as MejoraInmueble['tipo'],
        fecha: g.fecha ?? '',
        importe: String(g.importe ?? ''),
        vidaUtil: '',
      };
    }
    if (registro.tipo === 'mejora') {
      const m = registro.registro;
      return {
        texto: m.descripcion ?? '',
        familia: 'reforma_mejora' as FamiliaId,
        subtipo: '',
        tipoMejora: m.tipo,
        fecha: m.fecha ?? '',
        importe: String(m.importe ?? ''),
        vidaUtil: '',
      };
    }
    const mu = registro.registro;
    return {
      texto: mu.descripcion ?? '',
      familia: 'mobiliario_enseres' as FamiliaId,
      subtipo: '',
      tipoMejora: 'mejora' as MejoraInmueble['tipo'],
      fecha: mu.fechaAlta ?? '',
      importe: String(mu.importe ?? ''),
      vidaUtil: String(mu.vidaUtil ?? ''),
    };
  }, [esCrear, registro, tipo]);

  const [texto, setTexto] = useState(inicial.texto);
  const [familia, setFamilia] = useState<FamiliaId>(inicial.familia);
  const [subtipo, setSubtipo] = useState<string>(inicial.subtipo);
  const [tipoMejora, setTipoMejora] = useState<MejoraInmueble['tipo']>(inicial.tipoMejora);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [importe, setImporte] = useState(inicial.importe);
  const [vidaUtil, setVidaUtil] = useState(inicial.vidaUtil);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, guardando]);

  const importeNum = Number(importe);
  const vidaUtilNum = Number(vidaUtil);
  const textoValido = texto.trim().length > 0;
  const importeValido = Number.isFinite(importeNum) && importeNum > 0;
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const vidaUtilValida =
    tipo !== 'mobiliario' || (Number.isInteger(vidaUtilNum) && vidaUtilNum > 0);
  const valido = textoValido && importeValido && fechaValida && vidaUtilValida;

  const handleGuardar = useCallback(() => {
    if (!valido) return;
    const ejercicio = anioDeFecha(fecha);
    if (tipo === 'real') {
      onGuardar({
        concepto: texto.trim(),
        familia,
        subtipo: subtipo || undefined,
        // La casilla la pone la lente fiscal leyendo familia + subtipo.
        casillaAEAT: casillaDe({ familia, subtipo: subtipo || undefined, ambito: 'inmueble' }),
        fecha,
        importe: importeNum,
        ...(ejercicio !== undefined ? { ejercicio } : {}),
      });
      return;
    }
    if (tipo === 'mejora') {
      onGuardar({
        descripcion: texto.trim(),
        tipo: tipoMejora,
        fecha,
        importe: importeNum,
        ...(ejercicio !== undefined ? { ejercicio } : {}),
      });
      return;
    }
    onGuardar({
      descripcion: texto.trim(),
      fechaAlta: fecha,
      importe: importeNum,
      vidaUtil: vidaUtilNum,
      ...(ejercicio !== undefined ? { ejercicio } : {}),
    });
  }, [valido, fecha, tipo, onGuardar, texto, familia, subtipo, importeNum, tipoMejora, vidaUtilNum]);

  const tituloId = 'editar-registro-titulo';
  const titulo = esCrear ? TITULO_CREAR[tipo] : TITULO_EDITAR[tipo];

  return (
    <div className={styles.overlay} onClick={() => !guardando && onCancel()}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={tituloId} className={styles.title}>
            {titulo}
          </h2>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>
              {tipo === 'real' ? 'Concepto' : 'Descripción'}
            </span>
            <input
              type="text"
              className={styles.input}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
          </label>

          {tipo === 'real' && (
            <label className={styles.field}>
              <span className={styles.label}>Familia</span>
              <select
                className={styles.input}
                value={familia}
                onChange={(e) => {
                  setFamilia(e.target.value as FamiliaId);
                  setSubtipo('');
                }}
              >
                {FAMILIAS_GASTO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tipo === 'real' && subtiposDe(familia).length > 0 && (
            <label className={styles.field}>
              <span className={styles.label}>Subtipo</span>
              <select className={styles.input} value={subtipo} onChange={(e) => setSubtipo(e.target.value)}>
                <option value="">— Sin subtipo —</option>
                {subtiposDe(familia).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {tipo === 'mejora' && (
            <label className={styles.field}>
              <span className={styles.label}>Tipo</span>
              <select
                className={styles.input}
                value={tipoMejora}
                onChange={(e) => setTipoMejora(e.target.value as MejoraInmueble['tipo'])}
              >
                {TIPOS_MEJORA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>
                {tipo === 'mobiliario' ? 'Fecha de alta' : 'Fecha'}
              </span>
              <input
                type="date"
                className={styles.input}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Importe (€)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={styles.input}
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </label>
          </div>

          {tipo === 'mobiliario' && (
            <label className={styles.field}>
              <span className={styles.label}>Vida útil (años)</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                className={styles.input}
                value={vidaUtil}
                onChange={(e) => setVidaUtil(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnGhost} onClick={onCancel} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleGuardar}
            disabled={!valido || guardando}
          >
            {guardando ? 'Guardando…' : esCrear ? 'Añadir' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditarRegistroInmuebleModal;
