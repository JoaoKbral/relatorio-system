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

  // Selects the registered person matching `name`, or keeps the name as typed
  // text (SGAF accepts that) when there is no unique match.
  async function pick(ts, name, where) {
    const want = toks(name);
    // Candidates in the order SGAF's dropdown shows them. When several people
    // match, the user's rule is to take the first one.
    const tryQuery = async (q) => {
      const res = await search(ts, q);
      const order = ts.search(q).items.map((i) => String(i.id));
      res.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
      const exact = res.filter((o) => toks(o.text).join(" ") === want.join(" "));
      return exact.length ? exact : res.filter((o) => want.every((w) => toks(o.text).includes(w)));
    };
    // The search is accent-sensitive ("Andrea" doesn't find "ANDRÉA"), so if
    // the first name doesn't find them, try the surnames too.
    const words = stripTitle(name).split(/\s+/);
    const queries = [words.slice(0, 2).join(" "), want.slice(0, 2).join(" "), words.slice(-2).join(" "), words.at(-1)];
    let m = [];
    for (const q of [...new Set(queries)]) {
      m = await tryQuery(q);
      if (m.length) break;
    }
    ts.close();
    if (m.length) {
      ts.setValue(m[0].id);
      log.push({ kind: m.length > 1 ? "first-of-many" : "match", where, name, sgaf: m[0].text, count: m.length });
      return true;
    }
    const id = "__typed__" + Date.now() + Math.random().toString(16).slice(2);
    ts.addOption({ id, text: name, __typed: true });
    ts.setValue(id);
    log.push({ kind: "typed", where, name, candidates: m.length });
    return false;
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
      await pick(ts, name, where);
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
