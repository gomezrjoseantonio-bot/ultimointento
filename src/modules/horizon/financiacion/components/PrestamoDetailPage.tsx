import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Prestamo, PlanPagos } from '../../../../types/prestamos';
import { prestamosService } from '../../../../services/prestamosService';
import HeaderSection from './detail/HeaderSection';
import CondicionesSection from './detail/CondicionesSection';
import BonificacionesSection from './detail/BonificacionesSection';
import CalendarioPagosSection from './detail/CalendarioPagosSection';

interface PrestamoDetailPageProps {
  prestamoId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

const PrestamoDetailPage: React.FC<PrestamoDetailPageProps> = ({ prestamoId, onBack, onEdit }) => {
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [planPagos, setPlanPagos] = useState<PlanPagos | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [p, plan] = await Promise.all([
          prestamosService.getPrestamoById(prestamoId),
          prestamosService.getPaymentPlan(prestamoId),
        ]);
        if (!cancelled) {
          setPrestamo(p);
          setPlanPagos(plan);
        }
      } catch (e) {
        console.error('[PrestamoDetailPage] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [prestamoId]);

  const handleCuotaPagada = async (numeroPeriodo: number, pagado: boolean) => {
    await prestamosService.marcarCuotaManual(prestamoId, numeroPeriodo, { pagado });
    // Reload
    const [p, plan] = await Promise.all([
      prestamosService.getPrestamoById(prestamoId),
      prestamosService.getPaymentPlan(prestamoId),
    ]);
    setPrestamo(p);
    setPlanPagos(plan);
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar el préstamo "${prestamo?.nombre}"?`)) return;
    await prestamosService.deletePrestamo(prestamoId);
    onBack();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-atlas-blue border-t-transparent mx-auto mb-4" />
          <p style={{ color: 'var(--atlas-navy-1)' }}>Cargando préstamo...</p>
        </div>
      </div>
    );
  }

  if (!prestamo) {
    return (
      <div className="p-6 text-center" style={{ color: 'var(--error)' }}>
        Préstamo no encontrado.
        <br />
        <button onClick={onBack} className="mt-4 underline" style={{ color: 'var(--atlas-blue)' }}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Back button */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--atlas-blue)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a préstamos
        </button>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <HeaderSection
          prestamo={prestamo}
          onEdit={() => onEdit(prestamoId)}
          onDelete={handleDelete}
          onSimular={() => onEdit(prestamoId)}
        />
        <BonificacionesSection prestamo={prestamo} />
        <CondicionesSection prestamo={prestamo} />
        <CalendarioPagosSection
          prestamo={prestamo}
          planPagos={planPagos}
          onCuotaPagada={handleCuotaPagada}
        />
      </div>
    </div>
  );
};

export default PrestamoDetailPage;
