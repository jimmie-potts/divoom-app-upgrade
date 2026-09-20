import {expect,test} from '@playwright/test';
import {syntheticDashboardRenditions} from '../../apps/server/src/dashboard-examples.js';
import {dashboardPreviewHtml} from '../../apps/server/src/dashboard-preview.js';
test('dashboard native and enlarged previews reproduce exact pixels and safely expose full details',async({page})=>{
 const cases=syntheticDashboardRenditions();
 cases[0]!.rendition.layout.rows[0]!.label='<img src=x onerror=alert(1)>';
 await page.setContent(dashboardPreviewHtml(cases));
 await expect(page.locator('canvas')).toHaveCount(cases.length*2);
 for(let i=0;i<cases.length;i++)for(const scale of ['native','enlarged']){
  const canvas=page.locator(`canvas[data-index="${i}"][data-scale="${scale}"]`);
  const rgb=await canvas.evaluate(el=>Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data).filter((_,index)=>index%4!==3));
  expect(rgb).toEqual(cases[i]!.rendition.rgb);
 }
 await expect(page.locator('img')).toHaveCount(0);
 await expect(page.getByText('<img src=x onerror=alert(1)>',{exact:false})).toBeVisible();
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
});
