import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, type UserRole } from '../models/User.js';
import { HttpError } from './error.js';

export const AUTH_COOKIE = 'ec_session';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * `tv` pins the token to the account's current password generation. Changing a
 * password bumps the stored version, so every token carrying the old one stops
 * verifying — which is what makes a reset actually sign other devices out.
 */
export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

/**
 * The token rides in an httpOnly cookie so client-side script can never read
 * it, which takes session theft off the table for an XSS bug.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  });
}

/** Populates req.user, or 401s. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new HttpError(401, 'You need to log in to do that.');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, 'Your session has expired. Please log in again.');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.active) {
      throw new HttpError(401, 'Your session is no longer valid.');
    }

    /*
     * A token minted before the current password is no longer good. Tokens
     * issued before this field existed carry no `tv`; they are treated as
     * version 0, which is what those accounts already hold, so nobody is
     * signed out by the upgrade itself.
     */
    const presented = typeof payload.tv === 'number' ? payload.tv : 0;
    if (presented !== (user.tokenVersion ?? 0)) {
      throw new HttpError(401, 'That session was ended by a password change. Please log in again.');
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, 'You need to log in to do that.'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to that.'));
    }
    next();
  };
}

export const requireManager = requireRole('manager');
