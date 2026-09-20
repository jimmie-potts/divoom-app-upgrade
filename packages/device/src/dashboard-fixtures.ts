import type {DashboardEvent} from './dashboard-qualification.js';

// Original 3x5 bitmap alphabet for synthetic fixtures only, not device fonts.
const glyphs:Record<string,string>={
  '0':'111101101101111','1':'010110010010111','2':'111001111100111',
  '3':'111001111001111','4':'101101111001001','5':'111100111001111',
  '6':'111100111101111','7':'111001010010010','8':'111101111101111',
  '9':'111101111001111',A:'010101111101101',B:'110101110101110',
  C:'111100100100111',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',S:'111100111001111',P:'110101110100100',
  '!':'010010010000010','+':'000010111010000','/':'001001010100100',
};
type Color=readonly [number,number,number];
const white:Color=[160,160,160],cyan:Color=[0,100,160],amber:Color=[180,90,0],green:Color=[0,140,40];
function frame(page:number, rows:number, attention:number, change:number) {
  const rgb=new Uint8Array(12288);
  const pixel=(x:number,y:number,color:Color)=>{if(x>=0&&x<64&&y>=0&&y<64)rgb.set(color,(y*64+x)*3);};
  const text=(value:string,x:number,y:number,color:Color)=>{
    for(const [index,char] of [...value].entries()) {
      const glyph=glyphs[char]; if(!glyph)continue;
      for(let row=0;row<5;row++)for(let column=0;column<3;column++)if(glyph[row*3+column]==='1')pixel(x+index*4+column,y+row,color);
    }
  };
  text('S6',1,2,white);text(`!${attention}`,21,2,amber);text(`P${page}/2`,41,2,cyan);
  for(let x=0;x<64;x++)pixel(x,10,[30,30,30]);
  for(let row=0;row<rows;row++) {
    const y=14+row*10;
    // Alternating square/diamond provider symbols; filled/bar state symbols.
    for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++)if(row%2===0 || Math.abs(dx-2)+Math.abs(dy-2)<=2)pixel(1+dx,y+dy,cyan);
    const state=(row+change)%3;
    for(let dy=0;dy<5;dy++)for(let dx=0;dx<3;dx++)if(state===0 || dx===1 || (state===2&&dy===2))pixel(9+dx,y+dy,state===0?green:amber);
    text(`${String.fromCharCode(65+(page-1)*4+row)}${row+1}`,16,y,white);
    text(`+${(row+change)%4}`,34,y,cyan);
    text(`!${state===0?0:1}`,50,y,amber);
  }
  text(`${change}`,1,57,white);
  return rgb;
}
export function dashboardCases():DashboardEvent[] {
  return [
    {atMs:0,id:'four-rows',rgb:frame(1,4,2,0)},
    {atMs:250,id:'burst-1',rgb:frame(1,4,3,1)},
    {atMs:500,id:'burst-2',rgb:frame(1,4,4,2)},
    {atMs:750,id:'burst-latest',rgb:frame(1,4,1,3)},
    {atMs:4000,id:'rows-cleared',rgb:frame(1,2,0,4)},
    {atMs:7000,id:'overflow-page-2',rgb:frame(2,2,2,5)},
    {atMs:10000,id:'return-page-1',rgb:frame(1,4,1,6)},
    {atMs:12500,id:'final-clear',rgb:frame(1,0,0,7)},
  ];
}
export function dashboardPreview(events:readonly DashboardEvent[]) {
  // Only fixed synthetic data enters HTML; no operator metadata or device target.
  const data=JSON.stringify(events.map(event=>({id:event.id,atMs:event.atMs,rgb:Array.from(event.rgb)}))).replaceAll('<','\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dashboard payload previews</title>
<style>body{background:#171b23;color:#eee;font:16px system-ui;margin:24px}main{display:flex;flex-wrap:wrap;gap:24px}canvas{width:256px;height:256px;image-rendering:pixelated;border:1px solid #667}figure{margin:0}figcaption{margin:8px 0;max-width:256px}</style>
<h1>Dashboard payload previews</h1><p>Exact 64×64 RGB payloads, enlarged 4×. Physical output is unverified.</p><p>Summary: sessions, attention, page. Rows: provider symbol, state symbol, synthetic label, subagents, attention. Footer: case number.</p><main></main>
<script>const cases=${data};for(const item of cases){const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.width=canvas.height=64;canvas.dataset.case=item.id;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(64,64);for(let i=0;i<4096;i++){pixels.data.set(item.rgb.slice(i*3,i*3+3),i*4);pixels.data[i*4+3]=255}ctx.putImageData(pixels,0,0);caption.textContent=item.id+' · event '+item.atMs+' ms';figure.append(canvas,caption);document.querySelector('main').append(figure)}</script></html>`;
}
