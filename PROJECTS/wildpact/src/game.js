'use strict';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d');

function bondRank(value){let rank=0;while(rank<10&&value>=BOND_THRESHOLDS[rank+1])rank++;return rank}
function companion(k,owner=state){return owner.companions.find(c=>c.species===k)}
function formFor(k,owner=state){return PACT_FORMS[k][companion(k,owner)?.form||'base']||PACT_FORMS[k].base}

function escapeText(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function companionDetails(k){const c=companion(k);return '<p class="muted">'+BATTLE_ROLES[k]+' · '+escapeText(c.origin)+'<br>Form: '+formFor(k).name+' · Awakening becomes available in a later chapter.</p>'}
function bondPreview(k){const rank=bondRank(state.bond[k]);if(rank===10)return '<p class="notice">Bond 10: your lasting trust has reached its full stat benefit.</p>';const now=stats(k),next=statAt(k,state.level[k],BOND_THRESHOLDS[rank+1],formFor(k));return '<p class="notice">Next bond rank: '+['hp','atk','def'].map(a=>STAT_LABELS[a]+' +'+(next[a]-now[a])).join(' · ')+'</p>'}

const MANA_START=4, MANA_CAP=10;
const initial=()=>attachCompanions({fire:fireDefaults(),curiosity:curiosityDefaults(),x:6,y:9,area:'village',facing:'down',chapter:{briefed:false,supplies:false,cache:false,lesson:false,returned:false},pactProgress:{},quest:{started:false,pair:false,guardian:false,reward:false,basket:false},mana:MANA_START,berries:2,potions:1,coins:12,party:['mouse'],active:['mouse'],version:2,bond:{mouse:0,fern:0,boar:0,moth:0,snail:0,quilcoal:0},level:{mouse:1,fern:1,boar:1,moth:1,snail:1,quilcoal:1},xp:{mouse:0,fern:0,boar:0,moth:0,snail:0,quilcoal:0},won:0,steps:0,fernMet:false,boarMet:false,shrine:false,berriesPicked:false});
let migrated=false,saveFailed=false;

let state=initial();try{state=loadState(JSON.parse(localStorage.getItem('wildpact-v2')||localStorage.getItem('wildpact-v1')))}catch{}
let modal=null,battle=null,sound=false,audioCtx=null,lastMove=0,lastActivity=null;

function say(t){$('message').textContent=t}
function beep(f=500){if(!sound)return;try{audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.14);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.15)}catch{}}
const used=()=>state.active.reduce((n,k)=>n+species[k].cost,0);
const MAX_LEVEL=20;
const xpNeeded=level=>30+(level-1)*15;
function statAt(k,level,bondValue,form=PACT_FORMS[k].base){
 const s=species[k],growth=s.growth,trained={},bonus={},formBonus={},out={},rank=bondRank(bondValue);
 for(const stat of ['hp','atk','def','spd']){trained[stat]=s[stat]+(level-1)*growth[stat];bonus[stat]=Math.round(trained[stat]*(BOND_GROWTH[k][stat]||0)*BOND_SHAPE[rank]);const value=trained[stat]+bonus[stat];out[stat]=Math.max(1,Math.round(value*(form.stats[stat]??1)));formBonus[stat]=out[stat]-value;}
 return {...out,trained,bonus,formBonus,growth,nature:form.nature,movesKey:form.movesKey,passive:form.passive};
}
function stats(k){ensureCompanions();return statAt(k,state.level[k],state.bond[k],formFor(k))}
function bond(keys,n){ensureCompanions();keys.forEach(k=>{const before=bondRank(state.bond[k]);state.bond[k]=Math.min(100,state.bond[k]+n);const after=bondRank(state.bond[k]);if(after>before){state.bondNotice=species[k].name+' reached Bond '+after+'/10! Open the party journal to see the stat gains.';say(state.bondNotice);beep(760)}})}

function activity(keys=state.active,now=performance.now()){
 if(document.hidden){lastActivity=null;return}
 if(lastActivity!==null){const seconds=Math.max(0,Math.min(10,(now-lastActivity)/1000));bond(keys,seconds/180)}
 lastActivity=now;
}
function gainXP(k,amount){
 const before=stats(k),oldLevel=state.level[k];state.xp[k]+=amount;
 while(state.level[k]<MAX_LEVEL&&state.xp[k]>=xpNeeded(state.level[k])){state.xp[k]-=xpNeeded(state.level[k]);state.level[k]++;}
 if(state.level[k]===MAX_LEVEL)state.xp[k]=0;
 const after=stats(k);return `${species[k].name}: +${amount} XP`+(state.level[k]>oldLevel?` — Level ${oldLevel} → ${state.level[k]}! HP +${after.hp-before.hp}, ATK +${after.atk-before.atk}, DEF +${after.def-before.def}, SPD +${after.spd-before.spd}.`:` (${state.xp[k]}/${xpNeeded(state.level[k])}).`);
}
function growthBars(k){const level=state.level[k],xp=state.xp[k],b=state.bond[k],rank=bondRank(b),start=BOND_THRESHOLDS[rank],end=BOND_THRESHOLDS[Math.min(10,rank+1)];return `<div class="growth-label"><b>Level ${level}</b><span>${level===MAX_LEVEL?'Maximum level':`${xp} / ${xpNeeded(level)} XP`}</span></div><progress class="xp-meter" aria-label="${species[k].name} experience" value="${level===MAX_LEVEL?1:xp}" max="${level===MAX_LEVEL?1:xpNeeded(level)}"></progress><div class="growth-label"><b>Bond ${rank} / 10</b><span>${rank===10?'Lasting trust':Math.floor((b-start)/(end-start)*100)+'% to rank '+(rank+1)}</span></div><progress class="bond-meter" aria-label="${species[k].name} progress to next bond rank" value="${rank===10?1:b-start}" max="${rank===10?1:end-start}"></progress>`}

function showParty(selected=state.party[0]){
 if(battle||(modal&&modal!=='party'))return;modal='party';lastActivity=null;render();
 const k=selected,s=species[k],t=stats(k),l=state.level[k];
 $('partySheet').hidden=false;$('partySheet').innerHTML=`<section class="party-window" role="dialog" aria-modal="true" aria-labelledby="partyTitle"><div class="panelhead"><div><p class="eyebrow">YOUR TRAVELING COMPANIONS</p><h2 id="partyTitle">Pact journal</h2></div><button id="closeParty">Return to adventure · Esc</button></div><div class="party-layout"><nav aria-label="Choose companion">${state.party.map(id=>`<button class="party-tab ${id===k?'selected':''}" data-companion="${id}" aria-pressed="${id===k}">${spriteHTML(id)}<span><strong>${species[id].name}</strong><br>Level ${state.level[id]} · ${species[id].cost} mana<br>${state.active.includes(id)?'Summoned':'Resting in reserve'}</span></button>`).join('')}</nav><article><div class="portrait">${spriteHTML(k)}<div><h2>${s.name}</h2><p>${s.role}</p><p>${s.desc}</p></div></div>${companionDetails(k)}${partyControls(k)}${growthBars(k)}${bondPreview(k)}<p class="muted">Levels grow through battles and discoveries. Bond grows slowly through active adventuring and completed battles. Only summoned companions gain bond; it never decays. The first rank takes roughly 6 minutes of active play, less with battles.</p><table><caption>Where your stats come from</caption><thead><tr><th>Stat</th><th>Species</th><th>Levels</th><th>Bond</th><th>Form</th><th>Total</th></tr></thead><tbody>${['hp','atk','def','spd'].map(stat=>`<tr><th>${STAT_LABELS[stat]}</th><td>${s[stat]}</td><td>+${(l-1)*t.growth[stat]}</td><td class="gold">+${t.bonus[stat]}</td><td>${t.formBonus[stat]>=0?'+':''}${t.formBonus[stat]}</td><td><strong>${t[stat]}</strong></td></tr>`).join('')}</tbody></table><p class="muted">Speed comes from species and levels; bond boosts HP, Attack, and Defense. Fully recovered outside battles. Mana stays at ${s.cost}, regardless of level or bond.</p><div class="ability"><b>${moves[k].basic}</b><p>Basic attack · 100% Attack, neutral physical damage before Defense · always available.</p><b>${moves[k].special}</b><p>${moves[k].desc} Unavailable for 2 rounds after use.</p></div>${wheelHTML()}<details><summary>See long-term potential (preview only)</summary><p>At the same level, a familiar companion gains real strength. This comparison does not change your save.</p><table><thead><tr><th>Level 12</th><th>Fresh pact</th><th>Bond 10</th></tr></thead><tbody>${Object.keys(species).map(id=>`<tr><th>${species[id].name}</th><td>${statAt(id,12,0).hp} HP / ${statAt(id,12,0).atk} ATK / ${statAt(id,12,0).def} DEF</td><td>${statAt(id,12,100).hp} HP / ${statAt(id,12,100).atk} ATK / ${statAt(id,12,100).def} DEF</td></tr>`).join('')}</tbody></table><p class="muted">Bond 10 targets roughly 5 hours of active play before battle bonuses. Bond gains vary by species to help early companions stay competitive. This clearing is not a full campaign; pacing and late-game balance still need playtesting.</p></details></article></div></section>`;
 $('partyToggle').onclick=()=>toggle(k);if($('soloSummon'))$('soloSummon').onclick=()=>summonAlone(k);$('closeParty').onclick=closeParty;document.querySelectorAll('[data-companion]').forEach(btn=>btn.onclick=()=>showParty(btn.dataset.companion));paintSprites();$('closeParty').focus();
}
function closeParty(){if(modal!=='party')return;$('partySheet').hidden=true;modal=null;lastActivity=null;render();$('partyButton').focus()}
function baseSprite(c,k,x,y,scale=2,back=false){c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);const r=(a,b,w,h,col)=>{c.fillStyle=col;c.fillRect(a,b,w,h)};r(-10,9,20,3,'#14291a66');if(k==='mouse'){r(5,0,8,3,'#ac8d59');r(10,-4,3,6,'#eed9a0');r(-8,-6,15,14,'#71573f');r(-7,-7,14,13,'#d9bd7e');r(-9,-12,5,7,'#d9bd7e');r(3,-12,5,7,'#d9bd7e');r(-8,-11,3,4,'#c78f85');r(4,-11,3,4,'#c78f85');r(-4,3,7,4,'#f0dfb3');r(-7,7,4,3,'#a88452');r(3,7,4,3,'#a88452');if(!back){r(-5,-3,2,3,'#253426');r(3,-3,2,3,'#253426');r(-1,1,2,2,'#8a5d53');r(-11,0,5,1,'#f6e9b3');r(6,0,5,1,'#f6e9b3')}}else if(k==='fern'){r(-5,-2,10,11,'#74894d');r(-4,1,8,7,'#b4bd76');r(-6,8,4,3,'#587342');r(3,8,4,3,'#587342');r(-2,-11,3,13,'#668744');r(-10,-9,8,4,'#93b96c');r(-12,-12,6,4,'#a8cc7d');r(1,-8,9,4,'#81ac5b');r(7,-12,5,5,'#aad079');r(-5,-15,5,6,'#96bf68');if(!back){r(-3,2,2,2,'#293c2c');r(3,2,2,2,'#293c2c');r(0,5,2,1,'#795f43')}}else if(k==='boar'){r(-12,-5,23,13,'#745346');r(-11,-6,21,13,'#b58b73');r(-9,-10,5,6,'#98715b');r(5,-10,5,6,'#98715b');r(-7,-8,13,4,'#536546');r(-4,-11,3,5,'#6d8050');r(2,-10,3,5,'#7b8d56');r(-9,7,5,4,'#624b40');r(5,7,5,4,'#624b40');if(!back){r(-7,-2,2,3,'#263328');r(6,-2,2,3,'#263328');r(-4,2,9,5,'#d1aa8d');r(-2,3,2,2,'#785648');r(2,3,2,2,'#785648')}}else{r(-5,6,4,5,'#344c48');r(2,6,4,5,'#344c48');r(-6,-1,12,9,'#c2935b');r(-8,0,3,6,'#dbbf96');r(6,0,3,6,'#dbbf96');r(-5,-9,10,9,'#e6c59b');r(-6,-11,12,4,'#394e48');r(-8,-8,16,3,'#4e6758');r(0,-2,7,2,'#dcb56c');if(!back){r(-3,-5,1,2,'#27372e');r(3,-5,1,2,'#27372e')}}c.restore()}
const WHISK_SPRITE="./assets/pacts/whisk/battle.png";
const FROND_SPRITE="./assets/pacts/frond/battle.png";
const BRAMBLE_SPRITE="./assets/pacts/bramble/battle.png";
const GLIM_SPRITE="./assets/pacts/glim/battle.png";
const DEWDROP_SPRITE="./assets/pacts/dewdrop/battle.png";
const QUILCOAL_SPRITE="./assets/pacts/quilcoal/battle.png";
const BATTLE_ART={quilcoal:QUILCOAL_SPRITE,mouse:WHISK_SPRITE,fern:FROND_SPRITE,boar:BRAMBLE_SPRITE,moth:GLIM_SPRITE,snail:DEWDROP_SPRITE};
function spriteHTML(k,facing="right"){if(BATTLE_ART[k])return `<span class="sprite sprite-art"><img src="${BATTLE_ART[k]}" width="96" height="96" alt="${species[k].name} pixel sprite" class="${facing==='left'?'face-left':''}" draggable="false"></span>`;return `<canvas class="sprite" width="64" height="64" data-sprite="${k}" aria-label="${species[k].name} pixel sprite"></canvas>`}
function paintSprites(){document.querySelectorAll('[data-sprite]').forEach(c=>sprite(c.getContext('2d'),c.dataset.sprite,32,36,2))}
function manaReadout(capacity,reserved){
 const free=capacity-reserved;
 const nodes=Array.from({length:capacity},(_,i)=>'<i class="mana-node'+(i<free?' free':'')+'"></i>').join('');
 return '<span>Mana '+free+'/'+capacity+' free</span><span class="mana-nodes" aria-hidden="true">'+nodes+'</span>';
}
function render(){save();$('manaReadout').innerHTML=manaReadout(state.mana,used());$('resources').textContent=`${state.berries} berries · ${state.potions} draughts · ${state.coins} coins`;$('quests').innerHTML=[[true,'Meet Whisk, your first companion'],[state.party.includes('fern'),'Earn Frond’s trust by the pond'],[state.won>0,'Win a woodland battle'],[state.party.includes('boar'),'Make a pact with Bramble'],[state.shrine,'Awaken the old mana stone']].map(([b,t])=>`<div class="quest ${b?'done':''}">${b?'✓':'○'} &nbsp;${t}</div>`).join('');$('partyButton').disabled=!!modal;$('saveNote').textContent=saveFailed?'Browser saving is unavailable. Keep this page open to retain this session.':'Progress saves in this browser. Export a save before changing files or devices.';expeditionJournal();fireJournal();if($('quests').insertAdjacentHTML)$('quests').insertAdjacentHTML('beforeend',beeJournal()+rabbitJournal()+cubJournal());else $('quests').innerHTML+=beeJournal()+rabbitJournal()+cubJournal();paintSprites();}
function toggle(k){if(battle||(modal&&modal!=='party')||!state.party.includes(k))return;const i=state.active.indexOf(k);if(i>=0)state.active.splice(i,1);else if(used()+species[k].cost>state.mana){say(`Not enough free mana for ${species[k].name}. Dismiss a companion first.`);return}else if(state.active.length>=3){say('Three companions can be active at once.');return}else state.active.push(k);lastActivity=null;beep();render();if(modal==='party')showParty(k)}

function open(title,text,choices){modal='dialog';$('overlay').hidden=false;$('overlay').innerHTML=`<div class="dialog"><p class="eyebrow">MOSSMERE · FIELD ENCOUNTER</p><h2>${title}</h2><p>${text}</p><div class="actions"></div></div>`;choices.forEach(([label,fn,disabled])=>{const b=document.createElement('button');b.textContent=label;b.disabled=!!disabled;b.onclick=fn;$('overlay').querySelector('.actions').append(b)});render()}
function close(){lastActivity=null;modal=null;$('overlay').hidden=true;render();canvas.focus()}
function pact(k,celebrate=false){
 if(!species[k])return;if(state.party.includes(k)){ownedEncounter(k);return}const isNew=true;
 if(isNew){state.party.push(k);state.level[k]=Math.max(state.level[k],Math.min(4,state.quest.guardian?3:state.fire.supplies?2:1));ensureCompanions();companion(k).origin=k==='boar'&&state.curiosity.bonded?'Rescued from the berry thicket':k==='boar'&&pactMemory(k).proven?'Earned trust through a challenge':k==='snail'&&pactMemory(k).helpDone?'Helped restore the water channel':k==='quilcoal'?'Calmed in the Old Grove':k==='fern'?'Befriended beside the clearing pond':'Befriended in the Overgrown Orchard';}
 if(!state.active.includes(k)&&used()+species[k].cost<=state.mana&&state.active.length<3)state.active.push(k);
 const active=state.active.includes(k),s=species[k];
 say('Pact formed with '+s.name+'! '+(active?'They are now summoned.':'They are waiting in your roster.'));beep(800);
 open(isNew||celebrate?'Pact formed!':s.name+' is your companion',
 '<span class="pact-celebration">'+spriteHTML(k)+'<strong>'+s.name+' has joined you!</strong><span>'+s.desc+'</span><span>Level '+state.level[k]+' · '+s.cost+' mana to summon</span><span>'+(active?'Summoned and ready to travel beside you.':'Added to your roster. Open your party to make room and summon them.')+'</span></span>',
 [['Meet your companion',()=>{close();showParty(k)}],['Continue exploring',close]]);
 $('overlay').querySelector('button')?.focus();
}
function clearingInteract(){if(modal)return;const p=nearest();if(!p){say('Walk beside a creature, the tent, berry bush, or glowing stone, then press E.');return}if(p.type==='camp'){rest();return}if(p.type==='berries'){if(state.berriesPicked)say('This bush is picked clean. Pip sells berries in Mossmere.');else{state.berries+=2;state.berriesPicked=true;say('Gathered 2 berries. Keep them for creatures or brew a healing draught at Pip’s.');render()}return}if(p.type==='shrine'){if(state.shrine){say('The stone hums in recognition. Your pacts have strengthened your summoning capacity.');return}if(state.party.length<2||!state.won){open('The old mana stone','The old stone answers shared experience. Travel with at least two different recruited Pacts and win one battle, then return to increase summoning capacity.',[['Leave',close]]);return}state.mana=Math.min(MANA_CAP,state.mana+2);state.shrine=true;open('A little more magic','The stone answers your pacts. Your mana capacity increases by 2. Try a different combination of companions! Your clearing training is complete. Follow the clearing’s east path into Lanternwood Trail, then continue east to the orchard.',[['Keep exploring',()=>{say('Clearing milestone complete! Mana capacity increased to 6. Follow the clearing’s east path into Lanternwood Trail, then continue east to the orchard.');close()}]]);return}if(p.type==='fern'){if(state.party.includes('fern')){say('The pond ripples softly. Frond is already part of your roster.');return}state.fernMet=true;open('A very cautious hamster',`${spriteHTML('fern')}<br>Frond peeks out from the reeds. The fern on its head trembles as it sniffs toward your berry pouch.`,[['Offer 2 berries',()=>{state.berries-=2;pact('fern')},state.berries<2],['Speak softly',()=>open('Room for one more?','You kneel and promise a quiet place at camp. Frond rests a tiny paw on your hand, its fern uncurling. A pact freely offered.',[['Accept pact',()=>pact('fern')],['Leave',close]])],['Leave',close]]);return}boarEncounter()}
function boarEncounter(){beginNegotiation('boar')}
function rest(){if(modal)return;if(state.area==='spring'){if(nearest()?.type==='springRest')curiosityInteract(nearest());else say('Settle beside the stones on the southwest edge of the pool.');return;}if(state.area==='village'){if(nearest()?.type==='home')chapterInteract(nearest());else say('Visit your home in the northwest to rest.');return}if(state.area==='orchard'&&nearest()?.type==='keeper'){interact();return}if(state.area!=='clearing'){say(state.area==='orchard'?'Talk to Ada beside the western path to rest.':'The clearing camp is west, and Ada offers rest in the orchard to the east.');return}if(Math.abs(state.x-5)+Math.abs(state.y-9)>1){say('Return to the little tent in the southwest to rest.');return}say('Rested at camp. Your companions are refreshed. Rest does not replenish supplies.');render()}

function partyControls(k){
 const active=state.active.includes(k),free=state.mana-used(),cost=species[k].cost;
 return `<section class="party-controls"><b>Summoned: ${used()} / ${state.mana} mana · ${free} free</b><p>${state.active.length?state.active.map(id=>species[id].name+' ('+species[id].cost+')').join(' + '):'No companions summoned'} · ${state.active.length}/3 slots</p><button id="partyToggle" ${!active&&(free<cost||state.active.length>=3)?'disabled':''}>${active?'Dismiss '+species[k].name+' · free '+cost+' mana':'Summon '+species[k].name+' · '+cost+' mana'}</button>${!active&&(free<cost||state.active.length>=3)?`<p>Needs ${cost} mana; only ${free} is free. Dismiss companions, or replace the active team below.</p><button id="soloSummon">Dismiss ${state.active.map(id=>species[id].name).join(' + ')} & summon ${species[k].name}</button>`:''}<p class="muted">Dismissed companions stay in your roster with all levels and bond intact.</p></section>`;
}
function summonAlone(k){if(modal!=='party'||battle||!state.party.includes(k)||species[k].cost>state.mana)return;state.active=[k];showParty(k);say(species[k].name+' is now your active companion.')}

const OVERWORLD_SOURCES={"mouse": ["./assets/pacts/whisk/walk.png", "./assets/pacts/whisk/stand.png"], "fern": ["./assets/pacts/frond/walk.png", "./assets/pacts/frond/stand.png"], "boar": ["./assets/pacts/bramble/walk.png", "./assets/pacts/bramble/stand.png"], "moth": ["./assets/pacts/glim/walk.png", "./assets/pacts/glim/stand.png"], "snail": ["./assets/pacts/dewdrop/walk.png", "./assets/pacts/dewdrop/stand.png"], "player": ["./assets/characters/player/walk.png", "./assets/characters/player/stand.png"], "rowan": ["./assets/characters/rowan/walk.png", "./assets/characters/rowan/stand.png"], "townsperson": ["./assets/characters/townsperson/walk.png", "./assets/characters/townsperson/stand.png"], "quilcoal": ["./assets/pacts/quilcoal/walk.png", "./assets/pacts/quilcoal/stand.png"]};
const overworldArt={};
function loadArt(source){const asset={image:new Image(),ready:false};asset.image.onload=()=>{asset.ready=true};asset.image.src=source;return asset}
for(const [key,[walk,idle]] of Object.entries(OVERWORLD_SOURCES))overworldArt[key]={walk:loadArt(walk),idle:loadArt(idle)};
let playerWalkUntil=0;
const forestArt=loadArt("./assets/props/forest-sheet.webp");

function forestPiece(rect,x,y,w,h){if(!forestArt.ready)return false;ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(forestArt.image,...rect,Math.round(x),Math.round(y),w,h);ctx.restore();return true}
function forestObjects(){
 const out=[],exits=mapExits();
 for(let y=0;y<13;y++)for(let x=0;x<20;x++){
 if(exits.some(p=>mouthContains(x,y,p))||!tree(x,y)||(state.area==='clearing'&&x===10&&y===2)||(state.area==='village'&&x>0&&x<19&&y>0&&y<12))continue;
 const pine=state.area==='trail'&&(x+y)%3===0;
 out.push({y:y*32+16,paint:()=>{if(!forestPiece(pine?[0,720,188,225]:[0,0,418,510],x*32-4,y*32-16,40,48)){ctx.fillStyle='#665339';ctx.fillRect(x*32+13,y*32+17,6,15);ctx.fillStyle='#35573b';ctx.fillRect(x*32+2,y*32+1,28,24)}}});
 }return out;
}
function drawForest(){drawExitPaths();}
// Recent legal footsteps, kept outside saves so map changes cannot leave ghost followers.
let partyTrail=null;
function syncPartyTrail(){
 if(partyTrail&&partyTrail.owner===state&&partyTrail.area===state.area&&partyTrail.points[0].x===state.x&&partyTrail.points[0].y===state.y)return;
 const points=[{x:state.x,y:state.y,facing:state.facing}];
 const [dx,dy]=({down:[0,-1],up:[0,1],left:[1,0],right:[-1,0]})[state.facing]||[0,-1];
 for(let i=1;i<=3;i++){
 const x=state.x+dx*i,y=state.y+dy*i;
 if(x<1||y<1||x>18||y>11||tree(x,y)||pond(x,y)||solidScenery(x,y)||regionFeatures().some(p=>p.x===x&&p.y===y))break;
 points.push({x,y,facing:state.facing});
 }
 partyTrail={owner:state,area:state.area,points,movedAt:-Infinity};
}
function recordPartyStep(){
 partyTrail.points.unshift({x:state.x,y:state.y,facing:state.facing});
 partyTrail.points.length=Math.min(partyTrail.points.length,5);
 partyTrail.movedAt=performance.now();
}
function fieldHelper(){
 if(state.area==='grove' && fireAction?.owner===state)return fireAction.helper;
 if(state.area==='orchard' && beeAction?.owner===state && beeAction.kind==='log')return beeAction.helper;
 if(state.area==='trail' && state.curiosity.phase==='rescuing')return state.curiosity.method;
 return null;
}
function partyPositions(now=performance.now()){
 syncPartyTrail();
 const progress=Math.min(1,Math.max(0,(now-partyTrail.movedAt)/100));
 const actors=[];
 state.active.slice(0,3).forEach((k,i)=>{
 if(k===fieldHelper())return;
 const to=partyTrail.points[i+1];if(!to)return;
 const from=partyTrail.points[i+2]||to,dx=to.x-from.x,dy=to.y-from.y;
 actors.push({k,x:(from.x+dx*progress)*32+16,y:(from.y+dy*progress)*32+16,
 facing:dx||dy?facingFor(dx,dy):to.facing,walkUntil:(dx||dy)?partyTrail.movedAt+260:0});
 });
 actors.push({k:'player',x:state.x*32+16,y:state.y*32+16,facing:state.facing,walkUntil:playerWalkUntil});
 return actors.sort((a,b)=>a.y-b.y||(a.k==='player'?1:b.k==='player'?-1:0));
}
function solidScenery(x,y){return state.area==='orchard'&&pactMemory('snail').helpDone&&x===13&&y===10}
function drawParty(){
 const props=forestObjects();
 for(const p of regionFeatures())if(['directions','notice'].includes(p.type))props.push({y:p.y*32+16,paint:()=>villagePiece('notice',p.x*32,p.y*32-16,32,48)});
 if(state.area==='village')props.push({y:272,paint:()=>villagePiece('well',224,208,64,80)});
 if(state.area==='trail'){const p=trailFeatures.find(p=>p.type==='lesson');props.push({y:p.y*32+16,paint:()=>villagePiece('stone',p.x*32,p.y*32-24,32,48)})}
 if(state.area==='clearing')props.push({y:80,paint:()=>villagePiece('stone',320,32,32,64)});
 if(state.area==='orchard')props.push({y:336,paint:()=>drawBeeLog(performance.now())});
 const sorted=[...partyPositions(),...props].sort((a,b)=>a.y-b.y||(a.paint?-1:1));
 for(const a of sorted){
 if(a.paint){a.paint();continue} 
 if(a.k==='mouse'&&state.area==='trail'&&state.curiosity.phase==='hidden'&&Math.abs(state.x-3)+Math.abs(state.y-6)<=4&&performance.now()>=playerWalkUntil){a.facing=facingFor(112-a.x,208-a.y);a.x+=Math.sign(112-a.x)*5;}
 sprite(ctx,a.k,a.x,a.y,1,false,a.facing,modal?0:a.walkUntil);
 }
 drawBuildingOverhangs();
}
const WATER_PNG={"water":"./assets/tilesets/water.png","shore":"./assets/tilesets/shore.png","props":"./assets/props/water.png"};
// Visual-only terrain registry. PNG source rectangles are 32px cells; gameplay never reads this registry.
const terrainArt={};
function registerTerrainPNG(name,source,columns,rows){
 const art={image:new Image(),ready:false,columns,rows};terrainArt[name]=art;
 art.image.onload=()=>{art.ready=art.image.width===columns*32&&art.image.height===rows*32};
 art.image.onerror=()=>{art.ready=false};art.image.src=source;return art;
}
for(const [name,columns,rows] of [['water',3,2],['shore',12,1],['props',3,1]])registerTerrainPNG(name,WATER_PNG[name],columns,rows);
function terrainCell(name,col,row,x,y){const a=terrainArt[name];if(!a?.ready||col<0||col>=a.columns||row<0||row>=a.rows)return false;
 ctx.drawImage(a.image,col*32,row*32,32,32,x,y,32,32);return true;
}
function waterFrame(t){return Math.floor(Math.max(0,t)/360)%3}
// n,e,s,w edge bits; clockwise NW,NE,SE,SW corners. Read the existing collision mask, never modify it.
function shoreParts(x,y,isWater=pond){
 const n=isWater(x,y-1),e=isWater(x+1,y),s=isWater(x,y+1),w=isWater(x-1,y),parts=[];
 [n,e,s,w].forEach((wet,i)=>{if(!wet)parts.push(i)});
 [[n,w,x-1,y-1],[n,e,x+1,y-1],[s,e,x+1,y+1],[s,w,x-1,y+1]].forEach(([a,b,dx,dy],i)=>{
 if(!a&&!b)parts.push(4+i);else if(a&&b&&!isWater(dx,dy))parts.push(8+i);
 });return parts;
}
const waterDecor={clearing:[{x:14,y:4,kind:2},{x:16,y:5,kind:1},{x:14,y:6,kind:0}],trail:[{x:13,y:2,kind:0},{x:15,y:4,kind:1},{x:14,y:3,kind:2}],orchard:[{x:15,y:5,kind:0},{x:17,y:6,kind:2},{x:16,y:7,kind:1}]};
function drawWaterTile(x,y,t){
 if(!terrainArt.water.ready)return false;
 ctx.save();ctx.imageSmoothingEnabled=false;
 // Unrestored orchard water retains its darker story state.
 terrainCell('water',waterFrame(t),state.area==='orchard'&&!state.quest.guardian?1:0,x*32,y*32);
 for(const part of shoreParts(x,y))terrainCell('shore',part,0,x*32,y*32);
 for(const prop of waterDecor[state.area]||[])if(prop.x===x&&prop.y===y)terrainCell('props',prop.kind,0,x*32,y*32);
 ctx.restore();return true;
}

// Optional woodland story. Persist only milestones; animation clocks remain local.
function curiosityDefaults(){return {phase:'hidden',method:null,route:0,discovered:false,away:false,returnReady:false,gift:false,attempts:0,retryAt:0,bonded:false}}
function readCuriosity(value){const c=curiosityDefaults();if(!value||typeof value!=='object')return c;
 if(['hidden','seen','manual','loose','rescuing','leading','home'].includes(value.phase))c.phase=value.phase;
 if(['boar','fern','player'].includes(value.method))c.method=value.method;
 for(const k of ['discovered','away','returnReady','gift','bonded'])c[k]=value[k]===true;
 for(const [k,max] of [['route',12],['attempts',2],['retryAt',100000008]])if(Number.isInteger(value[k])&&value[k]>=0&&value[k]<=max)c[k]=value[k];
 if(c.phase==='rescuing'&&!c.method)c.phase='seen';return c;
}
const cubRoute=[[4,6],[4,5],[4,4],[4,3],[4,2],[5,2],[6,2],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1]];

let curiosityHeard=false,rescueClock=null,cubClock=0,curiosityOwner=null,cubFace='up',cubWalkUntil=0;
function curiosityFeatures(){const c=state.curiosity;
 if(state.area==='spring')return springFeatures;
 if(state.area!=='trail')return [];
 const out=c.bonded?[]:[{x:3,y:6,type:'thicket',label:c.phase==='hidden'?'Inspect the berry thicket':'Examine the quiet thicket'}];
 if(c.discovered||c.phase==='leading'&&c.route===cubRoute.length-1)out.push({x:11,y:1,type:'springEntry',label:'Step through the parted ferns'});
 return out;
}
function startRescue(method){state.curiosity.method=method;state.curiosity.phase='rescuing';rescueClock=performance.now();close();modal='rescue';save();}
function updateCuriosity(t){
 const c=state.curiosity;if(curiosityOwner!==state){curiosityOwner=state;rescueClock=null;cubClock=t;curiosityHeard=false;}
 if(state.area!=='trail'){curiosityHeard=false;return;}
 if(c.phase==='home'&&c.returnReady&&!c.bonded&&!curiosityHeard&&Math.abs(state.x-3)+Math.abs(state.y-6)<=3){curiosityHeard=true;storyFeedback(c.method==='boar'?'The cub spots you and balances a berry on its head. It remembers Bramble.':c.method==='fern'?'The cub recognizes you and trots toward Frond’s old tunnel.':'The cub recognizes you and steps forward to sniff your hand.');}
 if(c.phase==='hidden'&&!modal&&!curiosityHeard&&Math.abs(state.x-3)+Math.abs(state.y-6)<=4){curiosityHeard=true;beep(720);storyFeedback(state.active.includes('mouse')?'Whisk turns toward the berry thicket. Something squeaks beneath the leaves.':'A faint squeak comes from the berry thicket. One branch trembles.');}
 if(c.phase==='rescuing'){
 if(rescueClock===null){rescueClock=t;modal='rescue';$('overlay').hidden=true;}
 if(t-rescueClock>=4400){c.phase='leading';c.route=0;rescueClock=null;cubClock=t+1400;modal=null;
 storyFeedback(c.method==='boar'?'Berries tumble over Bramble’s ears. The cub steals one, trots away, then looks back.':c.method==='fern'?'Frond emerges muddy-nosed. Water beads in his little tunnel. The cub takes a berry and looks back.':'The cord slips free. The cub sniffs your fingers, takes a fallen berry, and looks back.');render();}
 return;
 }
 if(modal||document.hidden||c.phase!=='leading'){cubClock=t;return}
 const [x,y]=cubRoute[c.route];if(c.route>=cubRoute.length-1||t-cubClock<850||Math.abs(state.x-x)+Math.abs(state.y-y)>2)return;
 const [nx,ny]=cubRoute[c.route+1];if(state.x===nx&&state.y===ny)return;
 cubFace=facingFor(nx-x,ny-y);c.route++;cubWalkUntil=performance.now()+300;cubClock=t+([3,9].includes(c.route)?1600:0);save();
 if(c.route===3)storyFeedback('A soft squeak comes from behind the fallen log.');
}
function curiosityInteract(p){const c=state.curiosity;
 if(p.type==='springEntry'){travel('spring');return true}
 if(p.type==='springExit'){travel('trail');return true}
 if(p.type==='springRest'){
 open('A little room to breathe',state.quest.guardian?'The small pool bubbles freely now. The orchard’s restored flow reaches even this quiet hollow.':'A thin trickle seeps between two stones. The pool is fed from deeper underground, but barely. Perhaps the orchard’s troubled spring is connected.',[
 ['Rest · recover',()=>{close();storyFeedback('Your companions rest beside the water. Your supplies are unchanged.')}],['Leave the pool in peace',close]]);return true;
 }
 if(p.type!=='thicket'||c.bonded)return false;
 if(c.phase==='hidden'){c.phase='seen';storyFeedback('A boar cub is caught by one paw. Old twine runs to a bent branch; every struggle pulls it tighter.');beep(680);render();return true}
 if(c.phase==='seen'){
 open('A rustle in the brambles','The cub freezes as you kneel. Freeing its paw means taking the strain off the bent branch first.',[
 ['Bramble · brace the branch',()=>startRescue('boar'),!state.active.includes('boar')],['Frond · investigate underneath',()=>startRescue('fern'),!state.active.includes('fern')],
 ['Work the cord loose yourself',()=>{c.phase='manual';close();storyFeedback('The knot is caught on the east side. Walk around to the right of the thicket and inspect it.')}],['Give it room',close]]);return true;
 }
 if(c.phase==='manual'){
 if(state.x!==4||state.y!==6){storyFeedback('The knot is on the east side of the bush. You can reach it from the tile immediately to its right.');return true}
 c.phase='loose';storyFeedback('You lift the knot off a thorn. The cord slackens. Move to the north side of the bush to reach the cub’s paw.');render();return true;
 }
 if(c.phase==='loose'){
 if(state.x!==3||state.y!==5){storyFeedback('The loosened loop is easiest to reach from directly above the bush.');return true}
 startRescue('player');return true;
 }
 if(c.phase==='leading'){storyFeedback('The severed twine lies curled beside the roots. The bent branch has lifted.');return true}
 if(!c.returnReady){storyFeedback('The twine is gone. Small hoofprints lead into the undergrowth.');return true}
 const recognition=c.method==='boar'?(state.active.includes('boar')?'The cub brings Bramble a berry and peers hopefully at his ears.':'The cub balances a berry on its head, remembering Bramble’s spectacular rescue.'):
 c.method==='fern'?(state.active.includes('fern')?'The cub nudges Frond toward his old tunnel. Fresh water glints beneath the roots.':'The cub proudly shows you Frond’s little tunnel beneath the roots.'):'The cub comes straight to your hand and presses its nose into your palm.';
 const choices=[];
 if(!c.gift)choices.push(['Accept its berry',()=>{c.gift=true;state.berries++;close();storyFeedback('A berry, carefully saved for you. +1 berry.')}]);
 if(!state.party.includes('boar')&&!c.bonded)choices.push([c.attempts?'Offer your hand again · guaranteed pact':'Offer your hand · 90% pact chance',()=>cubPact(),state.steps<c.retryAt]);
 choices.push(['Spend a quiet moment together',()=>{close();storyFeedback(recognition)}],['Leave it to its woodland life',close]);
 open('A familiar little face',recognition+'<br><br>'+(!state.party.includes('boar')?'It remembers being helped. You can offer a pact gently, without payment or a battle. If it declines, it stays friendly.': 'It is a friendly wild neighbor. Your existing Bramble keeps its place in your roster.'),choices);return true;
}
function cubPact(rng=Math.random){const c=state.curiosity;if(c.bonded||!c.returnReady||state.steps<c.retryAt||state.party.includes('boar'))return false;
 if(c.attempts||rng()<.9){c.bonded=true;pact('boar',true);return true}
 c.attempts=1;c.retryAt=state.steps+8;open('Friends, in its own time','The cub rests its nose in your hand, then returns to the roots. It trusts you, but is not ready to leave. Explore 8 steps and visit again; its next gentle pact offer is guaranteed.',[['Let it choose',close]]);save();return false;
}
function drawCub(x,y,facing='down',walkUntil=0){ctx.save();ctx.translate(x,y);ctx.scale(.8,.8);sprite(ctx,'boar',0,0,1,false,facing,walkUntil);ctx.restore()}
function drawCuriosity(t){if(state.area!=='trail')return;const c=state.curiosity,near=Math.abs(state.x-3)+Math.abs(state.y-6),trapped=['hidden','seen','manual','loose','rescuing'].includes(c.phase);
 const rustle=c.phase==='hidden'&&near>1?Math.round(Math.sin(t/110)*1.5):0;
 forestPiece([230,522,210,181],92+rustle,178,40,34);
 // A visual-only log: the cub can pass behind it without creating a new collision rule.
 if(c.phase==='leading'){const [x,y]=cubRoute[c.route];drawCub(x*32+16,y*32+16,performance.now()<cubWalkUntil?cubFace:facingFor(state.x-x,state.y-y),cubWalkUntil);}
 if(c.phase==='leading'||c.discovered)forestPiece([1260,522,270,185],126,98,30,22);
 if(trapped&&c.phase!=='hidden'){
 drawCub(112+(c.phase==='rescuing'&&t-(rescueClock??t)>2800?5:0),200,'right');ctx.strokeStyle='#d2b17b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(117,207);ctx.lineTo(127,c.phase==='loose'||c.phase==='rescuing'&&t-(rescueClock??t)>1700?205:184);ctx.lineTo(104,181);ctx.stroke();ctx.fillStyle='#85613e';ctx.fillRect(103,178,24,3);ctx.fillStyle='#eed3a0';ctx.fillRect(115,204,5,4);
 }
 if(c.phase==='rescuing'){
 const elapsed=Math.max(0,t-(rescueClock??t)),p=Math.min(1,elapsed/2400);
 if(c.method==='boar'){sprite(ctx,'boar',135-p*7,205,1,false,'left',performance.now()+100);if(elapsed>1800){ctx.fillStyle='#bc6659';for(let i=0;i<5;i++)ctx.fillRect(108+i*6,180+(elapsed/20+i*7)%30,3,3)}}
 else if(c.method==='fern'){ctx.fillStyle='#756343';ctx.fillRect(110,209,25,5);sprite(ctx,'fern',133-p*16,211,1,false,'left',performance.now()+100);ctx.fillStyle='#a18c5e';for(let i=0;i<5;i++)ctx.fillRect(116+i*5,211-Math.sin(p*12+i)*5,3,2);if(elapsed>1800){ctx.fillStyle='#91c8c2';ctx.fillRect(113,214,14,2)}}
 else{ctx.fillStyle='#d7c095';ctx.fillRect(114,201,5,3);ctx.fillStyle='#d2b17b';ctx.fillRect(124,210,8,2)}
 }
 if(c.phase==='home'&&c.returnReady&&!c.bonded){const greet=near<=3?Math.min(8,Math.max(0,3-near)*4):0;drawCub(119+greet,211,facingFor(state.x-3,state.y-6),near<=3?t+100:0);if(!c.gift){ctx.fillStyle='#c27468';ctx.fillRect(110,216,4,4)}}
 
}
function drawHiddenSpring(t){
 const textured=drawGroundLayer();
 for(let y=0;y<13;y++)for(let x=0;x<20;x++){if(!textured){ctx.fillStyle=(x+y)%3?'#718955':'#78915c';ctx.fillRect(x*32,y*32,32,32);if(y===9&&x>1&&x<12){ctx.fillStyle='#a49d70';ctx.fillRect(x*32,y*32,32,32)}}if(pond(x,y))drawWaterTile(x,y,t);}
 drawForest();

 for(const [x,y] of [[10,4],[12,2],[15,3],[16,7],[12,8]]){forestPiece([1100,800,125,145],x*32,y*32,24,28);}
 // Spring source: short ripples below a pair of bank stones, not a vertical debug-like stripe.
 ctx.fillStyle='#65766a';ctx.fillRect(411,91,7,5);ctx.fillRect(422,92,8,5);
 ctx.fillStyle='#a4b29a';ctx.fillRect(412,91,5,2);ctx.fillRect(423,92,5,2);
 ctx.fillStyle=state.quest.guardian?'#afd4c7':'#80aaa3';
 const rings=state.quest.guardian?3:1;for(let i=0;i<rings;i++){const shift=(Math.floor(t/300)+i)%3;ctx.fillRect(417-i*2,100+i*4+shift,5+i*4,1);}

 forestPiece([800,810,155,130],348,230,32,27);
 forestPiece([1220,800,150,145],340,207,25,27);
 ctx.fillStyle='#d8d8a9';for(const [x,y] of [[366,223],[360,225],[373,229]])ctx.fillRect(x,y,2,2);
 if(!state.curiosity.bonded&&!state.curiosity.returnReady)drawCub(377,237,'right');
 drawParty();
}

// Entrances share the existing destination features; paths are scenery, not separate quest markers.
function exitDestination(p){return ({groveEntry:'grove',groveExit:'orchard',hillsEntry:'hills',gate:'clearing',west:'clearing',east:'orchard',exit:'trail',village:'village',orchard:'trail',springEntry:'spring',springExit:'trail'})[p?.type]||null}
function mapExits(){return regionFeatures().filter(p=>exitDestination(p))}
function mouthContains(x,y,p){return p.type==='springEntry'?Math.abs(x-p.x)<=1&&y<=1:p.x<10?x<=2&&Math.abs(y-p.y)<=1:x>=17&&Math.abs(y-p.y)<=1}
function drawExitPaths(){
 for(const p of mapExits()){
 const north=p.type==='springEntry',west=p.x<10;
 ctx.save();
 if(!Object.values(groundArt).every(a=>a.ready)){
 // Broad grass shoulders frame a narrow, worn route continuing beyond the screen.
 const x=north?p.x*32-16:west?0:16*32,y=north?0:p.y*32-16,w=north?64:west?128:640-x,h=north?96:64;
 ctx.fillStyle='#8a9b60';ctx.fillRect(x,y,w,h);
 ctx.fillStyle='#b5aa7c';ctx.fillRect(north?p.x*32:x,north?0:p.y*32,north?32:w,north?h:32);
 ctx.fillStyle='#c4b88a';ctx.fillRect(north?p.x*32+6:x,north?0:p.y*32+6,north?20:w,north?h:20);
 ctx.fillStyle='#9b9367';for(let i=0;i<(north?h:w);i+=19){const px=north?p.x*32+8+(i%3)*4:x+i,py=north?i:p.y*32+10+(i%3)*4;ctx.fillRect(px,py,3,2)}
 }
 // Ferns sit outside the walking lane, making the opening distinct from ordinary ground.
 for(const off of [-1,1])forestPiece([1220,800,150,145],north?p.x*32+off*34:p.x<10?12:602,north?8:p.y*32+off*32,24,26);
 ctx.restore();
 }
}
let sceneCaption={text:'',until:0,area:''};
function storyFeedback(text){say(text);sceneCaption={text,until:performance.now()+6500,area:state.area};}
function drawSceneFeedback(){
 if(state.area==='trail'&&state.curiosity.phase==='rescuing'){
 const elapsed=performance.now()-(rescueClock??performance.now());
 const text=elapsed>2200?'The loop is loose. The cub pulls its paw free.':state.curiosity.method==='fern'?'Frond digs beneath the roots. The branch slowly lowers…':state.curiosity.method==='boar'?'Bramble braces the branch. The tight cord slackens…':'You steady the branch and ease the loop over its paw…';
 if($('message').textContent!==text)say(text);
 }
}

const VILLAGE_PNG=["./assets/props/village-buildings.webp", "./assets/props/village-objects.webp"];
const villageArt=VILLAGE_PNG.map(loadArt);
// Atlas rectangles are measured from the supplied art, not inferred from its advertised tile sizes.
const villageRects={cottage:[0,0,0,458,460],shop:[0,470,0,470,480],tent:[0,0,516,225,265],well:[1,754,432,174,210],stone:[0,1222,520,137,262],notice:[0,1094,566,112,183],chest:[1,1390,523,130,112],basket:[1,120,650,115,108]};
function villagePiece(key,x,y,w,h){const [sheet,sx,sy,sw,sh]=villageRects[key],a=villageArt[sheet];if(!a.ready)return false;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(a.image,sx,sy,sw,sh,Math.round(x),Math.round(y),w,h);ctx.restore();return true;
}
function drawBuildingOverhangs(){
 // Only the roof above the existing solid footprint needs a foreground pass.
 if(state.area==='village')for(const [key,x] of [['cottage',76],['shop',280]]){ctx.save();ctx.beginPath();ctx.rect(x,64,128,64);ctx.clip();villagePiece(key,x,64,128,128);ctx.restore();}
 if(state.area==='clearing'){ctx.save();ctx.beginPath();ctx.rect(148,264,56,24);ctx.clip();villagePiece('tent',148,264,56,64);ctx.restore();}
}

const GROUND_PNG={"cobble": "./assets/tilesets/cobble.png", "cobble-transitions": "./assets/tilesets/cobble-transitions.png", "meadow": "./assets/tilesets/meadow.png", "decorations": "./assets/tilesets/decorations.png", "dirt": "./assets/tilesets/dirt.png", "dirt-transitions": "./assets/tilesets/dirt-transitions.png", "forest": "./assets/tilesets/forest.png"};
const GROUND_MASKS=[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255];
// Visual terrain only. Existing pond/tree/features remain authoritative for collision.
const groundArt={},groundCache=new Map();
for(const [name,src] of Object.entries(GROUND_PNG)){const a={image:new Image(),ready:false};groundArt[name]=a;a.image.onload=()=>{a.ready=true;groundCache.clear()};a.image.onerror=()=>{a.ready=false;groundCache.clear()};a.image.src=src;}
function groundHash(x,y,salt=0){let n=Math.imul(x+91,374761393)^Math.imul(y+37,668265263)^Math.imul(salt+7,1274126177);n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0}
// Each run is a connected stretch of tread, with landmarks beside its endpoint.
const woodlandPaths={
 trail:[
  [0,9,4,9],[4,6,4,9],[4,6,7,6],[7,5,7,6],[7,5,13,5],
  [13,5,13,8],[13,8,15,8],[15,8,15,9],[15,9,19,9],
  [7,3,7,5]
 ],
 orchard:[
  [0,9,4,9],[4,9,4,10],[4,10,6,10],[6,7,6,10],
  [6,7,8,7],[8,6,8,7],[8,6,13,6],[13,6,13,8],[13,8,14,8],
  [5,7,6,7],[5,4,5,7],[8,4,8,6],[8,4,10,4],
  [13,4,13,6],[13,4,14,4],[14,2,14,4],[14,2,17,2],[17,2,17,3]
 ]
};
function groundPathAt(area,x,y){
 if(woodlandPaths[area]){
  const onTrail=woodlandPaths[area].some(([left,top,right,bottom])=>x>=left&&x<=right&&y>=top&&y<=bottom);
  const spur=area==='trail'?x===11&&y>=0&&y<5&&mapExits().some(p=>p.type==='springEntry'):
   y===3&&x>=18&&x<=19&&mapExits().some(p=>p.type==='groveEntry');
  return onTrail||spur?'dirt':null;
 }
 let path=area==='grove'?(y===9&&x<=7||x===6&&y>=6&&y<=9||y===6&&x>=6&&x<=17||x===17&&y>=3&&y<=6):area==='village'?(y===9||(x===4||x===10)&&y>=6&&y<=9):area==='clearing'?((y>=8&&y<=9&&x>=4&&x<=15)||(x>=6&&x<=7&&y>=3&&y<=9)):(y===9&&x>1&&x<12);
 // Preserve the existing entrance lanes, including the unlocked northern shortcut.
 for(const p of mapExits())if(p.type==='springEntry'?x===11&&y<=2:y===p.y&&(p.x<10?x<=3:x>=16))path=true;
 if(!path)return null;
 return area==='village'&&!(y===9&&(x<=2||x>=17))?'cobble':'dirt';
}
function groundMask(x,y,has){let m=0;[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]].forEach(([dx,dy],i)=>{if(has(x+dx,y+dy))m|=1<<i});for(const [bit,a,b] of [[4,0,1],[5,1,2],[6,2,3],[7,3,0]])if(!(m>>a&1)||!(m>>b&1))m&=~(1<<bit);return m;}
function groundDecoration(area,x,y,path){const h=groundHash(x,y,area.length);if(path)return h%31===0?4:-1;if(h%7!==0)return -1;return area==='trail'||area==='spring'?[0,1,5][h%3]:h%5;}
function groundCell(c,name,col,row,x,y){c.drawImage(groundArt[name].image,col*32,row*32,32,32,x,y,32,32)}
function drawGroundLayer(){
 if(!Object.values(groundArt).every(a=>a.ready))return false;
 const key=state.area+':'+mapExits().map(p=>p.type).join(',');let cached=groundCache.get(key);
 if(!cached){cached=document.createElement('canvas');cached.width=640;cached.height=416;const c=cached.getContext('2d');c.imageSmoothingEnabled=false;
 const biome=['trail','spring','grove'].includes(state.area)?'forest':'meadow',has=(x,y)=>!!groundPathAt(state.area,x,y);
 // 1. Repeating grass base; all three variants have compatible borders.
 for(let y=0;y<13;y++)for(let x=0;x<20;x++)groundCell(c,biome,groundHash(x,y,3)%3,0,x*32,y*32);
 // 2. Transparent 47-pattern transitions; the same masks handle broad clearings and narrow branches.
 for(let y=0;y<13;y++)for(let x=0;x<20;x++){const kind=groundPathAt(state.area,x,y);if(!kind)continue;const index=GROUND_MASKS.indexOf(groundMask(x,y,has));groundCell(c,kind+'-transitions',index%8,Math.floor(index/8),x*32,y*32);}
 // Dither the cobblestone-to-dirt joins inside the road, without changing its footprint.
 if(state.area==='village')for(const boundary of [96,544])for(let yy=292;yy<316;yy++)for(let xx=boundary-4;xx<boundary+4;xx++){
 const leftDirt=boundary===96,p=(xx-boundary+4)/8,chooseRight=groundHash(xx,yy,19)%100<p*100;
 const kind=(chooseRight?!leftDirt:leftDirt)?'dirt':'cobble';c.drawImage(groundArt[kind].image,((xx%32)+32)%32,yy%32,1,1,xx,yy,1,1);
 }
 // 3. Sparse, deterministic decoration. Water/solid/interactable cells are left clear.
 for(let y=1;y<12;y++)for(let x=1;x<19;x++){
 if(tree(x,y)||pond(x,y)||solidScenery(x,y)||regionFeatures().some(p=>p.x===x&&p.y===y))continue;
 const index=groundDecoration(state.area,x,y,has(x,y));if(index>=0)groundCell(c,'decorations',index,0,x*32,y*32);
 }
 groundCache.set(key,cached);
 }
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(cached,0,0);ctx.restore();return true;
}

function discoveryXP(amount){return state.party.map(k=>gainXP(k,amount)).join('<br>')}
function discoveryFeedback(text,amount){const earned=discoveryXP(amount);storyFeedback(text+' +'+amount+' XP for each recruited companion.');render();return earned}
function fireDefaults(){return {meadow:false,herbs:false,supplies:false,device:false,deviceSeen:false,started:false,branch:false,animals:false,quills:false,tracks:false,shard:false,calm:false,attackedQuilcoal:false,reported:false,returned:false,bucket:false,rabbitScattered:false,rabbitMethod:null,pactAttempts:0,retryAt:0}}
function readFire(value){const out=fireDefaults();if(!value||typeof value!=='object')return out;for(const k of Object.keys(out))if(typeof out[k]==='boolean')out[k]=value[k]===true;for(const k of ['pactAttempts','retryAt'])if(Number.isInteger(value[k])&&value[k]>=0&&value[k]<100000009)out[k]=k==='pactAttempts'?Math.min(1,value[k]):value[k];out.rabbitMethod=['snail','boar','fern','player'].includes(value.rabbitMethod)?value.rabbitMethod:null;return out}
function groveTree(x,y){return x===0||y===0||x===19||y===12||x===8&&y!==6||[[3,2],[4,2],[6,4],[11,2],[12,2],[17,9],[17,10]].some(p=>p[0]===x&&p[1]===y)}
function fireFeatures(){const f=state.fire;
 if(state.area==='village')return [{x:13,y:7,type:'neighbor',label:'Talk to Mara'}];
 if(state.area==='clearing')return [{x:10,y:8,type:'garden',label:'Check the disturbed garden'}];
 if(state.area==='trail')return f.herbs?[]:[{x:4,y:10,type:'herbs',label:'Gather Ada’s medicinal plants'}];
 if(state.area==='orchard')return [{x:10,y:3,type:'device',label:f.device?'Inspect the silent orchard device':'Investigate the crackling device'},...(f.started?[{x:18,y:3,type:'groveEntry',label:'Enter the old grove'}]:[])];
 if(state.area!=='grove')return [];
 return [{x:2,y:9,type:'groveExit',label:'Return to Ada’s orchard'},...(!f.branch?[{x:8,y:6,type:'burningBranch',label:'Examine the burning trail'}]:[]),{x:3,y:6,type:'waterBucket',label:'Fill the borrowed bucket'},...(!f.animals?[f.rabbitScattered?{x:6,y:2,type:'rabbitCover',label:'Coax the frightened rabbits from cover'}:{x:5,y:3,type:'trappedAnimals',label:'Help the trapped woodland animals'}]:[]),{x:12,y:5,type:'burntQuills',label:'Inspect the scorched tree'}, {x:14,y:8,type:'wagonTracks',label:'Examine the wagon tracks'},...(!state.party.includes('quilcoal')?[{x:16,y:6,type:'quilcoal',label:f.calm?'Visit Quilcoal':'Approach the frightened hedgehog'}]:[]),...(f.calm?[{x:16,y:3,type:'metalShard',label:'Inspect the metal caught in the quills'},{x:14,y:7,type:'groveAda',label:'Speak with Ada'}]:[]),...(f.reported?[{x:18,y:3,type:'hillsEntry',label:'Take the road toward the Ashen Hills'}]:[])];
}
function errandsDone(){return state.fire.meadow&&state.fire.supplies&&(state.fire.device||state.quest.pair)}
function adaErrands(){const f=state.fire;state.quest.started=true;
 if(state.quest.guardian&&!state.quest.reward){state.quest.reward=true;state.mana=Math.min(MANA_CAP,state.mana+2);storyFeedback('The spring runs freely again. Ada grants +2 summoning mana.');}
 if(errandsDone()&&state.quest.reward&&!f.started){f.started=true;open('Smoke beyond the orchard','Ada accepts the supplies. “The meadow, the thicket, the orchard… you have done well.”<br><br>She stops. A gray plume climbs beyond the eastern trees.<br><br>“The old grove. Nothing there should be burning. I will organize help and keep this entrance clear. Take the east path; contain what you can, and come back if it is unsafe.”<br><br>A borrowed bucket waits by the grove’s stream. Dewdrop can help, but you do not need a particular Pact.',[['Look toward the trees',()=>{close();storyFeedback('Smoke rises beyond the orchard’s northeast path. Ada is calling for help.')}]]);return}
 const jobs=[(f.meadow?'✓':'○')+' Check the garden in Mossmere Clearing.',(f.supplies?'✓':'○')+' Bring medicinal plants from the herb patch just below the west entrance of Lanternwood Trail (the cub-rescue map).',(f.device||state.quest.pair?'✓':'○')+' Settle the orchard disturbance: investigate the crackling device or calm the restless pair.',(state.quest.reward?'✓':'○')+' Help the guardian release the Quiet Spring.'].join('<br>');
 const choices=[];if(f.herbs&&!f.supplies)choices.push(['Deliver medicinal plants',()=>{f.supplies=true;discoveryXP(20);adaErrands();storyFeedback('Supplies delivered. Every recruited companion gains 20 XP.')}]);
 choices.push(['Rest · recover',()=>{close();storyFeedback('Ada checks your companions. Supplies are unchanged.')}],['Leave',close]);
 open('Keeper Ada',f.reported?'“Quilcoal belongs in the Ashen Hills. That stamped metal and those wagon tracks deserve a closer look.”':f.started?'“Keep the small fires contained. I am organizing water and help here. The grove lies through the northeast opening.”': '“Pacts live alongside us. A frightened one needs understanding as much as strength.”<br><br>'+jobs,choices);
}
let fireAction=null;
function beginFieldAction(kind,helper){if(fireAction||state.fire[kind==='branch'?'branch':'animals']||kind==='animals'&&state.fire.rabbitScattered)return;close();modal='fieldAction';fireAction={owner:state,kind,helper,started:performance.now()};storyFeedback(kind==='branch'?(helper==='snail'?'Dewdrop draws water into its shell and showers the burning branch…':'You pour the stream water over the embers, working from the safe side…'):helper==='snail'?'Dewdrop showers the brush. Mud washes from the bank…':helper==='boar'?'Bramble braces against the fallen brush…':helper==='fern'?'Frond digs an escape tunnel beneath the smoldering roots…':'You lift the loose brush a piece at a time, opening a gap…');}
function updateFire(){if(!fireAction)return;if(fireAction.owner!==state){fireAction=null;if(modal==='fieldAction')modal=null;return}if(performance.now()-fireAction.started<3600)return;const a=fireAction;fireAction=null;modal=null;groundCache.clear();
 if(a.kind==='branch'){state.fire.branch=true;state.fire.bucket=false;discoveryFeedback('The flames hiss out. The branch falls apart, opening the trail.',20);return}
 state.fire.rabbitMethod=a.helper;
 if(a.helper==='boar'){state.fire.rabbitScattered=true;close();storyFeedback('The brush crashes aside! The rabbits bolt northeast into cover. Follow their tracks to the bush above the pond.');save();return}
 if(a.helper==='player')state.fire.bucket=false;finishRabbits(a.helper);
}
function fireInteract(p){const f=state.fire;
 if(p.type==='keeper'){adaErrands();return true}
 if(p.type==='groveEntry'){travel('grove');return true}if(p.type==='groveExit'){travel('orchard');return true}if(p.type==='hillsEntry'){travel('hills');return true}
 if(p.type==='neighbor'){open('Mara of Mossmere',f.started?'“Ada asked us to bring water. You are not handling this alone.”':'“Rowan said Ada could use a hand. The garden is being dug up, she needs medicinal plants, and something in the orchard keeps crackling. Whisk seems to have appointed himself your supervisor.”',[['Ask about the world',()=>open('Neighbors with natures','Wildpacts carry elemental natures, but they are living neighbors. Some help in gardens and workshops; others prefer the woods. A pact is a promise to look after each other.',[['Back',()=>fireInteract(p)]])],['Leave',close]]);return true}
 if(p.type==='garden'){if(f.meadow){storyFeedback('The garden’s fresh shoots are safe. A small berry pile sits away from the roots.');return true}open('Small paws, hungry visitors','Tiny tracks lead from the loosened soil. Whisk sniffs a dropped berry; the visitors were digging for food, not trying to destroy the garden.',[['Move fallen fruit away from the seedlings',()=>{f.meadow=true;close();discoveryFeedback('You move the fruit and cover the roots. The garden can recover.',20)}],['Leave it for now',close]]);return true}
 if(p.type==='herbs'){if(f.herbs)return true;f.herbs=true;close();discoveryFeedback('Medicinal plants collected. Bring these to Ada in the orchard, one map east.',20);return true}
 if(p.type==='device'){if(f.device){storyFeedback('The cracked orchard lure is silent. Glim’s wingbeats have settled.');return true}if(!f.deviceSeen){f.deviceSeen=true;storyFeedback('A cracked fruit-sorting lure spits tiny sparks. Its loose copper contact is drawing Lightning sprites. A wooden shutoff lever sits clear of the contact.');render();return true}
 open('The orchard’s unwanted signal','The device is still ticking and sparking. You can stop the signal without fighting the creatures it attracted.',[['Pull the wooden shutoff lever',()=>{const settled=state.quest.pair;f.device=true;state.quest.pair=true;close();if(!settled)discoveryFeedback('The device falls silent. The restless pair settles; the guardian can now be approached.',35);else storyFeedback('The device falls silent. The orchard is peaceful.')}],['Leave',close]]);return true}
 if(p.type==='waterBucket'){f.bucket=true;storyFeedback('You fill the borrowed bucket from the stream. Ready to douse the burning branch.');render();return true}
 if(p.type==='burningBranch'){open('A trail full of embers','A fallen branch is burning across the narrow passage. The stream is west of here; there is no countdown.',[['Dewdrop · shower the embers',()=>beginFieldAction('branch','snail'),!state.active.includes('snail')],['Pour the bucket of stream water',()=>beginFieldAction('branch','player'),!f.bucket],['Step back',close]]);return true}
 if(p.type==='trappedAnimals'){rabbitChoices();return true}
 if(p.type==='rabbitCover'){rabbitFollowup();return true}
 if(p.type==='burntQuills'){f.quills=true;storyFeedback('Charred quills are embedded in the bark. Small frantic digging marks continue east. Whatever came through here was terrified.');render();return true}
 if(p.type==='wagonTracks'){f.tracks=true;storyFeedback('Heavy wagon tracks cut across the old grove. One wheel has a broken rim that leaves a repeated notch.');render();return true}
 if(p.type==='metalShard'){f.shard=true;storyFeedback('A bent metal clamp lies among shed quills. Its stamp shows a pick beneath three ridges. This was caught against Quilcoal’s skin.');render();return true}
 if(p.type==='quilcoal'){
 if(!f.calm){open('A spark out of place',spriteHTML('quilcoal')+'<br>The hedgehog curls beneath the tree. Its ember-tipped spines flare as you approach. A twig snaps under your boot. Quilcoal flinches and tucks its nose under one paw. Maybe there’s a way to calm it down.',[['Approach slowly',()=>{close();startEncounter('quilcoal')},!state.active.length],['Give it space',close]]);return true}
 open('Quilcoal, at rest',spriteHTML('quilcoal')+'<br>'+(f.attackedQuilcoal?'At the sound of your boots, Quilcoal backs into the roots. It waits there until you step away.':'Quilcoal lifts its nose to your open palm. When you stand, it takes a few steps after you.'),[
 ...(!f.attackedQuilcoal&&!state.party.includes('quilcoal')?[['Invite Quilcoal to travel with you',quilcoalPact]]:[]),['Sit quietly, then leave',close]]);return true;
 }
 if(p.type==='groveAda'){
 if(!f.shard||!f.tracks){open('Ada in the grove','“A Quilcoal? They belong in the dry Ashen Hills, miles from here. Something drove this one out.”<br><br>Ada asks you to examine the metal north of Quilcoal and the wagon tracks to the southwest.',[['Keep looking',close]]);return true}
 if(!f.reported){f.reported=true;state.chapter.returned=true;state.coins+=12;open('Chapter complete · A Spark Out of Place','Ada turns the bent clamp over. “Mining equipment. That stamp is unfamiliar, but this creature did not arrive here by chance.”<br><br>“The company may be careless. Or someone may be moving Pacts deliberately. We need evidence before we decide.”<br><br><b>+12 coins · Pactkeeper’s field journal unlocked.</b><br>The eastern road toward the Ashen Hills is open. The grove is safe to revisit; rescued animals will return.',[['Open the field journal',showFieldJournal],['Stay in the grove',close]]);return true}
 open('Ada in the quiet grove','“The hills will still be there tomorrow. Check on Quilcoal before you leave.”',[['Read field journal',showFieldJournal],['Leave',close]]);return true;
 }
 return false;
}
function quilcoalPact(){
 if(!state.fire.calm || state.fire.attackedQuilcoal || state.party.includes('quilcoal'))return false;
 pact('quilcoal',true);
 return true;
}
function showFieldJournal(){if(!state.fire.reported)return;open('Pactkeeper’s field journal','<b>A Spark Out of Place</b><br>A frightened Quilcoal reached a damp forest far from its dry Ashen Hills home. A stamped mining clamp and notched wagon tracks suggest human transport. Motive unknown.<br><br><b>Places</b><br>Mossmere · Clearing · Lanternwood · Orchard · '+(state.curiosity.discovered?'Fern Hollow · ':'')+'Old Grove · Ashen Hills road<br><br><b>Known companions</b><br>'+state.party.map(k=>'<b>'+species[k].name+'</b> · '+species[k].nature+' · '+moves[k].special).join('<br>'),[['Close journal',close]])}
function fireJournal(){const f=state.fire;const stages=[[state.chapter.briefed,'Speak to Rowan in Mossmere'],[f.meadow,'Check the meadow garden'],[f.supplies,f.herbs?'Deliver the collected herbs to Ada in the orchard':'Gather herbs below Lanternwood Trail’s west entrance (cub-rescue map)'],[f.device||state.quest.pair,'Settle the orchard disturbance'],[state.quest.reward,'Challenge the guardian in the orchard’s northeast; report to Ada'],[f.started,'Return to Ada after the errands'],[f.branch,'Contain the fire on the grove trail'],[f.calm,'Help the frightened Quilcoal settle'],[f.reported,'Examine the clamp and tracks; speak with Ada']];const next=stages.find(([done])=>!done);
 $('quests').innerHTML='<p class="eyebrow">CHAPTER 1 · A SPARK OUT OF PLACE</p><p class="current-goal">'+(next?next[1]:'Chapter complete · The Ashen Hills await.')+'</p>'+stages.map(([done,label])=>'<div class="quest '+(done?'done':'')+'">'+(done?'✓':'○')+' '+label+'</div>').join('')+'<p class="muted">Use Area guide for paths and landmarks. '+(state.bondNotice?escapeText(state.bondNotice)+' ':'')+'Optional: rescue the cub, discover Fern Hollow, and help the grove’s trapped animals. Three active Pacts maximum.</p>'+(state.curiosity.discovered?'<p class="muted">Fern Hollow: a quiet resting pool, fed by an unusually weak underground trickle.</p>':'')+(f.reported?'<button id="fieldJournal">Read field journal</button>':'')+wheelHTML();if(f.reported)$('fieldJournal').onclick=showFieldJournal;
}
function fireReady(){return battle?.kind==='quilcoal'&&(battle.fear<=1||battle.enemies[0].hp<=Math.ceil(battle.enemies[0].max*.35))}
function lowerGuard(){if(!battle||battle.busy||!fireReady())return false;finishQuilcoal();return true}
function finishQuilcoal(){const b=battle;if(!b||b.kind!=='quilcoal')return;state.fire.calm=true;bond(b.units.map(u=>u.k),.3);const reward=b.units.map(u=>gainXP(u.k,65)).join('<br>');battle=null;canvas.hidden=false;$('hint').hidden=false;$('overlay').style.position='';open('The embers settle',(state.fire.attackedQuilcoal?'You lower your hands. Quilcoal slips behind the tree and watches from cover.':'You kneel. After a long moment, Quilcoal uncurls and rests its chin against your boot.')+'<br><br>'+reward+'<br><br>Ada arrives with water. Something metallic has fallen from Quilcoal’s quills.',[['Return to the grove',close]]);}
function applyBurns(){const b=battle;for(const [side,list] of [['ally',b.units],['enemy',b.enemies]])for(const a of list){if(a.hp<=0||!a.burnTurns)continue;const damage=Math.min(a.hp-(b.kind==='quilcoal'&&side==='enemy'?1:0),Math.max(2,Math.ceil(a.max*.08)));a.hp-=damage;a.burnTurns--;combatFX(side,side==='ally'?a.k:a.id,'−'+damage+' BURN','hit');battleNote(a.name+' takes '+damage+' burn damage. '+(a.burnTurns?'1 round remains.':'The burn fades.'));}}
function fireParticle(x,y,t,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const flicker=Math.floor(t/140)%3;ctx.fillStyle='#703f2c';ctx.fillRect(-9,3,18,5);ctx.fillStyle='#d87c37';ctx.fillRect(-7,-9-flicker,14,16);ctx.fillStyle='#efa94e';ctx.fillRect(-4,-15+flicker,8,19);ctx.fillStyle='#f5d185';ctx.fillRect(-2,-6,4,12);ctx.restore();}
function drawRabbit(x,y){ctx.fillStyle='#b7ad91';ctx.fillRect(x-5,y-3,10,7);ctx.fillRect(x+2,y-7,6,6);ctx.fillRect(x+2,y-12,2,6);ctx.fillRect(x+6,y-11,2,5);ctx.fillStyle='#36483c';ctx.fillRect(x+6,y-6,1,1);}
function drawFireStory(t){const f=state.fire;
 if(state.area==='village')sprite(ctx,'townsperson',432,240,1,false,facingFor(state.x-13,state.y-7));
 if(state.area==='clearing'){ctx.fillStyle='#8c7850';ctx.fillRect(322,265,28,17);ctx.fillStyle=f.meadow?'#92aa62':'#607849';for(let i=0;i<4;i++)ctx.fillRect(325+i*7,262,3,f.meadow?8:3);}
 if(state.area==='trail'&&!f.herbs)forestPiece([1220,800,150,145],132,320,24,28);
 if(state.area==='orchard'){
 ctx.fillStyle='#685742';ctx.fillRect(326,104,22,14);ctx.fillStyle='#b7a46e';ctx.fillRect(333,99,10,7);if(!f.device){ctx.fillStyle='#e4d79b';ctx.fillRect(336+(Math.floor(t/160)%3)*3,96,2,3);}
 if(f.started&&!f.calm){ctx.fillStyle='#55534d66';for(let i=0;i<5;i++)ctx.fillRect(580+i*9,75-(t/45+i*17)%70,18,12);}
 }
}
function drawGrove(t){const f=state.fire;if(!drawGroundLayer()){ctx.fillStyle='#596b42';ctx.fillRect(0,0,640,416);}
 for(let y=0;y<13;y++)for(let x=0;x<20;x++)if(pond(x,y))drawWaterTile(x,y,t);
 drawForest();ctx.fillStyle='#514c38';for(const [x,y] of [[8,6],[12,6],[16,6]]){ctx.fillRect(x*32-10,y*32+10,45,18);}
 if(!f.branch){forestPiece([1260,522,270,185],248,190,48,32);for(let i=0;i<3;i++)fireParticle(256+i*13,210,t+i*200,.8);}
 if(!f.calm)for(const [x,y] of [[12,4],[17,5],[15,8]])fireParticle(x*32+16,y*32+18,t+x*99,f.branch?.55:.85);
 drawRabbitEncounter(t);
 ctx.fillStyle='#c2b389';ctx.fillRect(106,202,9,12);ctx.fillStyle='#7db4b6';ctx.fillRect(107,203,7,3);
 ctx.fillStyle='#655544';for(let i=0;i<6;i++){ctx.fillRect(440+i*5,263,3,2);ctx.fillRect(440+i*5,272,3,2);}
 ctx.fillStyle='#bd8c56';for(let i=0;i<3;i++)ctx.fillRect(398+i*4,167-i*3,2,6);
 if(!state.party.includes('quilcoal'))sprite(ctx,'quilcoal',528+(f.calm?0:Math.sin(t/250)*3),208,1,false,f.calm?'down':Math.sin(t/500)>0?'left':'right',f.calm?0:performance.now()+100);
 if(f.calm){sprite(ctx,'townsperson',464,240,1,false,facingFor(state.x-14,state.y-7));if(!f.shard){ctx.fillStyle='#b1b6a9';ctx.fillRect(524,105,8,5);}}
 if(!f.calm){ctx.fillStyle='#77736b22';for(let i=0;i<7;i++)ctx.fillRect((t/80+i*97)%640,90+i*31,56,13);}
 if(fireAction){const a=fireAction,age=performance.now()-a.started,x=a.kind==='branch'?250:170,y=a.kind==='branch'?220:120;
 if(a.helper!=='player')sprite(ctx,a.helper,x-20,y,1,false,'right',performance.now()+100);
 if(a.kind==='branch'||a.helper==='snail'||a.helper==='player'){ctx.fillStyle='#a3d8d3';for(let i=0;i<12;i++)ctx.fillRect(x-15+(age/15+i*9)%55,y-26+Math.sin(age/150+i)*9,2,3);}else{ctx.fillStyle='#b49b70';for(let i=0;i<8;i++)ctx.fillRect(x+i*5,y-Math.abs(Math.sin(age/200+i))*15,3,2);}}
 drawParty();
}

function showAreaGuide(){if(modal)return;open('Around Mossmere','<b>West to east:</b><br>Mossmere Village → Mossmere Clearing → Lanternwood Trail → Overgrown Orchard'+(state.fire.started?' → Old Grove':'')+'<br><br><b>Lanternwood Trail is the cub-rescue map.</b> It has the berry thicket, northern supply chest, and southeast pact marker. Ada’s medicinal plants grow just below its western entrance, near the bottom-left corner.<br><br><b>Clearing:</b> garden beside the main path; Frond by the pond; mana stone in the north. The mana stone requires two recruited species and one battle victory.<br><br><b>Orchard:</b> Ada beside the west entrance; sparking device in the north; guardian in the northeast. Walk through gaps in the trees to change maps.'+(state.curiosity.discovered?'<br><br>Fern Hollow branches north from Lanternwood Trail.':''),[['Back to exploring',close]])}
function drawInteractionFocus(){
 if(modal)return;const p=nearest();if(!p||exitDestination(p))return;ctx.save();ctx.strokeStyle='#f1d796';ctx.lineWidth=1;ctx.strokeRect(p.x*32+2,p.y*32+2,28,28);ctx.restore();
}
function expeditionJournal(){
 $('place').textContent=battle?'Woodland battle':({grove:'The Old Grove',spring:'The Fern Hollow',village:'Mossmere Village',trail:'Lanternwood Trail',orchard:'The Overgrown Orchard',clearing:'Mossmere Clearing'})[state.area];
 $('rest').textContent=state.area==='spring'?'Rest by the pool':state.area==='village'?'Rest at home':state.area==='orchard'?'Rest with Ada':'Rest at camp';
 const stages=[[state.chapter.briefed,'Speak to Rowan by the village well'],[state.party.includes('fern'),'Befriend Frond in the clearing'],[state.shrine,'Win a battle, pact with Bramble, awaken the mana stone'],[state.quest.started,'Follow Lanternwood east to Keeper Ada'],[state.quest.pair,'Calm the restless orchard pair'],[state.quest.guardian,'Open the spring with the guardian’s challenge'],[state.quest.reward,'Return to Ada for +2 mana'],[state.chapter.returned,'Bring the news home to Rowan']];
 const next=state.chapter.returned?null:stages.find(([done])=>!done);
 $('quests').innerHTML='<p class="eyebrow">CHAPTER 1 · A SPARK OUT OF PLACE</p><p class="current-goal">'+(next?next[1]:'Chapter complete. Your companions’ journey continues.')+'</p>'+stages.map(([done,label])=>'<div class="quest '+(done?'done':'')+'">'+(done?'✓':'○')+' '+label+'</div>').join('')+(state.curiosity.discovered?'<p class="muted"><b>Fern Hollow discovered.</b> '+(state.quest.guardian?'The hidden pool flows freely again. Its waters are connected to the Quiet Spring.':'A weak trickle feeds the hidden pool beneath Lanternwood. The orchard may share its underground source.')+'</p>':'')+'<p class="muted">Optional: explore both trail branches; meet Glim and help Dewdrop. P opens your party.</p>'+wheelHTML();

}

function interact(){
 if(modal)return;const p=nearest();if(!p){say('Walk beside a creature or landmark and press E.');return}
 if(beeInteract(p))return;if(fireInteract(p))return;if(curiosityInteract(p))return;if(chapterInteract(p))return;if(state.area!=='orchard'){if(p.type==='orchard'){travel('trail');return}if(p.type==='village'){travel('village');return}clearingInteract();return}
 if(p.type==='wildmouse'){open('A curious wild Whisk','The mouse sniffs your companions, then bounces into a playful stance. It is willing to spar. You already know this species.',[['Friendly spar',()=>startEncounter('wildmouse'),!state.active.length],['Leave',close]]);return}
 if(p.type==='exit'){travel('trail');return}
 if(p.type==='keeper'){
 state.quest.started=true;
 if(state.quest.guardian&&!state.quest.reward){state.quest.reward=true;state.mana=Math.min(MANA_CAP,state.mana+2);open('A spring worth saving','Ada watches clear water return to the orchard. “You listened, and they answered.” Your mana capacity increases permanently by 2. Take the good news home to Rowan in Mossmere village. Follow the western signs through Lanternwood and the clearing.',[['Keep exploring',close]]);return}
 open('Keeper Ada',state.quest.reward?'The spring runs clear again. Your companions are welcome here.':state.quest.pair?'The creatures have settled, but the old guardian still blocks the spring. Bring a team and prepare for two opponents.':'“The spring’s magic has become tangled. Glim and Dewdrop might trust a patient traveler. Calm the restless pair in the middle of the orchard, then approach the guardian northeast.” Rest here to recover.',[['Rest · recover',()=>{say('Your team is rested. Supplies are unchanged.');close()}],['Leave',close]]);return}
 if(p.type==='basket'){if(!state.quest.basket){state.quest.basket=true;state.berries+=1;state.coins+=6;say('An old harvest basket: 1 berry and 6 coins.')}else say('The empty basket smells faintly of apples.');render();return}
 if(p.type==='stone'&&pactMemory('snail').helpStarted&&!pactMemory('snail').helpDone){open('The blocked channel','A fallen branch has wedged beneath the mossy stone. Clear it to help Dewdrop.',[['Lift the branch',()=>{pactMemory('snail').helpDone=true;save();open('Water runs clear','The pool begins to fill with fresh water. Return to Dewdrop for your guaranteed pact.',[['Return to the trail',close]])}],['Leave',close]]);return}
 if(p.type==='stone'){open('A warning in the moss','“Do not silence the spring. Give its water somewhere to go.” The guardian is protecting a blocked channel, not hoarding treasure.',[['Leave',close]]);return}
 if(p.type==='moth'||p.type==='snail'){beginNegotiation(p.type);return}
 if(p.type==='pair'){open('The restless pair','A Whisk and Glim are circling the path. Plan one move for each companion, then resolve in Speed order. A defeated creature cannot act. Queued moves cancel if their chosen target falls.',[['Begin challenge',()=>startEncounter('pair'),!state.active.length],['Leave',close]]);return}
 if(p.type==='guardian'){if(!state.quest.pair){open('The spring is sealed','The guardian will not let you approach while the restless pair is still agitated. Look for them in the middle of the orchard.',[['Leave',close]]);return}open('Guardian of the old spring',state.quest.guardian?'The guardian lowers its head in recognition. You can spar again.':'An old bark-backed boar and a Dewdrop stand before the spring. Defeat them to open the channel. Recommended: two companions around level 3, or a trained Bramble with healing draughts. Check the visible enemy intentions before resolving each round.',[['Challenge guardian',()=>startEncounter('guardian'),!state.active.length],['Leave',close]]);}
}

const pactRules={
 moth:{label:'Wild encounter',clue:'Glim watches your berry pouch, but startles at sudden movement. Give it space before offering food.',offers:[{id:'berries',label:'Offer 2 berries',resource:'berries',cost:2,chance:.55}]},
 snail:{label:'Scripted encounter',clue:'Dewdrop nudges a shiny coin, then looks toward its blocked water channel. Coins interest it; helping would earn its trust completely.',offers:[{id:'coins',label:'Offer 6 coins',resource:'coins',cost:6,chance:.65}]},
 boar:{label:'Territorial encounter',clue:'Bramble plants its feet and sizes you up. It respects a strong challenger and keeps glancing at your coins.',offers:[{id:'coins',label:'Offer 8 coins',resource:'coins',cost:8,chance:.5},{id:'battle',label:'Offer a pact after your victory',chance:.8}]}
};
let negotiation=null;
function pactMemory(k){return state.pactProgress[k]??=( {failures:0,calm:false,proven:false,helpStarted:false,helpDone:false,returnAt:0} )}
function pactChance(k,offer){const p=pactMemory(k);return p.failures>=3?1:Math.min(.95,offer.chance+p.failures*.15+(k==='moth'&&p.calm?.15:0))}
function beginNegotiation(k){
 if(k==='snail'){dewdropVisit();return}
 if(state.party.includes(k)){ownedEncounter(k);return}
 const p=pactMemory(k);if(state.steps<p.returnAt){say(species[k].name+' needs a little space. Explore '+(p.returnAt-state.steps)+' more steps, then return. Your progress toward a pact is kept.');return}
 negotiation={k,attempts:0};negotiationView();
}
function negotiationView(){
 const k=negotiation.k,p=pactMemory(k),rule=pactRules[k];
 const choices=[];
 if(k==='moth'&&!p.calm)choices.push(['Speak softly and give it space',()=>{p.calm=true;save();negotiationView()}]);
 for(const offer of rule.offers){
 if(offer.id==='battle'&&!p.proven)continue;
 const chance=Math.round(pactChance(k,offer)*100);
 choices.push([offer.label+' · '+chance+'% chance',()=>attemptPact(offer.id),offer.resource&&state[offer.resource]<offer.cost]);
 }
 if(k==='boar'&&!p.proven)choices.push(['Prove yourself in battle',()=>{negotiation=null;startBattle(true)},!state.active.length]);
 if(k==='snail')choices.push([p.helpDone?'Accept grateful pact · guaranteed':p.helpStarted?'Review the blocked channel favor':'Ask how to help · guaranteed pact reward',()=>{
 if(p.helpDone){negotiation=null;pact(k);return}
 p.helpStarted=true;open('A little room to flow','Dewdrop follows a trickle toward the mossy stone south of the pool. Inspect that stone and clear the branch blocking its channel. Return here afterward: the pact is guaranteed.',[['Go help',()=>{negotiation=null;close()}]]);
 }]);
 choices.push(['Leave for now',()=>{negotiation=null;close()}]);
 const note=p.failures?'Your previous offers built trust. '+p.failures+' appropriate offer(s) declined.':'';
 open(species[k].name+' · '+rule.label,spriteHTML(k)+'<br>'+rule.clue+(k==='moth'&&p.calm?'<br>Glim is calmer now. Berry offers are more likely to succeed.':'')+'<br>'+note+'<br><strong>Offers are consumed even if declined.</strong> Each appropriate failure improves your next roll; after three failures, the next appropriate offer is guaranteed.',choices);
}
function attemptPact(id,rng=Math.random){
 if(!negotiation)return false;if(state.party.includes(negotiation.k)){const k=negotiation.k;negotiation=null;ownedEncounter(k);return false}const k=negotiation.k,p=pactMemory(k),offer=pactRules[k].offers.find(o=>o.id===id);
 if(!offer||offer.id==='battle'&&!p.proven||offer.resource&&state[offer.resource]<offer.cost)return false;
 const chance=pactChance(k,offer);if(offer.resource)state[offer.resource]-=offer.cost;
 negotiation.attempts++;
 if(chance===1||rng()<chance){negotiation=null;pact(k);return true}
 p.failures++;const retreat=negotiation.attempts>=2;
 if(retreat)p.returnAt=state.steps+8;
 save();
 open('Not quite ready',species[k].name+' '+(k==='moth'?'takes the berries, but flutters just out of reach.':k==='snail'?'tucks the coin beside its shell, still considering you.':offer.id==='battle'?'acknowledges your strength, but hesitates to commit.':'sniffs the coins, but keeps its distance.')+'<br>No pact this time. Your next appropriate offer has better odds.'+(retreat?'<br>It needs a break. Walk 8 steps and return; the improved odds will remain.':''),retreat?[['Give it space',()=>{negotiation=null;close()}]]:[['Try another approach',negotiationView],['Leave',()=>{negotiation=null;close()}]]);
 return false;
}
function ownedEncounter(k){open('A familiar species',spriteHTML(k)+'<br>You already travel with a '+species[k].name+'. This is a different wild individual. Chapter One allows one companion of each species; no gifts are needed here.',[['Friendly spar',()=>startEncounter('practice-'+k),!state.active.length],['Leave',close]])}
function boarTraining(){ownedEncounter('boar')}

// Dewdrop's side channel: progression is saved; unfinished animations restart safely.
let beeAction=null;
function beeJournal(){const p=pactMemory('snail');if(!p.helpStarted)return '';const goal=p.helpDone?'✓ Side channel restored. '+(state.party.includes('snail')?'Dewdrop is your companion.':'Return to Dewdrop beside the orchard pool for a guaranteed pact.'):!p.beeSeen?'Inspect the hollow log at the mossy channel, south of the orchard pool.':!p.beeAgreed?'Ask Mara in Mossmere village about the bees.':!p.beeSupplies?'Collect Mara’s free smoker and hive box at Pip’s shop.':!p.beeMoved?'Meet Mara at the hollow log south of the orchard pool.':'The bees are safely relocated. Help Mara move the log.';return '<p class="intent"><b>Dewdrop · A home for everyone</b><br>'+goal+'</p>'}
function dewdropVisit(){const p=pactMemory('snail');p.helpStarted=true;negotiation=null;
 if(p.helpDone){open('A shell full of springwater',spriteHTML('snail')+'Dewdrop fills its shell, gives a pleased little wiggle, and stretches toward your hand. You made room for both the snail and the bees.',state.party.includes('snail')?[['Enjoy the flowing water',close]]:[['Make a pact · guaranteed',()=>pact('snail')],['Let it enjoy the pool for now',close]]);return}
 open('A thirsty little neighbor',spriteHTML('snail')+'Dewdrop tries to catch the thin trickle below the pool. It nudges the hollow log south of the water, then abruptly retreats at a sharp buzzing sound.<br><br><b>Inspect the log at the mossy channel south of the pool.</b> Something else lives there.',[['Take a closer look',close]]);
}
function beeInteract(node){const p=pactMemory('snail');
 if(node.type==='stone'){p.helpStarted=true;
 if(p.helpDone){open('Room for everyone','Clear water runs through the side channel. The empty log rests on the bank; the bees have a new home beside Mara’s garden.',[['Leave',close]]);return true}
 if(!p.beeSeen){p.beeSeen=true;open('That log is occupied','Bees stream from a hollow in the wood. Dewdrop ducks behind its shell.<br><br>Moving it now would disturb their nest. <b>Mara in Mossmere village keeps bees.</b> Ask her to help move the colony safely.',[['Leave the hive undisturbed',close]]);return true}
 if(!p.beeSupplies){open('A home in the hollow',p.beeAgreed?'Mara needs her smoker and an empty hive box. Pip has set them aside in the village shop.':'The bees are settled here. Ask Mara in Mossmere village for help before moving their log.',[['Leave',close]]);return true}
 if(!p.beeMoved){open('Mara’s careful hands','“A little smoke keeps them calm while I move their home. Hold the box steady.” Mara lights her enclosed smoker; the surrounding grass stays clear.<br><br>You will help while she handles the hive.',[['Hold the hive box for Mara',()=>beginBeeAction('hive','player')],['Come back later',close]]);return true}
 open('One last obstruction','The hive is safely relocated. The empty log still dams Dewdrop’s side channel. Mara rolls up her sleeves.',[
 ['Bramble · brace and push',()=>beginBeeAction('log','boar'),!state.active.includes('boar')],
 ['Frond · loosen the muddy bank',()=>beginBeeAction('log','fern'),!state.active.includes('fern')],
 ['Help Mara roll the log',()=>beginBeeAction('log','player')],['Leave for now',close]]);return true}
 if(node.type==='neighbor'&&p.beeSeen){open('Mara · the village beekeeper',p.beeMoved?'“They have taken to the garden. And your little water-loving friend has its stream back, I hope?”':p.beeSupplies?'“Meet me at the hollow log in the orchard. I’ll bring my veil.”':'“We can give both of them a home. Smoke calms the bees while I move the colony. Pip keeps my enclosed smoker and spare hive boxes.”',[
 ...(!p.beeAgreed?[['Ask Mara to help relocate the hive',()=>{p.beeAgreed=true;open('A neighbor lends a hand','“Of course. Collect the smoker and hive box from Pip’s shop here in town. They’re mine to lend—no coins needed. I’ll meet you at the orchard log.”',[['Visit Pip’s shop',close]])}]]:[]),
 ['Leave',close]]);return true}
 if(node.type==='shop'&&p.beeAgreed&&!p.beeSupplies){open('Pip · supplies for Mara','“A smoker, dry fuel, and an empty hive box. Mara already told me. Bring everything back in one piece, including yourself.”',[
 ['Collect the borrowed supplies · free',()=>{p.beeSupplies=true;close();storyFeedback('Smoker and hive box collected. Mara will meet you at the orchard log.');save()}],['Shop for berries',()=>chapterInteract(node)],['Leave',close]]);return true}
 return false;
}
function beginBeeAction(kind,helper){const p=pactMemory('snail');if(beeAction||!p.beeSupplies||(kind==='hive'?p.beeMoved:!p.beeMoved||p.helpDone))return;close();modal='beeAction';beeAction={owner:state,started:performance.now(),kind,helper};storyFeedback(kind==='hive'?'You steady the box. Mara gently smokes the hollow and transfers the colony…':helper==='fern'?'Frond digs under the muddy bank. Mara steadies the empty log…':helper==='boar'?'Bramble plants its feet and pushes. The empty log begins to roll…':'You and Mara lean into the empty log together…')}
function updateBees(){if(!beeAction)return;if(beeAction.owner!==state){beeAction=null;if(modal==='beeAction')modal=null;return}if(performance.now()-beeAction.started<4200)return;const a=beeAction,p=pactMemory('snail');beeAction=null;modal=null;
 if(a.kind==='hive'){p.beeMoved=true;storyFeedback('The bees are safe. Now help Mara move the empty log.');open('A new home for the bees','Mara settles the last bees into their box and closes her smoker.<br><br>“I’ll take them to the village garden. Now we can move this log without upsetting anyone.”<br><br><b>The hive is safe. Inspect the log again to clear the channel.</b>',[['Help with the log',close]])}
 else{p.helpDone=true;p.beeHelper=a.helper;discoveryXP(20);storyFeedback('Water flows again! Dewdrop fills its shell. Return to it for a guaranteed pact.');open('Water, at last!',spriteHTML('snail')+'Water curls around the mossy stones and spills down the reopened channel. Dewdrop fills its shell and wiggles with delight.<br><br><b>Channel restored · +20 XP for each recruited companion.</b><br>Return to Dewdrop beside the pool. Its grateful pact is guaranteed.',[['Watch the water flow',close]])}save();
}
function drawBee(x,y,t,i){const dx=Math.round(Math.sin(t/430+i*2)*7),dy=Math.round(Math.cos(t/370+i)*4);ctx.fillStyle='#dce8d3';ctx.fillRect(x+dx-2,y+dy-3,3,2);ctx.fillRect(x+dx+2,y+dy-3,3,2);ctx.fillStyle='#edc45c';ctx.fillRect(x+dx-2,y+dy,6,3);ctx.fillStyle='#463d32';ctx.fillRect(x+dx,y+dy,2,3)}
function drawBeeLog(t){const p=pactMemory('snail'),active=beeAction&&beeAction.owner===state,progress=active?Math.min(1,(performance.now()-beeAction.started)/4200):0;ctx.save();
 const offset=p.helpDone?23:active&&beeAction.kind==='log'?Math.round(progress*23):0,x=389+offset,y=323;
 ctx.fillStyle='#493b2d';ctx.fillRect(x,y+3,26,17);ctx.fillStyle='#8e6540';ctx.fillRect(x+2,y+2,24,15);ctx.fillStyle='#b58b52';ctx.fillRect(x+3,y+4,20,3);ctx.fillStyle='#63482f';ctx.fillRect(x+8,y+10,15,3);ctx.fillStyle='#302f26';ctx.fillRect(x+2,y+9,6,7);ctx.fillStyle='#789051';ctx.fillRect(x+14,y,9,4);
ctx.restore();}
function drawBees(t){const p=pactMemory('snail');ctx.save();
 if(state.area==='village'&&p.beeMoved){ctx.fillStyle='#654a31';ctx.fillRect(457,248,23,4);ctx.fillStyle='#b58a50';ctx.fillRect(459,229,19,19);ctx.fillStyle='#e1bd79';ctx.fillRect(457,226,23,4);ctx.fillStyle='#3f372d';ctx.fillRect(465,241,7,3);for(let i=0;i<3;i++)drawBee(468+i*6,221,t,i)}
 if(state.area==='orchard'){
 const active=beeAction&&beeAction.owner===state,progress=active?Math.min(1,(performance.now()-beeAction.started)/4200):0;
 // A narrow surface-water ribbon is decorative; existing terrain collision is unchanged.
 ctx.fillStyle='#8c9670';ctx.fillRect(497,287,9,52);ctx.fillRect(398,331,106,9);ctx.fillStyle=p.helpDone?'#71acb2':'#7b7660';ctx.fillRect(499,287,5,50);ctx.fillRect(401,333,103,5);ctx.fillRect(399,336,5,23);
 if(p.helpDone){ctx.fillStyle='#c2ded0';for(let i=0;i<8;i++)ctx.fillRect(402+((i*13+Math.floor(t/100))%98),334,4,1)}
 const x=389+(p.helpDone?23:0),y=323;
 if(!p.beeMoved){for(let i=0;i<3;i++)drawBee(x+8+i*6,y-8,t,i)}
 if(p.beeSupplies&&!p.helpDone){sprite(ctx,'townsperson',437,350,1,false,'left');ctx.fillStyle='#bd915c';ctx.fillRect(425,320,17,12);ctx.fillStyle='#684b32';ctx.fillRect(424,318,19,3)}
 if(active&&beeAction.kind==='hive'){ctx.fillStyle='#7c8984';ctx.fillRect(421,338,7,10);ctx.fillStyle='#d1d6c1';for(let i=0;i<5;i++){const rise=(t/65+i*9)%37;ctx.globalAlpha=.65*(1-rise/45);ctx.fillRect(417-Math.round(rise/3)+Math.sin(i+t/300)*3,332-rise,8+rise/4,5)}ctx.globalAlpha=1;}
 if(active&&beeAction.kind==='log'&&beeAction.helper!=='player'){sprite(ctx,beeAction.helper,385,350,1,false,'right',t+100);if(beeAction.helper==='fern'){ctx.fillStyle='#ae8354';for(let i=0;i<6;i++)ctx.fillRect(381+i*4,343-Math.abs(Math.sin(t/130+i))*10,3,3)}}
 if(p.helpDone&&!state.party.includes('snail')){ctx.fillStyle='#c3e1dc';ctx.fillRect(488,258+Math.round(Math.sin(t/150)*2),3,3);ctx.fillRect(504,254,2,2)}
 }ctx.restore();
}

function showPip(){open('Pip’s provisions','<b>'+state.berries+' berries · '+state.potions+' healing draughts · '+state.coins+' coins</b><br><br>Raw berries are for Pact offers and woodland favors. A healing draught restores <b>24 HP to the acting companion</b> in battle and uses its turn. Brew only what you want to spend; there is no brewing fee.',[
 ['Brew 1 draught · 2 berries',()=>{if(state.berries<2)return;state.berries-=2;state.potions++;showPip()},state.berries<2],
 ['Buy 1 draught · 6 coins',()=>{if(state.coins<6)return;state.coins-=6;state.potions++;showPip()},state.coins<6],
 ['Buy 2 berries · 6 coins',()=>{if(state.coins<6)return;state.coins-=6;state.berries+=2;showPip()},state.coins<6],['Leave',close]])}
let rabbitFlight=null;
function rabbitChoices(){open('Rabbits behind the embers','Two rabbits shrink away from the smoke. The brush blocks their escape; water trickles through the muddy bank. Choose how to help.',[
 ['Dewdrop · soak the brush',()=>beginFieldAction('animals','snail'),!state.active.includes('snail')],
 ['Bramble · force a passage (may startle them)',()=>beginFieldAction('animals','boar'),!state.active.includes('boar')],
 ['Frond · dig a sheltered escape',()=>beginFieldAction('animals','fern'),!state.active.includes('fern')],
 ['Bucket + careful clearing',()=>beginFieldAction('animals','player'),!state.fire.bucket],
 ['Leave · bucket is beside the stream',close]])}
function finishRabbits(method){const f=state.fire;if(f.animals)return;f.animals=true;f.rabbitScattered=false;f.rabbitMethod=method;const reward=method==='snail'?'Runoff uncovers a sealed healing draught. +1 draught.':method==='fern'?'Frond uncovers a small buried fruit cache. +1 berry.':method==='boar'?'The rabbits settle and follow the open path to safety.':'The rabbits follow your careful movements into the safe trees.';
 if(method==='snail')state.potions++;if(method==='fern')state.berries++;rabbitFlight={owner:state,started:performance.now(),method};close();discoveryFeedback('Rabbits rescued. '+reward,20);save();}
function rabbitFollowup(){open('Frightened, not trapped','Tiny tracks lead to this bush. The rabbits are unharmed, but Bramble’s crash sent them hiding. You can settle them without a fight.',[
 ['Leave a berry · costs 1',()=>{if(state.berries<1)return;state.berries--;finishRabbits('boar')},state.berries<1],
 ['Frond · approach beneath the roots',()=>finishRabbits('boar'),!state.active.includes('fern')],
 ['Sit quietly and leave the escape route clear',()=>{close();modal='rabbitWait';rabbitWait={owner:state,started:performance.now()};storyFeedback('You sit back from the bush. One rabbit peeks out; the other follows…')}],['Return later',close]])}
let rabbitWait=null;
function updateRabbits(){if(!rabbitWait)return;if(rabbitWait.owner!==state){rabbitWait=null;if(modal==='rabbitWait')modal=null;return}if(performance.now()-rabbitWait.started>=3000){rabbitWait=null;modal=null;finishRabbits('boar')}}
function rabbitJournal(){const f=state.fire;if(!f.started)return '';return '<p class="intent"><b>Grove rabbits</b><br>'+(f.animals?'✓ Safe beside the western entrance.':f.rabbitScattered?'Follow the tiny tracks northeast to the bush above the pond. A quiet approach costs nothing.':'Optional: rescue the rabbits northwest of the burning branch. The bucket is beside the stream.')+'</p>'}
function cubJournal(){const c=state.curiosity;if(c.phase==='hidden'||c.bonded)return '';const text=c.phase==='seen'?'Inspect the thicket again to choose how to release the taut twine.':c.phase==='manual'?'Reach the knot from the tile immediately right of the thicket.':c.phase==='loose'?'Reach the paw from directly above the thicket.':c.phase==='rescuing'?'Your helper is releasing the branch.':c.phase==='leading'?'The cub pauses and looks back. Approach when you are ready; it will wait.':c.returnReady?'The cub is back at the thicket and recognizes you.':'Fern Hollow discovered. Check the thicket on a later visit.';return '<p class="intent"><b>Bramble cub</b><br>'+text+'</p>'}
function drawRabbitEncounter(t){const f=state.fire,age=fireAction?.kind==='animals'?performance.now()-fireAction.started:0;
 if(!f.animals&&!f.rabbitScattered){forestPiece([1260,522,270,185],151,100,45,28);drawRabbit(164+Math.round(Math.sin(t/170)),94);drawRabbit(179,87);fireParticle(158,123,t,.35);}
 if(f.rabbitScattered){forestPiece([230,522,210,181],190,55,33,28);drawRabbit(199,76);drawRabbit(214,70);ctx.fillStyle='#b5a37d';for(let i=0;i<5;i++){ctx.fillRect(176+i*5,103-i*5,2,2);ctx.fillRect(181+i*5,104-i*5,2,2)}}
 if(f.animals){const flight=rabbitFlight?.owner===state?Math.min(1,(performance.now()-rabbitFlight.started)/2200):1;const x=flight<.35?172+(78-172)*(flight/.35):78,y=flight<.35?100:100+(268-100)*((flight-.35)/.65);drawRabbit(x,y-Math.abs(Math.sin(t/110))*2);drawRabbit(x+15,y+8);}
 if(age&&fireAction.helper==='fern'){ctx.fillStyle='#473d2c';ctx.fillRect(157,118,30,6)}
}

function chapterInteract(p){
 if(!['village','trail'].includes(state.area))return false;
 if(p.type==='gate'){travel('clearing');return true}
 if(p.type==='west'){travel('clearing');return true}
 if(p.type==='east'){travel('orchard');return true}
 if(p.type==='home'){
 open('A roof in Mossmere','Your boots wait beside the door. Whisk has claimed the sunny windowsill. Companions recover fully after every battle. Resting does not replenish berries or draughts.',[['Rest · recover',()=>{close();say('Your companions are rested. Supplies are unchanged.')}],['Back outside',close]]);return true}
 if(p.type==='shop'){showPip();return true}
 if(p.type==='rowan'){
 state.chapter.briefed=true;
 if(state.fire.reported){open('Rowan, keeper of the well','“You kept the fire from spreading, and gave a frightened creature room to breathe. Take your journal to the hills. We will look after the grove.”', [['Leave',close]]);return true}
 open('Rowan, keeper of the well',state.chapter.returned?'“Still taking that little mouse everywhere? Good. A long friendship has a strength of its own.”':state.quest.reward?'“The well is running again!”':state.quest.guardian?'“Give Ada a moment to check the spring, then bring me her news.”':state.quest.started?'“Ada knows the orchard. Listen to her, and give frightened creatures room.”':'“Ada needs a hand: check the meadow garden, gather medicinal plants in Lanternwood, and see what is upsetting the orchard. Our well is fading too. Whisk already trusts you; you can learn with Frond and Bramble on the way.”',[
 ...(!state.chapter.supplies?[['Ask about preparing for travel',()=>{state.chapter.supplies=true;open('Preparing for the trail','Pip can brew 2 berries into 1 healing draught. Draughts heal 24 HP in battle and use a turn; raw berries are for creatures. Keep some for offers, or brew them for a difficult fight.<br><br>Whisk already trusts you. Other sprites may want food, a favor, or proof of your strength.<br><br><b>Levels</b> grow with battle experience. <b>Bond</b> grows slowly while companions travel and fight at your side. Summoning reserves mana; dismissing frees it.<br><br>East: clearing → Lanternwood → Ada’s orchard. Check in with Ada after the errands. She knows what the woodland needs.',[['Set out',close]])}]]:[]),
 ['Ask about pacts',()=>open('Friends, not trophies','Use P to view your creatures, swap active companions, and inspect their moves. Each has a basic attack and a signature move. Only active companions earn bond through use. Early bond bonuses are small; a long-used friend can grow into a powerful partner.',[['Back',()=>chapterInteract(p)]])],['Leave',close]]);return true}
 if(p.type==='notice'){open('Mossmere noticeboard','<b>The quiet spring</b><br>Rowan requests help at the village well. Ada is waiting beyond Lanternwood.<br><br><b>Travel notes</b><br>Walk beside signs, people, or creatures and press E. No random fights: approach a visible creature when you want a challenge.<br><br>The northern trail cache holds supplies. A southern pact marker rewards curious travelers.',[['Leave',close]]);return true}
 if(p.type==='directions'){open('Lanternwood crossroads','← West: clearing and Mossmere<br>→ East: Ada’s orchard<br>↑ North: ranger’s supply cache<br>↓ Southeast: old pact marker<br><br>The wild Whisk on this trail enjoys friendly sparring. No surprise battles here.',[['Continue',close]]);return true}
 if(p.type==='cache'){if(state.chapter.cache){say('The ranger’s cache is empty. You put the lid back to keep the rain out.');return true}state.chapter.cache=true;state.potions+=1;state.coins+=6;open('A useful detour','Under the dry leaves: <b>1 healing draught and 6 coins</b>.<br>A note reads, “Take what you need. Come home safely.”', [['Pack the supplies',close]]);return true}
 if(p.type==='lesson'){if(state.chapter.lesson){open('The old pact marker','“A pact is made once. Trust is made every day.” You have already learned from this marker.',[['Leave',close]]);return true}if(!state.active.length){open('The old pact marker','The carvings glow faintly. Summon at least one companion to study them together.',[['Leave',close]]);return true}state.chapter.lesson=true;const rewards=state.active.map(k=>gainXP(k,20));open('A lesson shared','You and your active companions trace the old carvings. <b>20 XP each</b> — practice for their levels, while lasting bond takes time together.<br><br>'+rewards.join('<br>'),[['Return to the trail',close]]);return true}
 if(p.type==='trailmouse'){open('A woodland playmate','A wild Whisk darts between the roots, then challenges your companions to a friendly spar. Your team recovers fully afterward.',[['Friendly spar',()=>startEncounter('wildmouse'),!state.active.length],['Leave',close]]);return true}
 return true;
}

document.addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&(e.key==='Enter'||e.key===' '))return;const key=e.key.toLowerCase();if(key==='escape'&&modal==='party'){closeParty();return}if(key==='p'){if(modal==='party')closeParty();else showParty();return}if(modal==='party'){if(e.key==='Tab'){const list=[...$('partySheet').querySelectorAll('button:not(:disabled),summary')];const i=list.indexOf(document.activeElement);e.preventDefault();list[(i+(e.shiftKey?-1:1)+list.length)%list.length].focus()}return}const dirs={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};if(dirs[key]){e.preventDefault();if(performance.now()-lastMove>115){move(...dirs[key]);lastMove=performance.now()}}if(key==='e'){e.preventDefault();interact()}});
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(...b.dataset.move.split(',').map(Number)));$('touchE').onclick=interact;$('rest').onclick=rest;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=`Sound: ${sound?'on':'off'}`;beep()};$('reset').onclick=()=>{if(modal)return;open('Start a fresh expedition?','This replaces the progress saved in this browser.',[['Keep my progress',close],['Start fresh',()=>{state=initial();say('A new adventure begins in Mossmere. Speak to Rowan by the village well.');close()}]])};
$('areaGuide').onclick=showAreaGuide;$('partyButton').onclick=()=>showParty();document.addEventListener('visibilitychange',()=>{lastActivity=null});
$('exportSave').onclick=exportSave;$('importSave').onclick=()=>{if(!modal)$('saveFile').click();else say('Close the current screen before importing.');};$('saveFile').onchange=e=>importSave(e.target.files[0]);
say(migrated?'Your earlier pacts are preserved. Accelerated prototype bond was converted into levels; the slower bond journey starts fresh.': 'Whisk is already at your side. Speak to Rowan by the village well to begin your journey. WASD or arrows move; E interacts; P opens your party.');render();requestAnimationFrame(draw);
