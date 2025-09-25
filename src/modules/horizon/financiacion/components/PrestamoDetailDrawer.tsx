import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  Building,
  User,
  TrendingUp,
  DollarSign,
  Clock,
  Percent,
  Info
} from 'lucide-react';
import Drawer from '../../../../components/common/Drawer';
import { Prestamo } from '../../../../types/prestamos';

interface PrestamoDetailDrawerProps {
  prestamo: Prestamo | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (prestamoId: string) => void;
  onDelete: (prestamoId: string) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 rounded-atlas">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center">
          <Icon className="h-5 w-5 text-atlas-blue mr-3" />
          <span className="font-medium text-atlas-navy-1">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-text-gray" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-gray" />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

const PrestamoDetailDrawer: React.FC<PrestamoDetailDrawerProps> = ({
  prestamo,
  isOpen,
  onClose,
  onEdit,
  onDelete
}) => {
  if (!prestamo) return null;

  const formatNumber = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercentage = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  // Calculate effective TIN (with bonifications)
  const calculateEffectiveTIN = () => {
    let baseTIN = 0;
    if (prestamo.tipo === 'FIJO') {
      baseTIN = prestamo.tipoNominalAnualFijo || 0;
    } else if (prestamo.tipo === 'VARIABLE') {
      baseTIN = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
    } else if (prestamo.tipo === 'MIXTO') {
      baseTIN = prestamo.tipoNominalAnualMixtoFijo || 0;
    }

    const totalBonificaciones = (prestamo.bonificaciones || [])
      .reduce((sum, b) => sum + b.reduccionPuntosPorcentuales, 0);

    return Math.max(0, baseTIN - totalBonificaciones);
  };

  // Estimate monthly payment
  const estimateMonthlyPayment = () => {
    const effectiveTIN = calculateEffectiveTIN();
    const monthlyRate = effectiveTIN / 12 / 100;
    const months = prestamo.plazoMesesTotal;
    
    if (monthlyRate > 0) {
      return (prestamo.principalVivo * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
             (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      return prestamo.principalVivo / months;
    }
  };

  const isPersonal = prestamo.inmuebleId === 'standalone';
  const effectiveTIN = calculateEffectiveTIN();
  const monthlyPayment = estimateMonthlyPayment();

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export to PDF');
  };

  const handleExportExcel = () => {
    // TODO: Implement Excel export
    console.log('Export to Excel');
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle del préstamo: ${prestamo.nombre}`}
      size="lg"
      primaryAction={{
        label: "Editar",
        onClick: () => onEdit(prestamo.id)
      }}
      secondaryAction={{
        label: "Eliminar",
        onClick: () => onDelete(prestamo.id)
      }}
    >
      <div className="space-y-6">
        {/* Basic Info Card */}
        <div className="bg-white border border-gray-200 rounded-atlas p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
                isPersonal ? 'bg-primary-100' : 'bg-warning-100'
              }`}>
                {isPersonal ? (
                  <User className="h-6 w-6 text-atlas-blue" />
                ) : (
                  <Building className="h-6 w-6 text-warn" />
                )}
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-atlas-navy-1">{prestamo.nombre}</h3>
                <p className="text-text-gray">
                  {isPersonal ? 'Préstamo Personal' : 'Préstamo Inmueble'} • {prestamo.tipo}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleExportPDF}
                className="p-2 text-text-gray hover:text-atlas-blue transition-colors"
            title="Exportar a PDF"
          >
                <FileText className="h-5 w-5" />
              </button>
              <button
                onClick={handleExportExcel}
                className="p-2 text-text-gray hover:text-atlas-blue transition-colors"
            title="Exportar a Excel"
          >
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-atlas-blue mx-auto mb-1" />
              <p className="text-xs text-text-gray">Principal Vivo</p>
              <p className="text-lg font-bold text-atlas-navy-1">{formatNumber(prestamo.principalVivo)} €</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Percent className="h-5 w-5 text-atlas-blue mx-auto mb-1" />
              <p className="text-xs text-text-gray">TIN Efectivo</p>
              <p className="text-lg font-bold text-atlas-navy-1">{formatPercentage(effectiveTIN)} %</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-atlas-blue mx-auto mb-1" />
              <p className="text-xs text-text-gray">Cuota Estimada</p>
              <p className="text-lg font-bold text-atlas-navy-1">{formatNumber(monthlyPayment)} €</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-atlas-blue mx-auto mb-1" />
              <p className="text-xs text-text-gray">Plazo Total</p>
              <p className="text-lg font-bold text-atlas-navy-1">{prestamo.plazoMesesTotal} meses</p>
            </div>
          </div>
        </div>

        {/* Condiciones Section */}
        <CollapsibleSection 
          title="Condiciones" 
          icon={Info}
          defaultExpanded={true}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                Principal Inicial
              </label>
              <p className="text-text-gray">{formatNumber(prestamo.principalInicial)} €</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                Fecha de Firma
              </label>
              <p className="text-text-gray">{formatDate(prestamo.fechaFirma)}</p>
            </div>
            
            {prestamo.tipo === 'FIJO' && (
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  TIN Nominal Anual
                </label>
                <p className="text-text-gray">{formatPercentage(prestamo.tipoNominalAnualFijo || 0)} %</p>
              </div>
            )}
            
            {prestamo.tipo === 'VARIABLE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Índice
                  </label>
                  <p className="text-text-gray">{prestamo.indice || 'No especificado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Valor Índice Actual
                  </label>
                  <p className="text-text-gray">{formatPercentage(prestamo.valorIndiceActual || 0)} %</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Diferencial
                  </label>
                  <p className="text-text-gray">{formatPercentage(prestamo.diferencial || 0)} %</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Periodo de Revisión
                  </label>
                  <p className="text-text-gray">{prestamo.periodoRevisionMeses || 0} meses</p>
                </div>
              </>
            )}

            {prestamo.diaCargoMes && (
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                  Día de Cargo
                </label>
                <p className="text-text-gray">Día {prestamo.diaCargoMes} de cada mes</p>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Bonificaciones Section */}
        {prestamo.bonificaciones && prestamo.bonificaciones.length > 0 && (
          <CollapsibleSection 
            title="Bonificaciones" 
            icon={TrendingUp}
          >
            <div className="space-y-3">
              {prestamo.bonificaciones.map((bonif, index) => (
                <div key={bonif.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-atlas-navy-1">{bonif.nombre}</p>
                    <p className="text-sm text-text-gray">
                      Reducción: {formatPercentage(bonif.reduccionPuntosPorcentuales)} p.p.
                    </p>
                    {bonif.progreso && (
                      <p className="text-xs text-text-gray mt-1">{bonif.progreso.descripcion}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      bonif.estado === 'CUMPLIDA' ? 'bg-ok-100 text-ok-800' :
                      bonif.estado === 'EN_RIESGO' ? 'bg-warn-100 text-warn-800' :
                      bonif.estado === 'PERDIDA' ? 'bg-error-100 text-error-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {bonif.estado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Calendario de Pagos Section */}
        <CollapsibleSection 
          title="Calendario de Pagos" 
          icon={Calendar}
        >
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-text-gray mx-auto mb-4" />
            <p className="text-text-gray">
              El cuadro de amortización detallado se mostrará aquí
            </p>
            <p className="text-sm text-text-gray mt-2">
              Funcionalidad disponible próximamente
            </p>
          </div>
        </CollapsibleSection>
      </div>
    </Drawer>
  );
};

export default PrestamoDetailDrawer;