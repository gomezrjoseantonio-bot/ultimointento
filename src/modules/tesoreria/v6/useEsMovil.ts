// Tesorería V6 · §4.11 · ¿estamos en móvil?
//
// La vista móvil no es la de escritorio encogida: es otra pantalla con otra
// estructura (lista agrupada por cuenta vs. carrusel + proyección). Eso no se
// resuelve con CSS, hace falta elegir qué se monta.
//
// El umbral son 760px, no 768: justo por encima del ancho de las tabletas en
// vertical, que sí tienen sitio para el escritorio.

import { useEffect, useState } from 'react';

export const ANCHO_MOVIL = 760;

function medir(): boolean {
  if (typeof window === 'undefined') return false;
  // `matchMedia` puede no existir en jsdom antiguo o en algunos entornos de
  // test; el ancho directo siempre está y sirve igual para esta decisión.
  return window.innerWidth <= ANCHO_MOVIL;
}

export function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState(medir);

  useEffect(() => {
    const alCambiar = () => setEsMovil(medir());
    window.addEventListener('resize', alCambiar);
    // Girar el teléfono cambia el ancho sin disparar `resize` en algunos
    // navegadores móviles.
    window.addEventListener('orientationchange', alCambiar);
    return () => {
      window.removeEventListener('resize', alCambiar);
      window.removeEventListener('orientationchange', alCambiar);
    };
  }, []);

  return esMovil;
}
