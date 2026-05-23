#!/usr/bin/env python3
"""Generate 2D ship sprite images from the ship design tool data.
Uses the same 2D ship definitions as ship-design-tool/index.html.
Outputs PNG files for use in the help page."""

import json
import os

# Ship data from ship-design-tool/index.html SHIP_TYPES array
# Each ship: verts = [[x,y],...], polys = [[v0,v1,v2,color_idx],...]
# VGA palette from ship-design-tool
VGA_PALETTE = [
    '#000000','#0000AA','#00AA00','#00AAAA','#AA0000','#AA00AA',
    '#AA5500','#AAAAAA','#555555','#5555FF','#55FF55','#55FFFF',
    '#FF5555','#FF55FF','#FFAA00','#FFFFFF'
]

SHIP_TYPES = [
    { 'id': 1, 'name': 'Fighter', 'typeName': 'Jäger',
      'verts': [[8,0],[1,-3],[1,3],[-3,0],[-8,7],[-8,-7]],
      'polys': [[0,1,3,1],[0,2,3,1],[2,3,4,4],[1,3,5,4]] },
    { 'id': 2, 'name': 'Interceptor', 'typeName': 'Fortgeschrittener Jäger',
      'verts': [[10,-3],[0,-5],[-7,-2],[-7,2],[0,5],[10,3],[2,0]],
      'polys': [[0,1,6,1],[1,2,6,3],[2,3,6,4],[3,4,6,3],[4,5,6,1]] },
    { 'id': 3, 'name': 'Bomber', 'typeName': 'Bomber',
      'verts': [[10,5],[10,-5],[7,0],[2,3],[2,-3],[0,8],[-6,6],[-9,0],[-6,-6],[0,-8]],
      'polys': [[2,3,4,1],[0,3,5,3],[1,4,9,3],[3,5,6,3],[4,8,9,3],[3,6,7,4],[4,7,8,4],[3,4,7,1]] },
    { 'id': 4, 'name': 'Adv Fighter', 'typeName': 'Fortgeschrittener Jäger',
      'verts': [[1,2],[1,-2],[-3,2],[-3,-2],[8,2],[8,-2],[0,6],[0,-6],[-6,2],[-6,-2]],
      'polys': [[0,2,3,14],[0,1,3,14],[4,6,8,10],[5,7,9,10]] },
    { 'id': 5, 'name': 'Adv Interceptor', 'typeName': 'Fortgeschrittener Jäger',
      'verts': [[8,2],[8,-2],[0,5],[0,-5],[-6,2],[-6,-2],[-8,8],[-8,-8],[-3,3.5],[-3,-3.5]],
      'polys': [[2,0,4,2],[1,3,5,2],[2,6,8,14],[3,7,9,14]] },
    { 'id': 6, 'name': 'Adv Bomber', 'typeName': 'Bomber',
      'verts': [[10,2],[10,-2],[5,8],[5,-8],[3,5],[3,-5],[0,5],[0,-5],[-5.5,2],[-5.5,-2],[-7,8],[-7,-8],[-9,0],[0,0]],
      'polys': [[2,0,4,10],[1,3,5,10],[2,12,13,2],[3,12,13,2],[6,8,10,14],[7,9,11,14]] },
    { 'id': 7, 'name': 'Elite Fighter', 'typeName': 'Elite Jäger',
      'verts': [[10,2],[7,-5],[-3,3],[-2,-2],[-8,8],[-6,-6],[-4,2],[0,0]],
      'polys': [[0,2,7,7],[7,1,3,8],[4,3,7,8],[5,3,6,15]] },
    { 'id': 8, 'name': 'Elite Interceptor', 'typeName': 'Elite Jäger',
      'verts': [[9,7],[5,-7],[2,0],[1,4],[0,-3],[-6,9],[-4,0],[-5,-4],[-6,-9],[-10,-2]],
      'polys': [[0,2,3,7],[1,2,4,8],[2,3,6,15],[5,3,6,15],[2,6,8,7],[7,9,6,8]] },
    { 'id': 9, 'name': 'Elite Bomber', 'typeName': 'Elite Bomber',
      'verts': [[8,3],[9,-4],[5,-4],[4,0],[0,-4],[-2,5],[-5,8],[-4,-8],[-5,-4],[-9,-4],[-7,5],[-9,5]],
      'polys': [[3,0,6,8],[0,2,4,7],[1,7,9,8],[4,8,10,7],[6,5,11,15]] },
    { 'id': 10, 'name': 'Transporter', 'typeName': 'Transporter',
      'verts': [[13,0],[8,4],[8,-4],[1,8],[1,3],[1,-3],[1,-8],[-2,4],[-2,-4],[-10,0]],
      'polys': [[0,5,4,1],[1,3,4,3],[2,5,6,3],[3,4,7,3],[5,8,6,3],[4,9,7,4],[4,5,9,1],[5,8,9,4]] },
    { 'id': 11, 'name': 'Adv Transporter', 'typeName': 'Transporter',
      'verts': [[8,5],[8,-5],[0,8],[0,2],[0,-2],[0,-8],[-8,5],[-8,-5],[0,0],[-8,2],[-8,-2]],
      'polys': [[0,2,3,2],[4,1,5,10],[2,3,6,10],[4,5,7,2],[8,9,10,14]] },
    { 'id': 12, 'name': 'Elite Transporter', 'typeName': 'Transporter',
      'verts': [[9,2],[7,1],[8,-3],[5,-2],[0,5],[2,-1],[-2,11],[-4,-4],[-9,3],[-9,-8],[-6,-2]],
      'polys': [[1,2,5,15],[0,4,5,8],[6,5,10,15],[3,7,8,7],[7,3,9,8]] },
]

# Faction colors (VGA palette indices used in game)
FACTION_COLORS = {
    1: '#FF5555',  # Red
    2: '#55FF55',  # Green
    3: '#FFAA00',  # Yellow
}

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def generate_ship_svg(ship, color_hex='#FF5555', size=120):
    """Generate a simple SVG rendering of the 2D ship shape."""
    verts = ship['verts']
    polys = ship['polys']
    
    # Compute bounds
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    ship_w = max_x - min_x or 1
    ship_y = max_y - min_y or 1
    
    # Scale to fit in size with padding
    padding = 15
    scale = (size - 2 * padding) / max(ship_w, ship_y)
    cx = size / 2 - (min_x + max_x) / 2 * scale
    cy = size / 2 - (min_y + max_y) / 2 * scale
    
    # Build SVG polygons
    polygons = []
    for p in polys:
        v0, v1, v2 = verts[p[0]], verts[p[1]], verts[p[2]]
        color_idx = p[3]
        # Get color from VGA palette
        fill = VGA_PALETTE[color_idx] if color_idx < len(VGA_PALETTE) else '#888888'
        pts = f"{v0[0]*scale+cx:.1f},{v0[1]*scale+cy:.1f} "
        pts += f"{v1[0]*scale+cx:.1f},{v1[1]*scale+cy:.1f} "
        pts += f"{v2[0]*scale+cx:.1f},{v2[1]*scale+cy:.1f}"
        polygons.append(f'<polygon points="{pts}" fill="{fill}" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>')
    
    poly_str = '\n    '.join(polygons)
    
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <rect width="{size}" height="{size}" fill="rgba(0,0,0,0)" />
  <g transform="rotate(0)">
    {poly_str}
  </g>
</svg>'''
    return svg

def main():
    output_dir = '/home/muckl/usi-game-port/browser3d/ship-sprites'
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate SVG for each ship type in each faction color
    for ship in SHIP_TYPES:
        for faction_id, color in FACTION_COLORS.items():
            svg = generate_ship_svg(ship, color, 120)
            filename = f"ship_{ship['id']}_f{faction_id}.svg"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'w') as f:
                f.write(svg)
    
    # Also generate a combined HTML preview
    html = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ship Sprites Preview</title>
<style>body{background:#0a0a0f;color:#fff;font-family:monospace;display:flex;flex-wrap:wrap;gap:20px;padding:20px;}
.ship-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;width:130px;}
.ship-card svg{width:120px;height:120px;}</style></head><body>
'''
    for ship in SHIP_TYPES:
        for faction_id, color in FACTION_COLORS.items():
            filename = f"ship_{ship['id']}_f{faction_id}.svg"
            html += f'<div class="ship-card"><img src="{filename}" width="120"><br>{ship["name"]} (F{faction_id})</div>\n'
    html += '</body></html>'
    
    with open(os.path.join(output_dir, 'preview.html'), 'w') as f:
        f.write(html)
    
    print(f"Generated {len(SHIP_TYPES) * 3} SVG sprites in {output_dir}")

if __name__ == '__main__':
    main()
