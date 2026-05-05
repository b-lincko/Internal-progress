"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface CallModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "voice" | "video" | null
  partner: { id: string; name: string } | null
  userId: string
}

interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate"
  from: string
  to: string
  data: any
  created_at: string
}

export function CallModal({ isOpen, onClose, mode, partner, userId }: CallModalProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callState, setCallState] = useState<"connecting" | "ringing" | "connected" | "ended" | "error" | "blocked">("connecting")
  const [error, setError] = useState("")
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    localStream?.getTracks().forEach(t => t.stop())
    remoteStream?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    pcRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
  }, [localStream, remoteStream])

  useEffect(() => {
    if (!isOpen || !partner || !mode) {
      cleanup()
      return
    }

    async function initCall() {
      try {
        setCallState("connecting")
        setError("")

        // Check secure context (HTTPS or localhost)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Browser does not support media access")
        }
        if (typeof window !== "undefined" && window.isSecureContext === false) {
          setCallState("blocked")
          setError("Camera/microphone access requires HTTPS or localhost. Please access via https:// or localhost:3000")
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video"
        })
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ]
        })
        pcRef.current = pc

        stream.getTracks().forEach(track => pc.addTrack(track, stream))

        pc.ontrack = (event) => {
          const [remote] = event.streams
          setRemoteStream(remote)
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote
          setCallState("connected")
          startTimeRef.current = Date.now()
          intervalRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
          }, 1000)
        }

        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await sendSignal({ type: "ice-candidate", data: event.candidate })
          }
        }

        // Create offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal({ type: "offer", data: offer })
        setCallState("ringing")

        // Poll for answer
        pollRef.current = setInterval(async () => {
          const currentPc = pcRef.current
          if (!currentPc || currentPc.signalingState === "closed" || !partner) return
          const res = await fetch(`/api/call?from=${partner.id}&to=${userId}`)
          const data = await res.json()
          const signals = data.signals || []

          for (const sig of signals) {
            if (sig.type === "answer") {
              await currentPc.setRemoteDescription(new RTCSessionDescription(sig.data))
            } else if (sig.type === "ice-candidate") {
              await currentPc.addIceCandidate(new RTCIceCandidate(sig.data))
            }
          }
        }, 2000)
      } catch (e: any) {
        setError(e.message || "Failed to start call")
        setCallState("error")
      }
    }

    initCall()

    return cleanup
  }, [isOpen, partner, mode, userId, cleanup])

  async function sendSignal(payload: { type: string; data: any }) {
    if (!partner) return
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: userId,
        to: partner.id,
        type: payload.type,
        data: payload.data
      })
    })
  }

  async function toggleMute() {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(!isMuted)
  }

  async function toggleVideo() {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsVideoOff(!isVideoOff)
  }

  function endCall() {
    cleanup()
    setCallState("ended")
    setTimeout(onClose, 500)
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  if (!isOpen || !partner || !mode) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center">
      <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl ${callState === "blocked" ? "bg-orange-500" : "bg-primary-600"}`}>
            {callState === "blocked" ? "🔒" : mode === "video" ? "📹" : "📞"}
          </div>
          <h2 className="text-xl font-bold text-white">{partner.name}</h2>
          <p className="text-slate-400 mt-1">
            {callState === "connecting" && "Connecting..."}
            {callState === "ringing" && "Ringing..."}
            {callState === "connected" && formatDuration(duration)}
            {callState === "error" && `Error: ${error}`}
            {callState === "blocked" && "Access Blocked"}
          </p>
          {callState === "blocked" && (
            <div className="mt-4 bg-orange-900/50 border border-orange-700 rounded-lg p-4 text-left">
              <p className="text-orange-200 text-sm mb-2">🔒 Camera and microphone access requires a secure connection.</p>
              <p className="text-slate-400 text-xs">{error}</p>
              <p className="text-slate-500 text-xs mt-2">Solutions:</p>
              <ul className="text-slate-400 text-xs mt-1 space-y-1 list-disc list-inside">
                <li>Use <b>http://localhost:3000</b> (recommended)</li>
                <li>Set up HTTPS with a self-signed certificate</li>
                <li>Enable insecure origins in browser flags (not recommended)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Video area */}
        {mode === "video" && (
          <div className="relative bg-black rounded-xl overflow-hidden mb-4 aspect-video">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            <div className="absolute bottom-3 right-3 w-24 h-18 bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-600">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            </div>
          </div>
        )}

        {/* Voice call avatar */}
        {mode === "voice" && callState === "connected" && (
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center text-4xl animate-pulse">
                {partner.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-slate-900"></div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-colors ${
              isMuted ? "bg-red-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
          >
            {isMuted ? "🔇" : "🎤"}
          </button>

          {mode === "video" && (
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-colors ${
                isVideoOff ? "bg-red-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
              }`}
            >
              {isVideoOff ? "🚫" : "📹"}
            </button>
          )}

          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center text-xl transition-colors"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  )
}
