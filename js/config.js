const CONFIG = {
  DRIVE_FILE_NAME: '感恩日記-gratitude-journal.json',
  DRIVE_MIME_TYPE: 'application/json',
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' '),
  STORAGE_KEY_CLIENT_ID: 'gratitude_journal_client_id',
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
