// ============================================================================
// ATLAS Personal v1.1 · Barrel · re-exports de los servicios del modelo nuevo
// ============================================================================
//
// Importa desde aquí cuando consumas el modelo de datos nuevo:
//
//   import {
//     listarCompromisos, crearCompromiso, regenerarEventosCompromiso,
//     obtenerViviendaActiva, guardarVivienda,
//     onNominaConfirmada, procesarConfirmacionEvento,
//     expandirPatron, calcularImporte,
//   } from '@/services/personal';
//
// Para los tipos:
//   import type { CompromisoRecurrente, ViviendaHabitual } from '@/types/personal';
// ============================================================================

export * from './patronCalendario';
export * from './compromisosRecurrentesService';
export * from './viviendaHabitualService';
export * from './nominaAportacionHook';
