/**
 * Bloque núcleo · TUS CUENTAS (FIX PUNTO 4 · fusión cuentas+extractos).
 *
 * Antes era una página-puente (`ctaTo="/tesoreria"`) que te soltaba en Tesorería
 * sin volver ni marcar el bloque (P1). Ahora ES la gestión, dentro del flujo:
 *   · lista de cuentas (alias · banco · saldo · chip "con extracto"/"a mano");
 *   · "Añadir cuenta" abre el modal REAL existente (<CuentaWizard>) SOBRE el flujo;
 *   · por cuenta · "Subir extracto" (→ subidor con cuenta destino PREFIJADA y
 *     BLOQUEADA · mata el callejón sin salida P7) y "Editar saldo" (modal);
 *   · la revisión de sugerencias vive en una sección DENTRO del bloque.
 *
 * Cierre del bucle (P5) · al crear/editar una cuenta o volver de subir un
 * extracto se refresca el progreso · `syncNucleoFromData` marca `cuentas`
 * completado con ≥1 cuenta y recalcula el % (hub + widget Panel).
 *
 * Ejes (§3.6) · el saldo de HOY sale de `accounts`; los extractos alimentan
 * `movements` (vida en directo del año en curso · NUNCA treasuryEvents). Sin
 * backfill histórico.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import OnboardingTopbar from '../OnboardingTopbar';
import { useOnboarding } from '../OnboardingContext';
import CuentaWizard from '../../../../components/cuenta/CuentaWizard';
import SugerenciasSection from './SugerenciasSection';
import { loadSaldosActualesCuentas } from '../../../mi-plan/wizards/utils/getCurrentSaldoCuenta';
import { setCuentaVia } from '../../../../services/onboardingProgressService';
import type { Account } from '../../../../services/db';
import styles from '../empezar.module.css';

const eur = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const avatarLetters = (src: string): string => {
  const s = (src || 'CC').trim();
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
};

const bancoDe = (a: Account): string => a.banco?.name || a.bank || 'Banco';
const aliasDe = (a: Account): string => a.alias || a.name || bancoDe(a);
const last4 = (a: Account): string => (a.iban ? `···${a.iban.replace(/\s/g, '').slice(-4)}` : '');

const CuentasBloque: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, refresh } = useOnboarding();

  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [saldos, setSaldos] = useState<Map<number, number>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const extractoCerrado = useRef(false);

  const reload = useCallback(async () => {
    const { cuentas: cs, saldos: ss } = await loadSaldosActualesCuentas();
    setCuentas(cs);
    setSaldos(ss);
    setCargando(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Vuelta de subir extracto (`?extracto=N`) · marca la cuenta "con extracto",
  // refresca saldo/progreso y limpia el parámetro (idempotente).
  const extractoParam = searchParams.get('extracto');
  useEffect(() => {
    if (!extractoParam || extractoCerrado.current) return;
    const accountId = Number(extractoParam);
    extractoCerrado.current = true;
    void (async () => {
      if (Number.isFinite(accountId)) {
        await setCuentaVia(accountId, 'con_extracto').catch(() => undefined);
        showToastV5('Extracto procesado · saldo actualizado', 'success');
      }
      await refresh();
      await reload();
      const next = new URLSearchParams(searchParams);
      next.delete('extracto');
      setSearchParams(next, { replace: true });
    })();
  }, [extractoParam, searchParams, setSearchParams, refresh, reload]);

  const abrirNueva = () => {
    setEditing(null);
    setWizardOpen(true);
  };
  const abrirEditar = (acc: Account) => {
    setEditing(acc);
    setWizardOpen(true);
  };

  const onWizardSuccess = useCallback(async () => {
    // Crear/editar cuenta a mano → cierra el bucle (marca `cuentas` y recalcula %).
    await refresh();
    await reload();
  }, [refresh, reload]);

  const subirExtracto = (acc: Account) => {
    // La cuenta destino llega PREFIJADA y BLOQUEADA (?accountId) · nace de esta
    // fila concreta · imposible un selector vacío (P7 muerto por construcción).
    navigate(`/tesoreria/importar?accountId=${acc.id}&from=empezar`);
  };

  const viaDe = (acc: Account): 'con_extracto' | 'declarada_a_mano' =>
    acc.id != null && state.cuentas[acc.id] === 'con_extracto' ? 'con_extracto' : 'declarada_a_mano';

  const totalSaldo = useMemo(
    () => cuentas.reduce((acc, c) => acc + (c.id != null ? saldos.get(c.id) ?? 0 : 0), 0),
    [cuentas, saldos],
  );

  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>Bloque núcleo · tus cuentas</div>
        <h1 className={styles.h1}>Tus cuentas</h1>
        <p className={styles.sub}>
          Da de alta tus cuentas con el saldo de hoy · es el punto de partida de tu caja prevista. Por cada cuenta
          puedes subir su extracto (saldo real + sugerencias) o dejar el saldo a mano.
        </p>

        <div className={styles.acctToolbar}>
          <button type="button" className={styles.btnGold} onClick={abrirNueva}>
            <Icons.Plus size={14} strokeWidth={2.5} /> Añadir cuenta
          </button>
          {cuentas.length > 0 && (
            <div className={styles.acctTotal}>
              <span className={styles.acctTotalLabel}>Saldo total hoy</span>
              <span className={`${styles.acctTotalVal} ${styles.mono}`}>{eur(totalSaldo)}</span>
            </div>
          )}
        </div>

        {cargando ? (
          <div className={styles.sugEmptyNote}>Cargando tus cuentas…</div>
        ) : cuentas.length === 0 ? (
          <div className={styles.acctEmpty}>
            Aún no tienes cuentas · empieza por tus 2-3 principales con el saldo de hoy. El resto (y los extractos)
            puedes añadirlos cuando quieras.
          </div>
        ) : (
          <div className={styles.acctList}>
            {cuentas.map((acc) => {
              const via = viaDe(acc);
              return (
                <div key={acc.id} className={styles.acctRow}>
                  <div className={styles.acctAvatar}>{avatarLetters(aliasDe(acc))}</div>
                  <div className={styles.acctMain}>
                    <div className={styles.acctName}>{aliasDe(acc)}</div>
                    <div className={styles.acctMeta}>
                      {bancoDe(acc)} {last4(acc)}
                    </div>
                  </div>
                  <span
                    className={`${styles.chip} ${via === 'con_extracto' ? styles.chipExtracto : styles.chipManual}`}
                  >
                    {via === 'con_extracto' ? 'con extracto' : 'a mano'}
                  </span>
                  <div className={`${styles.acctSaldo} ${styles.mono}`}>
                    {acc.id != null ? eur(saldos.get(acc.id) ?? 0) : '—'}
                  </div>
                  <div className={styles.acctActions}>
                    <button type="button" className={styles.acctBtn} onClick={() => subirExtracto(acc)}>
                      <Icons.Upload size={13} strokeWidth={2} /> Subir extracto
                    </button>
                    <button type="button" className={styles.acctBtn} onClick={() => abrirEditar(acc)}>
                      <Icons.Edit size={13} strokeWidth={2} /> Editar saldo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sugerencias · sección DENTRO del bloque (extractos → recurrentes/préstamo/nómina). */}
        <SugerenciasSection />

        <div className={styles.stepNav}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/empezar/hub')}>
            <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Volver al mapa
          </button>
        </div>
      </div>

      <CuentaWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={onWizardSuccess}
        editingAccount={editing}
      />
    </>
  );
};

export default CuentasBloque;
