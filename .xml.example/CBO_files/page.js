//==============================================================================
//	CLASSE HASHMAP 	
//==============================================================================
	/**
	 * Classe que representa um HashMap diegoalves
	 */
	function Map() {
	    // variaveis de instancia
	    var keyArray = new Array(); // Keys
	    var valArray = new Array(); // Values
	        
		// registrando métodos como público
	    this.put = put;
	    this.get = get;
	    this.size = size;  
	    this.clear = clear;
	    this.keySet = keySet;
	    this.valSet = valSet;
	    this.showMe = showMe;   // retorna uma String com todas as chaves e
								// valores do mapa
	    this.findIt = findIt;
	    this.remove = remove;
		
	    function put(key, val) {
	    	var elementIndex = this.findIt(key);
	    	if (elementIndex == (-1)) {
	    		keyArray.push(key);
	    		valArray.push(val);
	    	}
	    	else {
	    		valArray[elementIndex] = val;
	    	}
	    }
	
	    function get(key) {
	    	var result = null;
	    	var elementIndex = this.findIt(key);
	    	
	    	if (elementIndex != (-1)) {   
	    		result = valArray[elementIndex];
	    	}  
	    	return result;
	    }
	
	    function remove(key) {
	    	var result = null;
	    	var elementIndex = this.findIt(key);
	    	
	    	if (elementIndex != (-1)) {
	    		keyArray = keyArray.removeAt(elementIndex);
	    		valArray = valArray.removeAt(elementIndex);
	    	}  
	    	return ;
	    }
	    
	    function size() {
	    	return (keyArray.length);  
	    }

	    function clear() {
	    	for (var i = 0; i < keyArray.length; i++) {
	    		keyArray.pop(); valArray.pop();   
	    	}
	    }

	    function keySet() {
	    	return (keyArray);
	    }
	    
	    function valSet() {
	    	return (valArray);   
	    }
	    
	    function showMe() {
	    	var result = "";
	    	
	    	for (var i = 0; i < keyArray.length; i++) {
	    		result += "Key: " + keyArray[i] + "\tValues: " + valArray[i] + "\n";
	    	}
	    	return result;
	    }
	    
	    function findIt(key) {
	    	var result = (-1);
	    	
	    	for (var i = 0; i < keyArray.length; i++) {
	    		if (keyArray[i] == key) {
	    			result = i;
	    			break;
	    		}
	    	}
	    	return result;
	    }

	    function removeAt(index) {
	    	var part1 = this.slice( 0, index);
	    	var part2 = this.slice( index+1 );
	    	
	    	return(part1.concat(part2));
	    }
	    Array.prototype.removeAt = removeAt;
	}

// ==============================================================================
// FIM DA IMPLEMENTAÇÃO DO HASH MAP
// ==============================================================================


/**
 * Prototipando a função String para suportar o método equals.
 * 
 * @author Daniel Melo Sá
 */
String.prototype.equals = function( outraString ) {
    return ( this == outraString );
}

var clientNavigator;
var designMode;

// Caso Internet Explorer(IE) outros (Other)
if (navigator.appName.indexOf('Microsoft') != -1){
	clientNavigator = "IE";
}else{
	clientNavigator = "Other";
}

function isBrowserInternetExplorer() {
	return clientNavigator == "IE";
}

function abreJanelaMaximizada(url){
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	win=window.open(url,'Wink',str); 
}

function abreJanelaMaximizadaNova(url){
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(url,'_blank',str); 
}

function abreJanelaMaximizadaAuditoria(url){
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(url,'_self',str); 
}

// tratamento padrão de erros
function myFunc(a,b,c) {
   alert("Error: "+a+" \r\n(Page: "+b+"  -   Line: "+c+")"); 
   return true;
}
window.onerror= myFunc;

function formataNumero(num,dec){
  num=String(num);
  if (num=="NaN") return num;
  if(dec==undefined) dec=2;
  sinal=(num<0)?"-":"";
  num=num.replace(/,/g,".");
  num= String(Math.abs(num));
  if (num=="NaN") return num;
  nm=Math.round(num*Math.pow(10,dec));
  inte = String(parseInt(num,10)); 
  if (inte.length>16) return "";
  l=Math.ceil(inte.length/3);
  c="___"; for (i=1; i<l; i++) c+=".___";
  p=String(num).lastIndexOf("."); dc=String(num).substr(p+1);
  d=",";  if (dec==0) d=""; 
  if ((p!=-1)||(dec>0)) {for (i=0; i<dec; i++) d+="_";}
  return sinal+FormatarInv(String(nm),c+d);
}

// remove formatação de numeros, deixando apenas um ponto decimal
// exemplo: limpaNumero("1.234,56") -> retorna 1234.56
function limpaNumero(c){
  c=c.replace(/,/g,".");
  p=c.lastIndexOf(".")
   if (p == -1) p = c.length;
  c=c.substr(0,p).replace(/\./g,"")+c.substr(p);
  return c;
}

function FormatarInv(Str, Fmt) {
// O mesmo que o anterior, iniciando pelo final do molde.
  var Sai = "";
  var j = Str.length-1;
  for (var i=Fmt.length-1; i>=0; i--)
    if (Fmt.substring(i,i+1)=="_") {
       Sai = Str.substring(j,j+1) + Sai;
       j = j - 1;
       if (j<0) break;
    } else {
      Sai = Fmt.substring(i, i+1) + Sai;
    }
  return Sai;
}

var wiObj = null;
function msgErr(obj,msg) {
   if (msg!="") alert (msg);
   wiObj = obj;
   setTimeout("selObj()",10);
}

function selObj () {
   if (!wiObj) return;
   wiObj.focus(); 
   wiObj.select();
   wiObj = null;
}

function mTr(s,s1,s2) {
   var p;
   var sai="";
   for (var j=0; j<s.length; j++) {
    p=s1.indexOf(s.substring(j,j+1));
    sai=sai + (p<0 ? s.substring(j, j+1) : s2.substring(p, p+1));
   }
   return sai;
}

function Limpar(valor, validos) {
// retira caracteres invalidos da string
  var result = "";
  var aux;
  for (var i=0; i < valor.length; i++) {
    val = valor.substring(i, i+1);
    aux = validos.indexOf(val);
      if (aux>=0) {
        result += val;
      }
  }
  return result;
}

/**
 * retorna -1 se data nao tiver 6 ou 8 digitos numericos
 * retorna -2 se mes for invalido
 * retorna -3 se dia for invalido
 * retorna a data (dd/MM/yyyy) se ok
 */
function cData(data, mask) {
	var numdias = -1;
	data = Limpar(data,"0123456789");
	
	if ((data.length != 8) &&(data.length != 6)) { 
		return -1; 
	}
	
	// transforma os valores em inteiros
	var dia = parseInt(data.substring(0,2),10);
	var mes = parseInt(data.substring(2,4),10);
	var ano = parseInt(data.substring(4),10);
	
	// corrige ano (no caso de ter apenas 2 digitos)
	if (ano < 100) { 
		if (ano < 50) { 
			ano += 2000; 
		} else { 
			ano += 1900; 
		}
	}
	
	// verifica o mes
	if (mes > 12) { 
		return -2; 
	}
	// verifica o numero de dias do mes
	switch (mes) {
		case 1: case 3: case 5: case 7: case 8: case 10: case 12:
		    numdias = 31;
		    break;
		case 4: case 6: case 5: case 9: case 11:
		    numdias = 30;
		    break;
		case 2:
			if (bissexto(ano)) { 
				numdias = 29; 
			} else {
				numdias = 28; 
			}
	}
	// verifica o numero de dias
	if (dia > numdias || dia == 0) {
		return -3; 
	}
	sdia = ((dia<10) ? "0" : "") + dia;
	smes = ((mes<10) ? "0" :  "") + mes;
	sano4 = ano+""; 
	sano2= (ano+"").substring(2,4);
	d = /dd/; m = /MM/; y2 = /yy/; y4= /yyyy/;
	ret = mask.replace(d, sdia).replace(m, smes).replace(y4, sano4).replace(y2, sano2);
	return ret;
}

/**
 * retorna -1 se data nao tiver 4
 * retorna -2 se mes for invalido
 * retorna -3 se dia for invalido
 * retorna a data (dd/MM) se ok
 */
function cDataDiaMes(data, mask) {
	var numdias = -1;
	data = Limpar(data,"0123456789");
	if ((data.length != 4)) { 
		return -1; 
	}
	
	// transforma os valores em inteiros
	var dia = parseInt(data.substring(0,2),10);
	var mes = parseInt(data.substring(2,4),10);
	// verifica o mes
	if (mes > 12) { 
		return -2; 
	}
	
	// verifica o numero de dias do mes
	switch (mes) {
		case 1: case 3: case 5: case 7: case 8: case 10: case 12:
		    numdias = 31;
		    break;
		case 4: case 6: case 5: case 9: case 11:
		    numdias = 30;
		    break;
		case 2:
			numdias = 29; 
			
	}
	// verifica o numero de dias
	if (dia > numdias || dia == 0) {
		return -3; 
	}
	sdia = ((dia<10) ? "0" : "") + dia;
	smes = ((mes<10) ? "0" :  "") + mes;
	d = /dd/; m = /MM/;
	ret = mask.replace(d, sdia).replace(m, smes);
	return ret;
}

/**
 * Função utilizada para validar Data e Hora, segundo um formato padrão ou de acordo com o definido pelo programador. 
 * retorna -1 se data nao tiver 6 ou 8 digitos numericos
 * retorna -2 se mes for invalido
 * retorna -3 se dia for invalido
 * retorna -4 se hora/minuto nao tiver 4 digitos numericos
 * retorna -5 se hora for invalida
 * retorna -6 se minuto for invalido
 * retorna a dataHora (ddmmaaaa) se ok
 */
function cDataHora(dataHora, mask) {
	var dataFormatada = dataHora.substring(0,10);
	var horaFormatada = dataHora.substring(11,16);
	
	var validacaoData = cData(dataFormatada, "dd/MM/yyyy");
	if (validacaoData < 0) return validacaoData;
	
	var validacaoHora = cHora(horaFormatada, "hh:mm");
	switch (validacaoHora) {
		case -1:
			validacaoHora = -4;
			break;
		case -2: 
			validacaoHora = -5;
			break;
		case -3:
			validacaoHora = -6;
			break;
	}
	if (validacaoHora < 0) return validacaoHora;
	return validacaoData + " " + validacaoHora;
}

/**
 * Função utilizada para validar Hora, segundo um formato padrão ou de acordo com o definido pelo programador.
 * retorna -1 se hora/minuto nao tiver 4 digitos numericos
 * retorna -2 se hora for invalida
 * retorna -3 se minuto for invalido
 */
function cHora(horaMinuto, mask) {
	var baseDecimal = 10;
	
	if (!mask || mask== "") mask = "hh:mm";
	horaMinuto = Limpar(horaMinuto,"0123456789");
	
	if ( (isNaN(horaMinuto)) || (horaMinuto.length < 4) || (horaMinuto.length > 4)) {
		return -1;
	}
	var hora = parseInt(horaMinuto.substring(0,2), baseDecimal);
	var minuto = parseInt(horaMinuto.substring(2,4), baseDecimal);
	
	if (hora > 23) {
		return -2;
	}
	if (minuto > 59) {
		return -3;
	}
	
	var strHora = ((hora < 10)? "0" : "") + hora;
	var strMinuto = ((minuto < 10)? "0" : "") + minuto; 
	
	h = /hh/; m = /mm/;
	ret = mask.replace(h, strHora).replace(m, strMinuto); 
	return ret;
}

function bissexto(strano) {
/* retorna true se o ano for bissexto */
  var ano = parseInt(strano+"",10);
  if ((ano%4)!= 0) { return false; }
  if (((ano%100) == 0) &&((ano%400)!=0)) { return false; }
  return true;
}



function CPFdv(CPF) {
  CPF = Limpar(CPF,"0123456789");
  if (CPF.length != 9) { return ""; }
  var soma = 0;
  var checar = CPF.substring(9);
  CPF = CPF.substring(0,9);
  for (var i=0; i<9; i++) { 
    soma = soma + CPF.substring(i,i+1)*(10-i);
  }
  var cpfdv = 11 - (soma % 11);
  if ( cpfdv >= 10 ) { 
    cpfdv = 0;
  }
  soma = 0;
  for (var i=0; i<9; i++) {
    soma = soma + CPF.substring(i,i+1)*(11-i);
  }
  soma = soma + cpfdv * 2;
  var cpfdv2 = 11 - (soma%11);
  if ( cpfdv2 >= 10 ) { 
    cpfdv2 = 0;
  }
  cpfdv += ""+cpfdv2;
  return cpfdv;
}

function piece(str,delim,ind) {
   var aux = str.split(delim);
   if (ind <= aux.length) {
     return aux[ind-1];
   }
}   


// ----- Funções para validação de campos
// @list=chkNum(this)
function chkNum(obj, msg) {
   if (designMode) return;
   if (!obj || obj.value=="") return;
   var ini = obj.value.charAt(0)+obj.value.charAt(obj.value.length-1)
   if (ini=="||") return;
   var n = formataNumero(obj.value);
   if (n=="NaN") {
      if (!msg || msg=="") msg = "Não é um número válido";
      return msgErr (obj, msg);
   } else
   obj.value = n;
}

// @list=chkInteiro(this)
function chkInteiro(obj, msg) {
   if (!obj || obj.value=="") return;
   obj.value = obj.value.replace("-","a"); //Substitui traços por "a" para poder validar somente números positivos
   obj.value = obj.value.replace(" ","a"); //Substitui espaços em branco por "a" para poder validar espaços em branco como caracteres
   var n = formataNumero(obj.value);
   if (n=="NaN") {
      if (!msg || msg=="") msg = "Campo deve ser Numérico!";
      obj.value = '';
      return msgErr(obj, msg);
   }
   else {
      obj.value = obj.value;
   }
}
//@list=chkInteiro2(this): a chkInteiro aceita números decimais como inteiro. Criada uma nova pois a anterior é utilizada em várias jsp
function chkInteiro2(obj, msg) {
   if (!obj || obj.value=="") return;
   obj.value = obj.value.replace("-","a"); //Substitui traços por "a" para poder validar somente números positivos
   obj.value = obj.value.replace(" ","a"); //Substitui espaços em branco por "a" para poder validar espaços em branco como caracteres
   obj.value = obj.value.replace(".","a"); //Substitui ponto por "a" para poder validar espaços em branco como caracteres
   obj.value = obj.value.replace(",","a"); //Substitui vírgula por "a" para poder validar espaços em branco como caracteres
   var n = formataNumero(obj.value);
   if (n=="NaN") {
      if (!msg || msg=="") msg = "Campo deve ser Inteiro!";
      obj.value = '';
      return msgErr(obj, msg);
   }
   else {
      obj.value = obj.value;
   }
}
function validaInteiro(obj, msg) {
	   if (!obj || obj.value=="") return;
	   obj.value = obj.value.replace("-","a"); //Substitui traços por "a" para poder validar somente números positivos
	   obj.value = obj.value.replace(" ","a"); //Substitui espaços em branco por "a" para poder validar espaços em branco como caracteres
	   var n = formataNumero(obj.value);
	   if (n=="NaN") {
	      if (!msg || msg=="") msg = "Campo deve ser Numérico!\n";
	      return msg;
	   }
	   return '';
	}

// @list=fmtNum(this)
function fmtNum(obj) {
   if (designMode) return;
   if (!obj || obj.value=="") return;
   obj.value = limpaNumero(obj.value)
}

function mcep(v){
    v=v.replace(/\D/g,"");                    //Remove tudo o que não é dígito
    v=v.replace(/^(\d{5})(\d)/,"$1-$2");         //Esse é tão fácil que não merece explicações
    return v
}

// @list=chkCep(this)
function chkCep(obj,msg) {
   if (!msg || msg=="") msg = "Não é um número válido";
   if (designMode) return;
   if (!obj) return;
   var val=mTr (obj.value, ",.-/", "");
   if (obj.value=="") return;
   msg = msg +  " Deve conter 8 números"
   if (val.length!=8) return msgErr(obj,msg);
   if (Limpar(val, "0123456789") != val) return msgErr(obj,msg);
   obj.value = FormatarInv(val, "_____-___");
}
// @list=chkData(this,"dd/MM/yyyy")
function chkData(obj, mask, msg) {
   if (designMode) return;
   if (!obj || obj.value=="") return;
   if (!mask || mask== "") mask = "dd/MM/yyyy";
   var st = cData(obj.value, mask);
   if (!msg) msg = "";
   obj.value = "";
   if (st == -1) return msgErr(obj, msg + " Deve conter 6 ou 8 números");
   if (st == -2) return msgErr(obj, msg + " Mês inválido");
   if (st == -3) return msgErr(obj, msg + " Dia inválido");
   obj.value =  st;
}


function chkDataDiaMes(obj, mask, msg) {
   if (designMode) return;
   if (!obj || obj.value=="") return;
   if (!mask || mask== "") mask = "dd/MM/yyyy";
   var st = cDataDiaMes(obj.value, mask);
   if (!msg) msg = "";
   obj.value = "";
   if (st == -1) return msgErr(obj, msg + " Deve conter 4 números");
   if (st == -2) return msgErr(obj, msg + " Mês inválido");
   if (st == -3) return msgErr(obj, msg + " Dia inválido");
   obj.value =  st;
}

function chkDataMaiorOuIgual(obj1, obj2, msg) {
	if(obj1 && obj1.value != '' && obj2 && obj2.value != '') {
		if(dataMaior(obj1.value, obj2.value)) {
			if(msg && msg != '') alert(msg);
			else alert('A data inicial é superior à data final!');
			return false;
		}
	}
	return true;
}

function chkDataMaiorOuIgualDiaMes(obj1, obj2, msg) {
	if(obj1 && obj1.value != '' && obj2 && obj2.value != '') {
		if(dataMaiorDiaMes(obj1.value, obj2.value)) {
			if(msg && msg != '') alert(msg);
			else alert('A data inicial é superior à data final!');
			return false;
		}
		if(dataIgualDiaMes(obj1.value, obj2.value)){
			if(msg && msg != '') alert(msg);
			else alert('A data inicial é igual à data final!');
			return false;
		}
	}
	return true;
}

function isDataEhValida(obj, mask, msg) {
	if (designMode) {
		return false;
	}
	if (!obj || obj.value=="") {
		return false;
	}
	if (!mask || mask== "") {
		mask = "dd/MM/yyyy";
	}
	var st = cData(obj.value, mask);
	if (!msg) {
		msg = "";
	}
	if (st == -1 || st == -2 || st == -3) {
		return false;
	}
	obj.value =  st;
	return true;
}

function isDataHoraValida(obj, mask, msg){
	
	   if (designMode){ 
		   return false;
	   }
	   if (!obj || obj.value == ""){
		   return false;
	   }
	   if (!mask || mask== "")mask = "dd/MM/yyyy mm:hh";
	   var st = cDataHora(obj.value, mask);
	   if (!msg){
		   msg = "";
	   }
	   if (st == -1) {
		   return msgErr(obj, msg + " Data deve conter 6 ou 8 números");
	   }
	   if (st == -2){
		   return msgErr(obj, msg + " Mês inválido");
	   }
	   if (st == -3) {
		   return msgErr(obj, msg + " Dia inválido");
	   }
	   if (st == -4){
		   return msgErr(obj, msg + " Informar hora/minuto no formato HH:MM");
	   }
	   if (st == -5){
		   return msgErr(obj, msg + " Hora inválida");
	   }
	   if (st == -6){
		   return msgErr(obj, msg + " Minuto inválido");
	   }
	   obj.value =  st;
	   return true;
}

function chkDataHora(obj, mask, msg) {
   if (designMode) return;
   if (!obj || obj.value == "") return;
   if (!mask || mask== "") mask = "dd/MM/yyyy mm:hh";
   var st = cDataHora(obj.value, mask);
   if (!msg) msg = "";
   if (st == -1) return msgErr(obj, msg + " Data deve conter 6 ou 8 números");
   if (st == -2) return msgErr(obj, msg + " Mês inválido");
   if (st == -3) return msgErr(obj, msg + " Dia inválido");
   if (st == -4) return msgErr(obj, msg + " Informar hora/minuto no formato HH:MM");
   if (st == -5) return msgErr(obj, msg + " Hora inválida");
   if (st == -6) return msgErr(obj, msg + " Minuto inválido");
   obj.value =  st;
}


var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	// Regexes and supporting functions are cached through closure
	return function (date, mask, utc) {
		var dF = dateFormat;

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? new Date(date) : new Date;
		if (isNaN(date)) throw SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			utc = true;
		}

		var	_ = utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  dF.i18n.dayNames[D],
				dddd: dF.i18n.dayNames[D + 7],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  dF.i18n.monthNames[m],
				mmmm: dF.i18n.monthNames[m + 12],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		return mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});
	};
}();

// Some common format strings
dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
	dayNames: [
		"Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab",
		"Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
	],
	monthNames: [
		"Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
		"Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
	]
};

// For convenience...
Date.prototype.format = function (mask, utc) {
	return dateFormat(this, mask, utc);
};

function chkDataMaiQueAtual(obj, msg) {
	if(obj && obj.value != '') {
		if(verificarSeDataEMaiorQueAAtual(obj)) {
			return true;
		}
	}
	return false;
}

// verificarSeDataEMaiorQueAAtual
function verificarSeDataEMaiorQueAAtual(data) {
	if (data.value == ''){
		return false;
	} 
	mask = 'dd/MM/yyyy'; 
	msg = ''; 
	var st = cData(data.value, mask); 
	if (st == -1){
		msgErr(data, msg + ' Deve conter 6 ou 8 números');
		return false;
	} 
	if (st == -2){
		msgErr(data, msg + ' Mês inválido');
		return false;
	}
	if (st == -3){
		msgErr(data, msg + ' Dia inválido');
		return false;
	}
	data.value = st; var dataForm = st.split('/'); 
	var dataAtual = new Date(); 
	var currentMonth = dataAtual.getMonth(); currentMonth++; 
	var dataInformada = new Date(dataForm[2], dataForm[1]-1, dataForm[0]); 
	if ( dataAtual < dataInformada ) { 
		msgErr(data, ' A data informada [' + st + '] é MAIOR QUE a data atual [' + dataAtual.getDate() + '/' + currentMonth + '/' + dataAtual.getFullYear() + ']');
		return false;
	} 
	
	return true;
}

function chkDataHoraMaiorQueAtual(obj, msg, id) {
	var valorCampoOriginal = document.getElementById(id).value;
	var novoObjeto = obj;
	novoObjeto.value = novoObjeto.value.substring(0,10);
	var retorno =  chkDataMaiQueAtual (novoObjeto, msg);
	document.getElementById(id).value =  valorCampoOriginal;
	if(!retorno){
		obj.value = '';
		obj.focus();
	}
	return retorno;
}

// @list=chkCNPJ(this)
function chkCNPJ(obj, msg) {
   if (!msg) msg = "";
   if (designMode) return;
   if (!obj || obj.value == "") return;
   
   var CNPJ = obj.value.replace(/[^\w]/g, ""); // Permite números e letras
   if (!/^[A-Z0-9]{14}$/i.test(CNPJ)) { 
       return msgErr(obj, msg + " Deve conter 14 caracteres alfanuméricos");
   }

   if (CNPJdv(CNPJ.substring(0,12)) == CNPJ.substring(12)) {
       return fmtCNPJ(obj);
   } else {
       msgErr(obj, msg + " CNPJ incorreto");
   }
}

// @list=fmtCNPJ(this)
function fmtCNPJ(obj) {
   if (!obj || obj.value == "") return;
   
   var CNPJ = obj.value.replace(/[^\w]/g, ""); // Remove caracteres especiais (mantém letras e números)
   if (CNPJ.length !== 14) return "";

   // Converte letras para números antes da formatação
   var CNPJConvertido = converterAlfanumericoParaNumerico(CNPJ);

   var parte1 = CNPJConvertido.substring(0, 2);
   var parte2 = CNPJConvertido.substring(2, 5);
   var parte3 = CNPJConvertido.substring(5, 8);
   var parte4 = CNPJConvertido.substring(8, 12);
   var parte5 = CNPJConvertido.substring(12, 14);
   
   obj.value = parte1 + "." + parte2 + "." + parte3 + "/" + parte4 + "-" + parte5;
}

function converterAlfanumericoParaNumerico(cnpj) {
   var resultado = "";
   for (var i = 0; i < cnpj.length; i++) {
       var char = cnpj[i];
       if (char.match(/[0-9]/)) {
           resultado += char; // Mantém números
       } else {
           resultado += (char.charCodeAt(0) - 48); // Converte letras para números baseados no ASCII e reduzido 48, conforme nova regra de CNPJ
       }
   }
   return resultado;
}


// @list=chkCPF(this)
function chkCPF(obj, msg) {
   if (!msg) msg = "";
   if (designMode) return;
   if (!obj || obj.value=="") return;
   var CPF = obj.value;
  CPF = Limpar(CPF,"0123456789");
  if (CPF.length != 11 || (chkNumerosIguais(CPF) == true)) { 
	  obj.value="";
	  obj.focus();
	  msgErr(obj, msg + " Deve conter 11 números");
	  return false;
  }
  if (CPFdv(CPF.substring(0,9)) == CPF.substring(9)) {
    return fmtCPF(obj);
  }
  else {
	obj.value="";
	obj.focus();
    msgErr(obj, msg + " CPF incorreto");
  }
}

// @list=fmtCPF(this)
function fmtCPF(obj) {
   if (!obj || obj.value=="") return;
   var CPF = obj.value;
  CPF = Limpar(CPF,"0123456789");
  if (CPF.length != 11) { return ""; }
  var parte1 = CPF.substring(0,3);
  var parte2 = CPF.substring(3,6);
  var parte3 = CPF.substring(6,9);
  var parte4 = CPF.substring(9,11);
  obj.value = parte1 + "." + parte2 + "." + parte3 + "-" + parte4;
}

// @list=chkNumerosIguais(this)
function chkNumerosIguais(obj) {
	var digitos_iguais = [];
	for(let i = 0; i < obj.length - 1; i++){
		if (obj.charAt(i) != obj.charAt(i + 1)) {
			digitos_iguais[i] = 0;
		} else {
			digitos_iguais[i] = 1;
		}
	}
	if(digitos_iguais.includes(0)) {
		return false;
	} else {
		return true;
	}
}

// @list=chk (this)
function chkEmail(obj, msg) {
   if (designMode) return;
   if (obj.value=="") return;
   if (!msg) msg = "";
   var dlm=", ",s="";
   var array = obj.value.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
   if (array)
      for (var i=0; i<array.length; i++) {
         if (i!=0) s+=dlm;
         s+=array[i];
      }
   if (s=="") {
	   obj.value = '';
	   return msgErr(obj, msg + " Formato inválido do e-mail");
   }
   return "";
}

function chkEmail2(obj, msg) {
	   if (designMode) return;
	   if (obj.value=="") return;
	   if (!msg) msg = "";
	   var dlm=", ",s="";
	   var array = obj.value.match(/^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,4}$/gi);
	   if (array)
	      for (var i=0; i<array.length; i++) {
	         if (i!=0) s+=dlm;
	         s+=array[i];
	      }
	   if (s=="") {
		   obj.value = '';
		   return msgErr(obj, msg + " Formato inválido do e-mail");
	   }
	   return "";
	}


function validaEmail(obj, msg) {
	   if (designMode) return;
	   if (obj.value=="") return;
	   if (!msg) msg = "";
	   var dlm=", ",s="";
	   var array = obj.value.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
	   if (array)
	      for (var i=0; i<array.length; i++) {
	         if (i!=0) s+=dlm;
	         s+=array[i];
	      }
	   if (s=="") return msg == '' ? " Formato inválido do e-mail" : msg;
	   return "";
	}


function mascaraMutuario(o, f) {
    if (o.value != '') {
        v_obj = o;
        v_fun = f;
        setTimeout('execmascara()', 1);
    }
}

function execmascara(){
    v_obj.value=v_fun(v_obj.value)
}
 
function cpfCnpj(v) {
	v = v.toUpperCase()
	var vSemMascara = v.replace(/[.\-\/]/g, "");
    if (vSemMascara.length === 14) { 
        v = v.replace(/[^\w]/g, ""); 
    } else {
        v = v.replace(/\D/g, ""); 
    }

    // Se for CPF (11 dígitos)
    if (vSemMascara.length === 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } 
    // Se for CNPJ alfanumérico (14 dígitos)
    else if (vSemMascara.length === 14) {
        // Verifica se o CNPJ é válido
        if (!isCnpjValido(v)) {
            alert("CNPJ inválido!");
            return "";
        }
        
        v = v.replace(/^(\w{2})(\w)/, "$1.$2");
        v = v.replace(/^(\w{2})\.(\w{3})(\w)/, "$1.$2.$3");
        v = v.replace(/\.(\w{3})(\w)/, ".$1/$2");
        v = v.replace(/(\w{4})(\w)/, "$1-$2");
    } else {
        alert("CNPJ/CPF inválido!");
        return "";
    }

    return v;
}
// @list=chkTime(this)
function chkTime(obj, msg) {
 if (designMode) return;
 var val=obj.value;
 if (val=="") return;
 if (!msg) msg = "";
 val = mTr (val, "h.,", ":::");
 if (Limpar(val, ":0123456789") != val) return msgErr(obj, msg + " Digite somente números");
 if (val.indexOf(":")<0) val = val.substring(0,2) + ":" + val.substring(2,4);
 var H = eval (piece(val, ":", 1) + " + 0");
 var M = eval (piece(val, ":", 2) + " + 0");

 if (H>23){
	 obj.value = '';
	 return msgErr(obj,msg+" Hora inválida ");
	
 }
 if (M>59) {
	 obj.value = '';
	 return msgErr(obj,msg+" Minuto inválido");
 }
 H = "" + H;
 M = "" + M;
 if (H.length==1) H="0" + H;
 if (M.length==0) M="00";
 if (M.length==1) M="0" + M;
 obj.value = FormatarInv("" + H + M, "__:__");
}

	function formataTelefone(element, e){
    formataCampo(element,e,"#");
    if (e.keyCode != 8) {
        var tamanho = element.value.length;
        if (tamanho == 2){
            if (element.value.charAt(0)!="("){
                element.value = "(" + element.value + ")";
            }
        }
        if (tamanho == 3){
            if (element.value.charAt(0)=="("){formataTelefone
                element.value += ")";
            }
        }
        if (tamanho == 9){
            element.value += "-";
        }
        if (tamanho == 10){
            element.value += "-";
        }
    }
}

	function formataTelefoneSAC(element, e){
		  formataCampo(element,e,"#");
		  if (e.keyCode != 8){
		    var tamanho = element.value.length;
		    
		    if(tamanho >= 2 && element.value.charAt(0) == 0 && element.value.charAt(1) == 8 ){
		    	if (tamanho == 4){
		    		element.value += "-";
		    	}
		    }else{
		    	if (tamanho == 2){
		    		if (element.value.charAt(0)!="("){
		    			element.value = "(" + element.value + ")";
		    		}
		    	}
		    	if (tamanho == 3){
		    		if (element.value.charAt(0)=="("){
		    			element.value += ")";
		    		}
		    	}
		    	if (tamanho == 8){
		    		element.value += "-";
		    	
		    
		 	 }
			}
		}
	}
	
	function chkTelefoneSAC(element, msg){
		if (designMode) return "";
		if (element.value=="") return "";
		if (!msg) msg = "";
		if (element.value.length != 13) {
			if (!(element.value.length == 12 && element.value.charAt(0) == 0 && element.value.charAt(1) == 8 && element.value.charAt(2) == 0 && element.value.charAt(3) == 0)) {
				element.value = '';
				return msgErr(element,"O telefone deve conter 13 caracteres no formato (##)####-#### ou 12 caracteres no formato 0800-#######!");
			}
		}else if (element.value.charAt(0) != "(" || element.value.charAt(3) != ")" || element.value.charAt(8) != "-" || formataNumero(element.value.replace("(","").replace(")","").replace("-","")) == "NaN") { 
			element.value = '';
			return msgErr(element, "O telefone deve possuir o formato (##)####-####!");
		}else if(element.value=="(00)0000-0000"){
			element.value = '';
			return msgErr(element, "Número de telefone inválido");
		}
	}
	
function chkTelefone(element, msg){
    if (designMode) return "";
    if (element.value == "") return "";
    if (!msg) msg = "";

    if (element.value.length !== 13 && element.value.length !== 14) {
        element.value = '';
        return msgErr(element, "O telefone deve conter 13 ou 14 caracteres no formato (##)####-#### ou (##)X ####-####!");
    }
    if (element.value.charAt(0) != "(" || element.value.charAt(3) != ")" || 
        (element.value.charAt(8) != "-" && element.value.charAt(9) != "-") || 
        formataNumero(element.value.replace("(", "").replace(")", "").replace("-", "")) == "NaN") { 
        element.value = '';
        return msgErr(element, "O telefone deve possuir o formato (##)####-#### ou (##)X ####-####!");
    }
    if (element.value == "(00)0000-0000") {
        element.value = '';
        return msgErr(element, "Número de telefone inválido");
    }
}

function validaTelefone(element){
    if (designMode) return "";
    if (element.value == "") return "";
    if (element.value.length !== 13 && element.value.length !== 14) {
        element.value = '';
        return "O telefone deve conter 13 ou 14 caracteres no formato (##)####-#### ou (##)X ####-####!\n";
    }
    if (element.value.charAt(0) != "(" || element.value.charAt(3) != ")" || 
        (element.value.charAt(8) != "-" && element.value.charAt(9) != "-") || 
        formataNumero(element.value.replace("(", "").replace(")", "").replace("-", "")) == "NaN") { 
        return "O telefone deve possuir o formato (##)####-#### ou (##)X ####-####!\n";
    }

    return '';
}

// função para substituir o window.open e window.location que não aceita seguran?a ativa
//@list

function wiOpen(url, target, props) {
   if (target) {
      if (target.toLowerCase()=="_blank") {
         target = Date.parse(new Date())+new Date().getMilliseconds();
      }
   } else target = "_self";
   var frm = document.createElement("FORM");
   frm.action = url;
   frm.target = target;
   frm.method = "post";
   document.body.appendChild(frm);
   var wnd;
   if (target!="")  {
      wnd = window.open('',target,props);
   }
   frm.submit();
   document.body.removeChild(frm);
   return wnd;
}

// verifica se algum campo obrigatório de um form deixou de ser preenchido
// exemplo de INPUT: (deve conter a expressão requerid="true")
//   <input type="text" required="true" name="texto2">
// parametro: frm = form a ser submetido
//          :  msg = mensagem de erro
// usar em OnSubmit do form.
//@list=chkRequired(this)
function chkRequired(frm, msg){

   if (!msg || msg=="") msg="Campo obrigatório não preenchido";
   for (var i=0; i<frm.elements.length; i++) {
      if (frm.elements[i].getAttribute("required")=="true"){
         var ok = false;
         if (frm.elements[i].type.toLowerCase()=="radio") {
            for (var j=0; j<frm[frm.elements[i].name].length; j++) {
               if (frm[frm.elements[i].name][j].checked) {
                  ok = true; 
                  break
               }
            }
         }
         else 
             ok = !(frm.elements[i].value=="");
         if (!ok) 
         {
            alert(msg);
            frm.elements[i].focus();
            return false;
         }
      }
  }
  return true;
}

// @list=upperCase(this)
function upperCase(obj)
{
     var maius = obj.value;	
     obj.value = maius.toUpperCase();
     return obj;
}

function fechaJanela() {
	self.close();
}

function abreJanela(url,target,width,height) {
	var left = Math.floor( (screen.width - width) / 2);
	var top = Math.floor( (screen.height - height) / 2);
	if(width==0) {
		width=screen.width;
	}
	if(height==0) {
		width=screen.height;
	}
   	var winParms = "top=" + top + ",left=" + left + ",height=" + height + ",width=" + width;
   //var win = window.open(url, name, winParms);
   //if (parseInt(navigator.appVersion) >= 4) { win.window.focus(); }
   //return win;
 	var	popupWin;
 	popupWin = window.open(url,target,'nomenubar,notoolbar,nolocation,nodirectories,nostatus,dependent,alwaysRaised=yes,scrollbars=yes'+','+winParms);
//window.open(url,target,'nomenubar,notoolbar,nolocation,nodirectories,nostatus,dependent,alwaysRaised=yes,width='+w+',height='+h);
	try{
		popupWin.focus();
	}catch(E){}
	
}

function abreJanelaBiometria(url,target,width,height) {
	var left = Math.floor( (screen.width - width) / 2);
	var top = Math.floor( (screen.height - height) / 2);
	if(width==0) {
		width=screen.width;
	}
	if(height==0) {
		width=screen.height;
	}
   	var winParms = "top=" + top + ",left=" + left + ",height=" + height + ",width=" + width;
 	var	popupWin;
 	popupWin = window.open(url,target,'nomenubar,notoolbar,nolocation,nodirectories,nostatus,dependent,alwaysRaised=yes,scrollbars=no'+','+winParms);
}

function abreJanela1(url,target,width,height) {
	var left = Math.floor( (screen.width - width) / 2);
	var top = Math.floor( (screen.height - height) / 2);
   	var winParms = "top=" + top + ",left=" + left + ",height=" + height + ",width=" + width;
   // var win = window.open(url, name, winParms);
   // if (parseInt(navigator.appVersion) >= 4) { win.window.focus(); }
   // return win;
   	popupWin = window.open(url,target,'nomenubar,nolocation,nodirectories,nostatus,dependent,alwaysRaised=yes'+','+winParms);
// window.open(url,target,'nomenubar,notoolbar,nolocation,nodirectories,nostatus,dependent,alwaysRaised=yes,width='+w+',height='+h);
	popupWin.focus();
}
function openWin(newURL, newName, newFeatures, orgName) {
	var newWin = open(newURL, newName, newFeatures);
	if(newWin.opener == null)
		newWin.opener = window;
	return newWin;
}

function openCenteredWindow(url, height, width, name, parms) {
   var left = Math.floor( (screen.width - width) / 2);
   var top = Math.floor( (screen.height - height) / 2);
   var winParms = "top=" + top + ",left=" + left + ",height=" + height + ",width=" + width;
   if (parms) { winParms += "," + parms; }
   var win = window.open(url, name, winParms);
   if (parseInt(navigator.appVersion) >= 4) { win.window.focus(); }
   return win;
}

/*function doOpenRemote(aURL, newName, aHEIGHT, aWIDTH, aFeatures, orgName) {
	alert('fazendp');
	if(!aHEIGHT || aHEIGHT == "*") {
		aHEIGHT = (screen,availHeight - 80);
	}
	if(!aWIDTH || aWIDTH == "*") {
		aHEIGHT = (screen,availHeight - 30);
	}
	var newFeatures += "height=" + aHEIGHT + ",innerHeight=" + aHEIGHT;
	newFeatures += ",width=" + aWIDTH + ",innerWidth=" + aWIDTH;
	if(window.screen) {
		var ah = (screen.availHeight - 30);
		var aw = (screen.availWidth - 10);
		var xc = (( aw - aWIDTH / 2);
		var yc = (( aw = aHEIGHT /2);
		newFeatures += ",left=" + xc + ",screenX=" + xc;
		newFeatures += ",top=" + yc + ",screenY=" + yc;
		newFeatures += "," + aFeatures;
	}
	var newWin = openWin(aURL, newName, newFeatures, orgName);
	newWin.focus();
	return newWin;
}*/

function mostra(input,nm) {
      var targetId, objeto, targetElement;
      nome = nm;
      objeto = window.event.srcElement;
      for (i = 0; i < 2; i++) {
         document.forms[0].tipo[i].checked = false;
         targetId = "Out" + i + "div";
         targetElement = document.all(targetId);
         targetElement.style.display = "none"; 
      }
      document.forms[0].tipo[input].checked = true;
      targetId = objeto.id + "div";
      targetElement = document.all(targetId);
      targetElement.style.display = "none";
      if (targetElement.style.display == "none") {
         targetElement.style.display = "true";
      }  
      /*  var targetId, objeto, targetElement;
      nome = nm;
      objeto = window.event.srcElement;
      for (i = 0; i < 4; i++)
      {
         document.forms[0]["tmp.tipo"][i].checked = false;
         targetId = "Out" + i + "div";
         targetElement = document.all(targetId);
         targetElement.style.display = "none"; 
      }      
      document.forms[0]["tmp.tipo"][input].checked = true;

      targetId = objeto.id + "div";
      targetElement = document.all(targetId);
      targetElement.style.display = "none";
      if (targetElement.style.display == "none")
      {
         targetElement.style.display = "";
      }  
      */
}

function submeteLookupDispatchAction(valor) {
	document.forms[0].action.value=valor;
	document.forms[0].submit();
}

function submeteDispatchAction(valor) {
	document.forms[0].method.value=valor;
	document.forms[0].submit();
}
// Retorna o objeto passando por parametro
function getObjeto(nome){
	var objeto = null;
	if (document.all != null){
		// IE
		objeto = document.all[nome];
	} else {
		// Mozilla
		objeto = document.getElementsByName(nome)[0]
	}	
	return objeto;
}

// Seleciona todos itens da combo passado por parametro
function selecionaItemsCombo(combo){
	m1len = combo.length;
    for ( i=0; i<m1len ; i++){            
    	if (combo.options[i].selected == false ) {                
        	combo.options[i].selected = true;
        }            
    }
}

// ----- AISLAN ------

function submeterForm(acao, formulario, identificacao) {
    identificacao = identificacao || '';
    if (identificacao != ''){
	    var ident = recupararParametroUsuario(acao + '&paramIdUsuario='+identificacao);
	    eval('document.'+ formulario).action = ident;
	}else{
    	eval('document.'+ formulario).action = acao;
    }	
    eval('document.'+ formulario).submit();
}

function formataCampo(Campo,evento,mascara){ 
  strtext = Campo.value 
  tamtext = strtext.length 
  tammask = mascara.length 
  arrmask = new Array(tammask)     
  teclapres = getTecla(evento);
  
  if ((evento.ctrlKey || evento.metaKey) && teclapres == 86) {
	return;
  } else { 
	  for (var i = 0 ; i < tammask; i++){ 
	     arrmask[i] = mascara.slice(i,i+1) 
	  }
	  
	  if (((((arrmask[tamtext] == "#") || (arrmask[tamtext] == "9"))) || (((arrmask[tamtext+1] != "#") || (arrmask[tamtext+1] != "9"))))){ 
	      if ((teclapres >= 37 && teclapres <= 40)||(teclapres >= 48 && teclapres <= 57)||(teclapres >= 96 && teclapres <= 105)||(teclapres == 8)||(teclapres == 9) ||(teclapres == 46) ||(teclapres == 13)){ 
	          Organiza_Casa(Campo,arrmask[tamtext],teclapres,strtext)
	      } 
	      else{ 
	          Detona_Event(Campo,strtext,evento) 
	      } 
	  }else{// Implementar mascara para numero
	      if ((arrmask[tamtext] == "A"))    { 
	        charupper = event.valueOf() 
	          // charupper = charupper.toUpperCase()
	          Detona_Event(Campo,strtext,teclapres) 
	          masktext = strtext + charupper 
	          Campo.value = masktext 
	      } 
	  }     
   } 
} 

function retirarCaracteresInvalidos(campo, regex) {
	var string = campo.value;
	var caracterAApagar = string.match(regex);
	campo.value = string.replace(caracterAApagar, "");
}

function retirarCaracteresEspeciais(campo) {
	var regex = /[^A-Za-zÀ-ü' ]/;
	var string = campo.value;
	var caracterAApagar = string.match(regex);
	campo.value = string.replace(caracterAApagar, "");
}

function retirarCaracteresEspeciais2(campo) {
	if (campo=="") return;
		campo = campo.replace("-", ""); //Substitui traços por "a" para poder validar somente números positivos
	    return campo;
}

function retirarCaracteresEspeciaisSemConsiderarNumeros(campo) {
	var regex = /[^A-Za-zÀ-ü0-9-' ]/;
	var string = campo.value;
	var caracterAApagar = string.match(regex);
	campo.value = string.replace(caracterAApagar, "");
}

function retirarCaracteresEspeciaisSemConsiderarNumerosPontosVirgulasBarras(campo) {
	var regex = /[^A-Za-zÀ-ü0-9-'.,/ ]/;
	var string = campo.value;
	var caracterAApagar = string.match(regex);
	campo.value = string.replace(caracterAApagar, "");
}

//Remove tudo o que não é Letra
function retirarCarateresEspeciaiseNumeros(par_tecla)
{
	 var var_tecla = par_tecla.keyCode ? par_tecla.keyCode : par_tecla.which;
	 /* Tecla Backspace */
	 if (var_tecla == 8)
		  {return true;}
	 /* Tecla Space */
	 if (var_tecla == 32)
		  {return true;}
	 /* Teclas a-z e A-Z */
	 if ((var_tecla > 64 && var_tecla < 91) || (var_tecla > 96 && var_tecla < 123))
		  {return true;}
	 /* Teclas acentuadas e cidilha */
	 if ((var_tecla > 191 && var_tecla < 221) || (var_tecla > 223 && var_tecla < 253))
		  {return true;}
	 return false;
}

function validarEndereco(campo) {
	var regex = /[^A-Za-zÀ-ü0-9-/()' ]/;
	var string = campo.value;
	var caracterAApagar = string.match(regex);
	campo.value = string.replace(caracterAApagar, "");
}

function validarEmailRegex(campo) {
	var regex = /[A-Za-z0-9_.-]+@([A-Za-z0-9_]+\.)+[A-Za-z]{2,4}/;
	var string = campo.value;
	if (!regex.test(string) && string !="") {
		mensagemDeErro(campo.value,"E-mail inválido");
		return false;
	} else {
		return true;
	}
}

function somenteNumeroInteiro(campo) {
	retirarCaracteresInvalidos(campo, /\,\,/);
	retirarCaracteresInvalidos(campo, /\.\./);
	retirarCaracteresInvalidos(campo, /[^0-9]/);
	var regex = /[0-9]/;
	var string = campo.value;
	if (!regex.test(string) && string !="") {
		mensagemDeErro(campo,"Número Inválido!");
	}
}

function mensagemDeErro(string, mensagem){
	alert(mensagem+" ("+string+").");
}

function retiraZeroEsquerda(campo){
	retirarCaracteresInvalidos(campo, /^[0]/);
}

function Organiza_Casa(Campo,arrpos,teclapres_key,strtext){ 
  if (((arrpos == "/") || (arrpos == ".") || (arrpos == ",") || (arrpos == ":") || (arrpos == " ") || (arrpos == "-")) && !(teclapres_key == 8)){ 
      separador = arrpos 
      masktext = strtext + separador 
      Campo.value = masktext 
  } 
} 
function Detona_Event(Campo,strtext,evento){ 
  	if (strtext != "") {
  	    Campo.value = strtext; 
  	}
  	if (document.all) {
  		evento.returnValue = false;
		// evento.keyCode = 0;
	}else{
		evento.preventDefault(); 
	}
}

function getTecla(event) {
	var tecla = null;
	if (document.all) {
		tecla = event.keyCode; 
	}else{
		if (document.layers) {
			tecla = event.which ? event.which : event.charCode;
		}else{
		   // if (document.getElementById) {
			// tecla = event.which ? event.which : event.charCode;
		   // }else{
				tecla = event.charCode ? event.charCode : (event.keyCode ? event.keyCode : 0);
		   }		 
	}
	return tecla;
}

/*function capturaEnter(evento){
  if (!evento){
    return false;
  }
  var tecla = getTecla(evento);
  if (tecla == 13){
    submeteDispatchAction('consultarSolicitacoes');
  }
}*/

function proibeEnter(evento){
  var tecla = getTecla(evento);
  if (tecla == 13){
    return false;
  }
  return true;
}

function verificaCampoComQuantidadeZero(campo, msg){
	campoValue = campo.value;
	primeiroIndice  = campo.value.charAt(0);
	segundoIndice = campo.value.charAt(1);
	if(campoValue.length == 1 && primeiroIndice == '0'){
		campo.value = '';
		alert(msg);
	}
	else if(campoValue.length == 2 && segundoIndice == '0' && primeiroIndice == '0'){
		campo.value = '';
		alert(msg);
	}
}

function verificaCampoComValorMaiorQueZero(campo, msg){
	numero = parseFloat(limpaNumero(campo.value));
	if(numero == 0){
		campo.value = '';
		alert(msg);
	}
}

function validarCelular(campo, obrigatorio) {
	var campoValue = campo.value;
	campoValue = campoValue.replace(/\D/g,"") //Remove tudo o que não é dígito
	jQuery.ajax({
	    url: "/saw/ValidarCelularAjaxAction.do",
	    dataType: 'json',
	    type: 'POST',
	    async: false,
	    data: { 
	    	campoEmQuestao : campoValue
	    },
	   	success: function(data) {
	        var a = eval(data);
	    	if(a == false){
				alert("Número do celular não é válido!");
	    	}
	    	return a;
	    }
	 });   
}
	
function doExecutaAcaoAposValidarCelular(resposta){
	if (resposta == 'false') {
		alert("Número do celular não é válido!");
		return false;
	} else {
		return true;
	}
}

function validarMcel(campo, idDDD) {
	var campoValue = campo.value;
	var primeiroIndice = campo.value.charAt(0);
	var ddd = document.getElementById(idDDD);
	campoValue = campoValue.replace(/\D/g,"") //Remove tudo o que não é dígito

	if (ddd.value == "" || ddd.value == "--") {
		alertaCelularInvalido(campo);
	}
	
	if((primeiroIndice == '6' || primeiroIndice == '5' || primeiroIndice == '4' || primeiroIndice == '3' || primeiroIndice == '2' || 
			primeiroIndice == '1' || primeiroIndice == '0') || (campoValue == '11111111' || campoValue == '111111111' || campoValue == '22222222' || 
					campoValue == '222222222' || campoValue == '33333333' || campoValue == '333333333' || campoValue == '44444444' || 
					campoValue == '444444444' || campoValue == '55555555' || campoValue == '555555555' || campoValue == '66666666' || 
					campoValue == '666666666' || campoValue == '77777777' || campoValue == '777777777' || campoValue == '88888888' || 
					campoValue == '888888888' || campoValue == '99999999' || campoValue == '999999999')) {
		alertaCelularInvalido(campo);
	}
	
	if(campoValue.length < 8) {
		alertaCelularInvalido(campo);
	}
}

function limparCampo(campo){
	campo.value = '';
}

function alertaCelularInvalido(campo){
	alert('Número de celular inválido');
	limparCampo(campo);
	//campo.focus();
	return;
}

function soNumero(evento) {
    var tecla = getTecla(evento);
    var msg = 'O campo deve ser numérico!';
    if (evento.which) tecla = evento.which;
    else tecla = evento.keyCode;
    if ((tecla >= 48 && tecla <= 57) || tecla ==22 || tecla ==3 ||  tecla == 13  || tecla == 8 || tecla == 9 || tecla == 40 || tecla == 37 || tecla == 39 || tecla == 46 || tecla == 38 ) { // numeros de 0 a 9 ou enter
        return true;
	} else {
		if(document.all) {
		  alert(msg);
		  event.keyCode = 0;
		} else{
		  alert(msg);
		  evento.preventDefault();
		}  
	}
}

function mostraOculta(id, condicao){
  if (id != null && id != ""){
	if (condicao != null){
		if(condicao){
			mostra = true;
		}else{
			mostra = false;
		}
	}else{
		if(mostra){
			mostra = false;
		}else{
			mostra = true;
		}
	}
	document.getElementById(id).style.display = mostra ? '' : 'none';
  }
}

// VALIDAÇÃO DE CPF
 function checaCPF (obj) {
 	var CPF = obj.value;
 	var msg = 'O CPF '+obj.value+' é inválido!';
	if (CPF.length != 11 || CPF == "00000000000" || CPF == "11111111111" ||
		CPF == "22222222222" ||	CPF == "33333333333" || CPF == "44444444444" ||
		CPF == "55555555555" || CPF == "66666666666" || CPF == "77777777777" ||
		CPF == "88888888888" || CPF == "99999999999") {
		alert(msg);
		obj.focus();
		obj.value='';
		return false;
	}
		
	soma = 0;
	for (var posicao=0; posicao < 9; posicao ++)
		soma += parseInt(CPF.charAt(posicao)) * (10 - posicao);
	resto = 11 - (soma % 11);
	if (resto == 10 || resto == 11)
		resto = 0;
	if (resto != parseInt(CPF.charAt(9))) {
		alert(msg);
		obj.focus();
		obj.value='';
		return false;
	}
	soma = 0;
	for (var posicao = 0; posicao < 10; posicao ++)
		soma += parseInt(CPF.charAt(posicao)) * (11 - posicao);
	resto = 11 - (soma % 11);
	if (resto == 10 || resto == 11)
		resto = 0;
	if (resto != parseInt(CPF.charAt(10))) {
		alert(msg);
		obj.focus();
		obj.value='';
		return false;
	}
	return true;
 }
 
 function reload(){
	window.location.reload();
 }
 
// FIM DE VALIDA??????O DE CPF



/**
 * Fun??o Replace que substitui todas as ocorr?ncias de um determinado 
 * caracter/conjunto de caracteres, por algum outro caracter/conjunto de caracteres.
 * @author Desconhecido.
 */
function xreplace(variavel, aSerSubstituido, substituirPor){
	var temp = variavel;
	var i = temp.indexOf(aSerSubstituido);
	while(i > -1) {
		temp = temp.replace(aSerSubstituido, substituirPor);
		i = temp.indexOf(aSerSubstituido, i + substituirPor.length + 1);
	}
	return temp;
}

/**
 * Verifica se os eventos lan?ados s?o provenientes de um Browser "Internet Explorer".
 * @author Daniel Melo S?.
 */
function isEventoLancadoDoBrowserInternetExplorer() {
	return window.event != null;
}

// Aislan - Substitur caractar em uma string
String.prototype.substituir = function(antigo,novo){
	var retorno = this.toString(); 
	while(retorno.indexOf(antigo) > -1){
		retorno = retorno.replace(antigo,novo);
	}
	return retorno.toString();
}

function executarProcedimentosAposCarregamentoDePagina() {
	addHandlersParaTratarMaxlengthDosTextareas();
}

function addHandlersParaTratarMaxlengthDosTextareas() {
	var elementosTextarea = getElementosTextarea();	
	for (i = 0; i < elementosTextarea.length; i++) {
		if(document.forms[0][elementosTextarea[i].name]) {
			document.forms[0][elementosTextarea[i].name].onchange=limitarTamanhoDoTextarea;
			document.forms[0][elementosTextarea[i].name].onkeyup=limitarTamanhoDoTextarea;
		}
	}
}

function limitarTamanhoDoTextarea(evento) {
	var nomeDoCampo = capturarObjetoDoEvento(evento).name;
	var maxlength;
	var textarea;
	
	if (isTextareaValido(nomeDoCampo)) {
		maxlength = getMaxlengthDoCampo(nomeDoCampo);
		if (isMaxlengthValido(maxlength)) {
			textarea = document.forms[0][nomeDoCampo];
			if (textarea.value.length > maxlength) {
				textarea.value = textarea.value.substr(0, maxlength);
			}
		}
	}
}

function isTextareaValido(nomeOuIndiceDoCampo) {
	return document.forms[0][nomeOuIndiceDoCampo] != null && getTipoDoComponente(nomeOuIndiceDoCampo) == "textarea"; 
}

function isMaxlengthValido(maxlength) {
	return maxlength != null && !isNaN(maxlength);
}

function getElementosTextarea() {
	return document.getElementsByTagName("textarea");
}

function getMaxlengthDoCampo(nomeDoCampo) {
	return document.getElementsByName(nomeDoCampo)[0].getAttribute("maxlength");
}

/**
 * Verifica se os eventos lan?ados s?o provenientes de um Browser "Internet Explorer".
 * @author Daniel Melo S?.
 */
function isEventoLancadoDoBrowserInternetExplorer() {
	return window.event != null;
}


function isArray(obj){
	return (typeof(obj.length)=="undefined")? false : true;
}

function isComponenteValido(nomeIndiceOuIdDoComponente) {
	retorno = false;
	if (document.getElementById(nomeIndiceOuIdDoComponente) != null) {
		retorno = true;
	} else if (document.getElementsByName(nomeIndiceOuIdDoComponente)[0] != null) {
		retorno = true;
	} else if (getComponente(nomeIndiceOuIdDoComponente) != null) {
		retorno = true;
	}
	return retorno;
}

function getTipoDoComponente(nomeOuIndiceDoCampo) {
	return getComponente(nomeOuIndiceDoCampo).type;
}

/**
 * Retorna o componente HTML.
 */
function getComponente(nomeOuIndiceDoCampo, formulario) {
	formulario = formulario || document.forms[0];
	return formulario[nomeOuIndiceDoCampo];
	
}

function setFocoNoCampo(nomeDoCampo) {
	try {
		document.forms[0][nomeDoCampo].focus();	
	} catch (e) {
	}
}

function selecionarCampo(nomeDoComponenteQueReceberaFoco) {
	if (isComponenteValido(nomeDoComponenteQueReceberaFoco)) {
		document.forms[0][nomeDoComponenteQueReceberaFoco].select();
	}
}

function selecionarItem(nomeDoSelect, valueDoItemASelecionar) {
	var select = getComponente(nomeDoSelect);
	if (select != null && valueDoItemASelecionar != null) {
		for (i = 0; i < select.options.length; i++)  {
			if (select.options[i].value == valueDoItemASelecionar) {
				select.selectedIndex = i;
				break;
			}
		}
	}
}

function mascararData(input, evnt){
	var keyCode = (isBrowserInternetExplorer())? evnt.keyCode : evnt.keyCode;
	// alert(evnt.keyCode);
	if (input.value.length == 2 || input.value.length == 5){
		if(isBrowserInternetExplorer()){
			input.value += "/";
		} else {
			input.value += "/";
		}
	}
	//Chama a fun??o Bloqueia_Caracteres para s? permitir a digita??o de n?meros
	return bloquearCaracteres(evnt);
}

function bloquearCaracteres(evnt){
	var retorno = true;
	if (isBrowserInternetExplorer()){
		if (isCaracterSendoDigitado(evnt) && isTeclasHabilitadasParaCampoTexto(evnt)){
			alert("tem que desabilitar!!!");
			window.event.returnValue = false;
			retorno = false;
		}
	}else{
		if (isCaracterSendoDigitado(evnt) && isTeclasHabilitadasParaCampoTexto(evnt)){
			retorno = false;
			evnt.preventDefault();
		}
	}
	return retorno;
}

function isCaracterSendoDigitado(evnt) {
// alert(evnt.keyCode);
	return (evnt.charCode < 48 || evnt.charCode > 57);
}

function isTeclaDeExclusaoDeCaracterSendoPressionada(evnt) {
	// alert(evnt.keyCode);
	return (evnt.keyCode == 8 || evnt.keyCode == 46);
}

function isSetasSendoPressionadas(evnt) {
	// alert(evnt.keyCode);
	return (evnt.keyCode == 37 || evnt.keyCode == 38 || evnt.keyCode == 39 || evnt.keyCode == 40);
}

function isTeclasTabShiftOuCtrl(evnt) {
// alert(evnt.keyCode);
	return (evnt.altKey || evnt.ctrlKey || evnt.keyCode == 9 || evnt.keyCode == 16);
}

function isEnterPressionado(evnt) {
	return (evnt.keyCode == 13);
}

function isTeclasHabilitadasParaCampoTexto(evnt) {
	return 	isTeclaDeExclusaoDeCaracterSendoPressionada(evnt) || isSetasSendoPressionadas(evnt) || isTeclasTabShiftOuCtrl(evnt) || isEnterPressionado(evnt);
}
function isElementoImg(html) {
	html = html.trim();
	return (html != null && html.substr(0,4).toUpperCase() == "<IMG")? true : false;
}

var ultimaTr='';
function mudarFundoDeGrid(event) {
	var elemento = capturarObjetoDoEvento(event);
	if (ultimaTr != '') {
		ultimaTr.style.backgroundColor='';
	}
	if(isElementoImg(elemento.parentNode.innerHTML)) {
		ultimaTr = elemento.parentNode.parentNode.parentNode;
		elemento.parentNode.parentNode.parentNode.style.backgroundColor='#CCFFCC';
	} else {
		ultimaTr = elemento.parentNode.parentNode;
		elemento.parentNode.parentNode.style.backgroundColor='#CCFFCC';
	}
}

var trGlosaAuditoria = '';
function mudarFundoDeGridFixo(event) {
	var elemento = capturarObjetoDoEvento(event);
	trGlosaAuditoria = elemento;
	if (ultimaTr != '') {
		ultimaTr.style.backgroundColor='#F3F781';
	}
	if(isElementoImg(elemento.parentNode.innerHTML)) {
		ultimaTr = elemento.parentNode.parentNode.parentNode;
		elemento.parentNode.parentNode.parentNode.style.backgroundColor='#FFFF00';
	} else {
		ultimaTr = elemento.parentNode.parentNode;
		elemento.parentNode.parentNode.style.backgroundColor='#FFFF00';
	}
}

function capturarObjetoDoEvento(evento) {
	return isEventoLancadoDoBrowserInternetExplorer() ? window.event.srcElement: evento.target;
}

String.prototype.trim = function() { return this.replace(/^\s+|\s+$/, ''); };

function fecharPopUp() {
	window.close();
	window.opener.focus();
}

function configuraTrilha(event, trilha){
	if(!proibeEnter(event)){
		var valorTrilha = trilha.value;
		tamanho = valorTrilha.length;
		if(tamanho > 16 && valorTrilha.substring(0,1) == '%') {
			if(valorTrilha.substring(tamanho-2,tamanho) == '?:') {		
				return false;
			}
			if(tamanho < 35 && valorTrilha.substring(tamanho-1,tamanho) == ':') {
				return false;
			}
		}		
	}
	return true;
}

// window.onresize = onResizeHandler;
// window.onscroll = onScrollHandler;
// Window.prototype.alert = sawAlert;

// Funcaes a executar quando a Tela for redimensionada.
function onResizeHandler() {
	// A Linha abaixo está comentada pois o componente não está em produção.
	// realocarComponenteDeMensgens();
}

// Funcaes a executar quando a Tela for "rolada" (scroll).
function onScrollHandler() {
	// A Linha abaixo está comentada pois o componente não está em produção.
	// realocarComponenteDeMensgens();
}


/**
 * Constante global que define o ID do IFRAME em que o Componente de Mensagens processado.
 * @author Daniel Melo Sa.
 */
var ID_IFRAME_MENSAGENS = "frameDeMensagem";

/**
 * Constante global que define o Nome do Estilo do IFrame em que o Componente de Mensagens ser? diagramado.
 * @author Daniel Melo Sa.
 */
var ESTILO_IFRAME_MENSAGENS = "estiloIFrameComponenteDeMensagens";

/**
 * Constante global que define o Nome do Estilo do DIV em que o Componente de Mensagens ser? diagramado.
 * @author Daniel Melo Sa.
 */
var ESTILO_DIV_MENSAGENS = "estiloDIVDeMensagens";


var mensagensAbertas = new Array();

/**
 * Funcao utilizada para abrir uma Mensagem de Alerta utilizando o Componente de Mensagens.
 * <b>OBS: Para chamar esta funcao, utilize a funcao nativa do browser: window.alert('Mensagem');</b>
 * @author Daniel Melo Sa.
 * @author Tauser Carneiro.
 * @see window.alert().
 */
function sawAlert(string) {
	var chave = criarChaveParaMensagem(string);
	
	registrarAberturaDeMensagem(chave);

	var iframe = document.createElement("iframe");
	iframe.setAttribute("id", ID_IFRAME_MENSAGENS);
	iframe.setAttribute("frameborder", "0");
	iframe.setAttribute("width", "360");
	iframe.setAttribute("height", "160");
	iframe.setAttribute("class", ESTILO_IFRAME_MENSAGENS);
	iframe.setAttribute("src", contexto + "/Mensagem.do?method=alerta&mensagem=" + xreplace(string, "\n", "<br>") + "&chave=" + chave);
	
	var div = document.createElement("div");
	div.setAttribute("id", chave);
	div.setAttribute("class", ESTILO_DIV_MENSAGENS);
	div.appendChild(iframe);

	document.body.appendChild(div);
	document.getElementById(chave).style.visibility = (document.layers)?'show':((document.all)?'visible': ((document.getElementById)?'visible' : ''));
	
	realocarComponenteDeMensgens();
}

/**
 * Cria uma chave de identifica??o ?nica para o componente de mensagem que sera aberto.
 * @param String - String da mensagem que sera diagramada no componente.
 * @author Daniel Melo Sa.
 */
function criarChaveParaMensagem(string) {
	var date = new Date();
	return "Chave" + date.getMilliseconds() + date.getMilliseconds() + "DaMensagem";
}

/**
 * Registra a abertura da Mensagem, adicionando a chave da mensagem na lista de mensagens abertas.
 * @param String - chave da mensagem.
 * @author Daniel Melo Sa.
 */
function registrarAberturaDeMensagem(chave) {
	mensagensAbertas.push(chave);
}

/**
 * Remove a Chave do Componente de Mensagem aberto da lista de Chaves dos Componentes abertos.
 * <b>OBS: Utilizar quando estiver fechando um determinado componente de mensagem.</b>
 * @param String - Chave da Mensagem.
 */
function removerChaveDaMensagemDaListaDeMensagensAberta(chave) {
	var indiceDaChave = null;
	for (i = 0; i < mensagensAbertas.length; i++) {
		if (mensagensAbertas[i] == chave) {
			indiceDeChave = i;
		}
	}
	if (indiceDaChave != null) {
		mensagensAbertas.splice(indiceDaChave, indiceDaChave + 1);
	}
}

/**
 * Registra a abertura da Mensagem, adicionando a chave da mensagem na lista de mensagens abertas.
 * @param String - chave da mensagem.
 * @author Daniel Melo Sa.
 */
function registrarAberturaDeMensagem(chave) {
	mensagensAbertas.push(chave);
}

/**
 * Funcao utilizada para diagramar o Componente de Mensagens de forma central na tela.
 * <b>OBS: Deve ser chamada quando a tela for redimensionada e quando o scroll de tela for exetudado.</b>
 * @author Daniel Melo Sa.
 * @author Tauser Carneiro.
 */
function realocarComponenteDeMensgens() {
	for (i = 0; i < mensagensAbertas.length; i++) {
		document.getElementById("display").innerHTML = document.getElementById(mensagensAbertas[i]).innerHTML + "<br>";
		document.getElementById(mensagensAbertas[i]).style.top = ((((document.body.clientHeight*50)/100)+window.pageYOffset)-(parseInt(document.getElementById(mensagensAbertas[i]).style.height.substr(0,document.getElementById(mensagensAbertas[i]).style.width.length-2))))+'px';
		document.getElementById(mensagensAbertas[i]).style.left = (((document.body.clientWidth*50)/100)-(parseInt(document.getElementById(mensagensAbertas[i]).style.height.substr(0,document.getElementById(mensagensAbertas[i]).style.height.length-2))))+'px';
	}
}

/**
 * Funcao utilizada para fechar uma Mensagem de Alerta.
 * Se necessario, deve-se implementar alguns procedimentos de fechamento de tela.
 * @param String - Chave do componente de mensagens a ser fechado.
 * @author Daniel Melo Sa.
 * @author Tauser Carneiro.
 */
function acaoFecharMensagem(chave) {
	removerChaveDaMensagemDaListaDeMensagensAberta(chave);
	document.getElementById(chave).innerHTML = "";
	document.getElementById(chave).style.visibility = (document.layers)?'hide':((document.all)?'hidden': ((document.getElementById)?'hidden' : ''));
}



var TIPO_MSG_BIOMETRIA = "MSG_BIOMETRIA";
var ID_MSG_BOX = "msgBox";
var linha = 0;

function escreverMensagem(mensagem, tipoMensagem, tipoComponenteMsg) {
	tipoComponenteMsg = tipoComponenteMsg || tipoComponenteMsg;
	if (tipoComponenteMsg == 'MSG_BIOMETRIA') {
		escreverMensagemTipoBiometria(mensagem, tipoMensagem);
	} else {
		escreverMensagemTipoPadrao();
	}
}

function alertaFecharBrowser(){
	alert("Instalação concluída com sucesso. Por favor, feche seu browser");
} 

function escreverMensagemTipoPadrao(mensagem, tipoMensagem) {
	alert("O Componente de Mensagens padrão não foi definido.\nUsuário, favor, relate esta mensagem ao administrador do sistema.");
}

function escreverMensagemTipoBiometria(mensagem, tipoMensagem) {
	var msgBox = document.getElementById( ID_MSG_BOX );
	var htmlAntigo = msgBox.innerHTML;
	var classeDeEstilo = "";
	switch (tipoMensagem) {
		case "Erro": case "erro": case "ERRO": case "3": case 3:
			classeDeEstilo = "msgErro";
			break;
		case "Alerta": case "alerta": case "ALERTA": case "2": case 2:
			classeDeEstilo = "msgAlerta";
			break;
		case "Informativa": case "informativa": case "INFORMATIVA": case "1": case 1: default:
			classeDeEstilo = "msgInformativa";
			break;
	}
	msgBox.innerHTML = '<div class="' + classeDeEstilo + '" id="mensagem' + ++linha +'">' + linha + " - " + decodeURIComponent(mensagem) + '</div>' + htmlAntigo;
}



/**
 *	Mostra o campo passado como par?metro.
 *  OBS: Ao utilizar a função em uma PopUp o arquivo scriptaculous.js deve ser importado antes do page.js.
 *	@param <b>idDoDiv</b> - ID do DIV a mostrar.
 *	@author Daniel Melo S?.
 */
function mostrarComponente(idDoDiv) {
	if (idDoDiv != null && idDoDiv.length > 0) {
		//Effect.Appear(idDoDiv);
		document.getElementById(idDoDiv).style.display = "inline";
	}
}
/**
 *	Oculta o campo passado como par?metro.
 *  OBS: Ao utilizar a função em uma PopUp o arquivo scriptaculous.js deve ser importado antes do page.js.
 *	@param <b>idDoDiv</b> - ID do DIV a ocultar.
 *	@author Daniel Melo S?.
 */
function ocultarComponente(idDoDiv) {
	if (idDoDiv != null && idDoDiv.length > 0) {
		//Effect.SwitchOff(idDoDiv);
		document.getElementById(idDoDiv).style.display = "none";
	}
}

/**
 *	Habilita o campo passado como par?metro.
 *  OBS: <b>enabled = true</b>.
 *	@param <b>nomeDoComponente</b> - Nome do componente a habilitar.
 *	@author Daniel Melo S?.
 */
function habilitarComponente(nomeDoComponente) {
	if (nomeDoComponente != null) {
		try {
			document.forms[0][nomeDoComponente].disabled = false;
		} catch (E) { }
	}
}
/**
 *	Desabilita o campo passado como par?metro.
 *  OBS: <b>disabled = true</b>.
 *	@param <b>nomeDoComponente</b> - Nome do componente a desabilitar.
 *	@author Daniel Melo Sá.
 */
function desabilitarComponente(indiceOuNomeDoComponente, formulario) {
	formulario = formulario || document.forms[0];
	if (indiceOuNomeDoComponente != null) {
		try {
			formulario[indiceOuNomeDoComponente].disabled = true;
		} catch (E) { alert("erro: page.js.desabilitarComponente()") }
	}
} 

/**
 *	Desabilita todos os campos do formulário passado como parâmetro.
 *  OBS: <b>disabled = true</b>.
 *	@param <b>nomeDoForm</b> - Nome do Formulário que terá seus componentes desabilitados.
 *	@author Michel Anderson Friedrich Passos.
 */
function desabilitarTodosComponente(form) {
	for (i = 0; i < form.elements.length; i++) {
		desabilitarComponente(i, form);
	}
}

/**
 *	Habilita todos os campos do formulário passado como parâmetro.
 *  OBS: <b>disabled = false</b>.
 *	@param <b>nomeDoForm</b> - Nome do Formulário que terá seus componentes habilitados.
 *	@author Michel Anderson.
 */
function habilitarTodosComponentes(form) {
	for (i = 0; i < form.elements.length; i++) {
		habilitarComponente(i, form);
	}
}

/**
 * Verifica se é um componente que pode receber foco.
 * 
 * @param indiceOuNomeDoComponente.
 * @param formulario - Se não for passada a referência do formulario, assume-se que o formulário manipulado é o de índice *	@author Michel Anderson Friedrich Passos.
author Daniel Melo Sá.
 */
function isComponentePassivelDeFoco(indiceOuNomeDoComponente, formulario) { 
	formulario = formulario || document.forms[0];
	return getTipoDoComponente(indiceOuNomeDoComponente, formulario) != "hidden" && formulario[indiceOuNomeDoComponente].style.display != "none"; 
}

/**
 * Verifica se o componente está habilitado.
 * 
 * @param indiceOuNomeDoComponente.
 * @param formulario - Se não for passada a referência do formulario, assume-se que o formulário manipulado é o de índice 0 (document.forms[0]).
 * @author Daniel Melo Sá.
 */
function isComponenteHabilitado(indiceOuNomeDoComponente, formulario) { 
	formulario = formulario || document.forms[0];
	return !formulario[indiceOuNomeDoComponente].disabled; 
}

/**
 * Verifica se é um componente do tipo SELECT ou Radio.
 * 
 * @param indiceOuNomeDoComponente.
 * @param formulario - Se não for passada a referência do formulario, assume-se que o formulário manipulado é o de índice 0 (document.forms[0]).
 * @author Daniel Melo Sá.
 */
function isComponenteTipoSelect(indiceOuNomeDoComponente, formulario) {
	formulario = formulario || document.forms[0];
	return (formulario[indiceOuNomeDoComponente].type == 'select-one' || 
			formulario[indiceOuNomeDoComponente].type == 'select-multiple' || 
			formulario[indiceOuNomeDoComponente].type == 'radio');
}

/**
 * Desabilitar todos os Componentes HTML do formulário.
 * @param formulario - Se não for passada a referência do formulario, assume-se que o formulário manipulado é o de índice 0 (document.forms[0]).
 * @author Daniel Melo Sá.
 */
function desabilitarTodosOsCamposDoFormulario(formulario) {
  formulario = formulario || document.forms[0];
  const elementos = formulario.querySelectorAll('input, textarea, select, button, select-one, select-multiple, radio');

    elementos.forEach((elemento, indice) => {
      if (elemento != null && elemento.type != 'hidden' && elemento.style.display != "none") {
			if (elemento.type == 'select-one' || elemento.type == 'select-multiple' || elemento.type == 'select' ) {
				elemento.disabled = true;
			} else {
				elemento.readOnly = true;
			}
		}
    });
}

function desabilitarTodosSelectsDoFormulario(formulario) {
	formulario = formulario || document.forms[0];
  const elementos = formulario.querySelectorAll('input, textarea, select, button, select-one, select-multiple, radio');

    elementos.forEach((elemento, indice) => {
      if (elemento != null && elemento.type != 'hidden' && elemento.style.display != "none") {
			if (elemento.type == 'select-one' || elemento.type == 'select-multiple' || elemento.type == 'select' ) {
				elemento.disabled = true;
			} 
		}
    });
}

/**
 * Habilitar todos os Componentes HTML do formulário.
 * @param formulario - Se não for passada a referência do formulario, assume-se que o formulário manipulado é o de índice 0 (document.forms[0]).
 * @author Daniel Melo Sá.
 */
function habilitarTodosOsCamposDoFormulario(formulario) {
	 formulario = formulario || document.forms[0];
  const elementos = formulario.querySelectorAll('input, textarea, select, button, select-one, select-multiple, radio');

     elementos.forEach((elemento, indice) => {
      if (elemento != null && elemento.type != 'hidden' && elemento.style.display != "none" && elemento.disabled ) {
			if (elemento.type == 'select-one' || elemento.type == 'select-multiple' || elemento.type == 'select' ) {
				elemento.removeAttribute('disabled');
				elemento.readOnly = false;
			} else {
				elemento.removeAttribute('disabled');
				elemento.readOnly = false;
			}
		}
    });
}


function habiltarTodosSelectsDoFormulario(formulario) {
	 formulario = formulario || document.forms[0];
 	 const elementos = formulario.querySelectorAll('input, textarea, select, button, select-one, select-multiple, radio');

     elementos.forEach((elemento, indice) => {
      if (elemento != null && elemento.type != 'hidden' && elemento.style.display != "none" && elemento.disabled ) {
			if (elemento.type == 'select-one' || elemento.type == 'select-multiple' || elemento.type == 'select' ) {
				elemento.removeAttribute('disabled');
				elemento.readOnly = false;
			} 
		}
    });
}

// AISLAN - Função para formatar valor

// Usar campo com size = 20

function formataValor(campo,evento, pmaxlength) {
	pmaxlength = pmaxlength || 0;
	var tecla = getTecla(evento);
	var comando;
	var vr;
	
	var objCampo = campo;
	vr = objCampo.value;
	if (vr.length > pmaxlength && pmaxlength != 0){
		Detona_Event(campo,campo.value,evento);
		return;
	}	
	vr = vr.replace( ",", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	vr = vr.replace( ".", "" );
	tam = vr.length;
	tam = tam + 1;
	if (tecla == 8 ){ tam = tam - 2 ; }
	if (tam > 15){
		return;
	}
	if ( tecla == 8 || tecla >= 48 && tecla <= 57 || tecla >= 96 && tecla <= 105 ){
		if ( tam <= 2 ){
			objCampo.value = vr ;
		}
		if ( (tam > 2) && (tam <= 5) ){
			objCampo.value = vr.substr( 0, tam - 2 ) + ',' + vr.substr( tam - 2, tam ) ; 
		}
		if ( (tam >= 6) && (tam <= 8) ){
			objCampo.value = vr.substr( 0, tam - 5 ) + '.' + vr.substr( tam - 5, 3 ) + ',' + vr.substr( tam - 2, tam ) ; 
		}
		if ( (tam >= 9) && (tam <= 11) ){
			objCampo.value = vr.substr( 0, tam - 8 ) + '.' + vr.substr( tam - 8, 3 ) + '.' + vr.substr( tam - 5, 3 ) + ',' + vr.substr( tam - 2, tam ) ; 
		}
		if ( (tam >= 12) && (tam <= 14) ){
			objCampo.value = vr.substr( 0, tam - 11 ) + '.' + vr.substr( tam - 11, 3 ) + '.' + vr.substr( tam - 8, 3 ) + '.' + vr.substr( tam - 5, 3 ) + ',' + vr.substr( tam - 2, tam ) ; 
		}
		if ( (tam >= 15) && (tam <= 17) ){
			objCampo.value = vr.substr( 0, tam - 14 ) + '.' + vr.substr( tam - 14, 3 ) + '.' + vr.substr( tam - 11, 3 ) + '.' + vr.substr( tam - 8, 3 ) + '.' + vr.substr( tam - 5, 3 ) + ',' + vr.substr( tam - 2, tam ) ;
		}
	}
}

/**
 * Abrir a janela para exibir os detalhes da guia de acordo com o tipo e chave
 * 
 * @param chaveDaGuia -
 *            chave da guia
 * @param tipoDaGuia -
 *            tipo da guia
 * @author Adriano Borges.
 */
function abreJanelaMaximizadaDaGuia(chaveDaGuia,tipoDaGuia, versaoTISS) {
	if (tipoDaGuia == 'CONSULTA ELETIVA'){
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta30.do?method=consultarGuiaDeConsulta&manterTISSConsulta30DTO.tissSolicitacaoDeConsultaDTO.chave='+chaveDaGuia);
		} else if (versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta40.do?method=consultarGuiaDeConsulta&manterTISSConsulta40DTO.tissSolicitacaoDeConsultaDTO.chave='+chaveDaGuia);
		} else{
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta.do?method=consultarGuiaDeConsulta&solicitacaoDeConsulta.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'SP/SADT') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT30.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.chave='+chaveDaGuia);
		}else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT.do?method=consultarGuiaDeSPSADT&solicitacaoDeSPSADT.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'INTERNAÇÃO') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao30.do?method=consultarGuiaDeInternacao&manterTissInternacao30DTO.tissSolicitacaoDeInternacaoDTO.chave='+chaveDaGuia);
		} else if (versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao40.do?method=consultarGuiaDeInternacao&manterTissInternacao40DTO.tissSolicitacaoDeInternacaoDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao.do?method=consultarGuiaDeInternacao&solicitacaoDeInternacao.chave='+chaveDaGuia);
		}
	} else if(tipoDaGuia == 'HONORÁRIO INDIVIDUAL') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/HonorarioIndividual30.do?method=consultarGuiaDeHonorarioIndividual&manterTissHonorarioIndividualDTO.tissHonorarioIndividualDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/HonorarioIndividual40.do?method=consultarGuiaDeHonorarioIndividual&manterTissHonorarioIndividualDTO.tissHonorarioIndividualDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizada('/saw/tiss/HonorarioIndividual.do?method=consultarGuiaDeHonorarioIndividual&honorarioIndividual.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'OUTRAS DESPESAS') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/OutrasDespesas30.do?method=consultarGuiaDeOutrasDespesas&manterTissOutrasDespesasDTO.tissOutrasDespesasDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/OutrasDespesas40.do?method=consultarGuiaDeOutrasDespesas&manterTissOutrasDespesasDTO.tissOutrasDespesasDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizada('/saw/tiss/OutrasDespesas.do?method=consultarGuiaDeOutrasDespesas&outrasDespesas.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'RESUMO DE INTERNAÇÃO') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao30.do?method=consultarGuiaDeResumoDeInternacao&manterTissResumoInternacaoDTO.tissResumoDeInternacaoDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao40.do?method=consultarGuiaDeResumoDeInternacao&manterTissResumoInternacaoDTO.tissResumoDeInternacaoDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao.do?method=consultarGuiaDeResumoDeInternacao&resumoDeInternacao.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'OPME') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeOpme30.do?method=consultarGuiaOpme&manterTissSolicitacaoDeOpmeDTO.tissSolicitacaoDeOpmeDTO.chave='+chaveDaGuia);
		}
		else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeOpme40.do?method=consultarGuiaOpme&manterTissSolicitacaoDeOpmeDTO.tissSolicitacaoDeOpmeDTO.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'QUIMIOTERAPIA') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeQuimioterapia30.do?method=consultarGuiaQuimioterapia&manterTissDeQuimioterapia30DTO.tissSolicitacaoDeQuimioterapiaDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeQuimioterapia40.do?method=consultarGuiaQuimioterapia&manterTissDeQuimioterapia40DTO.tissSolicitacaoDeQuimioterapiaDTO.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'RADIOTERAPIA') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRadioterapia30.do?method=consultarGuiaDeRadioterapia&manterTissDeRadioterapia30DTO.tissSolicitacaoDeRadioterapiaDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRadioterapia40.do?method=consultarGuiaDeRadioterapia&manterTissDeRadioterapia40DTO.tissSolicitacaoDeRadioterapiaDTO.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'PRORROGAÇÃO') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeProrrogacao30.do?method=consultarGuiaDeProrrogacao&manterTissProrrogacao30DTO.tissProrrogacaoDTO.chave='+chaveDaGuia);
		} else if (versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeProrrogacao40.do?method=consultarGuiaDeProrrogacao&manterTissProrrogacao40DTO.tissProrrogacaoDTO.chave='+chaveDaGuia);
		} else {
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao.do?method=consultarGuiaDeInternacao&solicitacaoDeInternacao.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'ODONTOLOGIA') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico30.do?method=consultarGuiaOdontologia&manterTissTratamentoOdontologico30DTO.tissTratamentoOdontologicoDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico40.do?method=consultarGuiaOdontologia&manterTissTratamentoOdontologico40DTO.tissTratamentoOdontologicoDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico.do?method=consultarGuiaDeTratamentoOdontologico&tissTratamentoOdontologico.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'RECURSO DE GLOSA') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRecursoGlosa30.do?method=consultarGuiaRecursoGlosa&manterGuiaRecursoGlosaDTO.tissSolicitacaoDeRecursoGlosaDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRecursoGlosa40.do?method=consultarGuiaRecursoGlosa&manterGuiaRecursoGlosaDTO.tissSolicitacaoDeRecursoGlosaDTO.chave='+chaveDaGuia);
		}
	}
}

function abreJanelaMaximizadaDaGuiaNova(chaveDaGuia,tipoDaGuia, versaoTISS) {
	if (tipoDaGuia == 'CONSULTA ELETIVA'){
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeConsulta30.do?method=consultarGuiaDeConsulta&manterTISSConsulta30DTO.tissSolicitacaoDeConsultaDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeConsulta40.do?method=consultarGuiaDeConsulta&manterTISSConsulta40DTO.tissSolicitacaoDeConsultaDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeConsulta.do?method=consultarGuiaDeConsulta&solicitacaoDeConsulta.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'SP/SADT') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeSPSADT30.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT30DTO.tissSolicitacaoDeSPSADTDTO.chave='+chaveDaGuia);
		}else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeSPSADT.do?method=consultarGuiaDeSPSADT&solicitacaoDeSPSADT.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'INTERNAÇÃO') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeInternacao30.do?method=consultarGuiaDeInternacao&manterTissInternacao30DTO.tissSolicitacaoDeInternacaoDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeInternacao40.do?method=consultarGuiaDeInternacao&manterTissInternacao40DTO.tissSolicitacaoDeInternacaoDTO.chave='+chaveDaGuia);
		} else{
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeInternacao.do?method=consultarGuiaDeInternacao&solicitacaoDeInternacao.chave='+chaveDaGuia);
		}
	} else if(tipoDaGuia == 'HONORÁRIO INDIVIDUAL') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/HonorarioIndividual30.do?method=consultarGuiaDeHonorarioIndividual&manterTissHonorarioIndividualDTO.tissHonorarioIndividualDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/HonorarioIndividual40.do?method=consultarGuiaDeHonorarioIndividual&manterTissHonorarioIndividualDTO.tissHonorarioIndividualDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizadaNova('/saw/tiss/HonorarioIndividual.do?method=consultarGuiaDeHonorarioIndividual&honorarioIndividual.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'OUTRAS DESPESAS') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/OutrasDespesas30.do?method=consultarGuiaDeOutrasDespesas&manterTissOutrasDespesasDTO.tissOutrasDespesasDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/OutrasDespesas40.do?method=consultarGuiaDeOutrasDespesas&manterTissOutrasDespesasDTO.tissOutrasDespesasDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizadaNova('/saw/tiss/OutrasDespesas.do?method=consultarGuiaDeOutrasDespesas&outrasDespesas.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'RESUMO DE INTERNAÇÃO') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/ResumoDeInternacao30.do?method=consultarGuiaDeResumoDeInternacao&manterTissResumoInternacaoDTO.tissResumoDeInternacaoDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/ResumoDeInternacao40.do?method=consultarGuiaDeResumoDeInternacao&manterTissResumoInternacaoDTO.tissResumoDeInternacaoDTO.chave='+chaveDaGuia);
		}else{
			abreJanelaMaximizadaNova('/saw/tiss/ResumoDeInternacao.do?method=consultarGuiaDeResumoDeInternacao&resumoDeInternacao.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'OPME') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeOpme30.do?method=consultarGuiaOpme&manterTissSolicitacaoDeOpmeDTO.tissSolicitacaoDeOpmeDTO.chave='+chaveDaGuia);
		}else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeOpme40.do?method=consultarGuiaOpme&manterTissSolicitacaoDeOpmeDTO.tissSolicitacaoDeOpmeDTO.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'QUIMIOTERAPIA') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeQuimioterapia30.do?method=consultarGuiaQuimioterapia&manterTissDeQuimioterapia30DTO.tissSolicitacaoDeQuimioterapiaDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeQuimioterapia40.do?method=consultarGuiaQuimioterapia&manterTissDeQuimioterapia40DTO.tissSolicitacaoDeQuimioterapiaDTO.chave='+chaveDaGuia);
		}
	} else if (tipoDaGuia == 'RADIOTERAPIA') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeRadioterapia30.do?method=consultarGuiaDeRadioterapia&manterTissDeRadioterapia30DTO.tissSolicitacaoDeRadioterapiaDTO.chave='+chaveDaGuia);
		} else if (versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeRadioterapia40.do?method=consultarGuiaDeRadioterapia&manterTissDeRadioterapia40DTO.tissSolicitacaoDeRadioterapiaDTO.chave='+chaveDaGuia);
		}
	
	} else if (tipoDaGuia == 'PRORROGAÇÃO') {
		if(versaoTISS === '3.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeProrrogacao30.do?method=consultarGuiaDeProrrogacao&manterTissProrrogacao30DTO.tissProrrogacaoDTO.chave='+chaveDaGuia);
		} else if(versaoTISS === '4.0'){
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeProrrogacao40.do?method=consultarGuiaDeProrrogacao&manterTissProrrogacao40DTO.tissProrrogacaoDTO.chave='+chaveDaGuia);
		} else {
			abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeInternacao.do?method=consultarGuiaDeInternacao&solicitacaoDeInternacao.chave='+chaveDaGuia);
		}
	}
}

/**
 * Abrir NOVA a janela para exibir os detalhes da guia de acordo com o tipo e
 * chave
 * 
 * @param chaveDaGuia -
 *            chave da guia
 * @param tipoDaGuia -
 *            tipo da guia
 * @author Adriano Borges.
 */
function abreNovaJanelaMaximizadaDaGuia(chaveDaGuia,tipoDaGuia) {
	if (tipoDaGuia == 'CONSULTA ELETIVA'){
		abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeConsulta.do?method=consultarGuiaDeConsulta&solicitacaoDeConsulta.chave='+chaveDaGuia);
	} else if (tipoDaGuia == 'SP/SADT') {
		abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeSPSADT.do?method=consultarGuiaDeSPSADT&solicitacaoDeSPSADT.chave='+chaveDaGuia);
	} else if (tipoDaGuia == 'INTERNAÇÃO' || tipoDaGuia == 'PRORROGAÇÃO') {
		abreJanelaMaximizadaNova('/saw/tiss/SolicitacaoDeInternacao.do?method=consultarGuiaDeInternacao&solicitacaoDeInternacao.chave='+chaveDaGuia);
	} else if(tipoDaGuia == 'HONORÁRIO INDIVIDUAL') {
		abreJanelaMaximizadaNova('/saw/tiss/HonorarioIndividual.do?method=consultarGuiaDeHonorarioIndividual&honorarioIndividual.chave='+chaveDaGuia);
	} else if (tipoDaGuia == 'OUTRAS DESPESAS') {
		abreJanelaMaximizadaNova('/saw/tiss/OutrasDespesas.do?method=consultarGuiaDeOutrasDespesas&outrasDespesas.chave='+chaveDaGuia);
	} else if (tipoDaGuia == 'RESUMO DE INTERNAÇÃO') {
		abreJanelaMaximizadaNova('/saw/tiss/ResumoDeInternacao.do?method=consultarGuiaDeResumoDeInternacao&resumoDeInternacao.chave='+chaveDaGuia);
	}
}

function abreJanelaMaximizadaDeConsulta() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta.do?method=abrirTelaDeSolicitacaoDeConsulta');
}
		
function abreJanelaMaximizadaSPSADT() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT.do?method=abrirTelaDeSolicitacaoDeSPSADT');
}

function abreJanelaMaximizadaNSAVisualizarSalaDeChat(servidor, login, senha, numeroTransacaoOrigem, numeroTransacaoReferencia, operadoraExecutora, tipoSolicitacao, codigoOperadoraBeneficiario,codigoBeneficiario, dataTransacao,codigoAlternaticoUnimedCertificadoChat) {
	var url = servidor+'chatIntercambio?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&comandoChat='+'visualizar'+'&numeroTransacaoOrigem='+numeroTransacaoOrigem+'&numeroTransacaoReferencia='+numeroTransacaoReferencia+'&operadoraExecutora='+operadoraExecutora+'&tipoSolicitacao='+tipoSolicitacao+'&codigoOperadoraBeneficiario='+codigoOperadoraBeneficiario+'&codigoBeneficiario='+codigoBeneficiario+'&dataTransacao='+dataTransacao+'&unimedAlternativa='+codigoAlternaticoUnimedCertificadoChat+'&url='+url;
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(urlLogin,'_blank',str); 
}

function abreJanelaMaximizadaNSAHistoricoChat(servidor, login, senha, numeroTransacaoOrigem, operadoraExecutora, tipoSolicitacao, codigoOperadoraBeneficiario,codigoBeneficiario, dataTransacao,codigoAlternaticoUnimedCertificadoChat) {
	var url = servidor+'chatIntercambio?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&comandoChat='+'historico'+'&numeroTransacaoOrigem='+numeroTransacaoOrigem+'&operadoraExecutora='+operadoraExecutora+'&tipoSolicitacao='+tipoSolicitacao+'&codigoOperadoraBeneficiario='+codigoOperadoraBeneficiario+'&codigoBeneficiario='+codigoBeneficiario+'&dataTransacao='+dataTransacao+'&unimedAlternativa='+codigoAlternaticoUnimedCertificadoChat+'&url='+url;
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(urlLogin,'_blank',str); 
}

function abreJanelaMaximizadaNSACriarSalaDeChatCompleto(servidor, login, senha, numeroTransacaoOrigem, numeroTransacaoReferencia, operadoraExecutora, tipoSolicitacao, codigoOperadoraBeneficiario,codigoBeneficiario, dataTransacao,codigoAlternaticoUnimedCertificadoChat) {
	var url = servidor+'chatIntercambio?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&comandoChat='+'criarChatCompleto'+'&numeroTransacaoOrigem='+numeroTransacaoOrigem+'&numeroTransacaoReferencia='+numeroTransacaoReferencia+'&operadoraExecutora='+operadoraExecutora+'&tipoSolicitacao='+tipoSolicitacao+'&codigoOperadoraBeneficiario='+codigoOperadoraBeneficiario+'&codigoBeneficiario='+codigoBeneficiario+'&dataTransacao='+dataTransacao+'&unimedAlternativa='+codigoAlternaticoUnimedCertificadoChat+'&url='+url;
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(urlLogin,'_blank',str); 
}

function abreJanelaMaximizadaNSANovoChat(servidor, login, senha, numeroTransacaoOrigem, numeroTransacaoReferencia, operadoraExecutora, tipoSolicitacao, codigoOperadoraBeneficiario,codigoBeneficiario, dataTransacao,codigoAlternaticoUnimedCertificadoChat) {
	var url = servidor+'chatIntercambio?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&comandoChat='+'novoChat'+'&numeroTransacaoOrigem='+numeroTransacaoOrigem+'&numeroTransacaoReferencia='+numeroTransacaoReferencia+'&operadoraExecutora='+operadoraExecutora+'&tipoSolicitacao='+tipoSolicitacao+'&codigoOperadoraBeneficiario='+codigoOperadoraBeneficiario+'&codigoBeneficiario='+codigoBeneficiario+'&dataTransacao='+dataTransacao+'&unimedAlternativa='+codigoAlternaticoUnimedCertificadoChat+'&url='+url;
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(urlLogin,'_blank',str); 
}

function abreJanelaMaximizadaNSANovoChat2(servidor, login, senha, numeroTransacaoOrigem, numeroTransacaoReferencia, operadoraExecutora, tipoSolicitacao, codigoOperadoraBeneficiario,codigoBeneficiario, dataTransacao,codigoAlternaticoUnimedCertificadoChat) {
	var url = servidor+'chatIntercambio?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&comandoChat='+'novoChat2'+'&numeroTransacaoOrigem='+numeroTransacaoOrigem+'&numeroTransacaoReferencia='+numeroTransacaoReferencia+'&operadoraExecutora='+operadoraExecutora+'&tipoSolicitacao='+tipoSolicitacao+'&codigoOperadoraBeneficiario='+codigoOperadoraBeneficiario+'&codigoBeneficiario='+codigoBeneficiario+'&dataTransacao='+dataTransacao+'&unimedAlternativa='+codigoAlternaticoUnimedCertificadoChat+'&url='+url;
	var str = 'left=0,screenX=0,top=0,screenY=0,resizable'; 
	if (window.screen) { 
		var ah = screen.availHeight - 30; 
		var aw = screen.availWidth - 10;
       	str += ',height=' + ah; 
       	str += ',innerHeight=' + ah; 
       	str += ',width=' + aw; 
       	str += ',innerWidth=' + aw; 
       	str += ',resizable=1,scrollbars=1';
	} 
	window.open(urlLogin,'_blank',str); 
}

function abreJanelaMaximizadaNSAAbrirChatHome(servidor, login, senha, unimed) {
	var url = servidor+'chatIntercambio?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&comandoChat='+'abrirChatHome'+'&unimed='+unimed+'&url='+url;
	abreJanelaMaximizada(urlLogin);
}

function abreJanelaMaximizadaNSAProtocolo(servidor, login, senha) {
	var url = servidor+'protocoloatendimento';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&url='+url;
	abreJanelaMaximizada(urlLogin);
}

function abreJanelaMaximizadaNSAProtocoloDoBeneficiario(servidor, login, senha, codOperadoraBeneficiario, codbeneficiario) {
	var url = servidor+'protocoloatendimento?codigoOperadoraBeneficiario='+codOperadoraBeneficiario+'&codigoBeneficiario='+codbeneficiario;
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&url='+url;
	abreJanelaMaximizada(urlLogin);
}


function abreJanelaMaximizadaNSANovoProtocolo(servidor, login, senha) {
	var url = servidor+'protocoloatendimento/new';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&url='+url;
	abreJanelaMaximizada(urlLogin);
}

function abreJanelaMaximizadaNSAGrupoProtocolo(servidor, login, senha, codigoOperadora) {
	var url = servidor+'grupocontroleprotocoloatendimento?';
	var urlLogin = servidor+'public?login='+login+'&senha='+senha+'&codigoOperadora='+codigoOperadora+'&url='+url;
	abreJanelaMaximizada(urlLogin);
}

function abreJanelaMaximizadaDeInternacao() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao.do?method=abrirTelaDeSolicitacaoDeInternacao');
}

function abreJanelaMaximizadaDeHonorarioIndividual() {
	abreJanelaMaximizada('/saw/tiss/HonorarioIndividual.do?method=abrirTelaDeHonorarioIndividual');
}

function abreJanelaMaximizadaDeHonorarioIndividual20() {
	abreJanelaMaximizada('/saw/tiss/HonorarioIndividual.do?method=abrirTelaDeHonorarioIndividual');
}

function abreJanelaMaximizadaDeOutrasDespesas() {
	abreJanelaMaximizada('/saw/tiss/OutrasDespesas.do?method=abrirTelaDeOutrasDespesas');
}

function abreJanelaMaximizadaDeOutrasDespesas20() {
	abreJanelaMaximizada('/saw/tiss/OutrasDespesas.do?method=abrirTelaDeOutrasDespesas');
}

function abreJanelaMaximizadaDeResumoDeInternacao() {
	abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao.do?method=abrirTelaDeResumoDeInternacao');
}

function abreJanelaMaximizadaDeResumoDeInternacao20() {
	abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao.do?method=abrirTelaDeResumoDeInternacao');
}

function abreJanelaMaximizadaDeTratamentoOdontologico() {
	abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico.do?method=abrirTelaDeSolicitacaoDeTratamentoOdontologico');
}

function abreJanelaMaximizadaDeConsulta30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta30.do?method=abrirTelaDeSolicitacaoDeConsulta');
}

function abreJanelaMaximizadaDeConsulta40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta40.do?method=abrirTelaDeSolicitacaoDeConsulta');
}
		
function abreJanelaMaximizadaSPSADT30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT30.do?method=abrirTelaDeSolicitacaoDeSPSADT');
}

function abreJanelaMaximizadaSPSADT40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT40.do?method=abrirTelaDeSolicitacaoDeSPSADT');
}

function abreJanelaMaximizadaDeInternacao30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao30.do?method=abrirTelaDeSolicitacaoDeInternacao');
}

function abreJanelaMaximizadaDeInternacao40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao40.do?method=abrirTelaDeSolicitacaoDeInternacao');
}

function abreJanelaMaximizadaDeHonorarioIndividual30() {
	abreJanelaMaximizada('/saw/tiss/HonorarioIndividual30.do?method=abrirTelaDeHonorarioIndividual');
}

function abreJanelaMaximizadaDeHonorarioIndividual40() {
	abreJanelaMaximizada('/saw/tiss/HonorarioIndividual40.do?method=abrirTelaDeHonorarioIndividual');
}

function abreJanelaMaximizadaDeOutrasDespesas30() {
	abreJanelaMaximizada('/saw/tiss/OutrasDespesas30.do?method=abrirTelaDeOutrasDespesas');
}

function abreJanelaMaximizadaDeOutrasDespesas40() {
	abreJanelaMaximizada('/saw/tiss/OutrasDespesas40.do?method=abrirTelaDeOutrasDespesas');
}

function abreJanelaMaximizadaDeResumoDeInternacao30() {
	abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao30.do?method=abrirTelaDeResumoDeInternacao');
}

function abreJanelaMaximizadaDeResumoDeInternacao40() {
	abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao40.do?method=abrirTelaDeResumoDeInternacao');
}

function abreJanelaMaximizadaDeResumoDeInternacao40() {
	abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao40.do?method=abrirTelaDeResumoDeInternacao');
}

function abreJanelaMaximizadaDeResumoDeOpme30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeOpme30.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeResumoDeOpme40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeOpme40.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeOpme30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeOpme30.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeOpme40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeOpme40.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeQuimioterapia30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeQuimioterapia30.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeQuimioterapia40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeQuimioterapia40.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeOdontologia30() {
	abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico30.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeOdontologia40() {
	abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico40.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeRadioterapia30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRadioterapia30.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeRadioterapia40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRadioterapia40.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeProrrogacao30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeProrrogacao30.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeProrrogacao40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeProrrogacao40.do?method=abrirTelaDeCadastro');
}

function abreJanelaMaximizadaDeRecursoGlosa30() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRecursoGlosa30.do?method=abrirTelaDeSolicitacaoDeGlosa');
}

function abreJanelaMaximizadaDeRecursoGlosa40() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeRecursoGlosa40.do?method=abrirTelaDeSolicitacaoDeGlosa');
}

function abreJanelaMaximizadaDeConsultaAvulsa() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeConsulta.do?method=abrirTelaDeSolicitacaoDeConsultaAvulsa');
}
		
function abreJanelaMaximizadaSPSADTAvulsa() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT.do?method=abrirTelaDeSolicitacaoDeSPSADTAvulsa');
}

function abreJanelaMaximizadaDeInternacaoAvulsa() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeInternacao.do?method=abrirTelaDeSolicitacaoDeInternacaoAvulsa');
}

function abreJanelaMaximizadaDeHonorarioIndividualAvulsa() {
	abreJanelaMaximizada('/saw/tiss/HonorarioIndividual.do?method=abrirTelaDeHonorarioIndividualAvulsa');
}

function abreJanelaMaximizadaDeOutrasDespesasAvulsa() {
	abreJanelaMaximizada('/saw/tiss/OutrasDespesas.do?method=abrirTelaDeOutrasDespesasAvulsa');
}

function abreJanelaMaximizadaDeResumoDeInternacaoAvulsa() {
	abreJanelaMaximizada('/saw/tiss/ResumoDeInternacao.do?method=abrirTelaDeResumoDeInternacaoAvulsa');
}

function abreJanelaMaximizadaDeTratamentoOdontologicoAvulsa() {
	abreJanelaMaximizada('/saw/tiss/TratamentoOdontologico.do?method=abrirTelaDeSolicitacaoDeTratamentoOdontologico');
}

function abreJanelaMaximizadaSPSADT20() {
	abreJanelaMaximizada('/saw/tiss/SolicitacaoDeSPSADT.do?method=abrirTelaDeSolicitacaoDeSPSADT');
}

/**
 * Retorna o Unicode do tecla pressionada.
 * 
 * @author Daniel Melo Sá.
 */
function getUnicodeDaTeclaPressionada(evento) {
	var unicode = 0;
	if (evento != null) {
		// Verifica se o Browser Cliente é Internet Explorer.
		if (isBrowserInternetExplorer()) {
			var keyCode = evento.keyCode;
			if (keyCode > 0) {
				unicode = keyCode;
			}
		} else { // Se não for IE, considera o padrão DOM Mozilla.
			var charCode = evento.charCode;
			var keyCode = evento.keyCode;
			if (charCode > 0) {
				unicode = charCode;
			} else if (keyCode > 0) {
				unicode = keyCode;
			}
		}
	} else {
		alert("Erro de Sistema: \nO Objeto de evento da Tecla Pressionada não foi enviada corretamente a função referenciada.\nEntre em contato com a Operadora e relate o erro.");
	}
	return unicode;
}


/**
 * Verifica se a data é uma data válida.
 * @author Daniel Melo Sá.
 */
function isDataValida(data) {
	return data != "DD/MM/YYYY" && !isNaN(data.replace(/\//g, "")) && data.replace(/\//g, "").length == 8;
}

/**
 * Formata campos de forma genérica, de acordo com o formato estabelecido.
 * @author Desconhecido.
 * @see www.imasters.com.br
 */
function formatarCampo(campo, Mascara, evento) {
	var boleanoMascara;
	
	var Digitato = evento.keyCode;
	exp = /\-|\.|\/|\(|\)| /g
	campoSoNumeros = campo.value.toString().replace( exp, "" );
	
	var posicaoCampo = 0;
	var NovoValorCampo="";
	var TamanhoMascara = campoSoNumeros.length;;
	
	if (Digitato != 8) { // backspace
		for(i=0; i<= TamanhoMascara; i++) {
			boleanoMascara = ((Mascara.charAt(i) == "-") || (Mascara.charAt(i) == ".") || (Mascara.charAt(i) == "/"));
			boleanoMascara = boleanoMascara || ((Mascara.charAt(i) == "(") || (Mascara.charAt(i) == ")") || (Mascara.charAt(i) == " "));
			if (boleanoMascara) {
				NovoValorCampo += Mascara.charAt(i);
				TamanhoMascara++;
			}else {
				NovoValorCampo += campoSoNumeros.charAt(posicaoCampo);
				posicaoCampo++;
			}
		}
		campo.value = NovoValorCampo;
		return true;
	}else {
		return true;
	}
}

/**
 * Retorna os Milisegundos atual
 * @return new Date().getMilliseconds()
 * @author Daniel Melo Sá.
 */
function getMilisegundos() {
	return new Date().getMilliseconds();
}


/**
 * Capturar a posição do elemento
 * @return {left,top}
 * EXEMPLO CHAMADA
 * alert("esquerda:" + getPosicaoElemento("ELEMENTO").left);
 * alert("topo:" + getPosicaoElemento("ELEMENTO").top);
 * @author Adriano Borges.
 */
function getPosicaoElemento(elemID){
    var offsetTrail = document.getElementById(elemID);
    var offsetLeft = 0;
    var offsetTop = 0;
    while (offsetTrail) {
        offsetLeft += offsetTrail.offsetLeft;
        offsetTop += offsetTrail.offsetTop;
        offsetTrail = offsetTrail.offsetParent;
    }
    if (navigator.userAgent.indexOf("Mac") != -1 && typeof document.body.leftMargin != "undefined") {
        offsetLeft += document.body.leftMargin;
        offsetTop += document.body.topMargin;
    }
    return {left:offsetLeft, top:offsetTop};
}

function verificarQuantidadeDeCaracteres(campo , contador, maximo) {
	var campo = getComponente(campo);
	var cont = document.getElementById(contador);
	cont.innerHTML = maximo - campo.value.length;
	if (campo.value.length >= maximo){ 
		campo.value = campo.value.substring(0, maximo -1);
		cont.innerHTML = 0;
	}
}

function verificarQuantidadeDeCaracteresPorId(idCampo , contador, maximo) {
	var campo = document.getElementById(idCampo);
	var cont = document.getElementById(contador);
	cont.innerHTML = maximo - campo.value.length;
	if (campo.value.length >= maximo){
		campo.value = campo.value.substring(0, maximo -1);
		cont.innerHTML = 0;
	}
}

/**
 * Abre a tela de pesquisas de CEP no WebSite dos Correios.
 * @since 31/12/2007.
 */
function pesquisarCEP() {
	abreJanela('http://www.correios.com.br/servicos/cep/cep_default.cfm', 'PesquisaCEP', '730', '450');
}


/**
 * Abre a tela de Downloads da JRE mais atual, no próprio website da Sun.
 * @since 30/06/2008.
 */
function baixarJRE() {
	abreJanela("http://jdl.sun.com/webapps/getjava/BrowserRedirect?locale=pt_BR&host=www.java.com", '700', '600');
}


/**
 * Verifica se um ou mais e-mails são válidos, segundo regras de formatação.
 * Regras:
 *		- A identificação do endereço (texto antes do caracter "@") deve conter no mínimo 2 caracteres.
 *		- A identificação do endereço não pode conter espaços em branco. Ex: "saw@trixti.com.br"
 *		- O e-mail deve conter o caracter "@".
 *		- A identificação do domínio do servidor de e-mails deve conter no mínimo 3 caracteres.
 *		- A identificação do domínio do servidor de e-mails não pode conter espaços em branco. Ex: "suporte@trixti.com.br"
 * @since 25/03/2007.
 */
function validarEmails(emails, delimitadorDaLista) {
	var arrayDeEmails = emails.split(";");
	var email = "";
	var retorno = true;
	for (i = 0; i < arrayDeEmails.length; i++) {
		email = arrayDeEmails[i];
		var regex = /[A-Za-z0-9_.-]+@([A-Za-z0-9_]+\.)+[A-Za-z]{2,4}/;
		var string = email;
		if (!regex.test(string) && string !="") {
			alert("E-mail inválido ("+email+")");
			retorno = false;
			break;
		}
	}
	return retorno;
}


/**
 * Verifica se um e-mail é válidos, segundo regras de formatação.
 * Regras:
 *		- A identificação do endereço (texto antes do caracter "@") deve conter no mínimo 2 caracteres.
 *		- A identificação do endereço não pode conter espaços em branco. Ex: "suporte@trixti.com.br"
 *		- O e-mail deve conter o caracter "@".
 *		- A identificação do domínio do servidor de e-mails deve conter no mínimo 3 caracteres.
 *		- A identificação do domínio do servidor de e-mails não pode conter espaços em branco. Ex: "suporte@trixti.com.br"
 * @since 25/03/2007.
 */
function validarEmail(email, delimitadorDaLista) {
	var retorno = true;
	if (email.indexOf("@") == -1) {
		alert("O e-mail \"" + email + "\" não é um endereço eletrônico válido.");
		retorno = false;
	} else {
		var idEmail = email.split("@")[0];
		var dominioServidor = email.split("@")[1];
		
		// Verifica se o parâmetro passado possui dois endereços de e-mail.
		if (email.indexOf("@") != email.lastIndexOf("@")) {
			alert("O e-mail \"" + email + "\" não é um endereço eletrônico válido.");
			retorno = false;
		} else if (idEmail.length < 2 || dominioServidor.length < 3) {
			alert("O e-mail \"" + email + "\" não é um endereço eletrônico válido.");
			retorno = false;
		} else if (idEmail.trim().indexOf(" ") > 0 || dominioServidor.trim().indexOf(" ") > 0) {
			alert("Um endereço de e-mail não deve conter espaços em branco.");
			retorno = false;
		}
	}
	return retorno;
}

/**
 * Componente de Confirmação antes de executar a ação. 
 * @author Aislan Calazans
 * @since 13/05/2008.
 */
function confirmar(pMsg, pAcao, pForm){
	if (confirm(pMsg + '?          ')){
		submeterForm(pAcao, pForm);
	}	
}

/**
 * Verifica se o Java está habilitado no browser.
 * @return boolean - true, se o Java estiver habilitado; false, caso contrário.
 * @author Daniel Melo Sá.
 */
function isJavaHabilitado() {
	return navigator.javaEnabled();
}

/**
 * Verifica se uma Applet foi carregada com sucesso.
 * @param metodoDaApplet - Método da Applet. Ex: "getNomeDoBeneficiario()".
 * @param [nomeOuIndiceDaApplet] - Nome ou índice da applet no documento. (parâmetro opcional)
 * @return boolean - true, se o código conseguir executar o código da applet; false, caso contrário.
 */
function isAplletCarregada(metodoDaApplet, nomeOuIndiceDaApplet) {
	nomeOuIndiceDaApplet = nomeOuIndiceDaApplet || 0;
	var retorno = false;
	try {
		var metodoJS = "document.applets[" + nomeOuIndiceDaApplet + "]." + metodoDaApplet;
		eval(metodoJS);
		retorno = true;
	} catch(E) {
		// A Applet não foi carregada! Retorna o valor padrão da variável local "retorno" (false).
	}
	return retorno;
}

/**
 * Retorna a Applet desejada.
 * @param [nomeOuIndiceDaApplet] - Nome ou índice da applet no documento. (parâmetro opcional)
 * @return Applet - Objeto que representa a Applet. 
 */
function getApplet(nomeOuIndiceDaApplet) {
	nomeOuIndiceDaApplet = nomeOuIndiceDaApplet || 0;
	try {
		if (nomeOuIndiceDaApplet == 0)
			return document.getElementsByTagName("applet")[0];
		return document.getElementById(nomeOuIndiceDaApplet);
	} catch (E) { 
		return null;
	}
}


var width = screen.width;
var height = screen.height - 20;
var x = 0;
var y = 0;
var b = false;
function reprocessIEPopup() {
	if (isBrowserInternetExplorer()) {
		if (b) {
			b = !b;
			height = height + 5;
			width = width + 1;
			x = 1;
			y = 1;
		} else {
			b = !b;
			height = height - 5;
			width = width - 1;
			x = 0;
			y = 0;
		}
		window.moveTo(x,y);
		window.resizeTo(width, height);
	}
}


// Aislan
function validarTamanhoTextArea(idTdExibicao, pTextArea, evento, tamMax){
   var tam = pTextArea.value.length;
   var tecla = getTecla(evento);
   if (tecla == 8 || tecla == 46){
     tam--;
     if (tam < 0){
        tam = 0;
     }
   }else{
     if (tecla == 13){
        /*if (document.all) {
  			evento.returnValue = false;
		}else{
			evento.preventDefault(); 
		}*/
     }else{
        if (tecla == 32 || tecla >= 48 && tecla <= 57 || tecla >= 65 && tecla <= 90 || tecla >= 96 && tecla <= 107 || tecla >= 109 && tecla <= 111 || tecla >= 186 && tecla <= 194 || tecla == 219 || tecla >= 221 && tecla <= 222 || tecla == 226 ){
          tam++;
        }  
     }
   } 	
   if (tam == tamMax){
	  tam = tamMax;
 	  document.getElementById(idTdExibicao).innerHTML = "<font color=\"red\">Tamanho máximo atingido.</font>";
   }else{
      if (tam > tamMax){
	    tam = tamMax;
	    retirarTexto(pTextArea, tamMax);
 	    document.getElementById(idTdExibicao).innerHTML = "<font color=\"red\">Tamanho máximo atingido.</font>";
 	    recalculaTextArea(pTextArea, idTdExibicao, tamMax);
 	    if (tecla != 8 || tecla != 46){
 	      if (document.all){
 	      	 event.returnValue = false;
 	      }else{
 	         evento.preventDefault();
 	      }	 
	    }	  
      }else{
      	document.getElementById(idTdExibicao).innerHTML = tam +" de "+ tamMax +" restantes.";
      }	
   } 	 
}


function recalculaTextArea(pTextArea, idTdExibicao, tamMax){
   if (pTextArea.value.length >= tamMax){
	   document.getElementById(idTdExibicao).innerHTML = "<font color=\"red\">Tamanho máximo atingido.</font>";
	   retirarTexto(pTextArea, tamMax);
   }else{
       document.getElementById(idTdExibicao).innerHTML = pTextArea.value.length +" de "+ tamMax +" restantes.";
   }	   
}

function retirarTexto(pTextArea, pTamMax){
    pTextArea.value = pTextArea.value.substring(0, pTamMax);
}

//Alteração da função para abrir popup centralizado no Firefox também - Aislan 30/09/2008
function abrirCentralizado(URL, nome, rolagem, largura, altura) {
	var posx = largura;
	var posy = altura;
	var medidas = '';
	if (document.all){
		posx = (screen.width/2)-(largura/2) 
    	posy = (screen.height/2)-(altura/2)
    	medidas='width=' + largura + ' height=' + altura + ' top=' + posy + ' left=' + posx + ' ';
    	janela(URL, nome, medidas + ', scrollbars=' + rolagem);
    }else{	 
 	 	posy = parseInt((screen.availHeight-posy)/2);
    	posx = parseInt((screen.availWidth-posx)/2);
    	medidas = "width="+largura+",height="+altura+",top="+posy+",left="+posx+",resizable=no,scrollbars="+ rolagem +",status=no";
    	janela(URL, nome, medidas);
    } 
}

var janelaAberta = null;
function janela(url,nome,propriedades){
	var novaJanela = window.open(url,nome,propriedades);
	if(janelaAberta == null){
		janelaAberta = novaJanela;
	}
}

function dataMaior(data2, data1){
    return parseInt( data2.split( "/" )[2].toString() + data2.split( "/" )[1].toString() + data2.split( "/" )[0].toString() ) > parseInt( data1.split( "/" )[2].toString() + data1.split( "/" )[1].toString() + data1.split( "/" )[0].toString() ) ;
}

function dataIgual(data2, data1){
    return parseInt( data2.split( "/" )[2].toString() + data2.split( "/" )[1].toString() + data2.split( "/" )[0].toString() ) == parseInt( data1.split( "/" )[2].toString() + data1.split( "/" )[1].toString() + data1.split( "/" )[0].toString() ) ;
}

function dataMaiorDiaMes(data2, data1){
    return parseInt( data2.split( "/" )[1].toString() + data2.split( "/" )[0].toString() ) > parseInt(data1.split( "/" )[1].toString() + data1.split( "/" )[0].toString() ) ;
}

function dataIgualDiaMes(data2, data1){
    return parseInt( data2.split( "/" )[1].toString() + data2.split( "/" )[0].toString() ) == parseInt(data1.split( "/" )[1].toString() + data1.split( "/" )[0].toString() ) ;
}

function validaDigito(unimed, codigoBeneficiario){
	// (1{13}|2{13}|3{13}|4{13}|5{13}|6{13}|7{13}|8{13}|9{13}|0{13})
	// (1|2|3|4|5|6|7|8|9|0){13}
	// ([0-9])\1{12}
	// torna invalido codigos que são ex: 111111111111, 222222222222 etc
	if (/([0-9])\1{12}/.test(codigoBeneficiario) == true) {
		// eh invalido
		return false;
	}
	
	var somatoria = 0;
	var fatorMultiplicacao = 9;
	while (unimed.length < 4){
		unimed = '0'+unimed;
	}
	var codigo = unimed + codigoBeneficiario.substr(0, 12);
	var digitoInformado = codigoBeneficiario.substr(12);
	var arrayCodigo = codigo.split("");
 		
	for(i = 0; i < arrayCodigo.length; i++){
		somatoria = somatoria + (arrayCodigo[i] * fatorMultiplicacao);
		if(fatorMultiplicacao == 2){
			fatorMultiplicacao = 9;
		} else {
			fatorMultiplicacao--;
		}
	}
	var digito = 11 - (somatoria % 11);
	if(digito > 9){
		digito = 0;
	}
	return digitoInformado == digito;
}

function calculaDigitoMod11(codigo, numDigito, limMult) {
	var multiplicador, soma, i, n, digito;
	for(n=1; n <= numDigito; n++) {
		soma = 0;
		multiplicador = 2;
		for(i = codigo.length-1; i>=0; i--) {
			soma += (multiplicador * parseInt(codigo.charAt(i)));
			if(++multiplicador > limMult){
				multiplicador = 2;
			}
		}
		digito = 11 - (soma % 11);
		if (digito > 9) {
		    digito = 0;
		}
		codigo += digito;
	}
	return codigo.substr(codigo.length-numDigito, numDigito);
}

function validaDigitoPostalSaude(codigoBeneficiario){
	var codigo = codigoBeneficiario.substr(0, 14);
	var digitoInformado = codigoBeneficiario.substr(14,16);
	for(n=1; n < 5; n++) {
		if(calculaDigitoMod11(codigo+n, 2, 9) == digitoInformado){
			return true;
		} 
	}
	return false;
}


/**
 * @param string
 * @param token
 * @param newtoken
 * @return
 */
function replaceAll(string, token, newtoken) {
	while (string.indexOf(token) != -1) {
 		string = string.replace(token, newtoken);
	}
	return string;
}

/**
 * Insere máscara monetária
 * @param num Número sem formatação     12345678.90
 * @return num Resultado com formatação 12.345.678,90
 * @author diego
 */
function formatarMoeda(num) {
	num = num.toString().replace(/\$|\,/g,'');
	if(isNaN(num)) {
		num = "0";
	}
	cents = Math.floor((num*100+0.5)%100);
	num = Math.floor((num*100+0.5)/100).toString();
	if(cents < 10) {
		cents = "0" + cents;
	}
	for (var i = 0; i < Math.floor((num.length-(1+i))/3); i++){
		num = num.substring(0,num.length-(4*i+3)) +'.'+ num.substring(num.length-(4*i+3));
	}
	return (num +','+ cents);
} 

/**
 * Retira máscara de moeda
 * @param num Número com formatação     12.345.678,90
 * @return num Resultado sem formatação 12345678.90
 * @author diego
 */
function desformatarMoeda(num) {
	num = num.toString().replace(/\./g,'');
	num = num.toString().replace(/\,/g,'.');
	return num;
}
 
function chkValorMoeda(obj, msg) {
	if (!obj || obj.value=="") {
		return;
	}
	var n = formatarMoeda(obj.value);
	if (n=="NaN") {
		if (!msg || msg=="") {
			msg = "Campo deve ser Numérico!";
		}
		obj.value = '';
		return msgErr(obj, msg);
	} else {
		obj.value = obj.value;
	}
}

// =========== INICIO DE FUNCTIONS PARA BLOQUEAR TECLADO ===========
var contexMenu = document.oncontextmenu;
function alertaBotaoDireitoDoMouseBloqueado() {
	alert('Botão direito do mouse bloqueado!');
	return false;
}
function alertaBotaoScrollDoMouseBloqueado() {
	alert('Botão scroll do mouse bloqueado!');
	return false;
}
function desbloquearBotaoDireitoDoMouse() {
	document.oncontextmenu = contexMenu;
}
function bloquearBotaoDireitoDoMouse() {
	document.oncontextmenu = alertaBotaoDireitoDoMouseBloqueado;
}
function bloquearBotaoScroll(event) {
	var button;
	if (event.which == null) {
		button= (event.button == 4) ? "MIDDLE" : "RIGHT";
	} else {
		button = (event.which == 2) ? "MIDDLE" : "RIGHT";
	}
	if (button == "MIDDLE") {
		alertaBotaoScrollDoMouseBloqueado();
	}
	naoExecutar(event);
}
function naoExecutar(event) {
	if (event.preventDefault)
		event.preventDefault();
	else
		event.returnValue= false;
	return false;
}
// =========== FIM DE FUNCTIONS PARA BLOQUEAR TECLADO ===========
	

function voltarOuFechar(paginaRetorno) {
	try {
		if (paginaRetorno != null && paginaRetorno != '') {
			window.location = paginaRetorno;
		} else if (window.history.length <= 1) {
			fecharPopUp();
		} else {
			history.go(-1);
		}
	} catch(E) { }
}

function definirBotaoVoltarOuFechar(paginaRetorno) {
	try {
		if (paginaRetorno != null && paginaRetorno != "") {
			document.getElementById("botaoFecharouVoltar").value="Voltar";
		} else if (window.history.length <= 1) {
			document.getElementById("botaoFecharouVoltar").value="Fechar";
		} else {
			document.getElementById("botaoFecharouVoltar").value="Voltar";
		}
	} catch(E) { }
}

function limparForm(theform) {
	theform.reset();
}

function ValidaTamanhoTextArea(campo, tamanhoMaximo) {
	if(campo.value.legnth < tamanhoMaximo){
	}else{
		campo.value = campo.value.substring(0, 239);
	}
}

function validaStringSemNumero(campo) {
	for (var i = 0; i < campo.value.length; i++) {
		if (campo.value.charAt(i).match("[0-9]")) {
			alert("Campo não pode conter Número!");
			campo.value = "";
			campo.focus();
			return false;
		}
	}
}

function chkHoraMinuto(obj) {
	 if (designMode) return;
	   if (!obj || obj.value == "") return;
	   var validacaoHora = cHora(obj.value.toString(), "hh:mm");
	   if (validacaoHora < 0) {
		   if (validacaoHora == -1) return msgErr(obj, " Informar hora/minuto no formato HH:MM");
		   if (validacaoHora == -2) return msgErr(obj, " Hora inválida");
		   if (validacaoHora == -3) return msgErr(obj, " Minuto inválido");
	   } else {
		   obj.value =  validacaoHora;
	   }
}

function chkHoraMinutoSemAlert(obj) {
	var retorno = "";
	if (designMode){
		retorno = "";
	}
	if (!obj || obj.value == ""){
		retorno = "";
	}
	var validacaoHora = cHora(obj.value.toString(), "hh:mm");
	if (validacaoHora < 0) {
		if (validacaoHora == -1){
			retorno = " Informar hora/minuto no formato HH:MM";
		}
		if (validacaoHora == -2){
			retorno = " Hora inválida";
		}
		if (validacaoHora == -3){
			retorno = " Minuto inválido";
		}
	} else {
		obj.value =  validacaoHora;
	}
	return retorno;
}

// obj deve ser checkbox
function marcarDesmarcar(obj) {
	if (obj.checked) {
		obj.checked = false;
	} else {
		obj.checked = true;
	}
}

/**
 * verifica se hora2 é menor que hora1.
 * Formato da hora: HH:mm
 * @param obj1
 * @param obj2
 * @returns
 */
function chkHoraMaiorOuIgual(obj1, obj2) {
	var h1 = obj1.value.replace(":", "");
	var h2 = obj2.value.replace(":", "");
	if (h2 <= h1) {
		return true;
	}
	return false;
}

//Converte hora no formato ##:## Ex.: 08:00 para minutos
function converterHoraParaMinutos(hora) {
	h = hora.substring(0,2);
	m = hora.substring(3,5);
	var minutos = ((parseInt(h,10) * 60) + parseInt(m,10));
	return minutos;
}

// EXPRESSAO REGULAR PARA ACEITAR APENAS NUMEROS INTEIROS
function isInteger(sNum){
   var reDigits = /^\d+$/;
   return reDigits.test(sNum);
}

// EXPRESSÃO REGULAR PARA COLOCAR MASCARA IPV4
function mascaraIp(e,obj){
    if (document.all){var evt=event.keyCode;} 
    else{var evt = e.charCode;}    
    if (evt <20) return true;
    obj.value = obj.value.replace(/(\.00)/g, ".0"); 
    obj.value = obj.value.replace(/(\.000)/g, ".0");
    obj.value = obj.value.replace(/(\.01)/g, ".1");
    obj.value = obj.value.replace(/(\.001)/g, ".1");
    obj.value = obj.value.replace(/(\.02)/g, ".2");
    obj.value = obj.value.replace(/(\.002)/g, ".2");
    obj.value = obj.value.replace(/(\.03)/g, ".3");
    obj.value = obj.value.replace(/(\.003)/g, ".3");
    obj.value = obj.value.replace(/(\.04)/g, ".4");
    obj.value = obj.value.replace(/(\.004)/g, ".4");
    obj.value = obj.value.replace(/(\.05)/g, ".5");
    obj.value = obj.value.replace(/(\.005)/g, ".5");
    obj.value = obj.value.replace(/(\.06)/g, ".6");
    obj.value = obj.value.replace(/(\.006)/g, ".6");
    obj.value = obj.value.replace(/(\.07)/g, ".7");
    obj.value = obj.value.replace(/(\.007)/g, ".7");
    obj.value = obj.value.replace(/(\.08)/g, ".8");
    obj.value = obj.value.replace(/(\.008)/g, ".8");
    obj.value = obj.value.replace(/(\.09)/g, ".9");
    obj.value = obj.value.replace(/(\.009)/g, ".9");
    if ( (/^(\d{1,3}\.){3}\d{3}$/).test(obj.value) ) return false;        
    var chr= String.fromCharCode(evt); 
    if (! (/[\d\.]/).test(chr)) return false;  
    if (chr=='.')
        return (!(/\.$|^(\d{1,3}\.){3}/).test(obj.value) );
    else 
        if( (/\d{3}$/).test(obj.value) )
            obj.value+='.';            
    return true;
}

// EXPRESSÃO PARA VALIDAR NUMEROS IPV4
function validarIP(ip,showErrMsg){
	if(ip == ""){
		return true;
	}else{
        a = (/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/).test(ip);
        if (a == false){
            alert(ip+' não é um ip válido!');
        }
    return a;
	}
}

// Verifica se número é decimal.
function isDecimal(num) {
	return !(isNaN(num) || num.indexOf(".")<0);
}

/**
 * verifica se o ip2 é menor que o ip1.
 * Formato do ip: xxx.xxx.xxx.xxx
 * @param obj1
 * @param obj2
 * @returns
 */
function chkIpMaior(obj1, obj2){
	var ip1 = obj1.value.replace(".", "");
	var ip2 = obj2.value.replace(".", "");
	if (ip2 < ip1) {
		return true;
	}
	return false;
}

function checkAbreviado(campo){
	var re5digit=/\s+[A-Z]{1}\.?\s+/;
	if (campo.value.search(re5digit)!=-1) {
		alert('Não é permitido abreviar nomes!');
		return true;
	}else{
		return false;
	}
}

function verificarCaracter(campo) {
    if(campo.value !=     ""){
    var novoArray = campo.value.split(" ");
    for(i = 0; i < novoArray.length; i++){
        if(novoArray[i].length < 2 ){
            alert("Não é permitido ESPAÇOS nem abreviação de nome com SOMENTE UMA LETRA!");
            campo.value="";
            campo.focus();
            return false;
        }
      }
    }
  }


function validarCampoNome(field){
    var arrayNome = field.value.split(" ");
    var retorno = false;
    if (arrayNome.length > 1){
           retorno = true;
    }           
    if(!retorno){
        alert('O Campo '+field.title+' deve ser preenchido com no mínimo 2 palavras!');
        field.value="";
        field.focus();
    }
    return retorno;
 }

function retiraAcentos(campo) {
    var palavra = campo.value;
    var com_acento = 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÖÔÚÙÛÜÇ';
    var sem_acento = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';
    var nova='';
    for(i=0;i<palavra.length;i++) {
      if (com_acento.indexOf(palavra.substr(i,1))>=0) {
      nova+=sem_acento.substr(com_acento.indexOf(palavra.substr(i,1)),1);
      }
      else {
       nova+=palavra.substr(i,1);
      }
    }
    document.getElementById(campo.id).value=nova;
    return nova;
}

function retiraAcentosTexto(texto) {
    var com_acento = 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÖÔÚÙÛÜÇ';
    var sem_acento = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';
    var nova='';
    for(i=0;i<texto.length;i++) {
      if (com_acento.indexOf(texto.substr(i,1))>=0) {
      nova+=sem_acento.substr(com_acento.indexOf(texto.substr(i,1)),1);
      }
      else {
       nova+=texto.substr(i,1);
      }
    }
    return nova;
}

function limparCaracteresEspeciais(campo) {
	var string = campo.value;
	campo.value = string.replace(/[^A-Za-zÀ-ü ]/g,"");
}

function limparCaracteresEspeciaisSemConsiderarNumeros(campo) {
	var string = campo.value;
	campo.value = string.replace(/[^A-Za-zÀ-ü0-9- ]/g,"");
}

function mascaraCelularSemDdd(campo, idDDD){
    var mask;
    mask = campo.value;
	var ddd = document.getElementById(idDDD);
	if(ddd.value == '11' || ddd.value == '12' || ddd.value == '13' || ddd.value == '14' || ddd.value == '15' || ddd.value == '16' || 
			ddd.value == '17' || ddd.value == '18' || ddd.value == '19' || ddd.value == '21' || ddd.value == '22' || ddd.value == '24' || 
			ddd.value == '27' || ddd.value == '28' || ddd.value == '29' || ddd.value == '61' || ddd.value == '86' || ddd.value == '91' || 
			ddd.value == '92' || ddd.value == '93' || ddd.value == '96' || ddd.value == '97' || ddd.value == '98' || ddd.value == '99'){
		mask=mask.replace(/(\d{5})(\d)/,"$1-$2");   //Coloca hífen entre o quarto e o quinto dígitos
    	campo.value = mask;
	}else if(mask.length > 9 ){
		mask = mask.substr(0,mask.length -1)
		mask=mask.replace(/(\d{4})(\d)/,"$1-$2");   //Coloca hífen entre o quarto e o quinto dígitos
		campo.value = mask;
	}else{
		mask=mask.replace(/(\d{4})(\d)/,"$1-$2");   //Coloca hífen entre o quarto e o quinto dígitos
		campo.value = mask;
	}
}

function mascaraTelefoneSemDdd(campo){
	var v= campo.value;
	v=v.replace(/\D/g,"");                 //Remove tudo o que não é dígito
	v=v.replace(/(\d{4})(\d)/,"$1-$2");    //Coloca hífen entre o quarto e o quinto dígitos
	campo.value = v;
}

function alertaNumeroInvalido(campo){
	alert('Número de celular inválido');
	limparCampo(campo);
	campo.focus();
	return;
}

function validarTelefone(campo){
	campoValue = campo.value;
	if(campoValue.length < 9){
		alert("Número de Telefone Inválido!");
		campo.focus();
	}
}

function validarCelularComMask(campo, idDDD){
	campoValue = campo.value;
	primeiroIndice = campo.value.charAt(0);
	var ddd = document.getElementById(idDDD);
	if(ddd.value != '11' && campoValue.length < 9){
		alertaNumeroInvalido(campo);
	}else if(ddd.value == '11' && primeiroIndice != '9'){
		alertaNumeroInvalido(campo);
	} else if(ddd.value == '11'  && campoValue.length <= 9){
		alertaNumeroInvalido(campo);
	}
	if(primeiroIndice == '6' || primeiroIndice == '5' || primeiroIndice == '4' || primeiroIndice == '3' || primeiroIndice == '2' || primeiroIndice == '1' || primeiroIndice == '0'){
		alertaNumeroInvalido(campo);
	}
	if(campoValue == '77777777' || campoValue == '88888888' || campoValue == '99999999' || campoValue == '999999999'){
		alertaNumeroInvalido(campo);
	}
}

function mascara(o,f){
    v_obj=o
    v_fun=f
    setTimeout("execmascara()",1)
}

function execmascara(){
    v_obj.value=v_fun(v_obj.value)
}

function soNumeros(v){
	  v=v.replace(/\D/g,"")
	  return v;
}
function valor(v){
    v=v.replace(/\D/g,"") // Remove tudo o que no dgito
    v=v.replace(/(\d)(\d{2})$/,"$1.$2") // Coloca ponto antes dos 2 últimos
										// digitos
    return v
}

function mrg(v){
    v=v.replace(/\D/g,"");                                      //Remove tudo o que não é dígito
        v=v.replace(/(\d)(\d{7})$/,"$1.$2");    //Coloca o . antes dos últimos 3 dígitos, e antes do verificador
        v=v.replace(/(\d)(\d{4})$/,"$1.$2");    //Coloca o . antes dos últimos 3 dígitos, e antes do verificador
        v=v.replace(/(\d)(\d)$/,"$1-$2");               //Coloca o - antes do último dígito
    return v;
}

function valorComVirgula(v){
    v=v.replace(/\D/g,"") // Remove tudo o que não é dígito
    v=v.replace(/(\d)(\d{2})$/,"$1,$2") // Coloca vírgula antes dos 2 últimos
										// digitos
    return v
}

function valorComQuatroCasasDecimais(v){
    v=v.replace(/\D/g,"") // Remove tudo o que não é dígito
    v=v.replace(/(\d)(\d{4})$/,"$1,$2") // Coloca vírgula antes dos 4 últimos
										// digitos
    return v
}

function valorComTresInteiroEQuatroCasasDecimais(v){
    v=v.replace(/\D/g,"") // Remove tudo o que não é dígito
    v=v.replace(/(\d{3})(\d{1,4})$/,"$1,$2") // Coloca vírgula antes dos 4 últimos
										// digitos
    return v
}

function valorComCincoInteiroEQuatroCasasDecimais(v){
    v=v.replace(/\D/g,"") // Remove tudo o que não é dígito
    v=v.replace(/(\d{3})(\d{1,4})$/,"$1,$2") // Coloca vírgula antes dos 4 últimos
										// digitos
    return v
}

function validarCaracteres(campo){
	var regex = /^([a-z]|[A-Z]|[À-ü]){3}/g;
	var string = campo.value;
	var expressaoValida = regex.test(string);
	if (!expressaoValida){
		return false;
	} else {
		return true;
	}
}

function validarPorcentagem(campo) {
	var regex = /^-?[0-9]{0,2}(.[0-9]{1,2})?$|^-?(100)(.[0]{1,2})?$/g;
	var string = campo.value;
	var expressaoValida = regex.test(string);
	if (!expressaoValida || string == '-'){
		alert("Caractere Inválido!");
		campo.value = '';
		return false;
	} else {
		return true;
	}
}

function validaSomenteNumeros(campo) {
	var regex = /^[0-9]{1,}$/; //permite somente números
	return regex.test(campo);
}

function retirarEspacosCaracteresEspeciais(v) {
	var regex = /\W|_|/g;	//retira todos os caracteres especiais incluindo espaços e underscore
	v = v.replace(regex,"");
	return v;
}

function retirarEspacosCaracteresEspeciais2(v) {
	v = v.replace(/[^a-zA-Z0-9\-\/_]/g, "");
    if (!/\d/.test(v)) {
        v = "";
    }
    return v;
}

function validaCaracteres(campo){
	var regex = /^[a-zA-Z0-9]+$/;
	return regex.test(campo);
}

function evalScript(scripts) {
	try {
		if(scripts != '')  {        
			var script = "";
            scripts = scripts.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function(){
            	if (scripts !== null) script += arguments[1] + '\n';
            	return '';});
                if(script) (window.execScript) ? window.execScript(script) : window.setTimeout(script, 0);
               }
          return false;
       }
       catch(e)
       { 
       alert(e)
       }
}

function validarHoraProcedimentoRealizado(campo) {
	var regex = /^([0-1][0-9]|[2][0-3]):([0-5][0-9])$/g;
	var string = campo.value;
	var expressaoValida = regex.test(string);
	if(string != ''){
		if (!expressaoValida){
			alert("Hora Inválida!");
			campo.value = '';
			return false;
		} else {
			return true;
		}
	} else{
		return true;
	}
}
	
function validarDataPorQuantidadeDias(data,qtdDias) { 
	if (data.value == '') return; 
	mask = 'dd/MM/yyyy'; msg = ''; 
	var st = cData(data.value, mask); 
	if (st == -1) return msgErr(data, msg + ' Deve conter 6 ou 8 números'); 
	if (st == -2) return msgErr(data, msg + ' Mês inválido'); 
	if (st == -3) return msgErr(data, msg + ' Dia inválido'); 
	data.value = st; 
	var dataForm = st.split('/'); 
	var dataAtual = new Date(); 
	var currentMonth = dataAtual.getMonth(); currentMonth++; 
	var dataInformada = new Date(dataForm[2], dataForm[1]-1, dataForm[0]); 
	if ( dataAtual < dataInformada ) { 
		return msgErr(data, ' A data informada [' + st + '] é MAIOR que a data atual [' + dataAtual.getDate() + '/' + currentMonth + '/' + dataAtual.getFullYear() + '].'); 
	} 
	if ((Math.ceil(dataAtual-dataInformada)/1000/60/60/24) > qtdDias) { 
		return msgErr(data, ' A data informada [' + st + '] é MENOR que a data atual [' + dataAtual.getDate() + '/' + currentMonth + '/' + dataAtual.getFullYear() + '] em mais de '+qtdDias+' dias de antecedência.'); 
	} 
}

function validarDataMenorPorQuantidadeDias(data,qtdDias) { 
	if (data.value == '') return; 
	mask = 'dd/MM/yyyy'; msg = ''; 
	var st = cData(data.value, mask); 
	if (st == -1) return msgErr(data, msg + ' Deve conter 6 ou 8 números'); 
	if (st == -2) return msgErr(data, msg + ' Mês inválido'); 
	if (st == -3) return msgErr(data, msg + ' Dia inválido'); 
	data.value = st; 
	var dataForm = st.split('/'); 
	var dataAtual = new Date(); 
	var currentMonth = dataAtual.getMonth(); currentMonth++; 
	var dataInformada = new Date(dataForm[2], dataForm[1]-1, dataForm[0]); 
	if ((Math.ceil(dataAtual-dataInformada)/1000/60/60/24) > qtdDias) { 
		return msgErr(data, ' A data informada [' + st + '] é MENOR que a data atual [' + dataAtual.getDate() + '/' + currentMonth + '/' + dataAtual.getFullYear() + '] em mais de '+qtdDias+' dias de antecedência.'); 
	} 
}

function validarTelefoneNomenclaturaAtual(campo, obrigatorio){
	if (obrigatorio == 'S' && campo.value.trim() == '') {
		campo.value = '';
		return msgErr(campo,"O telefone deve conter 13 ou 14 caracteres no formato (##)####-#### ou no formato (##)#####-####!");
	}
	if (campo.value.trim() != '') {
		var regex = /^\([1-9][1-9]\)([1-9]\d{3}|[1-9]\d{4})-\d{4}$/;
		var string = campo.value.trim();
		var expressaoValida = regex.test(string);
		if (!expressaoValida){
			campo.value = '';
			return msgErr(campo,"O telefone deve conter 13 ou 14 caracteres no formato (##)####-####, ou no formato (##)#####-####,\nou não pode conter zero no ddd, ou o número do telefone não pode iniciar com zero");
		} else {
			return true;
		}
	}
}

function validarTelefoneNomeclaturaAtualSemDDD(campo){
	if (campo.value.trim() != '') {
		var regex = /^([1-9]\d{3}|[1-9]\d{4})-\d{4}$/;
		var string = campo.value.trim();
		var expressaoValida = regex.test(string);
		if (!expressaoValida){
			campo.value = '';
			return msgErr(campo,"O telefone deve conter 8 ou 9 caracteres no formato ####-####, ou no formato #####-####,\nou o número do telefone não pode iniciar com zero!");
		} else {
			return true;
		}
	}
}

function mtelSemDDD(v){
	v=v.replace(/\D/g,""); //Remove tudo o que não é dígito
	//v=v.replace(/^(\d{2})(\d)/g,"($1)$2"); //Coloca parênteses em volta dos dois primeiros dígitos
	v=v.replace(/(\d)(\d{4})$/,"$1-$2"); //Coloca hífen entre o quarto e o quinto dígitos
	return v;
}

function moeda(v){ 
	v=v.replace(/\D/g,"") // permite digitar apenas numero 
	v=v.replace(/(\d{1})(\d{5})$/,"$1.$2") // coloca ponto antes dos ultimos 5 digitos 
	v=v.replace(/(\d{1})(\d{1,2})$/,"$1,$2") // coloca virgula antes dos ultimos 2 digitos 
	return v;
}

function mtel(v){
	v=v.replace(/\D/g,""); //Remove tudo o que não é dígito
	v=v.replace(/^(\d{2})(\d)/g,"($1)$2"); //Coloca parênteses em volta dos dois primeiros dígitos
	v=v.replace(/(\d)(\d{4})$/,"$1-$2"); //Coloca hífen entre o quarto e o quinto dígitos
	return v;
}

function mcel(v){
	v=v.replace(/\D/g,""); //Remove tudo o que não é dígito
	v=v.replace(/(\d)(\d{4})$/,"$1-$2"); //Coloca hífen entre o quarto e o quinto dígitos
	return v;
}

function validarNumeroEVirgula(campo) {
	if (campo.value != '') {
		var v= campo.value+',';
		var regex = /^([0-9]{1,}\,){1,}$/g;
		if (v != '' && !regex.test(v)) {
			alert("O campo deve ser numérico e caso necessário separado por vírgula!");
		}
	}
}

function preencherJustificativaGlosaAuditoria(campo){
	var aux = document.getElementById('selectJustificativa');
	var text = aux.options[aux.selectedIndex].innerHTML;
	document.getElementById(campo).value = "";
	if(text != 'Selecione'){
		document.getElementById(campo).value = document.getElementById('selectJustificativa').value+"\n";
		document.getElementById('selectJustificativa').value = text+" - "+document.getElementById('selectJustificativa').value+"\n";
	}
}

function checaCNPJ(obj) {
    var msg = 'CNPJ inválido!';
    var cnpj = obj.value;

    cnpj = cnpj.replace(/[^\w]+/g, '');  

    var cnpjsInvalidos = [
        "00000000000000", "11111111111111", "22222222222222", "33333333333333",
        "44444444444444", "55555555555555", "66666666666666", "77777777777777",
        "88888888888888", "99999999999999"
    ];

    if (cnpjsInvalidos.includes(cnpj)) {
        alert(msg);
        obj.value = '';
        window.tempEl = obj;
        setTimeout(function() { window.tempEl.focus(); }, 1);
        return false;
    }

    if (!isCnpjValido(cnpj)) {
        alert(msg);
        obj.value = '';
        window.tempEl = obj;
        setTimeout(function() { window.tempEl.focus(); }, 1);
        return false;
    }

    return true;
}

function retirarNaoNumericos(campo) {
	var valorCorrigido = parseFloat(limpaNumero(campo.value));
	campo.value = (valorCorrigido > 0 ? formatarMoeda(valorCorrigido) : "");
}

function get_browser(){
	var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
	if(/trident/i.test(M[1])){
		tem=/\brv[ :]+(\d+)/g.exec(ua) || [];
		return {name:'IE',version:(tem[1]||'')};
	}
	if(M[1]==='Chrome'){
		tem=ua.match(/\bOPR\/(\d+)/)
		if(tem!=null) {
			return {name:'Opera', version:tem[1]};
			}
	}
	M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
	if((tem=ua.match(/version\/(\d+)/i))!=null) {
		M.splice(1,1,tem[1]);
	}
	return {
	name: M[0],
	version: M[1]
	};
}

function isNavegadorAceitaUrlComAcento(){
	var retorno = true;
	var browser = get_browser();
	if(browser.name.toLowerCase() == "firefox" && ((browser.version > 47 && browser.version < 54) || (browser.version > 56 && browser.version < 135))){
		retorno= false;
	}
	return retorno;
}

function dataMaiorOuIgual(data2, data1){
    return parseInt( data2.split( "/" )[2].toString() + data2.split( "/" )[1].toString() + data2.split( "/" )[0].toString() ) >= parseInt( data1.split( "/" )[2].toString() + data1.split( "/" )[1].toString() + data1.split( "/" )[0].toString() ) ;
}

/**
* @function isPeriodoEntreDatasValido
* @param dataInicio deve ser string no formato dd/mm/yyyy
* @param dataFim deve ser string no formato dd/mm/yyyy
* @param qtdMaxDias deve ser inteiro
* @return boolean
**/
function isPeriodoEntreDatasValido(dataInicio,dataFim, qtdMaxDias){
	var retorno = false;
	
	var diaInicio= parseInt(dataInicio.substring(0,2));
	var mesInicio= parseInt(dataInicio.substring(3,5))-1;
	var anoInicio= parseInt(dataInicio.substring(6,10));
	var inicio = new Date(anoInicio,mesInicio,diaInicio);
	
	var diaFim= parseInt(dataFim.substring(0,2));
	var mesFim= parseInt(dataFim.substring(3,5))-1;
	var anoFim= parseInt(dataFim.substring(6,10));
	var fim = new Date(anoFim,mesFim,diaFim);

	var periodo = parseInt((fim - inicio)/(24*60*60*1000)+1);
	
	if(periodo > 0 && periodo <= qtdMaxDias){
		retorno = true;
	}

	return retorno;
}

function isBeneficiarioDeIntercamio(){
	var retorno = false;
	try{
		var unimedUsuario = document.getElementById('unimedSessao').value;
		var unimedBeneficiario = getCodigoUnimedBeneficiario().value;
		
		if(getCodigoBeneficiario() != null && getCodigoBeneficiario().value != ''){
			if(unimedUsuario != unimedBeneficiario){
				retorno= true;
			}
		}else if (document.getElementById("tipoDeIntegracao").value != "WEB_SERVICE"){
			alert("É obrigatório o preenchimento do campo Beneficiário!");
		}
	}catch(e){
	}finally{
		return retorno;
	}
}

function truncateWithDuasDecimais(numero) {
    var with2Decimals = numero.toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]
    return parseFloat(with2Decimals);
}

function habilitarTodosCamposFormulario(formulario) {
	formulario = formulario || document.forms[0];
	for (componente = 0; componente < formulario.elements.length; componente++) {
		if (isComponenteValido(componente) && isComponentePassivelDeFoco(componente, formulario) && !isComponenteHabilitado(componente, formulario)) {
			formulario[componente].disabled = false;
		}
	}
}

function ajustarValorDecimal(type, value, exp) {
	if (typeof exp === 'undefined' || +exp === 0) {
		return Math[type](value);
	}
	value = +value;
	exp = +exp;
	if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
		return NaN;
	}
	value = value.toString().split('e');
	value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
	value = value.toString().split('e');
	return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
}

function definirAmbiente(tipoAmbiente){
	  let localizacao = window.location.href;
	  if(localizacao.includes('localhost')){
		  document.getElementById('tipoAmbiente').innerHTML = 'Ambiente Local';
		  document.getElementById('ambiente').style.display = '';
          document.getElementById('ambiente').style.backgroundColor = '#00c9d2';    
      }
	  else if (tipoAmbiente == 'CLONE'){
		  document.getElementById('tipoAmbiente').innerHTML = 'Ambiente Clone';
		  document.getElementById('ambiente').style.display = '';
          document.getElementById('ambiente').style.backgroundColor = '#c8c8a9';
      }
	  else if (tipoAmbiente == 'TESTE'){
		  document.getElementById('tipoAmbiente').innerHTML = 'Ambiente de Teste';
		  document.getElementById('ambiente').style.display = '';
          document.getElementById('ambiente').style.backgroundColor = 'red';
      }
}

// Função que permite apenas letras, números, caracteres especiais e espaços, mas não cedilha ou acentuação
function permitirLetrasNumerosCaracteres(campo) {
    var regex = /^[A-Za-z0-9 !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
    if (!regex.test(campo.value)) {
        alert('O campo contém caracteres inválidos! Não é permitido cedilha(ç) ou acentuação');
        campo.value = campo.value.replace(/[^A-Za-z0-9 !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '');
    }
}






function permitirSomenteLetras(campo) {
	if (campo.value.match(/[0-9]/g)) {
 		alert('O campo não pode ser numérico!')
		campo.value=campo.value.replace(/[0-9]/g,'');
	}
}

function permitirSomenteNumeros(campo) {
	if (campo.value.match(/\D/g)) {
		alert("O campo deve ser numérico!")
		campo.value = campo.value.replace(/\D/g,''); 
	}
}

// Remove todos os caracteres que não sejam letras (com ou sem acentos) e espaços.
function removeSpecialChars(str) {
    return str.replace(/[^a-zA-ZÀ-ü\s]/g, '');
}

function contadorDePalavras(string){
    var counter = 1;
    string=string.replace(/[\s]+/gim, ' ');
    string.replace(/(\s+)/g, function (a) {
       counter++;
    });
    return counter;
}

function validarNumeroInteiroMax(obj, valorMaximo, msg) {
    if (!obj || obj.value === "") return;

    // Substitui caracteres indesejados por "a" para poder validar somente números positivos
    obj.value = obj.value.replace(/[-\s.,]/g, "a");

    var numeroFormatado = parseFloat(obj.value);

    if (isNaN(numeroFormatado) || !Number.isInteger(numeroFormatado) || numeroFormatado > valorMaximo) {
        if (!msg || msg === "") {
            msg = "Por favor, insira um número inteiro válido que não ultrapasse o valor máximo de " + valorMaximo + ".";
        }
        obj.value = '';
        msgErr(obj,msg);
        return false;
    } else {
        obj.value = numeroFormatado;
    }
}


/**
 * Para o atributo "mensagens", ver a classe MensagemPersonalizada
 **/
function adicionarMensagensHtml(mensagens, idElementoMsgs) {
	if (idElementoMsgs && document.getElementById(idElementoMsgs)) {
		var msgs = '';
		msgs += '<div class="msgBox">';
		mensagens.forEach(function(mensagem) { 
		  msgs += '<div class="' + mensagem.classeCss + '">' + mensagem.descricao + '</div>'; 
		}); 
		msgs += '</div>';
		document.getElementById(idElementoMsgs).innerHTML = msgs;
	}
}

function downloadArquivoFromBase64String(base64String, nomeArquivo) {
	try {
        var byteCharacters = atob(base64String);
        var byteNumbers = new Array(byteCharacters.length);
        for (var i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        var byteArray = new Uint8Array(byteNumbers);

        // Cria um blob a partir do array de bytes
        var blob = new Blob([byteArray]);

        // Cria uma URL temporária para o blob
        var url = window.URL.createObjectURL(blob);

        // Cria um link para fazer o download
        var a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();

        // Limpa a URL temporária
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Erro ao decodificar a string base64:', e);
    }
}

function interromperRelatorioGerenciado(chaveRelatorio, idElementoMsg) {
	if (idElementoMsg && document.getElementById(idElementoMsg)) {
		document.getElementById(idElementoMsg).innerHTML = '';
	}
	
	var xhr = new XMLHttpRequest();
    xhr.open('GET', '/saw/InterromperRelatorioGerenciadoAjax.do?chave=' + chaveRelatorio, true);
	xhr.onreadystatechange = function() { 
	  if (xhr.readyState === XMLHttpRequest.DONE) { 
	    if (xhr.status === 200) { 
	      var responseJson = JSON.parse(xhr.responseText); 
	      adicionarMensagensHtml(responseJson.mensagens, idElementoMsg); 
	    } else { 
	      try { 
	        var responseJson = JSON.parse(xhr.responseText); 
	        if (responseJson && responseJson.mensagens) { 
	          adicionarMensagensHtml(responseJson.mensagens, idElementoMsg); 
	        } else { 
	          alert('Um erro ocorreu ao tentar interromper geração de arquivo.');
	        } 
	      } catch (error) { 
	        alert('Um erro ocorreu ao tentar interromper geração de arquivo.');
	      } 
	    } 
	  } 
	} 
	xhr.send(); 
}

function downloadRelatorioGerenciado(chaveRelatorio, idElementoMsg) {
	if (idElementoMsg && document.getElementById(idElementoMsg)) {
		document.getElementById(idElementoMsg).innerHTML = '';
	}
	
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/saw/DownloadRelatorioGerenciadoAjax.do?chave=' + chaveRelatorio, true);
	xhr.onreadystatechange = function() { 
	  if (xhr.readyState === XMLHttpRequest.DONE) { 
	    if (xhr.status === 200) { 
	      var responseJson = JSON.parse(xhr.responseText); 
	      downloadArquivoFromBase64String(responseJson.retorno.base64String, responseJson.retorno.nomeArquivo); 
	      adicionarMensagensHtml(responseJson.mensagens, idElementoMsg); 
	    } else { 
	      try { 
	        var responseJson = JSON.parse(xhr.responseText); 
	        if (responseJson && responseJson.mensagens) { 
	          adicionarMensagensHtml(responseJson.mensagens, idElementoMsg); 
	        } else { 
	          alert('Um erro ocorreu ao tentar realizar download de arquivo.');
	        } 
	      } catch (error) { 
	        alert('Um erro ocorreu ao tentar realizar download de arquivo.');
	      } 
	    } 
	  } 
	} 
	xhr.send(); 
}

function regerarRelatorioGerenciado(chaveRelatorio, idElementoMsg) {
	if (idElementoMsg && document.getElementById(idElementoMsg)) {
		document.getElementById(idElementoMsg).innerHTML = '';
	}
	
	var xhr = new XMLHttpRequest();
    xhr.open('GET', '/saw/RegerarRelatorioGerenciadoAjax.do?chave=' + chaveRelatorio, true);
	xhr.onreadystatechange = function() { 
	  if (xhr.readyState === XMLHttpRequest.DONE) { 
	    if (xhr.status === 200) { 
	      var responseJson = JSON.parse(xhr.responseText); 
	      adicionarMensagensHtml(responseJson.mensagens, idElementoMsg); 
	    } else { 
	      try { 
	        var responseJson = JSON.parse(xhr.responseText); 
	        if (responseJson && responseJson.mensagens) { 
	          adicionarMensagensHtml(responseJson.mensagens, idElementoMsg); 
	        } else { 
	          alert('Um erro ocorreu ao tentar gerar novo arquivo.');
	        } 
	      } catch (error) { 
	        alert('Um erro ocorreu ao tentar gerar novo arquivo.');
	      } 
	    } 
	  } 
	} 
	xhr.send();
}

function abrirModalSAW(id) {
	
	var body = document.querySelector("body");
    body.classList.add("saw-modal-open");
	
	var backdropElement = document.getElementById(id + '_backdrop');
    var modalElement = document.getElementById(id);

    // Adicione a classe 'show' para tornar os elementos visíveis
    backdropElement.classList.add('show');
    modalElement.classList.add('show');

    // Mantenha os elementos inicialmente ocultos com display: none
    backdropElement.style.display = 'block';
    modalElement.style.display = 'block';

	fadeIn(backdropElement, 0.2);
	fadeIn(modalElement, 1);
}

function fecharModalSAW(id) {
    var backdropElement = document.getElementById(id + '_backdrop');
    var modalElement = document.getElementById(id);

    fadeOut(backdropElement);
    fadeOut(modalElement);

    var body = document.querySelector("body");
    body.classList.remove("saw-modal-open");
}

function fadeIn(element, finalOpacity) {
  var op = 0.1;  // Initial opacity
  element.style.opacity = op;
  var timer = setInterval(function () {
    if (op >= (finalOpacity ? finalOpacity : 1)) {
      clearInterval(timer);
    }
    element.style.opacity = op;
    op += op * 0.1;
  }, 5);
}

function fadeOut(element) {
  var op = 1;  // Initial opacity
  var timer = setInterval(function () {
    if (op <= 0.1){
      clearInterval(timer);
      element.style.display = 'none';
    }
    element.style.opacity = op;
    op -= op * 0.1;
  }, 5); 
}

function contarCasasDecimais(numero) {
	if (typeof numero === 'number' || !isNaN(numero)) {
	    var numeroStr = numero.toString();
	    if (numeroStr.includes('.')) {
	        return numeroStr.split('.')[1].length;
	    } else {
	        return 0;
	    }
    }
}

function applyCpfMask(className) {
    const inputs = document.querySelectorAll(`.${className}`);
    
    function isValidCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
        
        let sum = 0, remainder;
        for (let i = 1; i <= 9; i++) sum += parseInt(cpf.charAt(i - 1)) * (11 - i);
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(9))) return false;
        
        sum = 0;
        for (let i = 1; i <= 10; i++) sum += parseInt(cpf.charAt(i - 1)) * (12 - i);
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        return remainder === parseInt(cpf.charAt(10));
    }
    
    inputs.forEach(input => {
        input.addEventListener('input', (event) => {
            let value = event.target.value.replace(/\D/g, ''); // Remove tudo que não for número
            
            if (value.length > 11) {
                value = value.substring(0, 11); // Limita a 11 dígitos
            }
            
            // Formata como CPF (###.###.###-##)
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            
            event.target.value = value;
        });
        
        input.addEventListener('blur', (event) => {
            let value = event.target.value.replace(/\D/g, '');
            if (value.length !== 11) {
                event.target.value = '';
            } else if (!isValidCPF(value)) {
				alert('CPF inválido!');
				event.target.value = '';
			}
        });
    });
}

function chkRadioSelected(nomeDoGrupo) {
    const radios = document.getElementsByName(nomeDoGrupo);
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            return true; 
        }
    }
    return false; 
}

function mascaraCEP(campo) {
	    campo.value = campo.value.replace(/\D/g, '');
	    if (campo.value.length > 5) {
	        campo.value = campo.value.replace(/^(\d{5})(\d)/, '$1-$2');
	    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyCpfMask('saw-mask-cpf');
});

  var tamanhoCNPJSemDV = 12;
  var regexCNPJSemDV = /^([A-Z\d]){12}$/;
  var regexCNPJ = /^([A-Z\d]){12}(\d){2}$/;
  var regexCaracteresMascara = /[./-]/g;
  var regexCaracteresNaoPermitidos = /[^A-Z\d./-]/i;
  var valorBase = "0".charCodeAt(0);
  var pesosDV = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var cnpjZerado = "00000000000000";

function isCnpjValido(cnpj){
    if (!this.regexCaracteresNaoPermitidos.test(cnpj)) {
      let cnpjSemMascara = this.removeMascaraCNPJ(cnpj);
      if (this.regexCNPJ.test(cnpjSemMascara) && cnpjSemMascara !== this.cnpjZerado) {
        const dvInformado = cnpjSemMascara.substring(this.tamanhoCNPJSemDV);
        const dvCalculado = this.calculaDV(cnpjSemMascara.substring(0, this.tamanhoCNPJSemDV));
        return dvInformado === dvCalculado;
      }
    }
    return false;
}

function CNPJdv(cnpj) {
	if (!this.regexCaracteresNaoPermitidos.test(cnpj)) {
		let cnpjSemMascara = this.removeMascaraCNPJ(cnpj);
		if (this.regexCNPJSemDV.test(cnpjSemMascara) && cnpjSemMascara !== this.cnpjZerado.substring(0, this.tamanhoCNPJSemDV)) {
			let somatorioDV1 = 0;
			let somatorioDV2 = 0;
			for (let i = 0; i < this.tamanhoCNPJSemDV; i++) {
				const asciiDigito = cnpjSemMascara.charCodeAt(i) - this.valorBase;
				somatorioDV1 += asciiDigito * this.pesosDV[i + 1];
				somatorioDV2 += asciiDigito * this.pesosDV[i];
        	}
			const dv1 = somatorioDV1 % 11 < 2 ? 0 : 11 - (somatorioDV1 % 11);
			somatorioDV2 += dv1 * this.pesosDV[this.tamanhoCNPJSemDV];
			const dv2 = somatorioDV2 % 11 < 2 ? 0 : 11 - (somatorioDV2 % 11);
			return `${dv1}${dv2}`;
		}
	}
}
  
  function calculaDV(cnpj) {
    if (!this.regexCaracteresNaoPermitidos.test(cnpj)) {
      let cnpjSemMascara = this.removeMascaraCNPJ(cnpj);
      if (this.regexCNPJSemDV.test(cnpjSemMascara) && cnpjSemMascara !== this.cnpjZerado.substring(0, this.tamanhoCNPJSemDV)) {
        let somatorioDV1 = 0;
        let somatorioDV2 = 0;
        for (let i = 0; i < this.tamanhoCNPJSemDV; i++) {
          const asciiDigito = cnpjSemMascara.charCodeAt(i) - this.valorBase;
          somatorioDV1 += asciiDigito * this.pesosDV[i + 1];
          somatorioDV2 += asciiDigito * this.pesosDV[i];
        }
        const dv1 = somatorioDV1 % 11 < 2 ? 0 : 11 - (somatorioDV1 % 11);
        somatorioDV2 += dv1 * this.pesosDV[this.tamanhoCNPJSemDV];
        const dv2 = somatorioDV2 % 11 < 2 ? 0 : 11 - (somatorioDV2 % 11);
        return `${dv1}${dv2}`;
      }
    }
    throw new Error("Não é possível calcular o DV pois o CNPJ fornecido é inválido");
  }
  
function removeMascaraCNPJ(cnpj) {
	return cnpj.replace(this.regexCaracteresMascara, "");
}

function limparMascaraCpfCnpj (campo) {
    campo.value = campo.value.replace(/[.\-\/]/g, "");
}

function calculaDiferencaDiasEntreDatas(dataInicio, dataFim) {
   var date1 = dataInicio.value.split('/');
   var newDate1 = date1[1] + '/' + date1[0] + '/' + date1[2];
   var date = new Date(newDate1);
   var date2 = dataFim.value.split('/');
   var newDate2 = date2[1] + '/' + date2[0] + '/' + date2[2];
   var date2 = new Date(newDate2);
   var diferencaDias = calculaDiferencaDias(date, date2);
   return parseInt(diferencaDias);
}

function calculaDiferencaDias(data1, data2) {
   data1 = new Date(data1);
   data2 = new Date(data2);
   return (data2 - data1) / (1000 * 3600 * 24);
}


