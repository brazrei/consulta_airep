let globalTipoMsg = false
let globalDataIni = false
let arrayCSV
const listaMeses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

document.addEventListener('DOMContentLoaded', function () {
    inicio();
});

function extrairMesesSelecionados() {
    // Array para armazenar os meses selecionados (1 = Janeiro, 2 = Fevereiro, etc.)
    const mesesSelecionados = [];

    // Lista de meses em ordem, correspondendo a seus números

    // Iterar sobre os checkboxes para verificar quais estão selecionados
    listaMeses.forEach((mes, index) => {
        const checkbox = document.getElementById(mes);
        if (checkbox && checkbox.checked) {
            // Adicionar o número do mês ao array de meses selecionados
            mesesSelecionados.push(index + 1); // +1 porque os meses são baseados em 1
        }
    });

    return mesesSelecionados;
}

function inicio() {
    document.getElementById("dataInicial").value = '2024-03-01'
    document.getElementById("dataFinal").value = '2024-03-02'
}

function calcularUmidadeRelativa(temperatura, pontoOrvalho) {
    // Função para calcular a pressão de vapor usando a fórmula de Tetens
    function calcularPressaoVapor(temp) {
        return 6.11 * Math.pow(10, (7.5 * temp) / (237.3 + temp));
    }
    if (temperatura == null || pontoOrvalho == null)
        return null

    // Calcular a pressão de vapor para a temperatura do ar
    const eT = calcularPressaoVapor(temperatura);

    // Calcular a pressão de vapor para o ponto de orvalho
    const eTd = calcularPressaoVapor(pontoOrvalho);

    // Calcular a umidade relativa
    const umidadeRelativa = (eTd / eT) * 100;

    return umidadeRelativa;
}

function extrairFenomenosMETAR(metar) {
    // Lista de códigos de fenômenos meteorológicos comuns
    const codigosFenomenos = [
        "MI", "BC", "PR", "DR", "BL", "SH", "TS", "FZ", "VC",
        "DZ", "RA", "SN", "SG", "PL", "GR", "GS",
        "BR", "FG", "FU", "VA", "DU", "SA", "HZ",
        "PO", "FC", "SS", "DS", "SQ"
    ];

    if (!metar.includes("="))
        return null

    metar = metar.split("=")[0]
    metar = metar.replaceAll(" OVC", " ").replaceAll(" RERA", " ").replaceAll(" BKN", " ").replaceAll(" SCT", " ").replaceAll(" FEW", " ").replaceAll(" VV", " ")


    // Expressão regular que busca por códigos de fenômenos, precedidos e seguidos por espaço
    const regex = new RegExp(`([+-]?(${codigosFenomenos.join("|")}))`, "g");

    // Executar a expressão regular na mensagem METAR
    const matches = metar.match(regex);

    // Retornar todos os fenômenos encontrados como uma string, separados por vírgula
    return matches ? matches.join(" | ") : null;
}

function extrairVisibilidadeMetar(metar) {
    const regexVisibilidade = /(?<= )\d{4}(?= )/;              // Ex: "9999"
    if (metar.includes("CAVOK"))
        return "9999"

    let vis = metar.match(regexVisibilidade) ? parseInt(metar.match(regexVisibilidade)[0], 10) : null;
    return vis
}

function extrairDadosMETAR(metar) {
    function removerFim(metar) {
        // Usando expressão regular para capturar tudo até o altímetro (Q ou A seguido de 4 dígitos)
        const pattern = /^(.*?)(?:Q\d{4}|A\d{4})/;
        const match = metar.match(pattern);

        // Retorna a parte do METAR até o ajuste do altímetro, ou o METAR original se não houver correspondência
        return match ? match[0] + "=" : metar;
    }
    function removerInicio(metar) {
        // Expressão regular para encontrar o ICAO e remover tudo até o ICAO
        const regex = /\b[A-Z]{4}\b.*$/;

        // Executa a expressão regular para encontrar o ICAO e o restante da mensagem
        const match = metar.match(regex);

        // Se encontrar o ICAO, retorna apenas a parte do ICAO em diante
        if (match) {
            metar = match[0].split(" ")
            metar.shift()
            return metar.join(" ");
        } else {
            // Se não encontrar, retorna a mensagem original
            return metar;
        }
    }
    function metarComTrovoada(fenomenos) {
        if (typeof fenomenos !== 'string') {
            return null;
        }
        if (fenomenos.includes('TS') || fenomenos.includes('SQ'))
            return "SIM"
        else
            return null
    }
    function verificaFenomenoMetar(arrayFenomenos, fenomenosMetar) {
        let achou = false
        if (typeof fenomenosMetar !== 'string') {
            return null;
        }

        arrayFenomenos.map((fenomeno) => {
            if (fenomenosMetar.includes(fenomeno))
                achou = true
        })
        if (achou)
            return "SIM"
        else
            return null

    }

    function metarComPrecipitacao(fenomenos) {
        return verificaFenomenoMetar(["DZ", "RA", "SN", "SG", "PL", "GR", "GS"], fenomenos)
    }

    function metarComObscurecedor(fenomenos) {
        return verificaFenomenoMetar(["BR", "FG", "FU", "VA", "DU", "SA", "HZ"], fenomenos)
    }

    function identificarIntensidadeFenomeno(fenomenos) {
        // Verificar se a variável 'fenomeno' é nula ou indefinida ou não é uma string
        if (typeof fenomenos !== 'string') {
            return null;
        }
        // Verificar se a string contém o sinal de +
        if (fenomenos.indexOf("+") !== -1) {
            return "+";
        }
        // Verificar se a string contém o sinal de -
        else if (fenomenos.indexOf("-") !== -1) {
            return "-";
        }
        // Se não houver + ou -, retornar null
        else {
            return null;
        }
    }
    if (typeof metar !== 'string') {
        return null;
    }

    // Expressões regulares para cada componente
    const regexVento = /(\d{3}|VRB)(\d{2})(G\d{2})?KT/; // Ex: "35010KT", "VRB05KT", "35010G20KT"
    const regexVentoVariavel = /(\d{3})V(\d{3})/;       // Ex: "180V240"
    const regexTemperatura = /(?<=\s)M?(\d{2})\/M?(\d{2})(?=\s)/;
    const regexNebulosidade = /(VV|BKN|OVC)(\d{3})/;    // Apenas VV, BKN, ou OVC

    //remover informações que podem atrapalhar na obtenção dos dados relevantes
    metar = removerInicio(metar)
    metar = removerFim(metar)

    // Extrai vento e rajadas usando regex
    const ventoMatch = metar.match(regexVento);
    const ventoVariavelMatch = metar.match(regexVentoVariavel);

    let direcaoVento = null;
    let velocidadeVento = null;
    let rajada = null;
    let direcaoVariavel = null;


    if (ventoMatch) {
        direcaoVento = ventoMatch[1];   // Captura direção do vento
        velocidadeVento = ventoMatch[2]; // Captura velocidade do vento
        rajada = ventoMatch[3] ? ventoMatch[3].substring(1) : null; // Captura rajada se presente, removendo o 'G'
    }

    if (ventoVariavelMatch) {
        direcaoVariavel = `${ventoVariavelMatch[1]}V${ventoVariavelMatch[2]}`; // Captura direção variável
    }

    // Extrai visibilidade, mas apenas se estiver abaixo de 5000 metros
    let visibilidade = extrairVisibilidadeMetar(metar)

    // Extrair temperatura e ponto de orvalho
    let temperatura = null;
    let pontoOrvalho = null;
    let fenomenos = extrairFenomenosMETAR(metar);
    let trovoada = metarComTrovoada(fenomenos)
    let precipitacao = metarComPrecipitacao(fenomenos)
    let obscurecedor = metarComObscurecedor(fenomenos)

    let intensidade = identificarIntensidadeFenomeno(fenomenos)

    const matchTemp = metar.match(regexTemperatura);
    if (matchTemp) {
        const temperaturaNegativa = metar.includes(`M${matchTemp[1]}/`);
        const pontoOrvalhoNegativo = metar.includes(`M${matchTemp[2]} `);

        temperatura = parseInt(matchTemp[1], 10) * (temperaturaNegativa ? -1 : 1);
        pontoOrvalho = parseInt(matchTemp[2], 10) * (pontoOrvalhoNegativo ? -1 : 1);
        if (pontoOrvalho > temperatura) {
            pontoOrvalho = null
            temperatura = null
        }
    }

    //calcular umidade relativa
    try {
        ur = calcularUmidadeRelativa(temperatura, pontoOrvalho)
        if (ur !== null)
            ur = Math.round(ur)
    } catch {
        ur = null
    }

    if (ur > 100)
        ur = null

    // Extrai nebulosidade apenas se for VV, BKN, ou OVC e altura ≤ 015 (1500 pés)
    let nebulosidade = null;
    let qtdNebulosidade = null;
    let alturaNebulosidade = null;
    const nebulosidadeMatch = metar.match(regexNebulosidade);
    if (nebulosidadeMatch) {
        if (alturaNebulosidade <= 15) {
            qtdNebulosidade = nebulosidadeMatch[1];
            alturaNebulosidade = parseInt(nebulosidadeMatch[2], 10);
            nebulosidade = `${qtdNebulosidade}${alturaNebulosidade.toString().padStart(3, '0')}`;
        }
    }

    // Retorna um array com os valores
    return [direcaoVento, velocidadeVento, rajada, direcaoVariavel, visibilidade, fenomenos, trovoada, precipitacao, obscurecedor, intensidade, temperatura, pontoOrvalho, ur, nebulosidade, qtdNebulosidade, alturaNebulosidade > 0 ? alturaNebulosidade * 100 : null];
}

function criarArquivoCSV(dadosArray, filename) {
    // Define os cabeçalhos do CSV
    const cabecalho = ["ICAO", "tipo", "data_hora", "mes", "hora", "METAR", "direcao_vento", "velocidade_vento", "rajada", "direcao_variavel", "visibilidade", "fenomenos", "trovoada", "precipitacao", "obscurecedor", "intensidade", "temperatura", "ponto_de_orvalho", "UR", "nebulosidade", "qtd_nuvens", "altura_nuvens"];

    // Concatena o cabeçalho com os dados, separados por ";"
    const linhas = [cabecalho.join(";")];

    // Adiciona cada linha de dados ao CSV
    dadosArray.forEach(dados => {
        linhas.push(dados.join(";"));
    });

    // Cria o conteúdo do CSV como uma string
    const csvContent = linhas.join("\n");

    // Cria um blob a partir da string CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Cria um link para download
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';

    // Adiciona o link ao documento e clica nele para iniciar o download
    document.body.appendChild(link);
    link.click();

    // Remove o link do documento
    document.body.removeChild(link);
}

function converteData(dataString) {
    let partes = dataString.split("-"); // Divide a string em partes
    let dia = (partes[2]);      // Extrai o dia
    let mes = (partes[1]);  // Extrai o mês (subtrai 1 porque os meses em JavaScript são indexados a partir de 0)
    let ano = (partes[0]);      // Extrai o ano
    let saida = `${ano}${mes}${dia}`
    //let dataObj = new Date(ano, mes, dia); // Cria o objeto Date    return data.replaceAll("-","")
    return saida
}

function checkMes(data, mesesSelecionados) {
    const mes = new Date(data).getMonth() + 1;
    return (mesesSelecionados.includes(mes))
}

function getTipo(mensagem) {

    if (typeof mensagem !== 'string') {
        return null;
    }

    if (mensagem.indexOf('SPECI') > -1)
        return "SPECI"
    else
        return "METAR"
}

function converterDataParaDMA(data, sep = "-") {
    d = data.split(sep)
    if (Array.isArray(d) && d.length == 3)
        return `${d[2]}-${d[1]}-${d[0]}`
}

function exportarCSV(consulta) {
    //adiciona no arrayCSV os metares filtrados
    let arrayCSV = []
    let filtrados

    //remove mensagens que nao sao dos meses selecionados
    let resposta = consulta.getResposta()
    if (consulta.options.mesesSelecionados)
        filtrados = resposta.filter(element => checkMes(element.validade_inicial, consulta.options.mesesSelecionados));

    filtrados.map((mens) => (
        //    arrayCSV.push([getTipo(mens.mens), mens.validade_inicial, listaMeses[(new Date(mens.validade_inicial)).getMonth()], (new Date(mens.validade_inicial)).getHours(), mens.mens].concat(extrairDadosAIREP(mens.mens)))
        arrayCSV.push([getTipo(mens.mens), mens.mens])
    ))

    //cria o arquivo CSV
    criarArquivoCSV(arrayCSV, `dados_meteorlogicos_${consulta.localidade}_${converterDataParaDMA(consulta.dataInicial)}_${converterDataParaDMA(consulta.dataFinal)}.csv`)
}

function trataResposta(consulta) {

    let msgs = ""
    let cont = 0
    let contAMD = 0
    let contCOR = 0
    let contWS = 0
    let txtWS = ""
    arrayResposta = consulta.getResposta()
    tipo = consulta.tipo
    options = consulta.options

    /*
        if (options.criarCSV) {
            //adiciona no arrayCSV os metares filtrados
            let arrayCSV = []
            let filtrados
            let tipo = getTipo()
            //remove mensagens que nao sao dos meses selecionados
            if (options.mesesSelecionados)
                filtrados = arrayResposta.filter(element => checkMes(element.validade_inicial, options.mesesSelecionados));
    
            filtrados.map((mens) => (
                arrayCSV.push([mens.id_localidade, getTipo(mens.mens), mens.validade_inicial, listaMeses[(new Date(mens.validade_inicial)).getMonth()], (new Date(mens.validade_inicial)).getHours(), mens.mens].concat(extrairDadosMETAR(mens.mens)))
            ))
    
            //cria o arquivo CSV
            criarCSV(arrayCSV,`dados_meteorlogicos_${consulta.dataInicial}_`)
        }
    */
    //tipo = tipo == "AVISO" ? "VALID" : tipo
    //arrayResposta = [...new Set(arrayResposta)];//remove dados repetidos

    /*arrayResposta = arrayResposta.filter((value, index, self) =>
        index === self.findIndex((t) => (
            t.mens === value.mens
        ))
    )*/
    arrayResposta = arrayResposta.map(i => i.mens)
    arrayResposta = [...new Set(arrayResposta)];//remove dados repetidos

    arrayResposta.forEach(m => {
        if (typeof myVariable === 'undefined') {
            return
        }
        msgs += m + "<br>"
        if (m.includes(tipo + " AMD "))
            contAMD++
        if (m.includes(tipo + " WS WRNG "))
            contWS++
        if (m.includes(" COR "))
            contCOR++
        //if (m.mens.replace("SPECI", "METAR").includes("METAR"))
        cont++
    });

    if (!$("#exibirMensagens").is(':checked'))
        msgs = ""
    else
        msgs += '<br>'
    if (contWS > 0)
        txtWS = `<br>Total de Mensagens CORTANTE DE VENTO: ${contWS}`
    tipo = tipo == "AVISO_AERODROMO" ? "AVISO" : tipo
    tipo = tipo == "AVISO_CORTANTE_VENTO" ? "AVISOWS" : tipo
    txtTipo = (tipo == "METAR") ? "METAR / SPECI" : tipo
    txtTipo = (tipo == "AVISO") ? "AVISO DE AERODROMO" : txtTipo
    txtTipo = (tipo == "AVISOWS") ? "AVISO DE CORTANTE DE VENTO" : txtTipo

    if (document.getElementById("resposta" + tipo))
        document.getElementById("resposta" + tipo).innerHTML = msgs + `Total de Mensagens ${txtTipo}: ${cont}`
            + `<br>Total de Mensagens ${txtTipo} AMD: ${contAMD}`
            + `<br>Total de Mensagens ${txtTipo} COR: ${contCOR}`
            + `<br>${txtWS}<br><br>`

    //let saida = `tipo\tMês Ref.\tAMD\tCOR\tTOTAL\n${txtTipo}\t${globalMesRef}\t${contAMD}\t${contCOR}\t${cont}`

    if (globalTipoMsg && (globalTipoMsg == tipo))
        $('body').text(saida)


    //saveToFile(txtTipo + "_" + globalMesRef, saida)
    return arrayResposta
}

async function consultar(api = 1, tipoMsg = false, localidades = false) {
    $.LoadingOverlay("show");

    if (globalDataIni) {
        data_ini = globalDataIni
        data_fin = globalDataFin
    } else {
        data_ini = document.getElementById("dataInicial").value
        data_fin = document.getElementById("dataFinal").value
    }

    if (!localidades)
        localidades = document.getElementById("localidades").value.replace(/ /g, '')

    if (!tipoMsg)
        tipoMsg = document.getElementById('tipoMsg').value.toUpperCase()
    else
        tipoMsg = tipoMsg.toUpperCase()

    let consulta, apiKey
    if (document.getElementById("apiKey"))
        apiKey = document.getElementById("apiKey").value

    if (tipoMsg == "METAR")
        consulta = new METAR(apiKey)

    else if (tipoMsg == "TAF")
        consulta = new TAF(apiKey)

    else if (tipoMsg == "GAMET")
        consulta = new GAMET(apiKey)

    else if (tipoMsg == "SIGMET")
        consulta = new SIGMET(apiKey)

    else if (tipoMsg == "AIRMET")
        consulta = new AIRMET(apiKey)

    else if (tipoMsg == "AIREP")
        consulta = new AIREP(apiKey)

    else if (tipoMsg == "AVISOAD")
        if (api == 1)
            consulta = new AVISO(apiKey, "AVISO")
        else
            consulta = new AVISO(apiKey, "AVISO_AERODROMO")

    else if (tipoMsg == "AVISOWS")
        if (api == 1)
            consulta = new AVISO(apiKey, "AVISO")
        else
            consulta = new AVISO(apiKey, "AVISO_CORTANTE_VENTO")


    if (api == 2)
        consulta.getOpmet(trataResposta, localidades, data_ini, data_fin)
    else {
        await consulta.getRedemet(localidades, data_ini, data_fin, { mesesSelecionados: extrairMesesSelecionados() })
        trataResposta(consulta)
        exportarCSV(consulta)
    }
    $.LoadingOverlay("hide");

    /*
    let taf = new TAF()
    taf.get(trataResposta, localidades, data_ini, data_fin)

    /*
    let sigmet = new SIGMET()
    sigmet.get(trataResposta, "", data_ini+"00", data_fin+"59")
    
    let airmet = new AIRMET()
    airmet.get(trataResposta, "", data_ini+"00", data_fin+"59")
    */
}

function consultaProdutividade(api = 2, tipo) {
    //if (tipo == "AVISO")   
    consultar(api, "AIREP");

    /*  consultar(api, "avisows", "SBGL,SBEG,SBPA,SBRE,SBGR,SBBR");
      consultar(api, "sigmet", "SBAZ,SBBS,SBRE,SBAO,SBCW");
      consultar(api, "airmet", "SBAZ,SBBS,SBRE,SBAO,SBCW");
      consultar(api, "taf", "SBPA,SBPK,SBCO,SBSM,SBBG,SBNM,SBUG,SBPF,SBCX,SWKQ,SBCT,SBFI,SBBI,SBYS,SBAF,SBSC,SBGW,SBAN,SBPG,SNCP,SBFL,SBNF,SBJV,SBCH,SBJA,SBMN,SBCC,SBGP,SBUF,SBLJ");
      consultar(api, "gamet", "SBAZ,SBBS,SBRE,SBAO,SBCW");
      */
}

function saveToFile(tipoMsg, texto) {
    // let texto = "Teste de mensagem"
    let filename = tipoMsg + '.csv'

    $.ajax({
        url: 'savefile.php',
        data: {
            'texto': texto,
            'filename': filename
        },

        type: 'POST'
    }).done(
        function (data) {
            console.log(data)
        }
    );

    /*
        fetch("savefile.php", {
            method: "POST",
            body: updateRequest,
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        })
            .then((response) => response.json())
            .then((json) => console.log(json));
    
    */

}