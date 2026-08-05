# 脆弱性修正レポート (Remediation Note)

以下の HIGH / CRITICAL 脆弱性を修正するため、パッケージの更新および整合性確認を実施しました。

## 1. 対象の脆弱性と対応

| パッケージ名 | CVE番号 | 脆弱性深刻度 (Severity) | 修正前バージョン | 修正後バージョン (fixedVersion) |
|---|---|---|---|---|
| **ansi-regex** | CVE-2021-3807 | CRITICAL | `3.0.0` | `5.0.1` |
| **semver** | CVE-2022-25883 | HIGH | `7.3.4` | `7.5.2` |

## 2. 実施手順

### ① ルート `package.json` の override 設定の修正
`package.json` に設定されていた `pnpm.overrides` において、対象パッケージを脆弱性のない安全なバージョンへ引き上げました。

```json
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "protobufjs"
    ],
    "overrides": {
      "ansi-regex": "5.0.1",
      "semver": "7.5.2"
    }
  }
```

### ② 依存関係の再解決とロックファイルの更新
`yes | pnpm install` を実行し、 monorepo 全体で `pnpm-lock.yaml` の再解決および更新を行いました。これにより、すべての依存先・サブ依存関係において `ansi-regex@5.0.1` および `semver@7.5.2` が使用されるように固定されました。

### ③ 整合性とビルドの検証
- **型チェック**: `pnpm run typecheck`（`tsc --noEmit`）を実行し、コンパイルエラーおよび定義エラーが発生しないことを確認しました。
- **ユニット/統合テスト**: `pnpm test`（`vitest run`）を実行し、全 108 件のテストファイル（計 676 個のテストケース）がすべて正常にパスすることを確認しました。

## 3. 検証結果
`pnpm-lock.yaml` の差分により、以下のように安全なバージョンへ確実にアップデートされていることを確認いたしました。
- `ansi-regex@3.0.0` → `ansi-regex@5.0.1`
- `semver@7.3.4` → `semver@7.5.2`
