const COOKIE='pupscene_session';
export const ADMIN_EMAIL='campodigitalstudio@gmail.com';
export const normEmail=v=>String(v||'').trim().toLowerCase();
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
export async function sha256(value){const b=new TextEncoder().encode(value);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function cookieValue(req,name=COOKIE){const raw=req.headers.get('cookie')||'';for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===name)return decodeURIComponent(v.join('='))}return null}
export function sessionCookie(token,maxAge=2592000){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function clearSessionCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export function adminEmail(env){return normEmail(env.ADMIN_EMAIL||ADMIN_EMAIL)}
export async function getSession(ctx){
  const token=cookieValue(ctx.request); if(!token)return null; const hash=await sha256(token); const now=Date.now();
  const row=await ctx.env.DB.prepare(`SELECT s.id session_id,s.expires_at,u.id user_id,u.email,u.name,u.role,u.status user_status,u.created_at,u.last_login_at,
      e.plan,e.status entitlement_status,e.credits_remaining,e.renewal_at,e.valid_until,e.billing_type,e.subscription_id
      FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN entitlements e ON e.user_id=u.id
      WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(hash,now).first();
  if(!row)return null; return row;
}
export async function requireUser(ctx){const s=await getSession(ctx);if(!s)return {response:json({ok:false,error:'auth_required'},401)};if(s.user_status==='suspended')return {response:json({ok:false,error:'account_suspended'},403)};return {session:s}}
export async function requireAdmin(ctx){const r=await requireUser(ctx);if(r.response)return r;const s=r.session;const allowed=normEmail(s.email)===adminEmail(ctx.env)&&s.role==='admin';if(!allowed)return {response:json({ok:false,error:'admin_required'},403)};return {session:s}}
export function publicUser(s){return {id:s.user_id,email:s.email,name:s.name||'',role:s.role,status:s.user_status,plan:s.plan||'free-daily',entitlementStatus:s.entitlement_status||'active',creditsRemaining:Number(s.credits_remaining||0),renewalAt:s.renewal_at||null,validUntil:s.valid_until||null,billingType:s.billing_type||'free',subscriptionId:s.subscription_id||null,isAdmin:s.role==='admin'&&normEmail(s.email)===ADMIN_EMAIL}}
export async function audit(ctx,adminId,action,targetUserId=null,details={}){try{await ctx.env.DB.prepare('INSERT INTO admin_audit (id,admin_user_id,action,target_user_id,details_json,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),adminId,action,targetUserId,JSON.stringify(details),Date.now()).run()}catch(e){}}
