// Panel · AutoFitHeight · garantiza que el contenido cabe en la altura
// disponible SIN scroll (requisito duro del Panel).
//
// Mide la altura natural del contenido y, si excede la del contenedor, aplica
// `transform: scale()` compensando el ancho (100/escala %) para que el
// contenido siga ocupando todo el ancho visible. Con escala 1 no toca nada.
//
// Red de seguridad: por debajo de MIN_SCALE (pantallas extremadamente bajas)
// el texto sería ilegible · se fija la escala mínima y se permite scroll
// vertical como degradación controlada.

import React, { useLayoutEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.5;
/** Cambios de escala menores a esto se ignoran · evita bucles de re-medición. */
const EPSILON = 0.005;

const AutoFitHeight: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

    // jsdom (tests) no implementa ResizeObserver · con la medición inicial basta.
    if (typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    ro.observe(outer);
    ro.observe(inner);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const escalado = scale < 1;
  return (
    <div
      ref={outerRef}
      style={{
        height: '100%',
        // Sin scroll SIEMPRE · salvo la degradación extrema en la escala mínima.
        overflow: scale <= MIN_SCALE ? 'hidden auto' : 'hidden',
      }}
    >
      <div
        ref={innerRef}
        style={
          escalado
            ? {
                width: `${100 / scale}%`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};

export default AutoFitHeight;
