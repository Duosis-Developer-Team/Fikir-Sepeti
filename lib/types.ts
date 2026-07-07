export type BasketType = "etkinlik" | "hackathon";
export type ResolveMethod = "vote" | "raffle";
export type BasketStatus = "active" | "resolved";

// etkinlik:  'ideas' -> 'resolved'
// hackathon: 'lobby' -> 'idea' -> 'team' -> 'demo' -> 'feedback' -> 'production' -> 'done'
export type Phase =
  // etkinlik
  | "ideas"
  | "resolved"
  // hackathon (modüler pipeline)
  | "lobby"
  | "idea"
  | "team"
  | "demo"
  | "feedback"
  | "production"
  | "done";

/** Hackathon config — kod dallanmaz, hangi modülün çalışacağını bu seçer. */
export type HackathonConfig = {
  ideaSource?: "static" | "pool";
  poolSelect?: "vote" | "random";
  teamMode?: "solo" | "groups" | "one";
  groups?: {
    count: number;
    size: number;
    assignment: "random" | "manual";
  };
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
  current_demo_idx: number;
  created_by: string | null;
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
};

export type Team = {
  id: string;
  basket_id: string;
  name: string;
  created_at: string;
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

export type VoteRow = {
  id: string;
  idea_id: string;
  basket_id: string;
  phase: Phase;
  voter: string;
  created_at: string;
};
