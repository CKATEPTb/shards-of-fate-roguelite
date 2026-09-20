export interface UnitPalette {
  outline: string;
  shade: string;
  main: string;
  light: string;
  skin: string;
  skinShade: string;
  cloth: string;
  clothLight: string;
  trim: string;
  eye: string;
}

const base: UnitPalette = {
  outline: '#202e29', shade: '#334439', main: '#67745a', light: '#96a47d',
  skin: '#dfbd88', skinShade: '#a87656', cloth: '#553237', clothLight: '#ad5550',
  trim: '#d8c78b', eye: '#efb870',
};

const variants: Record<string, Partial<UnitPalette>> = {
  guardian: { shade: '#344a4d', main: '#58717a', light: '#a7b3aa', cloth: '#264650', clothLight: '#42717a' },
  vampire: { shade: '#3f273f', main: '#64506d', light: '#aea0b5', skin: '#d7cad1', skinShade: '#9b8298', cloth: '#392439', clothLight: '#824259', trim: '#cf7a98' },
  paladin: { shade: '#6f664d', main: '#c6b675', light: '#f1e5ba', cloth: '#ded1aa', clothLight: '#f2e6c7', trim: '#c9a755' },
  priest: { shade: '#416853', main: '#959c7b', light: '#ded8ae', cloth: '#416853', clothLight: '#709678', trim: '#edd99a' },
  druid: { shade: '#465733', main: '#697e48', light: '#c1c68b', skin: '#d2a675', skinShade: '#97704b', cloth: '#3c5734', clothLight: '#83964c', trim: '#c9be78' },
  necromancer: { shade: '#353442', main: '#575569', light: '#a5a4ad', skin: '#c5c9b2', skinShade: '#8d968a', cloth: '#2c303b', clothLight: '#68657b', trim: '#88b19b', eye: '#62bc97' },
  rogue: { shade: '#34374b', main: '#555871', light: '#a0a8b1', cloth: '#303d50', clothLight: '#5e7186', trim: '#b499b5' },
  ranger: { shade: '#4c5436', main: '#7d8150', light: '#bac39a', cloth: '#49573b', clothLight: '#839267', trim: '#c3ad75' },
  mage: { shade: '#422b34', main: '#86434c', light: '#c57768', cloth: '#553237', clothLight: '#ad5550', trim: '#ffba6c' },
  rat: { shade: '#51483c', main: '#8e8270', light: '#b4a694', skin: '#bb8879', skinShade: '#81595a' },
  wolf: { shade: '#47524d', main: '#839089', light: '#c0c8bc', skin: '#ad9280' },
  boar: { shade: '#49382e', main: '#8c6c4c', light: '#b59669', skin: '#b68a79', skinShade: '#775646', trim: '#e0d5b5' },
  slime: { shade: '#385650', main: '#719b7e', light: '#b0d7a5', eye: '#ecdd9f' },
  spider: { shade: '#3f3445', main: '#866b82', light: '#b596a6', eye: '#edb47e' },
  goblin_scout: { skin: '#a2b779', skinShade: '#657f54', main: '#6b704b', light: '#9ca46e' },
  goblin_archer: { skin: '#a2b779', skinShade: '#657f54', cloth: '#46563a', clothLight: '#80916a' },
  goblin_shaman: { skin: '#a2b779', skinShade: '#657f54', cloth: '#594a6d', clothLight: '#948094', trim: '#d7b88d' },
  thornling: { shade: '#30452f', main: '#577a47', light: '#8aaa64', cloth: '#4e4230', clothLight: '#8e7750' },
  elite_warden: { shade: '#424d3d', main: '#808a59', light: '#b5b982', cloth: '#4e4230', clothLight: '#99845c', eye: '#f4db91' },
};

export function unitPalette(id: string): UnitPalette {
  return { ...base, ...variants[id] };
}
