import { Badge } from "@/components/ui/badge";
import {
  STATUS_KEBUTUHAN_COLOR,
  STATUS_KEBUTUHAN_LABEL,
} from "@/lib/kebutuhan";
import type { KebutuhanStatus } from "@/lib/types";

/**
 * Badge status kebutuhan. Dipakai oleh role Divisi (read-only) maupun
 * Bendahara agar tampilan status selalu sama dengan nilai di database.
 */
export function KebutuhanStatusBadge({ status }: { status: KebutuhanStatus }) {
  return (
    <Badge color={STATUS_KEBUTUHAN_COLOR[status]}>
      {STATUS_KEBUTUHAN_LABEL[status]}
    </Badge>
  );
}
