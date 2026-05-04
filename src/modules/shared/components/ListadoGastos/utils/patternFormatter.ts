import type { PatronRecurrente } from '../../../../types/compromisosRecurrentes';
import { expandirPatron } from '../../../../services/personal/patronCalendario';

const MESES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateShort(d: Date): string {
  const day = d.getDate();
  const mon = MESES_SHORT[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`;
}

function nextOccurrence(patron: PatronRecurrente, desde: string): string | null {
  const hasta = new Date();
  hasta.setMonth(hasta.getMonth() + 18);
  const dates = expandirPatron(patron, desde, hasta.toISOString().slice(0, 10));
  const today = new Date();
  const next = dates.find((d) => d >= today);
  return next ? formatDateShort(next) : null;
}

export interface FormattedPattern {
  primary: string;
  secondary: string | null;
}

export function formatPattern(patron: PatronRecurrente, fechaInicio: string): FormattedPattern {
  const next = nextOccurrence(patron, fechaInicio);
  const proximoStr = next ? `próximo · ${next}` : null;

  switch (patron.tipo) {
    case 'mensualDiaFijo':
      return { primary: `Mensual · día ${patron.dia}`, secondary: proximoStr };
    case 'mensualDiaRelativo': {
      const labels: Record<string, string> = {
        ultimoHabil: 'último hábil',
        primerHabil: 'primer hábil',
        primerLunes: 'primer lunes',
        segundoLunes: 'segundo lunes',
        tercerLunes: 'tercer lunes',
        ultimoLunes: 'último lunes',
        ultimoViernes: 'último viernes',
        primerViernes: 'primer viernes',
      };
      return { primary: `Mensual · ${labels[patron.referencia] ?? patron.referencia}`, secondary: proximoStr };
    }
    case 'cadaNMeses': {
      const mesAnclaLabel = MESES_SHORT[patron.mesAncla - 1] ?? '';
      return { primary: `Cada ${patron.cadaNMeses} meses · día ${patron.dia}`, secondary: proximoStr ?? mesAnclaLabel };
    }
    case 'anualMesesConcretos': {
      const mesesStr = patron.mesesPago.map((m) => MESES_SHORT[m - 1] ?? '').join(' + ');
      return { primary: `Anual · ${mesesStr}`, secondary: proximoStr };
    }
    case 'trimestralFiscal':
      return { primary: `Trimestral fiscal · día ${patron.diaPago}`, secondary: proximoStr };
    case 'pagasExtra':
      return { primary: 'Pagas extra', secondary: proximoStr };
    case 'variablePorMes':
      return { primary: 'Variable por mes', secondary: proximoStr };
    case 'puntual':
      return { primary: `Puntual · ${formatDateShort(new Date(patron.fecha))}`, secondary: null };
    default:
      return { primary: 'Patrón desconocido', secondary: null };
  }
}
