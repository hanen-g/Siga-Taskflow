export interface Skill {
  id: number;
  name: string;
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
