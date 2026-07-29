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

// Picks a digit-length for each operand, optionally forcing them to differ.
function pickDigitPair(minDigits, maxDigits, forceDifferentDigits) {
  let d1, d2;
  let attempts = 0;
  do {
    d1 = randomInt(minDigits, maxDigits);
    d2 = randomInt(minDigits, maxDigits);
    attempts++;
  } while (forceDifferentDigits && d1 === d2 && minDigits !== maxDigits && attempts < 30);
  return [d1, d2];
}

// Whether adding a and b requires carrying at any digit place.
function hasCarry(a, b) {
  let x = a;
  let y = b;
  let carry = 0;
  while (x > 0 || y > 0) {
    const sum = (x % 10) + (y % 10) + carry;
    carry = sum >= 10 ? 1 : 0;
    if (carry) return true;
    x = Math.floor(x / 10);
    y = Math.floor(y / 10);
  }
  return false;
}

// Whether subtracting b from a requires borrowing at any digit place.
function hasBorrow(a, b) {
  let x = a;
  let y = b;
  let borrow = 0;
  while (x > 0 || y > 0) {
    const dx = x % 10;
    const dy = (y % 10) + borrow;
    if (dx < dy) {
      return true;
    }
    borrow = 0;
    x = Math.floor(x / 10);
    y = Math.floor(y / 10);
  }
  return false;
}

function generateAdditionProblem(minDigits, maxDigits, forceDifferentDigits) {
  const [d1, d2] = pickDigitPair(minDigits, maxDigits, forceDifferentDigits);
  const a = randomOperand(d1);
  const b = randomOperand(d2);
  return { a, b, answer: a + b, symbol: "+" };
}

// Always subtracts the smaller value from the larger so the result stays non-negative.
function generateSubtractionProblem(minDigits, maxDigits, forceDifferentDigits) {
  const [d1, d2] = pickDigitPair(minDigits, maxDigits, forceDifferentDigits);
  const v1 = randomOperand(d1);
  let v2 = randomOperand(d2);
  let a = Math.max(v1, v2);
  let b = Math.min(v1, v2);

  let guard = 0;
  while (a === b && guard < 30) {
    v2 = randomOperand(d2);
    a = Math.max(v1, v2);
    b = Math.min(v1, v2);
    guard++;
  }

  return { a, b, answer: a - b, symbol: "-" };
}

const OPERATIONS = {
  add: { generate: generateAdditionProblem, hasDifficulty: hasCarry },
  sub: { generate: generateSubtractionProblem, hasDifficulty: hasBorrow },
};

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

// 30% 쉬움(받아올림/받아내림 없음) / 70% 중상(있음) 비율로 문제를 채운다.
const EASY_RATIO = 0.3;
const MAX_ATTEMPTS_PER_PROBLEM = 800;

function generateSectionProblems(section, operation) {
  const { minDigits, maxDigits, count, forceDifferentDigits } = section;
  const easyCount = Math.round(count * EASY_RATIO);
  const wantHardFlags = shuffle([
    ...Array(easyCount).fill(false),
    ...Array(count - easyCount).fill(true),
  ]);

  const seen = new Set();
  const problems = [];

  for (const wantHard of wantHardFlags) {
    let problem = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROBLEM; attempt++) {
      const candidate = operation.generate(minDigits, maxDigits, forceDifferentDigits);
      if (operation.hasDifficulty(candidate.a, candidate.b) !== wantHard) continue;
      const key = `${candidate.a}${candidate.symbol}${candidate.b}`;
      if (seen.has(key) && attempt < MAX_ATTEMPTS_PER_PROBLEM - 1) continue;
      seen.add(key);
      problem = candidate;
      break;
    }
    problems.push(problem || operation.generate(minDigits, maxDigits, forceDifferentDigits));
  }

  return problems;
}

// Fixed worksheet spec: 2/3/4-digit x20, 5-digit x5, mixed 2~4-digit x20
const SECTIONS = [
  { minDigits: 2, maxDigits: 2, count: 20, columns: 4, forceDifferentDigits: false },
  { minDigits: 3, maxDigits: 3, count: 20, columns: 4, forceDifferentDigits: false },
  { minDigits: 4, maxDigits: 4, count: 20, columns: 3, forceDifferentDigits: false },
  { minDigits: 5, maxDigits: 5, count: 5, columns: 2, forceDifferentDigits: false },
  { minDigits: 2, maxDigits: 4, count: 20, columns: 3, forceDifferentDigits: true },
];

function buildProblemSet(opKey) {
  const operation = OPERATIONS[opKey];
  return SECTIONS.map((section) => ({
    columns: section.columns,
    problems: generateSectionProblems(section, operation),
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

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

const questionFormatter = (p) => `${formatNumber(p.a)} ${p.symbol} ${formatNumber(p.b)} = ______`;
const answerFormatter = (p) => formatNumber(p.answer);

const compareQuestionFormatter = (p) =>
  `${formatNumber(p.la)} × ${formatNumber(p.lb)} <span class="compare-blank"></span> ${formatNumber(p.ra)} × ${formatNumber(p.rb)}`;
const compareAnswerFormatter = (p) =>
  `${formatNumber(p.la)} × ${formatNumber(p.lb)} <span class="compare-symbol">${p.symbol}</span> ${formatNumber(p.ra)} × ${formatNumber(p.rb)}`;

function generateAndRender() {
  const addSet = buildProblemSet("add");
  const subSet = buildProblemSet("sub");
  const compareSet = buildComparisonProblemSet();

  renderPage(document.getElementById("addQuestionPage"), addSet, questionFormatter);
  renderPage(document.getElementById("addAnswerPage"), addSet, answerFormatter);
  renderPage(document.getElementById("subQuestionPage"), subSet, questionFormatter);
  renderPage(document.getElementById("subAnswerPage"), subSet, answerFormatter);
  renderPage(document.getElementById("compareQuestionPage"), compareSet, compareQuestionFormatter);
  renderPage(document.getElementById("compareAnswerPage"), compareSet, compareAnswerFormatter);
}

document.getElementById("generateBtn").addEventListener("click", generateAndRender);
document.getElementById("printBtn").addEventListener("click", () => window.print());

generateAndRender();
