function attachCompanions(owner,records=[]){
 const legacy={level:{...owner.level},xp:{...owner.xp},bond:{...owner.bond}};
 owner.party=[...new Set(owner.party.filter(k=>species[k]))];
 const usedIds=new Set();owner.companions=owner.party.map(k=>{
 const old=records.find(c=>c&&c.species===k),id=old&&typeof old.id==='string'&&/^pact-[a-z0-9-]{1,60}$/.test(old.id)&&!usedIds.has(old.id)?old.id:'pact-'+k+'-1';usedIds.add(id);
 const number=(v,fallback,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
 return {id,species:k,level:Math.floor(number(old?.level,legacy.level[k]||1,1,20)),xp:Math.floor(number(old?.xp,legacy.xp[k]||0,0,100000)),bondXP:number(old?.bondXP,legacy.bond[k]||0,0,100),form:old?.form&&PACT_FORMS[k][old.form]?old.form:'base',origin:typeof old?.origin==='string'?old.origin.slice(0,120):k==='mouse'?'First companion':k==='boar'&&owner.curiosity?.bonded?'Rescued from the berry thicket':'Earlier woodland encounter'};
 });
 for(const [field,key] of [['level','level'],['xp','xp'],['bond','bondXP']]){
 owner[field]={...legacy[field]};for(const c of owner.companions)Object.defineProperty(owner[field],c.species,{enumerable:true,configurable:true,get:()=>c[key],set:v=>{c[key]=v}});
 }
 owner.version=3;return owner;
}
function ensureCompanions(){if(state.party.some(k=>!companion(k))||state.companions.length!==state.party.length)attachCompanions(state,state.companions)}
function loadState(s){
 const out=initial();if(!s||!Array.isArray(s.party)||!s.party.length||!s.party.every(k=>species[k]))return out;
 Object.assign(out,s);out.potions=Number.isInteger(s.potions)&&s.potions>=0?Math.min(1000000,s.potions):1;out.chapter={...initial().chapter,...(s.chapter||{})};out.pactProgress={...(s.pactProgress||{})};out.quest={...initial().quest,...(s.quest||{})};out.active=Array.isArray(s.active)?[...new Set(s.active.filter(k=>out.party.includes(k)))].slice(0,3):['mouse'];
 for(const field of ['level','xp','bond'])out[field]={...initial()[field],...(s[field]||{})};
 if(![2,3].includes(s.version)){for(const k of Object.keys(species)){out.level[k]=1+Math.floor((s.bond?.[k]||0)/20);out.bond[k]=0;out.xp[k]=0;}migrated=true;}
 out.fire=readFire(s.fire);out.curiosity=readCuriosity(s.curiosity);return attachCompanions(out,s.version===3&&Array.isArray(s.companions)?s.companions:[]);
}
function save(){ensureCompanions();try{localStorage.setItem('wildpact-v2',JSON.stringify(state))}catch{saveFailed=true}}
function exportSave(){
 if(modal){say('Finish your current encounter or close the party screen before exporting.');return}
 const blob=new Blob([JSON.stringify({game:'Wildpact',format:1,state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Wildpact-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Save exported. Keep this JSON file to move your progress to a later version.');
}
function validateImport(data){
 if(data?.game!=='Wildpact'||data.format!==1||!data.state)throw Error('Choose a Wildpact exported save.');
 const s=data.state,keys=Object.keys(species),integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(![2,3].includes(s.version)||!Array.isArray(s.party)||!s.party.length||s.party.length>Object.keys(species).length||new Set(s.party).size!==s.party.length||!s.party.every(k=>keys.includes(k)))throw Error('Invalid creature roster.');
 if(!Array.isArray(s.active)||s.active.length>3||new Set(s.active).size!==s.active.length||!s.active.every(k=>s.party.includes(k)))throw Error('Invalid active party.');
 if(!integer(s.mana,MANA_START,MANA_CAP)||s.active.reduce((n,k)=>n+species[k].cost,0)>s.mana)throw Error('Invalid mana capacity.');
 for(const k of s.party)if(!integer(s.level?.[k],1,20)||!integer(s.xp?.[k],0,xpNeeded(s.level[k])-1)||!Number.isFinite(s.bond?.[k])||s.bond[k]<0||s.bond[k]>100)throw Error('Invalid progression values.');
 if(s.potions!==undefined&&!integer(s.potions,0,1000000))throw Error('Invalid potion inventory.');
 if(!integer(s.coins,0,1000000)||!integer(s.berries,0,1000000)||!integer(s.won,0,1000000)||!integer(s.steps,0,100000000))throw Error('Invalid inventory or progress.');
 if(s.version===3){
 if(!Array.isArray(s.companions)||s.companions.length!==s.party.length||new Set(s.companions.map(c=>c.id)).size!==s.party.length||new Set(s.companions.map(c=>c.species)).size!==s.party.length)throw Error('Invalid individual companion records.');
 for(const c of s.companions)if(!s.party.includes(c.species)||typeof c.id!=='string'||!/^pact-[a-z0-9-]{1,60}$/.test(c.id)||c.form!=='base'||c.level!==s.level[c.species]||c.xp!==s.xp[c.species]||c.bondXP!==s.bond[c.species]||typeof c.origin!=='string'||c.origin.length>120)throw Error('Invalid companion identity or form.');
 }
 const out=initial();out.potions=s.potions??1;for(const field of ['mana','coins','berries','won','steps','shrine','fernMet','boarMet','berriesPicked'])out[field]=s[field];
 out.party=[...s.party];out.active=[...s.active];for(const field of ['level','xp','bond'])for(const k of s.party)out[field][k]=s[field][k];
 out.facing=['down','up','left','right'].includes(s.facing)?s.facing:'down';out.area=['village','clearing','trail','orchard','spring','grove'].includes(s.area)?s.area:'clearing';out.x=['trail','orchard'].includes(out.area)?3:6;out.y=9;for(const key of Object.keys(out.chapter))out.chapter[key]=s.chapter?.[key]===true;
 for(const key of Object.keys(out.quest))out.quest[key]=s.quest?.[key]===true;
 if(s.pactProgress!==undefined){
 if(!s.pactProgress||typeof s.pactProgress!=='object'||Array.isArray(s.pactProgress))throw Error('Invalid pact progress.');
 for(const k of ['moth','snail','boar']){const p=s.pactProgress[k];if(!p)continue;
 if(!integer(p.failures,0,3)||!integer(p.returnAt,0,100000008))throw Error('Invalid pact progress.');
 out.pactProgress[k]={failures:p.failures,returnAt:p.returnAt,calm:p.calm===true,proven:p.proven===true,helpStarted:p.helpStarted===true,helpDone:p.helpDone===true,beeSeen:p.beeSeen===true,beeAgreed:p.beeAgreed===true,beeSupplies:p.beeSupplies===true,beeMoved:p.beeMoved===true,beeHelper:['boar','fern','player'].includes(p.beeHelper)?p.beeHelper:null};}}
 out.fire=readFire(s.fire);out.curiosity=readCuriosity(s.curiosity);if(out.area==='grove'&&!out.fire.started){out.area='orchard';out.x=3;out.y=9;}if(out.area==='spring'&&!out.curiosity.discovered){out.area='trail';out.x=3;out.y=9;}return attachCompanions(out,s.version===3?s.companions:[]);
}
async function importSave(file){
 if(!file)return;if(modal)return;
 try{if(file.size>100000)throw Error('Save file is too large.');const next=validateImport(JSON.parse(await file.text()));if(modal)return;
 open('Load this expedition?','This replaces your current progress. Incoming save: '+next.party.length+' pacts, '+next.mana+' mana. Export your current save first if you want to keep both.',[['Load save',()=>{state=next;close();say('Save loaded. You are at the area entrance.')}],['Cancel',close]]);
 }catch(error){say('Could not load save: '+error.message)}finally{$('saveFile').value=''}
}
