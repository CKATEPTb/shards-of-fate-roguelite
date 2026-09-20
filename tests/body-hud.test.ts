import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { BodyStatus } from '../apps/client/src/components/exploration/BodyStatus';
import { PartyHud } from '../apps/client/src/components/exploration/PartyHud';
import { CampfirePanel } from '../apps/client/src/components/exploration/CampfirePanel';
import { bodyPartView } from '../apps/client/src/components/exploration/body-status-model';

const party = () => createCombat({ seed: 'body-hud', characterIds: ['guardian', 'priest', 'mage'], encounterId: 'mossy_path' }, gameContent);

describe('body resource UI', () => {
  it('distinguishes an injured part from an absent part without aggregating hero health', () => {
    const body = party().units.find(unit => unit.definitionId === 'guardian')!.body!;
    body.head.current = body.head.max / 2;
    body.leftArm.current = 0;
    expect(bodyPartView(body, 'head')).toMatchObject({ state: 'injured', ratio: 0.5 });
    expect(bodyPartView(body, 'leftArm')).toMatchObject({ state: 'lost', label: 'Утрачена', ratio: 0 });
    const html = renderToStaticMarkup(createElement(BodyStatus, { body, detailed: true }));
    expect(html.match(/data-body-part=/g)).toHaveLength(6);
    expect(html).toContain('data-body-part="leftArm" data-body-state="lost"');
    expect(html).toContain('Левая рука: 0 из');
    expect(html).toContain('Голова');
    expect(html).not.toContain('maxHp');
  });

  it('keeps six visible body indicators for each party member and removes the old overall HP UI', () => {
    const state = party();
    const html = renderToStaticMarkup(createElement(PartyHud, { state, actors: [], selected: 'guardian', hovered: null }));
    expect(html.match(/data-body-part=/g)).toHaveLength(18);
    expect(html).not.toContain('party-hp');
    expect(html).not.toContain('health-track');
    expect(html).toContain('Общая защита:');
  });

  it('keeps rest unavailable while a changing world reports a blocker', () => {
    const blocked = renderToStaticMarkup(createElement(CampfirePanel, { canRest: false, reason: 'Вас преследуют', onRest: () => {} }));
    expect(blocked).toContain('Вас преследуют');
    expect(blocked).toContain('disabled=""');
    expect(blocked).toContain('Бесплатно');
    expect(blocked).toContain('Погибшие герои не возвращаются');
    const available = renderToStaticMarkup(createElement(CampfirePanel, { canRest: true, onRest: () => {} }));
    expect(available).not.toContain('disabled=');
  });
});
