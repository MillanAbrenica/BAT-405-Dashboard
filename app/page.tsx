"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import {
  ALL, byYearLevel, COLLEGES, collegeOf, compare, courses, CourseAgg, deptsIn, DIMENSIONS, Filters, gradeDist, heat,
  previous, SEMS, summarize, TERMS, themes, THRESH, trend, YEARS, YLS,
} from "@/lib/data";

/* Colors are CSS variables so charts follow light/dark mode. */
const C = {
  ink: "var(--ink)", ink2: "var(--ink-2)", mute: "var(--mute)", sheet: "var(--sheet)", grid: "var(--grid)", axis: "var(--axis)",
  brand: "var(--brand)", brand2: "var(--brand-2)", brand3: "var(--brand-3)",
  bad: "var(--bad)", badInk: "var(--bad-ink)", warn: "var(--warn)", good: "var(--good)", goodInk: "var(--good-ink)",
};
/* Fixed categorical slots: a college (or a department's position in its college) always keeps its color. */
const SLOTS = ["var(--s1)", "var(--s2)", "var(--s3)"];
const CCOL: Record<string, string> = { CCS: SLOTS[0], CBA: SLOTS[1], CED: SLOTS[2] };
const tick = { fontSize: 11.5, fill: C.mute };
const AX = { tick, tickLine: false, axisLine: { stroke: C.axis } };
const AY = { tick, tickLine: false, axisLine: false };
const TT = {
  contentStyle: { background: "var(--sheet)", border: "1px solid var(--rule)", borderRadius: 8, color: "var(--ink)", fontSize: 12.5, padding: "8px 10px", boxShadow: "var(--pop)" },
  labelStyle: { color: "var(--ink)", fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: "var(--ink-2)", padding: 0 },
  cursor: { fill: "var(--sheet-2)" },
  animationDuration: 150,
};
const lineCursor = { stroke: C.axis };
const refLabel = (value: string, fill: string, position: "insideTopRight" | "insideBottomRight") => ({ value, fontSize: 11, fill, position });
const pct = (v: number) => `${v}%`;

type Status = "good" | "warn" | "bad";
const badge: Record<Status, string> = { good: "On target", warn: "Watch", bad: "Intervene" };
const STATUS_OPTS: [string, string][] = [["bad", "Intervene"], ["warn", "Watch"], ["good", "On target"]];
const LEVEL = { bad: "Intervene", warn: "Watch", info: "Note" } as const;
const idx = (n: number) => ({ ["--i" as string]: n }) as React.CSSProperties;
// Recharts passes the clicked datum differently per chart type; read the course code defensively.
const codeOf = (e: unknown) => ((e as { payload?: { code?: string }; code?: string })?.payload?.code ?? (e as { code?: string })?.code) as string | undefined;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useMotionOK() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setOk(!m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return ok;
}

function useCountUp(target: number, decimals: number, dur = 450) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) { from.current = target; setV(target); return; }
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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  menu: "M4 6h16M4 12h16M4 18h16",
  sun: "M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
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
  const msgs = ["Connecting to the Student & Faculty Portal…", "Syncing SETE results…", "Computing indicators…", "Preparing your dashboard…"];
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 4 + Math.random() * 8)), 70);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (pct < 100) return;
    const a = setTimeout(() => { setLeaving(true); onLeave(); }, 150);
    const b = setTimeout(onDone, 500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="status" aria-label="Loading dashboard">
      <div className="splash-in">
        <div className="splash-logo"><Logo size={32} /></div>
        <p className="splash-name">EduPulse</p>
        <div className="splash-bar"><div style={{ transform: `scaleX(${pct / 100})` }} /></div>
        <p className="splash-msg">{msgs[Math.min(3, Math.floor(pct / 26))]}</p>
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
    if (doc.startViewTransition && !reducedMotion()) doc.startViewTransition(() => flushSync(apply));
    else apply();
  };
  return (
    <button className="icon-btn" onClick={toggle} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`} aria-label="Toggle theme">
      <span key={theme} className="icon-swap"><Icon d={theme === "light" ? I.moon : I.sun} /></span>
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

type Scale = { min: number; max: number; warn: number; target: number };
/* Bullet meter: where the value sits against the watch / intervene zones and the target tick. */
function Meter({ value, min, max, warn, target, higher }: Scale & { value: number; higher: boolean }) {
  const p = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="meter" aria-hidden="true">
      {higher ? (
        <><i className="z-bad" style={{ left: 0, width: `${p(warn)}%` }} /><i className="z-warn" style={{ left: `${p(warn)}%`, width: `${p(target) - p(warn)}%` }} /></>
      ) : (
        <><i className="z-warn" style={{ left: `${p(target)}%`, width: `${p(warn) - p(target)}%` }} /><i className="z-bad" style={{ left: `${p(warn)}%`, width: `${100 - p(warn)}%` }} /></>
      )}
      <b style={{ transform: `scaleX(${p(value) / 100})` }} />
      <em style={{ left: `${p(target)}%` }} />
    </div>
  );
}

function Kpi({ i, title, value, unit, target, status, delta, good, note, scale }: {
  i: number; title: string; value: number; unit: string; target: string; status: Status; delta: number | null; good: "up" | "down"; note: string; scale: Scale;
}) {
  const dec = unit === "/5" ? 2 : 1;
  const shown = useCountUp(value, dec);
  const improved = delta === null ? null : good === "up" ? delta >= 0 : delta <= 0;
  return (
    <div className={`kpi ${status}`} style={idx(i)}>
      <h3>{title}</h3>
      <div className="kpi-v"><span>{shown}<small>{unit}</small></span><span className="flag">{badge[status]}</span></div>
      <Meter value={value} {...scale} higher={good === "up"} />
      <div className="kpi-f">
        <span>Target {target}</span>
        {delta !== null && <b className={improved ? "up" : "dn"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(dec)} <span>vs previous</span></b>}
      </div>
      <p className="kpi-n">{note}</p>
    </div>
  );
}

function Fact({ label, value, decimals = 0, suffix = "" }: { label: string; value: number; decimals?: number; suffix?: string }) {
  const shown = useCountUp(value, decimals);
  return <div className="fact"><b>{decimals === 0 ? Number(shown).toLocaleString() : shown}{suffix}</b><span>{label}</span></div>;
}

function Card({ i, title, sub, cls = "c4", right, children }: { i: number; title: string; sub?: string; cls?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`card ${cls}`} style={idx(i)}>
      <header className="card-h"><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{right}</header>
      {children}
    </section>
  );
}

/* Lollipop marks for axes that don't start at zero: a bar's length would exaggerate the gaps, a dot doesn't.
   Each mark gets a transparent hit area the size of its whole band so it's easy to click. */
type ShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string };
function LolliH({ x = 0, y = 0, width = 0, height = 0, fill }: ShapeProps) {
  const cy = y + height / 2, end = x + Math.max(0, width);
  return (
    <g>
      <rect x={x} y={y} width={Math.max(0, width) + 10} height={height} fill="transparent" />
      <line x1={x} x2={end} y1={cy} y2={cy} stroke={fill} strokeWidth={2} strokeLinecap="round" />
      <circle cx={end} cy={cy} r={5.5} fill={fill} stroke="var(--sheet)" strokeWidth={2} />
    </g>
  );
}
function LolliV({ x = 0, y = 0, width = 0, height = 0, fill }: ShapeProps) {
  const cx = x + width / 2, base = y + Math.max(0, height);
  return (
    <g>
      <rect x={x} y={y - 10} width={width} height={Math.max(0, height) + 10} fill="transparent" />
      <line x1={cx} x2={cx} y1={base} y2={y} stroke={fill} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={y} r={6} fill={fill} stroke="var(--sheet)" strokeWidth={2} />
    </g>
  );
}
const lolliH = (p: unknown) => <LolliH {...(p as ShapeProps)} />;
const lolliV = (p: unknown) => <LolliV {...(p as ShapeProps)} />;

function CourseTip({ active, payload }: { active?: boolean; payload?: { payload: CourseAgg }[] }) {
  const c = active ? payload?.[0]?.payload : undefined;
  if (!c) return null;
  return <div className="tip"><b>{c.code} {c.title}</b><span>Pass rate {c.pass}%, SETE {c.sete}/5, {c.enrolled} enrolled</span></div>;
}

const heatBg = (p: number) => (p < 80
  ? "color-mix(in srgb, var(--bad) 26%, var(--sheet))"
  : p < 85 ? "color-mix(in srgb, var(--warn) 26%, var(--sheet))"
  : `color-mix(in srgb, var(--brand) ${6 + Math.round(24 * Math.min(1, (p - 85) / 10))}%, var(--sheet))`);
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
  const motionOK = useMotionOK();
  const A = { isAnimationActive: motionOK, animationDuration: 450, animationEasing: "ease-out" as const };

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
    if (s.pass < THRESH.pass) a.push({ level: s.pass < 80 ? "bad" : "warn", text: `Overall pass rate is ${s.pass}%, below the ${THRESH.pass}% threshold.` });
    if (s.atRisk > THRESH.atRisk) a.push({ level: "bad", text: `${s.atRisk}% of students are at risk (limit ${THRESH.atRisk}%). Start advising and tutoring.` });
    if (s.response < THRESH.response) a.push({ level: "info", text: `Only ${s.response}% of students answered the SETE (minimum ${THRESH.response}%). Read the scores with caution.` });
    [...csAll].sort((x, y) => x.pass - y.pass).forEach((c) => {
      if (c.pass < 80) a.push({ level: "bad", text: `${c.code} ${c.title} (${c.dept}) has a ${c.pass}% pass rate. Review course delivery and assessment.` });
      if (c.sete < THRESH.sete && c.response >= THRESH.response) a.push({ level: "warn", text: `${c.code} ${c.title} scored ${c.sete}/5 on SETE with ${c.response}% response. Offer faculty development support.` });
      else if (c.sete < THRESH.sete) a.push({ level: "info", text: `${c.code} ${c.title} scored ${c.sete}/5 on SETE, but only ${c.response}% responded, so the result isn't conclusive.` });
    });
    const o = { bad: 0, warn: 1, info: 2 };
    return a.sort((x, y) => o[x.level] - o[y.level]);
  }, [s, csAll]);
  const nAlerts = alerts.filter((a) => a.level !== "info").length;

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cs.filter((c) => !t || c.code.toLowerCase().includes(t) || c.title.toLowerCase().includes(t) || c.dept.toLowerCase().includes(t)).sort((a, b) => {
      const x = a[sort.k], y = b[sort.k];
      const r = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.asc ? r : -r;
    });
  }, [cs, sort, q]);
  const th = (k: SortKey, label: string, num = false) => (
    <th className={num ? "num" : undefined} aria-sort={sort.k === k ? (sort.asc ? "ascending" : "descending") : undefined}>
      <button onClick={() => setSort((p) => ({ k, asc: p.k === k ? !p.asc : true }))}>
        {label}{sort.k === k && <small aria-hidden="true">{sort.asc ? "▲" : "▼"}</small>}
      </button>
    </th>
  );

  const sel = cs.find((c) => c.code === pick) ?? csAll.find((c) => c.code === pick);
  const scopeParts = [
    f.ay === "All" ? "all years" : f.ay,
    f.sem === "All" ? "all semesters" : f.sem,
    f.dept !== "All" ? f.dept : f.college !== "All" ? f.college : "all colleges",
    ...(f.yl !== "All" ? [f.yl] : []),
  ];
  const scope = `Showing ${scopeParts.join(", ")}`;
  const chips: [string, string, () => void][] = [];
  if (f.ay !== "All") chips.push(["Year", f.ay, () => set({ ay: "All" })]);
  if (f.sem !== "All") chips.push(["Semester", f.sem, () => set({ sem: "All" })]);
  if (f.college !== "All") chips.push(["College", f.college, () => set({ college: "All" })]);
  if (f.dept !== "All") chips.push(["Department", f.dept, () => set({ dept: "All" })]);
  if (f.yl !== "All") chips.push(["Level", f.yl, () => set({ yl: "All" })]);
  if (status !== "All") chips.push(["Status", badge[status as Status], () => setStatus("All")]);
  if (reliable) chips.push(["SETE", "response 60% or higher", () => setReliable(false)]);
  const reset = () => { setF(ALL); setStatus("All"); setReliable(false); setPick(null); setQ(""); };

  const worstCourse = [...csAll].sort((a, b) => a.pass - b.pass)[0];
  const weakDim = [...dimData].sort((a, b) => a.score - b.score)[0];
  const lowSete = csAll.filter((c) => c.sete < THRESH.sete && c.response >= THRESH.response);
  const lowYl = [...yl].sort((a, b) => a.pass - b.pass)[0];
  const actions = [
    s.pass < THRESH.pass && "Schedule a curriculum review meeting for courses under the 85% pass-rate threshold.",
    worstCourse && worstCourse.pass < THRESH.pass && `Review the syllabus, pacing and assessments of ${worstCourse.code} ${worstCourse.title} (${worstCourse.dept}), which has the lowest pass rate at ${worstCourse.pass}%.`,
    s.atRisk > THRESH.atRisk && "Launch peer tutoring and early advising for students flagged as at risk.",
    lowYl && lowYl.pass < THRESH.pass && `Add bridging, orientation and academic support for ${lowYl.yl} students (pass rate ${lowYl.pass}%).`,
    s.fill < THRESH.fill && "Review section offerings and class schedules to improve the fill rate; consider merging low-enrollment sections.",
    s.retention < 90 && `Strengthen retention programs (retention is ${s.retention}%): scholarship information, counseling and early-warning follow-ups.`,
    s.response < THRESH.response && "Run a SETE response drive (class reminders, protected evaluation time) so results are reliable.",
    weakDim && weakDim.score < 4 && `Offer faculty training on “${weakDim.dim}”, the lowest-rated SETE dimension (${weakDim.score}/5).`,
    lowSete.length > 0 && `Provide supportive faculty development for ${lowSete.map((c) => c.code).slice(0, 3).join(", ")}${lowSete.length > 3 ? ` and ${lowSete.length - 3} more` : ""} (low SETE with reliable response).`,
    `Share the top SETE theme, “${thm[0].theme}”, in a faculty development workshop.`,
    "Pair courses with low SETE with peer mentoring and classroom observation (supportive, not punitive).",
    "Triangulate SETE with grades, peer observation and syllabus review before drawing conclusions about teaching effectiveness.",
    "Re-check these indicators next term to see whether the interventions worked, and report the results to the dean.",
  ].filter(Boolean) as string[];
  const trendCfg = {
    sete: { key: metric, label: metric === "overall" ? "Overall SETE" : metric, dom: [3, 5] as [number, number] },
    pass: { key: "pass", label: "Pass rate %", dom: [70, 100] as [number, number] },
    atRisk: { key: "atRisk", label: "At-risk %", dom: [0, 30] as [number, number] },
  }[trendKind];
  const dot = (color: string) => function Dot(p: { cx?: number; cy?: number; payload?: { active: boolean } }) {
    const on = p.payload?.active;
    return <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r={on ? 5 : 3.5} fill={on ? color : "var(--sheet)"} stroke={on ? "var(--sheet)" : color} strokeWidth={on ? 2 : 1.5} />;
  };
  const passFill = (v: number) => (v >= THRESH.pass ? C.brand : v >= 80 ? C.warn : C.bad);
  const scopeName = f.dept !== "All" ? f.dept : f.college !== "All" ? f.college : "All colleges";

  // indices drive the load stagger: KPIs 0–4, facts 5, then panels in reading order
  let n = 6;
  const nx = () => n++;
  const noCourses = <div className="empty">No courses match these filters. Clear a filter to see more.</div>;

  return (
    <>
      {phase !== "done" && <Splash onLeave={() => setPhase("leaving")} onDone={() => setPhase("done")} />}

      {phase !== "loading" && (
        <div className={`shell ${collapsed ? "collapsed" : ""}`}>
          <div className="backdrop" onClick={toggleSide} />
          <div className="side-wrap">
            <aside className="side" aria-hidden={collapsed}>
              <div className="brand">
                <div className="logo"><Logo size={22} /></div>
                <div><p className="brand-name">EduPulse</p><p className="brand-role">Program chair view</p></div>
              </div>

              <div className="side-sec">
                <h2>Filters</h2>
                <Select label="Academic year" value={f.ay} onChange={(v) => set({ ay: v })} options={YEARS} />
                <Select label="Semester" value={f.sem} onChange={(v) => set({ sem: v })} options={SEMS} />
                <Select label="College" value={f.college} onChange={(v) => set({ college: v })} options={COLLEGES.map((c): Opt => [c.code, `${c.name} (${c.code})`])} />
                <Select label="Department" value={f.dept} onChange={(v) => set({ dept: v })} options={deptsIn(f.college)} />
                <Select label="Year level" value={f.yl} onChange={(v) => set({ yl: v })} options={YLS} />
                <Select label="Course status" value={status} onChange={setStatus} options={STATUS_OPTS} />
                <label className="switch">
                  <span>Reliable SETE only<small>Response rate 60% or higher</small></span>
                  <input type="checkbox" checked={reliable} onChange={(e) => setReliable(e.target.checked)} /><i aria-hidden="true" />
                </label>
                <button className="reset" onClick={reset}>Reset all filters</button>
              </div>

              <div className="side-sec">
                <h2>Warning thresholds</h2>
                <dl className="thr">
                  <div><dt>Pass rate</dt><dd>below {THRESH.pass}%</dd></div>
                  <div><dt>At-risk students</dt><dd>above {THRESH.atRisk}%</dd></div>
                  <div><dt>SETE score</dt><dd>below {THRESH.sete}</dd></div>
                  <div><dt>Response rate</dt><dd>below {THRESH.response}%</dd></div>
                </dl>
              </div>
              <div className="side-sec">
                <h2>Data sources</h2>
                <ul className="src">
                  <li>Student &amp; Faculty Portal</li>
                  <li>SETE results</li>
                </ul>
                <p className="dim">Live integration is a proposed enhancement.</p>
              </div>
              <div className="side-sec lock">
                <h2><Icon d={I.lock} />Privacy</h2>
                <p>Aggregated data only. No student names or individual faculty ratings. Role-based access in production.</p>
              </div>
            </aside>
          </div>

          <main className="main">
            <header className="top">
              <button className="icon-btn" onClick={toggleSide} title="Toggle sidebar" aria-label="Toggle sidebar"><Icon d={I.menu} /></button>
              <div className="top-t">
                <h1>Academic &amp; teaching effectiveness</h1>
                <p>{scope}</p>
              </div>
              <div className="top-r">
                <span className={`pill ${nAlerts ? "" : "ok"}`}>{nAlerts ? <><b>{nAlerts}</b> active {nAlerts === 1 ? "alert" : "alerts"}</> : "No active alerts"}</span>
                <ThemeToggle />
              </div>
            </header>

            {chips.length > 0 && (
              <div className="chips">
                {chips.map(([k, v, rm]) => <span className="chip" key={k}><b>{k}</b> {v}<button onClick={rm} aria-label={`Clear ${k}`}>×</button></span>)}
              </div>
            )}

            <section className="report" aria-label="Key indicators">
              <div className="kpis">
                <Kpi i={0} title="Pass rate" value={s.pass} unit="%" target="≥ 85%" status={st(s.pass, 85, 80)} delta={d("pass")} good="up" note="From Portal grades" scale={{ min: 60, max: 100, warn: 80, target: 85 }} />
                <Kpi i={1} title="At-risk students" value={s.atRisk} unit="%" target="≤ 15%" status={st(s.atRisk, 15, 20, false)} delta={d("atRisk")} good="down" note="Failing or low grades in the Portal" scale={{ min: 0, max: 30, warn: 20, target: 15 }} />
                <Kpi i={2} title="Class fill rate" value={s.fill} unit="%" target="≥ 80%" status={st(s.fill, 80, 70)} delta={d("fill")} good="up" note="Enrollment against section capacity" scale={{ min: 50, max: 100, warn: 70, target: 80 }} />
                <Kpi i={3} title="Average SETE score" value={s.sete} unit="/5" target="≥ 4.0" status={st(s.sete, 4.0, 3.5)} delta={d("sete")} good="up" note="Weighted by enrollment" scale={{ min: 3, max: 5, warn: 3.5, target: 4 }} />
                <Kpi i={4} title="SETE response rate" value={s.response} unit="%" target="≥ 60%" status={st(s.response, 60, 50)} delta={d("response")} good="up" note="How far SETE scores can be trusted" scale={{ min: 0, max: 100, warn: 50, target: 60 }} />
              </div>
              <div className="facts" style={idx(5)}>
                <Fact label="students enrolled" value={s.enrolled} />
                <Fact label="faculty members" value={s.faculty} />
                <Fact label={`${s.nCourses === 1 ? "course" : "courses"} monitored`} value={s.nCourses} />
                <Fact label={f.dept !== "All" ? "department in scope" : "departments in scope"} value={f.dept !== "All" ? 1 : deptsIn(f.college).length} />
                <Fact label="retention rate" value={s.retention} decimals={1} suffix="%" />
                <Fact label="average GWA (lower is better)" value={s.gwa} decimals={2} />
              </div>
            </section>

            <div className="grid">
              <Card i={nx()} cls="c8" title="Trend across semesters" sub={scopeName}
                right={
                  <div className="ctrl">
                    <div className="seg" role="group" aria-label="Trend measure">
                      {([["sete", "SETE"], ["pass", "Pass rate"], ["atRisk", "At-risk"]] as const).map(([k, l]) => (
                        <button key={k} className={trendKind === k ? "on" : ""} aria-pressed={trendKind === k} onClick={() => setTrendKind(k)}>{l}</button>
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
                      {/* right padding keeps the last point clear of the target / warning labels */}
                      <XAxis dataKey="term" {...AX} padding={{ left: 8, right: 64 }} />
                      <YAxis domain={trendCfg.dom} {...AY} />
                      <Tooltip {...TT} cursor={lineCursor} />
                      {trendKind === "sete" && <ReferenceLine y={4} stroke={C.good} strokeDasharray="4 4" label={refLabel("Target 4.0", C.goodInk, "insideTopRight")} />}
                      {trendKind === "sete" && <ReferenceLine y={THRESH.sete} stroke={C.bad} strokeDasharray="4 4" label={refLabel("Warning 3.5", C.badInk, "insideBottomRight")} />}
                      {trendKind === "pass" && <ReferenceLine y={THRESH.pass} stroke={C.bad} strokeDasharray="4 4" label={refLabel("Threshold 85%", C.badInk, "insideBottomRight")} />}
                      {trendKind === "atRisk" && <ReferenceLine y={THRESH.atRisk} stroke={C.bad} strokeDasharray="4 4" label={refLabel("Threshold 15%", C.badInk, "insideTopRight")} />}
                      <Line type="monotone" dataKey={trendCfg.key} name={trendCfg.label} stroke={C.brand} strokeWidth={2} dot={dot(C.brand)} activeDot={{ r: 5, stroke: "var(--sheet)", strokeWidth: 2 }} {...A} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="note">Filled points are the terms in your year and semester filter.</p>
              </Card>

              <Card i={nx()} cls="c4 wide-md alerts" title="Alerts and concerns" right={<span className="count">{alerts.length}</span>}>
                <div className="list">
                  <ul>
                    {alerts.length === 0 && <li className="info"><b>All clear</b>No threshold breaches for this selection.</li>}
                    {alerts.map((a, j) => <li key={j} className={a.level}><b>{LEVEL[a.level]}</b>{a.text}</li>)}
                  </ul>
                </div>
              </Card>

              <h2 className="sec" style={idx(nx())}>Student outcomes</h2>

              <Card i={nx()} cls="c8" title="Pass rate by department and term" sub="Select a cell to filter to that term">
                <div className="hm" style={{ gridTemplateColumns: `78px repeat(${TERMS.length},minmax(0,1fr))` }}>
                  <div />
                  {TERMS.map((t) => <div className="hm-h" key={t.label}>{t.label}</div>)}
                  {hm.map((row) => (
                    <HeatRow key={row.dept} row={row} f={f} onPick={(ay, sem) => set({ ay, sem })} />
                  ))}
                </div>
                <div className="legend">
                  <span><i style={{ background: heatBg(70) }} />Below 80%, intervene</span>
                  <span><i style={{ background: heatBg(82) }} />80–85%, watch</span>
                  <span><i style={{ background: heatBg(95) }} />85% and above, darker is higher</span>
                </div>
              </Card>

              <Card i={nx()} cls="c4 wide-md" title="Lowest pass-rate courses" sub="Select a course for details">
                {lowest.length === 0 ? noCourses : (
                  <>
                    <div className="chart">
                      <ResponsiveContainer debounce={150}>
                        <BarChart data={lowest} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={C.grid} horizontal={false} />
                          <XAxis type="number" domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} {...AX} tickFormatter={pct} />
                          <YAxis type="category" dataKey="code" width={56} {...AY} tick={{ fontSize: 12, fill: C.ink2 }} />
                          <Tooltip {...TT} content={<CourseTip />} />
                          <ReferenceLine x={THRESH.pass} stroke={C.bad} strokeDasharray="4 4" />
                          <Bar dataKey="pass" name="Pass %" shape={lolliH} cursor="pointer" {...A} onClick={(e) => setPick(codeOf(e) ?? null)}>
                            {lowest.map((x) => <Cell key={x.code} fill={x.code === pick ? C.ink : passFill(x.pass)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="detail">
                      {sel ? <><b>{sel.code} {sel.title}</b> ({sel.dept}): {sel.enrolled} enrolled, pass rate {sel.pass}%, SETE {sel.sete}/5 from {sel.response}% of students{sel.response < THRESH.response && ", low response"}</> : "Select a course in this chart or the table to see its details."}
                    </div>
                  </>
                )}
              </Card>

              <Card i={nx()} title="Pass rate by year level" sub="Select a year level to filter">
                <div className="chart">
                  <ResponsiveContainer debounce={150}>
                    <BarChart data={yl} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="yl" {...AX} />
                      <YAxis domain={[60, 100]} {...AY} tickFormatter={pct} />
                      <Tooltip {...TT} />
                      <ReferenceLine y={THRESH.pass} stroke={C.bad} strokeDasharray="4 4" />
                      <Bar dataKey="pass" name="Pass %" shape={lolliV} cursor="pointer" {...A} onClick={(e) => { const y = (e as unknown as { payload?: { yl: string } })?.payload?.yl; if (y) set({ yl: f.yl === y ? "All" : y }); }}>
                        {yl.map((x) => <Cell key={x.yl} fill={passFill(x.pass)} fillOpacity={f.yl === "All" || f.yl === x.yl ? 1 : 0.3} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card i={nx()} title="Grade distribution" sub="Share of students in each band">
                <div className="chart">
                  <ResponsiveContainer debounce={150}>
                    <BarChart data={grades} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={C.grid} horizontal={false} />
                      <XAxis type="number" {...AX} tickFormatter={pct} />
                      <YAxis type="category" dataKey="band" width={128} {...AY} tick={{ fontSize: 12, fill: C.ink2 }} />
                      <Tooltip {...TT} />
                      <Bar dataKey="pct" name="Students %" radius={[0, 4, 4, 0]} barSize={16} {...A}>
                        {grades.map((g, k) => <Cell key={g.band} fill={[C.brand3, C.brand, C.brand2, C.warn, C.bad][k]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card i={nx()} cls="c4 wide-md" title="Enrollment trend" sub="Students per term">
                <div className="chart">
                  <ResponsiveContainer debounce={150}>
                    <LineChart data={tr} margin={{ top: 8, right: 16, left: -2, bottom: 0 }}>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="term" {...AX} />
                      <YAxis {...AY} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString()} />
                      <Tooltip {...TT} cursor={lineCursor} />
                      <Line type="monotone" dataKey="enrolled" name="Enrolled" stroke={C.brand} strokeWidth={2} dot={{ r: 3, fill: "var(--sheet)", strokeWidth: 1.5 }} activeDot={{ r: 5, stroke: "var(--sheet)", strokeWidth: 2 }} {...A} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <h2 className="sec" style={idx(nx())}>Teaching evaluation (SETE)</h2>

              <Card i={nx()} title="SETE by evaluation dimension" sub="Average score out of 5">
                <div className="chart">
                  <ResponsiveContainer debounce={150}>
                    <BarChart data={dimData} layout="vertical" margin={{ top: 0, right: 18, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={C.grid} horizontal={false} />
                      <XAxis type="number" domain={[3, 5]} {...AX} />
                      <YAxis type="category" dataKey="dim" width={118} {...AY} tick={{ fontSize: 12, fill: C.ink2 }} />
                      <Tooltip {...TT} />
                      <ReferenceLine x={4} stroke={C.good} strokeDasharray="4 4" />
                      <Bar dataKey="score" name="Score" shape={lolliH} {...A}>
                        {dimData.map((x) => <Cell key={x.dim} fill={x.score >= 4 ? C.brand : x.score >= 3.5 ? C.warn : C.bad} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card i={nx()} title="SETE response rate" sub="Under 60% and scores aren't reliable">
                <div className="chart">
                  <ResponsiveContainer debounce={150}>
                    <BarChart data={cmp} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="id" {...AX} />
                      <YAxis domain={[0, 100]} {...AY} tickFormatter={pct} />
                      <Tooltip {...TT} />
                      <ReferenceLine y={THRESH.response} stroke={C.bad} strokeDasharray="4 4" />
                      <Bar dataKey="response" name="Response %" radius={[4, 4, 0, 0]} maxBarSize={44} {...A}>
                        {cmp.map((x) => <Cell key={x.id} fill={x.response >= THRESH.response ? C.brand : C.warn} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card i={nx()} cls="c4 wide-md" title="Recurring improvement themes" sub="Mentions in SETE comments">
                <ul className="bars">
                  {thm.map((t) => (
                    <li key={t.theme}>
                      <div><span>{t.theme}</span><b>{t.mentions}</b></div>
                      <div className="track"><div style={{ transform: `scaleX(${t.mentions / thm[0].mentions})` }} /></div>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card i={nx()} cls="c8" title="Pass rate vs SETE" sub="Each dot is a course, sized by enrollment. Select one for details.">
                {cs.length === 0 ? noCourses : (
                  <>
                    <div className="chart">
                      <ResponsiveContainer debounce={150}>
                        <ScatterChart margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                          <CartesianGrid stroke={C.grid} />
                          <XAxis type="number" dataKey="sete" name="SETE" domain={[3, 5]} {...AX} />
                          <YAxis type="number" dataKey="pass" name="Pass %" domain={[60, 100]} {...AY} tickFormatter={pct} />
                          <ZAxis type="number" dataKey="enrolled" range={[40, 220]} name="Enrolled" />
                          <Tooltip {...TT} cursor={{ stroke: C.axis, strokeDasharray: "3 3" }} content={<CourseTip />} />
                          <ReferenceLine x={THRESH.sete} stroke={C.bad} strokeDasharray="4 4" />
                          <ReferenceLine y={THRESH.pass} stroke={C.bad} strokeDasharray="4 4" />
                          <Scatter data={cs} cursor="pointer" {...A} onClick={(e) => setPick(codeOf(e) ?? null)}>
                            {cs.map((c) => <Cell key={c.code} fill={CCOL[c.college]} fillOpacity={c.code === pick ? 1 : 0.75} stroke={c.code === pick ? C.ink : "var(--sheet)"} strokeWidth={c.code === pick ? 2 : 1.5} />)}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="legend dots">
                      {COLLEGES.map((c) => <span key={c.code}><i style={{ background: CCOL[c.code] }} />{c.name}</span>)}
                      <em>Correlation is not causation.</em>
                    </div>
                  </>
                )}
              </Card>

              <Card i={nx()} cls="c4 wide-md" title={f.college === "All" ? "College comparison" : `${f.college} departments`} sub="Five indicators side by side, SETE scaled to 100">
                <div className="chart">
                  <ResponsiveContainer debounce={150}>
                    <RadarChart outerRadius="72%" data={[
                      { m: "Pass", ...Object.fromEntries(cmp.map((c) => [c.id, c.pass])) },
                      { m: "Fill", ...Object.fromEntries(cmp.map((c) => [c.id, c.fill])) },
                      { m: "SETE", ...Object.fromEntries(cmp.map((c) => [c.id, c.sete * 20])) },
                      { m: "Response", ...Object.fromEntries(cmp.map((c) => [c.id, c.response])) },
                      { m: "Low risk", ...Object.fromEntries(cmp.map((c) => [c.id, 100 - c.atRisk])) },
                    ]}>
                      <PolarGrid stroke={C.grid} />
                      <PolarAngleAxis dataKey="m" tick={{ fontSize: 12, fill: C.ink2 }} />
                      <PolarRadiusAxis domain={[40, 100]} tick={false} axisLine={false} />
                      {cmp.map((x, k) => {
                        const on = f.dept === "All" || f.dept === x.id;
                        const col = CCOL[x.id] ?? SLOTS[k % 3];
                        return <Radar key={x.id} name={x.id} dataKey={x.id} stroke={col} strokeWidth={2} fill={col} fillOpacity={on ? 0.1 : 0.02} strokeOpacity={on ? 1 : 0.3} {...A} />;
                      })}
                      <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span style={{ color: "var(--ink-2)" }}>{v}</span>} />
                      <Tooltip {...TT} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <h2 className="sec" style={idx(nx())}>Courses</h2>

              <Card i={nx()} cls="c12" title="Course monitoring" sub={`${rows.length} ${rows.length === 1 ? "course" : "courses"}`}
                right={<input className="search" type="search" placeholder="Search course or department" aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />}>
                <div className="tbl-wrap">
                  {rows.length === 0 ? noCourses : (
                    <table>
                      <thead><tr>{th("code", "Course")}{th("dept", "Department")}{th("yl", "Year level")}{th("enrolled", "Enrolled", true)}{th("pass", "Pass %", true)}{th("sete", "SETE", true)}{th("response", "Response %", true)}<th>Status</th></tr></thead>
                      <tbody>
                        {rows.map((c) => {
                          const stt = courseStatus(c);
                          const lowResp = c.response < THRESH.response;
                          return (
                            <tr key={c.code} className={c.code === pick ? "sel-row" : ""} tabIndex={0} aria-selected={c.code === pick}
                              onClick={() => setPick(c.code)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPick(c.code); } }}>
                              <td><b>{c.code}</b><span className="mut">{c.title}</span></td>
                              <td>{c.dept}</td><td>{YLS[c.yl - 1]}</td><td className="num">{c.enrolled}</td>
                              <td className={`num ${c.pass < THRESH.pass ? "neg" : ""}`}>{c.pass}</td>
                              <td className={`num ${c.sete < THRESH.sete ? "neg" : ""}`}>{c.sete}</td>
                              <td className={`num ${lowResp ? "warnc" : ""}`} title={lowResp ? "Below 60%: SETE result not reliable" : undefined}>{lowResp && "⚠︎ "}{c.response}</td>
                              <td><span className={`tag ${stt}`}>{badge[stt]}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>

              <h2 className="sec" style={idx(nx())}>Recommended actions</h2>

              <section className="card c12 reco" style={idx(nx())} aria-label="Recommended actions, in priority order">
                <ol>{actions.map((a) => <li key={a}>{a}</li>)}</ol>
              </section>
            </div>

            <footer className="foot">
              Simulated data for the BAT 405 case study. SETE is one input among many and should never be the sole basis for personnel decisions.
            </footer>
          </main>
        </div>
      )}
    </>
  );
}

function HeatRow({ row, f, onPick }: { row: ReturnType<typeof heat>[number]; f: Filters; onPick: (ay: string, sem: string) => void }) {
  return (
    <>
      <div className={`hm-l ${f.dept === row.dept ? "on" : ""}`}>{row.dept}</div>
      {row.cells.map((c) => {
        const on = f.ay === c.ay && f.sem === c.sem;
        return (
          <button key={c.label} className={`hm-cell ${on ? "on" : ""} ${c.pass < 80 ? "lo" : ""}`} style={{ background: heatBg(c.pass) }}
            onClick={() => onPick(c.ay, c.sem)} aria-pressed={on} aria-label={`${row.dept}, ${c.ay} ${c.sem}: ${c.pass}% pass rate`}>
            {c.pass}
          </button>
        );
      })}
    </>
  );
}
