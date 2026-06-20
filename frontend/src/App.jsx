import React, { useState } from 'react';
import SessionsView from './components/SessionsView';
import HeatmapView from './components/HeatmapView';

export default function App() {
  const [view, setView] = useState('portal'); // 'portal' or 'dashboard'
  const [activeTab, setActiveTab] = useState('sessions');

  // Unified theme design system matching the ultra-modern look
  const styles = {
    portalContainer: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#070a13',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
      margin: 0,
      overflow: 'hidden',
      position: 'relative'
    },
    portalGlow: {
      position: 'absolute',
      width: '500px',
      height: '300px',
      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
      top: '10%',
      pointerEvents: 'none'
    },
    portalTitle: { fontSize: '2.5rem', fontWeight: '850', marginBottom: '8px', letterSpacing: '-0.03em' },
    portalSubtitle: { color: '#94a3b8', fontSize: '1.05rem', marginBottom: '48px', maxWidth: '450px', textAlign: 'center', lineHeight: '1.5' },
    cardGrid: { display: 'flex', gap: '24px', maxWidth: '800px', width: '100%', padding: '0 20px', boxSizing: 'border-box' },
    choiceCard: {
      flex: 1,
      backgroundColor: '#0f1322',
      border: '1px solid #1e2640',
      borderRadius: '16px',
      padding: '32px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      textAlign: 'left',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'between'
    },
    cardIcon: { fontSize: '2rem', marginBottom: '16px' },
    cardHeader: { fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px', color: '#38bdf8' },
    cardDesc: { color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 24px 0', flexGrow: 1 },
    cardButton: (isPrimary) => ({
      backgroundColor: isPrimary ? '#3b82f6' : 'transparent',
      color: '#fff',
      border: isPrimary ? 'none' : '1px solid #334155',
      padding: '12px',
      borderRadius: '8px',
      fontWeight: '600',
      cursor: 'pointer',
      textAlign: 'center',
      fontSize: '0.9rem'
    }),

    // Original Dashboard Styles
    container: { display: 'flex', height: '100vh', width: '100vw', fontFamily: 'system-ui, sans-serif', backgroundColor: '#070a13', margin: 0, overflow: 'hidden' },
    sidebar: { width: '240px', backgroundColor: '#0f1322', borderRight: '1px solid #1e2640', color: '#fff', display: 'flex', flexDirection: 'column', padding: '20px 0' },
    logoZone: { padding: '0 20px 20px 20px', fontSize: '16px', fontWeight: 'bold', color: '#38bdf8', borderBottom: '1px solid #1e2640', letterSpacing: '0.5px' },
    navButton: (isActive) => ({
      width: '100%', padding: '15px 20px', border: 'none', background: isActive ? '#1e2640' : 'none',
      color: isActive ? '#38bdf8' : '#94a3b8', textAlign: 'left', fontSize: '14px', fontWeight: isActive ? '600' : '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s'
    }),
    backButton: {
      marginTop: 'auto', padding: '12px 20px', background: 'none', border: 'none', color: '#64748b', 
      textAlign: 'left', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
    },
    workspace: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff' }
  };

  // Render Gatekeeper Portal View
  if (view === 'portal') {
    return (
      <div style={styles.portalContainer}>
        <div style={styles.portalGlow}></div>
        <div style={{ display: 'inline-flex', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '6px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: '600', marginBottom: '16px' }}>
          🚀 NovaSpark Environment Control
        </div>
        <h1 style={styles.portalTitle}>Select Runtime Environment</h1>
        <p style={styles.portalSubtitle}>
          Launch the mock target framework client to generate behavior profiles or enter the administrative tracking dashboard.
        </p>

        <div style={styles.cardGrid}>
          {/* Card 1: Open Client Demo Website */}
          <div 
            style={styles.choiceCard}
            onClick={() => window.open('/demo.html', '_blank')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.boxShadow = '0 0 20px rgba(56,189,248,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e2640'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={styles.cardIcon}>🌐</div>
            <div style={styles.cardHeader}>Target Client Sandbox</div>
            <p style={styles.cardDesc}>
              Launches the multi-page client landing ecosystem in a new tab so you can click around and generate live coordinate data logs.
            </p>
            <button style={styles.cardButton(false)}>Open Sandbox Site</button>
          </div>

          {/* Card 2: Enter React Dashboard Applications */}
          <div 
            style={styles.choiceCard}
            onClick={() => setView('dashboard')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e2640'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={styles.cardIcon}>📊</div>
            <div style={styles.cardHeader}>Telemetry Control Center</div>
            <p style={styles.cardDesc}>
              Enter the main console application cluster to view interactive heatmaps, filter parameters, and view active user tracking timelines.
            </p>
            <button style={styles.cardButton(true)}>Enter Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  // Render Core Dashboard View
  return (
    <div style={styles.container}>
      {/* Main Navigation Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logoZone}>⚡ NovaSpark Console</div>
        <nav style={{ marginTop: '20px', flexGrow: 1 }}>
          <button 
            style={styles.navButton(activeTab === 'sessions')} 
            onClick={() => setActiveTab('sessions')}
          >
            ☰ Active Sessions
          </button>
          <button 
            style={styles.navButton(activeTab === 'heatmap')} 
            onClick={() => setActiveTab('heatmap')}
          >
            🗺️ Heatmap Matrix
          </button>
        </nav>

        {/* Quick escape route to jump back to the choice gatekeeper screen */}
        <button style={styles.backButton} onClick={() => setView('portal')}>
          ⬅ Exit to Environment Selection
        </button>
      </div>

      {/* Render Target Viewports */}
      <div style={styles.workspace}>
        {activeTab === 'sessions' ? <SessionsView /> : <HeatmapView />}
      </div>
    </div>
  );
}