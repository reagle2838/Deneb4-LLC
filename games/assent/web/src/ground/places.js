// What each polity looks like at ground level in 2071. The environment
// builder (env.js) turns these recipes into terrain, buildings, trees,
// water and landmarks. Keep them loosely grounded in the real places.

const BASE = {
  grass: { low: [0.23, 0.33, 0.14], high: [0.36, 0.38, 0.22], rock: [0.38, 0.36, 0.33] },
  jungle: { low: [0.1, 0.24, 0.08], high: [0.16, 0.3, 0.1], rock: [0.3, 0.28, 0.22] },
  dry: { low: [0.55, 0.47, 0.32], high: [0.62, 0.52, 0.36], rock: [0.5, 0.42, 0.34] },
  sand: { low: [0.78, 0.63, 0.43], high: [0.83, 0.68, 0.46], rock: [0.66, 0.5, 0.36] },
  savanna: { low: [0.55, 0.5, 0.28], high: [0.44, 0.45, 0.22], rock: [0.52, 0.42, 0.3] },
  snow: { low: [0.82, 0.85, 0.9], high: [0.92, 0.94, 0.97], rock: [0.4, 0.42, 0.45] },
  taiga: { low: [0.3, 0.33, 0.2], high: [0.42, 0.42, 0.3], rock: [0.45, 0.44, 0.42] },
  urban: { low: [0.34, 0.34, 0.33], high: [0.38, 0.37, 0.34], rock: [0.4, 0.38, 0.36] },
};

export const PLACES = {
  cascadia: { terrain: 'grass', hills: 18, mountains: 160, water: 'sea', buildings: { layout: 'grid', density: 0.55, h: [12, 110], style: 'glass' }, trees: { kind: 'conifer', count: 520 }, props: ['lanterns', 'stalls'], people: 120, haze: 0.9 },
  sunbelt: { terrain: 'dry', hills: 4, mountains: 0, water: null, buildings: { layout: 'grid', density: 0.5, h: [6, 140], style: 'glass' }, trees: { kind: 'broadleaf', count: 160 }, props: ['lanterns', 'turbines'], people: 130, haze: 1.3 },
  atlantic: { terrain: 'urban', hills: 3, mountains: 0, water: 'sea', buildings: { layout: 'grid', density: 0.85, h: [30, 260], style: 'mixed' }, trees: { kind: 'broadleaf', count: 90 }, props: ['lanterns', 'stalls'], people: 190, haze: 1.1 },
  andean: { terrain: 'dry', hills: 30, mountains: 380, water: null, buildings: { layout: 'scatter', density: 0.45, h: [4, 12], style: 'adobe' }, trees: { kind: 'broadleaf', count: 110 }, props: ['terraces', 'stalls'], people: 110, haze: 0.6 },
  amazonia: { terrain: 'jungle', hills: 8, mountains: 0, water: 'river', buildings: { layout: 'scatter', density: 0.18, h: [4, 7], style: 'wood', roof: 'gable' }, trees: { kind: 'jungle', count: 1400 }, props: ['stilts', 'lanterns'], people: 70, haze: 1.6 },
  southcone: { terrain: 'grass', hills: 5, mountains: 0, water: 'sea', buildings: { layout: 'grid', density: 0.65, h: [10, 60], style: 'old' }, trees: { kind: 'broadleaf', count: 220 }, props: ['lanterns', 'stalls', 'spire'], people: 160, haze: 1.0 },
  nordic: { terrain: 'snow', hills: 22, mountains: 260, water: 'fjord', buildings: { layout: 'scatter', density: 0.35, h: [6, 16], style: 'wood', roof: 'gable' }, trees: { kind: 'conifer', count: 480 }, props: ['lanterns', 'turbines'], people: 80, haze: 0.5 },
  rhine: { terrain: 'grass', hills: 10, mountains: 0, water: 'river', buildings: { layout: 'grid', density: 0.75, h: [12, 30], style: 'old', roof: 'gable' }, trees: { kind: 'broadleaf', count: 200 }, props: ['spire', 'lanterns', 'stalls'], people: 150, haze: 0.9 },
  maghreb: { terrain: 'sand', hills: 12, mountains: 120, water: null, buildings: { layout: 'scatter', density: 0.5, h: [5, 14], style: 'adobe' }, trees: { kind: 'palm', count: 140 }, props: ['solar', 'stalls', 'lanterns'], people: 140, haze: 1.2 },
  sahel: { terrain: 'savanna', hills: 5, mountains: 0, water: null, buildings: { layout: 'scatter', density: 0.35, h: [3, 7], style: 'adobe' }, trees: { kind: 'baobab', count: 260 }, props: ['fields', 'stalls', 'solar'], people: 150, haze: 1.5 },
  guinea: { terrain: 'urban', hills: 4, mountains: 0, water: 'sea', buildings: { layout: 'grid', density: 0.9, h: [8, 180], style: 'mixed' }, trees: { kind: 'palm', count: 160 }, props: ['stalls', 'lanterns'], people: 230, haze: 1.6 },
  greatlakes: { terrain: 'grass', hills: 14, mountains: 90, water: null, buildings: { layout: 'grid', density: 0.55, h: [8, 90], style: 'glass' }, trees: { kind: 'acacia', count: 260 }, props: ['stalls', 'lanterns', 'solar'], people: 170, haze: 1.0 },
  levant: { terrain: 'sand', hills: 3, mountains: 0, water: 'sea', buildings: { layout: 'grid', density: 0.6, h: [30, 320], style: 'glass' }, trees: { kind: 'palm', count: 180 }, props: ['lanterns', 'solar'], people: 120, haze: 1.4 },
  indus: { terrain: 'dry', hills: 3, mountains: 0, water: 'river', buildings: { layout: 'grid', density: 0.9, h: [8, 90], style: 'mixed' }, trees: { kind: 'broadleaf', count: 180 }, props: ['temple', 'stalls', 'lanterns'], people: 240, haze: 1.8 },
  bengal: { terrain: 'jungle', hills: 1, mountains: 0, water: 'delta', buildings: { layout: 'scatter', density: 0.6, h: [5, 30], style: 'concrete' }, trees: { kind: 'palm', count: 260 }, props: ['stilts', 'stalls', 'lanterns'], people: 200, haze: 1.7 },
  siberia: { terrain: 'taiga', hills: 12, mountains: 0, water: 'river', buildings: { layout: 'scatter', density: 0.3, h: [6, 22], style: 'concrete' }, trees: { kind: 'birch', count: 620 }, props: ['lanterns', 'fields'], people: 80, haze: 0.8 },
  pacific: { terrain: 'urban', hills: 3, mountains: 0, water: 'river', buildings: { layout: 'grid', density: 0.95, h: [40, 380], style: 'glass' }, trees: { kind: 'broadleaf', count: 120 }, props: ['lanterns', 'stalls'], people: 240, haze: 1.3 },
  archipelago: { terrain: 'jungle', hills: 6, mountains: 140, water: 'sea', buildings: { layout: 'grid', density: 0.6, h: [8, 120], style: 'mixed' }, trees: { kind: 'palm', count: 340 }, props: ['seawall', 'stalls', 'lanterns'], people: 200, haze: 1.5 },
  japan: { terrain: 'urban', hills: 8, mountains: 220, water: 'river', buildings: { layout: 'grid', density: 0.85, h: [10, 160], style: 'mixed' }, trees: { kind: 'broadleaf', count: 160 }, props: ['torii', 'lanterns', 'stalls'], people: 180, haze: 0.9 },
  southcross: { terrain: 'dry', hills: 10, mountains: 0, water: 'sea', buildings: { layout: 'grid', density: 0.5, h: [8, 120], style: 'glass' }, trees: { kind: 'eucalyptus', count: 260 }, props: ['lanterns', 'solar'], people: 120, haze: 0.9 },
};

export function place(id) {
  const p = PLACES[id];
  return { ...p, palette: BASE[p.terrain], roof: p.buildings.roof ?? 'flat' };
}

// Local names, jobs and faces for the people you meet.
export const NAMES = {
  cascadia: ['Maya', 'Owen', 'Siobhan', 'Hiro', 'Kai', 'Lena', 'Noah', 'Tala'],
  sunbelt: ['Rosa', 'Jamal', 'Cody', 'Maria', 'Ty', 'Lupe', 'Dale', 'Ana'],
  atlantic: ['Ruth', 'Marcus', 'Priya', 'Eli', 'Grace', 'Dmitri', 'Jada', 'Sam'],
  andean: ['Wayra', 'Mateo', 'Killa', 'Rosa', 'Inti', 'Lucía', 'Amaru', 'Sisa'],
  amazonia: ['Raoni', 'Iara', 'Tainá', 'Kaê', 'Moacir', 'Jaci', 'Ubiratã', 'Potira'],
  southcone: ['Valentina', 'Tomás', 'Camila', 'Joaquín', 'Florencia', 'Martín', 'Sofía', 'Bruno'],
  nordic: ['Ingrid', 'Magnus', 'Sigrid', 'Aksel', 'Liv', 'Oskar', 'Frida', 'Eirik'],
  rhine: ['Lukas', 'Amélie', 'Jan', 'Mila', 'Emre', 'Klara', 'Theo', 'Zofia'],
  maghreb: ['Yasmine', 'Karim', 'Nadia', 'Omar', 'Salma', 'Idir', 'Leila', 'Anas'],
  sahel: ['Aminata', 'Moussa', 'Fatoumata', 'Ibrahim', 'Hawa', 'Seydou', 'Mariam', 'Issa'],
  guinea: ['Adaeze', 'Kwame', 'Chiamaka', 'Tunde', 'Ama', 'Kofi', 'Ngozi', 'Femi'],
  greatlakes: ['Wanjiru', 'Otieno', 'Achieng', 'Baraka', 'Njeri', 'Kiprono', 'Zawadi', 'Juma'],
  levant: ['Layla', 'Rashid', 'Noor', 'Tariq', 'Hana', 'Yousef', 'Mariam', 'Sami'],
  indus: ['Priya', 'Arjun', 'Meera', 'Rohan', 'Ananya', 'Imran', 'Kavya', 'Vikram'],
  bengal: ['Nusrat', 'Rahim', 'Tahmina', 'Arif', 'Shirin', 'Sabbir', 'Mitu', 'Rafiq'],
  siberia: ['Anya', 'Dmitri', 'Olga', 'Timur', 'Yana', 'Artyom', 'Aigul', 'Pavel'],
  pacific: ['Lin', 'Wei', 'Mei', 'Jun', 'Xiu', 'Hao', 'Yan', 'Bo'],
  archipelago: ['Putri', 'Budi', 'Sari', 'Agus', 'Dewi', 'Rizky', 'Intan', 'Wayan'],
  japan: ['Yuki', 'Haruto', 'Aoi', 'Sota', 'Hana', 'Ren', 'Emi', 'Kenji'],
  southcross: ['Mia', 'Jack', 'Aroha', 'Liam', 'Chloe', 'Tane', 'Zoe', 'Harry'],
};

export const JOBS = [
  'nurse', 'teacher', 'student', 'flood engineer', 'farmer', 'grid technician', 'street vendor',
  'retired schoolteacher', 'bus driver', 'coder', 'midwife', 'musician', 'priest', 'fisher',
  'soil scientist', 'shopkeeper', 'poet', 'courier', 'mayor\'s aide', 'grandmother of nine',
  'city planner', 'journalist', 'welder', 'chef', 'doctor', 'philosophy student', 'carpenter',
];

export const SKIN = {
  cascadia: [0.28, 0.9], sunbelt: [0.3, 0.85], atlantic: [0.2, 0.9], andean: [0.45, 0.7], amazonia: [0.45, 0.62],
  southcone: [0.5, 0.88], nordic: [0.8, 0.95], rhine: [0.6, 0.95], maghreb: [0.45, 0.75], sahel: [0.08, 0.3],
  guinea: [0.06, 0.28], greatlakes: [0.06, 0.3], levant: [0.45, 0.8], indus: [0.3, 0.62], bengal: [0.3, 0.55],
  siberia: [0.6, 0.92], pacific: [0.62, 0.85], archipelago: [0.4, 0.66], japan: [0.66, 0.88], southcross: [0.4, 0.92],
};
