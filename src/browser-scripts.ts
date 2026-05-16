/**
 * browser-scripts.ts — Scripts JS injectés dans la webview de contenu.
 * Chaque script est protégé par un flag pour n'être exécuté qu'une fois par page.
 */

/**
 * Capture les identifiants AVANT la navigation de formulaire (pas de preventDefault).
 * Stocke les creds dans window.name (persiste entre les pages du même onglet).
 * La page suivante lit window.name et navigue vers l'URL sentinelle auralis-pw.invalid
 * pour que Rust émette l'événement content-pw-detected.
 */
export const FORM_CAPTURE_SCRIPT = `(function(){
if(window.__a_pwcap)return;window.__a_pwcap=true;
function bd(h){var p=h.replace(/^www\\./,'').split('.');return p.length>=2?p.slice(-2).join('.'):h;}
document.addEventListener('submit',function(e){
  var f=e.target;if(!f||f.tagName!=='FORM')return;
  var pw=f.querySelector('input[type="password"]');if(!pw||!pw.value)return;
  var uf=f.querySelector('input[type="email"],input[type="text"],[autocomplete*="username"],[autocomplete*="email"],[name*="user"],[name*="email"],[name*="login"],[id*="user"],[id*="email"],[id*="login"]');
  try{var n={};try{n=JSON.parse(window.name);}catch{}
  n.__a_pw={u:uf?uf.value:'',p:pw.value,h:window.location.hostname,t:Date.now()};
  window.name=JSON.stringify(n);}catch{}
},true);
try{var n={};try{n=JSON.parse(window.name);}catch{}
if(n.__a_pw&&(Date.now()-n.__a_pw.t)<20000){var c=n.__a_pw;
if(bd(c.h)===bd(window.location.hostname)){delete n.__a_pw;window.name=JSON.stringify(n);
setTimeout(function(){try{
  var d=btoa(unescape(encodeURIComponent(JSON.stringify({u:c.u,p:c.p}))));
  window.location.href='http://auralis-pw.invalid/save?d='+encodeURIComponent(d);
}catch{}},600);}}}catch{}
})();`;

/**
 * Intercepte window.open() et les clics sur les liens target="_blank".
 * Route les URLs via l'URL sentinelle auralis-open.invalid afin que Rust
 * émette content-open-new-tab et qu'Auralis ouvre un nouvel onglet.
 */
export const NEW_TAB_SCRIPT = `(function(){
if(window.__a_ntpatch)return;window.__a_ntpatch=true;
const _open=window.open.bind(window);
window.open=function(url,target,f){
  if(url&&typeof url==='string'&&(url.startsWith('http://')||url.startsWith('https://'))){
    if(!target||target==='_blank'||target==='_new'||target==='_tab'){
      window.location.href='http://auralis-open.invalid/?url='+encodeURIComponent(url);
      return{closed:false,close:function(){},focus:function(){}};
    }
  }
  return _open(url,target,f);
};
document.addEventListener('click',function(e){
  let el=e.target;while(el&&el.tagName!=='A')el=el.parentElement;if(!el)return;
  const t=el.getAttribute('target');
  if(t&&t!=='_self'&&t!=='_top'&&t!=='_parent'){
    const h=el.href||el.getAttribute('href');
    if(h&&(h.startsWith('http://')||h.startsWith('https://'))){
      e.preventDefault();e.stopImmediatePropagation();
      window.location.href='http://auralis-open.invalid/?url='+encodeURIComponent(h);
    }
  }
},true);
})();`;
