/**
 * S-WIZARD-CUENTA-V3 · pantalla única estilo ATLAS v8.
 *
 * Reemplaza completamente el modal antiguo `AccountFormModal` (513 líneas ·
 * max-w-md compacto · botón navy · IBAN siempre obligatorio · sin preview).
 *
 * - 1 sola pantalla · modal full-screen · 2 columnas (form + preview live)
 * - 3 tipos de cuenta (Corriente · Ahorro · Tarjeta crédito) en cards de oro
 * - Visibilidad condicional silenciosa de bloques 3, 4 y 5 según tipo
 * - Cálculo en tiempo real vía `calcularCuentaResumen()` (función pura)
 * - Badges roles especiales · "Cuenta principal" + "Recibe nómina X"
 * - Lógica esPrincipal · solo una cuenta principal en todo ATLAS
 * - DB sigue v70 · sólo añade campos opcionales al schema TS de Account
 *
 * Mockup canónico · docs/mockups/atlas-wizard-cuenta-v3.html.
 */

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CreditCard as IconCard,
  PiggyBank as IconPiggy,
  Landmark as IconBank,
  X as IconX,
  Check as IconCheck,
  AlertCircle as IconAlert,
  Star as IconStar,
  Briefcase as IconBriefcase,
  TrendingUp as IconTrending,
  List as IconList,
} from 'lucide-react';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Account, initDB } from '../../services/db';
import { cuentasService } from '../../services/cuentasService';
import { nominaService } from '../../services/nominaService';
import {
  validateIbanEs,
  formatIban,
  normalizeIban,
} from '../../utils/accountHelpers';
import {
  calcularCuentaResumen,
  type CuentaTipo,
  type FrecuenciaLiquidacion,
} from '../../services/cuentaCalculatorService';
import styles from './CuentaWizard.module.css';

// ============================================================================
// Tipos del form state
// ============================================================================

interface FormState {
  // B1
  tipo: CuentaTipo;
  // B2
  alias: string;
  banco: string;
  bancoOtro: string;
  esPrincipal: boolean;
  // B3 corriente / ahorro
  iban: string;
  bic: string;
  // B3 tarjeta crédito
  ultimosCuatro: string;
  bancoEmisor: string;
  cuentaCargoId: string;
  diaCierre: string;
  diaPago: string;
  // B4 corriente / ahorro
  saldoInicial: string;
  fechaSaldo: string;
  // B4 tarjeta crédito
  limiteCredito: string;
  deudaActual: string;
  // B5 remunerada (sólo corriente / ahorro)
  esRemunerada: boolean;
  taeAnual: string;
  frecuenciaLiquidacion: FrecuenciaLiquidacion;
  cuentaDestinoIntereses: string; // accountId | '' = esta misma cuenta
}

// ============================================================================
// Constantes
// ============================================================================

const BANCOS_CATALOGO = [
  'Santander',
  'BBVA',
  'Sabadell',
  'ING',
  'Unicaja',
  'Abanca',
  'Bankinter',
  'Revolut',
  'Carrefour Card',
  'CaixaBank',
  'Kutxabank',
  'Cajamar',
  'Ibercaja',
  'Otro · escribir',
] as const;

const FRECUENCIAS: Array<{ value: FrecuenciaLiquidacion; label: string }> = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const todayISO = (): string => new Date().toISOString().split('T')[0];

// ============================================================================
// Helpers
// ============================================================================

const fmtEur = (v: number, dec = 2): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(Number.isFinite(v) ? v : 0) + ' €';

const parseNum = (raw: string): number => {
  if (!raw || typeof raw !== 'string') return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const parseInt31 = (raw: string): number => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(31, n));
};

const fmtFechaCorta = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
};

const last4Iban = (iban: string): string => {
  const clean = (iban || '').replace(/\s/g, '');
  return clean.slice(-4) || '????';
};

const avatarLetters = (alias: string, banco: string): string => {
  const src = (alias || banco || 'CC').trim();
  if (!src) return 'CC';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

const inferBankFromAccount = (acc: Account): string => {
  const name = acc.banco?.name || acc.bank || '';
  const lower = name.toLowerCase();
  for (const b of BANCOS_CATALOGO) {
    if (b !== 'Otro · escribir' && lower.includes(b.toLowerCase())) return b;
  }
  return name || '';
};

const tipoFromAccount = (acc: Account): CuentaTipo => {
  // Mapeo tipos legacy ('OTRA' no se ofrece en v3 → defaulteamos a CORRIENTE).
  if (acc.tipo === 'AHORRO') return 'AHORRO';
  if (acc.tipo === 'TARJETA_CREDITO') return 'TARJETA_CREDITO';
  return 'CORRIENTE';
};

const accountLabel = (a: Account): string => {
  const last4 = last4Iban(a.iban);
  const banco = a.alias || a.banco?.name || a.bank || a.name || 'Cuenta';
  return `${banco} · ···· ${last4}`;
};

// ============================================================================
// Form factory
// ============================================================================

const buildInitialForm = (editing: Account | null | undefined): FormState => {
  if (editing) {
    const tipo = tipoFromAccount(editing);
    const bancoDetectado = inferBankFromAccount(editing);
    const isCatalogBank = (BANCOS_CATALOGO as readonly string[]).includes(bancoDetectado);
    const fechaSaldoIso = editing.openingBalanceDate
      ? editing.openingBalanceDate.split('T')[0]
      : todayISO();
    return {
      tipo,
      alias: editing.alias ?? '',
      banco: isCatalogBank ? bancoDetectado : (bancoDetectado ? 'Otro · escribir' : ''),
      bancoOtro: isCatalogBank ? '' : (bancoDetectado || ''),
      esPrincipal: !!editing.isDefault,
      iban: tipo === 'TARJETA_CREDITO' ? '' : formatIban(editing.iban || ''),
      bic: editing.bic ?? '',
      ultimosCuatro: editing.ultimosCuatro ?? '',
      bancoEmisor: editing.bancoEmisor ?? '',
      cuentaCargoId: editing.cardConfig?.chargeAccountId?.toString() ?? '',
      diaCierre: editing.diaCierre?.toString() ?? '',
      diaPago: (editing.diaPago ?? editing.cardConfig?.settlementDay)?.toString() ?? '',
      saldoInicial: tipo === 'TARJETA_CREDITO' ? '' : (editing.openingBalance?.toString() ?? ''),
      fechaSaldo: fechaSaldoIso,
      limiteCredito: editing.limiteCredito?.toString() ?? '',
      deudaActual: editing.deudaActual?.toString() ?? '',
      esRemunerada: !!editing.esRemunerada,
      taeAnual: editing.remuneracion?.tinAnual?.toString() ?? (editing.taeAnual?.toString() ?? ''),
      frecuenciaLiquidacion:
        (editing.remuneracion?.frecuenciaPagos as FrecuenciaLiquidacion) ??
        editing.frecuenciaLiquidacion ?? 'mensual',
      cuentaDestinoIntereses: editing.cuentaDestinoIntereses?.toString() ?? '',
    };
  }
  return {
    tipo: 'CORRIENTE',
    alias: '',
    banco: '',
    bancoOtro: '',
    esPrincipal: false,
    iban: '',
    bic: '',
    ultimosCuatro: '',
    bancoEmisor: '',
    cuentaCargoId: '',
    diaCierre: '',
    diaPago: '',
    saldoInicial: '',
    fechaSaldo: todayISO(),
    limiteCredito: '',
    deudaActual: '',
    esRemunerada: false,
    taeAnual: '',
    frecuenciaLiquidacion: 'mensual',
    cuentaDestinoIntereses: '',
  };
};

// ============================================================================
// Sub-componentes
// ============================================================================

const Block: React.FC<{
  title: string;
  toggle?: { on: boolean; onChange: (v: boolean) => void; label?: string };
  children?: React.ReactNode;
}> = ({ title, toggle, children }) => (
  <div className={styles.block}>
    <div className={styles.blockHd}>
      <div className={styles.blockHdTitle}>{title}</div>
      {toggle && (
        <button
          type="button"
          className={`${styles.toggle} ${toggle.on ? styles.toggleOn : ''}`}
          onClick={() => toggle.onChange(!toggle.on)}
          aria-pressed={toggle.on}
          aria-label={toggle.label ?? (toggle.on ? 'Desactivar' : 'Activar')}
          role="switch"
          aria-checked={toggle.on}
        />
      )}
    </div>
    {(toggle ? toggle.on : true) && children && (
      <div className={styles.blockBody}>{children}</div>
    )}
  </div>
);

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, htmlFor, children }) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel} htmlFor={htmlFor}>
      {label}
      {required && <span className={styles.req}>*</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
    {children}
    {error && <span className={styles.errorText}>{error}</span>}
  </div>
);

// ============================================================================
// Componente principal
// ============================================================================

export interface CuentaWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingAccount?: Account | null;
}

const CuentaWizard: React.FC<CuentaWizardProps> = ({
  open,
  onClose,
  onSuccess,
  editingAccount,
}) => {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(editingAccount));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nominaBadge, setNominaBadge] = useState<{ empresa: string; mensual: number } | null>(null);
  const [movimientosCount, setMovimientosCount] = useState<number | null>(null);
  const dialogRef = useFocusTrap(open);
  const isEditing = !!editingAccount;

  // Reset form al abrir / cambiar editingAccount
  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(editingAccount));
      setErrors({});
    }
  }, [open, editingAccount]);

  // Cargar lista de cuentas (para selectores cuenta de cargo / destino intereses)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void cuentasService.list().then((list) => {
      if (alive) setAccounts(list);
    });
    return () => { alive = false; };
  }, [open]);

  // Cargar nómina vinculada (badge "Recibe nómina X") y movimientos vinculados
  useEffect(() => {
    if (!open || !editingAccount?.id) {
      setNominaBadge(null);
      setMovimientosCount(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const nominas = await nominaService.getAllActiveNominas();
        const match = nominas.find((n) => n.cuentaAbono === editingAccount.id);
        if (alive && match) {
          const meses = match.distribucion?.meses ?? 12;
          const mensual = (match.salarioBrutoAnual ?? 0) / Math.max(1, meses);
          setNominaBadge({ empresa: match.nombre || 'nómina', mensual });
        } else if (alive) {
          setNominaBadge(null);
        }
      } catch (err) {
        console.warn('[CuentaWizard] no se pudo cargar nómina vinculada', err);
      }
      try {
        const db = await initDB();
        const movs = (await db.getAll('movements')) as Array<{ accountId?: number }>;
        const count = movs.filter((m) => m.accountId === editingAccount.id).length;
        if (alive) setMovimientosCount(count);
      } catch (err) {
        console.warn('[CuentaWizard] no se pudo contar movimientos', err);
      }
    })();
    return () => { alive = false; };
  }, [open, editingAccount?.id]);

  // Esc cierra
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  // ── Helpers de set
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const n = { ...prev };
      delete n[key as string];
      return n;
    });
  };

  const handleTipoChange = (tipo: CuentaTipo) => {
    setForm((prev) => ({
      ...prev,
      tipo,
      // Tarjeta nunca remunerada
      esRemunerada: tipo === 'TARJETA_CREDITO' ? false : prev.esRemunerada,
    }));
    setErrors({});
  };

  // ── Cálculo live
  const resumen = useMemo(() => {
    return calcularCuentaResumen({
      tipo: form.tipo,
      saldoInicial: parseNum(form.saldoInicial),
      limiteCredito: parseNum(form.limiteCredito),
      deudaActual: parseNum(form.deudaActual),
      esRemunerada: form.esRemunerada,
      taeAnual: parseNum(form.taeAnual),
      frecuenciaLiquidacion: form.frecuenciaLiquidacion,
    });
  }, [form]);

  // ── Banco final mostrado en preview
  const bancoFinal = form.banco === 'Otro · escribir'
    ? form.bancoOtro.trim()
    : form.banco;

  // ── Validación
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.alias.trim()) errs.alias = 'El alias es obligatorio';
    else if (form.alias.trim().length > 40) errs.alias = 'Máx. 40 caracteres';

    if (form.banco === 'Otro · escribir' && !form.bancoOtro.trim()) {
      errs.bancoOtro = 'Indica el nombre del banco';
    }

    if (form.tipo === 'CORRIENTE' || form.tipo === 'AHORRO') {
      // IBAN NO obligatorio (spec §4 regla 3) · sólo se valida si hay valor
      if (form.iban.trim()) {
        const v = validateIbanEs(form.iban);
        if (!v.ok) errs.iban = v.message || 'IBAN inválido';
      }
      if (!form.fechaSaldo) errs.fechaSaldo = 'Fecha obligatoria';
    }

    if (form.tipo === 'TARJETA_CREDITO') {
      if (!form.ultimosCuatro || !/^\d{4}$/.test(form.ultimosCuatro)) {
        errs.ultimosCuatro = '4 dígitos';
      }
      if (!form.bancoEmisor.trim()) errs.bancoEmisor = 'Selecciona banco emisor';
      if (!form.cuentaCargoId) errs.cuentaCargoId = 'Selecciona cuenta de cargo';
      const cierre = parseInt(form.diaCierre, 10);
      if (!Number.isFinite(cierre) || cierre < 1 || cierre > 31) {
        errs.diaCierre = 'Día entre 1 y 31';
      }
      const pago = parseInt(form.diaPago, 10);
      if (!Number.isFinite(pago) || pago < 1 || pago > 31) {
        errs.diaPago = 'Día entre 1 y 31';
      }
      if (!form.fechaSaldo) errs.fechaSaldo = 'Fecha obligatoria';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const isCard = form.tipo === 'TARJETA_CREDITO';
      const cuentaCargoIdNum = form.cuentaCargoId ? parseInt(form.cuentaCargoId, 10) : undefined;
      const cuentaDestinoNum = form.cuentaDestinoIntereses
        ? parseInt(form.cuentaDestinoIntereses, 10)
        : undefined;

      // openingBalance · para tarjeta crédito guardamos crédito disponible
      // (límite − deuda) en `openingBalance` para mantener compat con la
      // columna `balance` cacheada y el flujo de movimiento de apertura.
      const openingBalanceNum = isCard
        ? (parseNum(form.limiteCredito) - parseNum(form.deudaActual))
        : parseNum(form.saldoInicial);

      const tipoForBackend = form.tipo;

      // Construir banco{name} para que cuentasService lo persista (override
      // del autodetect cuando el usuario elige uno del catálogo).
      const bancoName = bancoFinal || undefined;
      const bancoNamePayload = bancoName ? { banco: { name: bancoName } } : {};

      const payload = {
        alias: form.alias.trim() || undefined,
        iban: isCard ? undefined : (form.iban || undefined),
        tipo: tipoForBackend,
        cardConfig: isCard
          ? {
              settlementDay: parseInt31(form.diaPago),
              chargeAccountId: cuentaCargoIdNum ?? 0,
            }
          : undefined,
        openingBalance: openingBalanceNum,
        openingBalanceDate: form.fechaSaldo
          ? new Date(form.fechaSaldo).toISOString()
          : undefined,
        esRemunerada: !isCard && form.esRemunerada,
        remuneracion: !isCard && form.esRemunerada
          ? {
              tinAnual: parseNum(form.taeAnual),
              frecuenciaPagos: form.frecuenciaLiquidacion,
              base: 'saldo' as const,
              retencionFiscal: 0,
              fechaInicio: form.fechaSaldo || todayISO(),
            }
          : undefined,
        // Campos extendidos opcionales (sub-tarea 4 los añade al tipo Account)
        bic: !isCard ? (form.bic || undefined) : undefined,
        ultimosCuatro: isCard ? form.ultimosCuatro : undefined,
        bancoEmisor: isCard ? form.bancoEmisor : undefined,
        diaCierre: isCard ? parseInt31(form.diaCierre) : undefined,
        diaPago: isCard ? parseInt31(form.diaPago) : undefined,
        limiteCredito: isCard ? parseNum(form.limiteCredito) : undefined,
        deudaActual: isCard ? parseNum(form.deudaActual) : undefined,
        cuentaDestinoIntereses: cuentaDestinoNum,
        ...bancoNamePayload,
      } as any;

      let savedAccountId: number | undefined;
      if (editingAccount?.id) {
        const updated = await cuentasService.update(editingAccount.id, payload);
        savedAccountId = updated.id;
      } else {
        const created = await cuentasService.create(payload);
        savedAccountId = created.id;
      }

      // Lógica esPrincipal · cuentasService.update ya gestiona la
      // exclusividad (líneas 403-410) cuando isDefault === true. Sólo lo
      // disparamos si el flag cambió.
      const wantsPrincipal = form.esPrincipal;
      const wasPrincipal = !!editingAccount?.isDefault;
      if (savedAccountId && wantsPrincipal !== wasPrincipal) {
        await cuentasService.update(savedAccountId, { isDefault: wantsPrincipal });
      }

      toast.success(editingAccount ? 'Cuenta actualizada' : 'Cuenta creada');
      onClose();
      onSuccess?.();
    } catch (err) {
      console.error('[CuentaWizard] guardar falló', err);
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // ── Header dinámico
  const headerTitle = isEditing && editingAccount?.alias
    ? `Editar cuenta · ${editingAccount.alias}`
    : (isEditing ? 'Editar cuenta' : 'Nueva cuenta');

  const headerSub = (() => {
    if (!isEditing || !editingAccount) {
      return form.tipo === 'TARJETA_CREDITO'
        ? 'Tarjeta crédito · sin movimientos · pendiente guardar'
        : 'Cuenta nueva · pendiente guardar';
    }
    const tipoTxt = editingAccount.tipo === 'AHORRO' ? 'Ahorro'
      : editingAccount.tipo === 'TARJETA_CREDITO' ? 'Tarjeta crédito'
      : 'Corriente';
    const ibanLast = last4Iban(editingAccount.iban);
    const tail = nominaBadge ? ` · vinculada a nómina ${nominaBadge.empresa}` : '';
    return `${tipoTxt} · IBAN ···· ${ibanLast}${tail}`;
  })();

  // ── Cuentas elegibles cuenta de cargo (no-tarjeta · activas · distintas
  //    de la cuenta que se está editando)
  const cuentasParaCargo = accounts.filter((a) =>
    a.tipo !== 'TARJETA_CREDITO' && a.id !== editingAccount?.id
  );
  // Cuentas elegibles destino intereses (todas las activas)
  const cuentasParaDestino = accounts.filter((a) => a.id !== editingAccount?.id);

  // ── Preview · KPI principal
  const previewKpi = (() => {
    if (form.tipo === 'TARJETA_CREDITO') {
      const limite = parseNum(form.limiteCredito);
      const deuda = parseNum(form.deudaActual);
      return {
        label: 'Crédito disponible',
        value: fmtEur(limite - deuda),
        sub: form.diaPago
          ? `Deuda actual ${fmtEur(deuda)} de ${fmtEur(limite)} · paga el ${parseInt31(form.diaPago)} de cada mes`
          : `Deuda actual ${fmtEur(deuda)} de ${fmtEur(limite)}`,
      };
    }
    return {
      label: 'Saldo inicial',
      value: fmtEur(parseNum(form.saldoInicial)),
      sub: `a fecha ${fmtFechaCorta(form.fechaSaldo)} · cuenta ${form.tipo === 'AHORRO' ? 'ahorro' : 'corriente'}`,
    };
  })();

  // ── Preview · listado
  const previewListado = (() => {
    const banco = bancoFinal || (editingAccount?.banco?.name ?? 'Banco');
    const aliasTxt = form.alias || '(sin alias)';
    const tipoTxt = form.tipo === 'AHORRO' ? 'Ahorro'
      : form.tipo === 'TARJETA_CREDITO' ? 'Tarjeta crédito'
      : 'Corriente';
    const last4 = form.tipo === 'TARJETA_CREDITO'
      ? (form.ultimosCuatro || '????')
      : last4Iban(form.iban);
    const saldo = form.tipo === 'TARJETA_CREDITO'
      ? (parseNum(form.limiteCredito) - parseNum(form.deudaActual))
      : parseNum(form.saldoInicial);
    return {
      avatar: avatarLetters(form.alias, banco),
      name: aliasTxt,
      meta: `${tipoTxt} · ···· ${last4}`,
      saldo: fmtEur(saldo),
    };
  })();

  // ── Preview · KPI mini movimientos
  const movimientosKpi = (() => {
    if (!isEditing) {
      return {
        value: '0',
        sub: 'Cuenta nueva · sin movimientos aún · al guardar quedará lista para conciliar extractos',
      };
    }
    if (movimientosCount === null) {
      return { value: '—', sub: 'Cargando…' };
    }
    return {
      value: movimientosCount.toLocaleString('es-ES'),
      sub: movimientosCount === 0
        ? 'Sin movimientos · pendiente importar extractos'
        : `Movimientos vinculados a esta cuenta`,
    };
  })();

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef as React.RefObject<HTMLDivElement>}
        className={styles.modal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ─── HEADER ─── */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerIcon}>
              <IconBank size={19} />
            </div>
            <div className={styles.headerText}>
              <div className={styles.headerTitle}>{headerTitle}</div>
              <div className={styles.headerSub}>{headerSub}</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.headerClose}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconX size={14} />
          </button>
        </div>

        {/* ─── BODY ─── */}
        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className={styles.body}>
            {/* ── COLUMNA FORM ── */}
            <div className={styles.colForm}>

              {/* B1 · TIPO */}
              <Block title="Tipo de cuenta">
                <div className={styles.typeSelector}>
                  <button
                    type="button"
                    className={`${styles.typeCard} ${form.tipo === 'CORRIENTE' ? styles.selected : ''}`}
                    onClick={() => handleTipoChange('CORRIENTE')}
                    aria-pressed={form.tipo === 'CORRIENTE'}
                  >
                    <IconBank size={22} />
                    <span className={styles.typeCardLabel}>Corriente</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeCard} ${form.tipo === 'AHORRO' ? styles.selected : ''}`}
                    onClick={() => handleTipoChange('AHORRO')}
                    aria-pressed={form.tipo === 'AHORRO'}
                  >
                    <IconPiggy size={22} />
                    <span className={styles.typeCardLabel}>Ahorro</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeCard} ${form.tipo === 'TARJETA_CREDITO' ? styles.selected : ''}`}
                    onClick={() => handleTipoChange('TARJETA_CREDITO')}
                    aria-pressed={form.tipo === 'TARJETA_CREDITO'}
                  >
                    <IconCard size={22} />
                    <span className={styles.typeCardLabel}>Tarjeta crédito</span>
                  </button>
                </div>
              </Block>

              {/* B2 · IDENTIFICACIÓN */}
              <Block title="Identificación">
                <div className={`${styles.fieldsRow} ${styles.rowIdentif}`}>
                  <Field label="Alias" required error={errors.alias}>
                    <input
                      className={`${styles.input} ${errors.alias ? styles.inputError : ''}`}
                      value={form.alias}
                      onChange={(e) => set('alias', e.target.value)}
                      placeholder={form.tipo === 'TARJETA_CREDITO' ? 'Tarjeta Visa Oro' : 'Cuenta principal'}
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Banco / proveedor">
                    <select
                      className={styles.select}
                      value={form.banco}
                      onChange={(e) => set('banco', e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {BANCOS_CATALOGO.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </Field>
                  <div className={`${styles.field} ${styles.principalToggle}`}>
                    <span className={styles.principalToggleLabel}>Cuenta principal</span>
                    <button
                      type="button"
                      className={`${styles.toggle} ${form.esPrincipal ? styles.toggleOn : ''}`}
                      onClick={() => set('esPrincipal', !form.esPrincipal)}
                      role="switch"
                      aria-checked={form.esPrincipal}
                      aria-label={form.esPrincipal ? 'Desactivar cuenta principal' : 'Activar cuenta principal'}
                    />
                  </div>
                </div>
                {form.banco === 'Otro · escribir' && (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Nombre del banco" required error={errors.bancoOtro}>
                      <input
                        className={`${styles.input} ${errors.bancoOtro ? styles.inputError : ''}`}
                        value={form.bancoOtro}
                        onChange={(e) => set('bancoOtro', e.target.value)}
                        placeholder="Escribe el nombre…"
                      />
                    </Field>
                  </div>
                )}
              </Block>

              {/* B3 · DATOS BANCARIOS · varía según tipo */}
              <Block title="Datos bancarios">
                {form.tipo !== 'TARJETA_CREDITO' ? (
                  <div className={`${styles.fieldsRow} ${styles.rowBancarios}`}>
                    <Field label="IBAN" hint="opcional" error={errors.iban}>
                      <input
                        className={`${styles.input} ${styles.inputMono} ${errors.iban ? styles.inputError : ''}`}
                        value={form.iban}
                        onChange={(e) => set('iban', e.target.value)}
                        placeholder="ES61 0049 0052 6322 1041 2715"
                      />
                    </Field>
                    <Field label="BIC / SWIFT" hint="opcional">
                      <input
                        className={`${styles.input} ${styles.inputMono}`}
                        value={form.bic}
                        onChange={(e) => set('bic', e.target.value.toUpperCase())}
                        placeholder="BSCHESMM"
                      />
                    </Field>
                  </div>
                ) : (
                  <>
                    <div className={`${styles.fieldsRow} ${styles.rowTarjetaA}`}>
                      <Field label="Últimos 4 dígitos" required error={errors.ultimosCuatro}>
                        <input
                          className={`${styles.input} ${styles.inputMono} ${errors.ultimosCuatro ? styles.inputError : ''}`}
                          value={form.ultimosCuatro}
                          onChange={(e) => set('ultimosCuatro', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="4321"
                        />
                      </Field>
                      <Field label="Banco emisor" required error={errors.bancoEmisor}>
                        <select
                          className={`${styles.select} ${errors.bancoEmisor ? styles.inputError : ''}`}
                          value={form.bancoEmisor}
                          onChange={(e) => set('bancoEmisor', e.target.value)}
                        >
                          <option value="">Selecciona…</option>
                          {BANCOS_CATALOGO.filter((b) => b !== 'Otro · escribir').map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className={`${styles.fieldsRow} ${styles.rowTarjetaB}`} style={{ marginTop: 10 }}>
                      <Field label="Cuenta de cargo" required error={errors.cuentaCargoId}>
                        <select
                          className={`${styles.select} ${errors.cuentaCargoId ? styles.inputError : ''}`}
                          value={form.cuentaCargoId}
                          onChange={(e) => set('cuentaCargoId', e.target.value)}
                        >
                          <option value="">Selecciona cuenta…</option>
                          {cuentasParaCargo.map((a) => (
                            <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Día cierre" required error={errors.diaCierre}>
                        <input
                          className={`${styles.input} ${styles.inputMono} ${errors.diaCierre ? styles.inputError : ''}`}
                          type="number"
                          min={1}
                          max={31}
                          value={form.diaCierre}
                          onChange={(e) => set('diaCierre', e.target.value)}
                          placeholder="25"
                        />
                      </Field>
                      <Field label="Día pago" required error={errors.diaPago}>
                        <input
                          className={`${styles.input} ${styles.inputMono} ${errors.diaPago ? styles.inputError : ''}`}
                          type="number"
                          min={1}
                          max={31}
                          value={form.diaPago}
                          onChange={(e) => set('diaPago', e.target.value)}
                          placeholder="5"
                        />
                      </Field>
                    </div>
                  </>
                )}
              </Block>

              {/* B4 · SALDO INICIAL · varía según tipo */}
              <Block title="Saldo inicial">
                {form.tipo !== 'TARJETA_CREDITO' ? (
                  <>
                    <div className={`${styles.fieldsRow} ${styles.rowSaldo}`}>
                      <Field label="Importe" required>
                        <div className={styles.inputSuffix}>
                          <input
                            className={`${styles.input} ${styles.inputMono}`}
                            type="number"
                            step="0.01"
                            value={form.saldoInicial}
                            onChange={(e) => set('saldoInicial', e.target.value)}
                            placeholder="30000,00"
                          />
                          <span className={styles.suffix}>€</span>
                        </div>
                      </Field>
                      <Field label="A fecha" required error={errors.fechaSaldo}>
                        <input
                          className={`${styles.input} ${errors.fechaSaldo ? styles.inputError : ''}`}
                          type="date"
                          value={form.fechaSaldo}
                          onChange={(e) => set('fechaSaldo', e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className={styles.hintNote}>
                      El saldo inicial es el punto de partida desde el que ATLAS calcula el cashflow.
                      Los movimientos posteriores se acumulan a este saldo.
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`${styles.fieldsRow} ${styles.rowSaldoTarjeta}`}>
                      <Field label="Límite crédito">
                        <div className={styles.inputSuffix}>
                          <input
                            className={`${styles.input} ${styles.inputMono}`}
                            type="number"
                            step="0.01"
                            value={form.limiteCredito}
                            onChange={(e) => set('limiteCredito', e.target.value)}
                            placeholder="3000,00"
                          />
                          <span className={styles.suffix}>€</span>
                        </div>
                      </Field>
                      <Field label="Deuda actual">
                        <div className={styles.inputSuffix}>
                          <input
                            className={`${styles.input} ${styles.inputMono}`}
                            type="number"
                            step="0.01"
                            value={form.deudaActual}
                            onChange={(e) => set('deudaActual', e.target.value)}
                            placeholder="0,00"
                          />
                          <span className={styles.suffix}>€</span>
                        </div>
                      </Field>
                      <Field label="A fecha" required error={errors.fechaSaldo}>
                        <input
                          className={`${styles.input} ${errors.fechaSaldo ? styles.inputError : ''}`}
                          type="date"
                          value={form.fechaSaldo}
                          onChange={(e) => set('fechaSaldo', e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className={styles.hintNote}>
                      La deuda actual es lo que debes ahora mismo · se descontará en la próxima fecha de pago de la cuenta de cargo.
                    </div>
                  </>
                )}
              </Block>

              {/* B5 · CUENTA REMUNERADA · oculto si tarjeta */}
              {form.tipo !== 'TARJETA_CREDITO' && (
                <Block
                  title="Cuenta remunerada"
                  toggle={{
                    on: form.esRemunerada,
                    onChange: (v) => set('esRemunerada', v),
                    label: form.esRemunerada ? 'Desactivar remuneración' : 'Activar remuneración',
                  }}
                >
                  <div className={`${styles.fieldsRow} ${styles.rowRemunerada}`}>
                    <Field label="TAE anual" required>
                      <div className={styles.inputSuffix}>
                        <input
                          className={`${styles.input} ${styles.inputMono}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="20"
                          value={form.taeAnual}
                          onChange={(e) => set('taeAnual', e.target.value)}
                          placeholder="2,5"
                        />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </Field>
                    <Field label="Liquidación" required>
                      <select
                        className={styles.select}
                        value={form.frecuenciaLiquidacion}
                        onChange={(e) => set('frecuenciaLiquidacion', e.target.value as FrecuenciaLiquidacion)}
                      >
                        {FRECUENCIAS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cuenta destino intereses">
                      <select
                        className={styles.select}
                        value={form.cuentaDestinoIntereses}
                        onChange={(e) => set('cuentaDestinoIntereses', e.target.value)}
                      >
                        <option value="">Esta misma cuenta</option>
                        {cuentasParaDestino.map((a) => (
                          <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className={styles.hintNote}>
                    Intereses año estimados · <b>{fmtEur(resumen.interesesAnualesEstimados)}</b> ·
                    liquidación {form.frecuenciaLiquidacion} · {fmtEur(resumen.interesesPorPeriodo)} por período.
                  </div>
                </Block>
              )}
            </div>

            {/* ── COLUMNA PREVIEW ── */}
            <div className={styles.colPreview}>
              <div className={styles.previewTitle}>
                <IconTrending size={12} />
                Vista previa · cómo aparece la cuenta
              </div>

              {/* KPI principal · saldo / crédito */}
              <div className={styles.previewKpiMain}>
                <div className={styles.previewKpiMainLabel}>{previewKpi.label}</div>
                <div className={styles.previewKpiMainValue}>{previewKpi.value}</div>
                <div className={styles.previewKpiMainSub}>{previewKpi.sub}</div>
              </div>

              {/* En el listado de Tesorería */}
              <div className={styles.previewTitle}>
                <IconList size={12} />
                En el listado de Tesorería
              </div>
              <div className={styles.previewAccountCard}>
                <div className={styles.paAvatar}>{previewListado.avatar}</div>
                <div className={styles.paInfo}>
                  <div className={styles.paName}>{previewListado.name}</div>
                  <div className={styles.paMeta}>{previewListado.meta}</div>
                </div>
                <div className={styles.paSaldo}>{previewListado.saldo}</div>
              </div>

              {/* Badges · roles especiales */}
              {(form.esPrincipal || nominaBadge) && (
                <div className={styles.previewBadges}>
                  {form.esPrincipal && (
                    <div className={styles.badgeRow}>
                      <IconStar />
                      <span>
                        <b>Cuenta principal</b> · domiciliaciones por defecto · destino selectores nuevos
                      </span>
                    </div>
                  )}
                  {nominaBadge && (
                    <div className={`${styles.badgeRow} ${styles.badgeRowTeal}`}>
                      <IconBriefcase />
                      <span>
                        Recibe la <b>nómina {nominaBadge.empresa}</b> · {fmtEur(nominaBadge.mensual)} / mes
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* KPI mini · movimientos vinculados */}
              <div className={styles.previewKpiMini}>
                <div className={styles.previewKpiMiniLabel}>Movimientos vinculados</div>
                <div className={styles.previewKpiMiniValue}>{movimientosKpi.value}</div>
                <div className={styles.previewKpiMiniSub}>{movimientosKpi.sub}</div>
              </div>
            </div>
          </div>

          {/* ─── FOOTER ─── */}
          <div className={styles.footer}>
            <div className={styles.footerMeta}>
              <IconAlert />
              {isEditing
                ? 'Cambios sin guardar · al guardar se actualizan Tesorería y selectores'
                : 'Cambios sin guardar · al guardar la cuenta aparece en Tesorería y selectores'}
            </div>
            <div className={styles.footerActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                <IconCheck size={14} />
                {saving ? 'Guardando…' : 'Guardar cuenta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Suprimir aviso linter sobre `normalizeIban` no-usado (lo importamos por si
// la futura integración con servicio quiere normalizar antes de mostrar).
void normalizeIban;

export default CuentaWizard;
