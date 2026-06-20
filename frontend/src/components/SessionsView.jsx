import React, { useState, useEffect } from 'react';
import SessionDetail from './SessionDetail';

export default function SessionsView() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        setSessions(data.sessions || []);
        setLoadingList(false);
      })
      .catch(err => console.error("Error retrieving sessions:", err));
  }, []);

  const handleSelectSession = (id) => {
    setSelectedSessionId(id);
    setLoadingDetails(true);
    fetch(`/api/sessions/${id}`)
      .then(res => res.json())
      .then(data => {
        setTimeline(data.events || []);
        setLoadingDetails(false);
      })
      .catch(err => {
        console.error("Error gathering session track:", err);
        setLoadingDetails(false);
      });
  };

  const formatDuration = (totalSeconds) => {
    if (!totalSeconds || totalSeconds <= 0) return '0s';
    const secs = Math.floor(totalSeconds);
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainingSecs}s`;
    return `${secs}s`;
  };

  const styles = {
    container: { display: 'flex', flex: 1, height: '100%', backgroundColor: '#070a13' },
    feedSidebar: { width: '340px', borderRight: '1px solid #1e2640', backgroundColor: '#0f1322', display: 'flex', flexDirection: 'column' },
    sidebarTitleBlock: { padding: '24px 20px', borderBottom: '1px solid #1e2640', fontSize: '14px', fontWeight: '700', letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' },
    scrollContainer: { flex: 1, overflowY: 'auto', padding: '16px' },
    loadingText: { padding: '20px', color: '#64748b', fontSize: '14px', textAlign: 'center' },
    emptyText: { padding: '40px 20px', color: '#64748b', fontSize: '14px', textAlign: 'center' },
    sessionCard: (isActive) => ({
      padding: '18px', marginBottom: '12px', borderRadius: '12px', cursor: 'pointer',
      border: '1px solid', borderColor: isActive ? '#38bdf8' : '#1e2640',
      backgroundColor: isActive ? '#141c33' : '#141a30', position: 'relative',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', gap: '10px',
      boxShadow: isActive ? '0 4px 20px rgba(56, 189, 248, 0.08)' : 'none'
    }),
    cardBlade: { position: 'absolute', left: 0, top: '12px', bottom: '12px', width: '4px', backgroundColor: '#38bdf8', borderRadius: '0 4px 4px 0' },
    sessionIdText: { fontSize: '13px', fontFamily: 'monospace', fontWeight: '600', color: '#f8fafc', letterSpacing: '-0.01em' },
    metaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    durationText: { fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' },
    badge: (isHighVolume) => ({
      fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600',
      color: isHighVolume ? '#fbcfe8' : '#e0f2fe', backgroundColor: isHighVolume ? 'rgba(236,72,153,0.15)' : 'rgba(56,189,248,0.12)',
      border: '1px solid', borderColor: isHighVolume ? 'rgba(236,72,153,0.25)' : 'rgba(56,189,248,0.2)'
    }),
    detailPane: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#070a13' },
    detailHeader: { padding: '22px 30px', borderBottom: '1px solid #1e2640', backgroundColor: '#0f1322' },
    detailTitle: { margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.01em' },
    detailContent: { flex: 1, overflowY: 'auto', padding: '32px 40px' }
  };

  return (
    <div style={styles.container}>
      {/* Summary Stream Sidebar */}
      <div style={styles.feedSidebar}>
        <div style={styles.sidebarTitleBlock}>Active Operational Tracks</div>
        <div style={styles.scrollContainer}>
          {loadingList ? (
            <div style={styles.loadingText}>Synchronizing pipeline clusters...</div>
          ) : sessions.length === 0 ? (
            <div style={styles.emptyText}>Zero tracking frames emitted inside database indexes.</div>
          ) : (
            sessions.map((sess) => {
              const isActive = selectedSessionId === sess.session_id;
              return (
                <div
                  key={sess.session_id}
                  onClick={() => handleSelectSession(sess.session_id)}
                  style={styles.sessionCard(isActive)}
                >
                  {isActive && <div style={styles.cardBlade} />}
                  <div style={styles.sessionIdText}>usr_frame_{sess.session_id.substring(0, 12)}</div>
                  <div style={styles.metaRow}>
                    <span style={styles.durationText}>⏱️ {formatDuration(sess.duration_secs)}</span>
                    <span style={styles.badge(sess.event_count > 40)}>{sess.event_count} Events</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Target Content Visualization Workspace */}
      <div style={styles.detailPane}>
        <div style={styles.detailHeader}>
          <h2 style={styles.detailTitle}>
            {selectedSessionId ? `Session Inspector Node — ${selectedSessionId.substring(0, 16)}` : "Inspector Matrix Output"}
          </h2>
        </div>
        <div style={styles.detailContent}>
          <SessionDetail
            selectedSessionId={selectedSessionId}
            timeline={timeline}
            loadingDetails={loadingDetails}
          />
        </div>
      </div>
    </div>
  );
}