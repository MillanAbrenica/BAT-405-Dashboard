// SIMULATED data for the BAT 405 case study. Replace with real Portal + SETE exports.
export const YEARS = ["2023-2024", "2024-2025", "2025-2026"] as const;
export const SEMS = ["1st Sem", "2nd Sem"] as const;
export const YLS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const DIMENSIONS = [
  "Subject Mastery",
  "Clarity of Instruction",
  "Responsiveness",
  "Assessment Fairness",
  "Class Management",
] as const;
export type Dim = (typeof DIMENSIONS)[number];

export const COLLEGES = [
  { code: "CCS", name: "Computing Studies", depts: ["BSIT", "BSCS", "BSIS"] },
  { code: "CBA", name: "Business & Accountancy", depts: ["BSBA", "BSA", "BSEntrep"] },
  { code: "CED", name: "Education", depts: ["BEEd", "BSEd", "BPEd"] },
] as const;
export const ALL_DEPTS: string[] = COLLEGES.flatMap((c) => [...c.depts]);
export const collegeOf = (dept: string) => COLLEGES.find((c) => (c.depts as readonly string[]).includes(dept))!.code as string;
export const deptsIn = (college: string): string[] => (college === "All" ? ALL_DEPTS : [...COLLEGES.find((c) => c.code === college)!.depts]);

interface DeptDef { pass: number; sete: number; resp: number; size: number; courses: [string, string][] }
const DEFS: Record<string, DeptDef> = {
  BSIT: { pass: 89, sete: 4.2, resp: 74, size: 420, courses: [["IT 101", "Intro to Computing"], ["IT 214", "Web Systems"], ["IT 223", "Networking 1"], ["IT 301", "Systems Admin"], ["IT 312", "Info Assurance"], ["IT 405", "Capstone Project"]] },
  BSCS: { pass: 84, sete: 4.0, resp: 66, size: 310, courses: [["CS 102", "Programming 1"], ["CS 211", "Data Structures"], ["CS 224", "Discrete Math"], ["CS 305", "Algorithms"], ["CS 318", "Machine Learning"], ["CS 410", "Thesis Writing"]] },
  BSIS: { pass: 87, sete: 3.9, resp: 52, size: 260, courses: [["IS 103", "Business Process"], ["IS 215", "Database Systems"], ["IS 227", "Systems Analysis"], ["IS 306", "ERP Systems"], ["IS 314", "IT Governance"], ["IS 407", "IS Capstone"]] },
  BSBA: { pass: 88, sete: 4.1, resp: 70, size: 520, courses: [["BA 101", "Principles of Mgmt"], ["BA 212", "Marketing Mgmt"], ["BA 225", "Business Statistics"], ["BA 304", "Operations Mgmt"], ["BA 318", "Strategic Mgmt"], ["BA 402", "Business Research"]] },
  BSA: { pass: 82, sete: 3.8, resp: 61, size: 380, courses: [["AC 105", "Fundamentals of Acctg"], ["AC 211", "Intermediate Acctg 1"], ["AC 226", "Cost Accounting"], ["AC 308", "Auditing Theory"], ["AC 315", "Taxation"], ["AC 409", "Accounting Seminar"]] },
  BSEntrep: { pass: 90, sete: 4.3, resp: 78, size: 180, courses: [["EN 102", "Intro to Entrepreneurship"], ["EN 213", "Business Planning"], ["EN 221", "Small Business Finance"], ["EN 307", "Venture Creation"], ["EN 316", "Social Entrepreneurship"], ["EN 404", "Practicum"]] },
  BEEd: { pass: 91, sete: 4.4, resp: 72, size: 340, courses: [["ED 101", "Child Development"], ["ED 205", "Teaching Math"], ["ED 218", "Teaching Science"], ["ED 303", "Assessment of Learning"], ["ED 312", "Curriculum Dev"], ["ED 401", "Practice Teaching"]] },
  BSEd: { pass: 90, sete: 4.2, resp: 58, size: 300, courses: [["SE 104", "Foundations of Education"], ["SE 209", "Educational Technology"], ["SE 222", "Facilitating Learning"], ["SE 306", "Classroom Mgmt"], ["SE 311", "Special Needs Educ"], ["SE 408", "Field Study"]] },
  BPEd: { pass: 93, sete: 4.5, resp: 80, size: 150, courses: [["PE 103", "Anatomy"], ["PE 207", "Sports Pedagogy"], ["PE 219", "Kinesiology"], ["PE 302", "Fitness Assessment"], ["PE 313", "Sports Mgmt"], ["PE 405", "Coaching Practicum"]] },
};
const WEAK = new Set(["CS 224", "IS 306", "IT 223", "AC 226", "BA 225", "SE 311"]);
const LOWRESP = new Set(["IS 314", "AC 315", "SE 306"]);

export interface TermRow {
  dept: string; college: string; ay: string; sem: string; yl: number; label: string;
  enrolled: number; faculty: number; pass: number; atRisk: number; fill: number; retention: number; gwa: number;
  sete: number; response: number; dims: Record<Dim, number>;
}
export interface CourseRow {
  dept: string; college: string; ay: string; sem: string; yl: number; code: string; title: string;
  enrolled: number; pass: number; sete: number; response: number;
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export const TERMS: { ay: string; sem: string; label: string }[] = [];
YEARS.forEach((ay) => SEMS.forEach((sem) => TERMS.push({ ay, sem, label: `${ay.slice(2, 4)}-${ay.slice(7)} ${sem === "1st Sem" ? "S1" : "S2"}` })));

export const termRows: TermRow[] = [];
export const courseRows: CourseRow[] = [];
const SHARE = [0.32, 0.26, 0.23, 0.19];
const YL_PASS = [-3, -1.5, 0.5, 2];

ALL_DEPTS.forEach((dept, di) => {
  const b = DEFS[dept];
  const college = collegeOf(dept);
  TERMS.forEach((t, ti) => {
    const R0 = rng(1000 * (di + 1) + ti * 17 + 3);
    const drift = ti * 0.03;
    const termSete = b.sete + drift + (R0() - 0.5) * 0.25 - (dept === "BSIS" && ti === 4 ? 0.3 : 0) - (dept === "BSA" && ti === 3 ? 0.25 : 0);
    const termPass = b.pass + (R0() - 0.5) * 4 + drift * 8 - (dept === "BSCS" && ti === 3 ? 4 : 0) - (dept === "BSA" && ti === 5 ? 3 : 0);
    [1, 2, 3, 4].forEach((yl) => {
      const R = rng(5000 * (di + 1) + ti * 101 + yl * 13);
      const sete = clamp(termSete + (R() - 0.5) * 0.2, 3, 4.9);
      const pass = clamp(termPass + YL_PASS[yl - 1] + (R() - 0.5) * 3, 68, 98);
      const dims = {} as Record<Dim, number>;
      DIMENSIONS.forEach((d, i) => {
        const bias = [0.15, 0, -0.15, -0.05, 0.1][i];
        dims[d] = r2(clamp(sete + bias + (R() - 0.5) * 0.2, 2.8, 5));
      });
      const enrolled = Math.round(b.size * SHARE[yl - 1] * (0.95 + ti * 0.02) + R() * 8);
      termRows.push({
        dept, college, ay: t.ay, sem: t.sem, yl, label: t.label,
        enrolled, faculty: Math.max(3, Math.round(enrolled / 24)),
        pass: r1(pass),
        atRisk: r1(clamp(18 - (pass - 80) * 0.7 + (R() - 0.5) * 4, 3, 30)),
        fill: r1(clamp(86 + (R() - 0.5) * 14 - di * 0.6, 65, 100)),
        retention: r1(clamp(86 + (pass - 80) * 0.45 + (R() - 0.5) * 3, 75, 99)),
        gwa: r2(clamp(2.9 - (pass - 70) * 0.035 + (R() - 0.5) * 0.1, 1.4, 3.2)),
        sete: r2(sete), response: r1(clamp(b.resp + (R() - 0.5) * 12, 30, 92)), dims,
      });
    });
    b.courses.forEach(([code, title], ci) => {
      const C = rng(77 * (di + 1) + ti * 31 + ci * 7);
      const weak = WEAK.has(code) ? -1 : 0;
      const yl = Number(code.split(" ")[1][0]);
      courseRows.push({
        dept, college, ay: t.ay, sem: t.sem, yl, code, title,
        enrolled: Math.round(30 + C() * 60),
        pass: r1(clamp(b.pass + weak * 9 + (C() - 0.5) * 12, 60, 99)),
        sete: r2(clamp(b.sete + weak * 0.45 + (C() - 0.5) * 0.5, 2.8, 4.9)),
        response: r1(clamp(b.resp + (C() - 0.5) * 36 - (LOWRESP.has(code) ? 18 : 0), 20, 95)),
      });
    });
  });
});

const wavg = <T,>(rows: T[], v: (r: T) => number, w: (r: T) => number) => {
  const tw = rows.reduce((s, r) => s + w(r), 0) || 1;
  return rows.reduce((s, r) => s + v(r) * w(r), 0) / tw;
};

export interface Filters { ay: string; sem: string; college: string; dept: string; yl: string }
export const ALL: Filters = { ay: "All", sem: "All", college: "All", dept: "All", yl: "All" };
const match = (f: Filters, r: { ay: string; sem: string; dept: string; college: string; yl: number }) =>
  (f.ay === "All" || r.ay === f.ay) && (f.sem === "All" || r.sem === f.sem) &&
  (f.college === "All" || r.college === f.college) && (f.dept === "All" || r.dept === f.dept) &&
  (f.yl === "All" || YLS[r.yl - 1] === f.yl);

export function summarize(f: Filters) {
  const rows = termRows.filter((r) => match(f, r));
  const nTerms = new Set(rows.map((r) => r.ay + r.sem)).size || 1;
  const w = (r: TermRow) => r.enrolled;
  const dims = {} as Record<Dim, number>;
  DIMENSIONS.forEach((d) => (dims[d] = r2(wavg(rows, (r) => r.dims[d], w))));
  return {
    pass: r1(wavg(rows, (r) => r.pass, w)),
    atRisk: r1(wavg(rows, (r) => r.atRisk, w)),
    fill: r1(wavg(rows, (r) => r.fill, w)),
    sete: r2(wavg(rows, (r) => r.sete, w)),
    response: r1(wavg(rows, (r) => r.response, w)),
    retention: r1(wavg(rows, (r) => r.retention, w)),
    gwa: r2(wavg(rows, (r) => r.gwa, w)),
    enrolled: Math.round(rows.reduce((s, r) => s + r.enrolled, 0) / nTerms),
    faculty: Math.round(rows.reduce((s, r) => s + r.faculty, 0) / nTerms),
    nCourses: new Set(courseRows.filter((r) => match(f, r)).map((r) => r.code)).size,
    dims,
  };
}

// Previous comparable period, for the "vs prev" delta on KPI cards.
export function previous(f: Filters) {
  const idx = f.ay !== "All" && f.sem !== "All" ? TERMS.findIndex((t) => t.ay === f.ay && t.sem === f.sem) : -1;
  if (idx > 0) return summarize({ ...f, ay: TERMS[idx - 1].ay, sem: TERMS[idx - 1].sem });
  if (f.ay !== "All" && f.sem === "All") {
    const i = YEARS.indexOf(f.ay as (typeof YEARS)[number]);
    if (i > 0) return summarize({ ...f, ay: YEARS[i - 1] });
  }
  return null;
}

// Trend ignores the year/semester filter (it shows every term) but marks the selected ones.
export function trend(f: Filters) {
  return TERMS.map((t) => {
    const rows = termRows.filter((r) => r.ay === t.ay && r.sem === t.sem && match({ ...f, ay: "All", sem: "All" }, r));
    const w = (r: TermRow) => r.enrolled;
    const out: Record<string, number | string | boolean> = {
      term: t.label, ay: t.ay, sem: t.sem,
      active: (f.ay === "All" || f.ay === t.ay) && (f.sem === "All" || f.sem === t.sem),
      overall: r2(wavg(rows, (r) => r.sete, w)),
      enrolled: rows.reduce((a, r) => a + r.enrolled, 0),
      pass: r1(wavg(rows, (r) => r.pass, w)),
      atRisk: r1(wavg(rows, (r) => r.atRisk, w)),
      response: r1(wavg(rows, (r) => r.response, w)),
    };
    DIMENSIONS.forEach((d) => (out[d] = r2(wavg(rows, (r) => r.dims[d], w))));
    return out;
  });
}

export function courses(f: Filters) {
  const map = new Map<string, CourseRow[]>();
  courseRows.filter((r) => match(f, r)).forEach((r) => map.set(r.code, [...(map.get(r.code) ?? []), r]));
  return [...map.values()].map((rs) => {
    const w = (r: CourseRow) => r.enrolled;
    return {
      code: rs[0].code, title: rs[0].title, dept: rs[0].dept, college: rs[0].college, yl: rs[0].yl,
      enrolled: rs.reduce((s, r) => s + r.enrolled, 0),
      pass: r1(wavg(rs, (r) => r.pass, w)),
      sete: r2(wavg(rs, (r) => r.sete, w)),
      response: r1(wavg(rs, (r) => r.response, w)),
    };
  });
}
export type CourseAgg = ReturnType<typeof courses>[number];

// Entities to compare: colleges when "All", otherwise the departments of the chosen college.
export function compare(f: Filters) {
  const ents = f.college === "All" ? COLLEGES.map((c) => ({ id: c.code, f: { ...f, college: c.code, dept: "All" } })) : deptsIn(f.college).map((d) => ({ id: d, f: { ...f, dept: d } }));
  return ents.map((e) => ({ id: e.id, ...summarize(e.f) }));
}

export function heat(f: Filters) {
  const depts = deptsIn(f.college);
  return depts.map((d) => ({
    dept: d,
    cells: TERMS.map((t) => ({ ...t, pass: summarize({ ...f, ay: t.ay, sem: t.sem, college: "All", dept: d }).pass })),
  }));
}

export function byYearLevel(f: Filters) {
  return YLS.map((y) => {
    const x = summarize({ ...f, yl: y });
    return { yl: y, pass: x.pass, atRisk: x.atRisk, sete: x.sete };
  });
}

// Approximate grade distribution derived from the pass rate (simulated).
export function gradeDist(pass: number) {
  const fail = 100 - pass;
  const hi = Math.max(0, (pass - 70) * 0.9);
  const mid = Math.max(0, pass - hi - 12);
  return [
    { band: "Excellent (1.0-1.5)", pct: r1(hi * 0.55) },
    { band: "Good (1.75-2.25)", pct: r1(hi * 0.45 + mid * 0.45) },
    { band: "Fair (2.5-3.0)", pct: r1(pass - hi - mid * 0.45) },
    { band: "Incomplete/Dropped", pct: r1(fail * 0.4) },
    { band: "Failed (5.0)", pct: r1(fail * 0.6) },
  ];
}

// Recurring improvement themes (simulated, from aggregated SETE comments), scaled to the selected scope.
const BASE_THEMES: [string, number][] = [
  ["Timely feedback on assessments", 38], ["Pace of lectures too fast", 31], ["Need more hands-on / lab activities", 27],
  ["Clearer grading criteria", 22], ["Consultation availability", 15], ["Updated learning materials", 12],
];
export function themes(f: Filters) {
  const share = summarize(f).enrolled / (summarize(ALL).enrolled || 1);
  const R = rng(f.dept.length * 31 + f.college.length * 7 + f.yl.length + 11);
  return BASE_THEMES.map(([theme, m]) => ({ theme, mentions: Math.max(1, Math.round(m * (0.25 + share * 2.2) * (0.85 + R() * 0.3))) })).sort((a, b) => b.mentions - a.mentions);
}

export const THRESH = { pass: 85, atRisk: 15, sete: 3.5, response: 60, fill: 80 };
