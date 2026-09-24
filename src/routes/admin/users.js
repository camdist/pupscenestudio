import {json,requireAdmin,audit} from '../../lib/auth.js';
export async function onRequestGet(ctx){
  const a=await requireAdmin(ctx);if(a.response)return a.response;
  const url=new URL(ctx.request.url),q=(url.searchParams.get('q')||'').trim().toLowerCase(),pattern='%'+q+'%';
  const rows=await ctx.env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.status,u.created_at,u.last_login_at,e.plan,e.status entitlement_status,e.credits_remaining,e.billing_type,e.renewal_at,e.valid_until,e.subscription_id,(SELECT COUNT(*) FROM generation_events g WHERE g.user_id=u.id) generation_count FROM users u LEFT JOIN entitlements e ON e.user_id=u.id WHERE (?='' OR lower(u.email) LIKE ? OR lower(COALESCE(u.name,'')) LIKE ?) ORDER BY u.created_at DESC LIMIT 300`).bind(q,pattern,pattern).all();
  return json({ok:true,users:rows.results||[]});
}
export async function onRequestPatch(ctx){
  const a=await requireAdmin(ctx);if(a.response)return a.response;const b=await ctx.request.json();if(!b.userId)return json({ok:false,error:'user_required'},400);
  const user=await ctx.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(b.userId).first();if(!user)return json({ok:false,error:'not_found'},404);
  const status=['active','suspended','pending'].includes(b.status)?b.status:user.status;await ctx.env.DB.prepare('UPDATE users SET status=?,name=COALESCE(?,name) WHERE id=?').bind(status,b.name||null,b.userId).run();
  const ent=await ctx.env.DB.prepare('SELECT * FROM entitlements WHERE user_id=?').bind(b.userId).first();
  const plan=['free-daily','five-monthly','unlimited-monthly'].includes(b.plan)?b.plan:(ent?.plan||'free-daily');
  const es=['inactive','active','cancelled','expired','past_due'].includes(b.entitlementStatus)?b.entitlementStatus:(ent?.status||'active');
  const billingType=['free','one-time','subscription'].includes(b.billingType)?b.billingType:(ent?.billing_type||'free');
  const credits=Math.max(0,Math.floor(Number.isFinite(Number(b.creditsRemaining))?Number(b.creditsRemaining):(ent?.credits_remaining||0)));
  const renewal=b.renewalAt?Number(b.renewalAt):null,validUntil=b.validUntil?Number(b.validUntil):renewal,now=Date.now();
  await ctx.env.DB.prepare(`INSERT INTO entitlements (user_id,plan,status,credits_remaining,billing_type,renewal_at,valid_until,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,credits_remaining=excluded.credits_remaining,billing_type=excluded.billing_type,renewal_at=excluded.renewal_at,valid_until=excluded.valid_until,updated_at=excluded.updated_at`).bind(b.userId,plan,es,credits,billingType,renewal,validUntil,now).run();
  await audit(ctx,a.session.user_id,'update_user',b.userId,{status,plan,entitlementStatus:es,billingType,creditsRemaining:credits,renewalAt:renewal,validUntil});
  return json({ok:true});
}
