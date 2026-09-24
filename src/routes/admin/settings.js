import {json,requireAdmin,audit} from '../../lib/auth.js';
import {accessRestrictionsEnabled} from '../../lib/settings.js';
export async function onRequestGet(ctx){
  const a=await requireAdmin(ctx);if(a.response)return a.response;
  return json({ok:true,accessRestrictionsEnabled:await accessRestrictionsEnabled(ctx.env)});
}
export async function onRequestPatch(ctx){
  const a=await requireAdmin(ctx);if(a.response)return a.response;
  const b=await ctx.request.json().catch(()=>({}));
  const enabled=!!b.accessRestrictionsEnabled,now=Date.now();
  await ctx.env.DB.prepare(`INSERT INTO app_settings(key,value,updated_at,updated_by) VALUES('access_restrictions_enabled',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(enabled?'1':'0',now,a.session.user_id).run();
  await audit(ctx,a.session.user_id,'set_access_restrictions',null,{enabled});
  return json({ok:true,accessRestrictionsEnabled:enabled});
}
