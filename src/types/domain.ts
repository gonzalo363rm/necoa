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
