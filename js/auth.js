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

  function clearTokenFromUrl() {
    if (!location.hash && !location.search) return;
    const hash = new URLSearchParams(location.hash.slice(1));
    const search = new URLSearchParams(location.search);
    if (
      hash.has('access_token') ||
      hash.has('error') ||
      search.has('code') ||
      search.has('error')
    ) {
      history.replaceState(null, '', getRedirectUri());
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
      callback: async (response) => {
        if (response.error) {
          const message = translateOAuthError(response.error);
          onAuthChange?.({ signedIn: false, error: message });
          return;
        }

        accessToken = response.access_token;
        clearTokenFromUrl();

        try {
          await fetchProfile();
          onAuthChange?.({ signedIn: true, profile: userProfile });
        } catch (err) {
          onAuthChange?.({ signedIn: false, error: err.message });
        }
      },
      error_callback: (err) => {
        onAuthChange?.({ signedIn: false, error: translateOAuthError(err) });
      },
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
      throw new Error(err.error?.message || '無法取得使用者資訊，請確認 OAuth 範圍已設定');
    }
    userProfile = await res.json();
    return userProfile;
  }

  async function signIn() {
    const client = await ensureTokenClient();
    client.requestAccessToken({ prompt: 'consent' });
  }

  async function handleRedirectReturn() {
    const params = new URLSearchParams(location.hash.slice(1));
    const error = params.get('error');
    if (error) {
      clearTokenFromUrl();
      throw new Error(translateOAuthError(error));
    }

    const token = params.get('access_token');
    if (!token || !hasClientId()) {
      return false;
    }

    accessToken = token;
    clearTokenFromUrl();
    await ensureTokenClient();
    await fetchProfile();
    return true;
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
    waitForGoogle,
  };
})();
