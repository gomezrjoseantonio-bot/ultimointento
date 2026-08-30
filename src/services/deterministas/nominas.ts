// Nómina · el único caso que se reconoce SIN comprobar el importe. Y por qué.
//
// De `salarioBrutoAnual / distribucion.meses` no sale lo que entra en la cuenta:
// falta la cotización a la Seguridad Social y la retención real de ESE mes, que
// se regulariza a lo largo del año. Cualquier cifra que dedujéramos sería una
// estimación, y esta fase no estima.
//
// Pero el usuario ya escribió el dato que SÍ identifica la línea sin aritmética:
// `NominaCuentaCobro.conceptoBancario` («NOMINA ORANGE ESPAÑA SAU»), su IBAN y
// el día de abono. Con eso se sabe QUÉ es la línea; el importe lo pone el banco,
// que no estima: paga. Se acepta como verdad consumada.
//
// Sin `conceptoBancario` guardado no se reconoce nada. Adivinar por el texto
// («pone NOMINA, será la suya») es justo la aproximación que esta fase prohíbe:
// una transferencia con la palabra nómina de la empresa de otra persona entraría
// igual.

import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';
import { normalizarTexto, contieneConcepto } from './texto';

/** Lo que se lee de `ingresos` · el store está tipado `unknown` en `db.ts`. */
interface NominaLeida {
  id?: number;
  tipo?: string;
  nombre?: string;
  cuentaCobro?: {
    iban?: string;
    diaAbono?: number | 'ultimoHabil';
    conceptoBancario?: string;
  };
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

  for (const m of movimientos) {
    if (m.id == null) continue;
    // Una nómina ENTRA en la cuenta. Un cargo con el mismo texto no lo es
    // (una devolución, un embargo) y no puede reconocerse como cobro.
    if (m.amount <= 0) continue;

    const texto = normalizarTexto(m.description);
    const candidatos: OrigenDeterminista[] = [];

    for (const n of nominas) {
      const concepto = n.cuentaCobro?.conceptoBancario?.trim();
      if (!concepto) continue;
      if (!contieneConcepto(texto, concepto)) continue;

      candidatos.push({
        movementId: m.id,
        fuente: 'nomina',
        origenId: String(n.id ?? ''),
        titulo: `Nómina · ${n.nombre?.trim() || concepto}`,
        como: 'concepto_cuenta_dia',
      });
    }

    if (candidatos.length === 1) out.push(candidatos[0]);
  }

  return out;
}
