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
  /**
   * false si hay compromisos recurrentes activos este mes pero NO se generó
   * ningún evento (la regla opex no ha corrido) · entonces el saldo a fin de
   * mes no es fiable y se muestra estado vacío (decisión Jose).
   */
  saldoFinFiable: boolean;
}

/**
 * Colchón · divisor = TODO lo que sale al mes aunque no entre ingreso
 * (cuota de préstamos + gastos fijos recurrentes prorrateados). Decisión Jose.
 * Los flags permiten declarar en el subtítulo qué NO se está contando.
 */
export type ColchonVM =
  | { estado: 'sin-datos' }
  | {
      estado: 'ok';
      meses: number;
      /** true si el divisor incluye gastos fijos de vida/recurrentes registrados. */
      cuentaVida: boolean;
      /** true si hay inmuebles cuya comunidad/IBI no se está contando. */
      hayInmuebles: boolean;
    };

export interface PorConfirmarVM {
  count: number;
  total: number;
}

export interface Proximos30VM {
  count: number;
  primero: string | null;
}

/** Un apunte concreto detrás de una cifra de "Cómo va el mes". */
export interface FlujoRow {
  id: string;
  /** Fecha del apunte · `YYYY-MM-DD`. */
  fecha: string;
  /** Título del apunte · QUIÉN cobra o paga (modelo del apunte · L1). */
  concepto: string;
  /** Segunda línea · QUÉ ES (concepto del catálogo). `undefined` si no aporta. */
  detalle?: string;
  /** Inmueble al que pertenece el apunte, si lo hay. */
  inmueble?: string;
  /** Magnitud SIEMPRE en positivo · el signo lo pone la tarjeta. */
  importe: number;
  /** Nombre de la cuenta, si se conoce. */
  cuenta?: string;
}

export type FlujoClave = 'haEntrado' | 'quedaEntrar' | 'haSalido' | 'quedaSalir';

/** Las cuatro poblaciones que componen las cifras de "Cómo va el mes". */
export interface FlujosMes {
  haEntrado: FlujoRow[];
  quedaEntrar: FlujoRow[];
  haSalido: FlujoRow[];
  quedaSalir: FlujoRow[];
}

export interface IrpfVM {
  /**
   * Resultado ESTIMADO de la renta del ejercicio · cuota líquida MENOS lo ya
   * pagado a cuenta (retención de nómina, M130, retenciones de capital).
   * Signo: positivo = a pagar · negativo = a devolver (igual que
   * `irpfCalculationService.resultado` y el módulo Fiscal). NO es la cuota
   * líquida bruta: eso incluiría el IRPF que ya se paga vía nómina.
   */
  resultado: number;
  ejercicio: number;
  mesesConDatos: number;
}
