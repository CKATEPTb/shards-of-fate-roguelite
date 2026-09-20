import './campfirePanel.css';

export function CampfirePanel({ canRest, reason, onRest }: { canRest: boolean; reason?: string; onRest: () => void }) {
  return <div className="campfire-panel" data-testid="campfire-panel">
    <p>Восстановить сохранившиеся части тела живых героев отряда.</p>
    <p className="campfire-rest-note">Утраченные конечности не отрастают. Погибшие герои не возвращаются к жизни.</p>
    {reason && <p className="campfire-rest-reason" role="status">{reason}</p>}
    <button className="primary-button" type="button" onClick={onRest} disabled={!canRest}>Отдохнуть <span>Бесплатно</span></button>
  </div>;
}
