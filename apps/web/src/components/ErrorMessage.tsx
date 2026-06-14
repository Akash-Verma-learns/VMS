import { AlertCircle } from "lucide-react"
interface Props { message: string; onRetry?: () => void }
export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="border border-red-300 bg-red-50 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
      <div className="flex-1">
        <p className="text-red-700 text-sm">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-sm text-red-600 underline hover:text-red-800">
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
