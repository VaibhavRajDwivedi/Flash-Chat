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

    const { socket, authUser } = useAuthStore();

    const [localStream, setLocalStream] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const candidateQueue = useRef([]); // Queue for candidates arriving before remote desc

    // STUN Servers (Google's Public STUN is reliable)
    const rtcConfig = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    useEffect(() => {
        let stream = null;
        let pc = null;

        const setupMediaAndConnection = async () => {
            try {
                // 1. Get User Media (Camera & Mic)

                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                } catch (err) {
                    console.error("Camera access failed, trying Audio only:", err);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: false,
                            audio: true,
                        });
                        // Manually toggle camera off in store so UI reflects it
                        if (isCameraOn) toggleCamera();
                        toast.error("Camera unavailable. Switched to Audio only.");
                    } catch (err2) {
                        console.error("Audio access also failed:", err2);
                        toast.error("Failed to access Camera and Microphone.");
                        // Throw err2 to see WHY audio failed, instead of video error
                        throw err2;
                    }
                }
                setLocalStream(stream);

                // Attach to local video element immediately
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // 2. Create PeerConnection
                pc = new RTCPeerConnection(rtcConfig);
                peerConnectionRef.current = pc;

                // Add local tracks to the connection
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                // 3. Handle Remote Stream
                pc.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                };

                // 4. Handle ICE Candidates (Network Paths)
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        // Determine who to send the candidate to
                        const targetId = isIncoming ? callData?.from : selectedUser?._id;

                        if (targetId) {
                            socket.emit("send-ice-candidate", {
                                to: targetId,
                                candidate: event.candidate,
                            });
                        }
                    }
                };

                // 5. Signaling Logic (Offer vs Answer)
                if (isIncoming && callData?.signal) {
                    // --- ANSWERING A CALL ---
                    // Set the remote description (the offer we received)
                    await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));
                    processCandidateQueue(); // Process any queued candidates now

                    // Create an answer
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    // Send answer via Store Action
                    answerCall(callData.from, answer);

                } else {
                    // --- STARTING A CALL ---
                    // Create an offer
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    // Send offer via Store Action
                    // Note: If selectedUser is null (edge case), check your routing
                    if (selectedUser?._id) {
                        initiateCall(selectedUser._id, offer);
                    }
                }

            } catch (error) {
                console.error("Error setting up video call:", error);
                endCall(); // Close if camera fails
            }
        };

        const processCandidateQueue = async () => {
            const pc = peerConnectionRef.current;
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

        setupMediaAndConnection();

        // CLEANUP ON UNMOUNT
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (pc) {
                pc.close();
            }
        };
    }, []); // Run once on mount

    // ----------------------------------------------------
    // SOCKET EVENT LISTENERS (For active connection)
    // ----------------------------------------------------
    useEffect(() => {
        if (!socket) return;

        // Handle Answer (Caller Side)
        const handleCallAccepted = async (signal) => {
            const pc = peerConnectionRef.current;
            if (pc && !pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                processCandidateQueue();
            }
        };

        // Handle ICE Candidates (Both Sides)
        const handleIceCandidate = async (candidate) => {
            const pc = peerConnectionRef.current;
            if (pc) {
                // If we have remote description, add immediately
                if (pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error("Error adding ice candidate", e);
                    }
                } else {
                    // Otherwise queue it
                    candidateQueue.current.push(new RTCIceCandidate(candidate));
                }
            }
        };

        socket.on("call-accepted", handleCallAccepted);
        socket.on("receive-ice-candidate", handleIceCandidate);

        return () => {
            socket.off("call-accepted", handleCallAccepted);
            socket.off("receive-ice-candidate", handleIceCandidate);
        };
    }, [socket]);

    // ----------------------------------------------------
    // MEDIA TOGGLES
    // ----------------------------------------------------
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

            {/* REMOTE VIDEO (Main Screen) */}
            <div className="relative w-full h-full md:w-[90%] md:h-[90%] bg-zinc-900 md:rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
                {/* Loading Indicator / Placeholder */}
                <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-full text-white text-sm backdrop-blur-sm">
                    {isIncoming ? `Connected with ${callData?.name || "User"}` : "Calling..."}
                </div>
            </div>

            {/* LOCAL VIDEO (Picture in Picture) */}
            <div className="absolute bottom-24 right-4 w-32 h-48 md:bottom-10 md:right-10 md:w-48 md:h-36 bg-zinc-800 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted // Always mute local video to prevent echo
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

                {/* Mic Toggle */}
                <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full transition-all duration-200 hover:scale-110 ${isMicOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500/20 text-red-500 border border-red-500/50"
                        }`}
                >
                    {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6" />}
                </button>

                {/* End Call (Center, Big) */}
                <button
                    onClick={endCall}
                    className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-110 shadow-lg shadow-red-600/50"
                >
                    <Phone className="w-8 h-8 text-white rotate-[135deg]" />
                </button>

                {/* Camera Toggle */}
                <button
                    onClick={toggleCamera}
                    className={`p-4 rounded-full transition-all duration-200 hover:scale-110 ${isCameraOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500/20 text-red-500 border border-red-500/50"
                        }`}
                >
                    {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6" />}
                </button>
            </div>
        </div>
    );
};

export default VideoCall;