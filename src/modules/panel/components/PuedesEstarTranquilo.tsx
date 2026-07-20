// Panel · "Puedes estar tranquilo" · cuatro tarjetas.
// Principio §B.2: callado cuando todo va bien (tinta neutra, borde --line).
// Solo aparece color (warn) cuando la tarjeta requiere acción.
//
// Honestidad de etiquetas (informe FASE A §3):
//   · "Sin conciliar" (no "sin cobrar"): no podemos afirmar impago, solo falta
//     de cuadre con el banco (el estado impago vivía en rentaMensual, eliminado).
//   · "Próximos 30 días": el subtítulo DECLARA el alcance (contratos + modelo
//     130 · seguros e IBI no vigilados) para no dar tranquilidad falsa.
//   · Colchón: divisor = cuota mensual de préstamos (decisión Jose).

import React from 'react';
import { Icons } from '../../../design-system/v5';
import { fmtEur, fmtMeses } from './format';
import type { ColchonVM, SinConciliarVM, Proximos30VM, IrpfVM } from './types';
import styles from './PuedesEstarTranquilo.module.css';

export interface PuedesEstarTranquiloProps {
  colchon: ColchonVM;
  sinConciliar: SinConciliarVM;
  proximos30: Proximos30VM;
  irpf: IrpfVM | null;
}

const PuedesEstarTranquilo: React.FC<PuedesEstarTranquiloProps> = ({
  colchon,
  sinConciliar,
  proximos30,
  irpf,
}) => {
  const colchonAlerta = colchon.estado === 'ok' && colchon.meses < 3;
  const conciliarAlerta = sinConciliar.count > 0;
  const proximosAlerta = proximos30.count > 0;

  // Subtítulo del colchón · declara el escenario y QUÉ no está contando (Jose).
  const colchonSub = (() => {
    if (colchon.estado !== 'ok') return 'sin cuotas ni gastos fijos que cubrir';
    const base = 'si no entrara ningún ingreso · ni alquileres ni nómina';
    if (!colchon.cuentaVida) return `${base} · aún no cuenta tus gastos fijos de vida`;
    if (colchon.hayInmuebles) return `${base} · no incluye comunidad ni IBI de tus inmuebles`;
    return base;
  })();

  return (
    <section className={styles.sec}>
      <div className={styles.head}>
        <div className={styles.tit}>Puedes estar tranquilo</div>
        <div className={styles.sub}>
          lo que puede venirte encima · solo aparece color cuando hay que actuar
        </div>
      </div>
      <div className={styles.grid}>
        {/* Colchón */}
        <div className={`${styles.card} ${colchonAlerta ? styles.alerta : ''}`}>
          <div className={styles.cardHd}>
            <Icons.Colchon size={15} strokeWidth={1.8} />
            <span className={styles.lab}>Colchón</span>
          </div>
          {colchon.estado === 'ok' ? (
            <div className={`${styles.val} ${colchonAlerta ? styles.warn : ''} mono`}>
              {fmtMeses(colchon.meses)} meses
            </div>
          ) : (
            <div className={`${styles.val} mono`}>—</div>
          )}
          <div className={styles.cardSub}>{colchonSub}</div>
        </div>

        {/* Sin conciliar */}
        <div className={`${styles.card} ${conciliarAlerta ? styles.alerta : ''}`}>
          <div className={styles.cardHd}>
            <Icons.HandCoins size={15} strokeWidth={1.8} />
            <span className={styles.lab}>Sin conciliar</span>
          </div>
          <div className={`${styles.val} ${conciliarAlerta ? styles.warn : ''} mono`}>
            {fmtEur(sinConciliar.total)}
          </div>
          <div className={styles.cardSub}>
            {conciliarAlerta
              ? `${sinConciliar.count} ingreso${sinConciliar.count === 1 ? '' : 's'} previsto${sinConciliar.count === 1 ? '' : 's'} vencido${sinConciliar.count === 1 ? '' : 's'} · pendiente de cuadrar con el banco`
              : 'todos los ingresos previstos están cuadrados con el banco'}
          </div>
        </div>

        {/* Próximos 30 días · alcance declarado */}
        <div className={`${styles.card} ${proximosAlerta ? styles.alerta : ''}`}>
          <div className={styles.cardHd}>
            <Icons.Calendar size={15} strokeWidth={1.8} />
            <span className={styles.lab}>Próximos 30 días</span>
          </div>
          <div className={`${styles.val} ${proximosAlerta ? styles.warn : ''} mono`}>
            {proximosAlerta ? `${proximos30.count} cosa${proximos30.count === 1 ? '' : 's'}` : 'nada'}
          </div>
          <div className={styles.cardSub}>
            {proximos30.primero ? `${proximos30.primero} · ` : ''}
            vencimientos de contrato y modelo 130 · seguros e IBI aún no vigilados
          </div>
        </div>

        {/* Impuesto acumulado */}
        <div className={styles.card}>
          <div className={styles.cardHd}>
            <Icons.Impuestos size={15} strokeWidth={1.8} />
            <span className={styles.lab}>Impuesto acumulado</span>
          </div>
          {irpf ? (
            <>
              <div className={`${styles.val} mono`}>{fmtEur(irpf.cuota)}</div>
              <div className={styles.cardSub}>
                IRPF que llevas generado en {irpf.ejercicio} · lo pagarás en {irpf.ejercicio + 1}
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.val} mono`}>—</div>
              <div className={styles.cardSub}>
                sin datos suficientes · registra ingresos y gastos para estimarlo
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PuedesEstarTranquilo;
