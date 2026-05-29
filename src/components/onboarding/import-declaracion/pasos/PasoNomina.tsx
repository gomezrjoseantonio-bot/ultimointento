/**
 * PasoNomina.tsx · Wizard import XML V2 · paso 6 (§ 4.9 · § 7.7).
 * Toggle opt-in + formulario simplificado pre-rellenado desde el XML.
 * Construye opciones.crearNominaActiva + opciones.nominaPrefill (Fase B persiste).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { sugerenciasNomina, construirNominaPrefill, type FormNomina } from '../prefill';
import { cuentasService } from '../../../../services/cuentasService';
import type { Account } from '../../../../services/db';
import styles from '../WizardImportarDeclaracion.module.css';

function fmtNum(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseNum(s: string): number {
  const limpio = s.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

const PasoNomina: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const sugeridas = useMemo(() => sugerenciasNomina(s.declaraciones), [s.declaraciones]);
  const [activar, setActivar] = useState(true);
  const [smartCerrado, setSmartCerrado] = useState(false);
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormNomina | null>(sugeridas);
  const [cuentas, setCuentas] = useState<Account[]>([]);

  useEffect(() => {
    setForm(sugeridas);
  }, [sugeridas]);

  useEffect(() => {
    let vivo = true;
    cuentasService
      .list()
      .then((cs) => vivo && setCuentas(cs))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  // Sincronizar a opciones.
  useEffect(() => {
    if (activar && form) {
      s.setOpciones({ crearNominaActiva: true, nominaPrefill: construirNominaPrefill(form) });
    } else {
      s.setOpciones({ crearNominaActiva: false, nominaPrefill: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activar, form]);

  if (!sugeridas || !form) {
    return (
      <>
        <div className={styles.stepTitle}>
          <span className={styles.stepTitleNum}>06</span> Nómina detectada en XML
        </div>
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>No se detectó nómina en los XMLs subidos</div>
          <div className={styles.skipSub}>Puedes crearla manualmente en Personal cuando quieras.</div>
        </div>
      </>
    );
  }

  const upd = (patch: Partial<FormNomina>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const cerrarHint = (k: string) => setHints((p) => ({ ...p, [k]: true }));
  const conSug = (k: string) => !hints[k];

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>06</span> Nómina detectada en XML
      </div>
      <div className={styles.stepSub}>
        Detectamos rendimientos del trabajo en {form.ejercicio}
        {form.nifEmpresa ? ` con empleador ${form.nifEmpresa}` : ''} · {fmtNum(form.brutoAnual)} € brutos.
        Puedes crear/actualizar la nómina activa en Personal para que ATLAS proyecte futuros cobros.
      </div>

      <div
        className={`${styles.toggleRow} ${activar ? styles.on : ''}`}
        onClick={() => setActivar((v) => !v)}
        role="switch"
        aria-checked={activar}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setActivar((v) => !v);
        }}
      >
        <div className={styles.toggleInfo}>
          <div className={styles.toggleLab}>Crear/actualizar nómina activa en Personal</div>
          <div className={styles.toggleSub}>
            Pre-rellenamos los campos detectables · tú ajustas los demás · puedes desactivar si no
            quieres crear nómina ahora
          </div>
        </div>
        <div className={`${styles.toggleSwitch} ${activar ? styles.on : ''}`}>
          <div className={styles.toggleKnob} />
        </div>
      </div>

      {activar && (
        <>
          <div className={styles.secTitle}>
            Pre-relleno automático
            <span className={styles.count}>{form.ejercicio}</span>
          </div>

          <div className={styles.fldGrid3} style={{ marginBottom: 14 }}>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                Empresa <span className={styles.req}>*</span>
              </label>
              <input
                className={styles.inp}
                placeholder="Pendiente · introduce nombre"
                value={form.empresaNombre}
                onChange={(e) => upd({ empresaNombre: e.target.value })}
              />
              <div className={styles.fldHint}>
                {form.nifEmpresa ? `XML solo trae NIF · ${form.nifEmpresa}` : 'No detectable en XML'}
              </div>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>NIF empresa</label>
              <input className={`${styles.inp} ${styles.mono} ${form.nifEmpresa ? styles.withSuggestion : ''}`} value={form.nifEmpresa} readOnly />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>Cuenta destino</label>
              <select
                className={styles.inp}
                value={form.cuentaAbono ?? ''}
                onChange={(e) => upd({ cuentaAbono: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">— Selecciona cuenta —</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.alias ?? c.iban ?? `Cuenta ${c.id}`}
                  </option>
                ))}
              </select>
              <div className={styles.fldHint}>XML no trae cuenta de cobro · elige</div>
            </div>
          </div>

          <div className={styles.fldGrid3} style={{ marginBottom: 14 }}>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                Bruto anual fijo <span className={styles.req}>*</span>
              </label>
              <input
                className={`${styles.inp} ${styles.mono} ${conSug('bruto') ? styles.withSuggestion : ''}`}
                value={fmtNum(form.brutoAnual)}
                onChange={(e) => upd({ brutoAnual: parseNum(e.target.value) })}
              />
              {conSug('bruto') && (
                <div className={styles.fldHintInline}>
                  <Lightbulb className={styles.hintIcon} size={10} /> Importe declarado IDII
                  <button type="button" className={styles.hintClose} aria-label="Cerrar" onClick={() => cerrarHint('bruto')}>
                    <X size={9} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                Nº pagas <span className={styles.req}>*</span>
              </label>
              <input
                className={`${styles.inp} ${styles.mono}`}
                value={form.numPagas}
                inputMode="numeric"
                onChange={(e) => upd({ numPagas: parseInt(e.target.value.replace(/\D/g, ''), 10) || 12 })}
              />
              <div className={styles.fldHint}>Default 14 · ajusta si son 12</div>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                % IRPF <span className={styles.req}>*</span>
              </label>
              <input
                className={`${styles.inp} ${styles.mono} ${conSug('irpf') ? styles.withSuggestion : ''}`}
                value={`${fmtNum(form.irpfPorcentaje)} %`}
                onChange={(e) => upd({ irpfPorcentaje: parseNum(e.target.value) })}
              />
              {conSug('irpf') && (
                <div className={styles.fldHintInline}>
                  <Lightbulb className={styles.hintIcon} size={10} /> Retenciones / bruto
                  <button type="button" className={styles.hintClose} aria-label="Cerrar" onClick={() => cerrarHint('irpf')}>
                    <X size={9} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>% SS empleado</label>
              <input
                className={`${styles.inp} ${styles.mono} ${conSug('ss') ? styles.withSuggestion : ''}`}
                value={`${fmtNum(form.ssPorcentaje)} %`}
                onChange={(e) => upd({ ssPorcentaje: parseNum(e.target.value) })}
              />
              {conSug('ss') && (
                <div className={styles.fldHintInline}>
                  <Lightbulb className={styles.hintIcon} size={10} /> Cotización / bruto
                  <button type="button" className={styles.hintClose} aria-label="Cerrar" onClick={() => cerrarHint('ss')}>
                    <X size={9} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>Día cobro</label>
              <input
                className={`${styles.inp} ${styles.mono}`}
                value={form.diaCobro}
                inputMode="numeric"
                onChange={(e) => upd({ diaCobro: Math.min(31, parseInt(e.target.value.replace(/\D/g, ''), 10) || 25) })}
              />
              <div className={styles.fldHint}>Default 25 · ajusta si distinto</div>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                Pagas extras <span className={styles.fldOptTag}>opcional</span>
              </label>
              <select className={styles.inp} disabled>
                <option>Jun + Dic (default)</option>
              </select>
            </div>
          </div>

          {form.contribucionPPEmpresaAnual > 0 && (
            <div
              className={`${styles.toggleRow} ${form.ppEmpresa ? styles.on : ''}`}
              style={{ marginBottom: 8 }}
              onClick={() => upd({ ppEmpresa: !form.ppEmpresa })}
              role="switch"
              aria-checked={form.ppEmpresa}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') upd({ ppEmpresa: !form.ppEmpresa });
              }}
            >
              <div className={styles.toggleInfo}>
                <div className={styles.toggleLab}>Plan de pensiones empresa · contribución</div>
                <div className={styles.toggleSub}>
                  Detectado {fmtNum(form.contribucionPPEmpresaAnual)} € en {form.ejercicio}
                </div>
              </div>
              <div className={`${styles.toggleSwitch} ${form.ppEmpresa ? styles.on : ''}`}>
                <div className={styles.toggleKnob} />
              </div>
            </div>
          )}

          {form.especieAnual > 0 && (
            <div
              className={`${styles.toggleRow} ${form.beneficiosEspecie ? styles.on : ''}`}
              style={{ marginBottom: 14 }}
              onClick={() => upd({ beneficiosEspecie: !form.beneficiosEspecie })}
              role="switch"
              aria-checked={form.beneficiosEspecie}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') upd({ beneficiosEspecie: !form.beneficiosEspecie });
              }}
            >
              <div className={styles.toggleInfo}>
                <div className={styles.toggleLab}>Beneficios en especie</div>
                <div className={styles.toggleSub}>
                  Detectado {fmtNum(form.especieAnual)} € en {form.ejercicio}
                </div>
              </div>
              <div className={`${styles.toggleSwitch} ${form.beneficiosEspecie ? styles.on : ''}`}>
                <div className={styles.toggleKnob} />
              </div>
            </div>
          )}
        </>
      )}

      {!smartCerrado && (
        <div className={styles.smart}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>El XML no trae el detalle de pagas extras ni la cuenta destino · </strong>
            completa esos campos para que ATLAS proyecte cada mes correctamente. Si tu sueldo ha
            cambiado desde {form.ejercicio}, ajusta el bruto.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
};

export default PasoNomina;
