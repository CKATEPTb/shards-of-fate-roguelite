import type { RewardRarity } from '@shards/shared';
import './equipmentRarity.css';

export const EQUIPMENT_RARITY_NAMES: Record<RewardRarity, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};

export function EquipmentRarityBadge({ rarity = 'common' }: { rarity?: RewardRarity }) {
  return <span className="equipment-rarity-badge" data-equipment-rarity={rarity}>
    <span aria-hidden="true">◇</span>{EQUIPMENT_RARITY_NAMES[rarity]}
  </span>;
}
