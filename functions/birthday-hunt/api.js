// Puzzle content lives in D1, never in a public asset or this source file.
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const enc = new TextEncoder();
const iso = () => new Date().toISOString();
const hex = bytes => [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const digest = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(text))));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const fail = (message, status=400) => {throw Object.assign(new Error(message),{status});};
const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer',...extra
}});
function clock(s) {return s.elapsed_ms + (s.status==='live' && s.resumed_at ? Math.max(0,Date.now()-s.resumed_at) : 0);}
async function settings(db) {return db.prepare('SELECT * FROM birthday_settings WHERE id=1').first();}
async function puzzle(db,stage) {
  const row=await db.prepare('SELECT payload FROM birthday_puzzles WHERE stage=?').bind(stage).first();
  if(!row) fail('This challenge is not configured. Ask the organiser.',503);
  return JSON.parse(row.payload);
}
function publicTeam(t,s) {
  return {id:t.id,name:t.name,stage:t.stage,phase:t.phase,score:t.score,hintsUsed:t.hints,wrongUsed:t.wrong,
    selfieStatus:t.selfie_status,selfieRequestedAt:t.selfie_requested_at,answerVerified:t.verified_stage===t.stage,
    version:t.version,startedAt:t.started_at,finishedAt:t.finished_at,
    elapsedMs:t.started_at ? Math.max(0,(t.finished_elapsed_ms ?? clock(s))-t.started_elapsed_ms) : 0,
    timerRunning:!!t.started_at && s.status==='live' && t.phase!=='finished',
    progress:t.phase==='finished'?10:t.phase==='travel'?t.stage:t.stage-1};
}
async function leaderboard(db,s) {
  const {results}=await db.prepare('SELECT * FROM birthday_teams WHERE archived=0').all();
  return results.map(t=>{const v=publicTeam(t,s);return {name:v.name,score:v.score,progress:v.progress,finished:t.phase==='finished',elapsedMs:v.elapsedMs};})
    .sort((a,b)=>b.score-a.score||b.progress-a.progress||a.elapsedMs-b.elapsedMs||a.name.localeCompare(b.name));
}
async function teamState(db,id,correct=null) {
  const t=await db.prepare('SELECT * FROM birthday_teams WHERE id=? AND archived=0').bind(id).first();
  if(!t) fail('Your team is no longer active. Ask the organiser.',401);
  const s=await settings(db), out={team:publicTeam(t,s),status:s.status,gameVersion:s.version,gameStartedAt:s.started_at,leaderboard:await leaderboard(db,s),correct};
  if(t.phase==='puzzle' && s.status==='live') {
    const p=await puzzle(db,t.stage);
    out.puzzle=Object.fromEntries(['id','tag','title','location','intro','body','instruction','placeholder','cipher'].map(k=>[k,p[k]||'']));
    out.unlockedHints=p.hints.slice(0,t.hints);out.hintCount=p.hints.length;
  } else if(t.phase==='travel'||t.phase==='finished') {
    const p=await puzzle(db,t.stage);
    out[t.phase==='travel'?'travel':'finish']={destination:p.destination,arrival:p.arrival,fact:p.fact};
  }
  return out;
}
async function adminState(db) {
  const s=await settings(db);
  const {results:teams}=await db.prepare('SELECT * FROM birthday_teams WHERE archived=0 ORDER BY name').all();
  const {results:stages}=await db.prepare('SELECT payload FROM birthday_puzzles ORDER BY stage').all();
  const {results:events}=await db.prepare('SELECT e.id,t.name,e.action,e.detail,e.occurred_at AS at FROM birthday_events e LEFT JOIN birthday_teams t ON t.id=e.team_id ORDER BY e.id DESC LIMIT 75').all();
  return {status:s.status,version:s.version,gameStartedAt:s.started_at,teams:teams.map(t=>({...publicTeam(t,s),checkpointDestination:t.phase==='travel'?JSON.parse(stages[t.stage-1].payload).destination:null})),stages:stages.map(p=>JSON.parse(p.payload)),events,leaderboard:await leaderboard(db,s)};
}
const logStmt=(db,id,action,detail='')=>db.prepare('INSERT INTO birthday_events(team_id,action,detail,occurred_at) VALUES(?,?,?,?)').bind(id,action,detail,iso());
async function rate(db,key,max,seconds) {
  const bucket=Math.floor(Date.now()/1000/seconds), until=(bucket+1)*seconds;
  const k=await digest(key+':'+bucket);
  const row=await db.prepare('INSERT INTO birthday_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(k,until).first();
  if(row.hits>max) fail('Too many attempts. Please wait before trying again.',429);
}
function cookie(request,role,value,age) {
  const url=new URL(request.url), local=['127.0.0.1','localhost'].includes(url.hostname);
  return `birthday_${role}=${value}; Path=/birthday-hunt/; HttpOnly; SameSite=Strict; Max-Age=${age}${local?'':'; Secure'}`;
}
function tokenFrom(request,role) {
  return (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('birthday_'+role+'='))?.split('=')[1]||'';
}
async function session(db,request,role,authVersion) {
  const token=tokenFrom(request,role);
  if(!/^[a-f0-9]{64}$/.test(token)) fail('Please sign in again.',401);
  const row=await db.prepare('SELECT * FROM birthday_sessions WHERE token_hash=? AND role=? AND expires_at>?').bind(await digest(token),role,Date.now()).first();
  if(!row || (role==='host' && row.auth_version!==authVersion)) fail('Please sign in again.',401);
  return row;
}
async function issueSession(db,request,role,teamId,authVersion) {
  const token=random(),seconds=role==='host'?43200:604800;
  await db.batch([
    db.prepare('DELETE FROM birthday_sessions WHERE expires_at<? OR token_hash=?').bind(Date.now(),await digest(tokenFrom(request,role))),
    db.prepare('DELETE FROM birthday_limits WHERE expires_at<?').bind(Math.floor(Date.now()/1000)),
    db.prepare('INSERT INTO birthday_sessions(token_hash,role,team_id,expires_at,auth_version) VALUES(?,?,?,?,?)').bind(await digest(token),role,teamId,Date.now()+seconds*1000,authVersion)
  ]);
  return cookie(request,role,token,seconds);
}
async function verifyPassword(password,verifier) {
  const [kind,rounds,salt,expected]=String(verifier||'').split(':');
  if(kind!=='pbkdf2' || rounds!=='100000' || !/^[a-f0-9]{32}$/.test(salt||'') || !/^[a-f0-9]{64}$/.test(expected||'')) fail('Organiser sign-in has not been configured.',503);
  if(typeof password!=='string'||password.length<12||password.length>200)return false;
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const actual=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},key,256));
  let difference=0;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^actual.charCodeAt(i);
  return difference===0;
}
function validatePuzzle(existing,changes) {
  if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('Invalid challenge changes.');
  const result={...existing};
  for(const key of ['tag','title','location','intro','body','instruction','placeholder','cipher','destination','arrival','fact']) {
    if(key in changes){if(typeof changes[key]!=='string'||changes[key].length>(key==='body'?5000:500))fail('Challenge field is invalid or too long.');result[key]=changes[key].trim();}
  }
  for(const key of ['answers','hints']) if(key in changes){
    if(!Array.isArray(changes[key])||changes[key].length>(key==='answers'?12:3)||changes[key].some(v=>typeof v!=='string'||!v.trim()||v.length>(key==='answers'?100:300)))fail('Invalid answers or hints.');
    result[key]=changes[key].map(v=>v.trim());
  }
  if(!result.title||!result.body||!result.destination||!result.answers.length||result.answers.some(a=>!norm(a)))fail('Title, question, destination and an answer are required.');
  return result;
}
// A browser-generated random request key makes registration retries return the same
// team/code. Only the hash of the derived code is stored, as for host-created teams.
async function createTeam(db,data,registrationKey=null) {
  const name=typeof data.name==='string'?data.name.trim().replace(/\s+/g,' '):'';
  if(name.length<2||name.length>50)fail('Team name must contain 2–50 characters.');
  const raw=registrationKey?(await digest('birthday-registration:'+registrationKey)).slice(0,16):hex(crypto.getRandomValues(new Uint8Array(8)));
  const code=raw.toUpperCase().match(/.{1,4}/g).join('-'),codeHash=await digest(norm(code));
  const id=crypto.randomUUID(),s=await settings(db);
  await db.batch([
    db.prepare('INSERT INTO birthday_teams(id,name,code_hash,started_at,started_elapsed_ms) SELECT ?,?,?,?,? WHERE (SELECT version FROM birthday_settings WHERE id=1)=? AND (SELECT COUNT(*) FROM birthday_teams WHERE archived=0)<100 AND NOT EXISTS(SELECT 1 FROM birthday_teams WHERE archived=0 AND LOWER(name)=LOWER(?)) ON CONFLICT(code_hash) DO NOTHING').bind(id,name,codeHash,s.started_at?iso():null,clock(s),s.version,name),
    db.prepare("INSERT INTO birthday_events(team_id,action,detail,occurred_at) SELECT ?,?,?,? WHERE changes()>0").bind(id,'new_team',registrationKey?'Team registered themselves':name,iso())
  ]);
  const team=await db.prepare('SELECT id,name,archived FROM birthday_teams WHERE code_hash=?').bind(codeHash).first();
  if(team&&!team.archived&&team.name===name)return {id:team.id,name,code,created:true};
  if(team)fail('This registration belongs to another or removed team. Reload to register again.',409);
  const duplicate=await db.prepare('SELECT id FROM birthday_teams WHERE archived=0 AND LOWER(name)=LOWER(?)').bind(name).first();
  if(duplicate)fail('That team name is already taken. Use your existing team code or choose another name.',409);
  fail('The game changed or the team limit was reached. Refresh and try again.',409);
}
async function hostAction(db,act,data) {
  if(act==='admin_state')return adminState(db);
  if(act==='admin_create_team')return createTeam(db,data);
  if(act==='admin_status') {
    if(!['lobby','live','paused'].includes(data.status))fail('Unknown game status.');
    const s=await settings(db);
    if(data.version!==s.version)fail('The game changed. Refresh the dashboard.',409);
    if(data.status==='live') {
      const n=await db.prepare('SELECT COUNT(*) AS n FROM birthday_puzzles').first();if(n.n!==10)fail('Configure all ten challenges before starting.',409);
    }
    const time=Date.now(),stamp=iso(),duration=clock(s);
    const results=await db.batch([
      db.prepare('UPDATE birthday_settings SET status=?,elapsed_ms=?,resumed_at=?,started_at=COALESCE(started_at,?),version=version+1 WHERE id=1 AND version=?').bind(data.status,duration,data.status==='live'?time:null,data.status==='live'?stamp:null,s.version),
      db.prepare('UPDATE birthday_teams SET started_at=? WHERE started_at IS NULL AND archived=0 AND ?=\'live\' AND changes()>0').bind(stamp,data.status)
    ]);
    if(!results[0].meta.changes)fail('The game changed. Refresh the dashboard.',409);
    await logStmt(db,null,'game_status',data.status).run();
  } else if(act==='admin_reset') {
    if(data.confirm!=='RESET')fail('Confirm RESET to clear hunt progress.');
    // QA supplies an exact team allowlist. The check and reset share one transaction,
    // so a newly created real team prevents the reset instead of losing progress.
    const scoped=Object.hasOwn(data,'expectedTeamIds');
    const ids=scoped?data.expectedTeamIds:[];
    if(scoped&&(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!/[a-f0-9-]{36}/.test(id))))fail('Invalid reset team list.');
    const placeholders=ids.map(()=>'?').join(',')||"''";
    const guard=scoped?` AND (SELECT COUNT(*) FROM birthday_teams WHERE archived=0)=? AND NOT EXISTS(SELECT 1 FROM birthday_teams WHERE archived=0 AND id NOT IN (${placeholders}))`:'';
    const reset=await db.batch([
      db.prepare("UPDATE birthday_settings SET status='lobby',started_at=NULL,elapsed_ms=0,resumed_at=NULL,version=version+1 WHERE id=1"+guard).bind(...(scoped?[ids.length,...ids]:[])),
      db.prepare("UPDATE birthday_teams SET stage=1,phase='puzzle',score=0,hints=0,wrong=0,verified_stage=0,selfie_status='none',selfie_requested_at=NULL,started_at=NULL,finished_at=NULL,started_elapsed_ms=0,finished_elapsed_ms=NULL,version=version+1 WHERE changes()>0"+(scoped?` AND id IN (${placeholders})`:'')).bind(...ids),
      db.prepare("INSERT INTO birthday_events(team_id,action,detail,occurred_at) SELECT NULL,'reset',?,? WHERE changes()>0").bind(scoped?'QA team progress reset; protected by exact team allowlist':'All hunt progress reset; teams and puzzle edits retained',iso())
    ]);
    if(!reset[0].meta.changes)fail('Reset blocked: the active teams changed. No progress was reset.',409);
  } else if(act==='admin_remove_team') {
    await db.batch([
      db.prepare('UPDATE birthday_teams SET archived=1,version=version+1 WHERE id=?').bind(String(data.teamId||'')),
      db.prepare('DELETE FROM birthday_sessions WHERE team_id=?').bind(String(data.teamId||'')),
      logStmt(db,String(data.teamId||''),'archive_team','Team removed from the active hunt')
    ]);
  } else if(act==='admin_edit_puzzle') {
    const s=await settings(db);if(s.status==='live')fail('Pause the hunt before editing a challenge.',409);
    const stage=Number(data.stage),p=validatePuzzle(await puzzle(db,stage),data.changes);
    if(data.version!==s.version)fail('The game changed. Refresh before saving.',409);
    const result=await db.batch([
      db.prepare('UPDATE birthday_settings SET version=version+1 WHERE id=1 AND version=? AND status!=\'live\'').bind(s.version),
      db.prepare('UPDATE birthday_puzzles SET payload=? WHERE stage=? AND changes()>0').bind(JSON.stringify(p),stage)
    ]);
    if(!result[0].meta.changes)fail('The game changed. Refresh before saving.',409);
    await logStmt(db,null,'edit_puzzle','Stage '+stage).run();
  } else if(act==='admin_override') {
    fail('Teams must solve the clue and have their checkpoint selfie approved.',409);
  } else if(['admin_approve_selfie','admin_reject_selfie'].includes(act)) {
    const t=await db.prepare('SELECT * FROM birthday_teams WHERE id=? AND archived=0').bind(String(data.teamId||'')).first();
    if(!t)fail('Team not found.',404);
    const s=await settings(db);
    if(data.version!==s.version||data.teamVersion!==t.version||data.stage!==t.stage)fail('This request changed. Refresh before reviewing it.',409);
    if(!s.started_at||!['live','paused'].includes(s.status)||t.phase!=='travel'||t.verified_stage!==t.stage||t.selfie_status!=='pending')fail('This team has no solved checkpoint selfie awaiting review.',409);
    const approve=act==='admin_approve_selfie',finish=approve&&t.stage===10;
    if(approve&&data.confirmSelfie!==true)fail('Check the WhatsApp selfie shows this team at the listed destination first.');
    const guard=" WHERE id=? AND version=? AND stage=? AND archived=0 AND phase='travel' AND verified_stage=stage AND selfie_status='pending' AND (SELECT version FROM birthday_settings WHERE id=1)=? AND (SELECT status FROM birthday_settings WHERE id=1) IN ('live','paused')";
    const args=[t.id,t.version,t.stage,s.version];
    const statement=approve
      ?db.prepare("UPDATE birthday_teams SET stage=?,phase=?,hints=0,wrong=0,verified_stage=0,selfie_status='none',selfie_requested_at=NULL,finished_at=?,finished_elapsed_ms=?,version=version+1"+guard).bind(finish?10:t.stage+1,finish?'finished':'puzzle',finish?iso():null,finish?clock(s):null,...args)
      :db.prepare("UPDATE birthday_teams SET selfie_status='retry',selfie_requested_at=NULL,version=version+1"+guard).bind(...args);
    const result=await db.batch([statement,db.prepare('INSERT INTO birthday_events(team_id,action,detail,occurred_at) SELECT ?,?,?,? WHERE changes()>0').bind(t.id,approve?(finish?'finished':'selfie_approved'):'selfie_retry','Checkpoint '+t.stage+(approve?'; WhatsApp selfie approved by organiser':'; another selfie requested'),iso())]);
    if(!result[0].meta.changes)fail('This request changed. Refresh before reviewing it.',409);
  } else fail('Unknown organiser action.');
  return adminState(db);
}
async function teamAction(db,act,data,id) {
  if(act==='team_state')return teamState(db,id);
  if(act==='team_arrive')fail('Your organiser must approve your checkpoint selfie before you can continue.',409);
  if(!['team_answer','team_hint','team_request_approval'].includes(act))fail('Unknown team action.');
  await rate(db,'team:'+id,60,60);
  const t=await db.prepare('SELECT * FROM birthday_teams WHERE id=? AND archived=0').bind(id).first();
  if(!t)fail('Your team is no longer active.',401);
  const s=await settings(db);
  if(s.status!=='live')fail(s.status==='paused'?'The organiser has paused the hunt.':'The hunt has not started yet.',409);
  if(data.version!==t.version||data.stage!==t.stage||data.gameVersion!==s.version)fail('Your progress changed. Refresh before trying again.',409);
  const p=await puzzle(db,t.stage);
  let statement,correct=null,detail='',event;
  const guard=" WHERE id=? AND version=? AND stage=? AND archived=0 AND (SELECT version FROM birthday_settings WHERE id=1)=? AND (SELECT status FROM birthday_settings WHERE id=1)='live'";
  const bind=[id,t.version,t.stage,s.version];
  if(act==='team_answer') {
    if(t.phase!=='puzzle')fail('Your checkpoint selfie needs organiser approval before the next challenge.',409);
    if(typeof data.answer!=='string'||data.answer.length>100||!norm(data.answer))fail('Enter an answer of up to 100 characters.');
    correct=p.answers.some(a=>norm(a)===norm(data.answer));event=correct?'solved':'wrong_answer';
    statement=db.prepare((correct?"UPDATE birthday_teams SET score=score+MAX(0,10-2*hints-MIN(5,wrong)),phase='travel',verified_stage=stage,selfie_status='none',selfie_requested_at=NULL,version=version+1":"UPDATE birthday_teams SET wrong=wrong+1,version=version+1")+guard+" AND phase='puzzle'").bind(...bind);
    detail=correct?'Stage '+t.stage+' solved':'Stage '+t.stage+'; penalty capped at five points';
  } else if(act==='team_hint') {
    if(t.phase!=='puzzle'||t.hints>=p.hints.length)fail('No more hints are available for this challenge.');
    statement=db.prepare('UPDATE birthday_teams SET hints=hints+1,version=version+1'+guard+" AND phase='puzzle' AND hints<?").bind(...bind,p.hints.length);
    event='hint';detail='Stage '+t.stage+'; hint '+(t.hints+1)+'; two-point penalty';
  } else {
    if(t.phase!=='travel'||t.verified_stage!==t.stage)fail('Solve your current challenge before requesting a selfie check.',409);
    if(t.selfie_status==='pending')fail('Your selfie is already waiting for the organiser.',409);
    if(data.selfieSent!==true)fail('Send your checkpoint selfie on WhatsApp first.');
    statement=db.prepare("UPDATE birthday_teams SET selfie_status='pending',selfie_requested_at=?,version=version+1"+guard+" AND phase='travel' AND verified_stage=stage AND selfie_status IN ('none','retry')").bind(iso(),...bind);
    event='selfie_requested';detail='Team reports WhatsApp selfie sent for checkpoint '+t.stage;
  }
  const result=await db.batch([statement,db.prepare('INSERT INTO birthday_events(team_id,action,detail,occurred_at) SELECT ?,?,?,? WHERE changes()>0').bind(id,event,detail,iso())]);
  if(!result[0].meta.changes)fail('Your progress changed. Refresh before trying again.',409);
  return teamState(db,id,correct);
}
export async function onRequest({request,env}) {
  const db=env.ADRICHOPS_DB;
  if(!db)return json({error:'Game database is unavailable.'},503);
  try {
    if(request.method==='GET') {
      const s=await settings(db),p=await db.prepare('SELECT COUNT(*) AS n FROM birthday_puzzles').first();
      const ready=!!s&&p.n===10&&!!env.BIRTHDAY_ADMIN_PASSWORD_HASH;
      return json({ready},ready?200:503);
    }
    if(request.method!=='POST')return json({error:'Method not allowed.'},405,{'allow':'GET, POST'});
    if(request.headers.get('origin')!==new URL(request.url).origin)fail('Request origin is not allowed.',403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))fail('JSON is required.',415);
    if(Number(request.headers.get('content-length')||0)>16000)fail('Request is too large.',413);
    const text=await request.text();if(enc.encode(text).length>16000)fail('Request is too large.',413);
    let input;try{input=JSON.parse(text);}catch{fail('Invalid JSON.');}
    if(!input||typeof input!=='object'||typeof input.action!=='string')fail('Invalid request.');
    const act=input.action,data=input.payload||{};
    if(!data||typeof data!=='object'||Array.isArray(data))fail('Invalid payload.');
    const authVersion=await digest(env.BIRTHDAY_ADMIN_PASSWORD_HASH||'unconfigured');
    if(act==='team_register') {
      await rate(db,'registration:'+ (request.headers.get('cf-connecting-ip')||'local'),30,900);
      if(typeof data.registrationKey!=='string'||!/^[a-f0-9]{64}$/.test(data.registrationKey))fail('Please reload the page before registering your team.');
      const team=await createTeam(db,data,data.registrationKey);
      const setCookie=await issueSession(db,request,'team',team.id,null);
      return json({...await teamState(db,team.id),registrationCode:team.code},200,{'set-cookie':setCookie});
    }
    if(act==='admin_login'||act==='team_login') {
      const ip=request.headers.get('cf-connecting-ip')||'local';
      await rate(db,authVersion+':'+act+':'+ip,act==='admin_login'?10:40,900);
      if(act==='admin_login') {
        if(!await verifyPassword(data.password,env.BIRTHDAY_ADMIN_PASSWORD_HASH))fail('Incorrect organiser passphrase.',403);
        const setCookie=await issueSession(db,request,'host',null,authVersion);
        return json(await adminState(db),200,{'set-cookie':setCookie});
      }
      if(typeof data.code!=='string'||data.code.length>32)fail('Team code not recognised.',403);
      const t=await db.prepare('SELECT id FROM birthday_teams WHERE code_hash=? AND archived=0').bind(await digest(norm(data.code))).first();
      if(!t)fail('Team code not recognised.',403);
      const setCookie=await issueSession(db,request,'team',t.id,null);
      return json(await teamState(db,t.id),200,{'set-cookie':setCookie});
    }
    const role=act.startsWith('admin_')?'host':act.startsWith('team_')?'team':null;
    if(!role)fail('Unknown action.');
    const auth=await session(db,request,role,authVersion);
    if(act==='admin_logout'||act==='team_logout') {
      await db.prepare('DELETE FROM birthday_sessions WHERE token_hash=?').bind(auth.token_hash).run();
      return json({signedOut:true},200,{'set-cookie':cookie(request,role,'',0)});
    }
    if(role==='host')return json(await hostAction(db,act,data));
    return json(await teamAction(db,act,data,auth.team_id));
  } catch(error) {
    return json({error:error.status?error.message:'Game server unavailable. Please retry or contact the organiser.'},error.status||500);
  }
}
