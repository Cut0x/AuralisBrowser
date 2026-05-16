const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/dist-js-OyBeRaEb.js","assets/rolldown-runtime-lhHHWwHU.js","assets/core-C09Q_N9v.js"])))=>i.map(i=>d[i]);
import{r as e}from"./core-C09Q_N9v.js";import{c as t,p as n}from"./ui-6TAKeGb6.js";import{A as r,M as i,S as a,_ as o,m as s,n as c,r as l,y as u}from"./ui-favbar-Da2Flpba.js";function d(e){let{used:s,quota:f}=r(),p=(s/1024).toFixed(1),m=(f/(1024*1024)).toFixed(0),h=Math.min(100,s/f*100).toFixed(1),g=parseFloat(h)>80?`var(--accent-rose)`:parseFloat(h)>50?`#f0c060`:`var(--accent-violet)`;e.innerHTML=`
    <h2 class="ap-page-title">${n(`settings.cache`)}</h2>
    <div class="ap-group" style="max-width:560px">
      <div class="ap-group-title">Stockage local</div>
      <div class="storage-bar-wrap">
        <div class="storage-bar-labels"><span>${p} Ko utilisés</span><span>${h}% · quota ${m} Mo</span></div>
        <div class="storage-bar-track"><div class="storage-bar-fill" style="width:${h}%;background:${g}"></div></div>
        <div class="storage-bar-breakdown">
          <div class="storage-breakdown-item"><span class="sbi-dot" style="background:var(--accent-violet)"></span><span>Favoris (${a(o.bookmarks)} liens)</span></div>
          <div class="storage-breakdown-item"><span class="sbi-dot" style="background:#f0c060"></span><span>Historique (${o.history.length} entrées)</span></div>
          <div class="storage-breakdown-item"><span class="sbi-dot" style="background:var(--accent-rose)"></span><span>Mots de passe (${o.passwords.length})</span></div>
        </div>
      </div>
    </div>
    <div class="ap-group" style="max-width:560px;margin-top:16px">
      <div class="ap-group-title">Effacer les données</div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Sélectionnez les catégories à supprimer définitivement.</p>
      <div class="clear-cat-list">
        <label class="clear-cat-item"><input type="checkbox" id="chk-hist" checked>
          <span class="clear-cat-label"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#f0c060" stroke-width="1.1"/><path d="M7 4v3l2 2" stroke="#f0c060" stroke-width="1.1" stroke-linecap="round"/></svg>Historique de navigation</span>
          <span class="clear-cat-count">${o.history.length} entrées</span></label>
        <label class="clear-cat-item"><input type="checkbox" id="chk-bookmarks">
          <span class="clear-cat-label"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".7"/></svg>Favoris &amp; dossiers</span>
          <span class="clear-cat-count">${a(o.bookmarks)} liens</span></label>
        <label class="clear-cat-item"><input type="checkbox" id="chk-passwords">
          <span class="clear-cat-label"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="6" rx="1" stroke="var(--accent-rose)" stroke-width="1.1"/><path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="var(--accent-rose)" stroke-width="1.1" stroke-linecap="round"/></svg>Mots de passe enregistrés</span>
          <span class="clear-cat-count">${o.passwords.length}</span></label>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn-outline" id="ap-clear-selected" style="color:var(--accent-rose)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 3h10M4 3V2h5v1M2.5 3l.75 8h5.5l.75-8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
          Effacer la sélection
        </button>
        <button class="btn-outline" id="ap-clear-all" style="color:var(--accent-rose);opacity:.7;font-size:12px">Tout effacer</button>
      </div>
    </div>`;let _=e.querySelector(`#chk-hist`),v=e.querySelector(`#chk-bookmarks`),y=e.querySelector(`#chk-passwords`),b=(n,r,a)=>{let s=[n&&`historique`,r&&`favoris`,a&&`mots de passe`].filter(Boolean);!s.length||!confirm(`Effacer ${s.join(`, `)} ?`)||(n&&u({...o,history:[]}),r&&u({...o,bookmarks:[]}),a&&u({...o,passwords:[]}),i(o),r&&(c(),l()),t(`Données effacées`),d(e))};e.querySelector(`#ap-clear-selected`).addEventListener(`click`,()=>b(_.checked,v.checked,y.checked)),e.querySelector(`#ap-clear-all`).addEventListener(`click`,()=>b(!0,!0,!0))}function f(t){e(`get_version`).then(e=>{t.innerHTML=`
      <h2 class="ap-page-title">${n(`settings.a_propos`)}</h2>
      <div class="ap-group" style="max-width:480px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <svg width="38" height="38" viewBox="0 0 56 56" fill="none">
            <defs><linearGradient id="abg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--accent-rose)"/><stop offset="100%" stop-color="var(--accent-violet)"/></linearGradient></defs>
            <path d="M28 8L44 46H12L28 8z" stroke="url(#abg)" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
            <path d="M18 34h20" stroke="url(#abg)" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <div>
            <div class="ap-about-name">Auralis</div>
            <div class="ap-about-ver">v${p(e)}</div>
          </div>
        </div>
        <div class="ap-about-line">${n(`about.stack`)}</div>
        <div class="ap-about-line">${n(`about.license`)}</div>
        <div style="margin-top:12px">
          <a href="#" id="ap-github-link" class="btn-outline" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub
          </a>
        </div>
      </div>`,t.querySelector(`#ap-github-link`).addEventListener(`click`,e=>{e.preventDefault(),s(async()=>{let{openUrl:e}=await import(`./dist-js-OyBeRaEb.js`).then(e=>e.t);return{openUrl:e}},__vite__mapDeps([0,1,2])).then(({openUrl:e})=>e(`https://github.com/Cut0x/AuralisBrowser`).catch(console.error))})}).catch(()=>{t.innerHTML=`<h2 class="ap-page-title">${n(`settings.a_propos`)}</h2><p style="color:var(--text-muted)">Auralis v0.2.2</p>`})}function p(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}export{f as renderPageAPropos,d as renderPageCache};