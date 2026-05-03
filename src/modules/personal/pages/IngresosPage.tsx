import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import {
  CardV5,
  MoneyValue,
  EmptyState,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { PersonalOutletContext } from '../PersonalContext';
import {
  computeAutonomoNetoPorMes,
  computeNominaNetoPorMes,
} from '../helpers';

const MES_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const IngresosPage: React.FC = () => {
  const navigate = useNavigate();
  const { nominas, autonomos, otrosIngresos } = useOutletContext<PersonalOutletContext>();
  // Mes en curso · spec v1.1 regla 4 (calendario REAL · no plano).
  const mesActual = new Date().getMonth() + 1;
  const mesLabel = MES_LABELS[mesActual - 1];

  const total =
    nominas.length + autonomos.length + (otrosIngresos as unknown[]).length;

  if (total === 0) {
    return (
      <EmptyState
        icon={<Icons.Personal size={20} />}
        title="Sin fuentes de ingreso"
        sub="Da de alta tu nómina, actividad como autónomo o cualquier otro ingreso del hogar para ver el desglose mensual y anual."
        ctaLabel="+ ir a Gestión Personal"
        onCtaClick={() => navigate('/gestion/personal')}
      />
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/gestion/personal/nueva-nomina')}
          style={btnPrimary}
        >
          <Icons.Plus size={14} strokeWidth={2} />
          Nueva nómina
        </button>
        <button
          type="button"
          onClick={() => navigate('/gestion/personal/nuevo-autonomo')}
          style={btnGhost}
        >
          <Icons.Plus size={14} strokeWidth={2} />
          Autónomo
        </button>
        <button
          type="button"
          onClick={() => navigate('/gestion/personal/otros-ingresos')}
          style={btnGhost}
        >
          <Icons.Plus size={14} strokeWidth={2} />
          Otros
        </button>
      </div>

      {nominas.length > 0 && (
        <CardV5 accent="brand" style={{ marginBottom: 14 }}>
          <CardV5.Title>Nóminas · {nominas.length}</CardV5.Title>
          <CardV5.Subtitle>asalariados del hogar · proyección mensual y anual</CardV5.Subtitle>
          <CardV5.Body>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Empresa / Nombre</th>
                  <th style={thStyle}>Titular</th>
                  <th style={thStyle}>Distribución</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Neto líquido anual · suma de los 12 netos mensuales (incluye paga extra, variable y bonus, deducidas SS, IRPF y aportación PP)">
                    Neto anual
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Líquido del mes en curso · lo que llega a la cuenta. Paga extra entera en su mes · variable/bonus en su mes pagadero">
                    Neto · {mesLabel}
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {nominas.map((n, index) => {
                  // Distribución mensual neta · una sola pasada por fila.
                  const dist = computeNominaNetoPorMes(n);
                  const netoAnual = dist.reduce((s, v) => s + v, 0);
                  const netoMes = dist[mesActual - 1] ?? 0;
                  const editar = () => {
                    if (n.id != null) navigate(`/gestion/personal/nueva-nomina?id=${n.id}`);
                    else showToastV5('Nómina sin id · no se puede editar');
                  };
                  return (
                    <tr
                      key={n.id ?? `${n.empresa?.nombre ?? 'sin-empresa'}-${n.nombre}-${n.titular}-${index}`}
                      style={{ cursor: 'pointer' }}
                      title="Editar nómina"
                      onClick={editar}
                    >
                      <td style={tdStyle}>
                        <strong>{n.empresa?.nombre ?? n.nombre}</strong>
                      </td>
                      <td style={tdStyle}>{n.titular === 'yo' ? 'Titular' : 'Pareja'}</td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'var(--atlas-v5-font-mono-tech)' }}>
                          {n.distribucion.tipo} · {n.distribucion.meses} pagas
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <MoneyValue value={netoAnual} decimals={0} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <MoneyValue value={netoMes} decimals={0} tone={netoMes >= 0 ? 'pos' : 'neg'} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Pill variant={n.activa ? 'pos' : 'gris'} asTag>
                          {n.activa ? 'Activa' : 'Inactiva'}
                        </Pill>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          aria-label="Editar nómina"
                          onClick={(e) => {
                            e.stopPropagation();
                            editar();
                          }}
                          style={iconBtn}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardV5.Body>
        </CardV5>
      )}

      {autonomos.length > 0 && (
        <CardV5 accent="gold" style={{ marginBottom: 14 }}>
          <CardV5.Title>Autónomos · {autonomos.length}</CardV5.Title>
          <CardV5.Subtitle>actividades por cuenta propia · neto líquido (ingresos − gastos − cuota RETA)</CardV5.Subtitle>
          <CardV5.Body>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Actividad</th>
                  <th style={thStyle}>Titular</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Neto anual estimado · ingresos − gastos − cuota RETA, sumado por los 12 meses">
                    Neto anual
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Neto del mes en curso · ingresos − gastos − cuota RETA. Respeta meses activos de fuentesIngreso">
                    Neto · {mesLabel}
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {autonomos.map((a, index) => {
                  // Distribución mensual · una sola pasada por fila.
                  const dist = computeAutonomoNetoPorMes(a);
                  const netoAnual = dist.reduce((s, v) => s + v, 0);
                  const netoMes = dist[mesActual - 1] ?? 0;
                  const editar = () => {
                    if (a.id != null) navigate(`/gestion/personal/nuevo-autonomo?id=${a.id}`);
                    else showToastV5('Autónomo sin id · no se puede editar');
                  };
                  return (
                    <tr
                      key={a.id ?? `${a.nombre ?? 'sin-nombre'}-${a.titular ?? 'sin-titular'}-${index}`}
                      style={{ cursor: 'pointer' }}
                      title="Editar actividad de autónomo"
                      onClick={editar}
                    >
                      <td style={tdStyle}>
                        <strong>{a.nombre ?? `Actividad #${a.id}`}</strong>
                      </td>
                      <td style={tdStyle}>{a.titular === 'yo' ? 'Titular' : 'Pareja'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {netoAnual !== 0 ? (
                          <MoneyValue value={netoAnual} decimals={0} tone={netoAnual >= 0 ? undefined : 'neg'} />
                        ) : (
                          <span style={{ color: 'var(--atlas-v5-ink-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {netoMes !== 0 ? (
                          <MoneyValue value={netoMes} decimals={0} tone={netoMes >= 0 ? 'pos' : 'neg'} />
                        ) : (
                          <span style={{ color: 'var(--atlas-v5-ink-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Pill variant={a.activo ? 'pos' : 'gris'} asTag>
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </Pill>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          aria-label="Editar autónomo"
                          onClick={(e) => {
                            e.stopPropagation();
                            editar();
                          }}
                          style={iconBtn}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardV5.Body>
        </CardV5>
      )}

      {otrosIngresos.length > 0 && (
        <CardV5 accent="neutral">
          <CardV5.Title>Otros ingresos · {otrosIngresos.length}</CardV5.Title>
          <CardV5.Subtitle>
            pensiones · subsidios · trabajos esporádicos · ingresos sin contraparte de activo
          </CardV5.Subtitle>
          <CardV5.Body>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Titular</th>
                  <th style={thStyle}>Frecuencia</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Importe líquido por cobro · lo que llega al banco">
                    Neto / cobro
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {otrosIngresos.map((o, index) => {
                  const titular = o.titularidad === 'pareja' ? 'pareja' : 'yo';
                  return (
                    <tr
                      key={o.id ?? `${o.nombre ?? 'sin-nombre'}-${index}`}
                      style={{ cursor: 'pointer' }}
                      title="Editar otro ingreso"
                      onClick={() => navigate(`/gestion/personal/otros-ingresos?titular=${titular}`)}
                    >
                      <td style={tdStyle}>
                        <strong>{o.nombre ?? `Ingreso #${o.id}`}</strong>
                      </td>
                      <td style={tdStyle}>{o.tipo}</td>
                      <td style={tdStyle}>
                        {o.titularidad === 'pareja' ? 'Pareja' : o.titularidad === 'ambos' ? 'Ambos' : 'Titular'}
                      </td>
                      <td style={tdStyle}>{o.frecuencia}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <MoneyValue value={o.importe} decimals={0} tone="pos" />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Pill variant={o.activo ? 'pos' : 'gris'} asTag>
                          {o.activo ? 'Activo' : 'Inactivo'}
                        </Pill>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          aria-label="Editar otro ingreso"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/gestion/personal/otros-ingresos?titular=${titular}`);
                          }}
                          style={iconBtn}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardV5.Body>
        </CardV5>
      )}
    </>
  );
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '8px 13px',
  borderRadius: 'var(--atlas-v5-radius-sm)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid transparent',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-white)',
  borderColor: 'var(--atlas-v5-gold)',
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-2)',
  borderColor: 'var(--atlas-v5-line)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  fontFamily: 'var(--atlas-v5-font-ui)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-v5-ink-4)',
  borderBottom: '1px solid var(--atlas-v5-line)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 13,
  color: 'var(--atlas-v5-ink-2)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 6,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-2)',
  cursor: 'pointer',
};

export default IngresosPage;
