import { initialTurnState, reduceTurn, type TurnEffect, type TurnEvent, type TurnOptions, type TurnResult, type TurnState } from "./voice-turn";

export interface VoiceTurnAdapterPorts {
  now: () => number;
  agentConnected: () => boolean;
  applyEffect: (effect: TurnEffect, generation: number) => void | Promise<void>;
  onState?: (state: TurnState) => void;
  onPhase?: (phase: TurnState["phase"], at: number) => void;
  onError?: (error: unknown) => void;
}

export function stopAndClearMediaStream(ref: { current: { getTracks(): ArrayLike<{ stop(): void }> } | null }): void {
  const stream = ref.current;
  ref.current = null;
  if (!stream) return;
  for (const track of Array.from(stream.getTracks())) track.stop();
}

export class VoiceTurnAdapter {
  private state: TurnState = initialTurnState;
  private readonly pending: Array<{ generation: number; resolve: (result: TurnResult) => void }> = [];
  private generation = 0;
  private squelched = false;

  constructor(private readonly ports: VoiceTurnAdapterPorts) {}

  snapshot() { return this.state; }
  currentGeneration() { return this.generation; }
  isSquelched() { return this.squelched; }
  authorizeLegacy() { this.squelched = false; }

  turn(options: TurnOptions): Promise<TurnResult> {
    const generation = ++this.generation;
    const promise = new Promise<TurnResult>((resolve) => this.pending.push({ generation, resolve }));
    this.dispatch({ type: "SEND", at: this.ports.now(), options, agentConnected: this.ports.agentConnected(), ...(options.recordClip ? { audioId: `clip_${Date.now().toString(36)}` } : {}) });
    return promise;
  }

  tick(at = this.ports.now()) { this.dispatch({ type: "TICK", at }); }
  submitTyped(text: string, at = this.ports.now()) { this.dispatch({ type: "TYPED", at, text }); }
  finishAnswer(at = this.ports.now()) { this.dispatch({ type: "ACCEPT_SPEECH", at }); }
  cancel(reason: TurnResult["abortReason"] = "user", at = this.ports.now()) { this.dispatch({ type: "CANCEL", at, reason }); }
  disconnect(at = this.ports.now()) { this.cancel("disconnected", at); }

  dispatchForGeneration(generation: number, event: TurnEvent): boolean {
    if (generation !== this.generation) return false;
    this.dispatch(event);
    return true;
  }

  dispatch(event: TurnEvent) {
    const previous = this.state;
    const transition = reduceTurn(previous, event);
    this.state = transition.state;
    try { this.ports.onState?.(this.state); } catch (error) { this.ports.onError?.(error); }
    if (previous.phase !== this.state.phase) {
      try { this.ports.onPhase?.(this.state.phase, event.at); } catch (error) { this.ports.onError?.(error); }
      try { (this.state.options ?? previous.options)?.onPhase?.(this.state.phase, event.at); } catch (error) { this.ports.onError?.(error); }
    }
    for (const effect of transition.effects) {
      if (effect.type === "SQUELCH") this.squelched = true;
      if (effect.type === "OPEN_GATE") this.squelched = false;
      if (effect.type === "RESOLVE") this.pending.shift()?.resolve(effect.result);
      try {
        const pending = this.ports.applyEffect(effect, this.generation);
        void pending?.catch((error) => this.ports.onError?.(error));
      } catch (error) {
        this.ports.onError?.(error);
      }
    }
  }
}
