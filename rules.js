const Rules = {
  // Conectar
  CONECTAR: "conectar",
  // Login e Logoff
  USUARIO_LOGIN: "usuario_login",
  USUARIO_LOGOUT: "usuario_logout",
  // CRUD do usuário
  USUARIO_CRIAR: "usuario_criar",
  USUARIO_LER: "usuario_ler",
  USUARIO_ATUALIZAR: "usuario_atualizar",
  USUARIO_DELETAR: "usuario_deletar",
  // CR(UD) da transação
  TRANSACAO_CRIAR: "transacao_criar",
  TRANSACAO_LER: "transacao_ler",
  DEPOSITAR: "depositar",
  // Erro no servidor
  ERRO_SERVIDOR: "erro_servidor",

  /**
   * Busca a chave do enum correspondente ao valor da String.
   * Este método é case-insensitive.
   * @param {string} rule A string da regra a ser procurada (ex: "usuario_login").
   * @returns {string} A chave correspondente no objeto Rules.
   * @throws {Error} se nenhuma constante for encontrada para a string fornecida.
   */
  getEnumKey: function(rule) {
    if (rule === null || rule === undefined) {
      throw new Error("O valor da regra não pode ser nulo.");
    }
    const upperRule = rule.toUpperCase();
    for (const key in this) {
      if (typeof this[key] === 'string' && this[key].toUpperCase() === upperRule) {
        return key;
      }
    }
    // It's more idiomatic in JS to check the value directly
    const ruleValues = Object.values(this);
    for(const value of ruleValues) {
        if(typeof value === 'string' && value.toLowerCase() === rule.toLowerCase()) {
            return Object.keys(this).find(key => this[key] === value);
        }
    }

    throw new Error(`Nenhuma regra encontrada para o valor: ${rule}`);
  },

  /**
   * Verifica se uma regra existe.
   * @param {string} rule - A regra a ser verificada.
   * @returns {boolean}
   */
  has: function(rule) {
    try {
      this.getEnumKey(rule);
      return true;
    } catch (e) {
      return false;
    }
  }
};

// Freeze o objeto para torná-lo imutável, semelhante a um enum.
Object.freeze(Rules);

module.exports = Rules;
