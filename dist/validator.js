"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validateClient = validateClient;
exports.validateServer = validateServer;
const rules_1 = __importStar(require("./rules"));
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
// --- KEY DEFINITIONS ---
const EXPECTED_CLIENT_KEYS = {
    [rules_1.default.CONECTAR]: new Set(['operacao']),
    [rules_1.default.USUARIO_LOGIN]: new Set(['operacao', 'cpf', 'senha']),
    [rules_1.default.USUARIO_CRIAR]: new Set(['operacao', 'nome', 'cpf', 'senha']),
    [rules_1.default.USUARIO_LER]: new Set(['operacao', 'token']),
    [rules_1.default.USUARIO_ATUALIZAR]: new Set(['operacao', 'token', 'usuario']),
    [rules_1.default.USUARIO_DELETAR]: new Set(['operacao', 'token']),
    [rules_1.default.USUARIO_LOGOUT]: new Set(['operacao', 'token']),
    [rules_1.default.TRANSACAO_CRIAR]: new Set(['operacao', 'token', 'valor', 'cpf_destino']),
    [rules_1.default.TRANSACAO_LER]: new Set(['operacao', 'token', 'data_inicial', 'data_final']),
    [rules_1.default.DEPOSITAR]: new Set(['operacao', 'token', 'valor_enviado']),
    [rules_1.default.ERRO_SERVIDOR]: new Set(['operacao', 'operacao_enviada', 'info']),
};
const serverBaseKeys = new Set(['operacao', 'status', 'info']);
const EXPECTED_SERVER_KEYS = {
    [rules_1.default.USUARIO_LOGIN]: new Set(['operacao', 'status', 'info', 'token']),
    [rules_1.default.USUARIO_LER]: new Set(['operacao', 'status', 'info', 'usuario']),
    [rules_1.default.TRANSACAO_LER]: new Set(['operacao', 'status', 'info', 'transacoes']),
};
// Create a set of all valid rule values for quick lookup
const validRuleValues = new Set(Object.values(rules_1.default));
// --- HELPER FUNCTIONS ---
function _parseJson(jsonString) {
    if (jsonString == null || jsonString.trim() === '') {
        throw new ValidationError('A mensagem JSON não pode ser nula ou vazia.');
    }
    try {
        return JSON.parse(jsonString);
    }
    catch (e) {
        throw new ValidationError('Erro de sintaxe. A mensagem não é um JSON válido.');
    }
}
function _getRequiredField(parentNode, fieldName) {
    if (Object.prototype.hasOwnProperty.call(parentNode, fieldName) && parentNode[fieldName] !== null) {
        return parentNode[fieldName];
    }
    throw new ValidationError(`O campo obrigatório '${fieldName}' não foi encontrado ou é nulo.`);
}
function _validateStringLength(parentNode, fieldName, minLength, maxLength) {
    const value = _getRequiredField(parentNode, fieldName);
    if (typeof value !== 'string') {
        throw new ValidationError(`O campo '${fieldName}' deve ser do tipo String.`);
    }
    const trimmedValue = value.trim();
    if (trimmedValue.length < minLength) {
        throw new ValidationError(`O campo '${fieldName}' deve ter no mínimo ${minLength} caracteres.`);
    }
    if (trimmedValue.length > maxLength) {
        throw new ValidationError(`O campo '${fieldName}' deve ter no máximo ${maxLength} caracteres.`);
    }
}
function _validateCpfFormat(parentNode, fieldName) {
    const cpf = _getRequiredField(parentNode, fieldName);
    if (typeof cpf !== 'string') {
        throw new ValidationError(`O campo '${fieldName}' deve ser do tipo String.`);
    }
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    if (!cpfRegex.test(cpf)) {
        throw new ValidationError(`O campo '${fieldName}' deve estar no formato '000.000.000-00'.`);
    }
}
function _validateDateFormat(parentNode, fieldName) {
    const date = _getRequiredField(parentNode, fieldName);
    if (typeof date !== 'string') {
        throw new ValidationError(`O campo '${fieldName}' deve ser do tipo String.`);
    }
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    if (!isoRegex.test(date)) {
        throw new ValidationError(`O campo '${fieldName}' deve estar no formato ISO 8601 UTC 'yyyy-MM-dd'T'HH:mm:ss'Z'.`);
    }
}
function _getRequiredNumber(parentNode, fieldName) {
    const value = _getRequiredField(parentNode, fieldName);
    if (typeof value !== 'number') {
        throw new ValidationError(`O campo '${fieldName}' deve ser do tipo numérico.`);
    }
}
function _getRequiredInt(parentNode, fieldName) {
    const value = _getRequiredField(parentNode, fieldName);
    if (!Number.isInteger(value)) {
        throw new ValidationError(`O campo '${fieldName}' deve ser do tipo int.`);
    }
}
function _getRequiredObject(parentNode, fieldName) {
    const value = _getRequiredField(parentNode, fieldName);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ValidationError(`O campo '${fieldName}' deve ser um objeto JSON (ex: { ... }).`);
    }
    return value;
}
function _getRequiredArray(parentNode, fieldName) {
    const value = _getRequiredField(parentNode, fieldName);
    if (!Array.isArray(value)) {
        throw new ValidationError(`O campo '${fieldName}' deve ser um array JSON (ex: [ ... ]).`);
    }
    return value;
}
function _checkExtraKeys(node, operacao, expectedKeysMap) {
    const expected = expectedKeysMap[operacao];
    if (!expected) {
        // This can happen for rules that don't have specific client keys, default to empty set
        for (const key in node) {
            if (key !== 'operacao') {
                throw new ValidationError(`Chave inesperada '${key}' encontrada para a operação '${operacao}'.`);
            }
        }
        return;
    }
    for (const key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
            if (!expected.has(key)) {
                throw new ValidationError(`Chave inesperada '${key}' encontrada para a operação '${operacao}'.`);
            }
        }
    }
}
// --- CLIENT -> SERVER VALIDATION LOGIC ---
function _validateUsuarioLoginClient(node) { _validateCpfFormat(node, 'cpf'); _validateStringLength(node, 'senha', 6, 120); }
function _validateUsuarioLogoutClient(node) { _validateStringLength(node, 'token', 3, 200); }
function _validateUsuarioCriarClient(node) { _validateStringLength(node, 'nome', 6, 120); _validateCpfFormat(node, 'cpf'); _validateStringLength(node, 'senha', 6, 120); }
function _validateUsuarioLerClient(node) { _validateStringLength(node, 'token', 3, 200); }
function _validateUsuarioDeletarClient(node) { _validateStringLength(node, 'token', 3, 200); }
function _validateTransacaoCriarClient(node) { _validateStringLength(node, 'token', 3, 200); _validateCpfFormat(node, 'cpf_destino'); _getRequiredNumber(node, 'valor'); }
function _validateTransacaoLerClient(node) { _validateStringLength(node, 'token', 3, 200); _validateDateFormat(node, 'data_inicial'); _validateDateFormat(node, 'data_final'); }
function _validateDepositarClient(node) { _validateStringLength(node, 'token', 3, 200); _getRequiredNumber(node, 'valor_enviado'); }
function _validateErroServidorClient(node) { _getRequiredField(node, 'operacao'); _getRequiredField(node, 'operacao_enviada'); _getRequiredField(node, 'info'); }
function _validateUsuarioAtualizarClient(node) {
    _validateStringLength(node, 'token', 3, 200);
    const usuarioNode = _getRequiredObject(node, 'usuario');
    if (!usuarioNode.hasOwnProperty('nome') && !usuarioNode.hasOwnProperty('senha')) {
        throw new ValidationError("O objeto 'usuario' para atualização deve conter pelo menos o campo 'nome' ou 'senha'.");
    }
    if (usuarioNode.hasOwnProperty('nome')) {
        _validateStringLength(usuarioNode, 'nome', 6, 120);
    }
    if (usuarioNode.hasOwnProperty('senha')) {
        _validateStringLength(usuarioNode, 'senha', 6, 120);
    }
}
// --- SERVER -> CLIENT VALIDATION LOGIC ---
function _validateUsuarioLoginServer(node) { _validateStringLength(node, 'token', 3, 200); }
function _validateUsuarioLerServer(node) {
    const usuarioNode = _getRequiredObject(node, 'usuario');
    _validateCpfFormat(usuarioNode, 'cpf');
    _validateStringLength(usuarioNode, 'nome', 6, 120);
    _getRequiredNumber(usuarioNode, 'saldo');
    if (usuarioNode.hasOwnProperty('senha')) {
        throw new ValidationError("A resposta do servidor para 'usuario_ler' não deve conter o campo 'senha'.");
    }
}
function _validateTransacaoLerServer(node) {
    const transacoesNode = _getRequiredArray(node, 'transacoes');
    for (const transacao of transacoesNode) {
        _getRequiredInt(transacao, 'id');
        _getRequiredNumber(transacao, 'valor_enviado');
        const enviadorNode = _getRequiredObject(transacao, 'usuario_enviador');
        _validateStringLength(enviadorNode, 'nome', 6, 120);
        _validateCpfFormat(enviadorNode, 'cpf');
        const recebedorNode = _getRequiredObject(transacao, 'usuario_recebedor');
        _validateStringLength(recebedorNode, 'nome', 6, 120);
        _validateCpfFormat(recebedorNode, 'cpf');
        _validateDateFormat(transacao, 'criado_em');
        _validateDateFormat(transacao, 'atualizado_em');
    }
}
// --- PUBLIC API ---
function validateClient(jsonString) {
    const rootNode = _parseJson(jsonString);
    const operacaoString = _getRequiredField(rootNode, 'operacao');
    _validateStringLength(rootNode, 'operacao', 3, 200);
    let operacao;
    try {
        operacao = (0, rules_1.getEnum)(operacaoString);
    }
    catch (e) {
        throw new ValidationError(`Operação do cliente desconhecida ou não suportada: ${operacaoString}`);
    }
    _checkExtraKeys(rootNode, operacao, EXPECTED_CLIENT_KEYS);
    switch (operacao) {
        case rules_1.default.CONECTAR: break;
        case rules_1.default.USUARIO_LOGIN:
            _validateUsuarioLoginClient(rootNode);
            break;
        case rules_1.default.USUARIO_LOGOUT:
            _validateUsuarioLogoutClient(rootNode);
            break;
        case rules_1.default.USUARIO_CRIAR:
            _validateUsuarioCriarClient(rootNode);
            break;
        case rules_1.default.USUARIO_LER:
            _validateUsuarioLerClient(rootNode);
            break;
        case rules_1.default.USUARIO_ATUALIZAR:
            _validateUsuarioAtualizarClient(rootNode);
            break;
        case rules_1.default.USUARIO_DELETAR:
            _validateUsuarioDeletarClient(rootNode);
            break;
        case rules_1.default.TRANSACAO_CRIAR:
            _validateTransacaoCriarClient(rootNode);
            break;
        case rules_1.default.TRANSACAO_LER:
            _validateTransacaoLerClient(rootNode);
            break;
        case rules_1.default.DEPOSITAR:
            _validateDepositarClient(rootNode);
            break;
        case rules_1.default.ERRO_SERVIDOR:
            _validateErroServidorClient(rootNode);
            break;
        default: throw new ValidationError(`Operação do cliente desconhecida ou não suportada: ${operacao}`);
    }
}
function validateServer(jsonString) {
    const rootNode = _parseJson(jsonString);
    const operacaoString = _getRequiredField(rootNode, 'operacao');
    _validateStringLength(rootNode, 'operacao', 3, 200);
    const status = _getRequiredField(rootNode, 'status');
    if (typeof status !== 'boolean') {
        throw new ValidationError("O campo 'status' na resposta do servidor deve ser um booleano (true/false).");
    }
    _validateStringLength(rootNode, 'info', 3, 200);
    let operacao;
    try {
        operacao = (0, rules_1.getEnum)(operacaoString);
    }
    catch (e) {
        throw new ValidationError(`Operação do servidor desconhecida ou não suportada: ${operacaoString}`);
    }
    let expectedKeysForThisResponse;
    if (status === true) {
        expectedKeysForThisResponse = EXPECTED_SERVER_KEYS[operacao] ?? serverBaseKeys;
    }
    else {
        expectedKeysForThisResponse = serverBaseKeys;
    }
    const tempExpectedMap = { [operacao]: expectedKeysForThisResponse };
    _checkExtraKeys(rootNode, operacao, tempExpectedMap);
    if (status === true) {
        switch (operacao) {
            case rules_1.default.USUARIO_LOGIN:
                _validateUsuarioLoginServer(rootNode);
                break;
            case rules_1.default.USUARIO_LER:
                _validateUsuarioLerServer(rootNode);
                break;
            case rules_1.default.TRANSACAO_LER:
                _validateTransacaoLerServer(rootNode);
                break;
            default: break;
        }
    }
}
//# sourceMappingURL=validator.js.map