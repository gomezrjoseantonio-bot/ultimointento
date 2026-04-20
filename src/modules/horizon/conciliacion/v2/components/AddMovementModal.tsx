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
import { initDB } from '../../../../../services/db';
import type { Account, Property, TreasuryEvent } from '../../../../../services/db';
import {
  getCategoriesForModal,
  getCategoryByKey,
  getOpexCategories,
  SUMINISTRO_SUBTYPES,
  type Ambito,
  type CategoryDef,
  type MovementType,
} from '../../../../../services/categoryCatalog';
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
  tipo?: MovementType;
  ambito?: Ambito;
  inmuebleId?: number;
  categoryKey?: string;
  subtypeKey?: string;
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
}

const TIPO_PILLS: { value: MovementType; label: string; Icon: React.ElementType }[] = [
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
}) => {
  // PR5-HOTFIX v2 · fecha default = hoy (no el primer día del mes navegado).
  const today = new Date().toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<MovementType>(prefill?.tipo ?? 'gasto');
  const [fecha, setFecha] = useState(prefill?.fecha ?? today);
  const [importeStr, setImporteStr] = useState('');
  const [cuentaId, setCuentaId] = useState<number | undefined>(
    accounts.length > 0 ? accounts[0].id : undefined,
  );
  const [ambito, setAmbito] = useState<Ambito | undefined>(prefill?.ambito ?? 'inmueble');
  const [inmuebleId, setInmuebleId] = useState<number | undefined>(prefill?.inmuebleId);
  const [categoriaKey, setCategoriaKey] = useState<string | undefined>(prefill?.categoryKey);
  const [subtipoKey, setSubtipoKey] = useState<string | undefined>(prefill?.subtypeKey);
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
  const showCategoria = tipo === 'ingreso' || tipo === 'gasto';
  const showSubtipo = categoriaKey === 'suministro_inmueble';
  const showPrestamo = tipo === 'financiacion';
  const showCuentaDestino = tipo === 'traspaso';
  // PR5-HOTFIX v3 · nº factura sólo para gastos + financiación.
  const showInvoiceNumber = tipo === 'gasto' || tipo === 'financiacion';
  const showDescripcion = tipo !== 'financiacion' || !!prestamoId;
  const showProveedor = tipo !== 'traspaso';

  const categoriesToShow: CategoryDef[] = useMemo(() => {
    if (!showCategoria) return [];
    if (restrictCategoriesTo === 'opex') {
      return getOpexCategories();
    }
    return getCategoriesForModal(tipo, ambito);
  }, [showCategoria, tipo, ambito, restrictCategoriesTo]);

  const categoriaDef = categoriaKey ? getCategoryByKey(categoriaKey) : undefined;

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
  const handleTipoChange = (next: MovementType) => {
    if (tipoLocked) return;
    setTipo(next);
    if (!categoriaLocked) {
      setCategoriaKey(undefined);
      setSubtipoKey(undefined);
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
      setSubtipoKey(undefined);
    }
    if (next === 'personal') setInmuebleId(undefined);
  };

  const handleCategoriaChange = (key: string) => {
    if (categoriaLocked) return;
    setCategoriaKey(key);
    setSubtipoKey(undefined); // reset sub-tipo al cambiar categoría
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

    if (tipo === 'ingreso' || tipo === 'gasto') {
      if (!categoriaKey) return true;
      if (categoriaDef?.requiereInmueble && !inmuebleId) return true;
      if (categoriaDef?.hasSubtype && !subtipoKey) return true;
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
      let effectiveAmbito: 'PERSONAL' | 'INMUEBLE' = 'PERSONAL';
      let effectiveInmuebleId: number | undefined;
      if (tipo === 'financiacion') {
        if (prestamoInmueble) {
          effectiveAmbito = 'INMUEBLE';
          effectiveInmuebleId = prestamoInmueble.id;
        }
      } else if (ambito === 'inmueble') {
        effectiveAmbito = 'INMUEBLE';
        effectiveInmuebleId = inmuebleId;
      }

      // Resolver descripción (si no hay concepto, generar uno razonable).
      const description =
        concept.trim() ||
        (tipo === 'financiacion'
          ? esAmortizacionParcial
            ? `Amortización parcial · ${prestamoSel?.nombre ?? ''}`.trim()
            : `Cargo financiación · ${prestamoSel?.nombre ?? ''}`.trim()
          : categoriaDef?.label ?? 'Movimiento');

      // Calcular flags documentales por categoría canónica.
      const flags = computeDocFlags(categoriaKey ?? (tipo === 'financiacion' ? 'gasto_financiero' : undefined));

      const providerNameTrimmed = providerName.trim();
      const providerNifTrimmed = providerNif.trim();
      const invoiceNumberTrimmed = invoiceNumber.trim();

      const eventPayload: Omit<TreasuryEvent, 'id'> = {
        type:
          tipo === 'ingreso'
            ? 'income'
            : tipo === 'financiacion'
              ? 'financing'
              : 'expense',
        amount: Math.abs(parsedImporte),
        predictedDate: fecha,
        description,
        sourceType: tipo === 'financiacion' ? 'prestamo' : 'manual',
        // sourceId: sólo para legacy — en financiación usamos prestamoId (string).
        accountId: cuentaId,
        status: 'predicted',
        ambito: effectiveAmbito,
        inmuebleId: effectiveInmuebleId,
        categoryKey: categoriaKey,
        categoryLabel: categoriaDef?.label,
        subtypeKey: subtipoKey,
        // PR5-HOTFIX v3 · proveedor estructurado en 3 campos. `counterparty`
        // se mantiene como copia del nombre por retrocompatibilidad (lectores
        // legacy + learning rules).
        providerName: providerNameTrimmed || undefined,
        providerNif: providerNifTrimmed || undefined,
        invoiceNumber: invoiceNumberTrimmed || undefined,
        counterparty: providerNameTrimmed || undefined,
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

  const subtitleByTipo: Record<MovementType, string> = {
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
              <Plus size={15} style={{ marginRight: 6, color: 'var(--cv2-grey-500)' }} />
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
                    background: 'var(--cv2-grey-100, #EEF1F5)',
                    color: 'var(--cv2-grey-700, #303A4C)',
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

          {/* ───── CATEGORÍA · grid de cards ───── */}
          {showCategoria && (
            <div className="cv2-form-section">
              <h3>Categoría</h3>
              <div
                className={`cv2-cat-grid ${categoriesToShow.length >= 10 ? 'cv2-cat-grid--cols-5' : ''}`}
              >
                {categoriesToShow.map((cat) => {
                  const active = categoriaKey === cat.key;
                  const disabled = busy || (categoriaLocked && !active);
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      className={`cv2-cat-card ${active ? 'active' : ''}`}
                      onClick={() => handleCategoriaChange(cat.key)}
                      disabled={disabled}
                    >
                      <cat.icon size={20} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
              {tipo === 'ingreso' && ambito === 'inmueble' && (
                <div className="cv2-hint">
                  Las nóminas se registran desde Gestión Personal, no aquí.
                </div>
              )}
            </div>
          )}

          {/* ───── SUB-TIPO · solo suministro ───── */}
          {showSubtipo && (
            <div className="cv2-form-section">
              <h3>
                Tipo de suministro <span className="cv2-required-mark">· requerido</span>
              </h3>
              <div className="cv2-subtipo-pills">
                {SUMINISTRO_SUBTYPES.map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    className={`cv2-subtipo-pill ${subtipoKey === st.key ? 'active' : ''}`}
                    onClick={() => setSubtipoKey(st.key)}
                    disabled={busy}
                  >
                    <st.icon size={14} />
                    {st.label}
                  </button>
                ))}
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
                    <div className="cv2-hint" style={{ color: 'var(--cv2-warning-600, #B45309)' }}>
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
