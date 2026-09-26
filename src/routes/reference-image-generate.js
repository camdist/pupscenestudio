import {json,requireUser} from '../lib/auth.js';
export async function onRequestPost(ctx){
  const r=await requireUser(ctx); if(r.response)return r.response;
  if(!ctx.env.AI)return json({ok:false,error:'ai_not_configured'},503);
  let body={}; try{body=await ctx.request.json()}catch(e){}
  const kind=String(body.kind||'').trim();
  const prompt=String(body.prompt||'').trim().slice(0,2048);
  if(!['character','location','product'].includes(kind)||!prompt)return json({ok:false,error:'invalid_reference_request'},400);
  try{
    const out=await ctx.env.AI.run('@cf/black-forest-labs/flux-1-schnell',{prompt,steps:4,seed:Math.floor(Math.random()*2147483647)});
    const image=out?.image;
    if(!image)return json({ok:false,error:'image_generation_failed'},502);
    return json({ok:true,kind,dataURI:`data:image/jpeg;base64,${image}`});
  }catch(e){console.error('Reference image generation failed',kind,e);return json({ok:false,error:'image_generation_failed'},502)}
}
