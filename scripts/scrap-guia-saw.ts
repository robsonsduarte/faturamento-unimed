/**
 * Script de automação para coleta de dados de guias no SAW/Trixti
 *
 * Uso:
 *   npx esbuild scripts/scrap-guia-saw.ts --bundle --platform=node --outfile=scripts/scrap-guia-saw.mjs --format=esm --external:playwright && node scripts/scrap-guia-saw.mjs <NUMERO_GUIA>
 *
 * Exemplos:
 *   node scripts/scrap-guia-saw.mjs 2382403304
 *   node scripts/scrap-guia-saw.mjs 2381695716
 *
 * O script persiste cookies em scripts/.saw-cookies.json para reaproveitar sessão.
 * Se a sessão expirou, refaz login automaticamente.
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Configuração ───────────────────────────────────────────────
const SAW_BASE = "https://saw.trixti.com.br/saw";
const LOGIN_URL = `${SAW_BASE}/Logar.do?method=abrirSAW`;
const TOKENIX_AUTHENTICATED_URL = `${SAW_BASE}/AutenticacaoTokenix.do`;

const USUARIO = process.env.SAW_USUARIO ?? "ddkr.faturamento";
const SENHA = process.env.SAW_SENHA ?? "020903*Lipe";

const SCRIPTS_DIR = path.dirname(new URL(import.meta.url).pathname);
const COOKIES_PATH = path.join(SCRIPTS_DIR, ".saw-cookies.json");

// Número da guia: argumento CLI > env var > default
const NUMERO_GUIA = process.argv[2] || process.env.NUMERO_GUIA || "2382403304";

const buildGuiaUrl = (numeroGuia: string): string =>
  `${SAW_BASE}/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${numeroGuia}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`;

// ─── Cookie Management ─────────────────────────────────────────
const saveCookies = async (context: BrowserContext): Promise<void> => {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), "utf-8");
  console.log(`  🍪 Cookies salvos (${cookies.length} cookies)`);
};

const loadCookies = async (context: BrowserContext): Promise<boolean> => {
  try {
    if (!fs.existsSync(COOKIES_PATH)) return false;
    const raw = fs.readFileSync(COOKIES_PATH, "utf-8");
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await context.addCookies(cookies);
    console.log(`  🍪 Cookies carregados (${cookies.length} cookies)`);
    return true;
  } catch {
    return false;
  }
};

// ─── Session Check ──────────────────────────────────────────────
// Acessa a URL de login: se inputs de usuario/senha NÃO aparecerem, sessão está ativa
const isSessionActive = async (page: Page): Promise<boolean> => {
  try {
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(1000);
    const hasLoginInputs = await page.evaluate(() => {
      const userInput = document.querySelector('input[id="login"], input[name="login"]');
      const passInput = document.querySelector('input[type="password"]');
      return !!(userInput && passInput);
    });
    // Se NÃO tem inputs de login → já está autenticado
    return !hasLoginInputs;
  } catch {
    return false;
  }
};

// ─── Helpers ────────────────────────────────────────────────────
async function extractTableData(page: Page): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  try {
    const tables = await page.$$("table");
    for (const table of tables) {
      const headers: string[] = [];
      const ths = await table.$$("th");
      for (const th of ths) {
        const text = (await th.textContent())?.trim() ?? "";
        if (text) headers.push(text);
      }
      const relevantHeaders = headers.filter((h) =>
        /c[oó]d|descri|quant|proced|exame|valor|tipo|grau|via/i.test(h)
      );
      if (relevantHeaders.length >= 2) {
        const trs = await table.$$("tbody tr, tr:not(:first-child)");
        for (const tr of trs) {
          const tds = await tr.$$("td");
          const row: Record<string, string> = {};
          for (let i = 0; i < tds.length && i < headers.length; i++) {
            const input = await tds[i].$("input");
            const select = await tds[i].$("select");
            let value = "";
            if (input) {
              value = (await input.inputValue()).trim();
            } else if (select) {
              const opt = await select.$("option:checked");
              value = opt ? (await opt.textContent())?.trim() ?? "" : "";
            } else {
              value = (await tds[i].textContent())?.trim() ?? "";
            }
            if (value) row[headers[i]] = value;
          }
          if (Object.keys(row).length > 0) rows.push(row);
        }
        if (rows.length > 0) break;
      }
    }
  } catch (err) {
    console.error("Erro ao extrair tabela:", err);
  }
  return rows;
}

// ─── Login Flow ─────────────────────────────────────────────────
async function doLogin(page: Page): Promise<void> {
  console.log("📋 Acessando página de login...");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  try {
    const userSelectors = [
      'input[name="login"]', 'input[name="usuario"]', 'input[name="user"]',
      'input[name="username"]', 'input[id="login"]', 'input[id="usuario"]',
      'input[type="text"]:first-of-type',
    ];
    const passSelectors = [
      'input[name="senha"]', 'input[name="password"]',
      'input[name="pass"]', 'input[type="password"]',
    ];

    for (const sel of userSelectors) {
      const el = await page.$(sel);
      if (el) { await el.fill(USUARIO); console.log(`  ✅ Usuário preenchido (${sel})`); break; }
    }
    for (const sel of passSelectors) {
      const el = await page.$(sel);
      if (el) { await el.fill(SENHA); console.log(`  ✅ Senha preenchida (${sel})`); break; }
    }

    const submitSelectors = [
      'input[type="submit"]', 'button[type="submit"]',
      "button:has-text('Entrar')", 'input[value="Entrar"]',
      'input[value="Login"]', 'input[value="Acessar"]',
    ];
    for (const sel of submitSelectors) {
      const el = await page.$(sel);
      if (el) { await el.click(); console.log(`  ✅ Formulário submetido (${sel})`); break; }
    }
  } catch {
    console.log("⚠️  Erro no preenchimento automático. Preencha manualmente.");
  }

  console.log("\n🔐 Aguardando autenticação TOKENIX...");
  console.log("   ➜ Complete a autenticação do token físico no navegador.");
  console.log("   ➜ O script continuará automaticamente após a autenticação.\n");

  try {
    await page.waitForURL(
      (url) => {
        const urlStr = url.toString();
        return (
          urlStr === TOKENIX_AUTHENTICATED_URL ||
          urlStr === `${TOKENIX_AUTHENTICATED_URL}#` ||
          (!urlStr.includes("AutenticacaoTokenix") &&
            !urlStr.includes("Logar.do") &&
            urlStr.includes("saw.trixti.com.br"))
        );
      },
      { timeout: 300_000 }
    );
    console.log("✅ Autenticação TOKENIX concluída!");
  } catch {
    console.log("⏰ Timeout na autenticação. Tentando continuar mesmo assim...");
  }

  await page.waitForTimeout(2000);
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log(`🚀 Iniciando scraping da guia ${NUMERO_GUIA}...`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // ── Step 1: Verificar sessão existente ──
  const hasCookies = await loadCookies(context);
  let needsLogin = true;

  if (hasCookies) {
    console.log("🔍 Verificando se a sessão anterior ainda está ativa...");
    const active = await isSessionActive(page);
    if (active) {
      console.log("✅ Sessão ativa! Reaproveitando cookies.\n");
      needsLogin = false;
    } else {
      console.log("⚠️  Sessão expirada. Refazendo login...\n");
    }
  } else {
    console.log("ℹ️  Nenhum cookie salvo. Iniciando login...\n");
  }

  if (needsLogin) {
    await doLogin(page);
    await saveCookies(context);
  }

  // ── Step 2: Acessar a guia ──
  const guiaUrl = buildGuiaUrl(NUMERO_GUIA);
  console.log(`\n📄 Acessando guia ${NUMERO_GUIA}...`);
  await page.goto(guiaUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Verifica se caiu na tela de login (sessão expirou)
  const hasLoginAfterGuia = await page.evaluate(() => {
    const u = document.querySelector('input[id="login"], input[name="login"]');
    const p = document.querySelector('input[type="password"]');
    return !!(u && p);
  });
  if (hasLoginAfterGuia) {
    console.log("⚠️  Sessão expirou ao acessar a guia. Refazendo login...");
    await doLogin(page);
    await saveCookies(context);
    await page.goto(guiaUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  // ── Step 3: Coletar dados ──
  console.log("🔍 Coletando dados da guia...\n");

  const allFields = await page.evaluate(() => {
    const fields: Record<string, string> = {};
    document.querySelectorAll("input").forEach((input) => {
      const name = input.name || input.id;
      if (name && input.value) fields[name] = input.value;
    });
    document.querySelectorAll("select").forEach((select) => {
      const name = select.name || select.id;
      if (name) {
        const opt = select.options[select.selectedIndex];
        if (opt) fields[name] = `${opt.value} - ${opt.text}`.trim();
      }
    });
    document.querySelectorAll("textarea").forEach((ta) => {
      const name = ta.name || ta.id;
      if (name && ta.value) fields[name] = ta.value;
    });
    document.querySelectorAll("span[id], label[id], td[id]").forEach((el) => {
      const id = (el as HTMLElement).id;
      const text = el.textContent?.trim();
      if (id && text) fields[`span_${id}`] = text;
    });
    return fields;
  });

  // Mapeamento DIRETO baseado nos nomes reais dos campos do SAW/TISS
  const PREFIX = "manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO";
  const directMap: Record<string, string> = {
    "2-Nº guia no prestador": `${PREFIX}.numeroDaGuiaDoPrestador`,
    "3-Nº guia principal": `${PREFIX}.numeroDaGuia`,
    "4-Data da Autorização": `${PREFIX}.dataDaAutorizacao`,
    "5-Senha": `${PREFIX}.senha`,
    "6-Data Validade da Senha": `${PREFIX}.dataDeValidadeDaSenha`,
    "8-Número da Carteira": `${PREFIX}.beneficiario.codigo`,
    "10-Nome": `${PREFIX}.beneficiario.nome`,
    "21-Caráter do Atendimento": `${PREFIX}.caraterDeSolicitacao`,
    "27-Regime de Atendimento": `${PREFIX}.regimeDeAtendimento`,
    Status: `${PREFIX}.statusDaGuia`,
  };

  const result: Record<string, string> = {};
  for (const [label, fieldName] of Object.entries(directMap)) {
    if (allFields[fieldName]) {
      result[label] = allFields[fieldName];
    }
  }

  // Campos do DOM via innerText (mais confiável que navegar TDs)
  const pageInnerText = await page.evaluate(() => document.body.innerText || "");

  // Extrai valor após label usando innerText (label e valor separados por \n ou \t)
  const extractAfterLabel = (text: string, labelRegex: RegExp, stopRegex?: RegExp): string => {
    const match = labelRegex.exec(text);
    if (!match) return "";
    const after = text.substring(match.index + match[0].length).trim();
    const lines = after.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return "";
    let val = lines[0];
    // Se o stopRegex bate no val, é o próximo label, não o valor
    if (stopRegex && stopRegex.test(val)) return "";
    return val;
  };

  const textFields: Record<string, string> = {
    "15-Nome do Profissional Solicitante": extractAfterLabel(
      pageInnerText, /15-Nome do Profissional Solicitante\s*/i, /^\d+-/
    ),
    "16-Conselho Profissional": extractAfterLabel(
      pageInnerText, /16-Conselho Profissional\s*/i, /^\d+-/
    ),
    "17-Número no Conselho": extractAfterLabel(
      pageInnerText, /17-N[uú]mero no Conselho\s*/i, /^\d+-/
    ),
    "18-UF": extractAfterLabel(
      pageInnerText, /18-UF\s*/i, /^\d+-/
    ),
    "19-Código CBO": extractAfterLabel(
      pageInnerText, /19-C[oó]digo CBO\s*/i, /^\d+-|Dados da Solicita/
    ),
    "23-Indicação Clínica": extractAfterLabel(
      pageInnerText, /23-Indica[cç][aã]o Cl[ií]nica\s*/i, /^\d+-|90-/
    ),
  };

  for (const [k, v] of Object.entries(textFields)) {
    if (v && v.trim() !== "") {
      result[k] = v;
    }
  }

  // ── Step 4: Coletar procedimentos/exames ──
  let procedimentos = await extractTableData(page);

  // Fallback: extrai procedimentos do DOM se extractTableData não encontrou
  if (procedimentos.length === 0) {
    const domProcs = await page.evaluate(() => {
      const rows: string[][] = [];
      const tables = document.querySelectorAll("table");
      for (const table of tables) {
        for (const row of table.querySelectorAll("tr")) {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 5) {
            const cellTexts = Array.from(cells).map((c) => {
              const inp = c.querySelector("input");
              return inp ? inp.value?.trim() : c.textContent?.trim() ?? "";
            });
            const hasCode = cellTexts.some((t) => /^\d{7,10}$/.test(t));
            const hasDesc = cellTexts.some((t) => t.length > 10 && /[A-Z]{3,}/i.test(t));
            if (hasCode && hasDesc) rows.push(cellTexts);
          }
        }
      }
      return rows;
    });
    for (const cells of domProcs) {
      procedimentos.push(
        Object.fromEntries(cells.map((c: string, i: number) => [`col_${i}`, c]))
      );
    }
  }

  // Extrair dados do procedimento solicitado (primeiro item) e contar realizados (demais)
  if (procedimentos.length > 0) {
    const solicitado = procedimentos[0];
    const vals = Object.values(solicitado);
    // Código: valor numérico de 7-10 dígitos
    for (const v of vals) {
      if (/^\d{7,10}$/.test(v)) { result["25-Código"] = v; break; }
    }
    // Descrição: texto longo com letras maiúsculas, excluindo "TUSS"
    for (const v of vals) {
      if (v.length > 15 && /[A-Z]{3,}/.test(v) && !/TUSS/.test(v)) { result["26-Descrição"] = v; break; }
    }
    // Qt. Autoriz e Qt. Solic: números pequenos (1-3 dígitos)
    const nums = vals.filter((v) => /^\d{1,3}$/.test(v));
    if (nums.length >= 2) {
      result["27-Qt. Solic."] = nums[0];
      result["28-Qt. Autoriz."] = nums[1];
    } else if (nums.length === 1) {
      result["28-Qt. Autoriz."] = nums[0];
    }
    // Status do procedimento
    const statusVal = vals.find((v) => /AUTORIZADO|NEGADO|PENDENTE|CANCELADO/i.test(v));
    if (statusVal) result["Status Procedimento"] = statusVal.trim();

    // Realizados: todos os itens após o primeiro (têm padrão de data no col_0)
    const realizados = procedimentos.filter((p, i) => i > 0 && /\d{2}\/\d{2}\/\d{4}/.test(Object.values(p)[0] ?? ""));
    result["Qt. Realizados"] = String(realizados.length);
  } else {
    result["Qt. Realizados"] = "0";
  }

  // ── Step 5: Verificar presença de "Check-in" na página ──
  const checkInInfo = await page.evaluate(() => {
    const bodyText = document.body.innerText || "";
    const bodyHtml = document.body.innerHTML || "";

    const hasCheckInText = /check[-\s]?in/i.test(bodyText);
    const hasCheckInHtml = /check[-\s]?in/i.test(bodyHtml);

    // Coleta contexto ao redor do "Check-in"
    const matches: string[] = [];
    if (hasCheckInText) {
      const regex = /(.{0,60}check[-\s]?in.{0,60})/gi;
      let m;
      while ((m = regex.exec(bodyText)) !== null) {
        matches.push(m[1].trim());
      }
    }

    // Procura botões/links de Check-in
    const checkInElements: string[] = [];
    document.querySelectorAll("a, button, input, span, td, div").forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      const value = (el as HTMLInputElement).value ?? "";
      if (/check[-\s]?in/i.test(text) || /check[-\s]?in/i.test(value)) {
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id || "";
        const name = (el as HTMLInputElement).name || "";
        const cls = (el as HTMLElement).className || "";
        checkInElements.push(
          `<${tag}${id ? ` id="${id}"` : ""}${name ? ` name="${name}"` : ""}${cls ? ` class="${cls}"` : ""}> → "${text || value}"`
        );
      }
    });

    return { hasCheckInText, hasCheckInHtml, matches, checkInElements };
  });

  // ── Step 6: Screenshot & Debug ──
  const screenshotPath = path.join(SCRIPTS_DIR, `guia-${NUMERO_GUIA}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 10_000 });
    console.log(`📸 Screenshot salvo: ${screenshotPath}`);
  } catch {
    console.log("⚠️  Screenshot falhou (timeout de fontes). Continuando...");
  }

  const debugPath = path.join(SCRIPTS_DIR, `guia-${NUMERO_GUIA}-debug.json`);
  fs.writeFileSync(
    debugPath,
    JSON.stringify({ allFields, result, procedimentos, checkInInfo }, null, 2),
    "utf-8"
  );
  console.log(`🔧 Debug JSON salvo: ${debugPath}`);

  // Salvar cookies atualizados
  await saveCookies(context);

  // ── Step 7: Output ──
  console.log("\n" + "═".repeat(60));
  console.log(`  GUIA SPSADT — ${NUMERO_GUIA}`);
  console.log("═".repeat(60));

  for (const [label, value] of Object.entries(result)) {
    console.log(`  ${label}: ${value}`);
  }

  if (Object.keys(result).length === 0) {
    console.log("\n⚠️  Nenhum campo mapeado automaticamente.");
    console.log(`   Campos encontrados na página: ${Object.keys(allFields).length}`);
  }

  // ── Step 8: Check-in ──
  console.log("\n" + "─".repeat(60));
  console.log("  CHECK-IN");
  console.log("─".repeat(60));

  if (checkInInfo.hasCheckInText || checkInInfo.hasCheckInHtml) {
    console.log("  ✅ 'Check-in' ENCONTRADO na guia!");
    if (checkInInfo.matches.length > 0) {
      console.log("  Contexto:");
      for (const match of checkInInfo.matches) {
        console.log(`    → ${match}`);
      }
    }
    if (checkInInfo.checkInElements.length > 0) {
      console.log("  Elementos:");
      for (const el of checkInInfo.checkInElements) {
        console.log(`    → ${el}`);
      }
    }
  } else {
    console.log("  ❌ 'Check-in' NÃO encontrado na guia.");
  }

  console.log("\n" + "═".repeat(60));

  // Salva resultado final
  const outputPath = path.join(SCRIPTS_DIR, `guia-${NUMERO_GUIA}-resultado.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      { guia: NUMERO_GUIA, campos: result, procedimentos, checkIn: checkInInfo },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\n💾 Resultado salvo: ${outputPath}`);

  console.log("\n⏳ Navegador ficará aberto por 15s para inspeção...");
  await page.waitForTimeout(15_000);

  await browser.close();
  console.log("\n✅ Concluído!");
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
