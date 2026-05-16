const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ui-settings-data-BQnydlQH.js","assets/index-D8qwxQwj.js","assets/ui-favbar-Da2Flpba.js","assets/ui-6TAKeGb6.js","assets/rolldown-runtime-lhHHWwHU.js","assets/core-C09Q_N9v.js","assets/dist-js-OyBeRaEb.js","assets/index-J0yXqvMo.css","assets/ui-settings-misc-C_WFyjcX.js"])))=>i.map(i=>d[i]);
import{t as e}from"./rolldown-runtime-lhHHWwHU.js";import{a as t,d as n,f as r,p as i,t as a}from"./ui-6TAKeGb6.js";import{M as o,_ as s,d as c,h as l,l as u,m as d,n as f,p,r as m,v as h,y as g}from"./ui-favbar-Da2Flpba.js";var _=e({renderAuralisContent:()=>v});function v(e){let t=document.getElementById(`ap-content`);switch(t.innerHTML=``,p(e),e){case`apparence`:y(t);break;case`moteur`:b(t);break;case`demarrage`:x(t);break;case`favoris`:d(async()=>{let{renderPageFavoris:e}=await import(`./ui-settings-data-BQnydlQH.js`);return{renderPageFavoris:e}},__vite__mapDeps([0,1,2,3,4,5,6,7])).then(({renderPageFavoris:e})=>e(t));break;case`historique`:d(async()=>{let{renderPageHistorique:e}=await import(`./ui-settings-data-BQnydlQH.js`);return{renderPageHistorique:e}},__vite__mapDeps([0,1,2,3,4,5,6,7])).then(({renderPageHistorique:e})=>e(t));break;case`securite`:d(async()=>{let{renderPageSecurite:e}=await import(`./ui-settings-data-BQnydlQH.js`);return{renderPageSecurite:e}},__vite__mapDeps([0,1,2,3,4,5,6,7])).then(({renderPageSecurite:e})=>e(t));break;case`cache`:d(async()=>{let{renderPageCache:e}=await import(`./ui-settings-misc-C_WFyjcX.js`);return{renderPageCache:e}},__vite__mapDeps([8,2,3,4,5])).then(({renderPageCache:e})=>e(t));break;case`a-propos`:d(async()=>{let{renderPageAPropos:e}=await import(`./ui-settings-misc-C_WFyjcX.js`);return{renderPageAPropos:e}},__vite__mapDeps([8,2,3,4,5])).then(({renderPageAPropos:e})=>e(t));break;default:y(t)}}function y(e){e.innerHTML=`
    <h2 class="ap-page-title">${i(`settings.apparence`)}</h2>
    <div class="ap-group">
      <div class="ap-group-title">${i(`settings.apparence`)}</div>
      <div class="ap-row">
        <label class="ap-label" for="ap-theme">${i(`settings.theme`)}</label>
        <select id="ap-theme" class="setting-select">
          <option value="dark">${i(`settings.theme_dark`)}</option>
          <option value="light">${i(`settings.theme_light`)}</option>
          <option value="midnight">${i(`settings.theme_midnight`)}</option>
        </select>
      </div>
      <div class="ap-row">
        <label class="ap-label" for="ap-lang">${i(`settings.language`)}</label>
        <select id="ap-lang" class="setting-select">
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
      <div class="ap-row ap-row--toggle">
        <label class="ap-label" for="ap-favbar">${i(`settings.favbar`)}</label>
        <label class="toggle"><input type="checkbox" id="ap-favbar"><span class="toggle-track"></span></label>
      </div>
    </div>
    <div class="ap-group">
      <div class="ap-group-title">${i(`settings.shortcuts`)}</div>
      <div class="ap-shortcuts">
        <div class="ap-shortcut-row"><kbd>Ctrl+L</kbd><span>Barre d'adresse</span></div>
        <div class="ap-shortcut-row"><kbd>Ctrl+T</kbd><span>Nouvel onglet</span></div>
        <div class="ap-shortcut-row"><kbd>Ctrl+W</kbd><span>Fermer l'onglet</span></div>
        <div class="ap-shortcut-row"><kbd>Ctrl+R</kbd><span>Recharger</span></div>
        <div class="ap-shortcut-row"><kbd>Alt+←</kbd><span>Précédent</span></div>
        <div class="ap-shortcut-row"><kbd>Alt+→</kbd><span>Suivant</span></div>
      </div>
    </div>`;let d=e.querySelector(`#ap-theme`),p=e.querySelector(`#ap-lang`),_=e.querySelector(`#ap-favbar`);d.value=s.theme,p.value=s.language,_.checked=s.showFavoritesBar,d.addEventListener(`change`,()=>{g({...s,theme:d.value}),o(s),a(s.theme)}),p.addEventListener(`change`,()=>{g({...s,language:p.value}),o(s),r(s.language),n(),c(h.getAll(),h.getActiveId()),f(),m(),y(e)}),_.addEventListener(`change`,()=>{g({...s,showFavoritesBar:_.checked}),o(s),t(s.showFavoritesBar),l.updateBounds(!u())})}function b(e){e.innerHTML=`
    <h2 class="ap-page-title">${i(`settings.moteur`)}</h2>
    <div class="ap-group">
      <div class="ap-group-title">${i(`settings.moteur`)}</div>
      <div class="ap-row">
        <label class="ap-label" for="ap-engine">${i(`settings.engine`)}</label>
        <select id="ap-engine" class="setting-select">
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
          <option value="brave">Brave Search</option>
          <option value="startpage">Startpage</option>
        </select>
      </div>
    </div>`;let t=e.querySelector(`#ap-engine`);t.value=s.searchEngine,t.addEventListener(`change`,()=>{g({...s,searchEngine:t.value}),o(s)})}function x(e){let t=s.homepage===`about:newtab`?``:s.homepage;e.innerHTML=`
    <h2 class="ap-page-title">${i(`settings.demarrage`)}</h2>
    <div class="ap-group">
      <div class="ap-group-title">${i(`settings.homepage_url`)}</div>
      <div class="ap-row ap-row--col">
        <label class="ap-label" for="ap-homepage">${i(`settings.homepage_url`)}</label>
        <input type="text" id="ap-homepage" class="setting-input" value="${S(t)}" placeholder="about:newtab"/>
      </div>
    </div>`;let n=e.querySelector(`#ap-homepage`),r=()=>{g({...s,homepage:n.value.trim()||`about:newtab`}),o(s)};n.addEventListener(`blur`,r),n.addEventListener(`keydown`,e=>{e.key===`Enter`&&r()})}function S(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}export{_ as n,v as t};