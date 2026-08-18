// Tesorería V6 · §3 · conciliar el extracto de una TARJETA dentro del ÚNICO
// drawer de subir extracto.
//
// Igual que en banco: se lee el extracto (PDF por IA, XLS/CSV por SheetJS) y se
// enseña línea a línea qué CASA con lo que la tarjeta ya tenía (previsto/
// confirmado o compra) y qué es NUEVO. Nada se escribe hasta que confirmas con
// «Conciliar». Lo que casa sube a conciliado con su importe real; lo nuevo nace
// ya conciliado. No mueve caja: el dinero sale en el recibo.

import React, { useEffect, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { leerExtractoTarjeta } from '../../../services/personal/extractoTarjeta';
import {
  planificarExtractoTarjeta,
  aplicarPlanTarjeta,
  type PlanConciliacionTarjeta,
} from '../../../services/personal/conciliarExtractoTarjeta';
import { importeConSigno, fechaLarga } from './formatoV6';
import styles from './DrawerExtracto.module.css';

export interface PanelExtractoTarjetaProps {
  tarjeta: { id: number; alias: string };
  file: File;
  onGuardado: () => void | Promise<void>;
  onCerrar: () => void;
}

type Fase = 'leyendo' | 'cotejar' | 'guardando' | 'hecho' | 'error';

const PanelExtractoTarjeta: React.FC<PanelExtractoTarjetaProps> = ({ tarjeta, file, onGuardado, onCerrar }) => {
  const [fase, setFase] = useState<Fase>('leyendo');
  const [plan, setPlan] = useState<PlanConciliacionTarjeta | null>(null);
  const [mensaje, setMensaje] = useState<string>('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lineas = await leerExtractoTarjeta(file);
        if (!vivo) return;
        if (lineas.length === 0) {
          setMensaje('No se pudo leer ningún movimiento del extracto. ¿Es el extracto de esta tarjeta?');
          setFase('error');
          return;
        }
        const p = await planificarExtractoTarjeta(tarjeta.id, lineas);
        if (!vivo) return;
        setPlan(p);
        setFase('cotejar');
      } catch (err) {
        if (!vivo) return;
        setMensaje(err instanceof Error ? err.message : 'No se pudo leer el extracto.');
        setFase('error');
      }
    })();
    return () => {
      vivo = false;
    };
    // Se lee una sola vez, al montar, con el fichero y la tarjeta ya fijados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conciliar = async () => {
    if (!plan) return;
    setFase('guardando');
    try {
      await aplicarPlanTarjeta(tarjeta.id, plan);
      await onGuardado();
      setFase('hecho');
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo conciliar el extracto.');
      setFase('error');
    }
  };

  if (fase === 'leyendo') {
    return (
      <div className={styles.zonaWrap}>
        <div className={styles.avisoCuenta}>
          <div className={styles.avisoT}>{tarjeta.alias}</div>
          <div className={styles.avisoS}>Leyendo el extracto y emparejándolo con la tarjeta…</div>
        </div>
      </div>
    );
  }

  if (fase === 'error') {
    return (
      <div className={styles.zonaWrap}>
        <div className={styles.avisoCuenta}>
          <div className={styles.avisoT}>{tarjeta.alias}</div>
          <div className={styles.error}>{mensaje}</div>
          <div className={styles.avisoAcciones}>
            <button type="button" className={styles.btnLinea} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (fase === 'hecho') {
    return (
      <div className={styles.zonaWrap}>
        <div className={styles.avisoCuenta}>
          <div className={styles.avisoT}>{tarjeta.alias}</div>
          <div className={styles.avisoS}>
            <Icons.Check size={13} aria-hidden="true" /> Conciliadas {plan?.conciliadas ?? 0} · nuevas{' '}
            {plan?.nuevas ?? 0}. Ya están en la tarjeta con su importe real.
          </div>
          <div className={styles.avisoAcciones}>
            <button type="button" className={styles.btnLinea} onClick={onCerrar}>
              Hecho
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fase 'cotejar' o 'guardando' · la lista para cotejar, como en banco.
  return (
    <>
      <div className={styles.lista}>
        {(plan?.lineas ?? []).map((d, i) => (
          <div key={i} className={styles.linea}>
            <div className={styles.lineaTop}>
              <div className={styles.lineaTexto}>{d.linea.concepto}</div>
              <div className={styles.lineaImporte}>{importeConSigno(-Math.abs(d.linea.importe))}</div>
            </div>
            <div className={styles.lineaFecha}>{fechaLarga(d.linea.fecha)}</div>
            <div className={styles.veredicto}>
              <Icons.Check size={13} aria-hidden="true" />
              <span>
                {d.estado === 'casa'
                  ? `casa con ${d.objetivo?.descripcion ?? 'lo que ya tenías'}`
                  : d.linea.importe > 0
                    ? 'no estaba · se concilia como gasto nuevo'
                    : 'devolución sin par · no se carga'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.pie}>
        <div className={styles.pieNota}>
          {plan
            ? `${plan.conciliadas} casan · ${plan.nuevas} nuevas · en ${tarjeta.alias}`
            : ''}
        </div>
        <button type="button" className={styles.btnGuardar} onClick={conciliar} disabled={fase === 'guardando'}>
          {fase === 'guardando' ? 'Conciliando…' : 'Conciliar'}
        </button>
      </div>
    </>
  );
};

export default PanelExtractoTarjeta;
