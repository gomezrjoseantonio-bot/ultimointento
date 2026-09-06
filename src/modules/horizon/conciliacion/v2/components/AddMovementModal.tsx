import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  Landmark,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
// PR-C1 hotfix · el modal depende de las clases `cv2-*` definidas en
// conciliacion-v2.css. Importar aquí garantiza que el modal funcione
// también cuando se invoca desde /tesoreria/movimientos (donde el
// stylesheet no se cargaría de otro modo).
import '../conciliacion-v2.css';
import { initDB } from '../../../../../services/db';
import type { Account, Property, TreasuryEvent } from '../../../../../services/db';
import {
  familiasSugeridas,
  labelFamilia,
  subtiposDe,
  type Ambito,
  type FamiliaId,
} from '../../../../../services/catalogo/catalogoUnico';
import { computeDocFlags } from '../../../../../services/documentRequirementsService';
import { confirmTreasuryEvent } from '../../../../../services/treasuryConfirmationService';
import { createTransfer } from '../../../../../services/treasuryTransferService';
import type { Prestamo } from '../../../../../types/prestamos';

// PR5-HOTFIX v3 · validador suave de NIF español. No bloquea submit: solo
// muestra un warning inline cuando el formato no cuadra. El OCR podría
// corregirlo o puede tratarse de un proveedor extranjero.
// Acepta: DNI (8 dígitos + letra), NIE (X/Y/Z + 7 dígitos + letra), CIF
// (letra + 8 dígitos | letra + 7 dígitos + letra|dígito).
const NIF_REGEX =
  /^([A-HJ-NP-SUVW]\d{7}[0-9A-J]|[0-9]{8}[A-Z]|[XYZ]\d{7}[A-Z])$/i;

function looksLikeSpanishNif(value: string): boolean {
  if (!value) return true; // vacío: no molestamos al usuario.
  return NIF_REGEX.test(value.replace(/[-\s.]/g, ''));
}

export interface AddMovementModalPrefill {
  tipo?: TipoAlta;
  ambito?: Ambito;
  inmuebleId?: number;
  familia?: FamiliaId;
  subtipo?: string;
  fecha?: string;
}

export interface AddMovementModalLocked {
  tipo?: boolean;
  ambito?: boolean;
  inmueble?: boolean;
  categoria?: boolean;
}

interface AddMovementModalProps {
  accounts: Account[];
  properties: Property[];
  defaultYear: number;
  defaultMonth0: number;
  onClose: () => void;
  onCreated: () => Promise<void>;
  // PR5-HOTFIX v3 · pre-fill + locked + filtrado de categorías al invocar
  // desde tab Gastos recurrentes del inmueble (modal unificado).
  prefill?: AddMovementModalPrefill;
  locked?: AddMovementModalLocked;
  restrictCategoriesTo?: 'opex' | 'all';
  // S-TESORERIA-FASE-B-VISTA-CUENTA · sub-tarea 2 · cuando se invoca desde
  // la página de cuenta, el accountId ya se conoce por contexto. El modal
  // pre-rellena el selector de cuenta y el usuario no tiene que elegir.
  defaultAccountId?: number;
}

/**
 * Las pestañas del modal · un flujo de alta, no un vocabulario de dominio: la
 * naturaleza que se guarda es la del catálogo único (financiación = gasto ·
 * prestamo_hipoteca · traspaso = movimiento_interno).
 */
export type TipoAlta = 'ingreso' | 'gasto' | 'financiacion' | 'traspaso';

const TIPO_PILLS: { value: TipoAlta; label: string; Icon: React.ElementType }[] = [
  { value: 'ingreso', label: 'Ingreso', Icon: ArrowUp },
  { value: 'gasto', label: 'Gasto', Icon: ArrowDown },
  { value: 'financiacion', label: 'Financiación', Icon: Landmark },
  { value: 'traspaso', label: 'Traspaso', Icon: RefreshCw },
];

function accountLabel(a: Account): string {
  const name = a.alias ?? a.banco?.name ?? a.bank ?? `Cuenta ${a.id}`;
  const tail = a.iban ? a.iban.slice(-4) : '';
  return tail ? `${name} ·${tail}` : name;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function prestamoInmuebleId(p: Prestamo): string | undefined {
  return p.destinos?.find((d) => d.inmuebleId)?.inmuebleId ?? p.inmuebleId;
}

const AddMovementModal: React.FC<AddMovementModalProps> = ({
  accounts,
  properties,
  onClose,
  onCreated,
  prefill,
  locked,
  restrictCategoriesTo = 'all',
  defaultAccountId,
}) => {
  // PR5-HOTFIX v2 · fecha default = hoy (no el primer día del mes navegado).
  const today = new Date().toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<TipoAlta>(prefill?.tipo ?? 'gasto');
  const [fecha, setFecha] = useState(prefill?.fecha ?? today);
  const [importeStr, setImporteStr] = useState('');
  const [cuentaId, setCuentaId] = useState<number | undefined>(() => {
    // S-TESORERIA-FASE-B-VISTA-CUENTA · si se ha indicado defaultAccountId
    // y existe en el listado, lo usamos; si no, primer cuenta como fallback.
    if (defaultAccountId != null && accounts.some((a) => a.id === defaultAccountId)) {
      return defaultAccountId;
    }
    return accounts.length > 0 ? accounts[0].id : undefined;
  });
  const [ambito, setAmbito] = useState<Ambito | undefined>(prefill?.ambito ?? 'inmueble');
  const [inmuebleId, setInmuebleId] = useState<number | undefined>(prefill?.inmuebleId);
  // Familia de INGRESO · tarjetas del catálogo único.
  const [categoriaKey, setCategoriaKey] = useState<string | undefined>(
    prefill?.familia && familiasSugeridas('ingreso', 'inmueble').concat(familiasSugeridas('ingreso', 'personal')).some((f) => f.id === prefill.familia)
      ? prefill.familia
      : undefined,
  );
  // Gasto · familia + subtipo del catálogo único (mismo que la ficha V6).
  // El ámbito lo dan las pills personal/inmueble.
  const [familiaSel, setFamiliaSel] = useState<string>('');
  const [conceptoSel, setConceptoSel] = useState<string>('');
  const [prestamoId, setPrestamoId] = useState<string | undefined>(undefined);
  const [esAmortizacionParcial, setEsAmortizacionParcial] = useState(false);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | undefined>(undefined);
  const [concept, setConcept] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerNif, setProviderNif] = useState('');
  const [busy, setBusy] = useState(false);

  // Carga perezosa de préstamos activos (solo si el tipo es financiación).
  const [prestamos, setPrestamos] = useState<Prestamo[] | null>(null);
  useEffect(() => {
    if (tipo !== 'financiacion') return;
    if (prestamos !== null) return;
    (async () => {
      try {
        const db = await initDB();
        const all = (await (db as any).getAll('prestamos').catch(() => [])) as Prestamo[];
        setPrestamos(all.filter((p) => p.activo && p.estado !== 'cancelado'));
      } catch (err) {
        console.warn('[AddMovementModal] no se pudo cargar préstamos', err);
        setPrestamos([]);
      }
    })();
  }, [tipo, prestamos]);

  // Flags derivados de locked. Si el prop no trae valor, trato como "no locked".
  const tipoLocked = !!locked?.tipo;
  const ambitoLocked = !!locked?.ambito;
  const inmuebleLocked = !!locked?.inmueble;
  const categoriaLocked = !!locked?.categoria;

  // ── visibility FSM ────────────────────────────────────────────────────
  const showAmbito = tipo === 'ingreso' || tipo === 'gasto';
  const showInmueble = (showAmbito && ambito === 'inmueble');
  // El ingreso sigue eligiendo su categoría en tarjetas; el gasto usa el
  // catálogo unificado Familia → Concepto (mismo que la ficha de Tesorería V6).
  const showCategoriaIngreso = tipo === 'ingreso';
  const showClasifGasto = tipo === 'gasto';
  const showPrestamo = tipo === 'financiacion';
  const showCuentaDestino = tipo === 'traspaso';
  // PR5-HOTFIX v3 · nº factura sólo para gastos + financiación.
  const showInvoiceNumber = tipo === 'gasto' || tipo === 'financiacion';
  const showDescripcion = tipo !== 'financiacion' || !!prestamoId;
  const showProveedor = tipo !== 'traspaso';

  // Ámbito unificado (personal|inmueble) para el catálogo de gasto.
  const ambitoGasto = ambito === 'inmueble' ? 'inmueble' : 'personal';

  // Familias de gasto que son OPEX de un inmueble (gasto recurrente deducible) ·
  // para filtrar el catálogo cuando el modal se abre desde recurrentes de
  // inmueble (`restrictCategoriesTo="opex"`). Una reforma o el mobiliario se
  // amortizan, no son OPEX.
  const esFamiliaOpex = (familia: string) =>
    restrictCategoriesTo !== 'opex' || !['reforma_mejora', 'mobiliario_enseres', 'prestamo_hipoteca'].includes(familia);

  // Familias de INGRESO (tarjetas) · el gasto no las usa.
  const categoriesToShow = useMemo(() => {
    if (!showCategoriaIngreso) return [];
    return ambito ? familiasSugeridas('ingreso', ambito) : familiasSugeridas('ingreso', 'personal').concat(familiasSugeridas('ingreso', 'inmueble')).filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
  }, [showCategoriaIngreso, ambito]);

  // Familias de GASTO sugeridas para el ámbito · filtradas a OPEX cuando el
  // modal está restringido.
  const familiasGasto = useMemo(() => {
    if (!showClasifGasto) return [];
    return familiasSugeridas('gasto', ambitoGasto).filter((f) => esFamiliaOpex(f.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showClasifGasto, ambitoGasto, restrictCategoriesTo]);

  // Subtipos de la familia elegida · opcionales.
  const conceptosGasto = useMemo(() => {
    if (!showClasifGasto || !familiaSel) return [];
    return subtiposDe(familiaSel as FamiliaId);
  }, [showClasifGasto, familiaSel]);

  // La clasificación efectiva que se persiste · ingreso la elige en tarjeta,
  // gasto en familia + subtipo.
  const familiaEfectiva: FamiliaId | undefined =
    tipo === 'ingreso' ? (categoriaKey as FamiliaId | undefined) : (familiaSel as FamiliaId) || undefined;
  const subtipoEfectivo = tipo === 'ingreso' ? undefined : conceptoSel || undefined;
  const requiereInmuebleIngreso = tipo === 'ingreso' && categoriaKey === 'alquiler';

  // Mantiene familia/concepto de gasto válidos para el ámbito actual · en el
  // primer render coloca la clasificación del prefill (si llega) o la primera
  // opción, y al cambiar de ámbito reajusta lo que dejó de existir. Solo escribe
  // cuando el valor cambia de verdad, para no entrar en bucle.
  useEffect(() => {
    if (tipo !== 'gasto') return;
    if (!familiaSel && prefill?.familia && familiasGasto.some((f) => f.id === prefill.familia)) {
      setFamiliaSel(prefill.familia);
      setConceptoSel(prefill.subtipo ?? '');
      return;
    }
    if (!familiasGasto.length) return;
    const fam = familiasGasto.some((f) => f.id === familiaSel) ? familiaSel : familiasGasto[0].id;
    const cs = subtiposDe(fam as FamiliaId);
    const sub = cs.some((c) => c.id === conceptoSel) ? conceptoSel : '';
    if (fam !== familiaSel) setFamiliaSel(fam);
    if (sub !== conceptoSel) setConceptoSel(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ambitoGasto, familiasGasto]);

  const prestamoSel = useMemo(
    () => (prestamoId != null ? prestamos?.find((p) => p.id === prestamoId) ?? null : null),
    [prestamoId, prestamos],
  );

  // Inmueble del préstamo (para resolver ambito/inmueble cuando tipo=financiacion).
  const prestamoInmueble = useMemo(() => {
    if (!prestamoSel) return null;
    const inmId = prestamoInmuebleId(prestamoSel);
    if (!inmId) return null;
    return properties.find((p) => String(p.id) === String(inmId)) ?? null;
  }, [prestamoSel, properties]);

  // ── handlers de cambio de sección (reset campos dependientes) ─────────
  const handleTipoChange = (next: TipoAlta) => {
    if (tipoLocked) return;
    setTipo(next);
    if (!categoriaLocked) {
      setCategoriaKey(undefined);
      // El gasto reconstruye familia/concepto en su efecto; vaciarlos fuerza
      // que arranque de la primera opción del nuevo tipo/ámbito.
      setFamiliaSel('');
      setConceptoSel('');
    }
    setPrestamoId(undefined);
    setCuentaDestinoId(undefined);
    setEsAmortizacionParcial(false);
    if (next === 'financiacion') {
      setAmbito('inmueble');
    } else if (next === 'traspaso') {
      setAmbito(undefined);
    } else {
      setAmbito((prev) => prev ?? 'inmueble');
    }
  };

  const handleAmbitoChange = (next: Ambito) => {
    if (ambitoLocked) return;
    setAmbito(next);
    if (!categoriaLocked) {
      setCategoriaKey(undefined);
      // El gasto reajusta familia/concepto al nuevo ámbito en su efecto.
      setFamiliaSel('');
      setConceptoSel('');
    }
    if (next === 'personal') setInmuebleId(undefined);
  };

  // Solo el ingreso elige categoría en tarjeta; el gasto usa Familia → Concepto.
  const handleCategoriaChange = (key: string) => {
    if (categoriaLocked) return;
    setCategoriaKey(key);
  };

  const handlePrestamoChange = (id: string | undefined) => {
    setPrestamoId(id);
    if (!id) return;
    const p = prestamos?.find((pp) => pp.id === id);
    if (p) {
      // Pre-rellenar proveedor con el banco del préstamo (solo si el
      // usuario no ha escrito nada aún).
      if (!providerName.trim()) setProviderName(p.nombre ?? '');
    }
  };

  // ── validación de submit ───────────────────────────────────────────────
  const parsedImporte = parseFloat(importeStr.replace(',', '.'));
  const importeOk = Number.isFinite(parsedImporte) && parsedImporte > 0;

  const nifLooksOk = looksLikeSpanishNif(providerNif.trim());

  const submitDisabled = (() => {
    if (busy) return true;
    if (!fecha) return true;
    if (!importeOk) return true;
    if (cuentaId == null) return true;

    if (tipo === 'ingreso') {
      if (!categoriaKey) return true;
      if (requiereInmuebleIngreso && !inmuebleId) return true;
    }
    if (tipo === 'gasto') {
      // Familia elegida (el subtipo es opcional), y el inmueble si el ámbito lo pide.
      if (!familiaSel) return true;
      if (ambito === 'inmueble' && !inmuebleId) return true;
    }
    if (tipo === 'financiacion') {
      if (!prestamoId) return true;
    }
    if (tipo === 'traspaso') {
      if (cuentaDestinoId == null) return true;
      if (cuentaDestinoId === cuentaId) return true;
    }
    return false;
  })();

  // ── submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (mode: 'predicted' | 'confirmed') => {
    if (submitDisabled) return;
    setBusy(true);
    try {
      // Rama especial: traspaso
      if (tipo === 'traspaso') {
        await createTransfer({
          date: fecha,
          amount: Math.abs(parsedImporte),
          originAccountId: cuentaId!,
          targetAccountId: cuentaDestinoId!,
          concept: concept.trim(),
          confirm: mode === 'confirmed',
        });
        toast.success(mode === 'confirmed' ? 'Traspaso creado y confirmado' : 'Traspaso creado');
        await onCreated();
        onClose();
        return;
      }

      // Rama general: ingreso / gasto / financiación
      const now = new Date().toISOString();
      const db = await initDB();

      // Resolver ámbito + inmueble efectivos.
      let effectiveAmbito: 'personal' | 'inmueble' = 'personal';
      let effectiveInmuebleId: number | undefined;
      if (tipo === 'financiacion') {
        if (prestamoInmueble) {
          effectiveAmbito = 'inmueble';
          effectiveInmuebleId = prestamoInmueble.id;
        }
      } else if (ambito === 'inmueble') {
        effectiveAmbito = 'inmueble';
        effectiveInmuebleId = inmuebleId;
      }

      // Resolver descripción (si no hay concepto, generar uno razonable).
      const description =
        concept.trim() ||
        (tipo === 'financiacion'
          ? esAmortizacionParcial
            ? `Amortización parcial · ${prestamoSel?.nombre ?? ''}`.trim()
            : `Cargo financiación · ${prestamoSel?.nombre ?? ''}`.trim()
          : familiaEfectiva ? labelFamilia(familiaEfectiva) : 'Movimiento');

      // Calcular flags documentales por categoría canónica.
      const flags = computeDocFlags({
        familia: tipo === 'financiacion' ? 'prestamo_hipoteca' : familiaEfectiva,
        naturaleza: tipo === 'ingreso' ? 'ingreso' : 'gasto',
        ambito: effectiveAmbito,
      });

      const providerNameTrimmed = providerName.trim();
      const providerNifTrimmed = providerNif.trim();
      const invoiceNumberTrimmed = invoiceNumber.trim();

      const eventPayload: Omit<TreasuryEvent, 'id'> = {
        naturaleza: tipo === 'ingreso' ? 'ingreso' : 'gasto',
        ...(tipo === 'financiacion'
          ? { familia: 'prestamo_hipoteca' as const }
          : familiaEfectiva
            ? { familia: familiaEfectiva, ...(subtipoEfectivo ? { subtipo: subtipoEfectivo } : {}) }
            : {}),
        amount: Math.abs(parsedImporte),
        predictedDate: fecha,
        description,
        sourceType: tipo === 'financiacion' ? 'prestamo' : 'manual',
        // sourceId: sólo para legacy — en financiación usamos prestamoId (string).
        accountId: cuentaId,
        status: 'predicted',
        ambito: effectiveAmbito,
        inmuebleId: effectiveInmuebleId,
        // PR-C1 · marca de esporádico: alta manual desde modal sin vínculo
        // explícito a un compromiso recurrente. Default true para ingresos
        // y gastos; en financiación es siempre `false` (cuota de préstamo
        // no es esporádica). El traspaso retorna antes (no llega aquí).
        isEsporadico: tipo === 'financiacion' ? false : true,
        // PR5-HOTFIX v3 · proveedor estructurado en 3 campos. `counterparty`
        // se mantiene como copia del nombre por retrocompatibilidad (lectores
        // legacy + learning rules).
        providerName: providerNameTrimmed || undefined,
        providerNif: providerNifTrimmed || undefined,
        invoiceNumber: invoiceNumberTrimmed || undefined,
        // Si el usuario rellena NIF sin nombre, el NIF es la mejor referencia
        // visible para los lectores legacy que siguen usando counterparty.
        counterparty: providerNameTrimmed || providerNifTrimmed || undefined,
        prestamoId: tipo === 'financiacion' ? prestamoId : undefined,
        transferMetadata:
          tipo === 'financiacion' && esAmortizacionParcial
            ? { targetAccountId: 0, esAmortizacionParcial: true }
            : undefined,
        facturaNoAplica: flags.facturaNoAplica,
        justificanteNoAplica: flags.justificanteNoAplica,
        createdAt: now,
        updatedAt: now,
      };

      const eventId = Number(await (db as any).add('treasuryEvents', eventPayload));

      if (mode === 'confirmed') {
        await confirmTreasuryEvent(eventId);
      }

      toast.success(mode === 'confirmed' ? 'Movimiento creado y confirmado' : 'Previsión creada');
      await onCreated();
      onClose();
    } catch (err) {
      console.error('[AddMovementModal] create failed', err);
      const msg = err instanceof Error ? err.message : 'No se pudo crear el movimiento';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const inmueblesList = properties.filter((p) => p.state !== 'baja');
  const accountsOtherThanOrigin = accounts.filter((a) => a.id !== cuentaId);
  const lockedInmuebleAlias =
    inmuebleLocked && inmuebleId != null
      ? properties.find((p) => p.id === inmuebleId)?.alias ?? '—'
      : null;

  const subtitleByTipo: Record<TipoAlta, string> = {
    ingreso: 'Alquiler u otros ingresos',
    gasto: 'Gasto de inmueble o personal',
    financiacion: 'Cargo asociado a un préstamo',
    traspaso: 'Transferencia entre cuentas propias',
  };

  return (
    <div className="cv2-modal-backdrop cv2-scope" onClick={onClose}>
      <div className="cv2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cv2-modal-header">
          <div>
            <h2>
              <Plus size={15} style={{ marginRight: 6, color: 'var(--atlas-v5-ink-3)' }} />
              Añadir movimiento
            </h2>
            <div className="cv2-modal-subtitle">{subtitleByTipo[tipo]}</div>
          </div>
          <button
            type="button"
            className="cv2-btn-icon"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={busy}
          >
            <X size={16} />
          </button>
        </div>

        <div className="cv2-modal-body">
          {/* ───── TIPO ───── */}
          <div className="cv2-form-section">
            <h3>Tipo</h3>
            <div className="cv2-tipo-pills">
              {TIPO_PILLS.map(({ value, label, Icon }) => {
                const active = tipo === value;
                const disabled = busy || (tipoLocked && !active);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`cv2-tipo-pill ${active ? 'active' : ''}`}
                    onClick={() => handleTipoChange(value)}
                    disabled={disabled}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ───── BÁSICOS ───── */}
          <div className="cv2-form-section">
            <h3>Básicos</h3>
            <div className={tipo === 'traspaso' ? 'cv2-grid-3' : 'cv2-grid-4'}>
              <div className="cv2-field">
                <label>Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="cv2-field">
                <label>Importe</label>
                <input
                  type="text"
                  className="cv2-mono"
                  value={importeStr}
                  onChange={(e) => setImporteStr(e.target.value)}
                  placeholder="0,00"
                  disabled={busy}
                />
              </div>
              <div className={`cv2-field ${tipo === 'traspaso' ? '' : 'cv2-field--col-2'}`}>
                <label>{tipo === 'traspaso' ? 'Cuenta origen' : 'Cuenta'}</label>
                <select
                  value={cuentaId ?? ''}
                  onChange={(e) => setCuentaId(e.target.value ? Number(e.target.value) : undefined)}
                  disabled={busy}
                >
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ───── ÁMBITO (solo ingreso/gasto) ───── */}
          {showAmbito && (
            <div className="cv2-form-section">
              <h3>Ámbito</h3>
              <div className="cv2-ambito-pills">
                <button
                  type="button"
                  className={`cv2-ambito-pill ${ambito === 'personal' ? 'active' : ''}`}
                  onClick={() => handleAmbitoChange('personal')}
                  disabled={busy || (ambitoLocked && ambito !== 'personal')}
                >
                  Personal
                </button>
                <button
                  type="button"
                  className={`cv2-ambito-pill ${ambito === 'inmueble' ? 'active' : ''}`}
                  onClick={() => handleAmbitoChange('inmueble')}
                  disabled={busy || (ambitoLocked && ambito !== 'inmueble')}
                >
                  Inmueble
                </button>
              </div>
            </div>
          )}

          {/* ───── INMUEBLE (ámbito=inmueble) ───── */}
          {showInmueble && (
            <div className="cv2-form-section cv2-field-full">
              <h3>
                Inmueble <span className="cv2-required-mark">· requerido</span>
              </h3>
              {inmuebleLocked ? (
                <input
                  type="text"
                  value={lockedInmuebleAlias ?? '—'}
                  readOnly
                  style={{
                    background: 'var(--atlas-v5-line-2)',
                    color: 'var(--atlas-v5-ink-2)',
                    cursor: 'not-allowed',
                  }}
                />
              ) : (
                <select
                  value={inmuebleId ?? ''}
                  onChange={(e) =>
                    setInmuebleId(e.target.value ? Number(e.target.value) : undefined)
                  }
                  disabled={busy}
                >
                  <option value="">Seleccionar inmueble…</option>
                  {inmueblesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.alias}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ───── CATEGORÍA DE INGRESO · grid de cards ───── */}
          {showCategoriaIngreso && (
            <div className="cv2-form-section">
              <h3>Categoría</h3>
              <div
                className={`cv2-cat-grid ${categoriesToShow.length >= 10 ? 'cv2-cat-grid--cols-5' : ''}`}
              >
                {categoriesToShow.map((cat) => {
                  const active = categoriaKey === cat.id;
                  const disabled = busy || (categoriaLocked && !active);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`cv2-cat-card ${active ? 'active' : ''}`}
                      onClick={() => handleCategoriaChange(cat.id)}
                      disabled={disabled}
                    >
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
              {ambito === 'inmueble' && (
                <div className="cv2-hint">
                  Las nóminas se registran desde Gestión Personal, no aquí.
                </div>
              )}
            </div>
          )}

          {/* ───── GASTO · Familia → Concepto (catálogo unificado, mismo que la ficha V6) ───── */}
          {showClasifGasto && (
            <div className="cv2-form-section">
              <h3>Clasificación</h3>
              <div className="cv2-grid-2">
                <div className="cv2-field">
                  <label>Familia</label>
                  <select
                    aria-label="Familia"
                    value={familiaSel}
                    onChange={(e) => {
                      setFamiliaSel(e.target.value);
                      setConceptoSel('');
                    }}
                    disabled={busy || categoriaLocked}
                  >
                    {familiasGasto.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                {conceptosGasto.length > 0 && (
                  <div className="cv2-field">
                    <label>Concepto</label>
                    <select
                      aria-label="Concepto del gasto"
                      value={conceptoSel}
                      onChange={(e) => setConceptoSel(e.target.value)}
                      disabled={busy || categoriaLocked || !familiaSel}
                    >
                      <option value="">Sin concretar</option>
                      {conceptosGasto.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ───── PRÉSTAMO · financiación ───── */}
          {showPrestamo && (
            <>
              <div className="cv2-form-section cv2-field-full">
                <h3>
                  Préstamo <span className="cv2-required-mark">· requerido</span>
                </h3>
                <select
                  value={prestamoId ?? ''}
                  onChange={(e) => handlePrestamoChange(e.target.value || undefined)}
                  disabled={busy || prestamos === null}
                >
                  <option value="">
                    {prestamos === null ? 'Cargando préstamos…' : 'Seleccionar préstamo…'}
                  </option>
                  {(prestamos ?? []).map((p) => {
                    const inmId = prestamoInmuebleId(p);
                    const inm = inmId != null ? properties.find((pp) => String(pp.id) === String(inmId)) : null;
                    const saldo = typeof p.principalVivo === 'number' ? ` · saldo ${formatEuro(p.principalVivo)}` : '';
                    const inmLabel = inm?.alias ? ` · ${inm.alias}` : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {p.nombre}{inmLabel}{saldo}
                      </option>
                    );
                  })}
                </select>
                {prestamos !== null && prestamos.length === 0 && (
                  <div className="cv2-hint cv2-hint--link">
                    No tienes préstamos activos.{' '}
                    <a href="/financiacion">Regístralos primero en Financiación</a>.
                  </div>
                )}
                {prestamos !== null && prestamos.length > 0 && (
                  <div className="cv2-hint">
                    Las cuotas mensuales se generan automáticamente. Usa este flujo solo para
                    amortizaciones parciales, comisiones o cargos puntuales.
                  </div>
                )}
              </div>

              {prestamoSel && (
                <div className="cv2-form-section">
                  <div className="cv2-prestamo-card">
                    <Banknote size={32} strokeWidth={1.5} />
                    <div className="cv2-prestamo-card-body">
                      <div className="cv2-prestamo-card-title">{prestamoSel.nombre}</div>
                      <div>
                        Capital pendiente ·{' '}
                        <span className="cv2-mono">{formatEuro(prestamoSel.principalVivo ?? 0)}</span>
                      </div>
                      {prestamoInmueble && <div>Inmueble · {prestamoInmueble.alias}</div>}
                      {prestamoSel.tipo && <div>Tipo · {prestamoSel.tipo}</div>}
                    </div>
                  </div>
                </div>
              )}

              {prestamoSel && (
                <div className="cv2-form-section">
                  <h3>Tipo de cargo</h3>
                  <div className="cv2-toggle-block">
                    <label>
                      <input
                        type="checkbox"
                        checked={esAmortizacionParcial}
                        onChange={(e) => setEsAmortizacionParcial(e.target.checked)}
                        disabled={busy}
                      />
                      <div>
                        <div className="cv2-toggle-block-title">Es amortización parcial</div>
                        <div className="cv2-toggle-block-subtitle">
                          {importeOk && esAmortizacionParcial ? (
                            <>
                              Al confirmar, ATLAS descontará{' '}
                              <span className="cv2-mono">
                                {formatEuro(Math.abs(parsedImporte))}
                              </span>{' '}
                              del capital pendiente, dejándolo en{' '}
                              <span className="cv2-mono">
                                {formatEuro(
                                  Math.max(
                                    0,
                                    (prestamoSel.principalVivo ?? 0) - Math.abs(parsedImporte),
                                  ),
                                )}
                              </span>
                              .
                            </>
                          ) : (
                            'Reduce el capital pendiente al confirmar el cargo.'
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                  <div className="cv2-hint">
                    Si no marcas amortización parcial, el cargo se registra como gasto financiero
                    puntual (comisión, revisión, intereses extra) sin afectar al capital.
                  </div>
                </div>
              )}
            </>
          )}

          {/* ───── CUENTA DESTINO · traspaso ───── */}
          {showCuentaDestino && (
            <div className="cv2-form-section cv2-field-full">
              <h3>
                Cuenta destino <span className="cv2-required-mark">· requerido</span>
              </h3>
              <select
                value={cuentaDestinoId ?? ''}
                onChange={(e) =>
                  setCuentaDestinoId(e.target.value ? Number(e.target.value) : undefined)
                }
                disabled={busy}
              >
                <option value="">Seleccionar cuenta destino…</option>
                {accountsOtherThanOrigin.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
              <div className="cv2-hint">
                Un traspaso crea 2 movimientos espejo: salida en origen, entrada en destino, con
                el mismo importe. No cuentan como ingreso ni gasto en los KPIs.
              </div>
            </div>
          )}

          {/* ───── DESCRIPCIÓN ───── */}
          {showDescripcion && (
            <div className="cv2-form-section">
              <h3>Descripción</h3>
              {tipo === 'traspaso' ? (
                <div className="cv2-field">
                  <label>Concepto</label>
                  <input
                    type="text"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej: Transferencia para pago hipoteca"
                    disabled={busy}
                  />
                </div>
              ) : (
                <div className="cv2-grid-2">
                  <div className="cv2-field">
                    <label>Concepto</label>
                    <input
                      type="text"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="Ej: Luz abril"
                      disabled={busy}
                    />
                  </div>
                  {showInvoiceNumber && (
                    <div className="cv2-field">
                      <label>Nº factura <span className="cv2-optional-mark">(opcional)</span></label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="Ej: 2026-0412"
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ───── PROVEEDOR ───── */}
          {showProveedor && showDescripcion && (
            <div className="cv2-form-section">
              <h3>Proveedor</h3>
              <div className="cv2-grid-2">
                <div className="cv2-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="Ej: Iberdrola"
                    disabled={busy}
                  />
                </div>
                <div className="cv2-field">
                  <label>NIF <span className="cv2-optional-mark">(opcional)</span></label>
                  <input
                    type="text"
                    value={providerNif}
                    onChange={(e) => setProviderNif(e.target.value)}
                    placeholder="Ej: B83275893"
                    disabled={busy}
                  />
                  {!nifLooksOk && (
                    <div className="cv2-hint" style={{ color: 'var(--atlas-v5-warn)' }}>
                      El NIF no tiene formato español estándar. Puedes guardarlo igual.
                    </div>
                  )}
                </div>
              </div>
              <div className="cv2-hint">
                El NIF y el nº factura se completarán automáticamente cuando subas la factura con OCR.
              </div>
            </div>
          )}
        </div>

        <div className="cv2-modal-footer">
          <div className="cv2-modal-footer-left" />
          <div className="cv2-modal-footer-right">
            <button
              type="button"
              className="cv2-btn cv2-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="cv2-btn cv2-btn-secondary"
              onClick={() => handleSubmit('predicted')}
              disabled={submitDisabled}
            >
              Crear previsión
            </button>
            <button
              type="button"
              className="cv2-btn cv2-btn-primary"
              onClick={() => handleSubmit('confirmed')}
              disabled={submitDisabled}
            >
              <Plus size={14} />
              Crear y confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMovementModal;
