// Regresión de fechas del importador Rentila · raíz del bug reportado por Jose
// (contratos que empiezan el 01/09 aparecían en agosto) + datos sucios reales de
// sus ficheros: fechas como número de serie Excel y días imposibles ("31/06").
import { toIsoDate } from '../rentilaParserService';

describe('toIsoDate · Rentila', () => {
  it('DD/MM/YYYY → ISO sin desfase de zona horaria (01/09 NO cae en agosto)', () => {
    expect(toIsoDate('01/09/2024')).toBe('2024-09-01');
    expect(toIsoDate('30/07/2024')).toBe('2024-07-30');
    expect(toIsoDate('10/11/2025')).toBe('2025-11-10');
  });

  it('acepta separadores . y -', () => {
    expect(toIsoDate('01.09.2024')).toBe('2024-09-01');
    expect(toIsoDate('01-09-2024')).toBe('2024-09-01');
  });

  it('número de serie Excel → ISO', () => {
    expect(toIsoDate(46295)).toBe('2026-09-30');
    expect(toIsoDate(45863)).toBe('2025-07-25');
  });

  it('día imposible se acota al último día real del mes (NO salta de mes)', () => {
    // "31/06/2026" (junio no tiene 31) → 30/06, no 01/07.
    expect(toIsoDate('31/06/2026')).toBe('2026-06-30');
    expect(toIsoDate('31/02/2025')).toBe('2025-02-28');
    expect(toIsoDate('30/02/2024')).toBe('2024-02-29'); // bisiesto
  });

  it('todas las salidas son fechas de calendario válidas (round-trip estable)', () => {
    for (const v of ['01/09/2024', '31/06/2026', '31/02/2025', '10/11/2025']) {
      const iso = toIsoDate(v);
      // El mes del ISO coincide con el mes formateado en UTC (no rueda).
      const mesIso = iso.slice(5, 7);
      const mesUtc = String(new Date(`${iso}T00:00:00Z`).getUTCMonth() + 1).padStart(2, '0');
      expect(mesUtc).toBe(mesIso);
    }
  });

  it('vacío o ilegible → cadena vacía', () => {
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate('   ')).toBe('');
    expect(toIsoDate('no es fecha')).toBe('');
    expect(toIsoDate('13/13/2024')).toBe(''); // mes inválido
  });

  it('ya en ISO se respeta', () => {
    expect(toIsoDate('2024-09-01')).toBe('2024-09-01');
  });
});
