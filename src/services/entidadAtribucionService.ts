import { EntidadAtribucionRentas, EntidadEjercicio, initDB } from './db';

export async function crearEntidad(
  input: Omit<EntidadAtribucionRentas, 'id' | 'createdAt' | 'updatedAt'>
): Promise<EntidadAtribucionRentas> {
  const db = await initDB();
  const now = new Date().toISOString();
  const entidad: EntidadAtribucionRentas = {
    ...input,
    ejercicios: [...input.ejercicios].sort((a, b) => b.ejercicio - a.ejercicio),
    createdAt: now,
    updatedAt: now,
  };
  const id = await db.add('entidadesAtribucion', entidad);
  return { ...entidad, id: id as number };
}

export async function getEntidades(): Promise<EntidadAtribucionRentas[]> {
  const db = await initDB();
  const entidades = await db.getAll('entidadesAtribucion') as EntidadAtribucionRentas[];
  return entidades.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getEntidadByNIF(nif: string): Promise<EntidadAtribucionRentas | undefined> {
  const db = await initDB();
  const entidades = await db.getAllFromIndex('entidadesAtribucion', 'nif', nif) as EntidadAtribucionRentas[];
  return entidades[0];
}

export async function actualizarEjercicio(
  entidadId: number,
  datos: EntidadEjercicio
): Promise<void> {
  const db = await initDB();
  const entidad = await db.get('entidadesAtribucion', entidadId) as EntidadAtribucionRentas | undefined;
  if (!entidad) throw new Error('Entidad no encontrada');

  const ejercicios = entidad.ejercicios.filter((ej) => ej.ejercicio !== datos.ejercicio);
  ejercicios.push(datos);
  ejercicios.sort((a, b) => b.ejercicio - a.ejercicio);

  await db.put('entidadesAtribucion', {
    ...entidad,
    ejercicios,
    updatedAt: new Date().toISOString(),
  });
}

export async function guardarEntidad(
  input: Omit<EntidadAtribucionRentas, 'createdAt' | 'updatedAt'>,
): Promise<EntidadAtribucionRentas> {
  if (input.id) {
    const db = await initDB();
    const existente = await db.get('entidadesAtribucion', input.id) as EntidadAtribucionRentas | undefined;
    if (!existente) throw new Error('Entidad no encontrada');
    const actualizada = {
      ...existente,
      ...input,
      ejercicios: [...input.ejercicios].sort((a, b) => b.ejercicio - a.ejercicio),
      updatedAt: new Date().toISOString(),
    };
    await db.put('entidadesAtribucion', actualizada);
    return actualizada;
  }

  const { id: _ignored, ...rest } = input;
  return crearEntidad(rest);
}

export async function getRendimientosAtribuidosEjercicio(ejercicio: number): Promise<{
  capitalInmobiliario: { total: number; retenciones: number; detalle: { entidad: string; importe: number; retencion: number }[] };
  actividadEconomica: { total: number; retenciones: number; detalle: { entidad: string; importe: number; retencion: number }[] };
  capitalMobiliario: { total: number; retenciones: number; detalle: { entidad: string; importe: number; retencion: number }[] };
}> {
  const entidades = await getEntidades();

  const result = {
    capitalInmobiliario: { total: 0, retenciones: 0, detalle: [] as { entidad: string; importe: number; retencion: number }[] },
    actividadEconomica: { total: 0, retenciones: 0, detalle: [] as { entidad: string; importe: number; retencion: number }[] },
    capitalMobiliario: { total: 0, retenciones: 0, detalle: [] as { entidad: string; importe: number; retencion: number }[] },
  };

  for (const entidad of entidades) {
    const ejercicioEntidad = entidad.ejercicios.find((ej) => ej.ejercicio === ejercicio);
    if (!ejercicioEntidad) continue;

    const grupo = entidad.tipoRenta === 'capital_inmobiliario'
      ? result.capitalInmobiliario
      : entidad.tipoRenta === 'actividad_economica'
        ? result.actividadEconomica
        : result.capitalMobiliario;

    grupo.total += ejercicioEntidad.rendimientosAtribuidos;
    grupo.retenciones += ejercicioEntidad.retencionesAtribuidas;
    grupo.detalle.push({
      entidad: `${entidad.nombre} (${entidad.porcentajeParticipacion}%)`,
      importe: ejercicioEntidad.rendimientosAtribuidos,
      retencion: ejercicioEntidad.retencionesAtribuidas,
    });
  }

  return result;
}
