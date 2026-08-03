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
  X as IconX,
  Check as IconCheck,
  AlertCircle as IconAlert,
  ChevronDown as IconChevron,
} from 'lucide-react';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Account } from '../../services/db';
import {
  cuentasService,
  type CreateAccountData,
  type UpdateAccountData,
} from '../../services/cuentasService';
import { nominaService } from '../../services/nominaService';
import {
  validateIbanEs,
  formatIban,
} from '../../utils/accountHelpers';
import {
  calcularCuentaResumen,
  type CuentaTipo,
  type FrecuenciaLiquidacion,
} from '../../services/cuentaCalculatorService';
import {
  REJILLA_PUNTO,
  GRISES_PUNTO,
  CLAVE_SIN_COLOR,
  colorSugerido,
} from '../../modules/tesoreria/v6/bancoColores';
import {
  motivoParaNoDarDeBaja,
  darDeBajaCuenta,
  deshacerBajaCuenta,
  mensajeDeBloqueo,
  CuentaConPendientesError,
  type MotivoBloqueo,
} from '../../services/bajaCuentaService';
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
  /** '' = usar el del banco · token de la paleta · 'sin-color'. */
  colorPunto: string;
  bizum: boolean;
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
  const trimmed = raw.trim();
  // type="number" inputs siempre devuelven formato canónico "1938.92"
  // (punto decimal, sin comas). Sólo aplicamos la conversión es-ES
  // ("1.938,92" → "1938.92") cuando hay coma; si sólo hay punto · es
  // canónico y NO debemos quitarlo (eso multiplicaba por 100 — bug PR #1330).
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const parseInt31 = (raw: string): number => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(31, n));
};


const last4Iban = (iban: string): string => {
  const clean = (iban || '').replace(/\s/g, '');
  return clean.slice(-4) || '????';
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
  // `AHORRO` y `OTRA` se retiraron (VOCABULARIO §1) y la migración V86 los pasó
  // a CORRIENTE. Aquí caen los registros que aún no hayan pasado por ella —una
  // pestaña abierta desde antes—: se leen como corriente, que es lo que son.
  if (acc.tipo === 'TARJETA_CREDITO') return 'TARJETA_CREDITO';
  if (acc.tipo === 'EFECTIVO') return 'EFECTIVO';
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
      colorPunto: editing.colorPunto ?? '',
      bizum: Boolean(editing.bizum),
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
    colorPunto: '',
    bizum: false,
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
  /** §1 · ¿hay ya una cuenta de efectivo que NO sea la que se está editando? */
  const hayOtroEfectivo = accounts.some(
    (a) => a.tipo === 'EFECTIVO' && a.id !== editingAccount?.id && !a.deleted_at,
  );
  const [nominaBadge, setNominaBadge] = useState<{ empresa: string; mensual: number } | null>(null);
  /** `undefined` = aún comprobando · `null` = se puede dar de baja · objeto = bloqueada. */
  /** §10 · la rejilla de color vive plegada tras un desplegable. */
  const [paletaAbierta, setPaletaAbierta] = useState(false);

  const [bloqueoBaja, setBloqueoBaja] = useState<MotivoBloqueo | null | undefined>(undefined);
  const dialogRef = useFocusTrap(open);
  const isEditing = !!editingAccount;
  /**
   * El EFECTIVO no es una cuenta de banco · no tiene banco, ni IBAN, ni se
   * remunera. Se esconden esos bloques en vez de enseñarlos vacíos: un campo
   * que nunca se rellena es una pregunta sin respuesta posible.
   */
  const esEfectivo = form.tipo === 'EFECTIVO';

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

  // Cargar nómina vinculada · alimenta el subtítulo de la cabecera
  useEffect(() => {
    if (!open || !editingAccount?.id) {
      setNominaBadge(null);
      setBloqueoBaja(undefined);
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
      // §10 · ya no se cuentan los movimientos vinculados: el único sitio que
      // los enseñaba era la vista previa —y en un alta siempre decía 0, porque
      // la cuenta aún no existe—. El bloqueo de baja, que sí importa, se
      // resuelve más abajo por su cuenta.
      try {
        // `editingAccount.id` ya está comprobado arriba, pero el narrowing se
        // pierde dentro del async: se fija en una constante.
        const idCuenta = editingAccount.id as number;
        const motivo = await motivoParaNoDarDeBaja(idCuenta);
        if (alive) setBloqueoBaja(motivo);
      } catch (err) {
        // Si no se sabe, NO se ofrece la baja: el botón sigue deshabilitado.
        // Más vale no poder darla que darla con previsiones colgando.
        console.warn('[CuentaWizard] no se pudo comprobar si la cuenta admite baja', err);
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
      // Ni la tarjeta ni el efectivo se remuneran: una debe dinero y el otro
      // está en un bolsillo.
      esRemunerada: tipo === 'TARJETA_CREDITO' || tipo === 'EFECTIVO' ? false : prev.esRemunerada,
      // Pasar a EFECTIVO BORRA lo bancario que se hubiera tecleado antes.
      // Esconder los campos no basta: el valor seguía en el formulario, así que
      // se guardaba un banco y un IBAN en una cuenta que no tiene ninguno de
      // los dos, y si el banco era "Otro · escribir" el guardado se bloqueaba
      // pidiendo un campo que ya no está en pantalla.
      ...(tipo === 'EFECTIVO' ? { banco: '', bancoOtro: '', iban: '', bic: '' } : {}),
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

  /**
   * §4.8 · el emisor de una tarjeta se HEREDA de la cuenta donde se liquida.
   *
   * Preguntarlo aparte permitía guardar una tarjeta "Santander" que se carga en
   * una cuenta de BBVA, y entonces el punto de color y el emparejamiento de
   * extractos dicen cosas distintas sobre la misma tarjeta.
   */
  /**
   * El color que ATLAS propondría por sí solo · `null` si no reconoce el banco,
   * y entonces la rejilla no marca ningún "por defecto" que no existe.
   */
  const colorPorDefecto = useMemo(
    () => colorSugerido({ ...(editingAccount ?? ({} as Account)), banco: { name: bancoFinal } }),
    [editingAccount, bancoFinal]
  );

  /** Qué dice el desplegable cerrado · el color elegido, con su nombre. */
  const nombreColorElegido = useMemo(() => {
    if (form.colorPunto === CLAVE_SIN_COLOR) return 'Sin color';
    if (!form.colorPunto) return 'Del banco';
    const todas = [...REJILLA_PUNTO.flat(), ...GRISES_PUNTO];
    return todas.find((c) => c.token === form.colorPunto)?.nombre ?? 'Personalizado';
  }, [form.colorPunto]);

  /**
   * §4.8 · dar de baja, con Deshacer.
   *
   * La baja es SUAVE: `deactivate` deja la cuenta y su histórico en su sitio.
   * Por eso Deshacer puede ser inmediato y completo, sin resucitar nada.
   */
  const handleBaja = async () => {
    if (!editingAccount?.id || bloqueoBaja) return;
    setSaving(true);
    try {
      const id = editingAccount.id;
      await darDeBajaCuenta(id);
      toast.success(
        (t) => (
          <span>
            Cuenta dada de baja ·{' '}
            <button
              type="button"
              className={styles.deshacer}
              onClick={() => {
                toast.dismiss(t.id);
                void deshacerBajaCuenta(id).then(() => onSuccess?.());
              }}
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 }
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      // El servicio vuelve a comprobar los pendientes: entre abrir la ficha y
      // pulsar el botón puede haber cambiado, y el bloqueo tiene que ser real.
      toast.error(err instanceof Error ? err.message : 'No se pudo dar de baja la cuenta');
      if (err instanceof CuentaConPendientesError) setBloqueoBaja(err.motivo);
    } finally {
      setSaving(false);
    }
  };

  const bancoEmisorHeredado = useMemo(() => {
    const idCargo = parseInt(form.cuentaCargoId, 10);
    if (!Number.isFinite(idCargo)) return '';
    const cargo = accounts.find((a) => a.id === idCargo);
    return cargo?.banco?.name ?? cargo?.bank ?? '';
  }, [form.cuentaCargoId, accounts]);

  // ── Validación
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.alias.trim()) errs.alias = 'El alias es obligatorio';
    else if (form.alias.trim().length > 40) errs.alias = 'Máx. 40 caracteres';

    // `esEfectivo` de guarda: el cambio de tipo ya limpia estos campos, pero un
    // error sobre algo que no está en pantalla deja al usuario sin forma de
    // arreglarlo, y eso no puede depender de que la limpieza no falle nunca.
    if (!esEfectivo && form.banco === 'Otro · escribir' && !form.bancoOtro.trim()) {
      errs.bancoOtro = 'Indica el nombre del banco';
    }

    // El efectivo no tiene IBAN que validar · solo hay que saber cuánto hay y
    // desde cuándo, igual que en cualquier otra cuenta.
    if (form.tipo === 'EFECTIVO') {
      if (!form.fechaSaldo) errs.fechaSaldo = 'Fecha obligatoria';
    }

    if (form.tipo === 'CORRIENTE') {
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
      // El efectivo no tiene IBAN, igual que la tarjeta: no se inventa uno.
      const isEfectivo = form.tipo === 'EFECTIVO';

      // chargeAccountId puede provenir como '' (= NaN tras parseInt) si
      // alguien bypassea la validación · forzamos número finito o undefined.
      const cuentaCargoIdRaw = parseInt(form.cuentaCargoId, 10);
      const cuentaCargoIdNum = Number.isFinite(cuentaCargoIdRaw) ? cuentaCargoIdRaw : undefined;
      const cuentaDestinoRaw = parseInt(form.cuentaDestinoIntereses, 10);
      const cuentaDestinoNum = Number.isFinite(cuentaDestinoRaw) ? cuentaDestinoRaw : undefined;

      if (isCard && cuentaCargoIdNum === undefined) {
        // No debería llegar aquí · validate() ya bloquea · defensivo.
        toast.error('Cuenta de cargo inválida');
        setSaving(false);
        return;
      }

      // openingBalance · para tarjeta crédito guardamos crédito disponible
      // (límite − deuda) en `openingBalance` para mantener compat con la
      // columna `balance` cacheada y el flujo de movimiento de apertura.
      const openingBalanceNum = isCard
        ? (parseNum(form.limiteCredito) - parseNum(form.deudaActual))
        : parseNum(form.saldoInicial);

      // Banco · override del autodetect cuando el usuario elige catálogo o
      // escribe un nombre propio.
      const bancoOverride = bancoFinal ? { name: bancoFinal } : undefined;

      // Campos extendidos comunes a create/update (cuentasService los
      // persiste en localStorage + IndexedDB vía syncAccountToIndexedDB).
      const extendedFields = {
        ...(bancoOverride && { banco: bancoOverride }),
        bic: !isCard ? (form.bic || undefined) : undefined,
        ultimosCuatro: isCard ? form.ultimosCuatro : undefined,
        // Heredado, no tecleado (§4.8).
        bancoEmisor: isCard ? bancoEmisorHeredado || undefined : undefined,
        diaCierre: isCard ? parseInt31(form.diaCierre) : undefined,
        diaPago: isCard ? parseInt31(form.diaPago) : undefined,
        limiteCredito: isCard ? parseNum(form.limiteCredito) : undefined,
        deudaActual: isCard ? parseNum(form.deudaActual) : undefined,
        taeAnual: !isCard && form.esRemunerada ? parseNum(form.taeAnual) : undefined,
        frecuenciaLiquidacion: !isCard && form.esRemunerada ? form.frecuenciaLiquidacion : undefined,
        cuentaDestinoIntereses: cuentaDestinoNum,
        // '' = sin elección propia · el punto se deduce del banco (§4.8), y
        // viaja TAL CUAL. Con `|| undefined` la cadena vacía se convertía en
        // "no toques este campo", así que una vez elegido un color no había
        // manera de volver al del banco: el servicio ignoraba la vuelta atrás.
        colorPunto: form.colorPunto,
        // El Bizum vive en UNA cuenta · el servicio lo quita de las demás.
        // Una tarjeta o el efectivo no lo tienen: no son cuentas de banco.
        bizum: isCard || isEfectivo ? false : form.bizum,
      };

      const remuneracionPayload = !isCard && form.esRemunerada
        ? {
            tinAnual: parseNum(form.taeAnual),
            frecuenciaPagos: form.frecuenciaLiquidacion,
            base: 'saldo' as const,
            retencionFiscal: 0,
            fechaInicio: form.fechaSaldo || todayISO(),
          }
        : undefined;

      let savedAccountId: number | undefined;
      if (editingAccount?.id) {
        // IBAN no es editable en update (cuentasService.update no lo
        // soporta · ver review #1) · por eso no lo enviamos. El input
        // queda disabled en modo edit.
        const updateData: UpdateAccountData = {
          alias: form.alias.trim() || undefined,
          tipo: form.tipo,
          cardConfig: isCard
            ? { settlementDay: parseInt31(form.diaPago), chargeAccountId: cuentaCargoIdNum! }
            : undefined,
          openingBalance: openingBalanceNum,
          openingBalanceDate: form.fechaSaldo ? new Date(form.fechaSaldo).toISOString() : undefined,
          esRemunerada: !isCard && form.esRemunerada,
          remuneracion: remuneracionPayload,
          ...extendedFields,
        };
        const updated = await cuentasService.update(editingAccount.id, updateData);
        savedAccountId = updated.id;
      } else {
        const createData: CreateAccountData = {
          alias: form.alias.trim() || undefined,
          iban: isCard || isEfectivo ? undefined : (form.iban || undefined),
          tipo: form.tipo,
          cardConfig: isCard
            ? { settlementDay: parseInt31(form.diaPago), chargeAccountId: cuentaCargoIdNum! }
            : undefined,
          openingBalance: openingBalanceNum,
          openingBalanceDate: form.fechaSaldo ? new Date(form.fechaSaldo).toISOString() : undefined,
          esRemunerada: !isCard && form.esRemunerada,
          remuneracion: remuneracionPayload,
          ...extendedFields,
        };
        const created = await cuentasService.create(createData);
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
      // §10 · el subtítulo repetía el título ("Nueva cuenta" arriba, "Cuenta
      // nueva · pendiente guardar" debajo) y avisaba de algo evidente: nada
      // está guardado hasta que se pulsa Guardar. Solo se dice el tipo.
      return form.tipo === 'TARJETA_CREDITO'
        ? 'Tarjeta de crédito'
        : form.tipo === 'EFECTIVO'
          ? 'Efectivo'
          : 'Cuenta bancaria';
    }
    const tipoTxt = editingAccount.tipo === 'TARJETA_CREDITO' ? 'Tarjeta crédito'
      : editingAccount.tipo === 'EFECTIVO' ? 'Efectivo'
      : 'Corriente';
    const tail = nominaBadge ? ` · vinculada a nómina ${nominaBadge.empresa}` : '';
    // Sin IBAN no se escribe "IBAN ···· " con el hueco vacío detrás: se calla.
    if (editingAccount.tipo === 'EFECTIVO') return `${tipoTxt}${tail}`;
    const ibanLast = last4Iban(editingAccount.iban);
    return `${tipoTxt} · IBAN ···· ${ibanLast}${tail}`;
  })();

  // ── Cuentas elegibles cuenta de cargo (no-tarjeta · activas · distintas
  //    de la cuenta que se está editando)
  // El recibo de una tarjeta se domicilia en una cuenta BANCARIA: ni en otra
  // tarjeta ni en el bolsillo. `chargeAccountId` está documentado como cuenta
  // bancaria, y el efectivo explícitamente no lo es.
  const cuentasParaCargo = accounts.filter((a) =>
    a.tipo !== 'TARJETA_CREDITO' && a.tipo !== 'EFECTIVO' && a.id !== editingAccount?.id
  );
  // Cuentas elegibles destino intereses (todas las activas)
  const cuentasParaDestino = accounts.filter((a) => a.id !== editingAccount?.id);




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
          {/* §10 · sin icono: un banco dibujado no dice nada que no diga
              "Cuenta bancaria" justo debajo, y ocupaba el sitio de honor. */}
          <div className={styles.headerInfo}>
            <div className={styles.headerText}>
              <div className={styles.headerKicker}>{headerTitle}</div>
              <div className={styles.headerTitle}>{headerSub}</div>
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

              {/* §10 · el tipo, como BOTONES DE TEXTO.
                  Eran tres tarjetas grandes con icono —una hucha, un banco, una
                  tarjeta— ocupando el ancho entero para una elección de tres
                  opciones que se leen en una palabra. El icono no añade nada
                  que el texto no diga, y hacía que lo primero de la ficha
                  pesara más que el nombre de la cuenta. */}
              <Block title="Tipo de cuenta">
                <div className={styles.typeSelector}>
                  <button
                    type="button"
                    className={`${styles.typeCard} ${form.tipo === 'CORRIENTE' ? styles.selected : ''}`}
                    onClick={() => handleTipoChange('CORRIENTE')}
                    aria-pressed={form.tipo === 'CORRIENTE'}
                  >
                    <span className={styles.typeCardLabel}>Corriente</span>
                  </button>
                  {/* VOCABULARIO §3 · una tarjeta NO es una cuenta, así que ya
                      no se da de alta aquí: tiene su propia ficha, con su
                      modalidad y su ciclo. Darla de alta como cuenta era lo que
                      impedía tener DOS en el mismo banco —lo normal, débito y
                      crédito— y lo que dejaba una de fuera anclada a un banco
                      del que en realidad puede mudarse.

                      La opción sigue apareciendo al EDITAR una cuenta que ya
                      nació así: sus movimientos son compras de verdad y
                      esconderle el tipo la dejaría sin ficha que abrir. */}
                  {editingAccount?.tipo === 'TARJETA_CREDITO' && (
                    <button
                      type="button"
                      className={`${styles.typeCard} ${form.tipo === 'TARJETA_CREDITO' ? styles.selected : ''}`}
                      onClick={() => handleTipoChange('TARJETA_CREDITO')}
                      aria-pressed={form.tipo === 'TARJETA_CREDITO'}
                    >
                      <span className={styles.typeCardLabel}>Tarjeta crédito</span>
                    </button>
                  )}
                  {/* El dinero del bolsillo es una cuenta más · sin ella, sacar
                      200 € del cajero se apunta como un gasto y el patrimonio
                      baja 200 € el día que el dinero solo ha cambiado de sitio.

                      VOCABULARIO §1 · pero SOLO UNA: el dinero físico es uno y
                      dos colchones no se distinguen. Se oculta cuando ya hay
                      una —salvo que sea justo la que se está editando—, porque
                      ofrecerlo aquí solo llevaría al error que lanza el
                      servicio al guardar. */}
                  {(!hayOtroEfectivo || editingAccount?.tipo === 'EFECTIVO') && (
                  <button
                    type="button"
                    className={`${styles.typeCard} ${form.tipo === 'EFECTIVO' ? styles.selected : ''}`}
                    onClick={() => handleTipoChange('EFECTIVO')}
                    aria-pressed={form.tipo === 'EFECTIVO'}
                  >
                    <span className={styles.typeCardLabel}>Efectivo</span>
                  </button>
                  )}
                </div>
              </Block>

              {/* B2 · IDENTIFICACIÓN */}
              <Block title="Identificación">
                <div className={`${styles.fieldsRow} ${styles.rowIdentif}`}>
                  {/* §10 · "Nombre", no "Alias": es como se va a llamar la
                      cuenta en toda la app, no un apodo secundario. */}
                  <Field label="Nombre" required error={errors.alias}>
                    <input
                      className={`${styles.input} ${errors.alias ? styles.inputError : ''}`}
                      value={form.alias}
                      onChange={(e) => set('alias', e.target.value)}
                      /* §10 · el marcador decía "Cuenta principal" justo al
                         lado de un interruptor llamado "Cuenta principal": se
                         leía como si el campo sirviera para eso. Un ejemplo
                         real enseña qué se espera sin competir con nada. */
                      placeholder={
                        form.tipo === 'TARJETA_CREDITO' ? 'Ej. Visa Oro' : 'Ej. Santander Alquileres'
                      }
                      maxLength={40}
                    />
                  </Field>
                  {!esEfectivo && (
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
                  )}
                  {!esEfectivo && form.tipo !== 'TARJETA_CREDITO' && (
                    <div className={`${styles.field} ${styles.principalToggle}`}>
                      {/* Un rol de la cuenta, como ser la principal · el Bizum
                          va atado a un teléfono y un teléfono a una cuenta, así
                          que activarlo aquí lo quita de la que lo tuviera. */}
                      <span className={styles.principalToggleLabel}>Bizum</span>
                      <button
                        type="button"
                        className={`${styles.toggle} ${form.bizum ? styles.toggleOn : ''}`}
                        onClick={() => set('bizum', !form.bizum)}
                        role="switch"
                        aria-checked={form.bizum}
                        aria-label={form.bizum ? 'Desactivar Bizum' : 'Activar Bizum'}
                      />
                    </div>
                  )}
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
                {!esEfectivo && form.banco === 'Otro · escribir' && (
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

                {/* §4.8 · color del punto · rejilla + Sin color, con el del
                    banco como opción por defecto. Es la única identidad
                    cromática de la tarjeta de cuenta, y sirve sobre todo para
                    distinguir a ojo dos cuentas del mismo banco. */}
                {/* §10 · un DESPLEGABLE que abre la rejilla.
                    La rejilla entera siempre desplegada ocupaba más que el
                    resto del bloque junto, para una decisión que casi siempre
                    se resuelve con "la del banco". Cerrado enseña el color
                    elegido y su nombre; abierto, la rejilla completa. */}
                <div style={{ marginTop: 12 }}>
                  <Field label="Color del punto">
                    <button
                      type="button"
                      className={styles.colorTrigger}
                      aria-expanded={paletaAbierta}
                      onClick={() => setPaletaAbierta((v) => !v)}
                    >
                      <span
                        className={`${styles.muestra} ${styles.muestraTrigger} ${
                          form.colorPunto === CLAVE_SIN_COLOR ? styles.muestraSin : ''
                        }`}
                        style={
                          form.colorPunto === CLAVE_SIN_COLOR
                            ? undefined
                            : { background: form.colorPunto || colorPorDefecto || undefined }
                        }
                        aria-hidden="true"
                      />
                      <span className={styles.colorTriggerTxt}>{nombreColorElegido}</span>
                      <IconChevron size={14} className={paletaAbierta ? styles.chevOn : ''} />
                    </button>

                    {paletaAbierta && (
                      <div className={styles.paleta} role="radiogroup" aria-label="Color del punto">
                        <div className={styles.paletaFila}>
                          {colorPorDefecto && (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={form.colorPunto === ''}
                              aria-label="Color del banco"
                              title="Color del banco"
                              className={`${styles.muestra} ${styles.muestraAncha} ${form.colorPunto === '' ? styles.muestraOn : ''}`}
                              style={{ background: colorPorDefecto }}
                              onClick={() => set('colorPunto', '')}
                            />
                          )}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.colorPunto === CLAVE_SIN_COLOR}
                            aria-label="Sin color"
                            title="Sin color"
                            className={`${styles.muestra} ${styles.muestraSin} ${form.colorPunto === CLAVE_SIN_COLOR ? styles.muestraOn : ''}`}
                            onClick={() => set('colorPunto', CLAVE_SIN_COLOR)}
                          />
                          <span className={styles.paletaSep} aria-hidden="true" />
                          {GRISES_PUNTO.map((c) => (
                            <button
                              key={c.token}
                              type="button"
                              role="radio"
                              aria-checked={form.colorPunto === c.token}
                              aria-label={c.nombre}
                              title={c.nombre}
                              className={`${styles.muestra} ${form.colorPunto === c.token ? styles.muestraOn : ''}`}
                              style={{ background: c.token }}
                              onClick={() => set('colorPunto', c.token)}
                            />
                          ))}
                        </div>
                        {REJILLA_PUNTO.map((fila, i) => (
                          <div className={styles.paletaFila} key={i}>
                            {fila.map((c) => (
                              <button
                                key={c.token}
                                type="button"
                                role="radio"
                                aria-checked={form.colorPunto === c.token}
                                aria-label={c.nombre}
                                title={c.nombre}
                                className={`${styles.muestra} ${form.colorPunto === c.token ? styles.muestraOn : ''}`}
                                style={{ background: c.token }}
                                onClick={() => set('colorPunto', c.token)}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>
              </Block>

              {/* B3 · DATOS BANCARIOS · varía según tipo · el efectivo no tiene */}
              {!esEfectivo && (
              <Block title="Datos bancarios">
                {form.tipo !== 'TARJETA_CREDITO' ? (
                  <div className={`${styles.fieldsRow} ${styles.rowBancarios}`}>
                    <Field
                      label="IBAN"
                      hint={isEditing ? 'no editable' : 'opcional'}
                      error={errors.iban}
                    >
                      <input
                        className={`${styles.input} ${styles.inputMono} ${errors.iban ? styles.inputError : ''}`}
                        value={form.iban}
                        onChange={(e) => set('iban', e.target.value)}
                        placeholder="ES61 0049 0052 6322 1041 2715"
                        disabled={isEditing}
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
                      {/* §4.8 · la tarjeta NO tiene selector de banco: lo hereda
                          de la cuenta donde se liquida. Preguntarlo aparte deja
                          elegir un emisor que contradice la cuenta de cargo. */}
                      <Field label="Banco emisor">
                        <div className={styles.heredado} aria-live="polite">
                          {bancoEmisorHeredado || 'Se toma de la cuenta de cargo'}
                        </div>
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
              )}

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

              {/* B5 · CUENTA REMUNERADA · ni la tarjeta ni el efectivo */}
              {form.tipo !== 'TARJETA_CREDITO' && !esEfectivo && (
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

            {/* §10 · la columna de vista previa se ELIMINA.
                Ocupaba media pantalla para enseñar una cuenta que no era la
                que luego aparece en Tesorería: pintaba un cuadrado con las
                iniciales del banco ("BA") en vez del punto de color, y no
                reaccionaba —con 30.000 € escritos en el campo seguía diciendo
                0,00 €—. Una vista previa que miente es peor que ninguna: hace
                dudar de lo que sí está bien.

                El formulario se queda con el ancho entero, que es lo que pedía
                §10 ("formulario plano"). */}
          </div>

          {/* ─── FOOTER ─── */}
          <div className={styles.footer}>
            <div className={styles.footerMeta} id={bloqueoBaja ? 'baja-bloqueada' : undefined}>
              <IconAlert />
              {bloqueoBaja
                ? mensajeDeBloqueo(bloqueoBaja)
                : isEditing
                  ? 'Cambios sin guardar · al guardar se actualizan Tesorería y selectores'
                  : 'Cambios sin guardar · al guardar la cuenta aparece en Tesorería y selectores'}
            </div>
            <div className={styles.footerActions}>
              {/* §4.8 · baja · a la izquierda, separada de las acciones
                  normales. Bloqueada si quedan pendientes, y lo dice. */}
              {isEditing && (
                <button
                  type="button"
                  className={styles.btnBaja}
                  onClick={handleBaja}
                  disabled={saving || bloqueoBaja === undefined}
                  aria-describedby={bloqueoBaja ? 'baja-bloqueada' : undefined}
                >
                  Dar de baja
                </button>
              )}
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

export default CuentaWizard;
