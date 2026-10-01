// Catalogue of every animal that can live in the tank.
// length: total length in metres (model is normalised to 1 along +Z)
// speed: [cruise, burst] in m/s, zone: preferred height band (0 = sand, 1 = surface)
// behavior: school | cruise | hover | host | lurk | flow | bottom | perch | patrol | walker
export const SPECIES = [
  {
    id: 'clownfish', name: 'Clownfisch', latin: 'Amphiprion ocellaris', water: 'salt', group: 'fish',
    length: 0.085, speed: [0.05, 0.14], zone: [0.15, 0.6], behavior: 'host', school: 0.25, agility: 3.2,
    swim: { amp: 0.09, wave: 4.2, stiff: 0.18, base: 4, k: 5 },
    desc: 'Lebt in Symbiose mit Seeanemonen – deren Nesselgift kann ihm nichts anhaben.',
  },
  {
    id: 'bluetang', name: 'Paletten-Doktorfisch', latin: 'Paracanthurus hepatus', water: 'salt', group: 'fish',
    length: 0.17, speed: [0.07, 0.2], zone: [0.3, 0.85], behavior: 'cruise', school: 0.2, agility: 2.6, maxPitch: 0.35,
    swim: { amp: 0.06, wave: 3.4, stiff: 0.1, base: 3, k: 5 },
    desc: 'Ausdauernder Schwimmer, der ständig das Becken patrouilliert. Bekannt als „Dorie“.',
  },
  {
    id: 'yellowtang', name: 'Gelber Segelflossendoktor', latin: 'Zebrasoma flavescens', water: 'salt', group: 'fish',
    length: 0.14, speed: [0.06, 0.18], zone: [0.25, 0.8], behavior: 'cruise', school: 0.35, agility: 2.8, maxPitch: 0.35,
    swim: { amp: 0.06, wave: 3.2, stiff: 0.12, base: 3, k: 5 },
    desc: 'Leuchtend gelber Algenfresser aus Hawaii, grast unermüdlich die Steine ab.',
  },
  {
    id: 'mandarin', name: 'Mandarinfisch', latin: 'Synchiropus splendidus', water: 'salt', group: 'fish',
    length: 0.065, speed: [0.015, 0.05], zone: [0.0, 0.2], behavior: 'perch', school: 0, agility: 3.5,
    swim: { amp: 0.05, wave: 4.5, stiff: 0.25, base: 6, k: 4 },
    desc: 'Einer der farbenprächtigsten Fische überhaupt – hüpft gemächlich über Steine und Sand.',
  },
  {
    id: 'moorish', name: 'Halfterfisch', latin: 'Zanclus cornutus', water: 'salt', group: 'fish',
    length: 0.17, speed: [0.06, 0.16], zone: [0.35, 0.9], behavior: 'cruise', school: 0.3, agility: 2.4, maxPitch: 0.35,
    swim: { amp: 0.05, wave: 3.0, stiff: 0.12, base: 3, k: 4 },
    desc: 'Mit seinem langen Rückenflossen-Wimpel ein elegantes Symbol der Korallenriffe.',
  },
  {
    id: 'lionfish', name: 'Rotfeuerfisch', latin: 'Pterois volitans', water: 'salt', group: 'fish',
    length: 0.2, speed: [0.015, 0.06], zone: [0.25, 0.7], behavior: 'lurk', school: 0, agility: 1.6,
    swim: { amp: 0.035, wave: 3.0, stiff: 0.15, base: 2, k: 4 },
    desc: 'Schwebt majestätisch mit gespreizten Giftstacheln – ein geduldiger Lauerjäger.',
  },
  {
    id: 'gramma', name: 'Königs-Feenbarsch', latin: 'Gramma loreto', water: 'salt', group: 'fish',
    length: 0.07, speed: [0.03, 0.1], zone: [0.1, 0.55], behavior: 'hover', school: 0.15, agility: 3.4,
    swim: { amp: 0.08, wave: 4.2, stiff: 0.2, base: 5, k: 5 },
    desc: 'Halb violett, halb gelb. Schwimmt gerne kopfüber unter Felsüberhängen.',
  },
  {
    id: 'neon', name: 'Neonsalmler', latin: 'Paracheirodon innesi', water: 'fresh', group: 'fish',
    length: 0.04, speed: [0.06, 0.16], zone: [0.25, 0.75], behavior: 'school', school: 1, agility: 4.5,
    swim: { amp: 0.12, wave: 4.8, stiff: 0.15, base: 8, k: 4 },
    desc: 'Schwarmfisch aus dem Amazonas. Sein blauer Streifen leuchtet durch Lichtreflexion.',
  },
  {
    id: 'angelfish', name: 'Skalar', latin: 'Pterophyllum scalare', water: 'fresh', group: 'fish',
    length: 0.13, speed: [0.025, 0.08], zone: [0.35, 0.85], behavior: 'hover', school: 0.4, agility: 2.2,
    swim: { amp: 0.05, wave: 3.2, stiff: 0.12, base: 3, k: 4 },
    desc: 'Der König des Amazonas-Aquariums – gleitet würdevoll zwischen Wurzeln und Pflanzen.',
  },
  {
    id: 'discus', name: 'Diskus', latin: 'Symphysodon aequifasciatus', water: 'fresh', group: 'fish',
    length: 0.15, speed: [0.025, 0.07], zone: [0.25, 0.75], behavior: 'hover', school: 0.5, agility: 2.0,
    swim: { amp: 0.04, wave: 3.0, stiff: 0.1, base: 3, k: 4 },
    desc: 'Scheibenförmiger Buntbarsch, der seine Jungen mit Hautsekret füttert.',
  },
  {
    id: 'betta', name: 'Kampffisch', latin: 'Betta splendens', water: 'fresh', group: 'fish',
    length: 0.075, speed: [0.02, 0.06], zone: [0.55, 0.95], behavior: 'flow', school: 0, agility: 2.2,
    swim: { amp: 0.13, wave: 3.6, stiff: 0.15, base: 3, k: 4 },
    desc: 'Atmet zusätzlich Luft an der Oberfläche und präsentiert seine riesigen Schleierflossen.',
  },
  {
    id: 'goldfish', name: 'Goldfisch', latin: 'Carassius auratus', water: 'fresh', group: 'fish',
    length: 0.12, speed: [0.03, 0.09], zone: [0.15, 0.85], behavior: 'flow', school: 0.25, agility: 2.2,
    swim: { amp: 0.11, wave: 3.8, stiff: 0.18, base: 3, k: 4 },
    desc: 'Der Klassiker seit über 1000 Jahren – dieser Ryukin hat einen doppelten Schleierschwanz.',
  },
  {
    id: 'corydoras', name: 'Panzerwels', latin: 'Corydoras aeneus', water: 'fresh', group: 'fish',
    length: 0.055, speed: [0.03, 0.09], zone: [0.0, 0.08], behavior: 'bottom', school: 0.7, agility: 3.5,
    swim: { amp: 0.1, wave: 4.0, stiff: 0.2, base: 5, k: 5 },
    desc: 'Gründelt mit seinen Barteln im Sand und schießt ab und zu zum Luftholen nach oben.',
  },
  {
    id: 'blacktip', name: 'Schwarzspitzen-Riffhai', latin: 'Carcharhinus melanopterus (Jungtier)', water: 'salt', group: 'shark',
    length: 0.3, speed: [0.09, 0.22], zone: [0.55, 0.85], behavior: 'patrol', school: 0, agility: 1.7, maxPitch: 0.14,
    swim: { amp: 0.11, wave: 3.4, stiff: 0.04, base: 1.5, k: 5 },
    desc: 'Kleiner Riffhai, der nie stillsteht: Er muss schwimmen, damit Wasser durch seine Kiemen strömt.',
  },
  {
    id: 'epaulette', name: 'Epaulettenhai', latin: 'Hemiscyllium ocellatum', water: 'salt', group: 'shark',
    length: 0.28, speed: [0.03, 0.1], zone: [0.0, 0.12], behavior: 'walker', school: 0, agility: 2.0, maxPitch: 0.2,
    swim: { amp: 0.14, wave: 3.8, stiff: 0.06, base: 1.2, k: 5 },
    desc: 'Kann mit seinen Flossen über den Boden „laufen“ – sogar kurz an Land zwischen Gezeitentümpeln.',
  },
  {
    id: 'bala', name: 'Bala-Hai', latin: 'Balantiocheilos melanopterus', water: 'fresh', group: 'shark',
    length: 0.16, speed: [0.08, 0.22], zone: [0.3, 0.8], behavior: 'cruise', school: 0.6, agility: 2.6, maxPitch: 0.3,
    swim: { amp: 0.07, wave: 3.4, stiff: 0.1, base: 3, k: 5 },
    desc: 'Kein echter Hai, sondern eine Barbe – sieht aber mit ihrer Rückenflosse genau so aus.',
  },
];

export const JELLY_SPECIES = {
  id: 'jelly', name: 'Leuchtqualle', latin: 'Fantasia luminosa', water: 'any', group: 'jelly',
  desc: 'Durchsichtig, schillernd und pulsierend – mit Regenbogen-Wimpernreihen wie eine Rippenqualle.',
};

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
