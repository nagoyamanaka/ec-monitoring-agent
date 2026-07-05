# Cloud SQL (PostgreSQL) — EC バックエンドの主データストア。
# デモ シナリオ5（構成変更障害）の対象リソース。この健全ベースラインが「障害前の正しい状態」で、
# コスト最適化と称した tier / max_connections の縮小（別ブランチの apply）が接続枯渇を招く。
resource "google_sql_database_instance" "main" {
  name             = "ec-main"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    # コスト最適化で最小 tier に縮小。ワークロードに対して過小（＝障害の起点）。
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10

    database_flags {
      name = "max_connections"
      # あわせて接続上限も縮小（＝接続枯渇の直接要因）。
      value = "20"
    }
  }

  deletion_protection = true
}
