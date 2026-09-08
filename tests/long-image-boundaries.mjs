import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const scope={window:{}};
vm.runInNewContext(await fs.readFile('skills/redleaf/assets/paginate.js','utf8'),scope);
assert.equal(typeof scope.window.redleafImageBreaks,'function','long images must use content-aware safe cuts');
// A heading must stay with its following paragraph; a solid panel has no cut.
const width=100,height=500,data=new Uint8ClampedArray(width*height*4).fill(255);
function band(top,bottom){for(let y=top;y<bottom;y++)for(let x=10;x<90;x++){const p=(y*width+x)*4;data[p]=data[p+1]=data[p+2]=30;}}
band(15,100);band(130,145);band(170,260);band(300,450);
const cuts=scope.window.redleafImageBreaks(data,width,height);
assert(cuts.some(y=>y>100&&y<130));
assert(!cuts.some(y=>y>=145&&y<=170),'short heading cannot be orphaned');
for(const y of cuts)assert.equal(data[(Math.floor(y)*width+50)*4],255);
const solid=new Uint8ClampedArray(width*height*4).fill(30);
assert.equal(scope.window.redleafImageBreaks(solid,width,height).length,0);
console.log('PASS safe whitespace cuts, heading grouping, solid-image fallback');
