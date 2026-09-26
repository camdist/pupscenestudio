import { requireUser, json } from '../lib/auth.js';

function clean(v,max=4000){return String(v||'').trim().slice(0,max)}
function slugHint(link){
  try{
    const u=new URL(link);
    const bits=u.pathname.split('/').filter(Boolean).map(x=>decodeURIComponent(x).replace(/[-_+]+/g,' ')).filter(x=>x.length>2&&!/^(dp|gp|product|products|item|p)$/i.test(x));
    return `${u.hostname}${bits.length?` | URL words: ${bits.slice(0,4).join(' / ')}`:''}`;
  }catch{return clean(link,500)}
}
function extractJson(text){
  const t=String(text||'').trim();
  try{return JSON.parse(t)}catch{}
  const m=t.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0])}catch{}}
  return null;
}
export async function onRequestPost(ctx){
  const auth=await requireUser(ctx); if(auth.response)return auth.response;
  if(!ctx.env.AI)return json({ok:false,error:'ai_not_configured'},503);
  let body={};try{body=await ctx.request.json()}catch{}
  const product=clean(body.product,300),link=clean(body.link,1000),sellerText=clean(body.sellerText,5000),details=clean(body.details,4000),platform=clean(body.platform,100),objective=clean(body.objective,100);
  if(!product&&!sellerText&&!details&&!link)return json({ok:false,error:'product_context_required'},400);
  const prompt=`You are an affiliate-ad strategist helping prepare a truthful product-video campaign. Do not invent technical specifications, prices, medical claims, guarantees, ratings or seller claims that are not in the supplied context. If facts are missing, use cautious generic language. Return ONLY valid JSON with this schema:\n{\n  "product":"short product name",\n  "audience":"specific buyer + recurring pain point",\n  "benefit":"primary believable benefit + short CTA",\n  "details":"visual/product identity details to preserve; clearly label unknown specifics as verify against seller page",\n  "recommendedStoryType":"one of problem,hookdemo,ugc,beforeafter,lifestyle,objection,tutorial,unboxing,affiliate",\n  "hooks":["hook 1","hook 2","hook 3","hook 4","hook 5"],\n  "campaignAngle":"one concise conversion angle",\n  "storyline":"connected 3-5 beat affiliate ad storyline with continuity from beat to beat",\n  "claimCheck":"one short reminder of any facts the creator should verify before publishing"\n}\n\nCONTEXT\nProduct entered: ${product||'(not entered)'}\nProduct URL clue only (page content was NOT fetched): ${slugHint(link)||'(none)'}\nSeller/product text supplied by user: ${sellerText||'(none)'}\nExisting visual details: ${details||'(none)'}\nTarget publishing platform: ${platform||'(not chosen)'}\nAd objective: ${objective||'(not chosen)'}\n\nMake the hooks useful for social affiliate ads. Keep the storyline visually connected instead of separate product montages.`;
  try{
    const r=await ctx.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast',{prompt,max_tokens:1200,temperature:.45});
    const parsed=extractJson(r?.response);
    if(!parsed)return json({ok:false,error:'ai_response_unreadable',detail:String(r?.response||'').slice(0,800)},502);
    return json({ok:true,brief:parsed});
  }catch(e){console.error('campaign analyze failed',e);return json({ok:false,error:'campaign_analysis_failed',detail:String(e?.message||e).slice(0,300)},502)}
}
