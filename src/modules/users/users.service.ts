import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';
import { CreateUserDto, UpdateUserDto } from './users.schema';

// Reusable select — never expose passwordHash to client
const safeUserSelect = {
  id:        true,
  name:      true,
  email:     true,
  role:      true,
  status:    true,
  createdAt: true,
  updatedAt: true,
} as const;

export const usersService = {
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: safeUserSelect,
    });

    if (!user) throw Errors.NOT_FOUND('User');

    return user;
  },

  async getAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        skip,
        take:    limit,
        select:  safeUserSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async create(dto: CreateUserDto) {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw Errors.CONFLICT('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await prisma.user.create({
      data: {
        name:   dto.name,
        email:  dto.email,
        passwordHash,
        role:   dto.role,
        status: dto.status,
      },
      select: safeUserSelect,
    });

    return user;
  },

  async update(id: string, dto: UpdateUserDto) {
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) throw Errors.NOT_FOUND('User');

    const user = await prisma.user.update({
      where:  { id },
      data:   dto,
      select: safeUserSelect,
    });

    return user;
  },

  async remove(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw Errors.BAD_REQUEST('You cannot delete your own account');
    }

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) throw Errors.NOT_FOUND('User');

    // Hard delete — cascades to their records via Prisma relation
    await prisma.user.delete({ where: { id } });
  },
};