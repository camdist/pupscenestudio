const COUNTRY_CURRENCY={PH:'PHP',US:'USD',CA:'CAD',GB:'GBP',AU:'AUD',NZ:'NZD',SG:'SGD',MY:'MYR',ID:'IDR',TH:'THB',VN:'VND',JP:'JPY',KR:'KRW',IN:'INR',AE:'AED',SA:'SAR',QA:'QAR',KW:'KWD',BH:'BHD',OM:'OMR',HK:'HKD',TW:'TWD',CN:'CNY',MX:'MXN',BR:'BRL',AR:'ARS',CL:'CLP',CO:'COP',PE:'PEN',ZA:'ZAR',NG:'NGN',KE:'KES',EG:'EGP',TR:'TRY',CH:'CHF',NO:'NOK',SE:'SEK',DK:'DKK',PL:'PLN',CZ:'CZK',HU:'HUF',RO:'RON',BG:'BGN',IS:'ISK',IL:'ILS',PK:'PKR',BD:'BDT',LK:'LKR',NP:'NPR'};
const EURO=new Set(['AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES']);
function currencyForCountry(c){if(!c)return'USD';c=c.toUpperCase();return EURO.has(c)?'EUR':(COUNTRY_CURRENCY[c]||'USD')}
export async function onRequestGet({request}){
  const url=new URL(request.url); const country=request.cf?.country||null; const currency=(url.searchParams.get('currency')||currencyForCountry(country)).toUpperCase();
  let rate=currency==='USD'?1:null;
  if(!rate){try{const r=await fetch(`https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(currency)}`,{cf:{cacheTtl:1800,cacheEverything:true}});if(r.ok){const j=await r.json();rate=Number(j.rates?.[currency])||null;}}catch(e){}}
  return new Response(JSON.stringify({country,currency,rate,base:'USD',updatedAt:new Date().toISOString()}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900'}});
}