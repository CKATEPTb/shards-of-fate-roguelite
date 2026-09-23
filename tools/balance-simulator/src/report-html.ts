interface ReportRow {
  group: string; runs: number; victories: number; winRate: number; confidence95: number[];
  successfulMinutes: { median: number | null }; bossesDefeated: number[];
}
interface Report {
  complete: boolean; contentHash: string; seedPrefix: string; completedCampaigns: number;
  totalBattles: number; wallSeconds: number; virtualHours: number; byPartySize: ReportRow[];
  sourcesUnchanged?: boolean;
}
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function campaignReportHtml(report: Report): string {
  const sourceWarning = report.sourcesUnchanged === false
    ? '<aside class="source-warning" role="alert"><strong>Серия не прошла проверку исходников</strong><span>Исходники изменились во время расчёта. Эти результаты не подтверждают баланс текущей версии. Повторите серию после завершения изменений.</span></aside>' : '';
  const labels: Record<string, string> = { normal: 'Лёгкая', hard: 'Нормальная', nightmare: 'Сложная', progression: 'С добычей', starter: 'Стартовые вещи' };
  const rows = report.byPartySize.map(row => {
    const [mode, difficulty, size] = row.group.split(':');
    return `<tr><td>${labels[mode]}<small>${labels[difficulty]} · ${size} ${size === '1' ? 'герой' : 'героя'}</small></td>
      <td><b>${percent(row.winRate)}</b><div class="bar"><i style="width:${100 * row.winRate}%"></i></div><small>95%: ${row.confidence95.map(percent).join('–')}</small></td>
      <td>${row.victories} / ${row.runs}</td><td>${row.successfulMinutes.median?.toFixed(1) ?? '—'} мин</td>
      <td class="stages">${row.bossesDefeated.map((count, index) => `<span title="${index} боссов побеждено">${index}<b>${count}</b></span>`).join('')}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Баланс похода</title><style>
    .source-warning{display:grid;gap:8px;margin:20px 0;padding:18px 20px;border:2px solid #e7ab62;border-radius:10px;background:#3a281c;color:#ffe0b5;line-height:1.5}.source-warning strong{font-size:19px}
    :root{color-scheme:dark;font-family:system-ui,sans-serif;background:#11171c;color:#e1e7e9}*{box-sizing:border-box}body{max-width:1150px;margin:auto;padding:32px 20px}h1{font-size:32px;margin:8px 0}p{line-height:1.6;color:#acb9bf;max-width:850px}.eyebrow{color:#d8b879;font-size:12px;letter-spacing:.15em}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0}.metrics div{padding:18px;background:#1a252d;border-radius:10px}.metrics b{display:block;font-size:26px;color:#e4c995}.metrics small{color:#acb9bf}table{width:100%;border-collapse:collapse;background:#172027;border-radius:10px;overflow:hidden}th,td{text-align:left;padding:16px;border-bottom:1px solid #2b3740}th{font-weight:500;color:#a6b7c2;font-size:13px}td small{display:block;margin-top:5px;color:#9db0bb;font-size:12px}.bar{height:4px;background:#303d46;margin:6px 0;width:130px}.bar i{height:100%;display:block;background:#b8d3a5}.stages{white-space:nowrap}.stages span{display:inline-block;text-align:center;margin-right:12px;color:#7e94a2;font-size:11px}.stages b{display:block;color:#c7d6df;font-size:14px}code{color:#c8b591}footer{font-size:12px;color:#899ba7;margin-top:24px}@media(max-width:750px){body{padding:20px 12px}.metrics{grid-template-columns:1fr 1fr}th,td{padding:12px 8px}th:last-child,td:last-child{display:none}.bar{width:90px}h1{font-size:26px}}
    </style><div class="eyebrow">SHARDS OF FATE · СИМУЛЯЦИИ</div><h1>Баланс полного похода</h1>${sourceWarning}
    <p>Четыре сезонных босса, постоянные ранения, настоящие броски кубиков и подбор снаряжения. Всё игровое время виртуальное: таймеры и анимации не ожидаются. ${report.complete ? 'Серия завершена.' : 'Незавершённая серия.'}</p>
    <div class="metrics"><div><b>${report.completedCampaigns.toLocaleString('ru')}</b><small>походов</small></div><div><b>${report.totalBattles.toLocaleString('ru')}</b><small>боёв</small></div><div><b>${report.virtualHours.toFixed(0)} ч</b><small>игрового времени</small></div><div><b>${report.wallSeconds.toFixed(0)} с</b><small>время расчёта серии</small></div></div>
    <table><thead><tr><th>Условия</th><th>Победы</th><th>Выборка</th><th>Медиана побед</th><th>Завершено боссов: 0–4</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Ориентиры: лёгкая — 30%, нормальная — 15%, сложная — 5–10%. Интервалы показывают неопределённость измерения. Это результаты бота на заданном маршруте, а не измеренный процент побед людей. Передвижение и выбор столкновений упрощены; решения в бою и подбор вещей выполняются без знания будущих кубиков.</p>
    <footer>Сиды: <code>${escape(report.seedPrefix)}</code> · Контент: <code>${escape(report.contentHash)}</code> · Сравнение сложностей использует одинаковые сиды и составы отрядов.</footer></html>`;
}
