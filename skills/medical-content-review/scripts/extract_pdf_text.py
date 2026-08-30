#!/usr/bin/env python3
"""PDF をページ番号タグ付きのテキストに落とす。

照合スクリプトはすべて `===== [<tag> p.<n>] =====` という区切り行を前提にする。
n は PDF の物理ページ番号（1始まり）であって、紙面に印刷されたページ番号ではない。
資料によっては表紙・目次の分だけずれるので、--probe で必ず確かめること。

使い方:
    python extract_pdf_text.py manual.pdf out/manual.txt --tag manual
    python extract_pdf_text.py guideline.pdf out/gl.txt --tag gl --probe "目標トラフ"
"""

import argparse
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF が必要です: pip install pymupdf")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("out")
    ap.add_argument("--tag", default="doc", help="ページ区切り行に埋め込む識別子（英小文字と_のみ）")
    ap.add_argument(
        "--probe",
        action="append",
        default=[],
        help="この文字列を含む物理ページ番号を報告する。印刷ページ番号とのずれの確認に使う（複数可）",
    )
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    texts = [page.get_text() for page in doc]

    with open(args.out, "w", encoding="utf-8") as f:
        for i, text in enumerate(texts, start=1):
            f.write(f"\n===== [{args.tag} p.{i}] =====\n")
            f.write(text)

    print(f"{args.pdf}: {doc.page_count} ページ -> {args.out}（tag={args.tag}）")

    empty = [i for i, t in enumerate(texts, start=1) if not t.strip()]
    if empty:
        print(
            f"警告: テキストが取れなかったページが {len(empty)} 件あります "
            f"（画像PDFの可能性: {empty[:10]}{'...' if len(empty) > 10 else ''}）。"
            " これらのページを引用している記載は機械照合では検証できないので、手で確認すること。"
        )

    for needle in args.probe:
        hits = [i for i, t in enumerate(texts, start=1) if needle in t]
        print(f"probe {needle!r}: 物理ページ {hits if hits else '該当なし'}")
        if not hits:
            print("   -> 見つからない場合、テキスト化に失敗しているか、語形が違う可能性がある")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
