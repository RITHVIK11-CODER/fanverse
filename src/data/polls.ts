
import type { Poll } from "@/types/poll";

export const polls: Poll[] = [
  {
    id: "1",
    slug: "favourite-telugu-superstar",
    title: "Who is your favourite Telugu Superstar?",
    category: "Superstar Poll",
    status: "active",
    cover: "https://placehold.co/600x400/211b36/ffffff?text=Superstar+Poll",
    totalVotes: 12500,
    endsIn: "2 days",
    options: [
      { id: "1", name: "Allu Arjun", image: "https://placehold.co/300x350/30203b/ffffff?text=Allu+Arjun", votes: 5200 },
      { id: "2", name: "Prabhas", image: "https://placehold.co/300x350/30203b/ffffff?text=Prabhas", votes: 3800 },
      { id: "3", name: "Mahesh Babu", image: "https://placehold.co/300x350/30203b/ffffff?text=Mahesh+Babu", votes: 2000 },
      { id: "4", name: "Pawan Kalyan", image: "https://placehold.co/300x350/30203b/ffffff?text=Pawan+Kalyan", votes: 1500 },
    ],
  },
  {
    id: "2",
    slug: "best-telugu-action-movie",
    title: "Which is your favourite Telugu action movie?",
    category: "Movie Poll",
    status: "active",
    cover: "https://placehold.co/600x400/211b36/ffffff?text=Movie+Poll",
    totalVotes: 8300,
    endsIn: "4 days",
    options: [
      { id: "1", name: "Salaar", image: "https://placehold.co/300x350/30203b/ffffff?text=Salaar", votes: 3500 },
      { id: "2", name: "Pushpa 2", image: "https://placehold.co/300x350/30203b/ffffff?text=Pushpa+2", votes: 2800 },
      { id: "3", name: "RRR", image: "https://placehold.co/300x350/30203b/ffffff?text=RRR", votes: 2000 },
    ],
  },
  {
    id: "3",
    slug: "best-telugu-dance-hero",
    title: "Who has the best dance moves?",
    category: "Dance Poll",
    status: "upcoming",
    cover: "https://placehold.co/600x400/211b36/ffffff?text=Dance+Poll",
    totalVotes: 0,
    endsIn: "Starts tomorrow",
    options: [
      { id: "1", name: "Allu Arjun", image: "https://placehold.co/300x350/30203b/ffffff?text=Allu+Arjun", votes: 0 },
      { id: "2", name: "Ram Charan", image: "https://placehold.co/300x350/30203b/ffffff?text=Ram+Charan", votes: 0 },
    ],
  },
];
