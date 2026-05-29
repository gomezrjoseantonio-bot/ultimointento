/**
 * useWizardImportState.ts
 *
 * Wizard import XML V2 · § 4.3 · estado compartido entre los 10 pasos.
 *
 * Mantiene las declaraciones parseadas (una por XML · multi-ejercicio), el paso
 * actual, las opciones que se van construyendo (`OpcionesDistribucion`) y las
 * validaciones por paso. La navegación salta automáticamente los pasos que no
 * aplican según el contenido de los XMLs.
 */

import { useCallback, useMemo, useState } from 'react';
import { parseIrpfXml } from '../../../services/irpfXmlParserService';
import type { DeclaracionCompleta } from '../../../types/declaracionCompleta';
import type { OpcionesDistribucion } from '../../../types/opcionesDistribucion';
import { OPCIONES_DEFAULT } from '../../../types/opcionesDistribucion';
import type { InformeDistribucion } from '../../../types/informeDistribucion';

export interface ResultadoImportacion {
  informes: InformeDistribucion[];
  errores: string[];
}

export interface PlanLlamada {
  decl: DeclaracionCompleta;
  opciones: OpcionesDistribucion;
  esUltima: boolean;
}

/**
 * Planifica las llamadas a `distribuirDeclaracion` para multi-ejercicio:
 * orden cronológico ascendente (el reciente gana al pisar) · Fase A por año ·
 * los opt-in que crean entidades únicas (nómina/autónomo/ventas/cónyuge) solo
 * en la última llamada · IBAN y prefill de inmuebles en todas (idempotentes).
 */
export function planificarImportacion(
  declaraciones: DeclaracionCompleta[],
  opciones: OpcionesDistribucion,
): PlanLlamada[] {
  const ordenadas = [...declaraciones].sort((a, b) => a.meta.ejercicio - b.meta.ejercicio);
  return ordenadas.map((decl, i) => {
    const esUltima = i === ordenadas.length - 1;
    return {
      decl,
      esUltima,
      opciones: esUltima
        ? opciones
        : {
            ...OPCIONES_DEFAULT,
            inmueblesPrefill: opciones.inmueblesPrefill,
            ibanAcciones: opciones.ibanAcciones,
          },
    };
  });
}

export type EstadoArchivo = 'validado' | 'error';

export interface ArchivoSubido {
  id: string;
  nombre: string;
  tamanoKB: number;
  tipo: 'xml' | 'pdf' | 'otro';
  estado: EstadoArchivo;
  ejercicio?: number;
  resultado?: number;
  tipoDeclaracion?: string;
  declaracion?: DeclaracionCompleta;
  error?: string;
}

export const PASOS = [
  { num: 1, key: 'fuente', label: 'Fuente' },
  { num: 2, key: 'inmuebles', label: 'Inmuebles' },
  { num: 3, key: 'iban', label: 'IBAN' },
  { num: 4, key: 'proveedores', label: 'Prov' },
  { num: 5, key: 'pensiones', label: 'PP' },
  { num: 6, key: 'nomina', label: 'Nómina' },
  { num: 7, key: 'autonomos', label: 'Autón' },
  { num: 8, key: 'ventas', label: 'Ventas' },
  { num: 9, key: 'personales', label: 'Personal' },
  { num: 10, key: 'confirmar', label: 'OK' },
] as const;

export type PasoNum = (typeof PASOS)[number]['num'];

/** Declaración más reciente (mayor ejercicio) entre las subidas · base de sugerencias. */
function declaracionPrincipal(decls: DeclaracionCompleta[]): DeclaracionCompleta | null {
  if (decls.length === 0) return null;
  return decls.reduce((max, d) => (d.meta.ejercicio > max.meta.ejercicio ? d : max), decls[0]);
}

/** ¿Aplica cada paso según el contenido combinado de los XMLs? */
export function pasoAplica(num: PasoNum, decls: DeclaracionCompleta[]): boolean {
  if (decls.length === 0) {
    // Sin declaraciones sólo aplica el paso 1.
    return num === 1;
  }
  switch (num) {
    case 1: // Fuente
    case 9: // Personales
    case 10: // Confirmar
      return true;
    case 2: // Inmuebles
      return decls.some((d) => d.inmuebles.length > 0);
    case 3: // IBAN
      return decls.some((d) => !!d.cuentaDevolucion?.iban || !!d.cuentaIngreso?.iban);
    case 4: // Proveedores
      return decls.some((d) =>
        d.inmuebles.some(
          (inm) =>
            (inm.proveedores?.length ?? 0) > 0 ||
            inm.arrendamientos.some((arr) => (arr.proveedores?.length ?? 0) > 0) ||
            inm.mejorasEjercicio.some((m) => !!m.nifProveedor),
        ),
      );
    case 5: // Planes de pensiones
      return decls.some((d) => !!d.planPensiones);
    case 6: // Nómina · RdtoTrabajo con retribuciones > 0
      return decls.some((d) => (d.trabajo?.retribucionesDinerarias ?? 0) > 0);
    case 7: // Autónomos
      return decls.some((d) => !!d.actividadEconomica);
    case 8: // Ventas · transmisión de inmueble
      // El modelo parseado no expone hoy la transmisión a nivel de inmueble
      // (vive en gananciasPerdidas). La detección fina llega con el paso 8 real
      // (commit 6); por ahora no aplica · coincide con el mockup (paso saltado).
      return false;
    default:
      return true;
  }
}

export interface WizardImportState {
  archivos: ArchivoSubido[];
  declaraciones: DeclaracionCompleta[];
  declaracionPrincipal: DeclaracionCompleta | null;
  pasoActual: PasoNum;
  opciones: OpcionesDistribucion;
  validaciones: Record<number, boolean>;

  pasosAplicables: PasoNum[];
  estadoPaso: (num: PasoNum) => 'done' | 'active' | 'skipped' | 'pending';

  agregarArchivos: (files: FileList | File[]) => Promise<void>;
  quitarArchivo: (id: string) => void;
  setOpciones: (patch: Partial<OpcionesDistribucion>) => void;
  setValidacion: (num: PasoNum, ok: boolean) => void;
  irA: (num: PasoNum) => void;
  siguiente: () => void;
  anterior: () => void;
  puedeContinuar: boolean;
  importando: boolean;
  importar: () => Promise<ResultadoImportacion>;
}

function clasificarTipo(nombre: string): ArchivoSubido['tipo'] {
  const lower = nombre.toLowerCase();
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'otro';
}

export function useWizardImportState(): WizardImportState {
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const [pasoActual, setPasoActual] = useState<PasoNum>(1);
  const [opciones, setOpcionesState] = useState<OpcionesDistribucion>(OPCIONES_DEFAULT);
  const [validaciones, setValidaciones] = useState<Record<number, boolean>>({});
  const [importando, setImportando] = useState(false);

  const declaraciones = useMemo(
    () => archivos.filter((a) => a.estado === 'validado' && a.declaracion).map((a) => a.declaracion!),
    [archivos],
  );
  const principal = useMemo(() => declaracionPrincipal(declaraciones), [declaraciones]);

  const pasosAplicables = useMemo<PasoNum[]>(
    () => PASOS.map((p) => p.num).filter((n) => pasoAplica(n, declaraciones)) as PasoNum[],
    [declaraciones],
  );

  const agregarArchivos = useCallback(async (files: FileList | File[]) => {
    const lista = Array.from(files);
    const nuevos: ArchivoSubido[] = [];

    for (const file of lista) {
      const tipo = clasificarTipo(file.name);
      const base: ArchivoSubido = {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nombre: file.name,
        tamanoKB: Math.max(1, Math.round(file.size / 1024)),
        tipo,
        estado: 'validado',
      };

      if (tipo === 'pdf') {
        // El PDF no se parsea aquí · sólo se lista como adjunto que enriquecerá nombres.
        nuevos.push(base);
        continue;
      }
      if (tipo !== 'xml') {
        nuevos.push({ ...base, estado: 'error', error: 'Formato no soportado · sube XML AEAT o PDF' });
        continue;
      }

      try {
        const contenido = await file.text();
        const decl = parseIrpfXml(contenido);
        nuevos.push({
          ...base,
          declaracion: decl,
          ejercicio: decl.meta.ejercicio,
          resultado: decl.resultado?.resultadoDeclaracion,
          tipoDeclaracion: decl.meta.tipoDeclaracion,
        });
      } catch (err) {
        nuevos.push({
          ...base,
          estado: 'error',
          error: err instanceof Error ? err.message : 'XML no válido',
        });
      }
    }

    setArchivos((prev) => [...prev, ...nuevos]);
  }, []);

  const quitarArchivo = useCallback((id: string) => {
    setArchivos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const setOpciones = useCallback((patch: Partial<OpcionesDistribucion>) => {
    setOpcionesState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setValidacion = useCallback((num: PasoNum, ok: boolean) => {
    setValidaciones((prev) => (prev[num] === ok ? prev : { ...prev, [num]: ok }));
  }, []);

  const irA = useCallback(
    (num: PasoNum) => {
      if (pasosAplicables.includes(num)) setPasoActual(num);
    },
    [pasosAplicables],
  );

  const siguiente = useCallback(() => {
    setPasoActual((cur) => {
      const next = pasosAplicables.find((n) => n > cur);
      return (next ?? cur) as PasoNum;
    });
  }, [pasosAplicables]);

  const anterior = useCallback(() => {
    setPasoActual((cur) => {
      const prevs = pasosAplicables.filter((n) => n < cur);
      return (prevs.length ? prevs[prevs.length - 1] : cur) as PasoNum;
    });
  }, [pasosAplicables]);

  /**
   * Importa todas las declaraciones (multi-ejercicio) en orden cronológico para
   * que los datos más recientes ganen. La Fase A se ejecuta por cada año; los
   * opt-in de Fase B que crean entidades únicas (nómina, autónomo, ventas,
   * cónyuge) se aplican SOLO en la última llamada para no duplicar. Las acciones
   * de IBAN y el prefill de inmuebles se aplican en todas (idempotentes).
   */
  const importar = useCallback(async (): Promise<ResultadoImportacion> => {
    setImportando(true);
    const informes: InformeDistribucion[] = [];
    const errores: string[] = [];
    try {
      const { distribuirDeclaracion } = await import('../../../services/declaracionDistributorService');
      const plan = planificarImportacion(declaraciones, opciones);
      for (const { decl, opciones: opc } of plan) {
        try {
          const informe = await distribuirDeclaracion(decl, opc);
          informes.push(informe);
          for (const e of informe.faseB?.errores ?? []) errores.push(`${decl.meta.ejercicio}: ${e}`);
        } catch (err) {
          errores.push(`${decl.meta.ejercicio}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } finally {
      setImportando(false);
    }
    return { informes, errores };
  }, [declaraciones, opciones]);

  const estadoPaso = useCallback(
    (num: PasoNum): 'done' | 'active' | 'skipped' | 'pending' => {
      if (!pasosAplicables.includes(num)) return 'skipped';
      if (num === pasoActual) return 'active';
      if (num < pasoActual) return 'done';
      return 'pending';
    },
    [pasosAplicables, pasoActual],
  );

  // Paso 1 exige al menos un XML válido; el resto valida según su propio estado.
  const validacionPaso1 = declaraciones.length > 0;
  const puedeContinuar = useMemo(() => {
    if (pasoActual === 1) return validacionPaso1;
    return validaciones[pasoActual] ?? true;
  }, [pasoActual, validacionPaso1, validaciones]);

  return {
    archivos,
    declaraciones,
    declaracionPrincipal: principal,
    pasoActual,
    opciones,
    validaciones,
    pasosAplicables,
    estadoPaso,
    agregarArchivos,
    quitarArchivo,
    setOpciones,
    setValidacion,
    irA,
    siguiente,
    anterior,
    puedeContinuar,
    importando,
    importar,
  };
}
