# Configuração do Painel de Admin

## Pré-requisitos

### Banco de Dados SQLite

Esta aplicação usa **SQLite**, então não é necessário configurar um servidor de banco de dados. O banco é um arquivo local (`database.db`) que será criado automaticamente.

## Passos para Configurar

### 1. Executar Migration do Prisma

Primeiro, você precisa criar e aplicar a migration para criar o banco de dados e as tabelas:

```bash
npx prisma migrate dev --name init_sqlite
```

Isso irá:
- Criar o arquivo `database.db` na raiz do projeto
- Criar todas as tabelas necessárias (User, TestHistory, TestStepResult, RAWhitelist)
- Adicionar o campo `is_admin` ao modelo `User`

### 2. Executar Seed para Migrar RAs Existentes

Execute o script de seed para adicionar os RAs iniciais à whitelist:

```bash
npm run seed
```

Ou:

```bash
npx prisma db seed
```

Isso irá:
- Adicionar os RAs existentes (`a1234567`, `a2345678`, `a3456789`, `a2317974`) à tabela `RAWhitelist`
- Tentar configurar o RA especificado em `INITIAL_ADMIN_RA` (ou `a2317974` por padrão) como admin

### 3. Criar Usuário Admin Inicial

**Opção A: Via Registro e Promoção Manual (Recomendado)**

1. Registre o usuário admin normalmente através da interface web (`/register`)
   - Use um dos RAs que estão na whitelist (ex: `a2317974`)
2. Promova o usuário a admin usando uma das opções abaixo

**Opção B: Via Prisma Studio**

1. Abra o Prisma Studio:
   ```bash
   npx prisma studio
   ```
2. Navegue até a tabela `User`
3. Encontre o usuário que você registrou
4. Edite o campo `is_admin` para `true`
5. Salve

**Opção C: Via SQL Direto**

Se você tem uma ferramenta SQLite instalada (ex: DB Browser for SQLite):

```sql
UPDATE User SET is_admin = 1 WHERE ra = 'a2317974';
```

**Opção D: Via Seed Script**

O seed script tentará marcar o usuário como admin, mas você ainda precisa registrar o usuário primeiro. O script apenas atualiza o campo `is_admin` se o usuário já existir.

### 4. Acessar o Painel de Admin

1. Faça login com o usuário admin
2. No Dashboard, você verá um botão "Admin Panel"
3. Clique para acessar `/admin`

## Funcionalidades do Painel de Admin

### Gerenciar Whitelist de RAs
- **Adicionar RA**: Use o formulário para adicionar novos RAs à whitelist
- **Remover RA**: Clique no botão "Remove" ao lado de cada RA
- **Visualizar**: Veja todos os RAs na whitelist com data de criação

### Gerenciar Usuários
- **Listar Usuários**: Veja todos os usuários registrados
- **Promover a Admin**: Clique em "Promote to Admin" para dar privilégios de admin
- **Rebaixar Admin**: Clique em "Demote" para remover privilégios de admin

## Segurança

- Apenas usuários com `is_admin = true` podem acessar o painel
- Admins não podem se auto-rebaixar
- Não é possível remover o último admin do sistema
- Todas as ações são protegidas por autenticação JWT

## Notas

- O campo `is_admin` é incluído no payload do JWT após o login
- O frontend verifica o status de admin do JWT para mostrar/ocultar o botão Admin Panel
- A whitelist agora está completamente no banco de dados SQLite, não mais em `config.ts`
- O banco de dados é portátil - apenas copie o arquivo `database.db` para fazer backup

## Backup do Banco de Dados

Para fazer backup, simplesmente copie o arquivo `database.db`:

```bash
# Windows
copy database.db database.backup.db

# Linux/Mac
cp database.db database.backup.db
```

Para restaurar, substitua `database.db` pelo arquivo de backup.
