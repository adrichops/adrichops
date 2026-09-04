const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const graph = require('../data/maker-graph.json');
const base = process.env.ADRICHOPS_PREVIEW || 'http://127.0.0.1:8063';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 760, hasTouch: width < 760 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/maker-map/');
      await page.waitForSelector('[data-maker-canvas] canvas');
      const snapshot = () => page.evaluate(() => {
        const cy = document.querySelector('[data-maker-canvas]')._cyreg.cy;
        return { nodes: cy.nodes().map(n => n.id()), edges: cy.edges().map(e => e.id()) };
      });
      assert.equal((await snapshot()).nodes.length, graph.regions.length + 1);
      for (const region of graph.regions) {
        await page.locator('[data-maker-region]').selectOption(region.id);
        const actual = await snapshot();
        assert.ok(actual.nodes.includes('region:' + region.id));
        const localIds = new Set(region.nodes.map(n => n.id));
        for (const id of localIds) assert.ok(actual.nodes.includes(id), `${region.id}: missing ${id}`);
        const expected = graph.regions.flatMap(r => r.edges || []).filter(e => localIds.has(e.from) || localIds.has(e.to));
        assert.equal(actual.edges.filter(id => id.startsWith('relation-')).length, expected.length);
      }
      await page.locator('[data-maker-region]').selectOption('sakai');
      const before = await snapshot();
      await page.evaluate(() => { document.querySelector('[data-maker-canvas]')._cyreg.cy.getElementById('mitsuaki-takada').emit('tap'); });
      assert.equal(await page.locator('[data-maker-profile] h2').innerText(), 'Mitsuaki Takada');
      assert.deepEqual(await snapshot(), before, 'Selecting a maker must not remove regional nodes or edges');
      await page.locator('[data-relation]').first().click();
      assert.deepEqual(await snapshot(), before, 'Selecting an edge must not replace the regional graph');
      await page.evaluate(() => { document.querySelector('[data-maker-canvas]')._cyreg.cy.getElementById('tanaka-uchihamono').emit('tap'); });
      assert.equal(await page.locator('[data-maker-region]').inputValue(), 'sakai', 'A cross-region collaborator must not silently switch regions');
      assert.deepEqual(await snapshot(), before);
      await page.locator('[data-map-back]').click();
      assert.equal((await snapshot()).nodes.length, graph.regions.length + 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: all regions, every maker and relationship, persistent Sakai selection, back navigation, desktop and mobile.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
