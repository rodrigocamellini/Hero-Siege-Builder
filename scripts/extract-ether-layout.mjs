import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve('c:\\Users\\Rodrigo R. Camellini\\Documents\\trae_projects\\Hero Siege Builder');
const referenceHtml = path.join(repoRoot, 'hero-siege-brasil', 'EtherFinal.html');
const targetTs = path.join(repoRoot, 'src', 'data', 'EtherNodesData.ts');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function extractBlock(content, marker) {
  const idx = content.indexOf(marker);
  if (idx === -1) return null;
  let i = content.indexOf('[', idx);
  if (i === -1) return null;
  let open = 0;
  let start = i;
  let end = -1;
  for (; i < content.length; i++) {
    const ch = content[i];
    if (ch === '[') open++;
    else if (ch === ']') {
      open--;
      if (open === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  return content.substring(start, end);
}

function extractObject(content, marker) {
  const idx = content.indexOf(marker);
  if (idx === -1) return null;
  let i = content.indexOf('{', idx);
  if (i === -1) return null;
  let open = 0;
  let start = i;
  let end = -1;
  for (; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') open++;
    else if (ch === '}') {
      open--;
      if (open === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  return content.substring(start, end);
}

const html = readFile(referenceHtml);
const centerStr = extractObject(html, 'const CENTER_ORIGIN');
const rawStr = extractBlock(html, 'const rawData');
const connStr = extractBlock(html, 'const connections');

if (!centerStr || !rawStr || !connStr) {
  console.error('Falha ao extrair CENTER_ORIGIN/rawData/connections de hero-siege-brasil/EtherFinal.html');
  process.exit(1);
}

let center, raw, conn;
try {
  const centerJsonStr = centerStr.replace(/([A-Za-z0-9_]+)\s*:/g, '"$1":');
  center = JSON.parse(centerJsonStr);
  raw = JSON.parse(rawStr);
  conn = JSON.parse(connStr);
} catch (e) {
  console.error('Falha ao parsear JSON extraído:', e.message);
  process.exit(1);
}

const ts = [
  'export const rawData: Array<{ x: number; y: number; name?: string; description?: string }> = ' + JSON.stringify(raw) + ';',
  '',
  'export const connections: Array<{ from: number; to: number }> = ' + JSON.stringify(conn) + ';',
  '',
  'export const CENTER_ORIGIN = ' + JSON.stringify(center) + ';',
  '',
  'export const backgroundImages: Array<{ id?: string; name?: string; image?: string; x: number; y: number; width?: number; height?: number; opacity?: number }> = [];',
  '',
].join('\n');

fs.writeFileSync(targetTs, ts, 'utf8');
console.log('EtherNodesData.ts atualizado com dados da referência.');
