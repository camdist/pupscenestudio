import {json,requireAdmin,audit,normEmail} from '../../lib/auth.js';
const MONTH=30*24*60*60*1000;
async function activate(ctx,userId,plan,status,billingType='one-time'){
  const now=Date.now();if(status!=='paid')return;
  if(plan==='free-daily'){
    await ctx.env.DB.prepare(`INSERT INTO entitlements(user_id,plan,status,credits_remaining,billing_type,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='free-daily',status='active',credits_remaining=0,billing_type='free',renewal_at=NULL,valid_until=NULL,updated_at=excluded.updated_at`).bind(userId,'free-daily','active',0,'free',null,null,now).run();return;
  }
  const until=now+MONTH;
  if(plan==='five-monthly'){
    await ctx.env.DB.prepare(`INSERT INTO entitlements(user_id,plan,status,credits_remaining,billing_type,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='five-monthly',status='active',credits_remaining=5,billing_type=excluded.billing_type,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(userId,plan,'active',5,billingType,billingType==='subscription'?until:null,until,now).run();
  }else if(plan==='unlimited-monthly'){
    await ctx.env.DB.prepare(`INSERT INTO entitlements(user_id,plan,status,credits_remaining,billing_type,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='unlimited-monthly',status='active',credits_remaining=0,billing_type=excluded.billing_type,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(userId,plan,'active',0,billingType,billingType==='subscription'?until:null,until,now).run();
  }
}
export async function onRequestGet(ctx){const a=await requireAdmin(ctx);if(a.response)return a.response;const rows=await ctx.env.DB.prepare(`SELECT p.*,u.name FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 300`).all();return json({ok:true,payments:rows.results||[]})}
export async function onRequestPost(ctx){
  const a=await requireAdmin(ctx);if(a.response)return a.response;const b=await ctx.request.json();const email=normEmail(b.email),plan=b.plan,billingType=['one-time','subscription'].includes(b.billingType)?b.billingType:'one-time';
  if(!/^\S+@\S+\.\S+$/.test(email)||!['five-monthly','unlimited-monthly'].includes(plan))return json({ok:false,error:'invalid_input'},400);
  const now=Date.now();let u=await ctx.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();if(!u){const id=crypto.randomUUID();await ctx.env.DB.prepare('INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,?,?,?)').bind(id,email,'user','active',now).run();u={id,email}}
  const id=crypto.randomUUID(),status=['pending','paid','failed','refunded'].includes(b.status)?b.status:'paid';
  await ctx.env.DB.prepare('INSERT INTO payments (id,user_id,email,plan,provider,provider_payment_id,billing_type,amount_usd,currency,amount_paid,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,u.id,email,plan,b.provider||'manual',b.providerPaymentId||('manual-'+id),billingType,Number(b.amountUsd||0),b.currency||'USD',Number(b.amountPaid||b.amountUsd||0),status,now,now).run();
  await activate(ctx,u.id,plan,status,billingType);await audit(ctx,a.session.user_id,'manual_payment',u.id,{paymentId:id,plan,billingType,status});return json({ok:true,paymentId:id});
}
