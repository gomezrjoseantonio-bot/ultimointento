/**
 * FiscalVentaPage · F4 venta · vista de SOLO LECTURA de un propertySale
 * ya confirmado. Ruta · `/fiscal/ejercicio/:anio/venta/:ventaId`
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5.
 * Mockup canónico · docs/audit-inputs/atlas-fiscal-v3.html#page-venta.
 *
 * NO duplica el wizard de venta · solo presenta el `fiscalSnapshot`
 * pre-calculado en 5 calc-steps. Si el snapshot falta (ventas legacy)
 * lo recalcula vía `calcularGananciaPatrimonial` con los inputs del sale.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Property, PropertySale } from '../../../services/db';
import {
  buildVentaCalculo,
  loadVentaConSnapshot,
  type VentaCalculoData,
} from './helpers/ventaCalculoService';
import { getPerdidasPatrimonialesVivas } from './helpers/arrastresVivosService';
import type { GananciaPatrimonialResult } from '../../../services/gananciaPatrimonialService';
import VentaHeader from './VentaHeader';
import VentaKpiStrip from './VentaKpiStrip';
import CalcStep from './CalcStep';
import OptimizacionesNote, { type OptimizacionLinea } from './OptimizacionesNote';
import ejercStyles from './FiscalEjercicioPage.module.css';
import ventaStyles from './FiscalVentaPage.module.css';

function isoYear(iso?: string): number | null {
  if (!iso || iso.length < 4) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function estadoPill(sale: PropertySale, añoEjercicio: number): {
  label: string;
  cls: string;
} {
  if (sale.status === 'reverted') {
    return { label: 'Revertida', cls: ejercStyles.pillPrescrito };
  }
  if (sale.status === 'draft') {
    return { label: `Borrador ${añoEjercicio}`, cls: ventaStyles.pillBorrador };
  }
  // status === 'confirmed' · si el año tiene declaración cerrada → Declarado · sino Borrador
  return { label: `Borrador ${añoEjercicio}`, cls: ventaStyles.pillBorrador };
}

function buildOptimizacionesLineas(
  calculo: VentaCalculoData,
  arrastresAntes: Array<{ origen: number; caduca: number; importe: number }>,
): OptimizacionLinea[] {
  const lineas: OptimizacionLinea[] = [];

  // Orden FIFO de arrastres por caducidad
  if (arrastresAntes.length >= 2) {
    const masAntiguo = arrastresAntes[0];
    lineas.push({
      titulo: 'ATLAS aplica primero los arrastres más antiguos.',
      detalle: `Saldo ${masAntiguo.origen} (${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(masAntiguo.importe)} € · caduca 31/12/${masAntiguo.caduca}) antes que los demás · evita pérdida por caducidad.`,
    });
  } else if (arrastresAntes.length === 1) {
    const ar = arrastresAntes[0];
    lineas.push({
      titulo: 'Arrastres patrimoniales aplicados.',
      detalle: `Saldo ${ar.origen} compensado contra la ganancia bruta.`,
    });
  }

  // Aviso de gastos pendientes
  if (!calculo.tieneGastosVentaConfirmados) {
    lineas.push({
      titulo: 'Faltan gastos de venta por confirmar.',
      detalle: 'Notaría · plusvalía municipal · cancelación hipoteca · agencia. Confirmar estos importes reduce la ganancia tributable y el impuesto final.',
    });
  }

  return lineas;
}

const FiscalVentaPage: React.FC = () => {
  const navigate = useNavigate();
  const { anio, ventaId } = useParams<{ anio: string; ventaId: string }>();
  const añoEjercicio = Number(anio);
  const idVenta = Number(ventaId);

  const [property, setProperty] = useState<Property | null>(null);
  const [sale, setSale] = useState<PropertySale | null>(null);
  const [snapshot, setSnapshot] = useState<GananciaPatrimonialResult | null>(null);
  const [calculo, setCalculo] = useState<VentaCalculoData | null>(null);
  const [arrastresAntes, setArrastresAntes] = useState<Array<{ origen: number; caduca: number; importe: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const cargar = useCallback(async () => {
    setNotFound(false);
    if (!Number.isFinite(añoEjercicio) || !Number.isFinite(idVenta)) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    try {
      setLoading(true);
      const loaded = await loadVentaConSnapshot(idVenta);
      if (!loaded) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSale(loaded.sale);
      setProperty(loaded.property);
      setSnapshot(loaded.snapshot);

      // Snapshot de arrastres ANTES de aplicar (informativo para la nota)
      // · reutiliza el mismo helper compartido que `buildVentaCalculo`
      //   para que no haya drift entre la lista que se muestra en la nota
      //   y la que efectivamente se compensa en el Step 4.
      const año = isoYear(loaded.sale.saleDate) ?? añoEjercicio;
      const perdidasVivas = await getPerdidasPatrimonialesVivas(año);
      setArrastresAntes(perdidasVivas.map((p) => ({
        origen: p.origen,
        caduca: p.ejercicioCaducidad,
        importe: p.importePendiente,
      })));

      const data = await buildVentaCalculo({
        sale: loaded.sale,
        property: loaded.property,
        snapshot: loaded.snapshot,
      });
      setCalculo(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal v2] error cargando F4 venta', idVenta, err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [añoEjercicio, idVenta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const optimizaciones = useMemo(
    () => calculo ? buildOptimizacionesLineas(calculo, arrastresAntes) : [],
    [calculo, arrastresAntes],
  );

  if (loading) {
    return (
      <div className={ejercStyles.page}>
        <div className={ejercStyles.empty}>Cargando detalle de la venta…</div>
      </div>
    );
  }

  if (notFound || !sale || !property || !snapshot || !calculo) {
    // Usamos los strings raw de la ruta (no `Number(...)`) para no
    // mostrar "NaN" cuando los params son inválidos · si están vacíos
    // mostramos un mensaje genérico.
    const ventaTxt = ventaId && Number.isFinite(Number(ventaId)) ? ventaId : 'desconocida';
    const añoTxt = anio && Number.isFinite(Number(anio)) ? anio : 'desconocido';
    return (
      <div className={ejercStyles.page}>
        <div className={ejercStyles.empty}>
          {ventaTxt === 'desconocida' || añoTxt === 'desconocido'
            ? 'Ruta de venta inválida.'
            : `No se encontró la venta ${ventaTxt} del ejercicio ${añoTxt}.`}
        </div>
      </div>
    );
  }

  const pill = estadoPill(sale, añoEjercicio);
  const amortAcumTotal =
    (snapshot.amortizacionAcumuladaDeclarada ?? 0)
    + (snapshot.amortizacionAcumuladaAtlas ?? 0);

  return (
    <div className={ejercStyles.page}>
      <VentaHeader
        property={property}
        sale={sale}
        añoEjercicio={añoEjercicio}
        estadoLabel={pill.label}
        estadoClass={pill.cls}
        onBack={() => navigate(`/fiscal/ejercicio/${añoEjercicio}`)}
        onGoDashboard={() => navigate('/fiscal')}
        onGoEjercicio={() => navigate(`/fiscal/ejercicio/${añoEjercicio}`)}
      />

      <VentaKpiStrip
        valorTransmision={calculo.valorTransmision}
        valorAdquisicion={calculo.valorAdquisicionActualizado}
        gananciaTributable={calculo.gananciaTributable}
        impuestoEstimado={calculo.impuestoEstimado}
        gastosVentaConfirmados={calculo.tieneGastosVentaConfirmados}
        arrastresCompensados={calculo.arrastresCompensados}
        amortizacionAcumulada={amortAcumTotal}
        precioAdquisicionOriginal={snapshot.precioAdquisicion + snapshot.gastosAdquisicion}
      />

      {optimizaciones.length > 0 && (
        <OptimizacionesNote
          inmuebleId={sale.propertyId}
          año={añoEjercicio}
          lineas={optimizaciones}
        />
      )}

      {calculo.steps.map((step) => (
        <CalcStep key={`f4-step-${step.num}`} step={step} />
      ))}
    </div>
  );
};

export default FiscalVentaPage;
