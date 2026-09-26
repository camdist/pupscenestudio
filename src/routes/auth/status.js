import {json,adminBootstrapPassword,ensureAuthSchema} from '../../lib/auth.js';

export async function onRequestGet(ctx){
  try{
    await ensureAuthSchema(ctx.env);
    const cols=await ctx.env.DB.prepare('PRAGMA table_info(users)').all();
    const names=new Set((cols.results||[]).map(x=>String(x.name||'')));
    const entSql=await ctx.env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='entitlements'").first();
    const sql=String(entSql?.sql||'');
    const entitlementSchemaReady=/free-daily/.test(sql)&&/five-monthly/.test(sql)&&/unlimited-monthly/.test(sql)&&/billing_type/.test(sql)&&/valid_until/.test(sql);
    return json({
      ok:true,
      databaseConfigured:true,
      authSchemaReady:names.has('password_hash')&&names.has('password_salt'),
      entitlementSchemaReady,
      adminBootstrapConfigured:Boolean(adminBootstrapPassword(ctx.env))
    });
  }catch(e){
    console.error('auth status error',e);
    return json({
      ok:false,
      databaseConfigured:Boolean(ctx.env?.DB),
      authSchemaReady:false,
      entitlementSchemaReady:false,
      adminBootstrapConfigured:Boolean(adminBootstrapPassword(ctx.env)),
      error:'auth_configuration_error'
    },503);
  }
}
