import { prisma } from '@/lib/prisma';

export async function auditLog(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  changes?: object,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        changes: changes ?? undefined,
      },
    });
  } catch (err) {
    // Audit log failure should never break the main request
    console.error('Audit log failed:', err);
  }
}
