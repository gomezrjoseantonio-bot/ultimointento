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
  /** Cuentas para el chip de cuenta y el selector del editor. */
  cuentas: Array<{ id: number; label: string }>;
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
  return (
    <button
      type="button"
      className={`${styles.tick} ${cls}`}
      aria-label={label}
      title={label}
      disabled={estado === 'conciliado'}
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
const Contexto: React.FC<{ item: ItemPunteo; extra?: string }> = ({ item, extra }) => {
  const trozos: React.ReactNode[] = [];
  if (item.detalle) trozos.push(<span key="d">{item.detalle}</span>);
  if (item.activo?.alias) {
    trozos.push(
      <span key="a" className={styles.ctxInmueble}>
        <Icons.Inmuebles size={10} strokeWidth={1.8} />
        <b>{item.activo.alias}</b>
      </span>
    );
  }
  if (extra) trozos.push(<span key="e">{extra}</span>);
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
    () => agruparPorEje(filtrarPorBusqueda(filtrarPorChip(items, chip), busqueda), eje),
    [items, chip, busqueda, eje]
  );
  const buscando = busqueda.trim().length > 0;
  const cuentaLabel = useMemo(() => {
    const m = new Map(cuentas.map((c) => [c.id, c.label]));
    return (id: number | null) => (id != null ? m.get(id) ?? `Cuenta ${id}` : '—');
  }, [cuentas]);

  const esDrawer = variant === 'drawer';
  const rowCls = (it: ItemPunteo, extra = '') =>
    [
      styles.row,
      // §6.3 · la rejilla tiene que declarar TANTAS columnas como elementos
      // pinta la fila. Con `sinOrigen` y `ocultarCuenta` se quedaba con menos
      // elementos que columnas, y las acciones —que van al final— caían a una
      // línea nueva: por eso el lápiz y la ✕ aparecían DEBAJO y la fila medía
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
          <div className={styles.concepto}>{it.concepto}</div>
          {!esDrawer ? <Contexto item={it} /> : <Contexto item={it} extra={cuentaLabel(it.cuentaId)} />}
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
            Confirmaste <b>{fmtImporte(it.discrepancia.importeConfirmado)} €</b> · el banco liquidó{' '}
            <b>{fmtImporte(it.discrepancia.importeBanco)} €</b> · diferencia{' '}
            <b>{fmtImporte(it.discrepancia.delta)} €</b>
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
          <div className={styles.c1}>
            <div className={styles.concepto}>
              <span className={styles.caret}>{abierto ? '▾' : '▸'}</span>
              {primera.concepto.replace(/ — .*$/, '')} — {g.total} pagos
            </div>
            <Contexto item={primera} />
          </div>
          {!esDrawer && (
            <span className={`${styles.prog} ${g.completo ? styles.progDone : ''}`}>
              {g.cobradas}/{g.total} cobradas
            </span>
          )}
          {!esDrawer && !ocultarCuenta && <span className={styles.cuenta}>{cuentaLabel(primera.cuentaId)}</span>}
          <span className={`${styles.importe} ${styles.importePos}`}>
            {fmtImporte(g.importeReal)}
            {!g.completo && (
              <span className={styles.importePrevio}>de {fmtImporte(g.importePrevistoTotal)} previstos</span>
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
        <span className={styles.dayName}>{eje === 'fecha' ? fmtDia(g.clave) : g.titulo}</span>
        <span className={styles.daySums}>
          {gruposPlegables && <span className={styles.grupoCount}>{g.items.length}</span>}
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

    return (
      <React.Fragment key={g.clave}>
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
      </React.Fragment>
    );
  };

  return (
    <div>
      {(onEjeChange || onBusquedaChange) && (
        <div className={styles.controles}>
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

      {!esDrawer && (
        <div className={`${styles.cols} ${ocultarCuenta ? styles.colsSinCuenta : ''}`} style={{ marginTop: 10 }}>
          <span>Concepto</span>
          <span>Origen</span>
          {!ocultarCuenta && <span>Cuenta</span>}
          <span className={styles.colImporte}>Importe</span>
          <span className={styles.colTick}><Icons.Check size={10} strokeWidth={2.5} /></span>
        </div>
      )}

      {grupos.length === 0 && <div className={styles.empty}>Nada que puntear con este filtro</div>}

      {grupos.map(renderGrupo)}
    </div>
  );
};

export default PunteoList;
