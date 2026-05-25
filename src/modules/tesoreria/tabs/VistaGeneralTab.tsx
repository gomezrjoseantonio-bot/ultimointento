import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import {
  CardV5,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import { EmptyState as EmptyStateCanonico } from '../../../components/common/EmptyState';
import {
  BankAccountCard,
  BankAccountAddCard,
} from '../components/BankAccountCard';
import CalendarioMes12 from '../../../components/treasury/CalendarioMes12';
import MesDetalleDrawer from '../../../components/treasury/MesDetalleDrawer';
import MovimientoDrawer, {
  type MovimientoDrawerData,
  type MovimientoDrawerPatch,
} from '../../../components/treasury/MovimientoDrawer';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import {
  confirmTreasuryEvent,
  updateTreasuryEventFields,
} from '../../../services/treasuryConfirmationService';
import type { TesoreriaContext } from '../TesoreriaPage';
import styles from './VistaGeneralTab.module.css';
import CuentaWizard from '../../../components/cuenta/CuentaWizard';
import { cuentasService } from '../../../services/cuentasService';
import type { Account } from '../../../services/db';

const VistaGeneralTab: React.FC = () => {
  const navigate = useNavigate();
  const { accounts, movements, treasuryEvents, properties, totalSaldo, reload } =
    useOutletContext<TesoreriaContext>();

  // Modal nueva/editar cuenta
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const openCreateAccount = () => {
    setEditingAccount(null);
    setShowAccountModal(true);
  };

  const openEditAccount = async (id: number) => {
    try {
      const acc = await cuentasService.get(id);
      if (!acc) {
        showToastV5('Cuenta no encontrada', 'error');
        return;
      }
      setEditingAccount(acc);
      setShowAccountModal(true);
    } catch (err) {
      console.error('[Tesoreria] openEditAccount failed', err);
      showToastV5('No se pudo abrir la cuenta · ver consola', 'error');
    }
  };

  // T31 · drawer detalle mes (clic en mes-card del calendario)
  const [drawerMes, setDrawerMes] = useState<{ year: number; monthIndex0: number } | null>(null);
  // T31 · drawer detalle movimiento (clic en pend-card o evento del mes)
  const [drawerMovId, setDrawerMovId] = useState<number | string | null>(null);
  // T31 · paginación carrusel cuentas (5 visibles · mockup v8)
  const [cuentasPage, setCuentasPage] = useState(0);

  const pendientesPorCuenta = useMemo(() => {
    const map = new Map<number, number>();
    movements.forEach((m) => {
      if (
        m.estado_conciliacion === 'sin_conciliar' ||
        m.unifiedStatus === 'no_planificado'
      ) {
        const cur = map.get(m.accountId) ?? 0;
        map.set(m.accountId, cur + 1);
      }
    });
    return map;
  }, [movements]);

  // S-TESORERIA-FASE-B sub-tarea 2 · click card cuenta navega a vista cuenta
  // (`/tesoreria/cuenta/:id` · ruta nueva creada en spec siguiente
  // S-TESORERIA-FASE-B-VISTA-CUENTA · hoy redirige a movimientos filtrado).
  const handleAccountClick = (id: number) => {
    navigate(`/tesoreria/cuenta/${id}`);
  };

  return (
    <>
      {/* Carrusel cuentas · 5 visibles por página + flechas (mockup v8) */}
      {(() => {
        const PAGE_SIZE = 5;
        const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
        const safePage = Math.min(cuentasPage, totalPages - 1);
        const startIdx = safePage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, accounts.length);
        const pageAccounts = accounts.slice(startIdx, endIdx);
        const isLastPage = safePage >= totalPages - 1;
        // Reservamos slots vacíos para mantener 5 columnas exactas
        const emptySlots = Math.max(
          0,
          PAGE_SIZE - pageAccounts.length - (isLastPage ? 1 : 0),
        );
        return (
          <>
            <div className={styles.cuentasHd}>
              <span>
                Mis cuentas · {accounts.length === 0
                  ? 0
                  : `${startIdx + 1}-${endIdx} de ${accounts.length}`}
              </span>
              {accounts.length > 0 && (
                <div className={styles.cuentasArrows}>
                  <button
                    type="button"
                    className={styles.cuentasArr}
                    onClick={() => setCuentasPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    aria-label="Cuentas anteriores"
                  >
                    <Icons.ChevronLeft size={14} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    className={styles.cuentasArr}
                    onClick={() =>
                      setCuentasPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={safePage >= totalPages - 1}
                    aria-label="Cuentas siguientes"
                  >
                    <Icons.ChevronRight size={14} strokeWidth={1.8} />
                  </button>
                </div>
              )}
            </div>
            {accounts.length === 0 ? (
              <EmptyStateCanonico
                icon={Wallet}
                title="Sin cuentas aún"
                subtitle="Añade tu primera cuenta bancaria para empezar a ver el flujo de tesorería."
                cta={{
                  label: 'Añadir cuenta',
                  onClick: openCreateAccount,
                }}
              />
            ) : (
              <div className={styles.cuentasGrid}>
                {pageAccounts.map((acc) => (
                  <BankAccountCard
                    key={acc.id}
                    account={acc}
                    pendingCount={pendientesPorCuenta.get(acc.id ?? -1) ?? 0}
                    delta30d={null}
                    onClick={handleAccountClick}
                    onEdit={(id) => void openEditAccount(id)}
                  />
                ))}
                {isLastPage && (
                  <BankAccountAddCard onClick={openCreateAccount} />
                )}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} className={styles.cuentaEmptySlot} />
                ))}
              </div>
            )}
          </>
        );
      })()}

      <CardV5 className={styles.card} style={{ marginTop: 14 }}>
        <CalendarioMes12
          events={treasuryEvents}
          movements={movements as unknown as { date: string; amount: number }[]}
          accounts={accounts}
          totalSaldo={totalSaldo}
          onMonthClick={(year, monthIndex0) => setDrawerMes({ year, monthIndex0 })}
        />
      </CardV5>

      <MesDetalleDrawer
        open={drawerMes !== null}
        year={drawerMes?.year ?? null}
        monthIndex0={drawerMes?.monthIndex0 ?? null}
        events={treasuryEvents}
        accounts={accounts}
        onClose={() => setDrawerMes(null)}
        onEventClick={(eventId) => setDrawerMovId(eventId)}
        onIrAConciliacionDia={(dayIso, accountId) => {
          setDrawerMes(null);
          const params = new URLSearchParams();
          params.set('day', dayIso);
          if (accountId != null) params.set('cuenta', String(accountId));
          navigate(`/tesoreria/movimientos?${params.toString()}`);
        }}
        onConciliarSeleccion={async (eventIds) => {
          // Sub-tarea 4 calendario fixes · conciliar bulk desde el drawer día.
          // No existe servicio bulk · loop confirmTreasuryEvent por id (Opción A).
          let ok = 0;
          let failed = 0;
          for (const id of eventIds) {
            try {
              await confirmTreasuryEvent(id);
              ok += 1;
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[tesoreria/drawer-dia] confirmar falló', id, err);
              failed += 1;
            }
          }
          invalidateCachedStores(['treasuryEvents', 'movements', 'accounts']);
          reload();
          if (ok > 0 && failed === 0) {
            showToastV5(
              `${ok} movimiento${ok === 1 ? '' : 's'} conciliado${ok === 1 ? '' : 's'}`,
              'success',
            );
          } else if (ok > 0 && failed > 0) {
            showToastV5(
              `Conciliados: ${ok} · fallidos: ${failed} · ver consola`,
              'error',
            );
          } else {
            showToastV5('No se pudo conciliar · ver consola', 'error');
          }
          return { ok, failed };
        }}
      />

      <MovimientoDrawer
        open={drawerMovId !== null}
        data={(() => {
          if (drawerMovId == null) return null;
          const ev = treasuryEvents.find(
            (e: any) => String(e.id) === String(drawerMovId),
          );
          if (!ev) return null;
          const acc = accounts.find((a) => a.id === (ev as any).accountId);
          const accountAlias = acc?.alias || acc?.banco?.name || acc?.name;
          // Hidratar inmueble desde properties si el evento no trae alias
          // denormalizado (caso común en eventos antiguos / sin sync).
          const inmuebleId = (ev as any).inmuebleId;
          const inmuebleAlias =
            ev.inmuebleAlias ||
            (inmuebleId != null
              ? properties.find((p) => p.id === inmuebleId)?.alias
              : undefined);
          const drawerData: MovimientoDrawerData = {
            id: ev.id,
            description: (ev as any).description,
            predictedDate: (ev as any).predictedDate,
            type: (ev as any).type,
            amount: (ev as any).amount,
            status: (ev as any).status,
            accountAlias,
            inmuebleAlias,
            contratoAlias: (ev as any).contratoAlias,
            categoryLabel: (ev as any).categoryLabel,
            origenTexto:
              (ev as any).sourceType === 'contrato'
                ? 'Generado automáticamente desde el contrato activo · regla recurrente.'
                : (ev as any).sourceType === 'nomina'
                  ? 'Generado automáticamente desde la nómina activa.'
                  : (ev as any).sourceType === 'hipoteca' ||
                      (ev as any).sourceType === 'prestamo'
                    ? 'Generado desde el cuadro de amortización del préstamo.'
                    : (ev as any).sourceType === 'gasto_recurrente' ||
                        (ev as any).sourceType === 'opex_rule'
                      ? 'Generado desde un compromiso recurrente.'
                      : (ev as any).sourceType === 'manual'
                        ? 'Movimiento previsto creado manualmente.'
                        : undefined,
            sourceType: (ev as any).sourceType,
          };
          return drawerData;
        })()}
        onClose={() => setDrawerMovId(null)}
        accounts={accounts}
        onSave={async (id, patch: MovimientoDrawerPatch) => {
          try {
            const dbId = typeof id === 'number' ? id : Number(id);
            if (Number.isFinite(dbId)) {
              await updateTreasuryEventFields(dbId, patch);
              invalidateCachedStores(['treasuryEvents']);
              reload();
              showToastV5('Cambios guardados', 'success');
            }
            setDrawerMovId(null);
          } catch (err) {
            console.error('[Movimiento] guardar falló', err);
            showToastV5('No se pudo guardar · ver consola', 'error');
          }
        }}
        onConfirmar={async (id) => {
          try {
            const dbId = typeof id === 'number' ? id : Number(id);
            if (Number.isFinite(dbId)) {
              const { confirmTreasuryEvent } = await import(
                '../../../services/treasuryConfirmationService'
              );
              await confirmTreasuryEvent(dbId);
              invalidateCachedStores(['treasuryEvents', 'movements']);
              showToastV5('Pago confirmado', 'success');
            }
            setDrawerMovId(null);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[Movimiento] confirmar falló', err);
            showToastV5('No se pudo confirmar · ver consola', 'error');
          }
        }}
      />

      <CuentaWizard
        open={showAccountModal}
        onClose={() => {
          setShowAccountModal(false);
          setEditingAccount(null);
        }}
        onSuccess={() => {
          invalidateCachedStores(['accounts', 'movements', 'treasuryEvents']);
          reload();
        }}
        editingAccount={editingAccount}
      />
    </>
  );
};

export default VistaGeneralTab;
