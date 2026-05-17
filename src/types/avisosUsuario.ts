// Tipos · store `avisosUsuario` (V73 · PR 3).
// T-INVERSIONES-DETALLE-PP-v1 · §4.E + §9.
//
// Patrón Jose · TODOS los avisos cerrables con X · persistencia aquí ·
// restaurables desde Ajustes → Avisos.

export interface AvisoCerrado {
  /**
   * Clave única del aviso · estable a lo largo del tiempo.
   * Cataloguado en spec §9.1 · ejemplos · `benchmark-orange-loss` ·
   * `coste-ppe-info` · `hitos-info` · `cerradas-histo` · etc.
   */
  avisoId: string;
  /** ISO 8601 · cuándo se cerró. */
  fechaCierre: string;
  /**
   * Ruta del navegador donde el usuario cerró el aviso · útil para mostrar
   * en Ajustes → Avisos y para restaurarlo en contexto.
   */
  ubicacionContexto?: string;
  /**
   * Etiqueta legible · sólo informativa para Ajustes → Avisos. La fuente
   * de verdad del copy del aviso vive en el componente que lo renderiza ·
   * aquí guardamos sólo lo que viste para reconocerlo.
   */
  etiqueta?: string;
}
