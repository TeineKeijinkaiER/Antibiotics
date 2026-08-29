import { useEffect, useState } from "react";
import {
  detectPlatform,
  getInstallPrompt,
  markComplete,
  postpone,
  shouldShowGuide,
  subscribePrompt,
} from "./install-guide";

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
  const later = () => { postpone(); setVisible(false); };
  const done = () => { markComplete(); setVisible(false); };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === "accepted") done();
  };

  return (
    <div className="install-guide-backdrop">
      <section className="install-guide" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <h2 id="install-title">このアプリをすぐ使えるようにする</h2>
        {platform === "ios" ? (
          <ol>
            <li>Safariの「共有」をタップ</li>
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
        <button onClick={done}>ホーム画面に追加できた</button>
        <button onClick={later}>今回は閉じる</button>
      </section>
    </div>
  );
}
