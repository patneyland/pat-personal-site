const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  async function setup(delay,answer){
   const page=await browser.newPage({viewport:{width:1600,height:900}});
   await page.addInitScript(()=>{sessionStorage.setItem('arcade_credited','1');Math.random=()=>0.1;});
   await page.route('**/*.supabase.co/**',r=>r.fulfill({json:[]}));
   await page.route('**/arcade/snake.js',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('return {\n      start:','return window.__testSnake = {\n      start:')});});
   const boards=[];
   await page.route('**/api/jev',async r=>{
    if(r.request().method()==='GET')return r.fulfill({json:{ready:true}});
    boards.push(r.request().postDataJSON());
    await new Promise(resolve=>setTimeout(resolve,delay));
    await r.fulfill({json:{direction:'up',steps:5,latencyMs:delay,model:'TEST-FIXTURE',...answer}}).catch(()=>{});
   });
   await page.goto('http://127.0.0.1:3217/arcade-jev');await page.getByText('READY',{exact:true}).waitFor();
   await page.locator('#j-start').click();return {page,boards};
  }
  const {page,boards}=await setup(200);
  assert.equal(await page.locator('#j-pace').inputValue(),'plan');
  await page.waitForFunction(()=>window.__testSnake.snapshot().tick>=8);
  const state=await page.evaluate(()=>window.__testSnake.snapshot());
  assert.equal(state.state,'playing');assert.equal(state.direction,'up');
  assert.equal(await page.locator('#j-count').textContent(),'1','One turn, not one key per cell');
  assert.equal(boards[0].tick,4);assert.equal(boards[0].snake[0].x,12);
  assert.equal(boards[1].tick,9,'Next plan is requested for future segment endpoint');
  assert.equal(state.tickMs,130);assert.ok(state.tick>=8);
  await page.locator('#j-pause').click();const paused=await page.evaluate(()=>window.__testSnake.snapshot());
  await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>window.__testSnake.snapshot()),paused);
  assert.equal(await page.locator('#j-count').textContent(),'1');
  await page.close();
  const stalled=await setup(2500);
  await stalled.page.waitForFunction(()=>window.__testSnake.snapshot().state==='over');
  assert.equal(await stalled.page.locator('#j-count').textContent(),'0');
  assert.equal(await stalled.page.evaluate(()=>window.__testSnake.snapshot().tick),16,'Slow inference must not freeze game or prevent death');
  await stalled.page.waitForTimeout(600);assert.equal(await stalled.page.locator('#j-count').textContent(),'0');
  await stalled.page.close();
  const late=await setup(700);
  await late.page.waitForTimeout(850);
  assert.equal(await late.page.locator('#j-count').textContent(),'0','Late plan is never applied to a newer board');
  assert.ok(await late.page.evaluate(()=>window.__testSnake.snapshot().tick)>=6);
  await late.page.close();
  console.log('PASS: real-time original ticks, one input per turn, preplanned future board, pause invalidation, delayed inference still loses, late turns discarded. No live inference or score writes.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
