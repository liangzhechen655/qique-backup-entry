import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,GAME_ORIGIN} from '../server.mjs';
async function withGateway(fn,fetchUpstream){const server=createGateway({fetchUpstream});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
test('forwards game actions once, preserving the seat credential and exact body',async()=>{
  const calls=[];
  await withGateway(async base=>{
    const body=JSON.stringify({type:'discard',card:'S9',revision:7});
    const response=await fetch(base+'/api/rooms/123456',{method:'POST',headers:{origin:base,'content-type':'application/json','x-player-token':'test-seat-token'},body});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(calls.length,1);assert.equal(calls[0].url,GAME_ORIGIN+'/api/rooms/123456');assert.equal(calls[0].body,body);assert.equal(calls[0].token,'test-seat-token');assert.equal(calls[0].origin,GAME_ORIGIN);
  },async(url,options)=>{calls.push({url:url.href,body:options.body.toString(),token:options.headers.get('x-player-token'),origin:options.headers.get('origin')});return Response.json({room:{revision:8}});});
});
test('serves voice bytes without forwarding upstream compression headers',async()=>{
  const bytes=Buffer.from('RIFF-test-audio');
  await withGateway(async base=>{const response=await fetch(base+'/voices/t01.wav');assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),null);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);},async()=>new Response(bytes,{headers:{'content-type':'audio/wav','content-encoding':'gzip','content-length':'1','cache-control':'public, max-age=600'}}));
});
test('rejects foreign mutations, oversized payloads and unsupported methods',async()=>{
  let calls=0;
  await withGateway(async base=>{
    assert.equal((await fetch(base+'/api/rooms',{method:'POST',headers:{origin:'https://another.example'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/rooms',{method:'POST',body:'a'.repeat(17000)})).status,413);
    assert.equal((await fetch(base+'/api/rooms',{method:'DELETE'})).status,405);
    assert.equal((await fetch(base+'/another-path',{method:'POST',body:'{}'})).status,404);
    assert.equal(calls,0);
  },async()=>{calls++;return new Response('unexpected');});
});
test('rewrites game redirects to the backup entry and hides upstream login redirects',async()=>{
  await withGateway(async base=>{
    const ok=await fetch(base+'/?room=123456',{redirect:'manual'});assert.equal(ok.status,302);assert.equal(ok.headers.get('location'),base+'/?room=654321');
    const blocked=await fetch(base+'/sign-in',{redirect:'manual'});assert.equal(blocked.status,502);
  },async url=>new Response(null,{status:302,headers:{location:url.pathname==='/sign-in'?'https://auth.example/login':GAME_ORIGIN+'/?room=654321'}}));
});
test('keeps upstream failure statuses and provides a local health check',async()=>{
  await withGateway(async base=>{
    const health=await fetch(base+'/healthz');assert.deepEqual(await health.json(),{ok:true,service:'qique-backup-entry'});
    const missing=await fetch(base+'/api/rooms/123456');assert.equal(missing.status,404);assert.equal((await missing.json()).error,'room missing');
  },async()=>Response.json({error:'room missing'},{status:404}));
});
