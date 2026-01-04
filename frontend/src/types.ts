export type Transaction = {
  id?: number;
  date: string;
  type: string; // displayed as "수입" | "지출" in UI
  major_category: string;
  sub_category: string;
  amount: number;
  description?: string;
};

export type FixedExpense = {
  id?: number;
  major_category: string;
  sub_category: string;
  description?: string;
  amount: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  day_of_month: number;
  active?: boolean;
};

export type Saving = {
  id?: number;
  name?: string;
  kind: string; // 적금/예금/파킹/주식/기타
  initial_balance: number;
  contribution_amount: number;
  start_date?: string | null;
  end_date?: string | null;
  day_of_month?: number | null;
  frequency?: string;
  withdrawn?: boolean;
  active?: boolean;
};

export type SavingsForecastItem = {
  id?: number;
  name?: string;
  kind?: string;
  predicted_balance: number;
  initial_balance?: number;
  contribution_amount?: number;
};

export type SavingsForecast = {
  date: string;
  total: number;
  items: SavingsForecastItem[];
};

export type SummaryNode = {
  total: number;
  subs: Record<string, number>;
};

export type Summary = Record<string, Record<string, SummaryNode>>;

export function fmtCurrency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + "원";
}
