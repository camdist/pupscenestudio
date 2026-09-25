import {json} from '../../lib/auth.js';export async function onRequestGet(ctx){return json({ok:true,turnstileSiteKey:ctx.env.TURNSTILE_SITE_KEY||null})}
