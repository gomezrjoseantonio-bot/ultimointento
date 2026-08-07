// La escalera de liberación · §5.2.
//
// «Tu cuota bajando hacia cero.» Cada peldaño es un préstamo que vence y deja
// de sumar. Área y línea en oro sobre el inset navy oscuro, etiquetas neutras:
// nada de verde para el final ni de colores de banco en la gráfica (guía v5).
//
// El SVG se dibuja a los píxeles reales del contenedor en vez de estirar un
// viewBox fijo: con `preserveAspectRatio="none"` las etiquetas salían
// deformadas en cuanto la ventana no medía exactamente lo del mockup.

import React, { useEffect, useRef, useState } from 'react';
import type { Escalera } from '../../../services/prestamos/lecturas';
import { eurPlano } from './formato';
import styles from './VistaFinanciacion.module.css';

const ALTO = 168;
const MARGEN = { arriba: 30, abajo: 32, izq: 55, der: 25 };

/** Un techo redondo para el eje · el siguiente múltiplo de 1.000. */
const techo = (max: number): number => Math.max(1000, Math.ceil(max / 1000) * 1000);

const siguienteMes = (mes: string): string => {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};

interface Props {
  escalera: Escalera;
}

const EscaleraLiberacion: React.FC<Props> = ({ escalera }) => {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(1000);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(320, el.clientWidth));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // El último punto cierra en cero · es el día en que quedas libre.
  const puntos = escalera.puntos.length
    ? [
        ...escalera.puntos,
        { mes: siguienteMes(escalera.puntos[escalera.puntos.length - 1].mes), total: 0 },
      ]
    : [];

  if (puntos.length < 2) {
    return (
      <div className={styles.escaleraVacia}>
        Sin cuotas por delante · nada que liberar.
      </div>
    );
  }

  const yMax = techo(Math.max(...puntos.map((p) => p.total)));
  const x0 = MARGEN.izq;
  const x1 = ancho - MARGEN.der;
  const yCero = ALTO - MARGEN.abajo - 0.5;
  const yTope = MARGEN.arriba;

  const x = (i: number) => x0 + ((x1 - x0) * i) / (puntos.length - 1);
  const y = (v: number) => yCero - (v / yMax) * (yCero - yTope);

  // Se colapsan los meses seguidos con la misma cuota · el trazo sale igual y
  // el DOM pasa de trescientos nodos a una decena.
  const tramos: Array<{ desde: number; hasta: number; total: number }> = [];
  puntos.forEach((p, i) => {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && Math.abs(ultimo.total - p.total) < 0.5) ultimo.hasta = i;
    else tramos.push({ desde: i, hasta: i, total: p.total });
  });

  let d = `M${x(0).toFixed(1)},${y(tramos[0].total).toFixed(1)}`;
  tramos.forEach((t, i) => {
    d += ` L${x(t.hasta).toFixed(1)},${y(t.total).toFixed(1)}`;
    const sig = tramos[i + 1];
    if (sig) d += ` L${x(t.hasta).toFixed(1)},${y(sig.total).toFixed(1)}`;
  });
  const dArea = `${d} L${x(puntos.length - 1).toFixed(1)},${yCero.toFixed(1)} L${x0.toFixed(1)},${yCero.toFixed(1)} Z`;

  const paso = yMax / 4;
  const rejilla = [0, 1, 2, 3].map((i) => i * paso);

  const indiceDeMes = new Map(puntos.map((p, i) => [p.mes, i]));

  // Los peldaños que caben sin pisarse · el último es «libre» y va aparte.
  const separacionMinima = 42;
  let ultimaX = -Infinity;
  const peldanos = escalera.peldanos
    .map((p) => ({ ...p, i: indiceDeMes.get(siguienteMes(p.mes)) }))
    .filter((p): p is typeof p & { i: number } => p.i != null && p.i < puntos.length - 1)
    .filter((p) => {
      const px = x(p.i);
      if (px - ultimaX < separacionMinima) return false;
      ultimaX = px;
      return true;
    });

  const anioFinal = escalera.mesLibre?.slice(0, 4) ?? '';
  const anioInicial = puntos[0].mes.slice(0, 4);

  return (
    <div className={styles.escaleraPlot} ref={contenedor}>
      <svg width={ancho} height={ALTO} viewBox={`0 0 ${ancho} ${ALTO}`} role="img"
        aria-label={`Tu cuota mensual baja de ${eurPlano(escalera.totalHoy)} euros hoy a cero en ${anioFinal}`}>
        <defs>
          <linearGradient id="escalera-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.areaTop} />
            <stop offset="100%" className={styles.areaBottom} />
          </linearGradient>
        </defs>

        {rejilla.map((v) => (
          <g key={v}>
            <line className={styles.rejilla} x1={x0} y1={y(v)} x2={x1} y2={y(v)} />
            <text className={styles.ejeY} x={x0 - 5} y={y(v) + 3} textAnchor="end">
              {v === 0 ? '0' : `${Math.round(v / 1000)}k`}
            </text>
          </g>
        ))}

        <path d={dArea} fill="url(#escalera-area)" />
        <path className={styles.linea} d={d} fill="none" />

        {peldanos.map((p) => (
          <g key={p.mes}>
            <circle className={styles.marcador} cx={x(p.i)} cy={y(p.nuevoTotal)} r={3} />
            <text className={styles.etiquetaPeldano} x={x(p.i) + 6} y={y(p.nuevoTotal) - 5}>
              {eurPlano(p.nuevoTotal)}
            </text>
            <text className={styles.ejeX} x={x(p.i)} y={ALTO - 8} textAnchor="middle">
              {p.anio}
            </text>
          </g>
        ))}

        {/* El punto final · libre de deuda, en oro y nunca en verde. */}
        <circle className={styles.marcadorLibre} cx={x(puntos.length - 1)} cy={yCero} r={5} />
        <circle className={styles.marcador} cx={x(puntos.length - 1)} cy={yCero} r={2.5} />
        <text className={styles.etiquetaLibre} x={x1} y={yCero - 14} textAnchor="end">
          libre
        </text>

        <text className={styles.etiquetaHoy} x={x0} y={yTope - 8}>
          {eurPlano(escalera.totalHoy)} €/mes hoy
        </text>
        <text className={styles.ejeX} x={x0} y={ALTO - 8}>
          {anioInicial}
        </text>
        <text className={styles.ejeX} x={x1} y={ALTO - 8} textAnchor="end">
          {anioFinal}
        </text>
      </svg>
    </div>
  );
};

export default EscaleraLiberacion;
