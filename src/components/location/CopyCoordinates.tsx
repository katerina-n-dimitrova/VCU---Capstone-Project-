import { useState } from 'react';
import { Icon } from '../common/Icon';

/**
 * Copy the coordinates to the clipboard.
 *
 * The modern clipboard API only works in a secure context, and the ESP32 serves
 * this app over plain HTTP on a local hotspot, so there is a textarea fallback
 * for exactly that case. If both fail the text is selected instead, so it can
 * still be copied by hand.
 */
export function CopyCoordinates({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setState('copied');
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        setState(ok ? 'copied' : 'failed');
      }
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 4000);
  }

  return (
    <div className="stack-sm">
      <button type="button" className="btn btn--sm" onClick={copy}>
        <Icon name={state === 'copied' ? 'check-circle' : 'copy'} size={15} />
        {state === 'copied' ? 'Coordinates copied' : label}
      </button>
      <p aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Coordinates copied to the clipboard.' : ''}
      </p>
      {state === 'failed' ? (
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          This browser would not let the app copy for you. Select the coordinates above and copy
          them manually.
        </p>
      ) : null}
    </div>
  );
}
