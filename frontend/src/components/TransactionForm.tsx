import React, { useState } from "react";
import { Transaction } from "../types";

export default function TransactionForm({
  onSaveBatch,
  majors = [],
  subs = [],
}: {
  // onSaveBatch may be async; await per-chunk to avoid duplicate POSTs
  onSaveBatch: (txs: Transaction[]) => Promise<void> | void;
  majors?: string[];
  subs?: string[];
}) {
  const emptyRow = (): Transaction => ({
    date: new Date().toISOString().slice(0, 10),
    type: "수입",
    major_category: "",
    sub_category: "",
    amount: 0,
    description: "",
  });

  const [rows, setRows] = useState<Transaction[]>([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);

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

  function isValidChoice(value: string, list: string[]) {
    if (!value) return false;
    return list.length === 0 ? true : list.includes(value);
  }

  // chunked upload to avoid huge payloads / server timeouts
  async function saveAll() {
    const valid = rows.filter((r) => {
      const okBasic = r.date && r.type && !isNaN(Number(r.amount));
      if (!okBasic) return false;
      if (majors.length > 0 && !isValidChoice(r.major_category, majors)) return false;
      if (subs.length > 0 && !isValidChoice(r.sub_category, subs)) return false;
      return true;
    });
    if (valid.length === 0) return alert("저장할 유효한 행이 없습니다. Major/Sub 값이 목록에 있어야 합니다.");

    // chunk size adjustable; keep conservative default
    const CHUNK = 50;
    const chunks: Transaction[][] = [];
    for (let i = 0; i < valid.length; i += CHUNK) chunks.push(valid.slice(i, i + CHUNK));

    setIsSaving(true);
    setSaveProgress({ done: 0, total: valid.length });
    try {
      // Call parent's handler per-chunk and await it — avoid posting twice
      for (let i = 0; i < chunks.length; i++) {
        const batch = chunks[i];
        try {
          await onSaveBatch(batch);
        } catch {
          // swallow errors per-chunk; progress still updated (parent may fallback to optimistic UI)
        }
        setSaveProgress((p) => p ? { done: p.done + batch.length, total: p.total } : null);
      }

      // clear form after successful/attempted upload
      setRows([emptyRow()]);
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  }

  return (
    <section className="entry-section">
      <h2>Multiple Entries</h2>

      {isSaving && saveProgress && (
        <div style={{ marginBottom: 8, color: "#444" }}>
          업로드 중... {saveProgress.done}/{saveProgress.total}
        </div>
      )}

      {/* description/header row */}
      <div className="entry-rows" style={{ marginBottom: 8 }}>
        <div className="entry-row header">
          <div>Date</div>
          <div>Type</div>
          <div>Major</div>
          <div>Sub</div>
          <div>Amount</div>
          <div>Description</div>
          <div />
        </div>
      </div>

      <div className="entry-rows">
        {rows.map((row, idx) => (
          <div key={idx} className="entry-row">
            <input type="date" value={row.date} onChange={(e) => updateRow(idx, { date: e.target.value })} />
            <select value={row.type} onChange={(e) => updateRow(idx, { type: e.target.value })} disabled={isSaving}>
              <option value="수입">수입</option>
              <option value="지출">지출</option>
            </select>

            {/* Major with datalist */}
            <div>
              <input
                list="majors-list"
                placeholder="Major"
                value={row.major_category}
                onChange={(e) => updateRow(idx, { major_category: e.target.value })}
                onBlur={(e) => {
                  if (majors.length > 0 && e.target.value && !majors.includes(e.target.value)) {
                    alert("Major 값은 설정된 목록에 있어야 합니다.");
                    updateRow(idx, { major_category: "" });
                  }
                }}
                disabled={isSaving}
              />
              <datalist id="majors-list">
                {majors.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            {/* Sub with datalist */}
            <div>
              <input
                list="subs-list"
                placeholder="Sub"
                value={row.sub_category}
                onChange={(e) => updateRow(idx, { sub_category: e.target.value })}
                onBlur={(e) => {
                  if (subs.length > 0 && e.target.value && !subs.includes(e.target.value)) {
                    alert("Sub 값은 설정된 목록에 있어야 합니다.");
                    updateRow(idx, { sub_category: "" });
                  }
                }}
                disabled={isSaving}
              />
              <datalist id="subs-list">
                {subs.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <input type="number" value={String(row.amount)} onChange={(e) => updateRow(idx, { amount: Number(e.target.value) })} disabled={isSaving} />
            <input placeholder="Desc" value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={isSaving} />
            <button onClick={() => removeRow(idx)} aria-label="remove" disabled={isSaving}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={addRow} disabled={isSaving}>Add Row</button>
        <button onClick={saveAll} style={{ marginLeft: 8 }} disabled={isSaving}>Save All</button>
      </div>
    </section>
  );
}
