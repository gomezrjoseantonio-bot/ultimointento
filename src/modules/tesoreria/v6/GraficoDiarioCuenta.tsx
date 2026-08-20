// ============================================================================
// Tesorería · "Día a día de {mes}" · el gráfico de UNA cuenta (F3)
// ============================================================================
//
// Mockup: `docs/mockups/atlas-bancos-grafico-v5.html` (.graf-in).
//
// SVG a mano (guía §14 · el patrón de la casa, como `GraficoTreintaDias`), sin
// chart.js ni recharts: el design system no tiene primitivo de chart. Los
// colores van por tokens en los atributos del SVG — al ser SVG inline, el
// navegador resuelve las custom properties solo.
//
// Lo que cuenta el gráfico, y por qué así:
//   · ENTRADAS arriba del cero y SALIDAS abajo. La dirección la da el eje, no
//     el color: nada de rojo/verde (§2.1), que aquí gastaría el color en algo
//     que la posición ya dice.
//   · Cada lado se parte en dos: lo que YA pasó (sólido) y lo que falta
//     (tenue con contorno). Es la misma distinción que la lista de punteo hace
//     con el círculo, dicha en superficie de barra.
//   · Altura FIJA: el gráfico se abre bajo una fila de la tabla y no puede
//     empujar la página (regla de no-scroll).
//
// Las dos escalas son INDEPENDIENTES (arriba contra el máximo de entradas,
// abajo contra el de salidas): con una escala común, un mes de nóminas grandes
// y gastos pequeños dejaba las salidas en una raya de un píxel, que es justo lo
// que se viene a mirar.
// ============================================================================

import React, { useMemo, useState } from 'react';
import type { DiaCuenta } from '../../../services/tesoreriaV6Metrics';
import { importeSaldo, nombreMes } from './formatoV6';
import styles from './GraficoDiarioCuenta.module.css';

const W = 720;
const H = 150;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 8;
const PAD_B = 18;
/** Hueco entre barras · el resto del carril lo ocupa la barra. */
const HUECO = 4;

interface Props {
  dias: DiaCuenta[];
  /** ISO de hoy · marca la vertical. Fuera del mes, no se pinta. */
  hoy: string;
  month0: number;
}

const GraficoDiarioCuenta: React.FC<Props> = ({ dias, hoy, month0 }) => {
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    const n = dias.length;
    if (n === 0) return null;
    const arriba = dias.map((d) => d.entradaConf + d.entradaPrev);
    const abajo = dias.map((d) => d.salidaConf + d.salidaPrev);
    const maxUp = Math.max(...arriba, 0);
    const maxDn = Math.max(...abajo, 0);

    // El cero se coloca repartiendo el alto entre lo que pesa cada lado, así
    // que un mes sin salidas no gasta media caja en un semiplano vacío. Con
    // todo a cero, el eje va al medio.
    const total = maxUp + maxDn;
    const alto = H - PAD_T - PAD_B;
    const zero = total === 0 ? PAD_T + alto / 2 : PAD_T + alto * (maxUp / total);
    const altoUp = zero - PAD_T;
    const altoDn = H - PAD_B - zero;

    const carril = (W - PAD_L - PAD_R) / n;
    const ancho = Math.max(2, carril - HUECO);
    const x = (i: number): number => PAD_L + i * carril + HUECO / 2;
    const hUp = (v: number): number => (maxUp === 0 ? 0 : (v / maxUp) * altoUp);
    const hDn = (v: number): number => (maxDn === 0 ? 0 : (v / maxDn) * altoDn);

    return { n, zero, x, ancho, carril, hUp, hDn, vacio: total === 0 };
  }, [dias]);

  if (!geo) return null;
  const { n, zero, x, ancho, carril, hUp, hDn, vacio } = geo;

  const idxHoy = dias.findIndex((d) => d.dia === hoy);
  const rx = Math.min(3, ancho / 2);

  /** Barra con las esquinas redondeadas SOLO por el lado que se aleja del eje. */
  const barra = (
    key: string,
    xi: number,
    y: number,
    alto: number,
    fill: string,
    stroke?: string
  ) => {
    if (alto < 0.5) return null;
    return (
      <rect
        key={key}
        x={xi.toFixed(1)}
        y={y.toFixed(1)}
        width={ancho.toFixed(1)}
        height={alto.toFixed(1)}
        rx={rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 1 : undefined}
      />
    );
  };

  const punto = hover != null ? dias[hover] : null;
  const tieneAlgo =
    punto != null &&
    punto.entradaConf + punto.entradaPrev + punto.salidaConf + punto.salidaPrev > 0;

  return (
    <div className={styles.caja}>
      <div className={styles.hd}>
        <div className={styles.eyebrow}>Día a día de {nombreMes(month0)}</div>
        {/* La leyenda nombra los cuatro tramos una vez · el relleno los
            distingue en cada barra sin repetir la palabra. */}
        <div className={styles.leyenda}>
          <span className={styles.leyItem}>
            <span className={`${styles.muestra} ${styles.mEntradaConf}`} aria-hidden="true" /> Ingresado
          </span>
          <span className={styles.leyItem}>
            <span className={`${styles.muestra} ${styles.mEntradaPrev}`} aria-hidden="true" /> Por cobrar
          </span>
          <span className={styles.leyItem}>
            <span className={`${styles.muestra} ${styles.mSalidaConf}`} aria-hidden="true" /> Pagado
          </span>
          <span className={styles.leyItem}>
            <span className={`${styles.muestra} ${styles.mSalidaPrev}`} aria-hidden="true" /> Por pagar
          </span>
        </div>
      </div>

      <div className={styles.lienzo}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={styles.svg}
          role="img"
          aria-label={`Movimientos día a día de ${nombreMes(month0)}`}
        >
          {dias.map((d, i) => {
            const xi = x(i);
            const ciAlto = hUp(d.entradaConf);
            const piAlto = hUp(d.entradaPrev);
            const csAlto = hDn(d.salidaConf);
            const psAlto = hDn(d.salidaPrev);
            // Arriba se apila hacia el cielo: primero lo confirmado, pegado al
            // eje, y encima lo que falta.
            const yCi = zero - ciAlto;
            const yPi = yCi - piAlto;
            const yCs = zero;
            const yPs = zero + csAlto;
            return (
              <React.Fragment key={d.dia}>
                {barra(`ci-${d.dia}`, xi, yCi, ciAlto, 'var(--atlas-v5-brand)')}
                {barra(
                  `pi-${d.dia}`,
                  xi,
                  yPi,
                  piAlto,
                  'var(--atlas-v5-brand-wash)',
                  'var(--atlas-v5-brand-2)'
                )}
                {barra(`cs-${d.dia}`, xi, yCs, csAlto, 'var(--atlas-v5-gold)')}
                {barra(
                  `ps-${d.dia}`,
                  xi,
                  yPs,
                  psAlto,
                  'var(--atlas-v5-gold-wash)',
                  'var(--atlas-v5-gold-soft)'
                )}
              </React.Fragment>
            );
          })}

          {/* Eje cero · la línea contra la que se lee todo. */}
          <line
            x1={PAD_L}
            y1={zero.toFixed(1)}
            x2={W - PAD_R}
            y2={zero.toFixed(1)}
            stroke="var(--atlas-v5-line)"
            strokeWidth={1}
          />

          {/* Hoy · solo si cae dentro del mes que se está mirando. */}
          {idxHoy >= 0 && (
            <line
              x1={(x(idxHoy) + ancho / 2).toFixed(1)}
              y1={PAD_T}
              x2={(x(idxHoy) + ancho / 2).toFixed(1)}
              y2={H - PAD_B}
              stroke="var(--atlas-v5-gold-2)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          )}

          {/* Números de día · uno de cada cinco, más el 1. */}
          {dias.map((d, i) => {
            const num = Number(d.dia.slice(8, 10));
            if (num !== 1 && num % 5 !== 0) return null;
            return (
              <text
                key={`t-${d.dia}`}
                x={(x(i) + ancho / 2).toFixed(1)}
                y={H - 5}
                textAnchor="middle"
                fill="var(--atlas-v5-ink-5)"
                fontSize={9}
                fontFamily="var(--atlas-v5-font-mono-num)"
              >
                {num}
              </text>
            );
          })}

          {/* Zonas de hover · una por día, del alto del lienzo. */}
          {dias.map((d, i) => (
            <rect
              key={`h-${d.dia}`}
              x={(PAD_L + i * carril).toFixed(1)}
              y={PAD_T}
              width={carril.toFixed(1)}
              height={H - PAD_T - PAD_B}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          ))}
        </svg>

        {/* Mes sin nada · se dice, en vez de dejar una caja muda. */}
        {vacio && <div className={styles.vacio}>Sin movimientos este mes</div>}

        {punto && (
          <div
            className={styles.tip}
            style={{ left: `${((hover! + 0.5) / n) * 100}%` }}
            role="status"
          >
            <div className={styles.tipDia}>{Number(punto.dia.slice(8, 10))} {nombreMes(month0)}</div>
            {tieneAlgo ? (
              <>
                {punto.entradaConf > 0 && (
                  <div className={styles.tipFila}>
                    <span>Ingresado</span>
                    <b>{importeSaldo(punto.entradaConf)}</b>
                  </div>
                )}
                {punto.entradaPrev > 0 && (
                  <div className={styles.tipFila}>
                    <span>Por cobrar</span>
                    <b>{importeSaldo(punto.entradaPrev)}</b>
                  </div>
                )}
                {punto.salidaConf > 0 && (
                  <div className={styles.tipFila}>
                    <span>Pagado</span>
                    <b>{importeSaldo(punto.salidaConf)}</b>
                  </div>
                )}
                {punto.salidaPrev > 0 && (
                  <div className={styles.tipFila}>
                    <span>Por pagar</span>
                    <b>{importeSaldo(punto.salidaPrev)}</b>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.tipFila}>
                <span>sin movimientos</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraficoDiarioCuenta;
