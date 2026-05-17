// AltaPlanWizard · Modal de alta plan de pensiones · PR 3 T-INVERSIONES-V5
//
// Reemplaza el flujo del wizard plan T13v4 (PlanFormV5 + WizardNuevaPosicion)
// con el patrón ATLAS · header navy + body 2-col + preview en vivo + footer.
// Preserva la lógica T13v4 intacta:
//   - 4 tipos administrativos (PPI · PPE · PPES · PPA)
//   - subtipoPPE / subtipoPPES condicionales
//   - CIF + nombre empresa pagadora (sólo PPE/PPES) con datalist de nóminas
//   - check participeConDiscapacidad
//   - validación CIF + coherencia CIF↔nombre
//   - submit vía planesPensionesService.createPlan
//
// Preview · cálculo fiscal con límite deducible dinámico (§7.1) · cambia en
// vivo según tipoAdministrativo + subtipoPPES + check discapacidad. Muestra
// ahorro estimado IRPF al marginal 45% (configurable en Personal en PRs
// futuros).
//
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §B (modal-alta-plan).

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import { planesPensionesService } from '../../../../services/planesPensionesService';
import { getFiscalContextSafe } from '../../../../services/fiscalContextService';
import { nominaService } from '../../../../services/nominaService';
import type {
  EstadoPlan,
  PlanPensiones,
  PoliticaInversion,
  SubtipoPPE,
  SubtipoPPES,
  TipoAdministrativo,
} from '../../../../types/planesPensiones';
import { calcularLimitePlan, formatCurrency } from '../../helpers';
import ModalAtlas, { ModalAtlasBody, ModalAtlasForm } from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from './ModalAtlasFooter';
import ModalAtlasPreview, {
  ModalAtlasPreviewBanner,
  ModalAtlasPreviewBlock,
  ModalAtlasPreviewCardDark,
  ModalAtlasPreviewRow,
} from './ModalAtlasPreview';
import styles from '../../styles/atlas-inversiones.module.css';

// Marginal IRPF estimado para preview · default 45% · §7.1 ajustable desde
// Personal en futuras tareas (D5). Por ahora hardcoded.
const MARGINAL_IRPF_DEFAULT = 0.45;

const CIF_REGEX = /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/i;

interface TipoCard {
  value: TipoAdministrativo;
  label: string;
  sub: string;
}

const TIPOS_CARDS: TipoCard[] = [
  { value: 'PPI', label: 'PPI', sub: 'Individual · aportación libre' },
  { value: 'PPE', label: 'PPE', sub: 'Empleo · empresa promotora' },
  { value: 'PPES', label: 'PPES', sub: 'Empleo simplificado' },
  { value: 'PPA', label: 'PPA', sub: 'Asegurado garantizado' },
];

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

interface EmpresaUnica {
  cif: string;
  nombre: string;
}

export interface AltaPlanWizardProps {
  /** Tipo administrativo preseleccionado al abrir. Default 'PPE'. */
  tipoInicial?: TipoAdministrativo;
  /** Llamado tras `createPlan` exitoso. */
  onSaved: (plan: PlanPensiones) => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AltaPlanWizard: React.FC<AltaPlanWizardProps> = ({
  tipoInicial = 'PPE',
  onSaved,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [empresasNomina, setEmpresasNomina] = useState<EmpresaUnica[]>([]);

  const [tipoAdministrativo, setTipoAdministrativo] = useState<TipoAdministrativo>(tipoInicial);
  const [subtipoPPE, setSubtipoPPE] = useState<SubtipoPPE>('empleador_unico');
  const [subtipoPPES, setSubtipoPPES] = useState<SubtipoPPES>('sectorial');
  const [politicaInversion, setPoliticaInversion] = useState<PoliticaInversion>('desconocido');
  const [participeConDiscapacidad, setParticipeConDiscapacidad] = useState(false);
  const [empresaCif, setEmpresaCif] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [nombre, setNombre] = useState('');
  const [gestoraActual, setGestoraActual] = useState('');
  const [isinActual, setIsinActual] = useState('');
  const [fechaContratacion, setFechaContratacion] = useState(today());
  const [importeInicial, setImporteInicial] = useState('');
  const [valorActual, setValorActual] = useState('');
  const [titular, setTitular] = useState<'yo' | 'pareja'>('yo');
  const [estado, setEstado] = useState<EstadoPlan>('activo');

  const baseId = useId();
  const cifListId = `${baseId}-cif`;
  const nombreListId = `${baseId}-nombre`;

  const esPPE = tipoAdministrativo === 'PPE';
  const esPPES = tipoAdministrativo === 'PPES';
  const esPPEoPPES = esPPE || esPPES;

  // ── Cargar contexto fiscal + empresas desde nóminas ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctx = await getFiscalContextSafe();
        if (!ctx || cancelled) return;
        setPersonalDataId(ctx.personalDataId);
        try {
          const nominas = await nominaService.getNominas(ctx.personalDataId);
          if (cancelled) return;
          const map = new Map<string, EmpresaUnica>();
          for (const n of nominas) {
            const cif = n.empresa?.cif?.trim().toUpperCase();
            const nom = n.empresa?.nombre?.trim();
            if (cif && nom && !map.has(cif)) map.set(cif, { cif, nombre: nom });
          }
          setEmpresasNomina(Array.from(map.values()));
        } catch {
          /* sin nóminas · datalist vacío */
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Autocompletes CIF↔nombre (preserva lógica T13v4) ──────────────
  const handleEmpresaNombreChange = (next: string) => {
    setEmpresaNombre(next);
    const match = empresasNomina.find((e) => e.nombre === next);
    if (match) setEmpresaCif(match.cif);
    else if (empresasNomina.some((e) => e.cif === empresaCif)) setEmpresaCif('');
  };

  const handleEmpresaCifChange = (next: string) => {
    const upper = next.toUpperCase();
    setEmpresaCif(upper);
    const match = empresasNomina.find((e) => e.cif === upper);
    if (match) setEmpresaNombre(match.nombre);
    else if (empresasNomina.some((e) => e.nombre === empresaNombre)) setEmpresaNombre('');
  };

  // ── Cálculo fiscal en vivo (§7.1) ─────────────────────────────────
  const limite = useMemo(
    () => calcularLimitePlan(tipoAdministrativo, subtipoPPES, participeConDiscapacidad),
    [tipoAdministrativo, subtipoPPES, participeConDiscapacidad],
  );

  const ahorroEstimado = useMemo(
    () => Math.round(limite.limite * MARGINAL_IRPF_DEFAULT),
    [limite.limite],
  );

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalDataId) {
      showToastV5('Error: No se encontraron datos personales');
      return;
    }
    if (!nombre.trim() || !gestoraActual.trim() || !fechaContratacion) {
      showToastV5('Completa todos los campos obligatorios');
      return;
    }
    if (esPPEoPPES && empresaCif.trim() && !CIF_REGEX.test(empresaCif.trim())) {
      showToastV5('El CIF de la empresa no tiene un formato válido (ej. A12345678)');
      return;
    }
    const cifLleno = empresaCif.trim().length > 0;
    const nombreLleno = empresaNombre.trim().length > 0;
    if (esPPEoPPES && cifLleno !== nombreLleno) {
      showToastV5('Empresa pagadora · introduce CIF y nombre, o deja ambos vacíos');
      return;
    }

    setLoading(true);
    try {
      const empresaPagadora =
        esPPEoPPES && cifLleno && nombreLleno
          ? { cif: empresaCif.trim().toUpperCase(), nombre: empresaNombre.trim() }
          : undefined;

      const planData: Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId,
        nombre: nombre.trim(),
        tipoAdministrativo,
        subtipoPPE: esPPE ? subtipoPPE : undefined,
        subtipoPPES: esPPES ? subtipoPPES : undefined,
        politicaInversion,
        participeConDiscapacidad: participeConDiscapacidad || undefined,
        empresaPagadora,
        gestoraActual: gestoraActual.trim(),
        isinActual: isinActual.trim() || undefined,
        fechaContratacion,
        importeInicial: importeInicial ? parseFloat(importeInicial) : undefined,
        valorActual: valorActual ? parseFloat(valorActual) : undefined,
        titular,
        estado,
        origen: 'manual',
      };
      const saved = await planesPensionesService.createPlan(planData);
      showToastV5('Plan creado.');
      onSaved(saved);
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] alta plan', err);
      showToastV5('Error al guardar el plan de pensiones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Alta plan de pensiones">
      <ModalAtlasHeader
        icon={<Icons.PiggyBank size={18} strokeWidth={1.7} />}
        title="Nuevo plan de pensiones"
        subtitle="elige tipo administrativo · el límite fiscal se calcula en vivo"
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            {/* Tipo administrativo · 4 cards */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Tipo administrativo<span className={styles.req}>*</span>
              </div>
              <div
                className={`${styles.selectorH} ${styles.cols4}`}
                role="radiogroup"
                aria-label="Tipo administrativo"
              >
                {TIPOS_CARDS.map((t) => {
                  const active = tipoAdministrativo === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.tab}${active ? ' ' + styles.active : ''}`}
                      onClick={() => setTipoAdministrativo(t.value)}
                      data-tipo={t.value}
                    >
                      <span className={styles.tabLabel}>{t.label}</span>
                      <span className={styles.tabSub}>{t.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtipo PPE/PPES + check discapacidad */}
            {(esPPE || esPPES) && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  {esPPE ? 'Subtipo PPE' : 'Subtipo PPES'}
                  <span className={styles.req}>*</span>
                </div>
                <div className={`${styles.row} ${styles.cols1}`}>
                  <div className={styles.field}>
                    <select
                      className={styles.select}
                      value={esPPE ? subtipoPPE : subtipoPPES}
                      onChange={(e) =>
                        esPPE
                          ? setSubtipoPPE(e.target.value as SubtipoPPE)
                          : setSubtipoPPES(e.target.value as SubtipoPPES)
                      }
                      aria-label={esPPE ? 'Subtipo PPE' : 'Subtipo PPES'}
                    >
                      {(esPPE ? SUBTIPOS_PPE : SUBTIPOS_PPES).map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Empresa pagadora · sólo PPE/PPES */}
            {esPPEoPPES && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Empresa pagadora</div>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`${baseId}-cif-input`}>
                      CIF<span className={styles.opt}>opcional</span>
                    </label>
                    <input
                      id={`${baseId}-cif-input`}
                      type="text"
                      className={styles.input}
                      value={empresaCif}
                      onChange={(e) => handleEmpresaCifChange(e.target.value)}
                      placeholder="Ej. A82009812"
                      maxLength={9}
                      list={empresasNomina.length > 0 ? cifListId : undefined}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`${baseId}-nombre-input`}>
                      Nombre<span className={styles.opt}>opcional</span>
                    </label>
                    <input
                      id={`${baseId}-nombre-input`}
                      type="text"
                      className={styles.input}
                      value={empresaNombre}
                      onChange={(e) => handleEmpresaNombreChange(e.target.value)}
                      placeholder="Ej. Orange España S.A.U."
                      list={empresasNomina.length > 0 ? nombreListId : undefined}
                    />
                  </div>
                </div>
                {empresasNomina.length > 0 && (
                  <>
                    <datalist id={cifListId}>
                      {empresasNomina.map((e) => (
                        <option key={e.cif} value={e.cif}>
                          {e.nombre}
                        </option>
                      ))}
                    </datalist>
                    <datalist id={nombreListId}>
                      {empresasNomina.map((e) => (
                        <option key={e.cif} value={e.nombre}>
                          {e.cif}
                        </option>
                      ))}
                    </datalist>
                  </>
                )}
              </div>
            )}

            {/* Identificación · nombre + gestora */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Identificación del plan</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Nombre del plan<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Plan Naranja IRPF"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Entidad gestora<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={gestoraActual}
                    onChange={(e) => setGestoraActual(e.target.value)}
                    placeholder="Ej. ING, Caixabank, Renta 4…"
                    required
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    ISIN<span className={styles.opt}>opcional</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={isinActual}
                    onChange={(e) => setIsinActual(e.target.value)}
                    placeholder="Ej. ES0123456789"
                    maxLength={12}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha de apertura<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fechaContratacion}
                    onChange={(e) => setFechaContratacion(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Valoración */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Valoración inicial</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Valor inicial<span className={styles.opt}>€ · opcional</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={importeInicial}
                    onChange={(e) => setImporteInicial(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Valor actual<span className={styles.opt}>€ · opcional</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={valorActual}
                    onChange={(e) => setValorActual(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Política + titular + estado + discapacidad */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Configuración</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Política de inversión</label>
                  <select
                    className={styles.select}
                    value={politicaInversion}
                    onChange={(e) => setPoliticaInversion(e.target.value as PoliticaInversion)}
                  >
                    {POLITICAS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Titular</label>
                  <select
                    className={styles.select}
                    value={titular}
                    onChange={(e) => setTitular(e.target.value as 'yo' | 'pareja')}
                  >
                    <option value="yo">Yo</option>
                    <option value="pareja">Pareja</option>
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Estado del plan</label>
                  <select
                    className={styles.select}
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoPlan)}
                  >
                    <option value="activo">Activo</option>
                    <option value="rescatado_total">Rescatado (total)</option>
                    <option value="rescatado_parcial">Rescatado (parcial)</option>
                    <option value="traspasado_externo">Traspasado a externo</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <button
                    type="button"
                    className={`${styles.check}${participeConDiscapacidad ? ' ' + styles.active : ''}`}
                    onClick={() => setParticipeConDiscapacidad((v) => !v)}
                    aria-pressed={participeConDiscapacidad}
                    data-testid="check-discapacidad"
                  >
                    <span className={styles.checkBox} aria-hidden>
                      {participeConDiscapacidad ? '✓' : ''}
                    </span>
                    <div>
                      <div className={styles.checkTit}>
                        Partícipe con discapacidad ≥ 33%
                      </div>
                      <div className={styles.checkSub}>
                        sube el límite deducible a 24.250 € (art. 52.1.c LIRPF)
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </ModalAtlasForm>

          {/* ── Preview en vivo · cálculo fiscal ───────────────────── */}
          <ModalAtlasPreview
            header="Cálculo fiscal"
            headerIcon={<Icons.PiggyBank size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Límite deducible"
              value={formatCurrency(limite.limite)}
              valueVariant="gold"
              sub={limite.articulo}
              subAsText
            />

            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow k="Tipo administrativo" v={tipoAdministrativo} />
              {esPPES && (
                <ModalAtlasPreviewRow
                  k="Subtipo PPES"
                  v={SUBTIPOS_PPES.find((s) => s.value === subtipoPPES)?.label ?? subtipoPPES}
                  variant="txt"
                />
              )}
              <ModalAtlasPreviewRow
                k="Discapacidad ≥ 33%"
                v={participeConDiscapacidad ? 'Sí' : 'No'}
                variant="txt"
              />
              {limite.desglose && (
                <ModalAtlasPreviewRow k="Desglose" v={limite.desglose} variant="txt" />
              )}
            </ModalAtlasPreviewBlock>

            <ModalAtlasPreviewBlock>
              <div className={styles.sectionTitle}>Ahorro estimado IRPF</div>
              <ModalAtlasPreviewRow
                k={`marginal ${(MARGINAL_IRPF_DEFAULT * 100).toFixed(0)}%`}
                v={formatCurrency(ahorroEstimado)}
                variant="pos"
              />
              <ModalAtlasPreviewBanner>
                Si llenas el límite aplicable este año, ahorras hasta{' '}
                <strong>{formatCurrency(ahorroEstimado)}</strong> en cuota IRPF.
                Cifra calculada con marginal 45% · ajustable en Personal.
              </ModalAtlasPreviewBanner>
            </ModalAtlasPreviewBlock>
          </ModalAtlasPreview>
        </ModalAtlasBody>

        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              El plan se crea como activo · puedes registrar aportaciones luego.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Crear plan'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AltaPlanWizard;
