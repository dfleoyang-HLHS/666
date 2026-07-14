const Drive = (() => {
  const API_BASE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

  async function authHeaders() {
    const token = await Auth.refreshTokenIfNeeded();
    return { Authorization: `Bearer ${token}` };
  }

  async function findJournalFile() {
    const headers = await authHeaders();
    const query = encodeURIComponent(
      `name='${CONFIG.DRIVE_FILE_NAME}' and trashed=false`
    );
    const res = await fetchWithTimeout(`${API_BASE}/files?q=${query}&spaces=drive&fields=files(id,name)`, {
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || '搜尋雲端檔案失敗');
    }
    const data = await res.json();
    return data.files?.[0] || null;
  }

  async function downloadFile(fileId) {
    const headers = await authHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/files/${fileId}?alt=media`, { headers });
    if (!res.ok) throw new Error('讀取日記檔案失敗');
    const text = await res.text();
    if (!text.trim()) return createEmptyJournal();
    try {
      return JSON.parse(text);
    } catch {
      return createEmptyJournal();
    }
  }

  function createEmptyJournal() {
    return { version: 1, entries: {} };
  }

  async function createFile(content) {
    const headers = await authHeaders();
    const metadata = {
      name: CONFIG.DRIVE_FILE_NAME,
      mimeType: CONFIG.DRIVE_MIME_TYPE,
    };
    const boundary = 'gratitude_journal_boundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(content)}\r\n` +
      `--${boundary}--`;

    const res = await fetchWithTimeout(`${UPLOAD_BASE}/files?uploadType=multipart`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || '建立日記檔案失敗');
    }
    return res.json();
  }

  async function updateFile(fileId, content) {
    const headers = await authHeaders();
    const boundary = 'gratitude_journal_boundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify({ mimeType: CONFIG.DRIVE_MIME_TYPE })}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(content)}\r\n` +
      `--${boundary}--`;

    const res = await fetchWithTimeout(`${UPLOAD_BASE}/files/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || '更新日記檔案失敗');
    }
    return res.json();
  }

  let cachedFileId = null;
  let journalData = null;

  async function loadJournal() {
    let file = await findJournalFile();
    if (!file) {
      journalData = createEmptyJournal();
      file = await createFile(journalData);
      cachedFileId = file.id;
      return journalData;
    }
    cachedFileId = file.id;
    journalData = await downloadFile(file.id);
    return journalData;
  }

  async function saveJournal() {
    if (!journalData) journalData = createEmptyJournal();
    if (!cachedFileId) {
      const file = await createFile(journalData);
      cachedFileId = file.id;
    } else {
      await updateFile(cachedFileId, journalData);
    }
    return journalData;
  }

  function getJournal() {
    return journalData || createEmptyJournal();
  }

  function setEntry(dateKey, entry) {
    if (!journalData) journalData = createEmptyJournal();
    journalData.entries[dateKey] = {
      ...entry,
      updatedAt: new Date().toISOString(),
    };
  }

  function getEntry(dateKey) {
    return journalData?.entries?.[dateKey] || null;
  }

  function getAllEntries() {
    return journalData?.entries || {};
  }

  function reset() {
    cachedFileId = null;
    journalData = null;
  }

  return {
    loadJournal,
    saveJournal,
    getJournal,
    setEntry,
    getEntry,
    getAllEntries,
    reset,
  };
})();
