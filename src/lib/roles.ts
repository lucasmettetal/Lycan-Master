// ── Modèle de rôle extensible ─────────────────────────────────────────────────────
//
// team     : camp pour les conditions de victoire ("village" | "wolves" | "solo")
// category : groupement UI pour l'écran de sélection des rôles
//
// automationLevel :
//   "full"     = le joueur agit directement dans l'app (délégation possible)
//   "assisted" = le MJ enregistre ce qui s'est passé IRL (ex: vote des loups)
//   "manual"   = le MJ gère entièrement, l'app affiche seulement une consigne
//   "disabled" = mécanique non implémentée, rôle visible mais non sélectionnable
//
// TODO capitaine vote double : automationLevel "manual" → "assisted" quand implémenté

export interface RoleData {
  id: string;
  name: string;
  category: "wolves" | "village" | "special";
  emoji: string;
  description: string;
  defaultCount: number;
  instructions: Record<string, string>;

  // ── Métadonnées d'implémentation ──
  implemented: boolean;         // logique présente dans l'app
  playable: boolean;            // sélectionnable pour une partie
  team: "village" | "wolves" | "solo"; // camp pour les conditions de victoire
  automationLevel: "full" | "assisted" | "manual" | "disabled";
  phase: "setup" | "night" | "day" | "vote" | "death" | "passive";
  timing: string;               // résumé lisible de quand le rôle agit
  needsPlayerAction: boolean;   // le joueur peut agir via l'app (délégation)
  needsGMAction: boolean;       // le MJ doit intervenir dans l'app
  rulesVariantNotes: string;    // variantes connues des règles officielles
}

export const ROLES: RoleData[] = [
  {
    id: "werewolf",
    name: "Loup-Garou",
    category: "wolves",
    emoji: "🐺",
    description: "Chaque nuit, élimine un villageois avec la meute.",
    defaultCount: 2,
    implemented: true,
    playable: true,
    team: "wolves",
    automationLevel: "assisted",
    phase: "night",
    timing: "Chaque nuit",
    needsPlayerAction: false,
    needsGMAction: true,
    rulesVariantNotes: "",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Ouvre les yeux avec la meute. Désignez une victime en silence au Maître du Jeu.",
      day: "Reste discret. Mêle-toi aux débats pour ne pas être démasqué.",
      vote: "Vote stratégiquement. Évite de te trahir. Tu peux accuser un autre joueur.",
      end: "La partie est terminée. Tu peux révéler ton identité.",
    },
  },
  {
    id: "bigbadwolf",
    name: "Grand Méchant Loup",
    category: "wolves",
    emoji: "🌑",
    description: "Dévore un villageois supplémentaire s'il n'y a eu aucune mort.",
    defaultCount: 0,
    implemented: true,
    playable: true,
    team: "wolves",
    automationLevel: "assisted",
    phase: "night",
    timing: "Nuit où aucun loup n'est mort",
    needsPlayerAction: false,
    needsGMAction: true,
    rulesVariantNotes: "Certaines variantes n'accordent la dévoration supplémentaire que si aucun loup n'est mort depuis le début.",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Ouvre les yeux avec la meute. Si aucune mort cette nuit, tu peux dévorer un joueur supplémentaire.",
      day: "Reste discret parmi les villageois.",
      vote: "Vote pour protéger la meute.",
      end: "La partie est terminée. Tu peux révéler ton identité.",
    },
  },
  {
    id: "seer",
    name: "Voyante",
    category: "special",
    emoji: "🔮",
    description: "Chaque nuit, découvre le rôle d'un joueur.",
    defaultCount: 1,
    implemented: true,
    playable: true,
    team: "village",
    automationLevel: "full",
    phase: "night",
    timing: "Chaque nuit",
    needsPlayerAction: true,
    needsGMAction: true,
    rulesVariantNotes: "",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Ouvre les yeux en silence. Désigne discrètement un joueur au Maître du Jeu — il te montrera son rôle.",
      day: "Partage tes informations avec prudence. Ne te révèle pas trop tôt.",
      vote: "Utilise tes révélations pour orienter le vote du village.",
      end: "La partie est terminée. Révèle tes découvertes.",
    },
  },
  {
    id: "witch",
    name: "Sorcière",
    category: "special",
    emoji: "⚗️",
    description: "Possède une potion de vie et une potion de mort.",
    defaultCount: 1,
    implemented: true,
    playable: true,
    team: "village",
    automationLevel: "full",
    phase: "night",
    timing: "Chaque nuit (usage unique par potion)",
    needsPlayerAction: true,
    needsGMAction: true,
    rulesVariantNotes: "Certaines règles permettent à la Sorcière de se sauver elle-même avec la potion de vie.",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Ouvre les yeux. Le MJ te montrera la victime des Loups. Utilises-tu ta potion de vie ? Ta potion de mort sur quelqu'un ?",
      day: "Participe aux débats. Tes potions sont précieuses, ne les gaspille pas.",
      vote: "Aide le village à éliminer la bonne cible.",
      end: "La partie est terminée. Révèle les potions utilisées.",
    },
  },
  {
    id: "hunter",
    name: "Chasseur",
    category: "special",
    emoji: "🏹",
    description: "En mourant, peut éliminer un joueur de son choix.",
    defaultCount: 1,
    implemented: true,
    playable: true,
    team: "village",
    automationLevel: "full",
    phase: "death",
    timing: "À la mort du Chasseur",
    needsPlayerAction: true,
    needsGMAction: false,
    rulesVariantNotes: "",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Restes endormi. Tu n'as pas d'action nocturne.",
      day: "Participe aux débats normalement.",
      vote: "Si tu meurs (vote ou nuit), tu peux emporter quelqu'un avec toi. Choisis bien.",
      end: "La partie est terminée.",
    },
  },
  {
    id: "cupid",
    name: "Cupidon",
    category: "special",
    emoji: "💘",
    description: "La première nuit, unit deux joueurs par l'amour.",
    defaultCount: 1,
    implemented: true,
    playable: true,
    team: "village",
    automationLevel: "full",
    phase: "night",
    timing: "Nuit 1 uniquement",
    needsPlayerAction: true,
    needsGMAction: true,
    rulesVariantNotes: "",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Nuit 1 uniquement : ouvre les yeux, désigne deux joueurs — ils seront liés pour toujours. Les nuits suivantes, reste endormi.",
      day: "Agis selon les intérêts de ton camp et de ton amoureux.",
      vote: "Si ton amoureux(se) meurt, tu meurs aussi. Vote pour protéger votre amour.",
      end: "La partie est terminée. Révèle le couple lié.",
    },
  },
  {
    id: "captain",
    name: "Capitaine",
    category: "special",
    emoji: "⚔️",
    description: "Son vote compte double. Désigne son successeur.",
    defaultCount: 0,
    implemented: true,
    playable: true,
    team: "village",
    automationLevel: "manual", // TODO: passer à "assisted" quand le double vote est automatisé
    phase: "setup",
    timing: "Désigné en début de partie, effet passif au vote",
    needsPlayerAction: false,
    needsGMAction: true,
    rulesVariantNotes: "Le Capitaine compte pour 2 voix lors du vote. À sa mort, il désigne son successeur. Double vote non automatisé — le MJ gère manuellement.",
    instructions: {
      waiting: "La partie n'a pas encore commencé.",
      night: "Reste endormi. Tu n'as pas d'action nocturne.",
      day: "En tant que Capitaine, ton vote comptera double lors du vote.",
      vote: "Ton vote compte double. Tu peux aussi choisir ton successeur si tu venais à mourir.",
      end: "La partie est terminée.",
    },
  },
  {
    id: "littlegirl",
    name: "Petite Fille",
    category: "village",
    emoji: "👧",
    description: "Peut espionner discrètement les Loups la nuit.",
    defaultCount: 0,
    implemented: false,
    playable: false,
    team: "village",
    automationLevel: "disabled",
    phase: "night",
    timing: "Passif nocturne (risqué)",
    needsPlayerAction: false,
    needsGMAction: false,
    rulesVariantNotes: "Si repérée par les Loups en train d'espionner, elle est éliminée à la place de la victime normale.",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Tu peux entrouvrir les yeux pendant que les Loups jouent. C'est risqué — si tu es vue, tu meurs !",
      day: "Partage discrètement tes observations si tu as espionné.",
      vote: "Aide le village grâce à tes observations nocturnes.",
      end: "La partie est terminée.",
    },
  },
  {
    id: "elder",
    name: "L'Ancien",
    category: "village",
    emoji: "🧙",
    description: "Résiste à la première attaque des Loups.",
    defaultCount: 0,
    implemented: false,
    playable: false,
    team: "village",
    automationLevel: "disabled",
    phase: "passive",
    timing: "Passif — résistance à la première attaque nocturne",
    needsPlayerAction: false,
    needsGMAction: false,
    rulesVariantNotes: "Si éliminé par le vote du village, tous les villageois perdent leurs pouvoirs spéciaux pour le reste de la partie.",
    instructions: {
      waiting: "La partie n'a pas encore commencé. Garde ton rôle secret.",
      night: "Reste endormi. Tu n'as pas d'action nocturne.",
      day: "Tu résistes à la première attaque des Loups — mais un deuxième coup te sera fatal.",
      vote: "Si tu es éliminé par vote, les villageois perdent leurs pouvoirs spéciaux !",
      end: "La partie est terminée.",
    },
  },
  {
    id: "villager",
    name: "Villageois",
    category: "village",
    emoji: "👨‍🌾",
    description: "Un simple villageois sans pouvoir particulier.",
    defaultCount: 3,
    implemented: true,
    playable: true,
    team: "village",
    automationLevel: "full",
    phase: "passive",
    timing: "—",
    needsPlayerAction: false,
    needsGMAction: false,
    rulesVariantNotes: "",
    instructions: {
      waiting: "La partie n'a pas encore commencé.",
      night: "Dors. Tu n'as aucun pouvoir nocturne.",
      day: "Débats, observe les comportements, cherche les Loups parmi vous.",
      vote: "Vote pour éliminer celui qui te semble le plus suspect.",
      end: "La partie est terminée.",
    },
  },
];

export const ROLES_MAP: Record<string, RoleData> = Object.fromEntries(ROLES.map((r) => [r.id, r]));
