const species={mouse:{name:'Whisk',role:'Field mouse · Spark',cost:1,hp:24,atk:7,color:'#d9bd7e',desc:'A field mouse whose whiskers caught a little starlight.'},fern:{name:'Frond',role:'Fern hamster · Earth',cost:2,hp:32,atk:5,color:'#99bc70',desc:'A shy, seed-colored hamster with a living fern sprouting from its head.'},boar:{name:'Bramble',role:'Woodland boar · Earth',cost:4,hp:54,atk:13,color:'#b58b73',desc:'A stubborn little boar with bark growing along its back.'}};

Object.assign(species,{
 moth:{name:'Glim',role:'Orchard moth · Spark',cost:2,hp:27,atk:6,color:'#c3c4df',desc:'A round moth with wings dusted by enchanted apple blossoms.'},
 quilcoal:{name:'Quilcoal',role:'Ember hedgehog · Fire',cost:3,hp:34,atk:10,color:'#d9914f',desc:'A shy hedgehog with charcoal spines. Its embers flare when frightened.'},
 snail:{name:'Dewdrop',role:'Pond snail · Water',cost:3,hp:42,atk:8,color:'#86bbca',desc:'A small blue snail that carries a clear drop of springwater in its shell.'}
});

const ELEMENT_BEATS={Fire:'Wind',Wind:'Lightning',Lightning:'Earth',Earth:'Water',Water:'Fire'};
const STAT_LABELS={hp:'Max HP',atk:'Attack',def:'Defense',spd:'Speed'};
const PROFILES={
 quilcoal:{nature:'Fire',def:12,spd:10,growth:{hp:5,atk:2,def:2,spd:1}},
 mouse:{nature:'Wind',def:8,spd:14,growth:{hp:5,atk:2,def:2,spd:1}},
 fern:{nature:'Earth',def:18,spd:12,growth:{hp:6,atk:1,def:3,spd:1}},
 boar:{nature:'Earth',def:16,spd:6,growth:{hp:7,atk:3,def:2,spd:1}},
 moth:{nature:'Lightning',atk:8,def:6,spd:18,growth:{hp:4,atk:2,def:1,spd:2}},
 snail:{nature:'Water',def:26,spd:4,growth:{hp:6,atk:1,def:4,spd:1}}
};
for(const [k,profile] of Object.entries(PROFILES))Object.assign(species[k],profile);
species.mouse.role='Field mouse · Wind';species.mouse.desc='A curious field mouse whose long whiskers sense a breeze before it arrives.';
species.moth.role='Dazzlemoth · Lightning';species.moth.desc='A crafty, quick moth that gathers energy in its bright, dusted wings.';

// Individual companions own progression; species-keyed views keep Chapter One code compact.
// Future duplicate recruitment can address records by ID without changing their saved data.
const BOND_THRESHOLDS=[0,2,5,10,17,26,38,52,67,83,100];
const BOND_SHAPE=[0,.04,.10,.18,.28,.40,.54,.67,.79,.90,1];
const BOND_GROWTH={mouse:{hp:.55,atk:.50,def:.55},fern:{hp:.50,atk:.40,def:.50},boar:{hp:.22,atk:.22,def:.22},moth:{hp:.40,atk:.35,def:.40},snail:{hp:.30,atk:.30,def:.30},quilcoal:{hp:.25,atk:.25,def:.25}};
const PACT_FORMS=Object.fromEntries(Object.keys(species).map(k=>[k,{base:{name:'Original',nature:species[k].nature,stats:{hp:1,atk:1,def:1,spd:1},movesKey:k,passive:null}}]));
const BATTLE_ROLES={mouse:'Fast disruption',fern:'Preventive protection',boar:'Durable physical attacker',moth:'Speed support',snail:'Healing and recovery',quilcoal:'Burn and sustained damage'};
const moves={
 quilcoal:{basic:'Quill Bump',special:'Ember Roll',desc:'Deals 120% Attack as Fire damage and burns for 8% maximum HP at the end of two rounds. Burn refreshes; it does not stack.'},
 mouse:{basic:'Scratch',special:'Whisker Gust',desc:'Deals 65% Attack as Wind damage. Weakens the next damaging move; persists until used, without stacking.'},
 fern:{basic:'Tackle',special:'Leaf Shelter',desc:'Choose one living ally. Halves their next incoming hit; persists until used, without stacking.'},
 boar:{basic:'Headbutt',special:'Briar Charge',desc:'Deals 160% Attack as Earth damage before Defense and matchups.'}
};
Object.assign(moves,{
 moth:{basic:'Wing Tap',special:'Quickening Dust',desc:'Raise all living allies’ Speed by 50% for the next two rounds. Takes effect next round; refreshes without stacking.'},
 snail:{basic:'Shell Bump',special:'Spring Sip',desc:'Restore 25% of one living ally’s maximum HP. Ignores elemental matchups.'}
});
