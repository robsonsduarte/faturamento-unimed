const puppeteer = require('puppeteer-core');

async function sawLogin({ usuario, senha }) {
  console.log('[LOGIN] Fazendo login como:', usuario);
  let browser;

  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 1280, height: 720 });

    console.log('1. Acessando página de login...');
    await page.goto('https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForFunction(() => document.readyState === 'complete', {
      timeout: 10000
    }).catch(() => {});

    const jaEstaLogado = await page.evaluate(() => {
      return document.querySelector('#topoBarraPrincipal') !== null;
    });

    if (jaEstaLogado) {
      console.log('✓ Já estava logado!');
      const cookies = await page.cookies();
      await browser.close();
      return {
        success: true,
        method: 'already_logged',
        cookies: cookies,
        timestamp: new Date().toISOString()
      };
    }

    console.log('2. Preenchendo formulário...');
    await page.waitForSelector('#login', { visible: true, timeout: 15000 });
    await page.evaluate(() => {
      const loginField = document.querySelector('#login');
      if (loginField) loginField.value = '';
    });
    await page.click('#login');
    await page.type('#login', usuario, { delay: 100 });

    await page.waitForSelector('#password', { visible: true, timeout: 15000 });
    await page.evaluate(() => {
      const passwordField = document.querySelector('#password');
      if (passwordField) passwordField.value = '';
    });
    await page.click('#password');
    await page.type('#password', senha, { delay: 100 });

    console.log('3. Submetendo...');
    await page.waitForSelector('#submitForm', { visible: true, timeout: 15000 });

    const urlBeforeLogin = page.url();
    await page.click('#submitForm');

    try {
      await Promise.race([
        page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: 60000
        }),
        page.waitForFunction(
          (oldUrl) => window.location.href !== oldUrl,
          { timeout: 60000 },
          urlBeforeLogin
        )
      ]);
    } catch (navError) {
      console.log('Navegação rápida detectada');
    }

    await page.waitForFunction(() => document.readyState === 'complete', {
      timeout: 15000
    }).catch(() => {});

    console.log('4. Validando login...');

    let loginValidado = false;

    try {
      await page.waitForSelector('#topoBarraPrincipal', {
        visible: true,
        timeout: 15000
      });
      loginValidado = true;
      console.log('✓ Login validado via #topoBarraPrincipal');
    } catch (selectorError) {
      const urlPosLogin = page.url();
      console.log('URL pós-login:', urlPosLogin);

      loginValidado = !urlPosLogin.includes('Logar.do') &&
                      !urlPosLogin.includes('login.jsp');

      if (loginValidado) {
        console.log('✓ Login validado via mudança de URL');
      } else {
        console.log('✗ Login falhou - ainda na página de login');
      }
    }

    if (!loginValidado) {
      await browser.close();
      return { success: false, erro: 'Login falhou - verifique credenciais' };
    }

    console.log('✓ Login OK!');

    try {
      await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll('button, input[type="button"], a'));
        const botaoEntendi = botoes.find(btn =>
          btn.textContent.toLowerCase().includes('entendi') ||
          btn.textContent.toLowerCase().includes('ok') ||
          btn.textContent.toLowerCase().includes('confirmar')
        );
        if (botaoEntendi) {
          botaoEntendi.click();
          console.log('Popup fechado');
        }
      });

      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: 3000
      }).catch(() => {});
    } catch (popupError) {
      console.log('Sem popup para fechar');
    }

    const cookies = await page.cookies();
    console.log('5. Cookies:', cookies.length);

    await browser.close();
    return {
      success: true,
      method: 'fresh_login',
      cookies: cookies,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[LOGIN] Erro:', error.message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, erro: error.message };
  }
}

module.exports = sawLogin;
