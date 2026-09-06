import { expect, test } from '@playwright/test';
import { smokeAnimation, smokeGif } from '../../packages/device/src/spike-fixtures.js';

test('Chromium decodes both synthetic GIF frames and their effective delays', async ({ page }) => {
  await page.goto('/');
  const decoded = await page.evaluate(`(async () => {
    const decoder = new ImageDecoder({ data: new Uint8Array(${JSON.stringify(Array.from(smokeGif()))}), type: 'image/gif' });
    await decoder.tracks.ready;
    const frames = [], durations = [];
    for (let frameIndex = 0; frameIndex < 2; frameIndex++) {
      const { image } = await decoder.decode({ frameIndex });
      const rgba = new Uint8Array(image.allocationSize({ format: 'RGBA' }));
      await image.copyTo(rgba, { format: 'RGBA' });
      frames.push(Array.from(rgba).filter((_, index) => index % 4 !== 3));
      durations.push(image.duration);
      image.close();
    }
    const count = decoder.tracks.selectedTrack.frameCount;
    decoder.close();
    return { count, frames, durations };
  })()`);
  expect(decoded).toEqual({ count: 2, frames: smokeAnimation(true).frames.map(frame => Array.from(frame.rgb)), durations: [500000, 500000] });
});
