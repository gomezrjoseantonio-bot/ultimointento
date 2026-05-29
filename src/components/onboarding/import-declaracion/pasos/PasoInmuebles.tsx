/**
 * PasoInmuebles.tsx · Wizard import XML V2 · paso 2 (§ 4.5).
 * Acordeón nuevos/existentes/accesorios · pre-relleno con sugerencias del XML
 * (mapeo V77). Saltable. Réplica de MOCKUP-wizard-import-paso2-v3.html.
 */

import React, { useEffect, useState } from 'react';
import { Lightbulb, X, Check, ChevronDown, Home, Building, LayoutGrid } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { useInmueblesDetectados, type InmuebleDetectado } from '../useInmueblesDetectados';
import type { InmueblePrefill } from '../../../../types/opcionesDistribucion';
import styles from '../WizardImportarDeclaracion.module.css';

type Modo = 'piso_completo' | 'por_habitaciones' | 'mixto';
type Estado = 'operativo' | 'en_reforma' | 'vacante' | 'uso_propio';
type Subtipo = NonNullable<InmueblePrefill['subtipoVivienda']>;
type TipoAlquiler = 'larga_estancia' | 'temporada' | 'turistico' | 'mixto';

interface FormInm {
  habitaciones: string;
  banos: string;
  superficie: string;
  subtipo: Subtipo;
  parkingIntegrado: string;
  trasteroIntegrado: boolean;
  alquilable: boolean;
  modo?: Modo;
  unidades: string;
  estado?: Estado;
  tipoAlquiler?: TipoAlquiler;
}

function estadoDesde(form: Record<string, FormInm>, det: InmuebleDetectado): FormInm {
  const s = det.sugerencia;
  return (
    form[det.refCatastral] ?? {
      habitaciones: s.habitaciones != null ? String(s.habitaciones) : '',
      banos: '',
      superficie: '',
      subtipo: 'piso',
      parkingIntegrado: '0',
      trasteroIntegrado: false,
      alquilable: s.esAlquilable,
      modo: s.modoExplotacion,
      unidades: s.unidadesArrendables != null ? String(s.unidadesArrendables) : '',
      estado: s.estadoOperativo,
      tipoAlquiler: undefined,
    }
  );
}

function aPrefill(rc: string, f: FormInm): InmueblePrefill {
  const parking = parseInt(f.parkingIntegrado, 10);
  const pref: InmueblePrefill = {
    refCatastral: rc,
    subtipoVivienda: f.subtipo,
    tipoActivo: 'piso',
  };
  if (f.habitaciones) pref.bedrooms = parseInt(f.habitaciones, 10);
  if (f.banos) pref.bathrooms = parseInt(f.banos, 10);
  if (f.superficie) pref.squareMeters = parseFloat(f.superficie);
  pref.anexos = {
    tieneParking: parking > 0,
    tieneTrastero: f.trasteroIntegrado,
    plazasParking: Number.isFinite(parking) ? parking : 0,
  };
  if (f.alquilable) {
    pref.alquilerPorHabitaciones = {
      activo: f.modo === 'por_habitaciones',
      numeroHabitaciones: f.unidades ? parseInt(f.unidades, 10) : undefined,
    };
    if (f.tipoAlquiler) pref.usoTipo = f.tipoAlquiler;
    pref.explotacion = {
      estadoOperativo: f.estado,
      unidadesArrendables: f.unidades ? parseInt(f.unidades, 10) : undefined,
    };
  }
  return pref;
}

const MODOS: { key: Modo; titulo: string; sub: string; icon: React.ReactNode }[] = [
  { key: 'piso_completo', titulo: 'Piso completo', sub: '1 contrato · 1 inquilino', icon: <Home size={14} /> },
  { key: 'por_habitaciones', titulo: 'Por habitaciones', sub: 'varios NIFs en XML', icon: <Building size={14} /> },
  { key: 'mixto', titulo: 'Mixto', sub: 'Combinación', icon: <LayoutGrid size={14} /> },
];

const PasoInmuebles: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const { cargando, nuevos, existentes, accesorios } = useInmueblesDetectados(s.declaraciones);
  const [smartCerrado, setSmartCerrado] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, FormInm>>({});
  const [hintsCerrados, setHintsCerrados] = useState<Record<string, boolean>>({});

  // Primera card nueva expandida por defecto.
  useEffect(() => {
    if (expandido === null && nuevos.length > 0) setExpandido(nuevos[0].refCatastral);
  }, [nuevos, expandido]);

  // Sincronizar prefill de todos los nuevos hacia opciones.
  const firmaNuevos = nuevos.map((n) => n.refCatastral).join(',');
  useEffect(() => {
    if (nuevos.length === 0) return;
    const prefills = nuevos.map((det) => aPrefill(det.refCatastral, estadoDesde(form, det)));
    s.setOpciones({ inmueblesPrefill: prefills });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaNuevos, form]);

  const actualizar = (rc: string, det: InmuebleDetectado, patch: Partial<FormInm>) => {
    setForm((prev) => ({ ...prev, [rc]: { ...estadoDesde(prev, det), ...patch } }));
  };

  const hintCerrado = (rc: string, campo: string) => hintsCerrados[`${rc}:${campo}`];
  const cerrarHint = (rc: string, campo: string) =>
    setHintsCerrados((prev) => ({ ...prev, [`${rc}:${campo}`]: true }));

  if (cargando) {
    return (
      <>
        <div className={styles.stepTitle}>
          <span className={styles.stepTitleNum}>02</span> Configurar inmuebles detectados
        </div>
        <div className={styles.stepSub}>Analizando inmuebles…</div>
      </>
    );
  }

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>02</span> Configurar inmuebles detectados
      </div>
      <div className={styles.stepSub}>
        El XML aporta datos catastrales y de adquisición · faltan habitaciones, baños y modo de
        explotación. ATLAS los necesita para configurar bien tu cartera. Saltable · podrás
        completarlo desde Inmuebles.
      </div>

      {!smartCerrado && (
        <div className={styles.smart}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>ATLAS infirió valores donde pudo · </strong>
            los campos en dorado son sugerencias · puedes editarlos o cerrar cada sugerencia que no
            aplique.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}

      {nuevos.length > 0 && (
        <>
          <div className={styles.secTitle}>
            Inmuebles nuevos · completar campos críticos <span className={styles.count}>{nuevos.length}</span>
          </div>
          {nuevos.map((det) => {
            const rc = det.refCatastral;
            const f = estadoDesde(form, det);
            const abierto = expandido === rc;
            return (
              <div key={rc} className={`${styles.inmCard} ${abierto ? styles.expanded : ''}`}>
                <div
                  className={styles.inmHead}
                  onClick={() => setExpandido(abierto ? null : rc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setExpandido(abierto ? null : rc);
                  }}
                >
                  <div className={styles.inmId}>
                    <div className={styles.inmAlias}>{det.alias}</div>
                    <div className={styles.inmRc}>RC · {det.refCatastral}</div>
                  </div>
                  <div className={styles.inmBadges}>
                    <span className={`${styles.badge} ${styles.badgeNuevo}`}>Nuevo</span>
                    <span className={`${styles.badge} ${f.habitaciones ? styles.badgeCompleto : styles.badgeIncompleto}`}>
                      {f.habitaciones ? 'Completo' : 'Incompleto'}
                    </span>
                  </div>
                  <div className={styles.inmChevron}>
                    <ChevronDown size={14} />
                  </div>
                </div>

                {abierto && (
                  <div className={styles.inmBody}>
                    <div className={styles.inmSubSection}>
                      <div className={styles.inmSubTitle}>Características físicas</div>
                      <div className={styles.fldGrid3}>
                        <div className={styles.fld}>
                          <label className={styles.fldLab}>
                            Habitaciones <span className={styles.req}>*</span>
                          </label>
                          <input
                            className={`${styles.inp} ${styles.mono} ${det.sugerencia.habitaciones != null && !hintCerrado(rc, 'hab') ? styles.withSuggestion : ''}`}
                            value={f.habitaciones}
                            inputMode="numeric"
                            onChange={(e) => actualizar(rc, det, { habitaciones: e.target.value.replace(/\D/g, '') })}
                          />
                          {det.sugerencia.habitaciones != null && !hintCerrado(rc, 'hab') && (
                            <div className={styles.fldHintInline}>
                              <Lightbulb className={styles.hintIcon} size={10} />
                              Sugerido {det.sugerencia.habitaciones} · NIFs en XML {det.ejercicioBase}
                              <button type="button" className={styles.hintClose} aria-label="Cerrar sugerencia" onClick={() => cerrarHint(rc, 'hab')}>
                                <X size={9} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={styles.fld}>
                          <label className={styles.fldLab}>
                            Baños <span className={styles.req}>*</span>
                          </label>
                          <input
                            className={`${styles.inp} ${styles.mono}`}
                            placeholder="0"
                            value={f.banos}
                            inputMode="numeric"
                            onChange={(e) => actualizar(rc, det, { banos: e.target.value.replace(/\D/g, '') })}
                          />
                          <div className={styles.fldHint}>No detectable en XML</div>
                        </div>
                        <div className={styles.fld}>
                          <label className={styles.fldLab}>
                            Superficie m² <span className={styles.fldOptTag}>opcional</span>
                          </label>
                          <input
                            className={`${styles.inp} ${styles.mono}`}
                            placeholder="0"
                            value={f.superficie}
                            inputMode="decimal"
                            onChange={(e) => actualizar(rc, det, { superficie: e.target.value.replace(/[^\d.]/g, '') })}
                          />
                        </div>
                        <div className={styles.fld}>
                          <label className={styles.fldLab}>
                            Tipo <span className={styles.req}>*</span>
                          </label>
                          <select
                            className={`${styles.inp} ${!hintCerrado(rc, 'tipo') ? styles.withSuggestion : ''}`}
                            value={f.subtipo}
                            onChange={(e) => actualizar(rc, det, { subtipo: e.target.value as Subtipo })}
                          >
                            <option value="piso">Piso</option>
                            <option value="casa">Casa</option>
                            <option value="chalet">Chalet</option>
                            <option value="estudio">Estudio</option>
                            <option value="edificio">Edificio</option>
                            <option value="otro">Otro</option>
                          </select>
                          {!hintCerrado(rc, 'tipo') && (
                            <div className={styles.fldHintInline}>
                              <Lightbulb className={styles.hintIcon} size={10} />
                              Sugerido por defecto
                              <button type="button" className={styles.hintClose} aria-label="Cerrar sugerencia" onClick={() => cerrarHint(rc, 'tipo')}>
                                <X size={9} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={styles.fld}>
                          <label className={styles.fldLab}>
                            Parking integrado <span className={styles.fldOptTag}>opcional</span>
                          </label>
                          <input
                            className={`${styles.inp} ${styles.mono}`}
                            value={f.parkingIntegrado}
                            inputMode="numeric"
                            onChange={(e) => actualizar(rc, det, { parkingIntegrado: e.target.value.replace(/\D/g, '') || '0' })}
                          />
                        </div>
                        <div className={styles.fld}>
                          <label className={styles.fldLab}>
                            Trastero integrado <span className={styles.fldOptTag}>opcional</span>
                          </label>
                          <div
                            className={`${styles.chkItem} ${f.trasteroIntegrado ? styles.checked : ''}`}
                            onClick={() => actualizar(rc, det, { trasteroIntegrado: !f.trasteroIntegrado })}
                            role="checkbox"
                            aria-checked={f.trasteroIntegrado}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') actualizar(rc, det, { trasteroIntegrado: !f.trasteroIntegrado });
                            }}
                          >
                            <div className={styles.chkBox}>{f.trasteroIntegrado && <Check size={11} strokeWidth={3} />}</div>
                            <span className={styles.chkLabel}>Sí, tiene</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`${styles.toggleRow} ${f.alquilable ? styles.on : ''}`}
                      onClick={() => actualizar(rc, det, { alquilable: !f.alquilable })}
                      role="switch"
                      aria-checked={f.alquilable}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') actualizar(rc, det, { alquilable: !f.alquilable });
                      }}
                    >
                      <div className={styles.toggleInfo}>
                        <div className={styles.toggleLab}>Inmueble alquilable</div>
                        <div className={styles.toggleSub}>Activa configuración de explotación</div>
                      </div>
                      <div className={`${styles.toggleSwitch} ${f.alquilable ? styles.on : ''}`}>
                        <div className={styles.toggleKnob} />
                      </div>
                    </div>

                    {f.alquilable && (
                      <div className={styles.inmSubSection}>
                        <div className={styles.inmSubTitle}>Configuración de explotación</div>
                        <label className={styles.fldLab} style={{ marginBottom: 6 }}>
                          Modo de explotación <span className={styles.req}>*</span>
                        </label>
                        <div className={styles.rcardGrid}>
                          {MODOS.map((m) => {
                            const sel = f.modo === m.key;
                            const sugerido = det.sugerencia.modoExplotacion === m.key;
                            return (
                              <div
                                key={m.key}
                                className={`${styles.rcard} ${sel ? styles.selected : ''}`}
                                onClick={() => actualizar(rc, det, { modo: m.key })}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') actualizar(rc, det, { modo: m.key });
                                }}
                              >
                                {sugerido && <span className={styles.rcardSuggTag}>sugerido</span>}
                                <div className={styles.rcardIcon}>{m.icon}</div>
                                <div className={styles.rcardTitle}>{m.titulo}</div>
                                <div className={styles.rcardSub}>{m.sub}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className={styles.fldGrid3}>
                          <div className={styles.fld}>
                            <label className={styles.fldLab}>
                              Unidades arrendables <span className={styles.req}>*</span>
                            </label>
                            <input
                              className={`${styles.inp} ${styles.mono} ${det.sugerencia.unidadesArrendables != null && !hintCerrado(rc, 'uni') ? styles.withSuggestion : ''}`}
                              value={f.unidades}
                              inputMode="numeric"
                              onChange={(e) => actualizar(rc, det, { unidades: e.target.value.replace(/\D/g, '') })}
                            />
                            {det.sugerencia.unidadesArrendables != null && !hintCerrado(rc, 'uni') && (
                              <div className={styles.fldHintInline}>
                                <Lightbulb className={styles.hintIcon} size={10} />
                                Sugerido {det.sugerencia.unidadesArrendables} · NIFs detectados
                                <button type="button" className={styles.hintClose} aria-label="Cerrar sugerencia" onClick={() => cerrarHint(rc, 'uni')}>
                                  <X size={9} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className={styles.fld}>
                            <label className={styles.fldLab}>
                              Estado <span className={styles.req}>*</span>
                            </label>
                            <select
                              className={`${styles.inp} ${det.sugerencia.estadoOperativo && !hintCerrado(rc, 'est') ? styles.withSuggestion : ''}`}
                              value={f.estado ?? ''}
                              onChange={(e) => actualizar(rc, det, { estado: (e.target.value || undefined) as Estado })}
                            >
                              <option value="">Selecciona…</option>
                              <option value="operativo">Operativo</option>
                              <option value="en_reforma">En reforma</option>
                              <option value="vacante">Vacante</option>
                              <option value="uso_propio">Uso propio</option>
                            </select>
                            {det.sugerencia.estadoOperativo && !hintCerrado(rc, 'est') && (
                              <div className={styles.fldHintInline}>
                                <Lightbulb className={styles.hintIcon} size={10} />
                                Días arrendados {det.ejercicioBase}
                                <button type="button" className={styles.hintClose} aria-label="Cerrar sugerencia" onClick={() => cerrarHint(rc, 'est')}>
                                  <X size={9} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className={styles.fld}>
                            <label className={styles.fldLab}>
                              Tipo alquiler dominante <span className={styles.fldOptTag}>opcional</span>
                            </label>
                            <select
                              className={styles.inp}
                              value={f.tipoAlquiler ?? ''}
                              onChange={(e) => actualizar(rc, det, { tipoAlquiler: (e.target.value || undefined) as TipoAlquiler })}
                            >
                              <option value="">Selecciona…</option>
                              <option value="larga_estancia">Larga estancia</option>
                              <option value="temporada">Temporada</option>
                              <option value="turistico">Turístico / vacacional</option>
                              <option value="mixto">Mixto</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {existentes.length > 0 && (
        <>
          <div className={styles.secTitle}>
            Inmuebles existentes · se enriquecerán <span className={styles.count}>{existentes.length}</span>
          </div>
          {existentes.map((det) => (
            <div key={det.refCatastral} className={styles.compactRow}>
              <div className={styles.inmId}>
                <div className={styles.inmAlias}>{det.alias}</div>
                <div className={styles.inmRc}>RC · {det.refCatastral}</div>
              </div>
              <span className={`${styles.badge} ${styles.badgeEnriquecer}`}>Enriquecer</span>
            </div>
          ))}
        </>
      )}

      {accesorios.length > 0 && (
        <>
          <div className={styles.secTitle}>
            Accesorios detectados <span className={styles.count}>{accesorios.length}</span>
          </div>
          {accesorios.map((det) => (
            <div key={det.refCatastral} className={styles.compactRow}>
              <div className={styles.inmId}>
                <div className={styles.inmAlias}>{det.alias}</div>
                <div className={styles.inmRc}>
                  RC · {det.refCatastral}
                  {det.vinculadoA ? ` · vinculado a ${det.vinculadoA}` : ''}
                </div>
              </div>
              <span className={`${styles.badge} ${styles.badgeAccesorio}`}>Accesorio</span>
            </div>
          ))}
        </>
      )}

      {nuevos.length === 0 && existentes.length === 0 && accesorios.length === 0 && (
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>No se detectaron inmuebles en los XMLs subidos</div>
          <div className={styles.skipSub}>Puedes continuar al siguiente paso.</div>
        </div>
      )}
    </>
  );
};

export default PasoInmuebles;
