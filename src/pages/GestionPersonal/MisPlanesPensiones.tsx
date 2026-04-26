// src/pages/GestionPersonal/MisPlanesPensiones.tsx
// TAREA 13: Pantalla principal del módulo de planes de pensiones

import React, { useEffect, useState } from 'react';
import { planesPensionesService } from '../../services/planesPensionesService';
import type { PlanPensiones, TipoAdministrativo, EstadoPlan } from '../../types/planesPensiones';

const TIPO_LABELS: Record<TipoAdministrativo, string> = {
  PPI: 'PPI',
  PPE: 'PPE',
  PPES: 'PPES',
  PPA: 'PPA',
};

const TIPO_COLORS: Record<TipoAdministrativo, string> = {
  PPI: 'bg-blue-100 text-blue-800',
  PPE: 'bg-green-100 text-green-800',
  PPES: 'bg-purple-100 text-purple-800',
  PPA: 'bg-yellow-100 text-yellow-800',
};

interface PlanConTotales extends PlanPensiones {
  totalAportado: number;
}

interface MisPlanesPensionesProps {
  personalDataId: number;
}

export const MisPlanesPensiones: React.FC<MisPlanesPensionesProps> = ({ personalDataId }) => {
  const [planes, setPlanes] = useState<PlanConTotales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTitular, setFiltroTitular] = useState<'todos' | 'yo' | 'pareja'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoAdministrativo>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoPlan>('todos');

  const añoActual = new Date().getFullYear();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    planesPensionesService
      .getAllPlanes({ personalDataId })
      .then(async (planesRaw) => {
        const conTotales = await Promise.all(
          planesRaw.map(async (p) => {
            const totales = await planesPensionesService.getAportacionesAcumuladasTotal(p.id);
            return { ...p, totalAportado: totales.total };
          }),
        );
        if (mounted) setPlanes(conTotales);
      })
      .catch((e) => {
        if (mounted) setError(String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [personalDataId]);

  const planesFiltrados = planes.filter((p) => {
    if (filtroTitular !== 'todos' && p.titular !== filtroTitular) return false;
    if (filtroTipo !== 'todos' && p.tipoAdministrativo !== filtroTipo) return false;
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
    return true;
  });

  const resumenFiscal = {
    totalAportado: planesFiltrados.reduce((s, p) => s + p.totalAportado, 0),
    valorTotal: planesFiltrados.reduce((s, p) => s + (p.valorActual ?? 0), 0),
    numPlanes: planesFiltrados.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-gray-500">Cargando planes de pensiones…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-600">Error al cargar los planes: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mis Planes de Pensiones</h2>
          <p className="text-sm text-gray-500 mt-1">
            {resumenFiscal.numPlanes} plan{resumenFiscal.numPlanes !== 1 ? 'es' : ''}
            {' · '}Valor total: {resumenFiscal.valorTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          onClick={() => { /* TODO: abrir wizard nuevo plan */ }}
        >
          + Nuevo plan
        </button>
      </div>

      {/* Resumen fiscal */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-indigo-800 mb-2">
          Resumen fiscal {añoActual}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-indigo-600">Total aportado (acumulado)</p>
            <p className="text-lg font-bold text-indigo-900">
              {resumenFiscal.totalAportado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-indigo-600">Valor actual cartera</p>
            <p className="text-lg font-bold text-indigo-900">
              {resumenFiscal.valorTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-indigo-600">Límite deducción PPI/PPA</p>
            <p className="text-lg font-bold text-indigo-900">1.500 €</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-gray-500 mr-1">Titular:</label>
          <select
            className="text-sm border rounded px-2 py-1"
            value={filtroTitular}
            onChange={(e) => setFiltroTitular(e.target.value as any)}
          >
            <option value="todos">Todos</option>
            <option value="yo">Yo</option>
            <option value="pareja">Pareja</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mr-1">Tipo:</label>
          <select
            className="text-sm border rounded px-2 py-1"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as any)}
          >
            <option value="todos">Todos</option>
            <option value="PPI">PPI</option>
            <option value="PPE">PPE</option>
            <option value="PPES">PPES</option>
            <option value="PPA">PPA</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mr-1">Estado:</label>
          <select
            className="text-sm border rounded px-2 py-1"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="rescatado_total">Rescatado total</option>
            <option value="rescatado_parcial">Rescatado parcial</option>
            <option value="traspasado_externo">Traspasado</option>
          </select>
        </div>
      </div>

      {/* Lista de planes */}
      {planesFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No hay planes de pensiones que coincidan con los filtros.</p>
          <button
            className="mt-3 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            onClick={() => { /* TODO: abrir wizard */ }}
          >
            Añadir primer plan →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {planesFiltrados.map((plan) => (
            <div
              key={plan.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">{plan.nombre}</h4>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[plan.tipoAdministrativo]}`}
                    >
                      {TIPO_LABELS[plan.tipoAdministrativo]}
                    </span>
                    {plan.estado !== 'activo' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {plan.estado.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {plan.gestoraActual || 'Gestora no especificada'}
                    {plan.empresaPagadora && (
                      <span className="ml-2 text-indigo-600">· Empresa: {plan.empresaPagadora.nombre}</span>
                    )}
                    <span className="ml-2">· Titular: {plan.titular === 'yo' ? 'Yo' : 'Pareja'}</span>
                  </p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">
                    {(plan.valorActual ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    Aportado: {plan.totalAportado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MisPlanesPensiones;
