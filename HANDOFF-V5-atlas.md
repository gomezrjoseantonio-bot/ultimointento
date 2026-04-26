# HANDOFF V5 · ATLAS · post-TAREA 7

> Fecha: 2026-04-26  
> Versión DB: 64  
> Stores activos: 39

## Estado del proyecto

ATLAS ha completado la limpieza estructural del modelo de datos (TAREA 7). El modelo se redujo de 59 a 39 stores eliminando duplicados, fósiles y conceptos mal modelados. La fuente de verdad documental para la arquitectura post-limpieza es `docs/STORES-V60-ACTIVOS.md`.

## Tareas cerradas

- TAREA 1 · refactor inicial de schemas y campos de absorción.
- TAREA 2 · renombre `nominas` → `ingresos` y discriminador de tipos.
- TAREA 3 · eliminación de stores legacy principales.
- TAREA 4 · fusión de ingresos, arrastres, documentos, liquidaciones y matching.
- TAREA 5 · eliminación de logs/reconciliaciones obsoletas.
- TAREA 6 · adaptación de consumidores a los stores supervivientes.
- TAREA 7 · limpieza de código huérfano y cierre V60.
- TAREA 7-bis · auditoría profunda de los 39 stores supervivientes.
- TAREA 7 sub-tarea 8 · documentación final V60 y cierre formal.

## Tareas en backlog

- TAREA 8 · refactor schemas restantes: cache derivada de `accounts.balance`, activación plena de `contracts.historicoRentas[]` y ajustes similares.
- TAREA 9 · bootstrap de `compromisosRecurrentes` desde histórico.
- TAREA 10 · adaptación de consumidores legacy pendientes.
- TAREA 11 · UI de wipe + reimport.
- TAREA 12 · mapeo component→data sobre arquitectura limpia, especialmente Mi Plan v3.
- TAREA 13 · módulo de planes de pensiones.
- TAREA 14 · configuración fiscal en sitio único.
- TAREA 15 · saneamiento de `keyval`.
- TAREA 16 · verificación de `movementLearningRules`.

## Problemas conocidos · arquitectura

1. **TAREA 13 · Planes de pensiones:** `inversiones` y `planesPensionInversion` duplican concepto según vía de entrada; `traspasosPlanes` debe alinearse con el modelo final.
2. **TAREA 14 · Configuración fiscal:** datos fiscales del titular dispersos entre `personalData`, `personalModuleConfig`, `viviendaHabitual`, `escenarios` y `ejerciciosFiscalesCoord`.
3. **TAREA 15 · `keyval`:** contiene planes de pago, flags/proyecciones y configs; debe quedar solo para configuraciones documentadas.
4. **TAREA 16 · `movementLearningRules`:** pendiente verificar uso real de `history[]` y flujos de escritura tras absorber `learningLogs`.

## Próximos pasos sugeridos

1. TAREA 8 si Jose quiere continuar con refactor inmediato.
2. TAREA 13 si Jose quiere atacar el módulo de planes de pensiones, que bloquea una importación XML AEAT limpia para ese concepto.
3. TAREA 12 si Jose quiere retomar Mi Plan landing sobre arquitectura limpia.

## Referencias

- `docs/STORES-V60-ACTIVOS.md` · documentación de referencia de los 39 stores activos.
- `docs/AUDIT-39-stores-V60.md` · auditoría TAREA 7-bis, referencia histórica.
- `docs/audit-inputs/HANDOFF-V4-atlas.md` · handoff anterior.
- `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` · guía de diseño UI.
