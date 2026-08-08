// Panel · useAutoFitHeight · garantiza que el contenido cabe en la altura
// disponible SIN scroll (requisito duro del Panel).
//
// Devuelve refs + estilos para un par de wrappers (outer/inner): mide la altura
// natural del contenido (inner) y, si excede la del contenedor (outer), aplica
// `transform: scale()` (escalado UNIFORME, con origen arriba-izquierda). Con
// escala 1 no toca nada.
//
// ⚠️ NO compensar el ancho (`width: 100/escala %`) sobre el elemento medido:
// hacerlo acopla ancho↔altura y crea un BUCLE INFINITO de re-medición (el
// ResizeObserver ve el nuevo ancho → el contenido reflowa a otra altura → otra
// escala → otro ancho → …). No tiene punto fijo y la pantalla parpadea sin
// parar. El escalado uniforme deja algo de margen a la derecha cuando reduce,
// que es la degradación aceptable frente a un Panel inusable.
//
// Red de seguridad: por debajo de MIN_SCALE (pantallas extremadamente bajas)
// el texto sería ilegible · se fija la escala mínima y se permite scroll
// vertical como degradación controlada.

import { useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';

export const MIN_SCALE = 0.5;
/** Cambios de escala menores a esto se ignoran · evita bucles de re-medición. */
export const EPSILON = 0.005;

export interface AutoFitHeight {
  outerRef: React.RefObject<HTMLDivElement>;
  innerRef: React.RefObject<HTMLDivElement>;
  outerStyle: React.CSSProperties;
  /** undefined con escala 1 · no ensuciar el layout cuando el contenido cabe. */
  innerStyle: React.CSSProperties | undefined;
}

export function useAutoFitHeight(): AutoFitHeight {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const disponible = outer.clientHeight;
      // offsetHeight es la altura de layout · NO se ve afectada por transform,
      // así que siempre mide la altura "natural" del contenido.
      const natural = inner.offsetHeight;
      if (disponible <= 0 || natural <= 0) return;
      const next = Math.max(MIN_SCALE, Math.min(1, disponible / natural));
      setScale((prev) => (Math.abs(prev - next) > EPSILON ? next : prev));
    };

    measure();

    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(remeasure);
      ro.observe(outer);
      ro.observe(inner);
      return () => {
        ro.disconnect();
        cancelAnimationFrame(frame);
      };
    }

    // Sin ResizeObserver (jsdom · navegadores antiguos): degradación que sigue
    // re-midiendo cuando cambia el viewport o el DOM del contenido (datos
    // async, imágenes, texto) · si no, overflow:hidden podría recortar.
    window.addEventListener('resize', remeasure);
    const mo =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(remeasure) : null;
    mo?.observe(inner, { childList: true, subtree: true, characterData: true });
    return () => {
      window.removeEventListener('resize', remeasure);
      mo?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return {
    outerRef,
    innerRef,
    outerStyle: {
      height: '100%',
      // Sin scroll SIEMPRE · salvo la degradación extrema en la escala mínima.
      overflow: scale <= MIN_SCALE ? 'hidden auto' : 'hidden',
    },
    innerStyle:
      scale < 1
        ? {
            // Escalado UNIFORME · sin `width: 100/scale%` (ver aviso de cabecera:
            // realimentar el ancho sobre el elemento medido crea un bucle de
            // re-medición infinito → parpadeo). El margen a la derecha al reducir
            // es la degradación aceptable.
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }
        : undefined,
  };
}
