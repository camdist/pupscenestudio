import { requireUser, json } from '../../lib/auth.js';
function clean(v,max=80){return String(v||'').trim().replace(/\s+/g,' ').slice(0,max)}
export async function onRequestPatch(ctx){const auth=await requireUser(ctx);if(auth.response)return auth.response;let body={};try{body=await ctx.request.json()}catch{}const name=clean(body.name,80);if(!name)return json({ok:false,error:'name_required'},400);await ctx.env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(name,auth.session.user_id).run();return json({ok:true,name})}
