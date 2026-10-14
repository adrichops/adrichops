const {request,chromium,webkit}=require(process.env.PLAYWRIGHT_PACKAGE||'/Users/adiaz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.HUNT_URL||'http://127.0.0.1:8071';
const privatePath=process.env.HUNT_PRIVATE||'/Users/adiaz/Documents/adrichops/.private/birthday-hunt';
const password=fs.readFileSync(privatePath+'/admin-passphrase.txt','utf8').trim();
const out=process.env.HUNT_QA_OUTPUT||'/tmp/birthday-qa';fs.mkdirSync(out,{recursive:true});
const clients=[],created=[];
async function client(){const c=await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});clients.push(c);return c;}
async function call(c,action,payload={},status=200){const r=await c.post('/birthday-hunt/api',{data:{action,payload}});assert.equal(r.status(),status,action+' HTTP status: '+r.status()+(r.status()!==status?' '+await r.text():''));return r.json();}
const fields=s=>({version:s.team.version,stage:s.team.stage,gameVersion:s.gameVersion});
const checks=[];function pass(label){checks.push(label);console.log('PASS '+label);}
(async()=>{
 const anon=await client(),admin=await client();
 assert.equal((await anon.get('/birthday-hunt/')).status(),200);
 assert.equal((await anon.get('/birthday-hunt/api')).status(),200);
 await call(anon,'admin_state',{},401);await call(anon,'admin_reset',{confirm:'RESET'},401);
 await call(anon,'admin_login',{password:'This password is definitely invalid'},403);
 await call(anon,'team_login',{code:'NOT-A-TEAM'},403);
 const cross=await anon.post('/birthday-hunt/api',{headers:{Origin:'https://example.org'},data:{action:'admin_login',payload:{password:'irrelevant'}}});assert.equal(cross.status(),403);
 const bad=await anon.post('/birthday-hunt/api',{data:'{bad',headers:{'content-type':'application/json'}});assert.equal(bad.status(),400);
 const large=await anon.post('/birthday-hunt/api',{data:'x'.repeat(16001),headers:{'content-type':'application/json'}});assert.equal(large.status(),413);
 let host=await call(admin,'admin_login',{password});
 assert.equal(host.teams.length,0,'Refuse destructive QA when real active teams exist');
 assert.equal(host.stages.length,10);const puzzles=host.stages;
 const authCookies=(await admin.storageState()).cookies;assert(authCookies.every(c=>c.httpOnly&&c.sameSite==='Strict'));if(base.startsWith('https:'))assert(authCookies.every(c=>c.secure));
 pass('Authentication, cookie protection, cross-origin rejection and request validation');
 const original=puzzles[0];
 host=await call(admin,'admin_edit_puzzle',{stage:1,version:host.version,changes:{title:original.title+' QA',hints:['QA hint'],destination:original.destination+' QA',answers:['QAEDIT']}});
 assert.equal(host.stages[0].answers[0],'QAEDIT');assert.equal(host.stages[0].hints.length,1);
 host=await call(admin,'admin_edit_puzzle',{stage:1,version:host.version,changes:original});
 for(let i=0;i<3;i++)created.push(await call(admin,'admin_create_team',{name:'QA '+(i+1)+' '+Date.now()}));
 assert.equal(new Set(created.map(x=>x.code)).size,3);host=await call(admin,'admin_state');
 const players=await Promise.all([client(),client(),client()]);let states=[];
 for(let i=0;i<3;i++){const s=await call(players[i],'team_login',{code:created[i].code});states.push(s);assert(!s.puzzle);}
 await call(players[0],'admin_state',{},401);
 host=await call(admin,'admin_status',{status:'live',version:host.version});
 for(let i=0;i<3;i++)states[i]=await call(players[i],'team_state');
 const onlyCurrent=states[0];assert(!JSON.stringify(onlyCurrent).includes('"answers":'));assert(!JSON.stringify(onlyCurrent).includes(puzzles[8].body));assert(!onlyCurrent.puzzle.hints);assert(!onlyCurrent.puzzle.destination);assert.equal(onlyCurrent.puzzle.id,1);
 await call(players[0],'team_arrive',fields(states[0]),409);
 await call(players[0],'team_answer',{...fields(states[0]),stage:10,answer:puzzles[9].answers[0]},409);
 await call(admin,'admin_edit_puzzle',{stage:1,version:host.version,changes:{title:'must not save'}},409);
 pass('Three unique teams, isolated sessions, challenge gates and live-editor protection');
 states[0]=await call(players[0],'team_answer',{...fields(states[0]),answer:'definitely incorrect'});assert.equal(states[0].correct,false);assert.equal(states[0].team.phase,'puzzle');
 states[0]=await call(players[0],'team_hint',fields(states[0]));assert.equal(states[0].team.hintsUsed,1);assert.equal(states[0].unlockedHints.length,1);
 for(let i=0;i<10;i++){
  const s=await call(players[0],'team_state');assert.equal(s.team.stage,i+1);assert.equal(s.puzzle.id,i+1);
  const data={...fields(s),answer:puzzles[i].answers[0].toLowerCase()};
  if(i===1){
   const responses=await Promise.all([players[0].post('/birthday-hunt/api',{data:{action:'team_answer',payload:data}}),players[0].post('/birthday-hunt/api',{data:{action:'team_answer',payload:data}})]);
   assert.deepEqual(responses.map(r=>r.status()).sort(),[200,409]);states[0]=await call(players[0],'team_state');
  }else states[0]=await call(players[0],'team_answer',data);
  assert.equal(states[0].team.phase,'travel');assert.equal(states[0].travel.destination,puzzles[i].destination);assert(!states[0].puzzle);
  assert.equal(states[0].team.score,(i+1)*10-3);
  // The next puzzle is not visible until arrival; even final completion requires arrival.
  await call(players[0],'team_answer',{...fields(states[0]),answer:'skip'},409);
  states[0]=await call(players[0],'team_arrive',fields(states[0]));
 }
 assert.equal(states[0].team.phase,'finished');assert.equal(states[0].team.score,97);assert(states[0].team.finishedAt);
 pass('All ten destinations, wrong-answer/hint penalties, concurrent answers and final checkpoint');
 states[1]=await call(players[1],'team_answer',{...fields(states[1]),answer:puzzles[0].answers[0]});states[1]=await call(players[1],'team_arrive',fields(states[1]));
 states[2]=await call(players[2],'team_state');assert.equal(states[2].team.stage,1);assert.equal(states[2].team.score,0);
 // A supplied team ID cannot impersonate another team; identity comes from the session.
 const spoof=await call(players[2],'team_state',{teamId:states[0].team.id,code:created[0].code,stage:10});assert.equal(spoof.team.id,states[2].team.id);
 host=await call(admin,'admin_state');host=await call(admin,'admin_status',{status:'paused',version:host.version});
 let frozen=await call(players[1],'team_state');await new Promise(r=>setTimeout(r,1100));let later=await call(players[1],'team_state');assert.equal(later.team.elapsedMs,frozen.team.elapsedMs);assert(!later.team.timerRunning);
 await call(players[1],'team_answer',{...fields(later),answer:puzzles[1].answers[0]},409);
 host=await call(admin,'admin_override',{teamId:states[2].team.id,teamVersion:states[2].team.version});
 states[2]=await call(players[2],'team_state');assert.equal(states[2].team.phase,'travel');assert.equal(states[2].team.score,0);
 host=await call(admin,'admin_override',{teamId:states[2].team.id,teamVersion:states[2].team.version});
 assert.equal(host.teams.find(t=>t.id===states[2].team.id).stage,2);
 host=await call(admin,'admin_status',{status:'live',version:host.version});
 const leader=await call(players[1],'team_state');assert.equal(leader.leaderboard[0].score,97);assert(leader.leaderboard[0].finished);
 pass('Independent progress, leaderboard, frozen pause timer and organiser overrides');
 // Browser tests run against this same backend. No answer/credential values in reports or screenshots.
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium.launch({channel:'chrome'}):webkit.launch());
  try{for(const width of [320,390]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,storageState:await players[1].storageState()});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/birthday-hunt/');await page.locator('#solution').waitFor();
   assert.equal(await page.locator('.game-clock').innerText().then(s=>s.includes('Stage 2 / 10')),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile page width');
   await page.reload();await page.locator('#solution').waitFor();assert.match(await page.locator('.game-clock').innerText(),/Stage 2/);
   assert.equal(await page.locator('#solution').evaluate(e=>getComputedStyle(e).fontSize),'17px');
   assert.equal(await page.evaluate(()=>document.cookie.includes('birthday_')),false,'session cookies inaccessible to JS');
   await page.locator('#shift').fill('4');assert.equal(await page.locator('#decoded').innerText(),puzzles[1].answers[0]);
   await page.locator('button[data-go="leader"]').first().click();await page.locator('table').waitFor();assert.match(await page.locator('table').innerText(),/97/);
   assert.equal(await page.locator('td').evaluateAll(es=>es.some(e=>e.getBoundingClientRect().right>innerWidth)),false,'All leaderboard columns fit');
   await page.screenshot({path:out+'/'+engine+'-'+width+'-leader.png',fullPage:true});
   await context.close();
   const hc=await browser.newContext({viewport:{width,height:844},storageState:await admin.storageState()});const hp=await hc.newPage();hp.on('pageerror',e=>errors.push(e.message));
   await hp.goto(base+'/birthday-hunt/?host');await hp.locator('#create').waitFor();assert.equal(await hp.locator('.team-row').count(),3);
   assert.equal(await hp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'host mobile width');
   await hp.locator('[data-action="editor"]').click();await hp.locator('#edit').waitFor();assert.equal(await hp.locator('#edit button').isDisabled(),true);
   await hp.locator('[data-go="hostleader"]').click();await hp.locator('table').waitFor();assert.match(await hp.locator('table').innerText(),/97/);
   await hc.close();assert.deepEqual(errors,[]);
  }
  // Exercise actual login forms, including the original missing-password-name defect.
  if(engine==='chromium'){
   const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
   await page.goto(base+'/birthday-hunt/?host');await page.locator('#pass').fill(password);await page.locator('#hostlogin button').click();await page.locator('#create').waitFor();
   await page.locator('#name').fill('QA UI team');await page.locator('#create button').click();await page.locator('#new-code').waitFor();
   assert.match(await page.locator('#new-code').innerText(),/QA UI team: [A-F0-9-]+/);
   await page.locator('.team-row').filter({hasText:'QA UI team'}).locator('[data-action="remove"]').click();await page.waitForFunction(()=>document.querySelectorAll('.team-row').length===3);
   await page.locator('[data-action="pause"]').click();await page.waitForFunction(()=>document.querySelector('.pagehead .pill')?.textContent==='paused');
   await page.locator('[data-action="editor"]').click();await page.locator('#edit-title').fill(original.title+' UI');await page.locator('#edit button').click();await page.getByText('Challenge saved.',{exact:true}).waitFor();
   assert.equal(await page.locator('#edit-title').inputValue(),original.title+' UI');
   await page.locator('#edit-title').fill(original.title);await page.locator('#edit button').click();await page.getByText('Challenge saved.',{exact:true}).waitFor();
   await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>document.querySelector('.pagehead .pill')?.textContent==='live');
   await page.locator('[data-action="hostlogout"]').click();await page.locator('#pass').waitFor();
   await page.locator('[data-go="home"]').click();await page.locator('#team').fill(created[2].code);await page.locator('#login button').click();await page.locator('#solution').waitFor();
   await context.close();
  }
 }finally{await browser.close();}}
 pass('Chromium/WebKit 320/390px, mobile controls, decoder, refresh persistence, host/player login and leaderboard');
 await call(admin,'admin_reset',{confirm:'RESET',expectedTeamIds:[states[0].team.id]},409);
 host=await call(admin,'admin_reset',{confirm:'RESET',expectedTeamIds:states.map(s=>s.team.id)});assert.equal(host.status,'lobby');assert(host.teams.every(t=>t.stage===1&&t.score===0&&!t.startedAt&&t.elapsedMs===0));
 for(const c of players){const s=await call(c,'team_state');assert.equal(s.status,'lobby');assert(!s.puzzle);}
 for(const t of host.teams)await call(admin,'admin_remove_team',{teamId:t.id});
 assert.equal((await call(admin,'admin_state')).teams.length,0);
 await call(players[0],'team_state',{},401);
 await call(admin,'admin_logout');await call(admin,'admin_state',{},401);
 pass('Reset scoped to hunt, test-team cleanup, archived-session revocation and host logout');
 fs.writeFileSync(out+'/results.json',JSON.stringify({base,passed:checks,completedAt:new Date().toISOString()},null,2));
})().catch(e=>{console.error(e.message,e.stack?.split('\n').slice(1,3).join('\n'));process.exitCode=1;}).finally(async()=>{for(const c of clients)await c.dispose();});
