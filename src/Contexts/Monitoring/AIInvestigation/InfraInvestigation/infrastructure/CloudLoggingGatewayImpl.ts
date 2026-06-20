import { AppLogEntry } from "../domain/InfraEvidence.js";
import { CloudLoggingGateway } from "../domain/CloudLoggingGateway.js";

// Google Cloud Logging API へのアダプタ。
// 実環境では @google-cloud/logging を使用し GCP_PROJECT_ID で接続する。
// ハッカソン提出版: 空配列を返すスタブ（API 疎通なし）。
export class CloudLoggingGatewayImpl implements CloudLoggingGateway {
  constructor(private readonly projectId: string = process.env.GCP_PROJECT_ID ?? "") {}

  async getAppLogs(_params: {
    service: string;
    occurredOn: Date;
    windowMinutes?: number;
  }): Promise<AppLogEntry[]> {
    // TODO: @google-cloud/logging を使い severity>=WARNING のログを取得する
    // const logging = new Logging({ projectId: this.projectId });
    // const [entries] = await logging.getEntries({ filter: `...`, pageSize: 50 });
    return [];
  }
}
