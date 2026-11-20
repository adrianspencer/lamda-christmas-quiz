// Cloudflare Pages Function. Requires D1 binding named DB and schema.sql applied.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const validToken=t=>typeof t==='string'&&/^[a-f0-9-]{36}$/.test(t);
export async function onRequestPost({request,env}) {
 if(!env.DB)return json({error:'Lobby database is not configured yet.'},503);
 let body;try{body=await request.json()}catch{return json({error:'Invalid request'},400)}
 const {action,code='LAMDA1988',token}=body;
 if(code!=='LAMDA1988')return json({error:'Invalid game'},400);
 const db=env.DB;
 try {
  if(action==='host'){
   let host=await db.prepare('SELECT token FROM hosts WHERE code=?').bind(code).first();
   let hostToken=token;
   if(!host){hostToken=crypto.randomUUID();await db.prepare('INSERT OR IGNORE INTO hosts (code,token) VALUES (?,?)').bind(code,hostToken).run();host=await db.prepare('SELECT token FROM hosts WHERE code=?').bind(code).first();}
   if(host.token!==hostToken)return json({error:'Host access already belongs to another browser. Use the original host browser.'},403);
   return json({token:hostToken,...await status(db,code)});
  }
  if(action==='join'){
   const name=String(body.name||'').trim().slice(0,40);
   if(!name)return json({error:'Enter your name'},400);
   let playerToken=validToken(token)?token:crypto.randomUUID();
   const existing=await db.prepare('SELECT token FROM players WHERE token=? AND code=?').bind(playerToken,code).first();
   if(existing){await db.prepare('UPDATE players SET name=?,seen_at=CURRENT_TIMESTAMP WHERE token=?').bind(name,playerToken).run();}
   else {await db.prepare('INSERT INTO players (token,code,name) VALUES (?,?,?)').bind(playerToken,code,name).run();}
   return json({token:playerToken,...await status(db,code)});
  }
  if(action==='status'){
   const isHost=await db.prepare('SELECT token FROM hosts WHERE code=? AND token=?').bind(code,token||'').first();
   const isPlayer=await db.prepare('SELECT token FROM players WHERE code=? AND token=?').bind(code,token||'').first();
   if(!isHost&&!isPlayer)return json({error:'Session not found. Please join again.'},403);
   return json(await status(db,code));
  }
  if(action==='reset'){
   const host=await db.prepare('SELECT token FROM hosts WHERE code=? AND token=?').bind(code,token||'').first();
   if(!host)return json({error:'Only the quizmaster can clear the lobby.'},403);
   await db.prepare('DELETE FROM players WHERE code=?').bind(code).run();
   return json(await status(db,code));
  }
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:'Lobby service error: '+String(e.message||e)},500)}
}
async function status(db,code){const rows=await db.prepare('SELECT name FROM players WHERE code=? ORDER BY joined_at, rowid').bind(code).all();return {players:rows.results||[],phase:'lobby'};}
