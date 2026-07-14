const Drive = (() => {
  const API_BASE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

  function getFileIdStorageKey() {
    return `gratitude_journal_file_id_${getClientId()}`;
  }

  function loadCachedFileId() {
    return localStorage.getItem(getFileIdStorageKey()) || null;
  }

  function storeCachedFileId(fileId) {
    if (fileId) {
      localStorage.setItem(getFileIdStorageKey(), fileId);
    }
  }

  function clearCachedFileId() {
    localStorage.removeItem(getFileIdStorageKey());
  }

  async function authHeaders() {
    const token = await Auth.refreshTokenIfNeeded();
    return { Authorization: `Bearer ${token}` };
  }

  function escapeDriveQuery(value) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  async function parseDriveError(res, fallback) {
    const err = await res.json().catch(() => ({}));
    const message = err.error?.message || fallback;
    const reason = err.error?.errors?.[0]?.reason;
    if (reason) {
      return `${message} (${reason})`;
    }
    return message;
  }

  async function findJournalFile() {
    const headers = await authHeaders();
    const safeName = escapeDriveQuery(CONFIG.DRIVE_FILE_NAME);
    const query = encodeURIComponent(`name='${safeName}' and trashed=false`);
    const res = await fetchWithTimeout(
      `${API_BASE}/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=10`,
      { headers }
    );
    if (!res.ok) {
      throw new Error(await parseDriveError(res, '搜尋雲端檔案失敗'));
    }
    const data = await res.json();
    return data.files?.[0] || null;
  }

  async function downloadFile(fileId) {
    const headers = await authHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/files/${fileId}?alt=media`, { headers });
    if (!res.ok) {
      throw new Error(await parseDriveError(res, '讀取日記檔案失敗'));
    }
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

  function buildMultipartBody(metadata, content) {
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append(
      'file',
      new Blob([JSON.stringify(content)], { type: CONFIG.DRIVE_MIME_TYPE })
    );
    return form;
  }

  async function createFile(content) {
    const headers = await authHeaders();
    const metadata = {
      name: CONFIG.DRIVE_FILE_NAME,
      mimeType: CONFIG.DRIVE_MIME_TYPE,
    };
    const body = buildMultipartBody(metadata, content);

    const res = await fetchWithTimeout(`${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      throw new Error(await parseDriveError(res, '建立日記檔案失敗'));
    }
    return res.json();
  }

  async function updateFile(fileId, content) {
    const headers = await authHeaders();
    const res = await fetchWithTimeout(`${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': CONFIG.DRIVE_MIME_TYPE,
      },
      body: JSON.stringify(content),
    });
    if (!res.ok) {
      throw new Error(await parseDriveError(res, '更新日記檔案失敗'));
    }
    return res.json().catch(() => ({ id: fileId }));
  }

  let cachedFileId = null;
  let journalData = null;

  async function resolveFileId() {
    if (cachedFileId) return cachedFileId;

    const storedId = loadCachedFileId();
    if (storedId) {
      cachedFileId = storedId;
      return cachedFileId;
    }

    const file = await findJournalFile();
    if (file?.id) {
      cachedFileId = file.id;
      storeCachedFileId(file.id);
      return cachedFileId;
    }

    return null;
  }

  async function loadJournal() {
    const fileId = await resolveFileId();
    if (!fileId) {
      journalData = createEmptyJournal();
      const file = await createFile(journalData);
      cachedFileId = file.id;
      storeCachedFileId(file.id);
      return journalData;
    }

    journalData = await downloadFile(fileId);
    return journalData;
  }

  async function saveJournal() {
    if (!journalData) journalData = createEmptyJournal();

    let fileId = await resolveFileId();
    if (!fileId) {
      const file = await createFile(journalData);
      cachedFileId = file.id;
      storeCachedFileId(file.id);
      return journalData;
    }

    try {
      await updateFile(fileId, journalData);
    } catch (err) {
      const file = await findJournalFile();
      if (file?.id && file.id !== fileId) {
        cachedFileId = file.id;
        storeCachedFileId(file.id);
        await updateFile(file.id, journalData);
        return journalData;
      }
      throw err;
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
    clearCachedFileId();
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
