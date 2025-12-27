import React, { useEffect, useState } from "react";
import SummaryView from "./components/SummaryView";

type Transaction = {
  date: string;
  type: string; // "income" | "expense"
  major_category: string;
  sub_category: string;
  amount: number;
  description?: string;
};

export default function App(): JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const normalized = data.map((t) => ({
            date: String(t.date || t.transaction_date || ""),
            type: String(t.type || t.direction || "").toLowerCase(),
            major_category: String(t.major_category || t.category || ""),
            sub_category: String(t.sub_category || t.subcategory || ""),
            amount: Number(t.amount ?? 0),
            description: String(t.description || ""),
          }));
          setTransactions(normalized);
        } else {
          throw new Error("Invalid transactions payload");
        }
      })
      .catch(() => {
        setTransactions([]);
        setError("Could not fetch /api/transactions — ensure backend is running and backend/data contains CSV files.");
      });
  }, []);

  return (
    <div className="app-root">
      <header>
        <h1>Money Calendar</h1>
        <p>Frontend running — data served from backend CSV files.</p>
      </header>

      <section style={{ margin: "16px 0" }}>
        <div>
          Backend-managed CSVs are used. Place CSV files in backend/data (e.g. sample_transactions.csv) and restart backend if needed.
        </div>
        {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
      </section>

      <SummaryView transactions={transactions ?? []} />
      {/* ...existing code... */}
    </div>
  );
}
