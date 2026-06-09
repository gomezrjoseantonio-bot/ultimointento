/**
 * Sección "Esto encontré en tus extractos" · vive DENTRO del bloque cuentas
 * (FIX PUNTO 4 · fusión cuentas+extractos). Es el contenido de la antigua
 * pantalla `/empezar/sugerencias` (BORRADA) · INTACTO salvo que:
 *   · se monta como sección embebida (sin topbar ni navegación propia);
 *   · "Subir extracto" es ahora una acción POR CUENTA desde la lista de arriba
 *     (no un puente a `/tesoreria/importar`);
 *   · incluye "Añadir recurrente a mano" · la vía manual REAL (alta existente de
 *     compromisosRecurrentes sobre el flujo) que sustituye a la vía fantasma.
 *
 * La detección NUNCA crea sola: el usuario confirma o descarta cada propuesta.
 * Confirmar recurrente crea el compromiso por su servicio canónico + refuerza
 * learning rules. Completar préstamo/nómina abre su wizard pre-rellenado
 * (deep-links a SUS bloques · intactos).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import { useOnboarding } from '../OnboardingContext';
import {
  detectarSugerencias,
  confirmarSugerencia,
  descartarSugerencia,
  adivinarAmbitoRecurrente,
  type Sugerencia,
  type AmbitoRecurrente,
  type InmuebleLite,
} from '../../../../services/onboardingDetectionService';
import { initDB } from '../../../../services/db';
import AmbitoGastoModal from './AmbitoGastoModal';
import styles from '../empezar.module.css';

// Estado del modal de ámbito (P10): o un alta manual, o la confirmación de una
// sugerencia detectada concreta. `null` = cerrado.
type AmbitoModalState =
  | { kind: 'manual' }
  | { kind: 'confirmar'; sug: Sugerencia; guess: AmbitoRecurrente }
  | null;

const eur = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const SugerenciasSection: React.FC = () => {
  const navigate = useNavigate();
  const { state, refresh } = useOnboarding();
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [confirmadas, setConfirmadas] = useState(0);
  const [inmuebles, setInmuebles] = useState<InmuebleLite[]>([]);
  const [ambitoModal, setAmbitoModal] = useState<AmbitoModalState>(null);

  useEffect(() => {
    let alive = true;
    void detectarSugerencias().then((s) => {
      if (alive) {
        setSugerencias(s);
        setCargando(false);
      }
    });
    // Inmuebles del usuario · para enrutar el ámbito (P10). Lista ligera.
    void (async () => {
      try {
        const db = await initDB();
        const props = ((await db.getAll('properties')) ?? []) as Array<{
          id?: number;
          alias?: string;
          address?: string;
        }>;
        if (alive) {
          setInmuebles(
            props
              .filter((p): p is { id: number; alias?: string; address?: string } => p.id != null)
              .map((p) => ({ id: p.id, alias: p.alias, address: p.address })),
          );
        }
      } catch {
        // Sin inmuebles disponibles · el modal ofrecerá solo "personal".
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cuentasConExtracto = useMemo(
    () => Object.values(state.cuentas).filter((v) => v === 'con_extracto').length,
    [state.cuentas],
  );

  const grupos = useMemo(
    () => ({
      recurrente: sugerencias.filter((s) => s.tipo === 'recurrente'),
      prestamo: sugerencias.filter((s) => s.tipo === 'prestamo'),
      nomina: sugerencias.filter((s) => s.tipo === 'nomina'),
    }),
    [sugerencias],
  );

  const quitar = (clave: string) => setSugerencias((prev) => prev.filter((s) => s.clave !== clave));

  // P10 · confirmar una sugerencia abre primero "¿De qué es este gasto?" con el
  // ámbito pre-marcado por el motor · el usuario confirma o lo cambia.
  const onConfirmar = (sug: Sugerencia) => {
    const guess = adivinarAmbitoRecurrente(`${sug.nombre} ${sug.contraparte}`, inmuebles);
    setAmbitoModal({ kind: 'confirmar', sug, guess });
  };

  const confirmarConAmbito = useCallback(
    async (sug: Sugerencia, ambito: AmbitoRecurrente) => {
      await confirmarSugerencia(sug, ambito);
      quitar(sug.clave);
      setConfirmadas((c) => c + 1);
      showToastV5(
        ambito.ambito === 'inmueble'
          ? 'Gasto de inmueble confirmado · deducible y en la previsión'
          : 'Recurrente confirmado · alimentará la previsión',
        'success',
      );
      void refresh();
    },
    [refresh],
  );

  // P10 · "Añadir recurrente a mano" pregunta el ámbito y enruta al alta REAL:
  // inmueble → `/inmuebles/:id/gastos/nuevo` (gastosInmueble), personal →
  // `/personal/gastos/nuevo`. Ambas vuelven al bloque (`?from=empezar`).
  const irAltaManual = (ambito: AmbitoRecurrente) => {
    if (ambito.ambito === 'inmueble' && ambito.inmuebleId != null) {
      navigate(`/inmuebles/${ambito.inmuebleId}/gastos/nuevo?from=empezar`);
    } else {
      navigate('/personal/gastos/nuevo?from=empezar');
    }
  };

  const onAmbitoConfirm = (sel: AmbitoRecurrente) => {
    const estado = ambitoModal;
    setAmbitoModal(null);
    if (!estado) return;
    if (estado.kind === 'manual') {
      irAltaManual(sel);
    } else {
      void confirmarConAmbito(estado.sug, sel);
    }
  };

  const onDescartar = async (sug: Sugerencia) => {
    await descartarSugerencia(sug);
    quitar(sug.clave);
    showToastV5('Sugerencia descartada · Atlas aprende', 'info');
  };

  // Préstamo/nómina siguen enlazando a SUS bloques (deep-links intactos).
  const onCompletar = (sug: Sugerencia) => {
    const destino = sug.tipo === 'prestamo' ? '/empezar/prestamos' : '/empezar/nomina';
    navigate(destino, { state: { prefill: sug } });
  };

  const renderRow = (sug: Sugerencia, accion: 'confirmar' | 'completar') => (
    <div key={sug.clave} className={`${styles.sugRow} ${sug.needs ? styles.needs : ''}`}>
      <div className={styles.sugConcept}>
        <div className={styles.sugName}>{sug.nombre}</div>
        <div className={styles.sugMeta}>{sug.meta}</div>
      </div>
      <div className={`${styles.sugAmount} ${styles.mono}`}>
        {sug.importeVariable ? '~' : ''}
        {eur(sug.importe)}
      </div>
      <div className={styles.sugPeriod}>{sug.cadencia}</div>
      <div className={styles.sugActions}>
        {accion === 'confirmar' ? (
          <button type="button" className={`${styles.btnMini} ${styles.ok}`} onClick={() => onConfirmar(sug)}>
            Confirmar
          </button>
        ) : (
          <button type="button" className={`${styles.btnMini} ${styles.complete}`} onClick={() => onCompletar(sug)}>
            Completar
          </button>
        )}
        <button type="button" className={`${styles.btnMini} ${styles.no}`} onClick={() => onDescartar(sug)}>
          Descartar
        </button>
      </div>
    </div>
  );

  return (
    <>
    <div className={styles.sugSectionWrap}>
      <div className={styles.sugSectionHead}>
        <div>
          <div className={styles.kick}>Acelerador · tus extractos hablan</div>
          <h2 className={styles.sugSectionTitle}>Esto encontré en tus extractos</h2>
        </div>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => setAmbitoModal({ kind: 'manual' })}
        >
          <Icons.Plus size={14} strokeWidth={2.5} /> Añadir recurrente a mano
        </button>
      </div>
      <p className={styles.sub}>
        De los extractos de tus cuentas. Atlas nunca crea nada solo · tú confirmas o descartas cada sugerencia · o la
        das de alta a mano.
      </p>

      <div className={styles.sugSummary}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Extractos leídos</div>
          <div className={`${styles.kpiVal} ${styles.mono}`}>{cuentasConExtracto || '—'}</div>
          <div className={styles.kpiSub}>cuentas con extracto</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Sugerencias</div>
          <div className={`${styles.kpiVal} ${styles.mono}`}>{sugerencias.length}</div>
          <div className={styles.kpiSub}>
            {grupos.recurrente.length} gastos · {grupos.prestamo.length} préstamo · {grupos.nomina.length} nómina
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Confirmadas</div>
          <div className={`${styles.kpiVal} ${styles.mono}`}>{confirmadas}</div>
          <div className={styles.kpiSub}>cada confirmación enseña a Atlas</div>
        </div>
      </div>

      {cargando ? (
        <div className={styles.sugEmptyNote}>Analizando tus movimientos…</div>
      ) : sugerencias.length === 0 ? (
        <div className={styles.sugEmptyNote}>
          {cuentasConExtracto > 0
            ? 'No hay sugerencias por ahora · Atlas seguirá aprendiendo de tus movimientos.'
            : 'Sube el extracto de una cuenta (botón "Subir extracto" en su fila) para que Atlas deduzca tus recurrentes, préstamos y nómina · o añade un recurrente a mano.'}
        </div>
      ) : (
        <>
          {grupos.recurrente.length > 0 && (
            <div className={styles.sugGroup}>
              <div className={styles.sugGroupTitle}>
                <Icons.Refresh size={15} strokeWidth={1.8} />
                Gastos recurrentes <span className={styles.cnt}>{grupos.recurrente.length}</span>
              </div>
              {grupos.recurrente.map((s) => renderRow(s, 'confirmar'))}
            </div>
          )}
          {grupos.prestamo.length > 0 && (
            <div className={styles.sugGroup}>
              <div className={styles.sugGroupTitle}>
                <Icons.Financiacion size={15} strokeWidth={1.8} />
                Posible préstamo <span className={styles.cnt}>{grupos.prestamo.length}</span>
              </div>
              {grupos.prestamo.map((s) => renderRow(s, 'completar'))}
            </div>
          )}
          {grupos.nomina.length > 0 && (
            <div className={styles.sugGroup}>
              <div className={styles.sugGroupTitle}>
                <Icons.Banknote size={15} strokeWidth={1.8} />
                Posible nómina <span className={styles.cnt}>{grupos.nomina.length}</span>
              </div>
              {grupos.nomina.map((s) => renderRow(s, 'completar'))}
              <div className={styles.sugEmptyNote}>
                Los abonos que cuadran con tus contratos de alquiler no aparecen aquí · esos los gestiona la
                conciliación normal de Atlas desde el primer día.
              </div>
            </div>
          )}
        </>
      )}
    </div>

      <AmbitoGastoModal
        open={ambitoModal !== null}
        inmuebles={inmuebles}
        initial={ambitoModal?.kind === 'confirmar' ? ambitoModal.guess : undefined}
        concepto={ambitoModal?.kind === 'confirmar' ? ambitoModal.sug.nombre : undefined}
        confirmLabel={ambitoModal?.kind === 'confirmar' ? 'Confirmar' : 'Continuar'}
        onClose={() => setAmbitoModal(null)}
        onConfirm={onAmbitoConfirm}
      />
    </>
  );
};

export default SugerenciasSection;
