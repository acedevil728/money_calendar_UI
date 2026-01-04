import React, { useEffect, useState } from "react";

export default function SettingsView({
  majorsInit = [],
  subsInit = [],
  onChange,
}: {
  majorsInit?: string[];
  subsInit?: string[];
  onChange?: (majors: string[], subs: string[]) => void;
}) {
  // initialize from props
  const [majors, setMajors] = useState<string[]>(majorsInit);
  const [subs, setSubs] = useState<string[]>(subsInit);
  const [newMajor, setNewMajor] = useState("");
  const [newSub, setNewSub] = useState("");

  // mark user-driven edits; only when true will we notify parent
  const [isDirty, setIsDirty] = useState(false);

  // sync internal state when parent updates props (do not mark dirty)
  useEffect(() => {
    setMajors(Array.isArray(majorsInit) ? majorsInit : []);
  }, [majorsInit]);

  useEffect(() => {
    setSubs(Array.isArray(subsInit) ? subsInit : []);
  }, [subsInit]);

  // notify parent only when user made changes (isDirty)
  useEffect(() => {
    if (!isDirty) return;
    onChange?.(majors, subs);
    // clear dirty after notifying parent to avoid loops when parent re-sends props
    setIsDirty(false);
  }, [majors, subs, isDirty]);

  function addMajor() {
    const v = newMajor.trim();
    if (!v) return;
    if (majors.includes(v)) { setNewMajor(""); return; }
    const next = [...majors, v];
    setMajors(next);
    setNewMajor("");
    setIsDirty(true); // user action
  }

  function addSub() {
    const v = newSub.trim();
    if (!v) return;
    if (subs.includes(v)) { setNewSub(""); return; }
    const next = [...subs, v];
    setSubs(next);
    setNewSub("");
    setIsDirty(true); // user action
  }

  function removeMajor(i: number) {
    const next = majors.filter((_, idx) => idx !== i);
    setMajors(next);
    setIsDirty(true); // user action
  }

  function removeSub(i: number) {
    const next = subs.filter((_, idx) => idx !== i);
    setSubs(next);
    setIsDirty(true); // user action
  }

  return (
    <section style={{ marginTop: 12 }}>
      <h2>Settings</h2>

      <div style={{ marginBottom: 12 }}>
        <h3>Majors</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input placeholder="새 Major" value={newMajor} onChange={(e) => setNewMajor(e.target.value)} />
          <button onClick={addMajor}>Add Major</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {majors.map((m, i) => (
            <div key={m} style={{ padding: 6, border: "1px solid #e6e9ef", borderRadius: 6, background: "#fff" }}>
              <span>{m}</span>
              <button style={{ marginLeft: 8 }} onClick={() => removeMajor(i)}>Remove</button>
            </div>
          ))}
          {majors.length === 0 && <div style={{ color: "#666" }}>No majors defined</div>}
        </div>
      </div>

      <div>
        <h3>Subs</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input placeholder="새 Sub" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
          <button onClick={addSub}>Add Sub</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {subs.map((s, i) => (
            <div key={s} style={{ padding: 6, border: "1px solid #e6e9ef", borderRadius: 6, background: "#fff" }}>
              <span>{s}</span>
              <button style={{ marginLeft: 8 }} onClick={() => removeSub(i)}>Remove</button>
            </div>
          ))}
          {subs.length === 0 && <div style={{ color: "#666" }}>No subs defined</div>}
        </div>
      </div>
    </section>
  );
}
