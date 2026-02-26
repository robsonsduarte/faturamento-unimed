image3 = new Image();
image3.src = "images/help.gif";
var ie4 = (document.all) ? true : false;
var ns4 = (document.layers) ? true : false;
var ns6 = (document.getElementById && !document.all) ? true : false;
	
function hidelayer(lay) {
	if (ie4) {document.all[lay].style.visibility = "hidden";}
	if (ns4) {document.layers[lay].visibility = "hide";}
	if (ns6) {document.getElementById([lay]).style.visibility = "hidden";}
}
	
function showlayer(lay) {
	if (ie4) {document.all[lay].style.visibility = "visible";}
	if (ns4) {document.layers[lay].visibility = "show";}
	if (ns6) {document.getElementById([lay]).style.visibility = "visible";}
}

function info(msg,nomeDoLayer) {
	document.write("<span class='janela-ajuda' style='position: absolute; margin-left: 20px;' id='"+nomeDoLayer+"'>"+msg+"</span>");
	document.write("<img align='top' src=\""+contexto+"/images/info.gif\" width=\"16\" height=\"16\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showlayer('"+nomeDoLayer+"');\">"); 
	hidelayer(nomeDoLayer); 
}

function info2(msg,nomeDoLayer) {
	document.write("<span class='janela-ajuda' style='position: absolute; margin-left: 20px;' id='"+nomeDoLayer+"'>"+msg+"</span>");
	document.write("<img align='top' src=\""+contexto+"/images/exclamation.gif\" width=\"16\" height=\"16\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showlayer('"+nomeDoLayer+"');\">"); 
	hidelayer(nomeDoLayer); 
}

function infoImagem(msg,nomeDoLayer,imagem) {
	document.write("<span class='janela-ajuda' style='position: absolute; margin-left: 20px;' id='"+nomeDoLayer+"'>"+msg+"</span>");
	document.write("<img align='top' src=\""+contexto+"/images/"+imagem+"\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showlayer('"+nomeDoLayer+"');\">"); 
	hidelayer(nomeDoLayer); 
}

function ajuda(msg,nomeDoLayer) {
	document.write("<span class='janela-ajuda' style='position: absolute; margin-left: 20px;' id='"+nomeDoLayer+"'>"+msg+"</span>");
	document.write("<img align='top' src=\""+contexto+"/images/help.png\" width=\"16\" height=\"16\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showlayer('"+nomeDoLayer+"');\">"); 
	hidelayer(nomeDoLayer); 
}

function motivo(msg,nomeDoLayer) {
	document.write("<span class='janela-motivo' id='"+nomeDoLayer+"'></span>");
	document.getElementById(nomeDoLayer).innerHTML = msg;
	var soma = "document.getElementById('"+nomeDoLayer+"').style.marginLeft = document.getElementById('"+nomeDoLayer+"').offsetWidth*(-1);";
	setTimeout( eval("soma") ,100);
	document.write("<img align='top' src=\""+contexto+"/images/info.gif\" width=\"16\" height=\"16\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showlayer('"+nomeDoLayer+"');\">"); 
	hidelayer(nomeDoLayer);
}

function janelaMotivo(nomeDoLayer) {
	document.write("<img align='top' id=\"img"+nomeDoLayer+"\" src=\""+contexto+"/images/info.gif\" width=\"16\" height=\"16\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showLayerMotivo('"+nomeDoLayer+"');\">");
	showLayerMotivo(nomeDoLayer);
	hidelayer(nomeDoLayer);
}

function janelaObservacaoAuditor(nomeDoLayer) {
	document.write("<img align='top' id=\"img"+nomeDoLayer+"\" src=\""+contexto+"/images/restricaoSAW.gif\" width=\"16\" height=\"16\" border=\"0\" onmouseout=\"hidelayer('"+nomeDoLayer+"');\" onmouseover=\"showLayerMotivo('"+nomeDoLayer+"');\">");
	showLayerMotivo(nomeDoLayer);
	hidelayer(nomeDoLayer);
}
	
function showLayerMotivo(nomeDoLayer) {	
	
	var tamanhoLayer = document.getElementById(nomeDoLayer).offsetWidth;
	var posicaoImg = getPosicaoElemento("img"+nomeDoLayer).left; 
	
	//alert(tamanhoLayer);
	//alert(posicaoImg);
	
	var soma = "";
	
	if(tamanhoLayer > posicaoImg){
		//alert("Ih � maior!");
		soma = "document.getElementById('"+nomeDoLayer+"').style.whiteSpace = 'normal';" + 
				"document.getElementById('"+nomeDoLayer+"').style.left = 5;" +
			   "document.getElementById('"+nomeDoLayer+"').style.width = "+posicaoImg+" - 20;" +
			   "showlayer('"+nomeDoLayer+"');";
	} else {
		//alert("Ih � menor!");
		soma = "document.getElementById('"+nomeDoLayer+"').style.whiteSpace = 'nowrap';" + 
				"document.getElementById('"+nomeDoLayer+"').style.left = "+(posicaoImg - tamanhoLayer)+"-15;" + 
		       "document.getElementById('"+nomeDoLayer+"').style.width = "+tamanhoLayer+";" +
		       "showlayer('"+nomeDoLayer+"');";
	}
	//setTimeout( eval("soma") ,100);
	eval(soma);
			
}

function bloquearBotaoVoltar(){
	history.pushState(null, document.title, location.href);
	window.addEventListener('popstate', function (event)
	{
	  history.pushState(null, document.title, location.href);
	});
}
