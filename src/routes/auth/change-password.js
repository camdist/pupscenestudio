import {json,requireUser,passwordHash,verifyPassword} from '../../lib/auth.js';

export async function onRequestPost(ctx){
  try{
    const r=await requireUser(ctx);if(r.response)return r.response;
    const b=await ctx.request.json(),oldPassword=String(b.oldPassword||''),newPassword=String(b.newPassword||'');
    if(newPassword.length<8)return json({ok:false,error:'password_too_short'},400);
    if(newPassword===oldPassword)return json({ok:false,error:'password_unchanged'},400);
    const u=await ctx.env.DB.prepare('SELECT password_hash,password_salt FROM users WHERE id=?').bind(r.session.user_id).first();
    if(!u?.password_hash||!u?.password_salt)return json({ok:false,error:'account_recovery_required'},409);
    const ok=await verifyPassword(oldPassword,u.password_salt,u.password_hash);
    if(!ok)return json({ok:false,error:'invalid_current_password'},401);
    const ph=await passwordHash(newPassword);
    await ctx.env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(ph.hash,ph.salt,r.session.user_id).run();
    return json({ok:true});
  }catch(e){console.error('change-password error',e);return json({ok:false,error:'server_error'},500)}
}
