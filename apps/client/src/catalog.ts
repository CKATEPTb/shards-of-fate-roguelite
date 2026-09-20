import { gameContent } from "@shards/game-data";
import type { CombatState, UnitDefinition } from "@shards/shared";

export { gameContent };
export const definitions = [...gameContent.characters, ...gameContent.enemies];
export const roleNames = {
  tank: "Защитник",
  healer: "Целитель",
  damage: "Урон",
};
export const findDefinition = (id: string): UnitDefinition =>
  definitions.find((unit) => unit.id === id) ?? definitions[0];
export const isFinished = (state: CombatState) =>
  ["victory", "defeat", "draw"].includes(state.status);
export const skillName = (id: string) =>
  gameContent.skills.find((skill) => skill.id === id)?.name ?? id;
