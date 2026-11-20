// Cloudflare Pages Function. Requires D1 binding named DB and schema.sql applied.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const digest=async(s)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const validPin=p=>typeof p==='string'&&/^\d{4,12}$/.test(p);
const validToken=t=>typeof t==='string'&&/^[a-f0-9-]{36}$/.test(t);
export async function onRequestPost({request,env}) {
 if(!env.DB)return json({error:'Lobby database is not configured yet.'},503);
 let body;try{body=await request.json()}catch{return json({error:'Invalid request'},400)}
 const {action,code='LAMDA1988',token}=body;
 if(code!=='LAMDA1988')return json({error:'Invalid game'},400);
 const db=env.DB;
 try {
  if(action==='host'){
   let host=await db.prepare('SELECT token,pin_hash,pin_salt FROM hosts WHERE code=?').bind(code).first();
   if(!host){const t=crypto.randomUUID();await db.prepare('INSERT OR IGNORE INTO hosts (code,token) VALUES (?,?)').bind(code,t).run();host=await db.prepare('SELECT token,pin_hash,pin_salt FROM hosts WHERE code=?').bind(code).first();}
   let authorized=validToken(token)&&host.token===token;
   if(!authorized&&host.pin_hash&&validPin(body.pin)) authorized=(await digest(host.pin_salt+':'+body.pin))===host.pin_hash;
   if(!authorized)return json({error:host.pin_hash?'Enter your quizmaster PIN.':'Open the quizmaster screen in the original host browser to set your PIN.'},403);
   return json({token:host.token,pinSet:!!host.pin_hash,...await status(db,code)});
  }
  if(action==='set_pin'){
   const host=await db.prepare('SELECT token FROM hosts WHERE code=? AND token=?').bind(code,token||'').first();
   if(!host)return json({error:'Quizmaster access required'},403);
   if(!validPin(body.pin))return json({error:'Use a PIN of 4 to 12 digits.'},400);
   const salt=crypto.randomUUID();const hash=await digest(salt+':'+body.pin);
   await db.prepare('UPDATE hosts SET pin_hash=?,pin_salt=? WHERE code=?').bind(hash,salt,code).run();
   return json({pinSet:true,...await status(db,code)});
  }
  if(action==='start'){
   const host=await db.prepare('SELECT token,pin_hash FROM hosts WHERE code=? AND token=?').bind(code,token||'').first();
   if(!host)return json({error:'Only the quizmaster can start.'},403);
   if(!host.pin_hash)return json({error:'Set your quizmaster PIN first.'},400);
   const count=await db.prepare('SELECT COUNT(*) AS n FROM players WHERE code=?').bind(code).first();
   if(!count.n)return json({error:'Wait for at least one player.'},400);
   await db.prepare("UPDATE hosts SET phase='started' WHERE code=? AND phase='lobby'").bind(code).run();
   await db.prepare('INSERT OR IGNORE INTO quiz_game(code) VALUES(?)').bind(code).run();
   return json(await status(db,code));
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
   await db.prepare('DELETE FROM quiz_answers WHERE code=?').bind(code).run();
   await db.prepare('DELETE FROM quiz_game WHERE code=?').bind(code).run();
   await db.prepare('DELETE FROM players WHERE code=?').bind(code).run();
   await db.prepare("UPDATE hosts SET phase='lobby' WHERE code=?").bind(code).run();
   return json(await status(db,code));
  }
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:'Lobby service error: '+String(e.message||e)},500)}
}
async function status(db,code){const rows=await db.prepare('SELECT name FROM players WHERE code=? ORDER BY joined_at, rowid').bind(code).all();const host=await db.prepare('SELECT phase FROM hosts WHERE code=?').bind(code).first();return {players:rows.results||[],phase:host?.phase||'lobby'};}
