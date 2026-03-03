'use client'
import { Book, Lock, Unlock, Globe, EyeOff, ExternalLink, Clock } from 'lucide-react'
import type { Textbook } from '@/types/textbook'

interface TextbookCardProps {
  textbook: Textbook
  hasAccess: boolean
  isPending?: boolean
  isOpening?: boolean
  onRequestAccess?: () => void
  onOpen?: () => void
}

export default function TextbookCard({
  textbook,
  hasAccess,
  isPending,
  isOpening,
  onRequestAccess,
  onOpen
}: TextbookCardProps) {
  const getStatusIcon = () => {
    switch (textbook.status) {
      case 'public':
        return { icon: Globe, color: 'text-green-600', bg: 'bg-green-100', tooltip: 'Publicly Accessible' }
      case 'private':
        return hasAccess
          ? { icon: Unlock, color: 'text-blue-600', bg: 'bg-blue-100', tooltip: 'Access Granted' }
          : { icon: Lock, color: 'text-yellow-600', bg: 'bg-yellow-100', tooltip: 'Private Textbook' }
      case 'hidden':
        return { icon: EyeOff, color: 'text-gray-600', bg: 'bg-gray-100', tooltip: 'Hidden' }
    }
  }

  const { icon: StatusIcon, color, bg, tooltip } = getStatusIcon()

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 relative group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{textbook.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{textbook.description}</p>
        </div>
        <div className={`${bg} ${color} p-2 rounded-full cursor-help`} title={tooltip}>
          <StatusIcon className="h-5 w-5" />
        </div>
      </div>

      {textbook.imageUrl && (
        <img
          src={textbook.imageUrl}
          alt={textbook.title}
          className="w-full h-40 object-cover rounded-md mb-4"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}

      <div className="mt-4">
        {hasAccess ? (
          <button
            onClick={onOpen}
            disabled={isOpening}
            className={`w-full py-2 px-4 rounded-md transition-colors flex items-center justify-center space-x-2 ${isOpening
              ? 'bg-blue-300 text-blue-100 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            <ExternalLink className="h-4 w-4" />
            <span>{isOpening ? 'Opening...' : 'Open Textbook'}</span>
          </button>
        ) : isPending ? (
          <div className="w-full bg-gray-100 text-gray-600 py-2 px-4 rounded-md flex items-center justify-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Request Pending</span>
          </div>
        ) : textbook.status === 'private' ? (
          <button
            onClick={onRequestAccess}
            className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 transition-colors"
          >
            Request Access
          </button>
        ) : null}
      </div>
    </div>
  )
}
