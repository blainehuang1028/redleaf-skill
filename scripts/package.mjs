import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.mkdir(path.join(root,'dist'),{recursive:true});
// Python's stdlib ZIP avoids bundling a release-only dependency in the skill.
execFileSync('python3',['-c',`import pathlib,zipfile
root=pathlib.Path(${JSON.stringify(root)})
base=root/'skills/redleaf'
with zipfile.ZipFile(root/'dist/redleaf-skill.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(base.rglob('*')):
  if not p.is_file() or 'node_modules' in p.parts or p.name=='.DS_Store' or p.suffix in ('.otf','.ttf'): continue
  z.write(p,pathlib.Path('redleaf')/p.relative_to(base))
print('Created dist/redleaf-skill.zip')
`],{stdio:'inherit'});
