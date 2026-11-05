// Start Vite on BASE_URL first. Install playwright-core separately or set
// PLAYWRIGHT_CORE_MODULE to its absolute entry point; this is an optional browser gate.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MODULE || 'playwright-core');
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
const base=process.env.BASE_URL || 'http://127.0.0.1:5173';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmioAAAAASUVORK5CYII=','base64');
const ok=route=>route.fulfill({status:200,contentType:'image/png',body:png});
const primary='AByzDGhoZeTLnWwe.webp', original='zstgfhkhgJOsMcBx.jpg';
try {
  const nojs=await browser.newContext({javaScriptEnabled:false});
  const p=await nojs.newPage();
  for (const path of ['/','/privacy','/private-events/quote','/puppy-yoga-guelph']) {
    await p.goto(base+path,{waitUntil:'domcontentloaded'});
    assert.equal(await p.locator('#home-first-paint').isVisible(),false,`noscript ${path}`);
    assert.equal(await p.locator('#home-shell-photo').getAttribute('src'),null);
  }
  await nojs.close(); console.log('PASS no-JS shell hidden on home and non-home routes');
  for (const mode of ['normal','fallback','exhausted']) {
    const ctx=await browser.newContext(); const page=await ctx.newPage(); const requests=[];
    await page.route('**/*',async route=>{
      const u=route.request().url();
      if (u.includes('/src/homeBootstrap.tsx')) { await new Promise(r=>setTimeout(r,1800)); return route.continue(); }
      if (u.includes(primary)||u.includes(original)||u.includes('apy_portrait_chow_cuddle_nov01')||u.includes('tkTWwpxwClsSwSww')||u.includes('apy_portrait_golden_cuddle_oct19')) {
        requests.push(u);
        if(mode==='exhausted'||(mode==='fallback'&&u.includes(primary))) return route.abort('failed');
        return ok(route);
      }
      if(u.includes('apy_opt_liftoff_92a927b1.webp')) return route.abort('failed');
      if(u.includes('LiftOff_Logo_Building_Legacy_banner_5f5d7710.png')) return ok(route);
      if(u.includes('files.manuscdn.com')||u.includes('d2xsxph8kpxj0f.cloudfront.net')) return ok(route);
      if(u.includes('fonts.googleapis.com')||u.includes('fonts.gstatic.com')) return route.abort();
      return route.continue();
    });
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#home-first-paint').waitFor({state:'visible'});
    assert.equal(await page.locator('.home-shell-cta').getAttribute('href'),'https://lu.ma/afropuppyyoga');
    if(mode==='fallback') await page.waitForFunction(original=>document.querySelector('#home-shell-photo')?.getAttribute('src')?.includes(original),original);
    if(mode==='exhausted') await page.waitForFunction(()=>document.querySelector('#home-shell-photo')?.dataset.heroFailed==='true');
    await page.locator('#home').waitFor({state:'visible',timeout:20000});
    if(mode==='exhausted') {
      await page.getByRole('button',{name:'Retry photo'}).waitFor();
      assert.equal(requests.length,5,'handoff must not restart exhausted automatic chain');
      await page.getByRole('button',{name:'Retry photo'}).click();
      await page.getByRole('button',{name:'Retry photo'}).waitFor();
      assert.equal(requests.length,10,'manual retry bounded');
    } else {
      const img=page.locator('#home img[fetchpriority="high"]');
      await img.waitFor();
      await page.waitForFunction(()=>{const x=document.querySelector('#home img[fetchpriority="high"]');return x?.complete && x.naturalWidth>0});
      assert.ok((await img.getAttribute('src')).includes(mode==='normal'?primary:original));
      if(mode==='fallback') assert.equal(requests.filter(u=>u.includes(primary)).length,1,'failed shell primary must not be re-requested on mount');
    }
    const logo=page.locator('img[alt="LiftOff"]'); await logo.waitFor();
    await page.waitForFunction(()=>{const img=document.querySelector('img[alt="LiftOff"]');return img && !img.parentElement.querySelector('source') && img.complete && img.naturalWidth>0});
    // Trigger another React hero render; React must keep owning the recovered logo tree.
    if(mode!=='exhausted') { await page.locator('#home img[fetchpriority="high"]').dispatchEvent('error'); await page.waitForTimeout(150); }
    assert.equal(await logo.locator('xpath=..').locator('source').count(),0);
    assert.equal(await logo.evaluate(el=>el.naturalWidth>0),true);
    console.log(`PASS ${mode}: shell CTA, hero recovery/handoff and logo fallback after re-render`);
    await ctx.close();
  }
} finally {await browser.close()}
