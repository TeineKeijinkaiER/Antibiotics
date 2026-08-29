import { useEffect, useState } from "react";
import {
  detectMobilePlatform,
  getDeferredInstallPrompt,
  markInstallGuideComplete,
  postponeInstallGuide,
  shouldShowInstallGuide,
  subscribeInstallPrompt,
} from "../lib/install-guide";

function SafariShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="四角から上向き矢印が出ている共有マーク"
      data-install-icon="safari-share"
    >
      <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

export function InstallGuide() {
  const [visible, setVisible] = useState(false);
  const [, setPromptVersion] = useState(0);
  const platform = detectMobilePlatform();
  const installPrompt = getDeferredInstallPrompt();

  useEffect(() => {
    setVisible(shouldShowInstallGuide());
    return subscribeInstallPrompt(() => setPromptVersion((value) => value + 1));
  }, []);

  if (!visible) return null;

  const closeForNow = () => {
    postponeInstallGuide();
    setVisible(false);
  };

  const completed = () => {
    markInstallGuideComplete();
    setVisible(false);
  };

  const installAndroid = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") completed();
  };

  return (
    <div className="install-guide-backdrop" role="presentation">
      <section
        className="install-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
      >
        <div className="install-guide-head">
          <div>
            <p className="install-guide-kicker">スマホでもっと便利に</p>
            <h2 id="install-guide-title">このアプリをすぐ使えるようにする</h2>
          </div>
          <button className="install-guide-close" onClick={closeForNow} aria-label="今回は閉じる">
            ×
          </button>
        </div>

        <p className="install-guide-lead">
          ホーム画面から起動すると、通常のアプリと同じように素早く参照できます。一度追加すれば、この案内は表示されません。
        </p>

        {platform === "ios" ? (
          <ol className="install-steps">
            <li><span className="install-step-icon"><SafariShareIcon /></span><span><b>Safariの「共有」</b>（左のマーク）をタップ</span></li>
            <li><span className="install-step-icon">＋</span><span><b>「ホーム画面に追加」</b>を選択</span></li>
            <li><span className="install-step-icon">✓</span><span>右上の<b>「追加」</b>をタップ</span></li>
          </ol>
        ) : (
          <>
            {installPrompt ? (
              <button className="install-primary" onClick={() => void installAndroid()}>
                この端末にアプリをインストール
              </button>
            ) : (
              <ol className="install-steps">
                <li><span className="install-step-icon">⋮</span><span>Chrome右上の<b>メニュー</b>をタップ</span></li>
                <li><span className="install-step-icon">＋</span><span><b>「アプリをインストール」</b>または<b>「ホーム画面に追加」</b>を選択</span></li>
                <li><span className="install-step-icon">✓</span><span>確認画面で<b>「インストール」</b>をタップ</span></li>
              </ol>
            )}
          </>
        )}

        {platform === "ios" && (
          <p className="install-guide-note">共有ボタンが見つからない場合は、Safariでこのページを開いてください。</p>
        )}

        <div className="install-guide-actions">
          <button className="sub-btn" onClick={completed}>ホーム画面に追加できた</button>
          <button className="link-btn" onClick={closeForNow}>今回は閉じる</button>
        </div>
      </section>
    </div>
  );
}
