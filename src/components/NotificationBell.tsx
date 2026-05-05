"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useNotifications } from "@/hooks/useNotifications"

export function NotificationBell({ userId }: { userId: string }) {
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications(userId)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 10).map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id)
                  if (n.link) window.location.href = n.link
                  setIsOpen(false)
                }}
                className={`p-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition-colors ${
                  !n.is_read ? "bg-slate-700/30 border-l-2 border-l-primary-500" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">
                    {n.type === "Chat" && "💬"}
                    {n.type === "Schedule" && "📅"}
                    {n.type === "Document" && "📄"}
                    {n.type === "Project" && "📊"}
                    {n.type === "Alert" && "⚠️"}
                    {n.type === "Call" && "📞"}
                    {n.type === "System" && "ℹ️"}
                    {n.type === "Mention" && "👤"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0"></span>
                  )}
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-sm">
                No notifications yet
              </div>
            )}
          </div>

          <div className="p-2 border-t border-slate-700 text-center">
            <Link
              href="/notifications"
              className="text-sm text-primary-400 hover:text-primary-300"
              onClick={() => setIsOpen(false)}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
