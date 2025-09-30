/**
 * Demo page to showcase the color-coded movement display requirements
 */

import React from 'react';
import { MovementStatusChip } from '../components/treasury/MovementStatusChip';

const ColorCodedMovementDemo: React.FC = () => {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Color-Coded Movement Display Demo
        </h1>
        
        <div className="bg-white shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">✅ Requirements Implementation</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Movement Status Colors */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Movement Status (Colors Only)</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <MovementStatusChip status="previsto" movementType="Gasto" />
                  <span className="text-sm">Red: Expense (Gasto) - Previsto</span>
                </div>
                <div className="flex items-center gap-3">
                  <MovementStatusChip status="previsto" movementType="Ingreso" />
                  <span className="text-sm">Green: Income (Ingreso) - Previsto</span>
                </div>
                <div className="flex items-center gap-3">
                  <MovementStatusChip status="confirmado" movementType="Gasto" />
                  <span className="text-sm">Blue: Confirmed (Realizado)</span>
                </div>
                <div className="flex items-center gap-3">
                  <MovementStatusChip status="no_planificado" movementType="Gasto" />
                  <span className="text-sm">Gray: Unplanned (No planificado)</span>
                </div>
                <div className="flex items-center gap-3">
                  <MovementStatusChip status="conciliado" movementType="Ingreso" />
                  <span className="text-sm">Blue: Reconciled (Conciliado)</span>
                </div>
              </div>
            </div>

            {/* Account Format */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Account Name Format</h3>
              <div className="space-y-2 text-sm">
                <div className="font-mono bg-gray-100 p-2 rounded">
                  <span className="text-red-600 line-through">Before: Santander - Cuenta Corriente (**1234)</span>
                </div>
                <div className="btn-accent-horizon font-mono p-2 rounded">
                  <span className="text-green-700">✅ After: Santander · 1234</span>
                </div>
                <div className="btn-accent-horizon font-mono p-2 rounded">
                  <span className="text-green-700">✅ After: BBVA · 5678</span>
                </div>
                <div className="btn-accent-horizon font-mono p-2 rounded">
                  <span className="text-green-700">✅ After: CaixaBank · 9012</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Movement Categories */}
        <div className="bg-white shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Movement Categories (Conceptos)</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Supported Concepts</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="btn-primary-horizon w-3 h-3"></span>
                  <span><strong>Luz</strong> (Light/Electricity)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="btn-primary-horizon w-3 h-3"></span>
                  <span><strong>Agua</strong> (Water)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="btn-primary-horizon w-3 h-3"></span>
                  <span><strong>Telco</strong> (Telecommunications)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="btn-primary-horizon w-3 h-3"></span>
                  <span><strong>Alquiler</strong> (Rent)</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Auto-Detection Examples</h3>
              <div className="space-y-1 text-xs font-mono bg-gray-50 p-3 rounded">
                <div>"Factura luz" → Suministros › Luz</div>
                <div>"Endesa electricidad" → Suministros › Luz</div>
                <div>"Aqualia agua" → Suministros › Agua</div>
                <div>"Movistar fibra" → Suministros › Telco</div>
                <div>"Vodafone teléfono" → Suministros › Telco</div>
                <div>"Pago alquiler" → Alquiler › Ingresos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Movement Table */}
        <div className="bg-white shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Sample Movement Display</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Concepto</th>
                  <th className="text-right p-3">Importe</th>
                  <th className="text-left p-3">Cuenta</th>
                  <th className="text-center p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">15/09/2025</td>
                  <td className="p-3">Luz</td>
                  <td className="p-3 text-right text-red-600 font-medium">-85.50 €</td>
                  <td className="p-3">Santander · 1234</td>
                  <td className="p-3 text-center">
                    <MovementStatusChip status="confirmado" movementType="Gasto" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">14/09/2025</td>
                  <td className="p-3">Agua</td>
                  <td className="p-3 text-right text-red-600 font-medium">-45.20 €</td>
                  <td className="p-3">BBVA · 5678</td>
                  <td className="p-3 text-center">
                    <MovementStatusChip status="previsto" movementType="Gasto" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">13/09/2025</td>
                  <td className="p-3">Alquiler</td>
                  <td className="p-3 text-right text-green-600 font-medium">+1,200.00 €</td>
                  <td className="p-3">CaixaBank · 9012</td>
                  <td className="p-3 text-center">
                    <MovementStatusChip status="previsto" movementType="Ingreso" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">12/09/2025</td>
                  <td className="p-3">Telco</td>
                  <td className="p-3 text-right text-red-600 font-medium">-55.99 €</td>
                  <td className="p-3">Santander · 1234</td>
                  <td className="p-3 text-center">
                    <MovementStatusChip status="no_planificado" movementType="Gasto" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center">
          ✅ All requirements from problem statement implemented:
          Colors only (no text labels) • Bank · 4digits format • Luz/Agua/Telco/Alquiler concepts
        </div>
      </div>
    </div>
  );
};

export default ColorCodedMovementDemo;