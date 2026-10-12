import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

// Isolated UI fixtures only. Never use these sessions as real-authentication evidence.
// All business API/socket traffic is intercepted; no production records are changed.
const origin = 'http://127.0.0.1:5175';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort'], {
  env: {...process.env, VITE_AUTH_PROVIDER:'temporary'}, stdio:['ignore','pipe','pipe'],
});
let serverLog = '';
server.stdout.on('data', data => {serverLog += data;});
server.stderr.on('data', data => {serverLog += data;});
const artifacts = new URL('../audit-artifacts/', import.meta.url);
await mkdir(artifacts, {recursive:true});
let browser;
const results = [];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));
async function waitForServer() {
  for(let attempt=0; attempt<60; attempt++) {
    if(server.exitCode !== null) throw new Error(`Audit server stopped: ${serverLog.slice(-600)}`);
    if(serverLog.includes('Local:')) return;
    await delay(100);
  }
  throw new Error('Audit server did not start');
}
async function fixture(page, {signedIn=false, admin=false, complete=true, profileError=false, enrolled=false,
  enrollError=false, enrollFalse=false, checkedIn=false, checkInError=false, window='open', published=false, resultsPublished=false, assigned=false,
  possibleTypo=false, autoEnrollOnProfileComplete=false, signupAlreadyExists=false}={}) {
  const now=Date.now();
  const user={id:'u1', firstName:'Audit',lastName:'Participant',email:'audit@example.invalid',college:complete?'Test College':'',mobile:complete?'9999999999':''};
  const round={id:'r1',eventId:'e1',name:'Audit Round',roundNumber:1,status:'ONGOING',pairingsPublished:published,resultsPublished,
    checkInStartTime:new Date(now+(window==='future'?5000:-60000)).toISOString(),
    checkInEndTime:new Date(now+(window==='closed'?-1000:60000)).toISOString()};
  const event={id:'e1',name:'Audit Tournament',description:'Isolated fixture',status:'ONGOING',startDate:new Date(now).toISOString(),endDate:new Date(now+86400000).toISOString(),rounds:[round],_count:{participants:0,rounds:1}};
  const debate={id:'d1',roundId:'r1',eventId:'e1',debater1Id:'u1',debater2Id:'u2',debater1:user,debater2:{id:'u2',firstName:'Audit',lastName:'Opponent'},room:{id:'room1',name:'Audit Hall'},judgeName:'Audit Judge',status:'COMPLETED',winnerId:'u1',debater1Score:80,debater2Score:75,isPromoted:true,resultsPublished};
  const state={user,round,event,debate,enrolled,checkedIn,signedIn,possibleTypo,autoEnrollOnProfileComplete,signupAlreadyExists,requests:[],events:[event]};
  await page.route('**/*', async route => {
    const req=route.request();const url=new URL(req.url());
    if(url.pathname.startsWith('/socket.io')) return route.fulfill({status:503,body:'Fixture socket unavailable'});
    if(url.pathname.startsWith('/api/')) {
      const path=url.pathname.slice(4);const method=req.method();
      state.requests.push({path,method,body:req.postData()});
      const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(path==='/auth/get-session') return reply(state.signedIn?{session:{id:'fixture-session',expiresAt:new Date(now+86400000).toISOString(),token:'fixture-cookie',userId:'audit-user'},user:{id:'audit-user',email:'audit@example.invalid',emailVerified:true,name:'Audit Participant',image:null,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()}}:null);
      if(path==='/auth/sign-up/email' && method==='POST' && state.signupAlreadyExists) return reply({message:'User already exists or failed to create user.'},422);
      if(path==='/users/check-email' && method==='POST') return reply({success:true,possibleTypo:state.possibleTypo});
      if(path==='/auth/sign-out' && method==='POST') {state.signedIn=false;return reply({success:true});}
      if(path==='/auth/update-user' && method==='POST') return reply({user:{id:'audit-user',email:'audit@example.invalid',emailVerified:true,name:req.postDataJSON().name,image:null}});
      if(path==='/admin/me') return reply(admin?{success:true,admin:{id:'a1'}}:{error:'Forbidden'},admin?200:403);
      if(path==='/admin/validate-key') return reply({success:true,valid:false});
      if(path==='/users/me') return profileError?reply({error:'Fixture profile unavailable'},503):reply({success:true,user:state.user});
      if(path==='/users/profile' && method==='PUT') {
        Object.assign(state.user,req.postDataJSON());
        const autoEnrollment=state.autoEnrollOnProfileComplete?{id:'e1',name:state.event.name}:null;
        if(autoEnrollment) state.enrolled=true;
        return reply({success:true,user:state.user,autoEnrollment});
      }
      if(path==='/events' && method==='POST') {const data=req.postDataJSON();state.events.push({...data,id:'e2',status:'UPCOMING',rounds:[]});return reply({success:true,event:state.events.at(-1)});}
      if(path==='/events' && method==='GET') return reply({success:true,events:state.events});
      if(path==='/events/e1/enrollment-status') return reply({success:true,isEnrolled:state.enrolled});
      if(path==='/events/e1/enroll') {
        if(enrollError) return reply({error:'Enrollment denied'},403);
        if(enrollFalse) return reply({success:false,error:'Enrollment denied'});
        state.enrolled=true;return reply({success:true});
      }
      if(path==='/events/e1/participants') return reply({success:true,participants:state.enrolled?[state.user]:[]});
      if(path==='/events/e1' && method==='PUT') {Object.assign(state.event,req.postDataJSON());return reply({success:true,event:state.event});}
      if(path==='/events/e1' && method==='DELETE') {state.events=[];return reply({success:true});}
      if(path==='/events/e1') return reply({success:true,event:state.event});
      if(path==='/rounds/r1') return reply({success:true,round:state.round});
      if(path==='/check-in/round/r1/me') return reply({success:true,isCheckedIn:state.checkedIn});
      if(path==='/check-in') {
        if(checkInError) return reply({error:'Check-in denied'},403);
        state.checkedIn=true;return reply({success:true});
      }
      if(path==='/debates/my-debates' || path==='/debates/round/r1') return reply({success:true,debates:assigned?[state.debate]:[]});
      if(path==='/stats/leaderboard') return reply({success:true,leaderboard:[]});
      if(path==='/stats/my-stats') return reply({success:true,stats:{totalDebates:0,wins:0,losses:0}});
      return reply({error:`Unimplemented fixture: ${method} ${path}`},404);
    }
    if(url.origin!==origin) return route.abort();
    return route.continue();
  });
  return state;
}
async function run(name, setup, scenario, kind='UI fixture') {
  const context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Kolkata'});
  const page=await context.newPage();
  page.setDefaultTimeout(4000);
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  try {
    const state=await fixture(page,setup);
    await scenario(page,state);
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    results.push({name,kind,status:'PASS'});
    console.log(`PASS ${name}`);
  } catch(error) {
    results.push({name,kind,status:'FAIL',evidence:error.message.slice(0,900)});
    await page.screenshot({path:new URL(`${results.length}-failure.png`,artifacts).pathname,fullPage:true}).catch(()=>{});
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  } finally {await context.close();}
}
const visible = async (page,text) => {
  await page.getByText(text,{exact:true}).first().waitFor({state:'visible'});
};
try {
  await waitForServer();
  browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_EXECUTABLE?{executablePath:process.env.AUDIT_BROWSER_EXECUTABLE}:{})});
  await run('public entry redirects and renders role selection',{},async page=>{
    await page.goto(origin+'/');await page.waitForURL('**/login-select');
    await page.getByRole('button',{name:/Sign in as Debater/}).waitFor();
  },'Public UI');
  for(const path of ['/dashboard','/dashboard/events','/dashboard/events/e1','/dashboard/events/e1/rounds/r1','/complete-profile','/admin','/admin/events']) {
    await run(`signed-out access to ${path} is blocked`,{},async page=>{
      await page.goto(origin+path);await page.waitForURL('**/login-select');
    },'Anonymous route guard fixture');
  }
  await run('returning debater entry opens sign-in',{},async page=>{
    await page.goto(origin+'/login-select');await page.getByRole('button',{name:/Sign in as Debater/}).click();await page.waitForURL('**/sign-in?role=user');
  });
  await run('invalid organizer key displays rejection',{},async page=>{
    await page.goto(origin+'/login-select');await page.getByRole('button',{name:/Sign in as Admin/}).click();
    await page.getByLabel('Admin secret key',{exact:true}).fill('invalid-fixture-key');
    await page.getByRole('button',{name:/Continue to sign in/}).click();await visible(page,'Invalid admin secret key. Access denied.');
  });
  await run('new debater registration opens sign-up',{},async page=>{
    await page.goto(origin+'/get-started');await page.getByRole('button',{name:/I’m a debater/}).click();await page.waitForURL('**/sign-up*');
  });
  await run('sign-in presents the Better Auth email and password form',{},async page=>{
    await page.goto(origin+'/sign-in');await page.getByLabel('Email',{exact:true}).waitFor();
    assert.equal(await page.getByText('Temporary sign-in',{exact:true}).count(),0,'Temporary sign-in is visible');
    await page.getByRole('navigation',{name:'Account access'}).getByRole('link',{name:/Create account/}).waitFor({state:'visible'});
    await page.locator('.axiom-auth-create-callout').getByRole('link',{name:/Create account/}).waitFor({state:'visible'});
  });
  await run('sign-up presents account registration rather than a shared sign-in form',{},async page=>{
    await page.goto(origin+'/sign-up');await page.getByLabel('Email',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Passcode',{exact:true}).count(),0,'Sign-up renders the shared passcode sign-in');
    assert.equal(await page.getByLabel('Full name',{exact:true}).count(),1);
    assert.equal(await page.locator('#auth-password').getAttribute('minlength'),'10');
    await page.getByRole('navigation',{name:'Account access'}).getByText('Create account',{exact:true}).waitFor({state:'visible'});
    await page.getByRole('heading',{name:'Create your account',level:2}).waitFor({state:'visible'});
  });
  await run('password recovery pages retain a usable auth card',{},async page=>{
    await page.goto(origin+'/forgot-password');await page.getByRole('heading',{name:'Reset your password'}).waitFor({state:'visible'});
    await page.getByLabel('Email',{exact:true}).waitFor({state:'visible'});
    await page.goto(origin+'/reset-password?token=fixture-token');
    await page.getByRole('heading',{name:'Choose a new password'}).waitFor({state:'visible'});
    await page.getByLabel('Confirm password',{exact:true}).waitFor({state:'visible'});
  });
  await run('registration warns about a near-match before creating an account',{possibleTypo:true},async (page,state)=>{
    await page.goto(origin+'/sign-up');
    await page.getByLabel('Full name',{exact:true}).fill('Audit Participant');
    await page.getByLabel('Email',{exact:true}).fill('audit@example.invalid');
    await page.locator('#auth-password').fill('strong-test-password');
    await page.getByRole('button',{name:'Create account'}).click();
    await page.getByRole('alert').filter({hasText:'A registered email has a very similar spelling.'}).waitFor({state:'visible'});
    assert.ok(state.requests.some(request=>request.path==='/users/check-email'),'email typo check was not requested');
    assert.equal(state.requests.some(request=>request.path==='/auth/sign-up/email'),false,'account creation happened before user confirmed the email spelling');
  });
  await run('existing Better Auth account is directed to normal sign-in',{signupAlreadyExists:true},async (page,state)=>{
    await page.goto(origin+'/sign-up');
    await page.getByLabel('Full name',{exact:true}).fill('Audit Participant');
    await page.getByLabel('Email',{exact:true}).fill('audit@example.invalid');
    await page.locator('#auth-password').fill('strong-test-password');
    await page.getByRole('button',{name:'Create account'}).click();
    await page.waitForURL('**/sign-in?email=audit%40example.invalid&notice=account-exists');
    assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'audit@example.invalid');
    await page.getByRole('status').filter({hasText:'An account may already use this email.'}).waitFor({state:'visible'});
    assert.ok(state.requests.some(request=>request.path==='/auth/sign-up/email'),'duplicate account case did not reach Better Auth sign-up handling');
  });
  await run('sign-out clears the cookie-backed session and returns to public entry',{signedIn:true},async (page,state)=>{
    await page.goto(origin+'/dashboard');await page.getByRole('button',{name:'Sign out'}).click();
    await page.waitForURL('**/login-select');assert.equal(state.signedIn,false);
  });
  await run('unknown route displays a usable recovery page',{},async page=>{
    await page.goto(origin+'/unknown-audit-route');await delay(300);
    assert.ok(await page.getByRole('link').count() || await page.getByRole('button').count(),'Unknown route has no recovery links or buttons');
  });
  await run('mobile public entry has no horizontal page overflow',{},async page=>{
    await page.setViewportSize({width:390,height:844});await page.goto(origin+'/login-select');
    await page.getByRole('button',{name:/Sign in as Debater/}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  });
  await run('mobile registration keeps form controls and account switch visible without horizontal overflow',{},async page=>{
    await page.setViewportSize({width:390,height:844});await page.goto(origin+'/sign-up');
    await page.getByRole('heading',{name:'Create your account',level:2}).waitFor();
    await page.getByRole('navigation',{name:'Account access'}).getByRole('link',{name:'Sign in'}).waitFor({state:'visible'});
    await page.getByLabel('Email',{exact:true}).waitFor({state:'visible'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  });
  await run('incomplete profile redirects to onboarding',{signedIn:true,complete:false},async page=>{
    await page.goto(origin+'/dashboard/events');await page.waitForURL('**/complete-profile');await visible(page,'Complete Your Profile');
  });
  await run('profile API outage blocks onboarding-dependent event access',{signedIn:true,profileError:true},async page=>{
    await page.goto(origin+'/dashboard/events');await visible(page,'We could not verify your profile');
    assert.equal(await page.getByText('Audit Tournament',{exact:true}).count(),0,'Event access is granted after mandatory profile verification fails');
  });
  await run('profile completion auto-enrolls into the configured event without checking in',{signedIn:true,complete:false,checkInError:true,autoEnrollOnProfileComplete:true},async (page,state)=>{
    await page.goto(origin+'/complete-profile');await visible(page,'Complete Your Profile');
    await page.getByPlaceholder('e.g. National Law School of India University').fill('Test College');
    await page.getByPlaceholder('+91 98765 43210').fill('9999999999');
    await page.getByRole('button',{name:/Complete Profile & Register/}).click();
    await page.waitForURL('**/dashboard/events/e1');
    await visible(page,'Enrolled');
    assert.equal(state.enrolled,true);
    assert.equal(state.requests.some(request=>request.path==='/check-in'),false,'Profile completion must not bypass event enrollment and attendance controls');
  });
  await run('explicit event enrollment persists across reload',{signedIn:true},async (page,state)=>{
    await page.goto(origin+'/dashboard/events/e1');await page.getByRole('button',{name:'Enroll Now'}).click();
    await visible(page,'Enrolled Successfully!');assert.ok(state.enrolled);
    await page.reload();await visible(page,'Enrolled');
    assert.equal(await page.getByRole('button',{name:'Enroll Now'}).count(),0);
  });
  await run('HTTP-denied enrollment displays error and keeps enroll action',{signedIn:true,enrollError:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1');await page.getByRole('button',{name:'Enroll Now'}).click();await visible(page,'Enrollment Failed');
    assert.equal(await page.getByText('Enrolled Successfully!',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Enroll Now'}).waitFor();
  });
  await run('business-rejected enrollment must not show success',{signedIn:true,enrollFalse:true},async (page,state)=>{
    await page.goto(origin+'/dashboard/events/e1');await page.getByRole('button',{name:'Enroll Now'}).click();
    await page.waitForFunction(() => /Enrollment Failed|Enrolled Successfully!/.test(document.body.innerText));
    assert.equal(await page.getByText('Enrolled Successfully!',{exact:true}).count(),0,'success:false was rendered as a successful enrollment');
    assert.equal(state.enrolled,false);
  });
  await run('open round check-in persists across reload',{signedIn:true,enrolled:true},async (page,state)=>{
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await page.getByRole('button',{name:'Check In Now'}).click();
    await visible(page,"You're Checked In");assert.ok(state.checkedIn);
    await page.reload();await visible(page,"You're Checked In");
  });
  await run('closed round window prevents check-in',{signedIn:true,window:'closed'},async page=>{
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await visible(page,'Check-in Not Available');
    assert.equal(await page.getByRole('button',{name:'Check In Now'}).count(),0);
  });
  await run('denied round check-in does not display presence',{signedIn:true,checkInError:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await page.getByRole('button',{name:'Check In Now'}).click();await visible(page,'Check-in Failed');
    assert.equal(await page.getByText("You're Checked In",{exact:true}).count(),0);
  });
  await run('published pairing displays opponent, position and room',{signedIn:true,published:true,assigned:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await visible(page,'Audit Opponent');await visible(page,'Government');await visible(page,'Audit Hall');
  });
  await run('manually assigned judge is shown to the participant',{signedIn:true,published:true,assigned:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await visible(page,'Audit Hall');await visible(page,'Audit Judge');
  });
  await run('unpublished pairings hide opponent and room',{signedIn:true,published:false,assigned:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await visible(page,'Audit Round');
    assert.equal(await page.getByText('Audit Hall',{exact:true}).count(),0);assert.equal(await page.getByText('Audit Opponent',{exact:true}).count(),0);
  });
  await run('unpublished results show awaiting selection',{signedIn:true,assigned:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1/results');await visible(page,'AWAITING SELECTION');
    assert.equal(await page.getByText('QUALIFIED',{exact:true}).count(),0);
  });
  await run('published promotion is visible in event results',{signedIn:true,assigned:true,resultsPublished:true},async page=>{
    await page.goto(origin+'/dashboard/events/e1/results');await visible(page,'QUALIFIED');
  });
  await run('check-in window opening updates the button without a reload',{signedIn:true,window:'future'},async page=>{
    await page.clock.install({time:new Date()});
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await visible(page,'Check-in Not Available');
    await page.clock.fastForward(10000);await page.getByRole('button',{name:'Check In Now'}).waitFor();
  });
  await run('check-in window closing removes the action without a reload',{signedIn:true},async page=>{
    await page.clock.install({time:new Date()});
    await page.goto(origin+'/dashboard/events/e1/rounds/r1');await page.getByRole('button',{name:'Check In Now'}).waitFor();
    await page.clock.fastForward(90000);await visible(page,'Check-in Not Available');
  });
  await run('participant cannot open admin workspace',{signedIn:true},async page=>{
    await page.goto(origin+'/admin/events');await visible(page,'You do not have admin access');
    assert.equal(await page.getByRole('button',{name:'Create Event'}).count(),0);
  });
  await run('admin event creation sends dates and updates list',{signedIn:true,admin:true},async (page,state)=>{
    await page.goto(origin+'/admin/events');await page.getByRole('button',{name:'Create Event',exact:true}).click();
    await page.getByLabel('Tournament Name').fill('New Audit Tournament');
    await page.getByLabel('Start Date (local time)').fill('2026-10-12T10:00');
    await page.getByLabel('End Date (local time)').fill('2026-10-12T18:00');
    await page.getByRole('button',{name:'Create Event',exact:true}).last().click();
    await visible(page,'New Audit Tournament');
    assert.equal(state.events.at(-1).startDate,'2026-10-12T04:30:00.000Z');
  });
  await run('admin event edit persists across reload',{signedIn:true,admin:true},async (page,state)=>{
    await page.goto(origin+'/admin/events');await page.getByRole('button',{name:'Edit tournament Audit Tournament',exact:true}).click();
    await page.getByLabel('Tournament Name').fill('Updated Audit Tournament');
    await page.getByRole('button',{name:'Save Changes',exact:true}).click();await visible(page,'Updated Audit Tournament');
    assert.equal(state.event.name,'Updated Audit Tournament');await page.reload();await visible(page,'Updated Audit Tournament');
  });
  await run('admin event delete persists across reload',{signedIn:true,admin:true},async (page,state)=>{
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(origin+'/admin/events');await page.getByRole('button',{name:'Delete tournament Audit Tournament',exact:true}).click();
    await visible(page,'Event deleted successfully');assert.equal(state.events.length,0);
    await page.reload();await page.getByRole('button',{name:'Create Event',exact:true}).waitFor();
    assert.equal(await page.getByText('Audit Tournament',{exact:true}).count(),0);
  });
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(new URL('browser-results.json',artifacts),JSON.stringify({scope:'Isolated Better Auth UI/API fixtures; not live auth/backend verification',results},null,2)+'\n');
}
const failed=results.filter(result=>result.status==='FAIL').length;
console.log(`\n${results.length-failed} passed; ${failed} failed. Details: audit-artifacts/browser-results.json`);
process.exitCode=failed?1:0;
