import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const gemini = process.argv[2] === 'gemini';
const exe = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
const B = 'http://localhost:3000';
const step = (s) => console.log('ok', s);

// guarded
await p.goto(B + '/feeds');
await p.waitForURL('**/login');
step('redirect to login');

await p.goto(B + '/register');
await p.fill('input[name=name]', 'E2E');
await p.fill('input[name=email]', `e2e${Date.now()}@t.de`);
await p.fill('input[name=password]', 'geheim123');
await p.click('button.primary');
await p.waitForURL(B + '/');
step('register -> home');

// feeds: add, edit, unsubscribe/resubscribe
await p.goto(B + '/feeds');
await p.fill('input[name=name]', 'Fake');
await p.fill('input[name=url]', 'http://127.0.0.1:5055/feed.xml');
await p.click('button.primary');
await p.getByText('Fake').first().waitFor();
step('feed added');
await p.getByText('Bearbeiten').click();
await p.locator("li input[name=name]").fill("Fake2");
await p.locator("li button.primary").click();
await p.getByText('Fake2').first().waitFor();
step('feed edited');
const cb = p.locator('input[type=checkbox]').first();
await cb.click(); await p.waitForTimeout(500);
await p.reload();
assert.equal(await p.locator('input[type=checkbox]').first().isChecked(), false);
await p.locator("input[type=checkbox]").first().click(); await p.waitForTimeout(500);
step('unsubscribe persisted + resubscribe');

// articles
await p.goto(B + '/');
await p.getByText('Bayern gewinnt Pokal').first().waitFor();
const titles = await p.locator('a[href^="/article"]').allInnerTexts();
assert.ok(titles.join('|').indexOf('Klimagesetz') < titles.join('|').indexOf('Bayern'), 'newest first');
step('overview newest first');
await p.getByLabel('Storys gruppieren').check();
await p.getByText(gemini ? 'GEMINI-Story' : 'Bundestag').first().waitFor();
step('clusters shown');

// detail + summary
await p.goto(B + '/');
await p.locator('a[href^="/article"]').first().click();
await p.getByText('Langer Inhalt').first().waitFor();
await p.getByText('Zusammenfassen').click();
await p.getByText(gemini ? 'GEMINI-Zusammenfassung' : 'mock').first().waitFor().catch(async () => {
  throw new Error('summary missing: ' + (await p.locator('body').innerText()).slice(0, 400));
});
assert.ok((await p.locator('body').innerText()).toLowerCase().includes(gemini ? 'gemini' : 'mock'));
step('article detail + summary (' + (gemini ? 'gemini' : 'mock') + ')');

// runner
await p.goto(B + '/runner');
await p.getByText('Bayern gewinnt Pokal').first().waitFor();
await p.getByText('Pause').click();
await p.getByText('Abspielen').waitFor();
step('runner headlines + pause');
await p.goto(B + '/runner?url=' + encodeURIComponent('http://127.0.0.1:5055/a/x'));
await p.getByText('Langer Inhalt').first().waitFor();
step('runner article text');

// settings persist + theme
await p.goto(B + '/settings');
await p.locator('select').first().selectOption('dark');
await p.locator('input[type=number]').first().fill('55');
await p.click('button.primary');
await p.waitForTimeout(500);
await p.reload();
await p.locator('input[type=number]').first().waitFor();
assert.equal(await p.locator('input[type=number]').first().inputValue(), '55');
assert.equal(await p.locator('html').getAttribute('data-theme'), 'dark');
step('settings persisted, dark theme');

// logout
await p.getByText('Abmelden').click();
await p.waitForURL('**/login');
await p.goto(B + '/feeds');
await p.waitForURL('**/login');
step('logout');

assert.deepEqual(errors, []);
await b.close();
console.log('E2E PASS');
