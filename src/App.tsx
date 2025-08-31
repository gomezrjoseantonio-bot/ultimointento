import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import InboxPage from './pages/InboxPage';

// Horizon (Investment) Module Components
import HorizonPanel from './modules/horizon/panel/Panel';
import Cartera from './modules/horizon/inmuebles/cartera/Cartera';
import Contratos from './modules/horizon/inmuebles/contratos/Contratos';
import Prestamos from './modules/horizon/inmuebles/prestamos/Prestamos';
import Analisis from './modules/horizon/inmuebles/analisis/Analisis';
import TesRadar from './modules/horizon/tesoreria/radar/Radar';
import TesMovimientos from './modules/horizon/tesoreria/movimientos/Movimientos';
import Automatizaciones from './modules/horizon/tesoreria/automatizaciones/Automatizaciones';
import TesAlertas from './modules/horizon/tesoreria/alertas/Alertas';
import FisResumen from './modules/horizon/fiscalidad/resumen/Resumen';
import Deducibles from './modules/horizon/fiscalidad/deducibles/Deducibles';
import Declaraciones from './modules/horizon/fiscalidad/declaraciones/Declaraciones';
import ProyeccionCartera from './modules/horizon/proyeccion/cartera/ProyeccionCartera';
import ProyeccionConsolidado from './modules/horizon/proyeccion/consolidado/ProyeccionConsolidado';
import BancosCuentas from './modules/horizon/configuracion/bancos-cuentas/BancosCuentas';
import PlanFacturacion from './modules/horizon/configuracion/plan-facturacion/PlanFacturacion';
import UsuariosRoles from './modules/horizon/configuracion/usuarios-roles/UsuariosRoles';

// Pulse (Personal) Module Components
import PulsePanel from './modules/pulse/panel/Panel';
import IngresosLista from './modules/pulse/ingresos/lista/IngresosLista';
import IngresosNuevo from './modules/pulse/ingresos/nuevo/IngresosNuevo';
import IngresosImportar from './modules/pulse/ingresos/importar/IngresosImportar';
import GastosLista from './modules/pulse/gastos/lista/GastosLista';
import GastosNuevo from './modules/pulse/gastos/nuevo/GastosNuevo';
import GastosReglas from './modules/pulse/gastos/reglas/GastosReglas';
import TPRadar from './modules/pulse/tesoreria-personal/radar/TPRadar';
import TPMovimientos from './modules/pulse/tesoreria-personal/movimientos/TPMovimientos';
import TPAlertas from './modules/pulse/tesoreria-personal/alertas/TPAlertas';
import PPPresupuesto from './modules/pulse/proyeccion-personal/presupuesto/PPPresupuesto';
import PPEscenarios from './modules/pulse/proyeccion-personal/escenarios/PPEscenarios';
import PulsePreferenciasDatos from './modules/pulse/configuracion/preferencias-datos/PulsePreferenciasDatos';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/panel" replace />} />
            <Route path="panel" element={<Dashboard />} />
            <Route path="inbox" element={<InboxPage />} />
            
            {/* Horizon (Investment) Routes */}
            <Route path="inmuebles">
              <Route index element={<HorizonPanel />} />
              <Route path="cartera" element={<Cartera />} />
              <Route path="contratos" element={<Contratos />} />
              <Route path="prestamos" element={<Prestamos />} />
              <Route path="analisis" element={<Analisis />} />
            </Route>
            
            <Route path="tesoreria">
              <Route index element={<HorizonPanel />} />
              <Route path="radar" element={<TesRadar />} />
              <Route path="movimientos" element={<TesMovimientos />} />
              <Route path="automatizaciones" element={<Automatizaciones />} />
              <Route path="alertas" element={<TesAlertas />} />
            </Route>
            
            <Route path="fiscalidad">
              <Route index element={<HorizonPanel />} />
              <Route path="resumen" element={<FisResumen />} />
              <Route path="deducibles" element={<Deducibles />} />
              <Route path="declaraciones" element={<Declaraciones />} />
            </Route>
            
            <Route path="proyeccion">
              <Route index element={<HorizonPanel />} />
              <Route path="cartera" element={<ProyeccionCartera />} />
              <Route path="consolidado" element={<ProyeccionConsolidado />} />
            </Route>
            
            {/* Pulse (Personal) Routes */}
            <Route path="ingresos">
              <Route index element={<PulsePanel />} />
              <Route path="lista" element={<IngresosLista />} />
              <Route path="nuevo" element={<IngresosNuevo />} />
              <Route path="importar" element={<IngresosImportar />} />
            </Route>
            
            <Route path="gastos">
              <Route index element={<PulsePanel />} />
              <Route path="lista" element={<GastosLista />} />
              <Route path="nuevo" element={<GastosNuevo />} />
              <Route path="reglas" element={<GastosReglas />} />
            </Route>
            
            <Route path="tesoreria-personal">
              <Route index element={<PulsePanel />} />
              <Route path="radar" element={<TPRadar />} />
              <Route path="movimientos" element={<TPMovimientos />} />
              <Route path="alertas" element={<TPAlertas />} />
            </Route>
            
            <Route path="proyeccion-personal">
              <Route index element={<PulsePanel />} />
              <Route path="presupuesto" element={<PPPresupuesto />} />
              <Route path="escenarios" element={<PPEscenarios />} />
            </Route>
            
            {/* Shared Configuration Routes */}
            <Route path="configuracion">
              <Route index element={<HorizonPanel />} />
              {/* Horizon configuration */}
              <Route path="bancos-cuentas" element={<BancosCuentas />} />
              <Route path="plan-facturacion" element={<PlanFacturacion />} />
              <Route path="usuarios-roles" element={<UsuariosRoles />} />
              <Route path="preferencias-datos" element={<PulsePreferenciasDatos />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;