import React, { useEffect, useState } from "react";
import { Saving, SavingsForecast } from "../types";
import { fmtCurrency } from "../types";

export default function SavingsView() {
  const [items, setItems] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Saving>>({
    name: "",
    kind: "적금",
    initial_balance: 0,
    contribution_amount: 0,
    start_date: "",
    end_date: "",
    day_of_month: 1,
    frequency: "monthly",
    withdrawn: false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [forecastDate, setForecastDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [forecast, setForecast] = useState<SavingsForecast | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/savings");
      if (!r.ok) throw new Error("load failed");
      const data = await r.json();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setField(k: keyof Saving, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.kind) { alert("kind required"); return; }
    try {
      if (editingId) {
        await fetch(`/api/savings/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setEditingId(null);
      } else {
        await fetch("/api/savings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setForm({
        name: "",
        kind: "적금",
        initial_balance: 0,
        contribution_amount: 0,
        start_date: "",
        end_date: "",
        day_of_month: 1,
        frequency: "monthly",
        withdrawn: false,
      });
      load();
    } catch {
      alert("요청 실패");
    }
  }

  async function remove(id?: number) {
    if (!id) return;
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/savings/${id}`, { method: "DELETE" });
      load();
    } catch {
      alert("삭제 실패");
    }
  }

  function startEdit(it: Saving) {
    setEditingId(it.id ?? null);
    setForm({
      name: it.name,
      kind: it.kind,
      initial_balance: it.initial_balance,
      contribution_amount: it.contribution_amount,
      start_date: it.start_date ?? "",
      end_date: it.end_date ?? "",
      day_of_month: it.day_of_month ?? 1,
      frequency: it.frequency,
      withdrawn: it.withdrawn,
      active: it.active,
    });
  }

  async function runForecast() {
    try {
      const r = await fetch(`/api/savings/forecast?date=${forecastDate}`);
      if (!r.ok) throw new Error("forecast failed");
      const data = await r.json();
      setForecast(data);
    } catch {
      alert("예측 실패");
    }
  }

  return (
    <section style={{ marginTop: 12 }}>
      <h2>저축 (Savings)</h2>

      <div style={{ marginBottom: 8 }}>
        <strong>새 저축 추가/수정</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <input placeholder="Name" value={form.name || ""} onChange={(e) => setField("name", e.target.value)} />
          <select value={form.kind || "적금"} onChange={(e) => setField("kind", e.target.value)}>
            <option>적금</option>
            <option>예금</option>
            <option>파킹</option>
            <option>주식</option>
            <option>기타</option>
          </select>
          <input placeholder="Initial" type="number" value={form.initial_balance ?? 0} onChange={(e) => setField("initial_balance", Number(e.target.value))} />
          <input placeholder="Contribution" type="number" value={form.contribution_amount ?? 0} onChange={(e) => setField("contribution_amount", Number(e.target.value))} />
          <input type="date" value={form.start_date || ""} onChange={(e) => setField("start_date", e.target.value)} />
          <input type="date" value={form.end_date || ""} onChange={(e) => setField("end_date", e.target.value)} />
          <input placeholder="Day" type="number" value={form.day_of_month ?? 1} onChange={(e) => setField("day_of_month", Number(e.target.value))} />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            출금
            <input type="checkbox" checked={!!form.withdrawn} onChange={(e) => setField("withdrawn", e.target.checked)} />
          </label>
          <button onClick={submit}>{editingId ? "Update" : "Create"}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({ name: "", kind: "적금", initial_balance: 0, contribution_amount: 0, start_date: "", end_date: "", day_of_month: 1, frequency: "monthly", withdrawn: false }); }}>Cancel</button>}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <h3>목록</h3>
        {loading ? <div>Loading...</div> : items.length === 0 ? <div>없음</div> : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it) => (
              <div key={it.id} style={{ padding: 8, border: "1px solid #e6e9ef", borderRadius: 6, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div><strong>{it.name || it.kind}</strong> — {it.kind} {it.withdrawn ? "(출금)" : ""}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>초기 {fmtCurrency(it.initial_balance || 0)} / 매회 {fmtCurrency(it.contribution_amount || 0)} / {it.start_date ?? "—"} → {it.end_date ?? "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(it)}>Edit</button>
                  <button onClick={() => remove(it.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3>저축 예측 (Forecast)</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={forecastDate} onChange={(e) => setForecastDate(e.target.value)} />
          <button onClick={runForecast}>예측 실행</button>
        </div>
        {forecast && (
          <div style={{ marginTop: 8 }}>
            <div><strong>{forecast.date}</strong> 총합: {fmtCurrency(forecast.total)}</div>
            <div style={{ marginTop: 8 }}>
              {forecast.items.map((it) => (
                <div key={it.id} style={{ padding: 6, borderBottom: "1px solid #eee" }}>
                  <div><strong>{it.name || it.kind}</strong> — {fmtCurrency(it.predicted_balance)}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>초기: {fmtCurrency(it.initial_balance || 0)} / 정기투입: {fmtCurrency(it.contribution_amount || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
