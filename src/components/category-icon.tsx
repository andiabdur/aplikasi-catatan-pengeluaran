import {
  Receipt,
  Baby,
  Home,
  UtensilsCrossed,
  Car,
  PlusCircle,
  Gift,
  Coffee,
  Users,
  PiggyBank,
  HelpCircle,
  type LucideIcon
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "tagihan": Receipt,
  "anak": Baby,
  "rumah tangga": Home,
  "makan": UtensilsCrossed,
  "transport": Car,
  "tambahan": PlusCircle,
  "umma": Gift,
  "abbi": Coffee,
  "kultural": Users,
  "nabung": PiggyBank,
  "tabung": PiggyBank
};

export function getCategoryIcon(name: string): LucideIcon {
  const norm = name.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (norm.includes(key)) {
      return icon;
    }
  }
  return HelpCircle;
}
