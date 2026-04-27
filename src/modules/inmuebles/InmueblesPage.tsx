import React, { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { initDB } from '../../services/db';
import type { Property, Contract } from '../../services/db';
import type { InmueblesOutletContext } from './InmueblesContext';
import styles from './InmueblesPage.module.css';

const InmueblesPage: React.FC = () => {
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
    <div className={styles.page}>
      <Outlet context={ctx} />
    </div>
  );
};

export default InmueblesPage;
export { InmueblesPage };
