import React, { useEffect, useState, useMemo } from "react";
import SummaryView from "./components/SummaryView";
import TransactionForm from "./components/TransactionForm";
import CalendarView from "./components/CalendarView";
import DailyView from "./components/DailyView";
import FixedExpensesView from "./components/FixedExpensesView";
import SavingsView from "./components/SavingsView";
import SettingsView from "./components/SettingsView";
import { Transaction } from "./types";

export default function App(): JSX.Element {
  // state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [txOffset, setTxOffset] = useState(0);
  const [txPageSize, setTxPageSize] = useState(500); // adjustable page size for large datasets
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const MAX_RETRIES = 2;
  const FETCH_TIMEOUT_MS = 10_000;

  // UI tabs: added fixed / savings / settings
  const [tab, setTab] = useState<"summary" | "entries" | "calendar" | "daily" | "fixed" | "savings" | "settings">("summary");

  // date filter: default to current month (build YYYY-MM-DD locally, avoid toISOString timezone shift)
  function pad(n: number) { return String(n).padStart(2, "0"); }
  function makeYMD(year: number, monthZeroBased: number, day: number) {
    return `${year}-${pad(monthZeroBased + 1)}-${pad(day)}`;
  }
  const makeMonthRange = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: makeYMD(first.getFullYear(), first.getMonth(), first.getDate()),
      end: makeYMD(last.getFullYear(), last.getMonth(), last.getDate()),
    };
  };
  const monthRange = makeMonthRange();
  // default to current month range (show this month's transactions by default)
  const [startDate, setStartDate] = useState<string>(monthRange.start);
  const [endDate, setEndDate] = useState<string>(monthRange.end);
  // enforce max 1 year window (end <= start + 1 year - 1 day)
  useEffect(() => {
    if (!startDate || !endDate) return;
    try {
      const s = new Date(startDate + "T00:00:00");
      const e = new Date(endDate + "T00:00:00");
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
      // if start after end, keep end equal to start
      if (s > e) {
        setEndDate(startDate);
        return;
      }
      const limit = new Date(s);
      limit.setFullYear(limit.getFullYear() + 1);
      limit.setDate(limit.getDate() - 1); // inclusive 1 year window
      if (e > limit) {
        const limStr = makeYMD(limit.getFullYear(), limit.getMonth(), limit.getDate());
        setEndDate(limStr);
        setError("최대 1년까지만 조회할 수 있습니다. 기간을 조정했습니다.");
      }
    } catch {
      // ignore parse errors
    }
  }, [startDate, endDate]);

  // majors/subs settings (loaded from backend)
  const [majors, setMajors] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);

  // load categories from backend on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const r = await fetch("/api/settings/categories");
        if (!r.ok) throw new Error("no categories");
        const data = await r.json();
        setMajors(Array.isArray(data.majors) ? data.majors : []);
        setSubs(Array.isArray(data.subs) ? data.subs : []);
      } catch {
        setMajors([]);
        setSubs([]);
      }
    }
    loadCategories();
  }, []);

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

  // resilient fetch with timeout and retries
  async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeout = FETCH_TIMEOUT_MS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (err) {
        clearTimeout(id);
        if (attempt === MAX_RETRIES) throw err;
        // small backoff before retry
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw new Error("unreachable");
  }

  // load transactions with pagination (limit/offset). When many rows exist, use "Load more".
  async function loadTransactions({ reset = false } = {}) {
    if (loadingTransactions) return;
    setLoadingTransactions(true);
    setError(null);
    try {
      const offset = reset ? 0 : txOffset;
      // include date filter so backend returns relevant page of data
      const params = new URLSearchParams();
      params.set("limit", String(txPageSize));
      params.set("offset", String(offset));
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      const url = `/api/transactions?${params.toString()}`;
      const r = await fetchWithTimeout(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const normalized = normalizeApiData(data);
      if (reset) {
        setTransactions(normalized);
      } else {
        setTransactions((prev) => [...prev, ...normalized]);
      }
      // if fewer than pageSize returned, no more pages available
      setCanLoadMore(normalized.length >= txPageSize);
      setTxOffset(reset ? normalized.length : txOffset + normalized.length);
    } catch (e) {
      // keep existing transactions but show error hint
      setError("Could not fetch /api/transactions (timeout or server busy). Try smaller page size or reload.");
    } finally {
      setLoadingTransactions(false);
    }
  }

  // initial load and reload when page size or date filters change
  useEffect(() => {
    setTxOffset(0);
    loadTransactions({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txPageSize, startDate, endDate]);

  // helper to extract YYYY-MM-DD from transaction safely
  function txYmd(t: Transaction) {
    if (typeof t.date === "string" && t.date.length >= 10) return t.date.slice(0, 10);
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return "";
    return makeYMD(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // helper: filter by date strings (inclusive). If filter empty, pass all.
  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactions;
    return transactions.filter((t) => {
      const key = txYmd(t);
      if (!key) return false;
      if (startDate && key < startDate) return false;
      if (endDate && key > endDate) return false;
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
      // after creating, reload from server using current pagination reset
      await loadTransactions({ reset: true });
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

  // update handlers to accept settings changes from SettingsView and persist to backend
  async function handleSettingsChange(newMajors: string[], newSubs: string[]) {
    // optimistic update so UI is responsive
    setMajors(newMajors);
    setSubs(newSubs);
    try {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ majors: newMajors, subs: newSubs }),
      });
      if (res.ok) {
        // if server returns authoritative lists, use them
        try {
          const data = await res.json();
          setMajors(Array.isArray(data.majors) ? data.majors : newMajors);
          setSubs(Array.isArray(data.subs) ? data.subs : newSubs);
          return;
        } catch {
          // no JSON body — fallback to explicit GET below
        }
      }
      // fallback: re-fetch authoritative lists
      const r = await fetch("/api/settings/categories");
      if (r.ok) {
        const data = await r.json();
        setMajors(Array.isArray(data.majors) ? data.majors : []);
        setSubs(Array.isArray(data.subs) ? data.subs : []);
      }
    } catch {
      // ignore network errors; UI already updated optimistically
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
        <button onClick={() => setTab("settings")} className={tab === "settings" ? "active" : ""}>Settings</button>
      </nav>

      <section style={{ margin: "12px 0" }}>
        <label style={{ marginRight: 8 }}>Start:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label style={{ margin: "0 8px" }}>End:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button style={{ marginLeft: 12 }} onClick={() => { const mr = makeMonthRange(); setStartDate(mr.start); setEndDate(mr.end); }}>This month</button>
        <button style={{ marginLeft: 12 }} onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
        <button style={{ marginLeft: 12 }} onClick={exportSummaryCsv}>Export Summary CSV</button>
        <button style={{ marginLeft: 12 }} onClick={exportDailyCsv}>Export Daily CSV</button>

        {/* Pagination controls for large datasets */}
        <div style={{ display: "inline-block", marginLeft: 16 }}>
          <label>Page size:</label>
          <select value={txPageSize} onChange={(e) => { setTxPageSize(Number(e.target.value)); setTxOffset(0); }}>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
          <button style={{ marginLeft: 8 }} onClick={() => loadTransactions({ reset: true })} disabled={loadingTransactions}>Reload</button>
          <button style={{ marginLeft: 8 }} onClick={() => loadTransactions()} disabled={!canLoadMore || loadingTransactions}>
            {loadingTransactions ? "Loading..." : canLoadMore ? "Load more" : "No more"}
          </button>
        </div>
      </section>

      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

      <main>
        {tab === "summary" && <SummaryView transactions={filteredTransactions} />}
        {tab === "entries" && <TransactionForm onSaveBatch={handleAddTransactions} majors={majors} subs={subs} />}
        {tab === "calendar" && <CalendarView transactions={filteredTransactions} start={startDate} end={endDate} />}
        {tab === "daily" && <DailyView transactions={filteredTransactions} onDelete={handleDeleteTransaction} />}
        {tab === "fixed" && <FixedExpensesView majors={majors} subs={subs} />}
        {tab === "savings" && <SavingsView />}
        {tab === "settings" && <SettingsView majorsInit={majors} subsInit={subs} onChange={handleSettingsChange} />}
      </main>
    </div>
  );
}
