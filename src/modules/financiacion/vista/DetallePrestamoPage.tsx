// ENTREGABLE B · el detalle de un préstamo · `/financiacion/:id`.
//
// Una vista sin scroll: breadcrumb, hero navy de 6 KPIs y una rejilla 2×2 de
// tarjetas. Fuente visual · `atlas-prestamo-detalle-v3.html` (mixto) y
// `atlas-prestamo-detalle-personal-v1.html` (fijo simple).
//
// **El patrón se adapta al tipo de préstamo**, que es lo que distingue las dos
// fichas: un fijo simple no tiene tramos que contar ni bonificaciones que
// seguir, y enseñarle una tarjeta de bonificaciones vacía sería decirle que le
// falta algo. Su hueco lo ocupa lo que en él sí aporta —el cuadro— y la ficha
// gana la tarjeta de fiscalidad, donde se explica POR QUÉ no deduce.
//
// Como en la vista principal: cada número sale de `generarCuadro` vía
// `services/prestamos/lecturas`. Nada de `helpers.ts`.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import { prestamosService } from '../../../services/prestamosService';
import { movimientosQuePrueban } from '../../../services/bonificaciones/movimientosQuePrueban';
import { verificarBonificaciones } from '../../../services/bonificaciones/verificarBonificaciones';
import type { Cumplimiento } from '../../../services/bonificaciones/cumplimiento';
import LoanSettlementModal from '../../horizon/financiacion/components/LoanSettlementModal';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import {
  getCapitalVivo,
  getCuota,
  getFechaVencimiento,
  getInteresDeducible,
  getInteresPendiente,
  getPctAmortizado,
  getPreviewCuadro,
  getPrincipalInicial,
  getProgresoCuotas,
  getProximaRevision,
  getTinVigente,
} from '../../../services/prestamos/lecturas';
import { cuadroSeguroDe, metaDestino } from './datos';
import {
  condicionesDe,
  fiscalidadDe,
  lineaDeTiempo,
  resumenBonificaciones,
} from './detalleDatos';
import {
  anio as soloAnio,
  diaMesAnio,
  eurAFavor,
  eurDeuda,
  eurPlano,
  mesAnio,
  pct,
} from './formato';
import styles from './DetallePrestamo.module.css';

/** Hoy en ISO · el día del calendario del usuario (ver la vista principal). */
const hoyISO = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const ETIQUETA_TIPO: Record<string, string> = {
  FIJO: 'tipo fijo',
  VARIABLE: 'tipo variable',
  MIXTO: 'tipo mixto',
};

/**
 * Un valor de índice o diferencial · «2,100» · «—» si el préstamo no lo trae.
 *
 * Nada de `?? 0`: un cero es un valor válido —hubo Euríbor negativo, y hay
 * diferenciales a cero— así que escribirlo por un dato ausente sería enseñar
 * como hecho algo que nadie ha dicho.
 */
const cifraIndice = (v: number | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3).replace('.', ',') : '—';

/** Los cuatro últimos dígitos del contrato · «····4021». */
const enmascarado = (numero: string | undefined): string | null => {
  const limpio = (numero ?? '').replace(/\s/g, '');
  return limpio.length >= 4 ? `····${limpio.slice(-4)}` : null;
};

const Segmentos: React.FC<{ pct: number }> = ({ pct: valor }) => {
  const encendidos = Math.round(Math.min(100, Math.max(0, valor)) / 10);
  return (
    <div className={styles.heroAmort} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < encendidos ? styles.pipOn : undefined} />
      ))}
    </div>
  );
};

const DetallePrestamoPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { prestamos, reload } = useOutletContext<FinanciacionOutletContext>();
  const [amortizando, setAmortizando] = useState(false);

  const hoy = useMemo(() => hoyISO(), []);

  // Lo que demuestran tus movimientos · se pide una vez y la tarjeta lo espera
  // sin bloquear: el contrato se enseña ya, el veredicto llega cuando llega.
  const [cumplimientos, setCumplimientos] = useState<Cumplimiento[] | undefined>(undefined);
  const prestamo = useMemo(() => prestamos.find((p) => p.id === id), [prestamos, id]);
  const cuadro = useMemo(() => (prestamo ? cuadroSeguroDe(prestamo) : null), [prestamo]);

  const bonificaciones0 = prestamo?.bonificaciones;
  useEffect(() => {
    if (!bonificaciones0?.length) return;
    let cancelado = false;
    (async () => {
      try {
        const movimientos = await movimientosQuePrueban(Number(hoy.slice(0, 4)));
        if (!cancelado) setCumplimientos(verificarBonificaciones(bonificaciones0, movimientos, hoy));
      } catch {
        // Sin poder mirar la tesorería la ficha sigue siendo útil · lo que no
        // se hace es inventar un veredicto.
        if (!cancelado) setCumplimientos(undefined);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [bonificaciones0, hoy]);

  const datos = useMemo(() => {
    if (!prestamo || !cuadro) return null;
    const anio = Number(hoy.slice(0, 4));
    const fiscalidad = fiscalidadDe(prestamo);
    return {
      capitalVivo: getCapitalVivo(cuadro, hoy),
      principalInicial: getPrincipalInicial(cuadro),
      cuota: getCuota(cuadro, hoy),
      tin: getTinVigente(prestamo, hoy),
      pctAmortizado: getPctAmortizado(cuadro, hoy),
      progreso: getProgresoCuotas(cuadro, hoy),
      vencimiento: getFechaVencimiento(cuadro),
      revision: getProximaRevision(prestamo, cuadro, hoy, 365),
      deducible: getInteresDeducible(prestamo, cuadro, anio),
      interesPendiente: getInteresPendiente(cuadro, hoy),
      preview: getPreviewCuadro(cuadro, hoy, 3),
      tiempo: lineaDeTiempo(prestamo, cuadro, hoy),
      bonificaciones: resumenBonificaciones(prestamo, cumplimientos),
      condiciones: condicionesDe(prestamo, cuadro),
      fiscalidad,
    };
  }, [prestamo, cuadro, hoy, cumplimientos]);

  // Una liquidación TOTAL deja el préstamo cancelado, y entonces esta ficha ya
  // no tiene sujeto: hay que salir a la cartera en vez de quedarse enseñando un
  // «no encontrado» después de una operación que ha ido bien.
  const alAmortizar = useCallback(async () => {
    setAmortizando(false);
    await reload();
    if (!id) return;
    const fresco = await prestamosService.getPrestamoById(id);
    if (!fresco || fresco.activo === false || fresco.estado === 'cancelado') {
      navigate('/financiacion');
    }
  }, [id, navigate, reload]);

  if (!prestamo || !cuadro || !datos) {
    return (
      <div className={styles.noEncontrado}>
        <div>
          Préstamo no encontrado · puede haber sido eliminado, o sus datos no dan para
          un cuadro de amortización.
        </div>
        <button type="button" className={styles.btnGhost} onClick={() => navigate('/financiacion')}>
          <Icons.ChevronLeft size={14} strokeWidth={2} />
          Volver a Financiación
        </button>
      </div>
    );
  }

  const { tiempo, bonificaciones, fiscalidad } = datos;
  const esMixtoOVariable = prestamo.tipo !== 'FIJO';
  const hayBonificaciones = bonificaciones.lista.length > 0;
  const numContrato = enmascarado(prestamo.numeroContrato);

  // El 6º KPI cambia de pregunta según el préstamo: en uno deducible interesa
  // cuánto te devuelve Hacienda; en uno que no lo es, esa cifra sería siempre
  // cero y lo que sí queda por saber es cuánto te falta de coste.
  //
  // Lo decide SOLO si el préstamo es deducible, no si este año ya ha devengado
  // intereses: una hipoteca firmada en diciembre deduce igual, y mirar la cifra
  // le cambiaría el KPI de significado según el mes en que se abriera la ficha.
  // Deducible con 0 € todavía enseña 0 €, que es la respuesta correcta.
  const mostrarDeducible = fiscalidad.deducible;

  return (
    <div className={styles.detalle}>
      {/* ── Breadcrumb · sin logo de banco en la cabecera (se quitó en v3) ── */}
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.volver} onClick={() => navigate('/financiacion')}>
          <Icons.ChevronLeft size={12} strokeWidth={2.5} />
          Volver
        </button>
        <button type="button" className={styles.migaLink} onClick={() => navigate('/financiacion')}>
          Financiación
        </button>
        <Icons.ChevronRight size={11} strokeWidth={2} aria-hidden />
        <span className={styles.migaActual}>{prestamo.nombre || 'Préstamo'}</span>
      </div>

      <div className={styles.head}>
        <div className={styles.headIzq}>
          <h1 className={styles.titulo}>{prestamo.nombre || 'Préstamo sin nombre'}</h1>
          <div className={styles.sub}>
            {ETIQUETA_TIPO[prestamo.tipo] ?? 'préstamo'} · destino{' '}
            <span className={styles.mono}>{metaDestino(prestamo)}</span>
            {numContrato && (
              <>
                {' · nº '}
                <span className={styles.mono}>{numContrato}</span>
              </>
            )}
          </div>
        </div>
        <div className={styles.headAcciones}>
          {/* No hay pantalla ni documento de FEIN enlazable todavía · el botón
              se deja visible y deshabilitado en vez de inventar un destino. */}
          <button type="button" className={styles.btnGhost} disabled title="Pendiente · no hay FEIN enlazada">
            <Icons.Contratos size={14} strokeWidth={2} />
            Ver FEIN
          </button>
          {/* Tercera acción · no está en el mockup, pero adelantar capital es
              una operación real que ya funciona y el Detalle era su única
              puerta. Decisión de Jose · se mantiene aquí hasta que Mi Plan /
              Acelerar le dé sitio propio. */}
          <button type="button" className={styles.btnGhost} onClick={() => setAmortizando(true)}>
            <Icons.Amortizar size={14} strokeWidth={2} />
            Amortizar
          </button>
          <button
            type="button"
            className={styles.btnOro}
            onClick={() => navigate(`/financiacion/${prestamo.id}/editar`)}
          >
            <Icons.Edit size={14} strokeWidth={2} />
            Editar
          </button>
        </div>
      </div>

      {/* ── HERO navy · 6 KPIs ── */}
      <div className={styles.hero}>
        <div className={styles.hk}>
          <div className={styles.hkLab}>Capital vivo</div>
          <div className={styles.hkVal}>{eurDeuda(datos.capitalVivo)}</div>
          <div className={styles.hkSub}>
            de <span className={styles.mono}>{eurPlano(datos.principalInicial)}</span> inicial
          </div>
        </div>

        <div className={styles.hk}>
          <div className={styles.hkLab}>Cuota{esMixtoOVariable ? ' actual' : ''}</div>
          <div className={styles.hkVal}>{eurDeuda(datos.cuota)}</div>
          <div className={styles.hkSub}>
            {datos.revision ? (
              <span className={styles.hkCambio}>
                {datos.revision.cuotaDespues > datos.revision.cuotaAntes ? '↑' : '↓'}{' '}
                {eurPlano(datos.revision.cuotaDespues)} desde{' '}
                {mesAnio(datos.revision.fecha).split(' ')[0]}
              </span>
            ) : (
              'constante · sin revisiones'
            )}
          </div>
        </div>

        <div className={styles.hk}>
          <div className={styles.hkLab}>
            TIN {bonificaciones.rebajaTotal > 0 ? 'bonificado' : prestamo.tipo === 'FIJO' ? 'fijo' : 'vigente'}
          </div>
          <div className={styles.hkVal}>{pct(datos.tin)}</div>
          <div className={styles.hkSub}>
            {datos.revision &&
            Math.abs(datos.revision.tinDespues - datos.revision.tinAntes) >= 0.005 ? (
              <>
                → <span className={styles.mono}>{pct(datos.revision.tinDespues).replace(' %', '')}</span>{' '}
                tras revisión
              </>
            ) : prestamo.tipo === 'FIJO' ? (
              'toda la vida del préstamo'
            ) : (
              'sin revisión a la vista'
            )}
          </div>
        </div>

        <div className={styles.hk}>
          <div className={styles.hkLab}>Amortizado</div>
          <Segmentos pct={datos.pctAmortizado} />
          <div className={styles.hkSub}>
            <span className={styles.mono}>{Math.round(datos.pctAmortizado)}%</span> ·{' '}
            <span className={styles.mono}>{datos.progreso.pagadas}</span> de{' '}
            <span className={styles.mono}>{datos.progreso.total}</span> cuotas
          </div>
        </div>

        <div className={styles.hk}>
          <div className={styles.hkLab}>Vence</div>
          <div className={`${styles.hkVal} ${styles.oro}`}>{mesAnio(datos.vencimiento)}</div>
          <div className={styles.hkSub}>
            quedan <span className={styles.mono}>{datos.progreso.restantes}</span> cuotas
          </div>
        </div>

        <div className={styles.hk}>
          <div className={styles.hkLab}>
            {mostrarDeducible ? `Deducible ${hoy.slice(0, 4)}` : 'Interés pendiente'}
          </div>
          <div className={styles.hkVal}>
            {mostrarDeducible ? eurAFavor(datos.deducible) : eurDeuda(datos.interesPendiente)}
          </div>
          <div className={styles.hkSub}>
            {mostrarDeducible ? (
              <>
                <span className={styles.mono}>{Math.round(fiscalidad.pctDeducible)}%</span> · casilla
                0105
              </>
            ) : (
              'lo que queda de coste'
            )}
          </div>
        </div>
      </div>

      {/* ── Rejilla 2×2 ── */}
      <div className={styles.rejilla}>
        {/* 1 · Tu tipo de interés · el contenido cambia con el tipo */}
        <div className={`${styles.card} ${styles.topBrand}`}>
          <div className={styles.cardT}>
            <Icons.Proyeccion size={15} strokeWidth={2} aria-hidden />
            Tu tipo de interés
            <span className={styles.cardNota}>
              {prestamo.tipo === 'FIJO' ? 'fijo · sin sorpresas' : `${ETIQUETA_TIPO[prestamo.tipo]?.replace('tipo ', '')} · con revisiones`}
            </span>
          </div>

          <div className={styles.tlWrap}>
            {tiempo.hoyPct != null && (
              <div className={styles.tlHoyLab} style={{ left: `${tiempo.hoyPct}%` }}>
                hoy · {soloAnio(hoy)}
              </div>
            )}
            <div className={styles.tlBar}>
              {tiempo.tramos.map((t) => (
                <div
                  key={t.desde}
                  className={t.tramo.variable ? styles.tlVar : styles.tlFijo}
                  style={{ width: `${t.anchoPct}%` }}
                />
              ))}
              {tiempo.hoyPct != null && (
                <div className={styles.tlHoy} style={{ left: `${tiempo.hoyPct}%` }} />
              )}
            </div>
            <div className={styles.tlEje}>
              <span className={styles.ejeIzq}>{soloAnio(tiempo.firma)} · firma</span>
              <span className={styles.ejeDer}>{soloAnio(tiempo.fin)} · fin</span>
            </div>
          </div>

          {tiempo.tramos.map((t) => {
            const teoricoDifiere = Math.abs(t.tinTeorico - t.tin) >= 0.005;
            return (
              <div key={`f-${t.desde}`} className={styles.tramo}>
                <div className={t.tramo.variable ? styles.dotVar : styles.dotFijo} />
                <div className={styles.tramoInfo}>
                  <div className={styles.tramoTit}>
                    {tiempo.tramos.length === 1
                      ? 'Tipo fijo'
                      : t.tramo.variable
                        ? 'Tramo variable'
                        : 'Tramo fijo'}
                  </div>
                  <div className={styles.tramoPer}>
                    {tiempo.tramos.length === 1
                      ? `las ${datos.progreso.total} cuotas · desde la firma hasta el final`
                      : t.tramo.variable
                        ? `${(prestamo.indice ?? 'índice').toLowerCase()} ${cifraIndice(
                            prestamo.valorIndiceActual,
                          )} + diferencial ${cifraIndice(prestamo.diferencial)}`
                        : `hasta ${mesAnio(t.hasta)}`}
                  </div>
                </div>
                <div className={styles.tramoVal}>
                  {pct(t.tin)}
                  <small>
                    {teoricoDifiere && (
                      <span className={styles.teorico}>
                        {pct(t.tinTeorico).replace(' %', '')} teórico
                      </span>
                    )}
                    {teoricoDifiere && ' · '}
                    cuota {eurPlano(t.cuota)} €
                  </small>
                </div>
              </div>
            );
          })}

          <div className={styles.revLine}>
            <Icons.Warning size={14} strokeWidth={2} aria-hidden />
            {datos.revision ? (
              <>
                próxima revisión{' '}
                <span className={styles.mono}>{diaMesAnio(datos.revision.fecha)}</span> · la cuota
                pasa a {eurPlano(datos.revision.cuotaDespues)} €
              </>
            ) : prestamo.tipo === 'FIJO' ? (
              'la cuota no cambia · sin revisiones que seguir'
            ) : (
              'sin revisiones apuntadas · lo que venga se proyecta con el último tipo conocido'
            )}
          </div>
        </div>

        {/* 2 · Bonificaciones si las hay · si no, su hueco lo ocupa el cuadro */}
        {hayBonificaciones ? (
          <div className={`${styles.card} ${styles.topGold}`}>
            <div className={styles.cardT}>
              <Icons.Check size={15} strokeWidth={2} aria-hidden />
              Bonificaciones
              <span className={styles.cardNota}>bajan tu diferencial</span>
            </div>
            <div className={styles.bonifLista}>
              {bonificaciones.lista.map((b) => (
                <div key={b.bonificacion.id} className={styles.bonif}>
                  <div className={styles.bonifIzq}>
                    <div
                      className={b.alcanzada ? styles.bonifCheck : styles.bonifPendiente}
                      aria-hidden
                    >
                      {b.alcanzada && <Icons.Check size={11} strokeWidth={3} />}
                    </div>
                  <span className={b.alcanzada ? undefined : styles.bonifApagada}>
                      {b.bonificacion.nombre}
                      {/* Lo que dicen TUS movimientos · otra pregunta distinta
                          de si el banco la está aplicando, y por eso va aparte
                          y no pisa el check. Cuando no coinciden es justo
                          cuando hay que enterarse: el banco te la aplica y has
                          dejado de cumplirla, o la cumples y no te la aplica. */}
                      {b.veredicto === 'no_cumple' && (
                        <span className={styles.bonifAviso} title={b.motivo}>
                          no se cumple
                        </span>
                      )}
                      {b.veredicto === 'no_verificable' && (
                        <span className={styles.bonifDuda} title={b.motivo}>
                          sin comprobar
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={b.alcanzada ? styles.bonifVal : styles.bonifValApagado}>
                    −{b.puntos.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.bonifPie}>
              <div className={styles.bonifPieFila}>
                <span>
                  alcanzas{' '}
                  <span className={styles.monoInk}>
                    −{bonificaciones.rebajaTotal.toFixed(2).replace('.', ',')}
                  </span>
                  {bonificaciones.tope != null && (
                    <>
                      {' de '}
                      <span className={styles.monoInk}>
                        {bonificaciones.tope.toFixed(2).replace('.', ',')}
                      </span>
                      {' de tope'}
                    </>
                  )}
                </span>
              </div>
              {bonificaciones.rebajaTotal > 0 && (
                <div className={styles.bonifEfecto}>
                  <span>tu tipo de hoy</span>
                  <span>
                    <span className={styles.teorico}>
                      {pct(datos.tin + bonificaciones.rebajaTotal).replace(' %', '')}
                    </span>{' '}
                    <span className={styles.flecha}>→</span>{' '}
                    <span className={styles.mono}>{pct(datos.tin)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <CuadroPreview datos={datos} onVerCompleto={undefined} />
        )}

        {/* 3 · Condiciones del banco */}
        <div className={`${styles.card} ${styles.topGoldSoft}`}>
          <div className={styles.cardT}>
            <Icons.Contratos size={15} strokeWidth={2} aria-hidden />
            Condiciones del banco
          </div>
          <div className={styles.dl}>
            {datos.condiciones.map((c) => (
              <div key={c.clave} className={styles.dlItem}>
                <span className={styles.dlK}>{c.clave}</span>
                <span className={styles.dlV}>{c.valor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4 · El cuadro si hay bonificaciones arriba · si no, la fiscalidad */}
        {hayBonificaciones ? (
          <CuadroPreview datos={datos} onVerCompleto={undefined} />
        ) : (
          <div className={`${styles.card} ${styles.topBrand}`}>
            <div className={styles.cardT}>
              <Icons.Fiscal size={15} strokeWidth={2} aria-hidden />
              Destino y fiscalidad
            </div>
            <div className={styles.dlAncho}>
              <div className={styles.dlItem}>
                <span className={styles.dlK}>Destino del capital</span>
                <span className={styles.dlTexto}>{fiscalidad.destino}</span>
              </div>
              <div className={styles.dlItem}>
                <span className={styles.dlK}>Deducibilidad IRPF</span>
                <span>
                  <span className={fiscalidad.deducible ? styles.chipOro : styles.chipNeutro}>
                    {fiscalidad.deducible
                      ? `deducible ${Math.round(fiscalidad.pctDeducible)}% · casilla 0105`
                      : 'no deducible'}
                  </span>
                </span>
              </div>
              {fiscalidad.motivo && <div className={styles.dlMotivo}>{fiscalidad.motivo}</div>}
            </div>
          </div>
        )}
      </div>

      <LoanSettlementModal
        prestamo={prestamo}
        isOpen={amortizando}
        onClose={() => setAmortizando(false)}
        onConfirmed={alAmortizar}
      />
    </div>
  );
};

// ─── El cuadro · preview de las próximas cuotas ─────────────────────────────

interface CuadroPreviewProps {
  datos: {
    preview: ReturnType<typeof getPreviewCuadro>;
    progreso: { restantes: number };
    revision: ReturnType<typeof getProximaRevision>;
  };
  onVerCompleto: (() => void) | undefined;
}

const CuadroPreview: React.FC<CuadroPreviewProps> = ({ datos, onVerCompleto }) => (
  <div className={`${styles.card} ${styles.topGoldSoft}`}>
    <div className={styles.cardT}>
      <Icons.Panel size={15} strokeWidth={2} aria-hidden />
      Cuadro de amortización
      <span className={styles.cardNota}>
        {datos.revision ? 'sube en la revisión' : 'cuota constante'}
      </span>
    </div>
    <div className={`${styles.qrow} ${styles.qhead}`}>
      <div className={styles.qh}>Mes</div>
      <div className={`${styles.qh} ${styles.qr}`}>Cuota</div>
      <div className={`${styles.qh} ${styles.qr}`}>Interés</div>
      <div className={`${styles.qh} ${styles.qr}`}>Capital</div>
    </div>
    {datos.preview.map((p) => (
      <div key={p.periodo} className={styles.qrow}>
        <div className={`${styles.qc} ${p.esRevision ? styles.qmesRev : styles.qmes}`}>
          {mesAnio(p.fechaCargo)}
          {p.esRevision && <span className={styles.revTag}>revisión</span>}
        </div>
        <div className={`${styles.qc} ${styles.qr}`}>{eurPlano(p.cuota)}</div>
        <div className={`${styles.qc} ${styles.qr}`}>{eurPlano(p.interes)}</div>
        <div className={`${styles.qc} ${styles.qr}`}>{eurPlano(p.amortizacion)}</div>
      </div>
    ))}
    <div className={styles.cardPie}>
      {/* La pantalla del cuadro completo (240 filas) está fuera de alcance ·
          se enlaza cuando exista, no se inventa aquí. */}
      <button
        type="button"
        onClick={onVerCompleto}
        disabled={!onVerCompleto}
        title={onVerCompleto ? undefined : 'Pendiente · la pantalla del cuadro completo aún no existe'}
      >
        Ver cuadro completo · {datos.progreso.restantes} cuotas restantes →
      </button>
    </div>
  </div>
);

export default DetallePrestamoPage;
