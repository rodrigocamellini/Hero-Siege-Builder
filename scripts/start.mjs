import { spawn } from 'node:child_process';
import path from 'node:path';

const port = Number(process.env.PORT ?? '3000');
const hostname = process.env.HOST ?? '0.0.0.0';

const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

console.log(`Starting Next.js on ${hostname}:${port}`);

const child = spawn(process.execPath, [nextBin, 'start', '-H', hostname, '-p', String(port)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
