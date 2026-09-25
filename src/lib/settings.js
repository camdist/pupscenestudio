export async function accessRestrictionsEnabled(env){
  // Fail closed: if settings cannot be read, restrictions stay ON.
  if(!env?.DB) return true;
  try{
    const row=await env.DB.prepare("SELECT value FROM app_settings WHERE key='access_restrictions_enabled' LIMIT 1").first();
    return String(row?.value ?? '1')==='1';
  }catch(e){
    return true;
  }
}
