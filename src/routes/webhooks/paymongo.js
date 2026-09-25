import {json} from '../../lib/auth.js';
import {markOrderPaid,processedEvent,cancelOrderEntitlementIfCurrent,basicAuth} from '../../lib/payments.js';
function dig(obj,paths){for(const p of paths){let v=obj;for(const k of p.split('.'))v=v?.[k];if(v!==undefined&&v!==null)return v}return null}
export async function onRequestPost(ctx){
  const token=new URL(ctx.request.url).searchParams.get('token');if(!ctx.env.PAYMONGO_WEBHOOK_TOKEN||token!==ctx.env.PAYMONGO_WEBHOOK_TOKEN)return json({ok:false,error:'unauthorized'},401);
  try{
    const event=await ctx.request.json();const eventId=String(event?.data?.id||'');if(eventId&&await processedEvent(ctx,'paymongo',eventId))return json({ok:true,duplicate:true});
    const type=String(event?.data?.attributes?.type||'');const data=event?.data?.attributes?.data||{};const attrs=data?.attributes||{};
    let orderId=String(attrs.reference_number||attrs.metadata?.order_id||attrs.metadata?.orderId||'');
    let checkoutId=String(data?.id||attrs.checkout_session_id||'');
    if(!orderId&&checkoutId){const row=await ctx.env.DB.prepare('SELECT id FROM orders WHERE provider=? AND provider_checkout_id=?').bind('paymongo',checkoutId).first();orderId=row?.id||''}
    if(!orderId)return json({ok:true,ignored:true});const order=await ctx.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();if(!order)return json({ok:true,ignored:true});
    // If we have a checkout session id and a secret key, retrieve it server-side before fulfillment.
    if(checkoutId&&ctx.env.PAYMONGO_SECRET_KEY){try{const vr=await fetch('https://api.paymongo.com/v1/checkout_sessions/'+encodeURIComponent(checkoutId),{headers:{authorization:basicAuth(ctx.env.PAYMONGO_SECRET_KEY),accept:'application/json'}});if(vr.ok){const vj=await vr.json();const va=vj.data?.attributes||{};if(va.reference_number&&String(va.reference_number)!==orderId)return json({ok:false,error:'reference_mismatch'},400)}}catch(e){return json({ok:false,error:'provider_verification_failed'},503)}}
    const paymentId=String(dig(event,['data.attributes.data.id','data.attributes.data.attributes.payment_id'])||checkoutId||eventId);const amountMinor=Number(attrs.amount||attrs.paid_amount||order.charged_amount_minor||0);const expected=Number(order.charged_amount_minor||0);
    const paidLike=/paid|payment\.paid|checkout_session\.payment\.paid|checkout_session\.paid/i.test(type)||String(attrs.status||'').toLowerCase()==='paid';
    const refunded=/refund|refunded/i.test(type);const failed=/failed|cancelled|expired/i.test(type);
    if(paidLike){if(expected&&amountMinor&&Math.abs(amountMinor-expected)>1)return json({ok:false,error:'amount_mismatch'},400);await markOrderPaid(ctx,orderId,{providerPaymentId:paymentId,amountPaid:amountMinor?amountMinor/100:Number(order.expected_amount_usd),currency:order.charged_currency||'PHP',eventId});}
    else if(refunded||failed){await ctx.env.DB.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').bind(refunded?'refunded':'failed',Date.now(),orderId).run();await cancelOrderEntitlementIfCurrent(ctx,order,{status:refunded?'cancelled':'past_due',subscriptionId:order.subscription_id||null});if(eventId)await ctx.env.DB.prepare('INSERT OR IGNORE INTO processed_webhooks(provider,event_id,order_id,processed_at) VALUES (?,?,?,?)').bind('paymongo',eventId,orderId,Date.now()).run();}
    return json({ok:true});
  }catch(e){console.error(e);return json({ok:false,error:'server_error'},500)}
}
