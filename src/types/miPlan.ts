// ─── Mi Plan v3 · Tipos de datos ─────────────────────────────────────────────
// Archivo único para los 4 stores de Mi Plan v3:
//   escenarios · objetivos · fondos_ahorro · retos

// ═══════════════════════════════════════════════════
// ESCENARIOS
// ═══════════════════════════════════════════════════

export type ModoVivienda = 'alquiler' | 'propia';
export type Estrategia = 'hibrido' | 'conservador' | 'agresivo';

export interface Hito {
  id: string;                     // UUID
  fecha: string;                  // YYYY-MM-DD
  tipo: 'compra' | 'venta' | 'revisionRenta' | 'amortizacionExtraordinaria' | 'cambioGastosVida';
  impactoMensual: number;         // € · positivo = más renta · negativo = menos
  descripcion: string;
}

export interface Escenario {
  id: number;                     // singleton · siempre id=1

  // Configuración del escenario libertad activo (NUEVO)
  modoVivienda: ModoVivienda;
  gastosVidaLibertadMensual: number;
  estrategia: Estrategia;
  hitos: Hito[];                  // embebido · array dentro del singleton

  // KPIs macro (preexistentes de objetivos_financieros · opcionales para compatibilidad)
  rentaPasivaObjetivo?: number;
  patrimonioNetoObjetivo?: number;
  cajaMinima?: number;
  dtiMaximo?: number;
  ltvMaximo?: number;
  yieldMinimaCartera?: number;
  tasaAhorroMinima?: number;

  updatedAt: string;
}

// ═══════════════════════════════════════════════════
// OBJETIVOS
// ═══════════════════════════════════════════════════

export type ObjetivoEstado =
  | 'en-progreso'
  | 'en-riesgo'
  | 'en-pausa'
  | 'completado'
  | 'archivado';

export interface ObjetivoBase {
  id: string;                     // UUID
  nombre: string;
  descripcion?: string;
  fechaCierre: string;            // YYYY-MM-DD
  estado: ObjetivoEstado;
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}

// Unidad para tipo='acumular' · default 'eur' (registros V65 sin campo).
export type AcumularUnidad = 'eur' | 'meses';

// Métrica para tipo='comprar' · default 'valor' (registros V65 sin campo).
export type ComprarMetric = 'valor' | 'unidades';

// Union discriminada por tipo
export type Objetivo = ObjetivoBase &
  (
    | {
        tipo: 'acumular';
        metaCantidad: number;     // valor numérico · interpretado según `unidad`
        fondoId: string;          // FK → fondos_ahorro.id (UUID)
        unidad?: AcumularUnidad;  // V66 (T27.1) · default 'eur' si ausente
      }
    | {
        tipo: 'amortizar';
        metaCantidad: number;     // €
        prestamoId: string;       // FK → prestamos.id (UUID string · NO number)
      }
    | {
        tipo: 'comprar';
        metaCantidad: number;     // valor numérico · interpretado según `metric`
        fondoId: string;          // FK → fondos_ahorro.id
        capacidadEndeudamientoEsperada?: number; // € estimado de financiación bancaria
        metric?: ComprarMetric;   // V66 (T27.1) · default 'valor' si ausente
      }
    | {
        tipo: 'reducir';
        metaCantidadMensual: number; // € objetivo mensual
        categoriaGasto: string;      // ej. 'suscripciones' · 'restaurantes'
      }
  );

export type ObjetivoTipo = Objetivo['tipo'];

// ═══════════════════════════════════════════════════
// FONDOS DE AHORRO
// ═══════════════════════════════════════════════════

export type FondoTipo =
  | 'colchon'
  | 'compra'
  | 'reforma'
  | 'impuestos'
  | 'capricho'
  | 'custom';

export type CuentaAsignada =
  | {
      cuentaId: number;           // FK → accounts.id (number · autoIncrement)
      modo: 'completo';           // toda la cuenta etiquetada a este fondo
    }
  | {
      cuentaId: number;
      modo: 'parcial';
      modoImporte: 'fijo';
      importeAsignado: number;    // €
    }
  | {
      cuentaId: number;
      modo: 'parcial';
      modoImporte: 'porcentaje';
      porcentajeAsignado: number; // 0-100
    };

export interface FondoAhorro {
  id: string;                     // UUID
  tipo: FondoTipo;
  nombre: string;
  descripcion?: string;
  cuentasAsignadas: CuentaAsignada[];
  metaImporte?: number;           // € · meta opcional
  metaMeses?: number;             // para tipo='colchon' · ej. 12 meses
  activo: boolean;                // soft-delete sin perder histórico
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════
// RETOS
// ═══════════════════════════════════════════════════

export type RetoTipo = 'ahorro' | 'ejecucion' | 'disciplina' | 'revision';
export type RetoEstado = 'futuro' | 'activo' | 'completado' | 'parcial' | 'fallado';
export type OrigenSugerencia = 'atlas' | 'usuario';

export interface Reto {
  id: string;                     // UUID
  tipo: RetoTipo;
  mes: string;                    // YYYY-MM · UNIQUE en índice
  titulo: string;
  descripcion?: string;
  metaCantidad?: number;          // € · para tipo 'ahorro' y 'ejecucion'
  metaBinaria?: boolean;          // para tipo 'revision'
  estado: RetoEstado;
  vinculadoA?: {
    objetivoId?: string;
    fondoId?: string;
    prestamoId?: string;
    categoriaGasto?: string;
  };
  origenSugerencia?: OrigenSugerencia; // V1 siempre 'usuario' · 'atlas' reservado TAREA 7
  notasCierre?: string;
  createdAt: string;
  updatedAt: string;
}
