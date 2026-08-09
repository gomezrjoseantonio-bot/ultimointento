import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Consolidación Contratos → Alquileres · Fase B · alias de ruta.
 *
 * La marca visual del módulo es "Alquileres", pero la ruta canónica sigue
 * siendo `/contratos` (no se renombra la ruta · spec §3/§12.5). Este componente
 * redirige cualquier `/alquileres[/sufijo]` a su equivalente
 * `/contratos[/sufijo]` conservando:
 *   · el sufijo de ruta (`/alquileres/nuevo` → `/contratos/nuevo`), y
 *   · el query string (`?tab=vigentes`, `?inmueble=3`), que `<Navigate>` no
 *     preserva por defecto.
 *
 * Se monta bajo `path="alquileres/*"`, por lo que cubre la raíz y todas las
 * sub-rutas de la sección con una sola entrada.
 */
export const RedirectAlquileresAContratos: React.FC = () => {
  const location = useLocation();
  const resto = location.pathname.replace(/^\/alquileres/, '');
  return <Navigate to={`/contratos${resto}${location.search}`} replace />;
};

export default RedirectAlquileresAContratos;
