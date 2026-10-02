import assert from 'node:assert/strict';
import {GAME_ORIGIN} from '../server.mjs';
const base=process.argv[2]||'http://127.0.0.1:8080';
async function request(origin,path,body,token){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{'x-player-token':token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();return {status:r.status,...data};}
const page=await fetch(base+'/');assert.equal(page.status,200);assert((await page.text()).includes('七雀'));
const host=await request(base,'/api/rooms',{name:'备用测试甲'});assert.equal(host.status,201);const path='/api/rooms/'+host.room.code;
const peers=await Promise.all(['备用测试乙','备用测试丙','备用测试丁'].map(name=>request(base,path,{type:'join',name})));peers.forEach(p=>assert.equal(p.status,200));
const clients=[host,...peers];let view=await request(base,path,null,host.token);
const original=await request(GAME_ORIGIN,path,null,host.token);assert.equal(original.status,200);assert.equal(original.room.revision,view.room.revision);assert.equal(original.room.money.rateCents,0);
await Promise.all(clients.map(c=>request(base,path,{type:'ready',ready:true,rateCents:0,revision:view.room.revision},c.token).then(r=>assert.equal(r.status,200))));
view=await request(base,path,null,host.token);let started=await request(base,path,{type:'start',revision:view.room.revision},host.token);assert.equal(started.status,200);
let views=await Promise.all(clients.map(c=>request(base,path,null,c.token)));for(const v of views){assert.equal(v.status,200);assert.equal(v.room.money.roundRateCents,0);assert(v.room.players.find(p=>p.id===v.room.meId).hand);assert(v.room.players.filter(p=>p.id!==v.room.meId).every(p=>p.hand===null));}
const revision=views[0].room.revision;
const message=await request(base,path+'/messages',{phraseId:'t14'},peers[0].token);assert.equal(message.status,201);
views=await Promise.all(clients.map(c=>request(base,path,null,c.token)));assert(views.every(v=>v.messages.some(m=>m.id===message.message.id)));assert(views.every(v=>v.room.revision===revision));
const card=views[0].room.players.find(p=>p.id===views[0].room.meId).hand[0];const played=await request(base,path,{type:'discard',card,revision},host.token);assert.equal(played.status,200);
view=await request(base,path,null,peers[0].token);const draw=await request(base,path,{type:'draw',revision:view.room.revision},peers[0].token);assert.equal(draw.status,200);
const own=draw.room.players.find(p=>p.id===draw.room.meId);assert.equal((await request(base,path,{type:'discard',card:own.hand[0],revision:draw.room.revision},peers[0].token)).status,200);
const voice=await fetch(base+'/voices/t14.wav');assert.equal(voice.status,200);const bytes=Buffer.from(await voice.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert(bytes.length>10000);
view=await request(base,path,null,host.token);assert.equal((await request(base,path,{type:'end',revision:view.room.revision},host.token)).status,200);
for(const c of clients){const current=await request(base,path,null,c.token);assert.equal((await request(base,path,{type:'leave',revision:current.room.revision},c.token)).status,200);}
console.log('PASS: live original site through backup entry, four independent zero-rate clients, shared rooms across both origins, hidden hands, readiness, dealing, draw/discard, voice delivery, unchanged chat revision, WAV bytes and clean test-seat exit.');
