// 用 OpenAI gpt-image-2 生成簡報底圖與圖標總表（金鑰只從環境變數讀取）
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || 'images');
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('缺少 OPENAI_API_KEY'); process.exit(1); }

const LIGHT = 'soft light editorial illustration, warm cream and white background, airy, generous empty space in the center for overlaid titles, accents of coral orange (#e8643a) and sky cyan (#4fc3f7), gentle gradients, subtle paper texture, absolutely no text, no letters, no numbers, no logos';
const JOBS = [
  ['bg_cover', `A smartphone photographing an open school textbook on a desk; from the textbook, glowing translucent learning cards, a small mind map, quiz cards and a floating 3D geometric solid rise upward like confetti. ${LIGHT}`],
  ['bg_module1', `One single photograph print on the left transforming into a flowing arc of many colorful learning materials (cards, charts, small slides) sweeping to the right. ${LIGHT}`],
  ['bg_lunch', `A cozy lunch break still life: a bento box, a cup of coffee with steam, a closed laptop and a small potted plant on a sunlit wooden table. ${LIGHT}`],
  ['bg_error', `A large magnifying glass examining a neat chain of glowing puzzle pieces where exactly one piece is subtly mismatched and glowing orange. ${LIGHT}`],
  ['bg_four', `A teacher silhouette standing calmly at the center of a compass rose on the ground with four soft glowing paths leading in four directions, sunrise light. ${LIGHT}`],
  ['icon_sheet_a', 'A clean icon sheet: exactly 8 flat neon line icons arranged in a precise grid of 2 rows and 4 columns on a pure solid dark navy (#0d1117) background, each icon centered in its own equal cell with wide spacing, cyan and orange neon glow style, bold strokes, no text. Row 1 left to right: (1) an interactive document report with a table of contents sidebar, (2) a mind map with a central node and branches, (3) a presentation slide on an easel, (4) a stack of two flip flashcards. Row 2 left to right: (5) an infographic poster with a small bar chart and a flow arrow, (6) a quiz sheet with checkboxes and a check mark, (7) a video play button inside a screen, (8) a podcast microphone with sound waves.'],
  ['icon_sheet_b', 'A clean icon sheet: exactly 9 flat neon line icons arranged in a precise grid of 3 rows and 3 columns on a pure solid dark navy (#0d1117) background, each icon centered in its own equal cell with wide spacing, cyan and orange neon glow style, bold strokes, no text. Row 1 left to right: (1) a target with an arrow in the bullseye, (2) a balance scale, (3) a heart held by two hands. Row 2 left to right: (4) eyes looking sideways with a wandering dotted path, (5) a circular arrow loop around a check mark, (6) a theater mask half hiding a calculator. Row 3 left to right: (7) a service desk bell, (8) a laptop showing code brackets and a gear, (9) a thoughtful bearded philosopher head with a question mark speech bubble.'],
];

async function gen([name, prompt]) {
  const file = path.join(OUT, name + '.png');
  if (fs.existsSync(file)) { console.log('略過（已存在）', name); return; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'low', n: 1, output_format: 'png', background: 'opaque' }),
    });
    const j = await r.json();
    if (r.ok && j.data?.[0]?.b64_json) {
      fs.writeFileSync(file, Buffer.from(j.data[0].b64_json, 'base64'));
      console.log('完成', name); return;
    }
    console.log('失敗', name, r.status, j.error?.message?.slice(0, 160));
    await new Promise(res => setTimeout(res, 20000 * attempt));
  }
}
const queue = [...JOBS];
await Promise.all([0, 1].map(async () => { while (queue.length) await gen(queue.shift()); }));
console.log('全部結束');
