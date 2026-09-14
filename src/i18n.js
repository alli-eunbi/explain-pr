// Viewer UI strings. The language comes from the embedded report's `lang` (ko by default);
// Markdown labels live in scripts/explain-pr.mjs and follow the same field.
const DICT = {
  ko: {
    'status.reviewed': '검토함', 'status.partial': '일부 검토', 'status.unread': '안 봄',
    'tests.not-run': '테스트 실행 안 함', 'tests.passed': '테스트 실행 · 통과', 'tests.failed': '테스트 실행 · 실패',
    'change.changed': '변경', 'change.existing': '기존', 'change.unknown': '변경 미확인', 'change.unknownLong': '변경 여부 확인 못 함',
    'src.sampleRevision': '예시 코드 · 실제 위치 아님', 'src.base': '변경 전', 'src.head': '변경 후', 'src.excerpt': '코드 발췌',
    'route.front': '↑ 정면 · {label} → {title}', 'route.forks': '갈림길 {n}개 · 조건을 골라 다음 단계로', 'route.follow': '연결선을 따라 다음 단계로', 'route.none': '이어지는 경로 없음', 'route.offscreen': '화면 밖 경로 · 버튼으로 이동',
    'keys.overview': '전체 보기 · 드래그 / 확대 · 발판 클릭으로 살펴보기', 'keys.follow': '지도 클릭 · ↑ W 정면 · ← → A D 바로 이동 · ↓ S 이전',
    'keys.overviewTitle': '지도를 드래그하거나 방향키로 둘러보고, 발판을 눌러 설명을 확인하세요.', 'keys.followTitle': '지도 빈 곳을 클릭한 뒤 방향 키 한 번으로 이동하세요',
    'unread.eyebrow': '검토하지 않은 흐름', 'unread.desc': '코드를 읽지 않은 구간에는 단계나 결과를 만들어 넣지 않았습니다.', 'unread.why': '확인하지 못한 이유',
    'field.input': '입력', 'field.output': '결과',
    'diff.title': '이전과 달라진 점', 'diff.confirmed': '확인된 동작', 'diff.thisStep': '이 단계의 동작', 'diff.before': '변경 전', 'diff.after': '변경 후',
    'finding.next': '다음 단계에서 확인할 점', 'finding.issueHere': '이 단계에서 발견한 문제', 'finding.questionHere': '이 단계에서 확인할 점',
    'finding.inspectStep': '{n} 단계 살펴보기 ↗', 'finding.inspect': '문제와 근거 살펴보기 ↗', 'finding.more': '확인할 사항 {n}개 더 보기',
    'finding.issue': '코드에서 발견한 문제', 'finding.question': '추가 확인이 필요한 사항',
    'section.evidence': '코드 근거', 'section.routes': '이어지는 조건',
    'next.unread': '검토하지 않은 흐름', 'next.choose': '경로를 선택하세요 ↓', 'next.end': '흐름 끝', 'next.jump': '다음 단계로 점프 →',
    'journey.none': '아직 작성된 단계가 없어요', 'journey.entry': '입구에서 시작', 'journey.middle': '중간 단계에서 시작', 'journey.inspecting': '단계 직접 살펴보는 중', 'journey.moved': '선택한 경로 · {n}번 이동', 'journey.cap': ' · 최근 100단계 보관',
    'choices.next': '다음 조건: ', 'state.none': '작성된 설명용 상태가 없습니다.',
    'scenarios.unread': '안 봄 · 조건별 동작을 검토하지 않았습니다.', 'scenarios.none': '작성된 조건별 검토가 없습니다.',
    'th.condition': '어떤 조건에서', 'th.result': '코드가 만드는 결과', 'th.assessment': '검토 내용', 'th.evidence': '근거',
    'tab.findings': '문제 · 확인할 사항 {n}', 'findings.unread': '안 봄 · 문제 유무를 판단하지 않았습니다.', 'findings.none': '기록된 문제가 없습니다. 검토 범위 밖의 동작까지 확인한 것은 아닙니다.',
    'f.condition': '발생 조건', 'f.behavior': '실제 동작', 'f.impact': '서비스 영향',
    'limits.title': '확인하지 못한 사항 · {n}', 'limits.none': '작성된 미확인 사항이 없습니다.',
    'note.sample': 'ⓘ 예시 데이터로 구성한 화면 · 실제 PR 검토 결과가 아닙니다.', 'note.real': 'ⓘ 상태 값은 설명용 예시입니다. 서비스 코드를 실행하는 화면이 아닙니다.',
    'coverage.title': '검토 범위', 'coverage.count': '확인한 흐름 {done} / {total}', 'coverage.breakdown': '검토함 {r} · 일부 {p} · 안 봄 {u}',
    'fc.aria': '{n} {title} · 코드 근거 보기', 'fc.unknownValue': '확인 못 함', 'fc.failureBranch': '실패 분기', 'fc.otherBranch': '다른 경로',
    'fc.repeat': '↻ 현재 단계 반복', 'fc.return': '↩ {n} 단계로 돌아감', 'fc.join': '↪ 동일 단계 {n}로 합류', 'fc.goto': '→ {n} 단계',
    'fc.continue': '이후 처리 계속 · ', 'fc.seeConditions': '{n} 단계의 {count}개 조건 보기', 'fc.moreConditions': '이어지는 조건 →', 'fc.lastStep': '이 경로의 마지막 단계',
    'fc.empty': '안 봄 · 이 흐름에는 확인한 단계가 없습니다.', 'fc.mainPath': '기본 경로 · 위에서 아래로', 'fc.sidePath': '옆길 · 조건과 도착 결과',
    'fc.note': '단계를 누르면 코드 근거를 봅니다. 번호는 원래 보고서의 단계 번호입니다.', 'fc.branchSection': '분기에서 이어지는 처리',
    'scene.aria': '입체 로직 지도. 발판 버튼으로 단계를 선택하세요.', 'scene.actor': '현재 단계', 'scene.panHelp': '지도를 드래그해 둘러보세요 · 발판을 누르면 단계 설명', 'scene.panFollow': '현재 단계를 따라 이동 · 드래그로 둘러보기',
    'scene.fallback': '이 환경에서는 3D를 표시할 수 없어 단계 카드로 보여드립니다.', 'scene.changedSuffix': ' · 변경됨', 'scene.unknownSuffix': ' · 변경 여부 미확인',
    'scene.changedLogic': '변경된 로직', 'scene.unknownLogic': '변경 여부 미확인', 'scene.existingLogic': '기존 로직', 'scene.failureSuffix': ' · 실패 경로',
    'ui.sample': '샘플 리포트', 'ui.download': 'Markdown 저장', 'ui.flows': '서비스 흐름', 'ui.openReview': '검토 기록 살펴보기 ↗',
    'ui.sidebarNote': '요청 하나의 여정을 따라가며 조건과 상태 변화를 확인하세요.', 'ui.pinned': '분석 기준 · 고정된 커밋', 'ui.viewPr': 'GitHub에서 PR 보기 ↗',
    'ui.modeSwitch': '흐름 보기 방식', 'ui.overview': '☷ 로직 흐름도', 'ui.follow': '◇ 3D 따라가기', 'ui.stage': '서비스 로직 지도',
    'ui.legendChanged': '변경', 'ui.legendExisting': '기존', 'ui.legendQuestion': '확인할 사항', 'ui.legendUnknown': '변경 미확인',
    'ui.zoom': '지도 크기', 'ui.zoomOut': '지도 축소', 'ui.zoomIn': '지도 확대', 'ui.fit': '맞춤',
    'ui.unreadTitle': '아직 살펴보지 않은 흐름', 'ui.unreadDesc': '작성된 단계가 없습니다. 검토 기록에서 확인하지 못한 이유를 볼 수 있어요.',
    'ui.stateCaption': '요청이 가진 값 · 예시', 'ui.previous': '← 이전', 'ui.chooseRoute': '다음 경로 선택', 'ui.detailAria': '선택한 단계의 설명과 근거',
    'ui.review': '검토 기록', 'ui.closeReview': '검토 기록 닫기', 'ui.reviewTabs': '검토 항목', 'ui.tabScenarios': '조건별 동작', 'ui.tabFindings': '문제 · 확인할 사항', 'ui.tabLimits': '확인 범위',
  },
  en: {
    'status.reviewed': 'reviewed', 'status.partial': 'partially reviewed', 'status.unread': 'unread',
    'tests.not-run': 'Tests not run', 'tests.passed': 'Tests run · passed', 'tests.failed': 'Tests run · failed',
    'change.changed': 'changed', 'change.existing': 'existing', 'change.unknown': 'change unknown', 'change.unknownLong': 'change status unknown',
    'src.sampleRevision': 'sample code · not a real location', 'src.base': 'before', 'src.head': 'after', 'src.excerpt': 'Code excerpt',
    'route.front': '↑ Ahead · {label} → {title}', 'route.forks': '{n} branches · pick a condition to continue', 'route.follow': 'Follow the connector to the next step', 'route.none': 'No further route', 'route.offscreen': 'Route off screen · use the buttons',
    'keys.overview': 'Overview · drag / zoom · click a platform to inspect', 'keys.follow': 'Click the map · ↑ W ahead · ← → A D jump · ↓ S back',
    'keys.overviewTitle': 'Drag the map or use the arrow keys to look around; click a platform to read its explanation.', 'keys.followTitle': 'Click an empty spot on the map, then press one arrow key to move',
    'unread.eyebrow': 'Flow not reviewed', 'unread.desc': 'No steps or results were invented for code that was not read.', 'unread.why': 'Why it was not reviewed',
    'field.input': 'Input', 'field.output': 'Result',
    'diff.title': 'What changed here', 'diff.confirmed': 'Confirmed behavior', 'diff.thisStep': 'Behavior of this step', 'diff.before': 'Before', 'diff.after': 'After',
    'finding.next': 'To check at the next step', 'finding.issueHere': 'Issue found at this step', 'finding.questionHere': 'To confirm at this step',
    'finding.inspectStep': 'Inspect step {n} ↗', 'finding.inspect': 'See the issue and its evidence ↗', 'finding.more': 'Show {n} more',
    'finding.issue': 'Issue found in code', 'finding.question': 'Needs confirmation',
    'section.evidence': 'Code evidence', 'section.routes': 'Next conditions',
    'next.unread': 'Flow not reviewed', 'next.choose': 'Choose a route ↓', 'next.end': 'End of flow', 'next.jump': 'Jump to next step →',
    'journey.none': 'No steps written yet', 'journey.entry': 'Started at the entry', 'journey.middle': 'Started mid-flow', 'journey.inspecting': 'Inspecting a step directly', 'journey.moved': 'Chosen route · {n} moves', 'journey.cap': ' · last 100 steps kept',
    'choices.next': 'Next condition: ', 'state.none': 'No illustrative state was written.',
    'scenarios.unread': 'Unread · behavior by condition was not reviewed.', 'scenarios.none': 'No scenarios were written.',
    'th.condition': 'Condition', 'th.result': 'Result the code produces', 'th.assessment': 'Assessment', 'th.evidence': 'Evidence',
    'tab.findings': 'Issues · questions {n}', 'findings.unread': 'Unread · no judgement about issues was made.', 'findings.none': 'No issues recorded. Behavior outside the reviewed scope was not checked.',
    'f.condition': 'Trigger', 'f.behavior': 'Behavior', 'f.impact': 'Service impact',
    'limits.title': 'Not verified · {n}', 'limits.none': 'No limitations were written.',
    'note.sample': 'ⓘ Screen built from sample data · not a real PR review.', 'note.real': 'ⓘ State values are illustrative. This screen does not execute service code.',
    'coverage.title': 'Coverage', 'coverage.count': 'Flows reviewed {done} / {total}', 'coverage.breakdown': 'reviewed {r} · partial {p} · unread {u}',
    'fc.aria': '{n} {title} · view code evidence', 'fc.unknownValue': 'unknown', 'fc.failureBranch': 'failure branch', 'fc.otherBranch': 'other route',
    'fc.repeat': '↻ repeats this step', 'fc.return': '↩ back to step {n}', 'fc.join': '↪ joins step {n}', 'fc.goto': '→ step {n}',
    'fc.continue': 'Continues · ', 'fc.seeConditions': 'See {count} condition(s) at step {n}', 'fc.moreConditions': 'Next conditions →', 'fc.lastStep': 'Last step on this path',
    'fc.empty': 'Unread · no steps were reviewed in this flow.', 'fc.mainPath': 'Main path · top to bottom', 'fc.sidePath': 'Side paths · conditions and outcomes',
    'fc.note': 'Click a step to see its code evidence. Numbers are the step numbers from the report.', 'fc.branchSection': 'Processing that continues from branches',
    'scene.aria': '3D logic map. Select a step with the platform buttons.', 'scene.actor': 'Current step', 'scene.panHelp': 'Drag to look around · click a platform for its explanation', 'scene.panFollow': 'Following the current step · drag to look around',
    'scene.fallback': '3D cannot be displayed here, so steps are shown as cards.', 'scene.changedSuffix': ' · changed', 'scene.unknownSuffix': ' · change unknown',
    'scene.changedLogic': 'changed logic', 'scene.unknownLogic': 'change unknown', 'scene.existingLogic': 'existing logic', 'scene.failureSuffix': ' · failure route',
    'ui.sample': 'Sample report', 'ui.download': 'Save Markdown', 'ui.flows': 'Service flows', 'ui.openReview': 'Open review notes ↗',
    'ui.sidebarNote': 'Follow one request through its journey and watch conditions and state change.', 'ui.pinned': 'Analyzed at · pinned commits', 'ui.viewPr': 'View PR on GitHub ↗',
    'ui.modeSwitch': 'View mode', 'ui.overview': '☷ Logic flowchart', 'ui.follow': '◇ 3D follow', 'ui.stage': 'Service logic map',
    'ui.legendChanged': 'changed', 'ui.legendExisting': 'existing', 'ui.legendQuestion': 'to confirm', 'ui.legendUnknown': 'change unknown',
    'ui.zoom': 'Map size', 'ui.zoomOut': 'Zoom out', 'ui.zoomIn': 'Zoom in', 'ui.fit': 'Fit',
    'ui.unreadTitle': 'Flow not reviewed yet', 'ui.unreadDesc': 'No steps were written. The review notes explain why it was not reviewed.',
    'ui.stateCaption': 'Values the request carries · illustrative', 'ui.previous': '← Back', 'ui.chooseRoute': 'Choose next route', 'ui.detailAria': 'Explanation and evidence for the selected step',
    'ui.review': 'Review notes', 'ui.closeReview': 'Close review notes', 'ui.reviewTabs': 'Review sections', 'ui.tabScenarios': 'Behavior by condition', 'ui.tabFindings': 'Issues · questions', 'ui.tabLimits': 'Coverage',
  },
};

export function lang() {
  const value = globalThis.__EXPLAIN_PR_REPORT__?.lang;
  return Object.hasOwn(DICT, value) ? value : 'ko';
}

export function t(key, vars) {
  let text = DICT[lang()][key] ?? DICT.ko[key] ?? key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

// Apply static shell strings: data-i18n → textContent, data-i18n-aria → aria-label, data-i18n-title → title.
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  root.documentElement?.setAttribute('lang', lang());
}
