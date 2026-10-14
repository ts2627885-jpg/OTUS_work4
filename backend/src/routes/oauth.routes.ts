/**
 * Маршруты входа через OAuth2:
 *   GET /api/auth/oauth/providers                 — включённые провайдеры (для кнопок на входе)
 *   GET /api/auth/oauth/:provider/start           — редирект на страницу входа провайдера
 *   GET /api/auth/oauth/:provider/callback        — возврат от провайдера, выдача токена
 *
 * Токен не передаётся в адресе запроса: он попадает во фрагмент (#oauth_token=...) адреса
 * фронтенда. Фрагмент не отправляется на сервер и не пишется в журналы; фронтенд сразу его стирает.
 */
import { Express, Request, Response } from 'express';
import { AuthService } from '@services/auth.service';
import {
  OAuthError,
  buildAuthUrl,
  createState,
  fetchOAuthProfile,
  getEnabledProviders,
  getProvider,
  logOAuthFailure,
  resolveOAuthUser,
  signState,
  verifyState,
} from '@services/oauth.service';
import { logger } from '@utils/logger';

const STATE_COOKIE = 'oauth_state';
const STATE_PATH = '/api/auth/oauth';
const STATE_MAX_AGE_SECONDS = 600;

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function stateCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=${STATE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Возврат на страницу входа фронтенда с результатом во фрагменте адреса */
function redirectToLogin(res: Response, fragment: string) {
  const base = process.env.OAUTH_PUBLIC_URL || '';
  res.redirect(302, `${base}/login#${fragment}`);
}

export function registerOAuthRoutes(app: Express, authService: AuthService) {
  app.get('/api/auth/oauth/providers', (_req, res) => {
    const providers = getEnabledProviders().map((p) => ({ id: p.id, name: p.name }));
    res.json({ success: true, data: { providers } });
  });

  app.get('/api/auth/oauth/:provider/start', (req, res) => {
    const provider = getProvider(req.params.provider);
    if (!provider) {
      return redirectToLogin(res, 'oauth_error=provider_disabled');
    }
    const state = createState();
    res.setHeader('Set-Cookie', stateCookie(signState(state), STATE_MAX_AGE_SECONDS));
    res.redirect(302, buildAuthUrl(provider, state));
  });

  app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
    const provider = getProvider(req.params.provider);
    // Cookie со state нужна только для этого шага: удаляем в любом исходе
    res.setHeader('Set-Cookie', stateCookie('', 0));

    if (!provider) {
      return redirectToLogin(res, 'oauth_error=provider_disabled');
    }
    if (typeof req.query.error === 'string') {
      logOAuthFailure(provider.id, 'provider_denied');
      return redirectToLogin(res, 'oauth_error=access_denied');
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    if (!code || !verifyState(readCookie(req, STATE_COOKIE), state)) {
      logOAuthFailure(provider.id, 'state_mismatch');
      return redirectToLogin(res, 'oauth_error=state_mismatch');
    }

    try {
      const profile = await fetchOAuthProfile(provider, code);
      const userId = await resolveOAuthUser(profile);
      const session = await authService.issueSessionForUser(userId);
      res.redirect(
        302,
        `${process.env.OAUTH_PUBLIC_URL}/login#oauth_token=${encodeURIComponent(session.access_token)}`
      );
    } catch (err) {
      const code = err instanceof OAuthError ? err.code : 'server_error';
      if (code === 'server_error') {
        logger.error('OAuth callback failed', err as Error, 'OAuth', { provider: provider.id });
      } else {
        logOAuthFailure(provider.id, code);
      }
      redirectToLogin(res, `oauth_error=${code}`);
    }
  });
}
