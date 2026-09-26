import {json,requireUser} from '../../lib/auth.js';
import {PLAN_PRICES,PLAN_NAMES,createOrder,basicAuth} from '../../lib/payments.js';

async function usdToPhp(){
  try{
    const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=PHP');
    if(r.ok){const j=await r.json();const x=Number(j.rates?.PHP);if(x>0)return x}
  }catch(_){ }
  return 58;
}

async function apiJson(url,{method='GET',auth,body}={}){
  const r=await fetch(url,{method,headers:{authorization:auth,accept:'application/json',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const detail=j?.errors?.[0]?.detail||j?.errors?.[0]?.code||j?.error||`HTTP ${r.status}`;const e=new Error(detail);e.status=r.status;e.payload=j;throw e}
  return j;
}

export async function onRequestPost(ctx){
  const r=await requireUser(ctx);if(r.response)return r.response;
  let b={};try{b=await ctx.request.json()}catch(_){ }
  const plan=String(b.plan||'');const billingType=String(b.billingType||'one-time');const name=String(b.name||'').trim();
  if(!PLAN_PRICES[plan])return json({ok:false,error:'invalid_plan'},400);
  if(billingType!=='one-time')return json({ok:false,error:'qrph_one_time_only'},400);
  if(!ctx.env.PAYMONGO_SECRET_KEY)return json({ok:false,error:'paymongo_not_configured'},503);
  if(!ctx.env.PAYMONGO_PUBLIC_KEY)return json({ok:false,error:'paymongo_public_key_not_configured'},503);
  const secretAuth=basicAuth(ctx.env.PAYMONGO_SECRET_KEY);const publicAuth=basicAuth(ctx.env.PAYMONGO_PUBLIC_KEY);
  let order=null;
  try{
    const rate=await usdToPhp();const php=Math.max(100,Math.round(PLAN_PRICES[plan]*rate*100));
    order=await createOrder(ctx,{user:r.session,plan,billingType:'one-time',provider:'paymongo',name,currency:'PHP',amountMinor:php});
    const intent=await apiJson('https://api.paymongo.com/v1/payment_intents',{method:'POST',auth:secretAuth,body:{data:{attributes:{amount:php,currency:'PHP',payment_method_allowed:['qrph'],description:`PupScene Studio — ${PLAN_NAMES[plan]} — Order ${order.id}`}}}});
    const paymentIntentId=intent?.data?.id;const clientKey=intent?.data?.attributes?.client_key;
    if(!paymentIntentId||!clientKey)throw new Error('payment_intent_missing_fields');
    await ctx.env.DB.prepare('UPDATE orders SET provider_checkout_id=?,status=?,updated_at=? WHERE id=?').bind(paymentIntentId,'pending',Date.now(),order.id).run();

    const pm=await apiJson('https://api.paymongo.com/v1/payment_methods',{method:'POST',auth:publicAuth,body:{data:{attributes:{type:'qrph',expiry_seconds:1800}}}});
    const paymentMethodId=pm?.data?.id;if(!paymentMethodId)throw new Error('payment_method_missing_id');
    const attached=await apiJson(`https://api.paymongo.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/attach`,{method:'POST',auth:publicAuth,body:{data:{attributes:{payment_method:paymentMethodId,client_key:clientKey}}}});
    const attrs=attached?.data?.attributes||{};const qrImage=attrs?.next_action?.code?.image_url||null;const testUrl=attrs?.next_action?.code?.test_url||attrs?.next_action?.test_url||null;
    if(!qrImage)throw new Error(attrs?.last_payment_error?.failed_message||'qr_image_missing');
    return json({ok:true,orderId:order.id,paymentIntentId,qrImage,testUrl,amountMinor:php,currency:'PHP',expiresIn:1800,status:attrs.status||'awaiting_next_action'});
  }catch(e){
    console.error('qrph_create_failed',e?.message||e);
    if(order?.id)await ctx.env.DB.prepare("UPDATE orders SET status='failed',updated_at=? WHERE id=?").bind(Date.now(),order.id).run().catch(()=>{});
    return json({ok:false,error:'qrph_create_failed',detail:String(e?.message||'Unable to create QR Ph payment').slice(0,180)},502);
  }
}
