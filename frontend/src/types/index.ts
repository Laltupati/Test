export interface Tag {
  id: number;
  name: string;
}

export interface ProjectCapability {
  id: number;
  project_id: number;
  capability: string;
}

export interface ProjectResource {
  id: number;
  project_id: number;
  resource_type: 'video' | 'docs' | 'github';
  url: string | null;
  embed_code: string | null;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  phase: 'Concept' | 'Dev' | 'Live';
  client_name: string | null;
  hours_saved: number;
  created_at: string;
  tags: Tag[];
  capabilities: ProjectCapability[];
  resources: ProjectResource[];
}

export interface ProjectSummary {
  id: number;
  title: string;
  description: string;
  phase: string;
  client_name: string | null;
  hours_saved: number;
  tags: Tag[];
  capabilities: ProjectCapability[];
  resources: ProjectResource[];
}

export interface User {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}
