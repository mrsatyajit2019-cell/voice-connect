import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, SkipForward, Video, VideoOff, Check, X } from 'lucide-react';

const CallInterface = ({
    onDisconnect,
    onSkip,
    isMuted,
    toggleMute,
    localStream,
    remoteStream,
    videoActive,
    onRequestVideo,
    videoRequestStatus, // 'none', 'sending', 'received'
    onAcceptVideo,
    onRejectVideo
}) => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (videoActive && localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [videoActive, localStream]);

    useEffect(() => {
        if (videoActive && remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [videoActive, remoteStream]);

    return (
        <div className="glass-panel" style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            width: '100%',
            maxWidth: '800px',
            height: '80vh',
            justifyContent: 'space-between'
        }}>

            {/* Video Area */}
            <div style={{
                flex: 1,
                width: '100%',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                overflow: 'hidden'
            }}>
                {!videoActive ? (
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 600 }}>Connected</h2>
                        <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)' }}>Audio Only</p>

                        <div className="visualizer" style={{ marginTop: '40px' }}>
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
                    </div>
                ) : (
                    <>
                        {/* Remote Video (Main) */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Local Video (PIP) */}
                        <div style={{
                            position: 'absolute',
                            bottom: '20px',
                            right: '20px',
                            width: '150px',
                            height: '100px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            border: '2px solid rgba(255,255,255,0.2)'
                        }}>
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                    </>
                )}

                {/* Video Request Overlay */}
                {videoRequestStatus === 'received' && !videoActive && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.8)',
                        padding: '15px 25px',
                        borderRadius: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid var(--primary-gradient)'
                    }}>
                        <span>Partner wants to enable video</span>
                        <button className="btn btn-success" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={onAcceptVideo}>
                            <Check size={18} /> Accept
                        </button>
                        <button className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={onRejectVideo}>
                            <X size={18} />
                        </button>
                    </div>
                )}

                {videoRequestStatus === 'sending' && !videoActive && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.6)',
                        padding: '10px 20px',
                        borderRadius: '50px',
                        color: 'var(--text-secondary)'
                    }}>
                        Requesting video...
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '20px' }}>
                <button
                    className="btn"
                    style={{ background: isMuted ? 'var(--danger-gradient)' : 'rgba(255,255,255,0.1)' }}
                    onClick={toggleMute}
                    title="Mute/Unmute"
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {!videoActive && (
                    <button
                        className="btn"
                        style={{ background: videoRequestStatus === 'sending' ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)' }}
                        onClick={onRequestVideo}
                        disabled={videoRequestStatus !== 'none'}
                        title="Request Video"
                    >
                        <Video size={24} />
                    </button>
                )}

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
