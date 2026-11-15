# HSR-CHA-Optimizer

붕괴: 스타레일(Honkai: Star Rail)의 **게임 데이터 및 개인 육성 정보를 수집·조회·내보내기** 위한 개인용 Windows 도구 프로젝트입니다.

> 이 프로그램은 게임 데이터를 AI에 전달하기 좋게 정리하지만, AI API 호출·자동 판단·자동 육성 추천은 수행하지 않습니다. AI 분석은 사용자가 내보낸 자료를 직접 전달하여 진행합니다.

## 범위

- **게임 데이터:** 캐릭터, 성혼, 행적, 스킬, 광추, 유물, 재료 등 공개 데이터. 추후 적·전투 콘텐츠 등으로 확장합니다.
- **개인 데이터:** 보유 캐릭터, 레벨·행적, 성혼, 장착/미장착 유물과 광추는 수집·출력 구현. 실제 최종 능력치는 미수집.
- **선택 데이터:** 성옥·티켓·육성 재료 보유량은 수집·출력 구현. 워프 천장 및 확정 상태는 미수집.
- **출력:** 관련 자료를 모아 Markdown/JSON으로 저장하거나 복사. AI 연결은 하지 않습니다.

## 현재 상태

- [x] 요구사항 및 개발 단계 정리
- [x] StarRailRes 한국어 데이터 동기화 CLI 초안
- [x] 단일 캐릭터 공개 데이터 Markdown/JSON 내보내기 CLI 초안
- [x] 로컬 브라우저 GUI 및 Electron Portable EXE 실사용 검증
- [x] Reliquary Archiver 0.20.0 실제 JSON 가져오기·기존 전체 출력 검증
- [x] Windows Portable EXE 빌드 설정·첫 실행 데이터 동기화/가져오기 GUI 반영
- [x] Windows Portable EXE 0.1.0 및 0.1.1 빌드 성공 (사용자 로그)
- [x] 0.1.1 자체 아이콘 포함 EXE 빌드·자동 실행 검증 성공 및 실제 사용 흐름 확인 (사용자 보고)
- [x] 0.1.2 실제 계정 26건 단위 테스트·주옵션 수치 6/6 검증·Windows 빌드 성공
- [x] 0.1.3 세트·부위·주옵션·부옵션 다중 선택 복합 필터 (Windows 33/33 통과)
- [x] 0.1.4 오프라인 MiHoMo Parsed JSON·수동 능력치 보완 및 한국어 20종 동기화 (Windows 44/44 통과)
- [x] 0.1.5 동기화 전후 게임 데이터의 추가·삭제·내용 변경 비교·로컬 이력 기록/GUI 표시 (Windows 검증 대기)
- [x] 시뮬레이션 우주 한국어 4종 확장 (총 20종) 및 GUI 공개 자료 검색/내보내기
- [x] 0.1.5 Windows 50건 단위 테스트·게임 데이터 변경 없음·EXE 빌드/실행 성공
- [x] 0.1.6 화면 능력치 vs MiHoMo 계산값 비교·워프 6종 수동 기록 (Windows 검증 대기)
- [ ] 공개 전시 기반 최종 능력치 부분 수집 검토 (전체 보유 계정은 대체 불가)
- [x] AI용 간결 출력·미장착 유물 후보 선택·재료 한국어화 (실제 파일 기반 통합 검증)

### 개발용 실행

기존 CLI는 Node.js **20 이상**에서 별도 설치 라이브러리 없이 실행할 수 있습니다. Electron GUI 개발·EXE 빌드에는 `npm install`로 개발 의존성을 설치합니다.

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

### Windows 독립형 실행 프로그램

일반 브라우저와 Node.js 없이 GUI를 실행하는 **Electron Portable EXE** 빌드 구성을 추가했습니다.

```powershell
npm install --no-audit --no-fund
npm run verify:local-win
```

예상 산출물: `dist/HSR-CHA-Optimizer-0.1.6-portable.exe`. 0.1.5는 Windows에서 50건 테스트·20종 변경 없음 확인·실제 계정 검증·EXE 빌드 및 Electron 실행 검사를 통과했습니다. 0.1.6은 수동 능력치 비교와 워프 수동 기록을 추가했으므로 통합 검증이 필요합니다. `verify:local-win`은 기존 `.local-data`의 실제 계정 검증까지 포함합니다. 일반 CI에서 사용하는 `verify:win`은 개인정보 파일이 필요하지 않습니다.

첫 실행 시 프로그램에서 **게임 데이터 동기화 → 계정 JSON 가져오기**를 누르면 됩니다. 개발용 `npm run desktop`은 기존 `.local-data`를 재사용하며, 패키징한 EXE는 Windows 사용자 데이터 폴더에 따로 저장합니다. 개인 자료는 EXE에 포함되지 않습니다.

자세한 내용: [Windows EXE 빌드·첫 실행](docs/WINDOWS_EXE.md), [최종 능력치 확보 검토](docs/FINAL_STATS.md).

### 캐릭터 최종 능력치 보완 및 시뮬레이션 우주 검색 (0.1.4)

**수동 화면 능력치:** Windows EXE 하단의 **캐릭터 최종 능력치 보완**에서 캐릭터 선택 후 HP·공격력·방어력·속도·치명타 확률·치명타 피해 등의 실측값을 입력해 저장/삭제합니다. 퍼센트는 게임 화면에 표시된 숫자 그대로(65.3% → 65.3). 비워둔 필드는 알 수 없는 값으로 유지합니다.

**MiHoMo Parsed JSON:** 사용자가 별도로 저장한 공개 전시 v2 JSON을 **저장된 MiHoMo JSON 가져오기**에서 로컬 파일로 선택합니다. 스캐너와 같은 UID인지 확인하고 보유 캐릭터만 연결합니다. UID는 외부 서버로 보내지 않으며 가져온 능력치 저장 파일/AI 출력에 복사하지 않습니다. 공개 전시 캐릭터만 포함하므로 전체 계정 자동 보완은 불가합니다. 화면 수동 입력은 관측값, 공개 전시는 계산/파싱값으로 별도 표시됩니다. 상세 범위는 [최종 능력치 검토](docs/FINAL_STATS.md).

**공개 자료 검색:** StarRailRes 원본에서 확인된 시뮬레이션 우주 **축복·기물·사건·구역** 4종을 추가했습니다. 기존 16종과 합쳐 **20종 게임 데이터 동기화**가 필요하며, GUI의 **공개 게임 자료 검색**에서 한국어 이름/ID로 검색해 JSON·Markdown으로 내보낼 수 있습니다. 오래된 16종 자료만 있는 경우 EXE에서 **게임 데이터 동기화**를 다시 실행해야 합니다. 이 기능은 계정 데이터와 별도이며 AI 평가·추천을 하지 않습니다.

### 화면 능력치 대조와 워프 천장 수동 보완 (0.1.6)

- **화면 능력치 대조:** '캐릭터 최종 능력치 보완'에서 게임 화면에 직접 입력한 값과 MiHoMo Parsed JSON이 **모두 있는 캐릭터**를 선택하면 비교 표가 나타납니다. MiHoMo 기초값 `attributes` + 증가값 `additions`를 참고용으로 계산하고, 퍼센트를 화면 단위로 변환한 후 수동값과 차이를 표시합니다. 누락·단위 불일치 항목은 '비교 불가'로 남깁니다. 장비/수집 시점 차이가 있을 수 있으며 자동 판정·자동 보정은 하지 않습니다. AI 내보내기에도 `characterSheet.comparison`을 포함합니다.
- **워프 천장 수동 기록:** 하단의 '워프 천장 수동 기록'에서 캐릭터 이벤트·광추 이벤트·상시·초보자·컬래버 캐릭터·컬래버 광추 각각의 실제 확인한 스택을 입력합니다. 픽업 확정 여부는 해당되는 워프에서만 '픽업 확정/확정 아님/미확인'으로 기록합니다. **자동 워프 내역 조회나 계정 네트워크 호출은 없습니다.**
- **저장·출력:** 워프 수동 기록은 `.local-data/account/warp-state-<계정 해시>.json`에 별도로 보관합니다. AI 자료에서는 '성옥·티켓·재료 수량 포함' 옵션을 선택했을 때 `resources.manualWarpPity`에 기록 시각·출처와 함께 추가됩니다. 후속 가챠를 하면 사용자가 직접 다시 갱신해야 합니다.
- **적·보스 범위:** [적/보스 소스 및 워프 기록 조사](docs/ENEMY_AND_WARP_SOURCES.md)에 후보와 한계를 정리했습니다. 한국어 인덱스·출처·정식 버전이 검증될 때까지 외부 적 데이터를 기존 20종 동기화에 섞지 않습니다.

**0.1.6은 게임 데이터 동기화 목록을 변경하지 않았습니다.** 이미 0.1.5에서 20종을 동기화했다면 Windows 검증 전에 다시 동기화할 필요가 없습니다.

### 공개 게임 데이터 변경 내역 (0.1.5)

`게임 데이터 동기화`가 성공하면 **이전 성공 스냅샷과 새로 내려받은 20종 게임 데이터를 ID별로 비교**합니다. 테이블마다 신규·삭제·내용 변경 ID 수를 집계하며, 같은 게임 버전에서 자료가 수정돼도 감지합니다. 객체 속성의 순서만 바뀐 경우 변경으로 잘못 판단하지 않습니다.

- **초기 동기화:** 이전 자료가 없다면 기준 스냅샷만 기록하고 모든 자료를 '새로 추가됨'으로 계산하지 않습니다.
- **기존 데이터가 있을 때:** 비교한 이전 버전·현재 버전, 테이블별 항목 수와 추가/삭제/변경 건수를 기록합니다.
- **화면 확인:** GUI 상단의 **게임 데이터 변경 내역**을 펼치면 영향을 받은 테이블을 확인할 수 있습니다.
- **파일 보관:** `.local-data/game/changes/latest.json`과 `changes/<동기화 시각>.json`에 결과를 저장합니다. 개인 계정 및 UID는 이 파일에 포함되지 않습니다.
- **실패한 동기화:** 새 자료 다운로드에 실패하면 기존 성공 스냅샷과 마지막 변경 이력을 유지합니다.

0.1.5의 변경 기록은 **버전 업데이트 후 처음으로 동기화하는 시점부터** 생성됩니다. 이미 0.1.4로 한 동기화의 과거 변경 내역을 소급 생성하지는 않습니다.

### AI용 간결 출력 및 로컬 화면

**현재 데이터가 이미 준비되어 있다면 다시 스캔하거나 `npm run sync`를 실행할 필요가 없습니다.**

```powershell
# 테스트 58건 + 실제 로컬 계정의 통합 출력 검증
npm run verify

# 로컬 브라우저 화면 실행 (Ctrl+C로 종료)
npm run gui
# 브라우저에서 http://127.0.0.1:8765 접속
```

`npm run gui`는 기존 로컬 브라우저 화면(127.0.0.1)입니다. `npm run desktop`은 Electron 창이며, `npm run dist:win`으로 Windows Portable EXE를 빌드하도록 구성했습니다. 0.1.5까지 Windows 빌드 검증을 완료했습니다. 캐릭터 다중 선택, 검색, 유물 후보 세부 필터·최대 개수, 재료 포함 여부, Markdown/JSON 미리보기·복사·저장을 지원합니다.

CLI만 사용할 때:

```powershell
# 아케론의 실제 육성 상태와 장착 장비만 간결하게
node src/export-ai.mjs --character "아케론" --json

# 미장착 유물 중 장착 세트와 동일한 5성만, 재료 포함
node src/export-ai.mjs --character "아케론" --candidates equipped-sets --min-rarity 5 --resources --json

# 미장착 유물 전체 (용량 증가)
node src/export-ai.mjs --character "아케론" --candidates all --json
```

- `--character`는 여러 번 지정 가능하며, 기본값 없이 **선택한 캐릭터만** 내보냅니다.
- `--candidates` 기본값은 `none`; `equipped-sets`는 **선택 캐릭터가 장착한 세트와 같은 미장착 유물**만, `all`은 모든 미장착 유물을 포함합니다.
- 필요하면 `--candidate-set "유물 세트 이름"`, `--min-rarity 5`, `--limit 100`으로 범위를 좁힐 수 있습니다. 후보의 우열·점수는 계산하지 않습니다.
- `--resources`는 성옥과 재료/티켓 보유량을 포함합니다. 재료 ID를 한국어 원본에 연결하고 매칭되지 않으면 영어 이름과 미매칭 표시를 남깁니다.
- 출력에 계정 UID는 포함되지 않습니다. 다만 장비 고유 식별자는 후보 식별을 위해 유지합니다.
- **실제 최종 캐릭터 능력치**, 전투 중 버프 수치, 워프 천장/확정 상태는 확보되지 않았으며 계산값으로 대체하지 않습니다.
- **유물 주옵션**은 원본 키 외에 `mainstatDetail`로 한국어 이름·강화 단계별 산출 숫자·단위·출처를 제공합니다. 원본 게임 데이터의 `base + step × 유물 레벨`을 이용하며, 게임에서 직접 관측한 캐릭터의 최종 능력치는 아닙니다. 정확한 유물 원본을 구분할 수 없을 때는 `mainstatDetail: null`로 남깁니다.
- **유물 부옵션**은 원본 `key`·`value`·`count`·`step`을 유지하고, 한국어 `name`·표시용 `displayValue`·`unit`를 추가합니다. 원본 수치의 반올림이나 변조는 하지 않습니다.
- 개척자 이름은 원본 `{NICKNAME}` 대신 **개척자 (운명의 길 · 속성)**으로 표시합니다. 실제 계정 닉네임은 추측하지 않습니다. 주요 행적의 원본 설명에는 `unlocked` 상태를 함께 표시합니다.
- **GUI 유물 후보 세부 필터 (0.1.3):** 미장착 후보 모드를 선택하면 유물 세트·부위·주옵션·부옵션을 펼쳐 여러 항목에 체크할 수 있습니다. 같은 범주의 여러 선택지는 **OR**, 다른 범주끼리는 **AND**로 조합합니다. 미선택 범주는 제한하지 않습니다. `장착 세트와 동일` 범위는 필터보다 먼저 적용하며, 필터 결과에 기존 최대 포함 개수를 적용합니다.
- **부옵션 필터:** 현재 얻은 `substats`의 원본 키를 기준으로 검사하며, `preview_substats`에만 있는 속성은 일치로 처리하지 않습니다. 필터 조건 및 `matching`(조건 일치 전체 수) / `included`(실제 내보낸 수)는 JSON·Markdown에 함께 수록됩니다. 자동 평가·추천·유물 순위는 계산하지 않습니다.
- 후보를 **미장착 유물 전체**로 설정하면 수천 개의 유물이 포함되어 수 MB 수준까지 커질 수 있습니다. AI에 전달할 때는 필요한 후보 범위만 선택하는 편이 효율적입니다. GUI의 **후보 최대 포함 개수**는 비워두면 전체이며, 지정하면 원본 순서 앞쪽부터 포함합니다(점수·순위 아님). 설정을 변경하면 이전 출력의 복사·저장은 비활성화됩니다.
- AI용 간결 출력은 기존 `export:account`의 전체 원본 출력과 **별도 기능**입니다. 기존 출력은 유지됩니다.

## 문서

- [확정 요구사항](REQUIREMENTS.md)
- [개발 계획](PLAN.md)
- [데이터 소스/주의사항](docs/DATA_SOURCES.md)
- [Windows Portable EXE 빌드](docs/WINDOWS_EXE.md)
- [실제 최종 능력치 확보 검토](docs/FINAL_STATS.md)

## 저작권·주의사항

게임명, 캐릭터명 및 게임 리소스의 권리는 각 권리자에게 있습니다. 이 저장소에는 게임 데이터 및 사용자의 개인 계정 데이터를 포함하지 않습니다. 데이터 수집 도구와 외부 데이터의 라이선스 및 배포 조건은 별도 검토가 필요합니다. **프로그램 라이선스는 배포 여부 확정 전까지 지정하지 않습니다.**
