import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Every request is pinned to this user's public game. This is not an open proxy.
export const GAME_ORIGIN='https://qique-friends-20261001.zheliang655.chatgpt.site';
export const RENDER_ORIGIN='https://qique-backup-entry.onrender.com';
export function upstreamSettings(mode='original'){
  if(mode==='original')return {origin:GAME_ORIGIN,timeoutMs:15000};
  if(mode==='render')return {origin:RENDER_ORIGIN,timeoutMs:65000};
  throw Error('QIQUE_UPSTREAM must be original or render');
}
const requestHeaders=['accept','accept-language','user-agent','content-type','x-player-token','if-none-match','if-modified-since','range','rsc','next-router-state-tree','next-router-prefetch','next-url'];
const responseHeaders=['content-type','cache-control','etag','last-modified','vary','accept-ranges','content-range','content-disposition','x-content-type-options','content-security-policy','referrer-policy','permissions-policy','x-frame-options'];
const limit=16*1024;

function json(response,status,body){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));}
function entryOrigin(request){
  const host=String(request.headers.host||'localhost');
  if(!/^[a-z0-9.:[\]-]+$/i.test(host))return null;
  const protocol=request.headers['x-forwarded-proto']==='https'?'https':'http';
  return `${protocol}://${host}`;
}
export function createGateway({origin=GAME_ORIGIN,fetchUpstream=fetch,timeoutMs=15000}={}){
  const fixedOrigin=new URL(origin).origin;
  return createServer(async(request,response)=>{
    const base=entryOrigin(request);
    if(!base)return json(response,400,{error:'无效的网址。'});
    const path=request.url||'/';
    if(!path.startsWith('/')||path.startsWith('//'))return json(response,400,{error:'无效的访问路径。'});
    const incoming=new URL(path,base);
    if(incoming.origin!==base)return json(response,400,{error:'无效的访问路径。'});
    if(incoming.pathname==='/healthz')return json(response,200,{ok:true,service:'qique-backup-entry'});
    if(!['GET','HEAD','POST'].includes(request.method))return json(response,405,{error:'此操作不受支持。'});
    if(request.method==='POST'&&!/^\/api\/rooms(?:\/\d{6}(?:\/messages)?)?$/.test(incoming.pathname))return json(response,404,{error:'接口不存在。'});
    if(request.method==='POST'&&request.headers.origin&&request.headers.origin!==base)return json(response,403,{error:'请在同一个游戏网址内操作。'});
    const target=new URL(incoming.pathname+incoming.search,fixedOrigin);
    if(target.origin!==fixedOrigin)return json(response,400,{error:'无效的访问路径。'});
    try{
      // Buffer before asynchronous work; do not retry mutations after timeouts.
      let body;
      if(request.method==='POST'){
        const chunks=[];let bytes=0;
        for await(const chunk of request){bytes+=chunk.length;if(bytes>limit){json(response,413,{error:'请求内容过大。'});return;}chunks.push(chunk);}
        body=Buffer.concat(chunks);
      }
      const headers=new Headers();
      for(const name of requestHeaders){const value=request.headers[name];if(typeof value==='string')headers.set(name,value);}
      if(request.method==='POST')headers.set('origin',fixedOrigin);
      const upstream=await fetchUpstream(target,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
      const outgoing={};
      for(const name of responseHeaders){const value=upstream.headers.get(name);if(value)outgoing[name]=value;}
      if(incoming.pathname.startsWith('/api/'))outgoing['cache-control']='no-store';
      outgoing['x-content-type-options']='nosniff';
      const location=upstream.headers.get('location');
      if(location){const destination=new URL(location,target);if(destination.origin!==fixedOrigin)return json(response,502,{error:'游戏服务暂时未就绪，请稍后重试。'});outgoing.location=base+destination.pathname+destination.search+destination.hash;}
      // Node fetch decompresses the body. Never forward compressed sizes/encodings.
      const data=request.method==='HEAD'||[204,304].includes(upstream.status)?null:Buffer.from(await upstream.arrayBuffer());
      if(response.destroyed)return;
      response.writeHead(upstream.status,outgoing);response.end(data);
    }catch(error){
      if(!response.headersSent&&!response.destroyed)json(response,error?.name==='TimeoutError'?504:502,{error:'牌桌连接暂时中断，请稍后重试。原来的游戏网址仍可使用。'});
      // Player tokens and request bodies never appear in logs.
      console.error('Game upstream request failed:',error?.name||'Error');
    }
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
  const server=createGateway(upstreamSettings(process.env.QIQUE_UPSTREAM));server.listen(port,'0.0.0.0',()=>console.log(`Qique backup entry listening on port ${port}.`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
