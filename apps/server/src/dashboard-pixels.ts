import type {DashboardLayout} from './agent-dashboard.js';
// Original fixed 3x5 alphabet. Pixel output never uses a platform or device font.
const glyphs:Record<string,string>={
 ' ':'000000000000000','0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001',
 '5':'111100111001111','6':'111100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001111',
 A:'010101111101101',B:'110101110101110',C:'111100100100111',D:'110101101101110',E:'111100110100111',F:'111100110100100',
 G:'111100101101111',H:'101101111101101',I:'111010010010111',J:'001001001101111',K:'101101110101101',L:'100100100100111',
 M:'101111111101101',N:'101111111111101',O:'111101101101111',P:'110101110100100',Q:'111101101111001',R:'110101110101101',
 S:'111100111001111',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
 '.':'000000000000010','_':'000000000000111','+':'000010111010000','!':'010010010000010','?':'110001010000010','/':'001001010100100','-':'000000111000000',
 '>':'100010001010100','=':'000111000111000',']':'110010010010110'
};
type Color=readonly[number,number,number];
const white:Color=[200,200,200],cyan:Color=[70,170,220],amber:Color=[230,170,60];
export function renderDashboard(layout:DashboardLayout):Uint8Array {
 const rgb=new Uint8Array(64*64*3);
 const pixel=(x:number,y:number,color:Color)=>{if(x>=0&&x<64&&y>=0&&y<64)rgb.set(color,(y*64+x)*3);};
 const text=(value:string,x:number,y:number,color:Color=white)=>{
  for(const [i,char] of Array.from(value).entries()){
   const glyph=glyphs[char]??glyphs['?']!;
   for(let dy=0;dy<5;dy++)for(let dx=0;dx<3;dx++)if(glyph[dy*3+dx]==='1')pixel(x+i*4+dx,y+dy,color);
  }
 };
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
