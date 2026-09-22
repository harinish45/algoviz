import {
  AlgorithmDefinition,
  ExecutionTrace,
  ExecutionEvent,
  VisualizationState,
  PracticeQuestion,
  TestCase,
} from "@algoviz/shared";

export interface ExecutionContext<State = unknown> {
  algorithm: AlgorithmDefinition<any, State>;
  input: unknown;
  seed?: number;
  onEvent?: (event: ExecutionEvent, state: State) => void;
  onStep?: (step: number, state: State) => void;
  onComplete?: (trace: ExecutionTrace<State>) => void;
  onError?: (error: Error, partialTrace: ExecutionTrace<State>) => void;
}

export interface ExecutionControls {
  step(): Promise<void>;
  play(): void;
  pause(): void;
  reset(): void;
  setSpeed(speed: number): void;
  replay(): void;
  goToStep(step: number): void;
}

export type ExecutionStatus = "idle" | "running" | "paused" | "completed" | "error";

export class AlgorithmExecutor<State = unknown> {
  private algorithm: AlgorithmDefinition<any, State>;
  private input: unknown;
  private seed: number | undefined;
  private trace: ExecutionTrace<State> | null = null;
  private status: ExecutionStatus = "idle";
  private currentStep = 0;
  private speed = 1;
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;
  private isAutoPlaying = false;
  private onEventCallback?: (event: ExecutionEvent, state: State) => void;
  private onStepCallback?: (step: number, state: State) => void;
  private onCompleteCallback?: (trace: ExecutionTrace<State>) => void;
  private onErrorCallback?: (error: Error, partialTrace: ExecutionTrace<State>) => void;

  constructor(algorithm: AlgorithmDefinition<any, State>) {
    this.algorithm = algorithm;
  }

  async execute(context: ExecutionContext<State>): Promise<ExecutionTrace<State>> {
    this.input = context.input;
    this.seed = context.seed;
    this.onEventCallback = context.onEvent;
    this.onStepCallback = context.onStep;
    this.onCompleteCallback = context.onComplete;
    this.onErrorCallback = context.onError;

    this.status = "running";
    this.currentStep = 0;

    const startTime = Date.now();
    let state = this.algorithm.execute(this.input).initialState as State;

    try {
      const fullTrace = this.algorithm.execute(this.input);
      this.trace = fullTrace;

      for (let i = 0; i < fullTrace.events.length; i++) {
        if (this.status === "paused") {
          await this.waitForResume();
        }
        if (this.status !== "running") break;

        this.currentStep = i;
        const event = fullTrace.events[i];
        state = event.stateAfter as State;

        this.onEventCallback?.(event, state);
        this.onStepCallback?.(i, state);

        await this.delayForSpeed();
      }

      this.status = "completed";
      this.onCompleteCallback?.(this.trace!);
      return this.trace!;
    } catch (error) {
      this.status = "error";
      const partialTrace = this.trace || this.createPartialTrace(state, startTime);
      this.onErrorCallback?.(error as Error, partialTrace);
      throw error;
    }
  }

  private createPartialTrace(currentState: State, startTime: number): ExecutionTrace<State> {
    return {
      algorithmId: this.algorithm.id,
      input: this.input,
      initialState: this.trace?.initialState ?? currentState,
      events: this.trace?.events.slice(0, this.currentStep) ?? [],
      finalState: currentState,
      finalResult: null,
      metadata: {
        startTime,
        endTime: Date.now(),
        totalSteps: this.currentStep,
        seed: this.seed,
      },
    };
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.status === "running") {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  private delayForSpeed(): Promise<void> {
    const baseDelay = 500;
    const delay = baseDelay / this.speed;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  getTrace(): ExecutionTrace<State> | null {
    return this.trace;
  }

  getStatus(): ExecutionStatus {
    return this.status;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  getSpeed(): number {
    return this.speed;
  }

  step(): void {
    if (this.status === "paused" || this.status === "idle") {
      this.status = "running";
    }
  }

  play(): void {
    if (this.status === "paused" || this.status === "idle") {
      this.status = "running";
      this.isAutoPlaying = true;
    }
  }

  pause(): void {
    this.status = "paused";
    this.isAutoPlaying = false;
  }

  reset(): void {
    this.pause();
    this.currentStep = 0;
    this.trace = null;
    this.status = "idle";
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(10, speed));
  }

  replay(): void {
    this.reset();
    this.execute({ input: this.input, seed: this.seed });
  }

  goToStep(step: number): void {
    if (this.trace && step >= 0 && step < this.trace.events.length) {
      this.currentStep = step;
    }
  }

  getControls(): ExecutionControls {
    return {
      step: () => Promise.resolve(this.step()),
      play: () => this.play(),
      pause: () => this.pause(),
      reset: () => this.reset(),
      setSpeed: (speed: number) => this.setSpeed(speed),
      replay: () => this.replay(),
      goToStep: (step: number) => this.goToStep(step),
    };
  }
}

export function createExecutor<State = unknown>(
  algorithm: AlgorithmDefinition<any, State>
): AlgorithmExecutor<State> {
  return new AlgorithmExecutor(algorithm);
}