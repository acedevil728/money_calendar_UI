import React, { useState } from "react";
import { Transaction } from "../types";

export default function TransactionForm({ onSaveBatch }: { onSaveBatch: (txs: Transaction[]) => void }) {
  const emptyRow = (): Transaction => ({
    date: new Date().toISOString().slice(0, 10),
    type: "수입",
    major_category: "",
    sub_category: "",
    amount: 0,
    description: "",
  });

  const [rows, setRows] = useState<Transaction[]>([emptyRow()]);

  function updateRow(idx: number, patch: Partial<Transaction>) {
    setRows((r) => {
      const copy = [...r];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  function addRow() {
    setRows((r) => [...r, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  async function saveAll() {
    // basic validation
    const valid = rows.filter((r) => r.date && r.type && r.major_category && !isNaN(Number(r.amount)));
    if (valid.length === 0) return;
    onSaveBatch(valid);
    // clear to single empty row
    setRows([emptyRow()]);
  }

  return (
    <section className="entry-section">
      <h2>Multiple Entries</h2>
      <div className="entry-rows">
        {rows.map((row, idx) => (
          <div key={idx} className="entry-row">
            <input type="date" value={row.date} onChange={(e) => updateRow(idx, { date: e.target.value })} />
            <select value={row.type} onChange={(e) => updateRow(idx, { type: e.target.value })}>
              <option value="수입">수입</option>
              <option value="지출">지출</option>
            </select>
            <input placeholder="Major" value={row.major_category} onChange={(e) => updateRow(idx, { major_category: e.target.value })} />
            <input placeholder="Sub" value={row.sub_category} onChange={(e) => updateRow(idx, { sub_category: e.target.value })} />
            <input type="number" value={String(row.amount)} onChange={(e) => updateRow(idx, { amount: Number(e.target.value) })} />
            <input placeholder="Desc" value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />
            <button onClick={() => removeRow(idx)} aria-label="remove">✕</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={addRow}>Add Row</button>
        <button onClick={saveAll} style={{ marginLeft: 8 }}>Save All</button>
      </div>
    </section>
  );
}
