import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
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
  computeAutonomoIngresoAnualEstimado,
  computeAutonomoIngresoEnMes,
  computeNominaBrutoAnual,
  computeNominaBrutoEnMes,
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
                  <th style={{ ...thStyle, textAlign: 'right' }}>Bruto anual</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Bruto devengado del mes en curso · paga extra entera en su mes · variable/bonus en su mes pagadero">
                    Bruto · {mesLabel}
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {nominas.map((n, index) => (
                  <tr
                    key={n.id ?? `${n.empresa?.nombre ?? 'sin-empresa'}-${n.nombre}-${n.titular}-${index}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => showToastV5(`Detalle nómina · ${n.nombre}`)}
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
                    <td style={{ ...tdStyle, textAlign: 'right' }} title="Bruto devengado anual real · suma de meses incluyendo paga extra, variable y bonus">
                      <MoneyValue value={computeNominaBrutoAnual(n)} decimals={0} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <MoneyValue value={computeNominaBrutoEnMes(n, mesActual)} decimals={0} tone="pos" />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Pill variant={n.activa ? 'pos' : 'gris'} asTag>
                        {n.activa ? 'Activa' : 'Inactiva'}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardV5.Body>
        </CardV5>
      )}

      {autonomos.length > 0 && (
        <CardV5 accent="gold" style={{ marginBottom: 14 }}>
          <CardV5.Title>Autónomos · {autonomos.length}</CardV5.Title>
          <CardV5.Subtitle>actividades por cuenta propia · estimación bruta</CardV5.Subtitle>
          <CardV5.Body>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Actividad</th>
                  <th style={thStyle}>Titular</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Bruto anual</th>
                  <th style={{ ...thStyle, textAlign: 'right' }} title="Bruto estimado del mes en curso · suma de fuentesIngreso cuyas meses incluyen este mes">
                    Bruto · {mesLabel}
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {autonomos.map((a, index) => {
                  const ingreso = computeAutonomoIngresoAnualEstimado(a);
                  const ingresoMes = computeAutonomoIngresoEnMes(a, mesActual);
                  const tieneEstimacion = ingreso > 0;
                  return (
                    <tr
                      key={a.id ?? `${a.nombre ?? 'sin-nombre'}-${a.titular ?? 'sin-titular'}-${index}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => showToastV5(`Detalle autónomo · ${a.nombre ?? '#' + a.id}`)}
                    >
                      <td style={tdStyle}>
                        <strong>{a.nombre ?? `Actividad #${a.id}`}</strong>
                      </td>
                      <td style={tdStyle}>{a.titular === 'yo' ? 'Titular' : 'Pareja'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {tieneEstimacion ? (
                          <MoneyValue value={ingreso} decimals={0} />
                        ) : (
                          <span style={{ color: 'var(--atlas-v5-ink-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {ingresoMes > 0 ? (
                          <MoneyValue value={ingresoMes} decimals={0} tone="pos" />
                        ) : (
                          <span style={{ color: 'var(--atlas-v5-ink-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Pill variant={a.activo ? 'pos' : 'gris'} asTag>
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardV5.Body>
        </CardV5>
      )}

      {(otrosIngresos as unknown[]).length > 0 && (
        <CardV5 accent="neutral">
          <CardV5.Title>Otros ingresos · {(otrosIngresos as unknown[]).length}</CardV5.Title>
          <CardV5.Subtitle>
            pensiones · subsidios · trabajos esporádicos · ingresos sin contraparte de activo
          </CardV5.Subtitle>
          <CardV5.Body>
            <div style={{ padding: '12px 0', color: 'var(--atlas-v5-ink-3)', fontSize: 12.5 }}>
              {(otrosIngresos as unknown[]).length} registros · detalle pendiente de
              migración del schema en sub-tarea follow-up.
            </div>
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

export default IngresosPage;
