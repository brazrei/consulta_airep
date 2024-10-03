class API {
    // Propriedades da classe
    tipoMsg = null;      // Tipo de mensagem (ex: METAR, TAF)
    options = null;      // Opções de configuração
    arrResposta = null;  // Array para armazenar respostas
    apiKey = null;       // Chave de API para autenticação
    proxy = 'true';      // Indica se deve usar proxy (por padrão, 'true')

    constructor(tipo, key) {
        // Inicializa propriedades no construtor
        this.apiKey = key;  // Define a chave de API
        this.tipoMsg = tipo; // Define o tipo de mensagem
        this.options = { criarCSV: false, mesesSelecionados: false }; // Configurações padrão
    }

    // Método para definir opções
    setOptions(options) {
        this.options = options;
    }

    setLocalidade(localidade) {
        if (typeof localidade == "string")
            this.localidade = localidade.toUpperCase();
        else
            this.localidade = null
    }
    converterDataParaDMA(data, sep = "-") {
        d = data.split(sep)
        if (isArray(d) && d.length == 3)
            return `${d[2]}-${d[1]}-${d[0]}`
    }

    setDataInicial(data) {
        this.dataInicial = data;
    }
    setDataFinal(data) {
        this.dataFinal = data;
    }

    // Método para obter opções atuais
    getOptions() {
        return this.options;
    }

    getDataInicial() {
        return this.dataInicial;
    }

    getDataFinal() {
        return this.dataFinal;
    }

    getLocalidade() {
        return this.localidade;
    }

    // Método para converter uma string de data (YYYYMMDD) em um objeto Date
    getDate(date) {
        let ano = date.substr(0, 4);      // Extrai o ano
        let mes = date.substr(4, 2) - 1;  // Extrai o mês (subtrai 1 para alinhar com o índice do mês em JS)
        let dia = date.substr(6, 2);      // Extrai o dia
        return new Date(ano, mes, dia);   // Retorna um objeto Date
    }

    // Método para obter o valor do proxy
    getProxy() {
        return this.proxy;
    }

    // Método para incrementar um dia na data fornecida
    incDay(date) {
        return date.setDate(date.getDate() + 1); // Incrementa um dia e retorna a nova data
    }

    // Método para adicionar zero à esquerda para números menores que 10
    fillZero(n) {
        return parseInt(n) < 10 ? "0" + n : "" + n; // Converte número para string com zero à esquerda
    }

    // Método para converter um objeto Date em uma string formatada (YYYYMMDD)
    dateToStr(d) {
        return d.getFullYear() + this.fillZero(d.getMonth() + 1) + this.fillZero(d.getDate());
    }

    // Converte um intervalo de datas em um array de URLs para consulta
    intervalToArray(di, df, urlData) {
        function makeArrayDiDf(di, df, arr) {
            let arrUrl = [];
            let idi, idf;
            arr.forEach((e, idx) => {
                if (idx == 0) {
                    idi = di;               // Define data inicial
                    idf = arr[1] + "00";    // Define data final
                } else {
                    idi = e + "00";
                    if (idx < arr.length - 1)
                        idf = arr[idx + 1] + "00";
                    else
                        idf = df;
                }
                arrUrl.push({ di: idi, df: idf }); // Adiciona ao array de URLs
            });
            return arrUrl;
        }

        function makeArrayUrl(arrDias, urlData) {
            let r = [];
            arrDias.forEach(e => {
                r.push(`/WebServiceOPMET/getMetarOPMET.php?local=${urlData.localidade}&msg=${urlData.tipoMsg}&data_ini=${e.di}&data_fim=${e.df}&proxy=${urlData.proxy}`);
            });
            return r; // Retorna o array de URLs geradas
        }

        let r = [];
        let xdf = df;
        df = this.getDate(df); // Converte string de data final em objeto Date
        let next = this.getDate(di); // Converte string de data inicial em objeto Date
        r.push(this.dateToStr(new Date(next))); // Adiciona a data formatada ao array
        next = new Date(this.incDay(next)); // Incrementa um dia

        // Loop para adicionar todas as datas do intervalo ao array
        while (next <= df) {
            r.push(this.dateToStr(new Date(next)));
            next = new Date(this.incDay(next));
        }
        if (r.length == 1)
            r.push(this.dateToStr(new Date(df)));

        // Gera array de URLs usando as datas do intervalo
        return makeArrayUrl(makeArrayDiDf(di, xdf, r), urlData);
    }

    // Método para obter a chave de API
    getApiKey() {
        return this.apiKey;
    }

    // Método principal para buscar dados OPMET
    getOpmet(callBack, localidade, datai, dataf) {
        async function getPages(arrDias, pg, callBack, arr, obj) {
            // Loop para percorrer as páginas de dados
            for (let i = pg; i <= arrDias.length; i++) {
                const response = await fetch(arrDias[i]); // Faz a chamada para cada URL
                let data = await response.text();
                let r = data.split("="); // Divide a resposta em partes
                r = r.splice(0, r.length - 1); // Remove o último elemento
                r.map((mens) => (
                    arr = arr.concat([{ mens: mens.replace('\n', '') + "=" }]) // Adiciona mensagens ao array
                ));
                if (data.includes("*#*Erro na consulta")) // Se encontrar erro, decrementa o índice
                    i--;
            }
            obj.arrResposta.concat(arr); // Copia o array
            callBack(arr, obj.tipoMsg, obj.options); // Chama o callback com os dados
        }

        function getUrlPage(arrDias, pg) {
            return arrDias[pg]; // Retorna a URL correspondente à página atual
        }

        let dataIni = datai, dataFim = dataf;
        let resp = [];
        let arrDias = this.intervalToArray(datai, dataf, { localidade, tipoMsg: this.tipoMsg.toLowerCase(), proxy: this.getProxy() });
        let numPages = arrDias.length;
        let paginaAtual = 0;

        let urlBase = getUrlPage(arrDias, paginaAtual); // Obtém a URL da página inicial
        fetch(urlBase)
            .then((response) => {
                if (response.ok)
                    return response.text(); // Converte a resposta para texto
            })
            .then(response => {
                this.arrResposta = [];
                let r = response.split("=");
                r = r.splice(0, r.length - 1);
                r.map((mens) => (
                    resp = resp.concat([{ mens: mens.replace('\n', '') + "=" }])
                ));

                if (numPages > 1) {
                    paginaAtual++;
                    getPages(arrDias, paginaAtual, callBack, resp, this); // Chama a função para processar páginas adicionais
                }
                else {
                    this.arrResposta.concat(resp);
                    callBack(resp, this.tipoMsg, this.options); // Chama o callback se apenas uma página de resultados
                }
            });
    }

    // Gera URLs base para chamada de dados meteorológicos
    gerarUrlsBase(tipoMsg, localidade, apiKey, dataIni, dataFim) {
        let urls = [];
        let urlBase = `https://api-redemet.decea.mil.br/mensagens/${tipoMsg.toLowerCase()}/${localidade}?api_key=${apiKey}`;

        let startDate = new Date(dataIni); // Converte data inicial para objeto Date
        let endDate = new Date(dataFim);   // Converte data final para objeto Date

        // Divide o intervalo de datas em segmentos de até 6 meses
        while (startDate < endDate) {
            let endSegment = new Date(startDate);
            endSegment.setMonth(endSegment.getMonth() + 6); // Incrementa 6 meses

            if (endSegment > endDate) { // Ajusta o segmento final se passar do intervalo
                endSegment = endDate;
            }

            let dataIniFormatted = startDate.toISOString().slice(0, 10).replace(/-/g, '');
            let dataFimFormatted = endSegment.toISOString().slice(0, 10).replace(/-/g, '');

            let url = `${urlBase}&data_ini=${dataIniFormatted}00&data_fim=${dataFimFormatted}23`;
            urls.push(url);

            startDate = new Date(endSegment); // Move para o próximo segmento
            startDate.setDate(startDate.getDate() + 1);
        }

        return urls; // Retorna array de URLs
    }

    // Faz chamada para URLs e processa os resultados
    async fetchDataFromUrls(arrayUrlsBase) {
        this.arrResposta = [];

        for (let urlBase of arrayUrlsBase) {
            const response = await fetch(urlBase);
            if (!response.ok)
                throw new Error(`Erro na consulta: ${response.statusText}`);

            const responseData = await response.json();

            if (!responseData.status) {
                alert("Erro na Consulta de Mensagens! " + responseData.message);
                return;
            }

            let resp = [];

            responseData.data.data.map((mens) => (
                resp = resp.concat([mens]) // Adiciona mensagens ao array de resposta
            ));

            if (responseData.data.last_page > 1) {
                let urlPages = this.getUrlPages(responseData.data.next_page_url);
                await this.getPages(urlBase + urlPages, responseData.data.last_page, resp); // Faz chamadas adicionais para páginas extras
            } else {
                this.arrResposta = this.arrResposta.concat(resp); // Armazena respostas
            }
        }
    }

    // Faz chamadas para múltiplas páginas e concatena os resultados
    async getPages(url, lastPage, arg) {
        for (let i = 2; i <= lastPage; i++) {
            const response = await fetch(url + i);
            let { data, total_pages } = await response.json();
            data.data.forEach(mens => arg = arg.concat([mens])); // Adiciona dados ao array
        }
        this.arrResposta = this.arrResposta.concat(arg); // Atualiza array de resposta
    }

    // Extrai parte relevante da URL para gerenciar a paginação
    getUrlPages(url) {
        return url.split("page=")[0] + "page=";
    }

    // Método principal para obter dados meteorológicos usando a API Redemet
    async getRedemet(localidade, datai, dataf, options) {
        this.setOptions(options); // Define as opções

        this.setDataInicial(datai)
        this.setDataFinal(dataf)
        this.setLocalidade(localidade)

        let arrayUrlsBase = this.gerarUrlsBase(this.tipoMsg.toLowerCase(), localidade, this.getApiKey(), datai, dataf);
        await this.fetchDataFromUrls(arrayUrlsBase); // Faz a chamada para URLs base
        return
    }

    // Retorna o array de respostas ou false se não for um array
    getResposta() {
        return Array.isArray(this.arrResposta) ? this.arrResposta : false;
    }

    // Retorna o tamanho de um array
    arraySize(arr) {
        return arr.length;
    }
}

// Classe METAR que herda de API
class METAR extends API {
    //Variáveis privadas
    #localidade
    #dataInicial
    #dataFinal

    constructor(apiKey) {
        super("METAR", apiKey); // Chama o construtor da classe base
    }

    // Extrai o indicativo de localidade (ICAO) de uma mensagem METAR
    getLocalidade(metar) {
        const parts = metar.split(" "); // Divide a mensagem em partes

        let idx = 1; // Índice padrão para o ICAO
        const modifiers = ["COR", "AMD", "AUTO", "RTD"]; // Modificadores possíveis

        if (modifiers.includes(parts[1])) {
            idx = 2; // Ajusta o índice se um modificador estiver presente
        }

        return parts[idx]; // Retorna o indicativo ICAO
    }
}

// Classe AIREP que herda de API
class AIREP extends API {
    //Variáveis privadas
    #localidade
    #dataInicial
    #dataFinal

    constructor(apiKey) {
        super("AIREP", apiKey); // Chama o construtor da classe base
    }

    
 }

// Classes SIGMET, AIRMET, TAF, GAMET, AVISO herdando de API podem ser definidas de maneira semelhante...
