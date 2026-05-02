// T27.2-skip · Feature flags del módulo Mi Plan.
//
// Centralizar aquí los toggles permite reactivar/desactivar el módulo
// completo en un único punto · evita estados incoherentes (ej · pestaña
// visible mientras la ruta sigue redirigiendo).
//
// Cuando se decida revivir Retos:
//   1. Cambiar `SHOW_RETOS` a true
//   2. Restaurar el binding del Route en `src/App.tsx` (sustituir
//      `<Navigate>` por `<MiPlanRetos />` y descomentar la lazy import)
//   3. Actualizar el test `src/tests/atlasNavigationAudit.test.ts` para
//      volver a esperar 6 sub-páginas
//   4. Restaurar el CTA del EmptyState en `RetosPage.tsx` apuntando al
//      wizard T27.x dedicado cuando se construya
//
// Los demás puntos (tabs · landing card · navigation menu · sub-text del
// page-head) se controlan automáticamente desde este flag.

export const SHOW_RETOS = false;
