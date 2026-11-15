# HSR-CHA-Optimizer v0.1.10 — Windows Portable (시험 배포)

붕괴: 스타레일의 공개 게임 자료와 사용자가 직접 가져온 계정 JSON을 로컬에서 검색·선택하고 AI에 전달하기 위한 자료로 내보내는 Windows 프로그램의 첫 GitHub Release입니다.

## 포함 기능

- Windows x64 단일 Portable EXE (설치형 아님)
- Reliquary Archiver 0.20.0 / HSR-Scanner v4 형식 JSON 파일 가져오기
- 캐릭터·광추·일반 유물·차원 장신구·재료 **5종 독립 탭**: 종류별 검색·필터·정렬·선택
- 선택한 자료를 JSON, Markdown, HTML로 저장
- 공개 게임 한국어 자료 로컬 동기화(기본 20종), 게임 버전/자료 갱신 이력
- 선택적으로 가챠 재화·수동 천장 기록·보완 능력치 및 참고 효과 포함
- HTML 표의 좁은 화면 줄바꿈 개선

## 설치 및 사용

1. 아래 자산의 `HSR-CHA-Optimizer-0.1.10-portable.exe`를 다운로드하여 실행합니다.
2. 기존 데이터가 없는 첫 실행에는 **게임 자료 갱신**으로 공개 데이터를 준비합니다.
3. 사용자가 별도 프로그램으로 내보낸 Reliquary Archiver 또는 HSR-Scanner JSON을 **계정 JSON 가져오기**로 선택합니다.
4. 자료 종류 체크박스와 독립 탭에서 검색·필터·선택 후 JSON·Markdown·HTML로 저장합니다.

개인 계정 데이터나 게임 원본 데이터는 EXE에 동봉하지 않습니다. 개인정보는 사용자 PC에 저장하며, AI API 연결이나 자동 전송은 하지 않습니다.

## 검증 범위

- 사용자 Windows에서 97/97 단위 테스트, Portable EXE 빌드, 가상·실계정 Electron 조작/출력 테스트 통과(HTML 개선 전)
- 사용자 실제 출력의 JSON·Markdown·HTML 3종 간 3,169개 선택 항목과 내용 일치 확인
- HTML 표의 좁은 화면 넘침을 수정하고 Chromium 320·360·390·800·1280px에서 렌더 검증
- **이번 릴리스의 Windows CI**에서 단위 테스트·Portable 빌드·Electron GUI 자동 검사를 통과해야 파일을 공개하도록 설정함

## 알려진 제약

- 시험 배포이며, 실제 Windows 저장 대화상자 수동 조작과 수정본 EXE를 사용자 PC에서 직접 실행한 확인은 아직 별도 미완료
- Windows 코드 서명 인증서가 없어 SmartScreen 경고가 표시될 수 있음
- 최종 캐릭터 전투 능력치, 워프 기록 등 원본 JSON에서 확보되지 않는 정보는 자동으로 추정하지 않음
- Reliquary Archiver는 비공식 외부 도구입니다. 프로젝트에서 이를 내장·자동 실행하지 않음
- 외부 데이터·게임 텍스트·게임 리소스에 관한 권리와 이용 조건은 각각의 권리자에게 있음. 게임 자료 자체는 EXE에 동봉하지 않음
- 이 저장소의 프로젝트 자체 라이선스는 아직 지정되지 않았습니다.

[사용 설명서](https://github.com/danhk0612/HSR-CHA-Optimizer/blob/main/README.md) · [Windows 실행 방법](https://github.com/danhk0612/HSR-CHA-Optimizer/blob/main/docs/WINDOWS_EXE.md)
