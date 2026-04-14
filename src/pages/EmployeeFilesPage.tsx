import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { FileText, Upload, Download, Trash2, AlertCircle, FolderOpen } from 'lucide-react'
import { api, type EmployeeFileItem } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useAuth } from '@/context/AuthContext'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function EmployeeFilesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [files, setFiles] = useState<EmployeeFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pickedFile, setPickedFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const { files: list } = await api.employeeFiles.list()
      setFiles(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!pickedFile) {
      toast.error('Choose a file first.')
      return
    }
    setUploading(true)
    try {
      await api.employeeFiles.upload(pickedFile, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      })
      toast.success('File added.')
      setTitle('')
      setDescription('')
      setPickedFile(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(id: string) {
    try {
      const { url } = await api.employeeFiles.getDownloadUrl(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open file')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this file for all employees?')) return
    setDeletingId(id)
    try {
      await api.employeeFiles.remove(id)
      toast.success('File removed.')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AdminShell>
      <main className="py-1 sm:py-0 max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777] mb-1">People</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111] flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-[var(--color-primary)]" />
            Employee files
          </h1>
        </div>

        {isAdmin && (
          <section className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-semibold text-[#111] mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[var(--color-primary)]" />
              Add to the employee library
            </h2>
            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">File *</label>
                <input
                  type="file"
                  onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[#444] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[var(--color-border)] file:bg-white file:text-xs file:font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Display title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Defaults to the file name if empty"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Description (optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional context (e.g. &quot;Annual benefits summary&quot;)"
                  className="w-full resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                />
              </div>
              <button
                type="submit"
                disabled={uploading || !pickedFile}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-[#111] mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-primary)]" />
            Available files
          </h2>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-[#777]">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-[#777]">No files yet.{isAdmin ? ' Upload a document above.' : ' Ask an admin to add resources.'}</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {files.map((f) => (
                <li key={f._id} className="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111] truncate">{f.title}</p>
                    {f.description ? <p className="text-xs text-[#666] mt-0.5 line-clamp-2">{f.description}</p> : null}
                    <p className="text-[11px] text-[#999] mt-1">
                      {f.originalName} · {formatBytes(f.size)} ·{' '}
                      {new Date(f.createdAt).toLocaleString()}
                      {f.uploadedBy?.email ? ` · ${f.uploadedBy.email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleDownload(f._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[#333] hover:bg-white"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(f._id)}
                        disabled={deletingId === f._id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === f._id ? '…' : 'Remove'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AdminShell>
  )
}
