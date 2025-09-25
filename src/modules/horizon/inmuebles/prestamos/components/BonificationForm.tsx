// Bonification Form Component for creating/editing individual bonifications

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Bonificacion, ReglaBonificacion } from '../../../../../types/prestamos';
import { formatSpanishNumber, parseSpanishNumber } from '../../../../../services/spanishFormattingService';
import { standardBonificationsService } from '../../../../../services/standardBonificationsService';

interface BonificationFormProps {
  bonification: Bonificacion;
  onChange: (bonification: Bonificacion) => void;
  onRemove: () => void;
}

const BonificationForm: React.FC<BonificationFormProps> = ({ bonification, onChange, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(!bonification.nombre);
  const [reduccionDisplay, setReduccionDisplay] = useState(
    formatSpanishNumber(bonification.reduccionPuntosPorcentuales * 100, 3)
  );
  const [costeDisplay, setCosteDisplay] = useState(
    bonification.costeAnualEstimado ? formatSpanishNumber(bonification.costeAnualEstimado, 0) : ''
  );
  const [minimoMensualDisplay, setMinimoMensualDisplay] = useState(
    bonification.regla?.tipo === 'NOMINA' && bonification.regla.minimoMensual 
      ? formatSpanishNumber(bonification.regla.minimoMensual, 0) 
      : ''
  );

  // Update display states when bonification prop changes
  useEffect(() => {
    setReduccionDisplay(formatSpanishNumber(bonification.reduccionPuntosPorcentuales * 100, 3));
    setCosteDisplay(bonification.costeAnualEstimado ? formatSpanishNumber(bonification.costeAnualEstimado, 0) : '');
    setMinimoMensualDisplay(
      bonification.regla?.tipo === 'NOMINA' && bonification.regla.minimoMensual 
        ? formatSpanishNumber(bonification.regla.minimoMensual, 0) 
        : ''
    );
  }, [bonification]);

  const handleFieldChange = (field: keyof Bonificacion, value: any) => {
    onChange({
      ...bonification,
      [field]: value
    });
  };

  const handleRuleChange = (newRule: ReglaBonificacion) => {
    onChange({
      ...bonification,
      regla: newRule
    });
  };

  const getTipoOptions = () => [
    { value: 'NOMINA', label: 'Nómina' },
    { value: 'PLAN_PENSIONES', label: 'Plan de pensiones' },
    { value: 'SEGURO_HOGAR', label: 'Seguro de hogar' },
    { value: 'SEGURO_VIDA', label: 'Seguro de vida' },
    { value: 'TARJETA', label: 'Uso de tarjeta' },
    { value: 'ALARMA', label: 'Alarma' },
    { value: 'OTRA', label: 'Otra' }
  ];

  const getPresetBonifications = () => {
    return standardBonificationsService.getHabitual().map(standard => ({
      nombre: standard.nombre,
      reduccionPuntosPorcentuales: standard.reduccionPuntosPorcentuales,
      lookbackMeses: standard.lookbackMeses,
      regla: standard.regla,
      costeAnualEstimado: standard.costeAnualEstimado || 0,
      descripcion: standard.descripcion
    }));
  };

  const applyPreset = (preset: any) => {
    onChange({
      ...bonification,
      ...preset,
      estado: 'PENDIENTE'
    });
    setIsExpanded(false);
  };

  if (!isExpanded && bonification.nombre) {
    return (
      <div className="border border-gray-300 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <span className="font-medium text-gray-700">{bonification.nombre}</span>
              <span className="text-sm text-gray-500">
                -{formatSpanishNumber(bonification.reduccionPuntosPorcentuales * 100, 2)}%
              </span>
              {bonification.costeAnualEstimado && bonification.costeAnualEstimado > 0 && (
                <span className="text-sm text-error-500">
                  ~{bonification.costeAnualEstimado}€/año
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-atlas-blue hover:text-[#033A73] text-sm font-medium"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-error-500 hover:text-error-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-[#F9FAFB]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-700">
          {bonification.nombre || 'Nueva bonificación'}
        </h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-error-500 hover:text-error-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preset options */}
      {!bonification.nombre && (
        <div className="mb-4 p-3 bg-white rounded border">
          <p className="text-sm font-medium text-gray-700 mb-2">Bonificaciones habituales:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {getPresetBonifications().map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-left p-2 text-sm border rounded hover:bg-[#F3F4F6] transition-colors"
              >
                <div className="font-medium">{preset.nombre}</div>
                <div className="text-gray-500 text-xs mb-1">
                  {preset.descripcion}
                </div>
                <div className="text-gray-500">
                  -{formatSpanishNumber(preset.reduccionPuntosPorcentuales * 100, 2)}% 
                  {preset.costeAnualEstimado > 0 && ` (~${formatSpanishNumber(preset.costeAnualEstimado, 0)}€/año)`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </label>
          <input
            type="text"
            value={bonification.nombre}
            onChange={(e) => handleFieldChange('nombre', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
            placeholder="ej: Nómina"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reducción (puntos %) *
          </label>
          <input
            type="text"
            value={reduccionDisplay}
            onChange={(e) => setReduccionDisplay(e.target.value)}
            onBlur={(e) => {
              if (e.target.value) {
                const parsed = parseSpanishNumber(e.target.value);
                if (parsed >= 0) {
                  const formatted = formatSpanishNumber(parsed, 3);
                  setReduccionDisplay(formatted);
                  handleFieldChange('reduccionPuntosPorcentuales', parsed / 100);
                }
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
            placeholder="0,300"
          />
          <p className="text-xs text-gray-500 mt-1">
            ej: 0,300 = 0,30 puntos porcentuales (escribir como 0,30)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período de revisión (meses)
          </label>
          <input
            type="number"
            value={bonification.lookbackMeses}
            onChange={(e) => handleFieldChange('lookbackMeses', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
            >
            placeholder="3"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coste anual estimado (€)
          </label>
          <input
            type="text"
            value={costeDisplay}
            onChange={(e) => setCosteDisplay(e.target.value)}
            onBlur={(e) => {
              if (e.target.value) {
                const parsed = parseSpanishNumber(e.target.value);
                if (parsed >= 0) {
                  const formatted = formatSpanishNumber(parsed, 0);
                  setCosteDisplay(formatted);
                  handleFieldChange('costeAnualEstimado', parsed || undefined);
                }
              } else {
                setCosteDisplay('');
                handleFieldChange('costeAnualEstimado', undefined);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
            placeholder="240"
          />
        </div>
      </div>

      {/* Rule configuration */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de bonificación *
        </label>
        <select
          value={bonification.regla.tipo}
          onChange={(e) => {
            const tipo = e.target.value as ReglaBonificacion['tipo'];
            let newRule: ReglaBonificacion;
            
            switch (tipo) {
              case 'NOMINA':
                newRule = { tipo: 'NOMINA', minimoMensual: 1000 };
                break;
              case 'PLAN_PENSIONES':
                newRule = { tipo: 'PLAN_PENSIONES', activo: true };
                break;
              case 'SEGURO_HOGAR':
                newRule = { tipo: 'SEGURO_HOGAR', activo: true };
                break;
              case 'SEGURO_VIDA':
                newRule = { tipo: 'SEGURO_VIDA', activo: true };
                break;
              case 'TARJETA':
                newRule = { tipo: 'TARJETA', movimientosMesMin: 6 };
                break;
              case 'ALARMA':
                newRule = { tipo: 'ALARMA', activo: true };
                break;
              default:
                newRule = { tipo: 'OTRA', descripcion: '' };
            }
            
            handleRuleChange(newRule);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
        >
          {getTipoOptions().map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rule-specific fields */}
      <div className="mt-3">
        {bonification.regla.tipo === 'NOMINA' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Importe mínimo mensual (€)
            </label>
            <input
              type="text"
              value={minimoMensualDisplay}
              onChange={(e) => setMinimoMensualDisplay(e.target.value)}
              onBlur={(e) => {
                if (e.target.value) {
                  const parsed = parseSpanishNumber(e.target.value);
                  if (parsed >= 0) {
                    const formatted = formatSpanishNumber(parsed, 0);
                    setMinimoMensualDisplay(formatted);
                    handleRuleChange({
                      tipo: 'NOMINA',
                      minimoMensual: parsed
                    });
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
            placeholder="1.200"
          />
          </div>
        )}

        {bonification.regla.tipo === 'TARJETA' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Movimientos mínimos por mes
              </label>
              <input
                type="number"
                value={(bonification.regla.tipo === 'TARJETA' ? bonification.regla.movimientosMesMin : '') || ''}
                onChange={(e) => handleRuleChange({
                  tipo: 'TARJETA',
                  movimientosMesMin: parseInt(e.target.value) || undefined,
                  importeMinimo: bonification.regla.tipo === 'TARJETA' ? bonification.regla.importeMinimo : undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
                >
                placeholder="6"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importe mínimo anual (€) - opcional
              </label>
              <input
                type="number"
                value={(bonification.regla.tipo === 'TARJETA' ? bonification.regla.importeMinimo : '') || ''}
                onChange={(e) => handleRuleChange({
                  tipo: 'TARJETA',
                  movimientosMesMin: bonification.regla.tipo === 'TARJETA' ? bonification.regla.movimientosMesMin : undefined,
                  importeMinimo: parseInt(e.target.value) || undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
                >
                placeholder="3000"
                min="0"
              />
            </div>
          </div>
        )}

        {(bonification.regla.tipo === 'PLAN_PENSIONES' || 
          bonification.regla.tipo === 'SEGURO_HOGAR' || 
          bonification.regla.tipo === 'SEGURO_VIDA' || 
          bonification.regla.tipo === 'ALARMA') && (
          <div className="text-sm text-gray-500">
            Esta bonificación se aplicará automáticamente mientras el producto/servicio esté activo.
          </div>
        )}

        {bonification.regla.tipo === 'OTRA' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción de la regla
            </label>
            <textarea
              value={bonification.regla.descripcion}
              onChange={(e) => handleRuleChange({
                tipo: 'OTRA',
                descripcion: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
              >
              placeholder="Describe las condiciones para obtener esta bonificación"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 mt-4 pt-3 border-t">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
        >
          Minimizar
        </button>
      </div>
    </div>
  );
};

export default BonificationForm;