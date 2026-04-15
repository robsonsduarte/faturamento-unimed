import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

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

// Capturar dialogs mas NAO aceitar automaticamente — esperar
const dialogs = [];
page.on("dialog", async (dialog) => {
  const msg = dialog.message();
  console.log(`[DIALOG] ${dialog.type()}: ${msg.substring(0, 100)}`);
  dialogs.push({ type: dialog.type(), msg });

  // "Presente no local?" → SIM (accept)
  if (/presente.*local|local.*atendimento/i.test(msg)) {
    console.log("  -> SIM (presente)");
    await dialog.accept();
    return;
  }
  // "Pre-autorizacao?" → SIM
  if (/pr[eé].?autoriz/i.test(msg)) {
    console.log("  -> SIM (pre-autorizacao)");
    await dialog.accept();
    return;
  }
  // Problemas validar carteirinha → aceitar e continuar
  if (/problemas.*validar|validar.*carteirinha/i.test(msg)) {
    await dialog.accept();
    return;
  }
  // Default
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

// Preencher carteira
console.log("[2] Carteira...");
const unimedField = page.locator('input[name*="beneficiario.unimed.codigo"]').first();
await unimedField.fill("865");
await unimedField.press("Tab");
await page.waitForTimeout(2000);

const cartField = page.locator('input[name*="beneficiario.codigo"]').first();
await cartField.fill("0024072786101");
await cartField.press("Tab");
await page.waitForTimeout(5000);

// Verificar se dialogs nativos apareceram
console.log("[2] Dialogs capturados:", dialogs.length);
dialogs.forEach((d, i) => console.log(`  ${i}: ${d.type} — ${d.msg.substring(0, 80)}`));

// Verificar se modal HTML de biometria apareceu
const bioModalHtml = await page.evaluate(() => {
  // Procurar divs visiveis com texto sobre biometria
  const allDivs = document.querySelectorAll("div, fieldset");
  for (const div of allDivs) {
    if (div.offsetHeight > 0 && /biometria|pular.*autentic|autenticar.*paciente/i.test(div.textContent ?? "")) {
      if (div.innerHTML.length < 5000) return div.outerHTML;
      return div.innerHTML.substring(0, 3000);
    }
  }
  return "NAO ENCONTRADA";
});
console.log("[2] Modal biometria HTML:", bioModalHtml.substring(0, 500));

// Dump TODAS as divs visiveis com classe "motivo" ou similar (SAW usa classes como modal)
const visibleModals = await page.evaluate(() => {
  const results = [];
  const divs = document.querySelectorAll("div[class*=motivo], div[class*=modal], div[class*=dialog], div[id*=div][style*=display]");
  for (const d of divs) {
    if (d.offsetHeight > 50) {
      results.push({ id: d.id, cls: d.className?.substring(0, 50), text: d.textContent?.trim().substring(0, 100), display: d.style.display });
    }
  }
  return results;
});
console.log("[2] Divs visiveis:", JSON.stringify(visibleModals, null, 2));

// Verificar presencaBeneficiario div
const presencaDiv = await page.evaluate(() => {
  const el = document.getElementById("divPresencaBeneficiario") ||
    document.getElementById("divBiometriaFacial") ||
    document.getElementById("divConfirmacaoPresenca");
  if (el) return { id: el.id, display: el.style.display, html: el.innerHTML.substring(0, 1000) };

  // Buscar por texto
  const all = document.querySelectorAll("div");
  for (const d of all) {
    if (d.offsetHeight > 0 && /Confirma.*Presen|biometria facial/i.test(d.textContent ?? "")) {
      return { id: d.id, display: d.style.display, html: d.outerHTML.substring(0, 1000) };
    }
  }
  return null;
});
console.log("[2] Presenca div:", JSON.stringify(presencaDiv)?.substring(0, 500));

await page.screenshot({ path: "/tmp/test-map-bio.png", fullPage: true });

// Salvar HTML completo pra analise
const fullHtml = await page.evaluate(() => document.documentElement.outerHTML);
writeFileSync("/tmp/saw-new-guide-after-carteira.html", fullHtml);
console.log("[2] HTML salvo em /tmp/saw-new-guide-after-carteira.html (" + fullHtml.length + " bytes)");

await browser.close();
console.log("DONE");
