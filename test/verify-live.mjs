import assert from 'node:assert/strict';
import {GAME_ORIGIN} from '../server.mjs';
import http from 'node:http';
import https from 'node:https';
const base=process.argv[2]||'http://127.0.0.1:8080';
const sharedOrigin=process.argv[3]||GAME_ORIGIN;
async function request(origin,path,body,token){
  const url=new URL(path,origin),payload=body?JSON.stringify(body):undefined;
  return new Promise((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).request(url,{agent:false,method:body?'POST':'GET',headers:{...(payload?{'content-type':'application/json',origin:url.origin,'content-length':Buffer.byteLength(payload)}:{}),...(token?{'x-player-token':token}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{try{resolve({status:res.statusCode,...JSON.parse(Buffer.concat(chunks).toString())});}catch(e){reject(e);}});});
    req.on('error',error=>reject(new Error(`${body?'POST':'GET'} ${url.pathname} failed`,{cause:error})));req.setTimeout(20000,()=>req.destroy(new Error('Network timeout')));req.end(payload);
  });
}
const page=await fetch(base+'/');assert.equal(page.status,200);assert((await page.text()).includes('七雀'));
const host=await request(base,'/api/rooms',{name:'备用测试甲'});assert.equal(host.status,201);const path='/api/rooms/'+host.room.code;
const peers=await Promise.all(['备用测试乙','备用测试丙','备用测试丁'].map(name=>request(base,path,{type:'join',name})));peers.forEach(p=>assert.equal(p.status,200));
const clients=[host,...peers];
try{
let view=await request(base,path,null,host.token);
const original=await request(sharedOrigin,path,null,host.token);assert.equal(original.status,200);assert.equal(original.room.revision,view.room.revision);assert.equal(original.room.money.rateCents,0);
await Promise.all(clients.map(c=>request(base,path,{type:'ready',ready:true,rateCents:0,revision:view.room.revision},c.token).then(r=>assert.equal(r.status,200))));
view=await request(base,path,null,host.token);let started=await request(base,path,{type:'start',revision:view.room.revision},host.token);assert.equal(started.status,200);
let views=await Promise.all(clients.map(c=>request(base,path,null,c.token)));for(const v of views){assert.equal(v.status,200);assert.equal(v.room.money.roundRateCents,0);assert(v.room.players.find(p=>p.id===v.room.meId).hand);assert(v.room.players.filter(p=>p.id!==v.room.meId).every(p=>p.hand===null));}
const revision=views[0].room.revision;
const message=await request(base,path+'/messages',{phraseId:'t14'},peers[0].token);assert.equal(message.status,201);
views=await Promise.all(clients.map(c=>request(base,path,null,c.token)));assert(views.every(v=>v.messages.some(m=>m.id===message.message.id)));assert(views.every(v=>v.room.revision===revision));
const card=views[0].room.players.find(p=>p.id===views[0].room.meId).hand[0];const played=await request(base,path,{type:'discard',card,revision},host.token);assert.equal(played.status,200);
const next=clients.find(c=>c.room.meId===played.room.players[played.room.turn].id);assert(next);
view=await request(base,path,null,next.token);const draw=await request(base,path,{type:'draw',revision:view.room.revision},next.token);assert.equal(draw.status,200);
const own=draw.room.players.find(p=>p.id===draw.room.meId);assert.equal((await request(base,path,{type:'discard',card:own.hand[0],revision:draw.room.revision},next.token)).status,200);
const voice=await fetch(base+'/voices/t14.wav');assert.equal(voice.status,200);const bytes=Buffer.from(await voice.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert(bytes.length>10000);
}finally{
  const final=await request(sharedOrigin,path,null,host.token);
  if(final.status===200&&final.room.status==='playing')assert.equal((await request(sharedOrigin,path,{type:'end',revision:final.room.revision},host.token)).status,200);
  for(const c of clients){const current=await request(sharedOrigin,path,null,c.token);if(current.status===200)assert.equal((await request(sharedOrigin,path,{type:'leave',revision:current.room.revision},c.token)).status,200);}
}
console.log('PASS: live original site through backup entry, four independent zero-rate clients, shared rooms across both origins, hidden hands, readiness, dealing, draw/discard, voice delivery, unchanged chat revision, WAV bytes and clean test-seat exit.');
