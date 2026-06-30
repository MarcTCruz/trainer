import { init as initStorage, get, set, clearAll, flush } from './storage.js';
import { createEditor, getCode, setCode, onFormat, onChange } from './editor.js';
import {
  saveToken,
  getToken,
  clearToken,
  getSavedUser,
  validateAndFetchUser,
  isAuthenticated,
  GITHUB_TOKEN_URL
} from './github-auth.js';
import {
  saveSalesforceAuth,
  getSalesforceAuth,
  clearSalesforceAuth,
  getSavedSalesforceOrg,
  validateAndFetchOrg,
  isSalesforceConnected,
} from './salesforce-auth.js';
import { ensureRepo, pushSolution, pushProgress, syncOnLogin, getRepoVisibility, setRepoVisibility, pushReadme } from './github-sync.js';
import { ensureFork, pushSolutionToFork, fetchCIResults, deleteFork, VALIDATOR_REPO } from './ci-sync.js';
import { registerSW } from 'virtual:pwa-register';
import { initI18n, t, getLocale, setLocale, SUPPORTED_LOCALES } from './i18n.js';
import { evaluateExercise, ensureQuickJS } from './runner.js';
import { renderGeometry } from './geometry-render.js';
import { markSolved, getProgress, getSavedCode, saveDraft, normalizeCode, addBonusXp, recordAttempt, getDifficultyTier, recordSolveInAttempts } from './progress.js';
import { analyzeSolution } from './linter.js'
import { initDebugUI, startDebugSession, isDebugging } from './debugger/debugUI.js';
import { getCustomTests, addCustomTest, removeCustomTest } from './custom-tests.js';
import { LINT_RULES } from './lint-rules.js';
import {
  getExercise,
  getNextVariant,
  getVariantsOf,
  getCluster,
  getAllClusters,
  getAllTracks,
  getTrack,
  getTrackExercises
} from './exercise-loader.js';
import { fetchAggregateResults, computeCalibration, CALIBRATION_KEY } from './difficulty-calibration.js';
import { fetchLeaderboard, LEADERBOARD_KEY } from './leaderboard.js';

const CI_CONSENT_KEY = 'trainer_ci_consent';
const CI_PENDING_KEY = 'trainer_ci_pending';
const CI_RESULTS_KEY = 'trainer_ci_results';
const REPO_PUBLIC_KEY = 'trainer_repo_public';
const RIBBON_VIEW_KEY = 'trainer_ribbon_view';
const ENGINE_GEOMETRY = 'geometry';

const elements = {
  title: document.getElementById('exercise-title'),
  difficulty: document.getElementById('exercise-difficulty'),
  description: document.getElementById('exercise-description'),
  editorContainer: document.getElementById('editor-container'),
  runButton: document.getElementById('run-button'),
  resetButton: document.getElementById('reset-button'),
  formatButton: document.getElementById('format-button'),
  resultsContainer: document.getElementById('results-container'),
  statusBar: document.getElementById('status-message'),
  xpDisplay: document.getElementById('xp-value'),
  streakDisplay: document.getElementById('streak-value'),
  solvedDisplay: document.getElementById('solved-value'),
  hintButton: document.getElementById('hint-button'),
  hintContent: document.getElementById('hint-content'),
  wasmStatus: document.getElementById('wasm-status'),
  stepper: document.getElementById('evolution-stepper'),
  ribbon: document.getElementById('learning-ribbon'),
  browseButton: document.getElementById('browse-button'),
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  sidebarClose: document.getElementById('sidebar-close'),
  sidebarContent: document.getElementById('sidebar-content'),
  authSection: document.getElementById('auth-section'),
  signInButton: document.getElementById('sign-in-button'),
  authModal: document.getElementById('auth-modal'),
  authModalBackdrop: document.getElementById('auth-modal-backdrop'),
  authModalClose: document.getElementById('auth-modal-close'),
  authConnectButton: document.getElementById('auth-connect-button'),
  authCancelButton: document.getElementById('auth-cancel-button'),
  tokenInput: document.getElementById('token-input'),
  authError: document.getElementById('auth-error'),
  leaderboardButton: document.getElementById('leaderboard-button'),
  leaderboardPanel: document.getElementById('leaderboard-panel'),
  leaderboardBackdrop: document.getElementById('leaderboard-backdrop'),
  leaderboardClose: document.getElementById('leaderboard-close'),
  leaderboardContent: document.getElementById('leaderboard-content'),
  debugButton: document.getElementById('debug-button'),
  debugToolbar: document.getElementById('debug-toolbar'),
  debugPanel: document.getElementById('debug-panel'),
  dbgStepBack: document.getElementById('dbg-step-back'),
  dbgStepInto: document.getElementById('dbg-step-into'),
  dbgStepOver: document.getElementById('dbg-step-over'),
  dbgStepOut: document.getElementById('dbg-step-out'),
  dbgContinue: document.getElementById('dbg-continue'),
  dbgContinueBack: document.getElementById('dbg-continue-back'),
  dbgReset: document.getElementById('dbg-reset'),
  dbgPosition: document.getElementById('dbg-position'),
  dbgStop: document.getElementById('dbg-stop'),
  debugVarsContent: document.getElementById('debug-vars-content'),
  debugCallstackContent: document.getElementById('debug-callstack-content'),
  dbgTestPicker: document.getElementById('dbg-test-picker'),
  customTestsToggle: document.getElementById('custom-tests-toggle'),
  customTestsForm: document.getElementById('custom-tests-form'),
  customTestInput: document.getElementById('custom-test-input'),
  customTestExpected: document.getElementById('custom-test-expected'),
  customTestAdd: document.getElementById('custom-test-add'),
  customTestsList: document.getElementById('custom-tests-list'),
  autoFormatCheckbox: document.getElementById('auto-format-checkbox'),
  viewClusters: document.getElementById('view-clusters'),
  ribbonControls: document.getElementById('ribbon-controls'),
  sfModal: document.getElementById('sf-modal'),
  sfModalBackdrop: document.getElementById('sf-modal-backdrop'),
  sfModalClose: document.getElementById('sf-modal-close'),
  sfInstanceInput: document.getElementById('sf-instance-input'),
  sfTokenInput: document.getElementById('sf-token-input'),
  sfAuthError: document.getElementById('sf-auth-error'),
  sfConnectButton: document.getElementById('sf-connect-button'),
  sfCancelButton: document.getElementById('sf-cancel-button'),
  geometrySection: document.getElementById('debug-geometry'),
  geometryTitle: document.getElementById('debug-geometry-title'),
  geometryCanvas: document.getElementById('geometry-output'),
};

const LINT_RULE_META = Object.fromEntries(LINT_RULES.map(r => [r.id, { titleKey: r.titleKey, hintKey: r.hintKey, bonusXp: r.bonusXp }]));

let editor;
let currentHintIndex = 0;
let currentExercise = null;
let lastLintReport = null;
function resolveRibbonView(stored) {
  if (!stored || stored === 'clusters') return 'clusters';
  const validTrackIds = new Set(getAllTracks().map((track) => track.id));
  return validTrackIds.has(stored) ? stored : 'clusters';
}

let ribbonView = resolveRibbonView(get(RIBBON_VIEW_KEY));

function resolveStartExercise() {
  const progress = getProgress();
  const solved = progress.completedExercises;
  const allClusters = getAllClusters();
  for (const cluster of allClusters) {
    for (const entry of cluster.exercises) {
      if (!solved[entry.id]) return entry.id;
    }
  }
  return allClusters[0]?.exercises[0]?.id ?? 'valid-parentheses';
}

function loadExercise(id, keepCode = false) {
  const exercise = getExercise(id);
  if (!exercise) return;

  currentExercise = exercise;
  currentHintIndex = 0;

  elements.title.textContent = exercise.title;
  elements.difficulty.textContent = exercise.difficulty;
  elements.difficulty.dataset.level = exercise.difficulty.toLowerCase();
  const calibrated = get(CALIBRATION_KEY);
  if (calibrated?.[exercise.id]) {
    elements.difficulty.textContent = calibrated[exercise.id];
    elements.difficulty.dataset.level = calibrated[exercise.id].toLowerCase();
  }
  elements.description.innerHTML = formatDescription(exercise.description);

  const existingBadge = document.querySelector('.ci-badge');
  if (existingBadge) existingBadge.remove();

  const ciResults = get(CI_RESULTS_KEY);
  const ciStatus = ciResults?.exercises?.[exercise.id];
  const pending = get(CI_PENDING_KEY) ?? {};
  const progress = getProgress();
  const isSolvedLocally = Boolean(progress.completedExercises[exercise.id]);

  let badgeConfig = null;
  if (ciStatus?.status === 'pass') {
    badgeConfig = { cls: 'ci-badge-verified', text: t('ci.badgeVerified') };
  }
  if (!badgeConfig && ciStatus?.status === 'fail') {
    badgeConfig = { cls: 'ci-badge-fail', text: t('ci.badgeFail') };
  }
  if (!badgeConfig && pending[exercise.id] && isSolvedLocally) {
    badgeConfig = { cls: 'ci-badge-pending', text: t('ci.badgePending') };
  }
  if (!badgeConfig && isSolvedLocally) {
    badgeConfig = { cls: 'ci-badge-solved', text: t('ci.badgeSolved') };
  }

  if (badgeConfig) {
    const badge = document.createElement('span');
    badge.className = `ci-badge ${badgeConfig.cls}`;
    badge.textContent = badgeConfig.text;
    elements.title.parentElement.appendChild(badge);
  }

  if (!keepCode) {
    const savedCode = getSavedCode(exercise.id);
    if (editor) {
      setCode(editor, savedCode || exercise.starterCode);
    } else {
      editor = createEditor(elements.editorContainer, savedCode || exercise.starterCode);
    }
    window.__testEditor = { setCode: (code) => setCode(editor, code), getCode: () => getCode(editor) };
    window.__testStorageFlush = flush;
    window.__loadExercise = (id) => loadExercise(id, false);
  }

  elements.resultsContainer.innerHTML = '';
  elements.statusBar.textContent = '';
  elements.statusBar.className = 'status-message';
  elements.geometrySection.hidden = true;
  elements.hintContent.textContent = '';
  elements.hintContent.classList.remove('visible');
  elements.hintButton.textContent = t('hint.button', { current: 1, total: exercise.hints?.length ?? 0 });

  renderStepper();
  updateRibbon();
  updateProgressDisplay();
  renderCustomTestsList();
  populateTestPicker();
}

function formatDescription(desc) {
  return desc
    .split('\n')
    .map((line) => {
      if (line.startsWith('#')) return '';
      return line
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    })
    .filter(Boolean)
    .join('<br>');
}

function updateProgressDisplay() {
  const progress = getProgress();
  elements.xpDisplay.textContent = progress.xp;
  elements.streakDisplay.textContent = progress.streak;
  const solvedCount = Object.keys(progress.completedExercises).length;
  const ciResults = get(CI_RESULTS_KEY);
  const verifiedCount = ciResults?.exercises
    ? Object.values(ciResults.exercises).filter(e => e.status === 'pass').length
    : 0;
  elements.solvedDisplay.textContent = verifiedCount > 0 ? `${solvedCount} / ${verifiedCount}` : String(solvedCount);
}

function renderStepper() {
  const container = elements.stepper;
  if (!container || !currentExercise) return;

  const baseId = currentExercise.variantOf || currentExercise.id;
  const family = getVariantsOf(baseId);
  const progress = getProgress();
  const solved = progress.completedExercises;

  container.innerHTML = '';

  family.forEach((exercise, idx) => {
    const isSolved = Boolean(solved[exercise.id]);
    const isActive = exercise.id === currentExercise.id;
    const isFirst = idx === 0;
    const prevSolved = idx === 0 || Boolean(solved[family[idx - 1].id]);
    const isLocked = !isFirst && !prevSolved && !isSolved && !isActive;

    if (idx > 0) {
      const connector = document.createElement('div');
      connector.className = `stepper-connector${isSolved ? ' solved' : ''}`;
      container.appendChild(connector);
    }

    const node = document.createElement('button');
    node.className = `stepper-node${isSolved ? ' solved' : ''}${isActive ? ' active' : ''}`;
    node.type = 'button';

    if (isLocked) {
      node.setAttribute('aria-disabled', 'true');
    } else {
      node.setAttribute('aria-disabled', 'false');
    }

    if (isActive) {
      node.setAttribute('aria-current', 'step');
    }

    const icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.textContent = isSolved ? '✓' : isActive ? '●' : '○';
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = exercise.title;

    node.appendChild(icon);
    node.appendChild(label);

    node.addEventListener('click', () => {
      if (isLocked) return;
      if (exercise.id !== currentExercise.id) {
        loadExercise(exercise.id, false);
      }
    });

    container.appendChild(node);
  });
}

async function renderRibbon() {
  const container = elements.ribbon;
  if (!container || !currentExercise) return;

  const clusters = getAllClusters();
  const activeCluster = getCluster(currentExercise.id);
  const progress = getProgress();
  const solved = progress.completedExercises;

  const clusterRepIds = clusters.map((cluster) => {
    const firstUnsolved = cluster.exercises.find((e) => !solved[e.id]);
    return (firstUnsolved ?? cluster.exercises[0])?.id ?? null;
  });

  const tiers = await Promise.all(clusterRepIds.map((id) => (id ? getDifficultyTier(id) : Promise.resolve(null))));

  container.innerHTML = '';

  clusters.forEach((cluster, i) => {
    const isActive = cluster.id === activeCluster?.id;
    const total = cluster.exercises.length;
    const solvedCount = cluster.exercises.filter((e) => Boolean(solved[e.id])).length;
    const progressPct = total > 0 ? (solvedCount / total) * 100 : 0;

    const pill = document.createElement('button');
    pill.className = `ribbon-pill${isActive ? ' active' : ''}`;
    pill.type = 'button';
    pill.textContent = cluster.title;
    pill.setAttribute('aria-pressed', String(isActive));

    const bar = document.createElement('span');
    bar.className = 'ribbon-progress';
    bar.style.setProperty('--progress', progressPct / 100);
    bar.setAttribute('aria-hidden', 'true');

    pill.appendChild(bar);

    const tier = tiers[i];
    if (tier) {
      const dot = document.createElement('span');
      dot.className = `difficulty-dot ${tier}`;
      dot.title = t(`difficulty.${tier}`);
      dot.setAttribute('aria-hidden', 'true');
      pill.appendChild(dot);
    }

    pill.addEventListener('click', () => {
      if (isActive) return;
      const firstUnsolved = cluster.exercises.find((e) => !solved[e.id]);
      const target = firstUnsolved ?? cluster.exercises[0];
      if (target) loadExercise(target.id, false);
    });

    container.appendChild(pill);
  });
}

async function renderTrackRibbon(trackId) {
  const container = elements.ribbon;
  if (!container) return;

  const trackDays = getTrackExercises(trackId);
  if (!trackDays.length) return;

  const progress = getProgress();
  const solved = progress.completedExercises;

  const tiers = await Promise.all(trackDays.map((d) => getDifficultyTier(d.exerciseId)));

  container.innerHTML = '';

  trackDays.forEach((dayEntry, idx) => {
    const isSolved = Boolean(solved[dayEntry.exerciseId]);
    const prevSolved = idx === 0 || Boolean(solved[trackDays[idx - 1].exerciseId]);
    const isLocked = idx > 0 && !prevSolved;
    const isActive = currentExercise?.id === dayEntry.exerciseId;

    const pill = document.createElement('button');
    pill.className = `ribbon-pill track-day${isActive ? ' active' : ''}${isSolved ? ' solved' : ''}${isLocked ? ' locked' : ''}`;
    pill.type = 'button';
    pill.disabled = isLocked;
    pill.setAttribute('aria-pressed', String(isActive));
    if (isLocked) pill.setAttribute('aria-disabled', 'true');

    const dayLabel = document.createElement('span');
    dayLabel.className = 'track-day-num';
    dayLabel.textContent = t('ribbon.trackDay', { day: dayEntry.day });

    const structLabel = document.createElement('span');
    structLabel.className = 'track-day-label';
    structLabel.textContent = t('ribbon.trackDayStructure', { structure: dayEntry.structure });

    pill.appendChild(dayLabel);
    pill.appendChild(structLabel);

    if (dayEntry.revisits?.length) {
      const revisitLabel = document.createElement('span');
      revisitLabel.className = 'track-day-revisit';
      revisitLabel.textContent = t('ribbon.revisit');
      revisitLabel.title = dayEntry.revisits.map(r => r.replace('day-', 'Day ')).join(', ');
      pill.appendChild(revisitLabel);
    }

    const tier = tiers[idx];
    if (tier) {
      const dot = document.createElement('span');
      dot.className = `difficulty-dot ${tier}`;
      dot.title = t(`difficulty.${tier}`);
      dot.setAttribute('aria-hidden', 'true');
      pill.appendChild(dot);
    }

    if (!isLocked) {
      pill.addEventListener('click', () => {
        loadExercise(dayEntry.exerciseId, false);
      });
    }

    container.appendChild(pill);
  });
}

function updateRibbon() {
  if (ribbonView === 'clusters') {
    renderRibbon();
    return;
  }
  renderTrackRibbon(ribbonView);
}

const HINT_BASE_DELAY_MS = 0;

const DIFFICULTY_HINT_MULTIPLIER = {
  easy: 1.5,
  medium: 1,
  hard: 0.5,
};


function syncViewToggle() {
  if (!elements.ribbonControls) return;
  elements.ribbonControls.querySelectorAll('.ribbon-view-btn').forEach((btn) => {
    const btnView = btn.dataset.trackId ?? 'clusters';
    const isActive = ribbonView === btnView;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function showEvolutionPrompt(nextVariant, forwardResult) {
  dismissEvolutionPrompt();

  const card = document.createElement('div');
  card.className = 'evolution-prompt';
  card.id = 'evolution-prompt';
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');

  const heading = document.createElement('h3');
  heading.textContent = t('evolution.heading');

  const text = document.createElement('p');
  text.textContent =
    nextVariant.variantPrompt ||
    t('evolution.prompt', { title: nextVariant.title });

  card.appendChild(heading);
  card.appendChild(text);

  if (forwardResult && forwardResult.results.length > 0) {
    const passCount = forwardResult.results.filter((r) => r.passed).length;
    const totalCount = forwardResult.results.length;
    if (passCount > 0) {
      const indicator = document.createElement('p');
      indicator.className = 'forward-test-indicator';
      indicator.id = 'forward-test-indicator';
      indicator.textContent = t('evolution.forwardIndicator', { passCount, totalCount });
      card.appendChild(indicator);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'prompt-actions';

  const evolveBtn = document.createElement('button');
  evolveBtn.className = 'btn btn-primary';
  evolveBtn.type = 'button';
  evolveBtn.textContent = t('evolution.evolve', { title: nextVariant.title });
  evolveBtn.addEventListener('click', () => {
    dismissEvolutionPrompt();
    loadExercise(nextVariant.id, true);
  });

  const stayBtn = document.createElement('button');
  stayBtn.className = 'btn btn-secondary';
  stayBtn.type = 'button';
  stayBtn.textContent = t('evolution.stay');
  stayBtn.addEventListener('click', dismissEvolutionPrompt);

  actions.appendChild(evolveBtn);
  actions.appendChild(stayBtn);

  card.appendChild(actions);

  elements.resultsContainer.appendChild(card);
}

function dismissEvolutionPrompt() {
  const existing = document.getElementById('evolution-prompt');
  if (existing) existing.remove();
}

async function runDebugTrace() {
  const userCode = getCode(editor)
  const customTests = getCustomTests(currentExercise.id)
  const mergedExercise = customTests.length > 0
    ? { ...currentExercise, testCases: [...currentExercise.testCases, ...customTests] }
    : currentExercise
  const pickerIdx = parseInt(elements.dbgTestPicker.value, 10)
  const testIndex = Number.isFinite(pickerIdx) ? pickerIdx : 0
  await startDebugSession(userCode, mergedExercise, editor, testIndex)
}

async function handleDebug() {
  await runDebugTrace()
}

async function handleTestPickerChange() {
  if (!isDebugging()) return
  await runDebugTrace()
}

function populateTestPicker() {
  const picker = elements.dbgTestPicker
  picker.innerHTML = ''
  const defaults = currentExercise.testCases
  const custom = getCustomTests(currentExercise.id)
  const fnName = currentExercise.functionName

  defaults.forEach((tc, i) => {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = `${fnName}(${tc.input.map(v => JSON.stringify(v)).join(', ')})`
    picker.appendChild(opt)
  })

  custom.forEach((tc, i) => {
    const opt = document.createElement('option')
    opt.value = String(defaults.length + i)
    opt.textContent = `${t('customTest.prefix')} ${fnName}(${tc.input.map(v => JSON.stringify(v)).join(', ')})`
    picker.appendChild(opt)
  })
}

function renderCustomTestsList() {
  const container = elements.customTestsList
  container.innerHTML = ''
  const tests = getCustomTests(currentExercise.id)
  const fnName = currentExercise.functionName

  for (let i = 0; i < tests.length; i++) {
    const tc = tests[i]
    const item = document.createElement('div')
    item.className = 'custom-test-item'

    const badge = document.createElement('span')
    badge.className = 'custom-test-badge'
    badge.textContent = t('customTest.badge')

    const body = document.createElement('span')
    body.className = 'custom-test-body'
    const args = tc.input.map(v => JSON.stringify(v)).join(', ')
    body.textContent = `${fnName}(${args}) → ${JSON.stringify(tc.expected)}`

    const del = document.createElement('button')
    del.className = 'custom-test-delete'
    del.type = 'button'
    del.textContent = '✕'
    del.addEventListener('click', () => {
      removeCustomTest(currentExercise.id, i)
      renderCustomTestsList()
      populateTestPicker()
    })

    item.appendChild(badge)
    item.appendChild(body)
    item.appendChild(del)
    container.appendChild(item)
  }
}

function handleAddCustomTest() {
  const rawInput = elements.customTestInput.value.trim()
  const rawExpected = elements.customTestExpected.value.trim()
  if (!rawInput && !rawExpected) return

  let input, expected
  try {
    input = [JSON.parse(rawInput)]
  } catch {
    try {
      input = JSON.parse(`[${rawInput}]`)
    } catch {
      input = [rawInput]
    }
  }
  try {
    expected = JSON.parse(rawExpected)
  } catch {
    expected = rawExpected
  }

  addCustomTest(currentExercise.id, input, expected)
  elements.customTestInput.value = ''
  elements.customTestExpected.value = ''
  renderCustomTestsList()
  populateTestPicker()
}

async function handleRun() {
  elements.runButton.disabled = true;
  elements.runButton.textContent = t('run.running');
  elements.resultsContainer.innerHTML = '';
  elements.statusBar.textContent = '';
  elements.statusBar.className = 'status-message';

  elements.wasmStatus.textContent = t('run.loadingWasm');
  elements.wasmStatus.classList.add('visible');

  try {
    await ensureQuickJS();
    elements.wasmStatus.textContent = t('run.executing');

    const userCode = getCode(editor);
    await recordAttempt(currentExercise.id);
    const customTests = getCustomTests(currentExercise.id);
    const mergedExercise = customTests.length > 0
      ? { ...currentExercise, testCases: [...currentExercise.testCases, ...customTests] }
      : currentExercise;
    const defaultCount = currentExercise.testCases.length;
    const result = await evaluateExercise(mergedExercise, userCode);

    result.results.forEach((r, i) => { r.isCustom = i >= defaultCount; });

    elements.wasmStatus.classList.remove('visible');
    renderResults(result);

    elements.geometrySection.hidden = currentExercise.engine !== ENGINE_GEOMETRY;
    if (currentExercise.engine === ENGINE_GEOMETRY) {
      const allActuals = result.results.map(r => r.actual).filter(Boolean);
      const shapes = allActuals.flat();
      elements.debugPanel.hidden = false;
      renderGeometry(elements.geometryCanvas, shapes);
    }

    const defaultResults = result.results.filter(r => !r.isCustom);
    if (result.error) {
      elements.statusBar.textContent = t('run.error', { error: result.error });
      elements.statusBar.className = 'status-message error';
    } else if (defaultResults.every(r => r.passed)) {
      markSolved(currentExercise.id, userCode);
      recordSolveInAttempts(currentExercise.id);
      lastLintReport = analyzeSolution(userCode);
      addBonusXp(currentExercise.id, lastLintReport.score);
      renderLintResults(lastLintReport);
      if (isAuthenticated()) {
        const token = getToken();
        const user = getSavedUser();
        if (token && user) {
          ensureRepo(token, user.login)
            .then(() => Promise.all([
              pushSolution(token, user.login, currentExercise.id, userCode),
              pushProgress(token, user.login, getProgress())
            ]))
            .catch(err => console.warn('Sync failed:', err.message));
          if (get(CI_CONSENT_KEY)) {
            pushToCI(token, user.login, currentExercise.id, userCode);
          }
          if (!get(CI_CONSENT_KEY)) {
            showCIConsentPrompt(() => {
              const tkn = getToken();
              const usr = getSavedUser();
              if (tkn && usr) pushToCI(tkn, usr.login, currentExercise.id, userCode);
            });
          }
        }
      }
      updateProgressDisplay();
      renderStepper();
      updateRibbon();
      elements.statusBar.textContent = t('run.allPassed');
      elements.statusBar.className = 'status-message success';

      const nextVariant = getNextVariant(currentExercise.id);
      if (nextVariant) {
        // Forward-test: silently run user code against next variant's tests
        let forwardResult = null;
        try {
          let forwardCode = userCode;
          if (nextVariant.functionName !== currentExercise.functionName) {
            forwardCode += `\nvar ${nextVariant.functionName} = ${currentExercise.functionName};`;
          }
          forwardResult = await evaluateExercise(nextVariant, forwardCode);
        } catch {
          // Silent — forward-testing is purely informational
        }
        showEvolutionPrompt(nextVariant, forwardResult);
      }
    } else {
      const passCount = result.results.filter((r) => r.passed).length;
      elements.statusBar.textContent = t('run.partial', { passCount, totalCount: result.results.length });
      elements.statusBar.className = 'status-message partial';
    }
  } catch (err) {
    elements.wasmStatus.classList.remove('visible');
    elements.statusBar.textContent = t('run.runnerError', { message: err.message });
    elements.statusBar.className = 'status-message error';
  } finally {
    elements.runButton.disabled = false;
    elements.runButton.textContent = t('run.runCode');
  }
}

function renderResults(result) {
  const container = elements.resultsContainer;
  container.innerHTML = '';

  if (result.error && result.results.length === 0) {
    const errorEl = document.createElement('div');
    errorEl.className = 'test-result error';
    errorEl.innerHTML = `<span class="result-icon">!</span> <span class="result-text">${escapeHtml(result.error)}</span>`;
    container.appendChild(errorEl);
    return;
  }

  const fnName = currentExercise.functionName;
  const paramNames = currentExercise.params ?? ['input'];

  result.results.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = `test-result ${r.passed ? 'pass' : 'fail'}${r.isCustom ? ' custom' : ''}`;

    const icon = r.passed ? '✓' : '✗';
    const verdict = r.passed ? t('test.pass') : t('test.fail');
    const args = r.input.map((v) => JSON.stringify(v)).join(', ');

    let detail = `<span class="result-icon">${icon}</span>`;
    detail += `<span class="result-verdict">${verdict}</span>`;
    if (r.isCustom) detail += `<span class="custom-test-badge">custom</span>`;
    detail += `<span class="result-label">${t('test.label', { index: i + 1 })}</span>`;
    detail += `<span class="result-input">${escapeHtml(fnName)}(${escapeHtml(args)})</span>`;

    if (!r.passed) {
      if (r.error) {
        detail += `<span class="result-error">${t('test.errorPrefix', { error: escapeHtml(r.error) })}</span>`;
      } else {
        detail += `<span class="result-expected">${t('test.expected', { value: escapeHtml(formatValue(r.expected)) })}</span>`;
        detail += `<span class="result-actual">${t('test.got', { value: escapeHtml(formatValue(r.actual)) })}</span>`;
      }
    }

    el.innerHTML = detail;
    container.appendChild(el);
  });
}

function createLintHeader(report) {
  const header = document.createElement('div');
  header.className = 'lint-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');

  const icon = document.createElement('span');
  icon.className = 'lint-header-icon';
  icon.textContent = '✨';

  const title = document.createElement('span');
  title.className = 'lint-header-title';
  title.textContent = t('lint.title');

  const score = document.createElement('span');
  score.className = 'lint-header-score';
  score.textContent = `${report.score}/${report.maxScore} XP`;

  const ratio = document.createElement('span');
  ratio.className = 'lint-header-ratio';
  ratio.textContent = `${report.passedCount}/${report.totalRules}`;

  const toggle = document.createElement('span');
  toggle.className = 'lint-header-toggle';
  toggle.textContent = '▼';

  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(score);
  header.appendChild(ratio);
  header.appendChild(toggle);
  return header;
}

function createLintRuleElement(rule, meta) {
  const row = document.createElement('div');
  row.className = `lint-rule ${rule.passed ? 'pass' : 'fail'}`;

  const icon = document.createElement('span');
  icon.className = 'lint-rule-icon';
  icon.textContent = rule.passed ? '✓' : '✗';

  const ruleTitle = document.createElement('span');
  ruleTitle.className = 'lint-rule-title';
  ruleTitle.textContent = t(meta.titleKey);

  row.appendChild(icon);
  row.appendChild(ruleTitle);

  if (rule.passed) {
    const xp = document.createElement('span');
    xp.className = 'lint-rule-xp';
    xp.textContent = t('lint.bonusXp', { xp: rule.bonusXp });
    row.appendChild(xp);
    return { row, hint: null };
  }

  const violations = document.createElement('span');
  violations.className = 'lint-rule-violations';
  violations.textContent = `— ${rule.violations.map(v => escapeHtml(v)).join(', ')}`;
  row.appendChild(violations);

  const hint = document.createElement('div');
  hint.className = 'lint-hint';
  hint.textContent = t(meta.hintKey);

  row.addEventListener('click', () => hint.classList.toggle('visible'));

  return { row, hint };
}

function renderLintResults(report) {
  const section = document.createElement('div');
  section.className = 'lint-section';

  const header = createLintHeader(report);
  header.addEventListener('click', () => section.classList.toggle('collapsed'));

  const body = document.createElement('div');
  body.className = 'lint-body';

  report.rules.forEach(rule => {
    const meta = LINT_RULE_META[rule.id];
    if (!meta) return;
    const { row, hint } = createLintRuleElement(rule, meta);
    body.appendChild(row);
    if (hint) body.appendChild(hint);
  });

  section.appendChild(header);
  section.appendChild(body);
  elements.resultsContainer.appendChild(section);
}

function openAuthModal() {
  elements.authModal.classList.add('open');
  elements.authModalBackdrop.classList.add('open');
  elements.tokenInput.value = '';
  elements.authError.textContent = '';
  elements.tokenInput.focus();
}

function closeAuthModal() {
  elements.authModal.classList.remove('open');
  elements.authModalBackdrop.classList.remove('open');
}

function openSalesforceModal() {
  elements.sfModal.classList.add('open');
  elements.sfModalBackdrop.classList.add('open');
  elements.sfInstanceInput.value = '';
  elements.sfTokenInput.value = '';
  elements.sfAuthError.textContent = '';
  elements.sfInstanceInput.focus();
}

function closeSalesforceModal() {
  elements.sfModal.classList.remove('open');
  elements.sfModalBackdrop.classList.remove('open');
}

async function handleSalesforceConnect() {
  const instanceUrl = elements.sfInstanceInput.value.trim();
  const accessToken = elements.sfTokenInput.value.trim();

  if (!instanceUrl || !accessToken) {
    elements.sfAuthError.textContent = t('sf.emptyFields');
    return;
  }

  elements.sfConnectButton.disabled = true;
  elements.sfConnectButton.textContent = t('sf.connecting');
  elements.sfAuthError.textContent = '';

  try {
    await validateAndFetchOrg(instanceUrl, accessToken);
    saveSalesforceAuth({ instanceUrl, accessToken });
    closeSalesforceModal();
    renderAuthState();
  } catch {
    elements.sfAuthError.textContent = t('sf.invalidToken');
  } finally {
    elements.sfConnectButton.disabled = false;
    elements.sfConnectButton.textContent = t('sf.connect');
  }
}

function handleSalesforceDisconnect() {
  clearSalesforceAuth();
  renderAuthState();
}

function makeButton(id, className, labelKey) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.id = id;
  btn.type = 'button';
  btn.textContent = t(labelKey);
  return btn;
}

function makeShareLink(user) {
  const shareLink = makeButton('share-solutions-button', 'btn btn-ghost', 'share.shareLink');
  shareLink.addEventListener('click', () => {
    const url = `https://github.com/${user.login}/refactory-solutions`;
    navigator.clipboard.writeText(url).then(() => {
      shareLink.textContent = t('share.linkCopied');
      setTimeout(() => { shareLink.textContent = t('share.shareLink'); }, 2000);
    });
  });
  return shareLink;
}

async function onToggleClick(wrap, btn, token, user, makePublic) {
  btn.disabled = true;
  btn.textContent = t(makePublic ? 'share.makingPublic' : 'share.makingPrivate');
  try {
    await setRepoVisibility(token, user.login, makePublic);
    if (makePublic) await pushReadme(token, user.login, getProgress());
    set(REPO_PUBLIC_KEY, makePublic ? true : null);
    showPwaToast(makePublic ? 'share.publishedToast' : 'share.hiddenToast');
    wrap.innerHTML = '';
    fillControl(wrap, token, user, makePublic);
  } catch (err) {
    console.warn('setRepoVisibility failed:', err.message);
    btn.disabled = false;
    btn.textContent = t(makePublic ? 'share.makePublic' : 'share.makePrivate');
    showPwaToast('share.visibilityError');
  }
}

function fillControl(wrap, token, user, isPublic) {
  if (isPublic) {
    const badge = document.createElement('span');
    badge.id = 'repo-visibility-badge';
    badge.className = 'visibility-badge';
    badge.textContent = t('share.publicBadge');
    wrap.appendChild(badge);
  }

  const toggleBtn = makeButton(
    'visibility-toggle-button',
    'btn btn-ghost',
    isPublic ? 'share.makePrivate' : 'share.makePublic',
  );
  toggleBtn.addEventListener('click', () => onToggleClick(wrap, toggleBtn, token, user, !isPublic));
  wrap.appendChild(toggleBtn);

  if (!isPublic) return;

  wrap.appendChild(makeShareLink(user));
}

function renderVisibilityToggle(section, token, user) {
  const wrap = document.createElement('span');
  wrap.className = 'visibility-control';

  const loading = document.createElement('span');
  loading.id = 'visibility-loading';
  loading.textContent = t('share.checkingVisibility');
  wrap.appendChild(loading);

  section.appendChild(wrap);

  (async () => {
    try {
      const { isPublic } = await getRepoVisibility(token, user.login);
      wrap.innerHTML = '';
      fillControl(wrap, token, user, isPublic);
    } catch (err) {
      console.warn('getRepoVisibility failed:', err.message);
      wrap.innerHTML = '';
      fillControl(wrap, token, user, false);
    }
  })();
}

function renderClearDataButton(section, token, user) {
  const clearBtn = makeButton('clear-data-button', 'btn btn-ghost btn-danger', 'data.clearButton');

  clearBtn.addEventListener('click', () => {
    renderDeleteForkConfirm(section, token, user);
  });

  section.appendChild(clearBtn);
}

function renderDeleteForkConfirm(section, token, user) {
  if (document.getElementById('clear-confirm-card')) return;

  const repoFullName = `${user.login}/${VALIDATOR_REPO}`;

  const card = document.createElement('div');
  card.className = 'ci-consent-card';
  card.id = 'clear-confirm-card';

  const heading = document.createElement('strong');
  heading.textContent = t('data.clearConfirmHeading');

  const text = document.createElement('p');
  text.textContent = t('data.clearConfirmText', { repo: repoFullName });

  const instruction = document.createElement('p');
  instruction.textContent = t('data.clearConfirmTypeName', { repo: repoFullName });

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'clear-confirm-input';
  input.setAttribute('aria-label', t('data.clearConfirmTypeName', { repo: repoFullName }));

  const deleteBtn = document.createElement('button');
  deleteBtn.id = 'clear-confirm-action';
  deleteBtn.className = 'btn btn-ghost btn-danger';
  deleteBtn.type = 'button';
  deleteBtn.textContent = t('data.clearConfirmAction');
  deleteBtn.disabled = true;

  input.addEventListener('input', () => {
    deleteBtn.disabled = input.value.trim() !== repoFullName;
  });

  deleteBtn.addEventListener('click', () => handleDeleteFork(section, token, user));

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.type = 'button';
  cancelBtn.textContent = t('data.clearConfirmCancel');
  cancelBtn.addEventListener('click', () => renderAuthState());

  card.appendChild(heading);
  card.appendChild(text);
  card.appendChild(instruction);
  card.appendChild(input);
  card.appendChild(deleteBtn);
  card.appendChild(cancelBtn);
  section.appendChild(card);
}

async function handleDeleteFork(section, token, user) {
  const repoFullName = `${user.login}/${VALIDATOR_REPO}`;

  try {
    await deleteFork(token, user.login);
  } catch (err) {
    const card = document.getElementById('clear-confirm-card');
    const errorMsg = document.createElement('p');
    errorMsg.textContent = t('data.clearError');
    card.appendChild(errorMsg);
    const deleteBtn = document.getElementById('clear-confirm-action');
    deleteBtn.disabled = false;
    return;
  }

  const card = document.getElementById('clear-confirm-card');
  card.remove();

  const msg = document.createElement('div');
  msg.className = 'clear-done-message';
  msg.id = 'clear-done-message';

  const done = document.createElement('p');
  done.textContent = t('data.clearDone', { repo: repoFullName });

  const revokeLink = document.createElement('a');
  revokeLink.href = 'https://github.com/settings/tokens';
  revokeLink.target = '_blank';
  revokeLink.rel = 'noopener noreferrer';
  revokeLink.textContent = t('data.revokeToken');

  msg.appendChild(done);
  msg.appendChild(revokeLink);
  section.appendChild(msg);
}

function renderStoragePolicyLink(section) {
  const link = document.createElement('button');
  link.id = 'storage-policy-button';
  link.type = 'button';
  link.className = 'info-link';

  const icon = document.createElement('span');
  icon.className = 'info-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'ⓘ';

  const label = document.createElement('span');
  label.textContent = t('data.storagePolicyButton');

  link.appendChild(icon);
  link.appendChild(label);

  let infoVisible = false;

  const info = document.createElement('div');
  info.className = 'your-data-info';
  info.hidden = true;

  const lines = [
    'data.browserStorage',
    'data.githubRepos',
    'data.retention',
    'data.deletion',
  ];

  for (const key of lines) {
    const p = document.createElement('p');
    p.textContent = t(key);
    info.appendChild(p);
  }

  link.addEventListener('click', () => {
    infoVisible = !infoVisible;
    info.hidden = !infoVisible;
  });

  section.appendChild(link);
  section.appendChild(info);
}

function renderAuthState() {
  const section = elements.authSection;
  section.innerHTML = '';

  if (!isAuthenticated()) {
    const signIn = makeButton('sign-in-button', 'btn btn-ghost', 'auth.signIn');
    signIn.addEventListener('click', openAuthModal);
    section.appendChild(signIn);
    return;
  }

  const user = getSavedUser();
  if (!user) return;

  const container = document.createElement('div');
  container.className = 'auth-user';

  const avatar = document.createElement('img');
  avatar.className = 'auth-avatar';
  avatar.src = user.avatar_url;
  avatar.alt = user.login;

  const username = document.createElement('span');
  username.className = 'auth-username';
  username.id = 'auth-username';
  username.textContent = user.login;

  container.appendChild(avatar);
  container.appendChild(username);
  section.appendChild(container);

  const actions = document.createElement('div');
  actions.className = 'auth-actions';

  const signOut = makeButton('sign-out-button', 'btn btn-ghost', 'auth.signOut');
  signOut.addEventListener('click', handleSignOut);
  actions.appendChild(signOut);

  if (get(CI_CONSENT_KEY)) {
    const shareBtn = makeButton('share-verification-button', 'btn btn-ghost', 'share.button');
    shareBtn.addEventListener('click', () => {
      const url = `https://github.com/MarcTCruz/refactory-validator/blob/main/results/${user.login}.json`;
      navigator.clipboard.writeText(url).then(() => {
        shareBtn.textContent = t('share.copied');
        setTimeout(() => { shareBtn.textContent = t('share.button'); }, 2000);
      });
    });
    actions.appendChild(shareBtn);
  }

  const token = getToken();
  renderVisibilityToggle(actions, token, user);
  renderClearDataButton(actions, token, user);
  renderStoragePolicyLink(actions);

  section.appendChild(actions);

  renderSalesforceSection(section);
}

function renderSalesforceSection(section) {
  if (isSalesforceConnected()) {
    const org = getSavedSalesforceOrg();
    const sfRow = document.createElement('div');
    sfRow.className = 'auth-actions';

    if (org) {
      const orgInfo = document.createElement('div');
      orgInfo.className = 'sf-org-info';

      const displayName = document.createElement('span');
      displayName.className = 'sf-org-display-name';
      displayName.textContent = `${t('sf.connectedAs')}: ${org.displayName}`;

      const username = document.createElement('span');
      username.className = 'sf-org-username';
      username.textContent = org.username;

      orgInfo.appendChild(displayName);
      orgInfo.appendChild(username);
      sfRow.appendChild(orgInfo);
    }

    const disconnectBtn = makeButton('sf-disconnect-button', 'btn btn-ghost btn-danger', 'sf.disconnect');
    disconnectBtn.addEventListener('click', handleSalesforceDisconnect);
    sfRow.appendChild(disconnectBtn);

    section.appendChild(sfRow);
    return;
  }

  const connectBtn = makeButton('sf-connect-entry-button', 'btn btn-ghost', 'sf.connect');
  connectBtn.addEventListener('click', openSalesforceModal);

  const sfRow = document.createElement('div');
  sfRow.className = 'auth-actions';
  sfRow.appendChild(connectBtn);
  section.appendChild(sfRow);
}

async function handleConnect() {
  const token = elements.tokenInput.value.trim();
  if (!token) {
    elements.authError.textContent = t('auth.emptyToken');
    return;
  }

  elements.authConnectButton.disabled = true;
  elements.authConnectButton.textContent = t('auth.connecting');
  elements.authError.textContent = '';

  try {
    await validateAndFetchUser(token);
    saveToken(token);
    closeAuthModal();
    renderAuthState();
    const user = getSavedUser();
    if (user) {
      syncOnLogin(getToken(), user.login)
        .then(() => updateProgressDisplay())
        .catch(err => console.warn('Sync on login failed:', err.message));
      if (get(CI_CONSENT_KEY)) {
        fetchCIResults(user.login)
          .then(results => {
            if (!results) return;
            set(CI_RESULTS_KEY, results);
            const pending = get(CI_PENDING_KEY);
            if (pending && results.exercises) {
              for (const id of Object.keys(results.exercises)) {
                delete pending[id];
              }
              set(CI_PENDING_KEY, pending);
            }
            loadExercise(currentExercise?.id ?? resolveStartExercise(), true);
          })
          .catch(err => console.warn('CI results fetch failed:', err.message));
      }
    }
  } catch {
    elements.authError.textContent = t('auth.invalidToken');
  } finally {
    elements.authConnectButton.disabled = false;
    elements.authConnectButton.textContent = t('auth.connect');
  }
}

function handleSignOut() {
  clearToken();
  renderAuthState();
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function pushToCI(token, owner, exerciseId, code) {
  const pending = get(CI_PENDING_KEY) ?? {};
  const codeHash = simpleHash(normalizeCode(code));
  if (pending[exerciseId] === codeHash) return;

  pending[exerciseId] = codeHash;
  set(CI_PENDING_KEY, pending);

  ensureFork(token, owner)
    .then(() => pushSolutionToFork(token, owner, exerciseId, code))
    .catch(err => console.warn('CI sync failed:', err.message));
}

function showCIConsentPrompt(onAccept) {
  const existing = document.getElementById('ci-consent-prompt');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'ci-consent-backdrop';
  overlay.id = 'ci-consent-prompt';

  const card = document.createElement('div');
  card.className = 'ci-consent-card';

  const heading = document.createElement('h3');
  heading.textContent = t('ci.consentHeading');

  const text = document.createElement('p');
  text.textContent = t('ci.consentText');

  const actions = document.createElement('div');
  actions.className = 'ci-consent-actions';

  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'btn btn-primary';
  acceptBtn.type = 'button';
  acceptBtn.textContent = t('ci.consentAccept');
  acceptBtn.addEventListener('click', () => {
    set(CI_CONSENT_KEY, true);
    overlay.remove();
    onAccept();
  });

  const declineBtn = document.createElement('button');
  declineBtn.className = 'btn btn-secondary';
  declineBtn.type = 'button';
  declineBtn.textContent = t('ci.consentDecline');
  declineBtn.addEventListener('click', () => {
    overlay.remove();
  });

  actions.appendChild(acceptBtn);
  actions.appendChild(declineBtn);
  card.appendChild(heading);
  card.appendChild(text);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function toggleSidebar() {
  const isOpen = elements.sidebar.classList.toggle('open');
  elements.sidebarBackdrop.classList.toggle('open', isOpen);
  elements.browseButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) renderSidebar();
}

function closeSidebar() {
  elements.sidebar.classList.remove('open');
  elements.sidebarBackdrop.classList.remove('open');
  elements.browseButton.setAttribute('aria-expanded', 'false');
}

function renderSidebar() {
  const container = elements.sidebarContent;
  if (!container || !currentExercise) return;

  const clusters = getAllClusters();
  const progress = getProgress();
  const solved = progress.completedExercises;

  container.innerHTML = '';

  clusters.forEach((cluster) => {
    const clusterDiv = document.createElement('div');
    clusterDiv.className = 'sidebar-cluster';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'sidebar-cluster-title';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = cluster.title;

    const solvedCount = cluster.exercises.filter((e) => Boolean(solved[e.id])).length;
    const progressSpan = document.createElement('span');
    progressSpan.className = 'sidebar-cluster-progress';
    progressSpan.textContent = `${solvedCount}/${cluster.exercises.length}`;

    titleDiv.appendChild(titleSpan);
    titleDiv.appendChild(progressSpan);
    clusterDiv.appendChild(titleDiv);

    cluster.exercises.forEach((entry, idx) => {
      const exercise = getExercise(entry.id);
      if (!exercise) return;

      const isSolved = Boolean(solved[entry.id]);
      const isActive = entry.id === currentExercise.id;
      const isVariant = entry.type === 'variant';
      const prevSolved = idx === 0 || Boolean(solved[cluster.exercises[idx - 1].id]);
      const isLocked = idx > 0 && !prevSolved && !isSolved && !isActive;

      const btn = document.createElement('button');
      btn.className = 'sidebar-exercise';
      if (isSolved) btn.classList.add('solved');
      if (isActive) btn.classList.add('active');
      if (isVariant) btn.classList.add('sidebar-exercise-variant');
      btn.type = 'button';

      if (isLocked) {
        btn.setAttribute('aria-disabled', 'true');
      }

      const icon = document.createElement('span');
      icon.className = 'sidebar-exercise-icon';
      icon.textContent = isSolved ? '✓' : isActive ? '●' : '○';
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = exercise.title;

      btn.appendChild(icon);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        if (isLocked) return;
        loadExercise(entry.id, false);
        closeSidebar();
      });

      clusterDiv.appendChild(btn);
    });

    container.appendChild(clusterDiv);
  });
}

function toggleLeaderboard() {
  const isOpen = elements.leaderboardPanel.classList.toggle('open');
  elements.leaderboardBackdrop.classList.toggle('open', isOpen);
  if (isOpen) renderLeaderboard();
}

function closeLeaderboard() {
  elements.leaderboardPanel.classList.remove('open');
  elements.leaderboardBackdrop.classList.remove('open');
}

function streakBadge(streak) {
  if (streak >= 100) return { emoji: '💎', key: 'leaderboard.streak100' };
  if (streak >= 30)  return { emoji: '⭐', key: 'leaderboard.streak30' };
  if (streak >= 7)   return { emoji: '🔥', key: 'leaderboard.streak7' };
  return null;
}

function buildLeaderboardFilter(cached, onFilter) {
  const select = document.createElement('select');
  select.className = 'leaderboard-filter';

  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = t('leaderboard.filterAll');
  select.appendChild(allOpt);

  getAllTracks().forEach(track => {
    const opt = document.createElement('option');
    opt.value = `track:${track.id}`;
    opt.textContent = t('leaderboard.filterTrack');
    select.appendChild(opt);
  });

  getAllClusters().forEach(cluster => {
    const opt = document.createElement('option');
    opt.value = `cluster:${cluster.id}`;
    opt.textContent = cluster.title;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => onFilter(select.value, cached));
  return select;
}

function filterEntries(entries, filterValue) {
  if (!filterValue) return entries;

  if (filterValue.startsWith('track:')) {
    const trackId = filterValue.slice('track:'.length);
    const trackExercises = getTrackExercises(trackId);
    const trackIds = new Set(trackExercises.map(e => e.id));
    return entries
      .map(entry => {
        const passedIds = (entry.exerciseIds ?? []).filter(id => trackIds.has(id));
        return { ...entry, passed: passedIds.length, total: trackIds.size, exerciseIds: passedIds };
      })
      .filter(entry => entry.passed > 0)
      .sort((a, b) => b.passed - a.passed || new Date(a.verified_at) - new Date(b.verified_at));
  }

  if (filterValue.startsWith('cluster:')) {
    const clusterId = filterValue.slice('cluster:'.length);
    const clusterData = getAllClusters().find(c => c.id === clusterId);
    const clusterIds = new Set((clusterData?.exercises ?? []).map(e => e.id));
    return entries
      .map(entry => {
        const passedIds = (entry.exerciseIds ?? []).filter(id => clusterIds.has(id));
        return { ...entry, passed: passedIds.length, total: clusterIds.size, exerciseIds: passedIds };
      })
      .filter(entry => entry.passed > 0)
      .sort((a, b) => b.passed - a.passed || new Date(a.verified_at) - new Date(b.verified_at));
  }

  return entries;
}

function renderLeaderboardRows(container, entries, filterSelect) {
  Array.from(container.querySelectorAll('.leaderboard-row')).forEach(el => el.remove());

  const filtered = filterEntries(entries, filterSelect?.value ?? '');

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'leaderboard-empty';
    empty.textContent = t('leaderboard.empty');
    container.insertBefore(empty, container.querySelector('.leaderboard-refresh'));
    return;
  }

  filtered.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `#${idx + 1}`;

    const userLink = document.createElement('a');
    userLink.className = 'leaderboard-user';
    userLink.href = `https://github.com/${entry.user}`;
    userLink.target = '_blank';
    userLink.rel = 'noopener noreferrer';
    userLink.textContent = entry.user;

    const badge = streakBadge(entry.streak ?? 0);
    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'streak-badge';
      badgeEl.textContent = badge.emoji;
      badgeEl.title = t(badge.key);
      userLink.appendChild(badgeEl);
    }

    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = `${entry.passed}/${entry.total}`;

    row.appendChild(rank);
    row.appendChild(userLink);
    row.appendChild(score);

    const refreshBtn = container.querySelector('.leaderboard-refresh');
    container.insertBefore(row, refreshBtn ?? null);
  });
}

function renderLeaderboard() {
  const container = elements.leaderboardContent;
  container.innerHTML = '';

  const cached = get(LEADERBOARD_KEY);
  if (!cached || cached.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'leaderboard-empty';
    empty.textContent = t('leaderboard.empty');
    container.appendChild(empty);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn btn-ghost leaderboard-refresh';
    refreshBtn.type = 'button';
    refreshBtn.textContent = t('leaderboard.refresh');
    refreshBtn.addEventListener('click', () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = t('leaderboard.refreshing');
      fetchLeaderboard()
        .then(entries => {
          if (entries) set(LEADERBOARD_KEY, entries);
          renderLeaderboard();
        })
        .catch(() => renderLeaderboard());
    });
    container.appendChild(refreshBtn);
    return;
  }

  const filterSelect = buildLeaderboardFilter(cached, (value, entries) => {
    renderLeaderboardRows(container, entries, filterSelect);
  });
  container.appendChild(filterSelect);

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'btn btn-ghost leaderboard-refresh';
  refreshBtn.type = 'button';
  refreshBtn.textContent = t('leaderboard.refresh');
  refreshBtn.addEventListener('click', () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = t('leaderboard.refreshing');
    fetchLeaderboard()
      .then(entries => {
        if (entries) set(LEADERBOARD_KEY, entries);
        renderLeaderboard();
      })
      .catch(() => renderLeaderboard());
  });
  container.appendChild(refreshBtn);

  renderLeaderboardRows(container, cached, filterSelect);
}

function handleReset() {
  if (!currentExercise) return;
  setCode(editor, currentExercise.starterCode);
  elements.resultsContainer.innerHTML = '';
  elements.statusBar.textContent = '';
  elements.statusBar.className = 'status-message';
  currentHintIndex = 0;
  elements.hintContent.textContent = '';
  elements.hintContent.classList.remove('visible');
  elements.hintButton.textContent = t('hint.button', { current: 1, total: currentExercise.hints?.length ?? 0 });
}

async function handleHint() {
  if (!currentExercise?.hints?.length) return;

  if (currentHintIndex < currentExercise.hints.length) {
    const tier = await getDifficultyTier(currentExercise.id);
    const multiplier = DIFFICULTY_HINT_MULTIPLIER[tier] ?? 1;
    const delay = HINT_BASE_DELAY_MS * multiplier;

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    elements.hintContent.textContent = currentExercise.hints[currentHintIndex];
    elements.hintContent.classList.add('visible');
    currentHintIndex++;
    elements.hintButton.textContent =
      currentHintIndex < currentExercise.hints.length
        ? t('hint.button', { current: currentHintIndex + 1, total: currentExercise.hints.length })
        : t('hint.noMore');
  }
}

function formatValue(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  return JSON.stringify(val);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function handleFormat() {
  const code = getCode(editor);
  try {
    const prettier = await import('prettier/standalone');
    const parserBabel = await import('prettier/plugins/babel');
    const parserEstree = await import('prettier/plugins/estree');
    const formatted = await prettier.format(code, {
      parser: 'babel',
      plugins: [parserBabel.default, parserEstree.default],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      printWidth: 60
    });
    setCode(editor, formatted.trimEnd());
  } catch (err) {
    elements.statusBar.textContent = t('run.formatError', { message: err.message });
    elements.statusBar.className = 'status-message error';
  }
}

initDebugUI(elements);
elements.debugButton.addEventListener('click', handleDebug);
elements.dbgTestPicker.addEventListener('change', handleTestPickerChange);
elements.customTestsToggle.addEventListener('click', () => {
  const form = elements.customTestsForm;
  form.hidden = !form.hidden;
  elements.customTestsToggle.textContent = form.hidden ? t('customTest.add') : t('customTest.hide');
});
elements.customTestAdd.addEventListener('click', handleAddCustomTest);
elements.customTestExpected.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAddCustomTest();
});
elements.runButton.addEventListener('click', handleRun);
elements.resetButton.addEventListener('click', handleReset);
elements.formatButton.addEventListener('click', handleFormat);
elements.hintButton.addEventListener('click', handleHint);
elements.browseButton.addEventListener('click', toggleSidebar);
elements.sidebarClose.addEventListener('click', closeSidebar);
elements.sidebarBackdrop.addEventListener('click', closeSidebar);
elements.leaderboardButton.addEventListener('click', toggleLeaderboard);
elements.leaderboardClose.addEventListener('click', closeLeaderboard);
elements.leaderboardBackdrop.addEventListener('click', closeLeaderboard);
elements.authModalClose.addEventListener('click', closeAuthModal);
elements.authModalBackdrop.addEventListener('click', closeAuthModal);
elements.authConnectButton.addEventListener('click', handleConnect);
elements.authCancelButton.addEventListener('click', closeAuthModal);
elements.sfModalClose.addEventListener('click', closeSalesforceModal);
elements.sfModalBackdrop.addEventListener('click', closeSalesforceModal);
elements.sfConnectButton.addEventListener('click', handleSalesforceConnect);
elements.sfCancelButton.addEventListener('click', closeSalesforceModal);

if (elements.viewClusters) {
  elements.viewClusters.addEventListener('click', () => {
    ribbonView = 'clusters';
    set(RIBBON_VIEW_KEY, ribbonView);
    syncViewToggle();
    updateRibbon();
  });
}

function renderTrackControls() {
  if (!elements.ribbonControls) return;
  elements.ribbonControls.querySelectorAll('[data-track-id]').forEach((el) => el.remove());

  getAllTracks().forEach((track) => {
    const btn = document.createElement('button');
    btn.className = 'ribbon-view-btn';
    btn.type = 'button';
    btn.dataset.trackId = track.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = track.title;
    btn.addEventListener('click', () => {
      ribbonView = track.id;
      set(RIBBON_VIEW_KEY, ribbonView);
      syncViewToggle();
      updateRibbon();
      const days = getTrackExercises(track.id);
      const progress = getProgress();
      const solved = progress.completedExercises;
      const firstUnlocked = days.find((d, i) => i === 0 || Boolean(solved[days[i - 1].exerciseId]));
      if (firstUnlocked) loadExercise(firstUnlocked.exerciseId, false);
    });
    elements.ribbonControls.appendChild(btn);
  });
}

onFormat(handleFormat);

const AUTO_FORMAT_KEY = 'trainer_auto_format';
const AUTO_FORMAT_DELAY = 1500;
let autoFormatTimer = null;
let autoFormatAborted = false;

function isAutoFormatEnabled() {
  return elements.autoFormatCheckbox.checked;
}

elements.autoFormatCheckbox.checked = get(AUTO_FORMAT_KEY) !== false;
elements.autoFormatCheckbox.addEventListener('change', () => {
  set(AUTO_FORMAT_KEY, elements.autoFormatCheckbox.checked);
});

function abortAutoFormat() {
  autoFormatAborted = true;
  if (autoFormatTimer) {
    clearTimeout(autoFormatTimer);
    autoFormatTimer = null;
  }
}

elements.editorContainer.addEventListener('keydown', abortAutoFormat, true);

async function tryAutoFormat() {
  if (!isAutoFormatEnabled()) return;
  const snapshot = getCode(editor);
  autoFormatAborted = false;
  try {
    const prettier = await import('prettier/standalone');
    const parserBabel = await import('prettier/plugins/babel');
    const parserEstree = await import('prettier/plugins/estree');
    if (autoFormatAborted) return;
    if (getCode(editor) !== snapshot) return;
    const formatted = await prettier.format(snapshot, {
      parser: 'babel',
      plugins: [parserBabel.default, parserEstree.default],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      printWidth: 60,
    });
    if (autoFormatAborted) return;
    if (getCode(editor) !== snapshot) return;
    const trimmed = formatted.trimEnd();
    if (trimmed !== snapshot) setCode(editor, trimmed);
  } catch {
    // Syntax error — skip silently
  }
}

function scheduleAutoFormat() {
  abortAutoFormat();
  if (!isAutoFormatEnabled()) return;
  autoFormatTimer = setTimeout(tryAutoFormat, AUTO_FORMAT_DELAY);
}

onChange((code) => {
  if (currentExercise) saveDraft(currentExercise.id, code);
  scheduleAutoFormat();
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRun();
  }
  if (e.key === 'Escape') {
    closeSidebar();
    closeAuthModal();
    closeSalesforceModal();
    closeLeaderboard();
  }
});

function setupOfflineIndicator() {
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.id = 'offline-banner';
  banner.textContent = t('app.offline');
  banner.style.display = navigator.onLine ? 'none' : 'block';
  document.body.prepend(banner);

  window.addEventListener('online', () => { banner.style.display = 'none'; });
  window.addEventListener('offline', () => { banner.style.display = 'block'; });
}

function applyI18nToDOM() {
  document.title = t('app.pageTitle');
  document.querySelector('header h1').textContent = t('app.title');
  elements.browseButton.textContent = t('nav.browse');
  elements.browseButton.setAttribute('aria-label', t('nav.browseLabel'));
  document.querySelector('.sidebar-header h2').textContent = t('nav.exercises');
  elements.sidebarClose.setAttribute('aria-label', t('nav.closeSidebar'));
  document.getElementById('sidebar').setAttribute('aria-label', t('nav.exerciseBrowser'));
  document.querySelector('#auth-modal .auth-modal-header h2').textContent = t('auth.signInTitle');
  elements.authModalClose.setAttribute('aria-label', t('auth.close'));
  document.querySelector('#auth-modal .auth-modal-text').textContent = t('auth.tokenPrompt');
  document.querySelector('.auth-github-link').textContent = t('auth.createToken');
  document.querySelector('#auth-modal .auth-label').textContent = t('auth.pasteToken');
  elements.tokenInput.placeholder = t('auth.tokenPlaceholder');
  elements.authConnectButton.textContent = t('auth.connect');
  elements.authCancelButton.textContent = t('auth.cancel');
  document.querySelector('#sf-modal .auth-modal-header h2').textContent = t('sf.connectTitle');
  elements.sfModalClose.setAttribute('aria-label', t('auth.close'));
  document.querySelector('#sf-modal .sf-modal-text').textContent = t('sf.prompt');
  document.querySelector('#sf-modal .sf-instance-label').textContent = t('sf.instanceLabel');
  document.querySelector('#sf-modal .sf-token-label').textContent = t('sf.tokenLabel');
  elements.sfInstanceInput.placeholder = t('sf.instancePlaceholder');
  elements.sfTokenInput.placeholder = t('sf.tokenPlaceholder');
  elements.sfConnectButton.textContent = t('sf.connect');
  elements.sfCancelButton.textContent = t('auth.cancel');
  document.querySelector('#footer-quote').textContent = `“${t('app.quote')}”`;
  document.querySelector('.footer p:last-child').textContent = t('app.footer');

  elements.runButton.textContent = t('run.runCode');
  elements.resetButton.textContent = t('run.reset');
  elements.formatButton.textContent = t('run.format');
  document.getElementById('auto-format-label').textContent = t('run.autoFormat');

  const statLabels = document.querySelectorAll('.stat-label');
  const labelKeys = ['stats.xp', 'stats.streak', 'stats.solved'];
  statLabels.forEach((el, i) => { if (labelKeys[i]) el.textContent = t(labelKeys[i]); });

  elements.stepper.setAttribute('aria-label', t('nav.exerciseProgression'));
  elements.ribbon.setAttribute('aria-label', t('nav.conceptClusters'));
  document.querySelector('.leaderboard-header h2').textContent = t('leaderboard.title');
  elements.leaderboardClose.setAttribute('aria-label', t('leaderboard.close'));

  elements.debugButton.textContent = t('debug.button');
  elements.dbgStop.title = t('debug.stop');
  elements.dbgStop.setAttribute('aria-label', t('debug.stop'));
  document.getElementById('dbg-picker-label').textContent = t('debug.testPickerLabel');
  elements.dbgStepBack.title = t('debug.stepBack');
  elements.dbgStepBack.setAttribute('aria-label', t('debug.stepBack'));
  elements.dbgStepInto.title = `${t('debug.stepInto')} (F11)`;
  elements.dbgStepInto.setAttribute('aria-label', t('debug.stepInto'));
  elements.dbgStepOver.title = `${t('debug.stepOver')} (F10)`;
  elements.dbgStepOver.setAttribute('aria-label', t('debug.stepOver'));
  elements.dbgStepOut.title = `${t('debug.stepOut')} (Shift+F11)`;
  elements.dbgStepOut.setAttribute('aria-label', t('debug.stepOut'));
  elements.dbgContinue.title = `${t('debug.continue')} (F5)`;
  elements.dbgContinue.setAttribute('aria-label', t('debug.continue'));
  elements.dbgContinueBack.title = t('debug.continueBack');
  elements.dbgContinueBack.setAttribute('aria-label', t('debug.continueBack'));
  elements.dbgReset.title = t('debug.reset');
  elements.dbgReset.setAttribute('aria-label', t('debug.reset'));
  elements.dbgTestPicker.title = t('debug.testPicker');
  elements.dbgTestPicker.setAttribute('aria-label', t('debug.testPicker'));

  document.querySelector('#debug-vars .debug-section-title').textContent = t('debug.variables');
  document.querySelector('#debug-callstack .debug-section-title').textContent = t('debug.callStack');
  document.querySelector('#debug-dataviz .debug-section-title').textContent = t('debug.data');
  if (elements.geometryTitle) elements.geometryTitle.textContent = t('debug.geometry');

  document.querySelector('#custom-tests-section .debug-section-title').textContent = t('customTest.title');
  elements.customTestsToggle.textContent = t('customTest.add');
  const testLabels = document.querySelectorAll('.custom-test-label');
  if (testLabels[0]) {
    const textNode = testLabels[0].firstChild;
    if (textNode?.nodeType === Node.TEXT_NODE) textNode.textContent = t('customTest.inputLabel') + ' ';
  }
  if (testLabels[1]) {
    const textNode = testLabels[1].firstChild;
    if (textNode?.nodeType === Node.TEXT_NODE) textNode.textContent = t('customTest.expectedLabel') + ' ';
  }
  elements.customTestInput.placeholder = t('customTest.inputPlaceholder');
  elements.customTestExpected.placeholder = t('customTest.expectedPlaceholder');
  elements.customTestAdd.textContent = t('customTest.addButton');

  if (elements.viewClusters) elements.viewClusters.textContent = t('ribbon.clusters');

  renderLocaleSelector();
}

function renderLocaleSelector() {
  const existing = document.getElementById('locale-selector');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.className = 'locale-selector';
  container.id = 'locale-selector';

  SUPPORTED_LOCALES.forEach((locale) => {
    const btn = document.createElement('button');
    btn.className = 'locale-btn';
    btn.type = 'button';
    btn.textContent = locale;
    if (locale === getLocale()) btn.classList.add('active');
    btn.addEventListener('click', async () => {
      await setLocale(locale);
      applyI18nToDOM();
      loadExercise(currentExercise?.id ?? resolveStartExercise(), true);
      renderAuthState();
    });
    container.appendChild(btn);
  });

  document.querySelector('.header').appendChild(container);
}

function showPwaToast(i18nKey, onClick) {
  const toast = document.createElement('div');
  toast.className = 'pwa-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = t(i18nKey);

  if (onClick) {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', onClick);
  }

  document.body.appendChild(toast);

  const DISMISS_DELAY_MS = 5000;
  setTimeout(() => toast.remove(), DISMISS_DELAY_MS);
}

function initServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      showPwaToast('pwa.updateAvailable', () => updateSW(true));
    },
    onOfflineReady() {
      showPwaToast('pwa.offlineReady');
    },
  });
}

async function boot() {
  await initStorage();
  await initI18n();
  applyI18nToDOM();
  initServiceWorker();
  setupOfflineIndicator();
  renderTrackControls();
  loadExercise(resolveStartExercise());
  syncViewToggle();
  renderAuthState();
  if (isAuthenticated()) {
    const token = getToken();
    const user = getSavedUser();
    if (token && user) {
      syncOnLogin(token, user.login)
        .then(() => {
          updateProgressDisplay();
          renderStepper();
          updateRibbon();
        })
        .catch(err => console.warn('Sync on boot failed:', err.message));
      if (get(CI_CONSENT_KEY)) {
        fetchCIResults(user.login)
          .then(results => {
            if (!results) return;
            set(CI_RESULTS_KEY, results);
            const pending = get(CI_PENDING_KEY);
            if (pending && results.exercises) {
              for (const id of Object.keys(results.exercises)) {
                delete pending[id];
              }
              set(CI_PENDING_KEY, pending);
            }
            loadExercise(currentExercise?.id ?? resolveStartExercise(), true);
          })
          .catch(err => console.warn('CI results fetch failed:', err.message));
      }
    }
  }
  fetchAggregateResults()
    .then(results => {
      if (!results) return;
      const calibrated = computeCalibration(results);
      set(CALIBRATION_KEY, calibrated);
    })
    .catch(err => console.warn('Calibration fetch failed:', err.message));
  fetchLeaderboard()
    .then(entries => { if (entries) set(LEADERBOARD_KEY, entries); })
    .catch(err => console.warn('Leaderboard fetch failed:', err.message));
}

boot();
