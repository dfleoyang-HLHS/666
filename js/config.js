const CONFIG = {
  DRIVE_FILE_NAME: '感恩日記-gratitude-journal.json',
  DRIVE_MIME_TYPE: 'application/json',
  SCOPES: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.file',
  ].join(' '),
  STORAGE_KEY_CLIENT_ID: 'gratitude_journal_client_id',
  GOOGLE_SCRIPT_TIMEOUT_MS: 15000,
  SIGN_IN_TIMEOUT_MS: 120000,
};

const OAUTH_ERROR_MESSAGES = {
  access_denied: '您拒絕了授權，或您的 Google 帳號不在測試使用者名單中。請到 GCP「OAuth 同意畫面」將您的 Email 加入測試使用者。',
  popup_closed: '登入視窗已關閉，請再試一次。',
  popup_failed_to_open: '瀏覽器阻擋了登入視窗，請允許彈出視窗，或改用重新導向登入。',
  idpiframe_initialization_failed: '無法載入 Google 登入服務，請確認網路可連線至 Google，並關閉廣告阻擋器。',
  origin_mismatch: '網址與 GCP 設定不符。請在「已授權的 JavaScript 來源」加入此網站網域。',
  redirect_uri_mismatch: '重新導向 URI 不符。請在 GCP「已授權的重新導向 URI」加入下方顯示的網址。',
  invalid_client: 'OAuth 用戶端 ID 無效，請確認 ID 是否正確，且來自仍存在的 GCP 專案。',
};

function getClientId() {
  const stored = localStorage.getItem(CONFIG.STORAGE_KEY_CLIENT_ID);
  if (stored) return stored;
  if (typeof DEFAULT_CLIENT_ID !== 'undefined' && DEFAULT_CLIENT_ID) {
    return DEFAULT_CLIENT_ID;
  }
  return '';
}

function setClientId(clientId) {
  localStorage.setItem(CONFIG.STORAGE_KEY_CLIENT_ID, clientId.trim());
}

function hasClientId() {
  return Boolean(getClientId());
}

function getRedirectUri() {
  const path = location.pathname.replace(/\/[^/]*$/, '/') || '/';
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return `${location.origin}${normalized}`;
}

function getAuthorizedOrigin() {
  return location.origin;
}

function translateOAuthError(error) {
  if (!error) return '登入失敗，請稍後再試';
  const code = typeof error === 'string' ? error : error.type || error.error || error.message;
  return OAUTH_ERROR_MESSAGES[code] || `登入失敗：${code}`;
}
