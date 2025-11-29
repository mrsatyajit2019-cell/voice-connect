import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Phone, Loader2, RefreshCw } from 'lucide-react';
import CallInterface from './components/CallInterface';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function App() {
  const [status, setStatus] = useState('welcome'); // welcome, idle, searching, connected, partner_disconnected
  const [isMuted, setIsMuted] = useState(false);
  const [agreedToTos, setAgreedToTos] = useState(false);

  // Video state
  const [videoActive, setVideoActive] = useState(false);
  const [videoRequestStatus, setVideoRequestStatus] = useState('none'); // 'none', 'sending', 'received'
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();

  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socketRef.current.on('partner_found', async ({ initiator }) => {
      setStatus('connected');
      initializePeer(initiator);
    });

    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleNewICECandidate);
    socketRef.current.on('partner_disconnected', handlePartnerDisconnect);

    socketRef.current.on('video_request', () => {
      setVideoRequestStatus('received');
    });

    socketRef.current.on('video_accepted', async () => {
      setVideoRequestStatus('none');
      await enableVideo();
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const initializePeer = async (initiator) => {
    try {
      // Ensure we have audio stream
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
      const stream = localStreamRef.current;

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      });
      peerRef.current = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('ice-candidate', event.candidate);
        }
      };

      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socketRef.current.emit('offer', offer);
        } catch (err) {
          console.error("Negotiation error:", err);
        }
      };

      if (initiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socketRef.current.emit('offer', offer);
      }
    } catch (err) {
      console.error('Error initializing peer:', err);
      setStatus('idle');
      alert('Could not access microphone. Please allow permissions.');
    }
  };

  const handleOffer = async (offer) => {
    if (!peerRef.current) return;
    await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);
    socketRef.current.emit('answer', answer);
  };

  const handleAnswer = async (answer) => {
    if (!peerRef.current) return;
    await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleNewICECandidate = async (candidate) => {
    if (!peerRef.current) return;
    try {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding received ice candidate', e);
    }
  };

  const handlePartnerDisconnect = () => {
    cleanupCall(false); // Don't stop local stream
    setStatus('partner_disconnected');
  };

  const cleanupCall = (stopLocalStream = true) => {
    setVideoActive(false);
    setVideoRequestStatus('none');
    setRemoteStream(null);

    if (stopLocalStream && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    } else if (localStreamRef.current) {
      // Just stop video tracks if we are keeping audio
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.stop();
        localStreamRef.current.removeTrack(track);
      });
    }

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
  };

  const startSearch = async () => {
    if (!agreedToTos) return;

    // Request mic permission early if not already
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (e) {
        alert("Microphone access is required.");
        return;
      }
    }

    setStatus('searching');
    socketRef.current.emit('find_partner');
  };

  const disconnectCall = () => {
    cleanupCall(true);
    socketRef.current.emit('disconnect_call');
    setStatus('idle');
  };

  const handleSkip = () => {
    cleanupCall(false); // Keep mic active
    socketRef.current.emit('disconnect_call');
    setStatus('searching');
    socketRef.current.emit('find_partner');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleTosAgreement = () => {
    setAgreedToTos(true);
    setStatus('idle');
  };

  // Video Logic
  const requestVideo = () => {
    setVideoRequestStatus('sending');
    socketRef.current.emit('video_request');
  };

  const acceptVideo = async () => {
    setVideoRequestStatus('none');
    socketRef.current.emit('video_accepted');
    await enableVideo();
  };

  const rejectVideo = () => {
    setVideoRequestStatus('none');
    // Optionally notify partner
  };

  const enableVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      // Replace audio track in local stream (to keep same stream ID if possible, or just update ref)
      // Actually easier to just replace the whole stream ref and add video track to peer

      const videoTrack = stream.getVideoTracks()[0];
      localStreamRef.current.addTrack(videoTrack);
      setLocalStream(localStreamRef.current); // Force update

      if (peerRef.current) {
        peerRef.current.addTrack(videoTrack, localStreamRef.current);
      }

      setVideoActive(true);
    } catch (err) {
      console.error("Error enabling video:", err);
      alert("Could not access camera.");
    }
  };

  return (
    <div className="app-container">

      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        fontSize: '1.5rem',
        fontWeight: 700,
        background: '-webkit-linear-gradient(45deg, #667eea, #764ba2)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        zIndex: 10
      }}>
        VoiceConnect
      </div>

      {status === 'welcome' && (
        <div className="glass-panel" style={{ padding: '60px', maxWidth: '500px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>Welcome</h1>
          <p style={{ lineHeight: '1.6', marginBottom: '30px', color: 'var(--text-secondary)' }}>
            Connect with random people for a voice chat.
            <br /><br />
            <strong>Rules:</strong>
          </p>
          <ul style={{ textAlign: 'left', margin: '0 auto 30px', display: 'inline-block', color: 'var(--text-secondary)' }}>
            <li>Be respectful.</li>
            <li>No inappropriate behavior.</li>
            <li>You must be 18+.</li>
          </ul>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleTosAgreement}>
            I Agree & Continue
          </button>
        </div>
      )}

      {status === 'idle' && (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 20px' }}>Talk to Strangers</h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '40px' }}>
            Connect instantly with random people around the world.
          </p>
          <button className="btn btn-primary" style={{ fontSize: '1.2rem', padding: '16px 40px', margin: '0 auto' }} onClick={startSearch}>
            <Phone size={24} />
            Start Call
          </button>
        </div>
      )}

      {status === 'searching' && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="pulsating-circle" style={{ position: 'relative', margin: '0 auto 40px', width: '60px', height: '60px' }}></div>
          <h2 style={{ margin: '20px 0 10px' }}>Looking for someone...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Please wait while we find a partner.</p>
        </div>
      )}

      {status === 'partner_disconnected' && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 20px' }}>Partner Disconnected</h2>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={startSearch}>
              <RefreshCw size={20} />
              Find New Partner
            </button>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setStatus('idle')}>
              Home
            </button>
          </div>
        </div>
      )}

      {status === 'connected' && (
        <CallInterface
          onDisconnect={disconnectCall}
          onSkip={handleSkip}
          isMuted={isMuted}
          toggleMute={toggleMute}
          localStream={localStream}
          remoteStream={remoteStream}
          videoActive={videoActive}
          onRequestVideo={requestVideo}
          videoRequestStatus={videoRequestStatus}
          onAcceptVideo={acceptVideo}
          onRejectVideo={rejectVideo}
        />
      )}
    </div>
  );
}

export default App;
