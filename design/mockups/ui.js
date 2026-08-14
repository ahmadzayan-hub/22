// ZAYAN OS mockups — shared chrome
const NAV_GROUPS = [
  ["Home","Dashboard","Comms","Funnel","Workflows","Social","Content","Finances"],
  ["Agents","Tasks","Skills","Org Chart"],
  ["G-Brain"],
  ["Connections","Roadmap","Analytics","Reference Model","Personas"],
];
function Sidebar(active){
  const el = document.getElementById('sidebar'); if(!el) return;
  el.className = 'sidebar';
  el.innerHTML =
    `<div class="sb-logo"><span class="sb-mark"></span><div><b>ALKAHTANI&nbsp;OS</b><i>agentic operating system</i></div></div>` +
    NAV_GROUPS.map(g => `<div class="sb-group">` + g.map(n => `
      <div class="sb-item ${n===active?'on':''}"><span class="sb-bar"></span>${n}
        ${n==='Comms' ? '<em class="sb-badge">12</em>' : ''}
        ${n==='Tasks' ? '<em class="sb-badge dim">7</em>' : ''}
      </div>`).join('') + `</div>`).join('') +
    `<div class="sb-status"><span class="led warn"></span>18/22 SYSTEMS LIVE<i>paypal · square degraded · 2 offline</i></div>`;
}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const SVGNS='http://www.w3.org/2000/svg';
function svgEl(t,a,parent){const e=document.createElementNS(SVGNS,t);for(const k in a)e.setAttribute(k,a[k]);if(parent)parent.appendChild(e);return e;}
