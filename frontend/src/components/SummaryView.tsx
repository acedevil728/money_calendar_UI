import React, { useMemo } from "react";
import { Transaction, Summary, SummaryNode, fmtCurrency } from "../types";

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

  function MajorBlock({ major, node }: { major: string; node: SummaryNode }) {
    return (
      <div className="summary-major" key={major}>
        <div className="summary-major-header">
          <span>{major}</span>
          <span className="summary-amount">{fmtCurrency(node.total)}</span>
        </div>
        <div className="summary-subs">
          {Object.entries(node.subs).map(([sub, amt]) => (
            <div className="summary-sub" key={sub}>
              <span className="summary-sub-name">{sub}</span>
              <span className="summary-sub-amt">{fmtCurrency(amt)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="summary-section" style={{ marginTop: 16 }}>
      <h2>금액 요약</h2>
      {transactions.length === 0 ? (
        <div>거래 데이터가 없습니다. 백엔드 API에서 데이터를 로드하세요.</div>
      ) : (
        Object.keys(summary).map((typeKey) => {
          const majors = summary[typeKey];
          const typeTotal = Object.values(majors).reduce((s, m) => s + m.total, 0);
          return (
            <div className="summary-type" key={typeKey}>
              <div className="summary-type-header">
                <strong>{typeDisplay(typeKey)}</strong>
                <span className="summary-amount">{fmtCurrency(typeTotal)}</span>
              </div>

              <div className="summary-majors">
                {Object.entries(majors).map(([major, node]) => (
                  <MajorBlock major={major} node={node} key={major} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
