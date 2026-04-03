import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';
import { Errors } from '@/lib/errors';
import { RegisterDto, LoginDto } from './auth.schema';

export const authService = {
  async register(dto: RegisterDto) {
    // Check if email already taken
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw Errors.CONFLICT('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await prisma.user.create({
      data: {
        name:         dto.name,
        email:        dto.email,
        passwordHash,
      },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        status:    true,
        createdAt: true,
      },
    });

    return user;
  },

  async login(dto: LoginDto) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw Errors.INVALID_CREDENTIALS();
    }

    // Check account is active
    if (user.status === 'INACTIVE') {
      throw Errors.FORBIDDEN('Your account has been deactivated. Contact an admin.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw Errors.INVALID_CREDENTIALS();
    }

    // Sign token
    const token = signToken({
      sub:   user.id,
      email: user.email,
      role:  user.role,
    });

    return {
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    };
  },
};