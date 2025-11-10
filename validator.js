const Rules = require('./rules');

// --- DEFINIÇÃO DAS CHAVES ESPERADAS ---

const EXPECTED_CLIENT_KEYS = {
    [Rules.CONECTAR]: ['operacao'],
    [Rules.USUARIO_LOGIN]: ['operacao', 'cpf', 'senha'],
    [Rules.USUARIO_CRIAR]: ['operacao', 'nome', 'cpf', 'senha'],
    [Rules.USUARIO_LER]: ['operacao', 'token'],
    [Rules.USUARIO_ATUALIZAR]: ['operacao', 'token', 'usuario'],
    [Rules.USUARIO_DELETAR]: ['operacao', 'token'],
    [Rules.USUARIO_LOGOUT]: ['operacao', 'token'],
    [Rules.TRANSACAO_CRIAR]: ['operacao', 'token', 'valor', 'cpf_destino'],
    [Rules.TRANSACAO_LER]: ['operacao', 'token', 'data_inicial', 'data_final'],
    [Rules.DEPOSITAR]: ['operacao', 'token', 'valor_enviado'],
    [Rules.ERRO_SERVIDOR]: ['operacao', 'operacao_enviada', 'info'],
};

const serverBaseKeys = ['operacao', 'status', 'info'];
const EXPECTED_SERVER_KEYS = {
    [Rules.USUARIO_LOGIN]: [...serverBaseKeys, 'token'],
    [Rules.USUARIO_LER]: [...serverBaseKeys, 'usuario'],
    [Rules.TRANSACAO_LER]: [...serverBaseKeys, 'transacoes'],
};

// Para as demais operações, a resposta (sucesso ou falha) só contém as chaves base.
for (const rule of Object.values(Rules)) {
    if (typeof rule === 'string') {
        if (!EXPECTED_CLIENT_KEYS[rule]) {
            EXPECTED_CLIENT_KEYS[rule] = [];
        }
        if (!EXPECTED_SERVER_KEYS[rule]) {
            EXPECTED_SERVER_KEYS[rule] = serverBaseKeys;
        }
    }
}

Object.freeze(EXPECTED_CLIENT_KEYS);
Object.freeze(EXPECTED_SERVER_KEYS);


/**
 * Valida uma mensagem JSON enviada do Cliente para o Servidor.
 * @param {string} jsonString A mensagem JSON como uma String.
 * @throws {Error} se o JSON for inválido ou não seguir o protocolo.
 */
function validateClient(jsonString) {
    const rootNode = parseJson(jsonString);

    const operacaoNode = getRequiredField(rootNode, 'operacao');
    validateStringLength(rootNode, 'operacao', 3, 200);

    const operacao = operacaoNode;
    if (!Rules.has(operacao)) {
        throw new Error(`Operação do cliente desconhecida ou não suportada: ${operacao}`);
    }
    
    checkExtraKeys(rootNode, operacao, EXPECTED_CLIENT_KEYS);

    switch (operacao) {
        case Rules.CONECTAR:
            break;
        case Rules.USUARIO_LOGIN:
            validateUsuarioLoginClient(rootNode);
            break;
        case Rules.USUARIO_LOGOUT:
            validateUsuarioLogoutClient(rootNode);
            break;
        case Rules.USUARIO_CRIAR:
            validateUsuarioCriarClient(rootNode);
            break;
        case Rules.USUARIO_LER:
            validateUsuarioLerClient(rootNode);
            break;
        case Rules.USUARIO_ATUALIZAR:
            validateUsuarioAtualizarClient(rootNode);
            break;
        case Rules.USUARIO_DELETAR:
            validateUsuarioDeletarClient(rootNode);
            break;
        case Rules.TRANSACAO_CRIAR:
            validateTransacaoCriarClient(rootNode);
            break;
        case Rules.TRANSACAO_LER:
            validateTransacaoLerClient(rootNode);
            break;
        case Rules.DEPOSITAR:
            validateDepositarClient(rootNode);
            break;
        case Rules.ERRO_SERVIDOR:
            validateErroServidorClient(rootNode);
            break;
        default:
            throw new Error(`Operação do cliente desconhecida ou não suportada: ${operacao}`);
    }
}

/**
 * Valida uma mensagem JSON enviada do Servidor para o Cliente.
 * @param {string} jsonString A mensagem JSON como uma String.
 * @throws {Error} se o JSON for inválido ou não seguir o protocolo.
 */
function validateServer(jsonString) {
    const rootNode = parseJson(jsonString);

    const operacaoNode = getRequiredField(rootNode, 'operacao');
    validateStringLength(rootNode, 'operacao', 3, 200);

    const statusNode = getRequiredField(rootNode, 'status');
    if (typeof statusNode !== 'boolean') {
        throw new Error("O campo 'status' na resposta do servidor deve ser um booleano (true/false).");
    }

    validateStringLength(rootNode, 'info', 3, 200);

    const operacao = operacaoNode;
    if (!Rules.has(operacao)) {
        throw new Error(`Operação do servidor desconhecida ou não suportada: ${operacao}`);
    }

    let expectedKeysForThisResponse;
    if (statusNode) { // status: true
        expectedKeysForThisResponse = EXPECTED_SERVER_KEYS[operacao];
        if (!expectedKeysForThisResponse) {
            throw new Error(`Definição de chaves não encontrada para operação de sucesso: ${operacao}`);
        }
    } else { // status: false
        expectedKeysForThisResponse = ['operacao', 'status', 'info'];
    }

    checkExtraKeys(rootNode, operacao, { [operacao]: expectedKeysForThisResponse });

    if (statusNode) {
        switch (operacao) {
            case Rules.USUARIO_LOGIN:
                validateUsuarioLoginServer(rootNode);
                break;
            case Rules.USUARIO_LER:
                validateUsuarioLerServer(rootNode);
                break;
            case Rules.TRANSACAO_LER:
                validateTransacaoLerServer(rootNode);
                break;
            default:
                break;
        }
    }
}


// ===================================================================================
// MÉTODOS DE VALIDAÇÃO PRIVADOS (CLIENTE -> SERVIDOR)
// ===================================================================================

function validateUsuarioLoginClient(node) {
    validateCpfFormat(node, "cpf");
    validateStringLength(node, "senha", 6, 120);
}

function validateUsuarioLogoutClient(node) {
    validateStringLength(node, "token", 3, 200);
}

function validateUsuarioCriarClient(node) {
    validateStringLength(node, "nome", 6, 120);
    validateCpfFormat(node, "cpf");
    validateStringLength(node, "senha", 6, 120);
}

function validateUsuarioLerClient(node) {
    validateStringLength(node, "token", 3, 200);
}

function validateUsuarioAtualizarClient(node) {
    validateStringLength(node, "token", 3, 200);
    const usuarioNode = getRequiredObject(node, "usuario");
    
    if (!usuarioNode.hasOwnProperty("nome") && !usuarioNode.hasOwnProperty("senha")) {
        throw new Error("O objeto 'usuario' para atualização deve conter pelo menos o campo 'nome' ou 'senha'.");
    }
    if (usuarioNode.hasOwnProperty("nome")){
        validateStringLength(usuarioNode, "nome", 6, 120);
    }
    if (usuarioNode.hasOwnProperty("senha")){
        validateStringLength(usuarioNode, "senha", 6, 120);
    }
}

function validateUsuarioDeletarClient(node) {
    validateStringLength(node, "token", 3, 200);
}

function validateTransacaoCriarClient(node) {
    validateStringLength(node, "token", 3, 200);
    validateCpfFormat(node, "cpf_destino");
    getRequiredNumber(node, "valor");
}

function validateTransacaoLerClient(node) {
    validateStringLength(node, "token", 3, 200);
    validateDateFormat(node, "data_inicial"); 
    validateDateFormat(node, "data_final");   
}

function validateDepositarClient(node) {
    validateStringLength(node, "token", 3, 200);
    getRequiredNumber(node, "valor_enviado");
}

function validateErroServidorClient(node) {
    getRequiredField(node, "operacao");
    getRequiredField(node, "operacao_enviada");
    getRequiredField(node, "info");
}

// ===================================================================================
// MÉTODOS DE VALIDAÇÃO PRIVADOS (SERVIDOR -> CLIENTE)
// ===================================================================================

function validateUsuarioLoginServer(node) {
    validateStringLength(node, "token", 3, 200);
}

function validateUsuarioLerServer(node) {
    const usuarioNode = getRequiredObject(node, "usuario");
    validateCpfFormat(usuarioNode, "cpf");
    validateStringLength(usuarioNode, "nome", 6, 120);
    getRequiredNumber(usuarioNode, "saldo");
    if (usuarioNode.hasOwnProperty("senha")) {
        throw new Error("A resposta do servidor para 'usuario_ler' não deve conter o campo 'senha'.");
    }
}

function validateTransacaoLerServer(node) {
    const transacoesNode = getRequiredArray(node, "transacoes");
    for (const transacao of transacoesNode) {
        getRequiredInt(transacao, "id");
        getRequiredNumber(transacao, "valor_enviado");
        
        const enviadorNode = getRequiredObject(transacao, "usuario_enviador");
        validateStringLength(enviadorNode, "nome", 6, 120);
        validateCpfFormat(enviadorNode, "cpf");
        
        const recebedorNode = getRequiredObject(transacao, "usuario_recebedor");
        validateStringLength(recebedorNode, "nome", 6, 120);
        validateCpfFormat(recebedorNode, "cpf");

        validateDateFormat(transacao, "criado_em");
        validateDateFormat(transacao, "atualizado_em");
    }
}


// ===================================================================================
// MÉTODOS AUXILIARES (HELPERS)
// ===================================================================================

function parseJson(jsonString) {
    if (jsonString === null || jsonString.trim() === '') {
        throw new Error("A mensagem JSON não pode ser nula ou vazia.");
    }
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        throw new Error("Erro de sintaxe. A mensagem não é um JSON válido.", e);
    }
}

function getRequiredField(parentNode, fieldName) {
    if (parentNode.hasOwnProperty(fieldName) && parentNode[fieldName] !== null) {
        return parentNode[fieldName];
    }
    throw new Error(`O campo obrigatório '${fieldName}' não foi encontrado ou é nulo.`);
}

function validateStringLength(parentNode, fieldName, minLength, maxLength) {
    const field = getRequiredField(parentNode, fieldName);
    if (typeof field !== 'string') {
        throw new Error(`O campo '${fieldName}' deve ser do tipo String.`);
    }
    
    const value = field.trim();
    
    if (value.length < minLength) {
        throw new Error(`O campo '${fieldName}' deve ter no mínimo ${minLength} caracteres.`);
    }
    if (value.length > maxLength) {
        throw new Error(`O campo '${fieldName}' deve ter no máximo ${maxLength} caracteres.`);
    }
}

function validateCpfFormat(parentNode, fieldName) {
    const field = getRequiredField(parentNode, fieldName);
    if (typeof field !== 'string') {
        throw new Error(`O campo '${fieldName}' deve ser do tipo String.`);
    }
    const cpf = field;
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    if (!cpfRegex.test(cpf)) {
        throw new Error(`O campo '${fieldName}' deve estar no formato '000.000.000-00'.`);
    }
}

function validateDateFormat(parentNode, fieldName) {
    const field = getRequiredField(parentNode, fieldName);
    if (typeof field !== 'string') {
        throw new Error(`O campo '${fieldName}' deve ser do tipo String.`);
    }
    const date = field;
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    if (!isoRegex.test(date)) {
        throw new Error(`O campo '${fieldName}' deve estar no formato ISO 8601 UTC 'yyyy-MM-dd'T'HH:mm:ss'Z'.`);
    }
}

function getRequiredNumber(parentNode, fieldName) {
    const field = getRequiredField(parentNode, fieldName);
    if (typeof field !== 'number') {
        throw new Error(`O campo '${fieldName}' deve ser do tipo numérico.`);
    }
}

function getRequiredInt(parentNode, fieldName) {
    const field = getRequiredField(parentNode, fieldName);
    if (!Number.isInteger(field)) {
        throw new Error(`O campo '${fieldName}' deve ser do tipo int.`);
    }
}

function getRequiredObject(parentNode, fieldName) {
    const field = getRequiredField(parentNode, fieldName);
    if (typeof field !== 'object' || field === null || Array.isArray(field)) {
        throw new Error(`O campo '${fieldName}' deve ser um objeto JSON.`);
    }
    return field;
}

function getRequiredArray(parentNode, fieldName) {
    const field = getRequiredField(parentNode, fieldName);
    if (!Array.isArray(field)) {
        throw new Error(`O campo '${fieldName}' deve ser um array JSON.`);
    }
    return field;
}

function checkExtraKeys(node, operacao, expectedKeysMap) {
    const expected = expectedKeysMap[operacao];
    if (!expected) {
        throw new Error(`Definição de chaves esperadas não encontrada para a operação: ${operacao}`);
    }
    
    const actualKeys = Object.keys(node);
    for (const key of actualKeys) {
        if (!expected.includes(key)) {
            throw new Error(`Chave inesperada '${key}' encontrada para a operação '${operacao}'.`);
        }
    }
}

module.exports = {
    validateClient,
    validateServer,
};
