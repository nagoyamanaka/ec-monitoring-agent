# Cloud SQL (PostgreSQL) — EC バックエンドの主データストア。
# デモ シナリオ6（構成変更障害）の対象リソース。コスト最適化と称した tier / max_connections の
# 縮小（この baseline の値）が接続枯渇を招き、DB インスタンスを不安定化させた。
resource "google_sql_database_instance" "main" {
  name             = "ec-main"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    # 障害前の容量へ復旧（AI 調査の apply 差分 before 値）。
    tier              = "db-custom-2-7680"
    availability_type = "ZONAL"
    disk_size         = 10

    database_flags {
      name = "max_connections"
      # 接続枯渇を解消するため障害前の 100 へ復旧。
      value = "100"
    }
  }

  deletion_protection = true
}
