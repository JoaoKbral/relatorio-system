#!/usr/bin/env node
// Uploads service reports from the app's database (Neon) to SGAF Conecta,
// which has no API, by filling its web form with Playwright.
//
//   node upload.mjs login                       log in once (opens a browser)
//   node upload.mjs --since 2026-11-01          dry run: fill, screenshot, don't save
//   node upload.mjs --since 2026-11-01 --save   fill and save each report
//
// See README.md for all options and the mapping rules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pg from "pg";
import { chromium } from "playwright";
import { fillReport, readFeedback } from "./sgaf-page.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BASE = "https://conecta.sgaf.org.br";
const FORM_URL = `${BASE}/Cadastros/Relatorios/Culto/Upsert`;
const AUTH_FILE = path.join(HERE, ".auth/state.json");
const LOG_FILE = path.join(HERE, "uploaded.json");
// Choices made in --review ("this app name is that SGAF person"), reused on later runs.
const ALIAS_FILE = path.join(HERE, "aliases.json");
const OUT_DIR = path.join(HERE, "out");

// The first "Geral" in SGAF's person list: name used for every offering.
const GERAL_PERSON_ID = "322303";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    since: { type: "string" },
    until: { type: "string" },
    only: { type: "string" },
    church: { type: "string", default: "1" },
    save: { type: "boolean", default: false },
    headed: { type: "boolean", default: false },
    review: { type: "boolean", default: false },
    "end-equals-start": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (opts.help) {
  console.log(fs.readFileSync(path.join(HERE, "README.md"), "utf8"));
  process.exit(0);
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};

// ---------------------------------------------------------------- login ---
async function login() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/Login`);
  console.log("Log in to SGAF in the browser window (up to 5 minutes)...");
  await page.waitForURL((u) => !/\/Login/i.test(u.pathname), { timeout: 5 * 60_000 });
  await page.waitForLoadState("networkidle");
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  console.log(`Session saved to ${path.relative(process.cwd(), AUTH_FILE)}`);
  await browser.close();
}

// ----------------------------------------------------------------- data ---
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .env");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function loadReports() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("SET default_transaction_read_only = on");
    const where = [`r."churchId" = $1`];
    const params = [Number(opts.church)];
    if (opts.since) {
      params.push(opts.since);
      where.push(`(r."dataCulto" AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length}`);
    }
    if (opts.until) {
      params.push(opts.until);
      where.push(`(r."dataCulto" AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length}`);
    }
    if (opts.only) {
      params.push(opts.only.split(",").map(Number));
      where.push(`r.id = ANY($${params.length})`);
    }
    // to_jsonb(r) so the query works before and after the outrasEntradas
    // column is dropped.
    const { rows } = await client.query(
      `SELECT r.id,
              to_char(r."dataCulto" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS date,
              to_jsonb(r) AS j,
              COALESCE((SELECT array_agg(p.name ORDER BY d."order")
                        FROM "ReportDeacon" d JOIN "Person" p ON p.id = d."personId"
                        WHERE d."reportId" = r.id), '{}') AS diaconos,
              COALESCE((SELECT json_agg(json_build_object('name', t."personName",
                                 'method', t."paymentMethod", 'value', t.value) ORDER BY t."order")
                        FROM "TitheRecord" t WHERE t."reportId" = r.id), '[]') AS dizimos
         FROM "Report" r
        WHERE ${where.join(" AND ")}
        ORDER BY r."dataCulto", r.horario`,
      params,
    );
    return rows.map(toSgaf);
  } finally {
    await client.end();
  }
}

function toSgaf({ id, date, j, diaconos, dizimos }) {
  const n = (v) => Number(v ?? 0);
  const horario = String(j.horario).slice(0, 5);
  return {
    id,
    date,
    horario,
    horarioTermino: opts["end-equals-start"] ? horario : "",
    diaDaSemana: j.diaDaSemana,
    pregador: j.pregador?.trim() || "",
    pastores: j.pastoresPresentes ?? [],
    visitas: j.visitasEspeciais ?? [],
    diaconos,
    totalPresentes: n(j.totalPresentes),
    visitantes: n(j.visitantes),
    conversoes: n(j.conversoes),
    batizadosEspirito: n(j.batizadosEspirito),
    criancasApresentadas: n(j.criancasApresentadas),
    testemunhoCura: n(j.testemunhoCura),
    dizimos: dizimos.map((t) => ({ name: t.name, pix: t.method === "PIX", value: n(t.value) })),
    totalDizimos: n(j.totalDizimos),
    ofertasGerais: n(j.totalOfertasGerais),
    // "Outras entradas" no longer exists in the app; old values count as especiais.
    ofertasEspeciais: n(j.totalOfertasEspeciais) + n(j.outrasEntradas),
    ofertasMissoes: n(j.totalOfertasMissoes),
    geralId: GERAL_PERSON_ID,
  };
}

// --------------------------------------------------------------- upload ---
const close = (a, b) => a !== null && Math.abs(a - b) < 0.005;

async function uploadOne(page, r) {
  await page.goto(FORM_URL);
  if (/\/Login/i.test(new URL(page.url()).pathname)) {
    throw new Error("SGAF session expired. Run `node upload.mjs login` again.");
  }
  await page.waitForSelector("#formUpsertCulto");
  await page.waitForFunction(() => typeof window.addPregador === "function" && document.getElementById("dz_pessoa_picker")?.tomselect);

  const aliases = readJson(ALIAS_FILE, {});
  const label = `Relatório de ${r.date.split("-").reverse().join("/")} às ${r.horario}`;
  const res = await page.evaluate(fillReport, { ...r, review: opts.review, aliases, label });

  const chosen = res.log.filter((l) => l.kind === "chosen");
  if (chosen.length) {
    for (const c of chosen) aliases[c.aliasKey] = { id: c.id, text: c.sgaf };
    fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2) + "\n");
  }

  const problems = [];
  if (res.diaSemana && r.diaDaSemana && res.diaSemana !== r.diaDaSemana)
    problems.push(`weekday ${res.diaSemana} != ${r.diaDaSemana}`);
  if (!close(res.totals.dizimos, r.totalDizimos)) problems.push(`tithes R$ ${res.totals.dizimos} != ${r.totalDizimos}`);
  if (!close(res.totals.ofertas, r.ofertasGerais)) problems.push(`offerings R$ ${res.totals.ofertas} != ${r.ofertasGerais}`);
  if (!close(res.totals.especiais, r.ofertasEspeciais))
    problems.push(`special offerings R$ ${res.totals.especiais} != ${r.ofertasEspeciais}`);
  if (res.invalid.length) problems.push(`invalid fields: ${res.invalid.join(", ")}`);
  // Names SGAF doesn't have are never sent: they would create new people there.
  const missing = res.log.filter((l) => l.kind === "missing");
  if (missing.length)
    problems.push(`${missing.length} name(s) not found in SGAF. Fix them in the app, or run with --review to choose or register them`);

  const warnings = [];
  if (r.totalPresentes === 0) warnings.push("total presentes is 0");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shot = path.join(OUT_DIR, `${r.date}_${r.horario.replace(":", "h")}_report-${r.id}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  let saved = null;
  if (opts.save && problems.length === 0) {
    const before = page.url();
    await Promise.all([
      page.waitForLoadState("load"),
      page.locator('#formUpsertCulto button[type="submit"]', { hasText: "Salvar" }).click(),
    ]);
    await page.waitForTimeout(1500);
    const feedback = await page.evaluate(readFeedback);
    const after = page.url();
    const reportId = await page.locator('[name="Relatorio.Id"]').inputValue().catch(() => "");
    const stillOnBlankForm = after === before && (reportId === "" || reportId === "0");
    if (stillOnBlankForm && feedback.length) {
      problems.push(`SGAF refused the save: ${feedback.join(" | ")}`);
    } else if (stillOnBlankForm) {
      problems.push("could not confirm the save (still on the empty form, no message). Check SGAF before re-running.");
    } else {
      saved = { at: new Date().toISOString(), url: after, feedback };
    }
  }
  return { res, problems, warnings, missing, shot, saved };
}

async function main() {
  if (positionals[0] === "login") return login();
  if (!opts.since && !opts.only) {
    console.error("Pass --since YYYY-MM-DD (or --only <report ids>). See --help.");
    process.exit(1);
  }
  if (!fs.existsSync(AUTH_FILE)) {
    console.error("No SGAF session yet. Run `node upload.mjs login` first.");
    process.exit(1);
  }

  const uploaded = readJson(LOG_FILE, {});
  const reports = (await loadReports()).filter((r) => !uploaded[r.id]);
  const skipped = Object.keys(uploaded).length;
  console.log(`${reports.length} report(s) to ${opts.save ? "UPLOAD" : "dry-run"}` + (skipped ? ` (${skipped} already in uploaded.json are skipped)` : ""));
  if (!reports.length) return;

  // --review needs a visible browser: it asks about unknown names on the page.
  const browser = await chromium.launch({ headless: !(opts.headed || opts.review) });
  const context = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));

  let failed = 0;
  try {
    for (const r of reports) {
      const label = `#${r.id} ${r.date} ${r.horario}`;
      try {
        const out = await uploadOne(page, r);
        const status = out.saved ? "SAVED" : out.problems.length ? "PROBLEM" : opts.save ? "NOT SAVED" : "OK (dry run)";
        console.log(`\n${label}: ${status}`);
        for (const t of out.res.log.filter((l) => l.kind === "first-of-many"))
          console.log(`  ${t.count} matches, took the first: ${t.where} "${t.name}" -> ${t.sgaf}`);
        for (const t of out.res.log.filter((l) => l.kind === "chosen" || l.kind === "alias"))
          console.log(`  ${t.kind === "chosen" ? "chosen in review" : "remembered choice"}: ${t.where} "${t.name}" -> ${t.sgaf}`);
        for (const t of out.missing) {
          console.log(`  not in SGAF: ${t.where} "${t.name}"`);
          if (t.suggestions.length) console.log(`      closest: ${t.suggestions.join(", ")}`);
        }
        for (const w of out.warnings) console.log(`  warning: ${w}`);
        for (const p of out.problems) console.log(`  problem: ${p}`);
        console.log(`  screenshot: ${path.relative(process.cwd(), out.shot)}`);
        if (out.saved) {
          uploaded[r.id] = { date: r.date, horario: r.horario, ...out.saved };
          fs.writeFileSync(LOG_FILE, JSON.stringify(uploaded, null, 2) + "\n");
        }
        if (out.problems.length) {
          failed++;
          // A save we couldn't confirm might have gone through: stop so a
          // re-run can't create a duplicate before someone checks SGAF.
          if (opts.save && out.problems.some((p) => p.startsWith("could not confirm"))) break;
        }
      } catch (e) {
        if (e.message.includes("SKIPPED_IN_REVIEW")) {
          console.log(`\n${label}: SKIPPED (you chose "Pular este relatório")`);
          continue;
        }
        failed++;
        console.log(`\n${label}: ERROR ${e.message}`);
        if (/session expired/.test(e.message)) break;
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
