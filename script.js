function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomOperand(digits) {
  if (digits <= 1) return randomInt(0, 9);
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return randomInt(min, max);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const MAX_ATTEMPTS_PER_PROBLEM = 800;

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

// Rejects numbers that make mental multiplication too easy (trailing zero, repeated digit).
function isTooEasyOperand(n) {
  if (n % 10 === 0) return true;
  const digits = String(n);
  return new Set(digits).size === 1;
}

function randomMeaningfulOperand(digits) {
  let n;
  let attempts = 0;
  do {
    n = randomOperand(digits);
    attempts++;
  } while (isTooEasyOperand(n) && attempts < 50);
  return n;
}

// Element-wise dominance (both left factors >= or <= their right counterparts) is always
// "obvious" regardless of difficulty tier, since it's readable without multiplying at all.
function isPositionDominant(la, lb, ra, rb) {
  return (la >= ra && lb >= rb) || (la <= ra && lb <= rb);
}

// Tags each of the 4 numbers with its side and sorts by value, so rank-based patterns
// (which side holds the largest, 2nd-largest, ...) can be read off tagged[0..3].
function tagByRank(la, lb, ra, rb) {
  return [
    [la, "L"],
    [lb, "L"],
    [ra, "R"],
    [rb, "R"],
  ].sort((x, y) => y[0] - x[0]);
}

// The two largest of the four numbers both sitting on the same side is "obvious" —
// e.g. 196x104 vs 185x103 has 196 and 185 (the top two) both effectively on one side.
function isTopTwoSameSide(la, lb, ra, rb) {
  const tagged = tagByRank(la, lb, ra, rb);
  return tagged[0][1] === tagged[1][1];
}

// Left holds rank 1 & rank 3, right holds rank 2 & rank 4 (e.g. 196x104 vs 103x185:
// 196=1st, 185=2nd, 104=3rd, 103=4th) — a recognizable but genuinely non-trivial split.
function isRankSplitPattern(la, lb, ra, rb) {
  const tagged = tagByRank(la, lb, ra, rb);
  return tagged[0][1] === "L" && tagged[1][1] === "R" && tagged[2][1] === "L" && tagged[3][1] === "R";
}

function comparisonRatio(left, right) {
  return Math.max(left, right) / Math.min(left, right);
}

// Difficulty mix per section: 80% close call (ratio <= 1.3), 10% rank-split pattern
// (still needs calculation but has a recognizable shape), 10% looser gap (1.3~1.5).
const RANK_SPLIT_RATIO = 0.1;
const LOOSE_RATIO_SHARE = 0.1;
const HARD_MAX_RATIO = 1.3;
const LOOSE_MIN_RATIO = 1.3;
const LOOSE_MAX_RATIO = 1.5;

// The rank-split pattern (rank 1&3 vs rank 2&4) needs all four numbers to share a
// common value range. When operands have different digit lengths (e.g. a 2-digit vs
// a 3-digit factor), the 3-digit ones always outrank the 2-digit ones, which collapses
// rank-split into plain position dominance — so it's only offered for same-length pairs.
function pickDifficultyTypes(count, allowRankSplit) {
  const rankSplitCount = allowRankSplit ? Math.round(count * RANK_SPLIT_RATIO) : 0;
  const looseCount = Math.round(count * LOOSE_RATIO_SHARE);
  const hardCount = count - rankSplitCount - looseCount;
  return shuffle([
    ...Array(rankSplitCount).fill("rankSplit"),
    ...Array(looseCount).fill("loose"),
    ...Array(hardCount).fill("hard"),
  ]);
}

function generateComparisonItem(leftDigits, rightDigits, type) {
  let la, lb, ra, rb, left, right;
  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROBLEM; attempt++) {
    la = randomMeaningfulOperand(leftDigits[0]);
    lb = randomMeaningfulOperand(leftDigits[1]);
    ra = randomMeaningfulOperand(rightDigits[0]);
    rb = randomMeaningfulOperand(rightDigits[1]);
    left = la * lb;
    right = ra * rb;
    if (left === right) continue;
    if (isPositionDominant(la, lb, ra, rb)) continue;

    if (type === "rankSplit") {
      if (!isRankSplitPattern(la, lb, ra, rb)) continue;
    } else {
      if (isTopTwoSameSide(la, lb, ra, rb)) continue;
      const ratio = comparisonRatio(left, right);
      if (type === "loose") {
        if (ratio <= LOOSE_MIN_RATIO || ratio > LOOSE_MAX_RATIO) continue;
      } else {
        if (ratio > HARD_MAX_RATIO) continue;
      }
    }

    return { la, lb, ra, rb, symbol: left > right ? ">" : "<" };
  }
  return { la, lb, ra, rb, symbol: left >= right ? ">" : "<" };
}

// Fixed comparison spec: 2x2-digit and 2x3-digit — 10 items each; 3x3-digit — 20 items
const COMPARE_SECTIONS = [
  { leftDigits: [2, 2], rightDigits: [2, 2], count: 10, columns: 2 },
  { leftDigits: [3, 3], rightDigits: [3, 3], count: 20, columns: 2 },
  { leftDigits: [2, 3], rightDigits: [2, 3], count: 10, columns: 2 },
];

function generateComparisonSectionProblems(section) {
  const { leftDigits, rightDigits, count } = section;
  const allowRankSplit = leftDigits[0] === leftDigits[1];
  const types = pickDifficultyTypes(count, allowRankSplit);
  const seen = new Set();
  const problems = [];

  for (const type of types) {
    let problem = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROBLEM; attempt++) {
      const candidate = generateComparisonItem(leftDigits, rightDigits, type);
      const key = `${candidate.la}x${candidate.lb}vs${candidate.ra}x${candidate.rb}`;
      if (seen.has(key) && attempt < MAX_ATTEMPTS_PER_PROBLEM - 1) continue;
      seen.add(key);
      problem = candidate;
      break;
    }
    problems.push(problem || generateComparisonItem(leftDigits, rightDigits, type));
  }

  return problems;
}

function buildComparisonProblemSet() {
  return COMPARE_SECTIONS.map((section) => ({
    columns: section.columns,
    problems: generateComparisonSectionProblems(section),
  }));
}

function renderPage(container, problemSet, formatItem) {
  container.innerHTML = problemSet
    .map(({ columns, problems }) => {
      const items = problems
        .map((p) => `<div class="problem-item">${formatItem(p)}</div>`)
        .join("");
      return `<div class="section-block"><div class="problem-grid" style="--cols:${columns}">${items}</div></div>`;
    })
    .join("");
}

const compareQuestionFormatter = (p) =>
  `${formatNumber(p.la)} × ${formatNumber(p.lb)} <span class="compare-blank"></span> ${formatNumber(p.ra)} × ${formatNumber(p.rb)}`;
const compareAnswerFormatter = (p) =>
  `${formatNumber(p.la)} × ${formatNumber(p.lb)} <span class="compare-symbol">${p.symbol}</span> ${formatNumber(p.ra)} × ${formatNumber(p.rb)}`;

// ---------------------------------------------------------------------------
// NCS-style data-interpretation table: fill in blank cells using the row/column
// totals already printed in the table (add up what's known, subtract from the
// total). Digit lengths lean toward 3~4 digits, with 2 and 5 digits as the
// occasional edges.
// ---------------------------------------------------------------------------

// Real data tables don't mix a 1-digit cell with a 5-digit cell in the same
// column — every entry sits near the same order of magnitude. Jittering by
// *digit length* doesn't model that well (each step up is a ~10x jump in
// average value, so even a modest jump chance skews sums badly). Instead each
// table rolls one "pivot" value (mostly 3-digit, occasionally 2 or 4, rarely
// 5), and every cell is that pivot times a modest random multiplier — so
// values drift smoothly around the same order of magnitude instead of
// hopping between digit tiers.
function pickBaseDigitLength() {
  const r = Math.random();
  if (r < 0.35) return 2;
  if (r < 0.975) return 3;
  if (r < 0.997) return 4;
  return 5;
}

function randomMagnitudeFactor(wide) {
  const [lo, hi] = wide ? [0.15, 3.5] : [0.45, 2.0];
  const logMin = Math.log(lo);
  const logMax = Math.log(hi);
  return Math.exp(logMin + Math.random() * (logMax - logMin));
}

// A per-cell 6% chance of a wide swing sounds rare, but a 5x5 table has 25
// cells — at that rate almost every table would roll one somewhere. Wide
// jitter is only ever offered to a single pre-chosen cell (picked once per
// table), so the "occasional 1-digit next to 5-digit" case stays occasional
// at the table level instead of compounding into "almost always."
function randomTableValue(pivot, allowWideJitter) {
  const magnitude = Math.min(99999, Math.max(1, Math.round(pivot * randomMagnitudeFactor(allowWideJitter))));
  return Math.random() < 0.2 ? -magnitude : magnitude;
}

// Row/column header themes spanning several NCS-style domains (social, economic,
// cultural, ...). Each pair has 5 labels so it works for tables up to 5x5; a pair
// is sometimes transposed (row<->col) for extra variety.
const THEME_PAIRS = [
  { row: ["서울", "부산", "대구", "인천", "광주"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["기업 A", "기업 B", "기업 C", "기업 D", "기업 E"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["초졸이하", "중졸", "고졸", "대졸", "대학원졸"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["한국", "미국", "일본", "중국", "독일"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["10대", "20대", "30대", "40대", "50대"], col: ["서울", "경기", "부산", "대구", "인천"] },
  { row: ["0~200만원", "200~400만원", "400~600만원", "600~800만원", "800만원이상"], col: ["A도", "B도", "C도", "D도", "E도"] },
  { row: ["제조업", "서비스업", "건설업", "농업", "금융업"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["응시자 A", "응시자 B", "응시자 C", "응시자 D", "응시자 E"], col: ["언어", "수리", "자료해석", "상황판단", "직무능력"] },
  { row: ["영업부", "기획부", "개발부", "총무부", "인사부"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["강남점", "홍대점", "신촌점", "잠실점", "여의도점"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["드라마", "코미디", "액션", "SF", "다큐멘터리"], col: ["2019", "2020", "2021", "2022", "2023"] },
  { row: ["0~10", "11~20", "21~30", "31~40", "40~"], col: ["A도", "B도", "C도", "D도", "E도"] },
];

function pickTheme(n) {
  const theme = THEME_PAIRS[randomInt(0, THEME_PAIRS.length - 1)];
  const swap = Math.random() < 0.5;
  return {
    rowHeaders: (swap ? theme.col : theme.row).slice(0, n),
    colHeaders: (swap ? theme.row : theme.col).slice(0, n),
  };
}

// Builds the (n+1)x(n+1) grid: rows/cols 0..n-1 are data, row n and col n are
// totals, and grid[n][n] is the grand total (row-n's own "row total" is the sum
// of the column totals, which equals the sum of the row totals by construction).
function buildDataGrid(n) {
  const pivot = randomOperand(pickBaseDigitLength());
  const m = n + 1;
  const hasOutlier = Math.random() < 0.06;
  const outlierRow = hasOutlier ? randomInt(0, n - 1) : -1;
  const outlierCol = hasOutlier ? randomInt(0, n - 1) : -1;
  const grid = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      grid[i][j] = randomTableValue(pivot, i === outlierRow && j === outlierCol);
    }
  }
  for (let i = 0; i < n; i++) {
    grid[i][n] = grid[i].slice(0, n).reduce((a, b) => a + b, 0);
  }
  for (let j = 0; j <= n; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += grid[i][j];
    grid[n][j] = sum;
  }
  return grid;
}

// A blank cell is solvable once it is the only remaining unknown in its row or
// column (then the row/column total pins it down). Simulates that cascade to
// confirm a candidate blank set is fully solvable, without leaving any cell
// stuck behind two-or-more simultaneous unknowns in every equation touching it.
function isBlankSetSolvable(m, blankSet) {
  const unresolved = new Set(blankSet);
  let changed = true;
  while (changed && unresolved.size > 0) {
    changed = false;
    for (let r = 0; r < m; r++) {
      let count = 0;
      let last = null;
      for (let c = 0; c < m; c++) {
        const key = `${r}-${c}`;
        if (unresolved.has(key)) {
          count++;
          last = key;
        }
      }
      if (count === 1) {
        unresolved.delete(last);
        changed = true;
      }
    }
    for (let c = 0; c < m; c++) {
      let count = 0;
      let last = null;
      for (let r = 0; r < m; r++) {
        const key = `${r}-${c}`;
        if (unresolved.has(key)) {
          count++;
          last = key;
        }
      }
      if (count === 1) {
        unresolved.delete(last);
        changed = true;
      }
    }
  }
  return unresolved.size === 0;
}

// Picks a blank set that isn't limited to one-per-row/column: some rows or
// columns may carry two or more blanks, as long as the whole set still
// resolves via cascading row/column totals. Falls back to the always-solvable
// one-per-row-and-column pattern if random attempts don't pan out.
function pickBlankSet(n, targetCount) {
  const m = n + 1;
  const allCells = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) allCells.push(`${i}-${j}`);
  }
  for (let attempt = 0; attempt < 300; attempt++) {
    const candidate = new Set(shuffle([...allCells]).slice(0, targetCount));
    if (isBlankSetSolvable(m, candidate)) return candidate;
  }
  const perm = shuffle([...Array(n).keys()]);
  return new Set(perm.map((col, row) => `${row}-${col}`));
}

function generateDataTable(n) {
  const grid = buildDataGrid(n);
  const targetBlanks = randomInt(n + 2, 2 * n + 1);
  const blanks = pickBlankSet(n, targetBlanks);
  const { rowHeaders, colHeaders } = pickTheme(n);
  return { n, m: n + 1, grid, blanks, rowHeaders, colHeaders };
}

function buildDataTableProblemSet(count) {
  return Array.from({ length: count }, () => generateDataTable(randomInt(3, 5)));
}

function renderDataCell(value, isBlank, showAnswers, extraClass) {
  const cls = [extraClass, isBlank ? "dt-blank" : ""].filter(Boolean).join(" ");
  if (!isBlank) return `<td class="${cls}">${formatNumber(value)}</td>`;
  const content = showAnswers ? `<span class="dt-answer">${formatNumber(value)}</span>` : "";
  return `<td class="${cls}">${content}</td>`;
}

function renderDataTable(problem, index, showAnswers) {
  const { n, m, grid, blanks, rowHeaders, colHeaders } = problem;

  const headCells = colHeaders.map((h) => `<th>${h}</th>`).join("");
  const bodyRows = [];
  for (let i = 0; i < m; i++) {
    const isTotalRow = i === n;
    let rowHtml = `<tr><th class="dt-rowhead">${isTotalRow ? "계" : rowHeaders[i]}</th>`;
    for (let j = 0; j < m; j++) {
      const isTotalCol = j === n;
      const isBlank = blanks.has(`${i}-${j}`);
      const cls = isTotalRow || isTotalCol ? "dt-total" : "";
      rowHtml += renderDataCell(grid[i][j], isBlank, showAnswers, cls);
    }
    rowHtml += `</tr>`;
    bodyRows.push(rowHtml);
  }

  return `
    <div class="dt-block">
      <div class="dt-label">문제 ${index}</div>
      <table class="data-table">
        <thead><tr><th></th>${headCells}<th>합</th></tr></thead>
        <tbody>${bodyRows.join("")}</tbody>
      </table>
    </div>`;
}

function renderDataTablePage(container, problems, showAnswers) {
  container.innerHTML = problems.map((p, i) => renderDataTable(p, i + 1, showAnswers)).join("");
}

function generateAndRender() {
  const dataProblems = buildDataTableProblemSet(10);
  const compareSet = buildComparisonProblemSet();

  renderDataTablePage(document.getElementById("dataQuestionPage"), dataProblems, false);
  renderDataTablePage(document.getElementById("dataAnswerPage"), dataProblems, true);
  renderPage(document.getElementById("compareQuestionPage"), compareSet, compareQuestionFormatter);
  renderPage(document.getElementById("compareAnswerPage"), compareSet, compareAnswerFormatter);
}

document.getElementById("generateBtn").addEventListener("click", generateAndRender);
document.getElementById("printBtn").addEventListener("click", () => window.print());

generateAndRender();
