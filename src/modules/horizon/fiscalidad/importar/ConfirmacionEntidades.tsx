import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type {
  OpcionesEjecucion,
  ResumenEjecucion,
  ResultadoAnalisis,
} from '../../../../services/declaracionOnboardingService';
import {
  describirDiferencia,
  describirResumenAcciones,
  ejecutarImportacion,
} from '../../../../services/declaracionOnboardingService';

interface Props {
  resultado: ResultadoAnalisis;
  onComplete: () => void;
  onCancel: () => void;
}

const sectionStyle = (color: string, active: boolean): React.CSSProperties => ({
  border: `1px solid ${color}33`,
  borderRadius: 12,
  overflow: 'hidden',
  marginBottom: 12,
  opacity: active ? 1 : 0.58,
  background: '#fff',
});

const money = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

function SeccionEntidades({
  titulo,
  icono,
  color,
  activo,
  onToggle,
  children,
}: {
  titulo: string;
  icono: string;
  color: string;
  activo: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionStyle(color, activo)}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: `${color}12`,
        }}
      >
        <strong style={{ color: 'var(--atlas-navy-1)' }}>{icono} {titulo}</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={activo} onChange={(event) => onToggle(event.target.checked)} />
          Incluir
        </label>
      </div>
      <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>{children}</div>
    </div>
  );
}

export default function ConfirmacionEntidades({ resultado, onComplete, onCancel }: Props) {
  const [ejecutando, setEjecutando] = useState(false);
  const [resumen, setResumen] = useState<ResumenEjecucion | null>(null);
  const [opciones, setOpciones] = useState<OpcionesEjecucion>({
    crearInmueblesNuevos: true,
    actualizarInmueblesExistentes: true,
    crearPrestamos: true,
    crearContratos: true,
    importarArrastres: true,
    guardarDeclaracion: true,
    guardarDatosPersonales: true,
  });

  const resumenAcciones = useMemo(() => describirResumenAcciones(resultado), [resultado]);
  const nuevosPrestamos = resultado.prestamos.filter((item) => !item.yaExisteEnAtlas);
  const nuevosContratos = resultado.contratos.filter((item) => !item.yaExisteEnAtlas);
  const nuevasActividades = resultado.actividades.filter((item) => !item.yaExisteEnAtlas);

  const ejecutar = async (override?: Partial<OpcionesEjecucion>) => {
    setEjecutando(true);
    try {
      const respuesta = await ejecutarImportacion(resultado, { ...opciones, ...override });
      setResumen(respuesta);
      if (respuesta.exito) {
        toast.success('Importación completada');
        window.setTimeout(onComplete, 1200);
      } else {
        toast.error('La importación terminó con incidencias');
      }
    } finally {
      setEjecutando(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ padding: 16, borderRadius: 12, background: 'var(--hz-neutral-100)' }}>
        <h3 style={{ margin: 0, color: 'var(--atlas-navy-1)' }}>
          Declaración IRPF {resultado.ejercicio} — entidades detectadas
        </h3>
        <p style={{ margin: '8px 0 0', color: 'var(--hz-neutral-700)' }}>
          Hemos detectado {resultado.inmuebles.nuevos.length + resultado.inmuebles.coinciden.length + resultado.inmuebles.actualizar.length} inmuebles,
          {' '}{resultado.prestamos.length} préstamos potenciales y {resultado.resumen.totalArrastres} arrastres fiscales.
        </p>
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: 'var(--hz-neutral-800)' }}>
          {resumenAcciones.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>

      {resultado.perfil.esNuevo || resultado.perfil.diferencias.length > 0 ? (
        <SeccionEntidades
          titulo={resultado.perfil.esNuevo ? 'Perfil personal nuevo' : 'Perfil personal con diferencias'}
          icono="🪪"
          color="#185FA5"
          activo={opciones.guardarDeclaracion}
          onToggle={(value) => setOpciones((prev) => ({ ...prev, guardarDeclaracion: value }))}
        >
          <div><strong>{resultado.perfil.nombre || 'Sin nombre'}</strong> · {resultado.perfil.nif || 'Sin NIF'}</div>
          <div style={{ fontSize: 13, color: 'var(--hz-neutral-700)' }}>
            {resultado.perfil.comunidadAutonoma || 'Sin comunidad autónoma'} · {resultado.perfil.estadoCivil || 'Sin estado civil'}
          </div>
          {resultado.perfil.diferencias.map((diff) => (
            <div key={diff.campo} style={{ fontSize: 13 }}>{describirDiferencia(diff)}</div>
          ))}
        </SeccionEntidades>
      ) : null}

      {resultado.inmuebles.nuevos.length > 0 && (
        <SeccionEntidades
          titulo={`${resultado.inmuebles.nuevos.length} inmuebles nuevos`}
          icono="🏠"
          color="#0F6E56"
          activo={opciones.crearInmueblesNuevos}
          onToggle={(value) => setOpciones((prev) => ({ ...prev, crearInmueblesNuevos: value }))}
        >
          {resultado.inmuebles.nuevos.map((inmueble) => (
            <div key={inmueble.datos.referenciaCatastral} style={{ display: 'grid', gap: 4 }}>
              <div>
                <strong>{inmueble.datos.direccion || 'Sin dirección'}</strong>
                <span style={{ color: 'var(--hz-neutral-700)' }}> — {inmueble.datos.referenciaCatastral}</span>
                {inmueble.esAccesorio && <span style={{ color: 'var(--hz-neutral-700)' }}> (accesorio)</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--hz-neutral-700)' }}>
                Datos disponibles: {inmueble.camposRellenados.join(', ')}
              </div>
              <div style={{ fontSize: 13, color: '#854F0B' }}>
                Pendiente de completar: {inmueble.camposPendientes.join(', ')}
              </div>
            </div>
          ))}
        </SeccionEntidades>
      )}

      {resultado.inmuebles.actualizar.length > 0 && (
        <SeccionEntidades
          titulo={`${resultado.inmuebles.actualizar.length} inmuebles con diferencias`}
          icono="⚠️"
          color="#854F0B"
          activo={opciones.actualizarInmueblesExistentes}
          onToggle={(value) => setOpciones((prev) => ({ ...prev, actualizarInmueblesExistentes: value }))}
        >
          {resultado.inmuebles.actualizar.map((inmueble) => (
            <div key={inmueble.referenciaCatastral} style={{ display: 'grid', gap: 4 }}>
              <strong>{inmueble.direccion}</strong>
              {inmueble.diferencias.map((diff) => (
                <div key={`${inmueble.referenciaCatastral}-${diff.campo}`} style={{ fontSize: 13 }}>
                  {describirDiferencia(diff)}
                </div>
              ))}
            </div>
          ))}
        </SeccionEntidades>
      )}

      {resultado.inmuebles.coinciden.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: '#E1F5EE' }}>
          ✅ {resultado.inmuebles.coinciden.length} inmuebles ya coinciden con ATLAS.
        </div>
      )}

      {resultado.inmuebles.soloEnAtlas.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FAEEDA', display: 'grid', gap: 6 }}>
          <strong>❓ Inmuebles en ATLAS que no aparecen en la declaración</strong>
          {resultado.inmuebles.soloEnAtlas.map((inmueble) => (
            <div key={inmueble.inmuebleIdExistente} style={{ fontSize: 13 }}>
              {inmueble.direccion} — {inmueble.hipotesis === 'vendido' ? 'Probablemente vendido' : 'Verificar manualmente'}
            </div>
          ))}
        </div>
      )}

      {nuevosPrestamos.length > 0 && (
        <SeccionEntidades
          titulo={`${nuevosPrestamos.length} préstamos detectados`}
          icono="🏦"
          color="#185FA5"
          activo={opciones.crearPrestamos}
          onToggle={(value) => setOpciones((prev) => ({ ...prev, crearPrestamos: value }))}
        >
          {nuevosPrestamos.map((prestamo) => (
            <div key={prestamo.inmuebleRef}>
              <strong>{prestamo.direccion}</strong> — intereses declarados {money(prestamo.interesesAnuales)} / año
              <div style={{ fontSize: 13, color: 'var(--hz-neutral-700)' }}>
                Se creará como préstamo parcial para completar después el principal, el plazo y el banco.
              </div>
            </div>
          ))}
        </SeccionEntidades>
      )}

      {nuevosContratos.length > 0 && (
        <SeccionEntidades
          titulo={`${nuevosContratos.length} contratos detectados`}
          icono="🧾"
          color="#534AB7"
          activo={opciones.crearContratos}
          onToggle={(value) => setOpciones((prev) => ({ ...prev, crearContratos: value }))}
        >
          {nuevosContratos.map((contrato) => (
            <div key={`${contrato.inmuebleRef}-${contrato.nifArrendatario}`}>
              <strong>{contrato.direccion}</strong> — {contrato.nifArrendatario || 'Sin NIF'}
              <div style={{ fontSize: 13, color: 'var(--hz-neutral-700)' }}>
                {contrato.diasArrendado} días arrendado · ingresos {money(contrato.ingresosAnuales)}
              </div>
            </div>
          ))}
        </SeccionEntidades>
      )}

      {nuevasActividades.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: '#EEF2FF', display: 'grid', gap: 6 }}>
          <strong>💼 Actividades detectadas</strong>
          {nuevasActividades.map((actividad) => (
            <div key={`${actividad.epigrafeIAE}-${actividad.tipoActividad}`} style={{ fontSize: 13 }}>
              {actividad.tipoActividad} · epígrafe {actividad.epigrafeIAE} · ingresos {money(actividad.ingresos)} · gastos {money(actividad.gastos)}
            </div>
          ))}
        </div>
      )}

      {(resultado.arrastres.gastos0105_0106.length > 0 || resultado.arrastres.perdidasAhorro.length > 0) && (
        <SeccionEntidades
          titulo="Arrastres fiscales"
          icono="📋"
          color="#534AB7"
          activo={opciones.importarArrastres}
          onToggle={(value) => setOpciones((prev) => ({ ...prev, importarArrastres: value }))}
        >
          {resultado.arrastres.gastos0105_0106.map((item, index) => (
            <div key={`gasto-${item.inmuebleRef}-${index}`}>
              Gastos 0105/0106 {item.inmuebleRef}: generado {money(item.importeGenerado)} · pendiente {money(item.importePendiente)}
            </div>
          ))}
          {resultado.arrastres.perdidasAhorro.map((item, index) => (
            <div key={`perdida-${item.ejercicioOrigen}-${index}`}>
              Pérdidas {item.ejercicioOrigen}: pendiente {money(item.importePendiente)} · caduca {item.caducaEjercicio}
            </div>
          ))}
        </SeccionEntidades>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={ejecutando}
          style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: 10, padding: '0.8rem 1rem', background: 'white', cursor: 'pointer' }}
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={() => ejecutar({
            crearInmueblesNuevos: false,
            actualizarInmueblesExistentes: false,
            crearPrestamos: false,
            crearContratos: false,
            importarArrastres: true,
            guardarDeclaracion: true,
          })}
          disabled={ejecutando}
          style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: 10, padding: '0.8rem 1rem', background: 'white', cursor: 'pointer' }}
        >
          Solo guardar declaración
        </button>
        <button
          type="button"
          onClick={() => ejecutar()}
          disabled={ejecutando}
          style={{ border: 'none', borderRadius: 10, padding: '0.8rem 1rem', background: '#0F6E56', color: 'white', cursor: 'pointer', fontWeight: 700 }}
        >
          {ejecutando ? 'Creando…' : `Crear todo (${resultado.resumen.totalEntidadesNuevas})`}
        </button>
      </div>

      {resumen && (
        <div style={{ padding: 16, borderRadius: 12, background: resumen.exito ? '#E1F5EE' : '#FCEBEB', display: 'grid', gap: 4 }}>
          <strong>{resumen.exito ? '✅ Importación completada' : '⚠️ Importación con incidencias'}</strong>
          {resumen.inmueblesCreados > 0 && <div>{resumen.inmueblesCreados} inmuebles creados.</div>}
          {resumen.inmueblesActualizados > 0 && <div>{resumen.inmueblesActualizados} inmuebles actualizados.</div>}
          {resumen.prestamosCreados > 0 && <div>{resumen.prestamosCreados} préstamos creados.</div>}
          {resumen.contratosCreados > 0 && <div>{resumen.contratosCreados} contratos creados.</div>}
          {resumen.arrastresImportados > 0 && <div>{resumen.arrastresImportados} arrastres importados.</div>}
          {resumen.declaracionGuardada && <div>Declaración guardada en ejercicios fiscales.</div>}
          {resumen.errores.map((error) => (
            <div key={error} style={{ color: '#A32D2D', fontSize: 13 }}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
