/**
 * AppIcon — thin wrapper around lucide-react.
 * Uses a single size (default 20) and stroke-width (1.75) for
 * consistency across the entire app.
 *
 * Usage:
 *   <AppIcon name="Landmark" size={24} />
 */

import {
  // Industries
  Landmark,      // Banking, Financial Services
  TrendingUp,    // Cap Markets, Financial Outlook
  ShieldCheck,   // Insurance, Risk Services
  Briefcase,     // AM/PE
  ShoppingBag,   // Consumer & Retail
  FlaskConical,  // Life Sciences
  Factory,       // Industrial Manufacturing
  Zap,           // ENRC
  Radio,         // TMT
  HeartPulse,    // Healthcare
  Building2,     // SLED, Corporate Services
  Flag,          // Federal
  HardHat,       // Infrastructure
  Globe,         // Standard Chartered / global

  // Process Areas
  Headphones,    // Customer Service & Ops
  Settings,      // Technology Solutions

  // Agents / Use Cases
  UserSearch,    // Proscreener
  Database,      // NL Data Querying
  ClipboardList, // Bank Complaint Automation
  LayoutTemplate,// Archi-Made-Easy
  FileText,      // Resume Creator
  Scale,         // TOM Asset Comparisons
  BarChart2,     // Power BI
  Search,        // Augmented Insights
  CalendarCheck, // KPMG Agenda Creator
  Users,         // Advisor Intelligence, Implementations
  TestTube2,     // SynthDataForge
  LayoutDashboard,// Pro-Manager

  // Reference Implementations
  LineChart,     // Capital Group

  // Navigation / UI
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  GitBranch,     // Lines of Business hero tag
  GitMerge,      // Horizontal LOB

  // Stats Icons
  Bot,
  Layers,
  
  // UI Extras
  Clock,
  MousePointer2,
  Grid,
  LayoutGrid,
  Tag,
  X,
  SlidersHorizontal,

  // Detail Page
  MessageSquareText,
  Award,
  Mail,
  ExternalLink,
} from 'lucide-react';

const ICON_MAP = {
  // Industries / LOBs
  Landmark,
  TrendingUp,
  ShieldCheck,
  Briefcase,
  ShoppingBag,
  FlaskConical,
  Factory,
  Zap,
  Radio,
  HeartPulse,
  Building2,
  Flag,
  HardHat,
  Globe,

  // Process Areas
  Headphones,
  Settings,

  // Agents
  UserSearch,
  Database,
  ClipboardList,
  LayoutTemplate,
  FileText,
  Scale,
  BarChart2,
  Search,
  CalendarCheck,
  Users,
  TestTube2,
  LayoutDashboard,

  // Reference Implementations
  LineChart,

  // Nav / UI
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  GitBranch,
  GitMerge,
  X,
  SlidersHorizontal,
  
  // Stats
  Bot,
  Layers,
  
  // UI
  Clock,
  MousePointer2,
  Grid,
  LayoutGrid,
  Tag,

  // Detail Page
  MessageSquareText,
  Award,
  Mail,
  ExternalLink,
};

/**
 * @param {{ name: string, size?: number, strokeWidth?: number, className?: string, style?: object }} props
 */
const AppIcon = ({ name, size = 20, strokeWidth = 1.75, className = '', style }) => {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} style={style} />;
};

export default AppIcon;
export { ICON_MAP };
