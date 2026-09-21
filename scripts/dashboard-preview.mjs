import {writeFile} from 'node:fs/promises';
import {syntheticDashboardRenditions} from '../apps/server/dist/dashboard-examples.js';
import {dashboardPreviewHtml} from '../apps/server/dist/dashboard-preview.js';
const output=process.argv[2];
if(!output)throw new Error('Usage: node scripts/dashboard-preview.mjs <output.html>');
await writeFile(output,dashboardPreviewHtml(syntheticDashboardRenditions()));
