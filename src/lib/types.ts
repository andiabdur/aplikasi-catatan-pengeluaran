export type Category = {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_archived: boolean;
};

export type Budget = {
  id: string;
  household_id: string;
  category_id: string;
  month: string;
  amount: number;
};

export type Income = {
  id: string;
  household_id: string;
  month: string;
  source: string;
  amount: number;
};

export type Expense = {
  id: string;
  household_id: string;
  category_id: string;
  spent_at: string;
  description: string;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type MonthlySummaryRow = {
  household_id: string;
  category_id: string;
  category_name: string;
  color: string | null;
  sort_order: number;
  label_month: string;
  period_start: string;
  period_end: string;
  budget: number;
  spent: number;
  remaining: number;
  usage_pct: number;
};
