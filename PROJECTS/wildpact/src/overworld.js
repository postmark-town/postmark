const clearingPond=(x,y)=>((x-15)**2/13+(y-5)**2/6)<1;
const clearingTree=(x,y)=>x===0||y===0||x===19||y===12||[[2,2],[3,2],[4,2],[8,2],[9,2],[10,2],[2,6],[3,6],[9,6],[10,6],[17,9],[18,9],[2,10],[3,10],[10,11],[11,11],[17,2]].some(p=>p[0]===x&&p[1]===y);
function nearest(){return regionFeatures().find(p=>Math.abs(p.x-state.x)+Math.abs(p.y-state.y)<=1)}
function clearingDraw(t){const textured=drawGroundLayer();if(!textured){ctx.fillStyle='#738b52';ctx.fillRect(0,0,640,416);}for(let y=0;y<13;y++)for(let x=0;x<20;x++){const xx=x*32,yy=y*32,n=(x*37+y*71)%11;if(!textured){ctx.fillStyle=n<4?'#789157':'#71894f';ctx.fillRect(xx,yy,32,32);if((y>=8&&y<=9&&x>=4&&x<=15)||(x>=6&&x<=7&&y>=3&&y<=9)){ctx.fillStyle='#b9ab76';ctx.fillRect(xx,yy,32,32);ctx.fillStyle='#a79a68';ctx.fillRect(xx+n,yy+24,3,2)}else{ctx.fillStyle='#8fa262';ctx.fillRect(xx+7+n,yy+9,2,3);ctx.fillRect(xx+20,yy+22,3,2);if(n===3){ctx.fillStyle='#e5d59a';ctx.fillRect(xx+12,yy+17,3,3)}}}if(pond(x,y)&&!drawWaterTile(x,y,t)){ctx.fillStyle='#426e6b';ctx.fillRect(xx,yy,32,32);ctx.fillStyle='#6b9b88';ctx.fillRect(xx+((Math.floor(t/600)+x)%3)*7,yy+13,12,2)}}
drawForest();
// Camp, mana stone, berries and creatures are deliberately placed landmarks.
if(!villagePiece('tent',148,264,56,64)){ctx.fillStyle='#574b36';ctx.fillRect(145,290,42,11);ctx.fillStyle='#bd965a';ctx.fillRect(148,269,34,20);ctx.fillStyle='#dcc28a';ctx.beginPath();ctx.moveTo(140,290);ctx.lineTo(165,260);ctx.lineTo(190,290);ctx.fill();ctx.fillStyle='#534c36';ctx.fillRect(160,279,11,17);
}
if(!villageArt[0].ready){ctx.fillStyle='#596d62';ctx.fillRect(328,70,17,25);ctx.fillStyle='#a4b0a0';ctx.fillRect(330,64,13,24);ctx.fillStyle=state.shrine?'#cbe7a1':'#97c6ae';ctx.fillRect(335,69,3,12);ctx.fillRect(332,73,9,3);
}
if(!state.berriesPicked&&!forestPiece([230,522,210,181],128,124,32,28)){ctx.fillStyle='#44643e';ctx.fillRect(132,132,23,17);ctx.fillStyle='#be7770';[[137,135],[147,141],[133,144]].forEach(([x,y])=>ctx.fillRect(x,y,4,4))}
if(!state.party.includes('fern'))sprite(ctx,'fern',400,176,1.6);
if(regionFeatures().some(p=>p.type==='boar'))sprite(ctx,'boar',496,304,1.7);
drawParty();
const p=nearest();$('hint').textContent=p?`E · ${p.label}`:'Find Frond beside the pond →';}
function move(dx,dy){if(modal)return;state.facing=facingFor(dx,dy);const x=state.x+dx,y=state.y+dy;const exit=mapExits().find(p=>p.x===x&&p.y===y);if(exit){travel(exitDestination(exit));return}if(x<1||y<1||x>18||y>11||tree(x,y)||pond(x,y)||solidScenery(x,y)||regionFeatures().some(p=>p.x===x&&p.y===y))return;syncPartyTrail();state.x=x;state.y=y;recordPartyStep();playerWalkUntil=performance.now()+240;state.steps++;activity();render()}
function regionFeatures(){const features=state.area==='village'?villageFeatures:state.area==='trail'?trailFeatures:state.area==='orchard'?orchardFeatures:clearingFeatures;return (['spring','grove'].includes(state.area)?[]:features.filter(p=>!(p.type==='stone'&&pactMemory('snail').helpDone)&&!(p.type==='pair'&&state.quest.pair)&&!(p.type==='fern'&&state.party.includes('fern'))&&!(['moth','snail'].includes(p.type)&&state.party.includes(p.type))&&!(p.type==='boar'&&state.party.includes('boar')&&companion('boar')?.origin!=='Rescued from the berry thicket'))).concat(curiosityFeatures(),fireFeatures()).map(p=>exitDestination(p)?{...p,x:p.type==='springEntry'?11:p.x<10?0:19,y:p.type==='springEntry'?0:p.y}:p)}
function pond(x,y){if(state.area==='grove')return x>=3&&x<=5&&y>=4&&y<=5;if(state.area==='spring')return (x-13)**2+(y-5)**2<7;if(state.area==='village')return false;if(state.area==='trail')return x>=13&&x<=15&&y>=2&&y<=4;return state.area==='orchard'?((x-16)**2+(y-6)**2<5):clearingPond(x,y)}
function tree(x,y){if(state.area==='grove')return groveTree(x,y);if(state.area==='clearing'&&y===9&&x>=17)return false;if(state.area==='spring')return x===0||y===0||x===19||y===12||[[5,3],[6,3],[17,4],[17,5],[6,7],[7,7]].some(p=>p[0]===x&&p[1]===y);if(state.area==='village')return x===0||y===0||x===19||y===12||((x>=3&&x<=5||x>=9&&x<=11)&&y>=4&&y<=5)||((x===7||x===8)&&y===8);if(state.area==='trail')return x===0||y===0||x===19||y===12||[[5,3],[5,4],[5,5],[5,7],[5,8],[5,9],[10,2],[10,3],[10,4],[10,7],[10,8],[10,9],[10,10],[16,7],[16,8]].some(p=>p[0]===x&&p[1]===y);return state.area==='orchard'?(x===0||y===0||x===19||y===12||[[6,2],[6,3],[6,4],[12,2],[12,3],[12,4],[7,8],[7,9],[11,9],[3,3],[17,10]].some(p=>p[0]===x&&p[1]===y)):clearingTree(x,y)}
function nearest(){return regionFeatures().find(p=>Math.abs(p.x-state.x)+Math.abs(p.y-state.y)<=1)}
function travel(area){const from=state.area;
 if(area==='hills'){open('The road beyond Mossmere','The green woods fall behind a rise. Far away, the dry Ashen Hills carry a thin line of industrial smoke.<br><br><b>Chapter One complete.</b> Your investigation continues in Chapter Two, which is not built yet. You can still explore Mossmere and revisit Quilcoal.',[['Return to the grove',close]]);return;}
 if(from==='grove'&&state.fire.calm&&state.fire.reported)state.fire.returned=true;

 if(state.curiosity.discovered&&from==='trail'&&area!=='spring')state.curiosity.away=true;
 if(area==='trail'&&state.curiosity.away)state.curiosity.returnReady=true;
 state.area=area;
 if(area==='spring'){state.curiosity.discovered=true;state.curiosity.phase='home';}

 const point=area==='grove'?[1,9]:from==='grove'&&area==='orchard'?[18,3]:area==='spring'?[1,9]:from==='spring'&&area==='trail'?[11,1]:area==='village'?[18,9]:area==='trail'?(from==='orchard'?[18,9]:[1,9]):area==='orchard'?[1,9]:from==='village'?[1,9]:[18,9];
 [state.x,state.y]=point;sceneCaption={text:({village:'Mossmere Village',clearing:'Mossmere Clearing',trail:'Lanternwood Trail',orchard:'The Overgrown Orchard',spring:'Fern Hollow',grove:'The Old Grove'})[area],until:performance.now()+2200,area};playerWalkUntil=0;state.facing=from==='spring'?'down':point[0]>10?'left':'right';close();say(area==='grove'?'Smoke hangs beneath the canopy. A stream lies west of the burning branch; a small shape scrambles beyond it.':area==='spring'?'The cub drinks, rinses its freed paw, and settles by the ferns. A faint trickle emerges between the stones.':area==='orchard'?'Keeper Ada waits beside the western path. The spring upstream has fallen silent.':area==='village'?'Mossmere. A warm roof, a full pouch, and someone waiting to hear your story.':area==='trail'?'Lanternwood forks around the trees. The orchard lies east; the herb patch is just below the west entrance; the northern branch has a supply cache.':'The clearing is a safe place to learn. Frond waits beside the pond.');render()}
function facingFor(dx,dy){return dx<0?'left':dx>0?'right':dy<0?'up':'down'}
// Center and ground contact of each Dewdrop pose, measured on its visible silhouette.
const DEWDROP_ANCHORS=[[[16, 28], [16, 26], [16, 27]], [[16, 26], [16, 26], [16, 26]], [[16, 24], [16, 24], [14, 24]], [[17, 25], [16, 25], [16, 23]]];
const QUILCOAL_FRAME_BOUNDS=[[4, 8, 27, 28], [5, 6, 26, 25], [3, 4, 28, 22], [3, 2, 28, 21]];
function sprite(c,k,x,y,scale=2,back=false,facing='down',walkUntil=0){
 const art=overworldArt[k];
 if(art){const walking=!modal&&performance.now()<walkUntil,asset=walking?art.walk:art.idle;
 if(asset.ready){const row=({down:0,up:1,left:2,right:3})[facing]??0,col=walking?[1,0,2,0][Math.floor(performance.now()/85)%4]:0;
 c.save();c.imageSmoothingEnabled=false;
 if(k==='snail'){
  const [center,base]=DEWDROP_ANCHORS[row][col];
  const zoom=1.375;
  c.drawImage(asset.image,col*32,row*32,32,32,Math.round(x-center*zoom),Math.round(y+15-base*zoom),44,44);
 }
 else if(k==='quilcoal'){const [l,top,r,bottom]=QUILCOAL_FRAME_BOUNDS[row],w=r-l,h=bottom-top,dw=Math.round(w*1.2),dh=Math.round(h*1.2);c.drawImage(asset.image,col*32+l,row*32+top,w,h,Math.round(x-dw/2),Math.round(y+15-dh),dw,dh)}
 else c.drawImage(asset.image,col*32,row*32,32,32,Math.round(x)-16,Math.round(y)-16,32,32);
 c.restore();return}}

 if(!['moth','snail'].includes(k)){baseSprite(c,k,x,y,scale,back);return}
 c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
 const r=(a,b,w,h,col)=>{c.fillStyle=col;c.fillRect(a,b,w,h)};
 r(-10,9,20,3,'#14291a66');
 if(k==='moth'){r(-13,-9,10,16,'#9a91bd');r(3,-9,10,16,'#9a91bd');r(-11,-7,7,11,'#d9d1e4');r(4,-7,7,11,'#d9d1e4');r(-3,-6,6,15,'#e9cb7c');r(-5,-12,2,7,'#e9cb7c');r(3,-12,2,7,'#e9cb7c');r(-2,-3,1,2,'#27372e');r(1,-3,1,2,'#27372e')}
 else{r(-11,4,21,6,'#7fb8bb');r(-8,-8,15,15,'#47758a');r(-6,-7,12,12,'#a6d6dd');r(-3,-4,6,6,'#578c9b');r(6,-1,6,8,'#99cbd0');r(7,-6,2,6,'#99cbd0');r(11,-6,2,6,'#99cbd0');r(7,-6,2,2,'#293b39');r(11,-6,2,2,'#293b39')}
 c.restore();
}
function draw(t){updateRabbits();updateBees();updateFire();updateCuriosity(t);roamCreatures(t);
 if(state.area==='grove'){drawGrove(t)}else if(state.area==='spring'){drawHiddenSpring(t)}else if(['village','trail'].includes(state.area)){chapterDraw(t)}else if(state.area!=='orchard'){clearingDraw(t)}
 else{
 const textured=drawGroundLayer();
 for(let y=0;y<13;y++)for(let x=0;x<20;x++){const px=x*32,py=y*32;if(!textured){ctx.fillStyle=(x+y)%3?'#758552':'#7c8f5c';ctx.fillRect(px,py,32,32);if(y===9||x===4||y===5){ctx.fillStyle='#b0a073';ctx.fillRect(px,py,32,32)}}if(pond(x,y)&&!drawWaterTile(x,y,t)){ctx.fillStyle=state.quest.guardian?'#6da9aa':'#435f70';ctx.fillRect(px,py,32,32);ctx.fillStyle='#a4d1c0';ctx.fillRect(px+6,py+15,12,2)}}
 drawForest();
 sprite(ctx,'townsperson',144,272,1,false,facingFor(state.x-4,state.y-8));const wild=orchardFeatures.find(p=>p.type==='wildmouse');sprite(ctx,'mouse',wild.x*32+16,wild.y*32+18,1.4,false,wild.facing||'down',wild.walkUntil||0);if(!state.party.includes('moth')){const m=orchardFeatures.find(p=>p.type==='moth');sprite(ctx,'moth',m.x*32+16,m.y*32+16,1,false,m.facing||'down',m.walkUntil||0)};if(!state.party.includes('snail'))sprite(ctx,'snail',496,276,1.7);
 if(!state.quest.pair){sprite(ctx,'mouse',326,239,1.3);sprite(ctx,'moth',348,239,1.3)}
 sprite(ctx,'boar',528,112,state.quest.guardian?1.6:2.3);if(!villagePiece('basket',160,96,32,32)){ctx.fillStyle='#d6c18c';ctx.fillRect(168,104,15,10);}
 drawBees(t);drawParty();
 }
 drawFireStory(t);drawInteractionFocus();drawSceneFeedback();
 const p=nearest();$('hint').textContent=exitDestination(p)?'Walk into the path · '+p.label+' · E also works':p?.type==='thicket'&&state.curiosity.phase==='seen'?'E · Choose how to free the trapped paw':p?'E · '+p.label:state.area==='orchard'?'Find Keeper Ada beside the western path':state.area==='village'?'Talk to Rowan by the well · E to interact':state.area==='trail'?'Orchard east · village west · explore the branches':'Explore · P opens your party';
 requestAnimationFrame(draw);
}
let lastRoam=0;
function roamCreatures(t){
 if(modal||document.hidden){lastRoam=t;return}
 if(t-lastRoam<1100)return;lastRoam=t;
 if(state.area==='trail'){const p=trailFeatures.find(q=>q.type==='trailmouse');if(Math.abs(p.x-state.x)+Math.abs(p.y-state.y)<=2)return;const [dx,dy]=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(Math.random()*4)],x=p.x+dx,y=p.y+dy;if(x>=6&&x<=9&&y>=5&&y<=8&&!tree(x,y)&&!pond(x,y)&&!trailFeatures.some(q=>q!==p&&q.x===x&&q.y===y)){p.facing=facingFor(dx,dy);p.walkUntil=performance.now()+300;p.x=x;p.y=y}return}
 if(state.area!=='orchard')return;
 for(const p of orchardFeatures.filter(p=>['moth','wildmouse'].includes(p.type))){
 if(p.type==='moth'&&state.party.includes('moth')||Math.abs(p.x-state.x)+Math.abs(p.y-state.y)<=2)continue;
 const [dx,dy]=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(Math.random()*4)],x=p.x+dx,y=p.y+dy;
 const limits=p.type==='moth'?[7,10,2,4]:[7,10,9,11];
 if(x<limits[0]||x>limits[1]||y<limits[2]||y>limits[3]||tree(x,y)||pond(x,y)||solidScenery(x,y)||regionFeatures().some(q=>q!==p&&q.x===x&&q.y===y)||x===state.x&&y===state.y)continue;
 p.facing=facingFor(dx,dy);p.walkUntil=performance.now()+300;p.x=x;p.y=y;
 }
}

function chapterDraw(t){
 const village=state.area==='village',textured=drawGroundLayer();
 for(let y=0;y<13;y++)for(let x=0;x<20;x++){
 const px=x*32,py=y*32;if(!textured){ctx.fillStyle=(x*3+y)%4?'#748954':'#7c925a';ctx.fillRect(px,py,32,32);
 const path=village?(y===9||(x===4||x===10)&&y>=6&&y<=9):(y===6||y===9||x===7&&y>=2&&y<=9||x===14&&y>=6&&y<=10||x===17&&y>=6&&y<=9);
 if(!path&&!tree(x,y)&&!pond(x,y)){const n=(x*37+y*71)%11;ctx.fillStyle='#8fa263';ctx.fillRect(px+7+n,py+9,2,3);ctx.fillRect(px+20,py+22,3,2);if(n===3){ctx.fillStyle=village?'#e0ae9a':'#d9cf91';ctx.fillRect(px+12,py+17,3,3)}}
 if(path){ctx.fillStyle='#b6a57a';ctx.fillRect(px,py,32,32);ctx.fillStyle='#a29063';ctx.fillRect(px+7,py+23,3,2)}}
 if(pond(x,y)&&!drawWaterTile(x,y,t)){ctx.fillStyle='#4c7d79';ctx.fillRect(px,py,32,32);ctx.fillStyle='#8bb6a0';ctx.fillRect(px+5+(Math.floor(t/600)%3)*4,py+14,10,2)}
 
 }
 drawForest();drawCuriosity(t);
 if(village){
 for(const [x,label,color] of [[3,'HOME','#ac6d57'],[9,'PIP’S','#6e83a0']]){const px=x*32;if(villagePiece(x===3?'cottage':'shop',x===3?76:280,64,128,128))continue;ctx.fillStyle='#d4bb88';ctx.fillRect(px,128,96,64);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(px-7,139);ctx.lineTo(px+48,96);ctx.lineTo(px+103,139);ctx.fill();ctx.fillStyle='#493f32';ctx.fillRect(px+36,161,24,31);ctx.fillStyle='#e7d5a2';ctx.fillRect(px+10,150,16,16);ctx.fillRect(px+70,150,16,16);mapLabel(label,px+48,116)}
 if(!villageArt[1].ready){ctx.fillStyle='#596f67';ctx.fillRect(230,242,38,25);ctx.fillStyle=state.quest.guardian?'#8ac9bb':'#384e49';ctx.fillRect(236,245,26,12);}sprite(ctx,'rowan',272,304,1,false,facingFor(state.x-8,state.y-9));
 }else{const w=trailFeatures.find(p=>p.type==='trailmouse');sprite(ctx,'mouse',w.x*32+16,w.y*32+18,1.5,false,w.facing||'down',w.walkUntil||0)}
 for(const p of regionFeatures()){
 const x=p.x*32+16,y=p.y*32+16;
 if(['directions','notice'].includes(p.type)&&!villageArt[0].ready){ctx.fillStyle='#665238';ctx.fillRect(x-2,y,4,16);ctx.fillStyle='#d2b778';ctx.fillRect(x-12,y-8,24,14);mapLabel(p.type==='west'?'←':p.type==='east'||p.type==='gate'?'→':'?',x,y+3)}
 if(p.type==='cache'&&!villagePiece('chest',x-16,y-16,32,32)){ctx.fillStyle=state.chapter.cache?'#736645':'#b99458';ctx.fillRect(x-11,y-6,22,17);ctx.fillStyle='#493d2a';ctx.fillRect(x-11,y-1,22,3);mapLabel('CACHE',x,y-15)}
 if(p.type==='lesson'&&!villageArt[0].ready){ctx.fillStyle='#8faaa0';ctx.fillRect(x-9,y-13,18,27);ctx.fillStyle=state.chapter.lesson?'#aabf91':'#e3e1a6';ctx.fillRect(x-2,y-9,4,15);mapLabel('PACT MARKER',x,y-21)}
 }
 drawBees(t);drawParty();
}
function mapLabel(label,x,y){ctx.save();ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='#243e30';ctx.fillRect(x-label.length*3.3-4,y-10,label.length*6.6+8,14);ctx.fillStyle='#f0dfb3';ctx.fillText(label,x,y);ctx.restore()}
