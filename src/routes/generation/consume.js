import {json,requireUser,adminEmail,normEmail,getSession} from '../../lib/auth.js';
import {accessRestrictionsEnabled} from '../../lib/settings.js';

const DAY_MS=24*60*60*1000;
const utcDayStart=now=>{const d=new Date(now);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())};

export async function onRequestPost(ctx){
  const now=Date.now();
  const restricted=await accessRestrictionsEnabled(ctx.env);
  if(!restricted){
    const s=await getSession(ctx).catch(()=>null);
    if(s){
      await ctx.env.DB.prepare('INSERT INTO generation_events (id,user_id,plan,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),s.user_id,'testing-unrestricted',now).run().catch(()=>{});
    }
    return json({ok:true,restrictionsEnabled:false,testingMode:true,unlimited:true,creditsRemaining:null});
  }

  const r=await requireUser(ctx);if(r.response)return r.response;
  const s=r.session;
  if(normEmail(s.email)===adminEmail(ctx.env))return json({ok:true,restrictionsEnabled:true,plan:'unlimited-monthly',unlimited:true,creditsRemaining:null,isAdmin:true});

  const plan=s.plan||'free-daily';
  const status=s.entitlement_status||'active';
  const validUntil=Number(s.valid_until||s.renewal_at||0)||null;
  if(status!=='active')return json({ok:false,error:'no_active_plan',checkoutUrl:'/checkout.html'},402);
  if(validUntil && validUntil<now)return json({ok:false,error:'plan_expired',checkoutUrl:'/checkout.html?plan='+encodeURIComponent(plan)},402);

  if(plan==='free-daily'){
    const start=utcDayStart(now);
    const row=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM generation_events WHERE user_id=? AND plan='free-daily' AND created_at>=?").bind(s.user_id,start).first();
    const used=Number(row?.count||0);
    if(used>=1)return json({ok:false,error:'daily_free_used',checkoutUrl:'/checkout.html'},402);
    await ctx.env.DB.prepare('INSERT INTO generation_events (id,user_id,plan,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),s.user_id,'free-daily',now).run();
    return json({ok:true,plan,creditsRemaining:0,dailyRemaining:0,resetsAt:start+DAY_MS});
  }

  if(plan==='unlimited-monthly'){
    await ctx.env.DB.prepare('INSERT INTO generation_events (id,user_id,plan,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),s.user_id,plan,now).run();
    return json({ok:true,plan,unlimited:true,creditsRemaining:null,validUntil});
  }

  if(plan==='five-monthly'){
    const x=await ctx.env.DB.prepare("UPDATE entitlements SET credits_remaining=credits_remaining-1,updated_at=? WHERE user_id=? AND status='active' AND credits_remaining>0").bind(now,s.user_id).run();
    if(!x.meta?.changes)return json({ok:false,error:'no_credits',checkoutUrl:'/checkout.html?plan=five-monthly'},402);
    await ctx.env.DB.prepare('INSERT INTO generation_events (id,user_id,plan,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),s.user_id,plan,now).run();
    const e=await ctx.env.DB.prepare('SELECT credits_remaining FROM entitlements WHERE user_id=?').bind(s.user_id).first();
    return json({ok:true,plan,creditsRemaining:Number(e?.credits_remaining||0),validUntil});
  }

  return json({ok:false,error:'no_active_plan',checkoutUrl:'/checkout.html'},402);
}
