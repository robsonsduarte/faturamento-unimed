const puppeteer = require('puppeteer-core');

/**
 * Busca XML/PDF de uma guia individual no SAW
 * Modelado a partir do processarLoteGuias.js (que funciona)
 *
 * SEM login — recebe cookies já validados pelo workflow.
 * Se sessão expirar, retorna sessaoExpirada: true pro workflow decidir.
 *
 * Recebe: { cookies, numeroGuia }
 * Retorna: { success, tipo, numeroGuia, chaveGuia, xmlContent?, pdfBase64? }
 *       ou { success: false, erro, numeroGuia, sessaoExpirada? }
 */
async function sawBuscarXml({ cookies, numeroGuia }) {
  console.log('[BUSCAR-XML] Guia:', numeroGuia);
  let browser;

  try {
    // Conectar ao Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1280, height: 720 });

    // ========== 1. INJETAR COOKIES ==========
    console.log('1. Injetando cookies...');
    await page.goto('https://saw.trixti.com.br', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    await page.setCookie(...cookies);

    // ========== 2. NAVEGAR PARA A GUIA ==========
    const urlGuia = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${numeroGuia}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`;

    console.log('2. Navegando para guia...');
    await page.goto(urlGuia, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Verificar sessão (igual processarLoteGuias.js)
    if (page.url().includes('login.jsp') || page.url().includes('Logar.do')) {
      await browser.close();
      return { success: false, erro: 'Sessão expirada', numeroGuia, sessaoExpirada: true };
    }

    await new Promise(r => setTimeout(r, 1500));

    // ========== 3. EXTRAIR CHAVE (modelado do processarLoteGuias.js) ==========
    console.log('3. Extraindo chave...');
    const info = await page.evaluate(() => {
      let chave = null;

      // Método 1: Input hidden (COM ASPAS no valor do atributo name!)
      const inp = document.querySelector('input[name="manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave"]');
      if (inp?.value) chave = inp.value;

      // Método 2: Link XML
      if (!chave) {
        const link = document.querySelector('a[href*="gerarXMLTISSDeGuia"]');
        if (link) {
          const m = link.href.match(/chave=(\d+)/);
          if (m) chave = m[1];
        }
      }

      // Método 3: Input numérico grande
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

    console.log('   Chave:', info.chave);

    // ========== 4. BAIXAR XML OU PDF (igual processarLoteGuias.js) ==========
    let resultado;

    if (info.temXML) {
      console.log('4. Baixando XML...');
      const urlXML = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=gerarXMLTISSDeGuia&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave=${info.chave}`;

      const xmlContent = await page.evaluate(async (url) => {
        const resp = await fetch(url, { credentials: 'include' });
        return await resp.text();
      }, urlXML);

      console.log('   ✓ XML:', xmlContent.length, 'bytes');
      resultado = {
        success: true,
        tipo: 'XML',
        numeroGuia,
        chaveGuia: info.chave,
        xmlContent
      };
    } else {
      console.log('4. Baixando PDF...');
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
        console.log('   ✓ PDF:', pdfData.size, 'bytes');
        resultado = {
          success: true,
          tipo: 'PDF',
          numeroGuia,
          chaveGuia: info.chave,
          pdfBase64: pdfData.base64
        };
      } else {
        resultado = { success: false, erro: 'Erro ao baixar PDF', numeroGuia };
      }
    }

    await browser.close();
    return resultado;

  } catch (error) {
    console.error('[BUSCAR-XML] Erro:', error.message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, erro: error.message, numeroGuia };
  }
}

module.exports = sawBuscarXml;
