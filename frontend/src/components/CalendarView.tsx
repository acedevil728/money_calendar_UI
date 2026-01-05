import React, { useMemo, useState, useEffect } from "react";
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

export default function CalendarView({
  transactions,
  start,
  end,
}: {
  transactions: Transaction[];
  start?: string;
  end?: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // build list of months to show based on start/end (inclusive). If no filter provided, show current month.
  const months = useMemo(() => {
    const mk = (y: number, m: number) => ({ year: y, month: m });
    if (start && end) {
      const s = new Date(start + "T00:00:00");
      const e = new Date(end + "T00:00:00");
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return [mk(new Date().getFullYear(), new Date().getMonth())];
      const list = [];
      let y = s.getFullYear();
      let m = s.getMonth();
      while (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) {
        list.push(mk(y, m));
        m++;
        if (m > 11) { m = 0; y++; }
      }
      return list.length ? list : [mk(new Date().getFullYear(), new Date().getMonth())];
    } else {
      const now = new Date();
      return [mk(now.getFullYear(), now.getMonth())];
    }
  }, [start, end]);

  // current displayed month index within months[]
  const [currentIdx, setCurrentIdx] = useState(0);
  useEffect(() => {
    // default to the month that contains today if present, else 0
    const now = new Date();
    const found = months.findIndex((mm) => mm.year === now.getFullYear() && mm.month === now.getMonth());
    setCurrentIdx(found >= 0 ? found : 0);
    // clear selectedDate if outside new months range
    setSelectedDate((sd) => {
      if (!sd) return sd;
      const sdate = sd.slice(0, 10);
      const y = Number(sdate.slice(0, 4));
      const mo = Number(sdate.slice(5, 7)) - 1;
      const inRange = months.some((mm) => mm.year === y && mm.month === mo);
      return inRange ? sd : null;
    });
  }, [months]);

  const base = new Date(months[currentIdx].year, months[currentIdx].month, 1);

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
          <button onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx <= 0}>◀</button>
          <button onClick={() => {
            const nowIdx = months.findIndex((mm) => mm.year === new Date().getFullYear() && mm.month === new Date().getMonth());
            setCurrentIdx(nowIdx >= 0 ? nowIdx : 0);
          }} style={{ margin: "0 8px" }}>Today</button>
          <button onClick={() => setCurrentIdx((i) => Math.min(months.length - 1, i + 1))} disabled={currentIdx >= months.length - 1}>▶</button>
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
