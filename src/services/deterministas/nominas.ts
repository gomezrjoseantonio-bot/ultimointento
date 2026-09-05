// Nómina · el único caso que se reconoce SIN comprobar el importe. Y por qué.
//
// De `salarioBrutoAnual / distribucion.meses` no sale lo que entra en la cuenta:
// falta la cotización a la Seguridad Social y la retención real de ESE mes, que
// se regulariza a lo largo del año. Cualquier cifra que dedujéramos sería una
// estimación, y esta fase no estima. Y el neto de 2025 no es el de 2026: por
// importe, las 19 nóminas del histórico no casarían nunca.
//
// Lo que SÍ identifica la línea sin aritmética, por orden:
//
//   1 · `conceptoBancario` («NOMINA ORANGE ESPAÑA SAU»): el usuario escribió lo
//       que pone el banco. Todas sus palabras dentro del texto y ya está.
//       Vive en `cuentaCobroIBAN` (el nombre del tipo, `Nomina`) · hasta E2.4
//       aquí se leía `cuentaCobro`, un campo que ningún alta escribe, así que
//       esta vía no reconocía nada. Se leen los dos nombres.
//   2 · E2.4 · la EMPRESA (`empresa.nombre`, o el `nombre` de la nómina sin
//       las palabras genéricas) dentro del texto, Y el abono entra en la
//       cuenta que la nómina dice (`cuentaAbono`). «Orange Espagne» en una
//       transferencia que entra en la cuenta de la nómina de Orange es la
//       nómina de Orange. El «IBAN destino» del encargo es eso: la cuenta.
//
// Sin ninguna de las dos no se reconoce nada. «Pone NOMINA, será la suya» sigue
// prohibido: una transferencia con esa palabra de la empresa de otra persona
// entraría igual.

import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';
import { normalizarTexto, contieneConcepto } from './texto';

/** Lo que se lee de `ingresos` · el store está tipado `unknown` en `db.ts`. */
interface CuentaCobroLeida {
  iban?: string;
  diaAbono?: number | 'ultimoHabil';
  conceptoBancario?: string;
}

export interface NominaLeida {
  id?: number;
  tipo?: string;
  nombre?: string;
  activa?: boolean;
  cuentaAbono?: number;
  empresa?: { nombre?: string };
  /** El nombre del tipo `Nomina` · el que escribe el alta. */
  cuentaCobroIBAN?: CuentaCobroLeida;
  /** El nombre con el que se leía hasta E2.4 · se conserva por si algún dato lo trae. */
  cuentaCobro?: CuentaCobroLeida;
}

/** Palabras que no dicen de QUÉ empresa es · «Nómina Orange» → «Orange». */
const GENERICAS = new Set(['NOMINA', 'NOMINAS', 'SUELDO', 'SALARIO', 'PAGA', 'MENSUAL']);

/** El concepto bancario guardado, se llame como se llame el campo. */
export function conceptoBancarioDe(n: NominaLeida): string | undefined {
  const c = (n.cuentaCobroIBAN?.conceptoBancario ?? n.cuentaCobro?.conceptoBancario)?.trim();
  return c || undefined;
}

/** Lo que identifica a la empresa · `empresa.nombre`, o el nombre sin genéricas. */
export function empresaDe(n: NominaLeida): string | undefined {
  const empresa = n.empresa?.nombre?.trim();
  if (empresa) return empresa;
  const propio = normalizarTexto(n.nombre)
    .split(' ')
    .filter((p) => p.length > 2 && !GENERICAS.has(p))
    .join(' ');
  return propio || undefined;
}

/**
 * Reconoce las líneas que son una nómina.
 *
 * `como: 'concepto_cuenta_dia'` deja constancia de que aquí no se comprobó el
 * importe. Quien lea el reconocimiento después sabe qué garantía tiene.
 */
export function nominasQueSeReconocen(
  movimientos: Movement[],
  nominas: NominaLeida[],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];
  const vivas = nominas.filter((n) => n.activa !== false && (n.tipo == null || n.tipo === 'nomina'));

  for (const m of movimientos) {
    if (m.id == null) continue;
    // Una nómina ENTRA en la cuenta. Un cargo con el mismo texto no lo es
    // (una devolución, un embargo) y no puede reconocerse como cobro.
    if (m.amount <= 0) continue;

    const texto = normalizarTexto(`${m.description ?? ''} ${m.counterparty ?? ''}`);
    const candidatos: OrigenDeterminista[] = [];

    for (const n of vivas) {
      const concepto = conceptoBancarioDe(n);
      const porConcepto = !!concepto && contieneConcepto(texto, concepto);

      const empresa = empresaDe(n);
      const porEmpresa =
        !porConcepto &&
        !!empresa &&
        n.cuentaAbono != null &&
        n.cuentaAbono === m.accountId &&
        contieneConcepto(texto, empresa);

      if (!porConcepto && !porEmpresa) continue;

      candidatos.push({
        movementId: m.id,
        fuente: 'nomina',
        origenId: String(n.id ?? ''),
        titulo: `Nómina · ${n.nombre?.trim() || concepto || empresa}`,
        como: 'concepto_cuenta_dia',
      });
    }

    if (candidatos.length === 1) out.push(candidatos[0]);
  }

  return out;
}
