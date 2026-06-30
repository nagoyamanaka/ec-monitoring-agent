// 字句類似度（トークン Jaccard, [0,1]）。検索バックエンド非依存・有界・決定的な「似ている度合い」。
//
// 設計意図: 検索（候補取得）は backend の関連度（Elastic の BM25 等）に任せ、**分類の confidence には
// この有界な指標を使う**。BM25 の生スコアは無界でコーパス規模・アナライザに依存し、小コーパスでは
// 容易に飽和して「無関係な過去事例に 100% 類似」のような偽 KNOWN を生む。Jaccard なら構成上 [0,1] に
// 収まり、Elastic と InMemory が同じ意味の score を返せる。
//
// 日本語対応: 和文（CJK）連続は **文字 bigram** に展開して分かち書きを近似する。
//  - 「丸ごと1トークン」だと言い回しが少し違うだけで一致ゼロ（過小評価）になるので、bigram で部分一致を拾う。
//  - 文字 unigram より bigram の方が共通助詞（の/が…）単独での過剰一致を抑えられ偽陽性に強い。
//  - 依存ゼロ・同期・有界（Jaccard）で、純粋ドメイン関数のまま完結する（kuromoji.js の辞書ロード/非同期は
//    この同期スコアラには不向き）。形態素解析が要るなら別途 kuromoji を注入する余地は残す。
export function lexicalSimilarity(a: string, b: string): number {
  return jaccard(tokenize(a), tokenize(b));
}

const CJK = "ぁ-んァ-ヶ一-龠";

export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();
  // 英数トークン（語境界で分割）。
  for (const token of lower.match(/[a-z0-9]+/g) ?? []) {
    tokens.add(token);
  }
  // 和文（CJK）連続は文字 bigram に展開（1文字だけなら unigram）。
  for (const run of lower.match(new RegExp(`[${CJK}]+`, "g")) ?? []) {
    const chars = [...run];
    if (chars.length === 1) {
      tokens.add(chars[0]);
    } else {
      for (let i = 0; i < chars.length - 1; i++) {
        tokens.add(chars[i] + chars[i + 1]);
      }
    }
  }
  return tokens;
}

// Jaccard 係数: |A∩B| / |A∪B| ∈ [0,1]
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
