"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnum = getEnum;
const Rules = {
    // Connect
    CONECTAR: 'conectar',
    // Login and Logout
    USUARIO_LOGIN: 'usuario_login',
    USUARIO_LOGOUT: 'usuario_logout',
    // User CRUD
    USUARIO_CRIAR: 'usuario_criar',
    USUARIO_LER: 'usuario_ler',
    USUARIO_ATUALIZAR: 'usuario_atualizar',
    USUARIO_DELETAR: 'usuario_deletar',
    // Transaction CR(UD)
    TRANSACAO_CRIAR: 'transacao_criar',
    TRANSACAO_LER: 'transacao_ler',
    DEPOSITAR: 'depositar',
    // Server Error
    ERRO_SERVIDOR: 'erro_servidor',
};
/**
 * Busca a constante do Rules correspondente ao valor da String.
 * Este método é case-insensitive (ignora maiúsculas e minúsculas).
 *
 * @param rule A string da regra a ser procurada (ex: "usuario_login").
 * @return A string Rule correspondente.
 * @throws Error se nenhuma constante for encontrada para a string fornecida.
 */
function getEnum(rule) {
    if (rule == null) {
        throw new Error('O valor da regra não pode ser nulo.');
    }
    const ruleLower = rule.toLowerCase();
    for (const key in Rules) {
        if (Object.prototype.hasOwnProperty.call(Rules, key)) {
            const value = Rules[key];
            if (value.toLowerCase() === ruleLower) {
                return value;
            }
        }
    }
    throw new Error(`Nenhuma regra encontrada para o valor: ${rule}`);
}
// We export the object itself for runtime use
exports.default = Rules;
//# sourceMappingURL=rules.js.map