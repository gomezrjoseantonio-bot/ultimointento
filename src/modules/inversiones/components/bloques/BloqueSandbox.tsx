// BloqueSandbox · P5 ficha plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.6).
// PR 4 · cableado · 3 sliders con topes por tipo (§5.6.1) · recálculo dinámico
// vía fórmula VF anual idéntica a `proyeccionActivoService` (un escenario).

import { useEffect, useMemo, useState } from 'react';
import { getCopyPorTipo } from './tipoPlanCopy';
import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import type { TipoPlanCoste } from './BloqueCostes';
import styles from './bloques.module.css';

export interface BloqueSandboxProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Tipo administrativo · gobierna tope de aportación. */
  tipoPlan: TipoPlanCoste;
  /** Sólo PPES · si es autónomo el tope sube a 5.750 €. */
  esAutonomo?: boolean;
  /** Usuario con discapacidad · tope sube a 24.250 € (§5.6.1). */
  discapacidad?: boolean;
  /** Saldo actual de la posición · partida de la simulación. */
  saldoActual: number;
  /** Aportación anual estimada actual · default del slider. */
  aportacionAnualDefault: number;
  /** Años hasta rescate por defecto. */
  anosDefault: number;
  /** TWR esperado por defecto (decimal). */
  twrDefault: number;
  /**
   * Valor final del escenario actual · para mostrar diferencia. Si null,
   * la card de diferencia no se muestra.
   */
  valorFinalActual: number | null;
}

function fmtEur(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

/**
 * Fórmula VF anual · aporte al inicio · misma que `proyeccionActivoService`.
 */
function calcularVF(
  saldoInicial: number,
  aporteAnual: number,
  twr: number,
  anos: number,
): number {
  let valor = saldoInicial;
  for (let i = 0; i < anos; i++) {
    valor = (valor + aporteAnual) * (1 + twr);
  }
  return valor;
}

const BloqueSandbox = ({
  posicionId,
  tipoActivo,
  tipoPlan,
  esAutonomo,
  discapacidad,
  saldoActual,
  aportacionAnualDefault,
  anosDefault,
  twrDefault,
  valorFinalActual,
}: BloqueSandboxProps) => {
  const copy = useMemo(
    () =>
      getCopyPorTipo({
        tipoAdministrativo: tipoPlan,
        esAutonomo,
        discapacidad,
      }),
    [tipoPlan, esAutonomo, discapacidad],
  );

  const topeAportacion = copy.topeAportacionAnualBase;

  // Step que divide todos los topes legales (1.500 · 5.750 · 10.000 · 24.250).
  // 50 € es múltiplo común · garantiza que el slider llega al cap exacto.
  const stepAporte = 50;

  const [touched, setTouched] = useState<{ aporte: boolean; anos: boolean; twr: boolean }>({
    aporte: false,
    anos: false,
    twr: false,
  });
  const [aporteAnual, setAporteAnual] = useState<number>(
    Math.min(Math.max(0, aportacionAnualDefault), topeAportacion),
  );
  const [anos, setAnos] = useState<number>(Math.max(5, Math.min(40, anosDefault)));
  const [twrPct, setTwrPct] = useState<number>(Math.max(0, Math.min(10, twrDefault * 100)));

  // Sincroniza los sliders cuando llegan los datos reales del plan
  // (FichaPlanPensiones monta este bloque antes de que `aportaciones` y
  // `rentabilidadTotal` se carguen, así que los defaults iniciales son 0).
  // Solo aplica si el usuario NO ha movido aún ese slider.
  useEffect(() => {
    if (touched.aporte) return;
    setAporteAnual(Math.min(Math.max(0, aportacionAnualDefault), topeAportacion));
  }, [aportacionAnualDefault, topeAportacion, touched.aporte]);

  useEffect(() => {
    if (touched.anos) return;
    setAnos(Math.max(5, Math.min(40, anosDefault)));
  }, [anosDefault, touched.anos]);

  useEffect(() => {
    if (touched.twr) return;
    setTwrPct(Math.max(0, Math.min(10, twrDefault * 100)));
  }, [twrDefault, touched.twr]);

  const valorFinal = useMemo(
    () => calcularVF(saldoActual, aporteAnual, twrPct / 100, anos),
    [saldoActual, aporteAnual, twrPct, anos],
  );

  const diferencia =
    valorFinalActual != null ? valorFinal - valorFinalActual : null;

  return (
    <section
      className={styles.bloque}
      data-bloque="P5"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-tipo-plan={tipoPlan}
      aria-label="Sandbox · y si..."
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Sandbox · y si...</div>
          <div className={styles.bloqueMensaje}>Simula aportación, años y rentabilidad</div>
          <div className={styles.bloqueSub}>
            tope aportación anual · {fmtEur(topeAportacion)}{' '}
            <span className={styles.bloqueSubMono}>
              ({tipoPlan}
              {discapacidad ? ' · discapacidad' : esAutonomo ? ' · autónomo' : ''})
            </span>
          </div>
        </div>
        <div className={styles.cardValorFinal}>
          <div className={styles.miniLab}>Valor final simulado</div>
          <div className={`${styles.cardValorFinalVal} mono`}>{fmtEur(valorFinal)}</div>
          {diferencia != null && (
            <div
              className={styles.cardValorFinalDelta}
              style={{
                color:
                  diferencia >= 0
                    ? 'var(--atlas-v5-pos)'
                    : 'var(--atlas-v5-neg)',
              }}
            >
              {diferencia >= 0 ? '+' : ''}
              {fmtEur(diferencia)} vs actual
            </div>
          )}
        </div>
      </div>
      <div className={styles.bloqueBody}>
        <div className={styles.sandboxGrid}>
          <SliderRow
            id={`sandbox-aporte-${posicionId}`}
            label="Aportación anual"
            min={0}
            max={topeAportacion}
            step={stepAporte}
            value={aporteAnual}
            onChange={(v) => {
              setAporteAnual(v);
              setTouched((t) => ({ ...t, aporte: true }));
            }}
            display={fmtEur(aporteAnual)}
          />
          <SliderRow
            id={`sandbox-anos-${posicionId}`}
            label="Años hasta rescate"
            min={5}
            max={40}
            step={1}
            value={anos}
            onChange={(v) => {
              setAnos(v);
              setTouched((t) => ({ ...t, anos: true }));
            }}
            display={`${anos} años`}
          />
          <SliderRow
            id={`sandbox-twr-${posicionId}`}
            label="TWR esperado"
            min={0}
            max={10}
            step={0.1}
            value={twrPct}
            onChange={(v) => {
              setTwrPct(v);
              setTouched((t) => ({ ...t, twr: true }));
            }}
            display={`${twrPct.toFixed(1)} %`}
          />
        </div>
      </div>
    </section>
  );
};

function SliderRow({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div className={styles.sandboxRow}>
      <label className={styles.sandboxLab} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.sandboxSlider}
      />
      <span className={`${styles.sandboxValor} mono`}>{display}</span>
    </div>
  );
}

export default BloqueSandbox;
// Re-export para tests · valida la fórmula determinista usada por la UI.
export const __test__ = { calcularVF };
