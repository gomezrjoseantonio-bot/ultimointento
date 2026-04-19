// src/pages/GestionInmuebles/VentaWizard.tsx
// Pantalla-wizard de venta de inmueble (3 pasos).
// Ruta: /gestion/inmuebles/:id/vender
//
// Reemplaza al modal antiguo PropertySaleModal con un flujo paso a paso
// navegable, sin scroll en cada paso, y con cálculo fiscal correcto.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import { initDB, type Account, type GastoInmueble, type Property } from '../../services/db';
import { confirmPropertySale } from '../../services/propertySaleService';
import { gastosInmuebleService } from '../../services/gastosInmuebleService';
import type { GananciaPatrimonialResult } from '../../services/gananciaPatrimonialService';
import Step1DatosVenta from './venta/Step1DatosVenta';
import Step2CancelacionHipoteca from './venta/Step2CancelacionHipoteca';
import Step3Confirmar from './venta/Step3Confirmar';
import { makeInitialWizardState, type VentaWizardState } from './venta/wizardTypes';
import { W, fontFamily } from './venta/wizardStyles';

const STEPS: Array<{ n: 1 | 2 | 3; label: string }> = [
  { n: 1, label: 'Datos de la venta' },
  { n: 2, label: 'Cancelación hipoteca' },
  { n: 3, label: 'Confirmar y generar' },
];

const VentaWizard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propertyId = Number(id);
  const backToDetail = `/gestion/inmuebles/${propertyId}`;

  const [property, setProperty] = useState<Property | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sinIdentificarCount, setSinIdentificarCount] = useState(0);
  const [state, setState] = useState<VentaWizardState>(() => makeInitialWizardState());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const [prop, allAccounts, allGastos] = await Promise.all([
          db.get('properties', propertyId) as Promise<Property | undefined>,
          db.getAll('accounts') as Promise<Account[]>,
          gastosInmuebleService.getAll().catch<GastoInmueble[]>(() => []),
        ]);
        if (cancelled) return;
        if (!prop) {
          toast.error('Inmueble no encontrado');
          navigate('/gestion/inmuebles');
          return;
        }
        setProperty(prop);
        setAccounts(allAccounts);
        // "Sin identificar" = años con declaración fiscal (cualquier casilla) y
        // sin contrato activo que los cubra. Simple heurística: años con gastos
        // origen xml_aeat pero sin ningún contrato vivo.
        const years = Array.from(
          new Set(
            allGastos
              .filter((g) => g.inmuebleId === propertyId && g.origen === 'xml_aeat')
              .map((g) => Number((g.fecha || '').slice(0, 4)))
              .filter((y) => Number.isFinite(y)),
          ),
        );
        const allContracts = await db.getAll('contracts');
        const propContracts = allContracts.filter(
          (c: any) => c.inmuebleId === propertyId || c.propertyId === propertyId,
        );
        const sinIdentificar = years.filter((y) => {
          const yStart = new Date(`${y}-01-01`).getTime();
          const yEnd = new Date(`${y}-12-31`).getTime();
          return !propContracts.some((c: any) => {
            const s = new Date(c.fechaInicio || c.startDate || '').getTime();
            const e = new Date(c.fechaFin || c.endDate || '2099-12-31').getTime();
            return Number.isFinite(s) && Number.isFinite(e) && s <= yEnd && e >= yStart;
          });
        });
        setSinIdentificarCount(sinIdentificar.length);
      } catch (err) {
        console.error('Error cargando wizard de venta:', err);
        toast.error('Error al cargar el wizard de venta');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, navigate]);

  const update = useCallback(
    (patch: Partial<VentaWizardState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );

  const handleConfirm = async (fiscalSnapshot: GananciaPatrimonialResult) => {
    if (!property || state.settlementAccountId === '' || state.settlementAccountId == null) return;

    const loanPayoffAmount = state.loansToCancel.reduce(
      (s, l) => s + l.outstandingPrincipal,
      0,
    );
    const loanCancellationFee = state.loansToCancel.reduce(
      (s, l) => s + l.comisionFinalAplicada,
      0,
    );

    try {
      await confirmPropertySale({
        propertyId: property.id!,
        saleDate: state.sellDate,
        salePrice: state.salePrice,
        agencyCommission: state.agencyCommission,
        municipalTax: state.municipalTax,
        saleNotaryCosts: state.saleNotary + state.saleRegistry,
        otherCosts: 0,
        loanPayoffAmount,
        loanCancellationFee,
        settlementAccountId: Number(state.settlementAccountId),
        source: 'wizard',
        autoTerminateContracts: true,
        notes: state.buyerNif ? `Comprador NIF ${state.buyerNif}` : undefined,
        fiscalSnapshot,
      });
      toast.success('Venta confirmada correctamente');
      navigate(backToDetail);
    } catch (err) {
      console.error('Error al confirmar la venta:', err);
      const msg = err instanceof Error ? err.message : 'No se pudo confirmar la venta';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: W.grey50, padding: 24, fontFamily }}>
        <div style={{ textAlign: 'center', padding: 48, color: W.grey500 }}>Cargando...</div>
      </div>
    );
  }
  if (!property) return null;

  if (property.state !== 'activo') {
    return (
      <div style={{ minHeight: '100vh', background: W.grey50, padding: 24, fontFamily }}>
        <div
          style={{
            background: W.white,
            border: `1px solid ${W.grey200}`,
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            color: W.grey500,
          }}
        >
          Este inmueble ya no está activo. No se puede iniciar una nueva venta.
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => navigate(backToDetail)}
              style={{
                padding: '8px 16px',
                border: `1.5px solid ${W.grey300}`,
                background: W.white,
                color: W.grey700,
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily,
              }}
            >
              Volver a la ficha
            </button>
          </div>
        </div>
      </div>
    );
  }

  const subtitle = [property.address, property.postalCode, property.municipality, property.province]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: W.grey50,
        fontFamily,
      }}
    >
      <div style={{ padding: 24 }}>
        <button
          onClick={() => navigate(backToDetail)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: W.grey500,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 12,
            fontFamily,
          }}
        >
          <ArrowLeft size={14} /> {property.alias}
        </button>

        <PageHeader
          icon={Building2}
          title={`Vender ${property.alias}`}
          subtitle={subtitle}
        />

        <Stepper current={state.step} />

        <div style={{ marginTop: 24 }}>
          {state.step === 1 && (
            <Step1DatosVenta
              property={property}
              accounts={accounts}
              sinIdentificarCount={sinIdentificarCount}
              state={state}
              onChange={update}
              onCancel={() => navigate(backToDetail)}
              onNext={() => update({ step: 2 })}
            />
          )}
          {state.step === 2 && (
            <Step2CancelacionHipoteca
              property={property}
              state={state}
              onChange={update}
              onBack={() => update({ step: 1 })}
              onNext={() => update({ step: 3 })}
            />
          )}
          {state.step === 3 && (
            <Step3Confirmar
              property={property}
              accounts={accounts}
              state={state}
              onBack={() => update({ step: 2 })}
              onCancel={() => navigate(backToDetail)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const Stepper: React.FC<{ current: 1 | 2 | 3 }> = ({ current }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      background: W.white,
      border: `1px solid ${W.grey200}`,
      borderRadius: 12,
      fontFamily,
    }}
  >
    {STEPS.map((s, idx) => {
      const done = s.n < current;
      const active = s.n === current;
      return (
        <React.Fragment key={s.n}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: active || done ? W.navy900 : W.grey100,
                color: active || done ? W.white : W.grey500,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {done ? '✓' : s.n}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? W.grey900 : W.grey500,
              }}
            >
              {s.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: done ? W.navy900 : W.grey200,
              }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

export default VentaWizard;
