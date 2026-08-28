// ============================================================================
// ATLAS Personal v1.1 · Motor de calendario (sección 2)
// ============================================================================
//
// Funciones puras que dado un `PatronRecurrente` + fecha de inicio + horizonte
// expanden las fechas en las que toca el evento. También calculan el importe
// concreto de un evento dada la fecha (importe puede variar por mes · sección
// 2.2).
//
// Reglas de oro relevantes:
//   #4 · El calendario es REAL · no plano (IBI = 250€ jun + 250€ nov · NO 41,67€/mes)
//   #5 · El importe puede variar por mes (luz 138€ ene · 71€ jun)
//   #8 · Pagas extra · variable · bonus se proyectan en el mes que tocan
// ============================================================================

import type {
  PatronRecurrente,
  ImporteEvento,
  ReferenciaDiaRelativo,
} from '../../types/compromisosRecurrentes';
import { toISODateLocal } from '../../utils/recurrenceDateUtils';

// ─── Helpers de calendario ─────────────────────────────────────────────────

const MS_DIA = 24 * 60 * 60 * 1000;

function esFinDeSemana(d: Date): boolean {
  const dow = d.getDay(); // 0=dom · 6=sab
  return dow === 0 || dow === 6;
}

function ultimoDiaDelMes(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function ultimoDiaHabilDelMes(year: number, month0: number): Date {
  let d = new Date(year, month0, ultimoDiaDelMes(year, month0));
  while (esFinDeSemana(d)) {
    d = new Date(d.getTime() - MS_DIA);
  }
  return d;
}

function primerDiaHabilDelMes(year: number, month0: number): Date {
  let d = new Date(year, month0, 1);
  while (esFinDeSemana(d)) {
    d = new Date(d.getTime() + MS_DIA);
  }
  return d;
}

function nthDiaSemanaDelMes(
  year: number,
  month0: number,
  diaSemana: number, // 0=dom · 1=lun ...
  n: number, // 1=primer · 2=segundo · -1=último
): Date {
  if (n > 0) {
    let d = new Date(year, month0, 1);
    let count = 0;
    while (d.getMonth() === month0) {
      if (d.getDay() === diaSemana) {
        count++;
        if (count === n) return d;
      }
      d = new Date(d.getTime() + MS_DIA);
    }
    return new Date(year, month0, 1);
  }
  // Último (n=-1)
  let d = new Date(year, month0, ultimoDiaDelMes(year, month0));
  while (d.getMonth() === month0) {
    if (d.getDay() === diaSemana) return d;
    d = new Date(d.getTime() - MS_DIA);
  }
  return new Date(year, month0, ultimoDiaDelMes(year, month0));
}

function fechaSegunReferencia(year: number, month0: number, ref: ReferenciaDiaRelativo): Date {
  switch (ref) {
    case 'ultimoHabil':   return ultimoDiaHabilDelMes(year, month0);
    case 'primerHabil':   return primerDiaHabilDelMes(year, month0);
    case 'primerLunes':   return nthDiaSemanaDelMes(year, month0, 1, 1);
    case 'segundoLunes':  return nthDiaSemanaDelMes(year, month0, 1, 2);
    case 'tercerLunes':   return nthDiaSemanaDelMes(year, month0, 1, 3);
    case 'ultimoLunes':   return nthDiaSemanaDelMes(year, month0, 1, -1);
    case 'primerViernes': return nthDiaSemanaDelMes(year, month0, 5, 1);
    case 'ultimoViernes': return nthDiaSemanaDelMes(year, month0, 5, -1);
  }
}

function fechaDiaFijoDelMes(year: number, month0: number, dia: number): Date {
  // Si dia > último día del mes · usa el último (febrero · día 30 → 28/29)
  const ultimo = ultimoDiaDelMes(year, month0);
  return new Date(year, month0, Math.min(dia, ultimo));
}

function parseFechaISO(iso: string): Date {
  // Acepta YYYY-MM-DD o ISO completo
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`Fecha inválida: ${iso}`);
  }
  return d;
}

function compararSoloFecha(a: Date, b: Date): number {
  const sa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const sb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return sa - sb;
}

// ─── Expansión de patrón ───────────────────────────────────────────────────

/**
 * Devuelve las fechas en las que toca el evento, entre `desde` (incluido) y
 * `hasta` (incluido).
 *
 * El parámetro `desde` representa la fecha de inicio del compromiso · si es
 * anterior al horizonte de proyección, las primeras ocurrencias se descartan.
 */
export function expandirPatron(
  patron: PatronRecurrente,
  desde: string,
  hasta: string,
): Date[] {
  const dDesde = parseFechaISO(desde);
  const dHasta = parseFechaISO(hasta);
  if (compararSoloFecha(dDesde, dHasta) > 0) return [];

  // BLINDAJE ANTI-CUELGUE · los bucles `while(true)` de abajo solo rompen cuando
  // la fecha calculada supera `dHasta`. Si un campo numérico del patrón viene
  // corrupto (p. ej. `dia`/`cadaNMeses`/`mesAncla` = NaN por una importación
  // defectuosa), `fechaDiaFijoDelMes` produce un `Invalid Date` y
  // `compararSoloFecha(NaN, dHasta)` es `NaN`, que nunca es `> 0` → el bucle
  // giraba para SIEMPRE y colgaba Presupuesto/Fiscal «in eternum». Validamos
  // ANTES de expandir: si algo no es finito lanzamos (el llamante `buildOpexPorMes`
  // lo captura y se salta ese compromiso) en vez de girar sin fin.
  const finito = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (patron.tipo === 'mensualDiaFijo' && !finito(patron.dia)) {
    throw new Error(`expandirPatron · mensualDiaFijo con dia inválido: ${patron.dia}`);
  }
  if (
    patron.tipo === 'cadaNMeses' &&
    (!finito(patron.cadaNMeses) || !finito(patron.mesAncla) || !finito(patron.dia))
  ) {
    throw new Error(
      `expandirPatron · cadaNMeses con campos inválidos (cada=${patron.cadaNMeses} ancla=${patron.mesAncla} dia=${patron.dia})`,
    );
  }

  const fechas: Date[] = [];
  // Tope de años defensivo · backstop absoluto para que ningún bucle mensual
  // pueda girar sin fin aunque se cuele un dato inesperado.
  const yTope = dHasta.getFullYear() + 2;

  switch (patron.tipo) {
    case 'puntual': {
      const f = parseFechaISO(patron.fecha);
      if (compararSoloFecha(f, dDesde) >= 0 && compararSoloFecha(f, dHasta) <= 0) {
        fechas.push(f);
      }
      break;
    }

    case 'mensualDiaFijo': {
      // Empieza en el mes de `desde` y avanza mes a mes
      let y = dDesde.getFullYear();
      let m = dDesde.getMonth();
      while (true) {
        const f = fechaDiaFijoDelMes(y, m, patron.dia);
        if (Number.isNaN(f.getTime()) || compararSoloFecha(f, dHasta) > 0) break;
        if (compararSoloFecha(f, dDesde) >= 0) fechas.push(f);
        m++;
        if (m > 11) { m = 0; y++; }
        if (y > yTope) break;
      }
      break;
    }

    case 'mensualDiaRelativo': {
      let y = dDesde.getFullYear();
      let m = dDesde.getMonth();
      while (true) {
        const f = fechaSegunReferencia(y, m, patron.referencia);
        if (Number.isNaN(f.getTime()) || compararSoloFecha(f, dHasta) > 0) break;
        if (compararSoloFecha(f, dDesde) >= 0) fechas.push(f);
        m++;
        if (m > 11) { m = 0; y++; }
        if (y > yTope) break;
      }
      break;
    }

    case 'cadaNMeses': {
      // Se proyecta a partir del mes ancla · año del `desde`
      const cada = finito(patron.cadaNMeses) ? Math.max(1, patron.cadaNMeses) : 1;
      const mesAncla0 = (patron.mesAncla - 1 + 12) % 12; // 1-indexed → 0-indexed
      let y = dDesde.getFullYear();
      // Encuentra el primer mes >= desde alineado al ancla
      let m = mesAncla0;
      while (new Date(y, m, 1).getTime() < new Date(dDesde.getFullYear(), dDesde.getMonth(), 1).getTime()) {
        m += cada;
        while (m > 11) { m -= 12; y++; }
        if (y > yTope) break;
      }
      while (true) {
        const f = fechaDiaFijoDelMes(y, m, patron.dia);
        if (Number.isNaN(f.getTime()) || compararSoloFecha(f, dHasta) > 0) break;
        if (compararSoloFecha(f, dDesde) >= 0) fechas.push(f);
        m += cada;
        while (m > 11) { m -= 12; y++; }
        if (y > yTope) break;
      }
      break;
    }

    case 'trimestralFiscal': {
      // Pago entre cierre y día patron.diaPago del mes siguiente
      // Trimestres de Hacienda · pagos en abril · julio · octubre · enero
      const mesesPago = [0, 3, 6, 9]; // ene · abr · jul · oct (0-indexed)
      let y = dDesde.getFullYear();
      while (true) {
        let alguno = false;
        for (const m0 of mesesPago) {
          const f = fechaDiaFijoDelMes(y, m0, patron.diaPago);
          if (compararSoloFecha(f, dHasta) > 0) continue;
          if (compararSoloFecha(f, dDesde) >= 0) {
            fechas.push(f);
            alguno = true;
          }
        }
        // Salir cuando el último mes del año supera dHasta
        const finAnio = fechaDiaFijoDelMes(y, 9, patron.diaPago);
        if (compararSoloFecha(finAnio, dHasta) > 0 && !alguno) break;
        y++;
        if (y > dHasta.getFullYear() + 1) break;
      }
      // Ordena por fecha
      fechas.sort((a, b) => a.getTime() - b.getTime());
      break;
    }

    case 'anualMesesConcretos': {
      let y = dDesde.getFullYear();
      while (y <= dHasta.getFullYear()) {
        for (const mes1 of patron.mesesPago) {
          const m0 = (mes1 - 1 + 12) % 12;
          // Cada mes puede cargar SU día (IBI: 15 de junio · 11 de noviembre).
          // Sin día propio manda `diaPago`, que es como se comportaba antes de
          // que `diaPagoPorMes` existiera.
          const diaDelMes = patron.diaPagoPorMes?.[mes1];
          const f = fechaDiaFijoDelMes(y, m0, finito(diaDelMes) ? diaDelMes : patron.diaPago);
          if (compararSoloFecha(f, dDesde) >= 0 && compararSoloFecha(f, dHasta) <= 0) {
            fechas.push(f);
          }
        }
        y++;
      }
      fechas.sort((a, b) => a.getTime() - b.getTime());
      break;
    }

    case 'pagasExtra': {
      let y = dDesde.getFullYear();
      while (y <= dHasta.getFullYear()) {
        for (const mes1 of patron.mesesExtra) {
          const m0 = (mes1 - 1 + 12) % 12;
          const f = fechaSegunReferencia(y, m0, patron.referencia);
          if (compararSoloFecha(f, dDesde) >= 0 && compararSoloFecha(f, dHasta) <= 0) {
            fechas.push(f);
          }
        }
        y++;
      }
      fechas.sort((a, b) => a.getTime() - b.getTime());
      break;
    }

    case 'variablePorMes': {
      let y = dDesde.getFullYear();
      while (y <= dHasta.getFullYear()) {
        for (const mes1 of patron.mesesPago) {
          const m0 = (mes1 - 1 + 12) % 12;
          // Día 5 por defecto (el mes de cobro · día concreto lo gestiona el caller)
          const f = fechaDiaFijoDelMes(y, m0, 5);
          if (compararSoloFecha(f, dDesde) >= 0 && compararSoloFecha(f, dHasta) <= 0) {
            fechas.push(f);
          }
        }
        y++;
      }
      fechas.sort((a, b) => a.getTime() - b.getTime());
      break;
    }
  }

  return fechas;
}

// ─── Cálculo de importe por evento ─────────────────────────────────────────

/**
 * Devuelve el importe absoluto correspondiente a un evento del compromiso.
 * El signo (+ ingreso · − pago) lo aplica el caller según el contexto.
 *
 * Regla #4 · NUNCA se prorratea: si el IBI son 500€ junio + nov · NO se
 * convierte a 41,67€/mes.
 */
export function calcularImporte(importe: ImporteEvento, fecha: Date): number {
  switch (importe.modo) {
    case 'fijo':
      return importe.importe;
    case 'variable':
      return importe.importeMedio;
    case 'diferenciadoPorMes': {
      // Array de 12 elementos · ene→dic
      const m = fecha.getMonth(); // 0=ene
      if (importe.importesPorMes.length !== 12) {
        throw new Error('importesPorMes debe tener 12 elementos · ene→dic');
      }
      return importe.importesPorMes[m];
    }
    case 'porPago': {
      const mes1 = fecha.getMonth() + 1; // 1-12
      const v = importe.importesPorPago[mes1];
      if (v === undefined) {
        throw new Error(`No hay importe definido para el mes ${mes1} en patrón porPago`);
      }
      return v;
    }
    case 'porTramos': {
      // El tramo aplicable es el de `desde` más reciente que sea ≤ la fecha del
      // cargo. Antes del primer tramo no hay cuota definida → 0 (no se inventa).
      const iso = toISODateLocal(fecha);
      let elegido: number | null = null;
      let mejorDesde = '';
      for (const t of importe.tramos) {
        if (t.desde <= iso && t.desde >= mejorDesde) {
          mejorDesde = t.desde;
          elegido = t.importe;
        }
      }
      return elegido ?? 0;
    }
    case 'porcentajeRenta':
      // El % se aplica sobre la renta del contrato del inmueble · contexto que
      // esta función pura NO tiene. El consumidor con acceso al contrato resuelve
      // la cifra (sección 2.6 · Fase 4). Sin renta no se proyecta importe.
      return 0;
  }
}

/**
 * Aplica la variación de importe (sección 2.3) sobre un importe base, según
 * la fecha del evento. Por ahora solo IPC anual (incremento simple) · el
 * resto retorna el base.
 */
export function aplicarVariacion(
  importeBase: number,
  variacion:
    | { tipo: 'sinVariacion' }
    | { tipo: 'ipcAnual'; mesRevision: number; ultimoIpcAplicado?: number }
    | { tipo: 'aniversarioContrato'; mesAniversario: number; porcentajeAnual: number }
    | { tipo: 'manual' }
    | undefined,
  fechaInicio: Date,
  fechaEvento: Date,
): number {
  if (!variacion || variacion.tipo === 'sinVariacion' || variacion.tipo === 'manual') {
    return importeBase;
  }
  if (variacion.tipo === 'ipcAnual') {
    // Cuenta cuántos años desde fechaInicio han cruzado el mes de revisión
    const mesRev0 = (variacion.mesRevision - 1 + 12) % 12;
    const inicioAnio = fechaInicio.getFullYear();
    const eventoAnio = fechaEvento.getFullYear();
    const eventoCruzaRevision =
      fechaEvento.getMonth() > mesRev0 ||
      (fechaEvento.getMonth() === mesRev0 && fechaEvento.getDate() >= 1);
    let revisiones = eventoAnio - inicioAnio;
    if (!eventoCruzaRevision) revisiones -= 1;
    if (revisiones <= 0) return importeBase;
    const ipc = variacion.ultimoIpcAplicado ?? 0;
    return importeBase * Math.pow(1 + ipc, revisiones);
  }
  if (variacion.tipo === 'aniversarioContrato') {
    const mesAniv0 = (variacion.mesAniversario - 1 + 12) % 12;
    const inicioAnio = fechaInicio.getFullYear();
    const eventoAnio = fechaEvento.getFullYear();
    const eventoCruza =
      fechaEvento.getMonth() > mesAniv0 ||
      (fechaEvento.getMonth() === mesAniv0 && fechaEvento.getDate() >= 1);
    let revisiones = eventoAnio - inicioAnio;
    if (!eventoCruza) revisiones -= 1;
    if (revisiones <= 0) return importeBase;
    const pct = variacion.porcentajeAnual / 100;
    return importeBase * Math.pow(1 + pct, revisiones);
  }
  return importeBase;
}
