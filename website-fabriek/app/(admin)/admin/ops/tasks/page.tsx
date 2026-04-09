import type { Metadata } from "next";
import { CreateTaskForm } from "@/components/sales-os/tasks/create-task-form";
import { TasksBoardClient } from "@/components/sales-os/tasks/tasks-board-client";
import { listAdminClients } from "@/lib/data/list-admin-clients";
import { listSalesTasks } from "@/lib/data/sales-tasks";

export const metadata: Metadata = {
  title: "Tasks",
};

export default async function SalesOpsTasksPage() {
  const [tasks, clients] = await Promise.all([listSalesTasks(), listAdminClients()]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <CreateTaskForm clients={clientOpts} />
      <TasksBoardClient tasks={tasks} />
    </div>
  );
}
