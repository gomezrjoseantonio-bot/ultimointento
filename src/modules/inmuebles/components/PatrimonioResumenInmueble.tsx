import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import type { PatrimonioInmuebleResumen } from '../adapters/patrimonioInmuebleAdapter';
import ComposicionPatrimonioNeto from './ComposicionPatrimonioNeto';
import CosteDePropiedadCard from './CosteDePropiedadCard';
import GananciaAcumuladaCard from './GananciaAcumuladaCard';
import HistoricoValoracionesChart from './HistoricoValoracionesChart';
import ValorHoyHero, { calcularCambioAnual } from './ValorHoyHero';
import styles from './PatrimonioResumenInmueble.module.css';

/** Coste mensual de tener el activo · importes ya calculados en la página. */
export interface CostePropiedadMensual {
  hipoteca: number;
  mantenimiento: number;
  explotacion: number;
}

/** Ganancia acumulada · rentas netas declaradas + año desde el que se acumulan. */
export interface GananciaAcumuladaDatos {
  rentasAcumuladas: number;
  desdeAnio: number | null;
}

export interface PatrimonioResumenInmuebleProps {
  resumen: PatrimonioInmuebleResumen;
  /** Ganancia acumulada · si se omite no se muestra el bloque. */
  gananciaAcumulada?: GananciaAcumuladaDatos;
  /** Coste de propiedad mensual · si se omite (o suma 0) no se muestra el bloque. */
  costePropiedad?: CostePropiedadMensual;
  /** Abre el wizard de importación de histórico de valoraciones. */
  onImportarValoraciones?: () => void;
  /** Navega a la financiación · sin `id` va al listado, con `id` al préstamo. */
  onVerFinanciacion?: (prestamoId?: string) => void;
}

/** Formatea YYYY-MM o YYYY-MM-DD a un `mmm YYYY` legible en es-ES. */
const formatMes = (fecha: string): string => {
  const [anio, mes] = fecha.split('-');
  const idx = Number(mes) - 1;
  const MESES = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return idx >= 0 && idx < 12 ? `${MESES[idx]} ${anio}` : fecha;
};

const PatrimonioResumenInmueble: React.FC<PatrimonioResumenInmuebleProps> = ({
  resumen,
  gananciaAcumulada,
  costePropiedad,
  onImportarValoraciones,
  onVerFinanciacion,
}) => {
  const {
    costeAdquisicion,
    valorActual,
    fechaValorActual,
    deudaPendiente,
    tieneFinanciacion,
    patrimonioNeto,
    patrimonioNetoEsEstimado,
    revalorizacion,
    revalorizacionPct,
    mejorasAcumuladas,
    mobiliarioAcumulado,
    ltv,
    financiacion,
    historicoValoraciones,
  } = resumen;

  const principalInicialTotal = financiacion.reduce(
    (suma, linea) => suma + linea.principalInicial,
    0,
  );

  const costeMensualTotal = costePropiedad
    ? costePropiedad.hipoteca + costePropiedad.mantenimiento + costePropiedad.explotacion
    : 0;

  const cambioAnual = calcularCambioAnual(historicoValoraciones);

  const bloqueFinanciacion = (
    <div className={styles.block}>
      <div className={styles.blockHd}>
        <div>
          <div className={styles.title}>Financiación vinculada</div>
          <div className={styles.sub}>préstamos que financian este inmueble</div>
        </div>
        {onVerFinanciacion && (
          <button type="button" className={styles.linkBtn} onClick={() => onVerFinanciacion()}>
            Gestionar financiación
          </button>
        )}
      </div>
      {financiacion.length > 0 ? (
        <div className={styles.list}>
          {financiacion.map((linea) => (
            <div key={linea.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>{linea.nombre}</span>
                <span className={styles.rowMeta}>
                  Cuota <MoneyValue value={linea.cuotaMensual} decimals={0} /> / mes
                  {linea.porcentajeAfectacion < 100 &&
                    ` · afectación ${linea.porcentajeAfectacion.toFixed(0)} %`}
                </span>
              </div>
              <div className={styles.rowRight}>
                <span className={styles.rowValue}>
                  <MoneyValue value={linea.deudaPendiente} decimals={0} />
                </span>
                {onVerFinanciacion && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => onVerFinanciacion(linea.id)}
                  >
                    Ver préstamo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          <div className={styles.emptyRow}>
            <span>Sin financiación vinculada a este inmueble.</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      {/* ── Cockpit · izquierda (valor + evolución + composición) · derecha (cifras) ── */}
      <div className={styles.cockpit}>
        <div className={styles.colMain}>
          {/* Valor hoy · hero */}
          <ValorHoyHero
            valorActual={valorActual}
            fechaEtiqueta={fechaValorActual ? formatMes(fechaValorActual) : null}
            revalorizacionPct={revalorizacionPct}
            cambioAnual={cambioAnual}
          />

          {/* Histórico de valoraciones */}
          <div className={styles.block}>
            <div className={styles.blockHd}>
              <div>
                <div className={styles.title}>Histórico de valoraciones</div>
                <div className={styles.sub}>evolución del valor registrado del activo</div>
              </div>
              {onImportarValoraciones && (
                <button type="button" className={styles.linkBtn} onClick={onImportarValoraciones}>
                  Importar histórico
                </button>
              )}
            </div>
            {historicoValoraciones.length > 0 ? (
              <HistoricoValoracionesChart puntos={historicoValoraciones} />
            ) : (
              <div className={styles.list}>
                <div className={styles.emptyRow}>
                  <span>Aún no hay valoraciones registradas.</span>
                  {onImportarValoraciones && (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={onImportarValoraciones}
                    >
                      Importar histórico
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Composición del patrimonio neto */}
          <div className={styles.block}>
            <div className={styles.blockHd}>
              <div>
                <div className={styles.title}>Composición del patrimonio neto</div>
                <div className={styles.sub}>de qué se compone tu patrimonio en este activo</div>
              </div>
            </div>
            <ComposicionPatrimonioNeto
              costeAdquisicion={costeAdquisicion}
              valorActual={valorActual}
              deudaPendiente={deudaPendiente}
              patrimonioNeto={patrimonioNeto}
              revalorizacion={revalorizacion}
              principalInicialTotal={principalInicialTotal}
            />
          </div>
        </div>

        <div className={styles.colSide}>
          {/* Foto patrimonial · neto + deuda */}
          <div className={styles.block}>
            <div className={styles.blockHd}>
              <div>
                <div className={styles.title}>Patrimonio</div>
                <div className={styles.sub}>deuda y patrimonio neto del activo</div>
              </div>
            </div>
            <div className={styles.gridSide}>
              <div className={`${styles.card} ${styles.cardStrong}`}>
                <div className={styles.cardLabel}>Patrimonio neto</div>
                <div className={styles.cardValue}>
                  <MoneyValue value={patrimonioNeto} decimals={0} />
                </div>
                <div className={patrimonioNetoEsEstimado ? styles.badgeEst : styles.badge}>
                  {patrimonioNetoEsEstimado ? '≈ Sobre coste' : 'Valor − deuda'}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Deuda pendiente</div>
                {tieneFinanciacion ? (
                  <>
                    <div className={`${styles.cardValue} ${styles.neg}`}>
                      <MoneyValue value={deudaPendiente} decimals={0} />
                    </div>
                    <div className={styles.badge}>
                      {ltv !== null ? `LTV ${ltv.toFixed(0)} %` : 'Capital vivo'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.cardValue}>
                      <MoneyValue value={0} decimals={0} />
                    </div>
                    <div className={styles.badge}>Sin financiación</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Ganancia acumulada */}
          {gananciaAcumulada &&
            (revalorizacion !== null || gananciaAcumulada.rentasAcumuladas !== 0) && (
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div>
                    <div className={styles.title}>Ganancia acumulada</div>
                    <div className={styles.sub}>revalorización latente + rentas netas declaradas</div>
                  </div>
                </div>
                <GananciaAcumuladaCard
                  revalorizacion={revalorizacion}
                  rentasAcumuladas={gananciaAcumulada.rentasAcumuladas}
                  costeBase={costeAdquisicion}
                  desdeAnio={gananciaAcumulada.desdeAnio}
                />
              </div>
            )}

          {/* Coste de propiedad */}
          {costePropiedad && costeMensualTotal > 0 && (
            <div className={styles.block}>
              <div className={styles.blockHd}>
                <div>
                  <div className={styles.title}>Coste de propiedad</div>
                  <div className={styles.sub}>lo que cuesta tener el activo cada mes</div>
                </div>
              </div>
              <CosteDePropiedadCard
                hipoteca={costePropiedad.hipoteca}
                mantenimiento={costePropiedad.mantenimiento}
                explotacion={costePropiedad.explotacion}
              />
            </div>
          )}

          {/* Financiación vinculada */}
          {bloqueFinanciacion}
        </div>
      </div>

      {/* ── Coste y revalorización · ancho completo ── */}
      <div className={styles.block}>
        <div className={styles.blockHd}>
          <div>
            <div className={styles.title}>Coste y revalorización</div>
            <div className={styles.sub}>coste de adquisición frente al valor actual</div>
          </div>
        </div>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Coste de adquisición</div>
            <div className={styles.cardValue}>
              <MoneyValue value={costeAdquisicion} decimals={0} />
            </div>
            <div className={styles.badge}>precio + gastos + impuestos</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Revalorización</div>
            {revalorizacion !== null ? (
              <>
                <div className={`${styles.cardValue} ${revalorizacion >= 0 ? styles.pos : styles.neg}`}>
                  {revalorizacion >= 0 ? '+' : '−'}
                  <MoneyValue value={Math.abs(revalorizacion)} decimals={0} />
                </div>
                {revalorizacionPct !== null && (
                  <div className={`${styles.delta} ${revalorizacion >= 0 ? styles.pos : styles.neg}`}>
                    {revalorizacion >= 0 ? '+' : '−'}
                    {Math.abs(revalorizacionPct).toFixed(1)} % sobre coste
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.noData}>Requiere una valoración</div>
                <div className={styles.badgeNa}>No disponible</div>
              </>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Mejoras acumuladas</div>
            <div className={styles.cardValue}>
              <MoneyValue value={mejorasAcumuladas} decimals={0} />
            </div>
            <div className={styles.badge}>CAPEX · sin reparaciones</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Mobiliario acumulado</div>
            <div className={styles.cardValue}>
              <MoneyValue value={mobiliarioAcumulado} decimals={0} />
            </div>
            <div className={styles.badge}>enseres vigentes</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatrimonioResumenInmueble;
