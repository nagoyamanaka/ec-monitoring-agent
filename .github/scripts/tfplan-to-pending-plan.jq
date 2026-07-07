# terraform show -json の plan 出力から、backoffice の POST /ingest/terraform-plan が受ける
# PendingPlan ワイヤ形（resourceChanges/plannedAt/summary/url）を組み立てる。
#
# ★redact が本旨: 生の plan.json は sensitive 値（Secret Manager の secret_data 等）を
# **平文で** 含む（`terraform show -no-color` のテキスト版と違いマスクされない）。
# 公開リポジトリでは Actions artifact も誰でも取得できるため、生 JSON は成果物にも
# ingest にも載せず、before_sensitive/after_sensitive のマスクに触れる属性値だけ
# "(sensitive)" へ置換した本出力（plan-changes.json）を唯一の構造化差分にする。
#
# 引数:
#   --arg url  <plan の由来リンク（PR html_url または commit URL）>
#   --arg now  <ISO8601 生成時刻>
#   --arg pr   <人間向けラベル（例 "PR #12" / "main@abc1234"）>
# リソース変更が 0 件なら empty（呼び出し側は空ファイル判定でスキップ）。

# sensitive マスク（true / 構造のどこかに true を含む object/array）の判定
def sens:
  if . == true then true
  elif type == "object" then any(.[]; sens)
  elif type == "array" then any(.[]; sens)
  else false
  end;

# 値の文字列化＋長さ上限（InfraEvidence の「文字列化済み要約値」設計に合わせる）
def scalar:
  if . == null then null
  else
    (if type == "object" or type == "array" then tojson else tostring end)
    | if length > 200 then .[:200] + "…" else . end
  end;

# terraform の actions 配列（["delete","create"] 等）を単一 action へ
def act:
  if (index("delete") and index("create")) then "replace" else .[0] end;

[ .resource_changes[]?
  | select(.mode == "managed")
  | select((.change.actions - ["no-op", "read"]) | length > 0)
  | . as $rc
  | {
      address: .address,
      action: (.change.actions | act),
      attributeDeltas: (
        [ ((($rc.change.before // {}) | keys) + (($rc.change.after // {}) | keys))
          | unique
          | .[]
          | select(($rc.change.before[.]? // null) != ($rc.change.after[.]? // null))
          | . as $k
          | {
              key: $k,
              before: (
                if (($rc.change.before_sensitive[$k]? // false) | sens) then "(sensitive)"
                else (($rc.change.before[$k]? // null) | scalar)
                end
              ),
              after: (
                if (($rc.change.after_sensitive[$k]? // false) | sens) then "(sensitive)"
                else (($rc.change.after[$k]? // null) | scalar)
                end
              )
            }
        ] | .[:20]
      )
    }
]
| .[:50]
| . as $changes
| if ($changes | length) == 0 then empty
  else
    {
      resourceChanges: $changes,
      plannedAt: $now,
      summary: (
        "terraform plan（\($pr)）: \($changes | length)件のリソース変更（\($changes[0].address)\(
          if ($changes | length) > 1 then " 他" else "" end
        )）・apply待ち"
      ),
      url: $url
    }
  end
