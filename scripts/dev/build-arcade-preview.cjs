// Rebuild the static social card without fetching fonts or remote assets.
const path = require('node:path');
const sharp = require(process.env.SHARP_PATH || 'sharp');
const target = path.resolve(__dirname, '../../public/arcade/challenge-preview.png');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0e0e0e"/>
<rect x="26" y="26" width="1148" height="578" rx="10" fill="none" stroke="#444" stroke-width="2"/>
<path d="M64 72H1136" stroke="#38d7e8" stroke-width="5"/>
<g font-family="monospace" font-weight="bold">
<text x="64" y="177" fill="#ffe93d" font-size="94" letter-spacing="9">ARCADE</text>
<text x="64" y="238" fill="#ff69c7" font-size="31">BEAT PAT'S HIGH SCORES</text>
<g fill="#eee" font-size="24"><text x="64" y="330">SNAKE</text><text x="427" y="330">MINESWEEPER</text><text x="856" y="330">ASTEROIDS</text></g>
</g>
<path d="M76 428H178V370H252" stroke="#ffe93d" stroke-width="18" fill="none"/>
<rect x="270" y="362" width="18" height="18" fill="#ff69c7"/>
<g stroke="#555" fill="#181818" stroke-width="2"><rect x="470" y="359" width="58" height="58"/><rect x="532" y="359" width="58" height="58"/><rect x="594" y="359" width="58" height="58"/><rect x="470" y="421" width="58" height="58"/><rect x="532" y="421" width="58" height="58"/><rect x="594" y="421" width="58" height="58"/></g>
<path d="M552 403V370L578 381L552 389M544 403H566" stroke="#ff69c7" stroke-width="4" fill="none"/>
<path d="M936 364L911 444L936 430L961 444Z M869 368L849 391L859 420L887 411L898 389Z M1012 420L992 447L1006 470L1037 460L1043 433Z" fill="none" stroke="#38d7e8" stroke-width="3"/>
<path d="M64 518H1136" stroke="#444" stroke-width="2"/>
<text x="64" y="564" fill="#bbb" font-family="monospace" font-size="25">patrickneyland.com/arcade</text>
</svg>`;
// Small bitmap lettering renders consistently on Windows and Linux, even when
// the SVG renderer has no system fonts. It also matches the arcade's pixel type.
const glyphs = {
 A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'], D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'], J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','11001','11001','10101','10011','10011','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'], P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'], V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','10101','01010'], X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'],
 "'":['00100','00100','00000','00000','00000','00000','00000'], '.':['00000','00000','00000','00000','00000','00100','00100'],
 '/':['00001','00001','00010','00100','01000','10000','10000']
};
const outlined = svg.replace(/<text([^>]*)>([^<]*)<\/text>/g, (_, attrs, text) => {
  const get = (name, fallback) => (attrs.match(new RegExp(name+'="([^"]+)"')) || [null,fallback])[1];
  const x=+get('x',0), y=+get('y',0), s=+get('font-size',24)/8, color=get('fill','#eee');
  let rects='';
  [...text.toUpperCase()].forEach((char,i) => (glyphs[char]||[]).forEach((row,r) => [...row].forEach((on,c) => {
    if (on==='1') rects += `<rect x="${x+i*s*6+c*s}" y="${y-s*7+r*s}" width="${s}" height="${s}"/>`;
  })));
  return `<g fill="${color}">${rects}</g>`;
});
sharp(Buffer.from(outlined)).png().toFile(target).then(() => console.log(target));
