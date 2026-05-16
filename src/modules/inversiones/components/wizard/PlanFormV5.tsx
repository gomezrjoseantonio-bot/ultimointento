// T23.6.3 · PlanFormV5
//
// Basado en `src/components/personal/planes/PlanForm.tsx` (TAREA 13 v2).
// NO redibujar · solo migrar de AtlasModal a layout v5 (dialog.module.css)
// y añadir prop `tipoAdministrativoInicial` para pre-selección desde el wizard.
//
// TAREA 13 v4 · Acción 2 (D4) · ampliado para capturar los 5 campos formales
// que faltaban (subtipoPPE/PPES condicional, empresaPagadora cuando aplica,
// politicaInversion siempre, participeConDiscapacidad siempre). Schema canon
// como source-of-truth · spec v2 §1.B alineada a `types/planesPensiones.ts`.
//
// Submit sigue escribiendo en `planesPensionesService`. NUNCA inversionesService.
// Cero hex hardcoded · todo vía tokens v5.

import React, { useState, useEffect, useId } from 'react';
import { showToastV5 } from '../../../../design-system/v5';
import { Icons } from '../../../../design-system/v5';
import { planesPensionesService } from '../../../../services/planesPensionesService';
import { getFiscalContextSafe } from '../../../../services/fiscalContextService';
import { nominaService } from '../../../../services/nominaService';
import type {
  PlanPensiones,
  TipoAdministrativo,
  EstadoPlan,
  SubtipoPPE,
  SubtipoPPES,
  PoliticaInversion,
} from '../../../../types/planesPensiones';
import dialog from '../Dialog.module.css';
import styles from './PlanFormV5.module.css';

interface Props {
  onClose: () => void;
  onSaved: (plan: PlanPensiones) => void;
  plan?: PlanPensiones | null;
  /** Pre-selecciona el tipo administrativo al abrir · usuario puede cambiar. */
  tipoAdministrativoInicial?: TipoAdministrativo;
}

const TIPOS_ADMIN: { value: TipoAdministrativo; label: string; desc: string }[] = [
  { value: 'PPI', label: 'PPI — Individual', desc: 'Aportación libre del titular' },
  { value: 'PPE', label: 'PPE — Empleo', desc: 'Empresa promotora' },
  { value: 'PPES', label: 'PPES — Empleo Simplificado', desc: 'Sectorial / autónomos' },
  { value: 'PPA', label: 'PPA — Asegurado', desc: 'Garantizado por aseguradora' },
];

// Etiquetas UI · schema canon como value, copy amigable como label.
const SUBTIPOS_PPE: { value: SubtipoPPE; label: string }[] = [
  { value: 'empleador_unico', label: 'Empleador único' },
  { value: 'promocion_conjunta', label: 'Promoción conjunta (PPEPC)' },
];

const SUBTIPOS_PPES: { value: SubtipoPPES; label: string }[] = [
  { value: 'sectorial', label: 'Sectorial' },
  { value: 'sector_publico', label: 'Sector público' },
  { value: 'cooperativas', label: 'Cooperativas' },
  { value: 'autonomos', label: 'Autónomos' },
];

const POLITICAS: { value: PoliticaInversion; label: string }[] = [
  { value: 'desconocido', label: 'No especificada' },
  { value: 'renta_fija_corto', label: 'Renta fija · corto plazo' },
  { value: 'renta_fija_largo', label: 'Renta fija · largo plazo' },
  { value: 'renta_variable', label: 'Renta variable' },
  { value: 'renta_mixta', label: 'Mixta' },
  { value: 'garantizado', label: 'Garantizado' },
  { value: 'ciclo_vida', label: 'Ciclo de vida' },
];

// CIF español · letra + 7 dígitos + dígito control (letra o número).
// Formato laxo para no bloquear · solo bloquea entradas claramente inválidas.
const CIF_REGEX = /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/i;

// Pulido T13 v4 final · issue 1 · copy del límite fiscal dinámico.
// El copy debe reflejar el régimen real del plan según tipo + discapacidad,
// no el texto estático "hasta 24.250 €" que solo aplica con discapacidad.
//
// Caso discapacidad gana siempre (art. 52.1.c LIRPF). En el resto, el límite
// depende del tipo administrativo y, para PPES, del subtipo (autónomos tienen
// adicional de 4.250 €).
export function getCopyLimiteFiscal(
  tipo: TipoAdministrativo,
  subtipoPPES: SubtipoPPES | undefined,
  participeConDiscapacidad: boolean,
): string {
  if (participeConDiscapacidad) {
    return 'Límite especial discapacidad · hasta 24.250 € (art. 52.1.c LIRPF).';
  }
  switch (tipo) {
    case 'PPI':
    case 'PPA':
      return 'Límite anual deducible · 1.500 € (art. 51.6 LIRPF).';
    case 'PPE':
      return 'Límite conjunto · 1.500 € titular + 8.500 € empresa = 10.000 € (art. 51.7 LIRPF).';
    case 'PPES':
      if (subtipoPPES === 'autonomos') {
        return 'Límite anual deducible · hasta 5.750 € · 1.500 € + 4.250 € adicionales (art. 51.8 · Ley 12/2022).';
      }
      return 'Límite anual deducible · 1.500 € (art. 51.6 LIRPF).';
  }
}

interface EmpresaUnica {
  cif: string;
  nombre: string;
}

const emptyForm = (tipoInicial: TipoAdministrativo = 'PPI') => ({
  nombre: '',
  tipoAdministrativo: tipoInicial,
  subtipoPPE: 'empleador_unico' as SubtipoPPE,
  subtipoPPES: 'sectorial' as SubtipoPPES,
  politicaInversion: 'desconocido' as PoliticaInversion,
  participeConDiscapacidad: false,
  empresaCif: '',
  empresaNombre: '',
  gestoraActual: '',
  isinActual: '',
  fechaContratacion: new Date().toISOString().split('T')[0],
  importeInicial: '',
  valorActual: '',
  titular: 'yo' as 'yo' | 'pareja',
  estado: 'activo' as EstadoPlan,
});

const PlanFormV5: React.FC<Props> = ({
  onClose,
  onSaved,
  plan,
  tipoAdministrativoInicial = 'PPI',
}) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [empresasNomina, setEmpresasNomina] = useState<EmpresaUnica[]>([]);
  const [formData, setFormData] = useState(emptyForm(tipoAdministrativoInicial));

  // useId garantiza IDs únicos cuando el componente se monta varias veces
  // (modales apilados, dev hot reload) · evita colisiones de DOM.
  const baseId = useId();
  const empresasCifDatalistId = `${baseId}-empresas-cif`;
  const empresasNombreDatalistId = `${baseId}-empresas-nombre`;

  const esPPE = formData.tipoAdministrativo === 'PPE';
  const esPPES = formData.tipoAdministrativo === 'PPES';
  const esPPEoPPES = esPPE || esPPES;

  useEffect(() => {
    (async () => {
      try {
        const ctx = await getFiscalContextSafe();
        if (!ctx) return;
        setPersonalDataId(ctx.personalDataId);

        // PF-4 · cargar empresas únicas (CIF + nombre) desde nóminas previas
        // del titular para pre-rellenar el campo empresaPagadora cuando proceda.
        try {
          const nominas = await nominaService.getNominas(ctx.personalDataId);
          // Normalizar CIFs a uppercase para que la comparación posterior con
          // `cifUpper` en handleEmpresaCifChange matchee siempre, incluso si
          // la nómina guardó el CIF en minúsculas.
          const map = new Map<string, EmpresaUnica>();
          for (const n of nominas) {
            const cif = n.empresa?.cif?.trim().toUpperCase();
            const nombre = n.empresa?.nombre?.trim();
            if (cif && nombre && !map.has(cif)) {
              map.set(cif, { cif, nombre });
            }
          }
          setEmpresasNomina(Array.from(map.values()));
        } catch {/* sin nóminas · datalist vacío · usuario teclea manualmente */}
      } catch {/* ignore */}
    })();
  }, []);

  useEffect(() => {
    if (plan) {
      setFormData({
        nombre: plan.nombre,
        tipoAdministrativo: plan.tipoAdministrativo,
        subtipoPPE: plan.subtipoPPE ?? 'empleador_unico',
        subtipoPPES: plan.subtipoPPES ?? 'sectorial',
        politicaInversion: plan.politicaInversion ?? 'desconocido',
        participeConDiscapacidad: plan.participeConDiscapacidad ?? false,
        empresaCif: plan.empresaPagadora?.cif ?? '',
        empresaNombre: plan.empresaPagadora?.nombre ?? '',
        gestoraActual: plan.gestoraActual,
        isinActual: plan.isinActual ?? '',
        fechaContratacion: plan.fechaContratacion,
        importeInicial: plan.importeInicial?.toString() ?? '',
        valorActual: plan.valorActual?.toString() ?? '',
        titular: plan.titular,
        estado: plan.estado,
      });
    } else {
      // Si no hay plan que editar, resetear el form con el tipo inicial de la prop.
      // tipoAdministrativoInicial no se incluye en el array de deps de forma
      // intencionada: solo queremos resetear cuando cambia la visibilidad del
      // form (plan → null), no cada vez que el padre re-renderiza con un prop
      // de tipo diferente; el wizard ya pasa el tipo en el montaje del paso 2.
      setFormData(emptyForm(tipoAdministrativoInicial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Lock scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Cuando el usuario teclea/elige un nombre que coincide con una empresa
  // conocida, autocompletar el CIF (y viceversa). Pattern datalist HTML5.
  //
  // Coherencia · si la edición rompe un match previamente auto-rellenado
  // (el OTRO campo apunta a una empresa conocida), limpiamos ese OTRO campo
  // para evitar pares CIF/nombre desincronizados que validarían el form.
  // Si el OTRO campo era texto manual (no estaba en empresasNomina), lo
  // dejamos intacto · el usuario lo está rellenando explícitamente.
  const handleEmpresaNombreChange = (nombre: string) => {
    const match = empresasNomina.find((e) => e.nombre === nombre);
    setFormData((prev) => {
      const cifPrevEraConocido = empresasNomina.some((e) => e.cif === prev.empresaCif);
      return {
        ...prev,
        empresaNombre: nombre,
        empresaCif: match
          ? match.cif
          : cifPrevEraConocido
            ? ''
            : prev.empresaCif,
      };
    });
  };

  const handleEmpresaCifChange = (cif: string) => {
    const cifUpper = cif.toUpperCase();
    const match = empresasNomina.find((e) => e.cif === cifUpper);
    setFormData((prev) => {
      const nombrePrevEraConocido = empresasNomina.some((e) => e.nombre === prev.empresaNombre);
      return {
        ...prev,
        empresaCif: cifUpper,
        empresaNombre: match
          ? match.nombre
          : nombrePrevEraConocido
            ? ''
            : prev.empresaNombre,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalDataId) {
      showToastV5('Error: No se encontraron datos personales');
      return;
    }
    if (!formData.nombre.trim() || !formData.gestoraActual.trim() || !formData.fechaContratacion) {
      showToastV5('Completa todos los campos obligatorios');
      return;
    }
    // Validación CIF cuando el usuario llena empresaPagadora · vacío es OK.
    if (esPPEoPPES && formData.empresaCif.trim() && !CIF_REGEX.test(formData.empresaCif.trim())) {
      showToastV5('El CIF de la empresa no tiene un formato válido (ej. A12345678)');
      return;
    }
    // Coherencia · si llega CIF debe llegar también nombre, y al revés.
    const cifLleno = formData.empresaCif.trim().length > 0;
    const nombreLleno = formData.empresaNombre.trim().length > 0;
    if (esPPEoPPES && cifLleno !== nombreLleno) {
      showToastV5('Empresa pagadora · introduce CIF y nombre, o deja ambos vacíos');
      return;
    }

    setLoading(true);
    try {
      const empresaPagadora =
        esPPEoPPES && cifLleno && nombreLleno
          ? { cif: formData.empresaCif.trim().toUpperCase(), nombre: formData.empresaNombre.trim() }
          : undefined;

      const planData: Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId,
        nombre: formData.nombre.trim(),
        tipoAdministrativo: formData.tipoAdministrativo,
        subtipoPPE: esPPE ? formData.subtipoPPE : undefined,
        subtipoPPES: esPPES ? formData.subtipoPPES : undefined,
        politicaInversion: formData.politicaInversion,
        participeConDiscapacidad: formData.participeConDiscapacidad || undefined,
        empresaPagadora,
        gestoraActual: formData.gestoraActual.trim(),
        isinActual: formData.isinActual.trim() || undefined,
        fechaContratacion: formData.fechaContratacion,
        importeInicial: formData.importeInicial ? parseFloat(formData.importeInicial) : undefined,
        valorActual: formData.valorActual ? parseFloat(formData.valorActual) : undefined,
        titular: formData.titular,
        estado: formData.estado,
        origen: 'manual',
      };

      const savedPlan = plan?.id
        ? await planesPensionesService.updatePlan(plan.id, planData)
        : await planesPensionesService.createPlan(planData);

      showToastV5(plan ? 'Plan actualizado.' : 'Plan creado.');
      onSaved(savedPlan);
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] plan save', err);
      showToastV5('Error al guardar el plan de pensiones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={dialog.overlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${dialog.dialog} ${dialog.sizeLg}`}>
        <div className={dialog.header}>
          <div>
            <h2>{plan ? 'Editar plan de pensiones' : 'Nuevo plan de pensiones'}</h2>
          </div>
          <button
            type="button"
            className={dialog.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={dialog.body}>

            {/* Tipo administrativo */}
            <div className={styles.tiposLabel}>Tipo administrativo *</div>
            <div className={styles.tiposGrid}>
              {TIPOS_ADMIN.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.tipoBtn} ${formData.tipoAdministrativo === value ? styles.tipoBtnActive : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, tipoAdministrativo: value }))}
                >
                  <span className={styles.tipoBtnLabel}>{label}</span>
                  <span className={styles.tipoBtnDesc}>{desc}</span>
                </button>
              ))}
            </div>

            {/* Subtipo PPE · solo cuando tipo=PPE */}
            {esPPE && (
              <div className={dialog.row2}>
                <div className={dialog.field}>
                  <label htmlFor="pf-subtipo-ppe">Subtipo PPE *</label>
                  <select
                    id="pf-subtipo-ppe"
                    value={formData.subtipoPPE}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtipoPPE: e.target.value as SubtipoPPE }))}
                  >
                    {SUBTIPOS_PPE.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div />
              </div>
            )}

            {/* Subtipo PPES · solo cuando tipo=PPES */}
            {esPPES && (
              <div className={dialog.row2}>
                <div className={dialog.field}>
                  <label htmlFor="pf-subtipo-ppes">Subtipo PPES *</label>
                  <select
                    id="pf-subtipo-ppes"
                    value={formData.subtipoPPES}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtipoPPES: e.target.value as SubtipoPPES }))}
                  >
                    {SUBTIPOS_PPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div />
              </div>
            )}

            {/* Empresa pagadora · CIF + nombre · solo PPE/PPES.
                Dos datalists separados · el input de CIF sugiere CIFs
                (option.value=cif) y el de nombre sugiere nombres
                (option.value=nombre). Si fuesen compartidos, al elegir una
                opción el navegador insertaría el `value` literal en el input,
                rompiendo el flujo cruzado. */}
            {esPPEoPPES && (
              <>
                <div className={dialog.row2}>
                  <div className={dialog.field}>
                    <label htmlFor="pf-empresa-cif">CIF empresa pagadora</label>
                    <input
                      id="pf-empresa-cif"
                      type="text"
                      value={formData.empresaCif}
                      onChange={(e) => handleEmpresaCifChange(e.target.value)}
                      placeholder="Ej: A82009812"
                      maxLength={9}
                      list={empresasNomina.length > 0 ? empresasCifDatalistId : undefined}
                    />
                  </div>
                  <div className={dialog.field}>
                    <label htmlFor="pf-empresa-nombre">Nombre empresa pagadora</label>
                    <input
                      id="pf-empresa-nombre"
                      type="text"
                      value={formData.empresaNombre}
                      onChange={(e) => handleEmpresaNombreChange(e.target.value)}
                      placeholder="Ej: Orange España S.A.U."
                      list={empresasNomina.length > 0 ? empresasNombreDatalistId : undefined}
                    />
                  </div>
                </div>
                {empresasNomina.length > 0 && (
                  <>
                    <datalist id={empresasCifDatalistId}>
                      {empresasNomina.map((e) => (
                        <option key={e.cif} value={e.cif}>{e.nombre}</option>
                      ))}
                    </datalist>
                    <datalist id={empresasNombreDatalistId}>
                      {empresasNomina.map((e) => (
                        <option key={e.cif} value={e.nombre}>{e.cif}</option>
                      ))}
                    </datalist>
                  </>
                )}
              </>
            )}

            {/* Nombre y gestora */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-nombre">Nombre del plan *</label>
                <input
                  id="pf-nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Plan Naranja IRPF"
                  required
                />
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-gestora">Entidad gestora *</label>
                <input
                  id="pf-gestora"
                  type="text"
                  value={formData.gestoraActual}
                  onChange={(e) => setFormData(prev => ({ ...prev, gestoraActual: e.target.value }))}
                  placeholder="Ej: ING, Caixabank, Renta 4…"
                  required
                />
              </div>
            </div>

            {/* ISIN y fecha */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-isin">ISIN (opcional)</label>
                <input
                  id="pf-isin"
                  type="text"
                  value={formData.isinActual}
                  onChange={(e) => setFormData(prev => ({ ...prev, isinActual: e.target.value }))}
                  placeholder="Ej: ES0123456789"
                  maxLength={12}
                />
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-fecha">Fecha de apertura *</label>
                <input
                  id="pf-fecha"
                  type="date"
                  value={formData.fechaContratacion}
                  onChange={(e) => setFormData(prev => ({ ...prev, fechaContratacion: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Valores */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-importe-inicial">Valor inicial (€)</label>
                <input
                  id="pf-importe-inicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.importeInicial}
                  onChange={(e) => setFormData(prev => ({ ...prev, importeInicial: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-valor-actual">Valor actual (€)</label>
                <input
                  id="pf-valor-actual"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valorActual}
                  onChange={(e) => setFormData(prev => ({ ...prev, valorActual: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Política de inversión */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-politica">Política de inversión</label>
                <select
                  id="pf-politica"
                  value={formData.politicaInversion}
                  onChange={(e) => setFormData(prev => ({ ...prev, politicaInversion: e.target.value as PoliticaInversion }))}
                >
                  {POLITICAS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-discap" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 24 }}>
                  <input
                    id="pf-discap"
                    type="checkbox"
                    checked={formData.participeConDiscapacidad}
                    onChange={(e) => setFormData(prev => ({ ...prev, participeConDiscapacidad: e.target.checked }))}
                  />
                  <span>Partícipe con discapacidad ≥ 33 %</span>
                </label>
                <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginTop: 4 }}>
                  {getCopyLimiteFiscal(
                    formData.tipoAdministrativo,
                    formData.subtipoPPES,
                    formData.participeConDiscapacidad,
                  )}
                </div>
              </div>
            </div>

            {/* Titular y estado */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-titular">Titular</label>
                <select
                  id="pf-titular"
                  value={formData.titular}
                  onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value as 'yo' | 'pareja' }))}
                >
                  <option value="yo">Yo</option>
                  <option value="pareja">Pareja</option>
                </select>
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-estado">Estado del plan</label>
                <select
                  id="pf-estado"
                  value={formData.estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value as EstadoPlan }))}
                >
                  <option value="activo">Activo</option>
                  <option value="rescatado_total">Rescatado (total)</option>
                  <option value="rescatado_parcial">Rescatado (parcial)</option>
                  <option value="traspasado_externo">Traspasado a externo</option>
                </select>
              </div>
            </div>

          </div>

          <div className={dialog.footer}>
            <button
              type="button"
              className={dialog.btnSecondary}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={dialog.btnPrimary}
              disabled={loading}
            >
              {loading ? 'Guardando…' : plan ? 'Actualizar plan' : 'Crear plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanFormV5;
