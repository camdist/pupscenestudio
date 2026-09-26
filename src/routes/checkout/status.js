import {json} from '../../lib/auth.js';
export async function onRequestGet(ctx){
  const paymongo=!!ctx.env.PAYMONGO_SECRET_KEY;
  const qrph=!!(ctx.env.PAYMONGO_SECRET_KEY&&ctx.env.PAYMONGO_PUBLIC_KEY);
  return json({ok:true,paymongoConfigured:paymongo,qrphConfigured:qrph,paypalConfigured:!!(ctx.env.PAYPAL_CLIENT_ID&&ctx.env.PAYPAL_CLIENT_SECRET),paypalSubscriptionConfigured:!!(ctx.env.PAYPAL_PLAN_FIVE&&ctx.env.PAYPAL_PLAN_UNLIMITED)});
}
