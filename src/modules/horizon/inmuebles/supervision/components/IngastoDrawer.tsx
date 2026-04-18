import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initDB, type Contract, type Movement, type RentaMensual, type TreasuryEvent } from '../../../../../services/db';
import { gastosInmuebleService } from '../../../../../services/gastosInmuebleService';
import { getMejorasPorInmueble } from '../../../../../services/mejoraActivoService';
import { prestamosService, getAllocationFactor } from '../../../../../services/prestamosService';

export type DrawerTipo = 'rentas' | 'gastos_op' | 'intereses' | 'reparaciones' | null;

interface IngastoDrawerProps {
  open: boolean;
  tipo: DrawerTipo;
  ano: number;
  inmuebleId: number;
  inmuebleAlias: string;
  onClose: () => void;
}

interface RentContractRow {
  id: number;
  displayName: string;
  unidad: string;
  estado: 'Activo' | 'Inactivo';
  previstoMes: number;
  previstoAnual: number;
  cobrado: number;
  mesesCobrados: number;
  mesesTotales: number;
}

interface RentDrawerData {
  contratos: RentContractRow[];
  previsto: number;
  confirmado: number;
  pendiente: number;
  mesesCobrados: number;
  mesesTotales: number;
  sinContratoImporte: number;
}

interface OpexRow {
  id: string;
  concepto: string;
  frecuencia: 'Anual' | 'Mensual' | 'Bimestral';
  importe: number;
  estado: 'Declarado' | 'Confirmado' | 'Previsto';
}

interface OpexDrawerData {
  items: OpexRow[];
  total: number;
  confirmados: number;
  previstos: number;
}

interface LoanRow {
  id: string;
  entidad: string;
  tipo: string;
  intereses: number;
  capitalAmortizado: number;
  cuotasPagadas: number;
  cuotasTotales: number;
}

interface LoanDrawerData {
  prestamos: LoanRow[];
  totalIntereses: number;
  totalCapital: number;
  cuotaMedia: number;
  saldoVivoFinAno: number;
}

interface RepairRow {
  id: string;
  concepto: string;
  fecha: string;
  importe: number;
  proveedor?: string;
}

const GASTOS_OP_BOXES = new Set(['0106', '0109', '0112', '0113', '0114', '0115']);
const RENT_SOURCE_TYPES = new Set(['contrato', 'contract']);
const OPEX_SOURCE_TYPES = new Set(['gasto', 'expense', 'opex_rule', 'gasto_recurrente']);
const INTERES_HINTS = ['interes', 'hipoteca', 'prestamo', 'cuota'];
const REPARACION_HINTS = ['reparacion', 'reforma', 'averia', 'fontaneria', 'electricidad'];

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' €';

const isWithinYear = (isoDate: string | undefined, ano: number): boolean => {
  if (!isoDate) return false;
  const y = Number(String(isoDate).slice(0, 4));
  return y === ano;
};

const matchesProperty = (record: any, inmuebleId: number): boolean => {
  const candidates = [
    record?.inmuebleId,
    record?.propertyId,
    record?.property_id,
    record?.inmueble_id,
    record?.metadata?.inmuebleId,
    record?.metadata?.propertyId,
  ].filter((v) => v != null);
  return candidates.some((v) => String(v) === String(inmuebleId));
};

const getContractRangeForYear = (c: Contract, ano: number): { mesesTotales: number; activo: boolean } => {
  const startRaw = c.fechaInicio || c.startDate;
  const endRaw = c.fechaFin || c.endDate;
  if (!startRaw) return { mesesTotales: 0, activo: false };

  const start = new Date(startRaw);
  const end = endRaw ? new Date(endRaw) : new Date(`${ano}-12-31`);
  const yearStart = new Date(`${ano}-01-01`);
  const yearEnd = new Date(`${ano}-12-31`);

  const overlapStart = start > yearStart ? start : yearStart;
  const overlapEnd = end < yearEnd ? end : yearEnd;
  if (overlapStart > overlapEnd) return { mesesTotales: 0, activo: false };

  const months = (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12 + (overlapEnd.getMonth() - overlapStart.getMonth()) + 1;
  const estado = (c.estadoContrato ?? c.status) as string;
  const activo = estado === 'activo' || estado === 'active' || estado === 'upcoming';

  return { mesesTotales: Math.max(0, months), activo };
};

const badgeStyles: Record<'Activo' | 'Inactivo' | 'Declarado' | 'Confirmado' | 'Previsto' | 'Pendiente', React.CSSProperties> = {
  Activo: { color: 'var(--teal-600)', background: 'var(--teal-100)' },
  Inactivo: { color: 'var(--grey-400)', background: 'var(--grey-100)' },
  Declarado: { color: 'var(--grey-700)', background: 'var(--grey-100)' },
  Confirmado: { color: 'var(--teal-600)', background: 'var(--teal-100)' },
  Previsto: { color: 'var(--grey-700)', background: 'var(--grey-100)' },
  Pendiente: { color: 'var(--grey-700)', background: 'var(--grey-100)' },
};

const baseBadgeStyle: React.CSSProperties = {
  fontSize: 'var(--t-xs)',
  fontWeight: 600,
  padding: '2px 10px',
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const valueMono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const isConfirmedMovement = (m: any): boolean => {
  const normalized = String(m?.status ?? '').toLowerCase();
  const movementState = String(m?.movementState ?? '').toLowerCase();
  const unified = String(m?.unifiedStatus ?? '').toLowerCase();
  return normalized === 'confirmed'
    || normalized === 'conciliado'
    || movementState === 'confirmado'
    || unified === 'confirmado'
    || unified === 'conciliado';
};

const isInteresesMovement = (m: any): boolean => {
  const text = `${String(m?.description ?? '')} ${String(m?.categoria ?? '')} ${String(m?.category?.tipo ?? '')}`.toLowerCase();
  return INTERES_HINTS.some((h) => text.includes(h));
};

const isReparacionMovement = (m: any): boolean => {
  const text = `${String(m?.description ?? '')} ${String(m?.categoria ?? '')} ${String(m?.category?.tipo ?? '')}`.toLowerCase();
  return REPARACION_HINTS.some((h) => text.includes(h));
};

const isOpexMovement = (m: any): boolean => {
  const sourceType = String(m?.sourceType ?? m?.source_type ?? '').toLowerCase();
  if (OPEX_SOURCE_TYPES.has(sourceType)) return true;
  const amount = Number(m?.amount ?? 0);
  return amount < 0 && !isInteresesMovement(m) && !isReparacionMovement(m);
};

const parseMovementAmount = (m: any): number => Math.abs(Number(m?.amount ?? 0));

const monthFromPeriod = (periodo: string): string => periodo.slice(0, 7);

const IngastoDrawer: React.FC<IngastoDrawerProps> = ({ open, tipo, ano, inmuebleId, inmuebleAlias, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rentData, setRentData] = useState<RentDrawerData>({
    contratos: [],
    previsto: 0,
    confirmado: 0,
    pendiente: 0,
    mesesCobrados: 0,
    mesesTotales: 0,
    sinContratoImporte: 0,
  });
  const [opexData, setOpexData] = useState<OpexDrawerData>({ items: [], total: 0, confirmados: 0, previstos: 0 });
  const [loanData, setLoanData] = useState<LoanDrawerData>({ prestamos: [], totalIntereses: 0, totalCapital: 0, cuotaMedia: 0, saldoVivoFinAno: 0 });
  const [repairData, setRepairData] = useState<RepairRow[]>([]);

  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !tipo) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const db = await initDB();

        if (tipo === 'rentas') {
          const [contracts, rentasMensuales, treasuryEvents] = await Promise.all([
            db.getAll('contracts') as Promise<Contract[]>,
            db.getAll('rentaMensual') as Promise<RentaMensual[]>,
            db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          ]);

          const propertyContracts = contracts.filter((c) => Number(c.inmuebleId ?? c.propertyId) === inmuebleId);
          const rentasByContract = new Map<number, RentaMensual[]>();
          for (const r of rentasMensuales) {
            const arr = rentasByContract.get(r.contratoId) ?? [];
            arr.push(r);
            rentasByContract.set(r.contratoId, arr);
          }

          // Build a map of confirmed/executed rent treasury events per contract id
          const rentEventsByContractId = new Map<number, TreasuryEvent[]>();
          for (const e of treasuryEvents) {
            if (!RENT_SOURCE_TYPES.has(e.sourceType)) continue;
            if (e.sourceId == null) continue;
            if (e.status !== 'confirmed' && e.status !== 'executed') continue;
            if (!isWithinYear(e.predictedDate, ano)) continue;
            const arr = rentEventsByContractId.get(e.sourceId) ?? [];
            arr.push(e);
            rentEventsByContractId.set(e.sourceId, arr);
          }

          const rows: RentContractRow[] = [];
          let totalPrevisto = 0;
          let totalConfirmado = 0;
          let totalMesesCobrados = 0;
          let totalMeses = 0;

          for (const c of propertyContracts) {
            if (!c.id) continue;
            const { mesesTotales, activo } = getContractRangeForYear(c, ano);
            if (mesesTotales <= 0) continue;

            const records = (rentasByContract.get(c.id) ?? []).filter((r) => monthFromPeriod(r.periodo).startsWith(String(ano)));
            const previstoMensualBase = Number((c as any).rentaMensual ?? c.monthlyRent ?? 0);
            const previstoAnualContr = records.length > 0
              ? records.reduce((s, r) => s + Number(r.importePrevisto ?? 0), 0)
              : Number((c as any).ingresoAnual ?? (c as any).annualIncome ?? previstoMensualBase * mesesTotales);

            const cobradoRentaMensual = records.reduce((s, r) => s + Number(r.importeCobradoAcum ?? 0), 0);
            const mesesCobrados = records.filter((r) => r.estado === 'cobrada' || r.estado === 'parcial').length;

            // Confirmed amount for this specific contract from treasury events
            const cobradoTreasury = ano >= 2025
              ? (rentEventsByContractId.get(c.id) ?? []).reduce((s, e) => s + Math.abs(Number(e.amount)), 0)
              : 0;

            const cobrado = ano >= 2025 ? Math.max(cobradoRentaMensual, cobradoTreasury) : cobradoRentaMensual;
            const previstoAnual = ano === 2026
              ? records
                .filter((r) => r.estado !== 'cobrada')
                .reduce((s, r) => s + Number(r.importePrevisto ?? 0), cobrado)
              : previstoAnualContr;

            const inq = c.inquilino?.nombre?.trim()
              ? `${c.inquilino.nombre} ${c.inquilino.apellidos || ''}`.trim()
              : (c.inquilino?.dni || c.tenant?.nif || 'Sin NIF');

            rows.push({
              id: c.id,
              displayName: inq,
              unidad: c.unidadTipo || c.type || 'vivienda',
              estado: activo ? 'Activo' : 'Inactivo',
              previstoMes: mesesTotales > 0 ? previstoAnual / mesesTotales : 0,
              previstoAnual,
              cobrado,
              mesesCobrados,
              mesesTotales,
            });

            totalPrevisto += previstoAnual;
            totalConfirmado += cobrado;
            totalMesesCobrados += mesesCobrados;
            totalMeses += mesesTotales;
          }

          // Income not linked to any known contract for this property
          const knownContractIds = new Set(propertyContracts.map((c) => c.id).filter((id): id is number => id != null));
          const sinContratoImporte = treasuryEvents
            .filter((e) => RENT_SOURCE_TYPES.has(e.sourceType) && (e.status === 'confirmed' || e.status === 'executed') && isWithinYear(e.predictedDate, ano))
            .filter((e) => e.sourceId == null || !knownContractIds.has(e.sourceId))
            .reduce((s, e) => s + Math.abs(Number(e.amount)), 0);

          if (!cancelled) {
            setRentData({
              contratos: rows,
              previsto: totalPrevisto,
              confirmado: totalConfirmado,
              pendiente: Math.max(0, totalPrevisto - totalConfirmado),
              mesesCobrados: totalMesesCobrados,
              mesesTotales: totalMeses,
              sinContratoImporte,
            });
          }
        }

        if (tipo === 'gastos_op') {
          const [gastosInmueble, movements, treasuryEvents] = await Promise.all([
            gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ano),
            db.getAll('movements') as Promise<Movement[]>,
            db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          ]);

          const items: OpexRow[] = [];
          let confirmados = 0;
          let previstos = 0;

          if (ano <= 2024) {
            for (const g of gastosInmueble.filter((x) => GASTOS_OP_BOXES.has(x.casillaAEAT))) {
              items.push({
                id: `gasto-${g.id ?? g.concepto}`,
                concepto: g.concepto,
                frecuencia: 'Anual',
                importe: Number(g.importe || 0),
                estado: 'Declarado',
              });
            }
          }

          if (ano >= 2025) {
            const movRows = movements
              .filter((m) => isWithinYear((m as any).date, ano))
              .filter((m) => matchesProperty(m, inmuebleId))
              .filter((m) => isConfirmedMovement(m) && isOpexMovement(m));

            for (const m of movRows) {
              const amount = parseMovementAmount(m);
              confirmados += amount;
              items.push({
                id: `mov-${m.id ?? `${(m as any).date ?? ''}-${m.amount}-${String(m.description ?? '').slice(0, 30)}`}`,
                concepto: String((m as any).category?.tipo || (m as any).categoria || m.description || 'Gasto operativo'),
                frecuencia: 'Mensual',
                importe: amount,
                estado: 'Confirmado',
              });
            }
          }

          if (ano >= 2026) {
            // Only include predicted events whose sourceId matches a gasto for this inmueble
            const gastosIds = new Set(gastosInmueble.filter((g) => g.id != null).map((g) => g.id as number));
            const pendingEvents = treasuryEvents
              .filter((e) => isWithinYear(e.predictedDate, ano))
              .filter((e) => e.status === 'predicted')
              .filter((e) => {
                const sid = String(e.sourceType || '').toLowerCase();
                if (!OPEX_SOURCE_TYPES.has(sid)) return false;
                if (e.sourceId == null) return false;
                return gastosIds.has(e.sourceId);
              });

            for (const e of pendingEvents) {
              const amount = Math.abs(Number(e.amount || 0));
              previstos += amount;
              items.push({
                id: `evt-${e.id ?? `${e.predictedDate ?? ''}-${e.amount}-${String(e.description ?? '').slice(0, 30)}`}`,
                concepto: e.description || 'Gasto operativo previsto',
                frecuencia: 'Mensual',
                importe: amount,
                estado: 'Previsto',
              });
            }
          }

          const total = items.reduce((s, i) => s + i.importe, 0);
          const fromDeclarado = items.filter((i) => i.estado === 'Declarado').reduce((s, i) => s + i.importe, 0);
          if (!cancelled) setOpexData({ items, total, confirmados: confirmados + fromDeclarado, previstos });
        }

        if (tipo === 'intereses') {
          const prestamos = await prestamosService.getPrestamosByProperty(String(inmuebleId));
          const rows: LoanRow[] = [];
          let totalIntereses = 0;
          let totalCapital = 0;
          let totalCuotas = 0;
          let cuotasContadas = 0;
          let saldoVivoFinAno = 0;

          for (const p of prestamos) {
            const factor = getAllocationFactor(p, String(inmuebleId));
            if (factor <= 0) continue;

            const plan = p.id ? await prestamosService.getPaymentPlan(p.id) : null;
            const periodos = (plan?.periodos ?? []).filter((per) => isWithinYear(per.fechaCargo, ano));

            const intereses = periodos.reduce((s, per) => s + Number(per.interes || 0), 0) * factor;
            const capital = periodos.reduce((s, per) => s + Number(per.amortizacion || 0), 0) * factor;
            const cuotasTotales = periodos.length;
            const cuotasPagadas = periodos.filter((per) => per.pagado).length;
            const saldoFinalPeriodo = periodos.length > 0 ? Number(periodos[periodos.length - 1].principalFinal || 0) * factor : Number(p.principalVivo || 0) * factor;

            totalIntereses += intereses;
            totalCapital += capital;
            totalCuotas += periodos.reduce((s, per) => s + Number(per.cuota || 0), 0) * factor;
            cuotasContadas += cuotasTotales;
            saldoVivoFinAno += saldoFinalPeriodo;

            rows.push({
              id: p.id,
              entidad: p.nombre || 'Préstamo',
              tipo: p.tipo === 'FIJO' ? 'Hipoteca fija' : p.tipo === 'VARIABLE' ? 'Hipoteca variable' : 'Hipoteca mixta',
              intereses,
              capitalAmortizado: capital,
              cuotasPagadas,
              cuotasTotales,
            });
          }

          if (!cancelled) {
            setLoanData({
              prestamos: rows,
              totalIntereses,
              totalCapital,
              cuotaMedia: cuotasContadas > 0 ? totalCuotas / cuotasContadas : 0,
              saldoVivoFinAno,
            });
          }
        }

        if (tipo === 'reparaciones') {
          const mejoras = await getMejorasPorInmueble(inmuebleId);
          const repairs = mejoras
            .filter((m) => m.tipo === 'reparacion' && Number(m.ejercicio) === ano)
            .map((m) => ({
              id: `rep-${m.id ?? m.descripcion}`,
              concepto: m.descripcion,
              fecha: m.fecha || `${ano}-12-31`,
              importe: Number(m.importe || 0),
              proveedor: m.proveedorNombre || m.proveedorNIF,
            }));
          if (!cancelled) setRepairData(repairs);
        }
      } catch (e) {
        console.error('[IngastoDrawer] Error loading data', e);
        if (!cancelled) setError('No se pudo cargar el desglose');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, tipo, ano, inmuebleId]);

  const title = useMemo(() => {
    if (tipo === 'rentas') return `Rentas ${ano}`;
    if (tipo === 'gastos_op') return `Gastos operativos ${ano}`;
    if (tipo === 'intereses') return `Intereses financiación ${ano}`;
    if (tipo === 'reparaciones') return `Reparaciones ${ano}`;
    return '';
  }, [tipo, ano]);

  // Focus the drawer when it opens for keyboard accessibility
  useEffect(() => {
    if (open && asideRef.current) {
      asideRef.current.focus();
    }
  }, [open]);

  if (!tipo) return null;

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'fixed',
        inset: 0,
        minHeight: '100vh',
        pointerEvents: open ? 'auto' : 'none',
        zIndex: 199,
      }}
    >
      <div
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onClose();
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255,255,255,0.6)',
          opacity: open ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingasto-drawer-title"
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100vh',
          width: 420,
          background: 'var(--white)',
          borderLeft: '1px solid var(--grey-200)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--grey-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 id="ingasto-drawer-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--grey-900)' }}>{title}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--grey-500)' }}>
                {tipo === 'rentas'
                  ? `${rentData.contratos.length} contratos · ${inmuebleAlias}`
                  : inmuebleAlias}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--grey-400)', display: 'inline-flex' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }}>
          {loading ? (
            <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>Cargando desglose…</p>
          ) : null}
          {error ? (
            <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>{error}</p>
          ) : null}

          {!loading && !error && tipo === 'rentas' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--grey-50)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                {[
                  { label: `Previsto ${ano}`, value: fmt(rentData.previsto) },
                  { label: 'Confirmado Tesorería', value: fmt(rentData.confirmado) },
                  { label: 'Pendiente', value: fmt(rentData.pendiente) },
                  { label: 'Meses cobrados / total', value: `${rentData.mesesCobrados}/${rentData.mesesTotales}` },
                ].map((kpi) => (
                  <div key={kpi.label}>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{kpi.label}</div>
                    <div style={{ ...valueMono, fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 600 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              <div>
                {rentData.contratos.map((c) => {
                  const progress = c.previstoAnual > 0 ? Math.min(100, (c.cobrado / c.previstoAnual) * 100) : 0;
                  return (
                    <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-100)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 500 }}>{c.displayName}</div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{c.unidad}</div>
                        </div>
                        <span style={{ ...baseBadgeStyle, ...badgeStyles[c.estado] }}>{c.estado}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Previsto/mes</div>
                          <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-700)' }}>{fmt(c.previstoMes)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Cobrado acum.</div>
                          <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-700)' }}>{fmt(c.cobrado)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Meses</div>
                          <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-700)' }}>{c.mesesCobrados}/{c.mesesTotales}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--grey-100)' }}>
                        <div style={{ width: `${progress}%`, height: 4, borderRadius: 2, background: 'var(--teal-600)' }} />
                      </div>
                    </div>
                  );
                })}

                {rentData.sinContratoImporte > 0 ? (
                  <div style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-100)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-900)' }}>Ingresos sin NIF</span>
                      <span style={{ ...baseBadgeStyle, ...badgeStyles.Pendiente }}>Pendiente</span>
                    </div>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', marginTop: 4 }}>Sin contrato · Pendiente de vincular</div>
                    <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-700)', marginTop: 4 }}>{fmt(rentData.sinContratoImporte)}</div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {!loading && !error && tipo === 'gastos_op' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--grey-50)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                {[
                  { label: 'Total gastos op. año', value: fmt(opexData.total) },
                  { label: 'Confirmados Tesorería', value: fmt(opexData.confirmados) },
                  { label: 'Previstos pendientes', value: fmt(opexData.previstos) },
                  { label: 'Nº conceptos', value: String(opexData.items.length) },
                ].map((kpi) => (
                  <div key={kpi.label}>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{kpi.label}</div>
                    <div style={{ ...valueMono, fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 600 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {opexData.items.map((item) => (
                <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-100)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 500 }}>{item.concepto}</div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ ...baseBadgeStyle, ...badgeStyles.Pendiente }}>{item.frecuencia}</span>
                      <span style={{ ...baseBadgeStyle, ...(badgeStyles[item.estado] || badgeStyles.Pendiente) }}>{item.estado}</span>
                    </div>
                  </div>
                  <div style={{ ...valueMono, fontSize: 'var(--t-sm)', color: 'var(--grey-700)', alignSelf: 'center' }}>{fmt(item.importe)}</div>
                </div>
              ))}
            </>
          ) : null}

          {!loading && !error && tipo === 'intereses' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--grey-50)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                {[
                  { label: 'Total intereses año', value: fmt(loanData.totalIntereses) },
                  { label: 'Capital amortizado', value: fmt(loanData.totalCapital) },
                  { label: 'Cuota media mensual', value: fmt(loanData.cuotaMedia) },
                  { label: 'Saldo vivo fin año', value: fmt(loanData.saldoVivoFinAno) },
                ].map((kpi) => (
                  <div key={kpi.label}>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{kpi.label}</div>
                    <div style={{ ...valueMono, fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 600 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {loanData.prestamos.map((loan) => (
                <div key={loan.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-100)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 500 }}>{loan.entidad}</div>
                      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{loan.tipo}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-700)' }}>Int.: {fmt(loan.intereses)}</div>
                      <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-700)' }}>Cap.: {fmt(loan.capitalAmortizado)}</div>
                      <div style={{ ...valueMono, fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Cuotas: {loan.cuotasPagadas}/{loan.cuotasTotales}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}

          {!loading && !error && tipo === 'reparaciones' ? (
            <>
              {repairData.map((rep) => (
                <div key={rep.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-100)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-900)', fontWeight: 500 }}>{rep.concepto}</div>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)', marginTop: 4 }}>
                      {rep.fecha}{rep.proveedor ? ` · ${rep.proveedor}` : ''}
                    </div>
                  </div>
                  <div style={{ ...valueMono, fontSize: 'var(--t-sm)', color: 'var(--grey-700)', alignSelf: 'center' }}>{fmt(rep.importe)}</div>
                </div>
              ))}
              {repairData.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>No hay reparaciones para este año.</p>
              ) : null}
            </>
          ) : null}
        </div>

        <div style={{ padding: 'var(--space-5)', borderTop: '1px solid var(--grey-100)' }}>
          <button
            type="button"
            onClick={() => {
              if (tipo === 'rentas') {
                navigate(`/inmuebles/contratos?inmuebleId=${inmuebleId}`);
              } else if (tipo === 'gastos_op' || tipo === 'reparaciones') {
                navigate(`/inmuebles/cartera/${inmuebleId}?tab=presupuesto`);
              } else if (tipo === 'intereses') {
                navigate('/financiacion');
              }
              onClose();
            }}
            style={{
              width: '100%',
              border: '1px solid var(--grey-300)',
              borderRadius: 'var(--r-md)',
              background: 'var(--white)',
              color: 'var(--grey-700)',
              fontSize: 'var(--t-sm)',
              fontFamily: 'var(--font-base)',
              fontWeight: 500,
              padding: '10px 12px',
              cursor: 'pointer',
            }}
          >
            {tipo === 'rentas' ? 'Ver contratos' : null}
            {tipo === 'gastos_op' ? 'Gestionar gastos' : null}
            {tipo === 'intereses' ? 'Ver financiación' : null}
            {tipo === 'reparaciones' ? 'Gestionar gastos' : null}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default IngastoDrawer;
