import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm";

// Supabase publishable keys are designed to be used in public browser clients.
// Database access is protected by the Row Level Security policies in supabase.sql.
const SUPABASE_URL = "https://dpnvypezsihsohokbjbv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_w2QlltrOl28CNzRKK3NZXQ_YnAzhWEP";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const INITIAL_GAME_STATE = Object.freeze({
  day: 100,
  knowledge: 0,
  health: 100,
  stress: 0,
});

const ACTIONS = Object.freeze({
  study: {
    knowledge: 10,
    health: -10,
    stress: 10,
    message: "일반 공부를 마쳤습니다. 지식이 10 증가했습니다.",
  },
  cram: {
    knowledge: 25,
    health: -25,
    stress: 30,
    message: "벼락치기에 몰입했습니다. 지식이 25 증가했습니다.",
  },
  rest: {
    knowledge: 0,
    health: 30,
    stress: -20,
    message: "휴식을 취해 체력이 회복되었습니다.",
  },
});

const views = {
  auth: document.querySelector("#auth-view"),
  lobby: document.querySelector("#lobby-view"),
  game: document.querySelector("#game-view"),
};

const appLoader = document.querySelector("#app-loader");
const authForm = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const nicknameInput = document.querySelector("#nickname");
const authMessage = document.querySelector("#auth-message");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");
const startButton = document.querySelector("#start-button");
const refreshRankingButton = document.querySelector("#refresh-ranking-button");
const userNickname = document.querySelector("#user-nickname");
const lastResult = document.querySelector("#last-result");
const rankingStatus = document.querySelector("#ranking-status");
const rankingBody = document.querySelector("#ranking-body");

const dayValue = document.querySelector("#day-value");
const knowledgeValue = document.querySelector("#knowledge-value");
const healthValue = document.querySelector("#health-value");
const stressValue = document.querySelector("#stress-value");
const healthProgress = document.querySelector("#health-progress");
const stressProgress = document.querySelector("#stress-progress");
const healthProgressFill = document.querySelector("#health-progress-fill");
const stressProgressFill = document.querySelector("#stress-progress-fill");
const healthState = document.querySelector("#health-state");
const stressState = document.querySelector("#stress-state");
const actionButtons = [...document.querySelectorAll("[data-action]")];
const gameLog = document.querySelector("#game-log");
const latestLog = document.querySelector("#latest-log");

let currentUser = null;
let gameState = { ...INITIAL_GAME_STATE };
let gameActive = false;
let endingHandled = false;

function showView(viewName) {
  Object.entries(views).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });

  appLoader.hidden = true;
  const heading = views[viewName]?.querySelector("h1");
  window.requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
}

function getNickname(user = currentUser) {
  const metadataNickname = user?.user_metadata?.nickname;
  if (typeof metadataNickname === "string" && metadataNickname.trim()) {
    return metadataNickname.trim().slice(0, 20);
  }

  const emailName = user?.email?.split("@")[0];
  return emailName?.slice(0, 20) || "도전자";
}

function setAuthPending(isPending) {
  loginButton.disabled = isPending;
  signupButton.disabled = isPending;
  emailInput.disabled = isPending;
  passwordInput.disabled = isPending;
  nicknameInput.disabled = isPending;
}

function setAuthMessage(message = "", type = "error") {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-success", type === "success");
}

function setInputValidity(input, isValid) {
  input.setAttribute("aria-invalid", String(!isValid));
}

function validateCredentials({ requireNickname = false } = {}) {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const nickname = nicknameInput.value.trim();
  const emailValid = emailInput.validity.valid && email.length > 0;
  const passwordValid = password.length >= 6;
  const nicknameValid = !requireNickname || (nickname.length >= 1 && nickname.length <= 20);

  setInputValidity(emailInput, emailValid);
  setInputValidity(passwordInput, passwordValid);
  setInputValidity(nicknameInput, nicknameValid);

  if (!emailValid) {
    setAuthMessage("올바른 이메일 주소를 입력해 주세요.");
    emailInput.focus();
    return null;
  }

  if (!passwordValid) {
    setAuthMessage("비밀번호는 6자 이상이어야 합니다.");
    passwordInput.focus();
    return null;
  }

  if (!nicknameValid) {
    setAuthMessage("회원가입할 닉네임을 1~20자로 입력해 주세요.");
    nicknameInput.focus();
    return null;
  }

  return { email, password, nickname };
}

function getFriendlyAuthError(error) {
  const message = error?.message || "인증 요청을 처리하지 못했습니다.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  }
  if (normalized.includes("user already registered")) {
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  }
  if (normalized.includes("password") && normalized.includes("characters")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  return message;
}

async function handleLogin(event) {
  event.preventDefault();
  const credentials = validateCredentials();
  if (!credentials) return;

  setAuthPending(true);
  setAuthMessage("로그인하는 중입니다.", "success");

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    setAuthMessage(getFriendlyAuthError(error));
    setAuthPending(false);
    return;
  }

  passwordInput.value = "";
  setAuthPending(false);
}

async function handleSignup() {
  const credentials = validateCredentials({ requireNickname: true });
  if (!credentials) return;

  setAuthPending(true);
  setAuthMessage("회원가입을 처리하는 중입니다.", "success");

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: { nickname: credentials.nickname },
    },
  });

  if (error) {
    setAuthMessage(getFriendlyAuthError(error));
    setAuthPending(false);
    return;
  }

  passwordInput.value = "";
  nicknameInput.value = "";
  setAuthPending(false);

  if (!data.session) {
    setAuthMessage(
      "가입 확인 메일을 보냈습니다. 이메일 인증을 마친 뒤 이 페이지에서 로그인해 주세요.",
      "success",
    );
  }
}

async function handleLogout() {
  logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();

  if (error) {
    window.alert(`로그아웃하지 못했습니다: ${error.message}`);
    logoutButton.disabled = false;
  }
}

function showLobby() {
  if (!currentUser) return;
  userNickname.textContent = getNickname();
  showView("lobby");
  void loadRankings();
}

function resetLastResult() {
  lastResult.hidden = true;
  lastResult.textContent = "";
  lastResult.classList.remove("is-failure");
}

function showLastResult(message, { failure = false } = {}) {
  lastResult.textContent = message;
  lastResult.classList.toggle("is-failure", failure);
  lastResult.hidden = false;
}

function setActionButtonsDisabled(isDisabled) {
  actionButtons.forEach((button) => {
    button.disabled = isDisabled;
  });
}

function startGame() {
  gameState = { ...INITIAL_GAME_STATE };
  gameActive = true;
  endingHandled = false;
  gameLog.replaceChildren();
  latestLog.textContent = "";
  resetLastResult();
  setActionButtonsDisabled(false);
  renderGameState();
  addLog("입시 레이스가 시작되었습니다. 첫날의 행동을 선택하세요.");
  showView("game");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderMeter({ value, valueElement, progress, fill, stateElement, type }) {
  const visualValue = clamp(value, 0, 100);
  valueElement.textContent = `${value} / 100`;
  progress.setAttribute("aria-valuenow", String(visualValue));
  fill.style.width = `${visualValue}%`;

  const isDanger = type === "health" ? value <= 25 : value >= 75;
  progress.classList.toggle("is-danger", isDanger);
  stateElement.classList.toggle("is-danger", isDanger);

  if (type === "health") {
    stateElement.textContent = value <= 0 ? "위험 · 회복 필요" : value <= 25 ? "주의 · 체력 부족" : "안정";
  } else {
    stateElement.textContent = value >= 75 ? "위험 · 휴식 필요" : value >= 50 ? "주의" : "여유";
  }
}

function renderGameState() {
  dayValue.textContent = String(gameState.day);
  knowledgeValue.textContent = gameState.knowledge.toLocaleString("ko-KR");

  renderMeter({
    value: gameState.health,
    valueElement: healthValue,
    progress: healthProgress,
    fill: healthProgressFill,
    stateElement: healthState,
    type: "health",
  });

  renderMeter({
    value: gameState.stress,
    valueElement: stressValue,
    progress: stressProgress,
    fill: stressProgressFill,
    stateElement: stressState,
    type: "stress",
  });
}

function addLog(message) {
  const item = document.createElement("li");
  const day = document.createElement("span");
  const content = document.createElement("span");

  day.className = "log-day";
  day.textContent = `D-${gameState.day}`;
  content.textContent = message;
  item.append(day, content);
  gameLog.prepend(item);
  latestLog.textContent = `D-${gameState.day}. ${message}`;
}

function applyAction(actionName) {
  if (!gameActive || endingHandled) return;
  const action = ACTIONS[actionName];
  if (!action) return;

  gameState = {
    day: Math.max(0, gameState.day - 1),
    knowledge: gameState.knowledge + action.knowledge,
    health: Math.min(100, gameState.health + action.health),
    stress: clamp(gameState.stress + action.stress, 0, 100),
  };

  renderGameState();
  addLog(action.message);

  if (gameState.stress >= 100 || gameState.health < 0) {
    handleGameOver();
    return;
  }

  if (gameState.day === 0) {
    void handleEnding();
  }
}

function handleGameOver() {
  gameActive = false;
  endingHandled = true;
  setActionButtonsDisabled(true);
  window.alert("과로로 쓰러졌습니다.");
  showLastResult("과로로 도전이 종료되어 이번 기록은 저장되지 않았습니다.", { failure: true });
  showLobby();
}

function getEnding(score) {
  if (score >= 2500) return { grade: "S급: 서울대", shortGrade: "S급", school: "서울대" };
  if (score >= 1500) return { grade: "A급: 인서울", shortGrade: "A급", school: "인서울" };
  return { grade: "F급: 재수학원", shortGrade: "F급", school: "재수학원" };
}

async function saveRanking(ending) {
  if (!currentUser) {
    throw new Error("로그인 세션이 만료되었습니다.");
  }

  const { error } = await supabase.from("rankings").insert({
    user_id: currentUser.id,
    nickname: getNickname(),
    final_score: gameState.knowledge,
    grade: ending.grade,
  });

  if (error) throw error;
}

async function handleEnding() {
  if (endingHandled) return;
  endingHandled = true;
  gameActive = false;
  setActionButtonsDisabled(true);

  const ending = getEnding(gameState.knowledge);
  addLog(`최종 결과는 ${ending.grade}입니다. 기록을 저장하고 있습니다.`);

  try {
    await saveRanking(ending);
    showLastResult(
      `${ending.shortGrade} · ${ending.school} — 최종 지식 ${gameState.knowledge.toLocaleString("ko-KR")}점이 저장되었습니다.`,
    );
    window.alert(
      `입시 결과: ${ending.grade}\n최종 지식: ${gameState.knowledge.toLocaleString("ko-KR")}점`,
    );
  } catch (error) {
    console.error("Ranking save failed", error);
    showLastResult(
      `${ending.grade} 엔딩을 완료했지만 기록 저장에 실패했습니다. 잠시 후 다시 도전해 주세요.`,
      { failure: true },
    );
    window.alert(`입시 결과: ${ending.grade}\n기록 저장에 실패했습니다.`);
  }

  showLobby();
}

function setRankingStatus(message, { error = false } = {}) {
  rankingStatus.textContent = message;
  rankingStatus.classList.toggle("is-error", error);
}

function renderRankingRows(rankings) {
  rankingBody.replaceChildren();

  if (!rankings.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-cell";
    cell.textContent = "아직 등록된 기록이 없습니다. 첫 번째 도전자가 되어 보세요.";
    row.append(cell);
    rankingBody.append(row);
    return;
  }

  rankings.forEach((ranking, index) => {
    const row = document.createElement("tr");
    const values = [
      String(index + 1),
      ranking.nickname,
      Number(ranking.final_score).toLocaleString("ko-KR"),
      ranking.grade,
      formatPlayDate(ranking.play_date),
    ];

    values.forEach((value, cellIndex) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (cellIndex === 0) cell.className = "rank-number";
      if (cellIndex === 1) {
        cell.className = "rank-nickname";
        cell.title = value;
      }
      row.append(cell);
    });

    rankingBody.append(row);
  });
}

function formatPlayDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) return "-";
  const [year, month, day] = dateString.split("-");
  return `${year}.${month}.${day}`;
}

async function loadRankings() {
  refreshRankingButton.disabled = true;
  setRankingStatus("랭킹을 불러오는 중입니다.");

  const { data, error } = await supabase
    .from("rankings")
    .select("nickname, final_score, grade, play_date, created_at")
    .order("final_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);

  refreshRankingButton.disabled = false;

  if (error) {
    console.error("Ranking load failed", error);
    rankingBody.replaceChildren();
    setRankingStatus("랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", { error: true });
    return;
  }

  renderRankingRows(data || []);
  setRankingStatus(data?.length ? `상위 ${data.length}개의 기록입니다.` : "첫 기록을 기다리고 있습니다.");
}

authForm.addEventListener("submit", handleLogin);
signupButton.addEventListener("click", handleSignup);
logoutButton.addEventListener("click", handleLogout);
startButton.addEventListener("click", startGame);
refreshRankingButton.addEventListener("click", loadRankings);

actionButtons.forEach((button) => {
  button.addEventListener("click", () => applyAction(button.dataset.action));
});

supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;

  // Keep the auth callback synchronous; database calls are scheduled outside it.
  window.setTimeout(() => {
    if (event === "INITIAL_SESSION") {
      if (currentUser) showLobby();
      else showView("auth");
      return;
    }

    if (event === "SIGNED_IN") {
      setAuthMessage();
      showLobby();
      return;
    }

    if (event === "SIGNED_OUT") {
      gameActive = false;
      endingHandled = true;
      logoutButton.disabled = false;
      setAuthPending(false);
      setAuthMessage();
      resetLastResult();
      showView("auth");
      return;
    }

    if (event === "USER_UPDATED" && currentUser && !views.lobby.hidden) {
      userNickname.textContent = getNickname();
    }
  }, 0);
});

