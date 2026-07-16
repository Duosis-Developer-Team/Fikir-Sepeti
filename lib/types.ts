export type BasketType = "etkinlik" | "hackathon";
export type ResolveMethod = "vote" | "raffle";
export type BasketStatus = "active" | "resolved";

// etkinlik:  'ideas' -> 'resolved'
// hackathon: 'lobby' -> 'idea' -> 'team' -> 'hackathon' -> 'demo' -> 'feedback' -> 'production' -> 'done'
export type Phase =
  // etkinlik
  | "ideas"
  | "resolved"
  // hackathon (modüler pipeline)
  | "lobby"
  | "idea"
  | "team"
  | "hackathon"
  | "demo"
  | "feedback"
  | "production"
  | "done";

export type DurationUnit = "hour" | "day" | "week";

/** Hackathon config — kod dallanmaz, hangi modülün çalışacağını bu seçer. */
export type HackathonConfig = {
  /** static = admin girer; pool = sepet-içi brainstorm; repo = Sepet'ten */
  ideaSource?: "static" | "pool" | "repo";
  poolSelect?: "vote" | "random";
  /** Sepet fikir id — ideaSource=repo iken */
  repoPoolIdeaId?: string;
  teamMode?: "solo" | "groups" | "one";
  groups?: {
    count: number;
    size: number;
    assignment: "random" | "manual";
  };
  duration?: {
    value: number;
    unit: DurationUnit;
  };
  /** How many ideas to lock (default 1). */
  ideaCount?: number;
  /** Team↔idea: same creator team | cross raffle | manual DnD. Default same. */
  ideaAssignment?: "same" | "cross" | "manual";
  /** Show shuffle→reveal stage (default true). */
  revealAnimation?: boolean;
  /** Extra locked idea ids when ideaCount > 1 (selected_idea_id is the first). */
  lockedIdeaIds?: string[];
  /** Demo scoring: simple team vote (default) or rubric stars. */
  scoringMode?: "simple" | "rubric";
  rubric?: { key: string; label: string; weight: number; custom?: boolean }[];
  juryEnabled?: boolean;
  /** Multiplier for jury scores when juryEnabled (default 2). */
  juryWeight?: number;
  /** S11: open = auto join; approval = admin must approve. */
  lobbyPolicy?: "open" | "approval";
  /** S11: allow join after lobby phase when locked. */
  allowLateJoin?: boolean;
};

export type PoolStatus = "new" | "voting" | "promoted" | "archived" | "rejected";

export type PoolIdea = {
  id: string;
  tenant_id: string;
  text: string;
  brief: string | null;
  category: string | null;
  track_hint: "hackathon" | "etkinlik" | null;
  status: PoolStatus;
  hidden: boolean;
  created_by: string;
  vote_count: number;
  promoted_basket_id: string | null;
  source_basket_id: string | null;
  poll_closes_at: string | null;
  winner_label: string | null;
  created_at: string;
};

export type Basket = {
  id: string;
  title: string;
  type: BasketType;
  resolve_method: ResolveMethod;
  phase: Phase;
  status: BasketStatus;
  winner_idea_id: string | null;
  selected_idea_id: string | null;
  config: HackathonConfig;
  hackathon_ends_at: string | null;
  current_demo_idx: number;
  created_by: string | null;
  created_at: string;
  tenant_id: string;
  /** S8: what shipped / who — Hermes bridge later. */
  production_note?: string | null;
  /** S8: estimated person-days. */
  effort_estimate?: number | null;
  /** S11: new joins blocked when true (unless allowLateJoin). */
  lobby_locked?: boolean;
};

export type Tenant = {
  id: string;
  name: string;
  azure_tenant_id: string | null;
  email_domain: string | null;
  settings: Record<string, unknown>;
  created_at: string;
};

export type Participant = {
  id: string;
  basket_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: "admin" | "member";
  joined_at: string;
  /** S11: false when lobbyPolicy=approval and pending. */
  approved?: boolean;
};

export type Team = {
  id: string;
  basket_id: string;
  name: string;
  created_at: string;
  /** Assigned idea for this team (S6). */
  idea_id?: string | null;
  /** Team angle / angle when ideaCount === 1 (S6). */
  angle?: string | null;
};

export type TeamMember = {
  id: string;
  team_id: string;
  basket_id: string;
  user_id: string;
};

export type TeamVote = {
  id: string;
  team_id: string;
  basket_id: string;
  voter: string;
  created_at: string;
};

export type Feedback = {
  id: string;
  basket_id: string;
  team_id: string | null;
  idea_id: string | null;
  author_id: string | null;
  author_name: string | null;
  text: string;
  created_at: string;
};

export type Idea = {
  id: string;
  basket_id: string;
  text: string;
  tag: string | null;
  is_finalist: boolean;
  demo_url: string | null;
  presenter: string | null;
  live_at: string | null;
  created_by: string | null;
  vote_count: number;
  created_at: string;
};

export type SquadMember = {
  id: string;
  basket_id: string;
  member: string;
  created_at: string;
};

export type Score = {
  id: string;
  basket_id: string;
  tenant_id: string;
  team_id: string;
  voter: string;
  category_key: string;
  stars: number;
  is_jury: boolean;
  created_at: string;
};

export type VoteRow = {
  id: string;
  idea_id: string;
  basket_id: string;
  phase: Phase;
  voter: string;
  created_at: string;
};
