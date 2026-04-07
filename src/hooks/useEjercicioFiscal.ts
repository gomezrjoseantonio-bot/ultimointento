import { useCallback, useEffect, useState } from 'react';
import {
  getCoberturaDocumental,
  getOrCreateEjercicio,
} from '../services/ejercicioFiscalService';
import { ejercicioFiscalService } from '../services/ejercicioFiscalService';
import type {
  DeclaracionIRPF,
  EjercicioFiscal,
  EstadoEjercicio,
  InformeCoberturaDocumental,
} from '../types/fiscal';

interface UseEjercicioFiscalResult {
  ejercicio: EjercicioFiscal | undefined;
  estado: EstadoEjercicio;
  calculado: DeclaracionIRPF | undefined;
  declarado: DeclaracionIRPF | undefined;
  cobertura: InformeCoberturaDocumental | undefined;
  loading: boolean;
  esEditable: boolean;
  tieneAeat: boolean;
  motorActivo: boolean;
  refresh: () => Promise<void>;
}

export function useEjercicioFiscal(anio: number): UseEjercicioFiscalResult {
  const [ejercicio, setEjercicio] = useState<EjercicioFiscal>();
  const [calculado, setCalculado] = useState<DeclaracionIRPF>();
  const [declarado, setDeclarado] = useState<DeclaracionIRPF>();
  const [cobertura, setCobertura] = useState<InformeCoberturaDocumental>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ejercicioDb, tresVerdades, coberturaDoc] = await Promise.all([
        getOrCreateEjercicio(anio),
        ejercicioFiscalService.getTresVerdades(anio),
        getCoberturaDocumental(anio),
      ]);

      setEjercicio({
        ejercicio: ejercicioDb.ejercicio,
        estado: (() => {
          const st = ejercicioDb.estado;
          if (st === 'vivo' || st === 'pendiente_cierre') return 'en_curso';
          if (st === 'prescrito') return 'declarado';
          return st;
        })() as EstadoEjercicio,
        calculoAtlas: ejercicioDb.calculoAtlas,
        calculoAtlasFecha: ejercicioDb.calculoAtlasFecha,
        declaracionAeat: ejercicioDb.declaracionAeat,
        declaracionAeatFecha: ejercicioDb.declaracionAeatFecha,
        declaracionAeatPdfRef: ejercicioDb.declaracionAeatPdfRef,
        declaracionAeatOrigen: ejercicioDb.declaracionAeatOrigen ?? 'no_presentada',
        arrastresRecibidos: ejercicioDb.arrastresRecibidos ?? { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
        arrastresGenerados: ejercicioDb.arrastresGenerados ?? { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
        createdAt: ejercicioDb.createdAt,
        updatedAt: ejercicioDb.updatedAt,
        cerradoAt: ejercicioDb.cerradoAt,
        declaradoAt: ejercicioDb.declaradoAt,
      });
      setCalculado(tresVerdades.calculado);
      setDeclarado(tresVerdades.declarado);
      setCobertura(coberturaDoc);
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const estado = ejercicio?.estado ?? 'cerrado';

  return {
    ejercicio,
    estado,
    calculado,
    declarado,
    cobertura,
    loading,
    esEditable: estado === 'en_curso' || estado === 'cerrado',
    tieneAeat: !!declarado,
    motorActivo: estado !== 'declarado',
    refresh,
  };
}
