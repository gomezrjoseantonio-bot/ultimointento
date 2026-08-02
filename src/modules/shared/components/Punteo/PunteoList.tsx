// ============================================================================
// PunteoList · lista canónica de punteo (Bloque 3 · P1 · Registro v2)
// ============================================================================
//
// LA superficie de punteo: las 4 vistas (Movimientos · cuenta · conciliación ·
// drawer del día) renderizan ESTE componente con distinto contexto. Diseño
// validado por Jose (mockup Registro v2):
//   · fila densa · concepto + contexto de activo en dos líneas
//   · punteo con círculo a la DERECHA (previsto discontinuo oro · confirmado
//     navy · conciliado verde) · sin cápsulas de estado (lo dice la tinta)
//   · clic en la fila de un previsto → editor inline (fecha/importe/cuenta
//     reales + «No pasó este mes»)
//   · chips Todos·Previstos·Confirmados·Conciliados·Δ (a 0 se ocultan salvo
//     Todos y Previstos)
//   · madre/hijas por grupo (alquiler por habitaciones)
//   · orden del día: ingresos → gastos · |importe| desc · estable
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import { importeConSigno } from '../../../tesoreria/v6/formatoV6';
import styles from './Punteo.module.css';
import {
  agruparHijas,
  contarEstados,
  chipsVisibles,
  filtrarPorChip,
  esReal,
  type ChipEstado,
  type ItemPunteo,
  type GrupoPunteo,
} from '../../../../services/punteo/punteoModel';
import {
  agruparPorEje,
  filtrarPorBusqueda,
  EJE_LABEL,
  type EjeAgrupacion,
  type GrupoLista,
} from './punteoAgrupacion';

/** Anatomía de fila · `tesoreria` añade editar y descartar al hover (V6 · D2 bis). */
export type RowVariant = 'default' | 'tesoreria';

const EJES: EjeAgrupacion[] = ['fecha', 'inmueble', 'que-es'];

// ─── Formato ────────────────────────────────────────────────────────────────

/**
 * §2.2 · un solo formateador en toda la pantalla.
 *
 * Aquí vivía uno propio que salía sin miles y sin €: junto a un `+1.350,00 €`
 * del hero, el mismo tipo de dato se leía como `+2682,50`. Ahora usa el
 * canónico de V6, que es el que fija §5: miles con punto, decimales solo si los
 * hay, € siempre y el menos tipográfico (−, U+2212).
 *
 * `PunteoList` solo lo usa Tesorería V6, así que importar su formato no
 * acopla nada que no estuviera ya junto.
 */
const fmtImporte = (n: number): string => importeConSigno(n);

const fmtDia = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  const txt = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};

const CHIP_LABEL: Record<ChipEstado, string> = {
  todos: 'Todos',
  previstos: 'Previstos',
  confirmados: 'Confirmados',
  conciliados: 'Conciliados',
  discrepancias: 'Δ',
};

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PunteoListProps {
  items: ItemPunteo[];
  chip: ChipEstado;
  onChipChange: (chip: ChipEstado) => void;
  /**
   * Cuentas para el chip de cuenta y el selector del editor.
   *
   * `color` es opcional y solo lo usa §9: en el día conviven cargos de varias
   * cuentas y hay que ver de cuál sale cada uno sin leer el nombre.
   */
  cuentas: Array<{ id: number; label: string; color?: string }>;
  /** Ocultar columna de cuenta (vista de cuenta única). */
  ocultarCuenta?: boolean;
  /** Variante compacta para el drawer del día. */
  variant?: 'full' | 'drawer';
  /** Puntear · un toque en el círculo, con el importe previsto (A4). */
  onConfirmar: (item: ItemPunteo) => void | Promise<void>;
  /** «No pasó este mes» · descarta esta ocurrencia prevista. */
  onNoPaso: (item: ItemPunteo) => void | Promise<void>;
  /** Marcar una discrepancia como revisada («Entendido»). */
  onRevisarDiscrepancia?: (item: ItemPunteo) => void | Promise<void>;

  // ─── Tesorería V6 · D2 bis ────────────────────────────────────────────────
  // Las cinco fricciones aprobadas entran como props OPCIONALES cuyo valor por
  // defecto es el comportamiento de siempre, para que las otras tres vistas que
  // cuelgan de PunteoList no cambien ni un píxel. `punteoModel.ts` no se toca:
  // nada de esto es modelo, es presentación.

  /**
   * §6.3 · esconder el chip de origen. Se usa en "Por confirmar", donde todo
   * viene del mismo sitio y repetirlo en cada fila solo tapa lo que distingue
   * una de otra. Default `false` = lo de siempre.
   */
  sinOrigen?: boolean;

  /**
   * §6.4 · pintar el chip de estado. Va en "Movimientos" y en el día, donde
   * conviven previsto, confirmado y conciliado. En "Por confirmar" no, porque
   * allí todo es previsto. Default `false` = lo de siempre.
   */
  conChipEstado?: boolean | 'solo-si-difiere';

  /** 1 · Eje de agrupación. Default `fecha` = lo de siempre. */
  eje?: EjeAgrupacion;
  /** Si se pasa, se pinta el selector de eje. Sin él, el eje es fijo. */
  onEjeChange?: (eje: EjeAgrupacion) => void;

  /** 2 · Ocultar los chips de estado para que el contenedor ponga sus pestañas. */
  mostrarChips?: boolean;

  /** 3 · Buscador. Solo se pinta si viene `onBusquedaChange`. */
  busqueda?: string;
  onBusquedaChange?: (q: string) => void;

  /** 4 · Grupos en tarjetas plegadas con recuento y subtotal en cabecera. */
  gruposPlegables?: boolean;

  /**
   * 5 · Anatomía de fila. `tesoreria` saca el descartar del editor a la fila
   * (círculo · concepto · estado · importe · editar · descartar al hover). Variante
   * explícita: el render por defecto no cambia.
   */
  rowVariant?: RowVariant;
  /** Lápiz de la fila · solo en `rowVariant: 'tesoreria'`. */
  onEditar?: (item: ItemPunteo) => void;
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

/**
 * §6.4 · el estado se dice con el CHIP, no con el color del círculo.
 *
 * En "Movimientos" y en el día conviven los tres estados, y hasta ahora la
 * única pista era el color del círculo — que además iba en ámbar, gastando en
 * "esto aún no ha pasado" el color reservado a los avisos.
 *
 * En "Por confirmar" NO se pinta: allí todo es `previsto`, y repetir la misma
 * palabra 250 veces es ruido.
 */
const EstadoChip: React.FC<{ estado: ItemPunteo['estado'] }> = ({ estado }) => {
  const cls =
    estado === 'previsto'
      ? styles.chEPrevisto
      : estado === 'confirmado'
        ? styles.chEConfirmado
        : styles.chEConciliado;
  return <span className={`${styles.chipEstado} ${cls}`}>{estado}</span>;
};

const PunteoCheck: React.FC<{
  estado: ItemPunteo['estado'];
  onPuntear?: () => void;
  concepto: string;
}> = ({ estado, onPuntear, concepto }) => {
  const cls =
    estado === 'previsto'
      ? styles.tickPrevisto
      : estado === 'confirmado'
        ? styles.tickConfirmado
        : styles.tickConciliado;
  const label =
    estado === 'previsto'
      ? `Puntear ${concepto}`
      : estado === 'confirmado'
        ? `${concepto} · confirmado`
        : `${concepto} · conciliado con el banco`;
  // §6.4 · lo conciliado lo afirma el BANCO, no el usuario: ahí no hay nada que
  // pulsar. Un botón deshabilitado sigue pareciendo un botón —invita a
  // intentarlo y no responde—, así que se pinta como lo que es: una marca.
  if (estado === 'conciliado') {
    return (
      <span className={`${styles.tick} ${cls} ${styles.tickInforme}`} title={label} aria-label={label}>
        <Icons.Check size={11} strokeWidth={3} />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.tick} ${cls}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        if (estado === 'previsto') onPuntear?.();
      }}
    >
      {esReal(estado) ? <Icons.Check size={11} strokeWidth={3} /> : null}
    </button>
  );
};

const IconoOrigen: React.FC<{ origen: string }> = ({ origen }) => {
  const size = 10;
  const sw = 1.8;
  switch (origen) {
    case 'Financiación':
      return <Icons.Financiacion size={size} strokeWidth={sw} />;
    case 'Ingreso':
      return <Icons.Ingreso size={size} strokeWidth={sw} />;
    case 'Suministro':
      return <Icons.Suministro size={size} strokeWidth={sw} />;
    case 'Recurrente':
      return <Icons.Refresh size={size} strokeWidth={sw} />;
    case 'Contrato':
      return <Icons.Contratos size={size} strokeWidth={sw} />;
    default:
      return null;
  }
};

/**
 * La línea de debajo del título · §6.3.
 *
 * Orden: qué entiende ATLAS del cargo, y de qué inmueble es. Con el título
 * diciendo QUIÉN cobra, esta línea es la que separa dos recibos gemelos: dos
 * "Mapfre" de 40,29 € y 40,23 € se distinguen porque una dice "seguro hogar ·
 * Tenderina 64" y la otra "seguro hogar · Los Robles 12".
 *
 * Lo que no aporta, no se pinta: sin inmueble y sin detalle no hay subtítulo,
 * en vez de una línea que solo dice "Personal" en todas las filas.
 */
const Contexto: React.FC<{ item: ItemPunteo; extra?: string; sinActivo?: boolean }> = ({
  item,
  extra,
  sinActivo,
}) => {
  const trozos: React.ReactNode[] = [];
  if (item.detalle) trozos.push(<span key="d">{item.detalle}</span>);
  // §6.3 · en una hija el piso NO se repite: lo encabeza la madre justo encima,
  // y decirlo otra vez en cada habitación es escribirlo cuatro veces para el
  // mismo piso.
  if (!sinActivo && item.activo?.alias) {
    trozos.push(
      <span key="a" className={styles.ctxInmueble}>
        <Icons.Inmuebles size={10} strokeWidth={1.8} />
        <b>{item.activo.alias}</b>
      </span>
    );
  }
  if (extra) trozos.push(<span key="e">{extra}</span>);
  // §9 · el aviso va el ÚLTIMO y en ámbar: es lo único de la línea que pide
  // actuar, y el ámbar está reservado justo para eso (§2.1).
  if (item.avisoSaldo) {
    trozos.push(
      <span key="w" className={styles.ctxAviso}>
        {item.avisoSaldo}
      </span>
    );
  }
  if (trozos.length === 0) return null;

  return (
    <div className={styles.contexto}>
      {trozos.map((t, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={styles.ctxSep}> · </span>}
          {t}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Componente principal ───────────────────────────────────────────────────

const PunteoList: React.FC<PunteoListProps> = ({
  items,
  chip,
  onChipChange,
  cuentas,
  ocultarCuenta = false,
  sinOrigen = false,
  conChipEstado = false,
  variant = 'full',
  onConfirmar,
  onNoPaso,
  onRevisarDiscrepancia,
  eje = 'fecha',
  onEjeChange,
  mostrarChips = true,
  busqueda = '',
  onBusquedaChange,
  gruposPlegables = false,
  rowVariant = 'default',
  onEditar,
}) => {
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  // §4.4 · "grupos en tarjetas PLEGADAS … se abren al buscar": nacen cerrados,
  // así que el estado guarda los que el usuario ha abierto, no los cerrados.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const conteo = useMemo(() => contarEstados(items), [items]);
  const chips = useMemo(() => {
    const vis = chipsVisibles(conteo);
    // El chip activo nunca desaparece aunque quede a 0 (evita quedarte
    // atrapado en un filtro sin salida visible).
    return vis.includes(chip) ? vis : [...vis, chip];
  }, [conteo, chip]);

  // Chip → buscador → eje. El buscador filtra sobre lo ya acotado por el chip,
  // que es lo que espera §4.4 ("los grupos se abren al buscar").
  const grupos = useMemo(
    () => agruparPorEje(filtrarPorBusqueda(filtrarPorChip(items, chip), busqueda), eje, cuentas),
    [items, chip, busqueda, eje, cuentas]
  );
  /** Agrupando por cuenta, la cuenta está en la cabecera: en la fila sobra. */
  const porCuenta = eje === 'cuenta';
  const buscando = busqueda.trim().length > 0;
  const cuentaLabel = useMemo(() => {
    const m = new Map(cuentas.map((c) => [c.id, c.label]));
    return (id: number | null) => (id != null ? m.get(id) ?? `Cuenta ${id}` : '—');
  }, [cuentas]);

  /** §9 · color del banco de esa cuenta, si lo trae quien nos llama. */
  const colorCuenta = useMemo(() => {
    const m = new Map(cuentas.map((c) => [c.id, c.color]));
    return (id: number | null) => (id != null ? m.get(id) : undefined);
  }, [cuentas]);

  const esDrawer = variant === 'drawer';
  // Las tarjetas por día son de la bandeja de trabajo (§6.3). En el drawer del
  // día no tienen sentido: allí solo hay un día.
  const enTarjetas = !esDrawer && eje === 'fecha' && rowVariant === 'tesoreria';
  const rowCls = (it: ItemPunteo, extra = '') =>
    [
      styles.row,
      // §6.3 · la rejilla tiene que declarar TANTAS columnas como elementos
      // pinta la fila. Con `sinOrigen` y `ocultarCuenta` se quedaba con menos
      // elementos que columnas, y las acciones —que van al final— caían a una
      // línea nueva: por eso editar y descartar aparecían DEBAJO y la fila medía
      // el doble de lo necesario.
      esDrawer
        ? styles.rowCompact
        : sinOrigen && ocultarCuenta
          ? styles.rowMinima
          : ocultarCuenta
            ? styles.rowSinCuenta
            : '',
      it.estado === 'previsto' ? styles.rowPrevisto : styles.rowReal,
      extra,
    ]
      .filter(Boolean)
      .join(' ');

  const renderImporte = (it: ItemPunteo) => (
    <span className={`${styles.importe} ${it.importe > 0 ? styles.importePos : styles.importeNeg}`}>
      {fmtImporte(it.importe)}
      {it.discrepancia && !it.discrepancia.revisada && (
        <span className={styles.deltaBadge}>Δ {fmtImporte(it.discrepancia.delta)}</span>
      )}
      {it.importePrevisto != null && it.importePrevisto !== it.importe && (
        <span className={styles.importePrevio}>previsto {fmtImporte(it.importePrevisto)}</span>
      )}
    </span>
  );

  const renderFila = (it: ItemPunteo, hija = false) => (
    <React.Fragment key={it.key}>
      {/* A4 · la fila ya NO abre un editor. Un toque en el círculo confirma y
          punto; si el importe real difiere, para eso está el lápiz, que abre la
          ficha de §4.5. Cinco decisiones para decir "sí, esto pasó" era
          fricción en la acción más repetida de la pantalla. */}
      <div className={rowCls(it, hija ? styles.rowHija : '')}>
        {/* La acción principal, a la IZQUIERDA · es lo primero que se busca. */}
        <PunteoCheck estado={it.estado} concepto={it.concepto} onPuntear={() => onConfirmar(it)} />
        <div className={styles.c1}>
          <div className={styles.conceptoLinea}>
            {/* §9 · el punto del banco · en el día conviven varias cuentas y
                hay que ver de cuál sale cada cargo de un vistazo. */}
            {!porCuenta && colorCuenta(it.cuentaId) && (
              <span
                className={styles.puntoBanco}
                style={{ background: colorCuenta(it.cuentaId) }}
                aria-hidden="true"
              />
            )}
            <span className={styles.concepto}>{it.concepto}</span>
            {/* `solo-si-difiere` · el chip solo cuando NO es previsto.
                En una pantalla que existe justamente para enseñar previsiones,
                escribir "previsto" en cada fila no dice nada nuevo: solo
                distingue el que se sale de la norma —lo ya confirmado, lo ya
                real—, que es cuando la palabra informa. */}
            {(conChipEstado === true ||
              (conChipEstado === 'solo-si-difiere' && it.estado !== 'previsto')) && (
              <EstadoChip estado={it.estado} />
            )}
          </div>
          {esDrawer && !porCuenta ? (
            <Contexto item={it} extra={cuentaLabel(it.cuentaId)} sinActivo={hija} />
          ) : (
            <Contexto item={it} sinActivo={hija} />
          )}
        </div>
        {/* §6.3 · el chip de origen desaparece de "Por confirmar".
            Ahí todo viene del mismo sitio, así que salía "Recurrente" ocho
            veces seguidas ocupando el centro de la fila: repetir en cada línea
            un dato que no varía no informa, solo tapa lo que sí distingue una
            fila de otra. En "Movimientos", donde conviven orígenes distintos,
            sigue estando. */}
        {!esDrawer && !sinOrigen && (
          <span className={styles.origen}>
            <IconoOrigen origen={it.origen} />
            {it.origen}
          </span>
        )}
        {!esDrawer && !ocultarCuenta && <span className={styles.cuenta}>{cuentaLabel(it.cuentaId)}</span>}
        {renderImporte(it)}
        {rowVariant === 'tesoreria' && (
          // §4.4 · editar y descartar en la fila, al hover. El descartar sale del editor
          // inline y solo existe en esta variante; en las otras vistas la fila no
          // cambia. `stopPropagation` obligatorio: la fila entera abre el editor.
          <span className={styles.rowActions}>
            {onEditar && (
              <button
                type="button"
                className={styles.rowAction}
                aria-label={`Editar ${it.concepto}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar(it);
                }}
              >
                <Icons.Edit size={13} strokeWidth={1.8} />
              </button>
            )}
            {it.estado === 'previsto' && (
              <button
                type="button"
                className={styles.rowAction}
                aria-label={`Descartar ${it.concepto}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onNoPaso(it);
                }}
              >
                <Icons.Close size={13} strokeWidth={2} />
              </button>
            )}
          </span>
        )}
      </div>
      {it.discrepancia && !it.discrepancia.revisada && onRevisarDiscrepancia && (
        <div className={styles.discNote}>
          <span>
            {/* El € lo pone el formateador · escribirlo aquí daba "40,29 € €". */}
            Confirmaste <b>{fmtImporte(it.discrepancia.importeConfirmado)}</b> · el banco liquidó{' '}
            <b>{fmtImporte(it.discrepancia.importeBanco)}</b> · diferencia{' '}
            <b>{fmtImporte(it.discrepancia.delta)}</b>
          </span>
          <button type="button" className={styles.discOk} onClick={() => onRevisarDiscrepancia(it)}>
            Entendido <Icons.Close size={10} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </React.Fragment>
  );

  const renderMadre = (g: GrupoPunteo) => {
    const abierto = gruposAbiertos[g.grupoId] ?? !g.completo;
    const primera = g.hijas[0];
    return (
      <React.Fragment key={`grupo-${g.grupoId}`}>
        <div
          className={rowCls(primera, styles.rowEditable)}
          role="button"
          tabIndex={0}
          onClick={() => setGruposAbiertos((s) => ({ ...s, [g.grupoId]: !abierto }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setGruposAbiertos((s) => ({ ...s, [g.grupoId]: !abierto }));
          }}
        >
          {/* La madre ocupa las MISMAS columnas que sus hijas.
              Sin esta primera celda no pintaba nada donde las hijas llevan su
              círculo, así que la rejilla la corría un carril entero: el nombre
              del piso caía en la columna de 22px del punteo y salía partido
              letra a letra ("T e…"), y el importe donde va el concepto.
              Aquí va el caret, que además es lo que se pulsa para plegar. */}
          <span className={styles.caret} aria-hidden="true">{abierto ? '▾' : '▸'}</span>
          {/* §6.3 · la madre es EL PISO, no el primer inquilino.
              Al agrupar por inmueble, poner aquí el concepto de la primera hija
              dejaba el grupo con nombre de una de sus partes: se leía como si
              las demás rentas colgasen de la de Alisse. El piso es lo que las
              junta, así que es lo que va en la cabecera; los inquilinos, cada
              uno en su fila. */}
          <div className={styles.c1}>
            {/* "Alquiler · el piso" · la madre dice QUÉ es y DE DÓNDE, y así
                sus hijas no tienen que repetir ninguna de las dos cosas: cada
                una se queda con lo suyo, el inquilino y su habitación. */}
            {/* Sin alias resuelto, "Alquiler" A SECAS · nunca el inquilino.
                El respaldo era el concepto de la primera hija, y al quitarle a
                las hijas el "Renta – " eso pasó a ser un nombre de persona: el
                grupo volvía a titularse con una de sus partes, que es
                exactamente lo que §6.3 vino a arreglar. Decir menos es
                preferible a decir algo que engaña. */}
            <div className={styles.concepto}>
              {primera.activo
                ? `Alquiler${primera.activo.alias ? ` · ${primera.activo.alias}` : ''}`
                : primera.concepto.replace(/ — .*$/, '')}
            </div>
            <div className={styles.contexto}>
              {g.total} {g.total === 1 ? 'renta' : 'rentas'}
            </div>
          </div>
          {!esDrawer && (
            <span className={`${styles.prog} ${g.completo ? styles.progDone : ''}`}>
              {g.cobradas}/{g.total} cobradas
            </span>
          )}
          {!esDrawer && !ocultarCuenta && <span className={styles.cuenta}>{cuentaLabel(primera.cuentaId)}</span>}
          {/* En el DÍA manda lo previsto.
              Ahí no ha cobrado nada todavía —es una cola de pendientes— así que
              `importeReal` es 0, y un "0 €" de titular con "de +395,10 €
              previstos" debajo se lee como que el piso no ha entrado nada,
              cuando lo que pasa es que aún no toca. En "Movimientos", donde sí
              conviven cobradas y pendientes, el par real/previsto es el dato y
              se queda. */}
          <span className={`${styles.importe} ${styles.importePos}`}>
            {esDrawer ? (
              fmtImporte(g.importePrevistoTotal)
            ) : (
              <>
                {fmtImporte(g.importeReal)}
                {!g.completo && (
                  <span className={styles.importePrevio}>
                    de {fmtImporte(g.importePrevistoTotal)} previstos
                  </span>
                )}
              </>
            )}
          </span>
          <span />
        </div>
        {abierto && g.hijas.map((h) => renderFila(h, true))}
      </React.Fragment>
    );
  };

  const renderGrupo = (g: GrupoLista) => {
    const hijas = agruparHijas(g.items);
    const enGrupo = new Set<string>();
    for (const x of hijas.values()) for (const h of x.hijas) enGrupo.add(h.key);
    const pintados = new Set<string>();
    // Buscando, los grupos se abren (§4.4). Fuera de eso: plegables → cerrado
    // salvo que el usuario lo abra; no plegables → siempre abierto.
    const abierto = !gruposPlegables || buscando || Boolean(abiertos[g.clave]);

    const cuerpo = g.items.map((it) => {
      if (it.grupoId && enGrupo.has(it.key)) {
        const gg = hijas.get(it.grupoId)!;
        if (pintados.has(gg.grupoId)) return null;
        pintados.add(gg.grupoId);
        return renderMadre(gg);
      }
      return renderFila(it);
    });

    const cabecera = (
      <div className={styles.dayRule}>
        <span className={styles.dayName}>
          {/* §4.9 · el punto de banco sube de la fila a la cabecera: con el
              grupo entero bajo el nombre de su cuenta, repetirlo en cada línea
              es decir siete veces lo mismo. */}
          {porCuenta && g.cuentaId != null && colorCuenta(g.cuentaId) && (
            <span
              className={styles.puntoBanco}
              style={{ background: colorCuenta(g.cuentaId) }}
              aria-hidden="true"
            />
          )}
          {eje === 'fecha' ? fmtDia(g.clave) : g.titulo}
        </span>
        <span className={styles.daySums}>
          {/* §6.4 · el recuento va PEGADO al importe y se leía como parte de la
              cifra: "INMUEBLE 1 · 1 · −98,44" parece un importe raro, no "un
              movimiento que suma −98,44". Separado y en su sitio. */}
          {gruposPlegables && (
            <span className={styles.grupoCount}>
              {g.items.length} {g.items.length === 1 ? 'movimiento' : 'movimientos'}
            </span>
          )}
          {gruposPlegables ? (
            <span className={g.subtotal < 0 ? styles.daySumNeg : styles.daySumPos}>
              {fmtImporte(g.subtotal)}
            </span>
          ) : (
            <>
              {g.totalIngresos > 0 && <span className={styles.daySumPos}>{fmtImporte(g.totalIngresos)}</span>}
              {g.totalGastos < 0 && <span className={styles.daySumNeg}>{fmtImporte(g.totalGastos)}</span>}
            </>
          )}
        </span>
      </div>
    );

    // §6.3 · cada día es una TARJETA, no una cabecera suelta sobre una lista
    // plana. Con todo corrido no se ve dónde acaba un día y empieza el
    // siguiente, y el subtotal de la cabecera parece de la lista entera.
    // §9 · en el drawer del día la cabecera del grupo REPITE el día que ya
    // encabeza el panel: salía "sábado · 1 ago 2026" y debajo "SÁBADO, 1 DE
    // AGOSTO". Con un solo grupo no hay nada que separar, así que sobra.
    //
    // Agrupando por cuenta NO se calla aunque el grupo sea único: ahí la
    // cabecera no repite el día, dice de qué cuenta sale todo lo de abajo, que
    // es justo el dato que la lista plana no daba.
    if (esDrawer && eje === 'fecha' && grupos.length === 1) {
      return <React.Fragment key={g.clave}>{cuerpo}</React.Fragment>;
    }

    return (
      <div className={enTarjetas ? styles.diaCard : undefined} key={g.clave}>
        {gruposPlegables ? (
          <button
            type="button"
            className={styles.grupoToggle}
            aria-expanded={abierto}
            onClick={() => setAbiertos((s) => ({ ...s, [g.clave]: !s[g.clave] }))}
          >
            {cabecera}
          </button>
        ) : (
          cabecera
        )}
        {abierto && cuerpo}
      </div>
    );
  };

  return (
    <div>
      {/* §6.4 · buscar es lo primero que se hace al entrar aquí, así que va a
          la IZQUIERDA. Agrupar es afinar lo que ya se está mirando: a la
          derecha. Estaba al revés. */}
      {(onEjeChange || onBusquedaChange) && (
        <div className={styles.controles}>
          {onBusquedaChange && (
            <input
              type="search"
              className={styles.buscador}
              value={busqueda}
              placeholder="Buscar"
              aria-label="Buscar por concepto, inmueble, familia o importe"
              onChange={(ev) => onBusquedaChange(ev.target.value)}
            />
          )}
          {onEjeChange && (
            <div className={styles.ejes} role="tablist" aria-label="Agrupar por">
              {EJES.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="tab"
                  aria-selected={eje === e}
                  className={`${styles.ejeBtn} ${eje === e ? styles.ejeOn : ''}`}
                  onClick={() => onEjeChange(e)}
                >
                  {EJE_LABEL[e]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mostrarChips && (
      <div className={styles.chips} role="tablist" aria-label="Filtrar por estado de punteo">
        {chips.map((c) => {
          const n =
            c === 'todos'
              ? conteo.todos
              : c === 'previstos'
                ? conteo.previstos
                : c === 'confirmados'
                  ? conteo.confirmados
                  : c === 'conciliados'
                    ? conteo.conciliados
                    : conteo.discrepancias;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={chip === c}
              className={`${styles.chip} ${c === 'discrepancias' ? styles.chipWarn : ''} ${chip === c ? styles.chipOn : ''}`}
              onClick={() => onChipChange(c)}
            >
              {CHIP_LABEL[c]} <span className={styles.chipCount}>{n}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* §6.4 · sin cabeceras de columna.
          Rotulaban lo que ya se lee solo —un importe se reconoce por ser un
          importe— y encima el tick de la última prometía una columna ordenable
          que no existe. El mockup no las tiene. */}

      {grupos.length === 0 && <div className={styles.empty}>Nada que puntear con este filtro</div>}

      {grupos.map(renderGrupo)}
    </div>
  );
};

export default PunteoList;
