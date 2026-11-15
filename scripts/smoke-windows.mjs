import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.platform !== 'win32') throw new Error('Windows 전용 실행 테스트입니다.');
const exe = resolve('dist', 'win-unpacked', 'HSR-CHA-Optimizer.exe');
await access(exe);
const child = spawn(exe, ['--smoke-test'], { stdio: 'ignore', windowsHide: true });
const status = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    child.kill();
    reject(new Error('Electron 실행 검증 시간 초과 (45초)'));
  }, 45000);
  child.on('error', error => { clearTimeout(timeout); reject(error); });
  child.on('exit', (code, signal) => {
    clearTimeout(timeout);
    if (code === 0) resolve(code);
    else reject(new Error('Electron GUI 실행 검증 실패: 종료 코드 ' + code + ', signal ' + signal));
  });
});
console.log('Windows Electron GUI 실제 구동 확인 완료 (종료 코드 ' + status + ')');
