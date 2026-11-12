import { Music, Tablet, Sliders, MonitorPlay, Tv, Eye, Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme';
import { VersionBadge } from './VersionBadge';

export function TopMenuBar({ activeView, onNavigate, onGotoProjection, onGotoStage, playersCount = 0, serverVersion }) {
  const { colors: COLORS, isDark, toggleTheme } = useTheme();
  const navItems = [
    { id: 'control', label: 'Steuerung', icon: MonitorPlay },
    { id: 'editor', label: 'Song-Editor', icon: Music },
    { id: 'players', label: `Player-Verwaltung${playersCount > 0 ? ` (${playersCount})` : ''}`, icon: Tablet },
    { id: 'options', label: 'Einstellungen', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors" style={{ background: COLORS.panelBg + 'ee', borderColor: COLORS.line }}>
      <div className="max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8 flex items-center justify-between h-14">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto py-1 min-w-0 no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="font-bold text-sm sm:text-base tracking-tight" style={{ color: COLORS.ink }}>Autolyrics</span>
            <VersionBadge serverVersion={serverVersion} style={{ background: COLORS.panelBg2, color: COLORS.inkDim }} />
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-all ${
                    isActive
                      ? 'shadow-sm font-semibold'
                      : 'hover:opacity-100 opacity-80'
                  }`}
                  style={{
                    background: isActive ? COLORS.amber : 'transparent',
                    color: isActive ? '#241a08' : COLORS.ink,
                  }}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">
                    {item.id === 'control' ? 'Steuerung' : item.id === 'editor' ? 'Editor' : item.id === 'players' ? `Player${playersCount > 0 ? ` (${playersCount})` : ''}` : 'Optionen'}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick actions for Theme Toggle, Live & Stage View */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:opacity-90 border"
            style={{
              background: COLORS.panelBg2,
              borderColor: COLORS.line,
              color: COLORS.ink,
            }}
            title={isDark ? 'Heller Modus aktivieren' : 'Dunkler Modus (Dark Mode) aktivieren'}
            aria-label={isDark ? 'Heller Modus' : 'Dunkler Modus'}
          >
            {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} style={{ color: COLORS.ink }} />}
          </button>
          <button
            onClick={onGotoProjection}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all hover:opacity-90"
            style={{ background: COLORS.ink, color: COLORS.stageText }}
            title="Projektionsansicht (/live) öffnen"
          >
            <Eye size={14} />
            <span className="hidden md:inline">Projektion</span>
          </button>
          <button
            onClick={onGotoStage}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all hover:opacity-90"
            style={{ background: COLORS.ink, color: COLORS.stageText }}
            title="Stageview-Ansicht (/stage) öffnen"
          >
            <Tv size={14} />
            <span className="hidden md:inline">Stageview</span>
          </button>
        </div>
      </div>
    </header>
  );
}
