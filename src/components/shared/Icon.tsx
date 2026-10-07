import React from 'react';
import {
  X,
  EllipsisVertical,
  Check,
  Circle,
  Search,
  Plus,
  Info,
  CircleCheck,
  CircleCheckBig,
  MapPin,
  Mail,
  Settings,
  ExternalLink,
  Trash,
  LogOut,
  CalendarDays,
  Funnel,
  Delete,
  LayoutDashboard,
  ClipboardList,
  LandPlot,
  FileText,
  HandCoins,
  Camera,
  ToyBrick,
  Users,
  User,
  Key,
  Toolbox,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  Sun,
  Barcode,
  Pencil,
  Lock,
  LockOpen,
  type LucideIcon,
} from 'lucide-react';

/**
 * Único ponto de importação da biblioteca de ícones (hoje `lucide-react`).
 * Nenhum outro arquivo deve importar de `lucide-react` diretamente — trocar a
 * biblioteca subjacente no futuro exige editar só este arquivo (o mapa `ICONS`
 * e o tipo `IconName`). O resto do app usa nomes estáveis de domínio
 * (`dashboard`, `close`, `theme-light`, …). É o equivalente a trocar o
 * *conteúdo* de uma URL, não a URL.
 */
export type IconName =
  // Navegação (navMap / Sidebar)
  | 'dashboard'
  | 'requests'
  | 'properties'
  | 'reports'
  | 'extrato'
  | 'inspections'
  | 'audit'
  | 'pleno'
  | 'clients'
  | 'users'
  | 'user'
  | 'key'
  | 'cities'
  | 'tipagem'
  | 'settings'
  | 'api-keys'
  | 'utilities'
  | 'menu'
  // Chrome / shared
  | 'theme-dark'
  | 'theme-light'
  | 'funnel'
  | 'plus'
  | 'ellipsis-vertical'
  | 'close'
  | 'check'
  | 'circle'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  // Já no mapa e reutilizados
  | 'search'
  | 'info'
  | 'map-pin'
  | 'mail'
  | 'trash'
  | 'delete'
  | 'log-out'
  | 'calendar-days'
  | 'external-link'
  | 'circle-check'
  | 'circle-check-big'
  | 'edit'
  | 'lock'
  | 'lock-open';

const ICONS: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  requests: ClipboardList,
  properties: LandPlot,
  reports: FileText,
  extrato: HandCoins,
  inspections: Camera,
  audit: ToyBrick,
  pleno: ToyBrick,
  clients: Users,
  users: Users,
  user: User,
  key: Key,
  cities: MapPin,
  tipagem: Barcode,
  settings: Settings,
  'api-keys': Key,
  utilities: Toolbox,
  menu: Menu,

  'theme-dark': Moon,
  'theme-light': Sun,
  funnel: Funnel,
  plus: Plus,
  'ellipsis-vertical': EllipsisVertical,
  close: X,
  check: Check,
  circle: Circle,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,

  search: Search,
  info: Info,
  'map-pin': MapPin,
  mail: Mail,
  trash: Trash,
  delete: Delete,
  'log-out': LogOut,
  'calendar-days': CalendarDays,
  'external-link': ExternalLink,
  'circle-check': CircleCheck,
  'circle-check-big': CircleCheckBig,
  edit: Pencil,
  lock: Lock,
  'lock-open': LockOpen,
};

/** Guarda de tipo para nomes de ícone vindos de dados dinâmicos (ex.: `b2c_service.icone` da API). */
export function isIconName(name: string): name is IconName {
  return Object.hasOwn(ICONS, name);
}

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Espessura do traço. Default segue o padrão do lucide (2). */
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  className,
  strokeWidth,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}) => {
  const LucideIconComponent = ICONS[name];
  // Um ícone com rótulo é semanticamente uma imagem; sem rótulo é decorativo.
  const hidden = ariaHidden ?? (ariaLabel ? undefined : true);
  return (
    <LucideIconComponent
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden={hidden}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    />
  );
};
