import { AlgorithmDefinition, AlgorithmRegistry } from "@algoviz/shared";

class InMemoryRegistry implements AlgorithmRegistry {
  private algorithms = new Map<string, AlgorithmDefinition>();

  register<Input, State, Event extends import("@algoviz/shared").ExecutionEvent>(
    def: AlgorithmDefinition<Input, State, Event>
  ): void {
    if (this.algorithms.has(def.id)) {
      throw new Error(`Algorithm with id ${def.id} already registered`);
    }
    this.algorithms.set(def.id, def as AlgorithmDefinition);
  }

  get(id: string): AlgorithmDefinition | undefined {
    return this.algorithms.get(id);
  }

  getByCategory(category: string): AlgorithmDefinition[] {
    return Array.from(this.algorithms.values()).filter((a) => a.category === category);
  }

  getAll(): AlgorithmDefinition[] {
    return Array.from(this.algorithms.values());
  }
}

export const algorithmRegistry = new InMemoryRegistry();

export function registerAlgorithm<Input, State, Event extends import("@algoviz/shared").ExecutionEvent>(
  def: AlgorithmDefinition<Input, State, Event>
): void {
  algorithmRegistry.register(def);
}

export function getAlgorithm(id: string): AlgorithmDefinition | undefined {
  return algorithmRegistry.get(id);
}

export function getAlgorithmsByCategory(category: string): AlgorithmDefinition[] {
  return algorithmRegistry.getByCategory(category);
}

export function getAllAlgorithms(): AlgorithmDefinition[] {
  return algorithmRegistry.getAll();
}