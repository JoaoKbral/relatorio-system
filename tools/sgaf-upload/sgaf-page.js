// Runs INSIDE the SGAF Conecta page (passed to page.evaluate). It must be
// self-contained: no imports and no closures over Node variables.
//
// The SGAF form (Cadastros/Relatorios/Culto/Upsert) is driven through its own
// widgets: TomSelect pickers (`select.tomselect`) for people, the page's
// addPregador/addPastor/addDiacono/addVisita functions for people rows, and the
// dz_/of_/oe_/ms_ entry boxes plus their ADICIONAR buttons for money entries.
// Nothing here submits the form.
export async function fillReport(r) {
  const log = [];
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const $ = (sel) => document.querySelector(sel);
  const set = (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const money = (n) => Number(n).toFixed(2).replace(".", ",");

  // --- name matching ------------------------------------------------------
  // SGAF's search is accent-sensitive, so we search with the original
  // spelling first and compare ignoring accents, case and da/de/dos.
  const STOP = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
  const stripTitle = (s) => s.replace(/^\s*(pra?|pastora?|dc|dca|ev|presb)\.?\s+/i, "").trim();
  const norm = (s) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const toks = (s) => norm(stripTitle(s)).split(" ").filter((t) => t && !STOP.has(t));

  async function search(ts, q) {
    ts.clearOptions();
    ts.load(q);
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (!ts.loading) break;
    }
    return Object.values(ts.options).filter((o) => !o.__typed);
  }

  // Looks `name` up in SGAF's registry. Returns the matches (first = the one
  // SGAF's dropdown shows first) and the closest other people as suggestions.
  async function lookup(ts, name) {
    const want = toks(name);
    const seen = new Map();
    const tryQuery = async (q) => {
      const res = await search(ts, q);
      const order = ts.search(q).items.map((i) => String(i.id));
      res.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
      for (const o of res) seen.set(String(o.id), o);
      const exact = res.filter((o) => toks(o.text).join(" ") === want.join(" "));
      return exact.length ? exact : res.filter((o) => want.every((w) => toks(o.text).includes(w)));
    };
    // The search is accent-sensitive ("Andrea" doesn't find "ANDRÉA"), so if
    // the first name doesn't find them, try the surnames too.
    const words = stripTitle(name).split(/\s+/);
    const queries = [words.slice(0, 2).join(" "), want.slice(0, 2).join(" "), words.slice(-2).join(" "), words.at(-1)];
    let matches = [];
    for (const q of [...new Set(queries)]) {
      matches = await tryQuery(q);
      if (matches.length) break;
    }
    // Same word = 2 points, a word one letter off (Francisco/Francisca) = 1.
    const oneOff = (a, b) => {
      if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false;
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
    };
    const score = (o) => {
      const t = toks(o.text);
      return want.reduce((s, w) => s + (t.includes(w) ? 2 : t.some((x) => oneOff(w, x)) ? 1 : 0), 0) + (t[0] === want[0] ? 1 : 0);
    };
    const suggestions = [...seen.values()]
      .map((o) => ({ id: String(o.id), text: o.text, s: score(o) }))
      .filter((o) => o.s >= 2)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ id, text }) => ({ id, text }));
    return { matches, suggestions };
  }

  // --- review panel (only with --review) ------------------------------------
  // Asks the person at the browser what to do with a name SGAF doesn't have.
  // Resolves to {action: "use", id, text} | {action: "register"} | {action: "skip"}.
  function ask(where, name, suggestions) {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.id = "sgaf-upload-review";
      box.style.cssText =
        "position:fixed;top:16px;right:16px;z-index:2147483646;width:380px;max-width:calc(100vw - 32px);" +
        "background:#fff;color:#111;border:2px solid #d97706;border-radius:10px;padding:16px;" +
        "font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25)";
      const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const btn = (label, data, primary) =>
        `<button data-a="${data}" style="display:block;width:100%;text-align:left;margin:6px 0 0;padding:8px 10px;` +
        `border-radius:6px;cursor:pointer;border:1px solid ${primary ? "#2563eb" : "#bbb"};` +
        `background:${primary ? "#eff6ff" : "#fff"};color:#111;font:inherit">${label}</button>`;
      box.innerHTML =
        `<div style="font-weight:600;margin-bottom:4px">${r.label}</div>` +
        `<div>${esc(where)} <b>"${esc(name)}"</b> não foi encontrado no SGAF.</div>` +
        (suggestions.length ? `<div style="margin-top:10px;color:#555">É uma destas pessoas? (fica lembrado)</div>` : "") +
        suggestions.map((s, i) => btn("Usar " + esc(s.text), "use:" + i, true)).join("") +
        `<div style="margin-top:10px;color:#555">Ou:</div>` +
        btn("Cadastrar no SGAF…", "register") +
        btn("Pular este relatório", "skip");
      document.body.appendChild(box);
      box.addEventListener("click", (e) => {
        const a = e.target.closest("button")?.dataset.a;
        if (!a) return;
        box.remove();
        if (a.startsWith("use:")) resolve({ action: "use", ...suggestions[Number(a.slice(4))] });
        else resolve({ action: a });
      });
    });
  }

  // Opens SGAF's own quick-registration popup with the name filled in, and
  // waits until the person closes it (after clicking Cadastrar or Cancelar).
  async function registerInSgaf(name, ctx) {
    window.abrirModalCadastroRapido(name, ctx || "");
    const modal = document.getElementById("modalCadastroRapido");
    await sleep(300);
    while (!modal.classList.contains("hidden")) await sleep(300);
    await sleep(500);
  }

  class SkipReport extends Error {}

  // Selects the SGAF person for `name`. Never sends a name SGAF doesn't have:
  // without --review an unknown name is reported and the report is not saved.
  // `ctx` is the money-entry prefix (dz/of/oe/ms), used by SGAF's popup.
  async function pick(ts, name, where, ctx) {
    const aliasKey = `${where}|${name}`;
    const alias = r.aliases[aliasKey];
    if (alias) {
      await search(ts, alias.text);
      if (ts.options[alias.id]) {
        ts.close();
        ts.setValue(alias.id);
        log.push({ kind: "alias", where, name, sgaf: alias.text });
        return true;
      }
    }
    for (;;) {
      const { matches, suggestions } = await lookup(ts, name);
      ts.close();
      if (matches.length) {
        ts.setValue(matches[0].id);
        log.push({ kind: matches.length > 1 ? "first-of-many" : "match", where, name, sgaf: matches[0].text, count: matches.length });
        return true;
      }
      if (!r.review) {
        log.push({ kind: "missing", where, name, suggestions: suggestions.map((s) => s.text) });
        return false;
      }
      const answer = await ask(where, name, suggestions);
      if (answer.action === "skip") throw new SkipReport("SKIPPED_IN_REVIEW");
      if (answer.action === "use") {
        await search(ts, answer.text);
        ts.close();
        ts.setValue(answer.id);
        log.push({ kind: "chosen", where, name, sgaf: answer.text, id: answer.id, aliasKey });
        return true;
      }
      await registerInSgaf(name, ctx);
      // Loop: search again; the new person is found if it was registered.
    }
  }

  // Finds the TomSelect that sits in the same row as a hidden input.
  function pickerNear(hiddenName) {
    let n = document.querySelector(`[name="${hiddenName}"]`);
    for (let k = 0; k < 6 && n; k++) {
      n = n.parentElement;
      const s = n && [...n.querySelectorAll("select")].find((x) => x.tomselect);
      if (s) return s.tomselect;
    }
    throw new Error("Picker not found near " + hiddenName);
  }

  const form = $("#formUpsertCulto");
  if (!form) throw new Error("SGAF report form not found");
  if ($('[name="Relatorio.Id"]').value && $('[name="Relatorio.Id"]').value !== "0") {
    throw new Error("Form is editing an existing report; expected a new one");
  }

  // --- header and stats ---------------------------------------------------
  set($('[name="Relatorio.TipoCulto"]'), "1"); // Culto Regular
  await sleep(300);
  set($("#cultoData"), r.date);
  set($("#cultoHoraInicio"), r.horario);
  if (r.horarioTermino) set($('[name="Relatorio.HorarioTermino"]'), r.horarioTermino);
  const stats = {
    TotalPresentes: r.totalPresentes,
    Visitantes: r.visitantes,
    Conversoes: r.conversoes,
    BatizadosEspiritoSanto: r.batizadosEspirito,
    CriancasApresentadas: r.criancasApresentadas,
    BatizadosAguas: 0,
    CeiasServidas: 0,
    TestemunhosCura: r.testemunhoCura,
    EspectadoresOnline: 0,
  };
  for (const [k, v] of Object.entries(stats)) set($(`[name="Relatorio.${k}"]`), String(v ?? 0));
  await sleep(300);

  // --- people -------------------------------------------------------------
  if (r.pregador) {
    // "Pra. Rebeca" -> the full name of the pastor it refers to, if unique.
    let name = r.pregador;
    const pt = toks(name);
    const full = r.pastores.filter((p) => pt.every((t) => toks(p).includes(t)));
    if (full.length === 1) name = full[0];
    window.addPregador();
    await sleep(300);
    set($('[name="Relatorio.Pregadores[0].TipoPregador"]'), "1"); // Preleção
    await pick(pickerNear("Relatorio.Pregadores[0].PessoaId"), name, "pregador");
  }
  for (let i = 0; i < r.pastores.length; i++) {
    window.addPastor();
    await sleep(300);
    await pick(pickerNear(`Relatorio.PastoresPresentesIds[${i}]`), r.pastores[i], "pastor");
  }
  for (let i = 0; i < r.diaconos.length; i++) {
    window.addDiacono();
    await sleep(300);
    await pick(pickerNear(`Relatorio.DiaconosEmServicoIds[${i}]`), r.diaconos[i], "diácono");
  }
  for (let i = 0; i < r.visitas.length; i++) {
    window.addVisita();
    await sleep(300);
    const tipo = $(`[name="Relatorio.VisitasEspeciais[${i}].TipoVisitanteEspecial"]`);
    const opt = [...tipo.options].find((o) => o.text.trim() === "Pastor");
    set(tipo, opt.value);
    await pick(pickerNear(`Relatorio.VisitasEspeciais[${i}].PessoaId`), r.visitas[i], "visita");
  }

  // --- money entries ------------------------------------------------------
  async function chooseSantander(px) {
    const input = $(`#${px}_conta_nome`);
    const hidden = $(`#${px}_conta`);
    const findLi = () =>
      [...input.parentElement.parentElement.querySelectorAll("li.cursor-pointer")].find((l) =>
        /SANTANDER/i.test(l.innerText),
      );
    // The account list is rendered on focus and re-rendered once its search
    // returns, so let it settle and re-find the item before each click.
    for (let attempt = 0; attempt < 4 && !/^\d+$/.test(hidden.value); attempt++) {
      input.value = "";
      input.focus();
      input.click();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(1200);
      const li = findLi();
      if (!li) continue;
      li.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      li.click();
      for (let i = 0; i < 10 && !/^\d+$/.test(hidden.value); i++) await sleep(100);
    }
    if (!/^\d+$/.test(hidden.value)) {
      throw new Error(`Santander account was not selected (account box shows "${input.value}")`);
    }
  }

  async function addEntry(px, button, { name, personId, pix, value, where }) {
    set($(`#${px}_forma`), pix ? "1" : "3"); // 1 = PIX, 3 = Dinheiro
    await sleep(500);
    const ts = $(`#${px}_pessoa_picker`).tomselect;
    if (personId) {
      await search(ts, name);
      if (!ts.options[personId]) throw new Error(`SGAF person ${personId} (${name}) not found`);
      ts.close();
      ts.setValue(personId);
    } else {
      await pick(ts, name, where, px);
    }
    if (pix) await chooseSantander(px);
    set($(`#${px}_valor`), money(value));
    $(`#${button}`).click();
    await sleep(600);
  }

  for (const t of r.dizimos) {
    await addEntry("dz", "btn_add_dizimo", { name: t.name, pix: t.pix, value: t.value, where: "dízimo" });
  }
  // Offerings always go in as one entry per total, named the first "Geral".
  const GERAL = { name: "Geral", personId: r.geralId, pix: false };
  if (r.ofertasGerais > 0) await addEntry("of", "btn_add_oferta", { ...GERAL, value: r.ofertasGerais });
  if (r.ofertasEspeciais > 0) await addEntry("oe", "btn_add_oferta_especial", { ...GERAL, value: r.ofertasEspeciais });
  if (r.ofertasMissoes > 0) await addEntry("ms", "btn_add_missoes", { ...GERAL, value: r.ofertasMissoes });

  // --- read back what the page computed -------------------------------------
  const text = document.body.innerText;
  const total = (label) => {
    const m = text.match(new RegExp(label + "\\s*R\\$\\s*([\\d.,]+)"));
    return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
  };
  const totals = {
    dizimos: total("TOTAL DE DÍZIMOS"),
    ofertas: total("TOTAL DE OFERTAS(?! ESPECIAIS)"),
    especiais: total("TOTAL DE OFERTAS ESPECIAIS"),
  };
  const invalid = [...form.querySelectorAll("input,select")]
    .filter((e) => e.offsetParent && !e.checkValidity())
    .map((e) => e.name || e.id);
  return { log, totals, invalid, diaSemana: $("#cultoDiaSemana").value };
}

// Reads any error/success feedback shown after pressing Salvar.
export function readFeedback() {
  const sel = ".validation-summary-errors, .field-validation-error, .text-red-600, .text-red-700, .alert-danger, [role=alert], .toast, .swal2-popup";
  return [...document.querySelectorAll(sel)]
    .filter((e) => e.offsetParent && e.innerText.trim())
    .map((e) => e.innerText.trim().replace(/\s+/g, " ").slice(0, 200));
}
