interface SubtabsProps {
  tabs: string[]
  active: string
  onChange: (tab: string) => void
}

export function Subtabs({ tabs, active, onChange }: SubtabsProps) {
  return (
    <div className="subtabs">
      {tabs.map(tab => (
        <button
          key={tab}
          className={`subtab${active === tab ? ' active' : ''}`}
          onClick={() => onChange(tab)}
          type="button"
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
