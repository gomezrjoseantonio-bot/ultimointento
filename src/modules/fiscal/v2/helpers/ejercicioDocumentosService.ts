/**
 * ejercicioDocumentosService.ts · helpers para los tabs Pagos · Documentos
 * · Versiones · ventas del ejercicio (sección E).
 *
 * Mantenemos lecturas directas de stores (`documents`, `property_sales`)
 * para no crear nuevas APIs en servicios que el spec congela.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3.
 */

import { initDB } from '../../../../services/db';
import { getDeudas } from '../../../../services/deudasFiscalesService';
import type { DeudaFiscal } from '../../../../services/db';
import type { DocumentoRow } from '../EjercicioDocumentosTab';
import type { PagoRow } from '../EjercicioPagosTab';

const TIPO_LABEL: Record<string, string> = {
  declaracion_irpf: 'Declaración IRPF',
  xml_aeat: 'XML AEAT',
  certificado_retenciones: 'Certificado retenciones',
  factura: 'Factura',
  fiscal: 'Documento fiscal',
};

export async function getDocumentosDelEjercicio(año: number): Promise<DocumentoRow[]> {
  const db = await initDB();
  try {
    const todos = (await db.getAll('documents')) as Array<{
      id?: number;
      type?: string;
      filename?: string;
      uploadDate?: string;
      metadata?: {
        ejercicio?: number;
        tipo?: string;
        concepto?: string;
        financialData?: { issueDate?: string };
      };
    }>;
    return todos
      .filter((d) => {
        const ej = d.metadata?.ejercicio;
        if (ej === año) return true;
        const issueDate = d.metadata?.financialData?.issueDate;
        if (issueDate && new Date(issueDate).getFullYear() === año) return true;
        return false;
      })
      .map((d) => ({
        id: d.id,
        titulo: d.filename ?? 'Documento sin nombre',
        concepto: d.metadata?.concepto,
        fecha: d.uploadDate ?? d.metadata?.financialData?.issueDate,
        tipo: d.type ? (TIPO_LABEL[d.type] ?? d.type) : d.metadata?.tipo,
      }))
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  } catch {
    return [];
  }
}

export interface VentaRow {
  id: number;
  alias: string;
  fechaVenta: string;
  ganancia: number | null;
}

export async function getVentasDelAño(año: number): Promise<VentaRow[]> {
  const db = await initDB();
  try {
    const ventas = (await db.getAll('property_sales')) as Array<{
      id?: number;
      propertyId: number;
      saleDate?: string;
      status?: string;
      fiscalSnapshot?: { gananciaPatrimonial?: number };
    }>;
    const properties = (await db.getAll('properties')) as Array<{ id?: number; alias?: string }>;
    const aliasById = new Map<number, string>();
    for (const p of properties) {
      if (typeof p.id === 'number') aliasById.set(p.id, p.alias ?? `Inmueble ${p.id}`);
    }
    return ventas
      .filter((v) => v.saleDate && new Date(v.saleDate).getFullYear() === año && v.status !== 'cancelled')
      .map((v) => ({
        id: v.id ?? v.propertyId,
        alias: aliasById.get(v.propertyId) ?? `Inmueble ${v.propertyId}`,
        fechaVenta: v.saleDate!,
        ganancia: v.fiscalSnapshot?.gananciaPatrimonial ?? null,
      }))
      .sort((a, b) => a.fechaVenta.localeCompare(b.fechaVenta));
  } catch {
    return [];
  }
}

export async function getDeudasDelEjercicio(año: number): Promise<DeudaFiscal[]> {
  try {
    const todas = await getDeudas();
    return todas.filter((d) => d.ejercicio === año);
  } catch {
    return [];
  }
}

export interface CuotaDiferencialInfo {
  cuota: number | null;
  pagos: PagoRow[];
}

export async function getCuotaDiferencialDelEjercicio(
  año: number,
  resultado: number | null,
): Promise<CuotaDiferencialInfo> {
  // Por ahora la información de pago efectivo no vive en un store fiscal
  // dedicado · la sub-tarea 3 se limita a mostrar la cuota teórica del
  // resultado del ejercicio. Cuando exista un servicio que devuelva el
  // historial de pagos de la cuota diferencial, este helper se cableará
  // a esa fuente.
  void año;
  return {
    cuota: resultado,
    pagos: [],
  };
}
