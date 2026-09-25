const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const key='sk-or-test-fixture-not-a-real-key';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('arcade_credited','1'));
  await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
  let reject=false, posts=0;
  await page.route('**/api/jev',async route=>{
   const req=route.request(), supplied=req.headers()['x-openrouter-key'];
   if(req.method()==='GET') {
    if(reject) return route.fulfill({status:401,json:{error:'OpenRouter rejected this key.'}});
    return route.fulfill({json:{ready:supplied===key}});
   }
   assert.equal(supplied,key);posts++;
   await new Promise(r=>setTimeout(r,500));
   await route.fulfill({json:{direction:'right',latencyMs:500,model:'TEST-FIXTURE',usage:{cost:.00002},generationId:'fixture-'+posts,provider:'OpenRouter'}});
  });
  await page.goto('http://127.0.0.1:3217/arcade-jev');
  await page.getByText('NOT CONNECTED',{exact:true}).waitFor();
  assert.equal(await page.locator('#j-api-key').getAttribute('type'),'password');
  // Docked in the arcade screen, the key form starts folded; a visitor opens it.
  if(await page.locator('#j-settings').getAttribute('open')===null) await page.locator('#j-settings summary').click();
  await page.locator('#j-api-key').fill(key);await page.locator('#j-save-key').click();
  await page.getByText('READY',{exact:true}).waitFor();
  assert.equal(await page.locator('#j-settings').getAttribute('open'),null);
  assert.equal(await page.locator('#j-api-key').inputValue(),'');
  assert.equal(await page.evaluate(()=>localStorage.getItem('arcade-jev-openrouter-key')),key);
  assert.ok(!(await page.locator('body').innerText()).includes(key));
  await page.reload();await page.getByText('READY',{exact:true}).waitFor();
  await page.locator('#j-start').click();
  await page.waitForTimeout(100);await page.locator('#j-pause').click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#j-count').textContent(),'0','Late answer cannot apply a key');
  assert.equal(await page.locator('#j-spend').textContent(),'$0.000020','Discarded reply still records actual billed cost');
  const downloads=[];page.on('download',d=>downloads.push(d));
  await page.locator('#j-export').click();await page.waitForTimeout(400);
  assert.equal(downloads.length,2);
  for(const download of downloads){const text=fs.readFileSync(await download.path(),'utf8');assert.ok(!text.includes(key));}
  await page.locator('#j-settings summary').click();
  await page.locator('#j-forget-key').click();
  await page.getByText('NOT CONNECTED',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('arcade-jev-openrouter-key')),null);
  reject=true;await page.locator('#j-api-key').fill(key);await page.locator('#j-save-key').click();
  await page.getByText('OpenRouter rejected this key.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('arcade-jev-openrouter-key')),null);
  await page.locator('#j-api-key').fill('');
  await page.screenshot({path:require('node:path').resolve(__dirname,'../../tmp/openrouter-key-window.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: masked field, save+verify, browser persistence, cleared input, reload, forget, rejected key, late-response actual cost, two log exports without secrets.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
