import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { initDB } from '../../services/db';
import type { Property, Contract } from '../../services/db';
import type { InmueblesOutletContext } from './InmueblesContext';
import styles from './InmueblesPage.module.css';

const InmueblesPage: React.FC = () => {
  const { pathname } = useLocation();
  // FIX § 1.1 · la lista de Contratos se renderiza full-bleed para que su
  // persistent-bar (banda navy) llegue al borde superior y al sidebar. El resto
  // de rutas (cartera, detalle, wizard) conservan el contenedor con padding.
  const isContratosFullBleed = pathname === '/contratos' || pathname === '/contratos/lista';

  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const load = useCallback(async () => {
    try {
      const db = await initDB();
      const [props, ctcs] = await Promise.all([
        db.getAll('properties') as Promise<Property[]>,
        db.getAll('contracts') as Promise<Contract[]>,
      ]);
      setProperties(props.filter((p) => p.state === 'activo'));
      setContracts(ctcs);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inmuebles] error cargando datos', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ctx: InmueblesOutletContext = {
    properties,
    contracts,
    reload: () => {
      load();
    },
  };

  return (
    <div className={isContratosFullBleed ? styles.pageFullBleed : styles.page}>
      <Outlet context={ctx} />
    </div>
  );
};

export default InmueblesPage;
export { InmueblesPage };
