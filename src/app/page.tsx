import { TasksTable } from "@/components/tasks-table";

export default function Home() {
  return (
    <main className="min-h-screen bg-blckbx-black">
      {/* Header */}
      <header className="border-b border-blckbx-sand/10">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-2xl font-medium tracking-tight text-blckbx-sand">
            BlckBx Task Operations Dashboard
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Sand Card Container */}
        <div className="bg-blckbx-sand rounded-lg p-8 shadow-sm">
          <TasksTable />
        </div>
      </div>
    </main>
  );
}
