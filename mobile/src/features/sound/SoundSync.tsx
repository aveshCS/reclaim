import { useEffect } from 'react';
import { useSettings } from '../../state/SettingsContext';
import { sfxConfig } from '../../utils/sfx';

/** Keeps Pip's sounds in step with the Profile switch. Render once near the root. */
export function SoundSync() {
  const effects = useSettings().settings.sound.effects;
  useEffect(() => {
    sfxConfig.enabled = effects;
  }, [effects]);
  return null;
}
