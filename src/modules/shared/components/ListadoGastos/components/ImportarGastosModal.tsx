// Importar los gastos de un Excel/CSV (mockup v2_3 · «Importar de Excel»). Se
// sube el fichero, ATLAS reconoce las columnas por el encabezado, propone
// concepto/cuenta/periodicidad por línea y tú confirmas. Cada gasto entra como
// PREPARADO (falta el primer cobro, que se pide al activarlo). Nada bloquea la
// importación salvo no tener cuentas.

import React, { useMemo, useState } from 'react';
import { cuentaParaElMetodo } from '../../../../../services/cuentasPorMetodoPago';
import * as XLSX from 'xlsx';
import { showToastV5 } from '../../../../../design-system/v5';
import type { TipoGasto } from '../../TipoGastoSelector';
import type { Account } from '../../../../../services/db';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { crearCompromiso } from '../../../../../services/personal/compromisosRecurrentesService';
import { conceptoPorId } from '../../../../../services/conceptos/catalogoConceptos';
import { mesesToPatron } from '../utils/rejillaMeses';
import {

  autoMapColumns,
  nReconocidas,
  parseImporteEs,
  periodicidadAMeses,
  etiquetaPeriodicidad,
  type MapeoColumnas,
  type CampoGasto,
} from '../utils/importarGastos';

// Checkbox nativo tintado con el navy ATLAS · sin él, el navegador pinta su
// azul por defecto (fuera de paleta).
const checkInput: React.CSSProperties = { accentColor: 'var(--atlas-v5-brand)' };


interface ImportarGastosModalProps {
  mode: 'personal' | 'inmueble';
  inmuebleId?: number;
  accounts: Account[];
  catalog: TipoGasto[];
  onCancel: () => void;
  onImportado: (creados: number) => void;
}

interface LineaPreview {
  entra: boolean;
  conceptoRaw: string;
  proveedor: string;
  importe: number | null;
  meses: number[];
  cuentaId: number;
  cups: string;
}

const CAMPOS: Array<{ id: CampoGasto; label: string }> = [
  { id: 'concepto', label: 'Concepto' },
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'importe', label: 'Importe' },
  { id: 'periodicidad', label: 'Cada cuánto' },
  { id: 'cuenta', label: 'Cuenta de cargo' },
  { id: 'cups', label: 'CUPS o contrato' },
];

/** Casa el texto de una cuenta del Excel contra las cuentas reales (alias/últimos 4). */
function matchCuenta(texto: string, accounts: Account[]): number {
  const t = texto.toLowerCase();
  const hit = accounts.find((a) => {
    const alias = (a.alias ?? a.name ?? '').toLowerCase();
    const last4 = a.iban?.replace(/\s/g, '').slice(-4) ?? '';
    return (alias && t.includes(alias)) || (last4 && t.includes(last4));
  });
  return hit?.id ?? accounts[0]?.id ?? 0;
}

/** Casa el concepto del Excel contra el catálogo (por label) para heredar familia/categoría. */
function matchConcepto(
  label: string,
  catalog: TipoGasto[],
): { tipoId: string; subtipoId: string; tipoCompromiso: string; categoria: string } | null {
  const l = label.toLowerCase().trim();
  for (const tipo of catalog) {
    for (const sub of tipo.subtipos) {
      if (l.includes(sub.label.toLowerCase()) || sub.label.toLowerCase().includes(l)) {
        return {
          tipoId: tipo.id,
          subtipoId: sub.id,
          tipoCompromiso: (sub as { tipoCompromiso?: string }).tipoCompromiso ?? 'otros',
          categoria: (sub as { categoria?: string }).categoria ?? 'otros',
        };
      }
    }
  }
  return null;
}

const ImportarGastosModal: React.FC<ImportarGastosModalProps> = ({
  mode,
  inmuebleId,
  accounts,
  catalog,
  onCancel,
  onImportado,
}) => {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapeo, setMapeo] = useState<MapeoColumnas | null>(null);
  const [lineas, setLineas] = useState<LineaPreview[]>([]);
  const [importando, setImportando] = useState(false);

  const rehacerPreview = (rs: Record<string, unknown>[], m: MapeoColumnas) => {
    const nuevas: LineaPreview[] = rs.map((r) => {
      const get = (campo: CampoGasto): string => (m[campo] ? String(r[m[campo] as string] ?? '').trim() : '');
      const conceptoRaw = get('concepto') || get('proveedor') || 'Gasto';
      return {
        entra: true,
        conceptoRaw,
        proveedor: get('proveedor'),
        importe: parseImporteEs(m.importe ? r[m.importe] : null),
        meses: periodicidadAMeses(get('periodicidad')),
        cuentaId: matchCuenta(get('cuenta'), accounts),
        cups: get('cups'),
      };
    });
    setLineas(nuevas);
  };

  const onFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (parsed.length === 0) {
        showToastV5('El fichero no tiene filas', 'warn');
        return;
      }
      const hs = Object.keys(parsed[0]);
      const m = autoMapColumns(hs);
      setFileName(file.name);
      setHeaders(hs);
      setRows(parsed);
      setMapeo(m);
      rehacerPreview(parsed, m);
    } catch (err) {
      showToastV5(`No se pudo leer el fichero: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const cambiarMapeo = (campo: CampoGasto, header: string) => {
    if (!mapeo) return;
    const m = { ...mapeo, [campo]: header || null };
    setMapeo(m);
    rehacerPreview(rows, m);
  };

  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Concepto', 'Proveedor', 'Importe', 'Periodicidad', 'Cuenta de cargo', 'CUPS o contrato'],
      ['Comunidad', 'CCPP', '74,09', 'Todos los meses', 'Unicaja ...4437', ''],
      ['Luz', 'Visalia', '46,78', 'Todos los meses', 'Sabadell ...9635', 'ES00...'],
      ['IBI', 'Ayuntamiento', '320,00', 'Una vez al año', 'Unicaja ...4437', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos recurrentes');
    XLSX.writeFile(wb, 'plantilla-gastos-recurrentes-atlas.xlsx');
  };

  const nEntran = useMemo(() => lineas.filter((l) => l.entra).length, [lineas]);

  const importar = async () => {
    if (importando || nEntran === 0) return;
    if (accounts.length === 0) {
      showToastV5('Añade una cuenta en Cuentas antes de importar', 'warn');
      return;
    }
    setImportando(true);
    let creados = 0;
    try {
      const now = new Date().toISOString().slice(0, 10);
      for (const l of lineas) {
        if (!l.entra) continue;
        const concepto = matchConcepto(l.conceptoRaw, catalog);
        const skeleton = {
          ambito: mode === 'inmueble' ? 'inmueble' : 'personal',
          inmuebleId: mode === 'inmueble' ? inmuebleId : undefined,
          personalDataId: mode === 'personal' ? 1 : undefined,
          alias: l.conceptoRaw,
          // El matcher devuelve el id de concepto UNIFICADO en `subtipoId`: se
          // guarda como `concepto` canónico para que agrupe como el resto.
          concepto: concepto && conceptoPorId(concepto.subtipoId) ? concepto.subtipoId : undefined,
          tipo: concepto?.tipoCompromiso ?? 'otros',
          subtipo: concepto?.subtipoId,
          tipoFamilia: concepto?.tipoId ?? 'otros',
          proveedor: { nombre: l.proveedor || '' },
          cups: l.cups || undefined,
          patron: mesesToPatron(l.meses.length ? l.meses : [1], 1),
          importe: { modo: 'fijo', importe: l.importe && l.importe > 0 ? l.importe : 0 },
          // El gasto importado nace domiciliado · no vale la primera cuenta
          // que haya, tiene que poder domiciliar (§2). El colchón no tiene
          // IBAN, y elegirlo dejaría un gasto que nadie puede pagar.
          cuentaCargo: cuentaParaElMetodo('domiciliacion', accounts, l.cuentaId) ?? 0,
          conceptoBancario: '',
          metodoPago: 'domiciliacion',
          categoria: concepto?.categoria ?? 'otros',
          bolsaPresupuesto: mode === 'inmueble' ? 'inmueble' : 'necesidades',
          responsable: 'titular',
          fechaInicio: now,
          estado: 'preparado',
        } as unknown as Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;
        try {
          await crearCompromiso(skeleton);
          creados += 1;
        } catch {
          // fila que choca con una validación · se salta
        }
      }
      showToastV5(`Importados ${creados} gasto${creados === 1 ? '' : 's'} · nacen preparados, ponles el primer cobro`, 'success');
      onImportado(creados);
    } catch (err) {
      showToastV5(`Error al importar: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setImportando(false);
    }
  };

  return (
    <>
      <div style={overlay} onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Importar gastos de Excel" style={modal}>
        <div style={head}>
          <div>
            <div style={title}>Importar los gastos de un Excel</div>
            <div style={sub}>Se sube el fichero, ATLAS propone concepto y cuenta por línea, y tú confirmas.</div>
          </div>
          <button type="button" style={btnGhostSm} onClick={descargarPlantilla}>Descargar plantilla</button>
        </div>

        <div style={body}>
          {/* 1 · fichero */}
          <div style={paso}>1 · El fichero <span style={pasoSub}>Excel o CSV · una fila por gasto</span></div>
          <label style={fileZone}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <span style={{ color: fileName ? 'var(--atlas-v5-ink-2)' : 'var(--atlas-v5-ink-4)' }}>
              {fileName || 'Elegir fichero…'}
            </span>
          </label>

          {mapeo && (
            <>
              {/* 2 · columnas */}
              <div style={paso}>
                2 · Qué columna es qué
                <span style={chip}>{nReconocidas(mapeo)} de {CAMPOS.length} reconocidas</span>
              </div>
              <div style={mapGrid}>
                {CAMPOS.map((c) => (
                  <div key={c.id}>
                    <label style={lab}>{c.label}</label>
                    <select style={inp} value={mapeo[c.id] ?? ''} onChange={(e) => cambiarMapeo(c.id, e.target.value)}>
                      <option value="">— ninguna —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* 3 · preview */}
              <div style={paso}>
                3 · Lo que va a entrar
                <span style={chip}>{nEntran} de {lineas.length} entran</span>
              </div>
              <div style={tabla}>
                {lineas.map((l, i) => (
                  <div key={i} style={{ ...filaP, opacity: l.entra ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      style={checkInput}
                      checked={l.entra}
                      onChange={(e) => setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, entra: e.target.checked } : x)))}
                      aria-label={`Importar ${l.conceptoRaw}`}
                    />
                    <span style={celConcepto}>
                      <span style={{ fontWeight: 600, color: 'var(--atlas-v5-ink-2)' }}>{l.conceptoRaw}</span>
                      {l.proveedor && <span style={{ color: 'var(--atlas-v5-ink-4)', fontSize: 11 }}> · {l.proveedor}</span>}
                    </span>
                    <span style={celImporte}>{l.importe != null ? `${l.importe.toFixed(2)} €` : '—'}</span>
                    <select
                      style={{ ...inp, fontSize: 11.5, padding: '4px 6px' }}
                      value={l.cuentaId}
                      onChange={(e) => setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, cuentaId: parseInt(e.target.value, 10) } : x)))}
                      aria-label={`Cuenta de ${l.conceptoRaw}`}
                    >
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.alias ?? a.name ?? `Cuenta ${a.id}`}</option>)}
                    </select>
                    <span style={celPeriod}>{etiquetaPeriodicidad(l.meses)}</span>
                  </div>
                ))}
              </div>
              <div style={notaFalta}>
                Falta el <strong>primer cobro</strong> de cada gasto · no bloquea la importación, se pide al activarlo.
              </div>
            </>
          )}
        </div>

        <div style={actions}>
          <button type="button" style={btnGhost} onClick={onCancel}>Cancelar</button>
          <button type="button" style={btnGold} disabled={!mapeo || nEntran === 0 || importando} onClick={() => void importar()}>
            {importando ? 'Importando…' : `Importar ${nEntran || ''} gasto${nEntran === 1 ? '' : 's'}`.trim()}
          </button>
        </div>
      </div>
    </>
  );
};

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'var(--atlas-v5-overlay)', zIndex: 300 };
const modal: React.CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(680px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
  background: 'var(--atlas-v5-bg)', border: '1px solid var(--atlas-v5-line)', borderRadius: 14,
  boxShadow: 'var(--atlas-v5-shadow-modal)', zIndex: 301, fontFamily: 'var(--atlas-v5-font-ui)',
};
const head: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
  padding: '18px 20px', borderBottom: '1px solid var(--atlas-v5-line-2)',
};
const title: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: 'var(--atlas-v5-ink)' };
const sub: React.CSSProperties = { fontSize: 12, color: 'var(--atlas-v5-ink-4)', marginTop: 4, lineHeight: 1.45 };
const body: React.CSSProperties = { padding: '16px 20px', overflowY: 'auto', minHeight: 0 };
const paso: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)', margin: '18px 0 10px',
};
const pasoSub: React.CSSProperties = { fontSize: 11.5, fontWeight: 400, color: 'var(--atlas-v5-ink-4)' };
const chip: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--atlas-v5-gold-ink)', background: 'var(--atlas-v5-gold-wash)',
  borderRadius: 99, padding: '2px 9px', marginLeft: 'auto',
};
const fileZone: React.CSSProperties = {
  display: 'block', padding: '12px 14px', borderRadius: 9, border: '1px dashed var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)', cursor: 'pointer', fontSize: 12.5,
};
const mapGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px 14px',
};
const lab: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--atlas-v5-ink-4)',
  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--atlas-v5-line)',
  fontSize: 12, background: 'var(--atlas-v5-card)', color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)', boxSizing: 'border-box',
};
const tabla: React.CSSProperties = { border: '1px solid var(--atlas-v5-line)', borderRadius: 9, overflow: 'hidden' };
const filaP: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '22px 1fr 90px 150px 130px', gap: 10, alignItems: 'center',
  padding: '8px 12px', borderBottom: '1px solid var(--atlas-v5-line-3)', fontSize: 12,
};
const celConcepto: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const celImporte: React.CSSProperties = {
  textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 700, color: 'var(--atlas-v5-ink-2)',
};
const celPeriod: React.CSSProperties = { fontSize: 11.5, color: 'var(--atlas-v5-ink-3)' };
const notaFalta: React.CSSProperties = { marginTop: 10, fontSize: 11.5, color: 'var(--atlas-v5-ink-4)', lineHeight: 1.45 };
const actions: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px',
  borderTop: '1px solid var(--atlas-v5-line-2)',
};
const btnGhost: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)', background: 'var(--atlas-v5-card)', color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnGhostSm: React.CSSProperties = { ...btnGhost, padding: '6px 11px', fontSize: 11.5, whiteSpace: 'nowrap' };
const btnGold: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--atlas-v5-gold)', background: 'var(--atlas-v5-gold)', color: 'var(--atlas-v5-brand-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default ImportarGastosModal;
