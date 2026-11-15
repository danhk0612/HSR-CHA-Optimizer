# Windows 독립 실행 파일 (Portable EXE)

## 구현 구조

- **Electron 45.3.2**: 기존 HTML GUI를 자체 Chromium 창에서 표시
- **electron-builder 26.18.0**: Windows x64 **portable** EXE 생성 (설치 불필요)
- 일반 브라우저/Node CLI 모드는 이전처럼 사용 가능
- Electron 앱은 `file://` 로 로컬 화면을 직접 로드하며 **HTTP 서버나 AI API를 실행하지 않음**
- 최소 권한 IPC를 통해서만 파일 열기, 저장, 공개 게임 데이터 다운로드, 결과 내보내기 제공
- 사용자가 동의해 선택한 `Reliquary Archiver / HSR-Scanner` JSON 파일을 로컬 폴더에 가져오기

## EXE 빌드 — Windows PowerShell

저장소에서 Node.js 24 사용을 권장합니다.

```powershell
git pull --ff-only
npm install --no-audit --no-fund
npm run verify:local-win
```

완료되면 아래 파일이 생성됩니다.

`dist/HSR-CHA-Optimizer-0.1.5-portable.exe`

**0.1.4는 사용자 Windows 11에서 테스트 44건 통과, 20종 한국어 자료 동기화·실계정 검증·EXE 빌드 및 Electron 실행 확인까지 완료했습니다.** 0.1.5의 `verify:local-win`은 50건 단위 테스트 → 개인 PC 실계정 검증 → 새 EXE 빌드 → 숨겨진 Electron GUI 실행 확인을 순서대로 수행합니다. GitHub Actions에서는 개인 파일을 읽지 않는 `verify:win`을 사용합니다. 원본 게임 데이터와 계정 자료는 그대로 유지됩니다.

개발 상태의 Electron 창을 열려면 `npm run desktop` 을 사용합니다. 이때는 프로젝트의 기존 `.local-data/` 파일을 그대로 사용하므로 기존 데이터 재수집이 필요 없습니다.

## 빌드 컴퓨터 없이 GitHub Actions로 EXE 만들기

GitHub 저장소의 **Actions → Build Windows Portable EXE → Run workflow** 를 이용할 수 있습니다. 단위 테스트·Windows Portable 빌드·Electron GUI 스모크 테스트를 수행한 뒤 워크플로 실행 결과의 `HSR-CHA-Optimizer-Windows-Portable` artifact ZIP에서 EXE를 받을 수 있게 구성했습니다. 다운로드 가능 기간은 14일입니다. Actions가 사용 가능한 저장소 설정이 필요합니다.

## 첫 실행

Portable EXE를 실행하면 자체 Windows 창이 열립니다.

1. **게임 데이터 동기화**를 눌러 StarRailRes 한국어 인덱스 **20종**을 다운로드 (기본 16종 + 시뮬레이션 우주 4종)
2. **계정 JSON 가져오기**를 눌러 기존 `archive_output-...json` 또는 `.local-data/account/scanner.json` 선택
3. 캐릭터 선택 후 AI용 JSON / Markdown 생성 및 복사·파일 저장

앞의 두 작업은 둘 중 어느 것을 먼저 실행해도 되며, 이미 데이터를 가져왔다면 반복할 필요가 없습니다.

데이터는 실행 파일 내부에 넣지 않습니다. Windows 사용자 프로필 아래 Electron `app.getPath('userData')` 위치의 `.local-data/` 폴더에 별도로 저장됩니다(일반적으로 `%APPDATA%\hsr-cha-optimizer\.local-data\`). EXE를 교체해도 데이터가 유지되도록 구성했습니다.

## 0.1.4 확장 기능

- 화면에서 직접 확인한 능력치는 하단 '캐릭터 최종 능력치 보완'에 수동 입력합니다.
- 사용자가 다운받은 MiHoMo Parsed v2 공개 전시 JSON은 **파일 선택**으로만 가져옵니다. 외부 UID 호출은 일어나지 않습니다.
- `scanner.json`과 별도로 `character-stats-<계정 UID 해시>.json`에 수동 입력/공개 전시 능력치를 저장합니다. 같은 게임 캐릭터라도 출처별로 분리합니다.
- 저장된 공개 전시 파일은 **로컬 스캐너의 UID와 파일의 UID가 일치할 때만** 수입합니다. 전시 파일에서 플레이어 UID·닉네임을 새 능력치 저장 자료나 AI 내보내기에 복사하지 않습니다.
- 시뮬레이션 우주 데이터 검색을 이용하려면 **게임 데이터 동기화**를 다시 실행해 20종 자료를 확보하세요. 기존 EXE 사용자 데이터는 버전 업데이트 시 유지됩니다.

## 개인정보 및 주의사항

- GitHub 저장소와 Portable EXE에는 **계정 UID, 유물, 광추, 재료 등 개인 데이터를 포함하지 않음**
- 개인 UID는 가져온 로컬 JSON에 보관하지만 **AI 출력 파일에는 포함하지 않음**
- 게임 공개 데이터 동기화만 외부 GitHub 서버에서 파일을 받음. 계정 정보는 보내지 않음
- Reliquary Archiver 자체는 별도 프로그램으로 실행하며 본 프로그램에 패킷 수집기 내장·자동 실행 없음
- 코드 서명용 인증서가 없는 개인 빌드는 **미서명 EXE**입니다. Windows SmartScreen/보안 경고가 발생할 수 있고, 공식 Microsoft 신뢰 인증이 부여된 파일이 아닙니다
- Portable EXE는 압축을 풀어 실행하는 형식이므로 처음 시작하는 데 약간의 시간이 걸릴 수 있습니다

## 현재 남은 작업

- Windows 0.1.5 EXE 빌드 및 게임 데이터 변경 내역 화면 실제 실행 확인 (`npm run verify:local-win`)
- 후보 필터는 세트·부위·주옵션·현재 부옵션을 AND/OR 조합해서 적용하며, 후보 개수 제한은 필터 적용 후에 적용
- **별도 프로그램 아이콘 SVG 적용됨** (`build/icon.svg`, electron-builder 변환); 미서명 EXE 유지
- 설치형 배포는 현재 범위에서 제외 (Portable 우선)
- 공개 전시 기반 일부 캐릭터의 실제 최종 능력치 도입 여부와 데이터 출처 검증 (docs/FINAL_STATS.md)
