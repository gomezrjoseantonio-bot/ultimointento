import React, { useState, useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import { PresupuestoLinea, TipoLinea, CategoriaGasto, CategoriaIngreso, FrecuenciaPago, OrigenLinea } from '../../../../../services/db';
import { generarCalendarioLinea, validarLinea } from '../services/presupuestoService';

interface PresupuestoLineaModalProps {
  linea?: PresupuestoLinea | null;
  year: number;
  onSave: (linea: Omit<PresupuestoLinea, 'id'>) => void;
  onCancel: () => void;
}

const PresupuestoLineaModal: React.FC<PresupuestoLineaModalProps> = ({
  linea,
  year,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Omit<PresupuestoLinea, 'id'>>({
    presupuestoId: '',
    tipo: 'Gasto',
    inmuebleId: '',
    categoria: undefined,
    tipoConcepto: '',
    proveedor: '',
    proveedorNif: '',
    cuentaId: '',
    frecuencia: 'Mensual',
    dayOfMonth: 1,
    mesesActivos: [],
    fechaUnica: '',
    importeUnitario: 0,
    ivaIncluido: true,
    desde: '',
    hasta: '',
    origen: 'ManualUsuario',
    editable: true,
    notas: '',
    contratoId: '',
    prestamoId: ''
  });

  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (linea) {
      setFormData({
        presupuestoId: linea.presupuestoId,
        tipo: linea.tipo,
        inmuebleId: linea.inmuebleId || '',
        roomId: linea.roomId,
        categoria: linea.categoria,
        tipoConcepto: linea.tipoConcepto || '',
        proveedor: linea.proveedor || '',
        proveedorNif: linea.proveedorNif || '',
        cuentaId: linea.cuentaId || '',
        frecuencia: linea.frecuencia,
        dayOfMonth: linea.dayOfMonth,
        mesesActivos: linea.mesesActivos || [],
        fechaUnica: linea.fechaUnica || '',
        importeUnitario: linea.importeUnitario,
        ivaIncluido: linea.ivaIncluido !== false,
        desde: linea.desde || '',
        hasta: linea.hasta || '',
        origen: linea.origen,
        editable: linea.editable,
        notas: linea.notas || '',
        contratoId: linea.contratoId || '',
        prestamoId: linea.prestamoId || ''
      });
    }
  }, [linea]);

  const categoriasGasto: CategoriaGasto[] = [
    "Suministros", "Seguros", "Comunidad", "IBI", "InteresesHipoteca",
    "CuotaHipoteca", "ReparaciónYConservación", "Mantenimiento", 
    "Honorarios", "Tasas", "OtrosGastos", "Mejora", "Mobiliario"
  ];

  const categoriasIngreso: CategoriaIngreso[] = [
    "Alquiler", "OtrosIngresos"
  ];

  const frecuencias: FrecuenciaPago[] = [
    "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "Unico"
  ];

  const suministrosSubtipos = [
    "Electricidad", "Agua", "Gas", "Internet", "TV"
  ];

  const handleSubmit = () => {
    const validationErrors = validarLinea(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(formData);
  };

  const updateField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]); // Clear errors when user makes changes
  };

  const generatePreview = () => {
    if (!formData.importeUnitario || !formData.frecuencia) return [];
    
    const lineaTemp: PresupuestoLinea = {
      ...formData,
      id: 'temp'
    };
    
    return generarCalendarioLinea(lineaTemp, year);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {linea ? 'Editar Línea' : 'Añadir Línea'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-medium text-red-800 mb-2">Errores de validación:</h3>
              <ul className="text-sm text-red-700 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo *
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => updateField('tipo', e.target.value as TipoLinea)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="Ingreso">Ingreso</option>
                  <option value="Gasto">Gasto</option>
                </select>
              </div>

              {/* Inmueble */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inmueble
                </label>
                <select
                  value={formData.inmuebleId || ''}
                  onChange={(e) => updateField('inmuebleId', e.target.value || undefined)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Global</option>
                  <option value="prop-1">Inmueble 1</option>
                  <option value="prop-2">Inmueble 2</option>
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría *
                </label>
                <select
                  value={formData.categoria || ''}
                  onChange={(e) => updateField('categoria', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Seleccionar categoría</option>
                  {formData.tipo === 'Gasto' 
                    ? categoriasGasto.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    : categoriasIngreso.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                  }
                </select>
              </div>

              {/* Tipo de concepto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Concepto *
                </label>
                {formData.categoria === 'Suministros' ? (
                  <select
                    value={formData.tipoConcepto}
                    onChange={(e) => updateField('tipoConcepto', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Seleccionar suministro</option>
                    {suministrosSubtipos.map(subtipo => (
                      <option key={subtipo} value={subtipo}>{subtipo}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.tipoConcepto}
                    onChange={(e) => updateField('tipoConcepto', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Ej: Seguro hogar, Renta habitación 1"
                  />
                )}
              </div>

              {/* Proveedor (si es gasto) */}
              {formData.tipo === 'Gasto' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Proveedor
                    </label>
                    <input
                      type="text"
                      value={formData.proveedor}
                      onChange={(e) => updateField('proveedor', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Nombre del proveedor"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NIF Proveedor
                    </label>
                    <input
                      type="text"
                      value={formData.proveedorNif}
                      onChange={(e) => updateField('proveedorNif', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="NIF del proveedor"
                    />
                  </div>
                </>
              )}

              {/* Cuenta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cuenta
                </label>
                <select
                  value={formData.cuentaId}
                  onChange={(e) => updateField('cuentaId', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Pendiente de asignar</option>
                  <option value="cuenta-1">Cuenta Principal</option>
                  <option value="cuenta-2">Cuenta Secundaria</option>
                </select>
                {!formData.cuentaId && (
                  <p className="text-xs text-orange-600 mt-1">
                    Se recomienda asignar una cuenta para proyección de tesorería
                  </p>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Frecuencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frecuencia *
                </label>
                <select
                  value={formData.frecuencia}
                  onChange={(e) => updateField('frecuencia', e.target.value as FrecuenciaPago)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {frecuencias.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>

              {/* Día del mes / Fecha única */}
              {formData.frecuencia === 'Unico' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Única *
                  </label>
                  <input
                    type="date"
                    value={formData.fechaUnica}
                    onChange={(e) => updateField('fechaUnica', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Día del Mes
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.dayOfMonth || ''}
                    onChange={(e) => updateField('dayOfMonth', parseInt(e.target.value) || undefined)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="1-28"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Recomendado 1-28 para evitar problemas con meses cortos
                  </p>
                </div>
              )}

              {/* Importe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importe Unitario (€) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.importeUnitario}
                  onChange={(e) => updateField('importeUnitario', parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>

              {/* IVA Incluido */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.ivaIncluido}
                    onChange={(e) => updateField('ivaIncluido', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">IVA Incluido</span>
                </label>
              </div>

              {/* Vigencia */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={formData.desde}
                    onChange={(e) => updateField('desde', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={formData.hasta}
                    onChange={(e) => updateField('hasta', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => updateField('notas', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
          </div>

          {/* Vista previa del schedule */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Vista Previa del Schedule</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-800"
              >
                <Eye className="h-4 w-4" />
                <span>{showPreview ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>

            {showPreview && (
              <div className="bg-gray-50 p-4 rounded-lg">
                {generatePreview().length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {generatePreview().map((evento, index) => (
                      <div key={index} className="bg-white p-2 rounded border text-sm">
                        <div className="font-medium">{new Date(evento.fecha).toLocaleDateString()}</div>
                        <div className="text-gray-600">{formatCurrency(evento.importe)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Completa los campos requeridos para ver la vista previa
                  </p>
                )}
                
                <div className="mt-3 text-sm text-gray-600">
                  Total eventos: {generatePreview().length} • 
                  Suma total: {formatCurrency(generatePreview().reduce((sum, evento) => sum + evento.importe, 0))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {linea ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresupuestoLineaModal;