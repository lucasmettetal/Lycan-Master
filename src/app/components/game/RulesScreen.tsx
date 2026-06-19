import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useGame } from "../../context/GameContext";

type RoleDetail = {
  id: string;
  name: string;
  category: "wolves" | "village" | "special";
  team: string;
  emoji: string;
  accentColor: string;
  actionMoment: string;
  shortDesc: string;
  fullDesc: string;
  gmTips: string;
  minPlayers?: number;
  isMechanic?: boolean;
};

const ROLE_DETAILS: RoleDetail[] = [
  // ── LOUPS ──────────────────────────────────────────────────────────────────
  {
    id: "werewolf",
    name: "Loup-Garou",
    category: "wolves",
    team: "Loups",
    emoji: "🐺",
    accentColor: "#ef4444",
    actionMoment: "Chaque nuit",
    shortDesc: "Se réveille avec la meute pour désigner une victime.",
    fullDesc:
      "Les Loups-Garous se réveillent ensemble chaque nuit. Ils se reconnaissent, débattent en silence et pointent leur victime. Pendant la journée, ils se fondent parmi les villageois pour éviter d'être accusés. Leur objectif : éliminer tous les villageois (ou être en nombre égal aux vivants).",
    gmTips:
      "Invitez les Loups à ouvrir les yeux ensemble, à désigner une victime d'un commun accord, puis à se rendormir avant l'annonce du matin. Insistez sur le silence absolu.",
    minPlayers: 5,
  },
  {
    id: "bigbadwolf",
    name: "Grand Méchant Loup",
    category: "wolves",
    team: "Loups",
    emoji: "🌑",
    accentColor: "#ef4444",
    actionMoment: "Après les Loups (si aucun loup n'est mort)",
    shortDesc: "Peut dévorer un 2ème joueur si aucun loup n'a été éliminé depuis le début.",
    fullDesc:
      "Le Grand Méchant Loup est un Loup-Garou de haut rang. Il se réveille avec la meute, puis — si aucun loup n'a encore été éliminé depuis le début — peut désigner une seconde victime parmi les Villageois. Ce pouvoir disparaît définitivement dès qu'un loup tombe.",
    gmTips:
      "Après la phase normale des Loups, réveillez séparément le Grand Méchant Loup et signalez-lui (doigts) si des loups sont morts. S'il agit, il désigne silencieusement une 2ème victime. Les deux morts sont annoncées ensemble le matin.",
    minPlayers: 8,
  },
  {
    id: "whitewolf",
    name: "Loup Blanc",
    category: "wolves",
    team: "Solo (Loup Blanc)",
    emoji: "🤍",
    accentColor: "#e2e8f0",
    actionMoment: "Nuits paires (après les Loups)",
    shortDesc: "Loup solitaire. Les nuits paires, peut éliminer un autre Loup.",
    fullDesc:
      "Le Loup Blanc joue avec les Loups-Garous mais poursuit un objectif solitaire : être le dernier survivant. Les nuits paires (nuit 2, 4…), après la phase de la meute, il se réveille seul et peut optionnellement tuer un autre Loup. Il doit éliminer tout le monde — Loups ET Village.",
    gmTips:
      "Le Loup Blanc connaît les autres Loups (il se réveille avec eux) mais ils ne savent pas forcément qu'il est Loup Blanc. Les nuits paires, signalez-lui discrètement que c'est son tour — il peut choisir de ne pas agir.",
    minPlayers: 9,
  },
  {
    id: "infect_pdl",
    name: "Infect Père des Loups",
    category: "wolves",
    team: "Loups",
    emoji: "🦠",
    accentColor: "#a21caf",
    actionMoment: "Une fois (à la place d'un meurtre)",
    shortDesc: "Une nuit au choix, infecte la victime des Loups au lieu de la tuer — elle devient Loup.",
    fullDesc:
      "L'Infect Père des Loups est un Loup-Garou aux pouvoirs uniques. Une seule fois, au lieu de tuer la victime choisie par la meute, il peut l'infecter : le lendemain matin, le MJ annonce qu'il ne s'est rien passé. La victime rejoint discrètement les Loups tout en gardant son rôle initial aux yeux du Village. Ce pouvoir est irréversible.",
    gmTips:
      "Quand les Loups désignent une victime et que l'Infect veut agir, il fait un signe convenu. Annoncez le matin 'La nuit a été calme'. Informez discrètement la victime de son nouveau camp en aparté.",
    minPlayers: 10,
  },
  // ── VILLAGE ────────────────────────────────────────────────────────────────
  {
    id: "villager",
    name: "Villageois",
    category: "village",
    team: "Village",
    emoji: "👨‍🌾",
    accentColor: "#22c55e",
    actionMoment: "Aucun (jour uniquement)",
    shortDesc: "Aucun pouvoir. Sa force : l'observation, l'argumentation et le vote.",
    fullDesc:
      "Le Villageois n'a aucun pouvoir nocturne. Sa force réside dans l'observation, l'argumentation et la persuasion pendant les phases de jour. Il doit analyser les comportements, relever les incohérences et convaincre les autres de voter correctement.",
    gmTips:
      "Encouragez les Villageois à prendre la parole. C'est souvent leur nombre qui décide de l'issue. Rappelez qu'un vote raté élimine un innocent et renforce les Loups.",
    minPlayers: 4,
  },
  {
    id: "littlegirl",
    name: "Petite Fille",
    category: "village",
    team: "Village",
    emoji: "👧",
    accentColor: "#f472b6",
    actionMoment: "Nuit (espionnage risqué)",
    shortDesc: "Peut entrouvrir les yeux pendant la phase des Loups.",
    fullDesc:
      "La Petite Fille peut entrouvrir furtivement les yeux lorsque les Loups désignent leur victime. Si elle identifie un Loup, elle détient une information capitale. Mais si un Loup la surprend à espionner, le MJ peut la déclarer morte immédiatement.",
    gmTips:
      "Précisez en début de partie si 'regard surpris = mort immédiate' s'applique. Demandez aux Loups de rester vigilants.",
    minPlayers: 7,
  },
  {
    id: "salvateur",
    name: "Salvateur",
    category: "village",
    team: "Village",
    emoji: "🛡️",
    accentColor: "#3b82f6",
    actionMoment: "Chaque nuit",
    shortDesc: "Protège un joueur de l'attaque des Loups. Interdit de protéger deux fois de suite la même personne.",
    fullDesc:
      "Chaque nuit, le Salvateur désigne secrètement un joueur à protéger. Si les Loups l'attaquent cette nuit, il survit. Contrainte : il ne peut pas protéger la même personne deux nuits consécutives. Il peut se protéger lui-même une nuit sur deux. Sa protection ne fonctionne pas contre la potion de mort de la Sorcière.",
    gmTips:
      "Après les Loups et la Sorcière, réveillez le Salvateur et notez sa protection. Si la victime des Loups est protégée, annoncez le matin 'La nuit a été calme'. Rappelez la règle du 'pas deux fois de suite' si besoin.",
    minPlayers: 7,
  },
  {
    id: "ancien",
    name: "Ancien",
    category: "village",
    team: "Village",
    emoji: "👴",
    accentColor: "#a3a3a3",
    actionMoment: "Passif (à sa mort)",
    shortDesc: "Survit à une 1ère attaque des Loups. Si le Village le vote, tous les pouvoirs Village sont perdus.",
    fullDesc:
      "L'Ancien dispose de deux vies. La première fois que les Loups l'attaquent, il survit. La deuxième attaque le tue. Mais si le Village l'élimine par vote ou s'il est tué par la potion de mort de la Sorcière, tous les rôles de Village à pouvoir (Voyante, Sorcière, Chasseur…) perdent définitivement leurs pouvoirs.",
    gmTips:
      "Mémorisez que l'Ancien a survécu à une attaque. Si le Village vote l'Ancien, informez discrètement les joueurs concernés de la perte de leurs pouvoirs avant de continuer.",
    minPlayers: 8,
  },
  {
    id: "chevalier",
    name: "Chevalier à l'Épée Rouillée",
    category: "village",
    team: "Village",
    emoji: "⚔️",
    accentColor: "#94a3b8",
    actionMoment: "Passif (à sa mort la nuit)",
    shortDesc: "Tué la nuit par les Loups ? Le 1er Loup à sa gauche meurt la nuit suivante.",
    fullDesc:
      "Le Chevalier n'a aucun pouvoir actif. Mais s'il est victime des Loups pendant la nuit, le premier Loup vivant assis immédiatement à sa gauche mourra la nuit suivante d'une plaie infectée. Le MJ connaît ce Loup et le retire discrètement au bon moment.",
    gmTips:
      "Quand le Chevalier meurt la nuit, notez immédiatement le joueur à sa gauche et s'il est Loup. La nuit suivante, ce Loup meurt sans autre intervention — annoncez-le avec la victime normale du matin.",
    minPlayers: 7,
  },
  {
    id: "deux_soeurs",
    name: "Deux Sœurs",
    category: "village",
    team: "Village",
    emoji: "👯",
    accentColor: "#ec4899",
    actionMoment: "Nuits paires (brève communication)",
    shortDesc: "Deux joueurs alliés qui se connaissent dès le départ et se réveillent les nuits paires.",
    fullDesc:
      "Les Deux Sœurs se reconnaissent dès la première nuit et forment une alliance solide du côté du Village. Les nuits paires (nuit 2, 4…), elles se réveillent brièvement pour communiquer en silence quelques secondes — partager des informations, coordonner leurs votes.",
    gmTips:
      "La première nuit, réveillez les Deux Sœurs ensemble pour la présentation. Les nuits paires, accordez-leur 5 à 10 secondes de communication silencieuse. Veillez à ce que personne ne les entende.",
    minPlayers: 8,
  },
  {
    id: "trois_freres",
    name: "Trois Frères",
    category: "village",
    team: "Village",
    emoji: "👨‍👨‍👦",
    accentColor: "#f59e0b",
    actionMoment: "Toutes les 3 nuits",
    shortDesc: "Trois joueurs alliés qui se reconnaissent et se réveillent ensemble toutes les 3 nuits.",
    fullDesc:
      "Les Trois Frères sont trois joueurs du camp du Village qui se reconnaissent dès la première nuit. Toutes les trois nuits (nuit 3, 6, 9…), ils se réveillent brièvement pour communiquer silencieusement. Leur coalition solide peut être décisive en fin de partie.",
    gmTips:
      "Réveillez les Trois Frères la première nuit pour les présentations. Ensuite toutes les 3 nuits seulement — 5 à 10 secondes silencieuses. Avec trois joueurs coordonnés, ils peuvent retourner la partie en fin de jeu.",
    minPlayers: 10,
  },
  {
    id: "idiot_village",
    name: "Idiot du Village",
    category: "village",
    team: "Village",
    emoji: "🃏",
    accentColor: "#facc15",
    actionMoment: "Lors de son élimination par vote",
    shortDesc: "Si le Village le vote, il survit mais perd définitivement son droit de vote.",
    fullDesc:
      "L'Idiot du Village n'a aucun pouvoir nocturne. S'il est désigné par un vote de jour, le MJ révèle son identité. Le Village a voté un Idiot ! Il survit à l'élimination mais perd définitivement son droit de vote pour toute la suite. Il peut toujours prendre la parole et influencer les débats.",
    gmTips:
      "Quand l'Idiot est voté, révélez sa carte immédiatement. Précisez qu'il survit mais ne vote plus. Marquez son état pour ne pas oublier en cours de partie.",
    minPlayers: 7,
  },
  {
    id: "bouc_emissaire",
    name: "Bouc Émissaire",
    category: "village",
    team: "Village",
    emoji: "🐐",
    accentColor: "#78716c",
    actionMoment: "En cas d'égalité de votes",
    shortDesc: "En cas d'égalité stricte lors du vote, il est automatiquement éliminé.",
    fullDesc:
      "Le Bouc Émissaire est un assurance contre les indécisions. En cas d'égalité stricte lors du vote de jour, au lieu d'un tirage au sort, c'est le Bouc Émissaire qui est sacrifié — automatiquement, quel que soit son score de votes. Il joue pour le Village mais peut se retrouver sacrifié sans y être pour grand chose.",
    gmTips:
      "Précisez en début de partie cette règle. Si égalité arrive, signalez-le discrètement au Bouc avant l'annonce. Certaines variantes lui permettent de désigner qui sera voté ensuite.",
    minPlayers: 7,
  },
  {
    id: "montreur_ours",
    name: "Montreur d'Ours",
    category: "village",
    team: "Village",
    emoji: "🐻",
    accentColor: "#92400e",
    actionMoment: "Chaque matin (passif public)",
    shortDesc: "Chaque matin, l'ours grogne si un de ses voisins directs est un Loup.",
    fullDesc:
      "Le Montreur d'Ours est accompagné d'un ours dressé. Chaque matin, avant les annonces, le MJ signale si l'ours grogne ou non. L'ours grogne si l'un des deux joueurs assis directement à gauche ou à droite du Montreur est un Loup-Garou (ou assimilé). Le placement autour de la table est donc capital.",
    gmTips:
      "Chaque matin, vérifiez les voisins immédiats du Montreur. Annoncez 'L'ours grogne' ou 'L'ours se tait' avant tout le reste. Cette information est publique — tout le Village l'entend.",
    minPlayers: 8,
  },
  {
    id: "corbeau",
    name: "Corbeau",
    category: "village",
    team: "Village",
    emoji: "🐦‍⬛",
    accentColor: "#7c3aed",
    actionMoment: "Chaque nuit (une accusation)",
    shortDesc: "Chaque nuit, pose secrètement une accusation : +2 votes contre un joueur le lendemain.",
    fullDesc:
      "Chaque nuit, le Corbeau désigne discrètement un joueur au MJ. Ce joueur reçoit 2 votes supplémentaires lors du vote du lendemain, sans que personne ne sache pourquoi. Outil de pression redoutable : bien utilisé, il oriente l'élimination vers un Loup suspecté.",
    gmTips:
      "Notez la cible du Corbeau chaque nuit. Le lendemain, lors du décompte, ajoutez 2 points à ce joueur discrètement. Inutile de révéler pourquoi — laissez le Village se demander.",
    minPlayers: 8,
  },
  {
    id: "servante_devouee",
    name: "Servante Dévouée",
    category: "village",
    team: "Village",
    emoji: "🤵‍♀️",
    accentColor: "#0ea5e9",
    actionMoment: "Une fois (lors d'une élimination par vote)",
    shortDesc: "Une seule fois, peut se substituer à un joueur voté pour mourir à sa place.",
    fullDesc:
      "La Servante Dévouée dispose d'un pouvoir de sacrifice ultime. Une seule fois, au moment où un joueur est désigné pour être éliminé par vote, elle peut se lever et déclarer qu'elle prend sa place. Elle est éliminée à sa place, et le joueur sauvé survit (son rôle est révélé à ce moment).",
    gmTips:
      "Après l'annonce de l'élimination et avant la suite, demandez silencieusement à la Servante si elle souhaite agir (signe discret). Si oui, annoncez-le publiquement, révélez le rôle du joueur sauvé et déclarez la Servante éliminée.",
    minPlayers: 8,
  },
  {
    id: "renard",
    name: "Renard",
    category: "village",
    team: "Village",
    emoji: "🦊",
    accentColor: "#fb923c",
    actionMoment: "Chaque nuit",
    shortDesc: "Flaire un groupe de 3 joueurs adjacents. S'il n'y a aucun Loup parmi eux, il perd son pouvoir.",
    fullDesc:
      "Chaque nuit, le Renard désigne un joueur. Le MJ vérifie ce joueur et ses deux voisins directs (gauche + droite). Si au moins l'un des trois est Loup (ou assimilé), le Renard garde son pouvoir. Si aucun n'est Loup, il perd définitivement son flair — mais reste en vie.",
    gmTips:
      "Hochez la tête pour 'oui, il y a un Loup dans ce groupe' ou secouez pour 'non'. Ne révélez pas lequel — c'est au Renard de déduire. Si 'non', touchez discrètement son épaule pour signaler la perte du pouvoir.",
    minPlayers: 8,
  },
  {
    id: "gitane",
    name: "Gitane",
    category: "village",
    team: "Village",
    emoji: "🌙",
    accentColor: "#d946ef",
    actionMoment: "Une fois (de jour, après une mort)",
    shortDesc: "Une fois, consulte le rôle d'un joueur déjà mort.",
    fullDesc:
      "La Gitane peut lire les cartes des défunts. Une seule fois dans la partie, pendant la phase de jour (et uniquement si des joueurs sont déjà morts), elle demande discrètement au MJ à voir le rôle d'un joueur éliminé. Cette information lui appartient.",
    gmTips:
      "La Gitane peut signaler sa demande pendant la journée (signe convenu). Montrez-lui la carte du mort demandé à voix très basse. Marquez que le pouvoir est utilisé — il n'est disponible qu'une seule fois.",
    minPlayers: 7,
  },
  {
    id: "voleur",
    name: "Voleur",
    category: "village",
    team: "Village (variable)",
    emoji: "🎴",
    accentColor: "#64748b",
    actionMoment: "Nuit 1 uniquement",
    shortDesc: "La 1ère nuit, choisit l'une de 2 cartes supplémentaires et change de rôle.",
    fullDesc:
      "Avant la partie, le MJ pose deux cartes de rôle supplémentaires face cachée. La première nuit, le Voleur regarde les deux cartes et doit obligatoirement en prendre une (abandonnant son rôle de Voleur). S'il prend un rôle de Village, il joue Village. S'il prend un Loup, il rejoint la meute. Si les deux cartes sont des Loups, il est obligé d'en prendre une.",
    gmTips:
      "Préparez 2 cartes supplémentaires avant la partie (hors Cupidon et Voleur). Réveillez le Voleur en tout premier. Il prend une carte, vous lui montrez son nouveau rôle en silence. Si c'est un Loup, réveillez-le avec la meute ensuite.",
    minPlayers: 8,
  },
  {
    id: "comedien",
    name: "Comédien",
    category: "village",
    team: "Village",
    emoji: "🎭",
    accentColor: "#a78bfa",
    actionMoment: "Chaque nuit (jusqu'à 3 pouvoirs)",
    shortDesc: "Dispose de 3 rôles Village choisis par le MJ. Peut en activer un par nuit, chacun une seule fois.",
    fullDesc:
      "Avant la partie, le MJ attribue secrètement 3 rôles de Village au Comédien (hors loups, Cupidon, Voleur). Chaque nuit, il peut activer le pouvoir de l'un de ces rôles — une seule fois chacun. Il peut jouer Voyante une nuit, Salvateur une autre, etc. Quand tous ses pouvoirs sont épuisés, il reste en jeu sans action nocturne.",
    gmTips:
      "Préparez 3 cartes Village compatibles avant la partie. Montrez-les au Comédien dès la nuit 1. Chaque nuit, il vous indique quel rôle il 'joue' et effectuez l'action en conséquence. Rayez les rôles utilisés au fur et à mesure.",
    minPlayers: 9,
  },
  {
    id: "juge_begue",
    name: "Juge Bègue",
    category: "village",
    team: "Village",
    emoji: "⚖️",
    accentColor: "#fbbf24",
    actionMoment: "Une fois (lors d'un vote)",
    shortDesc: "Une fois par partie, peut déclencher un second vote immédiatement après le premier.",
    fullDesc:
      "Le Juge Bègue peut convoquer un second vote lors d'une phase de vote diurne. Une seule fois dans la partie, il fait un signe discret au MJ pendant (ou après) un vote pour déclencher un second tour immédiat. Ce second vote suit les mêmes règles et peut éliminer un joueur différent.",
    gmTips:
      "Convenez d'un signe discret avec le Juge en début de partie (ex : toucher son oreille). S'il l'utilise, annoncez qu'un second vote est ordonné sans expliquer pourquoi.",
    minPlayers: 8,
  },
  // ── SPÉCIAUX / SOLO / MÉCANIQUES ───────────────────────────────────────────
  {
    id: "seer",
    name: "Voyante",
    category: "special",
    team: "Village",
    emoji: "🔮",
    accentColor: "#a855f7",
    actionMoment: "Chaque nuit",
    shortDesc: "Découvre secrètement le rôle d'un joueur par nuit.",
    fullDesc:
      "La Voyante se réveille seule chaque nuit et désigne discrètement un joueur au MJ. Celui-ci lui montre silencieusement son rôle (pouce levé = innocent, pouce baissé = Loup). Elle accumule des informations précieuses mais doit les utiliser avec prudence : se révéler trop tôt en fait une cible prioritaire.",
    gmTips:
      "Convenez d'un code discret avec la Voyante. Veillez à ne pas trahir sa réaction par inadvertance. Elle peut bluffer sur ce qu'elle a vu.",
    minPlayers: 6,
  },
  {
    id: "witch",
    name: "Sorcière",
    category: "special",
    team: "Village",
    emoji: "⚗️",
    accentColor: "#10b981",
    actionMoment: "Chaque nuit (potions à usage unique)",
    shortDesc: "Possède une potion de vie et une potion de mort, chacune utilisable une seule fois.",
    fullDesc:
      "La Sorcière se réveille après les Loups. Le MJ lui révèle qui a été attaqué. Elle peut utiliser sa potion de vie pour sauver cette victime, ou sa potion de mort pour tuer n'importe quel joueur vivant (y compris la victime des Loups). Chaque potion n'est disponible qu'une seule fois dans toute la partie.",
    gmTips:
      "Montrez à la Sorcière le joueur attaqué. Proposez les deux options en silence via des signes convenus. La potion de mort utilisée sur un Villageois peut retourner la partie contre le Village.",
    minPlayers: 7,
  },
  {
    id: "hunter",
    name: "Chasseur",
    category: "special",
    team: "Village",
    emoji: "🏹",
    accentColor: "#f97316",
    actionMoment: "À sa mort (immédiatement)",
    shortDesc: "En mourant, tire immédiatement sur un joueur de son choix.",
    fullDesc:
      "Le Chasseur n'a aucun pouvoir nocturne. Mais dès qu'il meurt — par vote, attaque des Loups, potion de mort ou chagrin d'amour — il tire immédiatement une dernière flèche sur n'importe quel joueur vivant, qui meurt sur-le-champ. Sa cible peut déclencher des effets en chaîne.",
    gmTips:
      "Annoncez la mort du Chasseur, puis demandez-lui immédiatement qui il abat. Gérez les morts en cascade avant de passer à la suite.",
    minPlayers: 6,
  },
  {
    id: "cupid",
    name: "Cupidon",
    category: "special",
    team: "Village (peut basculer)",
    emoji: "💘",
    accentColor: "#ec4899",
    actionMoment: "Nuit 1 uniquement",
    shortDesc: "La 1ère nuit, unit deux joueurs. S'ils ne sont pas du même camp, ils gagnent ensemble.",
    fullDesc:
      "La première nuit seulement, Cupidon désigne deux joueurs qui tombent amoureux. Ces amoureux se réveillent pour se reconnaître. Si l'un meurt, l'autre meurt de chagrin. Si les deux amoureux sont de camps opposés (ex : un Loup et un Villageois), ils forment un troisième camp et doivent survivre tous les deux pour gagner ensemble.",
    gmTips:
      "Après que Cupidon a choisi, réveillez brièvement les amoureux pour qu'ils se reconnaissent (en silence). Le couple mixte Loup/Village est un scénario épique — insistez sur la règle : si l'un meurt, l'autre aussi.",
    minPlayers: 7,
  },
  {
    id: "captain",
    name: "Capitaine",
    category: "special",
    team: "Mécanique élue",
    emoji: "🏅",
    accentColor: "#c9a030",
    actionMoment: "Vote (voix double) + à sa mort",
    shortDesc: "Élu le 1er jour. Son vote compte double et il désigne son successeur à sa mort.",
    fullDesc:
      "Le Capitaine n'est pas un rôle assigné mais une fonction élue par le Village le premier jour (généralement après la première mort). Son vote vaut deux voix lors des délibérations. À sa mort, il désigne publiquement son successeur — cette information est stratégique. N'importe quel rôle peut être élu Capitaine, y compris un Loup.",
    gmTips:
      "Organisez l'élection après la première mort. Précisez que le Capitaine peut être un Loup. Signalez toujours au groupe quand le Capitaine vote pour doubler mentalement sa voix.",
    minPlayers: 6,
    isMechanic: true,
  },
  {
    id: "ange",
    name: "Ange",
    category: "special",
    team: "Solo (Ange)",
    emoji: "😇",
    accentColor: "#fde68a",
    actionMoment: "Lors du 1er vote d'élimination",
    shortDesc: "Gagne s'il est la 1ère personne éliminée par vote. Sinon, joue comme un Villageois.",
    fullDesc:
      "L'Ange joue un pari risqué : il remporte la partie s'il est la toute première personne éliminée par vote du Village. Pour cela, il doit se rendre suspect dès le premier jour. S'il rate l'élimination au premier vote, il perd son objectif et doit continuer comme Villageois ordinaire.",
    gmTips:
      "Expliquez à l'Ange en secret qu'il doit se faire éliminer au premier vote. S'il réussit, révélez son rôle et annoncez sa victoire — la partie continue pour les autres. Si quelqu'un d'autre est voté en premier, l'Ange devient Villageois.",
    minPlayers: 7,
  },
  {
    id: "enfant_sauvage",
    name: "Enfant Sauvage",
    category: "special",
    team: "Village (peut basculer)",
    emoji: "🌿",
    accentColor: "#16a34a",
    actionMoment: "Nuit 1 (choix modèle) + passif",
    shortDesc: "Choisit un modèle la 1ère nuit. Si ce modèle meurt, il devient Loup-Garou.",
    fullDesc:
      "La première nuit, l'Enfant Sauvage choisit secrètement un modèle parmi les joueurs en vie. Il joue ensuite comme un Villageois normal. Si son modèle est éliminé à n'importe quel moment, l'Enfant Sauvage se transforme en Loup-Garou : il rejoint la meute et partage son objectif de victoire.",
    gmTips:
      "La première nuit, notez le modèle choisi. À chaque mort, vérifiez si c'est lui. Si oui, informez discrètement l'Enfant de sa transformation en aparté, puis réveillez-le désormais avec les Loups.",
    minPlayers: 8,
  },
  {
    id: "chien_loup",
    name: "Chien-Loup",
    category: "special",
    team: "Village ou Loups (son choix)",
    emoji: "🐕",
    accentColor: "#818cf8",
    actionMoment: "Nuit 1 (choix de camp)",
    shortDesc: "La 1ère nuit, choisit de rejoindre le Village ou les Loups.",
    fullDesc:
      "La première nuit, le Chien-Loup se réveille seul et choisit son camp : rejoindre le Village (il joue comme Villageois) ou rejoindre les Loups (il se réveille désormais avec la meute et partage leur objectif). Ce choix est définitif et secret.",
    gmTips:
      "Réveillez le Chien-Loup seul après Cupidon. Il indique silencieusement son camp (pouce haut = Village, pouce bas = Loups). Si Loups : intégrez-le à la meute dès la nuit suivante.",
    minPlayers: 7,
  },
  {
    id: "sectaire",
    name: "Abominable Sectaire",
    category: "special",
    team: "Village ou Loups (tirage)",
    emoji: "✝️",
    accentColor: "#64748b",
    actionMoment: "Passif (condition de victoire modifiée)",
    shortDesc: "Gagne avec son camp, mais seulement si tous les joueurs de l'autre camp sont morts.",
    fullDesc:
      "L'Abominable Sectaire appartient à un camp (Village ou Loups — tiré au sort). Il partage l'objectif de son camp, mais avec une contrainte supplémentaire : pour que son camp gagne, il faut que TOUS les joueurs du camp adverse soient morts. Il n'a aucun pouvoir actif mais rend la victoire de son camp plus difficile.",
    gmTips:
      "Décidez avant la partie si le Sectaire sera côté Loups ou Village. Informez-le en secret. La condition s'applique automatiquement — les victoires solo (Ange, Pyromane…) ne constituent pas sa victoire.",
    minPlayers: 9,
  },
  {
    id: "pyromane",
    name: "Pyromane",
    category: "special",
    team: "Solo (Pyromane)",
    emoji: "🔥",
    accentColor: "#f97316",
    actionMoment: "Chaque nuit (huile ou ignition)",
    shortDesc: "Huile des joueurs chaque nuit. Une nuit au choix, les embrase tous simultanement.",
    fullDesc:
      "Chaque nuit, le Pyromane peut soit huiler un joueur (cumulatif, il peut s'huiler lui-même), soit déclencher l'ignition. L'ignition tue instantanément TOUS les joueurs actuellement huilés. Son objectif : éliminer absolument tout le monde via l'incendie. Il ne s'allie ni aux Loups ni au Village.",
    gmTips:
      "Notez soigneusement quels joueurs ont été huilés. Si le Pyromane choisit l'ignition, déclarez la mort simultanée de tous les huilés. Vérifiez ensuite si tous les autres survivants sont morts (condition de victoire du Pyromane).",
    minPlayers: 8,
  },
  {
    id: "joueur_flute",
    name: "Joueur de Flûte",
    category: "special",
    team: "Solo (Joueur de Flûte)",
    emoji: "🎶",
    accentColor: "#67e8f9",
    actionMoment: "Chaque nuit (envoûtement)",
    shortDesc: "Envoûte 2 joueurs par nuit. Gagne quand tous les survivants sont sous son charme.",
    fullDesc:
      "Chaque nuit, le Joueur de Flûte envoûte 2 joueurs de son choix parmi les vivants. Les joueurs envoûtés se réveillent brièvement pour se reconnaître entre eux (ils savent qu'ils sont envoûtés, pas qui est le Joueur de Flûte). Au matin, si tous les vivants sont envoûtés, le Joueur de Flûte gagne immédiatement.",
    gmTips:
      "Chaque nuit, notez les nouveaux envoûtés (cumulatif). Réveillez-les brièvement pour la reconnaissance. Au matin, comptez : si tous les vivants sont envoûtés, annoncez la victoire du Joueur de Flûte avant toute autre action.",
    minPlayers: 8,
  },
];

const ROLE_IMAGES: Record<string, string> = {
  // Loups
  werewolf:        "/lycan/roles/loup-garou.png",
  bigbadwolf:      "/lycan/roles/grand-mechant-loup.png",
  whitewolf:       "/lycan/roles/loup-blanc.png",
  infect_pdl:      "/lycan/roles/infect-pere-loups.png",
  // Village
  villager:        "/lycan/roles/villageois.png",
  littlegirl:      "/lycan/roles/petite-fille.png",
  salvateur:       "/lycan/roles/salvateur.png",
  ancien:          "/lycan/roles/ancien.png",
  chevalier:       "/lycan/roles/chevalier-epee-rouillee.png",
  deux_soeurs:     "/lycan/roles/deux-soeurs.png",
  trois_freres:    "/lycan/roles/trois-freres.png",
  idiot_village:   "/lycan/roles/idiot-village.png",
  bouc_emissaire:  "/lycan/roles/bouc-emissaire.png",
  montreur_ours:   "/lycan/roles/montreur-ours.png",
  corbeau:         "/lycan/roles/corbeau.png",
  servante_devouee: "/lycan/roles/servante-devouee.png",
  renard:          "/lycan/roles/renard.png",
  gitane:          "/lycan/roles/gitane.png",
  voleur:          "/lycan/roles/voleur.png",
  comedien:        "/lycan/roles/comedien.png",
  juge_begue:      "/lycan/roles/juge-begue.png",
  // Spéciaux
  seer:            "/lycan/roles/voyante.png",
  witch:           "/lycan/roles/sorciere.png",
  hunter:          "/lycan/roles/chasseur.png",
  cupid:           "/lycan/roles/cupidon.png",
  captain:         "/lycan/roles/capitaine.png",
  ange:            "/lycan/roles/ange.png",
  enfant_sauvage:  "/lycan/roles/enfant-sauvage.png",
  chien_loup:      "/lycan/roles/chien-loup.png",
  sectaire:        "/lycan/roles/abominable-sectaire.png",
  pyromane:        "/lycan/roles/pyromane.png",
  joueur_flute:    "/lycan/roles/joueur-flute.png",
};

// ── Composant principal ────────────────────────────────────────────────────────

type CategoryId = "wolves" | "village" | "special";

const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: "wolves", label: "Loups", emoji: "🐺" },
  { id: "village", label: "Village", emoji: "🏡" },
  { id: "special", label: "Spéciaux", emoji: "✨" },
];

function RoleCard({ role }: { role: RoleDetail }) {
  const [expanded, setExpanded] = useState(false);
  const roleImg = ROLE_IMAGES[role.id] ?? null;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "rgba(11,10,15,0.65)",
        border: `1px solid ${expanded ? role.accentColor + "50" : "rgba(201,160,48,0.13)"}`,
        boxShadow: expanded ? `0 0 20px ${role.accentColor}14` : "none",
      }}
    >
      {/* En-tête cliquable */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left transition-all active:scale-[0.99]"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Image de rôle */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden relative"
          style={{ border: `1px solid ${role.accentColor}35` }}
        >
          {roleImg ? (
            <img
              src={roleImg}
              alt={role.name}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          ) : (
            <span style={{ background: role.accentColor + "18" }} className="w-full h-full flex items-center justify-center">
              {role.emoji}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
              {role.name}
            </p>
            <span
              className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: role.accentColor + "20", color: role.accentColor, border: `1px solid ${role.accentColor}35` }}
            >
              {role.isMechanic ? "⚙ Mécanique" : role.team}
            </span>
          </div>
          <p className="text-[11px] leading-snug" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>
            {role.shortDesc}
          </p>
        </div>

        <div className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Contenu étendu */}
      {expanded && (
        <div className="px-4 pb-5 flex flex-col gap-4 border-t" style={{ borderColor: "rgba(201,160,48,0.08)" }}>
          <div className="pt-3 flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Quand :</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono"
              style={{ background: role.accentColor + "15", color: role.accentColor }}
            >
              {role.actionMoment}
            </span>
          </div>

          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Description</p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
              {role.fullDesc}
            </p>
          </div>

          <div className="p-3 rounded-xl" style={{ background: "var(--gold-subtle)", border: "1px solid var(--gold-dim)" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "var(--gold)" }}>💡 Conseils MJ</p>
            <p className="text-[12px] leading-relaxed" style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-secondary)", opacity: 0.9 }}>
              {role.gmTips}
            </p>
          </div>

          {role.minPlayers && (
            <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              Recommandé à partir de <span style={{ color: role.accentColor }}>{role.minPlayers} joueurs</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const NIGHT_ORDER = [
  { emoji: "🃏", label: "Voleur", note: "Nuit 1" },
  { emoji: "💘", label: "Cupidon", note: "Nuit 1" },
  { emoji: "🐕", label: "Chien-Loup", note: "Nuit 1" },
  { emoji: "🌿", label: "Enfant Sauvage", note: "Nuit 1" },
  { emoji: "🔮", label: "Voyante", note: "Chaque nuit" },
  { emoji: "🦊", label: "Renard", note: "Chaque nuit" },
  { emoji: "🐺", label: "Loups-Garous", note: "Chaque nuit" },
  { emoji: "🌑", label: "Grand Méchant Loup", note: "Si aucun loup n'est mort" },
  { emoji: "🦠", label: "Infect Père des Loups", note: "Une fois" },
  { emoji: "🤍", label: "Loup Blanc", note: "Nuits paires" },
  { emoji: "👯", label: "Deux Sœurs", note: "Nuits paires" },
  { emoji: "👨‍👨‍👦", label: "Trois Frères", note: "Toutes les 3 nuits" },
  { emoji: "🐦‍⬛", label: "Corbeau", note: "Chaque nuit" },
  { emoji: "✝️", label: "Abominable Sectaire", note: "Si dans la partie" },
  { emoji: "🔥", label: "Pyromane", note: "Chaque nuit" },
  { emoji: "⚗️", label: "Sorcière", note: "Chaque nuit" },
  { emoji: "🛡️", label: "Salvateur", note: "Chaque nuit" },
  { emoji: "🎭", label: "Comédien", note: "Chaque nuit" },
  { emoji: "🎶", label: "Joueur de Flûte", note: "Chaque nuit" },
];

const DAY_MECHANICS = [
  { emoji: "🏅", label: "Élection du Capitaine", note: "Après la 1ère mort" },
  { emoji: "🐻", label: "L'ours du Montreur grogne", note: "Chaque matin (avant les annonces)" },
  { emoji: "😇", label: "Victoire de l'Ange", note: "S'il est le 1er éliminé par vote" },
  { emoji: "🐐", label: "Bouc Émissaire éliminé", note: "En cas d'égalité de votes" },
  { emoji: "🃏", label: "Idiot du Village révélé", note: "S'il est voté" },
  { emoji: "⚖️", label: "Second vote du Juge Bègue", note: "Une fois (lors d'un vote)" },
  { emoji: "🤵‍♀️", label: "Substitution de la Servante", note: "Une fois (après un vote)" },
  { emoji: "🏹", label: "Tir du Chasseur", note: "Immédiatement à sa mort" },
];

export function RulesScreen() {
  const { navigate, state } = useGame();
  const [activeCategory, setActiveCategory] = useState<CategoryId>("special");

  const filtered = ROLE_DETAILS.filter((r) => r.category === activeCategory);
  const totalRoles = ROLE_DETAILS.filter((r) => !r.isMechanic).length;

  return (
    <div className="relative min-h-full pb-8" style={{ background: "var(--bg-deep)" }}>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img src="/lycan/village-night.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: "linear-gradient(180deg, rgba(11,10,15,0.38) 0%, rgba(11,10,15,0) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "rgba(11,10,15,0.28)" }} />
      </div>

      <div className="relative z-10">
        {/* En-tête */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(state.playerView ? "player" : "home")}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
              style={{ border: "1px solid var(--gold-dim)", color: "var(--gold)" }}
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                Règles & rôles
              </h2>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{totalRoles} rôles · 1 mécanique</p>
            </div>
          </div>

          {/* Résumé */}
          <div className="p-4 rounded-xl mb-5" style={{ background: "rgba(11,10,15,0.65)", border: "1px solid var(--gold-subtle)" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "var(--gold)" }}>En bref</p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
              Les <span style={{ color: "#ef4444" }}>Loups-Garous</span> éliminent les Villageois chaque nuit.
              Le <span style={{ color: "#22c55e" }}>Village</span> tente de les identifier et de les voter pendant le jour.
              Certains rôles <span style={{ color: "#a855f7" }}>spéciaux</span> ou <span style={{ color: "#67e8f9" }}>solitaires</span> poursuivent des objectifs propres.
              La partie s'arrête quand un camp ne peut plus gagner.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex-1 py-2 rounded-xl text-[11px] font-medium transition-all border"
                style={{
                  fontFamily: "var(--font-title)",
                  background: activeCategory === cat.id ? "var(--red-wolf-dim)" : "rgba(11,10,15,0.45)",
                  borderColor: activeCategory === cat.id ? "rgba(139,28,28,0.75)" : "var(--gold-subtle)",
                  color: activeCategory === cat.id ? "var(--text-primary)" : "var(--text-muted)",
                  letterSpacing: "0.03em",
                }}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des rôles */}
        <div className="px-5 flex flex-col gap-3">
          {filtered.length === 0 ? (
            <p className="text-center text-sm py-8 font-mono" style={{ color: "var(--text-muted)" }}>Aucun rôle dans cette catégorie</p>
          ) : (
            filtered.map((role) => <RoleCard key={role.id} role={role} />)
          )}
        </div>

        {/* Ordre du tour — Nuit */}
        <div className="px-5 mt-6">
          <div className="p-4 rounded-xl" style={{ background: "rgba(11,10,15,0.65)", border: "1px solid var(--gold-subtle)" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--gold)" }}>🌙 Ordre de réveil (nuit)</p>
            <div className="flex flex-col gap-2">
              {NIGHT_ORDER.map((step, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ border: "1px solid var(--gold-dim)" }}
                  >
                    <span className="text-[8px] font-mono" style={{ color: "var(--gold)" }}>{i + 1}</span>
                  </div>
                  <span className="text-sm">{step.emoji}</span>
                  <p className="text-xs flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
                    {step.label}
                  </p>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {step.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mécaniques de jour */}
        <div className="px-5 mt-4">
          <div className="p-4 rounded-xl" style={{ background: "rgba(11,10,15,0.65)", border: "1px solid var(--gold-subtle)" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--gold)" }}>☀️ Mécaniques de jour</p>
            <div className="flex flex-col gap-2">
              {DAY_MECHANICS.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-sm w-5 text-center flex-shrink-0">{m.emoji}</span>
                  <p className="text-xs flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
                    {m.label}
                  </p>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {m.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
