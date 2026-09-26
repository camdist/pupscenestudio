import {json,normEmail,sha256,clientIp} from '../../lib/auth.js';
async function verifyTurnstile(ctx,token){
  if(!ctx.env.TURNSTILE_SECRET_KEY)return true;
  if(!token)return false;
  const form=new FormData();form.set('secret',ctx.env.TURNSTILE_SECRET_KEY);form.set('response',token);const ip=clientIp(ctx.request);if(ip)form.set('remoteip',ip);
  try{const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});const j=await r.json();return !!j.success}catch(e){console.error('Turnstile verification failed',e);return false}
}
export async function onRequestPost(ctx){
 try{
  const body=await ctx.request.json();const email=normEmail(body.email);if(!/^\S+@\S+\.\S+$/.test(email))return json({ok:false,error:'invalid_email'},400);
  if(!(await verifyTurnstile(ctx,body.turnstileToken)))return json({ok:false,error:'verification_required'},400);
  const now=Date.now(),windowStart=now-15*60*1000,ip=clientIp(ctx.request),ipHash=ip?await sha256(ip):'';
  const recent=await ctx.env.DB.prepare('SELECT created_at FROM auth_codes WHERE email=? ORDER BY created_at DESC LIMIT 1').bind(email).first();if(recent&&now-Number(recent.created_at)<60000)return json({ok:false,error:'wait_before_retry'},429);
  const emailCount=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM auth_codes WHERE email=? AND created_at>=?').bind(email,windowStart).first();if(Number(emailCount?.count||0)>=3)return json({ok:false,error:'email_rate_limited'},429);
  if(ipHash){const ipCount=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM auth_codes WHERE ip_hash=? AND created_at>=?').bind(ipHash,windowStart).first();if(Number(ipCount?.count||0)>=5)return json({ok:false,error:'ip_rate_limited'},429)}
  const arr=new Uint32Array(1);crypto.getRandomValues(arr);const code=String(100000+(arr[0]%900000));const hash=await sha256(code);const codeId=crypto.randomUUID();
  await ctx.env.DB.prepare('INSERT INTO auth_codes (id,email,code_hash,created_at,expires_at,attempts,ip_hash) VALUES (?,?,?,?,?,0,?)').bind(codeId,email,hash,now,now+10*60*1000,ipHash).run();
  let sent=false;
  if(ctx.env.RESEND_API_KEY){
    const from=ctx.env.PUPSCENE_FROM_EMAIL||'PupScene Studio <login@pupscenestudio.site>';
    let r;
    try{
      r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':'Bearer '+ctx.env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from,to:[email],reply_to:'campodigitalstudio@gmail.com',subject:'Your PupScene Studio sign-in code',html:`<div style="font-family:Arial,sans-serif;color:#111"><h2>PupScene Studio</h2><p>Your sign-in code is:</p><div style="font-size:32px;font-weight:800;letter-spacing:6px">${code}</div><p>This code expires in 10 minutes.</p><p>If you did not request this code, you can ignore this message.</p></div>`})});
    }catch(err){
      console.error('Resend request failed before response',err);
      await ctx.env.DB.prepare('DELETE FROM auth_codes WHERE id=?').bind(codeId).run().catch(()=>{});
      return json({ok:false,error:'email_send_failed'},502);
    }
    sent=r.ok;
    if(!r.ok){
      const detail=(await r.text().catch(()=>'' )).slice(0,1200);
      console.error('Resend send failed',{status:r.status,statusText:r.statusText,from,detail});
      await ctx.env.DB.prepare('DELETE FROM auth_codes WHERE id=?').bind(codeId).run().catch(()=>{});
      return json({ok:false,error:'email_send_failed'},502);
    }
  }
  if(!sent&&ctx.env.DEV_OTP_ECHO!=='true'){
    await ctx.env.DB.prepare('DELETE FROM auth_codes WHERE id=?').bind(codeId).run().catch(()=>{});
    return json({ok:false,error:'email_service_not_configured'},503);
  }
  return json({ok:true,sent:true,...(ctx.env.DEV_OTP_ECHO==='true'?{devCode:code}:{})});
 }catch(e){console.error('OTP request failed',e);return json({ok:false,error:'server_error'},500)}
}
