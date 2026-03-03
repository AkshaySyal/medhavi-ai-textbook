import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user || user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const data = await request.formData()
    const file: File | null = data.get('image') as unknown as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' }, { status: 400 })
    }
    
    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Create unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split('.').pop()
    const filename = `textbook-${timestamp}-${randomString}.${extension}`
    
    // Save to public/uploads directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'textbooks')
    const filePath = path.join(uploadDir, filename)
    
    // Create directory if it doesn't exist
    const { mkdir } = await import('fs/promises')
    await mkdir(uploadDir, { recursive: true })
    
    // Write file
    await writeFile(filePath, buffer)
    
    // Return the URL
    const url = `/uploads/textbooks/${filename}`
    
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user || user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { url } = await request.json()
    
    if (!url || !url.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 })
    }
    
    // Extract filename from URL
    const filename = url.split('/').pop()
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'textbooks', filename)
    
    // Delete file
    try {
      await unlink(filePath)
    } catch (error) {
      console.error('File deletion error:', error)
      // File might already be deleted, continue
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}