import{c as e,p as t,r as n}from"./ui-6TAKeGb6.js";import{D as r,E as i,M as a,O as o,S as s,T as c,_ as l,a as u,c as d,i as f,n as p,r as m,u as h,x as g,y as _}from"./ui-favbar-Da2Flpba.js";import{a as v,i as y,n as b,r as x,t as S}from"./index-D8qwxQwj.js";var C=null;function w(){document.querySelectorAll(`.bm-item`).forEach(e=>e.classList.remove(`bm-drop-before`,`bm-drop-after`,`bm-drop-inside`,`bm-dragging`))}function T(e,t,n){let r=t.getBoundingClientRect(),i=e.clientY-r.top,a=r.height;return i<a*.28?`before`:i>a*.72?`after`:n?`inside`:i<a*.5?`before`:`after`}function E(e,t,n){e.setAttribute(`draggable`,`true`),e.addEventListener(`dragstart`,n=>{C=t,n.dataTransfer.effectAllowed=`move`,n.dataTransfer.setData(`text/plain`,t),setTimeout(()=>e.classList.add(`bm-dragging`),0)}),e.addEventListener(`dragend`,()=>{C=null,w()}),e.addEventListener(`dragover`,r=>{if(!C||C===t)return;r.preventDefault(),r.dataTransfer.dropEffect=`move`,w();let i=T(r,e,n);e.classList.add(i===`before`?`bm-drop-before`:i===`after`?`bm-drop-after`:`bm-drop-inside`)}),e.addEventListener(`dragleave`,t=>{e.contains(t.relatedTarget)||e.classList.remove(`bm-drop-before`,`bm-drop-after`,`bm-drop-inside`)}),e.addEventListener(`drop`,r=>{if(!C)return;r.preventDefault(),r.stopPropagation();let o=C;C=null;let s=T(r,e,n);w(),o!==t&&(_(i(l,o,t,s)),a(l),p(),m(),f())})}function D(e,t,n){e.innerHTML=`<input class="bm-rename-input" value="${k(t)}">`;let r=e.querySelector(`input`);r.focus(),r.select();let i=()=>{let i=r.value.trim()||t;_(o(l,n,i)),a(l),p(),m(),e.textContent=i};r.addEventListener(`blur`,i),r.addEventListener(`keydown`,n=>{n.key===`Enter`&&(n.stopPropagation(),i()),n.key===`Escape`&&(n.stopPropagation(),e.textContent=t)})}function O(e,t,i){for(let o of t)if(o.type===`folder`){let t=document.createElement(`div`);t.className=`bm-wrapper`,t.innerHTML=`
        <div class="bm-item" data-id="${o.id}" style="padding-left:${8+i*18}px">
          <span class="bm-item-chevron open"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5 8 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>
          <span class="bm-item-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".6"/></svg></span>
          <span class="bm-item-name">${k(o.name)}</span>
          <span class="bm-item-count">${o.children.length}</span>
          <div class="bm-item-actions">
            <button class="bm-action-btn bm-rename" title="Renommer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9h1.5L8.5 3.5 7 2 1.5 7.5V9zM10 1L11 2l-1 1-1-1 1-1z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="bm-action-btn bm-delete" title="Supprimer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.75 7h5.5l.75-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg></button>
          </div>
        </div>
        <div class="bm-folder-children"></div>`,e.appendChild(t);let n=t.querySelector(`.bm-item`),s=t.querySelector(`.bm-folder-children`);O(s,o.children,i+1),E(n,o.id,!0),n.addEventListener(`contextmenu`,e=>u(e,o.id));let c=t.querySelector(`.bm-item-chevron`);c.addEventListener(`click`,e=>{e.stopPropagation();let t=c.classList.toggle(`open`);s.style.display=t?``:`none`,c.innerHTML=t?`<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5 8 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`:`<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5 3.5 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`}),t.querySelector(`.bm-rename`).addEventListener(`click`,e=>{e.stopPropagation(),D(t.querySelector(`.bm-item-name`),o.name,o.id)}),t.querySelector(`.bm-delete`).addEventListener(`click`,e=>{e.stopPropagation(),_(r(l,o.id)),a(l),p(),m(),t.remove()})}else{let t=document.createElement(`div`);t.innerHTML=`
        <div class="bm-item" data-id="${o.id}" style="padding-left:${8+i*18}px">
          <span class="bm-item-icon"><img src="${n(o.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'"></span>
          <span class="bm-item-name">${k(o.title)}</span>
          <span class="bm-item-url">${k(o.url)}</span>
          <div class="bm-item-actions">
            <button class="bm-action-btn bm-rename" title="Renommer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9h1.5L8.5 3.5 7 2 1.5 7.5V9zM10 1L11 2l-1 1-1-1 1-1z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="bm-action-btn bm-delete" title="Supprimer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.75 7h5.5l.75-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg></button>
          </div>
        </div>`,e.appendChild(t);let s=t.querySelector(`.bm-item`);E(s,o.id,!1),s.addEventListener(`contextmenu`,e=>u(e,o.id)),s.addEventListener(`click`,e=>{e.target.closest(`.bm-item-actions`)||(d(),h(o.url))}),t.querySelector(`.bm-rename`).addEventListener(`click`,e=>{e.stopPropagation(),D(t.querySelector(`.bm-item-name`),o.title,o.id)}),t.querySelector(`.bm-delete`).addEventListener(`click`,e=>{e.stopPropagation(),_(r(l,o.id)),a(l),p(),m(),t.remove()})}}function k(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function A(n){n.innerHTML=`
    <h2 class="ap-page-title">${t(`settings.favoris`)}</h2>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn-outline" id="ap-bm-new-folder">${t(`settings.new_folder`)}</button>
      <button class="btn-outline" id="ap-bm-import">${t(`settings.import_btn`)}</button>
      <button class="btn-outline" id="ap-bm-export">${t(`settings.export_btn`)}</button>
    </div>
    <div id="ap-bm-tree" class="bm-tree"></div>`,O(n.querySelector(`#ap-bm-tree`),l.bookmarks,0),n.querySelector(`#ap-bm-new-folder`).addEventListener(`click`,async()=>{let r=prompt(`Nom du dossier :`);r&&(_(g(l,r.trim())),a(l),p(),m(),A(n),e(t(`toast.folder_created`),`success`))}),n.querySelector(`#ap-bm-import`).addEventListener(`click`,async()=>{let r=await x(`.html,.htm`);if(!r)return;let i=y(r);_(c(l,i)),a(l),p(),m(),A(n),e(`${t(`toast.imported`)} (${s(i)})`,`success`)}),n.querySelector(`#ap-bm-export`).addEventListener(`click`,()=>b(l.bookmarks))}function j(n){n.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 class="ap-page-title" style="margin:0">${t(`settings.historique`)}</h2>
      <button class="btn-outline" id="ap-clear-hist" style="color:var(--accent-rose)">${t(`settings.clear_history`)}</button>
    </div>
    <div id="ap-hist-list"></div>`;let r=n.querySelector(`#ap-hist-list`);M(r),n.querySelector(`#ap-clear-hist`).addEventListener(`click`,()=>{confirm(t(`settings.clear_confirm`))&&(_({...l,history:[]}),a(l),M(r),e(t(`toast.history_cleared`)))})}function M(e){if(e.innerHTML=``,l.history.length===0){e.innerHTML=`<p style="color:var(--text-muted);font-size:13px;padding:16px 0">Aucun historique.</p>`;return}let t=new Map;for(let e of l.history.slice(0,200)){let n=new Date(e.visitedAt),r=new Date,i=new Date(r);i.setDate(r.getDate()-1);let a=n.toDateString()===r.toDateString()?`Aujourd'hui`:n.toDateString()===i.toDateString()?`Hier`:n.toLocaleDateString(`fr-FR`,{weekday:`long`,day:`numeric`,month:`long`});t.has(a)||t.set(a,[]),t.get(a).push(e)}t.forEach((t,r)=>{let i=document.createElement(`div`);i.className=`history-group-date`,i.textContent=r,e.appendChild(i);for(let r of t){let t=new Date(r.visitedAt).toLocaleTimeString(`fr-FR`,{hour:`2-digit`,minute:`2-digit`}),i=document.createElement(`div`);i.className=`history-item`,i.innerHTML=`
        <span class="history-item-time">${t}</span>
        <img class="history-item-icon" src="${n(r.url)}" width="16" height="16" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="history-item-info">
          <div class="history-item-title">${P(r.title||r.url)}</div>
          <div class="history-item-url">${P(r.url)}</div>
        </div>
        <button class="history-item-del" data-id="${r.id}" title="Supprimer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>`,i.addEventListener(`click`,e=>{e.target.closest(`.history-item-del`)||(d(),h(r.url))}),i.querySelector(`.history-item-del`).addEventListener(`click`,e=>{e.stopPropagation(),_({...l,history:l.history.filter(e=>e.id!==r.id)}),a(l),i.remove()}),e.appendChild(i)}})}function N(n){n.innerHTML=`
    <h2 class="ap-page-title">${t(`settings.securite`)}</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${t(`settings.passwords_hint`)}</p>
    <button class="btn-outline" id="ap-pw-add-btn" style="margin-bottom:14px;display:inline-flex;align-items:center;gap:6px">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Ajouter manuellement
    </button>
    <div id="ap-pw-add-form" class="pw-add-form" style="display:none;max-width:560px;margin-bottom:14px">
      <div class="pw-add-row">
        <input type="text"     id="ap-pw-f-domain" class="setting-input" placeholder="Domaine (ex: github.com)" autocomplete="off"/>
        <input type="text"     id="ap-pw-f-user"   class="setting-input" placeholder="Identifiant / Email" autocomplete="off"/>
        <input type="password" id="ap-pw-f-pass"   class="setting-input" placeholder="Mot de passe"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-primary"   id="ap-pw-f-ok">Enregistrer</button>
        <button class="btn-secondary" id="ap-pw-f-cancel">Annuler</button>
      </div>
    </div>
    <div id="ap-pw-list" class="pw-list" style="max-width:560px"></div>`;let r=n.querySelector(`#ap-pw-add-form`),i=n.querySelector(`#ap-pw-f-domain`),o=n.querySelector(`#ap-pw-f-user`),s=n.querySelector(`#ap-pw-f-pass`);n.querySelector(`#ap-pw-add-btn`).addEventListener(`click`,()=>{r.style.display=``,i.focus()}),n.querySelector(`#ap-pw-f-cancel`).addEventListener(`click`,()=>{r.style.display=`none`,i.value=``,o.value=``,s.value=``}),n.querySelector(`#ap-pw-f-ok`).addEventListener(`click`,async()=>{let c=i.value.trim().replace(/^https?:\/\//,``).replace(/\/.*$/,``),u=o.value.trim(),d=s.value;if(!c||!u||!d){e(`Remplissez tous les champs`);return}_({...l,passwords:await v(l.passwords,c,u,d)}),a(l),r.style.display=`none`,i.value=``,o.value=``,s.value=``,S(n.querySelector(`#ap-pw-list`)),e(t(`toast.pw_saved`),`success`)}),S(n.querySelector(`#ap-pw-list`))}function P(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}export{A as renderPageFavoris,j as renderPageHistorique,N as renderPageSecurite};