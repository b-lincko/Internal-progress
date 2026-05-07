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
  recipient?: { id: string; name: string } | null
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
  const [searchQuery, setSearchQuery] = useState("")

  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [callOpen, setCallOpen] = useState(false)
  const [callMode, setCallMode] = useState<"voice" | "video" | null>(null)
  const [callPartner, setCallPartner] = useState<UserOption | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
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

    const unreadIds = (data.messages || [])
      .filter((m: Message) => !m.is_read && m.user_id !== user.id)
      .map((m: Message) => m.id)
    if (unreadIds.length > 0) {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      })
    }
  }

  async function clearChat() {
    const room = activeTab === "global" ? "global" : "private"
    const msg = activeTab === "global"
      ? "Clear all global chat messages? This cannot be undone."
      : `Clear chat with ${selectedPartner?.name}? This cannot be undone.`
    if (!confirm(msg)) return

    let url = `/api/chat?room=${room}`
    if (activeTab === "private" && selectedPartner && user) {
      url += `&userId=${user.id}&partnerId=${selectedPartner.id}`
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
      const voiceFile = new File([voiceBlob], `voice_${Date.now()}.webm`, {
        type: "audio/webm",
      })
      formData.append("file", voiceFile)
    }

    await fetch("/api/chat", { method: "POST", body: formData })
    setNewMessage("")
    setFile(null)
    setAudioBlob(null)
    setUploading(false)
    loadMessages()
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
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
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      setIsRecording(true)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1)
      }, 1000)
    } catch {
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

  async function startCall(mode: "voice" | "video", partner: UserOption) {
    setCallMode(mode)
    setCallPartner(partner)
    setCallOpen(true)
    if (user) {
      await fetch("/api/call/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: user.id, to: partner.id, type: "incoming", mode }),
      })
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return "Today"
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined })
  }

  function groupMessagesByDate(msgs: Message[]) {
    const groups: { date: string; items: Message[] }[] = []
    msgs.forEach((m) => {
      const d = formatDate(m.created_at)
      const last = groups[groups.length - 1]
      if (last && last.date === d) {
        last.items.push(m)
      } else {
        groups.push({ date: d, items: [m] })
      }
    })
    return groups
  }

  const isImage = (type: string | null) => type?.startsWith("image/")
  const isPdf = (type: string | null, name: string | null) =>
    type === "application/pdf" || name?.toLowerCase().endsWith(".pdf")
  const isExcel = (type: string | null, name: string | null) =>
    type?.includes("excel") || type?.includes("spreadsheet") || name?.toLowerCase().match(/\.(xlsx?|csv)$/)
  const isAudio = (type: string | null, name: string | null) =>
    type?.startsWith("audio/") || name?.toLowerCase().endsWith(".webm") || name?.toLowerCase().endsWith(".mp3")

  const filteredUsers = allUsers.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isMine = (m: Message) => m.user_id === user?.id

  const chatTitle = activeTab === "global"
    ? "Global Chat"
    : selectedPartner
    ? selectedPartner.name
    : "Select a contact"

  const chatSubtitle = activeTab === "global"
    ? `${allUsers.length + 1} members`
    : selectedPartner
    ? selectedPartner.role
    : ""

  return (
    <AppLayout>
      <CallModal
        isOpen={callOpen}
        onClose={() => { setCallOpen(false); setCallPartner(null); setCallMode(null) }}
        mode={callMode}
        partner={callPartner}
        userId={user?.id || ""}
      />

      <div className="-m-8 h-[calc(100vh-64px)] flex bg-[#f5f5f0]">
        {/* LEFT SIDEBAR - Chat List */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-[#e2e8f0] bg-white">
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 bg-[#f5f5f0] border-b border-[#e2e8f0]">
            <h2 className="font-semibold text-slate-700">Chats</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveTab("global"); setSelectedPartner(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "global"
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                💬 Global
              </button>
              <button
                onClick={() => { setActiveTab("private"); setSelectedPartner(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "private"
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🔒 Private
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 bg-white border-b border-[#e2e8f0]">
            <div className="flex items-center bg-[#f5f5f0] rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === "global" ? "Search..." : "Search contacts..."}
                className="bg-transparent text-sm w-full focus:outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "global" && (
              <div
                onClick={() => setSelectedPartner(null)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  activeTab === "global" && !selectedPartner
                    ? "bg-[#f5f5f0]"
                    : "hover:bg-[#f5f6f8]"
                }`}
              >
                <div className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  💬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">Global Chat</span>
                    <span className="text-xs text-slate-400">{messages.length > 0 && formatTime(messages[messages.length - 1].created_at)}</span>
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {messages.length > 0
                      ? `${messages[messages.length - 1].user.name}: ${messages[messages.length - 1].message || (messages[messages.length - 1].file_name ? "📎 File" : "")}`
                      : `${allUsers.length + 1} members`}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "private" && filteredUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelectedPartner(u)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  selectedPartner?.id === u.id
                    ? "bg-[#f5f5f0]"
                    : "hover:bg-[#f5f6f8]"
                }`}
              >
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-lg font-bold flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.role}</span>
                  </div>
                  <div className="text-sm text-slate-500 truncate">Tap to start chatting</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); startCall("voice", u) }}
                    className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors"
                    title="Voice call"
                  >
                    📞
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); startCall("video", u) }}
                    className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                    title="Video call"
                  >
                    📹
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL - Messages */}
        <div className="flex-1 flex flex-col bg-[#e5ddd5] relative">
          {/* Chat Header */}
          <div className="h-16 bg-[#f5f5f0] flex items-center justify-between px-4 border-b border-[#e2e8f0] flex-shrink-0">
            <div className="flex items-center gap-3">
              {activeTab === "private" && selectedPartner && (
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                >
                  ←
                </button>
              )}
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
                {activeTab === "global" ? "💬" : selectedPartner?.name.charAt(0).toUpperCase() || "?"}
              </div>
              <div>
                <div className="font-medium text-slate-800">{chatTitle}</div>
                <div className="text-xs text-slate-500">{chatSubtitle}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "private" && selectedPartner && (
                <>
                  <button
                    onClick={() => startCall("voice", selectedPartner)}
                    className="w-9 h-9 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors"
                    title="Voice call"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => startCall("video", selectedPartner)}
                    className="w-9 h-9 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                    title="Video call"
                  >
                    📹
                  </button>
                </>
              )}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-red-400 hover:text-red-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Clear chat"
                >
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAXSURBVDiNY2RgYPgPBAz/YRiYxqNgNAhGAQA9mgf1l/8+0QAAAABJRU5ErkJggg==')]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm">
                  {activeTab === "global"
                    ? "No messages yet. Start the conversation!"
                    : selectedPartner
                    ? `No messages with ${selectedPartner.name} yet.`
                    : "Select a contact to start chatting"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {groupMessagesByDate(messages).map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex justify-center my-4">
                      <span className="bg-[#d1d7db] text-slate-600 text-xs px-3 py-1 rounded-lg shadow-sm">
                        {group.date}
                      </span>
                    </div>
                    {group.items.map((m) => {
                      const mine = isMine(m)
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"} mb-2`}
                        >
                          <div
                            className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm text-sm relative ${
                              mine
                                ? "bg-[#d9fdd3] text-slate-800 rounded-tr-sm"
                                : "bg-white text-slate-800 rounded-tl-sm"
                            }`}
                          >
                            {/* Sender name for group chat */}
                            {!mine && activeTab === "global" && (
                              <div className="text-xs font-medium text-primary-600 mb-0.5">
                                {m.user.name}
                              </div>
                            )}

                            {/* Message content */}
                            {m.message && <div className="whitespace-pre-wrap break-words">{m.message}</div>}

                            {/* File attachments */}
                            {m.file_path && (
                              <div className="mt-1">
                                {isImage(m.file_type) ? (
                                  <img
                                    src={m.file_path}
                                    alt={m.file_name || "Image"}
                                    className="max-w-full rounded-lg max-h-60 object-cover"
                                    loading="lazy"
                                  />
                                ) : isAudio(m.file_type, m.file_name) ? (
                                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                    <span className="text-lg">🎙️</span>
                                    <audio controls className="h-8 max-w-[200px]">
                                      <source src={m.file_path} type={m.file_type || "audio/webm"} />
                                    </audio>
                                  </div>
                                ) : (
                                  <a
                                    href={m.file_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                    <span className="text-xl">
                                      {isPdf(m.file_type, m.file_name) ? "📄" : isExcel(m.file_type, m.file_name) ? "📊" : "📎"}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate text-slate-700">
                                        {m.file_name}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {isPdf(m.file_type, m.file_name) ? "PDF Document" : isExcel(m.file_type, m.file_name) ? "Spreadsheet" : "File"}
                                      </div>
                                    </div>
                                    <span className="text-primary-600 text-xs font-medium">↓</span>
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Time + Read status */}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-slate-400">
                                {formatTime(m.created_at)}
                              </span>
                              {mine && (
                                <span className="text-[10px]">
                                  {m.is_read ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="bg-[#f5f5f0] p-3 border-t border-[#e2e8f0] flex-shrink-0">
            {file && (
              <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 bg-white p-2 rounded-lg shadow-sm">
                <span>📎 {file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-red-400 hover:text-red-600 ml-auto">✕</button>
              </div>
            )}

            {audioBlob && (
              <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 bg-white p-2 rounded-lg shadow-sm">
                <span>🎙️ Voice ({formatTime(new Date(recordingDuration * 1000).toISOString())})</span>
                <audio controls className="h-8">
                  <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                </audio>
                <button type="button" onClick={sendVoiceMessage} className="bg-[#00a884] text-white px-3 py-1 rounded-lg text-xs hover:bg-[#008f72] transition-colors">Send</button>
                <button type="button" onClick={() => { setAudioBlob(null); setRecordingDuration(0) }} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            {isRecording && (
              <div className="flex items-center gap-3 mb-2 bg-red-50 p-3 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-700">
                  Recording {new Date(recordingDuration * 1000).toISOString().substr(14, 5)}
                </span>
                <button type="button" onClick={stopRecording} className="ml-auto bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-500 transition-colors">⏹ Stop</button>
                <button type="button" onClick={cancelRecording} className="text-slate-500 hover:text-slate-700 text-sm">Cancel</button>
              </div>
            )}

            <form onSubmit={sendMessage} className="flex items-end gap-2">
              <label className="cursor-pointer flex-shrink-0 w-10 h-10 bg-white hover:bg-slate-50 text-slate-500 rounded-full transition-colors flex items-center justify-center">
                <span>📎</span>
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.xlsx,.xls,.csv,image/*" />
              </label>

              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isRecording || !!audioBlob}
                className={`flex-shrink-0 w-10 h-10 rounded-full transition-colors flex items-center justify-center ${
                  isRecording ? "bg-red-100 text-red-600" : "bg-white text-slate-500 hover:bg-slate-50"
                } ${audioBlob ? "opacity-50 cursor-not-allowed" : ""}`}
                title="Hold to record voice"
              >
                🎙️
              </button>

              <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center">
                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={user ? "Type a message..." : "Login to chat"}
                  className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 placeholder:text-slate-400"
                  disabled={!user || isRecording}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!user || (!newMessage.trim() && !file && !audioBlob) || uploading || isRecording}
                className="flex-shrink-0 w-10 h-10 bg-[#00a884] hover:bg-[#008f72] text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
