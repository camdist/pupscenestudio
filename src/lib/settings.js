export async function accessRestrictionsEnabled(env){
  if(!env?.DB) return false;
  try{
    const row=await env.DB.prepare("SELECT value FROM app_settings WHERE key='access_restrictions_enabled' LIMIT 1").first();
    return String(row?.value||'0')==='1';
  }catch(e){
    return false;
  }
}
