/**
 * Bloque núcleo · persona. Reutiliza el formulario de datos personales/fiscales
 * existente (`/ajustes/perfil`).
 */
import React from 'react';
import EnlaceBloque from './EnlaceBloque';

const PersonaBloque: React.FC = () => (
  <EnlaceBloque
    kick="Bloque núcleo · quién eres"
    title="Tus datos"
    subtitle="Tu situación personal y fiscal · comunidad autónoma · estado civil · régimen. Con eso Atlas afina tu IRPF."
    ctaLabel="Abrir mis datos"
    ctaTo="/ajustes/perfil"
    note="Al guardar tus datos personales, este bloque queda completado en tu foto actual."
  />
);

export default PersonaBloque;
