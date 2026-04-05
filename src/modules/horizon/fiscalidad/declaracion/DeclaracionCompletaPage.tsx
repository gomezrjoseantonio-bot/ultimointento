/**
 * DeclaracionCompletaPage.tsx
 * 
 * Vista de declaración completa para un año fiscal específico.
 * Ruta: /fiscalidad/declaracion/:año
 * Se accede desde el link "Ver declaración completa" en la tarjeta Resultado.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  resolverDatosEjercicio,
  type DatosFiscalesEjercicio,
} from '../../../../services/fiscalResolverService';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type EstadoEjercicio = 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';

interface SeccionDeclaracion {
  id: string;
  titulo: string;
  total: number;
  subsecciones?: SubseccionDeclaracion[];
  filas?: FilaDeclaracion[];
}

interface SubseccionDeclaracion {
  id: string;
  titulo: string;
  total: number;
  filas: FilaDeclaracion[];
}

interface FilaDeclaracion {
  label: string;
  valor: number;
  esNegativo?: boolean;
  esDestacado?: boolean;
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ══════════════════════════════════════════════════════════════

const ESTADO_BADGE: Record<EstadoEjercicio, { bg: string; color: string; texto: string }> = {
  en_curso: { bg: 'var(--teal-100)', color: 'var(--teal-600)', texto: 'En curso' },
  pendiente: { bg: 'var(--grey-100)', color: 'var(--grey-700)', texto: 'Pendiente' },
  declarado: { bg: 'var(--navy-100)', color: 'var(--navy-700)', texto: 'Declarado' },
  prescrito: { bg: 'var(--grey-100)', color: 'var(--grey-400)', texto: 'Prescrito' },
};

// Format Euro (with 2 decimals)
const formatEur = (n: number): string =>
  Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format Euro (no decimals)
const formatEur0 = (n: number): string =>
  Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function mapEstado(estado: string): EstadoEjercicio {
  switch (estado) {
    case 'en_curso': return 'en_curso';
    case 'pendiente': return 'pendiente';
    case 'declarado': return 'declarado';
    case 'prescrito': return 'prescrito';
    default: return 'pendiente';
  }
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const monoStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--grey-200)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Section Header (collapsible)
// ══════════════════════════════════════════════════════════════

interface SeccionHeaderProps {
  titulo: string;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  nivel?: 1 | 2;
}

const SeccionHeader: React.FC<SeccionHeaderProps> = ({
  titulo,
  total,
  isOpen,
  onToggle,
  nivel = 1,
}) => {
  const esNivel1 = nivel === 1;
  
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: esNivel1 ? '12px 16px' : '8px 16px 8px 32px',
        background: esNivel1 ? 'var(--grey-50)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--grey-100)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'IBM Plex Sans', sans-serif",
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = esNivel1 ? 'var(--grey-100)' : 'var(--grey-50)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = esNivel1 ? 'var(--grey-50)' : 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isOpen ? <ChevronDown size={14} color="var(--grey-500)" /> : <ChevronRight size={14} color="var(--grey-500)" />}
        <span style={{
          fontSize: esNivel1 ? 13 : 12,
          fontWeight: esNivel1 ? 600 : 500,
          color: 'var(--grey-900)',
        }}>
          {titulo}
        </span>
      </div>
      <span style={{
        fontSize: esNivel1 ? 13 : 12,
        fontWeight: 600,
        color: total < 0 ? 'var(--teal-600)' : 'var(--navy-900)',
        ...monoStyle,
      }}>
        {total < 0 ? '−' : ''}{formatEur0(Math.abs(total))} €
      </span>
    </button>
  );
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Row
// ══════════════════════════════════════════════════════════════

interface FilaProps {
  label: string;
  valor: number;
  esDestacado?: boolean;
  indent?: number;
}

const Fila: React.FC<FilaProps> = ({ label, valor, esDestacado = false, indent = 2 }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 16px',
    paddingLeft: 16 + (indent * 16),
    borderBottom: '1px solid var(--grey-50)',
    fontSize: 12,
  }}>
    <span style={{
      color: esDestacado ? 'var(--grey-900)' : 'var(--grey-600)',
      fontWeight: esDestacado ? 500 : 400,
    }}>
      {label}
    </span>
    <span style={{
      color: valor < 0 ? 'var(--teal-600)' : (esDestacado ? 'var(--navy-900)' : 'var(--grey-700)'),
      fontWeight: esDestacado ? 600 : 400,
      ...monoStyle,
    }}>
      {valor < 0 ? '−' : ''}{formatEur(Math.abs(valor))} €
    </span>
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPONENT: Collapsible Section
// ══════════════════════════════════════════════════════════════

interface SeccionColapsableProps {
  seccion: SeccionDeclaracion;
}

const SeccionColapsable: React.FC<SeccionColapsableProps> = ({ seccion }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set(seccion.subsecciones?.map(s => s.id) || []));

  const toggleSub = useCallback((id: string) => {
    setOpenSubs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div>
      <SeccionHeader
        titulo={seccion.titulo}
        total={seccion.total}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        nivel={1}
      />

      {isOpen && (
        <>
          {/* Direct rows */}
          {seccion.filas?.map((fila, idx) => (
            <Fila key={idx} label={fila.label} valor={fila.valor} esDestacado={fila.esDestacado} />
          ))}

          {/* Subsections */}
          {seccion.subsecciones?.map(sub => (
            <div key={sub.id}>
              <SeccionHeader
                titulo={sub.titulo}
                total={sub.total}
                isOpen={openSubs.has(sub.id)}
                onToggle={() => toggleSub(sub.id)}
                nivel={2}
              />
              {openSubs.has(sub.id) && sub.filas.map((fila, idx) => (
                <Fila
                  key={idx}
                  label={fila.label}
                  valor={fila.valor}
                  esDestacado={fila.esDestacado}
                  indent={3}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Summary Row (for totals)
// ══════════════════════════════════════════════════════════════

interface FilaResumenProps {
  label: string;
  valor: number;
  esTotal?: boolean;
}

const FilaResumen: React.FC<FilaResumenProps> = ({ label, valor, esTotal = false }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: esTotal ? '14px 16px' : '8px 16px',
    borderBottom: esTotal ? 'none' : '1px solid var(--grey-100)',
    background: esTotal ? 'var(--navy-50)' : 'transparent',
    borderRadius: esTotal ? 6 : 0,
    marginTop: esTotal ? 8 : 0,
  }}>
    <span style={{
      fontSize: esTotal ? 14 : 12,
      fontWeight: esTotal ? 700 : 500,
      color: 'var(--grey-900)',
    }}>
      {label}
    </span>
    <span style={{
      fontSize: esTotal ? 16 : 12,
      fontWeight: esTotal ? 700 : 600,
      color: valor < 0 ? 'var(--teal-600)' : 'var(--navy-900)',
      ...monoStyle,
    }}>
      {valor < 0 ? '−' : ''}{formatEur(Math.abs(valor))} €
      {esTotal && valor < 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500 }}>A devolver</span>}
      {esTotal && valor >= 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500 }}>A pagar</span>}
    </span>
  </div>
);

// ══════════════════════════════════════════════════════════════
// HELPER: Build secciones from datos
// ══════════════════════════════════════════════════════════════

function buildSecciones(datos: DatosFiscalesEjercicio): SeccionDeclaracion[] {
  const secciones: SeccionDeclaracion[] = [];
  const decl = datos.declaracionCompleta;

  // 1. Rendimientos del trabajo
  if (datos.rendimientosTrabajo !== null) {
    const trabajo = decl?.baseGeneral?.rendimientosTrabajo;
    const filas: FilaDeclaracion[] = [];
    
    if (trabajo) {
      if (trabajo.salarioBrutoAnual) {
        filas.push({ label: 'Ingresos íntegros', valor: (trabajo.salarioBrutoAnual ?? 0) + (trabajo.especieAnual ?? 0) });
      }
      if (trabajo.cotizacionSS) {
        filas.push({ label: 'Retenciones', valor: -(trabajo.cotizacionSS ?? 0), esNegativo: true });
      }
    }
    
    secciones.push({
      id: 'trabajo',
      titulo: 'Rendimientos del trabajo',
      total: datos.rendimientosTrabajo ?? 0,
      filas,
    });
  }

  // 2. Actividad económica / Autónomo
  if (datos.rendimientosActividades !== null && datos.rendimientosActividades !== 0) {
    const autonomo = decl?.baseGeneral?.rendimientosAutonomo;
    const filas: FilaDeclaracion[] = [];
    
    if (autonomo) {
      filas.push({ label: 'Facturación bruta', valor: autonomo.ingresos });
      if (autonomo.pagosFraccionadosM130 > 0 && autonomo.ingresos > 0) {
        const pct = Math.round((autonomo.pagosFraccionadosM130 / autonomo.ingresos) * 100);
        filas.push({ label: `Pagos fraccionados M130 (${pct}%)`, valor: -autonomo.pagosFraccionadosM130, esNegativo: true });
      } else if (autonomo.pagosFraccionadosM130 > 0) {
        filas.push({ label: 'Pagos fraccionados M130', valor: -autonomo.pagosFraccionadosM130, esNegativo: true });
      }
      if (autonomo.gastos) {
        filas.push({ label: 'Gastos deducibles', valor: -autonomo.gastos, esNegativo: true });
      }
    }
    
    secciones.push({
      id: 'actividades',
      titulo: 'Actividad económica',
      total: datos.rendimientosActividades ?? 0,
      filas,
    });
  }

  // 3. Inmuebles
  if (datos.rendimientosInmuebles !== null) {
    const inmuebles = decl?.baseGeneral?.rendimientosInmuebles ?? [];
    const subsecciones: SubseccionDeclaracion[] = [];
    
    inmuebles.forEach((inm, idx) => {
      const filas: FilaDeclaracion[] = [];
      filas.push({ label: 'Ingresos íntegros', valor: inm.ingresosIntegros });
      
      if (inm.gastosDeducibles > 0) {
        filas.push({ label: 'Gastos deducibles', valor: -inm.gastosDeducibles, esNegativo: true });
      }
      if (inm.amortizacion > 0) {
        filas.push({ label: 'Amortización', valor: -inm.amortizacion, esNegativo: true });
      }
      if (inm.gastosFinanciacionYReparacion && inm.gastosFinanciacionYReparacion > 0) {
        filas.push({ label: 'Gastos financieros y reparación', valor: -inm.gastosFinanciacionYReparacion, esNegativo: true });
      }
      if (inm.reduccionHabitual > 0) {
        filas.push({
          label: `Reducción ${Math.round((inm.porcentajeReduccionHabitual || 0) * 100)}%`,
          valor: -inm.reduccionHabitual,
          esNegativo: true,
        });
      }
      filas.push({
        label: 'Rendimiento neto reducido',
        valor: inm.rendimientoNetoReducido,
        esDestacado: true,
      });
      
      subsecciones.push({
        id: `inmueble-${idx}`,
        titulo: inm.alias || `Inmueble ${inm.inmuebleId}`,
        total: inm.rendimientoNetoReducido,
        filas,
      });
    });
    
    secciones.push({
      id: 'inmuebles',
      titulo: 'Inmuebles',
      total: datos.rendimientosInmuebles ?? 0,
      subsecciones,
    });
  }

  // 4. Capital mobiliario y ahorro
  if (datos.rendimientosAhorro !== null && datos.rendimientosAhorro !== 0) {
    const ahorro = decl?.baseAhorro;
    const filas: FilaDeclaracion[] = [];
    
    if (ahorro?.capitalMobiliario?.total) {
      filas.push({ label: 'Intereses y dividendos', valor: ahorro.capitalMobiliario.total });
    }
    if (ahorro?.gananciasYPerdidas) {
      const neto = (ahorro.gananciasYPerdidas.plusvalias ?? 0) - (ahorro.gananciasYPerdidas.minusvalias ?? 0);
      if (neto !== 0) {
        filas.push({ label: 'Ganancias/pérdidas patrimoniales', valor: neto });
      }
    }
    
    secciones.push({
      id: 'ahorro',
      titulo: 'Capital mobiliario y ahorro',
      total: datos.rendimientosAhorro ?? 0,
      filas,
    });
  }

  return secciones;
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

const DeclaracionCompletaPage: React.FC = () => {
  const navigate = useNavigate();
  const { año } = useParams<{ año: string }>();
  const añoNum = año ? parseInt(año, 10) : new Date().getFullYear() - 1;

  const [datos, setDatos] = useState<DatosFiscalesEjercicio | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = await resolverDatosEjercicio(añoNum);
        if (cancelled) return;
        setDatos(result);
      } catch (e) {
        console.error('[DeclaracionCompleta] Error loading data:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [añoNum]);

  // Build secciones
  const secciones = useMemo(() => {
    if (!datos) return [];
    return buildSecciones(datos);
  }, [datos]);

  // Estado badge
  const estadoBadge = useMemo(() => {
    if (!datos) return ESTADO_BADGE.pendiente;
    return ESTADO_BADGE[mapEstado(datos.estado)];
  }, [datos]);

  if (loading) {
    return (
      <div style={{ background: 'var(--grey-50)', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{
          background: 'var(--white)',
          borderBottom: '1px solid var(--grey-200)',
          padding: '16px 32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/fiscalidad')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--grey-500)',
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <ChevronLeft size={16} />
              Impuestos
            </button>
            <span style={{ color: 'var(--grey-300)' }}>/</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--grey-900)' }}>
              Declaración {añoNum}
            </span>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--navy-900)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--grey-50)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--grey-200)',
        padding: '16px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/fiscalidad')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--grey-500)',
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <ChevronLeft size={16} />
              Impuestos
            </button>
            <span style={{ color: 'var(--grey-300)' }}>/</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--grey-900)' }}>
              Declaración {añoNum}
            </span>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 5,
            background: estadoBadge.bg,
            color: estadoBadge.color,
          }}>
            {estadoBadge.texto}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 56px' }}>
        {/* Summary cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 24,
        }}>
          {/* Resultado */}
          <div style={{
            ...cardStyle,
            padding: '14px 16px',
            borderTop: `3px solid ${(datos?.resultado ?? 0) < 0 ? 'var(--teal-600)' : 'var(--navy-900)'}`,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              marginBottom: 4,
            }}>
              Resultado
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: (datos?.resultado ?? 0) < 0 ? 'var(--teal-600)' : 'var(--navy-900)',
              ...monoStyle,
            }}>
              {(datos?.resultado ?? 0) < 0 ? '−' : ''}{formatEur0(Math.abs(datos?.resultado ?? 0))} €
            </div>
          </div>

          {/* Base liquidable */}
          <div style={{ ...cardStyle, padding: '14px 16px' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              marginBottom: 4,
            }}>
              Base liquidable
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--grey-700)', ...monoStyle }}>
              {formatEur0((datos?.baseImponibleGeneral ?? 0) + (datos?.baseImponibleAhorro ?? 0))} €
            </div>
          </div>

          {/* Cuota íntegra */}
          <div style={{ ...cardStyle, padding: '14px 16px' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              marginBottom: 4,
            }}>
              Cuota íntegra
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--grey-700)', ...monoStyle }}>
              {formatEur0(datos?.cuotaIntegra ?? 0)} €
            </div>
          </div>

          {/* Retenciones */}
          <div style={{ ...cardStyle, padding: '14px 16px' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              marginBottom: 4,
            }}>
              Retenciones
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal-600)', ...monoStyle }}>
              −{formatEur0(datos?.retenciones ?? 0)} €
            </div>
          </div>
        </div>

        {/* Árbol colapsable */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {secciones.map(seccion => (
            <SeccionColapsable key={seccion.id} seccion={seccion} />
          ))}

          {/* Separator */}
          <div style={{
            borderTop: '2px dashed var(--grey-200)',
            margin: '16px 16px 0',
          }} />

          {/* Bases y cuotas */}
          <div style={{ padding: 16 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              marginBottom: 8,
            }}>
              Bases y cuotas
            </div>
            <FilaResumen label="Base imponible general" valor={datos?.baseImponibleGeneral ?? 0} />
            <FilaResumen label="Base imponible ahorro" valor={datos?.baseImponibleAhorro ?? 0} />
            <FilaResumen label="Base liquidable general" valor={datos?.resumen?.baseLiquidableGeneral ?? datos?.baseImponibleGeneral ?? 0} />
            <FilaResumen label="Cuota íntegra total" valor={datos?.cuotaIntegra ?? 0} />
            <FilaResumen label="Retenciones y pagos a cuenta" valor={-(datos?.retenciones ?? 0)} />
            <FilaResumen label="RESULTADO" valor={datos?.resultado ?? 0} esTotal />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeclaracionCompletaPage;
