import {json,normEmail} from '../../lib/auth.js';
const MONTH=30*24*60*60*1000;
export async function onRequestPost(ctx){
  const secret=ctx.env.PUPSCENE_PAYMENT_WEBHOOK_SECRET;
  if(!secret||ctx.request.headers.get('x-pupscene-webhook-secret')!==secret)return json({ok:false,error:'unauthorized'},401);
  try{
    const b=await ctx.request.json();const email=normEmail(b.email),plan=b.plan,status=b.status||'paid',billingType=['one-time','subscription'].includes(b.billingType)?b.billingType:'one-time';
    if(!/^\S+@\S+\.\S+$/.test(email)||!['five-monthly','unlimited-monthly'].includes(plan)||!b.providerPaymentId)return json({ok:false,error:'invalid_payload'},400);
    const now=Date.now();let u=await ctx.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if(!u){const id=crypto.randomUUID();await ctx.env.DB.prepare('INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,?,?,?)').bind(id,email,'user','active',now).run();u={id,email}}
    await ctx.env.DB.prepare(`INSERT INTO payments (id,user_id,email,plan,provider,provider_payment_id,billing_type,amount_usd,currency,amount_paid,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider_payment_id) DO UPDATE SET status=excluded.status,billing_type=excluded.billing_type,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),u.id,email,plan,b.provider||'gateway',String(b.providerPaymentId),billingType,Number(b.amountUsd||0),b.currency||'USD',Number(b.amountPaid||0),status,now,now).run();
    if(status==='paid'){
      const until=b.validUntil?Number(b.validUntil):(now+MONTH);const renewal=billingType==='subscription'?(b.renewalAt?Number(b.renewalAt):until):null;
      if(plan==='five-monthly'){
        await ctx.env.DB.prepare(`INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,subscription_id,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='five-monthly',status='active',credits_remaining=5,billing_type=excluded.billing_type,subscription_id=excluded.subscription_id,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(u.id,plan,'active',5,billingType,b.subscriptionId||null,renewal,until,now).run();
      }else{
        await ctx.env.DB.prepare(`INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,subscription_id,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='unlimited-monthly',status='active',credits_remaining=0,billing_type=excluded.billing_type,subscription_id=excluded.subscription_id,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(u.id,plan,'active',0,billingType,b.subscriptionId||null,renewal,until,now).run();
      }
    }else if(['cancelled','refunded','expired','past_due'].includes(status)){
      await ctx.env.DB.prepare('UPDATE entitlements SET status=?,updated_at=? WHERE user_id=?').bind(status,now,u.id).run();
    }
    return json({ok:true});
  }catch(e){return json({ok:false,error:'server_error'},500)}
}
