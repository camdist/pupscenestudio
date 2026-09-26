import {json,normEmail,randomToken,sha256,sessionCookie,adminEmail,passwordHash,ensureAuthSchema} from '../../lib/auth.js';

export async function onRequestPost(ctx){
  let stage='start';
  try{
    stage='schema';
    await ensureAuthSchema(ctx.env);
    stage='body';
    const b=await ctx.request.json();
    const email=normEmail(b.email),password=String(b.password||''),name=String(b.name||'').trim().slice(0,120);
    if(!/^\S+@\S+\.\S+$/.test(email))return json({ok:false,error:'invalid_email'},400);
    if(email===adminEmail(ctx.env))return json({ok:false,error:'admin_email_reserved'},409);
    if(name.length<2)return json({ok:false,error:'name_required'},400);
    if(password.length<8)return json({ok:false,error:'password_too_short'},400);
    stage='lookup';
    const exists=await ctx.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if(exists)return json({ok:false,error:'account_exists'},409);
    stage='password_hash';
    const now=Date.now(),id=crypto.randomUUID(),ph=await passwordHash(password);
    stage='user_insert';
    await ctx.env.DB.prepare('INSERT INTO users (id,email,name,role,status,created_at,last_login_at,password_hash,password_salt) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id,email,name,'user','active',now,now,ph.hash,ph.salt).run();
    stage='entitlement_insert';
    try{
      await ctx.env.DB.prepare('INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,updated_at) VALUES (?,?,?,?,?,?)')
        .bind(id,'free-daily','active',0,'free',now).run();
    }catch(entitlementError){
      // Do not leave an orphan account if entitlement creation fails.
      try{await ctx.env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run()}catch(_){}
      throw entitlementError;
    }
    stage='session_insert';
    const token=randomToken(),tokenHash=await sha256(token);
    await ctx.env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at,user_agent) VALUES (?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,tokenHash,now,now+30*24*60*60*1000,String(ctx.request.headers.get('user-agent')||'').slice(0,300)).run();
    return json({ok:true,created:true,email,name},201,{'set-cookie':sessionCookie(token)});
  }catch(e){
    console.error('signup error',stage,e);
    return json({ok:false,error:'server_error',stage},500);
  }
}
