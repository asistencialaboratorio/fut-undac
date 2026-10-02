import {
  Award,
  BookOpen,
  CalendarClock,
  CircleCheck,
  ClipboardPen,
  FileCheck,
  FileText,
  GraduationCap,
  IdCard,
  Mail,
  PencilLine,
  Settings2,
  Building2,
  ArrowRightLeft,
  Undo2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

const POR_TRAMITE: Record<string, LucideIcon> = {
  constancia_matricula: FileText,
  constancia_no_adeudar: CircleCheck,
  constancia_egresado: GraduationCap,
  traslado_interno: ArrowRightLeft,
  traslado_externo: Building2,
  convalidacion: BookOpen,
  reserva_matricula: CalendarClock,
  rectificacion_notas: PencilLine,
  carta_presentacion: Mail,
  designacion_supervisor_practicas: UserCheck,
  devolucion_documentos: Undo2,
  duplicado_carne: IdCard,
  subsanacion_actas: ClipboardPen,
  exoneracion_primeros_puestos: Award,
  otro: Settings2,
};

export function IconoTramite({ clave, size = 18, className = "" }: { clave: string; size?: number; className?: string }) {
  const Icono = POR_TRAMITE[clave] ?? FileCheck;
  return <Icono size={size} strokeWidth={1.75} className={className} aria-hidden="true" />;
}
