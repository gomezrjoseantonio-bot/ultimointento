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
import { inmuebleDelPrestamo } from '../../../services/prestamos/certificadoDelInmueble';
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
import { cuadroSeguroDe } from './datos';
import { useRevisionPendiente } from './useRevisionPendiente';
import { simulacionRevision } from '../../../services/prestamos/simulacionRevision';
import { calendarioDe, proximaRevision } from '../../../services/bonificaciones/revisionDelBanco';
import { publicacionDelIndice } from '../../../services/prestamos/indicePublicado';
import { inmueblesAlquiladosEn } from '../../../services/prestamos/inmueblesAlquilados';
import { getFinancialValuesSnapshot } from '../../../services/financialValuesService';
import CuadroCompleto from './CuadroCompleto';
import CuadroPreview from './CuadroPreview';
import HeroPrestamo from './HeroPrestamo';
import TarjetaBonificaciones from './TarjetaBonificaciones';
import type { Prestamo } from '../../../types/prestamos';
import {
  condicionesDe,
  fiscalidadDe,
  lineaDeTiempo,
  resumenBonificaciones,
} from './detalleDatos';
import {
  anio as soloAnio,
  cifraIndice,
  enmascarado,
  ETIQUETA_TIPO,
  diaMesAnio,
  eurPlano,
  mesAnio,
  pct,
} from './formato';
import styles from './DetallePrestamo.module.css';
import rev from './RevisionEnBonificaciones.module.css';

/** Hoy en ISO · el día del calendario del usuario (ver la vista principal). */
const hoyISO = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};


const DetallePrestamoPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { prestamos, reload } = useOutletContext<FinanciacionOutletContext>();
  const [amortizando, setAmortizando] = useState(false);
  const [cuadroAbierto, setCuadroAbierto] = useState(false);

  const hoy = useMemo(() => hoyISO(), []);

  // Lo que demuestran tus movimientos · se pide una vez y la tarjeta lo espera
  // sin bloquear: el contrato se enseña ya, el veredicto llega cuando llega.
  const [cumplimientos, setCumplimientos] = useState<Cumplimiento[] | undefined>(undefined);
  const prestamo = useMemo(() => prestamos.find((p) => p.id === id), [prestamos, id]);

  const bonificaciones0 = prestamo?.bonificaciones;
  // El banco del préstamo · lo pide la condición de plan de pensiones, que
  // exige que el plan sea de ESTA entidad.
  const banco = prestamo?.banco;
  // La cuenta por la que te cobra la hipoteca · es suya, así que hace de
  // respaldo cuando la bonificación no dice en cuál mirar, que es casi siempre.
  // Va tal cual: si es una cuenta o `''` —y `Number('')` es cero, un id que
  // parece bueno— lo decide `movimientosQuePrueban`, en la puerta. Y el
  // inmueble, que lo pide el certificado energético: es del piso, no del préstamo.
  const cuentaDelPrestamo = prestamo?.cuentaCargoId;
  const inmueble = inmuebleDelPrestamo(prestamo);

  /**
   * El euríbor de «Actualizar valores» · solo para la GUÍA.
   *
   * No entra en el cuadro. Lo que se paga viene de lo último fijado —el índice
   * del alta hasta la primera revisión, y después el de cada revisión
   * confirmada— y no se mueve porque el mercado se mueva. Este sirve para decir
   * por dónde irá la próxima, que es lo único que el mercado de hoy sabe.
   */
  const [indiceHoy, setIndiceHoy] = useState<number | null>(null);
  useEffect(() => {
    let cancelado = false;
    getFinancialValuesSnapshot()
      .then((v) => {
        if (!cancelado) setIndiceHoy(v.euriborPercent);
      })
      .catch(() => {
        // Sin valoraciones no se presume nada · no se inventa un índice.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Los inmuebles alquilados este ejercicio · lo que decide qué deduce.
   *
   * `undefined` hasta que se leen los contratos, y la ficha lo respeta: durante
   * ese rato no dice ni «deducible» ni «no deducible».
   */
  const [alquilados, setAlquilados] = useState<ReadonlySet<string> | undefined>(undefined);
  useEffect(() => {
    let cancelado = false;
    inmueblesAlquiladosEn(Number(hoy.slice(0, 4))).then((s) => {
      if (!cancelado) setAlquilados(s);
    });
    return () => {
      cancelado = true;
    };
  }, [hoy]);

  // El cuadro sale del préstamo TAL COMO ESTÁ GUARDADO · el euríbor de
  // «Actualizar valores» no lo toca *(Jose · 8 ago 2026: «la actualización del
  // valor del euríbor durante ese tiempo sirve de guía prevista de la cuota
  // pero no debe cambiar ningún cuadro, porque no va a cambiar nada realmente
  // hasta la siguiente revisión»)*. Ese euríbor entra por una sola puerta, la
  // simulación de más abajo, que dice por dónde irá lo que viene sin tocar lo
  // que se paga.
  const cuadro = useMemo(() => (prestamo ? cuadroSeguroDe(prestamo) : null), [prestamo]);
  // La revisión que espera respuesta · vive con las bonificaciones, no en una
  // tarjeta aparte que enseñara la misma lista otra vez.
  const revision = useRevisionPendiente(prestamo ?? ({ id: '' } as Prestamo), hoy, reload);

  // De qué mes publicado sale el índice de la revisión pendiente · el de hoy no.
  const publicacion = useMemo(
    () => (prestamo ? publicacionDelIndice(prestamo, revision.pendiente?.aplicaDesde) : null),
    [prestamo, revision.pendiente]
  );
  useEffect(() => {
    // Lo primero, olvidar lo anterior · navegar de un préstamo a otro dejaba en
    // pantalla los veredictos del que acabas de dejar, pegados a las
    // bonificaciones del nuevo, hasta que terminara la lectura. Un veredicto
    // del préstamo equivocado es peor que ninguno: se lee igual de firme.
    setCumplimientos(undefined);
    if (!bonificaciones0?.length) return;
    let cancelado = false;
    (async () => {
      try {
        const movimientos = await movimientosQuePrueban(
          Number(hoy.slice(0, 4)),
          banco,
          cuentaDelPrestamo,
          inmueble
        );
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
  }, [bonificaciones0, banco, cuentaDelPrestamo, inmueble, hoy]);

  const datos = useMemo(() => {
    if (!prestamo || !cuadro) return null;
    const anio = Number(hoy.slice(0, 4));
    const fiscalidad = fiscalidadDe(prestamo, alquilados);
    return {
      capitalVivo: getCapitalVivo(cuadro, hoy),
      principalInicial: getPrincipalInicial(cuadro),
      cuota: getCuota(cuadro, hoy),
      tin: getTinVigente(prestamo, hoy),
      pctAmortizado: getPctAmortizado(cuadro, hoy),
      progreso: getProgresoCuotas(cuadro, hoy),
      vencimiento: getFechaVencimiento(cuadro),
      revision: getProximaRevision(prestamo, cuadro, hoy, 365),
      deducible: getInteresDeducible(prestamo, cuadro, anio, alquilados ?? new Set<string>()),
      interesPendiente: getInteresPendiente(cuadro, hoy),
      preview: getPreviewCuadro(cuadro, hoy, 3),
      tiempo: lineaDeTiempo(prestamo, cuadro, hoy),
      bonificaciones: resumenBonificaciones(prestamo, hoy, cumplimientos),
      // Lo que traería la próxima revisión con el índice de hoy · NO entra en
      // el cuadro: es una respuesta a «¿y si?», no un tramo. Sin revisión
      // confirmada el cuadro YA va al índice de hoy, así que no dice nada — y
      // callarse es lo correcto: no habría nada que anunciar.
      simulacion: simulacionRevision(prestamo, hoy, indiceHoy),
      condiciones: condicionesDe(prestamo, cuadro),
      // Cuándo vuelve a mirar el banco · para poder decir QUÉ DÍA se pierde una
      // bonificación que hoy te aplican y no estás demostrando.
      proximaDelBanco: proximaRevision(calendarioDe(prestamo), hoy),
      fiscalidad,
    };
  }, [prestamo, cuadro, hoy, cumplimientos, indiceHoy, alquilados]);

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
  const numContrato = enmascarado(prestamo.numeroContrato);

  // El 6º KPI cambia de pregunta según el préstamo: en uno deducible interesa
  // cuánto te devuelve Hacienda; en uno que no lo es, esa cifra sería siempre
  // cero y lo que sí queda por saber es cuánto te falta de coste.
  //
  // Lo decide SOLO si el préstamo es deducible, no si este año ya ha devengado
  // intereses: una hipoteca firmada en diciembre deduce igual, y mirar la cifra
  // le cambiaría el KPI de significado según el mes en que se abriera la ficha.
  // Deducible con 0 € todavía enseña 0 €, que es la respuesta correcta.
  //
  // `=== true` y no a secas: mientras los contratos no se han leído la respuesta
  // es `null`, y un KPI que dijera «Deducible 0 €» para luego cambiar a «Interés
  // pendiente» —o al revés— cambia de pregunta delante de quien lo está leyendo.
  const mostrarDeducible = fiscalidad.deducible === true;

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

      <HeroPrestamo
        prestamo={prestamo}
        datos={datos}
        bonificaciones={bonificaciones}
        anio={hoy.slice(0, 4)}
        numContrato={numContrato}
        mostrarDeducible={mostrarDeducible}
        pctDeducible={fiscalidad.pctDeducible}
        esMixtoOVariable={esMixtoOVariable}
        onAmortizar={() => setAmortizando(true)}
        onEditar={() => navigate(`/financiacion/${prestamo.id}/editar`)}
      />

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
                  {/* El índice sale del TRAMO, no de `valorIndiceActual`: un
                      tramo nacido de una revisión apuntada tiene el suyo, y
                      enseñar el del alta debajo de él decía dos cosas del mismo
                      día. Y se dice de dónde viene — mientras nadie confirme
                      una revisión, el número es el euríbor de hoy, no uno que
                      el banco haya fijado. */}
                  <div className={styles.tramoPer}>
                    {tiempo.tramos.length === 1
                      ? `las ${datos.progreso.total} cuotas · desde la firma hasta el final`
                      : t.tramo.variable
                        ? `${(prestamo.indice ?? 'índice').toLowerCase()} ${cifraIndice(
                            t.indice ?? undefined,
                          )} + diferencial ${cifraIndice(prestamo.diferencial)} · ${
                            t.tramo.estimado
                              ? 'con el índice de hoy'
                              : `fijado el ${diaMesAnio(t.desde)}`
                          }`
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

          {/* Por qué tu tipo es el que es · las bonificaciones que el banco YA
              aplica viven aquí, con el tipo, no en la tarjeta de al lado. Son
              un hecho del contrato; lo que todavía tienes que demostrar es la
              otra pregunta y tiene su propia tarjeta. */}
          {bonificaciones.rebajanHoy && bonificaciones.aplicadas.length > 0 && (
            <div className={styles.aplicadas}>
              <span>el banco te aplica</span>
              {bonificaciones.aplicadas.map((b) => (
                <span key={b.bonificacion.id} className={styles.aplicadaChip}>
                  {b.bonificacion.nombre}
                </span>
              ))}
              <span className={styles.aplicadasVal}>
                −{bonificaciones.rebajaTotal.toFixed(2).replace('.', ',')} pts
              </span>
            </div>
          )}
          {/* Y cuando NO tocan este tramo se dice aquí, que es donde el lector
              está mirando el tipo · en la mixta de Unicaja el anexo entero no
              mueve el 2,600 % hasta la primera revisión. */}
          {!bonificaciones.rebajanHoy && bonificaciones.rebajanDesde && (
            <div className={styles.aplicadas}>
              {/* Sin repetir la fecha · la dice la línea de revisión, dos
                  renglones más abajo. Enseñar el mismo día seis veces en una
                  pantalla es de lo que se quejaba Jose. */}
              <span>ninguna bonificación toca este tramo</span>
            </div>
          )}

          <div className={styles.revLine}>
            <Icons.Warning size={14} strokeWidth={2} aria-hidden />
            {datos.revision ? (
              <>
                revisa el{' '}
                <span className={styles.mono}>{diaMesAnio(datos.revision.aplicaDesde)}</span> · la
                cuota pasa a {eurPlano(datos.revision.cuotaDespues)} € en el recibo del{' '}
                <span className={styles.mono}>{diaMesAnio(datos.revision.fecha)}</span>
              </>
            ) : prestamo.tipo === 'FIJO' ? (
              'la cuota no cambia · sin revisiones que seguir'
            ) : (
              'sin revisiones apuntadas · lo que venga se proyecta con el euríbor de hoy, no con uno fijado'
            )}
          </div>

          {/* Lo que traería la revisión que viene, con el índice de HOY.
              Durante los doce meses que van de una revisión a otra el euríbor
              de «Actualizar valores» no decía nada: lo vigente está fijado por
              la revisión confirmada y no se toca. Esto es lo otro que sí puede
              decir — por dónde va lo que viene — y por eso vive fuera del
              cuadro y se recalcula solo. */}
          {datos.simulacion && (
            <div className={rev.simula}>
              <span className={rev.simulaLab}>
                si el {(prestamo.indice ?? 'índice').toLowerCase()} sigue en{' '}
                <span className={styles.mono}>{pct(datos.simulacion.indice)}</span>
              </span>
              <span className={rev.simulaVal}>
                {eurPlano(datos.simulacion.cuotaHoy)} <span className={styles.flecha}>→</span>{' '}
                <span className={styles.mono}>{eurPlano(datos.simulacion.cuotaDespues)} €</span>
                <small>
                  {datos.simulacion.cuotaDespues > datos.simulacion.cuotaHoy ? '+' : ''}
                  {eurPlano(datos.simulacion.cuotaDespues - datos.simulacion.cuotaHoy)} · al{' '}
                  {pct(datos.simulacion.tinDespues)}
                </small>
              </span>
            </div>
          )}
        </div>

        <TarjetaBonificaciones
          prestamo={prestamo}
          bonificaciones={bonificaciones}
          revision={revision}
          proximaDelBanco={datos.proximaDelBanco}
          publicacion={publicacion}
          onEditar={() => navigate(`/financiacion/${prestamo.id}/editar`)}
        />
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

        {/* 4 · El cuadro · SIEMPRE. Antes esta casilla la ocupaba el cuadro o
            la fiscalidad según hubiera bonificaciones o no, así que un préstamo
            sin ellas se quedaba sin cuadro de amortización — que es la tabla
            por la que se entra a esta ficha. */}
        <CuadroPreview datos={datos} onVerCompleto={() => setCuadroAbierto(true)} />
      </div>

      {cuadroAbierto && cuadro && (
        <CuadroCompleto
          cuadro={cuadro}
          nombre={prestamo.nombre || 'Préstamo'}
          hoy={hoy}
          onCerrar={() => setCuadroAbierto(false)}
        />
      )}

      <LoanSettlementModal
        prestamo={prestamo}
        isOpen={amortizando}
        onClose={() => setAmortizando(false)}
        onConfirmed={alAmortizar}
      />
    </div>
  );
};

export default DetallePrestamoPage;
