# 데이터 출처 및 수집 범위

2026-11-15 기준 확인한 공개 저장소 구조.

## 공개 게임 데이터

**StarRailRes**: https://github.com/Mar-7th/StarRailRes

- 기본 브랜치: `master`
- 버전 메타데이터: `info.json` (`version`, `folder`, `timestamp`)
- 한국어 인덱스: `{folder}/kr/*.json`
- 현재 확인된 버전: 4.7.0, `folder=index_min`
- 라이선스: AGPL-3.0. 게임 이미지·텍스트 등 개별 권리도 별도 검토 필요.

README에서 확인한 16종의 인덱스:

```
paths.json
elements.json
properties.json
characters.json
character_ranks.json
character_skills.json
character_skill_trees.json
character_promotions.json
light_cones.json
light_cone_ranks.json
light_cone_promotions.json
relics.json
relic_sets.json
relic_main_affixes.json
relic_sub_affixes.json
items.json
```

0.1.4부터 위 16종과 아래 시뮬레이션 우주 인덱스 4종을 합쳐 **총 20종을 다운로드**합니다. 원본 전체 게임 파일이나 이미지·음성·임무 등을 모두 수집하는 단계는 아닙니다. 실물 게임 리소스는 저장소에 커밋하지 않습니다.

### 0.1.4 공개 게임 데이터 확장: 시뮬레이션 우주

StarRailRes `index_min/kr` 및 `index_new/kr`에서 존재를 확인한 4종만 추가합니다.

- `simulated_blessings.json`: 축복명/효과 원문 및 강화 효과
- `simulated_curios.json`: 기물 이름/효과 및 배경 설명
- `simulated_events.json`: 사건명/유형/이미지 경로 (없는 효과 설명을 만들어내지 않음)
- `simulated_blocks.json`: 구역명/설명

프로그램 내 '공개 게임 자료 검색'에서 한국어 이름/ID 검색 후 JSON·Markdown으로 출력합니다. 적·보스 및 전투 콘텐츠 파일(`enemies.json`, `monsters.json`)은 해당 인덱스 경로에서 확인되지 않았으므로 이번 범위에 넣지 않았습니다. 전체 게임 데이터에 대한 추가 소스 확보는 후속 과제입니다.

### 0.1.5 동기화 스냅샷 비교

최초 자료 동기화부터 로컬 자료의 변경 이력을 기록합니다. `current.json`에서 직전 성공 스냅샷을 확인하고, 새 20개 JSON 파일이 모두 다운로드·파싱된 뒤에 항목 ID 기준으로 비교합니다.

- **추가·삭제·내용 수정** 개수는 테이블별로 구분합니다. 속성 순서 차이는 실제 데이터 변경으로 세지 않습니다.
- **게임 버전이 같아도** 공식 자료가 갱신된 경우 차이를 비교합니다.
- 이전 파일이 없을 때는 기준선(`initial`)으로 구분하며, 전체 파일을 신규 변경으로 오인하지 않습니다.
- `.local-data/game/changes/latest.json`과 `changes/<동기화 시각>.json`에 버전·동기화 시각·테이블별 합계를 기록합니다. 개인정보는 포함하지 않습니다.
- 비교는 **다운로드 성공 후** 수행하며, 다운로드 실패 시 이전 데이터 및 이력은 그대로 남깁니다.
- 기존 0.1.4 동기화에 대한 과거 변경 이력은 소급 생성하지 않습니다.

### 0.1.7 선택형 적·보스 데이터

- [DimbreathBot/TurnBasedGameData 정식 릴리스 4.7.0 커밋](https://github.com/DimbreathBot/TurnBasedGameData/commit/dad9155eb00fdeda31fb8456507c53590d49071f)에서 `MonsterTemplateConfig.json` 665개, `TextMapMainKR.json`, `TextMapKR_0.json`, `TextMapKR_1.json` 경로를 확인했습니다.
- 적 원본의 `MonsterTemplateID`·`MonsterName.Hash`·`Rank`·기초 HP/공격/방어/속도 및 일부 저항의 **실제 원본 필드만** 사용합니다. 이름 해시 64비트 정밀도를 문자열로 보존하고, 한국어 이름 연결에 실패하면 `name:null`을 기록합니다.
- **기존 StarRailRes 20종 동기화에는 추가하지 않습니다.** 별도 사용자가 선택한 다운로드로 준비한 변환 인덱스를 `.local-data/game/enemies/index.json`에 저장합니다.
- 적의 약점, 원소별 저항 및 스킬 상세, 전투 레벨/콘텐츠 보정값은 아직 확보·검증하지 않아 출력하지 않습니다. 다운로드 완료 후 실제 이름 연결률 확인이 필요합니다.

## 개인 계정 — 후속 단계

- 공개 UID/전시 캐릭터 데이터: 노출한 캐릭터만 조회 가능하며 전체 인벤토리 대체 불가.
- 외부 파일 가져오기: https://github.com/kel-z/HSR-Scanner (스캐너 내보내기 JSON)
- 미장착 장비, 개인 재화/재료의 자동 획득은 검증 후 범위 확정.
- 스캐너의 게임 화면 조작이나 비공식 네트워크 패킷 캡처 기능은 프로그램에 기본 내장하지 않음.

### 구현된 스캐너 가져오기 초안

- 형식 기준: HSR-Scanner README의 `source="HSR-Scanner"`, `version=4` JSON 출력 예시.
- `characters`, `light_cones`, `relics` 배열을 보존하고 게임 원본 ID와 매칭.
- `location`은 장착 캐릭터 ID, 유물 `set_id`는 원본 유물 세트 ID로 사용.
- 캐릭터의 `skills`, `traces`, `eidolon`, `affinitive_eidolons`, `memosprite`, `elation`을 원문 보존.
- 유물 `substats`, `preview_substats`, `mainstat`, 장착/미장착 구분 원문 보존.
- UID는 로컬 원본에만 저장하고 AI용 내보내기 출력에는 넣지 않음.
- 실제 능력치, 재화, 천장 정보는 스캐너 JSON 예시에 없으므로 임의로 생성하지 않음.
- 계정에 스캔되지 않은 캐릭터나 장비를 '미보유'로 추론하지 않음.
- Windows에서 실제 게임 스캔 파일 입력 및 스캐너 업데이트와의 호환성 검증이 필요.

### Reliquary Archiver (주력 개인 데이터 입력)

- 공식 GitHub: https://github.com/IceDynamix/reliquary-archiver
- 소스 모델: `src/export/fribbels/models.rs`, `src/export/fribbels/exporter.rs`
- 확인된 출력: `source="reliquary_archiver"`, `version=4`.
- `characters`, `light_cones`, `relics` 구조는 기존 Fribbels/Kel-Z 계열과 호환되며 장비 `id`, `set_id`, `location`으로 연결.
- `gacha`에 `stellar_jade`, `oneric_shards` 수치가 포함될 수 있고, `materials` 배열에는 재료 ID·이름·수량이 포함됨.
- 정적 JSON의 `gacha` 정보에 천장 스택/확정 플래그가 존재한다고 가정하지 않음. 실시간 WebSocket 이벤트는 현재 범위에서 제외.
- 한국어 화면에서 OCR이 필요하지 않지만, 게임 패킷을 읽는 비공식 도구이므로 사용 위험이 존재. 공개 검색에서 도구 자체로 인한 확인된 제재 보고는 찾지 못했으나 공식 안전 보증은 없음.
- 프로젝트는 Archiver 바이너리/패킷 캡처 기능을 내장하지 않으며, 사용자가 수동 저장한 JSON 파일만 읽음.
- 기존 HSR-Scanner 가져오기 기능은 대체 소스로 유지.
- 실제 Archiver JSON 파일의 Windows 가져오기·캐릭터 선택 내보내기·Portable EXE 실사용 흐름을 0.1.1에서 검증함.

### 실사용 검증 및 AI용 간결 출력 (2026-11-15)

- 실제 Reliquary Archiver **0.20.0**, `version=4` 파일에서 캐릭터 75명, 광추 445개, 유물 2,649개, 재료 656종 수집 확인.
- 실제 아케론 계정 자료 JSON(267,103바이트) 출력 성공. 별도 간결 출력 모듈은 현재 보유 성혼/스킬 레벨, 장착 장비, 유효한 유물 세트 효과를 선택.
- 미장착 후보는 `location`이 빈 장비만 포함. 장착한 세트와 같은 유물 또는 미장착 전체를 선택할 수 있고 점수 계산은 없음.
- 재료·티켓의 ID를 StarRailRes `items.json`과 연결해 한국어 이름으로 출력. 일치하지 않는 ID는 원본 이름과 미매칭 상태를 유지.
- 개인 UID는 로컬 원본에만 존재. AI 내보내기에는 넣지 않음.
- 게임 내 캐릭터 상세 화면의 **실제 최종 능력치**는 이 JSON에 없으며, 전투 조건 없는 실제 능력치를 재구성했다고 주장하지 않음.
- 세트 효과는 장착한 해당 세트 유물의 개수 기준으로 표시. 발동 조건이 있는 효과는 조건의 충족 여부까지 자동 판단하지 않음.
- 0.1.1 Windows Portable EXE로 동기화·스캔 파일 가져오기·출력·저장을 실사용 검증함. CLI용 로컬 브라우저 GUI도 그대로 유지함.

### 0.1.2 유물 옵션 한국어 및 수치 결합

- StarRailRes `relics.json`에서 `set_id + rarity + type`에 해당하는 유물 정의를 찾고 `relic_main_affixes.json`의 기본값과 레벨별 증가값을 사용하여 주옵션 수치를 산출함.
- `properties.json`의 `name`과 `percent`를 사용해 한국어 이름과 단위(%/실수)를 표시함.
- Reliquary Archiver의 유물 부옵션 `value`는 이미 퍼센트포인트로 제공하는 항목이 있으므로 원본 숫자 그대로 유지하고, AI 표시용 숫자만 별도 반올림함.
- 같은 세트·등급·부위에 상이한 원본 유물이 여러 개 있는 등 정확히 매칭하지 못하면 주옵션 숫자를 `null`로 남김.
- **유물 주옵션 계산 결과는 게임 테이블로 유도한 값**이며 게임에서 관측한 최종 캐릭터 스탯으로 표현하지 않음.

## 출력 데이터 원칙

- 게임 버전, 언어, 출처, 수집 시각 기록.
- 캐릭터 ID 등 원본 식별자 유지.
- 수집 불가·알 수 없는 값은 `null` 또는 누락으로 표시하고 값을 만들어내지 않음.
- AI가 판단하도록 데이터를 정리하되 추천·평가는 프로그램이 수행하지 않음.

## 배포 검토

외부 라이선스, 게임 리소스 이용 약관, 데이터 재배포 가능 여부를 별도로 확인합니다. 프로젝트 자체의 라이선스는 아직 지정하지 않습니다.
