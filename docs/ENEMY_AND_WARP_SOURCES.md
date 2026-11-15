# 적·보스 데이터 및 워프 기록 소스 조사 (2026-11-15)

## 적·보스 데이터

현재 사용 중인 StarRailRes `index_min/kr` 20종에는 적/보스 전용 인덱스가 없습니다. 따라서 단순히 `enemies.json`이나 `monsters.json`을 추가하는 방식은 불가능합니다.

확인한 후보 소스:

1. [DimbreathBot/TurnBasedGameData](https://github.com/DimbreathBot/TurnBasedGameData)
   - 원본 게임 리소스 기반 대규모 자료 저장소. README에 공개 게임 릴리스 데이터임을 명시합니다.
   - 적 관련 원본을 특정 테이블/다국어 TextMap/레벨 보정 자료와 결합해야 하므로, **적 정보의 원본 키·한국어 텍스트·버전의 일치 여부를 먼저 검증**해야 합니다.
   - 별도의 인덱스가 없어도 원본 리소스 수집까지 확장할 수 있는 후보지만, 현재 앱에 아직 연결하지 않았습니다.
2. [HSR Archive 적 목록](https://www.hsrarchive.cc/enemies/)
   - 확인 당시 중국어 적 665개 표시, 사이트 표기 자료 버전은 `4.71c5b7e1c`.
   - 원본 출처는 TurnBasedGameData로 표기하며, 비공식/추정 자료라는 주의 문구가 있습니다.
   - **한국어 인덱스가 아니라서 곧바로 자동 수입하지 않았으며**, 사이트 표시 665개가 중복 없는 실제 전투 적 종류 665종임을 의미하지는 않습니다.
3. [pzc2004/HSR_Nous](https://github.com/pzc2004/HSR_Nous)
   - 적 기본값·스킬·저항 및 콘텐츠 편성에서 서로 다른 자료원을 사용하는 방법을 공개합니다.
   - 자체 연구와 게임 원본의 구분이 필요하며, 다른 프로젝트의 계산/전투 시뮬레이터를 현 앱에 자동 결합하는 것은 범위 밖입니다.
4. [FortOfFans/HSRMaps](https://github.com/FortOfFans/HSRMaps)
   - `monster` 종류를 제공한다고 설명하지만 README 기준 `Beta 2.2.53`으로 버전이 오래되어 4.7.0의 최신 적 정보로 사용하면 안 됩니다.

### 0.1.7 검증된 정식 릴리스 적 템플릿 인덱스

- 선택 소스: [DimbreathBot/TurnBasedGameData의 정식 릴리스 4.7.0 커밋](https://github.com/DimbreathBot/TurnBasedGameData/commit/dad9155eb00fdeda31fb8456507c53590d49071f). 제목 `OSPRODWin4.7.0_D17180467_A17176203_L17175930`이며, 이 커밋에 아래 파일 4개가 실제 존재함을 확인함.
- 원본 파일: `ExcelOutput/MonsterTemplateConfig.json` (**665개의 객체 배열**), `TextMap/TextMapMainKR.json`, `TextMap/TextMapKR_0.json`, `TextMap/TextMapKR_1.json`.
- 원본에서 확인한 필드: `MonsterTemplateID`, `MonsterName.Hash`, `Rank`, `AttackBase.Value`, `DefenceBase.Value`, `HPBase.Value`, `SpeedBase.Value`, `StanceBase.Value`, `StatusResistanceBase.Value`, `StanceType`.
- 데이터 종류: `MinionLv2` 279, `Elite` 163, `LittleBoss` 157, `BigBoss` 41, `Minion` 25개. 모두 **원본 Rank 값을 변경하지 않음**.
- 해시 정밀도: 실제 `MonsterName.Hash` 예시 `329737901974927635`. JavaScript 기본 `JSON.parse`는 정밀도를 잃을 수 있으므로 **파싱 전에 `Hash` 숫자를 문자열로 바꿔** 한국어 TextMap 키에 연결함. 연동할 이름이 없거나 한국어 파일 간 같은 해시가 충돌하면 `null`로 유지함.
- 데이터 모델: 적 기초 템플릿의 수치만 보여주며 실제 전투 레벨·모드 별 HP/방어력 보정 또는 버프를 계산하지 않음. 특히 `StanceType`은 원본 필드명 그대로 유지하며 이를 약점/속성 저항으로 단정하지 않음.
- 별도 다운로드: GUI에서 **명시적으로 '적·보스 데이터 별도 준비'를 누를 때만** 4개의 원본을 가져옴. 다운로드 대상 파일 중 한국어 TextMap은 크기가 매우 커질 수 있음. 원본 전체를 앱에 동봉하지 않고 변환 결과만 `.local-data/game/enemies/index.json`에 보관하며 계정 원본/20종 StarRailRes 인덱스는 수정하지 않음.
- 정합성: 현재 동기화 게임 버전이 4.7.0과 다르면 다운로드를 중단. 원본 파일 4개가 모두 다운로드되어 파싱되고 한국어 이름이 하나 이상 연결되어야 저장함. 도중 실패는 이전 성공 자료 유지.
- **현재 확인된 것:** 정식 커밋 식별, 적 원본 665건의 ID/원시 수치/해시 구조, 언어 파일 4개 경로 존재. **미확인:** 사용자 PC에서 대용량 한국어 TextMap을 받아 실제로 연결되는 이름 비율, 일부 이름의 게임 화면 표기 일치 여부. 이름 연결률은 다운로드가 끝난 뒤 실제 결과로 표시해야 하며 100%라고 미리 가정할 수 없음.

### 구현 보류 이유 및 다음 기준

- 한국어 적 이름/ID, 분류/약점/내성/기초값/레벨 계수/스킬이 각각 **어느 원본 필드에서 왔는지** 검증해야 합니다.
- 공개된 정식 출시 버전과 테스트/유출 데이터가 혼재하지 않도록 버전 검증 및 필터가 필요합니다.
- 타 저장소의 데이터 재배포 허용 조건과 게임 콘텐츠 저작권을 확인해야 합니다.
- 0.1.7은 **정식 4.7.0의 적 템플릿 기본값과 한국어 이름 해시 매칭만** 별도 선택형 인덱스로 구현함. 약점·스킬·실전 내성값 등 미확인 데이터는 검증 전까지 추가하지 않습니다. 현재 20종 동기화에는 섞지 않습니다.

## 워프 천장·확정 정보

- [HoYoverse 도움말 — 워프 기록](https://support.hoyoverse.com/hc/en-us/articles/50913754903577-How-can-I-check-my-Warp-history-and-why-aren-t-my-latest-pulls-showing-up): 게임에서 워프 화면 → 상세 보기 → 기록으로 확인하며, 기록 반영 지연과 기간 제한이 있을 수 있습니다.
- [HoYoLAB — Warp Records](https://www.hoyolab.com/article/46452547): 6종 워프 유형을 소개하며, 최근 5성 기록 및 일부 통계를 제공하는 별도 도구입니다. 일반/컬래버 워프의 집계 기간이 다르고, 모든 과거 기록을 영구 보존하는 전체 로그를 의미하지 않습니다.
- 두 공식 화면의 표시 기간/표현은 차이가 있으므로 **과거 기록을 모두 조회할 수 있다고 가정해서는 안 됩니다.** 오래된 가챠 결과로 정확한 천장과 다음 픽업 확정 여부를 자동 재구성하지 않습니다.
- Reliquary Archiver 정적 v4 JSON에는 이미 확인한 재료·재화 외에 현재 천장 스택과 픽업 확정 상태가 보장되어 있지 않습니다.
- 워프 이력 링크에는 민감한 접근 토큰이 포함될 수 있으므로, 외부 링크 추출·네트워크 요청·서버 업로드는 기본 기능에 추가하지 않습니다.

### 0.1.6 보완 방식

- 게임 화면에서 **사용자가 직접 확인한 스택**만 워프 종류별로 수동 기록합니다.
- 캐릭터 이벤트, 광추 이벤트, 상시, 초보자, 컬래버 캐릭터, 컬래버 광추 6종을 서로 다른 범주로 유지합니다.
- 픽업 보장이 있는 종류에만 `yes`/`no`/`unknown`을 입력할 수 있습니다. 기본값은 `unknown`이며, 확정 여부를 가정하지 않습니다.
- 계정 UID의 해시를 파일명으로 한 `.local-data/account/warp-state-<hash>.json`에 보관합니다. 원본 UID 자체는 기록하지 않습니다.
- AI 자료에서 재료·재화 포함 옵션을 켰을 때만 `resources.manualWarpPity`에 수동 값과 기록 시각을 추가하며, `limitations.warpPityCollected`는 계속 `false`로 둡니다.
- 이 기록은 실시간 연동되지 않으며, 이후 워프를 진행하면 사용자가 새 값으로 갱신해야 합니다.

### 후속 검증

- 실제 게임/HoYoLAB 화면과 동일한 스택인지 사용자 확인
- 특정 이벤트 유형의 규칙이 업데이트된 경우 범주 명칭·범위 재검증
- 외부 출처 파일 가져오기 기능이 필요하다면 해당 파일의 실제 구조·보관/인증정보 노출 범위를 먼저 확인
