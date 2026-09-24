(() => {
  const PLANS = {
    '3-storyboards': {usd: 1, label: '3 Storyboard Generations', cadence: 'one-time'},
    'unlimited-monthly': {usd: 7.99, label: 'Unlimited Storyboard Generation', cadence: '/month'}
  };
  const COUNTRY_CURRENCY = {
    PH:'PHP',US:'USD',CA:'CAD',GB:'GBP',AU:'AUD',NZ:'NZD',SG:'SGD',MY:'MYR',ID:'IDR',TH:'THB',VN:'VND',JP:'JPY',KR:'KRW',IN:'INR',AE:'AED',SA:'SAR',QA:'QAR',KW:'KWD',BH:'BHD',OM:'OMR',HK:'HKD',TW:'TWD',CN:'CNY',MX:'MXN',BR:'BRL',AR:'ARS',CL:'CLP',CO:'COP',PE:'PEN',ZA:'ZAR',NG:'NGN',KE:'KES',EG:'EGP',TR:'TRY',CH:'CHF',NO:'NOK',SE:'SEK',DK:'DKK',PL:'PLN',CZ:'CZK',HU:'HUF',RO:'RON',BG:'BGN',IS:'ISK',IL:'ILS',PK:'PKR',BD:'BDT',LK:'LKR',NP:'NPR'
  };
  const EURO = new Set(['AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES']);
  const supported=['USD','PHP','EUR','GBP','CAD','AUD','NZD','SGD','MYR','IDR','THB','VND','JPY','KRW','INR','AED','SAR','HKD','TWD','CNY','MXN','BRL','CHF','NOK','SEK','DKK','PLN','CZK','HUF','RON','ZAR'];
  const locale = navigator.language || 'en-US';
  let current={country:null,currency:'USD',rate:1,source:'base',updatedAt:null,loading:false};

  function inferRegion(){
    try { return new Intl.Locale(locale).region || null; } catch(e) {}
    const m=locale.match(/-([A-Z]{2})$/i); return m?m[1].toUpperCase():null;
  }
  function currencyForCountry(c){ if(!c) return 'USD'; c=c.toUpperCase(); if(EURO.has(c)) return 'EUR'; return COUNTRY_CURRENCY[c] || 'USD'; }
  function fmt(amount,currency){
    try { return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:['JPY','KRW','VND','IDR'].includes(currency)?0:2}).format(amount); }
    catch(e){ return currency+' '+amount.toFixed(2); }
  }
  async function fetchRate(currency){
    if(currency==='USD') return {rate:1,updatedAt:new Date().toISOString(),source:'base'};
    try {
      const r=await fetch(`/api/localize?currency=${encodeURIComponent(currency)}`,{headers:{'accept':'application/json'}});
      if(r.ok){const j=await r.json(); if(Number(j.rate)>0) return {rate:Number(j.rate),updatedAt:j.updatedAt||new Date().toISOString(),source:'cloudflare'};}
    } catch(e){}
    try {
      const r=await fetch(`https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(currency)}`);
      if(r.ok){const j=await r.json(); if(j.rates && Number(j.rates[currency])>0) return {rate:Number(j.rates[currency]),updatedAt:j.date?j.date+'T00:00:00Z':new Date().toISOString(),source:'frankfurter'};}
    } catch(e){}
    return null;
  }
  async function detect(){
    let country=null,currency=null,rate=null,updatedAt=null,source='locale';
    try {
      const r=await fetch('/api/localize',{headers:{'accept':'application/json'}});
      if(r.ok){const j=await r.json(); country=j.country||null; currency=j.currency||null; rate=Number(j.rate)||null; updatedAt=j.updatedAt||null; source='cloudflare';}
    } catch(e){}
    if(!country) country=inferRegion();
    if(!currency) currency=currencyForCountry(country);
    if(!supported.includes(currency)) currency='USD';
    if(!(rate>0)){const rr=await fetchRate(currency); if(rr){rate=rr.rate; updatedAt=rr.updatedAt; source=rr.source;}}
    if(!(rate>0)){currency='USD';rate=1;source='fallback';updatedAt=new Date().toISOString();}
    current={country,currency,rate,source,updatedAt,loading:false};
    render();
  }
  async function setCurrency(currency){
    if(!supported.includes(currency)) currency='USD';
    current={...current,currency,loading:true};
    render();
    const rr=await fetchRate(currency);
    if(rr && rr.rate>0){
      current={...current,currency,rate:rr.rate,updatedAt:rr.updatedAt,source:rr.source||'manual',loading:false};
    } else {
      current={...current,currency:'USD',rate:1,updatedAt:new Date().toISOString(),source:'fallback',loading:false};
    }
    render();
  }
  function render(){
    document.querySelectorAll('[data-plan-local]').forEach(el=>{
      const id=el.dataset.planLocal,p=PLANS[id]; if(!p)return;
      if(current.loading){el.textContent='Updating…';return;}
      const converted=p.usd*current.rate;
      el.textContent=fmt(converted,current.currency)+(p.cadence==='/month'?'/month':'');
    });
    document.querySelectorAll('[data-plan-base]').forEach(el=>{
      const id=el.dataset.planBase,p=PLANS[id]; if(!p)return;
      el.textContent=current.currency==='USD' ? 'Billing price' : `Base price: ${fmt(p.usd,'USD')}${p.cadence==='/month'?'/month':''}`;
    });
    document.querySelectorAll('[data-local-currency]').forEach(el=>el.textContent=current.currency);
    document.querySelectorAll('[data-local-note]').forEach(el=>{
      if(current.loading){el.textContent=`Updating ${current.currency} exchange rate…`;return;}
      const stamp=current.updatedAt?new Date(current.updatedAt).toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'}):'latest available rate';
      el.textContent=current.currency==='USD' ? 'Prices are shown in USD.' : `Live estimate in ${current.currency} using 1 USD = ${current.rate.toLocaleString(locale,{maximumFractionDigits:6})} ${current.currency}. Rate updated ${stamp}. Final charged amount is confirmed by the payment provider.`;
    });
    document.querySelectorAll('select[data-currency-select]').forEach(sel=>{if(!sel.options.length){supported.forEach(c=>sel.add(new Option(c,c))); sel.addEventListener('change',()=>setCurrency(sel.value));} sel.value=current.currency; sel.disabled=current.loading;});
    window.dispatchEvent(new CustomEvent('pupscene:pricing',{detail:{...current,plans:PLANS}}));
  }
  window.PupScenePricing={PLANS,get state(){return current},setCurrency,fmt,detect};
  detect();
})();