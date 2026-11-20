const reply=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const questions=[
['Name five other drama schools besides LAMDA.','RADA, Guildhall, Central, Bristol Old Vic, Mountview, East 15, ALRA, Drama Centre'],
['Which two London Underground lines serve Earl’s Court station?','District and Piccadilly'],
['Which Andrew Lloyd Webber musical was running at the Apollo Victoria Theatre during our LAMDA years?','Starlight Express'],
['What did the initials NCDT stand for?','National Council for Drama Training'],
['What was the name of the Earl’s Court Road café where we used to have full English breakfasts?','Benjy’s'],
['In theatre terminology, does upstage mean towards or away from the audience?','Away from the audience'],
['Which theatre did we visit to see 42nd Street?','Theatre Royal Drury Lane'],
['What does PFL stand for on a sound mixing desk?','Pre-Fade Listen'],
['Which technique, developed by Frederick Matthias Alexander, was taught to us to improve posture, movement and physical awareness?','Alexander Technique'],
['Which legendary rock singer lived on Logan Place, the same street as the MacOwan Theatre?','Freddie Mercury'],
['What piece of stage equipment is supported by a French brace?','A scenery flat'],
['Which Offenbach operetta did we see at the Royal Opera House?','Orpheus in the Underworld'],
['What was the name of the pub where we sometimes held production meetings?','The Hansom Cab'],
['What does the German theatrical term Sitzprobe literally mean?','Sitting rehearsal'],
['Which of these songs reached No. 1 in the UK in 1988? A. Jack & Diane — John Cougar; B. Never Gonna Give You Up — Rick Astley; C. The Only Way Is Up — Yazz','C — The Only Way Is Up'],
['Which specialist theatrical flying company visited LAMDA?','Kirby’s Flying Circus'],
['What is the theatrical term for a working lamp or light fitting incorporated into the scenery?','Practical'],
['Which Alan Bennett play did we take on tour during our first term?','Habeas Corpus'],
['In theatre terminology, what are cans?','Headsets used for backstage communication'],
['At which West End theatre did we see Noises Off?','Savoy Theatre'],
['Which French artistic term describes a painting technique that tricks the eye into seeing three-dimensional objects?','Trompe-l’œil'],
['At which London television studios did we receive practical TV production training?','Battersea TV Studios'],
['What is the name of the annotated script used by the stage manager to call a performance?','Prompt copy'],
['Which film topped the UK box office in 1988? A. Who Framed Roger Rabbit; B. Fatal Attraction; C. A Fish Called Wanda','B — Fatal Attraction'],
['Which church near Tower House did we use for movement classes?','St Philip’s Church'],
['Which theatrical lighting accessory is used to project patterns, such as windows or leaves, onto the stage?','Gobo'],
['Why was whistling backstage traditionally forbidden in theatres?','Whistles were used to cue flying crews and scenery changes; accidental signals could be dangerous'],
['What is the secondary safety attachment used on a suspended stage lantern?','Safety chain or safety bond'],
['How many weeks of qualifying professional work were required for full Equity membership under the system in place in 1988?','Not verified — excluded from scoring'],
['Which Irving Berlin musical did we perform for graduation?','Annie Get Your Gun']];
export async function onRequestPost({request,env}){
 if(!env.DB)return reply({error:'D1 database binding DB is missing'},503);
 let b;try{b=await request.json()}catch{return reply({error:'Invalid JSON'},400)}
 const db=env.DB,code='LAMDA1988',token=String(b.token||'');
 try{
 const host=await db.prepare('SELECT token,phase FROM hosts WHERE code=?').bind(code).first();
 const isHost=!!host&&token===host.token;
 const player=await db.prepare('SELECT token,name FROM players WHERE code=? AND token=?').bind(code,token).first();
 if(!isHost&&!player)return reply({error:'Please join or unlock quizmaster controls'},403);
 if(b.action==='advance'||b.action==='reveal'||b.action==='finish'){
  if(!isHost)return reply({error:'Quizmaster only'},403);
  const row=await db.prepare('SELECT question_index,revealed FROM quiz_game WHERE code=?').bind(code).first();
  if(!row)return reply({error:'Start the quiz first'},400);
  if(b.action==='reveal')await db.prepare('UPDATE quiz_game SET revealed=1 WHERE code=?').bind(code).run();
  if(b.action==='advance'){
   if(!row.revealed)return reply({error:'Reveal the answer before advancing'},400);
   await db.prepare('UPDATE quiz_game SET question_index=?,revealed=0 WHERE code=?').bind(Math.min(row.question_index+1,29),code).run();
  }
  if(b.action==='finish')await db.prepare("UPDATE hosts SET phase='finished' WHERE code=?").bind(code).run();
 }
 if(b.action==='answer'){
  if(!player)return reply({error:'Players only'},403);
  const row=await db.prepare('SELECT question_index,revealed FROM quiz_game WHERE code=?').bind(code).first();
  if(!row||host.phase!=='started'||row.revealed)return reply({error:'This question is not accepting answers'},409);
  const value=String(b.answer||'').trim().slice(0,400);
  if(!value)return reply({error:'Enter an answer'},400);
  await db.prepare('INSERT OR IGNORE INTO quiz_answers(code,player_token,question_index,answer) VALUES(?,?,?,?)').bind(code,token,row.question_index,value).run();
 }
 if(b.action==='mark'){
  if(!isHost)return reply({error:'Quizmaster only'},403);
  const i=Number(b.index),correct=Number(b.correct);
  if(!Number.isInteger(i)||i<0||i>=30||![0,1].includes(correct)||i===28)return reply({error:'Invalid marking'},400);
  const target=String(b.playerToken||'');
  await db.prepare('UPDATE quiz_answers SET correct=? WHERE code=? AND player_token=? AND question_index=?').bind(correct,code,target,i).run();
 }
 const game=await db.prepare('SELECT question_index,revealed FROM quiz_game WHERE code=?').bind(code).first();
 const phase=(await db.prepare('SELECT phase FROM hosts WHERE code=?').bind(code).first())?.phase||'lobby';
 const idx=game?.question_index??0;
 const answer=player?await db.prepare('SELECT answer,correct FROM quiz_answers WHERE code=? AND player_token=? AND question_index=?').bind(code,token,idx).first():null;
 const rows=isHost?await db.prepare('SELECT a.player_token,a.question_index,a.answer,a.correct,p.name FROM quiz_answers a JOIN players p ON p.token=a.player_token WHERE a.code=? ORDER BY a.question_index,p.joined_at').bind(code).all():null;
 const scores=phase==='finished'?await db.prepare('SELECT p.name,COALESCE(SUM(CASE WHEN a.correct=1 THEN 1 ELSE 0 END),0) AS score FROM players p LEFT JOIN quiz_answers a ON a.player_token=p.token AND a.code=p.code WHERE p.code=? GROUP BY p.token ORDER BY score DESC,p.joined_at').bind(code).all():null;
 return reply({phase,index:idx,total:30,revealed:!!game?.revealed,question:phase==='started'?questions[idx][0]:null,correctAnswer:(isHost||game?.revealed||phase==='finished')?questions[idx][1]:null,unscored:idx===28,answer:answer?.answer||null,marked:answer?.correct??null,answers:isHost?(rows?.results||[]):undefined,scores:scores?.results||undefined});
 }catch(e){return reply({error:'Game service: '+e.message},500)}
}
