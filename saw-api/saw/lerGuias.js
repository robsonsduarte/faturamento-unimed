const puppeteer = require('puppeteer-core');

async function sawLerGuias({ cookies, numeroGuia }) {
  console.log('[LER-GUIA] Processando guia:', numeroGuia);
  let browser;

  try {
    // Conectar ao Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1400, height: 900 });

    await page.goto('https://saw.trixti.com.br', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.setCookie(...cookies);

    const urlGuia = `https://saw.trixti.com.br/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${numeroGuia}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`;

    console.log('[LER-GUIA] Navegando para guia...');
    await page.goto(urlGuia, { waitUntil: 'networkidle2', timeout: 30000 });

    if (page.url().includes('Logar.do') || page.url().includes('login.jsp')) {
      await browser.close();
      return { success: false, erro: 'Sessão expirou', numeroGuia };
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('[LER-GUIA] Extraindo dados...');

    const resultado = await page.evaluate(() => {
      function extrairTextoDepoisDeLabel(labelText) {
        const divs = document.querySelectorAll('div.caixaVerde, div.caixaBranca, div');
        for (const div of divs) {
          const label = div.querySelector('label');
          if (label && label.textContent.includes(labelText)) {
            const textoCompleto = div.textContent || div.innerText;
            const textoSemLabel = textoCompleto.replace(label.textContent, '');
            return textoSemLabel.trim().replace(/\s+/g, ' ').replace(/\u00a0/g, '');
          }
        }
        return null;
      }

      const statusElement = document.querySelector('b[style*="color: red"]');
      const status = statusElement ? statusElement.textContent.trim() : null;

      const dataAutorizacao = extrairTextoDepoisDeLabel('4-Data da Autoriza');
      const senha = extrairTextoDepoisDeLabel('5-Senha');
      const dataValidadeSenha = extrairTextoDepoisDeLabel('6-Data Validade da Senha');

      let numeroGuiaOperadora = null;
      const divNumeroGuia = Array.from(document.querySelectorAll('div.caixaBranca')).find(
        div => div.textContent.includes('7-Nº da Guia Atribuído pela Operadora')
      );
      if (divNumeroGuia) {
        const span = divNumeroGuia.querySelector('span[style*="font-weight: bold"]');
        if (span) numeroGuiaOperadora = span.textContent.trim().replace(/\u00a0/g, '');
      }

      let numeroGuiaPrestador = null;
      const divGuiaPrestador = Array.from(document.querySelectorAll('div.caixaBrancaSemBorda')).find(
        div => div.textContent.includes('2-N° guia no prestador')
      );
      if (divGuiaPrestador) {
        const span = divGuiaPrestador.querySelector('span[style*="font-weight: bold"]');
        if (span) numeroGuiaPrestador = span.textContent.trim().replace(/\u00a0/g, '');
      }

      let numeroCarteira = extrairTextoDepoisDeLabel('8-N');
      if (numeroCarteira && numeroCarteira.includes('-')) {
        numeroCarteira = numeroCarteira.split('-').pop().trim();
      }

      const nomeBeneficiario = extrairTextoDepoisDeLabel('10-Nome');
      const codigoPrestador = extrairTextoDepoisDeLabel('13-C');
      const nomeContratado = extrairTextoDepoisDeLabel('14-Nome do Contratado');
      const nomeProfissional = extrairTextoDepoisDeLabel('15-Nome do Profissional');

      let conselhoProfissional = extrairTextoDepoisDeLabel('16-Conselho');
      if (conselhoProfissional) {
        if (conselhoProfissional.includes('Psicologia')) conselhoProfissional = '09';
        else if (conselhoProfissional.includes('Fonoaudiologia')) conselhoProfissional = '08';
        else if (conselhoProfissional.includes('Nutri')) conselhoProfissional = '07';
        else if (conselhoProfissional.includes('Medicina')) conselhoProfissional = '06';
      }

      const numeroConselhoProfissional = extrairTextoDepoisDeLabel('17-N');
      const ufProfissional = extrairTextoDepoisDeLabel('18-UF');

      let cbosProfissional = extrairTextoDepoisDeLabel('19-C');
      if (cbosProfissional) {
        if (cbosProfissional.toLowerCase().includes('logo cl')) cbosProfissional = '251510';
        else if (cbosProfissional.toLowerCase().includes('fonoaudi')) cbosProfissional = '223810';
        else if (cbosProfissional.toLowerCase().includes('nutri')) cbosProfissional = '223505';
      }

      let dataSolicitacao = extrairTextoDepoisDeLabel('22-Data');
      if (dataSolicitacao && dataSolicitacao.includes(' - ')) {
        dataSolicitacao = dataSolicitacao.split(' - ')[0].trim();
      }

      const indicacaoClinica = extrairTextoDepoisDeLabel('23-Indica');
      const cnes = extrairTextoDepoisDeLabel('31-CNES');

      let tipoAtendimento = extrairTextoDepoisDeLabel('32-Tipo Atendimento');
      if (tipoAtendimento && tipoAtendimento.includes('Outras Terapias')) tipoAtendimento = '03';

      let indicacaoAcidente = extrairTextoDepoisDeLabel('33-Indica');
      if (indicacaoAcidente && indicacaoAcidente.includes('Não Acidente')) indicacaoAcidente = '9';

      let quantidadeSolicitada = 0;
      let quantidadeAutorizada = 0;

      const tabelaProcedimentos = document.querySelector('#procedimentos table');
      if (tabelaProcedimentos) {
        const linhas = tabelaProcedimentos.querySelectorAll('tr');
        for (let i = 1; i < linhas.length; i++) {
          const colunas = linhas[i].querySelectorAll('td');
          if (colunas.length >= 5) {
            const qtdSolic = colunas[3].textContent.trim().replace(/\u00a0/g, '');
            const qtdAutor = colunas[4].textContent.trim().replace(/\u00a0/g, '');
            if (qtdSolic && !isNaN(qtdSolic)) quantidadeSolicitada = parseInt(qtdSolic);
            if (qtdAutor && !isNaN(qtdAutor)) quantidadeAutorizada = parseInt(qtdAutor);
            break;
          }
        }
      }

      let procedimentosRealizados = 0;
      const todasTabelas = document.querySelectorAll('table.caixaBranca');
      for (const tabela of todasTabelas) {
        const headers = tabela.querySelectorAll('tr:first-child td label');
        const temData36 = Array.from(headers).some(label => label.textContent.includes('36-Data'));
        if (temData36) {
          const textoTabela = tabela.textContent || tabela.innerText;
          if (textoTabela.includes('Nenhum procedimento realizado cadastrado')) {
            procedimentosRealizados = 0;
          } else {
            procedimentosRealizados = tabela.querySelectorAll('tr').length - 1;
          }
          break;
        }
      }

      return {
        status, dataAutorizacao, senha, dataValidadeSenha,
        numeroGuiaOperadora, numeroGuiaPrestador, numeroCarteira,
        nomeBeneficiario, codigoPrestador, nomeContratado, nomeProfissional,
        conselhoProfissional, numeroConselhoProfissional, ufProfissional,
        cbosProfissional, dataSolicitacao, indicacaoClinica, cnes,
        tipoAtendimento, indicacaoAcidente, quantidadeSolicitada,
        quantidadeAutorizada, procedimentosRealizados
      };
    });

    await browser.close();
    console.log('[LER-GUIA] Dados extraídos com sucesso');
    return { success: true, numeroGuia, ...resultado };

  } catch (error) {
    console.error('[LER-GUIA] Erro:', error.message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, erro: error.message, numeroGuia };
  }
}

module.exports = sawLerGuias;
