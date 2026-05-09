import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const QUEUE_KEY = "sila_offline_queue";

interface QueuedAction {
  id: string;
  type: "status_update";
  shipmentId: string;
  newStatus: string;
  oldStatus: string;
  timestamp: number;
}

function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueStatusUpdate(shipmentId: string, oldStatus: string, newStatus: string) {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "status_update",
    shipmentId,
    newStatus,
    oldStatus,
    timestamp: Date.now(),
  });
  saveQueue(queue);
}

export async function syncOfflineQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    if (action.type === "status_update") {
      try {
        // Record history
        await supabase.from("shipment_status_history").insert({
          shipment_id: action.shipmentId,
          old_status: action.oldStatus,
          new_status: action.newStatus,
          changed_by: "vendor",
        } as any);

        // Update shipment status
        const { error } = await supabase
          .from("shipments")
          .update({ status: action.newStatus })
          .eq("id", action.shipmentId);

        if (error) {
          remaining.push(action);
        } else {
          synced++;
        }
      } catch {
        remaining.push(action);
      }
    }
  }

  saveQueue(remaining);
  return synced;
}

export function getQueueLength(): number {
  return getQueue().length;
}

/** Set up online listener to auto-sync */
export function setupOfflineSync() {
  const handleOnline = async () => {
    const count = getQueueLength();
    if (count > 0) {
      toast.info(`جاري مزامنة ${count} عملية محفوظة...`);
      const synced = await syncOfflineQueue();
      if (synced > 0) {
        toast.success(`تمت مزامنة ${synced} عملية بنجاح`);
      }
    }
  };

  window.addEventListener("online", handleOnline);

  // Also sync on load if online and queue has items
  if (navigator.onLine && getQueueLength() > 0) {
    handleOnline();
  }

  return () => window.removeEventListener("online", handleOnline);
}
