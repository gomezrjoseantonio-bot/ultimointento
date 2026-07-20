// Panel · modelos de vista (view-models) que PanelPage calcula y pasa a los
// componentes de sección. Mantienen la lógica de datos en PanelPage y los
// componentes puramente presentacionales.

/** Estado del anillo de libertad · solo muestra % con objetivo real (Mi Plan). */
export type AnilloState =
  | { estado: 'sin-objetivo' }
  | { estado: 'cargando' }
  | { estado: 'error' }
  | {
      estado: 'ok';
      pct: number;
      rentaActual: number;
      objetivo: number;
      anioLibertad: number | null;
      añosRestantes: number | null;
    };

/** Cinco celdas de "Cómo va el mes". */
export interface MesVM {
  haEntrado: number;
  nEntrado: number;
  quedaEntrar: number;
  nQuedaEntrar: number;
  haSalido: number;
  nSalido: number;
  quedaSalir: number;
  nQuedaSalir: number;
  saldoFin: number;
}

/** Colchón · divisor = cuota mensual de préstamos (decisión Jose). */
export type ColchonVM =
  | { estado: 'sin-cuotas' }
  | { estado: 'ok'; meses: number };

export interface SinConciliarVM {
  count: number;
  total: number;
}

export interface Proximos30VM {
  count: number;
  primero: string | null;
}

export interface IrpfVM {
  cuota: number;
  ejercicio: number;
  mesesConDatos: number;
}
