interface Props { message?: string }
export default function LoadingSpinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-gray-500 text-sm">{message}</p>}
    </div>
  )
}
