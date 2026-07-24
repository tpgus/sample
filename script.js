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

function generateAndRender() {
  const addSet = buildProblemSet("add");
  const subSet = buildProblemSet("sub");

  renderPage(document.getElementById("addQuestionPage"), addSet, questionFormatter);
  renderPage(document.getElementById("addAnswerPage"), addSet, answerFormatter);
  renderPage(document.getElementById("subQuestionPage"), subSet, questionFormatter);
  renderPage(document.getElementById("subAnswerPage"), subSet, answerFormatter);
}

document.getElementById("generateBtn").addEventListener("click", generateAndRender);
document.getElementById("printBtn").addEventListener("click", () => window.print());

generateAndRender();
