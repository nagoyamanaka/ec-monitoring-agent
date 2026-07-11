import { useEffect } from "react";

/** タブ／録画に出るブランド接尾辞。全ルート共通で `${page} · Kizashi` に揃える。 */
const BRAND = "Kizashi";

/**
 * ルート別に `document.title` を設定するフック（step9 N2）。
 * 画面共有・録画でブラウザタブが画面ごとに変わる（アラート／学習／予兆…）＝地に足のついた
 * 見え方にするための安価な一筆。アンマウント時の復帰はしない（次ルートが必ず上書きするため）。
 * page が空なら接尾辞のみ（誤って「 · Kizashi」を出さない）。
 */
export function useDocumentTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} · ${BRAND}` : BRAND;
  }, [page]);
}
