const Auth = (() => {
  let accessToken = null;
  let tokenClient = null;
  let userProfile = null;
  let onAuthChange = null;
  let pendingSignIn = null;

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
    pendingSignIn = null;
  }

  function finishPendingSignIn(type, value) {
    if (!pendingSignIn) return;
    clearTimeout(pendingSignIn.timer);
    const { resolve, reject } = pendingSignIn;
    pendingSignIn = null;
    if (type === 'resolve') resolve(value);
    else reject(value);
  }

  function createTokenClient() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error('請先設定 Google OAuth 用戶端 ID');
    }

    return google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CONFIG.SCOPES,
      ux_mode: 'popup',
      callback: async (response) => {
        if (response.error) {
          const message = translateOAuthError(response.error);
          onAuthChange?.({ signedIn: false, error: message });
          finishPendingSignIn('reject', new Error(message));
          return;
        }

        try {
          accessToken = response.access_token;
          await fetchProfile();
          onAuthChange?.({ signedIn: true, profile: userProfile });
          finishPendingSignIn('resolve', { accessToken, profile: userProfile });
        } catch (err) {
          onAuthChange?.({ signedIn: false, error: err.message });
          finishPendingSignIn('reject', err);
        }
      },
      error_callback: (err) => {
        const message = translateOAuthError(err);
        onAuthChange?.({ signedIn: false, error: message });
        finishPendingSignIn('reject', new Error(message));
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
    const res = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || '無法取得使用者資訊');
    }
    userProfile = await res.json();
    return userProfile;
  }

  async function signIn() {
    await ensureTokenClient();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingSignIn = null;
        reject(new Error('登入逾時，請再試一次'));
      }, CONFIG.SIGN_IN_TIMEOUT_MS);

      pendingSignIn = { resolve, reject, timer };

      try {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        clearTimeout(timer);
        pendingSignIn = null;
        reject(err);
      }
    });
  }

  function signOut() {
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    userProfile = null;
    tokenClient = null;
    pendingSignIn = null;
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
    resetClient,
    waitForGoogle,
  };
})();
