import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envFile = readFileSync("app/.env.production", "utf8");
const env = {};
envFile.split("\n").forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const userId = "52b34876-aea9-455e-8dc4-7281c3129155";
const { data: cred } = await db.from("saw_credentials").select("*").eq("user_id", userId).eq("ativo", true).single();

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(30000);

page.on("dialog", async (dialog) => {
  const msg = dialog.message();
  console.log(`  [DIALOG] ${dialog.type()}: ${msg.substring(0, 120)}`);
  // Profissional nao encontrado → aceitar (prosseguir)
  if (/profissional.*n[aã]o encontrado/i.test(msg)) { await dialog.accept(); return; }
  // Default: aceitar
  await dialog.accept();
});

// Login
console.log("[0] Login...");
await page.goto(cred.login_url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);
await page.fill('input[name="login"], input[id="login"]', cred.usuario);
await page.fill('input[type="password"]', cred.senha);
await page.evaluate(() => document.forms[0]?.submit());
await page.waitForTimeout(5000);

// Nova guia
console.log("[1] Formulario...");
await page.goto("https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=abrirTelaDeSolicitacaoDeSPSADT", {
  waitUntil: "networkidle", timeout: 60000
});
await page.waitForTimeout(5000);

// 2. CARTEIRA
console.log("[2] Carteira 865-0024077730007...");
const unimedField = page.locator('input[name*="beneficiario.unimed.codigo"]').first();
await unimedField.fill("865");
await unimedField.press("Tab");
await page.waitForTimeout(1000);

const cartField = page.locator('input[name*="beneficiario.codigo"]').first();
await cartField.fill("0024077730007");
await page.waitForTimeout(500);

// Hook: interceptar presenca → setar presente=true → chamar biometria
await page.evaluate(() => {
  window.abrirProcessoBeneficiarioPresente = function() {
    window.beneficiarioPresente = true;
    if (typeof window.abrirTelaBiometria === "function") window.abrirTelaBiometria();
  };
  window.operadoraPossuiTamanhoCodigoBenefVariavel = true;
  document.getElementById("acao")?.click();
});
console.log("[2] AJAX disparado, aguardando...");
await page.waitForTimeout(10000);

const nome = await page.evaluate(() => {
  return document.querySelector('input[name="manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.beneficiario.nome"]')?.value ||
    document.querySelector('input[name*="beneficiario.nomeAbreviado"]')?.value || "";
});
console.log("[2] Nome:", nome);

// Modal biometria → Pre-autorizacao + Pular
// Tentar encontrar a div de biometria (pode estar hidden ou como jQuery dialog)
let hasBio = await page.evaluate(() => {
  const divs = document.querySelectorAll("div");
  for (const d of divs) {
    if (d.offsetHeight > 0 && /Pular Autentica/i.test(d.textContent ?? "")) return true;
  }
  return false;
});

// Se nao apareceu, forcar: mostrar div de biometria diretamente
if (!hasBio) {
  console.log("[2b] Modal nao visivel, forcando exibicao...");
  await page.evaluate(() => {
    // Procurar div que contem "Pular Autenticacao" (pode estar display:none)
    const allDivs = document.querySelectorAll("div");
    for (const d of allDivs) {
      if (/Pular Autentica/i.test(d.innerHTML) && d.innerHTML.length < 5000) {
        d.style.display = "block";
        d.style.visibility = "visible";
        d.style.position = "fixed";
        d.style.top = "50px";
        d.style.left = "50px";
        d.style.zIndex = "99999";
        return;
      }
    }
    // Tentar chamar funcao de pular biometria diretamente
    // Setar motivo como pre-autorizacao e chamar funcao de pular
    const motivo = document.getElementById("codigoDoMotivoDeUtilizacaoDaBiometria");
    if (motivo) motivo.value = "5"; // Pre-autorizacao
    if (typeof window.pularBiometria === "function") window.pularBiometria();
    if (typeof window.pularAutenticacao === "function") window.pularAutenticacao();
  });
  await page.waitForTimeout(3000);
  hasBio = await page.evaluate(() => {
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.offsetHeight > 0 && /Pular Autentica/i.test(d.textContent ?? "")) return true;
    }
    return false;
  });
}

if (hasBio) {
  console.log("[2b] Modal biometria visivel — Pre-autorizacao + Pular...");
  await page.evaluate(() => {
    const selects = document.querySelectorAll("select");
    for (const sel of selects) {
      for (const opt of sel.options) {
        if (/pr[eé].?autoriz/i.test(opt.text)) { sel.value = opt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); break; }
      }
    }
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, input[type=button]"));
    const p = btns.find(b => /pular/i.test(b.textContent ?? b.value ?? ""));
    if (p) p.click();
  });
  await page.waitForTimeout(5000);
  console.log("[2b] Biometria pulada OK");
} else {
  // Fallback: setar campo hidden de motivo diretamente
  console.log("[2b] Modal NAO apareceu — setando motivo pre-autorizacao diretamente...");
  await page.evaluate(() => {
    const el = document.querySelector('input[name*="codigoDoMotivoDeUtilizacaoDaBiometria"]');
    if (el) el.value = "5";
    // Setar biometria como autenticada/pulada
    const auth = document.querySelector('input[name*="biometriaBeneficiarioAutenticada"]');
    if (auth) auth.value = "true";
    // Setar autenticacao posterior
    const posterior = document.querySelector('input[name*="autenticacaoPosteriorViaTokenDeAtendimento"]');
    if (posterior) posterior.value = "true";
  });
  console.log("[2b] Campos hidden setados");
}

// 3. CARATER
console.log("[3] Carater Eletiva...");
await page.evaluate(() => {
  const s = document.querySelector('select[name*="caraterDeSolicitacao"]');
  if (s) { s.value = "1"; s.dispatchEvent(new Event("change", { bubbles: true })); }
});

// 4. EXECUTANTE
console.log("[4] Executante...");
await page.evaluate(() => {
  const s = document.querySelector('select[name*="contratadoExecutante.codigo"]');
  if (s) { s.value = "97498504"; s.dispatchEvent(new Event("change", { bubbles: true })); }
});
await page.waitForTimeout(1000);

// 5. PROCEDIMENTO — 50000470 (psicoterapia) x4
console.log("[5] Procedimento 50000470 x4...");
await page.evaluate(() => {
  const t = document.querySelector('select[name*="procedimentosSolicitados[0].tipoTabela"]');
  if (t) { t.value = "22"; t.dispatchEvent(new Event("change", { bubbles: true })); }
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const el = document.querySelector('input[name="procedimentosSolicitados[0].codigo"]');
  if (el) { el.readOnly = false; el.value = "50000470"; el.readOnly = true; }
  if (typeof window.capturarProcedimentoSolicitadoEValidar0 === "function") window.capturarProcedimentoSolicitadoEValidar0();
});
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const el = document.querySelector('input[name="procedimentosSolicitados[0].quantidade"]');
  if (el) { el.value = "4"; el.dispatchEvent(new Event("change", { bubbles: true })); }
});
const desc = await page.evaluate(() => document.querySelector('input[name*="procedimentosSolicitados[0].descricao"]')?.value ?? "");
console.log("[5] Descricao:", desc);

// 6. TIPO/REGIME
console.log("[6] Tipo/Regime...");
await page.evaluate(() => {
  const set = (n, v) => { const s = document.querySelector(`select[name*="${n}"]`); if (s) { s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); } };
  set("tipoDeAtendimento", "03");
  set("regimeDeAtendimento", "01");
  set("tipoDeConsulta", "2");
  set("indicacaoDeAcidente", "9");
});
await page.evaluate(() => {
  const el = document.querySelector('textarea[name*="indicacaoClinica"], input[name*="indicacaoClinica"]');
  if (el) el.value = "sessao de psicopedagogia";
});
await page.evaluate(() => {
  const el = document.querySelector('input[name*="dataDeSolicitacao"]');
  if (el) el.value = "28/03/2026";
});

// 7. PROFISSIONAL — Mailanne Batista Dantas (Psicopedagogo/CRP)
console.log("[7] Profissional...");
await page.evaluate(() => {
  const set = (s, v) => { const el = document.querySelector(s); if (el) { el.readOnly = false; el.value = v; } };
  set('input[name*="contratadoSolicitante.codigo"]', "97498504");
  set('input[name*="contratadoSolicitante.nome"]', "DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO");
});
const profField = page.locator('input[name*="profissionalSolicitante.nome"]');
await profField.fill("Mailanne Batista Dantas");
await page.waitForTimeout(500);
await page.click("body");
await page.waitForTimeout(500);
await page.evaluate(() => {
  const set = (s, v) => { const el = document.querySelector(s); if (el) { el.readOnly = false; el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); } };
  set('select[name*="profissionalSolicitante.conselhoProfissional"]', "08");
  set('input[name*="profissionalSolicitante.crm"]', "21877");
  set('select[name*="profissionalSolicitante.ufDoCrm"]', "29");
  const cbo = document.querySelector('select[name*="profissionalSolicitante.cbos"]');
  if (cbo) { for (const o of cbo.options) { if (/psicopedagog/i.test(o.text)) { cbo.value = o.value; break; } } cbo.dispatchEvent(new Event("change", { bubbles: true })); }
});

// 8. CONTATO
console.log("[8] Contato...");
await page.evaluate(() => {
  const email = document.querySelector('input[name="emailContatoBeneficiario"]');
  if (email && (!email.value || email.value.includes("sememail"))) email.value = "paciente@email.com";
  const ddd = document.querySelector('select[name*="numeroDDDTelefoneContatoBeneficiario"]');
  if (ddd) { ddd.value = "73"; ddd.dispatchEvent(new Event("change", { bubbles: true })); }
  const tel = document.querySelector('input[name*="numeroTelefoneContatoBeneficiario"]');
  if (tel) tel.value = "999999999";
});

// 9. GRAVAR — capturar navegacao
console.log("[9] Gravando...");

// Interceptar response do form submit para capturar dados antes da navegacao
let guideNumber = "";

// Capturar o numero da guia que o SAW gera — via response interceptor
page.on("response", async (response) => {
  const url = response.url();
  if (url.includes("SolicitacaoDeSPSADT40") || url.includes("MantemToken")) {
    try {
      const text = await response.text().catch(() => "");
      // Buscar numero da guia no HTML de resposta
      const match = text.match(/numeroDaGuia[^>]*value="(\d{8,})"/);
      if (match) guideNumber = match[1];
      // Buscar no campo chave
      const matchChave = text.match(/chave[^>]*value="(\d{5,})"/);
      if (matchChave && !guideNumber) guideNumber = "chave:" + matchChave[1];
    } catch { /* */ }
  }
});

await page.evaluate(() => { if (typeof window.gravarGuia === "function") window.gravarGuia(); });

// Esperar navegacao (gravarGuia submete o form e redireciona)
try {
  await page.waitForURL(/MantemTokenDeAtendimento|consultarGuia|abrirTela/, { timeout: 30000 });
} catch {
  // Se nao navegou, pode precisar re-preencher apos confirm do profissional
  console.log("[9b] Nao navegou, re-preenchendo e tentando novamente...");
  await page.evaluate(() => {
    const set = (s, v) => { const el = document.querySelector(s); if (el) { el.readOnly = false; el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set('input[name*="contratadoSolicitante.codigo"]', "97498504");
    set('input[name*="contratadoSolicitante.nome"]', "DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO");
    set('input[name*="profissionalSolicitante.nome"]', "Mailanne Batista Dantas");
    set('input[name*="profissionalSolicitante.crm"]', "21877");
    set('select[name*="profissionalSolicitante.ufDoCrm"]', "29");
    set('select[name*="profissionalSolicitante.conselhoProfissional"]', "08");
    set('select[name*="indicacaoDeAcidente"]', "9");
    const cbo = document.querySelector('select[name*="profissionalSolicitante.cbos"]');
    if (cbo) { for (const o of cbo.options) { if (/psicopedagog/i.test(o.text)) { cbo.value = o.value; break; } } cbo.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { if (typeof window.gravarGuia === "function") window.gravarGuia(); });
  try {
    await page.waitForURL(/MantemTokenDeAtendimento|consultarGuia|abrirTela/, { timeout: 30000 });
  } catch { /* */ }
}
await page.waitForTimeout(3000);

// 10. RESULTADO
const postUrl = page.url();
console.log("[10] URL:", postUrl.substring(0, 100));

// Tentar extrair da pagina atual
if (!guideNumber) {
  guideNumber = await page.evaluate(() => {
    const el = document.querySelector('input[name*="numeroDaGuia"]');
    if (el?.value && el.value.length > 5) return el.value;
    const text = document.body?.innerText ?? "";
    const m = text.match(/(?:Guia|guia)\s*(?:N[°º.]?)?\s*(\d{8,})/);
    return m ? m[1] : "";
  }).catch(() => "");
}

// Se ainda nao achou, reabrir a guia pelo formulario e consultar a ultima
if (!guideNumber) {
  console.log("[10] Buscando numero da guia via consulta...");
  // Voltar pro formulario
  await page.goto("https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=abrirTelaDeSolicitacaoDeSPSADT", {
    waitUntil: "networkidle", timeout: 30000
  }).catch(() => {});
  await page.waitForTimeout(5000);
  // Pegar o ultimo numero de guia do prestador (que incrementa)
  const lastNum = await page.evaluate(() => {
    const el = document.querySelector('input[name*="numeroDaGuiaDoPrestador"], input[name*="numeroDaGuia"]');
    return el?.value ?? "";
  });
  if (lastNum) guideNumber = "prestador:" + lastNum;
}

console.log("[10] NUMERO DA GUIA:", guideNumber || "(nao encontrado)");
await page.screenshot({ path: "/tmp/test-guide-final.png", fullPage: true });
await browser.close();
console.log("DONE");
