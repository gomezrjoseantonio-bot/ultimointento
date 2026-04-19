import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel } from '../utils/conciliacionFormatters';
import type { Account } from '../../../../../services/db';
import type { Filters } from '../hooks/useMonthConciliacion';

interface FiltersBarProps {
  filters: Filters;
  accounts: Account[];
  onChange: (patch: Partial<Filters>) => void;
}

const accountShortLabel = (account: Account): string => {
  if (account.alias) return account.alias;
  const bank = account.banco?.name ?? account.bank ?? '';
  if (bank) return bank;
  const iban = account.iban ?? '';
  return iban ? `·${iban.slice(-4)}` : `Cuenta ${account.id ?? ''}`;
};

const FiltersBar: React.FC<FiltersBarProps> = ({ filters, accounts, onChange }) => {
  const prevMonth = () => {
    const d = new Date(filters.year, filters.month0 - 1, 1);
    onChange({ year: d.getFullYear(), month0: d.getMonth() });
  };
  const nextMonth = () => {
    const d = new Date(filters.year, filters.month0 + 1, 1);
    onChange({ year: d.getFullYear(), month0: d.getMonth() });
  };

  return (
    <div className="cv2-filters">
      <div className="cv2-month-nav">
        <button type="button" onClick={prevMonth} aria-label="Mes anterior">
          <ChevronLeft size={14} />
        </button>
        <span className="cv2-month-nav-current">{monthLabel(filters.year, filters.month0)}</span>
        <button type="button" onClick={nextMonth} aria-label="Mes siguiente">
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="cv2-filter-sep" />

      <div className="cv2-filter-group">
        <span className="cv2-filter-label">Cuenta</span>
        <button
          type="button"
          className={`cv2-chip ${filters.accountId === 'all' ? 'cv2-chip--active' : ''}`}
          onClick={() => onChange({ accountId: 'all' })}
        >
          Todas
        </button>
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`cv2-chip ${filters.accountId === a.id ? 'cv2-chip--active' : ''}`}
            onClick={() => onChange({ accountId: a.id! })}
            title={a.iban}
          >
            {accountShortLabel(a)}
          </button>
        ))}
      </div>

      <div className="cv2-filter-sep" />

      <div className="cv2-filter-group">
        <span className="cv2-filter-label">Ámbito</span>
        {[
          { v: 'all', label: 'Todo' },
          { v: 'PERSONAL', label: 'Personal' },
          { v: 'INMUEBLE', label: 'Inmuebles' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            className={`cv2-chip ${filters.ambito === o.v ? 'cv2-chip--active' : ''}`}
            onClick={() => onChange({ ambito: o.v as Filters['ambito'] })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="cv2-filter-sep" />

      <div className="cv2-filter-group">
        <span className="cv2-filter-label">Estado</span>
        {[
          { v: 'all', label: 'Todos' },
          { v: 'pending', label: 'Pendientes' },
          { v: 'confirmed', label: 'Confirmados' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            className={`cv2-chip ${filters.stateFilter === o.v ? 'cv2-chip--active' : ''}`}
            onClick={() => onChange({ stateFilter: o.v as Filters['stateFilter'] })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="cv2-filter-sep" />

      <input
        type="text"
        className="cv2-search"
        placeholder="Buscar concepto, persona, inmueble..."
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
      />
    </div>
  );
};

export default FiltersBar;
