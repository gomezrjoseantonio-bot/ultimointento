import React, { useMemo } from 'react';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { MoneyValue } from '../../../design-system/v5';
import {
  construirListaVisualGastosInmueble,
  calcularResumenGastosInmueble,
  type ResumenGrupoInmueble,
} from '../adapters/gastosInmuebleAdapter';
import styles from './GastosResumenInmueble.module.css';

export interface GastosResumenInmuebleProps {
  inmuebleId: number;
  /** Año seleccionado para filtrar gastos reales. Sin valor → sin filtro por año. */
  ejercicio?: number;
  compromisos?: readonly CompromisoRecurrente[];
  gastosReales?: readonly GastoInmueble[];
  mejoras?: readonly MejoraInmueble[];
  mobiliario?: readonly MuebleInmueble[];
}

interface GrupoConfig {
  key: 'mantener' | 'explotar' | 'mejorar' | 'mobiliario';
  label: string;
  hint: string;
}

const GRUPOS: GrupoConfig[] = [
  { key: 'mantener', label: 'Mantener el activo', hint: 'IBI, comunidad, seguros…' },
  { key: 'explotar', label: 'Explotar el activo', hint: 'Luz, agua, gestión…' },
  { key: 'mejorar',  label: 'Mejorar el activo',  hint: 'Reformas y capex' },
  { key: 'mobiliario', label: 'Mobiliario', hint: 'Muebles y equipamiento' },
];

interface TarjetaGrupoProps {
  config: GrupoConfig;
  datos: ResumenGrupoInmueble;
  /** Si true, el grupo admite compromisos recurrentes (mantener y explotar). */
  tieneRecurrentes: boolean;
}

function TarjetaGrupo({ config, datos, tieneRecurrentes }: TarjetaGrupoProps): React.ReactElement {
  const { key, label, hint } = config;
  const { previsto, real } = datos;
  const sinDatos = previsto === undefined && real === undefined;

  let diferencia: number | undefined = undefined;
  if (tieneRecurrentes && previsto !== undefined && real !== undefined) {
    diferencia = previsto - real;
  }

  return (
    <div className={`${styles.grupoCard} ${styles[key]}`}>
      <div className={styles.grupoLabel}>{label}</div>
      {sinDatos ? (
        <div className={styles.grupoVacio}>{hint} · sin datos</div>
      ) : (
        <>
          {previsto !== undefined && tieneRecurrentes && (
            <div className={styles.grupoRow}>
              <span className={styles.grupoTag}>Previsto</span>
              <span className={styles.grupoImporte}>
                <MoneyValue value={previsto} decimals={0} />
              </span>
            </div>
          )}
          {real !== undefined && (
            <div className={styles.grupoRow}>
              <span className={styles.grupoTag}>Real</span>
              <span className={styles.grupoImporte}>
                <MoneyValue value={real} decimals={0} />
              </span>
            </div>
          )}
          {diferencia !== undefined && (
            <div className={`${styles.grupoDiff} ${diferencia > 0 ? styles.pos : diferencia < 0 ? styles.neg : ''}`}>
              {diferencia > 0
                ? `+${diferencia.toFixed(0)} € pendiente`
                : diferencia < 0
                  ? `${Math.abs(diferencia).toFixed(0)} € sobre previsto`
                  : 'Ajustado'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Resumen económico de gastos de un inmueble, diferenciado por grupo visual.
 * Recibe datos por props; no lee IndexedDB.
 */
export function GastosResumenInmueble({
  inmuebleId,
  ejercicio,
  compromisos,
  gastosReales,
  mejoras,
  mobiliario,
}: GastosResumenInmuebleProps): React.ReactElement {
  const resumen = useMemo(() => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId,
      compromisosRecurrentes: compromisos ?? [],
      gastosReales: gastosReales ?? [],
      mejoras: mejoras ?? [],
      mobiliario: mobiliario ?? [],
    });
    return calcularResumenGastosInmueble(lista, ejercicio);
  }, [inmuebleId, ejercicio, compromisos, gastosReales, mejoras, mobiliario]);

  const { mantener, explotar, mejorar, mobiliario: mobResumen, total } = resumen;

  const datosPorGrupo: Record<string, ResumenGrupoInmueble> = {
    mantener,
    explotar,
    mejorar,
    mobiliario: mobResumen,
  };

  const hayAlgunDato =
    mantener.previsto !== undefined || mantener.real !== undefined ||
    explotar.previsto !== undefined || explotar.real !== undefined ||
    mejorar.real !== undefined ||
    mobResumen.real !== undefined;

  return (
    <div className={styles.resumen}>
      <div className={styles.grupos}>
        {GRUPOS.map((cfg) => (
          <TarjetaGrupo
            key={cfg.key}
            config={cfg}
            datos={datosPorGrupo[cfg.key] ?? {}}
            tieneRecurrentes={cfg.key === 'mantener' || cfg.key === 'explotar'}
          />
        ))}
      </div>

      {hayAlgunDato && (
        <div className={styles.total}>
          <div className={styles.totalLabel}>Total del inmueble</div>

          {total.previstoRecurrente !== undefined && (
            <div className={styles.totalItem}>
              <div className={styles.totalItemLabel}>Previsto recurrente</div>
              <div className={styles.totalItemValor}>
                <MoneyValue value={total.previstoRecurrente} decimals={0} />
              </div>
            </div>
          )}

          {total.realOrdinario !== undefined && (
            <div className={styles.totalItem}>
              <div className={styles.totalItemLabel}>Real registrado</div>
              <div className={styles.totalItemValor}>
                <MoneyValue value={total.realOrdinario} decimals={0} />
              </div>
            </div>
          )}

          {total.mejoras !== undefined && (
            <div className={styles.totalItem}>
              <div className={styles.totalItemLabel}>Mejoras</div>
              <div className={styles.totalItemValor}>
                <MoneyValue value={total.mejoras} decimals={0} />
              </div>
            </div>
          )}

          {total.mobiliarioReal !== undefined && (
            <div className={styles.totalItem}>
              <div className={styles.totalItemLabel}>Mobiliario</div>
              <div className={styles.totalItemValor}>
                <MoneyValue value={total.mobiliarioReal} decimals={0} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GastosResumenInmueble;
