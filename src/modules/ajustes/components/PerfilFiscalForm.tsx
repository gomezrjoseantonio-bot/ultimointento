/**
 * Formulario REAL de "Perfil fiscal y convivencia" · fuente única de verdad
 * fiscal del hogar. Lee y escribe el store real vía `personalDataService`
 * (`getPersonalData` / `savePersonalData`). Componente COMPARTIDO · una sola
 * fuente · dos puertas: Ajustes → Perfil fiscal y el bloque persona del
 * onboarding (`/empezar/persona`) lo reutilizan tal cual.
 *
 * Merge-safe: carga el registro existente y solo sobrescribe los campos del
 * formulario · preserva lo que pueda haber rellenado el import de la declaración
 * AEAT (descendientes/ascendientes/tributación…).
 */
import React, { useEffect, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from './SetSection';
import SetRow from './SetRow';
import Toggle from './Toggle';
import { CCAA_LIST } from '../../../utils/locationUtils';
import { personalDataService } from '../../../services/personalDataService';
import type { PersonalData, SituacionLaboral, NivelDiscapacidad } from '../../../types/personal';
import containerStyles from '../AjustesPage.module.css';
import styles from './PerfilFiscalForm.module.css';

const SITUACIONES: Array<{ value: PersonalData['situacionPersonal']; label: string }> = [
  { value: 'soltero', label: 'Soltero/a' },
  { value: 'casado', label: 'Casado/a' },
  { value: 'pareja-hecho', label: 'Pareja de hecho' },
  { value: 'divorciado', label: 'Divorciado/a' },
];
const LABORALES: Array<{ value: SituacionLaboral; label: string }> = [
  { value: 'asalariado', label: 'Asalariado/a' },
  { value: 'autonomo', label: 'Autónomo/a' },
  { value: 'desempleado', label: 'Desempleado/a' },
  { value: 'jubilado', label: 'Jubilado/a' },
];
const DISCAPACIDADES: Array<{ value: NivelDiscapacidad; label: string }> = [
  { value: 'ninguna', label: 'Sin discapacidad' },
  { value: 'hasta33', label: 'Hasta 33%' },
  { value: 'entre33y65', label: 'Entre 33% y 65%' },
  { value: 'mas65', label: 'Más del 65%' },
];

interface FormState {
  nombre: string;
  apellidos: string;
  dni: string;
  fechaNacimiento: string;
  situacionPersonal: PersonalData['situacionPersonal'];
  comunidadAutonoma: string;
  situacionLaboral: SituacionLaboral[];
  discapacidad: NivelDiscapacidad;
  parejaCotitular: boolean;
  spouseName: string;
  numDescendientes: number;
}

const EMPTY: FormState = {
  nombre: '',
  apellidos: '',
  dni: '',
  fechaNacimiento: '',
  situacionPersonal: 'soltero',
  comunidadAutonoma: '',
  situacionLaboral: [],
  discapacidad: 'ninguna',
  parejaCotitular: false,
  spouseName: '',
  numDescendientes: 0,
};

// `fechaNacimiento` puede venir como dd/mm/yyyy (import AEAT). `<input type="date">`
// solo acepta YYYY-MM-DD · normalizamos al hidratar para no perder el valor.
const toInputDate = (fecha: string): string => {
  const m = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : fecha;
};

// Situaciones laborales que NO se combinan (espejo de
// personalDataService.validateSituacionLaboral).
const LABORALES_EXCLUSIVAS: SituacionLaboral[] = ['desempleado', 'jubilado'];

function fromPersonalData(d: PersonalData): FormState {
  const numHijos = typeof d.hasChildren === 'number' ? d.hasChildren : d.descendientes?.length ?? 0;
  return {
    nombre: d.nombre ?? '',
    apellidos: d.apellidos ?? '',
    dni: d.dni ?? '',
    fechaNacimiento: d.fechaNacimiento ? toInputDate(d.fechaNacimiento) : '',
    situacionPersonal: d.situacionPersonal ?? 'soltero',
    comunidadAutonoma: d.comunidadAutonoma ?? '',
    situacionLaboral: d.situacionLaboral ?? [],
    discapacidad: d.discapacidad ?? 'ninguna',
    parejaCotitular: d.situacionPersonal === 'casado' || d.situacionPersonal === 'pareja-hecho' || !!d.spouseName,
    spouseName: d.spouseName ?? '',
    numDescendientes: numHijos,
  };
}

interface Props {
  /** Texto del botón primario. */
  submitLabel?: string;
  /** Acción secundaria opcional (p.ej. "Volver al mapa" en el onboarding). */
  secondary?: React.ReactNode;
  /** Callback tras guardar con éxito (recibe el dato persistido). Puede ser async. */
  onSaved?: (data: PersonalData) => void | Promise<void>;
}

const PerfilFiscalForm: React.FC<Props> = ({ submitLabel = 'Guardar cambios', secondary, onSaved }) => {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [existing, setExisting] = useState<PersonalData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void personalDataService
      .getPersonalData()
      .then((d) => {
        if (!alive) return;
        if (d) {
          setExisting(d);
          setForm(fromPersonalData(d));
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleLaboral = (value: SituacionLaboral) =>
    setForm((prev) => {
      if (prev.situacionLaboral.includes(value)) {
        return { ...prev, situacionLaboral: prev.situacionLaboral.filter((v) => v !== value) };
      }
      // "Desempleado" y "Jubilado" son exclusivas · al activarlas quedan solas;
      // al activar otra, se retiran. Evita combinaciones que el store rechaza.
      if (LABORALES_EXCLUSIVAS.includes(value)) {
        return { ...prev, situacionLaboral: [value] };
      }
      return {
        ...prev,
        situacionLaboral: [...prev.situacionLaboral.filter((v) => !LABORALES_EXCLUSIVAS.includes(v)), value],
      };
    });

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      showToastV5('Indica al menos tu nombre', 'warn');
      return;
    }
    const situacionLaboral = form.situacionLaboral.length ? form.situacionLaboral : ['asalariado'];
    // Valida combinaciones (jubilado/desempleado no combinables) con la regla
    // canónica del servicio antes de tocar el store.
    const laboralCheck = personalDataService.validateSituacionLaboral(situacionLaboral as SituacionLaboral[]);
    if (!laboralCheck.isValid) {
      showToastV5(laboralCheck.error ?? 'Situación laboral inválida', 'warn');
      return;
    }
    setSaving(true);
    try {
      // Preserva lo que ya hubiera (import AEAT) · solo pisa los campos del form.
      const base = existing ? (({ id, fechaCreacion, fechaActualizacion, ...rest }) => rest)(existing) : {};
      const payload: Omit<PersonalData, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        ...(base as Omit<PersonalData, 'id' | 'fechaCreacion' | 'fechaActualizacion'>),
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        dni: form.dni.trim(),
        direccion: existing?.direccion ?? '',
        situacionPersonal: form.situacionPersonal,
        situacionLaboral: situacionLaboral as SituacionLaboral[],
        comunidadAutonoma: form.comunidadAutonoma || undefined,
        discapacidad: form.discapacidad,
        fechaNacimiento: form.fechaNacimiento || undefined,
        spouseName: form.parejaCotitular ? form.spouseName.trim() || undefined : undefined,
        hasChildren: form.numDescendientes > 0 ? form.numDescendientes : undefined,
      };
      const saved = await personalDataService.savePersonalData(payload);
      setExisting(saved);
      // `onSaved` puede ser async (marca bloque + navega en el onboarding) ·
      // lo esperamos y aislamos su error para no dejar un rechazo sin manejar.
      try {
        await onSaved?.(saved);
      } catch {
        showToastV5('Datos guardados · hubo un problema al continuar', 'warn');
      }
    } catch {
      showToastV5('No se pudieron guardar tus datos', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className={containerStyles.contentSub}>Cargando tus datos…</div>;
  }

  return (
    <>
      <SetSection title="Titular · datos fiscales" sub="contribuyente principal de ATLAS">
        <SetRow label="Nombre">
          <SetRow.Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} aria-label="Nombre" placeholder="Tu nombre" />
        </SetRow>
        <SetRow label="Apellidos">
          <SetRow.Input value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} aria-label="Apellidos" placeholder="Tus apellidos" />
        </SetRow>
        <SetRow label="NIF / NIE">
          <SetRow.Input mono value={form.dni} onChange={(e) => set('dni', e.target.value)} aria-label="NIF" placeholder="12345678A" />
        </SetRow>
        <SetRow label="Fecha de nacimiento">
          <SetRow.Input type="date" mono value={form.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} aria-label="Fecha de nacimiento" />
        </SetRow>
        <SetRow label="Comunidad autónoma">
          <select
            className={styles.select}
            value={form.comunidadAutonoma}
            onChange={(e) => set('comunidadAutonoma', e.target.value)}
            aria-label="Comunidad autónoma"
          >
            <option value="">Selecciona…</option>
            {CCAA_LIST.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <SetRow.Sub>determina la tarifa autonómica del IRPF y las deducciones aplicables</SetRow.Sub>
        </SetRow>
        <SetRow label="Grado de discapacidad">
          <select
            className={styles.select}
            value={form.discapacidad}
            onChange={(e) => set('discapacidad', e.target.value as NivelDiscapacidad)}
            aria-label="Grado de discapacidad"
          >
            {DISCAPACIDADES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </SetRow>
      </SetSection>

      <SetSection title="Situación" sub="estado civil · actividad · alimentan los mínimos y la tarifa">
        <SetRow label="Estado civil">
          <select
            className={styles.select}
            value={form.situacionPersonal}
            onChange={(e) => set('situacionPersonal', e.target.value as PersonalData['situacionPersonal'])}
            aria-label="Estado civil"
          >
            {SITUACIONES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </SetRow>
        <SetRow label="Situación laboral">
          <div className={styles.checks}>
            {LABORALES.map((l) => (
              <label key={l.value} className={styles.check}>
                <input type="checkbox" checked={form.situacionLaboral.includes(l.value)} onChange={() => toggleLaboral(l.value)} />
                {l.label}
              </label>
            ))}
          </div>
        </SetRow>
      </SetSection>

      <SetSection title="Convivencia" sub="pareja co-titular · personas a cargo">
        <SetRow label="Pareja co-titular" trailing={<Toggle checked={form.parejaCotitular} onChange={(v) => set('parejaCotitular', v)} ariaLabel="Pareja co-titular" />}>
          <SetRow.Sub>activa la separación titular vs pareja en Personal y la opción de tributación conjunta</SetRow.Sub>
        </SetRow>
        {form.parejaCotitular && (
          <SetRow label="Nombre de la pareja">
            <SetRow.Input value={form.spouseName} onChange={(e) => set('spouseName', e.target.value)} aria-label="Nombre de la pareja" placeholder="Nombre" />
          </SetRow>
        )}
        <SetRow label="Personas a cargo (descendientes)">
          <SetRow.Input
            type="number"
            mono
            min={0}
            value={String(form.numDescendientes)}
            onChange={(e) => set('numDescendientes', Math.max(0, Number(e.target.value) || 0))}
            aria-label="Número de descendientes"
          />
          <SetRow.Sub>número de hijos/descendientes a cargo · suben tu mínimo personal y familiar</SetRow.Sub>
        </SetRow>
      </SetSection>

      <div className={styles.actions}>
        {secondary}
        <button type="button" className={`${containerStyles.btn} ${containerStyles.btnGold}`} onClick={handleSave} disabled={saving}>
          <Icons.Check size={14} strokeWidth={1.8} />
          {saving ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </>
  );
};

export default PerfilFiscalForm;
