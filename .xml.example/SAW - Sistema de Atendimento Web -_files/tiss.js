

function isSolicitandoGuiaDeConsultaSemProcedimento(quantidade) {
	var msg = "";
	var CONSULTA_AMB = "10014";
	var CONSULTA_CBHPM = "10101012";
	var CONSULTA_TUSS = "10101012";
	var qtdConsultaSolicitada = 0;
	var qtdProcedimentoSolicitado = 0;
	
	for (var i = 0; i < quantidade; i++ ) {
		if ( document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != "" ) {
			if ( document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value != "" ) {
				if (qtdProcedimentoSolicitado > 0) {
					break;
				}
				if ( document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == CONSULTA_AMB
						|| document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == CONSULTA_CBHPM
						|| document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == CONSULTA_TUSS) {
					qtdConsultaSolicitada++;
				} else if (document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value != CONSULTA_AMB
						&& document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value != CONSULTA_CBHPM
						&& document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value != CONSULTA_TUSS) {
					qtdProcedimentoSolicitado++;
				}
			}
		}
	}
	if (qtdConsultaSolicitada > 0 && qtdProcedimentoSolicitado == 0 
			&& document.getElementById("permiteSomenteConsultaEmConsultorioEmGuiaDeSpsadt").value == "false") {
		if (!(getTipoDeConsulta().value == "<%=DominioTissTipoDeConsulta40.POR_ENCAMINHAMENTO.getCodigo()%>"
				&& getTipoDeAtendimento().value == "<%=DominioTissTipoDeAtendimento40.CONSULTA.getCodigo()%>")) {
			alert("Não é permitido solicitar consulta em guia de SP/SADT"
					+"\nsem haver pelo menos 01(um) procedimento solicitado!");
			return false;
		}
	}
	return true;
}

function validarProcedimentosSolicitados(quantidade, isGuiaDeBenDeIntercambio){
	var msg = "";
	if(!isQuantidadeDeProcedimentosSolicitadosValida(quantidade) ){
		alert("Deve Preencher pelo menos um procedimento solicitado!");
		return false;
	}
	if(isProcedimentosSolicitadosIguais(quantidade) )
		return false;

	for(var i = 0; i < quantidade; i++ ){
		
		if( document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value != "" ){
			
			if( document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(	document.getElementById('procedimentosSolicitados['+i+'].descricao').value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(	document.getElementById('procedimentosSolicitados['+i+'].quantidade').value == "" ){
				msg += '\nCampo quantidade obrigatório!';
			}
			
			if(document.getElementById('procedimentosSolicitados['+i+'].valorDefinido')){
				if(document.getElementById('procedimentosSolicitados['+i+'].valorDefinido').value == 'Sim' 
					&& (document.getElementById('procedimentosSolicitados['+i+'].valor').value == '' 
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0'	
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00' 
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '000000,00')) {
					msg += '\nCampo valor é obrigatório para itens genéricos! ';
				}
			}
			
			if(isGuiaDeBenDeIntercambio){
				if(((document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00" 
					&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "20")
					|| document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "20" )
						&& document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "99999927"
						&& document.getElementById('procedimentosSolicitados['+i+'].registroAnvisa').value == ''){
					msg += '\nCampo Registro Anvisa é obrigatório para o Medicamento! ';
				
				}else if(((document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00" 
					&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "19")
					 || document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "19" )
					 	&& document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "99999935"
						&& (document.getElementById('procedimentosSolicitados['+i+'].registroAnvisa').value == '' 
							|| document.getElementById('procedimentosSolicitados['+i+'].codigoDeReferenciaDoMaterialNoFabricante').value == '' )){
					msg += '\nCampo Registro Anvisa e Código Referência do fornecedor é obrigatório para o Material! ';					
				}
			}
			
			if(msg != "" ){
				alert("Favor preencher o "+(i+1)+"º procedimento solicitado corretamente!"+msg);
				return false;
			}
		}
	}
	return true;
}

function validarProcedimentosSolicitadosProrrogacao(quantidade, isGuiaDeBenDeIntercambio, isUnimed){
	var msg = "";
	if(isUnimed == "false"){
		if(getQuantidadeDiariasAdicionaisSolicitadas().value == "" && getTipoAcomodacaoSolicitada().value != ""){
			alert("Quantidade de diárias adicionais, obrigatória quando informado o tipo de acomodação solicitada!");
			return false;
		}
		if(getQuantidadeDiariasAdicionaisSolicitadas().value == ""){
			if(!isQuantidadeDeProcedimentosSolicitadosValida(quantidade) ){
				alert("Deve Preencher pelo menos um procedimento solicitado!");
				return false;
			}	
		}
	} else {
		if(!isQuantidadeDeProcedimentosSolicitadosValida(quantidade) ){
			alert("Deve Preencher pelo menos um procedimento solicitado!");
			return false;
		}
	}
	
	if(isProcedimentosSolicitadosIguais(quantidade) )
		return false;

	for(var i = 0; i < quantidade; i++ ){
		
		if( document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value != "" ){
			
			if( document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(	document.getElementById('procedimentosSolicitados['+i+'].descricao').value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(	document.getElementById('procedimentosSolicitados['+i+'].quantidade').value == "" ){
				msg += '\nCampo quantidade obrigatório!';
			}
			
			if(document.getElementById('procedimentosSolicitados['+i+'].valorDefinido')){
				if(document.getElementById('procedimentosSolicitados['+i+'].valorDefinido').value == 'Sim' 
					&& (document.getElementById('procedimentosSolicitados['+i+'].valor').value == '' 
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0'	
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00' 
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '000000,00')) {
					msg += '\nCampo valor é obrigatório para itens genéricos! ';
				}
			}
			
			if(isGuiaDeBenDeIntercambio){
				if(((document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00" 
					&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "20")
					|| document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "20" )
						&& document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "99999927"
						&& document.getElementById('procedimentosSolicitados['+i+'].registroAnvisa').value == ''){
					msg += '\nCampo Registro Anvisa é obrigatório para o Medicamento! ';
				
				}else if(((document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00" 
					&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "19")
					 || document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "19" )
					 	&& document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "99999935"
						&& (document.getElementById('procedimentosSolicitados['+i+'].registroAnvisa').value == '' 
							|| document.getElementById('procedimentosSolicitados['+i+'].codigoDeReferenciaDoMaterialNoFabricante').value == '' )){
					msg += '\nCampo Registro Anvisa e Código Referência do fornecedor é obrigatório para o Material! ';					
				}
			}
			
			if(msg != "" ){
				alert("Favor preencher o "+(i+1)+"º procedimento solicitado corretamente!"+msg);
				return false;
			}
		}
	}
	return true;
}

function validarRequerObservacaoParaProcedimentoSolicitado30(quantidade){
	var msg = "";
	var msgOperadora = "";
	for(var i = 0; i < quantidade; i++ ){
		if( document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != "" ){
			if (document.forms[0].elements['procedimentosSolicitados['+i+'].restricaoDeServico.requerJustificativa'].value == 'S') {
				if (document.getElementById("manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.observacao").value == ''){
					msg += '\nCampo Observação/Justificativa obrigatório para o procedimento: '+document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value;
				}
			}
			if (utilizaIntervaloMinimoCadastroGuia && document.forms[0].elements['procedimentosSolicitados['+i+'].restricaoDeServico.intervaloMinimo'].value == 'S' 
				&& document.getElementById('manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.beneficiario.unimed.codigo').value == document.getElementById("codOperadora").value) {
				msgOperadora = 'Consta em nosso sistema que o procedimento ' + document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value + ' foi realizado por esse(a) beneficiário(a) em '+document.forms[0].elements['procedimentosSolicitados['+i+'].dataUltimaRealizacao'].value+'.\nDe acordo com as regras estabelecidas para o controle da sinistralidade e referências do Sistema Unimed, solicitamos justificar\numa nova solicitaçãoo fora do intervalo mínimo esperado para esse procedimento.';
				if (document.getElementById("manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.observacao").value == '' && document.getElementById("tipoIntervaloMinimoEntreRealizacoes").value == '2') {
					msg += '\nConsta em nosso sistema que o procedimento ' + document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value + ' foi realizado por esse(a) beneficiário(a) em '+document.forms[0].elements['procedimentosSolicitados['+i+'].dataUltimaRealizacao'].value+'. De acordo com as regras estabelecidas para o controle da sinistralidade e referências do Sistema Unimed, solicitamos justificar uma nova solicitação fora do intervalo mínimo esperado para esse procedimento.';
					msg += '\nFavor justificar no Campo Observação/Justificativa';
					document.getElementById("manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.mensagemObsOperadora").value = msgOperadora + " Favor verificar Justificativa preenchida pelo local de atendimento.";
				} else if (document.getElementById("manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.indicacaoClinica").value == '' && document.getElementById("tipoIntervaloMinimoEntreRealizacoes").value == '3') {
					msg += '\nConsta em nosso sistema que o procedimento ' + document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value + ' foi realizado por esse(a) beneficiário(a) em '+document.forms[0].elements['procedimentosSolicitados['+i+'].dataUltimaRealizacao'].value+'. De acordo com as regras estabelecidas para o controle da sinistralidade e referências do Sistema Unimed, solicitamos justificar uma nova solicitação fora do intervalo mínimo esperado para esse procedimento.';
					msg += '\nFavor preencher o Campo Indicação Clínica';
					document.getElementById("manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.mensagemObsOperadora").value = msgOperadora + " Favor verificar a indicação clínica preenchida pelo local de atendimento.";
				}
			}
		}
	}
	if(msg != ""){
		alert(msg);
		return false;
	}
	return true;
}

function validarRequerObservacaoParaProcedimentoSolicitado40(quantidade){
	var msg = "";
	var msgOperadora = "";
	for(var i = 0; i < quantidade; i++ ){
		if( document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != "" ){
			if (document.forms[0].elements['procedimentosSolicitados['+i+'].restricaoDeServico.requerJustificativa'].value == 'S') {
				if (document.getElementById("manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.observacao").value == ''){
					msg += '\nCampo Observação/Justificativa obrigatório para o procedimento: '+document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value;
				}
			}
			if (utilizaIntervaloMinimoCadastroGuia && document.forms[0].elements['procedimentosSolicitados['+i+'].restricaoDeServico.intervaloMinimo'].value == 'S' 
				&& document.getElementById('manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.beneficiario.unimed.codigo').value == document.getElementById("codOperadora").value) {
				msgOperadora = 'Consta em nosso sistema que o procedimento ' + document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value + ' foi realizado por esse(a) beneficiário(a) em '+document.forms[0].elements['procedimentosSolicitados['+i+'].dataUltimaRealizacao'].value+'.\nDe acordo com as regras estabelecidas para o controle da sinistralidade e referências do Sistema Unimed, solicitamos justificar\numa nova solicitaçãoo fora do intervalo mínimo esperado para esse procedimento.';
				if (document.getElementById("manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.observacao").value == '' && document.getElementById("tipoIntervaloMinimoEntreRealizacoes").value == '2') {
					msg += '\nConsta em nosso sistema que o procedimento ' + document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value + ' foi realizado por esse(a) beneficiário(a) em '+document.forms[0].elements['procedimentosSolicitados['+i+'].dataUltimaRealizacao'].value+'. De acordo com as regras estabelecidas para o controle da sinistralidade e referências do Sistema Unimed, solicitamos justificar uma nova solicitação fora do intervalo mínimo esperado para esse procedimento.';
					msg += '\nFavor justificar no Campo Observação/Justificativa';
					document.getElementById("manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.mensagemObsOperadora").value = msgOperadora + " Favor verificar Justificativa preenchida pelo local de atendimento.";
				} else if (document.getElementById("manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.indicacaoClinica").value == '' && document.getElementById("tipoIntervaloMinimoEntreRealizacoes").value == '3') {
					msg += '\nConsta em nosso sistema que o procedimento ' + document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value + ' foi realizado por esse(a) beneficiário(a) em '+document.forms[0].elements['procedimentosSolicitados['+i+'].dataUltimaRealizacao'].value+'. De acordo com as regras estabelecidas para o controle da sinistralidade e referências do Sistema Unimed, solicitamos justificar uma nova solicitação fora do intervalo mínimo esperado para esse procedimento.';
					msg += '\nFavor preencher o Campo Indicação Clínica';
					document.getElementById("manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.mensagemObsOperadora").value = msgOperadora + " Favor verificar a indicação clínica preenchida pelo local de atendimento.";
				}
			}
		}
	}
	if(msg != ""){
		alert(msg);
		return false;
	}
	return true;
}

function validarProcedimentosSolicitadosInternacao(quantidade, isGuiaDeBenDeIntercambio, isPermiteSolicitarInternacaoComDiariaPropriaSemProcedimento){
	var msg = "";
	if(!isQuantidadeDeProcedimentosSolicitadosValidaNaInternacao(quantidade)
			&& !(isPermiteSolicitarInternacaoComDiariaPropriaSemProcedimento 
					&& (isContemDiariaPropria(quantidade) || document.getElementById("codOperadora").value == '865'))) {
		alert("Deve Preencher pelo menos um procedimento solicitado!");
		return false;
	}
	if(isProcedimentosSolicitadosIguais(quantidade) )
		return false;

	for(var i = 0; i < quantidade; i++ ){
		
		if(document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value != "" ){
			
			if(document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(document.getElementById('procedimentosSolicitados['+i+'].descricao').value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(document.getElementById('procedimentosSolicitados['+i+'].quantidade').value == "" ){
				msg += '\nCampo quantidade obrigatório!';
			}
			
			if(document.getElementById('procedimentosSolicitados['+i+'].valorDefinido')){
				if(document.getElementById('procedimentosSolicitados['+i+'].valorDefinido').value == 'Sim' 
					&& (document.getElementById('procedimentosSolicitados['+i+'].valor').value == '' 
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0'	
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00' 
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '0000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '00000,00'
							|| document.getElementById('procedimentosSolicitados['+i+'].valor').value == '000000,00')) {
					msg += '\nCampo valor é obrigatório para itens genéricos! ';
				}
			}
			
			if(isGuiaDeBenDeIntercambio){
				if(((document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00" 
					&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "20")
					|| document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "20" )
						&& document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "99999927"
						&& document.getElementById('procedimentosSolicitados['+i+'].registroAnvisa').value == ''){
					msg += '\nCampo Registro Anvisa é obrigatório para o Medicamento! ';
				
				}else if(((document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00" 
					&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "19")
					 || document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "19" )
					 	&& document.getElementById('procedimentosSolicitados['+i+'].codigo').value == "99999935"
						&& (document.getElementById('procedimentosSolicitados['+i+'].registroAnvisa').value == '' 
							|| document.getElementById('procedimentosSolicitados['+i+'].codigoDeReferenciaDoMaterialNoFabricante').value == '' )){
					msg += '\nCampo Registro Anvisa e código Referência do fornecedor é obrigatório para o Material! ';					
				}
			}
			
			if(msg != "" ){
				alert("Favor preencher o " + (i+1) + "º procedimento solicitado corretamente!" + msg);
				return false;
			}
		}
	}
	return true;
}

function isContemDiariaPropria(quantidade){
	var retorno = false;
	for(var i = 0; i < quantidade; i++ ){
		if (document.getElementById('procedimentosSolicitados['+i+'].possuiDiaria').value == "S" 
			&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00"
				&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "18") {
			retorno = true;
		} else if(document.getElementById('procedimentosSolicitados['+i+'].tipoDiaria').value == 'DIARIA'
			&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "00"
				&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value == "18") {
			retorno = true;
		}
	}
	return retorno;
}

function validarProcedimentosRealizados(quantidade){
	var msg = "";

	for(var i = 0; i < quantidade; i++ ){
		
		if( document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value != "" ){
			
			if( document.forms[0].elements['procedimentosRealizados['+i+'].data'].value == "" ){
				msg += '\nCampo data obrigatório!';
			}
			
			if( document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(	document.forms[0].elements['procedimentosRealizados['+i+'].descricao'].value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(	document.forms[0].elements['procedimentosRealizados['+i+'].quantidade'].value == "" ){
				msg += '\nCampo quantidade obrigatório!';
			}
			
			if(msg != "" ){
				alert("Favor preencher o "+(i+1)+"º procedimento realizado corretamente!"+msg);
				return false;
			}

		}
	}
	return true;
}
function validarProcedimentosRealizadoPelaData(quantidade){
	var msg = "";
	retorno = true;
	for(var i = 0; i < quantidade; i++ ){
		if( document.forms[0].elements['procedimentosRealizados['+i+'].data'].value != "" ){
			if( document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value == "" ){
				msg += '\nCampo Tabela obrigatório!';
			}
			if( document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(	document.forms[0].elements['procedimentosRealizados['+i+'].descricao'].value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(	document.forms[0].elements['procedimentosRealizados['+i+'].quantidade'].value == "" ){
				msg += '\nCampo Quantidade obrigatório!';
			}
			if(msg != "" ){
				alert("Favor preencher o "+(i+1)+"º procedimento realizado corretamente!"+msg);
				retorno = false;
			}
		} else if(i == 0 && document.forms[0].elements['procedimentosRealizados['+i+'].data'].value == ""){
			retorno = false;
		}
	}
	return retorno;
}

function isQuantidadeDeProcedimentosSolicitadosValida(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		if(document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != "")
			return true;
	}
	return false;
}

function isQuantidadeDeProcedimentosSolicitadosValidaNaInternacao(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		if(document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value != "" && document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value != "18"
			&& document.getElementById('procedimentosSolicitados['+i+'].tipoTabelaSecundario').value != "18"){
			return true;
		}
	}
	return false;
}

function isQuantidadeDeProcedimentosRealizadosValida(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		if(document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value != "" && document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value != "00" )
			return true;
	}
	return false;
}

function isProcedimentosSolicitadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.getElementById('procedimentosSolicitados['+j+'].codigo').value != "" ) {
				
				if(document.getElementById('procedimentosSolicitados['+j+'].codigo').value != "" && document.getElementById('procedimentosSolicitados['+j+'].descricao').value != "" ) {
	                if(i != j){
	                    if(document.getElementById('procedimentosSolicitados['+i+'].descricao').value != '' && document.getElementById('procedimentosSolicitados['+j+'].descricao').value != ''){
	                        if(document.getElementById('procedimentosSolicitados['+i+'].codigo').value == document.getElementById('procedimentosSolicitados['+j+'].codigo').value
	                                && document.getElementById('procedimentosSolicitados['+i+'].descricao').value == document.getElementById('procedimentosSolicitados['+j+'].descricao').value) {
	                            alert("Não é permitido itens solicitados iguais!\nO item "+(i+1)+" é igual ao "+(j+1)+"!");
	                            return true;
	                        }
	                    }
	                }
				}
				
				if(isProcedimentosIguaisEAutorizados(i, j)) {
				   	alert("Não é permitido procedimentos solicitados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
					return true;
				}
				
				if(isBeneficiarioDeIntercamio()){
					if (isCodigoIntercambioIguais(i, j)){
						return true;
					}
				}
				
				if(document.getElementById('procedimentosSolicitados['+j+'].composicaoDoPacote') && (document.getElementById('procedimentosSolicitados['+j+'].composicaoDoPacote').value != undefined && document.getElementById('procedimentosSolicitados['+j+'].composicaoDoPacote').value != '')){
					var itensPacote = document.getElementById('procedimentosSolicitados['+j+'].composicaoDoPacote').value.split(';');
					for(var n = 0; n < quantidade; n++){
						if(document.getElementById('procedimentosSolicitados['+i+'].codigo').value == itensPacote[n]) {
						   	alert("O Procedimento "+document.getElementById('procedimentosSolicitados['+i+'].codigo').value+" já está com item do pacote " + document.getElementById('procedimentosSolicitados['+j+'].codigo').value + ". Favor remover o procedimento ou pacote!");
							return true;
						}
					}
				}
			}
		}
	}
	return false;
}

function isCodigoIntercambioIguais(i, j) {
	if ((getStatusProcedimentoSolicitado(i) == 'AUTORIZADO' || getStatusProcedimentoSolicitado(i) == 'AUTORIZADO PARCIAL' || getStatusProcedimentoSolicitado(i) == 'NEGADO')
			&& (getStatusProcedimentoSolicitado(j) == 'AUTORIZADO' || getStatusProcedimentoSolicitado(j) == 'AUTORIZADO PARCIAL' || getStatusProcedimentoSolicitado(j) == 'NEGADO')) {
		return false;
	} else if (document.getElementById("tipoDeIntegracao").value == "WEB_SERVICE") {
		return false;
	} else {
		if (document.getElementById('procedimentosSolicitados['+i+'].codigoIntercambio').value != "" && document.getElementById('procedimentosSolicitados['+i+'].tipoTabela').value == "98") {
			if (document.getElementById('procedimentosSolicitados['+i+'].codigoIntercambio').value == document.getElementById('procedimentosSolicitados['+j+'].codigo').value){
				alert("O pacote " + document.getElementById('procedimentosSolicitados['+i+'].codigo').value+" possui o mesmo código de intercâmbio do procedimento " + document.getElementById('procedimentosSolicitados['+j+'].codigo').value + ". Favor remover o procedimento ou o pacote!")
				return true;
			}
			if (document.getElementById('procedimentosSolicitados['+i+'].codigoIntercambio').value == document.getElementById('procedimentosSolicitados['+j+'].codigoIntercambio').value){
				alert("O pacote " + document.getElementById('procedimentosSolicitados['+i+'].codigo').value+" possui o mesmo código de intercâmbio do pacote " + document.getElementById('procedimentosSolicitados['+j+'].codigo').value + ". Favor remover um dos pacote!")
				return true;
			}
		}
		if (document.getElementById('procedimentosSolicitados['+j+'].codigoIntercambio').value != "" && document.getElementById('procedimentosSolicitados['+j+'].tipoTabela').value == "98") {
			if (document.getElementById('procedimentosSolicitados['+j+'].codigoIntercambio').value == document.getElementById('procedimentosSolicitados['+i+'].codigo').value){
				alert("O pacote " + document.getElementById('procedimentosSolicitados['+j+'].codigo').value+" possui o mesmo código de intercâmbio do procedimento " + document.getElementById('procedimentosSolicitados['+i+'].codigo').value + ". Favor remover o procedimento ou o pacote!")
				return true;
			}
			if (document.getElementById('procedimentosSolicitados['+j+'].codigoIntercambio').value == document.getElementById('procedimentosSolicitados['+i+'].codigoIntercambio').value) {
				alert("O pacote " + document.getElementById('procedimentosSolicitados['+j+'].codigo').value+" possui o mesmo código de intercâmbio do pacote " + document.getElementById('procedimentosSolicitados['+i+'].codigo').value + ". Favor remover um dos pacote!")
				return true;
			}
		}
	}
	return false;
}

function isProcedimentosOdontologiaSolicitadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value != "" ){
				if(document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value) {
				   	alert("Não é permitido procedimentos solicitaados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
					return true;
				}
				if (isCodigoIntercambioIguais(i, j)){
					return true;
				}
				if(document.forms[0].elements['procedimentosSolicitados['+j+'].composicaoDoPacote'] && document.forms[0].elements['procedimentosSolicitados['+j+'].composicaoDoPacote'].value != ""){
					var itensPacote = document.forms[0].elements['procedimentosSolicitados['+j+'].composicaoDoPacote'].value.split(';');
					for(var n = 0; n < quantidade; n++){
						if(document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == itensPacote[n]) {
						   	alert("O Procedimento "+document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value+" já está com item do pacote "+document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value+". Favor remover o procedimento ou pacote!");
							return true;
						}
					}
				}
			}
		}
	}
	return false;
}

function isDespesasIguaisEAutorizados(i, j) {
	var codigoA = document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value;
	var codigoB = document.forms[0].elements['despesasRealizadas['+j+'].codigo'].value;
	var qtdAutorizadaA = document.forms[0].elements['despesasRealizadas['+i+'].quantidadeAutorizada'].value;
	var qtdAutorizadaB = document.forms[0].elements['despesasRealizadas['+j+'].quantidadeAutorizada'].value;

	if (codigoA == codigoB && (codigoA != '99999919' || codigoB != '99999919')) {
		if (qtdAutorizadaA != "" && qtdAutorizadaB != "" 
			|| qtdAutorizadaA == "" && qtdAutorizadaB == "") {
			return true; 
		}
	}
	return false;
}

function isProcedimentosIguaisEAutorizados(i, j) {
	if(!document.getElementById('procedimentosSolicitados['+i+'].quantidadeAutorizada')){
		return;
	}
	var codigoA = document.getElementById('procedimentosSolicitados['+i+'].codigo').value;
	var codigoB = document.getElementById('procedimentosSolicitados['+j+'].codigo').value;
	var descricaoCodigoA = document.getElementById('procedimentosSolicitados['+i+'].descricao').value;
	var descricaoCodigoB = document.getElementById('procedimentosSolicitados['+j+'].descricao').value;
	
	if (codigoA == codigoB && (codigoA == '99999935' || codigoA == '99999927' || codigoA == '99999943'|| codigoA == '99999919' || isServicoGenericoPtu(codigoA, '', false))) {
		if(descricaoCodigoA == descricaoCodigoB){
			return true; 
		}else{
			return false;
		}
	}
	return false;
}

function isProcedimentosSolicitadosIguaisSemExibirMensagem(quantidade) {
	for (var i = 0; i < quantidade; i++) {
		for (var j = 0; j < quantidade; j++) {
			if (i != j && document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value != "") {
				if (isProcedimentosIguaisEAutorizados(i, j)) {
					return true;//alert("Não é permitido procedimentos solicitados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
				}
				if (document.forms[0].elements['procedimentosSolicitados['+j+'].composicaoDoPacote'].value != "") {
					var itensPacote = document.forms[0].elements['procedimentosSolicitados['+j+'].composicaoDoPacote'].value.split(';');
					for (var n = 0; n < quantidade; n++) {
						if (document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == itensPacote[n]) {
						   	return true;//alert("O Procedimento "+document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value+" já está com item do pacote "+document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value+". Favor remover o procedimento ou pacote!");
						}
					}
				}
			}
		}
	}
	return false;
}

function isProcedimentosRealizadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value != "" ){
				if(document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value == document.forms[0].elements['procedimentosRealizados['+j+'].codigo'].value) {
				   	alert("Não é permitido procedimentos realizados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
					return true;
				}
			}
		}
	}
	return false;
}

function isProcedimentosRealizadosIguais2(quantidade){
	var retorno = false;
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j){
				primeiroCodigo = document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value;
				primeiraData = document.forms[0].elements['procedimentosRealizados['+i+'].data'].value;
				primeiroHorarioInicial = document.forms[0].elements['procedimentosRealizados['+i+'].horaInicial'].value;
				primeiroHorarioFinal = document.forms[0].elements['procedimentosRealizados['+i+'].horaFinal'].value;
                		primeiroTabela = document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value;


				segundoCodigo = document.forms[0].elements['procedimentosRealizados['+j+'].codigo'].value;
				segundaData = document.forms[0].elements['procedimentosRealizados['+j+'].data'].value;
				segundoHorarioInicial = document.forms[0].elements['procedimentosRealizados['+j+'].horaInicial'].value;
				segundoHorarioFinal = document.forms[0].elements['procedimentosRealizados['+j+'].horaFinal'].value;
                		segundoTabela = document.forms[0].elements['procedimentosRealizados['+j+'].tipoTabela'].value;
	
				
				msg1 = 'O Procedimento '+(j+1)+' é igual ao procedimento '+(i+1)+'! Procedimentos iguais não podem ocorrer ao mesmo tempo.';
				msg2 = 'Não é permitido procedimentos realizados iguais!\nO Procedimento '+(j+1)+' é igual ao procedimento '+(i+1)+'!';
				
				if(primeiroCodigo != '' && segundoCodigo != '' && primeiraData != '' && segundaData != ''){
					if((primeiroCodigo == segundoCodigo) && (primeiraData == segundaData) && (primeiroTabela == segundoTabela)) {
						if(primeiroHorarioInicial != "" && primeiroHorarioFinal != "" && segundoHorarioInicial != "" && segundoHorarioFinal != ""){
							if(segundoHorarioInicial == primeiroHorarioInicial){
								if(segundoHorarioInicial <= primeiroHorarioFinal){
									alert(msg1);
									return true;
								}
								alert(msg1);
								retorno = true;
							}else if(segundoHorarioInicial <= primeiroHorarioInicial && segundoHorarioFinal > primeiroHorarioInicial){
								alert(msg1);
								return true;
							}
						}else{
							alert(msg2);
							return true;
						}
					} 
				}
			}
		}
	}
	return false;
}

function isProcedimentosRealizadosIguaisSemExibirMensagem(quantidade) {
	for (var i = 0; i < quantidade; i++ ) {
		for (var j = 0; j < quantidade; j++ ) {
			if (i != j && document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value != "" ) {
				if (document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value == document.forms[0].elements['procedimentosRealizados['+j+'].codigo'].value) {
					return true;//alert("Não é permitido procedimentos realizados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
				}
			}
		}
	}
	return false;
}

function isTipoDaTabelaValidaSpSadt(id,tipo){
	tipoTabela = document.forms[0][tipo+"["+id+"].tipoTabela"];
	if(tipoTabela.value == "01" 
			|| tipoTabela.value == "02"
			|| tipoTabela.value == "03"
			|| tipoTabela.value == "04"
			|| tipoTabela.value == "06"
			|| tipoTabela.value == "16"
			|| tipoTabela.value == "97"
			|| tipoTabela.value == "98"
			|| tipoTabela.value == "94"
			|| tipoTabela.value == "00") {
		return true;
	} else {
		if(tipoTabela.value != ""){
			alert("Tipo de Tabela não permitida neste campo.");
		}
		return false;
	}
}

function isTipoDaTabelaValidaInternacao(id,tipo, qtdeAcomodacao){
	qtdeAcomodacao = qtdeAcomodacao - 1;
	tipoTabela = document.forms[0][tipo+"["+id+"].tipoTabela"];
	if(id > qtdeAcomodacao){
		if(tipoTabela.value == "01" 
				|| tipoTabela.value == "02"
				|| tipoTabela.value == "03"
				|| tipoTabela.value == "04"
				|| tipoTabela.value == "16"
				|| tipoTabela.value == "06"
				|| tipoTabela.value == "97"
				|| tipoTabela.value == "98"
				|| tipoTabela.value == "94" ) {
			return true;
		} 
	}else{
		if(tipoTabela.value == "00") {
			return true;
		}
	}	
	if(tipoTabela.value != ""){
		alert("Tipo de Tabela não permitida neste campo.");
	}
	return false;
}

function isTabelaOpmValida(id, tipo, arrayDePermissoesTiposDeTabela) {
	tipoTabela = document.forms[0][""+tipo+"["+id+"].tipoTabela"];
	if ( (tipoTabela.value == "05" && arrayDePermissoesTiposDeTabela.tipoDeTabelaBrasindice) 
			|| (tipoTabela.value == "12" && arrayDePermissoesTiposDeTabela.tipoDeTabelaSimpro)
			|| (tipoTabela.value == "95" && arrayDePermissoesTiposDeTabela.tipoDeTabelaPropriaDeMaterial)
			|| (tipoTabela.value == "96" && arrayDePermissoesTiposDeTabela.tipoDeTabelaPropriaDeMedicamento)) {
		return true;
	} else {
		if (tipoTabela.value != "") {
			alert("Tabela não permitida neste campo.");
		}
		return false;
	}
}

function isTabelaOpmValida30(id, tipo, arrayDePermissoesTiposDeTabela) {
	tipoTabela = document.forms[0][""+tipo+"["+id+"].tipoTabela"];
	if ( (tipoTabela.value == "19" && arrayDePermissoesTiposDeTabela.tipoDeTabelaBrasindice) 
			|| (tipoTabela.value == "20" && arrayDePermissoesTiposDeTabela.tipoDeTabelaSimpro)) {
		return true;
	} else {
		if (tipoTabela.value != "") {
			alert("Tabela não permitida neste campo.");
		}
		return false;
	}
}

function validarProrrogacao(quantidadeProrrogacao,quantidadeProcedimentos,quantidadeOpm,codigoLocalGenericoDeMateriais,codigoLocalGenericoDeMedicamentos){
	var msg = "";
	for(var i = 0; i < quantidadeProrrogacao; i++ ){
		if(document.forms[0].elements['prorrogacoes['+i+'].chave'].value == "0" ){
			if( document.forms[0].elements['prorrogacoes['+i+'].data'].value == "" ){
				msg += '\nCampo data obrigatório!';
			}
			
			if(msg != "" ){
				alert("Favor preencher a "+(i+1)+"º prorrogação corretamente!"+msg);
				return false;
			}
			
			if(! isPeloMenosUmProcedimentoOuOpmSolicitado(i, quantidadeProcedimentos, quantidadeOpm)){
				return;
			}
			if(! validarProcedimentosProrrogacao(i, quantidadeProcedimentos)){
				return;
			}
			if(! validarOpmProrrogacao(i, quantidadeOpm,codigoLocalGenericoDeMateriais,codigoLocalGenericoDeMedicamentos)){
				return;
			}
			
		}
	}
	return true;
}

function isPeloMenosUmProcedimentoOuOpmSolicitado(i, quantidadeProcedimentos, quantidadeOpm) {
	
	for(var j = 0; j < quantidadeProcedimentos; j++ ){
		if( document.forms[0].elements['prorrogacoes['+i+'].procedimentos['+j+'].tipoTabela'].value != "" ){
			return true;
		}
	}
	
	for(var j = 0; j < quantidadeOpm; j++ ){
		if( document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].tipoTabela'].value != "" ){
			return true;	
		}
	}
	alert("Favor solicitar um procedimento, uma diária ou um OPM!");
	return false;
}


function validarProcedimentosProrrogacao(i,quatidadeProcedimentos){
	var msg = "";
	
	if(isDiariaSecundariaETerciariaIguais(i)){
		alert("Não é permitido solicitar duas diárias iguais!");
		return false;
	}

	if(! isProcedimentosDaProrrogacaoIguais(i,quatidadeProcedimentos) )
		return false;

	for(var j = 0; j < quatidadeProcedimentos; j++ ){
		
		if( document.forms[0].elements['prorrogacoes['+i+'].procedimentos['+j+'].tipoTabela'].value != "" ){
	
			if( document.forms[0].elements['prorrogacoes['+i+'].procedimentos['+j+'].codigo'].value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(	document.forms[0].elements['prorrogacoes['+i+'].procedimentos['+j+'].descricao'].value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(	document.forms[0].elements['prorrogacoes['+i+'].procedimentos['+j+'].quantidade'].value == "" ){
				msg += '\nCampo quantidade obrigatório!';
			}
			
			if(msg != "" ){
				alert("Favor preencher corretamente o "+(j+1)+"é procedimento da "+(i+1)+"º Prorrogação!"+msg);
				return false;
			}

		}
	}
	return true;
}


function isDiariaSecundariaETerciariaIguais(i){
	if( document.forms[0].elements['prorrogacoes['+i+'].procedimentos[1].codigo'].value != '' && document.forms[0].elements['prorrogacoes['+i+'].procedimentos[2].codigo'].value != ''){
		if( document.forms[0].elements['prorrogacoes['+i+'].procedimentos[1].codigo'].value == document.forms[0].elements['prorrogacoes['+i+'].procedimentos[2].codigo'].value){
			return true;	
		}
	}
	return false;
}


function isProcedimentosDaProrrogacaoIguais(k,quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['prorrogacoes['+k+'].procedimentos['+i+'].codigo'].value != "" ){
				if(document.forms[0].elements['prorrogacoes['+k+'].procedimentos['+i+'].codigo'].value == document.forms[0].elements['prorrogacoes['+k+'].procedimentos['+j+'].codigo'].value) {
				   	alert("Não é permitido procedimentos iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
					return false;
				}
			}
		}
	}
	return true;
}


function validarOpmProrrogacao(i,quantidadeOpm,codigoLocalGenericoDeMateriais,codigoLocalGenericoDeMedicamentos){
	var msg = "";
	
	for(var j = 0; j < quantidadeOpm; j++ ){
		if( document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].tipoTabela'].value != "" ){
	
			if( document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == "" ){
				msg += '\nCampo código obrigatório!';
			} 
			
			if(	document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].descricao'].value == "" ){
				msg += '\nCampo descrição obrigatório!';
			} 
			
			if(	document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].quantidade'].value == "" ){
				msg += '\nCampo quantidade obrigatório!';
			}
			
			if(((document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == '99999927' ||
				document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == '99999943') && 
				document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].tipoTabela'].value == '96') 
				|| ((document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == '99999935' ||
				document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == '99999943') && 
				document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].tipoTabela'].value == '95') 
				|| ((document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == codigoLocalGenericoDeMateriais) && 
				document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].tipoTabela'].value == '95')
				|| ((document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].codigo'].value == codigoLocalGenericoDeMedicamentos) && 
				document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].tipoTabela'].value == '96')) {
					if(	document.forms[0].elements['prorrogacoes['+i+'].opms['+j+'].valorUnitario'].value == "" ){
						msg += '\nCampo valor unitário obrigatório!';
					}				
				}
		
			if(msg != "" ){
				alert("Favor preencher corretamente o "+(j+1)+"º OPM da "+(i+1)+"º Prorrogação!"+msg);
				return false;
			}

		}
	}
	return true;
}

function isProcedimentoJaSolicitado(i,quantidade){
	if(document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value != "" ){
		for(var j = 0; j < quantidade; j++ ){
			if( document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value == document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value
			 && document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value == document.forms[0].elements['procedimentosSolicitados['+j+'].tipoTabela'].value ) {
			   	return true;
			}
		}
	}
	alert("O "+(i+1)+"º Procedimento realizado não foi solicitado!");
	ocultarDivAguarde();
	return false;
}

function isProcedimentoJaRealizado(i,quantidade){
	if(document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value != "" ){
		for(var j = 0; j < quantidade; j++ ){
			if( document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value == document.forms[0].elements['procedimentosRealizados['+j+'].codigo'].value
			 && document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value == document.forms[0].elements['procedimentosRealizados['+j+'].tipoTabela'].value ) {
			   	return true;
			}
		}
	}
	alert("O "+(i+1)+"º Procedimento realizado não foi solicitado!");
	ocultarDivAguarde();
	return false;
}



function isOpmSolicitadosIguais(quantidade) {
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.getElementById('opmSolicitados['+i+'].codigo').value != "" ){
				if(document.getElementById('opmSolicitados['+i+'].codigo').value == document.getElementById('opmSolicitados['+j+'].codigo').value
						&& document.getElementById('opmSolicitados['+i+'].tipoTabela').value == document.getElementById('opmSolicitados['+j+'].tipoTabela').value) {
					if(document.getElementById('opmSolicitados['+i+'].descricao').value == document.getElementById('opmSolicitados['+j+'].descricao').value){
						alert("Não é permitido OPM solicitados iguais!\nO OPM "+(i+1)+" é igual ao OPM "+(j+1)+"!");
						return true;
					}
				}
			}
		}
	}
	return false;
}

function isMedicamentosSolicitadosIguais(quantidade,codigoMaterialGenerico,codigoOpmGenerico,tabelaMaterial,codigoMedicamentoGenerico,tabelaMedicamento){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['opmSolicitados['+i+'].codigo'].value != "" ){
					if(document.forms[0].elements['opmSolicitados['+i+'].codigo'].value == document.forms[0].elements['opmSolicitados['+j+'].codigo'].value
							&& document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value == document.forms[0].elements['opmSolicitados['+j+'].tipoTabela'].value
							&& document.forms[0].elements['opmSolicitados['+i+'].dataPrevista'].value == document.forms[0].elements['opmSolicitados['+j+'].dataPrevista'].value) {
						if(document.forms[0].elements['opmSolicitados['+i+'].descricao'].value == document.forms[0].elements['opmSolicitados['+j+'].descricao'].value){
							alert("Não é permitido Medicamentos solicitados iguais!\nO Medicamento "+(i+1)+" é igual ao Medicamento "+(j+1)+"!");
							return true;
						}
					}
			}
		}
	}
	return false;
}


function isOpmSolicitadosProrrogacaoIguais(quantidade,codigoMaterialGenerico,codigoOpmGenerico,tabelaMaterial,codigoMedicamentoGenerico,tabelaMedicamento, contadorProrrogacao){
	for(var i = 0; i < quantidade; i++ ){
		if((document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].codigo'].value == codigoMaterialGenerico &&
		   document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].tipoTabela'].value == tabelaMaterial) ||
		   (document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].codigo'].value == codigoOpmGenerico &&
				   document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].tipoTabela'].value == tabelaMaterial) ||
		   (document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].codigo'].value == codigoMedicamentoGenerico &&
		   document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].tipoTabela'].value == tabelaMedicamento)) {
			 continue;
		}
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].codigo'].value != "" ){
					if(document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].codigo'].value == document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+j+'].codigo'].value
							&& document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].tipoTabela'].value == document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+j+'].tipoTabela'].value) {
						alert("Não é permitido OPM solicitados iguais!\nO OPM "+(i+1)+" é igual ao OPM "+(j+1)+"!");
						return true;
					}
			}
		}
	}
	return false;
}

function isDespesasRealizadasIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value != "" ){
				if(document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value == document.forms[0].elements['despesasRealizadas['+j+'].codigo'].value
						&& document.forms[0].elements['despesasRealizadas['+i+'].data'].value != "" && document.forms[0].elements['despesasRealizadas['+j+'].data'].value != ""
						&& document.forms[0].elements['despesasRealizadas['+i+'].data'].value == document.forms[0].elements['despesasRealizadas['+j+'].data'].value) {
					
					if(document.forms[0].elements['despesasRealizadas['+i+'].horaInicial'].value != "" && document.forms[0].elements['despesasRealizadas['+j+'].horaInicial'].value != ""
						&& document.forms[0].elements['despesasRealizadas['+i+'].horaInicial'].value != document.forms[0].elements['despesasRealizadas['+j+'].horaInicial'].value) {
						document.forms[0].elements['despesasRealizadas['+i+'].codigo'].style.backgroundColor='';
						document.forms[0].elements['despesasRealizadas['+j+'].codigo'].style.backgroundColor='';
					} else {
						document.forms[0].elements['despesasRealizadas['+i+'].codigo'].style.backgroundColor='#FF9999';
						document.forms[0].elements['despesasRealizadas['+j+'].codigo'].style.backgroundColor='#FF9999';
						alert("Não é permitido despesas solicitados iguais!\n Despesa "+(i+1)+" igual a despesa "+(j+1)+"!");
						return true;
					}
				} else {
					document.forms[0].elements['despesasRealizadas['+i+'].codigo'].style.backgroundColor='';
					document.forms[0].elements['despesasRealizadas['+j+'].codigo'].style.backgroundColor='';
				}
			}
		}
	}
	return false;
}

function isDiariasRealizadasIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value != "" ){
				if(document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value == document.forms[0].elements['despesasRealizadas['+j+'].codigo'].value
						&& document.forms[0].elements['despesasRealizadas['+i+'].codigoDespesa'].value == "5") {
					document.forms[0].elements['codigoServicoDiaria'+i+''].style.backgroundColor='#FF9999';
					document.forms[0].elements['codigoServicoDiaria'+j+''].style.backgroundColor='#FF9999';
					alert("Não é permitido diárias iguais!\nNa Despesa "+(i+1)+" a diária é igual a da Despesa "+(j+1)+"!");
					document.forms[0].elements['codigoServicoDiaria'+j+''].value ='';
					return true;
				} else {
					document.forms[0].elements['codigoServicoDiaria'+i+''].style.backgroundColor='';
					document.forms[0].elements['codigoServicoDiaria'+j+''].style.backgroundColor='';
				}
			} else {
				document.forms[0].elements['codigoServicoDiaria'+i+''].style.backgroundColor='';
				document.forms[0].elements['codigoServicoDiaria'+j+''].style.backgroundColor='';
			}
		}
	}
	return false;
}

function isOpmRealizadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value != "" ){
					if(document.forms[0].elements['despesasRealizadas['+i+'].codigo'].value == document.forms[0].elements['despesasRealizadas['+j+'].codigo'].value
							&& document.forms[0].elements['despesasRealizadas['+i+'].tipoTabela'].value == document.forms[0].elements['despesasRealizadas['+j+'].tipoTabela'].value) {
						
						if(document.forms[0].elements['despesasRealizadas['+i+'].data'].value == document.forms[0].elements['despesasRealizadas['+j+'].data'].value){
							alert("Não é permitido OPM solicitados iguais!\nO OPM "+(i+1)+" é igual ao OPM "+(j+1)+"!");
							return true;
						}
						
					}
			}
		}
	}
	return false;
}

function isDescricaoDeOpmSolicitadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['opmSolicitados['+i+'].descricao'].value != "" ){
				if(document.forms[0].elements['opmSolicitados['+i+'].descricao'].value == document.forms[0].elements['opmSolicitados['+j+'].descricao'].value
						&& document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value == document.forms[0].elements['opmSolicitados['+j+'].tipoTabela'].value) {
					alert("Não é permitido OPM solicitados iguais!\nO OPM "+(i+1)+" é igual ao OPM "+(j+1)+"!");
					return true;
				}
			}
		}
	}
	return false;
}

function isDescricaoDeOpmSolicitadosProrrogacaoIguais(contadorProrrogacao,quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].descricao'].value != "" ){
				if(document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].descricao'].value == document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+j+'].descricao'].value
						&& document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+i+'].tipoTabela'].value == document.forms[0].elements['prorrogacoes['+contadorProrrogacao+'].opms['+j+'].tipoTabela'].value) {
					alert("Não é permitido OPM solicitados iguais!\nO OPM "+(i+1)+" é igual ao OPM "+(j+1)+"!");
					return true;
				}
			}
		}
	}
	return false;
}

function isDescricaoDeDespesasDeOpmSolicitadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['despesasRealizadas['+i+'].descricao'].value != "" ){
				if(document.forms[0].elements['despesasRealizadas['+i+'].descricao'].value == document.forms[0].elements['despesasRealizadas['+j+'].descricao'].value
						&& document.forms[0].elements['despesasRealizadas['+i+'].tipoTabela'].value == document.forms[0].elements['despesasRealizadas['+j+'].tipoTabela'].value) {
					alert("Não é permitido OPM solicitados iguais!\nO OPM "+(i+1)+" é igual ao OPM "+(j+1)+"!");
					return true;
				}
			}
		}
	}
	return false;
}

function isDescricaoDeProcedimentoSolicitadosIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['procedimentosSolicitados['+i+'].descricao'].value != "" ){
				if(document.forms[0].elements['procedimentosSolicitados['+i+'].descricao'].value == document.forms[0].elements['procedimentosSolicitados['+j+'].descricao'].value
						&& document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value == document.forms[0].elements['procedimentosSolicitados['+j+'].tipoTabela'].value) {
					alert("Não é permitido Procedimentos solicitados iguais!\nO Procedimento "+(i+1)+" é igual ao Procedimento "+(j+1)+"!");
					return true;
				}
			}
		}
	}
	return false;
}

function isDescricaoDeDespesasRealizadasIguais(quantidade){
	for(var i = 0; i < quantidade; i++ ){
		for(var j = 0; j < quantidade; j++ ){
			if(i != j && document.forms[0].elements['despesasRealizadas['+i+'].descricao'].value != "" ){
				if(document.forms[0].elements['despesasRealizadas['+i+'].descricao'].value == document.forms[0].elements['despesasRealizadas['+j+'].descricao'].value
						&& document.forms[0].elements['despesasRealizadas['+i+'].tipoTabela'].value == document.forms[0].elements['despesasRealizadas['+j+'].tipoTabela'].value) {
					alert("Não é permitido Procedimentos solicitados iguais!\nO Procedimento "+(i+1)+" é igual ao Procedimento "+(j+1)+"!");
					return true;
				}
			}
		}
	}
	return false;
}


function validarTipoAtendimento(){
	var isOk = false;
	if( document.forms[0].elements['solicitacaoDeSPSADT.tipoDeAtendimento'].value.trim().length > 0 ){
		isOk = true;
	}  else {
		alert("Campo 46 - tipo de atendimento obrigatório!");
		isOk = false;
	}
	return isOk;
}

function validarNumeroDeGuia(numeroDaGuia) {
	if (numeroDaGuia.value != '' && numeroDaGuia.value.length > 1) {
		retrieveAction('/saw/ValidarNumeroDeGuiaAjax.do?method=validarNumeroDeGuia&numeroDaGuia='+numeroDaGuia.value, null, 'doExecutaAcaoAposValidarNumeroDaGuia');
	} 
}

function validarNumeroDeGuiaDoPrestador(numeroGuiaPrestador,codigoDoPrestador, tipoGuia) {
	if (numeroGuiaPrestador.value != '' && numeroGuiaPrestador.value.length > 0) {
		retrieveAction('/saw/ValidarNumeroDeGuiaDoPrestadorAjax.do?method=validarNumeroDeGuiaDoPrestador&numeroDaGuiaDoPrestador='+numeroGuiaPrestador.value+'&codigoDoPrestador='+codigoDoPrestador.value+'&tipoGuia='+tipoGuia, null, 'doExecutaAcaoAposValidarNumeroDaGuia');
	} 
}

function cadastrarDadosParaEnvioDeInformacao() {
	var retorno = validaDadosParaEnvioDeInformacao();
	if(retorno){
		document.forms[0]["method"].value = "cadastrarDadosParaEnvioDeInformacao";
		document.forms[0]["enviaSMSParaBeneficiario"].disabled = false
        document.forms[0]["enviaEmailParaBeneficiario"].disabled = false
		document.forms[0].submit();
		mostrarDivProcessando();
	} 
}

function atualizarDadosParaEnvioDeInformacao(){
	var retorno = validaDadosParaEnvioDeInformacao();
	if(retorno){
		document.forms[0]["method"].value = "atualizarDadosParaEnvioDeInformacao";
		document.forms[0].submit();
		mostrarDivProcessando();
	} 
}

function validaDadosParaEnvioDeInformacao(){
	var ddd = document.getElementById('tiss.beneficiario.telefones[0].ddd');
	var numero = document.getElementById('tiss.beneficiario.telefones[0].numero');
	var email = document.getElementById('tiss.beneficiario.email');
	var dataPrevistaRealizacao = document.getElementById('dataPrevistaDeRealizacao'); 
	var horaPrevistaRealizacao = document.getElementById('horaPrevistaDeRealizacao'); 
	if((ddd.value.length > 0 && numero.value.trim().length >= 8)
				|| email.value.trim().length > 6){
		var enviaAbsentecionismo = document.getElementById('enviaAbsenteismoParaBeneficiario');
			if(enviaAbsentecionismo != null){
				enviaAbsentecionismo = enviaAbsentecionismo.checked == true;
				if(enviaAbsentecionismo == true && (dataPrevistaRealizacao.value == '' || horaPrevistaRealizacao.value == '') ){
					alert('A data e Horário Previsto para realização do procedimento são obrigatórios ao marcar o campo envia absentecionismo!');
					return false;
				}
			}
			return true;
	}else{
		alert("Campo número do telefone ou e-mail obrigatório!");
		return false;
	}
}

function cadastrarDadosParaEnvioSmsGrupoServico() {
	var retorno = validaDadosParaEnvioSmsGrupoServico();
	if(retorno){
		document.forms[0]["method"].value = "cadastrarDadosParaEnvioSmsGrupoServicos";
		document.forms[0].submit();
		mostrarDivProcessando();
	} 
}

function validaDadosParaEnvioSmsGrupoServico(){
	var ddd = document.getElementById('tiss.beneficiario.telefone.ddd');
	var numero = document.getElementById('tiss.beneficiario.telefone.numero');
	if(ddd.value.length > 0 && numero.value.trim().length >= 8){
		return true;
	}else{
		alert("Campo número do telefone obrigatório!");
		return false;
	}
}	

	function doExecutarRegrasAtualizacaoBeneficiario(){
  		var dialogContent = jQuery("#divAtualizarDadosBeneficiario");
			dialogContent.dialog({
	            modal: true,
	            height: 370,
	            width: 800,
	            closeOnEscape: false,
	            title: "Atualização de Dados do Beneficiário",
	            draggable: false,
	            close: function() {
	              	dialogContent.dialog("destroy");
	               	dialogContent.hide();
	            },
	            buttons: {
	            	"Cadastrar": function() {
	            	    var msg = 'Campos obrigatórios: \n\n';
	            		if(jQuery("#beneficiarioNome").val().trim() == ''){
	            			msg += '- Nome do Beneficiário \n';
	            		}
	            		if (jQuery("#beneficiarioNomeMae").val().trim() == ''){
	            			msg += '- Nome da Mãe \n';
	            		}
	            		if (jQuery("#beneficiarioCPF").val().trim() == '' ){
	            			msg += '- CPF \n';
	            		}
	            		if (jQuery("#beneficiarioDataNascimento").val().trim() == '' ){
	            			msg += '- Data de Nascimento \n';
	            		}
	            		if (jQuery("#beneficiarioRg").val().trim() == '' ){
	            			msg += '- RG \n';
	            		}
	            		if (jQuery("#beneficiarioTelefone").val().trim() == ''){
	            			msg += '- Telefone \n' ;
	            		}
	            		if (jQuery("#atualizacaoBeneficiarioUF").val().trim() == ''){
	            			msg += '- UF \n';
	            		}
	            		if (jQuery("#beneficiarioEstadoCivil").val().trim() == ''){
	            			msg += '- Estado Civil \n';
	            		}
	            		if (jQuery("#beneficiarioViaCartao").val().trim() == ''){
	            			msg += '- Via do Cartão \n';
	            		}
	            		if (jQuery("#beneficiarioCidade").val().trim() == ''){
	            			msg += '- Cidade \n';
	            		}
	            		if (jQuery("#beneficiarioCep").val().trim() == ''){
	            			msg += '- CEP \n';
	            		}
	            		if (jQuery("#beneficiarioBairro").val().trim() == ''){
	            			msg += '- Bairro \n';
	            		}
	            		if (jQuery("#beneficiarioLogradouro").val().trim() == ''){
	            			msg += '- Logradouro \n' ;
	            		}
	            		if(msg != 'Campos obrigatórios: \n\n'){
	            			alert(msg);
	            		} else {
	            			atribuirValoresDoBeneficiarioParaAtualizacaoEmBaseDeDados();
	            			dialogContent.dialog("close");
			               	dialogContent.hide();
			               	atualizarDadosDoBeneficiarioDaGuia();
	            		}
	            	}
	            }
	         }).show();
			atribuirValoresDoBeneficiarioAoAbrirModalDeAtualizacao();
			//setTimeout("document.getElementById('#beneficiarioNomeAbreviado').focus()",4000);
  	}

	function atualizarDadosDoBeneficiarioDaGuia() {
		document.forms[0]["method"].value = "atualizarDadosDoBeneficiarioDaGuia";
		document.forms[0].submit();
		mostrarDivProcessando();
	}
	
	function mostrarDivProcessando(){
  		var height = document.getElementById("divTopo").offsetHeight + document.getElementById("divGeral").offsetHeight;
  		document.getElementById('divProcessando').style.height = height+40;
  		desabilitarTodosOsCamposDoFormulario(document.forms[0]);
		Element.show('divProcessando');
  	}
	
	/****************** TISS 3.0 genérico *****************/
	
	function pesquisarDescricaoPorCid() {
		if(document.forms[0][nomeDivDescricao].value.length <= 0 ){
			document.forms[0][nomeCampoCid].value = '';
		}else{
			var cid = document.forms[0][nomeCampoCid].value;
			if (cid.length > 0) {
				retrieveAction(contexto+"/CapturarDescricaoPorCidAjax.do?campoEmQuestao=" + nomeCampoCid + "&"+nomeCampoCid+"=" + cid, null, "doExecutaAcaoAposPesquisarDescricaoPorCid");
			}else{
				document.forms[0][nomeDivDescricao].value = '';
			}
		}
		ocultarDivAguarde();
	}
	
	function setNomeDoCampoCidELayerDescricao(campo, nomeDivDescr){
		nomeDivDescricao = nomeDivDescr;
		nomeCampoCid = campo;
	}

	function isProcedimentosSolicitadosDeRadioterapiaIguais(quantidade){
		for(var i = 0; i < quantidade; i++ ){
			for(var j = 0; j < quantidade; j++ ){
				if(i != j && document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value != "" ) {
					var codigoA = document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value;
					var codigoB = document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value;
					if(codigoA == codigoB) {
					   	alert("Não é permitido procedimentos solicitados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
						return true;
					}
				}
			}
		}
		return false;
	}
	
	function isServicoSolicitadosDeRadioterapiaIguais(quantidade){
		for(var i = 0; i < quantidade; i++ ){
			for(var j = 0; j < quantidade; j++ ){
				if(i != j && document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value != "" ) {
					var codigoA = document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value;
					var codigoB = document.forms[0].elements['procedimentosSolicitados['+j+'].codigo'].value;
					if(codigoA == codigoB) {
					   	alert("Não é permitido procedimentos solicitados iguais!\nO Procedimento "+(i+1)+" é igual ao procedimento "+(j+1)+"!");
						return true;
					}
				}
			}
		}
		return false;
	}
	
	function validarOpmSolicitados(quantidade,codigoLocalGenericoDeMateriais,codigoLocalGenericoDeMedicamentos,isGuiaDeBenDeIntercambio,isValidaReferenciaMaterialFabricante){
		var msg = "";
		for(var i = 0; i < quantidade; i++ ){
			if(document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value != ""){
				
				if( document.getElementById('opmSolicitados['+i+'].codigo').value == "" ){ 
					msg += '\nCampo código obrigatório!';
				}
				
			   	if( document.forms[0].elements['opmSolicitados['+i+'].descricao'].value == "" ){  
					msg += '\nCampo descrição obrigatório!';
				}
				
			   	if(	document.forms[0].elements['opmSolicitados['+i+'].quantidade'].value == "" ){  
					msg += '\nCampo quantidade obrigatório!';
				}
			   	
			   	if(	document.forms[0].elements['opmSolicitados['+i+'].ordemDeOpcaoDeFabricante'].value == "" ){  
					msg += '\nCampo Opção obrigatório!';
				}
			   	
				if(	document.forms[0].elements['opmSolicitados['+i+'].ordemDeOpcaoDeFabricante'].value == "0" ){  
					msg += '\nCampo Opção não pode ser 0!';
				}
			   	if(document.forms[0].elements['opmSolicitados['+i+'].valorDefinido']){
			   		if(document.forms[0].elements['opmSolicitados['+i+'].valorDefinido'].value == 'Sim' && 
			   				(document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '0' ||	
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '00' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '0,00' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '00,00' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '000,00' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '0000,00' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '00000,00' ||
			   						document.forms[0].elements['opmSolicitados['+i+'].valorUnitario'].value == '000000,00') ){
						msg += '\nCampo valor unitário é obrigatório! ';
					}
			   	}
			   	
			   	 if(((document.getElementById('opmSolicitados['+i+'].codigo').value.trim() == '99999943' || isServicoGenericoPtu(document.getElementById('opmSolicitados['+i+'].codigo').value.trim(), 'OPME', true))
			   	 		&& document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value == '00') ||
			   		  (document.getElementById('opmSolicitados['+i+'].codigo').value.trim() == '99999943' && document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value == '19')){
			   		 if(document.forms[0].elements['opmSolicitados['+i+'].registroAnvisa'].value.trim() == "") {
			   				msg += '\nCampo Regis. Anv. Obrigatório!';
						}
						if(document.forms[0].elements['opmSolicitados['+i+'].codigoDeReferenciaDoMaterialNoFabricante'].value.trim() == "" && isValidaReferenciaMaterialFabricante) {
							msg += '\nCampo Ref. do Mat. Fab. Obrigatório!';
						}
			   	 }else if(isGuiaDeBenDeIntercambio && document.getElementById('opmSolicitados['+i+'].codigo').value != '1501062019'){
						if(document.forms[0].elements['opmSolicitados['+i+'].registroAnvisa'].value.trim() == "") {
							msg += '\nCampo Regis. Anv. Obrigatório!';							
						}
						if(document.forms[0].elements['opmSolicitados['+i+'].codigoDeReferenciaDoMaterialNoFabricante'].value == "" && isValidaReferenciaMaterialFabricante) {
							msg += '\nCampo Ref. do Mat. Fab. Obrigatório!';							
						}					
			   	 }
			   	if(msg != "" ){
					alert("Favor preencher o "+(i+1)+"º material corretamente!"+msg);
					return false;
				}   
			}
		}
		return true;
	}
	
	function validarMedicamentosQuimioterapia (quantidade,codigoLocalGenericoDeMateriais,codigoLocalGenericoDeMedicamentos, isGuiaDeBenDeIntercambio, isVersaoTissXml30301){
		var msg = "Campo(s) obrigatório(s):";
		for(var i = 0; i < quantidade; i++ ){
		
			if(document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value != ""){
				
			  	if(	document.forms[0].elements['opmSolicitados['+i+'].dataPrevista'].value == "" ){  
					msg += '\nCampo 32 - Data prevista para administração';
				}
			  	
				if( document.forms[0].elements['opmSolicitados['+i+'].codigo'].value == "" ){ 
					msg += '\nCampo 34 - código do Medicamento';
				}
				
			   	if( document.forms[0].elements['opmSolicitados['+i+'].descricao'].value == "" ){  
					msg += '\nCampo 35 - descrição';
				}
				
			   	if(	document.forms[0].elements['opmSolicitados['+i+'].totalDosagemCiclo'].value == "" ){  
					msg += '\nCampo 36 - Dosagem total no ciclo';
				}
			   	
			 	if(	document.forms[0].elements['opmSolicitados['+i+'].frequencia'].value == "" ){  
					msg += '\nCampo Frequência obrigatório!';
				}
			 	
			 	if(	document.forms[0].elements['opmSolicitados['+i+'].viaDeAdministracaoDoMedicamento'].value == "" ){  
					msg += '\nCampo 38 - Via administração do medicamento';
				}
			   	
			   	if(	document.forms[0].elements['opmSolicitados['+i+'].frequencia'].value == "" ){  
					msg += '\nCampo 39 - Frequência';
				}
			 	
			 	if(document.forms[0].elements['opmSolicitados['+i+'].valorDefinido'].value == 'Sim' && document.forms[0].elements['opmSolicitados['+i+'].valor'].value == ''){
			 		msg += '\nCampo valor se torna obrigatório para código(s) genérico(s)! ';
			 	}
			 	
			 	if (isVersaoTissXml30301) {
			 		if(document.forms[0].elements['opmSolicitados['+i+'].unidadeDeMedida'].value == ''){
			 			msg += '\nCampo 37 - Unidade de medida';
			 		}
			 	}
			 	
			 	if(((document.forms[0].elements['opmSolicitados['+i+'].codigo'].value == '99999943' || isServicoGenericoPtu(document.forms[0].elements['opmSolicitados['+i+'].codigo'].value, 'OPME', true))
			 			&& document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value == '00') ||
				   		  (document.forms[0].elements['opmSolicitados['+i+'].codigo'].value == '99999943' && document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value == '19')){
							if(document.forms[0].elements['opmSolicitados['+i+'].registroAnvisa'].value == "") {
								msg += '\nCampo Regis. Anv. obrigatório!';
							}							
				   	 }else if(isGuiaDeBenDeIntercambio && document.getElementById('opmSolicitados['+i+'].codigo').value != '1501062019'){
							if(document.forms[0].elements['opmSolicitados['+i+'].registroAnvisa'].value == "") {
								msg += '\nCampo Registro Anvisa obrigatório!';							
							}
				   	 }  
				
			}
		}
		if (msg != 'Campo(s) obrigatório(s):') {
			alert(msg);
			return false;
		} else {
			return true;
		}
	}
	
	
	function validarProcedimentosRadioterapia (quantidade,codigoLocalGenericoDeMateriais,codigoLocalGenericoDeMedicamentos){
		var msg = "";
		if(!isQuantidadeDeProcedimentosSolicitadosValida(quantidade) ){
			alert("Deve Preencher pelo menos um procedimento solicitado!");
			return false;
		}
		if(isProcedimentosSolicitadosIguais(quantidade) )
			return false;

		for(var i = 0; i < quantidade; i++ ){
			
			if( document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != "" ){
				
				if( document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value == "" ){
					msg += '\nCampo código obrigatório!';
				} 
				
				if(	document.forms[0].elements['procedimentosSolicitados['+i+'].descricao'].value == "" ){
					msg += '\nCampo descrição obrigatório!';
				} 
				
				if(	document.forms[0].elements['procedimentosSolicitados['+i+'].quantidade'].value == "" ){
					msg += '\nCampo quantidade obrigatório!';
				}
				
				if(	document.forms[0].elements['procedimentosSolicitados['+i+'].dataPrevista'].value == "" ){
					msg += '\nCampo Data Prevista obrigatório!';
				}
				
				if(document.forms[0].elements['procedimentosSolicitados['+i+'].valorDefinido']){
					if(document.forms[0].elements['procedimentosSolicitados['+i+'].valorDefinido'].value == 'Sim' && document.getElementById('procedimentosSolicitados['+i+'].valor').value == ''){
						msg += '\nCampo valor é obrigatório para procedimentos genéricos! ';
					}
				}
				
				if(msg != "" ){
					alert("Favor preencher o "+(i+1)+"º procedimento solicitado corretamente!"+msg);
					return false;
				}
			}
		}
		return true;
	}
	
	function validarProcedimentoOdontoRealizado (quantidade){
		var msg = "";
			
		for(var i = 0; i < quantidade; i++ ){
			if(document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value != ""){
				
			  	if(	document.forms[0].elements['procedimentosRealizados['+i+'].tipoTabela'].value === '' ){  
					msg += '\nCampo tipo tabela obrigatório!';
				}
			  	
			  	if(	document.forms[0].elements['procedimentosRealizados['+i+'].codigo'].value === '' ){  
					msg += '\nCampo código procedimento obrigatório!';
				}
			  	
			 	if(	document.forms[0].elements['procedimentosRealizados['+i+'].descricao'].value === '' ){  
					msg += '\nCampo descrição obrigatório!';
				}
			 	
			  	if(	document.forms[0].elements['procedimentosRealizados['+i+'].quantidade'].value === '' ){  
					msg += '\nCampo quantidade realizada obrigatório!';
				}
			  	
				if(	document.forms[0].elements['procedimentosRealizados['+i+'].valor'].value === '' ){  
					msg += '\nCampo valor obrigatório!';
				}
			  	
			  	if(	document.forms[0].elements['procedimentosRealizados['+i+'].data'].value === '' ){  
					msg += '\nCampo data realização obrigatório!';
				}
			  	
			  	if (document.forms[0].elements['procedimentosRealizados['+i+'].dente'].value != ''
			  	   && document.forms[0].elements['procedimentosRealizados['+i+'].face'].value === '') {
			  		msg += '\nCampo face não preenchido para o dente selecionado!';
			  	}

				if(msg != '' ){
					alert('Favor preencher o '+(i+1)+'º procedimento solicitado corretamente!'+msg);
					return false;
				
				}
			}
				
		}
		return true;
	}
	
	function validarProcedimentoOdontoSolicitado(quantidade){
		var msg = "";
		
		for(var i = 0; i < quantidade; i++ ){
			if(document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != ""){
				
			  	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value === '' ){  
					msg += '\nCampo tipo tabela obrigatório!';
				}
			  	
			  	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value === '' ){  
					msg += '\nCampo código procedimento obrigatório!';
				}
			  	
			 	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].descricao'].value === '' ){  
					msg += '\nCampo descrição obrigatório!';
				}
			 	
			  	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].quantidade'].value === '' ){  
					msg += '\nCampo quantidade realizada obrigatório!';
				}
			  	
				if(	document.forms[0].elements['procedimentosSolicitados['+i+'].valor'].value === '' ){  
					msg += '\nCampo valor obrigatório!';
				}

				var qtde = verificarFace(i);

				var campoFace = document.forms[0].elements['procedimentosSolicitados['+i+'].quantidadeDeFaceObrigatoria'];
				var valor = campoFace ? campoFace.value : '';
				var numero = (valor === '' || valor === '0') ? NaN : parseInt(valor, 10);
				var denteSelecionado = document.forms[0].elements['procedimentosSolicitados[' +i+ '].dente'].value != '';

				if (!isNaN(numero) && numero > 0) {
					if (qtde > numero) {
						msg += '\nCampo "Face" extrapola a quantidade de faces permitida para o procedimento!';
					}
					if (denteSelecionado && qtde < 1) {
						msg += '\nCampo "Face" não preenchido para o dente selecionado.\nSelecione pelo menos uma face!';
					}
					if (denteSelecionado && qtde > numero) {
						msg += '\nCampo "Face" preenchido incorretamente para o dente selecionado.\nSelecione no máximo ' + numero + ' faces!';
					}
				}
				if ((isNaN(numero) || numero === 0) && denteSelecionado && qtde > 5) {
					msg += '\nCampo "Face" preenchido incorretamente para o dente selecionado.\nSelecione no máximo cinco faces!';
				}
				if(msg != '' ){
					alert('Favor preencher o '+(i+1)+'º procedimento solicitado corretamente!'+msg);
					return false;
				
				}
			}
				
		}
		return true;
	}
	
	function verificarFace(i) {
		var qtde = 0
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.faceOclusal'].checked) {
			qtde++;
		}
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.faceLingual'].checked) {
			qtde++;
		}
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.faceMesial'].checked) {
			qtde++;
		}
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.faceVestibular'].checked) {
			qtde++;
		}
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.faceDistal'].checked) {
			qtde++;
		}
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.faceIncisal'].checked) {
			qtde++;
		}
		if (document.forms[0].elements['procedimentosSolicitados['+i+'].servicoOdontoFaceDTO.facePalatina'].checked) {
			qtde++;
		}
		return qtde;
	}
	
	function isQuantidadeDeGlosasSolicitadasValida(quantidade){
		for(var i = 0; i < quantidade; i++ ){
			if(document.forms[0].elements['glosa['+i+'].tipoTabela'].value != "")
				return true;
		}
		return false;
	}

	function fecharDivMotivo(){
		ocultarComponente("divMotivo");
		reprocessIEPopup();
		getMotivoCancelamento().value = '';
	}
	
	function fecharDivAnexo() {
		ocultarComponente("divAnexos");
	}
	
	function exibeDivAnexo(){
		mostrarComponente("divAnexos");
	}
	
	function mostrarDivAguarde(){
		carregando = true;
		setTimeout("Element.show('divAguarde');",5000);
	}
	
	function ocultarDivAguarde(){
		carregando = false;
		setTimeout("Effect.Fade('divAguarde')", 200);
	}
	
  	function getHeightDaTela() {
		return document.getElementById("divCorpo").offsetHeight + 10;
	}
  	
	function fecharDivMensagemLivre() {
		ocultarComponente("divMensagemLivre");
		reprocessIEPopup();
		getMensagemLivre().value = '';
	}
	
	function mostrarDivMensagemLivre() {
		getMensagemLivre().value = '';
		document.getElementById('divMensagemLivre').style.height = getHeightDaTela();
		Element.show('divMensagemLivre');
	}
	
	function definirServicoProprioGenerico(isCodigoGenerico, indice, tipo, tipoTabela){
		if(isCodigoGenerico && tipoTabela == "20"  ){
			document.getElementById(tipo + '['+indice+'].descricao').readOnly = false;
			if(document.getElementById(tipo + '['+indice+'].valor')){
				document.getElementById(tipo + '['+indice+'].valor').style.display = '';
				document.getElementById(tipo + '['+indice+'].valor').style.visibility = 'visible';
				if(document.getElementById('tdValor')){
					document.getElementById('tdValor').style.display = '';
					document.getElementById('tdValor').style.visibility = 'visible';
				}
				if(document.getElementById('tdRegistroAnvisa')){
					document.getElementById('tdRegistroAnvisa').style.display = '';
					document.getElementById('tdRegistroAnvisa').style.visibility = 'visible';
					document.getElementById(tipo + '['+indice+'].registroAnvisa').style.display = '';
					document.getElementById(tipo + '['+indice+'].registroAnvisa').style.visibility = 'visible';
				}
				if(document.getElementById('tdCodRefFornecedor')){
					document.getElementById('tdCodRefFornecedor').style.display = '';
					document.getElementById('tdCodRefFornecedor').style.visibility = 'visible';
					document.getElementById(tipo + '['+indice+'].codigoDeReferenciaDoMaterialNoFabricante').style.display = '';
					document.getElementById(tipo + '['+indice+'].codigoDeReferenciaDoMaterialNoFabricante').style.visibility = 'visible';
				}
			}
			document.getElementById(tipo + '['+indice+'].valorDefinido').value = 'Sim';
			document.getElementById(tipo + '['+indice+'].descricao').maxLength = 80;
		}else if(isCodigoGenerico && tipoTabela == "19"){
			document.getElementById(tipo + '['+indice+'].descricao').readOnly = false;
			if(document.getElementById(tipo + '['+indice+'].valor')){
				document.getElementById(tipo + '['+indice+'].valor').style.display = '';
				document.getElementById(tipo + '['+indice+'].valor').style.visibility = 'visible';
				if(document.getElementById('tdValor')){
					document.getElementById('tdValor').style.display = '';
					document.getElementById('tdValor').style.visibility = 'visible';
				}
				if(document.getElementById('tdRegistroAnvisa')){
					document.getElementById('tdRegistroAnvisa').style.display = '';
					document.getElementById(tipo + '['+indice+'].registroAnvisa').style.display = '';
					document.getElementById('tdRegistroAnvisa').style.visibility = 'visible';
					document.getElementById(tipo + '['+indice+'].registroAnvisa').style.visibility = 'visible';
				}
				if(document.getElementById('tdCodRefFornecedor')){
					document.getElementById('tdCodRefFornecedor').style.display = '';
					document.getElementById(tipo + '['+indice+'].codigoDeReferenciaDoMaterialNoFabricante').style.display = '';
					document.getElementById('tdCodRefFornecedor').style.visibility = 'visible';
					document.getElementById(tipo + '['+indice+'].codigoDeReferenciaDoMaterialNoFabricante').style.visibility = 'visible';
				}
			}
			document.getElementById(tipo + '['+indice+'].valorDefinido').value = 'Sim';
			document.getElementById(tipo + '['+indice+'].descricao').maxLength = 80;
		}else{
			document.getElementById(tipo + '['+indice+'].descricao').readOnly = true;
		}
	}
	
	function verificaDescricaoServicoProprio(indice, tipo){
		mostrarDivAguarde();
		var procedimento = document.getElementById(tipo + '['+indice+'].descricao');
		if(procedimento.value === '' || procedimento.value.length > 10){
			alert('Serviço Inválido!');
			document.getElementById(tipo + '['+indice+'].codigo').value = '';
			document.getElementById(tipo + '['+indice+'].codigo').focus();
		}
		ocultarDivAguarde();
	}
	

	function isQuantidadeDeOpmsSolicitadosValida(quantidade){
		for(var i = 0; i < quantidade; i++ ){
			if(document.forms[0].elements['opmSolicitados['+i+'].tipoTabela'].value != "")
				return true;
		}
		return false;
	}
	
	function isQuantidadePedidoMedicoProcedimentosSolicitadosValida(quantidade){
		for(var i = 0; i < quantidade; i++ ){
			try{
				if(document.forms[0].elements['procedimentosSolicitados['+i+'].tipoTabela'].value != "" || document.forms[0].elements['procedimentosSolicitados['+i+'].isGrupoProcedimento'].value == 'true') 
					return true;
			}catch (E) {
				return true;
			}
		}
		return false;
	}
	
	function validarProcedimentosSolicitadosPedidoMedico(quantidade){
		var msg = "";
		var isValido = false;
		
		
		for(var i = 0; i < quantidade; i++ ){
			try{
				if(document.forms[0].elements['procedimentosSolicitados['+i+'].descricao'].value != ''){
					isValido = true;
					break;
				}
			}catch (E) {
				// algum indice excluido.
			}
		
		}
	
		if(!isValido){
			alert("Deve Preencher pelo menos um procedimento solicitado!");
			return;
		}
		
		for(var i = 0; i < quantidade; i++ ){
			try{
				if(document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value != ""){
					
				  	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].codigo'].value === '' ){  
						msg += '\nCampo código procedimento obrigatório!';
					}
				  	
				 	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].descricao'].value === '' ){  
						msg += '\nCampo descrição obrigatório!';
					}
				 	
				  	if(	document.forms[0].elements['procedimentosSolicitados['+i+'].quantidade'].value === '' ){  
						msg += '\nCampo quantidade realizada obrigatório!';
					}

					if(msg != '' ){
						alert('Favor preencher o '+(i+1)+'º procedimento solicitado corretamente!'+msg);
						return false;
					
					}
				}
			}catch (E) {
				// algum indice excluido.
			}
		}
		return true;
	}
	
	function getStatusProcedimentoSolicitado(i){
        return document.getElementById('procedimentosSolicitados['+i+'].status').value;
    }

	function doExecutarRegrasAtualizacaoTelefoneBeneficiario(){
  		var dialogContent = jQuery("#divAtualizarTelefoneBeneficiario");
			dialogContent.dialog({
	            modal: true,
	            height: 270,
	            width: 800,
	            closeOnEscape: false,
	            title: "Atualização de Telefone Celular do Beneficiário",
	            draggable: false,
	            close: function() {
	              	dialogContent.dialog("destroy");
	               	dialogContent.hide();
	            },
	            buttons: {
	            	"Cadastrar": function() {
	            		
            			jQuery.ajax({//verificar se o telefone já está cadastrado
	     			        url: "/saw/VerificaNumeroJaCadastradoAjaxAction.do",
	     			        dataType: 'json',
	     			        type: 'POST',
	     			        data: { 
	     			        	ddd : jQuery("#dddTelefoneBeneficiario").val().trim(),
	     			        	telefone : jQuery("#numeroTelefoneBeneficiario").val().trim(),
	     			        	codOperadora : jQuery("#codOperadora").val().trim(),
	     			        	codBeneficiario: getCodigoBeneficiario().value,
	     			        	codOperadoraBeneficiario: getCodigoUnimedBeneficiario().value
	     			        },
	     			       success: function(data) {
		                        var a = eval(data);
	     			        	if(a == true){//se o telefone for valido
				                	var msg = 'Campos obrigatórios: \n\n';
				                	if (jQuery("#dddTelefoneBeneficiario").val().trim() == ''){
				                		msg += 'DDD \n' ;
				                	}
				                	if (jQuery("#numeroTelefoneBeneficiario").val().trim() == ''){
				                		msg += ' - Número Telefone \n' ;
				                	}
				                	if(msg != 'Campos obrigatórios: \n\n'){
				                		alert(msg);
				                	} else {
										jQuery.ajax({
										    url: "/saw/ValidarCelularAjaxAction.do",
										    dataType: 'json',
										    type: 'POST',
										    async: false,
										    data: { 
										    	campoEmQuestao : jQuery("#numeroTelefoneBeneficiario").val().replace(/\D/g,"")
										    },
										   	success: function(data) {
										        var a = eval(data);
										    	if(a == false){
													alert("Número do celular não é válido!");
													document.getElementById("numeroTelefoneBeneficiario").value = '';
													document.getElementById("numeroTelefoneBeneficiario").focus();
										    	} else {
							                		atribuirValoresDoBeneficiarioParaAtualizacaoTelefone();
							                		dialogContent.dialog("close");
							                		dialogContent.hide();
							                		atualizarTelefoneDoBeneficiarioDaGuia();
							                	}	
										    }
										 });   
				                	}
	     			        	}else{//se der erro ao gerar
	     			        		alert('Número de telefone informado excedeu o limite de utilização por beneficiários permitido, gentileza informar outro número!');
	     			        	}
     		               }
		                });
	            		
	            		
	            	}
	            }
	         }).show();
			atribuirTelefoneDoBeneficiarioAoAbrirModalDeAtualizacao();
  	}

	function atualizarTelefoneDoBeneficiarioDaGuia() {
		document.forms[0]["method"].value = "atualizarTelefoneDoBeneficiarioDaGuia";
		document.forms[0].submit();
		mostrarDivProcessando();
	}
	
	function abrirTelaDeDetalharBeneficiario(codigoDaUnimed, codigoDoBeneficiario, tipoTratamento) {
		var url = "/saw/DadosAnonimizadosAction.do?method=abrirTelaConfirmacao" +
				  "&manterDadosAnonimizados.beneficiarioConsulta.unimed.codigo=" + codigoDaUnimed +
				  "&manterDadosAnonimizados.beneficiarioConsulta.codigo=" + codigoDoBeneficiario +
		 		  "&manterDadosAnonimizados.tipoTratamento=" + tipoTratamento ;
				  
		var width = 1000;
		var height = 460;
		abreJanela(url,null,width,height);
	}
	
	function isSequenciaNumerica(num) {
		num = num.toString();
		var crescente = true;
		var decrescente = true;
		for (var i = 1; i < num.length; i++) {
			if (Number(num[i]) !== Number(num[i-1]) + 1) {
				crescente = false;
	    	}
			if (Number(num[i]) !== Number(num[i-1]) - 1) {
				decrescente = false;
			}
		}
		return crescente || decrescente;
	}
	
	function isDigitosRepetidos(num) {
		num = num.toString();
		for (var i = 1; i < num.length; i++) {
			if (num[i] !== num[0]) {
				return false;
		    }
		}
		return true;
	}
	
	function isServicoGenericoPtu(codigo, tipo, isRegistroAnvisaObrigatorio) {
		var retorno = false;
		jQuery.ajax({
			url: '/saw/CodigoGenericoPtuAjax.do?method=doExecutarConteudoAJAX',
			type: 'POST',
			async: false,
			data: {
				codigo : codigo,
				tipo : tipo,
				isRegistroAnvisaObrigatorio : isRegistroAnvisaObrigatorio
			},
			success: function(data, textStatus) {
				if (data == 'true') {
					retorno = true;
				} else {
					retorno = false;
				}
			}
		});
		return retorno;
	}
	
	function capturarValorDeProcedimentoGenerico(codigo, tipoTabela, origemRequisicao, codigoPrestador, codigoUnimedBeneficiario, codigoBeneficiario, index) {
		jQuery.ajax({
			url: '/saw/CapturaValorServicoGenericoAjax.do?method=doExecutarConteudoAJAX',
			type: 'POST',
			data: {
				codigo : codigo,
				tipoTabela : tipoTabela,
				origemRequisicao: origemRequisicao,
				codigoPrestador: codigoPrestador,
				codigoUnimedBeneficiario: codigoUnimedBeneficiario,
				codigoBeneficiario: codigoBeneficiario
			},
			success: function(data, textStatus) {
				//Função abaixo deve existir na jsp correspondente
				doExecutaAcaoAposCapturarValorDeProcedimentoGenerico(data, index);
			}
		});
	}
