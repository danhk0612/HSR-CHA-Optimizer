import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

if (process.platform !== 'win32') throw new Error('Windows 전용 검증입니다.');
const exe = resolve('dist', 'win-unpacked', 'HSR-CHA-Optimizer.exe');
await access(exe);
const tempRoot = await mkdtemp(join(tmpdir(), 'hsr-cha-real-'));
const child = spawn(exe, ['--smoke-real-account', '--smoke-temp-dir=' + tempRoot], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let output = '';
const append = chunk => {
  output += String(chunk);
  if (output.length > 12000) output = output.slice(-12000);
};
child.stdout.on('data', append);
child.stderr.on('data', append);
let code;
try {
  code = await new Promise((done, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('실계정 Electron UI 검증 시간 초과\n' + output));
    }, 90000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', (exit, signal) => {
      clearTimeout(timeout);
      if (exit === 0) done(exit);
      else reject(new Error('실계정 Electron UI 검증 실패: 종료 코드 ' +
        exit + ', signal ' + signal + '\n' + output));
    });
  });
} finally {
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
console.log('Windows 실계정 Electron GUI 선택·3종 파일 출력 검사 통과 (종료 코드 ' + code + ')');
if (output.trim()) console.log(output.trim());
