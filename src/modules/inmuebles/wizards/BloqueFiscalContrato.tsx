// Bloque fiscal del alta de contrato · la reducción del art. 23.2 LIRPF.
// Mockup de referencia: atlas-alta-bloque-fiscal-v3.html.
//
// ATLAS propone y razona; el usuario confirma de un toque. Lo que se guarda no
// es «las condiciones que marcó» sino el PORCENTAJE que aprobó: si mañana
// cambian las reglas, su declaración no cambia sola por detrás.
//
// «Ajustar a mano» deja constancia de que el número lo puso el arrendador y no
// ATLAS (`reduccion.manual`). Ante una inspección importa saber de dónde salió.
//
// Las reglas NO se escriben aquí: vienen de `proponerReduccion`, la fuente única
// que también consume el motor de IRPF. Una copia en el componente sería una
// segunda ley que se separa de la primera en cuanto una de las dos se toque.
//
// Del mockup no se reproduce el marco del drawer (cabecera, pie, botones de
// navegación): el wizard ya lo pone. Sí, en cambio, sus avisos: la reducción se
// pierde sobre lo regularizado en una inspección y decae si la renta supera el
// tope del art. 17.6 LAU, cosas que este cálculo no comprueba y que quien firma
// tiene que saber.

import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import {
  proponerReduccion,
  rendimientoTrasReduccion,
  type CondicionesReduccion,
} from '../../../services/reduccionAlquiler';
import type { Contract } from '../../../services/db';
import { reduceElSubtipo } from '../../../services/db/types-alquiler';
import styles from './BloqueFiscalContrato.module.css';

const euro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

type Condicion = 'primeraVez' | 'zonaTensionada' | 'joven18a35' | 'rebajaMas5' | 'rehabilitada2a';

const CONDICIONES: Array<{ clave: Condicion; nombre: string; detalle: string }> = [
  {
    clave: 'primeraVez',
    nombre: 'Primera vez que alquilas esta vivienda',
    detalle: 'Sin contrato anterior sobre ella',
  },
  {
    clave: 'zonaTensionada',
    nombre: 'En zona tensionada',
    detalle: 'Según resolución vigente de tu comunidad',
  },
  {
    clave: 'joven18a35',
    nombre: 'Inquilino joven (18–35)',
    detalle: 'De la edad en la ficha del inquilino',
  },
  {
    clave: 'rebajaMas5',
    nombre: 'Rebajas la renta más de un 5 % sobre el contrato anterior',
    detalle: 'Requiere que hubiera alquiler previo',
  },
  {
    clave: 'rehabilitada2a',
    nombre: 'Rehabilitada en los 2 años previos',
    detalle: 'Obra acreditada (art. 41.1 RIRPF)',
  },
];

/** Lo que el bloque devuelve al wizard para que lo persista con el contrato. */
export interface DatosFiscalesContrato {
  reduccion: NonNullable<Contract['reduccion']>;
  fechaFirmaContrato: string;
  primeraVez: boolean;
  zonaTensionada: boolean;
  inquilinoJoven: boolean;
  rebajaRenta5pct: boolean;
  rehabilitacion: boolean;
}

interface Props {
  /** Régimen del contrato · lo elige el paso 1, aquí se puede matizar. */
  modalidad: Contract['modalidad'];
  /** Renta mensual tal cual la teclea el usuario · para el impacto en euros. */
  rentaMensual: string;
  fechaInicio: string;
  value: DatosFiscalesContrato | undefined;
  onChange: (v: DatosFiscalesContrato | undefined) => void;
}

export default function BloqueFiscalContrato({
  modalidad,
  rentaMensual,
  fechaInicio,
  value,
  onChange,
}: Props): React.ReactElement {
  const [ajustando, setAjustando] = useState(false);
  const [textoManual, setTextoManual] = useState('');

  // El régimen del art. 23.2 y la modalidad del contrato son el mismo dato:
  // antes había que traducir entre los dos vocabularios y ya no.
  const regimen = modalidad;
  const fechaFirma = value?.fechaFirmaContrato || fechaInicio;

  const condiciones: CondicionesReduccion = useMemo(
    () => ({
      regimen,
      fechaFirma,
      primeraVez: value?.primeraVez ?? false,
      zonaTensionada: value?.zonaTensionada ?? false,
      joven18a35: value?.inquilinoJoven ?? false,
      rebajaMas5: value?.rebajaRenta5pct ?? false,
      rehabilitada2a: value?.rehabilitacion ?? false,
    }),
    [regimen, fechaFirma, value],
  );

  const propuesta = useMemo(() => proponerReduccion(condiciones), [condiciones]);

  // Rendimiento anual bruto · basta para que el usuario vea el orden de magnitud
  // de lo que se juega. El neto de verdad sale del cálculo de IRPF con todos los
  // gastos deducibles, que no está aquí ni tiene por qué.
  const rendimiento = (Number(rentaMensual) || 0) * 12;
  const tributaPor = rendimientoTrasReduccion(rendimiento, propuesta.porcentaje);

  const confirmado = value?.reduccion.activa === true;
  const pctGuardado = value?.reduccion.porcentaje;
  /** Lo confirmado deja de valer si cambian las condiciones bajo sus pies. */
  const alDia = confirmado && (value?.reduccion.manual === true || pctGuardado === propuesta.porcentaje);

  const emitir = (parcial: Partial<DatosFiscalesContrato>): void => {
    const siguiente: DatosFiscalesContrato = {
      reduccion: { activa: false, porcentaje: 0 },
      fechaFirmaContrato: fechaFirma,
      primeraVez: false,
      zonaTensionada: false,
      inquilinoJoven: false,
      rebajaRenta5pct: false,
      rehabilitacion: false,
      ...value,
      ...parcial,
    };
    onChange(siguiente);
  };

  const alternar = (clave: Condicion): void => {
    setAjustando(false);
    const mapa: Record<Condicion, keyof DatosFiscalesContrato> = {
      primeraVez: 'primeraVez',
      zonaTensionada: 'zonaTensionada',
      joven18a35: 'inquilinoJoven',
      rebajaMas5: 'rebajaRenta5pct',
      rehabilitada2a: 'rehabilitacion',
    };
    const campo = mapa[clave];
    // Cambiar una condición invalida lo confirmado: el % que aprobó ya no es el
    // que sale de estas condiciones, y dejarlo activo guardaría un número que no
    // se corresponde con nada.
    emitir({
      [campo]: !(value?.[campo] as boolean | undefined),
      reduccion: { activa: false, porcentaje: 0 },
    } as Partial<DatosFiscalesContrato>);
  };

  const confirmar = (): void => {
    setAjustando(false);
    emitir({
      reduccion: {
        activa: true,
        porcentaje: propuesta.porcentaje,
        motivo: propuesta.motivo,
      },
    });
  };

  const fijarAMano = (texto: string): void => {
    setTextoManual(texto);
    const n = Number.parseFloat(texto.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    const pct = Math.min(Math.max(Math.round(n), 0), 100);
    emitir({
      reduccion: { activa: true, porcentaje: pct, motivo: propuesta.motivo, manual: true },
    });
  };

  const esHabitual = reduceElSubtipo(regimen);

  // El tipo se elige en el paso 1 y llega aquí hecho, así que puede cambiar
  // mientras este bloque no está en pantalla. Si vuelve como un tipo que NO
  // reduce con una reducción confirmada encima, ese número reclama algo que el
  // contrato ya no tiene — y un % puesto a mano tampoco sobrevive a eso, porque
  // no es una discrepancia de cálculo sino de régimen.
  useEffect(() => {
    if (!esHabitual && confirmado && (pctGuardado ?? 0) > 0) {
      emitir({ reduccion: { activa: false, porcentaje: 0 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esHabitual, confirmado, pctGuardado]);

  return (
    <div className={styles.bloque}>
      <div className={esHabitual ? undefined : styles.apagado}>
        <div className={styles.filaFecha}>
          <div>
            <div className={styles.filaFechaTitulo}>Fecha de firma del contrato</div>
            <div className={styles.filaFechaNota}>
              {propuesta.motivo === 'transitorio_pre_2023'
                ? 'Anterior a la Ley de Vivienda · rige el régimen de 2023'
                : 'Rige la Ley de Vivienda (desde 26/05/2023)'}
            </div>
          </div>
          <input
            type="date"
            className={styles.inputFecha}
            aria-label="Fecha de firma del contrato"
            value={fechaFirma.slice(0, 10)}
            onChange={(e) => {
              setAjustando(false);
              emitir({
                fechaFirmaContrato: e.target.value,
                reduccion: { activa: false, porcentaje: 0 },
              });
            }}
          />
        </div>

        <div className={styles.etiqueta}>Condiciones que suben la reducción</div>
        <div className={styles.condiciones} role="group" aria-label="Condiciones de la reducción">
          {CONDICIONES.map((c) => {
            const activa = Boolean(condiciones[c.clave]);
            return (
              <button
                key={c.clave}
                type="button"
                role="switch"
                aria-checked={activa}
                className={`${styles.condicion} ${activa ? styles.condicionOn : ''}`}
                onClick={() => alternar(c.clave)}
              >
                <span className={styles.interruptor} />
                <span className={styles.condicionTexto}>
                  <span className={styles.condicionNombre}>{c.nombre}</span>
                  <span className={styles.condicionDetalle}>{c.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.propuesta}>
        <div className={styles.propuestaTop}>
          <div>
            <div className={styles.propuestaEtiqueta}>Reducción que ATLAS propone</div>
            <div className={styles.porcentaje}>{propuesta.porcentaje}%</div>
            <div className={styles.porque}>{propuesta.explicacion}</div>
          </div>
          <div className={styles.impacto}>
            <div className={styles.impactoCap}>Tributas por</div>
            <div className={styles.impactoValor}>
              {propuesta.porcentaje > 0 ? (
                <>
                  {euro.format(tributaPor)} <s>de {euro.format(rendimiento)}</s>
                </>
              ) : (
                euro.format(rendimiento)
              )}
            </div>
          </div>
        </div>

        <div className={styles.legal}>{propuesta.baseLegal}</div>
        {propuesta.avisos.length > 0 && (
          <div className={styles.avisos}>{propuesta.avisos.join(' ')}</div>
        )}

        <div className={styles.acciones}>
          <button type="button" className={`${styles.btn} ${styles.btnOro}`} onClick={confirmar}>
            Confirmar reducción
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnFantasma}`}
            onClick={() => {
              setTextoManual(String(propuesta.porcentaje));
              setAjustando(true);
            }}
          >
            Ajustar a mano
          </button>
        </div>

        {ajustando && (
          <div className={styles.manual}>
            <label className={styles.manualEtiqueta} htmlFor="reduccion-manual">
              Reducción fijada por ti · queda registrado que no la calculó ATLAS
            </label>
            <input
              id="reduccion-manual"
              className={styles.manualInput}
              inputMode="numeric"
              value={textoManual}
              onChange={(e) => fijarAMano(e.target.value)}
            />
          </div>
        )}

        {alDia && (
          <div className={styles.confirmado}>
            {/* Icono Lucide, no el glifo del mockup · GUIA-DISENO-V5 §17. */}
            <Check size={14} strokeWidth={2.2} aria-hidden />
            Reducción confirmada ·{' '}
            <span className={styles.confirmadoPct}>{pctGuardado}%</span>
            {value?.reduccion.manual === true ? ' · fijada a mano' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
