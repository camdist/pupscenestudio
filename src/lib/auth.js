const COOKIE='pupscene_session';
export const ADMIN_EMAIL='campodigitalstudio@gmail.com';
export const normEmail=v=>String(v||'').trim().toLowerCase();
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
export async function sha256(value){const b=new TextEncoder().encode(value);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

export function bytesToHex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function hexToBytes(hex){const clean=String(hex||'');const out=new Uint8Array(Math.floor(clean.length/2));for(let i=0;i<out.length;i++)out[i]=parseInt(clean.slice(i*2,i*2+2),16);return out}
export async function passwordHash(password,saltHex=null){
  const salt=saltHex?hexToBytes(saltHex):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),{name:'PBKDF2'},false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},key,256);
  return {hash:bytesToHex(new Uint8Array(bits)),salt:bytesToHex(salt)};
}
export async function verifyPassword(password,saltHex,expectedHash){const r=await passwordHash(password,saltHex);return r.hash===String(expectedHash||'')}

export function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function cookieValue(req,name=COOKIE){const raw=req.headers.get('cookie')||'';for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===name)return decodeURIComponent(v.join('='))}return null}
export function sessionCookie(token,maxAge=2592000){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function clearSessionCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export function adminEmail(env){return normEmail(env.ADMIN_EMAIL||ADMIN_EMAIL)}
export function adminBootstrapPassword(env){
  return String(
    env.ADMIN_BOOTSTRAP_PASSWORD ||
    env.BOOTSTRAP_ADMIN_PASSWORD ||
    env.BOOSTRAP_ADMIN_PASSWORD ||
    ''
  );
}

async function tableColumns(db,table){
  const r=await db.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((r.results||[]).map(x=>String(x.name||'')));
}
export async function ensureAuthSchema(env){
  if(!env?.DB)throw new Error('DB binding missing');
  // Create core auth tables only when absent. Existing tables are preserved.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT,password_hash TEXT,password_salt TEXT,
    role TEXT NOT NULL DEFAULT 'user',status TEXT NOT NULL DEFAULT 'active',created_at INTEGER NOT NULL,last_login_at INTEGER
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS entitlements (
    user_id TEXT PRIMARY KEY,plan TEXT NOT NULL DEFAULT 'free-daily',status TEXT NOT NULL DEFAULT 'active',credits_remaining INTEGER NOT NULL DEFAULT 0,
    billing_type TEXT NOT NULL DEFAULT 'free',subscription_id TEXT,renewal_at INTEGER,valid_until INTEGER,updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
  const uc=await tableColumns(env.DB,'users');
  if(!uc.has('password_hash'))await env.DB.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').run();
  if(!uc.has('password_salt'))await env.DB.prepare('ALTER TABLE users ADD COLUMN password_salt TEXT').run();
  if(!uc.has('name'))await env.DB.prepare('ALTER TABLE users ADD COLUMN name TEXT').run();
  if(!uc.has('last_login_at'))await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_at INTEGER').run();
  const sc=await tableColumns(env.DB,'sessions');
  if(!sc.has('user_agent'))await env.DB.prepare('ALTER TABLE sessions ADD COLUMN user_agent TEXT').run();
  return true;
}

export function clientIp(req){return String(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')||'').split(',')[0].trim()}
export async function getSession(ctx){
  const token=cookieValue(ctx.request); if(!token)return null; const hash=await sha256(token); const now=Date.now();
  const row=await ctx.env.DB.prepare(`SELECT s.id session_id,s.expires_at,s.created_at session_created_at,u.id user_id,u.email,u.name,u.role,u.status user_status,u.created_at,u.last_login_at,
      e.plan,e.status entitlement_status,e.credits_remaining,e.renewal_at,e.valid_until,e.billing_type,e.subscription_id
      FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN entitlements e ON e.user_id=u.id
      WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(hash,now).first();
  if(!row)return null; return row;
}
export async function requireUser(ctx){const s=await getSession(ctx);if(!s)return {response:json({ok:false,error:'auth_required'},401)};if(s.user_status==='suspended')return {response:json({ok:false,error:'account_suspended'},403)};return {session:s}}
export async function requireAdmin(ctx){const r=await requireUser(ctx);if(r.response)return r;const s=r.session;const allowed=normEmail(s.email)===adminEmail(ctx.env)&&s.role==='admin';if(!allowed)return {response:json({ok:false,error:'admin_required'},403)};return {session:s}}
export function publicUser(s,env){return {id:s.user_id,email:s.email,name:s.name||'',role:s.role,status:s.user_status,plan:s.plan||'free-daily',entitlementStatus:s.entitlement_status||'active',creditsRemaining:Number(s.credits_remaining||0),renewalAt:s.renewal_at||null,validUntil:s.valid_until||null,billingType:s.billing_type||'free',subscriptionId:s.subscription_id||null,isAdmin:s.role==='admin'&&normEmail(s.email)===adminEmail(env)}}
export async function audit(ctx,adminId,action,targetUserId=null,details={}){try{await ctx.env.DB.prepare('INSERT INTO admin_audit (id,admin_user_id,action,target_user_id,details_json,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),adminId,action,targetUserId,JSON.stringify(details),Date.now()).run()}catch(e){}}
