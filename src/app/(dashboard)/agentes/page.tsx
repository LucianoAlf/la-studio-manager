import { Header } from "@/components/layout/header";

export default function AgentesPage() {
  return (
    <>
      <Header title="Agentes IA" subtitle="6 Agentes" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-h2 font-bold text-neutral-50">Agentes IA</h2>
          <p className="mt-2 text-body text-neutral-400">
            Maestro, Luna, Atlas, Nina, Theo e Ada.
          </p>
          <p className="mt-4 text-small text-neutral-500">Em desenvolvimento...</p>
        </div>
      </div>
    </>
  );
}
