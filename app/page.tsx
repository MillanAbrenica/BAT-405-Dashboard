"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import {
  ALL, byYearLevel, COLLEGES, collegeOf, compare, courses, CourseAgg, deptsIn, DIMENSIONS, Filters, gradeDist, heat,
  previous, SEMS, summarize, TERMS, themes, THRESH, trend, YEARS, YLS,
} from "@/lib/data";

/* Colors are CSS variables so charts follow light/dark mode. */
const C = { ink: "var(--ink)", blue: "var(--blue)", teal: "var(--teal)", amber: "var(--amber)", red: "var(--red)", green: "var(--green)", violet: "var(--violet)", grid: "var(--grid)", mute: "var(--mute)" };
const ECOL = [C.blue, C.violet, C.teal];
const CCOL: Record<string, string> = { CCS: C.blue, CBA: C.amber, CED: C.teal };
const tick = { fontSize: 11, fill: C.mute };
const TT = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow-h)" },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--ink)" },
  cursor: { fill: "var(--soft)", opacity: 0.6 },
};
const DUR = 800;

type Status = "good" | "warn" | "bad";
const badge: Record<Status, string> = { good: "On target", warn: "Watch", bad: "Intervene" };
const STATUS_OPTS: [string, string][] = [["bad", "Intervene"], ["warn", "Watch"], ["good", "On target"]];
const idx = (n: number) => ({ ["--i" as string]: n }) as React.CSSProperties;
const jdx = (n: number) => ({ ["--j" as string]: n }) as React.CSSProperties;
// Recharts passes the clicked datum differently per chart type; read the course code defensively.
const codeOf = (e: unknown) => ((e as { payload?: { code?: string }; code?: string })?.payload?.code ?? (e as { code?: string })?.code) as string | undefined;

function useCountUp(target: number, decimals: number, dur = 800) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const f0 = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const cur = f0 + (target - f0) * (1 - Math.pow(1 - p, 3));
      from.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v.toFixed(decimals);
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
  menu: "M4 6h16M4 12h16M4 18h16",
  left: "M15 18l-6-6 6-6",
  sun: "M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
};

/* EduPulse logo mark: a heartbeat line that ends in a rising trend (pulse of the institution). */
function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M4 22h8l4-11 6 20 4-13 2 4h8" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Splash({ onLeave, onDone }: { onLeave: () => void; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const msgs = ["Connecting to Student & Faculty Portal…", "Syncing SETE results…", "Computing KPIs…", "Preparing your dashboard…"];
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 3 + Math.random() * 7)), 90);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (pct < 100) return;
    const a = setTimeout(() => { setLeaving(true); onLeave(); }, 250);
    const b = setTimeout(onDone, 900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="status" aria-label="Loading dashboard">
      <div className="splash-in">
        <div className="splash-logo"><Logo size={46} /></div>
        <h1>EduPulse</h1>
        <div className="bars-anim"><i /><i /><i /><i /><i /></div>
        <p>{msgs[Math.min(3, Math.floor(pct / 26))]}</p>
        <div className="splash-bar"><div style={{ width: `${pct}%` }} /></div>
        <span className="splash-pct">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/* Own state so toggling the theme never re-renders the dashboard; uses the View Transitions API
   (GPU cross-fade) when available instead of animating colors on hundreds of elements. */
function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    let t: "light" | "dark" = "light";
    try {
      const saved = localStorage.getItem("theme");
      t = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch { /* ignore */ }
    document.documentElement.dataset.theme = t;
    setTheme(t);
  }, []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch { /* ignore */ }
      setTheme(next);
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(apply));
    else apply();
  };
  return (
    <button className="icon-btn spin" onClick={toggle} title="Toggle light/dark mode" aria-label="Toggle theme">
      <span key={theme} style={{ display: "grid", animation: "pop .45s cubic-bezier(.2,1.4,.4,1)" }}><Icon d={theme === "light" ? I.moon : I.sun} /></span>
    </button>
  );
}

type Opt = string | [string, string];
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly Opt[] }) {
  return (
    <label className="sel">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="All">All</option>
        {options.map((o) => { const [v, l] = typeof o === "string" ? [o, o] : o; return <option key={v} value={v}>{l}</option>; })}
      </select>
    </label>
  );
}

function Kpi({ i, title, value, unit, target, status, delta, good, note, icon }: {
  i: number; title: string; value: number; unit: string; target: string; status: Status; delta: number | null; good: "up" | "down"; note: string; icon: string;
}) {
  const dec = unit === "/5" ? 2 : 1;
  const shown = useCountUp(value, dec);
  const improved = delta === null ? null : good === "up" ? delta >= 0 : delta <= 0;
  return (
    <div className={`kpi ${status}`} style={idx(i)}>
      <div className="kpi-top"><span><i>{icon}</i>{title}</span><em>{badge[status]}</em></div>
      <div className="kpi-val"><span key={value}>{shown}</span><small>{unit}</small></div>
      <div className="kpi-foot">
        <span>Target {target}</span>
        {delta !== null && <b className={improved ? "up" : "dn"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(dec)} vs prev</b>}
      </div>
      <div className="kpi-note">{note}</div>
    </div>
  );
}

function Stat({ i, icon, label, value, decimals = 0, suffix = "" }: { i: number; icon: string; label: string; value: number; decimals?: number; suffix?: string }) {
  const shown = useCountUp(value, decimals);
  return (
    <div className="stat" style={idx(i)}>
      <i>{icon}</i>
      <div><b>{decimals === 0 ? Number(shown).toLocaleString() : shown}{suffix}</b><span>{label}</span></div>
    </div>
  );
}

function Card({ i, title, sub, cls = "c4", right, children }: { i: number; title: string; sub?: string; cls?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`card ${cls}`} style={idx(i)}>
      <div className="card-h"><h2>{title}{sub && <span>{sub}</span>}</h2>{right}</div>
      {children}
    </div>
  );
}

const heatBg = (p: number) => (p < 80 ? "rgba(220,38,38,.55)" : p < 85 ? "rgba(217,119,6,.5)" : `rgba(22,163,74,${0.2 + 0.5 * Math.min(1, (p - 85) / 10)})`);
type SortKey = "code" | "dept" | "yl" | "enrolled" | "pass" | "sete" | "response";

export default function Dashboard() {
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");
  const [collapsed, setCollapsed] = useState(false);
  const [f, setF] = useState<Filters>(ALL);
  const [status, setStatus] = useState("All");
  const [reliable, setReliable] = useState(false);
  const [metric, setMetric] = useState("overall");
  const [trendKind, setTrendKind] = useState<"sete" | "pass" | "atRisk">("sete");
  const [pick, setPick] = useState<string | null>(null);
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "pass", asc: true });
  const [q, setQ] = useState("");

  // sidebar persistence
  useEffect(() => {
    try {
      const sd = localStorage.getItem("sidebar");
      setCollapsed(window.innerWidth <= 900 ? true : sd === "closed");
    } catch { /* ignore */ }
  }, []);
  const toggleSide = () => setCollapsed((c) => { try { localStorage.setItem("sidebar", c ? "open" : "closed"); } catch { /* ignore */ } return !c; });

  const set = (patch: Partial<Filters>) => setF((p) => {
    const n = { ...p, ...patch };
    if (patch.college !== undefined && n.dept !== "All" && collegeOf(n.dept) !== n.college && n.college !== "All") n.dept = "All";
    return n;
  });

  const s = useMemo(() => summarize(f), [f]);
  const prev = useMemo(() => previous(f), [f]);
  const tr = useMemo(() => trend(f), [f]);
  const csAll = useMemo(() => courses(f), [f]);
  const cmp = useMemo(() => compare(f), [f]);
  const hm = useMemo(() => heat(f), [f]);
  const yl = useMemo(() => byYearLevel(f), [f]);
  const thm = useMemo(() => themes(f), [f]);
  const grades = useMemo(() => gradeDist(s.pass), [s.pass]);

  const courseStatus = (c: CourseAgg): Status => (c.pass < 80 ? "bad" : c.pass < THRESH.pass || (c.sete < THRESH.sete && c.response >= THRESH.response) ? "warn" : "good");
  const cs = useMemo(() => csAll.filter((c) => (status === "All" || courseStatus(c) === status) && (!reliable || c.response >= THRESH.response)), [csAll, status, reliable]);
  const lowest = useMemo(() => [...cs].sort((a, b) => a.pass - b.pass).slice(0, 8), [cs]);
  const dimData = DIMENSIONS.map((d) => ({ dim: d, score: s.dims[d] }));
  const d = (k: "pass" | "atRisk" | "sete" | "response" | "fill") => (prev ? s[k] - prev[k] : null);
  const st = (v: number, ok: number, bad: number, higher = true): Status =>
    higher ? (v >= ok ? "good" : v >= bad ? "warn" : "bad") : (v <= ok ? "good" : v <= bad ? "warn" : "bad");

  const alerts = useMemo(() => {
    const a: { level: "bad" | "warn" | "info"; text: string }[] = [];
    if (s.pass < THRESH.pass) a.push({ level: s.pass < 80 ? "bad" : "warn", text: `Overall pass rate ${s.pass}% is below the ${THRESH.pass}% threshold.` });
    if (s.atRisk > THRESH.atRisk) a.push({ level: "bad", text: `${s.atRisk}% of students are at risk (> ${THRESH.atRisk}%). Activate advising/tutoring.` });
    if (s.response < THRESH.response) a.push({ level: "info", text: `SETE response rate ${s.response}% is under ${THRESH.response}% — interpret scores with caution.` });
    [...csAll].sort((x, y) => x.pass - y.pass).forEach((c) => {
      if (c.pass < 80) a.push({ level: "bad", text: `${c.code} ${c.title} (${c.dept}): pass rate ${c.pass}% — review course delivery & assessment.` });
      if (c.sete < THRESH.sete && c.response >= THRESH.response) a.push({ level: "warn", text: `${c.code}: SETE ${c.sete}/5 with ${c.response}% response — offer faculty development support.` });
      else if (c.sete < THRESH.sete) a.push({ level: "info", text: `${c.code}: low SETE ${c.sete}/5 but only ${c.response}% responded — not conclusive.` });
    });
    const o = { bad: 0, warn: 1, info: 2 };
    return a.sort((x, y) => o[x.level] - o[y.level]);
  }, [s, csAll]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cs.filter((c) => !t || c.code.toLowerCase().includes(t) || c.title.toLowerCase().includes(t) || c.dept.toLowerCase().includes(t)).sort((a, b) => {
      const x = a[sort.k], y = b[sort.k];
      const r = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.asc ? r : -r;
    });
  }, [cs, sort, q]);
  const th = (k: SortKey, label: string) => (
    <th onClick={() => setSort((p) => ({ k, asc: p.k === k ? !p.asc : true }))} className="sortable">{label} {sort.k === k ? (sort.asc ? "▲" : "▼") : ""}</th>
  );

  const sel = cs.find((c) => c.code === pick) ?? csAll.find((c) => c.code === pick);
  const scope = `${f.ay === "All" ? "All years" : f.ay} · ${f.sem === "All" ? "All semesters" : f.sem} · ${f.dept !== "All" ? f.dept : f.college !== "All" ? f.college : "All colleges"}${f.yl !== "All" ? " · " + f.yl : ""}`;
  const chips: [string, string, () => void][] = [];
  if (f.ay !== "All") chips.push(["Year", f.ay, () => set({ ay: "All" })]);
  if (f.sem !== "All") chips.push(["Semester", f.sem, () => set({ sem: "All" })]);
  if (f.college !== "All") chips.push(["College", f.college, () => set({ college: "All" })]);
  if (f.dept !== "All") chips.push(["Dept", f.dept, () => set({ dept: "All" })]);
  if (f.yl !== "All") chips.push(["Level", f.yl, () => set({ yl: "All" })]);
  if (status !== "All") chips.push(["Status", badge[status as Status], () => setStatus("All")]);
  if (reliable) chips.push(["SETE", "response ≥ 60%", () => setReliable(false)]);
  const reset = () => { setF(ALL); setStatus("All"); setReliable(false); setPick(null); setQ(""); };

  const worstCourse = [...csAll].sort((a, b) => a.pass - b.pass)[0];
  const weakDim = [...dimData].sort((a, b) => a.score - b.score)[0];
  const lowSete = csAll.filter((c) => c.sete < THRESH.sete && c.response >= THRESH.response);
  const lowYl = [...yl].sort((a, b) => a.pass - b.pass)[0];
  const actions = [
    s.pass < THRESH.pass && "Schedule a curriculum review meeting for courses under the 85% pass-rate threshold.",
    worstCourse && worstCourse.pass < THRESH.pass && `Review the syllabus, pacing and assessments of ${worstCourse.code} ${worstCourse.title} (${worstCourse.dept}) — lowest pass rate at ${worstCourse.pass}%.`,
    s.atRisk > THRESH.atRisk && "Launch peer-tutoring and early advising for flagged at-risk students.",
    lowYl && lowYl.pass < THRESH.pass && `Add bridging, orientation and academic support for ${lowYl.yl} students (pass rate ${lowYl.pass}%).`,
    s.fill < THRESH.fill && "Review section offerings and class schedules to improve the fill rate; consider merging low-enrollment sections.",
    s.retention < 90 && `Strengthen retention programs (retention is ${s.retention}%): scholarship info, counseling and early-warning follow-ups.`,
    s.response < THRESH.response && "Run a SETE response-rate drive (class reminders, protected evaluation time) so results are reliable.",
    weakDim && weakDim.score < 4 && `Offer faculty training focused on “${weakDim.dim}” — the lowest-rated SETE dimension (${weakDim.score}/5).`,
    lowSete.length > 0 && `Provide supportive faculty development for ${lowSete.map((c) => c.code).slice(0, 3).join(", ")}${lowSete.length > 3 ? ` and ${lowSete.length - 3} more` : ""} (low SETE with reliable response).`,
    `Share the top SETE theme — “${thm[0].theme}” — in a faculty development workshop.`,
    "Pair courses with low SETE with peer mentoring and classroom observation (supportive, not punitive).",
    "Triangulate SETE with grades, peer observation and syllabus review before drawing conclusions about teaching effectiveness.",
    "Re-check these KPIs next term to see whether the interventions worked, and report results to the dean.",
  ].filter(Boolean) as string[];
  const trendCfg = {
    sete: { key: metric, label: metric === "overall" ? "Overall SETE" : metric, dom: [3, 5] as [number, number], color: C.blue },
    pass: { key: "pass", label: "Pass rate %", dom: [70, 100] as [number, number], color: C.teal },
    atRisk: { key: "atRisk", label: "At-risk %", dom: [0, 30] as [number, number], color: C.red },
  }[trendKind];
  const dot = (color: string) => function Dot(p: { cx?: number; cy?: number; payload?: { active: boolean } }) {
    const on = p.payload?.active;
    return <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r={on ? 5.5 : 3.5} fill={on ? color : "var(--card)"} stroke={color} strokeWidth={2} />;
  };

  let n = 0;
  const nx = () => n++;
  const noCourses = <div className="empty">No courses match the current filters.</div>;

  return (
    <>
      {phase !== "done" && <Splash onLeave={() => setPhase("leaving")} onDone={() => setPhase("done")} />}

      {phase !== "loading" && (
        <div className={`shell ${collapsed ? "collapsed" : ""}`}>
          <div className="backdrop" onClick={toggleSide} />
          <div className="side-wrap">
            <aside className="side" aria-hidden={collapsed}>
              <div className="side-top">
                <div className="brand">
                  <div className="logo"><Logo size={24} /></div>
                  <div><h1>EduPulse</h1><p>Program Chair view</p></div>
                </div>
              </div>

              <div className="side-sec">
                <h3>Filters</h3>
                <Select label="Academic Year" value={f.ay} onChange={(v) => set({ ay: v })} options={YEARS} />
                <Select label="Semester" value={f.sem} onChange={(v) => set({ sem: v })} options={SEMS} />
                <Select label="College" value={f.college} onChange={(v) => set({ college: v })} options={COLLEGES.map((c): Opt => [c.code, `${c.code} — ${c.name}`])} />
                <Select label="Department" value={f.dept} onChange={(v) => set({ dept: v })} options={deptsIn(f.college)} />
                <Select label="Year Level" value={f.yl} onChange={(v) => set({ yl: v })} options={YLS} />
                <Select label="Course Status" value={status} onChange={setStatus} options={STATUS_OPTS} />
                <label className="switch">
                  <span>Reliable SETE only<br /><small style={{ color: "var(--faint)" }}>response ≥ 60%</small></span>
                  <input type="checkbox" checked={reliable} onChange={(e) => setReliable(e.target.checked)} /><i />
                </label>
                <button className="reset" onClick={reset}>↺ Reset all filters</button>
              </div>

              <div className="side-sec">
                <h3>Warning thresholds</h3>
                <ul className="thr">
                  <li><b>Pass rate</b> &lt; {THRESH.pass}%</li>
                  <li><b>At-risk</b> &gt; {THRESH.atRisk}%</li>
                  <li><b>SETE score</b> &lt; {THRESH.sete}</li>
                  <li><b>Response rate</b> &lt; {THRESH.response}%</li>
                </ul>
              </div>
              <div className="side-sec">
                <h3>Data sources</h3>
                <ul className="thr">
                  <li>🎓 Student &amp; Faculty Portal</li>
                  <li>📝 SETE results</li>
                  <li className="dim">Integration is a proposed enhancement.</li>
                </ul>
              </div>
              <div className="side-sec lock">
                <h3>🔒 Privacy</h3>
                <p>Aggregated data only. No student names or individual faculty ratings. Role-based access in production.</p>
              </div>
            </aside>
          </div>

          <main className="main">
            <header className="top">
              <div className="top-l">
                <button className="icon-btn" onClick={toggleSide} title="Toggle sidebar" aria-label="Toggle sidebar"><Icon d={I.menu} /></button>
                <div>
                  <h1>Academic &amp; Teaching Effectiveness Overview</h1>
                  <p>{scope}</p>
                </div>
              </div>
              <div className="top-r">
                <div className="pill">{alerts.filter((a) => a.level !== "info").length} active alerts</div>
                <ThemeToggle />
              </div>
            </header>

            {chips.length > 0 && (
              <div className="chips">
                {chips.map(([k, v, rm]) => <span className="chip" key={k}><b>{k}:</b> {v}<button onClick={rm} aria-label={`Clear ${k}`}>×</button></span>)}
              </div>
            )}

            <section className="kpis">
              <Kpi i={0} icon="✅" title="Pass Rate" value={s.pass} unit="%" target="≥ 85%" status={st(s.pass, 85, 80)} delta={d("pass")} good="up" note="Portal · grades" />
              <Kpi i={1} icon="⚠️" title="At-Risk Students" value={s.atRisk} unit="%" target="≤ 15%" status={st(s.atRisk, 15, 20, false)} delta={d("atRisk")} good="down" note="Portal · failing / low grades" />
              <Kpi i={2} icon="🏫" title="Class Fill Rate" value={s.fill} unit="%" target="≥ 80%" status={st(s.fill, 80, 70)} delta={d("fill")} good="up" note="Portal · enrollment vs capacity" />
              <Kpi i={3} icon="⭐" title="Avg SETE Score" value={s.sete} unit="/5" target="≥ 4.0" status={st(s.sete, 4.0, 3.5)} delta={d("sete")} good="up" note="SETE · weighted by enrollment" />
              <Kpi i={4} icon="📊" title="SETE Response Rate" value={s.response} unit="%" target="≥ 60%" status={st(s.response, 60, 50)} delta={d("response")} good="up" note="SETE · reliability indicator" />
            </section>

            <div className="stage">
              <section className="stats">
                <Stat i={0} icon="🎓" label="Students enrolled" value={s.enrolled} />
                <Stat i={1} icon="👩‍🏫" label="Faculty members" value={s.faculty} />
                <Stat i={2} icon="📚" label="Courses monitored" value={s.nCourses} />
                <Stat i={3} icon="🏛️" label="Departments in scope" value={f.dept !== "All" ? 1 : deptsIn(f.college).length} />
                <Stat i={4} icon="🔁" label="Retention rate" value={s.retention} decimals={1} suffix="%" />
                <Stat i={5} icon="🎯" label="Avg GWA (lower = better)" value={s.gwa} decimals={2} />
              </section>

              <section className="grid">
                <Card i={nx()} cls="c8" title="Trend Across Semesters" sub={f.dept !== "All" ? f.dept : f.college !== "All" ? f.college : "all colleges"}
                  right={
                    <div className="ctrl">
                      <div className="seg">
                        {([["sete", "SETE"], ["pass", "Pass"], ["atRisk", "At-risk"]] as const).map(([k, l]) => (
                          <button key={k} className={trendKind === k ? "on" : ""} onClick={() => setTrendKind(k)}>{l}</button>
                        ))}
                      </div>
                      {trendKind === "sete" && (
                        <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="SETE dimension">
                          <option value="overall">Overall</option>
                          {DIMENSIONS.map((x) => <option key={x}>{x}</option>)}
                        </select>
                      )}
                    </div>}>
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <LineChart data={tr} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="term" tick={tick} />
                        <YAxis domain={trendCfg.dom} tick={tick} />
                        <Tooltip {...TT} />
                        {trendKind === "sete" && <ReferenceLine y={4} stroke={C.green} strokeDasharray="4 4" label={{ value: "Target 4.0", fontSize: 10, fill: C.green, position: "insideTopRight" }} />}
                        {trendKind === "sete" && <ReferenceLine y={THRESH.sete} stroke={C.red} strokeDasharray="4 4" label={{ value: "Warning 3.5", fontSize: 10, fill: C.red, position: "insideBottomRight" }} />}
                        {trendKind === "pass" && <ReferenceLine y={THRESH.pass} stroke={C.red} strokeDasharray="4 4" label={{ value: "Threshold 85%", fontSize: 10, fill: C.red, position: "insideBottomRight" }} />}
                        {trendKind === "atRisk" && <ReferenceLine y={THRESH.atRisk} stroke={C.red} strokeDasharray="4 4" label={{ value: "Threshold 15%", fontSize: 10, fill: C.red, position: "insideTopRight" }} />}
                        <Line type="monotone" dataKey={trendCfg.key} name={trendCfg.label} stroke={trendCfg.color} strokeWidth={2.5} dot={dot(trendCfg.color)} animationDuration={DUR} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="detail">Filled dots = terms included in the current Year / Semester filter.</div>
                </Card>

                <Card i={nx()} cls="c4 alerts" title="Alerts & Concerns" right={<span className="count">{alerts.length}</span>}>
                  <ul className="scroll">
                    {alerts.length === 0 && <li className="info">No threshold breaches for this selection.</li>}
                    {alerts.map((a, j) => <li key={j} className={a.level} style={jdx(Math.min(j, 12))}>{a.text}</li>)}
                  </ul>
                </Card>

                <Card i={nx()} title="SETE by Evaluation Dimension">
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <BarChart data={dimData} layout="vertical" margin={{ top: 4, right: 18, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke={C.grid} horizontal={false} />
                        <XAxis type="number" domain={[3, 5]} tick={tick} />
                        <YAxis type="category" dataKey="dim" width={110} tick={{ fontSize: 10.5, fill: C.ink }} />
                        <Tooltip {...TT} />
                        <ReferenceLine x={4} stroke={C.green} strokeDasharray="4 4" />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]} animationDuration={DUR}>
                          {dimData.map((x) => <Cell key={x.dim} fill={x.score >= 4 ? C.teal : x.score >= 3.5 ? C.amber : C.red} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card i={nx()} title="Lowest Pass-Rate Courses" sub="click a bar">
                  {lowest.length === 0 ? noCourses : (
                    <>
                      <div className="chart">
                        <ResponsiveContainer debounce={150}>
                          <BarChart data={lowest} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke={C.grid} vertical={false} />
                            <XAxis dataKey="code" tick={{ fontSize: 9.5, fill: C.mute }} interval={0} angle={-35} textAnchor="end" height={44} />
                            <YAxis domain={[50, 100]} tick={tick} />
                            <Tooltip {...TT} />
                            <ReferenceLine y={THRESH.pass} stroke={C.red} strokeDasharray="4 4" />
                            <Bar dataKey="pass" name="Pass %" radius={[4, 4, 0, 0]} cursor="pointer" animationDuration={DUR} onClick={(e) => setPick(codeOf(e) ?? null)}>
                              {lowest.map((x) => <Cell key={x.code} fill={x.code === pick ? C.ink : x.pass >= THRESH.pass ? C.blue : x.pass >= 80 ? C.amber : C.red} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="detail">
                        {sel ? <><b>{sel.code} · {sel.title}</b> ({sel.dept}) — {sel.enrolled} enrolled, pass {sel.pass}%, SETE {sel.sete}/5 ({sel.response}% responded){sel.response < THRESH.response && " ⚠ low response"}</> : "Select a course bar or table row to see its details."}
                      </div>
                    </>
                  )}
                </Card>

                <Card i={nx()} title={f.college === "All" ? "College Comparison" : `${f.college} Departments`} sub="vs each other">
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <RadarChart data={[
                        { m: "Pass", ...Object.fromEntries(cmp.map((c) => [c.id, c.pass])) },
                        { m: "Fill", ...Object.fromEntries(cmp.map((c) => [c.id, c.fill])) },
                        { m: "SETE", ...Object.fromEntries(cmp.map((c) => [c.id, c.sete * 20])) },
                        { m: "Response", ...Object.fromEntries(cmp.map((c) => [c.id, c.response])) },
                        { m: "Low risk", ...Object.fromEntries(cmp.map((c) => [c.id, 100 - c.atRisk])) },
                      ]}>
                        <PolarGrid stroke={C.grid} />
                        <PolarAngleAxis dataKey="m" tick={{ fontSize: 11, fill: C.ink }} />
                        <PolarRadiusAxis domain={[40, 100]} tick={false} axisLine={false} />
                        {cmp.map((x, k) => {
                          const on = f.dept === "All" || f.dept === x.id;
                          return <Radar key={x.id} name={x.id} dataKey={x.id} stroke={ECOL[k % 3]} fill={ECOL[k % 3]} fillOpacity={on ? 0.2 : 0.03} strokeOpacity={on ? 1 : 0.3} animationDuration={DUR} />;
                        })}
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip {...TT} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card i={nx()} cls="c8" title="Pass-Rate Heatmap" sub="click a cell to filter by term">
                  <div className="hm" style={{ gridTemplateColumns: `78px repeat(${TERMS.length},minmax(0,1fr))` }}>
                    <div />
                    {TERMS.map((t) => <div className="hm-h" key={t.label}>{t.label}</div>)}
                    {hm.map((row, r) => (
                      <HeatRow key={row.dept} row={row} r={r} f={f} onPick={(ay, sem) => set({ ay, sem })} />
                    ))}
                  </div>
                  <div className="hm-legend">
                    <span><i style={{ background: "rgba(220,38,38,.55)" }} />Below 80% — intervene</span>
                    <span><i style={{ background: "rgba(217,119,6,.5)" }} />80–85% — watch</span>
                    <span><i style={{ background: "rgba(22,163,74,.5)" }} />85%+ — on target</span>
                  </div>
                </Card>

                <Card i={nx()} title="Performance by Year Level" sub="click a bar">
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <BarChart data={yl} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="yl" tick={tick} />
                        <YAxis domain={[60, 100]} tick={tick} />
                        <Tooltip {...TT} />
                        <ReferenceLine y={THRESH.pass} stroke={C.red} strokeDasharray="4 4" />
                        <Bar dataKey="pass" name="Pass %" radius={[5, 5, 0, 0]} cursor="pointer" animationDuration={DUR} onClick={(e) => { const y = (e as unknown as { payload?: { yl: string } })?.payload?.yl; if (y) set({ yl: f.yl === y ? "All" : y }); }}>
                          {yl.map((x) => <Cell key={x.yl} fill={x.pass >= THRESH.pass ? C.teal : x.pass >= 80 ? C.amber : C.red} fillOpacity={f.yl === "All" || f.yl === x.yl ? 1 : 0.3} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card i={nx()} title="Enrollment Trend" sub="students per term">
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <AreaChart data={tr} margin={{ top: 8, right: 16, left: -6, bottom: 0 }}>
                        <defs><linearGradient id="enr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--blue)" stopOpacity={0.4} /><stop offset="95%" stopColor="var(--blue)" stopOpacity={0.02} /></linearGradient></defs>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="term" tick={tick} />
                        <YAxis tick={tick} domain={["dataMin - 50", "dataMax + 50"]} />
                        <Tooltip {...TT} />
                        <Area type="monotone" dataKey="enrolled" name="Enrolled" stroke={C.blue} strokeWidth={2.5} fill="url(#enr)" animationDuration={DUR} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card i={nx()} title="Grade Distribution" sub="% of students">
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <BarChart data={grades} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="band" tick={{ fontSize: 9.5, fill: C.mute }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={tick} />
                        <Tooltip {...TT} />
                        <Bar dataKey="pct" name="%" radius={[4, 4, 0, 0]} animationDuration={DUR}>
                          {grades.map((g, k) => <Cell key={g.band} fill={[C.teal, C.blue, C.violet, C.amber, C.red][k]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card i={nx()} title="Pass Rate vs SETE" sub="each dot = course">
                  {cs.length === 0 ? noCourses : (
                    <>
                      <div className="chart">
                        <ResponsiveContainer debounce={150}>
                          <ScatterChart margin={{ top: 8, right: 16, left: -10, bottom: 8 }}>
                            <CartesianGrid stroke={C.grid} />
                            <XAxis type="number" dataKey="sete" name="SETE" domain={[3, 5]} tick={tick} />
                            <YAxis type="number" dataKey="pass" name="Pass %" domain={[60, 100]} tick={tick} />
                            <ZAxis type="number" dataKey="enrolled" range={[40, 220]} name="Enrolled" />
                            <Tooltip {...TT} cursor={{ strokeDasharray: "3 3" }} />
                            <ReferenceLine x={THRESH.sete} stroke={C.red} strokeDasharray="4 4" />
                            <ReferenceLine y={THRESH.pass} stroke={C.red} strokeDasharray="4 4" />
                            <Scatter data={cs} cursor="pointer" animationDuration={DUR} onClick={(e) => setPick(codeOf(e) ?? null)}>
                              {cs.map((c) => <Cell key={c.code} fill={CCOL[c.college]} fillOpacity={c.code === pick ? 1 : 0.7} stroke={c.code === pick ? C.ink : "none"} strokeWidth={2} />)}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="detail">
                        {COLLEGES.map((c) => <span key={c.code} style={{ marginRight: 12 }}><span style={{ color: CCOL[c.code] }}>●</span> {c.code}</span>)}
                        · Correlation is not causation.
                      </div>
                    </>
                  )}
                </Card>

                <Card i={nx()} title="SETE Response Rate" sub="reliability check">
                  <div className="chart">
                    <ResponsiveContainer debounce={150}>
                      <BarChart data={cmp} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="id" tick={tick} />
                        <YAxis domain={[0, 100]} tick={tick} />
                        <Tooltip {...TT} />
                        <ReferenceLine y={THRESH.response} stroke={C.red} strokeDasharray="4 4" label={{ value: "Min 60%", fontSize: 10, fill: C.red, position: "insideTopRight" }} />
                        <Bar dataKey="response" name="Response %" radius={[5, 5, 0, 0]} animationDuration={DUR}>
                          {cmp.map((x) => <Cell key={x.id} fill={x.response >= THRESH.response ? C.teal : C.amber} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card i={nx()} title="Recurring Improvement Themes" sub="from SETE comments">
                  <ul className="bars">
                    {thm.map((t) => (
                      <li key={t.theme}>
                        <div><span>{t.theme}</span><b>{t.mentions}</b></div>
                        <div className="track"><div style={{ width: `${(t.mentions / thm[0].mentions) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card i={nx()} cls="c4 reco" title="Recommended Actions">
                  <ol>{actions.map((a, j) => <li key={a} style={jdx(j)}>{a}</li>)}</ol>
                </Card>

                <Card i={nx()} cls="c12" title="Course Monitoring Table" sub={`${rows.length} courses`}
                  right={<input className="search" placeholder="Search course or dept…" value={q} onChange={(e) => setQ(e.target.value)} />}>
                  <div className="tbl-wrap">
                    {rows.length === 0 ? noCourses : (
                      <table>
                        <thead><tr>{th("code", "Course")}{th("dept", "Dept")}{th("yl", "Level")}{th("enrolled", "Enrolled")}{th("pass", "Pass %")}{th("sete", "SETE /5")}{th("response", "Response %")}<th>Status</th></tr></thead>
                        <tbody>
                          {rows.map((c, j) => {
                            const stt = courseStatus(c);
                            return (
                              <tr key={c.code} className={c.code === pick ? "sel-row" : ""} onClick={() => setPick(c.code)} style={jdx(Math.min(j, 30))}>
                                <td><b>{c.code}</b> <span className="mut">{c.title}</span></td>
                                <td>{c.dept}</td><td>{YLS[c.yl - 1]}</td><td>{c.enrolled}</td>
                                <td className={c.pass < THRESH.pass ? "neg" : ""}>{c.pass}</td>
                                <td className={c.sete < THRESH.sete ? "neg" : ""}>{c.sete}</td>
                                <td className={c.response < THRESH.response ? "warnc" : ""}>{c.response}{c.response < THRESH.response && " ⚠"}</td>
                                <td><span className={`tag ${stt}`}>{badge[stt]}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Card>
              </section>
            </div>

            <footer className="foot">
              Simulated data for BAT 405 case study · Thresholds: pass &lt; 85%, at-risk &gt; 15%, SETE &lt; 3.5, response &lt; 60% · SETE is one input among many — never the sole basis for personnel decisions.
            </footer>
          </main>
        </div>
      )}
    </>
  );
}

function HeatRow({ row, r, f, onPick }: { row: ReturnType<typeof heat>[number]; r: number; f: Filters; onPick: (ay: string, sem: string) => void }) {
  return (
    <>
      <div className="hm-l" style={{ fontWeight: f.dept === row.dept ? 700 : 500, color: f.dept === row.dept ? "var(--ink)" : undefined }}>{row.dept}</div>
      {row.cells.map((c, k) => (
        <button key={c.label} className={`hm-cell ${f.ay === c.ay && f.sem === c.sem ? "on" : ""}`} style={{ background: heatBg(c.pass), ...jdx(r * 6 + k) }} onClick={() => onPick(c.ay, c.sem)} title={`${row.dept} · ${c.ay} ${c.sem}`}>
          {c.pass}
        </button>
      ))}
    </>
  );
}
