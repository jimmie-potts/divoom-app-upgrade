import {expect,test} from '@playwright/test';
import {dashboardCases,dashboardPreview} from '../../packages/device/src/dashboard-fixtures.js';

test('qualification canvas exactly reproduces every RGB payload',async({page})=>{
  const cases=dashboardCases();
  await page.setContent(dashboardPreview(cases));
  const frames=cases.flatMap(item=>[item.rgb,...(item.pulse?[item.pulse]:[])].map((rgb,frame)=>({id:item.id,frame,rgb})));
  expect(frames.length).toBeGreaterThan(cases.length);
  await expect(page.locator('canvas')).toHaveCount(frames.length);
  for(const {id,frame,rgb} of frames) {
    const actual=await page.locator(`canvas[data-case="${id}"][data-frame="${frame}"]`).evaluate((element)=>{
      const pixels=(element as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data;
      return Array.from(pixels).filter((_,index)=>index%4!==3);
    });
    expect(actual).toEqual(Array.from(rgb));
  }
  await expect(page.getByText('Physical output is unverified.',{exact:false})).toBeVisible();
});
