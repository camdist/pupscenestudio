import {json,adminBootstrapPassword,ensureAuthSchema} from '../../lib/auth.js';

export async function onRequestGet(ctx){
  try{
    await ensureAuthSchema(ctx.env);
    const cols=await ctx.env.DB.prepare('PRAGMA table_info(users)').all();
    const names=new Set((cols.results||[]).map(x=>String(x.name||'')));
    return json({ok:true,databaseConfigured:true,authSchemaReady:names.has('password_hash')&&names.has('password_salt'),adminBootstrapConfigured:Boolean(adminBootstrapPassword(ctx.env))});
  }catch(e){
    console.error('auth status error',e);
    return json({ok:false,databaseConfigured:Boolean(ctx.env?.DB),authSchemaReady:false,adminBootstrapConfigured:Boolean(adminBootstrapPassword(ctx.env)),error:'auth_configuration_error'},503);
  }
}
