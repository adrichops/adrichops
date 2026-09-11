const {chromium}=require('playwright');
const sharp=require('sharp');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const base=process.env.ADRICHOPS_PREVIEW||'http://127.0.0.1:8063';

async function pixels(page){
  const uri=await page.locator('[data-knife-scene] canvas').evaluate(c=>c.toDataURL());
  const buffer=Buffer.from(uri.split(',')[1],'base64');
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let count=0,minX=info.width,minY=info.height,maxX=0,maxY=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>30){count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return {hash:crypto.createHash('sha256').update(buffer).digest('hex'),count,minX,minY,maxX,maxY,width:info.width,height:info.height};
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const width of [1440,820,390,320]){
      const page=await browser.newPage({viewport:{width,height:1000},isMobile:width<760,hasTouch:width<760,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/knife-anatomy/');
      await page.waitForSelector('[data-knife-study][data-ready="true"]');
      await page.locator('[data-knife-scene]').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
      const initial=await pixels(page);
      assert.ok(initial.count>initial.width*initial.height*.01,'3D canvas must contain visible knife geometry');
      assert.ok(initial.minX>4 && initial.minY>4 && initial.maxX<initial.width-4 && initial.maxY<initial.height-4,`Knife must fit at ${width}: ${JSON.stringify(initial)}`);
      await page.locator('.anatomy-workspace').screenshot({path:`/tmp/gyuto-study-${width}.png`});
      assert.equal(await page.locator('[data-knife-study]').getAttribute('data-construction-view'),'whole');
      await page.locator('[data-knife-view="bevel"]').click();await page.waitForTimeout(100);
      assert.notEqual((await pixels(page)).hash,initial.hash,'Bevel study must be a different blade geometry');
      await page.locator('[data-knife-view="whole"]').click();
      await page.locator('[data-term="shinogi"]').click();
      assert.equal(await page.locator('[data-knife-study]').getAttribute('data-construction-view'),'bevel','Shinogi opens the explicit study model');
      await page.locator('[data-knife-view="whole"]').click();
      assert.equal(await page.locator('[data-knife-study]').getAttribute('data-selected-part'),'hira');
      const ids=await page.locator('[data-term]').evaluateAll(bs=>bs.map(b=>b.dataset.term));
      assert.equal(ids.length,16);
      for(const id of ids){
        await page.locator(`[data-term="${id}"]`).click();
        assert.equal(await page.locator('[data-knife-study]').getAttribute('data-selected-part'),id);
        assert.ok((await page.locator('.term-japanese').innerText()).length>0);
        assert.match(await page.locator('.knife-inspector a').getAttribute('href'),/^https:\/\//);
      }
      await page.locator('[data-knife-view="whole"]').click();
      await page.locator('[data-knife-scene]').scrollIntoViewIfNeeded();
      // A click on the actual blade surface, away from HTML hotspot buttons.
      const hira=await page.locator('[data-hotspot="hira"]').boundingBox();
      const tip=await page.locator('[data-hotspot="kissaki"]').boundingBox();
      const x=hira.x+22+(tip.x-hira.x)*.45,y=hira.y+22+(tip.y-hira.y)*.45;
      if(width<760)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
      assert.notEqual(await page.locator('[data-knife-study]').getAttribute('data-selected-part'),'ejiri','Raycasting must select a blade part');
      assert.equal(await page.locator('[data-knife-study]').getAttribute('data-construction-view'),'whole','Hidden study meshes must not intercept reference-blade clicks');
      await page.locator('[data-knife-view="layers"]').click();await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-knife-study]').getAttribute('data-construction-view'),'layers');
      const exploded=await pixels(page);
      assert.notEqual(exploded.hash,initial.hash);
      assert.ok(exploded.minX>3 && exploded.maxX<exploded.width-3 && exploded.minY>3 && exploded.maxY<exploded.height-3,'Exploded layers must fit');
      await page.locator('[data-term="jigane"]').click();
      await page.locator('.anatomy-workspace').screenshot({path:`/tmp/gyuto-exploded-${width}.png`});
      await page.locator('[data-knife-view="whole"]').click();
      await page.locator('[data-term="nakago"]').click();
      assert.equal(await page.locator('[data-knife-tang]').isChecked(),true);
      await page.locator('[data-knife-tang]').uncheck();
      await page.locator('[data-knife-reset]').click();
      await page.locator('[data-knife-spin]').click();
      const before=await pixels(page);await page.waitForTimeout(250);const after=await pixels(page);
      assert.notEqual(before.hash,after.hash,'Automatic orbit must change the rendered knife');
      await page.locator('[data-knife-spin]').click();
      const canvas=await page.locator('[data-knife-scene] canvas').boundingBox();
      await page.mouse.move(canvas.x+canvas.width/2,canvas.y+40);await page.mouse.down();
      await page.mouse.move(canvas.x+canvas.width/2+65,canvas.y+95,{steps:8});await page.mouse.up();
      assert.notEqual((await pixels(page)).hash,after.hash,'Drag orbit must change the view');
      await page.locator('[data-knife-search]').fill('higane');assert.equal(await page.locator('[data-term]').count(),1);
      await page.locator('[data-knife-search]').fill('鎬');assert.equal(await page.locator('[data-term]').count(),1);
      await page.locator('[data-knife-search]').fill('no-such-part');assert.equal(await page.locator('[data-knife-empty]').isVisible(),true);
      await page.locator('[data-knife-search]').fill('');
      await page.evaluate(()=>document.documentElement.dataset.theme='light');
      await page.locator('[data-knife-reset]').click();await page.locator('.anatomy-workspace').screenshot({path:`/tmp/gyuto-light-${width}.png`});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);await page.close();
    }
    const page=await browser.newPage();
    await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
    await page.goto(base+'/knife-anatomy/');await page.waitForSelector('[data-ready="fallback"]');
    assert.equal(await page.locator('[data-term]').count(),16);
    await page.locator('[data-term="shinogi"]').click();assert.equal(await page.locator('.knife-inspector h2').innerText(),'Bevel ridge');
    console.log('PASS: reference blade, separate bevel study, 16 bilingual terms, visible-mesh raycasting, exploded layers, tang reveal, orbit, search, fallback and nonblank/framed 3D pixels at desktop/tablet/mobile widths.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
