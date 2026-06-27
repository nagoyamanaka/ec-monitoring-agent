import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { AlertReadModelStore } from "../readmodel/AlertReadModelStore.js";

/**
 * cache-aside read-model（案②）。`AlertRepository` をproxyし、consumer（UseCase）には
 * 同じ IF を見せたまま Valkey read-model を前段に挟む。composition root の差し替えのみで載る。
 *
 *  - save: Mongo(SoT) 保存後に projection を派生（per-id upsert ＋ 一覧 invalidate）。
 *    cache を真実の前段にしない（必ず inner→store の順）。
 *  - findById / findByCriteria(フィルタ無し＝一覧): Valkey hit→返す / miss・down→Mongo にフォールバック
 *    して再投入（再構築可能・結果整合）。
 *  - findByCriteria(フィルタ付き) / findOpenByDedupKey: 書き込み経路の真実が要るので常に Mongo 直読。
 *
 * SoT は常に inner(Mongo)。Valkey 障害は best-effort で握りつぶし、「障害」でなく「性能劣化」に縮める。
 */
export class ReadModelCachingAlertRepository implements AlertRepository {
  constructor(
    private readonly inner: AlertRepository,
    private readonly store: AlertReadModelStore,
  ) {}

  async save(alert: Alert): Promise<void> {
    await this.inner.save(alert);
    await this.guard(async () => {
      await this.store.saveAlert(alert.toPrimitives());
      // 一覧は incremental 更新せず invalidate（次回読み取りで Mongo から再構築＝冪等・自己回復）。
      await this.store.invalidateList();
    });
  }

  async findById(id: AlertId): Promise<Alert | null> {
    const cached = await this.guard(() => this.store.getAlert(id.value));
    if (cached) {
      return Alert.fromPrimitives(cached);
    }
    const alert = await this.inner.findById(id);
    if (alert) {
      await this.guard(() => this.store.saveAlert(alert.toPrimitives()));
    }
    return alert;
  }

  async findByCriteria(criteria: Criteria): Promise<Alert[]> {
    // 一覧スナップショット（GET /alerts・Analytics の Criteria.none()）だけキャッシュ対象。
    // フィルタ付き（調査経路の絞り込み）は write 用途なので素通しで Mongo 直読。
    if (criteria.hasFilters()) {
      return this.inner.findByCriteria(criteria);
    }
    const cached = await this.guard(() => this.store.getList());
    if (cached) {
      return cached.map((primitives) => Alert.fromPrimitives(primitives));
    }
    const alerts = await this.inner.findByCriteria(criteria);
    await this.guard(() =>
      this.store.saveList(alerts.map((alert) => alert.toPrimitives())),
    );
    return alerts;
  }

  findOpenByDedupKey(dedupKey: string): Promise<Alert | null> {
    // dedup 判定は未解決 Alert の真実が要る（畳み込みの正しさに直結）ので SoT 直読。
    return this.inner.findOpenByDedupKey(dedupKey);
  }

  // Valkey 障害は best-effort：read-model 操作の失敗は飲み込み、SoT(Mongo) 経路を壊さない。
  private async guard<T>(op: () => Promise<T>): Promise<T | null> {
    try {
      return await op();
    } catch {
      return null;
    }
  }
}
