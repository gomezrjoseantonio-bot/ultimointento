// src/pages/GestionInmuebles/GestionInmuebleDetail.tsx
// Pantalla B · Shell de la vista individual de inmueble (Gestión)
// Tabs: Ficha · Gastos recurrentes · Reparaciones · Mejoras · Mobiliario

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Pencil, Plus, CircleDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader, { HeaderPrimaryButton, HeaderSecondaryButton } from '../../components/shared/PageHeader';
import { initDB, type Property } from '../../services/db';
import PropertySaleModal from '../../modules/horizon/inmuebles/components/PropertySaleModal';
import FichaTab from './tabs/FichaTab';
import GastosRecurrentesTab from './tabs/GastosRecurrentesTab';
import LineasAnualesTab from './tabs/LineasAnualesTab';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
};

type TabId = 'ficha' | 'gastos' | 'reparaciones' | 'mejoras' | 'mobiliario';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ficha', label: 'Ficha' },
  { id: 'gastos', label: 'Gastos recurrentes' },
  { id: 'reparaciones', label: 'Reparaciones' },
  { id: 'mejoras', label: 'Mejoras' },
  { id: 'mobiliario', label: 'Mobiliario' },
];

const isTab = (v: string | null): v is TabId =>
  v !== null && TABS.some((t) => t.id === v);

const GestionInmuebleDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSaleModal, setShowSaleModal] = useState(false);

  const activeTab: TabId = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'ficha';

  const loadProperty = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const db = await initDB();
      const prop = await db.get('properties', Number(id));
      if (!prop) {
        toast.error('Inmueble no encontrado');
        navigate('/gestion/inmuebles');
        return;
      }
      setProperty(prop);
    } catch (err) {
      console.error('Error cargando inmueble:', err);
      toast.error('Error al cargar el inmueble');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void loadProperty();
  }, [loadProperty]);

  const handleTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'ficha') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.grey50, padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 48, color: C.grey500 }}>Cargando...</div>
      </div>
    );
  }

  if (!property) return null;

  const isSold = property.state === 'vendido';

  // Build contextual primary action per tab
  const primaryAction = (() => {
    if (isSold && activeTab === 'ficha') return null;
    switch (activeTab) {
      case 'ficha':
        return (
          <HeaderPrimaryButton
            icon={Pencil}
            label="Editar"
            onClick={() => navigate(`/gestion/inmuebles/${property.id}/editar`)}
          />
        );
      case 'gastos':
        return (
          <HeaderPrimaryButton
            icon={Plus}
            label="Nueva plantilla"
            onClick={() => window.dispatchEvent(new CustomEvent('gestion-inmueble:new-plantilla'))}
          />
        );
      case 'reparaciones':
        return (
          <HeaderPrimaryButton
            icon={Plus}
            label="Nueva reparación"
            onClick={() => window.dispatchEvent(new CustomEvent('gestion-inmueble:new-reparacion'))}
          />
        );
      case 'mejoras':
        return (
          <HeaderPrimaryButton
            icon={Plus}
            label="Nueva mejora"
            onClick={() => window.dispatchEvent(new CustomEvent('gestion-inmueble:new-mejora'))}
          />
        );
      case 'mobiliario':
        return (
          <HeaderPrimaryButton
            icon={Plus}
            label="Nuevo mobiliario"
            onClick={() => window.dispatchEvent(new CustomEvent('gestion-inmueble:new-mobiliario'))}
          />
        );
    }
  })();

  const actions = (
    <>
      {!isSold && activeTab === 'ficha' && (
        <HeaderSecondaryButton
          icon={CircleDollarSign}
          label="Vender inmueble"
          onClick={() => setShowSaleModal(true)}
        />
      )}
      {primaryAction}
    </>
  );

  const subtitle = [property.address, property.postalCode, property.municipality, property.province]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ minHeight: '100vh', background: C.grey50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/gestion/inmuebles')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: C.grey500,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 12,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <ArrowLeft size={14} /> Inmuebles
        </button>

        <PageHeader
          icon={Building2}
          title={property.alias}
          subtitle={subtitle}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          actions={actions}
        />

        {/* Tab content */}
        {activeTab === 'ficha' && <FichaTab property={property} />}
        {activeTab === 'gastos' && <GastosRecurrentesTab propertyId={property.id!} />}
        {activeTab === 'reparaciones' && (
          <LineasAnualesTab propertyId={property.id!} categoria="reparacion" />
        )}
        {activeTab === 'mejoras' && (
          <LineasAnualesTab propertyId={property.id!} categoria="mejora" />
        )}
        {activeTab === 'mobiliario' && (
          <LineasAnualesTab propertyId={property.id!} categoria="mobiliario" />
        )}
      </div>

      <PropertySaleModal
        open={showSaleModal}
        property={property}
        source="detalle"
        onClose={() => setShowSaleModal(false)}
        onConfirmed={() => {
          setShowSaleModal(false);
          void loadProperty();
        }}
      />
    </div>
  );
};

export default GestionInmuebleDetail;
