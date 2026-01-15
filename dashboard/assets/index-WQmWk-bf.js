(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))n(e);new MutationObserver(e=>{for(const r of e)if(r.type==="childList")for(const c of r.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&n(c)}).observe(document,{childList:!0,subtree:!0});function s(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?r.credentials="include":e.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(e){if(e.ep)return;e.ep=!0;const r=s(e);fetch(e.href,r)}})();async function o(i,t={},s){return window.__TAURI_INTERNALS__.invoke(i,t,s)}class a{constructor(){this.grid=document.getElementById("client-grid"),this.activeCountEl=document.getElementById("active-count"),this.clients=new Map,this.init()}async init(){console.log("🚀 MONITOX PRO | Neon Interface initialized"),this.addClientCard("self","MI PANTALLA (ADMIN)"),this.startSelfCapture()}async startSelfCapture(){setInterval(async()=>{try{const t=await o("capture_screen");this.updateScreen("self",t)}catch{}},1e3)}addClientCard(t,s){if(this.clients.has(t))return;const n=document.createElement("div");n.className="card",n.id=`client-${t}`,n.innerHTML=`
            <div class="card-header">
                <span class="client-name">${s}</span>
                <span class="client-status-dot"></span>
            </div>
            <div class="screen-container">
                <img src="" alt="Screen" id="img-${t}" style="display:none;">
                <div class="placeholder-overlay" id="placeholder-${t}">
                    <div class="loader"></div>
                    <span>ESTABLECIENDO ENLACE...</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary" onclick="alert('Vista completa no disponible en preview')">ENLACE DIRECTO</button>
                <button class="btn btn-danger">TERMINAR</button>
            </div>
        `,this.grid.appendChild(n),this.clients.set(t,{name:s,element:n}),this.updateStats()}updateScreen(t,s){const n=document.getElementById(`img-${t}`),e=document.getElementById(`placeholder-${t}`);n&&(n.src=s,n.style.display="block",e&&(e.style.display="none"))}updateStats(){this.activeCountEl&&(this.activeCountEl.innerText=this.clients.size)}}window.addEventListener("DOMContentLoaded",()=>{new a});
