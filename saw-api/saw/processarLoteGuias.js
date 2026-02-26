const puppeteer = require('puppeteer-core');

async function sawProcessarLoteGuias({ cookies, guias }) {
  console.log('[LOTE] Processando', guias.length, 'guias');
  let browser;
  const resultados = [];

  try {
    // Conectar ao Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1280, height: 720 });

    // Injetar cookies
    console.log('1. Injetando cookies...');
    await page.goto('https://saw.trixti.com.br', { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    await page.setCookie(...cookies);

    // Verificar se sessão é válida
    await page.goto('https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const sessaoValida = await page.evaluate(() => {
      return document.querySelector('#topoBarraPrincipal') !== null;
    });

    if (!sessaoValida) {
      await browser.close();
      return { success: false, erro: 'Sessão expirada - faça login novamente', resultados: [] };
    }

    console.log('✓ Sessão válida! Processando guias...\n');

    // Processar cada guia
    for (let i = 0; i < guias.length; i++) {
      const numeroGuia = String(guias[i]);
      console.log(`[${i + 1}/${guias.length}] Guia: ${numeroGuia}`);

      try {
        const urlGuia = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${numeroGuia}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`;

        await page.goto(urlGuia, { waitUntil: 'networkidle2', timeout: 30000 });

        // Verificar sessão
        if (page.url().includes('login.jsp') || page.url().includes('Logar.do')) {
          console.log('  ⚠ Sessão expirou durante processamento');
          resultados.push({ numeroGuia, success: false, erro: 'Sessão expirou' });
          break; // Para o lote se sessão expirar
        }

        await new Promise(r => setTimeout(r, 1500));

        // Extrair chave
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
          console.log('  ✗ Chave não encontrada');
          resultados.push({ numeroGuia, success: false, erro: 'Chave não encontrada' });
          continue;
        }

        // Baixar XML ou PDF
        if (info.temXML) {
          const urlXML = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=gerarXMLTISSDeGuia&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave=${info.chave}`;

          const xmlContent = await page.evaluate(async (url) => {
            const resp = await fetch(url, { credentials: 'include' });
            return await resp.text();
          }, urlXML);

          console.log('  ✓ XML:', xmlContent.length, 'bytes');
          resultados.push({ numeroGuia, success: true, tipo: 'XML', chaveGuia: info.chave, xmlContent });
        } else {
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
            console.log('  ✓ PDF:', pdfData.size, 'bytes');
            resultados.push({ numeroGuia, success: true, tipo: 'PDF', chaveGuia: info.chave, pdfBase64: pdfData.base64 });
          } else {
            resultados.push({ numeroGuia, success: false, erro: 'Erro PDF' });
          }
        }

        // Delay entre guias
        if (i < guias.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }

      } catch (guiaError) {
        console.log('  ✗ Erro:', guiaError.message);
        resultados.push({ numeroGuia, success: false, erro: guiaError.message });
      }
    }

    await browser.close();

    const sucessos = resultados.filter(r => r.success).length;
    const erros = resultados.filter(r => !r.success).length;

    console.log(`\n✓ Concluído: ${sucessos} sucesso, ${erros} erros`);

    return {
      success: true,
      totalGuias: guias.length,
      sucessos,
      erros,
      resultados
    };

  } catch (error) {
    console.error('[LOTE] Erro:', error.message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, erro: error.message, resultados };
  }
}

module.exports = sawProcessarLoteGuias;
