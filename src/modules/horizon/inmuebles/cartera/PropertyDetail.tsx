import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, PencilIcon, DocumentIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { Property, initDB } from '../../../../services/db';
import { formatEuro, formatDate, formatInteger } from '../../../../utils/formatUtils';
import { getITPRateForCCAA } from '../../../../utils/locationUtils';
import toast from 'react-hot-toast';

const PropertyDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProperty = useCallback(async (propertyId: number) => {
    try {
      setLoading(true);
      const db = await initDB();
      const prop = await db.get('properties', propertyId);
      
      if (prop) {
        setProperty(prop);
      } else {
        toast.error('Inmueble no encontrado');
        navigate('/inmuebles/cartera');
      }
    } catch (error) {
      console.error('Error loading property:', error);
      toast.error('Error al cargar el inmueble');
      navigate('/inmuebles/cartera');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (id) {
      loadProperty(parseInt(id));
    }
  }, [id, loadProperty]);

  const calculateTotalCost = (prop: Property): number => {
    const costs = prop.acquisitionCosts;
    return costs.price +
           (costs.itp || 0) +
           (costs.iva || 0) +
           (costs.notary || 0) +
           (costs.registry || 0) +
           (costs.management || 0) +
           (costs.psi || 0) +
           (costs.realEstate || 0) +
           (costs.other?.reduce((sum, item) => sum + item.amount, 0) || 0);
  };

  const calculatePricePerSqm = (prop: Property): number => {
    const totalCost = calculateTotalCost(prop);
    return prop.squareMeters > 0 ? totalCost / prop.squareMeters : 0;
  };

  const copyEmailAlias = () => {
    if (property) {
      // Generate email alias based on property alias (simplified)
      const emailAlias = `inmueble-${property.alias.toLowerCase().replace(/\s+/g, '-')}-${property.id}@inbound.atlas.app`;
      navigator.clipboard.writeText(emailAlias);
      toast.success('Alias de email copiado al portapapeles');
    }
  };

  const viewDocuments = () => {
    if (property) {
      // Navigate to inbox filtered by this property
      navigate(`/inbox?destino=inmueble-${property.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-neutral-600">Cargando inmueble...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-neutral-600">Inmueble no encontrado</div>
      </div>
    );
  }

  const totalCost = calculateTotalCost(property);
  const pricePerSqm = calculatePricePerSqm(property);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/inmuebles/cartera')}
            className="p-2 text-neutral-600 hover:text-neutral-800 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{property.alias}</h1>
            <p className="text-neutral-600">{property.address}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/inmuebles/cartera/${property.id}/editar`)}
          className="flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors"
        >
          <PencilIcon className="h-5 w-5 mr-2" />
          Editar
        </button>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Resumen</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Alias</dt>
              <dd className="mt-1 text-sm text-neutral-900">{property.alias}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Dirección</dt>
              <dd className="mt-1 text-sm text-neutral-900">{property.address}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Ubicación</dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {property.ccaa} · {property.province} · {property.municipality} · {property.postalCode}
              </dd>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Fecha de compra</dt>
              <dd className="mt-1 text-sm text-neutral-900">{formatDate(property.purchaseDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Superficie</dt>
              <dd className="mt-1 text-sm text-neutral-900">{formatInteger(property.squareMeters)} m²</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Composición</dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {formatInteger(property.bedrooms)} habitaciones · {formatInteger(property.bathrooms)} baños
              </dd>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Estado</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  property.state === 'activo' 
                    ? 'bg-green-100 text-green-800'
                    : property.state === 'vendido'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-neutral-100 text-neutral-800'
                }`}>
                  {property.state.charAt(0).toUpperCase() + property.state.slice(1)}
                </span>
              </dd>
            </div>
            {property.cadastralReference && (
              <div>
                <dt className="text-sm font-medium text-neutral-500">Referencia catastral</dt>
                <dd className="mt-1 text-sm text-neutral-900 font-mono">{property.cadastralReference}</dd>
              </div>
            )}
            {property.notes && (
              <div>
                <dt className="text-sm font-medium text-neutral-500">Notas</dt>
                <dd className="mt-1 text-sm text-neutral-900">{property.notes}</dd>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Costes de adquisición */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Costes de adquisición</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between py-2">
            <span className="text-sm text-neutral-600">Precio de compra</span>
            <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.price)}</span>
          </div>

          {property.transmissionRegime === 'usada' && property.acquisitionCosts.itp && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">
                ITP ({getITPRateForCCAA(property.ccaa)}% {property.ccaa})
                {property.acquisitionCosts.itpIsManual && (
                  <span className="ml-2 bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded text-xs">Manual</span>
                )}
              </span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.itp)}</span>
            </div>
          )}

          {property.transmissionRegime === 'obra-nueva' && property.acquisitionCosts.iva && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">IVA</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.iva)}</span>
            </div>
          )}

          {property.acquisitionCosts.notary && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Notaría</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.notary)}</span>
            </div>
          )}

          {property.acquisitionCosts.registry && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Registro</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.registry)}</span>
            </div>
          )}

          {property.acquisitionCosts.management && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Gestoría</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.management)}</span>
            </div>
          )}

          {property.acquisitionCosts.psi && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">PSI (personal shopper)</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.psi)}</span>
            </div>
          )}

          {property.acquisitionCosts.realEstate && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Inmobiliaria</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.realEstate)}</span>
            </div>
          )}

          {property.acquisitionCosts.other?.map((item, index) => (
            <div key={index} className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">{item.concept}</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(item.amount)}</span>
            </div>
          ))}

          <div className="border-t pt-3 mt-4">
            <div className="flex justify-between py-2">
              <span className="text-base font-semibold text-neutral-900">Coste total</span>
              <span className="text-base font-semibold text-neutral-900">{formatEuro(totalCost)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-sm text-neutral-600">€/m²</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(pricePerSqm)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CAPEX (placeholder for H5) */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">CAPEX</h3>
        <div className="flex justify-between py-2">
          <span className="text-sm text-neutral-600">CAPEX (acumulado)</span>
          <span className="text-sm text-neutral-500">—</span>
        </div>
        <p className="text-xs text-neutral-500 mt-2">El cálculo de CAPEX se implementará en H5</p>
      </div>

      {/* Atajos */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Atajos</h3>
        
        <div className="space-y-3">
          <button
            onClick={viewDocuments}
            className="flex items-center w-full p-3 text-left border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
          >
            <DocumentIcon className="h-5 w-5 text-brand-navy mr-3" />
            <div>
              <div className="text-sm font-medium text-neutral-900">Ver documentos de este inmueble</div>
              <div className="text-xs text-neutral-500">Abre la bandeja filtrada por este inmueble</div>
            </div>
          </button>

          <button
            onClick={copyEmailAlias}
            className="flex items-center w-full p-3 text-left border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
          >
            <ClipboardDocumentIcon className="h-5 w-5 text-brand-navy mr-3" />
            <div>
              <div className="text-sm font-medium text-neutral-900">Copiar alias de email del inmueble</div>
              <div className="text-xs text-neutral-500">Copia la dirección de email para envío de documentos</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;