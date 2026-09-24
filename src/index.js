import { onRequestPost as requestCode } from './routes/auth/request-code.js';
import { onRequestPost as verifyCode } from './routes/auth/verify-code.js';
import { onRequestGet as authMe } from './routes/auth/me.js';
import { onRequestPost as logout } from './routes/auth/logout.js';
import { onRequestPost as consumeGeneration } from './routes/generation/consume.js';
import { onRequestGet as adminUsersGet, onRequestPatch as adminUsersPatch } from './routes/admin/users.js';
import { onRequestGet as adminBillingGet, onRequestPost as adminBillingPost } from './routes/admin/billing.js';
import { onRequestGet as accountBillingGet } from './routes/account/billing.js';
import { onRequestPost as paymentWebhook } from './routes/webhooks/payment.js';
import { onRequestGet as localizeGet } from './routes/localize.js';
import { onRequestGet as appSettingsGet } from './routes/app-settings.js';
import { onRequestGet as adminSettingsGet, onRequestPatch as adminSettingsPatch } from './routes/admin/settings.js';

const methodNotAllowed = () => new Response(JSON.stringify({ok:false,error:'method_not_allowed'}), {
  status: 405,
  headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store','allow':'GET, POST, PATCH, OPTIONS'}
});
const notFound = () => new Response(JSON.stringify({ok:false,error:'not_found'}), {
  status: 404,
  headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

function withSecurityHeaders(response) {
  const h = new Headers(response.headers);
  h.set('x-content-type-options','nosniff');
  h.set('referrer-policy','strict-origin-when-cross-origin');
  h.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  h.set('x-frame-options','DENY');
  h.set('content-security-policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.resend.com https://api.frankfurter.app; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (new URL(response.url || 'https://x.invalid').protocol === 'https:' || true) h.set('strict-transport-security','max-age=31536000; includeSubDomains');
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers: h});
}

async function dispatchApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();
  const context = { request, env, waitUntil: ctx.waitUntil.bind(ctx), passThroughOnException: ()=>{} };

  if (method === 'OPTIONS') return new Response(null, {status:204, headers:{'allow':'GET, POST, PATCH, OPTIONS','cache-control':'no-store'}});
  if (path === '/api/auth/request-code') return method === 'POST' ? requestCode(context) : methodNotAllowed();
  if (path === '/api/auth/verify-code') return method === 'POST' ? verifyCode(context) : methodNotAllowed();
  if (path === '/api/auth/me') return method === 'GET' ? authMe(context) : methodNotAllowed();
  if (path === '/api/auth/logout') return method === 'POST' ? logout(context) : methodNotAllowed();
  if (path === '/api/generation/consume') return method === 'POST' ? consumeGeneration(context) : methodNotAllowed();
  if (path === '/api/admin/users') {
    if (method === 'GET') return adminUsersGet(context);
    if (method === 'PATCH') return adminUsersPatch(context);
    return methodNotAllowed();
  }
  if (path === '/api/admin/billing') {
    if (method === 'GET') return adminBillingGet(context);
    if (method === 'POST') return adminBillingPost(context);
    return methodNotAllowed();
  }
  if (path === '/api/account/billing') return method === 'GET' ? accountBillingGet(context) : methodNotAllowed();
  if (path === '/api/webhooks/payment') return method === 'POST' ? paymentWebhook(context) : methodNotAllowed();
  if (path === '/api/localize') return method === 'GET' ? localizeGet(context) : methodNotAllowed();
  if (path === '/api/app-settings') return method === 'GET' ? appSettingsGet(context) : methodNotAllowed();
  if (path === '/api/admin/settings') {
    if (method === 'GET') return adminSettingsGet(context);
    if (method === 'PATCH') return adminSettingsPatch(context);
    return methodNotAllowed();
  }
  return notFound();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!env.DB && !['/api/localize','/api/app-settings'].includes(url.pathname)) {
          return withSecurityHeaders(new Response(JSON.stringify({ok:false,error:'database_not_configured'}), {
            status: 503,
            headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
          }));
        }
        return withSecurityHeaders(await dispatchApi(request, env, ctx));
      }
      // Normally static requests bypass the Worker because run_worker_first only matches /api/*.
      // This fallback keeps direct Worker invocation safe during development/tests.
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('PupScene Worker error', error);
      return withSecurityHeaders(new Response(JSON.stringify({ok:false,error:'server_error'}), {
        status: 500,
        headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
      }));
    }
  }
};
