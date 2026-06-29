import {
  EscalationDirectory,
  EscalationDirectoryEntry,
} from "../../domain/escalation/EscalationDirectory.js";

/**
 * EscalationDirectory のオンメモリ実装（seed 駆動・read-only）。タスク35。
 *
 * affectedSubjects と各エントリの ownsSubjects を大文字小文字を無視した部分一致で突合し、
 * 1 つでも所有主体が当たったチームを返す。複数チームが当たる場合は ownsSubjects に登録した順
 * （= seed の宣言順）を保ち、エージェントが上位から宛先を選べるようにする。
 *
 * 疎通主体ではなく突合ロジックを持つので、SimilarIncident の InMemory 実装と同じくここは UT する。
 */
export class InMemoryEscalationDirectory implements EscalationDirectory {
  constructor(private readonly entries: EscalationDirectoryEntry[]) {}

  async findBySubjects(subjects: string[]): Promise<EscalationDirectoryEntry[]> {
    const needles = subjects
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    if (needles.length === 0) return [];

    return this.entries.filter((entry) =>
      entry.ownsSubjects.some((owned) => {
        const hay = owned.toLowerCase();
        return needles.some((needle) => hay.includes(needle) || needle.includes(hay));
      }),
    );
  }
}
