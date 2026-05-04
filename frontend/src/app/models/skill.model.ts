export interface Skill {
  id: number;
  name: string;
  category?: string | null;
  /** ISO 8601 instant from API (admin table). */
  createdAt?: string | null;
  usageCount?: number | null;
  archived?: boolean | null;
}

export interface UserSkillMatch {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  matchedCount: number;
  requiredCount: number;
  fullMatch: boolean;
  matchedSkills: Skill[];
}

export interface ProjectSkillMatchResult {
  requiredSkills: Skill[];
  matches: UserSkillMatch[];
}
