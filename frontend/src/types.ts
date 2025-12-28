export type Transaction = {
  id?: number;
  date: string;
  type: string; // displayed as "수입" | "지출" in UI
  major_category: string;
  sub_category: string;
  amount: number;
  description?: string;
};

export type SummaryNode = {
  total: number;
  subs: Record<string, number>;
};

export type Summary = Record<string, Record<string, SummaryNode>>;

export function fmtCurrency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + "원";
}
