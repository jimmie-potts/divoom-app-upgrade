import {expect,test} from '@playwright/test';
import {syntheticDashboardRenditions} from '../../apps/server/src/dashboard-examples.js';
import {dashboardPreviewHtml} from '../../apps/server/src/dashboard-preview.js';
test('dashboard native and enlarged previews reproduce exact pixels and safely expose full details',async({page})=>{
 const cases=syntheticDashboardRenditions();
 cases[0]!.rendition.layout.rows[0]!.label='<img src=x onerror=alert(1)>';
 await page.setContent(dashboardPreviewHtml(cases));
 const frames=cases.flatMap((c,index)=>c.rendition.frames.map((rgb,frame)=>({index,frame,rgb})));
 expect(frames.length).toBeGreaterThan(cases.length);
 await expect(page.locator('canvas')).toHaveCount(frames.length*2);
 for(const {index,frame,rgb} of frames)for(const scale of ['native','enlarged']){
  const canvas=page.locator(`canvas[data-index="${index}"][data-frame="${frame}"][data-scale="${scale}"]`);
  const actual=await canvas.evaluate(el=>Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data).filter((_,i)=>i%4!==3));
  expect(actual).toEqual(rgb);
 }
 await expect(page.locator('img')).toHaveCount(0);
 await expect(page.getByText('<img src=x onerror=alert(1)>',{exact:false})).toBeVisible();
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
});
