// T27.3 · Wizard "Crear Nuevo Fondo de Ahorro" · Mi Plan
// Modal full-screen · 5 pasos · 4 categorías canónicas (colchon · compra ·
// reforma · impuestos) · vinculación bidireccional con objetivos.
//
// Ver docs/atlas-wizard-fondo-v3.html para la guía visual.
// Cambios respecto al prototipo se documentan en el PR.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { initDB } from '../../../services/db';
import { createFondo } from '../../../services/fondosService';
import type { Account } from '../../../services/db';
import type { FondoAhorro, Objetivo, CuentaAsignada } from '../../../types/miPlan';
import StepperHeader from './components/StepperHeader';
import WizardFooter from './components/WizardFooter';
import AsideResumenFondo from './components/AsideResumenFondo';
import Step1Categoria from './steps/Step1Categoria';
import Step2MetaFondo from './steps/Step2MetaFondo';
import Step3Cuentas from './steps/Step3Cuentas';
import Step4VinculosFondo from './steps/Step4VinculosFondo';
import Step5ResumenFondo from './steps/Step5ResumenFondo';
import {
  draftInicialFondo,
  parseImporte,
  calcularMetaColchon,
  buildFechaIso,
  type FondoDraft,
  type CategoriaFondo,
} from './typesFondo';
import { calcularRitmo, type RitmoResult } from './utils/calcularRitmo';
import { computeAcumuladoFondo } from './utils/computeAcumuladoFondo';
import { computeDisponibleEnCuenta } from './utils/computeDisponibleEnCuenta';
import { loadSaldosActualesCuentas } from './utils/getCurrentSaldoCuenta';
import type { StepKey } from './types';
import styles from './WizardNuevoFondo.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (fondo: FondoAhorro) => void;
  /** Si poblado · pre-selecciona ese objetivo en step 4 (G.2 opción A T27.3). */
  objetivoVinculadoIdInicial?: string;
}

const TOTAL_STEPS = 5;

const STEPS_FONDO = [
  { key: 1 as StepKey, label: 'Categoría' },
  { key: 2 as StepKey, label: 'Meta' },
  { key: 3 as StepKey, label: 'Cuentas' },
  { key: 4 as StepKey, label: 'Vínculos' },
  { key: 5 as StepKey, label: 'Resumen' },
];

const WizardNuevoFondo: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreated,
  objetivoVinculadoIdInicial,
}) => {
  const [step, setStep] = useState<StepKey>(1);
  const [maxReached, setMaxReached] = useState<StepKey>(1);
  const [draft, setDraft] = useState<FondoDraft>(() => draftInicialFondo());

  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [saldosCuentas, setSaldosCuentas] = useState<Map<number, number>>(new Map());
  const [todosFondos, setTodosFondos] = useState<FondoAhorro[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const overlayRef = useFocusTrap(isOpen);

  // Reset al abrir + scroll lock
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setMaxReached(1);
    setDraft(() => {
      const d = draftInicialFondo();
      // Si recibimos pre-vinculación · marcamos elegido y seteamos el id
      if (objetivoVinculadoIdInicial) {
        d.objetivoVinculadoId = objetivoVinculadoIdInicial;
        d.vinculoElegido = true;
      }
      return d;
    });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, objetivoVinculadoIdInicial]);

  // ESC vía focus trap
  useEffect(() => {
    if (!isOpen) return;
    const node = overlayRef.current;
    if (!node) return;
    const handle = (): void => onClose();
    node.addEventListener('modal-escape', handle);
    return () => node.removeEventListener('modal-escape', handle);
  }, [isOpen, onClose, overlayRef]);

  // Cargar datos al abrir
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const db = await initDB();
        const [{ cuentas: cuentasActivas, saldos }, fon, obj] = await Promise.all([
          loadSaldosActualesCuentas(),
          db.getAll('fondos_ahorro') as Promise<FondoAhorro[]>,
          db.getAll('objetivos') as Promise<Objetivo[]>,
        ]);
        if (cancelled) return;
        setCuentas(cuentasActivas);
        setSaldosCuentas(saldos);
        setTodosFondos(fon);
        setObjetivos(obj.filter((o) => o.estado !== 'archivado'));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[wizard fondo] error cargando datos', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const onPatch = useCallback((patch: Partial<FondoDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const onSelectCategoria = useCallback(
    (cat: CategoriaFondo) => {
      setDraft((prev) => {
        // Reset campos específicos al cambiar de categoría · pero conservamos
        // capacidadAhorroMensual y vinculación (decisión UX · permitir
        // back/cambiar sin perder lo común)
        const base = draftInicialFondo();
        return {
          ...base,
          categoria: cat,
          nombre: defaultNombre(cat),
          capacidadAhorroMensual: prev.capacidadAhorroMensual,
          objetivoVinculadoId: prev.objetivoVinculadoId,
          vinculoElegido: prev.vinculoElegido,
        };
      });
    },
    [],
  );

  // Validación por step
  const canAdvance = useMemo<boolean>(() => {
    if (step === 1) return draft.categoria != null;
    if (step === 2) {
      if (draft.nombre.trim().length === 0) return false;
      if (draft.categoria === 'colchon') {
        return calcularMetaColchon(draft) > 0;
      }
      return parseImporte(draft.metaImporte) > 0;
    }
    if (step === 3) {
      if (draft.cuentasAsignadas.length === 0) return false;
      // Validación dura · ningún input excede disponible
      for (const a of draft.cuentasAsignadas) {
        const saldoCuenta = saldosCuentas.get(a.cuentaId) ?? 0;
        const disp = computeDisponibleEnCuenta({
          cuentaId: a.cuentaId,
          saldoCuenta,
          fondos: todosFondos,
        });
        if (a.importeAsignado <= 0) return false;
        if (a.importeAsignado > disp.disponible + 0.01) return false;
      }
      return true;
    }
    if (step === 4) {
      return draft.vinculoElegido;
    }
    return true;
  }, [step, draft, saldosCuentas, todosFondos]);

  // Cálculo del ritmo y acumulado en vivo
  const ritmo: RitmoResult = useMemo(() => {
    const meta =
      draft.categoria === 'colchon'
        ? calcularMetaColchon(draft)
        : parseImporte(draft.metaImporte);
    const fechaIso = buildFechaIso(draft.fechaObjetivoMes, draft.fechaObjetivoAnio);
    const fechaObjetivo = fechaIso ? new Date(fechaIso) : null;
    const cap = parseImporte(draft.capacidadAhorroMensual);
    // valorActual del fondo (en el contexto · acumulado actual)
    let valorActual = 0;
    for (const a of draft.cuentasAsignadas) {
      valorActual += a.importeAsignado;
    }
    return calcularRitmo({
      valorActual,
      valorMeta: meta,
      fechaObjetivo,
      capacidadAhorroActual: cap,
    });
  }, [draft]);

  // Acumulado estimado del fondo nuevo · aplicamos cascada con los fondos
  // existentes + un fondo "virtual" que representa el draft actual.
  const acumuladoEstimado = useMemo<number>(() => {
    if (draft.cuentasAsignadas.length === 0) return 0;
    // Construimos un fondo virtual con prioridad alta y createdAt = ahora
    const fondoVirtual: FondoAhorro = {
      id: '__draft__',
      tipo: draft.categoria ?? 'compra',
      nombre: draft.nombre || 'nuevo fondo',
      cuentasAsignadas: draft.cuentasAsignadas.map(
        (a): CuentaAsignada => ({
          cuentaId: a.cuentaId,
          modo: 'parcial',
          modoImporte: 'fijo',
          importeAsignado: a.importeAsignado,
        }),
      ),
      activo: true,
      prioridad: draft.prioridad,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = computeAcumuladoFondo({
      fondo: fondoVirtual,
      saldosCuentas,
      todosFondos: [...todosFondos, fondoVirtual],
    });
    return result.acumuladoReal;
  }, [draft, saldosCuentas, todosFondos]);

  const asignadoTotal = useMemo(
    () => draft.cuentasAsignadas.reduce((sum, a) => sum + a.importeAsignado, 0),
    [draft.cuentasAsignadas],
  );

  // Navegación
  const goTo = useCallback((target: StepKey) => {
    setStep((current) => (target <= current ? target : current));
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

  // Submit
  const onSubmit = useCallback(async () => {
    if (!draft.categoria || isSubmitting) return;

    // Si el objetivo ya estaba vinculado a otro fondo · aviso de confirmación.
    if (draft.objetivoVinculadoId) {
      const fondoExistente = todosFondos.find(
        (f) => f.activo && f.objetivoVinculadoId === draft.objetivoVinculadoId,
      );
      if (fondoExistente) {
        const objetivo = objetivos.find((o) => o.id === draft.objetivoVinculadoId);
        const nombreObj = objetivo?.nombre ?? 'el objetivo';
        const ok = window.confirm(
          `${nombreObj} ya estaba vinculado al fondo "${fondoExistente.nombre}". ` +
            `Si continúas · ese fondo perderá su vinculación. ¿Continuar?`,
        );
        if (!ok) return;
      }
    }

    setIsSubmitting(true);
    try {
      const meta =
        draft.categoria === 'colchon'
          ? calcularMetaColchon(draft)
          : parseImporte(draft.metaImporte);

      // Construir cuentasAsignadas en formato del shape (parcial fijo)
      const cuentasAsignadas: CuentaAsignada[] = draft.cuentasAsignadas.map((a) => ({
        cuentaId: a.cuentaId,
        modo: 'parcial',
        modoImporte: 'fijo',
        importeAsignado: a.importeAsignado,
      }));

      const fondo = await createFondo({
        tipo: draft.categoria,
        nombre: draft.nombre.trim(),
        cuentasAsignadas,
        metaImporte: meta,
        ...(draft.categoria === 'colchon'
          ? {
              metaMeses: parseImporte(draft.colchonMeses),
              colchonGastoMensual: parseImporte(draft.colchonGastoMensual),
            }
          : {}),
        prioridad: draft.prioridad,
        fechaObjetivo: buildFechaIso(draft.fechaObjetivoMes, draft.fechaObjetivoAnio),
        ...(draft.objetivoVinculadoId
          ? { objetivoVinculadoId: draft.objetivoVinculadoId }
          : {}),
      });

      const objetivo = objetivos.find((o) => o.id === draft.objetivoVinculadoId);
      const sufijo = objetivo ? ` · vinculado a ${objetivo.nombre}` : '';
      showToastV5(`Fondo creado · ${fondo.nombre}${sufijo}`);
      onCreated(fondo);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      showToastV5(`Error al crear fondo · ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, isSubmitting, objetivos, todosFondos, onCreated, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Crear nuevo fondo de ahorro"
    >
      <div className={styles.wiz}>
        <StepperHeader
          current={step}
          maxReached={maxReached}
          steps={STEPS_FONDO}
          title="Nuevo fondo de ahorro"
          sub="5 pasos · ~3 min"
          Icon={Icons.Fondos}
          styles={styles}
          onGoTo={goTo}
          onClose={onClose}
        />

        <div className={styles.body} ref={bodyRef}>
          <div className={styles.bodyInner}>
            {step === 1 && (
              <Step1Categoria selected={draft.categoria} onSelect={onSelectCategoria} />
            )}
            {step === 2 && <Step2MetaFondo draft={draft} onPatch={onPatch} />}
            {step === 3 && (
              <Step3Cuentas
                draft={draft}
                cuentas={cuentas}
                saldosCuentas={saldosCuentas}
                todosFondos={todosFondos}
                ritmo={ritmo}
                onPatch={onPatch}
              />
            )}
            {step === 4 && (
              <Step4VinculosFondo
                draft={draft}
                objetivos={objetivos}
                fondos={todosFondos}
                objetivoVinculadoIdInicial={objetivoVinculadoIdInicial}
                onPatch={onPatch}
              />
            )}
            {step === 5 && (
              <Step5ResumenFondo
                draft={draft}
                cuentas={cuentas}
                objetivos={objetivos}
                acumuladoEstimado={acumuladoEstimado}
                ritmo={ritmo}
              />
            )}
          </div>
        </div>

        <AsideResumenFondo
          draft={draft}
          objetivos={objetivos}
          asignadoTotal={asignadoTotal}
          acumuladoEstimado={acumuladoEstimado}
          ritmo={ritmo}
        />

        <WizardFooter
          current={step}
          totalSteps={TOTAL_STEPS}
          canAdvance={canAdvance}
          isSubmitting={isSubmitting}
          submitLabel="Crear fondo"
          styles={styles}
          onPrev={onPrev}
          onNext={onNext}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
};

const defaultNombre = (cat: CategoriaFondo): string => {
  if (cat === 'colchon') return 'Cubrir 24 meses de gastos';
  if (cat === 'compra') return 'Entrada próximo piso';
  if (cat === 'reforma') return 'Reforma ';
  return 'Impuestos pendientes';
};

export default WizardNuevoFondo;
export { WizardNuevoFondo };
