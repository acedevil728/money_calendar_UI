import React, { useEffect, useState, useMemo } from "react";
import SummaryView from "./components/SummaryView";
import TransactionForm from "./components/TransactionForm";
import CalendarView from "./components/CalendarView";
import DailyView from "./components/DailyView";
import FixedExpensesView from "./components/FixedExpensesView";
import SavingsView from "./components/SavingsView";
import { Transaction } from "./types";

export default function App(): JSX.Element {
  // state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // UI tabs: added fixed / savings
  const [tab, setTab] = useState<"summary" | "entries" | "calendar" | "daily" | "fixed" | "savings">("summary");

  // date filter
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // helper: map backend type -> 한글표시
  const mapTypeToKorean = (raw: string | undefined | null) => {
    const s = String(raw ?? "").toLowerCase();
    if (s.includes("income") || s.includes("수입")) return "수입";
    if (s.includes("expense") || s.includes("지출")) return "지출";
    return raw ?? "";
  };

  // normalize API payload (array or {items,...}) -> Transaction[]
  const normalizeApiData = (data: any): Transaction[] => {
    const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return arr.map((t: any) => ({
      id: t.id ?? undefined,
      date: String(t.date || t.transaction_date || ""),
      // store UI type as Korean only
      type: mapTypeToKorean(t.type ?? t.direction ?? ""),
      major_category: String(t.major_category || t.category || ""),
      sub_category: String(t.sub_category || t.subcategory || ""),
      amount: Number(t.amount ?? 0),
      description: String(t.description || ""),
    }));
  };

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const normalized = normalizeApiData(data);
        setTransactions(normalized);
      })
      .catch(() => {
        setTransactions([]);
        setError("Could not fetch /api/transactions — ensure backend is running.");
      });
  }, []);

  // helper: filter by date strings (inclusive). If filter empty, pass all.
  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactions;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // summary builder used for CSV export
  function buildSummary(data: Transaction[]) {
    const out: Record<string, Record<string, Record<string, number>>> = {};
    for (const t of data) {
      const typeKey = (t.type || "unknown").toLowerCase();
      const major = t.major_category || "(No major)";
      const sub = t.sub_category || "(No sub)";
      out[typeKey] ??= {};
      out[typeKey][major] ??= {};
      out[typeKey][major][sub] = (out[typeKey][major][sub] || 0) + Number(t.amount || 0);
    }
    return out;
  }

  function exportSummaryCsv() {
    const summary = buildSummary(filteredTransactions);
    // CSV header: type,major,sub,amount
    const rows: string[] = [["type", "major", "sub", "amount"].join(",")];
    for (const typeKey of Object.keys(summary)) {
      for (const major of Object.keys(summary[typeKey])) {
        for (const sub of Object.keys(summary[typeKey][major])) {
          const amount = summary[typeKey][major][sub];
          // escape commas in fields minimally
          const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
          rows.push([esc(typeKey), esc(major), esc(sub), String(amount)].join(","));
        }
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${startDate || "all"}_${endDate || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Export filtered transactions as CSV with one row per transaction (daily basis)
  function exportDailyCsv() {
    const rows: string[] = [["date", "type", "major", "sub", "amount", "description"].join(",")];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const items = filteredTransactions.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const t of items) {
      rows.push([
        esc(t.date),
        esc(t.type),
        esc(t.major_category),
        esc(t.sub_category),
        String(t.amount ?? ""),
        esc(t.description),
      ].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily_${startDate || "all"}_${endDate || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // handler to add transactions (from TransactionForm). POST then reload from server.
  async function handleAddTransactions(newTxs: Transaction[]) {
    // POST to backend; backend normalizes dates/types; afterwards re-fetch authoritative data
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTxs),
      });
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("fetch after POST failed");
      const data = await res.json();
      setTransactions(normalizeApiData(data));
    } catch {
      // optimistic local add as fallback: map types to Korean for display
      setTransactions((prev) => [
        ...newTxs.map((t) => ({ ...t, type: mapTypeToKorean(t.type) })),
        ...prev,
      ]);
    }
  }

  // delete handler used by DailyView
  async function handleDeleteTransaction(id?: number) {
    if (!id) return;
    try {
      const r = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (r.ok || r.status === 204) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } else {
        // try to refresh
        const res = await fetch("/api/transactions");
        if (res.ok) setTransactions(normalizeApiData(await res.json()));
      }
    } catch {
      // ignore network errors
    }
  }

  return (
    <div className="app-root">
      <header>
        <h1>Money Calendar</h1>
        <p>Frontend running — data served from backend API.</p>
      </header>

      <nav className="tabs" style={{ marginBottom: 12 }}>
        <button onClick={() => setTab("summary")} className={tab === "summary" ? "active" : ""}>Summary</button>
        <button onClick={() => setTab("entries")} className={tab === "entries" ? "active" : ""}>Entries</button>
        <button onClick={() => setTab("calendar")} className={tab === "calendar" ? "active" : ""}>Calendar</button>
        <button onClick={() => setTab("daily")} className={tab === "daily" ? "active" : ""}>Daily</button>
        <button onClick={() => setTab("fixed")} className={tab === "fixed" ? "active" : ""}>Fixed Expenses</button>
        <button onClick={() => setTab("savings")} className={tab === "savings" ? "active" : ""}>Savings</button>
      </nav>

      <section style={{ margin: "12px 0" }}>
        <label style={{ marginRight: 8 }}>Start:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label style={{ margin: "0 8px" }}>End:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button style={{ marginLeft: 12 }} onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
        <button style={{ marginLeft: 12 }} onClick={exportSummaryCsv}>Export Summary CSV</button>
        <button style={{ marginLeft: 12 }} onClick={exportDailyCsv}>Export Daily CSV</button>
      </section>

      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

      <main>
        {tab === "summary" && <SummaryView transactions={filteredTransactions} />}
        {tab === "entries" && <TransactionForm onSaveBatch={handleAddTransactions} />}
        {tab === "calendar" && <CalendarView transactions={filteredTransactions} />}
        {tab === "daily" && <DailyView transactions={filteredTransactions} onDelete={handleDeleteTransaction} />}
        {tab === "fixed" && <FixedExpensesView />}
        {tab === "savings" && <SavingsView />}
      </main>
    </div>
  );
}
