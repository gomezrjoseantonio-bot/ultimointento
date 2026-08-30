// ============================================================================
// El montón de la derecha · lo que ya está resuelto, resumido
// ============================================================================
//
// La columna derecha del mockup no lista 78 líneas: enseña CINCO filas («3
// cuotas de préstamo», «Nómina · Orange Espagne»…) y un «ver las 78». Eso no es
// una decisión estética, es la diferencia entre una pantalla que se lee de un
// vistazo y un extracto bancario reimpreso.
//
// Agrupar por el texto del banco no serviría: el banco escribe el número de
// recibo, el CUPS y la fecha de cargo dentro del concepto, así que dos cuotas
// del mismo préstamo llegan con textos distintos y saldrían como dos grupos de
// uno. Se agrupa por lo que ATLAS SÍ sabe que es —la descripción de la previsión
// con la que casó—, normalizada para que «Cuota préstamo 3/240» y «Cuota
// préstamo 4/240» caigan juntas.
// ============================================================================

import type { LineaExtracto } from '../extractoSesion';

export interface GrupoResuelto {
  /** Clave de agrupación · estable, no se enseña. */
  clave: string;
  /** Lo que lee el usuario · el nombre de la primera línea del grupo. */
  titulo: string;
  /** El detalle en pequeño · de qué se compone, hasta tres ejemplos. */
  detalle: string;
  cuantas: number;
  total: number;
}

/**
 * La clave de agrupación · el nombre sin lo que cambia en cada recibo.
 *
 * Se quitan los números (importes, cuotas «3/240», números de recibo, años) y la
 * puntuación, y se colapsa el espacio. Lo que queda es el nombre de la cosa.
 * Deliberadamente tosco: agrupar de más junta dos gastos parecidos en una fila
 * que el usuario puede abrir; agrupar de menos le devuelve el extracto entero.
 */
export function claveDeGrupo(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[0-9]+([.,/-][0-9]+)*/g, ' ')
    .replace(/[^a-záéíóúüñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cómo se llama esta línea resuelta · lo que casó manda sobre el churro. */
export function nombreDeLineaResuelta(l: LineaExtracto): string {
  return l.previsto?.descripcion || l.confirmado?.descripcion || l.textoBanco;
}

/**
 * Agrupa las resueltas para la columna derecha.
 *
 * Orden: primero los grupos con más líneas, y a igualdad el de más dinero en
 * valor absoluto. Lo que más se repite y lo que más pesa es lo que el usuario
 * quiere ver sin desplegar.
 */
export function agruparResueltas(lineas: LineaExtracto[]): GrupoResuelto[] {
  const porClave = new Map<string, LineaExtracto[]>();

  for (const l of lineas) {
    const nombre = nombreDeLineaResuelta(l);
    const clave = claveDeGrupo(nombre) || nombre.toLowerCase();
    const ya = porClave.get(clave);
    if (ya) ya.push(l);
    else porClave.set(clave, [l]);
  }

  const grupos: GrupoResuelto[] = [];
  for (const [clave, delGrupo] of Array.from(porClave.entries())) {
    const nombres = delGrupo.map(nombreDeLineaResuelta);
    const total = delGrupo.reduce((a, l) => a + l.importe, 0);
    grupos.push({
      clave,
      titulo: nombres[0],
      // Con una sola línea el detalle repetiría el título · mejor la fecha.
      detalle:
        delGrupo.length === 1
          ? delGrupo[0].fecha
          : Array.from(new Set(nombres)).slice(0, 3).join(' · '),
      cuantas: delGrupo.length,
      total,
    });
  }

  grupos.sort((a, b) => b.cuantas - a.cuantas || Math.abs(b.total) - Math.abs(a.total));
  return grupos;
}
