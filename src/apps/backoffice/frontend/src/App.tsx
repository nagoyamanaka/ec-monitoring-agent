import { Navigate, Route, Routes } from "react-router-dom";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { AlertsPage } from "@features/alerts/pages/AlertsPage";
import { AlertDetailPage } from "@features/alerts/pages/AlertDetailPage";

/**
 * /analytics の暫定プレースホルダ（タスク11で AnalyticsPage に差し替える）。
 * ルートを今のうちに確保しておき、後続タスクは置換のみで済むようにする。
 */
function AnalyticsPlaceholder() {
  return (
    <DefaultLayout>
      <div className="rounded-tremor-default bg-slate-800/30 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-inset ring-slate-700/50">
        Analytics は準備中です。
      </div>
    </DefaultLayout>
  );
}

/** バックオフィスのルーティング。各ページが自前のレイアウトを持つためフラット構成。 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/alerts" replace />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/alerts/:id" element={<AlertDetailPage />} />
      <Route path="/analytics" element={<AnalyticsPlaceholder />} />
      <Route path="*" element={<Navigate to="/alerts" replace />} />
    </Routes>
  );
}
