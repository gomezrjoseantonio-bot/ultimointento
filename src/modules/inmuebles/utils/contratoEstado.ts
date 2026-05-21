import type { Contract } from '../../../services/db';

export const isContratoActivo = (c: Contract): boolean => c.estadoContrato === 'activo';
