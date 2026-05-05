"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { AppLayout } from "@/components/AppLayout"
import { CallModal } from "@/components/CallModal"

interface Message {
  id: string
  user_id: string
  message: string
  created_at: string
  file_name: string | null
  file_path: string | null
  file_type: string | null
  is_read: boolean
  user: { id: string; name: string; role: string }
}

interface UserOption {
  id: string
  name: string
  role: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [user, setUser] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"global" | "private">("global")
  const [selectedPartner, setSelectedPartner] = useState<UserOption | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Call state
  const [callOpen, setCallOpen] = useState(false)
  const [callMode, setCallMode] = useState<"voice" | "video" | null>(null)
  const [callPartner, setCallPartner] = useState<UserOption | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
      if (d.user) loadUsers(d.user.id)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [user, activeTab, selectedPartner])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function loadUsers(currentId: string) {
    const res = await fetch("/api/users")
    const data = await res.json()
    setAllUsers((data.users || []).filter((u: any) => u.id !== currentId))
  }

  async function loadMessages() {
    if (!user) return
    let url = `/api/chat?room=global`
    if (activeTab === "private" && selectedPartner) {
      url = `/api/chat?userId=${user.id}&partnerId=${selectedPartner.id}`
    }
    const res = await fetch(url)
    const data = await res.json()
    setMessages(data.messages || [])
    setLoading(false)

    // Mark as read
    const unreadIds = (data.messages || []).filter((m: Message) => !m.is_read && m.user_id !== user.id).map((m: Message) => m.id)
    if (unreadIds.length > 0) {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds })
      })
    }
  }

  async function clearChat() {
    if (!confirm("Clear all messages?")) return
    let url = `/api/chat?room=global`
    if (activeTab === "private" && selectedPartner && user) {
      url = `/api/chat?userId=${user.id}&partnerId=${selectedPartner.id}`
    }
    const res = await fetch(url, { method: "DELETE" })
    if (res.ok) {
      loadMessages()
    } else {
      const data = await res.json()
      alert(data.error || "Failed to clear chat")
    }
  }

  async function sendMessage(e?: React.FormEvent, voiceBlob?: Blob) {
    if (e) e.preventDefault()
    if ((!newMessage.trim() && !file && !voiceBlob) || !user) return
    setUploading(true)

    const formData = new FormData()
    formData.append("user_id", user.id)
    formData.append("room_id", activeTab === "global" ? "global" : "private")
    formData.append("message", newMessage.trim())
    if (activeTab === "private" && selectedPartner) {
      formData.append("recipient_id", selectedPartner.id)
    }
    if (file) formData.append("file", file)
    if (voiceBlob) {
      const voiceFile = new File([voiceBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" })
      formData.append("file", voiceFile)
    }

    await fetch("/api/chat", { method: "POST", body: formData })
    setNewMessage("")
    setFile(null)
    setAudioBlob(null)
    setUploading(false)
    loadMessages()
  }

  // Voice recording
  async function startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support voice recording")
        return
      }
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        alert("Voice recording requires HTTPS or localhost.")
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      setRecordingDuration(0)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start()
      setIsRecording(true)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      alert("Microphone access denied or not available")
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  function cancelRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    setAudioBlob(null)
    setRecordingDuration(0)
  }

  function sendVoiceMessage() {
    if (audioBlob) {
      sendMessage(undefined, audioBlob)
      setAudioBlob(null)
      setRecordingDuration(0)
    }
  }

  // Call handling
  async function startCall(mode: "voice" | "video", partner: UserOption) {
    setCallMode(mode)
    setCallPartner(partner)
    setCallOpen(true)

    // Send call notification to recipient
    if (user) {
      await fetch("/api/call/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: user.id,
          to: partner.id,
          type: "incoming",
          mode
        })
      })
    }
  }

  function isImage(type: string | null) {
    return type?.startsWith("image/")
  }

  function isPdf(type: string | null, name: string | null) {
    return type === "application/pdf" || name?.toLowerCase().endsWith(".pdf")
  }

  function isExcel(type: string | null, name: string | null) {
    return type?.includes("excel") || type?.includes("spreadsheet") || name?.toLowerCase().match(/\.(xlsx?|csv)$/)
  }

  function isAudio(type: string | null, name: string | null) {
    return type?.startsWith("audio/") || name?.toLowerCase().endsWith(".webm") || name?.toLowerCase().endsWith(".mp3")
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  return (
    <AppLayout>
      <CallModal
        isOpen={callOpen}
        onClose={() => { setCallOpen(false); setCallPartner(null); setCallMode(null) }}
        mode={callMode}
        partner={callPartner}
        userId={user?.id || ""}
      />

      <div className="max-w-5xl h-[calc(100vh-120px)] flex flex-col">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">Team Chat</h1>
            {user?.role === "Admin" && activeTab === "global" && messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-red-400 hover:text-red-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                🗑️ Clear Chat
              </button>
            )}
            {activeTab === "private" && selectedPartner && messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-red-400 hover:text-red-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                🗑️ Clear Chat
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setActiveTab("global"); setSelectedPartner(null) }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "global" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>💬 Global</button>
            <button onClick={() => setActiveTab("private")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "private" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>🔒 Private</button>
          </div>
        </div>

        {activeTab === "private" && !selectedPartner && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Select a user to message</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <button onClick={() => setSelectedPartner(u)} className="flex items-center gap-3 flex-1 text-left hover:bg-primary-50 rounded-lg p-1 transition-colors">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{u.name.charAt(0)}</div>
                    <div>
                      <div className="font-medium text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.role}</div>
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => startCall("voice", u)} className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-700 flex items-center justify-center transition-colors" title="Voice call">📞</button>
                    <button onClick={() => startCall("video", u)} className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors" title="Video call">📹</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "private" && selectedPartner && (
          <div className="flex items-center justify-between mb-2 bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedPartner(null)} className="text-sm text-primary-600 hover:text-primary-800">← Back</button>
              <span className="font-medium text-slate-800">Messaging {selectedPartner.name}</span>
              <span className="text-xs text-slate-500">{selectedPartner.role}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startCall("voice", selectedPartner)} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                📞 Voice
              </button>
              <button onClick={() => startCall("video", selectedPartner)} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                📹 Video
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                {activeTab === "private" && !selectedPartner ? "Select a user to start chatting" : "No messages yet. Start the conversation!"}
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMe = user && m.user_id === user.id
                const showHeader = idx === 0 || messages[idx - 1].user_id !== m.user_id
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] ${isMe ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-800"} rounded-2xl px-4 py-2.5`}>
                      {showHeader && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold ${isMe ? "text-primary-100" : "text-slate-600"}`}>{m.user.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isMe ? "bg-primary-500 text-primary-100" : "bg-slate-200 text-slate-600"}`}>{m.user.role}</span>
                        </div>
                      )}
                      {m.message && <div className="text-sm leading-relaxed">{m.message}</div>}
                      {m.file_path && (
                        <div className="mt-2">
                          {isImage(m.file_type) ? (
                            <a href={`/api${m.file_path}`} target="_blank" rel="noopener noreferrer">
                              <img src={`/api${m.file_path}`} alt={m.file_name || "image"} className="max-w-[200px] max-h-[150px] rounded-lg object-cover hover:opacity-90 transition-opacity" />
                            </a>
                          ) : isAudio(m.file_type, m.file_name) ? (
                            <audio controls className="max-w-[200px]">
                              <source src={`/api${m.file_path}`} type={m.file_type || "audio/webm"} />
                            </audio>
                          ) : (
                            <div className={`flex items-center gap-3 p-2.5 rounded-lg ${isMe ? "bg-primary-700" : "bg-slate-50"}`}>
                              <span className="text-2xl">{isPdf(m.file_type, m.file_name) ? "📄" : isExcel(m.file_type, m.file_name) ? "📊" : "📎"}</span>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${isMe ? "text-white" : "text-slate-800"}`}>{m.file_name || "File"}</div>
                                <div className={`text-xs ${isMe ? "text-primary-200" : "text-slate-500"}`}>{isPdf(m.file_type, m.file_name) ? "PDF" : isExcel(m.file_type, m.file_name) ? "Spreadsheet" : "File"}</div>
                              </div>
                              <a
                                href={`/api${m.file_path}`}
                                download={m.file_name || "download"}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isMe
                                    ? "bg-white text-primary-700 hover:bg-primary-50"
                                    : "bg-primary-600 text-white hover:bg-primary-500"
                                }`}
                              >
                                ⬇ Download
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      <div className={`text-[10px] mt-1 ${isMe ? "text-primary-200" : "text-slate-400"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {activeTab === "private" && isMe && (
                          <span className="ml-1">{m.is_read ? "✓✓" : "✓"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {!(activeTab === "private" && !selectedPartner) && (
            <form onSubmit={sendMessage} className="p-4 border-t border-slate-100">
              {file && (
                <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <span>📎 {file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              )}

              {audioBlob && (
                <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <span>🎙️ Voice message ({formatTime(recordingDuration)})</span>
                  <audio controls className="h-8">
                    <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                  </audio>
                  <button type="button" onClick={sendVoiceMessage} className="bg-primary-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-primary-500 transition-colors">Send</button>
                  <button type="button" onClick={() => { setAudioBlob(null); setRecordingDuration(0) }} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              )}

              {isRecording && (
                <div className="flex items-center gap-3 mb-2 bg-red-50 p-3 rounded-lg">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-red-700">Recording {formatTime(recordingDuration)}</span>
                  <button type="button" onClick={stopRecording} className="ml-auto bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-500 transition-colors">⏹ Stop</button>
                  <button type="button" onClick={cancelRecording} className="text-slate-500 hover:text-slate-700 text-sm">Cancel</button>
                </div>
              )}

              <div className="flex gap-3">
                <label className="cursor-pointer flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-xl transition-colors flex items-center">
                  <span>📎</span>
                  <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.xlsx,.xls,.csv,image/*" />
                </label>

                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isRecording || !!audioBlob}
                  className={`flex-shrink-0 px-4 py-3 rounded-xl transition-colors flex items-center ${
                    isRecording ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  } ${audioBlob ? "opacity-50 cursor-not-allowed" : ""}`}
                  title="Hold to record voice"
                >
                  🎙️
                </button>

                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={user ? "Type a message..." : "Login to chat"}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                  disabled={!user || isRecording}
                />
                <button
                  type="submit"
                  disabled={!user || (!newMessage.trim() && !file && !audioBlob) || uploading || isRecording}
                  className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "..." : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
