// Isolated Cloudflare Pages Function for /birthday-hunt/api.
// Uses only tables prefixed birthday_* in the existing ADRICHOPS_DB database.
const ADMIN_HASH = "438520315366af2ca8310550d5cf4ea402f6dfa5cca3448cf9ffd9f415ba3d76";
const PUZZLES = [{"id":1,"tag":"OPENING MOVE","title":"The First Ten","location":"Randolph Avenue Gate","intro":"Ten answers. Ten initials. One destination.","body":"1. Capital of Norway?\n2. World's largest country by land area?\n3. Capital of Kenya?\n4. Country whose capital is Buenos Aires?\n5. Planet closest to the Sun?\n6. Capital of Scotland?\n7. Country whose capital is Oslo?\n8. Capital of Japan?\n9. First person to walk on the Moon — surname?\n10. Capital of Portugal?","instruction":"Take the FIRST LETTER of every answer, in order.","answers":["ORNAMENTAL","ORNAMENTAL BEDDING GARDEN","THE ORNAMENTAL BEDDING GARDEN"],"hints":["Write each answer out in full.","Only the first letters count.","The answer starts O R N A M."],"destination":"Ornamental Bedding Garden","arrival":"Find the ornamental flowerbeds marked on the park map.","fact":"Your next clue unlocks only when the whole team arrives.","cipher":""},{"id":2,"tag":"CLASSICAL CRYPTOGRAPHY","title":"Caesar in London","location":"Ornamental Bedding Garden","intro":"A London landmark holds the key.","body":"Nelson's Column in Trafalgar Square is guarded by bronze lions.\n\nHow many are there?\n\nMove every letter BACKWARDS by that number:\n\nVSWI KEVHIR","instruction":"Enter the decoded destination.","answers":["ROSE GARDEN","THE ROSE GARDEN"],"hints":["There are four lions.","A Caesar cipher shifts each letter by the same amount.","VSWI becomes ROSE."],"destination":"Rose Garden","arrival":"Find the formal rose beds.","fact":"The famous lions were designed by Edwin Landseer.","cipher":"VSWI KEVHIR"},{"id":3,"tag":"THE ACROSTIC","title":"Nine Little Answers","location":"Rose Garden","intro":"Nine first letters point the way.","body":"1. Capital of Germany?\n2. Greek goddess of wisdom?\n3. Djokovic's first name?\n4. Capital of Ireland?\n5. Chemical element with symbol S?\n6. Capital of Estonia?\n7. Continent containing the Sahara?\n8. Great river flowing through Egypt?\n9. Walt ______?","instruction":"Take the FIRST LETTER of each answer.","answers":["BANDSTAND","THE BANDSTAND"],"hints":["Berlin, Athena, Novak...","The first four letters are BAND.","It is somewhere music was performed."],"destination":"Bandstand","arrival":"Find the historic music pavilion.","fact":"Nobody needs to perform a song. Thankfully.","cipher":""},{"id":4,"tag":"MUSIC CODE","title":"The Music Code","location":"Bandstand","intro":"Every musician knows the alphabet.","body":"Warm-up trivia: who sang Mr Brightside? Who released Back to Black? Which duo made Get Lucky with Pharrell Williams?\n\nNow decode using A=1, B=2, ..., Z=26:\n\n22-9-12-12-1-7-5 / 7-18-5-5-14","instruction":"Convert the numbers to letters and enter the destination.","answers":["VILLAGE GREEN","THE VILLAGE GREEN"],"hints":["The artists are The Killers, Amy Winehouse and Daft Punk.","22=V, 9=I, 12=L.","The answer begins VILLAGE."],"destination":"Village Green","arrival":"Look for the large open grass area.","fact":"You can hear music in your head. Please don't sing.","cipher":""},{"id":5,"tag":"CHEMISTRY","title":"Periodic Problems","location":"Village Green","intro":"Two elements make one destination.","body":"What are the chemical symbols for:\n\nELEMENT 20\n+\nELEMENT 26\n\nWrite their symbols side by side.","instruction":"Enter the resulting location.","answers":["CAFE","CAFÉ","PARK CAFE","PARK CAFÉ","THE CAFE"],"hints":["20 is calcium.","26 is iron.","Ca + Fe spells the destination."],"destination":"Park Café","arrival":"Find the park café near the playground.","fact":"Good chemistry earns you a coffee stop.","cipher":""},{"id":6,"tag":"WILD ROUND","title":"The Wild Round","location":"Park Café","intro":"Eight answers reveal a secret word.","body":"1. Largest animal on Earth? (First word)\n2. Country with Reykjavík as capital?\n3. Big cat whose males have manes?\n4. Capital of Ireland?\n5. English city with the Liver Building?\n6. Element with symbol I?\n7. Country with Paris as capital?\n8. Largest living land animal?","instruction":"Take the first letters. Add the word GARDEN.","answers":["WILDLIFE GARDEN","THE WILDLIFE GARDEN","WILDLIFE"],"hints":["Whale, Iceland, Lion...","The eight letters spell WILDLIFE.","Finish with the word GARDEN."],"destination":"Wildlife Garden","arrival":"Find the wildlife-focused garden area.","fact":"No animals need to be disturbed during this mission.","cipher":""},{"id":7,"tag":"SPORT WITHOUT EXERCISE","title":"Five Sporting Answers","location":"Wildlife Garden","intro":"No sporting effort required.","body":"1. City that hosted the 2020 Summer Olympics?\n2. Sport played in the Six Nations?\n3. North London club at Emirates Stadium?\n4. Sport featuring wickets and overs?\n5. Martial art whose name means empty hand?","instruction":"Take the first letters to discover your next checkpoint.","answers":["TRACK","ATHLETICS TRACK","THE TRACK"],"hints":["Tokyo is the first answer.","Try Rugby, Arsenal and Cricket.","The initials spell TRACK."],"destination":"Athletics Track","arrival":"Head for the 400m athletics track. Walking is encouraged.","fact":"Roger Bannister trained at Paddington Recreation Ground.","cipher":""},{"id":8,"tag":"FOUR-MINUTE CIPHER","title":"Bannister's Secret","location":"Athletics Track","intro":"A famous sporting milestone is your key.","body":"Roger Bannister became the first man to run a mile in under how many minutes?\n\nUse that number to shift this Caesar cipher BACKWARDS:\n\nGEVPXSR ZEPI KEXI","instruction":"Enter the decoded destination.","answers":["CARLTON VALE GATE","CARLTON GATE","CARLTON VALE"],"hints":["Bannister broke the four-minute mile.","Move each letter BACK four places.","GEVPXSR = CARLTON."],"destination":"Carlton Vale Gate","arrival":"Go to the Carlton Vale entrance of the park.","fact":"You are getting close. The final venue is still a secret.","cipher":"GEVPXSR ZEPI KEXI"},{"id":9,"tag":"NUMBER LOCK","title":"The Address","location":"Carlton Vale Gate","intro":"Your next clue is a street number.","body":"How many players per team start a football match on the pitch?\n+\nWhat number Downing Street is the Prime Minister's official home?\n+\nHow many months are in a year?\n\nAdd them together. You're already standing beside the right street.","instruction":"Enter the full street address (number and street).","answers":["33 CARLTON VALE","33 CARLTON VALE LONDON"],"hints":["The first number is 11.","The second and third numbers are 10 and 12.","11 + 10 + 12 = 33; use Carlton Vale."],"destination":"33 Carlton Vale","arrival":"Leave the park safely and find number 33 Carlton Vale.","fact":"Stop outside the building before opening your last cipher.","cipher":""},{"id":10,"tag":"FINAL ROUND","title":"The Pub That Came Back","location":"33 Carlton Vale","intro":"One last Caesar cipher before the first pint.","body":"This building survived wartime London, was illegally demolished in 2015 and reopened in 2021.\n\nIts number is 33. Add the digits (3 + 3) to get your Caesar key.\n\nShift BACKWARDS:\n\nIGXRZUT ZGBKXT","instruction":"Enter the name of your final destination.","answers":["CARLTON TAVERN","THE CARLTON TAVERN"],"hints":["The cipher key is six.","IGXRZUT becomes CARLTON.","It is the pub at number 33."],"destination":"The Carlton Tavern","arrival":"33 Carlton Vale, London NW6 5EU. Show your final result and claim your drink.","fact":"Congratulations. You found the last round.","cipher":"IGXRZUT ZGBKXT"}];
const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const now = () => new Date().toISOString();
const answerSafe = p => { const {answers,...safe}=p; return safe; };
const j = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
async function digest(input) {
  const bytes = new TextEncoder().encode(String(input));
  const hash = await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function init(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS birthday_settings (id INTEGER PRIMARY KEY CHECK (id=1), status TEXT NOT NULL DEFAULT 'lobby', started_at TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS birthday_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, code_hash TEXT UNIQUE NOT NULL, stage INTEGER NOT NULL DEFAULT 1, phase TEXT NOT NULL DEFAULT 'puzzle', score INTEGER NOT NULL DEFAULT 0, hints INTEGER NOT NULL DEFAULT 0, wrong INTEGER NOT NULL DEFAULT 0, started_at TEXT, finished_at TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS birthday_puzzles (stage INTEGER PRIMARY KEY, payload TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS birthday_events (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT, action TEXT, detail TEXT, occurred_at TEXT)").run();
  await db.prepare("INSERT OR IGNORE INTO birthday_settings(id,status) VALUES(1,'lobby')").run();
  for (const p of PUZZLES) await db.prepare("INSERT OR IGNORE INTO birthday_puzzles(stage,payload) VALUES(?,?)").bind(p.id,JSON.stringify(p)).run();
}
async function setting(db) {return db.prepare("SELECT status,started_at FROM birthday_settings WHERE id=1").first();}
async function puzzle(db,n) {const row=await db.prepare("SELECT payload FROM birthday_puzzles WHERE stage=?").bind(n).first();return row?JSON.parse(row.payload):null;}
async function log(db,id,action,detail="") {await db.prepare("INSERT INTO birthday_events(team_id,action,detail,occurred_at) VALUES(?,?,?,?)").bind(id||null,action,String(detail).slice(0,200),now()).run();}
function publicTeam(t) {return {id:t.id,name:t.name,stage:t.stage,phase:t.phase,score:t.score,hintsUsed:t.hints,wrongUsed:t.wrong,startedAt:t.started_at,finishedAt:t.finished_at,progress:t.phase==="finished"?10:t.phase==="travel"?t.stage:t.stage-1};}
async function rankings(db) {const {results}=await db.prepare("SELECT name,score,stage,phase,finished_at FROM birthday_teams").all();return results.map(t=>({name:t.name,score:t.score,progress:t.phase==="finished"?10:t.phase==="travel"?t.stage:t.stage-1,finished:t.phase==="finished",finish_time:t.finished_at})).sort((a,b)=>b.score-a.score||b.progress-a.progress||(a.finish_time||"z").localeCompare(b.finish_time||"z"));}
async function teamState(db,code,correct=null) {
  const t=await db.prepare("SELECT * FROM birthday_teams WHERE code_hash=?").bind(await digest(norm(code))).first();
  if(!t)return {error:"Team code not recognised. Ask the organiser for your access code."};
  const s=await setting(db);const p=await puzzle(db,t.stage);
  const out={team:publicTeam(t),status:s.status,gameStartedAt:s.started_at,leaderboard:await rankings(db),correct};
  if(t.phase==="puzzle"&&s.status==="live") {
    out.puzzle=answerSafe(p);delete out.puzzle.hints;delete out.puzzle.destination;delete out.puzzle.arrival;delete out.puzzle.fact;
    out.unlockedHints=p.hints.slice(0,t.hints);
  }
  if(t.phase==="travel")out.travel={destination:p.destination,arrival:p.arrival,fact:p.fact};
  if(t.phase==="finished")out.finish={destination:p.destination,arrival:p.arrival,fact:p.fact};
  return out;
}
async function adminState(db){
  const s=await setting(db);const {results:teams}=await db.prepare("SELECT * FROM birthday_teams ORDER BY name ASC").all();
  const {results:all}=await db.prepare("SELECT payload FROM birthday_puzzles ORDER BY stage ASC").all();
  const {results:events}=await db.prepare("SELECT e.id,t.name,e.action,e.detail,e.occurred_at as at,t.stage FROM birthday_events e LEFT JOIN birthday_teams t ON e.team_id=t.id ORDER BY e.id DESC LIMIT 75").all();
  return {status:s.status,gameStartedAt:s.started_at,teams:teams.map(publicTeam),stages:all.map(r=>JSON.parse(r.payload)),events};
}
function randomCode(){const abc="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const bits=new Uint8Array(12);crypto.getRandomValues(bits);const raw=Array.from(bits,b=>abc[b%abc.length]).join("");return raw.match(/.{1,4}/g).join("-");}
export async function onRequestPost({request,env}) {
  if(!env.ADRICHOPS_DB)return j({error:"Cloudflare D1 database binding ADRICHOPS_DB is unavailable."},503);
  if(Number(request.headers.get("content-length")||0)>16000)return j({error:"Request is too large."},413);
  const db=env.ADRICHOPS_DB;
  try {
    const input=await request.json(),act=String(input.action||""),data=input.payload||{};
    await init(db);
    if(act.startsWith("admin_")){
      if(await digest(String(data.password||""))!==ADMIN_HASH)return j({error:"Incorrect organiser passphrase."},403);
      if(act==="admin_state")return j(await adminState(db));
      if(act==="admin_create_team"){
        const name=String(data.name||"").trim();
        if(name.length<2||name.length>50)return j({error:"Team name must contain 2–50 characters."},400);
        const id=crypto.randomUUID(), code=randomCode();
        const s=await setting(db);
        await db.prepare("INSERT INTO birthday_teams(id,name,code_hash,started_at) VALUES(?,?,?,?)").bind(id,name,await digest(norm(code)),s.status==="live"?now():null).run();
        await log(db,id,"new_team",name);return j({created:true,name,code});
      }
      if(act==="admin_status"){
        const status=String(data.status||"");
        if(!["lobby","live","paused"].includes(status))return j({error:"Unknown game status."},400);
        const s=await setting(db);await db.prepare("UPDATE birthday_settings SET status=?,started_at=COALESCE(started_at,?) WHERE id=1").bind(status,status==="live"?now():s.started_at).run();
        if(status==="live")await db.prepare("UPDATE birthday_teams SET started_at=COALESCE(started_at,?)").bind(now()).run();
        await log(db,null,"game_status",status);
      } else if(act==="admin_reset"){
        await db.prepare("UPDATE birthday_settings SET status='lobby',started_at=NULL WHERE id=1").run();
        await db.prepare("UPDATE birthday_teams SET stage=1,phase='puzzle',score=0,hints=0,wrong=0,started_at=NULL,finished_at=NULL").run();
        await db.prepare("DELETE FROM birthday_events").run();
      } else if(act==="admin_remove_team"){
        await db.prepare("DELETE FROM birthday_teams WHERE id=?").bind(String(data.teamId||"")).run();
      } else if(act==="admin_override"){
        const t=await db.prepare("SELECT * FROM birthday_teams WHERE id=?").bind(String(data.teamId||"")).first();
        if(!t)return j({error:"Team not found."},404);
        if(t.phase==="finished")return j({error:"Team already finished."},400);
        if(t.phase==="puzzle")await db.prepare("UPDATE birthday_teams SET phase=? WHERE id=?").bind(t.stage===10?"finished":"travel",t.id).run();
        else await db.prepare("UPDATE birthday_teams SET stage=MIN(10,stage+1),phase='puzzle',hints=0,wrong=0 WHERE id=?").bind(t.id).run();
        await log(db,t.id,"override","Host manually advanced");
      } else if(act==="admin_edit_puzzle"){
        const n=Number(data.stage),existing=await puzzle(db,n);
        if(!existing)return j({error:"Invalid stage."},400);
        const changes=data.changes||{};
        for(const k of ["tag","title","intro","body","instruction","placeholder","cipher","destination","arrival","fact"]){
          if(typeof changes[k]==="string")existing[k]=changes[k].slice(0,k==="body"?2400:280);
        }
        if(Array.isArray(changes.answers)&&changes.answers.length>0)existing.answers=changes.answers.map(x=>String(x).slice(0,100)).slice(0,12);
        if(Array.isArray(changes.hints))existing.hints=changes.hints.map(x=>String(x).slice(0,240)).slice(0,3);
        await db.prepare("UPDATE birthday_puzzles SET payload=? WHERE stage=?").bind(JSON.stringify(existing),n).run();
        await log(db,null,"edit_puzzle","Stage "+n);
      } else return j({error:"Unknown organiser action."},400);
      return j(await adminState(db));
    }
    if(!act.startsWith("team_"))return j({error:"Unknown action."},400);
    const code=norm(data.code);
    const t=await db.prepare("SELECT * FROM birthday_teams WHERE code_hash=?").bind(await digest(code)).first();
    if(!t)return j({error:"Team code not recognised."},403);
    if(act==="team_state")return j(await teamState(db,code));
    const s=await setting(db);
    if(s.status!=="live")return j({error:s.status==="paused"?"The organiser has paused the hunt.":"The hunt has not started yet."},409);
    const p=await puzzle(db,t.stage);
    if(act==="team_answer"){
      if(t.phase!=="puzzle")return j({error:"This stage has already been solved."},409);
      const value=norm(data.answer);
      if(!value||value.length>100)return j({error:"Enter an answer (100 characters maximum)."},400);
      const correct=p.answers.some(a=>norm(a)===value);
      if(correct){
        const points=Math.max(0,10-2*t.hints-Math.min(5,t.wrong));
        const result=await db.prepare("UPDATE birthday_teams SET score=score+?,phase=?,finished_at=? WHERE id=? AND phase='puzzle'").bind(points,t.stage===10?"finished":"travel",t.stage===10?now():null,t.id).run();
        if(result.meta.changes>0)await log(db,t.id,"solved","+"+points+" points");
      } else {
        await db.prepare("UPDATE birthday_teams SET wrong=wrong+1 WHERE id=? AND phase='puzzle'").bind(t.id).run();
      }
      return j(await teamState(db,code,correct));
    }
    if(act==="team_hint"){
      if(t.phase!=="puzzle")return j({error:"Hints are only available when solving."},409);
      if(t.hints>=p.hints.length)return j({error:"No more hints available."},400);
      await db.prepare("UPDATE birthday_teams SET hints=MIN(hints+1,?) WHERE id=? AND phase='puzzle'").bind(p.hints.length,t.id).run();
      return j(await teamState(db,code));
    }
    if(act==="team_arrive"){
      if(t.phase!=="travel")return j({error:"Solve your current cipher first."},409);
      await db.prepare("UPDATE birthday_teams SET stage=stage+1,phase='puzzle',hints=0,wrong=0 WHERE id=? AND phase='travel' AND stage<10").bind(t.id).run();
      await log(db,t.id,"arrived","Checkpoint "+t.stage);
      return j(await teamState(db,code));
    }
    return j({error:"Unknown team action."},400);
  }catch(err){return j({error:"Game server error. Please ask the organiser to check deployment.",detail:String(err).slice(0,200)},500);}
}
