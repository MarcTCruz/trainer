import { init as initStorage, get, set, clearAll } from './storage.js';
import { createEditor, getCode, setCode, onFormat } from './editor.js';
import {
  saveToken,
  getToken,
  clearToken,
  getSavedUser,
  validateAndFetchUser,
  isAuthenticated,
  GITHUB_TOKEN_URL
} from './github-auth.js';
import { ensureRepo, pushSolution, pushProgress, syncOnLogin, setRepoVisibility, pushReadme } from './github-sync.js';
import { ensureFork, pushSolutionToFork, fetchCIResults, deleteFork } from './ci-sync.js';
import { initI18n, t, getLocale, setLocale, SUPPORTED_LOCALES } from './i18n.js';
import { runExercise, ensureQuickJS } from './runner.js';
import { markSolved, getProgress, getSavedCode, normalizeCode, addBonusXp } from './progress.js';
import { analyzeSolution } from './linter.js';
import { LINT_RULES } from './lint-rules.js';
import {
  getExercise,
  getNextVariant,
  getVariantsOf,
  getCluster,
  getAllClusters
} from './exercise-loader.js';
import { fetchAggregateResults, computeCalibration, CALIBRATION_KEY } from './difficulty-calibration.js';
import { fetchLeaderboard, LEADERBOARD_KEY } from './leaderboard.js';

const CI_CONSENT_KEY = 'trainer_ci_consent';
const CI_PENDING_KEY = 'trainer_ci_pending';
const CI_RESULTS_KEY = 'trainer_ci_results';
const REPO_PUBLIC_KEY = 'trainer_repo_public';

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
};

const LINT_RULE_META = Object.fromEntries(LINT_RULES.map(r => [r.id, { titleKey: r.titleKey, hintKey: r.hintKey, bonusXp: r.bonusXp }]));

let editor;
let currentHintIndex = 0;
let currentExercise = null;
let lastLintReport = null;

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
  }

  elements.resultsContainer.innerHTML = '';
  elements.statusBar.textContent = '';
  elements.statusBar.className = 'status-message';
  elements.hintContent.textContent = '';
  elements.hintContent.classList.remove('visible');
  elements.hintButton.textContent = t('hint.button', { current: 1, total: exercise.hints?.length ?? 0 });

  renderStepper();
  renderRibbon();
  updateProgressDisplay();
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

function renderRibbon() {
  const container = elements.ribbon;
  if (!container || !currentExercise) return;

  const clusters = getAllClusters();
  const activeCluster = getCluster(currentExercise.id);
  const progress = getProgress();
  const solved = progress.completedExercises;

  container.innerHTML = '';

  clusters.forEach((cluster) => {
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
    bar.style.width = `${progressPct}%`;
    bar.setAttribute('aria-hidden', 'true');

    pill.appendChild(bar);

    pill.addEventListener('click', () => {
      if (isActive) return;
      const firstUnsolved = cluster.exercises.find((e) => !solved[e.id]);
      const target = firstUnsolved ?? cluster.exercises[0];
      if (target) loadExercise(target.id, false);
    });

    container.appendChild(pill);
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
    const result = await runExercise(userCode, currentExercise);

    elements.wasmStatus.classList.remove('visible');
    renderResults(result);

    if (result.allPassed) {
      markSolved(currentExercise.id, userCode);
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
      renderRibbon();
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
          forwardResult = await runExercise(forwardCode, nextVariant);
        } catch {
          // Silent — forward-testing is purely informational
        }
        showEvolutionPrompt(nextVariant, forwardResult);
      }
    } else if (result.error) {
      elements.statusBar.textContent = t('run.error', { error: result.error });
      elements.statusBar.className = 'status-message error';
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
    el.className = `test-result ${r.passed ? 'pass' : 'fail'}`;

    const icon = r.passed ? '✓' : '✗';
    const verdict = r.passed ? t('test.pass') : t('test.fail');
    const args = r.input.map((v) => JSON.stringify(v)).join(', ');

    let detail = `<span class="result-icon">${icon}</span>`;
    detail += `<span class="result-verdict">${verdict}</span>`;
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
    xp.textContent = `+${rule.bonusXp} XP`;
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

function makeButton(id, className, labelKey) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.id = id;
  btn.type = 'button';
  btn.textContent = t(labelKey);
  return btn;
}

function renderVisibilityToggle(section, token, user) {
  const isPublic = !!get(REPO_PUBLIC_KEY);
  const toggleBtn = makeButton(
    'visibility-toggle-button',
    'btn btn-ghost',
    isPublic ? 'share.makePrivate' : 'share.makePublic',
  );

  toggleBtn.addEventListener('click', async () => {
    const nowPublic = !get(REPO_PUBLIC_KEY);
    toggleBtn.disabled = true;
    toggleBtn.textContent = t(nowPublic ? 'share.makingPublic' : 'share.makingPrivate');
    try {
      await setRepoVisibility(token, user.login, nowPublic);
      if (nowPublic) await pushReadme(token, user.login, getProgress());
      set(REPO_PUBLIC_KEY, nowPublic ? true : null);
      renderAuthState();
    } catch (err) {
      console.warn('setRepoVisibility failed:', err.message);
      toggleBtn.disabled = false;
      toggleBtn.textContent = t(isPublic ? 'share.makePrivate' : 'share.makePublic');
    }
  });

  section.appendChild(toggleBtn);

  if (!isPublic) return;

  const shareLink = makeButton('share-solutions-button', 'btn btn-ghost', 'share.shareLink');
  shareLink.addEventListener('click', () => {
    const url = `https://github.com/${user.login}/refactory-solutions`;
    navigator.clipboard.writeText(url).then(() => {
      shareLink.textContent = t('share.linkCopied');
      setTimeout(() => { shareLink.textContent = t('share.shareLink'); }, 2000);
    });
  });
  section.appendChild(shareLink);
}

function renderClearDataButton(section, token, user) {
  const clearBtn = makeButton('clear-data-button', 'btn btn-ghost btn-danger', 'data.clearButton');

  clearBtn.addEventListener('click', () => {
    renderClearConfirm(section, token, user);
  });

  section.appendChild(clearBtn);
}

function renderClearConfirm(section, token, user) {
  if (document.getElementById('clear-confirm-card')) return;

  const card = document.createElement('div');
  card.className = 'ci-consent-card';
  card.id = 'clear-confirm-card';

  const heading = document.createElement('strong');
  heading.textContent = t('data.clearConfirmHeading');

  const text = document.createElement('p');
  text.textContent = t('data.clearConfirmText');

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-ghost btn-danger';
  confirmBtn.type = 'button';
  confirmBtn.textContent = t('data.clearConfirmAction');
  confirmBtn.addEventListener('click', () => handleClearAll(section, token, user));

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.type = 'button';
  cancelBtn.textContent = t('data.clearConfirmCancel');
  cancelBtn.addEventListener('click', () => renderAuthState());

  card.appendChild(heading);
  card.appendChild(text);
  card.appendChild(confirmBtn);
  card.appendChild(cancelBtn);
  section.appendChild(card);
}

async function handleClearAll(section, token, user) {
  try {
    await deleteFork(token, user.login);
  } catch (err) {
    console.warn('deleteFork failed (non-fatal):', err.message);
  }

  if (get(REPO_PUBLIC_KEY)) {
    try {
      await setRepoVisibility(token, user.login, false);
    } catch (err) {
      console.warn('setRepoVisibility on clear failed (non-fatal):', err.message);
    }
  }

  clearAll();

  const msg = document.createElement('div');
  msg.className = 'clear-done-message';

  const done = document.createElement('p');
  done.textContent = t('data.clearDone');

  const revokeLink = document.createElement('a');
  revokeLink.href = 'https://github.com/settings/tokens';
  revokeLink.target = '_blank';
  revokeLink.rel = 'noopener noreferrer';
  revokeLink.textContent = t('data.revokeToken');

  msg.appendChild(done);
  msg.appendChild(revokeLink);
  section.innerHTML = '';
  section.appendChild(msg);
}

function renderYourDataButton(section) {
  const btn = makeButton('your-data-button', 'btn btn-ghost', 'data.yourDataButton');
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

  btn.addEventListener('click', () => {
    infoVisible = !infoVisible;
    info.hidden = !infoVisible;
  });

  section.appendChild(btn);
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
  renderYourDataButton(actions);

  section.appendChild(actions);
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

function renderLeaderboard() {
  const container = elements.leaderboardContent;
  container.innerHTML = '';

  const cached = get(LEADERBOARD_KEY);
  if (!cached || cached.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'leaderboard-empty';
    empty.textContent = t('leaderboard.empty');
    container.appendChild(empty);
    return;
  }

  cached.forEach((entry, idx) => {
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

    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = `${entry.passed}/${entry.total}`;

    row.appendChild(rank);
    row.appendChild(userLink);
    row.appendChild(score);
    container.appendChild(row);
  });

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

function handleHint() {
  if (!currentExercise?.hints?.length) return;

  if (currentHintIndex < currentExercise.hints.length) {
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
onFormat(handleFormat);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRun();
  }
  if (e.key === 'Escape') {
    closeSidebar();
    closeAuthModal();
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
  document.querySelector('.auth-modal-header h2').textContent = t('auth.signInTitle');
  elements.authModalClose.setAttribute('aria-label', t('auth.close'));
  document.querySelector('.auth-modal-text').textContent = t('auth.tokenPrompt');
  document.querySelector('.auth-github-link').textContent = t('auth.createToken');
  document.querySelector('.auth-label').textContent = t('auth.pasteToken');
  elements.tokenInput.placeholder = t('auth.tokenPlaceholder');
  elements.authConnectButton.textContent = t('auth.connect');
  elements.authCancelButton.textContent = t('auth.cancel');
  document.querySelector('#footer-quote').textContent = `“${t('app.quote')}”`;
  document.querySelector('.footer p:last-child').textContent = t('app.footer');

  elements.runButton.textContent = t('run.runCode');
  elements.resetButton.textContent = t('run.reset');
  elements.formatButton.textContent = t('run.format');

  const statLabels = document.querySelectorAll('.stat-label');
  const labelKeys = ['stats.xp', 'stats.streak', 'stats.solved'];
  statLabels.forEach((el, i) => { if (labelKeys[i]) el.textContent = t(labelKeys[i]); });

  elements.stepper.setAttribute('aria-label', t('nav.exerciseProgression'));
  elements.ribbon.setAttribute('aria-label', t('nav.conceptClusters'));
  document.querySelector('.leaderboard-header h2').textContent = t('leaderboard.title');
  elements.leaderboardClose.setAttribute('aria-label', t('leaderboard.close'));

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

async function boot() {
  await initStorage();
  await initI18n();
  applyI18nToDOM();
  setupOfflineIndicator();
  loadExercise(resolveStartExercise());
  renderAuthState();
  if (isAuthenticated()) {
    const token = getToken();
    const user = getSavedUser();
    if (token && user) {
      syncOnLogin(token, user.login)
        .then(() => {
          updateProgressDisplay();
          renderStepper();
          renderRibbon();
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
