/**
 * Pantalla 08 · Bloque nómina/autónomo · se adapta a la situación laboral.
 *
 * FIX onboarding punto 6 · se elimina la doble vía falsa ("Completar lo
 * detectado" vs "Desde cero" abrían EL MISMO wizard y salían a
 * `/personal/nomina/nueva`). Ahora el bloque LEE la "Situación laboral"
 * declarada en el bloque persona (`personalData.situacionLaboral`, multi-valor)
 * y compone en consecuencia (P5):
 *   · solo asalariado            → abre directo el formulario de nómina.
 *   · solo autónomo              → abre directo el formulario de actividad.
 *   · asalariado + autónomo      → muestra AMBAS tareas · completa cuando las
 *                                  dos están hechas o saltadas.
 *   · desempleado / jubilado     → no fuerza nómina · ofrece "otro ingreso".
 *   · sin situación laboral       → no adivina · deja elegir y sugiere persona.
 * Cada tarea abre su wizard REAL embebido sobre el flujo (P1+P2), la de nómina
 * pre-rellenada desde la detección de extractos si la hay (P3). Al guardar se
 * cierra el bucle (P4): marca el bloque, sube el % y enciende el IRPF estimado
 * (derivado · al haber renta de trabajo/actividad la estimación deja de mostrar
 * "—"). Autónomo = rendimiento + M130 · NO IVA. Los wizards quedan intactos por
 * dentro · solo aprenden a abrirse embebidos, pre-rellenarse y volver.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import { useOnboarding } from '../OnboardingContext';
import NominaPage from '../../../../pages/GestionPersonal/wizards/NominaPage';
import AutonomoWizard from '../../../../pages/GestionPersonal/wizards/AutonomoWizard';
import { personalDataService } from '../../../../services/personalDataService';
import { nominaService } from '../../../../services/nominaService';
import { autonomoService } from '../../../../services/autonomoService';
import type { SituacionLaboral } from '../../../../types/personal';
import {
  detectarSugerencias,
  type Sugerencia,
  type NominaPrefill,
} from '../../../../services/onboardingDetectionService';
import styles from '../empezar.module.css';

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type Tarea = 'nomina' | 'actividad';
type Modo = 'cargando' | 'lista' | 'nomina' | 'actividad';

const NominaBloque: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setBloque, refresh } = useOnboarding();

  const [modo, setModo] = useState<Modo>('cargando');
  const [situacion, setSituacion] = useState<SituacionLaboral[]>([]);
  const [personaLista, setPersonaLista] = useState(false);
  const [nominaHecha, setNominaHecha] = useState(false);
  const [actividadHecha, setActividadHecha] = useState(false);
  const [nominaSaltada, setNominaSaltada] = useState(false);
  const [actividadSaltada, setActividadSaltada] = useState(false);
  const [detectada, setDetectada] = useState<Sugerencia | null>(
    (location.state as { prefill?: Sugerencia } | null)?.prefill ?? null,
  );

  // Tareas que la situación laboral exige.
  const reqNomina = situacion.includes('asalariado');
  const reqActividad = situacion.includes('autonomo');
  const algunaRequerida = reqNomina || reqActividad;

  // ── Carga · lee la situación laboral de persona y el estado real de tareas ──
  useEffect(() => {
    let alive = true;
    void (async () => {
      const persona = await personalDataService.getPersonalData().catch(() => null);
      const sit = persona?.situacionLaboral ?? [];
      let nHecha = false;
      let aHecha = false;
      if (persona?.id != null) {
        const [noms, auts] = await Promise.all([
          nominaService.getNominas(persona.id).catch(() => []),
          autonomoService.getAutonomos(persona.id).catch(() => []),
        ]);
        nHecha = noms.length > 0;
        aHecha = auts.length > 0;
      }
      if (!alive) return;
      setSituacion(sit);
      setPersonaLista(!!persona && sit.length > 0);
      setNominaHecha(nHecha);
      setActividadHecha(aHecha);

      // Solo una tarea exigida y aún sin hacer → abre directo su formulario.
      const rN = sit.includes('asalariado');
      const rA = sit.includes('autonomo');
      const nReq = (rN ? 1 : 0) + (rA ? 1 : 0);
      if (nReq === 1 && rN && !nHecha) setModo('nomina');
      else if (nReq === 1 && rA && !aHecha) setModo('actividad');
      else setModo('lista');
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Detección de extractos · solo alimenta el pre-relleno de la nómina ──────
  useEffect(() => {
    if (detectada) return;
    let alive = true;
    void detectarSugerencias().then((sugs) => {
      const nomina = sugs.find((s) => s.tipo === 'nomina');
      if (alive && nomina) setDetectada(nomina);
    });
    return () => {
      alive = false;
    };
  }, [detectada]);

  const prefill = detectada?.prefill as NominaPrefill | undefined;

  // ── Cierre del bucle (P4) ───────────────────────────────────────────────────
  const completarBloque = async () => {
    await setBloque('nomina', 'completado');
    await refresh();
    navigate('/empezar/hub');
  };

  // Guardar una tarea: si la situación laboral ya queda satisfecha (todas las
  // exigidas hechas o saltadas) cierra el bloque; si falta otra, lo deja parcial
  // y vuelve a la lista para completar la segunda.
  const onTareaGuardada = async (t: Tarea) => {
    const nH = t === 'nomina' ? true : nominaHecha;
    const aH = t === 'actividad' ? true : actividadHecha;
    setNominaHecha(nH);
    setActividadHecha(aH);
    const okN = !reqNomina || nH || nominaSaltada;
    const okA = !reqActividad || aH || actividadSaltada;
    if (okN && okA) {
      await completarBloque();
    } else {
      await setBloque('nomina', 'parcial');
      await refresh();
      setModo('lista');
    }
  };

  const saltarTarea = async (t: Tarea) => {
    const nS = t === 'nomina' ? true : nominaSaltada;
    const aS = t === 'actividad' ? true : actividadSaltada;
    setNominaSaltada(nS);
    setActividadSaltada(aS);
    const okN = !reqNomina || nominaHecha || nS;
    const okA = !reqActividad || actividadHecha || aS;
    if (okN && okA) await completarBloque();
  };

  // ── Formularios embebidos ───────────────────────────────────────────────────
  if (modo === 'nomina') {
    return (
      <NominaPage
        prefill={
          prefill
            ? { neto: prefill.neto, dia: prefill.dia, cuentaId: prefill.cuentaId, empresa: prefill.pagador }
            : undefined
        }
        onSaved={() => onTareaGuardada('nomina')}
        onCancel={() => setModo('lista')}
      />
    );
  }
  if (modo === 'actividad') {
    return <AutonomoWizard onSaved={() => onTareaGuardada('actividad')} onCancel={() => setModo('lista')} />;
  }

  if (modo === 'cargando') {
    return <div className={styles.loading}>Leyendo tu situación laboral…</div>;
  }

  // ── Lista · se adapta a la situación laboral ────────────────────────────────
  const estadoTarea = (hecha: boolean, saltada: boolean): 'pendiente' | 'hecha' | 'saltada' =>
    hecha ? 'hecha' : saltada ? 'saltada' : 'pendiente';

  const renderTarea = (t: Tarea) => {
    const esNomina = t === 'nomina';
    const estado = esNomina
      ? estadoTarea(nominaHecha, nominaSaltada)
      : estadoTarea(actividadHecha, actividadSaltada);
    const titulo = esNomina ? 'Tu nómina' : 'Tu actividad · autónomo';
    const meta = esNomina
      ? prefill
        ? `Detectada en tus extractos · ${eur(prefill.neto)} netos el día ${prefill.dia} · sale pre-rellenada`
        : 'Bruto · nº de pagas · retención · pagas extra · variables · plan de pensiones y especie'
      : 'Rendimiento estimado y pagos a cuenta (M130) · NO IVA';
    return (
      <div key={t} className={`${styles.sugRow} ${estado === 'pendiente' ? styles.needs : ''}`}>
        <div className={styles.sugConcept}>
          <div className={styles.sugName}>{titulo}</div>
          <div className={styles.sugMeta}>{meta}</div>
        </div>
        <div className={styles.sugActions}>
          {estado === 'pendiente' ? (
            <>
              <button
                type="button"
                className={`${styles.btnMini} ${styles.complete}`}
                onClick={() => setModo(esNomina ? 'nomina' : 'actividad')}
              >
                Completar
              </button>
              <button
                type="button"
                className={`${styles.btnMini} ${styles.no}`}
                onClick={() => void saltarTarea(t)}
              >
                Saltar
              </button>
            </>
          ) : (
            <span className={styles.sugMeta}>{estado === 'hecha' ? '✓ Hecho' : 'Saltada'}</span>
          )}
        </div>
      </div>
    );
  };

  // Caso · la situación laboral exige nómina y/o actividad → tareas reales.
  if (algunaRequerida) {
    return (
      <DobleViaLayout
        kick="Bloque · quién te paga a ti"
        title={reqNomina && reqActividad ? 'Tu nómina y tu actividad' : reqNomina ? 'Tu nómina' : 'Tu actividad'}
        subtitle="Según lo que dijiste en «Quién eres». Es lo que enciende tu IRPF estimado · sin esto Atlas no puede decirte cuánto te saldrá la declaración."
      >
        <div style={{ marginTop: 22 }}>
          {reqNomina && renderTarea('nomina')}
          {reqActividad && renderTarea('actividad')}
        </div>
        <div className={styles.sugEmptyNote} style={{ marginTop: 16 }}>
          ¿Algo no encaja? Cambia tu situación laboral en el bloque «Quién eres» y este bloque se adapta solo. Autónomo =
          rendimiento + pagos M130 · Atlas no gestiona IVA ni otros modelos.
        </div>
      </DobleViaLayout>
    );
  }

  // Caso · persona declarada SIN trabajo (desempleado / jubilado) → no fuerza
  // nómina · ofrece "otro ingreso del trabajo" como opción manual.
  if (personaLista) {
    return (
      <DobleViaLayout
        kick="Bloque · quién te paga a ti"
        title="Sin nómina ni actividad ahora mismo"
        subtitle="Según «Quién eres» no tienes nómina ni actividad por cuenta propia · Atlas no fuerza una nómina que no existe."
      >
        <div className={styles.viaGrid}>
          <ViaCard
            variant="manual"
            Icon={Icons.Banknote}
            title="Tengo otro ingreso del trabajo"
            desc="¿Cobras una nómina puntual u otro rendimiento del trabajo? Ábrela aquí · si no, sigue sin tocar nada."
            items={['Mismo formulario de nómina · con tu recibo delante', 'Enciende tu IRPF estimado']}
            time="10 min"
            onClick={() => setModo('nomina')}
          />
        </div>
        <div className={styles.sugActions} style={{ marginTop: 16 }}>
          <button type="button" className={`${styles.btnMini} ${styles.no}`} onClick={() => void completarBloque()}>
            No tengo ingresos del trabajo · marcar como resuelto
          </button>
        </div>
      </DobleViaLayout>
    );
  }

  // Caso · sin situación laboral (persona vacía) → no adivina · deja elegir y
  // sugiere completar persona.
  return (
    <DobleViaLayout
      kick="Bloque · quién te paga a ti"
      title="Tu nómina o tu actividad"
      subtitle="Es lo que enciende tu IRPF estimado · sin esto Atlas no puede decirte cuánto te saldrá la declaración."
    >
      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge={detectada ? 'Detectado en tus extractos' : 'Recomendado'}
          Icon={Icons.Banknote}
          title="Nómina"
          desc={
            prefill ? (
              <>
                Atlas vio un abono periódico "{prefill.pagador}" · <span className={styles.mono}>{eur(prefill.neto)}</span>{' '}
                netos el día {prefill.dia}. El wizard sale pre-rellenado · tú añades bruto · pagas · retención.
              </>
            ) : (
              'Bruto · nº de pagas · retención · pagas extra · variables · plan de pensiones y especie.'
            )
          }
          items={['Vista previa mes a mes con el neto en tu cuenta', 'Si aportas a plan de pensiones · se vincula aquí']}
          time="10 min · enciende el IRPF estimado"
          onClick={() => setModo('nomina')}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Autónomo"
          desc="Tu actividad por cuenta propia · Atlas solo necesita tu rendimiento y tus pagos a cuenta (M130) porque alimentan tu declaración de la renta."
          items={['Rendimiento estimado y pagos M130', 'Cuota de autónomos · gastos deducibles']}
          time="10 min · enciende el IRPF estimado"
          onClick={() => setModo('actividad')}
        />
      </div>
      <div className={styles.sugEmptyNote} style={{ marginTop: 16 }}>
        Completa «Quién eres» (tu situación laboral) y este bloque se adapta solo · te pedirá solo lo que te toca.
        Atlas no gestiona IVA ni otros modelos.
      </div>
    </DobleViaLayout>
  );
};

export default NominaBloque;
