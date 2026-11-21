function startBattle(tame){startEncounter(tame?'tame':'spar')}
function startEncounter(kind){
 if(!state.active.length)return;
 const practice=kind.startsWith('practice-')&&species[kind.slice(9)]?kind.slice(9):null;
 const level=kind==='quilcoal'?3:kind==='tame'?1:kind==='pair'?2:kind==='guardian'?3:Math.max(...state.active.map(k=>state.level[k]));
 const defs=practice?[[practice,statAt(practice,level,0).hp,statAt(practice,level,0).atk]]:kind==='quilcoal'?[['quilcoal',90,10]]:kind==='wildmouse'?[['mouse',28,5]]:kind==='pair'?[['mouse',27,5],['moth',24,5]]:kind==='guardian'?[['boar',66,10],['snail',34,6]]:[['boar',(kind==='tame'?40:58)+(level-1)*10,7+(level-1)*2]];
 battle={kind,fear:kind==='quilcoal'?6:0,enemyLevel:level,tame:kind==='tame',enemies:defs.map(([k,hp,atk],i)=>({...statAt(k,level,0),id:i,k,name:kind==='guardian'&&i===0?'Spring Guardian':species[k].name,hp,max:hp,atk,ready:2,weakened:false,shield:false,guard:false})),units:state.active.map(k=>({...stats(k),k,name:species[k].name,max:stats(k).hp,ready:1,weakened:false,shield:false,guard:false,plan:null})),turn:1,fx:[],busy:false,log:'Plan one action per companion, then resolve the round in Speed order.'};
 planEnemies();modal='battle';lastActivity=null;canvas.hidden=true;$('hint').hidden=true;$('overlay').style.position='relative';battleView();
}
function actingUnit(){return battle?.units.find(u=>u.hp>0&&!u.plan)}
function enemyTarget(index=0){const alive=battle.units.filter(u=>u.hp>0);return alive[(battle.turn-1+index)%alive.length]}
function matchup(element,defender){if(!element)return 1;if(ELEMENT_BEATS[element]===defender)return 1.25;if(ELEMENT_BEATS[defender]===element)return .75;return 1}
function attackElement(actor,action){return action==='special'?(actor.nature||species[actor.k].nature):null}
function attackPower(actor,action){return action==='basic'?1:moveKind(actor)==='boar'?1.6:moveKind(actor)==='quilcoal'?1.2:.65}
function damageFor(actor,target,action){return Math.max(1,Math.round(actor.atk*attackPower(actor,action)*matchup(attackElement(actor,action),(target.nature||species[target.k].nature))*100/(100+target.def)*(actor.weakened?.5:1)*(target.shield?.5:1)*(target.guard?.5:1)))}
function effectiveSpeed(a){return Math.round(a.spd*(a.hasteThrough>=battle.turn&&a.hasteFrom<=battle.turn?1.5:1))}
function turnOrder(){return [...battle.units.filter(u=>u.hp>0).map((actor,i)=>({actor,side:'ally',rank:i})),...battle.enemies.filter(e=>e.hp>0).map((actor,i)=>({actor,side:'enemy',rank:100+i}))].sort((a,b)=>effectiveSpeed(b.actor)-effectiveSpeed(a.actor)||a.rank-b.rank)}
function wheelHTML(){return `<details class="wheel"><summary>Nature wheel & combat rules</summary><p class="wheel-chain">Fire → Wind → Lightning → Earth → Water → Fire</p><p>Each nature beats the next: ×1.25 damage. The reverse matchup deals ×0.75. All other matchups are neutral. Basic attacks are physical and ignore the wheel; healing and shields do too.</p><p>Damage = Attack × move power × matchup × 100 ÷ (100 + Defense), then protection and Weaken. Rounded once; minimum 1.</p><p>Weaken halves the next damaging move and remains until used. Shelter and Guard each halve the next incoming hit. Reapplying the same effect does not stack; different effects multiply.</p><p>Burn deals 8% of maximum HP (minimum 2) at the end of each round for two rounds. Reapplying refreshes its duration.</p><p>Quickening Dust raises team Speed by 50% for the next two rounds; it does not reorder the current round. Highest Speed acts first. Ties: your team before enemies, then party order. Defeated targets cancel a queued move; it never switches targets. You can edit an individual planned action or clear the whole plan before resolving. Canceled moves spend no draughts or cooldown. Signatures recharge for two full rounds after use.</p></details>`}
function moveKind(actor){return actor.movesKey||actor.k}
function actorMoves(actor){return moves[actor.movesKey||actor.k]}
function planLabel(actor){const p=actor.plan;if(!p)return 'Choose an action';const action=p.action==='special'?actorMoves(actor).special:p.action==='basic'?actorMoves(actor).basic:p.action==='potion'?'Healing draught':p.action==='soothe'?'Speak softly':'Guard';const target=p.action==='potion'?battle.units.find(v=>v.k===p.targetKey)?.name:p.action==='special'&&['fern','snail'].includes(moveKind(actor))?(battle.units.find(u=>u.k===p.targetKey)?.name||battle.enemies.find(e=>e.id===p.ally)?.name):['basic','special'].includes(p.action)?(battle.enemies.find(e=>e.id===p.enemyId)?.name||battle.units.find(u=>u.k===p.targetKey)?.name):null;return action+(target?' → '+target:'')}
function statusText(actor){return [actor.hasteThrough>=battle.turn?'Quickening · '+(actor.hasteFrom>battle.turn?'next 2 rounds':(actor.hasteThrough-battle.turn+1)+' round(s)'):'',actor.burnTurns?'Burn · '+actor.burnTurns+' round(s)':'',actor.weakened?'Weaken · next attack':'',actor.shield?'Shelter · next hit':'',actor.guard?'Guard · next hit':''].filter(Boolean).join(' · ')}
function battleView(){
 const b=battle,u=actingUnit();if(!b)return;
 if(!b.enemies.some(e=>e.id===b.selectedEnemy&&e.hp>0))b.selectedEnemy=(b.enemies.find(e=>e.hp>0)||b.enemies[0]).id;
 const target=b.enemies.find(e=>e.id===b.selectedEnemy),reserved=b.units.filter(v=>v.plan?.action==='potion').length;
 const order=turnOrder().map(({actor,side})=>`<span class="order-pill ${side} ${b.current===actor?'current':''}">${side==='ally'?'◆':'◇'} ${actor.name} <b>${effectiveSpeed(actor)}</b></span>`).join('<span aria-hidden="true">→</span>');
 const card=(actor,side)=>`<div class="battleunit ${u===actor?'acting':''}${fxClass(side,side==='ally'?actor.k:actor.id)}">${fxMarkup(side,side==='ally'?actor.k:actor.id)}${spriteHTML(actor.k,side==='enemy'?'left':'right')}<br><b>${actor.name}</b><small>${actor.nature||species[actor.k].nature} · ${actor.hp}/${actor.max} HP<br>ATK ${actor.atk} · DEF ${actor.def} · SPD ${effectiveSpeed(actor)}</small><div class="hp"><i style="width:${actor.hp/actor.max*100}%"></i></div><small>${statusText(actor)}</small><small>Signature: ${b.turn>=actor.ready?'ready':'ready in '+(actor.ready-b.turn)+' round(s)'}</small>${side==='ally'?'<small>'+ (actor.hp<=0?'Fainted':planLabel(actor))+'</small>'+(!b.busy&&actor.hp>0&&actor.plan?'<button data-edit-plan="'+actor.k+'">Edit action</button>':''):''}</div>`;
 $('overlay').hidden=false;$('overlay').innerHTML=`<div class="dialog combat"><p class="eyebrow">ROUND ${b.turn} · ${b.busy?'RESOLVING':u?'PLAN YOUR MOVES':'READY TO RESOLVE'}</p><div class="turn-order" aria-label="Turn order, fastest first">${order}</div><p class="muted">Speed order · ◆ Your team · ◇ Opponents</p><div class="battlefield ${b.kind==='quilcoal'&&b.fear>=4?'frightened':''}"><div class="allies">${b.units.map(v=>card(v,'ally')).join('')}</div><div class="allies">${b.enemies.map(e=>`<div class="enemy-slot ${e.id===b.selectedEnemy?'targeted':''}">${card(e,'enemy')}<button data-enemy="${e.id}" aria-pressed="${e.id===b.selectedEnemy}" ${e.hp<=0||b.busy?'disabled':''}>${e.hp<=0?'Defeated':e.id===b.selectedEnemy?'Selected target':'Target '+e.name}</button></div>`).join('')}</div></div><p class="intent">${b.enemies.filter(e=>e.hp>0).map(intentText).join('<br>')}</p>${b.kind==='quilcoal'?`<p class="intent"><b>Fear: ${b.fear}/6</b> · Soothing −2; Guard or Whisk’s Weaken −1; other attacks +1.<br>${fireReady()?'Quilcoal is ready. Lower your guard to end this peacefully.':'Its spines rise each time you draw close.'}</p>`:''}<div class="combat-log" role="log" aria-live="polite">${(b.history||[b.log]).map(line=>'<p>'+line+'</p>').join('')}</div>${!b.busy&&u?`<h2>${u.name}: plan a move</h2><label>Enemy target <select id="enemyPick">${b.enemies.filter(e=>e.hp>0).map(e=>`<option value="${e.id}" ${e.id===b.selectedEnemy?'selected':''}>${e.name} · ${species[e.k].nature} · ${e.hp} HP</option>`).join('')}</select></label><div class="actions"><button id="basic">${actorMoves(u).basic}<small>Physical · ${damageFor(u,target,'basic')} damage now</small></button><button id="special" ${b.turn<u.ready?'disabled':''}>${actorMoves(u).special}<small>${b.turn<u.ready?'Ready in '+(u.ready-b.turn)+' round(s)':moveKind(u)==='moth'?'Team support · faster next 2 rounds':['fern','snail'].includes(moveKind(u))?'Support · choose ally below':(u.nature||species[u.k].nature)+' · '+damageFor(u,target,'special')+' damage now · ×'+matchup(u.nature||species[u.k].nature,target.nature||species[target.k].nature)}</small></button></div><p>${actorMoves(u).desc}</p>${['fern','snail'].includes(moveKind(u))?`<label>Ally target <select id="allyTarget">${b.units.filter(v=>v.hp>0).map(v=>`<option value="${v.k}">${v.name} · ${v.hp}/${v.max} HP</option>`).join('')}</select></label>`:''}<div class="actions">${b.kind==='quilcoal'?'<button id="soothe">Speak softly<small>Use this companion’s action · reduce fear by 2</small></button>':''}<button id="guard">Guard<small>Heal up to 4; halve next hit after acting</small></button><label>Draught recipient <select id="draughtTarget">${b.units.filter(v=>v.hp>0&&v.hp<v.max).map(v=>`<option value="${v.k}" ${v===u?'selected':''}>${v.name} · ${v.hp}/${v.max} HP</option>`).join('')||'<option>Everyone is healthy</option>'}</select></label><button id="potion" ${state.potions<=reserved||!b.units.some(v=>v.hp>0&&v.hp<v.max)?'disabled':''}>Healing draught · ${state.potions-reserved} available<small>Restore up to 24 HP to the chosen Pact · uses this turn</small></button></div><p class="muted">Damage previews use current effects. Faster actions can change them.</p>`:''}${b.kind==='quilcoal'?`<div class="actions"><button id="lowerGuard" ${b.busy||!fireReady()?'disabled':''}>Lower your guard · end peacefully</button></div>`:''}<div class="actions"><button id="resolve" ${b.busy||u?'disabled':''}>${b.busy?'Resolving…':'Resolve round'}</button><button id="undo" ${b.busy||!b.units.some(v=>v.plan)?'disabled':''}>Clear planned moves</button><button id="retreat" ${b.busy?'disabled':''}>Retreat</button></div>${wheelHTML()}</div>`;
 document.querySelectorAll('[data-edit-plan]').forEach(btn=>btn.onclick=()=>{if(!battle||battle.busy)return;battle.units.find(a=>a.k===btn.dataset.editPlan).plan=null;battleView()});
 document.querySelectorAll('[data-enemy]').forEach(btn=>btn.onclick=()=>selectEnemy(Number(btn.dataset.enemy)));
 if(!b.busy&&u){$('enemyPick').onchange=e=>selectEnemy(Number(e.target.value));$('basic').onclick=()=>act('basic',null,b.selectedEnemy);$('special').onclick=()=>act('special',['fern','snail'].includes(moveKind(u))?$('allyTarget').value:null,b.selectedEnemy);$('guard').onclick=()=>act('guard');if(b.kind==='quilcoal')$('soothe').onclick=()=>act('soothe');$('potion').onclick=()=>act('potion',$('draughtTarget').value)}
 if(b.kind==='quilcoal')$('lowerGuard').onclick=lowerGuard;$('resolve').onclick=resolveRound;$('undo').onclick=()=>{if(battle.busy)return;battle.units.forEach(v=>v.plan=null);battleView()};$('retreat').onclick=()=>{if(!battle.busy)finish(false,true)};render();
}
function selectEnemy(id){if(!battle||battle.busy||!battle.enemies.some(e=>e.id===id&&e.hp>0))return;battle.selectedEnemy=id;battleView()}
function battleNote(message){battle.log=message;battle.history=[...(battle.history||[]),message].slice(-8)}
function act(action,targetKey,enemyId){
 if(!battle||battle.busy)return false;const b=battle,u=actingUnit();if(!u||!['basic','special','guard','potion',...(b.kind==='quilcoal'?['soothe']:[])].includes(action))return false;
 if(action==='special'&&b.turn<u.ready||action==='potion'&&state.potions<=b.units.filter(v=>v.plan?.action==='potion').length)return false;
 const support=action==='special'&&['fern','snail'].includes(moveKind(u));
 if(action==='special'&&moveKind(u)==='moth'){u.plan={action};battleView();return true;}
 if(action==='potion'&&!b.units.some(v=>v.k===targetKey&&v.hp>0&&v.hp<v.max))return false;
 if(support&&!b.units.some(v=>v.k===targetKey&&v.hp>0))return false;
 const target=enemyId??b.selectedEnemy;if((action==='basic'||action==='special'&&!support)&&!b.enemies.some(e=>e.id===target&&e.hp>0))return false;
 u.plan={action,targetKey,enemyId:target};battleView();return true;
}
function planEnemies(){
 const b=battle;b.enemies.forEach(e=>{const living=b.enemies.filter(v=>v.hp>0),target=enemyTarget(e.id);const ally=living.slice().sort((a,c)=>a.hp/a.max-c.hp/c.max)[0];let action=b.turn>=e.ready&&b.turn>=2&&(b.kind!=='quilcoal'||b.fear>=3)?'special':'basic';if(moveKind(e)==='snail'&&ally.hp>ally.max*.8)action='basic';e.plan={action,targetKey:target?.k,ally:ally?.id}})
}

function intentText(e){const p=e.plan,special=p.action==='special';if(special&&moveKind(e)==='moth')return e.name+' plans Quickening Dust · enemy team gains 50% Speed for the next two rounds';if(special&&['snail','fern'].includes(moveKind(e))){const ally=battle.enemies.find(v=>v.id===p.ally);return e.name+' plans '+actorMoves(e).special+' on '+ally.name}const target=battle.units.find(v=>v.k===p.targetKey);return e.name+' plans '+(special?actorMoves(e).special:actorMoves(e).basic)+' on '+target.name+' · '+damageFor(e,target,p.action)+' damage with current effects'+(special&&moveKind(e)==='boar'?' · CHARGE INCOMING':'')}
function combatFX(side,id,text,kind){battle.fx.push({side,id,text,kind})}
function fxMarkup(side,id){return (battle.fx||[]).filter(f=>f.side===side&&f.id===id).map(f=>'<span class="float-number fx-'+f.kind+'">'+f.text+'</span>').join('')}
function fxClass(side,id){const f=(battle.fx||[]).find(v=>v.side===side&&v.id===id);return f?' effect-'+f.kind:''}
function pauseCombat(){return new Promise(resolve=>setTimeout(resolve,440))}
function resolveAction(actor,side){
 const b=battle,p=actor.plan;if(actor.hp<=0||!p)return;
 if(b.kind==='quilcoal'&&side==='enemy'&&fireReady()){battleNote('Quilcoal hesitates and lets its spines settle. It is watching your hands.');return;}
 if(b.kind==='quilcoal'&&side==='ally'&&p.action==='soothe'){b.fear=Math.max(0,b.fear-2);combatFX('enemy',0,'FEAR −2','heal');battleNote(actor.name+' gives Quilcoal room while you speak softly. Fear falls to '+b.fear+'/6.');return;}
 if(b.kind==='quilcoal'&&side==='ally'&&p.action==='guard')b.fear=Math.max(0,b.fear-1);
const own=side==='ally'?b.units:b.enemies,other=side==='ally'?b.enemies:b.units;
 if(p.action==='special'&&moveKind(actor)==='moth'){for(const ally of own.filter(a=>a.hp>0)){ally.hasteFrom=b.turn+1;ally.hasteThrough=b.turn+2;combatFX(side,side==='ally'?ally.k:ally.id,'SPEED +50%','shield')}actor.ready=b.turn+3;battleNote(actor.name+' scatters Quickening Dust. Team Speed +50% next round and the round after; this round’s order stays unchanged.');return;}

 const fx=(v,team,text,kind)=>combatFX(team,team==='ally'?v.k:v.id,text,kind),special=p.action==='special';
 const support=special&&['fern','snail'].includes(moveKind(actor));
 const target=support?own.find(v=>side==='ally'?v.k===p.targetKey:v.id===p.ally):other.find(v=>side==='ally'?v.id===p.enemyId:v.k===p.targetKey);
 if((p.action==='basic'||special)&&(!target||target.hp<=0)){battleNote(actor.name+' cancels '+(special?actorMoves(actor).special:actorMoves(actor).basic)+': the chosen target is down.');return}
 if(p.action==='potion'&&state.potions<1){battleNote(actor.name+' has no healing draught left.');return}
 fx(actor,side,'','lunge');
 if(p.action==='basic'||special&&!support){const amount=damageFor(actor,target,p.action),actual=Math.min(target.hp-(b.kind==='quilcoal'&&side==='ally'?1:0),amount),element=attackElement(actor,p.action),effect=matchup(element,species[target.k].nature);const raw=damageFor({...actor,weakened:false},{...target,shield:false,guard:false},p.action);const reductions=[actor.weakened?'Weaken':'',target.shield?'Shelter':'',target.guard?'Guard':''].filter(Boolean);if(b.kind==='quilcoal' && side==='ally' && !state.fire.attackedQuilcoal){
 state.fire.attackedQuilcoal=true;
 save();
 battleNote('Quilcoal recoils. It watches your hands now.');
 }
 target.hp-=actual;if(reductions.length){battleNote(reductions.join(' + ')+' reduced the hit: '+raw+' → '+amount+' damage.');fx(target,side==='ally'?'enemy':'ally','BLOCKED '+(raw-amount),'shield');}actor.weakened=false;target.shield=false;target.guard=false;fx(target,side==='ally'?'enemy':'ally','−'+actual,'hit');let msg=actor.name+' uses '+(special?actorMoves(actor).special:actorMoves(actor).basic)+' on '+target.name+': '+actual+' '+(element||'physical')+' damage.'+(effect>1?' Advantage ×1.25!':effect<1?' Resisted ×0.75.':'');if(special&&moveKind(actor)==='mouse'&&target.hp>0){target.weakened=true;fx(target,side==='ally'?'enemy':'ally','WEAKEN','debuff');msg+=' Next damaging move halved.'}if(special&&moveKind(actor)==='quilcoal'&&target.hp>0){target.burnTurns=2;msg+=' Burn lasts two rounds.';}
 if(b.kind==='quilcoal'&&side==='ally'){b.fear=Math.max(0,Math.min(6,b.fear+(special&&moveKind(actor)==='mouse'?-1:1)));if(fireReady())msg+=' Quilcoal is ready for you to lower your guard.';}
 battleNote(msg+(target.hp<=0?' Defeated!':''))}
 else if(support){if(moveKind(actor)==='fern'){target.shield=true;fx(target,side,'SHELTER','shield');battleNote(actor.name+' shelters '+target.name+': next incoming hit halved.')}else{const amount=Math.min(target.max-target.hp,Math.ceil(target.max*.25));target.hp+=amount;fx(target,side,'+'+amount,'heal');battleNote(actor.name+' restores '+amount+' HP to '+target.name+' ('+target.hp+'/'+target.max+').')}}
 else if(p.action==='potion'){
  const recipient=own.find(v=>v.k===p.targetKey);
  if(!recipient || recipient.hp<=0 || recipient.hp>=recipient.max){
   battleNote(actor.name+' keeps the draught. The chosen Pact can no longer receive healing.');
   return;
  }
  const amount=Math.min(24,recipient.max-recipient.hp);
  recipient.hp+=amount;
  state.potions--;
  fx(recipient,side,'+'+amount,'heal');
  battleNote(actor.name+' gives a draught to '+recipient.name+' for '+amount+' HP.');
 }
 else{const amount=Math.min(actor.max-actor.hp,4);actor.hp+=amount;actor.guard=true;fx(actor,side,'+'+amount,'heal');battleNote(actor.name+' recovers '+amount+' HP.'+(p.action==='guard'?' Guard halves the next incoming hit.':''))}
 if(special)actor.ready=b.turn+3;
}
async function resolveRound(){
 if(!battle||battle.busy||actingUnit())return false;const b=battle;b.busy=true;activity(b.units.filter(u=>u.hp>0).map(u=>u.k));
 for(const {actor,side} of turnOrder()){
  if(battle!==b)return false;if(actor.hp<=0)continue;b.current=actor;b.fx=[];resolveAction(actor,side);beep(400);battleView();await pauseCombat();
  if(battle!==b)return false;if(b.enemies.every(e=>e.hp<=0)){finish(true);return true}if(b.units.every(u=>u.hp<=0)){finish(false);return true}
 }
 applyBurns();if(b.enemies.every(e=>e.hp<=0)){finish(true);return true}if(b.units.every(u=>u.hp<=0)){finish(false);return true}
 b.turn++;b.busy=false;b.current=null;b.fx=[];b.units.forEach(u=>u.plan=null);planEnemies();battleView();return true;
}

function finish(win,retreat=false){
 if(win&&battle?.kind==='quilcoal'){finishQuilcoal();return}
 const b=battle,earnedChance=win&&battle.tame&&!state.party.includes('boar');let text;
 if(win){
 state.won++;state.coins+=4;bond(b.units.map(u=>u.k),.15);const reward=b.kind==='guardian'?65:b.kind==='pair'?45:30+(b.enemyLevel-1)*8;
 text='Victory! +4 coins. Each participating Pact gains bond progress.<br>'+b.units.map(u=>gainXP(u.k,reward)).join('<br>');
 if(earnedChance){pactMemory('boar').proven=true;text+='<br>Bramble respects your strength. You can now negotiate a pact without paying. This is a strong chance, not an automatic pact.';}
 if(b.kind==='pair'){state.quest.pair=true;text+='<br>The pair settles down. The path to the guardian is ready.'}
 if(b.kind==='guardian'){state.quest.guardian=true;text+='<br>Water breaks through the blocked channel. Return to Keeper Ada for your reward.'}
 }else text=retreat?'You retreat safely. Your companions recover fully.':'Your team is defeated, but everyone recovers. Try different summons, protective moves, healing draughts, or a few training battles.';
 battle=null;canvas.hidden=false;$('hint').hidden=false;$('overlay').style.position='';
 open(win?'A bond worth keeping':'Back to the trail',text,[...(!win&&!retreat?[['Try again with this team',()=>startEncounter(b.kind)],['Change companions',()=>{close();showParty()}]]:[]),['Continue',()=>{say(text.replaceAll('<br>',' '));close();if(earnedChance)beginNegotiation('boar')}]]);render();
}
