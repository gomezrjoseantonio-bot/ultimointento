// Bloque «Primer cobro» del paso Económico del alta de contrato.
// Mockup de referencia: atlas-alta-primer-cobro-v1.html.
//
// Lo que NO se reproduce del mockup, a propósito: su fila de «drivers» (renta
// mensual + fecha de entrada). Ahí eran los mandos de una pantalla suelta; aquí
// los dos datos YA existen en el wizard —la renta en este mismo paso, dos campos
// más arriba, y la fecha de entrada en el paso 1— y repetir el input sería tener
// dos casillas para el mismo dato. Este bloque los lee y calcula sobre ellos; de
// dónde sale cada cifra se ve igual, porque la descripción de cada opción lo
// dice («17 días de agosto + septiembre completo»), que es lo que hacía el
// mockup con `ds1` y `ds3`. Tampoco se reproduce el marco del drawer (cabecera,
// pie, botones): el wizard ya lo pone.
//
// La aritmética NO se escribe aquí: viene de `propuestasDePrimerCobro`, el mismo
// módulo que usa el generador de previsiones. Calculada dos veces serían dos
// respuestas que se separan en cuanto se toque una — y el usuario elegiría una
// cifra distinta de la que se le va a cobrar.

import React, { useMemo, useState } from 'react';
import type { ModoPrimerCobro, PrimerCobroContrato } from '../../../services/db/types-contratos';
import { propuestasDePrimerCobro } from '../../../services/rentaDelMes';
import styles from './PrimerCobroSelector.module.css';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** Lo que el usuario escribe en la caja ajustable · coma decimal, como en España. */
const aNumero = (texto: string): number | null => {
  const limpio = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? n : null;
};

const aTexto = (n: number): string => n.toFixed(2).replace('.', ',');

interface Props {
  /** Renta mensual del contrato, tal cual la teclea el usuario en el paso. */
  rentaMensual: string;
  /** Fecha de entrada `YYYY-MM-DD`, del paso 1. */
  fechaInicio: string;
  value: PrimerCobroContrato | undefined;
  onChange: (v: PrimerCobroContrato | undefined) => void;
}

export default function PrimerCobroSelector({
  rentaMensual,
  fechaInicio,
  value,
  onChange,
}: Props): React.ReactElement {
  const renta = Number(rentaMensual) || 0;
  const propuestas = useMemo(
    () => propuestasDePrimerCobro(fechaInicio, renta),
    [fechaInicio, renta],
  );

  // El importe se guarda ya resuelto en `value`. Este estado es solo el TEXTO de
  // la caja mientras se escribe: sin él, teclear «4» en «450» reescribiría el
  // campo con «4,00» a mitad de pulsación.
  const [textoEnCurso, setTextoEnCurso] = useState<string | null>(null);

  const modo: ModoPrimerCobro = value?.modo ?? 'prorrateo';

  const propuestaDe = (m: ModoPrimerCobro): number => {
    if (!propuestas) return 0;
    if (m === 'mes_entero') return propuestas.mesEntero;
    if (m === 'dias_mas_adelanto') return propuestas.diasMasAdelanto;
    if (m === 'manual') return value?.importe ?? propuestas.mesEntero;
    return propuestas.prorrateo;
  };

  const importe = value?.importe ?? propuestaDe(modo);

  const elegir = (m: ModoPrimerCobro): void => {
    setTextoEnCurso(null);
    // Cambiar de modo recalcula la propuesta: el ajuste anterior era de la
    // anterior. En `manual` se conserva lo que hubiera, que es el punto.
    const nuevo = m === 'manual' ? (value?.importe ?? propuestaDe('mes_entero')) : propuestaDe(m);
    onChange({ modo: m, importe: nuevo });
  };

  const ajustar = (texto: string): void => {
    setTextoEnCurso(texto);
    const n = aNumero(texto);
    if (n != null) onChange({ modo, importe: n });
  };

  const mesEntrada = propuestas ? MESES[propuestas.mesDeEntrada - 1] : '';
  const mesSig = propuestas ? MESES[propuestas.mesSiguiente - 1] : '';

  const opciones: Array<{ modo: ModoPrimerCobro; nombre: string; desc: string }> = [
    {
      modo: 'prorrateo',
      nombre: 'Prorrateo simple',
      desc: propuestas
        ? `${propuestas.dias} días de ${mesEntrada}`
        : 'Solo los días vividos del mes de entrada',
    },
    {
      modo: 'mes_entero',
      nombre: 'Mes entero',
      desc: 'El mes completo aunque entre a mitad',
    },
    {
      modo: 'dias_mas_adelanto',
      nombre: 'Días en curso + mes por adelantado',
      desc: propuestas
        ? `${propuestas.dias} días de ${mesEntrada} + ${mesSig} completo`
        : 'Días del mes de entrada más la mensualidad siguiente',
    },
    {
      modo: 'manual',
      nombre: 'Importe manual',
      desc: 'Tú fijas la cifra · ATLAS no calcula',
    },
  ];

  const desglose = (): React.ReactNode => {
    if (!propuestas) return 'Indica la fecha de entrada para calcular el primer cobro';
    if (modo === 'mes_entero') return <><strong>Mes completo</strong> de {mesEntrada}, sin prorratear</>;
    if (modo === 'manual') return <><strong>Importe manual</strong> · ATLAS no recalcula</>;
    if (modo === 'dias_mas_adelanto') {
      return (
        <>
          <strong>{euro.format(propuestas.prorrateo)}</strong> ({propuestas.dias} d. {mesEntrada})
          {' + '}
          <strong>{euro.format(propuestas.mesEntero)}</strong> ({mesSig} adelantado)
        </>
      );
    }
    return (
      <>
        <strong>{propuestas.dias} días</strong> de {mesEntrada} · {euro.format(renta)}/mes
        {` ÷ ${propuestas.diasDelMes} × ${propuestas.dias}`}
      </>
    );
  };

  return (
    <div className={styles.bloque}>
      <div className={styles.titulo}>
        ¿Cómo cobras el primer mes?
        <span className={styles.tituloSub}>ATLAS calcula · tú ajustas</span>
      </div>

      <div className={styles.opciones} role="radiogroup" aria-label="Cómo cobras el primer mes">
        {opciones.map((o) => {
          const sel = modo === o.modo;
          return (
            <button
              type="button"
              key={o.modo}
              role="radio"
              aria-checked={sel}
              className={`${styles.opcion} ${sel ? styles.opcionSel : ''}`}
              onClick={() => elegir(o.modo)}
            >
              <span className={styles.radio} />
              <span className={styles.texto}>
                <span className={styles.nombre}>{o.nombre}</span>
                <span className={styles.desc}>{o.desc}</span>
              </span>
              {o.modo === 'manual' ? (
                <span className={`${styles.importe} ${styles.importeManual}`}>a mano</span>
              ) : (
                <span className={styles.importe}>
                  {propuestas ? euro.format(propuestaDe(o.modo)) : '—'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.resultado}>
        <div>
          <div className={styles.resultadoEtiqueta}>Primer cobro</div>
          <div className={styles.desglose}>{desglose()}</div>
        </div>
        <div className={styles.ajuste}>
          <div className={styles.ajusteCap}>Ajustable</div>
          <div className={styles.ajusteCaja}>
            <input
              className={styles.ajusteInput}
              inputMode="decimal"
              aria-label="Importe del primer cobro"
              value={textoEnCurso ?? aTexto(importe)}
              onChange={(e) => ajustar(e.target.value)}
              onBlur={() => setTextoEnCurso(null)}
            />
            <span className={styles.ajusteMoneda}>€</span>
          </div>
        </div>
      </div>

      <div className={styles.nota}>
        <span className={styles.notaIcono}>◆</span>
        {/* En «días + mes por adelantado» la frase del mockup —«a partir del
            segundo mes»— sería falsa: ese segundo mes se cobra AQUÍ, por
            adelantado, y no vuelve a pedirse. Decirlo importa: es la diferencia
            entre entender la cifra y creer que ATLAS se ha comido una renta. */}
        {modo === 'dias_mas_adelanto' && propuestas ? (
          <span>
            {mesSig[0]?.toUpperCase()}{mesSig.slice(1)} va cobrado en este primer pago, así que
            no genera previsión propia. La renta recurrente de{' '}
            <b className={styles.notaMono}>{euro.format(renta)}</b> se reanuda el mes siguiente.
          </span>
        ) : (
          <span>
            A partir del segundo mes, la renta recurrente es{' '}
            <b className={styles.notaMono}>{euro.format(renta)}</b>. El primer cobro solo cambia la
            primera previsión.
          </span>
        )}
      </div>
    </div>
  );
}
