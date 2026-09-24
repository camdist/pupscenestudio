import {json} from '../lib/auth.js';
import {accessRestrictionsEnabled} from '../lib/settings.js';
export async function onRequestGet(ctx){
  return json({ok:true,accessRestrictionsEnabled:await accessRestrictionsEnabled(ctx.env)});
}
