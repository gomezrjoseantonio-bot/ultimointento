// Panel · helpers de formato compartidos por los componentes de sección.
// Números siempre en es-ES · el consumidor aplica la clase `.mono` (JetBrains Mono).

/** Importe en euros, 0 decimales. `showSign` fuerza el signo (deltas y salidas). */
export const fmtEur = (n: number, showSign = false): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: showSign ? 'exceptZero' : 'auto',
    useGrouping: true,
  }).format(n);

/** Meses con un decimal · ej 11,9. */
export const fmtMeses = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
