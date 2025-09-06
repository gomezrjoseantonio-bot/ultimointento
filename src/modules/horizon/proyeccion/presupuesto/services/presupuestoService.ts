import { initDB, Presupuesto, PresupuestoLinea, CategoriaGasto, CategoriaIngreso, FrecuenciaPago, UUID } from '../../../../../services/db';

// UUID helper (simple implementation)
export const generateUUID = (): UUID => {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
    return (Math.random() * 16 | 0).toString(16);
  });
};

// Get all presupuestos for a specific year
export const getPresupuestosByYear = async (year: number): Promise<Presupuesto[]> => {
  const db = await initDB();
  const tx = db.transaction('presupuestos', 'readonly');
  const index = tx.store.index('year');
  const presupuestos = await index.getAll(year);
  return presupuestos.sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
};

// Get presupuesto by ID
export const getPresupuestoById = async (id: UUID): Promise<Presupuesto | null> => {
  const db = await initDB();
  const presupuesto = await db.get('presupuestos', id);
  return presupuesto || null;
};

// Create a new presupuesto
export const createPresupuesto = async (year: number): Promise<UUID> => {
  const db = await initDB();
  const now = new Date().toISOString();
  const id = generateUUID();
  
  const presupuesto: Presupuesto = {
    id,
    year,
    creadoEn: now,
    actualizadoEn: now,
    estado: "Borrador"
  };
  
  await db.add('presupuestos', presupuesto);
  return id;
};

// Update presupuesto
export const updatePresupuesto = async (id: UUID, updates: Partial<Presupuesto>): Promise<void> => {
  const db = await initDB();
  const presupuesto = await db.get('presupuestos', id);
  if (!presupuesto) throw new Error('Presupuesto not found');
  
  const updatedPresupuesto: Presupuesto = {
    ...presupuesto,
    ...updates,
    actualizadoEn: new Date().toISOString()
  };
  
  await db.put('presupuestos', updatedPresupuesto);
};

// Delete presupuesto and its lines
export const deletePresupuesto = async (id: UUID): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['presupuestos', 'presupuestoLineas'], 'readwrite');
  
  // Delete presupuesto lines first
  const linesIndex = tx.objectStore('presupuestoLineas').index('presupuestoId');
  const lines = await linesIndex.getAll(id);
  for (const line of lines) {
    await tx.objectStore('presupuestoLineas').delete(line.id);
  }
  
  // Delete presupuesto
  await tx.objectStore('presupuestos').delete(id);
};

// Get presupuesto lines
export const getPresupuestoLineas = async (presupuestoId: UUID): Promise<PresupuestoLinea[]> => {
  const db = await initDB();
  const tx = db.transaction('presupuestoLineas', 'readonly');
  const index = tx.store.index('presupuestoId');
  return index.getAll(presupuestoId);
};

// Create presupuesto line
export const createPresupuestoLinea = async (linea: Omit<PresupuestoLinea, 'id'>): Promise<UUID> => {
  const db = await initDB();
  const id = generateUUID();
  
  const nuevaLinea: PresupuestoLinea = {
    ...linea,
    id
  };
  
  await db.add('presupuestoLineas', nuevaLinea);
  return id;
};

// Update presupuesto line
export const updatePresupuestoLinea = async (id: UUID, updates: Partial<PresupuestoLinea>): Promise<void> => {
  const db = await initDB();
  const linea = await db.get('presupuestoLineas', id);
  if (!linea) throw new Error('Presupuesto linea not found');
  
  const updatedLinea: PresupuestoLinea = {
    ...linea,
    ...updates
  };
  
  await db.put('presupuestoLineas', updatedLinea);
};

// Delete presupuesto line
export const deletePresupuestoLinea = async (id: UUID): Promise<void> => {
  const db = await initDB();
  await db.delete('presupuestoLineas', id);
};

// Generate schedule for a line (eventos por fecha)
export interface EventoPresupuesto {
  fecha: string; // ISO date
  importe: number;
  cuentaId?: UUID;
  inmuebleId?: UUID;
  categoria?: CategoriaGasto | CategoriaIngreso;
  tipoConcepto?: string;
}

export const generarCalendarioLinea = (
  linea: PresupuestoLinea,
  year: number
): EventoPresupuesto[] => {
  const eventos: EventoPresupuesto[] = [];
  const importeUnitario = linea.importeUnitario;
  
  // Calculate fecha desde and hasta
  const fechaDesde = linea.desde ? new Date(linea.desde) : new Date(year, 0, 1);
  const fechaHasta = linea.hasta ? new Date(linea.hasta) : new Date(year, 11, 31);
  
  switch (linea.frecuencia) {
    case "Mensual":
      for (let month = fechaDesde.getMonth(); month <= fechaHasta.getMonth(); month++) {
        const dayOfMonth = linea.dayOfMonth || 1;
        const fecha = new Date(year, month, Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate()));
        
        // Skip if fecha is outside the vigencia range
        if (fecha < fechaDesde || fecha > fechaHasta) continue;
        
        // Check if month is active
        if (linea.mesesActivos && !linea.mesesActivos.includes(month + 1)) continue;
        
        eventos.push({
          fecha: fecha.toISOString().split('T')[0],
          importe: importeUnitario,
          cuentaId: linea.cuentaId,
          inmuebleId: linea.inmuebleId,
          categoria: linea.categoria,
          tipoConcepto: linea.tipoConcepto
        });
      }
      break;
      
    case "Bimestral":
      for (let month = fechaDesde.getMonth(); month <= fechaHasta.getMonth(); month += 2) {
        const dayOfMonth = linea.dayOfMonth || 1;
        const fecha = new Date(year, month, Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate()));
        
        if (fecha < fechaDesde || fecha > fechaHasta) continue;
        if (linea.mesesActivos && !linea.mesesActivos.includes(month + 1)) continue;
        
        eventos.push({
          fecha: fecha.toISOString().split('T')[0],
          importe: importeUnitario,
          cuentaId: linea.cuentaId,
          inmuebleId: linea.inmuebleId,
          categoria: linea.categoria,
          tipoConcepto: linea.tipoConcepto
        });
      }
      break;
      
    case "Trimestral":
      for (let month = fechaDesde.getMonth(); month <= fechaHasta.getMonth(); month += 3) {
        const dayOfMonth = linea.dayOfMonth || 1;
        const fecha = new Date(year, month, Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate()));
        
        if (fecha < fechaDesde || fecha > fechaHasta) continue;
        if (linea.mesesActivos && !linea.mesesActivos.includes(month + 1)) continue;
        
        eventos.push({
          fecha: fecha.toISOString().split('T')[0],
          importe: importeUnitario,
          cuentaId: linea.cuentaId,
          inmuebleId: linea.inmuebleId,
          categoria: linea.categoria,
          tipoConcepto: linea.tipoConcepto
        });
      }
      break;
      
    case "Semestral":
      for (let month = fechaDesde.getMonth(); month <= fechaHasta.getMonth(); month += 6) {
        const dayOfMonth = linea.dayOfMonth || 1;
        const fecha = new Date(year, month, Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate()));
        
        if (fecha < fechaDesde || fecha > fechaHasta) continue;
        if (linea.mesesActivos && !linea.mesesActivos.includes(month + 1)) continue;
        
        eventos.push({
          fecha: fecha.toISOString().split('T')[0],
          importe: importeUnitario,
          cuentaId: linea.cuentaId,
          inmuebleId: linea.inmuebleId,
          categoria: linea.categoria,
          tipoConcepto: linea.tipoConcepto
        });
      }
      break;
      
    case "Anual":
      const month = linea.dayOfMonth ? Math.floor((linea.dayOfMonth - 1) / 28) : 0; // rough month calculation
      const day = linea.dayOfMonth || 1;
      const fecha = new Date(year, month, day);
      
      if (fecha >= fechaDesde && fecha <= fechaHasta) {
        eventos.push({
          fecha: fecha.toISOString().split('T')[0],
          importe: importeUnitario,
          cuentaId: linea.cuentaId,
          inmuebleId: linea.inmuebleId,
          categoria: linea.categoria,
          tipoConcepto: linea.tipoConcepto
        });
      }
      break;
      
    case "Unico":
      if (linea.fechaUnica) {
        const fecha = new Date(linea.fechaUnica);
        if (fecha >= fechaDesde && fecha <= fechaHasta) {
          eventos.push({
            fecha: linea.fechaUnica,
            importe: importeUnitario,
            cuentaId: linea.cuentaId,
            inmuebleId: linea.inmuebleId,
            categoria: linea.categoria,
            tipoConcepto: linea.tipoConcepto
          });
        }
      }
      break;
  }
  
  return eventos;
};

// Generate budget seed (semilla automática)
export const sembrarPresupuesto = async (
  presupuestoId: UUID,
  year: number,
  inmuebleIds: UUID[] = []
): Promise<UUID[]> => {
  const db = await initDB();
  const lineasCreadas: UUID[] = [];
  
  // Get active contracts for selected properties
  const contractsStore = db.transaction('contracts', 'readonly').store;
  const allContracts = await contractsStore.getAll();
  const activeContracts = allContracts.filter(
    contract => 
      contract.status === 'active' &&
      (inmuebleIds.length === 0 || inmuebleIds.includes(contract.propertyId.toString()))
  );
  
  // Generate income from contracts
  for (const contract of activeContracts) {
    const lineaId = await createPresupuestoLinea({
      presupuestoId,
      tipo: "Ingreso",
      inmuebleId: contract.propertyId.toString(),
      categoria: "Alquiler",
      tipoConcepto: `Alquiler - ${contract.tenant.name}`,
      frecuencia: "Mensual",
      dayOfMonth: contract.paymentDay || 1,
      importeUnitario: contract.monthlyRent,
      ivaIncluido: true,
      origen: "SemillaAuto",
      editable: true,
      contratoId: contract.id?.toString(),
      notas: 'Generado automáticamente desde contrato'
    });
    lineasCreadas.push(lineaId);
  }
  
  // Generate expense placeholders for each property
  const expenseCategories: Array<{ categoria: CategoriaGasto; tipoConcepto: string; frecuencia: FrecuenciaPago }> = [
    { categoria: "IBI", tipoConcepto: "IBI", frecuencia: "Anual" },
    { categoria: "Comunidad", tipoConcepto: "Gastos de comunidad", frecuencia: "Mensual" },
    { categoria: "Seguros", tipoConcepto: "Seguro hogar", frecuencia: "Anual" },
    { categoria: "Suministros", tipoConcepto: "Electricidad", frecuencia: "Mensual" },
    { categoria: "Suministros", tipoConcepto: "Agua", frecuencia: "Mensual" },
    { categoria: "Suministros", tipoConcepto: "Gas", frecuencia: "Mensual" },
    { categoria: "ReparaciónYConservación", tipoConcepto: "Reparación y conservación", frecuencia: "Anual" },
    { categoria: "Mantenimiento", tipoConcepto: "Mantenimiento", frecuencia: "Anual" }
  ];
  
  for (const inmuebleId of inmuebleIds) {
    for (const { categoria, tipoConcepto, frecuencia } of expenseCategories) {
      const lineaId = await createPresupuestoLinea({
        presupuestoId,
        tipo: "Gasto",
        inmuebleId,
        categoria,
        tipoConcepto,
        frecuencia,
        dayOfMonth: 1,
        importeUnitario: 0, // To be filled manually
        ivaIncluido: true,
        origen: "ManualUsuario",
        editable: true,
        notas: 'Completar manualmente'
      });
      lineasCreadas.push(lineaId);
    }
  }
  
  return lineasCreadas;
};

// Calculate totals and monthly breakdown
export interface ResumenPresupuesto {
  year: number;
  ingresoAnual: number;
  gastoAnual: number;
  netoAnual: number;
  breakdown: {
    ingresos: number[]; // 12 months
    gastos: number[]; // 12 months
    neto: number[]; // 12 months
  };
}

export const calcularResumenPresupuesto = async (
  presupuestoId: UUID
): Promise<ResumenPresupuesto> => {
  const presupuesto = await getPresupuestoById(presupuestoId);
  if (!presupuesto) throw new Error('Presupuesto not found');
  
  const lineas = await getPresupuestoLineas(presupuestoId);
  
  let ingresoAnual = 0;
  let gastoAnual = 0;
  const ingresosMensuales = new Array(12).fill(0);
  const gastosMensuales = new Array(12).fill(0);
  
  for (const linea of lineas) {
    const eventos = generarCalendarioLinea(linea, presupuesto.year);
    
    for (const evento of eventos) {
      const month = new Date(evento.fecha).getMonth();
      
      if (linea.tipo === "Ingreso") {
        ingresoAnual += evento.importe;
        ingresosMensuales[month] += evento.importe;
      } else {
        gastoAnual += evento.importe;
        gastosMensuales[month] += evento.importe;
      }
    }
  }
  
  const netoMensual = ingresosMensuales.map((ingreso, i) => ingreso - gastosMensuales[i]);
  
  return {
    year: presupuesto.year,
    ingresoAnual: Math.round(ingresoAnual * 100) / 100,
    gastoAnual: Math.round(gastoAnual * 100) / 100,
    netoAnual: Math.round((ingresoAnual - gastoAnual) * 100) / 100,
    breakdown: {
      ingresos: ingresosMensuales.map(i => Math.round(i * 100) / 100),
      gastos: gastosMensuales.map(g => Math.round(g * 100) / 100),
      neto: netoMensual.map(n => Math.round(n * 100) / 100)
    }
  };
};

// Validation utilities
export const validarLinea = (linea: Omit<PresupuestoLinea, 'id'>): string[] => {
  const errores: string[] = [];
  
  if (!linea.tipo) errores.push('Tipo es requerido');
  if (!linea.categoria) errores.push('Categoría es requerida');
  if (!linea.tipoConcepto) errores.push('Tipo de concepto es requerido');
  if (!linea.frecuencia) errores.push('Frecuencia es requerida');
  if (linea.importeUnitario <= 0) errores.push('Importe debe ser mayor que 0');
  
  if (linea.dayOfMonth && (linea.dayOfMonth < 1 || linea.dayOfMonth > 28)) {
    errores.push('Día del mes debe estar entre 1 y 28');
  }
  
  if (linea.frecuencia === "Unico" && !linea.fechaUnica) {
    errores.push('Fecha única es requerida para pagos únicos');
  }
  
  return errores;
};