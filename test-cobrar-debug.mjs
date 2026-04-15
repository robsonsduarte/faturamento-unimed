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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(30000);

page.on("dialog", async (d) => {
  console.log(`[DIALOG] ${d.type()}: ${d.message().substring(0, 100)}`);
  await d.accept();
});

// Login com ddkr.faturamento
console.log("[0] Login ddkr.faturamento...");
await page.goto("https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.fill('input[name="login"], input[id="login"]', "cnu.robson.duarte");
await page.fill('input[type="password"]', "VaiTomarNaqueleLugar#123");
// Tentar submit de varias formas
try {
  await page.click('button[type="submit"], input[type="submit"], .btn-login, button:has-text("Entrar")', { timeout: 3000 });
} catch {
  await page.evaluate(() => document.forms[0]?.submit());
}
await page.waitForTimeout(5000);
const loginUrl = page.url();
const loginText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) ?? "");
console.log("[0] URL pos-login:", loginUrl.substring(0, 80));
console.log("[0] Texto:", loginText.substring(0, 100));
await page.screenshot({ path: "/tmp/cobrar-0-login.png" });

// Abrir guia
console.log("[1] Abrindo guia 2378808227...");
await page.goto("https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=2378808227&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true", {
  waitUntil: "networkidle", timeout: 30000
});
await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/cobrar-1-guia.png", fullPage: true });

// Verificar botoes Realizar
const realizarBtns = await page.$$('img[title*="Realizar"]');
console.log(`[1] Botoes Realizar: ${realizarBtns.length}`);

// Listar todos os botoes com title contendo "Realizar"
const btnInfo = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img[title*="Realizar"]'));
  return imgs.map((img, i) => ({
    index: i,
    title: img.getAttribute("title"),
    src: img.getAttribute("src")?.substring(0, 50),
    parentTag: img.parentElement?.tagName,
    parentHref: img.parentElement?.getAttribute("href")?.substring(0, 80),
    parentOnclick: img.parentElement?.getAttribute("onclick")?.substring(0, 80),
  }));
});
console.log("[1] Botoes Realizar detalhes:");
btnInfo.forEach(b => console.log(`  [${b.index}] title="${b.title}" parent=${b.parentTag} href=${b.parentHref} onclick=${b.parentOnclick}`));

// Clicar no primeiro botao "Realizar" da tabela de procedimentos
console.log("[2] Clicando no botao Realizar...");
if (realizarBtns.length >= 2) {
  await realizarBtns[1].click();
  console.log("[2] Clicou no [1] (segundo botao)");
} else if (realizarBtns.length === 1) {
  await realizarBtns[0].click();
  console.log("[2] Clicou no [0] (unico botao)");
} else {
  console.log("[2] NENHUM botao Realizar encontrado!");
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(5000);
await page.screenshot({ path: "/tmp/cobrar-2-apos-realizar.png", fullPage: true });

// Verificar iframe BioFace
const bioFrame = await page.$('iframe#iframeBioFacial, iframe[src*="bioface"]');
const bioSrc = bioFrame ? await bioFrame.getAttribute("src") : null;
console.log("[3] BioFace iframe:", bioSrc ? bioSrc.substring(0, 80) : "NAO ENCONTRADO");

// Verificar se o form de realizacao abriu
const pages = context.pages();
console.log("[3] Paginas abertas:", pages.length, pages.map(p => p.url().substring(0, 80)));

// Verificar se tem form na pagina principal
const hasFormInPage = await page.evaluate(() => {
  const el = document.getElementById('dataSolicitacaoProcedimento');
  return !!el;
});
console.log("[3] Form na pagina principal:", hasFormInPage);

// Procurar form em todas as paginas
for (const p of pages) {
  const url = p.url();
  if (url.includes("RealizarProcedimento") || url.includes("abrirTelaDeRealizarProcedimento")) {
    console.log("[3] Form encontrado em:", url.substring(0, 80));
    await p.screenshot({ path: "/tmp/cobrar-3-form.png" });
  }
}

// Se BioFace existe, tentar injetar foto
if (bioFrame) {
  console.log("[4] Injetando foto no BioFace...");

  // Buscar foto do paciente
  const { data: foto } = await db.from("biometria_fotos").select("photo_path").eq("numero_carteira", "8650003156173540").limit(1).single();

  if (foto) {
    console.log("[4] Foto path:", foto.photo_path);
    const { data: blob } = await db.storage.from("biometria").download(foto.photo_path);
    if (blob) {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const b64 = buffer.toString("base64");
      console.log("[4] Foto base64:", b64.length, "chars");

      const frame = await bioFrame.contentFrame();
      if (frame) {
        await frame.evaluate((photoB64) => {
          const results = document.getElementById("results");
          if (results) {
            results.innerHTML = '<img id="id-imagem-resultado" width="565px" height="317px" src="data:image/jpeg;base64,' + photoB64 + '"/>';
          }
          const btn = document.getElementById("id-botao-autenticar");
          if (btn) {
            btn.style.display = "inline-block";
            btn.style.visibility = "visible";
          }
        }, b64);

        await page.waitForTimeout(1000);

        // Clicar autenticar
        await frame.evaluate(() => {
          const btn = document.getElementById("id-botao-autenticar");
          if (btn) btn.click();
          if (typeof window.aut === "function") window.aut();
        });

        console.log("[4] Foto injetada e autenticar clicado");
        await page.waitForTimeout(5000);
        await page.screenshot({ path: "/tmp/cobrar-4-apos-bio.png", fullPage: true });
      } else {
        console.log("[4] Frame nao acessivel");
      }
    } else {
      console.log("[4] Foto nao encontrada no storage");
    }
  } else {
    console.log("[4] Nenhuma foto no banco para esse paciente");
  }
}

// Verificar estado final
const finalPages = context.pages();
console.log("[5] Paginas finais:", finalPages.length);
for (const p of finalPages) {
  const url = p.url();
  console.log("  ", url.substring(0, 80));
  const hasForm = await p.evaluate(() => !!document.getElementById("dataSolicitacaoProcedimento")).catch(() => false);
  if (hasForm) {
    console.log("  → TEM FORM DE REALIZACAO!");
    await p.screenshot({ path: "/tmp/cobrar-5-form-final.png" });

    // Dump campos do form
    const campos = await p.evaluate(() => {
      const ids = ["dataSolicitacaoProcedimento", "horarioInicial", "horarioFinal", "quantidadeSolicitada", "viaDeAcesso"];
      return ids.map(id => {
        const el = document.getElementById(id);
        return { id, exists: !!el, value: el?.value ?? "", type: el?.tagName ?? "" };
      });
    });
    console.log("  Campos:", JSON.stringify(campos));
  }
}

await page.screenshot({ path: "/tmp/cobrar-final.png", fullPage: true });
await browser.close();
console.log("DONE");
