import { useRef } from 'react'
import type { VenueDocument } from '../lib/domain'
import { Icon } from './Icon'

// Mock file upload: captures real File names/sizes but stores only metadata.
export function FileDrop({
  files, onChange, accept = '.pdf,.jpg,.png',
}: {
  files: VenueDocument[]
  onChange: (files: VenueDocument[]) => void
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    const next: VenueDocument[] = Array.from(list).map((f) => ({
      id: `doc-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      kind: (f.name.split('.').pop() ?? 'file').toUpperCase(),
      sizeKb: Math.max(1, Math.round(f.size / 1024)),
    }))
    onChange([...files, ...next])
  }

  return (
    <div className="filedrop">
      <button type="button" className="filedrop-zone" onClick={() => inputRef.current?.click()}>
        <Icon name="bill" size={20} />
        <span>Click to upload documents</span>
        <small className="faint">{accept.replaceAll('.', '').toUpperCase()}</small>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
      />
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.id}>
              <span className="badge badge-neutral">{f.kind}</span>
              <span className="file-name">{f.name}</span>
              <span className="faint">{f.sizeKb} KB</span>
              <button type="button" className="btn btn-ghost" onClick={() => onChange(files.filter((x) => x.id !== f.id))}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
