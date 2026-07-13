const Auth = (() => {
  let accessToken = null;
  let tokenClient = null;
  let userProfile = null;
  let onAuthChange = null;

  function waitForGoogle() {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  function init(callback) {
    onAuthChange = callback;
  }

  async function ensureTokenClient() {
    await waitForGoogle();
    const clientId = getClientId();
    if (!clientId) {
      throw new Error('請先設定 Google OAuth 用戶端 ID');
    }

    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CONFIG.SCOPES,
        callback: (response) => {
          if (response.error) {
            console.error('OAuth error:', response);
            onAuthChange?.({ signedIn: false, error: response.error });
            return;
          }
          accessToken = response.access_token;
          fetchProfile().then(() => {
            onAuthChange?.({ signedIn: true, profile: userProfile });
          });
        },
      });
    }
    return tokenClient;
  }

  async function fetchProfile() {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('無法取得使用者資訊');
    userProfile = await res.json();
    return userProfile;
  }

  async function signIn() {
    const client = await ensureTokenClient();
    return new Promise((resolve, reject) => {
      client.callback = async (response) => {
        if (response.error) {
          onAuthChange?.({ signedIn: false, error: response.error });
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        try {
          await fetchProfile();
          onAuthChange?.({ signedIn: true, profile: userProfile });
          resolve({ accessToken, profile: userProfile });
        } catch (err) {
          reject(err);
        }
      };
      client.requestAccessToken({ prompt: 'consent' });
    });
  }

  function signOut() {
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    userProfile = null;
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
    const client = await ensureTokenClient();
    return new Promise((resolve, reject) => {
      client.callback = async (response) => {
        if (response.error) {
          reject(new Error('登入已過期，請重新登入'));
          return;
        }
        accessToken = response.access_token;
        try {
          await fetchProfile();
          onAuthChange?.({ signedIn: true, profile: userProfile });
          resolve(accessToken);
        } catch (err) {
          reject(err);
        }
      };
      client.requestAccessToken({ prompt: '' });
    });
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
  };
})();
