import React, { useCallback, useEffect, useState } from 'react';
import { EmptyState, Icons, MoneyValue, Pill } from '../../../../design-system/v5';
import type { PillVariant } from '../../../../design-system/v5';
import type { BoteAnualSinIdentificar } from '../../../../services/db';
import { boteAnualService } from '../../../../services/boteAnualService';
import DrawerConciliarBote from './DrawerConciliarBote';
import styles from './PorConciliar.module.css';

export interface TabPorConciliarProps {
  inmuebleAliasById: Map<number, string>;
}

const ESTADO_PILL: Record<BoteAnualSinIdentificar['estado'], { variant: PillVariant; label: string }> = {
  pendiente_total: { variant: 'neg', label: 'Pendiente' },
  parcial: { variant: 'warn', label: 'Parcial' },
  cerrado: { variant: 'pos', label: 'Conciliado' },
  sobre_asignado: { variant: 'gold', label: 'Sobre-asignado' },
};

type BoteConId = BoteAnualSinIdentificar & { id: number };

/**
 * Pestaña "Por conciliar": lista los botes (rentas declaradas AEAT sin contrato identificado)
 * y abre el drawer de conciliación para vincularlos a contratos reales.
 */
const TabPorConciliar: React.FC<TabPorConciliarProps> = ({ inmuebleAliasById }) => {
  const [botes, setBotes] = useState<BoteConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<BoteConId | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const todos = await boteAnualService.listarBotes();
      const conId = todos.filter((b): b is BoteConId => b.id != null);
      conId.sort((a, b) => b.año - a.año || a.inmuebleId - b.inmuebleId);
      setBotes(conId);
      // Mantener sincronizado el bote abierto tras un cambio
      setAbierto((prev) => (prev ? conId.find((b) => b.id === prev.id) ?? null : null));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return <div className={styles.emptyHint}>Cargando ejercicios declarados…</div>;
  }

  if (botes.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Fiscal size={20} />}
        title="Nada por conciliar"
        sub="No hay rentas declaradas en la AEAT pendientes de asociar a un contrato."
      />
    );
  }

  return (
    <>
      <p className={styles.intro}>
        Rentas declaradas en la AEAT que no se asociaron a un contrato identificado al importar
        (sin NIF, por habitaciones, mixtas o no-vivienda). Vincula los contratos reales que las
        cubren para cuadrar cada ejercicio.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Inmueble</th>
              <th className="c">Ejercicio</th>
              <th className="r">Declarado</th>
              <th className="r">Pendiente</th>
              <th className="c">Estado</th>
            </tr>
          </thead>
          <tbody>
            {botes.map((b) => {
              const pill = ESTADO_PILL[b.estado];
              return (
                <tr key={b.id} onClick={() => setAbierto(b)}>
                  <td>
                    <div className={styles.tStrong}>
                      {inmuebleAliasById.get(b.inmuebleId) ?? `Inmueble ${b.inmuebleId}`}
                    </div>
                    {b.nifsDetectados.length > 0 && (
                      <div className={styles.tMuted}>
                        {b.nifsDetectados.length} NIF declarado
                        {b.nifsDetectados.length === 1 ? '' : 's'}
                      </div>
                    )}
                  </td>
                  <td className={`c ${styles.mono}`}>{b.año}</td>
                  <td className="r">
                    <MoneyValue value={b.importeDeclarado} decimals={0} tone="ink" />
                  </td>
                  <td className="r">
                    <MoneyValue
                      value={b.saldoPendiente}
                      decimals={0}
                      tone={b.saldoPendiente > 0 ? 'neg' : 'pos'}
                    />
                  </td>
                  <td className="c">
                    <Pill variant={pill.variant}>{pill.label}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {abierto && (
        <DrawerConciliarBote
          bote={abierto}
          inmuebleAlias={inmuebleAliasById.get(abierto.inmuebleId)}
          open
          onClose={() => setAbierto(null)}
          onChange={cargar}
        />
      )}
    </>
  );
};

export default TabPorConciliar;
export { TabPorConciliar };
