export const CATEGORIES = ["content", "ugc", "design", "learning", "personal"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  content: "Content",
  ugc: "UGC Deal",
  design: "Design/Portfolio",
  learning: "Learning",
  personal: "Personal",
};

export const STAGES = ["outbound", "inbound", "negotiating", "booked", "passed"] as const;
export type Stage = (typeof STAGES)[number];

export const PROJECT_STATUSES = ["active", "waiting", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TYPES = ["client", "portfolio", "learning"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface Task {
  id: string;
  title: string;
  category: Category;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ''
  done: boolean;
  fromCalendar: boolean;
  fromNotion: boolean;
  pushCount: number;
  goalId: string | null;
  projectId: string | null;
  projectMilestoneId: string | null;
}

export interface Deal {
  id: string;
  brand: string;
  stage: Stage;
  date: string;
  notes: string;
  value: number;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  notes: string;
}

/** Belongs to an arbitrary project and drives that project's segmented
 * progress bar. */
export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
}

export interface ProjectResource {
  id: string;
  projectId: string;
  label: string;
  url: string;
}

export interface Sub {
  id: string;
  name: string;
  amount: number;
  renewDate: string;
}

export interface FinanceEntry {
  id: string;
  type: "in" | "out";
  amount: number;
  note: string;
  date: string;
}

export interface LogEntry {
  id: string;
  date: string;
  text: string;
  taskId: string | null;
}

export interface WeekGoal {
  id: string;
  text: string;
  weekStart: string; // YYYY-MM-DD, Sunday
  done: boolean;
  fromNotion: boolean;
}

export const NOTION_PERIODS = ["Daily", "Weekly", "Monthly", "Quarterly"] as const;
export type NotionPeriod = (typeof NOTION_PERIODS)[number];

export interface NotionGoalTask {
  id: string;
  name: string;
  date: string | null;
  period: NotionPeriod | "";
  notes: string;
  done: boolean;
  projectName: string | null;
  category: Category | null;
}

export interface NetworkingContact {
  id: string;
  name: string;
  status: string;
  platform: string;
  notes: string;
  dateContacted: string | null;
  url: string;
}

export interface AppState {
  tasks: Task[];
  deals: Deal[];
  projects: Project[];
  projectMilestones: ProjectMilestone[];
  projectResources: ProjectResource[];
  subs: Sub[];
  financeEntries: FinanceEntry[];
  pitchLog: Record<string, number>;
  log: LogEntry[];
  weekGoals: WeekGoal[];
  q3goals: string;
}
