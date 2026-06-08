// FIX P5 · reconocedor de formato de fichero de contratos por CABECERA.
//
// Antepone los validadores de header ya existentes (validateRentilaHeader /
// validateAtlasTemplateHeader) para identificar SOLO el formato sin que el
// usuario tenga que declararlo. NO cambia los parsers internos: si el header
// encaja, delega en el parser correspondiente; si no encaja ninguno, devuelve
// `desconocido` con un mensaje de incidencia (no lanza · no bloquea el lote).
import * as XLSX from 'xlsx';
import {
  parseRentilaXlsx, RentilaRow, validateRentilaHeader,
} from './rentilaParserService';
import {
  parseAtlasTemplateXlsx, AtlasTemplateRow, validateAtlasTemplateHeader,
} from './atlasTemplateParserService';

export type FormatoContrato = 'rentila' | 'plantilla_atlas' | 'desconocido';

export interface FicheroDetectado {
  file: File;
  formato: FormatoContrato;
  rentilaRows?: RentilaRow[];
  atlasRows?: AtlasTemplateRow[];
  /** Nº de contratos detectados (0 si desconocido). */
  contratos: number;
  /** Mensaje de incidencia cuando el formato no se reconoce. */
  error?: string;
}

const leerCabecera = async (file: File): Promise<unknown[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  return matrix[0] ?? [];
};

const encaja = (validar: (header: unknown[]) => void, header: unknown[]): boolean => {
  try {
    validar(header);
    return true;
  } catch {
    return false;
  }
};

/**
 * Detecta el formato de UN fichero por su cabecera y, si encaja, lo parsea con
 * el parser correspondiente. Nunca lanza: un fichero no reconocido devuelve
 * `formato: 'desconocido'` con `error` para pintarlo como incidencia.
 */
export const detectarYParsearContrato = async (file: File): Promise<FicheroDetectado> => {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    return { file, formato: 'desconocido', contratos: 0, error: 'Formato no válido · usa .xlsx o .xls' };
  }

  let header: unknown[];
  try {
    header = await leerCabecera(file);
  } catch {
    return { file, formato: 'desconocido', contratos: 0, error: 'No se pudo leer el Excel' };
  }

  if (encaja(validateRentilaHeader, header)) {
    try {
      const rentilaRows = await parseRentilaXlsx(file);
      return { file, formato: 'rentila', rentilaRows, contratos: rentilaRows.length };
    } catch (e) {
      return { file, formato: 'desconocido', contratos: 0, error: e instanceof Error ? e.message : 'No se pudo leer el Excel' };
    }
  }

  if (encaja(validateAtlasTemplateHeader, header)) {
    try {
      const atlasRows = await parseAtlasTemplateXlsx(file);
      return { file, formato: 'plantilla_atlas', atlasRows, contratos: atlasRows.length };
    } catch (e) {
      return { file, formato: 'desconocido', contratos: 0, error: e instanceof Error ? e.message : 'No se pudo leer el Excel' };
    }
  }

  return {
    file,
    formato: 'desconocido',
    contratos: 0,
    error: 'Formato no reconocido · descarga la plantilla ATLAS y pasa tus contratos a sus columnas',
  };
};
