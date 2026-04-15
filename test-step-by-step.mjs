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
page.setDefaultTimeout(60000);

// NAO auto-accept dialogs — vou lidar manualmente por step
const pendingDialogs = [];
page.on("dialog", async (dialog) => {
  console.log(`[DIALOG] ${dialog.type()}: ${dialog.message().substring(0, 120)}`);
  pendingDialogs.push(dialog);
});

// Helper para aceitar dialogs pendentes
async function acceptPendingDialogs() {
  for (const d of pendingDialogs) {
    try { await d.accept(); } catch { /* already handled */ }
  }
  pendingDialogs.length = 0;
}
async function dismissPendingDialogs() {
  for (const d of pendingDialogs) {
    try { await d.dismiss(); } catch { /* already handled */ }
  }
  pendingDialogs.length = 0;
}

// Login
console.log("Login...");
await page.goto(cred.login_url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);
await page.fill('input[name="login"], input[id="login"]', cred.usuario);
await page.fill('input[type="password"]', cred.senha);
await page.evaluate(() => document.forms[0]?.submit());
await page.waitForTimeout(5000);
await acceptPendingDialogs(); // limpar erros de jQuery do login

// Nova guia
console.log("Abrindo formulario...");
await page.goto("https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=abrirTelaDeSolicitacaoDeSPSADT", {
  waitUntil: "networkidle", timeout: 60000
});
await page.waitForTimeout(5000);
await acceptPendingDialogs();

// STEP 1: Preencher carteira e disparar busca
console.log("STEP 1: Preenchendo carteira 865-0024072786101...");
const unimedField = page.locator('input[name*="beneficiario.unimed.codigo"]').first();
await unimedField.fill("865");
await unimedField.press("Tab");
await page.waitForTimeout(1000);

const cartField = page.locator('input[name*="beneficiario.codigo"]').first();
await cartField.fill("0024072786101");
await page.waitForTimeout(500);

// Hook abrirProcessoBeneficiarioPresente para controlar fluxo
await page.evaluate(() => {
  window._bioStep = "waiting";
  window.abrirProcessoBeneficiarioPresente = function() {
    window._bioStep = "presenca_perguntada";
    // NAO fazer nada — esperar comando externo
  };
});

// Disparar busca AJAX
await page.evaluate(() => {
  window.operadoraPossuiTamanhoCodigoBenefVariavel = true;
  document.getElementById("acao")?.click();
});
console.log("Busca AJAX disparada, aguardando...");
await page.waitForTimeout(10000);

const step1 = await page.evaluate(() => ({
  nome: document.querySelector('input[name*="beneficiario.nome"]')?.value ||
    document.querySelector('input[name*="beneficiario.nomeAbreviado"]')?.value || "",
  bioStep: window._bioStep,
}));
console.log("Nome:", step1.nome);
console.log("Bio step:", step1.bioStep);

await page.screenshot({ path: "/tmp/step1.png", fullPage: true });
console.log("Screenshot: /tmp/step1.png");
console.log("STEP 1 DONE — verificar screenshot e me dizer proximo passo");

// Manter browser aberto para continuar
// Para continuar: rodar test-step2.mjs que conecta no mesmo browser
const wsEndpoint = browser.wsEndpoint?.() || "N/A";
console.log("Browser WS:", wsEndpoint);

// Esperar 5 minutos para interacao
console.log("Aguardando 5 minutos...");
await page.waitForTimeout(300000);
await browser.close();
