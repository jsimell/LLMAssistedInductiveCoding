interface ToggleSwitchProps {
  booleanState: boolean;
  setBooleanState: React.Dispatch<React.SetStateAction<boolean>>;
  onMouseDown?: () => void;
  disabled?: boolean;
}

const ToggleSwitch = ({ booleanState, setBooleanState, onMouseDown, disabled = false }: ToggleSwitchProps) => {
  return (
    <label onMouseDown={onMouseDown} className="toggle-switch relative inline-block w-11 h-5 cursor-pointer select-none">
      {/* Rail */}
      <input
        type="checkbox"
        checked={booleanState}
        onChange={(e) => setBooleanState(e.target.checked)}
        disabled={disabled}
        className="peer sr-only"
         // prevents defocusing other elements (e.g. CodeBlobs) on click
      />
      <span
        className={`
          block w-11 h-5 rounded-full border border-slate-400 
          ${booleanState ? 'bg-[#00644f] border-[#00644f]' : 'bg-black/20'} 
          transition-colors duration-300
          ${disabled ? 'opacity-50' : ''}
        `}
      />
      {/* Thumb */}
      <span
        className={`
          absolute left-0 top-0 w-5 h-5 bg-white rounded-full border border-slate-400 shadow-sm
          transform transition-transform duration-300
          ${booleanState ? 'translate-x-6 border-[#00644f]' : ''}
        `}
      />
    </label>
  )
}

export default ToggleSwitch;
