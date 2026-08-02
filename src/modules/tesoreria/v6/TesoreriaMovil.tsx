// ============================================================================
// Tesorería V6 · §4.11 · móvil
// ============================================================================
//
// Mockup: `docs/mockups/atlas-tesoreria-v6-movil.html`.
//
// No es la pantalla de escritorio encogida: es OTRA pantalla, porque la
// pregunta cambia. En el escritorio se planifica ("¿tengo para lo que viene?");
// en el móvil se despacha ("¿qué me queda por confirmar?"). Por eso aquí no hay
// carrusel de cuentas ni proyección a seis meses, sino una sola lista de
// pendientes agrupados por cuenta y confirmables con el pulgar.
//
// La recompensa de terminar es la pantalla de "nada pendiente": si el usuario
// no ve que ha acabado, no sabe que puede irse.
// ============================================================================

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, TreasuryEvent } from '../../../services/db';
import { colorDeBanco } from './bancoColores';
import { importeConSigno, importeSaldo, nombreMes } from './formatoV6';
import { agruparPendientesPorCuenta, contarPendientes } from './movilAgrupacion';
import styles from './TesoreriaMovil.module.css';

export interface TesoreriaMovilProps {
  cuentas: Account[];
  eventos: TreasuryEvent[];
  saldoPorCuenta: Map<number, number>;
  saldoHoy: number;
  cierre: number;
  month0: number;
  aliasInmueble?: (id: number | string) => string | undefined;
  /** Toque en el círculo · confirma y el saldo se mueve al instante (§4.11). */
  onConfirmar: (eventoId: number) => void | Promise<void>;
  onSubirExtracto: () => void;
}

const TesoreriaMovil: React.FC<TesoreriaMovilProps> = ({
  cuentas,
  eventos,
  saldoPorCuenta,
  saldoHoy,
  cierre,
  month0,
  aliasInmueble,
  onConfirmar,
  onSubirExtracto,
}) => {
  const grupos = useMemo(
    () => agruparPendientesPorCuenta({ cuentas, eventos, saldoPorCuenta, aliasInmueble }),
    [cuentas, eventos, saldoPorCuenta, aliasInmueble]
  );
  const pendientes = contarPendientes(grupos);
  const mes = nombreMes(month0);
  const cuentasVivas = cuentas.filter((c) => c.status !== 'DELETED').length;

  return (
    <div className={styles.movil}>
      <header className={styles.cab}>
        <h1 className={styles.cabT}>Tesorería</h1>
        <span className={styles.cabS}>
          {pendientes > 0 ? `${pendientes} por confirmar · ${mes}` : `al día · ${mes}`}
        </span>
      </header>

      {/* Mini-hero navy · saldo hoy + cierre en oro (§4.11). */}
      <div className={styles.hero}>
        <div className={styles.heroL}>Saldo hoy</div>
        <div className={styles.heroRow}>
          <span className={styles.heroBig}>{importeSaldo(saldoHoy)}</span>
          <span className={styles.heroFin}>
            <span className={styles.heroFinL}>Cierre</span>
            <span className={styles.heroFinV}>{importeSaldo(cierre)}</span>
          </span>
        </div>
      </div>

      <div className={styles.cuerpo}>
        {pendientes === 0 ? (
          /* La recompensa · sin esto el usuario no sabe que ha terminado. */
          <div className={styles.alDia}>
            <div className={styles.alDiaIc}>
              <Icons.Success size={30} strokeWidth={1.6} />
            </div>
            <div className={styles.alDiaT}>Nada por confirmar</div>
            <div className={styles.alDiaS}>
              {cuentasVivas === 1
                ? 'Tu cuenta está al día.'
                : `Tus ${cuentasVivas} cuentas están al día.`}
            </div>
            <div className={styles.alDiaFin}>
              <div className={styles.alDiaFinL}>Cierre · {mes}</div>
              <div className={styles.alDiaFinV}>{importeSaldo(cierre)}</div>
            </div>
          </div>
        ) : (
          grupos.map((g) => (
            <section key={g.cuenta.id} className={styles.grupo}>
              <div className={styles.sep}>
                <span
                  className={styles.sepDot}
                  style={{ background: colorDeBanco(g.cuenta) }}
                  aria-hidden="true"
                />
                <span className={styles.sepNom}>{g.cuenta.alias || g.cuenta.banco?.name}</span>
                {g.cuenta.ultimosCuatro && (
                  <span className={styles.sepMask}>····{g.cuenta.ultimosCuatro}</span>
                )}
              </div>

              <div className={styles.tarjeta}>
                {g.pendientes.map((p) => (
                  <button
                    key={p.eventoId}
                    type="button"
                    className={styles.fila}
                    onClick={() => void onConfirmar(p.eventoId)}
                    aria-label={`Confirmar ${p.concepto} · ${importeConSigno(p.importe)}`}
                  >
                    {/* Objetivo grande a propósito: se pulsa con el pulgar. */}
                    <span className={styles.check} aria-hidden="true">
                      <Icons.Check size={15} strokeWidth={2.6} />
                    </span>
                    <span className={styles.info}>
                      <span className={styles.concepto}>{p.concepto}</span>
                      {p.detalle && <span className={styles.detalle}>{p.detalle}</span>}
                    </span>
                    <span className={styles.importe}>{importeConSigno(p.importe)}</span>
                  </button>
                ))}
              </div>

              {/* Un solo aviso por cuenta, y solo si de verdad se queda corta. */}
              {g.seQuedaCorta && (
                <div className={styles.aviso}>
                  se queda en {importeSaldo(g.saldoProyectado)}
                </div>
              )}
            </section>
          ))
        )}

        <div className={styles.cta}>
          <button type="button" className={styles.ctaBtn} onClick={onSubirExtracto}>
            <Icons.Upload size={16} strokeWidth={1.8} /> Subir extracto
          </button>
        </div>
      </div>
    </div>
  );
};

export default TesoreriaMovil;
