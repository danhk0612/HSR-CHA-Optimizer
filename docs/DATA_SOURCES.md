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

현재 첫 수집기는 위 인덱스 **16종만 다운로드**합니다. 원본 전체 게임 파일이나 이미지·음성·임무 등을 모두 수집하는 단계는 아닙니다. 실물 게임 리소스는 저장소에 커밋하지 않습니다.

## 개인 계정 — 후속 단계

- 공개 UID/전시 캐릭터 데이터: 노출한 캐릭터만 조회 가능하며 전체 인벤토리 대체 불가.
- 외부 파일 가져오기: https://github.com/kel-z/HSR-Scanner (스캐너 내보내기 JSON)
- 미장착 장비, 개인 재화/재료의 자동 획득은 검증 후 범위 확정.
- 스캐너의 게임 화면 조작이나 비공식 네트워크 패킷 캡처 기능은 프로그램에 기본 내장하지 않음.

## 출력 데이터 원칙

- 게임 버전, 언어, 출처, 수집 시각 기록.
- 캐릭터 ID 등 원본 식별자 유지.
- 수집 불가·알 수 없는 값은 `null` 또는 누락으로 표시하고 값을 만들어내지 않음.
- AI가 판단하도록 데이터를 정리하되 추천·평가는 프로그램이 수행하지 않음.

## 배포 검토

외부 라이선스, 게임 리소스 이용 약관, 데이터 재배포 가능 여부를 별도로 확인합니다. 프로젝트 자체의 라이선스는 아직 지정하지 않습니다.
