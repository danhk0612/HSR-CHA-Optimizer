# HSR-CHA-Optimizer

붕괴: 스타레일(Honkai: Star Rail)의 **게임 데이터 및 개인 육성 정보를 수집·조회·내보내기** 위한 개인용 Windows 도구 프로젝트입니다.

> 이 프로그램은 게임 데이터를 AI에 전달하기 좋게 정리하지만, AI API 호출·자동 판단·자동 육성 추천은 수행하지 않습니다. AI 분석은 사용자가 내보낸 자료를 직접 전달하여 진행합니다.

## 범위

- **게임 데이터:** 캐릭터, 성혼, 행적, 스킬, 광추, 유물, 재료 등 공개 데이터. 추후 적·전투 콘텐츠 등으로 확장합니다.
- **개인 데이터(후속 단계):** 보유 캐릭터, 레벨·행적, 성혼, 장착/미장착 유물과 광추, 실제 능력치.
- **선택 데이터(후속 단계):** 성옥, 티켓, 천장 및 육성 재료 보유량.
- **출력:** 관련 자료를 모아 Markdown/JSON으로 저장하거나 복사. AI 연결은 하지 않습니다.

## 현재 상태

- [x] 요구사항 및 개발 단계 정리
- [x] StarRailRes 한국어 데이터 동기화 CLI 초안
- [x] 단일 캐릭터 공개 데이터 Markdown/JSON 내보내기 CLI 초안
- [ ] Windows GUI
- [x] HSR-Scanner v4 파일 가져오기·계정 자료 출력 CLI 초안 (Windows 실사용 검증 전)
- [ ] UID 공개 전시 연동 및 Windows GUI
- [ ] 내보내기 범위 선택 및 관련 데이터 결합

### 개발용 실행

Node.js **20 이상**을 준비하고 저장소 루트에서 실행합니다. 외부 npm 의존성은 없습니다.

```powershell
npm run sync
npm run export:character -- "아케론"
npm run export:character -- "아케론" --json
npm run export:character -- "아케론" --light-cone "<광추 이름>" --relic-set "<유물 세트 이름>" --json
npm test
```

광추는 `--light-cone "이름 또는 ID"`, 유물 세트는 `--relic-set "이름 또는 ID"`로 명시적으로 선택합니다. 옵션은 반복 지정할 수 있으며, 지정하지 않으면 기존 캐릭터 자료만 출력됩니다. 이 옵션은 **게임 원본 장비 데이터**를 붙이는 기능으로, 실제 계정에 장착된 장비를 자동 판별하지 않습니다.

동기화 결과는 `.local-data/game/`에 저장되며 Git에 업로드되지 않습니다. `export:character`는 현재 공개 게임 자료만 출력하며 개인 장비 정보는 아직 포함하지 않습니다.

### 개인 계정 데이터 가져오기 (초안)

HSR-Scanner (https://github.com/kel-z/HSR-Scanner)에서 생성한 **출력 형식 version 4 JSON**을 사용합니다. 스캐너 실행 및 게임 조작은 본 프로그램에서 수행하지 않습니다.

```powershell
# 먼저 npm run sync 실행
npm run import:scanner -- "D:\\HSRScanner\\scan.json"

# 전체 보유 캐릭터·광추·유물: PowerShell 5.1에서는 cmd의 UTF-8 리다이렉션 이용
cmd /c 'node src\\export-account.mjs --json > .local-data\\account\\all-account.json'

# 장착 장비가 있는 아케론만: 선택한 캐릭터의 장착 장비만 포함
cmd /c 'node src\\export-account.mjs --character "아케론" --json > .local-data\\account\\acheron-account.json'

# Markdown 출력
cmd /c 'node src\\export-account.mjs --character "아케론" > .local-data\\account\\acheron-account.md'

npm test
```

- 별도의 `--character` 지정 없이 내보내면 미장착 유물·광추를 포함한 전체 스캔 결과를 출력합니다. 여러 캐릭터는 `--character` 옵션을 반복할 수 있습니다.
- 스캐너의 `skills`, `traces`, `eidolon`, `affinitive_eidolons`, `memosprite`, `elation` 등 필드는 보존합니다.
- 공개 게임 데이터의 한국어 이름, 광추 중첩 효과, 유물 세트 정의를 ID로 연결합니다.
- 원본 스캔 파일은 `.local-data/account/scanner.json`으로 저장됩니다. **UID는 로컬 원본에 남지만, AI 전달용 출력에서는 제외합니다.**
- 스캐너가 제공하지 않는 전투 외 실제 능력치, 성옥·티켓·육성 재료/천장 수치는 채워 넣지 않습니다.
- 스캐너의 선택한 검사 범위·레벨 필터·OCR 인식 상태에 따라 실제 보유 목록이 누락될 수 있습니다.
- AI 공유용 출력 파일은 `.local-data/account/` 또는 `exports/`에 저장해 Git 커밋에서 제외하는 것을 권장합니다. 개인 파일을 저장소 루트에 두고 커밋하지 마세요.

## 문서

- [확정 요구사항](REQUIREMENTS.md)
- [개발 계획](PLAN.md)
- [데이터 소스/주의사항](docs/DATA_SOURCES.md)

## 저작권·주의사항

게임명, 캐릭터명 및 게임 리소스의 권리는 각 권리자에게 있습니다. 이 저장소에는 게임 데이터 및 사용자의 개인 계정 데이터를 포함하지 않습니다. 데이터 수집 도구와 외부 데이터의 라이선스 및 배포 조건은 별도 검토가 필요합니다. **프로그램 라이선스는 배포 여부 확정 전까지 지정하지 않습니다.**
