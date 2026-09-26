import {json} from '../../lib/auth.js';
export async function onRequestGet(ctx){
  return json({ok:true,paymongoConfigured:!!ctx.env.PAYMONGO_SECRET_KEY,paypalConfigured:!!(ctx.env.PAYPAL_CLIENT_ID&&ctx.env.PAYPAL_CLIENT_SECRET),paypalSubscriptionConfigured:!!(ctx.env.PAYPAL_PLAN_FIVE&&ctx.env.PAYPAL_PLAN_UNLIMITED)});
}
