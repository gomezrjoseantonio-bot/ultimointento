interface CardSettlementConfig {
  chargeAccountId: number;
}

export interface CardAliasMatcher {
  label: string;
  config: CardSettlementConfig;
}

interface DisplayAccountResolverInput {
  eventAccountId?: number;
  eventSourceId?: number;
  sourceType?: string;
  description?: string;
  cardSettlementByAccountId: Map<number, CardSettlementConfig>;
  cardAliasMatchers: CardAliasMatcher[];
}

export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const extractCardAliasFromReceiptDescription = (description?: string): string | undefined => {
  if (!description) return undefined;
  const normalized = normalizeText(description);

  const receiptPattern = /^recibo(?:\s*de)?\s*tarjeta\s*:?\s*(.+)$/;
  const compactPattern = /^recibotarjeta\s*:?\s*(.+)$/;
  const match = normalized.match(receiptPattern) || normalized.match(compactPattern);
  if (!match || !match[1]) return undefined;

  const alias = match[1].trim();
  return alias || undefined;
};

export const matchCardConfigByAlias = (
  alias: string | undefined,
  cardAliasMatchers: CardAliasMatcher[],
): CardSettlementConfig | undefined => {
  if (!alias) return undefined;
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return undefined;

  const exact = cardAliasMatchers.find(m => m.label === normalizedAlias);
  if (exact) return exact.config;

  const contains = cardAliasMatchers
    .filter(m => m.label.includes(normalizedAlias) || normalizedAlias.includes(m.label))
    .sort((a, b) => b.label.length - a.label.length);

  return contains[0]?.config;
};

export const resolveDisplayAccountId = ({
  eventAccountId,
  eventSourceId,
  sourceType,
  description,
  cardSettlementByAccountId,
  cardAliasMatchers,
}: DisplayAccountResolverInput): number | undefined => {
  const eventCardConfig = eventAccountId != null
    ? cardSettlementByAccountId.get(eventAccountId)
    : undefined;

  const sourceCardConfig =
    eventAccountId == null &&
    sourceType === 'personal_expense' &&
    eventSourceId != null
      ? cardSettlementByAccountId.get(eventSourceId)
      : undefined;

  const receiptCardAlias =
    eventAccountId == null
      ? extractCardAliasFromReceiptDescription(description)
      : undefined;

  const aliasCardConfig = matchCardConfigByAlias(receiptCardAlias, cardAliasMatchers);

  return eventCardConfig?.chargeAccountId
    ?? sourceCardConfig?.chargeAccountId
    ?? aliasCardConfig?.chargeAccountId
    ?? eventAccountId;
};


export const buildCardSettlementLookups = (
  accounts: Array<{
    id?: number;
    alias?: string;
    name?: string;
    banco?: { name?: string };
    cardConfig?: { chargeAccountId?: number };
  }>,
): {
  cardSettlementByAccountId: Map<number, CardSettlementConfig>;
  cardAliasMatchers: CardAliasMatcher[];
} => {
  const cardSettlementByAccountId = new Map<number, CardSettlementConfig>();
  const cardAliasMatchers: CardAliasMatcher[] = [];

  for (const account of accounts) {
    if (account.id == null) continue;
    if (account.cardConfig?.chargeAccountId == null) continue;

    const config = { chargeAccountId: account.cardConfig.chargeAccountId };
    cardSettlementByAccountId.set(account.id, config);

    const labels = [account.alias, account.name, account.banco?.name]
      .map(value => normalizeText(value || ''))
      .filter(Boolean);

    for (const label of labels) {
      cardAliasMatchers.push({ label, config });
    }
  }

  return { cardSettlementByAccountId, cardAliasMatchers };
};
