import type {DashboardLayout} from './agent-dashboard.js';
import {drawText,type Color} from './pixel-font.js';
const white:Color=[200,200,200],cyan:Color=[70,170,220],amber:Color=[230,170,60];
export function renderDashboard(layout:DashboardLayout):Uint8Array {
 const rgb=new Uint8Array(64*64*3);
 const pixel=(x:number,y:number,color:Color)=>{if(x>=0&&x<64&&y>=0&&y<64)rgb.set(color,(y*64+x)*3);};
 const text=(value:string,x:number,y:number,color:Color=white)=>drawText(rgb,value,x,y,color);
 text(`S${layout.matched}`,0,1);text(`!${layout.attentionTotal}`,20,1,amber);text(`${layout.page+1}/${layout.pages}`,40,1,cyan);
 for(let x=0;x<64;x++)pixel(x,9,[35,35,35]);
 const activity={unknown:'?',active:'>',idle:'=',interrupted:'X',ended:']'};
 const attention={approval:'A',input:'!',question:'?',none:' '};
 layout.rows.slice(0,4).forEach((row,index)=>{
  const y=14+index*10;
  text(row.identity.provider==='codex'?'C':'L',0,y,cyan);
  text(activity[row.activity],4,y);
  text(attention[row.attention],8,y,amber);
  text(row.shortLabel,12,y);
  text(`+${Math.min(row.activeChildren,9)}${row.activeChildren>9?'+':''}${row.childrenUncertain?'?':''}`,40,y,cyan);
  text(row.uncertain?'?':' ',56,y,amber);
  text(row.noticeIds.length?'T':' ',60,y,amber);
 });
 if(!layout.rows.length)text('EMPTY',12,24);
 const connection={current:'C',stale:'S',unavailable:'?'};
 const collector={running:'R',quiesced:'Q',faulted:'F',closed:'X',unknown:'?'};
 text(`F${connection[layout.connection]} C${collector[layout.collector]}`,0,57);
 return rgb;
}
