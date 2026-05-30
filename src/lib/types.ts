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
  goal_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type GoalStatus = "active" | "achieved" | "archived";

export type Goal = {
  id: string;
  household_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  emoji: string;
  color: string;
  status: GoalStatus;
  sort_order: number;
  created_at: string;
};

// Goal augmented with computed progress (sum of tagged Nabung deposits).
export type GoalWithProgress = Goal & { saved: number };

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

export type CustomPeriod = {
  id: string;
  household_id: string;
  label_month: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

