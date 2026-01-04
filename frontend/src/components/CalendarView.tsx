import React, { useMemo, useState } from "react";
import { Transaction, fmtCurrency } from "../types";

function sumList(list: Transaction[]) {
  return list.reduce(
    (acc, t) => {
      const amt = Number(t.amount || 0);
      if ((t.type || "").toLowerCase().includes("income") || (t.type || "") === "수입") acc.income += amt;
      else acc.expense += amt;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

export default function CalendarView({ transactions }: { transactions: Transaction[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  // helper to build YYYY-MM-DD without using toISOString (avoids timezone shifts)
  function pad(n: number) {
    return String(n).padStart(2, "0");
  }
  function makeYMD(year: number, monthZeroBased: number, day: number) {
    return `${year}-${pad(monthZeroBased + 1)}-${pad(day)}`;
  }

  const days = useMemo(() => {
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const startWeek = firstDay.getDay(); // 0..6
    const cells: Array<{ date?: string } | null> = [];
    // leading padding so weekdays align
    for (let i = 0; i < startWeek; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const s = makeYMD(year, month, d);
      cells.push({ date: s });
    }
    // trailing padding to fill final week
    const totalCells = cells.length;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trailing; i++) cells.push(null);
    return cells;
  }, [base]);

  // group transactions by date string (prefer using input string directly to avoid timezone shifts)
  const byDate = useMemo(() => {
    const m: Record<string, Transaction[]> = {};
    for (const t of transactions) {
      const key =
        typeof t.date === "string" && t.date.length >= 10
          ? t.date.slice(0, 10)
          : (() => {
              const d = new Date(t.date);
              if (isNaN(d.getTime())) return "";
              return makeYMD(d.getFullYear(), d.getMonth(), d.getDate());
            })();
      if (!key) continue;
      if (!m[key]) m[key] = [];
      m[key].push(t);
    }
    return m;
  }, [transactions]);

  return (
    <section className="calendar-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <button onClick={() => setMonthOffset((m) => m - 1)}>◀</button>
          <button onClick={() => setMonthOffset(0)} style={{ margin: "0 8px" }}>Today</button>
          <button onClick={() => setMonthOffset((m) => m + 1)}>▶</button>
        </div>
        <strong>{base.toLocaleString(undefined, { year: "numeric", month: "long" })}</strong>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekday">Sun</div>
        <div className="calendar-weekday">Mon</div>
        <div className="calendar-weekday">Tue</div>
        <div className="calendar-weekday">Wed</div>
        <div className="calendar-weekday">Thu</div>
        <div className="calendar-weekday">Fri</div>
        <div className="calendar-weekday">Sat</div>

        {days.map((cell, idx) =>
          cell ? (
            <div key={idx} className="calendar-cell" onClick={() => setSelectedDate(cell.date)}>
              <div className="calendar-cell-date">{cell.date!.slice(8, 10)}</div>
              <div className="calendar-cell-badges">
                {(() => {
                  const list = byDate[cell.date!] || [];
                  const sums = sumList(list);
                  return (
                    <>
                      {sums.income > 0 && <span className="badge income">+{Math.round(sums.income)}</span>}
                      {sums.expense > 0 && <span className="badge expense">-{Math.round(sums.expense)}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div key={idx} className="calendar-cell empty" />
          )
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Selected Date: {selectedDate ?? "—"}</h3>
        {selectedDate ? (
          <div>
            {(byDate[selectedDate] || []).map((t, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", alignItems: "center" }}>
                <div>
                  <strong style={{ color: (t.type || "").toLowerCase().includes("income") || t.type === "수입" ? "green" : "crimson" }}>
                    {t.type}
                  </strong>{" "}
                  — {t.major_category} / {t.sub_category}
                  {t.description ? <div className="transaction-desc" style={{ marginTop: 4 }}>{t.description}</div> : null}
                </div>
                <div>
                  <span style={{ color: (t.type || "").toLowerCase().includes("income") || t.type === "수입" ? "green" : "crimson", fontWeight: 600 }}>
                    {( (t.type || "").toLowerCase().includes("income") || t.type === "수입") ? "+" : "-"}{fmtCurrency(Number(t.amount || 0))}
                  </span>
                </div>
              </div>
            ))}
            {(byDate[selectedDate] || []).length === 0 && <div>No transactions</div>}
          </div>
        ) : null}
      </div>
    </section>
  );
}
