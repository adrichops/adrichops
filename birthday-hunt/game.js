'use strict';
const root=document.getElementById('app'), nav=document.getElementById('nav');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>String(Math.max(0,n)).padStart(2,'0');
function duration(ms){const n=Math.max(0,Math.floor(ms/1000));return [fmt(Math.floor(n/3600)),fmt(Math.floor(n%3600/60)),fmt(n%60)].join(':');}
let state=null,host=null,teamSignedIn=false,hostSignedIn=false,receivedAt=Date.now();
let view=new URLSearchParams(location.search).has('host')?'hostlogin':'home';
let registrationKey='',registrationCode='';
let message='',error=false,editing=1,editorOpen=false,lastCode='',busy=false,resetOpen=false;
function timer(t){return '<span class="live-timer" aria-label="Active elapsed time">'+duration(t.elapsedMs+(t.timerRunning?Date.now()-receivedAt:0))+'</span>';}
async function api(action,payload={}) {
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetch('./api',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:controller.signal});
  let value;try{value=await response.json();}catch{throw Error('The game server did not respond correctly. Please retry.');}
  if(!response.ok||value.error)throw Object.assign(new Error(value.error||'Game server error.'),{status:response.status});
  document.getElementById('connection').textContent='';return value;
 } catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Connection lost. Your saved progress is safe. Reconnect and refresh before retrying.');throw e;}
 finally{clearTimeout(timeout);}
}
function say(s,bad=false){message=s;error=bad;}
function msg(){return message?'<div role="alert" class="notice '+(error?'bad':'')+'">'+esc(message)+'</div>':""}
function go(v){view=v;message="";render();window.scrollTo({top:0,behavior:"smooth"})}
function header(t,s){return '<div class="pagehead"><div><div class="eyebrow">Your team</div><h2>'+esc(t.name)+'</h2></div><div><span class="minor">CURRENT STAGE</span><div class="metric">'+fmt(t.stage)+' / 10</div></div></div><div class="progress">'+Array.from({length:10},(_,i)=>'<div class="'+(i<t.progress?'done':i===t.stage-1?'active':'')+'"></div>').join("")+'</div>'}
function side(t){return '<aside class="sidebar"><section class="panel"><div class="minor">ELAPSED TIME</div><div class="metric">'+timer(t)+'</div><div class="minor">TOTAL POINTS</div><div class="metric">'+t.score+' / 100</div></section><section class="panel"><div class="eyebrow">A few things to know</div><p>10 points per correct answer. Each hint costs 2. Wrong answers cost 1 (up to 5 per stage).</p><p>Take it at walking pace, stay together and try the clues without looking up answers.</p><button class="btn alt" data-go="leader">See the scores →</button></section></aside>'}
function cipher(p){if(!p.cipher)return"";return '<div class="cipher"><label for="shift">OPTIONAL CAESAR DECODER · SHIFT <span id="shift-number">0</span></label><input id="shift" type="range" min="0" max="25" value="0"><output id="decoded" data-cipher="'+esc(p.cipher)+'">'+esc(p.cipher)+'</output></div>'}
function game(){if(!state)return home();const t=state.team;if(t.phase==="finished")return '<div class="complete"><div class="eyebrow">You made it — all ten clues!</div><h1>THE <em>LAST</em><br>ROUND.</h1><h2>'+esc(state.finish.destination)+'</h2><p>'+esc(state.finish.arrival)+' · Time: '+timer(t)+'</p><div class="number">'+t.score+' / 100</div><p>Thanks for being part of the birthday adventure. Time to find everyone and raise a glass!</p><button class="btn" data-go="leader">See the scores</button></div>';let body;
if(state.status!=="live")body='<section class="panel"><div class="eyebrow">Nearly ready</div><h2>'+ (state.status==="paused"?"Game paused":"We’ll be setting off soon")+'</h2><p>Your progress is saved. Check back when the organiser starts the hunt.</p><button class="btn alt" data-action="refresh">CHECK STATUS ↻</button></section>';
else if(t.phase==="travel"){const d=state.travel;body='<div class="destination"><div class="eyebrow">You got it! Here’s your next stop</div><h2>'+esc(d.destination)+'</h2><p>'+esc(d.arrival)+'</p><p>'+esc(d.fact)+'</p><h3>A photo before the next clue</h3><p>When everyone arrives, take a selfie with your whole team and the location clearly visible. Send it to Adrian on WhatsApp with <strong>'+esc(t.name)+' · checkpoint '+t.stage+'</strong>.</p>'+(t.selfieStatus==='pending'?'<div class="notice" role="status">Waiting for Adrian to check your photo. '+(t.stage===10?'Your finish will be confirmed':'The next clue will appear')+' after approval.</div><button class="btn alt" data-action="refresh">Check for approval ↻</button>':(t.selfieStatus==='retry'?'<div class="notice">Please send another selfie showing your team and the location clearly, then tap below again.</div>':'')+(t.answerVerified?'<button class="btn" data-action="selfiesent">I’ve sent our selfie on WhatsApp</button>':'<p>Please ask Adrian to check this team’s saved progress.</p>'))+'</div>'}
else{const p=state.puzzle;body='<div class="panel"><div class="eyebrow">'+esc(p.tag)+' · STAGE '+t.stage+'/10</div><h2>'+esc(p.title)+'</h2><p>'+esc(p.intro)+'</p><p>Available this stage: <strong>'+Math.max(0,10-2*t.hintsUsed-Math.min(5,t.wrongUsed))+' / 10 points</strong></p><div class="paper"><div class="eyebrow">Your clue</div><p>'+esc(p.body)+'</p>'+cipher(p)+'<p><strong>'+esc(p.instruction)+'</strong></p><form id="answer"><label for="solution">YOUR SOLUTION</label><input id="solution" name="answer" maxlength="100" required autocomplete="off" autocapitalize="characters" placeholder="'+esc(p.placeholder||"Enter decoded destination")+'"><button class="btn" type="submit">Check our answer</button></form></div><button class="btn alt" data-action="hint" '+(t.hintsUsed>=state.hintCount?'disabled':'')+'>A little hint (−2 points)</button>'+(state.unlockedHints||[]).map((h,i)=>'<div class="hint">HINT '+(i+1)+': '+esc(h)+'</div>').join("")+'</div>'}
return (registrationCode?'<section class="panel team-code-note"><h3>Save your team code</h3><p>Keep this private code so you can rejoin your team on another phone or after signing out.</p><strong class="saved-team-code">'+esc(registrationCode)+'</strong><p>Take a screenshot or write it down before leaving this page.</p></section>':'')+header(t,state)+'<div class="game-clock"><strong>Stage '+t.stage+' / 10</strong>'+timer(t)+'</div><div class="layout"><div>'+body+msg()+'</div>'+side(t)+'</div>'}
function home(){return '<section class="hero"><div><div class="eyebrow">You’re invited to a birthday wander</div><h1>It’s Adrian’s<br><em>birthday!</em></h1><p>Thanks for coming along. We’ll wander around Paddington Recreation Ground, solve some puzzles together and finish with a drink. Find your team, bring your curiosity and enjoy the walk.</p><div class="facts"><span>10 puzzles</span><span>About 90 minutes</span><span>At walking pace</span></div></div><div class="panel"><div class="eyebrow">Join your team</div><h2>Who’s on your team?</h2><p>Choose one phone for your team. Pick a name and we’ll give you a private code to keep.</p><form id="register"><label for="register-name">TEAM NAME</label><input id="register-name" name="name" required minlength="2" maxlength="50" autocomplete="off" placeholder="Your team’s name"><button class="btn full" type="submit">Create our team</button></form><details class="existing-team"><summary>Already have a team code?</summary><form id="login"><label for="team">TEAM CODE</label><input id="team" name="code" required maxlength="32" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX"><button class="btn full" type="submit">Rejoin our team</button></form></details>'+msg()+'</div></section><div class="steps"><div class="step"><b>01 — Solve a little</b><p>Put your heads together. Each answer points you towards your next stop.</p></div><div class="step"><b>02 — Wander together</b><p>Use the park map, then send Adrian a team selfie on WhatsApp at each stop. His approval opens your next clue.</p></div><div class="step"><b>03 — Raise a glass</b><p>The last clue brings us back together for a birthday drink.</p></div></div>'}
function board(){const list=(view==='hostleader'?host?.leaderboard:state?.leaderboard)||[];return '<div class="pagehead"><div><div class="eyebrow">How everyone is getting on</div><h2>Scores<span class="green">.</span></h2></div><button class="btn alt" data-action="refresh">REFRESH ↻</button></div><p>Ranked by points, then progress, then active elapsed time. Destinations remain secret.</p><div class="panel tablewrap"><table class="table"><thead><tr><th>RANK</th><th>TEAM</th><th>PROGRESS</th><th>POINTS</th><th>TIME</th></tr></thead><tbody>'+list.map((t,i)=>'<tr><td data-label="Rank">'+fmt(i+1)+'</td><td data-label="Team"><strong>'+esc(t.name)+'</strong> '+(t.finished?'<span class="pill">FINISHED</span>':'')+'</td><td data-label="Progress">'+t.progress+'/10</td><td data-label="Points"><strong>'+t.score+'</strong></td><td data-label="Time">'+duration(t.elapsedMs)+'</td></tr>').join("")+'</tbody></table>'+(list.length?'':'<p>Log into a team to view standings.</p>')+'</div>'}
function hostLogin(){return '<section class="hero"><div><div class="eyebrow">For the organiser</div><h1>Host the<br><em>birthday hunt.</em></h1><p>Get the teams ready, start the walk and help everyone along the way.</p></div><div class="panel"><h2>Organiser sign-in</h2><form id="hostlogin"><label for="pass">PRIVATE HOST PASSPHRASE</label><input id="pass" name="password" type="password" autocomplete="current-password" required minlength="12" placeholder="Your organiser passphrase"><button class="btn full">Sign in</button></form>'+msg()+'</div></section>'}
function selfieQueue(){
 const pending=host.teams.filter(t=>t.selfieStatus==='pending');
 return '<section class="panel selfie-queue"><h3>Selfies to check ('+pending.length+')</h3><p>Open WhatsApp and check the whole team is at the destination shown below. Approving opens their next clue; checkpoint 10 confirms their finish.</p>'+(pending.length?pending.map(t=>'<form class="selfie-review team-row" id="selfie-'+esc(t.id)+'" data-team="'+esc(t.id)+'" data-version="'+t.version+'" data-stage="'+t.stage+'"><h3>'+esc(t.name)+'</h3><p><strong>Checkpoint '+t.stage+' · '+esc(t.checkpointDestination)+'</strong></p><p class="tiny">Requested '+esc(new Date(t.selfieRequestedAt).toLocaleTimeString())+'</p><label class="selfie-check"><input type="checkbox" name="checked" required> I’ve checked their WhatsApp selfie: the whole team and this location are visible.</label><button class="btn" type="submit">'+(t.stage===10?'Approve selfie & finish':'Approve selfie & open next clue')+'</button><button class="btn alt" type="button" data-action="retryselfie" data-id="'+esc(t.id)+'">Ask for another selfie</button></form>').join(''):'<p>No photos waiting for review. Teams appear here after tapping “I’ve sent our selfie”.</p>')+'</section>';
}
function hostPage(){if(!host)return hostLogin();return '<div class="pagehead"><div><div class="eyebrow">For the organiser</div><h2>Host dashboard</h2><span class="pill">'+esc(host.status)+'</span></div><div><button class="btn alt" data-go="hostleader">Scores</button><button class="btn alt" data-action="hostrefresh">REFRESH ↻</button></div></div>'+msg()+selfieQueue()+'<div class="admin-grid"><div class="panel"><div class="minor">REGISTERED TEAMS</div><div class="number">'+host.teams.length+'</div></div><div class="panel"><div class="minor">GAME STATUS</div><div class="metric">'+esc(host.status.toUpperCase())+'</div></div><div class="panel"><div class="minor">STARTED</div><div class="metric" style="font-size:16px">'+esc(host.gameStartedAt?new Date(host.gameStartedAt).toLocaleString():"Not yet")+'</div></div></div><section class="panel" style="margin:20px 0"><h3>Game controls</h3><button class="btn" data-action="start">START / RESUME</button><button class="btn alt" data-action="pause">PAUSE</button><button class="btn alt" data-action="lobby">LOBBY</button><button class="btn warn" data-action="reset">RESET PROGRESS</button><p class="field-note">Reset returns all teams to stage 1 and clears scores and timers. Team codes and edited challenges are kept.</p></section><section class="panel" style="margin-bottom:20px"><h3>Register a team</h3><form id="create"><label for="name">TEAM NAME</label><input class="short" id="name" name="name" required minlength="2" maxlength="50" placeholder="Sherlock Homies"><button class="btn">CREATE TEAM + ACCESS CODE</button></form>'+(lastCode?'<p>Share this private code with the captain:</p><div id="new-code">'+esc(lastCode)+'</div>':'')+'</section><section class="panel" style="margin-bottom:20px"><h3>Teams and progress</h3><div>'+host.teams.map(t=>'<article class="team-row"><h3>'+esc(t.name)+'</h3><p>Stage '+t.stage+'/10 · '+esc(t.phase)+' · '+t.score+' points · '+duration(t.elapsedMs)+'</p><p>'+esc(t.phase==='travel'?(t.selfieStatus==='pending'?'Selfie awaiting your review':t.selfieStatus==='retry'?'Another selfie requested':'Travelling / waiting for a selfie'):'')+'</p><button class="btn warn" data-action="remove" data-id="'+esc(t.id)+'">REMOVE TEAM</button></article>').join("")+'</div></section><section class="panel"><h3>Challenge editor</h3><button class="btn alt" data-action="editor">'+(editorOpen?"HIDE EDITOR":"EDIT CIPHERS")+'</button>'+(editorOpen?editForm():'')+'</section><section class="panel" style="margin-top:20px"><h3>Activity log</h3>'+(host.events||[]).slice(0,30).map(e=>'<p class="tiny">'+esc(e.at)+' — '+esc(e.name||'HOST')+': '+esc(e.action)+' '+esc(e.detail||"")+'</p>').join("")+'</section>'}
function editForm(){
 const p=host.stages.find(x=>x.id===editing)||host.stages[0];
 const fields=[['title','Title'],['location','Starting location'],['intro','Introduction'],['body','Questions / challenge'],['instruction','Answer instructions'],['cipher','Caesar cipher (optional)'],['answers','Accepted answers — one per line'],['hints','Hints — up to three, one per line'],['destination','Destination'],['arrival','Arrival instructions'],['fact','Destination note']];
 return '<div class="editbox"><p>Pause before editing. Changes apply when players refresh. Keep cipher text and the question consistent.</p><label for="pick">Stage</label><select id="pick">'+host.stages.map(x=>'<option value="'+x.id+'" '+(x.id===editing?'selected':'')+'>'+x.id+' — '+esc(x.title)+'</option>').join('')+'</select><form id="edit">'+fields.map(([key,label])=>'<label for="edit-'+key+'">'+label+'</label><textarea id="edit-'+key+'" name="'+key+'" maxlength="'+(key==='body'?5000:key==='answers'?1212:key==='hints'?903:500)+'">'+esc(Array.isArray(p[key])?p[key].join('\n'):p[key]||'')+'</textarea>').join('')+'<button class="btn" '+(host.status==='live'?'disabled':'')+'>SAVE CHANGES</button></form></div>';
}
function render(preserve=false) {
 const drafts=preserve?[...root.querySelectorAll('input,textarea,select')].map(e=>[e.id,e.value]):[];
 nav.innerHTML=(teamSignedIn?'<button data-go="game">Our hunt</button><button data-go="leader">Scores</button><button data-action="logout">Team sign out</button>':'<button data-go="home">Join your team</button>')+'<button data-go="hostlogin">Host</button>'+(hostSignedIn?'<button data-action="hostlogout">Host sign out</button>':'');
 root.innerHTML=view==='game'?game():['leader','hostleader'].includes(view)?board():view==='hostlogin'?hostLogin():view==='host'?hostPage():home();
 if(view==='host'&&resetOpen)root.insertAdjacentHTML('afterbegin','<form class="panel danger-confirm" id="reset-confirm"><h3>Reset this hunt?</h3><p>This clears every team’s progress, points and timers. It keeps team codes and challenge edits.</p><label for="reset-word">Type RESET to confirm</label><input id="reset-word" name="confirmation" required pattern="RESET" autocomplete="off"><button class="btn warn">CONFIRM RESET</button><button type="button" class="btn alt" data-action="cancelreset">CANCEL</button></form>');
 for(const [id,value]of drafts){const el=document.getElementById(id);if(el&&el.type!=='password')el.value=value;}
 root.querySelectorAll('button').forEach(b=>{if(busy)b.disabled=true;});tick();
}
function tick(){if(state)document.querySelectorAll('.live-timer').forEach(e=>e.textContent=duration(state.team.elapsedMs+(state.team.timerRunning?Date.now()-receivedAt:0)));}
function useTeam(value){state=value;teamSignedIn=true;receivedAt=Date.now();return value;}
async function loadTeam(){return useTeam(await api('team_state'));}
async function loadHost(){host=await api('admin_state');hostSignedIn=true;return host;}
async function mutate(action,payload={},asHost=false) {
 if(asHost){
  const value=await api(action,{version:host?.version,...payload});
  if(value.created){lastCode=value.name+': '+value.code;await loadHost();}else host=value;
  hostSignedIn=true;view='host';say(action==='admin_reset'?'Progress reset. The hunt is in the lobby.':action==='admin_edit_puzzle'?'Challenge saved.':action==='admin_approve_selfie'?'Selfie approved. The team can continue.':action==='admin_reject_selfie'?'The team has been asked for another selfie.':'');
 } else {
  useTeam(await api(action,{version:state.team.version,stage:state.team.stage,gameVersion:state.gameVersion,...payload}));view='game';
  say(action==='team_answer'?(state.correct?'Code accepted. Follow the unlocked destination.':'Incorrect answer. One point deducted from this stage, up to five.'):'',action==='team_answer'&&!state.correct);
 }
}
async function run(work) {
 if(busy)return;busy=true;
 const buttons=[...document.querySelectorAll('button')].map(b=>[b,b.disabled]);buttons.forEach(([b])=>b.disabled=true);
 try{await work();busy=false;render();}
 catch(e){
  if(e.status===409){try{if(view==='host')await loadHost();else if(teamSignedIn)await loadTeam();}catch{}}
  if(e.status===401){if(['host','hostleader'].includes(view)){hostSignedIn=false;host=null;view='hostlogin';}else{teamSignedIn=false;state=null;view='home';}}
  say(e.message,true);busy=false;render(true);
 } finally{busy=false;buttons.forEach(([b,disabled])=>b.disabled=disabled);}
}
document.addEventListener('submit',event=>{
 const f=event.target;if(!f.matches('.selfie-review')&&!['register','login','hostlogin','answer','create','edit','reset-confirm'].includes(f.id))return;
 event.preventDefault();const data=Object.fromEntries(new FormData(f).entries());
 run(async()=>{
  if(f.matches('.selfie-review'))await mutate('admin_approve_selfie',{teamId:f.dataset.team,teamVersion:Number(f.dataset.version),stage:Number(f.dataset.stage),confirmSelfie:data.checked==='on'},true);
  else if(f.id==='register'){
   if(!registrationKey)registrationKey=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
   const value=await api('team_register',{name:data.name,registrationKey});registrationCode=value.registrationCode;useTeam(value);view='game';say('');
  }
  else if(f.id==='login'){registrationCode='';useTeam(await api('team_login',{code:data.code}));view='game';say('');}
  else if(f.id==='hostlogin'){host=await api('admin_login',{password:data.password});hostSignedIn=true;view='host';say('');}
  else if(f.id==='answer')await mutate('team_answer',{answer:data.answer});
  else if(f.id==='create')await mutate('admin_create_team',{name:data.name},true);
  else if(f.id==='edit')await mutate('admin_edit_puzzle',{stage:editing,changes:{...data,answers:data.answers.split('\n').filter(Boolean),hints:data.hints.split('\n').filter(Boolean)}},true);
  else if(f.id==='reset-confirm'){await mutate('admin_reset',{confirm:data.confirmation},true);resetOpen=false;lastCode='';}
 });
});
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||busy)return;
 if(b.dataset.go)return run(async()=>{let target=b.dataset.go;if(target==='hostlogin'&&hostSignedIn){await loadHost();target='host';}if(target==='game'&&teamSignedIn)await loadTeam();if(target==='leader'&&teamSignedIn)await loadTeam();if(target==='hostleader')await loadHost();view=target;say('');window.scrollTo({top:0,behavior:'auto'});});
 const action=b.dataset.action;if(!action)return;
 run(async()=>{
  if(action==='logout'||action==='hostlogout'){
   try{await api(action==='logout'?'team_logout':'admin_logout');}catch(e){if(e.status!==401)throw e;}
   if(action==='logout'){teamSignedIn=false;state=null;registrationCode='';registrationKey='';view='home';}else{hostSignedIn=false;host=null;lastCode='';view='hostlogin';}say('');
  }else if(action==='refresh'){if(view==='hostleader')await loadHost();else if(teamSignedIn)await loadTeam();}
  else if(action==='hostrefresh')await loadHost();
  else if(action==='selfiesent')await mutate('team_request_approval',{selfieSent:true});
  else if(action==='hint')await mutate('team_hint');
  else if(['start','pause','lobby'].includes(action))await mutate('admin_status',{status:{start:'live',pause:'paused',lobby:'lobby'}[action]},true);
  else if(action==='reset'){resetOpen=true;window.scrollTo({top:0,behavior:'auto'});}
  else if(action==='cancelreset')resetOpen=false;
  else if(action==='retryselfie'){const t=host.teams.find(t=>t.id===b.dataset.id);await mutate('admin_reject_selfie',{teamId:t.id,teamVersion:t.version,stage:t.stage},true);}
  else if(action==='remove')await mutate('admin_remove_team',{teamId:b.dataset.id},true);
  else if(action==='editor')editorOpen=!editorOpen;
 });
});
document.addEventListener('change',event=>{if(event.target.id==='pick'){editing=Number(event.target.value);render();}});
document.addEventListener('input',event=>{
 if(event.target.id==='shift'){
  const shift=Number(event.target.value),out=document.getElementById('decoded');document.getElementById('shift-number').textContent=shift;
  out.textContent=out.dataset.cipher.replace(/[A-Z]/g,c=>String.fromCharCode((c.charCodeAt(0)-65-shift+26)%26+65));
 }
});
async function poll(){
 if(busy||document.hidden)return;
 try{
  if(teamSignedIn&&['game','leader'].includes(view)){
   const before=JSON.stringify([state.team.version,state.status,state.gameVersion]);await loadTeam();
   const changed=before!==JSON.stringify([state.team.version,state.status,state.gameVersion]);
   if(changed||view==='leader')render(true);else tick();
  }else if(hostSignedIn&&['host','hostleader'].includes(view)){
   if(editorOpen||resetOpen||root.querySelector('.selfie-check input:checked')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   await loadHost();render();
  }
 }catch(e){document.getElementById('connection').textContent='Live updates paused. '+e.message;}
}
(async()=>{
 // Remove credentials retained by the original prototype; sessions now use HttpOnly cookies.
 try{localStorage.removeItem('last_round_team');sessionStorage.removeItem('last_round_host');}catch{}
 try{if(view==='hostlogin'){await loadHost();view='host';}else{await loadTeam();view='game';}}
 catch(e){if(e.status!==401)say(e.message,true);}
 render();setInterval(tick,1000);setInterval(poll,15000);window.addEventListener('online',poll);
})();
