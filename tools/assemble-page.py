#!/usr/bin/env python3
"""Refresh the counts that index.html quotes in its share metadata.

    python3 tools/assemble-page.py

The Open Graph / Twitter descriptions and the JSON-LD citation line quote
the number of cited data points and institutions. Those numbers live in
js/data.js, so this script recounts them the same way the Source Audit
does (every object reachable under a `source` key) and rewrites the three
places they appear. Run it after tools/build-data.mjs.
"""
import json, re, subprocess, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
count_js = r"""
const w = {}; new Function('window', require('fs').readFileSync(process.argv[1], 'utf8'))(w);
let n = 0; const inst = new Set();
const add = s => { if (!s) return; if (Array.isArray(s)) return s.forEach(add);
  if (typeof s === 'object' && (s.institution || s.url)) { n++; inst.add(s.institution || 'Unknown'); } };
const walk = (o, d) => { if (!o || d > 6) return; if (Array.isArray(o)) return o.forEach(x => walk(x, d + 1));
  if (typeof o !== 'object') return; if ('source' in o && typeof o.source === 'object') add(o.source);
  for (const [k, v] of Object.entries(o)) if (k !== 'source' && v && typeof v === 'object') walk(v, d + 1); };
walk(w.indigoData, 0);
console.log(JSON.stringify({ n, inst: inst.size }));
"""
c = json.loads(subprocess.check_output(['node', '-e', count_js, str(root / 'js/data.js')]))
n, inst = f"{c['n']:,}", c['inst']
html = (root / 'index.html').read_text()
desc = (f"A data-journalism autopsy of indigo: six thousand years of the world's blue, from a Peruvian "
        f"midden to the denim mill — {n} cited data points across {inst} institutions.")
html = re.sub(r'(<meta property="og:description" content=")[^"]*(")', lambda m: m.group(1) + desc + m.group(2), html)
html = re.sub(r'(<meta name="twitter:description" content=")[^"]*(")', lambda m: m.group(1) + desc + m.group(2), html)
html = re.sub(r'("citation": ")[^"]*(")', lambda m: m.group(1) + f"See the Source Audit section: {n} cited data points across {inst} institutions." + m.group(2), html)
(root / 'index.html').write_text(html)
card = root / 'tools' / 'og-card.html'
if card.exists():
    card.write_text(re.sub(r'<b>[^<]*</b> Cited Sources', f'<b>{n}</b> Cited Sources', card.read_text()))
print(f"index.html + og-card: {n} data points, {inst} institutions")
