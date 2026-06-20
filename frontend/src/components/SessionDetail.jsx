import React from 'react';

export default function SessionDetail({ selectedSessionId, timeline, loadingDetails }) {
  if (loadingDetails) {
    return <div style={{ color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }}>Pulling transaction blocks...</div>;
  }

  if (!selectedSessionId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🛰️</div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>No Frame Channel Hooked</div>
        <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '300px', lineHeight: '1.5' }}>Select a target stream trace sequence from the telemetry index side-feed.</div>
      </div>
    );
  }

  const styles = {
    timelineTrack: { position: 'relative', borderLeft: '1px solid #1e2640', marginLeft: '12px', paddingLeft: '28px' },
    eventBlock: { marginBottom: '32px', position: 'relative' },
    bulletNode: (isClick) => ({
      position: 'absolute', width: '8px', height: '8px', borderRadius: '50%',
      backgroundColor: isClick ? '#f43f5e' : '#10b981', left: '-33px', top: '6px',
      border: '1px solid #070a13', boxShadow: isClick ? '0 0 10px rgba(244,63,94,0.5)' : '0 0 10px rgba(16,185,129,0.5)'
    }),
    timestampText: { fontSize: '11px', fontFamily: 'monospace', color: '#64748b', fontWeight: '600' },
    eventActionTitle: { fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginTop: '4px', letterSpacing: '-0.01em' },
    logPayloadContainer: {
      marginTop: '8px', display: 'block', padding: '10px 14px', borderRadius: '8px',
      backgroundColor: '#0f1322', border: '1px solid #1e2640', fontSize: '12px',
      fontFamily: 'monospace', color: '#94a3b8', overflowX: 'auto', whiteSpace: 'nowrap'
    },
    metricKey: { color: '#38bdf8', fontWeight: '600' },
    metricVal: { color: '#e2e8f0' }
  };

  return (
    <div style={styles.timelineTrack}>
      {timeline.map((event, idx) => {
        const timeStr = new Date(event.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
        });
        const isClick = event.event_type === 'click';

        // 🌟 FIX: Support incoming x_per properties with a safe path down to legacy x_px keys
        const percentageX = event.x_per !== undefined ? event.x_per : event.x_px;

        return (
          <div key={event._id || idx} style={styles.eventBlock}>
            <div style={styles.bulletNode(isClick)} />
            <div style={styles.timestampText}>{timeStr}</div>
            <div style={styles.eventActionTitle}>
              {isClick ? '⚡ User Core Matrix Selection Click' : '👁️ Viewport Transition Intercept'}
            </div>
            
            <div style={styles.logPayloadContainer}>
              {isClick ? (
                <>
                  <span style={styles.metricKey}>event:</span> <span style={styles.metricVal}>"click_coords"</span> | <span style={styles.metricKey}>axis_x:</span> <span style={styles.metricVal}>{percentageX !== undefined ? `${percentageX}%` : '0%'}</span> | <span style={styles.metricKey}>axis_y:</span> <span style={styles.metricVal}>{event.y_px}px</span>
                </>
              ) : (
                <>
                  <span style={styles.metricKey}>route:</span> <span style={styles.metricVal}>"{event.page_url}"</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}