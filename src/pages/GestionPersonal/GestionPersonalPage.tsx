import React, { useState, useEffect, useCallback } from 'react';
import GestionPersonalHeader from './components/GestionPersonalHeader';
import TabIngresos from './components/TabIngresos';
import TabGastos from './components/TabGastos';
import { personalDataService } from '../../services/personalDataService';
import { nominaService } from '../../services/nominaService';
import { autonomoService } from '../../services/autonomoService';
import { pensionService } from '../../services/pensionService';
import { otrosIngresosService } from '../../services/otrosIngresosService';
import { personalExpensesService } from '../../services/personalExpensesService';
import { prestamosService } from '../../services/prestamosService';
import type {
  PersonalData,
  Nomina,
  Autonomo,
  PensionIngreso,
  OtrosIngresos,
  PersonalExpense,
  CalculoNominaResult,
} from '../../types/personal';
import type { Prestamo } from '../../types/prestamos';

export interface GestionPersonalData {
  perfil: PersonalData;
  nominas: Nomina[];
  autonomos: Autonomo[];
  pensiones: PensionIngreso[];
  otrosIngresos: OtrosIngresos[];
  expenses: PersonalExpense[];
  prestamosPersonales: Prestamo[];
  // Calculated
  nominaCalcs: Map<number, CalculoNominaResult>;
}

const GestionPersonalPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GestionPersonalData | null>(null);
  const [tab, setTab] = useState<'ingresos' | 'gastos'>('ingresos');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const perfil = await personalDataService.getPersonalData();
      if (!perfil?.id) {
        setData(null);
        setLoading(false);
        return;
      }

      const pid = perfil.id;
      const [nominas, autonomos, pensiones, otrosIngresos, expenses, allPrestamos] =
        await Promise.all([
          nominaService.getNominas(pid),
          autonomoService.getAutonomosActivos(pid),
          pensionService.getPensiones(pid),
          otrosIngresosService.getOtrosIngresos(pid),
          personalExpensesService.getExpenses(pid),
          prestamosService.getAllPrestamos(),
        ]);

      const prestamosPersonales = allPrestamos.filter(
        (p) => (p.ambito === 'PERSONAL' || p.finalidad === 'PERSONAL') && p.activo !== false,
      );

      const nominaCalcs = new Map<number, CalculoNominaResult>();
      for (const n of nominas.filter((n) => n.activa)) {
        if (n.id != null) {
          nominaCalcs.set(n.id, nominaService.calculateSalary(n));
        }
      }

      setData({
        perfil,
        nominas: nominas.filter((n) => n.activa),
        autonomos,
        pensiones: pensiones.filter((p) => p.activa),
        otrosIngresos,
        expenses,
        prestamosPersonales,
        nominaCalcs,
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <div
          className="animate-spin"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid var(--navy-900)',
            borderTopColor: 'transparent',
          }}
        />
        <span style={{ marginLeft: 8, color: 'var(--grey-500)' }}>Cargando...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--grey-500)', fontSize: 14 }}>
          Configura tu perfil personal para ver esta sección.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <GestionPersonalHeader data={data} tab={tab} onTabChange={setTab} />
      <div style={{ padding: '24px 32px', maxWidth: 1280 }}>
        {tab === 'ingresos' ? (
          <TabIngresos data={data} onDataChange={loadData} />
        ) : (
          <TabGastos data={data} onDataChange={loadData} />
        )}
      </div>
    </div>
  );
};

export default GestionPersonalPage;
