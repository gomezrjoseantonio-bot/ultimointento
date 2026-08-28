// Fila desplegada como FORMULARIO COMPLETO (§3.2). Va DENTRO de la tabla, con
// borde izquierdo de 3 px en oro y fondo crema. Cuatro bloques con título en
// mayúsculas espaciadas y separador arriba (quién lo cobra · cuánto · cuándo ·
// estado), cada uno una rejilla de columnas con etiqueta pequeña en mayúsculas
// ENCIMA de cada campo (nada de leyendas flotando sobre el borde). Es la única
// superficie de edición: guarda con actualizarCompromiso y regenera previsiones.

import React, { useEffect, useMemo, useState } from 'react';
import { actualizarCompromiso } from '../../../../../services/personal/compromisosRecurrentesService';
import { showToastV5 } from '../../../../../design-system/v5';
import type {
  CompromisoRecurrente,
  ImporteEvento,
  PatronRecurrente,
  PatronVariacion,
  MetodoPagoCompromiso,
  FamiliaFiscal,
  RepartoInmueble,
} from '../../../../../types/compromisosRecurrentes';
import type { Account } from '../../../../../services/db';
import {
  cuentaDeLaTarjeta,
  cuentaParaElMetodo,
  cuentasQuePuedenPagar,
  elMetodoDecideLaCuenta,
  sePuedePagarConTarjeta,
  tarjetaParaElPago,
  tarjetasQuePuedenPagar,
} from '../../../../../services/cuentasPorMetodoPago';
import { listarTarjetas } from '../../../../../services/tarjetasService';
import { nombreDelMetodo } from '../../../../../services/metodoDePago';
import type { Tarjeta } from '../../../../../types/tarjetas';
import RejillaMeses from './RejillaMeses';
import { patronToMeses, mesesToPatron, diaDePatron } from '../utils/rejillaMeses';
import {
  cargosDeCompromiso,
  parseCargos,
  porPagoDesdeCargos,
  problemaDeCargos,
  MESES_CORTOS,
  type CargoDraft,
} from '../utils/cargosPorPago';
import { fiscalidadDeConcepto, FAMILIAS_FISCALES } from '../utils/fiscalidadConcepto';
import RepartoEditor, { repartoCuadra, type InmuebleOpcion } from './RepartoEditor';
import CargosEditor from './CargosEditor';
import {
  panel,
  dtit,
  dgrid,
  dgrid2,
  lab,
  inp,
  inpSmall,
  tramoRow,
  tramoDel,
  btnLinkTramo,
  fiscalInfo,
  inlineRow,
  hint,
  hint2,
  checkRow,
  checkInput,
  estadoBox,
  footer,
  btnGold,
} from './RowForm.styles';
import {
  conceptoPorId,
  conceptosDe,
  familiasDeAmbito,
  proyectar,
} from '../../../../../services/conceptos/catalogoConceptos';
import type { ProyeccionPersonal } from '../../../../../services/conceptos/catalogoConceptos';
import { parLegacyDe, resolverConcepto } from '../../../../../services/conceptos/mapaLegacy';

interface RowFormProps {
  compromiso: CompromisoRecurrente & { id: number };
  accounts: Account[];
  /** Inmuebles para el reparto de un recibo entre varios (§2.7). Incluye el actual. */
  inmueblesDisponibles?: InmuebleOpcion[];
  onSaved: (updated: CompromisoRecurrente) => void;
}

type SubeCadaAnio = 'no' | 'ipc' | 'contrato';

// Opciones que ofrece la excepción de la derrama (§3 · conservación vs mejora).
const DERRAMA_OPCIONES: FamiliaFiscal[] = ['reparaciones_conservacion', 'mejora'];

// Los rótulos NO se escriben aquí · §2 · `nombreDelMetodo` es el único sitio
// donde un método de pago tiene nombre, para que no haya dos formas de llamar
// a lo mismo en dos pantallas.
const MEDIOS: MetodoPagoCompromiso[] = [
  'domiciliacion',
  'transferencia',
  'tarjeta',
  'efectivo',
  'bizum',
];

/** Cómo se llama una cuenta en pantalla · §2.2 · nunca un id suelto. */
const nombreDeCuenta = (a?: Account): string =>
  a ? (a.alias ?? a.name ?? a.banco?.name ?? 'Sin nombre') : 'Sin cuenta';

type ModoImporteUI =
  | 'fijo'
  | 'variable'
  | 'porPago'
  | 'porTramos'
  | 'porcentajeRenta'
  | 'diferenciadoPorMes';

const MODOS_IMPORTE: Array<{ id: ModoImporteUI; label: string }> = [
  { id: 'fijo', label: 'Fijo · igual cada cargo' },
  { id: 'variable', label: 'Media · varía cada mes' },
  // El IBI de dos pagos, la basura de dos recibos, el seguro fraccionado: un
  // concepto con varios cargos al año, cada uno con su cifra y su día. Antes
  // había que darlos de alta por separado («IBI 1», «IBI 2»).
  { id: 'porPago', label: 'Por cargo · varios al año' },
  { id: 'porTramos', label: 'Por tramos · cambia en una fecha' },
  { id: 'porcentajeRenta', label: '% de la renta' },
];

// La detección automática propone gastos con doce importes
// (`compromisoDetectionService`). La ficha no los edita, pero tampoco los pisa:
// el modo aparece SOLO si el gasto ya venía así, para que se vea lo que hay y
// se pueda dejar como estaba.
const MODO_DETECTADO: { id: ModoImporteUI; label: string } = {
  id: 'diferenciadoPorMes',
  label: 'Distinto cada mes · detectado',
};

function modoImporteInicial(imp: ImporteEvento): ModoImporteUI {
  if (imp.modo === 'variable') return 'variable';
  if (imp.modo === 'porPago') return 'porPago';
  if (imp.modo === 'porTramos') return 'porTramos';
  if (imp.modo === 'porcentajeRenta') return 'porcentajeRenta';
  if (imp.modo === 'diferenciadoPorMes') return 'diferenciadoPorMes';
  return 'fijo';
}

function importeToFijo(imp: ImporteEvento): string {
  if (imp.modo === 'fijo') return imp.importe > 0 ? String(imp.importe) : '';
  if (imp.modo === 'variable') return imp.importeMedio > 0 ? String(imp.importeMedio) : '';
  return '';
}
function variacionInicial(v?: PatronVariacion): SubeCadaAnio {
  if (v?.tipo === 'ipcAnual') return 'ipc';
  if (v?.tipo === 'aniversarioContrato') return 'contrato';
  return 'no';
}
function labelFamilia(id: FamiliaFiscal): string {
  return FAMILIAS_FISCALES.find((f) => f.id === id)?.label ?? id;
}

const RowForm: React.FC<RowFormProps> = ({ compromiso: c, accounts, inmueblesDisponibles, onSaved }) => {
  // QUÉ es este gasto · el único campo de clasificación que se elige. De él se
  // derivan familia, categoría, bolsa y fiscalidad. Hasta ahora la ficha de
  // edición NO lo mostraba: se podía cambiar el importe y la cuenta, pero no
  // arreglar un gasto mal clasificado, que es exactamente lo que le pasaba al
  // seguro de vida. Si el registro es anterior a la unificación se traduce su
  // par legacy para nacer relleno.
  const conceptoInicial =
    (c.concepto && conceptoPorId(c.concepto) ? c.concepto : null) ??
    resolverConcepto(c.tipoFamilia, c.subtipo) ??
    '';
  const [concepto, setConcepto] = useState<string>(conceptoInicial);
  const familias = useMemo(() => familiasDeAmbito(c.ambito), [c.ambito]);
  const conceptoDefActual = conceptoPorId(concepto);

  const [alias, setAlias] = useState(c.alias === 'Nuevo gasto' ? '' : c.alias);
  // Un alias que repite el nombre del concepto no dice nada · se enseña vacío,
  // con el del concepto de marcador. Lo que se GUARDA no cambia.
  const aliasVisible = alias === conceptoDefActual?.label ? '' : alias;
  const [proveedor, setProveedor] = useState(c.proveedor?.nombre ?? '');
  const [nif, setNif] = useState(c.proveedor?.nif ?? '');
  const [cups, setCups] = useState(c.cups ?? '');
  const [numeroContrato, setNumeroContrato] = useState(c.numeroContrato ?? '');
  const [familiaManual, setFamiliaManual] = useState<FamiliaFiscal | ''>(c.familiaFiscalManual ?? '');
  const [medio, setMedio] = useState<MetodoPagoCompromiso>(c.metodoPago);
  const [cuentaCargo, setCuentaCargo] = useState<number>(c.cuentaCargo);
  // §3 · «Tarjeta» no dice de dónde sale el dinero, dice con QUÉ se paga. Sin
  // esta lista el medio se ofrecía a secas y la cuenta se elegía a mano, así
  // que un gasto de la Carrefour podía acabar apuntando a Santander.
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [tarjetaId, setTarjetaId] = useState<number | undefined>(c.tarjetaId);

  useEffect(() => {
    let vivo = true;
    void listarTarjetas().then((lista) => {
      if (!vivo) return;
      setTarjetas(lista);
      // Al ABRIR un gasto que ya paga con tarjeta, la cuenta se vuelve a leer
      // de ella. `cuentaCargo` es una copia del día que se guardó, y si la
      // tarjeta se re-domicilió después, la copia enseña —y volvería a
      // guardar— una cuenta de la que ya no sale el dinero.
      if (c.metodoPago !== 'tarjeta' || c.tarjetaId == null) return;
      const suya = cuentaDeLaTarjeta(c.tarjetaId, lista);
      if (suya != null) setCuentaCargo(suya);
    });
    return () => {
      vivo = false;
    };
  }, [c.metodoPago, c.tarjetaId]);
  const [fechaInicio, setFechaInicio] = useState(c.fechaInicio ?? '');
  // Hasta cuándo se cobra · vacío = indefinido, que es el caso normal.
  const [fechaFin, setFechaFin] = useState((c.fechaFin ?? '').slice(0, 10));
  const [importe, setImporte] = useState(importeToFijo(c.importe));
  const [modoImporte, setModoImporte] = useState<ModoImporteUI>(() => modoImporteInicial(c.importe));
  const [tramos, setTramos] = useState<Array<{ desde: string; importe: string }>>(() =>
    c.importe.modo === 'porTramos' && c.importe.tramos.length > 0
      ? c.importe.tramos.map((t) => ({ desde: t.desde.slice(0, 10), importe: String(t.importe) }))
      : [{ desde: '', importe: '' }],
  );
  const [pctRenta, setPctRenta] = useState<string>(
    c.importe.modo === 'porcentajeRenta' ? String(c.importe.porcentaje) : '',
  );
  // Los cargos del año · nacen de lo guardado, sea `porPago` o el
  // `diferenciadoPorMes` de la detección (de ahí salen sus meses con cifra),
  // así que pasar uno a cargos no obliga a teclear nada de nuevo.
  const [cargos, setCargos] = useState<CargoDraft[]>(() => {
    const leidos = cargosDeCompromiso(c.importe, c.patron);
    return leidos.length > 0
      ? leidos.map((x) => ({ mes: x.mes, importe: String(x.importe), dia: String(x.dia) }))
      : [{ mes: new Date().getMonth() + 1, importe: '', dia: '1' }];
  });
  const [meses, setMeses] = useState<number[]>(() => patronToMeses(c.patron));
  const [dia, setDia] = useState<number>(() => diaDePatron(c.patron));
  const [diaIncierto, setDiaIncierto] = useState<boolean>(!!c.diaCargoIncierto);
  const [margenGracia, setMargenGracia] = useState<string>(
    c.margenGraciaDias != null ? String(c.margenGraciaDias) : '',
  );
  const [sube, setSube] = useState<SubeCadaAnio>(() => variacionInicial(c.variacion));
  const [ipcMes, setIpcMes] = useState<number>(c.variacion?.tipo === 'ipcAnual' ? c.variacion.mesRevision : 1);
  const [contratoMes, setContratoMes] = useState<number>(
    c.variacion?.tipo === 'aniversarioContrato' ? c.variacion.mesAniversario : 1,
  );
  const [contratoPct, setContratoPct] = useState<string>(
    c.variacion?.tipo === 'aniversarioContrato' ? String(c.variacion.porcentajeAnual) : '',
  );
  const [comparte, setComparte] = useState<boolean>(!!(c.reparto && c.reparto.length > 0));
  const [reparto, setReparto] = useState<RepartoInmueble[]>(c.reparto ?? []);
  // Fase 3 VH · solo para alquiler personal: ¿es el alquiler de mi vivienda
  // habitual? (alimenta la deducción autonómica). Default-true. Se mira el
  // concepto elegido AHORA, no la categoría guardada: si acabas de cambiarlo a
  // «Alquiler», la casilla tiene que aparecer sin recargar.
  const esAlquilerPersonal = c.ambito === 'personal' && concepto === 'alquiler_vivienda';
  const [esVH, setEsVH] = useState<boolean>(c.esViviendaHabitual !== false);
  const [saving, setSaving] = useState(false);

  // Reparto entre inmuebles (§2.7): sólo tiene sentido en ámbito inmueble y si
  // hay más de un inmueble donde repartir.
  const inmuebleActual =
    c.ambito === 'inmueble' && c.inmuebleId != null
      ? (inmueblesDisponibles ?? []).find((i) => i.id === c.inmuebleId) ?? { id: c.inmuebleId, label: c.alias }
      : null;
  const puedeRepartir = inmuebleActual != null && (inmueblesDisponibles ?? []).length > 1;
  const importeNum = parseFloat(importe) || 0;

  const esPorCargos = modoImporte === 'porPago';
  const cargosListos = useMemo(() => parseCargos(cargos), [cargos]);
  // El modo «detectado» solo se ofrece si el gasto ya venía así · no es algo
  // que se elija, es algo que se respeta.
  const modosOfrecidos = useMemo(
    () => (c.importe.modo === 'diferenciadoPorMes' ? [...MODOS_IMPORTE, MODO_DETECTADO] : MODOS_IMPORTE),
    [c.importe.modo],
  );

  const mesAncla = useMemo(() => (meses.length ? Math.min(...meses) : new Date().getMonth() + 1), [meses]);
  const estadoLabel = c.estado === 'activo' ? 'Activo · se proyecta' : c.estado === 'preparado' ? 'Preparado · aún no se proyecta' : 'Dado de baja';
  // Fiscalidad DERIVADA del concepto (informativa · no se pregunta salvo
  // excepción). Se recalcula con el concepto ELEGIDO, no con el guardado: la
  // frase tiene que decir la verdad antes de guardar, no después.
  const fisc = fiscalidadDeConcepto(concepto || undefined, undefined, familiaManual || undefined);
  const opcionesExcepcion = fisc.esDerrama ? DERRAMA_OPCIONES : FAMILIAS_FISCALES.map((f) => f.id);

  const handleSave = async () => {
    if (saving) return;
    // Reparto (§2.7): si se comparte, el total debe cuadrar (100 % o el importe
    // completo) · si no, no se puede guardar.
    if (comparte && puedeRepartir && !repartoCuadra(reparto, importeNum)) {
      showToastV5('El reparto no cuadra · ajusta las partes antes de guardar', 'warn');
      return;
    }
    // §3 · «con tarjeta» sin decir con cuál no se puede proyectar: no se sabe
    // de qué cuenta sale ni cuándo. Los gastos guardados antes de que existiera
    // la ficha de tarjeta llegan así, y aquí es donde se completan.
    if (medio === 'tarjeta' && tarjetaId == null) {
      showToastV5('Elige con qué tarjeta se paga', 'warn');
      return;
    }
    // Un cargo a medio escribir no llegaría al dato —`parseCargos` lo filtra—,
    // así que guardar sería seguro. Se avisa igualmente: perder en silencio una
    // línea que se acaba de teclear es peor que no guardar.
    if (modoImporte === 'porPago') {
      const problema = problemaDeCargos(cargos);
      if (problema) {
        showToastV5(problema, 'warn');
        return;
      }
    }
    setSaving(true);
    try {
      const impNum = parseFloat(importe);
      let importeEvento: ImporteEvento;
      // Los gastos por cargos no usan la rejilla de meses: su calendario ES la
      // lista de cargos, con el día de cada uno.
      let patronPorCargos: PatronRecurrente | null = null;
      if (modoImporte === 'variable') {
        importeEvento = { modo: 'variable', importeMedio: !Number.isNaN(impNum) && impNum > 0 ? impNum : 0 };
      } else if (modoImporte === 'porcentajeRenta') {
        importeEvento = { modo: 'porcentajeRenta', porcentaje: Math.min(100, Math.max(0, parseFloat(pctRenta) || 0)) };
      } else if (modoImporte === 'porPago') {
        // El importe y el patrón salen JUNTOS de los mismos cargos · ver
        // `cargosPorPago`. Es lo que garantiza que ningún mes del patrón se
        // quede sin importe, que es lo que hace lanzar a `calcularImporte`.
        const derivado = porPagoDesdeCargos(parseCargos(cargos));
        importeEvento = derivado.importe;
        patronPorCargos = derivado.patron;
      } else if (modoImporte === 'diferenciadoPorMes') {
        // La ficha no sabe editar los doce huecos, así que no los toca: se
        // reescribe el importe tal cual vino. Antes caía al `else` de abajo y
        // el gasto se quedaba en `fijo 0` por cambiar la cuenta de cargo.
        importeEvento = c.importe;
      } else if (modoImporte === 'porTramos') {
        const tr = tramos
          .filter((t) => t.desde && !Number.isNaN(parseFloat(t.importe)))
          .map((t) => ({ desde: t.desde, importe: parseFloat(t.importe) }));
        importeEvento = tr.length > 0 ? { modo: 'porTramos', tramos: tr } : { modo: 'fijo', importe: 0 };
      } else {
        importeEvento = { modo: 'fijo', importe: !Number.isNaN(impNum) && impNum > 0 ? impNum : 0 };
      }

      let variacion: PatronVariacion;
      if (sube === 'ipc') variacion = { tipo: 'ipcAnual', mesRevision: ipcMes };
      else if (sube === 'contrato')
        variacion = { tipo: 'aniversarioContrato', mesAniversario: contratoMes, porcentajeAnual: parseFloat(contratoPct) || 0 };
      else variacion = { tipo: 'sinVariacion' };

      const patron =
        patronPorCargos ??
        mesesToPatron(meses.length ? meses : [new Date().getMonth() + 1], dia || 1);
      const margen = parseInt(margenGracia, 10);
      // El nombre en blanco cae al del CONCEPTO, no al del proveedor. Ahora el
      // campo se enseña vacío a propósito cuando no añade nada, así que dejarlo
      // así es lo normal, no un descuido: caer al proveedor renombraba el gasto
      // a «Iberdrola», y sin proveedor lo dejaba en «Gasto recurrente».
      const nombre =
        alias.trim() || conceptoDefActual?.label || proveedor.trim() || 'Gasto recurrente';

      // La clasificación se guarda DERIVADA del concepto elegido, nunca a mano:
      // `categoria`, `bolsaPresupuesto` y `tipo` salen de la proyección del
      // concepto en este ámbito. Antes la ficha ni los mandaba, así que un gasto
      // mal clasificado se quedaba mal clasificado por mucho que se editara.
      const proyeccion = proyectar(concepto, c.ambito);
      const conceptoDef = conceptoPorId(concepto);
      // `tipoFamilia`/`subtipo` van también: siguen siendo la clave con la que
      // las listas agrupan. Sin arrastrarlas, mover un gasto de familia lo
      // dejaría listado bajo la anterior.
      //
      // Y se escriben SIEMPRE, incluso vacías. Las cinco combinaciones que
      // estrena la unificación no tienen par legacy, y dejar ahí el del
      // concepto viejo es peor que no tener ninguno: la lista seguiría
      // agrupando por él. Sin par, la familia se deduce del concepto
      // (`groupingHelpers`), que es la fuente buena.
      const par = parLegacyDe(concepto, c.ambito);
      const clasificacion: Partial<CompromisoRecurrente> =
        proyeccion && conceptoDef
          ? {
              concepto,
              categoria: proyeccion.categoria,
              tipo: conceptoDef.tipoCompromiso,
              bolsaPresupuesto:
                c.ambito === 'personal' ? (proyeccion as ProyeccionPersonal).bolsa : 'inmueble',
              tipoFamilia: par?.tipoFamilia,
              subtipo: par?.subtipo,
            }
          : {};

      const payload: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>> = {
        ...clasificacion,
        alias: nombre,
        // El proveedor NO se rellena con el alias: si no se ha dicho quién lo
        // cobra, no se sabe. Ponerle el nombre del gasto inventaba un proveedor
        // llamado «Alquiler» y luego la lista lo repetía debajo del concepto.
        proveedor: { ...c.proveedor, nombre: proveedor.trim(), nif: nif.trim() || undefined },
        cups: cups.trim() || undefined,
        numeroContrato: numeroContrato.trim() || undefined,
        // La familia fiscal normal NO se persiste (se deriva del concepto). Se
        // conserva la elección manual: la de la excepción que pregunta (derrama ·
        // «Otro») y la que fija el alta (seguro de vida vinculado → financiación).
        familiaFiscalManual: familiaManual || undefined,
        metodoPago: medio,
        cuentaCargo,
        // Solo tiene sentido con «Tarjeta» · en cualquier otro medio se limpia,
        // porque un id que sobrevive a un cambio de método es un dato muerto
        // que la proyección seguiría leyendo.
        tarjetaId: medio === 'tarjeta' ? tarjetaId : undefined,
        fechaInicio: fechaInicio || c.fechaInicio,
        // Poner fin NO es dar de baja: el gasto sigue cobrándose hasta ahí. El
        // motor corta la proyección en esta fecha y `actualizarCompromiso`
        // reemite, así que lo posterior se retira solo. Vacío la limpia — es
        // como se deshace un fin puesto por error.
        fechaFin: fechaFin || undefined,
        importe: importeEvento,
        patron,
        variacion,
        diaCargoIncierto: diaIncierto || undefined,
        margenGraciaDias: Number.isNaN(margen) ? undefined : margen,
        // El reparto sólo se guarda si se comparte y cuadra; si no, se limpia.
        reparto: comparte && puedeRepartir && reparto.length > 0 ? reparto : undefined,
        // Fase 3 VH · solo se persiste en el alquiler personal (default-true:
        // se guarda `false` explícito al desmarcar · `true` al remarcar).
        ...(esAlquilerPersonal ? { esViviendaHabitual: esVH } : {}),
      };

      // FASE 0 · `actualizarCompromiso` ya borra y reemite las previsiones de
      // este compromiso. Encadenar aquí el barrido global de
      // `regenerateForecastsForward` mezclaba dos rangos distintos y era lo que
      // convertía "editar el importe" en "crear un registro nuevo".
      const updated = await actualizarCompromiso(c.id, payload);
      showToastV5(`«${updated.alias}» guardado`, 'success');
      onSaved(updated);
    } catch (err) {
      showToastV5(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="region" aria-label={`Editar ${c.alias}`} style={panel}>
      {/* ── Quién lo cobra ── */}
      <div style={dtit}>Quién lo cobra</div>
      <div style={dgrid}>
        {/* QUÉ es · lo único que se elige. UN campo, no dos: la familia no es
            una decisión aparte, es dónde vive el concepto, así que va como
            cabecera de grupo. Con dos desplegables la ficha pedía «Alquiler» en
            Familia y «Alquiler» en Qué es, que es preguntar dos veces lo mismo.
            La lista sale filtrada por el ámbito de este gasto: no se puede
            elegir algo que aquí no sepa clasificarse. */}
        <Field label="Qué es">
          <select
            style={inp}
            value={concepto}
            onChange={(e) => {
              setConcepto(e.target.value);
              // Una elección fiscal manual pertenecía al concepto anterior ·
              // arrastrarla haría que el gasto nuevo contase como el viejo.
              setFamiliaManual('');
            }}
          >
            {conceptoInicial === '' && <option value="">— Sin clasificar —</option>}
            {familias.map((f) => (
              <optgroup key={f.id} label={f.label}>
                {conceptosDe(f.id, c.ambito).map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        {/* El nombre sale VACÍO cuando no añade nada · el concepto ya se llama
            así. Sólo se escribe para distinguir dos iguales («Alquiler Pozuelo»
            y «Alquiler Madrid»), y si se deja en blanco se guarda el del
            concepto, igual que antes. */}
        <Field label="Nombre" hint="Sólo si necesitas distinguirlo de otro igual">
          <input
            style={inp}
            value={aliasVisible}
            onChange={(e) => setAlias(e.target.value)}
            placeholder={conceptoDefActual?.label ?? 'Luz, comunidad, seguro…'}
          />
        </Field>
        <Field label="Proveedor" hint="Quién lo cobra · el nombre que sale en el banco">
          <input style={inp} value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Iberdrola, la comunidad…" />
        </Field>
        <Field
          label="CIF o NIF"
          hint={esAlquilerPersonal ? 'El NIF del arrendador lo pide Hacienda para la deducción por alquiler' : undefined}
        ><input style={inp} value={nif} onChange={(e) => setNif(e.target.value)} placeholder="A12345678" /></Field>
        {esAlquilerPersonal && (
          <div style={{ minWidth: 0 }}>
            <label style={lab}>
              <input
                type="checkbox"
                checked={esVH}
                onChange={(e) => setEsVH(e.target.checked)}
                style={{ ...checkInput, marginRight: 6 }}
              />
              Es mi vivienda habitual
            </label>
            <div style={fiscalInfo}>
              {esVH
                ? 'Cuenta para la deducción autonómica por alquiler (si tu CCAA la tiene)'
                : 'No cuenta para la deducción por alquiler (trastero, segunda vivienda…)'}
            </div>
          </div>
        )}
        {/* Fiscalidad: informativa (derivada) salvo la excepción que pregunta */}
        {fisc.pregunta ? (
          <Field
            label={fisc.esDerrama ? 'La derrama · ¿conservación o mejora?' : 'Cómo cuenta fiscalmente'}
            hint={fisc.esDerrama ? 'Conservación arregla lo que ya había · mejora añade algo nuevo (lo dice el acta)' : 'Este concepto no lo trae el catálogo · dinos cómo cuenta'}
          >
            <select style={inp} value={familiaManual} onChange={(e) => setFamiliaManual(e.target.value as FamiliaFiscal | '')}>
              <option value="">— Elegir —</option>
              {opcionesExcepcion.map((id) => <option key={id} value={id}>{labelFamilia(id)}</option>)}
            </select>
          </Field>
        ) : (
          <div style={{ minWidth: 0 }}>
            <label style={lab}>Cómo cuenta fiscalmente</label>
            <div style={fiscalInfo}>{fisc.frase}</div>
          </div>
        )}
      </div>
      <div style={dgrid2}>
        <Field label="CUPS · para luz y gas" hint="Con el CUPS, ATLAS cuadra la factura aunque cambies de compañía">
          <input style={{ ...inp, fontFamily: 'var(--atlas-v5-font-mono-num)' }} value={cups} onChange={(e) => setCups(e.target.value)} placeholder="ES00…" />
        </Field>
        <Field label="Número de contrato o póliza" hint="Lo que venga en el recibo · ayuda a cuadrarlo en el banco">
          <input style={inp} value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} placeholder="Contrato, póliza, referencia…" />
        </Field>
      </div>

      {/* ── Cuánto ── */}
      <div style={dtit}>Cuánto</div>
      <div style={dgrid}>
        <Field label="Modo de importe">
          <select
            style={inp}
            aria-label="Modo de importe"
            value={modoImporte}
            onChange={(e) => setModoImporte(e.target.value as ModoImporteUI)}
          >
            {modosOfrecidos.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        {modoImporte === 'fijo' && (
          <Field label="Importe €/cargo"><input type="number" min={0} step="0.01" style={{ ...inp, textAlign: 'right' }} value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="—" /></Field>
        )}
        {modoImporte === 'variable' && (
          <Field label="Importe medio €" hint="ATLAS usará esta estimación hasta que llegue el real"><input type="number" min={0} step="0.01" style={{ ...inp, textAlign: 'right' }} value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="—" /></Field>
        )}
        {modoImporte === 'porcentajeRenta' && (
          <Field label="% de la renta" hint="Se calcula sobre la renta del inmueble"><input type="number" min={0} max={100} step="0.1" style={{ ...inp, textAlign: 'right' }} value={pctRenta} onChange={(e) => setPctRenta(e.target.value)} placeholder="%" /></Field>
        )}
        {modoImporte === 'porTramos' && (
          <Field label="Importe"><div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-4)', padding: '7px 0' }}>por tramos ↓</div></Field>
        )}
        {esPorCargos && (
          <Field label="Importe"><div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-4)', padding: '7px 0' }}>por cargo ↓</div></Field>
        )}
        {modoImporte === 'diferenciadoPorMes' && (
          <Field label="Importe" hint="Lo puso la detección · pásalo a «Por cargo» para editarlo">
            <div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-4)', padding: '7px 0' }}>
              {cargosDeCompromiso(c.importe, c.patron).length} meses con importe
            </div>
          </Field>
        )}
        <Field label="Medio de pago">
          {/* Solo los medios que HOY se pueden usar · docs/VOCABULARIO-dinero.md
              §2. Sin cuenta de efectivo no se puede pagar en efectivo, y sin
              ninguna cuenta con Bizum tampoco por Bizum: ofrecerlos guardaría
              un gasto colgado de una cuenta que no puede pagarlo. */}
          <select
            style={inp}
            value={medio}
            onChange={(e) => {
              const nuevo = e.target.value as MetodoPagoCompromiso;
              setMedio(nuevo);
              if (nuevo === 'tarjeta') {
                // Con tarjeta la cuenta NO se recoloca por el método: la decide
                // la tarjeta elegida, que es quien sabe dónde está domiciliada.
                const cual = tarjetaParaElPago(tarjetas, tarjetaId);
                setTarjetaId(cual);
                const suya = cuentaDeLaTarjeta(cual, tarjetas);
                if (suya != null) setCuentaCargo(suya);
                return;
              }
              // Salir de «Tarjeta» deja de ser un pago con tarjeta · arrastrar
              // el id sería un dato muerto que la proyección aún leería.
              setTarjetaId(undefined);
              // La cuenta se recoloca con el medio · si no, cambiar a Efectivo
              // escondía el desplegable y dejaba pegada la cuenta bancaria
              // anterior, que es la peor forma de estar mal: invisible.
              const cuenta = cuentaParaElMetodo(nuevo, accounts, cuentaCargo);
              if (cuenta != null) setCuentaCargo(cuenta);
            }}
          >
            {MEDIOS.filter((m) =>
              // Sin ninguna tarjeta dada de alta, «Tarjeta» guardaría un gasto
              // que dice con tarjeta sin decir con cuál: no se puede proyectar.
              m === 'tarjeta'
                ? sePuedePagarConTarjeta(tarjetas)
                : cuentasQuePuedenPagar(m, accounts).length > 0
            ).map((m) => (
              <option key={m} value={m}>{nombreDelMetodo(m)}</option>
            ))}
          </select>
        </Field>
        {medio === 'tarjeta' && (
          <Field label="Con qué tarjeta">
            <select
              style={inp}
              value={tarjetaId != null ? String(tarjetaId) : ''}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setTarjetaId(Number.isFinite(id) ? id : undefined);
                // Re-domiciliar la tarjeta mueve el cargo con ella · §3.2.
                const suya = cuentaDeLaTarjeta(id, tarjetas);
                if (suya != null) setCuentaCargo(suya);
              }}
            >
              {tarjetaId == null && <option value="">Elige una tarjeta</option>}
              {tarjetasQuePuedenPagar(tarjetas).map((t) => (
                <option key={t.id} value={String(t.id)}>{t.alias}</option>
              ))}
            </select>
          </Field>
        )}
        {/* Con Efectivo o Bizum la cuenta NO se elige: la decide el medio. Un
            desplegable de una sola opción invita a pensar que hay algo que
            decidir, y no lo hay. */}
        {medio === 'tarjeta' ? (
          // El recibo lo paga la cuenta donde la tarjeta está domiciliada · no
          // se elige aquí, se cambia en la ficha de la tarjeta (§3.2).
          <Field label="Sale de" hint="La cuenta donde se domicilia la tarjeta">
            <div style={{ fontSize: 13, color: 'var(--atlas-v5-ink-2)', padding: '7px 0' }}>
              {nombreDeCuenta(accounts.find((a) => a.id === cuentaCargo))}
            </div>
          </Field>
        ) : elMetodoDecideLaCuenta(medio) ? (
          <Field label="Sale de" hint={medio === 'efectivo' ? 'El efectivo sale del efectivo' : 'La cuenta que tiene el Bizum'}>
            <div style={{ fontSize: 13, color: 'var(--atlas-v5-ink-2)', padding: '7px 0' }}>
              {nombreDeCuenta(cuentasQuePuedenPagar(medio, accounts)[0])}
            </div>
          </Field>
        ) : (
          <Field label="Cuenta de cargo">
            <select
              style={inp}
              aria-label="Cuenta de cargo"
              value={cuentaCargo}
              onChange={(e) => setCuentaCargo(parseInt(e.target.value, 10))}
            >
              {cuentasQuePuedenPagar(medio, accounts).length === 0 && (
                <option value={cuentaCargo}>Sin cuentas · añade una en Cuentas</option>
              )}
              {cuentasQuePuedenPagar(medio, accounts).map((a) => (
                <option key={a.id} value={a.id}>{nombreDeCuenta(a)}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Sube cada año">
          <select style={inp} value={sube} onChange={(e) => setSube(e.target.value as SubeCadaAnio)}>
            <option value="no">No sube</option>
            <option value="ipc">Con el IPC</option>
            <option value="contrato">% fijo por contrato</option>
          </select>
          {sube === 'ipc' && (
            <div style={inlineRow}><span style={hint}>Revisión en el mes</span><input type="number" min={1} max={12} style={inpSmall} value={ipcMes} onChange={(e) => setIpcMes(clampMes(e.target.value))} /></div>
          )}
          {sube === 'contrato' && (
            <div style={inlineRow}><input type="number" min={0} step="0.1" style={inpSmall} value={contratoPct} onChange={(e) => setContratoPct(e.target.value)} placeholder="%" /><span style={hint}>% en el mes</span><input type="number" min={1} max={12} style={inpSmall} value={contratoMes} onChange={(e) => setContratoMes(clampMes(e.target.value))} /></div>
          )}
        </Field>
      </div>

      {esPorCargos && <CargosEditor cargos={cargos} onChange={setCargos} />}

      {modoImporte === 'porTramos' && (
        <div style={{ marginTop: 12 }}>
          <label style={lab}>Tramos · el importe cambia a partir de cada fecha</label>
          {tramos.map((t, i) => (
            <div key={i} style={tramoRow}>
              <input
                type="date"
                style={{ ...inp, maxWidth: 170 }}
                value={t.desde}
                onChange={(e) => setTramos((prev) => prev.map((x, j) => (j === i ? { ...x, desde: e.target.value } : x)))}
                aria-label={`Desde (tramo ${i + 1})`}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                style={{ ...inp, maxWidth: 120, textAlign: 'right' }}
                value={t.importe}
                placeholder="€"
                onChange={(e) => setTramos((prev) => prev.map((x, j) => (j === i ? { ...x, importe: e.target.value } : x)))}
                aria-label={`Importe (tramo ${i + 1})`}
              />
              {tramos.length > 1 && (
                <button type="button" style={tramoDel} onClick={() => setTramos((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar tramo">
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" style={btnLinkTramo} onClick={() => setTramos((prev) => [...prev, { desde: '', importe: '' }])}>
            + Añadir tramo
          </button>
        </div>
      )}

      {/* ── Cuándo ── */}
      <div style={dtit}>Cuándo se cobra</div>
      <div style={dgrid}>
        <Field label="Primer cobro" hint="Fija el día y desde cuándo arranca el ciclo"><input type="date" style={inp} value={fechaInicio.slice(0, 10)} onChange={(e) => setFechaInicio(e.target.value)} /></Field>
        <Field label="Deja de cobrarse el" hint="Si no termina, déjalo vacío"><input type="date" aria-label="Deja de cobrarse el" style={inp} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></Field>
        <Field label="Margen de gracia" hint="Días antes de avisarte de que no ha llegado"><input type="number" min={0} max={31} style={inpSmall} value={margenGracia} onChange={(e) => setMargenGracia(e.target.value)} placeholder="0" /></Field>
      </div>
      {esPorCargos ? (
        // Con cargos, el calendario ya está dicho arriba. Dejar la rejilla
        // visible sería preguntarlo dos veces y dar por buena la respuesta que
        // no manda.
        <div style={{ marginTop: 4 }}>
          <div style={fiscalInfo}>
            {cargosListos.length > 0
              ? cargosListos.map((x) => `${x.dia} ${MESES_CORTOS[x.mes - 1]}`).join(' · ')
              : 'Añade arriba los cargos del año'}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          <RejillaMeses meses={meses} dia={dia} mesAncla={mesAncla} onMesesChange={setMeses} onDiaChange={setDia} disabled={diaIncierto} />
          <label style={checkRow}>
            <input type="checkbox" style={checkInput} checked={diaIncierto} onChange={(e) => setDiaIncierto(e.target.checked)} />
            <span>No sé el día del cargo todavía (se proyecta a mitad de mes)</span>
          </label>
        </div>
      )}

      {/* ── Se comparte con otros inmuebles (§2.7) ── */}
      {puedeRepartir && inmuebleActual && (
        <>
          <div style={dtit}>Se comparte con otros inmuebles</div>
          <label style={checkRow}>
            <input
              type="checkbox"
              style={checkInput}
              checked={comparte}
              onChange={(e) => {
                const on = e.target.checked;
                setComparte(on);
                if (on && reparto.length === 0) {
                  setReparto([{ inmuebleId: inmuebleActual.id, porcentaje: 100 }]);
                }
              }}
            />
            <span>Un solo recibo para varios inmuebles · se guarda el importe completo y el reparto</span>
          </label>
          {comparte && (
            <div style={{ marginTop: 12 }}>
              <RepartoEditor
                importeCompleto={importeNum}
                inmuebleActual={inmuebleActual}
                inmueblesDisponibles={inmueblesDisponibles ?? []}
                reparto={reparto}
                onChange={setReparto}
              />
            </div>
          )}
        </>
      )}

      {/* ── Estado ── */}
      <div style={dtit}>Estado</div>
      <div style={estadoBox}>{estadoLabel} · el interruptor de la fila lo apaga, activa o reactiva.</div>

      <div style={footer}>
        <button type="button" style={btnGold} disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};

function clampMes(v: string): number {
  return Math.min(12, Math.max(1, parseInt(v, 10) || 1));
}

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ minWidth: 0 }}>
    <label style={lab}>{label}</label>
    {children}
    {hint && <div style={hint2}>{hint}</div>}
  </div>
);

export default RowForm;
