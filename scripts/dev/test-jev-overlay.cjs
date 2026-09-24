const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.JEV_TEST_URL || 'http://127.0.0.1:3217';
const artifacts=path.resolve(__dirname,'../../tmp/jev-overlay');require('node:fs').mkdirSync(artifacts,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{sessionStorage.setItem('arcade_credited','1'); localStorage.setItem('arcade_owner_secret','fixture-owner'); Math.random=()=>0.529;});
  const submissions=[];
  await page.route('**/*.supabase.co/**',route=>{
    if(route.request().method()==='POST'){const url=route.request().url();submissions.push({url,body:route.request().postDataJSON()});return route.fulfill({json:url.includes('/rpc/submit_jev_score')?{ok:true,improved:true,first:true}:[{id:99}]});}
    return route.fulfill({json:[],headers:{'content-range':'0-0/0'}});
  });
  await page.goto(base+'/arcade'); await page.locator('.game-canvas').waitFor();
  const plain=await page.locator('.bezel').boundingBox();
  assert.equal(await page.locator('.jev-panel').count(),0);
  let boards=[],delay=600;
  await page.route('**/api/jev',async route=>{
    if(route.request().method()==='GET') return route.fulfill({json:{ready:true}});
    boards.push(route.request().postDataJSON());
    await new Promise(r=>setTimeout(r,delay));
    await route.fulfill({json:{direction:'right',latencyMs:delay,confidence:.9,model:'TEST-FIXTURE'}}).catch(()=>{});
  });
  await page.goto(base+'/arcade-jev'); await page.getByText('READY',{exact:true}).waitFor();
  const overlay=await page.locator('.bezel').boundingBox();
  for(const k of ['x','y','width','height']) assert.ok(Math.abs(plain[k]-overlay[k])<1, 'Underlying cabinet geometry must match: '+k);
  assert.equal(await page.locator('.game-canvas').count(),1,'Uses the existing game canvas');
  await page.locator('#j-pace').selectOption('arcade');
  await page.locator('#j-start').click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#j-count').textContent(),'0','Holding right must not emit repeated right keys');
  await page.locator('#j-pause').click();
  const count=await page.locator('#j-count').textContent();
  await page.waitForTimeout(750);
  assert.equal(await page.locator('#j-count').textContent(),count,'Late answer after pause ignored');
  assert.equal(await page.locator('.screen-ui').getAttribute('data-state'),'paused');
  delay=50;
  await page.locator('#j-pause').click();
  await page.waitForFunction(()=>document.querySelector('.screen-ui').dataset.state==='over');
  assert.ok(boards.some(b=>b.snake[0].x>=12),'Original game keeps moving while Jev awaits a response');
  assert.ok(await page.locator('.ov-result').textContent() !== 'YOU: 0');
  await page.locator('.ov-save').click();
  assert.equal(await page.locator('#ac-name').inputValue(),'JEV');
  assert.equal(await page.locator('#ac-name').getAttribute('readonly'),'');
  await page.locator('.ov-btn').click();
  await page.getByText('ON THE BOARD',{exact:true}).waitFor();
  // Jev keeps one verified best row: the owner-gated RPC, never a plain insert.
  assert.equal(submissions.length,1);
  assert.ok(submissions[0].url.endsWith('/rest/v1/rpc/submit_jev_score'));
  assert.equal(submissions[0].body.p_game,'snake'); assert.equal(submissions[0].body.p_mode,'classic');
  assert.equal(submissions[0].body.p_secret,'fixture-owner');
  const header=await page.locator('.jev-panel header').boundingBox();
  await page.mouse.move(header.x+20,header.y+15);await page.mouse.down();await page.mouse.move(280,130);await page.mouse.up();
  assert.ok((await page.locator('.jev-panel').boundingBox()).x<400,'Window is movable');
  await page.locator('#j-collapse').click(); assert.equal(await page.locator('.j-body').isVisible(),false);
  await page.locator('#j-collapse').click();
  await page.evaluate(()=>document.getElementById('j-notice').textContent='TEST INPUTS · not real Jev results');
  await page.screenshot({path:path.join(artifacts,'actual-arcade-overlay-test.png')});
  await page.goto(base+'/arcade-jev'); await page.getByText('READY',{exact:true}).waitFor();
  await page.screenshot({path:path.join(artifacts,'actual-arcade-overlay.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: identical cabinet geometry, single existing canvas, normal-speed play during API latency, real keyboard input, pause cancellation, JEV best-only verified score flow (mocked), draggable/collapsible window.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
