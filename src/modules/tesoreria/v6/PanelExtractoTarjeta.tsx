// Tesorería V6 · §3 · conciliar el extracto de una TARJETA dentro del ÚNICO
// drawer de subir extracto.
//
// Cuando el fichero que sueltas no es de un banco sino de una tarjeta, el drawer
// te deja elegir la tarjeta y delega aquí: se lee el extracto (PDF por IA,
// XLS/CSV por SheetJS) y se concilia igual que en banco —lo previsto/confirmado
// que casa sube a conciliado, lo que no casa nace ya conciliado—. No hay cuadre
// línea a línea: la conciliación de tarjeta es automática por importe y fecha.

import React, { useEffect, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { leerExtractoTarjeta } from '../../../services/personal/extractoTarjeta';
import {
  aplicarExtractoTarjeta,
  type ResultadoConciliacionTarjeta,
} from '../../../services/personal/conciliarExtractoTarjeta';
import styles from './DrawerExtracto.module.css';

export interface PanelExtractoTarjetaProps {
  tarjeta: { id: number; alias: string };
  file: File;
  onGuardado: () => void | Promise<void>;
  onCerrar: () => void;
}

type Fase = 'leyendo' | 'hecho' | 'error';

const PanelExtractoTarjeta: React.FC<PanelExtractoTarjetaProps> = ({ tarjeta, file, onGuardado, onCerrar }) => {
  const [fase, setFase] = useState<Fase>('leyendo');
  const [resultado, setResultado] = useState<ResultadoConciliacionTarjeta | null>(null);
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
        const r = await aplicarExtractoTarjeta(tarjeta.id, lineas);
        if (!vivo) return;
        setResultado(r);
        setFase('hecho');
        await onGuardado();
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

  return (
    <div className={styles.zonaWrap}>
      <div className={styles.avisoCuenta}>
        <div className={styles.avisoT}>{tarjeta.alias}</div>
        {fase === 'leyendo' && (
          <div className={styles.avisoS}>Leyendo el extracto y conciliando sus gastos…</div>
        )}
        {fase === 'hecho' && resultado && (
          <div className={styles.avisoS}>
            <Icons.Check size={13} aria-hidden="true" />{' '}
            Conciliadas {resultado.conciliadas} · nuevas {resultado.nuevas}. Los gastos que casan
            pasan a conciliado con su importe real.
          </div>
        )}
        {fase === 'error' && <div className={styles.error}>{mensaje}</div>}
        {fase !== 'leyendo' && (
          <div className={styles.avisoAcciones}>
            <button type="button" className={styles.btnLinea} onClick={onCerrar}>
              {fase === 'hecho' ? 'Hecho' : 'Cerrar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PanelExtractoTarjeta;
