const Auth = (() => {
  let accessToken = null;
  let tokenClient = null;
  let userProfile = null;
  let onAuthChange = null;

  function waitForGoogle() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      const started = Date.now();
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(check);
          resolve();
          return;
        }
        if (Date.now() - started > CONFIG.GOOGLE_SCRIPT_TIMEOUT_MS) {
          clearInterval(check);
          reject(new Error('idpiframe_initialization_failed'));
        }
      }, 100);
    });
  }

  function init(callback) {
    onAuthChange = callback;
  }

  function resetClient() {
    tokenClient = null;
  }

  function parseOAuthHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    return {
      accessToken: params.get('access_token'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    };
  }

  function clearOAuthFromUrl() {
    if (!location.hash) return;
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has('access_token') || params.has('error')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function createTokenClient() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error('請先設定 Google OAuth 用戶端 ID');
    }

    return google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CONFIG.SCOPES,
      ux_mode: 'redirect',
      redirect_uri: getRedirectUri(),
      callback: () => {},
      error_callback: () => {},
    });
  }

  async function ensureTokenClient() {
    await waitForGoogle();
    if (!tokenClient) {
      tokenClient = createTokenClient();
    }
    return tokenClient;
  }

  async function fetchProfile() {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || '無法取得使用者資訊');
    }
    userProfile = await res.json();
    return userProfile;
  }

  async function applyAccessToken(token) {
    accessToken = token;
    await fetchProfile();
    onAuthChange?.({ signedIn: true, profile: userProfile });
    return { accessToken, profile: userProfile };
  }

  async function handleRedirectReturn() {
    const { accessToken: token, error, errorDescription } = parseOAuthHash();
    if (!error && !token) return false;
    if (!hasClientId()) return false;

    clearOAuthFromUrl();

    if (error) {
      throw new Error(translateOAuthError(errorDescription || error));
    }

    await applyAccessToken(token);
    return true;
  }

  async function signIn() {
    await ensureTokenClient();
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function signOut() {
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    userProfile = null;
    tokenClient = null;
    onAuthChange?.({ signedIn: false });
  }

  function getAccessToken() {
    return accessToken;
  }

  function getProfile() {
    return userProfile;
  }

  function isSignedIn() {
    return Boolean(accessToken);
  }

  async function refreshTokenIfNeeded() {
    if (accessToken) return accessToken;
    throw new Error('登入已過期，請重新登入');
  }

  return {
    init,
    signIn,
    signOut,
    getAccessToken,
    getProfile,
    isSignedIn,
    refreshTokenIfNeeded,
    ensureTokenClient,
    handleRedirectReturn,
    resetClient,
    waitForGoogle,
  };
})();
