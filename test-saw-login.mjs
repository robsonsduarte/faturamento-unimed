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

// Get credentials
const { data: cred } = await db.from("saw_credentials").select("*").eq("user_id", userId).eq("ativo", true).single();
if (!cred) { console.log("Sem credenciais"); process.exit(1); }

console.log("Login URL:", cred.login_url);
console.log("Usuario:", cred.usuario);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(cred.login_url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);

// Fill login
await page.fill('input[name="login"], input[id="login"]', cred.usuario);
await page.fill('input[type="password"]', cred.senha);
// Submit - tentar varias formas
try {
  await page.click('input[type="submit"], button[type="submit"]', { timeout: 3000 });
} catch {
  try {
    await page.click('input[value*="Entrar"], input[value*="Login"], button:has-text("Entrar")', { timeout: 3000 });
  } catch {
    // Fallback: submit form via JS
    await page.evaluate(() => document.forms[0]?.submit());
  }
}
await page.waitForTimeout(5000);

const cookies = await context.cookies();
console.log("Cookies:", cookies.length);

// Save session
await db.from("saw_sessions").insert({
  user_id: userId, cookies, valida: true,
  expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
});
console.log("Sessao salva!");

await browser.close();
console.log("DONE");
