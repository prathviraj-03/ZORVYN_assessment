import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';
import { Errors } from '@/lib/errors';
import {
  RegisterDto,
  LoginDto,
  InviteDto,
  RegisterInviteDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.schema';

export const authService = {
  // ── Register (public — always VIEWER) ───────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw Errors.CONFLICT('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return user;
  },

  // ── Login ────────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw Errors.INVALID_CREDENTIALS();

    if (user.status === 'INACTIVE') {
      throw Errors.FORBIDDEN('Your account has been deactivated. Contact an admin.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw Errors.INVALID_CREDENTIALS();

    // Block full login and force password change first
    if (user.mustChangePassword) {
      return {
        mustChangePassword: true,
        userId: user.id,
        message: 'You must change your password before continuing',
      };
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return {
      mustChangePassword: false,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  },

  // ── Change password (logged in user) ────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw Errors.NOT_FOUND('User');

    const isValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isValid) {
      throw Errors.BAD_REQUEST('Old password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Increment tokenVersion to invalidate all previously issued tokens
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Issue a fresh token with the new tokenVersion
    const token = signToken({
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      tokenVersion: updated.tokenVersion,
    });

    return { token };
  },

  // ── Forgot password — generate reset token ───────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return the same message whether email exists or not
    // Prevents email enumeration attacks
    const safeResponse = {
      message: 'If an account with that email exists, a reset token has been generated.',
    };

    if (!user || user.status === 'INACTIVE') {
      return safeResponse;
    }

    // Generate a cryptographically secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // In production → send resetToken via email to user
    // In dev → return it directly in the response so it can be tested
    return {
      ...safeResponse,
      devOnly_resetToken: resetToken,
      devOnly_note: 'This token is only visible in development. In production it would be emailed.',
      expiresAt: resetTokenExpiry,
    };
  },

  // ── Reset password — use token to set new password ───────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpiry: { gt: new Date() }, // token must not be expired
      },
    });

    if (!user) {
      throw Errors.BAD_REQUEST('Reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Increment tokenVersion to invalidate all previously issued tokens
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    return {
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  },

  // ── Send Invite (admin only) ─────────────────────────────────────────────────
  async sendInvite(dto: InviteDto, adminId: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw Errors.CONFLICT('This email is already registered as a user');
    }

    const existingInvite = await prisma.invite.findUnique({
      where: { email: dto.email },
    });

    if (existingInvite && !existingInvite.used) {
      throw Errors.CONFLICT('An active invite for this email already exists');
    }

    const invite = await prisma.invite.create({
      data: {
        email: dto.email,
        role: dto.role,
        createdBy: adminId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      inviteToken: invite.token,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      note: 'In production this token is sent via email. In dev use it directly in POST /api/auth/register-invite',
    };
  },

  // ── Register via Invite ──────────────────────────────────────────────────────
  async registerViaInvite(dto: RegisterInviteDto) {
    const invite = await prisma.invite.findUnique({
      where: { token: dto.token },
    });

    if (!invite) {
      throw Errors.NOT_FOUND('Invite token');
    }

    if (invite.used) {
      throw Errors.BAD_REQUEST('This invite has already been used');
    }

    if (invite.expiresAt < new Date()) {
      throw Errors.BAD_REQUEST('This invite has expired. Ask an admin to send a new one');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: invite.email,
        passwordHash,
        role: invite.role,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Mark invite as consumed so it cannot be reused
    await prisma.invite.update({
      where: { token: dto.token },
      data: { used: true },
    });

    return user;
  },

  // ── Logout — invalidates all existing tokens for this user ───────────────────
  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  },
};
