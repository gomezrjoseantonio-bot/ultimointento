// ============================================================================
// S-WIZARD-NOMINA-V3 · sub-tarea 3 · pantalla única ATLAS v8
// ============================================================================
//
// Wizard de nómina · 1 sola pantalla · modal full-screen · 2 columnas (form
// izquierda · preview live derecha). Reemplaza al antiguo NominaWizard de 3
// pasos. Mockup canónico · docs/mockups/atlas-wizard-nomina-v3.html.
//
// Reglas inviolables aplicadas:
//  · Cero hex hardcoded · 100 % tokens v8 (definidos en CSS Module).
//  · Selección visual = oro (gold-bg + gold border) · chips meses, radios.
//  · Sentence case en todo el copy · solo títulos de bloque en uppercase.
//  · Cero lenguaje técnico ("Treasury Events", "Snapshot" no aparecen).
//  · Lectura de CCAA desde `personalData` (NO `personalModuleConfig`).
//  · NUNCA estimación teórica de IRPF · solo input manual o badge de
//    certificado AEAT (badge actualmente desactivado · servicio no existe).
//
// Sub-tarea 3 cubre · estructura, preview live, carga inicial, submit base.
// Sub-tarea 4 reforzará · validaciones avanzadas, tests integración, edge
// cases del modo "Cambio desde fecha".
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  FileText,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { nominaService, buildSnapshotFromNomina } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { limitesFiscalesPlanesService } from '../../../services/limitesFiscalesPlanesService';
import { getBaseMaxima, getSSDefaults } from '../../../constants/cotizacionSS';
import { calcularNomina, type CalcularNominaInput } from '../../../services/nominaCalculatorService';
import type { Account } from '../../../services/db';
import type { PlanPensiones } from '../../../types/planesPensiones';
import type {
  Nomina,
  Variable,
  BeneficioSocial,
  PlanPensionesNomina,
} from '../../../types/personal';
import styles from './NominaPage.module.css';

// ─── Constantes ─────────────────────────────────────────────────────────────
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTO = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const PAGAS_OPCIONES = [12, 14, 15, 16] as const;

const ESPECIE_CATALOGO: Array<{ id: BeneficioSocial['tipo']; label: string }> = [
  { id: 'seguro-vida',       label: 'Seguro vida' },
  { id: 'seguro-medico',     label: 'Seguro médico' },
  { id: 'vehiculo-empresa',  label: 'Vehículo / gasolina' },
  { id: 'telefono',          label: 'Teléfono móvil' },
  { id: 'gasolina',          label: 'Cheque restaurante' },
  { id: 'cheque-guarderia',  label: 'Guardería' },
  { id: 'otro',              label: 'Otro' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtEur = (v: number, dec = 2) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(Number.isFinite(v) ? v : 0) + ' €';

const fmtNeg = (v: number) => '− ' + fmtEur(Math.abs(v));

const parseNum = (raw: string): number => {
  if (!raw || typeof raw !== 'string') return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const accountLabel = (a: Account): string => {
  const last4 = (a.iban || '').replace(/\s/g, '').slice(-4) || '????';
  const banco = a.alias || a.banco?.name || a.bank || a.name || 'Cuenta';
  return `${banco} · ···· ${last4}`;
};

// ─── Tipos del form state ───────────────────────────────────────────────────
interface FormVariable {
  id: string;
  nombre: string;
  tipo: 'porcentaje' | 'importe';
  valorRaw: string;
  mes: number;
}

interface FormEspecie {
  id: string;
  concepto: string;
  importeRaw: string;
  sumaIRPF: boolean;
  tipo?: BeneficioSocial['tipo'];
}

type ModoEdicion = 'rectificacion' | 'cambio-desde-fecha';

// ─── Componente ─────────────────────────────────────────────────────────────
const NominaPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const titularParam = (searchParams.get('titular') || 'yo') as 'yo' | 'pareja';
  const parsedId = idParam !== null ? Number(idParam) : null;
  const nominaId = parsedId !== null && Number.isFinite(parsedId) ? parsedId : null;
  const isEditing = nominaId !== null;

  const ssYear = useMemo(() => new Date().getFullYear(), []);
  const ssTope = useMemo(() => getBaseMaxima(ssYear), [ssYear]);
  const ssDef = useMemo(() => getSSDefaults(ssYear), [ssYear]);
  const ssPctSugerido = useMemo(
    () =>
      ssDef.contingenciasComunes.trabajador +
      ssDef.desempleo.trabajador +
      ssDef.formacionProfesional.trabajador +
      ssDef.mei.trabajador,
    [ssDef],
  );

  // ─── Form state ───────────────────────────────────────────────────────────
  const [pid, setPid] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState<string>('');
  const [titular] = useState<'yo' | 'pareja'>(titularParam);

  // Bloque 1
  const [empresa, setEmpresa] = useState('');
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [vigenteDesde, setVigenteDesde] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [diaCobro, setDiaCobro] = useState<string>('25');

  // Bloque 2
  const [brutoRaw, setBrutoRaw] = useState('');
  const [numeroPagas, setNumeroPagas] = useState<number>(14);
  const [mesesExtra, setMesesExtra] = useState<number[]>([6, 12]);
  const [irpfRaw, setIrpfRaw] = useState('');
  const [ssRaw, setSsRaw] = useState<string>(ssPctSugerido.toFixed(2).replace('.', ','));
  const [solidaridadRaw, setSolidaridadRaw] = useState('0');

  // Bloque 3
  const [variables, setVariables] = useState<FormVariable[]>([]);

  // Bloque 4
  const [planActivo, setPlanActivo] = useState(false);
  const [planVinculadoId, setPlanVinculadoId] = useState<string>('');
  const [planAportTuya, setPlanAportTuya] = useState('0');
  const [planAportEmpresa, setPlanAportEmpresa] = useState('0');

  // Bloque 5
  const [especieActivo, setEspecieActivo] = useState(false);
  const [especies, setEspecies] = useState<FormEspecie[]>([]);

  // Bloque 6 (solo en edit)
  const [modoEdicion, setModoEdicion] = useState<ModoEdicion>('rectificacion');

  // Datos auxiliares
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [planes, setPlanes] = useState<PlanPensiones[]>([]);
  const [comunidadAutonoma, setComunidadAutonoma] = useState<string>('');
  const [vigenciaInicial, setVigenciaInicial] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const personal = await personalDataService.getPersonalData();
        if (!cancelled && personal) {
          setPid(personal.id ?? null);
          setComunidadAutonoma(personal.comunidadAutonoma ?? '');
          const fullName = `${personal.nombre || ''} ${personal.apellidos || ''}`.trim();
          setTitularNombre(titular === 'pareja' ? (personal.spouseName || 'Pareja') : fullName);
        }

        const [cuentas, planesAll] = await Promise.all([
          cuentasService.list(),
          planesPensionesService.getAllPlanes({ titular }),
        ]);
        if (cancelled) return;
        setAccounts(cuentas.filter((a) => a.activa !== false && a.status !== 'DELETED'));
        // Filtrar PPE + PPES (los que admiten aportación de empresa).
        const planesEmpresa = planesAll.filter(
          (p) => p.tipoAdministrativo === 'PPE' || p.tipoAdministrativo === 'PPES',
        );
        setPlanes(planesEmpresa);

        if (nominaId !== null) {
          const existente = await nominaService.getNominaById(nominaId);
          if (existente && !cancelled) {
            hydrateFromNomina(existente);
          }
        } else if (cuentas.length > 0 && !cancelled) {
          const def = cuentas.find((c) => c.isDefault) ?? cuentas[0];
          setCuentaId(def.id ?? null);
        }
      } catch (e) {
        console.error('[NominaPage] error carga inicial', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nominaId, titular]);

  const hydrateFromNomina = (n: Nomina) => {
    setEmpresa(n.empresa?.nombre || n.nombre || '');
    setCuentaId(n.cuentaAbono ?? null);
    if (n.fechaAntiguedad) {
      setVigenteDesde(n.fechaAntiguedad.slice(0, 7));
      setVigenciaInicial(n.fechaAntiguedad.slice(0, 10));
    }
    if (n.reglaCobroDia?.tipo === 'fijo' && n.reglaCobroDia.dia) {
      setDiaCobro(String(n.reglaCobroDia.dia));
    } else if (n.reglaCobroDia?.tipo === 'ultimo-habil') {
      setDiaCobro('31');
    }

    setBrutoRaw(formatRaw(n.salarioBrutoAnual));
    const numPagas = n.distribucion?.tipo === 'doce' ? 12
      : n.distribucion?.tipo === 'catorce' ? 14
      : (n.distribucion?.meses ?? 12);
    setNumeroPagas(numPagas);
    if (n.pagasExtra?.mesesExtra && n.pagasExtra.mesesExtra.length > 0) {
      setMesesExtra(n.pagasExtra.mesesExtra);
    } else if (numPagas === 14) {
      setMesesExtra([6, 12]);
    } else {
      setMesesExtra([]);
    }

    setIrpfRaw(formatRaw(n.retencion.irpfPorcentaje));
    const ssSum =
      n.retencion.ss.contingenciasComunes +
      n.retencion.ss.desempleo +
      n.retencion.ss.formacionProfesional +
      (n.retencion.ss.mei ?? 0);
    setSsRaw(formatRaw(ssSum));
    setSolidaridadRaw(formatRaw((n.retencion.cuotaSolidaridadMensual ?? 0) * 12));

    const formVars: FormVariable[] = (n.variables || []).map((v) => {
      const principalMes = v.distribucionMeses?.[0]?.mes ?? 1;
      return {
        id: v.id || uid(),
        nombre: v.nombre,
        tipo: v.tipo,
        valorRaw: formatRaw(v.valor),
        mes: principalMes,
      };
    });
    (n.bonus || []).forEach((b) => {
      formVars.push({
        id: b.id || uid(),
        nombre: b.descripcion,
        tipo: 'importe',
        valorRaw: formatRaw(b.importe),
        mes: b.mes,
      });
    });
    setVariables(formVars);

    if (n.planPensiones) {
      setPlanActivo(true);
      setPlanVinculadoId(String(n.planPensiones.productoDestinoId ?? ''));
      const tuya = n.planPensiones.aportacionEmpleado;
      const emp = n.planPensiones.aportacionEmpresa;
      setPlanAportTuya(formatRaw(tuya.tipo === 'importe' ? tuya.valor : 0));
      setPlanAportEmpresa(formatRaw(emp.tipo === 'importe' ? emp.valor : 0));
    }

    if (n.beneficiosSociales && n.beneficiosSociales.length > 0) {
      setEspecieActivo(true);
      setEspecies(
        n.beneficiosSociales.map((b) => ({
          id: b.id || uid(),
          concepto: b.concepto,
          importeRaw: formatRaw(b.importeMensual),
          sumaIRPF: b.incrementaBaseIRPF,
          tipo: b.tipo,
        })),
      );
    }
  };

  const formatRaw = (v: number): string =>
    new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v || 0);

  // ─── Cálculo live ─────────────────────────────────────────────────────────
  const calcInput: CalcularNominaInput = useMemo(
    () => ({
      brutoAnual: parseNum(brutoRaw),
      numeroPagas,
      mesesPagaExtra: mesesExtra,
      variables: variables.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        tipo: v.tipo,
        valor: parseNum(v.valorRaw),
        mes: v.mes,
      })),
      irpfPorcentaje: parseNum(irpfRaw),
      ssPorcentaje: parseNum(ssRaw),
      ssBaseCotizacionMensual: ssTope,
      ssOverrideManual: false,
      cuotaSolidaridadAnual: parseNum(solidaridadRaw),
      planPensiones: planActivo
        ? {
            aportacionEmpleadoMes: parseNum(planAportTuya),
            aportacionEmpresaMes: parseNum(planAportEmpresa),
          }
        : undefined,
      beneficiosEspecie: especieActivo
        ? especies.map((e) => ({
            id: e.id,
            concepto: e.concepto,
            importeMensual: parseNum(e.importeRaw),
            sumaIRPF: e.sumaIRPF,
          }))
        : [],
    }),
    [
      brutoRaw, numeroPagas, mesesExtra, variables, irpfRaw, ssRaw, ssTope,
      solidaridadRaw, planActivo, planAportTuya, planAportEmpresa,
      especieActivo, especies,
    ],
  );

  const calc = useMemo(() => calcularNomina(calcInput), [calcInput]);

  // ─── Hint del bloque sueldo (paga normal · base SS · IRPF) ────────────────
  const hintSueldo = useMemo(() => {
    const bruto = parseNum(brutoRaw);
    const np = numeroPagas;
    const pagaNormal = np > 0 ? bruto / np : 0;
    const baseSS = Math.min(ssTope, pagaNormal);
    const irpfMes = pagaNormal * (parseNum(irpfRaw) / 100);
    return {
      pagaNormal,
      baseSS,
      irpfMes,
      ss: ssDef,
    };
  }, [brutoRaw, numeroPagas, ssTope, irpfRaw, ssDef]);

  // ─── Hint del plan de pensiones (límite fiscal) ───────────────────────────
  const planHint = useMemo(() => {
    if (!planActivo) return null;
    const tuyaTotal = parseNum(planAportTuya) * 12;
    const empresaTotal = parseNum(planAportEmpresa) * 12;
    const total = tuyaTotal + empresaTotal;
    const planSel = planes.find((p) => p.id === planVinculadoId);
    let limiteEur: number | null = null;
    let tipoLabel = 'PPE';
    if (planSel) {
      const lim = limitesFiscalesPlanesService.getLimitesPorTipo(
        planSel.tipoAdministrativo,
        planSel.subtipoPPE,
        planSel.subtipoPPES,
        planSel.participeConDiscapacidad,
      );
      if (lim) {
        limiteEur = lim.limiteEfectivo;
        tipoLabel = planSel.tipoAdministrativo;
      }
    } else {
      // PPE conjunto · default
      const lim = limitesFiscalesPlanesService.getLimitesPorTipo('PPE');
      if (lim) limiteEur = lim.limiteEfectivo;
    }
    return { tuyaTotal, empresaTotal, total, limiteEur, tipoLabel };
  }, [planActivo, planAportTuya, planAportEmpresa, planVinculadoId, planes]);

  // ─── Validaciones ─────────────────────────────────────────────────────────
  const validacion = useMemo(() => {
    const errs: string[] = [];
    if (!empresa.trim()) errs.push('Empresa es obligatoria');
    if (cuentaId === null) errs.push('Cuenta destino es obligatoria');
    if (parseNum(brutoRaw) <= 0) errs.push('Bruto anual debe ser mayor que 0');
    const dia = parseInt(diaCobro, 10);
    if (!Number.isFinite(dia) || dia < 1 || dia > 31) errs.push('Día cobro fuera de rango');
    const extrasNecesarias = Math.max(0, numeroPagas - 12);
    if (mesesExtra.length !== extrasNecesarias) {
      errs.push(`Selecciona ${extrasNecesarias} mes${extrasNecesarias === 1 ? '' : 'es'} de paga extra`);
    }
    return { errs, ok: errs.length === 0 };
  }, [empresa, cuentaId, brutoRaw, diaCobro, numeroPagas, mesesExtra.length]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const markTouched = useCallback(() => setTouched(true), []);

  const toggleMesExtra = (mes: number) => {
    markTouched();
    setMesesExtra((prev) =>
      prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes].sort((a, b) => a - b),
    );
  };

  const addVariable = () => {
    markTouched();
    setVariables((prev) => [
      ...prev,
      { id: uid(), nombre: 'Variable', tipo: 'porcentaje', valorRaw: '0', mes: 3 },
    ]);
  };
  const updateVariable = (id: string, patch: Partial<FormVariable>) => {
    markTouched();
    setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };
  const deleteVariable = (id: string) => {
    markTouched();
    setVariables((prev) => prev.filter((v) => v.id !== id));
  };

  const addEspecie = (cat: typeof ESPECIE_CATALOGO[number]) => {
    markTouched();
    setEspecies((prev) => [
      ...prev,
      { id: uid(), concepto: cat.label, importeRaw: '0', sumaIRPF: false, tipo: cat.id },
    ]);
  };
  const updateEspecie = (id: string, patch: Partial<FormEspecie>) => {
    markTouched();
    setEspecies((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const deleteEspecie = (id: string) => {
    markTouched();
    setEspecies((prev) => prev.filter((e) => e.id !== id));
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const buildNominaPayload = useCallback((): Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'> | null => {
    if (pid === null) return null;
    const dia = parseInt(diaCobro, 10);
    const fecha = `${vigenteDesde}-${String(Math.min(28, Number.isFinite(dia) ? dia : 1)).padStart(2, '0')}`;
    const distribucionMeses = (mes: number) => [{ mes, porcentaje: 100 }];

    const formVars: Variable[] = variables
      .filter((v) => v.tipo === 'porcentaje' || (v.tipo === 'importe' && parseNum(v.valorRaw) > 0))
      .map((v) => ({
        id: v.id,
        nombre: v.nombre || 'Variable',
        tipo: v.tipo,
        valor: parseNum(v.valorRaw),
        distribucionMeses: distribucionMeses(v.mes),
      }));

    const beneficios: BeneficioSocial[] = especieActivo
      ? especies.map((e) => ({
          id: e.id,
          concepto: e.concepto || 'Beneficio',
          tipo: e.tipo ?? 'otro',
          importeMensual: parseNum(e.importeRaw),
          incrementaBaseIRPF: e.sumaIRPF,
        }))
      : [];

    const ssPctTotal = parseNum(ssRaw);
    // Mantenemos el desglose por defecto y aplicamos el delta sobre MEI para
    // que la suma coincida con el % introducido (preserva los pesos
    // históricos de contingencias/desempleo/FP).
    const sumDefault = ssPctSugerido;
    const meiAjustado = (ssDef.mei.trabajador ?? 0) + (ssPctTotal - sumDefault);

    const nomina: Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
      personalDataId: pid,
      titular,
      nombre: empresa,
      fechaAntiguedad: fecha,
      salarioBrutoAnual: parseNum(brutoRaw),
      distribucion: numeroPagas === 12
        ? { tipo: 'doce', meses: 12 }
        : numeroPagas === 14
          ? { tipo: 'catorce', meses: 14 }
          : { tipo: 'personalizado', meses: numeroPagas },
      variables: formVars,
      bonus: [],
      beneficiosSociales: beneficios,
      retencion: {
        irpfPorcentaje: parseNum(irpfRaw),
        ss: {
          baseCotizacionMensual: ssTope,
          contingenciasComunes: ssDef.contingenciasComunes.trabajador,
          desempleo: ssDef.desempleo.trabajador,
          formacionProfesional: ssDef.formacionProfesional.trabajador,
          mei: Math.max(0, meiAjustado),
          overrideManual: false,
        },
        cuotaSolidaridadMensual: parseNum(solidaridadRaw) / 12,
      },
      planPensiones: planActivo && planVinculadoId
        ? ({
            aportacionEmpleado: { tipo: 'importe', valor: parseNum(planAportTuya) },
            aportacionEmpresa:  { tipo: 'importe', valor: parseNum(planAportEmpresa) },
            productoDestinoId: planVinculadoId,
            productoDestinoNombre: planes.find((p) => p.id === planVinculadoId)?.nombre,
          } satisfies PlanPensionesNomina)
        : undefined,
      deduccionesAdicionales: [],
      cuentaAbono: cuentaId ?? 0,
      reglaCobroDia: parseInt(diaCobro, 10) === 31
        ? { tipo: 'ultimo-habil' }
        : { tipo: 'fijo', dia: parseInt(diaCobro, 10) },
      activa: true,
      pagasExtra: numeroPagas > 12
        ? { mesesExtra: mesesExtra.slice() }
        : undefined,
      cuotaSolidaridadMensual: parseNum(solidaridadRaw) / 12,
    };
    return nomina;
  }, [
    pid, titular, empresa, vigenteDesde, diaCobro, brutoRaw, numeroPagas, mesesExtra,
    variables, irpfRaw, ssRaw, ssTope, ssDef, ssPctSugerido, solidaridadRaw,
    planActivo, planVinculadoId, planAportTuya, planAportEmpresa, planes,
    especieActivo, especies, cuentaId,
  ]);

  const handleClose = () => {
    if (touched) {
      const ok = window.confirm('Tienes cambios sin guardar. ¿Salir igualmente?');
      if (!ok) return;
    }
    navigate(-1);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!validacion.ok) {
      setErrorMsg(validacion.errs.join(' · '));
      return;
    }
    const payload = buildNominaPayload();
    if (!payload) {
      setErrorMsg('Falta información personal · configura tu perfil antes de crear nóminas');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && nominaId !== null) {
        if (modoEdicion === 'cambio-desde-fecha') {
          const dia = parseInt(diaCobro, 10);
          const day = Number.isFinite(dia) ? Math.min(28, Math.max(1, dia)) : 1;
          const vigenciaDesde = `${vigenteDesde}-${String(day).padStart(2, '0')}`;
          await nominaService.addCambioNomina(
            nominaId,
            {
              vigenciaDesde,
              motivo: 'Cambio retributivo',
              snapshot: buildSnapshotFromNomina(payload as Nomina),
            },
            // Campos no versionados que también deben actualizarse.
            {
              nombre: payload.nombre,
              fechaAntiguedad: payload.fechaAntiguedad,
              beneficiosSociales: payload.beneficiosSociales,
              retencion: payload.retencion,
              cuentaAbono: payload.cuentaAbono,
              reglaCobroDia: payload.reglaCobroDia,
              pagasExtra: payload.pagasExtra,
              cuotaSolidaridadMensual: payload.cuotaSolidaridadMensual,
            },
          );
        } else {
          await nominaService.updateNomina(nominaId, payload);
        }
      } else {
        await nominaService.saveNomina(payload);
      }
      navigate('/gestion/personal');
    } catch (e) {
      console.error('[NominaPage] error guardando', e);
      setErrorMsg('No se ha podido guardar la nómina. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // Esc cierra modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const empresaShort = empresa.split(/\s+/)[0] || 'empresa';
  const headerTitle = isEditing ? `Editar nómina · ${empresaShort}` : `Nueva nómina · ${empresaShort}`;
  const vigenteLabel = (() => {
    const [y, m] = vigenteDesde.split('-').map(Number);
    if (!y || !m) return '';
    return `${MESES_LARGO[m - 1]} ${y}`;
  })();
  const ccaaLabel = comunidadAutonoma ? ` · ${comunidadAutonoma}` : '';

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ padding: 32, textAlign: 'center' }}>
            Cargando…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={headerTitle}>
        <div className={styles.modal}>

          {/* HEADER navy */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.headerIcon} aria-hidden="true">
                <FileText />
              </div>
              <div>
                <div className={styles.headerTitle}>{headerTitle}</div>
                <div className={styles.headerSub}>
                  {titularNombre || 'Titular'}{ccaaLabel}
                  {vigenteLabel ? ` · vigente desde ${vigenteLabel}` : ''}
                </div>
              </div>
            </div>
            <button
              className={styles.headerClose}
              onClick={handleClose}
              aria-label="Cerrar"
              type="button"
            >
              <X size={14} />
            </button>
          </div>

          {/* BODY 2 columnas */}
          <div className={styles.body}>

            {/* COLUMNA IZQUIERDA · FORM */}
            <div className={styles.colForm}>

              {/* BLOQUE 1 · Empresa y vigencia */}
              <section className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Empresa y vigencia</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={`${styles.fieldsRow} ${styles.rowEmpresa}`}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-empresa">Empresa</label>
                      <input
                        id="np-empresa"
                        className={styles.input}
                        value={empresa}
                        onChange={(e) => { setEmpresa(e.target.value); markTouched(); }}
                        placeholder="Orange Espagne SAU"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-cuenta">Cuenta destino</label>
                      <select
                        id="np-cuenta"
                        className={styles.select}
                        value={cuentaId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCuentaId(v === '' ? null : Number(v));
                          markTouched();
                        }}
                      >
                        <option value="" disabled>Selecciona cuenta…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-vigente">Vigente desde</label>
                      <input
                        id="np-vigente"
                        type="month"
                        className={styles.input}
                        value={vigenteDesde}
                        onChange={(e) => { setVigenteDesde(e.target.value); markTouched(); }}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-dia">
                        Día cobro <span className={styles.hint}>(31 = último hábil)</span>
                      </label>
                      <input
                        id="np-dia"
                        className={`${styles.input} ${styles.inputMono}`}
                        value={diaCobro}
                        onChange={(e) => { setDiaCobro(e.target.value); markTouched(); }}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* BLOQUE 2 · Sueldo y retenciones */}
              <section className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Sueldo y retenciones</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={`${styles.fieldsRow} ${styles.rowSueldo}`}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-bruto">Bruto anual fijo</label>
                      <div className={styles.inputSuffix}>
                        <input
                          id="np-bruto"
                          className={`${styles.input} ${styles.inputMono}`}
                          value={brutoRaw}
                          onChange={(e) => { setBrutoRaw(e.target.value); markTouched(); }}
                          placeholder="0,00"
                          inputMode="decimal"
                        />
                        <span className={styles.suffix}>€</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-pagas">Nº pagas</label>
                      <select
                        id="np-pagas"
                        className={styles.select}
                        value={numeroPagas}
                        onChange={(e) => {
                          const np = Number(e.target.value);
                          setNumeroPagas(np);
                          markTouched();
                          // Reajusta los meses extras al cambiar número de pagas
                          const necesarias = Math.max(0, np - 12);
                          setMesesExtra((prev) => prev.slice(0, necesarias));
                        }}
                      >
                        {PAGAS_OPCIONES.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-irpf">% IRPF</label>
                      <div className={styles.inputSuffix}>
                        <input
                          id="np-irpf"
                          className={`${styles.input} ${styles.inputMono}`}
                          value={irpfRaw}
                          onChange={(e) => { setIrpfRaw(e.target.value); markTouched(); }}
                          placeholder="0,00"
                          inputMode="decimal"
                        />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-ss">% SS empleado</label>
                      <div className={styles.inputSuffix}>
                        <input
                          id="np-ss"
                          className={`${styles.input} ${styles.inputMono}`}
                          value={ssRaw}
                          onChange={(e) => { setSsRaw(e.target.value); markTouched(); }}
                          inputMode="decimal"
                        />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="np-solidaridad">Cuota solidaridad</label>
                      <div className={styles.inputSuffix}>
                        <input
                          id="np-solidaridad"
                          className={`${styles.input} ${styles.inputMono}`}
                          value={solidaridadRaw}
                          onChange={(e) => { setSolidaridadRaw(e.target.value); markTouched(); }}
                          inputMode="decimal"
                        />
                        <span className={styles.suffix}>€/año</span>
                      </div>
                    </div>
                  </div>

                  {/* Pagas extras · solo si nº pagas ≥ 14 */}
                  {numeroPagas >= 14 && (
                    <div className={styles.pagasExtras}>
                      <span className={styles.pagasExtrasLabel}>
                        Pagas extras en <span className={styles.hint}>(elige {numeroPagas - 12})</span>
                      </span>
                      {MESES_CORTO.map((label, i) => {
                        const m = i + 1;
                        const sel = mesesExtra.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleMesExtra(m)}
                            className={`${styles.monthChip} ${sel ? styles.selected : ''}`}
                            aria-pressed={sel}
                          >
                            {label}
                            {sel && <Check />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.hintNote}>
                    <b>Paga normal</b> {fmtEur(hintSueldo.pagaNormal)} · {' '}
                    <b>Base SS/mes</b> {fmtEur(hintSueldo.baseSS)} · {' '}
                    <b>IRPF/mes</b> {fmtEur(hintSueldo.irpfMes)} · {' '}
                    SS {ssDef.contingenciasComunes.trabajador.toFixed(2)}% + {' '}
                    Desempleo {ssDef.desempleo.trabajador.toFixed(2)}% + {' '}
                    FP {ssDef.formacionProfesional.trabajador.toFixed(2)}% + {' '}
                    MEI {ssDef.mei.trabajador.toFixed(2)}%
                  </div>
                </div>
              </section>

              {/* BLOQUE 3 · Variables y bonus */}
              <section className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>
                    Variables y bonus
                    {variables.length > 0 && (
                      <span className={styles.count}>· {variables.length} configurad{variables.length === 1 ? 'a' : 'as'}</span>
                    )}
                  </div>
                </div>
                <div className={styles.blockBody}>
                  <div className={styles.rowList}>
                    {variables.map((v) => {
                      const calcVar = v.tipo === 'porcentaje'
                        ? (parseNum(brutoRaw) * parseNum(v.valorRaw)) / 100
                        : parseNum(v.valorRaw);
                      return (
                        <div key={v.id} className={styles.rowItem}>
                          <input
                            className={styles.input}
                            value={v.nombre}
                            onChange={(e) => updateVariable(v.id, { nombre: e.target.value })}
                            aria-label="Concepto"
                          />
                          <select
                            className={styles.select}
                            value={v.tipo}
                            onChange={(e) => updateVariable(v.id, { tipo: e.target.value as FormVariable['tipo'] })}
                            aria-label="Tipo"
                          >
                            <option value="porcentaje">% bruto</option>
                            <option value="importe">Importe fijo</option>
                          </select>
                          <div className={styles.inputSuffix}>
                            <input
                              className={`${styles.input} ${styles.inputMono}`}
                              value={v.valorRaw}
                              onChange={(e) => updateVariable(v.id, { valorRaw: e.target.value })}
                              inputMode="decimal"
                              aria-label="Valor"
                            />
                            <span className={styles.suffix}>{v.tipo === 'porcentaje' ? '%' : '€'}</span>
                          </div>
                          <div className={styles.calc}>= {fmtEur(calcVar)}</div>
                          <select
                            className={styles.select}
                            value={v.mes}
                            onChange={(e) => updateVariable(v.id, { mes: Number(e.target.value) })}
                            aria-label="Mes de cobro"
                          >
                            {MESES_LARGO.map((m, i) => (
                              <option key={i} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={styles.del}
                            onClick={() => deleteVariable(v.id)}
                            aria-label="Eliminar variable"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" className={styles.rowAdd} onClick={addVariable}>
                      <Plus size={14} /> Añadir variable / bonus
                    </button>
                  </div>
                </div>
              </section>

              {/* BLOQUE 4 · Plan de pensiones */}
              <section className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Plan de pensiones</div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${planActivo ? styles.on : ''}`}
                    onClick={() => { setPlanActivo((p) => !p); markTouched(); }}
                    aria-label="Activar plan de pensiones"
                    aria-pressed={planActivo}
                  />
                </div>
                {planActivo && (
                  <div className={styles.blockBody}>
                    <div className={`${styles.fieldsRow} ${styles.rowPlan}`}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="np-plan">Plan vinculado</label>
                        <select
                          id="np-plan"
                          className={styles.select}
                          value={planVinculadoId}
                          onChange={(e) => { setPlanVinculadoId(e.target.value); markTouched(); }}
                        >
                          <option value="" disabled>Selecciona plan…</option>
                          {planes.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre} · {p.gestoraActual}</option>
                          ))}
                          <option value="__nuevo__">+ Vincular plan nuevo</option>
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="np-pp-tuya">Tu aportación / mes</label>
                        <div className={styles.inputSuffix}>
                          <input
                            id="np-pp-tuya"
                            className={`${styles.input} ${styles.inputMono}`}
                            value={planAportTuya}
                            onChange={(e) => { setPlanAportTuya(e.target.value); markTouched(); }}
                            inputMode="decimal"
                          />
                          <span className={styles.suffix}>€</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor="np-pp-emp">Empresa / mes</label>
                        <div className={styles.inputSuffix}>
                          <input
                            id="np-pp-emp"
                            className={`${styles.input} ${styles.inputMono}`}
                            value={planAportEmpresa}
                            onChange={(e) => { setPlanAportEmpresa(e.target.value); markTouched(); }}
                            inputMode="decimal"
                          />
                          <span className={styles.suffix}>€</span>
                        </div>
                      </div>
                    </div>
                    {planHint && (
                      <div className={styles.hintNote}>
                        Total anual al plan · <b>{fmtEur(planHint.total)}</b>{' '}
                        ({fmtEur(planHint.tuyaTotal)} tuyos + {fmtEur(planHint.empresaTotal)} empresa)
                        {planHint.limiteEur != null && (
                          <> · dentro del límite {fmtEur(planHint.limiteEur, 0)} {planHint.tipoLabel}</>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* BLOQUE 5 · Beneficios en especie */}
              <section className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>
                    Beneficios en especie
                    {especieActivo && especies.length > 0 && (
                      <span className={styles.count}>
                        · {especies.length} configurado{especies.length === 1 ? '' : 's'} ·{' '}
                        {fmtEur(especies.reduce((a, e) => a + parseNum(e.importeRaw), 0))}/mes
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${especieActivo ? styles.on : ''}`}
                    onClick={() => { setEspecieActivo((p) => !p); markTouched(); }}
                    aria-label="Activar beneficios en especie"
                    aria-pressed={especieActivo}
                  />
                </div>
                {especieActivo && (
                  <div className={styles.blockBody}>
                    <div className={styles.chips}>
                      {ESPECIE_CATALOGO.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={styles.chip}
                          onClick={() => addEspecie(cat)}
                        >
                          + {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className={styles.rowList}>
                      {especies.map((e) => (
                        <div key={e.id} className={styles.specieRow}>
                          <input
                            className={styles.input}
                            value={e.concepto}
                            onChange={(ev) => updateEspecie(e.id, { concepto: ev.target.value })}
                            aria-label="Concepto"
                          />
                          <div className={styles.inputSuffix}>
                            <input
                              className={`${styles.input} ${styles.inputMono}`}
                              value={e.importeRaw}
                              onChange={(ev) => updateEspecie(e.id, { importeRaw: ev.target.value })}
                              inputMode="decimal"
                              aria-label="Importe mensual"
                            />
                            <span className={styles.suffix}>€</span>
                          </div>
                          <select
                            className={styles.select}
                            value={e.sumaIRPF ? 'suma' : 'exento'}
                            onChange={(ev) => updateEspecie(e.id, { sumaIRPF: ev.target.value === 'suma' })}
                            aria-label="Tributación"
                          >
                            <option value="exento">Exento IRPF</option>
                            <option value="suma">Suma IRPF</option>
                          </select>
                          <button
                            type="button"
                            className={styles.del}
                            onClick={() => deleteEspecie(e.id)}
                            aria-label="Eliminar beneficio"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.hintNote}>
                      La especie suma a tu base IRPF cuando lo marcas, pero <b>NO llega a tu cuenta</b>.
                    </div>
                  </div>
                )}
              </section>

              {/* BLOQUE 6 · Solo en edit · Cómo registramos el cambio */}
              {isEditing && (
                <section className={styles.block}>
                  <div className={styles.blockHd}>
                    <div className={styles.blockHdTitle}>¿Cómo registramos este cambio?</div>
                  </div>
                  <div className={styles.blockBody}>
                    <div className={styles.radioGroup}>
                      <button
                        type="button"
                        className={`${styles.radioCard} ${modoEdicion === 'rectificacion' ? styles.selected : ''}`}
                        onClick={() => { setModoEdicion('rectificacion'); markTouched(); }}
                        aria-pressed={modoEdicion === 'rectificacion'}
                      >
                        <span className={styles.radioDot} aria-hidden="true" />
                        <span className={styles.radioText}>
                          <span className={styles.radioTitle}>Rectificación</span>
                          <span className={styles.radioSub}>
                            Sustituye los datos vigentes. Recalcula meses anteriores.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.radioCard} ${modoEdicion === 'cambio-desde-fecha' ? styles.selected : ''}`}
                        onClick={() => { setModoEdicion('cambio-desde-fecha'); markTouched(); }}
                        aria-pressed={modoEdicion === 'cambio-desde-fecha'}
                      >
                        <span className={styles.radioDot} aria-hidden="true" />
                        <span className={styles.radioText}>
                          <span className={styles.radioTitle}>Cambio desde fecha</span>
                          <span className={styles.radioSub}>
                            Mantiene el histórico anterior. Aplica desde la fecha indicada.
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {errorMsg && (
                <div className={styles.errorNote} role="alert">{errorMsg}</div>
              )}
            </div>

            {/* COLUMNA DERECHA · PREVIEW */}
            <div className={styles.colPreview} aria-live="polite">
              <div className={styles.previewTitle}>
                <TrendingUp />
                Vista previa · lo que llega cada mes
              </div>

              <div className={styles.previewKpiMain}>
                <div className={styles.previewKpiMainLabel}>
                  Neto anual a tu cuenta · {ssYear}
                </div>
                <div className={styles.previewKpiMainValue}>{fmtEur(calc.netoAnual)}</div>
                {planActivo && calc.ppTotalAnual > 0 && (
                  <div className={styles.previewKpiMainSub}>
                    + {fmtEur(calc.ppTotalAnual)} en plan de pensiones (tuyo + empresa)
                  </div>
                )}
              </div>

              <div className={styles.previewDesglose}>
                <div className={styles.previewDesgloseRow}>
                  <span className={styles.label}>Bruto fijo</span>
                  <span className={styles.value}>{fmtEur(calc.brutoFijoAnual)}</span>
                </div>
                <div className={styles.previewDesgloseRow}>
                  <span className={styles.label}>+ Variables / bonus</span>
                  <span className={styles.value}>{fmtEur(calc.variablesAnual)}</span>
                </div>
                <div className={styles.previewDesgloseRow}>
                  <span className={styles.label}>− IRPF retenido ({parseNum(irpfRaw).toFixed(2).replace('.', ',')}%)</span>
                  <span className={`${styles.value} ${styles.neg}`}>{fmtNeg(calc.irpfAnual)}</span>
                </div>
                <div className={styles.previewDesgloseRow}>
                  <span className={styles.label}>− SS empleado + solidaridad</span>
                  <span className={`${styles.value} ${styles.neg}`}>{fmtNeg(calc.ssAnual)}</span>
                </div>
                {planActivo && calc.ppEmpleadoAnual > 0 && (
                  <div className={styles.previewDesgloseRow}>
                    <span className={styles.label}>− Tu aportación PP</span>
                    <span className={`${styles.value} ${styles.neg}`}>{fmtNeg(calc.ppEmpleadoAnual)}</span>
                  </div>
                )}
                <div className={`${styles.previewDesgloseRow} ${styles.total}`}>
                  <span className={styles.label}>Total neto en cuenta</span>
                  <span className={styles.value}>{fmtEur(calc.netoAnual)}</span>
                </div>
              </div>

              <div className={styles.previewTitle} style={{ marginTop: 4 }}>
                <Calendar />
                Mes a mes
              </div>
              <div className={styles.previewMonths}>
                {calc.meses.map((m) => {
                  const tieneVar = m.tieneVariable;
                  const tieneExtra = m.tienePagaExtra;
                  const cls = `${styles.previewMonth} ${tieneVar ? styles.bonus : ''} ${tieneExtra && !tieneVar ? styles.extra : ''}`;
                  let tag = '';
                  if (tieneExtra && tieneVar) tag = 'Paga extra + variable';
                  else if (tieneExtra) tag = 'Paga extra';
                  else if (tieneVar) {
                    const v = variables.find((x) => x.mes === m.mes);
                    tag = v ? v.nombre : 'Variable';
                  }
                  const ppLine = planActivo && m.ppEmpleado > 0 && !tieneVar && !tieneExtra
                    ? `PP +${fmtEur(m.ppEmpleado, 2).replace(' €', '')}`
                    : null;
                  return (
                    <div key={m.mes} className={cls}>
                      <div className={styles.previewMonthName}>{MESES_CORTO[m.mes - 1]}</div>
                      <div className={styles.previewMonthValue}>{fmtEur(m.neto, 2).replace(' €', '')}</div>
                      {tag && (
                        <div className={`${styles.previewMonthTag} ${tieneExtra && !tieneVar ? styles.extra : ''}`}>
                          {tag}
                        </div>
                      )}
                      {ppLine && <div className={styles.previewMonthPp}>{ppLine}</div>}
                    </div>
                  );
                })}
              </div>

              <div className={styles.previewDesglose} style={{ marginBottom: 0 }}>
                <div className={styles.previewDesgloseRow}>
                  <span className={styles.label}>Mes normal sin variables</span>
                  <span className={styles.value}>{fmtEur(calc.netoMesNormal)}</span>
                </div>
                <div className={styles.previewDesgloseRow}>
                  <span className={styles.label}>Histórico</span>
                  <span className={`${styles.value} ${styles.previewMutedValue}`}>
                    {vigenciaInicial
                      ? `${vigenciaInicial.slice(0, 7)} · cambios sucesivos`
                      : `${vigenteDesde} · configuración inicial`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className={styles.footer}>
            <div className={styles.footerMeta}>
              {touched && (
                <>
                  <AlertCircle />
                  Cambios sin guardar · al guardar se actualizan los pagos previstos del año en Tesorería
                </>
              )}
            </div>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={handleClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleSave}
                disabled={saving}
              >
                <Check />
                {saving ? 'Guardando…' : 'Guardar nómina'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default NominaPage;
