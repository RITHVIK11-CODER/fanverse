export type PollOption = {
  id: string;
  name: string;
  image: string;
  votes: number;
};

export type Poll = {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: "active" | "upcoming" | "ended";
  cover: string;
  totalVotes: number | null;
  endsIn?: string;
  options: PollOption[];
};