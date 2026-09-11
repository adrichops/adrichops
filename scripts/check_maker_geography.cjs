const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ADRICHOPS_PREVIEW || 'http://127.0.0.1:8063';

(async () => {
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:1000},isMobile:width<760,hasTouch:width<760,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/maker-map/');
      await page.waitForSelector('[data-boundary-ready="true"]');
      await page.waitForSelector('.map-region-pin');
      await page.locator('.map-stage').screenshot({path:`/tmp/japan-map-${width}.png`});
      const initialPan=await page.evaluate(()=>document.querySelector('[data-maker-canvas]')._cyreg.cy.pan());
      const surface=await page.locator('[data-maker-canvas]').boundingBox();
      const x=surface.x+surface.width-22, y=surface.y+surface.height/2;
      if(width<760){
        const input=await page.context().newCDPSession(page);
        await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        for(let i=1;i<=6;i++) await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*10,y:y+10}]});
        await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await input.detach();
      }else{
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-60,y+10,{steps:6});await page.mouse.up();
      }
      const movedPan=await page.evaluate(()=>document.querySelector('[data-maker-canvas]')._cyreg.cy.pan());
      assert.ok(Math.abs(movedPan.x-initialPan.x)>30,'Dragging the map must pan on desktop and touch devices');
      // Cluster choices keep every region reachable, including adjacent Sanjo/Tsubame.
      for(const id of ['sakai','sanjo','tsubame-niigata','tosa-kochi']) {
        await page.locator('[data-map-back]').click();
        let opened=false;
        for(let attempt=0;attempt<8;attempt++) {
          const marker=page.locator('.map-region-pin');
          const index=await marker.evaluateAll((buttons,id)=>buttons.findIndex(b=>b.dataset.regions.split(',').includes(id)),id);
          assert.ok(index>=0,`${id} must stay reachable while zooming`);
          await marker.nth(index).click();
          await page.waitForTimeout(80);
          const choice=page.locator(`[data-choose-region="${id}"]`);
          if(await choice.isVisible()) await choice.click();
          if(await page.locator('[data-maker-region]').inputValue()===id) {opened=true;break;}
        }
        assert.ok(opened,`${id} must open through geographic markers`);
        const anchor=await page.evaluate(id=>{
          const cy=document.querySelector('[data-maker-canvas]')._cyreg.cy;
          const node=cy.getElementById('region:'+id);
          return {locked:node.locked(),position:node.position()};
        },id);
        assert.ok(anchor.locked);
        assert.deepEqual(anchor.position,{x:0,y:0},'Regional graphs use a neutral origin, not geographic coordinates');
        assert.equal(await page.locator('.map-landscape').isVisible(),false);
        assert.equal(await page.locator('.map-north').isVisible(),false);
        assert.equal(await page.locator('.map-attribution').isVisible(),false);
        assert.equal(await page.locator('[data-map-view="map"]').innerText(),'Graph');
      }
      await page.locator('[data-maker-region]').selectOption('sakai');
      await page.locator('.map-stage').screenshot({path:`/tmp/japan-sakai-${width}.png`});
      const oldZoom=await page.evaluate(()=>document.querySelector('[data-maker-canvas]')._cyreg.cy.zoom());
      await page.locator('[data-map-zoom="in"]').click();
      const canvas=page.locator('[data-maker-canvas]');
      await canvas.focus();await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(80);
      assert.ok(await page.evaluate(()=>document.querySelector('[data-maker-canvas]')._cyreg.cy.zoom())>oldZoom);
      // Hit a real canvas node, not just a synthetic Cytoscape event.
      await page.evaluate(()=>{const cy=document.querySelector('[data-maker-canvas]')._cyreg.cy;cy.center(cy.getElementById('mitsuaki-takada'));});
      const box=await canvas.boundingBox();
      const pos=await page.evaluate(()=>document.querySelector('[data-maker-canvas]')._cyreg.cy.getElementById('mitsuaki-takada').renderedPosition());
      if(width<760) await page.touchscreen.tap(box.x+pos.x,box.y+pos.y);
      else await page.mouse.click(box.x+pos.x,box.y+pos.y);
      assert.equal(await page.locator('[data-maker-profile] h2').innerText(),'Mitsuaki Takada');
      await page.locator('[data-map-view="directory"]').click();
      assert.equal(await page.locator('.map-stage').isVisible(),false);
      await page.locator('[data-map-view="map"]').click();
      await page.locator('[data-map-back]').click();
      assert.equal(await page.locator('.map-landscape').isVisible(),true);
      assert.equal(await page.locator('.map-north').isVisible(),true);
      assert.equal(await page.locator('.map-attribution').isVisible(),true);
      assert.equal(await page.locator('[data-map-view="map"]').innerText(),'Map');
      await page.evaluate(()=>document.documentElement.dataset.theme='light');
      await page.locator('.map-stage').screenshot({path:`/tmp/japan-light-${width}.png`});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const page=await browser.newPage();
    const session=await page.context().newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled',{cacheDisabled:true});
    await session.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:500000,uploadThroughput:100000});
    const start=Date.now();
    await page.goto(base+'/maker-map/');
    await page.waitForSelector('[data-boundary-ready="true"]');
    await page.waitForSelector('.map-region-pin');
    const readyMs=Date.now()-start;
    const assets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/maker-graph|maker-geography|japan-boundary|cytoscape/.test(r.name)).map(r=>({url:new URL(r.name).pathname,bytes:r.decodedBodySize})));
    assert.ok(readyMs<8000,'Cold map load must stay below eight seconds on simulated 4 Mbps / 80 ms network');
    assert.ok(assets.reduce((sum,r)=>sum+r.bytes,0)<700000,'Core map assets must stay under 700 KB uncompressed');
    console.log(JSON.stringify({readyMs,assets},null,2));
    // A failed coastline request must not break the directory or regional graph.
    await page.route('**/data/japan-boundary.json',r=>r.abort());
    await page.reload();await page.waitForSelector('.map-region-pin');
    assert.match(await page.locator('.map-attribution').innerText(),/unavailable/);
    await page.locator('[data-maker-region]').selectOption('sakai');
    assert.ok(await page.evaluate(()=>document.querySelector('[data-maker-canvas]')._cyreg.cy.nodes('.maker').length)>10);
    console.log('PASS: geographic cluster navigation, plain regional graphs, back to Japan, pan/zoom, real maker taps, mobile/desktop themes, directory, cold load and map-background failure.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
