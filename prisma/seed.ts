import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Migrate RAs from legacy config to database
  const legacyRAs = [
    'a1234567',
    'a2345678',
    'a3456789',
    'a2317974',
  ];

  for (const ra of legacyRAs) {
    try {
      await prisma.rAWhitelist.upsert({
        where: { ra },
        update: {},
        create: {
          ra,
          created_by: 'system',
        },
      });
      console.log(`✓ Added RA ${ra} to whitelist`);
    } catch (error) {
      console.log(`✗ Failed to add RA ${ra}:`, error);
    }
  }

  // Create initial admin user (if not exists)
  // You can change this RA to your desired admin RA
  const adminRA = process.env.INITIAL_ADMIN_RA || 'a2317974';

  try {
    const adminUser = await prisma.user.upsert({
      where: { ra: adminRA },
      update: {
        is_admin: true, // Ensure admin status
      },
      create: {
        ra: adminRA,
        password_hash: '$2b$10$placeholder', // This should be set via registration first
        is_admin: true,
      },
    });
    console.log(`✓ Admin user ${adminRA} configured`);
    console.log('⚠️  NOTE: Admin user must register first to set password');
  } catch (error) {
    console.log(`✗ Failed to configure admin user:`, error);
  }

  // Seed Test Steps for CLIENT tests
  console.log('Seeding CLIENT test steps...');
  const clientSteps = [
    { step_key: 'connect', step_name: '1. Conectar', operation: 'conectar', step_order: 1, weight: 0, is_auto_evaluated: true, requires_user_input: false, prompt_title: 'Passo 1: conectar', prompt_hint: 'Envie {"operacao":"conectar"}' },
    { step_key: 'register', step_name: '2. Criar usuário', operation: 'usuario_criar', step_order: 2, weight: 0, is_auto_evaluated: true, requires_user_input: false, prompt_title: 'Passo 2: cadastro', prompt_hint: 'Envie {"operacao":"usuario_criar","cpf":"123.123.123-01","senha":"senhaSegura","nome":"Nome Teste"}' },
    { step_key: 'login', step_name: '3. Fazer login', operation: 'usuario_login', step_order: 3, weight: 0, is_auto_evaluated: true, requires_user_input: false, prompt_title: 'Passo 3: login', prompt_hint: 'Envie {"operacao":"usuario_login","cpf":"123.123.123-01","senha":"senhaSegura"}' },
    { step_key: 'deposit', step_name: '4. Depositar', operation: 'depositar', step_order: 4, weight: 0, is_auto_evaluated: true, requires_user_input: false, prompt_title: 'Passo 4: deposito', prompt_hint: 'Envie {"operacao":"depositar","token":"<seu_token>","valor_enviado":1000}' },
    { step_key: 'read_statement', step_name: '5. Ler extrato', operation: 'transacao_ler', step_order: 5, weight: 0.4, is_auto_evaluated: true, requires_user_input: true, prompt_title: 'Passo 5: extrato', prompt_hint: 'Envie {"operacao":"transacao_ler","token":"<seu_token>","data_inicial":"2025-10-01T00:00:00Z","data_final":"2025-12-31T23:59:59Z"}' },
    { step_key: 'pix_transfer', step_name: '6. Enviar PIX', operation: 'transacao_criar', step_order: 6, weight: 0.4, is_auto_evaluated: true, requires_user_input: false, prompt_title: 'Passo 6: transferência PIX', prompt_hint: 'Envie {"operacao":"transacao_criar","token":"<seu_token>","cpf_destino":"999.999.999-99","valor":100}' },
    { step_key: 'error_login_test', step_name: '7. Teste erro login', operation: 'usuario_login', step_order: 7, weight: 0.4, is_auto_evaluated: true, requires_user_input: true, prompt_title: 'Passo 7: teste de erro no login', prompt_hint: 'Envie {"operacao":"usuario_login","cpf":"errado","senha":"errada"}. Seu cliente deve exibir mensagem de erro.' },
    { step_key: 'error_register_test', step_name: '8. Teste erro cadastro', operation: 'usuario_criar', step_order: 8, weight: 0.4, is_auto_evaluated: true, requires_user_input: true, prompt_title: 'Passo 8: teste de erro no cadastro', prompt_hint: 'Tente criar usuário já existente. Seu cliente deve exibir mensagem de erro.' },
  ];

  for (const step of clientSteps) {
    try {
      await prisma.testStep.upsert({
        where: { test_type_step_key: { test_type: 'CLIENT', step_key: step.step_key } },
        update: step,
        create: { test_type: 'CLIENT', ...step },
      });
      console.log(`✓ Seeded CLIENT step: ${step.step_name}`);
    } catch (error) {
      console.log(`✗ Failed to seed CLIENT step ${step.step_key}:`, error);
    }
  }

  console.log('Database seed completed!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





