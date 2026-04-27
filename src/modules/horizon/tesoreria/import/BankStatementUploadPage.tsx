// TAREA 17 sub-task 17.4 · BankStatementUploadPage.
//
// New "Subir extracto" page reachable at /tesoreria/importar.
//
// Sub-task 17.4 shipped the visual layer with mock data. Sub-task 17.5 wires
// it to bankStatementOrchestrator: processFile parses + dedups + matches +
// proposes; confirmDecisions applies the user's choices in a single batch
// and feeds movementLearningRules. cancelImportBatch undoes the whole import
// when the user picks "Descartar".
//
// All visual tokens come from src/index.css (var(--navy-900), var(--grey-N),
// etc.). No hex literals — per spec §4.6 v5 checklist.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  ArrowLeft,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader, { HeaderSecondaryButton, HeaderPrimaryButton } from '../../../../components/shared/PageHeader';
import { initDB, Account, Movement, TreasuryEvent } from '../../../../services/db';
import type { MatchScore } from '../../../../services/movementMatchingService';
import type { MovementSuggestion } from '../../../../services/movementSuggestionService';
import {
  processFile as orchestratorProcessFile,
  confirmDecisions as orchestratorConfirmDecisions,
  cancelImportBatch as orchestratorCancelImportBatch,
  BankProfileNotDetectedError,
  OrchestratorResult,
} from '../../../../services/bankStatementOrchestrator';

type FormatHint = 'auto' | 'csv' | 'xlsx' | 'csb43';

type PageStatus = 'idle' | 'loading' | 'error' | 'ready';

interface ResultBundle {
  importBatchId: string;
  movements: Map<number, Movement>;
  events: Map<number, TreasuryEvent>;
  matchResult: OrchestratorResult['matchResult'];
  suggestions: Map<number, MovementSuggestion[]>;
  movementsParsed: number;
  duplicatesSkipped: number;
  warnings: string[];
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.txt'];

const BankStatementUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [formatHint, setFormatHint] = useState<FormatHint>('auto');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ResultBundle | null>(null);
  const [approvedMatchIds, setApprovedMatchIds] = useState<Set<number>>(new Set());
  const [multiSelections, setMultiSelections] = useState<Map<number, number>>(new Map());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const db = await initDB();
      const list = ((await db.getAll('accounts')) ?? []) as Account[];
      const active = list.filter(a => a.status === 'ACTIVE' && a.id != null);
      setAccounts(active);
      if (active.length > 0 && active[0].id != null) setAccountId(active[0].id);
    } catch (error) {
      console.error('Failed to load accounts', error);
    } finally {
      setAccountsLoading(false);
    }
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  function handleFileChosen(file: File | undefined) {
    setErrorMessage(null);
    if (!file) return;
    if (accountId === '') {
      setErrorMessage('Selecciona la cuenta destino antes de subir el extracto.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage(`El archivo supera el máximo permitido (10 MB). Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(1)} MB.`);
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
      setErrorMessage(`Extensión no soportada. Usa ${ACCEPTED_EXTENSIONS.join(' · ')}.`);
      return;
    }
    void runOrchestrator(file);
  }

  async function runOrchestrator(file: File) {
    setStatus('loading');
    setBundle(null);
    setApprovedMatchIds(new Set());
    setMultiSelections(new Map());

    try {
      const result = await orchestratorProcessFile(file, {
        accountId: accountId as number,
        formatHint,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      });
      const hydrated = await hydrateResultBundle(result);
      const initialApproved = new Set(result.matchResult.matches.map(m => m.movementId));
      const initialMulti = new Map<number, number>();
      for (const block of result.matchResult.multiMatches) {
        if (block.candidates.length > 0) initialMulti.set(block.movementId, block.candidates[0].treasuryEventId);
      }
      setBundle(hydrated);
      setApprovedMatchIds(initialApproved);
      setMultiSelections(initialMulti);
      setStatus('ready');
      for (const warning of result.warnings) toast(warning, { icon: '⚠' });
    } catch (err) {
      const isProfileError = err instanceof BankProfileNotDetectedError;
      const message = err instanceof Error ? err.message : 'Error desconocido al procesar el extracto';
      setErrorMessage(isProfileError
        ? `${message} Tip: usa el selector "Formato" para forzar CSV / XLSX / Norma 43.`
        : message);
      setStatus('error');
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    handleFileChosen(file);
  }

  async function handleDiscard() {
    if (bundle) {
      try {
        const { removed } = await orchestratorCancelImportBatch(bundle.importBatchId);
        toast.success(`Importación descartada · ${removed} movimientos eliminados`);
      } catch (err) {
        toast.error('No se pudo cancelar la importación');
        console.error(err);
        return;
      }
    }
    setBundle(null);
    setStatus('idle');
    setApprovedMatchIds(new Set());
    setMultiSelections(new Map());
  }

  async function handleApproveBatch() {
    if (!bundle || confirming) return;
    setConfirming(true);
    try {
      // Approved matches: respect what's checked, plus the user's choice for
      // each multi-match block (default = highest-score candidate).
      const matches = Array.from(approvedMatchIds).map(movementId => {
        const direct = bundle.matchResult.matches.find(m => m.movementId === movementId);
        if (direct) return { movementId, treasuryEventId: direct.treasuryEventId };
        const multi = multiSelections.get(movementId);
        return multi != null ? { movementId, treasuryEventId: multi } : null;
      }).filter((x): x is { movementId: number; treasuryEventId: number } => x != null);

      await orchestratorConfirmDecisions(bundle.importBatchId, {
        approvedMatches: matches,
        approvedSuggestions: [],
        ignoredMovementIds: [],
      });
      toast.success(`${matches.length} matches aprobados`);
      setBundle(null);
      setStatus('idle');
      setApprovedMatchIds(new Set());
      setMultiSelections(new Map());
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Error confirmando los matches');
    } finally {
      setConfirming(false);
    }
  }

  async function handleApplySuggestion(movementId: number, suggestionIndex: number) {
    if (!bundle) return;
    try {
      await orchestratorConfirmDecisions(bundle.importBatchId, {
        approvedMatches: [],
        approvedSuggestions: [{ movementId, suggestionIndex }],
        ignoredMovementIds: [],
      });
      toast.success('Sugerencia aplicada');
      // Drop the row from the bundle so the user sees immediate feedback.
      setBundle(prev => {
        if (!prev) return prev;
        const nextSinMatch = prev.matchResult.sinMatch.filter(id => id !== movementId);
        return {
          ...prev,
          matchResult: { ...prev.matchResult, sinMatch: nextSinMatch },
        };
      });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Error aplicando sugerencia');
    }
  }

  async function handleIgnoreMovement(movementId: number) {
    if (!bundle) return;
    try {
      await orchestratorConfirmDecisions(bundle.importBatchId, {
        approvedMatches: [],
        approvedSuggestions: [],
        ignoredMovementIds: [movementId],
      });
      setBundle(prev => {
        if (!prev) return prev;
        const nextSinMatch = prev.matchResult.sinMatch.filter(id => id !== movementId);
        return {
          ...prev,
          matchResult: { ...prev.matchResult, sinMatch: nextSinMatch },
        };
      });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Error ignorando movimiento');
    }
  }

  const accountLabel = useMemo(() => {
    return (acc: Account) => {
      const banco = acc.banco?.name ?? 'Banco';
      const alias = acc.alias ?? 'Cuenta';
      const tail = acc.iban ? `···${acc.iban.slice(-4)}` : '';
      return [banco, alias, tail].filter(Boolean).join(' · ');
    };
  }, []);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <PageHeader
        icon={Upload}
        title="Subir extracto bancario"
        subtitle="Opcional · si prefieres marcar movimientos uno a uno usa Conciliación"
        actions={
          <HeaderSecondaryButton
            icon={ArrowLeft}
            label="Volver a Tesorería"
            onClick={() => navigate('/tesoreria')}
          />
        }
      />

      <UploadCard
        accounts={accounts}
        accountsLoading={accountsLoading}
        accountId={accountId}
        onAccountChange={setAccountId}
        formatHint={formatHint}
        onFormatChange={setFormatHint}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onPeriodStartChange={setPeriodStart}
        onPeriodEndChange={setPeriodEnd}
        dragOver={dragOver}
        onDragOver={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onBrowse={handleBrowseClick}
        accountLabel={accountLabel}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        onChange={e => handleFileChosen(e.target.files?.[0] ?? undefined)}
      />

      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

      {status === 'loading' && <LoadingCard />}
      {status === 'ready' && bundle && (
        <ResultsCard
          bundle={bundle}
          approvedMatchIds={approvedMatchIds}
          onToggleMatch={movementId => {
            setApprovedMatchIds(prev => {
              const next = new Set(prev);
              if (next.has(movementId)) next.delete(movementId);
              else next.add(movementId);
              return next;
            });
          }}
          multiSelections={multiSelections}
          onMultiSelect={(movementId, treasuryEventId) => {
            setMultiSelections(prev => {
              const next = new Map(prev);
              next.set(movementId, treasuryEventId);
              return next;
            });
          }}
          onDiscard={handleDiscard}
          onApprove={handleApproveBatch}
          confirming={confirming}
          onApplySuggestion={handleApplySuggestion}
          onIgnoreMovement={handleIgnoreMovement}
        />
      )}
    </div>
  );
};

async function hydrateResultBundle(result: OrchestratorResult): Promise<ResultBundle> {
  const db = await initDB();
  const movements = new Map<number, Movement>();
  const events = new Map<number, TreasuryEvent>();

  const movementIds = collectMovementIds(result);
  const eventIds = collectEventIds(result);

  for (const id of movementIds) {
    const m = (await db.get('movements', id)) as Movement | undefined;
    if (m && m.id != null) movements.set(m.id, m);
  }
  for (const id of eventIds) {
    const e = (await db.get('treasuryEvents', id)) as TreasuryEvent | undefined;
    if (e && e.id != null) events.set(e.id, e);
  }

  return {
    importBatchId: result.importBatchId,
    movements,
    events,
    matchResult: result.matchResult,
    suggestions: result.suggestions,
    movementsParsed: result.movementsParsed,
    duplicatesSkipped: result.duplicatesSkipped,
    warnings: result.warnings,
  };
}

function collectMovementIds(result: OrchestratorResult): number[] {
  const ids = new Set<number>();
  for (const m of result.matchResult.matches) ids.add(m.movementId);
  for (const block of result.matchResult.multiMatches) ids.add(block.movementId);
  for (const id of result.matchResult.sinMatch) ids.add(id);
  return Array.from(ids);
}

function collectEventIds(result: OrchestratorResult): number[] {
  const ids = new Set<number>();
  for (const m of result.matchResult.matches) ids.add(m.treasuryEventId);
  for (const block of result.matchResult.multiMatches) {
    for (const c of block.candidates) ids.add(c.treasuryEventId);
  }
  return Array.from(ids);
}

// ─── Card 1 · upload ─────────────────────────────────────────────────────────

interface UploadCardProps {
  accounts: Account[];
  accountsLoading: boolean;
  accountId: number | '';
  onAccountChange: (id: number | '') => void;
  formatHint: FormatHint;
  onFormatChange: (hint: FormatHint) => void;
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (v: string) => void;
  onPeriodEndChange: (v: string) => void;
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onBrowse: () => void;
  accountLabel: (acc: Account) => string;
}

const UploadCard: React.FC<UploadCardProps> = ({
  accounts,
  accountsLoading,
  accountId,
  onAccountChange,
  formatHint,
  onFormatChange,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  accountLabel,
}) => (
  <Card title="Subir extracto bancario" accent="navy">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Cuenta destino">
          <select
            value={accountId}
            onChange={e => onAccountChange(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={accountsLoading}
            style={selectStyle}
          >
            {accountsLoading && <option value="">Cargando cuentas…</option>}
            {!accountsLoading && accounts.length === 0 && (
              <option value="">No hay cuentas activas</option>
            )}
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {accountLabel(acc)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Formato">
          <select
            value={formatHint}
            onChange={e => onFormatChange(e.target.value as FormatHint)}
            style={selectStyle}
          >
            <option value="auto">Detectar automáticamente</option>
            <option value="csv">CSV genérico</option>
            <option value="xlsx">Excel (XLSX)</option>
            <option value="csb43">Norma 43 (CSB43)</option>
          </select>
        </Field>
        <Field label="Período (opcional)">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={periodStart}
              onChange={e => onPeriodStartChange(e.target.value)}
              style={{ ...selectStyle, flex: 1 }}
              aria-label="Desde"
            />
            <input
              type="date"
              value={periodEnd}
              onChange={e => onPeriodEndChange(e.target.value)}
              style={{ ...selectStyle, flex: 1 }}
              aria-label="Hasta"
            />
          </div>
        </Field>
      </div>

      <div
        onDragOver={e => {
          e.preventDefault();
          onDragOver();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') onBrowse();
        }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--navy-900)' : 'var(--grey-300)'}`,
          background: dragOver ? 'var(--navy-50)' : 'var(--grey-50)',
          borderRadius: 'var(--r-lg)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          cursor: 'pointer',
          minHeight: 200,
          transition: 'all 150ms ease',
        }}
      >
        <Upload size={28} strokeWidth={1.5} color="var(--navy-900)" aria-hidden="true" />
        <div
          style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 600,
            color: 'var(--grey-900)',
            fontSize: 'var(--t-base, 0.875rem)',
          }}
        >
          Arrastra el extracto aquí
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            color: 'var(--grey-500)',
            fontSize: 'var(--t-sm, 0.8125rem)',
            textAlign: 'center',
          }}
        >
          o haz click para elegir · .xlsx · .csv · .txt · máximo 10 MB
        </div>
      </div>
    </div>
  </Card>
);

// ─── Card 2 · loading ────────────────────────────────────────────────────────

const LoadingCard: React.FC = () => (
  <Card title="Procesando extracto" accent="teal">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <Loader2
        size={20}
        strokeWidth={1.5}
        color="var(--teal-600)"
        style={{ animation: 'atlas-spin 1s linear infinite' }}
        aria-hidden="true"
      />
      <span style={{ color: 'var(--grey-700)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        Detectando perfil bancario, parseando movimientos y buscando coincidencias…
      </span>
    </div>
    <style>{`@keyframes atlas-spin { to { transform: rotate(360deg); } }`}</style>
  </Card>
);

// ─── Card 2 · results ────────────────────────────────────────────────────────

interface ResultsCardProps {
  bundle: ResultBundle;
  approvedMatchIds: Set<number>;
  onToggleMatch: (movementId: number) => void;
  multiSelections: Map<number, number>;
  onMultiSelect: (movementId: number, treasuryEventId: number) => void;
  onDiscard: () => void;
  onApprove: () => void;
  confirming: boolean;
  onApplySuggestion: (movementId: number, suggestionIndex: number) => void;
  onIgnoreMovement: (movementId: number) => void;
}

const ResultsCard: React.FC<ResultsCardProps> = ({
  bundle,
  approvedMatchIds,
  onToggleMatch,
  multiSelections,
  onMultiSelect,
  onDiscard,
  onApprove,
  confirming,
  onApplySuggestion,
  onIgnoreMovement,
}) => {
  const totalMovements = bundle.movementsParsed;
  const matchedCount = bundle.matchResult.matches.length;
  const sinMatchCount = bundle.matchResult.sinMatch.length;
  const multiCount = bundle.matchResult.multiMatches.length;

  return (
    <Card
      title={`Matching · ${totalMovements} movimientos encontrados en extracto`}
      subtitle={`${matchedCount} emparejados con previsiones · ${sinMatchCount} sin match · ${bundle.duplicatesSkipped} duplicados omitidos`}
      accent="navy"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <HeaderSecondaryButton label="Descartar" onClick={onDiscard} />
          <HeaderPrimaryButton
            icon={CheckCircle2}
            label={confirming ? 'Aprobando…' : `Aprobar ${approvedMatchIds.size} matches`}
            onClick={onApprove}
          />
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ColumnHeader label="Extracto" subtitle="lo que dice el banco" />
        <ColumnHeader label="ATLAS" subtitle="lo que ya había previsto" />
      </div>

      {bundle.matchResult.matches.length > 0 && (
        <SectionHeader label={`Matches automáticos (${bundle.matchResult.matches.length})`} />
      )}
      {bundle.matchResult.matches.map(match => {
        const movement = bundle.movements.get(match.movementId);
        const event = bundle.events.get(match.treasuryEventId);
        if (!movement || !event) return null;
        return (
          <MatchRow
            key={match.movementId}
            match={match}
            movement={movement}
            event={event}
            checked={approvedMatchIds.has(match.movementId)}
            onToggle={() => onToggleMatch(match.movementId)}
          />
        );
      })}

      {multiCount > 0 && <SectionHeader label={`Múltiples coincidencias · elige una (${multiCount})`} />}
      {bundle.matchResult.multiMatches.map(block => {
        const movement = bundle.movements.get(block.movementId);
        if (!movement) return null;
        const candidates = block.candidates
          .map(c => {
            const event = bundle.events.get(c.treasuryEventId);
            return event ? { candidate: c, event } : null;
          })
          .filter((x): x is { candidate: MatchScore; event: TreasuryEvent } => x != null);
        return (
          <MultiMatchRow
            key={block.movementId}
            movement={movement}
            candidates={candidates}
            selectedId={multiSelections.get(block.movementId)}
            onSelect={treasuryEventId => onMultiSelect(block.movementId, treasuryEventId)}
          />
        );
      })}

      {sinMatchCount > 0 && <SectionHeader label={`Sin match (${sinMatchCount})`} />}
      {bundle.matchResult.sinMatch.map(movementId => {
        const movement = bundle.movements.get(movementId);
        if (!movement) return null;
        return (
          <SinMatchRow
            key={movementId}
            movement={movement}
            suggestions={bundle.suggestions.get(movementId) ?? []}
            onApply={index => onApplySuggestion(movementId, index)}
            onIgnore={() => onIgnoreMovement(movementId)}
          />
        );
      })}
    </Card>
  );
};

// ─── Atomic UI pieces ────────────────────────────────────────────────────────

const ErrorBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
  <div
    role="alert"
    style={{
      marginTop: 16,
      padding: '12px 16px',
      borderRadius: 'var(--r-md)',
      background: 'var(--grey-100)',
      border: '1px solid var(--grey-300)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      color: 'var(--grey-700)',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontSize: 'var(--t-sm, 0.8125rem)',
    }}
  >
    <AlertTriangle size={18} strokeWidth={1.5} color="var(--grey-700)" aria-hidden="true" />
    <span style={{ flex: 1 }}>{message}</span>
    <button
      onClick={onDismiss}
      aria-label="Cerrar aviso"
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--grey-500)',
        cursor: 'pointer',
        padding: 4,
        display: 'inline-flex',
      }}
    >
      <X size={14} strokeWidth={1.5} />
    </button>
  </div>
);

interface CardProps {
  title: string;
  subtitle?: string;
  accent: 'navy' | 'teal';
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, subtitle, accent, actions, children }) => (
  <section
    style={{
      marginTop: 16,
      background: 'var(--white)',
      borderRadius: 'var(--r-lg)',
      borderTop: `3px solid ${accent === 'navy' ? 'var(--navy-900)' : 'var(--teal-600)'}`,
      boxShadow: 'var(--shadow-1)',
      padding: '20px 24px',
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 16,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--t-lg, 1rem)',
            fontWeight: 700,
            color: 'var(--grey-900)',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 'var(--t-sm, 0.8125rem)',
              color: 'var(--grey-500)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </header>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontSize: 'var(--t-sm, 0.8125rem)',
      color: 'var(--grey-700)',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 500,
    }}
  >
    <span>{label}</span>
    {children}
  </label>
);

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: '0 10px',
  border: '1px solid var(--grey-300)',
  borderRadius: 'var(--r-md)',
  background: 'var(--white)',
  color: 'var(--grey-900)',
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 'var(--t-base, 0.875rem)',
};

const ColumnHeader: React.FC<{ label: string; subtitle: string }> = ({ label, subtitle }) => (
  <div>
    <div
      style={{
        fontWeight: 600,
        color: 'var(--grey-900)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 'var(--t-sm, 0.8125rem)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}
    >
      {label}
    </div>
    <div
      style={{
        color: 'var(--grey-500)',
        fontSize: 'var(--t-xs, 0.75rem)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      {subtitle}
    </div>
  </div>
);

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      marginTop: 16,
      marginBottom: 8,
      paddingBottom: 4,
      borderBottom: '1px solid var(--grey-200)',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontSize: 'var(--t-xs, 0.75rem)',
      color: 'var(--grey-500)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    }}
  >
    {label}
  </div>
);

interface MatchRowProps {
  match: MatchScore;
  movement: Movement;
  event: TreasuryEvent;
  checked: boolean;
  onToggle: () => void;
}

const MatchRow: React.FC<MatchRowProps> = ({ match, movement, event, checked, onToggle }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '24px 1fr 36px 1fr auto',
      gap: 12,
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--grey-100)',
    }}
  >
    <input type="checkbox" checked={checked} onChange={onToggle} aria-label="Aprobar match" />
    <SidePanel
      title={movement.description}
      subtitle={`${movement.date} · ${formatAmount(movement.amount)}`}
      amount={movement.amount}
    />
    <ArrowRightLeft size={18} strokeWidth={1.5} color="var(--navy-900)" aria-hidden="true" />
    <SidePanel
      title={event.description}
      subtitle={`${event.predictedDate} previsto`}
      amount={signedEventAmount(event)}
    />
    <ScorePill score={match.score} reasons={match.reasons} />
  </div>
);

interface MultiMatchRowProps {
  movement: Movement;
  candidates: { candidate: MatchScore; event: TreasuryEvent }[];
  selectedId: number | undefined;
  onSelect: (treasuryEventId: number) => void;
}

const MultiMatchRow: React.FC<MultiMatchRowProps> = ({ movement, candidates, selectedId, onSelect }) => (
  <div
    style={{
      padding: '12px 0',
      borderBottom: '1px solid var(--grey-100)',
    }}
  >
    <SidePanel
      title={movement.description}
      subtitle={`${movement.date} · ${formatAmount(movement.amount)}`}
      amount={movement.amount}
    />
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {candidates.map(({ candidate, event }) => (
        <label
          key={candidate.treasuryEventId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            border: '1px solid var(--grey-200)',
            borderRadius: 'var(--r-md)',
            cursor: 'pointer',
            background: selectedId === candidate.treasuryEventId ? 'var(--navy-50)' : 'var(--white)',
          }}
        >
          <input
            type="radio"
            name={`multi-${movement.id}`}
            checked={selectedId === candidate.treasuryEventId}
            onChange={() => onSelect(candidate.treasuryEventId)}
          />
          <span
            style={{
              flex: 1,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              color: 'var(--grey-900)',
              fontSize: 'var(--t-sm, 0.8125rem)',
            }}
          >
            {event.description}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: 'var(--grey-500)',
              fontSize: 'var(--t-xs, 0.75rem)',
            }}
          >
            {event.predictedDate} · score {candidate.score}
          </span>
        </label>
      ))}
    </div>
  </div>
);

interface SinMatchRowProps {
  movement: Movement;
  suggestions: MovementSuggestion[];
  onApply: (suggestionIndex: number) => void;
  onIgnore: () => void;
}

const SinMatchRow: React.FC<SinMatchRowProps> = ({ movement, suggestions, onApply, onIgnore }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 36px 1fr',
      gap: 12,
      alignItems: 'flex-start',
      padding: '12px 0',
      borderBottom: '1px solid var(--grey-100)',
    }}
  >
    <SidePanel
      title={movement.description}
      subtitle={`${movement.date} · ${formatAmount(movement.amount)}`}
      amount={movement.amount}
    />
    <AlertTriangle size={18} strokeWidth={1.5} color="var(--grey-500)" aria-hidden="true" style={{ marginTop: 6 }} />
    <div>
      {suggestions.length === 0 && (
        <span style={{ color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 'var(--t-sm, 0.8125rem)' }}>
          Sin sugerencias automáticas
        </span>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map((suggestion, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 12px',
              border: '1px solid var(--grey-200)',
              borderRadius: 'var(--r-md)',
              background: 'var(--white)',
            }}
          >
            <span
              style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                color: 'var(--grey-700)',
                fontSize: 'var(--t-sm, 0.8125rem)',
              }}
            >
              <strong style={{ color: 'var(--grey-900)' }}>{viaLabel(suggestion.via)}:</strong> {suggestion.description}
            </span>
            <button
              type="button"
              onClick={() => suggestion.action.kind === 'ignore' ? onIgnore() : onApply(idx)}
              style={{
                background: 'var(--navy-900)',
                color: 'var(--white)',
                border: 'none',
                borderRadius: 'var(--r-md)',
                padding: '6px 12px',
                fontSize: 'var(--t-xs, 0.75rem)',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            >
              {suggestion.action.kind === 'ignore' ? 'Ignorar' : 'Aplicar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

function signedEventAmount(event: TreasuryEvent): number {
  const abs = Math.abs(event.amount);
  if (event.type === 'income') return abs;
  if (event.type === 'expense') return -abs;
  return event.amount; // financing — keep stored sign
}

const SidePanel: React.FC<{ title: string; subtitle: string; amount: number }> = ({ title, subtitle, amount }) => (
  <div>
    <div
      style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 600,
        color: 'var(--grey-900)',
        fontSize: 'var(--t-sm, 0.8125rem)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {title}
    </div>
    <div
      style={{
        marginTop: 2,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        color: 'var(--grey-500)',
        fontSize: 'var(--t-xs, 0.75rem)',
      }}
    >
      {subtitle}
    </div>
  </div>
);

const ScorePill: React.FC<{ score: number; reasons: string[] }> = ({ score, reasons }) => (
  <span
    title={reasons.join(' · ')}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 8px',
      borderRadius: 'var(--r-sm)',
      background: 'var(--navy-50)',
      color: 'var(--navy-900)',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 'var(--t-xs, 0.75rem)',
      fontWeight: 600,
    }}
  >
    {score}
  </span>
);

function viaLabel(via: MovementSuggestion['via']): string {
  switch (via) {
    case 'compromiso_recurrente':
      return 'Compromiso recurrente';
    case 'learning_rule':
      return 'Regla aprendida';
    case 'heuristica':
      return 'Heurística';
  }
}

function formatAmount(amount: number): string {
  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export default BankStatementUploadPage;
