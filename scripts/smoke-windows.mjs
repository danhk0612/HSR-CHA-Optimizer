import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.platform !== 'win32') throw new Error('Windows 전용 실행 테스트입니다.');
const exe = resolve('dist', 'win-unpacked', 'HSR-CHA-Optimizer.exe');
await access(exe);
const child = spawn(exe, ['--smoke-test'], {
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '';
const append = chunk => {
  output += String(chunk);
  if (output.length > 12000) output = output.slice(-12000);
};
child.stdout.on('data', append);
child.stderr.on('data', append);
const status = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    child.kill();
    reject(new Error('Electron 상호작용 검사 시간 초과 (45초)\n' + output));
  }, 45000);
  child.on('error', error => { clearTimeout(timeout); reject(error); });
  child.on('close', (code, signal) => {
    clearTimeout(timeout);
    if (code === 0) resolve(code);
    else reject(new Error('Electron GUI 상호작용 검사 실패: 종료 코드 ' +
      code + ', signal ' + signal + '\n' + output));
  });
});
console.log('Windows Electron GUI 실제 조작 확인 완료 (종료 코드 ' + status + ')');
if (output.trim()) console.log(output.trim());
