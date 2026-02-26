/**
 * Ajax.js
 *
 * Cole??o de Scripts para habilitar a comunica??o entre o Browser e um servidor (struts).
 * Posibilita, por exemplo, atualizar apenas uma parte da p?gina, ao inv?s da p?gina toda.
 * 
 * Como utilizar:
 * ==========
 * 1) Chame a fun??o retrieveURL atrav?s de um evento (Ex: onClick). 
 * 2) Passe como par?metros desta fun??o a Action (URL) a ser chamada e o Html Form da p?gina. 
 * 		Ex.: onClick="javascript: retrieveURL('pagina.do', 'nomeDoForm')"
 * 3) Quando o servidor responder a requisi??o ...
 *		 - o script far? uma itera??o, em busca de tags <span id="name">newContent</span>
 * 		 - Cada tag <span> que houver na p?gina corrente ter? seu conte?do atualizado com o novo conte?do retornado.
 *
 * NOTE: <span id="nome"> ? "case-sensitive". 
 */

//Vari?veis globais
var req;
var which;
var ERRO_COMUNICACAO_SERVIDOR = "Problema na comunicação com o servidor";
var ERRO_RESPOSTA_SERVIDOR = "Problema na resposta do servidor: ";
var NOME_DO_DIV_MSG_PROCESSAMENTO = "divDaMensagemDeProcessamentoAjax";
var MENSAGEM_DEFAULT_PROCESSAMENTO = "Aguarde..."
var PAGINA_ERRO = "erro.jsp";

// Se as Constantes abaixo forem alteradas, deve-se atulizar o arquivo DominioAjax
var SEPARADOR = "#####";
var EXCEPTION = "EXCEPTION";

/**
 * Captura o conteúdo de uma p?gina via chamada Ajax.
 * url - URL para capturar o conte?do. (Ex: /struts-ajax/nomeDaPagina.do?method=NOME_DO_METODO_A_EXECUTAR) 
 * nameOfFormToPost - Nome do Html Form que contém os dados que devem ser enviados para a página requisitada.
 */
function retrieveURL(url, nameOfFormToPost, scriptAExecutarAposProcessamentoAjax) {
	//get the (form based) params to push up as part of the get request
	url=url + getFormAsString(nameOfFormToPost);
	
	/*
	 * Descomente a linha abaixo para visualizar a URL de requisi??o.
	 */
	//alert(url);
    
	//Do the Ajax call
	if (window.XMLHttpRequest) { // Non-IE browsers
		req = new XMLHttpRequest();
		req.onreadystatechange = processStateChange;
		try {
			req.open("GET", url, true); //was get
		} catch (e) {
			alert(ERRO_COMUNICACAO_SERVIDOR + "\n"+e);
		}
		req.send(null);
	} else if (window.ActiveXObject) { // IE
		req = new ActiveXObject("Microsoft.XMLHTTP");
		if (req) {
			req.onreadystatechange = processStateChange;
			req.open("GET", url, true);
			req.send();
		}
	}
	
	// Executar um script ap?s executar chamada ao servidor.
	if (scriptAExecutarAposProcessamentoAjax != null) {
		eval(scriptAExecutarAposProcessamentoAjax + "()");
	}
}

/*
 * Set as the callback method for when XmlHttpRequest State Changes 
 * used by retrieveUrl
 */
function processStateChange() {
	if (req.readyState == 4) { // Requisi??o completa
		if (req.status == 200) { // Resposta Ok - Sem erros
			/*
			 * Descomente a linha abaixo para "debugar" a resposta ? requisi??o.
			 */
			//alert("Ajax response:"+req.responseText);
			
			// Split the text response into Span elements
			//alert("Conteudo da tag erros:" + req.responseText );
			
			spanElements = splitTextIntoSpan(req.responseText);
			//alert(spanElements);

			/*
			 * Descomente a linha abaixo para visualizar os elementos span retornados na requisi??o.
			 */
			// alert(spanElements);
			
			//Use these span elements to update the page
			replaceExistingWithNewHtml(spanElements);
        
		} else {
			alert(ERRO_RESPOSTA_SERVIDOR + "\n " + req.statusText);
		}
	}
}
 
/**
 * gets the contents of the form as a URL encoded String
 * suitable for appending to a url
 * @param formName to encode
 * @return string with encoded form values , beings with &
 */ 
function getFormAsString(formName){
	returnString = "";

	if (formName != null) { 	
		// Captura os elementos do Html Form passado.
		formElements = document.forms[formName].elements;
	 	
		// Itera o array de elementos do Html Form definido e monta os par?metros de URL que ser?o enviados.
		for ( var i=formElements.length-1; i>=0; --i ){
			// Efetua um encode no que ser? enviado ao servidor.
			returnString = returnString + "\n&" + escape(formElements[i].name) + "=" + escape(formElements[i].value);
		}
	}
	return returnString; 
}

 
/**
 * Splits the text into <span> elements
 * @param the text to be parsed
 * @return array of <span> elements - this array can contain nulls
 */
function splitTextIntoSpan(textToSplit){
	//Split the document
	returnElements = textToSplit.split("</span>");
	
	//Process each of the elements 	
	for ( var i=returnElements.length-1; i>=0; --i ){
		//Remove everything before the 1st span
		spanPos = returnElements[i].indexOf("<span");
 		
		//if we find a match , take out everything before the span
		if(spanPos>0) {
			subString=returnElements[i].substring(spanPos);
			
			/*
			 * Descomente a linha abaixo para visualizar a SubString.
			 */
			//alert(subString);
			returnElements[i]=subString;
		} 
		
	}

	return returnElements;
}
 
/*
 * Replace html elements in the existing (ie viewable document)
 * with new elements (from the ajax requested document)
 * WHERE they have the same name AND are <span> elements
 * @param newTextElements (output of splitTextIntoSpan)
 * 		  in the format <span id=name>texttoupdate
 */
function replaceExistingWithNewHtml(newTextElements){
	//loop through newTextElements
	for ( var i=newTextElements.length-1; i>=0; --i ){
		//alert(newTextElements);

		//check that this begins with <span
		if(newTextElements[i].indexOf("<span") >- 1){
			//get the name - between the 1st and 2nd quote mark
			startNamePos=newTextElements[i].indexOf('"')+1;
			endNamePos=newTextElements[i].indexOf('"',startNamePos);
			name=newTextElements[i].substring(startNamePos,endNamePos);
 			
			//get the content - everything after the first > mark
			startContentPos=newTextElements[i].indexOf('>')+1;
			content=newTextElements[i].substring(startContentPos);
 			
			//Now update the existing Document with this element
 			
			//check that this element exists in the document
			if(document.getElementById(name)){
				//alert("Replacing Element:"+name);
				document.getElementById(name).innerHTML = content;
			} else {
				//alert("Element:"+name+"not found in existing document");
			}
		}
	}
}




/**
 * Requisita uma action no servidor.
 * urlAction - URL para capturar o conte?do. (Ex: /struts-ajax/nomeDaPagina.do?method=NOME_DO_METODO_A_EXECUTAR) 
 * nomeDoHtmlForm - Nome do Html Form que cont?m os dados que devem ser enviados para a p?gina requisitada.
 * scriptAExecutarAposProcessamentoAjax - comandos que ser?o executados ap?s a requisi??o da p?gina.
 * @author Daniel Melo S?. 
 */
function retrieveAction(urlAction, nomeDoHtmlForm, scriptAExecutarAposProcessamentoAjax) {
	urlAction = urlAction + "&resposta=" + getFormAsString(nomeDoHtmlForm);
	setScriptAExecutar(scriptAExecutarAposProcessamentoAjax);
	
	if (window.XMLHttpRequest) { // Non-IE browsers
		req = new XMLHttpRequest();
		req.onreadystatechange = processStateChangeForRetrieveAction;
		try {
			req.open("GET", urlAction, true); //was get
		} catch (e) {
			alert(ERRO_COMUNICACAO_SERVIDOR + "\n"+e);
		}
		req.send(null);
	} else if (window.ActiveXObject) { // IE
		req = new ActiveXObject("Microsoft.XMLHTTP");
		if (req) {
			req.onreadystatechange = processStateChangeForRetrieveAction;
			req.open("GET", urlAction, true);
			req.send();
		}
	}
}

var scriptAExecutar = "";
function processStateChangeForRetrieveAction() {
	if (req.readyState == 4) { // Requisição completa
		if (req.status == 200) { // Resposta Ok - Sem erros
			if (isExcecaoLancada(req.responseText)) {
				window.location = getUrlParaEncaminharException(req.responseText);
				//alert(getUrlParaEncaminharException(req.responseText));
			} else {
				var tmpScript = getScriptAExecutar() + "('" + xreplace(req.responseText, "\n", "").replace("\n", "") + "')";
				eval(tmpScript);
				tmpScript = "";
				setScriptAExecutar("");
			}
		} else {
			alert(ERRO_RESPOSTA_SERVIDOR + "\n " + req.statusText + "\nCodigo do erro: " + req.status);
		}
	}
}

function isExcecaoLancada(resposta) {
	var retorno = false;
	if (resposta != null && resposta != "") {
		var tmp = resposta.split(SEPARADOR);
		retorno = tmp[0] == EXCEPTION;
	}
	return retorno;
}

function getUrlParaEncaminharException(resposta) {
	return contexto + "/jsp/erro.jsp?mensagemDeErro=" + getMensagemDeExcecaoLancada(resposta);
}

function getMensagemDeExcecaoLancada(resposta) {
	var retorno = "";
	if (resposta != null && resposta != "") {
		var tmp = resposta.split(SEPARADOR);
		retorno = tmp[1];
	}
	return retorno;
}

function setScriptAExecutar(script) {
	scriptAExecutar = script;
}

function getScriptAExecutar() {
	return scriptAExecutar;
}