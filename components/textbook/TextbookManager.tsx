'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, Edit2, Save, Globe, Lock, EyeOff, Upload, Image as ImageIcon } from 'lucide-react'
import type { Textbook } from '@/types/textbook'

export default function TextbookManager() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    imageUrl: '',
    status: 'hidden' as 'public' | 'private' | 'hidden'
  })
  
  const [editFormData, setEditFormData] = useState<Partial<Textbook>>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [editImagePreview, setEditImagePreview] = useState<string>('')
  
  useEffect(() => {
    fetchTextbooks()
  }, [])
  
  const fetchTextbooks = async () => {
    try {
      const response = await fetch('/api/textbooks')
      if (response.ok) {
        const data = await response.json()
        setTextbooks(data)
      }
    } catch (error) {
      console.error('Failed to fetch textbooks:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      alert('Image size must be less than 5MB')
      return
    }
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      const preview = reader.result as string
      if (isEdit) {
        setEditSelectedFile(file)
        setEditImagePreview(preview)
      } else {
        setSelectedFile(file)
        setImagePreview(preview)
      }
    }
    reader.readAsDataURL(file)
  }
  
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        const { url } = await response.json()
        return url
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to upload image')
        return null
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Error uploading image')
      return null
    } finally {
      setUploading(false)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let imageUrl = formData.imageUrl
    
    // Upload image if selected
    if (selectedFile) {
      const uploadedUrl = await uploadImage(selectedFile)
      if (!uploadedUrl) return // Upload failed
      imageUrl = uploadedUrl
    }
    
    try {
      const response = await fetch('/api/textbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, imageUrl })
      })
      
      if (response.ok) {
        const newTextbook = await response.json()
        setTextbooks([...textbooks, newTextbook])
        setFormData({ title: '', description: '', url: '', imageUrl: '', status: 'hidden' })
        setSelectedFile(null)
        setImagePreview('')
        setShowAddForm(false)
      } else {
        alert('Failed to add textbook')
      }
    } catch (error) {
      console.error('Error adding textbook:', error)
      alert('Error adding textbook')
    }
  }
  
  const startEdit = (textbook: Textbook) => {
    setEditingId(textbook.id)
    setEditFormData({
      title: textbook.title,
      description: textbook.description,
      url: textbook.url,
      imageUrl: textbook.imageUrl,
      status: textbook.status
    })
    setEditImagePreview(textbook.imageUrl || '')
    setEditSelectedFile(null)
  }
  
  const handleUpdate = async (id: string) => {
    let imageUrl = editFormData.imageUrl
    
    // Upload new image if selected
    if (editSelectedFile) {
      const uploadedUrl = await uploadImage(editSelectedFile)
      if (!uploadedUrl) return // Upload failed
      
      // Delete old image if it exists and is from our server
      const textbook = textbooks.find(t => t.id === id)
      if (textbook?.imageUrl?.startsWith('/uploads/')) {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: textbook.imageUrl })
        })
      }
      
      imageUrl = uploadedUrl
    }
    
    try {
      const response = await fetch(`/api/textbooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editFormData, imageUrl })
      })
      
      if (response.ok) {
        const updated = await response.json()
        setTextbooks(textbooks.map(t => t.id === id ? updated : t))
        setEditingId(null)
        setEditFormData({})
        setEditSelectedFile(null)
        setEditImagePreview('')
      }
    } catch (error) {
      console.error('Error updating textbook:', error)
    }
  }
  
  const handleRemove = async (id: string) => {
    if (!confirm('Remove this textbook from the hub?\n\nNote: This only removes it from the access list. The actual textbook project will NOT be deleted.')) return
    
    try {
      // Get textbook to check for image
      const textbook = textbooks.find(t => t.id === id)
      
      // Delete image if it's stored on our server
      if (textbook?.imageUrl?.startsWith('/uploads/')) {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: textbook.imageUrl })
        })
      }
      
      const response = await fetch(`/api/textbooks/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setTextbooks(textbooks.filter(t => t.id !== id))
        alert('Textbook removed from hub (the actual textbook project is unchanged)')
      }
    } catch (error) {
      console.error('Error removing textbook:', error)
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'public':
        return { icon: Globe, color: 'text-green-600', bg: 'bg-green-100' }
      case 'private':
        return { icon: Lock, color: 'text-yellow-600', bg: 'bg-yellow-100' }
      case 'hidden':
        return { icon: EyeOff, color: 'text-gray-600', bg: 'bg-gray-100' }
      default:
        return { icon: EyeOff, color: 'text-gray-600', bg: 'bg-gray-100' }
    }
  }
  
  if (loading) {
    return <div className="text-center py-8">Loading textbooks...</div>
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Textbook Management</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Textbook</span>
        </button>
      </div>
      
      {showAddForm && (
        <div className="p-6 border-b bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Introduction to Physics"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
                <input
                  type="url"
                  required
                  placeholder="http://localhost:3001"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                placeholder="Brief description of the textbook content..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, false)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center space-x-2"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{selectedFile ? selectedFile.name : 'Choose Image'}</span>
                  </button>
                  <p className="text-xs text-gray-500">Max 5MB, JPEG/PNG only</p>
                  {imagePreview && (
                    <div className="relative mt-2">
                      <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-md" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null)
                          setImagePreview('')
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="hidden">🔒 Hidden (Not visible to students)</option>
                  <option value="private">🔐 Private (Requires approval)</option>
                  <option value="public">🌍 Public (Open to all)</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button 
                type="submit" 
                disabled={uploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Add Textbook'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setFormData({ title: '', description: '', url: '', imageUrl: '', status: 'hidden' })
                  setSelectedFile(null)
                  setImagePreview('')
                }}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="p-6">
        {textbooks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No textbooks added yet</p>
        ) : (
          <div className="space-y-4">
            {textbooks.map(textbook => {
              const statusInfo = getStatusIcon(textbook.status)
              const StatusIcon = statusInfo.icon
              const isEditing = editingId === textbook.id
              
              return (
                <div key={textbook.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  {isEditing ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editFormData.title}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          className="px-2 py-1 border rounded"
                          placeholder="Title"
                        />
                        <input
                          type="url"
                          value={editFormData.url}
                          onChange={(e) => setEditFormData({ ...editFormData, url: e.target.value })}
                          className="px-2 py-1 border rounded"
                          placeholder="URL"
                        />
                      </div>
                      <textarea
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                        rows={2}
                        placeholder="Description"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, true)}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="w-full px-2 py-1 border rounded hover:bg-gray-50 text-sm"
                          >
                            {editSelectedFile ? editSelectedFile.name : 'Change Image'}
                          </button>
                          {editImagePreview && (
                            <img src={editImagePreview} alt="Preview" className="mt-1 w-full h-20 object-cover rounded" />
                          )}
                        </div>
                        <select
                          value={editFormData.status}
                          onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                          className="px-2 py-1 border rounded"
                        >
                          <option value="hidden">Hidden</option>
                          <option value="private">Private</option>
                          <option value="public">Public</option>
                        </select>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleUpdate(textbook.id)}
                          disabled={uploading}
                          className="text-green-600 hover:text-green-700 flex items-center disabled:opacity-50"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {uploading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditFormData({})
                            setEditSelectedFile(null)
                            setEditImagePreview('')
                          }}
                          className="text-gray-600 hover:text-gray-700 flex items-center"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start justify-between">
                      <div className="flex space-x-4 flex-1">
                        {textbook.imageUrl && (
                          <img 
                            src={textbook.imageUrl} 
                            alt={textbook.title}
                            className="w-20 h-24 object-cover rounded-md border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-lg font-medium">{textbook.title}</h4>
                            <div className={`${statusInfo.bg} ${statusInfo.color} p-1 rounded`}>
                              <StatusIcon className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{textbook.description}</p>
                          <div className="flex items-center space-x-4 mt-2">
                            <p className="text-xs text-gray-500">{textbook.url}</p>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              textbook.status === 'public' ? 'bg-green-100 text-green-800' :
                              textbook.status === 'private' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {textbook.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(textbook)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Edit textbook"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(textbook.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove from hub"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}