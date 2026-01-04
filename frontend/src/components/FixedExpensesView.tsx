import React, { useEffect, useState } from "react";
import { FixedExpense } from "../types";

export default function FixedExpensesView() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<FixedExpense>>({
    major_category: "",
    sub_category: "",
    amount: 0,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    day_of_month: 1,
    description: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/fixed_expenses");
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

  function setField(k: keyof FixedExpense, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    // validate required fields
    const req = ["major_category", "sub_category", "amount", "start_date", "end_date", "day_of_month"] as const;
    for (const k of req) {
      // @ts-ignore
      if (!form[k]) {
        alert(`필수: ${k}`);
        return;
      }
    }
    try {
      if (editingId) {
        await fetch(`/api/fixed_expenses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setEditingId(null);
      } else {
        await fetch("/api/fixed_expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setForm({
        major_category: "",
        sub_category: "",
        amount: 0,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        day_of_month: 1,
        description: "",
      });
      load();
    } catch (e) {
      alert("요청 실패");
    }
  }

  async function remove(id?: number) {
    if (!id) return;
    if (!confirm("정말 삭제하시겠습니까? 관련으로 생성된 거래도 함께 삭제됩니다.")) return;
    try {
      await fetch(`/api/fixed_expenses/${id}`, { method: "DELETE" });
      load();
    } catch {
      alert("삭제 실패");
    }
  }

  function startEdit(it: FixedExpense) {
    setEditingId(it.id ?? null);
    setForm({
      major_category: it.major_category,
      sub_category: it.sub_category,
      description: it.description,
      amount: it.amount,
      start_date: it.start_date,
      end_date: it.end_date,
      day_of_month: it.day_of_month,
      active: it.active,
    });
  }

  return (
    <section style={{ marginTop: 12 }}>
      <h2>고정 지출 (Fixed Expenses)</h2>
      <div style={{ marginBottom: 8 }}>
        <strong>새 고정 지출 추가/수정</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <input placeholder="Major" value={form.major_category || ""} onChange={(e) => setField("major_category", e.target.value)} />
          <input placeholder="Sub" value={form.sub_category || ""} onChange={(e) => setField("sub_category", e.target.value)} />
          <input placeholder="Amount" type="number" value={form.amount ?? 0} onChange={(e) => setField("amount", Number(e.target.value))} />
          <input type="date" value={form.start_date || ""} onChange={(e) => setField("start_date", e.target.value)} />
          <input type="date" value={form.end_date || ""} onChange={(e) => setField("end_date", e.target.value)} />
          <input placeholder="Day" type="number" value={form.day_of_month ?? 1} onChange={(e) => setField("day_of_month", Number(e.target.value))} />
          <input placeholder="Description" value={form.description || ""} onChange={(e) => setField("description", e.target.value)} />
          <button onClick={submit}>{editingId ? "Update" : "Create"}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({ major_category: "", sub_category: "", amount: 0, start_date: new Date().toISOString().slice(0,10), end_date: new Date().toISOString().slice(0,10), day_of_month: 1 }); }}>Cancel</button>}
        </div>
      </div>

      <div>
        <h3>목록</h3>
        {loading ? <div>Loading...</div> : items.length === 0 ? <div>없음</div> : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it) => (
              <div key={it.id} style={{ padding: 8, border: "1px solid #e6e9ef", borderRadius: 6, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div><strong>{it.major_category} / {it.sub_category}</strong> — {it.description || ""}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{it.start_date} → {it.end_date} (매월 {it.day_of_month}일) • 금액: {it.amount}</div>
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
    </section>
  );
}
