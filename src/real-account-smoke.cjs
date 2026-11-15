const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

// This mode reads existing .local-data without modifying it.
// Saved artifacts live only in Electron's disposable smokeRoot.
async function runRealAccountSmoke({ win, root, smokeRoot, getDesktopState, getInventoryCatalog }) {
  const state = await getDesktopState(root);
  if (!state.ready) throw new Error('실계정 테스트에 필요한 로컬 게임 자료와 계정 JSON이 없습니다.');
  const catalog = await getInventoryCatalog(root);
  const groups = ['characters', 'lightCones', 'relics', 'ornaments', 'materials'];
  for (const group of groups) {
    if (!Number.isInteger(catalog.counts[group]) || catalog.counts[group] < 2)
      throw new Error('실계정 항목 2개 미만: ' + group);
  }
  if (catalog.counts.characters !== state.characters.length ||
      catalog.counts.lightCones !== state.lightCones ||
      catalog.counts.relics + catalog.counts.ornaments !== state.relics)
    throw new Error('실제 인벤토리 개수가 화면 원본과 일치하지 않습니다.');

  const interactionScript = `(async () => {
    const ensure = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const waitFor = async (check, label) => {
      for (let i = 0; i < 150; i++) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('실계정 화면 대기 실패: ' + label);
    };
    const panel = kind => document.getElementById('panel-' + kind);
    const field = (kind, name) => panel(kind).querySelector('[data-field="' + name + '"]');
    const action = (kind, name) => panel(kind).querySelector('[data-action="' + name + '"]');
    const tab = kind => document.querySelector('#tabBar [data-group="' + kind + '"]');
    const switchTab = kind => {
      ensure(tab(kind), '탭 누락: ' + kind);
      tab(kind).click();
    };
    const setInput = (control, value) => {
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const setSelect = (control, value) => {
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const count = kind => panel(kind).querySelector('.count').textContent;
    const pickTwo = kind => {
      switchTab(kind);
      const boxes = panel(kind).querySelectorAll('tbody input[type=checkbox]');
      ensure(boxes.length >= 2, kind + ' 화면 항목 부족');
      boxes[0].click();
      boxes[1].click();
      ensure(count(kind).includes('선택 2개'), kind + ' 선택 상태 검증 실패');
    };
    const kinds = ['characters', 'lightCones', 'relics', 'ornaments', 'materials'];
    await waitFor(() => kinds.every(kind => panel(kind)) &&
      panel('materials').querySelectorAll('tbody input[type=checkbox]').length === 50,
      '종류별 탭 및 재료 50개 로드');
    ensure(document.querySelectorAll('#groupCheckboxes input:checked').length === 5,
      '자료 종류 5개가 모두 선택되지 않았습니다.');

    switchTab('characters');
    setSelect(field('characters', 'sortBy'), 'level');
    setSelect(field('characters', 'direction'), 'desc');
    pickTwo('characters');
    const name = panel('characters').querySelector('.item-name')?.textContent;
    ensure(name, '캐릭터 이름 표시 실패');
    const previousLightConeCount = count('lightCones');
    setInput(field('characters', 'query'), name);
    ensure(panel('characters').querySelector('.item-name')?.textContent.includes(name),
      '캐릭터 검색 결과 표시 실패');
    ensure(count('lightCones') === previousLightConeCount,
      '캐릭터 검색이 광추 검색 결과를 변경했습니다.');

    pickTwo('lightCones');
    ensure(field('characters', 'query').value === name,
      '다른 탭 방문 후 검색어가 초기화됐습니다.');
    pickTwo('relics');
    const relicSetFilter = panel('relics').querySelector('[data-multi="sets"]');
    ensure(relicSetFilter, '유물 세트 필터 없음');
    relicSetFilter.click();
    ensure(panel('relics').querySelectorAll('tbody input[type=checkbox]').length >= 1,
      '유물 세트 필터 결과가 비었습니다.');
    pickTwo('ornaments');
    ensure(relicSetFilter.checked, '장신구 탭 방문으로 유물 필터가 초기화됐습니다.');

    switchTab('materials');
    ensure(panel('materials').querySelectorAll('tbody input[type=checkbox]').length === 50,
      '재료 첫 페이지 항목 수 오류');
    pickTwo('materials');
    action('materials', 'next').click();
    ensure(panel('materials').querySelectorAll('tbody input[type=checkbox]').length > 0,
      '재료 다음 페이지가 표시되지 않습니다.');
    ensure(count('materials').includes('선택 2개'), '페이지 이동 후 재료 선택 상태 소실');

    const materialToggle = document.querySelector('#groupCheckboxes [data-group="materials"]');
    materialToggle.click();
    ensure(!tab('materials'), '체크 해제한 종류 탭이 남아 있습니다.');
    ensure(document.getElementById('exportStatus').textContent.includes('8개 선택'),
      '재료 체크 해제 후 출력에 재료가 남아 있습니다.');
    materialToggle.click();
    ensure(tab('materials'), '재료 종류 탭 복원 실패');
    ensure(count('materials').includes('선택 2개'), '재료 선택 상태 복원 실패');
    ensure(document.getElementById('exportStatus').textContent.includes('10개 선택'),
      '종류 5개에서 각 2개 선택 후 총수량 불일치');

    const formatSelect = document.getElementById('exportFormat');
    const preview = document.getElementById('previewExport');
    const save = document.getElementById('saveExport');
    const status = document.getElementById('exportStatus');
    for (const format of ['json','markdown','html']) {
      setSelect(formatSelect, format);
      status.textContent = '미리보기 검사 준비';
      preview.click();
      await waitFor(() => status.textContent.includes('미리보기 생성 완료'),
        format + ' 미리보기');
      if (format === 'json') ensure(
        document.getElementById('previewText').value.includes('"selection"'),
        'JSON 미리보기의 선택 정보 누락');
      if (format === 'markdown') ensure(
        document.getElementById('previewText').value.includes('# 붕괴: 스타레일'),
        'Markdown 미리보기 제목 누락');
      status.textContent = '저장 검사 준비';
      save.click();
      await waitFor(() => status.textContent.includes('저장 완료'),
        format + ' 임시 파일 저장');
    }
    return { categories: 5, selected: 10, searchIndependent: true,
      filtersIndependent: true, checkboxRestore: true, allFilesSaved: true };
  })()`;
  const result = await win.webContents.executeJavaScript(interactionScript);
  if (result.categories !== 5 || result.selected !== 10 ||
      Object.entries(result).some(([key, item]) =>
        !['categories', 'selected'].includes(key) && item !== true))
    throw new Error('실계정 UI 조작 결과 오류');

  const jsonText = await readFile(join(smokeRoot, 'real-selected.json'), 'utf8');
  const markdown = await readFile(join(smokeRoot, 'real-selected.md'), 'utf8');
  const html = await readFile(join(smokeRoot, 'real-selected.html'), 'utf8');
  const parsed = JSON.parse(jsonText);
  const expected = { characters: 2, lightCones: 2, relics: 2, ornaments: 2, materials: 2 };
  for (const [category, count] of Object.entries(expected)) {
    if (parsed.selection.counts[category] !== count)
      throw new Error('실계정 JSON 수량 오류: ' + category);
  }
  if (parsed.characters.length !== 2 || parsed.lightCones.length !== 2 ||
      parsed.relics.length !== 2 || parsed.ornaments.length !== 2 ||
      parsed.resources?.materials?.length !== 2)
    throw new Error('실계정 JSON 선택 항목이 원본 목록과 일치하지 않습니다.');
  for (const title of ['캐릭터', '광추', '유물', '차원 장신구', '재료·티켓']) {
    if (!markdown.includes('## ' + title + ' (2개)'))
      throw new Error('실계정 Markdown 섹션 누락: ' + title);
  }
  const checkHtmlScript = '(() => {' +
    'const doc = new DOMParser().parseFromString(' +
    JSON.stringify(html) + ', "text/html");' +
    'return { title: !!doc.querySelector("h1"),' +
    'sections: doc.querySelectorAll("section table").length,' +
    'rows: doc.querySelectorAll("section tbody tr").length,' +
    'headers: [...doc.querySelectorAll("section table")].every(t => t.querySelectorAll("thead th").length === 4),' +
    'noScripts: !doc.querySelector("script") }; })()';
  const htmlCheck = await win.webContents.executeJavaScript(checkHtmlScript);
  if (!htmlCheck.title || htmlCheck.sections !== 5 ||
      htmlCheck.rows !== 10 || !htmlCheck.headers || !htmlCheck.noScripts)
    throw new Error('실계정 HTML 문서 구조 검증 실패: ' + JSON.stringify(htmlCheck));
  return {
    gameVersion: catalog.metadata.gameVersion,
    available: catalog.counts,
    selection: expected,
    outputFormats: ['json', 'markdown', 'html'],
    markdownSections: 5,
    htmlRows: 10,
    temporaryOutputOnly: true,
  };
}
module.exports = { runRealAccountSmoke };
