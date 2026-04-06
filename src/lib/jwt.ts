import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { env } from '@/config/env';
import { Role } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  tokenVersion: number;
}

export const signToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload & JwtPayload;
};
