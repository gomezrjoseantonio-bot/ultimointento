// Panel · "Puedes estar tranquilo" · cuatro tarjetas.
// Principio §B.2: callado cuando todo va bien (tinta neutra, borde --line).
// Solo aparece color (warn) cuando la tarjeta requiere acción.
//
// Honestidad de etiquetas (informe FASE A §3 · VOCABULARIO-dinero §6 ter):
//   · "Por confirmar" (no "sin cobrar" ni "sin conciliar"): no podemos afirmar
//     impago. Y NO es conciliación —conciliar es cuadrar contra un extracto
//     importado, y aquí no se ha subido ninguno—: lo que falta es que el usuario
//     confirme (puntee) que el cobro entró. Misma palabra que Tesorería.
//   · "Próximos 30 días": el subtítulo DECLARA el alcance (contratos + modelo
//     130 · seguros e IBI no vigilados) para no dar tranquilidad falsa.
//   · Colchón: divisor = cuota mensual de préstamos (decisión Jose).

import React from 'react';
import { Icons } from '../../../design-system/v5';
import { fmtEur, fmtMeses } from './format';
import type { ColchonVM, PorConfirmarVM, Proximos30VM, IrpfVM } from './types';
import styles from './PuedesEstarTranquilo.module.css';

export interface PuedesEstarTranquiloProps {
  colchon: ColchonVM;
  porConfirmar: PorConfirmarVM;
  proximos30: Proximos30VM;
  irpf: IrpfVM | null;
}

const PuedesEstarTranquilo: React.FC<PuedesEstarTranquiloProps> = ({
  colchon,
  porConfirmar,
  proximos30,
  irpf,
}) => {
  const colchonAlerta = colchon.estado === 'ok' && colchon.meses < 3;
  const porConfirmarAlerta = porConfirmar.count > 0;
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

        {/* Por confirmar */}
        <div className={`${styles.card} ${porConfirmarAlerta ? styles.alerta : ''}`}>
          <div className={styles.cardHd}>
            <Icons.HandCoins size={15} strokeWidth={1.8} />
            <span className={styles.lab}>Por confirmar</span>
          </div>
          <div className={`${styles.val} ${porConfirmarAlerta ? styles.warn : ''} mono`}>
            {fmtEur(porConfirmar.total)}
          </div>
          <div className={styles.cardSub}>
            {porConfirmarAlerta
              ? `${porConfirmar.count} ingreso${porConfirmar.count === 1 ? '' : 's'} previsto${porConfirmar.count === 1 ? '' : 's'} vencido${porConfirmar.count === 1 ? '' : 's'} · aún sin confirmar que ha${porConfirmar.count === 1 ? '' : 'n'} entrado`
              : 'todos los ingresos previstos están confirmados'}
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

        {/* Resultado renta · lo que TOCARÍA liquidar, no el IRPF bruto */}
        <div className={styles.card}>
          <div className={styles.cardHd}>
            <Icons.Impuestos size={15} strokeWidth={1.8} />
            <span className={styles.lab}>Resultado renta</span>
          </div>
          {irpf ? (
            <>
              <div className={`${styles.val} mono`}>{fmtEur(Math.abs(irpf.resultado))}</div>
              <div className={styles.cardSub}>
                {irpf.resultado > 0
                  ? `a pagar en la renta de ${irpf.ejercicio + 1} · ya descontado lo retenido en nómina`
                  : irpf.resultado < 0
                    ? `a devolver en la renta de ${irpf.ejercicio + 1} · según lo retenido en ${irpf.ejercicio}`
                    : `justo cubierto con lo retenido en ${irpf.ejercicio} · sin renta a pagar`}
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
