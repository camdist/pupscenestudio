import {normEmail,randomToken,sha256} from './auth.js';
export const PLAN_PRICES={"five-monthly":1,"unlimited-monthly":7.99};
export const PLAN_NAMES={"five-monthly":"5 Storyboard Generations","unlimited-monthly":"Unlimited Storyboard Generation"};
export const MONTH=30*24*60*60*1000;
export function basicAuth(user,pass=''){return 'Basic '+btoa(`${user}:${pass}`)}
export async function createOrder(ctx,{user,plan,billingType,provider,name,currency='USD',amountMinor=null}){
  if(!PLAN_PRICES[plan])throw new Error('invalid_plan');if(!['one-time','subscription'].includes(billingType))throw new Error('invalid_billing');
  const id=crypto.randomUUID(),now=Date.now(),usd=PLAN_PRICES[plan],token=randomToken(24),tokenHash=await sha256(token);
  await ctx.env.DB.prepare(`INSERT INTO orders (id,user_id,email,name,plan,billing_type,provider,expected_amount_usd,charged_currency,charged_amount_minor,status,fulfillment_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.user_id,user.email,name||user.name||'',plan,billingType,provider,usd,currency,amountMinor,'created',tokenHash,now,now).run();
  return {id,token,usd};
}
export async function markOrderPaid(ctx,orderId,{providerPaymentId=null,subscriptionId=null,amountPaid=null,currency=null,eventId=null}={}){
  const now=Date.now();const order=await ctx.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();if(!order)return {ok:false,error:'order_not_found'};
  if(order.status==='paid')return {ok:true,duplicate:true,order};
  await ctx.env.DB.prepare(`UPDATE orders SET status='paid',provider_payment_id=COALESCE(?,provider_payment_id),subscription_id=COALESCE(?,subscription_id),updated_at=? WHERE id=?`).bind(providerPaymentId,subscriptionId,now,orderId).run();
  await ctx.env.DB.prepare(`INSERT INTO payments (id,user_id,email,plan,provider,provider_payment_id,billing_type,amount_usd,currency,amount_paid,status,order_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),order.user_id,order.email,order.plan,order.provider,providerPaymentId||order.id,order.billing_type,Number(order.expected_amount_usd),currency||order.charged_currency||'USD',Number(amountPaid??order.expected_amount_usd),'paid',order.id,now,now).run().catch(()=>{});
  const until=now+MONTH,renewal=order.billing_type==='subscription'?until:null;
  if(order.plan==='five-monthly'){
    // For a fresh 30-day purchase, add 5 credits rather than resetting an existing balance.
    const existing=await ctx.env.DB.prepare('SELECT * FROM entitlements WHERE user_id=?').bind(order.user_id).first();
    const base=(existing&&existing.plan==='five-monthly'&&existing.status==='active'&&Number(existing.valid_until||0)>now)?Number(existing.credits_remaining||0):0;
    await ctx.env.DB.prepare(`INSERT INTO entitlements(user_id,plan,status,credits_remaining,billing_type,subscription_id,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='five-monthly',status='active',credits_remaining=?,billing_type=excluded.billing_type,subscription_id=excluded.subscription_id,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(order.user_id,order.plan,'active',base+5,order.billing_type,subscriptionId,renewal,until,now,base+5).run();
  }else{
    await ctx.env.DB.prepare(`INSERT INTO entitlements(user_id,plan,status,credits_remaining,billing_type,subscription_id,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan='unlimited-monthly',status='active',credits_remaining=0,billing_type=excluded.billing_type,subscription_id=excluded.subscription_id,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(order.user_id,order.plan,'active',0,order.billing_type,subscriptionId,renewal,until,now).run();
  }
  if(eventId)await ctx.env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks (provider,event_id,order_id,processed_at) VALUES (?,?,?,?)').bind(order.provider,eventId,order.id,now).run();
  return {ok:true,order};
}
export async function processedEvent(ctx,provider,eventId){if(!eventId)return false;const r=await ctx.env.DB.prepare('SELECT event_id FROM processed_webhooks WHERE provider=? AND event_id=?').bind(provider,eventId).first();return !!r}
export async function cancelOrderEntitlementIfCurrent(ctx,order,{status='cancelled',subscriptionId=null}={}){
  const now=Date.now();
  if(subscriptionId){await ctx.env.DB.prepare('UPDATE entitlements SET status=?,updated_at=? WHERE user_id=? AND subscription_id=?').bind(status,now,order.user_id,subscriptionId).run()}
  else {await ctx.env.DB.prepare('UPDATE entitlements SET status=?,updated_at=? WHERE user_id=? AND plan=? AND valid_until<=?').bind(status,now,order.user_id,order.plan,now).run()}
}
