import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const guideNumber = process.argv[2] || "2384176271";

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
page.on("dialog", async (d) => { await d.accept(); });

// Login
console.log("Login...");
await page.goto(cred.login_url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);
await page.fill('input[name="login"], input[id="login"]', cred.usuario);
await page.fill('input[type="password"]', cred.senha);
await page.evaluate(() => document.forms[0]?.submit());
await page.waitForTimeout(5000);

// Abrir guia
console.log(`Abrindo guia ${guideNumber}...`);
const guiaUrl = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${guideNumber}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`;
await page.goto(guiaUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(5000);

// Extrair dados
const guiaData = await page.evaluate(() => {
  const get = (name) => {
    const el = document.querySelector(`input[name*="${name}"], select[name*="${name}"], textarea[name*="${name}"]`);
    return el?.value?.trim() ?? "";
  };
  return {
    guide_number: get("numeroDaGuia"),
    paciente: get("beneficiario.nome") || get("beneficiario.nomeAbreviado"),
    numero_carteira: get("beneficiario.codigo"),
    numero_carteira_unimed: get("beneficiario.unimed.codigo"),
    senha: get("senha"),
    data_autorizacao: get("dataDaAutorizacao"),
    data_validade_senha: get("dataDeValidadeDaSenha"),
    profissional: get("profissionalSolicitante.nome"),
    tipo_atendimento: get("tipoDeAtendimento"),
    indicacao_clinica: get("indicacaoClinica"),
    procedimento_codigo: get("procedimentosSolicitados[0].codigo"),
    procedimento_descricao: get("procedimentosSolicitados[0].descricao"),
    quantidade_solicitada: get("procedimentosSolicitados[0].quantidade"),
    quantidade_autorizada: get("procedimentosSolicitados[0].quantidadeAutorizada"),
    contratado_executante: get("contratadoExecutante.nome"),
    cnes: get("contratadoExecutante.cnes"),
  };
});

console.log("Dados:", JSON.stringify(guiaData, null, 2));

// Salvar no Supabase
const carteira = guiaData.numero_carteira_unimed
  ? `${guiaData.numero_carteira_unimed}${guiaData.numero_carteira}`
  : guiaData.numero_carteira;

// Converter datas DD/MM/YYYY → YYYY-MM-DD
const parseDate = (d) => {
  if (!d) return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// guide_number da operadora é o que passamos, nao o do prestador
const { data: inserted, error: insertErr } = await db.from("guias").upsert({
  guide_number: guideNumber,
  guide_number_prestador: guiaData.guide_number || null,
  paciente: guiaData.paciente,
  numero_carteira: carteira,
  senha: guiaData.senha || null,
  data_autorizacao: parseDate(guiaData.data_autorizacao),
  data_validade_senha: parseDate(guiaData.data_validade_senha),
  nome_profissional: guiaData.profissional || null,
  tipo_atendimento: guiaData.tipo_atendimento || null,
  indicacao_clinica: guiaData.indicacao_clinica || null,
  quantidade_solicitada: parseInt(guiaData.quantidade_solicitada) || 0,
  quantidade_autorizada: parseInt(guiaData.quantidade_autorizada) || 0,
  cnes: guiaData.cnes || null,
  status: "PENDENTE",
  tipo_guia: "Local",
  user_id: userId,
}, { onConflict: "guide_number" }).select("id").single();

if (insertErr) {
  console.log("ERRO:", insertErr.message);
} else {
  console.log("Guia importada! ID:", inserted?.id);
}

await browser.close();
console.log("DONE");
