export type Frecuencia = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export type CategoriaGasto =
  | 'vivienda'
  | 'alimentacion'
  | 'transporte'
  | 'salud'
  | 'ocio'
  | 'ropa'
  | 'educacion'
  | 'otros';

export interface PersonalExpense {
  id?: number;
  concepto: string;
  categoria: CategoriaGasto;
  importe: number;
  frecuencia: Frecuencia;
  /** Día del mes en que se realiza el cargo (1-31), opcional */
  dia?: number;
  notas?: string;
  createdAt: string;
}
