import React, { useEffect, useMemo, useState } from 'react';
import { Icons, MoneyValue, Pill } from '../../../design-system/v5';
import type { PillVariant } from '../../../design-system/v5';
import type { BoteAnualSinIdentificar } from '../../../services/db';
import {
  obtenerHistoricoFiscalInmueble,
  type AñoHistoricoFiscalInmueble,
} from '../../../services/historicoFiscalInmuebleService';
import { contractDisplayName, getContractsMap } from '../../../utils/contractDisplay';
import type { Contract } from '../../../services/db';
import styles from './SeccionHistoricoFiscal.module.css';

export interface SeccionHistoricoFiscalProps {
  inmuebleId: number;
}

const ESTADO_BOTE: Record<
  BoteAnualSinIdentificar['estado'],
  { variant: PillVariant; label: string; alerta?: boolean }
> = {
  pendiente_total: { variant: 'neg', label: 'Pendiente' },
  parcial: { variant: 'warn', label: 'Parcial' },
  cerrado: { variant: 'pos', label: 'Conciliado' },
  sobre_asignado: { variant: 'neg', label: 'Sobre-asignado', alerta: true },
};

/**
 * Sección "Histórico fiscal declarado" del detalle de un inmueble.
 * Pinta, año a año (descendente), las rentas declaradas en la AEAT: desde botes (rentas sin
 * contrato identificado, cualquier estado · incluido 'cerrado') y desde Contracts Camino 1
 * con ejercicio fiscal declarado ("gestión normal"). Lee la fuente de verdad; no migra datos.
 */
const SeccionHistoricoFiscal: React.FC<SeccionHistoricoFiscalProps> = ({ inmuebleId }) => {
  const [historico, setHistorico] = useState<AñoHistoricoFiscalInmueble[]>([]);
  const [contractsMap, setContractsMap] = useState<Map<number, Contract>>(new Map());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerHistoricoFiscalInmueble(inmuebleId)
      .then(async (rows) => {
        if (!activo) return;
        setHistorico(rows);
        const ids = rows.flatMap((r) => (r.bote?.contractsVinculados ?? []).map((l) => l.contractId));
        const map = ids.length > 0 ? await getContractsMap(ids) : new Map<number, Contract>();
        if (activo) setContractsMap(map);
      })
      .catch((err) => console.error('[SeccionHistoricoFiscal] error', err))
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [inmuebleId]);

  const totalAños = historico.length;
  const tieneDatos = useMemo(
    () => historico.some((r) => r.bote || r.contractsCamino1.length > 0),
    [historico],
  );

  if (cargando) {
    return <div className={styles.hint}>Cargando histórico fiscal…</div>;
  }

  if (!tieneDatos) {
    return (
      <div className={styles.hint}>
        Este inmueble aún no tiene rentas declaradas en la AEAT ni ejercicios fiscales registrados.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>Histórico fiscal declarado</h3>
      <p className={styles.sub}>
        Rentas declaradas en la AEAT año a año ({totalAños} {totalAños === 1 ? 'ejercicio' : 'ejercicios'}).
      </p>

      {historico.map((row) => {
        if (row.bote) {
          const meta = ESTADO_BOTE[row.bote.estado];
          const links = row.bote.contractsVinculados ?? [];
          const totalVinculado = links.reduce((s, l) => s + (Number(l.importeAsignado) || 0), 0);
          return (
            <div className={styles.anio} key={`b-${row.año}`}>
              <div className={styles.anioHead}>
                <span className={styles.anioTitulo}>Año {row.año}</span>
                <span className={styles.anioDeclarado}>
                  <MoneyValue value={row.bote.importeDeclarado} decimals={0} tone="ink" /> declarados
                </span>
                <Pill variant={meta.variant}>
                  {meta.alerta && <Icons.Warning size={12} strokeWidth={2} />} {meta.label}
                </Pill>
              </div>
              {links.length > 0 ? (
                <>
                  <ul className={styles.lista}>
                    {links.map((l) => (
                      <li className={styles.linea} key={`b-${row.año}-${l.contractId}`}>
                        <span className={styles.lineaNombre}>
                          {contractDisplayName(contractsMap.get(l.contractId), l.contractId)}
                        </span>
                        <MoneyValue value={l.importeAsignado} decimals={0} tone="ink" />
                      </li>
                    ))}
                  </ul>
                  <div className={styles.totalLinea}>
                    <span>Total vinculado</span>
                    <MoneyValue value={totalVinculado} decimals={0} tone="ink" />
                  </div>
                </>
              ) : (
                <div className={styles.vacio}>Sin contratos vinculados aún.</div>
              )}
            </div>
          );
        }

        // Año sin bote: Contracts Camino 1 (gestión normal).
        return (
          <div className={styles.anio} key={`c-${row.año}`}>
            <div className={styles.anioHead}>
              <span className={styles.anioTitulo}>Año {row.año}</span>
              <span className={styles.gestionNormal}>gestión normal</span>
            </div>
            <ul className={styles.lista}>
              {row.contractsCamino1.map(({ contract, ejercicio }, i) => {
                const nifs = ejercicio.nifsDetectados ?? (contract.inquilino?.dni ? [contract.inquilino.dni] : []);
                return (
                  <li className={styles.linea} key={`c-${row.año}-${contract.id ?? i}`}>
                    <span className={styles.lineaMain}>
                      <span className={styles.lineaNombre}>
                        {contractDisplayName(contract, contract.id ?? 0)}
                      </span>
                      {nifs.length > 0 && <span className={styles.lineaNif}>NIF {nifs.join(' · ')}</span>}
                    </span>
                    {ejercicio.importeDeclarado != null && (
                      <MoneyValue value={ejercicio.importeDeclarado} decimals={0} tone="ink" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default SeccionHistoricoFiscal;
export { SeccionHistoricoFiscal };
