export interface Skill {
  id: number;
  name: string;
  description?: string | null;
  /** Admin table: assignments referencing this skill. */
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
