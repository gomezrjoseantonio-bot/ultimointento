// Hook de la operativa de "Gastos registrados" de un inmueble (Fase 8).
//
// Encapsula la carga de gastos reales, mejoras y mobiliario, los ejercicios
// fiscales bloqueados (declarado/prescrito), y el estado + handlers de editar y
// borrar. Editar/borrar pasan por el servicio de cada tipo, que ya propaga los
// cambios al treasuryEvent y al movimiento asociados (trazabilidad con
// Tesorería). No modifica stores, categoryKey ni fiscalidad.

import { useCallback, useEffect, useState } from 'react';
import { showToastV5 } from '../../../design-system/v5';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import { gastosInmuebleService } from '../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../../services/mueblesInmuebleService';
import { ejercicioFiscalService } from '../../../services/ejercicioFiscalService';
import type {
  RegistroInmuebleEditable,
  TipoRegistroInmueble,
} from '../components/EditarRegistroInmuebleModal';

export type { TipoRegistroInmueble };

export interface RegistrosInmueble {
  gastosReales: GastoInmueble[];
  mejoras: MejoraInmueble[];
  mobiliario: MuebleInmueble[];
  ejerciciosBloqueados: number[];
  registroEnEdicion: RegistroInmuebleEditable | null;
  registroEnBorrado: RegistroInmuebleEditable | null;
  /** Tipo de registro que se está dando de alta, o `null` si no hay alta abierta. */
  tipoAlta: TipoRegistroInmueble | null;
  guardando: boolean;
  borrando: boolean;
  reload: () => void;
  abrirEdicion: (registro: RegistroInmuebleEditable) => void;
  cerrarEdicion: () => void;
  abrirBorrado: (registro: RegistroInmuebleEditable) => void;
  cerrarBorrado: () => void;
  abrirAlta: (tipo: TipoRegistroInmueble) => void;
  cerrarAlta: () => void;
  guardar: (updates: Record<string, unknown>) => Promise<void>;
  crear: (updates: Record<string, unknown>) => Promise<void>;
  confirmarBorrado: () => Promise<void>;
}

export function useRegistrosInmueble(propertyId: number): RegistrosInmueble {
  const [gastosReales, setGastosReales] = useState<GastoInmueble[]>([]);
  const [mejoras, setMejoras] = useState<MejoraInmueble[]>([]);
  const [mobiliario, setMobiliario] = useState<MuebleInmueble[]>([]);
  const [ejerciciosBloqueados, setEjerciciosBloqueados] = useState<number[]>([]);
  const [registroEnEdicion, setRegistroEnEdicion] = useState<RegistroInmuebleEditable | null>(null);
  const [registroEnBorrado, setRegistroEnBorrado] = useState<RegistroInmuebleEditable | null>(null);
  const [tipoAlta, setTipoAlta] = useState<TipoRegistroInmueble | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const reload = useCallback(() => {
    void gastosInmuebleService.getByInmueble(propertyId).then(setGastosReales);
    void mejorasInmuebleService.getPorInmueble(propertyId).then(setMejoras);
    void mueblesInmuebleService.getPorInmueble(propertyId).then(setMobiliario);
  }, [propertyId]);

  useEffect(() => {
    reload();
    // Ejercicios fiscales bloqueados (declarado/prescrito) · gobiernan la operativa.
    void ejercicioFiscalService
      .getAllEjercicios()
      .then((ejercicios) =>
        setEjerciciosBloqueados(
          ejercicios
            .filter((e) => e.estado === 'declarado' || e.estado === 'prescrito')
            .map((e) => e.año ?? e.ejercicio)
            .filter((y): y is number => typeof y === 'number'),
        ),
      )
      .catch(() => setEjerciciosBloqueados([]));
  }, [reload]);

  const guardar = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!registroEnEdicion) return;
      const rid = registroEnEdicion.registro.id;
      if (rid == null) return;
      setGuardando(true);
      try {
        if (registroEnEdicion.tipo === 'real') {
          await gastosInmuebleService.update(rid, updates as Partial<GastoInmueble>);
        } else if (registroEnEdicion.tipo === 'mejora') {
          await mejorasInmuebleService.actualizar(rid, updates as Partial<MejoraInmueble>);
        } else {
          await mueblesInmuebleService.actualizar(rid, updates as Partial<MuebleInmueble>);
        }
        reload();
        setRegistroEnEdicion(null);
        showToastV5('Registro actualizado');
      } catch (err) {
        console.error('Error actualizando registro de inmueble', err);
        showToastV5('No se pudo actualizar el registro');
      } finally {
        setGuardando(false);
      }
    },
    [registroEnEdicion, reload],
  );

  // Alta directa de un gasto puntual / mejora / mobiliario ya ocurrido. Un alta
  // manual no es una previsión de Tesorería, así que se registra directamente
  // (a diferencia de editar/borrar, que sí propagan a eventos ya vinculados).
  const crear = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!tipoAlta) return;
      const ejercicio = Number(updates.ejercicio);
      if (Number.isInteger(ejercicio) && ejerciciosBloqueados.includes(ejercicio)) {
        showToastV5('No se puede añadir a un ejercicio declarado');
        return;
      }
      setGuardando(true);
      try {
        if (tipoAlta === 'real') {
          await gastosInmuebleService.add({
            inmuebleId: propertyId,
            origen: 'manual',
            estado: 'confirmado',
            ...updates,
          } as Omit<GastoInmueble, 'id' | 'createdAt' | 'updatedAt'>);
        } else if (tipoAlta === 'mejora') {
          await mejorasInmuebleService.crear({
            inmuebleId: propertyId,
            ...updates,
          } as Omit<MejoraInmueble, 'id' | 'createdAt' | 'updatedAt'>);
        } else {
          await mueblesInmuebleService.crear({
            inmuebleId: propertyId,
            activo: true,
            ...updates,
          } as Omit<MuebleInmueble, 'id' | 'createdAt' | 'updatedAt'>);
        }
        reload();
        setTipoAlta(null);
        showToastV5('Registro añadido');
      } catch (err) {
        console.error('Error añadiendo registro de inmueble', err);
        showToastV5('No se pudo añadir el registro');
      } finally {
        setGuardando(false);
      }
    },
    [tipoAlta, ejerciciosBloqueados, propertyId, reload],
  );

  const confirmarBorrado = useCallback(async () => {
    if (!registroEnBorrado) return;
    const rid = registroEnBorrado.registro.id;
    if (rid == null) return;
    setBorrando(true);
    try {
      if (registroEnBorrado.tipo === 'real') {
        await gastosInmuebleService.delete(rid);
      } else if (registroEnBorrado.tipo === 'mejora') {
        await mejorasInmuebleService.eliminar(rid);
      } else {
        await mueblesInmuebleService.eliminar(rid);
      }
      reload();
      setRegistroEnBorrado(null);
      showToastV5('Registro eliminado');
    } catch (err) {
      console.error('Error eliminando registro de inmueble', err);
      showToastV5('No se pudo eliminar el registro');
    } finally {
      setBorrando(false);
    }
  }, [registroEnBorrado, reload]);

  return {
    gastosReales,
    mejoras,
    mobiliario,
    ejerciciosBloqueados,
    registroEnEdicion,
    registroEnBorrado,
    tipoAlta,
    guardando,
    borrando,
    reload,
    abrirEdicion: setRegistroEnEdicion,
    cerrarEdicion: () => setRegistroEnEdicion(null),
    abrirBorrado: setRegistroEnBorrado,
    cerrarBorrado: () => setRegistroEnBorrado(null),
    abrirAlta: setTipoAlta,
    cerrarAlta: () => setTipoAlta(null),
    guardar,
    crear,
    confirmarBorrado,
  };
}
