import {json,requireUser} from '../lib/auth.js';

function safeMessage(err){
  const raw=String(err?.message||err||'').replace(/\s+/g,' ').trim();
  return raw.slice(0,220);
}

export async function onRequestPost(ctx){
  const r=await requireUser(ctx); if(r.response)return r.response;
  if(!ctx.env.AI)return json({ok:false,error:'ai_not_configured',stage:'binding'},503);

  let body={}; try{body=await ctx.request.json()}catch(e){}
  const kind=String(body.kind||'').trim();
  const prompt=String(body.prompt||'').trim().slice(0,2048);
  if(!['character','location','product'].includes(kind)||!prompt){
    return json({ok:false,error:'invalid_reference_request',stage:'validate'},400);
  }

  let out;
  try{
    // Primary call: explicit fast settings for FLUX.1 Schnell.
    out=await ctx.env.AI.run('@cf/black-forest-labs/flux-1-schnell',{
      prompt,
      steps:4,
      seed:Math.floor(Math.random()*2147483647)
    });
  }catch(primaryError){
    console.warn('Reference image primary inference failed',kind,primaryError);
    try{
      // Compatibility retry: Cloudflare docs only require prompt; omit optional parameters.
      out=await ctx.env.AI.run('@cf/black-forest-labs/flux-1-schnell',{prompt});
    }catch(retryError){
      console.error('Reference image retry failed',kind,retryError);
      return json({
        ok:false,
        error:'ai_inference_failed',
        stage:'inference',
        detail:safeMessage(retryError)||safeMessage(primaryError)||'Workers AI rejected the image request.'
      },502);
    }
  }

  const image=out?.image;
  if(!image){
    console.error('Reference image response missing image field',kind,Object.keys(out||{}));
    return json({ok:false,error:'invalid_ai_response',stage:'response'},502);
  }

  return json({
    ok:true,
    kind,
    dataURI:`data:image/jpeg;charset=utf-8;base64,${image}`
  });
}
