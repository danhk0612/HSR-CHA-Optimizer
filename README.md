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
- [x] Reliquary Archiver·HSR-Scanner v4 파일 가져오기·계정 자료 출력 CLI 초안 (실제 JSON 검증 전)
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

**주력 경로:** [Reliquary Archiver](https://github.com/IceDynamix/reliquary-archiver)에서 수동 내보내기한 `archive_output-...json` 파일을 가져옵니다. 게임을 한국어로 사용해도 되며, 우리 프로그램은 패킷 수집을 직접 수행하지 않습니다.

1. [공식 GitHub Releases](https://github.com/IceDynamix/reliquary-archiver/releases)에서 Windows 빌드를 확인합니다.
2. Reliquary Archiver README의 순서대로 게임 실행 전 로그인 화면에서 Archiver를 실행해 데이터를 캡처합니다.
3. `Connected!` 확인 후 **Manual Import/Download** 방식으로 JSON을 저장합니다.
4. 아래 명령으로 로컬 파일을 가져옵니다.

```powershell
# 먼저 npm run sync를 1회 이상 실행합니다.
npm run import:archive -- "D:\\HSR\\archive_output.json"

# 전체 스캔 데이터 출력(장착·미장착 유물·광추 포함)
cmd /c 'node src\\export-account.mjs --json > .local-data\\account\\all-account.json'

# 선택한 아케론과 아케론에게 장착된 장비만 출력
cmd /c 'node src\\export-account.mjs --character "아케론" --json > .local-data\\account\\acheron-account.json'

# Markdown 출력
cmd /c 'node src\\export-account.mjs --character "아케론" > .local-data\\account\\acheron-account.md'

npm test
```

- `import:archive`와 기존 `import:scanner`는 동일한 가져오기 코드로 작동합니다. [HSR-Scanner](https://github.com/kel-z/HSR-Scanner)의 JSON도 계속 지원합니다.
- 지원 스냅샷: `source="reliquary_archiver"` 또는 `"HSR-Scanner"`, `version=4`.
- `--character`가 없으면 미장착 장비까지 포함해 전체 스캔 결과를 출력합니다. 여러 캐릭터는 옵션을 반복합니다.
- `skills`, `traces`, `eidolon`, `affinitive_eidolons`, `memosprite`, `elation` 등은 원문 그대로 보존합니다.
- Reliquary Archiver의 `gacha`(성옥·오래된 꿈)와 `materials`(재료별 보유량)는 수집된 경우 내보내기에 포함됩니다. **천장 스택·확정 상태는 정적 JSON에 포함되지 않습니다.**
- 원본은 `.local-data/account/scanner.json`에 저장됩니다. UID는 로컬 원본에 남지만, AI 전달용 출력에서 제외합니다.
- 일부 수치가 출력에 없으면 보유량 0으로 간주하지 않습니다. 스캔 당시 누락 또는 불완전한 데이터일 수 있습니다.
- 개인정보 포함 자료는 반드시 `.local-data/account/`나 `exports/`에 저장하고 Git에 커밋하지 마세요.

**주의:** Reliquary Archiver는 비공식 게임 네트워크 패킷 분석 도구입니다. 직접적인 사용 제재 사례는 공개 검색에서 확인하지 못했지만, HoYoverse의 공식 허가 또는 제재 면책이 있는 것은 아닙니다. 개인 사용도 예외가 되지 않습니다. 이 프로젝트는 Archiver 실행을 자동화하거나 패킷을 직접 분석하지 않고, 사용자 동의 하에 추출된 JSON만 읽습니다.

## 문서

- [확정 요구사항](REQUIREMENTS.md)
- [개발 계획](PLAN.md)
- [데이터 소스/주의사항](docs/DATA_SOURCES.md)

## 저작권·주의사항

게임명, 캐릭터명 및 게임 리소스의 권리는 각 권리자에게 있습니다. 이 저장소에는 게임 데이터 및 사용자의 개인 계정 데이터를 포함하지 않습니다. 데이터 수집 도구와 외부 데이터의 라이선스 및 배포 조건은 별도 검토가 필요합니다. **프로그램 라이선스는 배포 여부 확정 전까지 지정하지 않습니다.**
