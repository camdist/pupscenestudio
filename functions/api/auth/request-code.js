import {json,normEmail,sha256,adminEmail} from '../../_lib/auth.js';
export async function onRequestPost(ctx){
 try{const body=await ctx.request.json();const email=normEmail(body.email);if(!/^\S+@\S+\.\S+$/.test(email))return json({ok:false,error:'invalid_email'},400);
 const now=Date.now();const recent=await ctx.env.DB.prepare('SELECT created_at FROM auth_codes WHERE email=? ORDER BY created_at DESC LIMIT 1').bind(email).first();if(recent&&now-Number(recent.created_at)<60000)return json({ok:false,error:'wait_before_retry'},429);
 const arr=new Uint32Array(1);crypto.getRandomValues(arr);const code=String(100000+(arr[0]%900000));const hash=await sha256(code);
 await ctx.env.DB.prepare('INSERT INTO auth_codes (id,email,code_hash,created_at,expires_at,attempts) VALUES (?,?,?,?,?,0)').bind(crypto.randomUUID(),email,hash,now,now+10*60*1000).run();
 const role=email===adminEmail(ctx.env)?'admin':'user';await ctx.env.DB.prepare(`INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=CASE WHEN excluded.role='admin' THEN 'admin' ELSE users.role END`).bind(crypto.randomUUID(),email,role,'active',now).run();
 let sent=false;if(ctx.env.RESEND_API_KEY){const from=ctx.env.PUPSCENE_FROM_EMAIL||'PupScene Studio <login@pupscenestudio.site>';const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':'Bearer '+ctx.env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from,to:[email],subject:'Your PupScene Studio sign-in code',html:`<div style="font-family:Arial,sans-serif"><h2>PupScene Studio</h2><p>Your sign-in code is:</p><div style="font-size:32px;font-weight:800;letter-spacing:6px">${code}</div><p>This code expires in 10 minutes.</p><p>If you did not request this code, you can ignore this message.</p></div>`})});sent=r.ok;if(!r.ok)return json({ok:false,error:'email_send_failed'},502)}
 if(!sent&&ctx.env.DEV_OTP_ECHO!=='true')return json({ok:false,error:'email_service_not_configured'},503);
 return json({ok:true,sent:true,...(ctx.env.DEV_OTP_ECHO==='true'?{devCode:code}:{})});
 }catch(e){return json({ok:false,error:'server_error'},500)}
}
