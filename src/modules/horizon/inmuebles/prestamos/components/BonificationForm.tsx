// Bonification Form Component for creating/editing individual bonifications

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Bonificacion, ReglaBonificacion } from '../../../../../types/prestamos';
import { formatSpanishNumber, parseSpanishNumber } from '../../../../../services/spanishFormattingService';

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
    { value: 'TARJETA', label: 'Uso de tarjeta' },
    { value: 'SEGURO_HOGAR', label: 'Seguro de hogar' },
    { value: 'SEGURO_VIDA', label: 'Seguro de vida' },
    { value: 'OTRA', label: 'Otra' }
  ];

  const getPresetBonifications = () => [
    {
      nombre: 'Nómina',
      reduccionPuntosPorcentuales: 0.003,
      lookbackMeses: 4,
      regla: { tipo: 'NOMINA' as const, minimoMensual: 1200 },
      costeAnualEstimado: 0
    },
    {
      nombre: 'Seguro de hogar',
      reduccionPuntosPorcentuales: 0.002,
      lookbackMeses: 12,
      regla: { tipo: 'SEGURO_HOGAR' as const, activo: true },
      costeAnualEstimado: 240
    },
    {
      nombre: 'Seguro de vida',
      reduccionPuntosPorcentuales: 0.002,
      lookbackMeses: 12,
      regla: { tipo: 'SEGURO_VIDA' as const, activo: true },
      costeAnualEstimado: 180
    },
    {
      nombre: 'Uso de tarjeta',
      reduccionPuntosPorcentuales: 0.001,
      lookbackMeses: 3,
      regla: { tipo: 'TARJETA' as const, movimientosMesMin: 6 },
      costeAnualEstimado: 0
    }
  ];

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
      <div className="border border-[#D1D5DB] rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <span className="font-medium text-[#374151]">{bonification.nombre}</span>
              <span className="text-sm text-[#6B7280]">
                -{formatSpanishNumber(bonification.reduccionPuntosPorcentuales * 100, 2)}%
              </span>
              {bonification.costeAnualEstimado && bonification.costeAnualEstimado > 0 && (
                <span className="text-sm text-[#DC2626]">
                  ~{bonification.costeAnualEstimado}€/año
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-[#6B7280] hover:text-[#374151] text-sm"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-[#DC2626] hover:text-[#B91C1C]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#D1D5DB] rounded-lg p-4 bg-[#F9FAFB]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-[#374151]">
          {bonification.nombre || 'Nueva bonificación'}
        </h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-[#DC2626] hover:text-[#B91C1C]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preset options */}
      {!bonification.nombre && (
        <div className="mb-4 p-3 bg-white rounded border">
          <p className="text-sm font-medium text-[#374151] mb-2">Bonificaciones habituales:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {getPresetBonifications().map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-left p-2 text-sm border rounded hover:bg-[#F3F4F6] transition-colors"
              >
                <div className="font-medium">{preset.nombre}</div>
                <div className="text-[#6B7280]">
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
          <label className="block text-sm font-medium text-[#374151] mb-1">
            Nombre *
          </label>
          <input
            type="text"
            value={bonification.nombre}
            onChange={(e) => handleFieldChange('nombre', e.target.value)}
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
            placeholder="ej: Nómina"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1">
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
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
            placeholder="0,300"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            ej: 0,300 = 0,30 puntos porcentuales
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1">
            Período de revisión (meses)
          </label>
          <input
            type="number"
            value={bonification.lookbackMeses}
            onChange={(e) => handleFieldChange('lookbackMeses', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
            placeholder="3"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1">
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
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
            placeholder="240"
          />
        </div>
      </div>

      {/* Rule configuration */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-[#374151] mb-2">
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
              case 'TARJETA':
                newRule = { tipo: 'TARJETA', movimientosMesMin: 6 };
                break;
              case 'SEGURO_HOGAR':
                newRule = { tipo: 'SEGURO_HOGAR', activo: true };
                break;
              case 'SEGURO_VIDA':
                newRule = { tipo: 'SEGURO_VIDA', activo: true };
                break;
              default:
                newRule = { tipo: 'OTRA', descripcion: '' };
            }
            
            handleRuleChange(newRule);
          }}
          className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
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
            <label className="block text-sm font-medium text-[#374151] mb-1">
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
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
              placeholder="1.200"
            />
          </div>
        )}

        {bonification.regla.tipo === 'TARJETA' && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Movimientos mínimos por mes
            </label>
            <input
              type="number"
              value={bonification.regla.movimientosMesMin}
              onChange={(e) => handleRuleChange({
                tipo: 'TARJETA',
                movimientosMesMin: parseInt(e.target.value)
              })}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
              placeholder="6"
              min="0"
            />
          </div>
        )}

        {bonification.regla.tipo === 'OTRA' && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Descripción de la regla
            </label>
            <textarea
              value={bonification.regla.descripcion}
              onChange={(e) => handleRuleChange({
                tipo: 'OTRA',
                descripcion: e.target.value
              })}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
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
          className="px-3 py-1 text-sm text-[#6B7280] hover:text-[#374151]"
        >
          Minimizar
        </button>
      </div>
    </div>
  );
};

export default BonificationForm;