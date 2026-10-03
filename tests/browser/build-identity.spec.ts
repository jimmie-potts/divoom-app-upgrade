import {test,expect} from '@playwright/test';

const revision='1234567890abcdef1234567890abcdef12345678';
test('Settings displays and copies the running backend revision',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/api/health',async route=>{
  const response=await route.fetch();await route.fulfill({json:{...await response.json(),build:{sourceRevision:revision,version:'0.0.0'}}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();
 const build=page.getByRole('region',{name:'Running build'});
 await expect(build).toContainText('1234567890ab');
 await expect(build.getByLabel('Full source revision')).toHaveValue(revision);
 await build.getByRole('button',{name:'Copy revision'}).click();
 await expect(build.getByRole('status')).toHaveText('Revision copied.');
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(revision);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('Settings keeps unknown provenance explicit and clipboard failure actionable',async({page})=>{
 let sourceRevision='unknown';
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('unavailable');}}}));
 await page.route('**/api/health',async route=>{
  const response=await route.fetch();await route.fulfill({json:{...await response.json(),build:{sourceRevision,version:'0.0.0'}}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();
 const build=page.getByRole('region',{name:'Running build'});
 await expect(build).toContainText('Source revision unknown');
 await expect(build.getByRole('button',{name:'Copy revision'})).toBeDisabled();
 sourceRevision=revision;await page.getByRole('button',{name:'Reload settings',exact:true}).click();
 await expect(build.getByLabel('Full source revision')).toHaveValue(revision);
 await build.getByRole('button',{name:'Copy revision'}).click();
 await expect(build.getByRole('status')).toHaveText('Clipboard unavailable. Select and copy the full revision below.');
});
