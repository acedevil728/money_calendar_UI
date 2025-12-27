import React, { useMemo } from "react";

type Transaction = {
  date: string;
  type: string; // "income" | "expense" or localized string
  major_category: string;
  sub_category: string;
  amount: number;
  description?: string;
};

type SummaryNode = {
  total: number;
  subs: Record<string, number>;
};

type Summary = Record<string, Record<string, SummaryNode>>; // type -> major -> node

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function SummaryView({ transactions }: { transactions: Transaction[] }) {
  const summary = useMemo<Summary>(() => {
    const out: Summary = {};
    for (const t of transactions) {
      const typeKey = (t.type || "unknown").toLowerCase();
      const major = t.major_category || "(No major)";
      const sub = t.sub_category || "(No sub)";
      if (!out[typeKey]) out[typeKey] = {};
      if (!out[typeKey][major]) out[typeKey][major] = { total: 0, subs: {} };
      out[typeKey][major].total += Number(t.amount || 0);
      out[typeKey][major].subs[sub] = (out[typeKey][major].subs[sub] || 0) + Number(t.amount || 0);
    }
    return out;
  }, [transactions]);

  const typeDisplay = (k: string) => {
    if (k === "income" || k === "수입") return "수입";
    if (k === "expense" || k === "지출") return "지출";
    return k;
  };

  return (
    <section style={{ marginTop: 16 }}>
      <h2>금액 요약</h2>
      {transactions.length === 0 ? (
        <div>거래 데이터가 없습니다. CSV를 업로드하거나 API에서 데이터를 로드하세요.</div>
      ) : (
        Object.keys(summary).map((typeKey) => {
          const majors = summary[typeKey];
          const typeTotal = Object.values(majors).reduce((s, m) => s + m.total, 0);
          return (
            <div key={typeKey} style={{ marginBottom: 12, padding: 8, border: "1px solid #e6e9ef", borderRadius: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{typeDisplay(typeKey)}</strong>
                <span>{fmt(typeTotal)}원</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {Object.entries(majors).map(([major, node]) => (
                  <div key={major} style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{major}</span>
                      <span>{fmt(node.total)}원</span>
                    </div>
                    <div style={{ marginLeft: 12, marginTop: 6 }}>
                      {Object.entries(node.subs).map(([sub, amt]) => (
                        <div key={sub} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                          <span style={{ color: "#334155" }}>{sub}</span>
                          <span style={{ color: "#0f172a" }}>{fmt(amt)}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
