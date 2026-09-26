import {json,normEmail,randomToken,sha256,sessionCookie,adminEmail,passwordHash,verifyPassword} from '../../lib/auth.js';

export async function onRequestPost(ctx){
  try{
    const b=await ctx.request.json();
    const email=normEmail(b.email),password=String(b.password||''),name=String(b.name||'').trim().slice(0,120);
    if(!/^\S+@\S+\.\S+$/.test(email))return json({ok:false,error:'invalid_email'},400);
    if(password.length<8)return json({ok:false,error:'password_too_short'},400);
    const now=Date.now();
    let u=await ctx.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    let created=false;
    if(!u){
      const id=crypto.randomUUID(),role=email===adminEmail(ctx.env)?'admin':'user';
      const ph=await passwordHash(password);
      await ctx.env.DB.prepare('INSERT INTO users (id,email,name,role,status,created_at,last_login_at,password_hash,password_salt) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id,email,name||null,role,'active',now,now,ph.hash,ph.salt).run();
      u=await ctx.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
      const isAdmin=role==='admin';
      await ctx.env.DB.prepare('INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,updated_at) VALUES (?,?,?,?,?,?)')
        .bind(id,isAdmin?'unlimited-monthly':'free-daily','active',0,isAdmin?'one-time':'free',now).run();
      created=true;
    }else{
      if(u.status==='suspended')return json({ok:false,error:'account_suspended'},403);
      if(!u.password_hash||!u.password_salt)return json({ok:false,error:'password_setup_required'},409);
      const ok=await verifyPassword(password,u.password_salt,u.password_hash);
      if(!ok)return json({ok:false,error:'invalid_credentials'},401);
      const role=email===adminEmail(ctx.env)?'admin':u.role;
      await ctx.env.DB.prepare("UPDATE users SET role=?,name=COALESCE(NULLIF(?,''),name),last_login_at=? WHERE id=?")
        .bind(role,name,now,u.id).run();
      u={...u,role,name:name||u.name};
      const ent=await ctx.env.DB.prepare('SELECT user_id FROM entitlements WHERE user_id=?').bind(u.id).first();
      if(!ent)await ctx.env.DB.prepare('INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,updated_at) VALUES (?,?,?,?,?,?)')
        .bind(u.id,role==='admin'?'unlimited-monthly':'free-daily','active',0,role==='admin'?'one-time':'free',now).run();
    }
    const token=randomToken(),tokenHash=await sha256(token);
    await ctx.env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at,user_agent) VALUES (?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),u.id,tokenHash,now,now+30*24*60*60*1000,String(ctx.request.headers.get('user-agent')||'').slice(0,300)).run();
    return json({ok:true,created,email},200,{'set-cookie':sessionCookie(token)});
  }catch(e){console.error('email-access error',e);return json({ok:false,error:'server_error'},500)}
}
