"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { AppLayout } from "@/components/AppLayout"

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

interface Channel {
  id: string
  name: string
  type: "global" | "private"
  unread: number
  partner?: UserOption
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [user, setUser] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChannel, setActiveChannel] = useState<Channel>({ id: "global", name: "General", type: "global", unread: 0 })
  const [channels, setChannels] = useState<Channel[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
      if (d.user) {
        loadUsers(d.user.id)
        buildChannels(d.user.id)
      }
    })
  }, [])

  function buildChannels(userId: string) {
    fetch("/api/users").then(r => r.json()).then(d => {
      const users = d.users || []
      const chs: Channel[] = [{ id: "global", name: "General", type: "global", unread: 0 }]
      users.forEach((u: UserOption) => {
        if (u.id !== userId) {
          chs.push({ id: u.id, name: u.name, type: "private", unread: 0, partner: u })
        }
      })
      setChannels(chs)
      setAllUsers(users)
    })
  }

  function loadMessages() {
    if (!user) return
    const params = new URLSearchParams()
    if (activeChannel.type === "private" && activeChannel.partner) {
      params.set("partnerId", activeChannel.partner.id)
    }
    fetch(`/api/chat?${params}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    if (user && activeChannel) {
      loadMessages()
    }
  }, [user, activeChannel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!newMessage.trim() && !file) return
    if (!user) return

    let fileData = null
    if (file) {
      setUploading(true)
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      fileData = data.file
      setUploading(false)
      setFile(null)
    }

    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: newMessage,
        recipientId: activeChannel.type === "private" ? activeChannel.partner?.id : null,
        file_name: fileData?.file_name || null,
        file_path: fileData?.file_path || null,
        file_type: fileData?.file_type || null
      })
    })

    setNewMessage("")
    loadMessages()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const formData = new FormData()
        formData.append("file", audioBlob, `voice-${Date.now()}.webm`)

        const res = await fetch("/api/upload", { method: "POST", body: formData })
        const data = await res.json()

        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "🎤 Voice message",
            recipientId: activeChannel.type === "private" ? activeChannel.partner?.id : null,
            file_name: data.file?.file_name,
            file_path: data.file?.file_path,
            file_type: "audio/webm"
          })
        })

        stream.getTracks().forEach(track => track.stop())
        loadMessages()
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (err) {
      alert("Microphone access denied")
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    setRecordingDuration(0)
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  function isImage(type: string) {
    return type?.startsWith("image/")
  }

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedMessages = messages.reduce((groups: any[], msg) => {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.user_id === msg.user_id) {
      lastGroup.messages.push(msg)
    } else {
      groups.push({ user_id: msg.user_id, user: msg.user, messages: [msg] })
    }
    return groups
  }, [])

  return (
    <AppLayout>
      <div className="h-[calc(100vh-80px)] flex -mx-8 -mt-8">
        {/* Left Sidebar - Channels */}
        <div className="w-72 bg-[#0f0f1a] border-r border-white/5 flex flex-col">
          {/* Search */}
          <div className="p-4 pb-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>

          {/* Channels Header */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Channels</span>
              <button className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto px-2">
            {filteredChannels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-0.5 ${
                  activeChannel.id === channel.id
                    ? "bg-white/10 text-white border border-white/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {channel.type === "global" ? (
                  <span className="text-gray-500">#</span>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                    {channel.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{channel.name}</div>
                  {channel.type === "private" && (
                    <div className="text-[10px] text-gray-500 truncate">{channel.partner?.role}</div>
                  )}
                </div>
                {channel.unread > 0 && (
                  <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {channel.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Current User */}
          {user && (
            <div className="p-3 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user.name}</div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-xs text-gray-500">Online</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-[#0f0f1a]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeChannel.type === "global" ? (
                <span className="text-gray-400">#</span>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
                  {activeChannel.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-white font-semibold">{activeChannel.name}</h2>
                <p className="text-xs text-gray-500">{messages.length} messages</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                {groupedMessages.map((group: any, groupIdx: number) => {
                  const isMe = group.user_id === user?.id
                  return (
                    <div key={groupIdx} className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
                        {group.user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">{group.user?.name}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(group.messages[0].created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {group.messages.map((msg: Message) => (
                            <div key={msg.id}>
                              {msg.file_path ? (
                                isImage(msg.file_type || "") ? (
                                  <img
                                    src={msg.file_path}
                                    alt={msg.file_name || "Image"}
                                    className="max-w-xs rounded-xl border border-white/10"
                                  />
                                ) : (
                                  <a
                                    href={msg.file_path}
                                    download
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    {msg.file_name}
                                  </a>
                                )
                              ) : (
                                <div className={`text-sm text-gray-200 leading-relaxed ${msg.message.includes("🎤") ? "text-violet-300" : ""}`}>
                                  {msg.message}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-3">💬</div>
                      <div className="text-gray-500 text-sm">No messages yet. Start the conversation!</div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="px-6 py-4 border-t border-white/5">
            {file && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm text-gray-300">{file.name}</span>
                <button onClick={() => setFile(null)} className="ml-auto text-gray-500 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <label className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              <div className="flex-1 relative">
                {isRecording ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-red-400">Recording... {formatTime(recordingDuration)}</span>
                    <button onClick={stopRecording} className="ml-auto text-sm text-red-400 hover:text-red-300">
                      Stop
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:ring-1 focus-within:ring-violet-500/50">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                    />
                    <button
                      onClick={() => isRecording ? stopRecording() : startRecording()}
                      className="text-gray-500 hover:text-violet-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={uploading || (!newMessage.trim() && !file)}
                className="p-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {uploading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
