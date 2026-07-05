# Cloud SQL (PostgreSQL) — EC バックエンドの主データストア。
# デモ シナリオ5（構成変更障害）の対象リソース。この健全ベースラインが「障害前の正しい状態」で、
# コスト最適化と称した tier / max_connections の縮小（別ブランチの apply）が接続枯渇を招く。
resource "google_sql_database_instance" "main" {
  name             = "ec-main"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    # 本番相当の tier。ワークロードに見合う容量（縮小の before 値）。
    tier              = "db-custom-2-7680"
    availability_type = "ZONAL"
    disk_size         = 10

    database_flags {
      name = "max_connections"
      # アプリの接続プールを賄える上限（縮小の before 値）。
      value = "100"
    }
  }

  deletion_protection = true
}
