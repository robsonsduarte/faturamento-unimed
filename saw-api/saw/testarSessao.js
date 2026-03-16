const puppeteer = require('puppeteer-core');

async function sawTestarSessao({ cookies }) {
  console.log('[TESTAR-SESSAO] Verificando sessão...');
  let browser;

  try {
    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return { success: false, valida: false, erro: 'Cookies não fornecidos' };
    }

    // Conectar ao Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    console.log('1. Navegando para domínio SAW...');
    await page.goto('https://saw.trixti.com.br', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('2. Setando cookies...');
    await page.setCookie(...cookies);

    console.log('3. Testando acesso...');
    await page.goto('https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW', {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const estaLogado = await page.evaluate(() => {
      return document.querySelector('#topoBarraPrincipal') !== null;
    });

    await browser.close();

    console.log('[TESTAR-SESSAO] Válida:', estaLogado);
    return { success: true, valida: estaLogado };

  } catch (error) {
    console.error('[TESTAR-SESSAO] Erro:', error.message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, valida: false, erro: error.message };
  }
}

module.exports = sawTestarSessao;
