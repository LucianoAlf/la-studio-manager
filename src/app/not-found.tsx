import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Página não encontrada</h2>
      <p className="text-slate-400">A página que você procura não existe.</p>
      <Link
        href="/"
        className="rounded-lg bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
