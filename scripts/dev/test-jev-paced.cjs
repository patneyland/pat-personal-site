const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 await page.addInitScript(()=>sessionStorage.setItem('arcade_credited','1'));
 await page.route('**/*.supabase.co/**',r=>r.fulfill({json:[]}));
 const boards=[];let delay=600;
 await page.route('**/api/jev',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{ready:true}});
  boards.push(r.request().postDataJSON());await new Promise(resolve=>setTimeout(resolve,delay));
  await r.fulfill({json:{direction:'right',latencyMs:delay,model:'TEST-FIXTURE'}});
 });
 await page.goto('http://127.0.0.1:3217/arcade-jev');await page.getByText('READY',{exact:true}).waitFor();
 assert.equal(await page.locator('#j-pace').inputValue(),'jev');
 await page.locator('#j-start').click();await page.waitForFunction(()=>Number(document.getElementById('j-count').textContent)>=2);
 await page.locator('#j-pause').click();
 assert.equal(boards[0].snake[0].x,8);assert.equal(boards[1].snake[0].x,9);
 assert.equal(await page.locator('#j-pace').isDisabled(),true);
 const commands=await page.locator('#j-count').textContent();await page.waitForTimeout(700);
 assert.equal(await page.locator('#j-count').textContent(),commands);
 delay=20;await page.locator('#j-pause').click();
 await page.waitForFunction(()=>document.querySelector('.screen-ui').dataset.state==='over');
 assert.equal(await page.locator('#j-count').textContent(),'16');
 assert.equal(await page.locator('.ov-save').isVisible(),false,'Paced game must not submit a classic score');
 assert.match(await page.locator('.ov-comparison').textContent(),/JEV PACE/);
 await page.locator('#j-pace').selectOption('arcade');assert.match(await page.locator('#j-timing-label').textContent(),/ORIGINAL/);
 console.log('PASS: one cell per delayed decision, paused input discarded, pacing locked within a run, paced scores excluded from classic leaderboard, normal mode selectable.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
