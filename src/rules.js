/**
 * @enum {string}
 * @description Defines the allowed operations for the protocol.
 * This is the JavaScript equivalent of the RulesEnum.java file.
 */
const Rules = Object.freeze({
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

  /**
   * Gets the enum key for a given string value.
   * @param {string} value The string value to look for (e.g., "usuario_login").
   * @returns {string | undefined} The corresponding enum key (e.g., "USUARIO_LOGIN").
   */
  getKeyFromValue(value) {
    return Object.keys(this).find(key => this[key] === value);
  }
});

module.exports = Rules;
