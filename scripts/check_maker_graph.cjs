const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const graph = require('../data/maker-graph.json');
const base = process.env.ADRICHOPS_PREVIEW || 'http://127.0.0.1:8063';
const makers = graph.regions.flatMap(r => r.nodes);
const makerIds = new Set(makers.map(n => n.id));
const sourceIds = new Set(graph.sources.map(s => s.id));
const taira = makers.find(n => n.id === 'yasuaki-taira');
assert.ok(graph.regions.find(r => r.id === 'fukuoka').nodes.includes(taira));
assert.equal(taira.role, 'Blacksmith / Sharpener');
const tairaEdges = graph.regions.flatMap(r => r.edges).filter(e => e.from === taira.id || e.to === taira.id);
assert.ok(tairaEdges.some(e => e.from === 'ajioka-cutlery-factory' && e.kind === 'apprenticeship'));
assert.ok(!tairaEdges.some(e => e.from === 'morihiro' || e.to === 'morihiro'), 'Do not conflate Yame and Sakai Morihiro identities');
assert.equal(makerIds.size, makers.length, 'Maker IDs must be unique');
assert.equal(sourceIds.size, graph.sources.length, 'Source IDs must be unique');
for (const region of graph.regions) {
  for (const edge of region.edges) {
    assert.ok(makerIds.has(edge.from) && makerIds.has(edge.to), 'Relationship endpoints must exist');
  }
  for (const item of [region, ...region.nodes, ...region.edges]) {
    for (const id of item.sourceIds || []) assert.ok(sourceIds.has(id), `Missing source ${id}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 760, hasTouch: width < 760, reducedMotion:'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/maker-map/');
      await page.waitForSelector('[data-maker-canvas] canvas');
      assert.ok(await page.locator('.map-role-key').isVisible());
      assert.match(await page.locator('.map-role-key').innerText(), /Sharpener \/ polisher/);
      const snapshot = () => page.evaluate(() => {
        const cy = document.querySelector('[data-maker-canvas]')._cyreg.cy;
        return { nodes: cy.nodes().map(n => n.id()), edges: cy.edges().map(e => e.id()) };
      });
      await page.waitForSelector('[data-boundary-ready="true"]');
      const representedRegions = () => page.locator('.map-region-pin').evaluateAll(pins => pins.flatMap(p => p.dataset.regions.split(',')));
      assert.equal((await snapshot()).nodes.length, 0, 'Country overview uses geographic region markers');
      assert.deepEqual(new Set(await representedRegions()), new Set(graph.regions.map(r=>r.id)));
      for (const region of graph.regions) {
        await page.locator('[data-maker-region]').selectOption(region.id);
        const actual = await snapshot();
        assert.ok(actual.nodes.includes('region:' + region.id));
        const localIds = new Set(region.nodes.map(n => n.id));
        for (const id of localIds) assert.ok(actual.nodes.includes(id), `${region.id}: missing ${id}`);
        const labels = await page.evaluate(() => document.querySelector('[data-maker-canvas]')._cyreg.cy.nodes('.maker').map(n => ({ id: n.id(), label: n.data('label') })));
        for (const item of labels) assert.equal(item.label, makers.find(n => n.id === item.id).name, 'Graph nodes must show names only');
        const expected = graph.regions.flatMap(r => r.edges || []).filter(e => localIds.has(e.from) || localIds.has(e.to));
        assert.equal(actual.edges.filter(id => id.startsWith('relation-')).length, expected.length);
      }
      await page.locator('[data-maker-region]').selectOption('sakai');
      const before = await snapshot();
      assert.ok(before.nodes.includes('ivan-fonseca'), 'Ivan must appear through his Sakai connections');
      assert.ok(before.nodes.includes('yasuaki-taira'), 'Taira must appear through his Sakai training connection');
      await page.evaluate(() => { document.querySelector('[data-maker-canvas]')._cyreg.cy.getElementById('ivan-fonseca').emit('tap'); });
      await page.locator('[data-relation]').filter({ hasText: 'Reported study with Morihiro' }).click();
      assert.match(await page.locator('.evidence-note').innerText(), /provisional/);
      const training = await page.evaluate(() => {
        const edge = document.querySelector('[data-maker-canvas]')._cyreg.cy.edges('.selected');
        return { color: edge.data('color'), dashed: edge.hasClass('provisional') };
      });
      assert.deepEqual(training, { color: '#56ce8b', dashed: true });
      await page.evaluate(() => { document.querySelector('[data-maker-canvas]')._cyreg.cy.getElementById('mitsuaki-takada').emit('tap'); });
      assert.equal(await page.locator('[data-maker-profile] h2').innerText(), 'Mitsuaki Takada');
      assert.deepEqual(await snapshot(), before, 'Selecting a maker must not remove regional nodes or edges');
      await page.locator('[data-relation]').first().click();
      assert.deepEqual(await snapshot(), before, 'Selecting an edge must not replace the regional graph');
      await page.evaluate(() => { document.querySelector('[data-maker-canvas]')._cyreg.cy.getElementById('tanaka-uchihamono').emit('tap'); });
      assert.equal(await page.locator('[data-maker-region]').inputValue(), 'sakai', 'A cross-region collaborator must not silently switch regions');
      assert.deepEqual(await snapshot(), before);
      await page.locator('[data-map-back]').click();
      await page.waitForSelector('.map-region-pin');
      assert.deepEqual(new Set(await representedRegions()), new Set(graph.regions.map(r=>r.id)));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('[data-maker-search]').fill('Taira');
      await page.locator('[data-maker-directory] [data-person="yasuaki-taira"]').click();
      assert.equal(await page.locator('[data-maker-profile] h2').innerText(), 'Yasuaki Taira');
      assert.match(await page.locator('[data-maker-profile]').innerText(), /Yame, Fukuoka/i);
      await page.locator('[data-relation]').filter({hasText:'Sharpening training in Sakai'}).click();
      assert.equal(await page.locator('[data-maker-profile] h2').innerText(), 'Sharpening training in Sakai');
      assert.ok(await page.locator('[data-maker-profile] a[href="https://www.hocho-morihiro.com/"]').isVisible());
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: data integrity, name-only labels, role legend, provisional training, all regions and relationships, Sakai selection, back navigation, desktop and mobile.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
