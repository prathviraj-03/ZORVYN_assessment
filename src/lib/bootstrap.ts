import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { Role, Status } from '@prisma/client';

export async function bootstrapAdmin() {
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.log('No bootstrap env vars set — skipping admin creation');
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existing) {
    console.log(`Admin already exists (${existing.email}) — skipping bootstrap`);
    return;
  }

  const passwordHash = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
  });

  console.log(`Bootstrap admin created → ${admin.email}`);
}
