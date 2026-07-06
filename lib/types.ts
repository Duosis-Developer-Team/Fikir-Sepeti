export type BasketType = "social" | "build";
export type ResolveMethod = "vote" | "raffle";
export type BasketStatus = "active" | "resolved";

// sosyal:  'ideas' -> 'resolved'
// build:   'ideas' -> 'finalists' -> 'demos' -> 'voting' -> 'squad' -> 'resolved'
export type Phase =
  | "ideas"
  | "finalists"
  | "demos"
  | "voting"
  | "squad"
  | "resolved";

export type Basket = {
  id: string;
  title: string;
  type: BasketType;
  resolve_method: ResolveMethod;
  phase: Phase;
  status: BasketStatus;
  winner_idea_id: string | null;
  current_demo_idx: number;
  created_by: string | null;
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
