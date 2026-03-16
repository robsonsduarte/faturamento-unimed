const puppeteer = require('puppeteer-core');

async function sawLoginEBuscarXml({ usuario, senha, numeroGuia }) {
  console.log('[LOGIN+XML] Guia:', numeroGuia);
  let browser;

  try {
    // Conectar ao Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1280, height: 720 });

    // ========== 1. LOGIN ==========
    console.log('1. Acessando login...');
    await page.goto('https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const jaLogado = await page.evaluate(() => {
      return document.querySelector('#topoBarraPrincipal') !== null;
    });

    if (!jaLogado) {
      console.log('2. Fazendo login...');
      await page.waitForSelector('#login', { visible: true, timeout: 15000 });
      await page.evaluate(() => document.querySelector('#login').value = '');
      await page.type('#login', usuario, { delay: 30 });

      await page.waitForSelector('#password', { visible: true, timeout: 15000 });
      await page.evaluate(() => document.querySelector('#password').value = '');
      await page.type('#password', senha, { delay: 30 });

      await page.click('#submitForm');

      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.waitForSelector('#topoBarraPrincipal', { timeout: 30000 })
      ]).catch(() => {});

      const loginOk = await page.evaluate(() => {
        return document.querySelector('#topoBarraPrincipal') !== null;
      });

      if (!loginOk) {
        await browser.close();
        return { success: false, erro: 'Login falhou', numeroGuia };
      }

      // Fechar popup
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, a')).find(
          b => b.textContent.toLowerCase().includes('entendi')
        );
        if (btn) btn.click();
      }).catch(() => {});

      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('3. Login OK! Navegando para guia...');

    // ========== 2. BUSCAR GUIA ==========
    const urlGuia = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${numeroGuia}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`;

    await page.goto(urlGuia, { waitUntil: 'networkidle2', timeout: 30000 });

    if (page.url().includes('login.jsp')) {
      await browser.close();
      return { success: false, erro: 'Redirecionado para login', numeroGuia };
    }

    await new Promise(r => setTimeout(r, 2000));

    // ========== 3. EXTRAIR CHAVE ==========
    console.log('4. Extraindo chave...');
    const info = await page.evaluate(() => {
      let chave = null;

      const inp = document.querySelector('input[name="manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave"]');
      if (inp?.value) chave = inp.value;

      if (!chave) {
        const link = document.querySelector('a[href*="gerarXMLTISSDeGuia"]');
        if (link) {
          const m = link.href.match(/chave=(\d+)/);
          if (m) chave = m[1];
        }
      }

      if (!chave) {
        const inputs = document.querySelectorAll('input[type="hidden"]');
        for (const i of inputs) {
          if (i.value && /^\d{10,}$/.test(i.value)) {
            chave = i.value;
            break;
          }
        }
      }

      return { 
        chave, 
        temXML: document.querySelector('a[href*="gerarXMLTISSDeGuia"]') !== null
      };
    });

    if (!info.chave) {
      await browser.close();
      return { success: false, erro: 'Chave não encontrada', numeroGuia };
    }

    console.log('5. Chave:', info.chave);

    // ========== 4. BAIXAR XML/PDF ==========
    let resultado;

    if (info.temXML) {
      console.log('6. Baixando XML...');
      const urlXML = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=gerarXMLTISSDeGuia&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave=${info.chave}`;

      const xmlContent = await page.evaluate(async (url) => {
        const resp = await fetch(url, { credentials: 'include' });
        return await resp.text();
      }, urlXML);

      console.log('7. XML:', xmlContent.length, 'bytes');
      resultado = { success: true, tipo: 'XML', numeroGuia, chaveGuia: info.chave, xmlContent };
    } else {
      console.log('6. Baixando PDF...');
      const urlPDF = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=gerarRelatorioDeImpressaoDaGuia&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave=${info.chave}`;

      const pdfData = await page.evaluate(async (url) => {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          const blob = await resp.blob();
          const arr = await blob.arrayBuffer();
          const bytes = new Uint8Array(arr);
          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          return { ok: true, base64: btoa(bin), size: bytes.length };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, urlPDF);

      if (pdfData.ok) {
        resultado = { success: true, tipo: 'PDF', numeroGuia, chaveGuia: info.chave, pdfBase64: pdfData.base64 };
      } else {
        resultado = { success: false, erro: 'Erro PDF', numeroGuia };
      }
    }

    await browser.close();
    return resultado;

  } catch (error) {
    console.error('[LOGIN+XML] Erro:', error.message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, erro: error.message, numeroGuia };
  }
}

module.exports = sawLoginEBuscarXml;
