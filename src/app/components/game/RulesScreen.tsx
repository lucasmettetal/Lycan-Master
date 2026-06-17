import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useGame } from "../../context/GameContext";

// ── Données détaillées des rôles ─────────────────────────────────────────────

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
};

const ROLE_DETAILS: RoleDetail[] = [
  // ── Loups ─────────────────────────────────────────────────────────────────
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
      "Les Loups-Garous se réveillent ensemble chaque nuit. Ils se reconnaissent, débattent en silence et pointent du doigt leur victime. Pendant la journée, ils se fondent parmi les villageois pour éviter d'être accusés et votés. Leur objectif : éliminer tous les villageois (ou être en nombre égal).",
    gmTips:
      "Invitez les Loups à ouvrir les yeux ensemble, à désigner une victime d'un commun accord, puis à se rendormir avant l'annonce du matin. Pour les groupes bruyants, insistez sur le silence absolu.",
    minPlayers: 5,
  },
  // ── Village ───────────────────────────────────────────────────────────────
  {
    id: "villager",
    name: "Villageois",
    category: "village",
    team: "Village",
    emoji: "👨‍🌾",
    accentColor: "#22c55e",
    actionMoment: "Jamais (phases de jour uniquement)",
    shortDesc: "Aucun pouvoir. Doit convaincre et déduire.",
    fullDesc:
      "Le Villageois ordinaire n'a aucun pouvoir nocturne. Sa force réside dans l'observation, l'argumentation et la persuasion pendant les phases de jour. Il doit analyser les comportements, relever les incohérences et convaincre les autres de voter correctement. Ne sous-estimez pas ce rôle : un bon Villageois peut retourner une partie.",
    gmTips:
      "Encouragez les Villageois à prendre la parole. C'est souvent la quantité de Villageois qui décide de l'issue. Rappelez qu'un vote raté élimine un innocent et renforce les Loups.",
    minPlayers: 4,
  },
  {
    id: "captain",
    name: "Capitaine",
    category: "village",
    team: "Village (élu)",
    emoji: "⚔️",
    accentColor: "#c9a030",
    actionMoment: "Vote (voix double) + à sa mort",
    shortDesc: "Son vote compte double. Il désigne son successeur.",
    fullDesc:
      "Le Capitaine est élu par vote le premier jour. Son vote vaut deux voix lors des délibérations. S'il meurt, il désigne son successeur avant de tomber — ce qui peut être une information précieuse ou une stratégie pour les Loups qui l'auraient infiltré.",
    gmTips:
      "Organisez l'élection du Capitaine après l'annonce de la première mort. Précisez que le Capitaine peut être un Loup — sa désignation d'un successeur doit être prise au sérieux mais pas aveuglément.",
    minPlayers: 6,
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
      "La Petite Fille peut entrouvrir furtivement les yeux lorsque les Loups désignent leur victime. Si elle identifie un Loup, elle possède une information capitale. Mais si un Loup la surprend à espionner, le MJ peut la déclarer morte immédiatement (selon la règle choisie).",
    gmTips:
      "Précisez en début de partie si la règle du 'regard surpris = mort immédiate' s'applique. Demandez aux Loups de rester vigilants. C'est un rôle à fort potentiel mais à risque élevé.",
    minPlayers: 7,
  },
  // ── Spéciaux ──────────────────────────────────────────────────────────────
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
      "La Voyante se réveille seule chaque nuit et désigne discrètement un joueur au MJ. Celui-ci lui montre silencieusement son rôle (pouce levé = innocent, pouce baissé = Loup, ou carte). Elle accumule des informations précieuses mais doit les utiliser avec prudence : se révéler trop tôt en fait une cible prioritaire pour les Loups.",
    gmTips:
      "Convenez d'un code discret avec la Voyante (signe de tête, cartes retournées sous la table). Veillez à ne pas trahir sa réaction par inadvertance. Elle peut bluffer sur ce qu'elle a vu.",
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
      "La Sorcière se réveille après les Loups. Le MJ lui révèle qui a été attaqué. Elle peut utiliser sa potion de vie pour sauver cette victime, ou sa potion de mort pour tuer n'importe quel joueur vivant (y compris la victime des Loups, ce qui cumule). Chaque potion n'est disponible qu'une seule fois dans toute la partie.",
    gmTips:
      "Montrez à la Sorcière le joueur attaqué (pointez-le discretement ou montrez sa carte). Proposez-lui les deux options en silence via des signes convenus. La potion de mort utilisée sur un Villageois peut retourner la partie contre le Village.",
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
    shortDesc: "En mourant (quelle qu'en soit la cause), entraîne un joueur de son choix dans la mort.",
    fullDesc:
      "Le Chasseur n'a aucun pouvoir nocturne. Mais dès qu'il meurt — que ce soit par vote, par attaque des Loups, par potion de mort ou par chagrin d'amour — il tire immédiatement une dernière flèche. Il désigne n'importe quel joueur vivant, qui meurt sur-le-champ. Sa cible peut elle-même déclencher des effets en chaîne (amoureux, autre Chasseur).",
    gmTips:
      "Annoncez la mort du Chasseur, puis demandez-lui immédiatement qui il abat. Ne laissez pas de délai de réflexion excessif. Gérez les morts en cascade avant de passer à la suite.",
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
    shortDesc: "La première nuit, unit deux joueurs. S'ils ne sont pas du même camp, leur victoire est commune.",
    fullDesc:
      "La première nuit seulement, Cupidon désigne deux joueurs qui tombent amoureux. Ces amoureux se réveillent ensuite brièvement pour se reconnaître. Si l'un meurt, l'autre meurt de chagrin immédiatement. Si les deux amoureux sont de camps opposés (ex : un Loup et un Villageois), ils forment un troisième camp et doivent survivre tous les deux pour gagner ensemble — même contre leur propre équipe.",
    gmTips:
      "Après que Cupidon a choisi, réveillez brièvement les deux amoureux pour qu'ils se reconnaissent (en silence, yeux ouverts). Insistez sur la règle : si l'un meurt, l'autre meurt aussi. Le couple mixte Loup/Village est un scénario épique à gérer avec attention.",
    minPlayers: 7,
  },
];

// ── Composant principal ────────────────────────────────────────────────────────

type CategoryId = "wolves" | "village" | "special";

const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: "wolves", label: "Loups", emoji: "🐺" },
  { id: "village", label: "Village", emoji: "🏡" },
  { id: "special", label: "Spéciaux", emoji: "✨" },
];

function RoleCard({ role }: { role: RoleDetail }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "#16141f",
        border: `1px solid ${expanded ? role.accentColor + "55" : "rgba(201,160,48,0.12)"}`,
        boxShadow: expanded ? `0 0 20px ${role.accentColor}15` : "none",
      }}
    >
      {/* En-tête cliquable */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left transition-all active:scale-[0.99]"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: role.accentColor + "18", border: `1px solid ${role.accentColor}35` }}
        >
          {role.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>
              {role.name}
            </p>
            <span
              className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: role.accentColor + "20", color: role.accentColor, border: `1px solid ${role.accentColor}35` }}
            >
              {role.team}
            </span>
          </div>
          <p className="text-[11px] text-[#9490a0] leading-snug" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            {role.shortDesc}
          </p>
        </div>

        <div className="flex-shrink-0 text-[#9490a0]">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Contenu étendu */}
      {expanded && (
        <div className="px-4 pb-5 flex flex-col gap-4 border-t" style={{ borderColor: "rgba(201,160,48,0.08)" }}>
          {/* Moment d'action */}
          <div className="pt-3 flex items-center gap-2">
            <span className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest">Action :</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono"
              style={{ background: role.accentColor + "15", color: role.accentColor }}
            >
              {role.actionMoment}
            </span>
          </div>

          {/* Description complète */}
          <div>
            <p className="text-[9px] text-[#9490a0] font-mono uppercase tracking-widest mb-1.5">Description</p>
            <p className="text-sm text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              {role.fullDesc}
            </p>
          </div>

          {/* Conseils MJ */}
          <div
            className="p-3 rounded-xl"
            style={{ background: "rgba(201,160,48,0.05)", border: "1px solid rgba(201,160,48,0.14)" }}
          >
            <p className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest mb-1.5">💡 Conseils MJ</p>
            <p className="text-[12px] text-[#c8c0b0]/85 leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif", fontStyle: "italic" }}>
              {role.gmTips}
            </p>
          </div>

          {role.minPlayers && (
            <p className="text-[10px] text-[#9490a0] font-mono">
              Recommandé à partir de <span style={{ color: role.accentColor }}>{role.minPlayers} joueurs</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RulesScreen() {
  const { navigate } = useGame();
  const [activeCategory, setActiveCategory] = useState<CategoryId>("special");

  const filtered = ROLE_DETAILS.filter((r) => r.category === activeCategory);

  return (
    <div
      className="min-h-full pb-8"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #16101f 0%, #0b0a0f 70%)" }}
    >
      {/* En-tête */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("home")}
            className="w-8 h-8 rounded-full border border-[#c9a030]/30 flex items-center justify-center text-[#c9a030] transition-all active:scale-90 flex-shrink-0"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[#e8ddd0]" style={{ fontFamily: "Cinzel, serif" }}>
              Règles & rôles
            </h2>
            <p className="text-[10px] text-[#9490a0] font-mono">{ROLE_DETAILS.length} rôles disponibles</p>
          </div>
        </div>

        {/* Encart résumé du jeu */}
        <div
          className="p-4 rounded-xl mb-5"
          style={{ background: "rgba(201,160,48,0.05)", border: "1px solid rgba(201,160,48,0.15)" }}
        >
          <p className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest mb-2">En bref</p>
          <p className="text-sm text-[#c8c0b0] leading-relaxed" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            Les <span style={{ color: "#ef4444" }}>Loups-Garous</span> éliminent les Villageois chaque nuit. Le{" "}
            <span style={{ color: "#22c55e" }}>Village</span> tente de les identifier et de les éliminer par vote pendant le jour. La partie se termine quand un camp ne peut plus gagner.
          </p>
        </div>

        {/* Tabs catégories */}
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex-1 py-2 rounded-xl text-[11px] font-medium transition-all border"
              style={{
                fontFamily: "Cinzel, serif",
                background: activeCategory === cat.id ? "rgba(139,28,28,0.28)" : "transparent",
                borderColor: activeCategory === cat.id ? "rgba(139,28,28,0.75)" : "rgba(201,160,48,0.2)",
                color: activeCategory === cat.id ? "#f0e8d0" : "#9490a0",
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
          <p className="text-center text-[#9490a0] text-sm py-8 font-mono">Aucun rôle dans cette catégorie</p>
        ) : (
          filtered.map((role) => <RoleCard key={role.id} role={role} />)
        )}
      </div>

      {/* Ordre du tour */}
      <div className="px-5 mt-6">
        <div className="p-4 rounded-xl" style={{ background: "#16141f", border: "1px solid rgba(201,160,48,0.12)" }}>
          <p className="text-[9px] text-[#c9a030] font-mono uppercase tracking-widest mb-3">Ordre du tour (nuit)</p>
          <div className="flex flex-col gap-2">
            {[
              { n: 1, label: "Cupidon (Nuit 1 uniquement)", emoji: "💘" },
              { n: 2, label: "Voyante", emoji: "🔮" },
              { n: 3, label: "Loups-Garous", emoji: "🐺" },
              { n: 4, label: "Sorcière", emoji: "⚗️" },
            ].map((step) => (
              <div key={step.n} className="flex items-center gap-2.5">
                <div
                  className="w-5 h-5 rounded-full border border-[#c9a030]/30 flex items-center justify-center flex-shrink-0"
                >
                  <span className="text-[8px] text-[#c9a030] font-mono">{step.n}</span>
                </div>
                <span className="text-sm">{step.emoji}</span>
                <p className="text-xs text-[#c8c0b0]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
