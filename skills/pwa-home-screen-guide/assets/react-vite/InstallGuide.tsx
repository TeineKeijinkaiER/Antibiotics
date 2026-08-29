import { useEffect, useState } from "react";
import {
  detectPlatform,
  getInstallPrompt,
  markComplete,
  postpone,
  shouldShowGuide,
  subscribePrompt,
} from "./install-guide";

function SafariShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
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
  const [, rerender] = useState(0);
  const platform = detectPlatform();
  const prompt = getInstallPrompt();

  useEffect(() => {
    setVisible(shouldShowGuide());
    return subscribePrompt(() => rerender((value) => value + 1));
  }, []);

  if (!visible) return null;
  const closeGuide = () => { postpone(); setVisible(false); };
  const done = () => { markComplete(); setVisible(false); };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === "accepted") done();
  };

  return (
    <div className="install-guide-backdrop">
      <section className="install-guide" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <div className="install-guide-head">
          <h2 id="install-title">このアプリを追加</h2>
          <button type="button" className="install-guide-close" aria-label="案内を閉じる" onClick={closeGuide}>×</button>
        </div>
        <p>
          {platform === "ios"
            ? "携帯電話のホーム画面に登録すると、通常のアプリと同じように繰り返して使用できます。 Safariの画面で以下のように登録してください"
            : prompt
              ? "携帯電話のホーム画面に登録すると、通常のアプリと同じように繰り返して使用できます。 下のボタンから登録してください"
              : "携帯電話のホーム画面に登録すると、通常のアプリと同じように繰り返して使用できます。 Chromeの画面で以下のように登録してください"}
        </p>
        {platform === "ios" ? (
          <ol>
            <li><SafariShareIcon /> Safariの「共有」（このマーク）をタップ</li>
            <li>「ホーム画面に追加」を選択</li>
            <li>「追加」をタップ</li>
          </ol>
        ) : prompt ? (
          <button onClick={() => void install()}>この端末にインストール</button>
        ) : (
          <ol>
            <li>Chrome右上のメニューをタップ</li>
            <li>「アプリをインストール」または「ホーム画面に追加」を選択</li>
            <li>「インストール」をタップ</li>
          </ol>
        )}
      </section>
    </div>
  );
}
