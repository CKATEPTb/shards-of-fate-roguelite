import type { Direction, Season } from "@shards/shared";

export const seasonLabels: Record<Season, string> = { spring: "Весна", summer: "Лето", autumn: "Осень", winter: "Зима" };
export const seasonNames: Record<Season, string> = { spring: "Пробуждающийся лес", summer: "Солнечные рощи", autumn: "Янтарные тропы", winter: "Безмолвные земли" };
export const seasonColors: Record<Season, string> = { spring: "#91ae79", summer: "#d2bc73", autumn: "#c98662", winter: "#a0bec9" };
export const directionLabels: Record<Direction, { short: string; action: string; arrow: string }> = {
  north: { short: "С", action: "К северному выходу", arrow: "↑" },
  east: { short: "В", action: "К восточному выходу", arrow: "→" },
  south: { short: "Ю", action: "К южному выходу", arrow: "↓" },
  west: { short: "З", action: "К западному выходу", arrow: "←" },
};
