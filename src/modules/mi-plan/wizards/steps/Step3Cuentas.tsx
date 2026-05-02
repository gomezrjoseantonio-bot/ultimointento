import React, { useMemo } from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoFondo.module.css';
import type { FondoDraft, CuentaAsignacionDraft } from '../typesFondo';
import { calcularMetaColchon, parseImporte } from '../typesFondo';
import type { Account } from '../../../../services/db';
import type { FondoAhorro } from '../../../../types/miPlan';
import { computeDisponibleEnCuenta } from '../utils/computeDisponibleEnCuenta';
import type { RitmoResult } from '../utils/calcularRitmo';

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

// Iniciales banco · "Santander" → "SA" · fallback "??".
const inicialesBanco = (account: Account): string => {
  const name = account.banco?.name ?? account.bank ?? account.alias ?? '';
  const clean = name.trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// Color banco · si el Account expone banco.brand.color lo usamos · si no
// usamos los tokens canónicos del repo (`--atlas-v5-brand-{banco}`) ·
// fallback ink-3 (decisión Etapa A caso §10.7 documentada en PR).
//
// Los códigos IBAN ES (positions 5-8) mapean al token correspondiente:
//   0049 → Santander · 0081 → Sabadell · 2103 → Unicaja · 0182 → BBVA
//   1465 → ING · 2100 → CaixaBank
const BANK_TOKEN_BY_IBAN_CODE: Record<string, string> = {
  '0049': 'var(--atlas-v5-brand-santander)',
  '0081': 'var(--atlas-v5-brand-sabadell)',
  '2103': 'var(--atlas-v5-brand-unicaja)',
  '0182': 'var(--atlas-v5-brand-bbva)',
  '1465': 'var(--atlas-v5-brand-ing)',
  '2100': 'var(--atlas-v5-brand-caixabank)',
};
const colorBanco = (account: Account): string => {
  // Si el banco lleva color brand explícito (por la integración nueva del
  // repo · ver Account.banco.brand.color) lo respetamos · siempre que sea
  // una variable CSS · NO un hex literal (regla del repo · cero hex en UI).
  const c = account.banco?.brand?.color;
  if (c && c.startsWith('var(')) return c;
  // Fallback · resolver desde el código de entidad del IBAN.
  const code = account.banco?.code;
  if (code && BANK_TOKEN_BY_IBAN_CODE[code]) return BANK_TOKEN_BY_IBAN_CODE[code];
  return 'var(--atlas-v5-ink-3)';
};

const ibanMasked = (account: Account): string => {
  if (account.ibanMasked) return account.ibanMasked;
  const iban = account.iban ?? '';
  if (iban.length < 4) return iban;
  return `···· ${iban.slice(-4)}`;
};

interface Props {
  draft: FondoDraft;
  cuentas: Account[];
  saldosCuentas: Map<number, number>;
  todosFondos: FondoAhorro[];
  ritmo: RitmoResult;
  onPatch: (patch: Partial<FondoDraft>) => void;
}

const Step3Cuentas: React.FC<Props> = ({
  draft,
  cuentas,
  saldosCuentas,
  todosFondos,
  ritmo,
  onPatch,
}) => {
  // Mapa cuentaId → asignación draft (para rápido lookup)
  const asignMap = useMemo(() => {
    const m = new Map<number, CuentaAsignacionDraft>();
    for (const a of draft.cuentasAsignadas) m.set(a.cuentaId, a);
    return m;
  }, [draft.cuentasAsignadas]);

  // Lista de disponibles por cuenta (memoizada)
  const datosCuentas = useMemo(() => {
    return cuentas.map((c) => {
      const cuentaId = c.id as number;
      const saldoCuenta = saldosCuentas.get(cuentaId) ?? 0;
      const disp = computeDisponibleEnCuenta({
        cuentaId,
        saldoCuenta,
        fondos: todosFondos,
      });
      return { account: c, ...disp };
    });
  }, [cuentas, saldosCuentas, todosFondos]);

  // Resumen tesorería 4 columnas
  const resumen = useMemo(() => {
    let total = 0;
    let yaEnOtros = 0;
    for (const d of datosCuentas) {
      total += d.saldo;
      yaEnOtros += d.asignadoAOtros;
    }
    let estaAsignacion = 0;
    for (const a of draft.cuentasAsignadas) {
      estaAsignacion += a.importeAsignado;
    }
    const quedaraLibre = Math.max(0, total - yaEnOtros - estaAsignacion);
    const cuentasSelDetalle = draft.cuentasAsignadas
      .map((a) => cuentas.find((c) => c.id === a.cuentaId))
      .filter((c): c is Account => Boolean(c));
    const yaEnOtrosDetalle = new Set<string>();
    for (const d of datosCuentas) {
      for (const item of d.asignadoAOtrosDetalle) {
        yaEnOtrosDetalle.add(item.fondoNombre);
      }
    }
    return {
      total,
      yaEnOtros,
      estaAsignacion,
      quedaraLibre,
      cuentasSel: cuentasSelDetalle.length,
      cuentasSelNombres: cuentasSelDetalle
        .map((c) => c.banco?.name ?? c.alias ?? c.bank ?? 'Cuenta')
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3)
        .join(' · '),
      yaEnOtrosFondos: Array.from(yaEnOtrosDetalle).slice(0, 2).join(' · '),
    };
  }, [datosCuentas, draft.cuentasAsignadas, cuentas]);

  const setAsignacion = (cuentaId: number, importe: number) => {
    if (importe <= 0) {
      onPatch({
        cuentasAsignadas: draft.cuentasAsignadas.filter((a) => a.cuentaId !== cuentaId),
      });
      return;
    }
    const exists = asignMap.has(cuentaId);
    const next = exists
      ? draft.cuentasAsignadas.map((a) =>
          a.cuentaId === cuentaId ? { ...a, importeAsignado: importe } : a,
        )
      : [...draft.cuentasAsignadas, { cuentaId, importeAsignado: importe }];
    onPatch({ cuentasAsignadas: next });
  };

  const toggleCuenta = (cuentaId: number, disponible: number) => {
    if (asignMap.has(cuentaId)) {
      setAsignacion(cuentaId, 0);
    } else if (disponible > 0) {
      setAsignacion(cuentaId, Math.round(disponible));
    }
  };

  // Box ritmo
  let ritmoBoxClass = styles.ritmoBox;
  let ritmoTitText = 'En ruta · indica capacidad';
  if (ritmo.estado === 'ok') {
    ritmoBoxClass = `${styles.ritmoBox} ${styles.ritmoBoxOk}`;
    ritmoTitText = 'En ruta · sí';
  } else if (ritmo.estado === 'tight') {
    ritmoBoxClass = `${styles.ritmoBox} ${styles.ritmoBoxTight}`;
    ritmoTitText = 'En ruta · ajustado';
  } else if (ritmo.estado === 'no') {
    ritmoBoxClass = `${styles.ritmoBox} ${styles.ritmoBoxNo}`;
    ritmoTitText = 'En ruta · no';
  }

  const metaTotal = useMemo(() => {
    if (draft.categoria === 'colchon') return calcularMetaColchon(draft);
    return parseImporte(draft.metaImporte);
  }, [draft]);

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>03</span> Cuentas que alimentan el fondo
      </div>
      <div className={styles.stepSubText}>
        Asigna a este fondo el importe que ya tienes apartado en cada cuenta. ATLAS solo
        permite asignar lo que está realmente disponible · si la cuenta ya alimenta otros
        fondos · esa parte queda fuera.
      </div>

      <div className={styles.tipoNote}>
        <span className={styles.tipoNoteLab}>Cómo funciona</span>
        <strong>Acumulado real del fondo</strong> = la menor de · saldo actual de la cuenta ·
        o · importe asignado. Si gastas y el saldo cae · el acumulado baja de forma
        automática · primero comen los fondos más recientes · los de prioridad alta son los
        últimos en pagar.
      </div>

      <div className={styles.formSection} style={{ padding: '18px 20px' }}>
        <div className={styles.formSectionTit}>Tus cuentas en Tesorería</div>
        {cuentas.length === 0 ? (
          <div className={styles.emptyState}>
            No tienes cuentas activas. Da de alta una en <strong>Tesorería</strong> primero.
          </div>
        ) : (
          <div className={styles.cuentasList}>
            {datosCuentas.map((d) => (
              <CuentaItem
                key={d.account.id}
                data={d}
                asignacion={asignMap.get(d.account.id as number)}
                onToggle={() => toggleCuenta(d.account.id as number, d.disponible)}
                onSetImporte={(n) => setAsignacion(d.account.id as number, n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Capacidad de ahorro mensual · input manual */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Tu ritmo de ahorro</div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="cap-ahorro">
              Capacidad de ahorro mensual estimada
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="cap-ahorro"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.capacidadAhorroMensual}
                placeholder="0"
                onChange={(e) => onPatch({ capacidadAhorroMensual: e.target.value })}
              />
              <span className={styles.formInputSuf}>€/mes</span>
            </div>
            <div className={styles.formHelp}>
              ¿Cuánto puedes apartar al mes para alimentar este fondo? ATLAS calculará esto
              automáticamente cuando T8 cierre.
            </div>
          </div>
          <div className={styles.formField}>
            <span className={styles.formLab}>Meta del fondo</span>
            <div className={styles.formInputGroup}>
              <input
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                value={metaTotal > 0 ? metaTotal.toLocaleString('es-ES') : '—'}
                disabled
                readOnly
              />
              <span className={styles.formInputSuf}>€</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen tesorería 4 columnas */}
      <div className={styles.resumenTesoreria}>
        <div className={styles.resumenTesoreriaTit}>Tesorería al crear este fondo</div>
        <div className={styles.resumenTesoreriaGrid}>
          <div className={styles.resumenTesoreriaBlock}>
            <div className={styles.resumenTesoreriaLab}>Tesorería total</div>
            <div className={styles.resumenTesoreriaVal}>{fmtEur(resumen.total)}</div>
            <div className={styles.resumenTesoreriaSub}>
              {cuentas.length} cuenta{cuentas.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className={styles.resumenTesoreriaBlock}>
            <div className={styles.resumenTesoreriaLab}>Ya en otros fondos</div>
            <div className={styles.resumenTesoreriaVal}>{fmtEur(resumen.yaEnOtros)}</div>
            <div className={styles.resumenTesoreriaSub}>
              {resumen.yaEnOtrosFondos || 'sin asignaciones previas'}
            </div>
          </div>
          <div
            className={`${styles.resumenTesoreriaBlock} ${styles.resumenTesoreriaBlockEste}`}
          >
            <div className={styles.resumenTesoreriaLab}>Esta asignación</div>
            <div
              className={`${styles.resumenTesoreriaVal} ${styles.resumenTesoreriaValEste}`}
            >
              {fmtEur(resumen.estaAsignacion)}
            </div>
            <div className={styles.resumenTesoreriaSub}>
              {resumen.cuentasSel === 0 ? 'sin cuentas' : resumen.cuentasSelNombres}
            </div>
          </div>
          <div className={styles.resumenTesoreriaBlock}>
            <div className={styles.resumenTesoreriaLab}>Quedará libre</div>
            <div className={styles.resumenTesoreriaVal}>{fmtEur(resumen.quedaraLibre)}</div>
            <div className={styles.resumenTesoreriaSub}>sin propósito asignado</div>
          </div>
        </div>
      </div>

      {/* Caja ritmo */}
      {metaTotal > 0 && (
        <div className={ritmoBoxClass}>
          <div className={styles.ritmoTit}>{ritmoTitText}</div>
          <div className={styles.ritmoVal}>
            {ritmo.ritmoNecesarioMensual > 0
              ? `+${fmtEur(ritmo.ritmoNecesarioMensual)}/mes`
              : '— €/mes'}
          </div>
          <div className={styles.ritmoMsg}>{ritmo.mensaje}</div>
        </div>
      )}
    </div>
  );
};

interface CuentaItemProps {
  data: {
    account: Account;
    saldo: number;
    asignadoAOtros: number;
    asignadoAOtrosDetalle: Array<{ fondoId: string; fondoNombre: string; importe: number }>;
    disponible: number;
  };
  asignacion: CuentaAsignacionDraft | undefined;
  onToggle: () => void;
  onSetImporte: (n: number) => void;
}

const CuentaItem: React.FC<CuentaItemProps> = ({ data, asignacion, onToggle, onSetImporte }) => {
  const { account, saldo, asignadoAOtros, asignadoAOtrosDetalle, disponible } = data;
  const cuentaId = account.id as number;
  const isSelected = asignacion != null;
  const isDisabled = !isSelected && disponible <= 0;
  const importeStr = asignacion?.importeAsignado.toString() ?? '';
  const importeNum = asignacion?.importeAsignado ?? 0;
  const isError = importeNum > disponible + 0.01;

  const cls = [
    styles.cuentaItem,
    isSelected ? styles.selected : '',
    isDisabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  const fondoOtroNombre = asignadoAOtrosDetalle[0]?.fondoNombre ?? 'otros fondos';

  // El header es un `<button>` real · clic robusto · sin caer en problemas
  // de event delegation con divs anidados. El asignar-row y bloqueada-msg
  // van FUERA del button (HTML inválido tener buttons anidados) · así los
  // botones rápidos `todo`/`50%`/`0` y el input funcionan independientes.
  // El padding visible vive en el header / rows · NO en el wrapper · así
  // toda la card es área clicable (incluye el padding · los clicks de
  // borde funcionan).
  return (
    <div className={cls}>
      <button
        type="button"
        className={styles.cuentaItemHeader}
        onClick={onToggle}
        disabled={isDisabled}
        aria-pressed={isSelected}
      >
        <span className={styles.cuentaCheck} aria-hidden>
          {isSelected && <Icons.Check size={11} strokeWidth={3} />}
        </span>
        <span
          className={styles.cuentaLogo}
          style={{ background: colorBanco(account) }}
          aria-hidden
        >
          {inicialesBanco(account)}
        </span>
        <span className={styles.cuentaInfoBox}>
          <span className={styles.cuentaInfoTit}>
            {account.banco?.name ?? account.bank ?? 'Cuenta'} ·{' '}
            {account.alias ?? account.name ?? `cuenta ${cuentaId}`}
          </span>
          <span className={styles.cuentaInfoSub}>{ibanMasked(account)}</span>
        </span>
        <span className={styles.cuentaCifras}>
          <span className={styles.cuentaCifra}>
            <span className={styles.cuentaCifraLab}>Saldo</span>
            <span className={styles.cuentaCifraVal}>{fmtEur(saldo)}</span>
          </span>
          <span className={styles.cuentaCifra}>
            <span className={styles.cuentaCifraLab}>Asignado a otros</span>
            <span
              className={`${styles.cuentaCifraVal} ${asignadoAOtros > 0 ? styles.cuentaCifraValDim : styles.cuentaCifraValZero}`}
            >
              {fmtEur(asignadoAOtros)}
            </span>
            {asignadoAOtros > 0 && (
              <span className={styles.cuentaCifraSub}>{fondoOtroNombre}</span>
            )}
          </span>
          <span className={styles.cuentaCifra}>
            <span
              className={`${styles.cuentaCifraLab} ${disponible > 0 ? styles.cuentaCifraLabGold : ''}`}
            >
              Disponible
            </span>
            <span
              className={`${styles.cuentaCifraVal} ${disponible > 0 ? styles.cuentaCifraValGold : styles.cuentaCifraValZero}`}
            >
              {fmtEur(disponible)}
            </span>
          </span>
        </span>
      </button>

      {isSelected && (
        <div className={styles.cuentaAsignarRow}>
          <span className={styles.cuentaAsignarLab}>Asignar a este fondo</span>
          <div className={styles.cuentaAsignarInputWrap}>
            <input
              className={`${styles.cuentaAsignarInput} ${isError ? styles.error : ''}`}
              type="text"
              inputMode="decimal"
              value={importeStr}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
                onSetImporte(Number.isFinite(n) ? n : 0);
              }}
            />
            <span className={styles.cuentaAsignarSuf}>€</span>
          </div>
          <div className={styles.cuentaAsignarQuick}>
            <button
              type="button"
              className={styles.cuentaAsignarQuickBtn}
              onClick={() => onSetImporte(Math.round(disponible))}
            >
              todo
            </button>
            <button
              type="button"
              className={styles.cuentaAsignarQuickBtn}
              onClick={() => onSetImporte(Math.round(disponible * 0.5))}
            >
              50%
            </button>
            <button
              type="button"
              className={styles.cuentaAsignarQuickBtn}
              onClick={() => onSetImporte(0)}
            >
              0
            </button>
          </div>
          {isError && (
            <div className={styles.cuentaAsignarError}>
              Solo dispones de {fmtEur(disponible)} libres en esta cuenta.
            </div>
          )}
        </div>
      )}

      {isDisabled && (
        <div className={styles.cuentaBloqueadaMsg}>
          Esta cuenta no tiene saldo libre · ya está enteramente asignada a otro fondo ·
          libera importe en &quot;{fondoOtroNombre}&quot; si quieres usar esta cuenta aquí.
        </div>
      )}
    </div>
  );
};

export default Step3Cuentas;
