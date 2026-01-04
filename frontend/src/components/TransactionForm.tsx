import React, { useState } from "react";
import { Transaction } from "../types";

export default function TransactionForm({
  onSaveBatch,
  majors = [],
  subs = [],
}: {
  onSaveBatch: (txs: Transaction[]) => void;
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

  async function saveAll() {
    // basic validation: ensure required and major/sub in lists if lists present
    const valid = rows.filter((r) => {
      const okBasic = r.date && r.type && !isNaN(Number(r.amount));
      if (!okBasic) return false;
      if (majors.length > 0 && !isValidChoice(r.major_category, majors)) return false;
      if (subs.length > 0 && !isValidChoice(r.sub_category, subs)) return false;
      return true;
    });
    if (valid.length === 0) return alert("저장할 유효한 행이 없습니다. Major/Sub 값이 목록에 있어야 합니다.");
    onSaveBatch(valid);
    // clear to single empty row
    setRows([emptyRow()]);
  }

  return (
    <section className="entry-section">
      <h2>Multiple Entries</h2>

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
            <select value={row.type} onChange={(e) => updateRow(idx, { type: e.target.value })}>
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
              />
              <datalist id="subs-list">
                {subs.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

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
