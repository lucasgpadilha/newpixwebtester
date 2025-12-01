import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const [, , raArg, newPasswordArg] = process.argv;

  if (!raArg || !newPasswordArg) {
    console.error('Usage: ts-node scripts/reset-password.ts <ra> <newPassword>');
    process.exit(1);
  }

  const ra = String(raArg).trim();
  const newPassword = String(newPasswordArg);

  try {
    const user = await prisma.user.findUnique({ where: { ra } });
    if (!user) {
      console.error(`User with RA ${ra} not found.`);
      process.exit(2);
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { ra },
      data: { password_hash },
    });

    console.log(`Password updated for RA ${ra}.`);
  } catch (err) {
    console.error('Failed to reset password:', err);
    process.exit(3);
  } finally {
    await prisma.$disconnect();
  }
}

main();

