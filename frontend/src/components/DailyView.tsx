import React, { useMemo } from "react";
import { Transaction, fmtCurrency } from "../types";

function isIncome(t: Transaction) {
  const ty = (t.type || "").toLowerCase();
  return ty.includes("income") || ty === "수입";
}

export default function DailyView({ transactions, onDelete }: { transactions: Transaction[]; onDelete?: (id?: number) => void }) {
  // group by date (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const m: Record<string, Transaction[]> = {};
    for (const t of transactions) {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      if (!m[key]) m[key] = [];
      m[key].push(t);
    }
    // sort dates descending
    const entries = Object.entries(m).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return entries;
  }, [transactions]);

  return (
    <section className="daily-section">
      <h2>일별 내역</h2>
      {byDate.length === 0 ? (
        <div>표시할 거래가 없습니다.</div>
      ) : (
        byDate.map(([date, list]) => {
          const income = list.filter(isIncome).reduce((s, t) => s + Number(t.amount || 0), 0);
          const expense = list.filter((t) => !isIncome(t)).reduce((s, t) => s + Number(t.amount || 0), 0);
          return (
            <div key={date} className="daily-day-block">
              <div className="daily-date-header">
                <strong>{date}</strong>
                <div className="daily-totals">
                  {income > 0 && <span className="daily-total income">+{fmtCurrency(income)}</span>}
                  {expense > 0 && <span className="daily-total expense">-{fmtCurrency(expense)}</span>}
                </div>
              </div>
              <div className="daily-transactions">
                {list.map((t, i) => (
                  <div className="transaction-row" key={i}>
                    <div className="transaction-left">
                      <span className="type-pill" style={{ color: isIncome(t) ? "green" : "crimson" }}>
                        {t.type}
                      </span>
                      <div>
                        <span className="cat">{t.major_category}{t.sub_category ? ` / ${t.sub_category}` : ""}</span>
                        {t.description ? <div className="transaction-desc">{t.description}</div> : null}
                      </div>
                    </div>
                    <div className="transaction-right" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={`txn-amount ${isIncome(t) ? "income" : "expense"}`}>
                        {isIncome(t) ? "+" : "-"}{fmtCurrency(Number(t.amount || 0))}
                      </span>
                      <button onClick={() => onDelete?.(t.id)} aria-label="delete">삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
