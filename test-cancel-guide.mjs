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
page.on("dialog", async (d) => {
  console.log(`DIALOG: ${d.type()}: ${d.message().substring(0, 120)}`);
  await d.accept();
});

// Login
await page.goto(cred.login_url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);
await page.fill('input[name="login"], input[id="login"]', cred.usuario);
await page.fill('input[type="password"]', cred.senha);
await page.evaluate(() => document.forms[0]?.submit());
await page.waitForTimeout(5000);
console.log("Login OK");

const guiasToCancel = ["1046700", "1046699"];

for (const guiaNum of guiasToCancel) {
  console.log(`\n=== Cancelando guia Nr Prestador ${guiaNum} ===`);

  // Abrir formulario
  await page.goto("https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=abrirTelaDeSolicitacaoDeSPSADT", {
    waitUntil: "networkidle", timeout: 60000
  });
  await page.waitForTimeout(5000);

  // Consultar guia pelo campo "numeroDaGuiaParaConsulta"
  const consultaField = page.locator('input[name="numeroDaGuiaParaConsulta"]');
  await consultaField.fill(guiaNum);
  await consultaField.press("Enter");
  await page.waitForTimeout(5000);

  const url = page.url();
  const text = await page.evaluate(() => document.body?.innerText?.substring(0, 200) ?? "");
  console.log("URL:", url.substring(0, 80));
  console.log("Texto:", text.substring(0, 150));

  // Verificar se carregou a guia
  const guideNumber = await page.evaluate(() => {
    const el = document.querySelector('input[name*="numeroDaGuia"]');
    return el?.value ?? "";
  });
  console.log("Numero guia:", guideNumber || "(vazio)");

  // Verificar se tem botao cancelar
  const hasCancelar = await page.evaluate(() => {
    const el = document.getElementById("linkCancelarGuia");
    return el ? el.style.display !== "none" : false;
  });
  console.log("Botao cancelar visivel:", hasCancelar);

  if (hasCancelar) {
    // Clicar cancelar
    console.log("Clicando mostrarDivParaCancelarGuia()...");
    await page.evaluate(() => {
      if (typeof window.mostrarDivParaCancelarGuia === "function") {
        window.mostrarDivParaCancelarGuia();
      }
    });
    await page.waitForTimeout(3000);

    // Procurar modal de cancelamento e confirmar
    const cancelModal = await page.evaluate(() => document.body?.innerText?.substring(0, 500) ?? "");
    console.log("Modal:", cancelModal.substring(0, 200));

    // Clicar confirmar cancelamento
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=button], a"));
      const confirm = btns.find(b =>
        /confirmar.*cancel|cancelar.*guia|sim.*cancel/i.test(b.textContent ?? b.value ?? "")
      );
      if (confirm) { confirm.click(); return; }
      // Tentar funcao JS
      if (typeof window.cancelarGuia === "function") window.cancelarGuia();
      if (typeof window.confirmarCancelamento === "function") window.confirmarCancelamento();
    });
    await page.waitForTimeout(5000);

    const resultText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) ?? "");
    console.log("Resultado:", resultText.substring(0, 150));
  } else {
    console.log("Botao cancelar NAO disponivel");
  }

  await page.screenshot({ path: `/tmp/test-cancel-${guiaNum}.png` });
}

await browser.close();
console.log("\nDONE");
