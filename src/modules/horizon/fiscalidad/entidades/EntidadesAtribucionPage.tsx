import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import {
  EntidadAtribucionRentas,
  EntidadEjercicio,
} from '../../../../services/db';
import {
  getEntidades,
  guardarEntidad,
} from '../../../../services/entidadAtribucionService';
import toast from 'react-hot-toast';

const formatEuro = (value: number) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
}).format(value);

const currentYear = new Date().getFullYear();

const emptyEntidad = (): Omit<EntidadAtribucionRentas, 'createdAt' | 'updatedAt'> => ({
  nif: '',
  nombre: '',
  tipoEntidad: 'CB',
  porcentajeParticipacion: 0,
  tipoRenta: 'capital_inmobiliario',
  ejercicios: [
    {
      ejercicio: currentYear,
      rendimientosAtribuidos: 0,
      retencionesAtribuidas: 0,
    },
  ],
});

const cardStyle: React.CSSProperties = {
  background: 'var(--hz-card-bg)',
  border: '1px solid var(--hz-neutral-300)',
  borderRadius: '16px',
  padding: '1rem',
  boxShadow: 'var(--shadow-sm, 0 4px 14px rgba(2,30,63,0.06))',
};

const EntidadesAtribucionPage: React.FC = () => {
  const [entidades, setEntidades] = useState<EntidadAtribucionRentas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<EntidadAtribucionRentas, 'createdAt' | 'updatedAt'>>(emptyEntidad());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setEntidades(await getEntidades());
    } catch (error) {
      console.error('Error cargando entidades en atribución', error);
      toast.error('No se pudieron cargar las entidades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ejercicioPrincipal = useMemo<EntidadEjercicio>(() => (
    form.ejercicios[0] ?? { ejercicio: currentYear, rendimientosAtribuidos: 0, retencionesAtribuidas: 0 }
  ), [form.ejercicios]);

  const updateEjercicioPrincipal = (patch: Partial<EntidadEjercicio>) => {
    setForm((prev) => ({
      ...prev,
      ejercicios: [{ ...ejercicioPrincipal, ...patch }],
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await guardarEntidad(form);
      toast.success('Entidad guardada correctamente');
      setForm(emptyEntidad());
      setShowForm(false);
      await loadData();
    } catch (error) {
      console.error('Error guardando entidad', error);
      toast.error('No se pudo guardar la entidad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="Entidades en atribución de rentas"
      subtitle="CB, sociedades civiles, herencias yacentes y otras entidades con rentas atribuidas"
      primaryAction={{
        label: showForm ? 'Cerrar formulario' : '+ Añadir entidad',
        onClick: () => {
          setShowForm((prev) => !prev);
          setForm(emptyEntidad());
        },
      }}
    >
      <div style={{ display: 'grid', gap: '1rem' }}>
        {showForm && (
          <form onSubmit={handleSave} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <label>
                <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>NIF</div>
                <input
                  required
                  value={form.nif}
                  onChange={(event) => setForm((prev) => ({ ...prev, nif: event.target.value.toUpperCase() }))}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                />
              </label>
              <label>
                <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Nombre</div>
                <input
                  required
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                />
              </label>
              <label>
                <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Tipo entidad</div>
                <select
                  value={form.tipoEntidad}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipoEntidad: event.target.value as EntidadAtribucionRentas['tipoEntidad'] }))}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                >
                  <option value="CB">Comunidad de bienes</option>
                  <option value="SC">Sociedad civil</option>
                  <option value="HY">Herencia yacente</option>
                  <option value="otra">Otra</option>
                </select>
              </label>
              <label>
                <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>% participación</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.porcentajeParticipacion}
                  onChange={(event) => setForm((prev) => ({ ...prev, porcentajeParticipacion: parseFloat(event.target.value) || 0 }))}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                />
              </label>
              <label>
                <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Tipo de renta</div>
                <select
                  value={form.tipoRenta}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipoRenta: event.target.value as EntidadAtribucionRentas['tipoRenta'] }))}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                >
                  <option value="capital_inmobiliario">Capital inmobiliario</option>
                  <option value="actividad_economica">Actividad económica</option>
                  <option value="capital_mobiliario">Capital mobiliario</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: '1rem', ...cardStyle, background: 'var(--hz-neutral-100)' }}>
              <h3 style={{ marginTop: 0 }}>Datos del ejercicio</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <label>
                  <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Ejercicio</div>
                  <input
                    type="number"
                    value={ejercicioPrincipal.ejercicio}
                    onChange={(event) => updateEjercicioPrincipal({ ejercicio: parseInt(event.target.value, 10) || currentYear })}
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                  />
                </label>
                <label>
                  <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Rendimiento atribuido</div>
                  <input
                    type="number"
                    step="0.01"
                    value={ejercicioPrincipal.rendimientosAtribuidos}
                    onChange={(event) => updateEjercicioPrincipal({ rendimientosAtribuidos: parseFloat(event.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                  />
                </label>
                <label>
                  <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Retención atribuida</div>
                  <input
                    type="number"
                    step="0.01"
                    value={ejercicioPrincipal.retencionesAtribuidas}
                    onChange={(event) => updateEjercicioPrincipal({ retencionesAtribuidas: parseFloat(event.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" disabled={saving} style={{ border: 'none', borderRadius: '10px', padding: '0.8rem 1rem', background: 'var(--atlas-blue)', color: 'white', cursor: 'pointer' }}>
                {saving ? 'Guardando…' : 'Guardar entidad'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={cardStyle}>Cargando entidades…</div>
        ) : entidades.length === 0 ? (
          <div style={cardStyle}>
            Aún no hay entidades registradas. Añade CB/SC o herencias yacentes para que sus rentas y retenciones entren en el IRPF.
          </div>
        ) : (
          entidades.map((entidad) => (
            <div key={entidad.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--atlas-navy-1)' }}>{entidad.nombre}</h3>
                  <p style={{ margin: '0.35rem 0 0', color: 'var(--hz-neutral-700)' }}>
                    {entidad.nif} · {entidad.tipoEntidad} · {entidad.porcentajeParticipacion}% · {entidad.tipoRenta.replaceAll('_', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      id: entidad.id,
                      nif: entidad.nif,
                      nombre: entidad.nombre,
                      tipoEntidad: entidad.tipoEntidad,
                      porcentajeParticipacion: entidad.porcentajeParticipacion,
                      tipoRenta: entidad.tipoRenta,
                      ejercicios: entidad.ejercicios.length ? entidad.ejercicios : emptyEntidad().ejercicios,
                    });
                    setShowForm(true);
                  }}
                  style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '10px', padding: '0.55rem 0.8rem', background: 'white', cursor: 'pointer' }}
                >
                  Editar
                </button>
              </div>

              <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--hz-neutral-700)', fontSize: '0.85rem' }}>
                    <th style={{ paddingBottom: '0.55rem' }}>Ejercicio</th>
                    <th style={{ paddingBottom: '0.55rem' }}>Rendimiento atribuido</th>
                    <th style={{ paddingBottom: '0.55rem' }}>Retención</th>
                  </tr>
                </thead>
                <tbody>
                  {entidad.ejercicios.map((ejercicio) => (
                    <tr key={ejercicio.ejercicio}>
                      <td style={{ padding: '0.45rem 0' }}>{ejercicio.ejercicio}</td>
                      <td style={{ padding: '0.45rem 0' }}>{formatEuro(ejercicio.rendimientosAtribuidos)}</td>
                      <td style={{ padding: '0.45rem 0' }}>{formatEuro(ejercicio.retencionesAtribuidas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </PageLayout>
  );
};

export default EntidadesAtribucionPage;
