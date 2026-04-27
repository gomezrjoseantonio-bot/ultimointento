// TAREA 17 sub-task 17.4 · BankStatementUploadPage.
//
// New "Subir extracto" page reachable at /tesoreria/importar.
//
// This sub-task ships the visual layer with **mock data** so that the layout,
// states (idle / loading / error / results) and the v5 design checklist can be
// validated end-to-end. Sub-task 17.5 (`bankStatementOrchestrator`) will swap
// the mock for a real call and wire `confirmDecisions` for the "Aprobar" /
// "Aplicar" actions.
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
import PageHeader, { HeaderSecondaryButton, HeaderPrimaryButton } from '../../../../components/shared/PageHeader';
import { initDB, Account } from '../../../../services/db';
import type { MatchResult, MatchScore } from '../../../../services/movementMatchingService';
import type { MovementSuggestion } from '../../../../services/movementSuggestionService';

type FormatHint = 'auto' | 'csv' | 'xlsx' | 'csb43';

type PageStatus = 'idle' | 'loading' | 'error' | 'ready';

interface MockMovement {
  id: number;
  date: string;
  amount: number;
  description: string;
}

interface MockTreasuryEvent {
  id: number;
  predictedDate: string;
  amount: number;
  description: string;
  providerName?: string;
}

interface MockResultBundle {
  movements: Map<number, MockMovement>;
  events: Map<number, MockTreasuryEvent>;
  matchResult: MatchResult;
  suggestions: Map<number, MovementSuggestion[]>;
  movementsParsed: number;
  duplicatesSkipped: number;
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
  const [bundle, setBundle] = useState<MockResultBundle | null>(null);
  const [approvedMatchIds, setApprovedMatchIds] = useState<Set<number>>(new Set());
  const [multiSelections, setMultiSelections] = useState<Map<number, number>>(new Map());

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
    runMockProcessing(file);
  }

  function runMockProcessing(file: File) {
    setStatus('loading');
    setBundle(null);
    setApprovedMatchIds(new Set());
    setMultiSelections(new Map());

    // Mock latency so the loading state is visible during 17.4 visual review.
    window.setTimeout(() => {
      const mock = buildMockBundle(file.name);
      const initialApproved = new Set(mock.matchResult.matches.map(m => m.movementId));
      setBundle(mock);
      setApprovedMatchIds(initialApproved);
      // Default multi-match selection: highest-score candidate.
      const initialMulti = new Map<number, number>();
      for (const block of mock.matchResult.multiMatches) {
        if (block.candidates.length > 0) initialMulti.set(block.movementId, block.candidates[0].treasuryEventId);
      }
      setMultiSelections(initialMulti);
      setStatus('ready');
    }, 400);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    handleFileChosen(file);
  }

  function handleDiscard() {
    setBundle(null);
    setStatus('idle');
    setApprovedMatchIds(new Set());
    setMultiSelections(new Map());
  }

  function handleApproveBatch() {
    // Wired to bankStatementOrchestrator.confirmDecisions in sub-task 17.5.
    // For now we just collapse the page back to idle so the visual flow can be
    // walked through during review.
    handleDiscard();
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
        />
      )}
    </div>
  );
};

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
  bundle: MockResultBundle;
  approvedMatchIds: Set<number>;
  onToggleMatch: (movementId: number) => void;
  multiSelections: Map<number, number>;
  onMultiSelect: (movementId: number, treasuryEventId: number) => void;
  onDiscard: () => void;
  onApprove: () => void;
}

const ResultsCard: React.FC<ResultsCardProps> = ({
  bundle,
  approvedMatchIds,
  onToggleMatch,
  multiSelections,
  onMultiSelect,
  onDiscard,
  onApprove,
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
            label={`Aprobar ${approvedMatchIds.size} matches`}
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
      {bundle.matchResult.matches.map(match => (
        <MatchRow
          key={match.movementId}
          match={match}
          movement={bundle.movements.get(match.movementId)!}
          event={bundle.events.get(match.treasuryEventId)!}
          checked={approvedMatchIds.has(match.movementId)}
          onToggle={() => onToggleMatch(match.movementId)}
        />
      ))}

      {multiCount > 0 && <SectionHeader label={`Múltiples coincidencias · elige una (${multiCount})`} />}
      {bundle.matchResult.multiMatches.map(block => (
        <MultiMatchRow
          key={block.movementId}
          movement={bundle.movements.get(block.movementId)!}
          candidates={block.candidates.map(c => ({
            candidate: c,
            event: bundle.events.get(c.treasuryEventId)!,
          }))}
          selectedId={multiSelections.get(block.movementId)}
          onSelect={treasuryEventId => onMultiSelect(block.movementId, treasuryEventId)}
        />
      ))}

      {sinMatchCount > 0 && <SectionHeader label={`Sin match (${sinMatchCount})`} />}
      {bundle.matchResult.sinMatch.map(movementId => (
        <SinMatchRow
          key={movementId}
          movement={bundle.movements.get(movementId)!}
          suggestions={bundle.suggestions.get(movementId) ?? []}
        />
      ))}
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
  movement: MockMovement;
  event: MockTreasuryEvent;
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
      amount={event.amount}
    />
    <ScorePill score={match.score} reasons={match.reasons} />
  </div>
);

interface MultiMatchRowProps {
  movement: MockMovement;
  candidates: { candidate: MatchScore; event: MockTreasuryEvent }[];
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
  movement: MockMovement;
  suggestions: MovementSuggestion[];
}

const SinMatchRow: React.FC<SinMatchRowProps> = ({ movement, suggestions }) => (
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

// ─── Mock data builder ───────────────────────────────────────────────────────

function buildMockBundle(filename: string): MockResultBundle {
  const movements = new Map<number, MockMovement>([
    [101, { id: 101, date: '2026-04-22', amount: 380, description: 'TRANSF INQUILINO PEREZ ABRIL' }],
    [102, { id: 102, date: '2026-04-22', amount: 380, description: 'TRANSF INQUILINO LOPEZ ABRIL' }],
    [103, { id: 103, date: '2026-04-15', amount: -89.4, description: 'RECIBO IBERDROLA CLIENTES SAU' }],
    [104, { id: 104, date: '2026-04-18', amount: -32.99, description: 'AMAZON COMPRA EU' }],
    [105, { id: 105, date: '2026-04-22', amount: 320, description: 'BIZUM A FUENTES' }],
  ]);

  const events = new Map<number, MockTreasuryEvent>([
    [201, { id: 201, predictedDate: '2026-04-22', amount: 380, description: 'Renta Hab1 Pérez', providerName: 'Inquilino Perez' }],
    [202, { id: 202, predictedDate: '2026-04-22', amount: 380, description: 'Renta Hab2 López', providerName: 'Inquilino Lopez' }],
    [203, { id: 203, predictedDate: '2026-04-22', amount: 380, description: 'Renta genérica abril', providerName: undefined }],
  ]);

  const matchResult: MatchResult = {
    matches: [
      { movementId: 101, treasuryEventId: 201, score: 100, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'descripcion_proveedor'] },
      { movementId: 102, treasuryEventId: 202, score: 100, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'descripcion_proveedor'] },
    ],
    multiMatches: [
      {
        movementId: 105,
        candidates: [
          { movementId: 105, treasuryEventId: 203, score: 75, reasons: ['fecha_exacta', 'cuenta_match', 'importe_dentro_tolerancia'] },
        ],
      },
    ],
    sinMatch: [103, 104],
  };

  const suggestions = new Map<number, MovementSuggestion[]>();
  suggestions.set(103, [
    {
      movementId: 103,
      via: 'heuristica',
      confidence: 60,
      description: 'Posible suministro · proponer crear evento de tesorería en INMUEBLE',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.suministros',
        sourceType: 'gasto',
      },
    },
  ]);
  suggestions.set(104, [
    {
      movementId: 104,
      via: 'heuristica',
      confidence: 50,
      description: 'Compra online (Amazon) · proponer marcar como gasto personal',
      action: { kind: 'mark_personal_expense', categoryKey: 'tecnologia' },
    },
    {
      movementId: 104,
      via: 'heuristica',
      confidence: 30,
      description: `Sin patrón claro en el extracto "${filename}" · puedes ignorarlo`,
      action: { kind: 'ignore' },
    },
  ]);

  return {
    movements,
    events,
    matchResult,
    suggestions,
    movementsParsed: movements.size,
    duplicatesSkipped: 0,
  };
}

export default BankStatementUploadPage;
