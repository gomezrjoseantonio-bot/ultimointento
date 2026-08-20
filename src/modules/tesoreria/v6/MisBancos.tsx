// ============================================================================
// Tesorería · "Mis Bancos" (F1 · switch Cuentas · Tarjetas)
// ============================================================================
//
// Mockup: `docs/mockups/atlas-bancos-grafico-v5.html` (.bank).
//
// Una sola pieza para las dos cosas que son un banco: las cuentas y las
// tarjetas. Antes vivían separadas —tabla arriba, card suelta abajo— y eso
// obligaba a bajar la vista para ver la otra mitad de lo mismo. Aquí comparten
// espacio y se alternan con un switch: nunca hacen falta las dos a la vez.
//
// El contenedor solo decide QUÉ se ve; el contenido lo siguen pintando
// `TablaCuentas` y `ListaTarjetas`, cada una con su orden, su paginación y su
// menú "⋯" intactos.
//
// El botón de añadir es UNO y cambia con el switch: estando en Tarjetas, un
// "+ Añadir cuenta" manda al sitio equivocado, y dos botones a la vez obligan
// a leer cuál es cuál cada vez.
// ============================================================================

import React, { useState } from 'react';
import { CardV5, Icons } from '../../../design-system/v5';
import type { Account } from '../../../services/db';
import type { KpisHero } from '../../../services/tesoreriaV6Metrics';
import type { Tarjeta } from '../../../types/tarjetas';
import TablaCuentas, { type FilaCuenta } from './TablaCuentas';
import ListaTarjetas, { type FilaTarjeta } from './ListaTarjetas';
import styles from './MisBancos.module.css';

/** Qué mitad del banco se está mirando. */
export type VistaBanco = 'cuentas' | 'tarjetas';

interface Props {
  // ── Cuentas ──
  filasCuentas: FilaCuenta[];
  kpis: KpisHero;
  mesActual: string;
  onAbrirCuenta: (cuenta: Account) => void;
  onEditarCuenta: (cuenta: Account) => void;
  onEliminarCuenta: (cuenta: Account) => void;
  onAnadirCuenta: () => void;
  /** Calendario de §4.9 · vive en la cabecera, no depende del switch. */
  onPrevision: () => void;
  /** Cuenta seleccionada · la que enseña su gráfico diario (F3). */
  cuentaSeleccionada: number | null;
  onSeleccionarCuenta: (cuentaId: number | null) => void;
  /** El gráfico de la cuenta seleccionada · lo arma la página. */
  graficoCuenta?: React.ReactNode;

  // ── Tarjetas ──
  filasTarjetas: FilaTarjeta[];
  onDetalleTarjeta: (t: Tarjeta) => void;
  onEditarTarjeta: (t: Tarjeta) => void;
  onEliminarTarjeta: (t: Tarjeta) => void;
  onAnadirTarjeta: () => void;
}

const MisBancos: React.FC<Props> = ({
  filasCuentas,
  kpis,
  mesActual,
  onAbrirCuenta,
  onEditarCuenta,
  onEliminarCuenta,
  onAnadirCuenta,
  onPrevision,
  cuentaSeleccionada,
  onSeleccionarCuenta,
  graficoCuenta,
  filasTarjetas,
  onDetalleTarjeta,
  onEditarTarjeta,
  onEliminarTarjeta,
  onAnadirTarjeta,
}) => {
  const [vista, setVista] = useState<VistaBanco>('cuentas');
  const enCuentas = vista === 'cuentas';

  const seg = (v: VistaBanco, rotulo: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={vista === v}
      className={`${styles.seg} ${vista === v ? styles.segOn : ''}`}
      onClick={() => setVista(v)}
    >
      {rotulo}
    </button>
  );

  return (
    <CardV5 compact className={styles.card}>
      <div className={styles.hd}>
        <div className={styles.hdIzq}>
          <div className={styles.hdTitulo}>Mis Bancos</div>
          <div className={styles.switch} role="tablist" aria-label="Cuentas o tarjetas">
            {seg('cuentas', 'Cuentas')}
            {seg('tarjetas', 'Tarjetas')}
          </div>
        </div>
        <div className={styles.hdBotones}>
          <button type="button" className={styles.btnGhost} onClick={onPrevision}>
            <Icons.Calendar size={14} strokeWidth={1.9} /> Previsión · meses y días
          </button>
          {/* Un solo botón · la etiqueta y la acción las decide el switch. */}
          <button
            type="button"
            className={styles.btnGhost}
            onClick={enCuentas ? onAnadirCuenta : onAnadirTarjeta}
          >
            {enCuentas ? '+ Añadir cuenta' : '+ Añadir tarjeta'}
          </button>
        </div>
      </div>

      <div className={styles.ayuda}>
        {/* Mirar y tocar se separan (F3): la fila abre el gráfico, y las
            acciones —empezando por el punteo— viven en el "⋯". */}
        {enCuentas
          ? 'clic en una cuenta para ver su día a día · el menú ⋯ abre el punteo'
          : 'clic en una tarjeta para ver sus compras del periodo'}
      </div>

      {enCuentas ? (
        <TablaCuentas
          filas={filasCuentas}
          kpis={kpis}
          mesActual={mesActual}
          onAbrir={onAbrirCuenta}
          onEditar={onEditarCuenta}
          onEliminar={onEliminarCuenta}
          seleccionada={cuentaSeleccionada}
          onSeleccionar={onSeleccionarCuenta}
          grafico={graficoCuenta}
        />
      ) : (
        <ListaTarjetas
          filas={filasTarjetas}
          onDetalle={onDetalleTarjeta}
          onEditar={onEditarTarjeta}
          onEliminar={onEliminarTarjeta}
        />
      )}
    </CardV5>
  );
};

export default MisBancos;
