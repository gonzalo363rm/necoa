export type TagCategory = 'living' | 'comfort' | 'other';
export type TransactionType = 'expense' | 'income';
export type MemberRole = 'owner' | 'member';

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Family = {
  id: string;
  name: string;
  created_by: string;
};

export type FamilyMember = {
  id: string;
  family_id: string;
  user_id: string;
  role: MemberRole;
  status: 'active' | 'left';
  profile?: Profile;
};

export type BudgetGoals = {
  id: string;
  family_id: string;
  living_pct: number;
  comfort_pct: number;
  savings_pct: number;
};

export type Tag = {
  id: string;
  family_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  category: TagCategory;
  is_system: boolean;
};

export type TransactionSplit = {
  id?: string;
  user_id: string;
  share_pct: number;
  profile?: Profile | null;
};

export type Transaction = {
  id: string;
  family_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  occurred_at: string;
  paid_by: string;
  created_by: string;
  tag_id: string | null;
  note: string | null;
  installment_current: number | null;
  installment_total: number | null;
  category_override: Exclude<TagCategory, 'other'> | null;
  tag?: Tag | null;
  payer?: Profile | null;
  splits?: TransactionSplit[];
};

export type MonthBreakdown = {
  incomeTotal: number;
  expenseTotal: number;
  livingTotal: number;
  comfortTotal: number;
  livingPct: number;
  comfortPct: number;
  savingsPct: number;
  savingsAmount: number;
};

export type ListRepeatMode = 'inherit' | 'custom';
export type ListEntryStatus = 'pending' | 'done' | 'skipped';

export type ListCategory = {
  id: string;
  family_id: string;
  name: string;
  /** null = sin repetir; 1 = todos los meses; N = cada N meses */
  repeat_months: number | null;
  sort_order: number;
  created_at?: string;
};

export type ListItem = {
  id: string;
  family_id: string;
  category_id: string;
  name: string;
  repeat_mode: ListRepeatMode;
  repeat_months: number | null;
  start_month: string;
  /** Mayor = más arriba en la lista. */
  sort_order: number;
  archived_at: string | null;
  created_at?: string;
};

export type ListEntry = {
  id: string;
  family_id: string;
  item_id: string;
  month: string;
  status: ListEntryStatus;
  done_at: string | null;
  done_by: string | null;
  created_at?: string;
};

/** Item con su entrada del mes (si existe). */
export type ListItemWithEntry = ListItem & {
  entry: ListEntry | null;
  /** Regla efectiva tras resolver inherit vs custom. */
  effective_repeat_months: number | null;
};

export type ListCategoryWithItems = ListCategory & {
  items: ListItemWithEntry[];
};
