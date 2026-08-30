// Paso 1 · soltar el fichero. La otra mitad del drawer de extracto.
//
// Sale a su propio fichero porque desde que existe `PanelConciliar` esto ya no
// es «la primera parte de una pantalla»: son DOS pantallas que se turnan. La
// primera pide un fichero y decide a qué cuenta va; la segunda concilia lo que
// trajo. Compartían componente solo por herencia del drawer original, y eso
// dejaba a `DrawerExtracto` pegado al techo de tamaño del trinquete.
//
// No tiene estado propio: todo lo que decide vive arriba, porque `procesar` y
// `reiniciar` tocan el batch de importación y esas dos cosas no se delegan.

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { Account } from '../../../../services/db';
import { cuentasEnUso } from '../../../../services/cuentasEnUso';
import type { DeteccionCuenta } from '../detectarCuenta';
import styles from '../DrawerExtracto.module.css';

export interface ZonaSoltarProps {
  /** Fijada al entrar desde una cuenta · `null` = puerta global. */
  cuenta: Account | null;
  cuentas: Account[];
  tarjetas: Array<{ id: number; alias: string }>;
  deteccion: DeteccionCuenta | null;
  procesando: boolean;
  arrastrando: boolean;
  setArrastrando: (v: boolean) => void;
  avisoReimport: { mensaje: string } | null;
  error: string | null;
  onElegirCuenta: (cuenta: Account) => void;
  onElegirTarjeta: (tarjeta: { id: number; alias: string }) => void;
  onFichero: (f: File) => void;
  onImportarDeTodasFormas: () => void;
  onOtroFichero: () => void;
}

/** El título del aviso · por qué no se sabe a qué cuenta va este fichero. */
function tituloDeDeteccion(d: DeteccionCuenta): string {
  if (d.estado === 'ambigua') return 'El fichero menciona más de una de tus cuentas';
  if (d.estado === 'iban-desconocido') {
    return `El IBAN del fichero (${d.iban.slice(0, 8)}…) no es de ninguna cuenta tuya`;
  }
  return 'No se ha encontrado el IBAN en el fichero';
}

const ZonaSoltar: React.FC<ZonaSoltarProps> = ({
  cuenta,
  cuentas,
  tarjetas,
  deteccion,
  procesando,
  arrastrando,
  setArrastrando,
  avisoReimport,
  error,
  onElegirCuenta,
  onElegirTarjeta,
  onFichero,
  onImportarDeTodasFormas,
  onOtroFichero,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={styles.zonaWrap}>
      {!cuenta && deteccion && deteccion.estado !== 'detectada' && (
        <div className={styles.avisoCuenta}>
          <div className={styles.avisoT}>{tituloDeDeteccion(deteccion)}</div>
          <div className={styles.avisoS}>
            Elige la cuenta o la tarjeta de este extracto. Importar en el sitio equivocado mueve
            saldos que no son.
          </div>
          <select
            className={styles.selectCuenta}
            aria-label="Destino del extracto"
            // Cambiar de destino a mitad de una importación lanzaría un segundo
            // `processFile` y dejaría el batch anterior huérfano.
            disabled={procesando}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              // `t:ID` una tarjeta (se concilia aparte) · `c:ID` una cuenta.
              if (v.startsWith('t:')) {
                const t = tarjetas.find((x) => x.id === Number(v.slice(2)));
                if (t) onElegirTarjeta({ id: t.id, alias: t.alias });
                return;
              }
              const elegida = cuentas.find((c) => c.id === Number(v.slice(2)));
              if (elegida) onElegirCuenta(elegida);
            }}
          >
            <option value="">Elige cuenta o tarjeta…</option>
            {cuentasEnUso(cuentas).map((c) => (
              <option key={`c${c.id}`} value={`c:${c.id}`}>
                {c.alias} · ****{c.ultimosCuatro}
              </option>
            ))}
            {tarjetas.map((t) => (
              <option key={`t${t.id}`} value={`t:${t.id}`}>
                {t.alias} · tarjeta
              </option>
            ))}
          </select>
        </div>
      )}

      {avisoReimport && (
        <div className={styles.avisoCuenta}>
          <div className={styles.avisoT}>Este extracto ya se importó</div>
          <div className={styles.avisoS}>{avisoReimport.mensaje}</div>
          <div className={styles.avisoAcciones}>
            <button type="button" className={styles.btnLinea} onClick={onImportarDeTodasFormas}>
              Importar de todas formas
            </button>
            <button type="button" className={styles.btnLinea} onClick={onOtroFichero}>
              Elegir otro fichero
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`${styles.zona} ${arrastrando ? styles.zonaOn : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (procesando) return;
          const f = e.dataTransfer.files?.[0];
          if (f) onFichero(f);
        }}
        disabled={procesando}
      >
        <Icons.Upload size={26} className={styles.zonaIc} />
        <div className={styles.zonaT}>
          {procesando ? 'Leyendo el extracto…' : 'Arrastra aquí el extracto o haz clic para elegir'}
        </div>
        <div className={styles.zonaS}>Excel, CSV, Norma 43 o PDF</div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx,.txt,.n43,.csb,.pdf"
        className={styles.inputFile}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFichero(f);
          e.target.value = '';
        }}
      />

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default ZonaSoltar;
