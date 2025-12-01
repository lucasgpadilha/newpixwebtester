# Quick Start - NewPix Web Tester

## Início Rápido (5 minutos)

### 1. Instalar Dependências

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Criar Banco de Dados

```bash
npx prisma migrate dev --name init_sqlite
```

Isso criará o arquivo `database.db` automaticamente.

### 3. Popular Dados Iniciais

```bash
npm run seed
```

Isso adicionará os RAs iniciais à whitelist.

### 4. Criar Usuário Admin

1. Inicie o servidor:
   ```bash
   npm run dev
   ```

2. Em outro terminal, inicie o frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Acesse `http://localhost:5173` (ou a porta que o Vite mostrar)

4. Registre um usuário com RA `a2317974` (ou outro da whitelist)

5. Promova a admin:
   ```bash
   npx prisma studio
   ```
   - Navegue até `User`
   - Edite o usuário criado
   - Marque `is_admin` como `true`
   - Salve

### 5. Pronto!

Agora você pode:
- Fazer login e acessar o Dashboard
- Ver o botão "Admin Panel" (se for admin)
- Gerenciar whitelist de RAs
- Executar testes de servidor e cliente

## Comandos Úteis

```bash
# Ver dados no banco
npx prisma studio

# Recriar banco do zero
rm database.db
npx prisma migrate dev

# Fazer backup
copy database.db database.backup.db
```

## Estrutura do Banco

O banco SQLite está em `database.db` na raiz do projeto. É um arquivo único e portátil - você pode copiá-lo para fazer backup ou mover para outro computador.





