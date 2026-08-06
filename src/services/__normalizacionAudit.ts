// Comparadores compartidos por las utilidades de diagnóstico (`__*Audit`).
//
// Prefijo `__` indica herramienta de desarrollo · NO importar desde código de
// producción.
//
// Viven aparte porque los usan dos módulos que NO deben conocerse entre sí
// (`__buscarApunteAudit` importa a `__lineasFiscalesAudit`, así que la vuelta
// sería un ciclo). Copiarlos en los dos sitios acabaría con dos criterios de
// comparación divergentes, que es exactamente la clase de fallo que estas
// herramientas existen para encontrar.

/**
 * Texto comparable: sin acentos, sin mayúsculas, sin dobles espacios.
 *
 * Se normaliza para BUSCAR y para AGRUPAR, no para mostrar: lo que se enseña es
 * siempre el texto tal cual lo escribió el usuario o el banco, que es lo que él
 * va a reconocer en la pantalla.
 *
 * El rango de diacríticos va en escapes y no con los caracteres literales: son
 * marcas combinantes invisibles que no sobreviven a un copia-pega, y estas
 * utilidades viajan por chats hasta la consola de otro navegador.
 */
export function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Importe en céntimos y en valor absoluto · para comparar sin sustos de coma flotante. */
export function céntimos(n: number): number {
  return Math.round(Math.abs(n ?? 0) * 100);
}
