import { Header } from "@/components/layout/header";

export default function CalendarioPage() {
  return (
    <>
      <Header title="Calendário" subtitle="Super Calendar" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-h2 font-bold text-neutral-50">Calendário</h2>
          <p className="mt-2 text-body text-neutral-400">
            Calendário editorial com eventos, entregas e tarefas.
          </p>
          <p className="mt-4 text-small text-neutral-500">Em desenvolvimento...</p>
        </div>
      </div>
    </>
  );
}
