// ============================================================================
// Conciliar · Zona 1 · el HERO navy (patrón `HeroTesoreria`)
// ============================================================================
//
// Eyebrow oro «Conciliar extracto» + el nombre de la cuenta en blanco, el rango
// real del extracto y una banda de tres columnas: el saldo del último día
// (izquierda) y lo que ENTRÓ y SALIÓ con sus tres familias gordas.
//
// El saldo es el que ya calcula el cuadre con el banco (`PropuestaDeApertura`
// · el saldo del banco a la línea más reciente). Aquí NO se calcula nada: si el
// fichero no trae saldo, no se enseña, y si no cuadra, lo dice
// `CuadreConElBanco` debajo. El debe del cálculo de apertura es otra tarea.
//
// Colores (guía V5 §2.2.1): importes en tinta · sobre navy, la rampa
// `on-navy` remapeada como en `HeroTesoreria`. Ni verde ni rojo: el signo lo
// pone el símbolo.
// ============================================================================

import React from 'react';
import { Icons, MoneyValue } from '../../../../design-system/v5';
import type { ResumenFlujo } from './agruparPorEntidad';
import styles from './HeroConciliar.module.css';

export interface HeroConciliarProps {
  /** El nombre de la cuenta · «Santander Alquileres». */
  nombreCuenta: string;
  flujo: ResumenFlujo;
  /** El saldo que dice el banco a la línea más reciente · `null` si el fichero no lo trae. */
  saldo: { fecha: string; importe: number } | null;
  onOtroFichero: () => void;
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${Number(d)}/${Number(m)}/${y}` : iso;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function diaMesAnio(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return d && m && y ? `${d} ${MESES[m - 1]} ${y}` : iso;
}

const Lado: React.FC<{ etiqueta: string; lado: ResumenFlujo['entro'] }> = ({ etiqueta, lado }) => (
  <div className={styles.flujo}>
    <div className={styles.flujoCab}>
      <span className={styles.flujoLab}>{etiqueta}</span>
      <MoneyValue value={lado.total} showSign decimals={0} tone="inherit" className={styles.flujoTot} />
    </div>
    {lado.familias.map((f) => (
      <div key={f.familia ?? 'sin'} className={styles.famRow}>
        <span className={styles.famNom}>{f.etiqueta}</span>
        <MoneyValue value={f.total} showSign decimals={0} tone="inherit" className={styles.famVal} />
      </div>
    ))}
    {lado.familias.length === 0 && <div className={styles.famRow}><span className={styles.famNom}>nada todavía</span></div>}
  </div>
);

const HeroConciliar: React.FC<HeroConciliarProps> = ({ nombreCuenta, flujo, saldo, onOtroFichero }) => (
  <section className={styles.hero} aria-label="Resumen del extracto">
    <div className={styles.top}>
      <div className={styles.eyebrowBlock}>
        <div className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.lab}>Conciliar extracto</span>
          <span className={styles.cuenta}>{nombreCuenta}</span>
        </div>
        <div className={styles.rango}>
          {flujo.desde && flujo.hasta
            ? `desde el ${fechaCorta(flujo.desde)} a ${fechaCorta(flujo.hasta)} · `
            : ''}
          {flujo.cuantas} {flujo.cuantas === 1 ? 'movimiento' : 'movimientos'}
          {flujo.internos > 0 ? ` · ${flujo.internos} entre tus cuentas` : ''}
        </div>
      </div>
      <button type="button" className={styles.btnHero} onClick={onOtroFichero}>
        <Icons.ArrowLeft size={15} />
        Otro fichero
      </button>
    </div>

    <div className={styles.cols}>
      <div className={styles.saldo}>
        <div className={styles.saldoLab}>{saldo ? `Saldo · ${diaMesAnio(saldo.fecha)}` : 'Saldo'}</div>
        {saldo ? (
          <MoneyValue value={saldo.importe} tone="inherit" className={styles.saldoVal} />
        ) : (
          <div className={styles.saldoNo}>el fichero no trae saldo</div>
        )}
      </div>
      <Lado etiqueta="Entró" lado={flujo.entro} />
      <Lado etiqueta="Salió" lado={flujo.salio} />
    </div>
  </section>
);

export default HeroConciliar;
