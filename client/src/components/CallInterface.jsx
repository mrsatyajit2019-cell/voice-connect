import React, { useState, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, SkipForward } from 'lucide-react';

const CallInterface = ({ onDisconnect, onSkip, isMuted, toggleMute }) => {
    return (
        <div className="glass-panel" style={{
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '30px',
            width: '100%',
            maxWidth: '400px'
        }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 600 }}>Connected</h2>
                <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)' }}>You are talking to a stranger</p>
            </div>

            <div className="visualizer">
                {[...Array(10)].map((_, i) => (
                    <div
                        key={i}
                        className="bar"
                        style={{
                            animationDuration: `${400 + Math.random() * 400}ms`,
                            background: 'var(--success-gradient)'
                        }}
                    />
                ))}
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <button
                    className="btn"
                    style={{ background: isMuted ? 'var(--danger-gradient)' : 'rgba(255,255,255,0.1)' }}
                    onClick={toggleMute}
                    title="Mute/Unmute"
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                    className="btn btn-danger"
                    onClick={onDisconnect}
                    title="Disconnect"
                >
                    <PhoneOff size={24} />
                </button>

                <button
                    className="btn btn-primary"
                    onClick={onSkip}
                    title="Skip / Next"
                >
                    <SkipForward size={24} />
                </button>
            </div>
        </div>
    );
};

export default CallInterface;
