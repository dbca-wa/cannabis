// Check every imported legacy case through the running app (API and pages).
// Run it with run_app_sweep.sh, which starts an unthrottled local backend.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(HERE, "..", "..");
const FRONTEND = join(BACKEND, "..", "frontend");
const { chromium } = createRequire(join(FRONTEND, "package.json"))("playwright");

const ETL = join(BACKEND, "etl");
const OUT = process.env.SWEEP_OUT ?? join(ETL, "data", "modded", "app_sweep");
const APP = process.env.SWEEP_APP ?? "http://127.0.0.1:3000";
const API = process.env.SWEEP_API ?? "http://127.0.0.1:8000/api/v1";
const EMAIL = process.env.SWEEP_EMAIL;
const PASSWORD = process.env.SWEEP_PASSWORD;
const API_WORKERS = 12;
const PAGE_WORKERS = 4;
const PAGE_SAMPLE = 70;
if (!EMAIL || !PASSWORD) throw new Error("set SWEEP_EMAIL and SWEEP_PASSWORD");
mkdirSync(join(OUT, "pages"), { recursive: true });

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const clean = read(join(ETL, "data", "modded", "cannabis_clean.json"));
const expected = read(join(ETL, "data", "modded", "expected.json"));
const explained = new Set(read(join(ETL, "data", "verify", "exceptions.json")).map((e) => `${e.check}|${e.id}`));
const oracle = new Map(expected.certificates.map((c) => [c.cert, c]));
const squash = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const unwrap = (v, k) => {
	if (typeof v !== "string") return v ?? null;
	const s = v.trim();
	if (!s.startsWith("{")) return s || null;
	try {
		const x = JSON.parse(s)[k];
		return typeof x === "string" && x.trim() ? x.trim() : null;
	} catch {
		return s;
	}
};

const byCase = new Map();
for (const r of clean) {
	const key = r.case_key.toLowerCase();
	if (!byCase.has(key)) byCase.set(key, { caseNumber: r.case_key, certs: [] });
	byCase.get(key).certs.push(r);
}

/** Run ``fn`` over ``items`` with ``workers`` in flight at once. */
const pool = async (items, workers, fn) => {
	let next = 0;
	await Promise.all(
		Array.from({ length: workers }, async (_, worker) => {
			while (next < items.length) {
				const i = next++;
				await fn(items[i], i, worker);
			}
		})
	);
};

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const throttled = [];
const consoleErrors = [];
ctx.on("response", (r) => r.status() === 429 && throttled.push(r.url()));
// Keep test runs out of the real Sentry project; page errors are recorded below.
const blockedSentry = [];
await ctx.route(/sentry\.io/, (route) => {
	blockedSentry.push(route.request().url());
	return route.abort();
});

// Log in through the real login page; reuse the session token the app sends.
const login = await ctx.newPage();
let auth = null;
login.on("request", (r) => r.url().startsWith(API) && r.headers().authorization && (auth = r.headers().authorization));
await login.goto(`${APP}/auth/login`);
await login.waitForSelector("#email");
await login.fill("#email", EMAIL);
await login.fill("#password", PASSWORD);
await login.press("#password", "Enter");
await login.waitForSelector("main");
for (let i = 0; i < 50 && !auth; i++) await login.waitForTimeout(100);
if (!auth) throw new Error("no session token captured after login");

const get = async (path) => {
	const r = await ctx.request.get(`${API}${path}`, { headers: { Authorization: auth } });
	if (r.status() === 429) throttled.push(path);
	if (r.status() !== 200) throw new Error(`${path} -> ${r.status()}`);
	return r.json();
};

// ---- 1. every case, through the list endpoint the Cases page uses
const listed = [];
for (let p = 1; ; p++) {
	const body = await get(`/cases/list?page=${p}&limit=100&ordering=-created_at`);
	listed.push(...body.results);
	if (!body.next) break;
}
console.log(`[${elapsed()}] listed ${listed.length} cases (expected ${byCase.size})`);

// ---- 2. every case's detail, as the case page loads it
const failures = [];
const fail = (c, msg) => failures.push(`${c}: ${msg}`);
const details = new Map();
await pool(listed, API_WORKERS, async (row) => {
	const d = await get(`/cases/${row.id}`);
	details.set(String(d.case_number).toLowerCase(), d);
	const exp = byCase.get(String(d.case_number).toLowerCase());
	if (!exp) return fail(d.case_number, "not in the source");
	if (d.derived_status !== "complete") fail(d.case_number, `status ${d.derived_status}`);
	const forms = d.forms ?? [];
	const wantForms = exp.certs.reduce((s, c) => s + Math.ceil(c.bags.length / 5), 0);
	if (forms.length !== wantForms) fail(d.case_number, `${forms.length} forms, expected ${wantForms}`);
	if (forms.some((f) => f.phase !== "complete")) fail(d.case_number, "a form is not complete");
	const got = forms
		.flatMap((f) => f.bags.map((b) => [b.seal_tag_numbers, b.new_seal_tag_numbers ?? "", b.assessment?.determination, b.content_type, squash(f.additional_notes)].join("|")))
		.sort();
	const want = exp.certs
		.flatMap((c) => c.bags.map((b) => [b.tag, b.new_tag ?? "", b.determination, b.content_type, squash(unwrap(c.other_matters, "other_matters"))].join("|")))
		.sort();
	if (JSON.stringify(got) !== JSON.stringify(want)) fail(d.case_number, `bags differ: got ${got[0]} want ${want[0]}`);
	const oracleTags = exp.certs.flatMap((c) => oracle.get(c.cert_number).tags).sort();
	const apiTags = forms.flatMap((f) => f.bags.map((b) => b.seal_tag_numbers)).sort();
	if (JSON.stringify(oracleTags) !== JSON.stringify(apiTags)) fail(d.case_number, "tags differ from the Access table");
	const envelopes = exp.certs.flatMap((c) => Array(Math.ceil(c.bags.length / 5)).fill(oracle.get(c.cert_number).envelope)).sort();
	if (JSON.stringify(forms.map((f) => f.security_movement_envelope).sort()) !== JSON.stringify(envelopes)) fail(d.case_number, "envelopes differ from the Access table");
	const receipt = exp.certs.map((c) => c.receipt_date).filter(Boolean).sort()[0];
	if (!String(d.received).startsWith(receipt)) fail(d.case_number, `received ${d.received}, expected ${receipt}`);
	const botanist = (d.approved_botanist_details?.full_name ?? "").toLowerCase();
	const surnames = oracle.get(exp.certs[0].cert_number).botanist_surnames;
	if (!surnames.some((s) => botanist.includes(s)) && !explained.has(`botanist|${d.case_number}`)) fail(d.case_number, `botanist ${botanist}`);
	if (forms.some((f) => f.certificate)) fail(d.case_number, "a legacy form has a certificate");
	for (const o of [d.submitting_officer_details, d.requesting_officer_details]) {
		if (o && ["sworn_officer", "unsworn_officer"].includes(o.rank)) fail(d.case_number, `role label stored as rank for ${o.full_name}`);
	}
});
const missing = [...byCase.keys()].filter((k) => !details.has(k));
console.log(`[${elapsed()}] API: ${details.size} cases checked, ${missing.length} missing, ${failures.length} failure(s)`);

// ---- 3. rendered case pages for a stratified sample
const pick = new Map();
const add = (label, key) => key && !pick.has(key.toLowerCase()) && pick.set(key.toLowerCase(), label);
const bagCount = (c) => c.certs.reduce((s, x) => s + x.bags.length, 0);
const all = [...byCase.values()];
add("largest case", [...all].sort((a, b) => bagCount(b) - bagCount(a))[0].caseNumber);
add("most certificates", [...all].sort((a, b) => b.certs.length - a.certs.length)[0].caseNumber);
const defendantsOf = (r) => (typeof r.defendants === "string" ? JSON.parse(r.defendants) : r.defendants) ?? [];
const groups = [
	["per-bag results", (r) => r.result_basis !== "certificate"],
	["blank source result", (r) => r.bags.some((b) => b.determination === "pending"), 4],
	["source columns kept as comments", (r) => r.extras.length, 6],
	["no police reference", (r) => r.case_key.startsWith("CRT-")],
	["no tag numbers", (r) => r.bags[0].tag === "UNKNOWN"],
	["no defendant", (r) => defendantsOf(r).length === 0, 3],
	["corrected date", (r) => (r.date_notes ?? []).length],
	["same officer both roles", (r) => { const o = r.police_officer; return o.submitting_officer?.badge_id && o.submitting_officer.badge_id === o.requesting_officer?.badge_id; }],
	["certificate split across forms", (r) => r.bags.length > 5, 3],
	["recorded rank", (r) => r.police_officer.requesting_officer?.rank === "Detective", 2],
];
for (const [label, test, limit] of groups) for (const r of clean.filter(test).slice(0, limit ?? 1000)) add(label, r.case_key);
for (let i = 0; i < clean.length && pick.size < PAGE_SAMPLE + 25; i += 97) add("evenly spaced", clean[i].case_key);

const pageFailures = [];
const idByCase = new Map(listed.map((r) => [String(r.case_number).toLowerCase(), r.id]));
const pages = await Promise.all(
	Array.from({ length: PAGE_WORKERS }, async () => {
		const p = await ctx.newPage();
		p.on("console", (m) => {
			// The blocked Sentry requests log a failed load; they are not app errors.
			if (m.type() === "error" && !/sentry|ERR_FAILED/i.test(m.text() + (m.location()?.url ?? ""))) consoleErrors.push(`${p.url()} ${m.text()}`);
		});
		p.on("pageerror", (e) => consoleErrors.push(`${p.url()} uncaught: ${e.message}`));
		// Share the logged-in session (tokens live in localStorage).
		await p.goto(`${APP}/cases`);
		return p;
	})
);
let shot = 0;
await pool([...pick.entries()], PAGE_WORKERS, async ([key, label], _i, worker) => {
	// Each worker drives only its own tab.
	const page = pages[worker];
	const d = details.get(key);
	const exp = byCase.get(key);
	const firstForm = d.forms[0];
	const mustShow = [
		d.approved_botanist_details?.full_name,
		d.submitting_officer_details?.last_name,
		d.requesting_officer_details?.last_name,
		...d.defendants_details.map((x) => x.last_name),
		...firstForm.bags.map((b) => b.seal_tag_numbers),
	]
		.filter(Boolean)
		.map((w) => w.toLowerCase());
	const note = squash(firstForm.additional_notes);
	await page.goto(`${APP}/cases/${idByCase.get(key)}`);
	// The page fills in as its queries return; wait until everything expected
	// is there (or time out and report exactly what never appeared).
	const ready = await page
		.waitForFunction(
			([words, note]) => {
				const text = (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ").toLowerCase();
				const box = document.querySelector("#additional_notes");
				const boxOk = !note || (box && box.value.replace(/\s+/g, " ").trim() === note);
				return words.every((w) => text.includes(w)) && boxOk;
			},
			[mustShow, note],
			{ timeout: 45000, polling: 250 }
		)
		.then(() => true)
		.catch(() => false);
	if (!ready) {
		const text = squash(await page.locator("main").innerText()).toLowerCase();
		for (const word of mustShow) if (!text.includes(word)) pageFailures.push(`${exp.caseNumber} (${label}): page does not show ${word}`);
		const value = await page.locator("#additional_notes").inputValue().catch(() => "");
		if (note && squash(value) !== note) pageFailures.push(`${exp.caseNumber} (${label}): Section C box differs`);
		if (!pageFailures.some((f) => f.startsWith(exp.caseNumber))) pageFailures.push(`${exp.caseNumber} (${label}): page did not settle`);
	}
	const file = join(OUT, "pages", `${String(++shot).padStart(2, "0")}-${exp.caseNumber.replace(/[^\w-]+/g, "_")}.png`);
	// A very long page can be slow to capture whole; fall back to the viewport.
	await page
		.screenshot({ path: file, fullPage: true, timeout: 20000 })
		.catch(() => page.screenshot({ path: file, timeout: 20000 }).catch(() => {}));
});
console.log(`[${elapsed()}] pages: ${pick.size} checked, ${pageFailures.length} failure(s)`);

// ---- 4. the Cases page search finds cases by number, defendant, officer and tag
const searchFailures = [];
const searchCases = [...pick.keys()].slice(0, 12).map((k) => details.get(k));
const queries = searchCases.flatMap((d) => [
	[d, "case number", `search=${encodeURIComponent(d.case_number)}`],
	d.defendants_details[0] && [d, "defendant", `search=${encodeURIComponent(d.defendants_details[0].last_name)}`],
	d.submitting_officer_details?.last_name && [d, "officer", `search=${encodeURIComponent(d.submitting_officer_details.last_name)}`],
	[d, "tag", `tag_search=${encodeURIComponent(d.forms[0].bags[0].seal_tag_numbers)}`],
].filter(Boolean));
await pool(queries, API_WORKERS, async ([d, label, q]) => {
	for (let p = 1; ; p++) {
		const body = await get(`/cases/list?${q}&page=${p}&limit=100`);
		if (body.results.some((r) => r.id === d.id)) return;
		if (!body.next) return searchFailures.push(`${d.case_number}: not found by ${label}`);
	}
});
await pages[0].goto(`${APP}/cases`);
await pages[0].waitForSelector("table tbody tr", { timeout: 30000 });
await pages[0].screenshot({ path: join(OUT, "cases-list.png") });
console.log(`[${elapsed()}] search: ${queries.length} searches, ${searchFailures.length} failure(s)`);

// ---- 5. legacy data stays out of batching
const batches = await get("/cases/batches");
const batchCount = (batches.results ?? batches).length;
if (batchCount) failures.push(`${batchCount} batch(es) exist; legacy data must never be batched`);

console.log(`[${elapsed()}] Sentry requests blocked: ${blockedSentry.length}`);
const report = { blockedSentry: blockedSentry.length, listed: listed.length, expectedCases: byCase.size, missing, failures, pageFailures, searchFailures, throttled, consoleErrors, sample: [...pick.entries()] };
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
for (const f of [...failures, ...pageFailures, ...searchFailures].slice(0, 30)) console.log("  FAIL", f);
console.log(`[${elapsed()}] throttled responses: ${throttled.length}; console errors: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 5)) console.log("  ", e.slice(0, 200));
await browser.close();
const bad = missing.length + failures.length + pageFailures.length + searchFailures.length + throttled.length + consoleErrors.length;
console.log(bad ? `SWEEP FAILED (${bad} problem(s)); see ${OUT}/report.json` : `SWEEP PASSED; report and screenshots in ${OUT}`);
process.exit(bad ? 1 : 0);
