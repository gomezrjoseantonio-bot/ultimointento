/**
 * Bloque núcleo · cuentas. Reutiliza la gestión de cuentas existente (con su
 * saldo de hoy). El bug `openingBalance` se corrige en `fondosService` (C4).
 */
import React from 'react';
import EnlaceBloque from './EnlaceBloque';

const CuentasBloque: React.FC = () => (
  <EnlaceBloque
    kick="Bloque núcleo · tus cuentas"
    title="Tus cuentas"
    subtitle="Da de alta tus cuentas con el saldo de hoy. Es el punto de partida de tu caja prevista."
    ctaLabel="Gestionar mis cuentas"
    ctaTo="/tesoreria"
    note="Empieza por tus 2-3 cuentas principales · el resto puedes añadirlo cuando quieras."
  />
);

export default CuentasBloque;
