import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Phone, Mic, MicOff, Video, VideoOff } from "lucide-react";

const VideoCall = () => {
    const {
        selectedUser,
        isMicOn,
        isCameraOn,
        toggleMic,
        toggleCamera,
        endCall,
        callData,
        isIncoming,
        initiateCall,
        answerCall,
    } = useChatStore();

    const { socket } = useAuthStore();

    const [localStream, setLocalStream] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const targetIdRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    const rtcConfig = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            {
                urls: "turn:global.turn.metered.ca:80",
                username: import.meta.env.VITE_TURN_USERNAME,
                credential: import.meta.env.VITE_TURN_CREDENTIAL,
            },
            {
                urls: "turn:global.turn.metered.ca:443",
                username: import.meta.env.VITE_TURN_USERNAME,
                credential: import.meta.env.VITE_TURN_CREDENTIAL,
            },
            {
                urls: "turn:global.turn.metered.ca:443?transport=tcp",
                username: import.meta.env.VITE_TURN_USERNAME,
                credential: import.meta.env.VITE_TURN_CREDENTIAL,
            },
        ],
    };

    // Validates critical infrastructure.
    useEffect(() => {
        if (!rtcConfig.iceServers[1].username || !rtcConfig.iceServers[1].credential) {
            console.error("TURN credentials are missing! Check your .env setup.");
            toast.error("Video Call Config Error: Missing TURN Credentials");
        }
    }, []);

    // Orchestrates peer connection lifecycle.
    useEffect(() => {
        let isMounted = true; // Prevents duplicate connection initialization.
        let stream = null;
        let pc = null;

        // Buffers connection candidates.
        let incomingCandidates = [];
        let outgoingCandidates = [];

        // Hydrates remote connection targets.
        const processCandidateQueue = async () => {
            if (!pc || !pc.remoteDescription) return;

            for (const candidate of incomingCandidates) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn("Skipping invalid ICE candidate:", e.message);
                }
            }
            incomingCandidates = []; // Resets candidate buffer.
        };

        // Dispatches buffered connection targets.
        const flushOutgoingCandidates = () => {
            if (!pc || !pc.remoteDescription) return;

            outgoingCandidates.forEach((candidate) => {
                socket.emit("send-ice-candidate", {
                    to: targetIdRef.current,
                    candidate: candidate,
                });
            });
            outgoingCandidates = []; // Resets dispatch buffer.
        };

        const setupMediaAndConnection = async () => {
            const tId = isIncoming ? callData?.from : selectedUser?._id;
            targetIdRef.current = tId;

            if (!tId) return;

            try {
                // Acquires hardware interfaces.
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                } catch (err) {
                    console.error("Camera failed, trying Audio only:", err);
                    stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    if (isCameraOn) toggleCamera();
                    toast.error("Camera unavailable. Switched to Audio only.");
                }

                // Cleans up aborted hardware requests.
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                setLocalStream(stream);
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                // Initializes WebRTC session.
                pc = new RTCPeerConnection(rtcConfig);
                peerConnectionRef.current = pc;

                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                pc.oniceconnectionstatechange = () => {
                    if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                        setIsConnected(false);
                        toast.error("Connection lost/failed");
                    } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        setIsConnected(true);
                    }
                };

                pc.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        const remoteStream = event.streams[0] || new MediaStream([event.track]);
                        remoteVideoRef.current.srcObject = remoteStream;
                        remoteVideoRef.current.onloadedmetadata = () => {
                            remoteVideoRef.current.play().catch(e => console.error("Play error:", e));
                        };
                    }
                };

                // Discovers network pathways.
                pc.onicecandidate = (event) => {
                    if (event.candidate && targetIdRef.current) {
                        // Ensures remote peer readiness.
                        if (pc.remoteDescription) {
                            socket.emit("send-ice-candidate", {
                                to: targetIdRef.current,
                                candidate: event.candidate,
                            });
                        } else {
                            // Buffers unsendable candidates.
                            outgoingCandidates.push(event.candidate);
                        }
                    }
                };

                // Negotiates session parameters.
                if (isIncoming && callData?.signal) {
                    // Inbound session handling.
                    await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));
                    await processCandidateQueue(); // Hydrates queued network targets.

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    flushOutgoingCandidates(); // Dispatches queued network targets.
                    answerCall(callData.from, answer);
                } else {
                    // Outbound session initialization.
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (selectedUser?._id) {
                        initiateCall(selectedUser._id, offer);
                    }
                }

            } catch (error) {
                console.error("Error setting up video call:", error);
                endCall(tId);
            }
        };

        setupMediaAndConnection();

        // Session signaling listeners.
        const handleCallAccepted = async (signal) => {
            if (pc && !pc.currentRemoteDescription) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    await processCandidateQueue();
                    flushOutgoingCandidates(); // Safely flushes queued candidates.
                } catch (err) {
                    console.error("Error accepting call signal:", err);
                }
            }
        };

        const handleIceCandidate = async (candidate) => {
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn("ICE Error:", e.message);
                }
            } else {
                incomingCandidates.push(candidate);
            }
        };

        if (socket) {
            socket.on("call-accepted", handleCallAccepted);
            socket.on("receive-ice-candidate", handleIceCandidate);
        }

        // Tears down session resources.
        return () => {
            isMounted = false; // Prevents memory leaks.
            if (stream) stream.getTracks().forEach((track) => track.stop());
            if (pc) pc.close();

            if (socket) {
                socket.off("call-accepted", handleCallAccepted);
                socket.off("receive-ice-candidate", handleIceCandidate);
            }
        };

    }, [socket, isIncoming, callData, selectedUser]); // Prevents stale closure bugs.

    // Manages hardware track states.
    useEffect(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            if (videoTrack) videoTrack.enabled = isCameraOn;
            if (audioTrack) audioTrack.enabled = isMicOn;
        }
    }, [isCameraOn, isMicOn, localStream]);

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            {/* Peer viewport. */}
            <div className="relative w-full h-full md:w-[90%] md:h-[90%] bg-zinc-900 md:rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-full text-white text-sm backdrop-blur-sm">
                    {isConnected ? "Connected" : (isIncoming ? `Connecting...` : "Calling...")}
                </div>
            </div>

            {/* Local viewport. */}
            <div className="absolute bottom-24 right-4 w-32 h-48 md:bottom-10 md:right-10 md:w-48 md:h-36 bg-zinc-800 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`} />
                {!isCameraOn && (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white/50 text-xs font-medium">
                        Camera Off
                    </div>
                )}
            </div>

            {/* Hardware toggles. */}
            <div className="absolute bottom-8 flex items-center gap-6 bg-zinc-900/90 backdrop-blur-md p-4 rounded-full border border-white/10 shadow-2xl z-30">
                <button onClick={toggleMic} className={`p-4 rounded-full transition-all duration-200 hover:scale-110 ${isMicOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500/20 text-red-500 border border-red-500/50"}`}>
                    {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6" />}
                </button>
                <button onClick={() => endCall(targetIdRef.current)} className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-110 shadow-lg shadow-red-600/50">
                    <Phone className="w-8 h-8 text-white rotate-[135deg]" />
                </button>
                <button onClick={toggleCamera} className={`p-4 rounded-full transition-all duration-200 hover:scale-110 ${isCameraOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500/20 text-red-500 border border-red-500/50"}`}>
                    {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6" />}
                </button>
            </div>
        </div>
    );
};

export default VideoCall;