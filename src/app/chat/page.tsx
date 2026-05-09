"use client"

import { useState, useEffect, useRef } from "react"
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

interface Contact {
  id: string
  name: string
  role: string
  lastMessage?: string
  lastTime?: string
  unread: number
  online?: boolean
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [user, setUser] = useState<any>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [activeTab, setActiveTab] = useState<"global" | "private">("global")
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
      if (d.user) loadContacts(d.user.id)
    })
  }, [])

  function loadContacts(userId: string) {
    fetch("/api/users").then(r => r.json()).then(d => {
      const users = d.users || []
      const cts: Contact[] = []
      users.forEach((u: any) => {
        if (u.id !== userId) {
          cts.push({ id: u.id, name: u.name, role: u.role, unread: 0, online: false })
        }
      })
      setContacts(cts)
    })
  }

  function loadMessages() {
    if (!user) return
    const params = new URLSearchParams()
    
    if (activeTab === "private" && activeContact) {
      params.set("partnerId", activeContact.id)
    }
    // For global, no partnerId = global messages
    
    fetch(`/api/chat?${params}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeContact, activeTab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      loadMessages()
    }, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeContact, activeTab])

  async function sendMessage() {
    if (!newMessage.trim() && !file) return
    if (!user) return
    if (activeTab === "private" && !activeContact) return

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

    const formData = new FormData()
    formData.append("user_id", user.id)
    formData.append("room_id", activeTab === "global" ? "global" : "private")
    formData.append("message", newMessage)
    if (activeTab === "private" && activeContact) {
      formData.append("recipient_id", activeContact.id)
    }
    if (fileData) {
      formData.append("file_name", fileData.file_name || "")
      formData.append("file_path", fileData.file_path || "")
      formData.append("file_type", fileData.file_type || "")
    }

    await fetch("/api/chat", {
      method: "POST",
      body: formData
    })

    setNewMessage("")
    loadMessages()
  }

  async function clearChat() {
    if (!user) return
    const room = activeTab === "global" ? "global" : "private"
    const msg = activeTab === "global"
      ? "Clear global chat? This will delete all messages for everyone."
      : `Clear chat with ${activeContact?.name}? This will delete all messages.`
    if (!confirm(msg)) return

    const params = new URLSearchParams()
    params.set("room", room)
    if (activeTab === "private" && activeContact) {
      params.set("userId", user.id)
      params.set("partnerId", activeContact.id)
    }

    const res = await fetch(`/api/chat?${params}`, { method: "DELETE" })
    if (res.ok) {
      setMessages([])
    } else {
      const data = await res.json()
      alert(data.error || "Failed to clear chat")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function isImage(type: string) {
    return type?.startsWith("image/")
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  function groupMessagesByDate(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = []
    msgs.forEach(msg => {
      const dateStr = new Date(msg.created_at).toDateString()
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.date === dateStr) {
        lastGroup.messages.push(msg)
      } else {
        groups.push({ date: dateStr, messages: [msg] })
      }
    })
    return groups
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const messageGroups = groupMessagesByDate(messages)

  const getChatTitle = () => {
    if (activeTab === "global") return "Global Chat"
    if (activeContact) return activeContact.name
    return "Select a contact"
  }

  return (
    <AppLayout title="Chat" subtitle={getChatTitle()}>
      <div className="h-[calc(100vh-80px)] flex -mx-8 -mt-8">
        {/* Left Sidebar */}
        <div className={`${showMobileChat ? "hidden" : "flex"} md:flex w-full md:w-80 bg-[#0f0f1a] border-r border-white/5 flex-col`}>
          {/* Tabs */}
          <div className="flex p-2 gap-1">
            <button
              onClick={() => { setActiveTab("global"); setActiveContact(null); setShowMobileChat(true) }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "global"
                  ? "bg-violet-600 text-white"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-base">🌐</span>
                <span>Global</span>
              </div>
            </button>
            <button
              onClick={() => { setActiveTab("private"); setShowMobileChat(false) }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "private"
                  ? "bg-violet-600 text-white"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-base">🔒</span>
                <span>Private</span>
              </div>
            </button>
          </div>

          {/* Search (only for private tab) */}
          {activeTab === "private" && (
            <div className="px-3 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
            </div>
          )}

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto px-2">
            {activeTab === "global" ? (
              <button
                onClick={() => setShowMobileChat(true)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all mb-0.5 ${
                  activeTab === "global" && !activeContact
                    ? "bg-white/10 text-white border border-white/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-violet-500 to-cyan-400">
                    🌐
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0f0f1a]"></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">Global Chat</span>
                  </div>
                  <div className="text-xs text-gray-500">Team conversations</div>
                </div>
              </button>
            ) : (
              filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => {
                    setActiveContact(contact)
                    setShowMobileChat(true)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all mb-0.5 ${
                    activeContact?.id === contact.id
                      ? "bg-white/10 text-white border border-white/10"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-emerald-500 to-teal-400">
                      {contact.name?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{contact.name}</span>
                      {contact.unread > 0 && (
                        <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{contact.role}</div>
                  </div>
                </button>
              ))
            )}
            {activeTab === "private" && filteredContacts.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No users found</div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`${showMobileChat ? "flex" : "hidden"} md:flex flex-1 flex-col bg-[#0f0f1a]`}>
          {(activeTab === "global" || activeContact) ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <button 
                  className="md:hidden p-2 text-gray-400 hover:text-white"
                  onClick={() => setShowMobileChat(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    activeTab === "global"
                      ? "bg-gradient-to-br from-violet-500 to-cyan-400"
                      : "bg-gradient-to-br from-emerald-500 to-teal-400"
                  }`}>
                    {activeTab === "global" ? "🌐" : activeContact?.name?.charAt(0).toUpperCase()}
                  </div>
                  {activeTab === "global" && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0f1a]"></span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-semibold text-sm">{getChatTitle()}</h2>
                  <p className="text-xs text-gray-500">
                    {activeTab === "global" ? "Everyone can see this" : "Private conversation"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(user?.role === "Admin" || activeTab === "private") && (
                    <button onClick={clearChat} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="Clear chat">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messageGroups.map((group, groupIdx) => (
                      <div key={groupIdx}>
                        {/* Date Separator */}
                        <div className="flex justify-center my-4">
                          <span className="px-4 py-1 bg-white/5 rounded-full text-xs text-gray-500">
                            {new Date(group.date).toDateString() === new Date().toDateString() 
                              ? "Today" 
                              : new Date(group.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        
                        {group.messages.map((msg) => {
                          const isMe = msg.user_id === user?.id
                          return (
                            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}>
                              <div className={`max-w-[70%] ${isMe ? "order-2" : "order-1"}`}>
                                {!isMe && (
                                  <div className="text-xs text-gray-500 mb-1 ml-1">{msg.user?.name}</div>
                                )}
                                <div className={`rounded-2xl px-4 py-2.5 ${
                                  isMe
                                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-br-md"
                                    : "bg-white/10 text-gray-200 rounded-bl-md border border-white/5"
                                }`}>
                                  {msg.file_path ? (
                                    isImage(msg.file_type || "") ? (
                                      <img src={msg.file_path} alt={msg.file_name || "Image"} className="max-w-[200px] rounded-lg mb-1" />
                                    ) : (
                                      <a href={msg.file_path} download className="flex items-center gap-2 text-sm underline">
                                        📎 {msg.file_name}
                                      </a>
                                    )
                                  ) : (
                                    <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                                  )}
                                  <div className={`text-[10px] mt-1 ${isMe ? "text-emerald-200/70" : "text-gray-500"}`}>
                                    {formatDate(msg.created_at)}
                                    {isMe && (
                                      <span className="ml-1">{msg.is_read ? "✓✓" : "✓"}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="text-4xl mb-3">💬</div>
                          <div className="text-gray-500 text-sm">No messages yet. Start the conversation!</div>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="px-4 py-3 border-t border-white/5">
                {file && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-sm text-gray-300">{file.name}</span>
                    <button onClick={() => setFile(null)} className="ml-auto text-gray-500 hover:text-white">✕</button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full cursor-pointer transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </label>
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 focus-within:ring-1 focus-within:ring-violet-500/50">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={activeTab === "global" ? "Message everyone..." : `Message ${activeContact?.name}...`}
                      className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={uploading || (!newMessage.trim() && !file)}
                    className="p-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-full hover:opacity-90 transition-opacity disabled:opacity-40"
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
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3">👥</div>
                <div className="text-gray-500 text-sm">Select a user from the Private tab to start chatting</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
