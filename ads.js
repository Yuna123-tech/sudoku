/* 광고: 안드로이드 앱에서만 표시하고, 웹사이트에서는 아무것도 하지 않음 */
(() => {
  'use strict';
  const cap = window.Capacitor;
  const AdMob = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AdMob;
  window.SudokuAds = { onWin() {}, beforeNewGame() {} };
  if (!AdMob) return;

  // 광고 단위 ID: 지금은 구글 시험용. 애드몹 계정을 만들면 내 광고 단위 ID로 교체
  const AD_UNITS = {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  };
  const INTERSTITIAL_EVERY = 3; // 퍼즐을 3판 완료할 때마다 다음 판 시작 전에 전면 광고 1번

  let interstitialReady = false, wins = 0, pending = false;

  async function prepareInterstitial() {
    try {
      await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
      interstitialReady = true;
    } catch {
      interstitialReady = false;
    }
  }

  async function init() {
    try {
      await AdMob.initialize({});
      // 유럽 등 동의가 필요한 지역에서는 개인정보 동의 창을 먼저 띄움
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') consent = await AdMob.showConsentForm();
      if (consent.canRequestAds === false) return;
    } catch {
      return;
    }
    // 배너 높이만큼 화면 아래쪽을 비워서 판·버튼이 가려지지 않게 함
    AdMob.addListener('bannerAdSizeChanged', (size) => {
      document.documentElement.style.setProperty('--ad-h', `${size.height}px`);
    });
    AdMob.addListener('interstitialAdDismissed', () => {
      interstitialReady = false;
      prepareInterstitial();
    });
    AdMob.showBanner({ adId: AD_UNITS.banner, position: 'BOTTOM_CENTER', margin: 0 }).catch(() => {});
    prepareInterstitial();
  }

  window.SudokuAds = {
    onWin() {
      wins++;
      if (wins % INTERSTITIAL_EVERY === 0) pending = true;
    },
    beforeNewGame() {
      if (!pending || !interstitialReady) return;
      pending = false;
      AdMob.showInterstitial().catch(() => {});
    },
  };
  init();
})();
