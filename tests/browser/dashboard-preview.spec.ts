import {expect,test} from '@playwright/test';
import {dashboardCases,dashboardPreview} from '../../packages/device/src/dashboard-fixtures.js';

test('qualification canvas exactly reproduces every RGB payload',async({page})=>{
  const cases=dashboardCases();
  await page.setContent(dashboardPreview(cases));
  await expect(page.locator('canvas')).toHaveCount(cases.length);
  for(const item of cases) {
    const rgb=await page.locator(`canvas[data-case="${item.id}"]`).evaluate((element)=>{
      const pixels=(element as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data;
      return Array.from(pixels).filter((_,index)=>index%4!==3);
    });
    expect(rgb).toEqual(Array.from(item.rgb));
  }
  await expect(page.getByText('Physical output is unverified.',{exact:false})).toBeVisible();
});
