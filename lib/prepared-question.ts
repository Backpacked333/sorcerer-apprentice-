import type { WorkingMemory } from "./memory";

export class PreparedQuestions {
  private packet?: { key: string; expiresAt: number; questions: { candidateId: string; question: string }[] };
  clear() { this.packet = undefined; }
  set(memory: WorkingMemory, questions: { candidateId: string; question: string }[], now = Date.now()) {
    this.packet = { key: JSON.stringify(memory), expiresAt: now + 20000, questions };
  }
  get(memory: WorkingMemory, candidateId: string, now = Date.now()) {
    const p = this.packet;
    if (!p || p.expiresAt <= now || p.key !== JSON.stringify(memory)) return undefined;
    return p.questions.find((q) => q.candidateId === candidateId)?.question;
  }
  preferred(memory: WorkingMemory, now = Date.now()) {
    const id = this.packet?.questions[0]?.candidateId;
    return id && this.get(memory, id, now) ? id : undefined;
  }
}
