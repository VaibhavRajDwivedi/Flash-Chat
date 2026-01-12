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
    const candidateQueue = useRef([]); 
    const targetIdRef = useRef(null); 
    const [isConnected, setIsConnected] = useState(false);

    const rtcConfig = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    useEffect(() => {
        let stream = null;
        let pc = null;

        // 1. Helper function to process queued ICE candidates
        const processCandidateQueue = async () => {
            if (!pc || !pc.remoteDescription) return;
            while (candidateQueue.current.length > 0) {
                const candidate = candidateQueue.current.shift();
                try {
                    await pc.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding queued ice candidate", e);
                }
            }
        };

        // 2. Main Setup
        const setupMediaAndConnection = async () => {
            // Determine target ID immediately
            const tId = isIncoming ? callData?.from : selectedUser?._id;
            targetIdRef.current = tId;

            if (!tId) {
                console.error("Target ID missing, cannot establish call");
                return;
            }

            try {
                // --- Get Media ---
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                } catch (err) {
                    console.error("Camera access failed, trying Audio only:", err);
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: true,
                    });
                    if (isCameraOn) toggleCamera();
                    toast.error("Camera unavailable. Switched to Audio only.");
                }
                
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // --- Create PeerConnection ---
                pc = new RTCPeerConnection(rtcConfig);
                peerConnectionRef.current = pc;

                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                pc.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate && targetIdRef.current) {
                        socket.emit("send-ice-candidate", {
                            to: targetIdRef.current,
                            candidate: event.candidate,
                        });
                    }
                };

                // --- Signaling ---
                if (isIncoming && callData?.signal) {
                    // ANSWERING
                    await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));
                    await processCandidateQueue(); 

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    answerCall(callData.from, answer);
                    setIsConnected(true);

                } else {
                    // CALLING
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (selectedUser?._id) {
                        initiateCall(selectedUser._id, offer);
                    }
                }

            } catch (error) {
                console.error("Error setting up video call:", error);
                endCall();
            }
        };

        setupMediaAndConnection();

        // -------------------------------------------
        // SOCKET LISTENERS (Defined INSIDE to access pc/queue)
        // -------------------------------------------
        
        const handleCallAccepted = async (signal) => {
            if (pc && !pc.currentRemoteDescription) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    await processCandidateQueue(); // Now this works!
                    setIsConnected(true);
                } catch (err) {
                    console.error("Error accepting call signal:", err);
                }
            }
        };

        const handleIceCandidate = async (candidate) => {
            if (pc) {
                if (pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error("Error adding ice candidate", e);
                    }
                } else {
                    candidateQueue.current.push(new RTCIceCandidate(candidate));
                }
            }
        };

        if (socket) {
            socket.on("call-accepted", handleCallAccepted);
            socket.on("receive-ice-candidate", handleIceCandidate);
        }

        // CLEANUP
        return () => {
            if (stream) stream.getTracks().forEach((track) => track.stop());
            if (pc) pc.close();
            
            if (socket) {
                socket.off("call-accepted", handleCallAccepted);
                socket.off("receive-ice-candidate", handleIceCandidate);
            }
        };

    // We add dependencies to ensure correct setup if props change
    }, [socket, isIncoming, callData, selectedUser]); 

    // Toggle Media Tracks
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
            {/* REMOTE VIDEO */}
            <div className="relative w-full h-full md:w-[90%] md:h-[90%] bg-zinc-900 md:rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-full text-white text-sm backdrop-blur-sm">
                    {isConnected ? "Connected" : (isIncoming ? `Connecting...` : "Calling...")}
                </div>
            </div>

            {/* LOCAL VIDEO */}
            <div className="absolute bottom-24 right-4 w-32 h-48 md:bottom-10 md:right-10 md:w-48 md:h-36 bg-zinc-800 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted 
                    className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`}
                />
                {!isCameraOn && (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white/50 text-xs font-medium">
                        Camera Off
                    </div>
                )}
            </div>

            {/* CONTROL BAR */}
            <div className="absolute bottom-8 flex items-center gap-6 bg-zinc-900/90 backdrop-blur-md p-4 rounded-full border border-white/10 shadow-2xl z-30">
                <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full transition-all duration-200 hover:scale-110 ${isMicOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500/20 text-red-500 border border-red-500/50"}`}
                >
                    {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6" />}
                </button>

                <button
                    onClick={endCall}
                    className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-110 shadow-lg shadow-red-600/50"
                >
                    <Phone className="w-8 h-8 text-white rotate-[135deg]" />
                </button>

                <button
                    onClick={toggleCamera}
                    className={`p-4 rounded-full transition-all duration-200 hover:scale-110 ${isCameraOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500/20 text-red-500 border border-red-500/50"}`}
                >
                    {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6" />}
                </button>
            </div>
        </div>
    );
};

export default VideoCall;