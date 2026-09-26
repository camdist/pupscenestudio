import {json,normEmail,randomToken,sha256,sessionCookie,adminEmail,passwordHash,verifyPassword,ensureAuthSchema,adminBootstrapPassword} from '../../lib/auth.js';

async function ensureEntitlement(ctx,u,role,now){
  const ent=await ctx.env.DB.prepare('SELECT user_id FROM entitlements WHERE user_id=?').bind(u.id).first();
  if(!ent)await ctx.env.DB.prepare('INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,updated_at) VALUES (?,?,?,?,?,?)')
    .bind(u.id,role==='admin'?'unlimited-monthly':'free-daily','active',0,role==='admin'?'one-time':'free',now).run();
}
async function makeSession(ctx,u){
  const now=Date.now(),token=randomToken(),tokenHash=await sha256(token);
  await ctx.env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at,user_agent) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),u.id,tokenHash,now,now+30*24*60*60*1000,String(ctx.request.headers.get('user-agent')||'').slice(0,300)).run();
  return json({ok:true,email:u.email,name:u.name||'',isAdmin:u.role==='admin'},200,{'set-cookie':sessionCookie(token)});
}

export async function onRequestPost(ctx){
  try{
    await ensureAuthSchema(ctx.env);
    const b=await ctx.request.json();
    const email=normEmail(b.email),password=String(b.password||'');
    if(!/^\S+@\S+\.\S+$/.test(email))return json({ok:false,error:'invalid_email'},400);
    if(password.length<8)return json({ok:false,error:'password_too_short'},400);
    const now=Date.now(),isAdminEmail=email===adminEmail(ctx.env);
    let u=await ctx.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();

    // Pre-launch admin bootstrap. The default only works until a password is saved.
    if(isAdminEmail&&(!u||!u.password_hash||!u.password_salt)){
      const bootstrap=adminBootstrapPassword(ctx.env);
      if(!bootstrap)return json({ok:false,error:'admin_bootstrap_not_configured'},503);
      if(password!==bootstrap)return json({ok:false,error:'invalid_credentials'},401);
      const ph=await passwordHash(password);
      if(!u){
        const id=crypto.randomUUID();
        await ctx.env.DB.prepare('INSERT INTO users (id,email,name,role,status,created_at,last_login_at,password_hash,password_salt) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(id,email,'Campo Digital Studio','admin','active',now,now,ph.hash,ph.salt).run();
        u=await ctx.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
      }else{
        await ctx.env.DB.prepare('UPDATE users SET role=?,status=?,password_hash=?,password_salt=?,last_login_at=? WHERE id=?')
          .bind('admin','active',ph.hash,ph.salt,now,u.id).run();
        u={...u,role:'admin',status:'active',password_hash:ph.hash,password_salt:ph.salt,last_login_at:now};
      }
      await ensureEntitlement(ctx,u,'admin',now);
      return makeSession(ctx,u);
    }

    if(!u)return json({ok:false,error:'account_not_found'},404);
    if(u.status==='suspended')return json({ok:false,error:'account_suspended'},403);
    if(!u.password_hash||!u.password_salt)return json({ok:false,error:'account_recovery_required'},409);
    const ok=await verifyPassword(password,u.password_salt,u.password_hash);
    if(!ok)return json({ok:false,error:'invalid_credentials'},401);
    const role=isAdminEmail?'admin':u.role;
    await ctx.env.DB.prepare('UPDATE users SET role=?,last_login_at=? WHERE id=?').bind(role,now,u.id).run();
    u={...u,role,last_login_at:now};
    await ensureEntitlement(ctx,u,role,now);
    return makeSession(ctx,u);
  }catch(e){console.error('login error',e);return json({ok:false,error:'server_error'},500)}
}
