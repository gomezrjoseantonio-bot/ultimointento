import React from 'react';
// Temporarily commented out for bundle optimization testing
// import MovimientosV1 from './MovimientosV1';

const Movimientos: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Movimientos</h1>
      <p className="text-gray-600">
        Funcionalidad temporalmente simplificada para demostrar optimizaciones de bundle.
      </p>
      <p className="text-sm text-gray-500 mt-2">
        Las dependencias pesadas (xlsx, jszip) ahora se cargan dinámicamente solo cuando se necesitan.
      </p>
    </div>
  );
};

export default Movimientos;