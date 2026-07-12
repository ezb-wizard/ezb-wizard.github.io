import { useApp, type Screen } from '../store'

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'play', label: '記録', icon: '🎴' },
  { id: 'stats', label: '統計', icon: '📊' },
  { id: 'sim', label: '検証', icon: '🧪' },
  { id: 'settings', label: '設定', icon: '⚙️' },
]

export default function TabBar() {
  const { screen, setScreen } = useApp()
  return (
    <nav className="grid grid-cols-4 border-t border-felt-700 bg-felt-900 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`flex h-14 flex-col items-center justify-center gap-0.5 ${
            screen === t.id ? 'text-gold-300' : 'text-ink-3'
          }`}
          onClick={() => setScreen(t.id)}
        >
          <span className="text-lg leading-none">{t.icon}</span>
          <span className="text-[10px] font-bold">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
