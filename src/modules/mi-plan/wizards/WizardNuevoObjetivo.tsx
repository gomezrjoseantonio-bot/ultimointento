// T27.1 · Wizard "Crear Nuevo Objetivo" · Mi Plan
// Modal full-screen · 5 pasos · 4 tipos canónicos.
// Persiste en `objetivos` vía `createObjetivo` del servicio existente.
//
// Ver docs/atlas-wizard-objetivo-v1.html para la guía visual.
// Cambios respecto al prototipo se documentan en el PR · sección
// "Cambios respecto al prototipo".

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToastV5 } from '../../../design-system/v5';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { initDB } from '../../../services/db';
import { createObjetivo } from '../../../services/objetivosService';
import { getSaldoActualFondo } from '../../../services/fondosService';
import { prestamosService } from '../../../services/prestamosService';
import type { FondoAhorro, Objetivo, ObjetivoTipo } from '../../../types/miPlan';
import type { Prestamo } from '../../../types/prestamos';
import StepperHeader from './components/StepperHeader';
import WizardFooter from './components/WizardFooter';
import AsideResumen from './components/AsideResumen';
import Step1Tipo from './steps/Step1Tipo';
import Step2Meta from './steps/Step2Meta';
import Step3Plazo from './steps/Step3Plazo';
import Step4Vinculos from './steps/Step4Vinculos';
import Step5Resumen from './steps/Step5Resumen';
import {
  draftInicial,
  parseMetaNumeric,
  type ObjetivoDraft,
  type StepKey,
} from './types';
import { calcularRitmo, type RitmoResult } from './utils/calcularRitmo';
import styles from './WizardNuevoObjetivo.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (objetivo: Objetivo) => void;
}

const TOTAL_STEPS = 5;

const WizardNuevoObjetivo: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const [step, setStep] = useState<StepKey>(1);
  const [maxReached, setMaxReached] = useState<StepKey>(1);
  const [draft, setDraft] = useState<ObjetivoDraft>(() => draftInicial());

  const [fondos, setFondos] = useState<FondoAhorro[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [saldosFondos, setSaldosFondos] = useState<Record<string, number>>({});
  const [inmueblesCount, setInmueblesCount] = useState(0);
  const [proximoAst, setProximoAst] = useState('OBJ-01');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  // Patrón canon del repo · `useFocusTrap` confina Tab dentro del modal y
  // dispara `modal-escape` al pulsar ESC (ver src/hooks/useFocusTrap.ts).
  const overlayRef = useFocusTrap(isOpen);

  // Reset al abrir y bloquear scroll del body padre.
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setMaxReached(1);
    setDraft(draftInicial());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Escuchar el evento `modal-escape` que dispara useFocusTrap al pulsar ESC.
  useEffect(() => {
    if (!isOpen) return;
    const node = overlayRef.current;
    if (!node) return;
    const handle = (): void => onClose();
    node.addEventListener('modal-escape', handle);
    return () => node.removeEventListener('modal-escape', handle);
  }, [isOpen, onClose, overlayRef]);

  // Cargar datos auxiliares.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const db = await initDB();
        const [fon, prest, props, objs] = await Promise.all([
          db.getAll('fondos_ahorro') as Promise<FondoAhorro[]>,
          prestamosService.getAllPrestamos(),
          db.getAll('properties') as Promise<{ state?: string }[]>,
          db.getAll('objetivos') as Promise<Objetivo[]>,
        ]);
        if (cancelled) return;
        const fondosActivos = fon.filter((f) => f.activo);
        setFondos(fondosActivos);
        setPrestamos(prest);
        setInmueblesCount(props.filter((p) => p.state !== 'baja').length);
        setProximoAst(`OBJ-${String(objs.length + 1).padStart(2, '0')}`);

        const saldos: Record<string, number> = {};
        await Promise.all(
          fondosActivos.map(async (f) => {
            try {
              saldos[f.id] = await getSaldoActualFondo(f.id);
            } catch {
              saldos[f.id] = 0;
            }
          }),
        );
        if (!cancelled) setSaldosFondos(saldos);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[wizard objetivo] error cargando datos', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const onPatch = useCallback((patch: Partial<ObjetivoDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const onSelectTipo = useCallback(
    (tipo: ObjetivoTipo) => {
      setDraft((prev) => ({ ...draftInicial(), tipo, capacidadAhorroMensual: prev.capacidadAhorroMensual }));
    },
    [],
  );

  // ── Validación por step ──
  const canAdvance = useMemo<boolean>(() => {
    if (step === 1) {
      return draft.tipo != null;
    }
    if (step === 2) {
      if (draft.tipo === 'acumular') {
        const meta = parseMetaNumeric(draft.acumularValorMeta);
        return draft.nombre.trim().length > 0 && meta > 0;
      }
      if (draft.tipo === 'amortizar') {
        return draft.nombre.trim().length > 0 && draft.prestamoId.length > 0;
      }
      if (draft.tipo === 'comprar') {
        const meta = parseMetaNumeric(draft.comprarValorMeta);
        return draft.nombre.trim().length > 0 && meta > 0;
      }
      if (draft.tipo === 'reducir') {
        const meta = parseMetaNumeric(draft.reducirMetaMensual);
        const catOk =
          draft.reducirCategoria !== 'otro' || draft.reducirCategoriaLibre.trim().length > 0;
        return draft.nombre.trim().length > 0 && meta > 0 && catOk;
      }
      return false;
    }
    if (step === 3) {
      if (!draft.fechaCierre) return false;
      const d = new Date(draft.fechaCierre);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Number.isFinite(d.getTime()) && d >= today;
    }
    if (step === 4) {
      if (draft.tipo === 'acumular' || draft.tipo === 'comprar') {
        return draft.fondoId.length > 0;
      }
      return true; // amortizar y reducir no requieren vínculo en este paso
    }
    if (step === 5) {
      return true;
    }
    return false;
  }, [step, draft]);

  // ── Cálculo del ritmo en vivo ──
  const ritmo: RitmoResult = useMemo<RitmoResult>(() => {
    const fechaObjetivo = draft.fechaCierre ? new Date(draft.fechaCierre) : null;
    const cap = parseMetaNumeric(draft.capacidadAhorroMensual);

    let valorActual = 0;
    let valorMeta = 0;
    if (draft.tipo === 'acumular') {
      valorActual = parseMetaNumeric(draft.acumularValorActual);
      valorMeta = parseMetaNumeric(draft.acumularValorMeta);
    } else if (draft.tipo === 'comprar') {
      valorActual = draft.comprarMetric === 'unidades' ? inmueblesCount : 0;
      valorMeta = parseMetaNumeric(draft.comprarValorMeta);
    } else if (draft.tipo === 'amortizar') {
      const p = prestamos.find((x) => x.id === draft.prestamoId);
      valorActual = p?.principalVivo ?? 0;
      valorMeta = 0;
    }

    return calcularRitmo({
      valorActual,
      valorMeta,
      fechaObjetivo,
      capacidadAhorroActual: cap,
    });
  }, [draft, prestamos, inmueblesCount]);

  const showRitmo = draft.tipo === 'acumular' || draft.tipo === 'comprar';

  // ── Navegación ──
  const goTo = useCallback((target: StepKey) => {
    setStep((current) => {
      if (target <= current) return target;
      return current;
    });
  }, []);

  const onNext = useCallback(() => {
    if (!canAdvance) return;
    setStep((current) => {
      if (current >= TOTAL_STEPS) return current;
      const next = (current + 1) as StepKey;
      setMaxReached((prev) => (next > prev ? next : prev));
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      return next;
    });
  }, [canAdvance]);

  const onPrev = useCallback(() => {
    setStep((current) => {
      if (current <= 1) return current;
      const prev = (current - 1) as StepKey;
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      return prev;
    });
  }, []);

  // ── Submit ──
  const onSubmit = useCallback(async () => {
    if (!draft.tipo || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const nombre = draft.nombre.trim();
      const descripcionTrim = draft.descripcion.trim();
      const fechaCierre = draft.fechaCierre;
      const estado: 'en-progreso' = 'en-progreso';

      // Construimos el `Objetivo` válido (incluye discriminante `tipo` que se
      // mantiene en la unión) y pasamos al servicio omitiendo los campos
      // generados (id · createdAt · updatedAt). `Omit` sobre la unión
      // discriminada del tipo exportado colapsa los campos · por eso lo
      // hacemos al revés: armamos el `Objetivo` completo con campos dummy y
      // dejamos que el servicio sobreescriba id · createdAt · updatedAt.
      const dummyTime = '__will_be_overwritten__';
      const baseDummy = { id: dummyTime, createdAt: dummyTime, updatedAt: dummyTime };

      let full: Objetivo;
      if (draft.tipo === 'acumular') {
        full = {
          ...baseDummy,
          tipo: 'acumular',
          nombre,
          ...(descripcionTrim ? { descripcion: descripcionTrim } : {}),
          fechaCierre,
          estado,
          metaCantidad: parseMetaNumeric(draft.acumularValorMeta),
          fondoId: draft.fondoId,
        };
      } else if (draft.tipo === 'amortizar') {
        const p = prestamos.find((x) => x.id === draft.prestamoId);
        full = {
          ...baseDummy,
          tipo: 'amortizar',
          nombre,
          ...(descripcionTrim ? { descripcion: descripcionTrim } : {}),
          fechaCierre,
          estado,
          metaCantidad: p?.principalVivo ?? 0,
          prestamoId: draft.prestamoId,
        };
      } else if (draft.tipo === 'comprar') {
        full = {
          ...baseDummy,
          tipo: 'comprar',
          nombre,
          ...(descripcionTrim ? { descripcion: descripcionTrim } : {}),
          fechaCierre,
          estado,
          metaCantidad: parseMetaNumeric(draft.comprarValorMeta),
          fondoId: draft.fondoId,
        };
      } else {
        const categoria =
          draft.reducirCategoria === 'otro'
            ? draft.reducirCategoriaLibre.trim() || 'otro'
            : draft.reducirCategoria;
        full = {
          ...baseDummy,
          tipo: 'reducir',
          nombre,
          ...(descripcionTrim ? { descripcion: descripcionTrim } : {}),
          fechaCierre,
          estado,
          metaCantidadMensual: parseMetaNumeric(draft.reducirMetaMensual),
          categoriaGasto: categoria,
        };
      }
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...input } = full;
      void _id; void _ca; void _ua;
      const objetivo = await createObjetivo(input);

      showToastV5(`Objetivo creado · ${objetivo.nombre}`);
      onCreated(objetivo);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      showToastV5(`Error al crear objetivo · ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, isSubmitting, prestamos, onCreated, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Crear nuevo objetivo"
    >
      <div className={styles.wiz}>
        <StepperHeader
          current={step}
          maxReached={maxReached}
          onGoTo={goTo}
          onClose={onClose}
        />

        <div className={styles.body} ref={bodyRef}>
          <div className={styles.bodyInner}>
            {step === 1 && (
              <Step1Tipo selected={draft.tipo} onSelect={onSelectTipo} />
            )}
            {step === 2 && (
              <Step2Meta
                draft={draft}
                prestamos={prestamos}
                inmueblesCount={inmueblesCount}
                onPatch={onPatch}
              />
            )}
            {step === 3 && (
              <Step3Plazo
                draft={draft}
                ritmo={ritmo}
                showRitmo={showRitmo}
                onPatch={onPatch}
              />
            )}
            {step === 4 && (
              <Step4Vinculos
                draft={draft}
                fondos={fondos}
                saldosFondos={saldosFondos}
                onPatch={onPatch}
              />
            )}
            {step === 5 && (
              <Step5Resumen
                draft={draft}
                fondos={fondos}
                prestamos={prestamos}
                saldosFondos={saldosFondos}
                inmueblesCount={inmueblesCount}
                ritmo={ritmo}
                proximoAst={proximoAst}
              />
            )}
          </div>
        </div>

        <AsideResumen
          draft={draft}
          fondos={fondos}
          prestamos={prestamos}
          inmueblesCount={inmueblesCount}
          ritmo={ritmo}
        />

        <WizardFooter
          current={step}
          totalSteps={TOTAL_STEPS}
          canAdvance={canAdvance}
          isSubmitting={isSubmitting}
          onPrev={onPrev}
          onNext={onNext}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
};

export default WizardNuevoObjetivo;
export { WizardNuevoObjetivo };
