// Gestión delegada · Fase 2 · panel en la ficha del CONTRATO DE GESTIÓN (padre).
// Muestra la agencia, la renta garantizada, y la FACTURACIÓN del ejercicio =
// Σ subcontratos de inquilinos anexados (§4.4), con la comisión derivada.
// Permite anexar un contrato de inquilino (abre el wizard LAU con gestionPadre).
// Carga sus propios anexados (getAllContracts) para no acoplar el drawer.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import type { Contract } from '../../../../services/db';
import { getAllContracts } from '../../../../services/contractService';
import { resumenFacturacion, subcontratosDe } from '../../utils/facturacionGestionService';
import { getInquilinoNombre } from '../../utils/inquilinoUtils';
import styles from './PanelGestionDelegada.module.css';

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

interface Props {
  contrato: Contract & { id: number };
  /** Año del ejercicio a mostrar. Por defecto, el año en curso. */
  año?: number;
}

const PanelGestionDelegada: React.FC<Props> = ({ contrato, año }) => {
  const navigate = useNavigate();
  const ejercicio = año ?? new Date().getFullYear();
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const all = await getAllContracts();
        if (!cancelado) setContracts(all);
      } catch {
        if (!cancelado) setContracts([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [contrato.id]);

  const anexados = subcontratosDe(contrato.id, contracts);
  const resumen = resumenFacturacion(contrato, contracts, ejercicio);
  const rentaGarantizada = contrato.gestion?.rentaGarantizada ?? contrato.rentaMensual;

  const anexar = (): void => navigate(`/contratos/gestion/anexar?padre=${contrato.id}`);

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Gestión delegada</div>

      <div className={styles.row}>
        <span className={styles.lab}>Agencia</span>
        <span className={styles.val}>{getInquilinoNombre(contrato)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.lab}>Renta garantizada</span>
        <span className={styles.val}>{eur(rentaGarantizada)}/mes</span>
      </div>
      {contrato.fianzaImporte > 0 && (
        <div className={styles.row}>
          <span className={styles.lab}>Fianza</span>
          <span className={styles.val}>{eur(contrato.fianzaImporte)}</span>
        </div>
      )}

      <div className={styles.sep} />

      <div className={styles.title}>Facturación {ejercicio}</div>
      <div className={styles.row}>
        <span className={styles.lab}>Subcontratos anexados</span>
        <span className={styles.val}>{resumen.nSubcontratos}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.lab}>Facturación (Σ subcontratos)</span>
        <span className={styles.val}>{eur(resumen.facturacion)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.lab}>Comisión estimada de la agencia</span>
        <span className={styles.val}>{eur(resumen.comision)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.lab}>Neto para ti</span>
        <span className={styles.val}>{eur(resumen.neto)}</span>
      </div>

      {anexados.length > 0 ? (
        <div className={styles.subList}>
          {anexados.map((s) => (
            <div key={s.id} className={styles.subItem}>
              <span>{getInquilinoNombre(s)}</span>
              <span className={styles.val}>{eur(s.rentaMensual ?? 0)}/mes</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.hint}>
          Aún no has anexado contratos de inquilinos. Anéxalos cuando la agencia te pase el detalle;
          la facturación es la suma de esos contratos.
        </div>
      )}

      <button type="button" className={styles.anexar} onClick={anexar}>
        <Icons.Plus size={13} strokeWidth={2} />
        Anexar contrato de inquilino
      </button>
    </div>
  );
};

export default PanelGestionDelegada;
