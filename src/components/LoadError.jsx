// Shared "could not load" state for portal pages. Renders a clear message and a
// retry button so a failed data load never leaves the customer on a blank screen
// or an infinitely spinning loader.
export default function LoadError({ message, onRetry }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#F6F7EE', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F8E4E4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CC3939" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0, maxWidth: 320, lineHeight: '140%' }}>
        {message || 'Could not load your data. Please check your connection and try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ padding: '10px 22px', fontSize: 14, fontWeight: 600, color: '#FFFFFF', background: '#111111', border: '1px solid #111111', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          Try again
        </button>
      )}
    </div>
  )
}
