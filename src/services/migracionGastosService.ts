import { initDB, GastoCategoria } from './db';
import { gastosInmuebleService } from './gastosInmuebleService';

const MIGRATION_KEY = 'atlas_migration_gastos_v1';

function mapCasillaToCategoria(casilla: string): GastoCategoria {
  const map: Record<string, GastoCategoria> = {
    '0105': 'intereses',
    '0106': 'reparacion',
    '0109': 'comunidad',
    '0112': 'gestion',
    '0113': 'suministro',
    '0114': 'seguro',
    '0115': 'ibi',
    '0117': 'otro',
  };
  return map[casilla] || 'otro';
}

export async function ejecutarMigracion(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const db = await initDB();
  const now = new Date().toISOString();

  // 1. fiscalSummaries → gastosInmueble
  const summaries = await db.getAll('fiscalSummaries');
  const CASILLAS = [
    { campo: 'box0105', casilla: '0105', categoria: 'intereses' },
    { campo: 'box0106', casilla: '0106', categoria: 'reparacion' },
    { campo: 'box0109', casilla: '0109', categoria: 'comunidad' },
    { campo: 'box0112', casilla: '0112', categoria: 'gestion' },
    { campo: 'box0113', casilla: '0113', categoria: 'suministro' },
    { campo: 'box0114', casilla: '0114', categoria: 'seguro' },
    { campo: 'box0115', casilla: '0115', categoria: 'ibi' },
    { campo: 'box0117', casilla: '0117', categoria: 'otro' },
  ] as const;

  for (const summary of summaries) {
    for (const { campo, casilla, categoria } of CASILLAS) {
      const importe = (summary as any)[campo] || 0;
      if (importe <= 0) continue;
      const origenId = `${summary.propertyId}-${summary.exerciseYear}-${casilla}`;
      await gastosInmuebleService.add({
        inmuebleId: summary.propertyId,
        ejercicio: summary.exerciseYear,
        fecha: `${summary.exerciseYear}-12-31`,
        concepto: `Importado AEAT ${summary.exerciseYear}`,
        categoria: categoria as GastoCategoria,
        casillaAEAT: casilla as any,
        importe,
        origen: 'xml_aeat',
        origenId,
        estado: 'declarado',
        proveedorNIF: 'AEAT',
        proveedorNombre: 'Declaración AEAT',
      });
    }
  }

  // 2. mejorasActivo → mejorasInmueble
  if (db.objectStoreNames.contains('mejorasActivo')) {
    const mejoras = await db.getAll('mejorasActivo');
    for (const m of mejoras) {
      await db.add('mejorasInmueble', {
        inmuebleId: m.inmuebleId,
        ejercicio: m.ejercicio,
        descripcion: m.descripcion || '',
        tipo: m.tipo || 'mejora',
        importe: m.importe || 0,
        fecha: m.fecha || `${m.ejercicio}-12-31`,
        proveedorNIF: m.proveedorNIF || undefined,
        proveedorNombre: m.proveedorNombre || undefined,
        documentId: m.documentId || undefined,
        movimientoId: m.movementId != null ? String(m.movementId) : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 3. mobiliarioActivo → mueblesInmueble
  if (db.objectStoreNames.contains('mobiliarioActivo')) {
    const muebles = await db.getAll('mobiliarioActivo');
    for (const m of muebles) {
      await db.add('mueblesInmueble', {
        inmuebleId: m.inmuebleId,
        ejercicio: m.ejercicio || new Date(m.fechaAlta).getFullYear() || new Date().getFullYear(),
        descripcion: m.descripcion || '',
        fechaAlta: m.fechaAlta,
        importe: m.importe || 0,
        vidaUtil: m.vidaUtil || 10,
        activo: m.activo ?? true,
        fechaBaja: (m as any).fechaBaja || undefined,
        proveedorNIF: m.proveedorNIF || undefined,
        proveedorNombre: m.proveedorNombre || undefined,
        documentId: m.documentId || undefined,
        movimientoId: m.movementId != null ? String(m.movementId) : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 4. operacionesFiscales → gastosInmueble
  if (db.objectStoreNames.contains('operacionesFiscales')) {
    const operaciones = await db.getAll('operacionesFiscales');
    for (const op of operaciones) {
      if (!op.inmuebleId || !op.casillaAEAT || (op.total || 0) <= 0) continue;
      const origenId = op.origenId ? String(op.origenId) : `op-${op.id}`;
      await gastosInmuebleService.add({
        inmuebleId: op.inmuebleId,
        ejercicio: op.ejercicio,
        fecha: op.fecha || `${op.ejercicio}-12-31`,
        concepto: op.concepto || `Operación fiscal ${op.ejercicio}`,
        categoria: mapCasillaToCategoria(op.casillaAEAT),
        casillaAEAT: op.casillaAEAT as any,
        importe: op.total,
        origen: op.origen === 'recurrente' ? 'recurrente' :
                op.origen === 'migracion' ? 'xml_aeat' :
                op.origen === 'movimiento' ? 'tesoreria' : 'manual',
        origenId,
        estado: op.estado === 'previsto' ? 'previsto' : 'confirmado',
        proveedorNIF: op.proveedorNIF || undefined,
        proveedorNombre: op.proveedorNombre || undefined,
        documentId: op.documentId || undefined,
        movimientoId: op.movementId != null ? String(op.movementId) : undefined,
      });
    }
  }

  localStorage.setItem(MIGRATION_KEY, 'done');
}
