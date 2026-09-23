import { DIFFICULTY_PROFILES } from '@shards/game-data';
import type { DifficultyId } from '@shards/shared';
import { CampIcon } from './CampIcon';

export function CampDifficulty({ value, onChange, disabled = false }: { value?: DifficultyId; onChange: (id: DifficultyId) => void; disabled?: boolean }) {
  return <div className="camp-difficulties" role="group" aria-label={value ? 'Сложность' : 'Сложность выбирает хост'}>
    {Object.values(DIFFICULTY_PROFILES).map(profile => <button key={profile.id} type="button" className={`camp-difficulty camp-difficulty-${profile.id}`} disabled={disabled || !value} aria-label={profile.name} aria-pressed={value === profile.id} onClick={() => onChange(profile.id)} title={value ? profile.description : 'Сложность выбирает хост'}><CampIcon name={profile.id} /><span>{profile.name}</span></button>)}
  </div>;
}
